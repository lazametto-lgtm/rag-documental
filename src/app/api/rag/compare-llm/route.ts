import { NextResponse } from 'next/server';
import type { RagQuery, RagAnswer, Citation, RetrievedChunk } from '@/lib/rag/types';
import { retrieve, hasEnoughEvidence } from '@/lib/rag/retriever';
import { getLLMProvider, getLocalLLMProvider } from '@/lib/rag/llm';
import {
  SYSTEM_PROMPT_V1,
  SYSTEM_PROMPT_LOCAL_V1,
  buildUserPrompt,
  type PromptContext,
} from '@/lib/rag/prompts';
import { buildSnippet, chunkTypeLabel } from '@/lib/rag/utils';
import { ensureInitialized } from '@/lib/rag/init';
import type { LLMMessage } from '@/lib/rag/types';

const MAX_CONTEXT_CHUNKS = 8;

interface ABResult {
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  warnings: string[];
  noEvidence: boolean;
  latencyMs: number;
  llmProvider: string;
  error?: string;
}

async function generateWithProvider(
  question: string,
  history: RagQuery['history'],
  chunks: RetrievedChunk[],
  provider: 'commercial' | 'local',
): Promise<ABResult> {
  const start = Date.now();
  const evidence = hasEnoughEvidence(chunks);
  const ctxChunks: PromptContext['chunks'] = chunks.map((c) => ({
    chunkId: c.id,
    documentTitle: c.metadata.documentTitle,
    docType: c.metadata.docType,
    page: c.metadata.page,
    section: c.metadata.section,
    clauseRef: c.metadata.clauseRef,
    chunkType: c.metadata.chunkType,
    snippet: buildSnippet(c.content, 1200),
    jurisdiction: c.metadata.jurisdiction,
    entity: c.metadata.entity,
    period: c.metadata.period,
    version: c.metadata.version,
    status: c.metadata.status,
    score: c.score,
  }));
  const ctx: PromptContext = { question, history, chunks: ctxChunks };
  const systemPrompt = provider === 'local' ? SYSTEM_PROMPT_LOCAL_V1 : SYSTEM_PROMPT_V1;
  const llm = provider === 'local' ? getLocalLLMProvider() : getLLMProvider();

  const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];
  if (history && history.length > 0) {
    for (const h of history.slice(-6)) messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: 'user', content: buildUserPrompt(ctx) });

  let answer: string;
  let noEvidence = false;
  const warnings: string[] = [];

  if (!evidence.enough) {
    answer = 'No se encontró información suficiente en los documentos proporcionados.';
    noEvidence = true;
  } else {
    try {
      answer = await llm.generate(messages, { temperature: 0.2, maxTokens: 1200 });
    } catch (err) {
      answer = `Error: ${(err as Error).message}`;
      warnings.push(`LLM ${provider} falló`);
    }
  }

  const citations: Citation[] = chunks.map((c) => ({
    documentId: c.metadata.documentId,
    documentTitle: c.metadata.documentTitle,
    docType: c.metadata.docType,
    page: c.metadata.page,
    section: c.metadata.section,
    clauseRef: c.metadata.clauseRef,
    chunkId: c.id,
    chunkType: c.metadata.chunkType,
    snippet: buildSnippet(c.content, 280),
    jurisdiction: c.metadata.jurisdiction,
    entity: c.metadata.entity,
    period: c.metadata.period,
    version: c.metadata.version,
    status: c.metadata.status,
    score: c.score,
  }));

  const score = evidence.bestScore;
  const countFactor = Math.min(1, chunks.length / 5);
  const scoreFactor = Math.min(1, score / 0.5);
  const confidenceScore = Math.round((0.7 * scoreFactor + 0.3 * countFactor) * 100) / 100;
  const confidence: 'high' | 'medium' | 'low' =
    confidenceScore >= 0.6 ? 'high' : confidenceScore >= 0.3 ? 'medium' : 'low';

  return {
    answer,
    citations,
    confidence,
    confidenceScore,
    warnings,
    noEvidence,
    latencyMs: Date.now() - start,
    llmProvider: llm.name,
  };
}

// POST /api/rag/compare-llm — compara respuestas de LLM comercial vs local
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = (await req.json()) as Partial<RagQuery>;
    if (!body.question) {
      return NextResponse.json({ error: 'Se requiere "question"' }, { status: 400 });
    }

    // Recuperación una sola vez (compartida por ambos LLMs)
    const retrieval = await retrieve(body.question, body.options ?? {});
    const chunks = retrieval.chunks.slice(0, MAX_CONTEXT_CHUNKS);

    // Generar en paralelo con ambos proveedores
    const [commercial, local] = await Promise.all([
      generateWithProvider(body.question, body.history, chunks, 'commercial'),
      generateWithProvider(body.question, body.history, chunks, 'local'),
    ]);

    // Calcular similitud entre las dos respuestas (word overlap Jaccard)
    const similarity = jaccardSimilarity(commercial.answer, local.answer);

    return NextResponse.json({
      success: true,
      question: body.question,
      retrievedChunks: chunks.length,
      retrievalLatencyMs: retrieval.latencyMs,
      commercial,
      local,
      similarity,
      bestScore: hasEnoughEvidence(chunks).bestScore,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}

// Jaccard similarity a nivel de palabras (normalizada lowercase, sin stopwords)
function jaccardSimilarity(a: string, b: string): number {
  const stop = new Set(['de','la','el','los','las','y','o','a','en','que','con','por','para','del','al','se','es','the','of','and','to','in','is','are']);
  const ta = new Set(
    a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-záéíóúñ0-9]+/g)?.filter((w) => w.length > 2 && !stop.has(w)) ?? [],
  );
  const tb = new Set(
    b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-záéíóúñ0-9]+/g)?.filter((w) => w.length > 2 && !stop.has(w)) ?? [],
  );
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union > 0 ? Math.round((inter / union) * 1000) / 10 : 0;
}

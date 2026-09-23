// Generador con citas: orquesta recuperación → prompt → LLM → parseo de citas.
// Devuelve RagAnswer con respuesta estructurada, evidencia, citas y confianza.

import type {
  RagAnswer,
  RagQuery,
  RetrievedChunk,
  Citation,
  LLMMessage,
} from './types';
import { retrieve, hasEnoughEvidence } from './retriever';
import { getLLMProvider, getLocalLLMProvider } from './llm';
import {
  SYSTEM_PROMPT_V1,
  SYSTEM_PROMPT_LOCAL_V1,
  buildUserPrompt,
  parseCitationIds,
  type PromptContext,
} from './prompts';
import { buildSnippet, chunkTypeLabel } from './utils';
import { db } from '@/lib/db';

const MAX_CONTEXT_CHUNKS = 8;
const MAX_EVIDENCE_CHARS = 1200;

export async function answerQuery(query: RagQuery): Promise<RagAnswer> {
  const start = Date.now();
  const opts = query.options ?? {};

  // 1) Recuperación híbrida
  const retrieval = await retrieve(query.question, opts);
  const chunks = retrieval.chunks.slice(0, MAX_CONTEXT_CHUNKS);

  // 2) ¿Hay evidencia suficiente?
  const evidence = hasEnoughEvidence(chunks);

  // 3) Construir contexto para el LLM
  const ctxChunks: PromptContext['chunks'] = chunks.map((c) => ({
    chunkId: c.id,
    documentTitle: c.metadata.documentTitle,
    docType: c.metadata.docType,
    page: c.metadata.page,
    section: c.metadata.section,
    clauseRef: c.metadata.clauseRef,
    chunkType: c.metadata.chunkType,
    snippet: buildSnippet(c.content, MAX_EVIDENCE_CHARS),
    jurisdiction: c.metadata.jurisdiction,
    entity: c.metadata.entity,
    period: c.metadata.period,
    version: c.metadata.version,
    status: c.metadata.status,
    score: c.score,
  }));

  const ctx: PromptContext = {
    question: query.question,
    history: query.history,
    chunks: ctxChunks,
  };

  // 4) Decidir proveedor LLM
  const localMode = query.localMode ?? false;
  const llm = localMode ? getLocalLLMProvider() : getLLMProvider();
  const systemPrompt = localMode ? SYSTEM_PROMPT_LOCAL_V1 : SYSTEM_PROMPT_V1;

  // 5) Construir mensajes
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
  ];
  // Incluir historial si existe
  if (query.history && query.history.length > 0) {
    for (const h of query.history.slice(-6)) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({ role: 'user', content: buildUserPrompt(ctx) });

  // 6) Generar respuesta
  let answer: string;
  let noEvidence = false;
  let warnings: string[] = [];

  if (!evidence.enough) {
    // Respuesta predefinida: no hay evidencia
    answer =
      'No se encontró información suficiente en los documentos proporcionados.\n\n**Confianza:** Alta (no se recuperaron fragmentos con score suficiente).\n\nCITAS: ninguna';
    noEvidence = true;
  } else {
    try {
      answer = await llm.generate(messages, { temperature: 0.2, maxTokens: 1200 });
    } catch (err) {
      // Fallback al modo local si el LLM comercial falla
      warnings.push(
        `LLM comercial no disponible, usando modo local extractivo: ${(err as Error).message}`,
      );
      const localLLM = getLocalLLMProvider();
      answer = await localLLM.generate(messages);
    }
  }

  // 7) Construir citas a partir de los chunks recuperados
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

  // 8) Calcular confianza
  const { confidence, confidenceScore } = computeConfidence(evidence.bestScore, chunks.length);

  // 9) Advertencias adicionales
  if (chunks.some((c) => c.metadata.status === 'SUPERSEDED')) {
    warnings.push('Algunos fragmentos citados provienen de documentos derogados/sustituidos.');
  }
  if (chunks.some((c) => c.metadata.status === 'DRAFT')) {
    warnings.push('Algunos fragmentos citados provienen de documentos en estado borrador.');
  }
  if (chunks.length > 0 && chunks[0].score < 0.3) {
    warnings.push('La confianza de recuperación es baja; verifica la respuesta contra el documento original.');
  }

  // 10) Logging a BD (asíncrono, sin bloquear respuesta)
  const latencyMs = Date.now() - start;
  const ragAnswer: RagAnswer = {
    answer,
    evidence: chunks.map((c) => buildSnippet(c.content, 280)),
    citations,
    confidence,
    confidenceScore,
    warnings,
    retrievedChunks: chunks,
    latencyMs,
    llmProvider: llm.name,
    noEvidence,
    expandedQueries: retrieval.expandedQueries,
  };

  // Persistir QueryLog (fire and forget, maneja errores)
  void persistQueryLog(query.question, ragAnswer).catch(() => {});

  return ragAnswer;
}

async function persistQueryLog(question: string, answer: RagAnswer): Promise<void> {
  try {
    await db.queryLog.create({
      data: {
        question,
        response: JSON.stringify({
          answer: answer.answer,
          citations: answer.citations,
          confidence: answer.confidence,
          confidenceScore: answer.confidenceScore,
          warnings: answer.warnings,
          latencyMs: answer.latencyMs,
          retrievedChunks: answer.retrievedChunks.map((c) => ({
            chunkId: c.id,
            score: c.score,
            docType: c.metadata.docType,
            documentTitle: c.metadata.documentTitle,
            page: c.metadata.page,
            section: c.metadata.section,
            chunkType: c.metadata.chunkType,
          })),
        }),
        llmProvider: answer.llmProvider,
        latencyMs: answer.latencyMs,
        retrievedCount: answer.retrievedChunks.length,
        documentId: answer.citations[0]?.documentId ?? null,
        chunks: {
          connect: answer.retrievedChunks.map((c) => ({ id: c.id })),
        },
      },
    });
  } catch {
    // Sin logging no rompe el flujo
  }
}

function computeConfidence(
  bestScore: number,
  chunkCount: number,
): { confidence: 'high' | 'medium' | 'low'; confidenceScore: number } {
  // Confianza compuesta: score del mejor chunk + cantidad de chunks relevantes
  const countFactor = Math.min(1, chunkCount / 5);
  const scoreFactor = Math.min(1, bestScore / 0.5);
  const score = 0.7 * scoreFactor + 0.3 * countFactor;
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 0.6) confidence = 'high';
  else if (score >= 0.3) confidence = 'medium';
  else confidence = 'low';
  return { confidence, confidenceScore: Math.round(score * 100) / 100 };
}

// Utilidad para formatear citas a string legible
export function formatCitation(c: Citation): string {
  const parts: string[] = [`Documento: ${c.documentTitle}`, `pág. ${c.page}`];
  if (c.section) parts.push(`sección "${c.section}"`);
  if (c.clauseRef) parts.push(c.clauseRef);
  if (c.jurisdiction) parts.push(`jurisdicción: ${c.jurisdiction}`);
  if (c.entity) parts.push(`entidad: ${c.entity}`);
  if (c.period) parts.push(`período: ${c.period}`);
  if (c.version) parts.push(`versión: ${c.version}`);
  parts.push(`tipo: ${chunkTypeLabel(c.chunkType)}`);
  parts.push(`score: ${c.score.toFixed(2)}`);
  return `[${parts.join(', ')}]`;
}

export function formatCitations(citations: Citation[]): string {
  return citations.map((c, i) => `${i + 1}. ${formatCitation(c)}\n   "${c.snippet}"`).join('\n');
}

// Re-export para conveniencia
export { parseCitationIds };

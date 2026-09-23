// Recuperador híbrido: BM25 ⊕ similitud vectorial + MMR + reranking.
// Combina búsqueda léxica (BM25) y densa (vector store), aplica filtros por
// metadatos y opcionalmente expande la consulta (multi-query).

import type {
  Chunk,
  RetrievedChunk,
  RetrievalOptions,
  RetrievalFilters,
  RagAnswer,
} from './types';
import { getBM25Index } from './bm25';
import { getVectorStore } from './vector-store';
import { getReranker, mmrSelect } from './reranker';
import { getDefaultEmbedder } from './embeddings';
import { tokenize } from './utils';

const DEFAULT_TOP_K = 20;
const DEFAULT_RERANK_TOP_K = 6;
const DEFAULT_MMR_LAMBDA = 0.7;

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  expandedQueries?: string[];
  latencyMs: number;
  bm25Count: number;
  vectorCount: number;
}

export async function retrieve(
  question: string,
  opts: RetrievalOptions = {},
): Promise<RetrievalResult> {
  const start = Date.now();
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const rerankTopK = opts.rerankTopK ?? DEFAULT_RERANK_TOP_K;
  const mmrLambda = opts.mmrLambda ?? DEFAULT_MMR_LAMBDA;
  const useReranker = opts.useReranker ?? true;
  const useMultiQuery = opts.useMultiQuery ?? false;
  const filters = opts.filters;

  const embedder = getDefaultEmbedder();
  const bm25 = getBM25Index();
  const store = getVectorStore();

  // 1) Expansión de consultas (multi-query): variantes simples
  let queries = [question];
  if (useMultiQuery) {
    queries = expandQuery(question);
  }

  // 2) Recuperación paralela por cada query
  const seen = new Map<string, RetrievedChunk>();
  for (const q of queries) {
    // Búsqueda vectorial
    const qVec = await embedder.embed(q);
    const vecResults = await store.search(qVec, topK, filters);
    // Búsqueda léxica
    const bm25Results = bm25.search(q, topK, filters);
    // Fusionar por chunk id, conservando los mejores scores
    for (const r of vecResults) {
      const existing = seen.get(r.id);
      if (!existing) {
        seen.set(r.id, { ...r, vectorScore: r.vectorScore ?? 0 });
      } else {
        if ((r.vectorScore ?? 0) > (existing.vectorScore ?? 0)) existing.vectorScore = r.vectorScore;
      }
    }
    for (const r of bm25Results) {
      const existing = seen.get(r.id);
      if (!existing) {
        seen.set(r.id, { ...r, bm25Score: r.bm25Score ?? 0 });
      } else {
        if ((r.bm25Score ?? 0) > (existing.bm25Score ?? 0)) existing.bm25Score = r.bm25Score;
      }
    }
  }

  // 3) Score híbrido combinado: α * vector + (1-α) * bm25
  const alpha = 0.55; // peso vectorial
  const merged: RetrievedChunk[] = [];
  for (const c of seen.values()) {
    const v = c.vectorScore ?? 0;
    const b = c.bm25Score ?? 0;
    const hybrid = alpha * v + (1 - alpha) * b;
    merged.push({ ...c, score: hybrid });
  }
  merged.sort((a, b) => b.score - a.score);

  // 4) Top-N para reranking
  const top = merged.slice(0, Math.max(rerankTopK * 3, 12));

  let final: RetrievedChunk[];
  if (useReranker) {
    const reranker = getReranker();
    // Pasar como Chunk (sin scores) al reranker
    const rerankInput: Chunk[] = top.map((c) => ({
      id: c.id,
      content: c.content,
      metadata: c.metadata,
      embedding: c.embedding,
      norm: c.norm,
      tokenCount: c.tokenCount,
      tableData: c.tableData,
    }));
    const reranked = await reranker.rerank(question, rerankInput, topK);
    // Fusionar scores: rerankScore + hybrid como ponderación
    final = reranked.map((c, i) => {
      const base = top.find((x) => x.id === c.id);
      const rerankScore = c.rerankScore ?? 0;
      const hybrid = base?.score ?? 0;
      // Mezcla: 0.6 rerank + 0.4 hybrid
      const combined = 0.6 * rerankScore + 0.4 * hybrid;
      return {
        ...c,
        score: combined,
        vectorScore: base?.vectorScore,
        bm25Score: base?.bm25Score,
        rerankScore,
        rank: i + 1,
      };
    });
  } else {
    final = top.slice(0, rerankTopK).map((c, i) => ({ ...c, rank: i + 1 }));
  }

  // 5) MMR para diversidad
  const qVec = await embedder.embed(question);
  const diversified = mmrSelect(final, qVec, rerankTopK, mmrLambda);
  // Re-rankear por score final
  diversified.sort((a, b) => b.score - a.score);
  for (let i = 0; i < diversified.length; i++) diversified[i].rank = i + 1;

  return {
    chunks: diversified,
    expandedQueries: useMultiQuery ? queries.slice(1) : undefined,
    latencyMs: Date.now() - start,
    bm25Count: seen.size,
    vectorCount: seen.size,
  };
}

// Expansión simple de consulta: variantes léxicas + sinónimos legales/contables
function expandQuery(q: string): string[] {
  const variants = new Set<string>([q]);
  // Quitar signos
  const clean = q.replace(/[¿?¡!.,;:]/g, '').trim();
  variants.add(clean);
  // Quitar stopwords manualmente: si la query tiene términos comunes
  const tokens = clean.split(/\s+/);
  if (tokens.length > 4) {
    variants.add(tokens.slice(0, 5).join(' '));
    variants.add(tokens.slice(-4).join(' '));
  }
  // Sinónimos contables/legales básicos
  const syn: Record<string, string[]> = {
    ingreso: ['ingresos', 'ventas', 'revenue'],
    ingresos: ['ingreso', 'ventas', 'revenue'],
    activo: ['activos', 'assets'],
    activos: ['activo', 'assets'],
    pasivo: ['pasivos', 'liabilities'],
    pasivos: ['pasivo', 'liabilities'],
    ganancia: ['beneficio', 'utilidad', 'profit'],
    perdida: ['pérdidas', 'loss'],
    contrato: ['convenio', 'acuerdo', 'contract'],
    clausula: ['cláusula', 'cl', 'clause'],
    articulo: ['art', 'artículo', 'article'],
    ley: ['normativa', 'ley', 'law'],
  };
  const expanded: string[] = [];
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (syn[key]) {
      for (const s of syn[key]) {
        variants.add(clean.replace(new RegExp(`\\b${key}\\b`, 'i'), s));
      }
    }
  }
  for (const v of variants) expanded.push(v);
  return expanded.slice(0, 4); // límite
}

// Determinar si hay "evidencia suficiente": threshold sobre score del mejor chunk
export function hasEnoughEvidence(chunks: RetrievedChunk[]): {
  enough: boolean;
  bestScore: number;
} {
  if (chunks.length === 0) return { enough: false, bestScore: 0 };
  const best = chunks[0].score;
  // Threshold empírico para embeddings TF-IDF con rerank mixto
  const enough = best >= 0.18;
  return { enough, bestScore: best };
}

// Re-exportar tipo RagAnswer para conveniencia
export type { RagAnswer };

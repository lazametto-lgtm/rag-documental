// Reranker simulado (cross-encoder ligero vía co-ocurrencia de términos + señales).
// Interfaz Reranker: permite conectar Cohere Rerank / BGE reranker / cross-encoder real.

import type { Chunk, RetrievedChunk, Reranker, RetrievalFilters } from './types';
import { tokenize, cosineSim } from './utils';

class HybridReranker implements Reranker {
  readonly name = 'hybrid-coocurrence-reranker';

  async rerank(query: string, chunks: Chunk[], topK: number): Promise<RetrievedChunk[]> {
    if (chunks.length === 0) return [];
    const qTokens = new Set(tokenize(query));
    const scored: { chunk: Chunk; score: number }[] = [];

    for (const c of chunks) {
      const cTokens = tokenize(c.content);
      const cSet = new Set(cTokens);
      // Co-ocurrencia: cuántos tokens de la query aparecen en el chunk
      let overlap = 0;
      for (const t of qTokens) if (cSet.has(t)) overlap++;
      // Densidad: overlap normalizado por longitud del chunk
      const density = cSet.size > 0 ? overlap / cSet.size : 0;
      // Cobertura: proporción de tokens de la query presentes
      const coverage = qTokens.size > 0 ? overlap / qTokens.size : 0;
      // Penalización por chunk muy corto o muy largo
      const lenPenalty = Math.min(1, cTokens.length / 40) * Math.max(0.4, 1 - cTokens.length / 600);
      // Bonus por tipos relevantes (cláusulas/artículos/tablas)
      const typeBonus =
        c.metadata.chunkType === 'ARTICLE' ||
        c.metadata.chunkType === 'CLAUSE' ||
        c.metadata.chunkType === 'SECTION'
          ? 0.15
          : c.metadata.chunkType === 'TABLE'
          ? 0.08
          : 0;
      // Similitud embedding si está disponible
      let simBonus = 0;
      if (c.embedding && c.embedding.length > 0) {
        // Recalcular similitud del query contra embedding del chunk
        const qEmbedding = await this.embedQuery(query);
        simBonus = Math.max(0, cosineSim(qEmbedding, c.embedding)) * 0.4;
      }
      const score = (0.5 * coverage + 0.3 * density + 0.2 * lenPenalty + typeBonus + simBonus);
      scored.push({ chunk: c, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s, i) => ({
      ...s.chunk,
      score: s.score,
      rerankScore: s.score,
      rank: i + 1,
    }));
  }

  private async embedQuery(query: string): Promise<number[]> {
    const { getDefaultEmbedder } = await import('./embeddings');
    return getDefaultEmbedder().embed(query);
  }
}

let _reranker: HybridReranker | null = null;
export function getReranker(): Reranker {
  if (!_reranker) _reranker = new HybridReranker();
  return _reranker;
}

// MMR (Maximal Marginal Relevance) para diversidad
export function mmrSelect(
  candidates: RetrievedChunk[],
  queryVec: number[],
  topK: number,
  lambda = 0.7,
): RetrievedChunk[] {
  if (candidates.length === 0) return [];
  const selected: RetrievedChunk[] = [];
  const remaining = [...candidates];
  // Score base = rerankScore si existe, si no vectorScore
  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const relevance = c.rerankScore ?? c.vectorScore ?? c.score ?? 0;
      // Diversidad: máxima similitud a los ya seleccionados
      let maxSim = 0;
      for (const s of selected) {
        if (s.embedding && c.embedding) {
          const sim = cosineSim(s.embedding, c.embedding);
          if (sim > maxSim) maxSim = sim;
        }
      }
      void queryVec;
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    selected.push({ ...chosen, rank: selected.length + 1 });
  }
  return selected;
}

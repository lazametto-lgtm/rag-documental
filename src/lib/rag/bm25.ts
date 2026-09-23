// Implementación BM25 (Okapi) en memoria para búsqueda léxica.
// Combinable con similitud vectorial (hybrid retrieval).
// Persistencia ligera: los chunks viven en SQLite (Prisma); el índice BM25
// se construye on-demand al arrancar la app o tras una ingesta.

import type { Chunk, RetrievedChunk, RetrievalFilters } from './types';
import { tokenize } from './utils';

export class BM25Index {
  private docs: { id: string; chunk: Chunk; tokens: string[]; length: number }[] = [];
  private df = new Map<string, number>(); // document frequency por término
  private avgDl = 0;
  private k1 = 1.5;
  private b = 0.75;
  readonly name = 'bm25-okapi';

  get size(): number {
    return this.docs.length;
  }

  addChunks(chunks: Chunk[]): void {
    for (const c of chunks) {
      const tokens = tokenize(c.content);
      this.docs.push({ id: c.id, chunk: c, tokens, length: tokens.length });
      const unique = new Set(tokens);
      for (const t of unique) {
        this.df.set(t, (this.df.get(t) ?? 0) + 1);
      }
    }
    this.recomputeAvgDl();
  }

  removeDocument(documentId: string): void {
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => d.chunk.metadata.documentId !== documentId);
    // Rebuild df
    this.df.clear();
    for (const d of this.docs) {
      const uniq = new Set(d.tokens);
      for (const t of uniq) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.recomputeAvgDl();
    void before;
  }

  clear(): void {
    this.docs = [];
    this.df.clear();
    this.avgDl = 0;
  }

  private recomputeAvgDl(): void {
    if (this.docs.length === 0) {
      this.avgDl = 0;
      return;
    }
    let sum = 0;
    for (const d of this.docs) sum += d.length;
    this.avgDl = sum / this.docs.length;
  }

  search(query: string, topK: number, filters?: RetrievalFilters): RetrievedChunk[] {
    const qTokens = tokenize(query);
    if (qTokens.length === 0 || this.docs.length === 0) return [];
    const N = this.docs.length;
    const scores: { id: string; score: number; chunk: Chunk }[] = [];

    for (const d of this.docs) {
      if (!matchesFilters(d.chunk, filters)) continue;
      // Term frequencies en el documento
      const tf = new Map<string, number>();
      for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

      let score = 0;
      for (const qt of qTokens) {
        const f = tf.get(qt);
        if (!f) continue;
        const n = this.df.get(qt) ?? 0;
        // IDF suavizado
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        const denom = f + this.k1 * (1 - this.b + this.b * (d.length / (this.avgDl || 1)));
        score += (idf * (f * (this.k1 + 1))) / denom;
      }
      if (score > 0) scores.push({ id: d.id, score, chunk: d.chunk });
    }

    scores.sort((a, b) => b.score - a.score);
    const maxScore = scores.length > 0 ? scores[0].score : 1;
    const out: RetrievedChunk[] = [];
    const top = scores.slice(0, topK);
    for (let i = 0; i < top.length; i++) {
      const s = top[i];
      out.push({
        ...s.chunk,
        score: 0, // se combina con vector en el retriever
        bm25Score: s.score / (maxScore || 1), // normalizado 0..1
        rank: i + 1,
      });
    }
    return out;
  }
}

function matchesFilters(chunk: Chunk, filters?: RetrievalFilters): boolean {
  if (!filters) return true;
  const m = chunk.metadata;
  if (filters.docType && m.docType !== filters.docType) return false;
  if (filters.jurisdiction && m.jurisdiction !== filters.jurisdiction) return false;
  if (filters.entity && m.entity !== filters.entity) return false;
  if (filters.period && m.period !== filters.period) return false;
  if (filters.version && m.version !== filters.version) return false;
  if (filters.status && m.status !== filters.status) return false;
  if (filters.documentIds && !filters.documentIds.includes(m.documentId)) return false;
  if (filters.collectionId && m.collectionId !== filters.collectionId) return false;
  return true;
}

// Singleton
let _bm25: BM25Index | null = null;
export function getBM25Index(): BM25Index {
  if (!_bm25) _bm25 = new BM25Index();
  return _bm25;
}

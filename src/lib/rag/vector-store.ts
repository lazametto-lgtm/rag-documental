// Vector store en memoria con filtros por metadatos.
// Interfaz VectorStore: permite sustituir por ChromaDB / Pinecone real.
// Carga perezosa desde Prisma (loadAll).

import type { Chunk, RetrievedChunk, VectorStore, RetrievalFilters } from './types';
import { cosineSim } from './utils';
import { getBM25Index } from './bm25';
import { db } from '@/lib/db';

interface Stored {
  chunk: Chunk;
  vec: number[];
}

class InMemoryVectorStore implements VectorStore {
  private map = new Map<string, Stored>();
  readonly name = 'in-memory';

  get size(): number {
    return this.map.size;
  }

  async upsert(chunks: Chunk[]): Promise<void> {
    for (const c of chunks) {
      if (!c.embedding || c.embedding.length === 0) continue;
      this.map.set(c.id, { chunk: c, vec: c.embedding });
    }
  }

  async remove(documentId: string): Promise<void> {
    const toDelete: string[] = [];
    for (const [id, stored] of this.map) {
      if (stored.chunk.metadata.documentId === documentId) toDelete.push(id);
    }
    for (const id of toDelete) this.map.delete(id);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  async search(query: number[], topK: number, filters?: RetrievalFilters): Promise<RetrievedChunk[]> {
    if (this.map.size === 0) return [];
    const results: { id: string; chunk: Chunk; sim: number }[] = [];
    for (const [id, stored] of this.map) {
      if (!matchesFilters(stored.chunk, filters)) continue;
      const sim = cosineSim(query, stored.vec);
      results.push({ id, chunk: stored.chunk, sim });
    }
    results.sort((a, b) => b.sim - a.sim);
    const top = results.slice(0, topK);
    const out: RetrievedChunk[] = [];
    for (let i = 0; i < top.length; i++) {
      const r = top[i];
      out.push({
        ...r.chunk,
        score: 0,
        vectorScore: Math.max(0, r.sim), // cosine puede ser negativa para sparse hash, clamp
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

let _store: InMemoryVectorStore | null = null;
export function getVectorStore(): VectorStore {
  if (!_store) _store = new InMemoryVectorStore();
  return _store;
}

// Carga todos los chunks persistidos en SQLite al store en memoria y al BM25.
export async function loadStoreFromDb(): Promise<number> {
  const store = getVectorStore() as InMemoryVectorStore;
  const rows = await db.chunk.findMany({
    select: {
      id: true,
      content: true,
      chunkType: true,
      page: true,
      section: true,
      clauseRef: true,
      order: true,
      metadata: true,
      embedding: true,
      norm: true,
      tokenCount: true,
      documentId: true,
      document: {
        select: {
          id: true,
          title: true,
          docType: true,
          jurisdiction: true,
          entity: true,
          period: true,
          version: true,
          validityDate: true,
          status: true,
          collectionId: true,
        },
      },
    },
  });

  const bm25 = getBM25Index();
  bm25.clear();
  const chunks: Chunk[] = [];
  for (const r of rows) {
    let embedding: number[] = [];
    try {
      embedding = JSON.parse(r.embedding);
    } catch {
      embedding = [];
    }
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(r.metadata);
    } catch {
      meta = {};
    }
    const d = r.document;
    const chunk: Chunk = {
      id: r.id,
      content: r.content,
      embedding,
      norm: r.norm,
      tokenCount: r.tokenCount,
      metadata: {
        documentId: d.id,
        documentTitle: d.title,
        docType: (d.docType as Chunk['metadata']['docType']) ?? 'OTHER',
        page: r.page,
        section: r.section ?? undefined,
        clauseRef: r.clauseRef ?? undefined,
        chunkType: (r.chunkType as Chunk['metadata']['chunkType']) ?? 'TEXT',
        order: r.order,
        jurisdiction: d.jurisdiction ?? undefined,
        entity: d.entity ?? undefined,
        period: d.period ?? undefined,
        version: d.version ?? undefined,
        status: (d.status as Chunk['metadata']['status']) ?? 'VIGENT',
        collectionId: d.collectionId ?? undefined,
        hash: (meta.hash as string) ?? undefined,
      },
      tableData: (meta.tableData as Chunk['tableData']) ?? undefined,
    };
    chunks.push(chunk);
  }
  // upsert al store
  await store.upsert(chunks);
  // alimentar BM25
  bm25.addChunks(chunks);
  return chunks.length;
}

import { NextResponse } from 'next/server';
import { ensureInitialized } from '@/lib/rag/init';
import { getStoreSize, getBM25Size } from '@/lib/rag/init';
import { db } from '@/lib/db';

// GET /api/rag/stats — estadísticas del sistema
export async function GET() {
  await ensureInitialized();
  const [documents, chunks, queryLogs, evalRuns] = await Promise.all([
    db.document.count(),
    db.chunk.count(),
    db.queryLog.count(),
    db.evaluationRun.count(),
  ]);

  const byType = await db.document.groupBy({
    by: ['docType'],
    _count: { _all: true },
  });

  const byStatus = await db.document.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const collections = await db.collection.count();

  // Documentos activos (no soft-deleted)
  const activeDocs = await db.document.count({
    where: { deletedAt: null },
  });

  return NextResponse.json({
    documents,
    activeDocuments: activeDocs,
    chunks,
    queryLogs,
    evaluationRuns: evalRuns,
    collections,
    inMemoryVectors: getStoreSize(),
    inMemoryBM25: getBM25Size(),
    byType: byType.map((b) => ({ docType: b.docType, count: b._count._all })),
    byStatus: byStatus.map((b) => ({ status: b.status, count: b._count._all })),
    storage: {
      vectorBackend: 'in-memory (interface compatible con ChromaDB/Pinecone)',
      bm25Backend: 'in-memory okapi-bm25',
      embedder: 'tfidf-hash-d1024 (interface compatible con BGE-M3 / multilingual-e5)',
      llmProvider: 'zai-llm (interface compatible con Ollama local)',
      reranker: 'hybrid-coocurrence (interface compatible con Cohere Rerank / BGE reranker)',
    },
  });
}

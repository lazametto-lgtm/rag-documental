import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/analytics — analíticas de chunks y documentos
export async function GET() {
  await ensureInitialized();

  // Distribución de tipos de chunk global
  const chunkTypeDist = await db.chunk.groupBy({
    by: ['chunkType'],
    _count: { _all: true },
    _sum: { tokenCount: true },
  });

  // Distribución por documento (top 10 con más chunks)
  const docs = await db.document.findMany({
    where: { deletedAt: null },
    orderBy: { chunkCount: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      docType: true,
      chunkCount: true,
      pageCount: true,
    },
  });

  // Distribución de tipos por documento
  const docsWithChunks = await db.document.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      docType: true,
      chunks: { select: { chunkType: true, tokenCount: true } },
    },
  });

  const perDoc = docsWithChunks.map((d) => {
    const dist: Record<string, number> = {};
    let totalTokens = 0;
    for (const c of d.chunks) {
      dist[c.chunkType] = (dist[c.chunkType] ?? 0) + 1;
      totalTokens += c.tokenCount;
    }
    return {
      id: d.id,
      title: d.title,
      docType: d.docType,
      totalChunks: d.chunks.length,
      totalTokens,
      dist,
    };
  });

  // Estadísticas de tokens
  const tokenStats = await db.chunk.aggregate({
    _sum: { tokenCount: true },
    _avg: { tokenCount: true },
    _min: { tokenCount: true },
    _max: { tokenCount: true },
    _count: true,
  });

  // Distribución por página (cuántos chunks en cada página)
  const pageDist = await db.chunk.groupBy({
    by: ['page'],
    _count: { _all: true },
    orderBy: { page: 'asc' },
    take: 50,
  });

  return NextResponse.json({
    chunkTypeDistribution: chunkTypeDist.map((c) => ({
      type: c.chunkType,
      count: c._count._all,
      tokens: c._sum.tokenCount ?? 0,
    })),
    perDocument: perDoc,
    tokenStats: {
      total: tokenStats._sum.tokenCount ?? 0,
      avg: Math.round(tokenStats._avg.tokenCount ?? 0),
      min: tokenStats._min.tokenCount ?? 0,
      max: tokenStats._max.tokenCount ?? 0,
      chunks: tokenStats._count ?? 0,
    },
    pageDistribution: pageDist.map((p) => ({ page: p.page, count: p._count._all })),
    topDocuments: docs,
  });
}

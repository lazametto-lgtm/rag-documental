import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/dashboard — agregado para dashboard ejecutivo
export async function GET() {
  await ensureInitialized();

  // Estadísticas básicas en paralelo
  const [
    totalDocs,
    totalChunks,
    totalQueries,
    totalEvals,
    totalCollections,
    activeDocs,
    favDocs,
    recentDocs,
    recentQueries,
    recentEvals,
    byType,
    byStatus,
  ] = await Promise.all([
    db.document.count(),
    db.chunk.count(),
    db.queryLog.count(),
    db.evaluationRun.count(),
    db.collection.count(),
    db.document.count({ where: { deletedAt: null } }),
    db.document.count({ where: { favorite: true, deletedAt: null } }),
    db.document.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, docType: true, chunkCount: true, createdAt: true, favorite: true },
    }),
    db.queryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        question: true,
        latencyMs: true,
        llmProvider: true,
        createdAt: true,
        response: true,
        document: { select: { id: true, title: true, docType: true } },
      },
    }),
    db.evaluationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, questionCount: true, metrics: true, createdAt: true },
    }),
    db.document.groupBy({ by: ['docType'], _count: { _all: true } }),
    db.document.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  // Calcular avg confidence y avg latency de las queries recientes
  let avgConfidence = 0;
  let avgLatency = 0;
  const parsedQueries = recentQueries.map((q) => {
    let resp: Record<string, unknown> = {};
    try {
      resp = JSON.parse(q.response);
    } catch {
      resp = {};
    }
    const confidence = (resp.confidenceScore as number) ?? 0;
    avgConfidence += confidence;
    avgLatency += q.latencyMs;
    return {
      id: q.id,
      question: q.question,
      latencyMs: q.latencyMs,
      llmProvider: q.llmProvider,
      confidence: (resp.confidence as string) ?? 'medium',
      confidenceScore: confidence,
      noEvidence: (resp.noEvidence as boolean) ?? false,
      createdAt: q.createdAt.toISOString(),
      document: q.document
        ? { id: q.document.id, title: q.document.title, docType: q.document.docType }
        : null,
    };
  });
  if (parsedQueries.length > 0) {
    avgConfidence = Math.round((avgConfidence / parsedQueries.length) * 100) / 100;
    avgLatency = Math.round(avgLatency / parsedQueries.length);
  }

  // Parsear eval runs
  const parsedEvals = recentEvals.map((r) => {
    let m: Record<string, unknown> = {};
    try {
      m = JSON.parse(r.metrics);
    } catch {
      m = {};
    }
    return {
      id: r.id,
      questionCount: r.questionCount,
      createdAt: r.createdAt.toISOString(),
      faithfulness: (m.faithfulness as number) ?? 0,
      answerRelevancy: (m.answerRelevancy as number) ?? 0,
      contextPrecision: (m.contextPrecision as number) ?? 0,
      contextRecall: (m.contextRecall as number) ?? 0,
      citationAccuracy: (m.citationAccuracy as number) ?? 0,
    };
  });

  // Última evaluación (para mostrar en el dashboard)
  const lastEval = parsedEvals[0] ?? null;

  return NextResponse.json({
    stats: {
      totalDocs,
      activeDocs,
      totalChunks,
      totalQueries,
      totalEvals,
      totalCollections,
      favDocs,
      avgConfidence,
      avgLatency,
    },
    recentDocs: recentDocs.map((d) => ({
      id: d.id,
      title: d.title,
      docType: d.docType,
      chunkCount: d.chunkCount,
      createdAt: d.createdAt.toISOString(),
      favorite: d.favorite,
    })),
    recentQueries: parsedQueries,
    recentEvals: parsedEvals,
    lastEval,
    byType: byType.map((b) => ({ docType: b.docType, count: b._count._all })),
    byStatus: byStatus.map((b) => ({ status: b.status, count: b._count._all })),
  });
}

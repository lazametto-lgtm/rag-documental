import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/eval-compare?ids=runId1,runId2 — compara 2 corridas de evaluación
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2);

  if (ids.length < 2) {
    return NextResponse.json(
      { error: 'Se requieren 2 IDs de corridas de evaluación (parámetro ids=)' },
      { status: 400 },
    );
  }

  const runs = await db.evaluationRun.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: 'asc' },
  });

  if (runs.length < 2) {
    return NextResponse.json(
      { error: 'No se encontraron ambas corridas' },
      { status: 404 },
    );
  }

  // Parsear métricas de cada corrida
  const parsed = runs.map((r) => {
    let m: {
      faithfulness?: number;
      answerRelevancy?: number;
      contextPrecision?: number;
      contextRecall?: number;
      citationAccuracy?: number;
      perQuestion?: Array<{
        question: string;
        expected: string;
        answer: string;
        metrics: {
          faithfulness: number;
          answerRelevancy: number;
          contextPrecision: number;
          contextRecall: number;
          citationAccuracy: number;
        };
        noEvidence: boolean;
      }>;
    } = {};
    try {
      m = JSON.parse(r.metrics);
    } catch {
      m = {};
    }
    return {
      id: r.id,
      questionCount: r.questionCount,
      createdAt: r.createdAt.toISOString(),
      metrics: {
        faithfulness: m.faithfulness ?? 0,
        answerRelevancy: m.answerRelevancy ?? 0,
        contextPrecision: m.contextPrecision ?? 0,
        contextRecall: m.contextRecall ?? 0,
        citationAccuracy: m.citationAccuracy ?? 0,
      },
      perQuestion: m.perQuestion ?? [],
    };
  });

  const [runA, runB] = parsed;

  // Calcular deltas (B vs A, porcentaje de mejora/retroceso)
  const metrics = ['faithfulness', 'answerRelevancy', 'contextPrecision', 'contextRecall', 'citationAccuracy'] as const;
  const deltas = metrics.map((m) => {
    const a = runA.metrics[m];
    const b = runB.metrics[m];
    const absDelta = b - a;
    const pctDelta = a > 0 ? Math.round((absDelta / a) * 100) : 0;
    return {
      metric: m,
      a,
      b,
      absDelta,
      pctDelta,
      improved: absDelta > 0,
    };
  });

  // Resumen
  const avgA = metrics.reduce((s, m) => s + runA.metrics[m], 0) / metrics.length;
  const avgB = metrics.reduce((s, m) => s + runB.metrics[m], 0) / metrics.length;
  const avgDelta = avgB - avgA;

  return NextResponse.json({
    runA,
    runB,
    deltas,
    summary: {
      avgA: Math.round(avgA * 1000) / 1000,
      avgB: Math.round(avgB * 1000) / 1000,
      avgDelta: Math.round(avgDelta * 1000) / 1000,
      avgPctDelta: avgA > 0 ? Math.round((avgDelta / avgA) * 100) : 0,
      improved: avgDelta > 0,
    },
  });
}

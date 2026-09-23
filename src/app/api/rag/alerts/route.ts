import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/alerts — verifica métricas de la última evaluación contra thresholds
// Devuelve alertas para métricas que caen below threshold
export async function GET() {
  await ensureInitialized();

  // Thresholds (configurables, por defecto WCAG-like)
  const THRESHOLDS = {
    faithfulness: 0.80,
    answerRelevancy: 0.80,
    contextPrecision: 0.75,
    contextRecall: 0.65,
    citationAccuracy: 0.80,
  };

  const THRESHOLD_LABELS: Record<string, string> = {
    faithfulness: 'Faithfulness (anti-alucinación)',
    answerRelevancy: 'Answer Relevancy',
    contextPrecision: 'Context Precision',
    contextRecall: 'Context Recall',
    citationAccuracy: 'Citation Accuracy',
  };

  // Obtener última evaluación
  const lastRun = await db.evaluationRun.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!lastRun) {
    return NextResponse.json({
      hasLastRun: false,
      alerts: [],
      summary: { total: 0, critical: 0, warning: 0, ok: 0 },
    });
  }

  let metrics: Record<string, number> = {};
  try {
    const parsed = JSON.parse(lastRun.metrics);
    metrics = {
      faithfulness: parsed.faithfulness ?? 0,
      answerRelevancy: parsed.answerRelevancy ?? 0,
      contextPrecision: parsed.contextPrecision ?? 0,
      contextRecall: parsed.contextRecall ?? 0,
      citationAccuracy: parsed.citationAccuracy ?? 0,
    };
  } catch {
    metrics = {};
  }

  type Alert = {
    metric: string;
    label: string;
    value: number;
    threshold: number;
    severity: 'critical' | 'warning' | 'ok';
    message: string;
  };

  const alerts: Alert[] = [];
  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const value = metrics[key] ?? 0;
    let severity: 'critical' | 'warning' | 'ok';
    let message: string;

    if (value < threshold * 0.75) {
      severity = 'critical';
      message = `${THRESHOLD_LABELS[key]} está críticamente bajo (${Math.round(value * 100)}% < ${Math.round(threshold * 75)}%)`;
    } else if (value < threshold) {
      severity = 'warning';
      message = `${THRESHOLD_LABELS[key]} está por debajo del umbral (${Math.round(value * 100)}% < ${Math.round(threshold * 100)}%)`;
    } else {
      severity = 'ok';
      message = `${THRESHOLD_LABELS[key]} OK (${Math.round(value * 100)}% ≥ ${Math.round(threshold * 100)}%)`;
    }

    alerts.push({
      metric: key,
      label: THRESHOLD_LABELS[key],
      value,
      threshold,
      severity,
      message,
    });
  }

  const summary = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    ok: alerts.filter((a) => a.severity === 'ok').length,
  };

  return NextResponse.json({
    hasLastRun: true,
    runId: lastRun.id,
    runDate: lastRun.createdAt.toISOString(),
    questionCount: lastRun.questionCount,
    alerts,
    summary,
  });
}

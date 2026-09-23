import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/eval-export?runId=... — exporta una corrida de evaluación a CSV
// Sin runId: exporta la última corrida.
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');

  let run;
  if (runId) {
    run = await db.evaluationRun.findUnique({ where: { id: runId } });
  } else {
    run = await db.evaluationRun.findFirst({ orderBy: { createdAt: 'desc' } });
  }

  if (!run) {
    return NextResponse.json({ error: 'No hay corridas de evaluación' }, { status: 404 });
  }

  let metrics: {
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
      citations: unknown[];
      noEvidence: boolean;
    }>;
  } = {};
  try {
    metrics = JSON.parse(run.metrics);
  } catch {
    metrics = {};
  }

  const perQuestion = metrics.perQuestion ?? [];

  // Construir CSV
  const escape = (s: unknown): string => {
    const str = String(s ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [];
  // Encabezado de resumen
  rows.push('# Resumen de evaluación RAG');
  rows.push(`runId,${run.id}`);
  rows.push(`fecha,${run.createdAt.toISOString()}`);
  rows.push(`preguntas,${run.questionCount}`);
  rows.push(`faithfulness,${metrics.faithfulness ?? 0}`);
  rows.push(`answerRelevancy,${metrics.answerRelevancy ?? 0}`);
  rows.push(`contextPrecision,${metrics.contextPrecision ?? 0}`);
  rows.push(`contextRecall,${metrics.contextRecall ?? 0}`);
  rows.push(`citationAccuracy,${metrics.citationAccuracy ?? 0}`);
  rows.push('');
  rows.push('# Detalle por pregunta');
  rows.push(
    [
      'pregunta',
      'respuesta_esperada',
      'respuesta_generada',
      'faithfulness',
      'answerRelevancy',
      'contextPrecision',
      'contextRecall',
      'citationAccuracy',
      'num_citas',
      'no_evidence',
    ]
      .map(escape)
      .join(','),
  );

  for (const q of perQuestion) {
    rows.push(
      [
        q.question,
        q.expected,
        q.answer,
        q.metrics.faithfulness,
        q.metrics.answerRelevancy,
        q.metrics.contextPrecision,
        q.metrics.contextRecall,
        q.metrics.citationAccuracy,
        q.citations.length,
        q.noEvidence ? 'true' : 'false',
      ]
        .map(escape)
        .join(','),
    );
  }

  const csv = rows.join('\n');
  const stamp = run.createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="evaluacion-rag-${stamp}.csv"`,
    },
  });
}

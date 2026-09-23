import { NextResponse } from 'next/server';
import { runEvaluation, getEvaluationRuns } from '@/lib/rag/evaluator';
import { ensureInitialized } from '@/lib/rag/init';

// POST /api/rag/evaluate — ejecuta evaluación RAGAS-like
export async function POST() {
  try {
    await ensureInitialized();
    const result = await runEvaluation();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/rag/evaluate — últimas corridas de evaluación
export async function GET() {
  try {
    await ensureInitialized();
    const runs = await getEvaluationRuns();
    return NextResponse.json({ runs });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

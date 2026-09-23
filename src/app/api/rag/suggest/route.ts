import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/suggest?q=... — sugiere preguntas similares del historial + templates
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  // 1) Preguntas del historial (top 20 más recientes)
  const logs = await db.queryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { question: true, createdAt: true },
  });

  // Preguntas únicas con frecuencia
  const freq = new Map<string, number>();
  for (const l of logs) {
    const key = l.question.trim();
    if (key) freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const historyQuestions = Array.from(freq.entries())
    .map(([question, count]) => ({ question, count, source: 'history' as const }))
    .sort((a, b) => b.count - a.count);

  // 2) Templates de preguntas por tipo de documento
  const templates = [
    { question: '¿Cuál es el activo total al cierre del ejercicio?', source: 'template' as const, type: 'BALANCE' },
    { question: '¿Cuál es el patrimonio neto?', source: 'template' as const, type: 'BALANCE' },
    { question: '¿Cuál fue el resultado neto del ejercicio?', source: 'template' as const, type: 'BALANCE' },
    { question: '¿Cuál es el pasivo total?', source: 'template' as const, type: 'BALANCE' },
    { question: '¿Qué moneda y unidades usa el balance?', source: 'template' as const, type: 'BALANCE' },
    { question: '¿Cuál es el plazo de vigencia del contrato?', source: 'template' as const, type: 'CONTRACT' },
    { question: '¿Cuál es el precio y forma de pago?', source: 'template' as const, type: 'CONTRACT' },
    { question: '¿Qué penalidades aplican por incumplimiento?', source: 'template' as const, type: 'CONTRACT' },
    { question: '¿Qué SLA se garantiza?', source: 'template' as const, type: 'CONTRACT' },
    { question: '¿Cuál es la jurisdicción aplicable?', source: 'template' as const, type: 'CONTRACT' },
    { question: '¿Qué cláusulas de confidencialidad existen?', source: 'template' as const, type: 'CONTRACT' },
    { question: '¿Qué derechos tiene el titular de los datos?', source: 'template' as const, type: 'REGULATION' },
    { question: '¿Cuándo se requiere consentimiento para tratamiento de datos?', source: 'template' as const, type: 'REGULATION' },
    { question: '¿Qué sanciones apply por incumplimiento?', source: 'template' as const, type: 'REGULATION' },
    { question: '¿Cuál es el ámbito de aplicación de la norma?', source: 'template' as const, type: 'REGULATION' },
    { question: '¿Qué principios rigen el tratamiento?', source: 'template' as const, type: 'REGULATION' },
    { question: '¿Está vigente esta normativa o fue derogada?', source: 'template' as const, type: 'REGULATION' },
  ];

  // 3) Filtrar por similitud a la query actual (si hay q)
  let suggestions: Array<{ question: string; source: string; count?: number; type?: string; score: number }>;
  if (q) {
    const scoredHistory = historyQuestions
      .map((h) => ({ ...h, score: similarity(q, h.question.toLowerCase()) }))
      .filter((s) => s.score > 0.1)
      .sort((a, b) => b.score - a.score);

    const scoredTemplates = templates
      .map((t) => ({ ...t, score: similarity(q, t.question.toLowerCase()) }))
      .filter((s) => s.score > 0.1)
      .sort((a, b) => b.score - a.score);

    suggestions = [
      ...scoredHistory.slice(0, 5),
      ...scoredTemplates.slice(0, 5),
    ].slice(0, 8);
  } else {
    // Sin query: mezclar templates y historial recientes
    suggestions = [
      ...historyQuestions.slice(0, 4).map((h) => ({ ...h, score: 0.5 })),
      ...templates.slice(0, 4).map((t) => ({ ...t, score: 0.3 })),
    ].slice(0, 8);
  }

  return NextResponse.json({ suggestions, query: q });
}

// Similitud por co-ocurrencia de tokens (Jaccard-like)
function similarity(a: string, b: string): number {
  const stop = new Set(['de','la','el','los','las','y','o','a','en','que','con','por','para','del','al','se','es','cu','cual','the','of','and','to']);
  const ta = new Set((a.match(/[a-záéíóúñ0-9]+/g) ?? []).filter((w) => w.length > 2 && !stop.has(w)));
  const tb = new Set((b.match(/[a-záéíóúñ0-9]+/g) ?? []).filter((w) => w.length > 2 && !stop.has(w)));
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.max(1, Math.min(ta.size, tb.size));
}

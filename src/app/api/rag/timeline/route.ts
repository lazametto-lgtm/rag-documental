import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/timeline?granularity=day|hour&days=30 — timeline de actividad para chart
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const granularity = (url.searchParams.get('granularity') ?? 'day') as 'day' | 'hour';
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90);

  // Traer consultas recientes
  const since = new Date();
  since.setDate(since.getDate() - days);

  const queries = await db.queryLog.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, latencyMs: true },
    orderBy: { createdAt: 'asc' },
    take: 5000,
  });

  // Agrupar por día o por hora
  const buckets = new Map<string, { count: number; totalLatency: number; date: Date }>();

  for (const q of queries) {
    const d = q.createdAt;
    let key: string;
    if (granularity === 'hour') {
      key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
    } else {
      key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    const entry = buckets.get(key) ?? { count: 0, totalLatency: 0, date: d };
    entry.count++;
    entry.totalLatency += q.latencyMs;
    buckets.set(key, entry);
  }

  // Convertir a array ordenado por fecha
  const data = Array.from(buckets.entries())
    .map(([key, v]) => ({
      key,
      date: v.date.toISOString(),
      count: v.count,
      avgLatency: v.count > 0 ? Math.round(v.totalLatency / v.count) : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Estadísticas resumidas
  const totalQueries = data.reduce((s, d) => s + d.count, 0);
  const peakBucket = data.length > 0 ? data.reduce((max, d) => (d.count > max.count ? d : max), data[0]) : null;
  const avgLatencyGlobal = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.avgLatency * d.count, 0) / totalQueries)
    : 0;

  return NextResponse.json({
    granularity,
    days,
    data,
    totalQueries,
    peakBucket: peakBucket
      ? { key: peakBucket.key, count: peakBucket.count, date: peakBucket.date }
      : null,
    avgLatencyGlobal,
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

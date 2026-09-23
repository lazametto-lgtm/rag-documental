import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

interface MetricByType {
  docType: string;
  count: number;
  totalChunks: number;
  totalTokens: number;
  avgChunks: number;
}

// GET /api/rag/metrics-by-type — estadísticas de documentos y chunks por tipo
// Para alimentar el gráfico radar (5 dimensiones: #docs, #chunks, #tokens, avg chunks, #páginas)
export async function GET() {
  await ensureInitialized();

  const docs = await db.document.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      docType: true,
      chunkCount: true,
      pageCount: true,
      chunks: { select: { tokenCount: true } },
      favorite: true,
    },
  });

  // Agrupar por tipo
  const byType = new Map<string, {
    docType: string;
    count: number;
    totalChunks: number;
    totalTokens: number;
    totalPages: number;
    favorites: number;
  }>();

  for (const d of docs) {
    const t = d.docType;
    const entry = byType.get(t) ?? {
      docType: t,
      count: 0,
      totalChunks: 0,
      totalTokens: 0,
      totalPages: 0,
      favorites: 0,
    };
    entry.count++;
    entry.totalChunks += d.chunkCount;
    entry.totalPages += d.pageCount;
    if (d.favorite) entry.favorites++;
    for (const c of d.chunks) entry.totalTokens += c.tokenCount;
    byType.set(t, entry);
  }

  const types = Array.from(byType.values()).map((e) => ({
    ...e,
    avgChunks: e.count > 0 ? Math.round((e.totalChunks / e.count) * 10) / 10 : 0,
    avgTokens: e.totalChunks > 0 ? Math.round(e.totalTokens / e.totalChunks) : 0,
  }));

  // Normalizar para radar (0..100 por dimensión, relativo al máximo)
  const maxCount = Math.max(...types.map((t) => t.count), 1);
  const maxChunks = Math.max(...types.map((t) => t.totalChunks), 1);
  const maxTokens = Math.max(...types.map((t) => t.totalTokens), 1);
  const maxPages = Math.max(...types.map((t) => t.totalPages), 1);
  const maxAvgChunks = Math.max(...types.map((t) => t.avgChunks), 1);

  const radar = types.map((t) => ({
    docType: t.docType,
    label: labelForType(t.docType),
    dimensions: {
      documentos: Math.round((t.count / maxCount) * 100),
      chunks: Math.round((t.totalChunks / maxChunks) * 100),
      tokens: Math.round((t.totalTokens / maxTokens) * 100),
      páginas: Math.round((t.totalPages / maxPages) * 100),
      densidad: Math.round((t.avgChunks / maxAvgChunks) * 100),
    },
    raw: {
      documentos: t.count,
      chunks: t.totalChunks,
      tokens: t.totalTokens,
      páginas: t.totalPages,
      avgChunks: t.avgChunks,
      avgTokens: t.avgTokens,
      favorites: t.favorites,
    },
  }));

  return NextResponse.json({
    types: radar,
    totals: {
      documents: docs.length,
      chunks: radar.reduce((s, t) => s + t.raw.chunks, 0),
      tokens: radar.reduce((s, t) => s + t.raw.tokens, 0),
      pages: radar.reduce((s, t) => s + t.raw['páginas'], 0),
      favorites: radar.reduce((s, t) => s + t.raw.favorites, 0),
    },
  });
}

function labelForType(t: string): string {
  switch (t) {
    case 'BALANCE': return 'Balance';
    case 'CONTRACT': return 'Contrato';
    case 'REGULATION': return 'Normativa';
    default: return 'Otro';
  }
}

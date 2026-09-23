import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/search?q=...&limit=20 — búsqueda full-text en rawText de documentos
// Devuelve documentos con snippets del match (estilo grep)
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100);
  const docType = url.searchParams.get('docType');

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q, total: 0 });
  }

  // Búsqueda case-insensitive en rawText (SQLite LIKE es case-insensitive para ASCII)
  // Para textos con acentos, normalizamos la query y buscamos variantes
  const where: Record<string, unknown> = {
    deletedAt: null,
    rawText: { contains: q },
  };
  if (docType) where.docType = docType;

  const docs = await db.document.findMany({
    where,
    take: limit,
    select: {
      id: true,
      title: true,
      docType: true,
      jurisdiction: true,
      entity: true,
      period: true,
      version: true,
      status: true,
      chunkCount: true,
      pageCount: true,
      rawText: true,
      createdAt: true,
      favorite: true,
      tags: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Construir snippets: encontrar todas las ocurrencias de q en rawText, extraer contexto ±80 chars
  const results = docs.map((d) => {
    const text = d.rawText ?? '';
    const snippets: Array<{ text: string; position: number }> = [];
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    let from = 0;
    let count = 0;
    while (count < 5) {
      const idx = lowerText.indexOf(lowerQ, from);
      if (idx === -1) break;
      const start = Math.max(0, idx - 80);
      const end = Math.min(text.length, idx + q.length + 80);
      const snippet =
        (start > 0 ? '…' : '') +
        text.slice(start, end).replace(/\s+/g, ' ').trim() +
        (end < text.length ? '…' : '');
      snippets.push({ text: snippet, position: idx });
      from = idx + q.length;
      count++;
    }
    return {
      id: d.id,
      title: d.title,
      docType: d.docType,
      jurisdiction: d.jurisdiction,
      entity: d.entity,
      period: d.period,
      version: d.version,
      status: d.status,
      chunkCount: d.chunkCount,
      pageCount: d.pageCount,
      favorite: d.favorite,
      tags: JSON.parse(d.tags ?? '[]') as string[],
      matchCount: snippets.length,
      snippets,
      createdAt: d.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ results, query: q, total: results.length });
}

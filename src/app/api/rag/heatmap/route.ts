import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/heatmap — densidad de chunks por documento × página
export async function GET() {
  await ensureInitialized();

  const docs = await db.document.findMany({
    where: { deletedAt: null },
    orderBy: { title: 'asc' },
    select: {
      id: true,
      title: true,
      docType: true,
      pageCount: true,
      chunks: {
        select: { page: true, tokenCount: true, chunkType: true },
      },
    },
  });

  // Para cada documento, agrupar chunks por página
  const rows = docs.map((d) => {
    const byPage = new Map<number, { count: number; tokens: number; types: Record<string, number> }>();
    let maxPage = 0;
    for (const c of d.chunks) {
      const p = c.page;
      maxPage = Math.max(maxPage, p);
      const entry = byPage.get(p) ?? { count: 0, tokens: 0, types: {} };
      entry.count++;
      entry.tokens += c.tokenCount;
      entry.types[c.chunkType] = (entry.types[c.chunkType] ?? 0) + 1;
      byPage.set(p, entry);
    }
    const pages: Array<{ page: number; count: number; tokens: number; types: Record<string, number> }> = [];
    for (let p = 1; p <= Math.max(maxPage, d.pageCount); p++) {
      const e = byPage.get(p);
      pages.push({
        page: p,
        count: e?.count ?? 0,
        tokens: e?.tokens ?? 0,
        types: e?.types ?? {},
      });
    }
    return {
      id: d.id,
      title: d.title,
      docType: d.docType,
      pageCount: Math.max(maxPage, d.pageCount),
      totalChunks: d.chunks.length,
      pages,
    };
  });

  // Máximo de chunks por página (para normalizar el heatmap)
  let maxPerPage = 0;
  for (const r of rows) {
    for (const p of r.pages) {
      if (p.count > maxPerPage) maxPerPage = p.count;
    }
  }

  return NextResponse.json({
    documents: rows,
    maxPerPage,
    totalDocuments: rows.length,
    totalPages: rows.reduce((s, r) => s + r.pageCount, 0),
  });
}

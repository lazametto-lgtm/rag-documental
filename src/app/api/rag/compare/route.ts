import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/compare?ids=chunkId1,chunkId2[,...] — devuelve hasta 4 chunks completos para comparar
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids') ?? '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);

  if (ids.length < 2) {
    return NextResponse.json(
      { error: 'Se requieren al menos 2 IDs de chunk para comparar (parámetro ids=)' },
      { status: 400 },
    );
  }

  const chunks = await db.chunk.findMany({
    where: { id: { in: ids } },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          docType: true,
          jurisdiction: true,
          entity: true,
          period: true,
          version: true,
          validityDate: true,
          status: true,
        },
      },
    },
  });

  // Preservar el orden de los IDs solicitados
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return NextResponse.json({
    chunks: ordered.map((c) => {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(c!.metadata);
      } catch {
        meta = {};
      }
      return {
        id: c!.id,
        content: c!.content,
        chunkType: c!.chunkType,
        page: c!.page,
        section: c!.section,
        clauseRef: c!.clauseRef,
        order: c!.order,
        tokenCount: c!.tokenCount,
        tableData: (meta.tableData as { headers: string[]; rows: string[][] }) ?? null,
        document: {
          id: c!.document.id,
          title: c!.document.title,
          docType: c!.document.docType,
          jurisdiction: c!.document.jurisdiction,
          entity: c!.document.entity,
          period: c!.document.period,
          version: c!.document.version,
          validityDate: c!.document.validityDate?.toISOString() ?? null,
          status: c!.document.status,
        },
      };
    }),
  });
}

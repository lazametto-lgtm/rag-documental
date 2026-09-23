import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/chunks/[id] — detalle de un chunk individual (contenido completo)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureInitialized();
  const { id } = await params;
  const chunk = await db.chunk.findUnique({
    where: { id },
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
          collectionId: true,
        },
      },
    },
  });
  if (!chunk) {
    return NextResponse.json({ error: 'Chunk no encontrado' }, { status: 404 });
  }
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(chunk.metadata);
  } catch {
    meta = {};
  }
  return NextResponse.json({
    chunk: {
      id: chunk.id,
      content: chunk.content,
      chunkType: chunk.chunkType,
      page: chunk.page,
      section: chunk.section,
      clauseRef: chunk.clauseRef,
      order: chunk.order,
      tokenCount: chunk.tokenCount,
      tableData: (meta.tableData as { headers: string[]; rows: string[][] }) ?? null,
      document: {
        id: chunk.document.id,
        title: chunk.document.title,
        docType: chunk.document.docType,
        jurisdiction: chunk.document.jurisdiction,
        entity: chunk.document.entity,
        period: chunk.document.period,
        version: chunk.document.version,
        validityDate: chunk.document.validityDate?.toISOString() ?? null,
        status: chunk.document.status,
        collectionId: chunk.document.collectionId,
      },
    },
  });
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';
import { deleteDocument, softDeleteDocument } from '@/lib/rag/ingester';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureInitialized();
  const { id } = await params;
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      collection: true,
      chunks: { orderBy: { order: 'asc' }, take: 200 },
    },
  });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }
  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      docType: doc.docType,
      jurisdiction: doc.jurisdiction,
      entity: doc.entity,
      period: doc.period,
      version: doc.version,
      validityDate: doc.validityDate?.toISOString() ?? null,
      status: doc.status,
      sourcePath: doc.sourcePath,
      contentHash: doc.contentHash,
      chunkCount: doc.chunkCount,
      pageCount: doc.pageCount,
      collectionId: doc.collectionId,
      collectionName: doc.collection?.name,
      favorite: doc.favorite,
      tags: JSON.parse(doc.tags ?? '[]') as string[],
      rawText: doc.rawText,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      deletedAt: doc.deletedAt?.toISOString() ?? null,
      chunks: doc.chunks.map((c) => ({
        id: c.id,
        content: c.content,
        chunkType: c.chunkType,
        page: c.page,
        section: c.section,
        clauseRef: c.clauseRef,
        order: c.order,
        tokenCount: c.tokenCount,
      })),
    },
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureInitialized();
  const { id } = await params;
  const url = new URL(req.url);
  const soft = url.searchParams.get('soft') !== 'false'; // default soft delete

  const ok = soft ? await softDeleteDocument(id) : await deleteDocument(id);
  if (!ok) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }
  return NextResponse.json({ success: true, softDelete: soft });
}

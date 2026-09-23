import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/documents — lista documentos con metadatos y conteo de chunks
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const docType = url.searchParams.get('docType');
  const jurisdiction = url.searchParams.get('jurisdiction');
  const entity = url.searchParams.get('entity');
  const status = url.searchParams.get('status');
  const collectionId = url.searchParams.get('collectionId');
  const q = url.searchParams.get('q');
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const limit = parseInt(url.searchParams.get('limit') ?? '200');

  const where: Record<string, unknown> = {};
  if (!includeDeleted) where.deletedAt = null;
  if (docType) where.docType = docType;
  if (jurisdiction) where.jurisdiction = jurisdiction;
  if (entity) where.entity = entity;
  if (status) where.status = status;
  if (collectionId) where.collectionId = collectionId;
  if (q) {
    where.title = { contains: q };
  }
  // Filtro de favoritos
  if (url.searchParams.get('favorite') === 'true') where.favorite = true;
  // Filtro de tag
  const tag = url.searchParams.get('tag');
  if (tag) {
    // SQLite no tiene JSON query; filtramos en memoria abajo
  }

  const docs = await db.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { collection: true },
  });

  // Filtro por tag en memoria (SQLite sin JSON query)
  const filteredDocs = tag
    ? docs.filter((d) => {
        try {
          const tags = JSON.parse(d.tags ?? '[]') as string[];
          return tags.includes(tag);
        } catch {
          return false;
        }
      })
    : docs;

  return NextResponse.json({
    documents: filteredDocs.map((d) => ({
      id: d.id,
      title: d.title,
      docType: d.docType,
      jurisdiction: d.jurisdiction,
      entity: d.entity,
      period: d.period,
      version: d.version,
      validityDate: d.validityDate?.toISOString() ?? null,
      status: d.status,
      sourcePath: d.sourcePath,
      contentHash: d.contentHash,
      chunkCount: d.chunkCount,
      pageCount: d.pageCount,
      collectionId: d.collectionId,
      collectionName: d.collection?.name,
      favorite: d.favorite,
      tags: JSON.parse(d.tags ?? '[]') as string[],
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      deletedAt: d.deletedAt?.toISOString() ?? null,
    })),
  });
}

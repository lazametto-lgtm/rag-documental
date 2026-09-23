import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/collections — lista colecciones con conteo de documentos
export async function GET() {
  await ensureInitialized();
  const cols = await db.collection.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { documents: { where: { deletedAt: null } } } } },
  });
  return NextResponse.json({
    collections: cols.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      documentCount: c._count.documents,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

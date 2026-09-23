import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// PATCH /api/rag/documents/[id]/favorite — toggle favorite (body: {favorite?: boolean})
// Si no se pasa body, hace toggle del valor actual
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureInitialized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { favorite?: boolean };
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }
  const newValue = body.favorite !== undefined ? body.favorite : !doc.favorite;
  await db.document.update({ where: { id }, data: { favorite: newValue } });
  return NextResponse.json({ success: true, favorite: newValue });
}

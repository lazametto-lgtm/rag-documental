import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// PATCH /api/rag/documents/[id]/tags — actualizar tags (body: {tags: string[]})
// body: { action: 'set' | 'add' | 'remove', tag: string } o { tags: string[] }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureInitialized();
  const { id } = await params;
  const body = (await req.json()) as {
    tags?: string[];
    action?: 'set' | 'add' | 'remove';
    tag?: string;
  };
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }
  let current: string[] = [];
  try {
    current = JSON.parse(doc.tags ?? '[]') as string[];
  } catch {
    current = [];
  }
  let next: string[];
  if (body.action === 'add' && body.tag) {
    const t = body.tag.trim();
    if (t && !current.includes(t)) {
      next = [...current, t];
    } else {
      next = current;
    }
  } else if (body.action === 'remove' && body.tag) {
    next = current.filter((t) => t !== body.tag);
  } else if (Array.isArray(body.tags)) {
    next = body.tags.map((t) => t.trim()).filter(Boolean);
    next = Array.from(new Set(next));
  } else {
    next = current;
  }
  await db.document.update({ where: { id }, data: { tags: JSON.stringify(next) } });
  return NextResponse.json({ success: true, tags: next });
}

// GET /api/rag/documents/[id]/tags — obtener tags
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureInitialized();
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, select: { tags: true } });
  if (!doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }
  let tags: string[] = [];
  try {
    tags = JSON.parse(doc.tags ?? '[]') as string[];
  } catch {
    tags = [];
  }
  return NextResponse.json({ tags });
}

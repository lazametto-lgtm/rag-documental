import { NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/rag/ingester';
import { SAMPLE_DOCUMENTS } from '@/lib/rag/sample-data';
import { ensureInitialized, resetInitFlag } from '@/lib/rag/init';

// POST /api/rag/seed — siembra datos de ejemplo ficticios (claramente marcados DEMO)
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = (await req.json().catch(() => ({}))) as { force?: boolean };
    const force = body.force === true;
    const results = [];
    for (const doc of SAMPLE_DOCUMENTS) {
      try {
        const r = await ingestDocument(doc);
        // Si force y ya existe, eliminar y reingestar
        if (force && !r.indexed) {
          // No hay API directa de delete por hash; buscamos por contentHash
          // Para simplicidad, omitimos reingesta forzada
        }
        results.push(r);
      } catch (err) {
        results.push({
          title: doc.title,
          error: (err as Error).message,
          indexed: false,
        });
      }
    }
    resetInitFlag();
    await ensureInitialized();
    return NextResponse.json({
      success: true,
      seeded: results.filter((r: any) => r.indexed).length,
      alreadyExisted: results.filter((r: any) => !r.indexed).length,
      results,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

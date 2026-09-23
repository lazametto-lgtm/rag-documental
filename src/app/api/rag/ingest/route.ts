import { NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/rag/ingester';
import { ensureInitialized } from '@/lib/rag/init';
import type { IngestInput } from '@/lib/rag/ingester';

// POST /api/rag/ingest — ingesta un documento (texto crudo + metadatos).
// El sistema de chunking + embedding + indexación ocurre automáticamente.
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = (await req.json()) as Partial<IngestInput>;
    if (!body.title || !body.rawText) {
      return NextResponse.json(
        { error: 'Se requieren "title" y "rawText"' },
        { status: 400 },
      );
    }
    const result = await ingestDocument({
      title: body.title,
      docType: body.docType ?? 'OTHER',
      jurisdiction: body.jurisdiction,
      entity: body.entity,
      period: body.period,
      version: body.version,
      validityDate: body.validityDate,
      status: body.status ?? 'VIGENT',
      collectionName: body.collectionName,
      collectionId: body.collectionId,
      sourcePath: body.sourcePath,
      rawText: body.rawText,
      pageCount: body.pageCount ?? 1,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

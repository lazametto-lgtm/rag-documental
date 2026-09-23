import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';

// GET /api/rag/history — historial de consultas con búsqueda y filtros
export async function GET(req: Request) {
  await ensureInitialized();
  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const docType = url.searchParams.get('docType');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500);
  const since = url.searchParams.get('since'); // ISO

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { question: { contains: q } },
    ];
  }
  if (since) {
    where.createdAt = { gte: new Date(since) };
  }
  if (docType) {
    where.document = { docType };
  }

  const logs = await db.queryLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      document: {
        select: {
          id: true,
          title: true,
          docType: true,
          jurisdiction: true,
          entity: true,
          period: true,
        },
      },
    },
  });

  const parsed = logs.map((l) => {
    let resp: Record<string, unknown> = {};
    try {
      resp = JSON.parse(l.response);
    } catch {
      resp = {};
    }
    const citations = (resp.citations as Array<Record<string, unknown>>) ?? [];
    return {
      id: l.id,
      question: l.question,
      answer: (resp.answer as string) ?? '',
      confidence: (resp.confidence as string) ?? 'medium',
      confidenceScore: (resp.confidenceScore as number) ?? 0,
      warnings: (resp.warnings as string[]) ?? [],
      noEvidence: (resp.noEvidence as boolean) ?? false,
      latencyMs: l.latencyMs,
      llmProvider: l.llmProvider,
      retrievedCount: l.retrievedCount,
      citationsCount: citations.length,
      createdAt: l.createdAt.toISOString(),
      document: l.document
        ? {
            id: l.document.id,
            title: l.document.title,
            docType: l.document.docType,
            jurisdiction: l.document.jurisdiction ?? undefined,
            entity: l.document.entity ?? undefined,
            period: l.document.period ?? undefined,
          }
        : null,
    };
  });

  return NextResponse.json({
    queries: parsed,
    total: parsed.length,
  });
}

// DELETE /api/rag/history — limpiar historial
export async function DELETE() {
  await ensureInitialized();
  const result = await db.queryLog.deleteMany({});
  return NextResponse.json({ success: true, deleted: result.count });
}

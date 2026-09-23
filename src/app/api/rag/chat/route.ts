import { NextResponse } from 'next/server';
import { answerQuery } from '@/lib/rag/generator';
import { ensureInitialized } from '@/lib/rag/init';
import type { RagQuery, RetrievalOptions, RetrievalFilters, DocType, DocStatus } from '@/lib/rag/types';

// POST /api/rag/chat — consulta con RAG, devuelve respuesta + citas
export async function POST(req: Request) {
  try {
    await ensureInitialized();
    const body = (await req.json()) as Partial<RagQuery> & {
      options?: RetrievalOptions & { filters?: RetrievalFilters & { docType?: string; status?: string } };
    };
    if (!body.question) {
      return NextResponse.json({ error: 'Se requiere "question"' }, { status: 400 });
    }

    const options: RetrievalOptions = {
      topK: body.options?.topK ?? 20,
      rerankTopK: body.options?.rerankTopK ?? 6,
      mmrLambda: body.options?.mmrLambda ?? 0.7,
      useReranker: body.options?.useReranker ?? true,
      useMultiQuery: body.options?.useMultiQuery ?? false,
      filters: body.options?.filters
        ? {
            ...body.options.filters,
            docType: body.options.filters.docType as DocType | undefined,
            status: body.options.filters.status as DocStatus | undefined,
          }
        : undefined,
    };

    const result = await answerQuery({
      question: body.question,
      history: body.history,
      options,
      localMode: body.localMode ?? false,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}

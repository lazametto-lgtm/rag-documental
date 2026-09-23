import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureInitialized } from '@/lib/rag/init';
import { getDefaultEmbedder } from '@/lib/rag/embeddings';
import { cosineSim, buildSnippet } from '@/lib/rag/utils';
import type { RetrievedChunk, DocType, DocStatus, ChunkType } from '@/lib/rag/types';

// POST /api/rag/semantic-search — búsqueda semántica con embeddings
// Recibe un texto, genera embedding, busca los chunks más similares por cosine similarity
export async function POST(req: Request) {
  await ensureInitialized();
  const body = (await req.json()) as {
    text: string;
    topK?: number;
    docType?: string;
    minScore?: number;
  };

  if (!body.text || body.text.trim().length < 3) {
    return NextResponse.json({ error: 'Se requiere "text" (mínimo 3 caracteres)' }, { status: 400 });
  }

  const topK = Math.min(body.topK ?? 10, 50);
  const docType = body.docType;
  const minScore = body.minScore ?? 0.05;

  // Generar embedding del texto de búsqueda
  const embedder = getDefaultEmbedder();
  const queryVec = await embedder.embed(body.text.trim());

  // Cargar todos los chunks con sus embeddings
  const chunks = await db.chunk.findMany({
    where: { document: { deletedAt: null } },
    select: {
      id: true,
      content: true,
      chunkType: true,
      page: true,
      section: true,
      clauseRef: true,
      order: true,
      tokenCount: true,
      embedding: true,
      metadata: true,
      documentId: true,
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
        },
      },
    },
    take: 5000, // límite para performance
  });

  // Filtrar por docType si se especifica
  const filtered = docType
    ? chunks.filter((c) => c.document.docType === docType)
    : chunks;

  // Calcular cosine similarity
  const results: RetrievedChunk[] = [];
  for (const c of filtered) {
    let embedding: number[] = [];
    try {
      embedding = JSON.parse(c.embedding);
    } catch {
      continue;
    }
    if (embedding.length === 0) continue;

    const sim = cosineSim(queryVec, embedding);
    if (sim < minScore) continue;

    results.push({
      id: c.id,
      content: c.content,
      metadata: {
        documentId: c.document.id,
        documentTitle: c.document.title,
        docType: (c.document.docType as DocType) ?? 'OTHER',
        page: c.page,
        section: c.section ?? undefined,
        clauseRef: c.clauseRef ?? undefined,
        chunkType: (c.chunkType as ChunkType) ?? 'TEXT',
        order: c.order,
        jurisdiction: c.document.jurisdiction ?? undefined,
        entity: c.document.entity ?? undefined,
        period: c.document.period ?? undefined,
        version: c.document.version ?? undefined,
        status: (c.document.status as DocStatus) ?? 'VIGENT',
      },
      score: sim,
      vectorScore: sim,
      rank: 0,
    });
  }

  // Ordenar por score descendente, tomar topK
  results.sort((a, b) => (b.vectorScore ?? 0) - (a.vectorScore ?? 0));
  const top = results.slice(0, topK).map((c, i) => ({ ...c, rank: i + 1 }));

  // Construir respuesta con snippets
  const response = top.map((c) => ({
    chunkId: c.id,
    content: c.content,
    snippet: buildSnippet(c.content, 200),
    score: Math.round((c.vectorScore ?? 0) * 1000) / 1000,
    rank: c.rank,
    documentTitle: c.metadata.documentTitle,
    docType: c.metadata.docType,
    page: c.metadata.page,
    section: c.metadata.section,
    clauseRef: c.metadata.clauseRef,
    chunkType: c.metadata.chunkType,
    jurisdiction: c.metadata.jurisdiction,
    entity: c.metadata.entity,
    period: c.metadata.period,
    status: c.metadata.status,
  }));

  return NextResponse.json({
    results: response,
    total: results.length,
    query: body.text.trim(),
    embedder: embedder.name,
    dimensions: embedder.dim,
  });
}

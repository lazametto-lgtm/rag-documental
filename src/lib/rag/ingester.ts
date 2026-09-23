// Pipeline de ingesta: texto/PDF → chunks → embeddings → SQLite + vector store + BM25.
// Soporta ingesta incremental (agregar/actualizar/eliminar documentos sin reindexar todo).

import type { Chunk, DocType, DocStatus } from './types';
import { chunkDocument, type ChunkInput } from './chunker';
import { getDefaultEmbedder } from './embeddings';
import { getVectorStore, loadStoreFromDb } from './vector-store';
import { getBM25Index } from './bm25';
import { asDocType, asDocStatus, hashText, estimateTokens, l2Norm } from './utils';
import { db } from '@/lib/db';

export interface IngestInput {
  title: string;
  docType: DocType | string;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  validityDate?: string;
  status?: DocStatus | string;
  collectionId?: string;
  collectionName?: string;
  sourcePath?: string;
  rawText: string;
  pageCount?: number;
}

export interface IngestResult {
  documentId: string;
  title: string;
  chunkCount: number;
  contentHash: string;
  indexed: boolean;
  elapsedMs: number;
}

// Ingesta un documento: crea o actualiza (basado en hash de contenido).
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const start = Date.now();
  const docType = asDocType(input.docType);
  const status = asDocStatus(input.status ?? 'VIGENT');
  const contentHash = hashText(input.rawText);

  // Idempotencia: si ya existe el hash, no reingestamos
  const existing = await db.document.findUnique({ where: { contentHash } });
  if (existing) {
    return {
      documentId: existing.id,
      title: existing.title,
      chunkCount: existing.chunkCount,
      contentHash: existing.contentHash,
      indexed: false,
      elapsedMs: Date.now() - start,
    };
  }

  // Resolver collectionId (crear la colección si no existe)
  let collectionId = input.collectionId;
  if (!collectionId && input.collectionName) {
    const col = await db.collection.upsert({
      where: { name: input.collectionName },
      create: { name: input.collectionName, description: `Colección ${input.collectionName}` },
      update: {},
    });
    collectionId = col.id;
  }

  // Crear el documento en la BD
  const doc = await db.document.create({
    data: {
      title: input.title,
      docType,
      jurisdiction: input.jurisdiction ?? null,
      entity: input.entity ?? null,
      period: input.period ?? null,
      version: input.version ?? null,
      validityDate: input.validityDate ? new Date(input.validityDate) : null,
      status,
      sourcePath: input.sourcePath ?? null,
      contentHash,
      pageCount: input.pageCount ?? 1,
      rawText: input.rawText,
      collectionId: collectionId ?? null,
    },
  });

  // Chunking
  const chunkInput: ChunkInput = {
    documentId: doc.id,
    documentTitle: doc.title,
    docType,
    jurisdiction: input.jurisdiction,
    entity: input.entity,
    period: input.period,
    version: input.version,
    status,
    validityDate: input.validityDate,
    collectionId: collectionId,
    pageCount: input.pageCount ?? 1,
    rawText: input.rawText,
  };
  const chunks = chunkDocument(chunkInput);

  // Embeddings
  const embedder = getDefaultEmbedder();
  const texts = chunks.map((c) => c.content);
  const embeddings = await embedder.embedBatch(texts);

  // Preparar chunks para persistencia
  const chunkRows = chunks.map((c, i) => ({
    id: c.id,
    documentId: doc.id,
    content: c.content,
    chunkType: c.metadata.chunkType,
    page: c.metadata.page,
    section: c.metadata.section ?? null,
    clauseRef: c.metadata.clauseRef ?? null,
    order: c.metadata.order,
    embedding: JSON.stringify(embeddings[i]),
    metadata: JSON.stringify({ hash: c.metadata.hash, tableData: c.tableData }),
    tokenCount: estimateTokens(c.content),
    norm: l2Norm(embeddings[i]),
  }));

  // Bulk insert (chunks) — en SQLite, batch create
  await db.chunk.createMany({ data: chunkRows });

  // Actualizar contador en el documento
  await db.document.update({
    where: { id: doc.id },
    data: { chunkCount: chunks.length },
  });

  // Cargar en el vector store + BM25 (incremental)
  const store = getVectorStore();
  const chunksWithEmbed: Chunk[] = chunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
    norm: l2Norm(embeddings[i]),
    tokenCount: estimateTokens(c.content),
  }));
  await store.upsert(chunksWithEmbed);
  const bm25 = getBM25Index();
  bm25.addChunks(chunksWithEmbed);

  return {
    documentId: doc.id,
    title: doc.title,
    chunkCount: chunks.length,
    contentHash,
    indexed: true,
    elapsedMs: Date.now() - start,
  };
}

// Elimina un documento y todos sus chunks (cascade) + limpia índices en memoria.
export async function deleteDocument(documentId: string): Promise<boolean> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return false;
  // Eliminar chunks (cascade via Prisma onDelete: Cascade)
  await db.document.delete({ where: { id: documentId } });
  // Limpiar índices en memoria
  const store = getVectorStore();
  await store.remove(documentId);
  const bm25 = getBM25Index();
  bm25.removeDocument(documentId);
  return true;
}

// Reinicializa los índices en memoria desde la BD (para arranque del server).
export async function reindexInMemory(): Promise<number> {
  return loadStoreFromDb();
}

// Soft delete (no borra chunks físicamente, marca deletedAt).
export async function softDeleteDocument(documentId: string): Promise<boolean> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return false;
  await db.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });
  const store = getVectorStore();
  await store.remove(documentId);
  const bm25 = getBM25Index();
  bm25.removeDocument(documentId);
  return true;
}

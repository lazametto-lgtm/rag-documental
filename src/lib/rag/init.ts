// Inicialización perezosa de los índices en memoria.
// Garantiza que el vector store y BM25 se carguen desde SQLite en el primer request.

import { loadStoreFromDb } from './vector-store';
import { getVectorStore } from './vector-store';
import { getBM25Index } from './bm25';
import { ingestDocument } from './ingester';
import { SAMPLE_DOCUMENTS } from './sample-data';
import { db } from '@/lib/db';

let _initialized = false;
let _initPromise: Promise<number> | null = null;

export async function ensureInitialized(): Promise<number> {
  if (_initialized) {
    return Promise.resolve(getVectorStore().size);
  }
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const count = await loadStoreFromDb();
    _initialized = true;
    // Si la DB está vacía, sembrar datos de ejemplo automáticamente
    const docCount = await db.document.count();
    if (docCount === 0) {
      console.log('[rag] Base de datos vacía. Sembrando datos de ejemplo...');
      for (const doc of SAMPLE_DOCUMENTS) {
        try {
          await ingestDocument(doc);
        } catch (err) {
          console.error('[rag] Error sembrando doc:', err);
        }
      }
      const newCount = await loadStoreFromDb();
      console.log(`[rag] Sembrado completo. ${newCount} chunks cargados.`);
      return newCount;
    }
    console.log(`[rag] Inicializado. ${count} chunks en memoria.`);
    return count;
  })();
  return _initPromise;
}

export function resetInitFlag() {
  _initialized = false;
  _initPromise = null;
}

export function getStoreSize(): number {
  return getVectorStore().size;
}

export function getBM25Size(): number {
  return getBM25Index().size;
}

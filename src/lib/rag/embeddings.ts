// Embeddings densos multilingües vía TF-IDF hashing.
// Implementación 100% local, sin dependencias externas.
// La interfaz Embedder permite sustituir por BGE-M3 / multilingual-e5 / OpenAI text-embedding-3-large.

import type { Embedder } from './types';
import { tokenize, hashToken, hashTokenSign, normalizeVec, l2Norm } from './utils';

const DEFAULT_DIM = 1024;

interface TfidfEmbedderOptions {
  dim?: number;
  // Pesos extra para términos legales/numéricos (mejora discriminación en balances y contratos)
  boostLegal?: boolean;
}

export function createTfidfEmbedder(opts: TfidfEmbedderOptions = {}): Embedder {
  const dim = opts.dim ?? DEFAULT_DIM;
  const boostLegal = opts.boostLegal ?? true;

  const LEGAL_BOOST_TOKENS = new Set([
    'articulo','art','clausula','cl','inciso','inc','seccion','sec','anexo',
    'article','clause','section','annex','parte','parte',
    'total','activo','pasivo','patrimonio','ingresos','egresos','neto',
  ]);

  function embed(text: string): Promise<number[]> {
    const vec = new Array<number>(dim).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return Promise.resolve(vec);
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    for (const [tok, freq] of tf) {
      const idx = hashToken(tok, dim);
      const sign = hashTokenSign(tok);
      // Peso TF logarítmico para suavizar frecuencias altas
      const weight = 1 + Math.log(freq);
      const boost = boostLegal && LEGAL_BOOST_TOKENS.has(tok) ? 1.6 : 1;
      vec[idx] += sign * weight * boost;
    }
    // Normalización L2 para cosine sim
    return Promise.resolve(normalizeVec(vec));
  }

  async function embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => embed(t)));
  }

  return {
    embed,
    embedBatch,
    get dim() {
      return dim;
    },
    get name() {
      return `tfidf-hash-d${dim}`;
    },
  };
}

// Singleton por defecto
let _embedder: Embedder | null = null;
export function getDefaultEmbedder(): Embedder {
  if (!_embedder) _embedder = createTfidfEmbedder();
  return _embedder;
}

// Utilidad: dado un vector, devolver su norma L2
export function embeddingNorm(vec: number[]): number {
  return l2Norm(vec);
}

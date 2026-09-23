// Tipos centrales del sistema RAG documental.
// Compartidos entre ingesta, recuperación, generación y evaluación.

export type DocType = 'BALANCE' | 'CONTRACT' | 'REGULATION' | 'OTHER';
export type DocStatus = 'VIGENT' | 'SUPERSEDED' | 'DRAFT';
export type ChunkType =
  | 'TEXT'
  | 'TABLE'
  | 'HEADING'
  | 'CLAUSE'
  | 'ARTICLE'
  | 'SECTION'
  | 'FOOTNOTE';

export interface DocumentMetadata {
  id: string;
  title: string;
  docType: DocType;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  validityDate?: string; // ISO
  status: DocStatus;
  sourcePath?: string;
  contentHash: string;
  chunkCount: number;
  pageCount: number;
  collectionId?: string;
  collectionName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkMetadata {
  documentId: string;
  documentTitle: string;
  docType: DocType;
  page: number;
  section?: string;
  clauseRef?: string;
  chunkType: ChunkType;
  order: number;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  status: DocStatus;
  collectionId?: string;
  hash?: string;
}

export interface Chunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
  norm?: number;
  tokenCount?: number;
  // Para tabla: representación serializada en filas/columnas
  tableData?: { headers: string[]; rows: string[][] };
}

export interface RetrievedChunk extends Chunk {
  score: number;            // score final tras reranking (normalizado 0..1)
  vectorScore?: number;     // similitud vectorial pura
  bm25Score?: number;       // score BM25 normalizado
  rerankScore?: number;     // score del cross-encoder/reranker
  rank: number;
}

export interface RetrievalFilters {
  docType?: DocType;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  status?: DocStatus;
  collectionId?: string;
  documentIds?: string[];
}

export interface RetrievalOptions {
  topK?: number;            // número de chunks a recuperar pre-reranking
  rerankTopK?: number;      // número de chunks tras reranking
  mmrLambda?: number;       // 0..1, 1=pura relevancia, 0=máxima diversidad
  useReranker?: boolean;
  useMultiQuery?: boolean;
  filters?: RetrievalFilters;
}

export interface Citation {
  documentId: string;
  documentTitle: string;
  docType: DocType;
  page: number;
  section?: string;
  clauseRef?: string;
  chunkId: string;
  chunkType: ChunkType;
  snippet: string;          // cita textual breve (≤ 280 chars)
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  validityDate?: string;
  status: DocStatus;
  score: number;
}

export interface RagAnswer {
  answer: string;                  // respuesta directa en markdown
  evidence: string[];               // evidencia textual utilizada
  citations: Citation[];            // citas verificables
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;         // 0..1
  warnings: string[];              // advertencias (doc desactualizado, ambiguo, etc.)
  retrievedChunks: RetrievedChunk[];
  latencyMs: number;
  llmProvider: string;
  // Indica si no se encontró evidencia suficiente
  noEvidence: boolean;
  // Consultas expandidas (multi-query)
  expandedQueries?: string[];
}

export interface RagQuery {
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  options?: RetrievalOptions;
  // Modo local: si true, se omite LLM comercial y se genera respuesta a partir de los chunks
  localMode?: boolean;
}

// --- Interfaces de proveedores (para swap ChromaDB↔Pinecone, LLM comercial↔Ollama) ---

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dim: number;
  readonly name: string;
}

export interface VectorStore {
  upsert(chunks: Chunk[]): Promise<void>;
  remove(documentId: string): Promise<void>;
  search(query: number[], topK: number, filters?: RetrievalFilters): Promise<RetrievedChunk[]>;
  clear(): Promise<void>;
  readonly size: number;
}

export interface LLMProvider {
  generate(messages: LLMMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
  readonly name: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Reranker {
  rerank(query: string, chunks: Chunk[], topK: number): Promise<RetrievedChunk[]>;
  readonly name: string;
}

// --- Evaluación (RAGAS-like) ---

export interface EvaluationMetric {
  faithfulness: number;        // 0..1 — la respuesta se basa en el contexto
  answerRelevancy: number;     // 0..1 — la respuesta responde a la pregunta
  contextPrecision: number;   // 0..1 — los chunks recuperados son relevantes
  contextRecall: number;       // 0..1 — se recuperó toda la info necesaria
  citationAccuracy: number;   // 0..1 — las citas son correctas y verificables
}

export interface EvaluationResult extends EvaluationMetric {
  runId: string;
  questionCount: number;
  perQuestion: Array<{
    question: string;
    expected: string;
    answer: string;
    metrics: EvaluationMetric;
    citations: Citation[];
    noEvidence: boolean;
  }>;
}

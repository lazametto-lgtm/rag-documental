// Cliente de API para el sistema RAG.
// Funciones tipadas que llaman a /api/rag/*

import type {
  RagAnswer,
  RagQuery,
  RetrievalOptions,
} from '@/lib/rag/types';

export interface DocumentItem {
  id: string;
  title: string;
  docType: string;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  validityDate?: string;
  status: string;
  sourcePath?: string;
  contentHash: string;
  chunkCount: number;
  pageCount: number;
  collectionId?: string;
  collectionName?: string;
  favorite?: boolean;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DocumentDetail extends DocumentItem {
  rawText?: string;
  chunks: Array<{
    id: string;
    content: string;
    chunkType: string;
    page: number;
    section?: string;
    clauseRef?: string;
    order: number;
    tokenCount: number;
  }>;
}

export interface StatsResponse {
  documents: number;
  activeDocuments: number;
  chunks: number;
  queryLogs: number;
  evaluationRuns: number;
  collections: number;
  inMemoryVectors: number;
  inMemoryBM25: number;
  byType: Array<{ docType: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  storage: {
    vectorBackend: string;
    bm25Backend: string;
    embedder: string;
    llmProvider: string;
    reranker: string;
  };
}

export interface CollectionItem {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  createdAt: string;
}

async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchStats(): Promise<StatsResponse> {
  return callApi<StatsResponse>('/api/rag/stats');
}

export async function fetchDocuments(filters?: {
  docType?: string;
  jurisdiction?: string;
  entity?: string;
  status?: string;
  collectionId?: string;
  q?: string;
}): Promise<{ documents: DocumentItem[] }> {
  const params = new URLSearchParams();
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(k, v);
    }
  }
  const q = params.toString();
  return callApi<{ documents: DocumentItem[] }>(`/api/rag/documents${q ? '?' + q : ''}`);
}

export async function fetchDocumentDetail(id: string): Promise<{ document: DocumentDetail }> {
  return callApi<{ document: DocumentDetail }>(`/api/rag/documents/${id}`);
}

export async function deleteDocument(id: string, soft = true): Promise<{ success: boolean }> {
  return callApi<{ success: boolean }>(`/api/rag/documents/${id}?soft=${soft}`, {
    method: 'DELETE',
  });
}

export interface IngestPayload {
  title: string;
  docType: string;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  validityDate?: string;
  status?: string;
  collectionName?: string;
  sourcePath?: string;
  rawText: string;
  pageCount?: number;
}

export async function ingestDocument(p: IngestPayload): Promise<{
  success: boolean;
  documentId: string;
  title: string;
  chunkCount: number;
  indexed: boolean;
  elapsedMs: number;
}> {
  return callApi('/api/rag/ingest', {
    method: 'POST',
    body: JSON.stringify(p),
  });
}

export async function seedSampleData(force = false): Promise<{
  success: boolean;
  seeded: number;
  alreadyExisted: number;
}> {
  return callApi('/api/rag/seed', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

export async function fetchCollections(): Promise<{ collections: CollectionItem[] }> {
  return callApi('/api/rag/collections');
}

export interface ChatRequest extends RagQuery {
  options?: RetrievalOptions;
}

export interface ChatResponse extends RagAnswer {
  success: boolean;
}

export async function chatQuery(req: ChatRequest): Promise<ChatResponse> {
  return callApi<ChatResponse>('/api/rag/chat', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export interface EvalMetric {
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall: number;
  citationAccuracy: number;
}

export interface EvalRun {
  id: string;
  questionCount: number;
  createdAt: string;
  metrics: EvalMetric;
}

export interface EvaluationResultResponse extends EvalMetric {
  success: boolean;
  runId: string;
  questionCount: number;
  perQuestion: Array<{
    question: string;
    expected: string;
    answer: string;
    metrics: EvalMetric;
    citations: unknown[];
    noEvidence: boolean;
  }>;
}

export async function runEvaluation(): Promise<EvaluationResultResponse> {
  return callApi<EvaluationResultResponse>('/api/rag/evaluate', { method: 'POST' });
}

export async function fetchEvalRuns(): Promise<{ runs: EvalRun[] }> {
  return callApi<{ runs: EvalRun[] }>('/api/rag/evaluate');
}

// --- Historial de consultas ---

export interface HistoryItem {
  id: string;
  question: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  warnings: string[];
  noEvidence: boolean;
  latencyMs: number;
  llmProvider: string;
  retrievedCount: number;
  citationsCount: number;
  createdAt: string;
  document: {
    id: string;
    title: string;
    docType: string;
    jurisdiction?: string;
    entity?: string;
    period?: string;
  } | null;
}

export async function fetchHistory(opts?: {
  q?: string;
  docType?: string;
  limit?: number;
  since?: string;
}): Promise<{ queries: HistoryItem[]; total: number }> {
  const params = new URLSearchParams();
  if (opts) {
    if (opts.q) params.set('q', opts.q);
    if (opts.docType) params.set('docType', opts.docType);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.since) params.set('since', opts.since);
  }
  const qs = params.toString();
  return callApi<{ queries: HistoryItem[]; total: number }>(
    `/api/rag/history${qs ? '?' + qs : ''}`,
  );
}

export async function clearHistory(): Promise<{ success: boolean; deleted: number }> {
  return callApi<{ success: boolean; deleted: number }>('/api/rag/history', {
    method: 'DELETE',
  });
}

export interface ChunkDetail {
  id: string;
  content: string;
  chunkType: string;
  page: number;
  section?: string | null;
  clauseRef?: string | null;
  order: number;
  tokenCount: number;
  tableData: { headers: string[]; rows: string[][] } | null;
  document: {
    id: string;
    title: string;
    docType: string;
    jurisdiction?: string | null;
    entity?: string | null;
    period?: string | null;
    version?: string | null;
    validityDate?: string | null;
    status: string;
    collectionId?: string | null;
  };
}

export async function fetchChunkDetail(id: string): Promise<{ chunk: ChunkDetail }> {
  return callApi<{ chunk: ChunkDetail }>(`/api/rag/chunks/${id}`);
}

// --- Analíticas ---

export interface ChunkTypeDistItem {
  type: string;
  count: number;
  tokens: number;
}

export interface PerDocumentAnalytics {
  id: string;
  title: string;
  docType: string;
  totalChunks: number;
  totalTokens: number;
  dist: Record<string, number>;
}

export interface AnalyticsResponse {
  chunkTypeDistribution: ChunkTypeDistItem[];
  perDocument: PerDocumentAnalytics[];
  tokenStats: {
    total: number;
    avg: number;
    min: number;
    max: number;
    chunks: number;
  };
  pageDistribution: Array<{ page: number; count: number }>;
  topDocuments: Array<{
    id: string;
    title: string;
    docType: string;
    chunkCount: number;
    pageCount: number;
  }>;
}

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  return callApi<AnalyticsResponse>('/api/rag/analytics');
}

// --- Comparación de chunks ---

export interface CompareChunk {
  id: string;
  content: string;
  chunkType: string;
  page: number;
  section?: string | null;
  clauseRef?: string | null;
  order: number;
  tokenCount: number;
  tableData: { headers: string[]; rows: string[][] } | null;
  document: {
    id: string;
    title: string;
    docType: string;
    jurisdiction?: string | null;
    entity?: string | null;
    period?: string | null;
    version?: string | null;
    validityDate?: string | null;
    status: string;
  };
}

export async function compareChunks(ids: string[]): Promise<{ chunks: CompareChunk[] }> {
  const qs = new URLSearchParams({ ids: ids.join(',') });
  return callApi<{ chunks: CompareChunk[] }>(`/api/rag/compare?${qs.toString()}`);
}

// --- Exportar evaluación a CSV ---

export function evalExportUrl(runId?: string): string {
  return runId ? `/api/rag/eval-export?runId=${runId}` : '/api/rag/eval-export';
}

// --- Comparación A/B de LLMs ---

export interface ABResult {
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  warnings: string[];
  noEvidence: boolean;
  latencyMs: number;
  llmProvider: string;
  error?: string;
}

export interface ABCompareResponse {
  success: boolean;
  question: string;
  retrievedChunks: number;
  retrievalLatencyMs: number;
  commercial: ABResult;
  local: ABResult;
  similarity: number;
  bestScore: number;
}

export async function compareLLMs(req: { question: string }): Promise<ABCompareResponse> {
  return callApi<ABCompareResponse>('/api/rag/compare-llm', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// --- Sugerencias de preguntas similares ---

export interface SuggestionItem {
  question: string;
  source: 'history' | 'template';
  count?: number;
  type?: string;
  score: number;
}

export async function fetchSuggestions(q: string): Promise<{ suggestions: SuggestionItem[]; query: string }> {
  const qs = new URLSearchParams({ q });
  return callApi<{ suggestions: SuggestionItem[]; query: string }>(
    `/api/rag/suggest?${qs.toString()}`,
  );
}

// --- Heatmap de densidad de chunks por documento × página ---

export interface HeatmapPage {
  page: number;
  count: number;
  tokens: number;
  types: Record<string, number>;
}

export interface HeatmapDocument {
  id: string;
  title: string;
  docType: string;
  pageCount: number;
  totalChunks: number;
  pages: HeatmapPage[];
}

export interface HeatmapResponse {
  documents: HeatmapDocument[];
  maxPerPage: number;
  totalDocuments: number;
  totalPages: number;
}

export async function fetchHeatmap(): Promise<HeatmapResponse> {
  return callApi<HeatmapResponse>('/api/rag/heatmap');
}

// --- Búsqueda full-text ---

export interface SearchResult {
  id: string;
  title: string;
  docType: string;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  status: string;
  chunkCount: number;
  pageCount: number;
  favorite: boolean;
  tags: string[];
  matchCount: number;
  snippets: Array<{ text: string; position: number }>;
  createdAt: string;
}

export async function fullTextSearch(q: string, opts?: { docType?: string; limit?: number }): Promise<{ results: SearchResult[]; query: string; total: number }> {
  const params = new URLSearchParams({ q });
  if (opts?.docType) params.set('docType', opts.docType);
  if (opts?.limit) params.set('limit', String(opts.limit));
  return callApi<{ results: SearchResult[]; query: string; total: number }>(
    `/api/rag/search?${params.toString()}`,
  );
}

// --- Favoritos ---

export async function toggleFavorite(documentId: string, favorite?: boolean): Promise<{ success: boolean; favorite: boolean }> {
  return callApi<{ success: boolean; favorite: boolean }>(`/api/rag/documents/${documentId}/favorite`, {
    method: 'PATCH',
    body: JSON.stringify(favorite === undefined ? {} : { favorite }),
  });
}

// --- Tags ---

export async function updateTags(
  documentId: string,
  body: { tags?: string[]; action?: 'set' | 'add' | 'remove'; tag?: string },
): Promise<{ success: boolean; tags: string[] }> {
  return callApi<{ success: boolean; tags: string[] }>(`/api/rag/documents/${documentId}/tags`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// --- Métricas por tipo (para gráfico radar) ---

export interface MetricByType {
  docType: string;
  label: string;
  dimensions: {
    documentos: number;
    chunks: number;
    tokens: number;
    páginas: number;
    densidad: number;
  };
  raw: {
    documentos: number;
    chunks: number;
    tokens: number;
    páginas: number;
    avgChunks: number;
    avgTokens: number;
    favorites: number;
  };
}

export interface MetricsByTypeResponse {
  types: MetricByType[];
  totals: {
    documents: number;
    chunks: number;
    tokens: number;
    pages: number;
    favorites: number;
  };
}

export async function fetchMetricsByType(): Promise<MetricsByTypeResponse> {
  return callApi<MetricsByTypeResponse>('/api/rag/metrics-by-type');
}

// --- Dashboard ejecutivo ---

export interface DashboardStats {
  totalDocs: number;
  activeDocs: number;
  totalChunks: number;
  totalQueries: number;
  totalEvals: number;
  totalCollections: number;
  favDocs: number;
  avgConfidence: number;
  avgLatency: number;
}

export interface DashboardRecentDoc {
  id: string;
  title: string;
  docType: string;
  chunkCount: number;
  createdAt: string;
  favorite: boolean;
}

export interface DashboardRecentQuery {
  id: string;
  question: string;
  latencyMs: number;
  llmProvider: string;
  confidence: string;
  confidenceScore: number;
  noEvidence: boolean;
  createdAt: string;
  document: { id: string; title: string; docType: string } | null;
}

export interface DashboardRecentEval {
  id: string;
  questionCount: number;
  createdAt: string;
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall: number;
  citationAccuracy: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recentDocs: DashboardRecentDoc[];
  recentQueries: DashboardRecentQuery[];
  recentEvals: DashboardRecentEval[];
  lastEval: DashboardRecentEval | null;
  byType: Array<{ docType: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  return callApi<DashboardResponse>('/api/rag/dashboard');
}

// --- Timeline de actividad ---

export interface TimelineBucket {
  key: string;
  date: string;
  count: number;
  avgLatency: number;
}

export interface TimelineResponse {
  granularity: 'day' | 'hour';
  days: number;
  data: TimelineBucket[];
  totalQueries: number;
  peakBucket: { key: string; count: number; date: string } | null;
  avgLatencyGlobal: number;
}

export async function fetchTimeline(granularity: 'day' | 'hour' = 'day', days = 30): Promise<TimelineResponse> {
  const params = new URLSearchParams({ granularity, days: String(days) });
  return callApi<TimelineResponse>(`/api/rag/timeline?${params.toString()}`);
}

// --- Comparación de evaluaciones ---

export interface EvalCompareRun {
  id: string;
  questionCount: number;
  createdAt: string;
  metrics: {
    faithfulness: number;
    answerRelevancy: number;
    contextPrecision: number;
    contextRecall: number;
    citationAccuracy: number;
  };
  perQuestion: Array<{
    question: string;
    expected: string;
    answer: string;
    metrics: {
      faithfulness: number;
      answerRelevancy: number;
      contextPrecision: number;
      contextRecall: number;
      citationAccuracy: number;
    };
    noEvidence: boolean;
  }>;
}

export interface EvalCompareDelta {
  metric: string;
  a: number;
  b: number;
  absDelta: number;
  pctDelta: number;
  improved: boolean;
}

export interface EvalCompareResponse {
  runA: EvalCompareRun;
  runB: EvalCompareRun;
  deltas: EvalCompareDelta[];
  summary: {
    avgA: number;
    avgB: number;
    avgDelta: number;
    avgPctDelta: number;
    improved: boolean;
  };
}

export async function compareEvals(runIdA: string, runIdB: string): Promise<EvalCompareResponse> {
  const params = new URLSearchParams({ ids: `${runIdA},${runIdB}` });
  return callApi<EvalCompareResponse>(`/api/rag/eval-compare?${params.toString()}`);
}

// --- Búsqueda semántica ---

export interface SemanticSearchResult {
  chunkId: string;
  content: string;
  snippet: string;
  score: number;
  rank: number;
  documentTitle: string;
  docType: string;
  page: number;
  section?: string;
  clauseRef?: string;
  chunkType: string;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  status: string;
}

export interface SemanticSearchResponse {
  results: SemanticSearchResult[];
  total: number;
  query: string;
  embedder: string;
  dimensions: number;
}

export async function semanticSearch(text: string, opts?: { topK?: number; docType?: string }): Promise<SemanticSearchResponse> {
  return callApi<SemanticSearchResponse>('/api/rag/semantic-search', {
    method: 'POST',
    body: JSON.stringify({ text, ...opts }),
  });
}

// --- Alertas de métricas ---

export interface MetricAlert {
  metric: string;
  label: string;
  value: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'ok';
  message: string;
}

export interface AlertsResponse {
  hasLastRun: boolean;
  runId?: string;
  runDate?: string;
  questionCount?: number;
  alerts: MetricAlert[];
  summary: { total: number; critical: number; warning: number; ok: number };
}

export async function fetchAlerts(): Promise<AlertsResponse> {
  return callApi<AlertsResponse>('/api/rag/alerts');
}

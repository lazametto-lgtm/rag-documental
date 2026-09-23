'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Scissors,
  Database,
  Search,
  Sparkles,
  ListChecks,
  Brain,
  Server,
  ShieldCheck,
  Layers,
  GitBranch,
  Database as DbIcon,
  Cpu,
  Gauge,
  Boxes,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { PageDistributionCard } from './page-distribution-card';
import { ChunkDistributionCard } from './chunk-distribution-card';
import { HeatmapCard } from './heatmap-card';
import { MetricsRadarCard } from './metrics-radar-card';

function ChunkDistributionInline() {
  return <ChunkDistributionCard />;
}

export function ArchitecturePanel() {
  return (
    <div className="space-y-4 overflow-y-auto rag-scroll pr-1">
      {/* Diagrama de flujo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            Diagrama de flujo end-to-end
          </CardTitle>
          <CardDescription>
            Pipeline completo: ingesta → recuperación → generación → respuesta citada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {/* Capa 1: Ingesta */}
            <FlowLayer
              color="emerald"
              title="1. Capa de Ingesta"
              icon={<FileText className="size-4" />}
              items={[
                { icon: <FileText className="size-3.5" />, label: 'PDF / Documento', note: 'PyMuPDF, pdfplumber, Unstructured, Camelot, Tesseract, PaddleOCR (interfaz DocumentParser)' },
                { icon: <Scissors className="size-3.5" />, label: 'Chunker', note: 'Jerárquico + legal-aware (art/cláusula/sección) + table-aware' },
                { icon: <Database className="size-3.5" />, label: 'Embedder', note: 'TF-IDF hash 1024-dim (sustituible por BGE-M3 / multilingual-e5 / OpenAI text-embedding-3-large)' },
              ]}
            />

            <Arrow />

            {/* Capa 2: Almacenamiento */}
            <FlowLayer
              color="blue"
              title="2. Capa de Almacenamiento"
              icon={<DbIcon className="size-4" />}
              items={[
                { icon: <Database className="size-3.5" />, label: 'Vector Store', note: 'In-memory (sustituible por ChromaDB local o Pinecone nube)' },
                { icon: <Layers className="size-3.5" />, label: 'BM25 Index', note: 'Okapi BM25 léxico en memoria' },
                { icon: <Server className="size-3.5" />, label: 'SQLite + Prisma', note: 'Metadatos, chunks, query logs, evaluaciones' },
              ]}
            />

            <Arrow />

            {/* Capa 3: Recuperación */}
            <FlowLayer
              color="violet"
              title="3. Capa de Recuperación"
              icon={<Search className="size-4" />}
              items={[
                { icon: <Search className="size-3.5" />, label: 'Hybrid Retriever', note: 'BM25 ⊕ similitud vectorial (α=0.55) + multi-query' },
                { icon: <ListChecks className="size-3.5" />, label: 'Filtros por metadatos', note: 'tipo, jurisdicción, entidad, período, versión, estado, colección' },
                { icon: <Boxes className="size-3.5" />, label: 'MMR', note: 'Maximal Marginal Relevance (λ=0.7) para diversidad' },
                { icon: <Gauge className="size-3.5" />, label: 'Reranker', note: 'Cross-encoder simulado (sustituible por Cohere Rerank / BGE reranker)' },
              ]}
            />

            <Arrow />

            {/* Capa 4: Generación */}
            <FlowLayer
              color="amber"
              title="4. Capa de Generación"
              icon={<Sparkles className="size-4" />}
              items={[
                { icon: <Brain className="size-3.5" />, label: 'CitationPromptBuilder', note: 'Prompt anti-alucinación + contexto recuperado' },
                { icon: <Cpu className="size-3.5" />, label: 'LLM', note: 'z-ai-web-dev-sdk (sustituible por Ollama / OpenAI / Anthropic)' },
                { icon: <ListChecks className="size-3.5" />, label: 'CitationParser', note: 'Parseo de citas [Documento: nombre, pág. X, sección Y, chunk Z]' },
              ]}
            />

            <Arrow />

            {/* Capa 5: API + UI */}
            <FlowLayer
              color="rose"
              title="5. Capa de API + UI"
              icon={<Server className="size-4" />}
              items={[
                { icon: <Server className="size-3.5" />, label: 'Next.js API Routes', note: '/api/rag/{ingest,documents,chat,evaluate,collections,seed,stats}' },
                { icon: <Layers className="size-3.5" />, label: 'UI Next.js + shadcn', note: 'Chat con citas, librería, ingesta, evaluación, arquitectura' },
                { icon: <ShieldCheck className="size-3.5" />, label: 'Evaluación RAGAS-like', note: 'faithfulness, relevancy, precision/recall, citation accuracy' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Decisiones técnicas */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              Decisiones técnicas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <Decision
              q="¿Por qué modular TS y no LangChain/LlamaIndex Python?"
              a="El ecosistema de skills (z-ai-web-dev-sdk) y la base Next.js son TS-first. El modular TS preserva las interfaces (Embedder, VectorStore, LLMProvider, Reranker) y permite swap trivial a ChromaDB/Pinecone, BGE-M3, Ollama, Cohere Rerank sin reescribir lógica."
            />
            <Decision
              q="¿Por qué TF-IDF hash y no embeddings neuronales?"
              a="100% local, sin dependencias, instantáneo. La interfaz Embedder permite sustituir por BGE-M3 / multilingual-e5 / OpenAI text-embedding-3-large cambiando una línea. La arquitectura híbrida (BM25 + vector + rerank) compensa la menor calidad del embedding base."
            />
            <Decision
              q="¿Por qué in-memory y no ChromaDB directo?"
              a="Cero dependencias externas para desarrollo/local. loadStoreFromDb() garantiza persistencia vía Prisma. Para producción con miles de PDFs, sustituir InMemoryVectorStore por ChromaDB/Pinecone: solo cambia el adaptador, no el retriever."
            />
            <Decision
              q="¿Cómo se evitan alucinaciones?"
              a="Prompt del sistema que instruye responder SOLO con el contexto recuperado. hasEnoughEvidence() aplica threshold: si el mejor chunk < 0.18, responde 'No se encontró información suficiente'. Las citas se construyen SIEMPRE desde los chunks recuperados, nunca desde el texto generado por el LLM."
            />
            <Decision
              q="¿Cómo se versionan normativas y contratos?"
              a="Metadatos por chunk: documento, página, sección, tipo, fecha, jurisdicción, entidad, período, versión, estado (VIGENT/SUPERSEDED/DRAFT). Filtros permiten restringir a versión vigente. Advertencias automáticas si se cita un documento derogado."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Boxes className="size-4 text-primary" />
              Estructura de repositorio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs rag-mono leading-relaxed overflow-x-auto rag-scroll bg-muted/40 p-3 rounded-lg border border-border/60">{`src/
  app/
    page.tsx                  # UI principal (tabs)
    api/rag/
      ingest/route.ts
      documents/route.ts
      documents/[id]/route.ts
      chat/route.ts
      evaluate/route.ts
      collections/route.ts
      seed/route.ts
      stats/route.ts
  components/
    rag/
      chat-panel.tsx
      citations-list.tsx
      documents-panel.tsx
      ingest-panel.tsx
      evaluation-panel.tsx
      architecture-panel.tsx
      filters-sidebar.tsx
      store.ts                # Zustand chat store
  lib/
    db.ts                     # Prisma client
    rag-client.ts            # API client
    rag/
      types.ts               # interfaces proveedores
      utils.ts               # tokenize, hash, cosine
      embeddings.ts          # TF-IDF hash Embedder
      bm25.ts                # Okapi BM25
      vector-store.ts        # in-memory + loadFromDb
      chunker.ts             # legal/table/semantic
      retriever.ts           # hybrid + MMR
      reranker.ts            # cross-encoder simulado
      llm.ts                 # z-ai-web-dev-sdk + local
      prompts.ts             # prompts versionados
      generator.ts           # orquestador + citas
      ingester.ts            # pipeline ingesta
      evaluator.ts           # RAGAS-like
      sample-data.ts         # dataset ficticio DEMO
      init.ts                # carga perezosa
prisma/schema.prisma
Caddyfile
docker-compose.yml (prod)`}</pre>
          </CardContent>
        </Card>
      </div>

      {/* Analíticas del sistema en vivo */}
      <div className="grid lg:grid-cols-2 gap-4">
        <PageDistributionCard />
        <ChunkDistributionInline />
      </div>

      {/* Heatmap de densidad documento × página */}
      <HeatmapCard />

      {/* Radar de métricas por tipo */}
      <MetricsRadarCard />

      {/* Stack tecnológico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="size-4 text-primary" />
            Stack tecnológico (mandatorio + sustituible)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              ['Lenguaje', 'TypeScript 5 (Next.js 16)'],
              ['Framework RAG', 'Modular TS (interfaces LangChain-style)'],
              ['Vector DB', 'In-memory (→ ChromaDB / Pinecone)'],
              ['BM25', 'Okapi en memoria'],
              ['LLM comercial', 'z-ai-web-dev-sdk (→ OpenAI/Anthropic)'],
              ['LLM local', 'LocalLLMProvider extractivo (→ Ollama)'],
              ['Embeddings', 'TF-IDF hash 1024 (→ BGE-M3 / multilingual-e5)'],
              ['Reranker', 'Co-ocurrencia (→ Cohere Rerank / BGE reranker)'],
              ['Chunking', 'Jerárquico legal/table-aware'],
              ['OCR (PDFs escaneados)', 'Interfaz DocumentParser (PyMuPDF/Tesseract)'],
              ['API', 'Next.js API Routes (sustituye FastAPI)'],
              ['UI', 'Next.js + shadcn/ui (sustituye Streamlit)'],
              ['DB', 'Prisma + SQLite (metadata/logs)'],
              ['Evaluación', 'RAGAS-like con LLM juez'],
              ['Despliegue', 'Next.js prod (→ Docker compose)'],
              ['Tema', 'next-themes (claro/oscuro)'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2 p-2 rounded border border-border/60 bg-card text-xs">
                <span className="font-medium">{k}</span>
                <Badge variant="secondary" className="text-[10px] text-right justify-end">{v}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Criterios de aceptación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            Criterios de aceptación vs implementación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            {[
              ['Respuestas con citas exactas (doc, pág, sección)', true],
              ['Anti-alucinación: declara "sin evidencia" si no hay', true],
              ['Citas incluyen documento, página y sección/cláusula/artículo', true],
              ['Soporta PDFs escaneados (interfaz OCR lista)', 'partial'],
              ['Tablas complejas (balances) preservadas como TABLE chunks', true],
              ['Alterna ChromaDB/Pinecone (interfaz VectorStore)', true],
              ['Alterna LLM comercial / Ollama (interfaz LLMProvider)', true],
              ['Evaluación supera umbrales mínimos', 'pending-eval'],
              ['Chat con cientos de docs sin degradar precisión', 'architected'],
              ['Indexación incremental (idempotente por hash)', true],
              ['Versionado de normativas (vigente/derogado/borrador)', true],
              ['Filtros por metadatos (tipo, jurisdicción, entidad, período)', true],
              ['Multi-query + reranking + MMR', true],
              ['Logs y trazabilidad de consultas', true],
              ['Modo local/offline para documentos confidenciales', true],
              ['README + .env.example + docker-compose', 'partial'],
            ].map(([label, status], i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-border/60 bg-card">
                {status === true ? (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 bg-emerald-500/10 text-[10px]">✓ OK</Badge>
                ) : status === 'partial' ? (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10 text-[10px]">≈ parcial</Badge>
                ) : status === 'pending-eval' ? (
                  <Badge variant="outline" className="text-blue-600 border-blue-500/30 bg-blue-500/10 text-[10px]">◆ ejecuta eval</Badge>
                ) : (
                  <Badge variant="outline" className="text-violet-600 border-violet-500/30 bg-violet-500/10 text-[10px]">◇ arquitectura</Badge>
                )}
                <span>{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FlowLayer({
  color,
  title,
  icon,
  items,
}: {
  color: 'emerald' | 'blue' | 'violet' | 'amber' | 'rose';
  title: string;
  icon: React.ReactNode;
  items: { icon: React.ReactNode; label: string; note: string }[];
}) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
    blue: 'border-blue-500/40 bg-blue-500/5',
    violet: 'border-violet-500/40 bg-violet-500/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    rose: 'border-rose-500/40 bg-rose-500/5',
  };
  const iconColor: Record<string, string> = {
    emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/15',
    blue: 'text-blue-600 dark:text-blue-300 bg-blue-500/15',
    violet: 'text-violet-600 dark:text-violet-300 bg-violet-500/15',
    amber: 'text-amber-600 dark:text-amber-300 bg-amber-500/15',
    rose: 'text-rose-600 dark:text-rose-300 bg-rose-500/15',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`size-7 rounded-full flex items-center justify-center ${iconColor[color]}`}>
          {icon}
        </div>
        <span className="font-medium text-sm">{title}</span>
      </div>
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={i} className="rounded border border-border/60 bg-card p-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              {it.icon}
              {it.label}
            </div>
            <p className="text-muted-foreground mt-1 leading-snug">{it.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center">
      <ArrowRight className="size-5 text-muted-foreground rotate-90" />
    </div>
  );
}

function Decision({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-l-2 border-primary/30 pl-3">
      <p className="font-medium text-foreground">{q}</p>
      <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{a}</p>
    </div>
  );
}

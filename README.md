# Sistema RAG Documental

Sistema RAG (Retrieval-Augmented Generation) para chatear con balances contables, contratos legales y normativas vigentes. Obtiene respuestas precisas con citas verificables: documento, página, sección y fragmento textual.

## Características

- **7 pestañas**: Dashboard, Chat, Documentos, Ingesta, Historial, Evaluación, Arquitectura
- **Anti-alucinación**: responde solo con el contexto recuperado; si no hay evidencia, lo declara
- **Citas verificables**: documento, página, sección/cláusula, chunk, snippet, score
- **Recuperación híbrida**: BM25 + similitud vectorial + MMR + reranking
- **Chunking legal-aware**: por artículo/cláusula/sección + table-aware
- **Evaluación RAGAS-like**: faithfulness, answer relevancy, precision/recall, citation accuracy
- **5 proveedores LLM**: ZAI SDK, servidor local, router híbrido, Ollama, API externa
- **Modo air-gapped**: bloquea tráfico saliente, solo providers locales
- **Comando de voz** (speech-to-text) y **TTS** (text-to-speech) nativos del browser
- **Tour de onboarding**, atajos de teclado, favoritos/tags, búsqueda full-text y semántica

## Instalación con npm

### Requisitos previos

- **Node.js 18+** (recomendado 20+): https://nodejs.org
- **npm 9+** (incluido con Node.js)

### Paso 1: Instalar dependencias

```bash
# En la raíz del proyecto
npm install

# En los mini-servicios
cd mini-services/llm-local
npm install
cd ../llm-hybrid
npm install
cd ../..
```

### Paso 2: Configurar base de datos

```bash
# Crear archivo .env
echo "DATABASE_URL=file:./db/custom.db" > .env

# Sincronizar schema
npm run db:push
```

### Paso 3: Arrancar (3 terminales)

**Terminal 1 — App principal (puerto 3000):**
```bash
npm run dev
```

**Terminal 2 — Servidor LLM local (puerto 3031):**
```bash
cd mini-services/llm-local
npm run dev
```

**Terminal 3 — Router híbrido (puerto 3032):**
```bash
cd mini-services/llm-hybrid
npm run dev
```

### Paso 4: Abrir en el navegador

```
http://localhost:3000
```

## Instalación con Bun (alternativa)

Si prefieres Bun (más rápido):
```bash
curl -fsSL https://bun.sh/install | bash
bun install
cd mini-services/llm-local && bun install && cd ../..
cd mini-services/llm-hybrid && bun install && cd ../..
bun run dev
```

## Estructura del proyecto

```
├── src/
│   ├── app/                    # Páginas y API routes (Next.js 16)
│   │   ├── page.tsx            # Página principal (7 tabs)
│   │   └── api/rag/            # 15+ endpoints API
│   ├── components/rag/         # 40+ componentes UI
│   └── lib/rag/               # Núcleo RAG
│       ├── types.ts            # Interfaces (Embedder, VectorStore, LLMProvider)
│       ├── embeddings.ts       # TF-IDF hash (sustituible por BGE-M3)
│       ├── bm25.ts             # Okapi BM25
│       ├── chunker.ts          # Legal-aware + table-aware
│       ├── retriever.ts        # Híbrido + MMR + multi-query
│       ├── reranker.ts         # Cross-encoder simulado
│       ├── generator.ts        # Orquestador + citas
│       ├── llm.ts              # 5 providers (ZAI, Ollama, API, local, hybrid)
│       └── airgapped.ts        # Modo air-gapped
├── mini-services/
│   ├── llm-local/              # Servidor LLM (puerto 3031)
│   └── llm-hybrid/             # Router híbrido (puerto 3032)
├── prisma/schema.prisma        # Schema de DB
├── docker-compose.airgapped.yml
└── .env.airgapped
```

## Comandos

```bash
npm run dev          # Arrancar app (puerto 3000)
npm run lint         # Verificar código
npm run db:push      # Sincronizar schema
npm run db:reset     # Resetear DB
npm run build        # Build de producción
npm run start        # Arrancar en producción
```

## Despliegue air-gapped

```bash
docker compose -f docker-compose.airgapped.yml --env-file .env.airgapped up -d
```

Ver [docker-compose.airgapped.yml](docker-compose.airgapped.yml) para detalles.

## Licencia

MIT

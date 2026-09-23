# Worklog — Sistema RAG Documental (Next.js)

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Diseñar arquitectura end-to-end del sistema RAG documental y documentar decisiones técnicas

Work Log:
- Análisis del entorno: proyecto Next.js 16 + App Router + shadcn/ui + Prisma (SQLite) + z-ai-web-dev-sdk (LLM/VLM) ya disponibles.
- Decisión de stack (adaptación de los requisitos Python → TypeScript/Next.js, manteniendo el espíritu del sistema RAG):
  - Framework RAG: **LangChain-style modular** implementado en TypeScript puro. Se justifica frente a LlamaIndex porque el ecosistema de skills disponibles (z-ai-web-dev-sdk LLM/VLM) y la base Next.js son TS-first; usar LangChain/LlamaIndex Python obligaría a un microservicio extra y a traducir todo el I/O. El modular TS permite swap fácil a LangChain.js en el futuro.
  - Base vectorial: **ChromaDB-like local en memoria** (con persistencia en SQLite vía Prisma). Justificación: desarrollo/local sin dependencias externas. La interfaz `VectorStore` permite intercambiar por Pinecone/Chroma real sin tocar la lógica.
  - LLM: **z-ai-web-dev-sdk** (comercial equivalente a OpenAI/Anthropic). Arquitectura preparada para Ollama local (interfaz `LLMProvider`).
  - Embeddings: **TF-IDF hashing multilingüe** (1280-dim) por defecto, con interfaz `Embedder` lista para conectar BGE-M3 / multilingual-e5 / OpenAI text-embedding-3-large.
  - OCR/extracción PDF: parser de texto estructurado para la demo + interfaz `DocumentParser` para conectar PyMuPDF/pdfplumber/Unstructured vía microservicio Python si se requiere OCR real de PDFs escaneados.
  - Reranking: **cross-encoder simulado** (reranker por co-ocurrencia de términos + penalización por longitud) con interfaz para conectar Cohere Rerank / BGE reranker.
  - API/UI: **Next.js API routes** (sustituto de FastAPI) + **UI Next.js/shadcn** (sustituto de Streamlit/Gradio).
  - Evaluación: **RAGAS-like** implementado: faithfulness, answer relevancy, context precision, citation accuracy (usando el LLM como juez).
- Arquitectura de capas:
  1. **Ingesta** → DocumentParser → Chunker (legal/table/semantic) → Embedder → VectorStore + SQLite metadata
  2. **Recuperación** → HybridRetriever (BM25 ⊕ dense) → MetadataFilter → MMR → Reranker
  3. **Generación** → CitationPromptBuilder → LLM → CitationParser → respuesta estructurada
  4. **API** → /api/rag/{ingest,documents,chat,evaluate,collections,seed,stats}
  5. **UI** → Chat + Documents + Ingest + Evaluation + Architecture (tabs en página única `/`)
- Estructura de repositorio propuesta:
  ```
  src/
    app/
      page.tsx                    # UI principal (tabs)
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
      rag/                        # componentes UI del RAG
    lib/
      db.ts
      rag/
        types.ts
        embeddings.ts
        bm25.ts
        vector-store.ts
        chunker.ts
        retriever.ts
        reranker.ts
        generator.ts
        ingester.ts
        prompts.ts
        sample-data.ts
        evaluator.ts
  prisma/schema.prisma
  ```

Stage Summary:
- Stack y arquitectura definidos. Justificación documentada.
- Próximos pasos: actualizar `prisma/schema.prisma`, implementar núcleo RAG en `src/lib/rag/*`, dataset ficticio, API routes, UI.
- Principio anti-alucinación: el prompt del sistema instruye responder SÓLO con el contexto recuperado; si no hay evidencia suficiente, declararlo explícitamente. Citas verificables obligatorias.

---
Task ID: 2-8
Agent: main (Z.ai Code)
Task: Implementar núcleo RAG, dataset, API, UI, y verificación end-to-end

Work Log:
- Schema Prisma: Collection, Document, Chunk (con embedding JSON + metadata), EvaluationQuestion, QueryLog, EvaluationRun. db:push OK.
- Núcleo RAG en src/lib/rag/:
  - types.ts: interfaces proveedores (Embedder, VectorStore, LLMProvider, Reranker)
  - utils.ts: tokenize multilingüe (ES/EN + legales), hashToken FNV-1a, cosineSim, detectChunkType, extractClauseRef
  - embeddings.ts: TF-IDF hash 1024-dim, L2-normalizado (sustituible por BGE-M3 / multilingual-e5)
  - bm25.ts: Okapi BM25 con k1=1.5, b=0.75, IDF suavizado
  - chunker.ts: chunking jerárquico + legal-aware (art/cláusula/sección) + table-aware (tablas con |) + parent-child (ventana de contexto)
  - vector-store.ts: in-memory con filtros por metadatos + loadStoreFromDb
  - reranker.ts: cross-encoder simulado (co-ocurrencia + densidad + cobertura + type bonus + embedding sim) + MMR
  - retriever.ts: híbrido BM25 ⊕ vector (α=0.55) + multi-query + MMR (λ=0.7) + hasEnoughEvidence
  - llm.ts: ZaiLLMProvider (z-ai-web-dev-sdk) + LocalLLMProvider (modo offline extractivo)
  - prompts.ts: SYSTEM_PROMPT_V1 anti-alucinación + buildContextBlock + parseCitationIds
  - generator.ts: orquesta retrieve → prompt → LLM → citas + confianza + warnings + persistQueryLog
  - ingester.ts: ingestDocument (idempotente por hash), deleteDocument, softDeleteDocument, reindexInMemory
  - evaluator.ts: runEvaluation RAGAS-like (faithfulness, answer relevancy, context precision/recall, citation accuracy) con LLM juez
  - sample-data.ts: 3 docs ficticios DEMO (balance, contrato, normativa Ley 25.326) + 13 preguntas de evaluación (1 out-of-corpus)
  - init.ts: ensureInitialized carga perezosa + auto-seed si DB vacía
- API routes en src/app/api/rag/: ingest, documents, documents/[id], chat, evaluate, collections, seed, stats
- UI en src/components/rag/: theme-provider, theme-toggle, badges (DocType/Status/ChunkType/Confidence), store (Zustand chat), citations-list, chat-panel, documents-panel, ingest-panel, evaluation-panel, architecture-panel, stats-sidebar
- Página src/app/page.tsx: tabs (Chat/Documentos/Ingesta/Evaluación/Arquitectura) + header sticky + footer sticky + sidebar stats/filtros
- Layout actualizado con ThemeProvider + metadata SEO
- globals.css: scrollbar custom, gradient, glow, quote-bar, mono para citas

Verificación con agent-browser:
- GET / renderiza OK (no blank screen, no hydration errors)
- Stats API: 3 documentos, 17 chunks, 3 colecciones en memoria
- Chat: pregunta sobre activo total → respuesta correcta ($118.500 miles ARS) con 6 citas (doc, pág, sección, snippet, score)
- Anti-alucinación: pregunta out-of-corpus (cotización dólar) → "No se encontró información suficiente en los documentos proporcionados"
- Pestaña Documentos: 3 cards con badges (tipo, estado, jurisdicción, entidad, período, colección) + acciones (ver detalle, usar como filtro, eliminar)
- Pestaña Arquitectura: diagrama de flujo 5 capas + decisiones técnicas + estructura repo + stack + criterios aceptación
- Pestaña Evaluación: corrida exitosa, métricas mostradas (faithfulness 87%, relevancy 91%, precision 100%, recall 68%, citation 92%)
- Footer sticky: scrollHeight=900=viewportHeight, footerVisible=true
- Ingesta incremental: nuevo doc ingestado en 12ms, inmediatamente recuperable
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime

Stage Summary:
- Sistema RAG end-to-end funcional y verificado en navegador.
- Anti-alucinación operativa (2 capas: threshold de score + prompt del sistema + fallback "sin evidencia").
- Citas verificables completas: documento, página, sección/cláusula, chunk, snippet, score, jurisdicción, entidad, período, versión, estado.
- Métricas de evaluación superan umbrales mínimos (faithfulness 87%, citation accuracy 92%).
- Arquitectura modular: todas las piezas (Embedder, VectorStore, LLMProvider, Reranker) son interfaces sustituibles por ChromaDB/Pinecone, BGE-M3, Ollama, Cohere Rerank sin tocar lógica.
- Próximos pasos sugeridos: OCR real de PDFs escaneados vía microservicio Python (PyMuPDF/Tesseract); conectar embeddings neuronales reales; añadir autenticación (NextAuth disponible); docker-compose para producción.

---
Task ID: 9 (cron-review-1)
Agent: main (Z.ai Code)
Task: QA con agent-browser + VLM, mejorar styling, añadir features (historial, exportar, chart, visor de fragmentos)

Work Log:
- QA inicial con agent-browser: 5 tabs presentes, footer sticky (scrollHeight=900=viewport), sin errores.
- VLM (z-ai vision) analizó screenshots en modo oscuro y arquitectura:
  - Issue: contraste bajo en footer y sidebar dark (muted-foreground oklch 0.708 demasiado tenue)
  - Issue: asimetría de grilla en capa de Recuperación (Reranker wrap a 2da fila)
  - Issue: toggles con estado ambiguo, placeholder poco legible
- Mejoras de styling (globals.css):
  - Dark mode muted-foreground: oklch(0.708 → 0.78) — mejor contraste WCAG
  - Dark mode border: 10% → 16% (separación más visible)
  - Dark mode input: 15% → 22% (mejor contraste de campos)
  - Light mode muted-foreground: 0.556 → 0.48 (más legible)
  - Añadido `:focus-visible` global con outline-2 + offset-2
  - Scrollbar global unificada (10px, color-mix con muted-foreground)
  - `@media (prefers-reduced-motion: reduce)` para accesibilidad
  - Forzado recompilación CSS con comentario (Turbopack cache) → valores ahora live: lab(74.48%) = oklch(0.78) ✓

- Nuevas features implementadas:
  1. **Pestaña Historial** (nueva tab, 6 tabs total):
     - API /api/rag/history (GET con búsqueda q= y filtro docType, DELETE para limpiar)
     - Panel con stats (total, con evidencia, sin evidencia, latencia media)
     - Búsqueda con debounce 350ms
     - Filtro por tipo de documento
     - Cards colapsables con respuesta, warnings, documento citado
     - Acciones: "Ver completo" (modal con respuesta + metadatos) y "Reenviar en chat"
  2. **Exportar conversación** (botón en header del chat):
     - Dropdown con Markdown (.md) y JSON estructurado
     - Markdown: frontmatter YAML + mensajes con citas formateadas (📄📋📍🌍🏢📅🏷️⭐📝)
     - JSON: estructura tipada con metadatos, citas, timestamps
     - Util downloadFile() con Blob + URL.createObjectURL
  3. **Gráfico de tendencia de métricas** (recharts, en pestaña Evaluación):
     - ComposedChart con 5 líneas (una por métrica RAGAS)
     - Tooltip con fecha/hora de cada corrida
     - Legend con colores diferenciados
     - Tarjetas de delta (▲▼ vs primera corrida)
     - Gradient defs por métrica
     - Verificado: 5 líneas, 10 dots (2 corridas × 5 métricas)
  4. **Visor de fragmento completo** (modal al clic en "Ver completo" de una cita):
     - API /api/rag/chunks/[id] devuelve chunk + document + tableData
     - Modal con badges (tipo, orden, tokens, tabla estructurada)
     - Si el chunk es una tabla: renderiza <Table> con headers + rows (preserva estructura)
     - Si es texto: <pre> con highlight del snippet (<mark> con bg-primary/25)
     - Patrón con key=chunkId para reset limpio de estado (evita setState en effect)
  5. **Botones toggle rediseñados** (Modo local, Multi-query):
     - Reemplazado Switch por button con aria-pressed
     - Indicador visual claro: punto de color + bg tintado cuando ON
     - Color semántico: emerald para local, violet para multi-query
  6. **Botón copiar respuesta** en cada mensaje del asistente
     - Feedback "Copiado" con check por 1.5s
  7. **Badge de contador de mensajes** en header del chat
  8. **Fix grilla arquitectura**: lg:grid-cols-3 → lg:grid-cols-4 para evitar wrap del Reranker

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores
- 6 tabs operativas (Chat, Documentos, Ingesta, Historial, Evaluación, Arquitectura)
- Historial: 18 consultas registradas, búsqueda y filtros funcionando
- Chart de tendencia: 2 corridas, 5 líneas, 10 puntos, deltas calculados
- Visor de fragmento: modal carga chunk completo, tablas estructuradas renderizadas
- Dark mode: muted-foreground lab(74.48%) = oklch(0.78) ✓ aplicado (verificado con getComputedStyle)
- Footer sticky mantenido (scrollHeight = viewportHeight)

Stage Summary:
- Sistema RAG con 6 pestañas, todas funcionales.
- 4 features nuevas de alto valor añadidas (historial, exportar, chart, visor).
- Contraste WCAG AA mejorado en modo oscuro.
- Accesibilidad: focus-visible global, aria-pressed, aria-label, prefers-reduced-motion.
- Anti-patrón setState-en-effect eliminado con patrón key=.
- Próximos pasos sugeridos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3), autenticación NextAuth, comparar chunks lado a lado con diff, highlight del snippet en documento completo, gráfico de distribución de tipos de chunk por documento.

---
Task ID: 10 (cron-review-2)
Agent: main (Z.ai Code)
Task: QA + nuevas features (visor de documento con highlight, chart de distribución, atajos de teclado, transiciones)

Work Log:
- QA inicial: 6 tabs, footer sticky, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Visor de documento completo con highlight del snippet** (document-reader.tsx):
     - Modal que muestra el texto crudo del documento + chunks indexados
     - Botón "En documento" en cada cita (además de "Fragmento" y "Copiar")
     - Navegación entre chunks (Anterior/Siguiente #N/M) con auto-scroll y ring highlight
     - **Highlight del snippet en el texto completo** con `<mark bg-primary/25>`
     - Algoritmo robusto de matching: normalizeForMatch() quita acentos/puntuación/pipes,
       buildNormToOrigMap() mapea posiciones normalizadas→originales
     - Estrategia en 2 niveles: (1) fingerprint exacto de 40 chars, (2) fallback n-gramas
       de 3 palabras sin stopwords, merge de highlights solapados
     - Verificado: mark con "Caja y bancos | 12.500 | 8.200" resaltado en contexto ✓
     - Header con metadatos (tipo, estado, jurisdicción, entidad, período, versión, #chunks, #págs)
     - Lista de chunks clickeable al final con badge de tipo + preview de contenido

  2. **Gráfico de distribución de tipos de chunk** (chunk-distribution-card.tsx):
     - API /api/rag/analytics: distribución por tipo, per-document, tokenStats, pageDistribution
     - Donut chart (PieChart innerRadius=45) con 7 tipos coloreados (Article violet, Clause amber,
       Section blue, Table emerald, Heading slate, Footnote pink, Text gray)
     - Bar chart apilado horizontal 100% (stackOffset="expand") por documento
     - Badges de estadísticas: total chunks, total tokens, avg/min/max
     - Tooltip con % y tokens por tipo
     - Verificado: 5 sectores donut, 28 barras apiladas ✓
     - VLM: "calidad visual excelente, estética SaaS dashboard moderna"
     - Integrado como sección colapsable "Analíticas de fragmentos" en pestaña Documentos

  3. **Atajos de teclado** (keyboard-shortcuts.tsx):
     - Hook useKeyboardShortcuts() con handler onSearch/onGoToTab
     - Cmd/Ctrl+K → foco en input de chat/búsqueda (funciona dentro de inputs)
     - "/" → foco en chat input (solo cuando no se está escribiendo)
     - "g" + letra → navegar tabs (g c=chat, g d=docs, g i=ingest, g h=history, g e=eval, g a=arch)
     - "?" o Shift+/ → toggle diálogo de ayuda
     - Esc → blur del input activo
     - Diálogo de ayuda con 12 atajos listados con <kbd> estilizado
     - Botón "Atajos" con kbd "?" en header (visible solo md+)
     - Verificado: g+e cambia a Evaluación ✓, diálogo ayuda abre con botón ✓ (13 kbd elements)
     - isTyping() check antes de interceptar (excepto Cmd/Ctrl+K y Esc)

  4. **Animaciones de transición y micro-interacciones** (globals.css):
     - rag-tab-enter: fade + translateY 6px en 0.25s cubic-bezier (aplicado a TabsContent)
     - rag-card-enter: fade + scale 0.98 en 0.3s (para cards)
     - rag-shimmer: gradiente animado para skeletons (background-position 200%)
     - rag-slide-in: para notificaciones
     - rag-bounce-once: para badges de confianza alta
     - rag-highlight-pulse: animación del mark al hacer scroll
     - rag-pulse-soft: pulso sutil para "procesando"
     - Verificado: animationName="rag-tab-enter" en tab activo ✓

  5. **Mejora contraste footer dark mode**:
     - Cambiado text-muted-foreground → text-foreground/70 en footer
     - text-foreground/60 en subtítulo de tecnologías
     - bg-muted/30 → bg-muted/20 (footer más sutil)
     - VLM verificó: "¿texto del footer legible en dark?" → SI ✓

- Refactor page.tsx:
  - Tabs controlado (useState activeTab + onValueChange)
  - tabIndex={-1} en TabsContent para accesibilidad
  - Botón "Atajos" con kbd "?" en header
  - v1.0 → v2.0 (link a arquitectura)

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- VLM light mode: "excelente contraste, jerarquía clara, diseño consistente, sin bugs críticos"
- VLM dark mode: "texto del footer legible" ✓ (tras mejora text-foreground/70)
- VLM analytics chart: "5 sectores coloreados, barras apiladas coherentes, calidad excelente"
- 6 tabs + 1 modal de ayuda + 1 modal de visor de documento + 1 modal de visor de chunk
- Todas las features de rondas anteriores intactas (historial, exportar, chart de tendencia, etc.)

Stage Summary:
- 3 features nuevas de alto valor: visor de documento con highlight, chart de distribución,
  atajos de teclado completos con diálogo de ayuda.
- Animaciones CSS: tab-enter, card-enter, shimmer, slide-in, bounce, highlight-pulse.
- Contraste WCAG mejorado y verificado por VLM en ambos modos.
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, comparar chunks lado a lado con diff visual, gráfico de
  distribución de tokens por página, exportar evaluación a CSV, modo colaborativo con websocket.

---
Task ID: 11 (cron-review-3)
Agent: main (Z.ai Code)
Task: QA + comparación de chunks con diff, exportar evaluación a CSV, gráfico de distribución por página

Work Log:
- QA inicial: 6 tabs, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Comparación de chunks con diff visual** (chunk-compare.tsx):
     - API /api/rag/compare?ids=... (hasta 4 chunks)
     - Modal con diff línea por línea usando algoritmo **LCS (Longest Common Subsequence)**
     - Filas diff: verde (added) con icono +, rojo (removed) con icono -, gris (equal)
     - Headers de cada chunk con badges (tipo doc, tipo chunk, página, sección, tokens, estado)
     - Estadísticas: líneas iguales/eliminadas/añadidas + barra de similitud con %
     - Barra de similitud coloreada: verde (≥75%), ámbar (≥50%), roja (<50%)
     - MultiCompare para 3-4 chunks: vista lado a lado con tablas estructuradas si apply
     - ChunkCompareSelector: lista con checkboxes (max 4), botón "Comparar (N)"
     - Integrado en panel de Documentos (detalle de documento con ≥2 chunks)
     - Patrón: al comparar, cierra el dialog de detalle para evitar solapamiento Radix
     - Verificado: 22 filas diff, barra similitud 0% (chunks muy diferentes), VLM confirma ✓
     - VLM: "diseño oscuro moderno, buena jerarquía tipográfica, contraste adecuado, layout profesional"

  2. **Exportar evaluación a CSV** (eval-export API + botones):
     - API /api/rag/eval-export?runId=... (sin runId = última corrida)
     - CSV con sección de resumen (runId, fecha, preguntas, 5 métricas) + detalle por pregunta
     - Escaping CSV correcto (comillas, comas, saltos de línea)
     - Content-Disposition: attachment con filename timestamped
     - Botón global "Exportar última (CSV)" en header del historial
     - Botón por corrida (icon download, visible en hover con group-hover)
     - Verificado: 1 botón global + 3 botones por corrida ✓
     - CSV descarga correctamente con 13 preguntas y 5 métricas

  3. **Gráfico de distribución por página** (page-distribution-card.tsx):
     - Reutiliza API /api/rag/analytics (pageDistribution)
     - AreaChart con gradiente (primary color, 40% → 0% opacity)
     - Datos: "Pág. N" en X, count de chunks en Y
     - Badges: total páginas, total chunks, avg por página
     - 3 tarjetas de stats: página más densa, promedio, total
     - Integrado en panel de Arquitectura (sección "Analíticas del sistema en vivo")
     - Grid lg:grid-cols-2 con PageDistributionCard + ChunkDistributionCard
     - Verificado: areaChart renderizado ✓

- Mejoras de styling:
  - group-hover opacity transition en botones de exportar por corrida
  - Tooltip "Exportar esta corrida a CSV" en botones per-run
  - Flex-wrap en headers de cards para responsividad
  - Clase `group` en cards de historial para hover effects

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- APIs: stats 200, analytics 200, history 200, compare 200, eval-export 200
- Compare modal: 22 filas diff, barra similitud, VLM confirma "calidad excelente"
- Export CSV: botón global + 3 por corrida, CSV con resumen + detalle de 13 preguntas
- Page chart: areaChart renderizado en Arquitectura
- Todas las features previas intactas (6 tabs, historial, exportar conv, chart tendencia,
  visor documento con highlight, visor chunk, atajos teclado, etc.)

Stage Summary:
- 3 features nuevas de alto valor: diff visual LCS, export CSV de evaluación, chart por página.
- Algoritmo LCS implementado en cliente (O(m×n) DP) con 3 tipos de línea diff.
- CSV export con escaping correcto y Content-Disposition attachment.
- Charts recharts: AreaChart (gradiente) + PieChart (donut) + BarChart (apilado 100%).
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, modo colaborativo con websocket, gráfico de heatmap de tokens
  por página×documento, comparación de respuestas de 2 LLMs lado a lado, sugerencias de
  preguntas similares, tags/favoritos en documentos.

---
Task ID: 12 (cron-review-4)
Agent: main (Z.ai Code)
Task: QA + comparación A/B de LLMs, sugerencias de preguntas similares, heatmap de densidad

Work Log:
- QA inicial: 6 tabs, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Comparación A/B de LLMs (comercial vs local)** (ab-compare-modal.tsx):
     - API /api/rag/compare-llm: POST {question} → ejecuta recuperación híbrida una vez,
       genera respuesta en paralelo con ZaiLLMProvider (comercial) y LocalLLMProvider (extractivo)
     - Jaccard similarity entre las 2 respuestas (word overlap, sin stopwords)
     - Modal con: barra de similitud animada (verde/ámbar/roja según %), 2 cards lado a lado
     - Cada card: badge confianza, latencia, #citas, warnings, respuesta en pre mono
     - Citas colapsables (details/summary) con doc, página, sección, score
     - Botón "A/B" en header del chat (usa input actual o última pregunta del usuario)
     - Patrón keyed (useLastValue) para auto-trigger sin setState en effect
     - Verificado: dialog abre, similitud 20.2%, latencia 9694ms (comercial) vs 5ms (local), 6 citas cada una
     - VLM: "dos columnas paralelas, barra de similitud prominente, métricas detalladas, calidad excelente y profesional"

  2. **Sugerencias de preguntas similares** (suggestion-dropdown.tsx):
     - API /api/rag/suggest?q=...: combina historial (top 20 únicas con frecuencia) + 17 templates
       por tipo (BALANCE/CONTRACT/REGULATION), similitud Jaccard, hasta 8 sugerencias
     - Dropdown flotante sobre el textarea (absolute bottom-full), visible cuando input ≥ 3 chars
       y textarea tiene foco
     - Debounce 150ms, patrón keyed (key={query.trim()}) para reset limpio
     - Navegación keyboard: ↑↓ resaltar, Enter seleccionar, Esc cerrar
     - Iconos: History (historial) vs Lightbulb amber (template)
     - Badges: ×N frecuencia, tipo de documento
     - Footer: "↑↓ navegar · Enter seleccionar · Esc cerrar"
     - Verificado: 3 sugerencias para "activo" (score 1.00), dropdown visible ✓

  3. **Heatmap de densidad documento × página** (heatmap-card.tsx):
     - API /api/rag/heatmap: por documento, agrupa chunks por página con count + tokens + tipos
     - Heatmap grid: filas=documentos, columnas=páginas, celdas coloreadas por tipo dominante
     - Intensidad por opacity (0.3 + intensity*0.7), normalizado por maxPerPage
     - Tooltip por celda: página, #fragmentos, tokens, desglose por tipo
     - Leyenda: 7 tipos con colores (Article violet, Clause amber, Section blue, Table emerald,
       Heading slate, Footnote pink, Text gray) + escala densidad baja→alta
     - Columna total a la derecha con #chunks por documento
     - Integrado en Arquitectura entre analytics cards y stack tecnológico
     - Verificado: 17 celdas, VLM confirma "celdas coloreadas por página, leyenda completa, calidad excelente"

- Mejoras de styling:
  - AnimatePresence + motion.div en suggestion dropdown (fade + translateY)
  - Barra de similitud animada con transition-all duration-700
  - Details/summary colapsable para citas en A/B cards
  - Color semántico: violet para comercial, emerald para local
  - Hover scale-110 + z-10 en celdas del heatmap

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- APIs: stats 200, analytics 200, history 200, compare 200, eval-export 200,
  compare-llm 200, suggest 200, heatmap 200 (8 endpoints)
- A/B modal: 2 columnas, similitud 20.2%, latencia 9694ms vs 5ms, 6+6 citas
- Suggest: 3 sugerencias para "activo" (score 1.00), dropdown visible, keyboard nav
- Heatmap: 17 celdas coloreadas, leyenda 7 tipos, tooltip por celda
- Todas las features previas intactas (6 tabs, 5 modales, diff LCS, export CSV, etc.)

Stage Summary:
- 3 features nuevas de alto valor: A/B LLM comparison, sugerencias autocomplete, heatmap.
- Algoritmos: Jaccard similarity (2 usos), LCS DP, n-gramas, normalizeForMatch.
- APIs: 8 endpoints en /api/rag/ (stats, documents, documents/[id], chunks/[id], chat,
  evaluate, collections, seed, ingest, history, compare, eval-export, compare-llm, suggest, heatmap).
- VLM verificó las 3 features: "calidad excelente y profesional" en todas.
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, modo colaborativo con websocket, comparación de 2 chunks lado a lado
  con diff de tokens (no líneas), favoritos/tags en documentos, búsqueda semántica en raw text,
  exportar heatmap a PNG, gráfico radar de métricas por tipo de documento.

---
Task ID: 13 (cron-review-5)
Agent: main (Z.ai Code)
Task: QA + radar de métricas por tipo, favoritos/tags en documentos, búsqueda full-text

Work Log:
- QA inicial: 6 tabs, lint limpio, APIs 200, sin errores. Sistema estable.
- Schema Prisma: añadidos campos `favorite Boolean @default(false)` y `tags String @default("[]")` + index en favorite. db:push OK.

- Nuevas features implementadas:

  1. **Gráfico radar de métricas por tipo** (metrics-radar-card.tsx):
     - API /api/rag/metrics-by-type: agrupa documentos por tipo, calcula 5 dimensiones
       (documentos, chunks, tokens, páginas, densidad), normaliza 0-100 por dimensión
     - RadarChart con PolarGrid + PolarAngleAxis + PolarRadiusAxis
     - 3 polígonos superpuestos (Balance verde, Contrato amber, Normativa violet)
     - Tooltip con valor normalizado + raw
     - Tabla de valores reales por tipo al lado del chart (docs, chunks, tokens, páginas, avg)
     - Badges totales: #docs, #chunks, #tokens, #favoritos
     - Bug inicial: `types.reduce` accedía a `t.raw` undefined (el array mapeado era `radar`, no `types`). Corregido.
     - Verificado: 3 tipos, radar renderizado, VLM confirma "5 ejes, 3 polígonos superpuestos con colores, tabla de valores detallada"
     - Integrado en Arquitectura tras el heatmap

  2. **Favoritos y tags en documentos** (documents-panel.tsx):
     - API /api/rag/documents/[id]/favorite: PATCH toggle (body opcional {favorite?: boolean})
     - API /api/rag/documents/[id]/tags: PATCH {action: 'add'|'remove'|'set', tag} o {tags: []}
     - Botón star en cada DocCard (arriba a la derecha), aria-pressed, fill-current cuando ON
     - Card con borde amber-500/40 + bg amber-500/[0.03] cuando es favorito
     - Tags mostrados como badges violet con icon Tag (hasta 3 visibles)
     - Filtro "Solo favoritos" en barra (botón star que togglea favOnly, bg amber cuando activo)
     - API documents actualizado: devuelve favorite + tags, filtra por favorite=true y tag=...
     - Estado local actualizado optimistamente tras toggle (sin recarga completa)
     - Verificado: 4 botones star en cards + 1 filtro, VLM confirma "borde amarillo destacado, estrella rellena, botones en cada card"

  3. **Búsqueda full-text en texto crudo** (full-text-search-modal.tsx + /api/rag/search):
     - API /api/rag/search?q=...&docType=...&limit=...: SQLite LIKE en rawText, hasta 5 snippets
       con contexto ±80 chars por documento, normalizado whitespace
     - Modal con input + debounce 250ms + autoFocus
     - Resultados: cards con doc title, badges (tipo, entidad, período), #coincidencias
     - Snippets con <mark> highlight del query (case-insensitive)
     - Empty state ilustrado (icon AlertCircle) cuando sin resultados
     - Botón "Buscar" en header con kbd ⌘K
     - Cmd/Ctrl+K fuera del chat abre el modal (dentro del chat foco el textarea)
     - Patrón keyed (SearchLoader se monta solo cuando open) + setLoading dentro de setTimeout
       (evita setState en effect body)
     - Verificado: "patrimonio" → 1 resultado, 7 marks highlight, VLM confirma "input + resultados, términos resaltados, snippets con contexto"

- Mejoras de styling:
  - Color semántico amber para favoritos (border, bg, star fill)
  - Color violet para tags (border, bg, icon Tag)
  - Botón filtro favoritos con bg amber-500 cuando activo
  - kbd ⌘K en botón de búsqueda (hidden en mobile)
  - Empty state con icono AlertCircle grande

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- APIs nuevas: search 200, metrics-by-type 200, favorite 200, tags 200
- Schema: favorite + tags persistidos en SQLite
- Radar: 3 tipos, 5 dimensiones, 3 polígonos, tabla de valores
- Favoritos: toggle funciona, filtro funciona, card destacada, VLM confirma
- Búsqueda full-text: 1 resultado para "patrimonio", 7 highlights, VLM confirma
- Todas las features previas intactas (6 tabs, 6 modales: help, doc reader, chunk viewer,
  chunk compare, A/B LLM, full-text search)

Stage Summary:
- 3 features nuevas de alto valor: radar por tipo, favoritos/tags, búsqueda full-text.
- Schema DB extendido con favorite + tags (con index).
- 4 APIs nuevas: /api/rag/{search, documents/[id]/favorite, documents/[id]/tags, metrics-by-type}.
- Algoritmos: normalización 0-100 por dimensión (radar), SQLite LIKE + snippets ±80 chars,
  highlight case-insensitive con <mark>.
- VLM verificó las 3 features: "calidad excelente" en todas.
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, modo colaborativo con websocket, diff de tokens (no líneas),
  exportar heatmap a PNG, comparación de 2 LLMs con métricas side-by-side, filtrado por tags
  en UI (no solo API), panel de configuración de hiperparámetros RAG (topK, alpha, lambda).

---
Task ID: 14 (cron-review-6)
Agent: main (Z.ai Code)
Task: QA + panel de configuración de hiperparámetros RAG, editor de tags, comando de voz

Work Log:
- QA inicial: 6 tabs, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Panel de configuración de hiperparámetros RAG** (config-panel.tsx + config-store.ts):
     - Zustand store `useRagConfig` con RagConfig (topK, rerankTopK, alpha, mmrLambda, temperature, useReranker, useMultiQuery)
     - DEFAULT_CONFIG: topK=20, rerankTopK=6, alpha=0.55, mmrLambda=0.7, temperature=0.2
     - Sheet lateral (side="right") con 3 secciones:
       a) Recuperación híbrida: 4 sliders (topK 5-50, rerankTopK 3-12, alpha 0-1, lambda 0-1) + 2 switches (reranker, multi-query)
       b) Generación: 1 slider (temperature 0-1)
       c) Configuración actual: tabla mono con todos los valores
     - Cada slider: label + tooltip info + badge valor en vivo + min/max
     - Botón "Restablecer" a defaults
     - Chat panel usa ragConfig del store para las opciones de chatQuery (antes hardcodeadas)
     - Botón "Config" en header del chat
     - Verificado: 5 slider thumbs, 2 switches, 7 labels, 5 badges, VLM confirma "sliders con valores específicos, switches, secciones claras, calidad excelente"

  2. **Editor de tags en diálogo de detalle** (tag-editor.tsx):
     - Componente inline en el header del diálogo de documento
     - Estados: vacío (botón "Añadir tags"), con tags (badges violet + botón +), editando (input + Enter)
     - API updateTags con action add/remove/set
     - Input con Enter para añadir, Esc para terminar, "," como separador
     - Botón X en cada tag para eliminar (solo en modo edición)
     - Estado optimista: actualiza selected + docs list localmente tras cambio
     - Botón star de favorito también en el header del diálogo (además del DocCard)
     - API documents/[id] actualizado para devolver favorite + tags
     - Verificado vía API: add "urgente" → tags ['importante', 'urgente'], VLM confirma "botón estrella amarillo, tags violetas, badges de metadatos"

  3. **Comando de voz (speech-to-text)** para el chat (use-speech-recognition.ts):
     - Hook useSpeechRecognition usando Web Speech API nativa del browser
     - Config: lang='es-ES', continuous=false, interimResults=true
     - Callback onTranscript inserta texto final en el input del chat
     - Estado interim mostrado en vivo ("Escuchando: ...")
     - Detección de soporte sin setState en effect (supported = typeof window check directo)
     - Botón micrófono al lado de Enviar:
       - Ghost cuando idle, destructive (rojo) cuando listening
       - Icon Mic / MicOff
       - aria-pressed
     - Indicador visual: punto rojo pulsante + texto interim mientras escucha
     - Verificado: botón mic presente, soporte detectado

- Mejoras de styling:
  - Sheet lateral con header border-b y secciones separadas
  - Sliders con badge de valor mono + min/max a los lados
  - Tooltip info (icon Info) en cada label con descripción
  - Color semántico: amber reranker, violet multi-query, rose micrófono listening
  - Punto pulsante (rag-pulse-soft) para indicador de escucha
  - Tag editor con badges violet + botón X hover bg violet-500/30

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- Config panel: 5 sliders, 2 switches, 7 labels, 5 badges — VLM confirma "calidad excelente"
- Tag editor: API funciona (add/remove), UI renderiza tags violet + botón añadir
- Speech: botón mic presente, hook detecta soporte del browser
- Todas las features previas intactas (6 tabs, 6 modales + 1 sheet, diff LCS, export CSV, etc.)

Stage Summary:
- 3 features nuevas de alto valor: config panel con sliders, tag editor inline, speech-to-text.
- Zustand store de configuración (no persistente, reset al recargar).
- Web Speech API nativa (sin backend, sin dependencias, soporte browser).
- API documents/[id] extendido con favorite + tags.
- VLM verificó config panel: "diseño oscuro profesional, tipografía clara, iconografía coherente, jerarquía organizada".
- Próximos pasos: persistir config en localStorage, atajo de teclado para abrir config (g c conflict),
  comparación de configs A/B, exportar/importar config JSON, TTS para respuestas del asistente,
  OCR real de PDFs vía microservicio Python, autenticación NextAuth.

---
Task ID: 15 (cron-review-7)
Agent: main (Z.ai Code)
Task: QA + persistencia de config en localStorage, TTS para respuestas, tour de onboarding

Work Log:
- QA inicial: 6 tabs, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Persistencia de config RAG en localStorage + export/import JSON** (config-store.ts):
     - Zustand store con middleware `persist` + `createJSONStorage(() => localStorage)`
     - `partialize`: solo persiste `config` (no las funciones)
     - key: 'rag-config-storage'
     - Función `exportJson()`: serializa config con wrapper {ragConfig, version, exportedAt}
     - Función `importJson(json)`: parsea con validación de campos mínimos + merge con DEFAULT_CONFIG
     - Botones en config panel: "Exportar" (descarga .json timestamped) + "Importar JSON" (file input hidden)
     - Indicador verde pulsante "Configuración persistida en el navegador (localStorage)"
     - Verificado: botones presentes, VLM confirma "Exportar, Importar JSON, indicador localStorage"
     - Actualizado mensaje: antes "Los cambios son locales (no persistentes)" → ahora "Configuración persistida en el navegador"

  2. **TTS (text-to-speech) para respuestas del asistente** (use-text-to-speech.ts):
     - Hook `useTextToSpeech` usando Web Speech API SpeechSynthesis nativa del browser
     - `supported` detectado sin setState en effect (typeof window check directo)
     - Carga de voces con evento 'voiceschanged', selección automática de voz española
     - `speak(text)`: limpia markdown (#, *, `, >, links), rate=1.0, pitch=1.0, lang='es-ES'
     - `stop()`: cancel() + setSpeaking(false)
     - `toggle(text)`: alterna entre speak/stop
     - Componente `SpeakButton` en cada mensaje del asistente (junto a CopyButton)
     - Icon Volume2 (idle) / Square (speaking) + texto "Escuchar" / "Detener"
     - Color primary + rag-pulse-soft cuando hablando
     - Verificado: botón "Escuchar" presente en DOM (visible, display:flex, opacity:1)

  3. **Tour de onboarding interactivo** (onboarding-tour.tsx):
     - 8 pasos con icono, título, descripción y highlight badge
     - Pasos: Bienvenida → Chat anti-alucinación → Documentos → Ingesta → Historial →
       Evaluación → Búsqueda y atajos → Configuración y voz
     - Aparece automáticamente al primer visitante (localStorage key 'rag-onboarding-completed')
     - Delay de 800ms para que cargue la app
     - Header con gradiente (rag-gradient) + icono en círculo con rag-glow
     - Indicadores de progreso: 8 puntos, activo=w-6 bg-primary, pasados=w-1.5 bg-primary/60
     - Contador mono "N/8"
     - Botones: "Saltar tour" (izquierda), "Anterior" (oculto en paso 1), "Siguiente"/"Comenzar" (derecha)
     - Botón "Tour" en header para re-abrir (limpia localStorage + reload)
     - Verificado: tour abre tras clear localStorage, título "Bienvenido al RAG Documental",
       navegación funciona (paso 2/8 "Chat con anti-alucinación"), VLM confirma "icono, título,
       descripción, puntos de progreso, botones anterior/siguiente"

- Mejoras de styling:
  - rag-gradient en header del tour
  - Punto verde pulsante (rag-pulse-soft) para indicador de persistencia localStorage
  - SpeakButton con primary + rag-pulse-soft cuando hablando
  - Indicadores de progreso del tour con animación de width
  - Highlight badge con bg-primary/10 y rounded-full

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- Config persist: export/import funcionan, VLM confirma botones + indicador localStorage
- TTS: botón "Escuchar" presente en DOM (visible, display:flex)
- Tour: 8 pasos, auto-appear tras clear localStorage, navegación funciona
- VLM tour: "icono, título, descripción, puntos de progreso, botones anterior/siguiente"
- Todas las features previas intactas (6 tabs, 7 modales + 1 sheet, diff LCS, export CSV, etc.)

Stage Summary:
- 3 features nuevas de alto valor: config persistente + export/import, TTS para respuestas,
  tour de onboarding interactivo.
- Zustand persist middleware para localStorage (sin setState en effect).
- Web Speech API SpeechSynthesis nativa (TTS) + SpeechRecognition (STT de ronda anterior).
- Tour de 8 pasos con auto-detección de primer visitante via localStorage.
- VLM verificó tour: "calidad excelente, puntos de progreso, navegación".
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, modo colaborativo con websocket, comparación de configs A/B,
  TTS con voces del SDK (no solo browser), panel de dashboard ejecutivo, integración con
  webhooks para ingesta automática.

---
Task ID: 16 (cron-review-8)
Agent: main (Z.ai Code)
Task: QA + dashboard ejecutivo con stats animadas, timeline de actividad, acciones rápidas

Work Log:
- QA inicial: 6 tabs → 7 tabs (nueva tab Dashboard), lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Dashboard ejecutivo** (dashboard-panel.tsx + /api/rag/dashboard):
     - API /api/rag/dashboard: agrega en una sola llamada: stats (totalDocs, activeDocs, totalChunks,
       totalQueries, totalEvals, totalCollections, favDocs, avgConfidence, avgLatency), recentDocs (5),
       recentQueries (8 con confidence/latency/document), recentEvals (3), lastEval, byType, byStatus
     - 4 stat cards animadas con count-up (useAnimatedCounter hook con rAF + easing cubic):
       Documentos (emerald), Fragmentos (blue), Consultas (violet), Confianza media (amber)
     - Cada card: icono en círculo tintado, número grande rag-mono, label, sub-texto
     - Acciones rápidas: "Nueva pregunta" → chat, "Ingerir documento" → ingest, "Ejecutar evaluación" → eval
     - Timeline de actividad reciente: 8 consultas con timeline vertical (puntos verde/amber + línea conectora),
       badge confianza, latencia, tipo documento, "sin evidencia" si aplica, hora
     - Documentos recientes: 5 últimos con icono, título, tipo badge, #chunks, fecha, star si favorito
     - Distribución por tipo: barras de progreso horizontales con colores semánticos y %
     - Última evaluación: card con 5 métricas (faithfulness, relevancy, precision, recall, citation)
       con % grande, Progress bar, botón "Ver detalle" → eval tab
     - Indicador "Actualizado ahora" con punto verde pulsante
     - Integrado como PRIMERA tab (grid-cols-4 mobile / grid-cols-7 desktop)
     - Verificado: API 200, 7 tabs, Dashboard activo por defecto, VLM confirma "4 stat cards con números,
       timeline de actividad, botones de acciones rápidas, distribución por tipo con barras"
     - VLM: "calidad visual alta y profesional, diseño limpio, buena jerarquía, paleta coherente"

  2. **Hook de contador animado** (use-animated-counter.ts):
     - useAnimatedCounter(target, duration=800): count-up con requestAnimationFrame
     - Easing: cubic-bezier(0.16, 1, 0.3, 1) aproximado (1 - (1-p)³)
     - Si target=0, no animar (return directo, sin setState en effect)
     - Cancela rAF en cleanup
     - Usado en las 4 stat cards del dashboard

  3. **Timeline de actividad reciente** (dentro de dashboard):
     - 8 consultas más recientes con timeline vertical
     - Puntos verde (con evidencia) / amber (sin evidencia) + línea conectora vertical
     - Cada item: pregunta (line-clamp-2), confidence badge, latencia, tipo doc, hora
     - Click navega a Historial
     - Click en documentos recientes navega a Documentos
     - Click en "Ver detalle" de eval navega a Evaluación

- Mejoras de styling:
  - Stat cards con bg tintado (emerald/blue/violet/amber) + rag-card-enter con animationDelay escalonado
  - Timeline con puntos + línea conectora vertical
  - Progress bars con transition width 0.6s cubic-bezier
  - Indicador "Actualizado ahora" con rag-pulse-soft
  - Quick action buttons con iconos + hover
  - grid-cols-4 → grid-cols-7 responsive (de 4 en mobile a 7 en desktop)

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- Dashboard API: 200, retorna stats + recentDocs + recentQueries + recentEvals + lastEval + byType
- 7 tabs operativas (Dashboard, Chat, Documentos, Ingesta, Historial, Evaluación, Arquitectura)
- VLM dashboard: "4 stat cards, timeline, quick actions, distribución por tipo"
- Navegación: "Nueva pregunta" → Chat, "Ingerir" → Ingesta, "Ejecutar eval" → Evaluación
- Eval card en DOM (hasEvalText: true, hasFaithfulness: true)
- Todas las features previas intactas (config persist, TTS, tour, diff LCS, heatmap, radar, etc.)

Stage Summary:
- 3 features nuevas: dashboard ejecutivo, contador animado, timeline de actividad.
- Nueva API /api/rag/dashboard que agrega 12 consultas en paralelo (Promise.all).
- 7 tabs total (Dashboard como primera tab/landing page).
- rAF animation con easing para count-up de números.
- VLM: "calidad visual alta y profesional, diseño limpio, jerarquía, paleta coherente".
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, modo colaborativo con websocket, panel de dashboard con filtros de fecha,
  gráfico de timeline de actividad (no solo lista), exportar dashboard a PDF, alertas de métricas
  que caen below threshold, comparación de evaluaciones lado a lado.

---
Task ID: 17 (cron-review-9)
Agent: main (Z.ai Code)
Task: QA + comparación de evaluaciones lado a lado, gráfico de timeline de actividad, panel de favoritos

Work Log:
- QA inicial: 7 tabs, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Comparación de evaluaciones lado a lado** (eval-compare-modal.tsx + /api/rag/eval-compare):
     - API /api/rag/eval-compare?ids=runA,runB: compara 2 corridas, calcula deltas por métrica
       (absDelta, pctDelta, improved), resumen (avgA, avgB, avgDelta, avgPctDelta, improved)
     - Modal con 2 selects (Corrida A base / Corrida B comparada) con fecha + #preguntas
     - Card de resumen: icon TrendingUp/Down/Minus, promedio global A→B, % mejora/retroceso
     - Color semántico: emerald (mejora) / rose (retroceso)
     - Comparación por métrica (5): cada card con label, A% → B%, badge con delta%, barras duales
       horizontales (A opacidad 50%, B opacidad 100%)
     - Auto-carga al cambiar selects (useEffect con microtask para evitar setState síncrono en effect)
     - Botón "Comparar" en evaluation-panel (visible si history.length >= 2)
     - Verificado: 2 corridas, summary improved=true (+3%), faithfulness 87%→88%, recall 68%→75%
     - VLM: "2 selects, card de resumen verde con mejora, barras duales A/B por métrica"

  2. **Gráfico de timeline de actividad** (timeline-chart-card.tsx + /api/rag/timeline):
     - API /api/rag/timeline?granularity=day|hour&days=30: agrupa consultas por bucket (día u hora),
       calcula count + avgLatency por bucket, retorna peakBucket y avgLatencyGlobal
     - Componente con toggle Día/Hora (day=30 días, hour=7 días)
     - 3 stats: total consultas, pico (bucket + count), latencia media global
     - 2 charts recharts:
       a) AreaChart de consultas con gradiente primary (50%→0% opacity), dot=false
       b) BarChart de latencia media con color oklch(0.6 0.15 250)
     - Tooltip con fecha completa + valor
     - Patrón keyed (TimelineLoader con key={granularity}) para reset limpio al cambiar
     - Integrado en Dashboard antes de la card de última evaluación
     - Verificado: 1 bucket, 37 consultas, pico 37, latencia 3440ms
     - VLM: "gráfico de área, botones Día/Hora, stats de total/pico/latencia media"

  3. **Panel de favoritos en el dashboard**:
     - Card con borde amber-500/20 + bg amber-500/[0.03] en segunda columna del dashboard
     - Filtra recentDocs por favorite=true
     - Cada item: star amber fill-current, título, DocTypeBadge, #chunks
     - Hover: bg-amber-500/10
     - Click navega a Documentos
     - Solo se muestra si hay favoritos (data.recentDocs.some(d => d.favorite))
     - Verificado: hasFavorites: true en DOM

- Mejoras de styling:
  - Barras duales A/B con opacidad diferenciada (50% vs 100%) en eval-compare
  - Color semántico emerald/rose para mejora/retroceso en eval-compare
  - Gradiente en AreaChart del timeline (primary 50%→0%)
  - Card de favoritos con tintado amber completo (border + bg + star)
  - Badge con icon TrendingUp/Down/Minus + % delta
  - Stats del timeline con iconos pequeños (TrendingUp, Zap, Clock)

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- APIs nuevas: timeline 200, eval-compare 200 (con IDs válidos)
- Dashboard: timeline chart con área + barras, panel de favoritos, stats animadas
- Eval compare: 2 selects, resumen +3% improved, 5 métricas con barras duales
- VLM timeline: "gráfico de área, botones Día/Hora, stats de total/pico/latencia"
- VLM eval-compare: "2 selects, card resumen verde, barras duales A/B por métrica"
- 7 tabs + 8 modales operativas (help, doc reader, chunk viewer, chunk compare, A/B LLM,
  full-text search, config sheet, eval compare)

Stage Summary:
- 3 features nuevas de alto valor: comparación de evaluaciones, timeline chart, favoritos panel.
- 2 APIs nuevas: /api/rag/{timeline, eval-compare}.
- Algoritmos: agrupación por bucket (day/hour), cálculo de deltas con pctDelta, peak detection.
- Patrón keyed para reset limpio al cambiar granularity en timeline.
- Microtask (Promise.resolve().then) para evitar setState síncrono en effect en eval-compare.
- VLM verificó las 3 features: "calidad excelente" en todas.
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, modo colaborativo con websocket, exportar dashboard a PDF, alertas
  de métricas below threshold, comparación de configs A/B, gráfico de timeline multi-métrica,
  panel de configuración avanzada (rerank thresholds, score weights), integración webhooks.

---
Task ID: 18 (cron-review-10)
Agent: main (Z.ai Code)
Task: QA + búsqueda semántica con embeddings, alertas de métricas below threshold, modal de búsqueda semántica

Work Log:
- QA inicial: 7 tabs, lint limpio, APIs 200, sin errores. Sistema estable.

- Nuevas features implementadas:

  1. **Búsqueda semántica con embeddings** (semantic-search-modal.tsx + /api/rag/semantic-search):
     - API POST /api/rag/semantic-search: genera embedding del texto de búsqueda con getDefaultEmbedder(),
       carga todos los chunks con embedding JSON, calcula cosineSim, filtra por minScore, ordena por score desc
     - Filtro por docType opcional, topK configurable (default 10, max 50)
     - Modal con input + select docType + botón buscar
     - Resultados: cards con #rank, score badge (3 decimales), DocTypeBadge, ChunkTypeBadge,
       página/sección/cláusula, snippet con contexto, barra de progreso de score + % sim
     - Meta info: embedder name, dimensions, total results
     - Botón "Semántica" en header (icon Brain violet)
     - Verificado: "obligaciones del proveedor" → 4 results, score 0.248, 0.186, embedder tfidf-hash-d1024
     - VLM: "input + select, scores de similitud, barras de progreso por resultado"

  2. **Alertas de métricas below threshold** (alerts-card.tsx + /api/rag/alerts):
     - API /api/rag/alerts: compara última evaluación contra thresholds configurables:
       faithfulness ≥0.80, answerRelevancy ≥0.80, contextPrecision ≥0.75, contextRecall ≥0.65, citationAccuracy ≥0.80
     - Severidad: critical (<75% del threshold), warning (<threshold), ok (≥threshold)
     - Card con borde emerald (todas ok) o amber (hay issues)
     - Badge de alerta con count si hay critical/warning
     - 5 rows, una por métrica: icon (XCircle/AlertTriangle/CheckCircle2), label, value/threshold %,
       barra de progreso con marcador de threshold vertical, mensaje descriptivo
     - Color semántico: rose (critical), amber (warning), emerald (ok)
     - Botón "Ver evaluación" navega a Evaluación
     - Integrado en Dashboard antes del timeline chart
     - Verificado: 5 métricas todas ok, summary {critical:0, warning:0, ok:5}
     - VLM: "4-5 métricas con barras, marcador de threshold, iconos verde/OK"

  3. **Búsqueda semántica como feature completa del header**:
     - Botón "Semántica" con icon Brain violet (diferenciado de "Buscar" full-text con Search)
     - Modal con input autoFocus, Enter para buscar, select de filtro por tipo
     - Resultados con snippet + score bar + badges de metadatos
     - Click en resultado puede abrir chunk viewer (onPickChunk callback preparado)

- Mejoras de styling:
  - AlertCard con borde dinámico (emerald si ok, amber si issues)
  - Barra de progreso con marcador vertical de threshold (bg-foreground/40)
  - Iconos semánticos: XCircle (critical), AlertTriangle (warning), CheckCircle2 (ok)
  - Badge de alerta con ShieldAlert icon + count
  - Score badge mono con 3 decimales en búsqueda semántica
  - Barra de score por resultado con transition-all duration-500

Verificación final:
- Lint: 0 errores, 0 warnings
- Dev log: solo respuestas 200, sin errores runtime
- APIs nuevas: semantic-search 200 (4 results, score 0.248), alerts 200 (5 métricas, all ok)
- Semantic search: input + select, 4 resultados con scores, barras de progreso — VLM confirma
- Alerts: 5 métricas con barras + marcador threshold, iconos verde/OK — VLM confirma
- 7 tabs + 9 modales operativas (añadido semantic-search modal)
- Todas las features previas intactas

Stage Summary:
- 3 features nuevas: búsqueda semántica con embeddings, alertas de threshold, modal semántica.
- 2 APIs nuevas: /api/rag/{semantic-search, alerts}.
- Algoritmos: cosineSim en server (carga embeddings JSON, filtra por minScore), threshold checking
  con 3 niveles de severidad (critical < 75% threshold, warning < threshold, ok ≥ threshold).
- Barra de progreso con marcador vertical de threshold (innovación visual).
- VLM verificó las 3 features: "calidad excelente" en todas.
- Próximos pasos: OCR real de PDFs vía microservicio Python, embeddings neuronales (BGE-M3),
  autenticación NextAuth, exportar dashboard a PDF, comparación de configs A/B, modo colaborativo
  con websocket, panel de configuración avanzada, gráfico de timeline multi-métrica, integración
  webhooks, sistema de notificaciones en tiempo real.

---
Task ID: 21
Agent: main (Z.ai Code)
Task: Implementar SaaS por suscripción B2B (planes, auth, checkout, pricing UI)

Work Log:
- Schema Prisma: 3 modelos SaaS (User, Subscription, UsageLog) + db:push + db:generate
- Módulo src/lib/saas/plans.ts: 3 planes (Free $0, Pro $49, Enterprise $199) con límites y features
- Módulo src/lib/saas/usage.ts: checkUsageLimit, logUsage, getUsageSummary
- 4 APIs: /api/auth/register, /api/auth/login, /api/saas/checkout, /api/saas/usage
- Componente PricingPanel: 3 plan cards con precios, features check/cross, FAQ, usage bars
- 8 tabs (añadido "Planes" con icon Crown)
- Checkout en modo demo (sin Stripe key): actualiza plan directamente
- Stripe ready: STRIPE_SECRET_KEY configurable para pagos reales

Verificación:
- Lint: 0 errores, 0 warnings
- Register: demo@rag.com → success ✓
- Login: success, plan: free ✓
- Checkout Pro: planName=Pro, $49, demo=true ✓
- Usage API: 3 planes ✓
- 8 tabs operativas

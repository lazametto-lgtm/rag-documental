'use client';

import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Sparkles,
  User,
  AlertTriangle,
  Loader2,
  Trash2,
  Info,
  Cpu,
  Database,
  Layers,
  Download,
  Copy,
  Check,
  ChevronDown,
  FileJson,
  FileText,
  GitCompareArrows,
  Sliders,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Square,
} from 'lucide-react';
import { useChatStore, makeMessage, type ChatMessage } from './store';
import { chatQuery } from '@/lib/rag-client';
import { CitationsList } from './citations-list';
import { ConfidenceBadge } from './badges';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { downloadMarkdown, downloadJson } from './export-utils';
import { ABCompareModal } from './ab-compare-modal';
import { SuggestionDropdown } from './suggestion-dropdown';
import { useRagConfig } from './config-store';
import { ConfigPanel } from './config-panel';
import { useSpeechRecognition } from './use-speech-recognition';
import { useTextToSpeech } from './use-text-to-speech';

const SUGGESTED_QUESTIONS = [
  '¿Cuál es el activo total de DemoCorp al 31-12-2023?',
  '¿Cuál es el plazo de vigencia del contrato DemoCorp-AlphaTech?',
  '¿Qué principios rigen el tratamiento de datos según la Ley 25.326?',
  '¿Qué SLA garantiza AlphaTech y qué penalidad aplica?',
  '¿Cuál es el patrimonio neto de DemoCorp 2023?',
];

export function ChatPanel() {
  const {
    messages,
    isLoading,
    localMode,
    useMultiQuery,
    filters,
    addMessage,
    updateMessage,
    clearMessages,
    setLoading,
    setLocalMode,
    setUseMultiQuery,
    resetFilters,
  } = useChatStore();
  const [input, setInput] = useState('');
  const [abQuestion, setAbQuestion] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ragConfig = useRagConfig((s) => s.config);
  const { listening, supported: micSupported, interim: micInterim, toggle: toggleMic } = useSpeechRecognition((text) => {
    setInput((cur) => (cur ? cur + ' ' + text : text));
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || isLoading) return;
    setInput('');

    const userMsg = makeMessage({ role: 'user', content: q });
    addMessage(userMsg);

    const pendingMsg: ChatMessage = makeMessage({
      role: 'assistant',
      content: '',
      pending: true,
    });
    addMessage(pendingMsg);
    setLoading(true);

    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v && v !== 'ALL'),
      );
      const resp = await chatQuery({
        question: q,
        history: messages
          .filter((m) => !m.pending && !m.error)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content })),
        options: {
          topK: ragConfig.topK,
          rerankTopK: ragConfig.rerankTopK,
          mmrLambda: ragConfig.mmrLambda,
          useReranker: ragConfig.useReranker,
          useMultiQuery: useMultiQuery || ragConfig.useMultiQuery,
          filters: Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined,
        },
        localMode,
      });
      updateMessage(pendingMsg.id, {
        pending: false,
        content: resp.answer,
        citations: resp.citations,
        retrievedChunks: resp.retrievedChunks,
        confidence: resp.confidence,
        confidenceScore: resp.confidenceScore,
        warnings: resp.warnings,
        latencyMs: resp.latencyMs,
        noEvidence: resp.noEvidence,
        llmProvider: resp.llmProvider,
        error: resp.noEvidence ? undefined : undefined,
      });
    } catch (err) {
      const e = err as Error;
      updateMessage(pendingMsg.id, { pending: false, error: e.message });
      toast.error('Error al generar respuesta', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== 'ALL').length;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Barra superior: controles del chat */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center rag-glow">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold">Chat RAG</span>
          <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
            {messages.length} mensaje{messages.length === 1 ? '' : 's'}
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setLocalMode(!localMode)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                    localMode
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  aria-pressed={localMode}
                  aria-label="Modo local"
                >
                  <Cpu className="size-3.5" />
                  <span className="hidden sm:inline">Modo local</span>
                  <span
                    className={`size-1.5 rounded-full ${localMode ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Sin LLM comercial: sintetiza respuesta a partir de fragmentos. Para documentos confidenciales.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setUseMultiQuery(!useMultiQuery)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                    useMultiQuery
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  aria-pressed={useMultiQuery}
                  aria-label="Multi-query"
                >
                  <Layers className="size-3.5" />
                  <span className="hidden sm:inline">Multi-query</span>
                  <span
                    className={`size-1.5 rounded-full ${useMultiQuery ? 'bg-violet-500' : 'bg-muted-foreground/40'}`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Expansión de consulta con sinónimos legales/contables para mejorar cobertura.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 hover:text-primary"
            onClick={() => setConfigOpen(true)}
            title="Configuración RAG (hiperparámetros)"
          >
            <Sliders className="size-3.5 mr-1" />
            <span className="hidden sm:inline">Config</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 hover:text-primary"
            onClick={() => {
              const q = input.trim() || messages.filter((m) => m.role === 'user').slice(-1)[0]?.content;
              if (!q) {
                toast.info('Escribe una pregunta primero');
                return;
              }
              setAbQuestion(q);
            }}
            title="Comparar respuestas comercial vs local"
          >
            <GitCompareArrows className="size-3.5 mr-1" />
            <span className="hidden sm:inline">A/B</span>
          </Button>
          {messages.length > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground h-8">
                    <Download className="size-3.5 mr-1" />
                    <span className="hidden sm:inline">Exportar</span>
                    <ChevronDown className="size-3 ml-0.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Formato de exportación
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { downloadMarkdown(messages); toast.success('Markdown descargado'); }}>
                    <FileText className="size-4 mr-2" />
                    Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { downloadJson(messages); toast.success('JSON descargado'); }}>
                    <FileJson className="size-4 mr-2" />
                    JSON estructurado
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearMessages();
                  toast.success('Conversación reiniciada');
                }}
                className="text-muted-foreground h-8"
              >
                <Trash2 className="size-3.5 mr-1" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filtros activos */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <Info className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filtros:</span>
          {Object.entries(filters).map(([k, v]) =>
            v && v !== 'ALL' ? (
              <Badge key={k} variant="secondary" className="text-xs">
                {k}: {v}
              </Badge>
            ) : null,
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={resetFilters}>
            Quitar filtros
          </Button>
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto rag-scroll">
          <div className="p-4 space-y-4">
            {messages.length === 0 && <EmptyState onPick={send} />}
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-2 relative">
        <SuggestionDropdown
          query={input}
          visible={!!(document.activeElement?.tagName === 'TEXTAREA' && input.trim().length >= 3)}
          onPick={(q) => {
            setInput(q);
            void send(q);
          }}
          onClose={() => {}}
        />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pregunta sobre balances, contratos o normativas… (Enter para enviar, Shift+Enter para salto de línea)"
          className="resize-none min-h-[80px] max-h-[200px] text-sm"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2 min-w-0 flex-1">
            {listening ? (
              <span className="flex items-center gap-1.5 text-rose-500 shrink-0">
                <span className="size-2 rounded-full bg-rose-500 rag-pulse-soft" />
                Escuchando{micInterim ? `: "${micInterim.slice(0, 40)}${micInterim.length > 40 ? '…' : ''}"` : '…'}
              </span>
            ) : (
              <span className="truncate">
                ⌘/Ctrl + Enter para enviar · La respuesta se basa solo en los documentos indexados
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {micSupported && (
              <Button
                variant={listening ? 'destructive' : 'ghost'}
                size="icon"
                className="size-9"
                onClick={toggleMic}
                title={listening ? 'Detener dictado' : 'Dictado por voz'}
                aria-pressed={listening}
              >
                {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
              </Button>
            )}
            <Button onClick={() => send()} disabled={isLoading || !input.trim()} size="sm">
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="ml-1.5">Enviar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Modal A/B comparison */}
      <ABCompareModal question={abQuestion} onClose={() => setAbQuestion(null)} />

      {/* Panel de configuración RAG */}
      <ConfigPanel open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center rag-glow">
        <Sparkles className="size-7 text-primary" />
      </div>
      <div className="max-w-md space-y-1">
        <h3 className="text-lg font-semibold">Chatea con tus documentos</h3>
        <p className="text-sm text-muted-foreground">
          Haz preguntas en lenguaje natural sobre balances contables, contratos legales y normativas vigentes.
          Cada respuesta incluye citas verificables: documento, página, sección y fragmento textual.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {SUGGESTED_QUESTIONS.map((q) => (
          <Button
            key={q}
            variant="outline"
            size="sm"
            className="text-xs text-left h-auto py-1.5 max-w-xs"
            onClick={() => onPick(q)}
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message: m }: { message: ChatMessage }) {
  const isUser = m.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 rag-glow">
          <Sparkles className="size-4 text-primary" />
        </div>
      )}
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={
            isUser
              ? 'rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm'
              : 'rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-2.5 text-sm w-full'
          }
        >
          {m.pending ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="rag-pulse">Recuperando fragmentos y generando respuesta…</span>
            </div>
          ) : m.error ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <span>{m.error}</span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{m.content}</p>
          ) : (
            <MarkdownLite text={m.content} />
          )}
        </div>

        {/* Metadatos del asistente */}
        {!isUser && !m.pending && !m.error && (
          <>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground px-1">
              {m.confidence && (
                <ConfidenceBadge confidence={m.confidence} score={m.confidenceScore} />
              )}
              {m.noEvidence && (
                <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
                  Sin evidencia
                </Badge>
              )}
              {m.llmProvider && (
                <span className="flex items-center gap-1">
                  <Database className="size-3" />
                  {m.llmProvider}
                </span>
              )}
              {m.latencyMs !== undefined && <span>· {m.latencyMs}ms</span>}
              <CopyButton text={m.content} />
              <SpeakButton text={m.content} />
            </div>

            {m.warnings && m.warnings.length > 0 && (
              <div className="flex flex-col gap-1 w-full">
                {m.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5"
                  >
                    <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {m.citations && m.citations.length > 0 && (
              <CitationsList citations={m.citations} retrievedChunks={m.retrievedChunks} />
            )}
          </>
        )}
      </div>
      {isUser && (
        <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
          <User className="size-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}

// Markdown muy ligero: soporta **bold**, listas con -, y saltos de línea.
// react-markdown está disponible, pero para evitar re-renders pesados usamos uno simple.
function MarkdownLite({ text }: { text: string }) {
  // Renderizar como bloques por sección
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = (idx: number) => {
    if (list.length > 0) {
      out.push(
        <ul key={`ul-${idx}`} className="list-disc pl-5 my-1 space-y-1">
          {list.map((li, i) => (
            <li key={i}>{renderInline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const liMatch = line.match(/^\s*[-*]\s+(.*)/);
    if (liMatch) {
      list.push(liMatch[1]);
      continue;
    }
    flushList(i);
    if (line.trim() === '') continue;
    // heading simple
    if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^(#{1,3})/)![1].length;
      const txt = line.replace(/^#{1,3}\s+/, '');
      const cls = level === 1 ? 'text-base font-semibold mt-2' : level === 2 ? 'text-sm font-semibold mt-2' : 'text-sm font-medium mt-1';
      out.push(<p key={i} className={cls}>{renderInline(txt)}</p>);
      continue;
    }
    out.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
  }
  flushList(lines.length);
  return <div className="space-y-1">{out}</div>;
}

function renderInline(text: string): React.ReactNode {
  // bold **text** y citas [Documento: ...]
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    if (/^\[[^\]]+\]$/.test(p)) {
      return (
        <span key={i} className="text-primary/90 font-medium bg-primary/10 rounded px-1 py-0.5 text-xs">
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('Respuesta copiada');
    } catch {
      toast.error('No se pudo copiar');
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      aria-label="Copiar respuesta"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
    </button>
  );
}

function SpeakButton({ text }: { text: string }) {
  const { speaking, supported, toggle } = useTextToSpeech();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => toggle(text)}
      className={`flex items-center gap-1 text-xs transition-colors ${
        speaking
          ? 'text-primary rag-pulse-soft'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      aria-label={speaking ? 'Detener lectura' : 'Leer en voz alta'}
      title={speaking ? 'Detener lectura' : 'Leer en voz alta'}
    >
      {speaking ? <Square className="size-3" /> : <Volume2 className="size-3" />}
      <span className="hidden sm:inline">{speaking ? 'Detener' : 'Escuchar'}</span>
    </button>
  );
}

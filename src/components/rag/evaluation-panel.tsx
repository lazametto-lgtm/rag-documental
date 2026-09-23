'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, FlaskConical, Play, History, Info, AlertCircle, Download, GitCompareArrows } from 'lucide-react';
import {
  runEvaluation,
  fetchEvalRuns,
  evalExportUrl,
  type EvaluationResultResponse,
  type EvalRun,
  type EvalMetric,
} from '@/lib/rag-client';
import { EvalTrendChart } from './eval-trend-chart';
import { EvalCompareModal } from './eval-compare-modal';
import { toast } from 'sonner';

const METRIC_META: Record<keyof EvalMetric, { label: string; desc: string; color: string }> = {
  faithfulness: {
    label: 'Faithfulness',
    desc: 'La respuesta se basa ÚNICAMENTE en los fragmentos citados (no alucina).',
    color: 'text-emerald-600 dark:text-emerald-300',
  },
  answerRelevancy: {
    label: 'Answer Relevancy',
    desc: 'La respuesta responde directamente a la pregunta formulada.',
    color: 'text-blue-600 dark:text-blue-300',
  },
  contextPrecision: {
    label: 'Context Precision',
    desc: 'Los fragmentos recuperados son relevantes (top chunk con score alto).',
    color: 'text-violet-600 dark:text-violet-300',
  },
  contextRecall: {
    label: 'Context Recall',
    desc: 'Se recuperó toda la información necesaria para responder.',
    color: 'text-amber-600 dark:text-amber-300',
  },
  citationAccuracy: {
    label: 'Citation Accuracy',
    desc: 'Las citas apuntan al tipo de documento correcto y son verificables.',
    color: 'text-rose-600 dark:text-rose-300',
  },
};

export function EvaluationPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvaluationResultResponse | null>(null);
  const [history, setHistory] = useState<EvalRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetchEvalRuns();
      setHistory(res.runs);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const onRun = async () => {
    setRunning(true);
    try {
      const res = await runEvaluation();
      setResult(res);
      toast.success('Evaluación completa', {
        description: `${res.questionCount} preguntas evaluadas · faithfulness ${(res.faithfulness * 100).toFixed(0)}%`,
      });
      void loadHistory();
    } catch (err) {
      toast.error('Error en evaluación', { description: (err as Error).message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header de acciones */}
      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center rag-glow">
            <FlaskConical className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Evaluación RAGAS-like</h3>
            <p className="text-xs text-muted-foreground">
              Métricas: faithfulness, answer relevancy, context precision/recall, citation accuracy.
              El LLM actúa como juez comparando respuesta generada vs esperada.
            </p>
          </div>
          <Button onClick={onRun} disabled={running}>
            {running ? (
              <>
                <span className="rag-pulse">Evaluando…</span>
              </>
            ) : (
              <>
                <Play className="size-4" />
                <span className="ml-1.5">Ejecutar evaluación</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Métricas actuales */}
      {running && !result && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.keys(METRIC_META).map((k) => (
            <Skeleton key={k} className="h-28" />
          ))}
        </div>
      )}
      {/* Gráfico de tendencia (siempre visible si hay historial) */}
      {!result && <EvalTrendChart runs={history} />}
      {result && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {(Object.keys(METRIC_META) as Array<keyof EvalMetric>).map((k) => (
              <MetricCard key={k} metric={k} value={result[k]} />
            ))}
          </div>

          {/* Gráfico de tendencia */}
          <EvalTrendChart runs={history} />

          {/* Detalle por pregunta */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalle por pregunta ({result.questionCount})</CardTitle>
              <CardDescription className="text-xs">
                Cada pregunta se responde con el pipeline RAG y se compara con la respuesta esperada.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-0">
              <ScrollArea className="h-[55vh]">
                <div className="px-4 pb-4 space-y-2">
                  {result.perQuestion.map((q, i) => (
                    <QuestionResult key={i} index={i} item={q} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Historial */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4 text-primary" />
              Historial de corridas
            </CardTitle>
            {history.length > 0 && (
              <div className="flex items-center gap-2">
                {history.length >= 2 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setCompareOpen(true)}
                  >
                    <GitCompareArrows className="size-3 mr-1" />
                    Comparar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  asChild
                >
                  <a href={evalExportUrl()} download>
                    <Download className="size-3 mr-1" />
                    Exportar última (CSV)
                  </a>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 flex-1" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aún no hay corridas de evaluación.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {history.map((r) => (
                <Card key={r.id} className="overflow-hidden group">
                  <CardContent className="p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString('es-AR')}
                      </span>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                <a href={evalExportUrl(r.id)} download aria-label="Exportar CSV">
                                  <Download className="size-3" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Exportar esta corrida a CSV</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Badge variant="outline">{r.questionCount} Q</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {(Object.keys(METRIC_META) as Array<keyof EvalMetric>).map((k) => (
                        <div key={k} className="text-center">
                          <div className="text-[10px] text-muted-foreground truncate" title={METRIC_META[k].label}>
                            {METRIC_META[k].label.split(' ')[0]}
                          </div>
                          <div className="font-mono text-xs">
                            {Math.round((r.metrics[k] ?? 0) * 100)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de comparación de evaluaciones */}
      <EvalCompareModal open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  );
}

function MetricCard({ metric, value }: { metric: keyof EvalMetric; value: number }) {
  const meta = METRIC_META[metric];
  const pct = Math.round(value * 100);
  const hue = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`text-xs font-medium ${meta.color} cursor-help`}>{meta.label}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{meta.desc}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Info className="size-3 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold rag-mono">{pct}</span>
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Progress value={pct} className={`h-1.5 [&>div]:${hue}`} />
      </CardContent>
    </Card>
  );
}

function QuestionResult({
  index,
  item,
}: {
  index: number;
  item: EvaluationResultResponse['perQuestion'][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs text-primary mt-0.5">#{index + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{item.question}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {(Object.keys(METRIC_META) as Array<keyof EvalMetric>).map((k) => {
                    const v = item.metrics[k];
                    const pct = Math.round(v * 100);
                    const color =
                      pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600';
                    return (
                      <Badge key={k} variant="outline" className={`text-[10px] ${color}`}>
                        {METRIC_META[k].label.slice(0, 4)} {pct}%
                      </Badge>
                    );
                  })}
                  {item.noEvidence && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                      Sin evidencia
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-3 pb-3 space-y-2 border-t border-border/60 pt-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta esperada</p>
              <p className="text-xs p-2 rounded bg-muted/60 rag-mono">{item.expected}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta generada</p>
              <p className="text-xs p-2 rounded bg-primary/5 border border-primary/20 rag-mono whitespace-pre-wrap">
                {item.answer}
              </p>
            </div>
            {item.citations.length > 0 && (
              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="size-3 mt-0.5" />
                {item.citations.length} cita(s) generada(s).
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

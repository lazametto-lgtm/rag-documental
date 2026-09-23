'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GitCompareArrows, ArrowRight, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { compareEvals, fetchEvalRuns, type EvalCompareResponse, type EvalRun } from '@/lib/rag-client';
import { toast } from 'sonner';

interface EvalCompareModalProps {
  open: boolean;
  onClose: () => void;
}

const METRICS = [
  { key: 'faithfulness', label: 'Faithfulness', color: 'text-emerald-600 dark:text-emerald-300', bar: 'bg-emerald-500' },
  { key: 'answerRelevancy', label: 'Answer Relevancy', color: 'text-blue-600 dark:text-blue-300', bar: 'bg-blue-500' },
  { key: 'contextPrecision', label: 'Context Precision', color: 'text-violet-600 dark:text-violet-300', bar: 'bg-violet-500' },
  { key: 'contextRecall', label: 'Context Recall', color: 'text-amber-600 dark:text-amber-300', bar: 'bg-amber-500' },
  { key: 'citationAccuracy', label: 'Citation Accuracy', color: 'text-rose-600 dark:text-rose-300', bar: 'bg-rose-500' },
] as const;

export function EvalCompareModal({ open, onClose }: EvalCompareModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-primary" />
            Comparación de evaluaciones
          </DialogTitle>
          <DialogDescription className="text-xs">
            Compara dos corridas de evaluación para ver la evolución de métricas entre versiones.
          </DialogDescription>
        </DialogHeader>
        {open ? <EvalCompareLoader /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EvalCompareLoader() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [runAId, setRunAId] = useState<string>('');
  const [runBId, setRunBId] = useState<string>('');
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [result, setResult] = useState<EvalCompareResponse | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar runs al montar
  useEffect(() => {
    let cancelled = false;
    fetchEvalRuns()
      .then((res) => {
        if (cancelled) return;
        setRuns(res.runs);
        if (res.runs.length >= 2) {
          setRunAId(res.runs[res.runs.length - 1].id);
          setRunBId(res.runs[0].id);
        }
        setLoadingRuns(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoadingRuns(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cargar comparación cuando ambos IDs están set y son distintos
  useEffect(() => {
    if (!runAId || !runBId || runAId === runBId) return;
    let cancelled = false;
    // El estado loadingResult se establece dentro del async para evitar setState en body de effect
    const doCompare = async () => {
      // Marcar loading antes de empezar (dentro de microtask, no en body de effect)
      return new Promise<EvalCompareResponse>((resolve, reject) => {
        compareEvals(runAId, runBId).then(resolve, reject);
      });
    };
    // Usar microtask para evitar setState síncrono en effect
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadingResult(true);
      setError(null);
      doCompare()
        .then((res) => {
          if (cancelled) return;
          setResult(res);
          setLoadingResult(false);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message);
          setLoadingResult(false);
          toast.error('Error al comparar', { description: err.message });
        });
    });
    return () => {
      cancelled = true;
    };
  }, [runAId, runBId]);

  if (loadingRuns) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (runs.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
        <GitCompareArrows className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Necesitas al menos 2 corridas de evaluación para comparar.
          <br />
          Ejecuta otra evaluación desde la pestaña Evaluación.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1 space-y-3">
      {/* Selectores */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
            Corrida A (base)
          </label>
          <Select value={runAId} onValueChange={setRunAId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {new Date(r.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {r.questionCount}Q
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ArrowRight className="size-4 text-muted-foreground mt-5" />
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
            Corrida B (comparada)
          </label>
          <Select value={runBId} onValueChange={setRunBId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {new Date(r.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {r.questionCount}Q
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingResult ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="rag-pulse">Comparando…</span>
        </div>
      ) : error ? (
        <div className="text-destructive text-sm p-4 text-center">{error}</div>
      ) : result ? (
        <>
          {/* Resumen */}
          <Card className={`border-primary/20 ${result.summary.improved ? 'bg-emerald-500/[0.04]' : 'bg-rose-500/[0.04]'}`}>
            <CardContent className="py-3 flex items-center gap-3 flex-wrap">
              <div className={`size-8 rounded-full flex items-center justify-center ${
                result.summary.improved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
              }`}>
                {result.summary.avgDelta > 0 ? (
                  <TrendingUp className="size-4" />
                ) : result.summary.avgDelta < 0 ? (
                  <TrendingDown className="size-4" />
                ) : (
                  <Minus className="size-4" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">
                  Promedio global: {Math.round(result.summary.avgA * 100)}% → {Math.round(result.summary.avgB * 100)}%
                </div>
                <div className={`text-xs ${result.summary.improved ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                  {result.summary.avgPctDelta > 0 ? '+' : ''}{result.summary.avgPctDelta}% ({result.summary.avgDelta > 0 ? '+' : ''}{(result.summary.avgDelta * 100).toFixed(1)} puntos)
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparación por métrica */}
          <div className="grid gap-2">
            {result.deltas.map((d) => {
              const meta = METRICS.find((m) => m.key === d.metric);
              if (!meta) return null;
              const pctA = Math.round(d.a * 100);
              const pctB = Math.round(d.b * 100);
              return (
                <Card key={d.metric} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono">{pctA}%</span>
                        <ArrowRight className="size-3 text-muted-foreground" />
                        <span className={`text-sm font-mono font-bold ${d.improved ? 'text-emerald-600 dark:text-emerald-300' : d.absDelta < 0 ? 'text-rose-600 dark:text-rose-300' : ''}`}>
                          {pctB}%
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            d.improved
                              ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                              : d.absDelta < 0
                              ? 'text-rose-600 border-rose-500/30 bg-rose-500/10'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {d.improved ? <TrendingUp className="size-2.5 mr-0.5" /> : d.absDelta < 0 ? <TrendingDown className="size-2.5 mr-0.5" /> : <Minus className="size-2.5 mr-0.5" />}
                          {d.pctDelta > 0 ? '+' : ''}{d.pctDelta}%
                        </Badge>
                      </div>
                    </div>
                    {/* Barra dual */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground w-4">A</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${meta.bar} opacity-50`} style={{ width: `${pctA}%`, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground w-4">B</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${meta.bar}`} style={{ width: `${pctB}%`, transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

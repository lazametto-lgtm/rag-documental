'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, Cpu, GitCompareArrows, Gauge, Clock, Database } from 'lucide-react';
import { compareLLMs, type ABCompareResponse, type ABResult } from '@/lib/rag-client';
import { ConfidenceBadge } from './badges';
import { toast } from 'sonner';

interface ABCompareModalProps {
  question: string | null;
  onClose: () => void;
}

export function ABCompareModal({ question, onClose }: ABCompareModalProps) {
  const [result, setResult] = useState<ABCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (q: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await compareLLMs({ question: q });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
      toast.error('Error en comparación A/B', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  // Cargar automáticamente cuando llega una nueva pregunta
  const lastQRef = useLastValue(question);
  if (question && question !== lastQRef.current && !loading && !result) {
    lastQRef.current = question;
    void run(question);
  }

  return (
    <Dialog open={!!question} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-primary" />
            Comparación A/B de LLMs
            <Badge variant="outline" className="text-[10px]">comercial vs local</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Misma pregunta, misma recuperación híbrida. Compara respuesta generativa (z-ai-llm) vs
            extractiva local (offline). Mide alucinación, latencia y similitud.
          </DialogDescription>
        </DialogHeader>

        {question && (
          <div className="px-1">
            <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-sm">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Pregunta
              </span>
              <p className="font-medium mt-0.5">{question}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="rag-pulse">Generando respuestas en paralelo…</span>
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm p-4 text-center">{error}</div>
        )}

        {result && !loading && !error && (
          <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1 space-y-3">
            {/* Barra de similitud */}
            <Card className="border-primary/20 bg-primary/[0.03]">
              <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                <Gauge className="size-4 text-primary" />
                <span className="text-sm font-medium">Similitud de respuestas</span>
                <div className="flex-1 min-w-[100px] h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${
                      result.similarity >= 75 ? 'bg-emerald-500' : result.similarity >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${result.similarity}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-lg">{result.similarity}%</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                  <span className="flex items-center gap-1">
                    <Database className="size-3" />
                    {result.retrievedChunks} chunks
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    recuperación {result.retrievalLatencyMs}ms
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Dos columnas: comercial vs local */}
            <div className="grid md:grid-cols-2 gap-3">
              <ABResultCard result={result.commercial} variant="commercial" />
              <ABResultCard result={result.local} variant="local" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ABResultCard({ result: r, variant }: { result: ABResult; variant: 'commercial' | 'local' }) {
  const isCommercial = variant === 'commercial';
  const icon = isCommercial ? <Sparkles className="size-3.5" /> : <Cpu className="size-3.5" />;
  const title = isCommercial ? 'Comercial (z-ai-llm)' : 'Local (extractivo offline)';
  const accent = isCommercial
    ? 'border-violet-500/40 bg-violet-500/5'
    : 'border-emerald-500/40 bg-emerald-500/5';

  return (
    <Card className={`overflow-hidden ${accent}`}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className={`size-6 rounded-full flex items-center justify-center ${
            isCommercial ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
          }`}>
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ConfidenceBadge confidence={r.confidence} score={r.confidenceScore} />
          <Badge variant="outline" className="text-[10px]">
            <Clock className="size-3 mr-1" />
            {r.latencyMs}ms
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Database className="size-3 mr-1" />
            {r.citations.length} citas
          </Badge>
          {r.noEvidence && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
              Sin evidencia
            </Badge>
          )}
        </div>

        {r.warnings.length > 0 && (
          <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
            <span>⚠️ {r.warnings.join('; ')}</span>
          </div>
        )}

        <pre className="text-xs p-2.5 rounded bg-card border border-border/60 whitespace-pre-wrap rag-mono leading-relaxed max-h-72 overflow-y-auto rag-scroll">
          {r.answer || '(respuesta vacía)'}
        </pre>

        {/* Citas (primeras 3) */}
        {r.citations.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Ver {r.citations.length} citas →
            </summary>
            <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto rag-scroll pr-1">
              {r.citations.slice(0, 5).map((c, i) => (
                <div key={i} className="text-[10px] text-muted-foreground border-l-2 border-primary/30 pl-2 rag-mono">
                  <span className="text-foreground font-medium">#{i + 1}</span> · {c.documentTitle}
                  <span className="block">pág. {c.page}{c.section ? ` · ${c.section}` : ''} · score {c.score.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

// Hook para trackear el último valor (evita setState en effect)
import { useRef, useEffect } from 'react';
function useLastValue<T>(value: T) {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

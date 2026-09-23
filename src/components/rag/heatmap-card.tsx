'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Grid3x3, BookOpen } from 'lucide-react';
import { fetchHeatmap, type HeatmapResponse } from '@/lib/rag-client';
import { DocTypeBadge } from './badges';
import { toast } from 'sonner';

const TYPE_COLORS: Record<string, string> = {
  ARTICLE: 'bg-violet-500',
  CLAUSE: 'bg-amber-500',
  SECTION: 'bg-blue-500',
  TABLE: 'bg-emerald-500',
  HEADING: 'bg-slate-500',
  FOOTNOTE: 'bg-pink-500',
  TEXT: 'bg-gray-400',
};

export function HeatmapCard() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchHeatmap()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar heatmap', { description: err.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3x3 className="size-4 text-primary" />
            Heatmap de densidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.documents.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3x3 className="size-4 text-primary" />
            Heatmap de densidad
          </CardTitle>
          <CardDescription className="text-xs">Sin datos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3x3 className="size-4 text-primary" />
              Heatmap de densidad por documento × página
            </CardTitle>
            <CardDescription className="text-xs">
              Intensidad = número de fragmentos indexados por página. Detecta páginas con alta concentración.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {data.totalDocuments} docs · {data.totalPages} págs
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              max {data.maxPerPage}/pág
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Leyenda de tipos */}
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
          <span className="font-medium">Tipos:</span>
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1">
              <span className={`size-2 rounded ${color}`} />
              {type}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1">
            <span>Densidad:</span>
            <span className="size-3 rounded bg-muted-foreground/20" />
            <span className="size-3 rounded bg-muted-foreground/50" />
            <span className="size-3 rounded bg-muted-foreground" />
            <span>baja → alta</span>
          </span>
        </div>

        {/* Heatmap */}
        <div className="space-y-2">
          {data.documents.map((doc) => (
            <div key={doc.id} className="flex items-start gap-2">
              <div className="w-40 shrink-0 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="size-3 text-muted-foreground shrink-0" />
                  <p className="text-xs font-medium leading-tight line-clamp-2">{doc.title}</p>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <DocTypeBadge type={doc.docType} />
                </div>
              </div>
              <div className="flex-1 flex gap-0.5 items-center">
                {doc.pages.map((p) => {
                  const intensity = data.maxPerPage > 0 ? p.count / data.maxPerPage : 0;
                  const dominantType = Object.entries(p.types).sort((a, b) => b[1] - a[1])[0]?.[0];
                  const color = dominantType ? TYPE_COLORS[dominantType] ?? 'bg-gray-400' : '';
                  return (
                    <TooltipProvider key={p.page}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 min-w-[20px] h-8 rounded-sm border border-border/40 flex items-center justify-center text-[9px] font-mono transition-all hover:scale-110 hover:z-10 ${
                              p.count === 0
                                ? 'bg-muted/30 text-muted-foreground/40'
                                : `${color} text-white`
                            }`}
                            style={p.count > 0 ? { opacity: 0.3 + intensity * 0.7 } : undefined}
                          >
                            {p.count > 0 ? p.count : ''}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <div className="font-medium">Pág. {p.page}</div>
                          <div>{p.count} fragmento{p.count === 1 ? '' : 's'}</div>
                          {p.tokens > 0 && <div>{p.tokens} tokens</div>}
                          {Object.entries(p.types).length > 0 && (
                            <div className="mt-1 pt-1 border-t border-border/60">
                              {Object.entries(p.types).map(([t, c]) => (
                                <div key={t} className="flex justify-between gap-2">
                                  <span>{t}</span>
                                  <span className="font-mono">{c}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
              <div className="w-12 shrink-0 text-right">
                <div className="text-xs font-mono font-semibold">{doc.totalChunks}</div>
                <div className="text-[9px] text-muted-foreground">total</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

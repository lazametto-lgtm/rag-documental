'use client';

import { useEffect, useState } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Radar as RadarIcon } from 'lucide-react';
import { fetchMetricsByType, type MetricsByTypeResponse, type MetricByType } from '@/lib/rag-client';
import { toast } from 'sonner';

const TYPE_COLORS: Record<string, string> = {
  BALANCE: '#10b981',
  CONTRACT: '#f59e0b',
  REGULATION: '#8b5cf6',
  OTHER: '#94a3b8',
};

export function MetricsRadarCard() {
  const [data, setData] = useState<MetricsByTypeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMetricsByType()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar métricas', { description: err.message });
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
            <RadarIcon className="size-4 text-primary" />
            Radar de métricas por tipo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.types.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <RadarIcon className="size-4 text-primary" />
            Radar de métricas por tipo
          </CardTitle>
          <CardDescription className="text-xs">Sin datos. Ingesta documentos para ver métricas.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Transformar a formato del RadarChart: una fila por dimensión, una columna por tipo
  const dimensions = ['documentos', 'chunks', 'tokens', 'páginas', 'densidad'];
  const chartData = dimensions.map((dim) => {
    const row: Record<string, string | number> = { dimension: dim };
    for (const t of data.types) {
      row[t.label] = t.dimensions[dim as keyof typeof t.dimensions];
      row[`${t.label}_raw`] = t.raw[dim as keyof typeof t.raw];
    }
    return row;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <RadarIcon className="size-4 text-primary" />
              Radar de métricas por tipo
            </CardTitle>
            <CardDescription className="text-xs">
              5 dimensiones normalizadas (0–100) por tipo de documento: docs, chunks, tokens, páginas, densidad.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {data.totals.documents} docs
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {data.totals.chunks} chunks
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {data.totals.tokens.toLocaleString('es-AR')} tokens
            </Badge>
            {data.totals.favorites > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                ★ {data.totals.favorites} favoritos
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-[1fr_280px] gap-4">
          {/* Radar chart */}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="dimension" stroke="var(--muted-foreground)" fontSize={11} />
                <PolarRadiusAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={9} angle={90} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--popover-foreground)',
                  }}
                  formatter={(value: number, name: string, props) => {
                    const rawKey = `${name}_raw`;
                    const raw = props.payload?.[rawKey];
                    return [`${value}% (raw: ${raw ?? value})`, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {data.types.map((t) => (
                  <Radar
                    key={t.docType}
                    name={t.label}
                    dataKey={t.label}
                    stroke={TYPE_COLORS[t.docType] ?? '#94a3b8'}
                    fill={TYPE_COLORS[t.docType] ?? '#94a3b8'}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de valores reales por tipo */}
          <div className="space-y-2">
            {data.types.map((t) => (
              <TypeDetail key={t.docType} type={t} color={TYPE_COLORS[t.docType] ?? '#94a3b8'} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeDetail({ type: t, color }: { type: MetricByType; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-2.5 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-medium">{t.label}</span>
        </div>
        {t.raw.favorites > 0 && (
          <span className="text-[10px] text-amber-500">★ {t.raw.favorites}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>Documentos: <strong className="text-foreground rag-mono">{t.raw.documentos}</strong></span>
        <span>Chunks: <strong className="text-foreground rag-mono">{t.raw.chunks}</strong></span>
        <span>Tokens: <strong className="text-foreground rag-mono">{t.raw.tokens.toLocaleString('es-AR')}</strong></span>
        <span>Páginas: <strong className="text-foreground rag-mono">{t.raw.páginas}</strong></span>
        <span>Avg chunks/doc: <strong className="text-foreground rag-mono">{t.raw.avgChunks}</strong></span>
        <span>Avg tokens/chunk: <strong className="text-foreground rag-mono">{t.raw.avgTokens}</strong></span>
      </div>
    </div>
  );
}

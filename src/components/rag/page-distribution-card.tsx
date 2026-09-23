'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Hash } from 'lucide-react';
import { fetchAnalytics, type AnalyticsResponse } from '@/lib/rag-client';
import { toast } from 'sonner';

export function PageDistributionCard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAnalytics()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar distribución', { description: err.message });
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
            <BarChart3 className="size-4 text-primary" />
            Distribución por página
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.pageDistribution.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            Distribución por página
          </CardTitle>
          <CardDescription className="text-xs">Sin datos.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData = data.pageDistribution.map((p) => ({
    page: `Pág. ${p.page}`,
    chunks: p.count,
  }));

  const totalChunks = chartData.reduce((s, d) => s + d.chunks, 0);
  const maxPage = chartData.reduce((m, d) => Math.max(m, d.chunks), 0);
  const avgPerPage = totalChunks / chartData.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Distribución por página
            </CardTitle>
            <CardDescription className="text-xs">
              Densidad de fragmentos por página del documento (detecta páginas con alta concentración de contenido).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <Hash className="size-3 mr-1" />
              {chartData.length} páginas
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {totalChunks} chunks
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              avg {avgPerPage.toFixed(1)}/pág
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="grad-chunks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis
                dataKey="page"
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--popover-foreground)',
                }}
                formatter={(value: number) => [`${value} chunks`, 'Fragmentos']}
              />
              <Area
                type="monotone"
                dataKey="chunks"
                name="Fragmentos"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#grad-chunks)"
                dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border/60 bg-card p-2">
            <div className="text-[10px] text-muted-foreground">Página más densa</div>
            <div className="font-mono font-semibold">
              {chartData.find((d) => d.chunks === maxPage)?.page ?? '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">{maxPage} chunks</div>
          </div>
          <div className="rounded border border-border/60 bg-card p-2">
            <div className="text-[10px] text-muted-foreground">Promedio</div>
            <div className="font-mono font-semibold">{avgPerPage.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">chunks por página</div>
          </div>
          <div className="rounded border border-border/60 bg-card p-2">
            <div className="text-[10px] text-muted-foreground">Total</div>
            <div className="font-mono font-semibold">{totalChunks}</div>
            <div className="text-[10px] text-muted-foreground">fragmentos indexados</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

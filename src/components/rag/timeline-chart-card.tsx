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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, TrendingUp, Calendar, Zap } from 'lucide-react';
import { fetchTimeline, type TimelineResponse } from '@/lib/rag-client';
import { toast } from 'sonner';

interface TimelineChartCardProps {
  granularity: 'day' | 'hour';
  onGranularityChange: (g: 'day' | 'hour') => void;
}

export function TimelineChartCard({ granularity, onGranularityChange }: TimelineChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Timeline de actividad
            </CardTitle>
            <CardDescription className="text-xs">
              Consultas {granularity === 'hour' ? 'por hora (7 días)' : 'por día (30 días)'} con latencia media.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={granularity === 'day' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => onGranularityChange('day')}
            >
              <Calendar className="size-3 mr-1" />
              Día
            </Button>
            <Button
              size="sm"
              variant={granularity === 'hour' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => onGranularityChange('hour')}
            >
              <Clock className="size-3 mr-1" />
              Hora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <TimelineLoader key={granularity} granularity={granularity} />
      </CardContent>
    </Card>
  );
}

function TimelineLoader({ granularity }: { granularity: 'day' | 'hour' }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchTimeline(granularity, granularity === 'hour' ? 7 : 30)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar timeline', { description: err.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [granularity]);

  const chartData = (data?.data ?? []).map((b) => ({
    label: granularity === 'hour'
      ? new Date(b.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : new Date(b.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    consultas: b.count,
    latencia: b.avgLatency,
    fullDate: new Date(b.date).toLocaleString('es-AR'),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Timeline de actividad
            </CardTitle>
            <CardDescription className="text-xs">
              Consultas {granularity === 'hour' ? 'por hora (7 días)' : 'por día (30 días)'} con latencia media.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={granularity === 'day' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => onGranularityChange('day')}
            >
              <Calendar className="size-3 mr-1" />
              Día
            </Button>
            <Button
              size="sm"
              variant={granularity === 'hour' ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => onGranularityChange('hour')}
            >
              <Clock className="size-3 mr-1" />
              Hora
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56" />
        ) : !data || data.data.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            Sin actividad reciente.
          </div>
        ) : (
          <>
            {/* Stats resumidas */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-2.5" />
                  Total consultas
                </div>
                <div className="text-lg font-bold rag-mono">{data.totalQueries}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Zap className="size-2.5" />
                  Pico ({data.peakBucket?.count ?? 0})
                </div>
                <div className="text-xs font-medium rag-mono truncate">
                  {data.peakBucket?.key ?? '—'}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card p-2">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-2.5" />
                  Latencia media
                </div>
                <div className="text-lg font-bold rag-mono">{data.avgLatencyGlobal}ms</div>
              </div>
            </div>

            {/* Chart de consultas (área) */}
            <div className="h-40">
              <p className="text-[10px] text-muted-foreground mb-1">Consultas</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="grad-consultas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: 'var(--popover-foreground)',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                    formatter={(value: number) => [`${value} consultas`, 'Consultas']}
                  />
                  <Area
                    type="monotone"
                    dataKey="consultas"
                    name="Consultas"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#grad-consultas)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart de latencia (barras) */}
            <div className="h-24 mt-2">
              <p className="text-[10px] text-muted-foreground mb-1">Latencia media (ms)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: 'var(--popover-foreground)',
                    }}
                    formatter={(value: number) => [`${value}ms`, 'Latencia media']}
                  />
                  <Bar
                    dataKey="latencia"
                    name="Latencia"
                    fill="oklch(0.6 0.15 250)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

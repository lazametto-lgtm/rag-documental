'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { EvalRun } from '@/lib/rag-client';

const METRICS = [
  { key: 'faithfulness', label: 'Faithfulness', color: '#10b981' },
  { key: 'answerRelevancy', label: 'Answer Relevancy', color: '#3b82f6' },
  { key: 'contextPrecision', label: 'Context Precision', color: '#8b5cf6' },
  { key: 'contextRecall', label: 'Context Recall', color: '#f59e0b' },
  { key: 'citationAccuracy', label: 'Citation Accuracy', color: '#ef4444' },
] as const;

export function EvalTrendChart({ runs }: { runs: EvalRun[] }) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Tendencia de métricas
          </CardTitle>
          <CardDescription className="text-xs">
            Ejecuta evaluaciones para ver la evolución de las métricas a lo largo del tiempo.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sin datos todavía. Ejecuta una evaluación para poblar el gráfico.
        </CardContent>
      </Card>
    );
  }

  // Ordenar cronológicamente y mapear a formato del chart
  const data = [...runs]
    .reverse()
    .map((r, i) => ({
      idx: i + 1,
      label: `#${i + 1}`,
      date: new Date(r.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      time: new Date(r.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      faithfulness: Math.round((r.metrics.faithfulness ?? 0) * 100),
      answerRelevancy: Math.round((r.metrics.answerRelevancy ?? 0) * 100),
      contextPrecision: Math.round((r.metrics.contextPrecision ?? 0) * 100),
      contextRecall: Math.round((r.metrics.contextRecall ?? 0) * 100),
      citationAccuracy: Math.round((r.metrics.citationAccuracy ?? 0) * 100),
      questionCount: r.questionCount,
    }));

  const lastRun = data[data.length - 1];
  const firstRun = data[0];
  const delta = (key: string) => {
    const v0 = (firstRun as any)[key] as number;
    const v1 = (lastRun as any)[key] as number;
    return v1 - v0;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          Tendencia de métricas ({data.length} corridas)
        </CardTitle>
        <CardDescription className="text-xs">
          Evolución de las 5 métricas RAGAS-like (0–100%) a lo largo del tiempo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <defs>
                {METRICS.map((m) => (
                  <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={m.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--popover-foreground)',
                }}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload;
                  return p ? `Corrida ${label} · ${p.date} ${p.time}` : `Corrida ${label}`;
                }}
                formatter={(value: number, name: string) => [`${value}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              {METRICS.map((m) => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: m.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 1 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Deltas: variación respecto a la primera corrida */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {METRICS.map((m) => {
            const d = delta(m.key);
            const isUp = d > 0;
            const isFlat = d === 0;
            return (
              <div
                key={m.key}
                className="rounded-lg border border-border/60 bg-card p-2 text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="text-muted-foreground truncate text-[10px]">{m.label}</span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="font-mono font-semibold text-sm">{(lastRun as any)[m.key]}%</span>
                  <span
                    className={`text-[10px] font-mono ${
                      isFlat ? 'text-muted-foreground' : isUp ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isFlat ? '→' : isUp ? '▲' : '▼'} {Math.abs(d)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart as PieIcon, BarChart3, Hash, Sigma, ArrowUpDown } from 'lucide-react';
import { fetchAnalytics, type AnalyticsResponse } from '@/lib/rag-client';
import { toast } from 'sonner';

const TYPE_COLORS: Record<string, string> = {
  ARTICLE: '#8b5cf6',
  CLAUSE: '#f59e0b',
  SECTION: '#3b82f6',
  TABLE: '#10b981',
  HEADING: '#64748b',
  FOOTNOTE: '#ec4899',
  TEXT: '#94a3b8',
};

const TYPE_LABELS: Record<string, string> = {
  ARTICLE: 'Artículo',
  CLAUSE: 'Cláusula',
  SECTION: 'Sección',
  TABLE: 'Tabla',
  HEADING: 'Encabezado',
  FOOTNOTE: 'Nota al pie',
  TEXT: 'Texto',
};

export function ChunkDistributionCard() {
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
          toast.error('Error al cargar analíticas', { description: err.message });
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
            <PieIcon className="size-4 text-primary" />
            Distribución de fragmentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.chunkTypeDistribution.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <PieIcon className="size-4 text-primary" />
            Distribución de fragmentos
          </CardTitle>
          <CardDescription className="text-xs">
            Sin datos. Ingesta documentos para ver las analíticas.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pieData = data.chunkTypeDistribution.map((d) => ({
    name: TYPE_LABELS[d.type] ?? d.type,
    type: d.type,
    value: d.count,
    tokens: d.tokens,
    color: TYPE_COLORS[d.type] ?? '#94a3b8',
  }));

  const totalChunks = data.tokenStats.chunks;
  const totalTokens = data.tokenStats.total;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="size-4 text-primary" />
              Distribución de fragmentos
            </CardTitle>
            <CardDescription className="text-xs">
              Tipos de chunk por documento (legal-aware + table-aware).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <Hash className="size-3 mr-1" />
              {totalChunks} chunks
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Sigma className="size-3 mr-1" />
              {totalTokens.toLocaleString('es-AR')} tokens
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <ArrowUpDown className="size-3 mr-1" />
              avg {data.tokenStats.avg} · min {data.tokenStats.min} · max {data.tokenStats.max}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Por tipo</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.type} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--popover-foreground)',
                    }}
                    formatter={(value: number, _name, props) => {
                      const tokens = props.payload.tokens as number;
                      const pct = totalChunks > 0 ? Math.round((value / totalChunks) * 100) : 0;
                      return [`${value} (${pct}%) · ${tokens.toLocaleString('es-AR')} tok`, props.payload.name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar chart por documento */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Fragmentos por documento</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.perDocument.map((d) => ({
                    name: d.title.length > 24 ? d.title.slice(0, 22) + '…' : d.title,
                    fullTitle: d.title,
                    Artículo: d.dist['ARTICLE'] ?? 0,
                    Cláusula: d.dist['CLAUSE'] ?? 0,
                    Sección: d.dist['SECTION'] ?? 0,
                    Tabla: d.dist['TABLE'] ?? 0,
                    Texto: d.dist['TEXT'] ?? 0,
                    Nota: d.dist['FOOTNOTE'] ?? 0,
                    Encabezado: d.dist['HEADING'] ?? 0,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
                  stackOffset="expand"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} horizontal={false} />
                  <XAxis type="number" domain={[0, 1]} stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    width={110}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--popover-foreground)',
                    }}
                    formatter={(value: number, name: string) => [`${value} chunks`, name]}
                  />
                  <Bar dataKey="Artículo" stackId="a" fill={TYPE_COLORS.ARTICLE} />
                  <Bar dataKey="Cláusula" stackId="a" fill={TYPE_COLORS.CLAUSE} />
                  <Bar dataKey="Sección" stackId="a" fill={TYPE_COLORS.SECTION} />
                  <Bar dataKey="Tabla" stackId="a" fill={TYPE_COLORS.TABLE} />
                  <Bar dataKey="Texto" stackId="a" fill={TYPE_COLORS.TEXT} />
                  <Bar dataKey="Nota" stackId="a" fill={TYPE_COLORS.FOOTNOTE} />
                  <Bar dataKey="Encabezado" stackId="a" fill={TYPE_COLORS.HEADING} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  LayoutDashboard,
  FileText,
  Boxes,
  MessageSquare,
  Activity,
  Star,
  Gauge,
  Zap,
  Clock,
  TrendingUp,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Upload,
} from 'lucide-react';
import { fetchDashboard, type DashboardResponse } from '@/lib/rag-client';
import { useAnimatedCounter } from './use-animated-counter';
import { DocTypeBadge, ConfidenceBadge } from './badges';
import { TimelineChartCard } from './timeline-chart-card';
import { AlertsCard } from './alerts-card';
import { toast } from 'sonner';

interface DashboardPanelProps {
  onNavigate: (tab: string) => void;
}

export function DashboardPanel({ onNavigate }: DashboardPanelProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [timelineGranularity, setTimelineGranularity] = useState<'day' | 'hour'>('day');

  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar dashboard', { description: err.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 overflow-y-auto rag-scroll pr-1">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto rag-scroll pr-1">
      {/* Header del dashboard */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center rag-glow">
            <LayoutDashboard className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Dashboard ejecutivo</h2>
            <p className="text-xs text-muted-foreground">
              Vista general del sistema RAG en tiempo real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 rag-pulse-soft" />
          <span className="text-[10px] text-muted-foreground">Actualizado ahora</span>
        </div>
      </div>

      {/* Stat cards animadas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnimatedStatCard
          icon={<FileText className="size-4" />}
          label="Documentos"
          value={data.stats.activeDocs}
          sub={`${data.stats.totalDocs} total`}
          tone="emerald"
          delay={0}
        />
        <AnimatedStatCard
          icon={<Boxes className="size-4" />}
          label="Fragmentos"
          value={data.stats.totalChunks}
          sub="indexados"
          tone="blue"
          delay={80}
        />
        <AnimatedStatCard
          icon={<MessageSquare className="size-4" />}
          label="Consultas"
          value={data.stats.totalQueries}
          sub={`${data.stats.avgLatency}ms avg`}
          tone="violet"
          delay={160}
        />
        <AnimatedStatCard
          icon={<Gauge className="size-4" />}
          label="Confianza media"
          value={Math.round(data.stats.avgConfidence * 100)}
          suffix="%"
          sub={data.stats.favDocs > 0 ? `★ ${data.stats.favDocs} favoritos` : 'sin favoritos'}
          tone="amber"
          delay={240}
        />
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Acciones rápidas:
        </span>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onNavigate('chat')}>
          <Sparkles className="size-3 mr-1" />
          Nueva pregunta
          <ArrowRight className="size-3 ml-1" />
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onNavigate('ingest')}>
          <Upload className="size-3 mr-1" />
          Ingerir documento
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onNavigate('evaluation')}>
          <FlaskConical className="size-3 mr-1" />
          Ejecutar evaluación
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Timeline de actividad reciente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Actividad reciente
            </CardTitle>
            <CardDescription className="text-xs">
              Últimas {data.recentQueries.length} consultas registradas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {data.recentQueries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sin consultas aún. ¡Haz tu primera pregunta en el chat!
              </p>
            ) : (
              data.recentQueries.map((q) => (
                <div
                  key={q.id}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => onNavigate('history')}
                >
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className={`size-2 rounded-full ${q.noEvidence ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <div className="w-px h-full bg-border/40 flex-1 mt-1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {q.question}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <ConfidenceBadge confidence={q.confidence as 'high' | 'medium' | 'low'} score={q.confidenceScore} />
                      <Badge variant="outline" className="text-[9px]">
                        <Clock className="size-2.5 mr-0.5" />
                        {q.latencyMs}ms
                      </Badge>
                      {q.document && <DocTypeBadge type={q.document.docType} />}
                      {q.noEvidence && (
                        <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                          Sin evidencia
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {new Date(q.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Documentos recientes + distribución */}
        <div className="space-y-4">
          {/* Documentos recientes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Documentos recientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.recentDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin documentos. Ingera uno desde la pestaña Ingesta.
                </p>
              ) : (
                data.recentDocs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => onNavigate('documents')}
                  >
                    <FileText className="size-3 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug truncate group-hover:text-primary transition-colors">
                        {d.favorite && <Star className="size-2.5 text-amber-500 fill-current inline mr-1" />}
                        {d.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <DocTypeBadge type={d.docType} />
                        <span className="text-[9px] text-muted-foreground">{d.chunkCount} chunks</span>
                        <span className="text-[9px] text-muted-foreground ml-auto">
                          {new Date(d.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Favoritos */}
          {data.recentDocs.some((d) => d.favorite) && (
            <Card className="border-amber-500/20 bg-amber-500/[0.03]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="size-3.5 text-amber-500 fill-current" />
                  Favoritos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.recentDocs.filter((d) => d.favorite).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer group"
                    onClick={() => onNavigate('documents')}
                  >
                    <Star className="size-3 text-amber-500 fill-current shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug truncate group-hover:text-primary transition-colors">
                        {d.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <DocTypeBadge type={d.docType} />
                        <span className="text-[9px] text-muted-foreground">{d.chunkCount} chunks</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Distribución por tipo */}
          {data.byType.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="size-3.5 text-primary" />
                  Distribución por tipo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.byType.map((t) => {
                  const total = data.stats.totalDocs || 1;
                  const pct = Math.round((t.count / total) * 100);
                  const color = typeColor(t.docType);
                  return (
                    <div key={t.docType} className="space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{typeLabel(t.docType)}</span>
                        <span className="text-muted-foreground">{t.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Alertas de métricas */}
      <AlertsCard onNavigate={onNavigate} />

      {/* Timeline de actividad (chart) */}
      <TimelineChartCard granularity={timelineGranularity} onGranularityChange={setTimelineGranularity} />

      {/* Última evaluación */}
      {data.lastEval && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" />
                Última evaluación RAGAS-like
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {data.lastEval.questionCount} preguntas
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(data.lastEval.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => onNavigate('evaluation')}>
                  Ver detalle
                  <ArrowRight className="size-3 ml-0.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Faithfulness', value: data.lastEval.faithfulness, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500' },
                { label: 'Relevancy', value: data.lastEval.answerRelevancy, color: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-500' },
                { label: 'Ctx Precision', value: data.lastEval.contextPrecision, color: 'text-violet-600 dark:text-violet-300', bg: 'bg-violet-500' },
                { label: 'Ctx Recall', value: data.lastEval.contextRecall, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-500' },
                { label: 'Citation Acc', value: data.lastEval.citationAccuracy, color: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-500' },
              ].map((m) => {
                const pct = Math.round(m.value * 100);
                return (
                  <div key={m.label} className="text-center space-y-1">
                    <div className={`text-2xl font-bold rag-mono ${m.color}`}>{pct}%</div>
                    <div className="text-[9px] text-muted-foreground truncate">{m.label}</div>
                    <Progress value={pct} className={`h-1 [&>div]:${m.bg}`} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AnimatedStatCard({
  icon,
  label,
  value,
  sub,
  suffix = '',
  tone,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  suffix?: string;
  tone: 'emerald' | 'blue' | 'violet' | 'amber';
  delay?: number;
}) {
  const animated = useAnimatedCounter(value);
  const tones = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-300', icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' },
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-300', icon: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' },
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-300', icon: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-300', icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-300' },
  };
  const t = tones[tone];
  return (
    <Card className={`overflow-hidden ${t.bg} rag-card-enter`} style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`size-8 rounded-lg flex items-center justify-center ${t.icon}`}>
            {icon}
          </div>
          <Zap className="size-3 text-muted-foreground/30" />
        </div>
        <div className={`text-3xl font-bold rag-mono ${t.text}`}>
          {Math.round(animated).toLocaleString('es-AR')}{suffix}
        </div>
        <div className="text-xs text-foreground/70 font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function typeLabel(t: string): string {
  switch (t) {
    case 'BALANCE': return 'Balance';
    case 'CONTRACT': return 'Contrato';
    case 'REGULATION': return 'Normativa';
    default: return 'Otro';
  }
}

function typeColor(t: string): string {
  switch (t) {
    case 'BALANCE': return 'bg-emerald-500';
    case 'CONTRACT': return 'bg-amber-500';
    case 'REGULATION': return 'bg-violet-500';
    default: return 'bg-slate-500';
  }
}

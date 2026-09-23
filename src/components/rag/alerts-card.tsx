'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Bell,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { fetchAlerts, type AlertsResponse, type MetricAlert } from '@/lib/rag-client';
import { toast } from 'sonner';

const SEVERITY_CONFIG = {
  critical: {
    icon: <XCircle className="size-3.5" />,
    color: 'text-rose-600 dark:text-rose-300',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    bar: 'bg-rose-500',
    label: 'Crítico',
  },
  warning: {
    icon: <AlertTriangle className="size-3.5" />,
    color: 'text-amber-600 dark:text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
    label: 'Advertencia',
  },
  ok: {
    icon: <CheckCircle2 className="size-3.5" />,
    color: 'text-emerald-600 dark:text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
    label: 'OK',
  },
} as const;

interface AlertsCardProps {
  onNavigate?: (tab: string) => void;
}

export function AlertsCard({ onNavigate }: AlertsCardProps) {
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAlerts()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar alertas', { description: err.message });
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
            <Bell className="size-4 text-primary" />
            Alertas de métricas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.hasLastRun) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            Alertas de métricas
          </CardTitle>
          <CardDescription className="text-xs">
            Ejecuta una evaluación para activar las alertas de threshold.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasIssues = data.summary.critical > 0 || data.summary.warning > 0;

  return (
    <Card className={hasIssues ? 'border-amber-500/30' : 'border-emerald-500/30'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className={`size-4 ${hasIssues ? 'text-amber-500' : 'text-emerald-500'}`} />
            Alertas de métricas
            {hasIssues && (
              <Badge variant="outline" className={`text-[9px] ${data.summary.critical > 0 ? 'text-rose-600 border-rose-500/30 bg-rose-500/10' : 'text-amber-600 border-amber-500/30 bg-amber-500/10'}`}>
                <ShieldAlert className="size-2.5 mr-0.5" />
                {data.summary.critical + data.summary.warning} alerta{(data.summary.critical + data.summary.warning) === 1 ? '' : 's'}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px]"
            onClick={() => onNavigate?.('evaluation')}
          >
            Ver evaluación
            <ArrowRight className="size-3 ml-0.5" />
          </Button>
        </div>
        {data.runDate && (
          <CardDescription className="text-xs">
            Última evaluación: {new Date(data.runDate).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {data.alerts.map((alert) => (
          <AlertRow key={alert.metric} alert={alert} />
        ))}
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: MetricAlert }) {
  const config = SEVERITY_CONFIG[alert.severity];
  const pct = Math.round(alert.value * 100);
  const thresholdPct = Math.round(alert.threshold * 100);

  return (
    <div className={`rounded-lg border p-2.5 ${config.border} ${config.bg}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={config.color}>{config.icon}</span>
          <span className="text-xs font-medium">{alert.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono font-bold">{pct}%</span>
          <span className="text-[9px] text-muted-foreground">/ {thresholdPct}%</span>
        </div>
      </div>
      {/* Barra de progreso con marcador de threshold */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${config.bar} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
        {/* Marcador de threshold */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/40"
          style={{ left: `${thresholdPct}%` }}
          title={`Threshold: ${thresholdPct}%`}
        />
      </div>
      <p className={`text-[10px] mt-1 ${config.color}`}>{alert.message}</p>
    </div>
  );
}

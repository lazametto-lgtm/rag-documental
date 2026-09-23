'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  History,
  Search,
  Trash2,
  RefreshCw,
  ChevronDown,
  Clock,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Play,
} from 'lucide-react';
import { fetchHistory, clearHistory, type HistoryItem } from '@/lib/rag-client';
import { DocTypeBadge, ConfidenceBadge } from './badges';
import { useChatStore } from './store';
import { toast } from 'sonner';

export function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const addMessage = useChatStore((s) => s.addMessage);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchHistory({
        q: search || undefined,
        docType: filterType !== 'ALL' ? filterType : undefined,
        limit: 200,
      });
      setItems(res.queries);
    } catch (err) {
      toast.error('Error al cargar historial', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filterType]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => void load(), 350);
    return () => clearTimeout(id);
  }, [search]);

  const onClear = async () => {
    if (!confirm('¿Eliminar todo el historial de consultas? Esta acción no se puede deshacer.')) return;
    try {
      const res = await clearHistory();
      toast.success(`${res.deleted} registros eliminados`);
      void load();
    } catch (err) {
      toast.error('Error al limpiar historial', { description: (err as Error).message });
    }
  };

  const replayQuestion = (item: HistoryItem) => {
    // Llenar el chat con la pregunta y enviar
    addMessage({
      id: `replay_${item.id}`,
      role: 'user',
      content: item.question,
      createdAt: Date.now(),
    });
    toast.success('Pregunta cargada en el chat', {
      description: 'Ve a la pestaña Chat para ver/enviar.',
    });
  };

  const stats = useMemo(() => {
    const total = items.length;
    const withEvidence = items.filter((i) => !i.noEvidence).length;
    const noEvidence = items.filter((i) => i.noEvidence).length;
    const avgLatency = total > 0
      ? Math.round(items.reduce((s, i) => s + i.latencyMs, 0) / total)
      : 0;
    const avgConfidence = total > 0
      ? items.reduce((s, i) => s + i.confidenceScore, 0) / total
      : 0;
    return { total, withEvidence, noEvidence, avgLatency, avgConfidence };
  }, [items]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniStat icon={<History className="size-3.5" />} label="Total" value={stats.total} tone="primary" />
        <MiniStat icon={<CheckCircle2 className="size-3.5" />} label="Con evidencia" value={stats.withEvidence} tone="emerald" />
        <MiniStat icon={<AlertTriangle className="size-3.5" />} label="Sin evidencia" value={stats.noEvidence} tone="amber" />
        <MiniStat icon={<Clock className="size-3.5" />} label="Latencia media" value={`${stats.avgLatency}ms`} tone="blue" />
      </div>

      {/* Barra de búsqueda + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en preguntas y respuestas…"
            className="pl-8"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="BALANCE">Balances</SelectItem>
            <SelectItem value="CONTRACT">Contratos</SelectItem>
            <SelectItem value="REGULATION">Normativas</SelectItem>
            <SelectItem value="OTHER">Otros</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} title="Recargar">
          <RefreshCw className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onClear}
          title="Limpiar historial"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1">
        {loading ? (
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyHistory onReload={load} />
        ) : (
          <div className="grid gap-2">
            {items.map((item) => (
              <HistoryCard key={item.id} item={item} onOpen={() => setSelected(item)} onReplay={() => replayQuestion(item)} />
            ))}
          </div>
        )}
      </div>

      {/* Diálogo de detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-base">
              <History className="size-4 mt-0.5 text-primary shrink-0" />
              Detalle de consulta
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selected && new Date(selected.createdAt).toLocaleString('es-AR')}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 overflow-y-auto rag-scroll pr-1">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Pregunta</p>
                <p className="text-sm font-medium p-2 rounded bg-muted/60">{selected.question}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ConfidenceBadge confidence={selected.confidence} score={selected.confidenceScore} />
                {selected.noEvidence && (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
                    Sin evidencia
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <Database className="size-3 mr-1" />
                  {selected.llmProvider}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Clock className="size-3 mr-1" />
                  {selected.latencyMs}ms
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {selected.citationsCount} citas
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {selected.retrievedCount} chunks
                </Badge>
              </div>
              {selected.warnings.length > 0 && (
                <div className="flex flex-col gap-1">
                  {selected.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                      <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Respuesta</p>
                <pre className="text-sm p-3 rounded bg-primary/5 border border-primary/20 whitespace-pre-wrap rag-mono leading-relaxed max-h-80 overflow-y-auto rag-scroll">
                  {selected.answer || '(respuesta vacía)'}
                </pre>
              </div>
              {selected.document && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-3" />
                  Documento principal: <strong className="text-foreground">{selected.document.title}</strong>
                  <DocTypeBadge type={selected.document.docType} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'primary' | 'emerald' | 'amber' | 'blue';
}) {
  const tones = {
    primary: 'text-primary bg-primary/10',
    emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10',
    amber: 'text-amber-600 dark:text-amber-300 bg-amber-500/10',
    blue: 'text-blue-600 dark:text-blue-300 bg-blue-500/10',
  };
  return (
    <Card>
      <CardContent className="p-2.5 flex items-center gap-2">
        <div className={`size-7 rounded-full flex items-center justify-center ${tones[tone]}`}>
          {icon}
        </div>
        <div className="leading-tight">
          <div className="text-lg font-bold rag-mono">{value}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyHistory({ onReload }: { onReload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
      <div className="size-12 rounded-full bg-muted/40 flex items-center justify-center">
        <History className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Sin consultas en el historial</p>
        <p className="text-sm text-muted-foreground">
          Las preguntas que hagas en el chat se registrarán aquí para trazabilidad.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onReload}>
        <RefreshCw className="size-3.5 mr-1" />
        Recargar
      </Button>
    </div>
  );
}

function HistoryCard({
  item,
  onOpen,
  onReplay,
}: {
  item: HistoryItem;
  onOpen: () => void;
  onReplay: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden hover:border-primary/40 transition-colors">
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-2">
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <History className="size-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight line-clamp-2">{item.question}</p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  <ConfidenceBadge confidence={item.confidence} score={item.confidenceScore} />
                  {item.noEvidence && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                      Sin evidencia
                    </Badge>
                  )}
                  {item.document && <DocTypeBadge type={item.document.docType} />}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-[10px] text-muted-foreground">· {item.latencyMs}ms</span>
                  <span className="text-[10px] text-muted-foreground">· {item.citationsCount} citas</span>
                </div>
              </div>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-3 pb-3 border-t border-border/60 pt-3 space-y-2">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wide">Respuesta</p>
              <pre className="text-xs p-2 rounded bg-muted/60 whitespace-pre-wrap rag-mono leading-relaxed max-h-40 overflow-y-auto rag-scroll">
                {item.answer || '(respuesta vacía)'}
              </pre>
            </div>
            {item.warnings.length > 0 && (
              <div className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="size-3 mt-0.5 shrink-0" />
                <span>{item.warnings.join('; ')}</span>
              </div>
            )}
            {item.document && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileText className="size-3" />
                {item.document.title}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="text-xs" onClick={onOpen}>
                Ver completo
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" onClick={onReplay}>
                <Play className="size-3 mr-1" />
                Reenviar en chat
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

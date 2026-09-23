'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Database,
  Boxes,
  Activity,
  HardDrive,
  Cpu,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { useChatStore } from './store';
import { fetchStats, fetchCollections, type StatsResponse, type CollectionItem } from '@/lib/rag-client';

export function StatsSidebar() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { filters, setFilters, resetFilters } = useChatStore();

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([fetchStats(), fetchCollections()]);
      setStats(s);
      setCollections(c.collections);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto rag-scroll pr-1">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          icon={<FileText className="size-3.5" />}
          label="Documentos"
          value={stats?.activeDocuments ?? 0}
          sub={stats ? `${stats.documents} total` : ''}
          loading={loading}
          tone="emerald"
        />
        <StatTile
          icon={<Boxes className="size-3.5" />}
          label="Fragmentos"
          value={stats?.chunks ?? 0}
          sub={stats ? `${stats.inMemoryVectors} en memoria` : ''}
          loading={loading}
          tone="blue"
        />
        <StatTile
          icon={<Activity className="size-3.5" />}
          label="Consultas"
          value={stats?.queryLogs ?? 0}
          sub="logs"
          loading={loading}
          tone="violet"
        />
        <StatTile
          icon={<Database className="size-3.5" />}
          label="Colecciones"
          value={stats?.collections ?? 0}
          sub={stats ? `${stats.evaluationRuns} eval runs` : ''}
          loading={loading}
          tone="amber"
        />
      </div>

      {/* Backend info */}
      {stats && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <HardDrive className="size-3 text-muted-foreground" />
              Backend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 py-2 space-y-1 text-xs">
            {[
              ['Vector DB', stats.storage.vectorBackend.split('(')[0].trim()],
              ['BM25', stats.storage.bm25Backend.split('(')[0].trim()],
              ['Embedder', stats.storage.embedder.split('(')[0].trim()],
              ['LLM', stats.storage.llmProvider.split('(')[0].trim()],
              ['Reranker', stats.storage.reranker.split('(')[0].trim()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-right text-[10px]">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Distribución por tipo */}
      {stats && stats.byType.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs">Distribución por tipo</CardTitle>
          </CardHeader>
          <CardContent className="px-3 py-2 space-y-1">
            {stats.byType.map((b) => {
              const total = stats.documents || 1;
              const pct = Math.round((b.count / total) * 100);
              return (
                <div key={b.docType} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span>{labelType(b.docType)}</span>
                    <span className="text-muted-foreground">{b.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colorForType(b.docType)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Filtros del chat */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Filter className="size-3 text-primary" />
            Filtros del chat
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 py-2 space-y-2 overflow-y-auto rag-scroll flex-1">
          <div className="space-y-1">
            <Label className="text-xs">Tipo de documento</Label>
            <Select
              value={filters.docType ?? 'ALL'}
              onValueChange={(v) => setFilters({ docType: v === 'ALL' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="BALANCE">Balance</SelectItem>
                <SelectItem value="CONTRACT">Contrato</SelectItem>
                <SelectItem value="REGULATION">Normativa</SelectItem>
                <SelectItem value="OTHER">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select
              value={filters.status ?? 'ALL'}
              onValueChange={(v) => setFilters({ status: v === 'ALL' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="VIGENT">Vigente</SelectItem>
                <SelectItem value="SUPERSEDED">Derogado</SelectItem>
                <SelectItem value="DRAFT">Borrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Jurisdicción</Label>
            <Select
              value={filters.jurisdiction ?? 'ALL'}
              onValueChange={(v) => setFilters({ jurisdiction: v === 'ALL' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                <SelectItem value="AR">Argentina</SelectItem>
                <SelectItem value="EU">Unión Europea</SelectItem>
                <SelectItem value="US">Estados Unidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Colección</Label>
            <Select
              value={filters.collectionId ?? 'ALL'}
              onValueChange={(v) => setFilters({ collectionId: v === 'ALL' ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.documentCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetFilters}>
            <RotateCcw className="size-3 mr-1" />
            Limpiar filtros
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  loading: boolean;
  tone: 'emerald' | 'blue' | 'violet' | 'amber';
}) {
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10',
    blue: 'text-blue-600 dark:text-blue-300 bg-blue-500/10',
    violet: 'text-violet-600 dark:text-violet-300 bg-violet-500/10',
    amber: 'text-amber-600 dark:text-amber-300 bg-amber-500/10',
  };
  if (loading) {
    return <Skeleton className="h-20 rounded-lg" />;
  }
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2.5">
        <div className={`size-6 rounded-full flex items-center justify-center ${tones[tone]} mb-1.5`}>
          {icon}
        </div>
        <div className="text-xl font-bold rag-mono">{value}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
        {sub && <div className="text-[9px] text-muted-foreground/70">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function labelType(t: string): string {
  switch (t) {
    case 'BALANCE': return 'Balance';
    case 'CONTRACT': return 'Contrato';
    case 'REGULATION': return 'Normativa';
    default: return 'Otro';
  }
}

function colorForType(t: string): string {
  switch (t) {
    case 'BALANCE': return 'bg-emerald-500';
    case 'CONTRACT': return 'bg-amber-500';
    case 'REGULATION': return 'bg-violet-500';
    default: return 'bg-slate-500';
  }
}

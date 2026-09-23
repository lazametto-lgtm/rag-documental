'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, Search, Loader2, ChevronRight, FileText, Database, Gauge } from 'lucide-react';
import { semanticSearch, type SemanticSearchResult } from '@/lib/rag-client';
import { DocTypeBadge, ChunkTypeBadge } from './badges';
import { toast } from 'sonner';

interface SemanticSearchModalProps {
  open: boolean;
  onClose: () => void;
  onPickChunk?: (chunkId: string) => void;
}

export function SemanticSearchModal({ open, onClose, onPickChunk }: SemanticSearchModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="size-4 text-primary" />
            Búsqueda semántica
          </DialogTitle>
          <DialogDescription className="text-xs">
            Busca por significado, no por texto exacto. Usa embeddings vectoriales para encontrar fragmentos conceptualmente similares.
          </DialogDescription>
        </DialogHeader>
        {open ? <SemanticSearchLoader onPickChunk={onPickChunk} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SemanticSearchLoader({ onPickChunk }: { onPickChunk?: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [docType, setDocType] = useState<string>('ALL');
  const [meta, setMeta] = useState<{ embedder: string; dimensions: number; total: number } | null>(null);

  const search = async (q: string) => {
    if (q.trim().length < 3) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await semanticSearch(q.trim(), {
        topK: 10,
        docType: docType !== 'ALL' ? docType : undefined,
      });
      setResults(res.results);
      setMeta({ embedder: res.embedder, dimensions: res.dimensions, total: res.total });
      setLoading(false);
    } catch (err) {
      toast.error('Error en búsqueda semántica', { description: (err as Error).message });
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(query)}
            placeholder="Describe lo que buscas (ej: 'obligaciones del proveedor')"
            className="pl-9"
            autoFocus
          />
        </div>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="BALANCE">Balances</SelectItem>
            <SelectItem value="CONTRACT">Contratos</SelectItem>
            <SelectItem value="REGULATION">Normativas</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => search(query)} disabled={query.trim().length < 3 || loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
        </Button>
      </div>

      {/* Meta info */}
      {meta && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="text-[9px]">
            <Database className="size-2.5 mr-1" />
            {meta.embedder}
          </Badge>
          <Badge variant="outline" className="text-[9px]">
            <Gauge className="size-2.5 mr-1" />
            {meta.dimensions} dim
          </Badge>
          <span>{meta.total} resultados encontrados</span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1 space-y-2">
        {loading && (
          <div className="grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
            <Brain className="size-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Sin resultados semánticos para "<strong>{query}</strong>".
            </p>
          </div>
        )}

        {results.map((r) => (
          <Card
            key={r.chunkId}
            className="overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group"
            onClick={() => onPickChunk?.(r.chunkId)}
          >
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-xs text-primary">#{r.rank}</span>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {r.score.toFixed(3)}
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FileText className="size-3 text-muted-foreground" />
                    <span className="text-xs font-medium truncate">{r.documentTitle}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <DocTypeBadge type={r.docType} />
                    <ChunkTypeBadge type={r.chunkType} />
                    <span className="text-[9px] text-muted-foreground">pág. {r.page}</span>
                    {r.section && <span className="text-[9px] text-muted-foreground">· {r.section}</span>}
                    {r.clauseRef && <span className="text-[9px] text-muted-foreground">· {r.clauseRef}</span>}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Snippet con highlight */}
              <div className="text-xs p-2 rounded bg-muted/40 border border-border/60 rag-mono leading-relaxed">
                {r.snippet}
              </div>
              {/* Barra de score */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.round(r.score * 100)}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground font-mono">{Math.round(r.score * 100)}% sim</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

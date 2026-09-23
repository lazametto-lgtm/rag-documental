'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  FileText,
  Loader2,
  ChevronRight,
  Highlighter,
  AlertCircle,
} from 'lucide-react';
import {
  fullTextSearch,
  type SearchResult,
} from '@/lib/rag-client';
import { DocTypeBadge } from './badges';
import { toast } from 'sonner';

interface FullTextSearchModalProps {
  open: boolean;
  onClose: () => void;
  onPickDocument?: (id: string) => void;
}

export function FullTextSearchModal({ open, onClose, onPickDocument }: FullTextSearchModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Highlighter className="size-4 text-primary" />
            Búsqueda en texto completo
          </DialogTitle>
          <DialogDescription className="text-xs">
            Busca cualquier término en el contenido de TODOS los documentos. Muestra snippets con el contexto del match.
          </DialogDescription>
        </DialogHeader>
        {open && <SearchLoader onPickDocument={onPickDocument} />}
      </DialogContent>
    </Dialog>
  );
}

function SearchLoader({ onPickDocument }: { onPickDocument?: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Debounce search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fullTextSearch(trimmed);
        if (!cancelled) {
          setResults(res.results);
          setSearched(true);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Error en búsqueda', { description: (err as Error).message });
          setLoading(false);
        }
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const showEmpty = query.trim().length > 0 && query.trim().length < 2;

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar término o frase exacta…"
          className="pl-9"
          autoFocus
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {searched && !loading && (
            <>
              <strong className="text-foreground">{results.length}</strong> documento{results.length === 1 ? '' : 's'} con coincidencias
            </>
          )}
        </span>
        {showEmpty && (
          <span className="text-amber-600">Escribe al menos 2 caracteres</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1 space-y-2">
        {loading && results.length === 0 && (
          <div className="grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
            <AlertCircle className="size-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium">Sin resultados</p>
              <p className="text-sm text-muted-foreground">
                No se encontró "<strong>{query}</strong>" en ningún documento.
              </p>
            </div>
          </div>
        )}

        {results.map((r) => (
          <SearchResultCard key={r.id} result={r} query={query} onOpen={() => onPickDocument?.(r.id)} />
        ))}
      </div>
    </>
  );
}

function SearchResultCard({ result: r, query, onOpen }: { result: SearchResult; query: string; onOpen: () => void }) {
  return (
    <Card className="overflow-hidden hover:border-primary/40 transition-colors cursor-pointer" onClick={onOpen}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <FileText className="size-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm leading-tight line-clamp-1">{r.title}</p>
              <Badge variant="outline" className="text-[10px]">
                {r.matchCount} coincidencia{r.matchCount === 1 ? '' : 's'}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <DocTypeBadge type={r.docType} />
              {r.entity && <Badge variant="outline" className="text-[10px]">{r.entity}</Badge>}
              {r.period && <Badge variant="outline" className="text-[10px]">{r.period}</Badge>}
              <span className="text-[10px] text-muted-foreground ml-auto">{r.chunkCount} fragmentos · {r.pageCount} pág.</span>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </div>

        {/* Snippets con highlight */}
        <div className="space-y-1.5">
          {r.snippets.map((s, i) => (
            <div
              key={i}
              className="text-xs p-2 rounded bg-muted/40 border border-border/60 rag-mono leading-relaxed"
            >
              {highlightSnippet(s.text, query)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Resalta el query dentro del snippet con <mark>
function highlightSnippet(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQ, cursor);
    if (idx === -1) {
      parts.push(<span key={key++}>{text.slice(cursor)}</span>);
      break;
    }
    if (idx > cursor) {
      parts.push(<span key={key++}>{text.slice(cursor, idx)}</span>);
    }
    parts.push(
      <mark key={key++} className="bg-primary/30 text-foreground rounded px-0.5 font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>,
    );
    cursor = idx + query.length;
  }
  return <>{parts}</>;
}

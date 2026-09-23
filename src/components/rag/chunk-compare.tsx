'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GitCompareArrows,
  Loader2,
  Plus,
  Minus,
  Equal,
  FileText,
  X,
  Table as TableIcon,
} from 'lucide-react';
import { compareChunks, type CompareChunk } from '@/lib/rag-client';
import { DocTypeBadge, ChunkTypeBadge } from './badges';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface ChunkCompareModalProps {
  // Lista de chunk IDs seleccionados (2-4)
  chunkIds: string[];
  onClose: () => void;
}

export function ChunkCompareModal({ chunkIds, onClose }: ChunkCompareModalProps) {
  return (
    <Dialog open={chunkIds.length >= 2} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-primary" />
            Comparación de fragmentos
            <Badge variant="outline" className="text-[10px] ml-2">
              {chunkIds.length} fragmentos
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Diferencias línea por línea (LCS) entre los fragmentos seleccionados.
            Verde = presente, rojo = ausente en el comparado.
          </DialogDescription>
        </DialogHeader>
        <CompareLoader key={chunkIds.join(',')} chunkIds={chunkIds} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function CompareLoader({ chunkIds, onClose }: { chunkIds: string[]; onClose: () => void }) {
  const [chunks, setChunks] = useState<CompareChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    compareChunks(chunkIds)
      .then((res) => {
        if (cancelled) return;
        setChunks(res.chunks);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
        toast.error('Error al comparar', { description: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [chunkIds]);

  if (loading) {
    return (
      <div className="flex-1 min-h-0 space-y-3 p-1">
        <div className="grid gap-3 grid-cols-2">
          {Array.from({ length: chunkIds.length }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-sm p-4 text-center">{error}</div>;
  }

  if (chunks.length === 0) {
    return <div className="text-muted-foreground text-sm p-4 text-center">Sin fragmentos</div>;
  }

  return <CompareView chunks={chunks} onClose={onClose} />;
}

function CompareView({ chunks, onClose }: { chunks: CompareChunk[]; onClose: () => void }) {
  // Para 2 chunks: diff línea a línea (LCS)
  // Para 3-4: vista lado a lado con highlights de líneas únicas
  const isPairwise = chunks.length === 2;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Headers de cada chunk */}
      <div className={`grid gap-3 ${isPairwise ? 'grid-cols-2' : chunks.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {chunks.map((c, i) => (
          <ChunkHeader key={c.id} chunk={c} index={i} />
        ))}
      </div>

      {/* Diffs / contenido lado a lado */}
      <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1">
        {isPairwise ? (
          <PairwiseDiff left={chunks[0]} right={chunks[1]} />
        ) : (
          <MultiCompare chunks={chunks} />
        )}
      </div>

      {/* Estadísticas del diff */}
      {isPairwise && <DiffStats left={chunks[0]} right={chunks[1]} />}
    </div>
  );
}

function ChunkHeader({ chunk: c, index }: { chunk: CompareChunk; index: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-primary">#{index + 1}</span>
        <DocTypeBadge type={c.document.docType} />
        <ChunkTypeBadge type={c.chunkType} />
      </div>
      <p className="text-xs font-medium leading-tight line-clamp-2">{c.document.title}</p>
      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
        <span>pág. {c.page}</span>
        {c.section && <span>· {c.section}</span>}
        {c.clauseRef && <span>· {c.clauseRef}</span>}
        <span>· ~{c.tokenCount} tok</span>
        {c.document.status !== 'VIGENT' && (
          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">
            {c.document.status === 'SUPERSEDED' ? 'Derogado' : 'Borrador'}
          </Badge>
        )}
      </div>
    </div>
  );
}

// Dif línea por línea usando LCS (Longest Common Subsequence)
interface DiffLine {
  type: 'equal' | 'added' | 'removed';
  left?: string;
  right?: string;
  leftNum?: number;
  rightNum?: number;
}

function computeDiff(leftText: string, rightText: string): DiffLine[] {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');
  const m = leftLines.length;
  const n = rightLines.length;

  // DP table para LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (leftLines[i] === rightLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let leftNum = 0;
  let rightNum = 0;
  while (i < m && j < n) {
    if (leftLines[i] === rightLines[j]) {
      leftNum++;
      rightNum++;
      result.push({ type: 'equal', left: leftLines[i], right: rightLines[j], leftNum, rightNum });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      leftNum++;
      result.push({ type: 'removed', left: leftLines[i], leftNum });
      i++;
    } else {
      rightNum++;
      result.push({ type: 'added', right: rightLines[j], rightNum });
      j++;
    }
  }
  while (i < m) {
    leftNum++;
    result.push({ type: 'removed', left: leftLines[i], leftNum });
    i++;
  }
  while (j < n) {
    rightNum++;
    result.push({ type: 'added', right: rightLines[j], rightNum });
    j++;
  }
  return result;
}

function PairwiseDiff({ left, right }: { left: CompareChunk; right: CompareChunk }) {
  const diff = useMemo(() => computeDiff(left.content, right.content), [left, right]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 border-b border-border">
          <div className="px-3 py-2 text-xs font-medium border-r border-border bg-muted/30 flex items-center gap-1.5">
            <FileText className="size-3 text-primary" />
            <span className="truncate">{left.document.title}</span>
          </div>
          <div className="px-3 py-2 text-xs font-medium bg-muted/30 flex items-center gap-1.5">
            <FileText className="size-3 text-primary" />
            <span className="truncate">{right.document.title}</span>
          </div>
        </div>
        <div className="font-mono text-xs">
          {diff.map((d, i) => (
            <DiffRow key={i} line={d} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DiffRow({ line: d }: { line: DiffLine }) {
  if (d.type === 'equal') {
    return (
      <div className="grid grid-cols-2 border-b border-border/30">
        <div className="px-3 py-0.5 border-r border-border/30 flex items-start gap-2">
          <span className="text-muted-foreground/50 text-[10px] select-none w-6 text-right shrink-0">
            {d.leftNum}
          </span>
          <span className="whitespace-pre-wrap break-words text-foreground/80">{d.left}</span>
        </div>
        <div className="px-3 py-0.5 flex items-start gap-2">
          <span className="text-muted-foreground/50 text-[10px] select-none w-6 text-right shrink-0">
            {d.rightNum}
          </span>
          <span className="whitespace-pre-wrap break-words text-foreground/80">{d.right}</span>
        </div>
      </div>
    );
  }
  if (d.type === 'removed') {
    return (
      <div className="grid grid-cols-2 border-b border-border/30">
        <div className="px-3 py-0.5 border-r border-border/30 bg-rose-500/10 flex items-start gap-2">
          <span className="text-rose-500/60 text-[10px] select-none w-6 text-right shrink-0">
            {d.leftNum}
          </span>
          <Minus className="size-3 text-rose-500 mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap break-words text-rose-700 dark:text-rose-300">{d.left}</span>
        </div>
        <div className="px-3 py-0.5 bg-muted/20" />
      </div>
    );
  }
  // added
  return (
    <div className="grid grid-cols-2 border-b border-border/30">
      <div className="px-3 py-0.5 border-r border-border/30 bg-muted/20" />
      <div className="px-3 py-0.5 bg-emerald-500/10 flex items-start gap-2">
        <span className="text-emerald-500/60 text-[10px] select-none w-6 text-right shrink-0">
          {d.rightNum}
        </span>
        <Plus className="size-3 text-emerald-500 mt-0.5 shrink-0" />
        <span className="whitespace-pre-wrap break-words text-emerald-700 dark:text-emerald-300">{d.right}</span>
      </div>
    </div>
  );
}

function DiffStats({ left, right }: { left: CompareChunk; right: CompareChunk }) {
  const diff = useMemo(() => computeDiff(left.content, right.content), [left, right]);
  const equal = diff.filter((d) => d.type === 'equal').length;
  const removed = diff.filter((d) => d.type === 'removed').length;
  const added = diff.filter((d) => d.type === 'added').length;
  const total = equal + removed + added;
  const similarity = total > 0 ? Math.round((equal * 2) / (equal + removed + added) * 100) : 0;

  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <div className="flex items-center gap-1.5">
        <Equal className="size-3 text-muted-foreground" />
        <span>{equal} líneas iguales</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Minus className="size-3 text-rose-500" />
        <span>{removed} eliminadas</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Plus className="size-3 text-emerald-500" />
        <span>{added} añadidas</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground">Similitud:</span>
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${similarity >= 75 ? 'bg-emerald-500' : similarity >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${similarity}%` }}
          />
        </div>
        <span className="font-mono font-medium">{similarity}%</span>
      </div>
    </div>
  );
}

// Vista multi-chunk (3-4): columnas lado a lado, sin diff pero con tabla si aplica
function MultiCompare({ chunks }: { chunks: CompareChunk[] }) {
  return (
    <div className={`grid gap-3 ${chunks.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'}`}>
      {chunks.map((c, i) => (
        <Card key={c.id} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/30 border-b border-border flex items-center gap-1.5">
              <span className="font-mono text-primary">#{i + 1}</span>
              <span className="truncate">{c.document.title}</span>
            </div>
            {c.tableData && c.tableData.headers.length > 0 ? (
              <div className="overflow-x-auto rag-scroll">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      {c.tableData.headers.map((h, j) => (
                        <TableHead key={j} className="text-[10px] rag-mono whitespace-nowrap py-1">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.tableData.rows.map((row, k) => (
                      <TableRow key={k}>
                        {row.map((cell, l) => (
                          <TableCell key={l} className="text-[10px] rag-mono py-1">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <pre className="text-[10px] rag-mono whitespace-pre-wrap p-2 leading-relaxed max-h-96 overflow-y-auto rag-scroll">
                {c.content}
              </pre>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Selector de chunks para comparar (lista con checkboxes)
export function ChunkCompareSelector({
  chunks,
  onCompare,
}: {
  chunks: Array<{ id: string; label: string; chunkType: string }>;
  onCompare: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 4) {
        toast.info('Máximo 4 fragmentos para comparar');
        return cur;
      }
      return [...cur, id];
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <GitCompareArrows className="size-3.5 text-primary" />
          Comparar fragmentos ({selected.length}/4)
        </p>
        <div className="flex items-center gap-1.5">
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected([])}>
              <X className="size-3 mr-1" />
              Limpiar
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={selected.length < 2}
            onClick={() => onCompare(selected)}
          >
            <GitCompareArrows className="size-3 mr-1" />
            Comparar ({selected.length})
          </Button>
        </div>
      </div>
      {chunks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay fragmentos para comparar.</p>
      ) : (
        <div className="grid gap-1 max-h-40 overflow-y-auto rag-scroll pr-1">
          {chunks.map((c) => {
            const checked = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`text-left rounded border p-1.5 text-[11px] transition-colors flex items-center gap-2 ${
                  checked
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 hover:bg-muted/30'
                }`}
              >
                <span
                  className={`size-3 rounded border shrink-0 flex items-center justify-center ${
                    checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                  }`}
                >
                  {checked && <Equal className="size-2" />}
                </span>
                <ChunkTypeBadge type={c.chunkType} />
                <span className="truncate flex-1">{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {selected.length === 1 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          Selecciona al menos 2 fragmentos para comparar.
        </p>
      )}
    </div>
  );
}

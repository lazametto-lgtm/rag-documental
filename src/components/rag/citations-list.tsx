'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, FileText, Quote, AlertTriangle, Eye, Loader2, Table as TableIcon, BookOpen } from 'lucide-react';
import type { Citation, RetrievedChunk } from '@/lib/rag/types';
import { fetchChunkDetail, type ChunkDetail } from '@/lib/rag-client';
import { DocTypeBadge, ChunkTypeBadge } from './badges';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DocumentReader } from './document-reader';

export function CitationsList({
  citations,
  retrievedChunks,
}: {
  citations: Citation[];
  retrievedChunks?: RetrievedChunk[];
}) {
  const [open, setOpen] = useState(true);
  const [viewing, setViewing] = useState<Citation | null>(null);
  const [readingDoc, setReadingDoc] = useState<{ documentId: string; snippet: string; chunkId: string } | null>(null);

  if (citations.length === 0) return null;

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 cursor-pointer hover:bg-primary/[0.06] transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Quote className="size-4 text-primary" />
                  Citas verificables
                  <span className="text-muted-foreground font-normal">({citations.length})</span>
                </CardTitle>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-3 pb-3">
              <div className="grid gap-2">
                {citations.map((c, i) => (
                  <CitationCard
                    key={c.chunkId}
                    citation={c}
                    index={i}
                    onView={() => setViewing(c)}
                    onOpenInDoc={() =>
                      setReadingDoc({ documentId: c.documentId, snippet: c.snippet, chunkId: c.chunkId })
                    }
                  />
                ))}
              </div>
              {retrievedChunks && retrievedChunks.length > citations.length && (
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Eye className="size-3" />
                  {retrievedChunks.length - citations.length} fragmentos recuperados adicionales no citados
                  en la respuesta.
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Modal de visor de fragmento */}
      <ChunkViewerModal citation={viewing} onClose={() => setViewing(null)} />

      {/* Modal de visor de documento completo */}
      <DocumentReader
        documentId={readingDoc?.documentId ?? null}
        snippet={readingDoc?.snippet}
        chunkId={readingDoc?.chunkId}
        onClose={() => setReadingDoc(null)}
      />
    </>
  );
}

function CitationCard({
  citation: c,
  index,
  onView,
  onOpenInDoc,
}: {
  citation: Citation;
  index: number;
  onView: () => void;
  onOpenInDoc: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 text-sm rag-quote-bar pl-3">
      <div className="flex items-start gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 font-mono text-xs text-primary">
          #{index + 1}
        </span>
        <DocTypeBadge type={c.docType} />
        <ChunkTypeBadge type={c.chunkType} />
        <div className="ml-auto flex items-center gap-1 flex-wrap">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => navigator.clipboard?.writeText(formatRef(c))}
                >
                  <FileText className="size-3 mr-1" />
                  <span className="hidden sm:inline">Copiar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar referencia de cita</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs hover:text-primary"
            onClick={onView}
          >
            <Eye className="size-3 mr-1" />
            <span className="hidden sm:inline">Fragmento</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs hover:text-primary"
            onClick={onOpenInDoc}
          >
            <BookOpen className="size-3 mr-1" />
            <span className="hidden sm:inline">En documento</span>
          </Button>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted-foreground rag-mono leading-relaxed">
        <span className="font-semibold text-foreground">{c.documentTitle}</span>
        {' · '}
        <span>pág. {c.page}</span>
        {c.section && <> · sección <span className="text-foreground">{c.section}</span></>}
        {c.clauseRef && <> · <span className="text-foreground">{c.clauseRef}</span></>}
        {c.jurisdiction && <> · {c.jurisdiction}</>}
        {c.entity && <> · {c.entity}</>}
        {c.period && <> · {c.period}</>}
        {c.version && <> · v.{c.version}</>}
        {' · '}score {c.score.toFixed(2)}
      </div>

      <blockquote className="mt-2 text-xs italic text-foreground/80 rag-mono leading-relaxed border-l-2 border-primary/30 pl-2">
        “{c.snippet}”
      </blockquote>

      {c.status !== 'VIGENT' && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3" />
          Documento {c.status === 'SUPERSEDED' ? 'derogado/sustituido' : 'en borrador'}.
        </div>
      )}
    </div>
  );
}

function ChunkViewerModal({ citation, onClose }: { citation: Citation | null; onClose: () => void }) {
  return (
    <Dialog open={!!citation} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base">
            <Eye className="size-4 mt-0.5 text-primary shrink-0" />
            Fragmento completo
          </DialogTitle>
          <DialogDescription className="text-xs">
            {citation && (
              <span className="flex items-center gap-2 flex-wrap mt-1">
                <span className="font-medium text-foreground">{citation.documentTitle}</span>
                <Badge variant="outline" className="text-[10px]">pág. {citation.page}</Badge>
                {citation.section && <Badge variant="outline" className="text-[10px]">{citation.section}</Badge>}
                {citation.clauseRef && <Badge variant="outline" className="text-[10px]">{citation.clauseRef}</Badge>}
                {citation.entity && <Badge variant="outline" className="text-[10px]">{citation.entity}</Badge>}
                {citation.period && <Badge variant="outline" className="text-[10px]">{citation.period}</Badge>}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {citation && (
          <ChunkLoader key={citation.chunkId} chunkId={citation.chunkId} snippet={citation.snippet} />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Componente con key: se reinicia limpio cuando cambia el chunkId.
function ChunkLoader({ chunkId, snippet }: { chunkId: string; snippet: string }) {
  const [chunk, setChunk] = useState<ChunkDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchChunkDetail(chunkId)
      .then((res) => {
        if (!cancelled) {
          setChunk(res.chunk);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
          toast.error('Error al cargar fragmento', { description: err.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chunkId]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1">
      {loading && (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="rag-pulse">Cargando fragmento…</span>
        </div>
      )}
      {error && (
        <div className="text-destructive text-sm p-4 text-center">{error}</div>
      )}
      {chunk && !loading && !error && (
        <ChunkContent chunk={chunk} snippet={snippet} />
      )}
    </div>
  );
}

function ChunkContent({ chunk, snippet }: { chunk: ChunkDetail; snippet: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ChunkTypeBadge type={chunk.chunkType} />
        <Badge variant="outline" className="text-[10px]">
          orden #{chunk.order}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          ~{chunk.tokenCount} tokens
        </Badge>
        {chunk.tableData && (
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
            <TableIcon className="size-3 mr-1" />
            Tabla estructurada
          </Badge>
        )}
      </div>

      {chunk.tableData && chunk.tableData.headers.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto rag-scroll">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  {chunk.tableData.headers.map((h, i) => (
                    <TableHead key={i} className="text-xs rag-mono whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chunk.tableData.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="text-xs rag-mono py-1.5">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <pre className="text-xs rag-mono whitespace-pre-wrap p-3 rounded-lg bg-muted/40 border border-border/60 leading-relaxed">
          {highlightSnippet(chunk.content, snippet)}
        </pre>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-2">
        <FileText className="size-3" />
        <span className="font-medium text-foreground">{chunk.document.title}</span>
        {chunk.document.jurisdiction && <span>· {chunk.document.jurisdiction}</span>}
        {chunk.document.period && <span>· {chunk.document.period}</span>}
        {chunk.document.version && <span>· {chunk.document.version}</span>}
        <Badge variant="outline" className="text-[10px] ml-auto">
          {chunk.document.status === 'VIGENT' ? 'Vigente' : chunk.document.status === 'SUPERSEDED' ? 'Derogado' : 'Borrador'}
        </Badge>
      </div>
    </div>
  );
}

// Resalta el snippet dentro del contenido completo
function highlightSnippet(content: string, snippet: string): React.ReactNode {
  if (!snippet) return content;
  // Normalizar whitespace para comparar
  const normContent = content.replace(/\s+/g, ' ');
  const normSnippet = snippet.replace(/\s+/g, ' ').replace(/…$/, '').trim();
  if (!normSnippet) return content;
  const idx = normContent.indexOf(normSnippet.slice(0, 40));
  if (idx === -1) return content;
  const before = normContent.slice(0, idx);
  const match = normContent.slice(idx, idx + normSnippet.length);
  const after = normContent.slice(idx + normSnippet.length);
  return (
    <>
      {before}
      <mark className="bg-primary/25 text-foreground rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}

function formatRef(c: Citation): string {
  const parts = [
    `[Documento: ${c.documentTitle}`,
    `pág. ${c.page}`,
    c.section ? `sección ${c.section}` : null,
    c.clauseRef,
    c.jurisdiction ? `jurisdicción ${c.jurisdiction}` : null,
    c.entity ? `entidad ${c.entity}` : null,
    c.period ? `período ${c.period}` : null,
    c.version ? `v.${c.version}` : null,
    `chunk ${c.chunkId}]`,
  ].filter(Boolean);
  return parts.join(', ');
}

// Hook utilitario para trackear el último ID procesado
// (eliminado: se usa useEffect con dependencia [citation] en su lugar)

'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  MapPin,
  Building2,
  Calendar,
  Loader2,
  ChevronUp,
  ChevronDown,
  Hash,
  Quote,
  ArrowDownToLine,
} from 'lucide-react';
import {
  fetchDocumentDetail,
  type DocumentDetail,
} from '@/lib/rag-client';
import { DocTypeBadge, StatusBadge, ChunkTypeBadge } from './badges';
import { toast } from 'sonner';

interface DocumentReaderProps {
  documentId: string | null;
  // Snippet a resaltar dentro del texto completo
  snippet?: string;
  // ChunkId para scrollear al chunk
  chunkId?: string;
  onClose: () => void;
}

export function DocumentReader({ documentId, snippet, chunkId, onClose }: DocumentReaderProps) {
  return (
    <Dialog open={!!documentId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base">
            <FileText className="size-4 mt-0.5 text-primary shrink-0" />
            Visor de documento
          </DialogTitle>
          <DialogDescription className="text-xs">
            Texto completo con el fragmento citado resaltado en su contexto original.
          </DialogDescription>
        </DialogHeader>
        {documentId && (
          <DocumentReaderLoader
            key={documentId}
            documentId={documentId}
            snippet={snippet}
            chunkId={chunkId}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DocumentReaderLoader({
  documentId,
  snippet,
  chunkId,
}: {
  documentId: string;
  snippet?: string;
  chunkId?: string;
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChunkIdx, setActiveChunkIdx] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Estado inicial derivado del chunkId
  useEffect(() => {
    let cancelled = false;
    fetchDocumentDetail(documentId)
      .then((res) => {
        if (cancelled) return;
        setDoc(res.document);
        setLoading(false);
        if (chunkId) {
          const idx = res.document.chunks.findIndex((c) => c.id === chunkId);
          if (idx >= 0) setActiveChunkIdx(idx);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
        toast.error('Error al cargar documento', { description: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, chunkId]);

  // Construye el texto con el snippet resaltado
  const rendered = useMemo(() => {
    if (!doc || !doc.rawText) return null;
    return highlightSnippetInText(doc.rawText, snippet ?? '');
  }, [doc, snippet]);

  // Auto-scroll al chunk activo
  useEffect(() => {
    if (!doc || activeChunkIdx < 0) return;
    const el = document.getElementById(`reader-chunk-${activeChunkIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
      }, 2500);
    }
  }, [doc, activeChunkIdx]);

  const jumpChunk = (dir: -1 | 1) => {
    if (!doc) return;
    const next = activeChunkIdx + dir;
    if (next >= 0 && next < doc.chunks.length) {
      setActiveChunkIdx(next);
      const el = document.getElementById(`reader-chunk-${next}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-0 space-y-3 p-1">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-sm p-4 text-center">{error}</div>;
  }

  if (!doc || !rendered) {
    return <div className="text-muted-foreground text-sm p-4 text-center">Sin contenido</div>;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {/* Header de metadatos */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-start gap-2 flex-wrap">
          <FileText className="size-4 mt-0.5 text-primary shrink-0" />
          <h3 className="font-semibold text-sm leading-tight flex-1 min-w-0">{doc.title}</h3>
          <DocTypeBadge type={doc.docType} />
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {doc.jurisdiction && (
            <Badge variant="outline" className="text-[10px]">
              <MapPin className="size-3 mr-1" />
              {doc.jurisdiction}
            </Badge>
          )}
          {doc.entity && (
            <Badge variant="outline" className="text-[10px]">
              <Building2 className="size-3 mr-1" />
              {doc.entity}
            </Badge>
          )}
          {doc.period && (
            <Badge variant="outline" className="text-[10px]">
              <Calendar className="size-3 mr-1" />
              {doc.period}
            </Badge>
          )}
          {doc.version && (
            <Badge variant="outline" className="text-[10px]">
              v.{doc.version}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            <Hash className="size-3 mr-1" />
            {doc.chunks.length} fragmentos · {doc.pageCount} pág.
          </Badge>
        </div>
      </div>

      {/* Barra de navegación de chunks */}
      {doc.chunks.length > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Fragmento:</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => jumpChunk(-1)}
            disabled={activeChunkIdx <= 0}
          >
            <ChevronUp className="size-3.5" />
            <span className="ml-1">Anterior</span>
          </Button>
          <span className="font-mono text-xs">
            {activeChunkIdx >= 0 ? `#${activeChunkIdx + 1}/${doc.chunks.length}` : '—'}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={() => jumpChunk(1)}
            disabled={activeChunkIdx >= doc.chunks.length - 1}
          >
            <ChevronDown className="size-3.5" />
            <span className="ml-1">Siguiente</span>
          </Button>
          {snippet && (
            <Badge variant="outline" className="text-[10px] ml-auto text-primary border-primary/30 bg-primary/10">
              <Quote className="size-3 mr-1" />
              Snippet resaltado
            </Badge>
          )}
        </div>
      )}

      {/* Contenido del documento con chunks overlay */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto rag-scroll rounded-lg border border-border bg-card p-4">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <pre className="whitespace-pre-wrap text-xs rag-mono leading-relaxed font-sans">
            {rendered}
          </pre>
        </div>

        {/* Marcadores de chunks superpuestos (puntos clickeables al margen) */}
        {doc.chunks.length > 0 && (
          <div className="mt-6 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Hash className="size-3" />
              Fragmentos indexados ({doc.chunks.length})
            </p>
            <div className="grid gap-1.5">
              {doc.chunks.map((c, i) => (
                <button
                  key={c.id}
                  id={`reader-chunk-${i}`}
                  onClick={() => setActiveChunkIdx(i)}
                  className={`text-left rounded border p-2 transition-all hover:border-primary/40 ${
                    activeChunkIdx === i
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-[10px] text-primary">#{i + 1}</span>
                    <ChunkTypeBadge type={c.chunkType} />
                    <span className="text-[10px] text-muted-foreground">pág. {c.page}</span>
                    {c.section && <span className="text-[10px] text-muted-foreground">· {c.section}</span>}
                    {c.clauseRef && <span className="text-[10px] text-muted-foreground">· {c.clauseRef}</span>}
                    <span className="text-[10px] text-muted-foreground ml-auto">~{c.tokenCount} tok</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 rag-mono leading-snug">
                    {c.content.slice(0, 140)}{c.content.length > 140 ? '…' : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Normaliza texto para matching robusto: lowercase + colapsa todo no-alfanumérico a espacio.
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Construye un mapa: para cada posición del texto normalizado, la posición original.
// Recorre el texto original carácter por carácter, y por cada carácter alfanumérico
// (post-normalización) avanza el índice normalizado. Los no-alfanuméricos no consumen norm.
function buildNormToOrigMap(fullText: string): number[] {
  const map: number[] = [];
  let normPos = 0;
  for (let orig = 0; orig < fullText.length; orig++) {
    const ch = fullText[orig];
    // Si es whitespace, saltar (se colapsa a un espacio en norm)
    if (/\s/.test(ch)) {
      // El espacio normalizado ya fue contado por el carácter anterior o lo será por el siguiente
      // Pero necesitamos registrar que aquí comienza un "salto". Marcamos la posición norm actual.
      if (map[normPos] === undefined) map[normPos] = orig;
      continue;
    }
    // Si no es alfanumérico ni punto, saltar (se elimina en norm)
    if (!/[a-zA-Z0-9.]/.test(ch)) {
      continue;
    }
    // Es alfanumérico o punto: ocupa una posición en norm
    map[normPos] = orig;
    normPos++;
  }
  return map;
}

// Resalta el snippet dentro del texto completo del documento.
// Estrategia robusta: normaliza quitando puntuación, extrae n-gramas distintivos.
function highlightSnippetInText(fullText: string, snippet: string): React.ReactNode {
  if (!snippet) return fullText;
  const cleanSnippet = snippet.replace(/…$/, '').trim();
  if (cleanSnippet.length < 20) return fullText;

  const normSnippet = normalizeForMatch(cleanSnippet);
  const normFull = normalizeForMatch(fullText);
  if (!normSnippet || !normFull) return fullText;

  const normToOrig = buildNormToOrigMap(fullText);

  // 1) Intentar match exacto normalizado (fingerprint de 40 chars)
  const fingerprint = normSnippet.slice(0, 40);
  const idx = normFull.indexOf(fingerprint);

  const highlights: Array<{ start: number; end: number }> = [];

  if (idx !== -1) {
    const startNorm = idx;
    const endNorm = Math.min(idx + normSnippet.length, normFull.length);
    const startOrig = normToOrig[startNorm] ?? 0;
    // Para el end, buscar la posición original del último carácter del rango norm
    let endOrig = normToOrig[endNorm];
    if (endOrig === undefined) endOrig = fullText.length;
    else endOrig += 1; // +1 porque el mapa apunta al inicio del carácter
    highlights.push({ start: startOrig, end: endOrig });
  } else {
    // 2) Fallback: extraer n-gramas y resaltar cada ocurrencia
    const ngrams = extractNgrams(normSnippet, 3);
    for (const ng of ngrams) {
      if (ng.length < 8) continue;
      let searchFrom = 0;
      while (searchFrom < normFull.length) {
        const found = normFull.indexOf(ng, searchFrom);
        if (found === -1) break;
        const startOrig = normToOrig[found] ?? 0;
        let endOrig = normToOrig[found + ng.length];
        if (endOrig === undefined) endOrig = fullText.length;
        else endOrig += 1;
        highlights.push({ start: startOrig, end: endOrig });
        searchFrom = found + ng.length;
        if (highlights.length >= 20) break;
      }
      if (highlights.length >= 20) break;
    }
  }

  if (highlights.length === 0) return fullText;

  // Merge overlapping highlights
  highlights.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const h of highlights) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) {
      last.end = Math.max(last.end, h.end);
    } else {
      merged.push({ ...h });
    }
  }

  // Render con highlights
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < merged.length; i++) {
    const h = merged[i];
    if (h.start > cursor) {
      out.push(<span key={`t${i}`}>{fullText.slice(cursor, h.start)}</span>);
    }
    out.push(
      <mark key={`m${i}`} className="bg-primary/25 text-foreground rounded px-0.5">
        {fullText.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  if (cursor < fullText.length) {
    out.push(<span key="end">{fullText.slice(cursor)}</span>);
  }
  return <>{out}</>;
}

// Extrae n-gramas de palabras (sin stopwords) de un texto ya normalizado.
function extractNgrams(normText: string, n: number): string[] {
  const stop = new Set([
    'de','la','el','los','las','y','o','a','en','que','con','por','para','del','al','se','su','sus','es','un','una','unos','unas','the','of','and','to','in','for','with','is','are','was','were','this','that',
  ]);
  const words = normText.split(' ').filter((w) => w.length > 1 && !stop.has(w));
  const ngrams: string[] = [];
  for (let i = 0; i + n <= words.length; i++) {
    const ng = words.slice(i, i + n).join(' ');
    if (ng.length >= 8) ngrams.push(ng);
  }
  const uniq = Array.from(new Set(ngrams));
  return uniq.sort((a, b) => b.length - a.length).slice(0, 8);
}

// buildNormToOrigMap y extractNgrams definidos arriba.

'use client';

import { Badge } from '@/components/ui/badge';
import type { DocType, DocStatus, ChunkType } from '@/lib/rag/types';

export function DocTypeBadge({ type }: { type: string }) {
  const t = (type || 'OTHER').toUpperCase() as DocType;
  const variants: Record<DocType, { label: string; color: string }> = {
    BALANCE: { label: 'Balance', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
    CONTRACT: { label: 'Contrato', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    REGULATION: { label: 'Normativa', color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
    OTHER: { label: 'Otro', color: 'bg-muted text-muted-foreground border-border' },
  };
  const v = variants[t] ?? variants.OTHER;
  return <Badge variant="outline" className={`${v.color} font-medium`}>{v.label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || 'VIGENT').toUpperCase() as DocStatus;
  const variants: Record<DocStatus, { label: string; color: string }> = {
    VIGENT: { label: 'Vigente', color: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30' },
    SUPERSEDED: { label: 'Derogado', color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
    DRAFT: { label: 'Borrador', color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  };
  const v = variants[s] ?? variants.VIGENT;
  return <Badge variant="outline" className={`${v.color}`}>{v.label}</Badge>;
}

export function ChunkTypeBadge({ type }: { type: string }) {
  const t = (type || 'TEXT').toUpperCase() as ChunkType;
  const variants: Record<ChunkType, { label: string; color: string }> = {
    ARTICLE: { label: 'Artículo', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/25' },
    CLAUSE: { label: 'Cláusula', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/25' },
    SECTION: { label: 'Sección', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/25' },
    TABLE: { label: 'Tabla', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/25' },
    HEADING: { label: 'Encabezado', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/25' },
    FOOTNOTE: { label: 'Nota', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-300 border-pink-500/25' },
    TEXT: { label: 'Texto', color: 'bg-muted text-muted-foreground border-border' },
  };
  const v = variants[t] ?? variants.TEXT;
  return <Badge variant="outline" className={`${v.color} text-xs`}>{v.label}</Badge>;
}

export function ConfidenceBadge({
  confidence,
  score,
}: {
  confidence: 'high' | 'medium' | 'low';
  score?: number;
}) {
  const variants = {
    high: { label: 'Alta', color: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30' },
    medium: { label: 'Media', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    low: { label: 'Baja', color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
  } as const;
  const v = variants[confidence];
  return (
    <Badge variant="outline" className={`${v.color}`} title={score !== undefined ? `Score: ${score}` : undefined}>
      Confianza {v.label}
      {score !== undefined && <span className="ml-1 opacity-70">· {Math.round(score * 100)}%</span>}
    </Badge>
  );
}

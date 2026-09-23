'use client';

import { useEffect, useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Search,
  Trash2,
  RefreshCw,
  FolderOpen,
  Eye,
  Hash,
  Calendar,
  Building2,
  MapPin,
  ChevronDown,
  BarChart3,
  Star,
  Tag,
} from 'lucide-react';
import { useChatStore } from './store';
import {
  fetchDocuments,
  deleteDocument,
  fetchDocumentDetail,
  toggleFavorite,
  type DocumentItem,
  type DocumentDetail,
} from '@/lib/rag-client';
import { DocTypeBadge, StatusBadge, ChunkTypeBadge } from './badges';
import { ChunkDistributionCard } from './chunk-distribution-card';
import { ChunkCompareSelector, ChunkCompareModal } from './chunk-compare';
import { TagEditor } from './tag-editor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

export function DocumentsPanel() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [favOnly, setFavOnly] = useState(false);
  const [selected, setSelected] = useState<DocumentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const { setFilters } = useChatStore();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchDocuments({
        docType: filterType !== 'ALL' ? filterType : undefined,
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        q: search || undefined,
        favorite: favOnly ? 'true' : undefined,
      });
      setDocs(res.documents);
    } catch (err) {
      toast.error('Error al cargar documentos', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filterType, filterStatus, favOnly]);

  const openDoc = async (d: DocumentItem) => {
    setLoadingDetail(true);
    try {
      const res = await fetchDocumentDetail(d.id);
      setSelected(res.document);
    } catch (err) {
      toast.error('Error al abrir documento', { description: (err as Error).message });
    } finally {
      setLoadingDetail(false);
    }
  };

  const onDelete = async (d: DocumentItem) => {
    try {
      await deleteDocument(d.id, true);
      toast.success(`Documento "${d.title}" marcado como eliminado`);
      void load();
    } catch (err) {
      toast.error('Error al eliminar', { description: (err as Error).message });
    }
  };

  const applyAsFilter = (d: DocumentItem) => {
    setFilters({
      docType: d.docType,
      jurisdiction: d.jurisdiction,
      entity: d.entity,
      period: d.period,
      status: d.status,
      collectionId: d.collectionId,
    });
    toast.success('Filtros aplicados al chat', {
      description: `Tipo ${d.docType}, ${d.jurisdiction ?? '—'}, ${d.entity ?? '—'}`,
    });
  };

  const onToggleFavorite = async (d: DocumentItem) => {
    try {
      const res = await toggleFavorite(d.id);
      // Actualizar el estado local sin recargar todo
      setDocs((cur) =>
        cur.map((x) => (x.id === d.id ? { ...x, favorite: res.favorite } : x)),
      );
      toast.success(res.favorite ? 'Marcado como favorito' : 'Quitado de favoritos', {
        description: d.title.slice(0, 50),
      });
    } catch (err) {
      toast.error('Error al cambiar favorito', { description: (err as Error).message });
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Buscar por título…"
            className="pl-8"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="BALANCE">Balances</SelectItem>
            <SelectItem value="CONTRACT">Contratos</SelectItem>
            <SelectItem value="REGULATION">Normativas</SelectItem>
            <SelectItem value="OTHER">Otros</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="VIGENT">Vigentes</SelectItem>
            <SelectItem value="SUPERSEDED">Derogados</SelectItem>
            <SelectItem value="DRAFT">Borradores</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={favOnly ? 'default' : 'outline'}
          size="icon"
          onClick={() => setFavOnly((v) => !v)}
          title={favOnly ? 'Mostrar todos' : 'Solo favoritos'}
          aria-pressed={favOnly}
          className={favOnly ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
        >
          <Star className={`size-4 ${favOnly ? 'fill-current' : ''}`} />
        </Button>
        <Button variant="outline" size="icon" onClick={load} title="Recargar">
          <RefreshCw className="size-4" />
        </Button>
      </div>

      {/* Resumen de distribución de chunks (colapsable) */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1">
            <BarChart3 className="size-3.5 text-primary" />
            <span className="font-medium">Analíticas de fragmentos</span>
            <ChevronDown className="size-3 ml-auto" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-2">
            <ChunkDistributionCard />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto rag-scroll pr-1">
        {loading ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <EmptyDocs onReload={load} />
        ) : (
          <div className="grid gap-2">
            {docs.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                onOpen={() => openDoc(d)}
                onDelete={() => onDelete(d)}
                onUseFilter={() => applyAsFilter(d)}
                onToggleFavorite={() => onToggleFavorite(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Diálogo de detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-start gap-2">
              <FileText className="size-5 mt-0.5 text-primary shrink-0" />
              <span className="leading-tight flex-1">{selected?.title}</span>
              {selected && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-8 shrink-0 ${selected.favorite ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-amber-500'}`}
                  onClick={async () => {
                    try {
                      const res = await toggleFavorite(selected.id);
                      setSelected({ ...selected, favorite: res.favorite });
                      setDocs((cur) =>
                        cur.map((x) => (x.id === selected.id ? { ...x, favorite: res.favorite } : x)),
                      );
                      toast.success(res.favorite ? 'Marcado como favorito' : 'Quitado de favoritos');
                    } catch (err) {
                      toast.error('Error', { description: (err as Error).message });
                    }
                  }}
                  title={selected.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                  aria-pressed={selected.favorite}
                >
                  <Star className={`size-4 ${selected.favorite ? 'fill-current' : ''}`} />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <DocTypeBadge type={selected.docType} />
                  <StatusBadge status={selected.status} />
                  {selected.jurisdiction && (
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="size-3 mr-1" />
                      {selected.jurisdiction}
                    </Badge>
                  )}
                  {selected.entity && (
                    <Badge variant="outline" className="text-xs">
                      <Building2 className="size-3 mr-1" />
                      {selected.entity}
                    </Badge>
                  )}
                  {selected.period && (
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="size-3 mr-1" />
                      {selected.period}
                    </Badge>
                  )}
                  {selected.collectionName && (
                    <Badge variant="secondary" className="text-xs">
                      <FolderOpen className="size-3 mr-1" />
                      {selected.collectionName}
                    </Badge>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Editor de tags */}
          {selected && (
            <div className="py-1">
              <TagEditor
                documentId={selected.id}
                tags={selected.tags ?? []}
                onChange={(tags) => {
                  setSelected({ ...selected, tags });
                  setDocs((cur) =>
                    cur.map((x) => (x.id === selected.id ? { ...x, tags } : x)),
                  );
                }}
              />
            </div>
          )}

          {loadingDetail ? (
            <div className="flex items-center justify-center py-12">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : selected ? (
            <Tabs defaultValue="chunks" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="chunks">
                  <Hash className="size-3.5 mr-1" />
                  Fragmentos ({selected.chunks.length})
                </TabsTrigger>
                <TabsTrigger value="raw">
                  <FileText className="size-3.5 mr-1" />
                  Texto crudo
                </TabsTrigger>
              </TabsList>
              <TabsContent value="chunks" className="flex-1 min-h-0 mt-2 flex flex-col gap-3">
                {selected.chunks.length >= 2 && (
                  <ChunkCompareSelector
                    chunks={selected.chunks.map((c, i) => ({
                      id: c.id,
                      label: `#${i + 1} · ${c.clauseRef ?? c.section ?? `pág. ${c.page}`}`,
                      chunkType: c.chunkType,
                    }))}
                    onCompare={(ids) => {
                      setCompareIds(ids);
                      setSelected(null); // cerrar el dialog de detalle para que el de compare sea visible
                    }}
                  />
                )}
                <ScrollArea className="h-[55vh]">
                  <div className="grid gap-2 pr-2">
                    {selected.chunks.map((c, i) => (
                      <Card key={c.id} className="overflow-hidden">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-primary">#{i + 1}</span>
                            <ChunkTypeBadge type={c.chunkType} />
                            <span className="text-xs text-muted-foreground">pág. {c.page}</span>
                            {c.section && (
                              <span className="text-xs text-muted-foreground">
                                · sección {c.section}
                              </span>
                            )}
                            {c.clauseRef && (
                              <span className="text-xs text-muted-foreground">· {c.clauseRef}</span>
                            )}
                            <Badge variant="outline" className="text-xs ml-auto">
                              ~{c.tokenCount} tokens
                            </Badge>
                          </div>
                          <pre className="text-xs rag-mono whitespace-pre-wrap text-foreground/90 max-h-40 overflow-y-auto rag-scroll">
                            {c.content}
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="raw" className="flex-1 min-h-0 mt-2">
                <ScrollArea className="h-[60vh]">
                  <pre className="text-xs rag-mono whitespace-pre-wrap text-foreground/90 p-1">
                    {selected.rawText}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal de comparación de chunks */}
      <ChunkCompareModal chunkIds={compareIds} onClose={() => setCompareIds([])} />
    </div>
  );
}

function EmptyDocs({ onReload }: { onReload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
      <FolderOpen className="size-12 text-muted-foreground/40" />
      <div>
        <p className="font-medium">No hay documentos indexados</p>
        <p className="text-sm text-muted-foreground">
          Ve a la pestaña <strong>Ingesta</strong> para cargar documentos o usa el botón{' '}
          <strong>Sembrar datos de ejemplo</strong>.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onReload}>
        <RefreshCw className="size-3.5 mr-1" />
        Recargar
      </Button>
    </div>
  );
}

function DocCard({
  doc: d,
  onOpen,
  onDelete,
  onUseFilter,
  onToggleFavorite,
}: {
  doc: DocumentItem;
  onOpen: () => void;
  onDelete: () => void;
  onUseFilter: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Card className={`overflow-hidden hover:border-primary/40 transition-colors ${d.favorite ? 'border-amber-500/40 bg-amber-500/[0.03]' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <FileText className="size-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm leading-tight line-clamp-2">{d.title}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <DocTypeBadge type={d.docType} />
              <StatusBadge status={d.status} />
              {d.jurisdiction && (
                <Badge variant="outline" className="text-xs">
                  {d.jurisdiction}
                </Badge>
              )}
              {d.entity && (
                <Badge variant="outline" className="text-xs">
                  {d.entity}
                </Badge>
              )}
              {d.period && (
                <Badge variant="outline" className="text-xs">
                  {d.period}
                </Badge>
              )}
              {d.collectionName && (
                <Badge variant="secondary" className="text-xs">
                  <FolderOpen className="size-3 mr-1" />
                  {d.collectionName}
                </Badge>
              )}
              {d.tags && d.tags.length > 0 && (
                d.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] text-violet-600 border-violet-500/30 bg-violet-500/10">
                    <Tag className="size-2.5 mr-0.5" />
                    {tag}
                  </Badge>
                ))
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>{d.chunkCount} fragmentos</span>
              <span>· {d.pageCount} pág.</span>
              <span>· actualizado {new Date(d.updatedAt).toLocaleDateString('es-AR')}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${d.favorite ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-amber-500'}`}
              onClick={onToggleFavorite}
              title={d.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={d.favorite}
            >
              <Star className={`size-3.5 ${d.favorite ? 'fill-current' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onOpen} title="Ver detalle">
              <Eye className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onUseFilter} title="Usar como filtro">
              <Search className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Eliminar (soft)"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

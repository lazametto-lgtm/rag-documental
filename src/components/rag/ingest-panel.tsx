'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Upload,
  FileText,
  Loader2,
  Database,
  Sparkles,
  CheckCircle2,
  FileQuestion,
} from 'lucide-react';
import { ingestDocument, seedSampleData, type IngestPayload } from '@/lib/rag-client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const SAMPLE_TEMPLATES: Record<string, Partial<IngestPayload>> = {
  BALANCE: {
    docType: 'BALANCE',
    jurisdiction: 'AR',
    entity: 'Empresa Demo S.A.',
    period: 'Ejercicio 2024',
    version: 'v1.0',
    status: 'VIGENT',
    collectionName: 'balances-2024',
    rawText: `Balance General Empresa Demo S.A.\nEjercicio 2024. Moneda: ARS. Unidades: miles.\n\n| ACTIVO | 31-12-2024 |\n| Activo Corriente | 25.000 |\n| Activo No Corriente | 40.000 |\n| TOTAL ACTIVO | 65.000 |\n\n| PASIVO | 31-12-2024 |\n| Pasivo Corriente | 10.000 |\n| Pasivo No Corriente | 15.000 |\n| TOTAL PASIVO | 25.000 |\n| PATRIMONIO NETO | 40.000 |`,
  },
  CONTRACT: {
    docType: 'CONTRACT',
    jurisdiction: 'AR',
    entity: 'Parte A y Parte B',
    period: '2024',
    version: 'v1.0',
    status: 'VIGENT',
    collectionName: 'contratos-nuevos',
    rawText: `Contrato de Servicios\n\nCláusula Primera — Objeto.\nEl Proveedor prestará servicios según Anexo I.\n\nCláusula Segunda — Plazo.\nVigencia: 12 meses.\n\nCláusula Tercera — Precio.\n$100.000 ARS mensuales + IVA.`,
  },
  REGULATION: {
    docType: 'REGULATION',
    jurisdiction: 'AR',
    entity: 'Autoridad Demo',
    period: '2024',
    version: 'Texto ordenado 2024',
    status: 'VIGENT',
    collectionName: 'normativas-nuevas',
    rawText: `Normativa Demo\n\nArtículo 1º — Objeto.\nEsta norma regula la actividad X.\n\nArtículo 2º — Ámbito.\nAplicable en todo el territorio nacional.\n\nArtículo 3º — Sanciones.\nMultas de $1.000 a $100.000.`,
  },
};

export function IngestPanel() {
  const [form, setForm] = useState<IngestPayload>({
    title: '',
    docType: 'BALANCE',
    jurisdiction: 'AR',
    entity: '',
    period: '',
    version: '',
    status: 'VIGENT',
    collectionName: '',
    rawText: '',
  });
  const [ingesting, setIngesting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);

  const set = (k: keyof IngestPayload, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async () => {
    if (!form.title.trim() || !form.rawText.trim()) {
      toast.error('Faltan campos', { description: 'Título y texto son obligatorios' });
      return;
    }
    setIngesting(true);
    try {
      const res = await ingestDocument(form);
      if (res.indexed) {
        toast.success('Documento indexado', {
          description: `${res.chunkCount} fragmentos en ${res.elapsedMs}ms`,
        });
        setForm((f) => ({ ...f, title: '', rawText: '' }));
      } else {
        toast.info('Documento ya indexado', {
          description: 'El contenido ya existe (mismo hash). No se reindexó.',
        });
      }
    } catch (err) {
      toast.error('Error en la ingesta', { description: (err as Error).message });
    } finally {
      setIngesting(false);
    }
  };

  const onSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedSampleData(false);
      if (res.seeded > 0) {
        toast.success('Datos sembrados', {
          description: `${res.seeded} documentos nuevos indexados`,
        });
      } else {
        toast.info('Sin cambios', {
          description: `${res.alreadyExisted} documentos ya estaban en la base`,
        });
      }
    } catch (err) {
      toast.error('Error al sembrar', { description: (err as Error).message });
    } finally {
      setSeeding(false);
    }
  };

  const applyTemplate = (type: keyof typeof SAMPLE_TEMPLATES) => {
    const tpl = SAMPLE_TEMPLATES[type];
    setForm((f) => ({
      ...f,
      ...tpl,
      title: f.title || `${type === 'BALANCE' ? 'Balance' : type === 'CONTRACT' ? 'Contrato' : 'Normativa'} Demo ${new Date().getFullYear()}`,
    } as IngestPayload));
  };

  // Auto-detección de tipo: si el texto menciona artículos→REGULATION, cláusulas→CONTRACT, | → BALANCE
  const detectType = (text: string): string => {
    if (/art[ií]culo\s+\d/i.test(text)) return 'REGULATION';
    if (/cl[áa]usula\s+/i.test(text)) return 'CONTRACT';
    if (/\|.*\|.*\|/m.test(text)) return 'BALANCE';
    return 'OTHER';
  };

  const onRawChange = (v: string) => {
    set('rawText', v);
    if (autoDetect) {
      const t = detectType(v);
      if (t !== 'OTHER') set('docType', t);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4 h-full">
      {/* Formulario */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            Ingesta de documento
          </CardTitle>
          <CardDescription>
            Pega el contenido de tu PDF (o texto) y los metadatos. El sistema se encarga del chunking
            legal-aware/table-aware, los embeddings y la indexación híbrida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="p. ej. Balance General Acme 2024"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="docType">Tipo de documento</Label>
              <Select value={form.docType} onValueChange={(v) => set('docType', v)}>
                <SelectTrigger id="docType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BALANCE">Balance contable</SelectItem>
                  <SelectItem value="CONTRACT">Contrato</SelectItem>
                  <SelectItem value="REGULATION">Normativa</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jurisdiction">Jurisdicción</Label>
              <Input
                id="jurisdiction"
                value={form.jurisdiction ?? ''}
                onChange={(e) => set('jurisdiction', e.target.value)}
                placeholder="AR, EU, US..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entity">Entidad / Parte</Label>
              <Input
                id="entity"
                value={form.entity ?? ''}
                onChange={(e) => set('entity', e.target.value)}
                placeholder="Empresa, partes, autoridad..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period">Período / Vigencia</Label>
              <Input
                id="period"
                value={form.period ?? ''}
                onChange={(e) => set('period', e.target.value)}
                placeholder="Ejercicio 2024, 2024-2026..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="version">Versión</Label>
              <Input
                id="version"
                value={form.version ?? ''}
                onChange={(e) => set('version', e.target.value)}
                placeholder="v1.0, Texto ordenado 2024..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIGENT">Vigente</SelectItem>
                  <SelectItem value="SUPERSEDED">Derogado/Sustituido</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="collection">Colección</Label>
              <Input
                id="collection"
                value={form.collectionName ?? ''}
                onChange={(e) => set('collectionName', e.target.value)}
                placeholder="balances-2024, contratos..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="autodetect" checked={autoDetect} onCheckedChange={setAutoDetect} />
            <Label htmlFor="autodetect" className="text-xs cursor-pointer flex items-center gap-1">
              <Sparkles className="size-3" />
              Auto-detectar tipo por contenido (artículos→normativa, cláusulas→contrato, tablas→balance)
            </Label>
          </div>

          <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
            <Label htmlFor="rawText">
              Contenido del documento * <span className="text-muted-foreground text-xs">(texto crudo, tablas con |, párrafos separados)</span>
            </Label>
            <Textarea
              id="rawText"
              value={form.rawText}
              onChange={(e) => onRawChange(e.target.value)}
              placeholder="Pega aquí el contenido de tu PDF o documento…"
              className="flex-1 min-h-[200px] resize-none rag-mono text-xs"
            />
            <div className="text-xs text-muted-foreground">
              {form.rawText.length} caracteres · ~{Math.ceil(form.rawText.length / 4)} tokens
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(SAMPLE_TEMPLATES) as Array<keyof typeof SAMPLE_TEMPLATES>).map((t) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => applyTemplate(t)}
                >
                  Plantilla {t === 'BALANCE' ? 'balance' : t === 'CONTRACT' ? 'contrato' : 'normativa'}
                </Button>
              ))}
            </div>
            <Button onClick={onSubmit} disabled={ingesting}>
              {ingesting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              <span className="ml-1.5">Ingestar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Panel lateral: acciones rápidas + info */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-primary" />
              Datos de ejemplo
            </CardTitle>
            <CardDescription className="text-xs">
              Carga 3 documentos ficticios (DEMO): un balance, un contrato y una normativa.
              <br />
              <em>Claramente marcados como datos de prueba.</em>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onSeed} disabled={seeding} className="w-full">
              {seeding ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
              <span className="ml-1.5">Sembrar datos de ejemplo</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileQuestion className="size-4 text-primary" />
              ¿Cómo funciona la ingesta?
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            {[
              ['1', 'Tokenización multilingüe (ES/EN + legales)'],
              ['2', 'Detección de bloques: texto vs tabla (pipes |)'],
              ['3', 'Chunking jerárquico por artículo/cláusula/sección'],
              ['4', 'Parent-child: chunk pequeño + contexto amplio'],
              ['5', 'Embeddings TF-IDF hash (1024 dim)'],
              ['6', 'Indexación híbrida: BM25 + vector store'],
              ['7', 'Persistencia en SQLite + metadatos'],
            ].map(([n, label]) => (
              <motion.div
                key={n}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: parseInt(n) * 0.05 }}
                className="flex items-start gap-2"
              >
                <div className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-mono flex items-center justify-center shrink-0">
                  {n}
                </div>
                <span>{label}</span>
              </motion.div>
            ))}
            <div className="mt-3 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5">
              <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
              <span>
                Soporta ingesta incremental: agregar/actualizar/eliminar documentos sin reindexar todo
                (idempotencia por hash de contenido).
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" />
              OCR para PDFs escaneados
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1.5">
            <p>
              La arquitectura define una interfaz <code className="rag-mono">DocumentParser</code> para
              conectar PyMuPDF/pdfplumber/Camelot/Tesseract/PaddleOCR vía microservicio Python cuando el
              PDF es escaneado o mixto.
            </p>
            <p className="text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-1.5 mt-2">
              En esta demo se usa texto estructurado para foco en RAG. Conectar OCR real es trivial:
              enviar el PDF al microservicio y recibir el texto + tablas estructuradas.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

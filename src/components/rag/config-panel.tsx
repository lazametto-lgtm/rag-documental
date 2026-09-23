'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Settings2,
  RotateCcw,
  Sliders,
  Layers,
  Thermometer,
  Zap,
  Activity,
  Info,
  Download,
  Upload,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRagConfig, DEFAULT_CONFIG, type RagConfig } from './config-store';
import { toast } from 'sonner';

interface ConfigPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ConfigPanel({ open, onOpenChange }: ConfigPanelProps) {
  const { config, setConfig, reset, exportJson, importJson } = useRagConfig();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto rag-scroll">
        <SheetHeader className="pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center rag-glow">
              <Sliders className="size-4 text-primary" />
            </div>
            Configuración RAG
          </SheetTitle>
          <SheetDescription className="text-xs">
            Ajusta los hiperparámetros de recuperación y generación. Los cambios se aplican a la próxima consulta del chat.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-5">
          {/* Sección Recuperación */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recuperación híbrida
              </h3>
            </div>

            <SliderControl
              label="Fragmentos a recuperar (topK)"
              value={config.topK}
              min={5}
              max={50}
              step={1}
              onChange={(v) => setConfig({ topK: v })}
              description="Número de fragmentos recuperados antes del reranking. Mayor = más cobertura, menor latencia."
              unit=""
            />

            <SliderControl
              label="Fragmentos finales (rerankTopK)"
              value={config.rerankTopK}
              min={3}
              max={12}
              step={1}
              onChange={(v) => setConfig({ rerankTopK: v })}
              description="Fragmentos que se envían al LLM tras el reranking. Mayor = más contexto, más tokens."
              unit=""
            />

            <SliderControl
              label="Peso vectorial (α)"
              value={config.alpha}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setConfig({ alpha: v })}
              description="0 = solo BM25 léxico, 1 = solo vectorial. 0.55 = balance híbrido."
              unit=""
              format={(v) => v.toFixed(2)}
            />

            <SliderControl
              label="Diversidad MMR (λ)"
              value={config.mmrLambda}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setConfig({ mmrLambda: v })}
              description="1 = pura relevancia, 0 = máxima diversidad. 0.7 = balance."
              unit=""
              format={(v) => v.toFixed(2)}
            />

            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-2">
                <Zap className="size-3.5 text-amber-500" />
                <Label htmlFor="reranker" className="text-xs cursor-pointer">
                  Usar reranker (cross-encoder)
                </Label>
              </div>
              <Switch
                id="reranker"
                checked={config.useReranker}
                onCheckedChange={(v) => setConfig({ useReranker: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-2">
                <Activity className="size-3.5 text-violet-500" />
                <Label htmlFor="multiquery" className="text-xs cursor-pointer">
                  Multi-query (expansión de consulta)
                </Label>
              </div>
              <Switch
                id="multiquery"
                checked={config.useMultiQuery}
                onCheckedChange={(v) => setConfig({ useMultiQuery: v })}
              />
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Sección Generación */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Thermometer className="size-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Generación
              </h3>
            </div>

            <SliderControl
              label="Temperatura LLM"
              value={config.temperature}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) => setConfig({ temperature: v })}
              description="0 = determinista/preciso, 1 = creativo/variado. 0.2 = balance para RAG factual."
              unit=""
              format={(v) => v.toFixed(1)}
            />
          </section>

          <div className="border-t border-border" />

          {/* Resumen de config actual */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="size-3.5 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Configuración actual
              </h3>
            </div>
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-xs space-y-1 rag-mono">
                <ConfigRow label="topK" value={config.topK} />
                <ConfigRow label="rerankTopK" value={config.rerankTopK} />
                <ConfigRow label="alpha" value={config.alpha.toFixed(2)} />
                <ConfigRow label="mmrLambda" value={config.mmrLambda.toFixed(2)} />
                <ConfigRow label="temperature" value={config.temperature.toFixed(1)} />
                <ConfigRow label="useReranker" value={config.useReranker ? 'true' : 'false'} />
                <ConfigRow label="useMultiQuery" value={config.useMultiQuery ? 'true' : 'false'} />
              </CardContent>
            </Card>
          </section>

          {/* Botones de acción */}
          <div className="space-y-2 pt-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  reset();
                  toast.success('Configuración restablecida a valores por defecto');
                }}
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Restablecer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const json = exportJson();
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `rag-config-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Configuración exportada');
                }}
              >
                <Download className="size-3.5 mr-1.5" />
                Exportar
              </Button>
            </div>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const input = document.getElementById('config-import-input') as HTMLInputElement | null;
                    input?.click();
                  }}
                >
                  <Upload className="size-3.5 mr-1.5" />
                  Importar JSON
                </Button>
                <input
                  id="config-import-input"
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const ok = importJson(text);
                      if (ok) {
                        toast.success('Configuración importada correctamente');
                      } else {
                        toast.error('Archivo JSON inválido');
                      }
                    } catch (err) {
                      toast.error('Error al importar', { description: (err as Error).message });
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="size-1.5 rounded-full bg-emerald-500 rag-pulse-soft" />
            <p className="text-[10px] text-muted-foreground">
              Configuración persistida en el navegador (localStorage)
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
  unit,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  description: string;
  unit: string;
  format?: (v: number) => string;
}) {
  const display = format ? format(value) : String(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs cursor-default">{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{description}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Badge variant="secondary" className="font-mono text-xs min-w-[3rem] justify-center">
          {display}{unit}
        </Badge>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
        className="py-1"
      />
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{format ? format(min) : min}{unit}</span>
        <span>{format ? format(max) : max}{unit}</span>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

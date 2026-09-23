'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sparkles,
  MessageSquare,
  FileText,
  Upload,
  History,
  FlaskConical,
  Layers,
  Search,
  Sliders,
  Mic,
  Keyboard,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
} from 'lucide-react';

const TOUR_KEY = 'rag-onboarding-completed';
const TOTAL_STEPS = 8;

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
}

const STEPS: TourStep[] = [
  {
    icon: <Sparkles className="size-5 text-primary" />,
    title: 'Bienvenido al RAG Documental',
    description: 'Chatea con balances contables, contratos legales y normativas vigentes. Cada respuesta incluye citas verificables con documento, página y sección exacta.',
  },
  {
    icon: <MessageSquare className="size-5 text-primary" />,
    title: 'Chat con anti-alucinación',
    description: 'Pregunta en lenguaje natural. El sistema responde SOLO con la información de los documentos indexados. Si no hay evidencia, lo declara explícitamente.',
    highlight: 'Tab "Chat"',
  },
  {
    icon: <FileText className="size-5 text-primary" />,
    title: 'Librería de documentos',
    description: 'Explora documentos con filtros por tipo, jurisdicción y estado. Marca favoritos (★), añade tags y compara fragmentos lado a lado con diff visual.',
    highlight: 'Tab "Documentos"',
  },
  {
    icon: <Upload className="size-5 text-primary" />,
    title: 'Ingesta de documentos',
    description: 'Pega texto crudo o tablas. El sistema hace chunking legal-aware (por artículo/cláusula) + table-aware automáticamente. Indexación incremental e idempotente.',
    highlight: 'Tab "Ingesta"',
  },
  {
    icon: <History className="size-5 text-primary" />,
    title: 'Historial de consultas',
    description: 'Todas tus preguntas se registran con respuesta, citas, latencia y confianza. Busca y filtra por tipo de documento.',
    highlight: 'Tab "Historial"',
  },
  {
    icon: <FlaskConical className="size-5 text-primary" />,
    title: 'Evaluación RAGAS-like',
    description: 'Mide faithfulness, answer relevancy, context precision/recall y citation accuracy. Exporta resultados a CSV y visualiza tendencias en gráficos.',
    highlight: 'Tab "Evaluación"',
  },
  {
    icon: <Search className="size-5 text-primary" />,
    title: 'Búsqueda y atajos',
    description: 'Cmd/Ctrl+K abre búsqueda full-text con snippets resaltados. Atajos: g+c (chat), g+d (documentos), g+e (evaluación). Pulsa "?" para ver todos.',
    highlight: 'Atajos de teclado',
  },
  {
    icon: <Sliders className="size-5 text-primary" />,
    title: 'Configuración y voz',
    description: 'Ajusta hiperparámetros RAG (topK, alpha, lambda, temperature) en el panel Config. Dicta preguntas por voz (micrófono) y escucha respuestas (TTS). La configuración se persiste en el navegador.',
    highlight: 'Botones Config + Mic',
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Mostrar tour si no se ha completado antes
    try {
      const done = localStorage.getItem(TOUR_KEY);
      if (!done) {
        // Pequeño delay para que cargue la app
        const id = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(id);
      }
    } catch {
      // localStorage no disponible
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      // ignore
    }
  };

  const skip = () => {
    close();
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = STEPS[step];
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg overflow-hidden p-0" showCloseButton={false}>
        {/* Header con gradiente */}
        <div className="rag-gradient p-6 pb-4 relative">
          <button
            onClick={skip}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Saltar tour"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center rag-glow shrink-0">
              {current.icon}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-tight">{current.title}</DialogTitle>
              {current.highlight && (
                <span className="inline-block mt-1 text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {current.highlight}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="px-6 pb-4">
          <DialogDescription className="text-sm text-foreground/80 leading-relaxed">
            {current.description}
          </DialogDescription>
        </div>

        {/* Indicadores de progreso */}
        <div className="px-6 pb-3 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? 'w-6 bg-primary'
                  : i < step
                  ? 'w-1.5 bg-primary/60'
                  : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">
            {step + 1}/{TOTAL_STEPS}
          </span>
        </div>

        {/* Footer con botones */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={skip} className="text-xs text-muted-foreground">
            Saltar tour
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={prev} className="text-xs">
                <ChevronLeft className="size-3.5 mr-1" />
                Anterior
              </Button>
            )}
            <Button size="sm" onClick={next} className="text-xs">
              {isLast ? (
                <>
                  <Check className="size-3.5 mr-1" />
                  Comenzar
                </>
              ) : (
                <>
                  Siguiente
                  <ChevronRight className="size-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Botón para re-abrir el tour manualmente
export function TourButton() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_KEY);
      if (!done) {
        const id = setTimeout(() => setShowHint(true), 3000);
        return () => clearTimeout(id);
      }
    } catch {
      // ignore
    }
  }, []);

  const restart = () => {
    try {
      localStorage.removeItem(TOUR_KEY);
    } catch {
      // ignore
    }
    // Forzar recarga para que el tour aparezca
    window.location.reload();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground hover:text-foreground hidden lg:inline-flex"
      onClick={restart}
      title="Ver tour de bienvenida"
    >
      <Sparkles className="size-3.5 mr-1" />
      Tour
    </Button>
  );
}

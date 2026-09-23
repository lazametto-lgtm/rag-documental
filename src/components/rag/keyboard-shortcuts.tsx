'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

// Hook para registrar atajos de teclado globales.
// Soporta:
// - Cmd/Ctrl+K → focus search/chat input
// - "/" → focus chat input (cuando no se está escribiendo)
// - "g" seguido de c/d/i/h/e/a → navegar a tabs
// - Esc → cerrar modales (Radix Dialog maneja Esc nativamente, pero backup)
// - ? → mostrar ayuda de atajos

export interface ShortcutHandler {
  onSearch?: () => void;
  onGoToTab?: (tab: string) => void;
  onToggleHelp?: () => void;
}

const SINGLE_KEYS: Record<string, string> = {
  c: 'chat',
  d: 'documents',
  i: 'ingest',
  h: 'history',
  e: 'evaluation',
  a: 'architecture',
};

export function useKeyboardShortcuts(handler: ShortcutHandler) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;
    const DOUBLE_KEY_DELAY = 700;

    const isTyping = (el: EventTarget | null): boolean => {
      const e = el as HTMLElement | null;
      if (!e) return false;
      const tag = e.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (e as HTMLElement).isContentEditable;
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      // Cmd/Ctrl+K → focus search (funciona incluso dentro de inputs)
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        handler.onSearch?.();
        return;
      }

      // Si está escribiendo en un input, no interceptar (excepto Esc)
      if (isTyping(ev.target)) {
        if (ev.key === 'Escape') {
          (ev.target as HTMLElement).blur();
        }
        return;
      }

      // ? → help (acepta ? con o sin shift, y Shift+/) — solo cuando NO se está escribiendo
      if (ev.key === '?' || (ev.shiftKey && (ev.key === '/' || ev.code === 'Slash'))) {
        ev.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      // "/" → focus chat input
      if (ev.key === '/') {
        ev.preventDefault();
        handler.onSearch?.();
        return;
      }

      // "g" + letra → navegar a tab
      const now = Date.now();
      if (ev.key.toLowerCase() === 'g' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        lastKey = 'g';
        lastKeyTime = now;
        return;
      }
      if (lastKey === 'g' && now - lastKeyTime < DOUBLE_KEY_DELAY) {
        const tab = SINGLE_KEYS[ev.key.toLowerCase()];
        if (tab) {
          ev.preventDefault();
          handler.onGoToTab?.(tab);
          lastKey = '';
          lastKeyTime = 0;
          return;
        }
      }
      lastKey = '';
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler]);

  return { helpOpen, setHelpOpen };
}

export function KeyboardHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const shortcuts: Array<[string, string]> = [
    ['⌘ / Ctrl + K', 'Foco en búsqueda/chat'],
    ['/', 'Foco en input de chat'],
    ['g c', 'Ir a Chat'],
    ['g d', 'Ir a Documentos'],
    ['g i', 'Ir a Ingesta'],
    ['g h', 'Ir a Historial'],
    ['g e', 'Ir a Evaluación'],
    ['g a', 'Ir a Arquitectura'],
    ['Esc', 'Cerrar modal / blur input'],
    ['Shift + ?', 'Mostrar/ocultar esta ayuda'],
    ['Enter', 'Enviar mensaje en chat'],
    ['Shift + Enter', 'Salto de línea en chat'],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="size-4 text-primary" />
            Atajos de teclado
          </DialogTitle>
          <DialogDescription className="text-xs">
            Navega más rápido sin tocar el mouse.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 text-sm">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-1 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground text-xs">{desc}</span>
              <kbd className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

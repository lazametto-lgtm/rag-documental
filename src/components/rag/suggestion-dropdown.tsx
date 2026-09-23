'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchSuggestions, type SuggestionItem } from '@/lib/rag-client';
import { History, Lightbulb, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SuggestionDropdownProps {
  query: string;
  visible: boolean;
  onPick: (q: string) => void;
  onClose: () => void;
}

export function SuggestionDropdown({ query, visible, onPick, onClose }: SuggestionDropdownProps) {
  if (!visible || query.trim().length < 3) {
    return null;
  }
  return <SuggestionLoader key={query.trim()} query={query.trim()} onPick={onPick} onClose={onClose} />;
}

function SuggestionLoader({ query, onPick, onClose }: { query: string; onPick: (q: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const res = await fetchSuggestions(query);
        if (!cancelled) {
          setItems(res.suggestions);
          setHighlightIdx(-1);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (items.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && highlightIdx >= 0) {
        e.preventDefault();
        onPick(items[highlightIdx].question);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, highlightIdx, onPick, onClose]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 right-0 mb-1 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Lightbulb className="size-3 text-primary" />
          Sugerencias
        </span>
        {items.length === 0 && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground text-center">
          Buscando sugerencias…
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rag-scroll">
          {items.map((item, i) => (
            <button
              key={i}
              onMouseEnter={() => setHighlightIdx(i)}
              onClick={() => onPick(item.question)}
              className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 transition-colors ${
                i === highlightIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
              }`}
            >
              {item.source === 'history' ? (
                <History className="size-3 mt-0.5 shrink-0 text-muted-foreground" />
              ) : (
                <Lightbulb className="size-3 mt-0.5 shrink-0 text-amber-500" />
              )}
              <span className="flex-1 leading-snug">{item.question}</span>
              {item.count && item.count > 1 && (
                <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">
                  ×{item.count}
                </span>
              )}
              {item.type && (
                <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">
                  {item.type}
                </span>
              )}
              <ChevronRight className="size-3 mt-0.5 shrink-0 text-muted-foreground opacity-50" />
            </button>
          ))}
        </div>
      )}
      <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[9px] text-muted-foreground flex items-center justify-between">
        <span>↑↓ navegar · Enter seleccionar · Esc cerrar</span>
      </div>
    </motion.div>
  );
}

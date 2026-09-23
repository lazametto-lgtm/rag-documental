'use client';

import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tag, X, Plus, Check } from 'lucide-react';
import { updateTags } from '@/lib/rag-client';
import { toast } from 'sonner';

interface TagEditorProps {
  documentId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagEditor({ documentId, tags, onChange }: TagEditorProps) {
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const addTag = async (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    if (tags.includes(t)) {
      toast.info('Ese tag ya existe');
      return;
    }
    setPending(true);
    try {
      const res = await updateTags(documentId, { action: 'add', tag: t });
      onChange(res.tags);
      setInput('');
      toast.success(`Tag "${t}" añadido`);
    } catch (err) {
      toast.error('Error al añadir tag', { description: (err as Error).message });
    } finally {
      setPending(false);
    }
  };

  const removeTag = async (tag: string) => {
    setPending(true);
    try {
      const res = await updateTags(documentId, { action: 'remove', tag });
      onChange(res.tags);
      toast.success(`Tag "${tag}" eliminado`);
    } catch (err) {
      toast.error('Error al eliminar tag', { description: (err as Error).message });
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      void addTag(input);
    } else if (e.key === 'Escape') {
      setInput('');
      setEditing(false);
    } else if (e.key === ',' && input.trim()) {
      e.preventDefault();
      void addTag(input);
    }
  };

  if (!editing && tags.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground hover:text-violet-500"
        onClick={() => setEditing(true)}
      >
        <Plus className="size-3 mr-1" />
        Añadir tags
      </Button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Tag className="size-3 text-violet-500 shrink-0" />
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="text-[10px] text-violet-600 dark:text-violet-300 border-violet-500/30 bg-violet-500/10 gap-1 pr-1"
          >
            {tag}
            {editing && (
              <button
                type="button"
                onClick={() => void removeTag(tag)}
                disabled={pending}
                className="hover:bg-violet-500/30 rounded-sm p-0.5 transition-colors disabled:opacity-50"
                aria-label={`Eliminar tag ${tag}`}
              >
                <X className="size-2.5" />
              </button>
            )}
          </Badge>
        ))}
        {editing ? (
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (!input.trim()) setEditing(false);
            }}
            placeholder="Escribe y Enter…"
            className="h-6 w-32 text-xs px-2 py-0"
            disabled={pending}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground hover:text-violet-500 px-1.5"
            onClick={() => setEditing(true)}
          >
            <Plus className="size-3" />
          </Button>
        )}
        {editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground px-1.5"
            onClick={() => setEditing(false)}
          >
            <Check className="size-3" />
          </Button>
        )}
      </div>
      {editing && (
        <p className="text-[9px] text-muted-foreground">
          Enter para añadir · Esc para terminar
        </p>
      )}
    </div>
  );
}

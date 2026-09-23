'use client';

import { create } from 'zustand';
import type { Citation, RetrievedChunk } from '@/lib/rag/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  // Para mensajes del asistente: metadatos de la respuesta RAG
  citations?: Citation[];
  retrievedChunks?: RetrievedChunk[];
  confidence?: 'high' | 'medium' | 'low';
  confidenceScore?: number;
  warnings?: string[];
  latencyMs?: number;
  noEvidence?: boolean;
  llmProvider?: string;
  pending?: boolean;
  error?: string;
  createdAt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  localMode: boolean;
  useMultiQuery: boolean;
  filters: {
    docType?: string;
    jurisdiction?: string;
    entity?: string;
    period?: string;
    status?: string;
    collectionId?: string;
  };
  // Acciones
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  setLoading: (v: boolean) => void;
  setLocalMode: (v: boolean) => void;
  setUseMultiQuery: (v: boolean) => void;
  setFilters: (f: Partial<ChatState['filters']>) => void;
  resetFilters: () => void;
}

let seq = 0;
function newId() {
  seq += 1;
  return `m_${Date.now()}_${seq}`;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  localMode: false,
  useMultiQuery: false,
  filters: {},
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (v) => set({ isLoading: v }),
  setLocalMode: (v) => set({ localMode: v }),
  setUseMultiQuery: (v) => set({ useMultiQuery: v }),
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  resetFilters: () => set({ filters: {} }),
}));

export function makeMessage(partial: Partial<ChatMessage> & { role: 'user' | 'assistant' }): ChatMessage {
  return {
    id: newId(),
    content: '',
    createdAt: Date.now(),
    ...partial,
  };
}

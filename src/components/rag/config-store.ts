'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface RagConfig {
  // Recuperación
  topK: number;            // fragmentos a recuperar pre-reranking (5-50)
  rerankTopK: number;      // fragmentos tras reranking (3-12)
  alpha: number;           // peso vectorial en híbrido (0-1, 0=solo BM25, 1=solo vector)
  mmrLambda: number;       // diversidad MMR (0-1, 1=pura relevancia)
  // Generación
  temperature: number;     // 0-1
  // Toggles
  useReranker: boolean;
  useMultiQuery: boolean;
}

export const DEFAULT_CONFIG: RagConfig = {
  topK: 20,
  rerankTopK: 6,
  alpha: 0.55,
  mmrLambda: 0.7,
  temperature: 0.2,
  useReranker: true,
  useMultiQuery: false,
};

interface ConfigState {
  config: RagConfig;
  setConfig: (c: Partial<RagConfig>) => void;
  reset: () => void;
  // Importar/exportar config como JSON
  exportJson: () => string;
  importJson: (json: string) => boolean;
}

// Serializa solo la config (no las funciones) para localStorage
function serializeConfig(config: RagConfig): string {
  return JSON.stringify({ ragConfig: config, version: 1, exportedAt: new Date().toISOString() }, null, 2);
}

function parseConfig(json: string): RagConfig | null {
  try {
    const parsed = JSON.parse(json);
    // Aceptar formato con wrapper o config directa
    const cfg = parsed.ragConfig ?? parsed;
    // Validar campos mínimos
    if (typeof cfg.topK === 'number' && typeof cfg.alpha === 'number') {
      // Merge con defaults para campos faltantes
      return { ...DEFAULT_CONFIG, ...cfg };
    }
    return null;
  } catch {
    return null;
  }
}

export const useRagConfig = create<ConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      reset: () => set({ config: DEFAULT_CONFIG }),
      exportJson: () => serializeConfig(get().config),
      importJson: (json: string) => {
        const cfg = parseConfig(json);
        if (cfg) {
          set({ config: cfg });
          return true;
        }
        return false;
      },
    }),
    {
      name: 'rag-config-storage',
      storage: createJSONStorage(() => localStorage),
      // Solo persistir la config, no las funciones
      partialize: (state) => ({ config: state.config }),
    },
  ),
);

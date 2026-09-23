// Configuración de modo air-gapped.
// Cuando AIR_GAPPED=true, la app bloquea todo tráfico saliente:
// - Solo permite providers LLM locales (ollama, local-server, hybrid, local-extractive)
// - Bloquea 'zai' y 'api' (requieren conexión externa)
// - Deshabilita telemetría
// - Marca la app como "offline" en la UI

export const AIR_GAPPED = process.env.AIR_GAPPED === 'true';

// Providers permitidos en modo air-gapped
const AIR_GAPPED_PROVIDERS = ['ollama', 'local-server', 'hybrid', 'local-extractive'] as const;

// Providers que requieren conexión externa (bloqueados en air-gapped)
const EXTERNAL_PROVIDERS = ['zai', 'api'] as const;

export function isProviderAllowed(provider: string): boolean {
  if (!AIR_GAPPED) return true;
  return (AIR_GAPPED_PROVIDERS as readonly string[]).includes(provider);
}

export function getBlockedReason(provider: string): string | null {
  if (!AIR_GAPPED) return null;
  if ((EXTERNAL_PROVIDERS as readonly string[]).includes(provider)) {
    return `Provider '${provider}' requiere conexión externa — bloqueado en modo air-gapped`;
  }
  return null;
}

// Sanitiza la config del LLM: si air-gapped y el provider es externo, fuerza 'hybrid'
export function sanitizeLLMConfig<T extends { llmProvider: string }>(config: T): T {
  if (!AIR_GAPPED) return config;
  if (!isProviderAllowed(config.llmProvider)) {
    console.warn(`[air-gapped] Provider '${config.llmProvider}' bloqueado, usando 'hybrid'`);
    return { ...config, llmProvider: 'hybrid' as any };
  }
  return config;
}

// Información del modo para mostrar en la UI
export const AIR_GAPPED_INFO = {
  enabled: AIR_GAPPED,
  description: AIR_GAPPED
    ? 'Modo air-gapped activo. Todo el tráfico es local, sin conexión externa.'
    : 'Modo normal. Se permiten conexiones externas a APIs de LLM.',
  allowedProviders: AIR_GAPPED ? [...AIR_GAPPED_PROVIDERS] : ['zai', 'ollama', 'api', 'local-server', 'hybrid'],
  blockedProviders: AIR_GAPPED ? [...EXTERNAL_PROVIDERS] : [],
};

// Proveedor LLM basado en z-ai-web-dev-sdk (LLM comercial equivalente a OpenAI/Anthropic).
// Interfaz LLMProvider: permite sustituir por Ollama local u otros.

import ZAI from 'z-ai-web-dev-sdk';
import type { LLMProvider, LLMMessage } from './types';

class ZaiLLMProvider implements LLMProvider {
  readonly name = 'zai-llm';
  private client: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  private async getClient() {
    if (!this.client) this.client = await ZAI.create();
    return this.client;
  }

  async generate(
    messages: LLMMessage[],
    opts: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    const client = await this.getClient();
    // z-ai-web-dev-sdk usa 'assistant' para el system prompt
    const mapped = messages.map((m) => ({
      role: m.role === 'system' ? 'assistant' : m.role,
      content: m.content,
    }));
    try {
      const completion = await client.chat.completions.create({
        messages: mapped,
        thinking: { type: 'disabled' },
      });
      const content = completion.choices[0]?.message?.content ?? '';
      if (!content || content.trim().length === 0) {
        throw new Error('Respuesta vacía del LLM');
      }
      return content;
    } catch (err) {
      // Reintentar una vez
      try {
        const completion = await client.chat.completions.create({
          messages: mapped,
          thinking: { type: 'disabled' },
        });
        const content = completion.choices[0]?.message?.content ?? '';
        if (!content) throw err;
        return content;
      } catch (err2) {
        const e = err2 as Error;
        throw new Error(`LLM falló: ${e.message}`);
      }
    }
  }
}

let _provider: ZaiLLMProvider | null = null;
export function getLLMProvider(): LLMProvider {
  if (!_provider) _provider = new ZaiLLMProvider();
  return _provider;
}

// Proveedor local (modo offline): sintetiza respuesta a partir de chunks sin LLM.
// Útil para documentos confidenciales o cuando no hay conectividad.
export class LocalLLMProvider implements LLMProvider {
  readonly name = 'local-extractive';

  async generate(messages: LLMMessage[]): Promise<string> {
    // Tomar el último mensaje de usuario (que contiene el contexto + pregunta)
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return 'No se encontró información suficiente en los documentos proporcionados.';
    const content = lastUser.content;
    // Extraer fragmentos del contexto
    const fragMatch = content.match(/--- Fragmento (\d+)[\s\S]*?---\n([\s\S]*?)(?=\n---|\n=== FIN)/g);
    if (!fragMatch || fragMatch.length === 0) {
      return 'No se encontró información suficiente en los documentos proporcionados.';
    }
    const fragments: string[] = [];
    fragMatch.forEach((m) => {
      const body = m.split('---').pop()?.trim() ?? '';
      if (body) fragments.push(body);
    });
    const question = content.split('=== PREGUNTA DEL USUARIO ===')[1]?.trim() ?? '';
    // Síntesis extractiva: devolver los 3 fragmentos más relevantes + citas
    const top = fragments.slice(0, 3);
    const answer = `Respuesta directa: la información disponible indica lo siguiente:\n\n${top
      .map((f, i) => `(${i + 1}) ${f.slice(0, 280)}`)
      .join('\n\n')}\n\nEvidencia:\n${top
      .map((f) => `- "${f.slice(0, 160)}…"`)
      .join('\n')}\n\nConfianza: Medio (modo local extractivo, sin LLM generativo).\n\nCITAS: extraídas de los fragmentos superiores.`;
    void question;
    return answer;
  }
}

export function getLocalLLMProvider(): LLMProvider {
  return new LocalLLMProvider();
}

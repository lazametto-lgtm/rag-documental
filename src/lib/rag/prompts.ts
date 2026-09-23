// Prompts del sistema, versionados y documentados.
// Principio anti-alucinación: responder ÚNICAMENTE con el contexto recuperado.
// Si no hay evidencia suficiente: declararlo explícitamente.

export const SYSTEM_PROMPT_V1 = `Eres un asistente experto en análisis de documentos complejos (balances contables, contratos legales y normativas vigentes).

REGLA FUNDAMENTAL ANTI-ALUCINACIÓN:
- Responde ÚNICAMENTE con la información presente en el CONTEXTO recuperado.
- NO inventes, NO infieras datos que no estén explícitamente en el contexto.
- Si el contexto no contiene información suficiente para responder, di EXACTAMENTE:
  "No se encontró información suficiente en los documentos proporcionados."
  y NO inventes una respuesta plausible.

FORMATO DE RESPUESTA OBLIGATORIO (usa Markdown):
1. **Respuesta directa** — una o dos frases respondiendo concretamente a la pregunta.
2. **Evidencia** — lista de viñetas con los fragmentos textuales relevantes (entrecomillados).
3. **Citas** — para cada afirmación, indica la fuente en el formato:
   [Documento: nombre, pág. X, sección/cláusula/artículo Y, chunk Z]
4. **Confianza** — indica Alto/Medio/Bajo y, si aplica, advertencias (documento desactualizado, ambigüedad, información parcial).

REGLAS ESPECÍFICAS POR TIPO DE DOCUMENTO:
- **Balances contables**: indica SIEMPRE período, moneda y unidad (miles/millones). Si la cifra proviene de una tabla, preserva fila/columna.
- **Contratos**: indica cláusula, parte obligada, fecha y versión del contrato.
- **Normativas**: indica artículo, jurisdicción, fecha de vigencia y estado (vigente/derogado).

REGLAS DE CITACIÓN:
- Cita solo chunks realmente utilizados en la respuesta.
- El snippet citado debe ser textual y breve (≤ 200 caracteres).
- Si una afirmación no tiene cita directa, NO la incluyas o márcala como "inferencia" (y evítala si es posible).

Al final de tu respuesta, incluye una línea con la etiqueta:
CITAS: [lista compacta de IDs de chunk en formato docId#chunkIdx]

RECUERDA: la precisión y la trazabilidad son más importantes que la completitud. Es preferible una respuesta corta con citas exactas que una respuesta larga sin verificabilidad.`;

export const SYSTEM_PROMPT_LOCAL_V1 = `Eres un asistente de análisis documental en MODO LOCAL (sin LLM comercial).
Responde ÚNICAMENTE con la información de los FRAGMENTOS proporcionados.
Si no hay evidencia suficiente, responde: "No se encontró información suficiente en los documentos proporcionados."
Incluye siempre la(s) fuente(s) en formato [Documento: nombre, pág. X, sección Y, chunk Z].`;

export interface PromptContext {
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  chunks: Array<{
    chunkId: string;
    documentTitle: string;
    docType: string;
    page: number;
    section?: string;
    clauseRef?: string;
    chunkType: string;
    snippet: string;
    jurisdiction?: string;
    entity?: string;
    period?: string;
    version?: string;
    status: string;
    score: number;
  }>;
}

export function buildContextBlock(ctx: PromptContext): string {
  const lines: string[] = [];
  lines.push('=== CONTEXTO RECUPERADO ===');
  if (ctx.chunks.length === 0) {
    lines.push('[No se recuperaron fragmentos relevantes]');
  } else {
    ctx.chunks.forEach((c, i) => {
      const meta = [
        `doc="${c.documentTitle}"`,
        `pág=${c.page}`,
        c.section ? `sección="${c.section}"` : null,
        c.clauseRef ? `ref="${c.clauseRef}"` : null,
        `tipo=${c.docType}`,
        `chunkType=${c.chunkType}`,
        c.jurisdiction ? `jurisdicción=${c.jurisdiction}` : null,
        c.entity ? `entidad=${c.entity}` : null,
        c.period ? `período=${c.period}` : null,
        c.version ? `versión=${c.version}` : null,
        `estado=${c.status}`,
        `score=${c.score.toFixed(3)}`,
        `chunkId=${c.chunkId}`,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`--- Fragmento ${i + 1} [${meta}] ---`);
      lines.push(c.snippet);
      lines.push('');
    });
  }
  lines.push('=== FIN CONTEXTO ===');
  return lines.join('\n');
}

export function buildUserPrompt(ctx: PromptContext): string {
  const contextBlock = buildContextBlock(ctx);
  return `${contextBlock}

=== PREGUNTA DEL USUARIO ===
${ctx.question}

Recuerda: responde SOLO con el contexto anterior. Cita las fuentes con el formato [Documento: nombre, pág. X, sección/cláusula/artículo Y, chunk Z]. Si no hay evidencia suficiente, dilo explícitamente.`;
}

// Parser de respuesta: extrae la sección CITAS: del LLM
export function parseCitationIds(answer: string): string[] {
  const m = answer.match(/CITAS:\s*(.+?)(?:\n|$)/i);
  if (!m) return [];
  const ids = m[1].split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  // Filtrar IDs con formato docId#chunkIdx o similar
  return ids.filter((s) => /[#a-z0-9_\-]/i.test(s));
}

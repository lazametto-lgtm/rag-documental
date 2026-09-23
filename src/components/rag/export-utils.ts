// Utilidades de exportación de conversación a Markdown y JSON.
import type { ChatMessage } from './store';

function escapeYaml(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

export function exportToMarkdown(messages: ChatMessage[]): string {
  const date = new Date().toISOString();
  const header = `---
title: "Conversación RAG"
exportedAt: "${date}"
messageCount: ${messages.filter((m) => !m.pending && !m.error).length}
llmProvider: "${messages.find((m) => m.role === 'assistant' && m.llmProvider)?.llmProvider ?? 'unknown'}"
---

# Conversación RAG Documental

Exportado el ${new Date().toLocaleString('es-AR')}

---

`;

  const body = messages
    .filter((m) => !m.pending && !m.error)
    .map((m) => {
      const role = m.role === 'user' ? '👤 **Usuario**' : '🤖 **Asistente RAG**';
      const time = new Date(m.createdAt).toLocaleString('es-AR');
      let block = `## ${role}
*${time}*

${m.content}

`;
      if (m.role === 'assistant') {
        if (m.confidence) {
          block += `> **Confianza:** ${m.confidence}${m.confidenceScore !== undefined ? ` (${Math.round(m.confidenceScore * 100)}%)` : ''} · **Provider:** ${m.llmProvider ?? '—'} · **Latencia:** ${m.latencyMs ?? '—'}ms

`;
        }
        if (m.warnings && m.warnings.length > 0) {
          block += `> ⚠️ **Advertencias:**
> ${m.warnings.map((w) => `- ${w}`).join('\n> ')}

`;
        }
        if (m.citations && m.citations.length > 0) {
          block += `### Citas verificables (${m.citations.length})

`;
          m.citations.forEach((c, i) => {
            block += `**Cita #${i + 1}** — ${c.documentTitle}
- 📄 Tipo: ${c.docType} · 📃 ${c.chunkType}
- 📍 Página: ${c.page}${c.section ? ` · Sección: ${c.section}` : ''}${c.clauseRef ? ` · ${c.clauseRef}` : ''}
${c.jurisdiction ? `- 🌍 Jurisdicción: ${c.jurisdiction}` : ''}
${c.entity ? `- 🏢 Entidad: ${c.entity}` : ''}
${c.period ? `- 📅 Período: ${c.period}` : ''}
${c.version ? `- 🏷️ Versión: ${c.version}` : ''}
- ⭐ Score: ${c.score.toFixed(2)}
- 📝 Fragmento: "${c.snippet}"

`;
          });
        }
      }
      return block + `---

`;
    })
    .join('\n');

  return header + body;
}

export function exportToJson(messages: ChatMessage[]): string {
  const clean = messages
    .filter((m) => !m.pending && !m.error)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: new Date(m.createdAt).toISOString(),
      confidence: m.confidence,
      confidenceScore: m.confidenceScore,
      warnings: m.warnings,
      latencyMs: m.latencyMs,
      llmProvider: m.llmProvider,
      noEvidence: m.noEvidence,
      citations: m.citations,
      citationsCount: m.citations?.length ?? 0,
    }));
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      messageCount: clean.length,
      conversation: clean,
    },
    null,
    2,
  );
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(messages: ChatMessage[]) {
  const md = exportToMarkdown(messages);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadFile(md, `conversacion-rag-${stamp}.md`, 'text/markdown;charset=utf-8');
}

export function downloadJson(messages: ChatMessage[]) {
  const json = exportToJson(messages);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadFile(json, `conversacion-rag-${stamp}.json`, 'application/json;charset=utf-8');
}

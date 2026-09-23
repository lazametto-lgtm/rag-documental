// Chunking jerárquico y semántico.
// Estrategias:
// 1) Legal-aware: dividir por Artículo / Cláusula / Sección / Inciso.
// 2) Table-aware: preservar filas/columnas de balances y tablas legales.
// 3) Parent-child: fragmento pequeño para recuperación, contexto amplio para LLM
//    (aquí implementado vía ventana de contexto: guardamos chunk + vecinos).

import type { Chunk, ChunkType, DocType, DocStatus } from './types';
import { detectChunkType, extractClauseRef, estimateTokens, hashText } from './utils';

export interface ChunkInput {
  documentId: string;
  documentTitle: string;
  docType: DocType;
  jurisdiction?: string;
  entity?: string;
  period?: string;
  version?: string;
  status: DocStatus;
  validityDate?: string;
  collectionId?: string;
  pageCount: number;
  rawText: string;
}

// Marcadores de sección legales/contables comunes
const SECTION_RE =
  /^(\s*)(art[ií]culo|art\.|cl[áa]usula|cl\.|secci[oó]n|sec\.|inciso|inc\.|anexo|t[ií]tulo|cap[ií]tulo|disposici[oó]n|parte|item|literal|apartado|fracci[oó]n|article|clause|section|annex|chapter|title|part)\s+([\w.\-º°]+)/i;

const TABLE_ROW_RE = /\n\s*\|.*\|\s*(?:\n|$)/g;

const DEFAULT_TARGET_TOKENS = 320;   // tamaño objetivo del chunk hijo
const DEFAULT_MAX_TOKENS = 640;        // hard cap
const DEFAULT_OVERLAP_TOKENS = 80;    // solapamiento parent-child

export interface ChunkOptions {
  targetTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
}

export function chunkDocument(input: ChunkInput, opts: ChunkOptions = {}): Chunk[] {
  const target = opts.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const maxTok = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlap = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;

  const pages = splitPages(input.rawText, input.pageCount);
  const allChunks: Chunk[] = [];
  let order = 0;

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const pageNum = pIdx + 1;
    // 1) Separar bloques: tablas vs texto legal vs texto plano
    const blocks = splitBlocks(page);
    let currentSection = '';
    for (const block of blocks) {
      if (block.type === 'TABLE') {
        const tc = buildTableChunk(block, input, pageNum, order++, currentSection);
        if (tc) allChunks.push(tc);
        continue;
      }
      // Legal-aware: si el bloque comienza con marcador de sección, arranca un nuevo contexto
      const headMatch = block.text.match(SECTION_RE);
      if (headMatch) {
        currentSection = `${headMatch[2]} ${headMatch[3]}`.trim();
      }
      // Dividir el bloque en sub-chunks por tamaño + solapamiento
      const subChunks = splitBySize(block.text, target, maxTok, overlap);
      for (const sub of subChunks) {
        const t = sub.trim();
        if (!t) continue;
        const chunkType = detectChunkType(t);
        const clauseRef = extractClauseRef(t, chunkType) ?? (currentSection || undefined);
        allChunks.push({
          id: `${input.documentId}_c${order}`,
          content: t,
          metadata: {
            documentId: input.documentId,
            documentTitle: input.documentTitle,
            docType: input.docType,
            page: pageNum,
            section: currentSection || undefined,
            clauseRef,
            chunkType,
            order: order++,
            jurisdiction: input.jurisdiction,
            entity: input.entity,
            period: input.period,
            version: input.version,
            status: input.status,
            collectionId: input.collectionId,
            hash: hashText(t),
          },
        });
      }
    }
  }

  // Parent-child: para cada chunk pequeño, guardamos contexto amplio (chunk + vecinos).
  // Aquí lo materializamos como campo `parentContent` en metadata.extended si el chunk es pequeño.
  for (let i = 0; i < allChunks.length; i++) {
    const c = allChunks[i];
    const left = allChunks[i - 1];
    const right = allChunks[i + 1];
    const parentParts: string[] = [];
    if (left) parentParts.push(left.content);
    parentParts.push(c.content);
    if (right) parentParts.push(right.content);
    const parentContent = parentParts.join('\n\n');
    // Lo guardamos como texto extendido para enviar al LLM
    (c.metadata as any).parentContent = parentContent;
  }

  return allChunks;
}

interface Block {
  type: 'TEXT' | 'TABLE';
  text: string;
  tableData?: { headers: string[]; rows: string[][] };
}

function splitPages(text: string, pageCount: number): string[] {
  // Intento 1: marcador explícito \f (form feed)
  const byFormFeed = text.split('\f');
  if (byFormFeed.length > 1) return byFormFeed;
  // Intento 2: marcador explícito "Página X" o "[página X]" o "--- Page X ---"
  const pageMarker = /\n\s*(?:p[áa]gina|page|hoja)\s+(\d+)\s*(?:de|of|\/)?\s*\d*\s*[:\n]?\s*/i;
  if (pageMarker.test(text)) {
    const parts = text.split(pageMarker);
    // parts[0] es previo; luego intercalan número y contenido
    const out: string[] = [];
    if (parts[0]) out.push(parts[0]);
    for (let i = 1; i < parts.length; i += 2) {
      out.push(parts[i + 1] ?? '');
    }
    return out.length > 0 ? out : [text];
  }
  // Fallback: una sola página
  void pageCount;
  return [text];
}

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  // Detectar bloques de tabla (líneas con pipes consecutivas)
  const lines = text.split('\n');
  let i = 0;
  let textBuf: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    const isTableRow = /^\s*\|.+\|\s*$/.test(line);
    if (isTableRow) {
      // flush text buffer
      if (textBuf.length > 0) {
        blocks.push({ type: 'TEXT', text: textBuf.join('\n') });
        textBuf = [];
      }
      // recolectar filas de tabla consecutivas
      const tableLines: string[] = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const tableData = parseTable(tableLines);
      blocks.push({
        type: 'TABLE',
        text: tableLines.join('\n'),
        tableData,
      });
      continue;
    }
    textBuf.push(line);
    i++;
  }
  if (textBuf.length > 0) {
    blocks.push({ type: 'TEXT', text: textBuf.join('\n') });
  }
  return blocks;
}

function parseTable(tableLines: string[]): { headers: string[]; rows: string[][] } {
  const rows = tableLines.map((l) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim()),
  );
  // Detectar separador (fila de guiones)
  let headerIdx = 0;
  if (rows.length > 1 && rows[1].every((c) => /^[-:=\s]+$/.test(c))) {
    headerIdx = 0;
    rows.splice(1, 1); // eliminar separador
  }
  const headers = rows[headerIdx] ?? [];
  const body = rows.slice(headerIdx + 1);
  return { headers, rows: body };
}

function buildTableChunk(
  block: Block,
  input: ChunkInput,
  pageNum: number,
  order: number,
  section: string,
): Chunk | null {
  if (!block.tableData || (block.tableData.rows.length === 0 && block.tableData.headers.length === 0)) {
    return null;
  }
  const text = tableToText(block.tableData);
  return {
    id: `${input.documentId}_c${order}`,
    content: text,
    metadata: {
      documentId: input.documentId,
      documentTitle: input.documentTitle,
      docType: input.docType,
      page: pageNum,
      section: section || undefined,
      chunkType: 'TABLE' as ChunkType,
      order,
      jurisdiction: input.jurisdiction,
      entity: input.entity,
      period: input.period,
      version: input.version,
      status: input.status,
      collectionId: input.collectionId,
      hash: hashText(text),
    },
    tableData: block.tableData,
  };
}

function tableToText(t: { headers: string[]; rows: string[][] }): string {
  const { headers, rows } = t;
  const all = [headers, ...rows];
  return all.map((r) => r.join(' | ')).join('\n');
}

function splitBySize(text: string, target: number, max: number, overlap: number): string[] {
  // Dividir por párrafos primero
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf = '';
  const targetChars = target * 4;
  const maxChars = max * 4;
  const overlapChars = overlap * 4;

  const pushBuf = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = '';
  };

  for (const para of paragraphs) {
    // Si el párrafo excede el máximo, partir por líneas
    if (para.length > maxChars) {
      if (buf.trim()) pushBuf();
      const sentences = splitSentences(para);
      let sub = '';
      for (const s of sentences) {
        if ((sub + ' ' + s).length > maxChars) {
          if (sub.trim()) chunks.push(sub.trim());
          sub = s;
        } else {
          sub = sub ? sub + ' ' + s : s;
        }
        if (sub.length >= targetChars) {
          chunks.push(sub.trim());
          // mantener overlap: últimas N chars del chunk anterior
          sub = sub.slice(Math.max(0, sub.length - overlapChars));
        }
      }
      if (sub.trim()) {
        if (buf.trim() && (buf + '\n\n' + sub).length <= maxChars) {
          buf = buf + '\n\n' + sub;
        } else {
          if (buf.trim()) chunks.push(buf.trim());
          buf = sub;
        }
      }
      continue;
    }
    if ((buf + '\n\n' + para).length > maxChars) {
      pushBuf();
      buf = para;
    } else {
      buf = buf ? buf + '\n\n' + para : para;
    }
    if (buf.length >= targetChars) {
      pushBuf();
    }
  }
  pushBuf();
  return chunks;
}

function splitSentences(text: string): string[] {
  // Split por puntos seguidos + fin de línea (conserva art/cláusula)
  return text
    .replace(/\n+/g, '\n')
    .split(/(?<=[.;:])\s+(?=[A-ZÁÉÍÓÚÑA-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function countChunks(input: ChunkInput): number {
  return chunkDocument(input).length;
}

export { estimateTokens };

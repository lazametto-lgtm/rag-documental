// Utilidades de tokenización multilingüe (ES/EN + números + legales)
import type { Chunk, DocType, ChunkMetadata, DocStatus, ChunkType } from './types';

// Stopwords ES + EN mínimas (mantener compacto para no sobre-filtrar)
const STOPWORDS = new Set<string>([
  // ES
  'el','la','los','las','un','una','unos','unas','de','del','al','y','o','u','que','en','a','para','por','con','se','su','sus','lo','le','les','es','fue','son','esta','este','estos','estas','esto','eso','esa','esos','esas','como','mas','pero','si','no','cuando','donde','quien','cual','entre','sin','sobre','tras','durante','mediante','segun','cada','todo','toda','todos','todas','muy','puede','pueden','ha','han','hay','ser','era','fueron','mas','menos','entre','cuyo','cuya','cuyos','cuyas',
  // EN
  'the','of','and','or','to','in','for','with','is','are','was','were','this','that','these','those','on','at','by','an','as','be','been','has','have','it','its','from','which','who','whom','where','when','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','can','will','just','should','now',
]);

const LEGAL_TOKENS = new Set<string>([
  'articulo','art','clausula','cl','inciso','inc','seccion','sec','parrafo','anexo',
  'article','clause','section','paragraph','annex','chapter','capitulo','titulo',
  'parte','item','ordinal','literal','apartado','fraccion',
]);

// Tokeniza manteniendo números, términos legales y siglas.
export function tokenize(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quitar acentos para hash estable
  const matches = normalized.match(/[a-z]{2,}|[0-9]+(?:[.,][0-9]+)?/g) ?? [];
  const out: string[] = [];
  for (const m of matches) {
    if (LEGAL_TOKENS.has(m)) {
      out.push(m);
      continue;
    }
    if (m.length < 2) continue;
    if (STOPWORDS.has(m)) continue;
    // Números: normalizar separador decimal
    out.push(m.replace(',', '.'));
  }
  return out;
}

export function hashToken(token: string, dim: number): number {
  // FNV-1a 32 bits estable
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Distribuir signo para reducir colisiones (signed hashing)
  const idx = Math.abs(h) % dim;
  return idx;
}

export function hashTokenSign(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >= 0 ? 1 : -1;
}

export function cosineSim(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function l2Norm(a: number[]): number {
  let s = 0;
  for (const v of a) s += v * v;
  return Math.sqrt(s);
}

export function normalizeVec(a: number[]): number[] {
  const n = l2Norm(a);
  if (n === 0) return a.slice();
  return a.map((v) => v / n);
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Aproximación: 4 chars ≈ 1 token para texto ES/EN mixto
  return Math.ceil(text.length / 4);
}

export function hashText(text: string): string {
  // SHA-256 vía Web Crypto (disponible en Node 18+)
  // Fallback simple si no está disponible
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 'h' + (h >>> 0).toString(16).padStart(8, '0') + '_' + text.length.toString(16);
}

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}

// Detecta tipo de chunk por heurísticas legales/contables
export function detectChunkType(text: string): ChunkType {
  const t = text.trim().toLowerCase();
  if (/^(art[ií]culo|art\.\s|article)\s+\d+/i.test(t)) return 'ARTICLE';
  if (/^(cl[áa]usula|cl\.\s|clause)\s+/i.test(t)) return 'CLAUSE';
  if (/^(secci[oó]n|sec\.\s|section)\s+/i.test(t)) return 'SECTION';
  if (/^\s*[|].+[|]\s*$/m.test(text)) return 'TABLE';
  if (/^(nota|nota al pie|footnote)/i.test(t)) return 'FOOTNOTE';
  if (/^\s*#{1,6}\s|^\s*[A-Z][A-Z\s]{4,}$/m.test(text)) return 'HEADING';
  return 'TEXT';
}

// Extrae referencia de cláusula/artículo desde el inicio del chunk
export function extractClauseRef(text: string, chunkType: ChunkType): string | undefined {
  const head = text.slice(0, 120).trim();
  const patterns: Record<ChunkType, RegExp[]> = {
    ARTICLE: [
      /^(Art[ií]culo|Art\.|Article)\s+(\d+[.\-]?\w*)/i,
    ],
    CLAUSE: [
      /^(Cl[áa]usula|Cl\.|Clause)\s+(?:\w+)?\s?(\d+[.\-]?\w*)/i,
    ],
    SECTION: [
      /^(Secci[oó]n|Sec\.|Section)\s+(\d+[.\-]?\w*)/i,
    ],
    TEXT: [],
    TABLE: [],
    HEADING: [],
    FOOTNOTE: [],
  };
  for (const re of patterns[chunkType] ?? []) {
    const m = head.match(re);
    if (m) return `${chunkType} ${m[2]}`;
  }
  return undefined;
}

export function buildSnippet(text: string, maxLen = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trimEnd() + '…';
}

export function docTypeLabel(t: DocType): string {
  switch (t) {
    case 'BALANCE': return 'Balance contable';
    case 'CONTRACT': return 'Contrato';
    case 'REGULATION': return 'Normativa';
    default: return 'Otro';
  }
}

export function statusLabel(s: DocStatus): string {
  switch (s) {
    case 'VIGENT': return 'Vigente';
    case 'SUPERSEDED': return 'Derogado/Sustituido';
    case 'DRAFT': return 'Borrador';
  }
}

export function chunkTypeLabel(c: ChunkType): string {
  switch (c) {
    case 'ARTICLE': return 'Artículo';
    case 'CLAUSE': return 'Cláusula';
    case 'SECTION': return 'Sección';
    case 'TABLE': return 'Tabla';
    case 'HEADING': return 'Encabezado';
    case 'FOOTNOTE': return 'Nota al pie';
    default: return 'Texto';
  }
}

export function asDocType(s: string): DocType {
  const v = (s || '').toUpperCase();
  if (v === 'BALANCE' || v === 'CONTRACT' || v === 'REGULATION' || v === 'OTHER') return v;
  if (v.includes('BALANCE') || v.includes('ESTADO')) return 'BALANCE';
  if (v.includes('CONTRACT') || v.includes('CONTRATO')) return 'CONTRACT';
  if (v.includes('REGUL') || v.includes('NORMAT') || v.includes('LEY')) return 'REGULATION';
  return 'OTHER';
}

export function asDocStatus(s: string): DocStatus {
  const v = (s || '').toUpperCase();
  if (v === 'VIGENT' || v === 'SUPERSEDED' || v === 'DRAFT') return v;
  return 'VIGENT';
}

export function asChunkType(s: string): ChunkType {
  const v = (s || '').toUpperCase();
  const valid: ChunkType[] = ['TEXT','TABLE','HEADING','CLAUSE','ARTICLE','SECTION','FOOTNOTE'];
  return (valid as string[]).includes(v) ? (v as ChunkType) : 'TEXT';
}

export type { Chunk, ChunkMetadata, DocType, DocStatus, ChunkType };

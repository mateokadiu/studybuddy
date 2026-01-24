/**
 * Document chunker.
 *
 * Splits a sequence of page texts into ~target-token-size chunks with
 * paragraph + sentence-aware boundaries. Never splits mid-sentence. Tracks
 * each chunk's page span and char offset so we can render citations in the
 * UI and (eventually) scroll the source PDF view to the citation.
 */

import { encode } from 'gpt-3-encoder';

export interface PageText {
  /** 1-indexed page number */
  page: number;
  /** raw extracted text for the page */
  text: string;
}

export interface RawChunk {
  /** ordinal index within the doc */
  idx: number;
  /** first page this chunk includes (1-indexed) */
  pageStart: number;
  /** last page this chunk includes (1-indexed) */
  pageEnd: number;
  /** char offset into the joined doc text where this chunk begins */
  charOffset: number;
  /** the chunk content */
  text: string;
  /** token count under gpt-3-encoder BPE — close enough to the LLM tokenizer for sizing */
  tokenCount: number;
}

export interface ChunkOptions {
  /** target tokens per chunk (default 512 per PLAN §3) */
  targetTokens?: number;
  /** soft maximum tokens before we force-flush (default 600) */
  maxTokens?: number;
  /** overlap tokens carried into the next chunk (default 64) */
  overlapTokens?: number;
}

/** Split a page into paragraphs by blank-line boundaries. */
export function paragraphs(s: string): string[] {
  return s
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Split a paragraph into sentences (rough heuristic). */
export function sentences(s: string): string[] {
  return s
    .split(/(?<=[.!?])\s+(?=[A-Z(])/g)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** Count BPE tokens for a string. */
export function countTokens(s: string): number {
  return encode(s).length;
}

/**
 * Token-sized chunker.
 *
 * Collects paragraphs (or, if a paragraph alone exceeds maxTokens, sentences)
 * until the running token count hits targetTokens, then flushes. Page span
 * and char offset are tracked across the input stream.
 */
/**
 * Take the trailing ~overlap tokens of a chunk to seed the next chunk so
 * context flows across boundaries. Snaps to sentence boundary when we can.
 */
function trailingOverlap(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return '';
  const sents = sentences(text);
  let acc = '';
  let acct = 0;
  // walk sentences from the end
  for (let i = sents.length - 1; i >= 0; i--) {
    const s = sents[i] as string;
    const t = countTokens(s);
    if (acct + t > overlapTokens && acc.length > 0) break;
    acc = acc.length === 0 ? s : `${s} ${acc}`;
    acct += t;
    if (acct >= overlapTokens) break;
  }
  return acc;
}

export function chunkByTokens(pages: PageText[], opts: ChunkOptions = {}): RawChunk[] {
  const target = opts.targetTokens ?? 512;
  const max = opts.maxTokens ?? Math.max(target + 100, Math.floor(target * 1.2));
  const overlap = opts.overlapTokens ?? 64;

  const out: RawChunk[] = [];
  let charCursor = 0;
  let idx = 0;
  let bufText = '';
  let bufTokens = 0;
  let bufStartPage = 0;
  let bufEndPage = 0;
  let bufStartOffset = 0;
  let pendingOverlap = '';

  const flush = () => {
    if (bufText.length === 0) {
      pendingOverlap = '';
      return;
    }
    out.push({
      idx: idx++,
      pageStart: bufStartPage,
      pageEnd: bufEndPage,
      charOffset: bufStartOffset,
      text: bufText,
      tokenCount: bufTokens,
    });
    pendingOverlap = trailingOverlap(bufText, overlap);
    bufText = '';
    bufTokens = 0;
  };

  const appendUnit = (unit: string, page: number, sep = '\n\n') => {
    const unitTokens = countTokens(unit);
    if (bufText.length === 0) {
      bufStartPage = page;
      bufStartOffset = charCursor;
      if (pendingOverlap.length > 0) {
        bufText = pendingOverlap;
        bufTokens = countTokens(pendingOverlap);
        bufText = `${bufText}${sep}${unit}`;
        bufTokens += unitTokens;
        pendingOverlap = '';
      } else {
        bufText = unit;
        bufTokens = unitTokens;
      }
    } else if (bufTokens + unitTokens <= max) {
      bufText = `${bufText}${sep}${unit}`;
      bufTokens += unitTokens;
    } else {
      flush();
      bufStartPage = page;
      bufStartOffset = charCursor;
      if (pendingOverlap.length > 0) {
        bufText = pendingOverlap;
        bufTokens = countTokens(pendingOverlap);
        bufText = `${bufText}${sep}${unit}`;
        bufTokens += unitTokens;
        pendingOverlap = '';
      } else {
        bufText = unit;
        bufTokens = unitTokens;
      }
    }
    bufEndPage = page;
    charCursor += unit.length + sep.length;
    if (bufTokens >= target) flush();
  };

  for (const page of pages) {
    for (const para of paragraphs(page.text)) {
      const paraTokens = countTokens(para);
      if (paraTokens <= max) {
        appendUnit(para, page.page);
      } else {
        for (const sent of sentences(para)) {
          appendUnit(sent, page.page, ' ');
        }
      }
    }
  }
  flush();
  return out;
}

/**
 * Legacy paragraph-only chunker (kept for callers that want a char-based
 * cap with no token counting — e.g. very tight memory budgets).
 */
export function chunkParagraphs(pages: PageText[], softCharCap = 2000): RawChunk[] {
  const out: RawChunk[] = [];
  let charCursor = 0;
  let idx = 0;
  let buf = '';
  let bufStartPage = 0;
  let bufEndPage = 0;
  let bufStartOffset = 0;

  const flush = () => {
    if (buf.length === 0) return;
    out.push({
      idx: idx++,
      pageStart: bufStartPage,
      pageEnd: bufEndPage,
      charOffset: bufStartOffset,
      text: buf,
      tokenCount: countTokens(buf),
    });
    buf = '';
  };

  for (const page of pages) {
    const paras = paragraphs(page.text);
    for (const p of paras) {
      if (buf.length === 0) {
        bufStartPage = page.page;
        bufStartOffset = charCursor;
      }
      if (buf.length === 0) {
        buf = p;
      } else if (buf.length + 2 + p.length <= softCharCap) {
        buf = `${buf}\n\n${p}`;
      } else {
        flush();
        bufStartPage = page.page;
        bufStartOffset = charCursor;
        buf = p;
      }
      bufEndPage = page.page;
      charCursor += p.length + 2;
    }
  }
  flush();
  return out;
}

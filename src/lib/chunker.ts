/**
 * Document chunker.
 *
 * Splits a sequence of page texts into ~target-token-size chunks with
 * paragraph-aware boundaries. Never splits mid-sentence. Tracks each
 * chunk's page span and char offset so we can render citations in the UI
 * and (eventually) scroll the source PDF view to the citation.
 *
 * Commit 9: paragraph splitter only (token sizing added in commit 10,
 * overlap + full provenance + tests in commit 11).
 */

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
  /** the chunk content (paragraphs joined by \n\n) */
  text: string;
}

/** Split a page into paragraphs by blank-line boundaries. */
export function paragraphs(s: string): string[] {
  return s
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Naive paragraph-collected chunker (no token sizing yet).
 * Each non-empty paragraph becomes its own chunk; consecutive same-page
 * paragraphs collapse together up to a soft character cap.
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
      charCursor += p.length + 2; // account for the joining \n\n
    }
  }
  flush();
  return out;
}

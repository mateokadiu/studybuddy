/**
 * PDF text extraction.
 *
 * Native impl wraps `react-native-pdf-extract` which delivers per-page
 * text strings (no positions yet — that comes in the v0.2 turbo-module
 * wrapping PDFKit / PdfBox).
 *
 * Node-side impl reads a JSON sidecar fixture for tests — bundled PDFs
 * never get touched off-device, so the e2e fixtures live as `<name>.json`
 * next to the `.pdf`.
 */

import type { PageText } from '@/lib/chunker';

export interface PageWithOffset extends PageText {
  /** char offset into the joined doc text where this page starts */
  charOffset: number;
}

export interface ExtractedPdf {
  pageCount: number;
  charCount: number;
  pages: PageWithOffset[];
}

/** Compute char offsets for an array of page texts. */
export function attachCharOffsets(pages: ReadonlyArray<PageText>): PageWithOffset[] {
  const out: PageWithOffset[] = [];
  let cursor = 0;
  for (const p of pages) {
    out.push({ page: p.page, text: p.text, charOffset: cursor });
    cursor += p.text.length + 1; // +1 for the join newline used downstream
  }
  return out;
}

/** Given a doc-wide char offset, which page contains it? Returns 1-indexed page or null. */
export function pageForCharOffset(
  pages: ReadonlyArray<PageWithOffset>,
  offset: number,
): number | null {
  for (let i = pages.length - 1; i >= 0; i--) {
    const p = pages[i] as PageWithOffset;
    if (offset >= p.charOffset) return p.page;
  }
  return null;
}

export interface PdfService {
  extract(uri: string): Promise<ExtractedPdf>;
}

function isNode(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

function nativeService(): PdfService {
  const mod = require('react-native-pdf-extract') as {
    extractText(uri: string): Promise<string[] | { pages: string[] }>;
  };
  return {
    async extract(uri) {
      const result = await mod.extractText(uri);
      const pages = Array.isArray(result) ? result : result.pages;
      const flat: PageText[] = pages.map((text, i) => ({ page: i + 1, text: text ?? '' }));
      const withOffsets = attachCharOffsets(flat);
      const charCount = flat.reduce((acc, p) => acc + p.text.length, 0);
      return { pageCount: flat.length, charCount, pages: withOffsets };
    },
  };
}

function nodeStubService(): PdfService {
  const fs = require('node:fs/promises') as typeof import('node:fs/promises');
  return {
    async extract(uri) {
      const sidecar = uri.endsWith('.json') ? uri : `${uri}.json`;
      try {
        const raw = await fs.readFile(sidecar, 'utf8');
        const parsed = JSON.parse(raw) as { pages: string[] };
        const flat: PageText[] = parsed.pages.map((text, i) => ({ page: i + 1, text }));
        const withOffsets = attachCharOffsets(flat);
        return {
          pageCount: flat.length,
          charCount: flat.reduce((a, p) => a + p.text.length, 0),
          pages: withOffsets,
        };
      } catch {
        return { pageCount: 0, charCount: 0, pages: [] };
      }
    },
  };
}

let cached: PdfService | null = null;
export function getPdfService(): PdfService {
  if (cached) return cached;
  cached = isNode() ? nodeStubService() : nativeService();
  return cached;
}

export function _resetPdfServiceForTests(): void {
  cached = null;
}

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

export interface ExtractedPdf {
  pageCount: number;
  charCount: number;
  pages: PageText[];
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
      const out: PageText[] = pages.map((text, i) => ({ page: i + 1, text: text ?? '' }));
      const charCount = out.reduce((acc, p) => acc + p.text.length, 0);
      return { pageCount: out.length, charCount, pages: out };
    },
  };
}

function nodeStubService(): PdfService {
  const fs = require('node:fs/promises') as typeof import('node:fs/promises');
  const path = require('node:path') as typeof import('node:path');
  return {
    async extract(uri) {
      const sidecar = uri.endsWith('.json') ? uri : `${uri}.json`;
      try {
        const raw = await fs.readFile(sidecar, 'utf8');
        const parsed = JSON.parse(raw) as { pages: string[] };
        const pages: PageText[] = parsed.pages.map((text, i) => ({ page: i + 1, text }));
        return {
          pageCount: pages.length,
          charCount: pages.reduce((a, p) => a + p.text.length, 0),
          pages,
        };
      } catch {
        // unknown file -> empty doc
        void path;
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

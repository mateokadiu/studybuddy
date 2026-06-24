import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  _resetPdfServiceForTests,
  attachCharOffsets,
  getPdfService,
  pageForCharOffset,
} from './pdf.service';

describe('attachCharOffsets', () => {
  it('cumulative offsets including \\n join', () => {
    const out = attachCharOffsets([
      { page: 1, text: 'hello' },
      { page: 2, text: 'world' },
    ]);
    expect(out[0]!.charOffset).toBe(0);
    expect(out[1]!.charOffset).toBe(6); // "hello".length + 1
  });
});

describe('pageForCharOffset', () => {
  it('finds the right page', () => {
    const pages = attachCharOffsets([
      { page: 1, text: 'aaa' },
      { page: 2, text: 'bbbb' },
      { page: 3, text: 'cc' },
    ]);
    expect(pageForCharOffset(pages, 0)).toBe(1);
    expect(pageForCharOffset(pages, 3)).toBe(1); // still on page 1 (chars 0-2)
    expect(pageForCharOffset(pages, 4)).toBe(2);
    expect(pageForCharOffset(pages, 9)).toBe(3);
  });
});

describe('pdf service stub', () => {
  it('reads sidecar JSON next to a pdf path', async () => {
    _resetPdfServiceForTests();
    const dir = await mkdtemp(join(tmpdir(), 'sb-pdf-'));
    const pdf = join(dir, 'sample.pdf');
    await writeFile(`${pdf}.json`, JSON.stringify({ pages: ['p1 text', 'p2 text'] }), 'utf8');
    const svc = getPdfService();
    const result = await svc.extract(pdf);
    expect(result.pageCount).toBe(2);
    expect(result.charCount).toBe('p1 text'.length + 'p2 text'.length);
    expect(result.pages[0]!.page).toBe(1);
    expect(result.pages[1]!.charOffset).toBe(8);
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty doc for missing file', async () => {
    _resetPdfServiceForTests();
    const result = await getPdfService().extract('/no/such/file.pdf');
    expect(result.pageCount).toBe(0);
  });
});

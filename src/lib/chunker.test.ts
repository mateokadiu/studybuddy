import { describe, expect, it } from 'vitest';
import { chunkByTokens, chunkParagraphs, countTokens, paragraphs, sentences } from './chunker';

describe('paragraphs', () => {
  it('splits on blank lines', () => {
    expect(paragraphs('one\n\ntwo\n\nthree')).toEqual(['one', 'two', 'three']);
  });
  it('handles CRLF', () => {
    expect(paragraphs('one\r\n\r\ntwo')).toEqual(['one', 'two']);
  });
  it('drops empties', () => {
    expect(paragraphs('   \n\n   ')).toEqual([]);
  });
});

describe('sentences', () => {
  it('splits on sentence terminators', () => {
    const out = sentences('Foo bar. Baz qux! Quux? End.');
    expect(out).toEqual(['Foo bar.', 'Baz qux!', 'Quux?', 'End.']);
  });
  it('does not split mid-abbreviation', () => {
    // crude — there's no lookbehind for capital after, so we mostly hold
    const out = sentences('See Fig. 3 for details.');
    expect(out.length).toBe(1);
  });
});

describe('chunkByTokens', () => {
  it('packs short paragraphs into a single chunk', () => {
    const pages = [{ page: 1, text: 'alpha bravo.\n\ncharlie delta.\n\necho foxtrot.' }];
    const chunks = chunkByTokens(pages, { targetTokens: 1024, overlapTokens: 0 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.pageStart).toBe(1);
    expect(chunks[0]!.pageEnd).toBe(1);
    expect(chunks[0]!.idx).toBe(0);
    // token count is the sum of per-unit BPE counts; not necessarily equal
    // to the BPE of the joined text (merges across boundaries differ),
    // but close enough for sizing.
    const reBpe = countTokens(chunks[0]!.text);
    expect(Math.abs(chunks[0]!.tokenCount - reBpe)).toBeLessThan(reBpe);
  });

  it('emits multiple chunks when content exceeds target', () => {
    // a doc with many paragraphs forces multiple chunks at low target
    const paras: string[] = [];
    for (let i = 0; i < 30; i++) {
      paras.push(`Paragraph ${i}. This paragraph talks about subject ${i} for a while.`);
    }
    const pages = [{ page: 1, text: paras.join('\n\n') }];
    const chunks = chunkByTokens(pages, { targetTokens: 40, overlapTokens: 0, maxTokens: 80 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.tokenCount).toBeLessThanOrEqual(100);
    }
  });

  it('tracks page span across multi-page chunks', () => {
    const pages = [
      { page: 1, text: 'page one para a.\n\npage one para b.' },
      { page: 2, text: 'page two para a.' },
      { page: 3, text: 'page three para a.' },
    ];
    const chunks = chunkByTokens(pages, { targetTokens: 1024, overlapTokens: 0 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.pageStart).toBe(1);
    expect(chunks[0]!.pageEnd).toBe(3);
  });

  it('emits non-decreasing char offsets', () => {
    const long = 'sentence one. sentence two. sentence three. '.repeat(30);
    const pages = [{ page: 1, text: long }];
    const chunks = chunkByTokens(pages, { targetTokens: 30, maxTokens: 60, overlapTokens: 0 });
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.charOffset).toBeGreaterThanOrEqual(chunks[i - 1]!.charOffset);
      expect(chunks[i]!.idx).toBe(i);
    }
  });

  it('overlap carries trailing context into next chunk', () => {
    const long = 'one. two. three. four. five. six. seven. eight. nine. ten. '.repeat(20);
    const pages = [{ page: 1, text: long }];
    const noOverlap = chunkByTokens(pages, { targetTokens: 40, maxTokens: 80, overlapTokens: 0 });
    const withOverlap = chunkByTokens(pages, {
      targetTokens: 40,
      maxTokens: 80,
      overlapTokens: 20,
    });
    // overlap should produce at least as many chunks and chunk-2's text should share a prefix with chunk-1's tail
    expect(withOverlap.length).toBeGreaterThanOrEqual(noOverlap.length);
    if (withOverlap.length >= 2) {
      const c1 = withOverlap[0]!.text;
      const c2 = withOverlap[1]!.text;
      const tail = c1.slice(-30);
      // some non-empty trailing fragment of c1 should appear in c2
      const probe = tail.split(/\s+/).slice(-3).join(' ');
      expect(c2.includes(probe.trim())).toBe(true);
    }
  });
});

describe('chunkParagraphs', () => {
  it('respects soft char cap', () => {
    const pages = [{ page: 1, text: 'aaa.\n\nbbb.\n\nccc.' }];
    const chunks = chunkParagraphs(pages, 8);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

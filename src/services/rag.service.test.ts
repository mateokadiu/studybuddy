import { describe, it, expect } from 'vitest';
import { extractCites, markUncitedSentences } from './rag.service';
import type { RetrievedChunk } from '@/types/chunk';

const retrieved: RetrievedChunk[] = [
  { id: 'c1', docId: 'd1', idx: 0, text: '', pageStart: 1, pageEnd: 3, score: 0.9 },
  { id: 'c2', docId: 'd1', idx: 1, text: '', pageStart: 4, pageEnd: 7, score: 0.8 },
];

describe('extractCites', () => {
  it('finds [p.NN] tokens and maps to chunks', () => {
    const cites = extractCites('See [p.2] for details. And [p.5] for the rest.', retrieved);
    expect(cites).toEqual([
      { chunkId: 'c1', page: 2 },
      { chunkId: 'c2', page: 5 },
    ]);
  });

  it('dedupes identical chunk+page', () => {
    const cites = extractCites('[p.2] thing [p.2] thing', retrieved);
    expect(cites).toHaveLength(1);
  });

  it('emits empty chunkId for unknown page', () => {
    const cites = extractCites('see [p.99]', retrieved);
    expect(cites).toEqual([{ chunkId: '', page: 99 }]);
  });
});

describe('markUncitedSentences', () => {
  it('passes through cited sentences', () => {
    const r = markUncitedSentences('Foo is bar [p.1]. Baz is qux [p.2].');
    expect(r.uncited).toHaveLength(0);
    expect(r.rewritten).not.toContain('⚠');
  });

  it('marks uncited sentences', () => {
    const r = markUncitedSentences('Foo is bar. Baz is qux [p.2].');
    expect(r.uncited).toHaveLength(1);
    expect(r.rewritten).toContain('⚠ uncited');
  });
});

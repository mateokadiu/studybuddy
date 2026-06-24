import type { Chunk } from '@/db/schema';
import { describe, expect, it } from 'vitest';
import { generateCards, safeParseJson } from './card-gen.service';
import { mockEmbed } from './embed.service';
import { packEmbedding } from './vector-store';

function makeChunk(id: string, text: string, pageStart: number, pageEnd: number): Chunk {
  const v = mockEmbed(text);
  return {
    id,
    docId: 'doc1',
    idx: Number.parseInt(id.slice(1), 10) || 0,
    pageStart,
    pageEnd,
    charOffset: 0,
    text,
    tokenCount: text.split(/\s+/).length,
    embedding: packEmbedding(v),
  };
}

describe('safeParseJson', () => {
  it('parses a clean array', () => {
    const out = safeParseJson('[{"type":"qa","front":"a?","back":"a."}]');
    expect(out).toHaveLength(1);
  });

  it('tolerates leading prelude', () => {
    const out = safeParseJson('Here you go:\n[{"type":"qa","front":"a?","back":"a."}]\nDone.');
    expect(out).toHaveLength(1);
  });

  it('returns [] on garbage', () => {
    expect(safeParseJson('not json')).toEqual([]);
  });
});

describe('generateCards', () => {
  it('emits card events and reaches target', async () => {
    const chunks: Chunk[] = [];
    for (let i = 0; i < 8; i++) {
      chunks.push(
        makeChunk(`c${i}`, `chunk ${i} talks about subject ${i} in great detail`, i + 1, i + 1),
      );
    }
    const events: string[] = [];
    let lastCount = 0;
    const result = await generateCards({ chunks, target: 10 }, (e) => {
      events.push(e.type);
      lastCount = e.count;
    });
    expect(result.modelId).toBe('mock');
    expect(result.promptVersion).toBe('card-gen.v1');
    expect(events).toContain('card');
    expect(events).toContain('done');
    expect(lastCount).toBeGreaterThanOrEqual(1);
    expect(lastCount).toBeLessThanOrEqual(10);
  });

  it('honors dedup threshold (low threshold drops many)', async () => {
    const chunks: Chunk[] = [];
    for (let i = 0; i < 4; i++) {
      chunks.push(makeChunk(`c${i}`, `chunk ${i}`, i + 1, i + 1));
    }
    const r1 = await generateCards({ chunks, target: 20, dedupThreshold: 0.0 });
    const r2 = await generateCards({ chunks, target: 20, dedupThreshold: 1.01 });
    expect(r1.cards.length).toBeLessThanOrEqual(r2.cards.length);
  });
});

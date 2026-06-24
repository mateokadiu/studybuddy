import { cosine } from '@/lib/cosine';
import { describe, expect, it } from 'vitest';
import {
  EMBED_BATCH_SIZE,
  EMBED_DIM,
  benchEmbed,
  embedAllChunked,
  getEmbedService,
  mockEmbed,
} from './embed.service';

describe('embed service (mock)', () => {
  it('produces 384-dim float32 vectors', async () => {
    const svc = getEmbedService();
    const v = await svc.embed('hello world');
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(EMBED_DIM);
  });

  it('is deterministic per input', async () => {
    const svc = getEmbedService();
    const a = await svc.embed('the mitochondria is the powerhouse of the cell');
    const b = await svc.embed('the mitochondria is the powerhouse of the cell');
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('different inputs give different vectors', async () => {
    const a = mockEmbed('apple');
    const b = mockEmbed('banana');
    // tail: should disagree somewhere
    let differs = false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        differs = true;
        break;
      }
    }
    expect(differs).toBe(true);
    // and similarity should be modest, not 1
    expect(cosine(a, b)).toBeLessThan(0.95);
  });

  it('output is L2-normalized', async () => {
    const v = await getEmbedService().embed('arbitrary text');
    let s = 0;
    for (let i = 0; i < v.length; i++) s += (v[i] as number) ** 2;
    expect(Math.sqrt(s)).toBeCloseTo(1, 4);
  });

  it('batch returns in input order', async () => {
    const svc = getEmbedService();
    const out = await svc.embedBatch(['x', 'y', 'z']);
    expect(out).toHaveLength(3);
    const x = await svc.embed('x');
    expect(Array.from(out[0]!)).toEqual(Array.from(x));
  });

  it('modelId is "mock" in dev', () => {
    expect(getEmbedService().modelId()).toBe('mock');
  });
});

describe('embedAllChunked', () => {
  it('respects EMBED_BATCH_SIZE and emits progress', async () => {
    const svc = getEmbedService();
    const inputs = Array.from({ length: EMBED_BATCH_SIZE * 3 + 2 }, (_, i) => `chunk ${i}`);
    const progressCalls: { done: number; total: number }[] = [];
    const out = await embedAllChunked(svc, inputs, (done, total) =>
      progressCalls.push({ done, total }),
    );
    expect(out).toHaveLength(inputs.length);
    expect(progressCalls).toHaveLength(4); // 16, 32, 48, 50
    expect(progressCalls.at(-1)!.done).toBe(inputs.length);
  });
});

describe('benchEmbed', () => {
  it('returns a sensible result', async () => {
    const r = await benchEmbed(getEmbedService(), 32);
    expect(r.count).toBe(32);
    expect(r.totalMs).toBeGreaterThanOrEqual(0);
    expect(r.embedsPerSec).toBeGreaterThan(0);
  });
});

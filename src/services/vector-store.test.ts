import { describe, it, expect } from 'vitest';
import { packEmbedding, unpackEmbedding } from './vector-store';

describe('embedding pack/unpack', () => {
  it('round-trips a float32 vector', () => {
    const v = new Float32Array([1, -2, 3.5, 0, 0.125]);
    const blob = packEmbedding(v);
    const back = unpackEmbedding(blob);
    expect(back.length).toBe(v.length);
    for (let i = 0; i < v.length; i++) expect(back[i]).toBe(v[i]);
  });

  it('unpacking null gives a zero vector of EMBED_DIM', () => {
    const back = unpackEmbedding(null);
    expect(back.length).toBe(384);
    expect(back[0]).toBe(0);
  });
});

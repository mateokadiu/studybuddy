import { describe, expect, it } from 'vitest';
import {
  benchTopKJs,
  isCosineUDFAvailable,
  packEmbedding,
  registerCosineUDF,
  unpackEmbedding,
} from './vector-store';

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

describe('cosine UDF', () => {
  it('does not register on node', () => {
    const ok = registerCosineUDF();
    expect(ok).toBe(false);
    expect(isCosineUDFAvailable()).toBe(false);
  });
});

describe('benchTopKJs', () => {
  it('returns a sensible result over a synthetic batch', () => {
    const dim = 16;
    const n = 200;
    const matrix = new Float32Array(n * dim);
    for (let i = 0; i < matrix.length; i++) matrix[i] = Math.random();
    const query = new Float32Array(dim);
    for (let i = 0; i < dim; i++) query[i] = Math.random();
    const r = benchTopKJs(query, matrix, dim, 5);
    expect(r.rowCount).toBe(n);
    expect(r.jsMs).toBeGreaterThanOrEqual(0);
    expect(r.udfMs).toBeNull();
  });
});

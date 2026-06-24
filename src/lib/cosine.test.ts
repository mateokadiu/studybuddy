import { describe, expect, it } from 'vitest';
import { cosine, l2normalize, l2sq, topKCosine } from './cosine';

function f32(...v: number[]): Float32Array {
  return new Float32Array(v);
}

describe('cosine', () => {
  it('identical vectors -> 1', () => {
    const a = f32(1, 2, 3);
    expect(cosine(a, a)).toBeCloseTo(1, 6);
  });

  it('opposite vectors -> -1', () => {
    expect(cosine(f32(1, 0, 0), f32(-1, 0, 0))).toBeCloseTo(-1, 6);
  });

  it('orthogonal -> 0', () => {
    expect(cosine(f32(1, 0), f32(0, 1))).toBeCloseTo(0, 6);
  });

  it('zero vector -> 0 (no NaN)', () => {
    expect(cosine(f32(0, 0, 0), f32(1, 2, 3))).toBe(0);
  });

  it('dimension mismatch -> throws', () => {
    expect(() => cosine(f32(1, 2), f32(1, 2, 3))).toThrow(/dimension mismatch/);
  });

  it('matches the textbook formula', () => {
    // dot=11 |a|=sqrt(5) |b|=5 -> 11 / sqrt(125)
    const got = cosine(f32(1, 2), f32(3, 4));
    expect(got).toBeCloseTo(11 / Math.sqrt(125), 6);
  });
});

describe('l2sq', () => {
  it('zero on identical', () => {
    expect(l2sq(f32(1, 2, 3), f32(1, 2, 3))).toBe(0);
  });
  it('basic case', () => {
    expect(l2sq(f32(0, 0), f32(3, 4))).toBe(25);
  });
});

describe('l2normalize', () => {
  it('produces unit vector', () => {
    const v = f32(3, 4);
    l2normalize(v);
    expect(Math.sqrt(v[0]! * v[0]! + v[1]! * v[1]!)).toBeCloseTo(1, 6);
  });
  it('zero vector untouched', () => {
    const v = f32(0, 0);
    l2normalize(v);
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
  });
  it('after normalize, dot equals cosine', () => {
    const a = f32(1, 2, 3);
    const b = f32(4, 5, 6);
    const c = cosine(a, b);
    l2normalize(a);
    l2normalize(b);
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
    expect(dot).toBeCloseTo(c, 6);
  });
});

describe('topKCosine', () => {
  it('returns sorted descending', () => {
    // 3 rows, dim 2:  [1,0], [0,1], [1,1]
    const m = f32(1, 0, 0, 1, 1, 1);
    const got = topKCosine(f32(1, 0), m, 2, 3);
    expect(got[0]!.index).toBe(0); // perfect match
    expect(got[0]!.score).toBeCloseTo(1, 6);
    expect(got[1]!.index).toBe(2); // [1,1] is closer than [0,1]
    expect(got[2]!.index).toBe(1);
  });

  it('respects k', () => {
    const m = f32(1, 0, 0, 1, 1, 1);
    const got = topKCosine(f32(1, 0), m, 2, 1);
    expect(got).toHaveLength(1);
    expect(got[0]!.index).toBe(0);
  });

  it('rejects non-divisible matrix', () => {
    expect(() => topKCosine(f32(1, 0), f32(1, 0, 0), 2, 1)).toThrow(/not divisible/);
  });
});

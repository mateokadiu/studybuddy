import { describe, it, expect } from 'vitest';
import { kmeans } from './kmeans';

function f32(...v: number[]): Float32Array {
  return new Float32Array(v);
}

describe('kmeans', () => {
  it('splits two well-separated clusters', () => {
    // 6 points near (0,0) and (10,10)
    const data = f32(
      0, 0,
      0.1, 0,
      0, 0.1,
      10, 10,
      10.1, 10,
      10, 10.1,
    );
    const { assignments, medoids, iters } = kmeans(data, 2, { k: 2, seed: 7 });
    // both halves should agree internally
    const a = assignments[0]!;
    const b = assignments[3]!;
    expect(a).not.toBe(b);
    expect(assignments[1]).toBe(a);
    expect(assignments[2]).toBe(a);
    expect(assignments[4]).toBe(b);
    expect(assignments[5]).toBe(b);
    expect(medoids).toHaveLength(2);
    expect(iters).toBeLessThan(10);
  });

  it('returns one cluster when k=1', () => {
    const data = f32(0, 0, 1, 1, 2, 2);
    const { assignments, medoids } = kmeans(data, 2, { k: 1, seed: 1 });
    for (const a of assignments) expect(a).toBe(0);
    expect(medoids).toHaveLength(1);
  });

  it('caps k at n', () => {
    const data = f32(0, 0, 1, 1);
    const { centroids } = kmeans(data, 2, { k: 5, seed: 1 });
    // k effectively becomes 2 → 2*2 = 4 floats
    expect(centroids.length).toBe(4);
  });

  it('is deterministic for the same seed', () => {
    const data = f32(0, 0, 0.5, 0.5, 5, 5, 5.5, 5.5, 10, 10, 10.5, 10.5);
    const a = kmeans(data, 2, { k: 3, seed: 42 });
    const b = kmeans(data, 2, { k: 3, seed: 42 });
    expect(Array.from(a.assignments)).toEqual(Array.from(b.assignments));
  });

  it('rejects zero-length input', () => {
    expect(() => kmeans(f32(), 2, { k: 1 })).toThrow(/invalid input/);
  });
});

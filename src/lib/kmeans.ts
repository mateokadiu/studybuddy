/**
 * Mini k-means for sampling representative chunks during card generation.
 *
 * Use case: a 50-page PDF chunks to ~200 vectors. We want ~6 representative
 * chunks that cover the doc's topic space, not 6 sequential chunks.
 * k-means++ init + a handful of Lloyd iterations is overkill quality for the
 * problem size, runs in milliseconds, and is deterministic given a seed.
 */

import { l2sq } from './cosine';

export interface KMeansOptions {
  /** number of clusters */
  k: number;
  /** max Lloyd iterations (default 25 — converges in <10 for our shapes) */
  maxIters?: number;
  /** deterministic random seed (default 1) */
  seed?: number;
}

export interface KMeansResult {
  /** length n; row i belongs to cluster assignments[i] */
  assignments: Int32Array;
  /** k × dim row-major centroids */
  centroids: Float32Array;
  /** indices into the input rows that are closest to each centroid */
  medoids: number[];
  /** lloyd iterations actually run */
  iters: number;
}

/** Tiny seeded LCG so tests are reproducible. */
function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** k-means++ seeding — pick centroid 0 uniformly, then proportional to D^2. */
function seedPlusPlus(
  rows: Float32Array,
  n: number,
  dim: number,
  k: number,
  rng: () => number,
): Float32Array {
  const centroids = new Float32Array(k * dim);
  // first centroid: uniformly random row
  const first = Math.floor(rng() * n);
  centroids.set(rows.subarray(first * dim, (first + 1) * dim), 0);

  const dist = new Float64Array(n);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let i = 0; i < n; i++) {
      const row = rows.subarray(i * dim, (i + 1) * dim);
      let best = Number.POSITIVE_INFINITY;
      for (let j = 0; j < c; j++) {
        const cen = centroids.subarray(j * dim, (j + 1) * dim);
        const d = l2sq(row, cen);
        if (d < best) best = d;
      }
      dist[i] = best;
      total += best;
    }
    // sample proportional to D^2
    let pick = rng() * total;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      pick -= dist[i] as number;
      if (pick <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.set(rows.subarray(chosen * dim, (chosen + 1) * dim), c * dim);
  }
  return centroids;
}

export function kmeans(rows: Float32Array, dim: number, opts: KMeansOptions): KMeansResult {
  const n = rows.length / dim;
  if (!Number.isInteger(n) || n === 0) {
    throw new Error(`kmeans: invalid input (${rows.length} floats, dim ${dim})`);
  }
  const k = Math.min(opts.k, n);
  if (k < 1) throw new Error('kmeans: k must be >= 1');
  const maxIters = opts.maxIters ?? 25;
  const rng = lcg(opts.seed ?? 1);

  let centroids = seedPlusPlus(rows, n, dim, k, rng);
  const assignments = new Int32Array(n);
  const counts = new Int32Array(k);
  let iters = 0;

  for (let iter = 0; iter < maxIters; iter++) {
    iters++;
    let moved = 0;
    // assign step
    for (let i = 0; i < n; i++) {
      const row = rows.subarray(i * dim, (i + 1) * dim);
      let best = 0;
      let bestD = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const cen = centroids.subarray(c * dim, (c + 1) * dim);
        const d = l2sq(row, cen);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if ((assignments[i] as number) !== best) moved++;
      assignments[i] = best;
    }
    if (moved === 0) break;

    // update step
    const next = new Float32Array(k * dim);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i] as number;
      counts[c] = (counts[c] as number) + 1;
      const off = c * dim;
      for (let d = 0; d < dim; d++) {
        next[off + d] = (next[off + d] as number) + (rows[i * dim + d] as number);
      }
    }
    for (let c = 0; c < k; c++) {
      const cnt = counts[c] as number;
      if (cnt === 0) {
        // dead cluster — keep the previous centroid
        next.set(centroids.subarray(c * dim, (c + 1) * dim), c * dim);
        continue;
      }
      const off = c * dim;
      const inv = 1 / cnt;
      for (let d = 0; d < dim; d++) next[off + d] = (next[off + d] as number) * inv;
    }
    centroids = next;
  }

  // medoid pass — the input row index closest to each centroid
  const medoids: number[] = new Array(k).fill(-1);
  const medoidDist = new Float64Array(k).fill(Number.POSITIVE_INFINITY);
  for (let i = 0; i < n; i++) {
    const c = assignments[i] as number;
    const row = rows.subarray(i * dim, (i + 1) * dim);
    const cen = centroids.subarray(c * dim, (c + 1) * dim);
    const d = l2sq(row, cen);
    if (d < (medoidDist[c] as number)) {
      medoidDist[c] = d;
      medoids[c] = i;
    }
  }

  return { assignments, centroids, medoids, iters };
}

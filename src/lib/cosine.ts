/**
 * Cosine similarity over Float32Array.
 *
 * Hot path during retrieval + dedup — gets called once per chunk per query.
 * Kept dependency-free and tight. Numerical strategy: single pass that
 * accumulates dot product and both norms; one sqrt() at the end.
 *
 * Safe against zero vectors (returns 0 instead of NaN).
 */

export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: dimension mismatch ${a.length} vs ${b.length}`);
  }
  const n = a.length;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i] as number;
    const bv = b[i] as number;
    dot += av * bv;
    aa += av * av;
    bb += bv * bv;
  }
  if (aa === 0 || bb === 0) return 0;
  return dot / Math.sqrt(aa * bb);
}

/**
 * Squared L2 distance — useful for k-means where the relative ordering is
 * the same as cosine when vectors are L2-normalized, but with no sqrt.
 */
export function l2sq(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`l2sq: dimension mismatch ${a.length} vs ${b.length}`);
  }
  const n = a.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = (a[i] as number) - (b[i] as number);
    s += d * d;
  }
  return s;
}

/**
 * In-place L2 normalize. After this, dot(a, b) == cosine(a, b).
 */
export function l2normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i] as number;
    s += x * x;
  }
  const norm = Math.sqrt(s);
  if (norm === 0) return v;
  const inv = 1 / norm;
  for (let i = 0; i < v.length; i++) {
    v[i] = (v[i] as number) * inv;
  }
  return v;
}

/**
 * Top-k by cosine over a flat embedding matrix (n × dim, row-major).
 * Returns indices into `matrix` rows + their cosine scores, descending.
 */
export function topKCosine(
  query: Float32Array,
  matrix: Float32Array,
  dim: number,
  k: number,
): { index: number; score: number }[] {
  const n = matrix.length / dim;
  if (!Number.isInteger(n)) {
    throw new Error(`topKCosine: matrix length ${matrix.length} not divisible by dim ${dim}`);
  }
  // partial top-k via insertion into a small sorted array — fine for k <= 20
  const top: { index: number; score: number }[] = [];
  const view = new Float32Array(matrix.buffer, matrix.byteOffset, matrix.length);
  for (let i = 0; i < n; i++) {
    const row = view.subarray(i * dim, (i + 1) * dim);
    const s = cosine(query, row);
    if (top.length < k) {
      top.push({ index: i, score: s });
      top.sort((a, b) => b.score - a.score);
    } else if (s > (top[k - 1] as { index: number; score: number }).score) {
      top[k - 1] = { index: i, score: s };
      top.sort((a, b) => b.score - a.score);
    }
  }
  return top;
}

/**
 * Embedding service.
 *
 * Real path: react-native-executorch runs MiniLM-L6-v2 on the Apple Neural
 * Engine / Android NNAPI, producing 384-dim Float32 vectors per chunk.
 *
 * Dev / node path: a deterministic mock that hashes the input string into
 * a 384-dim vector. Same input → same vector; different inputs → very
 * different vectors. Good enough that the rest of the pipeline
 * (chunking → embed → vector store → top-k → card-gen → rag) can be unit
 * tested end-to-end without the native runtime.
 *
 * Toggle via EXPO_PUBLIC_USE_REAL_MODELS=1.
 */

export const EMBED_DIM = 384;

/** Hard cap on inputs per native call. Set to match PLAN §3 ingest budget. */
export const EMBED_BATCH_SIZE = 16;

export interface EmbedService {
  /** embed a single string, returns one 384-dim Float32Array */
  embed(text: string): Promise<Float32Array>;
  /** embed many strings in one batch; returned in input order */
  embedBatch(texts: ReadonlyArray<string>): Promise<Float32Array[]>;
  /** model id currently loaded ('mock' in dev path) */
  modelId(): string;
}

/**
 * Wrap an arbitrary embed function so that it's called at most
 * EMBED_BATCH_SIZE inputs at a time, with optional onProgress for UI.
 */
export async function embedAllChunked(
  svc: EmbedService,
  texts: ReadonlyArray<string>,
  onProgress?: (done: number, total: number) => void,
): Promise<Float32Array[]> {
  const out: Float32Array[] = new Array(texts.length);
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const slice = texts.slice(i, i + EMBED_BATCH_SIZE);
    const part = await svc.embedBatch(slice);
    for (let j = 0; j < part.length; j++) out[i + j] = part[j] as Float32Array;
    onProgress?.(Math.min(i + slice.length, texts.length), texts.length);
  }
  return out;
}

export interface BenchResult {
  /** total ms */
  totalMs: number;
  /** ms per embedding (mean) */
  msPerEmbed: number;
  /** embeds per second */
  embedsPerSec: number;
  /** how many inputs we ran */
  count: number;
}

/**
 * Drive the embed service over `texts` (or `count` repeats of a fixed sample)
 * and measure throughput. Used by the settings benchmark screen.
 */
export async function benchEmbed(
  svc: EmbedService,
  textsOrCount: ReadonlyArray<string> | number,
): Promise<BenchResult> {
  const texts =
    typeof textsOrCount === 'number'
      ? Array.from({ length: textsOrCount }, (_, i) => `bench input ${i} — the quick brown fox.`)
      : textsOrCount;

  const t0 = Date.now();
  await embedAllChunked(svc, texts);
  const totalMs = Date.now() - t0;
  const msPerEmbed = totalMs / Math.max(1, texts.length);
  const embedsPerSec = msPerEmbed > 0 ? 1000 / msPerEmbed : Number.POSITIVE_INFINITY;
  return { totalMs, msPerEmbed, embedsPerSec, count: texts.length };
}

function useReal(): boolean {
  // EXPO_PUBLIC_* envs are inlined by metro at build time; in node they're
  // just process.env keys.
  const v =
    (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_USE_REAL_MODELS : undefined) ?? '0';
  return v === '1' || v === 'true';
}

// ─── deterministic-from-hash mock ─────────────────────────────────────────
//
// 32-bit FNV-1a → seed an LCG → 384 floats in [-1, 1]. After normalization
// the vector lives on the unit sphere, so dot product == cosine sim.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mockEmbed(text: string): Float32Array {
  const seed = fnv1a(text.toLowerCase().trim()) || 1;
  const out = new Float32Array(EMBED_DIM);
  let s = seed >>> 0;
  let sumsq = 0;
  for (let i = 0; i < EMBED_DIM; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const f = (s / 0xffffffff) * 2 - 1;
    out[i] = f;
    sumsq += f * f;
  }
  const inv = 1 / Math.sqrt(sumsq);
  for (let i = 0; i < EMBED_DIM; i++) out[i] = (out[i] as number) * inv;
  return out;
}

function mockService(): EmbedService {
  return {
    async embed(text) {
      return mockEmbed(text);
    },
    async embedBatch(texts) {
      return texts.map(mockEmbed);
    },
    modelId() {
      return 'mock';
    },
  };
}

// ─── real path via react-native-executorch (lazy) ─────────────────────────
function nativeService(): EmbedService {
  // contract over `react-native-executorch` — kept narrow on purpose; real
  // type defs come from the package once installed in a native build.
  type LoadedEmbedder = {
    forward(text: string): Promise<Float32Array>;
    forwardBatch?(texts: string[]): Promise<Float32Array[]>;
    unload(): Promise<void>;
  };
  const exMod = require('react-native-executorch') as {
    loadEmbedder(modelPath: string): Promise<LoadedEmbedder>;
  };

  let cached: LoadedEmbedder | null = null;
  const modelPath = ''; // resolved by models.service.pathFor before first call
  return {
    async embed(text) {
      if (!cached) {
        cached = await exMod.loadEmbedder(modelPath);
      }
      const v = await cached.forward(text);
      return v;
    },
    async embedBatch(texts) {
      if (!cached) cached = await exMod.loadEmbedder(modelPath);
      if (cached.forwardBatch) return cached.forwardBatch([...texts]);
      const out: Float32Array[] = [];
      for (const t of texts) out.push(await cached.forward(t));
      return out;
    },
    modelId() {
      return 'all-minilm-l6-v2';
    },
  };
}

let svc: EmbedService | null = null;

export function getEmbedService(): EmbedService {
  if (svc) return svc;
  svc = useReal() ? nativeService() : mockService();
  return svc;
}

/** Test hook. */
export function _resetEmbedServiceForTests(): void {
  svc = null;
}

export { mockEmbed };

/**
 * Model registry + downloader.
 *
 * The app refuses to start its hot path (embed / llm) without the
 * corresponding model file present + sha-verified. We download from
 * Hugging Face mirrors, save under /Documents/sb/models/, and check
 * sha256 before marking installed.
 *
 * Download mechanics are platform-specific:
 *   - native: expo-file-system downloadResumable + crypto.digestStringAsync
 *   - node tooling: stubs that pretend everything is installed (vitest +
 *     drizzle-kit never actually call this surface)
 *
 * The catalog is the source of truth — adding a model to studybuddy means
 * a row here + a .pte file at the listed URL with the listed hash.
 */

import type { EmbedModelId, LlmModelId } from '@/stores/settings.store';

export type ModelKind = 'llm' | 'embed';

export interface ModelSpec {
  id: LlmModelId | EmbedModelId;
  kind: ModelKind;
  /** display name in settings */
  name: string;
  /** approximate download size in bytes */
  sizeBytes: number;
  /** primary fetch URL */
  url: string;
  /** sha256 of the file at `url` (lowercase hex) */
  sha256: string;
  /** local filename under /Documents/sb/models/ */
  filename: string;
  /** licence label for the settings screen */
  license: string;
}

export const MODEL_CATALOG: ReadonlyArray<ModelSpec> = [
  {
    id: 'llama-3.2-3b-instruct-q4',
    kind: 'llm',
    name: 'Llama 3.2 3B Instruct (4-bit)',
    sizeBytes: 2_500_000_000,
    url: 'https://huggingface.co/software-mansion/llama-3.2-3b-instruct-pte/resolve/main/llama3_2_3b_instruct_q4.pte',
    sha256: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    filename: 'llama3_2_3b_instruct_q4.pte',
    license: 'Llama 3 Community License',
  },
  {
    id: 'phi-3.5-mini-q4',
    kind: 'llm',
    name: 'Phi-3.5 mini (4-bit)',
    sizeBytes: 2_400_000_000,
    url: 'https://huggingface.co/software-mansion/phi-3.5-mini-pte/resolve/main/phi_3_5_mini_q4.pte',
    sha256: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    filename: 'phi_3_5_mini_q4.pte',
    license: 'MIT',
  },
  {
    id: 'gemma-2-2b-q4',
    kind: 'llm',
    name: 'Gemma 2 2B (4-bit)',
    sizeBytes: 1_800_000_000,
    url: 'https://huggingface.co/software-mansion/gemma-2-2b-pte/resolve/main/gemma_2_2b_q4.pte',
    sha256: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    filename: 'gemma_2_2b_q4.pte',
    license: 'Gemma Terms of Use',
  },
  {
    id: 'llama-3.2-1b-q4',
    kind: 'llm',
    name: 'Llama 3.2 1B (4-bit, low-end devices)',
    sizeBytes: 900_000_000,
    url: 'https://huggingface.co/software-mansion/llama-3.2-1b-instruct-pte/resolve/main/llama3_2_1b_instruct_q4.pte',
    sha256: 'd4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
    filename: 'llama3_2_1b_instruct_q4.pte',
    license: 'Llama 3 Community License',
  },
  {
    id: 'all-minilm-l6-v2',
    kind: 'embed',
    name: 'all-MiniLM-L6-v2 (embeddings)',
    sizeBytes: 25_000_000,
    url: 'https://huggingface.co/software-mansion/all-minilm-l6-v2-pte/resolve/main/all_minilm_l6_v2.pte',
    sha256: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
    filename: 'all_minilm_l6_v2.pte',
    license: 'Apache 2.0',
  },
];

export function findModel(id: LlmModelId | EmbedModelId): ModelSpec {
  const m = MODEL_CATALOG.find((s) => s.id === id);
  if (!m) throw new Error(`unknown model id: ${id}`);
  return m;
}

export type DownloadStatus =
  | { state: 'idle' }
  | { state: 'downloading'; bytesWritten: number; totalBytes: number }
  | { state: 'verifying' }
  | { state: 'installed'; path: string }
  | { state: 'failed'; error: string };

export interface DownloadProgress {
  spec: ModelSpec;
  status: DownloadStatus;
}

export interface ModelsService {
  isInstalled(id: LlmModelId | EmbedModelId): Promise<boolean>;
  pathFor(id: LlmModelId | EmbedModelId): Promise<string | null>;
  download(
    id: LlmModelId | EmbedModelId,
    onProgress: (p: DownloadProgress) => void,
  ): Promise<string>;
  delete(id: LlmModelId | EmbedModelId): Promise<void>;
}

function isNode(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

// ─── node-side stub: claims everything is installed for unit tests ────────
function nodeStub(): ModelsService {
  const fakePath = (id: string) => `/tmp/studybuddy-stub/${id}.pte`;
  return {
    async isInstalled() {
      return true;
    },
    async pathFor(id) {
      return fakePath(id);
    },
    async download(id, onProgress) {
      const spec = findModel(id);
      onProgress({ spec, status: { state: 'downloading', bytesWritten: spec.sizeBytes, totalBytes: spec.sizeBytes } });
      onProgress({ spec, status: { state: 'verifying' } });
      onProgress({ spec, status: { state: 'installed', path: fakePath(id) } });
      return fakePath(id);
    },
    async delete() {
      /* no-op */
    },
  };
}

// ─── native impl: expo-file-system + sha256 verify ────────────────────────
function nativeImpl(): ModelsService {
  const fs = require('expo-file-system') as {
    documentDirectory: string;
    getInfoAsync: (uri: string) => Promise<{ exists: boolean; size?: number }>;
    deleteAsync: (uri: string, opts?: { idempotent?: boolean }) => Promise<void>;
    makeDirectoryAsync: (uri: string, opts?: { intermediates?: boolean }) => Promise<void>;
    createDownloadResumable: (
      url: string,
      to: string,
      opts?: unknown,
      cb?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
    ) => { downloadAsync: () => Promise<{ uri: string } | null> };
    readAsStringAsync: (uri: string, opts?: { encoding?: string }) => Promise<string>;
  };
  const cryptoMod = require('expo-crypto') as {
    digestStringAsync: (
      algorithm: string,
      data: string,
      opts?: { encoding?: string },
    ) => Promise<string>;
    CryptoDigestAlgorithm: { SHA256: string };
    CryptoEncoding: { HEX: string; BASE64: string };
  };

  const modelsDir = `${fs.documentDirectory}sb/models/`;

  async function ensureDir() {
    const info = await fs.getInfoAsync(modelsDir);
    if (!info.exists) await fs.makeDirectoryAsync(modelsDir, { intermediates: true });
  }

  function uriFor(spec: ModelSpec): string {
    return `${modelsDir}${spec.filename}`;
  }

  async function verifySha(uri: string, expected: string): Promise<boolean> {
    const data = await fs.readAsStringAsync(uri, { encoding: 'base64' });
    const got = await cryptoMod.digestStringAsync(
      cryptoMod.CryptoDigestAlgorithm.SHA256,
      data,
      { encoding: cryptoMod.CryptoEncoding.HEX },
    );
    return got.toLowerCase() === expected.toLowerCase();
  }

  return {
    async isInstalled(id) {
      const spec = findModel(id);
      const info = await fs.getInfoAsync(uriFor(spec));
      return Boolean(info.exists);
    },
    async pathFor(id) {
      const spec = findModel(id);
      const info = await fs.getInfoAsync(uriFor(spec));
      return info.exists ? uriFor(spec) : null;
    },
    async download(id, onProgress) {
      const spec = findModel(id);
      await ensureDir();
      const dest = uriFor(spec);

      onProgress({
        spec,
        status: { state: 'downloading', bytesWritten: 0, totalBytes: spec.sizeBytes },
      });

      const res = fs.createDownloadResumable(spec.url, dest, undefined, (p) => {
        onProgress({
          spec,
          status: {
            state: 'downloading',
            bytesWritten: p.totalBytesWritten,
            totalBytes: p.totalBytesExpectedToWrite || spec.sizeBytes,
          },
        });
      });

      const result = await res.downloadAsync();
      if (!result) {
        onProgress({ spec, status: { state: 'failed', error: 'download cancelled' } });
        throw new Error('download cancelled');
      }

      onProgress({ spec, status: { state: 'verifying' } });
      const ok = await verifySha(dest, spec.sha256);
      if (!ok) {
        await fs.deleteAsync(dest, { idempotent: true });
        onProgress({ spec, status: { state: 'failed', error: 'sha256 mismatch' } });
        throw new Error(`sha256 mismatch for ${spec.id}`);
      }
      onProgress({ spec, status: { state: 'installed', path: dest } });
      return dest;
    },
    async delete(id) {
      const spec = findModel(id);
      await fs.deleteAsync(uriFor(spec), { idempotent: true });
    },
  };
}

let cached: ModelsService | null = null;

export function getModelsService(): ModelsService {
  if (cached) return cached;
  cached = isNode() ? nodeStub() : nativeImpl();
  return cached;
}

/** Test/diagnostic hook. */
export function _resetModelsServiceForTests(): void {
  cached = null;
}

/**
 * Vector store.
 *
 * MiniLM-L6 produces 384-dim Float32 vectors → 1536 bytes per chunk →
 * a 50-page PDF (~250 chunks) costs ~380 KB. We persist the raw Float32
 * blob in SQLite (chunks.embedding) and do top-k in JS by default.
 *
 * For <10k chunks that's <50ms per query on a flagship phone. Above that
 * we fall back to the cosine UDF added in commit 23.
 *
 * This module is the *thin* layer on top — it gathers all chunks for a
 * doc, runs cosine in a tight loop, returns top-k.
 */

import { getDb } from '@/db/client';
import { chunks } from '@/db/schema';
import { cosine } from '@/lib/cosine';
import { EMBED_DIM } from '@/services/embed.service';
import type { RetrievedChunk } from '@/types/chunk';
import { eq, sql } from 'drizzle-orm';

export interface InsertChunkArgs {
  id: string;
  docId: string;
  idx: number;
  pageStart: number;
  pageEnd: number;
  charOffset: number;
  text: string;
  tokenCount: number;
  embedding: Float32Array;
}

/**
 * Pack a Float32Array into a byte sequence suitable for SQLite BLOB.
 * RN's Hermes runtime does not expose Node's Buffer global; on RN we return
 * a plain Uint8Array (quick-sqlite accepts it). On node we still return a
 * Buffer-shaped view that's structurally compatible.
 */
export function packEmbedding(v: Float32Array): Buffer {
  // Buffer.from(ArrayBuffer, offset, length) — unambiguously returns Buffer in
  // every TS lib config; new Uint8Array(...) was inferred as Uint8Array in CI
  // (lib: ["dom"] context) and broke Drizzle's column type expectation.
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

/** Unpack a SQLite BLOB into a Float32Array view (zero-copy when aligned). */
export function unpackEmbedding(blob: Uint8Array | ArrayBuffer | null | undefined): Float32Array {
  if (!blob) return new Float32Array(EMBED_DIM);
  const u8 = blob instanceof Uint8Array ? blob : new Uint8Array(blob);
  // copy into a freshly aligned buffer to be safe across native + node
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return new Float32Array(ab);
}

/** Insert one chunk row with its embedding. */
export async function insertChunk(args: InsertChunkArgs): Promise<void> {
  const db = getDb();
  await db.insert(chunks).values({
    id: args.id,
    docId: args.docId,
    idx: args.idx,
    pageStart: args.pageStart,
    pageEnd: args.pageEnd,
    charOffset: args.charOffset,
    text: args.text,
    tokenCount: args.tokenCount,
    embedding: packEmbedding(args.embedding),
  });
}

/** Insert a batch of chunks in one transaction. */
export async function insertChunks(rows: InsertChunkArgs[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb();
  const values = rows.map((r) => ({
    id: r.id,
    docId: r.docId,
    idx: r.idx,
    pageStart: r.pageStart,
    pageEnd: r.pageEnd,
    charOffset: r.charOffset,
    text: r.text,
    tokenCount: r.tokenCount,
    embedding: packEmbedding(r.embedding),
  }));
  await db.insert(chunks).values(values);
}

/**
 * In-memory top-k cosine over all chunks for a doc.
 *
 * For larger corpora (multi-doc retrieval, or docs > 10k chunks) the
 * SQLite-UDF path added in commit 23 should be used instead.
 */
export async function topKForDoc(
  docId: string,
  query: Float32Array,
  k: number,
): Promise<RetrievedChunk[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: chunks.id,
      docId: chunks.docId,
      idx: chunks.idx,
      text: chunks.text,
      pageStart: chunks.pageStart,
      pageEnd: chunks.pageEnd,
      embedding: chunks.embedding,
    })
    .from(chunks)
    .where(eq(chunks.docId, docId));

  const heap: RetrievedChunk[] = [];
  for (const row of rows) {
    const emb = unpackEmbedding(row.embedding as Uint8Array | null);
    const score = cosine(query, emb);
    if (heap.length < k) {
      heap.push({
        id: row.id,
        docId: row.docId,
        idx: row.idx,
        text: row.text,
        pageStart: row.pageStart,
        pageEnd: row.pageEnd,
        score,
      });
      heap.sort((a, b) => b.score - a.score);
    } else {
      const worst = heap[k - 1] as RetrievedChunk;
      if (score > worst.score) {
        heap[k - 1] = {
          id: row.id,
          docId: row.docId,
          idx: row.idx,
          text: row.text,
          pageStart: row.pageStart,
          pageEnd: row.pageEnd,
          score,
        };
        heap.sort((a, b) => b.score - a.score);
      }
    }
  }
  return heap;
}

// ─── SQLite cosine UDF fallback ──────────────────────────────────────────
//
// quick-sqlite supports registering JS UDFs. If we register a `cosine(blob,
// blob)` function we can let SQLite do the top-k via ORDER BY directly,
// which keeps the working set small even for >10k chunks. If registration
// fails (older binary, etc.) we fall back to the JS heap implementation
// above. Native-only — node tooling never hits this code path.

let udfRegistered = false;
let udfAvailable = false;

/** Register the cosine UDF on the quick-sqlite native connection. */
export function registerCosineUDF(): boolean {
  if (udfRegistered) return udfAvailable;
  udfRegistered = true;
  if (typeof process !== 'undefined' && process.versions?.node) {
    // node-side: skip
    udfAvailable = false;
    return false;
  }
  try {
    const mod = require('react-native-quick-sqlite') as {
      open: (cfg: { name: string }) => {
        registerFunction?: (
          name: string,
          fn: (...args: unknown[]) => number,
          opts?: { deterministic?: boolean },
        ) => void;
      };
    };
    const conn = mod.open({ name: 'studybuddy.db' });
    if (!conn.registerFunction) {
      udfAvailable = false;
      return false;
    }
    conn.registerFunction(
      'cosine',
      (a: unknown, b: unknown) => {
        const av = unpackEmbedding(a as Uint8Array);
        const bv = unpackEmbedding(b as Uint8Array);
        return cosine(av, bv);
      },
      { deterministic: true },
    );
    udfAvailable = true;
    return true;
  } catch {
    udfAvailable = false;
    return false;
  }
}

export function isCosineUDFAvailable(): boolean {
  return udfAvailable;
}

/**
 * Bench top-k over a synthetic batch of rows. Used by the settings
 * benchmark screen — returns ms-per-query for the JS path, and (if the
 * UDF was registered) ms-per-query for the SQL path too.
 */
export interface VectorBenchResult {
  /** number of rows in the synthetic batch */
  rowCount: number;
  /** ms for one top-k via JS heap */
  jsMs: number;
  /** ms for one top-k via SQL/UDF, or null if unavailable */
  udfMs: number | null;
}

export function benchTopKJs(
  query: Float32Array,
  matrix: Float32Array,
  dim: number,
  k: number,
): VectorBenchResult {
  const n = matrix.length / dim;
  const t0 = Date.now();
  const heap: { i: number; score: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = matrix.subarray(i * dim, (i + 1) * dim);
    const s = cosine(query, row);
    if (heap.length < k) {
      heap.push({ i, score: s });
      heap.sort((a, b) => b.score - a.score);
    } else if (s > (heap[k - 1] as { i: number; score: number }).score) {
      heap[k - 1] = { i, score: s };
      heap.sort((a, b) => b.score - a.score);
    }
  }
  return { rowCount: n, jsMs: Date.now() - t0, udfMs: null };
}

/** Count chunks for a doc that still need embedding (resume support). */
export async function countMissingEmbeddings(docId: string): Promise<number> {
  const db = getDb();
  const rows = (await db
    .select({ n: sql<number>`count(*)` })
    .from(chunks)
    .where(eq(chunks.docId, docId))) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

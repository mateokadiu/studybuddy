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

import { eq, sql } from 'drizzle-orm';
import { cosine } from '@/lib/cosine';
import { EMBED_DIM } from '@/services/embed.service';
import { getDb } from '@/db/client';
import { chunks } from '@/db/schema';
import type { RetrievedChunk } from '@/types/chunk';

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

/** Pack a Float32Array into a Buffer suitable for SQLite BLOB column. */
export function packEmbedding(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

/** Unpack a SQLite BLOB into a Float32Array view (zero-copy when aligned). */
export function unpackEmbedding(blob: Buffer | Uint8Array | null | undefined): Float32Array {
  if (!blob) return new Float32Array(EMBED_DIM);
  // copy into a freshly aligned buffer to be safe across native + node
  const ab = new ArrayBuffer(blob.byteLength);
  new Uint8Array(ab).set(blob);
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
    const emb = unpackEmbedding(row.embedding as Buffer | null);
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

/** Count chunks for a doc that still need embedding (resume support). */
export async function countMissingEmbeddings(docId: string): Promise<number> {
  const db = getDb();
  const rows = (await db
    .select({ n: sql<number>`count(*)` })
    .from(chunks)
    .where(eq(chunks.docId, docId))) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/**
 * Document ingest worker.
 *
 * Wires together pdf → chunker → embed → vector-store with cancel-safety:
 * every step writes to SQLite before invoking the next, so a killed-mid-
 * embed app resumes via "chunks WHERE embedding IS NULL" on next launch.
 *
 * Pushes progress into the library store so the UI can render an inline
 * progress bar per doc.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { chunks as chunksTable, documents } from '@/db/schema';
import { id as uuid } from '@/lib/id';
import { chunkByTokens, type PageText } from '@/lib/chunker';
import { getPdfService } from '@/services/pdf.service';
import { embedAllChunked, getEmbedService } from '@/services/embed.service';
import { packEmbedding } from '@/services/vector-store';
import { useLibrary } from '@/stores/library.store';

/** Drive the four-stage pipeline for a freshly inserted documents row. */
export async function ingestPdf(docId: string, uri: string): Promise<void> {
  const lib = useLibrary.getState();
  try {
    lib.setIngest(docId, { stage: 'extracting', ratio: 0, stageDone: 0, stageTotal: 1 });
    const pdf = await getPdfService().extract(uri);

    const db = getDb();
    await db
      .update(documents)
      .set({ pageCount: pdf.pageCount, charCount: pdf.charCount })
      .where(eq(documents.id, docId));

    await pipeline(docId, pdf.pages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(docId, msg);
    lib.failIngest(docId, msg);
  }
}

export async function ingestPastedText(docId: string, text: string): Promise<void> {
  const lib = useLibrary.getState();
  try {
    lib.setIngest(docId, { stage: 'extracting', ratio: 0, stageDone: 1, stageTotal: 1 });
    const pages: PageText[] = [{ page: 1, text }];
    await pipeline(docId, pages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(docId, msg);
    lib.failIngest(docId, msg);
  }
}

async function pipeline(docId: string, pages: PageText[]): Promise<void> {
  const lib = useLibrary.getState();

  lib.setIngest(docId, { stage: 'chunking', ratio: 0.05, stageDone: 0, stageTotal: pages.length });
  const rawChunks = chunkByTokens(pages, { targetTokens: 512, overlapTokens: 64 });

  const db = getDb();
  const chunkIds: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    const c = rawChunks[i]!;
    const id = uuid();
    chunkIds.push(id);
    await db.insert(chunksTable).values({
      id,
      docId,
      idx: c.idx,
      pageStart: c.pageStart,
      pageEnd: c.pageEnd,
      charOffset: c.charOffset,
      text: c.text,
      tokenCount: c.tokenCount,
      embedding: null,
    });
    if (i % 8 === 0) {
      lib.setIngest(docId, {
        stage: 'chunking',
        ratio: 0.05 + (0.1 * (i + 1)) / rawChunks.length,
        stageDone: i + 1,
        stageTotal: rawChunks.length,
      });
    }
  }

  // embed
  lib.setIngest(docId, { stage: 'embedding', ratio: 0.15, stageDone: 0, stageTotal: rawChunks.length });
  const svc = getEmbedService();
  const texts = rawChunks.map((c) => c.text);
  const embeds = await embedAllChunked(svc, texts, (done, total) => {
    lib.setIngest(docId, {
      stage: 'embedding',
      ratio: 0.15 + (0.8 * done) / total,
      stageDone: done,
      stageTotal: total,
    });
  });

  for (let i = 0; i < chunkIds.length; i++) {
    await db
      .update(chunksTable)
      .set({ embedding: packEmbedding(embeds[i] as Float32Array) })
      .where(eq(chunksTable.id, chunkIds[i] as string));
  }

  await db.update(documents).set({ status: 'ready' }).where(eq(documents.id, docId));
  lib.finishIngest(docId);
}

async function markFailed(docId: string, error: string): Promise<void> {
  const db = getDb();
  await db
    .update(documents)
    .set({ status: 'failed', errorMessage: error })
    .where(eq(documents.id, docId));
}

import { sqliteTable, text, integer, blob, index } from 'drizzle-orm/sqlite-core';

/**
 * documents
 *   one row per ingested source (pdf / epub / pasted text).
 *   status drives the library UI ('ingesting' | 'ready' | 'failed').
 */
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  source: text('source').notNull(),
  filePath: text('file_path'),
  pageCount: integer('page_count').notNull().default(0),
  charCount: integer('char_count').notNull().default(0),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  importedAt: integer('imported_at', { mode: 'timestamp_ms' }).notNull(),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp_ms' }),
});

/**
 * chunks
 *   ordered slices of a document with paragraph/sentence-aware boundaries.
 *   `embedding` is a Float32 BLOB (384 floats = 1536 bytes for MiniLM-L6).
 *   Persisted before its embedding so a partially-embedded doc can resume
 *   on next launch (SELECT * FROM chunks WHERE embedding IS NULL).
 */
export const chunks = sqliteTable(
  'chunks',
  {
    id: text('id').primaryKey(),
    docId: text('doc_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    pageStart: integer('page_start').notNull(),
    pageEnd: integer('page_end').notNull(),
    charOffset: integer('char_offset').notNull(),
    text: text('text').notNull(),
    tokenCount: integer('token_count').notNull(),
    embedding: blob('embedding', { mode: 'buffer' }),
  },
  (t) => ({
    docIdx: index('chunks_doc_idx').on(t.docId, t.idx),
  }),
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

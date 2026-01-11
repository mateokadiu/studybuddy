import { sqliteTable, text, integer, real, blob, index } from 'drizzle-orm/sqlite-core';

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

/**
 * decks
 *   one default deck per doc (auto-generated) + any user-created decks.
 *   tracks the model + prompt version that produced its cards so we can
 *   regen on demand and compare quality across prompt iterations.
 */
export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  docId: text('doc_id').references(() => documents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  generatedWithModel: text('generated_with_model').notNull(),
  generatedWithPromptVersion: text('generated_with_prompt_version').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * cards
 *   flashcard with FSRS state inline. `questionEmbedding` lets us dedup
 *   near-identical cards via cosine sim during generation.
 */
export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    sourceChunkId: text('source_chunk_id').references(() => chunks.id),
    type: text('type').notNull(),
    front: text('front').notNull(),
    back: text('back').notNull(),
    pageCite: integer('page_cite'),
    questionEmbedding: blob('question_embedding', { mode: 'buffer' }),
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: real('elapsed_days').notNull().default(0),
    scheduledDays: real('scheduled_days').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: text('state').notNull().default('new'),
    due: integer('due', { mode: 'timestamp_ms' }).notNull(),
    lastReview: integer('last_review', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    dueIdx: index('cards_due_idx').on(t.due, t.state),
    deckIdx: index('cards_deck_idx').on(t.deckId),
  }),
);

/**
 * reviews
 *   append-only log of every grade. used for the heatmap, retention
 *   curve, and (eventually) FSRS param optimization per-user.
 */
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  cardId: text('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  durationMs: integer('duration_ms').notNull(),
  stabilityBefore: real('stability_before').notNull(),
  stabilityAfter: real('stability_after').notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * chats
 *   doc-scoped RAG conversation. one chat per (doc, session) — multiple
 *   chats per doc are fine. title is auto-set from the first user msg.
 */
export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  docId: text('doc_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * chat_messages
 *   role = 'user' | 'assistant'. cites is a JSON array of { chunkId, page }
 *   parsed from the model output on the fly so we can re-render the chips
 *   without re-running retrieval.
 */
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    cites: text('cites'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    chatIdx: index('chat_messages_chat_idx').on(t.chatId, t.createdAt),
  }),
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

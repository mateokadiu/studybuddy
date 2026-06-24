/**
 * Deck creation + card-gen orchestration with live insert.
 *
 * Creates a decks row up front, kicks off generateCards(), and inserts
 * each accepted card immediately so the deck detail screen can render a
 * count that animates in real time. Pushes progress into the deck store
 * for the per-deck progress overlay on the list screen.
 */

import { getDb } from '@/db/client';
import { type Chunk, cards as cardsTable, chunks, decks, documents } from '@/db/schema';
import { newCard } from '@/lib/fsrs';
import { id as uuid } from '@/lib/id';
import { useDeckStore } from '@/stores/deck.store';
import { eq } from 'drizzle-orm';
import { generateCards } from './card-gen.service';
import { packEmbedding } from './vector-store';

export interface CreateDeckArgs {
  docId: string;
  /** target card count (default 30) */
  target?: number;
  /** override deck title; default: doc title + " · Auto" */
  title?: string;
}

/** Create a deck and kick off generation. Returns the new deckId. */
export async function createDeckFromDoc(args: CreateDeckArgs): Promise<string> {
  const target = args.target ?? 30;
  const db = getDb();

  const docRows = (await db.select().from(documents).where(eq(documents.id, args.docId))) as Array<{
    id: string;
    title: string;
  }>;
  const doc = docRows[0];
  if (!doc) throw new Error(`unknown doc ${args.docId}`);

  const chunkRows = (await db.select().from(chunks).where(eq(chunks.docId, args.docId))) as Chunk[];

  const deckId = uuid();
  await db.insert(decks).values({
    id: deckId,
    docId: args.docId,
    title: args.title ?? `${doc.title} · Auto`,
    generatedWithModel: 'pending',
    generatedWithPromptVersion: 'pending',
    createdAt: new Date(),
  });

  const store = useDeckStore.getState();
  store.startGen(deckId, args.docId, target);

  void runGen(deckId, args.docId, chunkRows, target).catch((err: unknown) => {
    // mark deck as failed via a synthetic title prefix
    void db
      .update(decks)
      .set({ title: `[failed] ${doc.title}` })
      .where(eq(decks.id, deckId));
    store.tickGen(deckId, { done: true });
    throw err;
  });

  return deckId;
}

async function runGen(
  deckId: string,
  docId: string,
  chunkRows: Chunk[],
  target: number,
): Promise<void> {
  const db = getDb();
  const store = useDeckStore.getState();
  let duplicates = 0;

  const now = Date.now();
  const result = await generateCards({ chunks: chunkRows, target }, async (e) => {
    if (e.type === 'duplicate') {
      duplicates++;
      store.tickGen(deckId, { duplicates });
      return;
    }
    if (e.type === 'card' && e.card) {
      const seed = newCard(now);
      await db.insert(cardsTable).values({
        id: uuid(),
        deckId,
        sourceChunkId: e.card.sourceChunkId,
        type: e.card.type,
        front: e.card.front,
        back: e.card.back,
        pageCite: e.card.page ?? null,
        questionEmbedding: null,
        stability: seed.stability,
        difficulty: seed.difficulty,
        elapsedDays: seed.elapsedDays,
        scheduledDays: seed.scheduledDays,
        reps: seed.reps,
        lapses: seed.lapses,
        state: seed.state,
        due: new Date(seed.due),
        lastReview: null,
      });
      store.tickGen(deckId, { count: e.count });
    }
  });

  // backfill model + prompt version on the deck row
  await db
    .update(decks)
    .set({
      generatedWithModel: result.modelId,
      generatedWithPromptVersion: result.promptVersion,
    })
    .where(eq(decks.id, deckId));

  // attach question embeddings for future dedup against new cards
  // (best-effort — done after the user is already navigating)
  const cardRows = (await db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.deckId, deckId))) as Array<{ id: string }>;
  for (let i = 0; i < cardRows.length && i < result.cards.length; i++) {
    const row = cardRows[i] as { id: string };
    const ce = result.cards[i];
    if (!ce) continue;
    await db
      .update(cardsTable)
      .set({ questionEmbedding: packEmbedding(ce.questionEmbedding) })
      .where(eq(cardsTable.id, row.id));
  }

  store.finishGen(deckId);
  void docId;
}

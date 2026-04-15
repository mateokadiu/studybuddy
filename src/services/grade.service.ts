/**
 * Apply one grade to a card.
 *
 * Reads the current FSRS state from the cards row, runs the algorithm,
 * persists the updated state, and inserts an append-only reviews row.
 *
 * Done in a single SQLite transaction so the (card, review) pair is
 * atomic — if the app crashes between the two, neither lands.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { cards, reviews, type Card } from '@/db/schema';
import { schedule, type FsrsCard, type FsrsRating, type FsrsState } from '@/lib/fsrs';
import { id as uuid } from '@/lib/id';

function dbCardToFsrs(c: Card): FsrsCard {
  return {
    stability: c.stability,
    difficulty: c.difficulty,
    elapsedDays: c.elapsedDays,
    scheduledDays: c.scheduledDays,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as FsrsState,
    due: c.due.getTime(),
    lastReview: c.lastReview ? c.lastReview.getTime() : null,
  };
}

export interface GradeResult {
  before: FsrsCard;
  after: FsrsCard;
}

export async function gradeCard(
  cardId: string,
  rating: FsrsRating,
  durationMs: number,
  now: number = Date.now(),
): Promise<GradeResult> {
  const db = getDb();
  const rows = (await db.select().from(cards).where(eq(cards.id, cardId))) as Card[];
  const row = rows[0];
  if (!row) throw new Error(`unknown card ${cardId}`);

  const before = dbCardToFsrs(row);
  const after = schedule(before, rating, now);

  await db
    .update(cards)
    .set({
      stability: after.stability,
      difficulty: after.difficulty,
      elapsedDays: after.elapsedDays,
      scheduledDays: after.scheduledDays,
      reps: after.reps,
      lapses: after.lapses,
      state: after.state,
      due: new Date(after.due),
      lastReview: new Date(now),
    })
    .where(eq(cards.id, cardId));

  await db.insert(reviews).values({
    id: uuid(),
    cardId,
    rating,
    durationMs,
    stabilityBefore: before.stability,
    stabilityAfter: after.stability,
    reviewedAt: new Date(now),
  });

  return { before, after };
}

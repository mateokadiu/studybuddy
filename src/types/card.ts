/**
 * Shared card types — used by card-gen service, RAG service, and the UI.
 * Zod schemas double as runtime parsers for streamed LLM output.
 */

import { z } from 'zod';

export const cardTypeSchema = z.enum(['cloze', 'recall', 'qa']);
export type CardType = z.infer<typeof cardTypeSchema>;

/** What the LLM emits, before we attach a deckId / sourceChunkId / FSRS state. */
export const generatedCardSchema = z.object({
  type: cardTypeSchema,
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1000),
  page: z.number().int().min(1).optional(),
});
export type GeneratedCard = z.infer<typeof generatedCardSchema>;

export const generatedCardsSchema = z.array(generatedCardSchema);
export type GeneratedCards = z.infer<typeof generatedCardsSchema>;

export const cardStateSchema = z.enum(['new', 'learning', 'review', 'relearning']);
export type CardStateName = z.infer<typeof cardStateSchema>;

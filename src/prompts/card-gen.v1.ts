/**
 * Card generation prompt — v1.
 *
 * Versioned because we track per-deck which prompt produced its cards
 * (decks.generated_with_prompt_version). Bumping this string means new
 * decks render slightly differently and old decks stay attributable to
 * the prompt they were authored with.
 *
 * Output contract: pure JSON array, no markdown, schema enforced by
 * generatedCardsSchema in @/types/card.
 */

export const CARD_GEN_PROMPT_VERSION = 'card-gen.v1';

export interface CardGenPromptArgs {
  /** target number of cards to emit */
  targetCount: number;
  /** first page the passage spans (1-indexed) */
  pageStart: number;
  /** last page the passage spans (1-indexed) */
  pageEnd: number;
  /** passage text — kept verbatim */
  passage: string;
}

const SYSTEM = `You write spaced-repetition flashcards for serious students.
Output JSON only, no markdown. Each card:
  { "type": "cloze" | "recall" | "qa",
    "front": "<question>",
    "back": "<answer>",
    "page": <int> }

Rules:
  - Cards must be answerable from the passage ONLY. No outside knowledge.
  - For cloze cards, replace the key term with {{c1::term}}. One cloze per card.
  - For recall cards, the front is a paraphrased question and the back is the
    exact phrase / fact from the passage (max 25 words).
  - For qa cards, both front and back are full sentences.
  - Mix all three types. ~40% cloze, ~40% recall, ~20% qa.
  - DO NOT generate trivia, dates-only, or "what is the main idea" style cards.
  - Each card stands alone — never reference "the passage" or "the author".
  - Return exactly N cards.`;

export function buildCardGenPrompt(args: CardGenPromptArgs): string {
  return `${SYSTEM}

N = ${args.targetCount}
Passage (pp. ${args.pageStart}-${args.pageEnd}):
"""
${args.passage}
"""`;
}

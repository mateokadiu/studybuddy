# Prompts

studybuddy uses **versioned** prompts. When a deck is generated, the
deck row records which prompt version produced its cards
(`decks.generated_with_prompt_version`); when a chat answer streams,
the prompt version it used is implicit in the model + prompt source. We
keep old prompt files in the repo so cards from older decks stay
attributable.

## Inventory

| version              | purpose                                | file                                |
|----------------------|----------------------------------------|-------------------------------------|
| `card-gen.v1`        | Card generation from a chunk           | `src/prompts/card-gen.v1.ts`        |
| `rag-answer.v1`      | RAG chat answer with `[p.NN]` cites    | `src/prompts/rag-answer.v1.ts`      |

## card-gen.v1

Asks for `N` cards per chunk as a pure JSON array. Mix is 40/40/20
cloze / recall / qa. Cards must be answerable from the passage alone;
no outside knowledge; one cloze per card with `{{c1::term}}`; no
trivia or "main idea" cards; each card stands alone (no "the passage"
references).

The orchestrator (`card-gen.service.ts`) samples representative chunks
via k-means medoids on the embedding matrix, prompts for 5 cards per
chunk, parses tolerantly (the outermost `[ ... ]` slice + zod validate),
and dedups by cosine sim > 0.92 on the question embeddings.

When this prompt is bumped:
1. Add `src/prompts/card-gen.v2.ts` — do not edit v1.
2. Set the default in `deck-orchestrator.ts` to v2.
3. New decks pick up v2; existing decks remain attributable to v1.

## rag-answer.v1

Citations are mandatory. The system prompt instructs the LLM to end every
claim with `[p.NN]` and to write "I can't find that in this document."
when retrieval doesn't support the answer. The post-processor
(`markUncitedSentences`) strikes through any uncited sentence with a
visible "⚠ uncited" tag — visible, not blocking.

The prompt assembler takes:
- `retrieved`: top-k chunks with `pageStart/pageEnd`
- `history`: conversation transcript (oldest first, last turn = new query)

and emits a prompt with `== Retrieved passages ==` and `== Conversation ==`
sections plus a trailing `A:` to cue the model.

## When to version a prompt

Bump the version any time:
- the output schema changes (new field, removed field)
- you change the rules (e.g. cite format, cloze syntax)
- you tune sampling temperature / max tokens significantly

Keep cosmetic copy edits in the same version.

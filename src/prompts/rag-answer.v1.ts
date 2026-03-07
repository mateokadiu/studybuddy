/**
 * RAG answer prompt — v1.
 *
 * Drives the chat-with-doc loop. Citations are MANDATORY in the system
 * prompt; the post-processor strikes through any uncited claims with a
 * "⚠ uncited" marker (visible, not blocking) so the LLM can be wrong
 * about citations without us silently dropping content.
 *
 * Citation format: `[p.NN]` after every sentence sourced from a chunk.
 * The parser in rag.service walks the output stream and replaces these
 * with tappable chip components.
 */

import type { RetrievedChunk } from '@/types/chunk';

export const RAG_PROMPT_VERSION = 'rag-answer.v1';

const SYSTEM = `You answer questions about a single document using ONLY the
retrieved passages below.

Rules:
  - Every claim MUST end with a page citation like [p.12].
  - If a passage doesn't support an answer, write "I can't find that in this document."
  - Quote phrases that directly support a claim in double quotes.
  - Be concise. 1-3 short paragraphs maximum.
  - Use prior conversation turns for context but cite only the passages
    provided in this turn.`;

export interface RagPromptArgs {
  /** retrieved chunks, top-k order */
  retrieved: ReadonlyArray<RetrievedChunk>;
  /** chat history (oldest first) — last turn must be the new user query */
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>;
}

export function buildRagPrompt(args: RagPromptArgs): string {
  const passages = args.retrieved
    .map(
      (c, i) =>
        `[Passage ${i + 1} — pp. ${c.pageStart}-${c.pageEnd}]\n${c.text}`,
    )
    .join('\n\n');

  const transcript = args.history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  return `${SYSTEM}

== Retrieved passages ==
${passages}

== Conversation ==
${transcript}

ASSISTANT:`;
}

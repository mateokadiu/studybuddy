/**
 * RAG service.
 *
 * Path:
 *   1. embed the query (~30ms on flagship)
 *   2. top-k=5 cosine over chunks WHERE doc_id = ?
 *   3. build the prompt via prompts/rag-answer.v1
 *   4. stream LLM tokens → caller (incremental)
 *   5. parse `[p.NN]` citations on the way out and produce a structured
 *      Citation[] for the UI to render as tappable chips
 */

import { getEmbedService } from './embed.service';
import { topKForDoc } from './vector-store';
import { getLlmService } from './llm.service';
import { buildRagPrompt, RAG_PROMPT_VERSION } from '@/prompts/rag-answer.v1';
import type { RetrievedChunk } from '@/types/chunk';
import type { Citation } from '@/types/chat';

export interface RagRetrievalOptions {
  k?: number;
}

export async function retrieve(
  docId: string,
  query: string,
  opts: RagRetrievalOptions = {},
): Promise<RetrievedChunk[]> {
  const k = opts.k ?? 5;
  const embed = getEmbedService();
  const qVec = await embed.embed(query);
  return topKForDoc(docId, qVec, k);
}

export interface AnswerOptions {
  k?: number;
  signal?: { aborted: boolean };
}

export interface AnswerChunk {
  /** raw incremental text emitted by the LLM */
  text: string;
  /** citations parsed out of the accumulated text so far */
  cites: Citation[];
  /** running token counts */
  tokensIn: number;
  tokensOut: number;
}

/**
 * Stream a RAG answer. Yields incremental AnswerChunk values; the final
 * value's `cites` array is the de-duplicated set of citations.
 */
export async function* answer(
  docId: string,
  query: string,
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
  opts: AnswerOptions = {},
): AsyncGenerator<AnswerChunk> {
  const retrieved = await retrieve(docId, query, { k: opts.k });
  const prompt = buildRagPrompt({
    retrieved,
    history: [...history, { role: 'user', content: query }],
  });
  const llm = getLlmService();
  let acc = '';
  const tokensIn = Math.ceil(prompt.length / 4);
  let tokensOut = 0;
  for await (const part of llm.generateStream(prompt, { signal: opts.signal })) {
    acc += part;
    tokensOut += Math.max(1, Math.ceil(part.length / 4));
    yield {
      text: part,
      cites: extractCites(acc, retrieved),
      tokensIn,
      tokensOut,
    };
  }
}

/** Parse `[p.NN]` markers out of accumulated text. */
export function extractCites(text: string, retrieved: ReadonlyArray<RetrievedChunk>): Citation[] {
  const out: Citation[] = [];
  const seen = new Set<string>();
  const re = /\[p\.\s*(\d+)\]/g;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const page = Number(m[1]);
    if (!Number.isFinite(page)) {
      m = re.exec(text);
      continue;
    }
    // map page back to the retrieved chunk that covers it
    const hit = retrieved.find((c) => c.pageStart <= page && c.pageEnd >= page);
    const chunkId = hit?.id ?? '';
    const key = `${chunkId}:${page}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ chunkId, page });
    }
    m = re.exec(text);
  }
  return out;
}

/**
 * Post-process: strike through any sentence that ends without a citation
 * with a visible "⚠ uncited" marker. Returns the rewritten text + the
 * list of stricken sentences.
 */
export function markUncitedSentences(text: string): { rewritten: string; uncited: string[] } {
  const uncited: string[] = [];
  const rewritten = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => {
      const t = s.trim();
      if (t.length === 0) return s;
      // present cite at the tail? accept.
      if (/\[p\.\s*\d+\]\s*[.!?]?$/.test(t)) return s;
      // a quoted-only fragment is ok
      if (/^["'][^"']{2,}["']/.test(t)) return s;
      uncited.push(t);
      return `~~${t}~~ ⚠ uncited`;
    })
    .join(' ');
  return { rewritten, uncited };
}

export { RAG_PROMPT_VERSION };

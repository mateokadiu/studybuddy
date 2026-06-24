/**
 * Card generation orchestrator.
 *
 * 1. Pick k = ceil(target / 5) representative chunks via k-means on their
 *    embedding matrix — gives topic-spread, not just sequential.
 * 2. For each picked chunk, prompt the LLM for 5 cards.
 * 3. Parse the JSON. Embed each question. Drop any cosine > 0.92 against
 *    a card we've already accepted (dedup).
 * 4. If we still don't have `target`, sample more chunks and continue.
 *
 * Streams via the onCard callback so the UI can animate the count
 * in real time without waiting for the whole batch.
 */

import type { Chunk } from '@/db/schema';
import { cosine } from '@/lib/cosine';
import { kmeans } from '@/lib/kmeans';
import { CARD_GEN_PROMPT_VERSION, buildCardGenPrompt } from '@/prompts/card-gen.v1';
import { EMBED_DIM, getEmbedService } from '@/services/embed.service';
import { getLlmService } from '@/services/llm.service';
import { unpackEmbedding } from '@/services/vector-store';
import { type GeneratedCard, generatedCardsSchema } from '@/types/card';

export interface CardGenInput {
  /** chunks with embeddings already populated */
  chunks: ReadonlyArray<Chunk>;
  /** target number of cards */
  target: number;
  /** cosine threshold above which two cards are considered dupes (default 0.92) */
  dedupThreshold?: number;
}

export interface CardGenEvent {
  type: 'progress' | 'card' | 'duplicate' | 'done';
  count: number;
  target: number;
  card?: GeneratedCard & { sourceChunkId: string };
}

export interface CardGenResult {
  cards: Array<GeneratedCard & { sourceChunkId: string; questionEmbedding: Float32Array }>;
  promptVersion: string;
  modelId: string;
}

function safeParseJson(raw: string): GeneratedCard[] {
  // tolerate trailing prose, code fences, leading prelude
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const slice = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    const checked = generatedCardsSchema.safeParse(parsed);
    return checked.success ? checked.data : [];
  } catch {
    return [];
  }
}

/** Pick k chunk indices via k-means medoid on their embedding matrix. */
function sampleChunkIndices(chunks: ReadonlyArray<Chunk>, k: number): number[] {
  const withEmb = chunks.filter((c) => c.embedding != null);
  if (withEmb.length === 0) return [];
  const cap = Math.min(k, withEmb.length);
  const matrix = new Float32Array(withEmb.length * EMBED_DIM);
  for (let i = 0; i < withEmb.length; i++) {
    const v = unpackEmbedding(withEmb[i]!.embedding as Buffer);
    matrix.set(v, i * EMBED_DIM);
  }
  const { medoids } = kmeans(matrix, EMBED_DIM, { k: cap, seed: 17 });
  // map medoid index in withEmb back to the original chunks index
  const out: number[] = [];
  for (const m of medoids) {
    if (m < 0) continue;
    const target = withEmb[m]!;
    const orig = chunks.findIndex((c) => c.id === target.id);
    if (orig >= 0) out.push(orig);
  }
  return out;
}

export async function generateCards(
  input: CardGenInput,
  onEvent?: (e: CardGenEvent) => void,
): Promise<CardGenResult> {
  const llm = getLlmService();
  const embed = getEmbedService();
  const dedup = input.dedupThreshold ?? 0.92;
  const accepted: Array<
    GeneratedCard & { sourceChunkId: string; questionEmbedding: Float32Array }
  > = [];

  // sample twice as many chunks as we'd theoretically need, so we have
  // spare to retry if dedup kills a bunch
  const desiredChunks = Math.max(1, Math.ceil(input.target / 5));
  const sampledIdx = sampleChunkIndices(input.chunks, desiredChunks * 2);

  for (const i of sampledIdx) {
    if (accepted.length >= input.target) break;
    const chunk = input.chunks[i] as Chunk;
    const prompt = buildCardGenPrompt({
      targetCount: 5,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      passage: chunk.text,
    });
    const { text } = await llm.generate(prompt);
    const generated = safeParseJson(text);
    if (generated.length === 0) continue;

    // dedup pass
    const questions = generated.map((c) => c.front);
    const embeds = await embed.embedBatch(questions);
    for (let g = 0; g < generated.length; g++) {
      if (accepted.length >= input.target) break;
      const card = generated[g] as GeneratedCard;
      const qv = embeds[g] as Float32Array;
      const isDupe = accepted.some((a) => cosine(qv, a.questionEmbedding) > dedup);
      if (isDupe) {
        onEvent?.({ type: 'duplicate', count: accepted.length, target: input.target });
        continue;
      }
      const out = { ...card, sourceChunkId: chunk.id, questionEmbedding: qv };
      accepted.push(out);
      onEvent?.({
        type: 'card',
        count: accepted.length,
        target: input.target,
        card: { ...card, sourceChunkId: chunk.id },
      });
    }
    onEvent?.({ type: 'progress', count: accepted.length, target: input.target });
  }

  onEvent?.({ type: 'done', count: accepted.length, target: input.target });
  return {
    cards: accepted,
    promptVersion: CARD_GEN_PROMPT_VERSION,
    modelId: llm.modelId(),
  };
}

export { safeParseJson };

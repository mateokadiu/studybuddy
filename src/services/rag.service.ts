/**
 * RAG service.
 *
 * Commit 51: top-k retrieval.
 * Commit 52: prompt assembly + citation extraction.
 *
 * Path:
 *   1. embed the query (~30ms on flagship)
 *   2. top-k=5 cosine over chunks WHERE doc_id = ?
 *   3. build the prompt via prompts/rag-answer.v1
 *   4. stream LLM tokens → caller
 *   5. parse `[p.NN]` citations on the way out
 */

import { getEmbedService } from './embed.service';
import { topKForDoc } from './vector-store';
import type { RetrievedChunk } from '@/types/chunk';

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

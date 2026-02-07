import { z } from 'zod';

export const chunkProvenanceSchema = z.object({
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
  charOffset: z.number().int().min(0),
});
export type ChunkProvenance = z.infer<typeof chunkProvenanceSchema>;

export const retrievedChunkSchema = z.object({
  id: z.string(),
  docId: z.string(),
  idx: z.number().int().min(0),
  text: z.string(),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
  score: z.number(),
});
export type RetrievedChunk = z.infer<typeof retrievedChunkSchema>;

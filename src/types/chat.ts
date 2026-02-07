import { z } from 'zod';

export const citationSchema = z.object({
  chunkId: z.string(),
  page: z.number().int().min(1),
});
export type Citation = z.infer<typeof citationSchema>;

export const chatRoleSchema = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const chatTurnSchema = z.object({
  id: z.string(),
  role: chatRoleSchema,
  content: z.string(),
  cites: z.array(citationSchema).optional(),
  tokensIn: z.number().int().optional(),
  tokensOut: z.number().int().optional(),
  createdAt: z.number().int(),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

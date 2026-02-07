import { z } from 'zod';

export const documentStatusSchema = z.enum(['ingesting', 'ready', 'failed']);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentSourceSchema = z.enum(['pdf', 'epub', 'paste']);
export type DocumentSource = z.infer<typeof documentSourceSchema>;

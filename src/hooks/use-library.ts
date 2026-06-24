import { getDb } from '@/db/client';
import { type Document, documents } from '@/db/schema';
import { useQuery } from '@tanstack/react-query';
import { desc } from 'drizzle-orm';

export interface LibraryRow extends Document {
  /** denormalized count: chunks attached to this doc */
  chunkCount: number;
}

async function loadLibrary(): Promise<LibraryRow[]> {
  const db = getDb();
  const rows = (await db
    .select()
    .from(documents)
    .orderBy(desc(documents.importedAt))) as Document[];
  // chunk counts are intentionally a follow-up query to keep the list responsive
  return rows.map((r) => ({ ...r, chunkCount: 0 }));
}

export function useLibrary() {
  return useQuery<LibraryRow[]>({
    queryKey: ['library'],
    queryFn: loadLibrary,
    staleTime: 5_000,
  });
}

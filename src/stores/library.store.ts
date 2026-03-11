import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkv';

export type IngestStage = 'extracting' | 'chunking' | 'embedding' | 'done' | 'failed';

export interface IngestProgress {
  docId: string;
  stage: IngestStage;
  /** 0..1 */
  ratio: number;
  /** count for the stage we're currently in */
  stageDone: number;
  /** total for the stage */
  stageTotal: number;
  error?: string;
}

export interface LibraryState {
  /** in-flight ingest progress, keyed by docId */
  ingests: Record<string, IngestProgress>;
  /** sort order for the library list */
  sort: 'recent' | 'title';
  /** selection filter */
  filterStatus: 'all' | 'ready' | 'ingesting' | 'failed';

  startIngest(docId: string): void;
  setIngest(docId: string, p: Partial<IngestProgress>): void;
  finishIngest(docId: string): void;
  failIngest(docId: string, error: string): void;
  setSort(s: LibraryState['sort']): void;
  setFilter(f: LibraryState['filterStatus']): void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set) => ({
      ingests: {},
      sort: 'recent',
      filterStatus: 'all',

      startIngest: (docId) =>
        set((s) => ({
          ingests: {
            ...s.ingests,
            [docId]: { docId, stage: 'extracting', ratio: 0, stageDone: 0, stageTotal: 0 },
          },
        })),
      setIngest: (docId, p) =>
        set((s) => {
          const existing = s.ingests[docId];
          if (!existing) return s;
          return {
            ingests: {
              ...s.ingests,
              [docId]: { ...existing, ...p },
            },
          };
        }),
      finishIngest: (docId) =>
        set((s) => {
          const { [docId]: _, ...rest } = s.ingests;
          return { ingests: rest };
        }),
      failIngest: (docId, error) =>
        set((s) => {
          const existing = s.ingests[docId];
          return {
            ingests: {
              ...s.ingests,
              [docId]: existing
                ? { ...existing, stage: 'failed', error }
                : { docId, stage: 'failed', ratio: 0, stageDone: 0, stageTotal: 0, error },
            },
          };
        }),
      setSort: (sort) => set({ sort }),
      setFilter: (filterStatus) => set({ filterStatus }),
    }),
    {
      name: 'library',
      storage: createJSONStorage(() => mmkvStorage()),
      version: 1,
      // ingests are transient; only sort/filter persist
      partialize: (s) => ({ sort: s.sort, filterStatus: s.filterStatus, ingests: {} }),
    },
  ),
);

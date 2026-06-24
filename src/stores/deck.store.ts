import { create } from 'zustand';

/** State for the deck-gen progress overlay. */
export interface DeckGenState {
  deckId: string;
  docId: string;
  count: number;
  target: number;
  duplicates: number;
  done: boolean;
}

interface DeckStore {
  /** in-flight deck generation, keyed by deckId */
  gens: Record<string, DeckGenState>;
  /** filter: 'all' | <docId> */
  docFilter: string;

  startGen(deckId: string, docId: string, target: number): void;
  tickGen(deckId: string, p: Partial<DeckGenState>): void;
  finishGen(deckId: string): void;
  setDocFilter(f: string): void;
}

export const useDeckStore = create<DeckStore>((set) => ({
  gens: {},
  docFilter: 'all',

  startGen: (deckId, docId, target) =>
    set((s) => ({
      gens: {
        ...s.gens,
        [deckId]: { deckId, docId, count: 0, target, duplicates: 0, done: false },
      },
    })),
  tickGen: (deckId, p) =>
    set((s) => {
      const cur = s.gens[deckId];
      if (!cur) return s;
      return { gens: { ...s.gens, [deckId]: { ...cur, ...p } } };
    }),
  finishGen: (deckId) =>
    set((s) => {
      const cur = s.gens[deckId];
      if (!cur) return s;
      return { gens: { ...s.gens, [deckId]: { ...cur, done: true } } };
    }),
  setDocFilter: (docFilter) => set({ docFilter }),
}));

import { create } from 'zustand';

export interface ReviewSession {
  startedAt: number;
  /** ordered ids of cards still to review */
  queue: string[];
  /** ids already reviewed */
  done: string[];
  /** ratings keyed by card id */
  ratings: Record<string, 1 | 2 | 3 | 4>;
  /** ms between flip and grade per card — feeds the heatmap later */
  durations: Record<string, number>;
  /** deckId filter (null = review-all) */
  deckId: string | null;
}

interface ReviewStore {
  session: ReviewSession | null;
  /** front (false) or back (true) showing */
  flipped: boolean;

  startSession(args: { deckId: string | null; queue: string[] }): void;
  flip(): void;
  grade(cardId: string, rating: 1 | 2 | 3 | 4, durationMs: number): void;
  abort(): void;
}

export const useReview = create<ReviewStore>((set) => ({
  session: null,
  flipped: false,

  startSession: ({ deckId, queue }) =>
    set({
      session: {
        startedAt: Date.now(),
        queue,
        done: [],
        ratings: {},
        durations: {},
        deckId,
      },
      flipped: false,
    }),
  flip: () => set((s) => ({ flipped: !s.flipped })),
  grade: (cardId, rating, durationMs) =>
    set((s) => {
      if (!s.session) return s;
      const queue = s.session.queue.filter((id) => id !== cardId);
      return {
        session: {
          ...s.session,
          queue,
          done: [...s.session.done, cardId],
          ratings: { ...s.session.ratings, [cardId]: rating },
          durations: { ...s.session.durations, [cardId]: durationMs },
        },
        flipped: false,
      };
    }),
  abort: () => set({ session: null, flipped: false }),
}));

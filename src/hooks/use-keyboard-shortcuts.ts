import { useEffect } from 'react';

export type GradeKey = '1' | '2' | '3' | '4' | 'space';

interface Handlers {
  /** 1=again, 2=hard, 3=good, 4=easy */
  onGrade(rating: 1 | 2 | 3 | 4): void;
  /** space bar flips the card */
  onFlip(): void;
  /** active = the screen is foreground */
  active: boolean;
}

/**
 * Bind keyboard shortcuts on web + tablet review sessions.
 *
 * 1/2/3/4 grade, space flips. No-op on phones in production builds (no
 * physical keyboard) — the listener is added regardless because it costs
 * effectively nothing.
 */
export function useReviewShortcuts({ onGrade, onFlip, active }: Handlers): void {
  useEffect(() => {
    if (!active) return;
    if (typeof globalThis === 'undefined') return;
    const g = globalThis as {
      addEventListener?: (event: string, fn: (e: { key?: string; code?: string; preventDefault?: () => void }) => void) => void;
      removeEventListener?: (event: string, fn: (e: { key?: string; code?: string; preventDefault?: () => void }) => void) => void;
    };
    if (!g.addEventListener || !g.removeEventListener) return;

    const handler = (e: { key?: string; code?: string; preventDefault?: () => void }) => {
      const k = e.key;
      if (k === '1') onGrade(1);
      else if (k === '2') onGrade(2);
      else if (k === '3') onGrade(3);
      else if (k === '4') onGrade(4);
      else if (k === ' ' || e.code === 'Space') {
        onFlip();
        e.preventDefault?.();
      } else return;
    };
    g.addEventListener('keydown', handler);
    return () => {
      g.removeEventListener?.('keydown', handler);
    };
  }, [active, onGrade, onFlip]);
}

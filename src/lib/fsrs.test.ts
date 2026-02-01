import { describe, it, expect } from 'vitest';
import {
  schedule,
  newCard,
  retrievability,
  defaultConfig,
  DEFAULT_FSRS_WEIGHTS,
} from './fsrs';

const NOW = Date.UTC(2026, 0, 1, 9, 0, 0); // 2026-01-01 09:00 UTC
const DAY = 86_400_000;

// fuzz off for deterministic vectors
const NO_FUZZ = { enableFuzz: false };

describe('fsrs defaults', () => {
  it('exposes 19 weights', () => {
    expect(DEFAULT_FSRS_WEIGHTS).toHaveLength(19);
  });

  it('default config: retention 0.9', () => {
    expect(defaultConfig().requestRetention).toBe(0.9);
  });
});

describe('schedule — new card', () => {
  it('again pushes a new card into learning state', () => {
    const c = newCard(NOW);
    const out = schedule(c, 1, NOW, NO_FUZZ);
    expect(out.state).toBe('learning');
    expect(out.reps).toBe(1);
    expect(out.lapses).toBe(0);
    expect(out.due).toBe(NOW + DAY);
    expect(out.stability).toBeGreaterThan(0);
  });

  it('good keeps learning state with stability > 0', () => {
    const out = schedule(newCard(NOW), 3, NOW, NO_FUZZ);
    expect(out.state).toBe('learning');
    expect(out.stability).toBeGreaterThan(0);
  });

  it('easy promotes directly to review', () => {
    const out = schedule(newCard(NOW), 4, NOW, NO_FUZZ);
    expect(out.state).toBe('review');
    expect(out.stability).toBeGreaterThanOrEqual(15); // S0(easy) is the 4th weight, ~15
    expect(out.due).toBeGreaterThan(NOW + DAY);
  });
});

describe('schedule — review path', () => {
  it('good rating after a long interval increases stability', () => {
    let c = schedule(newCard(NOW), 4, NOW, NO_FUZZ); // -> review with stability ~15
    const stabBefore = c.stability;
    const later = NOW + 14 * DAY;
    c = schedule(c, 3, later, NO_FUZZ);
    expect(c.state).toBe('review');
    expect(c.stability).toBeGreaterThan(stabBefore);
    expect(c.reps).toBe(2);
  });

  it('again on a review card lapses + drops to relearning', () => {
    let c = schedule(newCard(NOW), 4, NOW, NO_FUZZ);
    const later = NOW + 14 * DAY;
    c = schedule(c, 1, later, NO_FUZZ);
    expect(c.lapses).toBe(1);
    expect(c.state).toBe('relearning');
  });

  it('difficulty stays in [1, 10]', () => {
    let c = newCard(NOW);
    for (let i = 0; i < 50; i++) {
      const r = ((i % 4) + 1) as 1 | 2 | 3 | 4;
      c = schedule(c, r, NOW + i * DAY, NO_FUZZ);
      expect(c.difficulty).toBeGreaterThanOrEqual(1);
      expect(c.difficulty).toBeLessThanOrEqual(10);
    }
  });
});

describe('retrievability', () => {
  it('new card or zero stability -> 1', () => {
    expect(retrievability(newCard(NOW), NOW)).toBe(1);
  });

  it('decays monotonically with elapsed time', () => {
    const c = schedule(newCard(NOW), 4, NOW, NO_FUZZ);
    const r0 = retrievability(c, NOW);
    const r1 = retrievability(c, NOW + 30 * DAY);
    const r2 = retrievability(c, NOW + 90 * DAY);
    expect(r0).toBeGreaterThan(r1);
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(0);
    expect(r2).toBeLessThan(1);
  });
});

describe('schedule — fuzz off determinism', () => {
  it('produces identical output for identical input', () => {
    const a = schedule(newCard(NOW), 3, NOW, NO_FUZZ);
    const b = schedule(newCard(NOW), 3, NOW, NO_FUZZ);
    expect(a).toEqual(b);
  });
});

// Spot vectors hand-computed from the formulas above against the 4.5
// default weights. Cross-checked against the open-spaced-repetition reference.
describe('reference vectors', () => {
  it('initial stability for rating=Good matches S0[2] = w[2]', () => {
    const out = schedule(newCard(NOW), 3, NOW, NO_FUZZ);
    expect(out.stability).toBeCloseTo(DEFAULT_FSRS_WEIGHTS[2] as number, 4);
  });

  it('initial stability for rating=Easy matches S0[3] = w[3]', () => {
    const out = schedule(newCard(NOW), 4, NOW, NO_FUZZ);
    expect(out.stability).toBeCloseTo(DEFAULT_FSRS_WEIGHTS[3] as number, 4);
  });

  it('initial difficulty for rating=Good matches w[4] - exp(w[5]*(3-1)) + 1', () => {
    const w = DEFAULT_FSRS_WEIGHTS;
    const expectedD = (w[4] as number) - Math.exp((w[5] as number) * 2) + 1;
    const out = schedule(newCard(NOW), 3, NOW, NO_FUZZ);
    expect(out.difficulty).toBeCloseTo(Math.max(1, Math.min(10, expectedD)), 4);
  });
});

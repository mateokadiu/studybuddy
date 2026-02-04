/**
 * FSRS-4.5 — Free Spaced Repetition Scheduler.
 *
 * TS port of the algorithm Anki ships as default since v23+. Pure functional:
 * (state, rating, now) -> next state. No I/O, no globals.
 *
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * The 19 weights below are the published v4.5 defaults. Per-user optimization
 * is exposed via the `params` shape on `schedule` — see commit 14 for the
 * optimizer hook.
 */

export type FsrsState = 'new' | 'learning' | 'review' | 'relearning';

/** 1 = again, 2 = hard, 3 = good, 4 = easy. */
export type FsrsRating = 1 | 2 | 3 | 4;

export interface FsrsCard {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: FsrsState;
  /** ms since epoch */
  due: number;
  /** ms since epoch, or null if first review */
  lastReview: number | null;
}

export interface FsrsConfig {
  /** desired retention rate, default 0.9 (= "remember 90% of cards") */
  requestRetention: number;
  /** max scheduled interval in days, default 36500 (~100 years) */
  maximumInterval: number;
  /** 19 weights, fsrs-4.5 defaults */
  w: number[];
  /** enable fuzz on intervals (default true) */
  enableFuzz: boolean;
  /** rng for fuzz (default Math.random) */
  rng: () => number;
}

/** Published FSRS-4.5 default weights. */
export const DEFAULT_FSRS_WEIGHTS: number[] = [
  0.4197, 1.1869, 3.0412, 15.2441, 7.1434, 0.6477, 1.0007, 0.0674, 1.6597, 0.1712, 1.1178, 2.0225,
  0.0904, 0.3025, 2.1214, 0.2498, 2.9466, 0.4891, 0.6468,
];

export function defaultConfig(): FsrsConfig {
  return {
    requestRetention: 0.9,
    maximumInterval: 36500,
    w: [...DEFAULT_FSRS_WEIGHTS],
    enableFuzz: true,
    rng: Math.random,
  };
}

export function newCard(now: number): FsrsCard {
  return {
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    due: now,
    lastReview: null,
  };
}

const DAY_MS = 86_400_000;

function daysBetween(aMs: number, bMs: number): number {
  return Math.max(0, (bMs - aMs) / DAY_MS);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** R(t,S) — predicted retrievability given elapsed days t and stability S. */
function forgettingCurve(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return (1 + elapsedDays / (9 * stability)) ** -1;
}

/** Compute the next interval that yields the requested retention. */
function nextInterval(stability: number, requestRetention: number, max: number): number {
  if (stability <= 0) return 0;
  const i = (9 * stability * (1 / requestRetention - 1));
  return clamp(Math.round(i), 1, max);
}

function initialDifficulty(w: number[], rating: FsrsRating): number {
  // D0 = w4 - exp(w5 * (G - 1)) + 1
  const d = (w[4] as number) - Math.exp((w[5] as number) * (rating - 1)) + 1;
  return clamp(d, 1, 10);
}

function initialStability(w: number[], rating: FsrsRating): number {
  // S0(G) — first four weights
  const s = w[rating - 1] as number;
  return Math.max(s, 0.1);
}

function nextDifficulty(w: number[], d: number, rating: FsrsRating): number {
  const dPrime = d - (w[6] as number) * (rating - 3);
  const mean = (w[4] as number) - Math.exp((w[5] as number) * (4 - 1)) + 1;
  const dPP = (w[7] as number) * mean + (1 - (w[7] as number)) * dPrime;
  return clamp(dPP, 1, 10);
}

function shortTermStability(w: number[], s: number, rating: FsrsRating): number {
  const factor = Math.exp((w[17] as number) * (rating - 3 + (w[18] as number)));
  return Math.max(s * factor, 0.1);
}

function recallStability(
  w: number[],
  d: number,
  s: number,
  r: number,
  rating: FsrsRating,
): number {
  const hardPenalty = rating === 2 ? (w[15] as number) : 1;
  const easyBonus = rating === 4 ? (w[16] as number) : 1;
  const factor =
    Math.exp(w[8] as number) *
    (11 - d) *
    s ** -(w[9] as number) *
    (Math.exp((1 - r) * (w[10] as number)) - 1) *
    hardPenalty *
    easyBonus;
  return Math.max(s * (1 + factor), 0.1);
}

function forgetStability(w: number[], d: number, s: number, r: number): number {
  const f =
    (w[11] as number) *
    d ** -(w[12] as number) *
    ((s + 1) ** (w[13] as number) - 1) *
    Math.exp((1 - r) * (w[14] as number));
  return Math.max(f, 0.1);
}

function fuzz(interval: number, cfg: FsrsConfig): number {
  if (!cfg.enableFuzz || interval < 3) return interval;
  // ±5% jitter, at least ±1 day
  const range = Math.max(1, Math.round(interval * 0.05));
  const delta = Math.round(cfg.rng() * (range * 2 + 1)) - range;
  return clamp(interval + delta, 1, cfg.maximumInterval);
}

/**
 * Run one review. Returns the updated card. `now` is ms-since-epoch.
 */
export function schedule(card: FsrsCard, rating: FsrsRating, now: number, cfg?: Partial<FsrsConfig>): FsrsCard {
  const c: FsrsConfig = { ...defaultConfig(), ...cfg };
  const w = c.w;

  let { stability, difficulty, state, lapses, reps } = card;
  const elapsedDays = card.lastReview == null ? 0 : daysBetween(card.lastReview, now);

  if (state === 'new') {
    difficulty = initialDifficulty(w, rating);
    stability = initialStability(w, rating);
    state = rating === 1 ? 'learning' : rating === 4 ? 'review' : 'learning';
  } else {
    const r = forgettingCurve(elapsedDays, stability);
    difficulty = nextDifficulty(w, difficulty, rating);
    if (rating === 1) {
      stability = forgetStability(w, difficulty, stability, r);
      lapses += 1;
      state = 'relearning';
    } else {
      if (elapsedDays < 1) {
        stability = shortTermStability(w, stability, rating);
      } else {
        stability = recallStability(w, difficulty, stability, r, rating);
      }
      state = 'review';
    }
  }

  reps += 1;
  const days =
    state === 'learning' || state === 'relearning'
      ? rating === 1
        ? 1
        : rating === 2
          ? 1
          : rating === 3
            ? 1
            : 4
      : fuzz(nextInterval(stability, c.requestRetention, c.maximumInterval), c);

  const due = now + days * DAY_MS;
  return {
    stability,
    difficulty,
    elapsedDays,
    scheduledDays: days,
    reps,
    lapses,
    state,
    due,
    lastReview: now,
  };
}

/** Predicted retrievability as of `now`. */
export function retrievability(card: FsrsCard, now: number): number {
  if (card.lastReview == null || card.stability <= 0) return 1;
  const t = daysBetween(card.lastReview, now);
  return forgettingCurve(t, card.stability);
}

// ─── Per-user parameter optimization ──────────────────────────────────────
//
// FSRS-4.5 ships with sensible defaults that work well for most users, but
// the algorithm supports per-user weight optimization: feed in 1000+ historical
// (state, rating, elapsed, outcome) tuples and fit weights that minimize the
// log-loss between predicted retrievability and actual recall.
//
// Full L-BFGS-B fitting lives on the roadmap for v0.2 — when we have enough
// historical reviews per user to make it worthwhile. The shape below is the
// stable API surface so the rest of the codebase can already speak to it.
//
// For now: returns the defaults unchanged but records the sample size + a
// noisy "would-be" loss value so the settings screen can display progress.

export interface ReviewHistory {
  cardId: string;
  rating: FsrsRating;
  elapsedDays: number;
  /** computed retention before the review */
  retrievabilityBefore: number;
  /** outcome: 0 = forgot (rating=1), 1 = recalled (rating>=2) */
  outcome: 0 | 1;
}

export interface OptimizerResult {
  /** the (possibly updated) weights */
  weights: number[];
  /** log-loss over the input samples */
  logLoss: number;
  /** number of reviews used */
  sampleSize: number;
  /** whether weights actually changed from input */
  converged: boolean;
}

export interface OptimizerOptions {
  /** starting weights — default is the published v4.5 set */
  initial?: number[];
  /** require at least this many reviews to attempt optimization (default 1000) */
  minSamples?: number;
}

/**
 * Stub optimizer.
 *
 * Computes the log-loss of the current weights over the provided history so
 * the UI has a number to display ("recent retention prediction loss: 0.42"),
 * but does not yet fit. Real L-BFGS-B fitting comes in v0.2 once the dataset
 * is large enough to be worth the complexity + battery cost.
 */
export function optimize(history: ReviewHistory[], opts: OptimizerOptions = {}): OptimizerResult {
  const initial = opts.initial ?? [...DEFAULT_FSRS_WEIGHTS];
  const minSamples = opts.minSamples ?? 1000;

  if (history.length === 0) {
    return { weights: initial, logLoss: 0, sampleSize: 0, converged: true };
  }

  // log-loss: -mean( y log p + (1-y) log(1-p) )
  let loss = 0;
  for (const h of history) {
    const p = Math.max(1e-6, Math.min(1 - 1e-6, h.retrievabilityBefore));
    loss -= h.outcome * Math.log(p) + (1 - h.outcome) * Math.log(1 - p);
  }
  loss /= history.length;

  // not enough samples — return current weights, just report the loss
  if (history.length < minSamples) {
    return { weights: initial, logLoss: loss, sampleSize: history.length, converged: true };
  }

  // would-fit here. for now hold weights stable to keep behavior predictable.
  return { weights: initial, logLoss: loss, sampleSize: history.length, converged: false };
}

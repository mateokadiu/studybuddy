/**
 * LLM service.
 *
 * Real path: react-native-executorch loads Llama 3.2 3B (default) onto the
 * device's accelerator and streams tokens back. The interface is tight on
 * purpose — generate(prompt) for one-shot, generateStream(prompt) for the
 * streaming token iterator the chat + card-gen UIs consume.
 *
 * Dev / node path: a mock that returns plausible structured JSON for the
 * card-gen prompt and a one-liner for everything else. Lets us unit-test
 * the orchestrator (card-gen.service) without the native runtime.
 *
 * Toggle: EXPO_PUBLIC_USE_REAL_MODELS=1.
 */

export interface GenerateOptions {
  /** sampling temperature, 0..2 (default 0.7) */
  temperature?: number;
  /** max output tokens (default 512) */
  maxTokens?: number;
  /** abort signal (mid-stream cancel) */
  signal?: { aborted: boolean };
}

export interface LlmUsage {
  tokensIn: number;
  tokensOut: number;
}

export interface LlmService {
  /** generate a single string */
  generate(prompt: string, opts?: GenerateOptions): Promise<{ text: string; usage: LlmUsage }>;
  /** model id currently loaded ('mock' in dev) */
  modelId(): string;
}

function useReal(): boolean {
  const v =
    (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_USE_REAL_MODELS : undefined) ?? '0';
  return v === '1' || v === 'true';
}

// ─── mock impl ────────────────────────────────────────────────────────────
//
// Recognizes the card-gen prompt shape (looks for "Passage" + a target N)
// and returns plausible cards. Falls through to a one-line answer for
// everything else (so RAG service can be exercised end-to-end too).

const MOCK_TOKENS = ['the', 'mitochondria', 'is', 'the', 'powerhouse', 'of', 'the', 'cell', '.'];

function mockCardsJson(n: number, pageStart: number): string {
  const types: ('cloze' | 'recall' | 'qa')[] = ['cloze', 'cloze', 'recall', 'recall', 'qa'];
  const cards = Array.from({ length: n }, (_, i) => {
    const t = types[i % types.length]!;
    const page = pageStart + (i % 3);
    if (t === 'cloze') {
      return {
        type: t,
        front: `The {{c1::concept ${i}}} explains the mechanism described in this passage.`,
        back: `concept ${i}`,
        page,
      };
    }
    if (t === 'recall') {
      return {
        type: t,
        front: `What is the canonical example of pattern ${i}?`,
        back: `example ${i}`,
        page,
      };
    }
    return {
      type: t,
      front: `Explain how phenomenon ${i} relates to topic A.`,
      back: `Phenomenon ${i} relates to topic A because of mechanism ${i}.`,
      page,
    };
  });
  return JSON.stringify(cards);
}

function mockAnswer(prompt: string): string {
  // a minimal RAG-shaped answer with a citation chip
  return `According to the retrieved passages, the answer is straightforward [p.1]. The text supports this directly. ${prompt.length > 0 ? '' : ''}`.trim();
}

function mockService(): LlmService {
  return {
    async generate(prompt, opts) {
      const text = matchCardGenN(prompt)
        ? mockCardsJson(matchCardGenN(prompt) as number, matchPageStart(prompt))
        : mockAnswer(prompt);
      return {
        text,
        usage: {
          tokensIn: Math.ceil(prompt.length / 4),
          tokensOut: Math.ceil(text.length / 4),
        },
      };
    },
    modelId() {
      return 'mock';
    },
  };
}

function matchCardGenN(prompt: string): number | null {
  const m = prompt.match(/N\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function matchPageStart(prompt: string): number {
  const m = prompt.match(/pp\.\s*(\d+)/);
  return m ? Number(m[1]) : 1;
}

// ─── native impl (executorch) ─────────────────────────────────────────────
function nativeService(): LlmService {
  type Loaded = {
    generate(prompt: string, opts: GenerateOptions): Promise<{ text: string; usage: LlmUsage }>;
    unload(): Promise<void>;
  };
  const exMod = require('react-native-executorch') as {
    loadLlm(modelPath: string): Promise<Loaded>;
  };
  let cached: Loaded | null = null;
  const modelPath = ''; // resolved by models.service.pathFor at first call
  return {
    async generate(prompt, opts = {}) {
      if (!cached) cached = await exMod.loadLlm(modelPath);
      return cached.generate(prompt, opts);
    },
    modelId() {
      return 'llama-3.2-3b-instruct-q4';
    },
  };
}

let cached: LlmService | null = null;

export function getLlmService(): LlmService {
  if (cached) return cached;
  cached = useReal() ? nativeService() : mockService();
  return cached;
}

export function _resetLlmServiceForTests(): void {
  cached = null;
}

export { MOCK_TOKENS, mockCardsJson };

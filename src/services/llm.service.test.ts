import { describe, it, expect } from 'vitest';
import { getLlmService, mockCardsJson } from './llm.service';
import { generatedCardsSchema } from '@/types/card';

describe('llm service (mock)', () => {
  it('detects the card-gen prompt and returns valid json', async () => {
    const svc = getLlmService();
    const { text, usage } = await svc.generate(`N = 5\nPassage (pp. 3-5):\n"""\nsome text\n"""`);
    const parsed = JSON.parse(text);
    const cards = generatedCardsSchema.parse(parsed);
    expect(cards).toHaveLength(5);
    expect(usage.tokensIn).toBeGreaterThan(0);
    expect(usage.tokensOut).toBeGreaterThan(0);
  });

  it('cards mix types', () => {
    const text = mockCardsJson(5, 1);
    const cards = generatedCardsSchema.parse(JSON.parse(text));
    const types = new Set(cards.map((c) => c.type));
    expect(types.size).toBeGreaterThan(1);
  });

  it('non-cardgen prompts get a short answer', async () => {
    const { text } = await getLlmService().generate('what is mitosis?');
    expect(text).toBeTruthy();
    expect(text.length).toBeLessThan(500);
    expect(text).toContain('[p.1]'); // a cite chip
  });

  it('modelId is "mock" in dev', () => {
    expect(getLlmService().modelId()).toBe('mock');
  });
});

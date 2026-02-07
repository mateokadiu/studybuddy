import { describe, it, expect } from 'vitest';
import { generatedCardSchema, generatedCardsSchema } from './card';

describe('generatedCardSchema', () => {
  it('accepts a valid cloze card', () => {
    const r = generatedCardSchema.parse({
      type: 'cloze',
      front: 'The mitochondria are the {{c1::powerhouse}} of the cell.',
      back: 'powerhouse',
      page: 42,
    });
    expect(r.type).toBe('cloze');
  });

  it('rejects empty front', () => {
    expect(() =>
      generatedCardSchema.parse({ type: 'qa', front: '', back: 'x' }),
    ).toThrow();
  });

  it('rejects unknown type', () => {
    expect(() =>
      generatedCardSchema.parse({ type: 'rambo', front: 'x', back: 'y' }),
    ).toThrow();
  });

  it('page is optional', () => {
    expect(() =>
      generatedCardSchema.parse({ type: 'recall', front: 'x?', back: 'x' }),
    ).not.toThrow();
  });

  it('parses an array of cards', () => {
    const arr = generatedCardsSchema.parse([
      { type: 'qa', front: 'a?', back: 'a.' },
      { type: 'cloze', front: 'b{{c1::x}}', back: 'x' },
    ]);
    expect(arr).toHaveLength(2);
  });
});

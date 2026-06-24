import { describe, expect, it } from 'vitest';
import { id, idTimestamp } from './id';

describe('id', () => {
  it('returns 36-char canonical uuid', () => {
    const x = id();
    expect(x).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('every id is unique across a small batch', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(id());
    expect(set.size).toBe(1000);
  });

  it('ids generated later sort lexicographically larger', async () => {
    const a = id();
    // sleep 5ms so the ms-prefix differs
    await new Promise((r) => setTimeout(r, 5));
    const b = id();
    expect(a < b).toBe(true);
  });

  it('idTimestamp returns a sensible epoch ms', () => {
    const now = Date.now();
    const t = idTimestamp(id());
    expect(t).toBeGreaterThan(now - 1000);
    expect(t).toBeLessThan(now + 1000);
  });
});

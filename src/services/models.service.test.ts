import { describe, expect, it } from 'vitest';
import { MODEL_CATALOG, findModel, getModelsService } from './models.service';

describe('model catalog', () => {
  it('every entry has a sha256 hex string', () => {
    for (const m of MODEL_CATALOG) {
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('every entry has a unique id', () => {
    const ids = new Set(MODEL_CATALOG.map((m) => m.id));
    expect(ids.size).toBe(MODEL_CATALOG.length);
  });

  it('includes one embedding model', () => {
    const embeds = MODEL_CATALOG.filter((m) => m.kind === 'embed');
    expect(embeds.length).toBeGreaterThanOrEqual(1);
  });
});

describe('findModel', () => {
  it('throws on unknown id', () => {
    expect(() => findModel('unknown' as never)).toThrow(/unknown model id/);
  });
});

describe('node stub', () => {
  it('reports installed + delivers a progress sequence', async () => {
    const svc = getModelsService();
    const log: string[] = [];
    const path = await svc.download('all-minilm-l6-v2', (p) => log.push(p.status.state));
    expect(path).toContain('all-minilm-l6-v2');
    expect(log).toContain('downloading');
    expect(log).toContain('verifying');
    expect(log).toContain('installed');
  });
});

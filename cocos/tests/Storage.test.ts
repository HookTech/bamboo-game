import { Storage } from '../assets/scripts/platform/Storage';

describe('Storage (node env: no wx, no localStorage)', () => {
  it('get returns null when nothing stored', () => {
    expect(new Storage().get('bamboo_best')).toBeNull();
  });

  it('set never throws even with no backend', () => {
    expect(() => new Storage().set('bamboo_best', '12.5')).not.toThrow();
  });

  it('uses localStorage when present', () => {
    const mem = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    const s = new Storage();
    s.set('bamboo_best', '42');
    expect(s.get('bamboo_best')).toBe('42');
    delete (globalThis as Record<string, unknown>).localStorage;
  });

  it('swallows backend exceptions and returns null', () => {
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const s = new Storage();
    expect(s.get('x')).toBeNull();
    expect(() => s.set('x', '1')).not.toThrow();
    delete (globalThis as Record<string, unknown>).localStorage;
  });
});

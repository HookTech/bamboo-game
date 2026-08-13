import { pickFromPool } from '../assets/scripts/core/AnimalTaunts';
import { defaultPack } from '../assets/scripts/content/packs/defaultPack';

describe('AnimalTaunts', () => {
  const pool = defaultPack.animals.taunts;

  it('default pack pool is non-empty', () => {
    expect(pool.length).toBeGreaterThan(20);
  });

  it('pickFromPool is deterministic with fixed rng', () => {
    expect(pickFromPool(pool, () => 0)).toBe(pool[0]);
    expect(pickFromPool(pool, () => 0.999)).toBe(pool[pool.length - 1]);
  });
});

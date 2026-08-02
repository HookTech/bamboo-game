import {
  AnimalHazard,
  animalTier,
  kindsForTier,
  maxAliveForTier,
} from '../assets/scripts/core/AnimalHazard';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';

describe('animal tiers', () => {
  it('maps coin thresholds to tiers', () => {
    expect(animalTier(0)).toBe(0);
    expect(animalTier(19)).toBe(0);
    expect(animalTier(20)).toBe(1);
    expect(animalTier(49)).toBe(1);
    expect(animalTier(50)).toBe(2);
    expect(animalTier(99)).toBe(2);
    expect(animalTier(100)).toBe(3);
  });

  it('unlocks kinds and maxAlive by tier', () => {
    expect(kindsForTier(0)).toEqual([]);
    expect(kindsForTier(1)).toEqual(['bird', 'cat']);
    expect(kindsForTier(2)).toEqual(['bird', 'cat', 'dog']);
    expect(kindsForTier(3)).toEqual(['bird', 'cat', 'dog', 'rabbit']);
    expect(maxAliveForTier(1)).toBe(C.ANIMAL_MAX_ALIVE_T1_T2);
    expect(maxAliveForTier(2)).toBe(C.ANIMAL_MAX_ALIVE_T1_T2);
    expect(maxAliveForTier(3)).toBe(C.ANIMAL_MAX_ALIVE_T3);
  });
});

describe('AnimalHazard spawn', () => {
  function baseInput(over: Partial<Parameters<AnimalHazard['update']>[0]> = {}) {
    return {
      dt: 0.1,
      t: 10,
      started: true,
      stunned: false,
      coins: 20,
      tipX: 0,
      tipY: 200,
      pandaX: 0,
      pandaY: 174,
      bendOffset: 0,
      ...over,
    };
  }

  it('does not spawn below tier1 coins', () => {
    const h = new AnimalHazard(() => 0);
    h.update(baseInput({ coins: 19, t: 100 }));
    expect(h.aliveCount()).toBe(0);
  });

  it('spawns when gap elapsed and under maxAlive', () => {
    // t=0 arm: rollGap uses rng#0
    // t=20 spawn: kind rng#1, side rng#2, next gap rng#3
    // 顺序必须与实现一致：kind → side → nextSpawnAt=rollGap
    let i = 0;
    const seq = [0.0, 0.0, 0.9, 0.0]; // gap→min; kind→bird; side→+1; next gap
    const h = new AnimalHazard(() => seq[Math.min(i++, seq.length - 1)]);
    h.update(baseInput({ t: 0, coins: 20 }));
    h.update(baseInput({ t: 20, coins: 20 }));
    expect(h.aliveCount()).toBe(1);
    const a = h.animals.find((x) => x.phase !== 'gone')!;
    expect(a.kind).toBe('bird');
    expect(a.side).toBe(1);
    expect(a.phase).toBe('fadeIn');
  });

  it('respects maxAlive and skips while stunned', () => {
    let n = 0;
    const h = new AnimalHazard(() => (n++ % 2 === 0 ? 0.9 : 0));
    h.update(baseInput({ t: 0, coins: 20 }));
    h.update(baseInput({ t: 20, coins: 20 }));
    expect(h.aliveCount()).toBe(1);
    h.update(baseInput({ t: 40, coins: 20 }));
    expect(h.aliveCount()).toBe(1);
    h.update(baseInput({ t: 60, coins: 20, stunned: true }));
    expect(h.aliveCount()).toBe(1);
  });
});

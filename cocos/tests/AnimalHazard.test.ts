import {
  Animal,
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

describe('AnimalHazard combat', () => {
  function mkAnimal(h: AnimalHazard, over: Partial<Animal> = {}) {
    const a = {
      id: 1,
      kind: 'bird' as const,
      xPx: 55,
      yPx: 200,
      side: 1 as const,
      phase: 'dive' as const,
      age: 1,
      knockAge: 0,
      taunted: false,
      ...over,
    };
    h.animals.push(a);
    return a;
  }

  // coins:19 → tier0，避免 trySpawn 干扰手工塞入的实体
  const inp = {
    dt: 0.05,
    t: 5,
    started: true,
    stunned: false,
    coins: 19,
    tipX: 0,
    tipY: 200,
    pandaX: 0,
    pandaY: 174,
    bendOffset: 0,
  };

  it('knocks when tip in radius, bend strong and same side', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 40, yPx: 200, side: 1, phase: 'dive' });
    let knocked = 0;
    h.on('knock', () => knocked++);
    h.update({ ...inp, tipX: 0, tipY: 200, bendOffset: 60 });
    expect(knocked).toBe(1);
    expect(a.phase).toBe('knock');
  });

  it('hits panda when close without valid knock bend', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 10, yPx: 180, side: 1, phase: 'dive' });
    let hits = 0;
    h.on('hit', () => hits++);
    h.update({ ...inp, tipX: 0, tipY: 200, pandaX: 0, pandaY: 174, bendOffset: 0 });
    expect(hits).toBe(1);
    expect(a.phase).toBe('gone'); // hit 后立即回收为 gone
  });



  it('emits taunt about 1s after appear', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { phase: 'fadeIn', age: 0, yPx: 300 });
    let taunts = 0;
    h.on('taunt', () => taunts++);
    // 0.95s: not yet
    h.update({ ...inp, dt: 0.95, t: 5, tipX: 200, tipY: 400, bendOffset: 0 });
    expect(taunts).toBe(0);
    expect(a.taunted).toBe(false);
    // +0.1s → age 1.05 >= 1
    h.update({ ...inp, dt: 0.1, t: 5.95, tipX: 200, tipY: 400, bendOffset: 0 });
    expect(taunts).toBe(1);
    expect(a.taunted).toBe(true);
    // once only
    h.update({ ...inp, dt: 0.2, t: 6.15, tipX: 200, tipY: 400, bendOffset: 0 });
    expect(taunts).toBe(1);
  });

  it('hits promptly when diving into panda radius', () => {
    const h = new AnimalHazard(() => 0);
    // 出生偏侧上方,俯冲目标为熊猫;若干帧内应进圈 hit,不得空停数秒
    const a = mkAnimal(h, { xPx: 55, yPx: 280, side: 1, phase: 'dive', age: 1 });
    let hits = 0;
    h.on('hit', () => hits++);
    for (let i = 0; i < 120 && hits === 0; i++) {
      h.update({ ...inp, dt: 0.05, t: 5 + i * 0.05, tipX: 200, tipY: 400, bendOffset: 0 });
    }
    expect(hits).toBe(1);
    expect(a.phase).toBe('gone');
    // 120 * 0.05 = 6s 上限;合理俯冲应远快于此
    expect(hits).toBe(1);
  });

  it('only one hit per frame when two animals in radius', () => {
    const h = new AnimalHazard(() => 0);
    mkAnimal(h, { id: 1, xPx: 10, yPx: 180, side: 1, phase: 'dive' });
    mkAnimal(h, { id: 2, xPx: 15, yPx: 182, side: -1, phase: 'dive' });
    let hits = 0;
    h.on('hit', () => hits++);
    h.update({ ...inp, tipX: 0, tipY: 200, pandaX: 0, pandaY: 174, bendOffset: 0 });
    expect(hits).toBe(1);
  });

  it('prefers knock over hit same frame', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 20, yPx: 180, side: 1, phase: 'dive' });
    let knock = 0, hits = 0;
    h.on('knock', () => knock++);
    h.on('hit', () => hits++);
    h.update({ ...inp, tipX: 0, tipY: 180, pandaX: 0, pandaY: 174, bendOffset: 80 });
    expect(knock).toBe(1);
    expect(hits).toBe(0);
    expect(a.phase).toBe('knock');
  });

  it('freezes motion while stunned and despawns after knock timer', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 55, yPx: 300, side: 1, phase: 'dive', age: 1 });
    const y0 = a.yPx;
    h.update({ ...inp, stunned: true, dt: 0.2 });
    expect(a.yPx).toBe(y0);
    a.phase = 'knock';
    a.knockAge = 0;
    h.update({ ...inp, dt: C.ANIMAL_KNOCK_DESPAWN_S + 0.01, stunned: false });
    expect(a.phase).toBe('gone');
  });

  it('suppresses spawn during post-hit cooldown', () => {
    // arm: rollGap→min → nextSpawnAt=8；hit 前用 coins:19 越过 gap 使 nextSpawnAt 已到期
    // 这样冷却期内唯一挡 spawn 的是 postHitUntil
    let i = 0;
    const seq = [0.0, 0.0, 0.9, 0.0]; // arm gap; later: kind→bird; side→+1; next gap
    const h = new AnimalHazard(() => seq[Math.min(i++, seq.length - 1)]);
    h.update({ ...inp, t: 0, coins: 20 }); // arm, nextSpawnAt = 8
    h.update({ ...inp, t: 8, coins: 19 }); // gap elapsed but tier0 — no spawn
    mkAnimal(h, { xPx: 10, yPx: 180, side: 1, phase: 'dive' });
    const hitT = 8.5;
    h.update({ ...inp, t: hitT, coins: 19, tipX: 0, tipY: 200, pandaX: 0, pandaY: 174, bendOffset: 0 });
    expect(h.aliveCount()).toBe(0);

    // nextSpawnAt already elapsed; still inside postHitUntil = hitT + cooldown
    h.update({ ...inp, t: hitT + C.ANIMAL_POST_HIT_COOLDOWN_S - 0.01, coins: 20 });
    expect(h.aliveCount()).toBe(0);

    h.update({ ...inp, t: hitT + C.ANIMAL_POST_HIT_COOLDOWN_S, coins: 20 });
    expect(h.aliveCount()).toBe(1);
  });
});

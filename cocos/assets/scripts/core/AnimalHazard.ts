import { GameConfig as C } from './GameConfig';

export type AnimalKind = 'bird' | 'cat' | 'dog' | 'rabbit';
export type AnimalPhase = 'fadeIn' | 'dive' | 'knock' | 'hit' | 'gone';
export type AnimalEvent = 'spawn' | 'knock' | 'hit' | 'despawn';

export interface Animal {
  id: number;
  kind: AnimalKind;
  xPx: number;
  yPx: number;
  side: -1 | 1;
  phase: AnimalPhase;
  age: number;
  knockAge: number;
}

export interface HazardInput {
  dt: number;
  t: number;
  started: boolean;
  stunned: boolean;
  coins: number;
  tipX: number;
  tipY: number;
  pandaX: number;
  pandaY: number;
  bendOffset: number;
}

type Handler = (a: Animal) => void;

export function animalTier(coins: number): 0 | 1 | 2 | 3 {
  if (coins >= C.ANIMAL_TIER3_COINS) return 3;
  if (coins >= C.ANIMAL_TIER2_COINS) return 2;
  if (coins >= C.ANIMAL_TIER1_COINS) return 1;
  return 0;
}

export function kindsForTier(tier: 0 | 1 | 2 | 3): AnimalKind[] {
  if (tier <= 0) return [];
  if (tier === 1) return ['bird', 'cat'];
  if (tier === 2) return ['bird', 'cat', 'dog'];
  return ['bird', 'cat', 'dog', 'rabbit'];
}

export function maxAliveForTier(tier: 0 | 1 | 2 | 3): number {
  if (tier <= 0) return 0;
  if (tier >= 3) return C.ANIMAL_MAX_ALIVE_T3;
  return C.ANIMAL_MAX_ALIVE_T1_T2;
}

function gapRange(tier: 1 | 2 | 3): [number, number] {
  if (tier === 1) return [C.ANIMAL_SPAWN_GAP_T1_MIN, C.ANIMAL_SPAWN_GAP_T1_MAX];
  if (tier === 2) return [C.ANIMAL_SPAWN_GAP_T2_MIN, C.ANIMAL_SPAWN_GAP_T2_MAX];
  return [C.ANIMAL_SPAWN_GAP_T3_MIN, C.ANIMAL_SPAWN_GAP_T3_MAX];
}

/** 空中动物危害 —— 纯逻辑,零渲染依赖。rng ∈ [0,1)。 */
export class AnimalHazard {
  animals: Animal[] = [];
  private nextId = 1;
  private nextSpawnAt = 0;
  private postHitUntil = 0;
  private handlers = new Map<AnimalEvent, Handler[]>();
  private armed = false;

  constructor(private rng: () => number = Math.random) {}

  on(ev: AnimalEvent, fn: Handler): void {
    const list = this.handlers.get(ev) ?? [];
    list.push(fn);
    this.handlers.set(ev, list);
  }

  private emit(ev: AnimalEvent, a: Animal): void {
    for (const fn of this.handlers.get(ev) ?? []) fn(a);
  }

  aliveCount(): number {
    return this.animals.filter((a) => a.phase !== 'gone').length;
  }

  private rollGap(tier: 1 | 2 | 3): number {
    const [lo, hi] = gapRange(tier);
    return lo + this.rng() * (hi - lo);
  }

  private trySpawn(inp: HazardInput): void {
    const tier = animalTier(inp.coins);
    if (tier === 0) return;
    if (!inp.started || inp.stunned) return;
    if (inp.t < this.postHitUntil) return;
    if (this.aliveCount() >= maxAliveForTier(tier)) return;
    if (!this.armed) {
      this.armed = true;
      this.nextSpawnAt = inp.t + this.rollGap(tier);
      return;
    }
    if (inp.t < this.nextSpawnAt) return;

    // 顺序固定：kind → side → rollGap（单测依赖此顺序）
    const kinds = kindsForTier(tier);
    const kind = kinds[Math.floor(this.rng() * kinds.length)] ?? kinds[0];
    const side: -1 | 1 = this.rng() < 0.5 ? -1 : 1;
    const a: Animal = {
      id: this.nextId++,
      kind,
      side,
      xPx: inp.tipX + side * C.ANIMAL_SIDE_OFFSET_PX,
      yPx: inp.tipY + C.ANIMAL_SPAWN_HEIGHT_PX,
      phase: 'fadeIn',
      age: 0,
      knockAge: 0,
    };
    this.animals.push(a);
    this.emit('spawn', a);
    this.nextSpawnAt = inp.t + this.rollGap(tier);
  }

  update(inp: HazardInput): void {
    this.trySpawn(inp);
    // Task 5 填运动与判定
  }
}

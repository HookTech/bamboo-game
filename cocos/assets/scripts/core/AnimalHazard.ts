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

  private dist(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx, dy = ay - by;
    return Math.hypot(dx, dy);
  }

  private canKnock(a: Animal, inp: HazardInput): boolean {
    if (a.phase !== 'fadeIn' && a.phase !== 'dive') return false;
    if (this.dist(a.xPx, a.yPx, inp.tipX, inp.tipY) > C.ANIMAL_KNOCK_RADIUS_PX) return false;
    if (Math.abs(inp.bendOffset) < C.ANIMAL_KNOCK_BEND_MIN_PX) return false;
    const sign = inp.bendOffset > 0 ? 1 : inp.bendOffset < 0 ? -1 : 0;
    return sign === a.side;
  }

  private canHit(a: Animal, inp: HazardInput): boolean {
    if (a.phase !== 'fadeIn' && a.phase !== 'dive') return false;
    return this.dist(a.xPx, a.yPx, inp.pandaX, inp.pandaY) <= C.ANIMAL_HIT_RADIUS_PX;
  }

  private integrate(a: Animal, inp: HazardInput): void {
    if (inp.stunned) return;
    a.age += inp.dt;
    if (a.phase === 'fadeIn') {
      if (a.age >= C.ANIMAL_FADE_IN_S) a.phase = 'dive';
      return;
    }
    if (a.phase !== 'dive') return;
    const tx = inp.pandaX + a.side * C.ANIMAL_SIDE_OFFSET_PX;
    const ty = inp.pandaY;
    const dx = tx - a.xPx, dy = ty - a.yPx;
    const d = Math.hypot(dx, dy) || 1;
    const step = C.ANIMAL_DIVE_SPEED_PX * inp.dt;
    if (step >= d) {
      a.xPx = tx;
      a.yPx = ty;
    } else {
      a.xPx += (dx / d) * step;
      a.yPx += (dy / d) * step;
    }
  }

  update(inp: HazardInput): void {
    this.trySpawn(inp);
    let hitThisFrame = false;
    for (const a of this.animals) {
      if (a.phase === 'gone') continue;
      if (a.phase === 'knock') {
        a.knockAge += inp.dt;
        if (a.knockAge >= C.ANIMAL_KNOCK_DESPAWN_S) {
          a.phase = 'gone';
          this.emit('despawn', a);
        }
        continue;
      }
      if (a.phase === 'hit') continue;
      if (hitThisFrame) continue;
      if (this.canKnock(a, inp)) {
        a.phase = 'knock';
        a.knockAge = 0;
        this.emit('knock', a);
        continue;
      }
      if (this.canHit(a, inp)) {
        a.phase = 'hit';
        this.postHitUntil = inp.t + C.ANIMAL_POST_HIT_COOLDOWN_S;
        this.emit('hit', a);
        this.emit('despawn', a);
        a.phase = 'gone';
        hitThisFrame = true;
        continue;
      }
      this.integrate(a, inp);
    }
  }
}

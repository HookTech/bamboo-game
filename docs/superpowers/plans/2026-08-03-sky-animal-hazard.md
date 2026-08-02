# 空中动物危害 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 金币分档后高空俯冲小动物（鸟/猫/狗/兔）；弯竹主动出击撞飞（纯表现），未挡则眩晕并掉 coins（score 不回退）。

**Architecture:** 新建纯 core `AnimalHazard`（刷怪/俯冲/撞飞/撞击，可注入 RNG）；`GameState.applyExternalStun` + `ScoreSystem.loseCoins` 承接惩罚；`AnimalView` 订阅事件做 3D/占位表现；`Bootstrap` 每帧注入 tip/panda/bend/coins。不改节奏参数与弯竹 API。

**Tech Stack:** Cocos Creator 3.8.8 · TypeScript · jest（`cd cocos && npx jest`）

**Spec:** `docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md`

**工作分支:** `feature/sky-animal-hazard`（已从 `main` 拉出）

**文件职责:**

| 文件 | 职责 |
|---|---|
| `cocos/assets/scripts/core/GameConfig.ts` | 动物分档/半径/冷却常量 |
| `cocos/assets/scripts/core/ScoreSystem.ts` | `loseCoins(n)` |
| `cocos/tests/ScoreSystem.test.ts` | 扣币用例 |
| `cocos/assets/scripts/core/GameState.ts` | `applyExternalStun()` |
| `cocos/tests/GameState.test.ts` | 外部眩晕用例 |
| `cocos/assets/scripts/core/AnimalHazard.ts` | 危害逻辑 + 导出分档纯函数 |
| `cocos/assets/scripts/core/AnimalHazard.ts.meta` | Creator 脚本 meta |
| `cocos/tests/AnimalHazard.test.ts` | hazard 单测 |
| `cocos/assets/scripts/fx/AudioFx.ts` | `coinDrop` / `animalKnock` |
| `cocos/assets/scripts/fx/ParticleFx.ts` | `coinDrop(worldPos)` |
| `cocos/assets/scripts/view/AnimalView.ts` | 表现层（占位→可选 GLB） |
| `cocos/assets/scripts/view/AnimalView.ts.meta` | Creator 脚本 meta |
| `cocos/assets/scripts/Bootstrap.ts` | 接线 + 每帧 update |
| `ASSETS.md` | 新模型署名（有 GLB 时） |
| `docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md` | 分支状态改为进行中 |

**坐标约定（与 `PandaView.charPx` / `CoinView` 一致）：**

- 世界 px：`x = 0` 为世界原点；竹根水平 = `BAMBOO_X_PX - DESIGN_W/2`
- 竹尖：`tipX = BAMBOO_X_PX - DESIGN_W/2 + bamboo.swayPx`，`tipY = heightPx`
- 熊猫：`panda.charPx`

---

### Task 1: 更新 spec 分支状态 + GameConfig 常量

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md`
- Modify: `cocos/assets/scripts/core/GameConfig.ts`

- [ ] **Step 1: 改 spec 抬头**

将：

```md
分支: 待开 `feature/sky-animal-hazard`  
状态: 已确认（方案 1 · 独立 AnimalHazard）  
```

改为：

```md
分支: `feature/sky-animal-hazard`  
状态: 实现中（方案 1 · 独立 AnimalHazard）  
```

- [ ] **Step 2: 在 `GameConfig` 的 `SUN_LOCAL_Z` 后追加动物常量**

```ts
  /** —— 空中动物危害 —— */
  ANIMAL_TIER1_COINS: 20,
  ANIMAL_TIER2_COINS: 50,
  ANIMAL_TIER3_COINS: 100,
  ANIMAL_SPAWN_GAP_T1_MIN: 8,
  ANIMAL_SPAWN_GAP_T1_MAX: 12,
  ANIMAL_SPAWN_GAP_T2_MIN: 6,
  ANIMAL_SPAWN_GAP_T2_MAX: 9,
  ANIMAL_SPAWN_GAP_T3_MIN: 5,
  ANIMAL_SPAWN_GAP_T3_MAX: 8,
  ANIMAL_MAX_ALIVE_T1_T2: 1,
  ANIMAL_MAX_ALIVE_T3: 2,
  ANIMAL_FADE_IN_S: 0.6,
  ANIMAL_SPAWN_HEIGHT_PX: 180,
  ANIMAL_SIDE_OFFSET_PX: 55,
  ANIMAL_DIVE_SPEED_PX: 90,
  ANIMAL_HIT_RADIUS_PX: 50,
  ANIMAL_KNOCK_RADIUS_PX: 70,
  ANIMAL_KNOCK_BEND_MIN_PX: 50,
  ANIMAL_COIN_LOSS: 5,
  ANIMAL_POST_HIT_COOLDOWN_S: 3,
  ANIMAL_KNOCK_DESPAWN_S: 0.8,
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md \
  cocos/assets/scripts/core/GameConfig.ts
git commit -m "$(cat <<'EOF'
feat(config): animal hazard tier and combat constants

EOF
)"
```

---

### Task 2: ScoreSystem.loseCoins（TDD）

**Files:**
- Modify: `cocos/assets/scripts/core/ScoreSystem.ts`
- Modify: `cocos/tests/ScoreSystem.test.ts`

- [ ] **Step 1: 在测试文件追加失败用例**

```ts
  it('loseCoins subtracts coins only and clamps at 0', () => {
    const s = new ScoreSystem(freshStorage());
    s.pickup(0);
    s.pickup(0);
    s.pickup(0);
    expect(s.coins).toBe(3);
    expect(s.score).toBe(3);
    expect(s.loseCoins(5)).toBe(3);
    expect(s.coins).toBe(0);
    expect(s.score).toBe(3);
    expect(s.loseCoins(2)).toBe(0);
    expect(s.coins).toBe(0);
  });
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/ScoreSystem.test.ts -v`

Expected: FAIL — `loseCoins` is not a function

- [ ] **Step 3: 实现**

在 `ScoreSystem` 类内 `pickup` 后追加：

```ts
  /** 撞击掉币:只减 coins,不改 score。返回实际扣掉数量。 */
  loseCoins(n: number): number {
    const loss = Math.min(Math.max(0, Math.floor(n)), this.coins);
    this.coins -= loss;
    return loss;
  }
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd cocos && npx jest tests/ScoreSystem.test.ts -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/ScoreSystem.ts cocos/tests/ScoreSystem.test.ts
git commit -m "$(cat <<'EOF'
feat(score): loseCoins clamps at zero without touching score

EOF
)"
```

---

### Task 3: GameState.applyExternalStun（TDD）

**Files:**
- Modify: `cocos/assets/scripts/core/GameState.ts`
- Modify: `cocos/tests/GameState.test.ts`

- [ ] **Step 1: 追加失败用例**

```ts
  it('applyExternalStun clears combo, sets stun window, emits stun', () => {
    const s = makeStarted();
    s.update(0.3); s.press();
    s.update(0.3); s.press();
    expect(s.combo).toBe(2);
    let stunned = 0;
    s.on('stun', () => stunned++);
    s.applyExternalStun();
    expect(stunned).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.stunned).toBe(true);
    expect(s.press()).toBeNull();
    s.update(0.95);
    expect(s.stunned).toBe(false);
  });
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/GameState.test.ts -v`

Expected: FAIL — `applyExternalStun` missing

- [ ] **Step 3: 实现**

在 `GameState` 的 `press` 方法后追加：

```ts
  /** 外部危害眩晕(动物撞击等):与过急眩晕同效果。 */
  applyExternalStun(): void {
    this.combo = 0;
    this.stunUntil = this.t + C.STUN_DURATION;
    this.emit('stun');
  }
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd cocos && npx jest tests/GameState.test.ts -v`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/GameState.ts cocos/tests/GameState.test.ts
git commit -m "$(cat <<'EOF'
feat(state): applyExternalStun for animal hazard hits

EOF
)"
```

---

### Task 4: AnimalHazard 分档纯函数 + 骨架（TDD）

**Files:**
- Create: `cocos/assets/scripts/core/AnimalHazard.ts`
- Create: `cocos/assets/scripts/core/AnimalHazard.ts.meta`
- Create: `cocos/tests/AnimalHazard.test.ts`

- [ ] **Step 1: 写失败测试 `cocos/tests/AnimalHazard.test.ts`**

```ts
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
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/AnimalHazard.test.ts -v`

Expected: FAIL — cannot find module

- [ ] **Step 3: 实现 `AnimalHazard.ts`（本任务含分档 + spawn；运动/判定可先空壳）**

```ts
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
    if (tier <= 0) return;
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
```

- [ ] **Step 4: 写 meta `cocos/assets/scripts/core/AnimalHazard.ts.meta`**

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "a7c31e2b-4f90-4d6a-9b11-6e8d2c0f1a55",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

- [ ] **Step 5: 跑测**

Run: `cd cocos && npx jest tests/AnimalHazard.test.ts -v`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cocos/assets/scripts/core/AnimalHazard.ts \
  cocos/assets/scripts/core/AnimalHazard.ts.meta \
  cocos/tests/AnimalHazard.test.ts
git commit -m "$(cat <<'EOF'
feat(core): AnimalHazard tiers and deterministic spawn

EOF
)"
```

---

### Task 5: AnimalHazard 俯冲 / 撞飞 / 撞击（TDD）

**Files:**
- Modify: `cocos/assets/scripts/core/AnimalHazard.ts`
- Modify: `cocos/tests/AnimalHazard.test.ts`

- [ ] **Step 1: 追加失败用例到 `AnimalHazard.test.ts`**

```ts
describe('AnimalHazard combat', () => {
  function mkAnimal(h: AnimalHazard, over: Partial<import('../assets/scripts/core/AnimalHazard').Animal> = {}) {
    const a = {
      id: 1,
      kind: 'bird' as const,
      xPx: 55,
      yPx: 200,
      side: 1 as const,
      phase: 'dive' as const,
      age: 1,
      knockAge: 0,
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
});
```

> 上面 combat 块里若仍留有旧的 `const inp = { ..., coins: 30 }`，删掉，只保留 `coins: 19` 那份。

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/AnimalHazard.test.ts -v`

Expected: FAIL on combat cases

- [ ] **Step 3: 补全 `update` 与判定**

替换 `AnimalHazard.update` 及增加私有方法（保持 Task 4 的 spawn）：

```ts
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
        continue;
      }
      this.integrate(a, inp);
    }
  }
```

- [ ] **Step 4: 跑全测**

Run: `cd cocos && npx jest tests/AnimalHazard.test.ts -v`

Expected: PASS。若 knock 距离/坐标使 `canKnock` 达不到，微调测试里动物坐标（保持 `|bend|≥50` 且同侧、距 tip ≤70）。

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/AnimalHazard.ts cocos/tests/AnimalHazard.test.ts
git commit -m "$(cat <<'EOF'
feat(core): animal dive, knock, and hit resolution

EOF
)"
```

---

### Task 6: AudioFx + ParticleFx 掉币/撞飞反馈

**Files:**
- Modify: `cocos/assets/scripts/fx/AudioFx.ts`
- Modify: `cocos/assets/scripts/fx/ParticleFx.ts`

- [ ] **Step 1: `AudioFx` 追加方法**

```ts
  /** 掉币:下行短音,区别拾币上行五声。 */
  coinDrop(): void {
    this.tone(320, 0.12, 'triangle', 0.14, 0, -180);
    this.tone(180, 0.16, 'sine', 0.1, 0.04, -80);
  }

  /** 撞飞动物。 */
  animalKnock(): void {
    this.tone(420, 0.1, 'square', 0.1, 0, -200);
    this.tone(260, 0.14, 'triangle', 0.08, 0.03, -120);
  }
```

- [ ] **Step 2: `ParticleFx` 追加掉币喷泉（向下）**

在 `burst` 后追加：

```ts
  /** 动物撞击掉币:金点主要向下喷。 */
  coinDrop(worldPos: Vec3): void {
    for (let i = 0; i < 10; i++) {
      const p = this.obtain(this.dots, this.dotMesh, this.goldMat, 'drop');
      const a = rand(-Math.PI * 0.7, -Math.PI * 0.3);
      const sp = rand(50, 140);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = p.max = rand(0.45, 0.9);
      p.node.setPosition(worldPos);
      const sc = rand(0.8, 1.5);
      p.node.setScale(sc, sc, 1);
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/scripts/fx/AudioFx.ts cocos/assets/scripts/fx/ParticleFx.ts
git commit -m "$(cat <<'EOF'
feat(fx): coin-drop and animal-knock feedback

EOF
)"
```

---

### Task 7: AnimalView 表现层（占位体优先）

**Files:**
- Create: `cocos/assets/scripts/view/AnimalView.ts`
- Create: `cocos/assets/scripts/view/AnimalView.ts.meta`

- [ ] **Step 1: 实现 `AnimalView.ts`**

职责：持有 `hazard` 引用；为每只 alive 动物维护 Node；按 `xPx/yPx` 摆位置；`fadeIn` 用 scale 0→1；`knock` 时沿 `side` 方向抛物线飞出；`gone/despawn` 回收节点。模型缺失时用着色胶囊（按 kind 不同颜色）。**不**在 view 里做胜负判定。

```ts
import {
  _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3,
  utils, primitives, EffectAsset,
} from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { Animal, AnimalHazard, AnimalKind } from '../core/AnimalHazard';

const { ccclass } = _decorator;

const KIND_COLOR: Record<AnimalKind, Color> = {
  bird: new Color(90, 170, 220),
  cat: new Color(220, 160, 90),
  dog: new Color(180, 120, 70),
  rabbit: new Color(230, 220, 210),
};

interface Slot {
  animalId: number;
  node: Node;
  knockVx: number;
  knockVy: number;
  knockT: number;
}

@ccclass('AnimalView')
export class AnimalView extends Component {
  hazard: AnimalHazard | null = null;
  private effect: EffectAsset | null = null;
  private mesh!: Mesh;
  private mats = new Map<AnimalKind, Material>();
  private slots = new Map<number, Slot>();

  onLoad(): void {
    this.mesh = utils.createMesh(primitives.capsule(0.18, 0.12, 0.35));
  }

  initMaterials(effect: EffectAsset | null): void {
    this.effect = effect;
    (Object.keys(KIND_COLOR) as AnimalKind[]).forEach((k) => {
      const m = new Material();
      if (effect) m.initialize({ effectAsset: effect });
      else m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
      m.setProperty('mainColor', KIND_COLOR[k]);
      this.mats.set(k, m);
    });
  }

  bind(hazard: AnimalHazard): void {
    this.hazard = hazard;
    hazard.on('spawn', (a) => this.ensureSlot(a));
    hazard.on('knock', (a) => {
      const s = this.slots.get(a.id);
      if (!s) return;
      s.knockT = 0;
      s.knockVx = a.side * 220;
      s.knockVy = 160;
    });
    hazard.on('despawn', (a) => this.release(a.id));
  }

  private ensureSlot(a: Animal): Slot {
    let s = this.slots.get(a.id);
    if (s) return s;
    const node = new Node(`animal-${a.kind}-${a.id}`);
    this.node.addChild(node);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = this.mesh;
    mr.setMaterial(this.mats.get(a.kind)!, 0);
    s = { animalId: a.id, node, knockVx: 0, knockVy: 0, knockT: 0 };
    this.slots.set(a.id, s);
    return s;
  }

  private release(id: number): void {
    const s = this.slots.get(id);
    if (!s) return;
    s.node.destroy();
    this.slots.delete(id);
  }

  update(dt: number): void {
    const h = this.hazard;
    if (!h || !this.mats.size) return;
    for (const a of h.animals) {
      if (a.phase === 'gone') continue;
      const s = this.ensureSlot(a);
      if (a.phase === 'knock') {
        s.knockT += dt;
        const x = a.xPx + s.knockVx * s.knockT;
        const y = a.yPx + s.knockVy * s.knockT - 220 * s.knockT * s.knockT;
        s.node.setPosition(px2m(x), px2m(y), 0);
        s.node.eulerAngles = new Vec3(0, 0, s.knockT * a.side * 720);
        continue;
      }
      const fade = a.phase === 'fadeIn' ? Math.min(1, a.age / C.ANIMAL_FADE_IN_S) : 1;
      s.node.setScale(fade, fade, fade);
      s.node.setPosition(px2m(a.xPx), px2m(a.yPx), 0);
      s.node.eulerAngles = new Vec3(0, 0, a.side * -12);
    }
  }
}
```

- [ ] **Step 2: meta**

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "b8d42f3c-5a01-4e7b-8c22-7f9e3d1a2b66",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/scripts/view/AnimalView.ts \
  cocos/assets/scripts/view/AnimalView.ts.meta
git commit -m "$(cat <<'EOF'
feat(view): AnimalView placeholder capsules and knock arcs

EOF
)"
```

---

### Task 8: Bootstrap 接线

**Files:**
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: import 与字段**

在现有 import 区追加：

```ts
import { AnimalHazard } from './core/AnimalHazard';
import { AnimalView } from './view/AnimalView';
```

在类字段旁追加：

```ts
  private hazard = new AnimalHazard();
  private animals!: AnimalView;
```

- [ ] **Step 2: 在 `buildScene` 里 `coins.onPickup` 之前创建动物节点**

```ts
    const animalNode = new Node('Animals');
    this.node.scene!.addChild(animalNode);
    this.animals = animalNode.addComponent(AnimalView);
    this.animals.initMaterials(effect);
    this.animals.bind(this.hazard);

    this.hazard.on('knock', () => {
      this.audioFx.animalKnock();
    });
    this.hazard.on('hit', (a) => {
      this.state.applyExternalStun();
      const lost = this.score.loseCoins(C.ANIMAL_COIN_LOSS);
      console.log(`[animal] hit kind=${a.kind} lost=${lost} coins=${this.score.coins}`);
      this.audioFx.coinDrop();
      const p = this.panda.charPx;
      fx.coinDrop(new Vec3(px2m(p.x), px2m(p.y), 0));
      this.hud.refresh(this.state, this.score);
    });
```

注意：`fx` 变量须已存在（`ParticleFx`）；把动物创建与 hit 接线放在 `const fx = ...` **之后**。

- [ ] **Step 3: 在 `update` 里 `bend.update` 之后喂 hazard**

```ts
    this.bend.update(dt);
    if (this.bamboo) this.bamboo.bendOffsetPx = this.bend.offsetPx;
    const tipX = C.BAMBOO_X_PX - C.DESIGN_W / 2 + (this.bamboo?.swayPx ?? 0);
    const tipY = this.state.heightPx;
    const panda = this.panda.charPx;
    this.hazard.update({
      dt,
      t: this.state.t,
      started: this.state.started,
      stunned: this.state.stunned,
      coins: this.score.coins,
      tipX,
      tipY,
      pandaX: panda.x,
      pandaY: panda.y,
      bendOffset: this.bend.offsetPx,
    });
    this.rig.follow(this.state.heightPx, dt);
```

> `BambooMesh.update` 与 `AnimalView.update` 由引擎按组件调用；确保 hazard 在同帧用的是本帧已写入的 `bendOffsetPx`。若竹尖 sway 要等 `BambooMesh.update`，可把 hazard.update 挪到 `update` 末尾，并用上一帧 sway（可接受）或抽 `bamboo.computeSway()`；**首选：Bootstrap 末尾再调一次与 BambooMesh 相同的 compose**——更简单做法是读 `this.bamboo.swayPx`（组件 update 顺序不保证时，用 `bend.offsetPx` 近似 tip 横向： `tipX = BAMBOO_X_PX - DESIGN_W/2 + bend.offsetPx`，自动晃动误差可接受）。计划采用：

```ts
    const tipX = C.BAMBOO_X_PX - C.DESIGN_W / 2 + this.bend.offsetPx;
```

（主动出击主要看 bend 冲量，与判定一致。）

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/Bootstrap.ts
git commit -m "$(cat <<'EOF'
feat: wire AnimalHazard into Bootstrap loop

EOF
)"
```

---

### Task 9: 全量单测 + 手动验收清单

**Files:** 无新文件（可选在 README 特性表加一行，非必须）

- [ ] **Step 1: 跑全部 jest**

Run: `cd cocos && npm test`

Expected: 全部 PASS

- [ ] **Step 2: Cocos 预览手动清单**

1. 开局 coins&lt;20：无动物  
2. 拾币 ≥20：约 8–12s 内高空渐现俯冲（彩色胶囊）  
3. 动物在右侧时，点屏幕右侧弯竹且冲量够大 → 撞飞弧线 + knock 音  
4. 不挡 → 眩晕摇晃/星星 + coins 减少 + 掉币粒子/音；score 不减  
5. 眩晕期间动物冻结、不新刷  
6. 再攒到 ≥100：可同时最多 2 只  

- [ ] **Step 3: Commit（若有小修）或跳过**

若手动验收引出常量微调，改 `GameConfig` 后：

```bash
git add cocos/assets/scripts/core/GameConfig.ts
git commit -m "$(cat <<'EOF'
tune(config): animal hazard feel after playtest

EOF
)"
```

---

### Task 10（可选后续）: 低模 GLB 替换占位

**非阻塞验收。** 占位胶囊已满足逻辑与手感验收。

**Files:**
- Add: `cocos/assets/models/animals/{bird,cat,dog,rabbit}.glb`（及 meta）
- Modify: `cocos/assets/scripts/view/AnimalView.ts`（按 kind `bundle.load`，失败保留胶囊）
- Modify: `ASSETS.md`

步骤：从 CC0/可商用源取低模 → Blender 减面/≤512 贴图 → GLB → `models` bundle → 加载模式对齐 `PandaView` → 署名写入 `ASSETS.md`。

单独 PR 即可，不挡本计划合并。

---

## Self-Review（计划作者已核）

| Spec 要求 | 对应 Task |
|---|---|
| 分档 20/50/100、种类、maxAlive | T1 + T4 |
| 高空 fadeIn + 俯冲 | T5 integrate + T7 |
| 撞飞：冲量+同侧+半径 | T5 canKnock |
| 撞击：眩晕+扣币+FX | T3 + T2 + T6 + T8 |
| score 不回退 | T2 |
| 眩晕期冻结/不刷 | T4/T5 |
| 同帧 knock 优先 | T5 |
| Jest core 覆盖 | T2–T5、T9 |
| 模型降级 | T7 胶囊；T10 可选 GLB |
| 不改节奏/弯竹 API | 全程未改 RhythmJudge / BendController 接口 |

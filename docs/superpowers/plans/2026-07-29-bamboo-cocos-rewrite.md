# 节节高 Cocos Creator 2.5D 重写 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Cocos Creator 3.8.6 + TypeScript 将原型(纯 Canvas 2D)1:1 重写为 2.5D 微信小游戏。

**Architecture:** 单场景,Bootstrap 组件在运行时构建全部节点(相机/光/竹/小熊猫/金币/UI)。core 层(GameState/RhythmJudge/Sway/ScoreSystem)零 Cocos 依赖,jest 单测;view 层订阅 core 事件。竹干程序化生成,小熊猫等模型用免费 GLB(Task 16 接入)。

**Tech Stack:** Cocos Creator 3.8.6 · TypeScript · jest + ts-jest(core 层)· 微信开发者工具

**Spec:** `docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md`

**前置条件(用户手动,一次性):** 安装 Cocos Dashboard + Cocos Creator **3.8.6**(https://www.cocos.com/creator-download)。代码任务无需编辑器;标注 **MANUAL GATE** 的步骤需要用户在编辑器/微信开发者工具里操作。

**工作分支:** `feature/cocos-rewrite`

**目录约定:**

```
bamboo-game/
├── index.html / game.js / style.css / README.md   # 原型,保留不动
└── cocos/                                          # Cocos Creator 工程根
    ├── package.json / tsconfig.json / tsconfig.jest.json / jest.config.js
    ├── settings/v2/packages/project.json
    ├── assets/
    │   ├── scripts/core/      # 无 Cocos 依赖,jest 覆盖
    │   ├── scripts/platform/  # wx/localStorage/输入适配
    │   ├── scripts/view/      # 3D 表现
    │   ├── scripts/fx/        # 粒子/音效
    │   ├── scripts/ui/        # HUD
    │   ├── scripts/Bootstrap.ts
    │   └── models/            # GLB(Task 16 填充,编辑器里设为 bundle)
    └── tests/                 # jest 测试
```

**px↔m 约定:** 50px = 1m(1m = 1 Cocos 单位)。玩法逻辑全部在 px 空间(照搬原型公式),渲染时转 m。

---

### Task 1: 工程脚手架 + jest 管线

**Files:**
- Modify: `.gitignore`
- Create: `cocos/package.json`
- Create: `cocos/tsconfig.json`
- Create: `cocos/tsconfig.jest.json`
- Create: `cocos/jest.config.js`
- Create: `cocos/settings/v2/packages/project.json`
- Create: `cocos/tests/sanity.test.ts`

- [ ] **Step 1: 更新 `.gitignore`,追加:**

```
# Cocos Creator
cocos/library/
cocos/temp/
cocos/build/
cocos/profiles/
cocos/local/
cocos/node_modules/
```

- [ ] **Step 2: 创建 `cocos/package.json`**

`uuid` 字段是 Cocos 工程标识,使用固定值勿改。npm 字段与 Cocos 字段共存无冲突。

```json
{
  "name": "bamboo-game",
  "uuid": "b4b00000-5e9a-4c1d-8f00-ba6b00000001",
  "version": "1.0.0",
  "type": "3d",
  "creator": { "version": "3.8.6" },
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "typescript": "~5.4.5"
  }
}
```

- [ ] **Step 3: 创建 `cocos/tsconfig.json`(编辑器用)**

```json
{
  "compilerOptions": {
    "target": "ES2015",
    "module": "ES2015",
    "moduleResolution": "node",
    "lib": ["ES2015", "DOM"],
    "strict": false,
    "experimentalDecorators": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "jsx": "preserve",
    "types": []
  },
  "include": ["assets/**/*.ts"]
}
```

- [ ] **Step 4: 创建 `cocos/tsconfig.jest.json`(jest 用,strict)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["jest", "node"]
  },
  "include": [
    "assets/scripts/core/**/*.ts",
    "assets/scripts/platform/Storage.ts",
    "tests/**/*.ts"
  ]
}
```

- [ ] **Step 5: 创建 `cocos/jest.config.js`**

```js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] },
};
```

- [ ] **Step 6: 创建 `cocos/settings/v2/packages/project.json`(设计分辨率 800x600,FIT_HEIGHT)**

```json
{
  "general": {
    "designResolution": {
      "width": 800,
      "height": 600,
      "fitWidth": false,
      "fitHeight": true
    }
  }
}
```

- [ ] **Step 7: 创建 `cocos/tests/sanity.test.ts`**

```ts
describe('sanity', () => {
  it('jest pipeline works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: 安装依赖并跑通**

Run: `cd cocos && npm install && npx jest`
Expected: `1 passed`(sanity)

- [ ] **Step 9: Commit**

```bash
git add .gitignore cocos/
git commit -m "chore: scaffold Cocos Creator project with jest pipeline"
```

---

### Task 2: GameConfig(全部玩法数值)

**Files:**
- Create: `cocos/assets/scripts/core/GameConfig.ts`
- Test: `cocos/tests/GameConfig.test.ts`

- [ ] **Step 1: 写测试 `cocos/tests/GameConfig.test.ts`**

数值锁定 spec,防手滑改坏。

```ts
import { GameConfig, px2m } from '../assets/scripts/core/GameConfig';

describe('GameConfig', () => {
  it('locks spec gameplay values', () => {
    expect(GameConfig.PX_PER_M).toBe(50);
    expect(GameConfig.MIN_GAP).toBeCloseTo(0.12);
    expect(GameConfig.GOOD_GAP).toBeCloseTo(0.55);
    expect(GameConfig.COMBO_MAX).toBe(12);
    expect(GameConfig.STUN_DURATION).toBeCloseTo(0.9);
    expect(GameConfig.BASE_GAIN_PX).toBe(26);
    expect(GameConfig.COMBO_GAIN_FACTOR).toBeCloseTo(0.09);
    expect(GameConfig.COIN_MULT_STEP).toBe(4);
    expect(GameConfig.MAGNET_RADIUS_PX).toBe(95);
    expect(GameConfig.PICKUP_RADIUS_PX).toBe(40);
    expect(GameConfig.SEG_LEN_PX).toBe(46);
    expect(GameConfig.SWAY_MAX_PX).toBe(44);
  });

  it('px2m converts at 50px per meter', () => {
    expect(px2m(50)).toBe(1);
    expect(px2m(46)).toBeCloseTo(0.92);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest GameConfig`
Expected: FAIL — `Cannot find module '../assets/scripts/core/GameConfig'`

- [ ] **Step 3: 实现 `cocos/assets/scripts/core/GameConfig.ts`**

```ts
/** 全部玩法数值 —— 照搬原型(game.js),改动须同步更新 spec。 */
export const GameConfig = {
  PX_PER_M: 50,
  DESIGN_W: 800,
  DESIGN_H: 600,
  GROUND_PAD_PX: 80,

  /** 竹子水平位置(屏幕坐标,原型 BAMBOO_X = 0.42 * 800) */
  BAMBOO_X_PX: 336,
  SEG_LEN_PX: 46,
  CHAR_OFFSET_PX: 26,

  MIN_GAP: 0.12,
  GOOD_GAP: 0.55,
  COMBO_MAX: 12,
  STUN_DURATION: 0.9,
  BASE_GAIN_PX: 26,
  COMBO_GAIN_FACTOR: 0.09,

  COIN_MULT_STEP: 4,
  MAGNET_RADIUS_PX: 95,
  PICKUP_RADIUS_PX: 40,
  COIN_SPAWN_INTERVAL: 0.7,
  COIN_MAX_ALIVE: 30,

  SWAY_MAX_PX: 44,

  /** 相机与竹面距离:fov30 垂直 → 可视高 12m ↔ 600px @50px/m */
  CAMERA_DISTANCE_M: 22.4,
} as const;

export const px2m = (px: number): number => px / GameConfig.PX_PER_M;
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos && npx jest GameConfig`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/GameConfig.ts cocos/tests/GameConfig.test.ts
git commit -m "feat(core): add GameConfig with spec-locked gameplay values"
```

---

### Task 3: RhythmJudge(节奏判定纯函数)

**Files:**
- Create: `cocos/assets/scripts/core/RhythmJudge.ts`
- Test: `cocos/tests/RhythmJudge.test.ts`

- [ ] **Step 1: 写测试 `cocos/tests/RhythmJudge.test.ts`**

```ts
import { judgePress } from '../assets/scripts/core/RhythmJudge';

describe('judgePress', () => {
  it('stuns when gap < 0.12s', () => {
    const r = judgePress(0.11, 5);
    expect(r.stunned).toBe(true);
    expect(r.combo).toBe(0);
    expect(r.gainPx).toBe(0);
  });

  it('does not stun at exactly 0.12s', () => {
    expect(judgePress(0.12, 3).stunned).toBe(false);
  });

  it('increments combo within the good window', () => {
    const r = judgePress(0.3, 4);
    expect(r).toEqual({ stunned: false, combo: 5, gainPx: 26 * (1 + 5 * 0.09) });
  });

  it('caps combo at 12', () => {
    expect(judgePress(0.3, 12).combo).toBe(12);
  });

  it('resets combo to 1 when gap > 0.55s', () => {
    const r = judgePress(0.56, 8);
    expect(r.combo).toBe(1);
    expect(r.stunned).toBe(false);
  });

  it('first-ever press (Infinity gap) starts combo at 1', () => {
    expect(judgePress(Infinity, 0).combo).toBe(1);
  });

  it('gain uses the NEW combo value', () => {
    // combo 1 → 26 * 1.09
    expect(judgePress(0.56, 0).gainPx).toBeCloseTo(26 * 1.09);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest RhythmJudge`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 `cocos/assets/scripts/core/RhythmJudge.ts`**

```ts
import { GameConfig as C } from './GameConfig';

export interface JudgeResult {
  stunned: boolean;
  /** 本次按键后的连击数 */
  combo: number;
  /** 本次生长量(px),眩晕为 0 */
  gainPx: number;
}

/** 节奏判定:照搬原型 —— 过急眩晕,过慢断连击重新计,正常连击+1(上限 12)。 */
export function judgePress(gapSec: number, prevCombo: number): JudgeResult {
  if (gapSec < C.MIN_GAP) {
    return { stunned: true, combo: 0, gainPx: 0 };
  }
  const combo = gapSec > C.GOOD_GAP ? 1 : Math.min(prevCombo + 1, C.COMBO_MAX);
  const gainPx = C.BASE_GAIN_PX * (1 + combo * C.COMBO_GAIN_FACTOR);
  return { stunned: false, combo, gainPx };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos && npx jest RhythmJudge`
Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/RhythmJudge.ts cocos/tests/RhythmJudge.test.ts
git commit -m "feat(core): add RhythmJudge with prototype rhythm rules"
```

---

### Task 4: Sway(竹尖摆动纯函数)

**Files:**
- Create: `cocos/assets/scripts/core/Sway.ts`
- Test: `cocos/tests/Sway.test.ts`

- [ ] **Step 1: 写测试 `cocos/tests/Sway.test.ts`**

```ts
import { tipSwayPx } from '../assets/scripts/core/Sway';

describe('tipSwayPx', () => {
  it('is 0 at t=0 with no growth pull', () => {
    expect(tipSwayPx(0, 500, 500, false)).toBe(0);
  });

  it('is 0 for a near-zero bamboo', () => {
    expect(tipSwayPx(3, 0.5, 0.5, false)).toBe(0);
  });

  it('never exceeds ±44px', () => {
    for (let t = 0; t < 60; t += 0.037) {
      expect(Math.abs(tipSwayPx(t, 2000, 2300, true))).toBeLessThanOrEqual(44);
    }
  });

  it('pulls toward growth while easing (target above height → positive pull)', () => {
    // sin(t*1.6) 在 t=0 为 0,此时只剩 growPull
    expect(tipSwayPx(0, 100, 500, false)).toBeCloseTo(18); // clamp((400)*0.06, -18, 18) = 18
  });

  it('stun adds high-frequency wobble but stays clamped', () => {
    const calm = Math.abs(tipSwayPx(1.7, 300, 300, false));
    const dizzy = Math.abs(tipSwayPx(1.7, 300, 300, true));
    expect(dizzy).toBeLessThanOrEqual(44);
    expect(calm).toBeLessThanOrEqual(44);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest Sway`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 `cocos/assets/scripts/core/Sway.ts`**

```ts
import { GameConfig as C } from './GameConfig';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 竹尖摆动(px)—— 原型公式直译:基础摆动 + 生长拉扯 + 眩晕抖动,钳制 ±44。 */
export function tipSwayPx(tSec: number, heightPx: number, targetHeightPx: number, stunned: boolean): number {
  if (heightPx < 1) return 0;
  const growPull = clamp((targetHeightPx - heightPx) * 0.06, -18, 18);
  const baseAmp = 14 + Math.min(heightPx / 300, 1) * 10;
  const dizzyWob = stunned ? Math.sin(tSec * 22) * 10 : 0;
  return clamp(Math.sin(tSec * 1.6) * baseAmp + growPull + dizzyWob, -C.SWAY_MAX_PX, C.SWAY_MAX_PX);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos && npx jest Sway`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/Sway.ts cocos/tests/Sway.test.ts
git commit -m "feat(core): add tip sway formula ported from prototype"
```

---

### Task 5: GameState(状态机 + 事件)

**Files:**
- Create: `cocos/assets/scripts/core/GameState.ts`
- Test: `cocos/tests/GameState.test.ts`

- [ ] **Step 1: 写测试 `cocos/tests/GameState.test.ts`**

```ts
import { GameState } from '../assets/scripts/core/GameState';

function makeStarted(): GameState {
  const s = new GameState();
  s.press(); // first press = start
  return s;
}

describe('GameState', () => {
  it('first press only starts the game, no growth', () => {
    const s = new GameState();
    let started = 0;
    s.on('start', () => started++);
    expect(s.press()).toBeNull();
    expect(s.started).toBe(true);
    expect(started).toBe(1);
    expect(s.targetHeightPx).toBe(0);
  });

  it('grows with combo on rhythmic presses', () => {
    const s = makeStarted();
    s.update(0.3);
    const r = s.press()!;
    expect(r.combo).toBe(1);
    expect(s.targetHeightPx).toBeCloseTo(26 * 1.09);
    s.update(0.3);
    s.press();
    expect(s.combo).toBe(2);
    expect(s.maxCombo).toBe(2);
  });

  it('stuns on mashing, clears combo, ignores presses while stunned', () => {
    const s = makeStarted();
    s.update(0.3); s.press();
    s.update(0.3); s.press();
    expect(s.combo).toBe(2);
    s.update(0.05); // 0.05s gap < 0.12 → stun
    let stunned = 0;
    s.on('stun', () => stunned++);
    s.press();
    expect(stunned).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.stunned).toBe(true);
    expect(s.press()).toBeNull(); // ignored during stun
    s.update(0.95);
    expect(s.stunned).toBe(false);
  });

  it('breaks combo on slow press and emits comboBreak', () => {
    const s = makeStarted();
    s.update(0.3); s.press(); s.update(0.3); s.press();
    expect(s.combo).toBe(2);
    let broken = 0;
    s.on('comboBreak', () => broken++);
    s.update(0.6);
    const r = s.press()!;
    expect(broken).toBe(1);
    expect(r.combo).toBe(1);
  });

  it('eases height toward target', () => {
    const s = makeStarted();
    s.update(0.3); s.press();
    const target = s.targetHeightPx;
    for (let i = 0; i < 200; i++) s.update(1 / 60);
    expect(s.heightPx).toBeGreaterThan(target * 0.99);
    expect(s.heightPx).toBeLessThanOrEqual(target);
  });

  it('emits grow on every valid press', () => {
    const s = makeStarted();
    let grows = 0;
    s.on('grow', () => grows++);
    s.update(0.3); s.press();
    s.update(0.3); s.press();
    expect(grows).toBe(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest GameState`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 `cocos/assets/scripts/core/GameState.ts`**

```ts
import { GameConfig as C } from './GameConfig';
import { judgePress, JudgeResult } from './RhythmJudge';

export type GameEvent = 'start' | 'grow' | 'stun' | 'comboBreak';
type Handler = () => void;

/** 游戏状态机 —— 唯一事实源。零渲染依赖,view 层订阅事件。 */
export class GameState {
  started = false;
  t = 0;
  heightPx = 0;
  targetHeightPx = 0;
  combo = 0;
  maxCombo = 0;
  stunUntil = 0;
  private lastPressAt = -Infinity;
  private handlers = new Map<GameEvent, Handler[]>();

  on(ev: GameEvent, fn: Handler): void {
    const list = this.handlers.get(ev) ?? [];
    list.push(fn);
    this.handlers.set(ev, list);
  }

  private emit(ev: GameEvent): void {
    for (const fn of this.handlers.get(ev) ?? []) fn();
  }

  get stunned(): boolean {
    return this.t < this.stunUntil;
  }

  /**
   * 按键入口。首次按键 = 开始游戏(返回 null);
   * 眩晕期间按键无效(返回 null);否则返回判定结果。
   */
  press(): JudgeResult | null {
    if (!this.started) {
      this.started = true;
      this.emit('start');
      return null;
    }
    if (this.stunned) return null;
    const gap = this.t - this.lastPressAt;
    this.lastPressAt = this.t;
    const r = judgePress(gap, this.combo);
    if (r.stunned) {
      this.combo = 0;
      this.stunUntil = this.t + C.STUN_DURATION;
      this.emit('stun');
      return r;
    }
    if (gap > C.GOOD_GAP && this.combo > 0) this.emit('comboBreak');
    this.combo = r.combo;
    if (r.combo > this.maxCombo) this.maxCombo = r.combo;
    this.targetHeightPx += r.gainPx;
    this.emit('grow');
    return r;
  }

  update(dt: number): void {
    this.t += dt;
    const k = Math.min(1, dt * 3.2); // 原型缓动系数
    this.heightPx += (this.targetHeightPx - this.heightPx) * k;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos && npx jest GameState`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/GameState.ts cocos/tests/GameState.test.ts
git commit -m "feat(core): add GameState machine with event emission"
```

---

### Task 6: Storage 适配层 + ScoreSystem

**Files:**
- Create: `cocos/assets/scripts/platform/Storage.ts`
- Create: `cocos/assets/scripts/core/ScoreSystem.ts`
- Test: `cocos/tests/Storage.test.ts`
- Test: `cocos/tests/ScoreSystem.test.ts`

- [ ] **Step 1: 写测试 `cocos/tests/Storage.test.ts`**

```ts
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
```

- [ ] **Step 2: 写测试 `cocos/tests/ScoreSystem.test.ts`**

```ts
import { ScoreSystem } from '../assets/scripts/core/ScoreSystem';
import { Storage } from '../assets/scripts/platform/Storage';

function freshStorage(): Storage {
  return new Storage(); // node: 无后端,get → null
}

describe('ScoreSystem', () => {
  it('starts empty with best 0 on blank storage', () => {
    const s = new ScoreSystem(freshStorage());
    expect(s.coins).toBe(0);
    expect(s.score).toBe(0);
    expect(s.bestMeters).toBe(0);
  });

  it('pickup pays 1 + floor(combo/4)', () => {
    const s = new ScoreSystem(freshStorage());
    expect(s.pickup(0)).toBe(1);
    expect(s.pickup(3)).toBe(1);
    expect(s.pickup(4)).toBe(2);
    expect(s.pickup(12)).toBe(4);
    expect(s.coins).toBe(4);
    expect(s.score).toBe(8);
  });

  it('corrupted best falls back to 0', () => {
    jest.spyOn(Storage.prototype, 'get').mockReturnValue('not-a-number');
    expect(new ScoreSystem(freshStorage()).bestMeters).toBe(0);
    jest.restoreAllMocks();
  });

  it('updateBest only writes when beaten', () => {
    const writes: string[] = [];
    jest.spyOn(Storage.prototype, 'set').mockImplementation((_k, v) => { writes.push(v); });
    const s = new ScoreSystem(freshStorage());
    expect(s.updateBest(500)).toBe(true);   // 10m
    expect(s.updateBest(400)).toBe(false);  // 8m 不更新
    expect(s.updateBest(750)).toBe(true);   // 15m
    expect(writes).toEqual(['10', '15']);
    jest.restoreAllMocks();
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd cocos && npx jest Storage ScoreSystem`
Expected: FAIL — modules not found

- [ ] **Step 4: 实现 `cocos/assets/scripts/platform/Storage.ts`**

```ts
declare const wx:
  | { getStorageSync(key: string): unknown; setStorageSync(key: string, value: string): void }
  | undefined;

/** wx.setStorageSync / localStorage 适配。任何后端异常都吞掉 —— 坏环境不崩游戏。 */
export class Storage {
  get(key: string): string | null {
    try {
      if (typeof wx !== 'undefined' && wx && wx.getStorageSync) {
        const v = wx.getStorageSync(key);
        return v === '' || v == null ? null : String(v);
      }
      const ls = (globalThis as { localStorage?: { getItem(k: string): string | null } }).localStorage;
      return ls ? ls.getItem(key) : null;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      if (typeof wx !== 'undefined' && wx && wx.setStorageSync) {
        wx.setStorageSync(key, value);
        return;
      }
      const ls = (globalThis as { localStorage?: { setItem(k: string, v: string): void } }).localStorage;
      if (ls) ls.setItem(key, value);
    } catch {
      // 存储被拒/满 —— 最高分不持久化而已
    }
  }
}
```

- [ ] **Step 5: 实现 `cocos/assets/scripts/core/ScoreSystem.ts`**

```ts
import { GameConfig as C } from './GameConfig';
import { Storage } from '../platform/Storage';

const BEST_KEY = 'bamboo_best'; // 与原型 localStorage key 一致

export class ScoreSystem {
  coins = 0;
  score = 0;
  bestMeters: number;

  constructor(private storage: Storage) {
    const v = parseFloat(this.storage.get(BEST_KEY) ?? '0');
    this.bestMeters = Number.isFinite(v) && v >= 0 ? v : 0;
  }

  /** 拾取一枚金币,返回本次倍率。 */
  pickup(combo: number): number {
    const mult = 1 + Math.floor(combo / C.COIN_MULT_STEP);
    this.coins++;
    this.score += mult;
    return mult;
  }

  /** 高度破纪录时写入,返回是否破了纪录。 */
  updateBest(heightPx: number): boolean {
    const m = heightPx / C.PX_PER_M;
    if (m > this.bestMeters) {
      this.bestMeters = m;
      this.storage.set(BEST_KEY, String(m));
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 6: 跑全部测试确认通过**

Run: `cd cocos && npx jest`
Expected: 全部通过(sanity 1 + GameConfig 2 + RhythmJudge 7 + Sway 5 + GameState 6 + Storage 4 + ScoreSystem 4 = 29 passed)

- [ ] **Step 7: Commit**

```bash
git add cocos/assets/scripts/platform/Storage.ts cocos/assets/scripts/core/ScoreSystem.ts cocos/tests/Storage.test.ts cocos/tests/ScoreSystem.test.ts
git commit -m "feat(core): add Storage adapter and ScoreSystem with best persistence"
```

---

### Task 7: MANUAL GATE —— 安装编辑器,打开工程,建启动场景

编辑器在本机不存在,无法自动化。以下用户操作,约 15 分钟。

- [ ] **Step 1: 安装 Cocos Dashboard + Creator 3.8.6**

下载 https://www.cocos.com/creator-download → Dashboard → 编辑器 → 安装 **3.8.6**(版本不符时选最接近的 3.8.x)。

- [ ] **Step 2: 打开工程**

Dashboard → 导入 → 选择 `cocos/` 目录 → 打开。编辑器首次扫描会生成 `library/`、`temp/` 和全部 `.meta`(已被 .gitignore 排除)。
预期:资源管理器看到 `assets/scripts/**`,控制台无红色报错。若有 TS 报错,检查 `assets/scripts` 下是否有非本计划文件。

- [ ] **Step 3: 建启动场景**

1. 资源管理器右键 `assets` → 新建 → Scene → 命名 `main`(得到 `assets/main.scene`)
2. 双击打开,层级管理器右键根节点 → 创建空节点 → 命名 `Bootstrap`
3. 挂脚本这一步**等 Task 8 建好 `Bootstrap.ts` 再做**(Task 8 Step 4 会提醒):把 `assets/scripts/Bootstrap.ts` 拖到 `Bootstrap` 节点上
4. 保存场景(Cmd+S)
5. 项目 → 项目设置 → 项目预览 → 初始场景选 `main`

- [ ] **Step 4: Commit(`.meta` 已被忽略,通常无改动;若编辑器改动了受跟踪文件则提交)**

```bash
git status --short
# 有改动时:
git add -A && git commit -m "chore: editor first-open metadata"
```

---

### Task 8: Bootstrap + InputAdapter(最小可运行:相机/光/输入)

**Files:**
- Create: `cocos/assets/scripts/platform/InputAdapter.ts`
- Create: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: 实现 `cocos/assets/scripts/platform/InputAdapter.ts`**

空格与触摸点按统一为一个回调。

```ts
import { input, Input, EventKeyboard, EventTouch, KeyCode } from 'cc';

/** 键盘空格 / 触摸点按 → 统一的 press 回调。 */
export class InputAdapter {
  constructor(private onPress: () => void) {}

  attach(): void {
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
  }

  detach(): void {
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
  }

  private keyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) this.onPress();
  }

  private touchStart(_e: EventTouch): void {
    this.onPress();
  }
}
```

- [ ] **Step 2: 实现 `cocos/assets/scripts/Bootstrap.ts`(本任务为最小版,后续任务逐步扩展)**

```ts
import { _decorator, Component, Node, Camera, DirectionalLight, Color, Vec3, view, ResolutionPolicy } from 'cc';
import { GameState } from './core/GameState';
import { InputAdapter } from './platform/InputAdapter';

const { ccclass } = _decorator;

/** 运行时构建全部节点 —— 场景里只需一个挂本脚本的空节点。 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  protected state = new GameState();
  protected cam!: Camera;

  start(): void {
    view.setDesignResolutionSize(800, 600, ResolutionPolicy.FIT_HEIGHT);

    const lightNode = new Node('Sun');
    this.node.scene!.addChild(lightNode);
    lightNode.addComponent(DirectionalLight);
    lightNode.eulerAngles = new Vec3(-50, -30, 0);

    const camNode = new Node('Camera3D');
    this.node.scene!.addChild(camNode);
    this.cam = camNode.addComponent(Camera);
    this.cam.projection = Camera.ProjectionType.PERSPECTIVE;
    this.cam.fov = 30;
    this.cam.near = 0.5;
    this.cam.far = 300;
    this.cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    this.cam.clearColor = new Color(88, 176, 240, 255);
    camNode.setPosition(-1.28, 4.4, 22.4);

    new InputAdapter(() => {
      const r = this.state.press();
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned}`);
      else console.log('[press] start/ignored');
    }).attach();
  }

  update(dt: number): void {
    this.state.update(Math.min(dt, 0.05));
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/scripts/platform/InputAdapter.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat: add Bootstrap (runtime scene build) and InputAdapter"
```

- [ ] **Step 4: MANUAL GATE —— 完成 Task 7 Step 3 的拖脚本,点编辑器「预览」**

预期:浏览器打开,天空蓝纯色;按空格,控制台依次打印 `[press] start/ignored` → `[press] combo=1 ...`;连按两次 <0.12s 打印 `stunned=true`。
不符合则查编辑器控制台报错,修复后再进 Task 9。

---

### Task 9: CameraRig + BambooMesh(程序化竹干,核心表现)

**Files:**
- Create: `cocos/assets/scripts/view/CameraRig.ts`
- Create: `cocos/assets/scripts/view/BambooMesh.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: 实现 `cocos/assets/scripts/view/CameraRig.ts`**

原型相机:角色保持在屏幕约 55% 高度处,竹子位于屏宽 42%。

```ts
import { _decorator, Component, Camera } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';

const { ccclass } = _decorator;

@ccclass('CameraRig')
export class CameraRig extends Component {
  cam: Camera | null = null;
  private camYpx = 0;
  private shakePx = 0;

  get camYPx(): number {
    return this.camYpx;
  }

  /** 眩晕震屏(原型 shake=14px,每秒 -30 衰减,约 0.47s) */
  kick(px: number): void {
    this.shakePx = px;
  }

  /** 相机中心的 world x(竹子左偏 0.08 屏宽) */
  get camX(): number {
    return px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2) + 0.08 * this.visibleWidthPx() / C.PX_PER_M;
  }

  visibleWidthPx(): number {
    const d = C.CAMERA_DISTANCE_M;
    const visibleH = 2 * d * Math.tan((30 / 2) * Math.PI / 180); // ≈12m
    const aspect = this.cam ? this.cam.camera.aspect : C.DESIGN_W / C.DESIGN_H;
    return visibleH * aspect * C.PX_PER_M;
  }

  follow(heightPx: number, dt: number): void {
    const anchor = heightPx - C.DESIGN_H * 0.55;
    this.camYpx = Math.max(0, this.camYpx + (anchor - this.camYpx) * Math.min(1, dt * 4));
    this.shakePx = Math.max(0, this.shakePx - dt * 30);
    const sx = (Math.random() * 2 - 1) * this.shakePx * 0.4;
    const sy = (Math.random() * 2 - 1) * this.shakePx * 0.4;
    // 原型:屏幕中心(300px) ↔ world camY + 220px
    this.node.setPosition(this.camX + px2m(sx), px2m(this.camYpx + 220 + sy), C.CAMERA_DISTANCE_M);
  }
}
```

- [ ] **Step 2: 实现 `cocos/assets/scripts/view/BambooMesh.ts`**

分段圆柱实例池,二次弯曲(原型公式),逐段锥度 16→7px,底部微张作竹节;眩晕时黄绿闪烁。
竹节表现用「底部半径 0.56 > 顶部 0.5」的接缝微张代替独立环几何 —— 低多边形风格下视觉等价,省一半节点。

```ts
import { _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3, utils, primitives } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { tipSwayPx } from '../core/Sway';
import { GameState } from '../core/GameState';

const { ccclass } = _decorator;
const SEG_M = C.SEG_LEN_PX / C.PX_PER_M; // 0.92

@ccclass('BambooMesh')
export class BambooMesh extends Component {
  state: GameState | null = null;
  swayPx = 0;

  private cyl: Mesh | null = null;
  private segs: Node[] = [];
  private matA!: Material;
  private matB!: Material;
  private matDizzy!: Material;

  onLoad(): void {
    // 半径:顶 0.5 / 底 0.56 → 段底微张,接缝处读出竹节感
    this.cyl = utils.createMesh(primitives.cylinder(0.5, 0.56, SEG_M, { radialSegments: 8 }));
    this.matA = this.makeMat(new Color(96, 168, 84));
    this.matB = this.makeMat(new Color(130, 190, 110));
    this.matDizzy = this.makeMat(new Color(201, 209, 107));
  }

  private makeMat(c: Color): Material {
    const m = new Material();
    m.initialize({ effectName: 'builtin-standard' });
    m.setProperty('mainColor', c);
    return m;
  }

  private ensureSegments(n: number): void {
    while (this.segs.length < n) {
      const node = new Node(`seg${this.segs.length}`);
      this.node.addChild(node);
      const mr = node.addComponent(MeshRenderer);
      mr.mesh = this.cyl;
      mr.setMaterial(this.matA, 0);
      this.segs.push(node);
    }
  }

  update(_dt: number): void {
    const s = this.state;
    if (!s) return;
    this.swayPx = tipSwayPx(s.t, s.heightPx, s.targetHeightPx, s.stunned);
    const h = s.heightPx;
    if (h < 4) {
      for (const seg of this.segs) seg.active = false;
      return;
    }
    const n = Math.ceil(h / C.SEG_LEN_PX);
    this.ensureSegments(n);
    const bend = this.swayPx * 300 / (h * h); // 原型弯曲系数(px 空间)
    const dizzyFlash = s.stunned && Math.floor(s.t * 10) % 2 === 1;
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i];
      if (i >= n) { seg.active = false; continue; }
      seg.active = true;
      const y0 = i * C.SEG_LEN_PX;
      const yMid = y0 + C.SEG_LEN_PX / 2;
      const diaPx = 16 + (7 - 16) * (yMid / h);            // 锥度 16→7px
      const fracY = Math.min(1, (h - y0) / C.SEG_LEN_PX);  // 顶端不足一段时压扁
      seg.setScale(px2m(diaPx), fracY, px2m(diaPx));
      seg.setPosition(px2m(bend * yMid * yMid / 300), px2m(y0 + (C.SEG_LEN_PX * fracY) / 2), 0);
      const slope = 2 * bend * yMid / 300;                 // dx/dy
      seg.eulerAngles = new Vec3(0, 0, -Math.atan(slope) * 180 / Math.PI);
      seg.getComponent(MeshRenderer)!.setMaterial(dizzyFlash ? this.matDizzy : (i % 2 ? this.matB : this.matA), 0);
    }
  }
}
```

- [ ] **Step 3: 修改 `Bootstrap.ts` 接入**

`start()` 相机段之后追加(替换原来 `camNode.setPosition(...)` 那一行,位置由 rig 接管):

```ts
    this.rig = camNode.addComponent(CameraRig);
    this.rig.cam = this.cam;

    const bambooRoot = new Node('BambooRoot');
    this.node.scene!.addChild(bambooRoot);
    bambooRoot.setPosition(px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2), 0, 0);
    this.bamboo = bambooRoot.addComponent(BambooMesh);
    this.bamboo.state = this.state;
```

类字段追加:`protected rig!: CameraRig; protected bamboo!: BambooMesh;`
import 追加:`CameraRig`、`BambooMesh`、`GameConfig as C`、`px2m`。
震屏接线(`start()` 末尾追加):`this.state.on('stun', () => this.rig.kick(14));`
`update()` 改为:

```ts
  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.state.update(dt);
    this.rig.follow(this.state.heightPx, dt);
  }
```

- [ ] **Step 4: 单测回归 + Commit**

Run: `cd cocos && npx jest`
Expected: 29 passed(view 层不被 jest 覆盖,确认 core 无回归)

```bash
git add cocos/assets/scripts/view/ cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(view): procedural bamboo with bend/sway + camera follow rig"
```

- [ ] **Step 5: MANUAL GATE —— 预览验证**

预期:按空格竹子逐段长出、带锥度和竹节、顶端弯曲摆动;连按眩晕时竹子闪黄绿色;相机随生长上移,地面渐出视野。

---

### Task 10: PandaView(占位胶囊体,随竹摆动/眩晕摇晃)

**Files:**
- Create: `cocos/assets/scripts/view/PandaView.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

真模型 Task 16 替换,本任务先把挂接逻辑(位置比例/回弹/眩晕)做对 —— 原型:小人贴竹身 `height-26px` 处,横向偏移 = `tipSway * ratio²`。

- [ ] **Step 1: 实现 `cocos/assets/scripts/view/PandaView.ts`**

```ts
import { _decorator, Component, MeshRenderer, Material, Color, Vec3, utils, primitives } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { BambooMesh } from './BambooMesh';

const { ccclass } = _decorator;

@ccclass('PandaView')
export class PandaView extends Component {
  bamboo: BambooMesh | null = null;
  private state: GameState | null = null;
  private flash = 0;
  private body!: MeshRenderer;

  onLoad(): void {
    // 占位胶囊:半径 0.2m,圆柱段高 0.5m —— Task 16 换成小熊猫 GLB
    const mesh = utils.createMesh(primitives.capsule(0.2, 0.5));
    this.body = this.node.addComponent(MeshRenderer);
    this.body.mesh = mesh;
    const mat = new Material();
    mat.initialize({ effectName: 'builtin-standard' });
    mat.setProperty('mainColor', new Color(192, 84, 39)); // 原型 FUR #c05427
    this.body.setMaterial(mat, 0);
  }

  attach(state: GameState): void {
    this.state = state;
    state.on('grow', () => { this.flash = 1; });
  }

  update(dt: number): void {
    const s = this.state;
    if (!s || !this.bamboo) return;
    this.flash = Math.max(0, this.flash - dt * 4);
    const h = s.heightPx;
    const charWY = Math.max(h - C.CHAR_OFFSET_PX, 0);
    const ratio = h > 1 ? charWY / h : 0;
    const bounce = Math.sin(s.t * 3) * 2 - this.flash * 4; // 原型回弹(px)
    // 横向:贴竹身右侧 16px,随竹尖摆动按 ratio² 偏移
    this.node.setPosition(px2m(16 + this.bamboo.swayPx * ratio * ratio), px2m(charWY + bounce), 0);
    this.node.eulerAngles = s.stunned ? new Vec3(0, 0, Math.sin(s.t * 20) * 8.6) : Vec3.ZERO;
  }

  /** 小人中心的世界 px 坐标(x 原点 = world 0,y 地面为 0),含贴竹身右侧 16px 偏移。 */
  get charPx(): { x: number; y: number } {
    const s = this.state;
    if (!s || !this.bamboo) return { x: 0, y: 0 };
    const h = s.heightPx;
    const charWY = Math.max(h - C.CHAR_OFFSET_PX, 0);
    const ratio = h > 1 ? charWY / h : 0;
    return { x: C.BAMBOO_X_PX - C.DESIGN_W / 2 + 16 + this.bamboo.swayPx * ratio * ratio, y: charWY };
  }
}
```

- [ ] **Step 2: 修改 `Bootstrap.ts`**

`start()` 竹子段之后追加:

```ts
    const pandaNode = new Node('Panda');
    bambooRoot.addChild(pandaNode);
    this.panda = pandaNode.addComponent(PandaView);
    this.panda.bamboo = this.bamboo;
    this.panda.attach(this.state);
```

类字段追加 `protected panda!: PandaView;`,import 追加 `PandaView`。

- [ ] **Step 3: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add cocos/assets/scripts/view/PandaView.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(view): panda placeholder riding bamboo with bounce/dizzy"
```

- [ ] **Step 4: MANUAL GATE —— 预览验证**

预期:红棕胶囊贴在竹身右侧随竹升高,按键瞬间下压回弹;眩晕时胶囊左右摇晃、随竹闪动;竹尖摆动时小人横向跟随(顶部幅度大、根部不动)。

---

### Task 11: CoinView(对象池 + 磁吸 + 拾取接线 ScoreSystem)

**Files:**
- Create: `cocos/assets/scripts/view/CoinView.ts`
- Create: `cocos/assets/scripts/core/ScoreSystem.ts` —— 已存在于 Task 6,本任务仅接线
- Modify: `cocos/assets/scripts/Bootstrap.ts`

坐标约定:金币 x 用「屏心相对 px」(0 = 屏幕中心),y 用世界 px(地面 0)—— 与原型 sy() 换算解耦,渲染时加相机中心。

- [ ] **Step 1: 实现 `cocos/assets/scripts/view/CoinView.ts`**

```ts
import { _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3, utils, primitives } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { CameraRig } from './CameraRig';
import { PandaView } from './PandaView';

const { ccclass } = _decorator;

interface Coin {
  node: Node;
  xPx: number;   // 屏心相对 px
  yPx: number;   // 世界 px
  ph: number;
  vx: number;
  spin: number;
  alive: boolean;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

@ccclass('CoinView')
export class CoinView extends Component {
  /** 拾取回调:参数为金币世界坐标(m),由 Bootstrap 接线(加分/音效/粒子/浮字) */
  onPickup: ((worldPos: Vec3) => void) | null = null;
  state: GameState | null = null;
  rig: CameraRig | null = null;
  panda: PandaView | null = null;

  private pool: Coin[] = [];
  private mesh: Mesh | null = null;
  private mat!: Material;
  private lastSpawn = 0;

  onLoad(): void {
    this.mesh = utils.createMesh(primitives.cylinder(0.14, 0.14, 0.05, { radialSegments: 16 }));
    this.mat = new Material();
    this.mat.initialize({ effectName: 'builtin-standard' });
    this.mat.setProperty('mainColor', new Color(255, 215, 110));
  }

  private obtain(): Coin {
    for (const c of this.pool) {
      if (!c.alive) { c.alive = true; c.node.active = true; return c; }
    }
    const node = new Node(`coin${this.pool.length}`);
    this.node.addChild(node);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = this.mesh;
    mr.setMaterial(this.mat, 0);
    node.eulerAngles = new Vec3(90, 0, 0); // 圆柱轴向转朝相机
    const c: Coin = { node, xPx: 0, yPx: 0, ph: 0, vx: 0, spin: 0, alive: true };
    this.pool.push(c);
    return c;
  }

  update(dt: number): void {
    const s = this.state, rig = this.rig, panda = this.panda;
    if (!s || !rig || !panda || !s.started) return;

    // 生成:天上始终有货(原型 0.7s / 上限 30)
    if (s.t - this.lastSpawn > C.COIN_SPAWN_INTERVAL && this.pool.filter(c => c.alive).length < C.COIN_MAX_ALIVE) {
      this.lastSpawn = s.t;
      const c = this.obtain();
      const halfW = rig.visibleWidthPx() / 2 - 60;
      c.xPx = rand(-halfW, halfW);
      c.yPx = rig.camYPx + C.DESIGN_H + rand(0, 240);
      c.ph = rand(0, Math.PI * 2);
      c.vx = rand(-14, 14);
      c.spin = rand(0, Math.PI * 2);
    }

    const char = panda.charPx; // 世界 px(x 原点 = world 0,y 地面 0)
    const charRelX = char.x - rig.camX * C.PX_PER_M; // 转屏心相对,与金币同空间
    const halfWBounce = rig.visibleWidthPx() / 2 - 30;
    for (const c of this.pool) {
      if (!c.alive) continue;
      c.ph += dt * 2;
      c.spin += dt * 5;
      c.xPx += (c.vx + Math.sin(c.ph) * 12) * dt;
      c.yPx += Math.cos(c.ph * 0.7) * 8 * dt;
      if (c.xPx < -halfWBounce || c.xPx > halfWBounce) c.vx *= -1;

      const dx = charRelX - c.xPx, dy = char.y - c.yPx;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (d < C.MAGNET_RADIUS_PX) {
        c.xPx += dx / d * 220 * dt;
        c.yPx += dy / d * 220 * dt;
      }
      if (d < C.PICKUP_RADIUS_PX) {
        c.alive = false;
        c.node.active = false;
        if (this.onPickup) this.onPickup(new Vec3(rig.camX + px2m(c.xPx), px2m(c.yPx), 0));
        continue;
      }
      if (c.yPx < rig.camYPx - 60) { // 落到屏幕下方丢弃
        c.alive = false;
        c.node.active = false;
        continue;
      }
      c.node.setPosition(rig.camX + px2m(c.xPx), px2m(c.yPx), 0);
      c.node.eulerAngles = new Vec3(90, c.spin * 180 / Math.PI, 0);
    }
  }
}
```

- [ ] **Step 2: 修改 `Bootstrap.ts` 接线**

import 追加:`CoinView`、`ScoreSystem`、`Storage`。类字段追加 `protected score!: ScoreSystem;`。
`start()` 追加(在 panda 之后):

```ts
    this.score = new ScoreSystem(new Storage());

    const coinNode = new Node('Coins');
    this.node.scene!.addChild(coinNode);
    const coins = coinNode.addComponent(CoinView);
    coins.state = this.state;
    coins.rig = this.rig;
    coins.panda = this.panda;
    coins.onPickup = (pos) => {
      const mult = this.score.pickup(this.state.combo);
      console.log(`[coin] +${mult} score=${this.score.score} coins=${this.score.coins}`);
    };
```

`update()` 末尾追加(**注意限流**,`wx.setStorageSync` 是同步磁盘写,原型 localStorage 每帧写的做法在微信端不可照搬):

```ts
    // 最高分每秒至多写一次;内存 bestMeters 由 HUD 每帧读 state 高度刷新
    if (this.state.t - this.lastBestCheck > 1) {
      this.lastBestCheck = this.state.t;
      this.score.updateBest(this.state.heightPx);
    }
```

类字段同时追加 `private lastBestCheck = 0;`。

- [ ] **Step 3: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add cocos/assets/scripts/view/CoinView.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(view): coin pool with magnet/pickup wired to ScoreSystem"
```

- [ ] **Step 4: MANUAL GATE —— 预览验证**

预期:金色圆片从上方漂入、自旋;靠近小人被磁吸;拾取时控制台打印 `[coin] +N`;掉出屏幕底部消失;挂机 10 秒金币数稳定在 30 以内。

---

### Task 12: SkyView(渐变穹顶 + 星星 + 日月)

**Files:**
- Create: `cocos/assets/scripts/view/SkyView.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

原型天空:0m 白昼 → 200m 星空紫,上下双色线性渐变。实现:程序化 2×256 RGBA 纹理贴到相机子节点大平面(跟随相机),k 变化 >0.01 才重传纹理;星星/日月同为相机子节点。

- [ ] **Step 1: 实现 `cocos/assets/scripts/view/SkyView.ts`**

```ts
import { _decorator, Component, Node, MeshRenderer, Material, Color, Texture2D, Vec3, utils, primitives, Camera } from 'cc';
import { GameConfig as C } from '../core/GameConfig';
import { GameState } from '../core/GameState';

const { ccclass } = _decorator;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

@ccclass('SkyView')
export class SkyView extends Component {
  state: GameState | null = null;

  private tex!: Texture2D;
  private lastK = -1;
  private quad!: Node;
  private stars: Node[] = [];
  private sunMoon!: Node;
  private sunMat!: Material;
  private moonMat!: Material;

  /** 在相机节点下构建(由 Bootstrap 调用,parent = camNode) */
  build(parent: Node, cam: Camera): void {
    // 渐变纹理:2×256,纵向
    this.tex = new Texture2D();
    this.tex.reset({ width: 2, height: 256, format: Texture2D.PixelFormat.RGBA8888 });
    this.tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);

    const mat = new Material();
    mat.initialize({ effectName: 'builtin-unlit', technique: 1 }); // 1 = transparent,免深度写
    mat.setProperty('mainTexture', this.tex);

    this.quad = new Node('SkyQuad');
    parent.addChild(this.quad);
    const mr = this.quad.addComponent(MeshRenderer);
    mr.mesh = utils.createMesh(primitives.plane(1, 1, { widthSegments: 1, lengthSegments: 1 }));
    mr.setMaterial(mat, 0);
    this.quad.setPosition(0, 0, -40);
    // 覆满 22.4+40 m 处视锥:高 ≈ 2*62.4*tan15° ≈ 33.4m,宽按最大 aspect 2.6 预留
    this.quad.setScale(90, 36, 1);

    // 星星:40 个小平面,高空淡入
    const starMat = new Material();
    starMat.initialize({ effectName: 'builtin-unlit', technique: 1 });
    starMat.setProperty('mainColor', new Color(255, 255, 255, 200));
    const starMesh = utils.createMesh(primitives.plane(0.12, 0.12));
    for (let i = 0; i < 40; i++) {
      const st = new Node(`star${i}`);
      parent.addChild(st);
      const smr = st.addComponent(MeshRenderer);
      smr.mesh = starMesh;
      smr.setMaterial(starMat, 0);
      st.setPosition(((i * 197.3) % 800) / 800 * 40 - 20, ((i * 89.7) % 420) / 600 * 12 - 2, -39);
      this.stars.push(st);
    }

    // 日月:右上角圆盘
    this.sunMoon = new Node('SunMoon');
    parent.addChild(this.sunMoon);
    const mmr = this.sunMoon.addComponent(MeshRenderer);
    mmr.mesh = utils.createMesh(primitives.sphere(1.7, { segments: 16 }));
    this.sunMat = new Material();
    this.sunMat.initialize({ effectName: 'builtin-unlit' });
    this.sunMat.setProperty('mainColor', new Color(255, 237, 176));
    this.moonMat = new Material();
    this.moonMat.initialize({ effectName: 'builtin-unlit' });
    this.moonMat.setProperty('mainColor', new Color(244, 241, 222));
    mmr.setMaterial(this.sunMat, 0);
    this.sunMoon.setPosition(8, 5.5, -38);
    void cam;
  }

  update(_dt: number): void {
    const s = this.state;
    if (!s) return;
    const k = clamp01(s.heightPx / (C.PX_PER_M * 200));
    if (Math.abs(k - this.lastK) > 0.01) {
      this.lastK = k;
      const top = [lerp(88, 30, k), lerp(176, 24, k), lerp(240, 70, k)];
      const bot = [lerp(196, 90, k), lerp(236, 60, k), lerp(255, 110, k)];
      const data = new Uint8Array(2 * 256 * 4);
      for (let y = 0; y < 256; y++) {
        const t = y / 255; // y=0 纹理底部
        const r = lerp(bot[0], top[0], t), g = lerp(bot[1], top[1], t), b = lerp(bot[2], top[2], t);
        for (let x = 0; x < 2; x++) {
          const o = (y * 2 + x) * 4;
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
      }
      this.tex.uploadData(data);
      const mr = this.sunMoon.getComponent(MeshRenderer)!;
      mr.setMaterial(k < 0.5 ? this.sunMat : this.moonMat, 0);
    }
    // 星星:k>0.25 淡入 + 闪烁
    const alpha = clamp01((k - 0.25) * 1.5);
    for (let i = 0; i < this.stars.length; i++) {
      const tw = 0.5 + 0.5 * Math.sin(s.t * 2 + i);
      this.stars[i].active = alpha * tw > 0.05;
    }
  }
}
```

说明:原型云团是低海拔视差点缀 —— 本重写有意省略,地面氛围由 Task 16 的 Kenney 植被承担,高空读渐变+星月;3D 侧视里云团会遮挡竹子。

- [ ] **Step 2: 修改 `Bootstrap.ts`**

`start()` 相机段之后追加:

```ts
    const skyNode = new Node('Sky');
    this.node.scene!.addChild(skyNode);
    const sky = skyNode.addComponent(SkyView);
    sky.state = this.state;
    sky.build(camNode, this.cam);
```

import 追加 `SkyView`。

- [ ] **Step 3: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add cocos/assets/scripts/view/SkyView.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(view): gradient sky dome with stars and sun/moon"
```

- [ ] **Step 4: MANUAL GATE —— 预览验证**

预期:地面为蓝天,随高度渐变紫夜;约 50m 后星星淡入闪烁;约 100m 太阳变月亮。

---

### Task 13: HUD(Canvas UI,代码构建)

**Files:**
- Create: `cocos/assets/scripts/ui/HUD.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: 实现 `cocos/assets/scripts/ui/HUD.ts`**

```ts
import { _decorator, Component, Node, Label, Graphics, Color, Vec3, UITransform, Camera } from 'cc';
import { GameConfig as C } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { ScoreSystem } from '../core/ScoreSystem';

const { ccclass } = _decorator;

interface FloatLabel { node: Node; label: Label; life: number; }

@ccclass('HUD')
export class HUD extends Component {
  private lCoins!: Label;
  private lScore!: Label;
  private lHeight!: Label;
  private lBest!: Label;
  private lCombo!: Label;
  private lDizzy!: Label;
  private lOverlay!: Label;
  private bar!: Graphics;
  private floats: FloatLabel[] = [];

  private makeLabel(txt: string, size: number, x: number, y: number, color: Color): Label {
    const n = new Node(`lbl_${txt.slice(0, 6)}`);
    this.node.addChild(n);
    const l = n.addComponent(Label);
    l.string = txt;
    l.fontSize = size;
    l.color = color;
    l.enableOutline = true;
    l.outlineColor = new Color(0, 0, 0, 100);
    l.outlineWidth = 2;
    n.setPosition(x, y, 0);
    return l;
  }

  /** 在 Canvas 节点上构建(设计分辨率 800×600,中心原点) */
  build(): void {
    const white = new Color(255, 255, 255, 242);
    this.lCoins = this.makeLabel('金币 0', 22, -370, 268, white);
    this.lScore = this.makeLabel('分数 0', 22, -370, 238, white);
    this.lHeight = this.makeLabel('高度 0.0m', 22, -370, 208, white);
    this.lBest = this.makeLabel('最高 0.0m', 15, -370, 184, new Color(255, 255, 255, 166));
    this.lCombo = this.makeLabel('', 16, 300, 244, white);
    this.lDizzy = this.makeLabel('', 20, 0, 244, new Color(255, 120, 120, 230));
    this.lOverlay = this.makeLabel('按 空格 / 点按屏幕 开始', 28, 0, 0, white);
    this.makeLabel('节奏点按 0.1~0.5秒/次 · 太急眩晕 · 太慢断连击', 15, 0, -278, white);

    const barNode = new Node('ComboBar');
    this.node.addChild(barNode);
    this.bar = barNode.addComponent(Graphics);
    barNode.getComponent(UITransform)!.setContentSize(800, 600);
  }

  refresh(state: GameState, score: ScoreSystem): void {
    this.lCoins.string = `金币 ${score.coins}`;
    this.lScore.string = `分数 ${score.score}`;
    this.lHeight.string = `高度 ${(state.heightPx / C.PX_PER_M).toFixed(1)}m`;
    this.lBest.string = `最高 ${score.bestMeters.toFixed(1)}m`;
    this.lCombo.string = state.combo > 0 ? `连击 x${state.combo}` : '';
    this.lDizzy.string = state.stunned ? '竹子晕了…歇一下' : '';

    this.bar.clear();
    if (state.combo > 0) {
      this.bar.fillColor = new Color(0, 0, 0, 76);
      this.bar.roundRect(210, 262, 160, 14, 7);
      this.bar.fill();
      const hue = ((45 + state.combo * 8) % 360) / 360;
      this.bar.fillColor = Color.fromHSV(hue, 0.9, 0.55 + state.combo * 0.008);
      this.bar.roundRect(210, 262, 160 * (state.combo / C.COMBO_MAX), 14, 7);
      this.bar.fill();
    }
  }

  showOverlay(show: boolean): void {
    this.lOverlay.node.active = show;
  }

  /** 世界坐标浮字(+N),经相机换算到 UI 空间 */
  floatText(txt: string, worldPos: Vec3, cam: Camera): void {
    let f = this.floats.find(fl => fl.life <= 0);
    if (!f) {
      const n = new Node('float');
      this.node.addChild(n);
      const label = n.addComponent(Label);
      label.fontSize = 18;
      label.color = new Color(255, 215, 110);
      f = { node: n, label, life: 0 };
      this.floats.push(f);
    }
    const uiPos = cam.convertToUINode(worldPos, this.node);
    f.node.setPosition(uiPos);
    f.label.string = txt;
    f.node.active = true;
    f.life = 1.1;
  }

  update(dt: number): void {
    for (const f of this.floats) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.node.setPosition(f.node.position.x, f.node.position.y + 40 * dt, 0);
      if (f.life <= 0) f.node.active = false;
    }
  }
}
```

- [ ] **Step 2: 修改 `Bootstrap.ts`**

import 追加:`HUD`、`Canvas`。类字段追加 `private hud!: HUD;`。
`start()` 末尾追加:

```ts
    const canvasNode = new Node('Canvas');
    this.node.scene!.addChild(canvasNode);
    canvasNode.addComponent(Canvas);
    this.hud = canvasNode.addComponent(HUD);
    this.hud.build();
    this.hud.refresh(this.state, this.score);

    this.state.on('start', () => this.hud.showOverlay(false));
    this.state.on('grow', () => this.hud.refresh(this.state, this.score));
    this.state.on('stun', () => this.hud.refresh(this.state, this.score));
    coins.onPickup = (pos) => {
      const mult = this.score.pickup(this.state.combo);
      this.hud.floatText(`+${mult}`, pos, this.cam);
      this.hud.refresh(this.state, this.score);
    };
```

`update()` 末尾追加:`this.hud.refresh(this.state, this.score);`(高度/最高分每帧刷新)。

说明:Canvas 默认可由场景中唯一 Camera 渲染,无需额外配置。

- [ ] **Step 3: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add cocos/assets/scripts/ui/HUD.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(ui): code-built HUD with combo bar, float texts, overlay"
```

- [ ] **Step 4: MANUAL GATE —— 预览验证**

预期:左上金币/分数/高度/最高;右上连击条+xN;底部常驻操作说明;开场中央提示,首次按键消失;拾币处飘 +N。

---

### Task 14: AudioFx(WebAudio 程序化合成)

**Files:**
- Create: `cocos/assets/scripts/fx/AudioFx.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

零音频资源:振荡器合成,照搬原型音色(按键三角波下滑 / 眩晕双锯齿 / 拾币五声音阶)。微信平台用 `wx.createWebAudioContext`。

- [ ] **Step 1: 实现 `cocos/assets/scripts/fx/AudioFx.ts`**

```ts
declare const wx: { createWebAudioContext(): unknown } | undefined;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 程序化音效 —— 任何环境失败都静默降级(静音可玩)。 */
export class AudioFx {
  private ac: any = null;
  private failed = false;

  private ensure(): any {
    if (this.failed) return null;
    try {
      if (!this.ac) {
        const g = globalThis as Record<string, any>;
        if (typeof wx !== 'undefined' && wx && wx.createWebAudioContext) {
          this.ac = wx.createWebAudioContext();
        } else if (g.AudioContext || g.webkitAudioContext) {
          const AC = g.AudioContext ?? g.webkitAudioContext;
          this.ac = new AC();
        }
      }
      if (this.ac && this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    } catch {
      this.failed = true;
      return null;
    }
  }

  private tone(freq: number, dur: number, type: string, vol: number, when = 0, slide = 0): void {
    const ac = this.ensure();
    if (!ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      const t0 = ac.currentTime + when;
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      this.failed = true;
    }
  }

  press(): void { this.tone(190 + Math.random() * 30, 0.09, 'triangle', 0.16, 0, -60); }
  bad(): void {
    this.tone(140, 0.18, 'sawtooth', 0.08, 0, -70);
    this.tone(98, 0.22, 'sawtooth', 0.07, 0.05, -40);
  }
  coin(combo: number): void {
    const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C 大调五声音阶
    const i = Math.min(combo, PENTA.length - 1);
    this.tone(PENTA[i], 0.25, 'sine', 0.2);
    this.tone(PENTA[i] * 2, 0.18, 'sine', 0.06, 0.02);
  }
}
```

- [ ] **Step 2: 修改 `Bootstrap.ts`**

import 追加 `AudioFx`。类字段追加 `private audioFx = new AudioFx();`。
事件接线改为:

```ts
    this.state.on('grow', () => { this.audioFx.press(); this.hud.refresh(this.state, this.score); });
    this.state.on('stun', () => { this.audioFx.bad(); this.hud.refresh(this.state, this.score); });
```

`coins.onPickup` 内 `this.score.pickup(...)` 之后追加 `this.audioFx.coin(this.state.combo);`。

- [ ] **Step 3: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add cocos/assets/scripts/fx/AudioFx.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(fx): WebAudio synth sfx (press/stun/coin pentatonic)"
```

- [ ] **Step 4: MANUAL GATE —— 预览验证**

预期:按键短促"笃";眩晕低沉双音;拾币音高随连击上行。

---

### Task 15: ParticleFx(拾取爆发 + 落叶 + 眩晕星星)

**Files:**
- Create: `cocos/assets/scripts/fx/ParticleFx.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: 实现 `cocos/assets/scripts/fx/ParticleFx.ts`**

```ts
import { _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3, utils, primitives } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { PandaView } from '../view/PandaView';
import { CameraRig } from '../view/CameraRig';

const { ccclass } = _decorator;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

interface P { node: Node; vx: number; vy: number; vr: number; life: number; max: number; }

@ccclass('ParticleFx')
export class ParticleFx extends Component {
  state: GameState | null = null;
  panda: PandaView | null = null;
  rig: CameraRig | null = null;

  private dotMesh!: Mesh;
  private leafMesh!: Mesh;
  private goldMat!: Material;
  private leafMat!: Material;
  private starMat!: Material;
  private dots: P[] = [];
  private leaves: P[] = [];
  private stunStars: Node[] = [];

  onLoad(): void {
    this.dotMesh = utils.createMesh(primitives.sphere(0.05, { segments: 6 }));
    this.leafMesh = utils.createMesh(primitives.box(0.14, 0.06, 0.02));
    this.goldMat = this.makeMat(new Color(255, 215, 110));
    this.leafMat = this.makeMat(new Color(110, 170, 90));
    this.starMat = this.makeMat(new Color(255, 226, 122));
    for (let i = 0; i < 3; i++) {
      const st = new Node(`stunStar${i}`);
      this.node.addChild(st);
      const mr = st.addComponent(MeshRenderer);
      mr.mesh = this.dotMesh;
      mr.setMaterial(this.starMat, 0);
      st.setScale(1.4, 1.4, 1.4);
      st.active = false;
      this.stunStars.push(st);
    }
  }

  private makeMat(c: Color): Material {
    const m = new Material();
    m.initialize({ effectName: 'builtin-standard' });
    m.setProperty('mainColor', c);
    return m;
  }

  private obtain(list: P[], mesh: Mesh, mat: Material, prefix: string): P {
    for (const p of list) {
      if (p.life <= 0) { p.node.active = true; return p; }
    }
    const node = new Node(`${prefix}${list.length}`);
    this.node.addChild(node);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = mesh;
    mr.setMaterial(mat, 0);
    const p: P = { node, vx: 0, vy: 0, vr: 0, life: 0, max: 1 };
    list.push(p);
    return p;
  }

  /** 拾取爆发:14 个金点四散(原型 spawnBurst) */
  burst(worldPos: Vec3): void {
    for (let i = 0; i < 14; i++) {
      const p = this.obtain(this.dots, this.dotMesh, this.goldMat, 'dot');
      const a = rand(0, Math.PI * 2), sp = rand(40, 160);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = p.max = rand(0.4, 0.8);
      p.node.setPosition(worldPos);
      const sc = rand(0.8, 1.6);
      p.node.setScale(sc, sc, 1);
    }
  }

  /** 竹根溅叶(原型:每次生长 3 片) */
  splashLeaves(): void {
    const baseX = px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2);
    for (let i = 0; i < 3; i++) this.spawnLeaf(baseX + px2m(rand(-14, 14)), 0.12);
  }

  private spawnLeaf(x: number, y: number): void {
    const p = this.obtain(this.leaves, this.leafMesh, this.leafMat, 'leaf');
    p.vx = rand(-25, 25);
    p.vy = rand(30, 70);
    p.vr = rand(-3, 3);
    p.life = p.max = rand(1.2, 2.2);
    p.node.setPosition(x, y, 0);
  }

  update(dt: number): void {
    const s = this.state;
    for (const p of this.dots) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 300 * dt; // 世界坐标下粒子下落(px 速度)
      const pos = p.node.position;
      p.node.setPosition(pos.x + px2m(p.vx) * dt, pos.y + px2m(p.vy) * dt, 0);
      if (p.life <= 0) p.node.active = false;
    }
    for (const p of this.leaves) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const pos = p.node.position;
      p.node.setPosition(pos.x + px2m(p.vx) * dt, pos.y - px2m(p.vy) * dt, 0);
      p.node.eulerAngles = new Vec3(0, 0, p.node.eulerAngles.z + p.vr * 57 * dt);
      if (p.life <= 0) p.node.active = false;
    }
    if (!s || !this.panda || !this.rig) return;
    // 高空偶发落叶(原型概率 dt*0.8)
    if (Math.random() < dt * 0.8 && s.heightPx > 120) {
      const char = this.panda.charPx; // 世界 px,直接用,不加 camX
      this.spawnLeaf(px2m(char.x + rand(-30, 30)), px2m(s.heightPx - rand(0, 120)));
    }
    // 眩晕星星绕头
    const show = s.stunned;
    for (let i = 0; i < this.stunStars.length; i++) {
      const st = this.stunStars[i];
      st.active = show;
      if (show) {
        const char = this.panda.charPx;
        const a = s.t * 4 + i * Math.PI * 2 / 3;
        st.setPosition(px2m(char.x + Math.cos(a) * 22), px2m(char.y + 30 + Math.sin(a) * 6), 0);
      }
    }
  }
}
```

- [ ] **Step 2: 修改 `Bootstrap.ts`**

import 追加 `ParticleFx`。`start()` 在 coins 接线后追加:

```ts
    const fxNode = new Node('FX');
    this.node.scene!.addChild(fxNode);
    const fx = fxNode.addComponent(ParticleFx);
    fx.state = this.state;
    fx.panda = this.panda;
    fx.rig = this.rig;
    this.state.on('grow', () => fx.splashLeaves());
```

`coins.onPickup` 内追加 `fx.burst(pos);`。

- [ ] **Step 3: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add cocos/assets/scripts/fx/ParticleFx.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(fx): pickup burst, leaf splash/drift, stun stars"
```

- [ ] **Step 4: MANUAL GATE —— 预览验证**

预期:拾币金色爆点;按键竹根溅叶;高空飘落叶;眩晕时三颗黄星绕头。

---

### Task 16: 模型资源接入(小熊猫 + 植被)+ ASSETS.md

**Files:**
- Create: `ASSETS.md`
- Create: `cocos/assets/models/`(GLB 目录,编辑器里设为 Bundle `models`)
- Modify: `cocos/assets/scripts/view/PandaView.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: MANUAL —— 下载模型**

| 资源 | 动作 |
|---|---|
| 小熊猫 | Sketchfab 登录(免费注册)→ 打开 https://sketchfab.com/3d-models/red-panda-c003c2985e0e462684063a893a0e85ee (kenchoo,CC-BY,带动画)→ Download glTF。若下架,备选 https://sketchfab.com/3d-models/low-poly-red-panda-8388ccb25c144303a2ce904f1c2f534d (kishayan) |
| 植被 | https://kenney.nl/assets/nature-kit (CC0)→ 下载,挑树/草/石 GLB 各 2-3 个 |

- [ ] **Step 2: MANUAL —— Blender 预处理**

1. 导入 glTF → 全选 → 三角面数确认 ≤5k(超出加 Decimate modifier,ratio 调至达标)
2. 贴图缩到 ≤512px(Image → Scale)
3. 缩放至身高 ≈0.7m(占位胶囊高 0.9m,比例接近即可)
4. 导出 GLB:`panda.glb`,放 `cocos/assets/models/`
5. 植被同样导出 `tree_a.glb` / `grass_a.glb` 等

- [ ] **Step 3: MANUAL —— 编辑器里把 `assets/models` 设为 Bundle**

点选 `models` 文件夹 → 属性检查器 → 勾选「配置为 Bundle」→ Bundle 名 `models`,压缩类型「小游戏分包」。

- [ ] **Step 4: 写 `ASSETS.md`(项目根)**

按实际下载填写(以下为 kenchoo 版格式示例,作者名/标题以下载页为准):

```markdown
# 第三方资源

| 文件 | 名称 | 作者 | 来源 | License | 署名文案 |
|---|---|---|---|---|---|
| cocos/assets/models/panda.glb | Red Panda | kenchoo | https://sketchfab.com/3d-models/red-panda-c003c2985e0e462684063a893a0e85ee | CC-BY 4.0 | "Red Panda" by kenchoo [CC-BY] via Sketchfab |
| cocos/assets/models/tree_a.glb 等 | Nature Kit | Kenney | https://kenney.nl/assets/nature-kit | CC0 | 无需署名 |
```

- [ ] **Step 5: 修改 `PandaView.ts` —— GLB 加载 + 胶囊降级**

import 追加:`assetManager, Prefab, instantiate`。`onLoad()` 末尾追加:

```ts
    assetManager.loadBundle('models', (err, bundle) => {
      if (err || !bundle) return; // 保持胶囊占位
      bundle.load('panda', Prefab, (e, prefab) => {
        if (e || !prefab) return;
        const model = instantiate(prefab);
        this.node.addChild(model);
        this.body.node.removeComponent(MeshRenderer); // 隐藏占位胶囊
      });
    });
```

注意 GLB 导入后资源名取文件名小写(`panda`)。

- [ ] **Step 6: 修改 `Bootstrap.ts` —— 地面植被**

import 追加:`assetManager, Prefab, instantiate`。`start()` 天空段后追加(仅低海拔可见):

```ts
    assetManager.loadBundle('models', (err, bundle) => {
      if (err || !bundle) return;
      bundle.load('tree_a', Prefab, (e, prefab) => {
        if (e || !prefab) return;
        const bg = new Node('BgVegetation');
        this.node.scene!.addChild(bg);
        for (let i = 0; i < 6; i++) {
          const t = instantiate(prefab);
          bg.addChild(t);
          t.setPosition(-6 + i * 2.4, 0, -3 - (i % 3) * 2);
          const sc = 0.8 + (i % 3) * 0.4;
          t.setScale(sc, sc, sc);
        }
      });
    });
```

- [ ] **Step 7: 单测回归 + Commit**

Run: `cd cocos && npx jest` → 29 passed

```bash
git add ASSETS.md cocos/assets/models/ cocos/assets/scripts/
git commit -m "feat(assets): red panda GLB + Kenney vegetation with capsule fallback"
```

- [ ] **Step 8: MANUAL GATE —— 预览验证**

预期:胶囊变为小熊猫模型;地面有树;`models` bundle 缺失时(临时改名文件夹验证)游戏仍可用胶囊玩。

---

### Task 17: 微信小游戏构建 + 包体优化 + 真机验证

全部 MANUAL,编辑器 + 微信开发者工具操作。

- [ ] **Step 1: 引擎裁剪**

项目 → 项目设置 → 功能裁剪,取消勾选未用模块:物理引擎(Physics/2D)、龙骨(DragonBones)、Spine、粒子系统(ParticleSystem,本工程粒子为手写池)、地形、视频、WebView。**保留**:3D 基础、UI、WebAudio。
预期:引擎基础资源 ≈3MB 以下。

- [ ] **Step 2: 构建**

构建发布 → 平台「微信小游戏」→ AppID 用测试号 → 主包压缩类型「小游戏分包」→ `models` bundle 已是分包 → 构建。
产物:`cocos/build/wechatgame/`。

- [ ] **Step 3: 包体检查**

微信开发者工具打开 `cocos/build/wechatgame` → 详情 → 基本信息:主包 **≤4MB**,总包 ≤20MB。超标时:
1. 相机 ClearFlags 确认 SOLID_COLOR(已是)
2. 模型贴图再降(256px)
3. 回 Step 1 再裁模块

- [ ] **Step 4: 真机预览**

开发者工具 → 预览 → 手机扫码。
验证清单:
- [ ] 触摸点按 = 空格(生长/眩晕/连击全同)
- [ ] 金币磁吸/拾取/+N 浮字
- [ ] 最高分重进仍在(wx storage)
- [ ] 帧率稳定(开发者工具性能面板 ≥50fps)
- [ ] 主包加载到可玩 ≤3s

- [ ] **Step 5: Commit(构建配置变更)**

```bash
git add cocos/settings/
git commit -m "build: wechat minigame settings with engine trim"
```

---

## 完成标准

- `cd cocos && npx jest` 全绿(29 个 core 测试)
- 微信开发者工具真机跑通:节奏生长/眩晕/连击/磁吸拾币/天空渐变/最高分持久化
- 主包 ≤4MB
- `ASSETS.md` 完整,CC-BY 署名文案就位

# 分层架构重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将组装/内容/逻辑/表现分层：`GameApp` 接管接线与主循环，`ScenePack` 支持 default/work/cny，`AnimController` 分层驱动熊猫微动作；default 行为与重构前 1:1。

**Architecture:** 单向数据流不变。启动解析 `ACTIVE_SCENE_ID` → 合并 `ThemeableConfig` 到 `RuntimeConfig` → `GameApp` 注入 Pack 与接线。角色事件进 `AnimController`（Base/Overlay），`PandaView` 只负责应用输出。`Bootstrap.ts` **保留在** `scripts/Bootstrap.ts`（场景组件绑定），瘦成入口。

**Tech Stack:** Cocos Creator 3.8.8 · TypeScript · Jest（`cd cocos && npm test`）

**Spec:** `docs/superpowers/specs/2026-08-13-layered-architecture-refactor-design.md`

**工作分支:** `feature/layered-architecture-refactor`（已存在，含 design commit）

## 文件职责

| 文件 | 职责 |
|---|---|
| `cocos/assets/scripts/content/ScenePack.ts` | Pack / Theme 类型 + `ThemeableConfig` 白名单键 |
| `cocos/assets/scripts/core/mergeRuntimeConfig.ts` | 浅合并 GameConfig + pack.config |
| `cocos/assets/scripts/core/RuntimeConfig.ts` | 运行时配置 get/set（主题字段唯一读口） |
| `cocos/assets/scripts/content/registry.ts` | Pack 注册表 |
| `cocos/assets/scripts/app/ActiveScene.ts` | `ACTIVE_SCENE_ID` + resolve（未知回退） |
| `cocos/assets/scripts/content/packs/defaultPack.ts` | 现网内容迁入 |
| `cocos/assets/scripts/content/packs/workPack.ts` | 占位包 |
| `cocos/assets/scripts/content/packs/cnyPack.ts` | 占位包 |
| `cocos/assets/scripts/character/AnimTypes.ts` | clip id / 层 / 优先级类型 |
| `cocos/assets/scripts/character/AnimController.ts` | Base+Overlay 纯逻辑状态机 |
| `cocos/assets/scripts/app/GameApp.ts` | 场景组装、接线、tick |
| `cocos/assets/scripts/Bootstrap.ts` | 瘦入口（路径不动） |
| `cocos/assets/scripts/view/PandaView.ts` | 应用 AnimController 输出 |
| `cocos/assets/scripts/core/AnimalHazard.ts` | 主题数值改读 RuntimeConfig |
| `cocos/assets/scripts/core/AnimalTaunts.ts` | 改为 `pickFromPool(pool, rng)` |
| `cocos/assets/scripts/ui/HUD.ts` | copy 来自 Pack |
| `cocos/assets/scripts/view/SkyView.ts` / `AnimalView.ts` | 资源 key / 种类来自 Pack（能迁则迁） |
| `cocos/tests/mergeRuntimeConfig.test.ts` | 合并与白名单 |
| `cocos/tests/ActiveScene.test.ts` | 解析与回退 |
| `cocos/tests/AnimController.test.ts` | 分层/打断/时长 |
| `cocos/tests/AnimalTaunts.test.ts` | 适配新 API |

**引擎约束：** 不要把 `Bootstrap.ts` 挪到 `app/`，否则场景里挂的脚本 UUID 可能断。Spec 目录表以「职责」为准，入口文件保留原路径。

---

### Task 1: ThemeableConfig 合并 + RuntimeConfig

**Files:**
- Create: `cocos/assets/scripts/content/ScenePack.ts`
- Create: `cocos/assets/scripts/core/mergeRuntimeConfig.ts`
- Create: `cocos/assets/scripts/core/RuntimeConfig.ts`
- Create: `cocos/tests/mergeRuntimeConfig.test.ts`

- [ ] **Step 1: 写失败单测**

```ts
// cocos/tests/mergeRuntimeConfig.test.ts
import { GameConfig } from '../assets/scripts/core/GameConfig';
import { mergeRuntimeConfig } from '../assets/scripts/core/mergeRuntimeConfig';

describe('mergeRuntimeConfig', () => {
  it('returns GameConfig when pack config empty', () => {
    const r = mergeRuntimeConfig(GameConfig, undefined);
    expect(r.ANIMAL_COIN_LOSS).toBe(GameConfig.ANIMAL_COIN_LOSS);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
  });

  it('overrides themeable animal fields only', () => {
    const r = mergeRuntimeConfig(GameConfig, { ANIMAL_COIN_LOSS: 9 });
    expect(r.ANIMAL_COIN_LOSS).toBe(9);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/mergeRuntimeConfig.test.ts -v`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现类型与合并**

```ts
// cocos/assets/scripts/content/ScenePack.ts
export type SceneId = 'default' | 'work' | 'cny';

/** 本轮 Pack 可覆盖字段白名单（与 spec 一致） */
export type ThemeableConfig = {
  ANIMAL_TIER1_COINS: number;
  ANIMAL_TIER2_COINS: number;
  ANIMAL_TIER3_COINS: number;
  ANIMAL_SPAWN_GAP_T1_MIN: number;
  ANIMAL_SPAWN_GAP_T1_MAX: number;
  ANIMAL_SPAWN_GAP_T2_MIN: number;
  ANIMAL_SPAWN_GAP_T2_MAX: number;
  ANIMAL_SPAWN_GAP_T3_MIN: number;
  ANIMAL_SPAWN_GAP_T3_MAX: number;
  ANIMAL_MAX_ALIVE_T1_T2: number;
  ANIMAL_MAX_ALIVE_T3: number;
  ANIMAL_FADE_IN_S: number;
  ANIMAL_SPAWN_HEIGHT_PX: number;
  ANIMAL_SPAWN_DIAG_X_PX: number;
  ANIMAL_SIDE_OFFSET_PX: number;
  ANIMAL_DIVE_SPEED_PX: number;
  ANIMAL_HIT_RADIUS_PX: number;
  ANIMAL_KNOCK_RADIUS_PX: number;
  ANIMAL_KNOCK_BEND_MIN_PX: number;
  ANIMAL_COIN_LOSS: number;
  ANIMAL_POST_HIT_COOLDOWN_S: number;
  ANIMAL_KNOCK_DESPAWN_S: number;
  KICK_CONTACT_S: number;
  KICK_CLIP_S: number;
};

export type SkyTheme = {
  cloudPrefabUuid: string;
  cloudBundleKey: string;
};

export type GroundTheme = {
  treePrefabUuid: string;
  grassPrefabUuid: string;
  treeBundleKey: string;
  grassBundleKey: string;
};

export type AnimalTheme = {
  kinds: Array<'bird' | 'cat' | 'dog' | 'rabbit'>;
  taunts: readonly string[];
  prefabUuid: Record<'bird' | 'cat' | 'dog' | 'rabbit', string>;
  bundleKey: Record<'bird' | 'cat' | 'dog' | 'rabbit', string>;
};

export type AudioTheme = {
  /** 占位：本轮仍走程序化 AudioFx，仅留扩展点 */
  profile: 'default' | 'work' | 'cny';
};

export type CopyTheme = {
  title: string;
  overlay: string;
  hint: string;
  stunMash: string;
  stunAnimal: string;
};

export interface ScenePack {
  id: SceneId;
  displayName: string;
  config?: Partial<ThemeableConfig>;
  sky: SkyTheme;
  ground: GroundTheme;
  animals: AnimalTheme;
  audio: AudioTheme;
  copy: CopyTheme;
}
```

```ts
// cocos/assets/scripts/core/mergeRuntimeConfig.ts
import { GameConfig } from './GameConfig';
import type { ThemeableConfig } from '../content/ScenePack';

export type RuntimeConfigShape = typeof GameConfig;

export function mergeRuntimeConfig(
  base: typeof GameConfig,
  packConfig?: Partial<ThemeableConfig>,
): RuntimeConfigShape {
  if (!packConfig) return { ...base };
  return { ...base, ...packConfig };
}
```

```ts
// cocos/assets/scripts/core/RuntimeConfig.ts
import { GameConfig } from './GameConfig';
import type { RuntimeConfigShape } from './mergeRuntimeConfig';

let current: RuntimeConfigShape = { ...GameConfig };

export function setRuntimeConfig(next: RuntimeConfigShape): void {
  current = next;
}

export function getRuntimeConfig(): RuntimeConfigShape {
  return current;
}

/** 测试用：恢复默认 */
export function resetRuntimeConfig(): void {
  current = { ...GameConfig };
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd cocos && npx jest tests/mergeRuntimeConfig.test.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/content/ScenePack.ts \
  cocos/assets/scripts/core/mergeRuntimeConfig.ts \
  cocos/assets/scripts/core/RuntimeConfig.ts \
  cocos/tests/mergeRuntimeConfig.test.ts
git commit -m "$(cat <<'EOF'
feat(core): add ThemeableConfig merge and RuntimeConfig

EOF
)"
```

---

### Task 2: Pack 注册表 + ActiveScene 解析

**Files:**
- Create: `cocos/assets/scripts/content/registry.ts`
- Create: `cocos/assets/scripts/app/ActiveScene.ts`
- Create: `cocos/assets/scripts/content/packs/defaultPack.ts`（先最小可解析骨架，完整数据 Task 3 填）
- Create: `cocos/assets/scripts/content/packs/workPack.ts`
- Create: `cocos/assets/scripts/content/packs/cnyPack.ts`
- Create: `cocos/tests/ActiveScene.test.ts`

- [ ] **Step 1: 写失败单测**

```ts
// cocos/tests/ActiveScene.test.ts
import { resolveScenePack } from '../assets/scripts/app/ActiveScene';
import { getPack } from '../assets/scripts/content/registry';

describe('ActiveScene', () => {
  it('resolves default', () => {
    expect(resolveScenePack('default').id).toBe('default');
  });

  it('falls back to default on unknown id', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const p = resolveScenePack('nope' as 'default');
    expect(p.id).toBe('default');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('registry has work and cny', () => {
    expect(getPack('work')?.id).toBe('work');
    expect(getPack('cny')?.id).toBe('cny');
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/ActiveScene.test.ts -v`  
Expected: FAIL

- [ ] **Step 3: 实现三包骨架 + registry + ActiveScene**

`defaultPack` / `workPack` / `cnyPack` 先填齐 `ScenePack` 必填字段：  
- ground/sky UUID 从现 `Bootstrap` / `SkyView` / `AnimalView` 常量抄入  
- `animals.taunts` 先用现 `ANIMAL_TAUNTS` 数组字面量迁入 default；work/cny 用短数组区分  
- `copy`：default 用现 HUD 文案；work/cny 改 `title`/`overlay` 一两处以便手动验证  

```ts
// cocos/assets/scripts/content/registry.ts
import type { SceneId, ScenePack } from './ScenePack';
import { defaultPack } from './packs/defaultPack';
import { workPack } from './packs/workPack';
import { cnyPack } from './packs/cnyPack';

const PACKS: Record<SceneId, ScenePack> = {
  default: defaultPack,
  work: workPack,
  cny: cnyPack,
};

export function getPack(id: SceneId): ScenePack | undefined {
  return PACKS[id];
}

export function allPackIds(): SceneId[] {
  return Object.keys(PACKS) as SceneId[];
}
```

```ts
// cocos/assets/scripts/app/ActiveScene.ts
import type { SceneId, ScenePack } from '../content/ScenePack';
import { getPack } from '../content/registry';

/** 启动固定场景；改此常量验证 work/cny */
export const ACTIVE_SCENE_ID: SceneId = 'default';

export function resolveScenePack(id: SceneId = ACTIVE_SCENE_ID): ScenePack {
  const pack = getPack(id);
  if (pack) return pack;
  console.warn(`[ActiveScene] unknown scene id=${id}, fallback default`);
  return getPack('default')!;
}
```

work 占位示例差异：

```ts
displayName: '工作场景',
copy: {
  title: '势如破竹·上班',
  overlay: '点屏幕开始 · 别卷了先喘口气',
  hint: '节奏点按 · 侧点弯竹 · 太急眩晕',
  stunMash: '别卷了，钱赚不完的',
  stunAnimal: '啊',
},
animals: { ...defaultPack.animals, taunts: ['KPI 完成了吗？', '又在摸鱼是吧？', '九点开会你来不来？'] },
```

cny 占位：`displayName: '过年场景'`，`title: '势如破竹·过年'`，taunts 用过年味短句 3 条。

- [ ] **Step 4: 跑测确认通过**

Run: `cd cocos && npx jest tests/ActiveScene.test.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/content cocos/assets/scripts/app/ActiveScene.ts \
  cocos/tests/ActiveScene.test.ts
git commit -m "$(cat <<'EOF'
feat(content): register default/work/cny scene packs

EOF
)"
```

---

### Task 3: AnimalTaunts 池外置 + 单测适配

**Files:**
- Modify: `cocos/assets/scripts/core/AnimalTaunts.ts`
- Modify: `cocos/tests/AnimalTaunts.test.ts`
- Modify: `cocos/assets/scripts/content/packs/defaultPack.ts`（确保 taunts 完整迁入现网列表）
- Modify: 调用方（暂可仍 import 旧符号；本 Task 改 API，Bootstrap/GameApp 在 Task 5 接线）

- [ ] **Step 1: 改 API 与测试**

```ts
// cocos/assets/scripts/core/AnimalTaunts.ts
/** rng ∈ [0,1)，从台词池均匀抽取一条。 */
export function pickFromPool(
  pool: readonly string[],
  rng: () => number = Math.random,
): string {
  if (pool.length === 0) return '';
  const i = Math.floor(rng() * pool.length);
  return pool[Math.min(Math.max(0, i), pool.length - 1)]!;
}

/** @deprecated 兼容旧测试名：需传入 pool */
export function pickAnimalTaunt(
  pool: readonly string[],
  rng: () => number = Math.random,
): string {
  return pickFromPool(pool, rng);
}
```

```ts
// cocos/tests/AnimalTaunts.test.ts
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
```

- [ ] **Step 2: 把原 `ANIMAL_TAUNTS` 数组完整粘进 `defaultPack.animals.taunts`，删除 core 内常量数组**

- [ ] **Step 3: 跑测**

Run: `cd cocos && npx jest tests/AnimalTaunts.test.ts -v`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/core/AnimalTaunts.ts \
  cocos/assets/scripts/content/packs/defaultPack.ts \
  cocos/tests/AnimalTaunts.test.ts
git commit -m "$(cat <<'EOF'
refactor(content): move animal taunt pool into scene packs

EOF
)"
```

---

### Task 4: AnimController 分层状态机

**Files:**
- Create: `cocos/assets/scripts/character/AnimTypes.ts`
- Create: `cocos/assets/scripts/character/AnimController.ts`
- Create: `cocos/tests/AnimController.test.ts`

- [ ] **Step 1: 写失败单测**

```ts
// cocos/tests/AnimController.test.ts
import { AnimController } from '../assets/scripts/character/AnimController';

describe('AnimController', () => {
  it('defaults to climbIdle base', () => {
    const c = new AnimController();
    expect(c.base).toBe('climbIdle');
    expect(c.overlay).toBeNull();
  });

  it('stun switches base; clearStun returns climbIdle', () => {
    const c = new AnimController();
    c.setStunned(true);
    expect(c.base).toBe('stunned');
    c.setStunned(false);
    expect(c.base).toBe('climbIdle');
  });

  it('kick overlay respects duration and side', () => {
    const c = new AnimController();
    c.playOverlay('kick', { duration: 0.4, side: -1, priority: 10 });
    expect(c.overlay?.id).toBe('kick');
    expect(c.overlay?.side).toBe(-1);
    c.update(0.4);
    expect(c.overlay).toBeNull();
  });

  it('higher priority interrupts lower overlay', () => {
    const c = new AnimController();
    c.playOverlay('pressBounce', { duration: 0.25, priority: 1 });
    c.playOverlay('kick', { duration: 0.4, side: 1, priority: 10 });
    expect(c.overlay?.id).toBe('kick');
  });

  it('lower priority does not interrupt', () => {
    const c = new AnimController();
    c.playOverlay('kick', { duration: 0.4, side: 1, priority: 10 });
    c.playOverlay('pressBounce', { duration: 0.25, priority: 1 });
    expect(c.overlay?.id).toBe('kick');
  });
});
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/AnimController.test.ts -v`  
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// cocos/assets/scripts/character/AnimTypes.ts
export type BaseAnim = 'climbIdle' | 'stunned';
export type OverlayAnimId = 'kick' | 'pressBounce' | 'idle' | 'press';

export interface OverlayPlayOpts {
  duration: number;
  priority: number;
  side?: -1 | 1;
}

export interface OverlayState {
  id: OverlayAnimId;
  age: number;
  duration: number;
  priority: number;
  side: -1 | 1;
}
```

```ts
// cocos/assets/scripts/character/AnimController.ts
import type { BaseAnim, OverlayAnimId, OverlayPlayOpts, OverlayState } from './AnimTypes';

/** 纯逻辑分层动作；无 cc 依赖。 */
export class AnimController {
  base: BaseAnim = 'climbIdle';
  overlay: OverlayState | null = null;

  setStunned(on: boolean): void {
    this.base = on ? 'stunned' : 'climbIdle';
  }

  playOverlay(id: OverlayAnimId, opts: OverlayPlayOpts): void {
    const next: OverlayState = {
      id,
      age: 0,
      duration: opts.duration,
      priority: opts.priority,
      side: opts.side ?? 1,
    };
    if (this.overlay && next.priority < this.overlay.priority) return;
    this.overlay = next;
  }

  update(dt: number): void {
    if (!this.overlay) return;
    this.overlay.age += dt;
    if (this.overlay.age >= this.overlay.duration) this.overlay = null;
  }
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd cocos && npx jest tests/AnimController.test.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/character cocos/tests/AnimController.test.ts
git commit -m "$(cat <<'EOF'
feat(character): add layered AnimController

EOF
)"
```

---

### Task 5: 抽出 GameApp，Bootstrap 变瘦

**Files:**
- Create: `cocos/assets/scripts/app/GameApp.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: 将现 `Bootstrap` 的字段、`buildScene`、`spawnVegetation`、`update` 原样迁入 `GameApp`**

`GameApp` 不是 `cc.Component`：构造注入宿主 `Component`（用于 `isValid` / `node.scene` / `schedule` 可选）。推荐签名：

```ts
export class GameApp {
  constructor(private host: Component) {}
  start(effect: EffectAsset | null): void { /* 原 buildScene 体 */ }
  update(dt: number): void { /* 原 update 体 */ }
  private spawnVegetation(): void { /* 原逻辑 */ }
}
```

从 `host.node.scene`、`host.isValid` 替代 `this.scene` / `this.isValid`。

- [ ] **Step 2: 瘦 `Bootstrap`**

```ts
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  private app!: GameApp;

  start(): void {
    resources.loadDir('effects', EffectAsset, (err, assets) => {
      if (err) console.error('[Bootstrap] effect preload failed', err);
      if (!this.isValid) return;
      const list = assets ?? [];
      const effect = list.find((a) => a.name.includes('game-standard')) ?? list[0] ?? null;
      if (!effect) console.error('[Bootstrap] game-standard effect not found in resources/effects');
      this.app = new GameApp(this);
      this.app.start(effect);
    });
  }

  update(dt: number): void {
    this.app?.update(dt);
  }
}
```

- [ ] **Step 3: 编译/单测回归（逻辑未改，测试应仍绿）**

Run: `cd cocos && npm test`  
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/app/GameApp.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "$(cat <<'EOF'
refactor(app): extract GameApp from Bootstrap

EOF
)"
```

---

### Task 6: GameApp 接入 Pack + RuntimeConfig + HUD copy + taunts

**Files:**
- Modify: `cocos/assets/scripts/app/GameApp.ts`
- Modify: `cocos/assets/scripts/ui/HUD.ts`
- Modify: `cocos/assets/scripts/view/AnimalView.ts`（prefab UUID 可从 pack 注入）
- Modify: `cocos/assets/scripts/view/SkyView.ts`（cloud UUID 可从 pack 注入，若改动面过大可留 TODO 但 ground 植被 UUID 必须走 pack）

- [ ] **Step 1: `GameApp.start` 开头**

```ts
import { resolveScenePack } from './ActiveScene';
import { mergeRuntimeConfig } from '../core/mergeRuntimeConfig';
import { setRuntimeConfig } from '../core/RuntimeConfig';
import { GameConfig } from '../core/GameConfig';
import { pickFromPool } from '../core/AnimalTaunts';

const pack = resolveScenePack();
setRuntimeConfig(mergeRuntimeConfig(GameConfig, pack.config));
this.pack = pack;
```

- [ ] **Step 2: 植被 UUID 改为 `pack.ground.*`；踢腿/hit 扣币改用 `getRuntimeConfig().ANIMAL_COIN_LOSS`**

- [ ] **Step 3: HUD 支持注入 copy**

在 `HUD.build(copy?: CopyTheme)` 或 `HUD.applyCopy(copy)`：用 `pack.copy` 填 title/overlay/hint；`refresh` 里 stun 文案用 `stunMash` / `stunAnimal`。

- [ ] **Step 4: taunt 接线**

```ts
this.hazard.on('taunt', (a) => {
  const taunt = pickFromPool(this.pack.animals.taunts);
  this.hud.startFollowBanter(a.id, taunt);
});
```

- [ ] **Step 5: AnimalHazard 内所有 `C.ANIMAL_*` / `C.KICK_*` 改为 `getRuntimeConfig()` 对应字段**（模块级纯函数在调用时取 RC）。非主题字段可继续 `GameConfig`。

- [ ] **Step 6: 跑全量测试**

Run: `cd cocos && npm test`  
Expected: PASS（含既有 AnimalHazard 测试；若其依赖默认 RC，在 `beforeEach` 调 `resetRuntimeConfig()`）

- [ ] **Step 7: Commit**

```bash
git add cocos/assets/scripts/app/GameApp.ts \
  cocos/assets/scripts/ui/HUD.ts \
  cocos/assets/scripts/view \
  cocos/assets/scripts/core/AnimalHazard.ts \
  cocos/tests
git commit -m "$(cat <<'EOF'
feat(app): wire ScenePack and RuntimeConfig into GameApp

EOF
)"
```

---

### Task 7: PandaView 接入 AnimController

**Files:**
- Modify: `cocos/assets/scripts/view/PandaView.ts`
- Modify: `cocos/assets/scripts/app/GameApp.ts`

- [ ] **Step 1: `GameApp` 持有 `AnimController`**

接线替换：

```ts
// 原: this.hazard.on('kickStart', (a) => this.panda.playKick(a.side));
this.hazard.on('kickStart', (a) => {
  this.anim.playOverlay('kick', {
    duration: getRuntimeConfig().KICK_CLIP_S,
    priority: 10,
    side: a.side,
  });
});

this.state.on('grow', () => {
  this.anim.playOverlay('pressBounce', { duration: 0.25, priority: 1 });
  // 既有 audio/fx/hud …
});

this.state.on('stun', () => {
  this.anim.setStunned(true);
  // 既有 audio/rig/hud …
});
```

在 `update` 中：

```ts
this.anim.setStunned(this.state.stunned);
this.anim.update(dt);
this.panda.applyAnim(this.anim);
```

- [ ] **Step 2: 改写 `PandaView`**

- 删除对外 `playKick`（或保留薄封装转给 controller，但 GameApp 不再直接调）。
- 新增 `applyAnim(ctrl: AnimController)`：
  - `overlay?.id === 'kick'` → 既有镜像 + `crossFade('Kick'|'Animation')` 逻辑（从原 `playKick` 搬入，仅在 overlay 刚出现的一帧触发播放，用 `private lastKickToken` 防重复）。
  - `base === 'stunned'` → 原 stun euler。
  - `pressBounce` / `flash`：用 overlay 剩余寿命或保留 `flash` 由 grow 事件点亮（观感不变即可）。
- 位移/贴竹逻辑保持。

- [ ] **Step 3: 跑测 + 手动要点**

Run: `cd cocos && npm test`  
手动（编辑器预览）：击飞动物见踢腿；过急眩晕晃动；点按回弹仍在。

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/view/PandaView.ts cocos/assets/scripts/app/GameApp.ts
git commit -m "$(cat <<'EOF'
feat(character): drive panda micro-anims via AnimController

EOF
)"
```

---

### Task 8: 收尾文档 + 全量验证

**Files:**
- Modify: `docs/superpowers/specs/2026-08-13-layered-architecture-refactor-design.md`（状态 → 已实现）
- Modify: `README.md`（仓库结构补 `app/` `content/` `character/`；说明 `ACTIVE_SCENE_ID`）

- [x] **Step 1: 更新 README 结构说明与切换场景一行指引**

```md
# 切换场景内容包（无 UI）：改 cocos/assets/scripts/app/ActiveScene.ts 中 ACTIVE_SCENE_ID
```

- [x] **Step 2: spec 状态改为已实现，勾成功标准**

- [ ] **Step 3: 全量测试**

Run: `cd cocos && npm test`  
Expected: 全部 PASS

- [ ] **Step 4: 手动清单**

- default：生长 / 弯竹 / 拾币 / 动物踢飞 / 眩晕文案  
- `ACTIVE_SCENE_ID = 'work'`：标题或 overlay 文案变化且可玩  
- `ACTIVE_SCENE_ID = 'cny'`：同上  
- 改回 `default`

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-08-13-layered-architecture-refactor-design.md
git commit -m "$(cat <<'EOF'
docs: mark layered architecture refactor implemented

EOF
)"
```

---

## Self-Review（对照 spec）

| Spec 要求 | 对应 Task |
|---|---|
| app/content/character 分层；Bootstrap 瘦入口 | 5、6、8 |
| ScenePack + default/work/cny；启动常量切换 | 2、6 |
| ThemeableConfig 合并；未知 id 回退 | 1、2 |
| AnimController Base/Overlay；kick 迁入 | 4、7 |
| core 零渲染；Jest 覆盖合并与 Anim | 1、2、4 |
| default 行为 1:1；taunts/copy 进 Pack | 3、6 |
| 不挪 Bootstrap 路径以免断场景 | Task 5 引擎约束 |

无 TBD/TODO 占位步骤；类型名在各 Task 一致（`SceneId`、`ThemeableConfig`、`AnimController.playOverlay`）。

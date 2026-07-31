# 触屏弯竹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手机单指点按同时生长并朝触点方向冲量弯竹（±140px、短时回弹），保留自动晃动，便于微信小游戏触屏游玩。

**Architecture:** 新建纯 core `BendController` 管冲量与衰减；`Sway.composeTipSwayPx` 合成 auto+bend；`InputAdapter` 输出 `normX∈[-1,1]`；`Bootstrap` 仅在有效生长时 `impulse`，每帧 `bend.update`；`BambooMesh.swayPx` 改读合成值。金币刷点与节奏参数不动。

**Tech Stack:** Cocos Creator 3.8.8 · TypeScript · jest（`cd cocos && npx jest`）

**Spec:** `docs/superpowers/specs/2026-07-31-touch-bend-design.md`

**工作分支:** `feature/touch-bend`（已从 `main` 拉出）

**文件职责:**

| 文件 | 职责 |
|---|---|
| `cocos/assets/scripts/core/GameConfig.ts` | 弯竹常量 |
| `cocos/assets/scripts/core/BendController.ts` | 冲量 / 衰减 / `offsetPx` |
| `cocos/tests/BendController.test.ts` | BendController 单测 |
| `cocos/assets/scripts/core/Sway.ts` | `composeTipSwayPx` |
| `cocos/tests/Sway.test.ts` | 合成钳制用例 |
| `cocos/assets/scripts/platform/InputAdapter.ts` | `(normX)=>void`；触/鼠/空格 |
| `cocos/assets/scripts/Bootstrap.ts` | 接线 + 每帧 update |
| `cocos/assets/scripts/view/BambooMesh.ts` | 读 `bendOffsetPx` 合成 tip |
| `cocos/assets/scripts/ui/HUD.ts` | 触屏文案 |
| `cocos/assets/scripts/core/BendController.ts.meta` | Creator 脚本 meta（新建时写入） |

---

### Task 1: GameConfig 弯竹常量

**Files:**
- Modify: `cocos/assets/scripts/core/GameConfig.ts`

- [ ] **Step 1: 在 `SWAY_MAX_PX` 旁追加常量**

将 `GameConfig` 中 `SWAY_MAX_PX: 44,` 一段改为：

```ts
  SWAY_MAX_PX: 44,

  /** 单次满偏点按冲量 (px)；实际增量 = normX * IMPULSE_PX */
  IMPULSE_PX: 90,
  /** 冲量项钳制 (px) */
  BEND_MAX_PX: 140,
  /** 冲量指数衰减时间常数 (s) */
  BEND_TAU: 0.35,
  /** auto + bend 合成后尖端总钳制 (px) */
  TOTAL_SWAY_MAX_PX: 160,
```

- [ ] **Step 2: Commit**

```bash
git add cocos/assets/scripts/core/GameConfig.ts
git commit -m "feat(config): add touch-bend sway constants"
```

---

### Task 2: BendController（TDD）

**Files:**
- Create: `cocos/assets/scripts/core/BendController.ts`
- Create: `cocos/assets/scripts/core/BendController.ts.meta`
- Create: `cocos/tests/BendController.test.ts`

- [ ] **Step 1: 写失败测试 `cocos/tests/BendController.test.ts`**

```ts
import { BendController } from '../assets/scripts/core/BendController';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';

describe('BendController', () => {
  it('impulse pushes toward normX and clamps to ±BEND_MAX_PX', () => {
    const b = new BendController();
    b.impulse(1);
    expect(b.offsetPx).toBeCloseTo(C.IMPULSE_PX);
    b.impulse(1);
    expect(b.offsetPx).toBeCloseTo(C.BEND_MAX_PX);
    b.impulse(-1);
    expect(b.offsetPx).toBeCloseTo(C.BEND_MAX_PX - C.IMPULSE_PX);
  });

  it('opposite impulses cancel toward the other side', () => {
    const b = new BendController();
    b.impulse(1);
    b.impulse(-1);
    expect(b.offsetPx).toBeCloseTo(0);
  });

  it('update decays toward 0', () => {
    const b = new BendController();
    b.impulse(1);
    const before = b.offsetPx;
    b.update(C.BEND_TAU);
    expect(Math.abs(b.offsetPx)).toBeLessThan(Math.abs(before));
    expect(b.offsetPx).toBeCloseTo(before * Math.exp(-1));
    for (let i = 0; i < 40; i++) b.update(0.2);
    expect(Math.abs(b.offsetPx)).toBeLessThan(0.01);
  });

  it('clamps normX into [-1, 1]', () => {
    const b = new BendController();
    b.impulse(3);
    expect(b.offsetPx).toBeCloseTo(C.IMPULSE_PX);
    b.impulse(-10);
    expect(b.offsetPx).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest tests/BendController.test.ts`

Expected: FAIL（无法 resolve 模块）

- [ ] **Step 3: 实现 `cocos/assets/scripts/core/BendController.ts`**

```ts
import { GameConfig as C } from './GameConfig';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 触屏弯竹冲量 —— 纯逻辑，无渲染依赖。 */
export class BendController {
  offsetPx = 0;

  /** normX ∈ [-1,1]（屏幕中线=0）；超出范围先钳再积分。 */
  impulse(normX: number): void {
    const n = clamp(normX, -1, 1);
    this.offsetPx = clamp(this.offsetPx + n * C.IMPULSE_PX, -C.BEND_MAX_PX, C.BEND_MAX_PX);
  }

  update(dt: number): void {
    if (dt <= 0 || this.offsetPx === 0) return;
    this.offsetPx *= Math.exp(-dt / C.BEND_TAU);
    if (Math.abs(this.offsetPx) < 0.01) this.offsetPx = 0;
  }
}
```

- [ ] **Step 4: 写 meta（Creator 也可自动生成；提交需带 uuid）**

Create `cocos/assets/scripts/core/BendController.ts.meta`（uuid 用新生成的，勿抄其它文件）：

```bash
# macOS
UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
cat > cocos/assets/scripts/core/BendController.ts.meta <<EOF
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "$UUID",
  "files": [],
  "subMetas": {},
  "userData": {}
}
EOF
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd cocos && npx jest tests/BendController.test.ts`

Expected: PASS（4 tests）

- [ ] **Step 6: Commit**

```bash
git add cocos/assets/scripts/core/BendController.ts \
  cocos/assets/scripts/core/BendController.ts.meta \
  cocos/tests/BendController.test.ts
git commit -m "feat(core): BendController impulse + decay"
```

---

### Task 3: Sway 合成函数（TDD）

**Files:**
- Modify: `cocos/assets/scripts/core/Sway.ts`
- Modify: `cocos/tests/Sway.test.ts`

- [ ] **Step 1: 在 `Sway.test.ts` 追加合成用例**

在现有 `describe('tipSwayPx', …)` **之后**追加：

```ts
import { tipSwayPx, composeTipSwayPx } from '../assets/scripts/core/Sway';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';

// 把文件顶部的 import { tipSwayPx } 换成上面这一行（含 composeTipSwayPx + GameConfig）

describe('composeTipSwayPx', () => {
  it('adds auto and bend', () => {
    expect(composeTipSwayPx(10, 20)).toBe(30);
  });

  it('clamps to ±TOTAL_SWAY_MAX_PX', () => {
    expect(composeTipSwayPx(C.SWAY_MAX_PX, C.BEND_MAX_PX)).toBe(C.TOTAL_SWAY_MAX_PX);
    expect(composeTipSwayPx(-C.SWAY_MAX_PX, -C.BEND_MAX_PX)).toBe(-C.TOTAL_SWAY_MAX_PX);
  });
});
```

注意：文件顶部只能有一份 import；合并为：

```ts
import { tipSwayPx, composeTipSwayPx } from '../assets/scripts/core/Sway';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest tests/Sway.test.ts`

Expected: FAIL（`composeTipSwayPx` 未导出）

- [ ] **Step 3: 在 `Sway.ts` 追加合成函数**

完整文件应为：

```ts
import { GameConfig as C } from './GameConfig';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 竹尖自动摆动(px)—— 原型公式直译:基础摆动 + 生长拉扯 + 眩晕抖动,钳制 ±SWAY_MAX_PX。 */
export function tipSwayPx(tSec: number, heightPx: number, targetHeightPx: number, stunned: boolean): number {
  if (heightPx < 1) return 0;
  const growPull = clamp((targetHeightPx - heightPx) * 0.06, -18, 18);
  const baseAmp = 14 + Math.min(heightPx / 300, 1) * 10;
  const dizzyWob = stunned ? Math.sin(tSec * 22) * 10 : 0;
  return clamp(Math.sin(tSec * 1.6) * baseAmp + growPull + dizzyWob, -C.SWAY_MAX_PX, C.SWAY_MAX_PX);
}

/** 自动晃动 + 触屏冲量 → 尖端总偏移。 */
export function composeTipSwayPx(autoPx: number, bendOffsetPx: number): number {
  return clamp(autoPx + bendOffsetPx, -C.TOTAL_SWAY_MAX_PX, C.TOTAL_SWAY_MAX_PX);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos && npx jest tests/Sway.test.ts`

Expected: PASS（原 tipSwayPx 用例 + 新 compose 用例）

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/Sway.ts cocos/tests/Sway.test.ts
git commit -m "feat(core): compose auto sway with bend offset"
```

---

### Task 4: InputAdapter 输出 normX

**Files:**
- Modify: `cocos/assets/scripts/platform/InputAdapter.ts`

- [ ] **Step 1: 重写 `InputAdapter.ts`**

用下列完整实现替换文件（空格→0；触/鼠带 X；30ms 去抖避免 touch+mouse 双触发导致连按眩晕）：

```ts
import { input, Input, EventKeyboard, EventTouch, EventMouse, KeyCode, view } from 'cc';

/** 键盘空格 / 触摸 / 鼠标 → press(normX)。normX∈[-1,1]，中线=0；空格恒为 0。 */
export class InputAdapter {
  private lastFireMs = 0;

  constructor(private onPress: (normX: number) => void) {}

  attach(): void {
    input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.on(Input.EventType.TOUCH_START, this.touchStart, this);
    input.on(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
  }

  detach(): void {
    input.off(Input.EventType.KEY_DOWN, this.keyDown, this);
    input.off(Input.EventType.TOUCH_START, this.touchStart, this);
    input.off(Input.EventType.MOUSE_DOWN, this.mouseDown, this);
  }

  private fire(normX: number): void {
    const now = Date.now();
    if (now - this.lastFireMs < 30) return;
    this.lastFireMs = now;
    this.onPress(normX);
  }

  private uiXToNormX(uiX: number): number {
    const w = view.getVisibleSize().width;
    if (w <= 0) return 0;
    const n = (uiX - w / 2) / (w / 2);
    return Math.max(-1, Math.min(1, n));
  }

  private keyDown(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) this.fire(0);
  }

  private touchStart(e: EventTouch): void {
    this.fire(this.uiXToNormX(e.getUILocation().x));
  }

  private mouseDown(e: EventMouse): void {
    this.fire(this.uiXToNormX(e.getUILocation().x));
  }
}
```

- [ ] **Step 2: 同步改 Bootstrap 回调签名（暂不 impulse，保持可编译）**

将 `Bootstrap.ts` 中：

```ts
    new InputAdapter(() => {
      const r = this.state.press();
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned}`);
      else console.log('[press] start/ignored');
      this.hud.refresh(this.state, this.score);
    }).attach();
```

改为（`_normX` 占位，Task 5 再接 bend）：

```ts
    new InputAdapter((_normX) => {
      const r = this.state.press();
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned}`);
      else console.log('[press] start/ignored');
      this.hud.refresh(this.state, this.score);
    }).attach();
```

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/scripts/platform/InputAdapter.ts cocos/assets/scripts/Bootstrap.ts
git commit -m "feat(input): emit normX for touch/mouse press"
```

---

### Task 5: Bootstrap + BambooMesh 接线

**Files:**
- Modify: `cocos/assets/scripts/Bootstrap.ts`
- Modify: `cocos/assets/scripts/view/BambooMesh.ts`

- [ ] **Step 1: `BambooMesh` 读冲量偏移**

1. 将 import 改为：

```ts
import { tipSwayPx, composeTipSwayPx } from '../core/Sway';
```

2. 在类字段 `swayPx = 0;` 下增加：

```ts
  /** 由 Bootstrap 每帧写入 BendController.offsetPx */
  bendOffsetPx = 0;
```

3. 将 `update` 内这一行：

```ts
    this.swayPx = tipSwayPx(s.t, s.heightPx, s.targetHeightPx, s.stunned);
```

改为：

```ts
    const auto = tipSwayPx(s.t, s.heightPx, s.targetHeightPx, s.stunned);
    this.swayPx = composeTipSwayPx(auto, this.bendOffsetPx);
```

- [ ] **Step 2: `Bootstrap` 持有 BendController 并接线**

1. 增加 import：

```ts
import { BendController } from './core/BendController';
```

2. 在类字段区（`private audioFx` 附近）增加：

```ts
  private bend = new BendController();
```

3. 将 `buildScene` 末尾 InputAdapter 块替换为：

```ts
    new InputAdapter((normX) => {
      const r = this.state.press();
      if (r && !r.stunned) this.bend.impulse(normX);
      if (r) console.log(`[press] combo=${r.combo} gain=${r.gainPx.toFixed(1)} stunned=${r.stunned} bend=${this.bend.offsetPx.toFixed(1)}`);
      else console.log('[press] start/ignored');
      this.hud.refresh(this.state, this.score);
    }).attach();
```

4. 在 `update(dt)` 里，`this.state.update(dt);` 之后立刻加：

```ts
    this.bend.update(dt);
    if (this.bamboo) this.bamboo.bendOffsetPx = this.bend.offsetPx;
```

- [ ] **Step 3: 跑全部 core 单测**

Run: `cd cocos && npx jest`

Expected: PASS（含 BendController / Sway / 既有用例）

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/Bootstrap.ts cocos/assets/scripts/view/BambooMesh.ts
git commit -m "feat: wire BendController into press and bamboo tip"
```

---

### Task 6: HUD 触屏文案

**Files:**
- Modify: `cocos/assets/scripts/ui/HUD.ts`

- [ ] **Step 1: 改 `build()` 两处文案**

将：

```ts
    this.lOverlay = this.makeLabel('按 空格 / 点按屏幕 开始', 24, 0, -12, white, 'center');
    this.makeLabel('节奏点按 0.1~0.5秒/次 · 太急眩晕 · 太慢断连击', 15, 0, -278, white, 'center');
```

改为：

```ts
    this.lOverlay = this.makeLabel('点屏幕开始 · 点哪边竹往哪边弯', 22, 0, -12, white, 'center');
    this.makeLabel('节奏点按 0.1~0.5秒/次 · 侧点弯竹 · 太急眩晕 · 空格只生长', 14, 0, -278, white, 'center');
```

- [ ] **Step 2: Commit**

```bash
git add cocos/assets/scripts/ui/HUD.ts
git commit -m "feat(ui): touch-first HUD copy for bend controls"
```

---

### Task 7: MANUAL —— Creator / 手机预览验收

**Files:** 无代码（对照 spec 验收）

- [ ] **Step 1: 打开工程**

1. Cocos Creator 3.8.8 打开 `cocos/`
2. 确认 `BendController.ts` 无编译红线（若缺 `.meta`，等编辑器生成后再把 meta 纳入 git）
3. 预览主场景

- [ ] **Step 2: 手感清单**

| # | 操作 | 期望 |
|---|---|---|
| 1 | 点屏幕左侧（已开局） | 生长 + 竹尖向左弹弯，约 0.5s 内回中 |
| 2 | 点屏幕右侧 | 向右弹弯 |
| 3 | 同侧连点（节奏内） | 弯幅可叠到明显侧移（接近 ±140） |
| 4 | 狂点触发眩晕 | 眩晕当次不额外甩弯；晕期间点按无效 |
| 5 | 空格 | 只生长，不明显侧弯（仅剩自动晃动） |
| 6 | 鼠标点击左右 | 与触屏同向弯 |
| 7 | 开始遮罩文案 | 「点屏幕开始 · 点哪边竹往哪边弯」 |

- [ ] **Step 3: 若手感不对（仅调常量，不改架构）**

在 `GameConfig.ts` 微调：`IMPULSE_PX` / `BEND_TAU` / `BEND_MAX_PX`，再预览。勿在本任务放宽金币刷点。

- [ ] **Step 4: Commit 仅当有常量微调或补交 meta**

```bash
git add -A cocos/assets/scripts/core/GameConfig.ts cocos/assets/scripts/core/BendController.ts.meta
git commit -m "tune: touch-bend feel constants after manual QA"
```

（若无改动则跳过 commit。）

---

## Spec 覆盖自检

| Spec 要求 | Task |
|---|---|
| 点哪弯哪 + 生长 | 4, 5 |
| 冲量回弹 τ≈0.35 | 2 |
| ±140 / 总钳 ±160 | 1, 2, 3 |
| 保留自动晃动并叠加 | 3, 5 |
| 金币刷点不改 | （无任务 = 不做） |
| BendController 独立 | 2 |
| 空格 normX=0 | 4 |
| 鼠标带 X | 4 |
| 首按/stun 不冲量 | 5（`r && !r.stunned`） |
| HUD 文案 | 6 |
| Jest | 2, 3, 5 |
| 手动验收 | 7 |
| 分支 `feature/touch-bend` | 已建 |

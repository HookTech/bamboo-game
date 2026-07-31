# 手机日月适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按相机可见半宽比例放置太阳/月亮，竖屏窄 aspect 下不出视锥。

**Architecture:** `skyMath` 提供 `visibleHalfWidthM` / `sunLocalX`；`SkyView` 保存 Camera，build + aspect 变化时更新 `sunMoon` 本地 X；Y/Z 不变。

**Tech Stack:** Cocos Creator 3.8.8 · TypeScript · jest

**Spec:** `docs/superpowers/specs/2026-07-31-mobile-sky-fit-design.md`

**工作分支:** `feature/mobile-sky-fit`

**文件职责:**

| 文件 | 职责 |
|---|---|
| `cocos/assets/scripts/core/GameConfig.ts` | `SUN_X_FRAC` / `SUN_LOCAL_Y` / `SUN_LOCAL_Z` |
| `cocos/assets/scripts/core/skyMath.ts` | `visibleHalfWidthM` / `sunLocalX` |
| `cocos/tests/skyMath.test.ts` | 半宽与太阳 X 用例 |
| `cocos/assets/scripts/view/SkyView.ts` | 用 aspect 更新日月位置 |

---

### Task 1: GameConfig 常量

**Files:**
- Modify: `cocos/assets/scripts/core/GameConfig.ts`

- [ ] **Step 1: 追加常量**（放在 `CAMERA_DISTANCE_M` 旁）

```ts
  CAMERA_DISTANCE_M: 22.4,

  /** 日月相对可见半宽的水平比例(右侧为正) */
  SUN_X_FRAC: 0.58,
  SUN_LOCAL_Y: 5.5,
  SUN_LOCAL_Z: -37,
```

- [ ] **Step 2: Commit**

```bash
git add cocos/assets/scripts/core/GameConfig.ts
git commit -m "feat(config): sun local placement constants for sky-fit"
```

---

### Task 2: skyMath 纯函数（TDD）

**Files:**
- Modify: `cocos/assets/scripts/core/skyMath.ts`
- Modify: `cocos/tests/skyMath.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `skyMath.test.ts` 顶部 import 增加 `visibleHalfWidthM, sunLocalX`，并追加：

```ts
  it('visibleHalfWidthM matches design 4:3 ≈ 8m', () => {
    expect(visibleHalfWidthM(C.DESIGN_W / C.DESIGN_H)).toBeCloseTo(8, 0);
  });

  it('sunLocalX stays inside half-width and shrinks on portrait', () => {
    const aWide = C.DESIGN_W / C.DESIGN_H;
    const aTall = 9 / 16;
    const xWide = sunLocalX(aWide);
    const xTall = sunLocalX(aTall);
    expect(xWide).toBeGreaterThan(0);
    expect(xTall).toBeGreaterThan(0);
    expect(xTall).toBeLessThan(xWide);
    expect(xWide).toBeLessThan(visibleHalfWidthM(aWide));
    expect(xTall).toBeLessThan(visibleHalfWidthM(aTall));
    expect(xWide).toBeCloseTo(visibleHalfWidthM(aWide) * C.SUN_X_FRAC);
  });
```

- [ ] **Step 2: 跑测确认失败**

Run: `cd cocos && npx jest tests/skyMath.test.ts`  
Expected: FAIL（未导出）

- [ ] **Step 3: 实现**

在 `skyMath.ts` 追加：

```ts
const FOV_DEG = 30;

/** 相机局部可见半宽(m)：FOV 垂直 × aspect。 */
export function visibleHalfWidthM(aspect: number): number {
  const a = Math.max(aspect, 1e-6);
  const visibleH = 2 * C.CAMERA_DISTANCE_M * Math.tan((FOV_DEG / 2) * Math.PI / 180);
  return (visibleH * a) / 2;
}

/** 日月相机局部 X(m)，右侧为正。 */
export function sunLocalX(aspect: number): number {
  return visibleHalfWidthM(aspect) * C.SUN_X_FRAC;
}
```

- [ ] **Step 4: 跑测确认通过**

Run: `cd cocos && npx jest tests/skyMath.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/skyMath.ts cocos/tests/skyMath.test.ts
git commit -m "feat(core): aspect-based sun local X helpers"
```

---

### Task 3: SkyView 接线

**Files:**
- Modify: `cocos/assets/scripts/view/SkyView.ts`

- [ ] **Step 1: import 与字段**

```ts
import { nightK, cloudAlpha, nearCloudAllowedX, sunLocalX } from '../core/skyMath';
import { GameConfig as C } from '../core/GameConfig';
```

增加字段：

```ts
  private cam: Camera | null = null;
  private lastAspect = -1;
```

- [ ] **Step 2: build 里用配置放置并保存 cam**

将：

```ts
    this.sunMoon.setPosition(8, 5.5, -37);
```

改为先占位（随后 `layoutSun`），并在 `loadClouds` 之后：

```ts
    this.cam = cam;
    this.layoutSun(true);
    this.lastK = -1;
```

删除 `void cam;`。

新增私有方法：

```ts
  private layoutSun(force = false): void {
    if (!this.sunMoon) return;
    const aspect = this.cam?.camera?.aspect ?? (C.DESIGN_W / C.DESIGN_H);
    if (!force && Math.abs(aspect - this.lastAspect) <= 0.01) return;
    this.lastAspect = aspect;
    this.sunMoon.setPosition(sunLocalX(aspect), C.SUN_LOCAL_Y, C.SUN_LOCAL_Z);
  }
```

在 `update` 开头（`if (!s) return;` 之后）调用 `this.layoutSun();`。

- [ ] **Step 3: 全量测试**

Run: `cd cocos && npx jest`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/view/SkyView.ts
git commit -m "feat(sky): place sun/moon from camera aspect"
```

---

### Task 4: MANUAL —— 竖屏预览验收

- [ ] Creator 打开 `cocos/`，预览主场景
- [ ] 窄/竖屏窗口：日月仍在右上内侧
- [ ] 横屏：可见；昼夜切换正常

---

## Spec 覆盖

| Spec | Task |
|---|---|
| sunX = halfW × 0.58 | 1, 2 |
| Y/Z 不变 | 1, 3 |
| aspect 变化重算 | 3 |
| Jest | 2 |
| 云星植被不动 | （无任务） |
| 手动验收 | 4 |

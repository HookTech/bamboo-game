# 弯竹半宽适配 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 弯竹上限与金币水平分布随相机可见半宽缩放，横屏接近半屏、竖屏同比收窄。

**Architecture:** 新增纯函数 `layoutMath.ts`；`BendController` 持动态 `maxPx`；`composeTipSwayPx` 接受动态 totalMax；`CoinView`/`Bootstrap` 每帧注入 `halfW`。

**Tech Stack:** TypeScript · Jest · Cocos Creator 3.8

**Worktree:** `/Users/hehuajun/.config/superpowers/worktrees/bamboo-game/feature-sky-animal-hazard`

---

### Task 1: layoutMath + GameConfig 比例常量

**Files:**
- Create: `cocos/assets/scripts/core/layoutMath.ts`
- Create: `cocos/tests/layoutMath.test.ts`
- Modify: `cocos/assets/scripts/core/GameConfig.ts`

- [ ] **Step 1: 写失败测试** `layoutMath.test.ts`
- [ ] **Step 2: 实现 `layoutMath` + config fracs**
- [ ] **Step 3: 测试通过**

### Task 2: BendController 动态 max

**Files:**
- Modify: `cocos/assets/scripts/core/BendController.ts`
- Modify: `cocos/tests/BendController.test.ts`

- [ ] **Step 1: 测试 `setMaxPx` / impulse 钳制**
- [ ] **Step 2: 实现**
- [ ] **Step 3: 通过**

### Task 3: composeTipSwayPx 动态 totalMax

**Files:**
- Modify: `cocos/assets/scripts/core/Sway.ts`
- Modify: `cocos/tests/Sway.test.ts`
- Modify: `cocos/assets/scripts/view/BambooMesh.ts`（若直接调用）

- [ ] **Step 1–3: TDD 动态 totalMax**

### Task 4: CoinView + Bootstrap 接线

**Files:**
- Modify: `cocos/assets/scripts/view/CoinView.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`
- Modify: touch-bend design 交叉引用（可选一句）

- [ ] **Step 1: CoinView 用 layoutMath**
- [ ] **Step 2: Bootstrap 每帧 `bend.setMaxPx(bendMaxPx(halfW))` 并传 totalMax**
- [ ] **Step 3: 全量 `npm test`**
---

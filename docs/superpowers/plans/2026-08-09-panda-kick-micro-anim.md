# 熊猫踢腿微动作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 撞飞动物时熊猫先播短踢腿（按 `side` 镜像），接触帧后再进入既有 `knock` 飞出流程。

**Architecture:** `AnimalHazard` 新增 `kick` 相位与 `kickStart` 事件；接触时刻由 `KICK_CONTACT_S` 驱动 `knock`（纯逻辑、可测）。`PandaView` 用 `SkeletalAnimation` 播放从 `panda.glb` 截取的踢腿 clip，根节点 sway/stun 不变。`Bootstrap` 把 `kickStart` 接到 `PandaView`。

**Tech Stack:** Cocos Creator 3.8.8 · TypeScript · Jest（`cd cocos && npx jest`）· `SkeletalAnimation`

**Spec:** `docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md`

**工作分支:** 从 `main` 拉 `feature/panda-kick-micro-anim`（若尚未创建）

**文件职责:**

| 文件 | 职责 |
|---|---|
| `cocos/assets/scripts/core/GameConfig.ts` | `KICK_*` 时序/截取常量 |
| `cocos/assets/scripts/core/AnimalHazard.ts` | `kick` 相位、`kickStart`、接触后 `knock` |
| `cocos/tests/AnimalHazard.test.ts` | kick 状态机单测；更新旧「瞬间 knock」期望 |
| `cocos/assets/scripts/view/PandaView.ts` | `SkeletalAnimation`、播踢腿、镜像 |
| `cocos/assets/scripts/Bootstrap.ts` | `kickStart` → `PandaView.playKick` |
| `cocos/assets/models/panda.glb.meta` | 增加 `Kick` 动画切片（from/to） |
| `docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md` | 状态改为实现中 |
| `ASSETS.md` | 若启用 Mixamo 后备则补署名（主路径截 clip 则可不改） |

---

### Task 1: 开分支 + Config + spec 状态

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md`
- Modify: `cocos/assets/scripts/core/GameConfig.ts`
- Create branch: `feature/panda-kick-micro-anim`

- [ ] **Step 1: 建分支**

```bash
cd /Users/hehuajun/bamboo-game
git checkout main
git pull --ff-only
git checkout -b feature/panda-kick-micro-anim
```

- [ ] **Step 2: 更新 spec 抬头**

将：

```md
状态: 待实现
```

改为：

```md
状态: 实现中  
分支: `feature/panda-kick-micro-anim`
```

- [ ] **Step 3: 在 `GameConfig` 的 `ANIMAL_KNOCK_DESPAWN_S` 后追加**

```ts
  /** 进入 kick 后到 commitKnock（接触帧） */
  KICK_CONTACT_S: 0.15,
  /** 踢腿 clip 播放时长（镜像结束后可提前恢复 scale） */
  KICK_CLIP_S: 0.4,
  /** 从 panda Animation 截取 Kick 的起止秒（预览后可改 meta + 此处文档对齐） */
  KICK_CLIP_FROM: 0.0,
  KICK_CLIP_TO: 0.4,
```

> 注：`FROM`/`TO` 初值先等于 clip 窗口；Task 5 预览后若改 meta 切片，同步改这两常量（常量供文档/可选运行时校验，真正播放名以 meta 里 `Kick` 为准）。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md \
  cocos/assets/scripts/core/GameConfig.ts
git commit -m "$(cat <<'EOF'
feat(config): kick contact timing constants

EOF
)"
```

---

### Task 2: 写失败单测（kick 状态机）

**Files:**
- Modify: `cocos/tests/AnimalHazard.test.ts`
- Modify: `cocos/assets/scripts/core/AnimalHazard.ts`（本 Task **只改类型/字段默认值**，不改 `update` 行为）

- [ ] **Step 1: 类型桩（让测试能编译）**

在 `AnimalHazard.ts` 仅做：

```ts
export type AnimalPhase = 'fadeIn' | 'dive' | 'kick' | 'knock' | 'hit' | 'gone';
export type AnimalEvent = 'spawn' | 'kickStart' | 'knock' | 'hit' | 'despawn' | 'taunt';
// Animal 接口增加: kickAge: number;
// trySpawn 创建实体时 kickAge: 0
```

**不要**改 `update`（仍瞬间 `knock`）——这样 Step 3 才会因行为不符而失败。

- [ ] **Step 2: 更新既有「瞬间 knock」用例为 kick→knock**

把 `AnimalHazard combat` 里：

- `knocks when tip in radius...`
- `prefers knock over hit same frame`

改为期望**同帧进入 `kick` + 发 `kickStart`，不发 `knock`**；再推进时间后才 `knock`。

在 `mkAnimal` 的默认对象里增加 `kickAge: 0`（与即将扩展的 `Animal` 对齐）。

替换/新增用例如下（放在 `describe('AnimalHazard combat')` 内；可删改旧同名 it）：

```ts
  it('enters kick (not knock) when tip in radius, bend strong and same side', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 40, yPx: 200, side: 1, phase: 'dive' });
    let kicks = 0;
    let knocked = 0;
    h.on('kickStart', () => kicks++);
    h.on('knock', () => knocked++);
    h.update({ ...inp, tipX: 0, tipY: 200, bendOffset: 60 });
    expect(kicks).toBe(1);
    expect(knocked).toBe(0);
    expect(a.phase).toBe('kick');
  });

  it('commits knock after KICK_CONTACT_S', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 40, yPx: 200, side: 1, phase: 'dive' });
    let knocked = 0;
    h.on('knock', () => knocked++);
    h.update({ ...inp, tipX: 0, tipY: 200, bendOffset: 60, dt: 0.05 });
    expect(a.phase).toBe('kick');
    h.update({ ...inp, tipX: 0, tipY: 200, bendOffset: 60, dt: C.KICK_CONTACT_S });
    expect(knocked).toBe(1);
    expect(a.phase).toBe('knock');
  });

  it('freezes position and ignores hit during kick', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 40, yPx: 200, side: 1, phase: 'dive' });
    let hits = 0;
    h.on('hit', () => hits++);
    h.update({ ...inp, tipX: 0, tipY: 200, bendOffset: 60, dt: 0.05 });
    // 把动物「放到」熊猫脸上，kick 中仍不应 hit
    a.xPx = 0;
    a.yPx = 174;
    h.update({
      ...inp,
      tipX: 0,
      tipY: 200,
      pandaX: 0,
      pandaY: 174,
      bendOffset: 0,
      dt: 0.05,
    });
    expect(hits).toBe(0);
    expect(a.phase).toBe('kick');
    // 冻结的是 integrate；手动改坐标后下帧也不应被 dive 拉开——实现应 skip integrate
    // 这里断言 phase 仍 kick 且未 gone
    expect(a.phase).not.toBe('gone');
    // 恢复后用未篡改坐标再测冻结：重新造一只
    const h2 = new AnimalHazard(() => 0);
    const b = mkAnimal(h2, { xPx: 40, yPx: 200, side: 1, phase: 'dive' });
    h2.update({ ...inp, tipX: 0, tipY: 200, bendOffset: 60, dt: 0.05 });
    const bx = b.xPx;
    const by = b.yPx;
    h2.update({ ...inp, tipX: 200, tipY: 400, bendOffset: 0, dt: 0.2, pandaX: 0, pandaY: 174 });
    expect(b.xPx).toBe(bx);
    expect(b.yPx).toBe(by);
    expect(b.phase).toBe('kick');
  });

  it('prefers kick over hit same frame', () => {
    const h = new AnimalHazard(() => 0);
    const a = mkAnimal(h, { xPx: 20, yPx: 180, side: 1, phase: 'dive' });
    let kicks = 0;
    let hits = 0;
    h.on('kickStart', () => kicks++);
    h.on('hit', () => hits++);
    h.update({ ...inp, tipX: 0, tipY: 180, pandaX: 0, pandaY: 174, bendOffset: 80 });
    expect(kicks).toBe(1);
    expect(hits).toBe(0);
    expect(a.phase).toBe('kick');
  });
```

并更新 `mkAnimal`：

```ts
  function mkAnimal(h: AnimalHazard, over: Partial<Animal> = {}) {
    const a = {
      id: 1,
      kind: 'bird' as const,
      xPx: 55,
      yPx: 200,
      side: 1 as const,
      phase: 'dive' as const,
      age: 1,
      kickAge: 0,
      knockAge: 0,
      taunted: false,
      ...over,
    };
    h.animals.push(a);
    return a;
  }
```

- [ ] **Step 3: 跑测确认失败**

```bash
cd /Users/hehuajun/bamboo-game/cocos && npx jest tests/AnimalHazard.test.ts -v
```

Expected: FAIL（旧逻辑仍瞬间 `knock`，或同帧未进 `kick`）

- [ ] **Step 4: Commit 测试与类型桩**

```bash
git add cocos/tests/AnimalHazard.test.ts cocos/assets/scripts/core/AnimalHazard.ts
git commit -m "$(cat <<'EOF'
test(animal): expect kick phase before knock

EOF
)"
```

---

### Task 3: 实现 AnimalHazard `kick` 相位

**Files:**
- Modify: `cocos/assets/scripts/core/AnimalHazard.ts`

- [ ] **Step 1: 确认 Task 2 类型桩已在**（`kick` / `kickStart` / `kickAge`）。若缺失则先补齐。

- [ ] **Step 2: 改 `update` 状态机**

将 `canKnock` 分支从瞬间 `knock` 改为进入 `kick`；为 `kick` 相位累加 `kickAge`，到达 `C.KICK_CONTACT_S` 后 `commitKnock`。`kick` 中 `continue`（不 integrate、不 hit）。

核心逻辑（替换 `update` 内循环主体）：

```ts
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
      if (a.phase === 'kick') {
        a.kickAge += inp.dt;
        if (a.kickAge >= C.KICK_CONTACT_S) {
          a.phase = 'knock';
          a.knockAge = 0;
          this.emit('knock', a);
        }
        continue;
      }
      if (a.phase === 'hit') continue;
      if (hitThisFrame) continue;
      if (this.canKnock(a, inp)) {
        a.phase = 'kick';
        a.kickAge = 0;
        this.emit('kickStart', a);
        continue;
      }
      this.integrate(a, inp);
      if (this.canHit(a, inp)) {
        a.phase = 'hit';
        this.postHitUntil = inp.t + C.ANIMAL_POST_HIT_COOLDOWN_S;
        this.emit('hit', a);
        this.emit('despawn', a);
        a.phase = 'gone';
        hitThisFrame = true;
      }
    }
  }
```

- [ ] **Step 3: 跑测通过**

```bash
cd /Users/hehuajun/bamboo-game/cocos && npx jest tests/AnimalHazard.test.ts -v
```

Expected: PASS（全文件绿灯）

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/core/AnimalHazard.ts cocos/tests/AnimalHazard.test.ts
git commit -m "$(cat <<'EOF'
feat(animal): kick phase before knock commit

EOF
)"
```

---

### Task 4: PandaView 播踢腿 + 镜像

**Files:**
- Modify: `cocos/assets/scripts/view/PandaView.ts`

- [ ] **Step 1: 增加动画字段与 `playKick`**

在现有 import 中加入 `SkeletalAnimation`。`applyModel` 后缓存 `SkeletalAnimation`（prefab 上已有则 `getComponentInChildren`，否则 `addComponent` 并依赖 clip 已在模型资源上）。

```ts
import {
  _decorator, Component, MeshRenderer, Material, Color, Vec3, utils, primitives,
  EffectAsset, assetManager, Prefab, instantiate, Node, SkeletalAnimation,
} from 'cc';
```

类内新增：

```ts
  private anim: SkeletalAnimation | null = null;
  private kickMirrorUntil = 0;
  private baseModelScaleX = 1;
```

在 `applyModel` 末尾（`this.model = model` 之后）：

```ts
    this.anim = model.getComponent(SkeletalAnimation)
      ?? model.getComponentInChildren(SkeletalAnimation);
    this.baseModelScaleX = model.scale.x;
```

新增公开方法：

```ts
  /** Bootstrap 在 kickStart 时调用；side 与 Animal.side 一致。 */
  playKick(side: -1 | 1): void {
    const model = this.model;
    if (!model?.isValid) return;
    // 镜像打在模型子节点，不影响父节点 stun euler
    const sx = this.baseModelScaleX * (side < 0 ? -1 : 1);
    model.setScale(sx, model.scale.y, model.scale.z);
    this.kickMirrorUntil = C.KICK_CLIP_S;
    const anim = this.anim;
    if (!anim) return;
    // clip 名与 Task 5 meta 切片一致；缺失时静默（hazard 仍会 knock）
    const name = anim.clips?.some((c) => c?.name === 'Kick') ? 'Kick' : 'Animation';
    try {
      anim.crossFade(name, 0.05);
    } catch {
      // clip 未就绪时忽略
    }
  }
```

在 `update` 开头处理镜像恢复（在 early-return 之前用独立计时，避免无 state 时卡死镜像）：

```ts
  update(dt: number): void {
    if (this.kickMirrorUntil > 0) {
      this.kickMirrorUntil = Math.max(0, this.kickMirrorUntil - dt);
      if (this.kickMirrorUntil === 0 && this.model?.isValid) {
        const m = this.model;
        m.setScale(this.baseModelScaleX, m.scale.y, m.scale.z);
      }
    }
    const s = this.state;
    // ...existing body unchanged...
```

- [ ] **Step 2: 在 Creator 外无法完整播动画时，至少保证编译与逻辑**

```bash
cd /Users/hehuajun/bamboo-game/cocos && npx jest -v
```

Expected: PASS（既有套件；PandaView 无单测）

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/scripts/view/PandaView.ts
git commit -m "$(cat <<'EOF'
feat(panda): play mirrored kick clip on kickStart

EOF
)"
```

---

### Task 5: 截取 `Kick` 动画切片（meta）

**Files:**
- Modify: `cocos/assets/models/panda.glb.meta`

- [ ] **Step 1: 在 glTF 动画导入配置中增加 `Kick` 切片**

打开 `panda.glb.meta`，在现有 `Animation` 条目旁增加同结构切片（具体 JSON 键名以文件内 `userData.animationImportSettings` / `clips` 数组为准——编辑前先读文件定位）。目标效果：

- 名称：`Kick`
- `from`: `GameConfig.KICK_CLIP_FROM`（初值 `0.0`）
- `to`: `GameConfig.KICK_CLIP_TO`（初值 `0.4`）

若 meta 使用单一 clip 的 `duration` 列表，按 Creator 3.8 惯例追加：

```json
{
  "name": "Kick",
  "from": 0.0,
  "to": 0.4
}
```

保存后在 Cocos Creator 中选中 `panda.glb` → 确认 reimport，Prefab 上 `SkeletalAnimation` 的 clips 含 `Kick`。

- [ ] **Step 2: 预览并校准**

在编辑器预览 `Kick`：若不像踢腿，微调 `from`/`to`（建议步进 0.1s 扫描 0–4.67s），同步改：

1. `panda.glb.meta` 切片  
2. `GameConfig.KICK_CLIP_FROM` / `KICK_CLIP_TO` / 必要时 `KICK_CONTACT_S`（接触应落在脚伸最远附近）

若全程找不到可用段：在 PR 说明里标注「需 Mixamo 后备」，不阻塞 Task 6 接线；逻辑层已可玩。

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/models/panda.glb.meta cocos/assets/scripts/core/GameConfig.ts
git commit -m "$(cat <<'EOF'
assets(panda): slice Kick clip from Animation

EOF
)"
```

---

### Task 6: Bootstrap 接线

**Files:**
- Modify: `cocos/assets/scripts/Bootstrap.ts`

- [ ] **Step 1: 订阅 `kickStart`**

在现有 `this.hazard.on('knock', ...)` **之前**（或紧邻）加入：

```ts
    this.hazard.on('kickStart', (a) => {
      this.panda.playKick(a.side);
    });
```

`knock` 监听保持不变（SFX / HUD）。

- [ ] **Step 2: 跑全量单测**

```bash
cd /Users/hehuajun/bamboo-game/cocos && npx jest -v
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add cocos/assets/scripts/Bootstrap.ts
git commit -m "$(cat <<'EOF'
feat(bootstrap): wire kickStart to panda playKick

EOF
)"
```

---

### Task 7: 手工验收 + spec 收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md`（状态）

- [ ] **Step 1: 预览运行手工清单**

在 Creator 预览或目标平台：

1. 左侧动物撞飞：踢腿朝左（`side === -1` 镜像）  
2. 右侧动物撞飞：踢腿朝右  
3. 动物在接触时刻附近才飞出，不是 kick 一开始就飞  
4. 踢腿时竹上 bounce / stun 晃动仍在  
5. （可选）临时改错 clip 名：仍应能 knock  

- [ ] **Step 2: 更新 spec 状态**

若验收通过：

```md
状态: 已实现  
分支: `feature/panda-kick-micro-anim`
```

若 clip 观感未过、逻辑已过：状态写 `实现中（逻辑完成；Kick 切片待校准/Mixamo）`，并开 follow-up，勿虚报完成。

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md
git commit -m "$(cat <<'EOF'
docs: mark panda kick micro-anim status

EOF
)"
```

---

## Spec 覆盖自检

| Spec 要求 | Task |
|---|---|
| `kick` 相位 + 接触后 `knock` | 2–3 |
| `kickStart` 事件 | 2–3, 6 |
| kick 中冻结 + 免疫 hit | 2–3 |
| `KICK_CONTACT_S` / `KICK_CLIP_S` | 1, 3–4 |
| 截取 Kick clip | 5 |
| `PandaView` 播 clip + `side` 镜像 | 4 |
| 根节点 sway/stun 不打断 | 4（镜像打子节点） |
| 动画失败仍 knock | 3（逻辑独立）+ 4（play 失败静默） |
| 全物种同一踢腿 | 6（所有 `kickStart`） |
| 非目标：Graph/IK/换模 | 未列入 |
| Mixamo 后备 | Task 5 失败路径说明，不阻塞合并 |

**类型一致性：** `AnimalEvent` 含 `kickStart`；`Animal.kickAge`；`PandaView.playKick(side: -1 | 1)`；配置键 `KICK_CONTACT_S` / `KICK_CLIP_S` / `KICK_CLIP_FROM` / `KICK_CLIP_TO`；clip 名 `Kick`。

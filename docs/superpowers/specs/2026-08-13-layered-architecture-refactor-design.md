# 分层架构重构 · 内容包场景 + 角色微动作

日期: 2026-08-13  
分支: `feature/layered-architecture-refactor`  
状态: 已实现

关联:

- `docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md`
- `docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md`
- `docs/superpowers/specs/2026-08-09-panda-kick-micro-anim-design.md`

## 背景

Cocos 重写已具备可玩闭环（节奏生长、弯竹、金币、天空、动物危害、踢腿微动作），但扩展点集中在 `Bootstrap.ts`（场景搭建 + 事件接线 + 主循环）与扁平的 `GameConfig` / 硬编码视图资源上。后续要支持：

1. **场景内容包**（日常 / 工作 / 过年）：同一套玩法规则，可换天空、道具、动物表、台词、音效参数等数据与资源引用。
2. **角色复杂微动作**：在现有 kick 之上，用分层状态机扩展 idle / press / stun 等，避免继续往 `PandaView` 堆临时逻辑。

## 已确认偏好

| 项 | 选择 |
|---|---|
| 本轮范围 | 架构 + ScenePack + 角色分层微动作框架 |
| 场景含义 | **内容包**：可换皮与数据（动物/台词/刷怪表等），玩法语义不变 |
| 场景选择 | 启动时固定（`ACTIVE_SCENE_ID`），无选关 UI、无局中热切 |
| 微动作 | **分层状态机**：Base + Overlay，优先级/打断 |
| 交付边界 | 迁入 **default** 内容包；**work / cny** 为可切换占位骨架 |
| 架构方案 | **B**：`app/` + `content/` + `character/` + 既有 core/view/fx/ui/platform |

## 目标

1. 分层清晰：组装 / 内容 / 逻辑 / 表现职责分离；`Bootstrap` 瘦成入口。
2. 换场景 = 换 `ScenePack`；改一行启动配置即可验证 work/cny。
3. 角色动作经 `AnimController` 播放；现有 kick / stun / press bounce 行为保持，逻辑可单测。
4. `core/` 继续零 Cocos 渲染依赖；现有 Jest 全绿。
5. default 包与重构前玩法手感 1:1（允许代码搬家，不允许改公式语义）。

## 非目标

- 选关 UI、局中热切换场景。
- 工作 / 过年完整美术与音频制作。
- 完整 Marionette Animation Graph、IK 瞄准、多角色共用动画图。
- 修改玩法公式、包体策略、微信/抖音构建管线。
- 重写 `prototype/`。

## 架构

单向数据流不变；接线从 `Bootstrap` 迁到 `GameApp`；内容与动作成为显式模块。

```
Input → RhythmJudge → GameState（唯一事实源）
  → events → GameApp 订阅 → AnimController / FX / HUD / Score / Bend

Hazard.update(frame) → kickStart / knock / hit / taunt / …
  → AnimController.play('kick', { side })
  → Score / FX / HUD（语义同现）

每帧 tick：
  state → bend → bamboo sway → hazard → camera → best → HUD
```

### 目录（`cocos/assets/scripts/`）

| 模块 | 职责 |
|---|---|
| `app/Bootstrap.ts` | 入口：预载 effect、创建 `GameApp`、转交生命周期 |
| `app/GameApp.ts` | 组装节点、注入 active Pack、事件接线、主循环 |
| `app/ActiveScene.ts` | `ACTIVE_SCENE_ID` 与 Pack 解析（未知 id 回退 default） |
| `content/ScenePack.ts` | Pack 接口与 `ThemeableConfig` 类型 |
| `content/packs/defaultPack.ts` | 迁入现有天空/植被/动物/台词/主题数值 |
| `content/packs/workPack.ts` | 占位：displayName + 少量 copy/taunts，资源可复用 default |
| `content/packs/cnyPack.ts` | 占位：同上 |
| `content/registry.ts` | `id → ScenePack` 注册表 |
| `character/AnimController.ts` | Base + Overlay 状态机（纯逻辑，无 cc） |
| `character/AnimTypes.ts` | clip id、层、优先级、播放上下文类型 |
| `core/*` | 既有玩法逻辑；可从 Pack 读取已合并配置切片 |
| `view/PandaView.ts` | 薄适配器：听 Controller 输出 / 驱动骨骼与根节点 |
| `view/*` / `fx/*` / `ui/*` | 只读状态 + Pack 资源 key；不含业务规则 |
| `platform/*` | 输入与存储（不变） |
| `core/GameConfig.ts` | 全局默认常量（保留现文件）；启动时与 Pack.`config` 浅合并得到运行时配置 |

硬约束：

- `core/` 与 `character/`（逻辑部分）不得 import `cc` 渲染 API。
- Pack 只改数据与资源引用，不改 `GameState` / `RhythmJudge` 语义。
- View 不直接硬编码主题色/台词池（改为读 Pack；default 内容与现网一致）。

## ScenePack

```ts
type SceneId = 'default' | 'work' | 'cny';

interface ScenePack {
  id: SceneId;
  displayName: string;
  /** 覆盖可主题化数值；未列出的走 GameConfig 全局默认 */
  config?: Partial<ThemeableConfig>;
  sky: SkyTheme;
  ground: GroundTheme;
  animals: AnimalTheme;
  audio: AudioTheme;
  copy: CopyTheme;
}
```

`ThemeableConfig`（本轮可被 Pack 覆盖的字段，显式白名单）=

- 动物危害段：`ANIMAL_TIER*_COINS`、`ANIMAL_SPAWN_GAP_*`、`ANIMAL_MAX_ALIVE_*`、`ANIMAL_FADE_IN_S`、`ANIMAL_SPAWN_HEIGHT_PX`、`ANIMAL_SPAWN_DIAG_X_PX`、`ANIMAL_SIDE_OFFSET_PX`、`ANIMAL_DIVE_SPEED_PX`、`ANIMAL_HIT_RADIUS_PX`、`ANIMAL_KNOCK_*`、`ANIMAL_COIN_LOSS`、`ANIMAL_POST_HIT_COOLDOWN_S`、`KICK_CONTACT_S`、`KICK_CLIP_S`
- 不含：节奏/生长核心（`MIN_GAP` / `GOOD_GAP` / `COMBO_MAX` / `BASE_GAIN_PX` 等）、像素换算、相机距离。这些留在全局 `GameConfig`，本轮 Pack 不得覆盖。

合并规则：`runtimeConfig = { ...GameConfig, ...pack.config }`（浅合并）。core 系统在 `GameApp` 组装时注入 `runtimeConfig`，或通过只读访问器读取已合并结果；禁止各处再散落读未合并的主题字段。

选择方式：

```ts
// app/ActiveScene.ts
export const ACTIVE_SCENE_ID: SceneId = 'default';
```

解析：`registry.get(ACTIVE_SCENE_ID) ?? registry.get('default')`，未知 id 时 `console.warn`。

本轮三个包：

| Pack | 内容 |
|---|---|
| default | 完整迁入现有表现与数据，行为 1:1 |
| work | 占位：改名 + 少量 copy/taunts；prefab key 可指向 default |
| cny | 占位：同上 |

## 角色分层微动作

```
事件 (kickStart / grow / stun …)
        ↓
AnimController
  BaseLayer（互斥）: climbIdle | stunned
  OverlayLayer（可打断）: kick | pressBounce | …
  规则: 优先级、时长、镜像 side、超时结束
        ↓
PandaView 应用：SkeletalAnimation clip + 根节点晃动/位移
```

本轮迁移：

- 现有 kick（镜像 + clip + `KICK_CONTACT_S` 时序）→ Overlay；Hazard 接触帧逻辑保持在 `AnimalHazard`。
- stun 晃动、press bounce → Base / Overlay 意图（观感不变）。
- 预留 `idle` / `press` 槽位（可空实现，接口先稳定）。

降级：clip 缺失时 Overlay 按时长结束；Hazard 仍按配置时序 `commitKnock`。

## 数据流与接线

`GameApp` 承担现 `Bootstrap.buildScene` + `update` 的职责：

1. 解析 Pack → 合并 themeable config。
2. 构建相机 / 天空 / 植被 / 竹 / 熊猫 / 币 / FX / HUD / 动物。
3. 订阅 `GameState` 与 `AnimalHazard` 事件，转发到 Anim / Audio / Particle / HUD / Score。
4. 每帧推进 state、bend、hazard、camera、best、HUD。

`Bootstrap` 仅：`resources.loadDir('effects')` → `new GameApp(...).start(effect)`。

## 错误处理

| 场景 | 策略 |
|---|---|
| 未知 `ACTIVE_SCENE_ID` | 回退 `default` + warn |
| Pack 缺 prefab / 模型 key | 回退 default 同名字段，或现有胶囊/静默跳过策略 |
| 动作 clip 缺失 | Overlay 超时结束；kick 路径 Hazard 仍 commitKnock |
| effect / 存档 / 音频失败 | 保持现有降级策略 |

## 测试

- **回归**：现有 `cocos/tests/*` 全部通过（玩法语义不变）。
- **新增（纯逻辑）**：
  - Pack 注册、未知 id 回退、`ThemeableConfig` 浅合并。
  - `AnimController`：Base 互斥、Overlay 优先级/打断、kick 时长结束、stun 期间行为。
- **手动**：default 全流程手感；将 `ACTIVE_SCENE_ID` 改为 `work` / `cny` 能启动并见 displayName/文案差异。

## 迁移策略

1. 加 `content/` / `character/` / `app/` 骨架与单测（红→绿）。
2. 抽 `GameApp`，`Bootstrap` 变薄；行为不变。
3. 迁 default Pack；View 改读 Pack。
4. 迁 kick/stun/bounce 进 `AnimController`；`PandaView` 变薄。
5. 加 work/cny 占位包与启动切换验证。
6. 全量 Jest + 手动冒烟。

## 成功标准

- [x] 目录与职责符合上文；`Bootstrap` 不再承载主循环业务接线。
- [x] `ACTIVE_SCENE_ID` 可切 default/work/cny；未知 id 回退。
- [x] default 下 kick / 眩晕 / 拾币 / 弯竹与重构前一致。
- [x] `AnimController` 与 Pack 合并逻辑有 Jest 覆盖。
- [x] `npm test` 全绿。

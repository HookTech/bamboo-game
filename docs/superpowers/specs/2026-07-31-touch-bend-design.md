# 触屏弯竹 · 微信小游戏手机操作

日期: 2026-07-31  
分支: `feature/touch-bend`  
状态: 已确认（方案 2 · BendController）  
关联: `docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md`

## 背景

游戏目标发布到**微信小游戏**，主设备为 Android / iOS 手机。现有输入已支持空格与 `TOUCH_START` 点按生长，但竹尖弯曲仅由 `tipSwayPx` 自动摆动（钳 ±44px），玩家无法主动侧移去够更宽的左右空间。

## 已确认偏好

| 项 | 选择 |
|---|---|
| 触控手感 | **B**：点哪弯哪 + 同时生长（单触点） |
| 弯后回弹 | **冲量弹一下**（短时偏移后回中） |
| 冲量上限 | 尖端弯幅 **±140px** |
| 自动晃动 | **保留**，冲量叠加上去 |
| 金币刷点 | **先不改**（本 feature 只加弯竹） |
| 实现路线 | **2**：独立 `BendController` + Sway 合成 |

## 目标

1. 手机单指点按：既触发节奏生长，又朝触点水平方向施加弯竹冲量。
2. 弯幅足够扫到设计宽约左右各 1/3（尖端 ±140px），便于后续放宽金币时接玩法。
3. 保持 core / view 分离：弯曲状态可 Jest 单测，无 Cocos 渲染依赖。
4. 桌面预览：空格只生长；鼠标点击与触屏同逻辑（带 X）。
5. HUD 文案改为触屏导向说明。

## 非目标

- 不放宽金币水平刷点（另开任务）。
- 不做按住拖拽、底栏滑条、多点触控。
- 不改节奏参数（`MIN_GAP` / `GOOD_GAP` / 连击 / 眩晕时长）。
- 不做微信提审包与抖音专项适配（沿用现有 Cocos 触摸 API 即可在预览验收）。

## 架构

```
TOUCH_START / 鼠标点击 (UI X)
        │
        ▼
  InputAdapter.press(normX)     // normX ∈ [-1, 1]，屏幕中线 = 0
        │
        ├──► GameState.press()           // 节奏 / 生长 / 眩晕（行为不变）
        └──► BendController.impulse()    // 仅有效生长时

每帧:
  GameState.update(dt)
  BendController.update(dt)     // 指数衰减
  tip = composeSway(auto, bend.offsetPx)
        │
        ▼
  BambooMesh / PandaView / 磁吸 读 tip（沿用 swayPx）
```

### 模块

| 模块 | 职责 |
|---|---|
| `core/BendController.ts`（新） | 冲量偏移 px：`impulse(normX)` / `update(dt)` / `offsetPx` |
| `core/Sway.ts` | 保留 `tipSwayPx` 为自动项；新增合成（auto + bend → 总钳制） |
| `core/GameConfig.ts` | `IMPULSE_PX`、`BEND_MAX_PX`、`BEND_TAU`、`TOTAL_SWAY_MAX_PX` |
| `platform/InputAdapter.ts` | 回调改为 `(normX: number) => void`；触摸/鼠标算 normX；空格传 `0` |
| `Bootstrap.ts` | 持有 BendController；接线 press / 每帧 update；把 offset 交给 BambooMesh |
| `view/BambooMesh.ts` | tip 计算改用合成 sway（或接收外部 tip） |
| `ui/HUD.ts` | 开始/底栏文案改触屏说明 |

## 手感与数值

| 常量 | 建议值 | 含义 |
|---|---|---|
| `IMPULSE_PX` | 90 | 单次点按满偏（\|normX\|=1）增加的冲量 |
| `BEND_MAX_PX` | 140 | 冲量项钳制 |
| `BEND_TAU` | 0.35 s | 指数衰减时间常数（约 0.5s 基本回中） |
| `SWAY_MAX_PX` | 44 | 自动晃动钳制（不变） |
| `TOTAL_SWAY_MAX_PX` | 160 | 合成后尖端总钳制 |

### 映射

- `normX = clamp((uiX - screenW/2) / (screenW/2), -1, 1)`
- 有效生长时：`offsetPx = clamp(offsetPx + normX * IMPULSE_PX, -BEND_MAX_PX, BEND_MAX_PX)`
- 每帧：`offsetPx *= exp(-dt / BEND_TAU)`
- 合成：`total = clamp(autoSway + offsetPx, -TOTAL_SWAY_MAX_PX, TOTAL_SWAY_MAX_PX)`

### 何时施加冲量

| 情况 | 生长 | 冲量 |
|---|---|---|
| 未开始，首次点按 | 仅 `start` | 否 |
| 眩晕中 | 否 | 否 |
| 判定为生长（`press` 返回且 `!stunned`） | 是 | 是 |
| 判定为过急眩晕 | stun | 否 |
| 空格 | 是 | `normX = 0`（不加弯） |

连点同侧可叠到上限；点对侧可反向抵消。

## 表现层

- 竹干二次弯曲、熊猫挂接、金币磁吸继续消费「尖端 swayPx」，只替换 tip 来源为合成值。
- 不新增弯竹专用 UI 控件。

## UI 文案

- 标题保持「势如破竹」。
- 开始提示：由「按 空格 / 点按屏幕 开始」改为侧重「点屏幕开始 · 点哪边竹往哪边弯」。
- 底栏节奏说明保留间隔/眩晕要点，并点明侧点可弯竹；桌面预览可附带「空格生长」。

## 测试

Jest（`cocos/tests/`）：

1. `BendController`：方向、钳制、衰减→0、同侧叠加、对侧抵消。
2. Sway 合成：auto + bend 不超过 `TOTAL_SWAY_MAX_PX`。
3. 不强制改动 `GameState` / `RhythmJudge` 既有用例（除非 press 接线需要极薄适配）。

## 验收（手动）

1. Creator 预览：点屏幕左侧/右侧，竹尖朝对应方向弹弯后回中，同时生长。
2. 连点同侧可叠到明显侧移；过急仍眩晕且当次不额外甩弯。
3. 空格只长不弯；鼠标点击可弯。
4. 手机预览（或微信开发者工具）单指可玩，无多指依赖。

## 风险与后续

- 金币刷点未放宽时，侧弯收益有限；验收以手感为主，玩法收益留待「金币刷点」任务。
- ±140 冲量 + 自动晃动合成后可能略超视觉预期，用 `TOTAL_SWAY_MAX_PX` 兜底，手感不对再调 `IMPULSE_PX` / `BEND_TAU`。

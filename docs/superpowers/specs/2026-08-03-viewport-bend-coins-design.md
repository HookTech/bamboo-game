# 弯竹半宽适配 · 竖屏可见半宽联动

日期: 2026-08-03  
分支: `feature/sky-animal-hazard`（同线迭代；若冲突可拆 `feature/viewport-bend-coins`）  
状态: 已确认（方案 1 · 可见半宽比例）  
关联:

- `docs/superpowers/specs/2026-07-31-touch-bend-design.md`（原固定 ±140 冲量上限）
- `docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md`

## 背景

触屏弯竹当前用固定 `BEND_MAX_PX=140` / `TOTAL_SWAY_MAX_PX=160`。横屏下扫幅偏小；竖屏（手机）可见宽变窄后，固定上限与金币边距（`halfW−60`）比例失调：弯竹要么「半屏感」不足，要么边距占可见宽过大导致金币挤在中缝。

金币刷点已读 `CameraRig.visibleWidthPx()`，但边距为死常数 60/30，需改为随半宽比例缩放。

## 已确认偏好

| 项 | 选择 |
|---|---|
| 横屏弯幅目标 | **贴左右屏边**（`bendMax = halfW × 1.0`） |
| 竖屏适配 | 同一套半宽公式自动收窄 |
| 金币分布 | **A** 与弯竹共用可见半宽；边距按比例缩小 |

## 目标

1. 弯竹左右上限随相机可见半宽缩放，横屏接近半屏扫幅，竖屏同比收窄。
2. 金币生成与反弹边距随半宽比例变化，窄屏不挤成细缝。
3. 布局公式进纯 core 模块，Jest 可测；无引擎依赖。
4. 不改节奏 / 眩晕 / 动物判定语义（撞飞仍看 `bendOffset` 与 `ANIMAL_KNOCK_BEND_MIN_PX`；后者保持绝对 px，或另议）。

## 非目标

- 不改设计分辨率 800×600、不换相机 FOV。
- 不做拖拽弯竹、多点触控。
- 不改动物刷点斜角常量（可后续跟半宽）。
- 不改 HUD 字号策略以外的 UI 布局。

## 架构

```
CameraRig.visibleWidthPx()
        │
        ▼
  halfW = visibleWidthPx / 2
        │
        ├──► layoutMath.bendMaxPx(halfW) / impulsePx(halfW) / totalSwayMaxPx(halfW)
        │         └─ BendController.setLimits(...) 或 impulse/update 读入
        │         └─ composeTipSwayPx(auto, bend, totalMax)
        │
        └──► layoutMath.coinSpawnHalfW(halfW) / coinBounceHalfW(halfW)
                  └─ CoinView 刷点与反弹
```

### 模块

| 模块 | 职责 |
|---|---|
| `core/layoutMath.ts`（新） | `bendMaxPx` / `impulsePx` / `totalSwayMaxPx` / `coinMarginPx` / `coinSpawnHalfW` / `coinBounceHalfW` |
| `core/BendController.ts` | 钳制改用动态 `maxPx`（默认仍可读 design 半宽） |
| `core/Sway.ts` | `composeTipSwayPx` 增加可选 `totalMax` 参数 |
| `core/GameConfig.ts` | 比例常量：`BEND_HALF_W_FRAC`、`IMPULSE_BEND_FRAC`、`COIN_MARGIN_FRAC`、`COIN_MARGIN_MIN_PX`；旧固定 `BEND_MAX_PX` 改为「设计半宽参考值」或 derivable |
| `view/CoinView.ts` | 用 `layoutMath` 替死常数 60/30 |
| `Bootstrap.ts` | 每帧用 `rig.visibleWidthPx()/2` 刷新 bend 上限 |

## 公式（默认）

以 `halfW = visibleWidthPx()/2`：

| 量 | 公式 | 4:3（halfW≈400） | 9:16（halfW≈169） |
|---|---|---|---|
| `bendMax` | `halfW × 1.0` | ≈400 | ≈169 |
| `impulse` | `bendMax × 0.45` | ≈180 | ≈76 |
| `totalSwayMax` | `bendMax + SWAY_MAX_PX(44)` | ≈444 | ≈213 |
| `coinMargin` | `max(24, halfW × 0.15)` | 60 | 25 |
| `coinSpawnHalf` | `halfW − coinMargin` | 340 | 144 |
| `coinBounceHalf` | `halfW − coinMargin × 0.5` | 370 | 156 |

设计半宽参考：`DESIGN_HALF_W = DESIGN_W/2 = 400`（与当前 `visibleWidth`@4:3 一致；测试可用此作默认）。

## 错误处理

| 场景 | 策略 |
|---|---|
| `halfW` 未就绪 / ≤0 | 回退 `DESIGN_W/2` |
| 极限窄屏 `spawnHalf < 40` | clamp `spawnHalf ≥ 40`，优先保可玩宽度 |
| 分辨率热切换 | 下一帧用新 halfW；已刷金币反弹界随新 bounce 更新 |

## 测试

Jest（core）：

- `bendMaxPx(400)≈220`，`bendMaxPx(169)≈93`
- `coinMarginPx` / `coinSpawnHalfW` 随 halfW 单调；窄屏 margin≥24 且 spawnHalf≥40
- `BendController`：注入 max=220 时钳到 ±220；max 变小后下一次 impulse 钳入新界
- `composeTipSwayPx` 接受动态 totalMax

手动预览：

- 编辑器 4:3：弯幅明显大于旧 ±140；金币仍满宽合理
- 预览切手机竖屏：弯幅收窄、金币左右仍铺开且不贴死边

## 验收标准

1. 横屏弯竹扫幅可达可见半宽量级（约 ±halfW，贴左右屏边）。
2. 竖屏弯竹与金币边距同比缩小，金币不挤成中缝细条。
3. 单测覆盖 layout 公式与 Bend 动态钳制。
4. 动物 / 节奏主循环行为不回归。

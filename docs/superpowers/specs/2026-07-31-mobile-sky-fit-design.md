# 手机分辨率适配 · 日月不出界

日期: 2026-07-31  
分支: `feature/mobile-sky-fit`  
状态: 已确认（方案 1 · 按可视半宽比例）  
关联: `docs/superpowers/specs/2026-07-31-sky-cc0-props-design.md`

## 背景

微信小游戏目标设备为 Android / iOS 竖屏手机。当前 `Bootstrap` 使用 `FIXED_HEIGHT` + 设计分辨率 800×600；3D 相机 FOV=30°、距离 `CAMERA_DISTANCE_M`。竖屏时 `aspect` 变小，水平可见宽度变窄，而日月写死在相机局部坐标 `(8, 5.5, -37)`，会落到视锥外。

## 已确认偏好

| 项 | 选择 |
|---|---|
| 范围 | **仅太阳/月亮**（云、星、植被另议） |
| 位置策略 | **按可视半宽比例** |
| 实现路线 | **SkyView 用 aspect 重算 sunX** |

## 目标

1. 任意常见手机竖屏 / 桌面预览宽高比下，日月主体落在可见画面右上内侧。
2. 旋转或改变预览窗口导致 aspect 变化时，位置自动跟上。
3. 半宽与太阳 X 的计算为纯函数，可 Jest 覆盖。

## 非目标

- 不改编云/星刷点与漂移范围。
- 不改地面植被、HUD 刘海安全区。
- 不改 `ResolutionPolicy`、FOV、相机距离、玩法数值。

## 架构

日月节点仍为相机子节点（现有 `SkyView.build(parent, cam)`）。保存 `Camera` 引用；根据 aspect 更新本地 X。

```
aspect, FOV=30°, CAMERA_DISTANCE_M
        │
        ▼
  visibleHalfWidthM(aspect)
        │
        ▼
  sunLocalX = +halfW * SUN_X_FRAC   (0.58)
  sunMoon.setPosition(sunLocalX, 5.5, -37)
```

| 模块 | 职责 |
|---|---|
| `core/skyMath.ts` | 新增 `visibleHalfWidthM` / `sunLocalX`（或等价命名） |
| `core/GameConfig.ts` | 可选：`SUN_X_FRAC`、`SUN_LOCAL_Y`、`SUN_LOCAL_Z` |
| `view/SkyView.ts` | build 初算；aspect 变化时重算位置 |
| `tests/skyMath.test.ts` | 覆盖半宽与太阳 X |

`CameraRig.visibleWidthPx()` 与上述半宽同源；实现时可复用 `skyMath`，避免两套公式长期漂移（若改 Rig 超出最小范围，可只在 SkyView 用 skyMath，Rig 留待后续）。

## 数值

| 常量 | 值 | 含义 |
|---|---|---|
| FOV | 30° | 与 Bootstrap 一致 |
| `CAMERA_DISTANCE_M` | 22.4 | 已有 |
| `SUN_X_FRAC` | 0.58 | 相对可见半宽 |
| `SUN_LOCAL_Y` | 5.5 | 不变 |
| `SUN_LOCAL_Z` | -37 | 不变 |

公式：

```
visibleH = 2 * CAMERA_DISTANCE_M * tan(fovRad / 2)   // ≈ 12m
halfW    = visibleH * aspect / 2
sunX     = +halfW * SUN_X_FRAC
```

参考点：

| 场景 | aspect | halfW≈ | sunX≈ |
|---|---|---|---|
| 设计 800×600 | 1.333 | 8.0 | 4.6 |
| 竖屏 9:16 | 0.5625 | 3.4 | 2.0 |
| 旧硬编码 | — | — | 8.0（竖屏易出界） |

## 更新时机

1. `build` 结束时根据当前 `cam.camera.aspect`（或回退 `DESIGN_W/DESIGN_H`）放置一次。
2. `update` 中若 `|aspect - lastAspect| > 0.01` 则重算并更新 `sunMoon` 位置。

光晕为日月子节点，随父节点移动，无需单独改。

## 测试

Jest：

1. `visibleHalfWidthM(4/3)` ≈ 8（容差合理）。
2. `sunLocalX(9/16)` 明显小于 `sunLocalX(4/3)`，且 `|sunLocalX| < halfW`。
3. `sunLocalX` 始终为非负（右侧）。

## 验收（手动）

1. Creator 预览：默认窗口日月在右上可见。
2. 缩成竖屏/窄窗口：日月仍在画面内偏右上，不消失。
3. 拉回横屏：位置外移但仍可见。
4. 昼夜切换、光晕表现不受影响。

## 风险与后续

- 桌面 4:3 下太阳比旧值更靠内（约 4.6 vs 8），属有意换取竖屏安全；若嫌太靠中可略调高 `SUN_X_FRAC`（≤0.7）。
- 云仍可能在极窄屏出界；不在本任务范围。

# 熊猫踢腿微动作 · Additive 击飞设计

日期: 2026-08-09  
状态: 实现中  
分支: `feature/panda-kick-micro-anim`  
关联:

- `docs/superpowers/specs/2026-08-03-sky-animal-hazard-design.md`
- 业界路径 B：短踢腿 clip + Additive / Mask 层，不打断主姿态

## 背景

空中动物危害已实现逻辑击飞（`AnimalHazard` → `knock` → `AnimalView` 抛物线 + SFX），但熊猫侧只有根节点位移/眩晕晃动，没有骨骼踢腿。目标是在撞飞时让模型伸出脚踢开动物，形成接触感。

当前资产：`panda.glb` 有 32 骨骨架 + 一条未播放的循环 clip `Animation`（约 4.67s）。项目内尚无 `SkeletalAnimation` / Marionette 使用。

## 已确认偏好

| 项 | 选择 |
|---|---|
| 叠层策略 | **B** 短踢腿 + Additive / Mask（腿部），不打断攀竹根节点晃动 |
| 踢腿资产 | **C** 从现有 `Animation` 截取；观感不行再 Mixamo 重定向（免费后备） |
| 方向 | **A** 按动物 `side` 镜像 |
| 时序 | **B** 先播踢腿，接触帧后再击飞 |
| 范围 | **A** 所有可击飞动物（bird/cat/dog/rabbit） |
| 实现路径 | **1** Hazard 增加 `kick` 相位 + 接触后 `knock`；动画用 `SkeletalAnimation`（首版不强制完整 Animation Graph） |

## 目标

1. `canKnock` 成立时进入 `kick`：播踢腿微动作，动物原地冻结。
2. 到达接触时刻后进入 `knock`：复用现有飞出 / SFX / HUD。
3. 踢腿按 `side` 镜像；根节点 sway/stun 旋转不被踢腿打断。
4. 动画缺失时超时仍 `commitKnock`（降级为现瞬间击飞）。
5. `AnimalHazard` 状态机变更可 Jest 单测。

## 非目标

- 完整 Marionette Graph / 微动作库。
- IK 瞄准动物世界坐标。
- 分物种不同踢腿样式。
- 替换熊猫整模。
- 修改撞飞判定半径、弯竹阈值、扣币等既有数值语义（仅新增踢腿时序常量）。

## 架构

```
AnimalHazard.update
  canKnock? → phase=kick, emit kickStart(side)
  animal position frozen; immune to hit
       │
       ▼
PandaView.onKickStart
  play carved kick clip (additive or leg override)
  mirror by side (model scale.x)
       │
       ▼  contact @ KICK_CONTACT_S
AnimalHazard.commitKnock
  phase=knock, emit knock
       │
       ▼
AnimalView parabola + AudioFx/HUD (existing)
```

### 模块

| 模块 | 职责 |
|---|---|
| `core/AnimalHazard.ts` | 新 phase `kick`；kick 计时；接触后 `knock`；kick 中冻结与免疫 hit |
| `core/GameConfig.ts` | `KICK_CONTACT_S` / `KICK_CLIP_S` / 截取窗口常量 |
| `view/PandaView.ts` | 加载后挂 `SkeletalAnimation`；订阅踢腿；镜像；根节点逻辑不变 |
| `Bootstrap.ts` | `kickStart` → `PandaView`；`knock` 仍走现有 SFX/HUD |
| `view/AnimalView.ts` | 仍只听 `knock`（飞出表现不变） |

逻辑层不依赖渲染：接触时刻由 hazard 用 `KICK_CONTACT_S` 推进；`PandaView` 对齐同一常量播 clip。若日后 clip 带 Anim Event，可再改为事件驱动，但首版以配置常量为准。

## 数据流与状态机

### AnimalPhase

```
fadeIn → dive → kick → knock → gone
                 ↘ hit → gone   // 仅非 kick
```

`AnimalPhase` 扩展为含 `'kick'`。

### 事件

| 事件 | 时机 | 订阅方 |
|---|---|---|
| `kickStart`（新） | 进入 `kick` | `PandaView`（经 Bootstrap） |
| `knock` | 接触后进入 `knock` | `AnimalView` / AudioFx / HUD（既有） |
| `hit` / `despawn` / `taunt` / `spawn` | 不变 | 既有 |

### 规则

1. `kick` 期间：动物坐标冻结（不 `integrate`）；不计 `canHit`。
2. `kick` 期间若熊猫进入 stun：仍按计时 `commitKnock`，不改为 hit（击飞已锁定）。
3. 镜像：`side === -1` 时对模型子节点 `scale.x = -1`（或等价），kick 结束后恢复默认朝向缩放。
4. 动画组件/clip 失败：hazard 仍在 `KICK_CONTACT_S` 后 `commitKnock`（表现可能无踢腿，玩法不卡死）。
5. `KICK_CONTACT_S` ≤ `KICK_CLIP_S`；`knock` 飞出时长仍用既有 `ANIMAL_KNOCK_DESPAWN_S`。

## 动画资产策略

1. **主路径**：从 `panda.glb` 内嵌 `Animation` 截取短窗口作为踢腿 clip（编辑器裁剪或运行时/导入配置 `from`/`to`）。实现时试看选段，写入 `KICK_CLIP_FROM` / `KICK_CLIP_TO`（或等价资源元数据）。
2. **叠层**：优先 Additive / 腿部 Mask，使上身与根位移不受影响；若 Cocos 3.8.8 首版配 Additive 成本过高，允许短时腿部 override，但禁止改写 `PandaView` 根节点每帧 position/euler 逻辑。
3. **底座循环（可选增强）**：可同时 loop 播放原 `Animation` 作 idle；非本版硬性要求。无 idle 时仅在 kick 窗口播放踢腿亦可验收。
4. **免费后备**：截取观感明显不像踢腿时，用 Mixamo 踢腿 → Blender 重定向到现有熊猫骨架再导入。Quaternius 动物 Kick 因骨架不同，不作为首选。不替换整模。

## 配置

新增（量级，实现时按截取 clip 校准）：

| 常量 | 初值 | 含义 |
|---|---|---|
| `KICK_CONTACT_S` | `0.15` | 进入 kick 后到 `commitKnock` |
| `KICK_CLIP_S` | `0.4` | 踢腿播放时长 |
| `KICK_CLIP_FROM` / `KICK_CLIP_TO` | 实现时试看 `Animation` 后写入 | 相对原 clip 的截取秒数；无合适段则走 Mixamo 后备 |

既有 `ANIMAL_KNOCK_*` 判定与飞出参数不变。

## 测试

### 单测（`AnimalHazard`）

- `canKnock` → `phase='kick'`，发出 `kickStart`，同帧不发 `knock`。
- `kick` 累计 ≥ `KICK_CONTACT_S` → `phase='knock'`，发出 `knock`。
- `kick` 中动物进入熊猫 hit 半径 → 不发 `hit`。
- `kick` 中 `dt` 推进后位置与进入 kick 时相同。
- 不依赖 `PandaView`：仅推进时间即可完成 knock。

### 手工验收

- 左/右侧动物各一次：踢腿朝向与 `side` 一致。
- 动物在脚将伸到时才飞出，而非 kick 一开始就飞。
- 攀竹 bounce / stun 根旋转在踢腿期间仍工作。
- 去掉/失败动画资源时仍可击飞。

## 风险与降级

| 风险 | 处理 |
|---|---|
| 截取段不像踢腿 | Mixamo 重定向后备；逻辑层不阻塞 |
| Additive 配置复杂 | 首版腿部短 override；保持根节点程序化运动 |
| 镜像导致朝向/面朝相机异常 | 镜像只打在模型子节点；与现有 `y=180` 旋转组合时实现期校验 |
| 接触时刻与画面不同步 | 统一用 `KICK_CONTACT_S`；校准 clip 峰值帧 |

## 实现顺序（供后续 plan）

1. `AnimalPhase` + `kickStart` + kick 计时 / 冻结 / 免疫 hit；单测绿灯。
2. `PandaView` 挂 `SkeletalAnimation`，截取/挂载踢腿 clip，接 `kickStart` + 镜像。
3. `Bootstrap` 接线；手工左右侧验收。
4. 观感不行再启动 Mixamo 后备（不挡主路径合并）。

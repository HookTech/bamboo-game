# 空中动物危害 · 轻度干扰设计

日期: 2026-08-03  
分支: `feature/sky-animal-hazard`  
状态: 实现中（方案 1 · 独立 AnimalHazard）  
关联:

- `docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md`
- `docs/superpowers/specs/2026-07-31-touch-bend-design.md`

## 背景

《势如破竹》主循环是节奏生长 + 拾币 + 触屏弯竹，定位为解压向。本 feature 在金币达到分档门槛后，于高空渐现低模 3D 小动物（鸟/猫/狗/兔），俯冲靠近小熊猫：

1. **主动出击**：弯竹冲量足够且朝向动物所在侧，竹尖扫入碰撞圈 → 撞飞（趣味表现，不加分）。
2. **未挡住**：动物靠近熊猫到一定距离 → 眩晕 + 损失金币（掉币音效与粒子）。

定位为**轻度干扰**，不是主难度轴；不引入失败终局。

## 已确认偏好

| 项 | 选择 |
|---|---|
| 定位 | **A** 轻度干扰 |
| 出现条件 | **B** 分档金币门槛（越高越频、种类越多） |
| 并发 | **B** 低档最多 1，高档最多 2 |
| 撞飞奖励 | **A** 纯表现，不加分 |
| 未挡惩罚 | **B** 眩晕 0.9s + 掉约 5 币 + 连击清零 |
| 美术 | **A** 低模 3D（猫/狗/鸟/兔第一版全做） |
| 撞飞判定 | **B** 主动出击感：冲量阈值 + 同侧 + 尖端进圈 |
| 靠近路径 | **B** 高空渐现后俯冲 |
| 架构 | **1** 独立 `AnimalHazard` + `AnimalView` |
| 扣分策略 | 只扣 `coins`，`score` 不回退 |

## 目标

1. 金币跨分档后，空中动物按冷却随机刷出，高空 fade-in 后俯冲靠近竹梢/熊猫。
2. 玩家用现有触屏弯竹（冲量）主动撞飞；失败则复用现有眩晕流程并掉币。
3. core / view 分离：判定与分档可 Jest 单测；表现层订阅事件。
4. 包体：动物模型进既有 `models` bundle，单模型失败可降级占位体。

## 非目标

- 动物图鉴、商店、可关闭开关、难度模式。
- 修改节奏参数（`MIN_GAP` / `GOOD_GAP` / 连击上限 / 基础眩晕时长常量语义）。
- 放宽金币水平刷点、改天空美术主流程。
- 微信提审包与抖音专项适配（沿用现有构建验收）。

## 架构

单向数据流，hazard 与节奏并行，不把动物状态塞进 `GameState` 主字段。

```
输入点按
  ├─► GameState.press()           // 节奏 / 生长 / 过急眩晕（不变）
  └─► BendController.impulse()    // 弯竹冲量（不变）

每帧:
  GameState.update(dt)
  BendController.update(dt)
  tip = composeSway(auto, bend.offsetPx)
  AnimalHazard.update(dt, { tipX, tipY, bendOffset, coins, stunned, t })
        │
        ├─ spawn（分档）
        ├─ 每只：先 knock 判定 → 再 hit 判定 → 再积分运动
        └─ 事件 spawn / knock / hit / despawn
              │
              ▼
  AnimalView / ParticleFx / AudioFx / HUD
  hit → GameState.applyExternalStun() + ScoreSystem.loseCoins(n)
```

### 模块

| 模块 | 职责 |
|---|---|
| `core/AnimalHazard.ts`（新） | 实体池、分档刷怪、俯冲、撞飞/撞击判定与事件 |
| `core/GameConfig.ts` | 门槛、间隔、半径、冲量阈值、扣币数、冷却 |
| `core/ScoreSystem.ts` | 新增 `loseCoins(n)`：`coins` 下限 0；**不修改 `score`** |
| `core/GameState.ts` | 新增 `applyExternalStun()`：`combo=0`，`stunUntil=t+STUN_DURATION`，`emit('stun')` |
| `view/AnimalView.ts`（新） | 四类低模实例/池、渐现、俯冲姿态、撞飞抛物线与趣味细节 |
| `fx/ParticleFx.ts` / `AudioFx.ts` | 掉币粒子与音效、撞飞音 |
| `Bootstrap.ts` | 持有 hazard；每帧注入 tip/bend/coins/stun；接线 hit/knock |
| `ASSETS.md` | 新 GLB 署名 |

### 实体（core）

```ts
type AnimalKind = 'bird' | 'cat' | 'dog' | 'rabbit';
type AnimalPhase = 'fadeIn' | 'dive' | 'knock' | 'hit' | 'gone';

interface Animal {
  id: number;
  kind: AnimalKind;
  xPx: number;
  yPx: number;       // 相对设计坐标 / 与 tip 同系
  side: -1 | 1;      // 相对竹尖的水平落点侧
  phase: AnimalPhase;
  age: number;
}
```

具体字段可在实现时微调，但必须能支撑：分档、同侧冲量判定、俯冲、事件。

## 玩法数值（默认，集中 GameConfig）

| 常量（建议名） | 建议值 | 含义 |
|---|---|---|
| `ANIMAL_TIER1_COINS` | 20 | 开始出现；解锁 bird、cat；maxAlive=1 |
| `ANIMAL_TIER2_COINS` | 50 | 解锁 dog；maxAlive=1；间隔缩短 |
| `ANIMAL_TIER3_COINS` | 100 | 解锁 rabbit；maxAlive=2 |
| `ANIMAL_SPAWN_GAP_T1` | [8, 12] s | 档1 随机间隔 |
| `ANIMAL_SPAWN_GAP_T2` | [6, 9] s | 档2 |
| `ANIMAL_SPAWN_GAP_T3` | [5, 8] s | 档3 |
| `ANIMAL_MAX_ALIVE_T1_T2` | 1 | |
| `ANIMAL_MAX_ALIVE_T3` | 2 | |
| `ANIMAL_FADE_IN_S` | 0.6 | 高空渐现时长 |
| `ANIMAL_SPAWN_HEIGHT_PX` | 180 | 相对竹尖上方的刷出高度 |
| `ANIMAL_SIDE_OFFSET_PX` | 55 | 目标落点相对竹尖/熊猫的水平偏置 |
| `ANIMAL_DIVE_SPEED_PX` | 90 | 俯冲接近速率（px/s，可微调） |
| `ANIMAL_HIT_RADIUS_PX` | 50 | 相对熊猫锚点撞击半径 |
| `ANIMAL_KNOCK_RADIUS_PX` | 70 | 相对竹尖撞飞半径 |
| `ANIMAL_KNOCK_BEND_MIN_PX` | 50 | \|bendOffset\| 下限 |
| `ANIMAL_COIN_LOSS` | 5 | 撞击扣币；实际 `min(5, coins)` |
| `ANIMAL_POST_HIT_COOLDOWN_S` | 3 | 撞击后抑制再刷 |
| `ANIMAL_KNOCK_DESPAWN_S` | 0.8 | knock 后 core 计时回收（与飞出动画对齐） |

分档种类：

| 档 | 金币 | 种类池 | maxAlive |
|---|---|---|---|
| 0 | &lt;20 | 无 | 0 |
| 1 | ≥20 | bird, cat | 1 |
| 2 | ≥50 | bird, cat, dog | 1 |
| 3 | ≥100 | bird, cat, dog, rabbit | 2 |

### 刷怪与运动

- 仅 `started && !stunned` 且未在 post-hit 冷却时尝试刷怪；场上数量 &lt; maxAlive。
- 刷出：`side` 随机 ±1；出生点在竹尖上方 `ANIMAL_SPAWN_HEIGHT_PX`，水平在 `tipX + side * ANIMAL_SIDE_OFFSET_PX` 附近。
- 俯冲目标点：熊猫锚点水平 + `side * ANIMAL_SIDE_OFFSET_PX`（略偏一侧），垂直为熊猫高度。这样既像高空扑向角色，又给弯竹同侧挥击留出空间。
- `fadeIn`（仅渐现、位置可微动）→ `dive`（朝目标点积分运动）。
- **眩晕期间**：场上动物冻结运动且不新刷，避免与过急眩晕叠罚。
- **knock 回收**：core 在 `ANIMAL_KNOCK_DESPAWN_S` 后将实体标记 `gone` 并复用；view 同步播飞出，不反向驱动判定。

### 撞飞判定（主动出击）

同时满足：

1. `phase` 为 `fadeIn` 或 `dive`
2. 竹尖与动物距离 ≤ `ANIMAL_KNOCK_RADIUS_PX`
3. `|bendOffset| ≥ ANIMAL_KNOCK_BEND_MIN_PX`
4. `sign(bendOffset) === side`（冲量朝向动物所在侧）

→ `phase = knock`，emit `knock`；经 `ANIMAL_KNOCK_DESPAWN_S` 后 `gone` 并回收。

撞飞**不加** coins/score。

### 撞击判定

若本帧未撞飞，且动物与熊猫锚点距离 ≤ `ANIMAL_HIT_RADIUS_PX`：

→ `phase = hit`，emit `hit`：

1. `GameState.applyExternalStun()`（与过急眩晕相同：0.9s、连击清零、`stun` 事件 → 既有摇晃/星星/音效可复用）
2. `ScoreSystem.loseCoins(ANIMAL_COIN_LOSS)`（只减 coins）
3. 掉币粒子 + 掉币音效
4. 进入 `ANIMAL_POST_HIT_COOLDOWN_S`，该动物 despawn

### 同帧优先级

对每只动物：**先 knock，再 hit，再积分运动**。可撞飞时不得再 hit。

## 表现

- **渐现**：透明度或缩放 0→1，高空出现。
- **俯冲**：朝向速度方向的轻微倾角；种类可有细微速度差（鸟偏快、兔偏圆钝），属表现差异，判定半径统一。
- **撞飞**：沿冲量方向抛物线飞出 + 旋转；狗可打滚、兔可弹跳等短细节（实现阶段按工期取舍，至少共用一套飞出曲线）。
- **掉币**：短时金币图标/粒子下落 + WebAudio 掉币音色（区别于拾币上行音阶）。

## 资源

- 优先 CC0 / 可商用低模（Kenney、poly.pizza、Quaternius 等），与现有 `ASSETS.md` 流程一致。
- CC-BY 须署名。
- 单模型面数/贴图对齐熊猫策略（低面、≤512 贴图、GLB）。
- 加载失败：该 kind 占位胶囊着色；逻辑不依赖网格。

## 错误处理

| 场景 | 策略 |
|---|---|
| 单 kind GLB 失败 | 占位体，其余 kind 正常 |
| 全部失败 | 占位体 + 逻辑仍运行 |
| coins=0 时 hit | 仍眩晕；`loseCoins` 结果为 0 |
| 低端机 | maxAlive≤2；粒子沿用现有减半策略 |

## 测试

Jest（core，无引擎）：

- 分档：跨 20/50/100 时种类池与 maxAlive
- 刷怪：冷却、maxAlive、眩晕期不刷
- 撞飞：冲量阈值 + 同侧 + 半径 → knock，不扣币
- 撞击：近距且无合格冲量 → hit；`loseCoins` 调用量；score 不变
- 同帧：可 knock 时不 hit
- `loseCoins`：下限 0
- `applyExternalStun`：combo 清零、stunUntil、emit

集成（手动预览）：

- 攒币过 20 → 高空渐现俯冲 → 弯竹撞飞
- 故意不挡 → 眩晕 + 掉币 FX
- 档 3 同时最多 2 只
- 模型缺失占位可玩

## 验收标准

1. 金币 &lt;20 时不出现动物。
2. 弯竹主动出击可稳定撞飞同侧俯冲动物，并看到飞出表现。
3. 未挡时触发与过急类似的眩晕，coins 减少且不出现负值，score 不回退。
4. core 单测全绿；浏览器预览跑通撞飞与撞击两条路径。

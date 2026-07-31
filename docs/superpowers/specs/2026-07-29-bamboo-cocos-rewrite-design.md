# 势如破竹 · Cocos Creator 2.5D 重写设计

日期:2026-07-29
分支:`feature/cocos-rewrite`
状态:已确认(方案 A)

## 背景

原型(`main` 分支)为纯 Canvas + WebAudio 的 2D 解压小游戏:小熊猫抱竹,节奏按空格竹子生长,拾金币,天空随高度渐变。本次重写目标:

- 引擎:**Cocos Creator 3.8.6 + TypeScript**
- 平台:**微信小游戏为主**(兼容抖音小游戏、浏览器预览)
- 表现:**2.5D** —— 3D 场景 + 固定侧视相机,2D 玩法逻辑不变
- 玩法:**1:1 移植原型**,不加新机制
- 美术:**免费游戏开发模型资源**(优先 CC0)

## 玩法参数(照搬原型,集中于 `GameConfig.ts`)

| 参数 | 值 |
|---|---|
| 最小按键间隔(过急眩晕) | 0.12s |
| 断连击间隔 | 0.55s |
| 连击上限 | x12 |
| 眩晕时长 | 0.9s |
| 单次生长 | 26px × (1 + combo × 0.09) |
| 金币倍率 | 1 + floor(combo / 4) |
| 磁吸半径 / 拾取半径 | 95px / 40px |
| 像素换算 | 50px = 1m(1m = 1 Cocos 单位) |
| 竹尖摆动 | 二次弯曲,钳制 ±44px |

## 架构

单向数据流,core 与表现分离。core 不 import 任何 Cocos 渲染 API,可用 jest 在 node 下单测。

```
输入 → InputAdapter → RhythmJudge(纯函数) → GameState(唯一事实源)
  → 事件(grow/stun/comboBreak/start)→ 各 View / FX / HUD 订阅更新
金币拾取走 CoinView.onPickup 回调(不进 GameState 事件)
```

### 场景结构(单一主场景)

```
Main.scene
├── Camera3D          固定侧视,浅透视(FOV~30),跟随竹梢平滑移动
├── DirectionalLight  主光源,色温随高度变化(白昼→星空)
├── SkyLayer          程序化渐变穹顶 + 星星粒子
├── BambooRoot        程序化竹干容器(分段实例,0.92m/段 = 原型 46px)
├── Panda             小熊猫模型实例,挂竹身上
├── CoinPool          金币对象池
├── BgVegetation      地面植被/远山(仅低海拔可见)
├── Effects           粒子(拾取爆发/落叶/眩晕星星)
└── Canvas2D (UI 层)
    ├── HUD           金币/分数/高度/最高纪录
    ├── ComboBar      连击条
    └── Overlay       开始遮罩 + 操作说明
```

### 模块划分(assets/scripts/)

| 模块 | 职责 |
|---|---|
| `core/GameState.ts` | 状态机:started/stun/combo/height/score,发事件 |
| `core/RhythmJudge.ts` | 按键间隔判定,纯函数 |
| `core/ScoreSystem.ts` | 金币/分数/倍率/best 持久化 |
| `core/GameConfig.ts` | 全部玩法数值常量 |
| `platform/Storage.ts` | wx.setStorageSync / localStorage 适配层 |
| `platform/InputAdapter.ts` | 键盘空格 / 触摸点按统一为 press 事件 |
| `view/BambooMesh.ts` | 程序化竹干生成 + 二次弯曲摆动 |
| `view/PandaView.ts` | 小熊猫模型挂接、眩晕摇晃、按压回弹 |
| `view/CoinView.ts` | 金币池、漂浮、磁吸、拾取 |
| `view/SkyView.ts` | 天空渐变、星星、云、昼夜过渡 |
| `fx/ParticleFx.ts` | 拾取爆发/落叶/眩晕星星 |
| `fx/AudioFx.ts` | WebAudio 程序化合成音效(五声音阶照搬原型) |
| `ui/HUD.ts` | 分数/高度/连击条/说明 |

## 关键技术决策

1. **竹干程序化生成,不用现成模型**。无限生长 + 弯曲摆动是核心手感,现成模型无法做接缝和形变。运行时生成分段圆柱 + 竹节环,按原型二次弯曲公式偏移顶点。
2. **模型资源用在角色与氛围**:小熊猫、竹叶、金币、地面植被/远山。
3. **天空 = 程序化渐变底 + CC0 云 / 柔光日月**(详见 `2026-07-31-sky-cc0-props-design.md`)。不用天空盒贴图(相机 ClearFlags = SOLID_COLOR + 渐变穹顶),省包体 ~800KB。
4. **音效继续程序化合成**(WebAudio 振荡器),零音频资源体积,五声音阶拾币音照搬。

## 包体策略(微信主包 4MB 硬限)

- 主包:裁剪后引擎(去物理/龙骨等多余模块)+ TS 代码 + 启动场景
- `bundle-models` 普通分包:全部 GLB + 贴图(单分包 ≤4MB,总量 <20MB)
- 模型预处理(Blender):小熊猫 ≤5k 三角面,贴图 ≤512px,统一转 GLB
- 纹理压缩走构建管线(微信端 ASTC/ETC2)

## 错误处理

| 场景 | 策略 |
|---|---|
| 分包/模型加载失败 | 加载页重试;小熊猫失败降级为程序化胶囊体,游戏可玩 |
| 存档损坏 | Storage 读取 try/catch + 数值校验,坏档归零 |
| 音频初始化/解码失败 | 静音降级,游戏继续 |
| 低端机帧率 | dt clamp 0.05s;粒子数量减半 |

## 测试

- **单测(jest,core 层)**:
  - RhythmJudge:0.12s/0.55s 边界、连击上限、眩晕计时
  - GameState:生长加成公式、断连击、best 持久化
  - ScoreSystem:倍率公式
- **集成验证**:浏览器预览手动跑通 按急→眩晕→恢复→拾币→破纪录 全流程
- **真机验证**:微信开发者工具 + 真机预览,检查包体大小/帧率/触摸响应

## 资源清单

| 资源 | 来源 | License | 备注 |
|---|---|---|---|
| 小熊猫 | Sketchfab([kenchoo 版](https://sketchfab.com/3d-models/red-panda-c003c2985e0e462684063a893a0e85ee) 带动画 / [kishayan low-poly 版](https://sketchfab.com/3d-models/low-poly-red-panda-8388ccb25c144303a2ce904f1c2f534d),二选一,优先带动画) | CC-BY | 需署名,记入 `ASSETS.md` |
| 竹叶/植被/远山 | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | CC0 | |
| 备选植物 | [poly.pizza](https://poly.pizza) 搜 bamboo / Quaternius 自然包 | CC0 | |
| 金币 | 程序化圆环 或 Kenney | CC0 | |
| 云 | Quaternius Cloud | CC0 | models/sky/cloud.glb |
| 竹干 | 程序化生成 | — | |
| 音效 | WebAudio 合成 | — | 照搬原型 |

所有第三方资源下载后登记 `ASSETS.md`(名称/作者/URL/license/署名文案)。

## 里程碑

1. Cocos 工程初始化 + 引擎裁剪 + 主场景/相机/输入打通(浏览器可预览)
2. core 层(GameState/RhythmJudge/ScoreSystem)+ 单测通过
3. 程序化竹干 + 生长/弯曲/眩晕表现
4. 模型接入(小熊猫/金币/植被)+ ASSETS.md
5. 天空/粒子/音效/HUD 完整表现
6. 微信小游戏构建 + 包体优化 + 真机验证

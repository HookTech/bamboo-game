# 节节高

小熊猫抱着竹子，有节奏地点按，竹子节节往上长，一路采集天上飘的金币。无失败惩罚，纯解压。

当前主工程为 **Cocos Creator 3.8.8** 的 2.5D 重写（3D 场景 + 固定侧视相机），目标平台为微信 / 抖音小游戏；`prototype/` 另保留可在浏览器直接玩的 Canvas 原型。

## 特性

- 节奏生长：间隔合适连击上涨，按太急会眩晕
- 金币磁吸拾取，连击越高得分倍率越高
- 天空随高度由白昼渐入星空（云 / 日月 / 随机星点）
- 程序化竹干、粒子与 WebAudio 音效
- 核心玩法与渲染分离，可用 Jest 单测

## 玩法

| 操作 | 效果 |
| --- | --- |
| 空格 / 触摸（间隔 0.12s–0.55s） | 竹子生长，连击 +1（上限 x12），连击越高长得越多 |
| 按太急（&lt;0.12s） | 眩晕 0.9s，连击清零，屏幕抖动 |
| 按太慢（&gt;0.55s） | 连击中断，重新计数 |

- 金币靠近角色会磁吸，拾取得分倍率 `1 + floor(连击 / 4)`
- 最高纪录本地持久化（浏览器 `localStorage` / 小游戏 `storage`）

## 仓库结构

```text
bamboo-game/
├── cocos/                 # 主工程（Cocos Creator 3.8.8）
│   ├── assets/
│   │   ├── scripts/       # Bootstrap / core / view / fx / ui / platform
│   │   ├── models/        # GLB（models Asset Bundle）
│   │   └── resources/     # effect 等
│   ├── tests/             # Jest 单测（纯逻辑，不依赖引擎）
│   └── package.json
├── prototype/             # 早期 Canvas + WebAudio 原型
├── docs/superpowers/      # 设计说明与实现计划
├── ASSETS.md              # 第三方模型署名
└── LICENSE
```

## 环境要求

- [Cocos Creator 3.8.8](https://www.cocos.com/creator-download)
- Node.js 18+（跑单测）
- 可选：微信开发者工具 / 抖音开发者工具（真机与发包）

## 快速开始

### Cocos 主工程

1. 用 Cocos Creator **3.8.8** 打开 `cocos/` 目录  
2. 打开场景 `assets/main.scene`（场景中挂有 `Bootstrap`）  
3. 点击预览；空格开始游戏  

首次打开若 IDE 报找不到 `cc` 模块，等编辑器生成 `cocos/temp/tsconfig.cocos.json` 后会消失（`tsconfig.json` 已 extends 该文件）。

### 单元测试

```bash
cd cocos
npm install
npm test
```

### 浏览器原型（可选）

```bash
cd prototype
python3 -m http.server 8931
# 打开 http://localhost:8931
```

也可直接打开 `prototype/index.html`（无构建依赖）。

## 构建小游戏

### 微信小游戏

1. 项目设置 → 功能裁剪：关闭未用模块（Physics、DragonBones、Spine、引擎 ParticleSystem、地形、视频、WebView 等），保留 3D / UI / WebAudio  
2. 构建发布 → 平台「微信小游戏」→ 填 AppID → 主包压缩选「小游戏分包」  
3. 确认 `assets/models` 已配置为 Bundle `models`（分包）  
4. 用微信开发者工具打开 `cocos/build/wechatgame/`  

目标：主包 ≤ 4MB，总包 ≤ 20MB。

### 抖音小游戏

流程与微信类似，构建平台选「抖音小游戏」，用[抖音开发者工具](https://developer.open-douyin.com/)打开 `cocos/build/bytedance-mini-game/`。  
上线前需完成开放平台入驻、备案，并接入平台要求的必接能力（如侧边栏复访）。详见 [Cocos 官方文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-bytedance-mini-game.html)。

> 注意：业务代码里若直接调用 `wx.*`，在抖音环境需兼容 `tt.*`（或改用引擎 `sys.localStorage`）。

## 第三方资源

模型与许可证见 [ASSETS.md](./ASSETS.md)。使用或再分发时请保留其中的署名要求（尤其是 CC-BY 的小熊猫模型）。

## 文档

- [Cocos 重写设计](./docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md)
- [天空 CC0 道具设计](./docs/superpowers/specs/2026-07-31-sky-cc0-props-design.md)
- [实现计划](./docs/superpowers/plans/2026-07-29-bamboo-cocos-rewrite.md)

## 贡献

欢迎 Issue / PR。改玩法参数请优先动 `cocos/assets/scripts/core/GameConfig.ts`，并补对应单测。提交前请在 `cocos/` 下跑通 `npm test`。

## 许可证

代码与自有资源采用 [MIT License](./LICENSE)。  
第三方模型遵循各自许可证，见 [ASSETS.md](./ASSETS.md)；CC-BY 资源再分发时须保留作者署名。

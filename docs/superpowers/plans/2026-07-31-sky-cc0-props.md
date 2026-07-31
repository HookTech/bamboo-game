# 天空 CC0 云 + 柔光日月 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留程序化渐变/星星的前提下，为 `SkyView` 加上柔光日月光晕与 Quaternius CC0 分层云，缺资源可降级。

**Architecture:** 纯函数 `skyMath.ts`（昼夜/云淡出/避让带）jest 覆盖；`SkyView` 负责构建光晕节点、加载 `models` bundle 云预制体、每帧漂移与透明度；Bootstrap 接线不变（仍 `sky.build(camNode, cam)`）。

**Tech Stack:** Cocos Creator 3.8.8 · TypeScript · jest · Quaternius Cloud (CC0 GLB)

**Spec:** `docs/superpowers/specs/2026-07-31-sky-cc0-props-design.md`

**工作分支:** `feature/cocos-rewrite`

**文件职责:**

| 文件 | 职责 |
|---|---|
| `cocos/assets/scripts/core/skyMath.ts` | `nightK` / `cloudAlpha` / `nearCloudAllowedX` 纯函数 |
| `cocos/tests/skyMath.test.ts` | 上述纯函数单测 |
| `cocos/assets/scripts/view/SkyView.ts` | 渐变/星/柔光日月/云层表现 |
| `cocos/assets/models/sky/cloud.glb` | CC0 云模型 |
| `ASSETS.md` | 第三方资源登记 |
| 主设计 doc | 资源表一句更新 |

---

### Task 1: MANUAL —— 下载云模型并配置 Bundle

**Files:**
- Create: `cocos/assets/models/sky/cloud.glb`（及编辑器生成的 `.meta`）
- Create: `cocos/assets/models.meta`（Bundle 勾选后）

- [ ] **Step 1: 下载 Cloud GLB**

1. 打开 https://poly.pizza/m/KdFNOVn1Gf （Quaternius · Cloud · CC0）
2. Download → GLTF/GLB
3. 若该页下架：https://poly.pizza/bundle/Modular-Platforming-Bundle-cWyDdbRbAa 内取 cloud 同类资源
4. 将文件放到 `cocos/assets/models/sky/cloud.glb`（目录不存在则新建）

- [ ] **Step 2: 编辑器配置 Bundle**

1. Cocos Creator 打开 `cocos/` 工程，等资源导入完成
2. 选中 `assets/models` 文件夹 → 属性检查器 → 勾选「配置为 Bundle」
3. Bundle 名：`models`；压缩类型可先默认（微信分包在 Task 17 再收紧）
4. 确认资源管理器里能看到 `sky/cloud`（导入名以编辑器为准，一般为去扩展名路径）

- [ ] **Step 3: 记下实际资源路径**

在编辑器点开 `cloud` 资源，确认加载路径是 `sky/cloud` 还是 `sky/cloud/cloud`（嵌套时以后者为准）。后续代码默认 `sky/cloud`；若不一致，改 Task 3 里的字符串。

---

### Task 2: skyMath 纯函数 + 单测

**Files:**
- Create: `cocos/assets/scripts/core/skyMath.ts`
- Create: `cocos/tests/skyMath.test.ts`
- Modify: `cocos/tsconfig.jest.json`（ensure `core/**/*.ts` 已 include —— 当前已 include `assets/scripts/core/**/*.ts`，通常无需改）

- [ ] **Step 1: 写测试 `cocos/tests/skyMath.test.ts`**

```ts
import { nightK, cloudAlpha, nearCloudAllowedX } from '../assets/scripts/core/skyMath';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';

describe('skyMath', () => {
  it('nightK is 0 at ground and 1 at 200m', () => {
    expect(nightK(0)).toBe(0);
    expect(nightK(C.PX_PER_M * 200)).toBe(1);
    expect(nightK(C.PX_PER_M * 100)).toBeCloseTo(0.5);
  });

  it('cloudAlpha fades after mid altitude', () => {
    expect(cloudAlpha(0)).toBeCloseTo(1);
    expect(cloudAlpha(0.25)).toBeGreaterThan(0.7);
    expect(cloudAlpha(1)).toBeCloseTo(0);
  });

  it('nearCloudAllowedX rejects center band (~35% width)', () => {
    const halfW = 400;
    expect(nearCloudAllowedX(0, halfW)).toBe(false);
    expect(nearCloudAllowedX(halfW * 0.1, halfW)).toBe(false);
    expect(nearCloudAllowedX(halfW * 0.5, halfW)).toBe(true);
    expect(nearCloudAllowedX(-halfW * 0.5, halfW)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd cocos && npx jest tests/skyMath.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `cocos/assets/scripts/core/skyMath.ts`**

```ts
import { GameConfig as C } from './GameConfig';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** 昼夜系数:0 白昼 → 1 星空(200m) */
export function nightK(heightPx: number): number {
  return clamp01(heightPx / (C.PX_PER_M * 200));
}

/**
 * 云不透明度倍率:低空满 → 高空消失。
 * 约 k>0.35 开始明显衰减,k=1 为 0。
 */
export function cloudAlpha(k: number): number {
  return clamp01(1 - (clamp01(k) - 0.35) / 0.65);
}

/**
 * 近景云水平位置是否允许(相机局部 x,单位 m)。
 * 中带宽度约为可视半宽的 35%(即 |x| < halfW*0.35 禁止)。
 * halfW 为相机局部可见半宽(m)。
 */
export function nearCloudAllowedX(x: number, halfW: number): boolean {
  if (halfW <= 1e-6) return false;
  return Math.abs(x) >= halfW * 0.35;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd cocos && npx jest tests/skyMath.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add cocos/assets/scripts/core/skyMath.ts cocos/tests/skyMath.test.ts
git commit -m "feat(core): add skyMath helpers for night/cloud/avoid band"
```

---

### Task 3: SkyView —— 柔光日月 + 分层云

**Files:**
- Modify: `cocos/assets/scripts/view/SkyView.ts`
- Modify: `cocos/assets/scripts/Bootstrap.ts`（仅当需要显式传 bundle 名时；默认 SkyView 内自载即可，可不改）

- [ ] **Step 1: 重写 `SkyView.ts`**

完整替换为下列实现（保留渐变/星星；日月加 halo；云异步加载）。注意：`loadBundle` 失败只打日志。

```ts
import {
  _decorator, Component, Node, MeshRenderer, Material, Color, Texture2D, Vec3,
  utils, primitives, Camera, assetManager, Prefab, instantiate, renderer,
} from 'cc';
import { GameConfig as C } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { nightK, cloudAlpha, nearCloudAllowedX } from '../core/skyMath';

const { ccclass } = _decorator;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

interface DriftCloud {
  node: Node;
  z: number;
  y: number;
  speed: number;   // m/s along local x
  baseScale: number;
  near: boolean;
}

@ccclass('SkyView')
export class SkyView extends Component {
  state: GameState | null = null;

  private tex!: Texture2D;
  private lastK = -1;
  private quad!: Node;
  private stars: Node[] = [];
  private sunMoon!: Node;
  private halo!: Node;
  private sunMat!: Material;
  private moonMat!: Material;
  private sunHaloMat!: Material;
  private moonHaloMat!: Material;
  private bodyMr!: MeshRenderer;
  private haloMr!: MeshRenderer;
  private blend = 0; // 0=sun … 1=moon
  private clouds: DriftCloud[] = [];
  private cloudRoot: Node | null = null;
  private halfW = 18; // camera-local approx half width at cloud depth

  build(parent: Node, cam: Camera): void {
    this.tex = new Texture2D();
    this.tex.reset({ width: 2, height: 256, format: Texture2D.PixelFormat.RGBA8888 });
    this.tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);

    const mat = new Material();
    mat.initialize({ effectName: 'builtin-unlit', technique: 1, defines: { USE_TEXTURE: true } });
    mat.setProperty('mainTexture', this.tex);

    this.quad = new Node('SkyQuad');
    parent.addChild(this.quad);
    const mr = this.quad.addComponent(MeshRenderer);
    mr.mesh = utils.createMesh(primitives.plane({ width: 1, length: 1, widthSegments: 1, lengthSegments: 1 }));
    mr.setMaterial(mat, 0);
    this.quad.eulerAngles = new Vec3(90, 0, 0);
    this.quad.setPosition(0, 0, -40);
    this.quad.setScale(90, 1, 36);

    const starMat = new Material();
    starMat.initialize({ effectName: 'builtin-unlit', technique: 1, defines: { USE_COLOR: true } });
    starMat.setProperty('mainColor', new Color(255, 255, 255, 200));
    const starMesh = utils.createMesh(primitives.plane({ width: 0.12, length: 0.12, widthSegments: 1, lengthSegments: 1 }));
    for (let i = 0; i < 40; i++) {
      const st = new Node(`star${i}`);
      parent.addChild(st);
      const smr = st.addComponent(MeshRenderer);
      smr.mesh = starMesh;
      smr.setMaterial(starMat, 0);
      st.eulerAngles = new Vec3(90, 0, 0);
      st.setPosition(((i * 197.3) % 800) / 800 * 40 - 20, ((i * 89.7) % 420) / 600 * 12 - 2, -39);
      this.stars.push(st);
    }

    // 日月主体 + 光晕
    this.sunMat = this.makeUnlit(new Color(255, 237, 176, 255), false);
    this.moonMat = this.makeUnlit(new Color(244, 241, 222, 255), false);
    this.sunHaloMat = this.makeUnlit(new Color(255, 220, 140, 90), true);
    this.moonHaloMat = this.makeUnlit(new Color(220, 230, 255, 55), true);

    this.sunMoon = new Node('SunMoon');
    parent.addChild(this.sunMoon);
    this.bodyMr = this.sunMoon.addComponent(MeshRenderer);
    this.bodyMr.mesh = utils.createMesh(primitives.sphere(1.5, { segments: 20 }));
    this.bodyMr.setMaterial(this.sunMat, 0);
    this.sunMoon.setPosition(8, 5.5, -37);

    this.halo = new Node('Halo');
    this.sunMoon.addChild(this.halo);
    this.haloMr = this.halo.addComponent(MeshRenderer);
    this.haloMr.mesh = utils.createMesh(primitives.plane({ width: 1, length: 1, widthSegments: 1, lengthSegments: 1 }));
    this.haloMr.setMaterial(this.sunHaloMat, 0);
    this.halo.eulerAngles = new Vec3(90, 0, 0);
    this.halo.setScale(5.5, 1, 5.5);
    this.halo.setPosition(0, 0, 0.05);

    this.cloudRoot = new Node('CloudRoot');
    parent.addChild(this.cloudRoot);
    this.loadClouds();

    void cam;
    this.lastK = -1;
  }

  private makeUnlit(c: Color, transparent: boolean): Material {
    const m = new Material();
    m.initialize({
      effectName: 'builtin-unlit',
      technique: transparent ? 1 : 0,
      defines: { USE_COLOR: true },
    });
    m.setProperty('mainColor', c);
    return m;
  }

  private loadClouds(): void {
    assetManager.loadBundle('models', (err, bundle) => {
      if (err || !bundle) {
        console.warn('[SkyView] models bundle missing — skip clouds', err);
        return;
      }
      // 若编辑器路径不同,改成实际路径(见 Task 1 Step 3)
      bundle.load('sky/cloud', Prefab, (e, prefab) => {
        if (e || !prefab) {
          // 有的工程 GLB 导入为场景/网格而非 Prefab —— 再试 load 任意
          bundle.load('sky/cloud', (e2, asset) => {
            if (e2 || !asset) {
              console.warn('[SkyView] cloud asset missing — skip clouds', e || e2);
              return;
            }
            this.spawnCloudsFromAsset(asset);
          });
          return;
        }
        this.spawnCloudsFromPrefab(prefab);
      });
    });
  }

  private spawnCloudsFromPrefab(prefab: Prefab): void {
    const mk = (near: boolean, i: number): void => {
      const node = instantiate(prefab);
      this.cloudRoot!.addChild(node);
      const side = i % 2 === 0 ? -1 : 1;
      let x = side * (near ? 10 + (i % 3) * 2.5 : 6 + (i % 4) * 3);
      if (near && !nearCloudAllowedX(x, this.halfW)) x = side * (this.halfW * 0.45 + (i % 2));
      const y = near ? (-1 + (i % 3) * 2.2) : (2 + (i % 4) * 1.8);
      const z = near ? -28 - (i % 3) : -34 - (i % 4);
      const sc = near ? 1.2 + (i % 3) * 0.25 : 0.7 + (i % 3) * 0.15;
      node.setPosition(x, y, z);
      node.setScale(sc, sc, sc);
      this.clouds.push({
        node, z, y, speed: (near ? 0.35 : 0.18) * side * (i % 2 === 0 ? 1 : -1),
        baseScale: sc, near,
      });
    };
    for (let i = 0; i < 5; i++) mk(false, i); // far
    for (let i = 0; i < 4; i++) mk(true, i);  // near
  }

  private spawnCloudsFromAsset(asset: Prefab | Node | object): void {
    if (asset instanceof Prefab) {
      this.spawnCloudsFromPrefab(asset);
      return;
    }
    console.warn('[SkyView] cloud asset is not a Prefab — skip (import GLB as Prefab in editor)');
  }

  update(dt: number): void {
    const s = this.state;
    if (!s) return;
    const k = nightK(s.heightPx);

    // 渐变纹理
    if (Math.abs(k - this.lastK) > 0.01) {
      this.lastK = k;
      const top = [lerp(88, 30, k), lerp(176, 24, k), lerp(240, 70, k)];
      const bot = [lerp(196, 90, k), lerp(236, 60, k), lerp(255, 110, k)];
      const data = new Uint8Array(2 * 256 * 4);
      for (let y = 0; y < 256; y++) {
        const t = y / 255;
        const r = lerp(bot[0], top[0], t), g = lerp(bot[1], top[1], t), b = lerp(bot[2], top[2], t);
        for (let x = 0; x < 2; x++) {
          const o = (y * 2 + x) * 4;
          data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
      }
      this.tex.uploadData(data);
    }

    // 日月 ~0.3s 交叉
    const target = k < 0.5 ? 0 : 1;
    this.blend = this.blend + (target - this.blend) * Math.min(1, dt / 0.3);
    const sunW = 1 - this.blend;
    this.bodyMr.setMaterial(this.blend < 0.5 ? this.sunMat : this.moonMat, 0);
    this.haloMr.setMaterial(this.blend < 0.5 ? this.sunHaloMat : this.moonHaloMat, 0);
    const bodyA = 255;
    const haloA = Math.round(lerp(90, 55, this.blend));
    // 缩放光晕:太阳更大
    const hs = lerp(5.5, 4.2, this.blend);
    this.halo.setScale(hs, 1, hs);
    void sunW; void bodyA; void haloA;

    // 星星
    const alpha = clamp01((k - 0.25) * 1.5);
    for (let i = 0; i < this.stars.length; i++) {
      const tw = 0.5 + 0.5 * Math.sin(s.t * 2 + i);
      this.stars[i].active = alpha * tw > 0.05;
    }

    // 云漂移 + 高度淡出(用 scale 近似;材质 alpha 依赖模型着色器,scale 更稳)
    const ca = cloudAlpha(k);
    const wrap = this.halfW + 4;
    for (const c of this.clouds) {
      const p = c.node.position;
      let x = p.x + c.speed * dt;
      if (x > wrap) x = -wrap;
      if (x < -wrap) x = wrap;
      if (c.near && !nearCloudAllowedX(x, this.halfW)) {
        // 穿过中带时瞬移到另一侧外沿
        x = (x >= 0 ? 1 : -1) * this.halfW * 0.45;
      }
      c.node.setPosition(x, c.y, c.z);
      const sc = c.baseScale * (0.35 + 0.65 * ca) * (c.near ? 1 : 0.85);
      c.node.setScale(sc, sc, sc);
      c.node.active = ca > 0.05;
    }
  }
}
```

实现时若 `Prefab` 导入方式与工程不符：在编辑器把 `cloud.glb` 的导入类型设为可实例化，或改用 `bundle.load` + `instantiate` 官方 GLB 流程。删除未使用的 `renderer` import（若最终未用）。

- [ ] **Step 2: 单测回归**

Run: `cd cocos && npx jest`
Expected: 原 29 + skyMath 3 = **32 passed**

- [ ] **Step 3: `tsc` 无报错**

Run: `cd cocos && npx tsc -p tsconfig.json --noEmit`
Expected: 无输出，exit 0

- [ ] **Step 4: Commit**

```bash
git add cocos/assets/scripts/view/SkyView.ts cocos/assets/models/
git commit -m "feat(view): soft sun/moon halo and layered CC0 clouds"
```

---

### Task 4: 文档 —— ASSETS.md + 主设计资源表

**Files:**
- Create: `ASSETS.md`
- Modify: `docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md`（资源清单表）

- [ ] **Step 1: 写 `ASSETS.md`**

```markdown
# 第三方资源

| 文件 | 名称 | 作者 | 来源 | License | 署名文案 |
|---|---|---|---|---|---|
| cocos/assets/models/sky/cloud.glb | Cloud | Quaternius | https://poly.pizza/m/KdFNOVn1Gf | CC0 | 无需署名 |
```

若实际下载 URL 不同，按真实来源改一行。

- [ ] **Step 2: 更新主设计文档资源表**

在 `2026-07-29-bamboo-cocos-rewrite-design.md` 的「资源清单」表格中：

- 将隐含的「天空纯程序化」决策第 3 条改为：天空 = 程序化渐变底 + CC0 云 / 柔光日月（详见 `2026-07-31-sky-cc0-props-design.md`）。
- 资源表追加一行：云 | Quaternius Cloud | CC0 | `models/sky/cloud.glb`。

- [ ] **Step 3: Commit**

```bash
git add ASSETS.md docs/superpowers/specs/2026-07-29-bamboo-cocos-rewrite-design.md
git commit -m "docs: register sky CC0 cloud and update design asset table"
```

---

### Task 5: MANUAL GATE —— 预览验收

- [ ] **Step 1: 预览**

编辑器 ▶ 预览，按空格升高。

预期（对照 spec 验收清单）：

1. 低空：暖色天空 + 太阳光晕 + 两侧分层云漂，中带竹/熊猫清晰
2. ~50m+：星星出现；云变淡
3. ~100m+：月亮替换太阳；云接近消失
4. 无红字；FPS 可接受

- [ ] **Step 2: 降级抽查**

临时将 `cloud.glb` 改名 → 预览应无红错、可玩、仅无云 → 改回。

- [ ] **Step 3: 包体粗查**

`du -sh cocos/assets/models/sky` 应明显小于 2MB（通常远小于）。

通过后继续主计划 Task 13 HUD。

---

## Spec coverage

| Spec 要求 | Task |
|---|---|
| 柔光日月 + 光晕 + 淡入切换 | Task 3 |
| CC0 分层云 + 漂移 + 避让 + 高度淡出 | Task 1 + 3 |
| 缺资源降级 | Task 3 `loadClouds` |
| ASSETS.md / 主设计表 | Task 4 |
| 手动验收 | Task 5 |
| nightK/cloudAlpha/避让可测 | Task 2 |

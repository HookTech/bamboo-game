import {
  _decorator, Component, Node, MeshRenderer, Material, Color, Texture2D, Vec3,
  utils, primitives, Camera, assetManager, Prefab, instantiate,
} from 'cc';
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

    // 日月 ~0.3s 交叉:blend 平滑逼近目标,光晕尺寸/透明度随 blend 插值
    const target = k < 0.5 ? 0 : 1;
    this.blend = this.blend + (target - this.blend) * Math.min(1, dt / 0.3);
    this.bodyMr.setMaterial(this.blend < 0.5 ? this.sunMat : this.moonMat, 0);
    this.haloMr.setMaterial(this.blend < 0.5 ? this.sunHaloMat : this.moonHaloMat, 0);
    const haloA = Math.round(lerp(90, 55, this.blend));
    const haloRgb = this.blend < 0.5
      ? [255, 220, 140] as const
      : [220, 230, 255] as const;
    (this.blend < 0.5 ? this.sunHaloMat : this.moonHaloMat).setProperty(
      'mainColor',
      new Color(haloRgb[0], haloRgb[1], haloRgb[2], haloA),
    );
    const hs = lerp(5.5, 4.2, this.blend);
    this.halo.setScale(hs, 1, hs);

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

import {
  _decorator, Component, Node, MeshRenderer, Material, Color, Texture2D, Vec3,
  utils, primitives, Camera, assetManager, Prefab, instantiate,
} from 'cc';
import { GameState } from '../core/GameState';
import { nightK, cloudAlpha, nearCloudAllowedX } from '../core/skyMath';

const { ccclass } = _decorator;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** cloud.glb 内嵌 Prefab 子资源 UUID(meta @cde1c)——预览里比 bundle 路径更稳 */
const CLOUD_PREFAB_UUID = '823761ca-f1ce-4191-aa8c-04ede3535433@cde1c';

interface DriftCloud {
  node: Node;
  z: number;
  y: number;
  speed: number;
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
  private blend = 0;
  private clouds: DriftCloud[] = [];
  private cloudRoot: Node | null = null;
  private halfW = 18;

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

    // 日月:球体 + 径向渐变圆形光晕(避免方板灰框)
    this.sunMat = this.makeUnlitColor(new Color(255, 220, 120, 255), false);
    this.moonMat = this.makeUnlitColor(new Color(235, 240, 255, 255), false);
    this.sunHaloMat = this.makeUnlitRadial([255, 210, 120]);
    this.moonHaloMat = this.makeUnlitRadial([210, 220, 255]);

    this.sunMoon = new Node('SunMoon');
    parent.addChild(this.sunMoon);
    this.bodyMr = this.sunMoon.addComponent(MeshRenderer);
    this.bodyMr.mesh = utils.createMesh(primitives.sphere(1.4, { segments: 24 }));
    this.bodyMr.setMaterial(this.sunMat, 0);
    this.sunMoon.setPosition(8, 5.5, -37);

    this.halo = new Node('Halo');
    this.sunMoon.addChild(this.halo);
    this.haloMr = this.halo.addComponent(MeshRenderer);
    this.haloMr.mesh = utils.createMesh(primitives.plane({ width: 1, length: 1, widthSegments: 1, lengthSegments: 1 }));
    this.haloMr.setMaterial(this.sunHaloMat, 0);
    this.halo.eulerAngles = new Vec3(90, 0, 0);
    this.halo.setScale(6.5, 1, 6.5);
    this.halo.setPosition(0, 0, 0.08);

    this.cloudRoot = new Node('CloudRoot');
    parent.addChild(this.cloudRoot);
    this.loadClouds();

    void cam;
    this.lastK = -1;
  }

  private makeUnlitColor(c: Color, transparent: boolean): Material {
    const m = new Material();
    m.initialize({
      effectName: 'builtin-unlit',
      technique: transparent ? 1 : 0,
      defines: { USE_COLOR: true },
    });
    m.setProperty('mainColor', c);
    return m;
  }

  /** 圆形软光晕:中心不透明、边缘透明,消除方板感 */
  private makeUnlitRadial(rgb: readonly [number, number, number]): Material {
    const N = 64;
    const data = new Uint8Array(N * N * 4);
    const cx = (N - 1) / 2;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cx) / cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        const a = d >= 1 ? 0 : Math.round(220 * (1 - d) * (1 - d));
        const o = (y * N + x) * 4;
        data[o] = rgb[0];
        data[o + 1] = rgb[1];
        data[o + 2] = rgb[2];
        data[o + 3] = a;
      }
    }
    const tex = new Texture2D();
    tex.reset({ width: N, height: N, format: Texture2D.PixelFormat.RGBA8888 });
    tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    tex.setMipFilter(Texture2D.Filter.NONE);
    tex.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
    tex.uploadData(data);

    const m = new Material();
    m.initialize({
      effectName: 'builtin-unlit',
      technique: 1,
      defines: { USE_TEXTURE: true },
    });
    m.setProperty('mainTexture', tex);
    return m;
  }

  private loadClouds(): void {
    // 1) UUID 直载(编辑器预览最稳)
    assetManager.loadAny({ uuid: CLOUD_PREFAB_UUID }, (err, asset) => {
      if (!this.isValid || !this.cloudRoot?.isValid) return;
      if (!err && asset instanceof Prefab) {
        console.log('[SkyView] cloud loaded via uuid');
        this.spawnCloudsFromPrefab(asset);
        return;
      }
      console.warn('[SkyView] uuid load failed, try models bundle', err);
      this.loadCloudsFromBundle();
    });
  }

  private loadCloudsFromBundle(): void {
    assetManager.loadBundle('models', (err, bundle) => {
      if (!this.isValid || !this.cloudRoot?.isValid) return;
      if (err || !bundle) {
        console.warn('[SkyView] models bundle missing — skip clouds', err);
        return;
      }
      bundle.load('sky/cloud', Prefab, (e, prefab) => {
        if (!this.isValid || !this.cloudRoot?.isValid) return;
        if (!e && prefab) {
          console.log('[SkyView] cloud loaded via bundle Prefab');
          this.spawnCloudsFromPrefab(prefab);
          return;
        }
        bundle.load('sky/cloud', (e2, asset) => {
          if (!this.isValid || !this.cloudRoot?.isValid) return;
          if (e2 || !asset) {
            console.warn('[SkyView] cloud asset missing — skip clouds', e || e2);
            return;
          }
          if (asset instanceof Prefab) {
            this.spawnCloudsFromPrefab(asset);
            return;
          }
          console.warn('[SkyView] cloud asset is not a Prefab', asset);
        });
      });
    });
  }

  private spawnCloudsFromPrefab(prefab: Prefab): void {
    if (!this.isValid || !this.cloudRoot?.isValid) return;
    // Prefab 内 Cloud1 已有 scale≈100,根节点再用 0.03~0.05 → 世界约 3~5m
    const mk = (near: boolean, i: number): void => {
      const node = instantiate(prefab);
      this.cloudRoot!.addChild(node);
      const side = i % 2 === 0 ? -1 : 1;
      let x = side * (near ? 9 + (i % 3) * 2.2 : 7 + (i % 4) * 2.8);
      if (near && !nearCloudAllowedX(x, this.halfW)) x = side * (this.halfW * 0.45 + (i % 2));
      const y = near ? (0.5 + (i % 3) * 2.0) : (2.5 + (i % 4) * 1.6);
      const z = near ? -26 - (i % 3) * 0.4 : -32 - (i % 4) * 0.5;
      // Prefab 内 Cloud1 scale≈100; 根节点 0.2 → 世界约 20m,侧视才像云不是苍蝇
      const sc = near ? 0.22 + (i % 3) * 0.04 : 0.14 + (i % 3) * 0.03;
      node.setPosition(x, y, z);
      node.setScale(sc, sc, sc);
      this.clouds.push({
        node,
        z,
        y,
        speed: (near ? 0.4 : 0.22) * side * (i % 2 === 0 ? 1 : -1),
        baseScale: sc,
        near,
      });
    };
    for (let i = 0; i < 5; i++) mk(false, i);
    for (let i = 0; i < 4; i++) mk(true, i);
    console.log(`[SkyView] clouds ready: ${this.clouds.length}`);
  }

  update(dt: number): void {
    const s = this.state;
    if (!s) return;
    const k = nightK(s.heightPx);

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

    const target = k < 0.5 ? 0 : 1;
    this.blend = this.blend + (target - this.blend) * Math.min(1, dt / 0.3);
    this.bodyMr.setMaterial(this.blend < 0.5 ? this.sunMat : this.moonMat, 0);
    this.haloMr.setMaterial(this.blend < 0.5 ? this.sunHaloMat : this.moonHaloMat, 0);
    const hs = lerp(6.5, 5.0, this.blend);
    this.halo.setScale(hs, 1, hs);

    const alpha = clamp01((k - 0.25) * 1.5);
    for (let i = 0; i < this.stars.length; i++) {
      const tw = 0.5 + 0.5 * Math.sin(s.t * 2 + i);
      this.stars[i].active = alpha * tw > 0.05;
    }

    const ca = cloudAlpha(k);
    const wrap = this.halfW + 4;
    for (const c of this.clouds) {
      const p = c.node.position;
      let x = p.x + c.speed * dt;
      if (x > wrap) x = -wrap;
      if (x < -wrap) x = wrap;
      if (c.near && !nearCloudAllowedX(x, this.halfW)) {
        x = (x >= 0 ? 1 : -1) * this.halfW * 0.45;
      }
      c.node.setPosition(x, c.y, c.z);
      const sc = c.baseScale * (0.35 + 0.65 * ca);
      c.node.setScale(sc, sc, sc);
      c.node.active = ca > 0.05;
    }
  }
}

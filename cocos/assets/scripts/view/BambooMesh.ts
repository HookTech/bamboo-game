import { _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3, utils, primitives, EffectAsset } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { tipSwayPx } from '../core/Sway';
import { GameState } from '../core/GameState';

const { ccclass } = _decorator;
const SEG_M = C.SEG_LEN_PX / C.PX_PER_M; // 0.92

@ccclass('BambooMesh')
export class BambooMesh extends Component {
  state: GameState | null = null;
  swayPx = 0;

  private cyl: Mesh | null = null;
  private segs: Node[] = [];
  private matA: Material | null = null;
  private matB: Material | null = null;
  private matDizzy: Material | null = null;
  private effect: EffectAsset | null = null;

  onLoad(): void {
    // 半径:顶 0.5 / 底 0.56 → 段底微张,接缝处读出竹节感
    this.cyl = utils.createMesh(primitives.cylinder(0.5, 0.56, SEG_M, { radialSegments: 8 }));
  }

  /** Bootstrap 预载 effect 后注入。effect 注册名可能是路径而非文件名,故用引用而非 effectName。 */
  initMaterials(effect: EffectAsset | null): void {
    this.effect = effect;
    this.matA = this.makeMat(new Color(96, 168, 84));
    this.matB = this.makeMat(new Color(130, 190, 110));
    this.matDizzy = this.makeMat(new Color(201, 209, 107));
  }

  private makeMat(c: Color): Material {
    const m = new Material();
    if (this.effect) {
      m.initialize({ effectAsset: this.effect });
    } else {
      // 预载失败时降级,保证预览不崩
      m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
    }
    m.setProperty('mainColor', c);
    return m;
  }

  private ensureSegments(n: number): void {
    if (!this.matA) return;
    while (this.segs.length < n) {
      const node = new Node(`seg${this.segs.length}`);
      this.node.addChild(node);
      this.segs.push(node);
      const mr = node.addComponent(MeshRenderer);
      mr.mesh = this.cyl;
      mr.setMaterial(this.matA, 0);
    }
  }

  update(_dt: number): void {
    const s = this.state;
    if (!s || !this.matA || !this.matB || !this.matDizzy) return;
    this.swayPx = tipSwayPx(s.t, s.heightPx, s.targetHeightPx, s.stunned);
    const h = s.heightPx;
    if (h < 4) {
      for (const seg of this.segs) seg.active = false;
      return;
    }
    const n = Math.ceil(h / C.SEG_LEN_PX);
    this.ensureSegments(n);
    const bend = this.swayPx * 300 / (h * h); // 原型弯曲系数(px 空间)
    const dizzyFlash = s.stunned && Math.floor(s.t * 10) % 2 === 1;
    for (let i = 0; i < this.segs.length; i++) {
      const seg = this.segs[i];
      if (i >= n) { seg.active = false; continue; }
      seg.active = true;
      const y0 = i * C.SEG_LEN_PX;
      const yMid = y0 + C.SEG_LEN_PX / 2;
      const diaPx = 16 + (7 - 16) * (yMid / h);            // 锥度 16→7px
      const fracY = Math.min(1, (h - y0) / C.SEG_LEN_PX);  // 顶端不足一段时压扁
      seg.setScale(px2m(diaPx), fracY, px2m(diaPx));
      seg.setPosition(px2m(bend * yMid * yMid / 300), px2m(y0 + (C.SEG_LEN_PX * fracY) / 2), 0);
      const slope = 2 * bend * yMid / 300;                 // dx/dy
      seg.eulerAngles = new Vec3(0, 0, -Math.atan(slope) * 180 / Math.PI);
      const mat = dizzyFlash ? this.matDizzy : (i % 2 ? this.matB : this.matA);
      const mr = seg.getComponent(MeshRenderer)!;
      if (mr.getSharedMaterial(0) !== mat) mr.setMaterial(mat, 0);
    }
  }
}

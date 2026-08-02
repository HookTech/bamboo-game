import { _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3, utils, primitives, EffectAsset } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { PandaView } from '../view/PandaView';
import { CameraRig } from '../view/CameraRig';

const { ccclass } = _decorator;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

interface P { node: Node; vx: number; vy: number; vr: number; life: number; max: number; }

@ccclass('ParticleFx')
export class ParticleFx extends Component {
  state: GameState | null = null;
  panda: PandaView | null = null;
  rig: CameraRig | null = null;

  private effect: EffectAsset | null = null;
  private dotMesh!: Mesh;
  private leafMesh!: Mesh;
  private goldMat!: Material;
  private leafMat!: Material;
  private starMat!: Material;
  private dots: P[] = [];
  private leaves: P[] = [];
  private stunStars: Node[] = [];

  onLoad(): void {
    this.dotMesh = utils.createMesh(primitives.sphere(0.05, { segments: 6 }));
    this.leafMesh = utils.createMesh(primitives.box({ width: 0.14, height: 0.06, length: 0.02 }));
    for (let i = 0; i < 3; i++) {
      const st = new Node(`stunStar${i}`);
      this.node.addChild(st);
      const mr = st.addComponent(MeshRenderer);
      mr.mesh = this.dotMesh;
      st.setScale(1.4, 1.4, 1.4);
      st.active = false;
      this.stunStars.push(st);
    }
  }

  /** Bootstrap 预载 effect 后注入,避免 effectName 查找 miss。 */
  initMaterials(effect: EffectAsset | null): void {
    this.effect = effect;
    this.goldMat = this.makeMat(new Color(255, 215, 110));
    this.leafMat = this.makeMat(new Color(110, 170, 90));
    this.starMat = this.makeMat(new Color(255, 226, 122));
    for (const st of this.stunStars) {
      st.getComponent(MeshRenderer)!.setMaterial(this.starMat, 0);
    }
  }

  private makeMat(c: Color): Material {
    const m = new Material();
    if (this.effect) {
      m.initialize({ effectAsset: this.effect });
    } else {
      m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
    }
    m.setProperty('mainColor', c);
    return m;
  }

  private obtain(list: P[], mesh: Mesh, mat: Material, prefix: string): P {
    for (const p of list) {
      if (p.life <= 0) { p.node.active = true; return p; }
    }
    const node = new Node(`${prefix}${list.length}`);
    this.node.addChild(node);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = mesh;
    mr.setMaterial(mat, 0);
    const p: P = { node, vx: 0, vy: 0, vr: 0, life: 0, max: 1 };
    list.push(p);
    return p;
  }

  /** 拾取爆发:14 个金点四散(原型 spawnBurst) */
  burst(worldPos: Vec3): void {
    for (let i = 0; i < 14; i++) {
      const p = this.obtain(this.dots, this.dotMesh, this.goldMat, 'dot');
      const a = rand(0, Math.PI * 2), sp = rand(40, 160);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = p.max = rand(0.4, 0.8);
      p.node.setPosition(worldPos);
      const sc = rand(0.8, 1.6);
      p.node.setScale(sc, sc, 1);
    }
  }

  /** 动物撞击掉币:金点主要向下喷。 */
  coinDrop(worldPos: Vec3): void {
    for (let i = 0; i < 10; i++) {
      const p = this.obtain(this.dots, this.dotMesh, this.goldMat, 'drop');
      const a = rand(-Math.PI * 0.7, -Math.PI * 0.3);
      const sp = rand(50, 140);
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = p.max = rand(0.45, 0.9);
      p.node.setPosition(worldPos);
      const sc = rand(0.8, 1.5);
      p.node.setScale(sc, sc, 1);
    }
  }

  /** 竹根溅叶(原型:每次生长 3 片) */
  splashLeaves(): void {
    const baseX = px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2);
    for (let i = 0; i < 3; i++) this.spawnLeaf(baseX + px2m(rand(-14, 14)), 0.12);
  }

  private spawnLeaf(x: number, y: number): void {
    const p = this.obtain(this.leaves, this.leafMesh, this.leafMat, 'leaf');
    p.vx = rand(-25, 25);
    p.vy = rand(30, 70);
    p.vr = rand(-3, 3);
    p.life = p.max = rand(1.2, 2.2);
    p.node.setPosition(x, y, 0);
  }

  update(dt: number): void {
    const s = this.state;
    for (const p of this.dots) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= 300 * dt; // 世界坐标下粒子下落(px 速度)
      const pos = p.node.position;
      p.node.setPosition(pos.x + px2m(p.vx) * dt, pos.y + px2m(p.vy) * dt, 0);
      if (p.life <= 0) p.node.active = false;
    }
    for (const p of this.leaves) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const pos = p.node.position;
      p.node.setPosition(pos.x + px2m(p.vx) * dt, pos.y - px2m(p.vy) * dt, 0);
      p.node.eulerAngles = new Vec3(0, 0, p.node.eulerAngles.z + p.vr * 57 * dt);
      if (p.life <= 0) p.node.active = false;
    }
    if (!s || !this.panda || !this.rig) return;
    // 高空偶发落叶(原型概率 dt*0.8)
    if (Math.random() < dt * 0.8 && s.heightPx > 120) {
      const char = this.panda.charPx; // 世界 px,直接用,不加 camX
      this.spawnLeaf(px2m(char.x + rand(-30, 30)), px2m(s.heightPx - rand(0, 120)));
    }
    // 眩晕星星绕头
    const show = s.stunned;
    for (let i = 0; i < this.stunStars.length; i++) {
      const st = this.stunStars[i];
      st.active = show;
      if (show) {
        const char = this.panda.charPx;
        const a = s.t * 4 + i * Math.PI * 2 / 3;
        st.setPosition(px2m(char.x + Math.cos(a) * 22), px2m(char.y + 30 + Math.sin(a) * 6), 0);
      }
    }
  }
}

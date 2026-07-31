import { _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3, utils, primitives, EffectAsset } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { CameraRig } from './CameraRig';
import { PandaView } from './PandaView';

const { ccclass } = _decorator;

interface Coin {
  node: Node;
  xPx: number;   // 屏心相对 px
  yPx: number;   // 世界 px
  ph: number;
  vx: number;
  spin: number;
  alive: boolean;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

@ccclass('CoinView')
export class CoinView extends Component {
  /** 拾取回调:参数为金币世界坐标(m),由 Bootstrap 接线(加分/音效/粒子/浮字) */
  onPickup: ((worldPos: Vec3) => void) | null = null;
  state: GameState | null = null;
  rig: CameraRig | null = null;
  panda: PandaView | null = null;

  private pool: Coin[] = [];
  private mesh: Mesh | null = null;
  private mat: Material | null = null;
  private lastSpawn = 0;

  onLoad(): void {
    this.mesh = utils.createMesh(primitives.cylinder(0.14, 0.14, 0.05, { radialSegments: 16 }));
  }

  initMaterials(effect: EffectAsset | null): void {
    const mat = new Material();
    if (effect) {
      mat.initialize({ effectAsset: effect });
    } else {
      mat.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
    }
    mat.setProperty('mainColor', new Color(255, 215, 110));
    this.mat = mat;
  }

  private obtain(): Coin {
    for (const c of this.pool) {
      if (!c.alive) { c.alive = true; c.node.active = true; return c; }
    }
    const node = new Node(`coin${this.pool.length}`);
    this.node.addChild(node);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = this.mesh;
    mr.setMaterial(this.mat!, 0);
    node.eulerAngles = new Vec3(90, 0, 0); // 圆柱轴向转朝相机
    const c: Coin = { node, xPx: 0, yPx: 0, ph: 0, vx: 0, spin: 0, alive: true };
    this.pool.push(c);
    return c;
  }

  update(dt: number): void {
    const s = this.state, rig = this.rig, panda = this.panda;
    if (!s || !rig || !panda || !s.started || !this.mat) return;

    // 生成:天上始终有货(原型 0.7s / 上限 30)
    if (s.t - this.lastSpawn > C.COIN_SPAWN_INTERVAL && this.pool.filter(c => c.alive).length < C.COIN_MAX_ALIVE) {
      this.lastSpawn = s.t;
      const c = this.obtain();
      const halfW = rig.visibleWidthPx() / 2 - 60;
      c.xPx = rand(-halfW, halfW);
      c.yPx = rig.camYPx + C.DESIGN_H + rand(0, 240);
      c.ph = rand(0, Math.PI * 2);
      c.vx = rand(-14, 14);
      c.spin = rand(0, Math.PI * 2);
    }

    const char = panda.charPx; // 世界 px(x 原点 = world 0,y 地面 0)
    const charRelX = char.x - rig.camX * C.PX_PER_M; // 转屏心相对,与金币同空间
    const halfWBounce = rig.visibleWidthPx() / 2 - 30;
    for (const c of this.pool) {
      if (!c.alive) continue;
      c.ph += dt * 2;
      c.spin += dt * 5;
      c.xPx += (c.vx + Math.sin(c.ph) * 12) * dt;
      c.yPx += Math.cos(c.ph * 0.7) * 8 * dt;
      if (c.xPx < -halfWBounce || c.xPx > halfWBounce) c.vx *= -1;

      const dx = charRelX - c.xPx, dy = char.y - c.yPx;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (d < C.MAGNET_RADIUS_PX) {
        c.xPx += dx / d * 220 * dt;
        c.yPx += dy / d * 220 * dt;
      }
      if (d < C.PICKUP_RADIUS_PX) {
        c.alive = false;
        c.node.active = false;
        if (this.onPickup) this.onPickup(new Vec3(rig.camX + px2m(c.xPx), px2m(c.yPx), 0));
        continue;
      }
      if (c.yPx < rig.camYPx - 60) { // 落到屏幕下方丢弃
        c.alive = false;
        c.node.active = false;
        continue;
      }
      c.node.setPosition(rig.camX + px2m(c.xPx), px2m(c.yPx), 0);
      c.node.eulerAngles = new Vec3(90, c.spin * 180 / Math.PI, 0);
    }
  }
}

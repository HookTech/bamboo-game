import { _decorator, Component, MeshRenderer, Material, Color, Vec3, utils, primitives, EffectAsset } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { BambooMesh } from './BambooMesh';

const { ccclass } = _decorator;

@ccclass('PandaView')
export class PandaView extends Component {
  bamboo: BambooMesh | null = null;
  private state: GameState | null = null;
  private flash = 0;
  private body!: MeshRenderer;
  private mat: Material | null = null;

  onLoad(): void {
    // 占位胶囊:半径 0.2m,圆柱段高 0.5m —— Task 16 换成小熊猫 GLB
    const mesh = utils.createMesh(primitives.capsule(0.2, 0.2, 0.5));
    this.body = this.node.addComponent(MeshRenderer);
    this.body.mesh = mesh;
  }

  /** Bootstrap 预载 effect 后注入,避免 effectName 查找 miss。 */
  initMaterials(effect: EffectAsset | null): void {
    const mat = new Material();
    if (effect) {
      mat.initialize({ effectAsset: effect });
    } else {
      mat.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
    }
    mat.setProperty('mainColor', new Color(192, 84, 39)); // 原型 FUR #c05427
    this.mat = mat;
    this.body.setMaterial(mat, 0);
  }

  attach(state: GameState): void {
    this.state = state;
    state.on('grow', () => { this.flash = 1; });
  }

  update(dt: number): void {
    const s = this.state;
    if (!s || !this.bamboo || !this.mat) return;
    this.flash = Math.max(0, this.flash - dt * 4);
    const h = s.heightPx;
    const charWY = Math.max(h - C.CHAR_OFFSET_PX, 0);
    const ratio = h > 1 ? charWY / h : 0;
    const bounce = Math.sin(s.t * 3) * 2 - this.flash * 4; // 原型回弹(px)
    // 横向:贴竹身右侧 16px,随竹尖摆动按 ratio² 偏移
    this.node.setPosition(px2m(16 + this.bamboo.swayPx * ratio * ratio), px2m(charWY + bounce), 0);
    this.node.eulerAngles = s.stunned
      ? new Vec3(0, 0, Math.sin(s.t * 20) * 8.6)
      : new Vec3(0, 0, 0);
  }

  /** 小人中心的世界 px 坐标(x 原点 = world 0,y 地面为 0),含贴竹身右侧 16px 偏移。 */
  get charPx(): { x: number; y: number } {
    const s = this.state;
    if (!s || !this.bamboo) return { x: 0, y: 0 };
    const h = s.heightPx;
    const charWY = Math.max(h - C.CHAR_OFFSET_PX, 0);
    const ratio = h > 1 ? charWY / h : 0;
    return { x: C.BAMBOO_X_PX - C.DESIGN_W / 2 + 16 + this.bamboo.swayPx * ratio * ratio, y: charWY };
  }
}

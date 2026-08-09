import {
  _decorator, Component, MeshRenderer, Material, Color, Vec3, utils, primitives,
  EffectAsset, assetManager, Prefab, instantiate, Node, SkeletalAnimation,
} from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { BambooMesh } from './BambooMesh';

const { ccclass } = _decorator;

/** panda.glb 内嵌 Prefab 子资源 UUID(meta @ad051)——预览里比 bundle 路径更稳 */
const PANDA_PREFAB_UUID = '16b18872-b41f-441e-be11-00f42363f347@ad051';

@ccclass('PandaView')
export class PandaView extends Component {
  bamboo: BambooMesh | null = null;
  private state: GameState | null = null;
  private flash = 0;
  private body!: MeshRenderer;
  private mat: Material | null = null;
  private model: Node | null = null;
  private anim: SkeletalAnimation | null = null;
  private kickMirrorUntil = 0;
  private baseModelScaleX = 1;

  onLoad(): void {
    // 占位胶囊:半径 0.2m,圆柱段高 0.5m —— GLB 失败时保留
    const mesh = utils.createMesh(primitives.capsule(0.2, 0.2, 0.5));
    this.body = this.node.addComponent(MeshRenderer);
    this.body.mesh = mesh;
    this.loadModel();
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

  private loadModel(): void {
    assetManager.loadAny({ uuid: PANDA_PREFAB_UUID }, (err, asset) => {
      if (!this.isValid) return;
      if (!err && asset instanceof Prefab) {
        console.log('[PandaView] panda loaded via uuid');
        this.applyModel(asset);
        return;
      }
      console.warn('[PandaView] uuid load failed, try models bundle', err);
      assetManager.loadBundle('models', (e2, bundle) => {
        if (!this.isValid) return;
        if (e2 || !bundle) {
          console.warn('[PandaView] models bundle missing — keep capsule', e2);
          return;
        }
        bundle.load('panda', Prefab, (e3, prefab) => {
          if (!this.isValid) return;
          if (e3 || !prefab) {
            console.warn('[PandaView] panda Prefab missing — keep capsule', e3);
            return;
          }
          console.log('[PandaView] panda loaded via bundle');
          this.applyModel(prefab);
        });
      });
    });
  }

  private applyModel(prefab: Prefab): void {
    if (this.model?.isValid) this.model.destroy();
    const model = instantiate(prefab);
    this.node.addChild(model);
    // Armature 已带 scale≈0.01(cm→m),根再 1 → 身高约 0.7~1m
    model.setScale(1, 1, 1);
    // glTF 默认朝 -Z;相机在 +Z 看过来 → 转 180° 让脸朝玩家(旋在子节点,不影响父节点眩晕晃动)
    model.setRotationFromEuler(0, 180, 0);
    this.model = model;
    this.anim = model.getComponent(SkeletalAnimation)
      ?? model.getComponentInChildren(SkeletalAnimation);
    this.baseModelScaleX = model.scale.x;
    this.body.enabled = false;
  }

  /** Bootstrap 在 kickStart 时调用；side 与 Animal.side 一致。 */
  playKick(side: -1 | 1): void {
    const model = this.model;
    if (!model?.isValid) return;
    // 镜像打在模型子节点，不影响父节点 stun euler
    const sx = this.baseModelScaleX * (side < 0 ? -1 : 1);
    model.setScale(sx, model.scale.y, model.scale.z);
    this.kickMirrorUntil = C.KICK_CLIP_S;
    const anim = this.anim;
    if (!anim) return;
    // clip 名与 meta 切片一致；缺失时静默（hazard 仍会 knock）
    const name = anim.clips?.some((c) => c?.name === 'Kick') ? 'Kick' : 'Animation';
    try {
      anim.crossFade(name, 0.05);
    } catch {
      // clip 未就绪时忽略
    }
  }

  attach(state: GameState): void {
    this.state = state;
    state.on('grow', () => { this.flash = 1; });
  }

  update(dt: number): void {
    if (this.kickMirrorUntil > 0) {
      this.kickMirrorUntil = Math.max(0, this.kickMirrorUntil - dt);
      if (this.kickMirrorUntil === 0 && this.model?.isValid) {
        const m = this.model;
        m.setScale(this.baseModelScaleX, m.scale.y, m.scale.z);
      }
    }
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

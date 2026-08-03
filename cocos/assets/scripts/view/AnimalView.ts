import {
  _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3,
  utils, primitives, EffectAsset, assetManager, Prefab, instantiate,
} from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { Animal, AnimalHazard, AnimalKind } from '../core/AnimalHazard';
import { animalVisualScale } from '../core/AnimalModelScale';

const { ccclass } = _decorator;

const KINDS: AnimalKind[] = ['bird', 'cat', 'dog', 'rabbit'];

/** glTF 内嵌 Prefab 子资源 UUID —— 编辑器预览比 bundle 路径更稳 */
const KIND_PREFAB_UUID: Record<AnimalKind, string> = {
  bird: 'bc94900e-72ec-4cc0-b9ce-771ba13ca484@7cf02',
  cat: '86f5d152-f91d-4561-a927-919b173c6923@818ee',
  dog: '98b6edc8-815b-45aa-a52d-55ba4753733a@c6a4f',
  rabbit: '3e11b0a2-a32d-4bd3-863b-46fa6602eee3@3daeb',
};

const KIND_COLOR: Record<AnimalKind, Color> = {
  bird: new Color(90, 170, 220),
  cat: new Color(220, 160, 90),
  dog: new Color(180, 120, 70),
  rabbit: new Color(230, 220, 210),
};

interface Slot {
  animalId: number;
  kind: AnimalKind;
  node: Node;
  body: MeshRenderer;
  model: Node | null;
  knockVx: number;
  knockVy: number;
  knockT: number;
}

@ccclass('AnimalView')
export class AnimalView extends Component {
  hazard: AnimalHazard | null = null;
  private effect: EffectAsset | null = null;
  private mesh!: Mesh;
  private mats = new Map<AnimalKind, Material>();
  private prefabs = new Map<AnimalKind, Prefab>();
  private slots = new Map<number, Slot>();

  onLoad(): void {
    // 占位胶囊:半径 0.18/0.12m,柱高 0.35m —— GLB 失败时保留
    this.mesh = utils.createMesh(primitives.capsule(0.18, 0.12, 0.35));
    this.loadModels();
  }

  initMaterials(effect: EffectAsset | null): void {
    this.effect = effect;
    KINDS.forEach((k) => {
      const m = new Material();
      if (effect) m.initialize({ effectAsset: effect });
      else m.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
      m.setProperty('mainColor', KIND_COLOR[k]);
      this.mats.set(k, m);
    });
  }

  bind(hazard: AnimalHazard): void {
    this.hazard = hazard;
    hazard.on('spawn', (a) => this.ensureSlot(a));
    hazard.on('knock', (a) => {
      const s = this.slots.get(a.id);
      if (!s) return;
      s.knockT = 0;
      s.knockVx = a.side * 220;
      s.knockVy = 160;
    });
    hazard.on('despawn', (a) => this.release(a.id));
  }

  private loadModels(): void {
    for (const kind of KINDS) this.loadKind(kind);
  }

  private loadKind(kind: AnimalKind): void {
    assetManager.loadAny({ uuid: KIND_PREFAB_UUID[kind] }, (err, asset) => {
      if (!this.isValid) return;
      if (!err && asset instanceof Prefab) {
        console.log(`[AnimalView] ${kind} loaded via uuid`);
        this.onPrefab(kind, asset);
        return;
      }
      console.warn(`[AnimalView] ${kind} uuid load failed, try models bundle`, err);
      assetManager.loadBundle('models', (e2, bundle) => {
        if (!this.isValid) return;
        if (e2 || !bundle) {
          console.warn(`[AnimalView] models bundle missing — keep ${kind} capsule`, e2);
          return;
        }
        bundle.load(`animals/${kind}`, Prefab, (e3, prefab) => {
          if (!this.isValid) return;
          if (!e3 && prefab) {
            console.log(`[AnimalView] ${kind} loaded via bundle`);
            this.onPrefab(kind, prefab);
            return;
          }
          console.warn(`[AnimalView] ${kind} Prefab missing — keep capsule`, e3);
        });
      });
    });
  }

  private onPrefab(kind: AnimalKind, prefab: Prefab): void {
    this.prefabs.set(kind, prefab);
    this.upgradeSlots(kind);
  }

  private upgradeSlots(kind: AnimalKind): void {
    for (const s of this.slots.values()) {
      if (s.kind === kind) this.applyModel(s);
    }
  }

  private ensureSlot(a: Animal): Slot {
    let s = this.slots.get(a.id);
    if (s) return s;
    const node = new Node(`animal-${a.kind}-${a.id}`);
    this.node.addChild(node);
    const body = node.addComponent(MeshRenderer);
    body.mesh = this.mesh;
    body.setMaterial(this.mats.get(a.kind)!, 0);
    s = {
      animalId: a.id,
      kind: a.kind,
      node,
      body,
      model: null,
      knockVx: 0,
      knockVy: 0,
      knockT: 0,
    };
    this.slots.set(a.id, s);
    this.applyModel(s);
    return s;
  }

  private applyModel(s: Slot): void {
    const prefab = this.prefabs.get(s.kind);
    if (!prefab) return;
    if (s.model?.isValid) s.model.destroy();
    const model = instantiate(prefab);
    s.node.addChild(model);
    model.setScale(1, 1, 1);
    // Quaternius 动物 Prefab 正面已朝 +Z（朝向相机），勿再转 180（否则屁股对玩家）
    model.setRotationFromEuler(0, 0, 0);
    s.model = model;
    s.body.enabled = false;
  }

  private release(id: number): void {
    const s = this.slots.get(id);
    if (!s) return;
    s.node.destroy();
    this.slots.delete(id);
  }

  update(dt: number): void {
    const h = this.hazard;
    if (!h || !this.mats.size) return;
    for (const a of h.animals) {
      if (a.phase === 'gone') continue;
      const s = this.ensureSlot(a);
      if (a.phase === 'knock') {
        s.knockT += dt;
        const x = a.xPx + s.knockVx * s.knockT;
        const y = a.yPx + s.knockVy * s.knockT - 220 * s.knockT * s.knockT;
        s.node.setPosition(px2m(x), px2m(y), 0);
        // 撞飞旋转：胶囊用根节点；GLB 用子模型以免打乱朝向基准
        const spin = s.knockT * a.side * 720;
        if (s.model) s.model.eulerAngles = new Vec3(0, 0, spin);
        else s.node.eulerAngles = new Vec3(0, 0, spin);
        const knockScale = animalVisualScale(a.kind, 1);
        s.node.setScale(knockScale, knockScale, knockScale);
        continue;
      }
      const fade = a.phase === 'fadeIn' ? Math.min(1, a.age / C.ANIMAL_FADE_IN_S) : 1;
      // 有 GLB 时用种类基准 scale；胶囊占位保持 ~1（本身已是米制尺寸）
      const sc = s.model ? animalVisualScale(a.kind, fade) : fade;
      s.node.setScale(sc, sc, sc);
      s.node.setPosition(px2m(a.xPx), px2m(a.yPx), 0);
      s.node.eulerAngles = new Vec3(0, 0, a.side * -12);
    }
  }
}

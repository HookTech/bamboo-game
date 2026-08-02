import {
  _decorator, Component, Node, MeshRenderer, Material, Mesh, Color, Vec3,
  utils, primitives, EffectAsset,
} from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';
import { Animal, AnimalHazard, AnimalKind } from '../core/AnimalHazard';

const { ccclass } = _decorator;

const KIND_COLOR: Record<AnimalKind, Color> = {
  bird: new Color(90, 170, 220),
  cat: new Color(220, 160, 90),
  dog: new Color(180, 120, 70),
  rabbit: new Color(230, 220, 210),
};

interface Slot {
  animalId: number;
  node: Node;
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
  private slots = new Map<number, Slot>();

  onLoad(): void {
    this.mesh = utils.createMesh(primitives.capsule(0.18, 0.12, 0.35));
  }

  initMaterials(effect: EffectAsset | null): void {
    this.effect = effect;
    (Object.keys(KIND_COLOR) as AnimalKind[]).forEach((k) => {
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

  private ensureSlot(a: Animal): Slot {
    let s = this.slots.get(a.id);
    if (s) return s;
    const node = new Node(`animal-${a.kind}-${a.id}`);
    this.node.addChild(node);
    const mr = node.addComponent(MeshRenderer);
    mr.mesh = this.mesh;
    mr.setMaterial(this.mats.get(a.kind)!, 0);
    s = { animalId: a.id, node, knockVx: 0, knockVy: 0, knockT: 0 };
    this.slots.set(a.id, s);
    return s;
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
        s.node.eulerAngles = new Vec3(0, 0, s.knockT * a.side * 720);
        continue;
      }
      const fade = a.phase === 'fadeIn' ? Math.min(1, a.age / C.ANIMAL_FADE_IN_S) : 1;
      s.node.setScale(fade, fade, fade);
      s.node.setPosition(px2m(a.xPx), px2m(a.yPx), 0);
      s.node.eulerAngles = new Vec3(0, 0, a.side * -12);
    }
  }
}

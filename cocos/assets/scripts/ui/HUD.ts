import {
  _decorator, Component, Node, Label, Graphics, Color, Vec3, UITransform, Camera, Layers,
  HorizontalTextAlignment, view,
} from 'cc';
import { GameConfig as C } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { ScoreSystem } from '../core/ScoreSystem';

const { ccclass } = _decorator;

interface FloatLabel { node: Node; label: Label; life: number; }
interface FollowBanter { node: Node; label: Label; }

type Align = 'left' | 'center' | 'right';

@ccclass('HUD')
export class HUD extends Component {
  private lCoins!: Label;
  private lScore!: Label;
  private lHeight!: Label;
  private lBest!: Label;
  private lCombo!: Label;
  private lDizzy!: Label;
  private lTitle!: Label;
  private lOverlay!: Label;
  private lHint!: Label;
  private bar!: Graphics;
  private floats: FloatLabel[] = [];
  private followBanters = new Map<number, FollowBanter>();

  private uiW = C.DESIGN_W;
  private lastUiW = -1;
  private fontScale = 1;

  private makeLabel(
    txt: string,
    size: number,
    x: number,
    y: number,
    color: Color,
    align: Align = 'center',
  ): Label {
    const n = new Node(`lbl_${txt.slice(0, 6)}`);
    n.layer = Layers.Enum.UI_2D;
    this.node.addChild(n);
    const ut = n.addComponent(UITransform);
    const ax = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
    ut.setAnchorPoint(ax, 0.5);
    ut.setContentSize(align === 'center' ? 520 : 300, size + 10);
    const l = n.addComponent(Label);
    l.string = txt;
    l.fontSize = size;
    l.color = color;
    l.horizontalAlign = align === 'left'
      ? HorizontalTextAlignment.LEFT
      : align === 'right'
        ? HorizontalTextAlignment.RIGHT
        : HorizontalTextAlignment.CENTER;
    l.overflow = Label.Overflow.NONE;
    l.enableOutline = true;
    l.outlineColor = new Color(0, 0, 0, 100);
    l.outlineWidth = 2;
    n.setPosition(x, y, 0);
    return l;
  }

  /** 在 Canvas 节点上构建(中心原点)；宽随 FIXED_HEIGHT 可见区变化。 */
  build(): void {
    this.node.layer = Layers.Enum.UI_2D;
    const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ut.setContentSize(C.DESIGN_W, C.DESIGN_H);

    const white = new Color(255, 255, 255, 242);

    // 先按设计宽创建,随后 syncLayout 按可见宽重排+缩字
    this.lCoins = this.makeLabel('金币 0', 22, 0, 268, white, 'left');
    this.lScore = this.makeLabel('分数 0', 22, 0, 238, white, 'left');
    this.lHeight = this.makeLabel('高度 0.0m', 22, 0, 208, white, 'left');
    this.lBest = this.makeLabel('最高 0.0m', 15, 0, 184, new Color(255, 255, 255, 166), 'left');
    this.lCombo = this.makeLabel('', 16, 0, 244, white, 'right');
    this.lDizzy = this.makeLabel('', 20, 0, 244, new Color(255, 120, 120, 230), 'center');
    this.lTitle = this.makeLabel('势如破竹', 44, 0, 48, white, 'center');
    this.lOverlay = this.makeLabel('点屏幕开始 · 点哪边竹往哪边弯', 22, 0, -12, white, 'center');
    this.lHint = this.makeLabel('节奏点按 0.1~0.5秒/次 · 侧点弯竹 · 太急眩晕 · 空格只生长', 14, 0, -278, white, 'center');

    const barNode = new Node('ComboBar');
    barNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(barNode);
    barNode.addComponent(UITransform).setContentSize(C.DESIGN_W, C.DESIGN_H);
    this.bar = barNode.addComponent(Graphics);

    this.syncLayout(true);
  }

  /**
   * 小屏(竖屏 FIXED_HEIGHT 可见宽 < 800)时:边距跟可见半宽,统计字号按比例缩小。
   * fontScale = clamp(uiW / DESIGN_W, 0.55, 1)
   */
  private syncLayout(force = false): void {
    const vs = view.getVisibleSize();
    const w = vs.width > 1 ? vs.width : C.DESIGN_W;
    const h = vs.height > 1 ? vs.height : C.DESIGN_H;
    if (!force && Math.abs(w - this.lastUiW) < 1) return;
    this.lastUiW = w;
    this.uiW = w;
    this.fontScale = Math.max(0.55, Math.min(1, w / C.DESIGN_W));

    const rootUt = this.node.getComponent(UITransform);
    if (rootUt) rootUt.setContentSize(w, h);
    const barUt = this.bar?.node.getComponent(UITransform);
    if (barUt) barUt.setContentSize(w, h);

    const pad = Math.max(12, 24 * this.fontScale);
    const leftX = -w / 2 + pad;
    const rightX = w / 2 - pad;
    const s = this.fontScale;

    this.applyLabel(this.lCoins, leftX, 268, 22 * s, Math.max(160, w * 0.55));
    this.applyLabel(this.lScore, leftX, 238, 22 * s, Math.max(160, w * 0.55));
    this.applyLabel(this.lHeight, leftX, 208, 22 * s, Math.max(160, w * 0.55));
    this.applyLabel(this.lBest, leftX, 184, 15 * s, Math.max(140, w * 0.5));
    this.applyLabel(this.lCombo, rightX, 244, 16 * s, 200);
    this.applyLabel(this.lDizzy, 0, 244, 20 * s, Math.min(520, w * 0.95));
    this.applyLabel(this.lTitle, 0, 48, 44 * s, Math.min(520, w * 0.95));
    this.applyLabel(this.lOverlay, 0, -12, 22 * s, Math.min(520, w * 0.95));
    this.applyLabel(this.lHint, 0, -h / 2 + 22, 14 * s, Math.min(520, w * 0.95));
  }

  private applyLabel(l: Label, x: number, y: number, fontSize: number, width: number): void {
    l.fontSize = Math.round(fontSize);
    l.node.setPosition(x, y, 0);
    const ut = l.node.getComponent(UITransform);
    if (ut) ut.setContentSize(width, fontSize + 10);
  }

  refresh(state: GameState, score: ScoreSystem): void {
    this.syncLayout();
    this.lCoins.string = `金币 ${score.coins}`;
    this.lScore.string = `分数 ${score.score}`;
    this.lHeight.string = `高度 ${(state.heightPx / C.PX_PER_M).toFixed(1)}m`;
    this.lBest.string = `最高 ${score.bestMeters.toFixed(1)}m`;
    this.lCombo.string = state.combo > 0 ? `连击 x${state.combo}` : '';
    if (!state.stunned) {
      this.lDizzy.string = '';
    } else if (state.stunReason === 'animal') {
      this.lDizzy.string = '啊';
    } else {
      this.lDizzy.string = '别卷了，钱赚不完的';
    }

    this.bar.clear();
    if (state.combo > 0) {
      const barW = Math.min(160, this.uiW * 0.35);
      const barX = this.uiW / 2 - 24 * this.fontScale - barW;
      const barY = 262;
      this.bar.fillColor = new Color(0, 0, 0, 76);
      this.bar.roundRect(barX, barY, barW, 14, 7);
      this.bar.fill();
      const hue = ((45 + state.combo * 8) % 360) / 360;
      const barColor = new Color();
      barColor.fromHSV(hue, 0.9, 0.55 + state.combo * 0.008);
      this.bar.fillColor = barColor;
      this.bar.roundRect(barX, barY, barW * (state.combo / C.COMBO_MAX), 14, 7);
      this.bar.fill();
    }
  }

  showOverlay(show: boolean): void {
    this.lTitle.node.active = show;
    this.lOverlay.node.active = show;
  }

  /** 世界坐标浮字(+N),经相机换算到 UI 空间 */
  floatText(txt: string, worldPos: Vec3, cam: Camera): void {
    this.spawnFloat(txt, worldPos, cam, {
      fontSize: Math.round(18 * this.fontScale),
      color: new Color(255, 215, 110),
      life: 1.1,
      width: 200,
    });
  }

  /** 压力台词挂到动物 id,每帧 syncFollowBanter 跟在胶囊旁。 */
  startFollowBanter(id: number, txt: string): void {
    this.endFollowBanter(id);
    const n = new Node(`banter-${id}`);
    n.layer = Layers.Enum.UI_2D;
    this.node.addChild(n);
    n.addComponent(UITransform);
    const label = n.addComponent(Label);
    const fontSize = Math.round(22 * this.fontScale);
    const ut = n.getComponent(UITransform)!;
    ut.setContentSize(Math.min(this.uiW - 40, 480), fontSize + 18);
    label.fontSize = fontSize;
    label.color = new Color(255, 150, 160);
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    label.enableOutline = true;
    label.outlineColor = new Color(0, 0, 0, 160);
    label.outlineWidth = 3;
    label.string = txt;
    n.active = true;
    this.followBanters.set(id, { node: n, label });
  }

  /** 台词贴在胶囊外侧旁(+ side * 偏移)。 */
  syncFollowBanter(id: number, worldPos: Vec3, cam: Camera, side: -1 | 1): void {
    const f = this.followBanters.get(id);
    if (!f || !f.node.isValid) return;
    const uiPos = cam.convertToUINode(worldPos, this.node);
    const pad = 70 * this.fontScale;
    f.node.setPosition(uiPos.x + side * pad, uiPos.y + 28, 0);
    f.node.active = true;
  }

  endFollowBanter(id: number): void {
    const f = this.followBanters.get(id);
    if (!f) return;
    if (f.node.isValid) f.node.destroy();
    this.followBanters.delete(id);
  }

  /** 熊猫挨打浮字「啊」。 */
  ouchText(worldPos: Vec3, cam: Camera): void {
    this.spawnFloat('啊', worldPos, cam, {
      fontSize: Math.round(36 * this.fontScale),
      color: new Color(255, 90, 90),
      life: 1.0,
      width: 120,
    });
  }

  private spawnFloat(
    txt: string,
    worldPos: Vec3,
    cam: Camera,
    opt: { fontSize: number; color: Color; life: number; width: number },
  ): void {
    let f = this.floats.find(fl => fl.life <= 0);
    if (!f) {
      const n = new Node('float');
      n.layer = Layers.Enum.UI_2D;
      this.node.addChild(n);
      n.addComponent(UITransform);
      const label = n.addComponent(Label);
      f = { node: n, label, life: 0 };
      this.floats.push(f);
    }
    const ut = f.node.getComponent(UITransform)!;
    ut.setContentSize(opt.width, opt.fontSize + 16);
    f.label.fontSize = opt.fontSize;
    f.label.color = opt.color;
    f.label.horizontalAlign = HorizontalTextAlignment.CENTER;
    f.label.overflow = Label.Overflow.SHRINK;
    const uiPos = cam.convertToUINode(worldPos, this.node);
    f.node.setPosition(uiPos.x, uiPos.y + 36, 0);
    f.label.string = txt;
    f.node.active = true;
    f.life = opt.life;
  }

  update(dt: number): void {
    for (const f of this.floats) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.node.setPosition(f.node.position.x, f.node.position.y + 40 * dt, 0);
      if (f.life <= 0) f.node.active = false;
    }
  }
}

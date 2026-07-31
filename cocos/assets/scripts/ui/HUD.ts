import {
  _decorator, Component, Node, Label, Graphics, Color, Vec3, UITransform, Camera, Layers,
  HorizontalTextAlignment,
} from 'cc';
import { GameConfig as C } from '../core/GameConfig';
import { GameState } from '../core/GameState';
import { ScoreSystem } from '../core/ScoreSystem';

const { ccclass } = _decorator;

interface FloatLabel { node: Node; label: Label; life: number; }

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
  private bar!: Graphics;
  private floats: FloatLabel[] = [];

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

  /** 在 Canvas 节点上构建(设计分辨率 800×600,中心原点) */
  build(): void {
    this.node.layer = Layers.Enum.UI_2D;
    const ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ut.setContentSize(C.DESIGN_W, C.DESIGN_H);

    const pad = 24;
    const leftX = -C.DESIGN_W / 2 + pad;
    const rightX = C.DESIGN_W / 2 - pad;
    const white = new Color(255, 255, 255, 242);

    this.lCoins = this.makeLabel('金币 0', 22, leftX, 268, white, 'left');
    this.lScore = this.makeLabel('分数 0', 22, leftX, 238, white, 'left');
    this.lHeight = this.makeLabel('高度 0.0m', 22, leftX, 208, white, 'left');
    this.lBest = this.makeLabel('最高 0.0m', 15, leftX, 184, new Color(255, 255, 255, 166), 'left');
    this.lCombo = this.makeLabel('', 16, rightX, 244, white, 'right');
    this.lDizzy = this.makeLabel('', 20, 0, 244, new Color(255, 120, 120, 230), 'center');
    this.lTitle = this.makeLabel('势如破竹', 44, 0, 48, white, 'center');
    this.lOverlay = this.makeLabel('按 空格 / 点按屏幕 开始', 24, 0, -12, white, 'center');
    this.makeLabel('节奏点按 0.1~0.5秒/次 · 太急眩晕 · 太慢断连击', 15, 0, -278, white, 'center');

    const barNode = new Node('ComboBar');
    barNode.layer = Layers.Enum.UI_2D;
    this.node.addChild(barNode);
    barNode.addComponent(UITransform).setContentSize(C.DESIGN_W, C.DESIGN_H);
    this.bar = barNode.addComponent(Graphics);
  }

  refresh(state: GameState, score: ScoreSystem): void {
    this.lCoins.string = `金币 ${score.coins}`;
    this.lScore.string = `分数 ${score.score}`;
    this.lHeight.string = `高度 ${(state.heightPx / C.PX_PER_M).toFixed(1)}m`;
    this.lBest.string = `最高 ${score.bestMeters.toFixed(1)}m`;
    this.lCombo.string = state.combo > 0 ? `连击 x${state.combo}` : '';
    this.lDizzy.string = state.stunned ? '竹子晕了…歇一下' : '';

    this.bar.clear();
    if (state.combo > 0) {
      // 右上角连击条,与右对齐文案同侧
      const barW = 160;
      const barX = C.DESIGN_W / 2 - 24 - barW;
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
    let f = this.floats.find(fl => fl.life <= 0);
    if (!f) {
      const n = new Node('float');
      n.layer = Layers.Enum.UI_2D;
      this.node.addChild(n);
      n.addComponent(UITransform);
      const label = n.addComponent(Label);
      label.fontSize = 18;
      label.color = new Color(255, 215, 110);
      f = { node: n, label, life: 0 };
      this.floats.push(f);
    }
    const uiPos = cam.convertToUINode(worldPos, this.node);
    f.node.setPosition(uiPos);
    f.label.string = txt;
    f.node.active = true;
    f.life = 1.1;
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

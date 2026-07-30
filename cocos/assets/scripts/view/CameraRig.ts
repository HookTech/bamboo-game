import { _decorator, Component, Camera } from 'cc';
import { GameConfig as C, px2m } from '../core/GameConfig';

const { ccclass } = _decorator;

@ccclass('CameraRig')
export class CameraRig extends Component {
  cam: Camera | null = null;
  private camYpx = 0;
  private shakePx = 0;

  get camYPx(): number {
    return this.camYpx;
  }

  /** 眩晕震屏(原型 shake=14px,每秒 -30 衰减,约 0.47s) */
  kick(px: number): void {
    this.shakePx = px;
  }

  /** 相机中心的 world x(竹子左偏 0.08 屏宽) */
  get camX(): number {
    return px2m(C.BAMBOO_X_PX - C.DESIGN_W / 2) + 0.08 * this.visibleWidthPx() / C.PX_PER_M;
  }

  visibleWidthPx(): number {
    const d = C.CAMERA_DISTANCE_M;
    const visibleH = 2 * d * Math.tan((30 / 2) * Math.PI / 180); // ≈12m
    const aspect = this.cam ? this.cam.camera.aspect : C.DESIGN_W / C.DESIGN_H;
    return visibleH * aspect * C.PX_PER_M;
  }

  follow(heightPx: number, dt: number): void {
    const anchor = heightPx - C.DESIGN_H * 0.55;
    this.camYpx = Math.max(0, this.camYpx + (anchor - this.camYpx) * Math.min(1, dt * 4));
    this.shakePx = Math.max(0, this.shakePx - dt * 30);
    const sx = (Math.random() * 2 - 1) * this.shakePx * 0.4;
    const sy = (Math.random() * 2 - 1) * this.shakePx * 0.4;
    // 原型:屏幕中心(300px) ↔ world camY + 220px
    this.node.setPosition(this.camX + px2m(sx), px2m(this.camYpx + 220 + sy), C.CAMERA_DISTANCE_M);
  }
}

import { GameConfig as C } from './GameConfig';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 触屏弯竹冲量 —— 纯逻辑，无渲染依赖。 */
export class BendController {
  offsetPx = 0;

  /** normX ∈ [-1,1]（屏幕中线=0）；超出范围先钳再积分。 */
  impulse(normX: number): void {
    const n = clamp(normX, -1, 1);
    this.offsetPx = clamp(this.offsetPx + n * C.IMPULSE_PX, -C.BEND_MAX_PX, C.BEND_MAX_PX);
  }

  update(dt: number): void {
    if (dt <= 0 || this.offsetPx === 0) return;
    this.offsetPx *= Math.exp(-dt / C.BEND_TAU);
    if (Math.abs(this.offsetPx) < 0.01) this.offsetPx = 0;
  }
}

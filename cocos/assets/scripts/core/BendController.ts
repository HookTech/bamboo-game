import { GameConfig as C } from './GameConfig';
import { bendMaxPx, impulsePx } from './layoutMath';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 触屏弯竹冲量 —— 纯逻辑，无渲染依赖。上限随可见半宽注入。 */
export class BendController {
  offsetPx = 0;
  /** 当前冲量钳制；默认设计半宽 */
  maxPx = bendMaxPx(C.DESIGN_W / 2);
  /** 单次满偏步长 */
  impulseStepPx = impulsePx(C.DESIGN_W / 2);

  /** 每帧用相机可见半宽刷新上限；同时把当前偏移钳进新界。 */
  setHalfW(halfW: number): void {
    this.maxPx = bendMaxPx(halfW);
    this.impulseStepPx = impulsePx(halfW);
    this.offsetPx = clamp(this.offsetPx, -this.maxPx, this.maxPx);
  }

  /** normX ∈ [-1,1]（屏幕中线=0）；超出范围先钳再积分。 */
  impulse(normX: number): void {
    const n = clamp(normX, -1, 1);
    this.offsetPx = clamp(this.offsetPx + n * this.impulseStepPx, -this.maxPx, this.maxPx);
  }

  update(dt: number): void {
    if (dt <= 0 || this.offsetPx === 0) return;
    this.offsetPx *= Math.exp(-dt / C.BEND_TAU);
    if (Math.abs(this.offsetPx) < 0.01) this.offsetPx = 0;
  }
}

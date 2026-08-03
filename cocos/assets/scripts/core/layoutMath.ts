import { GameConfig as C } from './GameConfig';

/** 非法 halfW 回退到设计半宽（与 4:3 visibleWidth/2 对齐）。 */
export function resolveHalfW(halfW: number): number {
  return halfW > 0 ? halfW : C.DESIGN_W / 2;
}

/** 弯竹冲量项钳制 (px) ≈ halfW × BEND_HALF_W_FRAC。 */
export function bendMaxPx(halfW: number): number {
  return resolveHalfW(halfW) * C.BEND_HALF_W_FRAC;
}

/** 单次满偏冲量 (px) ≈ bendMax × IMPULSE_BEND_FRAC。 */
export function impulsePx(halfW: number): number {
  return bendMaxPx(halfW) * C.IMPULSE_BEND_FRAC;
}

/** auto + bend 合成总钳制。 */
export function totalSwayMaxPx(halfW: number): number {
  return bendMaxPx(halfW) + C.SWAY_MAX_PX;
}

/** 金币水平边距：比例缩放，下限 COIN_MARGIN_MIN_PX。 */
export function coinMarginPx(halfW: number): number {
  const h = resolveHalfW(halfW);
  return Math.max(C.COIN_MARGIN_MIN_PX, h * C.COIN_MARGIN_FRAC);
}

/** 金币刷点半宽；窄屏保底 COIN_SPAWN_HALF_MIN_PX。 */
export function coinSpawnHalfW(halfW: number): number {
  const h = resolveHalfW(halfW);
  return Math.max(C.COIN_SPAWN_HALF_MIN_PX, h - coinMarginPx(h));
}

/** 金币反弹半宽（边距减半，略宽于刷点）。 */
export function coinBounceHalfW(halfW: number): number {
  const h = resolveHalfW(halfW);
  return Math.max(coinSpawnHalfW(h), h - coinMarginPx(h) * 0.5);
}

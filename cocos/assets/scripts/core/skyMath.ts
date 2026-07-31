import { GameConfig as C } from './GameConfig';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** 昼夜系数:0 白昼 → 1 星空(200m) */
export function nightK(heightPx: number): number {
  return clamp01(heightPx / (C.PX_PER_M * 200));
}

/**
 * 云不透明度倍率:低空满 → 高空消失。
 * 约 k>0.35 开始明显衰减,k=1 为 0。
 */
export function cloudAlpha(k: number): number {
  return clamp01(1 - (clamp01(k) - 0.35) / 0.65);
}

/**
 * 近景云水平位置是否允许(相机局部 x,单位 m)。
 * 中带宽度约为可视半宽的 35%(即 |x| < halfW*0.35 禁止)。
 * halfW 为相机局部可见半宽(m)。
 */
export function nearCloudAllowedX(x: number, halfW: number): boolean {
  if (halfW <= 1e-6) return false;
  return Math.abs(x) >= halfW * 0.35;
}

const FOV_DEG = 30;

/** 相机局部可见半宽(m)：FOV 垂直 × aspect。 */
export function visibleHalfWidthM(aspect: number): number {
  const a = Math.max(aspect, 1e-6);
  const visibleH = 2 * C.CAMERA_DISTANCE_M * Math.tan((FOV_DEG / 2) * Math.PI / 180);
  return (visibleH * a) / 2;
}

/** 日月相机局部 X(m)，右侧为正。 */
export function sunLocalX(aspect: number): number {
  return visibleHalfWidthM(aspect) * C.SUN_X_FRAC;
}

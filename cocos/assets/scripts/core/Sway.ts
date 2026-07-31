import { GameConfig as C } from './GameConfig';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 竹尖摆动(px)—— 原型公式直译:基础摆动 + 生长拉扯 + 眩晕抖动,钳制 ±44。 */
export function tipSwayPx(tSec: number, heightPx: number, targetHeightPx: number, stunned: boolean): number {
  if (heightPx < 1) return 0;
  const growPull = clamp((targetHeightPx - heightPx) * 0.06, -18, 18);
  const baseAmp = 14 + Math.min(heightPx / 300, 1) * 10;
  const dizzyWob = stunned ? Math.sin(tSec * 22) * 10 : 0;
  return clamp(Math.sin(tSec * 1.6) * baseAmp + growPull + dizzyWob, -C.SWAY_MAX_PX, C.SWAY_MAX_PX);
}

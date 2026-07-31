import { GameConfig as C } from './GameConfig';

export interface JudgeResult {
  stunned: boolean;
  /** 本次按键后的连击数 */
  combo: number;
  /** 本次生长量(px),眩晕为 0 */
  gainPx: number;
}

/** 节奏判定:照搬原型 —— 过急眩晕,过慢断连击重新计,正常连击+1(上限 12)。 */
export function judgePress(gapSec: number, prevCombo: number): JudgeResult {
  if (gapSec < C.MIN_GAP) {
    return { stunned: true, combo: 0, gainPx: 0 };
  }
  const combo = gapSec > C.GOOD_GAP ? 1 : Math.min(prevCombo + 1, C.COMBO_MAX);
  const gainPx = C.BASE_GAIN_PX * (1 + combo * C.COMBO_GAIN_FACTOR);
  return { stunned: false, combo, gainPx };
}

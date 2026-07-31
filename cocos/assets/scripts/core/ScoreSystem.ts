import { GameConfig as C } from './GameConfig';
import { Storage } from '../platform/Storage';

const BEST_KEY = 'bamboo_best'; // 与原型 localStorage key 一致

export class ScoreSystem {
  coins = 0;
  score = 0;
  bestMeters: number;

  constructor(private storage: Storage) {
    const v = parseFloat(this.storage.get(BEST_KEY) ?? '0');
    this.bestMeters = Number.isFinite(v) && v >= 0 ? v : 0;
  }

  /** 拾取一枚金币,返回本次倍率。 */
  pickup(combo: number): number {
    const mult = 1 + Math.floor(combo / C.COIN_MULT_STEP);
    this.coins++;
    this.score += mult;
    return mult;
  }

  /** 高度破纪录时写入,返回是否破了纪录。 */
  updateBest(heightPx: number): boolean {
    const m = heightPx / C.PX_PER_M;
    if (m > this.bestMeters) {
      this.bestMeters = m;
      this.storage.set(BEST_KEY, String(m));
      return true;
    }
    return false;
  }
}

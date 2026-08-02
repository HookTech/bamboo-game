import { GameConfig as C } from './GameConfig';
import { judgePress, JudgeResult } from './RhythmJudge';

export type GameEvent = 'start' | 'grow' | 'stun' | 'comboBreak';
type Handler = () => void;

/** 游戏状态机 —— 唯一事实源。零渲染依赖,view 层订阅事件。 */
export class GameState {
  started = false;
  t = 0;
  heightPx = 0;
  targetHeightPx = 0;
  combo = 0;
  maxCombo = 0;
  stunUntil = 0;
  private lastPressAt = -Infinity;
  private handlers = new Map<GameEvent, Handler[]>();

  on(ev: GameEvent, fn: Handler): void {
    const list = this.handlers.get(ev) ?? [];
    list.push(fn);
    this.handlers.set(ev, list);
  }

  private emit(ev: GameEvent): void {
    for (const fn of this.handlers.get(ev) ?? []) fn();
  }

  get stunned(): boolean {
    return this.t < this.stunUntil;
  }

  /**
   * 按键入口。首次按键 = 开始游戏(返回 null);
   * 眩晕期间按键无效(返回 null);否则返回判定结果。
   */
  press(): JudgeResult | null {
    if (!this.started) {
      this.started = true;
      this.emit('start');
      return null;
    }
    if (this.stunned) return null;
    const gap = this.t - this.lastPressAt;
    this.lastPressAt = this.t;
    const r = judgePress(gap, this.combo);
    if (r.stunned) {
      this.combo = 0;
      this.stunUntil = this.t + C.STUN_DURATION;
      this.emit('stun');
      return r;
    }
    if (gap > C.GOOD_GAP && this.combo > 0) this.emit('comboBreak');
    this.combo = r.combo;
    if (r.combo > this.maxCombo) this.maxCombo = r.combo;
    this.targetHeightPx += r.gainPx;
    this.emit('grow');
    return r;
  }

  /** 外部危害眩晕(动物撞击等):与过急眩晕同效果。 */
  applyExternalStun(): void {
    this.combo = 0;
    this.stunUntil = this.t + C.STUN_DURATION;
    this.emit('stun');
  }

  update(dt: number): void {
    this.t += dt;
    const k = Math.min(1, dt * 3.2); // 原型缓动系数
    this.heightPx += (this.targetHeightPx - this.heightPx) * k;
  }
}

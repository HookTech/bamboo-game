import { judgePress } from '../assets/scripts/core/RhythmJudge';

describe('judgePress', () => {
  it('stuns when gap < 0.12s', () => {
    const r = judgePress(0.11, 5);
    expect(r.stunned).toBe(true);
    expect(r.combo).toBe(0);
    expect(r.gainPx).toBe(0);
  });

  it('does not stun at exactly 0.12s', () => {
    expect(judgePress(0.12, 3).stunned).toBe(false);
  });

  it('increments combo within the good window', () => {
    const r = judgePress(0.3, 4);
    expect(r).toEqual({ stunned: false, combo: 5, gainPx: 26 * (1 + 5 * 0.09) });
  });

  it('caps combo at 12', () => {
    expect(judgePress(0.3, 12).combo).toBe(12);
  });

  it('resets combo to 1 when gap > 0.55s', () => {
    const r = judgePress(0.56, 8);
    expect(r.combo).toBe(1);
    expect(r.stunned).toBe(false);
  });

  it('first-ever press (Infinity gap) starts combo at 1', () => {
    expect(judgePress(Infinity, 0).combo).toBe(1);
  });

  it('gain uses the NEW combo value', () => {
    // combo 1 → 26 * 1.09
    expect(judgePress(0.56, 0).gainPx).toBeCloseTo(26 * 1.09);
  });
});

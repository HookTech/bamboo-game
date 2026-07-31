import { GameState } from '../assets/scripts/core/GameState';

function makeStarted(): GameState {
  const s = new GameState();
  s.press(); // first press = start
  return s;
}

describe('GameState', () => {
  it('first press only starts the game, no growth', () => {
    const s = new GameState();
    let started = 0;
    s.on('start', () => started++);
    expect(s.press()).toBeNull();
    expect(s.started).toBe(true);
    expect(started).toBe(1);
    expect(s.targetHeightPx).toBe(0);
  });

  it('grows with combo on rhythmic presses', () => {
    const s = makeStarted();
    s.update(0.3);
    const r = s.press()!;
    expect(r.combo).toBe(1);
    expect(s.targetHeightPx).toBeCloseTo(26 * 1.09);
    s.update(0.3);
    s.press();
    expect(s.combo).toBe(2);
    expect(s.maxCombo).toBe(2);
  });

  it('stuns on mashing, clears combo, ignores presses while stunned', () => {
    const s = makeStarted();
    s.update(0.3); s.press();
    s.update(0.3); s.press();
    expect(s.combo).toBe(2);
    s.update(0.05); // 0.05s gap < 0.12 → stun
    let stunned = 0;
    s.on('stun', () => stunned++);
    s.press();
    expect(stunned).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.stunned).toBe(true);
    expect(s.press()).toBeNull(); // ignored during stun
    s.update(0.95);
    expect(s.stunned).toBe(false);
  });

  it('breaks combo on slow press and emits comboBreak', () => {
    const s = makeStarted();
    s.update(0.3); s.press(); s.update(0.3); s.press();
    expect(s.combo).toBe(2);
    let broken = 0;
    s.on('comboBreak', () => broken++);
    s.update(0.6);
    const r = s.press()!;
    expect(broken).toBe(1);
    expect(r.combo).toBe(1);
  });

  it('eases height toward target', () => {
    const s = makeStarted();
    s.update(0.3); s.press();
    const target = s.targetHeightPx;
    for (let i = 0; i < 200; i++) s.update(1 / 60);
    expect(s.heightPx).toBeGreaterThan(target * 0.99);
    expect(s.heightPx).toBeLessThanOrEqual(target);
  });

  it('emits grow on every valid press', () => {
    const s = makeStarted();
    let grows = 0;
    s.on('grow', () => grows++);
    s.update(0.3); s.press();
    s.update(0.3); s.press();
    expect(grows).toBe(2);
  });
});

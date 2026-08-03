import { ScoreSystem } from '../assets/scripts/core/ScoreSystem';
import { Storage } from '../assets/scripts/platform/Storage';

function freshStorage(): Storage {
  return new Storage(); // node: 无后端,get → null
}

describe('ScoreSystem', () => {
  it('starts empty with best 0 on blank storage', () => {
    const s = new ScoreSystem(freshStorage());
    expect(s.coins).toBe(0);
    expect(s.score).toBe(0);
    expect(s.bestMeters).toBe(0);
  });

  it('pickup pays 1 + floor(combo/4)', () => {
    const s = new ScoreSystem(freshStorage());
    expect(s.pickup(0)).toBe(1);
    expect(s.pickup(3)).toBe(1);
    expect(s.pickup(4)).toBe(2);
    expect(s.pickup(12)).toBe(4);
    expect(s.coins).toBe(4);
    expect(s.score).toBe(8);
  });

  it('corrupted best falls back to 0', () => {
    jest.spyOn(Storage.prototype, 'get').mockReturnValue('not-a-number');
    expect(new ScoreSystem(freshStorage()).bestMeters).toBe(0);
    jest.restoreAllMocks();
  });

  it('updateBest only writes when beaten', () => {
    const writes: string[] = [];
    jest.spyOn(Storage.prototype, 'set').mockImplementation((_k, v) => { writes.push(v); });
    const s = new ScoreSystem(freshStorage());
    expect(s.updateBest(500)).toBe(true);   // 10m
    expect(s.updateBest(400)).toBe(false);  // 8m 不更新
    expect(s.updateBest(750)).toBe(true);   // 15m
    expect(writes).toEqual(['10', '15']);
    jest.restoreAllMocks();
  });

  it('loseCoins subtracts coins only and clamps at 0', () => {
    const s = new ScoreSystem(freshStorage());
    s.pickup(0);
    s.pickup(0);
    s.pickup(0);
    expect(s.coins).toBe(3);
    expect(s.score).toBe(3);
    expect(s.loseCoins(5)).toBe(3);
    expect(s.coins).toBe(0);
    expect(s.score).toBe(3);
    expect(s.loseCoins(2)).toBe(0);
    expect(s.coins).toBe(0);
  });
});

import { GameConfig, px2m } from '../assets/scripts/core/GameConfig';

describe('GameConfig', () => {
  it('locks spec gameplay values', () => {
    expect(GameConfig.PX_PER_M).toBe(50);
    expect(GameConfig.MIN_GAP).toBeCloseTo(0.12);
    expect(GameConfig.GOOD_GAP).toBeCloseTo(0.55);
    expect(GameConfig.COMBO_MAX).toBe(12);
    expect(GameConfig.STUN_DURATION).toBeCloseTo(0.9);
    expect(GameConfig.BASE_GAIN_PX).toBe(26);
    expect(GameConfig.COMBO_GAIN_FACTOR).toBeCloseTo(0.09);
    expect(GameConfig.COIN_MULT_STEP).toBe(4);
    expect(GameConfig.MAGNET_RADIUS_PX).toBe(95);
    expect(GameConfig.PICKUP_RADIUS_PX).toBe(40);
    expect(GameConfig.SEG_LEN_PX).toBe(46);
    expect(GameConfig.SWAY_MAX_PX).toBe(44);
  });

  it('px2m converts at 50px per meter', () => {
    expect(px2m(50)).toBe(1);
    expect(px2m(46)).toBeCloseTo(0.92);
  });
});

import { tipSwayPx } from '../assets/scripts/core/Sway';

describe('tipSwayPx', () => {
  it('is 0 at t=0 with no growth pull', () => {
    expect(tipSwayPx(0, 500, 500, false)).toBe(0);
  });

  it('is 0 for a near-zero bamboo', () => {
    expect(tipSwayPx(3, 0.5, 0.5, false)).toBe(0);
  });

  it('never exceeds ±44px', () => {
    for (let t = 0; t < 60; t += 0.037) {
      expect(Math.abs(tipSwayPx(t, 2000, 2300, true))).toBeLessThanOrEqual(44);
    }
  });

  it('pulls toward growth while easing (target above height → positive pull)', () => {
    // sin(t*1.6) 在 t=0 为 0,此时只剩 growPull
    expect(tipSwayPx(0, 100, 500, false)).toBeCloseTo(18); // clamp((400)*0.06, -18, 18) = 18
  });

  it('stun adds high-frequency wobble but stays clamped', () => {
    const calm = Math.abs(tipSwayPx(1.7, 300, 300, false));
    const dizzy = Math.abs(tipSwayPx(1.7, 300, 300, true));
    expect(dizzy).toBeLessThanOrEqual(44);
    expect(calm).toBeLessThanOrEqual(44);
  });
});

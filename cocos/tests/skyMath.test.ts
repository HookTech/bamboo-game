import { nightK, cloudAlpha, nearCloudAllowedX } from '../assets/scripts/core/skyMath';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';

describe('skyMath', () => {
  it('nightK is 0 at ground and 1 at 200m', () => {
    expect(nightK(0)).toBe(0);
    expect(nightK(C.PX_PER_M * 200)).toBe(1);
    expect(nightK(C.PX_PER_M * 100)).toBeCloseTo(0.5);
  });

  it('cloudAlpha fades after mid altitude', () => {
    expect(cloudAlpha(0)).toBeCloseTo(1);
    expect(cloudAlpha(0.25)).toBeGreaterThan(0.7);
    expect(cloudAlpha(1)).toBeCloseTo(0);
  });

  it('nearCloudAllowedX rejects center band (~35% width)', () => {
    const halfW = 400;
    expect(nearCloudAllowedX(0, halfW)).toBe(false);
    expect(nearCloudAllowedX(halfW * 0.1, halfW)).toBe(false);
    expect(nearCloudAllowedX(halfW * 0.5, halfW)).toBe(true);
    expect(nearCloudAllowedX(-halfW * 0.5, halfW)).toBe(true);
  });
});

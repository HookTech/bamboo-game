import {
  bendMaxPx,
  coinBounceHalfW,
  coinMarginPx,
  coinSpawnHalfW,
  impulsePx,
  resolveHalfW,
  totalSwayMaxPx,
} from '../assets/scripts/core/layoutMath';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';

describe('layoutMath', () => {
  it('bendMaxPx ≈ halfW (screen edge)', () => {
    expect(bendMaxPx(400)).toBeCloseTo(400);
    expect(bendMaxPx(169)).toBeCloseTo(169);
  });

  it('impulsePx ≈ bendMax × 0.45', () => {
    expect(impulsePx(400)).toBeCloseTo(400 * 0.45, 0);
  });

  it('totalSwayMaxPx = bendMax + SWAY_MAX', () => {
    expect(totalSwayMaxPx(400)).toBeCloseTo(400 + C.SWAY_MAX_PX);
  });

  it('coinMargin scales but stays ≥ min', () => {
    expect(coinMarginPx(400)).toBe(60);
    expect(coinMarginPx(169)).toBeGreaterThanOrEqual(C.COIN_MARGIN_MIN_PX);
  });

  it('coinSpawnHalfW shrinks on portrait but stays ≥ min', () => {
    expect(coinSpawnHalfW(400)).toBe(340);
    const narrow = coinSpawnHalfW(169);
    expect(narrow).toBeGreaterThanOrEqual(C.COIN_SPAWN_HALF_MIN_PX);
    expect(narrow).toBeLessThan(coinSpawnHalfW(400));
  });

  it('coinBounceHalfW is wider than spawn half', () => {
    expect(coinBounceHalfW(400)).toBeGreaterThan(coinSpawnHalfW(400));
  });

  it('resolveHalfW falls back to DESIGN_W/2', () => {
    expect(resolveHalfW(0)).toBe(C.DESIGN_W / 2);
    expect(resolveHalfW(-1)).toBe(C.DESIGN_W / 2);
    expect(resolveHalfW(200)).toBe(200);
  });
});

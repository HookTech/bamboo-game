import { BendController } from '../assets/scripts/core/BendController';
import { GameConfig as C } from '../assets/scripts/core/GameConfig';
import { bendMaxPx, impulsePx } from '../assets/scripts/core/layoutMath';

describe('BendController', () => {
  it('impulse pushes toward normX and clamps to design ±BEND_MAX_PX', () => {
    const b = new BendController();
    b.impulse(1);
    expect(b.offsetPx).toBeCloseTo(C.IMPULSE_PX);
    b.impulse(1);
    b.impulse(1);
    expect(b.offsetPx).toBeCloseTo(C.BEND_MAX_PX);
    b.impulse(-1);
    expect(b.offsetPx).toBeCloseTo(C.BEND_MAX_PX - C.IMPULSE_PX);
  });

  it('opposite impulses cancel toward the other side', () => {
    const b = new BendController();
    b.impulse(1);
    b.impulse(-1);
    expect(b.offsetPx).toBeCloseTo(0);
  });

  it('update decays toward 0', () => {
    const b = new BendController();
    b.impulse(1);
    const before = b.offsetPx;
    b.update(C.BEND_TAU);
    expect(Math.abs(b.offsetPx)).toBeLessThan(Math.abs(before));
    expect(b.offsetPx).toBeCloseTo(before * Math.exp(-1));
    for (let i = 0; i < 40; i++) b.update(0.2);
    expect(Math.abs(b.offsetPx)).toBeLessThan(0.01);
  });

  it('clamps normX into [-1, 1]', () => {
    const b = new BendController();
    b.impulse(3);
    expect(b.offsetPx).toBeCloseTo(C.IMPULSE_PX);
    b.impulse(-10);
    expect(b.offsetPx).toBeCloseTo(0);
  });

  it('setHalfW refreshes limits and reclamps offset', () => {
    const b = new BendController();
    b.setHalfW(400);
    expect(b.maxPx).toBeCloseTo(bendMaxPx(400));
    expect(b.impulseStepPx).toBeCloseTo(impulsePx(400));
    // push to max then shrink viewport
    b.impulse(1);
    b.impulse(1);
    b.impulse(1);
    expect(b.offsetPx).toBeCloseTo(bendMaxPx(400));
    b.setHalfW(169);
    expect(b.maxPx).toBeCloseTo(bendMaxPx(169));
    expect(Math.abs(b.offsetPx)).toBeLessThanOrEqual(b.maxPx + 1e-6);
  });
});

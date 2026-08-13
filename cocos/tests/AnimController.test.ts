import { AnimController } from '../assets/scripts/character/AnimController';

describe('AnimController', () => {
  it('defaults to climbIdle base', () => {
    const c = new AnimController();
    expect(c.base).toBe('climbIdle');
    expect(c.overlay).toBeNull();
  });

  it('stun switches base; clearStun returns climbIdle', () => {
    const c = new AnimController();
    c.setStunned(true);
    expect(c.base).toBe('stunned');
    c.setStunned(false);
    expect(c.base).toBe('climbIdle');
  });

  it('kick overlay respects duration and side', () => {
    const c = new AnimController();
    c.playOverlay('kick', { duration: 0.4, side: -1, priority: 10 });
    expect(c.overlay?.id).toBe('kick');
    expect(c.overlay?.side).toBe(-1);
    c.update(0.4);
    expect(c.overlay).toBeNull();
  });

  it('higher priority interrupts lower overlay', () => {
    const c = new AnimController();
    c.playOverlay('pressBounce', { duration: 0.25, priority: 1 });
    c.playOverlay('kick', { duration: 0.4, side: 1, priority: 10 });
    expect(c.overlay?.id).toBe('kick');
  });

  it('lower priority does not interrupt', () => {
    const c = new AnimController();
    c.playOverlay('kick', { duration: 0.4, side: 1, priority: 10 });
    c.playOverlay('pressBounce', { duration: 0.25, priority: 1 });
    expect(c.overlay?.id).toBe('kick');
  });
});

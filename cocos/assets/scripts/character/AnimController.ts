import type { BaseAnim, OverlayAnimId, OverlayPlayOpts, OverlayState } from './AnimTypes';

/** 纯逻辑分层动作；无 cc 依赖。 */
export class AnimController {
  base: BaseAnim = 'climbIdle';
  overlay: OverlayState | null = null;

  setStunned(on: boolean): void {
    this.base = on ? 'stunned' : 'climbIdle';
  }

  playOverlay(id: OverlayAnimId, opts: OverlayPlayOpts): void {
    const next: OverlayState = {
      id,
      age: 0,
      duration: opts.duration,
      priority: opts.priority,
      side: opts.side ?? 1,
    };
    if (this.overlay && next.priority < this.overlay.priority) return;
    this.overlay = next;
  }

  update(dt: number): void {
    if (!this.overlay) return;
    this.overlay.age += dt;
    if (this.overlay.age >= this.overlay.duration) this.overlay = null;
  }
}

export type BaseAnim = 'climbIdle' | 'stunned';
export type OverlayAnimId = 'kick' | 'pressBounce' | 'idle' | 'press';

export interface OverlayPlayOpts {
  duration: number;
  priority: number;
  side?: -1 | 1;
}

export interface OverlayState {
  id: OverlayAnimId;
  age: number;
  duration: number;
  priority: number;
  side: -1 | 1;
}

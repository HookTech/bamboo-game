import { GameConfig } from './GameConfig';
import type { RuntimeConfigShape } from './mergeRuntimeConfig';

let current: RuntimeConfigShape = { ...GameConfig };

export function setRuntimeConfig(next: RuntimeConfigShape): void {
  current = { ...next };
}

export function getRuntimeConfig(): Readonly<RuntimeConfigShape> {
  return { ...current };
}

/** 测试用：恢复默认 */
export function resetRuntimeConfig(): void {
  current = { ...GameConfig };
}

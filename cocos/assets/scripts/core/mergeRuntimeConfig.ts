import { GameConfig } from './GameConfig';
import type { ThemeableConfig } from '../content/ScenePack';

export type RuntimeConfigShape = typeof GameConfig;

export function mergeRuntimeConfig(
  base: typeof GameConfig,
  packConfig?: Partial<ThemeableConfig>,
): RuntimeConfigShape {
  if (!packConfig) return { ...base };
  return { ...base, ...packConfig } as RuntimeConfigShape;
}

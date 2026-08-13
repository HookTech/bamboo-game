import type { SceneId, ScenePack } from '../content/ScenePack';
import { getPack } from '../content/registry';

/** 启动固定场景；改此常量验证 work/cny */
export const ACTIVE_SCENE_ID: SceneId = 'default';

export function resolveScenePack(id: SceneId = ACTIVE_SCENE_ID): ScenePack {
  const pack = getPack(id);
  if (pack) return pack;
  console.warn(`[ActiveScene] unknown scene id=${id}, fallback default`);
  return getPack('default')!;
}

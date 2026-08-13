import type { SceneId, ScenePack } from './ScenePack';
import { defaultPack } from './packs/defaultPack';
import { workPack } from './packs/workPack';
import { cnyPack } from './packs/cnyPack';

const PACKS: Record<SceneId, ScenePack> = {
  default: defaultPack,
  work: workPack,
  cny: cnyPack,
};

export function getPack(id: SceneId): ScenePack | undefined {
  return PACKS[id];
}

export function allPackIds(): SceneId[] {
  return Object.keys(PACKS) as SceneId[];
}

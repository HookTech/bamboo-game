import type { AnimalKind } from './AnimalHazard';

/**
 * Quaternius GLB 在 Cocos 导入后，Armature/网格节点已带 ×100（cm→m）。
 * 根节点再缩放时必须基于「实例化后」高度，否则会再放大约 100 倍。
 */
export const ANIMAL_PREFAB_UNIT_SCALE = 100;

/** glTF mesh 包围盒高度（导入前局部单位，米）。 */
export const ANIMAL_RAW_HEIGHT_M: Record<AnimalKind, number> = {
  bird: 0.00635,
  cat: 0.01724,
  dog: 0.02098,
  rabbit: 0.01357,
};

/** 实例化 Prefab 后的约略高度 = raw × unitScale。 */
export const ANIMAL_PREFAB_HEIGHT_M: Record<AnimalKind, number> = {
  bird: ANIMAL_RAW_HEIGHT_M.bird * ANIMAL_PREFAB_UNIT_SCALE,
  cat: ANIMAL_RAW_HEIGHT_M.cat * ANIMAL_PREFAB_UNIT_SCALE,
  dog: ANIMAL_RAW_HEIGHT_M.dog * ANIMAL_PREFAB_UNIT_SCALE,
  rabbit: ANIMAL_RAW_HEIGHT_M.rabbit * ANIMAL_PREFAB_UNIT_SCALE,
};

/**
 * 目标视觉高度（米）：略小于熊猫 ~0.7–1m，贴近原胶囊 ~0.65m。
 * bird 最小，dog 最大。
 */
export const ANIMAL_TARGET_HEIGHT_M: Record<AnimalKind, number> = {
  bird: 0.45,
  cat: 0.55,
  dog: 0.60,
  rabbit: 0.50,
};

/** 挂到 AnimalView 根节点的缩放 = target / prefabHeight（约 0.3~0.7）。 */
export const ANIMAL_MODEL_SCALE: Record<AnimalKind, number> = {
  bird: round2(ANIMAL_TARGET_HEIGHT_M.bird / ANIMAL_PREFAB_HEIGHT_M.bird),
  cat: round2(ANIMAL_TARGET_HEIGHT_M.cat / ANIMAL_PREFAB_HEIGHT_M.cat),
  dog: round2(ANIMAL_TARGET_HEIGHT_M.dog / ANIMAL_PREFAB_HEIGHT_M.dog),
  rabbit: round2(ANIMAL_TARGET_HEIGHT_M.rabbit / ANIMAL_PREFAB_HEIGHT_M.rabbit),
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** fade ∈ [0,1]，渐现时乘在种类基准 scale 上。 */
export function animalVisualScale(kind: AnimalKind, fade: number): number {
  return ANIMAL_MODEL_SCALE[kind] * Math.max(0, Math.min(1, fade));
}

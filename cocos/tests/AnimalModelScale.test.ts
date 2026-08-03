import {
  ANIMAL_MODEL_SCALE,
  ANIMAL_PREFAB_HEIGHT_M,
  ANIMAL_PREFAB_UNIT_SCALE,
  ANIMAL_TARGET_HEIGHT_M,
  animalVisualScale,
} from '../assets/scripts/core/AnimalModelScale';

describe('AnimalModelScale', () => {
  it('accounts for Prefab armature ×100 so root scale stays below 1', () => {
    expect(ANIMAL_PREFAB_UNIT_SCALE).toBe(100);
    for (const kind of ['bird', 'cat', 'dog', 'rabbit'] as const) {
      expect(ANIMAL_MODEL_SCALE[kind]).toBeGreaterThan(0);
      expect(ANIMAL_MODEL_SCALE[kind]).toBeLessThan(1);
    }
  });

  it('animalVisualScale multiplies base by fade', () => {
    expect(animalVisualScale('cat', 0)).toBe(0);
    expect(animalVisualScale('cat', 1)).toBe(ANIMAL_MODEL_SCALE.cat);
    expect(animalVisualScale('bird', 0.5)).toBeCloseTo(ANIMAL_MODEL_SCALE.bird * 0.5);
  });

  it('keeps bird target height below dog', () => {
    expect(ANIMAL_TARGET_HEIGHT_M.bird).toBeLessThan(ANIMAL_TARGET_HEIGHT_M.dog);
  });

  it('scale ≈ target / prefab height', () => {
    for (const kind of ['bird', 'cat', 'dog', 'rabbit'] as const) {
      const expected = ANIMAL_TARGET_HEIGHT_M[kind] / ANIMAL_PREFAB_HEIGHT_M[kind];
      expect(ANIMAL_MODEL_SCALE[kind]).toBeCloseTo(expected, 1);
    }
  });
});

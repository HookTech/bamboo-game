import { GameConfig } from '../assets/scripts/core/GameConfig';
import { mergeRuntimeConfig } from '../assets/scripts/core/mergeRuntimeConfig';

describe('mergeRuntimeConfig', () => {
  it('returns GameConfig when pack config empty', () => {
    const r = mergeRuntimeConfig(GameConfig, undefined);
    expect(r.ANIMAL_COIN_LOSS).toBe(GameConfig.ANIMAL_COIN_LOSS);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
  });

  it('overrides themeable animal fields only', () => {
    const r = mergeRuntimeConfig(GameConfig, { ANIMAL_COIN_LOSS: 9 });
    expect(r.ANIMAL_COIN_LOSS).toBe(9);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
  });
});

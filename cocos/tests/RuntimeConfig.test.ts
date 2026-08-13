import { GameConfig } from '../assets/scripts/core/GameConfig';
import { mergeRuntimeConfig } from '../assets/scripts/core/mergeRuntimeConfig';
import {
  getRuntimeConfig,
  resetRuntimeConfig,
  setRuntimeConfig,
} from '../assets/scripts/core/RuntimeConfig';

describe('RuntimeConfig', () => {
  afterEach(() => {
    resetRuntimeConfig();
  });

  it('initial get matches GameConfig defaults', () => {
    const r = getRuntimeConfig();
    expect(r.ANIMAL_COIN_LOSS).toBe(GameConfig.ANIMAL_COIN_LOSS);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
    expect(r.PX_PER_M).toBe(GameConfig.PX_PER_M);
  });

  it('set + get round-trip', () => {
    const merged = mergeRuntimeConfig(GameConfig, { ANIMAL_COIN_LOSS: 9 });
    setRuntimeConfig(merged);
    const r = getRuntimeConfig();
    expect(r.ANIMAL_COIN_LOSS).toBe(9);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
  });

  it('reset restores defaults', () => {
    setRuntimeConfig(mergeRuntimeConfig(GameConfig, { ANIMAL_COIN_LOSS: 9 }));
    resetRuntimeConfig();
    const r = getRuntimeConfig();
    expect(r.ANIMAL_COIN_LOSS).toBe(GameConfig.ANIMAL_COIN_LOSS);
    expect(r.MIN_GAP).toBe(GameConfig.MIN_GAP);
  });

  it('mutating a returned get() does not affect subsequent get()', () => {
    const first = getRuntimeConfig();
    (first as { ANIMAL_COIN_LOSS: number }).ANIMAL_COIN_LOSS = 999;
    const second = getRuntimeConfig();
    expect(second.ANIMAL_COIN_LOSS).toBe(GameConfig.ANIMAL_COIN_LOSS);
  });
});

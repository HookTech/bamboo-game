import { ANIMAL_TAUNTS, pickAnimalTaunt } from '../assets/scripts/core/AnimalTaunts';

describe('AnimalTaunts', () => {
  it('pool is non-empty', () => {
    expect(ANIMAL_TAUNTS.length).toBeGreaterThan(5);
  });

  it('pickAnimalTaunt is deterministic with fixed rng', () => {
    expect(pickAnimalTaunt(() => 0)).toBe(ANIMAL_TAUNTS[0]);
    expect(pickAnimalTaunt(() => 0.999)).toBe(ANIMAL_TAUNTS[ANIMAL_TAUNTS.length - 1]);
  });
});

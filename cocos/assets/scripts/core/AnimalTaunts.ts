/** rng ∈ [0,1)，从台词池均匀抽取一条。 */
export function pickFromPool(
  pool: readonly string[],
  rng: () => number = Math.random,
): string {
  if (pool.length === 0) return '';
  const i = Math.floor(rng() * pool.length);
  return pool[Math.min(Math.max(0, i), pool.length - 1)]!;
}

/** @deprecated 兼容旧名：需传入 pool */
export function pickAnimalTaunt(
  pool: readonly string[],
  rng: () => number = Math.random,
): string {
  return pickFromPool(pool, rng);
}

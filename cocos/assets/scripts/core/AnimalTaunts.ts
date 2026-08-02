/** 动物撞击时弹出的现代压力台词 —— 纯数据,可单测。 */
export const ANIMAL_TAUNTS: readonly string[] = [
  '你怎么还没有结婚啊？',
  '你工资多少啊？',
  '房子首付准备好了吗？',
  '同学都升职了你呢？',
  '加班是福报懂不懂？',
  '你这学历够用吗？',
  '三十岁了还租房啊？',
  '有车有房吗？',
  '你怎么还不生孩子？',
  '别人家的孩子都怎样了',
  '存款五位数了吗？',
  '周末也要卷起来啊！',
  '绩效打几分啊？',
  '头发怎么又少了？',
  '再不努力就晚了哦～',
];

/** rng ∈ [0,1)，从台词池均匀抽取一条。 */
export function pickAnimalTaunt(rng: () => number = Math.random): string {
  const i = Math.floor(rng() * ANIMAL_TAUNTS.length);
  return ANIMAL_TAUNTS[Math.min(Math.max(0, i), ANIMAL_TAUNTS.length - 1)]!;
}

import type { ScenePack } from '../ScenePack';
import { defaultPack } from './defaultPack';

export const cnyPack: ScenePack = {
  ...defaultPack,
  id: 'cny',
  displayName: '过年场景',
  animals: {
    ...defaultPack.animals,
    taunts: ['红包发了吗？', '今年带对象回家没？', '亲戚问完一轮了吗？'],
  },
  audio: {
    profile: 'cny',
  },
  copy: {
    title: '势如破竹·过年',
    overlay: '点屏幕开始 · 过年也要势如破竹',
    hint: '节奏点按 · 侧点弯竹 · 太急眩晕',
    stunMash: defaultPack.copy.stunMash,
    stunAnimal: defaultPack.copy.stunAnimal,
  },
};

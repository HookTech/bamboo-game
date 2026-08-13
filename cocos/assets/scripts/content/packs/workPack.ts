import type { ScenePack } from '../ScenePack';
import { defaultPack } from './defaultPack';

export const workPack: ScenePack = {
  ...defaultPack,
  id: 'work',
  displayName: '工作场景',
  animals: {
    ...defaultPack.animals,
    taunts: ['KPI 完成了吗？', '又在摸鱼是吧？', '九点开会你来不来？'],
  },
  audio: {
    profile: 'work',
  },
  copy: {
    title: '势如破竹·上班',
    overlay: '点屏幕开始 · 别卷了先喘口气',
    hint: '节奏点按 · 侧点弯竹 · 太急眩晕',
    stunMash: defaultPack.copy.stunMash,
    stunAnimal: defaultPack.copy.stunAnimal,
  },
};

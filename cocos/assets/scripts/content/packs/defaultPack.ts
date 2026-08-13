import type { ScenePack } from '../ScenePack';

export const defaultPack: ScenePack = {
  id: 'default',
  displayName: '日常',
  sky: {
    cloudPrefabUuid: '823761ca-f1ce-4191-aa8c-04ede3535433@cde1c',
    cloudBundleKey: 'sky/cloud',
  },
  ground: {
    treePrefabUuid: '5d39d5d5-0cd9-4c57-be37-b943946e6492@f7340',
    grassPrefabUuid: '37d1b96d-7347-4bb7-9ba5-7ad22b2baca4@0a8bf',
    treeBundleKey: 'tree_a',
    grassBundleKey: 'grass_a',
  },
  animals: {
    kinds: ['bird', 'cat', 'dog', 'rabbit'],
    taunts: [
      // 催婚催生 / 家庭
      '你怎么还没有结婚啊？',
      '是不是不想结婚了？',
      '对象介绍给你一个啊？',
      '你怎么还不生孩子？',
      '别人家孩子都二胎了',
      '再拖就没人要了哦',
      '彩礼准备多少了？',
      // 房子车子钱
      '房子首付准备好了吗？',
      '三十岁了还租房啊？',
      '有车有房吗？',
      '月供压力大不大？',
      '存款六位数了吗？',
      '你工资多少啊？',
      '年终奖发了没有？',
      // 职场内卷
      '加班是福报懂不懂？',
      '周末也要卷起来啊！',
      '同学都升职了你呢？',
      '绩效打几分啊？',
      '你这学历够用吗？',
      '准备考研还是考公？',
      '35 岁危机想过没？',
      'KPI 完成了吗？',
      '又在摸鱼是吧？',
      '九点开会你来不来？',
      // 身体 / 焦虑鸡汤反讽
      '头发怎么又少了？',
      '黑眼圈挺重啊',
      '再不努力就晚了哦～',
      '同龄人都怎样怎样了',
      '你这抗压能力不行啊',
      '年轻人就是要奋斗',
      '躺平可没有未来',
      '情绪价值谁给你？',
      // 生活成本
      '奶茶都不敢喝了吧？',
      '外卖点了没？省着点',
      '医保公积金交齐了吗？',
      '社保断缴过吗？',
    ],
    prefabUuid: {
      bird: 'bc94900e-72ec-4cc0-b9ce-771ba13ca484@7cf02',
      cat: '86f5d152-f91d-4561-a927-919b173c6923@818ee',
      dog: '98b6edc8-815b-45aa-a52d-55ba4753733a@c6a4f',
      rabbit: '3e11b0a2-a32d-4bd3-863b-46fa6602eee3@3daeb',
    },
    bundleKey: {
      bird: 'animals/bird',
      cat: 'animals/cat',
      dog: 'animals/dog',
      rabbit: 'animals/rabbit',
    },
  },
  audio: {
    profile: 'default',
  },
  copy: {
    title: '势如破竹',
    overlay: '点屏幕开始 · 点哪边竹往哪边弯',
    hint: '节奏点按 0.1~0.5秒/次 · 侧点弯竹 · 太急眩晕 · 空格只生长',
    stunMash: '别卷了，钱赚不完的',
    stunAnimal: '啊',
  },
};

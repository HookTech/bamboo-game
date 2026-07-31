/** 全部玩法数值 —— 照搬原型(game.js),改动须同步更新 spec。 */
export const GameConfig = {
  PX_PER_M: 50,
  DESIGN_W: 800,
  DESIGN_H: 600,
  GROUND_PAD_PX: 80,

  /** 竹子水平位置(屏幕坐标,原型 BAMBOO_X = 0.42 * 800) */
  BAMBOO_X_PX: 336,
  SEG_LEN_PX: 46,
  CHAR_OFFSET_PX: 26,

  MIN_GAP: 0.12,
  GOOD_GAP: 0.55,
  COMBO_MAX: 12,
  STUN_DURATION: 0.9,
  BASE_GAIN_PX: 26,
  COMBO_GAIN_FACTOR: 0.09,

  COIN_MULT_STEP: 4,
  MAGNET_RADIUS_PX: 95,
  PICKUP_RADIUS_PX: 40,
  COIN_SPAWN_INTERVAL: 0.7,
  COIN_MAX_ALIVE: 30,

  SWAY_MAX_PX: 44,

  /** 单次满偏点按冲量 (px)；实际增量 = normX * IMPULSE_PX */
  IMPULSE_PX: 90,
  /** 冲量项钳制 (px) */
  BEND_MAX_PX: 140,
  /** 冲量指数衰减时间常数 (s) */
  BEND_TAU: 0.35,
  /** auto + bend 合成后尖端总钳制 (px) */
  TOTAL_SWAY_MAX_PX: 160,

  /** 相机与竹面距离:fov30 垂直 → 可视高 12m ↔ 600px @50px/m */
  CAMERA_DISTANCE_M: 22.4,

  /** 日月相对可见半宽的水平比例(右侧为正) */
  SUN_X_FRAC: 0.58,
  SUN_LOCAL_Y: 5.5,
  SUN_LOCAL_Z: -37,
} as const;

export const px2m = (px: number): number => px / GameConfig.PX_PER_M;

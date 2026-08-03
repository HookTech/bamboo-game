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

  /** 弯竹上限相对可见半宽的比例（1.0 ≈ 贴左右屏边） */
  BEND_HALF_W_FRAC: 1,
  /** 单次满偏冲量相对 bendMax 的比例 */
  IMPULSE_BEND_FRAC: 0.45,
  /** 冲量指数衰减时间常数 (s) */
  BEND_TAU: 0.35,

  /** 金币边距相对半宽；下限见 COIN_MARGIN_MIN_PX */
  COIN_MARGIN_FRAC: 0.15,
  COIN_MARGIN_MIN_PX: 24,
  /** 窄屏刷点半宽保底 */
  COIN_SPAWN_HALF_MIN_PX: 40,

  /** 设计半宽(400)下的参考值；运行时用 layoutMath.*(visibleWidth/2) */
  IMPULSE_PX: 180,
  BEND_MAX_PX: 400,
  TOTAL_SWAY_MAX_PX: 444,

  /** 相机与竹面距离:fov30 垂直 → 可视高 12m ↔ 600px @50px/m */
  CAMERA_DISTANCE_M: 22.4,

  /** 日月相对可见半宽的水平比例(右侧为正) */
  SUN_X_FRAC: 0.58,
  SUN_LOCAL_Y: 5.5,
  SUN_LOCAL_Z: -37,

  /** —— 空中动物危害 —— */
  ANIMAL_TIER1_COINS: 20,
  ANIMAL_TIER2_COINS: 50,
  ANIMAL_TIER3_COINS: 100,
  ANIMAL_SPAWN_GAP_T1_MIN: 8,
  ANIMAL_SPAWN_GAP_T1_MAX: 12,
  ANIMAL_SPAWN_GAP_T2_MIN: 6,
  ANIMAL_SPAWN_GAP_T2_MAX: 9,
  ANIMAL_SPAWN_GAP_T3_MIN: 5,
  ANIMAL_SPAWN_GAP_T3_MAX: 8,
  ANIMAL_MAX_ALIVE_T1_T2: 1,
  ANIMAL_MAX_ALIVE_T3: 2,
  ANIMAL_FADE_IN_S: 0.6,
  ANIMAL_SPAWN_HEIGHT_PX: 160,
  /** 出生点相对熊猫的水平对角偏置(斜左右角) */
  ANIMAL_SPAWN_DIAG_X_PX: 240,
  ANIMAL_SIDE_OFFSET_PX: 55,
  ANIMAL_DIVE_SPEED_PX: 90,
  ANIMAL_HIT_RADIUS_PX: 72,
  ANIMAL_KNOCK_RADIUS_PX: 70,
  ANIMAL_KNOCK_BEND_MIN_PX: 50,
  ANIMAL_COIN_LOSS: 5,
  ANIMAL_POST_HIT_COOLDOWN_S: 3,
  ANIMAL_KNOCK_DESPAWN_S: 0.8,
} as const;

export const px2m = (px: number): number => px / GameConfig.PX_PER_M;

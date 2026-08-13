export type SceneId = 'default' | 'work' | 'cny';

/** 本轮 Pack 可覆盖字段白名单（与 spec 一致） */
export type ThemeableConfig = {
  ANIMAL_TIER1_COINS: number;
  ANIMAL_TIER2_COINS: number;
  ANIMAL_TIER3_COINS: number;
  ANIMAL_SPAWN_GAP_T1_MIN: number;
  ANIMAL_SPAWN_GAP_T1_MAX: number;
  ANIMAL_SPAWN_GAP_T2_MIN: number;
  ANIMAL_SPAWN_GAP_T2_MAX: number;
  ANIMAL_SPAWN_GAP_T3_MIN: number;
  ANIMAL_SPAWN_GAP_T3_MAX: number;
  ANIMAL_MAX_ALIVE_T1_T2: number;
  ANIMAL_MAX_ALIVE_T3: number;
  ANIMAL_FADE_IN_S: number;
  ANIMAL_SPAWN_HEIGHT_PX: number;
  ANIMAL_SPAWN_DIAG_X_PX: number;
  ANIMAL_SIDE_OFFSET_PX: number;
  ANIMAL_DIVE_SPEED_PX: number;
  ANIMAL_HIT_RADIUS_PX: number;
  ANIMAL_KNOCK_RADIUS_PX: number;
  ANIMAL_KNOCK_BEND_MIN_PX: number;
  ANIMAL_COIN_LOSS: number;
  ANIMAL_POST_HIT_COOLDOWN_S: number;
  ANIMAL_KNOCK_DESPAWN_S: number;
  KICK_CONTACT_S: number;
  KICK_CLIP_S: number;
};

export type SkyTheme = {
  cloudPrefabUuid: string;
  cloudBundleKey: string;
};

export type GroundTheme = {
  treePrefabUuid: string;
  grassPrefabUuid: string;
  treeBundleKey: string;
  grassBundleKey: string;
};

export type AnimalTheme = {
  kinds: Array<'bird' | 'cat' | 'dog' | 'rabbit'>;
  taunts: readonly string[];
  prefabUuid: Record<'bird' | 'cat' | 'dog' | 'rabbit', string>;
  bundleKey: Record<'bird' | 'cat' | 'dog' | 'rabbit', string>;
};

export type AudioTheme = {
  /** 占位：本轮仍走程序化 AudioFx，仅留扩展点 */
  profile: 'default' | 'work' | 'cny';
};

export type CopyTheme = {
  title: string;
  overlay: string;
  hint: string;
  stunMash: string;
  stunAnimal: string;
};

export interface ScenePack {
  id: SceneId;
  displayName: string;
  config?: Partial<ThemeableConfig>;
  sky: SkyTheme;
  ground: GroundTheme;
  animals: AnimalTheme;
  audio: AudioTheme;
  copy: CopyTheme;
}

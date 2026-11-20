// Browser-safe & Headless-safe pure constants (NO node:* imports allowed!)

export const CONTRACT_VERSION = '1.3';

export const TUNING = {
  player_speed: 6.0,
  carry_capacity: 10,
  capacity_max: 20,
  lantern_cost: 10,
  relight_cost: 5,
  lantern_count_night1: 5,
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  win_ratio: 0.6,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 240,
  night2_duration_s: 270,
  night3_duration_s: 300,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  score: {
    per_mote: 5,
    per_lantern: 100,
    per_relight: 40,
    per_stun: 5,
    per_second_left: 0,
    per_flame_left: 50
  }
};

export const PHYSICS = {
  TICK_RATE: 60,
  DT: 1 / 60,
  JUMP_VEL: 7.0,
  GRAVITY: -20.0,
  DASH_TICKS: 12,
  DASH_CD_TICKS: 90,
  PULSE_CD_TICKS: 180,
  PULSE_STUN_TICKS: 120,
  PULSE_PUSH_TICKS: 15,
  INVULN_TICKS: 90,
  SAFE_PUSH_TICKS: 30,
  FUEL_MAX_UNITS: 6000, // 100 fuel * 60 ticks
  FUEL_LOW_UNITS: 1800, // 30 fuel * 60 ticks
  FUEL_MOTE_UNITS: 600, // 10 fuel * 60 ticks
  FUEL_DECAY_UNITS: 1,  // 1/60 per tick
  FUEL_DRAIN_UNITS: 5,  // 5/60 per tick
  SHADE_SPAWN_TICKS: 30,
  SHADE_DETECT_R: 12.0,
  SHADE_DRAIN_DETECT_R: 6.0,
  SHADE_DRAIN_R: 2.0,
  SHADE_LOSE_R: 18.0,
  SHADE_WANDER_SPEED: 2.0,
  SHADE_RECOIL_M: 2.0,
  SHADE_RECOIL_TICKS: 60,
  MOTE_SPAWN_INTERVAL_TICKS: 240,
  MOTE_START_COUNT: 20,
  MOTE_CAP: 30,
  MOTE_DROP_TTL_TICKS: 480,
  FALL_Y: -10.0,
  RESPAWN_WAIT_TICKS: 60,
  CHARM_SPEED: 7.2,
  CHARM_DURATION_TICKS: 600,
  CHARM_RESPAWN_TICKS: 2700,
  DRIFTER_SPAWN_INTERVAL_TICKS: 1200,
  DRIFTER_MAX_ACTIVE: 2,
  DRIFTER_IDLE_SPEED: 2.0,
  DRIFTER_SPEED: 7.0,
  DRIFTER_DETECT_R: 15.0,
  DRIFTER_STEAL_R: 1.2,
  DRIFTER_STEAL_MAX: 3,
  DRIFTER_FLEE_TICKS: 240,
  DRIFTER_DROP_FLEE_TICKS: 120,
  WIND_PERIOD_TICKS: 1800,
  WIND_WARN_TICKS: 120,
  WIND_DURATION_TICKS: 300,
  WIND_SPEED: 2.0
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255
  ];
}

export const PALETTE = {
  skyHex: '#0E1430',
  fogHex: '#1B2350',
  grassHex: '#2F5D50',
  sandHex: '#C9B48A',
  woodHex: '#6B4A2F',
  cloudSeaHex: '#12384A',
  lanternLitHex: '#FFB347',
  lanternCoreHex: '#FFE9B0',
  lanternOffHex: '#5B5F6E',
  moteCoreHex: '#FFF6C2',
  moteHaloHex: '#FFE58A',
  shadeBodyHex: '#120A1A',
  shadeRimHex: '#7A3CFF',
  shadeRimColorblindHex: '#00B3FF',
  shadeStunHex: '#3A3450',
  mayRobeHex: '#E8E2D0',
  mayScarfHex: '#C8102E',
  goldUiHex: '#F2C14E',
  drifterHex: '#8FA3B8',
  dangerHex: '#FF5A5F',
  dangerColorblindHex: '#FFFFFF',
  uiTextHex: '#F5F1E6',

  sky: hexToRgb('#0E1430'),
  fog: hexToRgb('#1B2350'),
  grass: hexToRgb('#2F5D50'),
  sand: hexToRgb('#C9B48A'),
  wood: hexToRgb('#6B4A2F'),
  cloudSea: hexToRgb('#12384A'),
  lanternLit: hexToRgb('#FFB347'),
  lanternCore: hexToRgb('#FFE9B0'),
  lanternOff: hexToRgb('#5B5F6E'),
  moteCore: hexToRgb('#FFF6C2'),
  moteHalo: hexToRgb('#FFE58A'),
  shadeBody: hexToRgb('#120A1A'),
  shadeRim: hexToRgb('#7A3CFF'),
  shadeRimColorblind: hexToRgb('#00B3FF'),
  shadeStun: hexToRgb('#3A3450'),
  mayRobe: hexToRgb('#E8E2D0'),
  mayScarf: hexToRgb('#C8102E'),
  goldUi: hexToRgb('#F2C14E'),
  drifter: hexToRgb('#8FA3B8'),
  danger: hexToRgb('#FF5A5F'),
  dangerColorblind: hexToRgb('#FFFFFF')
};

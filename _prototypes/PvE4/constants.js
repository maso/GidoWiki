const AREA        = 10;    // play area ±10 world units
const MOVE_Z_MAX  = 8.5;   // lower movement boundary — just above the fire line (DAMAGE_Z=9)

const DAMAGE_Z    = 9;     // world Z of the fire / danger line
const BODY_RADIUS = 0.52;  // matches SphereGeometry radius in character.js
const FIRE_DAMAGE = 10;    // HP subtracted per fire-zone hit
const SPD              = 0.12;  // movement: world-units per frame at 60 fps (≈ 7.2 wu/s)
const DASH_INIT_SPD    = 0.48;  // dash starting speed (world-units per frame at 60 fps)
const DASH_END_SPD     = 0.06;     // dash ending speed; decays from DASH_INIT_SPD to this over DASH_DUR
const DEADZONE         = 0.12;
const SCROLL_SPEED     = 0.015; // world units per frame at 60 fps (1 grid cell = 1 m)
const BOUNCE_DURATION  = 0.75;  // seconds — only change this to adjust bounce length
const DASH_DUR         = 0.35;   // seconds dash movement lasts; speed DASH_INIT_SPD → DASH_END_SPD over duration
const DASH_COOLDOWN    = 1.0;   // seconds before dash can be used again
const DASH_JUMP_FRAC   = 0.6;   // fraction of DASH_DUR over which the jump arc plays
const DASH_ASCENT_FRAC = 0.3;   // fraction of jump arc spent ascending (rest is descent)

const ATTACK_LIGHT_DAMAGE = 10;   // HP removed per light punch hit
const ATTACK_HEAVY_DAMAGE = 30;   // HP removed per heavy punch hit

const ATTACK_DUR         = 0.2;   // light punch total duration (s)
const ATTACK_EXTEND_FRAC = 0.10;  // fraction of ATTACK_DUR for arm-extend phase
const ATTACK_COOLDOWN    = 0.10;  // seconds before next attack is allowed
const ATTACK_CANCEL_FRAC = 0.50;  // after this fraction of ATTACK_DUR, next attack input is accepted

const ATTACK_HEAVY_DUR          = 0.50;  // heavy punch total duration (s) — longer for wind-up + slow retract
const ATTACK_HEAVY_WINDUP_FRAC  = 0.28;  // 0→28%: both arms pull back (longer wind-up)
const ATTACK_HEAVY_EXTEND_FRAC  = 0.38;  // 28%→38%: both arms thrust forward (fast push, 10%)
const ATTACK_HEAVY_LUNGE_SPD    = 18;    // world-units/s forward lunge during extend phase
const COMBO_MAX          = 3;     // maximum punches in one combo chain
const COMBO_RESET_SEC    = 0.65;  // seconds of inactivity before combo count resets
const INVINCIBLE_SEC   = 1.0;  // seconds of invincibility + flash after a hit

const DEATH_JUMP_DUR     = 0.3;  // s of jump-up phase (easeOutQuad ascent)
const DEATH_JUMP_PEAK    = 2.8;  // world units of peak height
const DEATH_FLOAT_DUR    = 0.6;  // s of floating + accelerating flash phase
const RESPAWN_INVINCIBLE = 2.0;  // s of invincibility + opacity flash after landing

const HP_MAX = 50;

const BUILDING_HP_PER_UNIT = 10;  // HP per 1×1×1 volume unit
const BUILDING_FLASH_DUR   = 0.12;  // seconds of white flash on hit
const BUILDING_SHAKE_DUR = 0.25;  // seconds of shake after hit

// ── Fusion animation constants ─────────────────────────────────────────
const FUSION_PULL_DUR  = 0.3;   // seconds to pull both players to midpoint
const FUSION_FLASH_DUR = 0.2;   // seconds of white/yellow rapid flash before merge
const FUSION_BALL_DUR    = 8.0;   // seconds the fused ball stays on field
const FUSION_DISPERSE_DUR = 0.3;  // seconds for players to fly apart after dissolution
const FUSION_LIFE_WARN   = 3.0;   // seconds remaining when life bar starts flashing

// Shared easing functions (used by game.js bounce animation and bubble.js fall)
function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1/d1)     return n1 * t * t;
  if (t < 2/d1)     return n1 * (t -= 1.5/d1)  * t + 0.75;
  if (t < 2.5/d1)   return n1 * (t -= 2.25/d1) * t + 0.9375;
  return n1 * (t -= 2.625/d1) * t + 0.984375;
}

const COLOR_HEX = [
  0x6ec6e6, // 0 淺藍
  0xf08cad, // 1 粉紅
  0x7dd87d, // 2 淺綠
  0x2a4fa8, // 3 深藍
  0x1e7d3a, // 4 深綠
  0xd93025, // 5 紅
  0x7b6fa0, // 6 灰紫
  0xb0b8bc, // 7 灰白
  0x4a4e52, // 8 深灰
];

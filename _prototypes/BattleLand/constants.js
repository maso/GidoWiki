const AREA        = 10;    // play area ±10 world units
const MOVE_X_MAX  =  AREA - 0.5;  //  9.5 — right movement boundary
const MOVE_X_MIN  = -AREA + 0.5;  // −9.5 — left movement boundary
const MOVE_Z_MIN  = -AREA + 0.5;  // −9.5 — upper movement boundary
const MOVE_Z_MAX  =  7.5;          //  7.5 — lower movement boundary

const BODY_RADIUS = 0.52;  // matches SphereGeometry radius in character.js
const SPD              = 0.12;  // movement: world-units per frame at 60 fps (≈ 7.2 wu/s)
const DASH_INIT_SPD    = 0.48;  // dash starting speed (world-units per frame at 60 fps)
const DASH_END_SPD     = 0.06;     // dash ending speed; decays from DASH_INIT_SPD to this over DASH_DUR
const DEADZONE         = 0.12;
const BOUNCE_DURATION  = 0.75;  // seconds — only change this to adjust bounce length
const DASH_DUR         = 0.35;   // seconds dash movement lasts; speed DASH_INIT_SPD → DASH_END_SPD over duration
const DASH_COOLDOWN    = 1.0;   // seconds before dash can be used again
const DASH_JUMP_FRAC   = 0.6;   // fraction of DASH_DUR over which the jump arc plays
const DASH_ASCENT_FRAC = 0.3;   // fraction of jump arc spent ascending (rest is descent)

const ATTACK_LIGHT_BLDG = 5;    // light punch damage vs buildings
const ATTACK_HEAVY_BLDG = 15;   // heavy punch damage vs buildings
const ATTACK_LIGHT_PLAYER = 5;  // light punch damage vs players
const ATTACK_HEAVY_PLAYER = 15; // heavy punch damage vs players

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
const INVINCIBLE_SEC   = 0.2;  // seconds of invincibility + flash after a hit

const attackFreezeTimer  = 0.1;  // s of freeze on attacker when a hit lands (non-kill)
const BLAST_FLY_DUR      = 0.8;  // seconds the blasted character flies away before disappearing
const DEATH_JUMP_DUR     = 0;    // 0 = skip jump phase
const DEATH_JUMP_PEAK    = 2.8;  // world units of peak height
const DEATH_FLOAT_DUR    = 0.3;  // s of flash before explosion
const RESPAWN_INVINCIBLE = 1.0;  // s of invincibility + opacity flash after landing

const HP_MAX = 50;

const BUILDING_HP_PER_UNIT = 10;  // HP per 1×1×1 volume unit
const TEAM_A_BLDG_COLOR = 0x70c0e0; // light blue
const TEAM_B_BLDG_COLOR = 0xf08898; // light red
const BUILDING_FLASH_DUR   = 0.12;  // seconds of white flash on hit
const BUILDING_SHAKE_DUR = 0.25;  // seconds of shake after hit

// ── Fusion animation constants ─────────────────────────────────────────
const FUSION_PULL_DUR  = 0.3;   // seconds to pull both players to midpoint
const FUSION_FLASH_DUR = 0.2;   // seconds of white/yellow rapid flash before merge
const FUSION_BALL_DUR    = 8.0;   // seconds the fused ball stays on field
const FUSION_DISPERSE_DUR = 0.3;  // seconds for players to fly apart after dissolution
const FUSION_LIFE_WARN   = 3.0;   // seconds remaining when life bar starts flashing

// Shared easing functions (used by game.js bounce animation and bubble.js fall)
function easeOutElastic(t) {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutBounce(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1/d1)     return n1 * t * t;
  if (t < 2/d1)     return n1 * (t -= 1.5/d1)  * t + 0.75;
  if (t < 2.5/d1)   return n1 * (t -= 2.25/d1) * t + 0.9375;
  return n1 * (t -= 2.625/d1) * t + 0.984375;
}


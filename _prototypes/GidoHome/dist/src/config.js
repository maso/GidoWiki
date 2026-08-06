/* ═══════════════════════════════════════
   GAME CONFIGURATION & PARAMETERS
═══════════════════════════════════════ */

// speed              = idle-animation tempo (breathing bob / arm sway / body sway)
// breathAmp          = idle breathing bob amplitude (vertical body movement); default 0.045
// moveSpeedMin/Max    = roaming walk speed range, in world units/sec (picked fresh each walk;
//                       set min === max for a fixed pace, or a spread for erratic pacing)
export const CHARACTER_DEFS = [
  { id: 'pewpew', name: 'Pewpew', bodyCol: 0x4fd9bd, accentCol: 0x32b89d, x: -2.5, z:  0.7, lblId: 'lbl-avery',   speed: 1.6, phase: 0.0, eyeStyle: 'wandering', pupilSize: 0.060, moveSpeedMin: 0.9, moveSpeedMax: 2.4 },
  { id: 'tanku',  name: 'Tanku',  bodyCol: 0xff8599, accentCol: 0xee6e83, x: -0.6, z: -0.4, lblId: 'lbl-xiaocai', speed: 2.3, phase: 1.1, eyeStyle: 'normal',    pupilSize: 0.095, moveSpeedMin: 1.4, moveSpeedMax: 1.4 },
  { id: 'slobu',  name: 'Slobu',  bodyCol: 0xc48dff, accentCol: 0x9f5fe8, x:  1.4, z: -0.2, lblId: 'lbl-mina',    speed: 0.7, phase: 2.2, eyeStyle: 'sleepy',    pupilSize: 0.072, moveSpeedMin: 0.8, moveSpeedMax: 0.8 },
  { id: 'rolzo',  name: 'Rolzo',  bodyCol: 0xff912d, accentCol: 0xee7f20, x:  3.0, z:  0.8, lblId: 'lbl-jerry',   speed: 4.2, phase: 3.3, eyeStyle: 'angry',     pupilSize: 0.075, moveSpeedMin: 2.2, moveSpeedMax: 2.2, breathAmp: 0.026 },
  { id: 'raddog', name: 'Raddog', bodyCol: 0xe8d6a8, accentCol: 0xb6604f, x: -1.2, z: -4.2, lblId: 'lbl-raddog', characterType: 'egg', locked: true, unlockText: '完成30次巨獸對決以解鎖 Raddog', unlockProgress: 43, speed: 1, phase: 0.7, eggSpots: [
    { x: -0.25, y: 0.42, size: 0.13, scaleX: 1.2, scaleY: 0.72, rotation: -0.25 },
    { x:  0.17, y: 0.73, size: 0.14, scaleX: 0.78, scaleY: 1.08, rotation: 0.38 },
    { x: -0.08, y: 1.03, size: 0.09, scaleX: 1.05, scaleY: 0.72, rotation: 0.18 },
    { x:  0.27, y: 0.28, size: 0.075, scaleX: 0.8, scaleY: 0.8, rotation: 0 },
  ] },
  { id: 'bomato', name: 'Bomato', bodyCol: 0xe78879, accentCol: 0x5f8f72, x:  1.7, z: -4.3, lblId: 'lbl-bomato', characterType: 'egg', locked: true, unlockText: '在巨獸對決累積擊倒50次以解鎖 Bomato', unlockProgress: 26, speed: 1, phase: 2.1, eggSpots: [
    { x:  0.24, y: 0.46, size: 0.15, scaleX: 1.18, scaleY: 0.65, rotation: -0.18 },
    { x: -0.21, y: 0.78, size: 0.11, scaleX: 0.72, scaleY: 1.2, rotation: 0.44 },
    { x:  0.05, y: 1.02, size: 0.115, scaleX: 1.12, scaleY: 0.7, rotation: -0.34 },
  ] },
];

export const ANIMATION_CONFIG = {
  fallDuration: 0.38, // 380ms snappy hit jump, flail, land, and spring-up sequence
  blinkDuration: 0.14,
  inputCooldown: 180  // ms between gamepad/keyboard repeat
};

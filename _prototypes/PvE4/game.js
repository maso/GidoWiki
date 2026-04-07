// ── Game state ─────────────────────────────────────────────────────────
let gameStarted      = false;
let gamePaused       = false;
let chosenDuration   = 100;  // player-selected game duration (seconds)
let timeRemaining    = chosenDuration;
const GRACE_PERIOD   = 3;    // seconds of invulnerability at game start
let graceRemaining   = 0;    // counts down from GRACE_PERIOD after start

// ── Cached DOM references ──────────────────────────────────────────────
const _timerEl    = document.getElementById('timer-display');
const _debugBoxEl = document.getElementById('debug-box');
const _duoLeftEl  = document.getElementById('duo-left');
const _duoRightEl = document.getElementById('duo-right');
const _ultraBarEl = document.getElementById('ultra-bar');
const _duoBarEls  = ['1p','2p','3p','4p'].map(id => document.getElementById('duo-bar-' + id));

// ── Players ────────────────────────────────────────────────────────────
// z=7 → near bottom of screen; facing Math.PI → faces "up" (away from camera)
const PLAYER_INIT = [
  { x: -6, z: 7, colorIdx: 0, label: '1P' },
  { x: -2, z: 7, colorIdx: 8, label: '2P' },
  { x:  2, z: 7, colorIdx: 2, label: '3P' },
  { x:  6, z: 7, colorIdx: 1, label: '4P' },
];

const players = PLAYER_INIT.map(def => {
  const { group, bodyMats, footMat, armL, armR, footL, footR } = createCharacter(COLOR_HEX[def.colorIdx], def.label);
  group.position.set(def.x, 0, def.z);
  scene.add(group);
  return {
    group, bodyMats, footMat, armL, armR, footL, footR,
    x: def.x, z: def.z,
    colorIdx: def.colorIdx,
    facing: Math.PI,
    moving: false,
    t: Math.random() * Math.PI * 2,
    bounceTimer:    0,              // > 0 = currently bouncing (player locked)
    bounceDuration: BOUNCE_DURATION, // set alongside bounceTimer, read in animation
    knockbackX:     0,              // total knockback displacement on X
    knockbackZ:     0,              // total knockback displacement on Z
    active:           true,          // false for players who didn't join this round
    hp:               HP_MAX,        // current hit points (source of truth; hpbar.js reads this)
    isDead:           false,         // true while in death/bubble/fall sequence
    inBubble:         false,        // true while inside respawn bubble (or falling from it)
    deathCount:       0,            // cumulative deaths — drives escalating respawn time
    deathTimer:       0,            // time elapsed since death judgment
    deathStartFacing: 0,            // rotation.y captured at moment of death
    deathFlashTimer:  0,            // countdown to next flash toggle
    deathFlashing:    false,        // current flash state during death float
    // ── Dash ───────────────────────────────────────────────────────────
    isDashing:   false,             // true while dash is active
    dashTimer:   0,                 // seconds remaining in current dash
    dashCooldown: 0,                // seconds until dash is available again
    dashDirX:    0,                 // locked X direction at dash start
    dashDirZ:    0,                 // locked Z direction at dash start
    // ── Combat (used by attack.js) ─────────────────────────────────────
    isAttacking:      false,         // true during active attack hitbox window
    attackTimer:      0,            // countdown for current attack active + recovery
    attackCooldown:   0,            // remaining cooldown before next attack
    attackArm:        0,            // 0 = left, 1 = right (light punch only)
    isHeavyPunch:     false,        // true when this is the COMBO_MAX'th punch
    punchPeakSpawned: false,        // true once peak-position trail burst has fired
    comboCount:         0,          // which punch in the combo sequence (0-indexed)
    comboTimer:       0,            // resets comboCount when it expires
    // ── Fusion ─────────────────────────────────────────────────────────
    fusedWith:    null,             // TODO(beast-control): index of fused partner during beast phase
    fusionTimer:  0,                // TODO(beast-control): life timer for the beast phase
    // ── Fusion animation (pre-fusion pull + flash) ──────────────────────
    fusingWith:    null,            // player index being pulled toward, or null
    fusingPhase:   null,            // 'pulling' | 'flash' | null
    fusingTimer:   0,               // elapsed seconds in current phase
    fusingStartX:  0,
    fusingStartZ:  0,
    fusingTargetX: 0,
    fusingTargetZ: 0,
  };
});

function setColor(pi, dir) {
  const p = players[pi];
  p.colorIdx = (p.colorIdx + dir + COLOR_HEX.length) % COLOR_HEX.length;
  const hex = COLOR_HEX[p.colorIdx];
  const col = new THREE.Color(hex);
  p.bodyMats.forEach(m => m.color.set(col));
  p.footMat.color.set(footColorFrom(hex));
  // Keep flash-restore cache in sync so damage flash restores the new colour
  _origColors[pi] = p.bodyMats.map(m => m.color.clone());
}

// ── Player animation ───────────────────────────────────────────────────
// Runs every frame regardless of gameStarted / gamePaused state so characters
// always animate smoothly behind overlays.
function updatePlayerAnimations(dt, elapsedMs) {
  players.forEach((p, pi) => {
    if (gameStarted && !p.active) return;
    p.t += 0.05 * dt;
    
    // ── Death animation ────────────────────────────────────────────────
    if (p.isDead && !p.inBubble) {
      const dt_sec     = elapsedMs / 1000;
      p.deathTimer    += dt_sec;
      const EXPLODE_AT = DEATH_JUMP_DUR + DEATH_FLOAT_DUR;
      
      // Character is frozen in world space (ignores map scroll)
      p.group.position.x = p.x;
      p.group.position.z = p.z;
      
      // Shared struggle shake (used in both jump and float phases)
      const shakeA = Math.sin(p.deathTimer * Math.PI * 2 * 8);
      const shakeB = Math.sin(p.deathTimer * Math.PI * 2 * 7 + 1.2);
      p.armL.position.y  = 0.82 + shakeA * 0.14;
      p.armR.position.y  = 0.82 - shakeA * 0.14;
      p.armL.position.z  = 0.08 + shakeB * 0.18;
      p.armR.position.z  = 0.08 - shakeB * 0.18;
      p.footL.position.y = 0.15 + Math.abs(shakeB) * 0.16;
      p.footR.position.y = 0.15 + Math.abs(shakeA) * 0.16;
      p.footL.position.z = 0.04 + shakeA * 0.12;
      p.footR.position.z = 0.04 - shakeA * 0.12;
      
      const DEATH_TILT_X = -0.4; // radians — tilts face upward toward camera
      
      if (p.deathTimer < DEATH_JUMP_DUR) {
        const tUp  = p.deathTimer / DEATH_JUMP_DUR;
        const ease = 1 - (1 - tUp) * (1 - tUp);
        p.group.position.y = ease * DEATH_JUMP_PEAK;
        p.group.rotation.y = p.deathStartFacing * (1 - ease);
        p.group.rotation.x = DEATH_TILT_X * ease;
      } else if (p.deathTimer < EXPLODE_AT) {
        p.group.position.y = DEATH_JUMP_PEAK;
        p.group.rotation.y = 0;
        p.group.rotation.x = DEATH_TILT_X;
        
        const floatProg     = (p.deathTimer - DEATH_JUMP_DUR) / DEATH_FLOAT_DUR;
        const flashInterval = 0.22 - floatProg * 0.19;
        p.deathFlashTimer -= dt_sec;
        if (p.deathFlashTimer <= 0) {
          p.deathFlashing   = !p.deathFlashing;
          setFlash(pi, p.deathFlashing);
          p.deathFlashTimer = flashInterval;
        }
      }
      
      if (p.group.visible && p.deathTimer >= EXPLODE_AT) {
        setFlash(pi, false);
        triggerDeathExplosion(pi);
        p.group.visible = false;
      }
      
      // bubble.js takes over once it detects deathTimer >= BUBBLE_SPAWN_DELAY
      return;
    }
    
    // ── Idle inside bubble (position managed by bubble.js) ────────────
    if (p.isDead && p.inBubble) {
      p.group.rotation.set(0, 0, 0);
      p.armL.position.z += (0.08 - p.armL.position.z) * 0.12;
      p.armR.position.z += (0.08 - p.armR.position.z) * 0.12;
      p.armL.position.y += (0.46 - p.armL.position.y) * 0.12;
      p.armR.position.y += (0.46 - p.armR.position.y) * 0.12;
      p.footL.position.z += (0.04 - p.footL.position.z) * 0.12;
      p.footR.position.z += (0.04 - p.footR.position.z) * 0.12;
      p.footL.position.y += (0.15 - p.footL.position.y) * 0.12;
      p.footR.position.y += (0.15 - p.footR.position.y) * 0.12;
      return;
    }
    
    p.group.position.x = p.x;
    p.group.position.z = p.z;
    p.group.rotation.y = p.facing;
    
    // ── Bounce / knockback animation ───────────────────────────────────
    if (p.bounceTimer > 0) {
      p.group.rotation.x += (0 - p.group.rotation.x) * 0.2;
      p.bounceTimer -= elapsedMs / 1000;
      if (p.bounceTimer < 0) {
        p.bounceTimer = 0;
        // commit final knockback position
        p.x = clamp(p.x + p.knockbackX, -AREA, AREA);
        p.z = clamp(p.z + p.knockbackZ, -AREA, MOVE_Z_MAX);
        p.knockbackX = 0;
        p.knockbackZ = 0;
      }
      
      // progress 0→1 over bounceDuration
      const prog = 1 - (p.bounceTimer / p.bounceDuration);
      let height;
      if (prog < 1/3) {
        // ascent: easeOutQuad (0→1 over first 1/3)
        const t = prog * 3;
        const easeUp = 1 - (1 - t) * (1 - t);
        height = easeUp * 1.6;
      } else {
        // descent: easeOutBounce (0→1 over last 2/3), height goes 1→0
        const t = (prog - 1/3) / (2/3);
        height = (1 - easeOutBounce(t)) * 1.6;
      }
      p.group.position.y = height;
      
      // Knockback displacement (easeOutQuad over full bounce duration)
      const kbEase = 1 - (1 - prog) * (1 - prog);
      p.group.position.x = p.x + p.knockbackX * kbEase;
      p.group.position.z = p.z + p.knockbackZ * kbEase;
      
      // Reset arm scale in case an attack was interrupted
      p.armL.scale.setScalar(1);
      p.armR.scale.setScalar(1);
      // limbs hang loose during bounce (lerp to rest)
      p.armL.position.x += (-0.60 - p.armL.position.x) * 0.18;
      p.armR.position.x += ( 0.60 - p.armR.position.x) * 0.18;
      p.armL.position.z += (0.08 - p.armL.position.z) * 0.18;
      p.armR.position.z += (0.08 - p.armR.position.z) * 0.18;
      p.footL.position.z += (0.04 - p.footL.position.z) * 0.18;
      p.footR.position.z += (0.04 - p.footR.position.z) * 0.18;
      p.footL.position.y += (0.15 - p.footL.position.y) * 0.18;
      p.footR.position.y += (0.15 - p.footR.position.y) * 0.18;
      
    } else if (p.isDashing) {
      // Reset arm scale in case an attack was interrupted
      p.armL.scale.setScalar(1);
      p.armR.scale.setScalar(1);
      const dashProg = 1 - Math.max(0, p.dashTimer / DASH_DUR); // 0→1
      const jumpProg = Math.min(1, dashProg / DASH_JUMP_FRAC);  // 0→1 over first DASH_JUMP_FRAC of dash
      
      if (jumpProg < 1) {
        // ── Phase 1: flying-tackle pose ──────────────────────────────
        const lk = 0.35;
        const jp = jumpProg < DASH_ASCENT_FRAC
        ? 1 - (1 - jumpProg / DASH_ASCENT_FRAC) * (1 - jumpProg / DASH_ASCENT_FRAC)
        : 1 - ((jumpProg - DASH_ASCENT_FRAC) / (1 - DASH_ASCENT_FRAC)) * ((jumpProg - DASH_ASCENT_FRAC) / (1 - DASH_ASCENT_FRAC));
        p.group.position.y += (jp * 1.5 - p.group.position.y) * lk;
        p.group.rotation.x += (0.85 - p.group.rotation.x) * lk;
        p.armL.position.x += (-0.28 - p.armL.position.x) * lk;
        p.armR.position.x += ( 0.28 - p.armR.position.x) * lk;
        p.armL.position.z += (0.50 - p.armL.position.z) * lk;
        p.armR.position.z += (0.50 - p.armR.position.z) * lk;
        p.armL.position.y += (0.75 - p.armL.position.y) * lk;
        p.armR.position.y += (0.75 - p.armR.position.y) * lk;
        p.footL.position.z += (-0.48 - p.footL.position.z) * lk;
        p.footR.position.z += (-0.48 - p.footR.position.z) * lk;
        p.footL.position.y += (0.62 - p.footL.position.y) * lk;
        p.footR.position.y += (0.62 - p.footR.position.y) * lk;
      } else {
        // ── Phase 2: crouching landing pose ──────────────────────────
        const lk = 0.30;
        p.group.position.y += (0.0 - p.group.position.y) * lk;
        p.group.rotation.x += (0.20 - p.group.rotation.x) * lk;
        // arms pulled in low beside body
        p.armL.position.x += (-0.45 - p.armL.position.x) * lk;
        p.armR.position.x += ( 0.45 - p.armR.position.x) * lk;
        p.armL.position.z += (0.22 - p.armL.position.z) * lk;
        p.armR.position.z += (0.22 - p.armR.position.z) * lk;
        p.armL.position.y += (0.28 - p.armL.position.y) * lk;
        p.armR.position.y += (0.28 - p.armR.position.y) * lk;
        // feet flat and close to ground
        p.footL.position.z += (0.14 - p.footL.position.z) * lk;
        p.footR.position.z += (0.14 - p.footR.position.z) * lk;
        p.footL.position.y += (0.04 - p.footL.position.y) * lk;
        p.footR.position.y += (0.04 - p.footR.position.y) * lk;
      }
      
    } else if (p.isAttacking) {
      const dur  = p.isHeavyPunch ? ATTACK_HEAVY_DUR : ATTACK_DUR;
      const prog = 1 - p.attackTimer / dur;  // 0→1
      
      if (p.isHeavyPunch) {
        // ── Heavy punch: wind-up → double thrust → retract ────────────
        const wEnd = ATTACK_HEAVY_WINDUP_FRAC;
        const eEnd = ATTACK_HEAVY_EXTEND_FRAC;
        
        // fwdExt: 0 during windup, 0→1 during push, 1→0 during retract
        const fwdExt = prog < wEnd ? 0
        : prog < eEnd ? (prog - wEnd) / (eEnd - wEnd)
        : 1 - (prog - eEnd) / (1 - eEnd);
        // backExt: 0→1 during windup, 1→0 during push, 0 during retract
        const backExt = prog < wEnd ? prog / wEnd
        : prog < eEnd ? 1 - (prog - wEnd) / (eEnd - wEnd)
        : 0;
        
        const armScale = 1 + fwdExt * 2;
        const armZ     = 0.08 + fwdExt * 0.88 - backExt * 0.50;
        const armX     = 0.60 - fwdExt * 0.30;  // declared here so trail code can use it
        
        // Trail during push phase (every frame) + forced burst at peak
        if (prog >= wEnd && prog < eEnd) {
          for (const sign of [-1, 1]) {
            addPunchTrail(
              p.x + sign * armX * Math.cos(p.facing) + armZ * Math.sin(p.facing),
              p.group.position.y + 0.46,
              p.z - sign * armX * Math.sin(p.facing) + armZ * Math.cos(p.facing),
              armScale
            );
          }
        }
        if (!p.punchPeakSpawned && prog >= eEnd) {
          p.punchPeakSpawned = true;
          const peakX = 0.30;  // armX at fwdExt=1
          const peakZ = 0.96;
          const wy = p.group.position.y + 0.46;
          const hitSet = new Set(); // shared across both fists — each building hit only once
          let heavyHit = false;
          for (const sign of [-1, 1]) {
            const wx = p.x + sign * peakX * Math.cos(p.facing) + peakZ * Math.sin(p.facing);
            const wz = p.z - sign * peakX * Math.sin(p.facing) + peakZ * Math.cos(p.facing);
            for (let k = 0; k < 5; k++) addPunchTrail(wx, wy, wz, 3.5);
            if (checkPunchHitBuildings(wx, wy, wz, ATTACK_HEAVY_DAMAGE * (duoValues[pi] >= DUO_MAX ? 1.5 : 1), hitSet)) heavyHit = true;
          }
          if (heavyHit) {
            p.x = clamp(p.x - Math.sin(p.facing) * 0.2, -AREA, AREA);
            p.z = clamp(p.z - Math.cos(p.facing) * 0.2, -AREA, MOVE_Z_MAX);
          }
        }
        
        // Body: lean back during windup, forward during push
        p.group.rotation.x += ((fwdExt * 0.28 - backExt * 0.18) - p.group.rotation.x) * 0.5;
        p.group.rotation.y  = p.facing;
        p.group.position.y += ((fwdExt * -0.10 + backExt * 0.05) - p.group.position.y) * 0.5;
        // Both arms move together, narrowing to ±0.30 at peak extension
        p.armL.position.set(-armX, 0.46, armZ);
        p.armR.position.set( armX, 0.46, armZ);
        p.armL.scale.setScalar(armScale);
        p.armR.scale.setScalar(armScale);
        
      } else {
        // ── Light punch: single arm thrust ────────────────────────────
        const ext = prog < ATTACK_EXTEND_FRAC
        ? prog / ATTACK_EXTEND_FRAC
        : 1 - (prog - ATTACK_EXTEND_FRAC) / (1 - ATTACK_EXTEND_FRAC);
        const armScale  = 1 + ext * 2;
        const isRight   = p.attackArm === 1;
        const punchArm  = isRight ? p.armR : p.armL;
        const restArm   = isRight ? p.armL : p.armR;
        const punchSign = isRight ? 1 : -1;
        // Trail during extend phase + peak burst
        if (prog < ATTACK_EXTEND_FRAC) {
          const lx = punchSign * (0.60 - ext * 0.46);
          const lz = 0.08 + ext * 0.88;
          addPunchTrail(
            p.x + lx * Math.cos(p.facing) + lz * Math.sin(p.facing),
            p.group.position.y + 0.46,
            p.z - lx * Math.sin(p.facing) + lz * Math.cos(p.facing),
            armScale
          );
        } else if (!p.punchPeakSpawned) {
          p.punchPeakSpawned = true;
          const peakLx = punchSign * 0.14;
          const peakLz = 0.96;
          const wx = p.x + peakLx * Math.cos(p.facing) + peakLz * Math.sin(p.facing);
          const wy = p.group.position.y + 0.46;
          const wz = p.z - peakLx * Math.sin(p.facing) + peakLz * Math.cos(p.facing);
          for (let k = 0; k < 4; k++) addPunchTrail(wx, wy, wz, 3);
          if (checkPunchHitBuildings(wx, wy, wz, ATTACK_LIGHT_DAMAGE * (duoValues[pi] >= DUO_MAX ? 1.5 : 1))) {
            p.x = clamp(p.x - Math.sin(p.facing) * 0.1, -AREA, AREA);
            p.z = clamp(p.z - Math.cos(p.facing) * 0.1, -AREA, MOVE_Z_MAX);
          }
        }
        // Body: lean forward + dip + turn toward punching side
        p.group.rotation.x += (ext * 0.22 - p.group.rotation.x) * 0.4;
        p.group.rotation.y  = p.facing - punchSign * ext * 0.18;
        p.group.position.y += (ext * -0.08 - p.group.position.y) * 0.4;
        // Punching arm thrusts forward, scale up to 3×
        punchArm.position.x = punchSign * (0.60 - ext * 0.46);
        punchArm.position.z = 0.08 + ext * 0.88;
        punchArm.position.y = 0.46;
        punchArm.scale.setScalar(armScale);
        // Resting arm stays back
        restArm.position.x += (-punchSign * 0.60 - restArm.position.x) * 0.2;
        restArm.position.z += (0.08 - restArm.position.z) * 0.2;
        restArm.position.y += (0.46 - restArm.position.y) * 0.2;
        restArm.scale.setScalar(1);
      }
      
      // Feet grounded (both punch types)
      p.footL.position.z += (0.04 - p.footL.position.z) * 0.2;
      p.footR.position.z += (0.04 - p.footR.position.z) * 0.2;
      p.footL.position.y += (0.15 - p.footL.position.y) * 0.2;
      p.footR.position.y += (0.15 - p.footR.position.y) * 0.2;
      
    } else if (p.moving) {
      p.group.rotation.x += (0 - p.group.rotation.x) * 0.2;
      const wave = Math.sin(p.t * 9);
      
      p.group.position.y = Math.abs(wave) * 0.13;
      
      p.armL.position.x += (-0.60 - p.armL.position.x) * 0.18;
      p.armR.position.x += ( 0.60 - p.armR.position.x) * 0.18;
      p.armL.position.z =  0.08 - wave * 0.28;
      p.armR.position.z =  0.08 + wave * 0.28;
      
      p.footL.position.z =  0.04 + wave * 0.20;
      p.footR.position.z =  0.04 - wave * 0.20;
      p.footL.position.y =  0.15 + Math.max(0,  wave) * 0.14;
      p.footR.position.y =  0.15 + Math.max(0, -wave) * 0.14;
    } else {
      p.group.rotation.x += (0 - p.group.rotation.x) * 0.2;
      p.group.position.y = Math.sin(p.t * 1.8) * 0.018;
      
      p.armL.position.x += (-0.60 - p.armL.position.x) * 0.12;
      p.armR.position.x += ( 0.60 - p.armR.position.x) * 0.12;
      p.armL.position.z += (0.08 - p.armL.position.z) * 0.12;
      p.armR.position.z += (0.08 - p.armR.position.z) * 0.12;
      p.footL.position.z += (0.04 - p.footL.position.z) * 0.12;
      p.footR.position.z += (0.04 - p.footR.position.z) * 0.12;
      p.footL.position.y += (0.15 - p.footL.position.y) * 0.12;
      p.footR.position.y += (0.15 - p.footR.position.y) * 0.12;
    }
    
  });
}

// ── Attack helpers ─────────────────────────────────────────────────────
// Returns true during the arm-extend (forward) phase of any punch type.
// Used to lock rotation and as the condition for lunge movement.
function _isInExtendPhase(p) {
  if (!p.isAttacking) return false;
  const dur  = p.isHeavyPunch ? ATTACK_HEAVY_DUR : ATTACK_DUR;
  const prog = 1 - p.attackTimer / dur;
  return p.isHeavyPunch
  ? (prog >= ATTACK_HEAVY_WINDUP_FRAC && prog < ATTACK_HEAVY_EXTEND_FRAC)
  : prog < ATTACK_EXTEND_FRAC;
}

// Starts a new attack, cycling through the combo sequence.
// Handles comboCount reset, heavy/light selection, and all state init.
function _startAttack(p) {
  if (p.comboCount >= COMBO_MAX) p.comboCount = 0;
  p.isHeavyPunch     = (p.comboCount === COMBO_MAX - 1);
  p.isAttacking      = true;
  p.attackTimer      = p.isHeavyPunch ? ATTACK_HEAVY_DUR : ATTACK_DUR;
  p.attackArm        = p.comboCount % 2;
  p.punchPeakSpawned = false;
  p.comboCount++;
  p.comboTimer       = COMBO_RESET_SEC;
}

// ── Dash movement helper ───────────────────────────────────────────────
// steerDx / steerDz: raw input direction (keyboard ±1 or gamepad axis float).
// Pass 0,0 when no steering input. Normalises internally so callers need not.
function _processDash(p, dtSec, dt, steerDx, steerDz) {
  // Steering unlocked once the ascent phase (first DASH_ASCENT_FRAC of duration) ends
  if (p.dashTimer <= DASH_DUR * (1 - DASH_ASCENT_FRAC)) {
    if (steerDx !== 0 || steerDz !== 0) {
      const len  = Math.sqrt(steerDx * steerDx + steerDz * steerDz);
      p.dashDirX = steerDx / len;
      p.dashDirZ = steerDz / len;
      p.facing   = Math.atan2(steerDx, steerDz);
    }
  }
  p.dashTimer -= dtSec;
  const tFrac = Math.max(0, p.dashTimer / DASH_DUR);
  const spd   = DASH_END_SPD + (DASH_INIT_SPD - DASH_END_SPD) * tFrac;
  p.x      = clamp(p.x + p.dashDirX * spd * dt, -AREA, AREA);
  p.z      = clamp(p.z + p.dashDirZ * spd * dt, -AREA, MOVE_Z_MAX);
  p.moving = true;
  if (p.dashTimer <= 0) { p.isDashing = false; p.dashCooldown = DASH_COOLDOWN; }
}

// ── Per-player input (unified keyboard + gamepad) ──────────────────────
// Returns { dx, dz, stickX, stickZ, dashTrigger, attackTrigger,
//           colorLeft, colorRight } or null if no binding / disconnected.
function getPlayerInput(pi, dt, gps) {
  const binding = playerBindings[pi];
  if (!binding) return null;
  if (binding.type === 'keyboard') {
    const sx = (keys['a'] || keys['A'] ? -1 : 0) + (keys['d'] || keys['D'] ? 1 : 0);
    const sz = (keys['w'] || keys['W'] ? -1 : 0) + (keys['s'] || keys['S'] ? 1 : 0);
    const ln = !!keys['ArrowLeft'], rn = !!keys['ArrowRight'];
    const input = {
      dx: sx * SPD * dt, dz: sz * SPD * dt,
      stickX: sx, stickZ: sz,
      dashTrigger:   dashPressed,
      attackTrigger: attackPressed,
      colorLeft:  ln && !prevArrow.left,
      colorRight: rn && !prevArrow.right,
    };
    prevArrow.left = ln; prevArrow.right = rn;
    return input;
  }
  const gp = gps[binding.gpIndex];
  if (!gp) return null;
  const prev_ = gpPrev[pi];
  const btnA  = !!gp.buttons[0]?.pressed;
  const btnX  = !!gp.buttons[2]?.pressed;
  const b14   = !!gp.buttons[14]?.pressed;
  const b15   = !!gp.buttons[15]?.pressed;
  const ax    = applyDeadzone(gp.axes[0]);
  const az    = applyDeadzone(gp.axes[1]);
  const input = {
    dx: ax * SPD * dt, dz: az * SPD * dt,
    stickX: ax, stickZ: az,
    dashTrigger:   btnA && !prev_[0],
    attackTrigger: btnX && !prev_[2],
    colorLeft:  b14 && !prev_[14],
    colorRight: b15 && !prev_[15],
  };
  prev_[0] = btnA; prev_[2] = btnX; prev_[14] = b14; prev_[15] = b15;
  return input;
}

// ── Game loop ──────────────────────────────────────────────────────────
let prevTime = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now       = performance.now();
  const elapsedMs = now - prevTime;
  const dt        = Math.min(elapsedMs / 16.67, 3);
  prevTime        = now;
  
  // Start-screen only: binding poll + colour change for ready players
  if (!gameStarted) {
    const _gps = navigator.getGamepads();
    
    // Gamepad binding poll
    for (const gp of _gps) {
      if (gp && gp.buttons.some(b => b.pressed)) tryBindGamepad(gp.index);
    }
    
    // Colour change for ready players (arrow keys / d-pad only)
    const ln = !!keys['ArrowLeft'],  rn = !!keys['ArrowRight'];
    const kbSlotPre = playerBindings.findIndex(b => b && b.type === 'keyboard');
    if (kbSlotPre !== -1) {
      if (ln && !prevArrow.left)  setColor(kbSlotPre, -1);
      if (rn && !prevArrow.right) setColor(kbSlotPre,  1);
    }
    prevArrow.left = ln; prevArrow.right = rn;
    
    for (let pi = 0; pi < 4; pi++) {
      const binding = playerBindings[pi];
      if (!binding || binding.type !== 'gamepad') continue;
      const gp   = _gps[binding.gpIndex];
      if (!gp) continue;
      const prev = gpPrev[pi];
      const b14  = !!gp.buttons[14]?.pressed;
      const b15  = !!gp.buttons[15]?.pressed;
      if (b14 && !prev[14]) setColor(pi, -1);
      if (b15 && !prev[15]) setColor(pi,  1);
      prev[14] = b14; prev[15] = b15;
    }
  }
  
  if (gameStarted && !gamePaused) {
    // Grace period countdown
    if (graceRemaining > 0) {
      graceRemaining = Math.max(0, graceRemaining - elapsedMs / 1000);
      // Grace just ended — check all players immediately
      if (graceRemaining <= 0) {
        players.forEach((p, i) => {
          _wasInFire[i] = false; // reset so edge trigger fires fresh
          if (bottomFireEnabled && (p.z + BODY_RADIUS) > DAMAGE_Z)
            takeDamage(i, FIRE_DAMAGE, p.x, p.z + BODY_RADIUS);
        });
      }
    }
    
    // Countdown timer
    timeRemaining = Math.max(0, timeRemaining - elapsedMs / 1000);
    _timerEl.textContent = Math.ceil(timeRemaining);
    _timerEl.classList.toggle('urgent', timeRemaining <= 10 && timeRemaining > 0);
    
    if (timeRemaining <= 0) {
      // Game Over
      gameStarted = false;
      document.getElementById('final-score-number').textContent = Math.floor(gameScore);
      document.getElementById('distance').style.display = 'none';
      _duoLeftEl.style.display  = 'none';
      _duoRightEl.style.display = 'none';
      _ultraBarEl.style.display = 'none';
      document.getElementById('gameover-screen').style.display = 'flex';
    } else {
      const dtSec = elapsedMs / 1000;
      
      const gps = navigator.getGamepads();
      for (let pi = 0; pi < 4; pi++) {
        const p = players[pi];
        if (p.isDead || p.fusingWith !== null) continue; // skip before consuming input edge state
        const input = getPlayerInput(pi, dt, gps);
        if (!input) continue;
        
        if (p.dashCooldown > 0) p.dashCooldown -= dtSec;
        
        // Dash trigger — also cancels any active attack
        if (input.dashTrigger && !p.isDashing && p.dashCooldown <= 0 && p.bounceTimer <= 0 && !p.inBubble) {
          if (p.isAttacking) { p.isAttacking = false; p.attackTimer = 0; }
          p.isDashing = true;
          p.dashTimer = DASH_DUR;
          p.dashDirX  = Math.sin(p.facing);
          p.dashDirZ  = Math.cos(p.facing);
        }
        
        // Attack cooldown + tick
        if (p.attackCooldown > 0) p.attackCooldown -= dtSec;
        if (p.isAttacking) {
          p.attackTimer -= dtSec;
          if (p.attackTimer <= 0) { p.isAttacking = false; p.attackCooldown = ATTACK_COOLDOWN; }
        }
        // Combo reset timer
        if (p.comboTimer > 0) {
          p.comboTimer -= dtSec;
          if (p.comboTimer <= 0) p.comboCount = 0;
        }
        // Attack trigger
        const atkDur         = p.isHeavyPunch ? ATTACK_HEAVY_DUR : ATTACK_DUR;
        const canFreshAttack = !p.isAttacking && (p.attackCooldown <= 0 || p.comboTimer > 0);
        const canComboCancel = p.isAttacking  && p.attackTimer <= atkDur * (1 - ATTACK_CANCEL_FRAC) && p.comboCount < COMBO_MAX;
        if (input.attackTrigger && (canFreshAttack || canComboCancel) && !p.isDashing && p.bounceTimer <= 0 && !p.inBubble) {
          _startAttack(p);
        }
        
        if (p.isDashing) {
          const dashProg = 1 - Math.max(0, p.dashTimer / DASH_DUR);
          if (dashProg >= DASH_JUMP_FRAC && input.attackTrigger && (p.attackCooldown <= 0 || p.comboTimer > 0)) {
            p.isDashing = false; p.dashCooldown = DASH_COOLDOWN;
            _startAttack(p);
          } else {
            _processDash(p, dtSec, dt, input.stickX, input.stickZ);
          }
        } else if (p.bounceTimer <= 0) {
          const { dx, dz } = input;
          const hasInput = dx !== 0 || dz !== 0;
          if (hasInput && !_isInExtendPhase(p)) p.facing = Math.atan2(dx, dz);
          if (p.isAttacking) {
            p.moving = false;
            if (p.isHeavyPunch && _isInExtendPhase(p)) {
              p.x = clamp(p.x + Math.sin(p.facing) * ATTACK_HEAVY_LUNGE_SPD * dtSec, -AREA, AREA);
              p.z = clamp(p.z + Math.cos(p.facing) * ATTACK_HEAVY_LUNGE_SPD * dtSec, -AREA, MOVE_Z_MAX);
            }
          } else {
            p.x = clamp(p.x + dx, -AREA, AREA);
            p.z = clamp(p.z + dz,  -AREA, MOVE_Z_MAX);
            p.moving = hasInput;
          }
        } else {
          p.moving = false;
        }
        
        if (input.colorLeft)  setColor(pi, -1);
        if (input.colorRight) setColor(pi,  1);
      }
      
      // World scroll + buildings + mountains
      updateScroll(dt);
      updateBuildings(dt, dtSec);

      // Cannon building → player collision (launch phase only)
      for (const b of buildings) {
        if (!b.cannon || !b.cannonLaunched) continue;
        const bx0 = b.x - b.w / 2, bx1 = b.x + b.w / 2;
        const bz0 = b.z - b.d / 2, bz1 = b.z + b.d / 2;
        for (let pi = 0; pi < 4; pi++) {
          const p = players[pi];
          if (!p.active || p.isDead) continue;
          const cx = Math.max(bx0, Math.min(bx1, p.x));
          const cz = Math.max(bz0, Math.min(bz1, p.z));
          const dx = p.x - cx, dz = p.z - cz;
          if (dx * dx + dz * dz < BODY_RADIUS * BODY_RADIUS && !b.cannonHitPlayers.has(pi)) {
            b.cannonHitPlayers.add(pi);
            takeDamage(pi, 20, b.x, b.z);
          }
        }
        // Cannon → pedestrian stun
        for (const ped of pedestrians) {
          if (ped.stunned) continue;
          const cx = Math.max(bx0, Math.min(bx1, ped.x));
          const cz = Math.max(bz0, Math.min(bz1, ped.z));
          const dx = ped.x - cx, dz = ped.z - cz;
          if (dx * dx + dz * dz < PED_R * PED_R) {
            ped.stunned = true;
            ped.vx = 0; ped.vz = 0;
            _pedInstMesh.setColorAt(ped.instanceId, _PED_COLOR_STUNNED);
          }
        }
        // Cannon → fusion ball damage (one hit per ball)
        for (const ball of _fusionBalls) {
          if (ball.dispersing || b.cannonHitFusionBalls.has(ball)) continue;
          const cx = Math.max(bx0, Math.min(bx1, ball.cx));
          const cz = Math.max(bz0, Math.min(bz1, ball.cz));
          const dx = ball.cx - cx, dz = ball.cz - cz;
          if (dx * dx + dz * dz < ball.R * ball.R) {
            b.cannonHitFusionBalls.add(ball);
            ball.life = Math.max(0, ball.life - 20);
          }
        }
      }

      updateMountains(dt);
      updatePatches(dt);
      resolveCollisions();

      // Combo timer countdown
      if (_comboTimer > 0) {
        _comboTimer -= dtSec;
        if (_comboTimer <= 0) {
          _resetCombo();
        } else {
          _comboBarInner.style.width = (_comboTimer / _COMBO_DUR * 100) + '%';
          _comboBarInner.classList.toggle('urgent', _comboTimer / _COMBO_DUR < 0.3);
        }
      }
    } // end timeRemaining > 0
    
    // Bubble respawn system
    updateBubbles(elapsedMs / 1000);
    updateTimerPenalty(elapsedMs / 1000);
    // Flames grow + flicker (runs for full game duration)
    updateFlames(elapsedMs / 1000);
  } // end gameStarted

  // HP bars always update so positions track characters even on overlays
  updateHPBars(elapsedMs / 1000);
  updateEffects(elapsedMs / 1000);
  updateDuoRings(elapsedMs / 1000);
  updateFusionAnimations(elapsedMs / 1000);
  attackPressed = false; // consume single-frame attack flag (after fusion beast reads it)
  dashPressed   = false; // consume single-frame dash flag
  updatePedestrians(dt, elapsedMs / 1000);
  updateItems(elapsedMs / 1000);
  _debugBoxEl.textContent = 'peds: ' + pedestrians.length;
  
  updatePlayerAnimations(dt, elapsedMs);
  
  renderer.render(scene, camera);
}

// ── Combo system ───────────────────────────────────────────────────────
const _COMBO_DUR      = 3.0;
let   _comboCount     = 0;
let   _comboTimer     = 0;

const _comboNumberEl  = document.getElementById('combo-n');
const _comboBarInner  = document.getElementById('combo-bar-inner');
const _comboBoxEl     = document.getElementById('combo-box');

function _showComboBox() {
  _comboBoxEl.style.display = 'flex';
  _comboBoxEl.classList.remove('combo-slide-out', 'combo-slide-in');
  void _comboBoxEl.offsetWidth; // force reflow to restart animation
  _comboBoxEl.classList.add('combo-slide-in');
}

function _hideComboBox() {
  _comboBoxEl.classList.remove('combo-slide-in');
  void _comboBoxEl.offsetWidth;
  _comboBoxEl.classList.add('combo-slide-out');
  _comboBoxEl.addEventListener('animationend', () => {
    if (_comboBoxEl.classList.contains('combo-slide-out')) {
      _comboBoxEl.style.display = 'none';
      _comboBoxEl.classList.remove('combo-slide-out');
    }
  }, { once: true });
}

// instant=true → immediate hide (reset/quit); instant=false → slide-out animation (timer expired)
function _resetCombo(instant = false) {
  _comboCount = 0;
  _comboTimer = 0;
  _comboNumberEl.textContent = '×0';
  _comboBarInner.style.width = '0%';
  _comboBarInner.classList.remove('urgent');
  if (instant) {
    _comboBoxEl.style.display = 'none';
    _comboBoxEl.classList.remove('combo-slide-in', 'combo-slide-out');
  } else {
    _hideComboBox();
  }
}

function onBuildingDestroyed() {
  if (!gameStarted) return;
  _comboCount = _comboTimer > 0 ? _comboCount + 1 : 1;
  _comboTimer = _COMBO_DUR;
  _comboNumberEl.textContent = '×' + _comboCount;
  _comboBarInner.style.width = '100%';
  _comboBarInner.classList.remove('urgent');
  if (_comboCount >= 2) _showComboBox();
}

// ── Duo bar values ─────────────────────────────────────────────────────
const duoValues = [0, 0, 0, 0]; // per-player value, 0–100
const DUO_MAX   = 50;
const DUO_PER_PED = 1; // value gained per pedestrian eaten

// Cached inner-bar elements (index matches player index)
const _duoInnerEls = [
  document.getElementById('duo-inner-1p'),
  document.getElementById('duo-inner-2p'),
  document.getElementById('duo-inner-3p'),
  document.getElementById('duo-inner-4p'),
];
const _duoValEls = [
  document.getElementById('duo-val-1p'),
  document.getElementById('duo-val-2p'),
  document.getElementById('duo-val-3p'),
  document.getElementById('duo-val-4p'),
];

function _syncDuoBar(playerIndex) {
  const el = _duoInnerEls[playerIndex];
  el.style.width = (duoValues[playerIndex] / DUO_MAX * 100) + '%';
  el.classList.toggle('is-full', duoValues[playerIndex] >= DUO_MAX);
  _duoValEls[playerIndex].textContent = duoValues[playerIndex] + '/' + DUO_MAX;
}

function addDuoValue(playerIndex) {
  duoValues[playerIndex] = Math.min(DUO_MAX, duoValues[playerIndex] + DUO_PER_PED);
  _syncDuoBar(playerIndex);
}

function reduceDuoValue(playerIndex, amount) {
  duoValues[playerIndex] = Math.max(0, duoValues[playerIndex] - amount);
  _syncDuoBar(playerIndex);
}

function _resetDuoValues() {
  for (let i = 0; i < 4; i++) {
    duoValues[i] = 0;
    _syncDuoBar(i);
  }
}

// ── Duo ring (shown when Duo is full and Shift / LB held) ─────────────
const _DUO_RING_COLORS   = [0xffcc00, 0xccff00];
const _DUO_RING_INTERVAL = 0.12; // seconds per color toggle
const _DUO_RING_IN_DUR   = 0.25; // seconds for scale-in animation

function _easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

const _duoRings = players.map(() => {
  const geo  = new THREE.RingGeometry(0.90, 1.04, 48);
  const mat  = new THREE.MeshBasicMaterial({
    color: _DUO_RING_COLORS[0],
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.visible    = false;
  scene.add(mesh);
  return { mesh, mat, flashTimer: 0, colorIdx: 0, scaleTimer: 0, wasHeld: false };
});

function updateDuoRings(dtSec) {
  const gps = navigator.getGamepads();
  players.forEach((p, pi) => {
    const ring = _duoRings[pi];
    if (!p.active || p.isDead || duoValues[pi] < DUO_MAX || p.fusingWith !== null) {
      ring.mesh.visible = false;
      ring.wasHeld = false;
      return;
    }
    const binding = playerBindings[pi];
    let held = false;
    if (binding && binding.type === 'keyboard') {
      held = !!keys['Shift'];
    } else if (binding && binding.type === 'gamepad') {
      const gp = gps[binding.gpIndex];
      held = gp ? !!gp.buttons[4]?.pressed : false;
    }
    if (!held) {
      ring.mesh.visible = false;
      ring.wasHeld = false;
      return;
    }
    // Trigger scale-in animation on the frame the key is first pressed
    if (!ring.wasHeld) {
      ring.scaleTimer = 0;
      ring.wasHeld = true;
    }
    ring.mesh.visible    = true;
    ring.mesh.position.x = p.x;
    ring.mesh.position.z = p.z;
    
    // Scale-in
    ring.scaleTimer += dtSec;
    const t = Math.min(ring.scaleTimer / _DUO_RING_IN_DUR, 1);
    const s = _easeOutBack(t);
    ring.mesh.scale.setScalar(s);
    
    // Color flash
    ring.flashTimer -= dtSec;
    if (ring.flashTimer <= 0) {
      ring.flashTimer = _DUO_RING_INTERVAL;
      ring.colorIdx   = 1 - ring.colorIdx;
      ring.mat.color.setHex(_DUO_RING_COLORS[ring.colorIdx]);
    }
    
    // Collision — only after ring has fully expanded
    if (ring.scaleTimer >= _DUO_RING_IN_DUR) {
      const RING_HIT_DIST = 1.04 + BODY_RADIUS; // ring outer edge touches other player's body
      for (let oi = 0; oi < players.length; oi++) {
        if (oi === pi) continue;
        const other = players[oi];
        if (!other.active || other.isDead) continue;
        // Don't trigger if either player is already fusing
        if (p.fusingWith !== null || other.fusingWith !== null) continue;
        const dx = other.x - p.x, dz = other.z - p.z;
        if (dx * dx + dz * dz < RING_HIT_DIST * RING_HIT_DIST) {
          startFusion(pi, oi);
          ring.mesh.visible = false;
          ring.wasHeld = false;
          break;
        }
      }
    }
  });
}


// ── Timer penalty display ──────────────────────────────────────────────
const _penaltyItems = [];

function showTimerPenalty(seconds) {
  // Kick any 'show'-phase items into immediate fadeout
  _penaltyItems.forEach(item => {
    if (item.phase === 'show') {
      item.phase = 'fade';
      item.timer = 0.4;
    }
  });
  const el = document.createElement('div');
  el.className = 'timer-penalty-item';
  el.textContent = '-' + Math.ceil(seconds);
  document.getElementById('time-row').appendChild(el);
  _penaltyItems.push({ el, phase: 'show', timer: 1.0, offsetY: 0 });
}

function showTimerBonus(seconds) {
  // Kick any 'show'-phase items into immediate fadeout
  _penaltyItems.forEach(item => {
    if (item.phase === 'show') {
      item.phase = 'fade';
      item.timer = 0.4;
    }
  });
  const el = document.createElement('div');
  el.className = 'timer-penalty-item';
  el.style.color = '#4499ff';
  el.style.textShadow = '0 0 10px #4499ff';
  el.textContent = '+' + seconds;
  document.getElementById('time-row').appendChild(el);
  _penaltyItems.push({ el, phase: 'show', timer: 1.0, offsetY: 0 });
}

// ── Fusion animation ────────────────────────────────────────────────────
function _easeInQuart(t) { return t * t * t * t; }

const _fusionBalls = [];

// ── Roar animation constants (computed once, reused every frame) ────────
const _ROAR_HOLD      = 0.12;
const _ROAR_DURS      = [0.10, 0.10, 0.10, 0.10, 0.15]; // per-segment durations
const _ROAR_CUMS      = _ROAR_DURS.reduce((a, d, i) => [...a, (a[i] || 0) + d], [0]);
const _ROAR_TOTAL_DUR = _ROAR_HOLD + _ROAR_CUMS[5];
const _ROAR_ARM_RAISE = 1.8;
const _ROAR_KF        = [1.0, 0.5, 1.0, 0.5, 1.0, 0.0]; // height keyframes

const _FUSION_BALL_LIFE_MAX = 75;

// ── Beast arm punch duration (extend same as solo, retract 2× slower) ──
const _BEAST_ARM_EXT_DUR  = ATTACK_DUR * ATTACK_EXTEND_FRAC;
const _BEAST_ARM_RET_DUR  = ATTACK_DUR * (1 - ATTACK_EXTEND_FRAC) * 2;
const _BEAST_ARM_DUR      = _BEAST_ARM_EXT_DUR + _BEAST_ARM_RET_DUR;

// Reused for 3D→screen projection of fusion ball UI (never allocate in loop)
const _fusionVec = new THREE.Vector3();

// Build a dual-color sphere: left half = colorA, right half = colorB (vertex colors)
function _createFusionBall(piA, piB, cx, cz) {
  const R    = BODY_RADIUS * 2;        // 1.04 — fusion body radius
  const S    = 2;                      // scale factor vs single character
  const colA = _origColors[piA][0];
  const colB = _origColors[piB][0];
  
  const group = new THREE.Group();
  group.position.set(cx, R, cz);
  
  const allGeos = [], allMats = [];
  function addPart(geo, mat, px, py, pz) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.position.set(px, py, pz);
    group.add(m);
    allGeos.push(geo); allMats.push(mat);
    return m;
  }
  
  // ── Body (dual-color via vertex colors) ──────────────────────────────
  const bodyGeo = new THREE.SphereGeometry(R, 32, 24);
  const posArr  = bodyGeo.attributes.position;
  const colArr  = new Float32Array(posArr.count * 3);
  for (let i = 0; i < posArr.count; i++) {
    const c = posArr.getX(i) >= 0 ? colA : colB;
    colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
  addPart(bodyGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), 0, 0, 0);
  
  // Body vertex color: pos.getX >= 0 (right, +x) = colA, left (-x) = colB
  // Arms and feet must follow the same convention: right (+x) = colA, left (-x) = colB
  const armR    = 0.11 * S;
  const armRestY = 0.46 * S - R;
  const armL = addPart(new THREE.SphereGeometry(armR, 12, 10),
  new THREE.MeshLambertMaterial({ color: colB.clone() }), -0.60 * S, armRestY, 0.08 * S);
  const armRm = addPart(new THREE.SphereGeometry(armR, 12, 10),
  new THREE.MeshLambertMaterial({ color: colA.clone() }),  0.60 * S, armRestY, 0.08 * S);
  // Start arms at top for roar animation (match animation's highest point)
  armL.position.y  = armRestY + _ROAR_ARM_RAISE;
  armRm.position.y = armRestY + _ROAR_ARM_RAISE;
  armL.position.x  = -(0.38 * S);
  armRm.position.x =   0.38 * S;
  
  const footR = 0.27 * S;
  const footLMesh = addPart(new THREE.SphereGeometry(footR, 14, 12),
  new THREE.MeshLambertMaterial({ color: footColorFrom(COLOR_HEX[players[piB].colorIdx]).clone() }),
  -0.24 * S, 0.15 * S - R, 0.04 * S); // left = piB
  const footRMesh = addPart(new THREE.SphereGeometry(footR, 14, 12),
  new THREE.MeshLambertMaterial({ color: footColorFrom(COLOR_HEX[players[piA].colorIdx]).clone() }),
  0.24 * S, 0.15 * S - R, 0.04 * S); // right = piA
  
  // ── Eyes (same style as single character: white ovals, two per side) ─
  const eyeGeo = new THREE.SphereGeometry(0.13 * S, 16, 12);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  allGeos.push(eyeGeo); allMats.push(eyeMat);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.65, 1.2, 0.38);
    eye.position.set(sx * 0.19 * S, 0.70 * S - R, 0.45 * S);
    group.add(eye);
  }
  
  scene.add(group);

  // ── Life bar UI ───────────────────────────────────────────────────────
  const lifeWrap = document.createElement('div');
  lifeWrap.style.cssText = `
    position: absolute;
    width: 72px;
    pointer-events: none;
    transform: translateX(-50%);
  `;
  const lifeOuter = document.createElement('div');
  lifeOuter.style.cssText = `
    width: 72px; height: 21px;
    background: rgba(0,0,0,0.45);
    border-radius: 4px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.25);
  `;
  const lifeInner = document.createElement('div');
  lifeInner.style.cssText = `
    width: 100%; height: 100%;
    background: #ffcc00;
    border-radius: 3px;
    transition: width 0.1s linear, background 0.3s;
  `;
  lifeOuter.appendChild(lifeInner);
  lifeWrap.appendChild(lifeOuter);
  document.getElementById('ui').appendChild(lifeWrap);

  // ── Ground arrows (flat on floor, show each player's input direction) ─
  // Arrow shape in XY plane, pointing in +Y; rotation.x=π/2 lays it in XZ plane pointing +Z.
  // A parent Group handles Y-axis rotation (input direction).
  function _makeArrow(color) {
    const shape = new THREE.Shape();
    // Tail (anchor/rotation center) at origin (0, 0); tip points in +Y
    shape.moveTo(0,     0.80);   // tip
    shape.lineTo(0.20,  0.42);   // right head
    shape.lineTo(0.08,  0.42);   // right shoulder
    shape.lineTo(0.08,  0.00);   // right tail (at origin)
    shape.lineTo(-0.08, 0.00);   // left tail  (at origin)
    shape.lineTo(-0.08, 0.42);   // left shoulder
    shape.lineTo(-0.20, 0.42);   // left head
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;  // lay flat in XZ plane
    allGeos.push(geo); allMats.push(mat);
    const grp = new THREE.Group();
    grp.position.set(0, -R + 0.03, 0); // anchored at body center bottom
    grp.add(mesh);
    grp.scale.setScalar(3);
    grp.visible = false;
    group.add(grp);
    return grp;
  }
  const arrowA = _makeArrow(colA.clone());
  const arrowB = _makeArrow(colB.clone());

  return { group, allGeos, allMats, cx, cz, life: _FUSION_BALL_LIFE_MAX, lifeTickTimer: 0, piA, piB,
    armL, armRm, armRestY, armRestX: 0.60 * S, armRestZ: 0.08 * S, armEyeX: 0.38 * S, roarTimer: 0,
    footLMesh, footRMesh, beastT: 0,
    lifeWrap, lifeInner, R, arrowA, arrowB,
    dispersing: false, disperseTimer: 0, lifeFlashTimer: 0, lifeFlashing: false,
    beastHitTimer: 0, beastMoving: false,
    armTimerA: 0, armTimerB: 0, armPeakA: false, armPeakB: false,
    beastFlashTimer: 0 };
}
  
  // Kick off the pulling phase for both players toward each other's midpoint.
  function startFusion(piA, piB) {
    const pA = players[piA], pB = players[piB];
    const mx = (pA.x + pB.x) / 2;
    const mz = (pA.z + pB.z) / 2;
    duoValues[piA] = 0; // ring-opener pays the cost
    for (const [pi, p] of [[piA, pA], [piB, pB]]) {
      p.fusingWith    = pi === piA ? piB : piA;
      p.fusingPhase   = 'pulling';
      p.fusingTimer   = 0;
      p.fusingStartX  = p.x;
      p.fusingStartZ  = p.z;
      p.fusingTargetX = mx;
      p.fusingTargetZ = mz;
      // Cancel any ongoing action
      p.isAttacking = false; p.attackTimer = 0;
      p.isDashing   = false; p.dashTimer   = 0;
      p.bounceTimer = 0;
    }
  }
  
  function updateFusionAnimations(dtSec) {
    // ── Per-player phase update ──────────────────────────────────────────
    for (let pi = 0; pi < players.length; pi++) {
      const p = players[pi];
      if (p.fusingWith === null) continue;
      p.fusingTimer += dtSec;
      
      if (p.fusingPhase === 'pulling') {
        const t    = Math.min(p.fusingTimer / FUSION_PULL_DUR, 1);
        const ease = _easeInQuart(t);
        p.x = p.fusingStartX + (p.fusingTargetX - p.fusingStartX) * ease;
        p.z = p.fusingStartZ + (p.fusingTargetZ - p.fusingStartZ) * ease;
        p.group.position.set(p.x, p.group.position.y, p.z);
        
        if (t >= 1) {
          p.x = p.fusingTargetX; p.z = p.fusingTargetZ;
          p.group.position.set(p.x, p.group.position.y, p.z);
          p.fusingPhase = 'flashing';
          p.fusingTimer = 0;
        }
        
      } else if (p.fusingPhase === 'flashing') {
        // Rapid white / yellow toggle every 40 ms
        const flashIdx = Math.floor(p.fusingTimer / 0.04) % 2;
        p.bodyMats.forEach(m => m.color.setHex(flashIdx === 0 ? 0xffffff : 0xffee44));
        
        if (p.fusingTimer >= FUSION_FLASH_DUR) {
          // Hide character, enter merged wait state
          p.group.visible = false;
          p.bodyMats.forEach((m, mi) => {
            m.color.copy(_origColors[pi][mi]);
            m.transparent = false; m.opacity = 1;
          });
          p.fusingPhase = 'merged';
          p.fusingTimer = 0;
          // Spawn fusion ball + smoke burst once per pair (lower-index player)
          if (pi < p.fusingWith) {
            // Determine left/right by pre-fusion x position
            // Body vertex: x>=0 → colA (right), x<0 → colB (left)
            // So piRight → piA, piLeft → piB
            const otherPi = p.fusingWith;
            const piRight = p.fusingStartX >= players[otherPi].fusingStartX ? pi : otherPi;
            const piLeft  = piRight === pi ? otherPi : pi;
            _fusionBalls.push(_createFusionBall(piRight, piLeft, p.x, p.z));
            spawnFusionSmokeBurst(p.x, p.z);
          }
        }
        
      } else if (p.fusingPhase === 'merged' || p.fusingPhase === 'dispersing') {
        // Passive wait — ball update drives the animation
      }
    }
    
    // ── Fusion ball update ────────────────────────────────────────────────
    for (let i = _fusionBalls.length - 1; i >= 0; i--) {
      const ball = _fusionBalls[i];

      // ── Dispersal phase: animate players flying apart ─────────────────
      if (ball.dispersing) {
        if (gameStarted && !gamePaused) {
          ball.disperseTimer += dtSec;
          // Scroll dispersal arc targets with the world
          const scrollStep = _activeScrollSpeed * dtSec * 60;
          for (const rpi of [ball.piA, ball.piB]) {
            const p = players[rpi];
            p.fusingStartZ  += scrollStep;
            p.fusingTargetZ  = clamp(p.fusingTargetZ + scrollStep, -AREA + BODY_RADIUS, MOVE_Z_MAX - BODY_RADIUS);
          }
        }
        // Each player uses their own duration for independent speed feel
        for (const [durKey, rpi] of [['dispDurA', ball.piA], ['dispDurB', ball.piB]]) {
          const t    = Math.min(ball.disperseTimer / ball[durKey], 1);
          const ease = 1 - Math.pow(1 - t, 4);        // Out Quart (position)
          const arcY = Math.sin(t * Math.PI) * 1.2;   // arc: 0 → peak → 0
          const p    = players[rpi];
          p.x = p.fusingStartX + (p.fusingTargetX - p.fusingStartX) * ease;
          p.z = p.fusingStartZ + (p.fusingTargetZ - p.fusingStartZ) * ease;
          p.group.position.set(p.x, arcY, p.z);
          p.moving = true;
        }
        const maxDur = Math.max(ball.dispDurA, ball.dispDurB);
        if (ball.disperseTimer >= maxDur) {
          // Dispersal complete — restore solo control
          for (const rpi of [ball.piA, ball.piB]) {
            const p = players[rpi];
            p.x = p.fusingTargetX; p.z = p.fusingTargetZ;
            p.group.position.set(p.x, 0, p.z);
            p.fusingWith = null; p.fusingPhase = null; p.fusingTimer = 0;
          }
          scene.remove(ball.group);
          ball.allGeos.forEach(g => g.dispose());
          ball.allMats.forEach(m => m.dispose());
          ball.lifeWrap.remove();
          _fusionBalls.splice(i, 1);
        }
        continue;
      }

      if (gameStarted && !gamePaused) {
        ball.roarTimer += dtSec;
        // Life ticks down once the beast is controllable
        // In danger zone: 2 per tick + white flash; otherwise 1 per tick
        if (ball.roarTimer >= _ROAR_TOTAL_DUR && ball.life > 0) {
          const inDanger = (ball.cz + ball.R) > DAMAGE_Z;
          ball.lifeTickTimer += dtSec;
          if (ball.lifeTickTimer >= 0.2) {
            ball.lifeTickTimer -= 0.2;
            ball.life = Math.max(0, ball.life - (inDanger ? 2 : 1));
            if (inDanger) ball.beastFlashTimer = 0.08;
          }
        }
        // Beast white flash tick
        if (ball.beastFlashTimer > 0) {
          ball.beastFlashTimer -= dtSec;
          const on = ball.beastFlashTimer > 0;
          ball.allMats.forEach(m => { if (m.emissive) m.emissive.setHex(on ? 0xffffff : 0x000000); });
        }
        // World scroll — move beast with the floor like buildings do
        const scrollStep = _activeScrollSpeed * dtSec * 60;
        ball.cz = clamp(ball.cz + scrollStep, -AREA, MOVE_Z_MAX);
        ball.group.position.z = ball.cz;
      }

      // ── Roar animation ────────────────────────────────────────────────
      // Hold at top, then 5 segments: even segs down (In Quart), odd segs up (Out Quart)
      if (ball.roarTimer < _ROAR_HOLD) {
        // Hold at top — no change needed, arms already at top
      } else if (ball.roarTimer < _ROAR_TOTAL_DUR) {
        const t    = ball.roarTimer - _ROAR_HOLD;
        const seg  = Math.min(_ROAR_DURS.findIndex((_, i) => t < _ROAR_CUMS[i + 1]), 4);
        const frac = (t - _ROAR_CUMS[seg]) / _ROAR_DURS[seg];
        const ease = seg % 2 === 0
          ? frac * frac * frac * frac       // In Quart (down)
          : 1 - Math.pow(1 - frac, 4);      // Out Quart (up)
        const heightFrac = _ROAR_KF[seg] + (_ROAR_KF[seg + 1] - _ROAR_KF[seg]) * ease;
        const armY = ball.armRestY + _ROAR_ARM_RAISE * heightFrac;
        const armX = ball.armRestX - (ball.armRestX - ball.armEyeX) * (heightFrac * heightFrac);
        ball.armL.position.y  = armY;
        ball.armRm.position.y = armY;
        ball.armL.position.x  = -armX;
        ball.armRm.position.x =  armX;
      } else {
        ball.armL.position.y  = ball.armRestY;
        ball.armRm.position.y = ball.armRestY;
        ball.armL.position.x  = -ball.armRestX;
        ball.armRm.position.x =  ball.armRestX;
      }

      // ── Beast control (active after roar ends) ────────────────────────
      if (gameStarted && !gamePaused && ball.roarTimer >= _ROAR_TOTAL_DUR) {
        const dt  = dtSec * 60;
        const S   = 2; // fusion ball scale factor (2× single character)
        const gps = navigator.getGamepads();
        const inA = getPlayerInput(ball.piA, dt, gps);
        const inB = getPlayerInput(ball.piB, dt, gps);
        const axA = inA?.stickX ?? 0, azA = inA?.stickZ ?? 0;
        const axB = inB?.stickX ?? 0, azB = inB?.stickZ ?? 0;
        const mA  = Math.sqrt(axA * axA + azA * azA);
        const mB  = Math.sqrt(axB * axB + azB * azB);

        // Combined input direction, clamped to unit circle
        const sumX = axA + axB, sumZ = azA + azB;
        const mag  = Math.sqrt(sumX * sumX + sumZ * sumZ);
        const hasInput = mag > 0.01;
        ball.beastMoving = hasInput;
        const nx = hasInput ? sumX / Math.max(mag, 1) : 0;
        const nz = hasInput ? sumZ / Math.max(mag, 1) : 0;

        // Movement
        if (hasInput) {
          let speedMult = 0.6;
          if (mA > 0.1 && mB > 0.1) {
            let diff = Math.abs(Math.atan2(axA, azA) - Math.atan2(axB, azB));
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff < 20 * Math.PI / 180) speedMult = 1.2;
          }
          ball.cx = clamp(ball.cx + nx * SPD * speedMult * dt, -AREA, AREA);
          ball.cz = clamp(ball.cz + nz * SPD * speedMult * dt, -AREA, MOVE_Z_MAX);
          ball.group.position.x = ball.cx;
          ball.group.position.z = ball.cz;
        }

        // Ground arrows (compensate for group Y-rotation so arrows point in world space)
        ball.arrowA.visible = mA > 0.1;
        if (mA > 0.1) ball.arrowA.rotation.y = Math.atan2(axA, azA) - ball.group.rotation.y;
        ball.arrowB.visible = mB > 0.1;
        if (mB > 0.1) ball.arrowB.rotation.y = Math.atan2(axB, azB) - ball.group.rotation.y;

        // Attack input: each player fires their own arm (A→armRm right, B→armL left)
        if (inA?.attackTrigger && ball.armTimerA <= 0) {
          ball.armTimerA = _BEAST_ARM_DUR;
          ball.armPeakA  = false;
        }
        if (inB?.attackTrigger && ball.armTimerB <= 0) {
          ball.armTimerB = _BEAST_ARM_DUR;
          ball.armPeakB  = false;
        }

        // ── Walk animation (50% of single-character speed) ─────────────
        const footRestY = 0.15 * 2 - ball.R;
        const footRestZ = 0.04 * 2;
        const armRestZ  = ball.armRestZ;
        if (hasInput) {
          // Smoothly rotate to face movement direction
          const targetAngle = Math.atan2(nx, nz);
          let rotDiff = targetAngle - ball.group.rotation.y;
          while (rotDiff >  Math.PI) rotDiff -= Math.PI * 2;
          while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
          ball.group.rotation.y += rotDiff * 0.15;
          ball.group.rotation.x += (0 - ball.group.rotation.x) * 0.2;

          // Wave at 50% speed (0.025 vs single char's 0.05 per frame)
          ball.beastT += dt * 0.025;
          const wave = Math.sin(ball.beastT * 9);
          ball.group.position.y = ball.R + Math.abs(wave) * 0.26;

          // Arms swing in local Z; X and Y return to rest (skip arms mid-punch)
          if (ball.armTimerB <= 0) {
            ball.armL.position.x  += (-ball.armRestX - ball.armL.position.x)  * 0.18;
            ball.armL.position.y  += (ball.armRestY  - ball.armL.position.y)  * 0.18;
            ball.armL.position.z   = armRestZ - wave * 0.56;
          }
          if (ball.armTimerA <= 0) {
            ball.armRm.position.x += ( ball.armRestX - ball.armRm.position.x) * 0.18;
            ball.armRm.position.y += (ball.armRestY  - ball.armRm.position.y) * 0.18;
            ball.armRm.position.z  = armRestZ + wave * 0.56;
          }

          // Feet swing
          ball.footLMesh.position.z =  footRestZ + wave * 0.40;
          ball.footRMesh.position.z =  footRestZ - wave * 0.40;
          ball.footLMesh.position.y =  footRestY + Math.max(0,  wave) * 0.28;
          ball.footRMesh.position.y =  footRestY + Math.max(0, -wave) * 0.28;
        } else {
          // Idle — return all limbs to rest (skip arms mid-punch)
          ball.group.position.y = ball.R;
          ball.group.rotation.x += (0 - ball.group.rotation.x) * 0.2;
          if (ball.armTimerB <= 0) {
            ball.armL.position.x  += (-ball.armRestX - ball.armL.position.x)  * 0.12;
            ball.armL.position.y  += (ball.armRestY  - ball.armL.position.y)  * 0.12;
            ball.armL.position.z  += (armRestZ - ball.armL.position.z)  * 0.12;
          }
          if (ball.armTimerA <= 0) {
            ball.armRm.position.x += ( ball.armRestX - ball.armRm.position.x) * 0.12;
            ball.armRm.position.y += (ball.armRestY  - ball.armRm.position.y) * 0.12;
            ball.armRm.position.z += (armRestZ - ball.armRm.position.z) * 0.12;
          }
          ball.footLMesh.position.z += (footRestZ - ball.footLMesh.position.z) * 0.12;
          ball.footRMesh.position.z += (footRestZ - ball.footRMesh.position.z) * 0.12;
          ball.footLMesh.position.y += (footRestY - ball.footLMesh.position.y) * 0.12;
          ball.footRMesh.position.y += (footRestY - ball.footRMesh.position.y) * 0.12;
        }

        // ── Per-arm punch animation (piA→armRm right +1, piB→armL left −1) ──
        const _facing = ball.group.rotation.y;
        for (const [timerKey, peakKey, armMesh, punchSign] of [
          ['armTimerA', 'armPeakA', ball.armRm,  1],
          ['armTimerB', 'armPeakB', ball.armL,  -1],
        ]) {
          if (ball[timerKey] <= 0) continue;
          ball[timerKey] = Math.max(0, ball[timerKey] - dtSec);
          const elapsed = _BEAST_ARM_DUR - ball[timerKey];
          const inExtend = elapsed < _BEAST_ARM_EXT_DUR;
          const ext = inExtend
            ? elapsed / _BEAST_ARM_EXT_DUR
            : 1 - (elapsed - _BEAST_ARM_EXT_DUR) / _BEAST_ARM_RET_DUR;
          const armScale = 1 + ext * 2;
          armMesh.position.x = punchSign * S * (0.60 - ext * 0.46);
          armMesh.position.z = S * (0.08 + ext * 0.88);
          armMesh.position.y = ball.armRestY;
          armMesh.scale.setScalar(armScale);
          // Trail during extend phase (scaled ×S vs solo character)
          if (inExtend) {
            const lx = punchSign * S * (0.60 - ext * 0.46);
            const lz = S * (0.08 + ext * 0.88);
            addPunchTrail(
              ball.cx + lx * Math.cos(_facing) + lz * Math.sin(_facing),
              ball.group.position.y + ball.armRestY,
              ball.cz - lx * Math.sin(_facing) + lz * Math.cos(_facing),
              armScale * S
            );
          } else if (!ball[peakKey]) {
            ball[peakKey] = true;
            const peakLx = punchSign * S * 0.14;
            const peakLz = S * 0.96;
            const wx = ball.cx + peakLx * Math.cos(_facing) + peakLz * Math.sin(_facing);
            const wy = ball.group.position.y + ball.armRestY;
            const wz = ball.cz - peakLx * Math.sin(_facing) + peakLz * Math.cos(_facing);
            for (let k = 0; k < 4; k++) addPunchTrail(wx, wy, wz, 3 * S);
            checkPunchHitBuildings(wx, wy, wz, 40, null, 1.5);
          }
          if (ball[timerKey] <= 0) armMesh.scale.setScalar(1);
        }
      }

      // ── Beast vs building: contact damage every 0.3s (only while moving) ──
      if (gameStarted && !gamePaused && ball.beastMoving) {
        ball.beastHitTimer = Math.max(0, ball.beastHitTimer - dtSec);
        if (ball.beastHitTimer <= 0) {
          let hitAny = false;
          for (let bi = buildings.length - 1; bi >= 0; bi--) {
            const b   = buildings[bi];
            const hw  = b.w / 2, hd = b.d / 2;
            const nearX = clamp(ball.cx, b.x - hw, b.x + hw);
            const nearZ = clamp(ball.cz, b.z - hd, b.z + hd);
            const dx = ball.cx - nearX, dz = ball.cz - nearZ;
            if (dx * dx + dz * dz > (ball.R + 0.1) * (ball.R + 0.1)) continue;

            hitAny = true;
            const wy = clamp(ball.group.position.y, b.mesh.position.y - b.h / 2, b.mesh.position.y + b.h / 2);
            b.hp -= 20;
            if (b.hp <= 0) {
              spawnBuildingDestroyDebris(b.x, b.mesh.position.y, b.z, b.w, b.h, b.d, b.origColor);
              spawnPedsAtBuilding(b.x, b.z, b.hpMax);
              tryDropItem(b.x, b.h / 2, b.z, b.hpMax);
              _disposeBuilding(b);
              buildings.splice(bi, 1);
            } else {
              _updateSink(b);
              spawnBuildingHitDebris(nearX, wy, nearZ, b.origColor);
              _updateHpLabel(b);
              b.mesh.material.color.set(0xffffff);
              b.flashTimer = BUILDING_FLASH_DUR;
              b.mesh.position.x = b.x; b.mesh.position.z = b.z;
              b.shakeTimer = BUILDING_SHAKE_DUR;
              b.shakeAmp   = 0.2; // 20 dmg × 0.01
            }
          }
          if (hitAny) ball.beastHitTimer = 0.3;
        }
      }

      // ── Life bar: position + fill + warning flash ─────────────────────
      const lifePct = ball.life / _FUSION_BALL_LIFE_MAX;
      ball.lifeInner.style.width = (lifePct * 100) + '%';
      if (lifePct < 0.3 && ball.life > 0) {
        ball.lifeFlashTimer -= dtSec;
        if (ball.lifeFlashTimer <= 0) {
          ball.lifeFlashing    = !ball.lifeFlashing;
          ball.lifeFlashTimer  = 0.12;
        }
        ball.lifeInner.style.opacity    = ball.lifeFlashing ? '0.1' : '1';
        ball.lifeInner.style.background = '#ff4422';
      } else {
        ball.lifeInner.style.opacity    = '1';
        ball.lifeInner.style.background = lifePct < 0.3 ? '#ff4422' : '#ffcc00';
      }
      _fusionVec.set(ball.group.position.x, ball.group.position.y + ball.R + 0.6, ball.group.position.z).project(camera);
      ball.lifeWrap.style.left = ((_fusionVec.x *  0.5 + 0.5) * window.innerWidth)  + 'px';
      ball.lifeWrap.style.top  = ((_fusionVec.y * -0.5 + 0.5) * window.innerHeight - 44) + 'px';

      if (ball.life > 0) continue;

      // ── Timer expired: start dispersal ────────────────────────────────
      ball.dispersing      = true;
      ball.disperseTimer   = 0;
      ball.dispDurA        = 0.40 + Math.random() * 0.40; // piA random 0.40–0.80s
      ball.dispDurB        = 0.40 + Math.random() * 0.40; // piB random 0.40–0.80s
      ball.armTimerA       = 0;  ball.armTimerB   = 0;
      ball.armPeakA        = false; ball.armPeakB  = false;
      ball.beastMoving     = false;
      ball.beastFlashTimer = 0;
      ball.lifeFlashTimer  = 0;  ball.lifeFlashing = false;
      ball.allMats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
      ball.group.visible = false;
      ball.lifeWrap.style.display = 'none';
      spawnFusionSmokeBurst(ball.cx, ball.cz);

      // Pick angleA freely; re-roll angleB until angle diff > 20°
      const angleA = Math.random() * Math.PI * 2;
      let angleB;
      do {
        angleB = Math.random() * Math.PI * 2;
        let diff = Math.abs(angleA - angleB);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > 20 * Math.PI / 180) break;
      } while (true);

      for (const [angle, rpi] of [[angleA, ball.piA], [angleB, ball.piB]]) {
        const p = players[rpi];
        p.fusingStartX  = ball.cx; p.fusingStartZ  = ball.cz;
        p.fusingTargetX = clamp(ball.cx + Math.cos(angle) * 3, -AREA + BODY_RADIUS, AREA - BODY_RADIUS);
        p.fusingTargetZ = clamp(ball.cz + Math.sin(angle) * 3, -AREA + BODY_RADIUS, MOVE_Z_MAX - BODY_RADIUS);
        p.x = ball.cx; p.z = ball.cz;
        p.fusingPhase = 'dispersing';
        p.group.position.set(p.x, 0, p.z);
        p.group.visible = true;
      }
    }
  }
  
  function updateTimerPenalty(dt) {
    for (let i = _penaltyItems.length - 1; i >= 0; i--) {
      const item = _penaltyItems[i];
      item.timer -= dt;
      if (item.phase === 'show' && item.timer <= 0) {
        item.phase = 'fade';
        item.timer = 0.4;
      }
      if (item.phase === 'fade') {
        item.offsetY += 50 * dt;
        const frac = Math.max(0, item.timer / 0.4);
        item.el.style.opacity = frac.toFixed(3);
        item.el.style.transform = `translateY(calc(-50% - ${item.offsetY.toFixed(1)}px))`;
        if (item.timer <= 0) {
          item.el.remove();
          _penaltyItems.splice(i, 1);
        }
      }
    }
  }
  
  // ── Player reset helpers ───────────────────────────────────────────────
  function resetPlayerLimbs(p) {
    p.armL.position.set(-0.60, 0.46, 0.08);
    p.armR.position.set( 0.60, 0.46, 0.08);
    p.footL.position.set(-0.24, 0.15, 0.04);
    p.footR.position.set( 0.24, 0.15, 0.04);
    p.armL.scale.setScalar(1);
    p.armR.scale.setScalar(1);
  }
  
  // Reset player to their PLAYER_INIT spawn position.
  // Pass preserveDeathCount=true to keep escalating respawn times across a session.
  function resetPlayerToInit(i, preserveDeathCount) {
    const p    = players[i];
    const init = PLAYER_INIT[i];
    p.x = init.x; p.z = init.z;
    p.facing = Math.PI; p.moving = false;
    p.bounceTimer = 0; p.bounceDuration = BOUNCE_DURATION;
    p.knockbackX = 0;  p.knockbackZ = 0;
    p.active = true;   p.isDead = false;  p.inBubble = false;
    if (!preserveDeathCount) p.deathCount = 0;
    p.deathTimer = 0;  p.deathStartFacing = 0;
    p.deathFlashTimer = 0; p.deathFlashing = false;
    p.isDashing = false; p.dashTimer = 0; p.dashCooldown = 0;
    p.isAttacking = false; p.attackTimer = 0; p.attackCooldown = 0;
    p.attackArm = 0; p.isHeavyPunch = false; p.punchPeakSpawned = false;
    p.comboCount = 0; p.comboTimer = 0;
    p.fusedWith = null; p.fusionTimer = 0;
    p.fusingWith = null; p.fusingPhase = null; p.fusingTimer = 0;
    p.group.visible = true;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.set(0, Math.PI, 0);
    resetPlayerLimbs(p);
  }
  
  // Full game world reset — call from quit, play-again, and any future restart path.
  function resetGame() {
    _resetCombo(true);
    _timerEl.classList.remove('urgent');
    players.forEach((p, i) => { p.group.visible = true; resetPlayerToInit(i, false); });
    _penaltyItems.forEach(item => item.el.remove());
    _penaltyItems.length = 0;
    resetLevel();
    resetBuildings();
    resetMountains();
    resetPatches();
    resetFlames();
    resetEffects();
    resetItems();
    resetHPBars();
    resetBubbles();
    resetPedestrians();
    _resetDuoValues();
    _duoRings.forEach(r => { r.mesh.visible = false; r.flashTimer = 0; r.colorIdx = 0; r.scaleTimer = 0; r.wasHeld = false; r.mesh.scale.setScalar(1); });
    for (const ball of _fusionBalls) { scene.remove(ball.group); ball.allGeos.forEach(g => g.dispose()); ball.allMats.forEach(m => m.dispose()); ball.lifeWrap.remove(); }
    _fusionBalls.length = 0;
  }
  
  // ── Time picker (start screen) ─────────────────────────────────────────
  function updateTimerDisplay() {
    _timerEl.textContent = chosenDuration;
  }
  
  function setPickerButtonsVisible(visible) {
    const d = visible ? 'flex' : 'none';
    document.getElementById('btn-time-minus').style.display = d;
    document.getElementById('btn-time-plus').style.display  = d;
  }
  updateTimerDisplay();
  
  document.getElementById('btn-time-plus').addEventListener('click', () => {
    chosenDuration += 10;
    updateTimerDisplay();
  });
  document.getElementById('btn-time-minus').addEventListener('click', () => {
    chosenDuration = Math.max(10, chosenDuration - 10);
    updateTimerDisplay();
  });
  
  // ── Start button ───────────────────────────────────────────────────────
  document.getElementById('btn-start').addEventListener('click', () => {
    // Mark active players; hide inactive characters and their HP bars
    players.forEach((p, i) => {
      p.active = playerBindings[i] !== null;
      p.group.visible = p.active;
      if (!p.active) hpBars[i].wrap.style.display = 'none';
    });
    
    timeRemaining  = chosenDuration;
    graceRemaining = GRACE_PERIOD;
    gameStarted    = true;
    gamePaused     = false;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('btn-pause').style.display    = 'flex';
    document.getElementById('distance').style.display     = 'flex';
    _duoBarEls.forEach((el, i) => { el.style.display = players[i].active ? '' : 'none'; });
    if (players[0].active || players[1].active) _duoLeftEl.style.display  = 'flex';
    if (players[2].active || players[3].active) _duoRightEl.style.display = 'flex';
    _ultraBarEl.style.display = 'flex';
    setPickerButtonsVisible(false);
  });
  
  // ── Pause / Resume / Quit ──────────────────────────────────────────────
  function pauseGame() {
    if (!gameStarted || gamePaused) return;
    gamePaused = true;
    document.getElementById('pause-screen').style.display = 'flex';
  }
  function resumeGame() {
    if (!gamePaused) return;
    gamePaused = false;
    prevTime   = performance.now(); // reset dt so no time jump on resume
    document.getElementById('pause-screen').style.display = 'none';
  }
  
  document.getElementById('btn-pause').addEventListener('click', pauseGame);
  document.getElementById('btn-resume').addEventListener('click', resumeGame);
  document.getElementById('btn-quit').addEventListener('click', () => {
    // full reset back to start screen
    gameStarted = false;
    gamePaused  = false;
    timeRemaining  = chosenDuration;
    graceRemaining = 0;
    _timerEl.textContent = chosenDuration;
    document.getElementById('pause-screen').style.display  = 'none';
    document.getElementById('btn-pause').style.display     = 'none';
    document.getElementById('distance').style.display      = 'none';
    _duoLeftEl.style.display  = 'none';
    _duoRightEl.style.display = 'none';
    _ultraBarEl.style.display = 'none';
    setPickerButtonsVisible(true);
    
    resetGame();
    resetBindings();
    document.getElementById('start-screen').style.display = 'flex';
  });
  
  // Esc = toggle pause / resume
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (gamePaused) resumeGame(); else pauseGame();
  });
  
  // ── Play Again ─────────────────────────────────────────────────────────
  document.getElementById('btn-again').addEventListener('click', () => {
    // Reset game state
    timeRemaining  = chosenDuration;
    graceRemaining = 0;
    _timerEl.textContent = chosenDuration;
    document.getElementById('gameover-screen').style.display = 'none';
    document.getElementById('btn-pause').style.display       = 'none';
    document.getElementById('distance').style.display        = 'none';
    _duoLeftEl.style.display  = 'none';
    _duoRightEl.style.display = 'none';
    _ultraBarEl.style.display = 'none';
    setPickerButtonsVisible(true);
    
    resetGame();
    resetBindings();
    
    // Show start screen again
    document.getElementById('start-screen').style.display = 'flex';
  });
  
  // ── Fullscreen ─────────────────────────────────────────────────────────
  document.getElementById('btn-fs').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('btn-fs').textContent = document.fullscreenElement ? '✕' : '⛶';
  });
  
  loop();
  
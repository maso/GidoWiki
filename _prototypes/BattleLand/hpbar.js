// ── Constants ──────────────────────────────────────────────────────────
// HP_MAX is defined in constants.js
const BAR_W        = 56;
const BAR_H        = 7;
const BAR_Y_OFFSET = -36;
const PIE_R        = 8;   // pie chart radius in px (diameter = 16px)

// INVINCIBLE_SEC is defined in constants.js
const FLASH_INTERVAL = 0.06;  // seconds per white flash toggle

// ── HP bar DOM elements ────────────────────────────────────────────────
const hpBars = players.map(() => {
  const wrap = document.createElement('div');
  wrap.style.cssText = `
    position: absolute;
    width: ${BAR_W}px;
    pointer-events: none;
    transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; gap: 1px;
  `;
  const outer = document.createElement('div');
  outer.style.cssText = `
    width: ${BAR_W}px; height: ${BAR_H}px;
    background: rgba(0,0,0,0.45);
    border-radius: 4px; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.25);
  `;
  const inner = document.createElement('div');
  inner.style.cssText = `
    width: 100%; height: 100%;
    background: #44dd44;
    border-radius: 3px;
    transition: width 0.1s linear, background 0.3s;
  `;
  outer.appendChild(inner);
  wrap.appendChild(outer);

  // ── Dash cooldown pie (canvas to the left of the bar) ─────────────────
  const pieCanvas = document.createElement('canvas');
  const pieD = PIE_R * 2;
  pieCanvas.width  = pieD;
  pieCanvas.height = pieD;
  pieCanvas.style.cssText = `
    position: absolute;
    right: calc(100% + 3px);
    top: 50%;
    transform-origin: right center;
    transform: translateY(-50%) scale(0.55);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  wrap.appendChild(pieCanvas);

  document.getElementById('ui').appendChild(wrap);
  return { wrap, inner, pieCanvas, pieCtx: pieCanvas.getContext('2d'), pieState: 'ready', invTimer: 0, flashTimer: 0, flashing: false, isRespawnFlash: false };
});

// ── Death / respawn events ─────────────────────────────────────────────
function triggerDeath(pi) {
  const p = players[pi];
  if (!p.active || p.isDead) return;
  p.isDead      = true;
  p.deathCount += 1;
  p.deathTimer  = 0;
  p.bounceTimer = 0;
  p.knockbackX  = 0;
  p.knockbackZ  = 0;

  p.deathStartFacing = p.group.rotation.y;
  p.deathFlashTimer  = 0;
  p.deathFlashing    = false;

  const bar = hpBars[pi];
  bar.invTimer   = 0;
  bar.flashTimer = 0;
  bar.flashing   = false;
  setFlash(pi, false);
  bar.wrap.style.display = 'none'; // hide HP bar while dead
  reduceDuoValue(pi, DUO_MAX); // death resets duo to zero

  // Spawn 10 pedestrians at the death location
  for (let _i = 0; _i < 10; _i++) _spawnAtPos(p.x, p.z);
}

function respawnPlayer(pi) {
  const bar = hpBars[pi];
  players[pi].hp      = HP_MAX;
  players[pi].killStreak = 0;
  _updateScoreLabel(pi);
  bar.invTimer        = RESPAWN_INVINCIBLE;
  bar.flashTimer      = 0;
  bar.flashing        = false;
  bar.isRespawnFlash  = true;
  bar.inner.classList.remove('hp-bar-danger');
  bar.inner.style.width      = '100%';
  bar.inner.style.background = '#44dd44';
  bar.wrap.style.display     = '';  // show HP bar again
  setFlash(pi, false);
  setOpacity(pi, 1);
  _origColors[pi] = players[pi].bodyMats.map(m => m.color.clone());
}

// ── Damage event ───────────────────────────────────────────────────────
// takeDamage(playerIndex, amount, originX, originZ)
//   playerIndex : which player (0–3)
//   amount      : HP to subtract (positive number)
//   originX/Z   : world-space (x, z) coordinate where the damage occurred
// Returns true if damage was applied, false if player is invincible.
function takeDamage(playerIndex, amount, originX, originZ) {
  const _p = players[playerIndex];
  if (!_p.active) return false;                // inactive players don't participate
  if (_p.isDead || _p.inBubble) return false; // dead / in-bubble players ignore damage
  if (_p.fusingWith !== null) return false;   // fusing players are invincible
  const bar = hpBars[playerIndex];
  if (bar.invTimer > 0) return false;       // invincible — ignore

  _p.hp                = Math.max(0, _p.hp - amount);
  bar.invTimer         = INVINCIBLE_SEC;
  bar.flashTimer       = 0;
  bar.flashing         = false;
  bar.lastDamageOrigin = { x: originX, z: originZ };
  reduceDuoValue(playerIndex, 10);

  if (_p.hp <= 0) {
    triggerDeath(playerIndex);
    return true;
  }

  const p = players[playerIndex];

  // Slide back — distance scales with damage, no bounce animation
  const KNOCKBACK_PER_DMG = 0.06; // world units per 1 HP of damage
  let dx = p.x - originX;
  let dz = p.z - originZ;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len > 0.001) { dx /= len; dz /= len; }
  else             { dx = 0; dz = -1; }
  const slideDist = amount * KNOCKBACK_PER_DMG;
  p.x = clamp(p.x + dx * slideDist, MOVE_X_MIN, MOVE_X_MAX);
  p.z = clamp(p.z + dz * slideDist, MOVE_Z_MIN, MOVE_Z_MAX);
  p.knockbackX = 0;
  p.knockbackZ = 0;
  p.bounceTimer = 0;

  return true;
}

// ── Punch hit detection vs enemy players ──────────────────────────────
// wx/wz   : fist world position (XZ plane)
// damage  : HP to deal
// attackerPi : index of the attacking player
// hitSet  : optional Set of player indices already hit this swing (heavy punch dual-fist)
// Returns true if at least one player was hit.
function checkPunchHitPlayers(wx, wz, damage, attackerPi, hitSet = null) {
  const attacker = players[attackerPi];
  let didHit = false;
  for (let ti = 0; ti < players.length; ti++) {
    if (ti === attackerPi) continue;
    const target = players[ti];
    if (!target.active || target.isDead || target.inBubble) continue;
    if (target.team === attacker.team) continue; // no friendly fire
    if (hitSet && hitSet.has(ti)) continue;
    const dx = wx - target.x, dz = wz - target.z;
    if (dx * dx + dz * dz > (_PUNCH_HIT_RADIUS + BODY_RADIUS) ** 2) continue;
    if (hitSet) hitSet.add(ti);
    // Killer crit: triggers when target HP is below 30%, regardless of killing blow.
    // On crit, target HP is forced to 0 and they blast away.
    const _killerCritChance = duoValues[attackerPi] >= DUO_MAX ? 0.4 : 0.2;
    const isKillerCrit = attacker.role === 'Killer'
      && target.hp / HP_MAX < 0.3
      && Math.random() < _killerCritChance;
    if (isKillerCrit) {
      const dxRaw = target.x - wx;
      const dzRaw = target.z - wz;
      const len   = Math.sqrt(dxRaw * dxRaw + dzRaw * dzRaw);
      target.blastAway = true;
      target.blastDirX = len > 0.001 ? dxRaw / len : Math.sin(attacker.facing);
      target.blastDirZ = len > 0.001 ? dzRaw / len : Math.cos(attacker.facing);
      spawnCriticalHit(wx, target.group.position.y + 0.7, wz);
      // Force damage to kill: pass target's full HP so it drops to 0
      // blastHoverDur = 2 + killStreak after this kill (capped at 10)
      target.blastHoverDur = Math.min(10, 2 + (attacker.killStreak + 1));
      if (takeDamage(ti, target.hp, wx, wz)) {
        didHit = true;
        attacker.killFreezeTimer = DEATH_FLOAT_DUR;
        if (attacker.role === 'Killer') { attacker.killStreak++; _updateScoreLabel(attackerPi); }
      } else {
        target.blastAway = false; // invincible — clear flag
      }
    } else if (takeDamage(ti, damage, wx, wz)) {
      didHit = true;
      if (target.isDead) {
        attacker.killFreezeTimer = DEATH_FLOAT_DUR;
        if (attacker.role === 'Killer') { attacker.killStreak++; _updateScoreLabel(attackerPi); }
      } else {
        attacker.attackFreezeTimer = attackFreezeTimer;
      }
    }
  }
  return didHit;
}

// ── 3D → screen projection ─────────────────────────────────────────────
// Reused every frame — never allocate a new Vector3 in the update loop.
const _vec = new THREE.Vector3();

// ── Apply / clear white flash to all body materials ────────────────────
const WHITE_COLOR    = new THREE.Color(0xffffff);
const _origColors    = players.map(p =>
  p.bodyMats.map(m => m.color.clone())
);

function setFlash(pi, on) {
  const p = players[pi];
  p.bodyMats.forEach((m, mi) => {
    m.color.set(on ? WHITE_COLOR : _origColors[pi][mi]);
  });
  p.ghostMats.forEach((m, mi) => {
    m.color.set(on ? WHITE_COLOR : _origColors[pi][mi]);
  });
}

function setOpacity(pi, opacity) {
  const p = players[pi];
  const mats = [...p.bodyMats, p.footMat];
  mats.forEach(m => {
    const wasTransparent = m.transparent;
    m.transparent = opacity < 1;
    m.opacity = opacity;
    if (m.transparent !== wasTransparent) m.needsUpdate = true;
  });
  // Scale ghost opacity proportionally so it also fades during respawn flash
  const ghostOpacity = opacity * 0.35;
  p.ghostMats.forEach(m => { m.opacity = ghostOpacity; });
}

// ── Per-frame update ───────────────────────────────────────────────────
function updateHPBars(elapsedSec) {
  players.forEach((p, i) => {
    if (!p.active || p.isDead) return; // inactive / dead: skip
    const bar = hpBars[i];

    // Hide bar + pie during fusion animation; restore when done
    if (p.fusingWith !== null) {
      bar.wrap.style.display = 'none';
      return;
    } else if (bar.wrap.style.display === 'none' && !p.isDead) {
      bar.wrap.style.display = '';
    }

    // ── Invincibility + flash tick ─────────────────────────────────────
    if (bar.invTimer > 0) {
      bar.invTimer   -= elapsedSec;
      bar.flashTimer -= elapsedSec;

      if (bar.flashTimer <= 0) {
        bar.flashing   = !bar.flashing;
        bar.flashTimer = FLASH_INTERVAL;
        if (bar.isRespawnFlash) {
          setOpacity(i, bar.flashing ? 0.1 : 1);
        } else {
          setFlash(i, bar.flashing);
        }
      }

      if (bar.invTimer <= 0) {
        // invincibility ended — restore original colours and opacity
        bar.invTimer        = 0;
        bar.flashing        = false;
        bar.isRespawnFlash  = false;
        setFlash(i, false);
        setOpacity(i, 1);
        _origColors[i] = p.bodyMats.map(m => m.color.clone());
      }
    }

    // ── HP bar visual ──────────────────────────────────────────────────
    const pct = p.hp / HP_MAX;
    const inDanger = pct < 0.3;
    bar.inner.classList.toggle('hp-bar-danger', inDanger);
    bar.inner.style.background = inDanger ? '' : '#44dd44'; // clear inline so CSS animation takes over
    bar.inner.style.width = (pct * 100) + '%';

    // ── Dash cooldown pie ──────────────────────────────────────────────
    // Always visible: small blue circle when ready, full-size wedge during cooldown.
    {
      const cd  = p.dashCooldown;
      const ctx = bar.pieCtx;
      const cx  = PIE_R, cy = PIE_R;
      // frac: 1 = cooldown just started (empty), 0 = ready (full blue)
      const frac = cd > 0 ? cd / DASH_COOLDOWN : 0;
      const filled = 1 - frac; // how much of the circle is filled

      ctx.clearRect(0, 0, PIE_R * 2, PIE_R * 2);
      // background disc
      ctx.beginPath();
      ctx.arc(cx, cy, PIE_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.50)';
      ctx.fill();
      // filled wedge (clockwise from top) — light blue
      if (filled > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, PIE_R - 1, -Math.PI / 2, -Math.PI / 2 + filled * Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 230, 100, 0.92)';
        ctx.fill();
      }

      // Three states: 'ready' (small dot), 'dashing' (hidden), 'cooldown' (full)
      const newState = p.isDashing ? 'dashing' : (cd > 0 ? 'cooldown' : 'ready');
      if (newState !== bar.pieState) {
        bar.pieState = newState;
        if (newState === 'dashing') {
          // Instantly hide
          bar.pieCanvas.style.transition = 'none';
          bar.pieCanvas.style.transform  = 'translateY(-50%) scale(0)';
        } else if (newState === 'cooldown') {
          // Dash ended → OutBack expand
          bar.pieCanvas.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
          bar.pieCanvas.style.transform  = 'translateY(-50%) scale(1)';
        } else {
          // Cooldown ended → InBack shrink to dot
          bar.pieCanvas.style.transition = 'transform 0.25s cubic-bezier(0.36, 0, 0.66, -0.56)';
          bar.pieCanvas.style.transform  = 'translateY(-50%) scale(0.55)';
        }
      }
    }

    // ── Ghost silhouette: show only when a building's front edge is in front of the player ──
    {
      const pz = p.z;
      const px = p.x;
      const BODY_R   = 0.35; // X margin — tighter to avoid edge artefacts
      const Z_MARGIN = 0.3;  // extra clearance behind building back edge before triggering ghost
      let occluded = false;
      for (let bi = 0; bi < buildings.length; bi++) {
        const b = buildings[bi];
        if (b.respawning) continue;
        const bBack = b.z - b.d / 2;
        if (pz >= bBack - Z_MARGIN) continue; // player must be clearly behind the building
        // X overlap check
        if (px < b.x - b.w / 2 - BODY_R) continue;
        if (px > b.x + b.w / 2 + BODY_R) continue;
        occluded = true;
        break;
      }
      p.ghostMeshes.forEach(gm => { gm.visible = occluded; });
    }

    // ── Position bar above character head ─────────────────────────────
    _vec.set(p.group.position.x, p.group.position.y + 1.55, p.group.position.z).project(camera);
    bar.wrap.style.left = ((_vec.x *  0.5 + 0.5) * window.innerWidth)  + 'px';
    bar.wrap.style.top  = ((_vec.y * -0.5 + 0.5) * window.innerHeight + BAR_Y_OFFSET) + 'px';
  });
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetHPBars() {
  hpBars.forEach((bar, i) => {
    players[i].hp       = HP_MAX;
    players[i].active   = true;
    bar.invTimer        = 0;
    bar.flashTimer      = 0;
    bar.flashing        = false;
    bar.isRespawnFlash  = false;
    bar.inner.classList.remove('hp-bar-danger');
    bar.inner.style.width      = '100%';
    bar.inner.style.background = '#44dd44';
    bar.wrap.style.display     = '';
    setFlash(i, false);
    setOpacity(i, 1);
    _origColors[i] = players[i].bodyMats.map(m => m.color.clone());
  });
}

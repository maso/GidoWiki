// ── Bubble respawn constants ───────────────────────────────────────────
const BUBBLE_RADIUS      = 1.1;   // world units — ~2x body radius (0.52)
const BUBBLE_HOVER_Y     = 3.8;   // height when hovering in mid-air
const BUBBLE_START_Y     = 10;    // just above camera view
const BUBBLE_DESCEND_DUR = 1.5;   // s to descend from top to hover height
const BUBBLE_HOVER_BASE  = 0;     // s on first respawn
const BUBBLE_HOVER_INC   = 0;     // s added per additional respawn
const BUBBLE_FALL_DUR    = 0.8;   // s to fall from hover to ground after pop
const BUBBLE_HP_MAX      = 3;     // hits to destroy bubble (each hit = ~33%)
const BUBBLE_STRUGGLE_DUR = 0.3;  // s per struggle animation inside bubble

// Spawn bubble this many seconds after death judgment (just after explosion)
const BUBBLE_SPAWN_DELAY = DEATH_JUMP_DUR + DEATH_FLOAT_DUR + 0.4;

// Movement bounds (ground AREA inset by one body radius)
const _BB_X     =  AREA - BODY_RADIUS;          // ±9.48
const _BB_Z_TOP = -(AREA - BODY_RADIUS);         // –9.48 (top of field)
const _BB_Z_BOT =  MOVE_Z_MAX - BODY_RADIUS;      //  6.98 (bottom of play field)
const BUBBLE_MOVE_SPD = SPD * 60;               // same ground speed in world-units/s

// ── Easing ─────────────────────────────────────────────────────────────
function _easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Character shadow toggle ────────────────────────────────────────────
function _setCharacterShadow(pi, enabled) {
  players[pi].group.traverse(obj => {
    if (obj.isMesh) obj.castShadow = enabled;
  });
}

// ── Bubble pop particles ───────────────────────────────────────────────
const _popParticles = [];
const _popGeo = new THREE.SphereGeometry(0.10, 8, 6);

function _spawnBubblePop(x, y, z) {
  const COUNT = 18;
  for (let i = 0; i < COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.9, depthWrite: false,
    });
    const mesh = new THREE.Mesh(_popGeo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI;
    const spd   = 2.5 + Math.random() * 3.5;
    _popParticles.push({
      mesh,
      vx: Math.sin(phi) * Math.cos(theta) * spd,
      vy: Math.sin(phi) * Math.sin(theta) * spd,
      vz: Math.cos(phi) * spd,
      life: 0.5 + Math.random() * 0.3,
      maxLife: 0,
    });
    _popParticles[_popParticles.length - 1].maxLife = _popParticles[_popParticles.length - 1].life;
  }
}

function _updatePopParticles(dt) {
  for (let i = _popParticles.length - 1; i >= 0; i--) {
    const pt = _popParticles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      scene.remove(pt.mesh);
      pt.mesh.material.dispose();
      _popParticles.splice(i, 1);
      continue;
    }
    pt.mesh.position.x += pt.vx * dt;
    pt.mesh.position.y += pt.vy * dt;
    pt.mesh.position.z += pt.vz * dt;
    pt.vy -= 4 * dt; // gentle gravity
    pt.mesh.material.opacity = (pt.life / pt.maxLife) * 0.9;
    const s = pt.life / pt.maxLife;
    pt.mesh.scale.setScalar(s);
  }
}

// ── Shared X-marker texture (unsafe-landing indicator on shadow) ───────
const _xMarkerCanvas = document.createElement('canvas');
_xMarkerCanvas.width = _xMarkerCanvas.height = 128;
{
  const ctx = _xMarkerCanvas.getContext('2d');
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth   = 20;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 18); ctx.lineTo(110, 110);
  ctx.moveTo(110, 18); ctx.lineTo(18, 110);
  ctx.stroke();
}
const _xMarkerTex = new THREE.CanvasTexture(_xMarkerCanvas);
const _xMarkerMat = new THREE.MeshBasicMaterial({
  map: _xMarkerTex, transparent: true, opacity: 0.6, depthWrite: false,
});

// ── Per-player bubble state ────────────────────────────────────────────
const bubbles = [];

function initBubbles() {
  players.forEach(() => {
    const b = {
      active:    false,
      phase:     'none',   // 'descending' | 'hovering' | 'falling'
      phaseTimer: 0,
      x: 0, z: 0, y: BUBBLE_START_Y,
      targetX: 0, targetZ: 0, // input-driven target; bubble lerps toward it
      hp:           BUBBLE_HP_MAX,
      hoverDur:     BUBBLE_HOVER_BASE, // set on activation from player's deathCount
      struggleTimer: 0,        // > 0 = currently playing struggle anim
      gpAttackPrev: false,     // previous frame gamepad button 2 (X) state
      mesh:        null,
      shadowMesh:  null,
      xMarker:     null,
      dropLine:    null,
      labelSprite: null,
      labelCanvas: null,
      labelTex:    null,
      lastCount:   -1,
    };

    // ── Bubble sphere ──────────────────────────────────────────────────
    b.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(BUBBLE_RADIUS, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0xaaddff, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    b.mesh.visible = false;
    scene.add(b.mesh);

    // ── Ground shadow ──────────────────────────────────────────────────
    b.shadowMesh = new THREE.Mesh(
      new THREE.CircleGeometry(BUBBLE_RADIUS * 0.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false,
      })
    );
    b.shadowMesh.rotation.x = -Math.PI / 2;
    b.shadowMesh.position.y = 0.015;
    b.shadowMesh.visible = false;
    scene.add(b.shadowMesh);

    // ── Countdown label sprite ─────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    b.labelCanvas = canvas;
    b.labelTex = new THREE.CanvasTexture(canvas);
    b.labelSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: b.labelTex, transparent: true, depthTest: false })
    );
    b.labelSprite.scale.set(1.6, 1.6, 1);
    b.labelSprite.renderOrder = 999;
    b.labelSprite.visible = false;
    scene.add(b.labelSprite);

    // ── Drop line — white dashed line from bubble bottom to ground ────
    // Geometry is fixed (local Y: 0 at top, -lineHeight at bottom).
    // Only the mesh position is updated each frame — no geometry rewrites.
    {
      const _lineHeight = BUBBLE_HOVER_Y - BUBBLE_RADIUS - 0.02;
      const _linePos = new Float32Array([0, 0, 0,  0, -_lineHeight, 0]);
      const _lineGeo = new THREE.BufferGeometry();
      _lineGeo.setAttribute('position', new THREE.BufferAttribute(_linePos, 3));
      b.dropLine = new THREE.Line(
        _lineGeo,
        new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.22, gapSize: 0.14, linewidth: 3 })
      );
      b.dropLine.computeLineDistances(); // once — geometry never changes
      b.dropLine.visible = false;
      scene.add(b.dropLine);
    }

    // ── X-marker (unsafe landing) ──────────────────────────────────────
    const xSize = BUBBLE_RADIUS * 0.8;
    b.xMarker = new THREE.Mesh(
      new THREE.PlaneGeometry(xSize, xSize),
      _xMarkerMat
    );
    b.xMarker.rotation.x = -Math.PI / 2;
    b.xMarker.visible = false;
    scene.add(b.xMarker);

    bubbles.push(b);
  });
}

function _drawLabel(b, count) {
  if (b.lastCount === count) return;
  b.lastCount = count;
  if (count === 0) {
    b.labelSprite.visible = false;
    return;
  }
  b.labelSprite.visible = true;
  const ctx = b.labelCanvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = 'bold 78px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(String(count), 66, 66);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(count), 64, 64);
  b.labelTex.needsUpdate = true;
}

function _activateBubble(pi) {
  const b = bubbles[pi];
  const p = players[pi];

  // Spawn at the player's initial position
  const spawnX = PLAYER_INIT[pi].x;
  const spawnZ = PLAYER_INIT[pi].z;

  b.active       = true;
  b.phase        = 'descending';
  b.phaseTimer   = 0;
  b.hoverDur     = p.blastAway
    ? p.blastHoverDur
    : BUBBLE_HOVER_BASE + Math.max(0, p.deathCount - 1) * BUBBLE_HOVER_INC;
  b.x            = spawnX;
  b.z            = spawnZ;
  b.targetX      = spawnX;
  b.targetZ      = spawnZ;
  b.y            = BUBBLE_START_Y;
  b.lastCount    = -1;
  b.hp           = BUBBLE_HP_MAX;
  b.struggleTimer = 0;
  b.gpAttackPrev  = false;

  p.inBubble        = true;
  p.group.visible   = true;
  p.group.rotation.set(0, 0, 0);
  _setCharacterShadow(pi, false); // hide character shadow — bubble has its own
  setOpacity(pi, 0.5);            // semi-transparent while inside bubble

  b.mesh.position.set(b.x, b.y, b.z);
  b.mesh.visible = true;
  b.shadowMesh.position.set(b.x, 0.015, b.z);
  b.shadowMesh.visible = true;
  b.labelSprite.position.set(b.x, b.y - 0.9, b.z);
  b.labelSprite.material.opacity = 1;
  b.labelSprite.visible = true;
  _drawLabel(b, b.hoverDur);
}

// ── Pop bubble (shared by timeout + HP==0) ────────────────────────────
function _popBubble(b, p) {
  _spawnBubblePop(b.x, b.y, b.z);
  b.phase               = 'falling';
  b.phaseTimer          = 0;
  b.mesh.visible        = false;
  b.labelSprite.visible = false;
  b.dropLine.visible    = false;
  // Find a clear landing spot before falling (avoids buildings / players / bubbles)
  const pi   = bubbles.indexOf(b);
  const safe = findSafeLandingPos(b.x, b.z, pi);
  b.targetX = safe.x;
  b.targetZ = safe.z;
  p.group.position.set(b.x, BUBBLE_HOVER_Y, b.z);
}

// ── Per-frame update ───────────────────────────────────────────────────
function updateBubbles(dt) {
  _updatePopParticles(dt);

  bubbles.forEach((b, pi) => {
    const p = players[pi];

    // Activate bubble once death anim is done.
    // Blast-away deaths take longer (flash + fly), so wait for the full duration.
    const _spawnDelay = p.blastAway
      ? DEATH_FLOAT_DUR + BLAST_FLY_DUR + 0.1
      : BUBBLE_SPAWN_DELAY;
    if (p.isDead && !p.inBubble && !b.active &&
        p.deathTimer >= _spawnDelay) {
      _activateBubble(pi);
      return;
    }

    if (!b.active) return;

    b.phaseTimer += dt;
    let landingOk = false; // computed during hovering; reused for shadow/X-marker below

    if (b.phase === 'descending') {
      const t    = Math.min(1, b.phaseTimer / BUBBLE_DESCEND_DUR);
      const ease = _easeOutBack(t);
      b.y = BUBBLE_START_Y + (BUBBLE_HOVER_Y - BUBBLE_START_Y) * ease;
      if (t >= 1) {
        b.phase      = 'hovering';
        b.phaseTimer = 0;
        b.y          = BUBBLE_HOVER_Y;
      }

    } else if (b.phase === 'hovering') {
      // Auto-pop when countdown expires
      if (b.phaseTimer >= b.hoverDur) {
        _popBubble(b, p);
        return;
      }

      const remaining = Math.max(0, b.hoverDur - b.phaseTimer);
      _drawLabel(b, Math.ceil(remaining));

      landingOk = _isLandingFree(b.x, b.z, pi);

    } else if (b.phase === 'falling') {
      b.x += (b.targetX - b.x) * (1 - Math.pow(0.001, dt));
      b.z += (b.targetZ - b.z) * (1 - Math.pow(0.001, dt));

      const t = Math.min(1, b.phaseTimer / BUBBLE_FALL_DUR);
      const y = Math.max(0, BUBBLE_HOVER_Y * (1 - easeOutBounce(t)));
      p.group.position.set(b.x, y, b.z);
      p.group.rotation.set(0, 0, 0);

      // Keep shadow visible and tracking during fall
      b.shadowMesh.position.set(b.x, 0.015, b.z);
      b.shadowMesh.material.opacity = 0.22;

      if (t >= 1) {
        // Landed — restore character shadow and opacity
        _setCharacterShadow(pi, true);
        setOpacity(pi, 1);
        b.active             = false;
        b.phase              = 'none';
        b.shadowMesh.visible = false;
        b.xMarker.visible    = false;

        p.x = b.x; p.z = b.z;
        p.facing = 0; p.moving = false;
        p.bounceTimer = 0; p.bounceDuration = BOUNCE_DURATION;
        p.knockbackX = 0; p.knockbackZ = 0;
        p.isDead = false; p.inBubble = false;
        p.blastAway = false; p.blastDirX = 0; p.blastDirZ = 0;
        p.deathTimer = 0; p.deathFlashTimer = 0; p.deathFlashing = false;
        p.group.position.set(p.x, 0, p.z);
        p.group.rotation.set(0, 0, 0);
        resetPlayerLimbs(p);
        respawnPlayer(pi);
        return;
      }
    }

    // Sync mesh positions (descending + hovering)
    if (b.phase === 'descending' || b.phase === 'hovering') {
      b.mesh.position.set(b.x, b.y, b.z);
      b.shadowMesh.position.set(b.x, 0.015, b.z);
      b.xMarker.position.set(b.x, 0.02, b.z);
      b.labelSprite.position.set(b.x, b.y - 0.9, b.z);

      // Shadow grows from 0→full as bubble descends, and fades with height
      const heightFrac  = Math.min(1, (b.y - BUBBLE_HOVER_Y) / (BUBBLE_START_Y - BUBBLE_HOVER_Y));
      const shadowBase  = 0.22 * (1 - heightFrac * 0.7);
      const shadowScale = b.phase === 'descending' ? (1 - heightFrac) : 1;

      // Dark-red shadow + X marker only when hovering with landing blocked
      const landingBlocked = b.phase === 'hovering' && !landingOk;
      b.shadowMesh.material.opacity = shadowBase;
      b.shadowMesh.material.color.set(landingBlocked ? 0x660000 : 0x000000);
      b.shadowMesh.scale.setScalar(shadowScale);
      b.xMarker.visible = landingBlocked;

      // Drop line: only visible at fixed hover height — just move the mesh
      b.dropLine.visible = b.phase === 'hovering';
      if (b.phase === 'hovering') {
        b.dropLine.position.set(b.x, BUBBLE_HOVER_Y - BUBBLE_RADIUS, b.z);
      }

      // Character sits inside bubble, slightly below center
      p.group.position.set(b.x, b.y - 0.3, b.z);
    }
  });
}

function _applyBubbleInput(pi, dt) {
  const b = bubbles[pi];
  let dx = 0, dz = 0;

  const _binding = playerBindings[pi];
  if (_binding && _binding.type === 'keyboard') {
    if (keys['w'] || keys['W']) dz -= BUBBLE_MOVE_SPD * dt;
    if (keys['s'] || keys['S']) dz += BUBBLE_MOVE_SPD * dt;
    if (keys['a'] || keys['A']) dx -= BUBBLE_MOVE_SPD * dt;
    if (keys['d'] || keys['D']) dx += BUBBLE_MOVE_SPD * dt;
  } else if (_binding && _binding.type === 'gamepad') {
    const gp = navigator.getGamepads()[_binding.gpIndex];
    if (gp) {
      dx = applyDeadzone(gp.axes[0]) * BUBBLE_MOVE_SPD * dt;
      dz = applyDeadzone(gp.axes[1]) * BUBBLE_MOVE_SPD * dt;
    }
  }

  b.targetX = clamp(b.targetX + dx, -_BB_X,    _BB_X);
  b.targetZ = clamp(b.targetZ + dz,  _BB_Z_TOP, _BB_Z_BOT);
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetBubbles() {
  bubbles.forEach((b, pi) => {
    if (b.active) {
      _setCharacterShadow(pi, true);
      setOpacity(pi, 1);
    }
    b.active      = false;
    b.phase       = 'none';
    b.phaseTimer  = 0;
    if (b.mesh)        b.mesh.visible        = false;
    if (b.shadowMesh)  b.shadowMesh.visible  = false;
    if (b.xMarker)     b.xMarker.visible     = false;
    if (b.dropLine)    b.dropLine.visible    = false;
    if (b.labelSprite) b.labelSprite.visible = false;
    players[pi].inBubble = false;
  });
  // Clear any leftover pop particles
  _popParticles.forEach(pt => { scene.remove(pt.mesh); pt.mesh.material.dispose(); });
  _popParticles.length = 0;
}

// Initialize once all other scripts have loaded
initBubbles();

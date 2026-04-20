// ── Building generation constants ──────────────────────────────────────
// Coordinate reference: z increases toward camera (screen bottom).
// Buildings fill z=_gZTop→_gZBot across the static arena.

const BUILDING_SPAWN_EVERY = 2; // Z interval between building groups

const BUILDING_MIN_GAP = 1.0; // minimum gap between buildings (1 grid unit)

// ── Building respawn animation ─────────────────────────────────────────
const RESPAWN_FLASH_HALF = 0.07; // seconds per flash half-period
const RESPAWN_FLAT_DUR   = 0.5;  // seconds the building stays flat before growing
const RESPAWN_GROW_DUR   = 0.5;  // seconds for Out Elastic height growth
const RESPAWN_TOTAL_DUR  = RESPAWN_FLAT_DUR + RESPAWN_GROW_DUR; // 1.0s total

// Shared geometry for all HP label planes (fixed aspect ratio 128:48)
const _HP_PLANE_GEO = new THREE.PlaneGeometry(1.2, 1.2 * 48 / 128);

// Color by team ownership (null = neutral gray)
function _colorForTeam(team) {
  if (team === 'A') return TEAM_A_BLDG_COLOR;
  if (team === 'B') return TEAM_B_BLDG_COLOR;
  return 0x909090;
}

// ── Active building list ───────────────────────────────────────────────
const buildings = [];

// Total footprint (w×d) of all buildings — set once at init, used as territory denominator
let _totalFootprint = 0;

// ── Draw HP text onto a building's roof canvas ────────────────────────
function _updateHpLabel(b) {
  const ctx = b.hpCtx;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  ctx.font = `bold ${Math.round(ch * 0.52)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${b.hp}`, cw / 2, ch / 2);
  b.hpTex.needsUpdate = true;
}

// ── Spawn one group of buildings at a given world Z ───────────────────
function _spawnGroupAt(worldZ) {
  const count  = 5 + Math.floor(Math.random() * 3); // 5–7 per group
  const placed = []; // tracks {x, w} of placed buildings in this row

  for (let attempt = 0; attempt < count * 8; attempt++) {
    if (placed.length >= count) break;

    // Integer dimensions so edges land exactly on grid lines
    const w = 1 + Math.floor(Math.random() * 3); // width  (X) : 1, 2, or 3
    const h = 1 + Math.floor(Math.random() * 2);  // height (Y) : 1 or 2
    const d = 1; // depth (Z) : fixed 1 to ensure 1-grid gap between rows

    // Grid-aligned X: snap left edge to integer, then center = leftEdge + w/2
    const minLeft = Math.ceil(-AREA + 0.3);           // leftmost valid left edge
    const maxLeft = Math.floor(AREA - w - 0.3);       // rightmost valid left edge
    if (maxLeft < minLeft) continue;
    const leftX = minLeft + Math.floor(Math.random() * (maxLeft - minLeft + 1));
    const x = leftX + w / 2;

    // Reject if gap to any already-placed building is too small
    const tooClose = placed.some(b =>
      Math.abs(b.x - x) < (b.w + w) * 0.5 + BUILDING_MIN_GAP
    );
    if (tooClose) continue;

    // Grid-aligned Z: front edge at worldZ, clamped so rear edge stays within ground
    const clampedZ = Math.min(worldZ, _gZBot - d);
    const centerZ  = clampedZ + d / 2;
    if (centerZ - d / 2 < _gZTop) continue; // front edge out of ground — skip

    // Skip reserved zones
    const bLeft = x - w / 2, bRight = x + w / 2;
    const bFront = centerZ - d / 2, bBack = centerZ + d / 2;
    // Bottom-left 4×4: x[−10,−6] × z[4,8]
    if (bLeft < -6 && bBack > 4) continue;
    // Top-right 4×4: x[6,10] × z[−10,−6]
    if (bRight > 6 && bFront < -6) continue;

    const hpMax = Math.round(w * h * d) * BUILDING_HP_PER_UNIT;
    const color = _colorForTeam(null); // neutral gray at spawn
    const mat   = new THREE.MeshLambertMaterial({ color });
    // Stencil: mark every pixel this building draws so character ghost meshes
    // can test stencil=1 to show through the building.
    mat.stencilWrite = true;
    mat.stencilRef   = 1;
    mat.stencilFunc  = THREE.AlwaysStencilFunc;
    mat.stencilZPass = THREE.ReplaceStencilOp;
    const mesh  = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, h / 2, centerZ);
    scene.add(mesh);

    // HP label — canvas texture on a flat plane lying on the roof
    const cw = 128, ch = 48;
    const hpCanvas = document.createElement('canvas');
    hpCanvas.width = cw; hpCanvas.height = ch;
    const hpCtx = hpCanvas.getContext('2d');
    const hpTex = new THREE.CanvasTexture(hpCanvas);
    const hpPlane = new THREE.Mesh(
      _HP_PLANE_GEO, // shared geometry — fixed aspect ratio 128:48
      new THREE.MeshBasicMaterial({ map: hpTex, transparent: true, depthWrite: false })
    );
    hpPlane.rotation.x = -Math.PI / 2;
    hpPlane.position.set(x, h + 0.02, centerZ);
    const _chk = document.getElementById('chk-bldg-hp');
    if (_chk && !_chk.checked) hpPlane.visible = false;
    scene.add(hpPlane);
    const bldg = {
      mesh, hpPlane, hpCtx, hpTex, x, z: centerZ, w, h, d,
      hp: hpMax, hpMax, flashTimer: 0, shakeTimer: 0, shakeAmp: 0,
      origColor: new THREE.Color(color),
      team: null,
    };
    buildings.push(bldg);
    _updateHpLabel(bldg);
    placed.push({ x, w });
  }
}

// ── Sink building mesh to reflect current HP ──────────────────────────
function _updateSink(b) {
  const ratio       = b.hp / b.hpMax;          // 1 (full) → 0 (dead)
  const aboveGround = ratio * b.h;             // height still visible above y=0
  if (aboveGround <= 1) {
    b.mesh.position.y = 1 - b.h / 2;          // clamp: keep exactly 1 unit above ground
  } else {
    b.mesh.position.y = b.h / 2 - (1 - ratio) * b.h;
  }
}

// ── Dispose a building's HP plane resources ───────────────────────────
function _disposeHpPlane(b) {
  scene.remove(b.hpPlane);
  b.hpPlane.material.dispose(); // geometry is shared — don't dispose
  b.hpTex.dispose();
}

// ── Spawn a flat (h=1) replacement building at the same footprint ─────
function _spawnRespawnBuilding(x, centerZ, w, d, team, respawnH = 1) {
  const h     = respawnH;
  const hpMax = Math.round(w * h * d) * BUILDING_HP_PER_UNIT;
  const color = _colorForTeam(team);
  const mat   = new THREE.MeshLambertMaterial({ color });
  mat.stencilWrite = true;
  mat.stencilRef   = 1;
  mat.stencilFunc  = THREE.AlwaysStencilFunc;
  mat.stencilZPass = THREE.ReplaceStencilOp;
  const mesh  = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, h / 2 * 0.1, centerZ); // starts at 0.1 height
  mesh.scale.y = 0.1;
  scene.add(mesh);

  const hpCanvas = document.createElement('canvas');
  hpCanvas.width = 128; hpCanvas.height = 48;
  const hpCtx = hpCanvas.getContext('2d');
  const hpTex = new THREE.CanvasTexture(hpCanvas);
  const hpPlane = new THREE.Mesh(
    _HP_PLANE_GEO,
    new THREE.MeshBasicMaterial({ map: hpTex, transparent: true, depthWrite: false })
  );
  hpPlane.rotation.x = -Math.PI / 2;
  hpPlane.position.set(x, h + 0.02, centerZ);
  hpPlane.visible = false; // hidden until respawn completes
  scene.add(hpPlane);

  const bldg = {
    mesh, hpPlane, hpCtx, hpTex, x, z: centerZ, w, h, d,
    hp: hpMax, hpMax, flashTimer: 0, shakeTimer: 0, shakeAmp: 0,
    origColor: new THREE.Color(color),
    team,
    respawning: true, respawnTimer: 0,
  };
  buildings.push(bldg);
  _updateHpLabel(bldg);
  recalcTerritory();
}

// ── Fully remove a building's mesh + HP plane from the scene ──────────
function _disposeBuilding(b) {
  _disposeHpPlane(b);
  scene.remove(b.mesh);
  b.mesh.geometry.dispose();
  b.mesh.material.dispose();
}

// ── Initial placement (called once before game starts) ─────────────────
function initBuildings() {
  buildings.length = 0;

  for (let z = _gZTop; z < _gZBot; z += BUILDING_SPAWN_EVERY) {
    _spawnGroupAt(z);
  }

  // Fix the total footprint as the territory denominator (constant for the whole game)
  _totalFootprint = buildings.reduce((sum, b) => sum + b.w * b.d, 0);
}

// ── Punch hit detection ────────────────────────────────────────────────
// hitSet: optional Set of building objects already damaged this swing —
// ensures a double-fist heavy punch only applies damage once per building.
const _PUNCH_HIT_RADIUS = 0.5; // world units — fist footprint for AABB test

// Returns true if at least one building was hit.
function checkPunchHitBuildings(wx, wy, wz, damage, hitSet = null, debrisScale = 1, team = null, respawnH = 1, attackerPi = null) {
  let didHit = false;
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (b.respawning) continue;                        // immune during respawn animation
    if (b.team !== null && b.team === team) continue;  // own team cannot damage own buildings
    if (hitSet && hitSet.has(b)) continue;             // already hit by the other fist this swing

    // AABB check: fist sphere vs building box
    if (wx < b.x - b.w / 2 - _PUNCH_HIT_RADIUS) continue;
    if (wx > b.x + b.w / 2 + _PUNCH_HIT_RADIUS) continue;
    if (wz < b.z - b.d / 2 - _PUNCH_HIT_RADIUS) continue;
    if (wz > b.z + b.d / 2 + _PUNCH_HIT_RADIUS) continue;
    const roofY = b.mesh.position.y + b.h / 2;
    if (wy > roofY + _PUNCH_HIT_RADIUS)           continue; // above building

    if (hitSet) hitSet.add(b);
    didHit = true;
    b.hp -= damage;

    // Builder crit: triggers when building HP drops to ≤30% of max, force HP to 0
    const _bldgCritChance = (attackerPi !== null && duoValues[attackerPi] >= DUO_MAX) ? 0.4 : 0.2;
    const _bldgCrit = b.hp > 0
      && b.hp / b.hpMax <= 0.3
      && attackerPi !== null
      && players[attackerPi].role === 'Builder'
      && Math.random() < _bldgCritChance;
    if (_bldgCrit) b.hp = 0;

    if (b.hp <= 0) {
      if (_bldgCrit) {
        spawnCriticalHit(wx, wy, wz);
        spawnBuildingFireJet(b.x, b.z, b.w, b.d);
      }
      spawnBuildingDestroyDebris(b.x, b.mesh.position.y, b.z, b.w, b.h, b.d, b.origColor, _bldgCrit);
      spawnPedsAtBuilding(b.x, b.z, b.hpMax);
      tryDropItem(b.x, b.h / 2, b.z, b.hpMax);
      const _critH = _bldgCrit && attackerPi !== null
        ? Math.min(10, Math.max(4, players[attackerPi].killStreak + 1))
        : respawnH;
      _spawnRespawnBuilding(b.x, b.z, b.w, b.d, team, _critH);
      _disposeBuilding(b);
      buildings.splice(i, 1);
      if (attackerPi !== null) {
        players[attackerPi].killFreezeTimer = DEATH_FLOAT_DUR;
        if (players[attackerPi].role === 'Builder') {
          players[attackerPi].killStreak++;
          _updateScoreLabel(attackerPi);
        }
      }
    } else {
      _updateSink(b);
      spawnBuildingHitDebris(wx, wy, wz, b.origColor, debrisScale);
      _updateHpLabel(b);
      b.mesh.material.color.set(0xffffff);
      b.flashTimer = BUILDING_FLASH_DUR;
      // Reset to base position before starting a fresh shake
      b.mesh.position.x = b.x;
      b.mesh.position.z = b.z;
      b.shakeTimer = BUILDING_SHAKE_DUR;
      b.shakeAmp   = damage * 0.01;   // 10dmg→0.1, 30dmg→0.3
      if (attackerPi !== null) players[attackerPi].attackFreezeTimer = attackFreezeTimer * 0.5;
    }
  }
  return didHit;
}

// ── Per-frame update ───────────────────────────────────────────────────
function updateBuildings(dt, dtSec) {
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];

    // ── Respawn animation (flat → grow, immune to hits) ───────────────────
    if (b.respawning) {
      b.respawnTimer += dtSec;

      // Flash: alternate white / original color
      if (Math.floor(b.respawnTimer / RESPAWN_FLASH_HALF) % 2 === 0) {
        b.mesh.material.color.set(0xffffff);
      } else {
        b.mesh.material.color.copy(b.origColor);
      }

      if (b.respawnTimer < RESPAWN_FLAT_DUR) {
        // Phase 1: stay at 0.1 height
        b.mesh.scale.y = 0.1;
        b.mesh.position.y = b.h / 2 * 0.1;
      } else {
        // Phase 2: Out Elastic height growth
        const t = Math.min(1, (b.respawnTimer - RESPAWN_FLAT_DUR) / RESPAWN_GROW_DUR);
        const s = Math.max(0.001, easeOutElastic(t));
        b.mesh.scale.y = s;
        b.mesh.position.y = b.h / 2 * s; // keeps bottom edge at y=0
      }

      if (b.respawnTimer >= RESPAWN_TOTAL_DUR) {
        // Respawn complete — snap to final state, restore HP label
        b.respawning = false;
        b.mesh.scale.y = 1;
        b.mesh.position.y = b.h / 2;
        b.mesh.material.color.copy(b.origColor);
        b.hpPlane.position.y = b.mesh.position.y + b.h / 2 + 0.02;
        const _chk = document.getElementById('chk-bldg-hp');
        if (!_chk || _chk.checked) b.hpPlane.visible = true;
      }

      continue;
    }

    // Shake tick — oscillate on X/Z axes, fade out amplitude over duration
    if (b.shakeTimer > 0) {
      b.shakeTimer -= dtSec;
      if (b.shakeTimer <= 0) {
        b.shakeTimer = 0;
        b.mesh.position.x = b.x; // snap back to rest
        b.mesh.position.z = b.z;
      } else {
        const prog    = b.shakeTimer / BUILDING_SHAKE_DUR;
        const offsetX = Math.sin(b.shakeTimer * Math.PI * 2 * 18)
                        * b.shakeAmp * prog;
        const offsetZ = Math.sin(b.shakeTimer * Math.PI * 2 * 13 + 1.0)
                        * b.shakeAmp * 0.6 * prog;
        b.mesh.position.x = b.x + offsetX;
        b.mesh.position.z = b.z + offsetZ;
      }
    }

    // White flash tick → restore original colour
    if (b.flashTimer > 0) {
      b.flashTimer -= dtSec;
      if (b.flashTimer <= 0) {
        b.flashTimer = 0;
        b.mesh.material.color.copy(b.origColor);
      }
    }

    // HP label plane follows building mesh (x/z tracks shake; y sits on roof)
    b.hpPlane.position.x = b.mesh.position.x;
    b.hpPlane.position.y = b.mesh.position.y + b.h / 2 + 0.02;
    b.hpPlane.position.z = b.mesh.position.z;

    // Arena is static — no scroll-based despawn
  }
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetBuildings() {
  buildings.forEach(b => _disposeBuilding(b));
  initBuildings(); // re-populate for the next game
}

initBuildings();

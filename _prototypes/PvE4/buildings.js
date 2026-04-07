// ── Building generation constants ──────────────────────────────────────
// Coordinate reference: z increases toward camera (screen bottom).
// Bottom of play field = z=+AREA=10. "10m clear zone from bottom" = z=0→10.
// Initial buildings fill z=−AREA→0. New buildings spawn off-screen at SPAWN_Z.

const BUILDING_SPAWN_Z    = -(AREA + 10); // z where continuous spawns appear (well off-screen above)
const BUILDING_DESPAWN_Z  =   AREA + 4;   // remove once scrolled past here
const BUILDING_CLEAR_Z    = 0;            // z=0 to z=AREA is kept clear at start
const BUILDING_SPAWN_EVERY = 5;           // spawn a new group every N metres scrolled

const BUILDING_MIN_GAP = BODY_RADIUS * 2; // minimum gap between buildings (= 1 character width)

const CANNON_FLASH_DUR        = 2.0;  // seconds of pre-launch warning flash
const CANNON_FLASH_SLOW_HALF  = 0.15; // half-period (s) for first second (normal speed)
const CANNON_FLASH_FAST_HALF  = 0.04; // half-period (s) for second second (fast)
const CANNON_LAUNCH_SPD       = 0.5;  // wu/frame at 60 fps — launch velocity toward −Z
const CANNON_BLDG_DMG         = 30;   // one-time HP dealt to a normal building on contact

// Shared geometry for all HP label planes (fixed aspect ratio 128:48)
const _HP_PLANE_GEO = new THREE.PlaneGeometry(1.2, 1.2 * 48 / 128);

// Visual palette — muted urban grays / earth tones
function _colorForHp(hp) {
  if (hp <  100) return 0x909090;       // 灰
  if (hp <  200) return 0x5a8f5a;       // 灰綠
  if (hp <  300) return 0x5a7aa0;       // 藍灰
  return         0x7a6aaa;              // 紫灰
}

// ── Active building list ───────────────────────────────────────────────
const buildings = [];

// When to next spawn (in totalScrolled metres)
let _nextSpawnAt = BUILDING_SPAWN_EVERY;

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
  const count  = 2 + Math.floor(Math.random() * 3); // 2–4 per group
  const placed = []; // tracks {x, w} of placed buildings in this row

  for (let attempt = 0; attempt < count * 8; attempt++) {
    if (placed.length >= count) break;

    // Integer dimensions so edges land exactly on grid lines
    const w = 1 + Math.floor(Math.random() * 3); // width  (X) : 1, 2, or 3
    const h = 1 + Math.floor(Math.random() * 4);  // height (Y) : 1, 2, 3, or 4
    const d = 1 + Math.floor(Math.random() * 3); // depth  (Z) : 1, 2, or 3

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

    // Grid-aligned Z: front edge at worldZ (integer), center = worldZ + d/2
    const centerZ = worldZ + d / 2;

    const hpMax = Math.round(w * h * d) * BUILDING_HP_PER_UNIT;
    const color = _colorForHp(hpMax);
    const mat   = new THREE.MeshLambertMaterial({ color });
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
      cannon: false, cannonFlashTimer: 0, cannonLaunched: false,
      cannonHitPlayers: null, cannonHitBuildings: null, cannonHitFusionBalls: null,
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
  _nextSpawnAt = BUILDING_SPAWN_EVERY;

  for (let z = BUILDING_SPAWN_Z; z < BUILDING_CLEAR_Z; z += BUILDING_SPAWN_EVERY) {
    _spawnGroupAt(z);
  }
}

// ── Punch hit detection ────────────────────────────────────────────────
// hitSet: optional Set of building objects already damaged this swing —
// ensures a double-fist heavy punch only applies damage once per building.
const _PUNCH_HIT_RADIUS = 0.5; // world units — fist footprint for AABB test

// Returns true if at least one building was hit.
function checkPunchHitBuildings(wx, wy, wz, damage, hitSet = null, debrisScale = 1) {
  let didHit = false;
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (b.cannon) continue;                // cannon buildings are immune
    if (hitSet && hitSet.has(b)) continue; // already hit by the other fist this swing

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

    if (b.hp <= 0) {
      spawnBuildingDestroyDebris(b.x, b.mesh.position.y, b.z, b.w, b.h, b.d, b.origColor);
      spawnPedsAtBuilding(b.x, b.z, b.hpMax);
      onBuildingDestroyed();
      tryDropItem(b.x, b.h / 2, b.z, b.hpMax);
      _disposeBuilding(b);
      buildings.splice(i, 1);
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
    }
  }
  return didHit;
}

// ── Per-frame update ───────────────────────────────────────────────────
function updateBuildings(dt, dtSec) {
  const step = _activeScrollSpeed * dt;

  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];

    // ── Cannon buildings ──────────────────────────────────────────────────
    if (b.cannon) {
      if (!b.cannonLaunched) {
        // Warning flash: first second slow, second second fast
        b.cannonFlashTimer += dtSec;
        const half = b.cannonFlashTimer < 1.0 ? CANNON_FLASH_SLOW_HALF : CANNON_FLASH_FAST_HALF;
        b.mesh.material.color.set(
          Math.floor(b.cannonFlashTimer / half) % 2 === 0 ? 0xff2222 : 0xffffff
        );
        if (b.cannonFlashTimer >= CANNON_FLASH_DUR) b.cannonLaunched = true;
      } else {
        // Launch: fly toward −Z (top of screen) until off-screen
        b.cannonFlashTimer += dtSec;
        b.mesh.material.color.set(
          Math.floor(b.cannonFlashTimer / CANNON_FLASH_FAST_HALF) % 2 === 0 ? 0xff2222 : 0xffffff
        );
        b.z -= CANNON_LAUNCH_SPD * dt;
        b.mesh.position.z = b.z;
        spawnCannonThrust(b.x, b.z, b.w, b.h, b.d);
        if (b.z < BUILDING_SPAWN_Z) {
          _disposeBuilding(b);
          buildings.splice(i, 1);
        }
      }
      continue;
    }

    // ── Normal scroll ─────────────────────────────────────────────────────
    b.z += step;
    b.mesh.position.z = b.z;

    // Cannon trigger: trailing edge (top in screen space) crosses danger line → freeze and mark
    if (b.z - b.d / 2 >= DAMAGE_Z) {
      b.z = DAMAGE_Z + b.d / 2;  // snap: trailing edge exactly at danger line
      b.mesh.position.z = b.z;
      b.cannon = true;
      b.cannonFlashTimer = 0;
      b.cannonHitPlayers    = new Set();
      b.cannonHitBuildings  = new Set();
      b.cannonHitFusionBalls = new Set();
      b.hpPlane.visible = false;
      b.mesh.material.color.set(0xff2222);
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

    if (b.z > BUILDING_DESPAWN_Z) {
      _disposeBuilding(b);
      buildings.splice(i, 1);
    }
  }

  // ── Cannon building → normal building collision (one hit per building) ──
  for (let ci = buildings.length - 1; ci >= 0; ci--) {
    const bc = buildings[ci];
    if (!bc.cannon || !bc.cannonLaunched) continue;

    for (let ni = buildings.length - 1; ni >= 0; ni--) {
      if (ni === ci) continue;
      const bn = buildings[ni];
      if (bn.cannon) continue;
      if (bc.cannonHitBuildings.has(bn)) continue; // already hit this building
      // AABB overlap check
      if (bc.x - bc.w / 2 >= bn.x + bn.w / 2) continue;
      if (bc.x + bc.w / 2 <= bn.x - bn.w / 2) continue;
      if (bc.z - bc.d / 2 >= bn.z + bn.d / 2) continue;
      if (bc.z + bc.d / 2 <= bn.z - bn.d / 2) continue;

      bc.cannonHitBuildings.add(bn);
      bn.hp -= CANNON_BLDG_DMG;
      const hitX = (bc.x + bn.x) / 2;
      const hitY = bn.mesh.position.y + bn.h / 2;
      const hitZ = (bc.z + bn.z) / 2;
      spawnBuildingHitDebris(hitX, hitY, hitZ, bn.origColor, 1);

      if (bn.hp <= 0) {
        // Destroyed by cannon — no combo credit
        spawnBuildingDestroyDebris(bn.x, bn.mesh.position.y, bn.z, bn.w, bn.h, bn.d, bn.origColor);
        spawnPedsAtBuilding(bn.x, bn.z, bn.hpMax);
        _disposeBuilding(bn);
        buildings.splice(ni, 1);
        if (ni < ci) ci--;
      } else {
        _updateSink(bn);
        _updateHpLabel(bn);
        bn.mesh.material.color.set(0xffffff);
        bn.flashTimer = BUILDING_FLASH_DUR;
        bn.mesh.position.x = bn.x;
        bn.mesh.position.z = bn.z;
        bn.shakeTimer = BUILDING_SHAKE_DUR;
        bn.shakeAmp   = CANNON_BLDG_DMG * 0.01;
      }
    }
  }

  // Continuous spawn: only while game is running
  if (!gameStarted) return;
  if (totalScrolled >= _nextSpawnAt) {
    // Snap spawn Z to current grid phase so building edges land on grid lines
    const snapZ = Math.round(BUILDING_SPAWN_Z - scrollOffset) + scrollOffset;
    _spawnGroupAt(snapZ);
    _nextSpawnAt = totalScrolled + BUILDING_SPAWN_EVERY;
  }
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetBuildings() {
  buildings.forEach(b => _disposeBuilding(b));
  initBuildings(); // re-populate for the next game
}

initBuildings();

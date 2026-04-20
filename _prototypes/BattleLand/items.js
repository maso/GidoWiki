// ── Item drop system ───────────────────────────────────────────────────
// Items drop from buildings destroyed by players / fusion beast.
// Drop chance: grey 0% | green 20% | blue 45% | purple 100%
// ⚠ TEST MODE: all chances set to 100% temporarily

const ITEM_RADIUS = 0.55; // half of BUBBLE_RADIUS (1.1)
const ITEM_BASE_Y = 1.0;  // fixed hover height: one floor-grid unit above ground

const _ITEM_COL_A = new THREE.Color(0xffffff); // white
const _ITEM_COL_B = new THREE.Color(0xeeeeee); // near-white (colorless)

// ── Shared geometries ─────────────────────────────────────────────────
const _itemSphereGeo = new THREE.SphereGeometry(ITEM_RADIUS, 20, 16);
const _itemShadowGeo = new THREE.CircleGeometry(ITEM_RADIUS * 0.72, 20);
const _itemRingGeo   = new THREE.RingGeometry(0.78, 1.0, 48); // unit ring, scaled per instance
const _sparkGeo      = new THREE.SphereGeometry(0.07, 6, 4);

// ── Item icons (canvas textures + shared sprite materials) ────────────

// 0 · Heart (green)
const _heartTex = (() => {
  const cv  = document.createElement('canvas');
  cv.width  = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#22ee55';
  ctx.beginPath();
  const cx = 64, cy = 54, r = 26;
  ctx.moveTo(cx, cy + r * 1.9);
  ctx.bezierCurveTo(cx + r * 2.0, cy + r * 0.8, cx + r * 2.0, cy - r * 1.0, cx + r * 1.0, cy - r * 1.0);
  ctx.bezierCurveTo(cx + r * 0.4, cy - r * 1.0, cx,           cy - r * 0.3, cx,            cy + r * 0.2);
  ctx.bezierCurveTo(cx,           cy - r * 0.3, cx - r * 0.4, cy - r * 1.0, cx - r * 1.0, cy - r * 1.0);
  ctx.bezierCurveTo(cx - r * 2.0, cy - r * 1.0, cx - r * 2.0, cy + r * 0.8, cx,            cy + r * 1.9);
  ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(cv);
})();

// 1 · Clock (blue, flat icon: thick ring + two rounded hands)
const _clockTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const cx = 64, cy = 64;

  // Thick circle ring (no fill)
  ctx.strokeStyle = '#3388ff';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 51, 0, Math.PI * 2);
  ctx.stroke();

  // Hands
  ctx.strokeStyle = '#3388ff';
  ctx.lineCap = 'round';

  // Hour hand — pointing 12 o'clock (straight up)
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - 28);
  ctx.stroke();

  // Minute hand — pointing 3 o'clock (straight right)
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + 36, cy);
  ctx.stroke();

  return new THREE.CanvasTexture(cv);
})();

// 2 · Hamburger (flat icon style: dome + 2 bars + sesame seeds)
const _burgerTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  const cx = 64, cy = 62, R = 46;

  ctx.fillStyle = '#ffaa22';

  // Top bun — upper semicircle
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0, false); // left → top → right
  ctx.closePath();
  ctx.fill();

  // Sesame seeds (white ovals on dome)
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  [[46, 42], [61, 35], [77, 35], [91, 42], [70, 51]].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 5.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#ffaa22';
  // Bar 1 (patty / filling)
  ctx.fillRect(cx - R, cy + 5,  R * 2, 14);
  // Bar 2 (bottom bun)
  ctx.fillRect(cx - R, cy + 24, R * 2, 14);

  return new THREE.CanvasTexture(cv);
})();

// Shared idle sprite materials (one per type, opacity stays fixed during float)
const _iconSpriteMats = [
  new THREE.SpriteMaterial({ map: _heartTex, transparent: true, opacity: 0.88, depthWrite: false }),
  new THREE.SpriteMaterial({ map: _clockTex, transparent: true, opacity: 0.88, depthWrite: false }),
  new THREE.SpriteMaterial({ map: _burgerTex, transparent: true, opacity: 0.88, depthWrite: false }),
];
const _iconTextures = [_heartTex, _clockTex, _burgerTex];

// Pickup sparkle colour palettes — per item type, mostly themed + a few whites
const _sparkColorSets = [
  // 0 · heart  — mostly green
  [0x44ff44, 0x00ff66, 0x22ee55, 0x88ff88, 0xaaffaa, 0xffffff, 0xeeffee],
  // 1 · clock  — mostly blue
  [0x4499ff, 0x44ccff, 0x2277ff, 0x88bbff, 0xaaddff, 0xffffff, 0xeeeeff],
  // 2 · burger — mostly yellow
  [0xffee44, 0xffcc00, 0xffaa22, 0xffffaa, 0xffd966, 0xffffff, 0xfffde8],
];

// ── Active lists ──────────────────────────────────────────────────────
const items      = [];
const _itemRings = []; // ephemeral spawn-ring animations
const _sparks    = []; // ephemeral pickup-sparkle particles
const _iconPops  = []; // ephemeral icon scale-up + fade-out on pickup

// ── Drop chance ───────────────────────────────────────────────────────
function _itemDropChance(hpMax) {
  if (hpMax <  100) return 0;     // grey
  if (hpMax <  200) return 0.20;  // green
  if (hpMax <  300) return 0.45;  // blue
  return 1.0;                     // purple
}

// ── Spawn item ────────────────────────────────────────────────────────
// bx, bz: building center;  _by: unused (Y is fixed);  hpMax: original HP.
function tryDropItem(bx, _by, bz, hpMax) {
  if (Math.random() >= _itemDropChance(hpMax)) return;

  const type = Math.floor(Math.random() * 3); // 0=heart  1=clock  2=burger

  const mat = new THREE.MeshBasicMaterial({
    color: _ITEM_COL_A.clone(), transparent: true,
    opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(_itemSphereGeo, mat);
  mesh.position.set(bx, ITEM_BASE_Y, bz);
  scene.add(mesh);

  const iconSprite = new THREE.Sprite(_iconSpriteMats[type]);
  iconSprite.scale.set(0.78, 0.78, 1);
  mesh.add(iconSprite);

  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x444444, transparent: true, opacity: 0.38, depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(_itemShadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(bx, 0.02, bz);
  scene.add(shadowMesh);

  _spawnItemRing(bx, ITEM_BASE_Y, bz, type);

  items.push({ mesh, mat, shadowMesh, shadowMat, iconSprite,
               iconTex: _iconTextures[type], type,
               baseY: ITEM_BASE_Y,
               floatT: Math.random() * Math.PI * 2,
               flashT: Math.random() * Math.PI * 2 });
}

// Ring colours per item type: heart=bright green, clock=light blue, burger=bright yellow
const _ringColors = [0x44ff66, 0x55ccff, 0xffee22];

// ── Spawn ring ────────────────────────────────────────────────────────
function _spawnItemRing(x, y, z, type) {
  const mat = new THREE.MeshBasicMaterial({
    color: _ringColors[type] ?? 0x33ffee, transparent: true,
    opacity: 0.80, side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(_itemRingGeo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(0.15);
  scene.add(mesh);
  _itemRings.push({ mesh, mat, t: 0, dur: 0.30 });
}

// ── Spawn pickup sparkles ─────────────────────────────────────────────
function _spawnPickupSparkles(x, y, z, type) {
  const palette  = _sparkColorSets[type] ?? _sparkColorSets[0];
  const COUNT  = 28;
  const SPD    = 12.0;  // fast initial burst — drag will slow them quickly
  const UP     = 0.18;  // slight upward tilt so ring hovers just above ground
  const horzFrac = Math.sqrt(1 - UP * UP);
  for (let k = 0; k < COUNT; k++) {
    const col = palette[Math.floor(Math.random() * palette.length)];
    const mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 1.0,
    });
    const mesh = new THREE.Mesh(_sparkGeo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    // Evenly distributed around circle + tiny jitter so it doesn't look mechanical
    const theta = (k / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const vx = Math.cos(theta) * horzFrac * SPD;
    const vy = UP * SPD;
    const vz = Math.sin(theta) * horzFrac * SPD;

    const life = (0.45 + Math.random() * 0.10) * 0.75; // similar lifespan → uniform ring radius
    _sparks.push({ mesh, mat, vx, vy, vz, life, maxLife: life });
  }
}

// ── Item effect on pickup ─────────────────────────────────────────────
// type: 0=heart (+25 HP)  1=clock (+10s game time)  2=burger (+25 Duo)
function _applyItemEffect(type, pi) {
  if (type === 0) {
    // Heart: restore 25 HP (HP bar updates automatically each frame)
    players[pi].hp = Math.min(HP_MAX, players[pi].hp + 25);
  } else if (type === 1) {
    // Clock: add 10 seconds and show blue "+10" near timer
    timeRemaining += 10;
    showTimerBonus(10);
  } else if (type === 2) {
    // Burger: add 25 Duo value
    duoValues[pi] = Math.min(DUO_MAX, duoValues[pi] + 25);
    _syncDuoBar(pi);
  }
}

// ── Per-frame update ──────────────────────────────────────────────────
const _ITEM_TOUCH_DIST2 = (BODY_RADIUS + ITEM_RADIUS) * (BODY_RADIUS + ITEM_RADIUS);

function updateItems(dtSec) {
  if (!gameStarted) return;
  // ── Spawn rings ───────────────────────────────────────────────────────
  for (let i = _itemRings.length - 1; i >= 0; i--) {
    const r = _itemRings[i];
    if (!gamePaused) {
      r.t += dtSec;
      const frac = Math.min(r.t / r.dur, 1);
      r.mesh.scale.setScalar(0.15 + frac * 4.0);
      r.mat.opacity = 0.80 * (1 - frac);
      if (frac >= 1) {
        scene.remove(r.mesh);
        r.mat.dispose();
        _itemRings.splice(i, 1);
      }
    }
  }

  // ── Pickup sparkles ───────────────────────────────────────────────────
  if (!gamePaused) {
    for (let i = _sparks.length - 1; i >= 0; i--) {
      const s = _sparks[i];
      // Strong exponential drag — particles decelerate quickly and travel ~equal distance
      const drag = Math.pow(0.04, dtSec);
      s.vx *= drag;
      s.vy *= drag;
      s.vz *= drag;
      s.mesh.position.x += s.vx * dtSec;
      s.mesh.position.y += s.vy * dtSec;
      s.mesh.position.z += s.vz * dtSec;
      s.life -= dtSec;
      s.mat.opacity = Math.max(0, s.life / s.maxLife);
      if (s.life <= 0) {
        scene.remove(s.mesh);
        s.mat.dispose();
        _sparks.splice(i, 1);
      }
    }
  }

  // ── Heart pop animations ──────────────────────────────────────────────
  if (!gamePaused) {
    for (let i = _iconPops.length - 1; i >= 0; i--) {
      const h = _iconPops[i];
      h.t += dtSec;
      const frac = Math.min(h.t / h.dur, 1);
      const s = 0.78 + frac * 2.2;   // scale from 0.78 → 3.0
      h.sprite.scale.set(s, s, 1);
      h.mat.opacity = Math.max(0, 0.88 * (1 - frac));
      if (frac >= 1) {
        scene.remove(h.sprite);
        h.mat.dispose();
        _iconPops.splice(i, 1);
      }
    }
  }

  // ── Items — collision, float, flash ───────────────────────────────────
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];

    if (gamePaused) continue;

    // Player pickup: solo players only (fusingWith === null)
    let collectedBy = -1;
    for (let pi = 0; pi < players.length; pi++) {
      const p = players[pi];
      if (!p.active || p.isDead || p.fusingWith !== null) continue;
      const dx = p.x - item.mesh.position.x;
      const dz = p.z - item.mesh.position.z;
      if (dx * dx + dz * dz < _ITEM_TOUCH_DIST2) {
        collectedBy = pi;
        break;
      }
    }
    if (collectedBy >= 0) {
      const wx = item.mesh.position.x;
      const wy = item.mesh.position.y;
      const wz = item.mesh.position.z;
      _spawnPickupSparkles(wx, wy, wz, item.type);
      // Detach icon sprite and animate it independently (own material for opacity)
      item.mesh.remove(item.iconSprite);
      item.iconSprite.position.set(wx, wy, wz);
      const _hpMat = new THREE.SpriteMaterial({
        map: item.iconTex, transparent: true, opacity: 0.88, depthWrite: false,
      });
      item.iconSprite.material = _hpMat;
      scene.add(item.iconSprite);
      _iconPops.push({ sprite: item.iconSprite, mat: _hpMat, t: 0, dur: 0.40 });
      _applyItemEffect(item.type, collectedBy);
      scene.remove(item.mesh);
      scene.remove(item.shadowMesh);
      item.mat.dispose();
      item.shadowMat.dispose();
      items.splice(i, 1);
      continue;
    }

    // Float
    item.floatT += dtSec * 1.8;
    const floatY = Math.sin(item.floatT) * 0.22;
    item.mesh.position.y = item.baseY + floatY;

    // Shadow scale
    item.shadowMesh.scale.setScalar(Math.max(0.5, 1.0 - floatY * 0.18));

    // Colour + opacity flash
    item.flashT += dtSec * 4.0;
    const frac = (Math.sin(item.flashT) + 1) * 0.5;
    item.mat.color.lerpColors(_ITEM_COL_A, _ITEM_COL_B, frac);
    item.mat.opacity = 0.20 + frac * 0.30;
  }
}

// ── Reset ─────────────────────────────────────────────────────────────
function resetItems() {
  for (const item of items) {
    scene.remove(item.mesh);
    scene.remove(item.shadowMesh);
    item.mat.dispose();
    item.shadowMat.dispose();
  }
  items.length = 0;

  for (const r of _itemRings) {
    scene.remove(r.mesh);
    r.mat.dispose();
  }
  _itemRings.length = 0;

  for (const s of _sparks) {
    scene.remove(s.mesh);
    s.mat.dispose();
  }
  _sparks.length = 0;

  for (const h of _iconPops) {
    scene.remove(h.sprite);
    h.mat.dispose();
  }
  _iconPops.length = 0;
}

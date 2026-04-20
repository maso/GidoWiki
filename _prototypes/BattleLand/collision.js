// ── Collision system ───────────────────────────────────────────────────
// Three concerns:
//  1. Player vs building  (circle – AABB)
//  2. Player vs player    (circle – circle)
//  3. Bubble landing      (shadow circle vs all obstacles)

const _BUBBLE_LAND_R = BUBBLE_RADIUS * 0.8; // same as shadow radius

// ── Helpers ────────────────────────────────────────────────────────────

// Nearest point on an AABB to (cx, cz), then push circle out if overlapping.
// Returns { x, z } of corrected position, or null if no overlap.
function _pushOutOfBuilding(cx, cz, r, bldg) {
  const hw = bldg.w / 2, hd = bldg.d / 2;
  const nearX = clamp(cx, bldg.x - hw, bldg.x + hw);
  const nearZ = clamp(cz, bldg.z - hd, bldg.z + hd);
  let dx = cx - nearX, dz = cz - nearZ;
  const dist2 = dx * dx + dz * dz;
  if (dist2 >= r * r) return null; // no collision

  const dist = Math.sqrt(dist2);
  if (dist < 0.0001) {
    // Circle centre is inside the AABB — push out through the nearest wall
    const ox = hw - Math.abs(cx - bldg.x);
    const oz = hd - Math.abs(cz - bldg.z);
    if (ox < oz) { dx = cx >= bldg.x ? 1 : -1; dz = 0; }
    else         { dx = 0; dz = cz >= bldg.z ? 1 : -1; }
  } else {
    dx /= dist; dz /= dist;
  }
  return { x: nearX + dx * r, z: nearZ + dz * r };
}

// ── Per-frame resolution ───────────────────────────────────────────────
function resolveCollisions() {
  // Run multiple passes so chains of contacts settle properly
  for (let pass = 0; pass < 3; pass++) {

    // 1. Each live player vs every building
    for (const p of players) {
      if (!p.active || p.isDead) continue;
      for (const b of buildings) {
        const fix = _pushOutOfBuilding(p.x, p.z, BODY_RADIUS, b);
        if (fix) { p.x = fix.x; p.z = fix.z; }
      }
    }

    // 2. Live players vs each other
    for (let i = 0; i < players.length - 1; i++) {
      const a = players[i];
      if (!a.active || a.isDead) continue;
      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        if (!b.active || b.isDead) continue;
        // Skip collision between players that are fusing with each other
        if (a.fusingWith === j && b.fusingWith === i) continue;
        let dx = a.x - b.x, dz = a.z - b.z;
        const dist2 = dx * dx + dz * dz;
        const minD  = BODY_RADIUS * 2;
        if (dist2 < minD * minD) {
          const dist = Math.sqrt(dist2);
          if (dist < 0.0001) { dx = 1; dz = 0; }
          else               { dx /= dist; dz /= dist; }
          const push = (minD - dist) * 0.5;
          a.x += dx * push; a.z += dz * push;
          b.x -= dx * push; b.z -= dz * push;
        }
      }
    }

    // Re-clamp after every pass so pushes never send players out of bounds
    for (const p of players) {
      if (!p.active || p.isDead) continue;
      p.x = clamp(p.x, MOVE_X_MIN, MOVE_X_MAX);
      p.z = clamp(p.z, MOVE_Z_MIN, MOVE_Z_MAX);
    }

    // 3. Fusion balls vs buildings
    for (const ball of _fusionBalls) {
      if (ball.dispersing) continue;
      for (const b of buildings) {
        const fix = _pushOutOfBuilding(ball.cx, ball.cz, ball.R, b);
        if (fix) {
          ball.cx = fix.x; ball.cz = fix.z;
          ball.group.position.x = ball.cx;
          ball.group.position.z = ball.cz;
        }
      }
      ball.cx = clamp(ball.cx, MOVE_X_MIN, MOVE_X_MAX);
      ball.cz = clamp(ball.cz, MOVE_Z_MIN, MOVE_Z_MAX);
      ball.group.position.x = ball.cx;
      ball.group.position.z = ball.cz;
    }
  }
}

// ── Bubble safe-landing check ──────────────────────────────────────────

function _isLandingFree(x, z, excludePi) {
  const r = _BUBBLE_LAND_R;

  // vs buildings
  for (const b of buildings) {
    if (_pushOutOfBuilding(x, z, r, b)) return false;
  }

  // vs live players (not self)
  for (let i = 0; i < players.length; i++) {
    if (i === excludePi) continue;
    const p = players[i];
    if (!p.active || p.isDead) continue;
    const dx = x - p.x, dz = z - p.z;
    const minD = r + BODY_RADIUS;
    if (dx * dx + dz * dz < minD * minD) return false;
  }

  // vs other active bubble shadows
  for (let i = 0; i < bubbles.length; i++) {
    if (i === excludePi) continue;
    const b = bubbles[i];
    if (!b.active) continue;
    const dx = x - b.x, dz = z - b.z;
    const minD = r + _BUBBLE_LAND_R;
    if (dx * dx + dz * dz < minD * minD) return false;
  }

  return true;
}

// Spiral outward from (preferX, preferZ) until a free spot is found.
// Called from _popBubble before the character starts falling.
function findSafeLandingPos(preferX, preferZ, playerIndex) {
  if (_isLandingFree(preferX, preferZ, playerIndex)) {
    return { x: preferX, z: preferZ };
  }

  const step = BODY_RADIUS * 2.5;
  for (let ring = 1; ring <= 12; ring++) {
    const d       = ring * step;
    const nAngles = Math.max(8, ring * 6);
    for (let a = 0; a < nAngles; a++) {
      const angle = (a / nAngles) * Math.PI * 2;
      const tx = clamp(preferX + Math.cos(angle) * d, -AREA + _BUBBLE_LAND_R, AREA - _BUBBLE_LAND_R);
      const tz = clamp(preferZ + Math.sin(angle) * d, _BB_Z_TOP + _BUBBLE_LAND_R, _BB_Z_BOT - _BUBBLE_LAND_R);
      if (_isLandingFree(tx, tz, playerIndex)) {
        return { x: tx, z: tz };
      }
    }
  }
  return { x: preferX, z: preferZ }; // fallback — best effort
}

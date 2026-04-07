// ── Mountain / low-poly scenery ────────────────────────────────────────
// Spawned on both sides of the play field (|X| > AREA).
// Shape: SphereGeometry with centre at Y = 0 (half-buried) + vertical
// stretch — gives a rounded dome/hill look with no sharp tip.
// Scroll at the same speed as buildings (_activeScrollSpeed).

const MOUNT_SPAWN_Z     = -(AREA + 10);
const MOUNT_DESPAWN_Z   =   AREA + 6;
const MOUNT_SPAWN_EVERY = 3; // new cluster every 3 m

// Main mountain colours — cheerful greens
const _MOUNT_COLORS = [
  0x7ed44e, 0x5cc040, 0x9adc60, 0x4eb832,
  0x88cc50, 0x66c448, 0xb0e46a, 0x52b038,
];

// Mini mountain colours — muted grass + desaturated olive-earth tones
const _MINI_COLORS = [
  0x6eba44, 0x5e9e38, 0x78b04a, // muted grass greens
  0x8e9848, 0x7e8a3c, 0x9aa050, // olive greens (bridge between green and earth)
  0x96924a, 0x878240, 0xa09858, // desaturated earthy olive
];

const mountains = [];
let _nextMountSpawnAt = MOUNT_SPAWN_EVERY;

// ── Spawn one cluster on both sides at a given world Z ─────────────────
function _spawnMountainClusterAt(worldZ) {
  for (const side of [-1, 1]) {
    const count = 2 + Math.floor(Math.random() * 3); // 2–4 per side
    for (let i = 0; i < count; i++) {
      const radius = 1.8 + Math.random() * 2.2;         // base radius 1.8–4
      const segs   = 5 + Math.floor(Math.random() * 3); // 5–7 sides (low-poly)
      const yScale = 0.5 + Math.random() * 0.7;          // vertical stretch 0.5–1.2×

      // Ensure the mountain base (center ± radius) never crosses into play field
      const xInner = AREA + radius + 0.5;
      const x      = (xInner + Math.random() * 8) * side;
      const z      = worldZ + (Math.random() - 0.5) * 5;

      const color = _MOUNT_COLORS[Math.floor(Math.random() * _MOUNT_COLORS.length)];

      // SphereGeometry centred at Y=0: top hemisphere = visible hill
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, 4),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      mesh.scale.y = yScale;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      mountains.push({ mesh, z: mesh.position.z });
    }

    // Mini mountains — fill the gap between innerGround and the main range
    const miniCount = 1 + Math.floor(Math.random() * 2); // 1–2 per side
    for (let i = 0; i < miniCount; i++) {
      const radius = 0.4 + Math.random() * 0.5;          // base radius 0.4–0.9
      const segs   = 5 + Math.floor(Math.random() * 2);  // 5–6 sides
      const yScale = 0.3 + Math.random() * 0.4;          // short: 0.3–0.7×

      // Ensure base edge (center − radius) stays outside innerGround
      const x = (AREA + radius + 0.15 + Math.random() * 1.8) * side;
      const z = worldZ + (Math.random() - 0.5) * 5;

      const color = _MINI_COLORS[Math.floor(Math.random() * _MINI_COLORS.length)];
      const mesh  = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, 4),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      mesh.scale.y = yScale;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.castShadow    = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      mountains.push({ mesh, z: mesh.position.z });
    }
  }
}

// ── Initial placement — fills entire visible depth ─────────────────────
function initMountains() {
  mountains.length  = 0;
  _nextMountSpawnAt = MOUNT_SPAWN_EVERY;
  for (let z = MOUNT_SPAWN_Z; z < AREA + 5; z += MOUNT_SPAWN_EVERY) {
    _spawnMountainClusterAt(z);
  }
}

// ── Per-frame update ───────────────────────────────────────────────────
function updateMountains(dt) {
  const step = _activeScrollSpeed * dt;

  for (let i = mountains.length - 1; i >= 0; i--) {
    const m = mountains[i];
    m.z += step;
    m.mesh.position.z = m.z;

    if (m.z > MOUNT_DESPAWN_Z) {
      scene.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
      mountains.splice(i, 1);
    }
  }

  if (!gameStarted) return;
  if (totalScrolled >= _nextMountSpawnAt) {
    _spawnMountainClusterAt(MOUNT_SPAWN_Z);
    _nextMountSpawnAt = totalScrolled + MOUNT_SPAWN_EVERY;
  }
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetMountains() {
  mountains.forEach(m => {
    scene.remove(m.mesh);
    m.mesh.geometry.dispose();
    m.mesh.material.dispose();
  });
  initMountains();
}

initMountains();

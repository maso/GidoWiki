// ── Mountain / low-poly scenery ────────────────────────────────────────
// Spawned on both sides of the play field (|X| > AREA).
// Shape: SphereGeometry with centre at Y = 0 (half-buried) + vertical
// stretch — gives a rounded dome/hill look with no sharp tip.
// Static — placed once at init, never scrolled.

const MOUNT_SPAWN_EVERY = 3; // Z interval between mountain clusters

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
    const miniCount = 2 + Math.floor(Math.random() * 3); // 2–4 per side
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

// ── Spawn mountains along the top edge (across X, beyond z = _gZTop) ──
function _spawnTopEdgeMountains() {
  for (let x = -AREA; x <= AREA; x += MOUNT_SPAWN_EVERY) {
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const radius = 1.0 + Math.random() * 2.0;
      const segs   = 5 + Math.floor(Math.random() * 3);
      const yScale = 0.5 + Math.random() * 0.7;
      const px     = x + (Math.random() - 0.5) * MOUNT_SPAWN_EVERY;
      const pz     = _gZTop - radius - 0.2 - Math.random() * 3;
      const color  = _MOUNT_COLORS[Math.floor(Math.random() * _MOUNT_COLORS.length)];
      const mesh   = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, 4),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      mesh.scale.y = yScale;
      mesh.position.set(px, 0, pz);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mountains.push({ mesh });
    }
  }
}

// ── Initial placement — alongside the ground + top edge backdrop ────────
function initMountains() {
  mountains.length = 0;

  // Both sides along the ground depth
  for (let z = _gZTop; z < _gZBot; z += MOUNT_SPAWN_EVERY) {
    _spawnMountainClusterAt(z);
  }

  // Along the top edge of the gray ground
  _spawnTopEdgeMountains();

  // Extra clusters at top-left and top-right corners
  for (const side of [-1, 1]) {
    const count = 5 + Math.floor(Math.random() * 4); // 5–8 per corner
    for (let i = 0; i < count; i++) {
      const radius = 1.0 + Math.random() * 2.5;
      const segs   = 5 + Math.floor(Math.random() * 3);
      const yScale = 0.5 + Math.random() * 0.8;
      const px     = (AREA + radius + 0.3 + Math.random() * 4) * side;
      const pz     = _gZTop - Math.random() * 6;
      const color  = _MOUNT_COLORS[Math.floor(Math.random() * _MOUNT_COLORS.length)];
      const mesh   = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, 4),
        new THREE.MeshLambertMaterial({ color, flatShading: true })
      );
      mesh.scale.y = yScale;
      mesh.position.set(px, 0, pz);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mountains.push({ mesh });
    }
  }
}

// ── Per-frame update ───────────────────────────────────────────────────
function updateMountains(dt) {
  // Mountains are static — no scrolling.
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

// ── Road-edge ground patches ───────────────────────────────────────────
// Irregular flat colour patches near the innerGround / grass boundary.
// Geometry vertices are placed directly in the XZ plane (y = 0) so the
// meshes lie flat with no rotation.x hack needed.

const PATCH_SPAWN_Z     = -(AREA + 10);
const PATCH_DESPAWN_Z   =   AREA + 6;
const PATCH_SPAWN_EVERY = 2;

const _PATCH_COLORS = [
  0xf2f0eb, 0xeceae4, 0xf5f3ee, 0xe8e6e0, 0xededea,
];

const patches = [];
let _nextPatchSpawnAt = PATCH_SPAWN_EVERY;

// ── Geometry helpers ───────────────────────────────────────────────────

// Irregular polygon: N vertices distributed roughly around a circle,
// with random radius and angle jitter per vertex. Already in XZ plane.
function _makeIrregularGeo(baseR) {
  const segs = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6 sides
  const pos  = [];
  const idx  = [];

  // Centre vertex
  pos.push(0, 0, 0);

  for (let i = 0; i < segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    pos.push(Math.cos(angle) * baseR, 0, Math.sin(angle) * baseR);
  }

  for (let i = 0; i < segs; i++) {
    idx.push(0, (i + 1) % segs + 1, i + 1); // CCW winding → normal faces +Y (up)
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}


// ── Spawn ──────────────────────────────────────────────────────────────
function _spawnPatchClusterAt(worldZ) {
  for (const side of [-1, 1]) {
    const count = 6 + Math.floor(Math.random() * 6); // 6–11 per side (−10%)
    for (let i = 0; i < count; i++) {
      const r = 0.16 + Math.random() * 0.36; // rough radius 0.16–0.52 (+30% avg)

      // Centre exactly on the boundary line
      const xOffset = 0;
      const x       = (AREA + xOffset) * side;
      const z       = worldZ + (Math.random() - 0.5) * PATCH_SPAWN_EVERY * 2.5;

      const geo = _makeIrregularGeo(r); // 4–10 sided irregular polygon
      const color = _PATCH_COLORS[Math.floor(Math.random() * _PATCH_COLORS.length)];
      const mesh  = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color })
      );

      // Geometry is already flat in XZ plane — spin around Y to vary orientation
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.position.set(x, 0.001, z);
      scene.add(mesh);

      patches.push({ mesh, z: mesh.position.z });
    }
  }
}

// ── Init ───────────────────────────────────────────────────────────────
function initPatches() {
  patches.length    = 0;
  _nextPatchSpawnAt = PATCH_SPAWN_EVERY;
  for (let z = PATCH_SPAWN_Z; z < AREA + 5; z += PATCH_SPAWN_EVERY) {
    _spawnPatchClusterAt(z);
  }
}

// ── Per-frame update ───────────────────────────────────────────────────
function updatePatches(dt) {
  const step = _activeScrollSpeed * dt;

  for (let i = patches.length - 1; i >= 0; i--) {
    const p = patches[i];
    p.z += step;
    p.mesh.position.z = p.z;

    if (p.z > PATCH_DESPAWN_Z) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      patches.splice(i, 1);
    }
  }

  if (!gameStarted) return;
  if (totalScrolled >= _nextPatchSpawnAt) {
    _spawnPatchClusterAt(PATCH_SPAWN_Z);
    _nextPatchSpawnAt = totalScrolled + PATCH_SPAWN_EVERY;
  }
}

// ── Reset ──────────────────────────────────────────────────────────────
function resetPatches() {
  patches.forEach(p => {
    scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    p.mesh.material.dispose();
  });
  initPatches();
}

initPatches();

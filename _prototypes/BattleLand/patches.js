// ── Road-edge ground patches ───────────────────────────────────────────
// Irregular flat colour patches near the innerGround / grass boundary.
// Geometry vertices are placed directly in the XZ plane (y = 0) so the
// meshes lie flat with no rotation.x hack needed.

const PATCH_SPAWN_EVERY = 2; // spacing between patch clusters along each edge

const _PATCH_COLORS = [
  0xf2f0eb, 0xeceae4, 0xf5f3ee, 0xe8e6e0, 0xededea,
];

const patches = [];

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


// ── Spawn a single patch at (x, z) ────────────────────────────────────
function _spawnPatch(x, z) {
  const r     = 0.08 + Math.random() * 0.35;
  const color = _PATCH_COLORS[Math.floor(Math.random() * _PATCH_COLORS.length)];
  const mesh  = new THREE.Mesh(
    _makeIrregularGeo(r),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.position.set(x, 0.001, z);
  scene.add(mesh);
  patches.push({ mesh });
}

// ── Init ───────────────────────────────────────────────────────────────
function initPatches() {
  patches.length = 0;

  const zMin = _gZTop;  // −10 — ground top edge
  const zMax = _gZBot;  //  +8 — ground bottom edge
  const xMin = -AREA;   // −10
  const xMax =  AREA;   //  10
  const step = PATCH_SPAWN_EVERY;

  // Left & right edges (along Z)
  for (const x of [xMin, xMax]) {
    for (let z = zMin; z <= zMax; z += step) {
      const count = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const pz = Math.max(zMin, Math.min(zMax, z + (Math.random() - 0.5) * step));
        _spawnPatch(x, pz);
      }
    }
  }

  // Top & bottom edges (along X)
  for (const z of [zMin, zMax]) {
    for (let x = xMin; x <= xMax; x += step) {
      const count = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const px = Math.max(xMin, Math.min(xMax, x + (Math.random() - 0.5) * step));
        _spawnPatch(px, z);
      }
    }
  }
}

// ── Per-frame update ───────────────────────────────────────────────────
function updatePatches(dt) {
  // Patches are static — no scrolling.
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

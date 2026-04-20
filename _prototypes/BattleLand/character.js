function makeLabelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 38px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillText(text, 65, 35);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 64, 34);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthTest: false,
    })
  );
  sprite.scale.set(1.4, 0.7, 1);
  return sprite;
}

function lmat(hex) {
  return new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) });
}

// Derive a complementary foot color from the body color:
// light body → darker feet, dark body → slightly lighter feet
function footColorFrom(bodyHex) {
  const c = new THREE.Color(bodyHex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.l = hsl.l > 0.45
    ? hsl.l * 0.52          // light body → dark feet
    : Math.min(hsl.l * 1.7, 0.62); // dark body → lighter feet
  hsl.s = Math.min(hsl.s * 1.15, 1.0);
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return c;
}

// Ghost material: draws only where buildings wrote stencil=1 (i.e. character is behind a building).
// depthTest=false so it draws regardless of depth at those stencil pixels.
function _makeGhostMat(color) {
  return new THREE.MeshBasicMaterial({
    color: color instanceof THREE.Color ? color.clone() : new THREE.Color(color),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.GreaterDepth, // only draw where character is behind something
    // stencilWrite:true enables the stencil TEST in Three.js (confusingly named).
    // All ops are Keep so the stencil buffer is never modified.
    stencilWrite: true,
    stencilFunc: THREE.EqualStencilFunc,
    stencilRef: 1,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
}

function createCharacter(colorHex, label) {
  const group       = new THREE.Group();
  const bodyMats    = []; // materials updated on color change
  const ghostMats   = []; // parallel ghost materials (body + armL + armR)
  const ghostMeshes = []; // all ghost child meshes — for visibility toggling

  const col = new THREE.Color(colorHex);

  function add(geo, mat, px, py, pz, shadow = true) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, py, pz);
    if (shadow) mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Add a mesh plus a ghost child that shows through buildings via stencil
  function addWithGhost(geo, mat, ghostMat, px, py, pz, shadow = true) {
    const mesh = add(geo, mat, px, py, pz, shadow);
    const ghost = new THREE.Mesh(geo, ghostMat); // shares geometry, no castShadow
    ghost.renderOrder = 5;
    ghost.visible = false; // hidden by default; shown only when occluded by a building
    mesh.add(ghost);
    ghostMeshes.push(ghost);
    return mesh;
  }

  // ── Body ──────────────────────────────────────────────────────────────
  const bodyMat      = new THREE.MeshLambertMaterial({ color: col.clone() });
  const bodyGhostMat = _makeGhostMat(col);
  bodyMats.push(bodyMat);
  ghostMats.push(bodyGhostMat);
  addWithGhost(new THREE.SphereGeometry(0.52, 24, 20), bodyMat, bodyGhostMat, 0, 0.55, 0);

  // ── Arms ─────────────────────────────────────────────────────────────
  const armMatL = new THREE.MeshLambertMaterial({ color: col.clone() });
  const armMatR = new THREE.MeshLambertMaterial({ color: col.clone() });
  bodyMats.push(armMatL, armMatR);
  const armL = add(new THREE.SphereGeometry(0.11, 12, 10), armMatL, -0.60, 0.46, 0.08);
  const armR = add(new THREE.SphereGeometry(0.11, 12, 10), armMatR,  0.60, 0.46, 0.08);

  // ── Feet (color derived from body color) ─────────────────────────────
  const footCol      = footColorFrom(colorHex);
  const footMat      = new THREE.MeshLambertMaterial({ color: footCol.clone() });
  const footGhostMat = null; // no ghost for feet
  const footL = add(new THREE.SphereGeometry(0.27, 14, 12), footMat, -0.24, 0.15, 0.04);
  const footR = add(new THREE.SphereGeometry(0.27, 14, 12), footMat,  0.24, 0.15, 0.04);

  // ── Eyes (white oval, no pupils) — no ghost needed ───────────────────
  const eyeMat = lmat(0xffffff);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), eyeMat);
    eye.scale.set(0.65, 1.2, 0.38);
    eye.position.set(s * 0.19, 0.70, 0.45);
    group.add(eye);
  }

  // ── Label sprite — no ghost needed ────────────────────────────────────
  const lsp = makeLabelSprite(label);
  lsp.position.y = 1.38;
  group.add(lsp);

  return { group, bodyMats, ghostMats, ghostMeshes, footMat, footGhostMat, armL, armR, footL, footR, eyeMat, labelSprite: lsp };
}

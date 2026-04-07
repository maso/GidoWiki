// ── Scene ──────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d0e8);
scene.fog = new THREE.Fog(0xb8d0e8, 30, 55);

// ── Camera ─────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 19, 13);
camera.lookAt(0, 0, 0);

// ── Renderer ───────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'game-canvas';
document.body.prepend(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Lights ─────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const sun = new THREE.DirectionalLight(0xfffbe8, 1.0);
sun.position.set(7, 15, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
scene.add(sun);

// ── Ground ─────────────────────────────────────────────────────────────
// Extends far forward (toward negative Z / off-screen top) so the ground
// has no visible edge in the camera's view. Depth = 80 units, shifted back
// so its front edge stays at z = +AREA and rear edge at z = −(AREA + 60).
const _gDepth = AREA + 70;
const _gCenterZ = AREA - _gDepth / 2;

// Wide grass plane — sits below innerGround; visible on both sides as grass
const grassGround = new THREE.Mesh(
  new THREE.PlaneGeometry(120, _gDepth),
  new THREE.MeshLambertMaterial({ color: 0x5e8c3a })
);
grassGround.rotation.x = -Math.PI / 2;
grassGround.position.set(0, 0, _gCenterZ);
grassGround.receiveShadow = true;
scene.add(grassGround);

const innerGround = new THREE.Mesh(
  new THREE.PlaneGeometry(AREA * 2, _gDepth),
  new THREE.MeshLambertMaterial({ color: 0xf2f0eb })
);
innerGround.rotation.x = -Math.PI / 2;
innerGround.position.set(0, 0.002, _gCenterZ);
innerGround.receiveShadow = true;
scene.add(innerGround);


// ── Grid ───────────────────────────────────────────────────────────────
// GridHelper line width is capped at 1px by WebGL, so we use a canvas
// texture tiled over a plane to achieve 2× thicker lines.
const _gridCell = 64; // canvas px per world unit
const _gridCanvas = document.createElement('canvas');
_gridCanvas.width  = _gridCell;
_gridCanvas.height = _gridCell;
const _gCtx = _gridCanvas.getContext('2d');
_gCtx.clearRect(0, 0, _gridCell, _gridCell);
_gCtx.strokeStyle = 'rgba(64,64,64,1)'; // dark gray
_gCtx.lineWidth   = 2;
// Draw only top + left edges; tiling handles the rest — each boundary
// then has exactly one 2 px line (vs GridHelper's ~1 px).
_gCtx.beginPath();
_gCtx.moveTo(0, 1); _gCtx.lineTo(_gridCell, 1); // top
_gCtx.moveTo(1, 0); _gCtx.lineTo(1, _gridCell); // left
_gCtx.stroke();

const _gridTex = new THREE.CanvasTexture(_gridCanvas);
_gridTex.wrapS = THREE.RepeatWrapping;
_gridTex.wrapT = THREE.RepeatWrapping;
_gridTex.repeat.set(AREA * 2, _gDepth); // 1 cell = 1 world unit

const grid = new THREE.Mesh(
  new THREE.PlaneGeometry(AREA * 2, _gDepth),
  new THREE.MeshBasicMaterial({ map: _gridTex, transparent: true, opacity: 0.75, depthWrite: false })
);
grid.rotation.x = -Math.PI / 2;
grid.position.set(0, 0.004, _gCenterZ);
scene.add(grid);

// ── Dashed line helper ─────────────────────────────────────────────────
// Returns a MeshBasicMaterial so the caller can animate opacity later.
function _makeDashedLine(color, opacity, worldZ, yOffset) {
  const mat     = new THREE.MeshBasicMaterial({ color, opacity, transparent: true });
  const dashLen = 0.45, gapLen = 0.25, segLen = dashLen + gapLen;
  const tubeR   = 0.045;
  let cur = -AREA;
  while (cur < AREA) {
    const end = Math.min(cur + dashLen, AREA);
    const len = end - cur;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len, tubeR * 2, tubeR * 2), mat);
    seg.position.set(cur + len / 2, yOffset, worldZ);
    scene.add(seg);
    cur += segLen;
  }
  return mat;
}

// ── Upper boundary line (z = −AREA = −10, green) ──────────────────────
const upperBoundMat   = _makeDashedLine(0x22cc44, 0.4, -AREA, 0.04);

// ── Inner hint line (z = −7, blue) ────────────────────────────────────
const spawnHintMat    = _makeDashedLine(0x2266ff, 0.5, -AREA + 3, 0.04);


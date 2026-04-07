// ── Scroll state ───────────────────────────────────────────────────────
let scrollOffset  = 0;
let totalScrolled = 0; // real distance travelled — used for building spawn triggers
let gameScore     = 0; // display score — same as totalScrolled but with combo multiplier applied
const _distanceEl = document.getElementById('distance-number'); // cached — queried every frame

// Current scroll speed — shared with buildings.js (loaded after this file)
let _activeScrollSpeed = SCROLL_SPEED;

// Z threshold that triggers speed-up (= blue hint line)
const _SPEEDUP_Z = -AREA + 3;

function resetLevel() {
  scrollOffset       = 0;
  totalScrolled      = 0;
  gameScore          = 0;
  _activeScrollSpeed = SCROLL_SPEED;
  grid.position.z = 0;
  _distanceEl.textContent = '0';
}

// ── updateScroll ───────────────────────────────────────────────────────
// Call once per frame from the game loop.
// Scrolls the grid visually, pushes all players toward +Z (bottom of screen),
// and updates the distance HUD.
function updateScroll(dt) {
  if (!gameStarted) return;

  // Speed up when any live player crosses above the blue hint line
  const anyAbove = players.some(p => !p.isDead && p.z < _SPEEDUP_Z)
    || _fusionBalls.some(b => !b.dispersing && b.cz < _SPEEDUP_Z);
  _activeScrollSpeed = anyAbove ? SPD : SCROLL_SPEED;

  const step = _activeScrollSpeed * dt;

  // Accumulate real distance (no combo multiplier — used for building spawn triggers)
  scrollOffset  += step;
  totalScrolled += step;

  // Accumulate display score (combo multiplier applied)
  gameScore += step * (_comboCount >= 2 ? _comboCount : 1);

  // Loop grid pattern every 1 world unit (= 1 grid cell = 1m)
  if (scrollOffset >= 1) scrollOffset -= 1;

  // Shift the GridHelper so its lines appear to scroll toward the camera
  grid.position.z = scrollOffset;

  // Push every live player toward +Z (camera direction = "down" on screen)
  // Dead players are frozen in world space during death animation
  players.forEach(p => {
    if (p.isDead) return;
    p.z = clamp(p.z + step, -AREA, AREA);
  });

  // Update score display
  _distanceEl.textContent = Math.floor(gameScore);
}

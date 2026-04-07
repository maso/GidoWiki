// ── 2D Flame canvas overlay ────────────────────────────────────────────
const FLAME_DELAY_SEC = 2;   // seconds after game start before flames emerge
const FLAME_GROW_SEC  = 2;   // seconds to fully grow once delay has passed
const CANVAS_H        = 110; // px — how tall the flame canvas is

let flameGrowth = 0;
let flameDelay  = FLAME_DELAY_SEC; // counts down to 0 before growth begins

// Create canvas and append inside #ui (prepend so it's behind other UI)
const flameCanvas     = document.createElement('canvas');
flameCanvas.style.cssText = [
  'position:absolute', 'bottom:0', 'left:0',
  'width:100%', `height:${CANVAS_H}px`,
  'pointer-events:none', 'z-index:1',
].join(';');
document.getElementById('ui').prepend(flameCanvas);
const flameCtx = flameCanvas.getContext('2d');

function resizeFlameCanvas() {
  flameCanvas.width  = window.innerWidth;
  flameCanvas.height = CANVAS_H;
}
resizeFlameCanvas();
window.addEventListener('resize', resizeFlameCanvas);

// ── Generate flame tongues ─────────────────────────────────────────────
// Count scales with viewport width so the row is always fully covered
const tongues = [];

function buildTongues() {
  tongues.length = 0;
  const count = Math.ceil(window.innerWidth / 55);
  for (let i = 0; i < count; i++) {
    tongues.push({
      xRatio: (i + Math.random() * 0.6 - 0.3) / count,
      width:  44 + Math.random() * 44,    // px
      height: 43 + Math.random() * 43,    // px max
      phase:  Math.random() * Math.PI * 2,
      speed:  2.4 + Math.random() * 3.2,
    });
  }
}
buildTongues();
window.addEventListener('resize', buildTongues);

// ── Draw helpers ───────────────────────────────────────────────────────
function drawTongue(cx, baseY, w, maxH, t, f) {
  const growH = maxH * flameGrowth;
  if (growH <= 0) return;

  const flicker = 0.72 + 0.28 * Math.sin(t * f.speed + f.phase);
  const h       = growH * flicker;
  const sway    = w * 0.28 * Math.sin(t * f.speed * 0.6 + f.phase + 1.6);
  const tipX    = cx + sway;

  const grad = flameCtx.createLinearGradient(cx, baseY, cx, baseY - h);
  grad.addColorStop(0.00, 'rgba(255,  30,  0, 1.00)');
  grad.addColorStop(0.25, 'rgba(255, 110,  0, 0.95)');
  grad.addColorStop(0.55, 'rgba(255, 210,  0, 0.82)');
  grad.addColorStop(0.80, 'rgba(255, 255, 80, 0.45)');
  grad.addColorStop(1.00, 'rgba(255, 255,180, 0.00)');

  flameCtx.fillStyle = grad;
  flameCtx.beginPath();
  flameCtx.moveTo(cx - w / 2, baseY);
  flameCtx.bezierCurveTo(
    cx - w * 0.55, baseY - h * 0.38,
    tipX - w * 0.10, baseY - h * 0.82,
    tipX, baseY - h
  );
  flameCtx.bezierCurveTo(
    tipX + w * 0.10, baseY - h * 0.82,
    cx + w * 0.55, baseY - h * 0.38,
    cx + w / 2, baseY
  );
  flameCtx.fill();
}

// ── updateFlames ───────────────────────────────────────────────────────
function updateFlames(elapsedSec) {
  if (!gameStarted) return;

  if (flameDelay > 0) {
    flameDelay -= elapsedSec;
    return; // don't grow yet
  }

  if (flameGrowth < 1) {
    flameGrowth = Math.min(1, flameGrowth + elapsedSec / FLAME_GROW_SEC);
  }

  const t = performance.now() / 1000;
  const W = flameCanvas.width;
  const H = flameCanvas.height;

  flameCtx.clearRect(0, 0, W, H);

  // Hot base glow (always full width)
  if (flameGrowth > 0) {
    const baseGrad = flameCtx.createLinearGradient(0, H, 0, H - 40 * flameGrowth);
    baseGrad.addColorStop(0, `rgba(255, 60, 0, ${0.65 * flameGrowth})`);
    baseGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
    flameCtx.fillStyle = baseGrad;
    flameCtx.fillRect(0, H - 40 * flameGrowth, W, 40 * flameGrowth);
  }

  // Individual flame tongues
  tongues.forEach(f => {
    drawTongue(f.xRatio * W, H, f.width, f.height, t, f);
  });
}

// ── resetFlames ────────────────────────────────────────────────────────
function resetFlames() {
  flameGrowth = 0;
  flameDelay  = FLAME_DELAY_SEC;
  flameCtx.clearRect(0, 0, flameCanvas.width, flameCanvas.height);
}

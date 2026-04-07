// ── Keyboard ───────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  tryBindKeyboard();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key))
    e.preventDefault();
});
window.addEventListener('keyup', e => {
  keys[e.key] = false;
  // Clear both cases so Shift held/released mid-key doesn't leave keys stuck
  if (e.key.length === 1) {
    keys[e.key.toLowerCase()] = false;
    keys[e.key.toUpperCase()] = false;
  }
});

// Previous-frame arrow state (single-trigger color change)
const prevArrow = { left: false, right: false };

// ── Attack input (mouse left for P1, gamepad button 0 / A for P2-P4) ──
let attackPressed  = false; // P1 attack: true only on the frame the button was pressed
let _mouseDown     = false; // raw mouse button state
window.addEventListener('mousedown', e => {
  if (e.button === 0 && !_mouseDown) {
    _mouseDown = true; attackPressed = true;
    if (!e.target.closest('#btn-start')) tryBindKeyboard();
  }
});
window.addEventListener('mouseup', e => { if (e.button === 0) _mouseDown = false; });
window.addEventListener('contextmenu', e => e.preventDefault());

// ── Dash input (SPACE for P1, gamepad button 0 / A for P2-P4) ──────────
// Note: gamepad button 0 doubles as dash (normal) and bubble-pop (in-bubble).
let dashPressed  = false; // true only on the frame the button was pressed
let _spaceDown   = false; // raw space key state
window.addEventListener('keydown', e => {
  if (e.key === ' ' && !_spaceDown) { _spaceDown = true; dashPressed = true; }
});
window.addEventListener('keyup', e => { if (e.key === ' ') _spaceDown = false; });

// ── Gamepad ────────────────────────────────────────────────────────────
const gpPrev = [{}, {}, {}, {}]; // previous button states per player index (0–3)

// ── Helpers ────────────────────────────────────────────────────────────
function applyDeadzone(v) { return Math.abs(v) < DEADZONE ? 0 : v; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Player bindings (start-screen assignment) ──────────────────────────
// playerBindings[i] = null | { type:'keyboard' } | { type:'gamepad', gpIndex:number }
const playerBindings = [null, null, null, null];

function _nextFreeSlot() {
  return playerBindings.findIndex(b => b === null);
}

function tryBindKeyboard() {
  if (gameStarted) return;
  if (playerBindings.some(b => b && b.type === 'keyboard')) return;
  const slot = _nextFreeSlot();
  if (slot === -1) return;
  playerBindings[slot] = { type: 'keyboard' };
  _refreshBindingUI(slot);
}

function tryBindGamepad(gpIndex) {
  if (gameStarted) return;
  if (playerBindings.some(b => b && b.type === 'gamepad' && b.gpIndex === gpIndex)) return;
  const slot = _nextFreeSlot();
  if (slot === -1) return;
  playerBindings[slot] = { type: 'gamepad', gpIndex };
  _refreshBindingUI(slot);
}

function _refreshBindingUI(slot) {
  const b     = playerBindings[slot];
  const el    = document.getElementById(`s${slot + 1}`);
  const label = b.type === 'keyboard' ? 'Keyboard' : `Gamepad ${b.gpIndex + 1}`;
  el.textContent = `${slot + 1}P · ${label}`;
  el.className   = 'si on';

  // Update join-confirm box
  const slots = document.querySelectorAll('.player-slot');
  const hint  = slots[slot]?.querySelector('.player-slot-hint');
  if (hint) { hint.textContent = 'Ready'; hint.classList.add('ready'); slots[slot].classList.add('ready'); }

  // Enable START once at least one player is ready
  document.getElementById('btn-start').disabled = false;
}

function resetBindings() {
  for (let i = 0; i < 4; i++) {
    playerBindings[i] = null;
    const el = document.getElementById(`s${i + 1}`);
    el.textContent = `${i + 1}P · --------`;
    el.className   = 'si';
  }
  // Reset all join-confirm boxes
  document.querySelectorAll('.player-slot-hint').forEach(h => {
    h.textContent = 'Press Any Key';
    h.classList.remove('ready');
  });
  document.querySelectorAll('.player-slot').forEach(s => s.classList.remove('ready'));
  document.getElementById('btn-start').disabled = true;
}

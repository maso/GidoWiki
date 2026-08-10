import { EMOTES } from './emoteData.js';
import { createEmoteWheelState, pointToSegment, vectorToSegment, CENTER } from './emoteWheelState.js';

/* ═══════════════════════════════════════
   EMOTE WHEEL UI (表情輪盤)

   Home screen only — suppressed while any other panel is open.

   Gamepad : push the right stick to open; rest on a segment for 0.5s to pick
             it, or let the stick return to centre for 0.5s to cancel.
   Keyboard: hold Left Shift to open, aim with the mouse. Click a segment, or
             release Shift while aiming at one, to pick it. Releasing Shift
             over the centre cancels.
═══════════════════════════════════════ */

const RING_RADIUS_EM = 9;      // distance from wheel centre to each pod
const CENTER_RADIUS_PX = 46;   // cursor inside this radius counts as cancel
const STICK_DEADZONE = 0.45;   // right stick push needed to leave the centre
const STICK_OPEN_THRESHOLD = 0.6;

export function initEmoteWheel(options = {}) {
  const {
    isSuppressed = () => false,   // true while another panel owns the screen
    onSelect = () => {},
    onOpen = () => {},
    onClose = () => {},
  } = options;

  const root = document.getElementById('emote-wheel');
  const ring = document.getElementById('emote-wheel-ring');
  const centerPod = document.getElementById('emote-wheel-cancel');
  if (!root || !ring || !centerPod) return { poll: () => {}, isOpen: () => false };

  const state = createEmoteWheelState({ segmentCount: EMOTES.length });
  const pods = [];

  // Right stick must return to neutral before it can re-open the wheel,
  // otherwise a still-held stick would immediately trigger a second round.
  let stickArmed = true;
  let shiftHeld = false;
  let lastPointer = null; // {x, y} in client coords

  /* ── Build pods laid out clockwise from 12 o'clock ── */
  EMOTES.forEach((emote, index) => {
    const angle = (index / EMOTES.length) * Math.PI * 2; // 0 = up
    const x = Math.sin(angle) * RING_RADIUS_EM;
    const y = -Math.cos(angle) * RING_RADIUS_EM;

    const pod = document.createElement('button');
    pod.type = 'button';
    pod.className = 'emote-pod';
    pod.style.transform = `translate(-50%, -50%) translate(${x}em, ${y}em)`;
    pod.innerHTML = `<span>${emote.emoji}</span>`;
    pod.setAttribute('aria-label', emote.name);
    pod.addEventListener('mouseenter', () => state.setFocus(index, performance.now()));
    pod.addEventListener('click', (event) => {
      event.preventDefault();
      commitSelection(index);
    });
    ring.appendChild(pod);
    pods.push(pod);
  });

  centerPod.addEventListener('click', (event) => {
    event.preventDefault();
    hide();
  });

  /* ── Rendering ── */
  function render() {
    const focus = state.getFocus();
    const locked = state.isSelected();
    pods.forEach((pod, index) => {
      pod.classList.toggle('focused', !locked && focus === index);
      pod.classList.toggle('chosen', locked && focus === index);
    });
    centerPod.classList.toggle('focused', !locked && focus === CENTER);
  }

  function show() {
    if (!state.open(performance.now())) return;
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    render();
    onOpen();
  }

  function hide() {
    if (!state.close()) return;
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
    render();
    onClose();
  }

  function commitSelection(index) {
    if (!state.select(index, performance.now())) return;
    render();
    onSelect(EMOTES[index], index);
  }

  /** Applies whatever the state machine's timers decided this frame. */
  function applyTick(now) {
    const event = state.tick(now);
    if (event === 'selected') {
      render();
      onSelect(EMOTES[state.getSelectedIndex()], state.getSelectedIndex());
    } else if (event === 'cancelled' || event === 'hidden') {
      root.classList.remove('open');
      root.setAttribute('aria-hidden', 'true');
      render();
      onClose();
    }
  }

  /* ── Keyboard / mouse ── */
  function focusFromPointer(now) {
    if (!lastPointer || state.isSelected()) return;
    const rect = ring.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const segment = pointToSegment(
      lastPointer.x - cx,
      lastPointer.y - cy,
      EMOTES.length,
      CENTER_RADIUS_PX,
    );
    state.setFocus(segment, now);
    render();
  }

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'ShiftLeft' || event.repeat) return;
    shiftHeld = true;
    if (isSuppressed() || state.isOpen()) return;
    show();
    focusFromPointer(performance.now());
  });

  window.addEventListener('keyup', (event) => {
    if (event.code !== 'ShiftLeft') return;
    shiftHeld = false;
    if (!state.isOpen() || state.isSelected()) return;
    const focus = state.getFocus();
    // Releasing Shift over a segment commits it; over the centre it cancels.
    if (focus === CENTER) hide();
    else commitSelection(focus);
  });

  window.addEventListener('mousemove', (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
    if (state.isOpen()) focusFromPointer(performance.now());
  });

  // Swallow clicks that land on the backdrop so they can't reach the 3D scene.
  root.addEventListener('click', (event) => {
    if (event.target === root) hide();
  });

  /* ── Per-frame polling (gamepad + timers) ── */
  function poll() {
    const now = performance.now();

    if (state.isOpen() && isSuppressed()) {
      hide();
      return;
    }

    const gamepads = (typeof navigator !== 'undefined' && navigator.getGamepads)
      ? navigator.getGamepads()
      : [];
    const gamepad = [...gamepads].find(Boolean);

    if (gamepad) {
      const rx = gamepad.axes[2] || 0;
      const ry = -(gamepad.axes[3] || 0); // gamepad Y grows downward
      const magnitude = Math.hypot(rx, ry);

      if (!state.isOpen()) {
        if (magnitude < STICK_DEADZONE) stickArmed = true;
        if (stickArmed && magnitude >= STICK_OPEN_THRESHOLD && !isSuppressed()) {
          stickArmed = false;
          show();
          state.setFocus(vectorToSegment(rx, ry, EMOTES.length, STICK_DEADZONE), now);
          render();
        }
      } else if (!state.isSelected() && !shiftHeld) {
        // Shift-held sessions are mouse-aimed; don't let a resting stick fight it.
        const segment = vectorToSegment(rx, ry, EMOTES.length, STICK_DEADZONE);
        if (state.setFocus(segment, now)) render();
      }
    }

    if (state.isOpen()) applyTick(now);
  }

  return {
    poll,
    isOpen: () => state.isOpen(),
    close: hide,
  };
}

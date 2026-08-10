/* ═══════════════════════════════════════
   INPUT MODE TRACKER (鍵鼠 / 手把 偵測)

   Tracks whichever device the player most recently used and exposes the
   matching on-screen button hints:

     keyboard/mouse → Q / E     (shoulder-equivalent keys)
     gamepad        → LB / RB

   The tracker itself is a pure state machine (no DOM, no navigator) so it
   can be unit tested; `initInputMode()` wires it to real browser events.
═══════════════════════════════════════ */

export const KBM = 'kbm';
export const GAMEPAD = 'gamepad';

export const SHOULDER_LABELS = {
  [KBM]:     { left: 'Q',  right: 'E'  },
  [GAMEPAD]: { left: 'LB', right: 'RB' },
};

/**
 * Body classes reflecting the active device. CSS uses these to show/hide
 * gamepad-only chrome (the Ⓑ back badges, the Ⓨ accessory badge) via the
 * `.gp-only` utility class.
 */
export const MODE_BODY_CLASSES = {
  [KBM]: 'input-kbm',
  [GAMEPAD]: 'input-gamepad',
};

/** Axis magnitude a stick must exceed to count as deliberate input. */
export const STICK_DEADZONE = 0.35;

/** Mouse must travel this far (px) to count — filters out scroll-induced events. */
export const MOUSE_MOVE_THRESHOLD = 4;

/**
 * True when the gamepad shows deliberate activity (any button held, or any
 * stick pushed past the deadzone). Pure: takes a Gamepad-shaped object.
 */
export function isGamepadActive(gamepad, deadzone = STICK_DEADZONE) {
  if (!gamepad) return false;
  const buttons = gamepad.buttons || [];
  for (const button of buttons) {
    if (button?.pressed || (typeof button?.value === 'number' && button.value > 0.5)) return true;
  }
  const axes = gamepad.axes || [];
  for (const axis of axes) {
    if (typeof axis === 'number' && Math.abs(axis) > deadzone) return true;
  }
  return false;
}

export function createInputModeTracker(initialMode = KBM) {
  let mode = initialMode === GAMEPAD ? GAMEPAD : KBM;
  const listeners = new Set();

  function setMode(nextMode) {
    if (nextMode !== KBM && nextMode !== GAMEPAD) return false;
    if (nextMode === mode) return false;
    mode = nextMode;
    listeners.forEach(listener => listener(mode));
    return true;
  }

  return {
    getMode: () => mode,
    setMode,
    useKeyboardMouse: () => setMode(KBM),
    useGamepad: () => setMode(GAMEPAD),
    getShoulderLabels: () => SHOULDER_LABELS[mode],
    isGamepad: () => mode === GAMEPAD,
    /** Calls listener immediately with the current mode, then on every change. */
    subscribe(listener) {
      listeners.add(listener);
      listener(mode);
      return () => listeners.delete(listener);
    },
  };
}

/** Shared tracker used across UI modules. */
export const inputMode = createInputModeTracker(KBM);

/**
 * Wires the shared tracker to browser input. Returns a `pollGamepad` to be
 * called each frame from the main animation loop.
 */
export function initInputMode(tracker = inputMode) {
  let lastX = null;
  let lastY = null;

  // Drive gamepad-only chrome from a body class so any `.gp-only` element
  // hides/shows without needing its own subscription.
  tracker.subscribe((mode) => {
    const body = document.body;
    if (!body) return;
    Object.values(MODE_BODY_CLASSES).forEach(cls => body.classList.remove(cls));
    body.classList.add(MODE_BODY_CLASSES[mode]);
  });

  window.addEventListener('keydown', () => tracker.useKeyboardMouse());
  window.addEventListener('mousedown', () => tracker.useKeyboardMouse());
  window.addEventListener('wheel', () => tracker.useKeyboardMouse(), { passive: true });

  // Only real cursor travel counts: smooth-scrolling a list under a stationary
  // cursor also fires mousemove, which would wrongly flip out of gamepad mode.
  // The position is always recorded, but a lone event with no prior sample to
  // compare against never switches mode — it just seeds the baseline. A real
  // mouse movement fires a stream of events, so the switch still feels instant.
  window.addEventListener('mousemove', (event) => {
    const hasBaseline = lastX !== null;
    const travelled = hasBaseline && Math.hypot(event.clientX - lastX, event.clientY - lastY) >= MOUSE_MOVE_THRESHOLD;
    lastX = event.clientX;
    lastY = event.clientY;
    if (travelled) tracker.useKeyboardMouse();
  });

  window.addEventListener('gamepadconnected', () => {
    // Connecting alone isn't proof of use — wait for actual button/stick input.
  });

  return {
    pollGamepad(overrideGamepads) {
      const gamepads = overrideGamepads
        || (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
      for (const gamepad of gamepads) {
        if (isGamepadActive(gamepad)) {
          tracker.useGamepad();
          return;
        }
      }
    },
  };
}

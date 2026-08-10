/* ═══════════════════════════════════════
   EMOTE WHEEL STATE MACHINE

   Pure logic — no DOM, no navigator, no timers. Time is always passed in by
   the caller so the whole thing is deterministic and unit testable.

   Lifecycle:
     closed --open()--> open --select()--> selected --(hide delay)--> closed
     open --(cancel dwell 0.5s at centre)--> closed

   Committing is always an explicit act by the caller: releasing the stick,
   clicking, or letting go of Shift. Hovering a segment never commits.

   The only timed transition is the cancel dwell: resting at the centre for
   0.5s closes the wheel. That is a gamepad affordance (a stick guided home is
   how the player backs out), so mouse sessions open with it disabled.
═══════════════════════════════════════ */

/** Focus value meaning "the cancel hole in the middle". */
export const CENTER = -1;

export const DEFAULT_DWELL_MS = 500;
export const DEFAULT_HIDE_DELAY_MS = 300;

/**
 * Maps a direction vector to a wheel segment.
 *
 * Uses maths convention: +x right, +y UP. Callers must flip the sign of
 * gamepad axis 3 and of screen-space Y, both of which grow downward.
 * Segment 0 sits at 12 o'clock and indices increase clockwise.
 *
 * Returns CENTER when the vector is shorter than `deadzone`.
 */
export function vectorToSegment(x, y, segmentCount = 6, deadzone = 0.4) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return CENTER;
  if (Math.hypot(x, y) < deadzone) return CENTER;

  const sliceDeg = 360 / segmentCount;
  // atan2(x, y) gives 0° pointing up and grows clockwise — exactly our layout.
  const deg = (Math.atan2(x, y) * 180) / Math.PI;
  const normalised = (deg + 360) % 360;
  // Shift by half a slice so segment 0 is centred on 12 o'clock.
  return Math.floor(((normalised + sliceDeg / 2) % 360) / sliceDeg);
}

/** Screen-space helper: cursor offset from wheel centre → segment. */
export function pointToSegment(dx, dy, segmentCount = 6, deadzonePx = 0) {
  if (Math.hypot(dx, dy) < deadzonePx) return CENTER;
  return vectorToSegment(dx, -dy, segmentCount, 0);
}

export function createEmoteWheelState({
  segmentCount = 6,
  dwellMs = DEFAULT_DWELL_MS,
  hideDelayMs = DEFAULT_HIDE_DELAY_MS,
} = {}) {
  let phase = 'closed';      // 'closed' | 'open' | 'selected'
  let focus = CENTER;
  let focusSince = 0;
  let selectedIndex = null;
  let selectedAt = 0;
  let cancelDwellEnabled = true;

  function open(now = 0, { cancelDwell = true } = {}) {
    if (phase !== 'closed') return false;
    phase = 'open';
    focus = CENTER;
    focusSince = now;
    selectedIndex = null;
    cancelDwellEnabled = cancelDwell;
    return true;
  }

  function close() {
    if (phase === 'closed') return false;
    phase = 'closed';
    focus = CENTER;
    selectedIndex = null;
    return true;
  }

  /** Moves focus; restarts the dwell timer only when the target changes. */
  function setFocus(nextFocus, now = 0) {
    if (phase !== 'open') return false;
    const normalised = (Number.isInteger(nextFocus) && nextFocus >= 0 && nextFocus < segmentCount)
      ? nextFocus
      : CENTER;
    if (normalised === focus) return false;
    focus = normalised;
    focusSince = now;
    return true;
  }

  /** Commits a selection immediately (mouse click, or Shift released on a segment). */
  function select(index, now = 0) {
    if (phase !== 'open') return false;
    if (!Number.isInteger(index) || index < 0 || index >= segmentCount) return false;
    phase = 'selected';
    focus = index;
    selectedIndex = index;
    selectedAt = now;
    return true;
  }

  /**
   * Advances dwell/hide timers.
   * Returns 'selected' | 'cancelled' | 'hidden' | null describing what just
   * happened, so the caller can fire side effects exactly once.
   */
  function tick(now) {
    if (phase === 'open') {
      // Resting on a segment never commits — only an explicit act does.
      if (!cancelDwellEnabled || focus !== CENTER) return null;
      if (now - focusSince < dwellMs) return null;
      close();
      return 'cancelled';
    }
    if (phase === 'selected' && now - selectedAt >= hideDelayMs) {
      close();
      return 'hidden';
    }
    return null;
  }

  return {
    open,
    close,
    setFocus,
    select,
    tick,
    getPhase: () => phase,
    getFocus: () => focus,
    getSelectedIndex: () => selectedIndex,
    isOpen: () => phase !== 'closed',
    /** True once a choice is locked in — used to freeze focus highlighting. */
    isSelected: () => phase === 'selected',
    isCancelDwellEnabled: () => cancelDwellEnabled,
    getSegmentCount: () => segmentCount,
  };
}

import { EMOTES } from './emoteData.js';
import { createEmoteWheelState, pointToSegment, vectorToSegment, CENTER } from './emoteWheelState.js';
import { createStickReleaseDetector } from './stickRelease.js';

/* ═══════════════════════════════════════
   EMOTE WHEEL UI (表情輪盤)

   Valorant-style radial menu: thin white spokes radiating from a centre ring,
   each slice labelled with an emoji and its name. Home screen only —
   suppressed while the skin, encyclopedia or background panels are open.

   Gamepad : push the right stick to open, aim, then let go — the spring
             snapping home commits the slice you were on. Guiding the stick
             back to centre by hand instead and holding it there for 0.5s
             cancels. (See stickRelease.js for how the two are told apart.)
   Keyboard: hold Left Shift to open and aim with the mouse. Hovering only
             highlights — committing needs a click or releasing Shift. Doing
             either over the centre cancels.
═══════════════════════════════════════ */

const SVG_NS = 'http://www.w3.org/2000/svg';

// Geometry is defined in SVG user units on a -100..100 viewBox, then mirrored
// into em for the HTML labels so both stay in sync from one set of numbers.
const VIEW = 100;
const INNER_R = 27;   // centre ring radius (the cancel hole)
const OUTER_R = 97;   // where the spokes stop
const LABEL_R = 66;   // where emoji + name sit
const RING_SIZE_EM = 26;
const UNIT_TO_EM = RING_SIZE_EM / (VIEW * 2);

const CENTER_RADIUS_PX = 46;   // cursor inside this radius counts as cancel

/**
 * Stick geometry. These are *logical* zones and deliberately unrelated to the
 * drawn centre ring — the cancel target is far bigger than it looks, so easing
 * the stick back a little already reads as "returning to centre".
 *
 * STICK_CENTER_RADIUS must stay below STICK_OPEN_THRESHOLD, otherwise the push
 * that opens the wheel would land inside the cancel zone and immediately start
 * counting down to close it.
 */
const STICK_CENTER_RADIUS = 0.65;
const STICK_OPEN_THRESHOLD = 0.8;
/**
 * How long the stick must stay inside the centre zone before the aim is
 * forgotten. Must exceed RELEASE_WINDOW_MS so a spring snap-back — which
 * crosses the zone on its way home — is never mistaken for backing out.
 */
const CENTER_SETTLE_MS = 120;

/** Polar (degrees clockwise from 12 o'clock) → SVG cartesian. */
function polar(angleDeg, radius) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.sin(rad) * radius, y: -Math.cos(rad) * radius };
}

/** Annular wedge path spanning [startDeg, endDeg] between INNER_R and OUTER_R. */
function wedgePath(startDeg, endDeg) {
  const outerStart = polar(startDeg, OUTER_R);
  const outerEnd = polar(endDeg, OUTER_R);
  const innerEnd = polar(endDeg, INNER_R);
  const innerStart = polar(startDeg, INNER_R);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${innerStart.x} ${innerStart.y}`,
    `L ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function initEmoteWheel(options = {}) {
  const {
    isSuppressed = () => false,
    onSelect = () => {},
    onOpen = () => {},
    onClose = () => {},
  } = options;

  const root = document.getElementById('emote-wheel');
  const ring = document.getElementById('emote-wheel-ring');
  const centerPod = document.getElementById('emote-wheel-cancel');
  if (!root || !ring || !centerPod) return { poll: () => {}, isOpen: () => false };

  // hideDelay 0: a committed choice closes the wheel straight away.
  const state = createEmoteWheelState({ segmentCount: EMOTES.length, hideDelayMs: 0 });
  const wedges = [];
  const labels = [];
  const sliceDeg = 360 / EMOTES.length;

  const release = createStickReleaseDetector();

  // Right stick must return to neutral before it can re-open the wheel,
  // otherwise a still-held stick would immediately trigger a second round.
  let stickArmed = true;
  let lastPointer = null;
  // Last slice the stick actually pointed at. Kept so a release can commit it
  // even though the stick is already back at centre by the time we notice.
  let lastStickSegment = null;
  // When the stick first entered the centre zone, or null while it is outside.
  let centerSince = null;

  /* ── Build the radial artwork ── */
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'emote-wheel-svg');
  svg.setAttribute('viewBox', `${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`);
  svg.setAttribute('aria-hidden', 'true');

  // Translucent black disc so the wheel stays legible over a bright scene
  const backdrop = document.createElementNS(SVG_NS, 'circle');
  backdrop.setAttribute('class', 'emote-backdrop');
  backdrop.setAttribute('r', OUTER_R);
  svg.appendChild(backdrop);

  EMOTES.forEach((emote, index) => {
    const centreDeg = index * sliceDeg;

    // Slice highlight (invisible until focused)
    const wedge = document.createElementNS(SVG_NS, 'path');
    wedge.setAttribute('class', 'emote-wedge');
    wedge.setAttribute('d', wedgePath(centreDeg - sliceDeg / 2, centreDeg + sliceDeg / 2));
    svg.appendChild(wedge);
    wedges.push(wedge);

    // Spoke on this slice's leading boundary
    const boundaryDeg = centreDeg - sliceDeg / 2;
    const from = polar(boundaryDeg, INNER_R);
    const to = polar(boundaryDeg, OUTER_R);
    const spoke = document.createElementNS(SVG_NS, 'line');
    spoke.setAttribute('class', 'emote-spoke');
    spoke.setAttribute('x1', from.x);
    spoke.setAttribute('y1', from.y);
    spoke.setAttribute('x2', to.x);
    spoke.setAttribute('y2', to.y);
    svg.appendChild(spoke);

    // Emoji + name, placed along the slice's centre line
    const at = polar(centreDeg, LABEL_R);
    const label = document.createElement('div');
    label.className = 'emote-label';
    label.style.transform =
      `translate(-50%, -50%) translate(${at.x * UNIT_TO_EM}em, ${at.y * UNIT_TO_EM}em)`;
    label.innerHTML = `<span class="emote-glyph">${emote.emoji}</span><span class="emote-name">${emote.name}</span>`;
    label.setAttribute('aria-label', emote.name);
    labels.push(label);
  });

  ring.insertBefore(svg, ring.firstChild);
  labels.forEach(label => ring.appendChild(label));

  /* ── Rendering ── */
  function render() {
    const focus = state.getFocus();
    const locked = state.isSelected();
    wedges.forEach((wedge, index) => {
      wedge.classList.toggle('focused', !locked && focus === index);
      wedge.classList.toggle('chosen', locked && focus === index);
    });
    labels.forEach((label, index) => {
      label.classList.toggle('focused', focus === index);
      label.classList.toggle('chosen', locked && focus === index);
    });
    centerPod.classList.toggle('focused', !locked && focus === CENTER);
  }

  /**
   * Anchors the wheel on the cursor, pulled back just enough that no part of
   * it leaves the visible play area. Passing no point re-centres it.
   */
  function positionRing(point) {
    if (!point) {
      ring.style.left = '50%';
      ring.style.top = '50%';
      return;
    }
    const bounds = root.getBoundingClientRect();
    const half = ring.offsetWidth / 2;
    // Too little room to clamp meaningfully — fall back to dead centre.
    if (!half || bounds.width < half * 2 || bounds.height < half * 2) {
      positionRing(null);
      return;
    }
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const x = clamp(point.x - bounds.left, half, bounds.width - half);
    const y = clamp(point.y - bounds.top, half, bounds.height - half);
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
  }

  function show({ cancelDwell, at = null }) {
    if (!state.open(performance.now(), { cancelDwell })) return;
    release.reset();
    lastStickSegment = null;
    centerSince = null;
    positionRing(at); // set before revealing so it never visibly jumps
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
    onSelect(EMOTES[index], index);
    hide(); // committing dismisses the wheel immediately
  }

  /** Commits whatever is currently aimed at; the centre means cancel. */
  function commitFocus() {
    if (!state.isOpen() || state.isSelected()) return;
    const focus = state.getFocus();
    if (focus === CENTER) hide();
    else commitSelection(focus);
  }

  function applyTick(now) {
    const event = state.tick(now);
    if (event === 'selected') {
      onSelect(EMOTES[state.getSelectedIndex()], state.getSelectedIndex());
      hide();
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
    const segment = pointToSegment(
      lastPointer.x - (rect.left + rect.width / 2),
      lastPointer.y - (rect.top + rect.height / 2),
      EMOTES.length,
      CENTER_RADIUS_PX,
    );
    if (state.setFocus(segment, now)) render();
  }

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'ShiftLeft' || event.repeat) return;
    if (isSuppressed() || state.isOpen()) return;
    // Mouse aiming: hovering must never commit or cancel on its own, and the
    // wheel opens around the cursor so every slice is an equal flick away.
    show({ cancelDwell: false, at: lastPointer });
    focusFromPointer(performance.now());
  });

  window.addEventListener('keyup', (event) => {
    if (event.code !== 'ShiftLeft') return;
    // Releasing Shift only commits the session it opened; a gamepad session
    // waits for the stick instead.
    if (state.isCancelDwellEnabled()) return;
    commitFocus();
  });

  // A mouse session is held open by the Shift key, so if the page loses focus
  // its keyup never arrives and the wheel would hang open. Close it instead.
  window.addEventListener('blur', () => {
    if (state.isOpen() && !state.isCancelDwellEnabled()) hide();
  });

  window.addEventListener('mousemove', (event) => {
    lastPointer = { x: event.clientX, y: event.clientY };
    if (state.isOpen()) focusFromPointer(performance.now());
  });

  // Aiming is angular across the whole overlay, so a click anywhere commits
  // whatever slice the cursor points at (and the centre still cancels).
  root.addEventListener('click', (event) => {
    event.preventDefault();
    commitFocus();
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
        if (magnitude < STICK_CENTER_RADIUS) stickArmed = true;
        if (stickArmed && magnitude >= STICK_OPEN_THRESHOLD && !isSuppressed()) {
          stickArmed = false;
          show({ cancelDwell: true }); // gamepad has no cursor — always centred
          const segment = vectorToSegment(rx, ry, EMOTES.length, STICK_CENTER_RADIUS);
          lastStickSegment = segment === CENTER ? null : segment;
          state.setFocus(segment, now);
          release.sample(magnitude, now); // seed the detector with this push
          render();
        }
      } else if (!state.isSelected() && state.isCancelDwellEnabled()) {
        // Only steer sessions the stick actually opened. A mouse session is
        // cursor-aimed, and is identified by having no centre-dwell cancel —
        // deliberately not by a "is Shift down" flag, which stays stuck if the
        // keyup is lost (alt-tab while holding Shift) and would then wedge the
        // gamepad out of the wheel for good.
        const segment = vectorToSegment(rx, ry, EMOTES.length, STICK_CENTER_RADIUS);

        if (segment === CENTER) {
          // Easing the stick back into the generous centre zone reads as
          // backing out, so the cancel dwell starts here rather than waiting
          // for the stick to reach dead centre.
          if (centerSince === null) centerSince = now;
          if (state.setFocus(CENTER, now)) render();
          // A released stick only passes through this zone for a frame or two.
          // Lingering longer means the player really is backing out, so the
          // old aim must not be committed if they let go from here.
          if (now - centerSince > CENTER_SETTLE_MS) lastStickSegment = null;
        } else {
          centerSince = null;
          lastStickSegment = segment;
          if (state.setFocus(segment, now)) render();
        }

        // A genuine release still commits, caught before the dwell elapses.
        if (release.sample(magnitude, now) === 'released' && lastStickSegment !== null) {
          commitSelection(lastStickSegment);
          return;
        }
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

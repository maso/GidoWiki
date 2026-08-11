/* ═══════════════════════════════════════
   GAMEPAD PROBE (temporary diagnostic)

   Shows exactly what the browser reports for the connected controller, so a
   mis-mapped stick can be identified instead of guessed at. Enable by adding
   #gpdebug to the URL, e.g.
     .../GidoHome/dist/#gpdebug

   Displays every axis live, highlights whichever axis pair is moving, and
   shows the magnitude the emote wheel actually reads (axes[2] / axes[3]).
═══════════════════════════════════════ */

const WHEEL_AXIS_X = 2;
const WHEEL_AXIS_Y = 3;
const MOVED = 0.25; // an axis past this is considered "being pushed"

export function initGamepadProbe() {
  const panel = document.createElement('div');
  panel.id = 'gamepad-probe';
  document.body.appendChild(panel);

  const bar = (v) => {
    const filled = Math.round(Math.abs(v) * 10);
    return (v < 0 ? '◄' : ' ') + '█'.repeat(filled).padEnd(10, '·') + (v > 0 ? '►' : ' ');
  };

  function poll() {
    const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
    const gp = [...pads].find(Boolean);

    if (!gp) {
      panel.innerHTML = '<b>NO GAMEPAD SEEN</b><br>'
        + `slots: ${pads.length}<br>`
        + 'Chrome hides pads until you press a<br>BUTTON on them at least once.';
      return;
    }

    const axes = [...gp.axes];
    const pressed = gp.buttons
      .map((b, i) => (b.pressed || b.value > 0.5 ? i : null))
      .filter(i => i !== null);

    const rows = axes.map((v, i) => {
      const hot = Math.abs(v) > MOVED;
      const isWheelAxis = i === WHEEL_AXIS_X || i === WHEEL_AXIS_Y;
      const tag = isWheelAxis ? ' ←wheel' : '';
      return `<div class="${hot ? 'hot' : ''}">axes[${i}] ${v.toFixed(2).padStart(5)} ${bar(v)}${tag}</div>`;
    }).join('');

    const rx = axes[WHEEL_AXIS_X] || 0;
    const ry = axes[WHEEL_AXIS_Y] || 0;
    const magnitude = Math.hypot(rx, ry);

    panel.innerHTML = `<b>${gp.id}</b><br>`
      + `mapping: <b>${gp.mapping || '(empty = NON-standard)'}</b> · axes: ${axes.length} · buttons: ${gp.buttons.length}<br>`
      + `<hr>${rows}<hr>`
      + `wheel reads axes[2],[3] → magnitude <b class="${magnitude >= 0.6 ? 'hot' : ''}">${magnitude.toFixed(2)}</b>`
      + ` (needs ≥ 0.60 to open)<br>`
      + `buttons down: ${pressed.length ? pressed.join(', ') : '—'}`;
  }

  return { poll };
}

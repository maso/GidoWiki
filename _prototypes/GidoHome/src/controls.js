import { ANIMATION_CONFIG } from './config.js';

/* ═══════════════════════════════════════
   GAMEPAD & KEYBOARD NAVIGATION MODULE
═══════════════════════════════════════ */

export function initControls() {
  const focusableElems = [
    ...document.querySelectorAll('.menu-btn'),
    ...document.querySelectorAll('.btm-icon')
  ];

  let focusIdx = 0;
  let lastInputTime = 0;
  let blocked = false;  // true while bg picker (or any sub-panel) is open
  const INPUT_COOLDOWN = ANIMATION_CONFIG.inputCooldown;

  function updateFocus(newIdx) {
    newIdx = Math.max(0, Math.min(newIdx, focusableElems.length - 1));
    focusableElems.forEach(el => el.classList.remove('focused'));
    focusIdx = newIdx;
    const target = focusableElems[focusIdx];
    if (target) {
      target.focus();
      target.classList.add('focused');
    }
  }

  function navDirection(dir) {
    if (blocked) return;
    const now = performance.now();
    if (now - lastInputTime < INPUT_COOLDOWN) return;
    lastInputTime = now;

    if (dir === 'up') {
      if (focusIdx > 0 && focusIdx <= 4) updateFocus(focusIdx - 1);
      else if (focusIdx >= 5) updateFocus(4);
    } else if (dir === 'down') {
      if (focusIdx < 4) updateFocus(focusIdx + 1);
      else if (focusIdx === 4) updateFocus(5);
    } else if (dir === 'left') {
      if (focusIdx > 5) updateFocus(focusIdx - 1);
      else if (focusIdx === 5) updateFocus(4);
    } else if (dir === 'right') {
      if (focusIdx < 5) updateFocus(5);
      else if (focusIdx >= 5 && focusIdx < 7) updateFocus(focusIdx + 1);
    }
  }

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (blocked) return;
    if (e.key === 'ArrowUp')    { e.preventDefault(); navDirection('up'); }
    if (e.key === 'ArrowDown')  { e.preventDefault(); navDirection('down'); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); navDirection('left'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navDirection('right'); }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      focusableElems[focusIdx]?.click();
    }
  });

  // Menu Button click blur (releases focus on mouse click)
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.currentTarget.blur();
    });
  });

  // Gamepad Status Toast & Polling
  const gpToast = document.getElementById('gamepad-toast');
  let gpToastTimer = null;
  let buttonAPressed = false;

  function showGamepadToast(msg) {
    if (gpToast) {
      gpToast.textContent = msg;
      gpToast.classList.add('show');
      clearTimeout(gpToastTimer);
      gpToastTimer = setTimeout(() => gpToast.classList.remove('show'), 3500);
    }
  }

  window.addEventListener('gamepadconnected', (e) => {
    showGamepadToast(`🎮 手把已連線：${e.gamepad.id.split('(')[0].trim()}`);
  });

  window.addEventListener('gamepaddisconnected', () => {
    showGamepadToast('🎮 手把已中斷連線');
  });

  return {
    pollGamepad: () => {
      if (blocked) return;
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;

        const btnUp    = gp.buttons[12]?.pressed;
        const btnDown  = gp.buttons[13]?.pressed;
        const btnLeft  = gp.buttons[14]?.pressed;
        const btnRight = gp.buttons[15]?.pressed;

        const stickX = gp.axes[0] || 0;
        const stickY = gp.axes[1] || 0;

        if (btnUp || stickY < -0.5)    navDirection('up');
        if (btnDown || stickY > 0.5)   navDirection('down');
        if (btnLeft || stickX < -0.5)  navDirection('left');
        if (btnRight || stickX > 0.5) navDirection('right');

        const btnA = gp.buttons[0]?.pressed;
        if (btnA && !buttonAPressed) {
          buttonAPressed = true;
          focusableElems[focusIdx]?.click();
        } else if (!btnA) {
          buttonAPressed = false;
        }
      }
    },

    setBlocked: (val) => { blocked = val; },
  };
}

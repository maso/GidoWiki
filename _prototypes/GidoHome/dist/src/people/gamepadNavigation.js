export function createPeopleGamepadNavigation(handlers = {}) {
  let btnLWas = false;
  let btnRWas = false;
  let btnBWas = false;
  let lastNavTime = 0;
  const NAV_COOLDOWN = 180;

  function poll() {
    if (!handlers.isOpen?.()) return;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gamepads) {
      if (!gp) continue;

      const now = performance.now();

      // ── B Button: Close modal ──
      const btnB = gp.buttons[1]?.pressed;
      if (btnB && !btnBWas) {
        btnBWas = true;
        handlers.onBack?.();
        return;
      } else if (!btnB) {
        btnBWas = false;
      }

      // ── L / R Shoulder Buttons (LB / RB): Switch category tabs ──
      const btnL = gp.buttons[4]?.pressed;
      if (btnL && !btnLWas) {
        btnLWas = true;
        handlers.onStepCategory?.(-1);
      } else if (!btnL) {
        btnLWas = false;
      }

      const btnR = gp.buttons[5]?.pressed;
      if (btnR && !btnRWas) {
        btnRWas = true;
        handlers.onStepCategory?.(1);
      } else if (!btnR) {
        btnRWas = false;
      }

      // ── D-Pad / Left Stick: 4-way grid navigation ──
      if (now - lastNavTime >= NAV_COOLDOWN) {
        const btnUp    = gp.buttons[12]?.pressed;
        const btnDown  = gp.buttons[13]?.pressed;
        const btnLeft  = gp.buttons[14]?.pressed;
        const btnRight = gp.buttons[15]?.pressed;
        const stickX   = gp.axes[0] || 0;
        const stickY   = gp.axes[1] || 0;

        let direction = null;
        if (btnUp || stickY < -0.5) {
          direction = 'up';
        } else if (btnDown || stickY > 0.5) {
          direction = 'down';
        } else if (btnLeft || stickX < -0.5) {
          direction = 'left';
        } else if (btnRight || stickX > 0.5) {
          direction = 'right';
        }

        if (direction) {
          lastNavTime = now;
          handlers.onNavigateGrid?.(direction);
        }
      }
    }
  }

  return { poll };
}

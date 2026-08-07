const GRID_NAV_COOLDOWN = 180;

export function createPeopleGamepadNavigation(handlers = {}) {
  let bWasPressed = false;
  let aWasPressed = false;
  let lWasPressed = false;
  let rWasPressed = false;
  let lastGridNav = -Infinity;

  function poll(overrideGamepads) {
    const gamepads = overrideGamepads || (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
    const gp = [...gamepads].find(Boolean);


    const bPressed = Boolean(gp?.buttons[1]?.pressed);
    const aPressed = Boolean(gp?.buttons[0]?.pressed);
    const lPressed = Boolean(gp?.buttons[4]?.pressed);
    const rPressed = Boolean(gp?.buttons[5]?.pressed);

    if (handlers.isOpen()) {
      if (bPressed && !bWasPressed) handlers.onBack?.();
      if (aPressed && !aWasPressed) handlers.onConfirm?.();
      if (lPressed && !lWasPressed) handlers.onStepCategory?.(-1);
      if (rPressed && !rWasPressed) handlers.onStepCategory?.(1);

      const now = performance.now();
      const stickX = gp?.axes[0] || 0;
      const stickY = gp?.axes[1] || 0;
      let direction = null;

      if (gp?.buttons[12]?.pressed) direction = 'up';
      else if (gp?.buttons[13]?.pressed) direction = 'down';
      else if (gp?.buttons[14]?.pressed) direction = 'left';
      else if (gp?.buttons[15]?.pressed) direction = 'right';
      else if (Math.abs(stickX) > Math.abs(stickY) && stickX < -0.5) direction = 'left';
      else if (Math.abs(stickX) > Math.abs(stickY) && stickX > 0.5) direction = 'right';
      else if (stickY < -0.5) direction = 'up';
      else if (stickY > 0.5) direction = 'down';

      if (now - lastGridNav >= GRID_NAV_COOLDOWN) {
        if (direction) {
          lastGridNav = now;
          handlers.onNavigateGrid?.(direction);
        }
      }
    }

    bWasPressed = bPressed;
    aWasPressed = aPressed;
    lWasPressed = lPressed;
    rWasPressed = rPressed;
  }

  return { poll };
}



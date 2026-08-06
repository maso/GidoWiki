const GRID_NAV_COOLDOWN = 180;

export function createPeopleGamepadNavigation(handlers = {}) {
  let bWasPressed = false;
  let lWasPressed = false;
  let rWasPressed = false;
  let lastGridNav = -Infinity;

  function poll(gamepads = navigator.getGamepads?.() || []) {
    const gamepad = [...gamepads].find(Boolean);
    const bPressed = Boolean(gamepad?.buttons[1]?.pressed);
    const lPressed = Boolean(gamepad?.buttons[4]?.pressed);
    const rPressed = Boolean(gamepad?.buttons[5]?.pressed);

    if (handlers.isOpen()) {
      if (bPressed && !bWasPressed) handlers.onBack?.();
      if (lPressed && !lWasPressed) handlers.onStepCategory?.(-1);
      if (rPressed && !rWasPressed) handlers.onStepCategory?.(1);

      const now = performance.now();
      const stickX = gamepad?.axes[0] || 0;
      const stickY = gamepad?.axes[1] || 0;
      let direction = null;

      if (gamepad?.buttons[12]?.pressed) direction = 'up';
      else if (gamepad?.buttons[13]?.pressed) direction = 'down';
      else if (gamepad?.buttons[14]?.pressed) direction = 'left';
      else if (gamepad?.buttons[15]?.pressed) direction = 'right';
      else if (Math.abs(stickX) > Math.abs(stickY) && stickX < -0.55) direction = 'left';
      else if (Math.abs(stickX) > Math.abs(stickY) && stickX > 0.55) direction = 'right';
      else if (stickY < -0.55) direction = 'up';
      else if (stickY > 0.55) direction = 'down';

      if (now - lastGridNav >= GRID_NAV_COOLDOWN) {
        if (direction) {
          lastGridNav = now;
          handlers.onNavigateGrid?.(direction);
        }
      }
    }

    bWasPressed = bPressed;
    lWasPressed = lPressed;
    rWasPressed = rPressed;
  }

  return { poll };
}


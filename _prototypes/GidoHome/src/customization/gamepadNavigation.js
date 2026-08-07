const CHARACTER_NAV_COOLDOWN = 220;

/** Maps gamepad state to semantic customization actions. */
export function createCustomizationGamepadNavigation(actions) {
  let bWasPressed = false;
  let aWasPressed = false;
  let yWasPressed = false;
  let lWasPressed = false;
  let rWasPressed = false;
  let lastCharacterNav = -Infinity;

  function poll(overrideGamepads) {
    const gamepads = overrideGamepads || (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
    const gamepad = [...gamepads].find(Boolean);


    const bPressed = Boolean(gamepad?.buttons[1]?.pressed);
    const aPressed = Boolean(gamepad?.buttons[0]?.pressed);
    const yPressed = Boolean(gamepad?.buttons[3]?.pressed);
    const lPressed = Boolean(gamepad?.buttons[4]?.pressed);
    const rPressed = Boolean(gamepad?.buttons[5]?.pressed);

    if (actions.isOpen()) {
      if (bPressed && !bWasPressed) actions.onBack();
      if (aPressed && !aWasPressed) actions.onConfirm?.();
      if (yPressed && !yWasPressed) actions.onAccessory();
      if (lPressed && !lWasPressed) actions.onStepSkin(-1);
      if (rPressed && !rWasPressed) actions.onStepSkin(1);

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

      if (now - lastCharacterNav >= CHARACTER_NAV_COOLDOWN) {
        if (direction) {
          lastCharacterNav = now;
          actions.onNavigateCharacter(direction);
        }
      }
    }

    bWasPressed = bPressed;
    aWasPressed = aPressed;
    yWasPressed = yPressed;
    lWasPressed = lPressed;
    rWasPressed = rPressed;
  }

  return { poll };
}

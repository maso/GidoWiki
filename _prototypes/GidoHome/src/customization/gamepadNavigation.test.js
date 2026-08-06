import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomizationGamepadNavigation } from './gamepadNavigation.js';

function makeGamepad() {
  return {
    buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    axes: [0, 0],
  };
}

test('maps Y, A, and four-way navigation to customization actions', () => {
  const calls = { accessory: 0, confirm: 0, directions: [] };
  const navigation = createCustomizationGamepadNavigation({
    isOpen: () => true,
    onBack: () => {},
    onAccessory: () => { calls.accessory += 1; },
    onStepSkin: () => {},
    onNavigateCharacter: direction => calls.directions.push(direction),
    onConfirm: () => { calls.confirm += 1; },
  });
  const gamepad = makeGamepad();

  gamepad.buttons[3].pressed = true;
  navigation.poll([gamepad]);
  navigation.poll([gamepad]);
  gamepad.buttons[3].pressed = false;
  navigation.poll([gamepad]);

  gamepad.buttons[0].pressed = true;
  navigation.poll([gamepad]);
  gamepad.buttons[0].pressed = false;
  navigation.poll([gamepad]);

  gamepad.buttons[15].pressed = true;
  navigation.poll([gamepad]);

  assert.equal(calls.accessory, 1);
  assert.equal(calls.confirm, 1);
  assert.deepEqual(calls.directions, ['right']);
});


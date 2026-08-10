import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInputModeTracker,
  isGamepadActive,
  KBM,
  GAMEPAD,
  SHOULDER_LABELS,
} from './inputMode.js';

const gp = ({ buttons = [], axes = [] } = {}) => ({ buttons, axes });

test('defaults to keyboard/mouse mode with Q/E hints', () => {
  const tracker = createInputModeTracker();
  assert.equal(tracker.getMode(), KBM);
  assert.deepEqual(tracker.getShoulderLabels(), { left: 'Q', right: 'E' });
  assert.equal(tracker.isGamepad(), false);
});

test('switching to gamepad swaps hints to LB/RB', () => {
  const tracker = createInputModeTracker();
  assert.equal(tracker.useGamepad(), true);
  assert.equal(tracker.getMode(), GAMEPAD);
  assert.deepEqual(tracker.getShoulderLabels(), { left: 'LB', right: 'RB' });
  assert.equal(tracker.isGamepad(), true);
});

test('repeating the current mode reports no change', () => {
  const tracker = createInputModeTracker();
  assert.equal(tracker.useKeyboardMouse(), false);
  tracker.useGamepad();
  assert.equal(tracker.useGamepad(), false);
});

test('rejects unknown modes', () => {
  const tracker = createInputModeTracker();
  assert.equal(tracker.setMode('touch'), false);
  assert.equal(tracker.getMode(), KBM);
});

test('subscribers fire immediately and on every change', () => {
  const tracker = createInputModeTracker();
  const seen = [];
  const unsubscribe = tracker.subscribe(mode => seen.push(mode));
  assert.deepEqual(seen, [KBM]);

  tracker.useGamepad();
  tracker.useGamepad(); // no-op, must not notify twice
  tracker.useKeyboardMouse();
  assert.deepEqual(seen, [KBM, GAMEPAD, KBM]);

  unsubscribe();
  tracker.useGamepad();
  assert.deepEqual(seen, [KBM, GAMEPAD, KBM]);
});

test('detects gamepad button presses and analog triggers', () => {
  assert.equal(isGamepadActive(gp({ buttons: [{ pressed: true }] })), true);
  assert.equal(isGamepadActive(gp({ buttons: [{ pressed: false, value: 0.9 }] })), true);
  assert.equal(isGamepadActive(gp({ buttons: [{ pressed: false, value: 0.1 }] })), false);
});

test('detects stick pushes beyond the deadzone but ignores drift', () => {
  assert.equal(isGamepadActive(gp({ axes: [0.8, 0] })), true);
  assert.equal(isGamepadActive(gp({ axes: [0, -0.6] })), true);
  assert.equal(isGamepadActive(gp({ axes: [0.12, -0.09] })), false, 'idle stick drift must not count');
});

test('ignores absent or empty gamepad slots', () => {
  assert.equal(isGamepadActive(null), false);
  assert.equal(isGamepadActive(undefined), false);
  assert.equal(isGamepadActive(gp()), false);
});

test('exposes a label pair for every supported mode', () => {
  assert.deepEqual(Object.keys(SHOULDER_LABELS).sort(), [GAMEPAD, KBM].sort());
  for (const labels of Object.values(SHOULDER_LABELS)) {
    assert.ok(labels.left && labels.right);
  }
});

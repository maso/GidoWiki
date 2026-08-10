import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmoteWheelState,
  vectorToSegment,
  pointToSegment,
  CENTER,
} from './emoteWheelState.js';

test('maps stick directions to the six clockwise segments from 12 o’clock', () => {
  assert.equal(vectorToSegment(0, 1), 0, 'up');
  assert.equal(vectorToSegment(0.87, 0.5), 1, 'upper right');
  assert.equal(vectorToSegment(0.87, -0.5), 2, 'lower right');
  assert.equal(vectorToSegment(0, -1), 3, 'down');
  assert.equal(vectorToSegment(-0.87, -0.5), 4, 'lower left');
  assert.equal(vectorToSegment(-0.87, 0.5), 5, 'upper left');
});

test('treats a centred or barely-moved stick as the cancel hole', () => {
  assert.equal(vectorToSegment(0, 0), CENTER);
  assert.equal(vectorToSegment(0.2, 0.2), CENTER, 'inside the deadzone');
  assert.equal(vectorToSegment(NaN, 1), CENTER);
});

test('segment boundaries land on the expected side', () => {
  // Slice 0 spans -30°..+30°, so 29° is still segment 0 and 31° is segment 1.
  const rad = deg => (deg * Math.PI) / 180;
  assert.equal(vectorToSegment(Math.sin(rad(29)), Math.cos(rad(29))), 0);
  assert.equal(vectorToSegment(Math.sin(rad(31)), Math.cos(rad(31))), 1);
});

test('pointToSegment flips screen-space Y so up on screen is segment 0', () => {
  assert.equal(pointToSegment(0, -100), 0, 'cursor above centre');
  assert.equal(pointToSegment(0, 100), 3, 'cursor below centre');
  assert.equal(pointToSegment(5, 5, 6, 30), CENTER, 'inside centre radius');
});

test('resting on a segment never commits, however long it is held', () => {
  const wheel = createEmoteWheelState({ dwellMs: 500 });
  wheel.open(0);
  wheel.setFocus(2, 100);
  assert.equal(wheel.tick(600), null);
  assert.equal(wheel.tick(10000), null, 'holding for 10s must still not commit');
  assert.equal(wheel.getPhase(), 'open');
  assert.equal(wheel.getSelectedIndex(), null);
});

test('re-focusing the same segment reports no change', () => {
  const wheel = createEmoteWheelState({ dwellMs: 500 });
  wheel.open(0);
  wheel.setFocus(3, 0);
  assert.equal(wheel.setFocus(3, 400), false);
});

test('dwelling at the centre cancels', () => {
  const wheel = createEmoteWheelState({ dwellMs: 500 });
  wheel.open(0);
  wheel.setFocus(2, 100);
  wheel.setFocus(CENTER, 300); // stick returned to neutral
  assert.equal(wheel.tick(700), null);
  assert.equal(wheel.tick(800), 'cancelled');
  assert.equal(wheel.isOpen(), false);
  assert.equal(wheel.getSelectedIndex(), null);
});

test('hides on its own after the post-selection delay', () => {
  const wheel = createEmoteWheelState({ dwellMs: 500, hideDelayMs: 300 });
  wheel.open(0);
  wheel.select(5, 1000);
  assert.equal(wheel.tick(1200), null, 'still showing the highlight');
  assert.equal(wheel.tick(1300), 'hidden');
  assert.equal(wheel.isOpen(), false);
});

test('an immediate click selects without waiting for the dwell', () => {
  const wheel = createEmoteWheelState();
  wheel.open(0);
  assert.equal(wheel.select(1, 50), true);
  assert.equal(wheel.getPhase(), 'selected');
  assert.equal(wheel.getSelectedIndex(), 1);
});

test('rejects out-of-range selections and input while closed', () => {
  const wheel = createEmoteWheelState({ segmentCount: 6 });
  assert.equal(wheel.select(2, 0), false, 'closed wheel ignores selection');
  wheel.open(0);
  assert.equal(wheel.select(6, 0), false, 'index past the last segment');
  assert.equal(wheel.select(-2, 0), false);
  assert.equal(wheel.getPhase(), 'open');
});

test('focus is clamped to the cancel hole for invalid targets', () => {
  const wheel = createEmoteWheelState({ segmentCount: 6 });
  wheel.open(0);
  wheel.setFocus(9, 0);
  assert.equal(wheel.getFocus(), CENTER);
});

test('mouse sessions disable the centre-dwell cancel', () => {
  const wheel = createEmoteWheelState({ dwellMs: 500 });
  wheel.open(0, { cancelDwell: false });
  assert.equal(wheel.isCancelDwellEnabled(), false);

  wheel.setFocus(CENTER, 0);
  assert.equal(wheel.tick(10000), null, 'resting at centre must not cancel');
  assert.equal(wheel.isOpen(), true);
});

test('mouse sessions still auto-hide after an explicit selection', () => {
  const wheel = createEmoteWheelState({ hideDelayMs: 300 });
  wheel.open(0, { cancelDwell: false });
  wheel.select(1, 1000);
  assert.equal(wheel.tick(1200), null);
  assert.equal(wheel.tick(1300), 'hidden');
  assert.equal(wheel.isOpen(), false);
});

test('the cancel dwell defaults to on for gamepad sessions', () => {
  const wheel = createEmoteWheelState({ dwellMs: 500 });
  wheel.open(0);
  assert.equal(wheel.isCancelDwellEnabled(), true);
  wheel.setFocus(CENTER, 0);
  assert.equal(wheel.tick(500), 'cancelled');
});

test('opening twice is a no-op and selection freezes further focus changes', () => {
  const wheel = createEmoteWheelState();
  assert.equal(wheel.open(0), true);
  assert.equal(wheel.open(10), false);
  wheel.select(0, 10);
  assert.equal(wheel.setFocus(3, 20), false, 'focus locked after selecting');
  assert.equal(wheel.getFocus(), 0);
});

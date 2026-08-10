import test from 'node:test';
import assert from 'node:assert/strict';
import { createStickReleaseDetector } from './stickRelease.js';

/** Feeds a magnitude timeline, returning every non-null verdict with its time. */
function run(detector, samples) {
  const verdicts = [];
  for (const [now, magnitude] of samples) {
    const verdict = detector.sample(magnitude, now);
    if (verdict) verdicts.push([now, verdict]);
  }
  return verdicts;
}

test('a spring snap-back reads as released', () => {
  const d = createStickReleaseDetector();
  // Pushed out, then home within two 60fps frames.
  const verdicts = run(d, [[0, 0.9], [16, 0.95], [32, 0.5], [48, 0.05]]);
  assert.deepEqual(verdicts, [[48, 'released']]);
});

test('a single-frame snap from full deflection to centre reads as released', () => {
  const d = createStickReleaseDetector();
  assert.deepEqual(run(d, [[0, 1.0], [16, 0.0]]), [[16, 'released']]);
});

test('a slow guided return reads as settled', () => {
  const d = createStickReleaseDetector();
  const verdicts = run(d, [
    [0, 0.9], [50, 0.8], [100, 0.65], [150, 0.5],
    [200, 0.35], [250, 0.25], [300, 0.1],
  ]);
  assert.deepEqual(verdicts, [[300, 'settled']]);
});

test('the verdict boundary follows the configured window', () => {
  const fast = createStickReleaseDetector({ windowMs: 130 });
  assert.deepEqual(run(fast, [[0, 0.9], [125, 0.05]]), [[125, 'released']], 'inside the window');

  const slow = createStickReleaseDetector({ windowMs: 130 });
  assert.deepEqual(run(slow, [[0, 0.9], [140, 0.05]]), [[140, 'settled']], 'outside the window');
});

test('the window is measured from the last deep sample, not the first', () => {
  const d = createStickReleaseDetector();
  // Held out for a long time, then flicked home — holding must not count.
  const verdicts = run(d, [[0, 0.9], [1000, 0.9], [2000, 0.9], [2030, 0.05]]);
  assert.deepEqual(verdicts, [[2030, 'released']]);
});

test('a push too shallow to engage still settles rather than hanging', () => {
  const d = createStickReleaseDetector({ high: 0.55 });
  // Never reaches HIGH, so it cannot be a release — but it must still report.
  assert.deepEqual(run(d, [[0, 0.4], [16, 0.35], [32, 0.05]]), [[32, 'settled']]);
});

test('each centre crossing reports exactly once', () => {
  const d = createStickReleaseDetector();
  const verdicts = run(d, [
    [0, 0.9], [16, 0.02], [32, 0.01], [48, 0.0], // resting frames must stay quiet
    [64, 0.9], [80, 0.0],
  ]);
  assert.deepEqual(verdicts, [[16, 'released'], [80, 'released']]);
});

test('resting at centre from the start reports nothing', () => {
  const d = createStickReleaseDetector();
  assert.deepEqual(run(d, [[0, 0], [16, 0], [32, 0.01]]), []);
});

test('sweeping between segments at full deflection reports nothing', () => {
  const d = createStickReleaseDetector();
  assert.deepEqual(run(d, [[0, 0.9], [16, 0.95], [32, 0.88], [48, 0.92]]), []);
});

test('reset clears a pending push so a stale one cannot fire later', () => {
  const d = createStickReleaseDetector();
  d.sample(0.9, 0);
  d.reset();
  assert.deepEqual(run(d, [[16, 0.0]]), [], 'no verdict after reset');
});

test('ignores non-finite magnitudes', () => {
  const d = createStickReleaseDetector();
  assert.equal(d.sample(NaN, 0), null);
  assert.equal(d.sample(undefined, 16), null);
});

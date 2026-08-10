/* ═══════════════════════════════════════
   STICK RELEASE DETECTOR

   Tells apart "flicked and let go" from "walked the stick back to centre".

   A released stick is pulled home by its spring: it crosses from a deep push
   to the centre in roughly 30–80ms, so the whole return fits inside a couple
   of poll frames. Guiding it back by thumb takes far longer. Measuring the
   time between the last deep sample and the moment it reaches the centre is
   therefore enough to classify the gesture.

   Caveats worth knowing when tuning the constants:
     - Resolution is capped by the poll rate (~16.7ms at 60fps), so a spring
       return is only 2–3 samples. RELEASE_WINDOW_MS has to absorb that.
     - Spring tension varies by controller and weakens with age, so the
       boundary is a heuristic, not a hard physical fact.
═══════════════════════════════════════ */

/** Magnitude a push must reach before a return can count as a release. */
export const RELEASE_HIGH = 0.55;
/** Magnitude at or below which the stick counts as back at centre. */
export const RELEASE_LOW = 0.22;
/**
 * Longest HIGH→LOW travel time still considered a spring snap-back.
 * At 60fps this is only ~5 poll frames, so a genuine release must be caught
 * within a handful of samples — tighten further and frame jitter starts
 * misreading real releases as guided returns.
 */
export const RELEASE_WINDOW_MS = 80;

export function createStickReleaseDetector({
  high = RELEASE_HIGH,
  low = RELEASE_LOW,
  windowMs = RELEASE_WINDOW_MS,
} = {}) {
  let lastHighTime = null;
  let engaged = false;
  let below = true; // already at centre → nothing to report yet

  function reset() {
    lastHighTime = null;
    engaged = false;
    below = true;
  }

  /**
   * Feed one poll sample.
   * Returns 'released' | 'settled' on the frame the stick reaches centre,
   * and null otherwise. 'settled' also covers pushes too shallow to engage,
   * so a gesture can never leave the caller waiting forever.
   */
  function sample(magnitude, now) {
    if (!Number.isFinite(magnitude)) return null;

    if (magnitude >= high) {
      lastHighTime = now;
      engaged = true;
    }
    if (magnitude > low) {
      below = false;
      return null;
    }
    if (below) return null; // this crossing was already reported

    below = true;
    const snapped = engaged && lastHighTime !== null && (now - lastHighTime) <= windowMs;
    engaged = false;
    lastHighTime = null;
    return snapped ? 'released' : 'settled';
  }

  return { sample, reset };
}

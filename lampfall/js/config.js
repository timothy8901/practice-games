/**
 * Engine-level constants for the merged game. [BOOT]
 *
 * Nothing here is a game number: tuned values (caps, costs, rates) live in `data/tuning.js`,
 * `data/dials.js` and `data/loans.js`. These are the fixed facts about the frame, the clock and the
 * build, plus feature switches that hide unfinished scenes so partial builds never show dead doors.
 * @module config
 */

/** Display title. [GDD] placeholder until the design panel names the game. */
export const TITLE = 'Lampfall';

/** Semantic build version shown on the title screen and stamped into save summaries. */
export const VERSION = '0.1.0-dev';

/** Native buffer width in game pixels. */
export const NATIVE_W = 480;

/** Native buffer height in game pixels. */
export const NATIVE_H = 270;

/** Tile edge in game pixels. */
export const TILE = 16;

/** Fixed simulation step in milliseconds (60 Hz). */
export const TICK_MS = 1000 / 60;

/** Longest real-time gap a single frame may integrate (tab sleep clamp). */
export const MAX_FRAME_DT_MS = 250;

/** Fixed steps allowed per frame at speed 1 before time is dropped rather than spiralled. */
export const MAX_STEPS_PER_FRAME = 4;

/** A frame longer than this counts as slow for the low-power watch. */
export const SLOW_FRAME_MS = 24;

/** Consecutive slow frames before `G.lowPower` engages (never flips back in-session). */
export const SLOW_FRAMES_TO_LOW_POWER = 90;

/** Particle budget factor applied to `fx.setBudget` when low power engages. */
export const LOW_POWER_FX_BUDGET = 0.5;

/** localStorage key prefix for saves and the crash marker. [GDD] becomes `'<title>.'`. */
export const SAVE_PREFIX = 'lampfall.';

/** Default transition length in milliseconds (`?noanim=1` shortens every transition to 0). */
export const TRANSITION_MS = 400;

/**
 * Feature switches for scenes whose real implementation has not landed. A scene behind a `false`
 * switch is still reachable as a stub (so the menu graph stays complete) but flows that would
 * depend on its result route around it: the title starts a new game directly while
 * `FEATURES.leaseCard` is false, for example.
 * @type {Readonly<{leaseCard: boolean, crashRecovery: boolean, debugOverlay: boolean}>}
 */
export const FEATURES = Object.freeze({
  leaseCard: true,
  crashRecovery: true,
  debugOverlay: true,
});

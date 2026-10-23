/**
 * Shared render plumbing (ARCHITECTURE §12). [RENDER]
 *
 * - {@link makeCanvas}: an offscreen surface for caches (chunk bakes, light discs, sky strips). Prefers
 *   `OffscreenCanvas`, falls back to `document.createElement('canvas')`; tests inject a factory with
 *   {@link setRenderCanvasFactory} so every render module runs under Node.
 * - {@link DRAW}: per-frame counters (`drawImage` calls, chunk bakes) that the render modules bump
 *   inline. `mapRenderer` resets them at the start of a frame and reports them in its stats, so the
 *   debug overlay needs no wrapped context.
 * - {@link hash2}: the stable per-tile hash every pass uses for variety (never `Math.random`).
 *
 * Imports nothing and touches no DOM at load.
 * @module render/surface
 */

/** @type {((w: number, h: number) => any)|null} */
let factory = null;

/**
 * Overrides surface creation (tests, workers). `null` restores the default.
 * @param {((w: number, h: number) => any)|null} fn
 */
export function setRenderCanvasFactory(fn) {
  factory = typeof fn === 'function' ? fn : null;
}

/**
 * A `w x h` 2D surface: injected factory, else `OffscreenCanvas`, else a DOM canvas.
 * @param {number} w
 * @param {number} h
 * @returns {any} canvas-like with `getContext('2d')`
 */
export function makeCanvas(w, h) {
  if (factory) return factory(w, h);
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  throw new Error('render: no canvas implementation (call setRenderCanvasFactory)');
}

/**
 * 2D context of a surface with smoothing off (crisp pixels).
 * @param {any} canvas
 * @returns {any}
 */
export function ctx2d(canvas) {
  const c = canvas.getContext('2d');
  if (c && 'imageSmoothingEnabled' in c) c.imageSmoothingEnabled = false;
  return c;
}

/**
 * Per-frame counters. Render modules increment the fields inline; `mapRenderer.drawFrame` resets
 * them first and copies them into its returned stats.
 */
export const DRAW = {
  /** `drawImage` calls this frame. */
  images: 0,
  /** Rect / path fills this frame (weather, ripples, shadows). */
  fills: 0,
  /** Chunks baked this frame. */
  bakes: 0,
};

/** Zeroes {@link DRAW}. */
export function resetDrawCounters() {
  DRAW.images = 0;
  DRAW.fills = 0;
  DRAW.bakes = 0;
}

/**
 * Small integer hash of a coordinate pair (stable variety picks; same function as the tile
 * prototype so variant choices match it).
 * @param {number} x
 * @param {number} y
 * @returns {number} uint32
 */
export function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Monotonic milliseconds for budgets (performance.now when present).
 * @returns {number}
 */
export function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

/**
 * Parses `#rrggbb` into `[r, g, b]` 0..255.
 * @param {string} hex
 * @returns {number[]}
 */
export function rgbOf(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/**
 * `[r, g, b]` 0..255 -> `#RRGGBB`.
 * @param {number} r @param {number} g @param {number} b
 * @returns {string}
 */
export function hexOfRgb(r, g, b) {
  const q = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${q(r)}${q(g)}${q(b)}`.toUpperCase();
}

/** 4x4 ordered-dither (Bayer) thresholds, 0..15. */
export const BAYER4 = Object.freeze([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]);

/**
 * Whether the pixel at (x, y) is "on" for an ordered-dither density in [0, 1].
 * @param {number} x @param {number} y @param {number} density
 * @returns {boolean}
 */
export function ditherOn(x, y, density) {
  return BAYER4[((y & 3) << 2) | (x & 3)] < density * 16;
}

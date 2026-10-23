/**
 * The Heartmark (GDD-00 §2, §14): a four-point plus every creature carries, lit comet magenta
 * `#FF5BD6` once it bonds. [ART-CREATURES — thin version by SCN-BATTLE; the creature-art lane
 * replaces it]
 *
 * Geometry (GDD-00 §14 "a 3 px plus (5 px with corner glints at ×2)"):
 *  - scale 1: a 3 px plus (centre + four arms of 1 px);
 *  - scale ≥ 2: a 5 px plus in screen pixels (arms of 2 px) and, while glinting, four corner glint
 *    pixels on the diagonals.
 * The centre pixel is near-white `w` on cool bodies and warm yellow `y` on warm / light bodies; on a
 * light body the plus is outlined in ink so it never dissolves into the fur. Unbonded (wild)
 * creatures carry a faint, unlit mark in slate grey: same shape, no magenta, no glint.
 *
 * Pure geometry helpers ({@link heartmarkPixels}, {@link markAnchor}) are Node-testable; drawing
 * only touches the given 2D context.
 * @module art/heartmark
 */

/** Comet magenta (GDD-00 §14, reserved for Heartmarks, skyglass, Shift effects and the comet). */
export const HEARTMARK_MAGENTA = '#FF5BD6';
/** Centre highlight on cool bodies. */
export const CENTRE_COOL = '#F4F4F4';
/** Centre highlight on warm or light bodies. */
export const CENTRE_WARM = '#FFCD75';
/** Ink outline used on light bodies. */
export const OUTLINE_INK = '#1A1C2C';
/** Unlit mark colour (wild creatures; "a faint four-point Heartmark"). */
export const UNLIT = '#566C86';
/** Glint duration in ms (GDD-09 §2: Heartmark glint 30 f). */
export const GLINT_MS = 500;

/** Palette keys that count as a warm or light body under the mark. */
const WARM_KEYS = new Set(['y', 'o', 'a', 'c', 'h', 'u', 'r']);
const LIGHT_KEYS = new Set(['w', 'c', 'y', 'i', 'l', 'a']);

/**
 * Pixels of the plus, relative to its centre, in screen pixels.
 * @param {number} scale  the sprite's draw scale (1 or 2+)
 * @param {boolean} [glint]  add the four corner glints (scale ≥ 2 only)
 * @returns {{arm: Array<[number, number]>, centre: [number, number], glints: Array<[number, number]>}}
 */
export function heartmarkPixels(scale, glint = false) {
  const big = scale >= 2;
  const reach = big ? 2 : 1;
  /** @type {Array<[number, number]>} */
  const arm = [];
  for (let d = 1; d <= reach; d++) arm.push([d, 0], [-d, 0], [0, d], [0, -d]);
  /** @type {Array<[number, number]>} */
  const glints = big && glint ? [[2, 2], [-2, 2], [2, -2], [-2, -2]] : [];
  return { arm, centre: [0, 0], glints };
}

/**
 * Where the mark sits on a 32×32 sprite: the form's anchor plus the individual's offset
 * (`creature.mark`, drawn once at hatch and kept through every Shift), clamped inside the sprite.
 * @param {{heartmark?: {x: number, y: number}, heartmarkBack?: {x: number, y: number}}|null} art  the form's sprite record
 * @param {{x: number, y: number}|null|undefined} mark  the individual's offset
 * @param {{back?: boolean, w?: number, h?: number}} [opts]
 * @returns {{x: number, y: number}}
 */
export function markAnchor(art, mark, opts = {}) {
  const w = opts.w ?? 32;
  const h = opts.h ?? 32;
  const base = (opts.back ? art?.heartmarkBack : null) ?? art?.heartmark ?? { x: Math.floor(w / 2), y: Math.floor(h / 3) };
  const dx = mark && Number.isFinite(mark.x) ? mark.x : 0;
  const dy = mark && Number.isFinite(mark.y) ? mark.y : 0;
  return { x: Math.max(1, Math.min(w - 2, base.x + dx)), y: Math.max(1, Math.min(h - 2, base.y + dy)) };
}

/**
 * Palette key of the sprite pixel under the mark (or null).
 * @param {{rows?: string[]}|null} art
 * @param {{x: number, y: number}} at
 * @returns {string|null}
 */
export function bodyKeyAt(art, at) {
  const row = art && Array.isArray(art.rows) ? art.rows[at.y] : null;
  const ch = row ? row[at.x] : null;
  return ch && ch !== '.' ? ch : null;
}

/**
 * Draws the Heartmark at a sprite-relative pixel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx  sprite top-left x on screen
 * @param {number} sy  sprite top-left y on screen
 * @param {{x: number, y: number}} at  sprite-pixel position of the mark centre (see {@link markAnchor})
 * @param {{lit?: boolean, scale?: number, glint?: number, body?: string|null, alpha?: number}} [opts]
 *   `glint` 0..1 progress of the 30 f glint (0 = none); `body` the palette key under the mark
 */
export function drawHeartmark(ctx, sx, sy, at, opts = {}) {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const lit = opts.lit !== false;
  const glinting = lit && (opts.glint ?? 0) > 0;
  const { arm, glints } = heartmarkPixels(scale, glinting);
  // centre of the sprite pixel in screen space
  const cx = Math.round(sx + at.x * scale + (scale >= 2 ? Math.floor(scale / 2) : 0));
  const cy = Math.round(sy + at.y * scale + (scale >= 2 ? Math.floor(scale / 2) : 0));
  const body = opts.body ?? null;
  const light = !!body && LIGHT_KEYS.has(body);
  const prev = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prev * opts.alpha;
  if (lit && light) {
    // ink outline around the plus on light fur
    ctx.fillStyle = OUTLINE_INK;
    for (const [dx, dy] of arm) {
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(cx + dx + ox, cy + dy + oy, 1, 1);
    }
  }
  ctx.fillStyle = lit ? HEARTMARK_MAGENTA : UNLIT;
  for (const [dx, dy] of arm) ctx.fillRect(cx + dx, cy + dy, 1, 1);
  if (lit) {
    const warm = !!body && WARM_KEYS.has(body);
    ctx.fillStyle = glinting && (opts.glint ?? 0) < 0.6 ? CENTRE_COOL : warm ? CENTRE_WARM : CENTRE_COOL;
    ctx.fillRect(cx, cy, 1, 1);
    if (glinting) {
      ctx.fillStyle = HEARTMARK_MAGENTA;
      for (const [dx, dy] of glints) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  } else {
    ctx.fillStyle = UNLIT;
    ctx.fillRect(cx, cy, 1, 1);
  }
  ctx.globalAlpha = prev;
}

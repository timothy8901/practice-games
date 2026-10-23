/**
 * The Heartmark (GDD-00 §2, §14): the four-point plus every creature carries, lit comet magenta
 * `#FF5BD6` once it bonds. [ART-CREATURES]
 *
 * Placement: every form declares four anchors `{head, chest, back, tail}` (front, idle2 and back
 * frames, in sprite pixels; see `art/creatures/<family>.js`). Each individual rolls ONE anchor key at
 * hatch from stream `heartmark:<uid>` ({@link pickAnchor}) and keeps the key through every Shift, so
 * the mark lands on the same body part in each form.
 *
 * Geometry (GDD-00 §14 "a 3 px plus (5 px with corner glints at ×2)"):
 *  - scale 1: a 3 px plus (centre + four 1 px arms);
 *  - scale ≥ 2: a 5-cell plus (arms of 2 cells) with four corner glints on the diagonals, one cell
 *    being `floor(scale / 2)` screen pixels (so ×2 is exactly 5 px across);
 *  - the centre is `w` on cool bodies and `y` on warm or white ones (the form's `highlight`, else a
 *    guess from the body key under the mark); on light fur the plus is outlined in ink;
 *  - lit only when bonded: unbonded (wild) creatures carry a faint slate mark, no magenta, no glint.
 *
 * API:
 *  - {@link drawHeartmark}`(ctx, sprite, anchorKey, {x, y, lit, scale, back, frame, glint, alpha})`
 *    where `sprite` is a creature record (`CREATURE_SPRITES[id]` / `creatureArt(id)`) and `x, y` its
 *    top-left on screen. The legacy form `drawHeartmark(ctx, sx, sy, {x, y}, opts)` still works.
 *  - {@link pickAnchor}`(uid, rng)` → `'head' | 'chest' | 'back' | 'tail'`.
 *  - {@link anchorPoint}, {@link heartmarkPixels}, {@link markAnchor}, {@link bodyKeyAt}: pure helpers.
 * Drawing only touches the given 2D context; everything else is Node-testable.
 * @module art/heartmark
 */

/** Comet magenta (GDD-00 §14, reserved for Heartmarks, skyglass, Shift effects and the comet). */
export const HEARTMARK_MAGENTA = '#FF5BD6';
/** Centre highlight on cool bodies (`w`). */
export const CENTRE_COOL = '#F4F4F4';
/** Centre highlight on warm or white bodies (`y`). */
export const CENTRE_WARM = '#FFCD75';
/** Ink outline used on light bodies (`k`). */
export const OUTLINE_INK = '#1A1C2C';
/** Unlit mark colour (wild creatures). */
export const UNLIT = '#566C86';
/** Glint duration in ms (GDD-09 §2: Heartmark glint 30 f). */
export const GLINT_MS = 500;
/** The four anchor keys, in roll order. */
export const ANCHOR_KEYS = Object.freeze(['head', 'chest', 'back', 'tail']);

/** Palette keys that count as a warm body under the mark. */
const WARM_KEYS = new Set(['y', 'o', 'a', 'c', 'h', 'u', 'r']);
/** Palette keys that count as light fur (the plus gets an ink outline). */
const LIGHT_KEYS = new Set(['w', 'c', 'y', 'i', 'l', 'a']);

/**
 * Rolls the anchor an individual keeps for life (stream `heartmark:<uid>`, GDD-00 §14).
 * `rng` may be a `core/rng` Rng (it is forked by label, so no draw is taken from it), an already
 * forked stream, a `() => [0, 1)` function, or absent (a stable hash of the uid).
 * @param {string|number} uid
 * @param {{fork?: (label: string) => any, int?: (a: number, b: number) => number}|(() => number)|null} [rng]
 * @returns {'head'|'chest'|'back'|'tail'}
 */
export function pickAnchor(uid, rng) {
  const label = `heartmark:${uid}`;
  let i;
  if (rng && typeof rng === 'object' && typeof rng.fork === 'function') i = rng.fork(label).int(0, 3);
  else if (rng && typeof rng === 'object' && typeof rng.int === 'function') i = rng.int(0, 3);
  else if (typeof rng === 'function') i = Math.floor(Math.abs(rng()) * 4) % 4;
  else i = hash32(label) % 4;
  return /** @type {'head'|'chest'|'back'|'tail'} */ (ANCHOR_KEYS[i] ?? 'head');
}

/** FNV-1a, unsigned. @param {string} s @returns {number} */
function hash32(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * The sprite-pixel point of an anchor on a frame of a creature record.
 * Accepts the records of `art/creatures` (`heartmarks`, `heartmarksBack`, `heartmarksIdle2`) and the
 * single-point prototype shape (`heartmark`, `heartmarkBack`, `heartmarkIdle2`).
 * @param {any} sprite
 * @param {string} [anchorKey]  'head' | 'chest' | 'back' | 'tail' (default: the record's `mark`)
 * @param {{back?: boolean, frame?: number}} [opts]
 * @returns {{x: number, y: number}}
 */
export function anchorPoint(sprite, anchorKey, opts = {}) {
  const key = anchorKey && ANCHOR_KEYS.includes(anchorKey) ? anchorKey : sprite?.mark ?? null;
  const set = opts.back ? sprite?.heartmarksBack : opts.frame === 1 ? sprite?.heartmarksIdle2 : sprite?.heartmarks;
  const single = opts.back ? sprite?.heartmarkBack : opts.frame === 1 ? sprite?.heartmarkIdle2 : sprite?.heartmark;
  const p = (key && set?.[key]) || single || sprite?.heartmark || null;
  if (p) return { x: p.x, y: p.y };
  const w = sprite?.w ?? 32;
  const h = sprite?.h ?? 32;
  return { x: Math.floor(w / 2), y: Math.floor(h / 3) };
}

/**
 * Pixels of the plus relative to its centre, in mark cells (see the module note for cell size).
 * @param {number} scale  the sprite's draw scale
 * @param {boolean} [glint]  include the four corner glints (scale ≥ 2 only)
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
 * Legacy placement: the form's anchor plus an individual's offset, clamped inside the sprite.
 * @param {{heartmark?: {x: number, y: number}, heartmarkBack?: {x: number, y: number}}|null} art
 * @param {{x: number, y: number}|null|undefined} mark  offset (older saves kept `{x, y}` offsets)
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
 * Palette key of the sprite pixel at a point (or null when clear).
 * @param {{rows?: readonly string[]}|null} art
 * @param {{x: number, y: number}} at
 * @returns {string|null}
 */
export function bodyKeyAt(art, at) {
  const row = art && Array.isArray(art.rows) ? art.rows[at.y] : null;
  const ch = row ? row[at.x] : null;
  return ch && ch !== '.' ? ch : null;
}

/**
 * Draws the Heartmark.
 *
 * New form: `drawHeartmark(ctx, sprite, anchorKey, {x, y, lit, scale, back, frame, glint, alpha, flipX})`.
 * Legacy form: `drawHeartmark(ctx, sx, sy, at, {lit, scale, glint, body, alpha})`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} sprite  creature record, or (legacy) the sprite's screen x
 * @param {any} anchorKey  anchor key, or (legacy) the sprite's screen y
 * @param {any} [opts]  options, or (legacy) the sprite-pixel point
 * @param {any} [legacyOpts]
 * @returns {{x: number, y: number}} the sprite-pixel point the mark was drawn at
 */
export function drawHeartmark(ctx, sprite, anchorKey, opts, legacyOpts) {
  if (typeof sprite === 'number') {
    const o = legacyOpts ?? {};
    paint(ctx, sprite, anchorKey, opts, { ...o, centre: o.centre ?? null });
    return { x: opts.x, y: opts.y };
  }
  const o = opts ?? {};
  const back = !!o.back;
  const frame = o.frame === 1 ? 1 : 0;
  let at = anchorPoint(sprite, anchorKey, { back, frame });
  const w = sprite?.w ?? sprite?.rows?.[0]?.length ?? 32;
  if (o.flipX) at = { x: w - 1 - at.x, y: at.y };
  const rows = back ? sprite?.back : frame === 1 ? sprite?.idle2 : sprite?.rows;
  const src = o.flipX ? { x: w - 1 - at.x, y: at.y } : at;
  const body = Array.isArray(rows) ? bodyKeyAt({ rows }, src) : null;
  const centre = sprite?.highlight === 'y' ? CENTRE_WARM : sprite?.highlight === 'w' ? CENTRE_COOL : null;
  paint(ctx, o.x ?? 0, o.y ?? 0, at, { lit: o.lit, scale: o.scale, glint: o.glint, body, alpha: o.alpha, centre });
  return at;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} sx @param {number} sy  sprite top-left on screen
 * @param {{x: number, y: number}} at  sprite-pixel centre
 * @param {{lit?: boolean, scale?: number, glint?: number|boolean, body?: string|null, alpha?: number, centre?: string|null}} o
 */
function paint(ctx, sx, sy, at, o) {
  const scale = Math.max(1, Math.round(o.scale ?? 1));
  const lit = o.lit !== false;
  const big = scale >= 2;
  const cell = big ? Math.max(1, Math.floor(scale / 2)) : 1;
  const glintT = typeof o.glint === 'number' ? o.glint : o.glint ? 1 : 0;
  const { arm, glints } = heartmarkPixels(scale, lit && big);
  // centre of the sprite pixel in screen space, snapped so the plus is symmetric
  const cx = Math.round(sx + at.x * scale + Math.floor((scale - cell) / 2));
  const cy = Math.round(sy + at.y * scale + Math.floor((scale - cell) / 2));
  const body = o.body ?? null;
  const light = !!body && LIGHT_KEYS.has(body);
  const cellAt = (dx, dy) => ctx.fillRect(cx + dx * cell, cy + dy * cell, cell, cell);
  const prev = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prev * o.alpha;
  if (lit && light) {
    ctx.fillStyle = OUTLINE_INK;
    for (const [dx, dy] of arm) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cellAt(dx + ox, dy + oy);
  }
  ctx.fillStyle = lit ? HEARTMARK_MAGENTA : UNLIT;
  for (const [dx, dy] of arm) cellAt(dx, dy);
  if (lit) {
    const warm = o.centre ? o.centre === CENTRE_WARM : !!body && WARM_KEYS.has(body);
    ctx.fillStyle = glintT > 0 && glintT < 0.6 ? CENTRE_COOL : warm ? CENTRE_WARM : CENTRE_COOL;
    cellAt(0, 0);
    if (glints.length) {
      ctx.fillStyle = glintT > 0 ? CENTRE_COOL : HEARTMARK_MAGENTA;
      for (const [dx, dy] of glints) cellAt(dx, dy);
    }
  } else {
    ctx.fillStyle = UNLIT;
    cellAt(0, 0);
  }
  ctx.globalAlpha = prev;
}

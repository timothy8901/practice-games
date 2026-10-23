/**
 * Row-level helpers for palette-indexed string art (ARCHITECTURE §1, §8.4). [ART-SHARED]
 *
 * A "rows" value is an array of equal-length strings, one char per pixel, `'.'` transparent. Every
 * helper is pure, returns new arrays (input rows are never mutated) and sizes itself from
 * `rows.length` / `rows[0].length`, so 16×16 tiles, 16×24 people, 24×24 and 32×32 creatures and the
 * 96×96 Vagary all work (§8.4: `squash/hover` use `rows.length`).
 *
 * Motion rules (GDD-00 §14): squash ≤ 10%, no rotation of characters (the quarter-turn helpers are
 * for authoring autotile edges only), one anticipation frame per verb, 12 fps characters.
 *
 * No DOM; imports nothing.
 * @module art/spriteUtil
 */

/** Transparent pixel char. */
export const CLEAR = '.';

/** Maximum squash GDD-00 §14 allows (fraction of height). */
export const MAX_SQUASH = 0.1;

/** Character animation rate (GDD-00 §14). */
export const CHAR_FPS = 12;

/**
 * `h` rows of `w` copies of `ch`.
 * @param {number} w @param {number} h @param {string} [ch='.']
 * @returns {string[]}
 */
export function blank(w, h, ch = CLEAR) {
  const row = ch.repeat(w);
  return Array.from({ length: h }, () => row);
}

/**
 * Width and height of rows (width = longest row).
 * @param {string[]} rows
 * @returns {{w: number, h: number}}
 */
export function sizeOf(rows) {
  let w = 0;
  for (const r of rows) if (r.length > w) w = r.length;
  return { w, h: rows.length };
}

/**
 * Pads ragged rows to the widest with transparency (authoring convenience).
 * @param {string[]} rows
 * @returns {string[]}
 */
export function normalize(rows) {
  const { w } = sizeOf(rows);
  return rows.map((r) => (r.length < w ? r + CLEAR.repeat(w - r.length) : r));
}

/**
 * Paints `sprite` onto `rows` at (x, y); `'.'` in the sprite is transparent; out-of-bounds pixels drop.
 * @param {string[]} rows @param {string[]} sprite @param {number} x @param {number} y
 * @returns {string[]}
 */
export function blit(rows, sprite, x, y) {
  const out = rows.slice();
  for (let j = 0; j < sprite.length; j++) {
    const yy = y + j;
    if (yy < 0 || yy >= out.length) continue;
    const line = out[yy].split('');
    const src = sprite[j];
    for (let i = 0; i < src.length; i++) {
      const xx = x + i;
      const c = src[i];
      if (c === CLEAR || c === ' ' || xx < 0 || xx >= line.length) continue;
      line[xx] = c;
    }
    out[yy] = line.join('');
  }
  return out;
}

/**
 * Like {@link blit} but only fills pixels that are still transparent (draw-behind).
 * @param {string[]} rows @param {string[]} sprite @param {number} x @param {number} y
 * @returns {string[]}
 */
export function under(rows, sprite, x, y) {
  const out = rows.slice();
  for (let j = 0; j < sprite.length; j++) {
    const yy = y + j;
    if (yy < 0 || yy >= out.length) continue;
    const line = out[yy].split('');
    const src = sprite[j];
    for (let i = 0; i < src.length; i++) {
      const xx = x + i;
      const c = src[i];
      if (c === CLEAR || c === ' ' || xx < 0 || xx >= line.length || line[xx] !== CLEAR) continue;
      line[xx] = c;
    }
    out[yy] = line.join('');
  }
  return out;
}

/**
 * Sets individual pixels: `patch(rows, [[x, y, ch], ...])`. Out-of-bounds entries are ignored.
 * @param {string[]} rows @param {Array<[number, number, string]>} patches
 * @returns {string[]}
 */
export function patch(rows, patches) {
  const g = rows.map((r) => r.split(''));
  for (const [x, y, ch] of patches) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch;
  return g.map((r) => r.join(''));
}

/**
 * Fills a rectangle (inclusive corners) with `ch`.
 * @param {string[]} rows @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {string} ch
 * @returns {string[]}
 */
export function fillRect(rows, x0, y0, x1, y1, ch) {
  const ps = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ps.push([x, y, ch]);
  return patch(rows, ps);
}

/**
 * Replaces chars by a `{from: to}` map (palette-key remap, e.g. Star-touched variants).
 * @param {string[]} rows @param {Record<string, string>} map
 * @returns {string[]}
 */
export function remap(rows, map) {
  return rows.map((r) => {
    let s = '';
    for (const ch of r) s += Object.hasOwn(map, ch) ? map[ch] : ch;
    return s;
  });
}

/** Mirror left-right. @param {string[]} rows @returns {string[]} */
export function mirror(rows) {
  return rows.map((r) => r.split('').reverse().join(''));
}

/** Mirror top-bottom. @param {string[]} rows @returns {string[]} */
export function flipV(rows) {
  return rows.slice().reverse();
}

/**
 * Quarter turn clockwise (authoring autotile edges from one authored side; never for characters).
 * @param {string[]} rows
 * @returns {string[]}
 */
export function rotateCW(rows) {
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let s = '';
    for (let y = h - 1; y >= 0; y--) s += rows[y][x] ?? CLEAR;
    out.push(s);
  }
  return out;
}

/**
 * `n` quarter turns clockwise (negative = counter-clockwise).
 * @param {string[]} rows @param {number} n
 * @returns {string[]}
 */
export function rotate(rows, n) {
  let out = rows;
  for (let i = 0; i < (((n % 4) + 4) % 4); i++) out = rotateCW(out);
  return out;
}

/**
 * The four edge variants of an edge authored for the north side.
 * @param {string[]} north
 * @returns {{n: string[], e: string[], s: string[], w: string[]}}
 */
export function edgeSet(north) {
  return { n: north, e: rotateCW(north), s: flipV(north), w: rotate(north, 3) };
}

/**
 * Shifts rows by (dx, dy) inside the same box; vacated pixels are transparent.
 * @param {string[]} rows @param {number} dx @param {number} dy
 * @returns {string[]}
 */
export function shift(rows, dx, dy) {
  const { w, h } = sizeOf(rows);
  return blit(blank(w, h), rows, dx, dy);
}

/**
 * Squash-breathe (proto creature idle): rows from `line` down stay put (feet / base); everything above
 * drops one pixel, so row `line - 1` is lost and row 0 clears. Sized by the rows.
 * @param {string[]} rows @param {number} line   first row of the planted part
 * @returns {string[]}
 */
export function squash(rows, line) {
  const w = rows[0].length;
  const out = rows.slice();
  for (let y = Math.min(line, rows.length) - 1; y > 0; y--) out[y] = rows[y - 1];
  if (line > 0) out[0] = CLEAR.repeat(w);
  return out;
}

/**
 * Hover-bob: the whole sprite rises `n` pixels (default 1); the bottom fills with transparency.
 * @param {string[]} rows @param {number} [n=1]
 * @returns {string[]}
 */
export function hover(rows, n = 1) {
  const w = rows[0].length;
  const k = Math.max(0, Math.min(rows.length, n | 0));
  return rows.slice(k).concat(blank(w, k));
}

/**
 * Vertical squash by a fraction of the opaque height (≤ {@link MAX_SQUASH}), anchored to the bottom of
 * the opaque pixels: rows are dropped evenly from the upper body so the feet stay planted. Returns
 * the rows unchanged when the fraction rounds to zero rows.
 * @param {string[]} rows @param {number} pct 0..0.1 (values above are clamped to 10%)
 * @returns {string[]}
 */
export function squashBy(rows, pct) {
  const box = bbox(rows);
  if (!box) return rows.slice();
  const p = Math.max(0, Math.min(MAX_SQUASH, pct));
  const drop = Math.round(box.h * p);
  if (drop === 0) return rows.slice();
  const w = rows[0].length;
  const body = rows.slice(box.y, box.y + box.h);
  // remove `drop` rows spread over the top 2/3 of the body
  const zone = Math.max(drop, Math.floor(box.h * 2 / 3));
  const removeAt = new Set();
  for (let i = 0; i < drop; i++) removeAt.add(Math.floor(((i + 0.5) * zone) / drop));
  const kept = body.filter((_, i) => !removeAt.has(i));
  const out = blank(w, rows.length);
  const top = box.y + drop;
  for (let i = 0; i < kept.length; i++) out[top + i] = kept[i];
  return out;
}

/**
 * Opaque bounding box, or `null` when every pixel is transparent.
 * @param {string[]} rows
 * @returns {{x: number, y: number, w: number, h: number}|null}
 */
export function bbox(rows) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y];
    for (let x = 0; x < r.length; x++) {
      if (r[x] === CLEAR || r[x] === ' ') continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Whether (x, y) is an opaque pixel.
 * @param {string[]} rows @param {number} x @param {number} y
 * @returns {boolean}
 */
export function isOpaque(rows, x, y) {
  const r = rows[y];
  if (!r || x < 0 || x >= r.length) return false;
  return r[x] !== CLEAR && r[x] !== ' ';
}

/**
 * Distinct non-transparent chars used by one or more frames.
 * @param {string[][]|string[]} frames   a frame (rows) or an array of frames
 * @returns {Set<string>}
 */
export function keysUsed(frames) {
  const list = Array.isArray(frames[0]) ? frames : [frames];
  const s = new Set();
  for (const rows of list) for (const r of rows) for (const ch of r) if (ch !== CLEAR && ch !== ' ') s.add(ch);
  return s;
}

/**
 * Frame index for a looping animation at time `ms`: `floor(ms * fps / 1000 + phase) mod count`.
 * Allocation-free (safe in the draw loop).
 * @param {number} ms   elapsed milliseconds
 * @param {number} count number of frames (≥ 1)
 * @param {number} fps
 * @param {number} [phase=0] frame offset (per-tile phase so fields never move in lockstep)
 * @returns {number}
 */
export function frameAt(ms, count, fps, phase = 0) {
  if (!(count > 1) || !(fps > 0)) return 0;
  const f = Math.floor((ms * fps) / 1000 + phase);
  return ((f % count) + count) % count;
}

/**
 * Frame index of a one-shot animation (clamps on the last frame).
 * @param {number} ms @param {number} count @param {number} fps
 * @returns {number}
 */
export function frameOnce(ms, count, fps) {
  if (!(count > 1) || !(fps > 0) || ms <= 0) return 0;
  return Math.min(count - 1, Math.floor((ms * fps) / 1000));
}

/**
 * Ping-pong order for `n` frames: `[0, 1, ..., n-1, n-2, ..., 1]`.
 * @param {number} n
 * @returns {number[]}
 */
export function pingPong(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(i);
  for (let i = n - 2; i > 0; i--) out.push(i);
  return out;
}

/**
 * A verb's frame list with its anticipation frame first (GDD-00 §14: one anticipation frame per verb).
 * @param {string[]} anticipation rows of the wind-up frame
 * @param {string[][]} action rows of the action frames
 * @returns {string[][]}
 */
export function withAnticipation(anticipation, action) {
  return [anticipation, ...action];
}

/**
 * Horizontal 2-colour ordered dither line helper: char `a` on even (x + y), `b` on odd.
 * @param {number} w @param {number} y @param {string} a @param {string} b
 * @returns {string}
 */
export function ditherRow(w, y, a, b) {
  let s = '';
  for (let x = 0; x < w; x++) s += ((x + y) & 1) === 0 ? a : b;
  return s;
}

/**
 * Stable small integer hash of a coordinate pair (variant picks, sparkle placement).
 * @param {number} x @param {number} y
 * @returns {number} uint32
 */
export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * @file Hand-encoded pixel-art sprites: pure decoding, colour math and lazily
 * created canvases.
 *
 * A sprite is authored as `rows` (one string per row, one character per pixel)
 * plus a `palette` mapping each character to a hex colour (`#rgb`, `#rgba`,
 * `#rrggbb`, `#rrggbbaa`) or `null`. `'.'` and `' '` are transparent unless the
 * palette overrides them.
 *
 * Everything except the `canvas` accessors, {@link drawSprite},
 * {@link drawAtlasFrame} and {@link makePattern} is pure and runs under Node;
 * the module never touches `window`/`document` at import time.
 *
 * Decoded sprites are immutable and cached by content, so calling
 * {@link decodeSprite} every frame with the same art is cheap. `rows` arrays
 * and `palette` objects are treated as immutable once handed to this module;
 * if you mutate one, call {@link clearSpriteCache}.
 *
 * @module core/pixelart
 */

/**
 * A decoded sprite. Frozen; `pixels` must be treated as read-only.
 * @typedef {Object} Sprite
 * @property {number} w Width in pixels (after any `scale`/`outline`).
 * @property {number} h Height in pixels.
 * @property {ReadonlyArray<string>} rows Normalised rows: `h` strings of exactly
 *   `w` characters, one per pixel. Re-decoding `rows` with `palette` reproduces
 *   `pixels`.
 * @property {Readonly<Record<string, string|null>>} palette Normalised palette
 *   (`'#rrggbb'`, `'#rrggbbaa'` or `null`).
 * @property {Uint8ClampedArray} pixels Non-premultiplied RGBA, row-major,
 *   `w * h * 4` bytes.
 * @property {number} ox Offset added to the draw `x` so decorated sprites
 *   (outlines) stay aligned with the undecorated art. Zero or negative.
 * @property {number} oy Same for `y`.
 * @property {string} key Content key the sprite is cached under.
 * @property {HTMLCanvasElement|OffscreenCanvas} canvas Lazily created,
 *   browser-only canvas holding `pixels` (non-enumerable accessor; throws
 *   where no canvas implementation exists).
 */

/**
 * @typedef {Object} DecodeOptions
 * @property {boolean} [flipX=false] Mirror horizontally (baked into the pixels).
 * @property {boolean} [flipY=false] Mirror vertically.
 * @property {number} [scale=1] Integer nearest-neighbour upscale.
 * @property {?string} [outline=null] Hex colour for a one-art-pixel outline.
 *   Grows the sprite by 2 in each dimension and sets `ox`/`oy` to `-scale`.
 * @property {boolean} [outlineCorners=false] Also outline diagonal neighbours
 *   (8-connected, blockier look).
 * @property {?(string|{color: string, amount?: number})} [tint=null] Blend
 *   every opaque palette colour toward `color` by `amount` (0..1, default 1).
 *   Alpha is preserved. A bare string means `amount = 1`.
 */

/**
 * @typedef {Object} DrawOptions
 * @property {boolean} [flipX=false] Mirror in place around the sprite's
 *   rectangle (no extra cache entry).
 * @property {boolean} [flipY=false] Mirror vertically in place.
 * @property {number} [alpha=1] Multiplied into `ctx.globalAlpha`; `<= 0` skips
 *   drawing.
 * @property {number} [scale=1] Draw-time scale (may be fractional).
 * @property {boolean} [snap=true] Round the final position to whole pixels.
 */

/**
 * @typedef {Object} RGBA
 * @property {number} r 0..255
 * @property {number} g 0..255
 * @property {number} b 0..255
 * @property {number} a 0..255
 */

/**
 * @typedef {Object} HSLA
 * @property {number} h Degrees, 0..360.
 * @property {number} s 0..1
 * @property {number} l 0..1
 * @property {number} a 0..255
 */

/**
 * @typedef {Object} AtlasFrame
 * @property {number} x Left edge inside the atlas.
 * @property {number} y Top edge inside the atlas.
 * @property {number} w
 * @property {number} h
 * @property {number} ox Draw offset carried over from the sprite.
 * @property {number} oy
 */

/**
 * @typedef {Object} Atlas
 * @property {number} w
 * @property {number} h
 * @property {Uint8ClampedArray} pixels RGBA of the packed sheet.
 * @property {ReadonlyArray<AtlasFrame>} frames One per input sprite, in input
 *   order (duplicate sprite references share a rectangle).
 * @property {ReadonlyArray<Sprite>} sprites The input sprites.
 * @property {HTMLCanvasElement|OffscreenCanvas} canvas Lazy, browser-only.
 */

const SPRITE_TAG = Symbol('pixelart.sprite');
const ATLAS_TAG = Symbol('pixelart.atlas');
const PALETTE_TAG = Symbol('pixelart.palette');

/** Characters that are transparent unless a palette says otherwise. */
const DEFAULT_TRANSPARENT = ['.', ' '];

/** Candidates for generated palette characters (outline, padding). */
const FREE_CHARS = '@#%&*+=!?$^~|/\\<>{}[]()0123456789' +
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const HEX_RE = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TRANSPARENT_SIG = '--------';

/** @type {Map<string, Sprite>} content key -> sprite */
const spriteCache = new Map();
/** @type {WeakMap<object, Map<string, Sprite>>} rows identity -> option key -> sprite */
let fastCache = new WeakMap();
/** @type {WeakMap<object, NormalizedPalette>} */
const paletteCache = new WeakMap();
/** @type {WeakMap<object, HTMLCanvasElement|OffscreenCanvas>} */
let canvasCache = new WeakMap();
/** @type {WeakMap<Sprite, CanvasPattern>} */
let patternCache = new WeakMap();
/** @type {?function(number, number): (HTMLCanvasElement|OffscreenCanvas)} */
let canvasFactory = null;
/** @type {?CanvasRenderingContext2D} */
let scratchCtx = null;

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampByte(v) {
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function hex2(n) {
  return (n < 16 ? '0' : '') + n.toString(16);
}

function requireNumber(v, what) {
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new TypeError(`pixelart: ${what} must be a number (got ${String(v)})`);
  }
  return v;
}

// ---------------------------------------------------------------------------
// Colour math (pure)
// ---------------------------------------------------------------------------

/**
 * Parse a hex colour. Accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or
 * without the leading `#`, any case, surrounding whitespace ignored.
 * @param {string} hex
 * @returns {RGBA} Components in 0..255 (`a` is 255 when omitted).
 * @throws {TypeError} If `hex` is not a valid hex colour string.
 */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError(`pixelart: colour must be a hex string (got ${typeof hex})`);
  }
  const m = HEX_RE.exec(hex.trim());
  if (!m) throw new TypeError(`pixelart: invalid hex colour ${JSON.stringify(hex)}`);
  let s = m[1];
  if (s.length <= 4) s = s.replace(/./g, (ch) => ch + ch);
  const n = parseInt(s.slice(0, 6), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a: s.length === 8 ? parseInt(s.slice(6), 16) : 255,
  };
}

/**
 * Format RGB(A) components as a lowercase hex string. Components are rounded
 * and clamped to 0..255. The alpha pair is appended only when `a` is given
 * and is not 255, so opaque colours always come back as `#rrggbb`.
 * @param {number|RGBA} r Red, or an `{r, g, b, a?}` object.
 * @param {number} [g]
 * @param {number} [b]
 * @param {number} [a]
 * @returns {string} `'#rrggbb'` or `'#rrggbbaa'`.
 * @throws {TypeError} If a component is not a number.
 */
export function rgbToHex(r, g, b, a) {
  if (r !== null && typeof r === 'object') ({ r, g, b, a } = r);
  const out = '#' +
    hex2(clampByte(requireNumber(r, 'r'))) +
    hex2(clampByte(requireNumber(g, 'g'))) +
    hex2(clampByte(requireNumber(b, 'b')));
  if (a === undefined || a === null) return out;
  const alpha = clampByte(requireNumber(a, 'a'));
  return alpha === 255 ? out : out + hex2(alpha);
}

/**
 * Normalise any accepted hex form to the canonical `#rrggbb` / `#rrggbbaa`.
 * @param {string} color
 * @returns {string}
 * @throws {TypeError} If `color` is invalid.
 */
export function normalizeHex(color) {
  return rgbToHex(hexToRgb(color));
}

/**
 * Linearly interpolate two hex colours (including alpha).
 * @param {string} a Start colour.
 * @param {string} b End colour.
 * @param {number} t 0..1 (clamped).
 * @returns {string} Canonical hex.
 * @throws {TypeError} If a colour is invalid or `t` is not a number.
 */
export function lerpColor(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const k = clamp01(requireNumber(t, 'lerpColor t'));
  return rgbToHex(lerp(A.r, B.r, k), lerp(A.g, B.g, k), lerp(A.b, B.b, k), lerp(A.a, B.a, k));
}

/**
 * Convert RGB to HSL. Round-trips exactly with {@link hslToRgb} for 8-bit
 * colours.
 * @param {RGBA|string} color An `{r, g, b, a?}` object or hex string.
 * @returns {HSLA}
 */
export function rgbToHsl(color) {
  const c = typeof color === 'string' ? hexToRgb(color) : color;
  if (c === null || typeof c !== 'object') {
    throw new TypeError('pixelart: rgbToHsl expects an {r, g, b} object or hex string');
  }
  const R = requireNumber(c.r, 'r') / 255;
  const G = requireNumber(c.g, 'g') / 255;
  const B = requireNumber(c.b, 'b') / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l, a: c.a === undefined || c.a === null ? 255 : clampByte(requireNumber(c.a, 'a')) };
}

/**
 * Convert HSL to 8-bit RGB. Hue wraps; saturation and lightness are clamped.
 * @param {{h: number, s: number, l: number, a?: number}} hsl
 * @returns {RGBA}
 */
export function hslToRgb(hsl) {
  if (hsl === null || typeof hsl !== 'object') {
    throw new TypeError('pixelart: hslToRgb expects an {h, s, l} object');
  }
  const h = ((requireNumber(hsl.h, 'h') % 360) + 360) % 360;
  const s = clamp01(requireNumber(hsl.s, 's'));
  const l = clamp01(requireNumber(hsl.l, 'l'));
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - C / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  switch (Math.floor(h / 60) % 6) {
    case 0: r = C; g = X; break;
    case 1: r = X; g = C; break;
    case 2: g = C; b = X; break;
    case 3: g = X; b = C; break;
    case 4: r = X; b = C; break;
    default: r = C; b = X; break;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: hsl.a === undefined || hsl.a === null ? 255 : clampByte(requireNumber(hsl.a, 'a')),
  };
}

/**
 * Shift a hex colour in HSL space.
 * @param {string} color Hex colour (alpha preserved).
 * @param {number} [dH=0] Hue delta in degrees (wraps).
 * @param {number} [dS=0] Saturation delta, added on the 0..1 scale (clamped).
 * @param {number} [dL=0] Lightness delta, added on the 0..1 scale (clamped).
 * @returns {string} Canonical hex.
 */
export function recolorHSL(color, dH = 0, dS = 0, dL = 0) {
  const c = hexToRgb(color);
  const hsl = rgbToHsl(c);
  return rgbToHex(hslToRgb({
    h: hsl.h + requireNumber(dH, 'dH'),
    s: hsl.s + requireNumber(dS, 'dS'),
    l: hsl.l + requireNumber(dL, 'dL'),
    a: c.a,
  }));
}

// ---------------------------------------------------------------------------
// Palette normalisation (pure)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} NormalizedPalette
 * @property {Map<string, ?number[]>} map char -> `[r, g, b, a]` or `null`
 *   (includes the default transparent characters).
 * @property {Readonly<Record<string, string|null>>} entries Frozen user-facing
 *   palette, tagged so it normalises to itself.
 * @property {string} sig Deterministic content signature.
 * @property {string} transparent A character guaranteed to be transparent.
 */

function parseRgba(value) {
  const c = hexToRgb(value);
  return [c.r, c.g, c.b, c.a];
}

function rgbaSig(rgba) {
  return hex2(rgba[0]) + hex2(rgba[1]) + hex2(rgba[2]) + hex2(rgba[3]);
}

/** First character not already used by `map`. */
function pickFreeChar(map) {
  for (const ch of FREE_CHARS) if (!map.has(ch)) return ch;
  for (let code = 0xe000; code <= 0xf8ff; code++) {
    const ch = String.fromCharCode(code);
    if (!map.has(ch)) return ch;
  }
  throw new Error('pixelart: palette has no free character left');
}

/**
 * @param {?(Record<string, string|null>|Map<string, string|null>)} palette
 * @returns {NormalizedPalette}
 */
function normalizePalette(palette) {
  if (palette === null || palette === undefined) palette = {};
  if (typeof palette !== 'object') {
    throw new TypeError('pixelart: palette must be an object mapping characters to colours');
  }
  if (palette[PALETTE_TAG]) return palette[PALETTE_TAG];
  const cached = paletteCache.get(palette);
  if (cached) return cached;

  const map = new Map();
  const entries = {};
  const source = palette instanceof Map ? palette : Object.entries(palette);
  for (const [ch, value] of source) {
    if (typeof ch !== 'string' || ch.length !== 1 || ch === '\n' || ch === '\r') {
      throw new TypeError(`pixelart: palette key ${JSON.stringify(ch)} must be a single character`);
    }
    const rgba = value ? parseRgba(value) : null;
    map.set(ch, rgba);
    entries[ch] = rgba ? rgbToHex(rgba[0], rgba[1], rgba[2], rgba[3]) : null;
  }

  let transparent = null;
  for (const t of DEFAULT_TRANSPARENT) {
    if (!map.has(t)) map.set(t, null);
    if (transparent === null && map.get(t) === null) transparent = t;
  }
  if (transparent === null) {
    for (const [ch, v] of map) if (v === null) { transparent = ch; break; }
  }
  if (transparent === null) {
    transparent = pickFreeChar(map);
    map.set(transparent, null);
    entries[transparent] = null;
  }

  const sig = Object.keys(entries).sort()
    .map((k) => k + (map.get(k) ? rgbaSig(map.get(k)) : TRANSPARENT_SIG))
    .join('');
  const norm = { map, entries, sig, transparent };
  Object.defineProperty(entries, PALETTE_TAG, { value: norm });
  Object.freeze(entries);
  paletteCache.set(palette, norm);
  return norm;
}

// ---------------------------------------------------------------------------
// Row grid helpers (pure)
// ---------------------------------------------------------------------------

/** Split a multi-line template string into rows, dropping the blank first/last
 *  lines and common indentation that template literals introduce. */
function splitRows(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length && lines[0] === '') lines.shift();
  if (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  let indent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const lead = /^[ \t]*/.exec(line)[0].length;
    if (lead < indent) indent = lead;
  }
  if (!Number.isFinite(indent)) indent = 0;
  return lines.map((line) => line.slice(indent));
}

/**
 * Validate rows against a palette and pad ragged rows with the transparent
 * character.
 * @returns {{grid: string[], w: number, h: number}}
 */
function toGrid(rows, pal) {
  if (typeof rows === 'string') rows = splitRows(rows);
  if (!Array.isArray(rows)) {
    throw new TypeError('pixelart: rows must be an array of strings (or a multi-line string)');
  }
  const h = rows.length;
  let w = 0;
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (typeof row !== 'string') throw new TypeError(`pixelart: row ${y} is not a string`);
    if (row.length > w) w = row.length;
  }
  if (h === 0 || w === 0) throw new RangeError('pixelart: a sprite needs at least one non-empty row');
  const grid = new Array(h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      if (!pal.map.has(row[x])) {
        throw new Error(`pixelart: unknown palette character ${JSON.stringify(row[x])} at row ${y}, column ${x}`);
      }
    }
    grid[y] = row.length === w ? row : row + pal.transparent.repeat(w - row.length);
  }
  return { grid, w, h };
}

function reverseString(s) {
  return s.split('').reverse().join('');
}

function scaleGrid(grid, w, h, s) {
  const out = new Array(h * s);
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    let line = '';
    for (let x = 0; x < w; x++) line += row[x].repeat(s);
    for (let i = 0; i < s; i++) out[y * s + i] = line;
  }
  return out;
}

/**
 * Grow the grid by one transparent pixel on every side and mark every
 * transparent cell that touches an opaque one with a fresh outline character.
 * @returns {{grid: string[], w: number, h: number, char: string}}
 */
function outlineGrid(grid, w, h, pal, corners) {
  const ch = pickFreeChar(pal.map);
  const t = pal.transparent;
  const solid = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const c = pal.map.get(grid[y][x]);
    return !!c && c[3] > 0;
  };
  const W = w + 2;
  const H = h + 2;
  const out = new Array(H);
  for (let Y = 0; Y < H; Y++) {
    const y = Y - 1;
    let line = '';
    for (let X = 0; X < W; X++) {
      const x = X - 1;
      const inside = x >= 0 && y >= 0 && x < w && y < h;
      if (inside && solid(x, y)) { line += grid[y][x]; continue; }
      const edge = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ||
        (corners && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1)));
      line += edge ? ch : inside ? grid[y][x] : t;
    }
    out[Y] = line;
  }
  return { grid: out, w: W, h: H, char: ch };
}

/** Blend every opaque palette colour toward `tint.color` by `tint.amount`. */
function tintPalette(pal, tint) {
  const T = hexToRgb(tint.color);
  const k = tint.amount;
  const out = {};
  for (const ch of Object.keys(pal.entries)) {
    const v = pal.map.get(ch);
    out[ch] = v ? rgbToHex(lerp(v[0], T.r, k), lerp(v[1], T.g, k), lerp(v[2], T.b, k), v[3]) : null;
  }
  return out;
}

/** @returns {?{color: string, amount: number}} `null` when the tint is a no-op. */
function normalizeTint(t) {
  if (!t) return null;
  const color = typeof t === 'string' ? t : t.color;
  const amount = typeof t === 'string' || t.amount === undefined || t.amount === null ? 1 : t.amount;
  const k = clamp01(requireNumber(amount, 'tint.amount'));
  if (k === 0) return null;
  return { color: normalizeHex(color), amount: k };
}

function rasterize(grid, w, h, map) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const c = map.get(row[x]);
      if (!c) continue;
      const i = (y * w + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = c[3];
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// Lazy canvas plumbing (browser-only at call time)
// ---------------------------------------------------------------------------

function createCanvas(w, h) {
  if (canvasFactory) return canvasFactory(w, h);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('pixelart: no canvas implementation available in this environment (use setCanvasFactory)');
}

function pixelsToCanvas(pixels, w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('pixelart: could not acquire a 2d context');
  const img = ctx.createImageData(w, h);
  img.data.set(pixels);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** `canvas` accessor shared by sprites and atlases (`this` is the owner). */
function lazyCanvas() {
  let canvas = canvasCache.get(this);
  if (!canvas) {
    canvas = pixelsToCanvas(this.pixels, this.w, this.h);
    canvasCache.set(this, canvas);
  }
  return canvas;
}

function scratchContext() {
  if (!scratchCtx) {
    scratchCtx = createCanvas(1, 1).getContext('2d');
    if (!scratchCtx) throw new Error('pixelart: could not acquire a 2d context');
  }
  return scratchCtx;
}

// ---------------------------------------------------------------------------
// Sprite construction and cache
// ---------------------------------------------------------------------------

/**
 * Rasterise a validated grid into a cached, frozen Sprite.
 * @param {string[]} grid Uniform rows.
 * @param {number} w
 * @param {number} h
 * @param {Record<string, string|null>} palette
 * @param {number} ox
 * @param {number} oy
 * @returns {Sprite}
 */
function makeSprite(grid, w, h, palette, ox, oy) {
  const pal = normalizePalette(palette);
  const key = `${w}x${h}@${ox},${oy}|${pal.sig}|${grid.join('\n')}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const sprite = {
    w,
    h,
    rows: Object.freeze(grid.slice()),
    palette: pal.entries,
    pixels: rasterize(grid, w, h, pal.map),
    ox,
    oy,
    key,
  };
  Object.defineProperty(sprite, SPRITE_TAG, { value: true });
  Object.defineProperty(sprite, 'canvas', { get: lazyCanvas, enumerable: false });
  Object.freeze(sprite);
  spriteCache.set(key, sprite);
  return sprite;
}

/**
 * @param {*} value
 * @returns {boolean} Whether `value` is a Sprite produced by this module.
 */
export function isSprite(value) {
  return value !== null && typeof value === 'object' && value[SPRITE_TAG] === true;
}

function assertSprite(value, what = 'sprite') {
  if (!isSprite(value)) throw new TypeError(`pixelart: ${what} must be a Sprite from decodeSprite()`);
  return value;
}

function assertCtx(ctx) {
  if (!ctx || typeof ctx.drawImage !== 'function') {
    throw new TypeError('pixelart: ctx must be a CanvasRenderingContext2D');
  }
  return ctx;
}

/**
 * Decode hand-encoded rows into a Sprite. Results are cached by content: the
 * same art, palette and options always return the same frozen object.
 *
 * Transform order: flips, tint, outline, scale. Passing an existing Sprite as
 * `rows` derives a variant of it (its palette is used when `palette` is
 * `null`); its `ox`/`oy` carry over.
 *
 * @param {string[]|string|Sprite} rows One string per row (a multi-line
 *   string is split and de-indented). Ragged rows are padded with
 *   transparency.
 * @param {?(Record<string, string|null>|Map<string, string|null>)} palette
 *   Character -> hex colour or `null`. `'.'` and `' '` default to transparent.
 * @param {DecodeOptions} [opts]
 * @returns {Sprite}
 * @throws {TypeError} On malformed rows, palette or options.
 * @throws {RangeError} On an empty sprite or a non-integer / non-positive scale.
 * @throws {Error} On a character missing from the palette (names row/column).
 */
export function decodeSprite(rows, palette, opts) {
  const o = opts || {};
  let baseOx = 0;
  let baseOy = 0;
  if (isSprite(rows)) {
    if (palette === null || palette === undefined) palette = rows.palette;
    baseOx = rows.ox;
    baseOy = rows.oy;
    rows = rows.rows;
  }
  const flipX = !!o.flipX;
  const flipY = !!o.flipY;
  const scale = o.scale === undefined || o.scale === null ? 1 : o.scale;
  if (!Number.isInteger(scale) || scale < 1) {
    throw new RangeError(`pixelart: scale must be a positive integer (got ${String(scale)})`);
  }
  const outline = o.outline ? normalizeHex(o.outline) : null;
  const corners = !!o.outlineCorners;
  const tint = normalizeTint(o.tint);

  const pal = normalizePalette(palette);
  const fastKey = `${pal.sig}|${flipX ? 1 : 0}${flipY ? 1 : 0}|${scale}|${outline || ''}|${corners ? 1 : 0}|` +
    `${tint ? tint.color + tint.amount : ''}|${baseOx},${baseOy}`;
  const identity = Array.isArray(rows);
  let bucket;
  if (identity) {
    bucket = fastCache.get(rows);
    if (bucket) {
      const hit = bucket.get(fastKey);
      if (hit) return hit;
    }
  }

  let { grid, w, h } = toGrid(rows, pal);
  if (flipX) grid = grid.map(reverseString);
  if (flipY) grid.reverse();
  let entries = pal.entries;
  let ox = baseOx;
  let oy = baseOy;
  if (tint) entries = tintPalette(pal, tint);
  if (outline) {
    const r = outlineGrid(grid, w, h, pal, corners);
    grid = r.grid;
    w = r.w;
    h = r.h;
    entries = { ...entries, [r.char]: outline };
    ox -= 1;
    oy -= 1;
  }
  if (scale > 1) {
    grid = scaleGrid(grid, w, h, scale);
    w *= scale;
    h *= scale;
    ox *= scale;
    oy *= scale;
  }
  const sprite = makeSprite(grid, w, h, entries, ox, oy);
  if (identity) {
    if (!bucket) {
      bucket = new Map();
      fastCache.set(rows, bucket);
    }
    bucket.set(fastKey, sprite);
  }
  return sprite;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Whether the draw options result in anything visible. */
function visible(o) {
  if (!o) return true;
  const a = o.alpha;
  const s = o.scale;
  return (a === undefined || a === null || a > 0) && (s === undefined || s === null || s > 0);
}

/** Shared blit for sprites and atlas frames (callers check `visible` first). */
function blit(ctx, image, sx, sy, sw, sh, x, y, ox, oy, o) {
  const opts = o || {};
  const scale = opts.scale === undefined || opts.scale === null ? 1 : opts.scale;
  let alpha = opts.alpha === undefined || opts.alpha === null ? 1 : opts.alpha;
  if (alpha > 1) alpha = 1;
  const flipX = !!opts.flipX;
  const flipY = !!opts.flipY;
  const dw = sw * scale;
  const dh = sh * scale;
  let dx = x + ox * scale;
  let dy = y + oy * scale;
  if (opts.snap !== false) {
    dx = Math.round(dx);
    dy = Math.round(dy);
  }
  if (ctx.imageSmoothingEnabled !== false) ctx.imageSmoothingEnabled = false;
  const prevAlpha = ctx.globalAlpha;
  if (alpha !== 1) ctx.globalAlpha = prevAlpha * alpha;
  if (flipX || flipY) {
    ctx.save();
    ctx.translate(flipX ? dx + dw : dx, flipY ? dy + dh : dy);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  if (alpha !== 1) ctx.globalAlpha = prevAlpha;
}

/**
 * Draw a sprite with its top-left art corner at `(x, y)` (the sprite's
 * `ox`/`oy` are applied automatically). Forces nearest-neighbour sampling.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Sprite} sprite
 * @param {number} x
 * @param {number} y
 * @param {DrawOptions} [opts]
 */
export function drawSprite(ctx, sprite, x, y, opts) {
  assertCtx(ctx);
  assertSprite(sprite);
  if (!visible(opts)) return;
  blit(ctx, sprite.canvas, 0, 0, sprite.w, sprite.h, x, y, sprite.ox, sprite.oy, opts);
}

// ---------------------------------------------------------------------------
// Derived sprites (pure)
// ---------------------------------------------------------------------------

/**
 * Recolour a sprite. Keys that are a single character remap that palette
 * slot; longer keys are hex colours and remap every slot currently holding
 * that colour (colours that do not occur are ignored). Values are hex colours
 * or `null` for transparent. The input sprite is not modified.
 * @param {Sprite} sprite
 * @param {Record<string, string|null>|Map<string, string|null>} mapping
 * @returns {Sprite} Cached result; identical mappings return the same object.
 * @throws {TypeError} If a key is neither a character nor a valid colour.
 */
export function paletteSwap(sprite, mapping) {
  assertSprite(sprite);
  if (mapping === null || typeof mapping !== 'object') {
    throw new TypeError('pixelart: paletteSwap mapping must be an object or Map');
  }
  const pal = { ...sprite.palette };
  const source = mapping instanceof Map ? mapping : Object.entries(mapping);
  for (const [k, v] of source) {
    if (typeof k !== 'string' || k.length === 0) {
      throw new TypeError(`pixelart: paletteSwap key ${JSON.stringify(k)} must be a character or hex colour`);
    }
    const next = v ? normalizeHex(v) : null;
    if (k.length === 1) {
      pal[k] = next;
      continue;
    }
    const from = normalizeHex(k);
    for (const ch of Object.keys(pal)) if (pal[ch] === from) pal[ch] = next;
  }
  return makeSprite(sprite.rows, sprite.w, sprite.h, pal, sprite.ox, sprite.oy);
}

/**
 * Flatten every opaque pixel to one colour (for unseen Forecast forms,
 * shadows, flashes). Per-pixel alpha is preserved and multiplied by the
 * colour's alpha.
 * @param {Sprite} sprite
 * @param {string} color Hex colour.
 * @returns {Sprite}
 */
export function silhouette(sprite, color) {
  assertSprite(sprite);
  const c = hexToRgb(color);
  const pal = {};
  for (const ch of Object.keys(sprite.palette)) {
    const v = sprite.palette[ch];
    pal[ch] = v ? rgbToHex(c.r, c.g, c.b, Math.round((hexToRgb(v).a * c.a) / 255)) : null;
  }
  return makeSprite(sprite.rows, sprite.w, sprite.h, pal, sprite.ox, sprite.oy);
}

/**
 * Add a one-pixel outline (at the sprite's current pixel scale). The result is
 * two pixels larger in each dimension and its `ox`/`oy` shrink by one so it
 * draws aligned with the original. For an art-scale outline on an upscaled
 * sprite, use `decodeSprite(rows, palette, {outline, scale})` instead.
 * @param {Sprite} sprite
 * @param {string} color Hex outline colour.
 * @param {{corners?: boolean}} [opts] `corners` also fills diagonal neighbours.
 * @returns {Sprite}
 */
export function outlineSprite(sprite, color, opts) {
  assertSprite(sprite);
  const hex = normalizeHex(color);
  const corners = !!(opts && opts.corners);
  const r = outlineGrid(sprite.rows, sprite.w, sprite.h, normalizePalette(sprite.palette), corners);
  return makeSprite(r.grid, r.w, r.h, { ...sprite.palette, [r.char]: hex }, sprite.ox - 1, sprite.oy - 1);
}

/**
 * Bounding box of the non-transparent pixels, in sprite pixel coordinates.
 * @param {Sprite} sprite
 * @returns {?{x: number, y: number, w: number, h: number}} `null` when fully
 *   transparent.
 */
export function opaqueBounds(sprite) {
  assertSprite(sprite);
  const { w, h, pixels } = sprite;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---------------------------------------------------------------------------
// Patterns and atlases
// ---------------------------------------------------------------------------

/**
 * Build a repeating `CanvasPattern` from tile art, for `fillStyle`. Patterns
 * are cached per sprite and may be used on any 2D context.
 * @param {string[]|string|Sprite} rows Tile rows, or an already decoded Sprite.
 * @param {?(Record<string, string|null>|Map<string, string|null>|CanvasRenderingContext2D)} [palette]
 *   Palette for `rows`; when `rows` is a Sprite this slot may hold the `ctx`.
 * @param {CanvasRenderingContext2D} [ctx] Context to create the pattern with
 *   (defaults to an internal scratch context).
 * @returns {CanvasPattern}
 */
export function makePattern(rows, palette, ctx) {
  let sprite;
  if (isSprite(rows)) {
    sprite = rows;
    if ((ctx === undefined || ctx === null) && palette && typeof palette.createPattern === 'function') ctx = palette;
  } else {
    sprite = decodeSprite(rows, palette);
  }
  let pattern = patternCache.get(sprite);
  if (!pattern) {
    const target = ctx && typeof ctx.createPattern === 'function' ? ctx : scratchContext();
    pattern = target.createPattern(sprite.canvas, 'repeat');
    if (!pattern) throw new Error('pixelart: createPattern returned null');
    patternCache.set(sprite, pattern);
  }
  return pattern;
}

/**
 * Pack sprites into one sheet (deterministic shelf packing, tallest first).
 * Pure apart from the lazy `canvas`.
 * @param {Sprite[]} sprites Non-empty. The same Sprite may appear more than
 *   once; it is packed once and its frames share a rectangle.
 * @param {{padding?: number, maxWidth?: number}} [opts] `padding` (default 1)
 *   is the transparent gutter between frames; `maxWidth` caps the sheet width
 *   (never below the widest sprite plus gutters).
 * @returns {Atlas}
 * @throws {TypeError} On an empty array or a non-Sprite entry.
 * @throws {RangeError} On invalid `padding`/`maxWidth`.
 */
export function buildAtlas(sprites, opts) {
  if (!Array.isArray(sprites) || sprites.length === 0) {
    throw new TypeError('pixelart: buildAtlas needs a non-empty array of sprites');
  }
  const o = opts || {};
  const padding = o.padding === undefined || o.padding === null ? 1 : o.padding;
  if (!Number.isInteger(padding) || padding < 0) {
    throw new RangeError(`pixelart: atlas padding must be a non-negative integer (got ${String(padding)})`);
  }
  const maxWidth = o.maxWidth === undefined || o.maxWidth === null ? Infinity : o.maxWidth;
  if (typeof maxWidth !== 'number' || Number.isNaN(maxWidth) || maxWidth < 1) {
    throw new RangeError(`pixelart: atlas maxWidth must be a positive number (got ${String(maxWidth)})`);
  }

  const unique = [];
  const indexOf = new Map();
  for (const s of sprites) {
    assertSprite(s, 'every atlas entry');
    if (!indexOf.has(s)) {
      indexOf.set(s, unique.length);
      unique.push(s);
    }
  }
  const order = unique.map((_, i) => i)
    .sort((a, b) => unique[b].h - unique[a].h || unique[b].w - unique[a].w || a - b);

  let widest = 0;
  let area = 0;
  for (const s of unique) {
    if (s.w > widest) widest = s.w;
    area += (s.w + padding) * (s.h + padding);
  }
  let W = Math.max(widest + 2 * padding, Math.ceil(Math.sqrt(area)) + 2 * padding);
  if (Number.isFinite(maxWidth)) W = Math.max(widest + 2 * padding, Math.min(W, Math.floor(maxWidth)));

  const rects = new Array(unique.length);
  let cx = padding;
  let cy = padding;
  let shelfH = 0;
  for (const i of order) {
    const s = unique[i];
    if (cx + s.w + padding > W) {
      cy += shelfH + padding;
      cx = padding;
      shelfH = 0;
    }
    rects[i] = { x: cx, y: cy };
    cx += s.w + padding;
    if (s.h > shelfH) shelfH = s.h;
  }
  const H = cy + shelfH + padding;

  const pixels = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < unique.length; i++) {
    const s = unique[i];
    const r = rects[i];
    const stride = s.w * 4;
    for (let y = 0; y < s.h; y++) {
      pixels.set(s.pixels.subarray(y * stride, (y + 1) * stride), ((r.y + y) * W + r.x) * 4);
    }
  }

  const frames = sprites.map((s) => {
    const r = rects[indexOf.get(s)];
    return Object.freeze({ x: r.x, y: r.y, w: s.w, h: s.h, ox: s.ox, oy: s.oy });
  });
  const atlas = { w: W, h: H, pixels, frames: Object.freeze(frames), sprites: Object.freeze(sprites.slice()) };
  Object.defineProperty(atlas, ATLAS_TAG, { value: true });
  Object.defineProperty(atlas, 'canvas', { get: lazyCanvas, enumerable: false });
  return Object.freeze(atlas);
}

/**
 * Draw one atlas frame (same semantics as {@link drawSprite}).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Atlas} atlas
 * @param {number} index Frame index (input order of {@link buildAtlas}).
 * @param {number} x
 * @param {number} y
 * @param {DrawOptions} [opts]
 * @throws {RangeError} If `index` is out of range.
 */
export function drawAtlasFrame(ctx, atlas, index, x, y, opts) {
  assertCtx(ctx);
  if (!atlas || atlas[ATLAS_TAG] !== true) throw new TypeError('pixelart: atlas must come from buildAtlas()');
  const f = atlas.frames[index];
  if (!f) throw new RangeError(`pixelart: atlas frame ${String(index)} does not exist (${atlas.frames.length} frames)`);
  if (!visible(opts)) return;
  blit(ctx, atlas.canvas, f.x, f.y, f.w, f.h, x, y, f.ox, f.oy, opts);
}

// ---------------------------------------------------------------------------
// Environment and cache control
// ---------------------------------------------------------------------------

/**
 * Override how canvases are created (tests, workers, node-canvas). Pass
 * `null` to restore the default (`document.createElement('canvas')`, then
 * `OffscreenCanvas`). Existing lazy canvases and patterns are dropped and will
 * be rebuilt on demand.
 * @param {?function(number, number): (HTMLCanvasElement|OffscreenCanvas)} factory
 */
export function setCanvasFactory(factory) {
  if (factory !== null && factory !== undefined && typeof factory !== 'function') {
    throw new TypeError('pixelart: canvas factory must be a function or null');
  }
  canvasFactory = factory || null;
  scratchCtx = null;
  canvasCache = new WeakMap();
  patternCache = new WeakMap();
}

/**
 * Drop every cached sprite, canvas and pattern. Sprites already held by
 * callers stay valid and rebuild their canvas on next use.
 */
export function clearSpriteCache() {
  spriteCache.clear();
  fastCache = new WeakMap();
  canvasCache = new WeakMap();
  patternCache = new WeakMap();
}

/**
 * @returns {number} Number of distinct sprites currently cached.
 */
export function spriteCacheSize() {
  return spriteCache.size;
}

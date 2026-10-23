/**
 * Decoded art on demand (ARCHITECTURE §1, §4.7, §12). [ART-SHARED]
 *
 * - {@link getSprite}`(artId, variant)`: lazy decode + cache of any registered art (tiles, props, UI,
 *   and whatever later lanes register with {@link registerArt}: creatures, characters).
 * - {@link getTile}`(id, frame, grade)`: a tile frame recoloured through an hour grade
 *   (`world/lighting.gradeFor`). Colours named `!x` (lamps, glowing mud, skyglass, runes, flame) and
 *   UI art bypass the LUT; nothing grades below night ink. Pixels stay crisp and on-palette.
 * - {@link getShadow}: the dithered cast-shadow pixels of a blocking tile / prop as their own sprite
 *   (drawn translucent, offset by `lighting.shadowFor`).
 * - {@link buildGameAtlases}: packs every raw frame of tiles, props and UI into three sheets with
 *   `core/pixelart.buildAtlas` (≤ 4 atlases, §12) so hot draws are one `drawImage`.
 *
 * Caches (§12): ungraded art decodes through `core/pixelart.decodeSprite` (content cache; bounded by the
 * art count). Graded recolours live in per-grade buckets keyed by `grade.id`; at most
 * {@link MAX_GRADE_BUCKETS} grades are resident and the least recently used bucket is evicted whole,
 * so a long session never grows the cache (48 grades × weathers are quantized, never continuous).
 * A cache hit allocates nothing: buckets, art ids and frames are resolved through Maps and arrays,
 * never through concatenated string keys.
 *
 * Returned images are `{w, h, pixels, canvas}` (`canvas` is a lazy, browser-only accessor). Ungraded
 * ones are `core/pixelart` Sprites; graded ones are plain frozen objects with the same fields.
 *
 * Imports no DOM at load; canvases are created on first `.canvas` access.
 * @module art/atlas
 */

import { decodeSprite, buildAtlas } from '../core/pixelart.js';
import { gradeFor, gradeHex, INDOOR_GRADE } from '../world/lighting.js';
import { COLORS, NIGHT_INK, LUT_EXEMPT_KINDS, isLutExempt, hexOf } from './palette.js';
import { TILE_ART, TILE_ALIASES } from './tiles/index.js';
import { PROP_ART } from './props.js';
import { UI_ART } from './ui.js';

/** Graded buckets resident at once (§12: 3 grades resident). */
export const MAX_GRADE_BUCKETS = 3;
/** Safety cap on images inside one graded bucket; past it the bucket is cleared and refilled. */
export const MAX_BUCKET_IMAGES = 4096;

/**
 * Normalized art definition.
 * @typedef {Object} ArtDef
 * @property {string} id
 * @property {string} kind      tile kind, `'prop'`, `'ui'`, `'creature'`, `'char'`, ...
 * @property {string} source    `'tile' | 'prop' | 'ui' | <registered source>`
 * @property {number} w
 * @property {number} h
 * @property {ReadonlyArray<ReadonlyArray<string>>} frames
 * @property {Readonly<Record<string, string>>} pal    char -> colour name or hex
 * @property {number} fps
 * @property {Readonly<Record<string, ReadonlyArray<ReadonlyArray<string>>>>} [variants] named frame sets
 * @property {Readonly<Record<string, Readonly<Record<string, string>>>>} [variantPal] full palette per variant that overrides colours
 */

/** @type {Map<string, ArtDef>} */
const registry = new Map();
/** @type {Map<string, string>} alias -> id */
const aliases = new Map();

/**
 * Normalizes a definition: tile / prop / UI shape `{w, h, frames, pal, fps, variants?}` or the creature
 * prototype shape `{rows, palette, idle2?, back?}` (front frames `[rows, idle2]`, variant `back`).
 * @param {string} id @param {any} def @param {string} source
 * @returns {ArtDef}
 */
function normalize(id, def, source) {
  if (!def || typeof def !== 'object') throw new TypeError(`atlas: art '${id}' is not an object`);
  let frames, pal, variants = def.variants || null;
  if (Array.isArray(def.frames)) {
    frames = def.frames;
    pal = def.pal || def.palette;
  } else if (Array.isArray(def.rows)) {
    frames = def.idle2 ? [def.rows, def.idle2] : [def.rows];
    pal = def.palette || def.pal;
    if (def.back) variants = { ...(variants || {}), back: [def.back] };
  } else throw new TypeError(`atlas: art '${id}' has neither frames nor rows`);
  if (!frames.length) throw new TypeError(`atlas: art '${id}' has no frames`);
  if (!pal || typeof pal !== 'object') throw new TypeError(`atlas: art '${id}' has no palette`);
  const h = def.h ?? frames[0].length;
  const w = def.w ?? frames[0][0].length;
  return Object.freeze({
    id, source, kind: def.kind || source, w, h,
    frames, pal, fps: def.fps || 0,
    variants: variants ? Object.freeze(variants) : null,
    variantPal: def.variantPal || null,
    anchor: def.anchor || null,
    reserved: def.reserved || null,
  });
}

/**
 * Registers a table of art (`{id: def}`) under a source name. Later lanes call this from their own
 * index modules (creatures, characters) instead of editing this file. Ids must be unique.
 * @param {Record<string, any>} table
 * @param {{source?: string, kind?: string, replace?: boolean}} [opts]
 * @returns {number} number of entries registered
 */
export function registerArt(table, opts = {}) {
  const source = opts.source || 'ext';
  let n = 0;
  for (const [id, def] of Object.entries(table)) {
    if (registry.has(id) && !opts.replace) throw new Error(`atlas: art id '${id}' is already registered (${registry.get(id).source})`);
    const d = normalize(id, opts.kind && !def.kind ? { ...def, kind: opts.kind } : def, source);
    registry.set(id, d);
    raw.delete(id);
    shadows.delete(id);
    for (const b of buckets) b.images.delete(id);
    n++;
  }
  return n;
}

/**
 * Registers alternative names for art ids.
 * @param {Record<string, string>} map alias -> id
 */
export function registerAliases(map) {
  for (const [a, id] of Object.entries(map)) aliases.set(a, id);
}

/**
 * Canonical art id for an id or alias, or `null`.
 * @param {string} id
 * @returns {string|null}
 */
export function resolveArtId(id) {
  if (registry.has(id)) return id;
  const a = aliases.get(id);
  return a !== undefined && registry.has(a) ? a : null;
}

/**
 * The normalized definition of an art id (or alias).
 * @param {string} id
 * @returns {ArtDef}
 * @throws {Error} on an unknown id
 */
export function artDef(id) {
  const k = resolveArtId(id);
  if (!k) throw new Error(`atlas: unknown art '${id}'`);
  return registry.get(k);
}

/** @returns {string[]} every registered art id */
export function artIds() {
  return [...registry.keys()];
}

/* ------------------------------------------------------------ palettes */

/** Hex for a palette value (colour name or hex); `'shadow'` resolves to `null` (drawn separately). */
function rawHex(v) {
  if (v === 'shadow') return null;
  if (v === null) return null;
  return v[0] === '#' ? v : COLORS[v];
}

/** Whether art of this kind is never graded. */
const exemptKind = (def) => LUT_EXEMPT_KINDS.includes(def.kind) || def.source === 'ui';

/* ------------------------------------------------------------ raw cache */

/** @type {Map<string, Map<string, any[]>>} id -> variantName -> [frame*4 + flip] */
const raw = new Map();
/** @type {Map<string, any[]>} id -> [frame] shadow sprites (null when none) */
const shadows = new Map();
/** @type {WeakMap<object, Record<string, string|null>>} pal object -> hex palette */
const rawPalCache = new WeakMap();

function rawPalette(palObj) {
  let p = rawPalCache.get(palObj);
  if (!p) {
    p = {};
    for (const [ch, v] of Object.entries(palObj)) p[ch] = rawHex(v);
    rawPalCache.set(palObj, p);
  }
  return p;
}

/** The palette a variant draws with (its override, or the art's own). */
function palOf(def, name) {
  return (name && def.variantPal && def.variantPal[name]) || def.pal;
}

function framesOf(def, name) {
  if (!name || name === 'default') return def.frames;
  const v = def.variants && def.variants[name];
  if (!v) throw new Error(`atlas: art '${def.id}' has no variant '${name}'`);
  return v;
}

function slotArray(map, key, size) {
  let a = map.get(key);
  if (!a) {
    a = new Array(size).fill(null);
    map.set(key, a);
  }
  return a;
}

/* ------------------------------------------------------------ graded cache */

/**
 * @typedef {Object} Bucket
 * @property {string} id
 * @property {object} grade
 * @property {number} used          LRU stamp
 * @property {Map<string, string|null>} hex   colour value -> graded hex
 * @property {Map<string, Map<string, any[]>>} images  id -> variant -> [frame*4 + flip]
 * @property {number} count
 */
/** @type {Bucket[]} */
const buckets = [];
let clock = 0;
let evictions = 0;

function bucketFor(grade) {
  const id = grade.id;
  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (b.id === id) {
      b.used = ++clock;
      return b;
    }
  }
  if (buckets.length >= MAX_GRADE_BUCKETS) {
    let lru = 0;
    for (let i = 1; i < buckets.length; i++) if (buckets[i].used < buckets[lru].used) lru = i;
    buckets.splice(lru, 1);
    evictions++;
  }
  const b = { id, grade, used: ++clock, hex: new Map(), images: new Map(), count: 0 };
  buckets.push(b);
  return b;
}

function gradedHex(b, v) {
  let h = b.hex.get(v);
  if (h !== undefined) return h;
  const base = rawHex(v);
  if (base === null || base === undefined) h = base ?? null;
  else if (isLutExempt(v)) h = base;
  else h = gradeHex(base.slice(0, 7), b.grade, NIGHT_INK);
  b.hex.set(v, h);
  return h;
}

/**
 * Resolves a grade argument: a Grade object, a grade id (`'<slot>|<weather>'` or `'indoor'`), or
 * `null` / `'raw'` for ungraded.
 * @param {object|string|null|undefined} g
 * @returns {object|null}
 */
export function resolveGrade(g) {
  if (g === null || g === undefined || g === 'raw') return null;
  if (typeof g === 'object') {
    if (typeof g.id !== 'string' || !g.mult || g.mult.length !== 3) throw new TypeError('atlas: grade must come from lighting.gradeFor');
    return g;
  }
  if (typeof g === 'string') {
    for (const b of buckets) if (b.id === g) return b.grade;
    if (g === 'indoor') return INDOOR_GRADE;
    const m = /^(\d+)\|([a-z]+)$/.exec(g);
    if (m) {
      const grade = gradeFor(Number(m[1]) * 30, m[2]);
      if (grade.id === g) return grade;
    }
  }
  throw new RangeError(`atlas: unknown grade ${JSON.stringify(g)}`);
}

/* ------------------------------------------------------------ rasterizer */

let canvasFactory = null;

/**
 * Overrides canvas creation for graded images (tests, workers). `null` restores the default
 * (`OffscreenCanvas`, then `document.createElement('canvas')`).
 * @param {((w: number, h: number) => any)|null} fn
 */
export function setAtlasCanvasFactory(fn) {
  canvasFactory = fn || null;
}

function makeCanvas(w, h) {
  if (canvasFactory) return canvasFactory(w, h);
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('atlas: no canvas implementation (set one with setAtlasCanvasFactory)');
}

const hexRgb = new Map();
function rgbOf(hex) {
  let c = hexRgb.get(hex);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
      hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) : 255];
    hexRgb.set(hex, c);
  }
  return c;
}

/**
 * Rasterizes rows through a char -> hex palette into a frozen `{w, h, pixels, canvas}` image.
 * @param {ReadonlyArray<string>} rows @param {Record<string, string|null>} pal @param {number} flip bit 1 = x, bit 2 = y
 */
function rasterize(rows, pal, flip) {
  const h = rows.length, w = rows[0].length;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const r = rows[(flip & 2) ? h - 1 - y : y];
    for (let x = 0; x < w; x++) {
      const ch = r[(flip & 1) ? w - 1 - x : x];
      if (ch === '.' || ch === ' ') continue;
      const hex = pal[ch];
      if (!hex) continue;
      const c = rgbOf(hex);
      const i = (y * w + x) * 4;
      pixels[i] = c[0]; pixels[i + 1] = c[1]; pixels[i + 2] = c[2]; pixels[i + 3] = c[3];
    }
  }
  let canvas = null;
  const img = { w, h, pixels, ox: 0, oy: 0 };
  Object.defineProperty(img, 'canvas', {
    enumerable: false,
    get() {
      if (!canvas) {
        canvas = makeCanvas(w, h);
        const c2 = canvas.getContext('2d');
        const data = c2.createImageData(w, h);
        data.data.set(pixels);
        c2.putImageData(data, 0, 0);
      }
      return canvas;
    },
  });
  return Object.freeze(img);
}

/* ------------------------------------------------------------ public draws */

/**
 * @typedef {Object} SpriteVariant
 * @property {number} [frame=0]       frame index (wraps)
 * @property {string} [name]          named variant (`'back'`, `'lit'`, ...)
 * @property {object|string|null} [grade]   Grade / grade id; omitted = ungraded
 * @property {boolean} [flipX]
 * @property {boolean} [flipY]
 */

/**
 * A decoded image of any registered art.
 * @param {string} artId id or alias
 * @param {number|string|SpriteVariant} [variant] frame number, variant name, or options
 * @returns {{w: number, h: number, pixels: Uint8ClampedArray, canvas: any}}
 */
export function getSprite(artId, variant) {
  let frame = 0, name = null, grade = null, flip = 0;
  if (typeof variant === 'number') frame = variant;
  else if (typeof variant === 'string') name = variant;
  else if (variant) {
    frame = variant.frame || 0;
    name = variant.name || null;
    grade = variant.grade === undefined ? null : variant.grade;
    flip = (variant.flipX ? 1 : 0) | (variant.flipY ? 2 : 0);
  }
  return imageOf(artId, frame, grade, flip, name);
}

/**
 * A tile frame through a grade.
 * @param {string} id tile id or alias
 * @param {number} [frame=0] animation frame (wraps)
 * @param {object|string|null} [grade] Grade / grade id; `null` = ungraded
 * @param {number} [flip=0] bit 1 mirrors x, bit 2 mirrors y (texture variety on ground tiles)
 * @returns {{w: number, h: number, pixels: Uint8ClampedArray, canvas: any}}
 */
export function getTile(id, frame = 0, grade = null, flip = 0) {
  return imageOf(id, frame, grade, flip, null);
}

function imageOf(artId, frame, gradeArg, flip, name) {
  const id = registry.has(artId) ? artId : resolveArtId(artId);
  if (!id) throw new Error(`atlas: unknown art '${artId}'`);
  const def = registry.get(id);
  const frames = framesOf(def, name);
  const n = frames.length;
  const fi = ((frame % n) + n) % n;
  const slot = fi * 4 + (flip & 3);
  const vkey = name || 'default';
  const grade = exemptKind(def) ? null : resolveGrade(gradeArg);
  if (!grade) {
    let byVar = raw.get(id);
    if (!byVar) { byVar = new Map(); raw.set(id, byVar); }
    const arr = slotArray(byVar, vkey, n * 4);
    let s = arr[slot];
    if (!s) {
      s = decodeSprite(frames[fi], rawPalette(palOf(def, name)), { flipX: !!(flip & 1), flipY: !!(flip & 2) });
      arr[slot] = s;
    }
    return s;
  }
  const b = bucketFor(grade);
  let byVar = b.images.get(id);
  if (!byVar) { byVar = new Map(); b.images.set(id, byVar); }
  const arr = slotArray(byVar, vkey, n * 4);
  let s = arr[slot];
  if (!s) {
    if (b.count >= MAX_BUCKET_IMAGES) {
      b.images.clear();
      b.count = 0;
      return imageOf(artId, frame, grade, flip, name);
    }
    const src = palOf(def, name);
    const pal = {};
    for (const ch in src) pal[ch] = gradedHex(b, src[ch]);
    s = rasterize(frames[fi], pal, flip & 3);
    arr[slot] = s;
    b.count++;
  }
  return s;
}

/**
 * The cast-shadow pixels of an art frame (chars whose colour is `'shadow'`), in `COLORS.shadow`, or
 * `null` when the art has none. Ungraded: the renderer draws it with `lighting.shadowFor().alpha`.
 * @param {string} artId @param {number} [frame=0]
 * @returns {{w: number, h: number, canvas: any}|null}
 */
export function getShadow(artId, frame = 0) {
  const id = resolveArtId(artId);
  if (!id) throw new Error(`atlas: unknown art '${artId}'`);
  const def = registry.get(id);
  const n = def.frames.length;
  const fi = ((frame % n) + n) % n;
  let arr = shadows.get(id);
  if (!arr) { arr = new Array(n).fill(undefined); shadows.set(id, arr); }
  if (arr[fi] !== undefined) return arr[fi];
  const shadowChars = Object.entries(def.pal).filter(([, v]) => v === 'shadow').map(([c]) => c);
  let s = null;
  if (shadowChars.length) {
    const pal = {};
    for (const ch of Object.keys(def.pal)) pal[ch] = shadowChars.includes(ch) ? COLORS.shadow : null;
    s = decodeSprite(def.frames[fi], pal);
  }
  arr[fi] = s;
  return s;
}

/**
 * Animation frame of an art id at time `ms` (its own `fps`; 0 fps -> frame 0). Allocation-free.
 * @param {string} artId @param {number} ms @param {number} [phase=0]
 * @returns {number}
 */
export function animFrame(artId, ms, phase = 0) {
  const def = registry.get(artId) || artDef(artId);
  const n = def.frames.length;
  if (n < 2 || !def.fps) return 0;
  const f = Math.floor((ms * def.fps) / 1000 + phase);
  return ((f % n) + n) % n;
}

/**
 * One colour value through a grade (for renderers that fill rectangles in a palette colour).
 * @param {string} value colour name or hex
 * @param {object|string|null} grade
 * @returns {string} `#rrggbb`
 */
export function gradeColour(value, grade) {
  const g = resolveGrade(grade);
  const base = hexOf(value);
  if (!g || isLutExempt(value)) return base;
  return gradeHex(base, g, NIGHT_INK);
}

/* ------------------------------------------------------------ atlases */

/**
 * Packs every raw frame of the tiles, props and UI art into three atlases (`core/pixelart.buildAtlas`).
 * `index` maps `<id>#<frame>` (and `<id>@<variant>#<frame>`) to the atlas frame index.
 * @param {{maxWidth?: number, padding?: number}} [opts]
 * @returns {{tiles: GameAtlas, props: GameAtlas, ui: GameAtlas, lookup: (id: string, frame?: number, variant?: string) => {atlas: object, index: number}|null}}
 */
export function buildGameAtlases(opts = {}) {
  const maxWidth = opts.maxWidth ?? 1024;
  const padding = opts.padding ?? 1;
  const groups = { tiles: [], props: [], ui: [] };
  for (const def of registry.values()) {
    const g = def.source === 'tile' ? 'tiles' : def.source === 'prop' ? 'props' : def.source === 'ui' ? 'ui' : null;
    if (g) groups[g].push(def);
  }
  const out = {};
  for (const [g, defs] of Object.entries(groups)) {
    const sprites = [];
    const index = new Map();
    for (const def of defs) {
      def.frames.forEach((_, f) => {
        index.set(`${def.id}#${f}`, sprites.length);
        sprites.push(imageOf(def.id, f, null, 0, null));
      });
      if (def.variants) {
        for (const [vn, vf] of Object.entries(def.variants)) {
          vf.forEach((_, f) => {
            index.set(`${def.id}@${vn}#${f}`, sprites.length);
            sprites.push(imageOf(def.id, f, null, 0, vn));
          });
        }
      }
    }
    out[g] = sprites.length ? { atlas: buildAtlas(sprites, { maxWidth, padding }), index } : { atlas: null, index };
  }
  out.lookup = (id, frame = 0, variant) => {
    const k = resolveArtId(id);
    if (!k) return null;
    const key = variant ? `${k}@${variant}#${frame}` : `${k}#${frame}`;
    for (const g of ['tiles', 'props', 'ui']) {
      const i = out[g].index.get(key);
      if (i !== undefined) return { atlas: out[g].atlas, index: i };
    }
    return null;
  };
  return out;
}
/** @typedef {{atlas: object|null, index: Map<string, number>}} GameAtlas */

/* ------------------------------------------------------------ maintenance */

/**
 * Cache sizes (tests, the debug overlay).
 * @returns {{art: number, rawImages: number, grades: string[], gradedImages: number, evictions: number}}
 */
export function atlasStats() {
  let rawImages = 0;
  for (const byVar of raw.values()) for (const arr of byVar.values()) for (const s of arr) if (s) rawImages++;
  let gradedImages = 0;
  for (const b of buckets) gradedImages += b.count;
  return { art: registry.size, rawImages, grades: buckets.map((b) => b.id), gradedImages, evictions };
}

/** Drops every decoded image (raw and graded). Registrations stay. */
export function clearAtlasCache() {
  raw.clear();
  shadows.clear();
  buckets.length = 0;
  evictions = 0;
}

/* ------------------------------------------------------------ built-in registrations */

registerArt(TILE_ART, { source: 'tile' });
registerArt(PROP_ART, { source: 'prop' });
registerArt(UI_ART, { source: 'ui', kind: 'ui' });
registerAliases(TILE_ALIASES);

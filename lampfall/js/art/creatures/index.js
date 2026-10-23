/**
 * Creature art by form id (GDD-00 §14, GDD-03 §6.5, §8; ARCHITECTURE §8.4). [ART-CREATURES]
 *
 * Gathers the per-family sprite files (`./<family>.js`, keyed by species id) into one table and
 * decodes on demand. 42 forms: the 22 art-directed prototype forms ported pixel-for-pixel, the 20
 * GDD-03 §8 briefs, and the Vagary at 96×96 (the one body that draws comet magenta `m`). Every form
 * has a front, a second idle frame and a back view, and four Heartmark anchors per frame.
 *
 * Star-touched forms are palette remaps of the form's rows (the comet-dusk grey treatment the art
 * director chose for Star-touched Sloshkin: the family's `starPalette` from `js/data/species`), one per
 * family with a `star` entry.
 *
 * Exports:
 *  - {@link CREATURE_SPRITES}: `{[speciesId]: record}` (the shape `tools/lint-art` and
 *    `tools/validate-data` read: `rows`, `idle2`, `back`, `palette`, `heartmarks`, `heartmarksBack`,
 *    `heartmarksIdle2` (the four anchors per frame), `mark` (the default anchor key), `w`, `h`,
 *    `highlight`, `reserved` on the Vagary). The single-point `heartmark*` fields of the prototype
 *    shape are added by {@link creatureArt}; they are left off these records because
 *    `tools/validate-data` hands `rows` to `pixelart.opaqueBounds` (which wants a decoded Sprite)
 *    whenever a record carries `heartmark`.
 *  - {@link STAR_SPRITES}: `{['star-' + speciesId]: record}` for the 14 Star-touched forms
 *  - {@link CREATURE_ICONS}: `{[speciesId]: {rows, palette, ox, oy}}` 16×16 head crops
 *  - {@link getCreatureSprite}`(id, {frame, back, star, silhouette, scale, flipX})` → decoded Sprite
 *  - {@link getCreatureIcon}`(id, {star, silhouette})` → decoded 16×16 Sprite
 *  - the battle-lane adapter API, kept: {@link creatureArt}, {@link creatureSprite}, {@link drawCreature},
 *    {@link hasArt}, {@link CREATURE_SIZE}, {@link SPRITE_NAME_BY_ID}, {@link DRAWN_IDS}
 * Every record is also registered with `art/atlas` (source `creature`; frames `[front, idle2]`,
 * variants `back`, `star`, `star-back`), which `scenes/menuKit` reads.
 * @module art/creatures
 */
import { decodeSprite, drawSprite, silhouette as silhouetteOf } from '../../core/pixelart.js';
import { MASTER, TYPE_PALETTE_KEY, pal } from '../palette.js';
import { registerArt } from '../atlas.js';
import { drawHeartmark, markAnchor, bodyKeyAt, ANCHOR_KEYS } from '../heartmark.js';
import { FAMILIES_BY_ID, SPECIES_BY_ID } from '../../data/species/index.js';
import { DATA } from '../../data/index.js';
import * as sloshkin from './sloshkin.js';
import * as scrapling from './scrapling.js';
import * as sedgehare from './sedgehare.js';
import * as prismoth from './prismoth.js';
import * as vesperay from './vesperay.js';
import * as bilgebob from './bilgebob.js';
import * as creelwight from './creelwight.js';
import * as wirewhisk from './wirewhisk.js';
import * as rimeplate from './rimeplate.js';
import * as caldermaw from './caldermaw.js';
import * as rillfin from './rillfin.js';
import * as tossup from './tossup.js';
import * as errant from './errant.js';
import * as duskowl from './duskowl.js';
import * as stillox from './stillox.js';
import * as vagary from './vagary.js';

/** Standard sprite edge in art pixels (the Vagary is 96). */
export const CREATURE_SIZE = 32;
/** Icon edge (GDD-00 §14: icons are a 16×16 head crop). */
export const ICON_SIZE = 16;
/** Prefix of Star-touched ids in {@link STAR_SPRITES}. */
export const STAR_PREFIX = 'star-';

/** The family sprite modules, in manifest order. */
export const FAMILY_ART = Object.freeze([
  sloshkin, scrapling, sedgehare, prismoth, vesperay, bilgebob, creelwight, wirewhisk,
  rimeplate, caldermaw, rillfin, tossup, errant, duskowl, stillox, vagary,
]);

const pt = (p) => Object.freeze({ x: p.x, y: p.y });
const anchorsOf = (a) => Object.freeze(Object.fromEntries(ANCHOR_KEYS.map((k) => [k, pt(a[k])])));
const freezeRows = (r) => Object.freeze(r.slice());

/**
 * Remaps palette letters inside rows.
 * @param {readonly string[]} rows @param {Record<string, string>} map
 * @returns {string[]}
 */
export function remapRows(rows, map) {
  return rows.map((r) => r.replace(/./g, (ch) => map[ch] ?? ch));
}

/** @param {readonly (readonly string[])[]} frames @returns {string} the letters drawn, sorted */
function lettersOf(frames) {
  const s = new Set();
  for (const rows of frames) for (const r of rows) for (const ch of r) if (ch !== '.') s.add(ch);
  return [...s].sort().join('');
}

/**
 * Builds the runtime record from a family-file entry.
 * @param {string} id @param {any} e @param {string} familyId
 */
function record(id, e, familyId) {
  const size = e.size ?? e.rows.length;
  const keys = lettersOf([e.rows, e.idle2, e.back]);
  const heartmarks = anchorsOf(e.anchors);
  const heartmarksIdle2 = anchorsOf(e.anchorsIdle2);
  const heartmarksBack = anchorsOf(e.anchorsBack);
  const mark = e.mark && ANCHOR_KEYS.includes(e.mark) ? e.mark : 'head';
  /** @type {any} */
  const r = {
    id, family: familyId, source: e.source, w: size, h: size, size,
    rows: freezeRows(e.rows), idle2: freezeRows(e.idle2), back: freezeRows(e.back),
    palette: Object.freeze(pal(keys)), keys: e.keys, highlight: e.highlight, idle: e.idle, mark,
    heartmarks, heartmarksIdle2, heartmarksBack,
  };
  if (e.conceptSize) r.conceptSize = e.conceptSize;
  if (keys.includes('m')) r.reserved = 'vagary';
  return Object.freeze(r);
}

/** Placeholder egg rows for ids outside the roster (k ink, f fill, s shade, w eye / tag). */
const PLACEHOLDER_ROWS = Object.freeze((() => {
  const W = CREATURE_SIZE;
  const rows = [];
  const inside = (x, y) => ((x - 15.5) / 10.5) ** 2 + ((y - 18) / 11.5) ** 2 <= 1;
  for (let y = 0; y < W; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      if (inside(x, y)) {
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        line += edge ? 'k' : (x - 15.5) + (y - 18) * 1.2 > 6 ? 's' : 'f';
      } else line += '.';
    }
    rows.push(line);
  }
  const set = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  for (const [x, y] of [[11, 14], [12, 14], [18, 14], [19, 14]]) set(x, y, 'k');
  set(11, 13, 'w'); set(18, 13, 'w');
  return rows;
})());

/** Type colour letter -> its shade letter (placeholder eggs). */
const SHADE_OF = Object.freeze({ v: 'e', u: 'k', b: 'n', o: 'r', g: 't', y: 'o', s: 'b', w: 'v', e: 'd', r: 'p', i: 's', p: 'd', d: 'k' });

/** @type {Record<string, any>} */
const table = {};
/** @type {Record<string, string>} */
const familyOf = {};
for (const mod of FAMILY_ART) {
  for (const [id, e] of Object.entries(mod.SPRITES)) {
    table[id] = record(id, e, mod.FAMILY);
    familyOf[id] = mod.FAMILY;
  }
}

/**
 * Placeholder records for species ids the live `DATA` table names that are not in the roster (the
 * integration stand-ins in `js/data/placeholder/`): a field-guide egg in the form's type colour, so a
 * battle never shows a hole. They disappear once `DATA.species` is the real roster.
 * @returns {Record<string, any>}
 */
function placeholderRecords() {
  /** @type {Record<string, any>} */
  const out = {};
  for (const sp of DATA?.species ?? []) {
    if (!sp || typeof sp.id !== 'string' || table[sp.id]) continue;
    const name = typeof sp.types?.[0] === 'string' ? sp.types[0] : 'Plain';
    const f = TYPE_PALETTE_KEY[name[0].toUpperCase() + name.slice(1).toLowerCase()] ?? 'v';
    const s = SHADE_OF[f] ?? 'e';
    const rows = remapRows(PLACEHOLDER_ROWS, { f, s });
    const back = remapRows(PLACEHOLDER_ROWS.map((r) => r.replace(/w/g, 'f').replace(/k(?=.*k)/g, 'k')), { f, s })
      .map((r, y) => (y === 13 || y === 14 ? r.replace(/(?<=k[^.]*)k(?=[^.]*k)/g, f) : r));
    const p = Object.freeze({ x: 15, y: 10 });
    const four = Object.freeze({ head: p, chest: Object.freeze({ x: 15, y: 20 }), back: Object.freeze({ x: 20, y: 14 }), tail: Object.freeze({ x: 22, y: 24 }) });
    out[sp.id] = Object.freeze({
      id: sp.id, family: sp.familyId ?? null, source: 'placeholder', placeholder: true, w: CREATURE_SIZE, h: CREATURE_SIZE, size: CREATURE_SIZE,
      rows: Object.freeze(rows), idle2: Object.freeze(rows.slice(1).concat(['.'.repeat(CREATURE_SIZE)])), back: Object.freeze(back),
      palette: Object.freeze(pal(lettersOf([rows, back]))), keys: lettersOf([rows, back]), highlight: 'w', idle: 'hover', mark: 'head',
      heartmarks: four, heartmarksIdle2: Object.freeze({ head: { x: 15, y: 9 }, chest: { x: 15, y: 19 }, back: { x: 20, y: 13 }, tail: { x: 22, y: 23 } }), heartmarksBack: four,
    });
  }
  return out;
}

/** Every form's sprite record, by species id (Field Log order; then any placeholder stand-ins). */
export const CREATURE_SPRITES = Object.freeze(Object.fromEntries(
  Object.keys(SPECIES_BY_ID).filter((id) => table[id]).map((id) => [id, table[id]])
    .concat(Object.keys(table).filter((id) => !SPECIES_BY_ID[id]).map((id) => [id, table[id]]))
    .concat(Object.entries(placeholderRecords())),
));

/** Ids of every form with art. */
export const CREATURE_IDS = Object.freeze(Object.keys(CREATURE_SPRITES).filter((id) => !CREATURE_SPRITES[id].placeholder));

/**
 * The Star-touched remap of a family (`starPalette`, letter -> letter), or null.
 * @param {string} familyId
 * @returns {Readonly<Record<string, string>>|null}
 */
export function starRemap(familyId) {
  const f = FAMILIES_BY_ID[familyId];
  return f && f.star && f.starPalette ? f.starPalette : null;
}

/** Star-touched records by `star-<speciesId>` (one per family that names a `star` form). */
export const STAR_SPRITES = Object.freeze(Object.fromEntries(
  Object.values(FAMILIES_BY_ID).filter((f) => f.star && table[f.star] && f.starPalette).map((f) => {
    const base = table[f.star];
    const map = f.starPalette;
    const rows = remapRows(base.rows, map);
    const idle2 = remapRows(base.idle2, map);
    const back = remapRows(base.back, map);
    const keys = lettersOf([rows, idle2, back]);
    const id = STAR_PREFIX + f.star;
    return [id, Object.freeze({
      ...base, id, star: true, starOf: f.star, starRemap: Object.freeze({ ...map }),
      rows: Object.freeze(rows), idle2: Object.freeze(idle2), back: Object.freeze(back),
      palette: Object.freeze(pal(keys)),
    })];
  }),
));

// ---------------------------------------------------------------------------------------------
// Icons: 16×16 head crops
// ---------------------------------------------------------------------------------------------

/**
 * The crop origin of a form's icon: a 16×16 window centred on the head anchor, kept inside the
 * sprite (the Vagary crops its 32×32 concept area at ÷3 resolution: see {@link iconRows}).
 * @param {any} rec
 * @returns {{ox: number, oy: number, step: number}}
 */
function iconWindow(rec) {
  const step = rec.w > CREATURE_SIZE ? Math.round(rec.w / CREATURE_SIZE) : 1;
  const span = ICON_SIZE * step;
  const head = rec.heartmarks.head;
  const ox = Math.max(0, Math.min(rec.w - span, Math.round(head.x - 7 * step)));
  const oy = Math.max(0, Math.min(rec.h - span, Math.round(head.y - 8 * step)));
  return { ox, oy, step };
}

/**
 * The 16×16 icon rows of a record (nearest-sample for the 96×96 Vagary).
 * @param {any} rec
 * @returns {{rows: string[], ox: number, oy: number, step: number}}
 */
export function iconRows(rec) {
  const { ox, oy, step } = iconWindow(rec);
  const rows = [];
  for (let y = 0; y < ICON_SIZE; y++) {
    let line = '';
    for (let x = 0; x < ICON_SIZE; x++) line += rec.rows[oy + y * step + (step >> 1)]?.[ox + x * step + (step >> 1)] ?? '.';
    rows.push(line);
  }
  return { rows, ox, oy, step };
}

/** Icons by species id: `{rows (16×16), palette, ox, oy, step}`. */
export const CREATURE_ICONS = Object.freeze(Object.fromEntries(
  Object.entries(CREATURE_SPRITES).map(([id, rec]) => {
    const ic = iconRows(rec);
    return [id, Object.freeze({ rows: Object.freeze(ic.rows), palette: rec.palette, ox: ic.ox, oy: ic.oy, step: ic.step })];
  }),
));

// ---------------------------------------------------------------------------------------------
// Atlas registration (scenes/menuKit reads creature art through art/atlas)
// ---------------------------------------------------------------------------------------------

/** @type {Record<string, any>} */
const atlasTable = {};
for (const [id, rec] of Object.entries(CREATURE_SPRITES)) {
  const star = STAR_SPRITES[STAR_PREFIX + id];
  /** @type {any} */
  const def = { rows: rec.rows, idle2: rec.idle2, back: rec.back, palette: rec.palette, kind: 'creature', w: rec.w, h: rec.h };
  if (rec.reserved) def.reserved = rec.reserved;
  if (star) {
    def.variants = { star: [star.rows, star.idle2], 'star-back': [star.back] };
    def.variantPal = { star: star.palette, 'star-back': star.palette };
  }
  atlasTable[id] = def;
}
registerArt(atlasTable, { source: 'creature', kind: 'creature', replace: true });

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

/**
 * A record by species id or `star-<id>`; `{star: true}` picks the Star-touched remap when the form
 * has one.
 * @param {string} id
 * @param {{star?: boolean}} [opts]
 * @returns {any|null}
 */
export function creatureRecord(id, opts = {}) {
  if (typeof id !== 'string') return null;
  if (id.startsWith(STAR_PREFIX) && STAR_SPRITES[id]) return STAR_SPRITES[id];
  if (id.endsWith('-star') && STAR_SPRITES[STAR_PREFIX + id.slice(0, -5)]) return STAR_SPRITES[STAR_PREFIX + id.slice(0, -5)];
  const base = CREATURE_SPRITES[id] ?? null;
  if (base && opts.star) return STAR_SPRITES[STAR_PREFIX + id] ?? base;
  return base;
}

/** @type {Map<string, any>} */
const spriteCache = new Map();

/**
 * A decoded creature sprite (cached).
 * @param {string} id  species id (or `star-<id>`)
 * @param {{frame?: 0|1, back?: boolean, star?: boolean, silhouette?: string|boolean|null, scale?: number, flipX?: boolean}} [opts]
 *   `silhouette`: a hex colour (or `true` for ink) every pixel is flattened to (unseen forms)
 * @returns {import('../../core/pixelart.js').Sprite|null}
 */
export function getCreatureSprite(id, opts = {}) {
  const rec = creatureRecord(id, opts);
  if (!rec) return null;
  const back = !!opts.back;
  const frame = !back && opts.frame === 1 ? 1 : 0;
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const flipX = !!opts.flipX;
  const sil = opts.silhouette === true ? MASTER.k : (opts.silhouette || null);
  const key = `${rec.id}|${back ? 'b' : frame}|${scale}|${flipX ? 1 : 0}|${sil ?? ''}`;
  let s = spriteCache.get(key);
  if (!s) {
    const rows = back ? rec.back : frame === 1 ? rec.idle2 : rec.rows;
    s = decodeSprite(/** @type {string[]} */ (rows), rec.palette, { scale, flipX });
    if (sil) s = silhouetteOf(s, sil);
    spriteCache.set(key, s);
  }
  return s;
}

/**
 * A decoded 16×16 icon (head crop).
 * @param {string} id
 * @param {{star?: boolean, silhouette?: string|boolean|null}} [opts]
 * @returns {import('../../core/pixelart.js').Sprite|null}
 */
export function getCreatureIcon(id, opts = {}) {
  const rec = creatureRecord(id, opts);
  if (!rec) return null;
  const sil = opts.silhouette === true ? MASTER.k : (opts.silhouette || null);
  const key = `icon|${rec.id}|${sil ?? ''}`;
  let s = spriteCache.get(key);
  if (!s) {
    s = decodeSprite(iconRows(rec).rows, rec.palette);
    if (sil) s = silhouetteOf(s, sil);
    spriteCache.set(key, s);
  }
  return s;
}

// ---------------------------------------------------------------------------------------------
// Adapter API (kept from the battle lane's thin adapter: callers depend on it)
// ---------------------------------------------------------------------------------------------

/** @param {string} id @returns {string} prototype sprite name */
function protoName(id) {
  if (id === 'star-sloshkin' || id === 'sloshkin-star') return 'StarSloshkin';
  return id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/** Species id → prototype sprite name, for the 22 forms ported from `proto/creatures` (plus Star-touched Sloshkin). */
export const SPRITE_NAME_BY_ID = Object.freeze(Object.fromEntries(
  Object.entries(CREATURE_SPRITES).filter(([, r]) => r.source === 'drawn').map(([id]) => [id, protoName(id)])
    .concat(STAR_SPRITES['star-sloshkin'] ? [['star-sloshkin', 'StarSloshkin']] : []),
));

/** Ids of every form with drawn art (now every form, plus the Star-touched ids). */
export const DRAWN_IDS = Object.freeze([...CREATURE_IDS, ...Object.keys(STAR_SPRITES)]);

/**
 * Whether a form has art (false only for ids outside the roster: they get the placeholder card).
 * @param {string} id
 * @returns {boolean}
 */
export function hasArt(id) {
  return !!creatureRecord(id);
}

/** @param {string} type @returns {{f: string, s: string}} */
function typeFill(type) {
  const name = typeof type === 'string' && type ? type[0].toUpperCase() + type.slice(1).toLowerCase() : 'Plain';
  const key = TYPE_PALETTE_KEY[name] ?? 'v';
  const shadeKey = { v: 'e', u: 'k', b: 'n', o: 'r', g: 't', y: 'o', s: 'b', w: 'v', e: 'd', r: 'p', i: 's', p: 'd', d: 'k' }[key] ?? 'e';
  return { f: MASTER[key], s: MASTER[shadeKey] };
}

/** @type {Map<string, any>} */
const placeholderCache = new Map();

/** @param {string} type */
function placeholderArt(type) {
  const key = String(type || 'Plain');
  let hit = placeholderCache.get(key);
  if (!hit) {
    const { f, s } = typeFill(key);
    const p = { x: 15, y: 10 };
    hit = Object.freeze({
      rows: PLACEHOLDER_ROWS, back: null, idle2: null, palette: { k: MASTER.k, f, s, w: MASTER.w },
      heartmark: p, heartmarkBack: p, heartmarkIdle2: p, heartmarks: { head: p, chest: p, back: p, tail: p },
      heartmarksBack: { head: p, chest: p, back: p, tail: p }, heartmarksIdle2: { head: p, chest: p, back: p, tail: p },
      w: CREATURE_SIZE, h: CREATURE_SIZE, placeholder: true,
    });
    placeholderCache.set(key, hit);
  }
  return hit;
}

/**
 * The raw art record for a form.
 * @param {string} id  species (form) id, or `star-<id>`
 * @param {{types?: string[], star?: boolean, anchor?: string}} [opts]
 *   `types` tint the placeholder for ids outside the roster; `anchor` picks which of the four
 *   Heartmark anchors `heartmark*` report (default: the form's `mark`)
 * @returns {any}
 */
export function creatureArt(id, opts = {}) {
  const rec = creatureRecord(id, opts);
  if (!rec) return placeholderArt(opts.types && opts.types[0]);
  const k = opts.anchor && ANCHOR_KEYS.includes(opts.anchor) ? opts.anchor : rec.mark;
  return {
    ...rec, placeholder: false,
    heartmark: rec.heartmarks[k], heartmarkBack: rec.heartmarksBack[k], heartmarkIdle2: rec.heartmarksIdle2[k],
  };
}

/** @type {Map<string, any>} */
const adapterCache = new Map();

/**
 * A decoded sprite for a form (adapter signature).
 * @param {string} id
 * @param {{view?: 'front'|'back', frame?: 0|1, scale?: number, types?: string[], silhouette?: string|null, flipX?: boolean, star?: boolean}} [opts]
 * @returns {import('../../core/pixelart.js').Sprite}
 */
export function creatureSprite(id, opts = {}) {
  if (creatureRecord(id, opts)) {
    return /** @type {any} */ (getCreatureSprite(id, { back: opts.view === 'back', frame: opts.frame, scale: opts.scale, flipX: opts.flipX, silhouette: opts.silhouette, star: opts.star }));
  }
  const art = placeholderArt(opts.types && opts.types[0]);
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const flipX = opts.view === 'back' ? !opts.flipX : !!opts.flipX;
  const key = `ph|${opts.types?.[0]}|${scale}|${flipX}|${opts.silhouette ?? ''}`;
  let s = adapterCache.get(key);
  if (!s) {
    s = decodeSprite(/** @type {string[]} */ (art.rows), art.palette, { scale, flipX });
    if (opts.silhouette) s = silhouetteOf(s, opts.silhouette);
    adapterCache.set(key, s);
  }
  return s;
}

/**
 * Draws a creature with its Heartmark.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} x   top-left on screen
 * @param {number} y
 * @param {{view?: 'front'|'back', frame?: 0|1, scale?: number, types?: string[], silhouette?: string|null, alpha?: number,
 *   anchor?: string, mark?: {x: number, y: number}|null, lit?: boolean, glint?: number, showMark?: boolean, flipX?: boolean, star?: boolean}} [opts]
 *   `anchor`: the individual's anchor key (GDD-00 §14); `mark`: a legacy pixel offset added to it
 * @returns {{w: number, h: number, mark: {x: number, y: number}}}
 */
export function drawCreature(ctx, id, x, y, opts = {}) {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const rec = creatureRecord(id, opts);
  const sprite = creatureSprite(id, opts);
  drawSprite(ctx, sprite, Math.round(x), Math.round(y), opts.alpha !== undefined ? { alpha: opts.alpha } : undefined);
  const back = opts.view === 'back';
  const w = rec ? rec.w : CREATURE_SIZE;
  const h = rec ? rec.h : CREATURE_SIZE;
  let at;
  if (rec) {
    const k = opts.anchor && ANCHOR_KEYS.includes(opts.anchor) ? opts.anchor : ANCHOR_KEYS.includes(opts.mark?.anchor) ? opts.mark.anchor : rec.mark;
    const set = back ? rec.heartmarksBack : opts.frame === 1 ? rec.heartmarksIdle2 : rec.heartmarks;
    at = markAnchor({ heartmark: set[k] }, opts.mark, { w, h });
    if (opts.flipX) at = { x: w - 1 - at.x, y: at.y };
  } else {
    const art = placeholderArt(opts.types && opts.types[0]);
    at = markAnchor(art, opts.mark);
    if (back !== !!opts.flipX) at = { x: CREATURE_SIZE - 1 - at.x, y: at.y };
  }
  if (opts.showMark !== false && !opts.silhouette) {
    const rows = rec ? (back ? rec.back : opts.frame === 1 ? rec.idle2 : rec.rows) : PLACEHOLDER_ROWS;
    const src = opts.flipX ? { x: w - 1 - at.x, y: at.y } : at;
    const body = bodyKeyAt({ rows: /** @type {string[]} */ (rows) }, src);
    const centre = rec?.highlight === 'y' ? '#FFCD75' : rec?.highlight === 'w' ? '#F4F4F4' : null;
    drawHeartmark(ctx, Math.round(x), Math.round(y), at, { lit: opts.lit !== false, scale, glint: opts.glint ?? 0, body, alpha: opts.alpha, centre });
  }
  return { w: w * scale, h: h * scale, mark: at };
}

/** @param {string} id @returns {string|null} family id of a form */
export function familyOfForm(id) {
  return familyOf[id] ?? null;
}

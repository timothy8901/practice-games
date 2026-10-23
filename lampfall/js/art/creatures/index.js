/**
 * Creature art by form id. [ART-CREATURES — THIN ADAPTER by SCN-BATTLE; the creature-art lane
 * replaces this file]
 *
 * Maps the manifest's species ids to the drawn 32×32 sprites in `proto/creatures/sprites.js` by
 * name (`sloshkin` -> `Sloshkin`, the Star-touched Sloshkin -> `StarSloshkin`). Forms that are not
 * drawn yet get a placeholder card: a field-guide egg silhouette in the form's type colour with a
 * question tag, so a battle never shows a hole. Back views fall back to the mirrored front.
 *
 * Exports:
 *  - {@link creatureArt}(id) → the raw record (rows, palette, back, idle2, heartmark anchors, placeholder flag)
 *  - {@link creatureSprite}(id, opts) → a decoded, cached `core/pixelart` Sprite
 *  - {@link drawCreature}(ctx, id, x, y, opts) → sprite + Heartmark in one call
 * @module art/creatures
 */
import { SPRITES } from '../../../proto/creatures/sprites.js';
import { SPECIES_IDS } from '../../data/ids.manifest.js';
import { decodeSprite, drawSprite, silhouette as silhouetteOf } from '../../core/pixelart.js';
import { MASTER, TYPE_PALETTE_KEY } from '../palette.js';
import { drawHeartmark, markAnchor, bodyKeyAt } from '../heartmark.js';

/** Sprite edge in art pixels. */
export const CREATURE_SIZE = 32;

/** @param {string} id @returns {string} proto sprite name for a species id */
function protoName(id) {
  if (id === 'star-sloshkin' || id === 'sloshkin-star') return 'StarSloshkin';
  return id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/** Species id → proto sprite name, for every manifest form that is drawn. */
export const SPRITE_NAME_BY_ID = Object.freeze(Object.fromEntries(
  [...SPECIES_IDS, 'star-sloshkin'].map((id) => [id, protoName(id)]).filter(([, name]) => !!SPRITES[name]),
));

/** Ids of the forms with drawn art. */
export const DRAWN_IDS = Object.freeze(Object.keys(SPRITE_NAME_BY_ID));

/**
 * Whether a form has drawn art (false: the placeholder card is used).
 * @param {string} id
 * @returns {boolean}
 */
export function hasArt(id) {
  return Object.prototype.hasOwnProperty.call(SPRITE_NAME_BY_ID, id);
}

// ---------------------------------------------------------------------------------------------
// Placeholder card
// ---------------------------------------------------------------------------------------------

/**
 * Builds the placeholder egg: an outlined oval body with a shaded lower-right, two eyes and a
 * small '?' tag, in palette letters `k` (ink), `f` (fill), `s` (shade), `w` (eye / tag).
 * @returns {string[]}
 */
function placeholderRows() {
  const W = CREATURE_SIZE;
  const rows = [];
  const cx = 15.5;
  const cy = 18;
  const rx = 10.5;
  const ry = 11.5;
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  for (let y = 0; y < W; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      if (inside(x, y)) {
        const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        const shade = (x - cx) + (y - cy) * 1.2 > 6;
        line += edge ? 'k' : shade ? 's' : 'f';
      } else line += '.';
    }
    rows.push(line);
  }
  const set = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  // eyes
  for (const [x, y] of [[11, 14], [12, 14], [18, 14], [19, 14]]) set(x, y, 'k');
  set(11, 13, 'w'); set(18, 13, 'w');
  // question tag, top right
  const tag = ['kkkkk', 'kwwwk', 'kkkwk', 'kkwwk', 'kkkkk', 'kkwkk', 'kkkkk'];
  tag.forEach((r, j) => { for (let i = 0; i < r.length; i++) set(24 + i, 2 + j, r[i]); });
  return rows;
}

const PLACEHOLDER_ROWS = Object.freeze(placeholderRows());

/** @param {string} type @returns {{f: string, s: string}} fill + shade for a type */
function typeFill(type) {
  const name = typeof type === 'string' && type ? type[0].toUpperCase() + type.slice(1).toLowerCase() : 'Plain';
  const key = TYPE_PALETTE_KEY[name] ?? 'v';
  const shadeKey = { v: 'e', u: 'k', b: 'n', o: 'r', g: 't', y: 'o', s: 'b', w: 'v', e: 'd', r: 'p', i: 's', p: 'd', d: 'k' }[key] ?? 'e';
  return { f: MASTER[key], s: MASTER[shadeKey] };
}

/** @type {Map<string, any>} */
const placeholderCache = new Map();

/**
 * @param {string} type
 * @returns {{rows: readonly string[], palette: Record<string, string>, heartmark: {x: number, y: number}, heartmarkBack: {x: number, y: number}, placeholder: true}}
 */
function placeholderArt(type) {
  const key = String(type || 'Plain');
  let hit = placeholderCache.get(key);
  if (!hit) {
    const { f, s } = typeFill(key);
    hit = Object.freeze({
      rows: PLACEHOLDER_ROWS, back: null, idle2: null, palette: { k: MASTER.k, f, s, w: MASTER.w },
      heartmark: { x: 15, y: 10 }, heartmarkBack: { x: 15, y: 10 }, placeholder: true,
    });
    placeholderCache.set(key, hit);
  }
  return hit;
}

// ---------------------------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------------------------

/**
 * The raw art record for a form.
 * @param {string} id   species (form) id
 * @param {{types?: string[]}} [opts]   types tint the placeholder card for undrawn forms
 * @returns {{rows: readonly string[], back: readonly string[]|null, idle2: readonly string[]|null, palette: Record<string, string>,
 *   heartmark: {x: number, y: number}, heartmarkBack?: {x: number, y: number}, placeholder: boolean}}
 */
export function creatureArt(id, opts = {}) {
  const name = SPRITE_NAME_BY_ID[id];
  const s = name ? SPRITES[name] : null;
  if (!s) return placeholderArt(opts.types && opts.types[0]);
  return {
    rows: s.rows, back: s.back ?? null, idle2: s.idle2 ?? null, palette: s.palette,
    heartmark: s.heartmark, heartmarkBack: s.heartmarkBack ?? s.heartmark, heartmarkIdle2: s.heartmarkIdle2 ?? s.heartmark,
    placeholder: false,
  };
}

/** @type {Map<string, any>} */
const silCache = new Map();

/**
 * A decoded sprite for a form.
 * @param {string} id
 * @param {{view?: 'front'|'back', frame?: 0|1, scale?: number, types?: string[], silhouette?: string|null, flipX?: boolean}} [opts]
 *   `silhouette`: a hex colour to flatten every pixel to (unseen Forecast forms)
 * @returns {import('../../core/pixelart.js').Sprite}
 */
export function creatureSprite(id, opts = {}) {
  const art = creatureArt(id, opts);
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  let rows = art.rows;
  let flipX = !!opts.flipX;
  if (opts.view === 'back') {
    if (art.back) rows = art.back;
    else flipX = !flipX; // mirrored front until a back view is drawn
  } else if (opts.frame === 1 && art.idle2) rows = art.idle2;
  const sprite = decodeSprite(/** @type {string[]} */ (rows), art.palette, { scale, flipX });
  if (!opts.silhouette) return sprite;
  const key = `${id}|${opts.view}|${opts.frame}|${scale}|${flipX}|${opts.silhouette}`;
  let sil = silCache.get(key);
  if (!sil) {
    sil = silhouetteOf(sprite, opts.silhouette);
    silCache.set(key, sil);
  }
  return sil;
}

/**
 * Draws a creature with its Heartmark.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {number} x   top-left on screen
 * @param {number} y
 * @param {{view?: 'front'|'back', frame?: 0|1, scale?: number, types?: string[], silhouette?: string|null, alpha?: number,
 *   mark?: {x: number, y: number}|null, lit?: boolean, glint?: number, showMark?: boolean, flipX?: boolean}} [opts]
 * @returns {{w: number, h: number, mark: {x: number, y: number}}}
 */
export function drawCreature(ctx, id, x, y, opts = {}) {
  const scale = Math.max(1, Math.round(opts.scale ?? 1));
  const art = creatureArt(id, opts);
  const sprite = creatureSprite(id, opts);
  drawSprite(ctx, sprite, Math.round(x), Math.round(y), opts.alpha !== undefined ? { alpha: opts.alpha } : undefined);
  const back = opts.view === 'back';
  const mirrored = back && !art.back ? !opts.flipX : !!opts.flipX;
  let at = markAnchor(art, opts.mark, { back: back && !!art.back });
  if (opts.frame === 1 && !back && art.heartmarkIdle2 && !art.placeholder) at = markAnchor({ heartmark: art.heartmarkIdle2 }, opts.mark);
  if (mirrored) at = { x: CREATURE_SIZE - 1 - at.x, y: at.y };
  if (opts.showMark !== false && !opts.silhouette) {
    const rowsForBody = back && art.back ? { rows: art.back } : art;
    const body = bodyKeyAt(rowsForBody, mirrored ? { x: CREATURE_SIZE - 1 - at.x, y: at.y } : at);
    drawHeartmark(ctx, Math.round(x), Math.round(y), at, { lit: opts.lit !== false, scale, glint: opts.glint ?? 0, body, alpha: opts.alpha });
  }
  return { w: CREATURE_SIZE * scale, h: CREATURE_SIZE * scale, mark: at };
}

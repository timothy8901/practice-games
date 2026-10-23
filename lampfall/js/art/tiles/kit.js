/**
 * Shared authoring kit for the tile groups (split from `proto/tiles/tiles.js`). [ART-TILES]
 *
 * Each group module builds its tiles with {@link createGroup} and exports the frozen table. A tile is
 *
 * ```
 * { id, group, kind, w, h, frames: string[][], pal: Record<char, colourName>, fps, anchor?, reserved?, alias? }
 * ```
 *
 * - `frames[i]` is `h` strings of `w` chars; `'.'` is transparent; every other char indexes `pal`.
 * - `pal` values are names in `art/palette.COLORS` (`!name` = LUT-exempt light) or, for UI art, hexes
 *   from the palette (`art/palette.UI`). The special name
 *   `'shadow'` marks the dithered cast shadow: the atlas draws it as a separate translucent sprite
 *   offset by the sun (`atlas.getShadow`), never inside the tile.
 * - `kind`: `'prop'` (props.js), `'ui'` (ui.js), `'ground'` (16×16 base layer), `'edge'` (16×16 autotile overlay drawn on a ground tile),
 *   `'detail'` (16×16 over ground, under entities), `'object'` (multi-tile or tall art anchored at its
 *   bottom-left tile, y-sorted with entities), `'fx'` (light pools, fog bands; drawn by the light /
 *   weather passes).
 * - `fps`: animation rate (0 = static). Frames loop.
 *
 * `def` validates sizes, palette chars and colour names at load and throws a readable error, so a
 * broken tile fails the smoke import; `tools/lint-art.mjs` repeats every rule in bulk.
 *
 * Pure: no DOM.
 * @module art/tiles/kit
 */

import { COLORS, inPalette } from '../palette.js';
import { blank } from '../spriteUtil.js';

export const TILE = 16;

/** Tile kinds. */
export const KINDS = Object.freeze(['ground', 'edge', 'detail', 'object', 'fx', 'prop', 'ui']);

/**
 * Starts a tile group.
 * @param {string} group  group name (`'ground'`, `'water'`, ...)
 * @returns {{tiles: Record<string, object>, def: Function, get: (id: string) => object}}
 */
export function createGroup(group) {
  const tiles = {};
  /**
   * Defines one tile.
   * @param {string} id   kebab-case id
   * @param {Record<string, string>} pal  char -> colour name
   * @param {string[]|string[][]} frames  one frame (rows) or an array of frames
   * @param {{w?: number, h?: number, kind?: string, fps?: number, reserved?: string, anchor?: {x: number, y: number}, note?: string,
   *   variants?: Record<string, string[]|string[][]|{frames?: string[]|string[][], pal?: Record<string, string>}>}} [opts]
   *   `variants`: named frame sets; `{pal}` overrides palette entries for that variant (lit / unlit lamps).
   */
  function def(id, pal, frames, opts = {}) {
    pal = { ...pal };
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`tile ${id}: id must be kebab-case`);
    if (tiles[id]) throw new Error(`tile ${id}: defined twice in group ${group}`);
    if (!Array.isArray(frames[0])) frames = [frames];
    const w = opts.w ?? TILE, h = opts.h ?? TILE;
    const check = (list, label) => {
      for (let fi = 0; fi < list.length; fi++) {
        const f = list[fi];
        if (f.length !== h) throw new Error(`tile ${id}${label} frame ${fi}: ${f.length} rows, want ${h}`);
        f.forEach((r, i) => {
          if (r.length !== w) throw new Error(`tile ${id}${label} frame ${fi} row ${i}: ${r.length} cols, want ${w}: "${r}"`);
          for (const ch of r) if (ch !== '.' && !(ch in pal)) throw new Error(`tile ${id}: char '${ch}' missing from palette`);
        });
      }
    };
    check(frames, '');
    // variants: name -> frames, or {frames?, pal?} (a palette override; frames default to the main ones)
    let variants = null, variantPal = null;
    if (opts.variants) {
      variants = {};
      for (const [vn, v] of Object.entries(opts.variants)) {
        const spec = Array.isArray(v) ? { frames: v } : v;
        const vfr = spec.frames || frames;
        const list = Array.isArray(vfr[0]) ? vfr : [vfr];
        const vpal = spec.pal ? { ...pal, ...spec.pal } : pal;
        for (const c of Object.values(vpal)) {
          if (!(c in COLORS) && !(typeof c === 'string' && c[0] === '#' && inPalette(c))) throw new Error(`tile ${id}@${vn}: unknown colour ${c}`);
        }
        const saved = pal;
        pal = vpal;
        check(list, `@${vn}`);
        pal = saved;
        variants[vn] = Object.freeze(list.map((f) => Object.freeze(f.slice())));
        if (spec.pal) (variantPal ||= {})[vn] = Object.freeze(vpal);
      }
    }
    for (const v of Object.values(pal)) {
      if (!(v in COLORS) && !(typeof v === 'string' && v[0] === '#' && inPalette(v))) throw new Error(`tile ${id}: unknown colour ${v}`);
    }
    const kind = opts.kind ?? (w === TILE && h === TILE ? 'ground' : 'object');
    if (!KINDS.includes(kind)) throw new Error(`tile ${id}: unknown kind ${kind}`);
    const t = {
      id, group, kind, w, h,
      frames: Object.freeze(frames.map((f) => Object.freeze(f.slice()))),
      pal: Object.freeze({ ...pal }),
      fps: opts.fps ?? 0,
    };
    if (variants) t.variants = Object.freeze(variants);
    if (variantPal) t.variantPal = Object.freeze(variantPal);
    if (opts.reserved) t.reserved = opts.reserved;
    if (opts.anchor) t.anchor = Object.freeze({ ...opts.anchor });
    if (opts.note) t.note = opts.note;
    tiles[id] = Object.freeze(t);
    return tiles[id];
  }
  const get = (id) => {
    const t = tiles[id];
    if (!t) throw new Error(`tile group ${group}: no tile ${id}`);
    return t;
  };
  return { tiles, def, get };
}

/** First frame rows of a tile. @param {{frames: string[][]}} t @returns {string[]} */
export const rowsOf = (t, f = 0) => t.frames[f % t.frames.length];

/**
 * Procedural leaf canopy: overlapping round lobes lit from the top-left, a shadow crescent where a
 * higher lobe overhangs a lower one, light flecks on the lit side, and a selective outline (own-hue
 * dark along the top, the deepest shade along the underside). Returns `h` rows of `w` chars.
 * @param {number} w @param {number} h
 * @param {{cx:number, cy:number, r:number}[]} lobes
 * @param {{out:string, deep:string, l:string, b:string, d:string}} ch palette chars
 * @returns {string[]}
 */
export function canopy(w, h, lobes, ch) {
  const inside = (x, y) => lobes.some((L) => (x - L.cx) ** 2 + (y - L.cy) ** 2 <= L.r * L.r);
  const minX = Math.min(...lobes.map((L) => L.cx - L.r)), maxX = Math.max(...lobes.map((L) => L.cx + L.r));
  const minY = Math.min(...lobes.map((L) => L.cy - L.r)), maxY = Math.max(...lobes.map((L) => L.cy + L.r));
  const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2, R = Math.max(maxX - minX, maxY - minY) / 2;
  const grid = blank(w, h).map((r) => r.split(''));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const dot = -((x - cx0) / R + (y - cy0) / R) / Math.SQRT2;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) { grid[y][x] = dot < -0.1 || !inside(x, y + 1) ? ch.deep : ch.out; continue; }
      let shaded = false;
      for (const M of lobes) {
        if (y <= M.cy) continue;
        const dm = Math.hypot(x - M.cx, y - M.cy) / M.r;
        if (dm > 1 || dm < 0.8) continue;
        if (lobes.some((N) => N !== M && N.cy > M.cy && (x - N.cx) ** 2 + (y - N.cy) ** 2 <= N.r * N.r)) shaded = true;
      }
      const checker = ((x + y) & 1) === 0;
      let c = dot > 0.5 || (dot > 0.4 && checker) ? ch.l : dot > -0.25 || (dot > -0.35 && checker) ? ch.b : ch.d;
      if (shaded) c = c === ch.l ? ch.b : ch.d;
      else if (c === ch.b && dot > 0.1 && (x * 7 + y * 13) % 23 === 0) c = ch.l;
      grid[y][x] = c;
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grid[y][x] === '.' && grid[y][x - 1] !== '.' && grid[y][x + 1] !== '.') grid[y][x] = ch.deep;
    }
  }
  return grid.map((r) => r.join(''));
}

/**
 * Shrinks highlight / trough runs (`h+` / `k+`) by `e` pixels from one end (water shimmer frames).
 * @param {string} row @param {number} e @param {boolean} fromLeft @param {string} [fill='w']
 * @returns {string}
 */
export function erode(row, e, fromLeft, fill = 'w') {
  return row.replace(/h+|k+/g, (run) => {
    const keep = Math.max(1, run.length - e);
    const pad = fill.repeat(run.length - keep);
    return fromLeft ? pad + run.slice(0, keep) : run.slice(0, keep) + pad;
  });
}

/** Rotates rows downward by `n` (seamless river flow). @param {string[]} rows @param {number} n */
export const rot = (rows, n) => rows.map((_, i) => rows[(i - n + rows.length * 8) % rows.length]);

/**
 * Scatter: places `glyph` rows at deterministic spots chosen by a hash; used for pebbles, flowers,
 * sparkles. Spots are `[x, y]` pairs.
 * @param {string[]} rows @param {string[]} glyph @param {Array<[number, number]>} spots
 * @param {(rows: string[], g: string[], x: number, y: number) => string[]} blitFn
 * @returns {string[]}
 */
export function scatter(rows, glyph, spots, blitFn) {
  return spots.reduce((r, [x, y]) => blitFn(r, glyph, x, y), rows);
}

/**
 * Paints `glyph` onto `rows` with wrap-around at the tile edges (seamless textures).
 * @param {string[]} rows @param {string[]} glyph @param {number} x @param {number} y
 * @returns {string[]}
 */
export function wrapBlit(rows, glyph, x, y) {
  const h = rows.length, w = rows[0].length;
  const g = rows.map((r) => r.split(''));
  for (let j = 0; j < glyph.length; j++) {
    for (let i = 0; i < glyph[j].length; i++) {
      const c = glyph[j][i];
      if (c === '.' || c === ' ') continue;
      g[(((y + j) % h) + h) % h][(((x + i) % w) + w) % w] = c;
    }
  }
  return g.map((r) => r.join(''));
}

/**
 * Seamless texture: a flat field of `base` with glyphs wrap-blitted at the given spots.
 * @param {string} base  fill char
 * @param {Array<[string[], number, number]>} marks  `[glyph, x, y]`
 * @param {number} [w=16] @param {number} [h=16]
 * @returns {string[]}
 */
export function texture(base, marks, w = TILE, h = TILE) {
  return marks.reduce((r, [g, x, y]) => wrapBlit(r, g, x, y), blank(w, h, base));
}

/**
 * Y-sorted sprites (ARCHITECTURE §4.7 step 5, §12; GDD-00 §14 motion). [RENDER]
 *
 * One pass draws the map's objects (trees, lamp posts, the lighthouse, boats, chimneys, stalls:
 * any art taller or wider than a tile, listed by `tileRenderer`) and the live entities, merged and
 * ordered by the row their feet stand on. Per frame it allocates nothing: drawables are pooled
 * records, sorted with an insertion sort (the order barely changes frame to frame).
 *
 * - **Per-grade recolour cache**: every sprite is fetched through `art/atlas.getSprite(id, {grade})`,
 *   whose per-grade buckets (LRU, 3 resident) hold the recoloured images; the hour LUT is applied to
 *   characters exactly as to tiles, and `!` / reserved colours stay unlit.
 * - **Characters** animate at 12 fps on the 60 fps world (a pose every 83 ms; idle, step A, idle,
 *   step B), use their run frames when stepping at run speed, `sit` / `fish` poses when `e.pose`
 *   says so, and stand on a dithered contact shadow.
 * - **Objects** cast their art's dithered shadow offset by the sun (`lighting.shadowFor`), sway on
 *   their own frames with a per-object phase, light up after dusk (`lit` variant or `litArt`), the
 *   boat bobs a pixel, and the lighthouse shows its scaffold stage and burning lamp.
 * - **Occlusion**: feet sink into water (a wading cut with a two-frame ripple ring) and into tall
 *   grass, reeds and heather (the cover tile's lower rows are redrawn over the feet).
 * - **Emotes**: a paper bubble with a glyph pops up over the head (4 f rise, no squash); bubbles are
 *   HUD and bypass the LUT.
 *
 * DOM-free at import.
 * @module render/entityRenderer
 */

import { getSprite, getShadow, getTile, artDef, resolveArtId, animFrame, gradeColour } from '../art/atlas.js';
import { UI, COLORS } from '../art/palette.js';
import { lampsLit } from '../world/lighting.js';
import { makeCanvas, ctx2d, DRAW, BAYER4 } from './surface.js';
import { CELL, cellStates, resolveCell, COVER_ART, isLit } from './tileRenderer.js';

/** Milliseconds per character pose (12 fps, GDD-00 §14). */
export const CHAR_POSE_MS = 1000 / 12;
/** Run speed threshold (ms per tile at or below which run frames are used). */
const RUN_STEP_MS = 110;
/** Pixels of a sprite hidden when wading / in cover. */
export const WADE_CUT = 5;
export const COVER_CUT = 5;

/**
 * Walk pose (0..3) for an animation clock: idle, step A, idle, step B.
 * @param {number} animMs
 * @returns {number}
 */
export function poseAt(animMs) {
  return Math.floor(animMs / CHAR_POSE_MS) & 3;
}

/* ================================================================== emote glyphs */

/** 7x7 emote glyphs: `#` ink, `o` accent. */
export const EMOTE_GLYPHS = Object.freeze({
  '!': ['...#...', '..###..', '..###..', '..###..', '...#...', '.......', '...#...'],
  '?': ['..###..', '.#...#.', '.....#.', '....#..', '...#...', '.......', '...#...'],
  music: ['...###.', '...#.#.', '...#.#.', '...#.#.', '.###.#.', '.###.##', '..#....'],
  heart: ['.......', '.oo.oo.', 'ooooooo', 'ooooooo', '.ooooo.', '..ooo..', '...o...'],
  dots: ['.......', '.......', '.......', '#.#.#..', '.......', '.......', '.......'].map((r) => r.slice(0, 7)),
  sleep: ['.####..', '....#..', '...#...', '..#....', '.####..', '.....##', '......#'],
  anger: ['.#...#.', '..#.#..', '##...##', '.......', '##...##', '..#.#..', '.#...#.'],
  idea: ['..ooo..', '.ooooo.', '.ooooo.', '..ooo..', '..###..', '..###..', '...#...'],
  sweat: ['....o..', '...oo..', '..oooo.', '..oooo.', '...oo..', '.......', '.......'],
  coin: ['..ooo..', '.oo#oo.', 'oo#o#oo', 'ooo#ooo', 'oo#o#oo', '.oo#oo.', '..ooo..'],
});
/** Emote names. */
export const EMOTES = Object.freeze(Object.keys(EMOTE_GLYPHS));
const EMOTE_ACCENT = Object.freeze({ heart: UI.waxRed, idea: UI.porchAmber, sweat: '#6FBFCF', coin: UI.brass });

/** @type {Map<string, any>} */
const bubbles = new Map();

/**
 * The bubble canvas for an emote (13x13: paper body, ink rim, tail at the bottom centre).
 * @param {string} name
 * @returns {any|null}
 */
function bubbleFor(name) {
  let b = bubbles.get(name);
  if (b !== undefined) return b;
  const glyph = EMOTE_GLYPHS[name] || (name.length === 1 ? null : null);
  if (!glyph) { bubbles.set(name, null); return null; }
  const W = 13, Hh = 13;
  const c = makeCanvas(W, Hh);
  const g = ctx2d(c);
  const ink = UI.nightInk, paper = UI.cream, shade = UI.paperShade;
  g.fillStyle = paper;
  g.fillRect(1, 1, 11, 9);
  g.fillStyle = ink;
  g.fillRect(2, 0, 9, 1); g.fillRect(2, 10, 9, 1); g.fillRect(0, 2, 1, 7); g.fillRect(12, 2, 1, 7);
  g.fillRect(1, 1, 1, 1); g.fillRect(11, 1, 1, 1); g.fillRect(1, 9, 1, 1); g.fillRect(11, 9, 1, 1);
  g.fillStyle = shade;
  g.fillRect(2, 9, 9, 1); g.fillRect(11, 2, 1, 7);
  // tail
  g.fillStyle = paper; g.fillRect(5, 10, 3, 1); g.fillRect(6, 11, 1, 1);
  g.fillStyle = ink; g.fillRect(4, 10, 1, 1); g.fillRect(8, 10, 1, 1); g.fillRect(5, 11, 1, 1); g.fillRect(7, 11, 1, 1); g.fillRect(6, 12, 1, 1);
  const accent = EMOTE_ACCENT[name] || UI.waxRed;
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ch = glyph[y][x];
      if (ch === '.') continue;
      g.fillStyle = ch === '#' ? ink : accent;
      g.fillRect(3 + x, 2 + y, 1, 1);
    }
  }
  bubbles.set(name, c);
  return c;
}

/* ================================================================== shadows */

/** @type {Map<string, any>} */
const blobs = new Map();

/**
 * A dithered contact-shadow ellipse (opaque pixels in the shadow colour; drawn with alpha).
 * @param {number} w @param {number} h @param {string} color
 * @returns {any}
 */
function blobFor(w, h, color) {
  const key = `${w}x${h}|${color}`;
  let b = blobs.get(key);
  if (b) return b;
  b = makeCanvas(w, h);
  const g = ctx2d(b);
  g.fillStyle = color;
  const rx = w / 2, ry = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - rx) / rx, ny = (y + 0.5 - ry) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (d > 0.55 && BAYER4[((y & 3) << 2) | (x & 3)] >= 8) continue;
      g.fillRect(x, y, 1, 1);
    }
  }
  blobs.set(key, b);
  return b;
}

/* ================================================================== renderer */

/**
 * @typedef {Object} EntityFrameOpts
 * @property {object} grade
 * @property {number} ms                animation clock
 * @property {'low'|'mid'|'high'} tide
 * @property {{dx: number, dy: number, alpha: number}} shadow   sun shadow (lighting.shadowFor)
 * @property {object|null} analysis     tileRenderer analysis (occlusion, cover)
 * @property {Record<string, any>} [flags]
 * @property {{stage?: number, lit?: boolean}} [lighthouse]
 * @property {(cond: any) => boolean} [cond]
 * @property {(x: number, y: number) => void} [onEnterCell]   called when an entity steps onto a new tile (rustles)
 */

/**
 * @typedef {Object} EntityRenderer
 * @property {(ctx: any, objects: any[], entities: any[], rect: object, camX: number, camY: number, o: EntityFrameOpts) => number} draw
 * @property {() => {drawn: number, objects: number, entities: number}} stats
 */

/** @returns {EntityRenderer} */
export function createEntityRenderer() {
  /** pooled drawables */
  const pool = [];
  const items = [];
  let count = 0;
  /** per-entity animation and art state */
  const state = new WeakMap();
  let lastMs = 0;
  let drawn = 0, nObj = 0, nEnt = 0;
  const warned = new Set();

  function rec() {
    let r = pool[count];
    if (!r) { r = { sortY: 0, tie: 0, obj: null, ent: null }; pool[count] = r; }
    items[count] = r;
    count++;
    return r;
  }

  function entState(e) {
    let s = state.get(e);
    if (!s) {
      s = { art: null, artKey: '', isChar: false, anim: 0, idle: 999, lastPx: e.px, lastPy: e.py, cellX: e.x, cellY: e.y, emote: null, emoteT0: 0 };
      state.set(e, s);
    }
    return s;
  }

  function resolveEntityArt(e, s) {
    const key = e.artId || '';
    if (s.artKey === key && s.art !== undefined) return s.art;
    s.artKey = key;
    let id = key ? resolveArtId(key) : null;
    if (!id && e.npcId) id = resolveArtId(`char-${e.npcId}`);
    if (!id && e.kind === 'player') id = resolveArtId('char-player');
    if (!id && key.includes(':')) id = resolveArtId(`char-${key.split(':')[1]}`) || resolveArtId(key.split(':')[1]);
    s.art = id;
    s.isChar = !!id && artDef(id).kind === 'char';
    if (!id && !warned.has(key)) { warned.add(key); if (typeof console !== 'undefined') console.warn(`entityRenderer: no art for entity '${e.id}' (${key})`); }
    return id;
  }

  function drawObject(ctx, o, dx, dy, opt) {
    const def = artDef(o.art);
    let art = o.art;
    let name = o.variant || null;
    let frame = o.frame ?? (def.fps ? animFrame(art, opt.ms, o.phase) : 0);
    const lit = lampsLit(opt.grade) && (!o.glowFlag || (opt.flags && opt.flags[o.glowFlag]));
    if (o.special === 'lighthouse') {
      const L = opt.lighthouse || {};
      if (art === 'lighthouse') {
        frame = Math.max(0, Math.min(def.frames.length - 1, L.stage ?? 0));
        if (L.lit && def.variants && def.variants.lit) name = 'lit';
      } else if (L.lit && o.litArt) art = o.litArt;
    } else if (lit) {
      if (o.litArt) art = o.litArt;
      else if (o.litVariant) name = 'lit';
    }
    let x = o.x * 16 + dx;
    let y = o.sortY - def.h + dy;
    if (o.special === 'boat') y += Math.floor((opt.ms + o.x * 333) / 600) & 1;
    const sh = opt.shadow;
    if (sh.alpha >= 0.01) {
      const s = getShadow(art, name ? 0 : frame);
      if (s) {
        ctx.globalAlpha = sh.alpha;
        ctx.drawImage(s.canvas, x + sh.dx, y + sh.dy);
        ctx.globalAlpha = 1;
        DRAW.images++;
      }
    }
    const img = getSprite(art, name ? { frame, name, grade: opt.grade } : { frame, grade: opt.grade });
    ctx.drawImage(img.canvas, x, y);
    DRAW.images++;
  }

  function drawEntity(ctx, e, s, dx, dy, opt) {
    const id = s.art;
    if (!id) {
      if (e.kind === 'item') drawGlint(ctx, e.px + dx + 8, e.py + dy + 10, opt.ms);
      return;
    }
    const def = artDef(id);
    let name = null, frame = 0;
    if (s.isChar) {
      const pose = e.pose;
      if (pose === 'sit' || pose === 'fish' || pose === 'hang' || pose === 'perch') {
        name = def.variants && def.variants[pose] ? pose : null;
        frame = pose === 'fish' ? (e.poseStep ?? 0) : 0;
      } else {
        const f = e.facing || 'down';
        const run = e.speedMs && e.speedMs <= RUN_STEP_MS && s.idle < 60;
        const runName = `run-${f}`;
        name = run && def.variants && def.variants[runName] ? runName : f === 'down' ? null : f;
        frame = s.idle < 60 ? poseAt(s.anim) : 0;
      }
    } else if (def.fps) {
      frame = animFrame(id, opt.ms, (e.x + e.y) & 3);
    }
    const img = getSprite(id, name ? { frame, name, grade: opt.grade } : { frame, grade: opt.grade });
    const ax = def.anchor ? def.anchor.x : 0;
    const ay = def.anchor ? def.anchor.y : def.h - 1;
    const x = s.isChar ? e.px + 8 - ax + dx - ((img.w - def.w) >> 1) : e.px + dx;
    const y = s.isChar ? e.py + 15 - ay + dy : e.py + 16 - def.h + dy;
    // contact shadow (characters) / cast shadow (objects)
    if (s.isChar) {
      const blob = blobFor(def.w > 16 ? 14 : 10, 4, gradeColour('shadow', opt.grade));
      ctx.globalAlpha = opt.grade.night > 0.5 ? 0.28 : 0.38;
      ctx.drawImage(blob, e.px + dx + 8 - (blob.width >> 1), e.py + dy + 13);
      ctx.globalAlpha = 1;
      DRAW.images++;
    } else if (opt.shadow.alpha >= 0.01) {
      const sh = getShadow(id, frame);
      if (sh) {
        ctx.globalAlpha = opt.shadow.alpha;
        ctx.drawImage(sh.canvas, x + opt.shadow.dx, y + opt.shadow.dy);
        ctx.globalAlpha = 1;
        DRAW.images++;
      }
    }
    // occlusion by the cell under the feet
    const occ = s.isChar || e.kind === 'roamer' ? occlusionAt(e, opt) : null;
    if (occ && occ.mode === 1) {
      const cut = WADE_CUT;
      const hh = img.h - cut;
      if (hh > 0) ctx.drawImage(img.canvas, 0, 0, img.w, hh, x, y, img.w, hh);
      drawRipple(ctx, e.px + dx + 2, y + hh - 1, opt);
      DRAW.images++;
    } else {
      ctx.drawImage(img.canvas, x, y);
      DRAW.images++;
      if (occ && occ.mode === 2) {
        // redraw the cover tile's lower rows over the feet (the classic tall-grass look)
        const cellPx = occ.x * 16 + dx, cellPy = occ.y * 16 + dy;
        const f = s.idle < 60 ? 1 + (poseAt(s.anim) & 1) : 0;
        const tile = getTile(occ.art, f, opt.grade, 0);
        ctx.drawImage(tile.canvas, 0, 16 - COVER_CUT, 16, COVER_CUT, cellPx, cellPy + 16 - COVER_CUT, 16, COVER_CUT);
        DRAW.images++;
      }
    }
    // emote bubble
    if (e.emote) {
      if (s.emote !== e.emote) { s.emote = e.emote; s.emoteT0 = opt.ms; }
      const b = bubbleFor(e.emote);
      if (b) {
        const age = opt.ms - s.emoteT0;
        const rise = age < 66 ? 3 - Math.floor(age / 22) : 0;
        ctx.drawImage(b, e.px + dx + 2, y - 14 + rise);
        DRAW.images++;
      }
    } else s.emote = null;
  }

  function occlusionAt(e, opt) {
    const A = opt.analysis;
    if (!A) return null;
    const cx = e.t >= 0.5 ? e.x : e.fromX, cy = e.t >= 0.5 ? e.y : e.fromY;
    if (cx < 0 || cy < 0 || cx >= A.w || cy >= A.h) return null;
    const i = cy * A.w + cx;
    const st = cellStates(A, opt.tide)[i];
    if (st === CELL.SEA || st === CELL.RIVER || st === CELL.DEEP) return OCC_WADE;
    const s = A.slots[A.map.layers[0][i]];
    if (s && s.cover && !A.map.layers[1][i]) {
      OCC_COVER.x = cx; OCC_COVER.y = cy; OCC_COVER.art = s.art;
      return OCC_COVER;
    }
    return null;
  }
  const OCC_WADE = { mode: 1 };
  const OCC_COVER = { mode: 2, x: 0, y: 0, art: '' };

  function drawRipple(ctx, x, y, opt) {
    const f = Math.floor(opt.ms / 250) & 1;
    ctx.fillStyle = gradeColour('foam', opt.grade);
    ctx.globalAlpha = 0.85;
    const w = 12 + f * 2, ox = x - f;
    ctx.fillRect(ox + 2, y, w - 4, 1);
    ctx.fillRect(ox, y + 1, 2, 1);
    ctx.fillRect(ox + w - 2, y + 1, 2, 1);
    ctx.fillRect(ox + 2, y + 2, w - 4, 1);
    ctx.globalAlpha = 1;
    DRAW.fills++;
  }

  function drawGlint(ctx, x, y, ms) {
    const on = (Math.floor(ms / 180) & 3) !== 0;
    ctx.fillStyle = UI.cream;
    ctx.fillRect(x, y - 1, 1, 3);
    ctx.fillRect(x - 1, y, 3, 1);
    if (on) { ctx.fillStyle = UI.porchAmber; ctx.fillRect(x, y, 1, 1); }
    DRAW.fills++;
  }

  return {
    draw(ctx, objects, entities, rect, camX, camY, opt) {
      count = 0;
      const dt = Math.max(0, Math.min(100, opt.ms - lastMs));
      lastMs = opt.ms;
      const x0 = camX - 48, x1 = camX + rect.w + 48, y0 = camY - 16, y1 = camY + rect.h + 96;
      nObj = 0; nEnt = 0;
      for (let i = 0; i < objects.length; i++) {
        const o = objects[i];
        if (o.sortY < y0 || o.sortY - o.h > y1) continue;
        const px = o.x * 16;
        if (px + o.w < x0 || px > x1) continue;
        if (o.cond !== undefined && o.cond !== null && opt.cond && !opt.cond(o.cond)) continue;
        const r = rec();
        r.sortY = o.sortY; r.tie = 0; r.obj = o; r.ent = null;
        nObj++;
      }
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        const s = entState(e);
        // animation clock: advances while the entity moves; idle after 60 ms without movement
        if (e.px !== s.lastPx || e.py !== s.lastPy || e.moving) {
          if (s.idle >= 60) s.anim = CHAR_POSE_MS; // start on step A
          s.anim += dt;
          s.idle = 0;
        } else {
          s.idle += dt;
          if (s.idle >= 60) s.anim = 0;
        }
        s.lastPx = e.px; s.lastPy = e.py;
        if ((e.x !== s.cellX || e.y !== s.cellY) && opt.onEnterCell) opt.onEnterCell(e.x, e.y);
        s.cellX = e.x; s.cellY = e.y;
        if (e.py + 32 < y0 || e.py - 32 > y1 || e.px + 32 < x0 || e.px - 16 > x1) continue;
        resolveEntityArt(e, s);
        const r = rec();
        r.sortY = e.py + 16 + (e.z || 0); r.tie = 1; r.obj = null; r.ent = e;
        nEnt++;
      }
      // insertion sort by (sortY, objects before entities on ties)
      for (let i = 1; i < count; i++) {
        const a = items[i];
        let j = i - 1;
        while (j >= 0 && (items[j].sortY > a.sortY || (items[j].sortY === a.sortY && items[j].tie > a.tie))) { items[j + 1] = items[j]; j--; }
        items[j + 1] = a;
      }
      const dx = rect.x - camX, dy = rect.y - camY;
      for (let i = 0; i < count; i++) {
        const r = items[i];
        if (r.obj) drawObject(ctx, r.obj, dx, dy, opt);
        else drawEntity(ctx, r.ent, state.get(r.ent), dx, dy, opt);
      }
      drawn = count;
      return count;
    },
    stats: () => ({ drawn, objects: nObj, entities: nEnt }),
  };
}

export { COVER_ART, isLit, resolveCell };

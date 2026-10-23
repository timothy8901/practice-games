/**
 * Map-screen raster (ARCHITECTURE §1 `render/minimap.js`; GDD-00 §13: the Map screen; there is no
 * minimap on the overworld HUD). [RENDER]
 *
 * {@link minimapPixels} turns a RuntimeMap into an RGBA raster, `scale` pixels per tile: each tile is
 * its art's own average colour (so the raster follows the art with no hand-kept colour table),
 * water reads in its depth, tide flats show as water at high tide, buildings and cliffs get a dark
 * south lip so the town has relief, and the coast gets a one-pixel foam line. Optionally graded
 * through an hour (the map at night). {@link buildMinimap} rasterises to a cached canvas;
 * {@link drawMinimap} blits it with markers (the player blinking, lit lamps, porches, Waystones).
 *
 * The raster functions are pure (Node-testable); only {@link buildMinimap} touches a canvas.
 * @module render/minimap
 */

import { getTile, artDef, resolveArtId, gradeColour } from '../art/atlas.js';
import { drawsAsWater, tideVariant, TIDE_MASK } from '../world/tide.js';
import { UI } from '../art/palette.js';
import { makeCanvas, ctx2d, rgbOf, hexOfRgb } from './surface.js';

/** @type {Map<string, number[]>} art id -> average rgb of frame 0 */
const avgCache = new Map();

/**
 * Average opaque colour of an art id's first frame (ungraded), `[r, g, b]`.
 * @param {string} id
 * @returns {number[]|null}
 */
export function artAverage(id) {
  const k = resolveArtId(id);
  if (!k) return null;
  let c = avgCache.get(k);
  if (c) return c;
  const img = getTile(k, 0, null, 0);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < img.pixels.length; i += 4) {
    if (img.pixels[i + 3] < 128) continue;
    r += img.pixels[i]; g += img.pixels[i + 1]; b += img.pixels[i + 2]; n++;
  }
  c = n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
  avgCache.set(k, c);
  return c;
}

const WATER_ART = /^(water-|river|weir)/;
const RELIEF_ART = /^(wall-|window-|door|roof-|cliff|ledge|quarry|basalt|cave-wall)/;
const SUB_ART = (art, mask) => (resolveArtId(`${art}-sub`) ? `${art}-sub` : mask === TIDE_MASK.FLOODS ? 'water-shallow' : 'water-mud');

/**
 * Rasterises a map, `scale` px per tile.
 * @param {import('../world/tilemap.js').RuntimeMap} map
 * @param {{scale?: number, tide?: number|string, grade?: object|null}} [opts]
 * @returns {{w: number, h: number, scale: number, data: Uint8ClampedArray}}
 */
export function minimapPixels(map, opts = {}) {
  const scale = Math.max(1, Math.floor(opts.scale ?? 2));
  const v = tideVariant(opts.tide ?? 'mid');
  const grade = opts.grade || null;
  const W = map.w * scale, H = map.h * scale;
  const data = new Uint8ClampedArray(W * H * 4);
  const colorOf = (rgb) => (grade ? rgbOf(gradeColour(hexOfRgb(rgb[0], rgb[1], rgb[2]), grade)) : rgb);
  /** per-cell final colour and class: 0 land, 1 water, 2 relief */
  const cls = new Uint8Array(map.w * map.h);
  const rgbCell = new Array(map.w * map.h);
  const ink = rgbOf(UI.nightInk);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x;
      let art = null, kind = 0;
      const gs = map.layers[0][i];
      const gdef = map.tileDefs[gs];
      if (gdef) {
        art = resolveArtId(gdef.art || map.tileIds[gs]);
        if (art && map.tideMask[i] !== TIDE_MASK.NONE && drawsAsWater(map.tideMask[i], v, map.waterMask[i] === 1) && !gdef.water) art = SUB_ART(art, map.tideMask[i]);
      }
      const ds = map.layers[1][i];
      const ddef = map.tileDefs[ds];
      let rgb = art ? artAverage(art) : ink;
      if (art && WATER_ART.test(art)) kind = 1;
      if (art && RELIEF_ART.test(art)) kind = 2;
      if (ddef) {
        const dart = resolveArtId(ddef.art || map.tileIds[ds]);
        if (dart) {
          const d = artDef(dart);
          const avg = artAverage(dart);
          // trees and props tint their anchor tile; 16x16 details blend half over the ground
          rgb = d.w > 16 || d.h > 16 ? avg : rgb.map((c, k) => Math.round((c + avg[k]) / 2));
          if (ddef.solid) kind = kind === 1 ? 1 : 2;
        }
      }
      cls[i] = kind;
      rgbCell[i] = colorOf(rgb);
    }
  }
  const foam = colorOf(rgbOf('#EAF2F8'));
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x;
      const base = rgbCell[i];
      const southRelief = cls[i] === 2 && (y + 1 >= map.h || cls[i + map.w] !== 2);
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          let c = base;
          // relief: dark south lip on buildings and cliffs
          if (southRelief && sy === scale - 1) c = [base[0] * 0.55, base[1] * 0.55, base[2] * 0.62];
          // coast: water next to land gets a foam pixel on that side
          if (cls[i] === 1) {
            const landN = y > 0 && cls[i - map.w] !== 1 && sy === 0;
            const landW = x > 0 && cls[i - 1] !== 1 && sx === 0;
            const landE = x + 1 < map.w && cls[i + 1] !== 1 && sx === scale - 1;
            const landS = y + 1 < map.h && cls[i + map.w] !== 1 && sy === scale - 1;
            if (landN || landW || landE || landS) c = foam;
          }
          const o = ((y * scale + sy) * W + (x * scale + sx)) * 4;
          data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
        }
      }
    }
  }
  return { w: W, h: H, scale, data };
}

/** @type {WeakMap<object, Map<string, any>>} map -> cached rasters by options */
const rasters = new WeakMap();

/**
 * A cached canvas of {@link minimapPixels}.
 * @param {object} map
 * @param {{scale?: number, tide?: number|string, grade?: object|null}} [opts]
 * @returns {{canvas: any, w: number, h: number, scale: number}}
 */
export function buildMinimap(map, opts = {}) {
  const key = `${opts.scale ?? 2}|${tideVariant(opts.tide ?? 'mid')}|${opts.grade ? opts.grade.id : 'raw'}`;
  let m = rasters.get(map);
  if (!m) { m = new Map(); rasters.set(map, m); }
  let r = m.get(key);
  if (r) return r;
  const px = minimapPixels(map, opts);
  const canvas = makeCanvas(px.w, px.h);
  const g = ctx2d(canvas);
  const img = g.createImageData(px.w, px.h);
  img.data.set(px.data);
  g.putImageData(img, 0, 0);
  r = { canvas, w: px.w, h: px.h, scale: px.scale };
  m.set(key, r);
  return r;
}

/** Marker styles: [colour, size, blink]. */
const MARKER = Object.freeze({
  player: [UI.waxRed, 3, true],
  lamp: [UI.porchAmber, 1, false],
  porch: [UI.porchAmber, 2, false],
  waystone: ['#73EFF7', 2, false],
  npc: [UI.cream, 2, false],
  lighthouse: [UI.lighthouseAmber, 2, false],
});

/**
 * Draws a raster with markers.
 * @param {any} ctx
 * @param {{canvas: any, scale: number}} mini
 * @param {number} x @param {number} y
 * @param {{markers?: Array<{x: number, y: number, kind: string}>, ms?: number}} [opts]
 */
export function drawMinimap(ctx, mini, x, y, opts = {}) {
  ctx.drawImage(mini.canvas, x, y);
  const ms = opts.ms ?? 0;
  for (const mk of opts.markers || []) {
    const st = MARKER[mk.kind] || MARKER.npc;
    if (st[2] && (Math.floor(ms / 400) & 1)) continue;
    const s = st[1];
    const cx = x + mk.x * mini.scale + Math.floor(mini.scale / 2), cy = y + mk.y * mini.scale + Math.floor(mini.scale / 2);
    ctx.fillStyle = UI.nightInk;
    ctx.fillRect(cx - (s >> 1) - 1, cy - (s >> 1) - 1, s + 2, s + 2);
    ctx.fillStyle = st[0];
    ctx.fillRect(cx - (s >> 1), cy - (s >> 1), s, s);
  }
}

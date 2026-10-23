/**
 * @file Map renderer for the harbor tileset.
 *
 * `drawMap(ctx, map, tileset, { frame, hour, weather, tide, camX, camY, view })`
 *
 * Lighting is a palette LUT, not a screen overlay: for each time of day every tile
 * palette is re-graded (multiply by the hour tint, then screen against a night-ink
 * floor, then a saturation trim) and the tile is re-decoded from its string art.
 * Pixels therefore stay crisp and on-palette, and nothing ever crushes below
 * `#141B33`. Colours whose names start with `!` (lamps, bioluminescence, skyglass,
 * lit windows) bypass the LUT so they read as light sources at night.
 *
 * Layer order: ground → autotile edges (foam, cliff rims, quay lips) → props sorted
 * by their anchor row (shadows first) → lamp light pools → weather → Skyband.
 */

import { TILES, COLORS, TILE, SCAFFOLD_SECTION_ROWS, SCAFFOLD_BASE_ROW } from './tiles.js';

/* ------------------------------------------------------------ decoder */

let coreDecode = null;
try {
  const core = await import('../../js/core/pixelart.js');
  if (typeof core.decodeSprite === 'function') coreDecode = core.decodeSprite;
} catch (e) {
  coreDecode = null;
}

/** Tiny fallback decoder (used when js/core/pixelart.js is absent or broken). */
function localDecode(rows, palette) {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c2 = canvas.getContext('2d');
  const img = c2.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const r = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      const hex = palette[ch];
      if (!hex) continue;
      const i = (y * w + x) * 4;
      d[i] = parseInt(hex.slice(1, 3), 16);
      d[i + 1] = parseInt(hex.slice(3, 5), 16);
      d[i + 2] = parseInt(hex.slice(5, 7), 16);
      d[i + 3] = 255;
    }
  }
  c2.putImageData(img, 0, 0);
  return { w, h, canvas };
}

function decode(rows, palette) {
  if (coreDecode) {
    try {
      const s = coreDecode(rows, palette);
      if (s && s.canvas) return s;
    } catch (e) {
      coreDecode = null;
    }
  }
  return localDecode(rows, palette);
}

/* ------------------------------------------------------------- colour */

function hexToRgb01(hex) {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}
function rgb01ToHex(c) {
  const q = (v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
  return `#${q(c[0])}${q(c[1])}${q(c[2])}`;
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const INK = hexToRgb01(COLORS.ink);

/**
 * Hour keyframes for the LUT. `mul` = multiply tint, `scr` = screen floor (ambient),
 * `sat` = saturation, `lamp` = how lit the lamps/windows are, `night` = star/glow weight.
 */
const GRADES = [
  // Night keeps its blue mood but a low ambient floor: lifting the darks (screen) flattens the 1px
  // base lines that make blocking things read, so night brightness comes from the multiply instead.
  { h: 0, mul: [0.60, 0.76, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.72, lamp: 1, night: 1 },      // deep night
  { h: 4.25, mul: [0.60, 0.76, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.72, lamp: 1, night: 1 },
  { h: 5.25, mul: [0.62, 0.77, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.78, lamp: 1, night: 0.8 }, // night
  { h: 6.5, mul: [0.96, 0.84, 0.78], scr: [0.04, 0.03, 0.05], sat: 0.95, lamp: 0.6, night: 0.2, wmul: [0.84, 0.84, 0.96], glint: 0.25 }, // dawn (peach over a cool floor)
  { h: 7.75, mul: [0.98, 0.97, 1.0], scr: [0.02, 0.02, 0.03], sat: 1.0, lamp: 0, night: 0 },    // morning
  { h: 9.5, mul: [1, 1, 1], scr: [0, 0, 0], sat: 1, lamp: 0, night: 0 },                        // day
  { h: 15.5, mul: [1, 1, 1], scr: [0, 0, 0], sat: 1, lamp: 0, night: 0 },
  { h: 17.25, mul: [1.04, 0.95, 0.80], scr: [0.04, 0.02, 0.0], sat: 1.05, lamp: 0.25, night: 0, wmul: [0.94, 0.94, 0.98], glint: 0.35 }, // golden
  { h: 18.25, mul: [1.0, 0.82, 0.68], scr: [0.04, 0.02, 0.03], sat: 1.0, lamp: 0.75, night: 0.15, wmul: [0.80, 0.80, 0.94], glint: 0.5 }, // sunset (amber, never magenta)
  { h: 19.25, mul: [0.70, 0.80, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.85, lamp: 1, night: 0.6 }, // blue hour
  { h: 20.0, mul: [0.62, 0.77, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.78, lamp: 1, night: 0.85 }, // night
  { h: 22.5, mul: [0.62, 0.77, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.78, lamp: 1, night: 1 },
  { h: 24, mul: [0.60, 0.76, 0.96], scr: [0.02, 0.03, 0.07], sat: 0.72, lamp: 1, night: 1 },
];

/**
 * Interpolated grade parameters for an hour (0..24, fractional). Quantised to 1/8 h so
 * decoded tiles cache well. `weather` 'rain' darkens one step and cools.
 * @param {number} hour
 * @param {string} [weather]
 * @returns {{key:string, mul:number[], scr:number[], sat:number, lamp:number, night:number}}
 */
export function gradeFor(hour, weather = 'clear') {
  let h = ((hour % 24) + 24) % 24;
  h = Math.round(h * 8) / 8;
  let a = GRADES[0];
  let b = GRADES[GRADES.length - 1];
  for (let i = 0; i < GRADES.length - 1; i++) {
    if (h >= GRADES[i].h && h <= GRADES[i + 1].h) { a = GRADES[i]; b = GRADES[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  const g = {
    mul: lerp3(a.mul, b.mul, t), scr: lerp3(a.scr, b.scr, t), sat: lerp(a.sat, b.sat, t),
    lamp: lerp(a.lamp, b.lamp, t), night: lerp(a.night, b.night, t),
    // water keeps its blue at golden hour (the sea mirrors the high sky), and its highlights pick
    // up the low sun instead
    wmul: lerp3(a.wmul || a.mul, b.wmul || b.mul, t), glint: lerp(a.glint || 0, b.glint || 0, t),
  };
  // light rain: cooler and a little greyer, not darker (storms take the extra remap step)
  if (weather === 'rain') { const k = [0.98, 0.98, 1.0]; g.mul = g.mul.map((v, i) => v * k[i]); g.wmul = g.wmul.map((v, i) => v * k[i]); g.sat *= 0.92; g.lamp = Math.max(g.lamp, 0.35); g.glint *= 0.3; }
  if (weather === 'fog') { g.sat *= 0.9; g.glint *= 0.3; } // the drifting bands supply the haze
  g.key = `${h}|${weather}`;
  return g;
}

/** Water colour names: body tones take the water grade, highlight tones also catch the sun glint. */
const WATER_BODY = /^(deep[0-2]|sh[0-2]|riv[0-2]|shm[01])$/;
const WATER_HI = /^(deep3|sh3|riv3|shm2|dapple|foam)$/;
const GLINT = hexToRgb01('#F3C178');

/**
 * Apply a grade to one hex colour: multiply → screen floor → saturation. Never below ink.
 * `name` (optional, a COLORS key) selects the per-material water grade.
 */
export function gradeHex(hex, g, name = '') {
  let c = hexToRgb01(hex);
  const water = WATER_BODY.test(name) || WATER_HI.test(name);
  const m = water && g.wmul ? g.wmul : g.mul;
  c = [c[0] * m[0], c[1] * m[1], c[2] * m[2]];
  if (WATER_HI.test(name) && g.glint) c = lerp3(c, GLINT, g.glint);
  c = [1 - (1 - c[0]) * (1 - g.scr[0]), 1 - (1 - c[1]) * (1 - g.scr[1]), 1 - (1 - c[2]) * (1 - g.scr[2])];
  const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  c = [l + (c[0] - l) * g.sat, l + (c[1] - l) * g.sat, l + (c[2] - l) * g.sat];
  c = [Math.max(c[0], INK[0]), Math.max(c[1], INK[1]), Math.max(c[2], INK[2])];
  return rgb01ToHex(c);
}

/* ------------------------------------------------------------ tileset */

function rotateCW(rows) {
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let s = '';
    for (let y = h - 1; y >= 0; y--) s += rows[y][x];
    out.push(s);
  }
  return out;
}
const flipV = (rows) => rows.slice().reverse();

/** Ground textures that may be mirrored per tile to break up repetition. */
const TEXTURE = new Set(['grass_a', 'grass_b', 'sand', 'wetsand', 'mud_dry', 'mud_wet', 'mud_glow', 'water_deep', 'water_shallow', 'water_mud']);

/** Extra tiles derived from the authored ones (edge rotations, quay lip, shadow split). */
function derivedTiles() {
  const d = {};
  const foam = TILES.foam_n;
  d.foam_e = { ...foam, name: 'foam_e', frames: foam.frames.map(rotateCW) };
  d.foam_s = { ...foam, name: 'foam_s', frames: foam.frames.map(flipV) };
  d.foam_w = { ...foam, name: 'foam_w', frames: foam.frames.map((f) => rotateCW(rotateCW(rotateCW(f)))) };
  for (const base of ['ripple', 'fringe']) {
    const t = TILES[`${base}_n`];
    d[`${base}_e`] = { ...t, name: `${base}_e`, frames: t.frames.map(rotateCW) };
    d[`${base}_s`] = { ...t, name: `${base}_s`, frames: t.frames.map(flipV) };
    d[`${base}_w`] = { ...t, name: `${base}_w`, frames: t.frames.map((f) => rotateCW(rotateCW(rotateCW(f)))) };
  }
  const shelf = TILES.shelf_n;
  d.shelf_e = { ...shelf, name: 'shelf_e', frames: shelf.frames.map(rotateCW) };
  d.shelf_s = { ...shelf, name: 'shelf_s', frames: shelf.frames.map(flipV) };
  d.shelf_w = { ...shelf, name: 'shelf_w', frames: shelf.frames.map((f) => rotateCW(rotateCW(rotateCW(f)))) };
  // wet bank: where land meets open water the ground darkens along the edge (2px on the south, the
  // side the camera sees, 1px elsewhere), so the walkable edge always has a dark cue
  const bank = [...Array.from({ length: 14 }, () => '................'), 'dddddddddddddddd', 'kkkkkkkkkkkkkkkk'];
  d.bank_s = { name: 'bank_s', w: 16, h: 16, frames: [bank], pal: { d: 'wet0', k: 'bank' } };
  const bankN = ['kkkkkkkkkkkkkkkk', ...Array.from({ length: 15 }, () => '................')];
  d.bank_n = { name: 'bank_n', w: 16, h: 16, frames: [bankN], pal: { k: 'bank' } };
  d.bank_e = { name: 'bank_e', w: 16, h: 16, frames: [rotateCW(bankN)], pal: { k: 'bank' } };
  d.bank_w = { name: 'bank_w', w: 16, h: 16, frames: [rotateCW(rotateCW(rotateCW(bankN)))], pal: { k: 'bank' } };
  return d;
}

/**
 * Build a tileset: wraps the string-art tiles with a cache of decoded, graded sprites.
 * @returns {{ sprite(name:string, frame:number, grade:object): {w:number,h:number,canvas:any},
 *             shadow(name:string, frame:number): {w:number,h:number,canvas:any}|null,
 *             tiles: object, has(name:string): boolean }}
 */
export function createTileset() {
  const tiles = { ...TILES, ...derivedTiles() };
  const cache = new Map();
  const shadowCache = new Map();

  function palFor(tile, g) {
    const pal = {};
    for (const [ch, name] of Object.entries(tile.pal)) {
      if (name === 'shadow') { pal[ch] = null; continue; }
      const hex = COLORS[name];
      pal[ch] = name.startsWith('!') ? hex : gradeHex(hex, g, name);
    }
    return pal;
  }
  return {
    tiles,
    has: (n) => n in tiles,
    sprite(name, frame = 0, g, variant = 0) {
      const t = tiles[name];
      if (!t) throw new Error(`tileset: unknown tile ${name}`);
      const fi = frame % t.frames.length;
      const key = `${name}|${fi}|${g ? g.key : 'raw'}|${variant}`;
      let s = cache.get(key);
      if (!s) {
        const pal = g ? palFor(t, g) : Object.fromEntries(Object.entries(t.pal).map(([c, n]) => [c, n === 'shadow' ? null : COLORS[n]]));
        let rows = t.frames[fi];
        if (variant & 1) rows = rows.map((r) => r.split('').reverse().join(''));
        if (variant & 2) rows = rows.slice().reverse();
        s = decode(rows, pal);
        cache.set(key, s);
      }
      return s;
    },
    shadow(name, frame = 0) {
      const t = tiles[name];
      const fi = frame % t.frames.length;
      const key = `${name}|${fi}`;
      if (shadowCache.has(key)) return shadowCache.get(key);
      const shadowChars = Object.entries(t.pal).filter(([, n]) => n === 'shadow').map(([c]) => c);
      let s = null;
      if (shadowChars.length) {
        const pal = {};
        for (const ch of Object.keys(t.pal)) pal[ch] = shadowChars.includes(ch) ? COLORS.shadow : null;
        s = decode(t.frames[fi], pal);
      }
      shadowCache.set(key, s);
      return s;
    },
  };
}

/* ----------------------------------------------------------- the map */

/**
 * Ground legend. `water` tiles get foam against land; `tide` entries resolve by tide level.
 *  D deep sea   S shallows   R river   A sand   W wet sand (floods at high tide)
 *  M mud flat (high)   U mud flat (low, floods early)   B stepping stone   E causeway
 *  Q tide pool   G/g grass   T tall grass   Z/z flowers   C cliff top   F cliff face
 *  L ledge   P dirt path   O cobbles   K pier   k pier end (north tip)
 */
export function resolveGround(ch, { tide = 0, night = 0, frame = 0, x = 0, y = 0 } = {}) {
  const wf = Math.floor(frame / 10);
  // Bioluminescence gathers in patches (2x2-tile cells) with a few strays, never as an even field;
  // the pulse rolls across the flats as a slow wave.
  const glow = night > 0.5 && (hash2(x >> 1, y >> 1) % 4 === 0 || hash2(x, y) % 13 === 0);
  const gf = Math.floor(frame / 14) + ((x + (y >> 1)) % 3);
  switch (ch) {
    case 'D': return { tile: 'water_deep', frame: wf, water: true };
    case 'S': return { tile: 'water_shallow', frame: wf, water: true };
    case 'R': return { tile: 'river', frame: Math.floor(frame / 9), water: true };
    case 'A': return { tile: 'sand' };
    case 'W': return tide > 0.75 ? { tile: 'water_shallow', frame: wf, water: true } : { tile: 'wetsand' };
    case 'M':
      if (tide > 0.6) return { tile: 'water_mud', frame: wf, water: true };
      if (tide > 0.35) return { tile: 'mud_wet' };
      return glow ? { tile: 'mud_glow', frame: gf } : night > 0.5 ? { tile: 'mud_wet' } : { tile: 'mud_dry' };
    case 'U':
      if (tide > 0.35) return { tile: 'water_mud', frame: wf, water: true };
      return glow ? { tile: 'mud_glow', frame: gf + 1 } : { tile: 'mud_wet' };
    case 'B': return tide > 0.6 ? { tile: 'stepstone_sub', water: true, self: true } : { tile: 'stepstone', water: true, self: true };
    case 'E': return tide > 0.5 ? { tile: 'causeway_sub', water: true, self: true } : { tile: 'causeway', water: true, self: true };
    case 'Q': return tide > 0.6 ? { tile: 'water_mud', frame: wf, water: true } : { tile: 'tidepool' };
    case 'G': return { tile: 'grass_a' };
    case 'g': return { tile: 'grass_b' };
    case 'T': return { tile: 'tallgrass', frame: [0, 1, 0, 2][Math.floor(frame / 14) % 4] };
    case 'Z': return { tile: 'flowers_a' };
    case 'z': return { tile: 'flowers_b' };
    case 'C': return { tile: 'grass_a', cliffTop: true };
    case 'F': return { tile: 'cliff_face' };
    case 'L': return { tile: x & 1 ? 'ledge_b' : 'ledge' };
    case 'P': return { tile: 'path' };
    case 'Y': return { tile: 'steps' };
    case 'O': return { tile: hash2(x, y) % 3 === 0 ? 'cobbles_b' : 'cobbles', quay: true };
    case 'K': return { tile: 'pier', water: true, self: true };
    case 'k': return { tile: 'pier_end', water: true, self: true };
    default: return { tile: 'grass_a' };
  }
}

/** Small integer hash of a tile coordinate (stable variant picks). */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Sun-driven shadow offset (always bottom-right; short at noon, long at golden hour, gone at night). */
function shadowOffset(hour, g) {
  const day = 1 - g.night;
  const a = Math.max(0, Math.min(1, Math.abs(hour - 12.5) / 6)); // 0 at noon, 1 near horizon
  return { dx: Math.round(1 + a * 4), dy: Math.round(1 + a * 2), alpha: 0.32 * day * (1 - g.lamp * 0.6) };
}

function expandHouse(p) {
  // returns [{name, x, y}] in draw order for a house prop
  const w = p.w || 3;
  const mat = p.material || 'timber';
  const out = [];
  const roof = p.roof || 'slate';
  const wallTile = mat === 'brick' ? 'wall_brick' : 'wall_timber';
  const winLit = mat === 'brick' ? 'window_brick_lit' : 'window_lit';
  const winUnlit = mat === 'brick' ? 'window_brick_unlit' : 'window_unlit';
  const door = p.door === undefined ? 1 : p.door;
  const upperWin = p.upperWindows || (w >= 4 ? [0, w - 1] : [0, w - 1]);
  const lowerWin = p.lowerWindows || (w >= 4 ? [w - 1] : [w - 1]);
  for (let i = 0; i < w; i++) {
    const up = upperWin.includes(i) ? 'win' : (mat === 'timber' && i === Math.floor(w / 2) && w >= 3 ? 'wall_timber_x' : wallTile);
    out.push({ kind: up, lit: winLit, unlit: winUnlit, name: up, x: p.x + i, y: p.y - 1 });
    const lo = i === door ? 'door' : lowerWin.includes(i) ? 'win' : wallTile;
    out.push({ kind: lo, lit: winLit, unlit: winUnlit, name: lo, x: p.x + i, y: p.y });
  }
  for (let i = 0; i < w; i++) {
    const end = i === 0 ? '_l' : i === w - 1 ? '_r' : '';
    out.push({ name: `roof_${roof}_ridge${end}`, x: p.x + i, y: p.y - 3 });
    out.push({ name: `roof_${roof}_eave${end}`, x: p.x + i, y: p.y - 2 });
  }
  out.push({ eaveShade: true, x: p.x, y: p.y - 1, w });
  if (p.chimney !== false) out.push({ name: 'chimney', x: p.x + w - (w >= 4 ? 2 : 1), y: p.y - 3 });
  return out;
}

/**
 * Draw the map.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{w:number,h:number,ground:string[],props:object[]}} map
 * @param {ReturnType<typeof createTileset>} tileset
 * @param {{frame?:number, hour?:number, weather?:'clear'|'fog'|'rain', tide?:number,
 *          camX?:number, camY?:number, view?:{x:number,y:number,w:number,h:number} (map viewport;
 *          the Skyband draws in the `skybandH` px directly above it),
 *          lighthouseStage?:number, lighthouseLit?:boolean, lamps?:'auto'|'on'|'off',
 *          skyband?:boolean, skybandH?:number}} opts
 */
export function drawMap(ctx, map, tileset, opts = {}) {
  const frame = opts.frame || 0;
  const hour = opts.hour === undefined ? 12 : opts.hour;
  const weather = opts.weather || 'clear';
  const tide = opts.tide === undefined ? 0 : opts.tide;
  const g = gradeFor(hour, weather);
  const skyH = opts.skyband === false ? 0 : (opts.skybandH || 40);
  const view = opts.view || { x: 0, y: skyH, w: ctx.canvas.width, h: ctx.canvas.height - skyH };
  const camX = Math.round(opts.camX || 0);
  const camY = Math.round(opts.camY || 0);
  const lampsOn = opts.lamps === 'on' ? 1 : opts.lamps === 'off' ? 0 : g.lamp;
  const ground = map.ground;
  const W = map.w, H = map.h;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : ground[y][x]);
  const info = (x, y) => {
    const ch = at(x, y);
    return ch === null ? null : resolveGround(ch, { tide, night: g.night, frame, x, y });
  };

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.w, view.h);
  ctx.clip();
  ctx.translate(view.x - camX, view.y - camY);

  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const y0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const x1 = Math.min(W - 1, Math.ceil((camX + view.w) / TILE) + 1);
  const y1 = Math.min(H - 1, Math.ceil((camY + view.h) / TILE) + 1);
  const foamF = Math.floor(frame / 10);
  const rain = weather === 'rain';

  // ---- ground + autotile edges
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = info(x, y);
      if (!t) continue;
      const px = x * TILE, py = y * TILE;
      const tex = TEXTURE.has(t.tile) ? ((x * 7 + y * 13) >> 1) & 3 : 0;
      const ph = t.water && !t.self ? (x * 3 + y * 5) & 3 : 0;
      ctx.drawImage(tileset.sprite(t.tile, (t.frame || 0) + ph, g, tex).canvas, px, py);
      if (t.tile === 'water_deep') {
        const sh = (q) => q && q.water && q.tile !== 'water_deep';
        if (sh(info(x, y - 1))) ctx.drawImage(tileset.sprite('shelf_n', 0, g).canvas, px, py);
        if (sh(info(x, y + 1))) ctx.drawImage(tileset.sprite('shelf_s', 0, g).canvas, px, py);
        if (sh(info(x + 1, y))) ctx.drawImage(tileset.sprite('shelf_e', 0, g).canvas, px, py);
        if (sh(info(x - 1, y))) ctx.drawImage(tileset.sprite('shelf_w', 0, g).canvas, px, py);
      }
      if (t.water && !t.self) {
        const n = info(x, y - 1), e = info(x + 1, y), s = info(x, y + 1), w = info(x - 1, y);
        const land = (q) => q && !q.water;
        const edge = t.tile === 'river' ? 'ripple' : 'foam'; // surf on the sea, a ripple on the river bank
        if (land(n)) ctx.drawImage(tileset.sprite(`${edge}_n`, foamF, g).canvas, px, py);
        if (land(s)) ctx.drawImage(tileset.sprite(`${edge}_s`, foamF + 1, g).canvas, px, py);
        if (land(e)) ctx.drawImage(tileset.sprite(`${edge}_e`, foamF + 2, g).canvas, px, py);
        if (land(w)) ctx.drawImage(tileset.sprite(`${edge}_w`, foamF, g).canvas, px, py);
      }
      if (t.tile === 'path' || t.tile === 'sand') {
        const turf = (q) => q && (q.tile.startsWith('grass') || q.tile === 'tallgrass' || q.tile.startsWith('flowers')) && !q.cliffTop;
        if (turf(info(x, y - 1))) ctx.drawImage(tileset.sprite('fringe_n', 0, g, (x * 5 + y) & 1).canvas, px, py);
        if (turf(info(x, y + 1))) ctx.drawImage(tileset.sprite('fringe_s', 0, g, (x * 3 + y) & 1).canvas, px, py);
        if (turf(info(x + 1, y))) ctx.drawImage(tileset.sprite('fringe_e', 0, g, (x + y * 7) & 2).canvas, px, py);
        if (turf(info(x - 1, y))) ctx.drawImage(tileset.sprite('fringe_w', 0, g, (x + y * 5) & 2).canvas, px, py);
      }
      if (t.cliffTop) {
        const isTop = (q) => q && q.cliffTop;
        if (!isTop(info(x - 1, y))) ctx.drawImage(tileset.sprite('cliff_rim_w', 0, g).canvas, px, py);
        if (!isTop(info(x + 1, y))) ctx.drawImage(tileset.sprite('cliff_rim_e', 0, g).canvas, px, py);
        if (!isTop(info(x, y - 1))) ctx.drawImage(tileset.sprite('cliff_rim_n', 0, g).canvas, px, py);
      }
      if (t.quay) {
        const n = info(x, y - 1);
        if (n && n.water) ctx.drawImage(tileset.sprite(hash2(x, y) % 4 === 1 ? 'quay_lip_b' : 'quay_lip', 0, g).canvas, px, py);
      }
      if (t.tile === 'ledge' || t.tile === 'ledge_b') {
        const isL = (q) => q && q.tile.startsWith('ledge');
        if (!isL(info(x - 1, y))) ctx.drawImage(tileset.sprite('ledge_l', 0, g).canvas, px, py);
        else if (!isL(info(x + 1, y))) ctx.drawImage(tileset.sprite('ledge_r', 0, g).canvas, px, py);
      }
      if (t.tile === 'cliff_face') {
        const face = (q) => q && (q.tile === 'cliff_face' || q.tile === 'steps');
        if (!face(info(x - 1, y))) ctx.drawImage(tileset.sprite('cliff_face_l', 0, g).canvas, px, py);
        if (!face(info(x + 1, y))) ctx.drawImage(tileset.sprite('cliff_face_r', 0, g).canvas, px, py);
      }
      if (rain && RAIN_WALK.has(t.tile) && (!TURF.has(t.tile) || hash2(x + 7, y) % 4 === 0)) rainRipple(ctx, x, y, px, py, frame, g);
      if (!t.water && !t.cliffTop && t.tile !== 'cliff_face') {
        // a 1px darker bank where land meets water to the south (a lip the eye reads as height)
        const open = (q) => q && q.water && !q.self;
        if (open(info(x, y + 1))) ctx.drawImage(tileset.sprite('bank_s', 0, g).canvas, px, py);
        if (!t.quay && open(info(x, y - 1))) ctx.drawImage(tileset.sprite('bank_n', 0, g).canvas, px, py);
        if (open(info(x + 1, y))) ctx.drawImage(tileset.sprite('bank_e', 0, g).canvas, px, py);
        if (open(info(x - 1, y))) ctx.drawImage(tileset.sprite('bank_w', 0, g).canvas, px, py);
      }
    }
  }

  // ---- props (sorted by anchor row)
  const items = [];
  for (const p of map.props || []) {
    if (p.type === 'house') {
      items.push({ houseShadow: true, x: p.x, y: p.y, w: p.w || 3, sortY: p.y, sortX: p.x - 1 });
      for (const it of expandHouse(p)) items.push({ ...it, sortY: p.y, sortX: p.x, house: true });
      continue;
    }
    items.push({ ...p, sortY: p.y, sortX: p.x });
  }
  items.sort((a, b) => (a.sortY - b.sortY) || (a.sortX - b.sortX));
  const sh = shadowOffset(hour, g);
  const lampPools = [];
  let sweep = null;
  const shadePattern = getShadePattern(ctx);
  const castShadow = (px, py, w, h) => {
    if (sh.alpha < 0.01) return;
    ctx.globalAlpha = Math.min(0.45, sh.alpha * 1.3);
    ctx.fillStyle = shadePattern;
    ctx.fillRect(px, py, w, h);
    ctx.globalAlpha = 1;
  };

  const drawProp = (name, frameI, x, y, tall) => {
    const s = tileset.sprite(name, frameI, g);
    const px = x * TILE, py = (y + 1) * TILE - s.h;
    if (tall) {
      const shadow = tileset.shadow(name, frameI);
      if (shadow && sh.alpha > 0.01) {
        ctx.globalAlpha = sh.alpha;
        ctx.drawImage(shadow.canvas, px + sh.dx, py + sh.dy);
        ctx.globalAlpha = 1;
      }
    }
    ctx.drawImage(s.canvas, px, py);
    return { px, py, s };
  };

  for (const it of items) {
    if (it.sortY < y0 - 6 || it.sortY > y1 + 1 || it.sortX < x0 - 3 || it.sortX > x1 + 1) continue;
    if (it.houseShadow) {
      const w = it.w * TILE;
      castShadow(it.x * TILE + sh.dx, (it.y + 1) * TILE, w + sh.dx, sh.dy + 2);
      castShadow((it.x + it.w) * TILE, (it.y - 2) * TILE + 6 + sh.dy, sh.dx + 1, 3 * TILE - 6);
      continue;
    }
    switch (it.type) {
      case 'tree': {
        const kind = it.kind || 'alder';
        const alt = hash2(it.x, it.y) & 1 ? '_b' : '';
        let name = kind === 'fruit' ? (it.fruit === false ? 'tree_fruit_bare' : `tree_fruit${alt}`) : `tree_${kind}`;
        if (kind === 'alder') name += alt;
        if (it.variant !== undefined) name = name.replace(/_b$/, '') + (it.variant ? '_b' : '');
        if (!tileset.has(name)) name = name.replace(/_b$/, '');
        // wind: a slow 4-frame sway, phase-shifted per tree so a grove never moves in lockstep
        drawProp(name, Math.floor(frame / 22) + it.x + it.y, it.x, it.y, true);
        break;
      }
      case 'bush': drawProp('bush', 0, it.x, it.y, true); break;
      case 'boat': {
        const s = tileset.sprite('boat', 0, g);
        const bob = Math.floor(frame / 30) % 2;
        ctx.drawImage(s.canvas, it.x * TILE, it.y * TILE + bob);
        break;
      }
      case 'rock': drawProp(it.kind === 'b' ? 'rock_b' : 'rock_a', 0, it.x, it.y, true); break;
      case 'waystone': drawProp('waystone', 0, it.x, it.y, true); break;
      case 'skyglass': drawProp('skyglass', (frame % 60) < 30 ? 0 : 1, it.x, it.y, true); break;
      case 'lamp': {
        const lit = lampsOn > 0.05;
        const r = drawProp(lit ? 'lamp_lit' : 'lamp_unlit', 0, it.x, it.y, false);
        if (lit) lampPools.push({ x: r.px + 8, y: r.py + 24, a: lampsOn });
        break;
      }
      case 'fence': {
        const len = it.len || 1;
        for (let i = 0; i < len; i++) {
          if (it.dir === 'v') drawProp('fence_v', 0, it.x, it.y + i, false);
          else drawProp('fence_h', 0, it.x + i, it.y, false);
        }
        break;
      }
      case 'lighthouse': {
        const stage = Math.max(0, Math.min(7, it.stage === undefined ? (opts.lighthouseStage || 0) : it.stage));
        const lit = it.lit === undefined ? !!opts.lighthouseLit : it.lit;
        const name = lit ? 'lighthouse_lit' : 'lighthouse_dark';
        const r = drawProp(name, 0, it.x, it.y, true);
        if (stage > 0) {
          const sc = tileset.sprite('lighthouse_scaffold', 0, g);
          const rows = stage * SCAFFOLD_SECTION_ROWS;
          const top = SCAFFOLD_BASE_ROW - rows;
          ctx.drawImage(sc.canvas, 0, top, sc.w, rows, r.px, r.py + top, sc.w, rows);
        }
        if (lit) lampPools.push({ x: r.px + 16, y: r.py + 8, a: 1, big: true });
        if (lit && stage >= 7) sweep = { x: r.px + 16, y: r.py + 8 };
        break;
      }
      default:
        if (it.eaveShade) {
          // the eave's shadow on the upper wall: 2 solid rows then a dithered row
          ctx.fillStyle = gradeHex(COLORS.shadow, g);
          ctx.globalAlpha = 0.42;
          const ex = it.x * TILE, ey = it.y * TILE, ew = it.w * TILE;
          ctx.fillRect(ex, ey, ew, 2);
          for (let i = (ey & 1); i < ew; i += 2) ctx.fillRect(ex + i, ey + 2, 1, 1);
          ctx.globalAlpha = 1;
        } else if (it.house) {
          let name = it.name;
          if (it.kind === 'win') name = lampsOn > 0.05 && it.litWindows !== false ? it.lit : it.unlit;
          drawProp(name, 0, it.x, it.y, false);
        } else if (it.tile) {
          drawProp(it.tile, it.frame || 0, it.x, it.y, !!it.tall);
        }
    }
  }

  // ---- lamp light pools (dithered, screen-blended, scaled by how dark it is)
  if (lampPools.length) {
    const pool = tileset.sprite('light_pool', 0, null);
    ctx.globalCompositeOperation = 'screen';
    for (const lp of lampPools) {
      const k = lp.big ? 1.25 : 1;
      ctx.globalAlpha = Math.min(0.5, 0.42 * lp.a * (0.35 + 0.65 * g.night + 0.3 * (weather !== 'clear' ? 1 : 0)));
      ctx.drawImage(pool.canvas, Math.round(lp.x - 16 * k), Math.round(lp.y - 8 * k), 32 * k, 16 * k);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  if (sweep) drawSweep(ctx, sweep, frame, { x: camX, y: camY, w: view.w, h: view.h });
  ctx.restore();

  // ---- weather (never above 35% opacity, never over the Skyband/UI)
  const focus = opts.focus ? { x: view.x + opts.focus.x - camX, y: view.y + opts.focus.y - camY } : null;
  drawWeather(ctx, tileset, view, weather, frame, g, focus);

  // ---- Skyband (the strip directly above the view)
  if (skyH > 0) drawSkyband(ctx, tileset, { x: view.x, y: view.y - skyH, w: view.w, h: skyH, hour, frame, weather, grade: g });
}

/**
 * After the Relighting the lighthouse's beam sweeps the town once every 8 s (480 frames at 60 fps):
 * a dithered amber cone, two densities, screen-blended at low alpha. Slow and steady, it never
 * flashes (photosensitivity rule).
 */
const SWEEP_PERIOD = 480;
const sweepBuf = { canvas: null, img: null };
function drawSweep(ctx, src, frame, rect) {
  const w = rect.w, h = rect.h;
  if (!sweepBuf.canvas || sweepBuf.canvas.width !== w || sweepBuf.canvas.height !== h) {
    sweepBuf.canvas = document.createElement('canvas');
    sweepBuf.canvas.width = w; sweepBuf.canvas.height = h;
    sweepBuf.img = sweepBuf.canvas.getContext('2d').createImageData(w, h);
  }
  const d = sweepBuf.img.data;
  d.fill(0);
  const ang = (frame % SWEEP_PERIOD) / SWEEP_PERIOD * Math.PI * 2;
  const half = 0.2, reach = 300;
  const [ar, ag, ab] = hexToRgb01(COLORS['!lhamber']).map((v) => Math.round(v * 255));
  const sx = src.x - rect.x, sy = src.y - rect.y;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - sx, dy = (y - sy) * 1.6; // flattened: the beam rakes the ground in perspective
      const along = dx * ca + dy * sa;
      if (along < 6 || along > reach) continue;
      const across = Math.abs(-dx * sa + dy * ca) / along;
      if (across > half) continue;
      // three dither densities: a 50% core near the lamp, 25% body, 12.5% fringe and far reach
      const f = along / reach, e = across / half;
      const lvl = e < 0.45 && f < 0.55 ? 2 : e < 0.8 && f < 0.85 ? 1 : 0;
      const on = lvl === 2 ? ((x + y) & 1) === 0 : lvl === 1 ? (x & 1) === 0 && (y & 1) === 0 : (x & 3) === 0 && (y & 1) === 0 && ((x >> 2) + (y >> 1)) % 2 === 0;
      if (!on) continue;
      const i = (y * w + x) * 4;
      d[i] = ar; d[i + 1] = ag; d[i + 2] = ab; d[i + 3] = 255;
    }
  }
  sweepBuf.canvas.getContext('2d').putImageData(sweepBuf.img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(sweepBuf.canvas, rect.x, rect.y);
  ctx.restore();
}

let shadePatternCache = null;
function getShadePattern(ctx) {
  if (shadePatternCache) return shadePatternCache;
  const c = document.createElement('canvas');
  c.width = 2; c.height = 2;
  const c2 = c.getContext('2d');
  c2.fillStyle = COLORS.shadow;
  c2.fillRect(0, 0, 1, 1);
  c2.fillRect(1, 1, 1, 1);
  shadePatternCache = ctx.createPattern(c, 'repeat');
  return shadePatternCache;
}

/* ------------------------------------------------------------ weather */

/** Walkable ground that shows rain puddle ripples (water and blocking tiles never do). */
const TURF = new Set(['grass_a', 'grass_b', 'flowers_a', 'flowers_b', 'tallgrass']);
const RAIN_WALK = new Set(['path', 'cobbles', 'cobbles_b', 'sand', 'wetsand', 'mud_dry', 'mud_wet', 'grass_a', 'grass_b', 'flowers_a', 'flowers_b', 'tallgrass', 'steps', 'pier', 'pier_end', 'causeway', 'stepstone']);
// Flattened ripple rings (never a plus: that glyph is the Heartmark's). 4 visible stages of 6 frames,
// then the spot rests for 8 stages so ripples stay sparse.
const RIPPLE = [
  ['x'],
  ['.xx.', 'x..x', '.xx.'],
  ['.xxxx.', 'x....x', '.xxxx.'],
  ['..x..x..', 'x......x', '..x..x..'],
];
function rainRipple(ctx, x, y, px, py, frame, g) {
  const h = hash2(x * 3 + 1, y * 5 + 2);
  const st = (Math.floor(frame / 6) + (h & 15)) % 9;
  if (st >= RIPPLE.length) return;
  const r = RIPPLE[st];
  const ox = px + 3 + ((h >>> 5) % 6) - (r[0].length >> 1) + 2, oy = py + 4 + ((h >>> 9) % 7) - 1;
  ctx.fillStyle = gradeHex('#D4E4EE', g);
  ctx.globalAlpha = st === 3 ? 0.35 : 0.7;
  for (let j = 0; j < r.length; j++) for (let i = 0; i < r[j].length; i++) if (r[j][i] === 'x') ctx.fillRect(ox + i, oy + j, 1, 1);
  ctx.globalAlpha = 1;
}

/** Fog layer opacities (the contrast check models their worst-case overlap). */
export const FOG_ALPHA = [0.26, 0.2];
const fogBuf = { canvas: null };
function drawWeather(ctx, tileset, view, weather, frame, g, focus = null) {
  if (weather === 'clear') return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.w, view.h);
  ctx.clip();
  if (weather === 'fog') {
    // Bands go to a buffer first so the ground within 4 tiles of the player (`focus`) can be cleared
    // with a 2-step dithered edge: fog never hides the walkable map where the player is.
    if (!fogBuf.canvas || fogBuf.canvas.width !== ctx.canvas.width || fogBuf.canvas.height !== ctx.canvas.height) {
      fogBuf.canvas = document.createElement('canvas');
      fogBuf.canvas.width = ctx.canvas.width; fogBuf.canvas.height = ctx.canvas.height;
    }
    const target = ctx;
    ctx = fogBuf.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, fogBuf.canvas.width, fogBuf.canvas.height);
    ctx.imageSmoothingEnabled = false;
    const band = tileset.sprite('fog_band', 0, g);
    // Two layers drifting opposite ways. Each band row is broken into separate banks: a 64px segment
    // shows only when its (world-stable) hash says so, rows sit at uneven heights, and every row has
    // its own phase, so fog reads as drifting patches with clear gaps (about a third coverage),
    // never as regular stripes.
    const layers = [
      { speed: 0.25, alpha: FOG_ALPHA[0], seed: 3, step: 22 },
      { speed: -0.15, alpha: FOG_ALPHA[1], seed: 11, step: 30 },
    ];
    for (const L of layers) {
      ctx.globalAlpha = L.alpha;
      let row = 0;
      for (let y = view.y - 16; y < view.y + view.h; y += L.step, row++) {
        const hy = hash2(row, L.seed);
        const yy = y + (hy % 9) - 4;
        const shift = Math.floor(frame * L.speed + (hy >>> 4) % band.w);
        for (let seg = Math.floor((-shift - band.w) / band.w); seg * band.w + shift < view.w + band.w; seg++) {
          if (hash2(seg, row * 31 + L.seed) % 5 >= 2) continue; // 2 in 5 segments carry a bank
          ctx.drawImage(band.canvas, view.x + seg * band.w + shift, yy);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (focus) {
      const R = 4 * TILE;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(focus.x, focus.y, R, R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      for (let yy = -R - 12; yy <= R + 12; yy++) {
        for (let xx = -R - 14; xx <= R + 14; xx++) {
          const d = Math.hypot(xx / (R + 14), yy / ((R + 12) * 0.8));
          if (d > 1 || Math.hypot(xx / R, yy / (R * 0.8)) <= 1) continue;
          const inner = Math.hypot(xx / (R + 7), yy / ((R + 6) * 0.8)) <= 1;
          if (inner ? ((xx + yy) & 1) === 0 : (xx & 1) === 0 && (yy & 1) === 0) ctx.fillRect(focus.x + xx, focus.y + yy, 1, 1);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    target.drawImage(fogBuf.canvas, 0, 0);
    ctx = target;
  } else if (weather === 'rain') {
    // 1px streaks angled by the wind (falling down-left), each drop moving continuously; well under
    // 20% coverage. Streak colours are graded so night rain never glows.
    const c1 = gradeHex('#41A6F6', g), c2 = gradeHex('#73EFF7', g);
    const n = Math.floor((view.w * view.h) / 420);
    const span = view.h + 24;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < n; i++) {
      const hx = hash2(i, 17), hy = hash2(i, 91);
      const sp = 5 + (hx % 3);
      const yy = (hy % span) + frame * sp;
      const y = view.y - 12 + (yy % span);
      const wrapW = view.w + 40;
      const x = view.x + ((((hx >>> 4) - Math.floor(yy / 2)) % wrapW) + wrapW) % wrapW - 20;
      ctx.fillStyle = i % 3 === 0 ? c2 : c1;
      ctx.fillRect(x, y, 1, 2);
      ctx.fillRect(x - 1, y + 2, 1, 2);
      ctx.fillRect(x - 2, y + 4, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ------------------------------------------------------------ skyband */

const SKY = [
  { h: 0, c: ['#141B33', '#182040', '#1E2A4F'] },
  { h: 4.5, c: ['#141B33', '#182040', '#1E2A4F'] },
  { h: 6.0, c: ['#3B4A6B', '#8A6E8C', '#F3C178'] },
  { h: 7.5, c: ['#4F8CC4', '#8FBBDD', '#E8D3A0'] },
  { h: 9.5, c: ['#3FA7D6', '#7EC4CF', '#B8CFE0'] },
  { h: 15.5, c: ['#3FA7D6', '#7EC4CF', '#C9D8E0'] },
  { h: 17.25, c: ['#4A7FB0', '#C9A87A', '#FFE29A'] },
  { h: 18.25, c: ['#2B3A67', '#B5583F', '#F3C178'] },
  { h: 19.25, c: ['#141B33', '#1E2A4F', '#3B4A6B'] },
  { h: 20.0, c: ['#141B33', '#1E2A4F', '#2B3A67'] },
  { h: 22.5, c: ['#141B33', '#1E2A4F', '#2B3A67'] },
  { h: 24, c: ['#141B33', '#182040', '#1E2A4F'] },
];
function skyStops(hour) {
  const h = ((hour % 24) + 24) % 24;
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) if (h >= SKY[i].h && h <= SKY[i + 1].h) { a = SKY[i]; b = SKY[i + 1]; break; }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  return a.c.map((hex, i) => lerp3(hexToRgb01(hex), hexToRgb01(b.c[i]), t));
}
function sampleStops(stops, t) {
  if (t <= 0.5) return lerp3(stops[0], stops[1], t * 2);
  return lerp3(stops[1], stops[2], (t - 0.5) * 2);
}
const BAYER = [[0, 2], [3, 1]];
const skyCache = { key: null, canvas: null };

/**
 * Skyband: a live horizon strip (sky bands with ordered dither, sun/moon arc, stars,
 * clouds, far isles and sea strips) that sits above the map.
 */
export function drawSkyband(ctx, tileset, { x, y, w, h, hour, frame, weather = 'clear', grade }) {
  const g = grade || gradeFor(hour, weather);
  const seaH = 9;
  const skyRows = h - seaH;
  const key = `${Math.round(hour * 16)}|${w}|${h}|${weather}`;
  if (skyCache.key !== key) {
    const c = document.createElement('canvas');
    c.width = w; c.height = skyRows;
    const c2 = c.getContext('2d');
    const img = c2.createImageData(w, skyRows);
    const stops = skyStops(hour);
    const LEVELS = 9;
    for (let yy = 0; yy < skyRows; yy++) {
      const t = yy / (skyRows - 1);
      const q = t * (LEVELS - 1);
      const lo = Math.floor(q), fr = q - lo;
      const cLo = sampleStops(stops, lo / (LEVELS - 1));
      const cHi = sampleStops(stops, Math.min(LEVELS - 1, lo + 1) / (LEVELS - 1));
      for (let xx = 0; xx < w; xx++) {
        const thr = (BAYER[yy & 1][xx & 1] + 0.5) / 4;
        const col = fr > thr ? cHi : cLo;
        const i = (yy * w + xx) * 4;
        img.data[i] = Math.round(col[0] * 255); img.data[i + 1] = Math.round(col[1] * 255); img.data[i + 2] = Math.round(col[2] * 255); img.data[i + 3] = 255;
      }
    }
    c2.putImageData(img, 0, 0);
    skyCache.key = key; skyCache.canvas = c;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(skyCache.canvas, x, y);

  // stars (deterministic field), fade with night weight
  if (g.night > 0.05) {
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.globalAlpha = g.night;
    for (let i = 0; i < 70; i++) {
      const sx = Math.floor(rnd() * w), sy = Math.floor(rnd() * (skyRows - 4));
      const tw = (Math.floor(frame / 20) + i) % 7 === 0;
      ctx.fillStyle = tw ? '#B8CFE0' : i % 4 === 0 ? '#F6F1E3' : '#B8CFE0';
      ctx.fillRect(x + sx, y + sy, 1, 1);
    }
    // a meteor every ~7 s
    const mt = frame % 420;
    if (mt < 24) {
      const mx = 80 + ((Math.floor(frame / 420) * 173) % (w - 160));
      ctx.fillStyle = '#F6F1E3';
      ctx.fillRect(x + mx + mt * 2, y + 4 + mt, 2, 1);
      ctx.globalAlpha = g.night * 0.5;
      ctx.fillRect(x + mx + mt * 2 - 3, y + 3 + mt, 3, 1);
    }
    ctx.globalAlpha = 1;
  }

  // sun / moon arc. Sun up 6..19, moon up 19..6.
  const horizonY = y + skyRows;
  const sunT = (hour - 6) / 13;
  const disc = (cx, cy, r, fill, rim) => {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
      ctx.fillStyle = fill; ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
    }
    ctx.fillStyle = rim;
    ctx.fillRect(cx + 1, cy - r + 1, 1, 1);
    ctx.fillRect(cx + r - 1, cy + 1, 1, r - 1);
  };
  if (sunT > -0.02 && sunT < 1.02) {
    const cx = x + Math.round(24 + sunT * (w - 48));
    const cy = Math.round(horizonY - 4 - Math.sin(Math.max(0, Math.min(1, sunT)) * Math.PI) * (skyRows - 10));
    const low = Math.sin(Math.max(0, Math.min(1, sunT)) * Math.PI) < 0.35;
    disc(cx, cy, 4, low ? '#F28C28' : '#FFE29A', low ? '#E07A3F' : '#F6F1E3');
    ctx.fillStyle = low ? '#F3C178' : '#F6F1E3';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
  const moonT = hour >= 19 ? (hour - 19) / 11 : hour < 6 ? (hour + 5) / 11 : -1;
  if (moonT >= 0 && moonT <= 1) {
    const cx = x + Math.round(w - 24 - moonT * (w - 48));
    const cy = Math.round(horizonY - 6 - Math.sin(moonT * Math.PI) * (skyRows - 12));
    disc(cx, cy, 4, '#EAF2F8', '#F6F1E3');
    ctx.fillStyle = '#B8CFE0';
    ctx.fillRect(cx + 1, cy - 1, 2, 1); ctx.fillRect(cx - 2, cy + 2, 1, 1);
  }

  // clouds: drift with parallax, graded by the hour (and thickened by weather)
  const clouds = weather === 'clear'
    ? [{ s: 'cloud_a', y: 6, v: 0.08, o: 40 }, { s: 'cloud_b', y: 14, v: 0.05, o: 220 }, { s: 'cloud_b', y: 4, v: 0.06, o: 360 }]
    : [{ s: 'cloud_a', y: 4, v: 0.1, o: 20 }, { s: 'cloud_a', y: 12, v: 0.07, o: 180 }, { s: 'cloud_a', y: 8, v: 0.09, o: 330 }, { s: 'cloud_b', y: 18, v: 0.05, o: 100 }, { s: 'cloud_b', y: 2, v: 0.06, o: 420 }];
  for (const c of clouds) {
    const sp = tileset.sprite(c.s, 0, g);
    const span = w + sp.w + 20;
    const cx = x + (((c.o + frame * c.v) % span) + span) % span - sp.w - 10;
    ctx.drawImage(sp.canvas, Math.round(cx), y + c.y);
  }

  // far isles on the horizon, then the sea strips (graded deep-water ramp)
  const isle = tileset.sprite('isle_far', 0, g);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(isle.canvas, x + w - 140, horizonY - 4);
  ctx.drawImage(isle.canvas, x + 30, horizonY - 3, 32, 3);
  ctx.globalAlpha = 1;
  const sea0 = gradeHex(COLORS.deep0, g, 'deep0'), sea1 = gradeHex(COLORS.deep1, g, 'deep1'), sea2 = gradeHex(COLORS.deep2, g, 'deep2'), sea3 = gradeHex(COLORS.deep3, g, 'deep3');
  ctx.fillStyle = sea0; ctx.fillRect(x, horizonY, w, 1);
  ctx.fillStyle = sea1; ctx.fillRect(x, horizonY + 1, w, 3);
  ctx.fillStyle = sea1; ctx.fillRect(x, horizonY + 4, w, 5);
  // sparse 2px glints that slide
  ctx.fillStyle = sea2;
  for (let i = 0; i < w / 12; i++) {
    const gx = x + ((i * 37 + Math.floor(frame / 6)) % w);
    const gy = horizonY + 2 + ((i * 5) % 6);
    ctx.fillRect(gx, gy, 2, 1);
  }
  ctx.fillStyle = sea3;
  for (let i = 0; i < w / 40; i++) {
    const gx = x + ((i * 97 + Math.floor(frame / 8) * 1) % w);
    ctx.fillRect(gx, horizonY + 6, 3, 1);
  }
  // sun / moon glitter path on the sea
  if (sunT > 0 && sunT < 1) {
    const cx = x + Math.round(24 + sunT * (w - 48));
    ctx.fillStyle = '#FFE29A'; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 3 + ((i * 3 + Math.floor(frame / 10)) % 7), horizonY + 2 + i * 2, 2, 1);
    ctx.globalAlpha = 1;
  }
  // lower edge so the strip reads as a separate plane from the map's near sea
  ctx.fillStyle = sea0; ctx.fillRect(x, y + h - 1, w, 1);
  ctx.restore();
}

/* ------------------------------------------------------------ helpers */

/** Tiles left out of the atlas because they are mechanical rotations or verge variants of another. */
const SHEET_SKIP = /_(e|s|w)$|_ridge_[lr]$|_eave_[lr]$/;

/**
 * Atlas layout: tiles flow left to right in rows sized to their tallest member, grouped by height
 * so tall props never overlap a row. Returns the canvas size and each tile's rect.
 * @returns {{w:number, h:number, cells:{name:string,x:number,y:number,w:number,h:number}[]}}
 */
export function sheetLayout(tileset, { width = 960, pad = 6 } = {}) {
  const names = Object.keys(tileset.tiles).filter((n) => !SHEET_SKIP.test(n) || n === 'foam_e');
  const order = names.map((n, i) => ({ n, i, t: tileset.tiles[n] }))
    .sort((a, b) => (a.t.h > 16) - (b.t.h > 16) || a.t.h - b.t.h || a.i - b.i);
  const cells = [];
  let x = pad, y = pad, rowH = 0;
  for (const { n, t } of order) {
    if (x + t.w + pad > width) { x = pad; y += rowH + pad; rowH = 0; }
    cells.push({ name: n, x, y, w: t.w, h: t.h });
    x += t.w + pad;
    rowH = Math.max(rowH, t.h);
  }
  return { w: width, h: y + rowH + pad, cells };
}

/** Draw the tile atlas (every tile once, on a neutral checker so transparency reads). */
export function drawSheet(ctx, tileset, { hour = 12, frame = 0, width } = {}) {
  const g = gradeFor(hour);
  const L = sheetLayout(tileset, { width: width || ctx.canvas.width });
  ctx.fillStyle = '#3B3A48';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const c of L.cells) {
    ctx.fillStyle = '#4E4C62';
    ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    ctx.fillStyle = '#56546C';
    for (let yy = 0; yy < c.h; yy += 8) for (let xx = ((yy >> 3) & 1) * 8; xx < c.w; xx += 16) ctx.fillRect(c.x + xx, c.y + yy, Math.min(8, c.w - xx), Math.min(8, c.h - yy));
    ctx.drawImage(tileset.sprite(c.name, frame, g).canvas, c.x, c.y);
  }
  return L;
}

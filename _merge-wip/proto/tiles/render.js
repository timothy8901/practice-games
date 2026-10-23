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
  { h: 0, mul: [0.30, 0.36, 0.60], scr: [0.08, 0.10, 0.20], sat: 0.70, lamp: 1, night: 1 },      // deep night
  { h: 4.25, mul: [0.30, 0.36, 0.60], scr: [0.08, 0.10, 0.20], sat: 0.70, lamp: 1, night: 1 },
  { h: 5.25, mul: [0.38, 0.46, 0.72], scr: [0.08, 0.10, 0.20], sat: 0.78, lamp: 1, night: 0.8 }, // night
  { h: 6.5, mul: [0.84, 0.74, 0.86], scr: [0.14, 0.08, 0.10], sat: 0.95, lamp: 0.6, night: 0.2 }, // dawn
  { h: 7.75, mul: [0.97, 0.96, 1.0], scr: [0.04, 0.04, 0.06], sat: 1.0, lamp: 0, night: 0 },    // morning
  { h: 9.5, mul: [1, 1, 1], scr: [0, 0, 0], sat: 1, lamp: 0, night: 0 },                        // day
  { h: 15.5, mul: [1, 1, 1], scr: [0, 0, 0], sat: 1, lamp: 0, night: 0 },
  { h: 17.25, mul: [1.04, 0.93, 0.76], scr: [0.08, 0.04, 0.0], sat: 1.05, lamp: 0.25, night: 0 }, // golden
  { h: 18.5, mul: [0.76, 0.56, 0.74], scr: [0.12, 0.05, 0.12], sat: 0.95, lamp: 0.9, night: 0.3 }, // dusk
  { h: 19.75, mul: [0.38, 0.46, 0.72], scr: [0.08, 0.10, 0.20], sat: 0.78, lamp: 1, night: 0.8 }, // night
  { h: 22.5, mul: [0.38, 0.46, 0.72], scr: [0.08, 0.10, 0.20], sat: 0.78, lamp: 1, night: 1 },
  { h: 24, mul: [0.30, 0.36, 0.60], scr: [0.08, 0.10, 0.20], sat: 0.70, lamp: 1, night: 1 },
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
  };
  if (weather === 'rain') { g.mul = [g.mul[0] * 0.82, g.mul[1] * 0.86, g.mul[2] * 0.94]; g.sat *= 0.85; g.lamp = Math.max(g.lamp, 0.35); }
  if (weather === 'fog') { g.mul = [g.mul[0] * 0.92, g.mul[1] * 0.93, g.mul[2] * 0.96]; g.scr = [g.scr[0] + 0.06, g.scr[1] + 0.07, g.scr[2] + 0.08]; g.sat *= 0.9; }
  g.key = `${h}|${weather}`;
  return g;
}

/** Apply a grade to one hex colour: multiply → screen floor → saturation. Never below ink. */
export function gradeHex(hex, g) {
  let c = hexToRgb01(hex);
  c = [c[0] * g.mul[0], c[1] * g.mul[1], c[2] * g.mul[2]];
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
  const shelf = TILES.shelf_n;
  d.shelf_e = { ...shelf, name: 'shelf_e', frames: shelf.frames.map(rotateCW) };
  d.shelf_s = { ...shelf, name: 'shelf_s', frames: shelf.frames.map(flipV) };
  d.shelf_w = { ...shelf, name: 'shelf_w', frames: shelf.frames.map((f) => rotateCW(rotateCW(rotateCW(f)))) };
  const lip = ['hhhhhhhhhhhhhhhh', 'mmmmmmmmmmmmmmmm', 'dddddddddddddddd', ...Array.from({ length: 13 }, () => '................')];
  d.quay_lip = { name: 'quay_lip', w: 16, h: 16, frames: [lip], pal: { h: 'st3', m: 'st2', d: 'st1' } };
  const bank = ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', 'dddddddddddddddd', 'kkkkkkkkkkkkkkkk'];
  d.bank_s = { name: 'bank_s', w: 16, h: 16, frames: [bank], pal: { d: 'wet0', k: 'wet0' } };
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
      pal[ch] = name.startsWith('!') ? hex : gradeHex(hex, g);
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
export function resolveGround(ch, { tide = 0, night = 0, frame = 0 } = {}) {
  const wf = Math.floor(frame / 10);
  const glow = night > 0.5;
  switch (ch) {
    case 'D': return { tile: 'water_deep', frame: wf, water: true };
    case 'S': return { tile: 'water_shallow', frame: wf, water: true };
    case 'R': return { tile: 'river', frame: Math.floor(frame / 9), water: true };
    case 'A': return { tile: 'sand' };
    case 'W': return tide > 0.75 ? { tile: 'water_shallow', frame: wf, water: true } : { tile: 'wetsand' };
    case 'M':
      if (tide > 0.6) return { tile: 'water_mud', frame: wf, water: true };
      if (tide > 0.35) return { tile: 'mud_wet' };
      return glow ? { tile: 'mud_glow', frame: Math.floor(frame / 14) } : { tile: 'mud_dry' };
    case 'U':
      if (tide > 0.35) return { tile: 'water_mud', frame: wf, water: true };
      return glow ? { tile: 'mud_glow', frame: Math.floor(frame / 14) + 1 } : { tile: 'mud_wet' };
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
    case 'L': return { tile: 'ledge' };
    case 'P': return { tile: 'path' };
    case 'Y': return { tile: 'steps' };
    case 'O': return { tile: 'cobbles', quay: true };
    case 'K': return { tile: 'pier', water: true, self: true };
    case 'k': return { tile: 'pier_end', water: true, self: true };
    default: return { tile: 'grass_a' };
  }
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
    out.push({ name: `roof_${roof}_ridge`, x: p.x + i, y: p.y - 3 });
    out.push({ name: `roof_${roof}_eave`, x: p.x + i, y: p.y - 2 });
  }
  if (p.chimney !== false) out.push({ name: 'chimney', x: p.x + w - 1, y: p.y - 3 });
  return out;
}

/**
 * Draw the map.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{w:number,h:number,ground:string[],props:object[]}} map
 * @param {ReturnType<typeof createTileset>} tileset
 * @param {{frame?:number, hour?:number, weather?:'clear'|'fog'|'rain', tide?:number,
 *          camX?:number, camY?:number, view?:{x:number,y:number,w:number,h:number},
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
    return ch === null ? null : resolveGround(ch, { tide, night: g.night, frame });
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
        if (land(n)) ctx.drawImage(tileset.sprite('foam_n', foamF, g).canvas, px, py);
        if (land(s)) ctx.drawImage(tileset.sprite('foam_s', foamF + 1, g).canvas, px, py);
        if (land(e)) ctx.drawImage(tileset.sprite('foam_e', foamF + 2, g).canvas, px, py);
        if (land(w)) ctx.drawImage(tileset.sprite('foam_w', foamF, g).canvas, px, py);
      }
      if (t.cliffTop) {
        const isTop = (q) => q && q.cliffTop;
        if (!isTop(info(x - 1, y))) ctx.drawImage(tileset.sprite('cliff_rim_w', 0, g).canvas, px, py);
        if (!isTop(info(x + 1, y))) ctx.drawImage(tileset.sprite('cliff_rim_e', 0, g).canvas, px, py);
        if (!isTop(info(x, y - 1))) ctx.drawImage(tileset.sprite('cliff_rim_n', 0, g).canvas, px, py);
      }
      if (t.quay) {
        const n = info(x, y - 1);
        if (n && n.water) ctx.drawImage(tileset.sprite('quay_lip', 0, g).canvas, px, py);
      }
      if (!t.water && !t.cliffTop && t.tile !== 'cliff_face') {
        // a 1px darker bank where land meets water to the south (a lip the eye reads as height)
        const s = info(x, y + 1);
        if (s && s.water && !s.self) ctx.drawImage(tileset.sprite('bank_s', 0, g).canvas, px, py);
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
        const name = kind === 'fruit' ? (it.fruit === false ? 'tree_fruit_bare' : 'tree_fruit') : `tree_${kind}`;
        drawProp(name, 0, it.x, it.y, true);
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
        break;
      }
      default:
        if (it.house) {
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
  ctx.restore();

  // ---- weather (never above 35% opacity, never over the Skyband/UI)
  drawWeather(ctx, tileset, view, weather, frame, g);

  // ---- Skyband
  if (skyH > 0) drawSkyband(ctx, tileset, { x: view.x, y: 0, w: view.w, h: skyH, hour, frame, weather, grade: g });
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

function drawWeather(ctx, tileset, view, weather, frame, g) {
  if (weather === 'clear') return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.w, view.h);
  ctx.clip();
  if (weather === 'fog') {
    const band = tileset.sprite('fog_band', 0, g);
    const layers = [
      { speed: 0.25, alpha: 0.18, yoff: 0, phase: 0 },
      { speed: -0.15, alpha: 0.14, yoff: 9, phase: 31 },
    ];
    for (const L of layers) {
      ctx.globalAlpha = L.alpha;
      const shift = Math.floor(frame * L.speed) % band.w;
      for (let y = view.y - 16 + L.yoff; y < view.y + view.h; y += 24) {
        for (let x = view.x - band.w + ((shift + L.phase) % band.w) - band.w; x < view.x + view.w + band.w; x += band.w) {
          ctx.drawImage(band.canvas, x, y);
        }
      }
    }
  } else if (weather === 'rain') {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = COLORS.deep;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 0.7;
    let seed = (Math.floor(frame / 2) * 2654435761) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const n = Math.floor((view.w * view.h) / 400);
    for (let i = 0; i < n; i++) {
      const x = view.x + Math.floor(rnd() * view.w);
      const y = view.y + Math.floor(rnd() * view.h);
      ctx.fillStyle = i % 3 === 0 ? '#73eff7' : '#41a6f6';
      ctx.fillRect(x, y, 1, 4);
      ctx.fillRect(x - 1, y + 4, 1, 1);
    }
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
  { h: 18.5, c: ['#2B3A67', '#B5527A', '#F3C178'] },
  { h: 19.75, c: ['#141B33', '#1E2A4F', '#2B3A67'] },
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
  const sea0 = gradeHex(COLORS.deep0, g), sea1 = gradeHex(COLORS.deep1, g), sea2 = gradeHex(COLORS.deep2, g), sea3 = gradeHex(COLORS.deep3, g);
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

/** Draw every tile in a grid (debug sheet). */
export function drawSheet(ctx, tileset, { hour = 12, frame = 0, cols = 12, cell = 36 } = {}) {
  const g = gradeFor(hour);
  const names = Object.keys(tileset.tiles);
  ctx.fillStyle = '#4E4A5A';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  let i = 0;
  for (const name of names) {
    const t = tileset.tiles[name];
    const s = tileset.sprite(name, frame, g);
    const cx = (i % cols) * cell + 2, cy = Math.floor(i / cols) * cell + 2;
    ctx.drawImage(s.canvas, cx, cy);
    i += t.w > 16 || t.h > 16 ? (t.w > 48 ? 2 : 1) : 1;
    if (t.h > cell) i += cols; // crude: tall ones take extra rows
  }
}

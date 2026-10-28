/**
 * Battle backdrops, drawn procedurally per place and day-part. [ART-SHARED] — GDD-09 §3.16 (the
 * arena), first-hour review FH-14 / top10 #9 ("a per-map backdrop instead of flat sky/sea/ground
 * bands").
 *
 * {@link backdropFor} picks a theme from where the battle happens (the map id, the battle source)
 * and the hour; {@link drawBackdrop} paints that theme into any 2D context with `fillStyle` and
 * `fillRect` only, so the battle scene can cache it on an offscreen canvas and the tests can record
 * it with a fake. Themes:
 *  - `shore`   Pellwick: the harbor, far isles, dock pilings and sand;
 *  - `flats`   the Bar: wet sand that mirrors the sky, the wreck ribs of the lost fleet;
 *  - `marsh`   Lowmoor: reeds, pools and a boardwalk;
 *  - `drowned` Drownwood: mangrove trunks standing in still water;
 *  - `stone`   Cairnhold: quarry cliffs and standing stones;
 *  - `ember`   Emberstep: the volcano, its plume, basalt with glowing cracks;
 *  - `moor`    Thistlewind: rolling hills, windmills, heather;
 *  - `ice`     Rimeholt: glacier ridges, snow, cracked ice;
 *  - `summit`  Shardcrown (Hollis's Gate): above the clouds, crown shards;
 *  - `spire`   Spire interiors and the Keepers' halls: brick walls, tall windows that show the hour,
 *              pillars, sconces, flagstones, a rune ring per Spire;
 *  - `reading` the Lantern Stack / the Reading: always night, the tower's beam, the comet;
 *  - `room`    any other interior.
 * Exterior themes have day / dusk / night variants (night adds stars and dims the land).
 *
 * Deterministic: placement comes from a small integer hash, never Math.random or an rng stream.
 * Pure: no DOM; imports only the palette.
 * @module art/backdrops
 */
import { MASTER, NIGHT_INK } from './palette.js';

/** Arena size the backdrops are laid out for (the battle scene's 480 × 198 arena). */
export const BACKDROP_W = 480;
export const BACKDROP_H = 198;

/** Default stands (the battle scene passes its own layout). */
export const DEFAULT_STANDS = Object.freeze({ foe: { x: 368, y: 99 }, player: { x: 104, y: 187 } });

/** Every theme id. */
export const THEMES = Object.freeze(['shore', 'flats', 'marsh', 'drowned', 'stone', 'ember', 'moor', 'ice', 'summit', 'spire', 'reading', 'room']);

/** Themes drawn indoors (no day-part sky; windows still show the hour). */
export const INDOOR_THEMES = Object.freeze(['spire', 'room']);

/** Exterior map / region id -> theme. */
const REGION_THEME = Object.freeze({
  pellwick: 'shore', 'the-bar': 'flats', lowmoor: 'marsh', drownwood: 'drowned', cairnhold: 'stone',
  emberstep: 'ember', thistlewind: 'moor', rimeholt: 'ice', shardcrown: 'summit', 'hollis-gate': 'summit',
});

/** Rune-ring accent per Spire (the halls of the Summit burn gold). */
const SPIRE_ACCENT = Object.freeze({
  'spire-turn': MASTER.s, 'spire-ward': MASTER.i, 'spire-weather': MASTER.o, 'spire-hollow': MASTER.g,
  'spire-relay': MASTER.y, 'spire-mirror': MASTER.w, 'keepers-hall': MASTER.y, 'idris-hall': MASTER.y,
});

/**
 * Day-part of an hour (the arena's three palettes).
 * @param {number} h
 * @returns {'day'|'dusk'|'night'}
 */
export function partOfHour(h) {
  if (!Number.isFinite(h)) return 'day';
  if (h >= 21 || h < 5) return 'night';
  if (h >= 17 || h < 7) return 'dusk';
  return 'day';
}

/**
 * Picks the backdrop for a battle.
 * @param {{mapId?: string|null, source?: string|null, hour?: number|null, theme?: string|null, region?: string|null}} [where]
 *   `theme` forces one (a setup's explicit backdrop); `source: 'reading'` is the Reading (always night)
 * @returns {{theme: string, part: 'day'|'dusk'|'night', accent: string|null, key: string}}
 */
export function backdropFor(where = {}) {
  const mapId = String(where.mapId || '');
  let theme = where.theme && THEMES.includes(where.theme) ? where.theme : null;
  if (!theme) {
    if (where.source === 'reading' || mapId === 'lantern-stack') theme = 'reading';
    else if (mapId.startsWith('spire-') || mapId === 'keepers-hall' || mapId === 'idris-hall') theme = 'spire';
    else if (REGION_THEME[mapId]) theme = REGION_THEME[mapId];
    else if (mapId.startsWith('int-')) theme = 'room';
    else if (where.region && REGION_THEME[where.region]) theme = REGION_THEME[where.region];
    else theme = 'shore';
  }
  const part = theme === 'reading' ? 'night' : partOfHour(Number(where.hour));
  const accent = theme === 'spire' ? (SPIRE_ACCENT[mapId] ?? MASTER.i) : null;
  return { theme, part, accent, key: `${theme}|${part}|${accent ?? ''}` };
}

// ---------------------------------------------------------------------------------------------
// colour helpers
// ---------------------------------------------------------------------------------------------

/** @param {string} hex @returns {[number, number, number]} */
function rgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Mixes two colours.
 * @param {string} a @param {string} b @param {number} k share of b
 * @returns {string}
 */
export function mix(a, b, k) {
  const x = rgb(a);
  const y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, k))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * A land colour graded for the day-part (dusk warms and dims, night sinks toward night ink).
 * @param {string} hex @param {'day'|'dusk'|'night'} part
 * @returns {string}
 */
export function grade(hex, part) {
  if (part === 'dusk') return mix(mix(hex, MASTER.p, 0.18), MASTER.o, 0.08);
  if (part === 'night') return mix(mix(hex, MASTER.n, 0.35), NIGHT_INK, 0.3);
  return hex;
}

/** Small integer hash for deterministic placement. @param {number} i @param {number} [salt] @returns {number} 0..1 */
function h01(i, salt = 0) {
  let x = (i * 374761393 + salt * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return ((x >>> 0) % 10007) / 10007;
}

const SKY = Object.freeze({
  day: ['#EAF2F8', '#B8CFE0', MASTER.v],
  dusk: ['#F6D8AE', '#F3C178', MASTER.o],
  night: ['#2B3A67', '#1E2B4A', NIGHT_INK],
});

// ---------------------------------------------------------------------------------------------
// primitives (fillRect only)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {{fillStyle: any, fillRect: (x: number, y: number, w: number, h: number) => void}} Ctx2D
 */

/** @param {Ctx2D} c @param {string} color @param {number} x @param {number} y @param {number} w @param {number} h */
function rect(c, color, x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Checker dither of `b` over `a` (k = share of b: 0.25 / 0.5 / 0.75). */
function dither(c, x, y, w, h, a, b, k) {
  rect(c, a, x, y, w, h);
  if (k <= 0) return;
  c.fillStyle = b;
  const pattern = k >= 0.75 ? [[0, 0], [1, 0], [0, 1]] : k >= 0.5 ? [[0, 0], [1, 1]] : [[0, 0]];
  for (let yy = y; yy < y + h; yy += 2) {
    for (let xx = x; xx < x + w; xx += 2) {
      for (const [dx, dy] of pattern) if (xx + dx < x + w && yy + dy < y + h) c.fillRect(xx + dx, yy + dy, 1, 1);
    }
  }
}

/** Filled pixel ellipse. */
function ellipse(c, cx, cy, rx, ry, color) {
  c.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (half > 0) c.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

/** A filled hump (half ellipse standing on y0). */
function hump(c, cx, y0, rx, ry, color) {
  c.fillStyle = color;
  for (let y = 0; y < ry; y++) {
    const k = 1 - y / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - k * k)));
    if (half > 0) c.fillRect(Math.round(cx - half), Math.round(y0 - ry + y), half * 2, 1);
  }
}

/** A filled triangle-ish cone from a peak down to a base width at y0. */
function cone(c, cx, peakY, y0, halfBase, color, flat = 0) {
  c.fillStyle = color;
  const hgt = y0 - peakY;
  for (let y = 0; y < hgt; y++) {
    const half = Math.round(flat + (halfBase - flat) * (y / hgt));
    c.fillRect(Math.round(cx - half), Math.round(peakY + y), Math.max(1, half * 2), 1);
  }
}

/** The sky: three bands with dithered seams down to `y1`. */
function sky(c, part, y1, tint = null) {
  const s = SKY[part].map((col) => (tint ? mix(col, tint, 0.25) : col));
  const b1 = Math.round(y1 * 0.36);
  const b2 = Math.round(y1 * 0.72);
  rect(c, s[0], 0, 0, BACKDROP_W, b1);
  dither(c, 0, b1, BACKDROP_W, 8, s[0], s[1], 0.5);
  rect(c, s[1], 0, b1 + 8, BACKDROP_W, b2 - b1 - 8);
  dither(c, 0, b2, BACKDROP_W, 8, s[1], s[2], 0.5);
  rect(c, s[2], 0, b2 + 8, BACKDROP_W, y1 - b2 - 8);
  if (part === 'night') stars(c, y1 - 10);
  else clouds(c, part, y1);
}

function stars(c, maxY) {
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(h01(i, 3) * BACKDROP_W);
    const y = Math.floor(h01(i, 7) * maxY);
    rect(c, i % 5 === 0 ? MASTER.i : MASTER.w, x, y, 1, 1);
  }
}

function clouds(c, part, y1) {
  const col = part === 'dusk' ? '#F6F1E3' : MASTER.w;
  for (let i = 0; i < 4; i++) {
    const x = 30 + Math.floor(h01(i, 11) * 420);
    const y = 10 + Math.floor(h01(i, 13) * (y1 * 0.45));
    const w = 26 + Math.floor(h01(i, 17) * 30);
    rect(c, col, x, y, w, 2);
    rect(c, col, x + 6, y - 2, w - 14, 2);
  }
}

/** The comet (reserved magenta): a short streak. */
function comet(c, x, y) {
  rect(c, MASTER.m, x, y, 3, 1);
  rect(c, MASTER.m, x + 3, y - 1, 1, 1);
  rect(c, mix(MASTER.m, SKY.night[1], 0.5), x - 4, y + 1, 4, 1);
}

/** A sea strip with glints. */
function sea(c, part, y0, y1, glint) {
  const a = grade(MASTER.s, part);
  const b = grade(MASTER.b, part);
  rect(c, a, 0, y0, BACKDROP_W, y1 - y0);
  dither(c, 0, y1 - 6, BACKDROP_W, 6, a, b, 0.5);
  const g = part === 'night' ? MASTER.i : part === 'dusk' ? MASTER.y : (glint || MASTER.w);
  for (let x = 6; x < BACKDROP_W; x += 23) rect(c, g, x, y0 + 3 + ((x * 7) % Math.max(1, y1 - y0 - 8)), 5 + (x % 3), 1);
}

/** A ground field from y0 to the bottom, dithered darker toward the viewer, with tufts. */
function ground(c, part, y0, base, dark, tuft, n = 40) {
  const a = grade(base, part);
  rect(c, a, 0, y0, BACKDROP_W, BACKDROP_H - y0);
  dither(c, 0, y0 + 32, BACKDROP_W, BACKDROP_H - y0 - 32, a, grade(dark, part), 0.25);
  if (!tuft) return;
  const tc = grade(tuft, part);
  for (let i = 0; i < n; i++) {
    const x = (i * 53) % BACKDROP_W;
    const y = y0 + 6 + ((i * 29) % Math.max(1, BACKDROP_H - y0 - 10));
    rect(c, tc, x, y, 1, 2);
    rect(c, tc, x + 2, y + 1, 1, 1);
  }
}

/** The two stands creatures stand on. */
function stands(c, s, pad) {
  ellipse(c, s.foe.x, s.foe.y + 1, 58, 11, pad[2]);
  ellipse(c, s.foe.x, s.foe.y, 56, 10, pad[1]);
  ellipse(c, s.foe.x, s.foe.y - 1, 52, 8, pad[0]);
  ellipse(c, s.player.x, s.player.y + 1, 68, 13, pad[2]);
  ellipse(c, s.player.x, s.player.y, 66, 12, pad[1]);
  ellipse(c, s.player.x, s.player.y - 1, 62, 10, pad[0]);
}

/** @param {string[]} cols @param {'day'|'dusk'|'night'} part */
const padOf = (cols, part) => cols.map((h) => grade(h, part));

// ---------------------------------------------------------------------------------------------
// themes
// ---------------------------------------------------------------------------------------------

/** @type {Record<string, (c: Ctx2D, part: 'day'|'dusk'|'night', s: any, accent: string|null) => void>} */
const PAINT = {
  shore(c, part, s) {
    sky(c, part, 94);
    // far isles
    hump(c, 70, 94, 60, 9, grade(MASTER.t, part));
    hump(c, 250, 94, 34, 6, grade(MASTER.t, part));
    hump(c, 430, 94, 70, 12, grade(MASTER.n, part));
    sea(c, part, 94, 114);
    // sand and the quay
    dither(c, 0, 114, BACKDROP_W, 6, grade('#D9B38C', part), grade('#F2C9A3', part), 0.5);
    ground(c, part, 120, '#D9B38C', '#CF8A5E', '#A7F070', 18);
    // the dock: planks out over the water on the left, pilings standing in the sea
    const plank = grade(MASTER.u, part);
    const plankHi = grade('#CF8A5E', part);
    rect(c, plank, 0, 122, 150, 8);
    for (let x = 0; x < 150; x += 10) rect(c, plankHi, x, 122, 9, 1);
    for (const x of [8, 46, 84, 122]) { rect(c, plank, x, 130, 4, 10); rect(c, grade(MASTER.d, part), x, 138, 4, 2); }
    for (const x of [176, 196, 226, 452, 470]) { rect(c, plank, x, 100, 3, 14); rect(c, plankHi, x, 100, 3, 1); }
    // a bollard and rope coil near the front
    rect(c, grade(MASTER.d, part), 440, 160, 8, 10);
    rect(c, grade(MASTER.e, part), 439, 158, 10, 3);
    stands(c, s, padOf(['#F2C9A3', '#D9B38C', '#CF8A5E'], part));
  },
  flats(c, part, s) {
    sky(c, part, 92);
    rect(c, grade(MASTER.n, part), 0, 90, BACKDROP_W, 4);
    // wet sand mirrors the sky
    const sand = grade('#D9B38C', part);
    rect(c, sand, 0, 94, BACKDROP_W, BACKDROP_H - 94);
    const mirror = SKY[part][1];
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(h01(i, 21) * 440);
      const y = 100 + Math.floor(h01(i, 23) * 90);
      rect(c, mix(mirror, sand, 0.3), x, y, 18 + Math.floor(h01(i, 29) * 40), 2);
    }
    dither(c, 0, 150, BACKDROP_W, 48, sand, grade('#CF8A5E', part), 0.25);
    // the wreck ribs of the lost fleet
    const rib = grade(MASTER.u, part);
    for (let k = 0; k < 6; k++) {
      const x = 180 + k * 14;
      const hgt = 26 - Math.abs(k - 2.5) * 5;
      rect(c, rib, x, 104 - hgt, 3, hgt);
      rect(c, rib, x + (k < 3 ? -2 : 2), 104 - hgt, 2, 2);
    }
    rect(c, rib, 176, 102, 92, 3);
    stands(c, s, padOf(['#F2C9A3', '#D9B38C', '#CF8A5E'], part));
  },
  marsh(c, part, s) {
    sky(c, part, 96);
    hump(c, 120, 96, 140, 8, grade(MASTER.t, part));
    hump(c, 400, 96, 120, 6, grade(MASTER.t, part));
    ground(c, part, 96, '#58663E', '#3E4A30', '#A2A85A', 30);
    // pools
    for (const [x, y, w] of [[20, 120, 90], [200, 140, 70], [300, 118, 120], [380, 166, 90]]) {
      ellipse(c, x + w / 2, y, w / 2, 5, grade(MASTER.b, part));
      rect(c, grade(MASTER.s, part), x + w / 2 - 8, y - 1, 10, 1);
    }
    // reeds
    const reed = grade('#76823E', part);
    const reedHi = grade('#C8C47E', part);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(h01(i, 31) * BACKDROP_W);
      const front = i % 3 === 0;
      const y = front ? 176 + Math.floor(h01(i, 37) * 18) : 96 + Math.floor(h01(i, 41) * 10);
      const hgt = front ? 14 + Math.floor(h01(i, 43) * 10) : 6 + Math.floor(h01(i, 47) * 6);
      rect(c, reed, x, y - hgt, 1, hgt);
      rect(c, reedHi, x, y - hgt, 1, 2);
    }
    // the boardwalk
    const plank = grade('#CF8A5E', part);
    for (let x = 160; x < 300; x += 7) rect(c, plank, x, 104, 6, 3);
    stands(c, s, padOf([MASTER.l, MASTER.g, MASTER.t], part));
  },
  drowned(c, part, s) {
    sky(c, part, 90, MASTER.t);
    rect(c, grade(MASTER.t, part), 0, 84, BACKDROP_W, 8);
    // still water to the stands
    rect(c, grade('#2F4236', part), 0, 92, BACKDROP_W, BACKDROP_H - 92);
    dither(c, 0, 92, BACKDROP_W, 24, grade('#466048', part), grade('#2F4236', part), 0.5);
    dither(c, 0, 150, BACKDROP_W, 48, grade('#2F4236', part), grade('#22302A', part), 0.5);
    // mangrove trunks with roots, far and near
    const trunk = grade('#4E4030', part);
    const leaf = grade('#4C7A4C', part);
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 54 + Math.floor(h01(i, 51) * 16);
      const near = i % 4 === 1;
      const top = near ? 0 : 40 + Math.floor(h01(i, 53) * 20);
      const foot = near ? 196 : 98;
      rect(c, trunk, x, top, near ? 8 : 4, foot - top);
      for (let r = -2; r <= 2; r++) if (r) rect(c, trunk, x + r * (near ? 5 : 3), foot - (near ? 10 : 5), 1, near ? 10 : 5);
      hump(c, x + 2, top + 10, near ? 30 : 16, 12, leaf);
    }
    for (let i = 0; i < 12; i++) rect(c, grade(MASTER.i, part), Math.floor(h01(i, 57) * 460), 110 + Math.floor(h01(i, 59) * 80), 7, 1);
    stands(c, s, padOf([MASTER.g, MASTER.t, MASTER.n], part));
  },
  stone(c, part, s) {
    sky(c, part, 92);
    // quarry cliffs, blocky
    const cliff = grade(MASTER.e, part);
    const cliffHi = grade(MASTER.v, part);
    for (let i = 0; i < 10; i++) {
      const x = i * 50 - 10;
      const hgt = 18 + Math.floor(h01(i, 61) * 22);
      rect(c, cliff, x, 98 - hgt, 52, hgt);
      rect(c, cliffHi, x, 98 - hgt, 52, 2);
      rect(c, grade(MASTER.d, part), x + 50, 98 - hgt, 2, hgt);
    }
    ground(c, part, 98, '#76844E', MASTER.e, MASTER.l, 26);
    // standing stones
    const st = grade(MASTER.v, part);
    for (const [x, hgt] of [[22, 30], [44, 22], [150, 26], [430, 34], [456, 24]]) {
      rect(c, st, x, 112 - hgt, 9, hgt);
      rect(c, grade(MASTER.e, part), x + 7, 112 - hgt, 2, hgt);
      rect(c, grade(MASTER.w, part), x + 1, 112 - hgt, 3, 1);
    }
    // pebbles
    for (let i = 0; i < 30; i++) rect(c, grade(MASTER.v, part), Math.floor(h01(i, 67) * 476), 120 + Math.floor(h01(i, 71) * 74), 2, 1);
    stands(c, s, padOf([MASTER.v, MASTER.e, MASTER.d], part));
  },
  ember(c, part, s) {
    sky(c, part, 96, MASTER.o);
    // the volcano and its plume
    cone(c, 300, 30, 96, 150, grade(MASTER.d, part), 14);
    rect(c, grade(MASTER.o, part === 'night' ? 'day' : part), 288, 30, 24, 2);
    for (let i = 0; i < 7; i++) ellipse(c, 300 + i * 9, 22 - i * 3, 10 + i * 2, 4, mix(grade(MASTER.v, part), SKY[part][1], 0.3 + i * 0.08));
    // spa terraces at the left
    for (let k = 0; k < 3; k++) { rect(c, grade(MASTER.w, part), 20 + k * 22, 84 + k * 4, 40, 3); rect(c, grade(MASTER.i, part), 22 + k * 22, 83 + k * 4, 30, 1); }
    ground(c, part, 96, '#433B45', '#2C2731', null);
    // glowing cracks stay bright at night (real flame)
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(h01(i, 73) * 460);
      const y = 104 + Math.floor(h01(i, 79) * 88);
      const len = 8 + Math.floor(h01(i, 83) * 18);
      rect(c, MASTER.o, x, y, len, 1);
      rect(c, MASTER.y, x + 2, y, Math.max(1, len - 6), 1);
      rect(c, MASTER.o, x + len, y + 1, 4, 1);
    }
    stands(c, s, padOf([MASTER.e, MASTER.d, NIGHT_INK], part));
  },
  moor(c, part, s) {
    sky(c, part, 94);
    hump(c, 80, 100, 130, 22, grade(MASTER.t, part));
    hump(c, 330, 100, 170, 28, grade(MASTER.g, part));
    // windmills
    for (const [x, y] of [[120, 78], [372, 72]]) {
      const body = grade(MASTER.w, part);
      cone(c, x, y, y + 22, 6, body, 3);
      rect(c, grade(MASTER.d, part), x - 1, y + 14, 2, 8);
      const sail = grade(MASTER.u, part);
      for (let d = 1; d <= 9; d++) { rect(c, sail, x + d, y - d, 1, 1); rect(c, sail, x - d, y + d, 1, 1); rect(c, sail, x - d, y - d, 1, 1); rect(c, sail, x + d, y + d, 1, 1); }
    }
    ground(c, part, 100, '#76844E', '#58663E', '#98A466', 30);
    // heather
    for (let i = 0; i < 60; i++) rect(c, grade(i % 2 ? MASTER.p : '#80688A', part), Math.floor(h01(i, 89) * 478), 106 + Math.floor(h01(i, 97) * 88), 2, 1);
    stands(c, s, padOf([MASTER.l, MASTER.g, MASTER.t], part));
  },
  ice(c, part, s) {
    sky(c, part, 92, MASTER.i);
    // glacier ridges
    for (let i = 0; i < 7; i++) {
      const x = i * 76 + Math.floor(h01(i, 101) * 20);
      cone(c, x, 52 + Math.floor(h01(i, 103) * 24), 98, 48, grade(MASTER.w, part));
      cone(c, x + 10, 70 + Math.floor(h01(i, 107) * 16), 98, 22, grade(MASTER.i, part));
    }
    ground(c, part, 98, '#D6E4EE', '#B4C6DA', null);
    // cracks and glints in the ice
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(h01(i, 109) * 460);
      const y = 108 + Math.floor(h01(i, 113) * 84);
      rect(c, grade(MASTER.s, part), x, y, 10, 1);
      rect(c, grade(MASTER.s, part), x + 10, y + 1, 6, 1);
    }
    stands(c, s, padOf([MASTER.w, MASTER.i, MASTER.v], part));
  },
  summit(c, part, s) {
    sky(c, part, 120);
    // clouds below the summit
    for (let i = 0; i < 10; i++) ellipse(c, i * 52 + 10, 112, 34, 6, mix(SKY[part][0], MASTER.w, 0.5));
    ground(c, part, 118, MASTER.e, MASTER.d, null);
    rect(c, grade(MASTER.v, part), 0, 118, BACKDROP_W, 2);
    // crown shards
    for (const [x, hgt] of [[24, 60], [52, 40], [418, 70], [448, 46], [200, 26]]) {
      cone(c, x, 118 - hgt, 118, 8, grade(MASTER.i, part));
      rect(c, MASTER.w, x - 1, 118 - hgt + 6, 1, Math.floor(hgt / 2));
    }
    stands(c, s, padOf([MASTER.v, MASTER.e, MASTER.d], part));
  },
  spire(c, part, s, accent) {
    const wall = MASTER.d;
    const mortar = NIGHT_INK;
    rect(c, wall, 0, 0, BACKDROP_W, 110);
    for (let y = 0; y < 110; y += 8) {
      rect(c, mortar, 0, y, BACKDROP_W, 1);
      const off = (y / 8) % 2 ? 0 : 10;
      for (let x = off; x < BACKDROP_W; x += 20) rect(c, mortar, x, y, 1, 8);
    }
    // tall windows show the hour (the night variant: stars and the comet)
    for (const x of [60, 220, 380]) {
      const sk = SKY[part];
      rect(c, MASTER.e, x - 2, 14, 44, 66);
      rect(c, sk[0], x, 20, 40, 20);
      rect(c, sk[1], x, 40, 40, 20);
      rect(c, sk[2], x, 60, 40, 18);
      hump(c, x + 20, 20, 20, 8, sk[0]);
      rect(c, MASTER.e, x + 19, 12, 2, 66);
      rect(c, MASTER.e, x, 48, 40, 2);
      if (part === 'night') { rect(c, MASTER.w, x + 6, 26, 1, 1); rect(c, MASTER.w, x + 30, 36, 1, 1); rect(c, MASTER.i, x + 12, 56, 1, 1); }
    }
    if (part === 'night') comet(c, 236, 30);
    // pillars and sconces
    for (const x of [0, 150, 310, 456]) {
      rect(c, MASTER.e, x, 0, 24, 110);
      rect(c, MASTER.v, x + 2, 0, 3, 110);
      rect(c, mortar, x + 22, 0, 2, 110);
      rect(c, MASTER.u, x + 9, 50, 6, 4);
      ellipse(c, x + 12, 46, 4, 4, MASTER.y);
      rect(c, MASTER.w, x + 11, 44, 2, 3);
    }
    // the floor: flagstones getting larger toward the viewer
    rect(c, MASTER.e, 0, 110, BACKDROP_W, BACKDROP_H - 110);
    let y = 110;
    for (let row = 0; y < BACKDROP_H; row++) {
      const hgt = 6 + row * 3;
      rect(c, MASTER.d, 0, y, BACKDROP_W, 1);
      const step = 30 + row * 10;
      for (let x = (row % 2) * (step / 2); x < BACKDROP_W; x += step) rect(c, MASTER.d, x, y, 1, hgt);
      y += hgt;
    }
    // a rune ring under each stand in the Spire's colour
    const acc = accent || MASTER.i;
    stands(c, s, [MASTER.v, MASTER.e, MASTER.d]);
    for (const p of [s.foe, s.player]) {
      const rx = p === s.foe ? 46 : 56;
      const ry = p === s.foe ? 6 : 8;
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2;
        if (a % 5 === 0) continue;
        rect(c, acc, p.x + Math.cos(ang) * rx, p.y - 1 + Math.sin(ang) * ry, 2, 1);
      }
    }
  },
  reading(c, part, s) {
    sky(c, 'night', 100);
    comet(c, 300, 18);
    rect(c, mix(MASTER.m, SKY.night[0], 0.6), 280, 22, 16, 1);
    sea(c, 'night', 100, 120);
    // the Lantern Stack and its beam
    const tower = MASTER.d;
    cone(c, 70, 14, 120, 16, tower, 9);
    rect(c, MASTER.e, 61, 10, 18, 6);
    rect(c, MASTER.y, 64, 4, 12, 6);
    rect(c, MASTER.w, 68, 5, 4, 4);
    for (let r = 0; r < 4; r++) rect(c, NIGHT_INK, 66, 40 + r * 18, 8, 3);
    const beam = mix(MASTER.y, SKY.night[1], 0.55);
    for (let x = 80; x < 470; x += 2) {
      const spread = Math.round((x - 80) * 0.12);
      for (let y = 7 - spread; y <= 7 + spread; y += 2) if (((x + y) & 3) === 0 && y >= 0) rect(c, beam, x, y, 1, 1);
    }
    // the stone platform
    ground(c, 'night', 120, MASTER.e, MASTER.d, null);
    for (let x = 0; x < BACKDROP_W; x += 24) rect(c, NIGHT_INK, x, 120, 1, BACKDROP_H - 120);
    rect(c, MASTER.v, 0, 120, BACKDROP_W, 1);
    stands(c, s, [mix(MASTER.v, MASTER.n, 0.3), MASTER.e, MASTER.d]);
    // lamplight pools on the stands
    for (const p of [s.foe, s.player]) for (let i = 0; i < 18; i++) rect(c, MASTER.y, p.x - 30 + Math.floor(h01(i, 127) * 60), p.y - 4 + Math.floor(h01(i, 131) * 6), 1, 1);
  },
  room(c, part, s) {
    // wallpaper, wainscot, a window and planks
    rect(c, '#D6C8A6', 0, 0, BACKDROP_W, 110);
    for (let x = 0; x < BACKDROP_W; x += 16) rect(c, '#B8A88A', x, 0, 4, 110);
    rect(c, MASTER.u, 0, 92, BACKDROP_W, 18);
    rect(c, '#CF8A5E', 0, 92, BACKDROP_W, 2);
    const sk = SKY[part];
    rect(c, MASTER.u, 196, 18, 88, 58);
    rect(c, sk[0], 200, 22, 80, 24);
    rect(c, sk[2], 200, 46, 80, 26);
    rect(c, MASTER.u, 238, 22, 4, 50);
    if (part === 'night') { rect(c, MASTER.w, 208, 28, 1, 1); rect(c, MASTER.w, 262, 34, 1, 1); rect(c, MASTER.i, 224, 40, 1, 1); }
    rect(c, '#CF8A5E', 0, 110, BACKDROP_W, BACKDROP_H - 110);
    for (let y = 110; y < BACKDROP_H; y += 8) {
      rect(c, MASTER.u, 0, y, BACKDROP_W, 1);
      for (let x = (y / 8) % 2 ? 0 : 40; x < BACKDROP_W; x += 80) rect(c, MASTER.u, x, y, 1, 8);
    }
    stands(c, s, ['#D9B38C', '#CF8A5E', MASTER.u]);
  },
};

/**
 * Paints a backdrop.
 * @param {Ctx2D} ctx   any context with `fillStyle` + `fillRect`
 * @param {{theme: string, part: 'day'|'dusk'|'night', accent?: string|null}} pick  from {@link backdropFor}
 * @param {{foe: {x: number, y: number}, player: {x: number, y: number}}} [standsAt]
 */
export function drawBackdrop(ctx, pick, standsAt = DEFAULT_STANDS) {
  const paint = PAINT[pick && pick.theme] || PAINT.shore;
  const part = pick && ['day', 'dusk', 'night'].includes(pick.part) ? pick.part : 'day';
  paint(ctx, part, standsAt, pick?.accent ?? null);
}

/**
 * The grass colour a wild creature rustles out of, matched to the backdrop.
 * @param {{theme: string, part: 'day'|'dusk'|'night'}} pick
 * @returns {string}
 */
export function rustleColour(pick) {
  const base = { shore: MASTER.l, flats: '#D9B38C', marsh: '#D9B38C', drowned: MASTER.g, stone: MASTER.l, ember: MASTER.e, moor: MASTER.l, ice: MASTER.w, summit: MASTER.v, spire: MASTER.v, reading: MASTER.v, room: '#D9B38C' }[pick?.theme] || MASTER.l;
  return grade(base, pick?.part || 'day');
}

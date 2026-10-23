/**
 * The Skyband and the shore horizon (GDD-00 §13-§14, GDD-09 §3.4; ARCHITECTURE §8.4 "drawSkyband
 * into render/sky.js"). [RENDER]
 *
 * **Skyband** ({@link drawSkyband}): the live strip across the top 40 px of every overworld frame.
 * A dithered sky gradient by the hour (overcast greys in rain, fog, snow and storms), stars that
 * come out with the night weight, the sun on its 06:00-19:00 arc (marigold when low), the moon on
 * the night arc in its phase, drifting clouds graded by the hour (fair clouds, or heavy overcast
 * banks that trail rain), the comet smudge that grows over the season, meteors after 20:00, far
 * isles on the horizon, a sea strip with sliding glints and the sun's glitter path, the lighthouse
 * as a compass mark on the horizon (it sits at its true bearing from the player and shows its beam
 * once relit), and the brass tide dial whose needle reads the tide (GDD-09: at 408,8).
 *
 * **Shore view** ({@link drawShoreView}): the true horizon the title and the Day Page use (and the
 * camera eases to at the shore): sky over the sea, the point's headland with the lighthouse on it
 * (scaffold stage, lamp, beam), lit porches along the shore as the progress bar, parallax sea bands
 * whose glints slide faster nearer the eye, and a beach whose surf line breathes with the tide.
 *
 * Geometry helpers ({@link skyLayout}, {@link sunPos}, {@link moonPos}, {@link cometLayout}, ...) are
 * pure and tested. Graded UI art (clouds, isles) is recoloured here through `art/atlas.gradeColour`
 * because UI art is LUT-exempt in the atlas; the sun, moon, stars, comet and dial stay unlit.
 *
 * DOM-free at import.
 * @module render/sky
 */

import { getSprite, artDef, gradeColour } from '../art/atlas.js';
import { decodeSprite } from '../core/pixelart.js';
import { UI } from '../art/palette.js';
import { gradeFor } from '../world/lighting.js';
import { makeCanvas, ctx2d, DRAW, BAYER4, hash2, rgbOf } from './surface.js';
import { beamAngle, ditherDisc } from './lightPass.js';

/** Skyband height (GDD-00 §14). */
export const SKYBAND_H = 40;
/** Rows of sea at the bottom of the Skyband. */
export const SKYBAND_SEA_H = 9;
/** The tide dial's rect (GDD-09 §3.4: tide needle at 408,8,64,24). */
export const TIDE_DIAL_RECT = Object.freeze({ x: 408, y: 8, w: 64, h: 24 });
/** Sun up / down (minutes). */
export const SUNRISE = 6 * 60;
export const SUNSET = 19 * 60;

/* ================================================================== pure geometry */

/**
 * Skyband geometry for a rect.
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @returns {{skyRows: number, horizonY: number, seaY: number, seaH: number, dial: {x: number, y: number, w: number, h: number}}}
 */
export function skyLayout(rect) {
  const seaH = Math.min(SKYBAND_SEA_H, Math.max(0, rect.h - 12));
  const skyRows = rect.h - seaH;
  const dial = { x: rect.x + TIDE_DIAL_RECT.x, y: rect.y + TIDE_DIAL_RECT.y + Math.floor((TIDE_DIAL_RECT.h - 13) / 2) - 2, w: 25, h: 13 };
  return { skyRows, horizonY: rect.y + skyRows, seaY: rect.y + skyRows, seaH, dial };
}

/**
 * Sun centre on its arc: rises at {@link SUNRISE} at the left, sets at {@link SUNSET} at the right.
 * @param {number} minute
 * @param {{x: number, y: number, w: number, h: number}} rect   the sky area (above the horizon)
 * @param {object} [out]  record to fill instead of allocating one
 * @returns {{x: number, y: number, visible: boolean, low: boolean, t: number}}
 */
export function sunPos(minute, rect, out) {
  const m = wrap(minute);
  const t = (m - SUNRISE) / (SUNSET - SUNRISE);
  return arc(t, rect, 4, false, out);
}

/**
 * Moon centre on the night arc (19:00 -> 06:00, right to left).
 * @param {number} minute
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {object} [out]  record to fill instead of allocating one
 * @returns {{x: number, y: number, visible: boolean, low: boolean, t: number}}
 */
export function moonPos(minute, rect, out) {
  const m = wrap(minute);
  const span = 1440 - (SUNSET - SUNRISE);
  const t = m >= SUNSET ? (m - SUNSET) / span : m < SUNRISE ? (m + 1440 - SUNSET) / span : -1;
  return arc(t, rect, 6, true, out);
}

function arc(t, rect, lift, reverse, out) {
  const visible = t > -0.02 && t < 1.02;
  const tc = Math.max(0, Math.min(1, t));
  const s = Math.sin(tc * Math.PI);
  // the arc stops short of the tide dial at the band's right (GDD-09: dial at x 408)
  const span = Math.min(rect.w - 48, Math.round(rect.w * (TIDE_DIAL_RECT.x - 24) / 480) - 24);
  const x = rect.x + Math.round(24 + (reverse ? 1 - tc : tc) * span);
  const y = Math.round(rect.y + rect.h - lift - s * Math.max(0, rect.h - lift - 6));
  if (out) { out.x = x; out.y = y; out.visible = visible; out.low = s < 0.35; out.t = t; return out; }
  return { x, y, visible, low: s < 0.35, t };
}

/**
 * Moon phase frame (0 new .. 4 full .. 7) for a day number (29.5-day cycle).
 * @param {number} day
 * @returns {number}
 */
export function moonPhase(day) {
  const p = (((day % 29.5) + 29.5) % 29.5) / 29.5;
  return Math.floor(p * 8 + 0.5) % 8;
}

/**
 * Comet placement and growth for a season progress 0..1 (the smudge grows, brightens and lengthens).
 * The head hangs high at the right end of the band (x = 82% of the width, left of the tide dial),
 * where the sun and moon arcs only pass low on the horizon, so the moon never crosses the comet.
 * @param {number} progress
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {object} [out]  record to fill instead of allocating one
 * @returns {{x: number, y: number, tail: number, stage: 0|1|2, density: number}}
 */
export function cometLayout(progress, rect, out) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const o = out || {};
  o.stage = p < 0.2 ? 0 : p < 0.6 ? 1 : 2;
  o.x = rect.x + Math.round(rect.w * COMET_X);
  o.y = rect.y + 4 + Math.round((1 - p) * 3);
  o.tail = Math.round(4 + p * 34);
  o.density = 0.25 + p * 0.65;
  return o;
}
/** Comet head x as a fraction of the band width (between the arcs' low right end and the dial). */
export const COMET_X = 0.82;

/**
 * Where the lighthouse compass mark sits on the horizon: centred, shifted by the lighthouse's
 * bearing from the player (tiles), clamped inside the band.
 * @param {number} dxTiles lighthouse x - player x (tiles)
 * @param {number} w band width
 * @returns {number} x offset from the band's left edge
 */
export function compassX(dxTiles, w) {
  const x = Math.round(w / 2 + dxTiles * 6);
  return Math.max(12, Math.min(w - 12, x));
}

/** Weather ids that put up overcast cloud. */
const OVERCAST = new Set(['rain', 'storm', 'fog', 'overcast', 'snow']);

/** Sky stops by hour: [top, middle, horizon]. */
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

/**
 * Sky gradient stops (0..1 rgb triples) for a minute and weather.
 * @param {number} minute
 * @param {string} [weather='clear']
 * @returns {number[][]} three stops, top to horizon
 */
export function skyStops(minute, weather = 'clear') {
  const h = wrap(minute) / 60;
  let a = SKY[0], b = SKY[SKY.length - 1];
  for (let i = 0; i < SKY.length - 1; i++) if (h >= SKY[i].h && h <= SKY[i + 1].h) { a = SKY[i]; b = SKY[i + 1]; break; }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
  let stops = a.c.map((hex, i) => lerp3(rgb01(hex), rgb01(b.c[i]), t));
  if (OVERCAST.has(weather)) {
    const grey = rgb01(weather === 'rain' || weather === 'storm' ? UI.overcast0 : UI.overcast1);
    const k = weather === 'storm' ? 0.8 : weather === 'overcast' ? 0.5 : 0.65;
    stops = stops.map((c) => {
      const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      return lerp3(c, grey.map((v) => v * (0.35 + l)), k);
    });
  }
  return stops;
}

/* ================================================================== caches */

/** @type {Map<number, any>} gradient strips by numeric key */
const gradients = new Map();
const GRADIENT_MAX = 8;

/**
 * A dithered gradient strip (9 levels, 2x2 Bayer between levels), cached by quantized time.
 * @param {number} minute @param {string} weather @param {number} w @param {number} h
 * @returns {any}
 */
function gradientStrip(minute, weather, w, h) {
  const q = Math.round(wrap(minute) / 3.75);
  const key = ((q * 8 + WEATHER_IDX(weather)) * 1024 + w) * 512 + h;
  let c = gradients.get(key);
  if (c) return c;
  if (gradients.size >= GRADIENT_MAX) gradients.delete(gradients.keys().next().value);
  const stops = skyStops(q * 3.75, weather);
  c = makeCanvas(w, h);
  const g = ctx2d(c);
  if (typeof g.createImageData === 'function') {
    const img = g.createImageData(w, h);
    const LEVELS = 9;
    const B2 = [[0, 2], [3, 1]];
    for (let y = 0; y < h; y++) {
      const t = h > 1 ? y / (h - 1) : 0;
      const qv = t * (LEVELS - 1);
      const lo = Math.floor(qv), fr = qv - lo;
      const cLo = sample(stops, lo / (LEVELS - 1));
      const cHi = sample(stops, Math.min(LEVELS - 1, lo + 1) / (LEVELS - 1));
      for (let x = 0; x < w; x++) {
        const col = fr > (B2[y & 1][x & 1] + 0.5) / 4 ? cHi : cLo;
        const i = (y * w + x) * 4;
        img.data[i] = Math.round(col[0] * 255); img.data[i + 1] = Math.round(col[1] * 255); img.data[i + 2] = Math.round(col[2] * 255); img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  gradients.set(key, c);
  return c;
}
const WEATHER_LIST = ['clear', 'rain', 'storm', 'fog', 'overcast', 'snow'];
function WEATHER_IDX(w) { const i = WEATHER_LIST.indexOf(w); return i < 0 ? 0 : i; }

/** @type {WeakMap<object, Map<string, any>>} grade -> UI art id(+variant) -> graded sprite */
const graded = new WeakMap();

/**
 * A UI art frame recoloured through a grade (the atlas never grades UI art).
 * @param {string} id @param {object} grade @param {string|null} [variant]
 * @returns {any} Sprite with `.canvas`, `.w`, `.h`
 */
function gradedArt(id, grade, variant = null) {
  let m = graded.get(grade);
  if (!m) { m = new Map(); graded.set(grade, m); }
  const k = variant ? variantKey(id, variant) : id;
  let s = m.get(k);
  if (s) return s;
  const d = artDef(id);
  const frames = variant && d.variants && d.variants[variant] ? d.variants[variant] : d.frames;
  const src = (variant && d.variantPal && d.variantPal[variant]) || d.pal;
  const pal = {};
  for (const ch in src) pal[ch] = gradeColour(src[ch], grade);
  s = decodeSprite(frames[0], pal);
  m.set(k, s);
  return s;
}

/** @type {WeakMap<object, string[]>} grade -> graded sea ramp */
const seaRamps = new WeakMap();
function seaRamp(grade) {
  let r = seaRamps.get(grade);
  if (!r) {
    r = ['deep0', 'deep1', 'deep2', 'deep3', 'foam', 'sh2', 'sh3', 'sand1', 'sand2', 'wet1', 'wet2', 'st0', 'st1', 'st2', 'cl1', 'grass0', 'grass1'].map((n) => gradeColour(n, grade));
    seaRamps.set(grade, r);
  }
  return r;
}

/* ================================================================== the Skyband */

/**
 * @typedef {Object} SkyOpts
 * @property {number} minute            minute of day
 * @property {string} [weather='clear']
 * @property {object} [grade]           lighting grade (default `gradeFor(minute, weather)`)
 * @property {number} [ms=0]            animation clock
 * @property {number} [day=1]           moon phase
 * @property {number} [tide]            0..1; draws the tide dial when given
 * @property {boolean} [tideDial=true]
 * @property {number} [comet=0]         season progress 0..1 (the smudge grows)
 * @property {{dx: number, lit?: boolean}|null} [compass]  lighthouse bearing for the horizon mark
 * @property {boolean} [reducedMotion]
 */

/**
 * Draws the Skyband into `rect` (normally 0,0,480,40).
 * @param {any} ctx
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {SkyOpts} o
 */
export function drawSkyband(ctx, rect, o) {
  const weather = o.weather || 'clear';
  const grade = o.grade || gradeFor(o.minute, weather);
  const ms = o.reducedMotion ? 0 : (o.ms || 0);
  const L = bandLayout(rect);
  const sky = SKY_BUF;
  sky.x = rect.x; sky.y = rect.y; sky.w = rect.w; sky.h = L.skyRows;
  ctx.drawImage(gradientStrip(o.minute, weather, rect.w, L.skyRows), rect.x, rect.y);
  DRAW.images++;
  drawStars(ctx, sky, grade, ms, weather, 70);
  drawComet(ctx, sky, o.comet || 0, grade, weather);
  drawMeteors(ctx, sky, o.minute, ms, grade, weather);
  drawSunMoon(ctx, sky, o.minute, o.day ?? 1, weather);
  drawClouds(ctx, sky, grade, ms, weather, false);
  // far isles, the lighthouse compass mark, then the sea strip
  const isle = gradedArt('sky-isle-far', grade);
  ctx.drawImage(isle.canvas, rect.x + rect.w - 150, L.horizonY - 4);
  ctx.drawImage(isle.canvas, rect.x + 34, L.horizonY - 3, 32, 3);
  DRAW.images += 2;
  if (o.compass) drawCompass(ctx, rect.x + compassX(o.compass.dx, rect.w), L.horizonY, grade, ms, o.compass.lit);
  drawSeaStrip(ctx, rect, L, o.minute, grade, ms, weather);
  if (o.tide !== undefined && o.tide !== null && o.tideDial !== false) drawTideDial(ctx, L.dial, o.tide);
}

function drawStars(ctx, sky, grade, ms, weather, count) {
  // a few stars through broken overcast; none through rain, storm, fog or snow cloud
  const night = grade.night * (weather === 'overcast' ? 0.25 : OVERCAST.has(weather) ? 0 : 1);
  if (night < 0.05) return;
  const shown = Math.floor(count * night);
  for (let i = 0; i < shown; i++) {
    const h = hash2(i, 77);
    const sx = sky.x + (h % sky.w), sy = sky.y + ((h >>> 12) % Math.max(1, sky.h - 4));
    const tw = ((Math.floor(ms / 400) + i * 7) % 23) === 0;
    ctx.fillStyle = tw ? UI.cream : i % 5 === 0 ? UI.cream : UI.skyHaze;
    ctx.fillRect(sx, sy, 1, 1);
    if (tw && i % 3 === 0) { ctx.fillRect(sx - 1, sy - 1, 1, 1); ctx.fillRect(sx + 1, sy + 1, 1, 1); }
  }
  DRAW.fills++;
}

function drawComet(ctx, sky, progress, grade, weather) {
  if (progress <= 0) return;
  // like the stars: dimmed by broken overcast, hidden by rain, storm, fog and snow cloud
  const vis = Math.min(1, grade.night * 1.4 + 0.08) * (weather === 'overcast' ? 0.4 : OVERCAST.has(weather) ? 0 : 1);
  if (vis < 0.15) return;
  const C = cometLayout(progress, sky, COMET_BUF);
  // the tail: dithered streak to the upper left in tail pink, thinning with distance
  ctx.fillStyle = UI.cometTail;
  const dens = C.density * vis;
  for (let k = 1; k <= C.tail; k++) {
    const f = 1 - k / (C.tail + 1);
    const tx = C.x - k, ty = C.y + 3 - Math.floor(k / 5);
    if (BAYER4[((ty & 3) << 2) | (tx & 3)] < dens * f * 16) ctx.fillRect(tx, ty, 1, 1);
    if (C.stage >= 1 && k > 3 && BAYER4[(((ty - 1) & 3) << 2) | (tx & 3)] < dens * f * 9) ctx.fillRect(tx, ty - 1, 1, 1);
    if (C.stage >= 2 && k > 6 && BAYER4[(((ty + 1) & 3) << 2) | ((tx + 1) & 3)] < dens * f * 7) ctx.fillRect(tx, ty + 1, 1, 1);
  }
  DRAW.fills++;
  if (C.stage === 0) {
    ctx.fillStyle = '#FF5BD6';
    ctx.fillRect(C.x, C.y + 3, 2, 1);
    ctx.fillStyle = UI.cometCore;
    ctx.fillRect(C.x + 1, C.y + 3, 1, 1);
    return;
  }
  const img = getSprite('sky-comet');
  ctx.drawImage(img.canvas, C.x - 17, C.y);
  DRAW.images++;
}

function drawMeteors(ctx, sky, minute, ms, grade, weather) {
  const m = wrap(minute);
  if (!(m >= 20 * 60 || m < 5 * 60) || OVERCAST.has(weather) || grade.night < 0.5) return;
  const PERIOD = 6200, LIFE = 420;
  const k = Math.floor(ms / PERIOD);
  const t = ms - k * PERIOD;
  if (t >= LIFE) return;
  const h = hash2(k, 913);
  const x = sky.x + 40 + (h % Math.max(1, sky.w - 120)) + Math.floor(t / 14);
  const y = sky.y + 2 + ((h >>> 10) % 6) + Math.floor(t / 28);
  const img = getSprite('sky-meteor', Math.min(2, Math.floor((t / LIFE) * 3)));
  ctx.drawImage(img.canvas, x, y);
  DRAW.images++;
}

function drawSunMoon(ctx, sky, minute, day, weather) {
  const heavy = weather === 'rain' || weather === 'storm';
  const sp = sunPos(minute, sky, SUN_BUF);
  if (sp.visible && !heavy) {
    if (weather === 'fog' || weather === 'overcast' || weather === 'snow') ctx.globalAlpha = 0.5;
    const img = getSprite('sky-sun', sp.low ? SUN_LOW : 0);
    ctx.drawImage(img.canvas, sp.x - 5, sp.y - 5);
    ctx.globalAlpha = 1;
    DRAW.images++;
  }
  const mp = moonPos(minute, sky, MOON_BUF);
  if (mp.visible && !heavy) {
    // veiled like the sun behind fog, overcast and snow cloud
    if (weather === 'fog' || weather === 'overcast' || weather === 'snow') ctx.globalAlpha = 0.5;
    const img = getSprite('sky-moon', moonPhase(day));
    ctx.drawImage(img.canvas, mp.x - 5, mp.y - 5);
    ctx.globalAlpha = 1;
    DRAW.images++;
  }
}

/** Fair and overcast cloud lineups: [art, y, speed px/s, offset]. */
const FAIR_CLOUDS = [['sky-cloud-a', 5, 1.6, 40], ['sky-cloud-b', 13, 1.0, 220], ['sky-cloud-b', 3, 1.2, 360]];
const OVER_CLOUDS = [['sky-cloud-overcast', 2, 2.0, 20], ['sky-cloud-overcast', 11, 1.4, 180], ['sky-cloud-overcast-b', 7, 1.8, 330],
  ['sky-cloud-overcast', 16, 1.0, 100], ['sky-cloud-overcast-b', 0, 1.2, 420], ['sky-cloud-overcast', 6, 1.6, 270]];

function drawClouds(ctx, sky, grade, ms, weather, tall) {
  const list = OVERCAST.has(weather) ? OVER_CLOUDS : FAIR_CLOUDS;
  const rainy = weather === 'rain' || weather === 'storm';
  const sy = tall ? Math.max(1, Math.floor(sky.h / 40)) : 1;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const id = c[0], y = c[1], v = c[2], off = c[3];
    const spr = gradedArt(id, grade, rainy && id === 'sky-cloud-overcast' ? 'rain' : null);
    const span = sky.w + spr.w + 20;
    const cx = sky.x + ((((off + (ms / 1000) * v) % span) + span) % span) - spr.w - 10;
    ctx.drawImage(spr.canvas, Math.round(cx), sky.y + y * sy);
    DRAW.images++;
  }
}

function drawCompass(ctx, x, horizonY, grade, ms, lit) {
  // a 5x9 tower silhouette standing on the horizon; a lit lamp pip and a short ray once relit
  const C = compassColours(grade);
  const ink = C[0], wall = C[1], band = C[2];
  ctx.fillStyle = ink;
  ctx.fillRect(x - 2, horizonY - 9, 5, 9);
  ctx.fillStyle = wall;
  ctx.fillRect(x - 1, horizonY - 7, 3, 7);
  ctx.fillStyle = band;
  ctx.fillRect(x - 1, horizonY - 5, 3, 1);
  ctx.fillRect(x - 1, horizonY - 2, 3, 1);
  ctx.fillStyle = lit ? UI.lighthouseAmber : ink;
  ctx.fillRect(x, horizonY - 9, 1, 1);
  if (lit) {
    const phase = Math.floor(ms / 250) % 32;
    const dir = phase < 16 ? 1 : -1;
    const len = (phase % 16) < 8 ? 3 + (phase % 8) : 0;
    ctx.fillStyle = UI.lighthouseAmber;
    for (let k = 2; k < len; k += 2) ctx.fillRect(x + dir * k, horizonY - 9, 1, 1);
  }
  DRAW.fills++;
}

function drawSeaStrip(ctx, rect, L, minute, grade, ms, weather) {
  const R = seaRamp(grade);
  const x = rect.x, w = rect.w, hy = L.horizonY;
  ctx.fillStyle = R[0]; ctx.fillRect(x, hy, w, 1);
  ctx.fillStyle = R[1]; ctx.fillRect(x, hy + 1, w, L.seaH - 1);
  ctx.fillStyle = R[2];
  for (let i = 0; i < w / 12; i++) {
    const gx = x + ((i * 37 + Math.floor(ms / 100)) % w);
    ctx.fillRect(gx, hy + 2 + ((i * 5) % Math.max(1, L.seaH - 3)), 2, 1);
  }
  ctx.fillStyle = R[3];
  for (let i = 0; i < w / 40; i++) ctx.fillRect(x + ((i * 97 + Math.floor(ms / 133)) % w), hy + Math.min(6, L.seaH - 2), 3, 1);
  SEA_SKY.x = x; SEA_SKY.y = rect.y; SEA_SKY.w = w; SEA_SKY.h = L.skyRows;
  const sp = sunPos(minute, SEA_SKY, SUN_BUF);
  if (sp.visible && sp.t > 0 && sp.t < 1 && weather === 'clear') {
    ctx.fillStyle = sp.low ? UI.sunLow : UI.sunCore;
    ctx.globalAlpha = 0.65;
    for (let i = 0; i < 4; i++) ctx.fillRect(sp.x - 3 + ((i * 3 + Math.floor(ms / 166)) % 7), hy + 2 + i * 2, 2, 1);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = R[0];
  ctx.fillRect(x, rect.y + rect.h - 1, w, 1);
  DRAW.fills++;
}

function drawTideDial(ctx, d, tide) {
  const step = Math.max(0, Math.min(8, Math.round(Math.max(0, Math.min(1, tide)) * 8)));
  ctx.drawImage(getSprite('sky-tide-dial').canvas, d.x, d.y);
  ctx.drawImage(getSprite('sky-tide-needle', step).canvas, d.x, d.y);
  DRAW.images += 2;
}

/* ================================================================== the shore horizon */

/**
 * @typedef {Object} ShoreOpts
 * @property {number} minute
 * @property {string} [weather]
 * @property {object} [grade]
 * @property {number} [ms]
 * @property {number} [day]
 * @property {number} [tide]            0..1: the surf line climbs the beach at high water
 * @property {number} [comet]
 * @property {{stage?: number, lit?: boolean, relitAt?: number}} [lighthouse]
 * @property {number} [porches]         lit porches along the shore (the progress bar)
 * @property {boolean} [reducedMotion]
 */

/**
 * The true-horizon shore view (title, Day Page, the camera's shore ease).
 * @param {any} ctx
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {ShoreOpts} o
 */
export function drawShoreView(ctx, rect, o) {
  const weather = o.weather || 'clear';
  const grade = o.grade || gradeFor(o.minute, weather);
  const ms = o.reducedMotion ? 0 : (o.ms || 0);
  const R = seaRamp(grade);
  const horizon = rect.y + Math.round(rect.h * 0.48);
  const sky = SKY_BUF;
  sky.x = rect.x; sky.y = rect.y; sky.w = rect.w; sky.h = horizon - rect.y;
  const sky2 = SHORE_SKY2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(gradientStrip(o.minute, weather, rect.w, sky.h), rect.x, rect.y);
  DRAW.images++;
  drawStars(ctx, sky, grade, ms, weather, 160);
  sky2.x = sky.x; sky2.y = sky.y + 6; sky2.w = sky.w; sky2.h = sky.h;
  drawComet(ctx, sky2, o.comet || 0, grade, weather);
  drawMeteors(ctx, sky, o.minute, ms, grade, weather);
  drawSunMoon(ctx, sky, o.minute, o.day ?? 1, weather);
  sky2.y = sky.y + 4;
  drawClouds(ctx, sky2, grade, ms, weather, true);
  // far isles along the horizon
  const isle = gradedArt('sky-isle-far', grade);
  ctx.drawImage(isle.canvas, rect.x + 30, horizon - 4);
  ctx.drawImage(isle.canvas, rect.x + rect.w - 230, horizon - 3, 36, 3);
  DRAW.images += 2;

  // sea bands from the horizon to the beach, thicker and faster nearer the eye
  const beachTop = rect.y + Math.round(rect.h * 0.8);
  const seaH = beachTop - horizon;
  ctx.fillStyle = R[2];
  ctx.fillRect(rect.x, horizon, rect.w, 1);
  let y = horizon + 1, band = 0;
  while (y < beachTop) {
    const t = (y - horizon) / seaH;
    const bh = 1 + Math.floor(t * t * 7);
    ctx.fillStyle = t < 0.3 ? R[1] : t < 0.7 ? R[1] : R[0];
    if (t >= 0.3 && t < 0.7 && (band & 1)) ctx.fillStyle = R[0];
    ctx.fillRect(rect.x, y, rect.w, Math.min(bh, beachTop - y));
    // glints: dashes sliding sideways, longer and faster near the beach
    ctx.fillStyle = t < 0.5 ? R[2] : R[3];
    const len = 1 + Math.floor(t * 4), speed = 4 + t * 26, n = Math.floor(rect.w / (26 - t * 12));
    for (let i = 0; i < n; i++) {
      const hh = hash2(i, band * 7 + 3);
      const gx = rect.x + Math.floor(((hh % rect.w) + (ms / 1000) * speed * ((band & 1) ? 1 : -0.6)) % rect.w + rect.w) % rect.w;
      if ((hh >>> 8) % 3 === 0) ctx.fillRect(gx, y + ((hh >>> 4) % Math.max(1, bh)), len, 1);
    }
    y += bh;
    band++;
  }
  DRAW.fills++;
  // the sun / moon glitter path
  const sp = sunPos(o.minute, sky, SUN_BUF), mp = moonPos(o.minute, sky, MOON_BUF);
  const gx0 = sp.visible ? sp.x : mp.x;
  const gcol = sp.visible ? (sp.low ? UI.sunLow : UI.sunCore) : UI.moon;
  if (weather === 'clear' && (sp.visible || mp.visible)) {
    ctx.fillStyle = gcol;
    for (let k = 0; k < 18; k++) {
      const t = k / 18;
      const gy = horizon + 2 + Math.floor(t * t * seaH * 0.95);
      const spread = 2 + Math.floor(t * 14);
      const hh = hash2(k, Math.floor(ms / 180));
      ctx.fillRect(gx0 - spread + (hh % (spread * 2 + 1)), gy, 1 + Math.floor(t * 3), 1);
    }
    DRAW.fills++;
  }
  // the point's headland and the lighthouse on it
  drawHeadland(ctx, rect, horizon, grade, ms, o, R);
  // the beach: wet sand under a breathing surf line, dry sand above the tide
  const tide = Math.max(0, Math.min(1, o.tide ?? 0.5));
  const surge = Math.round(Math.sin(ms / 640) * 2 + Math.sin(ms / 1530) * 1.5);
  const waterline = beachTop + Math.round(tide * 10) + surge;
  ctx.fillStyle = R[9];
  ctx.fillRect(rect.x, beachTop, rect.w, rect.y + rect.h - beachTop);
  ctx.fillStyle = R[10];
  ctx.fillRect(rect.x, waterline + 6, rect.w, rect.y + rect.h - waterline - 6);
  ctx.fillStyle = R[7];
  ctx.fillRect(rect.x, waterline + 14, rect.w, rect.y + rect.h - waterline - 14);
  ctx.fillStyle = R[8];
  for (let i = 0; i < rect.w; i += 3) {
    const hh = hash2(i, 5);
    if (hh % 4 === 0) ctx.fillRect(rect.x + i, waterline + 16 + ((hh >>> 4) % Math.max(1, rect.y + rect.h - waterline - 17)), 1, 1);
  }
  // shallow water over the wet sand and the foam lip
  ctx.fillStyle = R[5];
  ctx.fillRect(rect.x, beachTop, rect.w, Math.max(0, waterline - beachTop));
  ctx.fillStyle = R[6];
  for (let i = 0; i < rect.w; i += 2) if ((hash2(i, Math.floor(ms / 300)) & 3) === 0) ctx.fillRect(rect.x + i, beachTop + ((i * 7) % Math.max(1, waterline - beachTop + 1)), 2, 1);
  ctx.fillStyle = R[4];
  for (let i = 0; i < rect.w; i++) {
    const wob = (hash2(i >> 2, 11) % 3) - 1;
    ctx.fillRect(rect.x + i, waterline + wob, 1, 1);
    if ((i + Math.floor(ms / 200)) % 5 !== 0) ctx.fillRect(rect.x + i, waterline + wob + 1, 1, 1);
  }
  DRAW.fills++;
  ctx.restore();
}

function drawHeadland(ctx, rect, horizon, grade, ms, o, R) {
  const L = o.lighthouse || {};
  const hx = rect.x + Math.round(rect.w * 0.7);
  // a low rocky point rising from the horizon to the right: rock body, a lit west face, a grass
  // cap, a dark waterline, and the Keeper's Cottage on the slope
  const x0 = hx - 70;
  for (let x = x0; x < rect.x + rect.w; x++) {
    const hgt = headlandProfile(x, x0);
    if (hgt <= 0) continue;
    const top = horizon - hgt;
    ctx.fillStyle = R[12]; ctx.fillRect(x, top, 1, hgt);
    if (headlandProfile(x - 2, x0) < hgt - 1) { ctx.fillStyle = R[13]; ctx.fillRect(x, top + 2, 1, Math.max(1, Math.min(4, hgt - 3))); }
    ctx.fillStyle = R[16]; ctx.fillRect(x, top, 1, 1);
    ctx.fillStyle = R[15]; ctx.fillRect(x, top + 1, 1, 1);
    if ((hash2(x, 17) & 3) === 0) ctx.fillRect(x, top + 2, 1, 1);
    ctx.fillStyle = R[11]; ctx.fillRect(x, horizon - 1, 1, 2);
  }
  // the cottage: dark roof, cream wall, a window that is lit once the porch lamps are
  const cx = hx - 40, cy = horizon - headlandProfile(hx - 40, x0);
  ctx.fillStyle = R[11]; ctx.fillRect(cx - 1, cy - 7, 11, 3);
  ctx.fillStyle = R[14]; ctx.fillRect(cx, cy - 8, 9, 1);
  ctx.fillStyle = R[8]; ctx.fillRect(cx, cy - 4, 9, 4);
  ctx.fillStyle = grade.lamp >= 0.5 && (o.porches ?? 0) > 0 ? UI.porchAmber : R[0];
  ctx.fillRect(cx + 2, cy - 3, 2, 2);
  ctx.fillStyle = R[11]; ctx.fillRect(cx + 6, cy - 3, 2, 3);
  DRAW.fills++;
  const top = horizon - headlandProfile(hx, x0);
  // the lighthouse prop (scaffold stage, lamp) on the point
  const stage = Math.max(0, Math.min(7, L.stage ?? 0));
  const lit = !!L.lit && grade.lamp >= 0.5;
  TOWER_OPT.frame = stage; TOWER_OPT.name = lit ? 'lit' : null; TOWER_OPT.grade = grade;
  const tower = getSprite('lighthouse', TOWER_OPT);
  const tx = hx - 16, ty = top - 78;
  ctx.drawImage(tower.canvas, tx, ty);
  DRAW.images++;
  // lit porches along the shore under the point: the progress bar
  const porches = Math.max(0, Math.min(20, o.porches ?? 0));
  if (grade.lamp >= 0.5 && porches > 0) {
    for (let i = 0; i < porches; i++) {
      const px = hx - 90 - i * 9 - (hash2(i, 41) % 4);
      const py = horizon - 1 - (hash2(i, 9) % 2);
      ctx.fillStyle = UI.porchAmber;
      ctx.fillRect(px, py, 1, 1);
      if (i % 3 === 0) ctx.fillRect(px + 2, py, 1, 1);
    }
    DRAW.fills++;
  }
  if (lit) {
    const lamp = LAMP_BUF;
    lamp.x = tx + 16; lamp.y = ty + 9;
    const halo = ditherDisc(9, 9, UI.lighthouseAmber, 0.55);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(halo.canvas, lamp.x - halo.rx, lamp.y - halo.ry);
    DRAW.images++;
    // the beam: a flat sweep over the sea (projected; brightest when it faces the viewer)
    const a = beamAngle(ms, L.relitAt ?? -Infinity);
    const c = Math.cos(a), s = Math.sin(a);
    const reach = 220 * Math.abs(c) + 30;
    const half = 3 + 6 * Math.max(0, s);
    ctx.fillStyle = beamFill(0.25 + 0.25 * Math.max(0, s));
    const dir = c >= 0 ? 1 : -1;
    for (let d = 3; d < reach; d++) {
      const spread = Math.round((half * d) / reach);
      for (let yy = -spread; yy <= spread; yy++) {
        const px = lamp.x + dir * d, py = lamp.y + yy + Math.round(d * 0.04);
        const dens = 0.5 - (d / reach) * 0.4;
        if (BAYER4[((py & 3) << 2) | (px & 3)] < dens * 16) ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    DRAW.fills++;
  }
}

/* ================================================================== helpers */

// reused per-frame records (the Skyband draws every frame: §12, no per-frame allocation)
const SKY_BUF = { x: 0, y: 0, w: 0, h: 0 };
const SEA_SKY = { x: 0, y: 0, w: 0, h: 0 };
const SUN_BUF = { x: 0, y: 0, visible: false, low: false, t: 0 };
const MOON_BUF = { x: 0, y: 0, visible: false, low: false, t: 0 };
const COMET_BUF = { x: 0, y: 0, tail: 0, stage: 0, density: 0 };
const SUN_LOW = Object.freeze({ name: 'low' });
const SHORE_SKY2 = { x: 0, y: 0, w: 0, h: 0 };
const LAMP_BUF = { x: 0, y: 0 };
const TOWER_OPT = { frame: 0, name: null, grade: null };
/** Headland height at column x for a point starting at x0 (0 before it). */
function headlandProfile(x, x0) {
  const d = x - x0;
  if (d < 0) return 0;
  return Math.min(16, Math.floor(Math.sqrt(d) * 1.7) + ((hash2(x >> 2, 3) % 3) - 1));
}
/** @type {Map<number, string>} beam strength step -> fill colour (lighthouse amber scaled) */
const beamFills = new Map();
function beamFill(k) {
  const q = Math.round(k * 40);
  let f = beamFills.get(q);
  if (!f) { const c = rgbOf(UI.lighthouseAmber); f = `rgb(${Math.round(c[0] * q / 40)},${Math.round(c[1] * q / 40)},${Math.round(c[2] * q / 40)})`; beamFills.set(q, f); }
  return f;
}
/** @type {Map<number, any>} band rect -> skyLayout (rects are few: the band is 480x40) */
const layouts = new Map();
function bandLayout(rect) {
  const k = ((rect.x * 2048 + rect.y) * 2048 + rect.w) * 512 + rect.h;
  let L = layouts.get(k);
  if (!L) { if (layouts.size > 16) layouts.clear(); L = skyLayout(rect); layouts.set(k, L); }
  return L;
}
/** @type {WeakMap<object, string[]>} grade -> compass mark colours [ink, wall, band] */
const compassCache = new WeakMap();
function compassColours(grade) {
  let c = compassCache.get(grade);
  if (!c) { c = [gradeColour('st0', grade), gradeColour('st2', grade), gradeColour('red1', grade)]; compassCache.set(grade, c); }
  return c;
}
/** @type {Map<string, Map<string, string>>} art id -> variant -> `id@variant` */
const variantKeys = new Map();
function variantKey(id, variant) {
  let m = variantKeys.get(id);
  if (!m) { m = new Map(); variantKeys.set(id, m); }
  let k = m.get(variant);
  if (!k) { k = id + '@' + variant; m.set(variant, k); }
  return k;
}

function wrap(m) {
  return ((m % 1440) + 1440) % 1440;
}
function rgb01(hex) {
  return rgbOf(hex).map((v) => v / 255);
}
function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function sample(stops, t) {
  if (t <= 0.5) return lerp3(stops[0], stops[1], t * 2);
  return lerp3(stops[1], stops[2], (t - 0.5) * 2);
}


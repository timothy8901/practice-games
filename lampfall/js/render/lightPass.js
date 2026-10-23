/**
 * Light and weather passes (ARCHITECTURE §4.7 steps 7-8, §12; GDD-00 §14). [RENDER]
 *
 * **Light pools** are pre-rendered dither discs, never smooth bloom: concentric rings of falling
 * ordered-dither density in the light's colour, drawn additively (`'lighter'`) over the graded
 * scene. Discs are cached per `(style, radius, colour, intensity step)`, so a frame is one
 * `drawImage` per pool and no allocation. Lamps and porches throw a flattened pool on the ground
 * and a small halo at the lamp; windows spill a low pool; glowing mud breathes cyan; skyglass
 * keeps a faint magenta ring; fires flicker one radius step. {@link selectLights} keeps the 16
 * that matter (lighthouse and the Lantern first, then fires, lamps, porches, runes, windows, mud;
 * nearest the view centre within a class), halved in low power.
 *
 * **The lighthouse beam** (after the Relighting): three nested cones of world-anchored dither
 * patterns in lighthouse amber sweep the town once every 8 s (the first sweep takes 16 s), raked
 * flat for the 3/4 view. Slow and steady; it never flashes.
 *
 * **Weather** runs through `core/fx` emitters (rain streaks and snow in palette colours, re-coloured
 * by the hour so night rain never glows), plus two drifting layers of dithered fog banks whose
 * combined opacity is capped at 35% and which clear around the player through a dithered hole.
 * Fireflies drift over cover and flowers on clear nights. `clearVisuals` thins rain and drops fog;
 * `reducedMotion` drops particles (§4.7: never the grade).
 *
 * DOM-free at import.
 * @module render/lightPass
 */

import { getTile } from '../art/atlas.js';
import { gradeColour } from '../art/atlas.js';
import { UI, COLORS } from '../art/palette.js';
import { makeCanvas, ctx2d, DRAW, BAYER4, rgbOf, hexOfRgb, hash2 } from './surface.js';

/** Pools drawn per frame (GDD-00 §14: <= 16 on screen). */
export const MAX_LIGHTS = 16;
/** Pools in low power. */
export const MAX_LIGHTS_LOW_POWER = 8;
/** Lighthouse sweep period after the first sweep (ms). */
export const BEAM_PERIOD_MS = 8000;
/** The first sweep after the Relighting (ms). */
export const BEAM_FIRST_SWEEP_MS = 16000;
/** Combined fog opacity cap (GDD-00 §14: weather overlays cap at 35%). */
export const FOG_CAP = 0.35;
/** Per-layer fog alphas; their union `1 - (1-a)(1-b)` stays under {@link FOG_CAP}. */
export const FOG_LAYERS = Object.freeze([0.2, 0.15]);

/**
 * Draw style per light kind. `priority` orders selection (lower first); `pool` is the ground pool
 * `[rxScale, ryScale, oy, strength]` and `halo` the lamp glow `[radius, oy, strength]` (or null).
 */
export const LIGHT_STYLE = Object.freeze({
  beam: Object.freeze({ priority: 0, color: UI.lighthouseAmber, pool: [0.6, 0.6, 0, 0.3], halo: [9, 0, 0.45] }),
  lantern: Object.freeze({ priority: 1, color: UI.porchAmber, pool: [1, 0.62, 6, 0.32], halo: null }),
  fire: Object.freeze({ priority: 2, color: UI.lighthouseAmber, pool: [0.9, 0.55, 4, 0.32], halo: [5, -6, 0.4] }),
  lamp: Object.freeze({ priority: 3, color: UI.porchAmber, pool: [0.8, 0.45, 10, 0.3], halo: [4, -14, 0.42] }),
  porch: Object.freeze({ priority: 3, color: UI.porchAmber, pool: [0.8, 0.45, 14, 0.28], halo: [3, -3, 0.4] }),
  rune: Object.freeze({ priority: 4, color: '#FF5BD6', pool: [0.8, 0.8, 2, 0.16], halo: null }),
  window: Object.freeze({ priority: 5, color: UI.porchAmber, pool: [0.9, 0.5, 12, 0.18], halo: null }),
  bio: Object.freeze({ priority: 6, color: UI.bioCyan, pool: [1, 0.7, 0, 0.2], halo: null }),
});
const DEFAULT_STYLE = LIGHT_STYLE.lamp;

/**
 * Style for a light kind (unknown kinds draw as lamps).
 * @param {string} kind
 * @returns {typeof DEFAULT_STYLE}
 */
export function styleOf(kind) {
  return Object.hasOwn(LIGHT_STYLE, kind) ? LIGHT_STYLE[kind] : DEFAULT_STYLE;
}

/**
 * Picks the pools to draw. Pure and allocation-free with an `out` array: lights whose pool misses
 * the view are dropped, the rest ordered by style priority then distance to the view centre, and
 * truncated to `max`.
 * @param {ReadonlyArray<{kind: string, px: number, py: number, radius: number, intensity: number}>} lights
 * @param {{x: number, y: number, w: number, h: number}} view   world-pixel view rect
 * @param {{max?: number, lowPower?: boolean, out?: any[]}} [opts]
 * @returns {any[]} the chosen lights (the `out` array when given)
 */
export function selectLights(lights, view, opts = {}) {
  const max = opts.max ?? (opts.lowPower ? MAX_LIGHTS_LOW_POWER : MAX_LIGHTS);
  const out = opts.out || [];
  out.length = 0;
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i];
    if (!(L.intensity > 0)) continue;
    const r = L.radius + 16;
    if (L.px + r < view.x || L.px - r > view.x + view.w || L.py + r < view.y || L.py - r > view.y + view.h) continue;
    out.push(L);
  }
  // insertion sort on (priority, distance): n is small and stable across frames
  for (let i = 1; i < out.length; i++) {
    const a = out[i];
    const ka = scoreOf(a, cx, cy);
    let j = i - 1;
    while (j >= 0 && scoreOf(out[j], cx, cy) > ka) { out[j + 1] = out[j]; j--; }
    out[j + 1] = a;
  }
  if (out.length > max) out.length = max;
  return out;
}

function scoreOf(L, cx, cy) {
  const dx = L.px - cx, dy = L.py - cy;
  return styleOf(L.kind).priority * 1e9 + dx * dx + dy * dy;
}

/**
 * Beam angle (radians, 0 = east, clockwise on screen) at `ms`, for a Relighting at `startMs`: the
 * first sweep takes {@link BEAM_FIRST_SWEEP_MS}, then one every {@link BEAM_PERIOD_MS}.
 * @param {number} ms
 * @param {number} [startMs=-Infinity]  when the lamp was relit (omit for a long-lit lamp)
 * @returns {number} angle in [0, 2π)
 */
export function beamAngle(ms, startMs = -Infinity) {
  const t = ms - startMs;
  const TAU = Math.PI * 2;
  if (Number.isFinite(t) && t >= 0 && t < BEAM_FIRST_SWEEP_MS) return (t / BEAM_FIRST_SWEEP_MS) * TAU;
  const tt = Number.isFinite(t) ? t - BEAM_FIRST_SWEEP_MS : ms;
  const a = ((tt % BEAM_PERIOD_MS) + BEAM_PERIOD_MS) % BEAM_PERIOD_MS;
  return (a / BEAM_PERIOD_MS) * TAU;
}

/**
 * Union opacity of stacked fog layers (must stay <= {@link FOG_CAP}).
 * @param {ReadonlyArray<number>} [layers]
 * @returns {number}
 */
export function fogCoverage(layers = FOG_LAYERS) {
  let clear = 1;
  for (const a of layers) clear *= 1 - a;
  return 1 - clear;
}

/* ================================================================== dither discs */

/** Ring table: `[distanceEnd, density, gain]` from the centre out. */
const RINGS = Object.freeze([
  [0.28, 1, 1],
  [0.5, 1, 0.66],
  [0.72, 0.5, 0.66],
  [0.88, 0.25, 0.6],
  [1.0, 0.125, 0.55],
]);

/** @type {Map<number, any>} */
const discCache = new Map();
/** @type {Map<string, number>} colour -> small id */
const colorIds = new Map();
const DISC_CACHE_MAX = 160;

/**
 * A dither disc (ellipse `rx x ry`) in `color` scaled by `strength`, cached. Drawn additively.
 * @param {number} rx @param {number} ry @param {string} color @param {number} strength 0..1
 * @returns {{canvas: any, rx: number, ry: number}}
 */
export function ditherDisc(rx, ry, color, strength) {
  rx = Math.max(1, Math.round(rx));
  ry = Math.max(1, Math.round(ry));
  const s = Math.round(strength * 20) / 20;
  let ci = colorIds.get(color);
  if (ci === undefined) { ci = colorIds.size; colorIds.set(color, ci); }
  // numeric key: no string building per pool per frame
  const key = ((ci * 512 + Math.min(rx, 511)) * 512 + Math.min(ry, 511)) * 32 + Math.round(s * 20);
  let d = discCache.get(key);
  if (d) return d;
  if (discCache.size >= DISC_CACHE_MAX) discCache.delete(discCache.keys().next().value);
  const w = rx * 2 + 1, h = ry * 2 + 1;
  const canvas = makeCanvas(w, h);
  const g = ctx2d(canvas);
  const [r, gg, b] = rgbOf(color);
  const img = typeof g.createImageData === 'function' ? g.createImageData(w, h) : null;
  if (img) {
    const px = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - rx) / (rx + 0.5), ny = (y - ry) / (ry + 0.5);
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist >= 1) continue;
        let ring = 0;
        while (ring < RINGS.length - 1 && dist > RINGS[ring][0]) ring++;
        const [, density, gain] = RINGS[ring];
        if (BAYER4[((y & 3) << 2) | (x & 3)] >= density * 16) continue;
        const k = s * gain;
        const i = (y * w + x) * 4;
        px[i] = r * k; px[i + 1] = gg * k; px[i + 2] = b * k; px[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  d = { canvas, rx, ry };
  discCache.set(key, d);
  return d;
}

/** @type {Map<number, any>} */
const tintCache = new Map();

/**
 * The multiply half of a pool: the light's hue mixed toward white by strength, dithered by ring.
 * Transparent outside the disc (multiply then leaves those pixels alone).
 * @param {number} rx @param {number} ry @param {string} color @param {number} strength
 * @returns {{canvas: any, rx: number, ry: number}}
 */
export function tintDisc(rx, ry, color, strength) {
  rx = Math.max(1, Math.round(rx));
  ry = Math.max(1, Math.round(ry));
  const s = Math.round(strength * 20) / 20;
  let ci = colorIds.get(color);
  if (ci === undefined) { ci = colorIds.size; colorIds.set(color, ci); }
  const key = ((ci * 512 + Math.min(rx, 511)) * 512 + Math.min(ry, 511)) * 32 + Math.round(s * 20);
  let d = tintCache.get(key);
  if (d) return d;
  if (tintCache.size >= DISC_CACHE_MAX) tintCache.delete(tintCache.keys().next().value);
  const w = rx * 2 + 1, h = ry * 2 + 1;
  const canvas = makeCanvas(w, h);
  const g = ctx2d(canvas);
  const [r, gg, b] = rgbOf(color);
  const img = typeof g.createImageData === 'function' ? g.createImageData(w, h) : null;
  if (img) {
    const px = img.data;
    // the tint: white pulled toward the light's colour, at most 1.3x the strength
    const m = Math.min(0.7, s * 1.3);
    const tr = 255 - (255 - r) * m, tg = 255 - (255 - gg) * m, tb = 255 - (255 - b) * m;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - rx) / (rx + 0.5), ny = (y - ry) / (ry + 0.5);
        const dist = Math.sqrt(nx * nx + ny * ny);
        if (dist >= 1) continue;
        let ring = 0;
        while (ring < RINGS.length - 1 && dist > RINGS[ring][0]) ring++;
        const density = Math.min(1, RINGS[ring][1] * 1.6);
        if (BAYER4[((y & 3) << 2) | (x & 3)] >= density * 16) continue;
        const i = (y * w + x) * 4;
        px[i] = tr; px[i + 1] = tg; px[i + 2] = tb; px[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }
  d = { canvas, rx, ry };
  tintCache.set(key, d);
  return d;
}

/* ================================================================== light pass */

/**
 * @typedef {Object} LightPass
 * @property {(ctx: any, lights: any[], rect: object, camX: number, camY: number, grade: object, ms: number) => number} drawPools
 * @property {(ctx: any, origin: {x: number, y: number}, angle: number, rect: object, camX: number, camY: number, strength?: number) => void} drawBeam
 */

/** @returns {LightPass} */
export function createLightPass() {
  /** @type {Map<string, any>} beam patterns by key */
  const patterns = new Map();

  function beamPattern(ctx, density, k) {
    const key = `${density}|${k}`;
    let p = patterns.get(key);
    if (p) return p;
    const c = makeCanvas(4, 4);
    const g = ctx2d(c);
    const [r, gg, b] = rgbOf(UI.lighthouseAmber);
    g.fillStyle = hexOfRgb(r * k, gg * k, b * k);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER4[(y << 2) | x] < density * 16) g.fillRect(x, y, 1, 1);
    p = ctx.createPattern(c, 'repeat');
    patterns.set(key, p);
    return p;
  }

  return {
    drawPools(ctx, lights, rect, camX, camY, grade, ms, scaleAt) {
      if (!lights.length) return 0;
      const dx = rect.x - camX, dy = rect.y - camY;
      // pools fade in with the grade's lamp weight and read stronger the darker it is
      const dark = Math.min(1, 0.5 + 0.5 * grade.night + (grade.weather !== 'clear' ? 0.1 : 0));
      let n = 0;
      // two passes: a dithered warm tint (multiply: the light's hue takes the night blue out of what it
      // touches), then a gentler additive disc (the light itself). Both are cached dither discs.
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = pass === 0 ? 'multiply' : 'lighter';
        for (let i = 0; i < lights.length; i++) {
          const L = lights[i];
          const st = styleOf(L.kind);
          const color = L.color || st.color;
          const level = Math.round(Math.min(1, L.intensity) * 4) / 4;
          if (level <= 0) continue;
          let radius = L.radius * (scaleAt ? scaleAt(L) : 1);
          if (L.kind === 'fire') radius += (Math.floor(ms / 110) + hash2(L.px, L.py)) % 3 === 0 ? 1 : 0;
          if (L.kind === 'bio') radius += Math.round(Math.sin(ms / 900 + (L.px + L.py) * 0.05) * 2);
          const [sx, sy, oy, strength] = st.pool;
          const k = strength * level * dark;
          const disc = pass === 0 ? tintDisc(radius * sx, radius * sy, color, k) : ditherDisc(radius * sx, radius * sy, color, k);
          ctx.drawImage(disc.canvas, Math.round(L.px + dx - disc.rx), Math.round(L.py + dy + oy - disc.ry));
          n++;
          if (pass === 1 && st.halo) {
            const [hr, hoy, hs] = st.halo;
            const halo = ditherDisc(hr, hr, color, hs * level);
            ctx.drawImage(halo.canvas, Math.round(L.px + dx - halo.rx), Math.round(L.py + dy + hoy - halo.ry));
            n++;
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      DRAW.images += n;
      return n;
    },

    /** Creates (without drawing) the discs `drawPools` would use for these lights at this grade. */
    warmPools(lights, grade, scaleAt) {
      const dark = Math.min(1, 0.5 + 0.5 * grade.night + (grade.weather !== 'clear' ? 0.1 : 0));
      for (let i = 0; i < lights.length; i++) {
        const L = lights[i];
        const st = styleOf(L.kind);
        const color = L.color || st.color;
        const level = Math.round(Math.min(1, L.intensity) * 4) / 4;
        if (level <= 0) continue;
        const radius = L.radius * (scaleAt ? scaleAt(L) : 1);
        const [sx, sy, , strength] = st.pool;
        const k = strength * level * dark;
        tintDisc(radius * sx, radius * sy, color, k);
        ditherDisc(radius * sx, radius * sy, color, k);
        if (st.halo) ditherDisc(st.halo[0], st.halo[0], color, st.halo[2] * level);
      }
    },

    drawBeam(ctx, origin, angle, rect, camX, camY, strength = 1) {
      const R = 320;
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.translate(rect.x - camX, rect.y - camY);
      ctx.globalCompositeOperation = 'lighter';
      const cones = [[0.2, 1.0, 0.125, 0.2], [0.13, 0.8, 0.25, 0.18], [0.065, 0.5, 0.5, 0.2]];
      for (const [half, reach, density, k] of cones) {
        ctx.fillStyle = beamPattern(ctx, density, Math.round(k * strength * 20) / 20);
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        const steps = 5;
        for (let s = 0; s <= steps; s++) {
          const a = angle - half + (2 * half * s) / steps;
          ctx.lineTo(origin.x + Math.cos(a) * R * reach, origin.y + (Math.sin(a) * R * reach) / 1.6);
        }
        ctx.closePath();
        ctx.fill();
        DRAW.fills++;
      }
      ctx.restore();
    },
  };
}

/* ================================================================== weather */

/** Weather colour names (art/palette COLORS / MASTER), graded by the hour before use. */
const RAIN_COLORS = Object.freeze(['#B8CFE0', '#94B0C2', '#73EFF7']);
const SNOW_COLORS = Object.freeze(['snow3', 'snow2', 'cream']);
const FIREFLY_COLORS = Object.freeze(['#9FE8C8', '#C3D0BA', '#E9F7F2']);

/**
 * A weather colour through the grade, lifted part way back toward its raw value so rain and snow
 * stay legible at night without glowing.
 * @param {string} c @param {object} g @param {number} k 0 = graded, 1 = raw
 * @returns {string}
 */
function liftColour(c, g, k) {
  const a = rgbOf(gradeColour(c, g)), b = rgbOf(gradeColour(c, null));
  return hexOfRgb(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

/**
 * @typedef {Object} WeatherState
 * @property {string} kind  'clear' | 'rain' | 'storm' | 'fog' | 'snow' | 'overcast'
 */

/**
 * Weather and firefly controller over a `core/fx` instance (world- and screen-space emitters).
 * @param {import('../core/fx.js').FX} fx
 * @returns {{update: (o: {weather: string, grade: object, zones: Array<{x: number, y: number}>, view: object, rect: object, reducedMotion?: boolean, clearVisuals?: boolean, lowPower?: boolean}) => void, drawFog: Function, stats: () => object, clear: () => void}}
 */
export function createWeather(fx) {
  let rain = null, snow = null, sig = '';
  /** active firefly emitters by zone index */
  const flies = new Map();
  const fogBuf = { canvas: null, w: 0, h: 0, hole: null };

  function stopAll() {
    if (rain) { rain.stop(); rain = null; }
    if (snow) { snow.stop(); snow = null; }
  }

  return {
    update(o) {
      const kind = o.reducedMotion ? 'none' : o.weather;
      const g = o.grade;
      const s = `${kind}|${g.id}|${o.clearVisuals ? 1 : 0}|${o.lowPower ? 1 : 0}`;
      if (s !== sig) {
        sig = s;
        stopAll();
        const thin = (o.clearVisuals ? 0.5 : 1) * (o.lowPower ? 0.5 : 1);
        if (kind === 'rain' || kind === 'storm') {
          rain = fx.particles('rain', {
            colors: RAIN_COLORS.map((c) => liftColour(c, g, 0.45)),
            rate: Math.round((kind === 'storm' ? 320 : 240) * thin),
            alpha: kind === 'storm' ? [0.6, 0.85] : [0.5, 0.8],
            vx: kind === 'storm' ? [-80, -60] : [-40, -28],
            vy: [420, 520],
            size: [6, 10],
            x: -60, w: 600, y: o.rect.y - 16, h: 8,
          });
        } else if (kind === 'snow') {
          snow = fx.particles('snow', { colors: SNOW_COLORS.map((c) => liftColour(c, g, 0.35)), rate: Math.round(36 * thin), y: o.rect.y - 8, h: 4 });
        }
      }
      // fireflies: clear or overcast nights, over cover near the view
      const night = g.night >= 0.6 && (o.weather === 'clear' || o.weather === 'overcast') && !o.reducedMotion;
      const v = o.view;
      for (let z = 0; z < o.zones.length; z++) {
        const Z = o.zones[z];
        const near = night && Z.x > v.x - 48 && Z.x < v.x + v.w + 48 && Z.y > v.y - 48 && Z.y < v.y + v.h + 48;
        const em = flies.get(z);
        if (near && !em && flies.size < (o.lowPower ? 2 : 5)) {
          flies.set(z, fx.particles('fireflies', { x: Z.x - 24, y: Z.y - 18, w: 48, h: 30, rate: 1.4, colors: FIREFLY_COLORS, alpha: [0.6, 0.95] }));
        } else if (!near && em) {
          em.stop();
          flies.delete(z);
        }
      }
    },

    /**
     * Two drifting fog layers of `fog-band` art, cleared around `focus` (screen px) through a
     * dithered elliptical hole; combined opacity <= {@link FOG_CAP}.
     */
    drawFog(ctx, rect, camX, camY, grade, ms, focus) {
      const w = rect.w, h = rect.h;
      if (!fogBuf.canvas || fogBuf.w !== w || fogBuf.h !== h) {
        fogBuf.canvas = makeCanvas(w, h);
        fogBuf.w = w; fogBuf.h = h;
      }
      if (!fogBuf.hole) fogBuf.hole = makeHole(64, 50);
      const g = ctx2d(fogBuf.canvas);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);
      const band = getTile('fog-band', 0, grade);
      const bw = band.w;
      const layers = [
        { speed: 0.012, alpha: FOG_LAYERS[0], seed: 3, step: 22, par: 1 },
        { speed: -0.008, alpha: FOG_LAYERS[1], seed: 11, step: 30, par: 0.6 },
      ];
      for (const L of layers) {
        g.globalAlpha = L.alpha;
        // bands are anchored to the world (with parallax) so walking moves through them
        const wy0 = Math.floor((camY * L.par) / L.step) - 1;
        for (let row = wy0; row * L.step - camY * L.par < h + 16; row++) {
          const hy = hash2(row, L.seed);
          const yy = row * L.step - camY * L.par + (hy % 9) - 4;
          const shift = ms * L.speed - camX * L.par + ((hy >>> 4) % bw);
          const s0 = Math.floor((-shift - bw) / bw);
          for (let seg = s0; seg * bw + shift < w + bw; seg++) {
            if (hash2(seg, row * 31 + L.seed) % 5 >= 2) continue;
            g.drawImage(band.canvas, Math.round(seg * bw + shift), Math.round(yy));
            DRAW.images++;
          }
        }
      }
      g.globalAlpha = 1;
      if (focus) {
        g.globalCompositeOperation = 'destination-out';
        g.drawImage(fogBuf.hole, Math.round(focus.x - rect.x - 64), Math.round(focus.y - rect.y - 50));
        g.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(fogBuf.canvas, rect.x, rect.y);
      DRAW.images += 2;
    },

    stats() {
      return { rain: !!rain, snow: !!snow, fireflyZones: flies.size };
    },

    clear() {
      stopAll();
      for (const em of flies.values()) em.stop();
      flies.clear();
      sig = '';
    },
  };
}

/**
 * The fog hole: an opaque ellipse with a two-step dithered rim, drawn with `destination-out`.
 * @param {number} rx @param {number} ry
 * @returns {any}
 */
function makeHole(rx, ry) {
  const w = rx * 2, h = ry * 2;
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.fillStyle = COLORS.ink;
  const inner = 0.72, mid = 0.86;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - rx + 0.5) / rx, ny = (y - ry + 0.5) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d >= 1) continue;
      const on = d < inner ? true : d < mid ? ((x + y) & 1) === 0 : (x & 1) === 0 && (y & 1) === 0;
      if (on) g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/**
 * Firefly zones for a map: centres of 6x6-tile bins holding at least five cover / flower cells.
 * @param {object} A tileRenderer analysis
 * @returns {Array<{x: number, y: number}>}
 */
export function fireflyZones(A) {
  if (!A) return [];
  const BIN = 6, T = 16;
  const bins = new Map();
  const { map, w, h, slots } = A;
  for (let i = 0; i < w * h; i++) {
    const s = slots[map.layers[0][i]];
    if (!s || !s.art || !/^(tall-grass|reeds|heather|flowers-)/.test(s.art)) continue;
    const x = i % w, y = (i - x) / w;
    const k = Math.floor(y / BIN) * 1000 + Math.floor(x / BIN);
    const b = bins.get(k) || { n: 0, sx: 0, sy: 0 };
    b.n++; b.sx += x; b.sy += y;
    bins.set(k, b);
  }
  const out = [];
  for (const b of bins.values()) if (b.n >= 5) out.push({ x: Math.round((b.sx / b.n) * T + 8), y: Math.round((b.sy / b.n) * T + 8) });
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  return out;
}

/**
 * The overworld frame (ARCHITECTURE §4.7, §12). [RENDER]
 *
 * `drawFrame(G, view)` composes the passes in the §4.7 order with the camera from `world/camera`:
 *
 *  1. clear the map rect to night ink
 *  2. ground chunks `(tideVariant, gradeId)`, then the animated ground cells (water, surf, swell,
 *     glowing mud, wind gusts and rustles in cover) and rain ripples
 *  3. detail chunks and animated details (skyglass, shoals)
 *  4. objects and entities, y-sorted, through the per-grade recolour cache
 *  5. overlay chunks (eaves, string lights)
 *  6. light pools (<= 16 dither discs, additive) and the lighthouse beam after the Relighting
 *  7. weather from `core/fx` (rain, snow, fireflies) and the fog banks (<= 35%)
 *  8. the Skyband across the top 40 px
 *
 * Grading is the palette LUT (`world/lighting.gradeFor`, quantized to 48 slots a day x weather), never
 * a multiply overlay: tiles, props and sprites are decoded through the grade by `art/atlas`, and `!`
 * colours (lamps, glowing mud, skyglass, lit windows) bypass it. When the grade or the tide changes,
 * the new chunk set is baked by a work queue spread over frames while the previous complete set keeps
 * showing; the switch is atomic (no patchwork frame). The next grade slot is pre-baked when idle, so a
 * change of hour normally costs nothing on the frame it lands.
 *
 * DOM-free at import.
 * @module render/mapRenderer
 */

import { gradeFor, lampsLit, lightSources, shadowFor, GRADE_STEP_MINUTES } from '../world/lighting.js';
import { tideVariant } from '../world/tide.js';
import { createFX } from '../core/fx.js';
import { createTileRenderer, gradeIndex } from './tileRenderer.js';
import { createEntityRenderer } from './entityRenderer.js';
import { createLightPass, createWeather, selectLights, fireflyZones, beamAngle } from './lightPass.js';
import { drawSkyband, SKYBAND_H } from './sky.js';
import { DRAW, resetDrawCounters, nowMs } from './surface.js';
import { UI } from '../art/palette.js';

/** Native frame size. */
export const VIEW_W = 480;
export const VIEW_H = 270;
/** Default map rect under the Skyband. */
export const MAP_RECT = Object.freeze({ x: 0, y: SKYBAND_H, w: VIEW_W, h: VIEW_H - SKYBAND_H });
/** Full-frame map rect (no Skyband: interiors, cutscenes). */
export const FULL_RECT = Object.freeze({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });

/**
 * The LUT key for a moment: the grade id `world/lighting.gradeFor` quantizes to (one per 30 in-game
 * minutes per weather, or `'indoor'`) and its interned index (what chunk keys carry).
 * @param {number} minute @param {string} [weather] @param {boolean} [indoor]
 * @returns {{id: string, index: number, grade: object}}
 */
export function lutKey(minute, weather, indoor) {
  const grade = gradeFor(minute, weather, indoor);
  return { id: grade.id, index: gradeIndex(grade), grade };
}

/**
 * @typedef {Object} RenderView
 * @property {any} [ctx]                    target context (default `G.display.ctx`)
 * @property {object} map                   RuntimeMap (`world/tilemap.loadMap`)
 * @property {{list?: any[]}|any[]} [entities]   EntityManager or an entity array
 * @property {{x: number, y: number}} camera     `world/camera` (snapped `x, y`, shake included)
 * @property {number} minute                minute of day
 * @property {string} [weather='clear']
 * @property {number|string} [tide='mid']   clock tide height 0..1, tide state or variant
 * @property {number} [time]                animation clock in ms (default: performance.now)
 * @property {number} [day=1]
 * @property {Record<string, any>} [flags]  world flags (porches, windows, the Relighting)
 * @property {object} [world]               the World, for `lighting.lightSources` conditions
 * @property {{stage?: number, relit?: boolean, relitAt?: number}} [lighthouse]
 * @property {any} [player]                 focus entity: fog clears around it; the Lantern follows it
 * @property {boolean} [lantern]            the Lantern is out
 * @property {boolean} [skyband=true]
 * @property {{x: number, y: number, w: number, h: number}} [rect]   map rect on screen
 * @property {number} [comet]               season progress 0..1 for the Skyband smudge
 * @property {number} [tier]                cottage tier (`artByTier` tiles)
 * @property {string} [roof]                the player's roof colour
 * @property {(cond: any) => boolean} [cond] prop / object condition evaluator
 * @property {boolean} [reducedMotion]
 * @property {boolean} [clearVisuals]
 * @property {boolean} [lowPower]
 * @property {boolean} [tideDial=true]
 */

/**
 * @typedef {Object} FrameStats
 * @property {number} ms           draw time
 * @property {number} drawImages
 * @property {number} fills
 * @property {number} bakes        chunks baked this frame
 * @property {number} chunks       chunk records resident
 * @property {number} queued       bakes waiting
 * @property {number} sprites      y-sorted drawables
 * @property {number} lights       pools drawn
 * @property {number} particles
 * @property {string} grade        grade id shown
 * @property {string} tide         tide variant shown
 */

/**
 * @param {{budgetMs?: number, maxChunks?: number, maxCombos?: number, fxSeed?: string}} [opts]
 */
export function createMapRenderer(opts = {}) {
  const tiles = createTileRenderer(opts);
  const sprites = createEntityRenderer();
  const lights = createLightPass();
  const fx = createFX({ seed: opts.fxSeed || 'render-weather', width: VIEW_W, height: VIEW_H, maxParticles: 600 });
  const weather = createWeather(fx);
  const budgetMs = opts.budgetMs ?? 2.5;
  let map = null;
  let zones = [];
  let shown = null; // {tide, grade}
  let lastTime = null;
  let lastFlags = undefined, lastTier = undefined, lastRoof = undefined;
  const lightBuf = [];
  const allLights = [];
  const chosen = [];
  const lantern = { id: 'lantern', kind: 'lantern', x: 0, y: 0, px: 0, py: 0, radius: 44, color: null, intensity: 1 };
  const viewRect = { x: 0, y: 0, w: 0, h: 0 };
  const fxCam = { x: 0, y: 0 };
  const focusPt = { x: 0, y: 0 };
  const beamOrigin = { x: 0, y: 0 };
  const shownBuf = { tide: 'mid', grade: null };
  const stats = { ms: 0, drawImages: 0, fills: 0, bakes: 0, chunks: 0, queued: 0, sprites: 0, lights: 0, particles: 0, grade: '', tide: '' };
  const lighthouseOpt = { stage: 0, lit: false };
  const entOpt = { grade: null, ms: 0, tide: 'mid', shadow: null, analysis: null, flags: null, lighthouse: lighthouseOpt, cond: null, onEnterCell: null };
  const lightOpt = { minute: 0, weather: 'clear', tide: 'mid', indoor: false, out: lightBuf };
  const skyOpt = { minute: 0, weather: 'clear', grade: null, ms: 0, day: 1, tide: 0, tideDial: true, comet: 0, compass: null, reducedMotion: false };
  const compass = { dx: 0, lit: false };
  const weatherOpt = { weather: 'clear', grade: null, zones: null, view: viewRect, rect: null, reducedMotion: false, clearVisuals: false, lowPower: false };
  let msNow = 0;
  entOpt.onEnterCell = (x, y) => tiles.rustle(x, y, msNow);

  /** per-cell radius scale for glows whose tile asks for a smaller pool (string lights) */
  let glowScale = null;
  const glowScaleAt = (L) => {
    if (!glowScale || L.x < 0 || L.y < 0 || L.x >= map.w || L.y >= map.h) return 1;
    return glowScale[L.y * map.w + L.x] || 1;
  };

  function setMap(m) {
    map = m;
    tiles.setMap(m);
    glowScale = new Float32Array(m.w * m.h);
    for (const gl of m.glows) {
      const sc = GLOW_SCALE[gl.id];
      if (sc) glowScale[gl.y * m.w + gl.x] = sc;
    }
    zones = fireflyZones(tiles.analysis());
    shown = null;
    weather.clear();
    fx.clear();
  }

  function lighthouseObject() {
    const objs = tiles.objects;
    for (let i = 0; i < objs.length; i++) if (objs[i].special === 'lighthouse') return objs[i];
    return null;
  }

  /**
   * Draws one overworld frame.
   * @param {any} G   game context (`G.display.ctx` is the default target)
   * @param {RenderView} view
   * @returns {FrameStats}
   */
  function drawFrame(G, view) {
    const t0 = nowMs();
    resetDrawCounters();
    const ctx = view.ctx || (G && G.display && G.display.ctx);
    if (!ctx) throw new Error('mapRenderer.drawFrame: no context (view.ctx or G.display.ctx)');
    if (view.map !== map) setMap(view.map);
    const skyband = view.skyband !== false;
    const rect = view.rect || (skyband ? MAP_RECT : FULL_RECT);
    const ms = view.time ?? nowMs();
    msNow = ms;
    const dt = lastTime === null ? 16.7 : Math.max(0, Math.min(100, ms - lastTime));
    lastTime = ms;
    const camX = Math.round(view.camera.x), camY = Math.round(view.camera.y);
    const wname = view.weather || 'clear';
    const indoor = !!map.indoor;
    const grade = gradeFor(view.minute, wname, indoor);
    const tide = tideVariant(view.tide ?? 'mid');
    if (view.flags !== lastFlags || view.tier !== lastTier || view.roof !== lastRoof) {
      lastFlags = view.flags; lastTier = view.tier; lastRoof = view.roof;
      tiles.setBakeContext({ flags: view.flags || null, tier: view.tier, roof: view.roof, cond: view.cond || null });
      shown = null;
    }

    // ---- choose the chunk set to show: the desired one when complete, else the last complete one
    let dTide = tide, dGrade = grade;
    if (tiles.missing(rect, camX, camY, tide, grade) > 0) {
      if (shown && shown.grade && tiles.missing(rect, camX, camY, shown.tide, shown.grade) === 0) {
        tiles.want([[tide, grade], [shown.tide, shown.grade]]);
        tiles.request(rect, camX, camY, tide, grade);
        dTide = shown.tide; dGrade = shown.grade;
      } else {
        tiles.bakeNow(rect, camX, camY, tide, grade);
        tiles.want([[tide, grade]]);
        tiles.request(rect, camX, camY, tide, grade);
      }
    } else if (tiles.queueLength() === 0) {
      // idle: keep the ring warm, then pre-bake the next grade slot
      const next = nextGradeOf(grade, wname, indoor);
      tiles.want([[tide, grade], [tide, next]]);
      tiles.request(rect, camX, camY, tide, grade);
      if (tiles.queueLength() === 0 && !indoor) tiles.request(rect, camX, camY, tide, next, { ring: false });
    }
    shownBuf.tide = dTide; shownBuf.grade = dGrade;
    shown = shownBuf;
    const g = dGrade;

    // ---- passes
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = UI.nightInk;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    tiles.drawLayer(ctx, 0, rect, camX, camY, dTide, g);
    tiles.drawAnimated(ctx, 0, rect, camX, camY, dTide, g, ms);
    const raining = wname === 'rain' || wname === 'storm';
    if (raining && !view.reducedMotion) tiles.drawRain(ctx, rect, camX, camY, g, ms);
    tiles.drawLayer(ctx, 1, rect, camX, camY, dTide, g);
    tiles.drawAnimated(ctx, 1, rect, camX, camY, dTide, g, ms);

    const ents = !view.entities ? EMPTY : Array.isArray(view.entities) ? view.entities : view.entities.list || EMPTY;
    const lhObj = lighthouseObject();
    const relit = !!(view.lighthouse && view.lighthouse.relit);
    lighthouseOpt.stage = view.lighthouse ? view.lighthouse.stage ?? 0 : 0;
    lighthouseOpt.lit = relit && lampsLit(g);
    entOpt.grade = g;
    entOpt.ms = ms;
    entOpt.tide = dTide;
    entOpt.shadow = shadowOf(g);
    entOpt.analysis = tiles.analysis();
    entOpt.flags = view.flags || null;
    entOpt.cond = view.cond || null;
    stats.sprites = sprites.draw(ctx, tiles.objects, ents, rect, camX, camY, entOpt);

    tiles.drawLayer(ctx, 2, rect, camX, camY, dTide, g);
    tiles.drawAnimated(ctx, 2, rect, camX, camY, dTide, g, ms);

    // ---- light pools and the beam
    lightOpt.minute = view.minute; lightOpt.weather = wname; lightOpt.tide = dTide; lightOpt.indoor = indoor;
    const world = view.world || (view.flags ? FLAGS_WORLD(view.flags) : NO_WORLD);
    lightSources(map, world, lightOpt);
    allLights.length = 0;
    for (let i = 0; i < lightBuf.length; i++) allLights.push(lightBuf[i]);
    if (view.lantern && view.player && g.lamp > 0.2) {
      lantern.px = view.player.px + 8; lantern.py = view.player.py + 6;
      lantern.intensity = Math.min(1, g.lamp + 0.2);
      allLights.push(lantern);
    }
    viewRect.x = camX; viewRect.y = camY; viewRect.w = rect.w; viewRect.h = rect.h;
    selectLights(allLights, viewRect, { lowPower: !!view.lowPower, out: chosen });
    stats.lights = lights.drawPools(ctx, chosen, rect, camX, camY, g, ms, glowScaleAt);
    if (lighthouseOpt.lit && lhObj) {
      beamOrigin.x = lhObj.x * 16 + 16;
      beamOrigin.y = lhObj.sortY - lhObj.h + 9;
      lights.drawBeam(ctx, beamOrigin, beamAngle(ms, view.lighthouse.relitAt ?? -Infinity), rect, camX, camY, Math.min(1, g.lamp));
    }

    // ---- weather
    weatherOpt.weather = wname; weatherOpt.grade = g; weatherOpt.zones = zones; weatherOpt.rect = rect;
    weatherOpt.reducedMotion = !!view.reducedMotion; weatherOpt.clearVisuals = !!view.clearVisuals; weatherOpt.lowPower = !!view.lowPower;
    weather.update(weatherOpt);
    fx.update(dt);
    if (wname === 'fog' && !view.clearVisuals) {
      if (view.player) { focusPt.x = rect.x + view.player.px + 8 - camX; focusPt.y = rect.y + view.player.py + 8 - camY; }
      weather.drawFog(ctx, rect, camX, camY, g, ms, view.player ? focusPt : null);
    }
    fxCam.x = camX - rect.x; fxCam.y = camY - rect.y;
    fx.draw(ctx, { camera: fxCam });
    ctx.restore();

    // ---- the Skyband
    if (skyband) {
      skyOpt.minute = view.minute; skyOpt.weather = wname; skyOpt.grade = g; skyOpt.ms = ms; skyOpt.day = view.day ?? 1;
      skyOpt.tide = typeof view.tide === 'number' ? view.tide : view.tide === 'low' ? 0 : view.tide === 'high' ? 1 : 0.5;
      skyOpt.tideDial = view.tideDial !== false;
      skyOpt.comet = view.comet ?? 0;
      skyOpt.reducedMotion = !!view.reducedMotion;
      if (lhObj && view.player) {
        compass.dx = lhObj.x + 1 - view.player.x;
        compass.lit = lighthouseOpt.lit;
        skyOpt.compass = compass;
      } else skyOpt.compass = null;
      drawSkyband(ctx, SKY_RECT, skyOpt);
    }

    tiles.pump(budgetMs);
    const ts = tiles.stats();
    stats.ms = Math.round((nowMs() - t0) * 100) / 100;
    stats.drawImages = DRAW.images;
    stats.fills = DRAW.fills;
    stats.bakes = DRAW.bakes;
    stats.chunks = ts.size;
    stats.queued = ts.queued;
    stats.particles = fx.particleCount;
    stats.grade = g.id;
    stats.tide = dTide;
    return stats;
  }

  return {
    drawFrame,
    setMap,
    tiles,
    sprites,
    lights,
    weather,
    fx,
    invalidate: () => { tiles.invalidate(); shown = null; },
    stats: () => ({ ...stats, tiles: tiles.stats(), weather: weather.stats() }),
    zones: () => zones,
  };
}

const EMPTY = Object.freeze([]);
/** Pool radius scale by glowing tile id (render-side taste; the tileset's radius stays the default). */
const GLOW_SCALE = Object.freeze({ 'string-lights': 0.35, 'window': 1, 'mud-glow': 0.8 });
/** @type {WeakMap<object, object>} grade -> sun shadow (the same offsets the chunk bakes use) */
const shadows = new WeakMap();
function shadowOf(g) {
  let s = shadows.get(g);
  if (!s) { s = shadowFor(g.minute < 0 ? 720 : g.minute, g); shadows.set(g, s); }
  return s;
}
/** @type {WeakMap<object, object>} grade -> the next slot's grade */
const nexts = new WeakMap();
function nextGradeOf(g, weather, indoor) {
  let n = nexts.get(g);
  if (!n) { n = gradeFor((g.minute < 0 ? 0 : g.minute) + GRADE_STEP_MINUTES, weather, indoor); nexts.set(g, n); }
  return n;
}
const NO_WORLD = Object.freeze({ flags: Object.freeze({}) });
const SKY_RECT = Object.freeze({ x: 0, y: 0, w: VIEW_W, h: SKYBAND_H });
/** @type {WeakMap<object, object>} */
const flagWorlds = new WeakMap();
function FLAGS_WORLD(flags) {
  let w = flagWorlds.get(flags);
  if (!w) { w = { flags }; flagWorlds.set(flags, w); }
  return w;
}

/** @type {WeakMap<object, ReturnType<typeof createMapRenderer>>} default renderer per game context */
const perG = new WeakMap();

/**
 * Draws one overworld frame with the default renderer of `G` (created on first use).
 * @param {any} G
 * @param {RenderView} view
 * @returns {FrameStats}
 */
export function drawFrame(G, view) {
  const key = G && typeof G === 'object' ? G : DEFAULT_KEY;
  let r = perG.get(key);
  if (!r) { r = createMapRenderer(); perG.set(key, r); }
  return r.drawFrame(G, view);
}
const DEFAULT_KEY = {};

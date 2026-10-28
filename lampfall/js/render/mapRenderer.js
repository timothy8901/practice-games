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
 *  6. light pools (<= 16 dither discs: a multiply tint, then additive) and the lighthouse beam
 *  7. weather from `core/fx` (rain, snow, fireflies) and the fog banks (<= 35%)
 *  8. emote bubbles (HUD: never hidden by trees, eaves or weather)
 *  9. the Skyband across the top 40 px
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
import { getSprite, artDef, resolveArtId } from '../art/atlas.js';
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
 * Path view (the Read view) next state for the `pathView` setting (GDD-09 §6, LG-RN102). Hold:
 * shown exactly while the Read button is held. Toggle: a press flips it. Pure; the field scene
 * feeds it the Read button's press edge and held state each frame.
 * @param {'hold'|'toggle'|string|undefined} mode
 * @param {boolean} on       shown now
 * @param {{pressed?: boolean, held?: boolean}} read   the Read button this frame
 * @returns {boolean}
 */
export function pathViewNext(mode, on, read) {
  const r = read || {};
  if (mode === 'hold') return Boolean(r.held || r.pressed);
  return r.pressed ? !on : Boolean(on);
}

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
  /** lightSources inputs of the cached `lightBuf` (recomputed only when one changes, or every 30 frames) */
  const lsKey = { grade: '', tide: '', flags: undefined, world: undefined, worldFlags: undefined, map: null, age: 0 };
  const chosen = [];
  // x / y = -1: the Lantern is not a map cell, so no per-cell glow scale applies to it
  const lantern = { id: 'lantern', kind: 'lantern', x: -1, y: -1, px: 0, py: 0, radius: 44, color: null, intensity: 1 };
  const viewRect = { x: 0, y: 0, w: 0, h: 0 };
  const fxCam = { x: 0, y: 0 };
  const fxDrawOpt = { camera: fxCam };
  const focusPt = { x: 0, y: 0 };
  const beamOrigin = { x: 0, y: 0 };
  const shownBuf = { tide: 'mid', grade: null };
  let warmed = null;
  let lastTide = null, dissolveFrom = null, dissolveT0 = 0;
  let idleKey = -1;
  /** sprite and light-disc warm-up for a grade before the switch: [art, variant|null, frames][] */
  let warmList = null, warmFor = null, warmIdx = 0;
  const warmLights = [];
  const warmChosen = [];
  const warmLightOpt = { minute: 0, weather: 'clear', tide: 'mid', indoor: false, out: warmLights };

  function warmStep(grade, rect, camX, camY, ents, view, budget) {
    const t0 = nowMs();
    // rebuild when the grade differs or the last list for it already finished (warmList = null): a
    // finished list must not be resumed, or a grade that comes back after a bakeNow would crash here
    if (warmFor !== grade || !warmList) {
      warmFor = grade;
      warmIdx = 0;
      warmList = [];
      const seen = new Set();
      const add = (art, name, n, only = -1) => { const k = art + '|' + name + '|' + only; if (!seen.has(k)) { seen.add(k); warmList.push([art, name, n, only]); } };
      const x0 = camX - 48, x1 = camX + rect.w + 48, y0 = camY - 16, y1 = camY + rect.h + 96;
      for (const o of tiles.objects) {
        if (o.sortY < y0 || o.sortY - o.h > y1 || o.x * 16 + o.w < x0 || o.x * 16 > x1) continue;
        const d = artDef(o.art);
        // animated art warms every frame; still art (the lighthouse: frame = scaffold stage) only its own
        const still = !d.fps;
        const only = o.special === 'lighthouse' ? Math.max(0, Math.min(d.frames.length - 1, (view.lighthouse && view.lighthouse.stage) || 0)) : still ? 0 : -1;
        add(o.art, null, d.frames.length, only);
        if (o.litVariant || o.special === 'lighthouse') { if (d.variants && d.variants.lit) add(o.art, 'lit', d.variants.lit.length, only); }
        if (o.litArt) add(o.litArt, null, 1, 0);
      }
      for (const e of ents) {
        const id = e.artId && resolveArtId(e.artId);
        if (!id) continue;
        const d = artDef(id);
        const f = e.facing && e.facing !== 'down' && d.variants && d.variants[e.facing] ? e.facing : null;
        add(id, f, (f ? d.variants[f] : d.frames).length);
      }
    }
    while (warmIdx < warmList.length) {
      const [art, name, n, only] = warmList[warmIdx++];
      for (let f = only >= 0 ? only : 0; f < (only >= 0 ? only + 1 : n); f++) void getSprite(art, name ? { frame: f, name, grade } : { frame: f, grade }).canvas;
      if (nowMs() - t0 > budget) return;
    }
    // light discs for the new grade
    warmLightOpt.minute = view.minute; warmLightOpt.weather = view.weather || 'clear';
    warmLightOpt.tide = tideVariant(view.tide ?? 'mid'); warmLightOpt.indoor = !!map.indoor;
    lightSources(map, view.world || (view.flags ? FLAGS_WORLD(view.flags) : NO_WORLD), warmLightOpt);
    viewRect.x = camX; viewRect.y = camY; viewRect.w = rect.w; viewRect.h = rect.h;
    selectLights(warmLights, viewRect, { lowPower: !!view.lowPower, out: warmChosen });
    lights.warmPools(warmChosen, grade, glowScaleAt);
    warmed = grade;
    warmList = null;
  }

  /** per-pass timings of the last frame (ms) */
  const T = { choose: 0, ground: 0, detail: 0, sprites: 0, lights: 0, weather: 0, sky: 0, pump: 0 };
  const stats = { t: T, ms: 0, drawImages: 0, fills: 0, bakes: 0, chunks: 0, queued: 0, sprites: 0, lights: 0, particles: 0, grade: '', tide: '' };
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
    idleKey = -1;
    warmFor = null; warmList = null; warmed = null;
    lsKey.map = null;
    lastTide = null; dissolveFrom = null;
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
    const indoor = !!map.indoor;
    const wname = indoor ? 'clear' : view.weather || 'clear';
    const grade = gradeFor(view.minute, wname, indoor);
    const tide = tideVariant(view.tide ?? 'mid');
    if (view.flags !== lastFlags || view.tier !== lastTier || view.roof !== lastRoof) {
      lastFlags = view.flags; lastTier = view.tier; lastRoof = view.roof;
      tiles.setBakeContext({ flags: view.flags || null, tier: view.tier, roof: view.roof, cond: view.cond || null });
      shown = null;
      idleKey = -1;
    }

    // ---- choose the chunk set to show: the desired one once its chunks are baked and its sprites
    // and light discs are warm; until then the last complete set keeps showing (no patchwork frame)
    let dTide = tide, dGrade = grade;
    const ents0 = !view.entities ? EMPTY : Array.isArray(view.entities) ? view.entities : view.entities.list || EMPTY;
    const same = shown && shown.grade === grade && shown.tide === tide;
    if (!same) {
      const ready = tiles.missing(rect, camX, camY, tide, grade) === 0;
      if (!shown || !shown.grade) {
        if (!ready) tiles.bakeNow(rect, camX, camY, tide, grade);
        warmed = grade;
      } else if (ready && warmed === grade) {
        // switch
      } else if (tiles.missing(rect, camX, camY, shown.tide, shown.grade) === 0) {
        dTide = shown.tide; dGrade = shown.grade;
        tiles.want([[tide, grade], [shown.tide, shown.grade]]);
        if (!ready) tiles.request(rect, camX, camY, tide, grade);
        else warmStep(grade, rect, camX, camY, ents0, view, budgetMs);
      } else {
        tiles.bakeNow(rect, camX, camY, tide, grade);
        warmed = grade;
      }
    } else if (tiles.queueLength() === 0) {
      // idle: keep the ring warm, then pre-bake the next grade slot (only when the view moved to a
      // new chunk or the key changed, so a still frame allocates nothing)
      const ck = (Math.floor(camX / 128) * 4096 + Math.floor(camY / 128)) * 512 + gradeIndex(grade) * 3 + (tide === 'low' ? 0 : tide === 'high' ? 2 : 1);
      if (ck !== idleKey) {
        idleKey = ck;
        const next = nextGradeOf(grade, wname, indoor);
        tiles.want([[tide, grade], [tide, next]]);
        tiles.request(rect, camX, camY, tide, grade);
        if (!indoor) tiles.request(rect, camX, camY, tide, next, { ring: false });
      }
    }
    shownBuf.tide = dTide; shownBuf.grade = dGrade;
    shown = shownBuf;
    const g = dGrade;

    T.choose = nowMs() - t0; let tm = nowMs();
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
    // the tide dissolve: when the shown tide changes, the old waterline crumbles away over 1 s
    if (dTide !== lastTide) {
      if (lastTide !== null && !view.reducedMotion) { dissolveFrom = lastTide; dissolveT0 = ms; }
      lastTide = dTide;
    }
    if (dissolveFrom !== null) {
      const k = 1 - (ms - dissolveT0) / DISSOLVE_MS;
      if (k <= 0 || dissolveFrom === dTide) dissolveFrom = null;
      else tiles.drawDissolve(ctx, 0, rect, camX, camY, dissolveFrom, g, k);
    }
    const raining = wname === 'rain' || wname === 'storm';
    if (raining && !view.reducedMotion) tiles.drawRain(ctx, rect, camX, camY, g, ms);
    T.ground = nowMs() - tm; tm = nowMs();
    tiles.drawLayer(ctx, 1, rect, camX, camY, dTide, g);
    tiles.drawAnimated(ctx, 1, rect, camX, camY, dTide, g, ms);

    const ents = ents0;
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
    T.detail = nowMs() - tm; tm = nowMs();
    stats.sprites = sprites.draw(ctx, tiles.objects, ents, rect, camX, camY, entOpt);
    T.sprites = nowMs() - tm; tm = nowMs();

    tiles.drawLayer(ctx, 2, rect, camX, camY, dTide, g);
    tiles.drawAnimated(ctx, 2, rect, camX, camY, dTide, g, ms);

    // ---- light pools and the beam
    const world = view.world || (view.flags ? FLAGS_WORLD(view.flags) : NO_WORLD);
    // the sources only change with the grade slot, the tide, the flags or the map: recompute then (a
    // world whose flags mutate in place is re-read every 30 frames), so a still frame allocates nothing
    if (lsKey.grade !== grade.id || lsKey.tide !== dTide || lsKey.flags !== view.flags || lsKey.world !== world
      || lsKey.worldFlags !== world.flags || lsKey.map !== map || ++lsKey.age >= 30) {
      lsKey.grade = grade.id; lsKey.tide = dTide; lsKey.flags = view.flags; lsKey.world = world;
      lsKey.worldFlags = world.flags; lsKey.map = map; lsKey.age = 0;
      lightOpt.minute = view.minute; lightOpt.weather = wname; lightOpt.tide = dTide; lightOpt.indoor = indoor;
      lightSources(map, world, lightOpt);
    }
    // filled by index (setting length = 0 would drop the backing store and re-grow it every frame)
    let nl = 0;
    for (let i = 0; i < lightBuf.length; i++) allLights[nl++] = lightBuf[i];
    if (view.lantern && view.player && g.lamp > 0.2) {
      lantern.px = view.player.px + 8; lantern.py = view.player.py + 6;
      lantern.intensity = Math.min(1, g.lamp + 0.2);
      allLights[nl++] = lantern;
    }
    if (allLights.length !== nl) allLights.length = nl;
    viewRect.x = camX; viewRect.y = camY; viewRect.w = rect.w; viewRect.h = rect.h;
    selectLights(allLights, viewRect, { lowPower: !!view.lowPower, out: chosen });
    lights.drawPools(ctx, chosen, rect, camX, camY, g, ms, glowScaleAt);
    stats.lights = chosen.length;
    if ((wname === 'rain' || wname === 'storm') && !view.reducedMotion) lights.drawWetStreaks(ctx, chosen, rect, camX, camY, ms);
    if (lighthouseOpt.lit && lhObj) {
      beamOrigin.x = lhObj.x * 16 + 16;
      beamOrigin.y = lhObj.sortY - lhObj.h + 9;
      lights.drawBeam(ctx, beamOrigin, beamAngle(ms, view.lighthouse.relitAt ?? -Infinity), rect, camX, camY, Math.min(1, g.lamp));
    }

    T.lights = nowMs() - tm; tm = nowMs();
    // ---- weather
    weatherOpt.weather = wname; weatherOpt.grade = g; weatherOpt.zones = zones; weatherOpt.rect = rect;
    weatherOpt.reducedMotion = !!view.reducedMotion; weatherOpt.clearVisuals = indoor || !!view.clearVisuals; weatherOpt.lowPower = !!view.lowPower;
    weather.update(weatherOpt);
    fx.update(dt);
    if (wname === 'fog' && !view.clearVisuals) {
      if (view.player) { focusPt.x = rect.x + view.player.px + 8 - camX; focusPt.y = rect.y + view.player.py + 8 - camY; }
      weather.drawFog(ctx, rect, camX, camY, g, ms, view.player ? focusPt : null);
    }
    fxCam.x = camX - rect.x; fxCam.y = camY - rect.y;
    fx.draw(ctx, fxDrawOpt);
    // emote bubbles are HUD: above trees, eaves, light pools and weather, never hidden by the sort
    sprites.drawEmotes(ctx);
    ctx.restore();

    T.weather = nowMs() - tm; tm = nowMs();
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

    T.sky = nowMs() - tm; tm = nowMs();
    tiles.pump(budgetMs);
    T.pump = nowMs() - tm;
    stats.ms = Math.round((nowMs() - t0) * 100) / 100;
    stats.drawImages = DRAW.images;
    stats.fills = DRAW.fills;
    stats.bakes = DRAW.bakes;
    stats.chunks = tiles.cache.size();
    stats.queued = tiles.queueLength();
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
    invalidate: () => { tiles.invalidate(); shown = null; idleKey = -1; warmFor = null; warmList = null; lsKey.map = null; },
    stats: () => ({ ...stats, tiles: tiles.stats(), weather: weather.stats() }),
    zones: () => zones,
  };
}

const EMPTY = Object.freeze([]);
/** Length of the tide dissolve (§12). */
export const DISSOLVE_MS = 1000;
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

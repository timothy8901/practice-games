/**
 * Overworld. [SCN-WORLD] DAY-1 STUB
 *
 * A flat 40x24 test map of coloured 16px tiles, a player square moving on the grid through
 * `core/input`, a camera clamped to the map, the HUD line (clock text and tide from `G.clock`) and
 * `menu` -> pause menu. The world clock advances only here (and in fishing) via `clockSys.tick`, so
 * time is frozen in every other scene by construction. The real scene replaces this file wholesale
 * (`world/tilemap`, `world/player`, `render/mapRenderer`, `ui/hud`).
 * @module scenes/overworld
 */
import { drawText } from '../core/font.js';
import { makeRng } from '../core/rng.js';
import * as clockSys from '../_shims/systems/clockSys.js'; // INTEGRATOR: '../systems/clockSys.js'
import * as stats from '../systems/stats.js';
import { TILE, NATIVE_W, NATIVE_H } from '../config.js';
import { drawStrip, KIT } from './day1kit.js';

/** Test map size in tiles. */
export const MAP_W = 40;
export const MAP_H = 24;

/** Spawn tile of the test map (the crossroads of the two path bands). */
export const SPAWN = Object.freeze({ x: 20, y: 12 });

/** Map id shown while the player has no map yet (`player.mapId === ''`). // [GDD: arrival map id] */
export const STUB_MAP_ID = 'stub-map';

/** Tile kinds of the test map. `solid` blocks the player. */
export const TEST_TILES = Object.freeze([
  Object.freeze({ id: 'grass-a', color: '#4f8a4b', solid: false }),
  Object.freeze({ id: 'grass-b', color: '#5a9a52', solid: false }),
  Object.freeze({ id: 'path', color: '#b9a06a', solid: false }),
  Object.freeze({ id: 'sand', color: '#d9c78a', solid: false }),
  Object.freeze({ id: 'water', color: '#3a6ea8', solid: true }),
  Object.freeze({ id: 'rock', color: '#6e6a66', solid: true }),
]);

const DIRS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });
const WALK_MS = 140;
const RUN_MS = 85;

/**
 * Builds the deterministic test map for a seed: grass with a path band, a beach and water at the
 * bottom, a few rocks. Pure.
 * @param {number|string} seed
 * @returns {{w: number, h: number, tiles: Uint8Array}} tile kind indexes into {@link TEST_TILES}
 */
export function buildTestMap(seed) {
  const rng = makeRng(seed).fork('stub-map');
  const tiles = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      let k = rng.chance(0.3) ? 1 : 0;
      if (y === 12 || x === 20) k = 2;
      if (y >= MAP_H - 4) k = 3;
      if (y >= MAP_H - 2 || (y === MAP_H - 3 && rng.chance(0.4))) k = 4;
      if (k < 2 && rng.chance(0.04) && !(x === 20 && y === 12)) k = 5;
      tiles[y * MAP_W + x] = k;
    }
  }
  return { w: MAP_W, h: MAP_H, tiles };
}

/**
 * @param {{w: number, h: number, tiles: Uint8Array}} map
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function passable(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  return !TEST_TILES[map.tiles[y * map.w + x]].solid;
}

/**
 * Camera top-left in pixels so the player stays centred, clamped to the map.
 * @param {number} px player pixel x
 * @param {number} py player pixel y
 * @param {{w: number, h: number}} map
 * @returns {{x: number, y: number}}
 */
export function cameraFor(px, py, map) {
  const maxX = Math.max(0, map.w * TILE - NATIVE_W);
  const maxY = Math.max(0, map.h * TILE - NATIVE_H);
  return {
    x: Math.round(Math.min(maxX, Math.max(0, px + TILE / 2 - NATIVE_W / 2))),
    y: Math.round(Math.min(maxY, Math.max(0, py + TILE / 2 - NATIVE_H / 2))),
  };
}

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createOverworldScene(G) {
  let map = buildTestMap(0);
  let from = { x: 0, y: 0 };
  let to = { x: 0, y: 0 };
  let moveT = 1;
  let moveMs = WALK_MS;
  let cam = { x: 0, y: 0 };

  function syncFromWorld() {
    const p = G.world.player;
    from = { x: p.x, y: p.y };
    to = { x: p.x, y: p.y };
    moveT = 1;
  }

  function tryStep(dir, run) {
    const [dx, dy] = DIRS[dir];
    const nx = to.x + dx;
    const ny = to.y + dy;
    G.store.tx('player:face', (w) => { w.player.facing = dir; });
    if (!passable(map, nx, ny)) return false;
    from = { x: to.x, y: to.y };
    to = { x: nx, y: ny };
    moveT = 0;
    moveMs = run ? RUN_MS : WALK_MS;
    G.store.tx('player:step', (w) => {
      w.player.x = nx;
      w.player.y = ny;
      w.stats.steps += 1;
    });
    G.bus.emit('player:step', { x: nx, y: ny, facing: dir });
    return true;
  }

  function hudLine() {
    const c = G.clock;
    const tidePct = Math.round(c.tide * 100);
    return `${c.formatTime()}  ${c.dateLabel()}  tide ${tidePct}% ${c.tideState}`;
  }

  return {
    name: 'overworld',
    opaque: true,
    enter() {
      map = buildTestMap(G.world.run.seed);
      // No map yet (fresh lease) or standing in a wall: spawn at the crossroads. // [GDD: arrival tile]
      const p0 = G.world.player;
      if (p0.mapId === '' && p0.x === 0 && p0.y === 0 || !passable(map, p0.x, p0.y)) {
        G.store.tx('player:spawn', (w) => { w.player.x = SPAWN.x; w.player.y = SPAWN.y; });
      }
      syncFromWorld();
      G.bus.emit('map:enter', { mapId: G.world.player.mapId });
    },
    exit() { G.bus.emit('map:exit', { mapId: G.world.player.mapId }); },
    pause() {},
    resume() { syncFromWorld(); },
    update(dt) {
      G.store.tx('clock:tick', (w) => {
        clockSys.tick(w, G.clock, dt);   // the world clock advances only here and in fishing
        stats.addPlayMs(w, dt);          // simulated step, so paused menus do not count
      });
      if (moveT < 1) moveT = Math.min(1, moveT + dt / moveMs);
      const p = G.world.player;
      if (moveT >= 1 && (p.x !== to.x || p.y !== to.y)) syncFromWorld(); // moved by a debug warp
    },
    handleInput(input) {
      if (input.pressed('menu')) { G.push('menu'); return; }
      if (moveT < 1) return;
      const axis = input.axis();
      const dir = axis.y < 0 ? 'up' : axis.y > 0 ? 'down' : axis.x < 0 ? 'left' : axis.x > 0 ? 'right' : null;
      if (dir) tryStep(dir, input.held('run'));
    },
    draw(ctx) {
      const px = (from.x + (to.x - from.x) * moveT) * TILE;
      const py = (from.y + (to.y - from.y) * moveT) * TILE;
      cam = cameraFor(px, py, map);
      ctx.fillStyle = KIT.night;
      ctx.fillRect(0, 0, NATIVE_W, NATIVE_H);
      const x0 = Math.floor(cam.x / TILE);
      const y0 = Math.floor(cam.y / TILE);
      const x1 = Math.min(map.w - 1, x0 + Math.ceil(NATIVE_W / TILE));
      const y1 = Math.min(map.h - 1, y0 + Math.ceil(NATIVE_H / TILE));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          ctx.fillStyle = TEST_TILES[map.tiles[ty * map.w + tx]].color;
          ctx.fillRect(tx * TILE - cam.x, ty * TILE - cam.y, TILE, TILE);
        }
      }
      const sx = Math.round(px - cam.x);
      const sy = Math.round(py - cam.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(sx + 2, sy + 12, 12, 4);
      ctx.fillStyle = KIT.wax;
      ctx.fillRect(sx + 3, sy + 1, 10, 13);
      ctx.fillStyle = KIT.paper;
      const [fx, fy] = DIRS[G.world.player.facing] ?? DIRS.down;
      ctx.fillRect(sx + 7 + fx * 4, sy + 6 + fy * 4, 2, 2);
      drawStrip(ctx, hudLine(), 2, 2);
      drawStrip(ctx, `${G.world.run.seedCode}  ${G.world.player.mapId || STUB_MAP_ID} ${to.x},${to.y}`, 2, 16, { font: 'small' });
      drawText(ctx, 'arrows: move  shift: run  esc: menu', 478, 260, { color: KIT.paper, align: 'right', font: 'small', shadow: true });
    },
    debugText: () => hudLine(),
    isBusy: () => moveT < 1,
  };
}

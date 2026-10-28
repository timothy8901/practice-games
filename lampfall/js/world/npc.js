/**
 * NPC entity driver (ARCHITECTURE §4.4): schedule placement -> path -> pose. Pure: no DOM, no data
 * imports, no `Math.random`.
 *
 * `systems/schedule.whereIs(npc, world, data)` (SYS-TOWN) says where a neighbour should be; this
 * module turns that {@link Placement} into movement of the NPC's entity on the current map:
 *
 *  - **Arrival rule** ({@link arrivalPoint}): on map entry an NPC is spawned *at* its target, or at
 *    the map's nearest door / edge warp when the placement began within the last
 *    {@link ARRIVAL_WINDOW_MIN} in-game minutes, so arrivals are visible.
 *  - **Walking**: a 4-directional path from `world/pathing` (cached per `(map, from, to, tide
 *    variant)` when the caller passes a cache), re-planned when the target or the tide variant
 *    changes. Collision goes through `EntityManager.tryMove`, so it is checked once at step start.
 *  - **Catch-up cap**: a path longer than `catchUpTiles` (`tuning.npcCatchUpTiles` [GDD]) jumps
 *    the NPC forward along it so only the last `catchUpTiles` steps are walked.
 *  - **Poses**: `'wander'` drifts one tile at a time inside `wanderR` of the target, pausing between, with draws from the
 *    cosmetic `npc:<id>` rng; `'path'` walks a looped route the caller resolves from
 *    `data/schedules` named paths; every other pose stands at the target facing `placement.facing`.
 *  - A tile held by a solid entity (usually the player) makes the NPC wait; after
 *    {@link NPC_DEFAULTS}`.giveUpMs` blocked on its goal it settles next to it, facing it.
 *
 * Off-map NPCs are not simulated (§4.4): a placement on another map returns `'offmap'` and the
 * caller removes the entity. The driver never advances `t`: the scene calls `ents.tickAll(ms)` and
 * then each driver's `tick` (a moving entity reports `'walking'`).
 *
 * Lane: WORLD-ENT.
 * @module world/npc
 */

import { DIRS, DX, DY, dirTo } from './entities.js';
import { findPath, findPathCached } from './pathing.js';
import { tideVariant } from './tide.js';
import { MINUTES_PER_DAY } from '../core/time.js';

/** @typedef {import('./entities.js').Entity} Entity */
/** @typedef {import('./entities.js').EntityManager} EntityManager */
/** @typedef {import('./entities.js').Dir} Dir */
/** @typedef {import('./pathing.js').PathCache} PathCache */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {import('../core/time.js').TideState} TideState */

/**
 * Where a schedule puts an NPC (§4.4 `whereIs` result).
 * @typedef {Object} Placement
 * @property {string} mapId
 * @property {number} x
 * @property {number} y
 * @property {Dir|string} [facing]
 * @property {'stand'|'wander'|'sit'|'sleep'|'fish'|'shop'|'sweep'|'path'|string} [pose='stand']
 * @property {string|null} [pathId]   named route id; the caller resolves it into `ctx.route`
 * @property {number} [since]         minute of day the entry began
 * @property {number} [wanderR]       tiles from (x, y) a wandering NPC may drift
 */

/** Minutes after a placement begins during which an entering NPC walks in from a door / edge (§4.4). */
export const ARRIVAL_WINDOW_MIN = 3;

/** Engine-feel defaults; `data/tuning.js` overrides them through `opts.tuning`. [GDD] */
export const NPC_DEFAULTS = Object.freeze({
  catchUpTiles: 12,     // tuning.npcCatchUpTiles
  wanderR: 2,
  pauseMin: 1200,       // wander pause range (ms)
  pauseMax: 4000,
  repathMs: 600,        // retry interval after "no path"
  giveUpMs: 1500,       // blocked this long on the goal tile -> settle next to it
  maxLen: 96,           // longest path searched
});

/**
 * Spawn tile for an NPC entering the map (the §4.4 arrival rule).
 * @param {Placement} placement
 * @param {{id: string, w: number, h: number, warps: readonly {x: number, y: number, w?: number, h?: number, kind: string}[]}} map
 * @param {number} minute   current minute of day (`selectors.minuteOfDay(world)`)
 * @param {{windowMin?: number}} [opts]
 * @returns {{x: number, y: number, facing: Dir, arriving: boolean}|null}   null when the placement is on another map
 */
export function arrivalPoint(placement, map, minute, opts) {
  if (!placement || placement.mapId !== map.id) return null;
  const facing = isDir(placement.facing) ? placement.facing : 'down';
  const windowMin = opts && Number.isFinite(opts.windowMin) ? opts.windowMin : ARRIVAL_WINDOW_MIN;
  const since = placement.since;
  if (Number.isFinite(since) && Number.isFinite(minute)) {
    const age = (((minute - since) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (age < windowMin) {
      let best = null, bestD = Infinity;
      for (const wp of map.warps || []) {
        if (wp.kind !== 'door' && wp.kind !== 'edge') continue;
        // nearest cell of the warp rect to the target
        const cx = clamp(placement.x, wp.x, wp.x + (wp.w ?? 1) - 1);
        const cy = clamp(placement.y, wp.y, wp.y + (wp.h ?? 1) - 1);
        const d = Math.abs(cx - placement.x) + Math.abs(cy - placement.y);
        if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
      }
      if (best && bestD > 0) {
        const f = dirTo(placement.x - best.x, placement.y - best.y) || facing;
        return { x: best.x, y: best.y, facing: f, arriving: true };
      }
    }
  }
  return { x: placement.x, y: placement.y, facing, arriving: false };
}

/**
 * @typedef {Object} NpcTickCtx
 * @property {{id: string, w: number, h: number, passable: Function}} map   RuntimeMap
 * @property {EntityManager} ents
 * @property {TideState|number} tideState
 * @property {PathCache} [cache]      shared path cache (§4.4: one per session / store.derived)
 * @property {Rng} [rng]              the cosmetic `npc:<id>` stream (wander); without it wandering NPCs stand
 * @property {readonly {x: number, y: number}[]} [route]   resolved named path for pose `'path'`
 */

/**
 * @typedef {'idle'|'walking'|'arrived'|'blocked'|'offmap'} NpcStatus
 *   `'arrived'` is reported once, on the tick the NPC settles at its target.
 */

/**
 * @typedef {Object} NpcDriver
 * @property {Entity} ent
 * @property {Placement|null} placement
 * @property {string} pose               current pose (`'walk'` while travelling, except along a `'path'` route)
 * @property {NpcStatus} status          last tick's result
 * @property {(placement: Placement|null) => void} setPlacement   new schedule target (no-op when unchanged)
 * @property {(ms: number, ctx: NpcTickCtx) => NpcStatus} tick
 * @property {() => {x: number, y: number}|null} goal   the tile currently walked to (REUSED record)
 */

/**
 * Creates a driver for one NPC entity (already added to the map's EntityManager).
 * @param {Entity} ent
 * @param {{tuning?: Partial<typeof NPC_DEFAULTS>}} [opts]
 * @returns {NpcDriver}
 */
export function createNpcDriver(ent, opts = {}) {
  const tun = opts.tuning || {};
  const T = (k) => (tun[k] === undefined ? NPC_DEFAULTS[k] : tun[k]);

  /** @type {Placement|null} */
  let placement = null;
  let gx = 0, gy = 0, hasGoal = false;
  /** @type {readonly number[]|null} */
  let path = null;
  let pathIdx = 0, pathGx = -1, pathGy = -1, pathVariant = '';
  let pauseMs = 0;         // wander pause countdown
  let repathMs = 0;        // retry countdown after "no path"
  let blockedMs = 0;
  let settled = false;     // reported 'arrived' for the current goal
  let reached = false;     // reached the placement since it was set (wander reports 'arrived' once)
  let routeIdx = 0;
  /** the real goal while settled beside it because someone stood on it (FE-04); retaken once free */
  let displaced = null;
  /** blocked mid-route past giveUpMs: the next plan routes round actors too (FE-04) */
  let avoidActors = false;
  /** @type {NpcStatus} */
  let status = 'idle';
  let pose = 'stand';
  const goalPt = { x: 0, y: 0 };

  function clearPath() { path = null; pathIdx = 0; pathGx = pathGy = -1; ent.path = null; }

  function setGoal(x, y) {
    if (hasGoal && gx === x && gy === y) return;
    gx = x; gy = y; hasGoal = true; settled = false; blockedMs = 0; avoidActors = false;
    clearPath();
  }

  /** @param {Placement|null} pl */
  function setPlacement(pl) {
    if (pl && placement && pl.mapId === placement.mapId && pl.x === placement.x && pl.y === placement.y
      && pl.pose === placement.pose && pl.facing === placement.facing && pl.pathId === placement.pathId) return;
    placement = pl || null;
    routeIdx = 0;
    displaced = null;
    pauseMs = 0;
    repathMs = 0;
    reached = false;
    if (placement) setGoal(placement.x, placement.y);
    else { hasGoal = false; clearPath(); }
  }

  /**
   * Picks the next wander tile: one step from where the NPC stands, kept inside `wanderR`
   * (Manhattan) of the placement, so every tile it ever stands on is in range. One draw picks the
   * first direction tried; the others follow clockwise (deterministic).
   */
  function pickWander(ctx) {
    const r = placement.wanderR ?? T('wanderR');
    const d0 = ctx.rng.int(0, 3);
    for (let k = 0; k < 4; k++) {
      const d = (d0 + k) & 3;
      const x = ent.x + DX[d], y = ent.y + DY[d];
      if (Math.abs(x - placement.x) + Math.abs(y - placement.y) > r) continue;
      if (!ctx.map.passable(x, y, ctx.tideState, 'npc') || ctx.ents.solidAt(x, y)) continue;
      return setGoal(x, y);
    }
  }

  /** @param {NpcTickCtx} ctx @returns {boolean} whether a usable path is held */
  function plan(ctx) {
    const v = tideVariant(ctx.tideState);
    if (path && pathGx === gx && pathGy === gy && pathVariant === v) return true;
    const from = { x: ent.x, y: ent.y }, to = { x: gx, y: gy };
    const po = { tideState: ctx.tideState, mover: 'npc', maxLen: T('maxLen') };
    path = ctx.cache ? findPathCached(ctx.cache, ctx.map, from, to, po) : findPath(ctx.map, from, to, po);
    // Tile-only cached routes can cross benches and other solid field props. Re-route around
    // those props; actors still use the existing wait/settle rules, including an occupied goal.
    const blocked = (x, y) => (x !== gx || y !== gy) && ctx.ents.near(x, y, 0)
      .some((e) => e.solid && e !== ent && (avoidActors || (e.kind !== 'npc' && e.kind !== 'player')));
    if (path) for (let i = 0; i < path.length; i += 2) {
      if (blocked(path[i], path[i + 1])) { path = findPath(ctx.map, from, to, { ...po, blocked }) || (avoidActors ? path : null); break; }
    }
    pathIdx = 0; pathGx = gx; pathGy = gy; pathVariant = v;
    ent.path = /** @type {number[]|null} */ (path);
    if (!path) return false;
    // catch-up cap: jump forward so only the last `catchUpTiles` steps are walked
    const steps = path.length >> 1, cap = T('catchUpTiles');
    if (steps > cap) {
      const k = steps - cap - 1;            // index of the step to land on
      const jx = path[k * 2], jy = path[k * 2 + 1];
      if (!ctx.ents.solidAt(jx, jy)) {
        ctx.ents.teleport(ent, jx, jy);
        pathIdx = k + 1;
      }
    }
    return true;
  }

  function face() {
    if (placement && isDir(placement.facing)) ent.facing = placement.facing;
  }

  /** @param {number} ms @param {NpcTickCtx} ctx @returns {NpcStatus} */
  function tick(ms, ctx) {
    if (!placement || !hasGoal) return (status = 'idle');
    if (placement.mapId !== ctx.map.id) return (status = 'offmap');
    if (ent.moving) return (status = 'walking');
    const p = placement.pose || 'stand';

    if (ent.x === gx && ent.y === gy) {
      clearPath();
      if (p === 'path' && ctx.route && ctx.route.length > 0) {
        pose = 'path';
        const pt = ctx.route[routeIdx % ctx.route.length];
        routeIdx = (routeIdx + 1) % ctx.route.length;
        setGoal(pt.x, pt.y);
        return (status = 'walking');
      }
      if (p === 'wander' && ctx.rng) {
        pose = 'wander';
        if (!settled) {
          settled = true;
          pauseMs = ctx.rng.int(T('pauseMin'), T('pauseMax'));
          if (!reached) { reached = true; return (status = 'arrived'); }
          return (status = 'idle');
        }
        pauseMs -= ms;
        if (pauseMs > 0) return (status = 'idle');
        settled = false;
        pickWander(ctx);
        return (status = 'idle');
      }
      pose = p;
      // settled beside an occupied goal (FE-04: Dimity on the door step after the player stood at her
      // post): walk back to it as soon as it is free, rather than idling in the way all evening
      if (displaced && !ctx.ents.solidAt(displaced.x, displaced.y)) {
        const d = displaced;
        displaced = null;
        setGoal(d.x, d.y);
        return (status = 'walking');
      }
      if (!settled) {
        settled = true;
        face();
        if (!reached) { reached = true; return (status = 'arrived'); }
      }
      return (status = 'idle');
    }

    pose = p === 'path' ? 'path' : 'walk';
    if (repathMs > 0 && !path) { repathMs -= ms; return (status = 'blocked'); }
    if (!plan(ctx)) { repathMs = T('repathMs'); return (status = 'blocked'); }
    if (pathIdx >= path.length >> 1) { clearPath(); return (status = 'walking'); }
    const nx = path[pathIdx * 2], ny = path[pathIdx * 2 + 1];
    const dir = Math.abs(nx - ent.x) + Math.abs(ny - ent.y) === 1 ? dirTo(nx - ent.x, ny - ent.y) : null;
    if (dir === null) { clearPath(); return (status = 'walking'); }   // displaced (teleport, cutscene): re-plan next tick
    if (ctx.ents.tryMove(ent, dir, { map: ctx.map, tideState: ctx.tideState, mover: 'npc' })) {
      pathIdx++;
      blockedMs = 0;
      return (status = 'walking');
    }
    blockedMs += ms;
    if (nx === gx && ny === gy && blockedMs >= T('giveUpMs')) {
      // a walking loop goes on to its next point rather than parking on the way (FE-04: Wick on the
      // cottage gate while someone stood at the porch post)
      if (p === 'path' && ctx.route && ctx.route.length > 1) {
        const pt = ctx.route[routeIdx % ctx.route.length];
        routeIdx = (routeIdx + 1) % ctx.route.length;
        setGoal(pt.x, pt.y);
        return (status = 'walking');
      }
      // someone stands on the goal: settle here, facing it (and take the goal back once it is free)
      displaced = { x: gx, y: gy };
      setGoal(ent.x, ent.y);
      ent.facing = dir;
      settled = true;
      pose = p;
      if (reached) return (status = 'idle');
      reached = true;
      return (status = 'arrived');
    }
    // an obstacle mid-route: re-plan round it (actors included), else keep waiting on this path
    if (blockedMs >= T('giveUpMs')) { clearPath(); avoidActors = true; blockedMs = 0; }
    return (status = 'blocked');
  }

  return {
    ent,
    get placement() { return placement; },
    get pose() { return pose; },
    get status() { return status; },
    setPlacement,
    tick,
    goal() {
      if (!hasGoal) return null;
      goalPt.x = gx; goalPt.y = gy;
      return goalPt;
    },
  };
}

/** @param {unknown} f @returns {f is Dir} */
function isDir(f) {
  return typeof f === 'string' && DIRS.includes(/** @type {Dir} */ (f));
}

/** @param {number} v @param {number} lo @param {number} hi */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

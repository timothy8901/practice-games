/**
 * Roamers: visible wild creatures (ARCHITECTURE §4.6). A pure spawn / wander / flee / despawn model
 * driven by a seeded `Rng` (the stateful `enc:<mapId>` fork) and encounter tables (§14.11). The
 * renderer draws roamers through their entity, the encounter system turns a touched roamer into an
 * {@link EncounterResult}, and the overworld scene applies the steps this module asks for through
 * `EntityManager.tryMove`, so collision and determinism stay in one place.
 *
 * Determinism: every random choice (row, level, tile, wander direction and pause) draws from the
 * `rng` passed in, in a fixed order, so the same seed, table, map and tide give the same roamers.
 *
 * Encounter rows may carry optional roamer hints, all data: `behaviour` ('flee' | 'approach' |
 * 'still' | 'wander'), `fleeR`, `approachR`, `ttlMs`, `catchable`. Defaults come from
 * {@link ROAMER_DEFAULTS}, which a caller may override per call (`opts.tuning`) with `data/tuning.js`
 * values [GDD].
 *
 * Lane: WORLD-ENT.
 * @module world/roamer
 */

import { createEntity, DIRS, DX, DY, STROLL_MS } from './entities.js';
import { evalCond as dslEvalCond } from '../script/cond.js';

/** @typedef {import('./entities.js').Dir} Dir */
/** @typedef {import('./entities.js').Entity} Entity */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {(x: number, y: number, tideState: TideState, mover: string) => boolean} Passable */

/**
 * @typedef {Object} EncounterRow
 * @property {string} species
 * @property {[number, number]} levels
 * @property {number} w
 * @property {boolean} [errant]
 * @property {object} [cond]            §6.4 Cond; `phase`, `tide`, `weather` are evaluated here, anything else through `ctx.evalCond`
 * @property {'flee'|'approach'|'still'|'wander'} [behaviour]
 * @property {number} [fleeR]  @property {number} [approachR]  @property {number} [ttlMs]
 * @property {boolean} [catchable]
 */

/**
 * @typedef {Object} Roamer
 * @property {string} id           `roamer:<tableId>:<seq>`
 * @property {string} speciesId
 * @property {number} level
 * @property {boolean} errant
 * @property {string} tableId
 * @property {boolean} catchable
 * @property {'flee'|'approach'|'still'|'wander'} behaviour
 * @property {number} fleeR          tiles (Manhattan) within which a 'flee' roamer runs
 * @property {number} approachR      tiles within which an 'approach' roamer closes in
 * @property {number} x  @property {number} y   current tile (mirrors the entity after each applied step)
 * @property {number} homeX  @property {number} homeY   spawn tile; wandering stays within `leash` of it
 * @property {Dir} facing
 * @property {'idle'|'wander'|'flee'|'approach'|'gone'} state
 * @property {number} waitMs         countdown until the next decision
 * @property {number} ageMs          time alive
 * @property {number} ttlMs          lifetime before a natural despawn
 * @property {number} leash
 * @property {string|null} despawnReason   'ttl' | 'far' | 'flooded' | 'caught' | 'manual' once `state === 'gone'`
 */

/** @typedef {{speciesId: string, level: number, errant: boolean, tableId: string}} EncounterResult */

/** Engine feel defaults; `data/tuning.js` may override them per call. [GDD] */
export const ROAMER_DEFAULTS = Object.freeze({
  cap: 8,               // §12: roamers <= 8 per map
  fleeR: 3,
  approachR: 4,
  ttlMs: 90_000,
  leash: 4,
  stepMs: STROLL_MS,    // ms a roamer step takes (matches the entity speed)
  pauseMin: 400,        // wander pause range
  pauseMax: 1600,
  wanderChance: 0.7,    // chance a decision becomes a step rather than another pause
  minPlayerDist: 6,     // never spawn closer than this (Manhattan) to the player
  despawnR: 24,         // despawn when farther than this from the player
  spawnTries: 24,       // rejection-sampling attempts per spawn
  spawnEveryMs: 2000,   // field: interval between spawn attempts
});

/**
 * Reads a tuning value from a partial override, falling back to {@link ROAMER_DEFAULTS}.
 * @param {Partial<typeof ROAMER_DEFAULTS>|undefined} tuning
 * @param {keyof typeof ROAMER_DEFAULTS} key
 * @returns {number}
 */
export function tuningValue(tuning, key) {
  const v = tuning ? tuning[key] : undefined;
  return v === undefined ? ROAMER_DEFAULTS[key] : v;
}

/**
 * Local check of the condition keys an encounter row commonly uses (`phase`, `tide`, `weather`,
 * `lowTide`); any other key defers to `ctx.evalCond`, else to the condition DSL (`script/cond.evalCond`)
 * when `ctx.world` is given, and fails closed when there is neither.
 * @param {object|undefined} cond
 * @param {{phase?: string, tideState?: TideState, weather?: string, world?: object, evalCond?: Function, data?: object}} ctx
 * @returns {boolean}
 */
export function rowCondHolds(cond, ctx) {
  if (cond == null || cond === true) return true;
  if (cond === false) return false;
  let local = true, other = false;
  for (const key in cond) {
    if (key === 'phase') local = local && Array.isArray(cond.phase) && cond.phase.indexOf(ctx.phase) !== -1;
    else if (key === 'tide') local = local && Array.isArray(cond.tide) && cond.tide.indexOf(ctx.tideState) !== -1;
    else if (key === 'weather') local = local && Array.isArray(cond.weather) && cond.weather.indexOf(ctx.weather) !== -1;
    else if (key === 'lowTide') local = local && (ctx.tideState === 'low') === Boolean(cond.lowTide);
    else other = true;
  }
  if (!local) return false;
  if (!other) return true;
  if (typeof ctx.evalCond === 'function') return Boolean(ctx.evalCond(ctx.world, cond, ctx));
  return ctx.world ? dslEvalCond(ctx.world, cond, ctx) : false;
}

/**
 * Rows of a table whose conditions hold. Allocates (called once per spawn attempt, not per tick).
 * @param {readonly EncounterRow[]} table
 * @param {Parameters<typeof rowCondHolds>[1]} ctx
 * @param {EncounterRow[]} [out]
 * @returns {EncounterRow[]}
 */
export function eligibleRows(table, ctx, out = []) {
  out.length = 0;
  for (let i = 0; i < table.length; i++) if (rowCondHolds(table[i].cond, ctx)) out.push(table[i]);
  return out;
}

/** reused weighted-entry buffer for {@link rollRow} */
const weightBuf = [];

/**
 * Weighted pick among rows (one draw). Returns null for an empty table or all-zero weights.
 * @param {Rng} rng
 * @param {readonly EncounterRow[]} rows
 * @returns {EncounterRow|null}
 */
export function rollRow(rng, rows) {
  if (rows.length === 0) return null;
  weightBuf.length = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const slot = weightBuf[i] || (weightBuf[i] = { w: 0, v: null });
    slot.w = rows[i].w; slot.v = rows[i];
  }
  return rng.weighted(weightBuf) ?? null;
}

/**
 * Level within the row's inclusive range (one draw).
 * @param {Rng} rng
 * @param {EncounterRow} row
 * @returns {number}
 */
export function rollLevel(rng, row) {
  const lo = row.levels[0], hi = row.levels[1];
  return lo === hi ? lo : rng.int(Math.min(lo, hi), Math.max(lo, hi));
}

/**
 * @typedef {Object} SpawnOpts
 * @property {string} [tableId='roamer']   encounter table id (goes into the roamer id and its EncounterResult)
 * @property {object} [spawnDef]     the map SpawnDef; its `area` restricts tiles (rect, or a class resolved through `map.spawnAt`)
 * @property {{x: number, y: number}|null} [player]
 * @property {(x: number, y: number) => boolean} [occupied]   tiles already holding an entity
 * @property {string} [phase]  @property {string} [weather]  @property {object} [world]  @property {Function} [evalCond]  @property {object} [data]
 * @property {number} [seq=0]        sequence number for the id
 * @property {Partial<typeof ROAMER_DEFAULTS>} [tuning]
 */

/**
 * Spawns one roamer: filters the table by conditions, rolls a row and level, then rejection-samples a
 * passable, unoccupied tile inside the spawn area away from the player.
 * @param {Rng} rng
 * @param {readonly EncounterRow[]} table
 * @param {{id: string, w: number, h: number, passable: Passable, spawnAt?: Function}} map
 * @param {TideState} tideState
 * @param {SpawnOpts} [opts]
 * @returns {Roamer|null}   null when no row or no tile qualifies (no draw is wasted on the tile search in that case beyond the tries)
 */
export function spawn(rng, table, map, tideState, opts = {}) {
  const tun = opts.tuning;
  const tableId = opts.tableId ?? 'roamer';
  const condCtx = { phase: opts.phase, tideState, weather: opts.weather, world: opts.world, evalCond: opts.evalCond, data: opts.data };
  const rows = eligibleRows(table, condCtx);
  const row = rollRow(rng, rows);
  if (!row) return null;
  const level = rollLevel(rng, row);

  const def = opts.spawnDef || null;
  const rect = def && def.area && typeof def.area === 'object' ? def.area : null;
  const ax = rect ? rect.x : 0, ay = rect ? rect.y : 0;
  const aw = rect ? rect.w : map.w, ah = rect ? rect.h : map.h;
  const px = opts.player ? opts.player.x : null, py = opts.player ? opts.player.y : null;
  let x = -1, y = -1;
  for (let i = 0, tries = tuningValue(tun, 'spawnTries'), minDist = tuningValue(tun, 'minPlayerDist'); i < tries; i++) {
    const cx = ax + rng.int(0, aw - 1), cy = ay + rng.int(0, ah - 1);
    if (cx < 0 || cy < 0 || cx >= map.w || cy >= map.h) continue;
    if (def && !rect && typeof map.spawnAt === 'function' && map.spawnAt(cx, cy) !== def) continue;
    if (!map.passable(cx, cy, tideState, 'roamer')) continue;
    if (opts.occupied && opts.occupied(cx, cy)) continue;
    if (px !== null && Math.abs(cx - px) + Math.abs(cy - py) < minDist) continue;
    x = cx; y = cy;
    break;
  }
  if (x < 0) return null;

  return {
    id: `roamer:${tableId}:${opts.seq ?? 0}`,
    speciesId: row.species,
    level,
    errant: row.errant === true,
    tableId,
    catchable: row.catchable === true,
    behaviour: row.behaviour || 'flee',
    fleeR: row.fleeR ?? tuningValue(tun, 'fleeR'),
    approachR: row.approachR ?? tuningValue(tun, 'approachR'),
    x, y, homeX: x, homeY: y,
    facing: DIRS[rng.int(0, 3)],
    state: 'idle',
    waitMs: rng.int(tuningValue(tun, 'pauseMin'), tuningValue(tun, 'pauseMax')),
    ageMs: 0,
    ttlMs: row.ttlMs ?? tuningValue(tun, 'ttlMs'),
    leash: tuningValue(tun, 'leash'),
    despawnReason: null,
  };
}

/**
 * Builds the entity the renderer and collision see for a roamer.
 * @param {Roamer} r
 * @returns {Entity}
 */
export function toEntity(r) {
  return createEntity({
    id: r.id, kind: 'roamer', x: r.x, y: r.y, facing: r.facing,
    artId: r.speciesId, speciesId: r.speciesId, speedMs: STROLL_MS,
    def: { kind: 'roamer', id: r.id, x: r.x, y: r.y, species: r.speciesId, catchable: r.catchable, dynamic: true },
  });
}

/**
 * The encounter a touched roamer starts (§4.6 shape).
 * @param {Roamer} r
 * @returns {EncounterResult}
 */
export function toEncounter(r) {
  return { speciesId: r.speciesId, level: r.level, errant: r.errant, tableId: r.tableId };
}

/**
 * @typedef {Object} RoamerTickCtx
 * @property {{x: number, y: number}|null} player
 * @property {Passable} passable
 * @property {TideState} tideState
 * @property {(x: number, y: number) => boolean} [occupied]
 * @property {Partial<typeof ROAMER_DEFAULTS>} [tuning]
 */

/**
 * Why a roamer should leave, or null.
 * @param {Roamer} r
 * @param {RoamerTickCtx} ctx
 * @returns {'ttl'|'far'|'flooded'|null}
 */
export function shouldDespawn(r, ctx) {
  if (r.ageMs >= r.ttlMs) return 'ttl';
  const despawnR = tuningValue(ctx.tuning, 'despawnR');
  if (ctx.player && Math.abs(r.x - ctx.player.x) + Math.abs(r.y - ctx.player.y) > despawnR) return 'far';
  if (!ctx.passable(r.x, r.y, ctx.tideState, 'roamer')) return 'flooded';
  return null;
}

/**
 * Picks the passable direction that best changes the Manhattan distance to the player: farthest for
 * fleeing, nearest for approaching. Ties go to the first in {@link DIRS} order (deterministic).
 * @param {Roamer} r @param {RoamerTickCtx} ctx @param {boolean} away
 * @returns {Dir|null}
 */
function dirRelativeToPlayer(r, ctx, away) {
  const p = ctx.player;
  // Away vector (or toward, when approaching); ties on distance go to the dominant axis.
  const vx = away ? r.x - p.x : p.x - r.x, vy = away ? r.y - p.y : p.y - r.y;
  let best = null, bestD = away ? -Infinity : Infinity, bestAlign = -Infinity;
  for (let d = 0; d < 4; d++) {
    const nx = r.x + DX[d], ny = r.y + DY[d];
    if (!ctx.passable(nx, ny, ctx.tideState, 'roamer')) continue;
    if (ctx.occupied && ctx.occupied(nx, ny)) continue;
    const dist = Math.abs(nx - p.x) + Math.abs(ny - p.y);
    const align = DX[d] * vx + DY[d] * vy;
    const better = away ? dist > bestD : dist < bestD;
    if (better || (dist === bestD && align > bestAlign)) { bestD = dist; bestAlign = align; best = DIRS[d]; }
  }
  if (best === null) return null;
  const now = Math.abs(r.x - p.x) + Math.abs(r.y - p.y);
  if (away && bestD <= now) return null;        // cornered: stay
  if (!away && bestD >= now) return null;       // cannot get closer
  return best;
}

/**
 * Advances a roamer's timers and decides whether it wants to step now. The caller performs the step
 * (`EntityManager.tryMove`) and then calls {@link applyStep} on success, so this never moves anything.
 * Draws from `rng` only when a wander decision is due.
 * @param {Roamer} r
 * @param {Rng} rng
 * @param {number} ms
 * @param {RoamerTickCtx} ctx
 * @returns {Dir|null}   direction to step this tick, or null
 */
export function tickRoamer(r, rng, ms, ctx) {
  if (r.state === 'gone') return null;
  r.ageMs += ms;
  r.waitMs -= ms;
  if (r.waitMs > 0) return null;
  const stepMs = tuningValue(ctx.tuning, 'stepMs');
  const pauseMin = tuningValue(ctx.tuning, 'pauseMin');

  if (ctx.player && r.behaviour !== 'still') {
    const dist = Math.abs(r.x - ctx.player.x) + Math.abs(r.y - ctx.player.y);
    if (r.behaviour === 'flee' && dist <= r.fleeR) {
      const d = dirRelativeToPlayer(r, ctx, true);
      r.state = 'flee';
      r.waitMs = d ? stepMs : pauseMin;
      if (!d) r.facing = facePlayer(r, ctx.player);
      return d;
    }
    if (r.behaviour === 'approach' && dist <= r.approachR) {
      r.state = 'approach';
      if (dist <= 1) { r.facing = facePlayer(r, ctx.player); r.waitMs = pauseMin; return null; }
      const d = dirRelativeToPlayer(r, ctx, false);
      r.waitMs = d ? stepMs : pauseMin;
      return d;
    }
  }

  // Wander: pause, or step toward a random passable neighbour inside the leash.
  if (r.behaviour === 'still' || !rng.chance(tuningValue(ctx.tuning, 'wanderChance'))) {
    r.state = 'idle';
    r.waitMs = rng.int(pauseMin, tuningValue(ctx.tuning, 'pauseMax'));
    return null;
  }
  const d = rng.int(0, 3);
  const nx = r.x + DX[d], ny = r.y + DY[d];
  r.state = 'wander';
  r.facing = DIRS[d];
  if (Math.abs(nx - r.homeX) + Math.abs(ny - r.homeY) > r.leash || !ctx.passable(nx, ny, ctx.tideState, 'roamer') || (ctx.occupied && ctx.occupied(nx, ny))) {
    r.waitMs = pauseMin;
    return null;
  }
  r.waitMs = stepMs;
  return DIRS[d];
}

/** @param {Roamer} r @param {{x: number, y: number}} p @returns {Dir} */
function facePlayer(r, p) {
  const dx = p.x - r.x, dy = p.y - r.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx < 0 ? 'left' : 'right';
}

/**
 * Records a step the caller has applied to the entity.
 * @param {Roamer} r
 * @param {Dir} dir
 */
export function applyStep(r, dir) {
  const d = DIRS.indexOf(dir);
  r.x += DX[d]; r.y += DY[d];
  r.facing = dir;
}

/**
 * Whether a roamer touches the tile (x, y): on it or orthogonally next to it. The encounter system
 * asks this after each player step (and after each roamer step) with the player's tile; a touch
 * starts the {@link toEncounter} battle (§4.6).
 * @param {Roamer} r
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function touching(r, x, y) {
  return r.state !== 'gone' && Math.abs(r.x - x) + Math.abs(r.y - y) <= 1;
}

/**
 * Marks a roamer gone (the caller removes its entity).
 * @param {Roamer} r
 * @param {string} reason
 */
export function despawn(r, reason) {
  r.state = 'gone';
  r.despawnReason = reason;
}

/**
 * @typedef {Object} RoamerField
 * @property {Roamer[]} list                      live roamers (read-only view)
 * @property {(id: string) => Roamer|null} find
 * @property {(rng: Rng, table: readonly EncounterRow[], map: object, tideState: TideState, opts: Omit<SpawnOpts, 'seq'>) => Roamer|null} spawn   respects the cap
 * @property {(rng: Rng, ms: number, ctx: RoamerTickCtx & {tryStep: (r: Roamer, dir: Dir) => boolean}) => {stepped: Roamer[], despawned: Roamer[]}} tick   REUSED result record and arrays
 * @property {(id: string, reason?: string) => Roamer|null} remove
 * @property {(x: number, y: number) => Roamer|null} touchingAt   first live roamer (in spawn order) touching the tile, see {@link touching}
 * @property {(ms: number) => boolean} spawnDue   advances the spawn timer; true when an attempt is due (resets the timer)
 * @property {() => void} clear
 */

/**
 * Manages the roamers of one map: cap, sequence numbers, spawn cadence and per-tick bookkeeping.
 * @param {{cap?: number, spawnEveryMs?: number}} [opts]
 * @returns {RoamerField}
 */
export function createRoamerField(opts = {}) {
  const cap = opts.cap ?? ROAMER_DEFAULTS.cap;
  const spawnEveryMs = opts.spawnEveryMs ?? ROAMER_DEFAULTS.spawnEveryMs;
  /** @type {Roamer[]} */
  const list = [];
  const stepped = [], despawned = [];
  const result = { stepped, despawned };
  let seq = 0;
  let spawnTimer = 0;

  /** @param {string} id @param {string} [reason] */
  function remove(id, reason = 'manual') {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        const r = list[i];
        despawn(r, reason);
        list.splice(i, 1);
        return r;
      }
    }
    return null;
  }

  return {
    list,
    find(id) { for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; },
    spawn(rng, table, map, tideState, o) {
      if (list.length >= cap) return null;
      const r = spawn(rng, table, map, tideState, { ...o, seq: seq++ });
      if (r) list.push(r);
      return r;
    },
    tick(rng, ms, ctx) {
      stepped.length = 0; despawned.length = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        const why = shouldDespawn(r, ctx);
        if (why) { despawn(r, why); list.splice(i, 1); despawned.push(r); continue; }
        const d = tickRoamer(r, rng, ms, ctx);
        if (d && ctx.tryStep(r, d)) { applyStep(r, d); stepped.push(r); }
      }
      return result;
    },
    remove,
    touchingAt(x, y) { for (let i = 0; i < list.length; i++) if (touching(list[i], x, y)) return list[i]; return null; },
    spawnDue(ms) {
      spawnTimer += ms;
      if (spawnTimer < spawnEveryMs) return false;
      spawnTimer -= spawnEveryMs;
      return true;
    },
    clear() { for (let i = list.length - 1; i >= 0; i--) despawn(list[i], 'manual'); list.length = 0; },
  };
}

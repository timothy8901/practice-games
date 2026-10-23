/**
 * Map transitions (ARCHITECTURE §4.8). Pure: no DOM, no data imports.
 *
 * {@link resolveWarp} decides whether a warp fires and where the player lands. It never mutates
 * the world: the overworld scene applies the result inside `scenes.transition(...)` and the
 * `map:enter` autosave follows. A refusal carries a `reason` the HUD / toast can key copy on
 * (`'tide'` "the causeway is under water", `'locked'` "it's locked", `'cond'` anything else).
 *
 * Warp conditions use the shared condition DSL (§6.4, `script/cond.evalCond`). The only leaves
 * evaluated here are `tide` and `lowTide`, so they read the tide the caller passes (the tide the
 * player is actually standing in) instead of re-deriving it from the clock; every other key goes
 * to the DSL. A caller may replace the whole evaluator with `opts.evalCond`.
 *
 * With `opts.destMap` (the destination's RuntimeMap) the landing tile is checked too: a warp
 * whose arrival tile is under the sea at this tide refuses with `'tide'`, so a door onto the flats
 * never drops the player into water.
 *
 * Lane: WORLD-MAP.
 * @module world/warps
 */

import { tideState as tideStateOf } from '../state/selectors.js';
import { evalCond as dslEvalCond } from '../script/cond.js';
import { tideVariant, flooded } from './tide.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {import('./tilemap.js').WarpDef} WarpDef */
/** @typedef {import('./tilemap.js').RuntimeMap} RuntimeMap */

/** Warp kinds and what fires them (§4.8: doors on confirm or step, edges on step). */
export const WARP_FIRE = Object.freeze({ door: 'both', edge: 'step', stairs: 'step' });

/** Reasons a warp can refuse. */
export const WARP_REASONS = Object.freeze(['tide', 'locked', 'cond', 'unknown-map', 'blocked']);

/** Default copy per reason, keyed for `data/strings.js` (`warp.<reason>`); UI may override. */
export const WARP_MESSAGES = Object.freeze({
  tide: 'The sea is over the way. Wait for the tide.',
  locked: "It's locked.",
  cond: 'Not now.',
  'unknown-map': 'The way leads nowhere yet.',
  blocked: 'Something is in the way.',
});

/** Arrival facing when the destination names none, by warp kind. */
const DEFAULT_ARRIVAL_FACING = Object.freeze({ door: 'down', stairs: 'down' });


/**
 * @typedef {Object} WarpOk
 * @property {true} ok
 * @property {string} mapId
 * @property {number} x
 * @property {number} y
 * @property {'up'|'down'|'left'|'right'} facing
 * @property {{mapId: string, x: number, y: number, facing: string}} to   the same, as the §4.8 `to` record
 * @property {string} kind      warp kind
 * @property {string|null} sfx  door sound to play, if any
 */
/**
 * @typedef {Object} WarpRefused
 * @property {false} ok
 * @property {'tide'|'locked'|'cond'|'unknown-map'|'blocked'} reason
 * @property {string} message      default copy (UI should prefer `strings.t(messageKey)`)
 * @property {string} messageKey   `warp.<reason>`
 */

/**
 * @typedef {Object} WarpOptions
 * @property {(world: World, cond: any, ctx: {data: any, mapId?: string, x?: number, y?: number, tide: TideState|number}) => boolean} [evalCond]
 *   replaces {@link evalWarpCond} entirely (it then owns the tide leaves too)
 * @property {string} [mapId]   map the warp sits on (cond context)
 * @property {string} [facing]  the player's current facing, kept on edge warps when `to.facing` is absent
 * @property {RuntimeMap|null} [destMap]   destination map: refuse `'tide'` if the landing tile is
 *   flooded at this tide, `'blocked'` if it is outside the map or a wall
 */

/**
 * Resolves a warp against the world.
 * @param {World} world
 * @param {WarpDef} warp
 * @param {{has?: (table: string, id: string) => boolean}|null} [data]   registry; when it can answer `has('maps', id)` the destination is checked
 * @param {TideState|number|undefined} [tideState]   current tide (defaults to `selectors.tideState(world)`)
 * @param {WarpOptions} [opts]
 * @returns {WarpOk|WarpRefused}
 */
export function resolveWarp(world, warp, data, tideState, opts) {
  if (!warp || !warp.to || typeof warp.to.mapId !== 'string') throw new TypeError('resolveWarp: warp needs to {mapId, x, y}');
  const o = opts || {};
  const tide = tideState === undefined || tideState === null ? tideStateOf(world) : tideState;
  const ctx = { data: data || null, mapId: o.mapId ?? world?.player?.mapId, x: warp.x, y: warp.y, tide };

  if (warp.cond !== undefined && warp.cond !== null) {
    const pass = o.evalCond ? Boolean(o.evalCond(world, warp.cond, ctx)) : evalWarpCond(world, warp.cond, ctx);
    if (!pass) {
      const reason = classifyRefusal(world, warp.cond, ctx, o.evalCond);
      return refuse(reason);
    }
  }

  if (data && typeof data.has === 'function') {
    let known = true;
    try {
      known = data.has('maps', warp.to.mapId);
    } catch {
      known = true; // a registry that throws on an unknown table does not know maps yet
    }
    if (!known) return refuse('unknown-map');
  }

  const dest = o.destMap;
  if (dest) {
    if (dest.id !== warp.to.mapId) throw new Error(`resolveWarp: destMap is '${dest.id}', warp goes to '${warp.to.mapId}'`);
    const { x, y } = warp.to;
    if (!dest.inBounds(x, y)) return refuse('blocked');
    if (flooded(dest, x, y, tide)) return refuse('tide');
    if (!dest.passable(x, y, tide, 'walk')) return refuse('blocked');
  }

  const facing = arrivalFacing(warp, o.facing ?? world?.player?.facing);
  const to = Object.freeze({ mapId: warp.to.mapId, x: warp.to.x, y: warp.to.y, facing });
  return Object.freeze({ ok: true, mapId: to.mapId, x: to.x, y: to.y, facing, to, kind: warp.kind || 'door', sfx: warp.sfx ?? null });
}

/**
 * Facing on arrival: the destination's `facing`, else the player's current facing for edge warps
 * (they keep walking), else `'down'` for doors and stairs (you step out into the room / street).
 * @param {WarpDef} warp
 * @param {string|undefined} [currentFacing]
 * @returns {'up'|'down'|'left'|'right'}
 */
export function arrivalFacing(warp, currentFacing) {
  const f = warp.to && warp.to.facing;
  if (isFacing(f)) return f;
  if ((warp.kind || 'door') === 'edge' && isFacing(currentFacing)) return currentFacing;
  return DEFAULT_ARRIVAL_FACING[warp.kind] || (isFacing(currentFacing) ? currentFacing : 'down');
}

/**
 * How a warp fires: `'step'` when the player walks onto it, `'confirm'` on the interact button,
 * `'both'` for doors (§4.8). A warp may override with its own `fire` field.
 * @param {WarpDef & {fire?: 'step'|'confirm'|'both'}} warp
 * @returns {'step'|'confirm'|'both'}
 */
export function firesOn(warp) {
  if (warp.fire === 'step' || warp.fire === 'confirm' || warp.fire === 'both') return warp.fire;
  return WARP_FIRE[warp.kind] || 'step';
}

/**
 * Whether stepping onto the warp tile fires it.
 * @param {WarpDef} warp
 * @returns {boolean}
 */
export function firesOnStep(warp) {
  const f = firesOn(warp);
  return f === 'step' || f === 'both';
}

/**
 * Whether confirming while on / facing the warp fires it.
 * @param {WarpDef} warp
 * @returns {boolean}
 */
export function firesOnConfirm(warp) {
  const f = firesOn(warp);
  return f === 'confirm' || f === 'both';
}

/**
 * Evaluates a warp condition: the condition DSL (`script/cond.evalCond`) with the `tide` and
 * `lowTide` leaves read from `ctx.tide` instead of the world clock, at any depth under
 * `not` / `all` / `any`.
 *
 * `tide: TideState[]` matches the exact state when `ctx.tide` is a state; a bare height (or the
 * variant `'mid'`) cannot tell rising from falling, so mid water matches either.
 * @param {World} world
 * @param {any} cond
 * @param {{tide: TideState|number|'mid', data?: any, mapId?: string, x?: number, y?: number}} ctx
 * @returns {boolean}
 * @throws {TypeError} on a malformed condition (same contract as the DSL)
 */
export function evalWarpCond(world, cond, ctx) {
  if (cond === true || cond === undefined || cond === null) return true;
  if (cond === false) return false;
  if (typeof cond !== 'object' || Array.isArray(cond)) throw new TypeError(`warps: cond must be a boolean or an object, got ${JSON.stringify(cond)}`);
  if ('not' in cond || 'all' in cond || 'any' in cond || 'tide' in cond || 'lowTide' in cond) {
    const keys = Object.keys(cond);
    if (keys.length !== 1) throw new TypeError(`warps: malformed cond ${JSON.stringify(cond)} (one DSL key per object)`);
    const v = cond[keys[0]];
    switch (keys[0]) {
      case 'not':
        return !evalWarpCond(world, v, ctx);
      case 'all':
        if (!Array.isArray(v)) throw new TypeError('warps: cond.all must be an array');
        return v.every((c) => evalWarpCond(world, c, ctx));
      case 'any':
        if (!Array.isArray(v)) throw new TypeError('warps: cond.any must be an array');
        return v.some((c) => evalWarpCond(world, c, ctx));
      case 'tide':
        return tideMatches(Array.isArray(v) ? v : [v], ctx.tide);
      default:
        return (tideVariant(ctx.tide) === 'low') === Boolean(v);
    }
  }
  return dslEvalCond(world, cond, ctx);
}

/**
 * @param {readonly string[]} list   tide states / variants named by the cond
 * @param {TideState|number|'mid'} tide
 * @returns {boolean}
 */
function tideMatches(list, tide) {
  if (typeof tide === 'string' && list.includes(tide)) return true;
  const v = tideVariant(tide);
  if (list.includes(v)) return true;
  const ambiguous = typeof tide === 'number' || tide === 'mid';
  return v === 'mid' && ambiguous && (list.includes('rising') || list.includes('falling'));
}

/**
 * Picks the refusal reason for a failed cond: `'tide'` when the cond gates on the tide and would
 * pass with the tide gate removed; `'locked'` when it gates on a flag (a bolted door or a story
 * gate) and would pass without that flag; `'cond'` otherwise.
 * @param {World} world
 * @param {any} cond
 * @param {{tide: TideState|number, mapId?: string, data: any}} ctx
 * @param {Function|undefined} evalCond
 * @returns {'tide'|'locked'|'cond'}
 */
function classifyRefusal(world, cond, ctx, evalCond) {
  const run = (c) => {
    try {
      return evalCond ? Boolean(evalCond(world, c, ctx)) : evalWarpCond(world, c, ctx);
    } catch {
      return false;
    }
  };
  if (mentions(cond, TIDE_KEYS) && run(strip(cond, TIDE_KEYS))) return 'tide';
  if (mentions(cond, LOCK_KEYS) && run(strip(cond, LOCK_KEYS))) return 'locked';
  return 'cond';
}

const TIDE_KEYS = Object.freeze(['tide', 'lowTide']);
const LOCK_KEYS = Object.freeze(['flag', 'hasItem', 'seen', 'badge', 'loan', 'thread', 'letter']);

/**
 * @param {any} cond
 * @param {readonly string[]} keys
 * @returns {boolean}
 */
function mentions(cond, keys) {
  if (!cond || typeof cond !== 'object') return false;
  if ('not' in cond) return mentions(cond.not, keys);
  if ('all' in cond) return cond.all.some((c) => mentions(c, keys));
  if ('any' in cond) return cond.any.some((c) => mentions(c, keys));
  return keys.some((k) => k in cond);
}

/**
 * Returns `cond` with every leaf that mentions one of `keys` replaced by `true`.
 * @param {any} cond
 * @param {readonly string[]} keys
 * @returns {any}
 */
function strip(cond, keys) {
  if (!cond || typeof cond !== 'object') return cond;
  if ('not' in cond) return mentions(cond.not, keys) ? true : cond;
  if ('all' in cond) return { all: cond.all.map((c) => strip(c, keys)) };
  if ('any' in cond) return { any: cond.any.map((c) => strip(c, keys)) };
  return keys.some((k) => k in cond) ? true : cond;
}

/**
 * @param {string} f
 * @returns {f is 'up'|'down'|'left'|'right'}
 */
function isFacing(f) {
  return f === 'up' || f === 'down' || f === 'left' || f === 'right';
}

/**
 * @param {'tide'|'locked'|'cond'|'unknown-map'|'blocked'} reason
 * @returns {WarpRefused}
 */
function refuse(reason) {
  return Object.freeze({ ok: false, reason, message: WARP_MESSAGES[reason], messageKey: `warp.${reason}` });
}

/**
 * Fishing: reaches, shadows and the bite state machine (GDD-00 §5 night fish, §7 fish income, §9
 * fishing and the Crossovers table, §15 accessibility; ARCHITECTURE §1 manifest, §9 `fish:<reachId>`).
 * [SYS-GATHER]
 *
 * A reach (a stretch of river or quay, declared on its map as `reaches[]`) holds 4–8 shadows. Its
 * **health** dips with every fish taken out (floor 40%), climbs back linearly to full in one day, and
 * a release nudges it up; a healthy reach reads *busy* and shows more shadows, a fished one *quiet*.
 * {@link reachShadows} simulates the reach: each shadow is a fish (species, size and silhouette from
 * the fish rows) or, rarely, a wild creature from the reach's encounter table. A Brine lead names
 * every shadow's species; a Rime lead calms the quay (+1 shadow); a learned tell shows its shape,
 * sound and word.
 *
 * The cast is a pure state machine over a plain `session` object (never saved; the clock keeps
 * running while it plays):
 *
 *     cast -> approach -> feints (1–3 nibbles) -> bite window -> landed -> keep | release
 *                                  \-> missed ('early' press on a feint, or 'late')   \-> cancelled
 *
 * Every random choice (target, approach time, feint count and gaps, bite window) is pre-rolled at
 * {@link cast}, so the outcome depends only on the rng and the frames at which input arrives.
 * Modes (GDD-00 §9, §15): **Standard** (window 7–31 frames at 60 fps by species, tighter for night
 * headliners per row), **Gentle** (the same species scaled into 36–54 frames, 0.6–0.9 s) and
 * **Patient** (no timing: presses before the bite are ignored, the bite waits, holding reels it in;
 * its own record board). A Brine lead multiplies the window by 1.5.
 *
 * Writes: `world.maps[mapId].reach` / `.reachAt` (co-owned with systems/gather), the Field Log
 * through systems/fieldLog (catches, bests, tells), `stats.fishCaught` through systems/stats.
 * Injected: `ctx.give(fishId, 1)` for a kept fish. Events (`ctx.bus`): `fishing:cast`, `fishing:land`,
 * `fishing:miss`, `fishing:keep`, `fishing:release`, `fishing:creature`; the session's own `events`
 * list (per {@link tick} / {@link press}) drives the scene and sfx.
 *
 * Pure: no DOM, no Math.random. Lane: SYS-GATHER.
 * @module systems/fishing
 */

import * as stats from './stats.js';
import {
  makeTuning, tuningSource, deepFreeze, V, collectionRows, rowOf, leadBonuses, recordFish, tellLearned,
} from './fieldLog.js';
import { ensureMap, envFor, rowActive, modsFor, nowTotal, tileDist } from './gather.js';
import { eligibleRows, rollRow, rollLevel, rowCondHolds } from '../world/roamer.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {import('./fieldLog.js').LaneCtx} LaneCtx */
/** @typedef {LaneCtx & {total?: number, phase?: string, tideState?: string, weather?: string, give?: (id: string, n: number) => any, extraShadows?: number, mode?: FishMode}} FishCtx */
/** @typedef {'standard'|'gentle'|'patient'} FishMode */

/** Frames per second the bite windows are written in (the fixed-step loop rate). */
export const FPS = 60;
/** Fishing modes (settings: Standard / Gentle / Patient). */
export const MODES = Object.freeze(['standard', 'gentle', 'patient']);

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} FishTuning
 * @property {[number, number]} fishShadowsPerReach   shadows on a full / fished reach (GDD-00 §7: 4–8)
 * @property {number} fishReachFloor          reach health floor (GDD-00 §7: 40%)
 * @property {number} fishReachRecoverMinutes game minutes from the floor back to full (GDD-00 §7: a day)
 * @property {number} fishReachCatchCost      health lost per fish taken out
 * @property {number} fishReleaseNudge        health a release gives back
 * @property {number} fishReachBusyAt         health at or above which a reach reads busy
 * @property {[number, number]} fishFeints    feints before a bite (GDD-00 §9: cast, feint, feint, bite)
 * @property {[number, number]} fishBiteFrames   the Standard species range (GDD-00 §9: 7–31 frames)
 * @property {number} fishBiteFramesDefault   Standard window of a row that gives none
 * @property {[number, number]} fishGentleFrames  the Gentle range the species range maps onto (GDD-00 §9: 36–54)
 * @property {number} fishPatientReelFrames   Patient: frames of holding to reel a bite in
 * @property {[number, number]} fishApproachFrames   frames a shadow takes to reach the bobber
 * @property {[number, number]} fishFeintGapFrames   frames between nibbles (and before the bite)
 * @property {number} fishCreatureChance      chance a shadow on a reach with a `creatureTable` is a wild creature
 */

/** GDD-00 values where GDD-00 states one. @type {Readonly<FishTuning>} */
export const DEFAULTS = deepFreeze({
  fishShadowsPerReach: [4, 8],
  fishReachFloor: 0.4,
  fishReachRecoverMinutes: 1440,
  fishReachCatchCost: 0.1,
  fishReleaseNudge: 0.05,
  fishReachBusyAt: 0.75,
  fishFeints: [1, 3],
  fishBiteFrames: [7, 31],
  fishBiteFramesDefault: 18,
  fishGentleFrames: [36, 54],
  fishPatientReelFrames: 60,
  fishApproachFrames: [45, 120],
  fishFeintGapFrames: [30, 75],
  fishCreatureChance: 0.05,
});

/** @type {Record<keyof FishTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  fishShadowsPerReach: [V.intRange, '[min, max] integers >= 0'],
  fishReachFloor: [V.unit, '0..1'],
  fishReachRecoverMinutes: [V.pos, 'number > 0'],
  fishReachCatchCost: [V.unit, '0..1'],
  fishReleaseNudge: [V.unit, '0..1'],
  fishReachBusyAt: [V.unit, '0..1'],
  fishFeints: [V.intRange, '[min, max] integers >= 0'],
  fishBiteFrames: [(v) => V.intRange(v) && v[0] >= 1 && v[0] < v[1], '[min, max] integers, 1 <= min < max'],
  fishBiteFramesDefault: [V.posInt, 'integer >= 1'],
  fishGentleFrames: [(v) => V.intRange(v) && v[0] >= 1, '[min, max] integers >= 1'],
  fishPatientReelFrames: [V.posInt, 'integer >= 1'],
  fishApproachFrames: [V.intRange, '[min, max] integers >= 0'],
  fishFeintGapFrames: [(v) => V.intRange(v) && v[0] >= 1, '[min, max] integers >= 1'],
  fishCreatureChance: [V.unit, '0..1'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Resolves this module's tuning. */
export const tuningOf = makeTuning('fishing', DEFAULTS, SPEC);

/** @param {LaneCtx|undefined} ctx */
const T = (ctx) => tuningOf(tuningSource(ctx));

// ---------------------------------------------------------------------------------------------
// Reaches and health
// ---------------------------------------------------------------------------------------------

/**
 * A fishing reach as its map declares it.
 * @typedef {Object} ReachDef
 * @property {string} id
 * @property {string} [kind]                    e.g. 'river' | 'quay' | 'creek' | 'sea'; fish rows' `where` may name it
 * @property {{x: number, y: number, w: number, h: number}} area   water tiles the shadows swim in
 * @property {[number, number]} [shadows]       per-reach override of `fishShadowsPerReach`
 * @property {string} [creatureTable]           encounter table whose rows can be hooked here
 * @property {object} [cond]                    §6.4 Cond; when false the reach is empty (the north creek until the weir turns)
 */

/**
 * The fish-label of a reach's stateful stream (GDD-00 / ARCHITECTURE §9).
 * @param {string} reachId
 * @returns {string}
 */
export function streamLabel(reachId) {
  return `fish:${reachId}`;
}

/**
 * @param {{reaches?: ReachDef[]}} map
 * @param {string|ReachDef} reach
 * @returns {ReachDef|null}
 */
export function reachDefOf(map, reach) {
  if (reach && typeof reach === 'object') return reach;
  if (typeof reach !== 'string') return null;
  return (Array.isArray(map?.reaches) ? map.reaches : []).find((r) => r && r.id === reach) ?? null;
}

/**
 * Health of a reach now: the stored value recovering linearly toward 1 (full recovery from the
 * floor takes `fishReachRecoverMinutes`); 1 for a reach never fished.
 * @param {World} world
 * @param {string} mapId
 * @param {string} reachId
 * @param {FishCtx} [ctx]
 * @returns {number} in [floor, 1]
 */
export function reachHealth(world, mapId, reachId, ctx) {
  const t = T(ctx);
  const m = world?.maps?.[mapId];
  const stored = m?.reach?.[reachId];
  if (typeof stored !== 'number' || !Number.isFinite(stored)) return 1;
  const at = m?.reachAt?.[reachId];
  const now = nowTotal(world, ctx);
  const elapsed = typeof at === 'number' && Number.isFinite(at) ? Math.max(0, now - at) : Infinity;
  const rate = (1 - t.fishReachFloor) / t.fishReachRecoverMinutes;
  const h = elapsed === Infinity ? 1 : stored + elapsed * rate;
  return Math.min(1, Math.max(t.fishReachFloor, h));
}

/**
 * `'busy'` at or above `fishReachBusyAt`, else `'quiet'`.
 * @param {number} health
 * @param {LaneCtx} [ctx]
 * @returns {'busy'|'quiet'}
 */
export function reachStatus(health, ctx) {
  return health >= T(ctx).fishReachBusyAt ? 'busy' : 'quiet';
}

/**
 * Sets a reach's health (clamped to [floor, 1]) and stamps the time it was set.
 * @param {World} world
 * @param {string} mapId
 * @param {string} reachId
 * @param {number} health
 * @param {FishCtx} [ctx]
 * @returns {number} the stored health
 */
export function setReachHealth(world, mapId, reachId, health, ctx) {
  if (typeof health !== 'number' || !Number.isFinite(health)) throw new TypeError('fishing.setReachHealth: health must be a finite number');
  const t = T(ctx);
  const m = ensureMap(world, mapId);
  if (!m.reach || typeof m.reach !== 'object') m.reach = {};
  if (!m.reachAt || typeof m.reachAt !== 'object') m.reachAt = {};
  const h = Math.min(1, Math.max(t.fishReachFloor, health));
  m.reach[reachId] = h;
  m.reachAt[reachId] = nowTotal(world, ctx);
  return h;
}

// ---------------------------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Shadow
 * @property {string} id                 `<reachId>:<n>`
 * @property {string|null} fishId        fish row id (`null` for a creature)
 * @property {{speciesId: string, level: number, errant: false, tableId: string}|null} creature
 * @property {'small'|'medium'|'large'|'forked'|string} silhouette
 * @property {number} size               cm, one decimal (0 for a creature)
 * @property {number} x  @property {number} y
 * @property {boolean} named             species shown (Brine lead)
 * @property {any} tell                  the row's tell once learned, else `null`
 * @property {boolean} headliner         a night headliner, at night
 */

/**
 * @typedef {Object} ReachView
 * @property {string} reachId
 * @property {number} health
 * @property {'busy'|'quiet'} status
 * @property {boolean} empty      the reach's `cond` is false (no shadows at all)
 * @property {Shadow[]} shadows
 */

/**
 * Fish rows that can bite on a reach now (`where` may name the map, region, reach id or kind).
 * @param {World} world
 * @param {{id: string, region?: string}} map
 * @param {ReachDef} reach
 * @param {FishCtx} [ctx]
 * @returns {any[]}
 */
export function fishFor(world, map, reach, ctx) {
  const env = envFor(world, map, ctx);
  const places = [reach.id, reach.kind].filter((s) => typeof s === 'string');
  return collectionRows(ctx?.data, 'fish').filter((r) => rowActive(r, env, places));
}

/**
 * Simulates the shadows of a reach: count = `max × health` clamped to the reach's [min, max], plus
 * the lead's `extraShadows` and `ctx.extraShadows` (e.g. the quay-lamps project). Each shadow draws,
 * in order: the creature chance (only on a reach with a `creatureTable`), then the row (weighted by
 * `w` × `mods`), its level (creature) or size (fish), x and y.
 * @param {World} world
 * @param {{id: string, region?: string, reaches?: ReachDef[]}} map
 * @param {string|ReachDef} reachRef
 * @param {Rng} rng   the reach's stateful stream ({@link streamLabel})
 * @param {FishCtx} [ctx]
 * @returns {ReachView}
 */
export function reachShadows(world, map, reachRef, rng, ctx) {
  const reach = reachDefOf(map, reachRef);
  if (!reach || typeof reach.id !== 'string' || !reach.area) throw new TypeError(`fishing.reachShadows: unknown reach ${String(reachRef)}`);
  const t = T(ctx);
  const lb = leadBonuses(world, ctx);
  const health = reachHealth(world, map.id, reach.id, ctx);
  /** @type {ReachView} */
  const view = { reachId: reach.id, health, status: reachStatus(health, ctx), empty: false, shadows: [] };
  const env = envFor(world, map, ctx);
  if (reach.cond !== undefined && !rowCondHolds(reach.cond, { phase: env.phase, tideState: env.tideState, weather: env.weather, world, data: ctx?.data, mapId: map.id })) {
    view.empty = true;
    return view;
  }
  const [lo, hi] = Array.isArray(reach.shadows) && V.intRange(reach.shadows) ? reach.shadows : t.fishShadowsPerReach;
  const extra = lb.extraShadows + (Number.isInteger(ctx?.extraShadows) ? ctx.extraShadows : 0);
  const count = Math.max(0, Math.min(hi, Math.max(lo, Math.round(hi * health))) + extra);
  const fish = fishFor(world, map, reach, ctx);
  const creatureRows = typeof reach.creatureTable === 'string'
    ? eligibleRows(/** @type {any[]} */ (rowOf(ctx?.data, 'encounters', reach.creatureTable) ?? []).filter((r) => !r.errant), { phase: env.phase, tideState: env.tideState, weather: env.weather, world, data: ctx?.data })
    : null;
  const { x: ax, y: ay, w: aw, h: ah } = reach.area;
  for (let i = 0; i < count; i++) {
    let creature = null;
    let row = null;
    if (creatureRows && creatureRows.length > 0 && rng.chance(t.fishCreatureChance)) {
      const cr = rollRow(rng, creatureRows);
      if (cr) creature = { speciesId: cr.species, level: rollLevel(rng, cr), errant: /** @type {false} */ (false), tableId: reach.creatureTable };
    }
    if (!creature) {
      row = rng.weighted(fish.map((r) => ({ w: (typeof r.w === 'number' && Number.isFinite(r.w) ? r.w : 1) * modsFor(r, env), v: r })));
      if (!row) break;
    }
    let size = 0;
    if (row) {
      const [s0, s1] = Array.isArray(row.size) && row.size.length === 2 ? row.size : [0, 0];
      size = Math.round((s0 + rng.next() * Math.max(0, s1 - s0)) * 10) / 10;
    }
    const x = ax + rng.int(0, Math.max(0, aw - 1));
    const y = ay + rng.int(0, Math.max(0, ah - 1));
    view.shadows.push({
      id: `${reach.id}:${i}`,
      fishId: row ? row.id : null,
      creature,
      silhouette: row ? (row.shadow ?? 'medium') : 'large',
      size,
      x, y,
      named: lb.fishNameSpecies,
      tell: row && tellLearned(world, row.id) ? (row.tell ?? null) : null,
      headliner: Boolean(row?.headliner) && env.night,
    });
  }
  return view;
}

/**
 * Positions of night headliner shadows (for gather.senses' Bolt Tailhum).
 * @param {Shadow[]} shadows
 * @returns {Array<{x: number, y: number}>}
 */
export function headlinerSpots(shadows) {
  return (Array.isArray(shadows) ? shadows : []).filter((s) => s && s.headliner).map((s) => ({ x: s.x, y: s.y }));
}

/**
 * Bolt lead's Tailhum on the water: a night headliner shadow within `humRadius` tiles of `pos`.
 * @param {World} world
 * @param {Shadow[]} shadows
 * @param {{x: number, y: number}} pos
 * @param {LaneCtx} [ctx]
 * @returns {boolean}
 */
export function headlinerHum(world, shadows, pos, ctx) {
  const r = leadBonuses(world, ctx).humRadius;
  return r > 0 && headlinerSpots(shadows).some((s) => tileDist(s, pos) <= r);
}

// ---------------------------------------------------------------------------------------------
// The cast: a pure state machine
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {'approach'|'nibble'|'bite'|'landed'|'missed'|'cancelled'|'kept'|'released'} FishPhase
 * @typedef {{type: 'cast'|'arrive'|'feint'|'bite'|'hooked'|'reel'|'landed'|'miss'|'cancel'|'tell', frame: number, [k: string]: any}} FishEvent
 */

/**
 * @typedef {Object} FishSession
 * @property {string} mapId  @property {string} reachId
 * @property {FishMode} mode
 * @property {FishPhase} phase
 * @property {number} frame           frames since the cast
 * @property {Shadow} shadow          the shadow that took the bait
 * @property {{arrive: number, feints: number[], biteAt: number, biteWindow: number|null}} plan   absolute frames; `biteWindow` null = Patient
 * @property {number} feintsDone
 * @property {number} reel            Patient: frames held during the bite
 * @property {boolean} held           the reel button is down
 * @property {null|'early'|'late'} missReason
 * @property {boolean} night          cast at night
 * @property {FishEvent[]} events     events of the last call (replaced each call)
 */

/**
 * @param {Rng} rng
 * @param {number|[number, number]|undefined} v
 * @param {number} fallback
 * @returns {number}
 */
function rollFrames(rng, v, fallback) {
  if (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)) return rng.int(Math.min(v[0], v[1]), Math.max(v[0], v[1]));
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}

/**
 * The bite window in frames for a mode (`null` for Patient): Standard = the row's frames (night
 * headliners' `biteFramesNight` at night); Gentle = that value mapped linearly from `fishBiteFrames`
 * onto `fishGentleFrames` (clamped); both × the lead's `biteWindowMult`, rounded, at least 1.
 * @param {number} standardFrames
 * @param {FishMode} mode
 * @param {number} mult
 * @param {LaneCtx} [ctx]
 * @returns {number|null}
 */
export function windowFrames(standardFrames, mode, mult, ctx) {
  if (mode === 'patient') return null;
  const t = T(ctx);
  let f = standardFrames;
  if (mode === 'gentle') {
    const [s0, s1] = t.fishBiteFrames;
    const [g0, g1] = t.fishGentleFrames;
    const u = Math.min(1, Math.max(0, (standardFrames - s0) / (s1 - s0)));
    f = g0 + u * (g1 - g0);
  }
  return Math.max(1, Math.round(f * (typeof mult === 'number' && mult > 0 ? mult : 1)));
}

/**
 * Casts at a reach. Picks the target (`targetId`, else one draw among the shadows) and pre-rolls,
 * in order: the approach (1 draw), the feint count (1), each gap including the last before the bite
 * (count + 1), and the row's bite frames when the row gives a range (1). Emits `fishing:cast`.
 * Returns `null` when the reach has no shadows.
 * @param {World} world
 * @param {{id: string, region?: string, reaches?: ReachDef[]}} map
 * @param {string} reachId
 * @param {Shadow[]} shadows            from {@link reachShadows}
 * @param {string|null} targetId        the shadow aimed at, or null for "whatever bites"
 * @param {Rng} rng                     the reach's stream
 * @param {FishCtx} [ctx]               `ctx.mode` (default `world.settings.fishing`, else 'standard')
 * @returns {FishSession|null}
 */
export function cast(world, map, reachId, shadows, targetId, rng, ctx) {
  const list = Array.isArray(shadows) ? shadows.filter(Boolean) : [];
  if (list.length === 0) return null;
  const t = T(ctx);
  const lb = leadBonuses(world, ctx);
  const modeIn = ctx?.mode ?? world?.settings?.fishing ?? 'standard';
  const mode = /** @type {FishMode} */ (MODES.includes(modeIn) ? modeIn : 'standard');
  let shadow = targetId ? list.find((s) => s.id === targetId) ?? null : null;
  if (!shadow) shadow = /** @type {Shadow} */ (rng.pick(list));
  const env = envFor(world, map, ctx);
  const row = shadow.fishId ? rowOf(ctx?.data, 'collections', shadow.fishId) : null;
  const arrive = rng.int(t.fishApproachFrames[0], t.fishApproachFrames[1]);
  const fr = Array.isArray(row?.feints) && V.intRange(row.feints) ? row.feints : t.fishFeints;
  const nFeints = rng.int(fr[0], fr[1]);
  const gaps = [];
  for (let i = 0; i <= nFeints; i++) gaps.push(rng.int(t.fishFeintGapFrames[0], t.fishFeintGapFrames[1]));
  const night = env.night;
  const std = rollFrames(rng, night && row?.biteFramesNight !== undefined ? row.biteFramesNight : row?.biteFrames, t.fishBiteFramesDefault);
  const feints = [];
  let at = arrive;
  for (let i = 0; i < nFeints; i++) { at += gaps[i]; feints.push(at); }
  const biteAt = at + gaps[nFeints];
  /** @type {FishSession} */
  const s = {
    mapId: map.id, reachId, mode, phase: 'approach', frame: 0,
    shadow: { ...shadow },
    plan: { arrive, feints, biteAt, biteWindow: windowFrames(std, mode, lb.biteWindowMult, ctx) },
    feintsDone: 0, reel: 0, held: false, missReason: null, night, events: [],
  };
  s.events.push({ type: 'cast', frame: 0, mode, silhouette: shadow.silhouette, fishId: shadow.named ? shadow.fishId : null });
  if (shadow.tell) s.events.push({ type: 'tell', frame: 0, tell: shadow.tell });
  ctx?.bus?.emit('fishing:cast', { mapId: map.id, reachId, mode, shadowId: shadow.id });
  return s;
}

/**
 * Whether the session is over (no more input matters except {@link resolve} after `landed`).
 * @param {FishSession} s
 * @returns {boolean}
 */
export function isOver(s) {
  return s.phase === 'landed' || s.phase === 'missed' || s.phase === 'cancelled' || s.phase === 'kept' || s.phase === 'released';
}

/**
 * Advances the session by whole frames, appending the events that happen (arrive, feint, bite,
 * Patient reel progress and landing, the late miss when a window closes). Mutates and returns the
 * session; `session.events` holds this call's events.
 * @param {FishSession} s
 * @param {number} [frames=1]
 * @param {LaneCtx} [ctx]
 * @returns {FishSession}
 */
export function tick(s, frames = 1, ctx) {
  if (!Number.isInteger(frames) || frames < 0) throw new TypeError('fishing.tick: frames must be an integer >= 0');
  s.events = [];
  const t = T(ctx);
  for (let i = 0; i < frames && !isOver(s); i++) {
    s.frame += 1;
    const f = s.frame;
    if (s.phase === 'approach' && f >= s.plan.arrive) {
      s.phase = 'nibble';
      s.events.push({ type: 'arrive', frame: f });
    }
    if (s.phase === 'nibble') {
      while (s.feintsDone < s.plan.feints.length && f >= s.plan.feints[s.feintsDone]) {
        s.feintsDone += 1;
        s.events.push({ type: 'feint', frame: f, n: s.feintsDone, of: s.plan.feints.length });
      }
      if (f >= s.plan.biteAt) {
        s.phase = 'bite';
        s.events.push({ type: 'bite', frame: f, biteWindow: s.plan.biteWindow });
        continue; // a held Patient button starts reeling from the next frame
      }
    }
    if (s.phase === 'bite') {
      if (s.mode === 'patient') {
        if (s.held) {
          s.reel += 1;
          s.events.push({ type: 'reel', frame: f, progress: Math.min(1, s.reel / t.fishPatientReelFrames) });
          if (s.reel >= t.fishPatientReelFrames) land(s, f);
        }
      } else if (s.plan.biteWindow !== null && f >= s.plan.biteAt + s.plan.biteWindow) {
        s.phase = 'missed';
        s.missReason = 'late';
        s.events.push({ type: 'miss', frame: f, reason: 'late' });
      }
    }
  }
  return s;
}

/**
 * @param {FishSession} s
 * @param {number} f
 */
function land(s, f) {
  s.phase = 'landed';
  s.events.push({ type: 'hooked', frame: f });
  s.events.push({ type: 'landed', frame: f, fishId: s.shadow.fishId, size: s.shadow.size, creature: s.shadow.creature });
}

/**
 * The reel button goes down. Standard / Gentle: during the bite window it hooks and lands; during
 * the nibbles (after the shadow arrived) it misses (`'early'`, "Don't rush it"); during the approach
 * nothing happens. Patient: never misses; it starts holding (reeling advances in {@link tick}).
 * @param {FishSession} s
 * @returns {FishSession}
 */
export function press(s) {
  s.events = [];
  if (isOver(s)) return s;
  s.held = true;
  if (s.mode === 'patient') return s;
  if (s.phase === 'bite') land(s, s.frame);
  else if (s.phase === 'nibble') {
    s.phase = 'missed';
    s.missReason = 'early';
    s.events.push({ type: 'miss', frame: s.frame, reason: 'early' });
  }
  return s;
}

/**
 * The reel button comes up (Patient pauses reeling; nothing else).
 * @param {FishSession} s
 * @returns {FishSession}
 */
export function release(s) {
  s.events = [];
  s.held = false;
  return s;
}

/**
 * Reels the line in without a fish (the player walks away or cancels).
 * @param {FishSession} s
 * @returns {FishSession}
 */
export function cancel(s) {
  s.events = [];
  if (!isOver(s)) {
    s.phase = 'cancelled';
    s.events.push({ type: 'cancel', frame: s.frame });
  }
  return s;
}

/**
 * @typedef {Object} ResolveResult
 * @property {boolean} ok
 * @property {'fish'|'creature'|'miss'|'none'} kind
 * @property {string|null} fishId  @property {number} size
 * @property {null|{speciesId: string, level: number, errant: false, tableId: string}} encounter   a hooked creature to battle
 * @property {number} health       reach health after
 * @property {ReturnType<typeof recordFish>|null} log
 */

/**
 * Settles a finished session into the world. A landed fish is logged (count, best, Patient board,
 * tell), counts in `stats.fishCaught`, and costs the reach `fishReachCatchCost`; `'keep'` gives it
 * (`ctx.give`), `'release'` gives `fishReleaseNudge` back. A landed creature returns its encounter
 * (the flow starts the battle). A miss just emits `fishing:miss`. Idempotent: a resolved session
 * returns `{ok: false, kind: 'none'}`.
 * @param {World} world
 * @param {FishSession} s
 * @param {'keep'|'release'} [choice='keep']
 * @param {FishCtx} [ctx]
 * @returns {ResolveResult}
 */
export function resolve(world, s, choice = 'keep', ctx) {
  /** @type {ResolveResult} */
  const res = { ok: false, kind: 'none', fishId: null, size: 0, encounter: null, health: reachHealth(world, s.mapId, s.reachId, ctx), log: null };
  if (s.phase === 'missed') {
    ctx?.bus?.emit('fishing:miss', { mapId: s.mapId, reachId: s.reachId, reason: s.missReason });
    s.phase = 'cancelled';
    return { ...res, ok: true, kind: 'miss' };
  }
  if (s.phase !== 'landed') return res;
  if (s.shadow.creature) {
    s.phase = 'kept';
    ctx?.bus?.emit('fishing:creature', { mapId: s.mapId, reachId: s.reachId, ...s.shadow.creature });
    return { ...res, ok: true, kind: 'creature', encounter: { ...s.shadow.creature } };
  }
  const fishId = /** @type {string} */ (s.shadow.fishId);
  const t = T(ctx);
  const log = recordFish(world, fishId, s.shadow.size, { patient: s.mode === 'patient' }, ctx);
  stats.inc(world, 'fishCaught', 1, ctx);
  let h = res.health - t.fishReachCatchCost;
  const keep = choice !== 'release';
  if (!keep) h += t.fishReleaseNudge;
  const health = setReachHealth(world, s.mapId, s.reachId, h, ctx);
  if (keep && typeof ctx?.give === 'function') ctx.give(fishId, 1);
  s.phase = keep ? 'kept' : 'released';
  ctx?.bus?.emit('fishing:land', { mapId: s.mapId, reachId: s.reachId, fishId, size: s.shadow.size, mode: s.mode });
  ctx?.bus?.emit(keep ? 'fishing:keep' : 'fishing:release', { fishId, health });
  return { ok: true, kind: 'fish', fishId, size: s.shadow.size, encounter: null, health, log };
}

/**
 * Seconds a window lasts at {@link FPS} (for captions and the settings screen).
 * @param {number|null} frames
 * @returns {number|null}
 */
export function windowSeconds(frames) {
  return frames === null ? null : frames / FPS;
}

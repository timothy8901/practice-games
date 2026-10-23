/**
 * NPC schedules (ARCHITECTURE §4.4, GDD-00 §5, §9, §10). [SYS-TOWN]
 *
 * `whereIs(npc, world, data)` says where a neighbour should be right now as a {@link Placement};
 * `world/npc.js` turns that into movement (arrival rule, pathing, poses). Read-only: this module
 * never writes the world.
 *
 * Layers, highest first (the first that applies wins):
 *
 *  1. **Absent**: `npc.absent` (a Cond) holds -> `null` (the NPC is off every map; Linnet after her
 *     fall). `world/npc.js` treats a `null` placement as "remove the entity".
 *  2. **Festival**: an active festival (Lantern Market Saturdays 20:00–02:00, Porch Supper, and any
 *     content festival row) for which the NPC has a spot (`npc.festivals[festivalId]`). The Porch
 *     Supper is hosted on one lit neighbour porch per week (rotation by GDD week), and every guest
 *     is placed beside the host's seat.
 *  3. **Priority entry**: the running schedule entry, when it is marked `priority: 'high'` (a story
 *     post, a race); it beats the porch and shop layers only while it is the running entry.
 *  4. **Porch**: inside the porch-talk window (`porchWindow`, GDD-00 §5: 19:00–01:00), on the
 *     porch's days, when the porch is lit and `npc.porch.cond` holds: sit on the porch.
 *  5. **Shop**: `npc.shopPost` while that shop is open (the shop row's `hours`, wrapping midnight).
 *  6. **Schedule**: {@link entryAt}: the latest entry whose resolved start is at or before now.
 *  7. **Home**: `npc.homeSpot` (or the npc's `home` map at 0,0) when nothing else applies.
 *
 * Schedule entries (§4.4, data/index.js `ScheduleEntry`): `at` is a minute of day, `{tide:
 * 'low'|'high', offset?}` (every low / high water of that day) or `{phase, offset?}` (core/time
 * PHASE_TABLE start); filters `days` (GDD weekday, 0 = Mon), `weather` (kinds in effect now), `cond` (DSL),
 * `fromDay`/`toDay` (GDD day numbers); `for` limits an occurrence to that many minutes (else it lasts
 * until a later entry starts). The last entry of a day keeps running past midnight. Entries may name
 * a looped `path` (a `schedules` row of kind `path`), resolved by {@link routeFor}.
 *
 * Calendar: GDD days and weekdays (townCommon). Tide: the core/time model for the world's seed
 * (`state/selectors` agrees), or an injected `opts.lowsOn(coreDay) -> minute[]` once SYS-TIME owns
 * the GDD tide table.
 *
 * Pure: no DOM, no randomness, no writes.
 * @module systems/schedule
 */

import {
  CALENDAR_DEFAULTS, CALENDAR_SPEC, resolveTuning, tuningSource, rows, row, holds, coreDay, minuteNow,
  gameDay, dowOf, inWindow, windowStartDay, isPorchLit, porchesOf, mod, WEEK, weatherNow,
} from './townCommon.js';
import { MINUTES_PER_DAY, PHASE_TABLE, TIDE_PERIOD_MINUTES, scheduleForSeed } from '../core/time.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../world/npc.js').Placement} WorldPlacement */

/**
 * A schedule placement: everything `world/npc.js` reads (`mapId, x, y, facing, pose, pathId,
 * since, wanderR`) plus what UI and topics want (`activity`, `source`).
 * @typedef {Object} Placement
 * @property {string} mapId
 * @property {number} x  @property {number} y
 * @property {string} facing
 * @property {string} pose                 stand | wander | sit | sleep | fish | shop | sweep | path | porch
 * @property {string|null} pathId          named route (schedules row) for pose 'path'
 * @property {number} since                minute of day the placement began (arrival rule)
 * @property {number|null} wanderR
 * @property {string} activity             entry `activity`, else 'porch' / 'shop' / 'festival:<id>' / the pose
 * @property {'festival'|'priority'|'porch'|'shop'|'schedule'|'home'} source
 * @property {number} entryIndex           index in the npc's schedule (-1 for other layers)
 * @property {string|null} festivalId
 */

/**
 * @typedef {Object} FestivalRow
 * @property {string} id
 * @property {number[]} [dow]           GDD weekdays the festival starts on (0 = Mon)
 * @property {number[]} [days]          explicit GDD day numbers it starts on
 * @property {number} [fromDay]         first GDD day it can run (e.g. 7 for the first Lantern Market)
 * @property {number} from              start minute of day
 * @property {number} to                end minute of day (wraps past midnight when <= from)
 * @property {any} [cond]               DSL condition, checked against the world now
 * @property {'porch'} [host]           Porch Supper: guests gather at the week's host porch
 */

/** Built-in festivals (GDD-00 §5 anchors, §9 Festivals; Porch Supper from porchlight-gameplay §4). */
export const DEFAULT_FESTIVALS = Object.freeze([
  Object.freeze({ id: 'lantern-market', dow: Object.freeze([5]), fromDay: 7, from: 20 * 60, to: 2 * 60 }),
  Object.freeze({ id: 'porch-supper', dow: Object.freeze([5]), from: 18 * 60, to: 20 * 60, host: 'porch' }),
]);

/**
 * Designer numbers (GDD-00 §5, §9). [GDD values]
 */
export const DEFAULTS = Object.freeze({
  ...CALENDAR_DEFAULTS,
  /** Porch talk window, minutes [from, to) wrapping midnight (GDD-00 §5: 19:00–01:00). */
  porchWindow: Object.freeze([19 * 60, 1 * 60]),
  /** Festivals when content gives no `festivals` table. */
  festivals: DEFAULT_FESTIVALS,
  /** Explicit Porch Supper host rotation (npc ids); empty = every lit neighbour porch, sorted by id. */
  porchSupperHosts: Object.freeze([]),
  /** Days of history {@link entryAt} searches for the running entry (wrap past midnight, a skipped day). */
  scheduleLookbackDays: 2,
});

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

const isInt = (v) => Number.isInteger(v);
const isMinute = (v) => isInt(v) && v >= 0 && v <= MINUTES_PER_DAY;
const SPEC = {
  ...CALENDAR_SPEC,
  porchWindow: [(v) => Array.isArray(v) && v.length === 2 && v.every(isMinute), '[from, to] minutes 0..1440'],
  festivals: [(v) => Array.isArray(v) && v.every((f) => f && typeof f.id === 'string' && isMinute(f.from) && isMinute(f.to)), 'FestivalRow[]'],
  porchSupperHosts: [(v) => Array.isArray(v) && v.every((s) => typeof s === 'string'), 'string[]'],
  scheduleLookbackDays: [(v) => isInt(v) && v >= 1 && v <= 28, 'integer 1..28'],
};
/** @type {WeakMap<object, any>} */
const CACHE = new WeakMap();

/**
 * Resolved tuning for a call.
 * @param {any} data
 * @param {{tuning?: any}} [opts]
 * @returns {Readonly<typeof DEFAULTS>}
 */
export function tuningOf(data, opts) {
  return resolveTuning(DEFAULTS, SPEC, tuningSource(data, opts), CACHE, 'schedule');
}

/**
 * @typedef {Object} ScheduleOpts
 * @property {number} [day]          core day to evaluate (default: the world clock's)
 * @property {number} [minute]       minute of day to evaluate (default: the world clock's)
 * @property {(day: number) => number[]} [lowsOn]   minutes of low water on a core day (default: core/time model)
 * @property {(porchId: string) => boolean} [isPorchLit]   override porch state
 * @property {any} [tuning]
 */

// ---------------------------------------------------------------------------------------------
// Resolving `at`
// ---------------------------------------------------------------------------------------------

/**
 * Minutes of low water during a core day under the core/time model for the world's seed.
 * @param {World} world
 * @param {number} day core day
 * @returns {number[]} ascending, whole minutes of day
 */
export function lowsOn(world, day) {
  let offset = 0;
  try {
    offset = scheduleForSeed(world?.clock?.seed ?? null).tideOffset;
  } catch {
    offset = 0;
  }
  return waterOn(offset, day);
}

/**
 * @param {number} offset first low water (total minutes)
 * @param {number} day
 * @returns {number[]}
 */
function waterOn(offset, day) {
  const start = day * MINUTES_PER_DAY;
  const end = start + MINUTES_PER_DAY;
  const out = [];
  let k = Math.ceil((start - offset) / TIDE_PERIOD_MINUTES);
  for (let t = offset + k * TIDE_PERIOD_MINUTES; t < end; k++, t = offset + k * TIDE_PERIOD_MINUTES) {
    const m = Math.round(t - start);
    if (m >= 0 && m < MINUTES_PER_DAY) out.push(m);
  }
  return out;
}

/**
 * Start minutes of an entry's `at` on a core day (several for `{tide}`: one per low / high water).
 * @param {any} at
 * @param {World} world
 * @param {number} day core day
 * @param {ScheduleOpts} [opts]
 * @returns {number[]} minutes of day (may be empty)
 */
export function resolveAt(at, world, day, opts = {}) {
  if (typeof at === 'number') return Number.isFinite(at) ? [mod(Math.floor(at), MINUTES_PER_DAY)] : [];
  if (!at || typeof at !== 'object') return [];
  const offset = Number.isFinite(at.offset) ? Math.floor(at.offset) : 0;
  if (at.tide === 'low' || at.tide === 'high') {
    const lows = typeof opts.lowsOn === 'function' ? opts.lowsOn(day) : lowsOn(world, day);
    let mins = lows;
    if (at.tide === 'high') {
      // high water sits half a period after each low; collect those landing on this day
      const prevLows = typeof opts.lowsOn === 'function' ? opts.lowsOn(day - 1) : lowsOn(world, day - 1);
      const half = Math.round(TIDE_PERIOD_MINUTES / 2);
      mins = [...prevLows.map((m) => m + half - MINUTES_PER_DAY), ...lows.map((m) => m + half)]
        .filter((m) => m >= 0 && m < MINUTES_PER_DAY);
    }
    return mins.map((m) => m + offset).filter((m) => m >= 0 && m < MINUTES_PER_DAY).sort((a, b) => a - b);
  }
  if (typeof at.phase === 'string') {
    const rowP = PHASE_TABLE.find((p) => p.phase === at.phase && (at.phase !== 'night' || p.start > 0)) ?? PHASE_TABLE.find((p) => p.phase === at.phase);
    if (!rowP) return [];
    const m = rowP.start + offset;
    return m >= 0 && m < MINUTES_PER_DAY ? [m] : [];
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------------------------

/**
 * The NPC definition for an id or a def.
 * @param {string|any} npc
 * @param {any} data
 * @returns {any|null}
 */
export function npcDef(npc, data) {
  if (npc && typeof npc === 'object') return npc;
  if (typeof npc === 'string') return row(data, 'npcs', npc);
  return null;
}

/**
 * The NPC's schedule entries: its own `schedule` plus any `templates` (`[{id, mapId, x, y,
 * facing?}]` naming `schedules` rows of kind `template`, whose entries take the given spot when they
 * name none).
 * @param {any} npc
 * @param {any} data
 * @returns {any[]}
 */
export function expandSchedule(npc, data) {
  const own = Array.isArray(npc?.schedule) ? npc.schedule : [];
  const uses = Array.isArray(npc?.templates) ? npc.templates : [];
  if (!uses.length) return own;
  const out = own.slice();
  for (const use of uses) {
    const tpl = rows(data, 'schedules').find((s) => s && s.id === use?.id && s.kind === 'template');
    if (!tpl || !Array.isArray(tpl.entries)) continue;
    for (const e of tpl.entries) {
      out.push({ mapId: use.mapId, x: use.x, y: use.y, facing: use.facing, ...e });
    }
  }
  return out;
}

/**
 * Whether an entry's filters hold on a core day (weekday, GDD day range, weather, cond).
 * @param {any} e
 * @param {World} world
 * @param {any} data
 * @param {number} day core day
 * @param {Readonly<typeof DEFAULTS>} t
 * @param {string} npcId
 * @returns {boolean}
 */
function entryApplies(e, world, data, day, t, npcId) {
  if (Array.isArray(e.days) && !e.days.includes(dowOf(day, t))) return false;
  const gd = gameDay(day, t);
  if (isInt(e.fromDay) && gd < e.fromDay) return false;
  if (isInt(e.toDay) && gd > e.toDay) return false;
  if (Array.isArray(e.weather) && !e.weather.includes(weatherNow(world))) return false;
  return holds(world, e.cond, data, { npc: npcId, mapId: e.mapId ?? null });
}

/**
 * @typedef {Object} EntryHit
 * @property {any} entry
 * @property {number} index        index in the expanded schedule
 * @property {number} since        start minute of day of the running occurrence
 * @property {number} startDay     core day the occurrence started on
 */

/**
 * The running schedule entry: among every occurrence (today's, and earlier days' for entries that
 * run past midnight), the one with the latest start at or before now whose `for` window (if any)
 * has not ended. Ties go to the later entry in the list. Entries whose filters fail on the day they
 * would start are skipped.
 * @param {string|any} npc
 * @param {World} world
 * @param {any} data
 * @param {number} [minute]   minute of day (default: the world clock's)
 * @param {ScheduleOpts} [opts]
 * @returns {EntryHit|null}
 */
export function entryAt(npc, world, data, minute, opts = {}) {
  const def = npcDef(npc, data);
  if (!def) return null;
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const m = minuteNow(world, { minute: minute ?? opts.minute });
  const now = day * MINUTES_PER_DAY + m;
  const entries = expandSchedule(def, data);
  /** @type {EntryHit|null} */
  let best = null;
  let bestStart = -Infinity;
  for (let back = 0; back <= t.scheduleLookbackDays; back++) {
    const d = day - back;
    // nothing from an older day can beat a hit already found on a newer one
    if (best && (d + 1) * MINUTES_PER_DAY <= bestStart) break;
    entries.forEach((e, index) => {
      if (!e || typeof e !== 'object') return;
      const starts = resolveAt(e.at, world, d, opts);
      if (!starts.length || !entryApplies(e, world, data, d, t, def.id)) return;
      for (const s of starts) {
        const abs = d * MINUTES_PER_DAY + s;
        if (abs > now) continue;
        if (Number.isFinite(e.for) && e.for >= 0 && now >= abs + e.for) continue;
        if (abs > bestStart || (abs === bestStart && best && index >= best.index)) {
          best = { entry: e, index, since: s, startDay: d };
          bestStart = abs;
        }
      }
    });
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Festivals, porches, shops
// ---------------------------------------------------------------------------------------------

/**
 * Festival rows: the content's `festivals` table when it has rows, else `tuning.festivals`.
 * @param {any} data
 * @param {{tuning?: any}} [opts]
 * @returns {FestivalRow[]}
 */
export function festivalRows(data, opts) {
  const table = rows(data, 'festivals');
  return table.length ? table : tuningOf(data, opts).festivals;
}

/**
 * @typedef {Object} ActiveFestival
 * @property {FestivalRow} row
 * @property {number} startDay   core day this occurrence started
 * @property {number} since      start minute of day
 */

/**
 * Festivals running at a moment.
 * @param {World} world
 * @param {any} data
 * @param {ScheduleOpts} [opts]
 * @returns {ActiveFestival[]}
 */
export function activeFestivals(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const m = minuteNow(world, opts);
  const out = [];
  for (const f of festivalRows(data, opts)) {
    if (!f || typeof f.id !== 'string') continue;
    const start = windowStartDay(day, m, [f.from, f.to]);
    if (start === null) continue;
    const gd = gameDay(start, t);
    if (Array.isArray(f.dow) && !f.dow.includes(dowOf(start, t))) continue;
    if (Array.isArray(f.days) && !f.days.includes(gd)) continue;
    if (isInt(f.fromDay) && gd < f.fromDay) continue;
    if (!holds(world, f.cond, data)) continue;
    out.push({ row: f, startDay: start, since: f.from });
  }
  return out;
}

/**
 * Whether a festival is running now.
 * @param {string} festivalId
 * @param {World} world
 * @param {any} data
 * @param {ScheduleOpts} [opts]
 * @returns {boolean}
 */
export function isFestival(festivalId, world, data, opts) {
  return activeFestivals(world, data, opts).some((f) => f.row.id === festivalId);
}

/**
 * The Porch Supper host for the GDD week containing a core day: the explicit rotation
 * (`porchSupperHosts`) or every neighbour porch lit that day (sorted by npc id), indexed by GDD week.
 * @param {World} world
 * @param {any} data
 * @param {number} day core day
 * @param {ScheduleOpts} [opts]
 * @returns {{npcId: string, porch: import('./townCommon.js').PorchRow}|null}
 */
export function porchSupperHost(world, data, day, opts = {}) {
  const t = tuningOf(data, opts);
  const porches = porchesOf(data).filter((p) => p.npcId && p.mapId);
  const lit = porches.filter((p) => isPorchLit(world, data, p.id, opts));
  const pool = t.porchSupperHosts.length
    ? t.porchSupperHosts.map((id) => lit.find((p) => p.npcId === id)).filter(Boolean)
    : lit.slice().sort((a, b) => (a.npcId < b.npcId ? -1 : a.npcId > b.npcId ? 1 : 0));
  if (!pool.length) return null;
  const week = Math.floor((gameDay(day, t) - 1) / WEEK);
  const porch = pool[mod(week, pool.length)];
  return { npcId: /** @type {string} */ (porch.npcId), porch };
}

/**
 * Whether the NPC sits on its porch now (layer 4): it has a porch with a map, the minute is inside
 * its window (`npc.porch.hours` or `porchWindow`), the window started on one of `npc.porch.days`
 * (GDD weekday), the porch is lit (unless `npc.porch.evenUnlit`) and `npc.porch.cond` holds.
 * @param {string|any} npc
 * @param {World} world
 * @param {any} data
 * @param {ScheduleOpts} [opts]
 * @returns {boolean}
 */
export function onPorch(npc, world, data, opts = {}) {
  const def = npcDef(npc, data);
  const p = def?.porch;
  if (!p || typeof p !== 'object' || typeof p.mapId !== 'string') return false;
  const t = tuningOf(data, opts);
  const win = Array.isArray(p.hours) && p.hours.length === 2 ? p.hours : t.porchWindow;
  const start = windowStartDay(coreDay(world, opts), minuteNow(world, opts), win);
  if (start === null) return false;
  if (Array.isArray(p.days) && !p.days.includes(dowOf(start, t))) return false;
  const porchId = typeof p.id === 'string' ? p.id : def.id;
  if (!p.evenUnlit && !isPorchLit(world, data, porchId, opts)) return false;
  return holds(world, p.cond, data, { npc: def.id, mapId: p.mapId });
}

/**
 * Whether the porch-talk window is open now (any porch; GDD-00 §5).
 * @param {World} world
 * @param {any} data
 * @param {ScheduleOpts} [opts]
 * @returns {boolean}
 */
export function porchTalkOpen(world, data, opts = {}) {
  return inWindow(minuteNow(world, opts), tuningOf(data, opts).porchWindow);
}

/**
 * Whether a shop is open, by the same rules as systems/shops `isOpen`: its `hours: [open, close)`
 * (minutes; wraps past midnight when close < open; open === close (mod 1440), e.g. `[0, 1440]`,
 * means always open), its `fromDay` (GDD day; tested on the day the opening started, so the Raft's
 * after-midnight hours count as the evening's day) and its optional `cond`.
 * @param {string|any} shop   shop id or row
 * @param {World} world
 * @param {any} data
 * @param {ScheduleOpts} [opts]
 * @returns {boolean}
 */
export function isShopOpen(shop, world, data, opts = {}) {
  const s = typeof shop === 'string' ? row(data, 'shops', shop) : shop;
  if (!s || !Array.isArray(s.hours) || s.hours.length !== 2 || !s.hours.every((h) => Number.isFinite(h))) return false;
  const open = mod(Math.floor(s.hours[0]), MINUTES_PER_DAY);
  const close = mod(Math.floor(s.hours[1]), MINUTES_PER_DAY);
  const day = coreDay(world, opts);
  const minute = minuteNow(world, opts);
  let startDay = day;
  if (open !== close) {
    const start = windowStartDay(day, minute, [open, close]);
    if (start === null) return false;
    startDay = start;
  }
  if (isInt(s.fromDay) && gameDay(startDay, tuningOf(data, opts)) < s.fromDay) return false;
  return holds(world, s.cond, data);
}

// ---------------------------------------------------------------------------------------------
// whereIs
// ---------------------------------------------------------------------------------------------

/**
 * @param {any} spot
 * @param {Partial<Placement>} extra
 * @returns {Placement}
 */
function place(spot, extra) {
  return {
    mapId: spot.mapId,
    x: isInt(spot.x) ? spot.x : 0,
    y: isInt(spot.y) ? spot.y : 0,
    facing: typeof spot.facing === 'string' ? spot.facing : 'down',
    pose: typeof spot.pose === 'string' ? spot.pose : 'stand',
    pathId: typeof spot.path === 'string' ? spot.path : null,
    since: 0,
    wanderR: isInt(spot.wanderR) ? spot.wanderR : null,
    activity: typeof spot.activity === 'string' ? spot.activity : (typeof spot.pose === 'string' ? spot.pose : 'stand'),
    source: 'schedule',
    entryIndex: -1,
    festivalId: null,
    ...extra,
  };
}

/**
 * Where an NPC should be now (see the module comment for the layer order). Returns `null` when the
 * NPC is absent or unknown.
 * @param {string|any} npc   npc id or def
 * @param {World} world
 * @param {any} data
 * @param {ScheduleOpts} [opts]
 * @returns {Placement|null}
 */
export function whereIs(npc, world, data, opts = {}) {
  const def = npcDef(npc, data);
  if (!def || typeof def.id !== 'string') return null;
  if (def.absent !== undefined && holds(world, def.absent, data, { npc: def.id })) return null;
  const day = coreDay(world, opts);
  const minute = minuteNow(world, opts);
  const o = { ...opts, day, minute };

  // (2) festivals
  for (const f of activeFestivals(world, data, o)) {
    const spot = def.festivals?.[f.row.id];
    if (f.row.host === 'porch') {
      const host = porchSupperHost(world, data, f.startDay, o);
      if (!host) continue;
      if (host.npcId !== def.id && !spot) continue;
      const guests = rows(data, 'npcs').filter((n) => n && n.id !== host.npcId && n.festivals?.[f.row.id]).map((n) => n.id);
      const k = host.npcId === def.id ? 0 : guests.indexOf(def.id) + 1;
      const off = spot && typeof spot === 'object' && (isInt(spot.dx) || isInt(spot.dy))
        ? { dx: spot.dx ?? 0, dy: spot.dy ?? 0 }
        : { dx: k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2), dy: 0 };
      const hp = host.porch;
      return place({ mapId: hp.mapId, x: hp.x + off.dx, y: hp.y + off.dy, facing: hp.facing, pose: 'sit' },
        { since: f.since, source: 'festival', activity: `festival:${f.row.id}`, festivalId: f.row.id, pose: 'sit' });
    }
    if (spot && typeof spot === 'object' && typeof spot.mapId === 'string') {
      return place(spot, { since: f.since, source: 'festival', activity: spot.activity ?? `festival:${f.row.id}`, festivalId: f.row.id });
    }
  }

  // (3) the running entry, when it is marked priority
  const hit = entryAt(def, world, data, minute, o);
  if (hit && hit.entry.priority === 'high' && typeof hit.entry.mapId === 'string') {
    return place(hit.entry, { since: hit.since, source: 'priority', entryIndex: hit.index });
  }

  // (4) porch talk
  if (onPorch(def, world, data, o)) {
    const p = def.porch;
    const win = Array.isArray(p.hours) && p.hours.length === 2 ? p.hours : tuningOf(data, o).porchWindow;
    return place({ ...p, pose: p.pose ?? 'porch' }, { since: win[0], source: 'porch', activity: 'porch' });
  }

  // (5) shop post
  const post = def.shopPost;
  if (post && typeof post === 'object' && typeof post.mapId === 'string') {
    const shop = row(data, 'shops', post.shopId ?? def.shopId ?? '');
    if (shop && isShopOpen(shop, world, data, o)) {
      return place({ ...post, pose: post.pose ?? 'shop' }, { since: shop.hours[0], source: 'shop', activity: 'shop' });
    }
  }

  // (6) schedule
  if (hit && typeof hit.entry.mapId === 'string') {
    return place(hit.entry, { since: hit.since, source: 'schedule', entryIndex: hit.index });
  }

  // (7) home
  const home = def.homeSpot && typeof def.homeSpot === 'object' ? def.homeSpot : { mapId: def.home, x: 0, y: 0 };
  if (typeof home.mapId !== 'string' || !home.mapId) return null;
  return place({ pose: 'stand', ...home }, { since: 0, source: 'home', activity: 'home' });
}

/**
 * Every NPC whose placement is on `mapId` now (for map entry). NPCs are taken from `opts.npcIds`
 * or the whole `npcs` table.
 * @param {World} world
 * @param {any} data
 * @param {string} mapId
 * @param {ScheduleOpts & {npcIds?: string[]}} [opts]
 * @returns {Array<{npcId: string, placement: Placement}>}
 */
export function npcsOnMap(world, data, mapId, opts = {}) {
  const ids = Array.isArray(opts.npcIds) ? opts.npcIds : rows(data, 'npcs').map((n) => n?.id).filter((id) => typeof id === 'string');
  const out = [];
  for (const id of ids) {
    const placement = whereIs(id, world, data, opts);
    if (placement && placement.mapId === mapId) out.push({ npcId: id, placement });
  }
  return out;
}

/**
 * The tiles of a placement's named route (`schedules` row of kind `path`, `points: [[x, y]]`), as
 * `world/npc.js` `ctx.route` wants them; `null` when the placement has no route or the row is
 * missing or on another map.
 * @param {Placement|null} placement
 * @param {any} data
 * @returns {Array<{x: number, y: number}>|null}
 */
export function routeFor(placement, data) {
  if (!placement || typeof placement.pathId !== 'string') return null;
  const r = rows(data, 'schedules').find((s) => s && s.id === placement.pathId && s.kind === 'path');
  if (!r || !Array.isArray(r.points) || (typeof r.mapId === 'string' && r.mapId !== placement.mapId)) return null;
  return r.points.filter((p) => Array.isArray(p) && isInt(p[0]) && isInt(p[1])).map(([x, y]) => ({ x, y }));
}

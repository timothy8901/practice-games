/**
 * Pure read helpers over the world (ARCHITECTURE §1 manifest: curveLevel, partyAlive, loanTier,
 * hasBadge, hour, tideState, and friends). Nothing here mutates; nothing here imports data tables.
 * Time helpers derive from `world.clock.total` (core/time's serialized minute counter) so they work
 * in Node without a live clock. The tide model mirrors core/time's defaults: semi-diurnal, period
 * 12 h 25 m, seeded offset; `clockSys` is the live source of truth in the browser and these agree
 * with it at the moment `world.clock` was serialized.
 *
 * Lane: STATE.
 * @module state/selectors
 */

import {
  MINUTES_PER_DAY, MINUTES_PER_HOUR, DAYS_PER_WEEK, phaseOfMinute, formatMinute,
  tideAt, tideStateAt, scheduleForSeed, DEFAULT_LOW_TIDE, DEFAULT_HIGH_TIDE,
} from '../core/time.js';

/** @typedef {import('./schema.js').World} World */
/** @typedef {import('./schema.js').Creature} Creature */
/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {import('../core/time.js').Phase} DayPhase */

// --- time ---------------------------------------------------------------------------------------

/**
 * Total in-game minutes since 00:00 of day 0 (`world.clock.total`; 0 when unreadable).
 * @param {World} world
 * @returns {number}
 */
export function totalMinutes(world) {
  const t = world?.clock?.total;
  return Number.isFinite(t) && t >= 0 ? t : 0;
}

/**
 * Day number of this run (0-based core day; day 0 is the arrival). `world.clock.total` counts from
 * the start of the run under every clock setting, Real Clock included (core/time keeps the wall
 * clock's calendar offset out of the serialized total, LG-RN70), so this is always run-relative.
 * @param {World} world
 * @returns {number}
 */
export function day(world) {
  return Math.floor(totalMinutes(world) / MINUTES_PER_DAY);
}

/**
 * The GDD's day number of this run (1-based: the arrival is day 1, a Sunday; the first Lantern
 * Market is day 7). The cond DSL's `{day}` reads this (MID-07), as do the town systems' `fromDay`
 * fields and systems/clockSys `gameDay`.
 * @param {World} world
 * @returns {number}
 */
export function gameDay(world) {
  return day(world) + 1;
}

/**
 * Minute of day, `[0, 1440)` (may be fractional).
 * @param {World} world
 * @returns {number}
 */
export function minuteOfDay(world) {
  return totalMinutes(world) % MINUTES_PER_DAY;
}

/**
 * Hour of day, integer `0..23`.
 * @param {World} world
 * @returns {number}
 */
export function hour(world) {
  return Math.floor(minuteOfDay(world) / MINUTES_PER_HOUR) % 24;
}

/**
 * Weekday of core day 0 (`0 = Monday`): GDD-00 §5 makes day 1, the arrival, a Sunday, so Saturdays
 * are GDD days 7, 14, 21 (core days 6, 13, 20). Same calendar as systems/clockSys `weekday` and the
 * town systems' `calendarFirstDow`.
 */
export const DAY0_WEEKDAY = 6;

/**
 * Day of week on the GDD calendar, `0 = Monday … 6 = Sunday` (core day 0 is a Sunday). The game
 * clock's weekday; under Real Clock, systems/clockSys `weekday` gives the device's.
 * @param {World} world
 * @returns {number}
 */
export function dayOfWeek(world) {
  return (day(world) + DAY0_WEEKDAY) % DAYS_PER_WEEK;
}

/**
 * Day phase (core/time's bands).
 * @param {World} world
 * @returns {DayPhase}
 */
export function phase(world) {
  return phaseOfMinute(minuteOfDay(world));
}

/**
 * Dark outside: `evening` or `night` (same rule as `clock.isNight`).
 * @param {World} world
 * @returns {boolean}
 */
export function isNight(world) {
  const p = phase(world);
  return p === 'night' || p === 'evening';
}

/**
 * `HH:MM` of the world clock.
 * @param {World} world
 * @param {{hour12?: boolean}} [opts]
 * @returns {string}
 */
export function formatTime(world, opts) {
  return formatMinute(Math.floor(minuteOfDay(world)), opts);
}

// --- tide ---------------------------------------------------------------------------------------

/** Tide height at or below which the state is `low` (core/time default). */
export const LOW_TIDE = DEFAULT_LOW_TIDE;
/** Tide height at or above which the state is `high` (core/time default). */
export const HIGH_TIDE = DEFAULT_HIGH_TIDE;

/**
 * The per-seed tide offset core/time uses for this world (`world.clock.seed`).
 * @param {World} world
 * @returns {number}
 */
function tideOffsetOf(world) {
  try {
    return scheduleForSeed(world?.clock?.seed ?? null).tideOffset;
  } catch {
    return 0;
  }
}

/**
 * Tide height `0..1` (0 = low, 1 = high) at the world's current minute; the same model core/time
 * runs, so it agrees with the live clock at the moment `world.clock` was serialized.
 * @param {World} world
 * @param {number} [atTotal] total minutes to evaluate instead of now
 * @returns {number}
 */
export function tide(world, atTotal = totalMinutes(world)) {
  return tideAt(atTotal, tideOffsetOf(world));
}

/**
 * Tide state at the world's current minute.
 * @param {World} world
 * @param {number} [atTotal]
 * @returns {TideState}
 */
export function tideState(world, atTotal = totalMinutes(world)) {
  return tideStateAt(atTotal, tideOffsetOf(world));
}

/**
 * @param {World} world
 * @returns {boolean}
 */
export function isLowTide(world) {
  return tideState(world) === 'low';
}

// --- player / run -------------------------------------------------------------------------------

/**
 * Creatures with hp > 0 in the party.
 * @param {World} world
 * @returns {Creature[]}
 */
export function partyAlive(world) {
  return (world?.party ?? []).filter((c) => c && c.hp > 0);
}

/**
 * Whether at least one party member can fight.
 * @param {World} world
 * @returns {boolean}
 */
export function hasAliveParty(world) {
  return partyAlive(world).length > 0;
}

/**
 * The party's lead (first alive, else first), or `null`.
 * @param {World} world
 * @returns {Creature|null}
 */
export function lead(world) {
  return partyAlive(world)[0] ?? world?.party?.[0] ?? null;
}

/**
 * Finds a creature by uid in party or box.
 * @param {World} world
 * @param {string} uid
 * @returns {Creature|null}
 */
export function creatureByUid(world, uid) {
  return (world?.party ?? []).find((c) => c.uid === uid) ?? (world?.box ?? []).find((c) => c.uid === uid) ?? null;
}

/**
 * Highest level in the party (0 when empty).
 * @param {World} world
 * @returns {number}
 */
export function partyMaxLevel(world) {
  return (world?.party ?? []).reduce((m, c) => Math.max(m, c?.level ?? 0), 0);
}

/**
 * Curve level of where the player stands: the current map's region level band when the registry
 * knows it (`maps[mapId].region` -> `regions[region].curveLevel`), else the party's highest level,
 * else 1. Encounter tables, Shift windows and EXP catch-up read this.
 * @param {World} world
 * @param {{has: Function, get: Function}|null} [data]
 * @returns {number}
 */
export function curveLevel(world, data) {
  const mapId = world?.player?.mapId;
  if (data && typeof data.has === 'function' && typeof data.get === 'function' && mapId) {
    try {
      if (data.has('maps', mapId)) {
        const region = data.get('maps', mapId)?.region;
        if (typeof region === 'string' && data.has('regions', region)) {
          const lvl = data.get('regions', region)?.curveLevel;
          if (Number.isInteger(lvl) && lvl > 0) return lvl;
        }
      }
    } catch {
      // a registry that throws on unknown tables is treated as not knowing
    }
  }
  return Math.max(1, partyMaxLevel(world));
}

/**
 * @param {World} world
 * @returns {number}
 */
export function loanTier(world) {
  return world?.loans?.tier ?? 1;
}

/**
 * @param {World} world
 * @param {string} spireId
 * @returns {boolean}
 */
export function hasBadge(world, spireId) {
  return (world?.badges ?? []).includes(spireId);
}

/**
 * @param {World} world
 * @returns {number}
 */
export function badgeCount(world) {
  return world?.badges?.length ?? 0;
}

/**
 * Whether a challenge id is active for this run.
 * @param {World} world
 * @param {string} id e.g. `'no-rewind'`
 * @returns {boolean}
 */
export function hasChallenge(world, id) {
  return (world?.run?.challenges ?? []).includes(id);
}

/**
 * Item ids that are wallet currencies (data/items.js rows with `wallet`), for callers without a
 * registry. With one, the row's own `wallet` field decides.
 */
export const WALLET_ITEMS = Object.freeze({ starsalt: 'starsalt', 'anchor-stone': 'anchors' });

/**
 * How many of an item the player holds: stacks across every pocket, or for a currency item
 * (Starsalt, Anchor Stones: counted in the wallet, never a stack) the wallet balance (LG-RN34).
 * @param {World} world
 * @param {string} itemId
 * @param {{has?: (t: string, id: string) => boolean, get?: (t: string, id: string) => any}|null} [data]
 * @returns {number}
 */
export function itemCount(world, itemId, data = null) {
  const row = data && typeof data.has === 'function' && data.has('items', itemId) ? data.get('items', itemId) : null;
  const currency = row ? (typeof row.wallet === 'string' ? row.wallet : null) : WALLET_ITEMS[itemId] ?? null;
  if (currency) {
    const v = world?.wallet?.[currency];
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  let n = 0;
  for (const stacks of Object.values(world?.bag?.pockets ?? {})) {
    for (const s of stacks) if (s.id === itemId) n += s.n;
  }
  return n;
}

/**
 * The Shift Tide line (GDD-00 §2, the Relighting's `lit.shiftTide` rule; GDD-09 §3 Tide Table): after
 * the Relighting every pending Shift window is chalked a tide ahead on the Tide Table and the Day
 * Page. One row per pending window (`world.pendingShifts` order; party, then box), carrying what the
 * `board.shiftTideLine` string fills ({nick}); [] before the Relighting.
 * @param {World} world
 * @returns {Array<{uid: string, nick: string, speciesId: string, level: number}>}
 */
export function shiftTideLines(world) {
  if (!world?.flags?.['lit.shiftTide']) return [];
  const all = [...(world.party ?? []), ...(world.box ?? [])];
  const out = [];
  for (const uid of world.pendingShifts ?? []) {
    const c = all.find((x) => x && x.uid === uid);
    if (c) out.push({ uid, nick: c.nickname ?? c.speciesId, speciesId: c.speciesId, level: c.level });
  }
  return out;
}

/**
 * Letters delivered but not yet read, ascending. Uses `letters.got` (v4: letters arrive on three
 * channels, out of number order); a record without it falls back to `1..delivered`.
 * @param {World} world
 * @returns {number[]}
 */
export function unreadLetters(world) {
  const read = new Set(world?.letters?.read ?? []);
  const got = world?.letters?.got;
  if (Array.isArray(got)) return got.filter((n) => !read.has(n)).sort((a, b) => a - b);
  const out = [];
  for (let n = 1; n <= (world?.letters?.delivered ?? 0); n++) if (!read.has(n)) out.push(n);
  return out;
}

/**
 * Map state for `mapId` or a read-only empty view (never writes into the world).
 * @param {World} world
 * @param {string} mapId
 * @returns {import('./schema.js').MapState}
 */
export function mapState(world, mapId) {
  return world?.maps?.[mapId] ?? { visited: false, picked: {}, trees: {}, cracks: {}, reach: {}, reachAt: {}, opened: [] };
}

/**
 * Field-log state of a form: `'unknown' | 'seen' | 'read' | 'held'` (highest reached).
 * @param {World} world
 * @param {string} formId
 * @returns {'unknown'|'seen'|'read'|'held'}
 */
export function fieldLogState(world, formId) {
  const e = world?.fieldLog?.forms?.[formId];
  if (!e) return 'unknown';
  if (e.held) return 'held';
  if (e.read) return 'read';
  if (e.seen) return 'seen';
  return 'unknown';
}

/**
 * Whether a script has been seen (flag `seen.<scriptId>`).
 * @param {World} world
 * @param {string} scriptId
 * @returns {boolean}
 */
export function hasSeen(world, scriptId) {
  return world?.flags?.[`seen.${scriptId}`] === true;
}

/**
 * A short place label for save summaries and the HUD: the map id (display names live in data).
 * @param {World} world
 * @returns {string}
 */
export function placeLabel(world) {
  return world?.player?.mapId || '—';
}

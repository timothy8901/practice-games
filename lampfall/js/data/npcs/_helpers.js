/**
 * Builders for the cast modules (GDD-06). [DATA-CAST]
 *
 * Every placement in a cast file goes through {@link spot}: a NAMED MARKER on a real map
 * (GDD-01 §1.5), never a raw coordinate, so nobody is ever stood inside a wall or the sea. The
 * builders return plain frozen-friendly objects; no function values reach the exported rows.
 *
 * Calendar: GDD weekdays, 0 = Monday … 6 = Sunday (day 1 is a Sunday, state/selectors
 * DAY0_WEEKDAY). Minutes of day: {@link hm}.
 * @module data/npcs/_helpers
 */

import { MAPS_BY_ID } from '../maps/index.js';

/** Weekday ids (GDD calendar, 0 = Monday). */
export const MON = 0;
export const TUE = 1;
export const WED = 2;
export const THU = 3;
export const FRI = 4;
export const SAT = 5;
export const SUN = 6;
/** Monday to Friday. */
export const WEEKDAYS = Object.freeze([MON, TUE, WED, THU, FRI]);
/** Saturday and Sunday. */
export const WEEKEND = Object.freeze([SAT, SUN]);

/** The twelve ordinary types, lowercase (line tags `lead:<type>`). */
export const TYPES12 = Object.freeze(['plain', 'grit', 'brine', 'kiln', 'moss', 'bolt', 'rime', 'gust', 'stone', 'rust', 'glass', 'hollow']);

/**
 * Minute of day.
 * @param {number} h
 * @param {number} [m]
 * @returns {number}
 */
export const hm = (h, m = 0) => h * 60 + m;

/**
 * A named marker on a map, as `{mapId, x, y, facing, marker}`.
 * @param {string} mapId
 * @param {string} marker
 * @param {Record<string, any>} [extra]
 * @returns {{mapId: string, x: number, y: number, facing: string, marker: string}}
 * @throws {Error} when the map or marker does not exist (a content error caught at import)
 */
export function spot(mapId, marker, extra = {}) {
  const map = MAPS_BY_ID[mapId];
  if (!map) throw new Error(`npcs: no map '${mapId}'`);
  const mk = map.markers?.[marker];
  if (!mk) throw new Error(`npcs: no marker '${marker}' on '${mapId}'`);
  return { mapId, x: mk.x, y: mk.y, facing: mk.facing ?? 'down', marker, ...extra };
}

/**
 * A schedule entry at a named marker. `time` is a minute of day, `{tide, offset?}` or `{phase}`.
 * @param {number|{tide: string, offset?: number}|{phase: string}} time
 * @param {string} mapId
 * @param {string} marker
 * @param {Record<string, any>} [extra]   pose, facing, days, weather, cond, for, path, wanderR, activity, priority
 * @returns {Record<string, any>}
 */
export function at(time, mapId, marker, extra = {}) {
  return { at: time, ...spot(mapId, marker), pose: 'stand', ...extra };
}

/** Shorthand for Pellwick, where most of the town lives. */
export const P = 'pellwick';

/**
 * A porch row for `npc.porch` (systems/schedule, townCommon `porchesOf`).
 * @param {string} id        PORCH_IDS id
 * @param {string} marker    the seat (a Pellwick marker)
 * @param {Record<string, any>} [extra]  litAtStart, hours, days, cond, facing
 * @returns {Record<string, any>}
 */
export function porch(id, marker, extra = {}) {
  return { id, ...spot(P, marker), facing: 'down', hours: [hm(20), hm(23)], ...extra };
}

/**
 * One line `{id, text, tags?, cond?}` (systems/memory pool entry).
 * @param {string} id
 * @param {string} text
 * @param {string[]} [tags]
 * @param {any} [cond]
 * @returns {{id: string, text: string, tags?: string[], cond?: any}}
 */
export function line(id, text, tags, cond) {
  const out = { id, text };
  if (tags && tags.length) out.tags = tags;
  if (cond !== undefined) out.cond = cond;
  return out;
}

/** Lines for a pool: `[[id, text], ...]` with shared tags and cond. */
export function pool(rows, tags, cond) {
  return rows.map(([id, text, c]) => line(id, text, tags, c ?? cond));
}

/** Morning lines (06:00–10:00; the registry's `morning` phase pool). */
export const morning = (rows) => pool(rows, ['day'], { hour: [6, 11] });
/** Evening lines (18:00–22:00; the registry's `evening` phase pool). */
export const evening = (rows) => pool(rows, ['night'], { hour: [18, 22] });
/** Late-night lines (22:00–06:00; the registry's `night` phase pool). */
export const night = (rows) => pool(rows, ['night'], { hour: [22, 6] });
/** Lines for one weather kind each: `{rain: '...', fog: '...', storm: '...'}`. */
export const weather = (byKind) => Object.entries(byKind).map(([k, text]) => line(`w-${k}`, text, [`weather:${k}`]));
/** Lines for the party lead's type: `{brine: '...', ...}`. */
export const leads = (byType) => Object.entries(byType).map(([ty, text]) => line(`lead-${ty}`, text, [`lead:${ty}`]));
/** A line when the lead has a Shifted form this neighbour has not remarked on yet. */
export const shift = (rows) => pool(rows, ['shift']);
/** Low-tide lines. */
export const lowTide = (rows) => pool(rows, ['generic'], { lowTide: true });
/** Lines once the lamp is lit again. */
export const relit = (rows) => pool(rows, ['generic'], { flag: 'sp.relighting' });
/** Lines while the lamp is still dark. */
export const dark = (rows) => pool(rows, ['generic'], { not: { flag: 'sp.relighting' } });
/** Lines remembering a gift: `{itemId: '...'}`. */
export const gifted = (byItem) => Object.entries(byItem).map(([item, text]) => line(`gift-${item}`, text, [`gift:${item}`]));

/** Loan-tier conds: tier n open (loan n-1 paid). */
export const tier = (n) => ({ loan: { tier: { eq: n } } });
export const tierRange = (gte, lte) => ({ loan: { tier: { gte, lte } } });
/** Badge-count conds: exactly n badges. */
export const badges = (n) => (n >= 6 ? { badge: 6 } : { all: [{ badge: n }, { not: { badge: n + 1 } }] });

/**
 * A topic row.
 * @param {string} id
 * @param {string} script
 * @param {number} priority
 * @param {Record<string, any>} [extra]  cond, once, repeatDays, favour
 */
export function topic(id, script, priority, extra = {}) {
  return { id, script, priority, ...extra };
}

/**
 * A remembered choice: an `np.<npc>.<key>` flag (later conds branch on it) and the npc's memory.
 * @param {string} npc
 * @param {string} key
 * @param {string|boolean|number} value
 * @returns {any[]}
 */
export function mem(npc, key, value) {
  return [
    { op: 'setFlag', id: `np.${npc}.${key}`, value },
    { op: 'remember', npc, key, value },
  ];
}

/**
 * A Porch Duel offer script for a neighbour on the slate (town.js PORCH_DUELS). The slate sets
 * `sys.duel.<npc>` on the evening it posts them; the topic reads it.
 * @param {string} npc
 * @param {string} trainer   porch-* trainer id
 * @param {{ask: string, yes: string, no: string}} text
 * @returns {any[]}
 */
export function duelScript(npc, trainer, text) {
  return [
    text.ask,
    { op: 'choice', options: [
      { text: 'Friendly duel. Go on.', then: [text.yes, { op: 'startBattle', trainer, source: 'duel' }] },
      { text: 'Not tonight.', then: [text.no] },
    ], defaultIndex: 0 },
    { op: 'end' },
  ];
}

/** The Porch Duel topic for a neighbour (porch hours, the slate's flag, once a day). */
export function duelTopic(npc) {
  return topic('porch-duel', `talk-${npc}-duel`, 4, {
    cond: { all: [{ flag: `sys.duel.${npc}` }, { hour: [19, 1] }] },
    repeatDays: 1,
  });
}

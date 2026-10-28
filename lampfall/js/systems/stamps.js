/**
 * Journal stamp counters (GDD-05 §Journal; data/town.js STAMPS). [SYSTEMS]
 *
 * A stamp row may carry `counter: {id, on, match?}`: every bus event `on` whose payload matches
 * `match` adds 1 to the counter `id` (a `stamp.` counter in `world.counters`, through systems/flags),
 * and the row's `cond` (`{counter: id, gte: n}`) then reads that counter like any other cond.
 *
 * `match` is `{field: value}`; every field must hold. A value that is an array matches any of its
 * entries; `false` also matches an absent field (older emitters never sent it); anything else must be
 * equal. Payload fields the emitters do not send yet are derived where the data can say them:
 * `battle:end {trainerId}` gets `porchDuel` from the trainer row's class ('porch').
 *
 * {@link applyStampEvent} is pure (world in, counters out); {@link earnedStamps} lists the stamps whose
 * cond holds; {@link install} subscribes a game context's bus, one `store.tx` per counted event. Writes only through systems/flags (owner of `world.counters`).
 * @module systems/stamps
 */

import * as flags from './flags.js';
import { evalCond } from '../script/cond.js';

/** @typedef {{id: string, on: string, match?: Record<string, any>|null}} StampCounter */

/**
 * The counter rows of a stamp table, in table order (rows without a well-formed `counter` dropped;
 * an already-normalized `{id, on, match}` entry passes through).
 * @param {ReadonlyArray<any>|null|undefined} rows
 * @returns {StampCounter[]}
 */
export function stampCounters(rows) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const c = r && (r.counter ?? (typeof r.on === 'string' ? r : null));
    if (!c || typeof c.id !== 'string' || typeof c.on !== 'string' || !flags.isFlagId(c.id)) continue;
    out.push({ id: c.id, on: c.on, match: c.match && typeof c.match === 'object' ? c.match : null });
  }
  return out;
}

/**
 * Whether a payload matches a counter's `match`.
 * @param {Record<string, any>|null|undefined} match
 * @param {any} payload
 * @returns {boolean}
 */
export function matches(match, payload) {
  if (!match) return true;
  const p = payload && typeof payload === 'object' ? payload : {};
  for (const [k, want] of Object.entries(match)) {
    const got = p[k];
    if (Array.isArray(want)) { if (!want.includes(got)) return false; } else if (want === false) { if (got !== undefined && got !== false) return false; } else if (got !== want) return false;
  }
  return true;
}

/**
 * Fills payload fields the stamp rows match on that an emitter leaves out, from the data.
 * @param {string} evt
 * @param {any} payload
 * @param {any} [data]   Registry (`tryGet` / `get`) or tables
 * @returns {any}
 */
export function derivePayload(evt, payload, data) {
  if (evt === 'battle:end' && payload && typeof payload === 'object' && payload.porchDuel === undefined && typeof payload.trainerId === 'string') {
    const tr = trainerRow(data, payload.trainerId);
    if (tr) return { ...payload, porchDuel: tr.class === 'porch' };
  }
  return payload;
}

/**
 * Counts one bus event: every counter row listening to `evt` whose `match` holds is incremented.
 * @param {any} world
 * @param {ReadonlyArray<any>} rows    the stamp table (or {@link stampCounters} output)
 * @param {string} evt
 * @param {any} payload
 * @param {{bus?: any, data?: any}} [ctx]
 * @returns {Array<{id: string, value: number}>} the counters moved
 */
export function applyStampEvent(world, rows, evt, payload, ctx = {}) {
  const counters = stampCounters(rows);
  const p = derivePayload(evt, payload, ctx.data);
  const out = [];
  for (const c of counters) {
    if (c.on !== evt || !matches(c.match, p)) continue;
    out.push({ id: c.id, value: flags.inc(world, c.id, 1, { bus: ctx.bus ?? null }) });
  }
  return out;
}

/**
 * The events a stamp table listens to.
 * @param {ReadonlyArray<any>} rows
 * @returns {string[]}
 */
export function listenedEvents(rows) {
  return [...new Set(stampCounters(rows).map((c) => c.on))];
}

/**
 * The stamps whose `cond` holds now (for the Journal page and its `stamp.earned` toast), in table order.
 * A row whose cond cannot be read counts as not earned.
 * @param {any} world
 * @param {ReadonlyArray<any>} rows   the stamp table
 * @param {{data?: any}} [ctx]
 * @returns {string[]} stamp ids
 */
export function earnedStamps(world, rows, ctx = {}) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r.id !== 'string' || r.cond == null) continue;
    let ok = false;
    try { ok = Boolean(evalCond(world, r.cond, { data: ctx.data ?? null })); } catch { ok = false; }
    if (ok) out.push(r.id);
  }
  return out;
}

/**
 * Subscribes a game context: each counted event runs one `stamp:<event>` transaction.
 * @param {any} G   `{bus, store, data}`
 * @param {{rows?: ReadonlyArray<any>}} [opts]   the stamp table (default: `G.data`'s `stamps` table)
 * @returns {() => void} unsubscribe
 */
export function install(G, opts = {}) {
  const rows = opts.rows ?? tableOf(G.data, 'stamps');
  const counters = stampCounters(rows);
  const offs = [];
  for (const evt of listenedEvents(rows)) {
    offs.push(G.bus.on(evt, (payload) => {
      const p = derivePayload(evt, payload, G.data);
      if (!counters.some((c) => c.on === evt && matches(c.match, p))) return;
      G.store.tx(`stamp:${evt}`, (w) => applyStampEvent(w, counters, evt, p, { bus: G.bus, data: G.data }));
    }));
  }
  return () => { for (const off of offs) { try { off(); } catch { /* already gone */ } } };
}

/** @param {any} data @param {string} table @returns {any[]} */
function tableOf(data, table) {
  if (!data) return [];
  try { if (typeof data.list === 'function') return data.list(table) || []; } catch { /* no such table */ }
  const t = data[table];
  return Array.isArray(t) ? t : t && typeof t === 'object' ? Object.values(t) : [];
}

/** @param {any} data @param {string} id @returns {any|null} */
function trainerRow(data, id) {
  if (!data) return null;
  try { if (typeof data.tryGet === 'function') { const r = data.tryGet('trainers', id); if (r) return r; } } catch { /* fall through */ }
  try { if (typeof data.has === 'function' && data.has('trainers', id)) return data.get('trainers', id); } catch { /* fall through */ }
  const t = data.trainers;
  if (Array.isArray(t)) return t.find((r) => r && r.id === id) ?? null;
  return t && typeof t === 'object' ? (t[id] ?? null) : null;
}

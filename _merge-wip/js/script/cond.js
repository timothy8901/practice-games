/**
 * The condition DSL (ARCHITECTURE §6.4): one small language for every gate in the game. [SCRIPT]
 *
 * `evalCond(world, cond, ctx)` is pure and deterministic: no randomness, no mutation, no DOM. An
 * unknown key or malformed shape throws a TypeError (a programmer / author error the validator
 * catches statically through `validateCond`); a condition about something absent (an unmet npc, a
 * missing thread) is simply false.
 *
 * Shapes (one key per object; combine with `all` / `any` / `not`):
 *   boolean | {flag, is?} | {not} | {all} | {any} | {counter, gte?, lte?} | {hasItem, n?} |
 *   {wallet: {gte}} | {hour: [from, to)} | {phase: string[]} | {tide: TideState[]} | {lowTide: boolean} |
 *   {day: {gte?, dow?}} | {weather: string[]} | {loan: {tier?, paid?}} | {badge: string|number} |
 *   {letter: {read}} | {thread: {id, beat?, done?}} | {npc: {id, met?, talks?: {gte}, nickname?}} |
 *   {party: {has?, family?, level?: {gte}, size?: {gte}}} | {fieldLog: {form, state}} | {map} |
 *   {inRegion} | {dial: string[]} | {challenge} | {seen} | {tool}
 *
 * `loan.tier` accepts a number (current tier >= n) or `{gte, lte, eq}`. `hour: [a, b]` is a
 * half-open range of hours that wraps midnight when `a > b`.
 * @module script/cond
 */

import * as sel from '../state/selectors.js';
import { PHASES } from '../core/time.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {boolean | Record<string, any>} Cond */
/** @typedef {{data?: import('../data/registry.js').Registry|null, npc?: string|null, mapId?: string|null, x?: number, y?: number}} CondCtx */

/** Every key the DSL understands. */
export const COND_KEYS = Object.freeze([
  'flag', 'not', 'all', 'any', 'counter', 'hasItem', 'wallet', 'hour', 'phase', 'tide', 'lowTide', 'day',
  'weather', 'loan', 'badge', 'letter', 'thread', 'npc', 'party', 'fieldLog', 'map', 'inRegion', 'dial',
  'challenge', 'seen', 'tool',
]);

/** Modifier keys allowed beside the main key (`{flag, is}`, `{counter, gte, lte}`, `{hasItem, n}`). */
const MODIFIERS = Object.freeze({ flag: ['is'], counter: ['gte', 'lte'], hasItem: ['n'] });

/**
 * Finds the DSL key of a condition object (the one non-modifier key).
 * @param {Record<string, any>} cond
 * @returns {string|null}
 */
function keyOf(cond) {
  const keys = Object.keys(cond);
  const main = keys.filter((k) => COND_KEYS.includes(k));
  if (main.length !== 1) return null;
  const allowed = MODIFIERS[main[0]] ?? [];
  if (keys.some((k) => k !== main[0] && !allowed.includes(k))) return null;
  return main[0];
}

/**
 * @param {unknown} v
 * @param {{gte?: number, lte?: number, eq?: number}|number} range
 * @returns {boolean}
 */
function inRange(v, range) {
  if (typeof v !== 'number') return false;
  if (typeof range === 'number') return v >= range;
  if (!range || typeof range !== 'object') return false;
  if (range.eq !== undefined && v !== range.eq) return false;
  if (range.gte !== undefined && v < range.gte) return false;
  if (range.lte !== undefined && v > range.lte) return false;
  return true;
}

/**
 * Evaluates a condition against the world.
 * @param {World} world
 * @param {Cond} cond
 * @param {CondCtx} [ctx]
 * @returns {boolean}
 * @throws {TypeError} for a malformed condition
 */
export function evalCond(world, cond, ctx = {}) {
  if (cond === true || cond === false) return cond;
  if (cond === null || cond === undefined) return true;      // an absent cond always holds
  if (typeof cond !== 'object' || Array.isArray(cond)) throw new TypeError(`cond: expected a boolean or object, got ${JSON.stringify(cond)}`);
  const key = keyOf(cond);
  if (!key) throw new TypeError(`cond: malformed ${JSON.stringify(cond)} (one DSL key per object; keys: ${COND_KEYS.join(' ')})`);
  const v = cond[key];
  const data = ctx.data ?? null;
  switch (key) {
    case 'not': return !evalCond(world, v, ctx);
    case 'all': return v.every((c) => evalCond(world, c, ctx));
    case 'any': return v.some((c) => evalCond(world, c, ctx));
    case 'flag': {
      const f = world.flags?.[v];
      return 'is' in cond ? f === cond.is : Boolean(f);
    }
    case 'counter': {
      const n = world.counters?.[v] ?? 0;
      return inRange(n, { gte: cond.gte, lte: cond.lte });
    }
    case 'hasItem': return sel.itemCount(world, v) >= (cond.n ?? 1);
    case 'wallet': return inRange(world.wallet?.main ?? 0, v);
    case 'hour': {
      const h = sel.hour(world);
      const [a, b] = v;
      return a <= b ? h >= a && h < b : h >= a || h < b;
    }
    case 'phase': return v.includes(sel.phase(world));
    case 'tide': return v.includes(sel.tideState(world));
    case 'lowTide': return sel.isLowTide(world) === v;
    case 'day': {
      const d = sel.day(world);
      if (v.gte !== undefined && d < v.gte) return false;
      if (v.lte !== undefined && d > v.lte) return false;
      if (v.dow !== undefined && !v.dow.includes(sel.dayOfWeek(world))) return false;
      return true;
    }
    case 'weather': return v.includes(world.weather?.today);
    case 'loan': {
      const tier = sel.loanTier(world);
      if (v.tier !== undefined && !inRange(tier, v.tier)) return false;
      if (v.paid !== undefined) {
        const row = data && data.has('loans', `tier-${tier}`) ? data.get('loans', `tier-${tier}`) : null;
        const paid = row ? (world.loans?.paid ?? 0) >= row.amount : false;
        if (paid !== v.paid) return false;
      }
      return true;
    }
    case 'badge': return typeof v === 'number' ? sel.badgeCount(world) >= v : sel.hasBadge(world, v);
    case 'letter': return (world.letters?.read ?? []).includes(v.read);
    case 'thread': {
      const t = world.threads?.[v.id];
      if (!t) return false;
      if (v.beat !== undefined && !inRange(t.beat, v.beat)) return false;
      if (v.done !== undefined && t.done !== v.done) return false;
      return true;
    }
    case 'npc': {
      const m = world.npcs?.[v.id];
      if (v.met !== undefined && Boolean(m?.met) !== v.met) return false;
      if (v.talks !== undefined && !inRange(m?.talks ?? 0, v.talks)) return false;
      if (v.nickname !== undefined && Boolean(m?.nickname) !== v.nickname) return false;
      return true;
    }
    case 'party': {
      const party = world.party ?? [];
      if (v.has !== undefined && !party.some((c) => c.speciesId === v.has)) return false;
      if (v.family !== undefined && !party.some((c) => c.familyId === v.family)) return false;
      if (v.level !== undefined && !inRange(sel.partyMaxLevel(world), v.level)) return false;
      if (v.size !== undefined && !inRange(party.length, v.size)) return false;
      return true;
    }
    case 'fieldLog': {
      const order = ['unknown', 'seen', 'read', 'held'];
      return order.indexOf(sel.fieldLogState(world, v.form)) >= order.indexOf(v.state);
    }
    case 'map': return (ctx.mapId ?? world.player?.mapId) === v;
    case 'inRegion': {
      const mapId = ctx.mapId ?? world.player?.mapId;
      const x = ctx.x ?? world.player?.x;
      const y = ctx.y ?? world.player?.y;
      if (!data || !data.has('maps', mapId)) return false;
      const r = data.get('maps', mapId).regions?.[v];
      return Boolean(r) && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    }
    case 'dial': return v.includes(world.run?.dial);
    case 'challenge': return sel.hasChallenge(world, v);
    case 'seen': return sel.hasSeen(world, v);
    case 'tool': return world.player?.tool === v;
    default: throw new TypeError(`cond: unhandled key '${key}'`);
  }
}

/**
 * Static shape check (and, with a registry, reference check) for the validator. Returns problem
 * strings; empty means well-formed.
 * @param {unknown} cond
 * @param {{has?: (table: string, id: string) => boolean}} [opts]
 * @param {string} [path] prefix for nested messages
 * @returns {string[]}
 */
export function validateCond(cond, opts = {}, path = 'cond') {
  const out = [];
  const has = (table, id) => (opts.has ? opts.has(table, id) : true);
  const ref = (table, id, what) => { if (typeof id !== 'string') out.push(`${path}: ${what} must be an id string`); else if (!has(table, id)) out.push(`${path}: ${what} '${id}' is not in ${table}`); };
  const strs = (v, what) => { if (!Array.isArray(v) || v.length === 0 || v.some((s) => typeof s !== 'string')) out.push(`${path}: ${what} must be a non-empty string[]`); };
  const obj = (v, what) => { if (!v || typeof v !== 'object' || Array.isArray(v)) { out.push(`${path}: ${what} must be an object`); return false; } return true; };
  if (cond === null || cond === undefined || typeof cond === 'boolean') return out;
  if (typeof cond !== 'object' || Array.isArray(cond)) return [`${path}: expected a boolean or object, got ${JSON.stringify(cond)}`];
  const key = keyOf(cond);
  if (!key) return [`${path}: malformed ${JSON.stringify(cond)} (one DSL key per object)`];
  const v = cond[key];
  switch (key) {
    case 'not': out.push(...validateCond(v, opts, `${path}.not`)); break;
    case 'all': case 'any':
      if (!Array.isArray(v)) out.push(`${path}: ${key} must be an array of conds`);
      else v.forEach((c, i) => out.push(...validateCond(c, opts, `${path}.${key}[${i}]`)));
      break;
    case 'flag': case 'seen': case 'challenge': case 'tool': case 'map': case 'inRegion': case 'counter':
      if (typeof v !== 'string' || !v) out.push(`${path}: ${key} must be a non-empty string`);
      if (key === 'map') ref('maps', v, 'map');
      if (key === 'challenge') ref('challenges', v, 'challenge');
      if (key === 'seen') ref('scripts', v, 'seen script');
      if (key === 'tool') ref('items', v, 'tool');
      break;
    case 'hasItem': ref('items', v, 'hasItem'); if (cond.n !== undefined && typeof cond.n !== 'number') out.push(`${path}: hasItem.n must be a number`); break;
    case 'wallet': if (obj(v, 'wallet') && typeof v.gte !== 'number') out.push(`${path}: wallet.gte must be a number`); break;
    case 'hour': if (!Array.isArray(v) || v.length !== 2 || v.some((n) => typeof n !== 'number' || n < 0 || n > 24)) out.push(`${path}: hour must be [from, to] in 0..24`); break;
    case 'phase': strs(v, 'phase'); if (Array.isArray(v)) for (const s of v) if (typeof s === 'string' && !PHASES.includes(s)) out.push(`${path}: unknown phase '${s}' (${PHASES.join(' ')})`); break;
    case 'tide': strs(v, 'tide'); if (Array.isArray(v)) for (const s of v) if (!['low', 'rising', 'high', 'falling'].includes(s)) out.push(`${path}: unknown tide state '${s}'`); break;
    case 'weather': strs(v, 'weather'); break;
    case 'dial': strs(v, 'dial'); if (Array.isArray(v)) for (const s of v) if (typeof s === 'string' && !has('dials', s)) out.push(`${path}: dial '${s}' is not in dials`); break;
    case 'lowTide': if (typeof v !== 'boolean') out.push(`${path}: lowTide must be a boolean`); break;
    case 'day': if (obj(v, 'day') && v.dow !== undefined && (!Array.isArray(v.dow) || v.dow.some((d) => !Number.isInteger(d) || d < 0 || d > 6))) out.push(`${path}: day.dow must be integers 0..6`); break;
    case 'loan': if (obj(v, 'loan') && v.paid !== undefined && typeof v.paid !== 'boolean') out.push(`${path}: loan.paid must be a boolean`); break;
    case 'badge': if (!(typeof v === 'number' || typeof v === 'string')) out.push(`${path}: badge must be a spire id or a count`); break;
    case 'letter': if (obj(v, 'letter') && !Number.isInteger(v.read)) out.push(`${path}: letter.read must be an integer`); break;
    case 'thread': if (obj(v, 'thread')) ref('threads', v.id, 'thread.id'); break;
    case 'npc': if (obj(v, 'npc')) ref('npcs', v.id, 'npc.id'); break;
    case 'party':
      if (obj(v, 'party')) {
        if (v.has !== undefined) ref('species', v.has, 'party.has');
        if (v.family !== undefined) ref('families', v.family, 'party.family');
      }
      break;
    case 'fieldLog':
      if (obj(v, 'fieldLog')) {
        ref('species', v.form, 'fieldLog.form');
        if (!['seen', 'read', 'held'].includes(v.state)) out.push(`${path}: fieldLog.state must be seen|read|held`);
      }
      break;
    default: out.push(`${path}: unhandled key '${key}'`);
  }
  return out;
}

/**
 * Flag ids a condition reads (for the validator's "referenced flag is set somewhere" warning).
 * @param {Cond} cond
 * @param {Set<string>} [out]
 * @returns {Set<string>}
 */
export function flagsReadBy(cond, out = new Set()) {
  if (!cond || typeof cond !== 'object') return out;
  if (typeof cond.flag === 'string') out.add(cond.flag);
  if (cond.not) flagsReadBy(cond.not, out);
  for (const list of [cond.all, cond.any]) if (Array.isArray(list)) for (const c of list) flagsReadBy(c, out);
  return out;
}

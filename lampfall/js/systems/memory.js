/**
 * Neighbour memory (GDD-00 §10: "memory (5-day no-repeat lines, remembered gifts and choices) and
 * porch talk"; ARCHITECTURE §6.3). [SYS-TOWN]
 *
 * The only writer of `world.npcs` (tools/lint-owners). One record per NPC (`state/schema`
 * `NpcMemory`): `met, talks, lastTalkDay, lastPorchDay, nickname, nicknameChoice, affinity,
 * favours, saidLines, remembered, gifts, lastLineId, lingerDay, lastGiftDay`. Every stored day is a
 * CORE day (`selectors.day`).
 *
 * Lines and tags. {@link pickLine} chooses what an NPC says from `npc.lines` without writing:
 *  - every pool entry is `{id, text, tags?, cond?}` or a bare string (id `<pool><i+1>`, the
 *    `script/registry` convention, so both modules key `saidLines` the same way);
 *  - a line's tags all have to hold. When a line names no tags, its pool key supplies one
 *    (`generic`, `night`, `day`, `porch`, `shift`, `gift`; `weather-<kind>` -> `weather:<kind>`;
 *    `lead-<type>` -> `lead:<type>`; any other key -> `pose:<key>`);
 *  - tag vocabulary ({@link LINE_TAGS}): `generic`, `night`, `day`, `porch` (at the porch, in the
 *    porch window), `weather:<kind>`, `lead:<type>` (party lead's type), `shift` (the lead has a
 *    Shifted form this NPC has not remarked on yet, or `ctx.shiftHappened`), `pose:<pose>`, `gift`,
 *    `gift:<itemId>`, `nickname` (this NPC has a nickname for you), `known` (talked on an earlier day).
 *    An unknown tag never holds;
 *  - lines said within `noRepeatDays` are skipped (if every eligible line was, the least recently
 *    said one is used unless `strictNoRepeat`); the most specific line wins (`lineTagWeights`), then
 *    the least recently said, then an optional rng tie-break, else list order;
 *  - Linger (`ctx.linger`) skips the line just said and prefers another pool: the second topic.
 *
 * Pure: no DOM, no `Math.random` (randomness only through an injected rng).
 * @module systems/memory
 */

import { npcMemoryDefaults, NICKNAME_CHOICES } from '../state/schema.js';
import {
  resolveTuning, tuningSource, holds, emit, coreDay, minuteNow, inWindow, leadCreature, row, weatherNow,
} from './townCommon.js';
import { tuningOf as scheduleTuning } from './schedule.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').NpcMemory} NpcMemory */
/** @typedef {{emit: (evt: string, payload?: any) => any}} Bus */

/**
 * Designer numbers. [GDD values: noRepeatDays = 5 (GDD-00 §10); night 18:00–06:00 (§5)]
 */
export const DEFAULTS = Object.freeze({
  /** A line is not repeated within this many days (GDD-00 §10). */
  noRepeatDays: 5,
  /** Night for the `night` / `day` tags, minutes [from, to) wrapping midnight (GDD-00 §5). */
  nightWindow: Object.freeze([18 * 60, 6 * 60]),
  /** Affinity for the first talk of a day. */
  affinityPerTalkDay: 1,
  /** Extra affinity when that talk is porch talk. */
  affinityPorchBonus: 1,
  /** Affinity per gift reaction. */
  affinityGift: Object.freeze({ love: 3, like: 2, neutral: 1, dislike: -1 }),
  /** Gifts that count per NPC per day (later ones get the `again` reaction and no affinity). */
  giftsPerDay: 1,
  /** Longest counter-offered nickname. */
  nicknameMaxLength: 12,
  /** Linger second topics per NPC per day. */
  lingerPerDay: 1,
  /** Specificity weight per tag kind (the most specific eligible line wins). */
  lineTagWeights: Object.freeze({ porch: 8, shift: 6, lead: 5, gift: 4, weather: 4, pose: 3, nickname: 2, night: 2, known: 1, day: 1, generic: 0 }),
  /** true: when every eligible line was said within the window, say nothing new (null). */
  strictNoRepeat: false,
});

/** Every tuning key this module reads (`porchWindow` and the calendar keys come from systems/schedule). */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Tag kinds a line may carry (`kind` or `kind:arg`). */
export const LINE_TAGS = Object.freeze(['generic', 'night', 'day', 'porch', 'weather', 'lead', 'shift', 'pose', 'gift', 'nickname', 'known']);

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const SPEC = {
  noRepeatDays: [(v) => isInt(v) && v >= 0, 'integer >= 0'],
  nightWindow: [(v) => Array.isArray(v) && v.length === 2 && v.every((m) => isInt(m) && m >= 0 && m <= 1440), '[from, to] minutes'],
  affinityPerTalkDay: [isNum, 'number'],
  affinityPorchBonus: [isNum, 'number'],
  affinityGift: [(v) => v && typeof v === 'object' && ['love', 'like', 'neutral', 'dislike'].every((k) => isNum(v[k])), '{love, like, neutral, dislike} numbers'],
  giftsPerDay: [(v) => isInt(v) && v >= 0, 'integer >= 0'],
  nicknameMaxLength: [(v) => isInt(v) && v >= 1, 'integer >= 1'],
  lingerPerDay: [(v) => isInt(v) && v >= 0 && v <= 1, 'integer 0..1'],
  lineTagWeights: [(v) => v && typeof v === 'object' && Object.values(v).every(isNum), 'Record<tagKind, number>'],
  strictNoRepeat: [(v) => typeof v === 'boolean', 'boolean'],
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
  return resolveTuning(DEFAULTS, SPEC, tuningSource(data, opts), CACHE, 'memory');
}

/** @param {unknown} id */
function assertNpcId(id) {
  if (typeof id !== 'string' || id.length === 0) throw new TypeError(`memory: npc id must be a non-empty string, got ${JSON.stringify(id)}`);
}

// ---------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------

/**
 * A neighbour's memory, read-only: the stored record or a fresh default (never written).
 * @param {World} world
 * @param {string} npcId
 * @returns {NpcMemory}
 */
export function memoryOf(world, npcId) {
  const m = world?.npcs?.[npcId];
  return m && typeof m === 'object' ? m : npcMemoryDefaults();
}

/**
 * The stored record, creating it (with every key) on first use. Older records missing a v4 key get
 * it filled.
 * @param {World} world
 * @param {string} npcId
 * @returns {NpcMemory}
 */
export function ensure(world, npcId) {
  assertNpcId(npcId);
  const cur = world.npcs[npcId];
  if (!cur || typeof cur !== 'object') {
    world.npcs[npcId] = npcMemoryDefaults();
    return world.npcs[npcId];
  }
  const d = npcMemoryDefaults();
  for (const k of Object.keys(d)) if (cur[k] === undefined) cur[k] = d[k];
  return cur;
}

/**
 * @typedef {Object} TalkOpts
 * @property {number} [day]      core day (default: the world clock's)
 * @property {boolean} [porch]   this talk is porch talk
 * @property {Bus|null} [bus]
 * @property {any} [tuning]
 */

/**
 * Records a conversation: met, talks + 1, lastTalkDay, lastPorchDay (porch talk), and affinity for
 * the first talk of the day (+ the porch bonus). Emits `npc:talked {npcId, day, first, firstToday,
 * porch, talks}`.
 * @param {World} world
 * @param {string} npcId
 * @param {any} [data]
 * @param {TalkOpts} [opts]
 * @returns {{first: boolean, firstToday: boolean, talks: number, affinity: number}}
 */
export function talk(world, npcId, data, opts = {}) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const m = ensure(world, npcId);
  const first = !m.met;
  const firstToday = m.lastTalkDay !== day;
  m.met = true;
  m.talks += 1;
  m.lastTalkDay = day;
  if (firstToday) m.affinity += t.affinityPerTalkDay;
  if (opts.porch) {
    if (m.lastPorchDay !== day) m.affinity += t.affinityPorchBonus;
    m.lastPorchDay = day;
  }
  emit(opts.bus, 'npc:talked', { npcId, day, first, firstToday, porch: Boolean(opts.porch), talks: m.talks });
  return { first, firstToday, talks: m.talks, affinity: m.affinity };
}

/**
 * Day the player last talked to an NPC (-1 never).
 * @param {World} world
 * @param {string} npcId
 * @returns {number}
 */
export function lastTalked(world, npcId) {
  return memoryOf(world, npcId).lastTalkDay;
}

/**
 * NPC ids the player talked to on a core day.
 * @param {World} world
 * @param {number} day
 * @returns {string[]} sorted
 */
export function talkedOn(world, day) {
  return Object.keys(world?.npcs ?? {}).filter((id) => world.npcs[id]?.lastTalkDay === day).sort();
}

/**
 * Stores a remembered value (the script `remember` op). The value must survive JSON.
 * @param {World} world
 * @param {string} npcId
 * @param {string} key
 * @param {any} value
 * @returns {{changed: boolean}}
 * @throws {TypeError} for a bad key or a value JSON cannot carry
 */
export function remember(world, npcId, key, value) {
  if (typeof key !== 'string' || !key) throw new TypeError('memory.remember: key must be a non-empty string');
  if (!jsonSafe(value)) throw new TypeError(`memory.remember: value for ${key} must be JSON (no undefined, functions, NaN)`);
  const m = ensure(world, npcId);
  const before = JSON.stringify(m.remembered[key] ?? null);
  m.remembered[key] = JSON.parse(JSON.stringify(value));
  return { changed: before !== JSON.stringify(m.remembered[key]) || !(key in m.remembered) };
}

/**
 * Removes a remembered value.
 * @param {World} world
 * @param {string} npcId
 * @param {string} key
 * @returns {boolean} whether something was removed
 */
export function forget(world, npcId, key) {
  const m = world?.npcs?.[npcId];
  if (!m || !m.remembered || !(key in m.remembered)) return false;
  delete m.remembered[key];
  return true;
}

/**
 * A remembered value, or `fallback`.
 * @param {World} world
 * @param {string} npcId
 * @param {string} key
 * @param {any} [fallback=null]
 * @returns {any}
 */
export function recall(world, npcId, key, fallback = null) {
  const v = memoryOf(world, npcId).remembered?.[key];
  return v === undefined ? fallback : v;
}

/**
 * @param {any} v
 * @param {number} [depth]
 * @returns {boolean}
 */
function jsonSafe(v, depth = 0) {
  if (depth > 32) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => jsonSafe(x, depth + 1));
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return Object.values(v).every((x) => jsonSafe(x, depth + 1));
  return false;
}

// ---------------------------------------------------------------------------------------------
// Lines said
// ---------------------------------------------------------------------------------------------

/**
 * Records that a line (or topic) was said today: `saidLines[id] = day`, `lastLineId = id`. A line
 * tagged `shift` also remembers the lead's current form (`shiftSeen.<uid>`), so the NPC remarks on
 * each new form once.
 * @param {World} world
 * @param {string} npcId
 * @param {string} lineId
 * @param {{day?: number, tags?: string[]}} [opts]
 * @returns {void}
 */
export function recordLine(world, npcId, lineId, opts = {}) {
  if (typeof lineId !== 'string' || !lineId) throw new TypeError('memory.recordLine: lineId must be a non-empty string');
  const m = ensure(world, npcId);
  m.saidLines[lineId] = coreDay(world, opts);
  m.lastLineId = lineId;
  if (Array.isArray(opts.tags) && opts.tags.includes('shift')) {
    const lead = leadCreature(world);
    if (lead && typeof lead.uid === 'string') m.remembered[`shiftSeen.${lead.uid}`] = lead.speciesId;
  }
}

/**
 * Whether a line was said within `days` days of `day` (said on day d counts while `day - d < days`).
 * @param {World} world
 * @param {string} npcId
 * @param {string} lineId
 * @param {number} day
 * @param {number} days
 * @returns {boolean}
 */
export function saidWithin(world, npcId, lineId, day, days) {
  const d = memoryOf(world, npcId).saidLines?.[lineId];
  return isInt(d) && day - d < days && day >= d;
}

// ---------------------------------------------------------------------------------------------
// Nicknames, gifts, favours, Linger
// ---------------------------------------------------------------------------------------------

/**
 * Answers a neighbour's nickname for the player (GDD-00 §12 "Tully's nickname (accept / decline /
 * counter)"). `accept` keeps `offer`; `decline` clears it (they use your name); `counter` stores your
 * own suggestion (trimmed, 1..nicknameMaxLength characters). Emits `npc:nickname`.
 * @param {World} world
 * @param {string} npcId
 * @param {'accept'|'decline'|'counter'} choice
 * @param {any} [data]
 * @param {{offer?: string, counter?: string, bus?: Bus|null, tuning?: any}} [opts]
 * @returns {{ok: true, nickname: string|null} | {ok: false, reason: 'bad-choice'|'no-offer'|'bad-counter'}}
 */
export function setNickname(world, npcId, choice, data, opts = {}) {
  assertNpcId(npcId);
  if (!NICKNAME_CHOICES.includes(choice)) return { ok: false, reason: 'bad-choice' };
  const t = tuningOf(data, opts);
  /** @type {string|null} */
  let nick = null;
  if (choice === 'accept') {
    const offer = typeof opts.offer === 'string' ? opts.offer.trim() : '';
    if (!offer) return { ok: false, reason: 'no-offer' };
    nick = offer;
  } else if (choice === 'counter') {
    const c = typeof opts.counter === 'string' ? opts.counter.trim().replace(/\s+/g, ' ') : '';
    if (!c || [...c].length > t.nicknameMaxLength) return { ok: false, reason: 'bad-counter' };
    nick = c;
  }
  const m = ensure(world, npcId);
  m.nickname = nick;
  m.nicknameChoice = choice;
  emit(opts.bus, 'npc:nickname', { npcId, choice, nickname: nick });
  return { ok: true, nickname: nick };
}

/**
 * What a neighbour calls the player: their nickname, or null (use the player's name).
 * @param {World} world
 * @param {string} npcId
 * @returns {string|null}
 */
export function nicknameFor(world, npcId) {
  return memoryOf(world, npcId).nickname ?? null;
}

/**
 * The reaction an NPC has to an item: from `npc.gifts {love, like, dislike}` (item id lists), else
 * `npc.loves / likes / dislikes`; anything else is `neutral`.
 * @param {any} npc   npc def
 * @param {string} itemId
 * @returns {'love'|'like'|'neutral'|'dislike'}
 */
export function reactionTo(npc, itemId) {
  const g = npc?.gifts && typeof npc.gifts === 'object' ? npc.gifts : {};
  const inList = (list) => Array.isArray(list) && list.includes(itemId);
  if (inList(g.love) || inList(npc?.loves)) return 'love';
  if (inList(g.dislike) || inList(npc?.dislikes)) return 'dislike';
  if (inList(g.like) || inList(npc?.likes)) return 'like';
  return 'neutral';
}

/**
 * Gives a gift (the caller has already taken it from the bag). The NPC remembers every gift
 * (`gifts[item] = {n, lastDay}`). Affinity moves only for the first `giftsPerDay` different items a
 * day; the same item twice in one day, or one past the cap, gets the `again` reaction. Emits
 * `npc:gift {npcId, itemId, reaction, affinity}`.
 * @param {World} world
 * @param {any} data
 * @param {string} npcId
 * @param {string} itemId
 * @param {{day?: number, bus?: Bus|null, tuning?: any}} [opts]
 * @returns {{ok: true, reaction: 'love'|'like'|'neutral'|'dislike'|'again', firstTime: boolean, affinityDelta: number}}
 */
export function giveGift(world, data, npcId, itemId, opts = {}) {
  if (typeof itemId !== 'string' || !itemId) throw new TypeError('memory.giveGift: itemId must be a non-empty string');
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const m = ensure(world, npcId);
  const prev = m.gifts[itemId];
  const firstTime = !prev;
  const distinctToday = Object.values(m.gifts).filter((g) => g && g.lastDay === day).length;
  const counts = !(prev && prev.lastDay === day) && distinctToday < t.giftsPerDay;
  const base = reactionTo(row(data, 'npcs', npcId), itemId);
  const reaction = counts ? base : 'again';
  const delta = counts ? t.affinityGift[base] : 0;
  m.gifts[itemId] = { n: (prev?.n ?? 0) + 1, lastDay: day };
  m.lastGiftDay = day;
  m.affinity += delta;
  emit(opts.bus, 'npc:gift', { npcId, itemId, reaction, affinity: m.affinity });
  return { ok: true, reaction, firstTime, affinityDelta: delta };
}

/**
 * What the NPC remembers about a gifted item, or null.
 * @param {World} world
 * @param {string} npcId
 * @param {string} itemId
 * @returns {{n: number, lastDay: number}|null}
 */
export function giftMemory(world, npcId, itemId) {
  return memoryOf(world, npcId).gifts?.[itemId] ?? null;
}

/**
 * Adds a pending favour (an NPC asked for something; `topic.favour` matches it).
 * @param {World} world
 * @param {string} npcId
 * @param {string} favourId
 * @returns {boolean} whether it was added
 */
export function addFavour(world, npcId, favourId) {
  if (typeof favourId !== 'string' || !favourId) throw new TypeError('memory.addFavour: favourId must be a non-empty string');
  const m = ensure(world, npcId);
  if (m.favours.includes(favourId)) return false;
  m.favours.push(favourId);
  return true;
}

/**
 * Removes a favour (done or dropped).
 * @param {World} world
 * @param {string} npcId
 * @param {string} favourId
 * @returns {boolean} whether it was pending
 */
export function clearFavour(world, npcId, favourId) {
  const m = world?.npcs?.[npcId];
  if (!m || !Array.isArray(m.favours)) return false;
  const i = m.favours.indexOf(favourId);
  if (i < 0) return false;
  m.favours.splice(i, 1);
  return true;
}

/**
 * Whether a favour is pending.
 * @param {World} world
 * @param {string} npcId
 * @param {string} favourId
 * @returns {boolean}
 */
export function hasFavour(world, npcId, favourId) {
  return (memoryOf(world, npcId).favours ?? []).includes(favourId);
}

/**
 * Whether the Linger second topic is available: talked today and not lingered today.
 * @param {World} world
 * @param {string} npcId
 * @param {any} [data]
 * @param {{day?: number, tuning?: any}} [opts]
 * @returns {boolean}
 */
export function canLinger(world, npcId, data, opts = {}) {
  const t = tuningOf(data, opts);
  if (t.lingerPerDay < 1) return false;
  const day = coreDay(world, opts);
  const m = memoryOf(world, npcId);
  return m.lastTalkDay === day && m.lingerDay !== day;
}

/**
 * Uses today's Linger with an NPC (call when the second topic is shown).
 * @param {World} world
 * @param {string} npcId
 * @param {any} [data]
 * @param {{day?: number, tuning?: any, bus?: Bus|null}} [opts]
 * @returns {{ok: true} | {ok: false, reason: 'not-talked'|'already'|'off'}}
 */
export function linger(world, npcId, data, opts = {}) {
  const t = tuningOf(data, opts);
  if (t.lingerPerDay < 1) return { ok: false, reason: 'off' };
  const day = coreDay(world, opts);
  const cur = memoryOf(world, npcId);
  if (cur.lastTalkDay !== day) return { ok: false, reason: 'not-talked' };
  if (cur.lingerDay === day) return { ok: false, reason: 'already' };
  ensure(world, npcId).lingerDay = day;
  emit(opts.bus, 'npc:linger', { npcId, day });
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Picking lines
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} LineCtx
 * @property {number} [day]            core day (default: the world clock's)
 * @property {number} [minute]         minute of day (default: the world clock's)
 * @property {string} [pose]           the NPC's current schedule pose
 * @property {boolean} [atPorch]       the player is at this NPC's porch
 * @property {boolean} [linger]        Linger: skip the line just said, prefer another pool
 * @property {string|null} [lastLineId]   the line just said (default: memory's lastLineId)
 * @property {boolean} [shiftHappened] a Shift just happened (FLOW knows from `shift:resolved`)
 * @property {string[]} [pools]        restrict to these pool keys
 * @property {{next: () => number}|null} [rng]   tie-break among equally good lines (else list order)
 * @property {any} [tuning]
 */

/**
 * @typedef {Object} PickedLine
 * @property {string} npcId
 * @property {string} lineId
 * @property {string} text
 * @property {string} pool
 * @property {string[]} tags
 * @property {number} score
 * @property {boolean} repeat       true when every eligible line was said within the window
 */

/**
 * The tags a line carries: its own `tags`, else one derived from its pool key.
 * @param {any} line
 * @param {string} pool
 * @returns {string[]}
 */
export function lineTags(line, pool) {
  if (line && typeof line === 'object' && Array.isArray(line.tags) && line.tags.length) return line.tags.slice();
  if (['generic', 'night', 'day', 'porch', 'shift', 'gift', 'nickname', 'known'].includes(pool)) return [pool];
  if (pool.startsWith('weather-')) return [`weather:${pool.slice(8)}`];
  if (pool.startsWith('lead-')) return [`lead:${pool.slice(5)}`];
  return [`pose:${pool}`];
}

/**
 * Every line of an NPC as `{id, text, pool, tags, cond, index}` (bare strings get `<pool><i+1>`).
 * @param {any} npc   npc def
 * @returns {Array<{id: string, text: string, pool: string, tags: string[], cond: any, index: number}>}
 */
export function linesOf(npc) {
  const out = [];
  const lines = npc?.lines && typeof npc.lines === 'object' ? npc.lines : {};
  let index = 0;
  for (const [pool, list] of Object.entries(lines)) {
    if (!Array.isArray(list)) continue;
    list.forEach((l, i) => {
      if (typeof l === 'string') out.push({ id: `${pool}${i + 1}`, text: l, pool, tags: lineTags(l, pool), cond: undefined, index: index++ });
      else if (l && typeof l === 'object' && typeof l.id === 'string' && typeof l.text === 'string') {
        out.push({ id: l.id, text: l.text, pool, tags: lineTags(l, pool), cond: l.cond, index: index++ });
      }
    });
  }
  return out;
}

/**
 * Whether one tag holds.
 * @param {string} tag
 * @param {{world: World, mem: NpcMemory, day: number, minute: number, ctx: LineCtx, night: boolean, porchOpen: boolean}} env
 * @returns {boolean}
 */
export function tagHolds(tag, env) {
  if (typeof tag !== 'string') return false;
  const i = tag.indexOf(':');
  const kind = i < 0 ? tag : tag.slice(0, i);
  const arg = i < 0 ? null : tag.slice(i + 1);
  const { world, mem, ctx } = env;
  switch (kind) {
    case 'generic': return arg === null;
    case 'night': return arg === null && env.night;
    case 'day': return arg === null && !env.night;
    case 'porch': return arg === null && Boolean(ctx.atPorch) && env.porchOpen;
    case 'weather': {
      return Boolean(arg) && weatherNow(world) === arg;
    }
    case 'lead': {
      const lead = leadCreature(world);
      if (!arg || !lead || !Array.isArray(lead.types)) return false;
      return lead.types.some((ty) => String(ty).toLowerCase() === arg.toLowerCase());
    }
    case 'shift': {
      if (arg !== null) return false;
      if (ctx.shiftHappened) return true;
      const lead = leadCreature(world);
      if (!lead || !Array.isArray(lead.shiftlog) || lead.shiftlog.length < 2) return false;
      return mem.remembered?.[`shiftSeen.${lead.uid}`] !== lead.speciesId;
    }
    case 'pose': return Boolean(arg) && ctx.pose === arg;
    case 'gift': return arg === null ? Object.keys(mem.gifts ?? {}).length > 0 : Boolean(mem.gifts?.[arg]);
    case 'nickname': return arg === null && typeof mem.nickname === 'string';
    case 'known': return arg === null && mem.lastTalkDay >= 0 && mem.lastTalkDay < env.day;
    default: return false;
  }
}

/**
 * Specificity of a tag set.
 * @param {string[]} tags
 * @param {Record<string, number>} weights
 * @returns {number}
 */
function scoreOf(tags, weights) {
  let s = 0;
  for (const tag of tags) {
    const kind = tag.split(':')[0];
    s += weights[kind] ?? 0;
  }
  return s;
}

/**
 * Picks the line an NPC says now (no writes; call {@link recordLine} once it is said, or use
 * {@link talkLine}). Returns null when the NPC has no eligible line.
 * @param {string|any} npc   npc id or def
 * @param {World} world
 * @param {any} data
 * @param {LineCtx} [ctx]
 * @returns {PickedLine|null}
 */
export function pickLine(npc, world, data, ctx = {}) {
  const def = typeof npc === 'string' ? row(data, 'npcs', npc) : npc;
  if (!def || typeof def.id !== 'string') return null;
  const t = tuningOf(data, ctx);
  const st = scheduleTuning(data, ctx);
  const day = coreDay(world, ctx);
  const minute = minuteNow(world, ctx);
  const mem = memoryOf(world, def.id);
  const env = {
    world, mem, day, minute, ctx,
    night: inWindow(minute, t.nightWindow),
    porchOpen: inWindow(minute, st.porchWindow),
  };
  const last = ctx.lastLineId !== undefined ? ctx.lastLineId : mem.lastLineId;
  const all = linesOf(def);
  const lastPool = all.find((l) => l.id === last)?.pool ?? null;
  const eligible = all.filter((l) => {
    if (Array.isArray(ctx.pools) && !ctx.pools.includes(l.pool)) return false;
    if (ctx.linger && l.id === last) return false;
    if (!l.tags.every((tag) => tagHolds(tag, env))) return false;
    return holds(world, l.cond, data, { npc: def.id });
  });
  if (!eligible.length) return null;
  const said = mem.saidLines ?? {};
  const fresh = eligible.filter((l) => !(isInt(said[l.id]) && day - said[l.id] < t.noRepeatDays && day >= said[l.id]));
  if (!fresh.length && t.strictNoRepeat) return null;
  const pool = fresh.length ? fresh : eligible;
  const scored = pool.map((l) => ({
    l,
    score: scoreOf(l.tags, t.lineTagWeights) - (ctx.linger && lastPool !== null && l.pool === lastPool ? 0.5 : 0),
    lastSaid: isInt(said[l.id]) ? said[l.id] : -Infinity,
  }));
  scored.sort((a, b) => b.score - a.score || a.lastSaid - b.lastSaid || a.l.index - b.l.index);
  let top = scored[0];
  if (ctx.rng && typeof ctx.rng.next === 'function') {
    const ties = scored.filter((s) => s.score === top.score && s.lastSaid === top.lastSaid);
    if (ties.length > 1) top = ties[Math.min(ties.length - 1, Math.floor(ctx.rng.next() * ties.length))];
  }
  return {
    npcId: def.id, lineId: top.l.id, text: top.l.text, pool: top.l.pool, tags: top.l.tags,
    score: top.score, repeat: fresh.length === 0,
  };
}

/**
 * Picks a line and records it as said (one call for the dialogue host).
 * @param {World} world
 * @param {any} data
 * @param {string|any} npc
 * @param {LineCtx} [ctx]
 * @returns {PickedLine|null}
 */
export function talkLine(world, data, npc, ctx = {}) {
  const picked = pickLine(npc, world, data, ctx);
  if (picked) recordLine(world, picked.npcId, picked.lineId, { day: coreDay(world, ctx), tags: picked.tags });
  return picked;
}

/**
 * Validates line tags for the data validator / tests: problems for unknown kinds or missing args.
 * @param {any} npc   npc def
 * @returns {string[]}
 */
export function validateLines(npc) {
  const out = [];
  const seen = new Set();
  for (const l of linesOf(npc)) {
    if (seen.has(l.id)) out.push(`npcs:${npc?.id}: line id '${l.id}' is not unique across pools`);
    seen.add(l.id);
    for (const tag of l.tags) {
      const [kind, arg] = String(tag).split(':');
      if (!LINE_TAGS.includes(kind)) out.push(`npcs:${npc?.id}: line '${l.id}' tag '${tag}' unknown (${LINE_TAGS.join(' ')})`);
      else if (['weather', 'lead', 'pose'].includes(kind) && !arg) out.push(`npcs:${npc?.id}: line '${l.id}' tag '${tag}' needs an argument (${kind}:<x>)`);
    }
  }
  return out;
}

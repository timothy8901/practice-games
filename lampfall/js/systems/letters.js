/**
 * The letter serial (GDD-00 §11, §5 anchors; ARCHITECTURE §6.3). [SYS-TOWN]
 *
 * The only writer of `world.letters` (tools/lint-owners). Letters are content rows with a global,
 * contiguous number `n` (what `{letter: {read: n}}` conds and `world.letters` store) and a channel:
 *
 *  - **keeper** (K1–K20): one at 06:00 each morning ({@link deliverMorning}), the next in order,
 *    K1 on day 2 at the earliest (`keeperFirstDay`). Hesper delivers only to a lit porch, so none
 *    arrives before the home porch is lit. One per date and no accrual: a missed morning is simply
 *    missed (the series slides a day), and the mailbox holds one uncollected Keeper letter at most
 *    (`mailboxHoldsOne`), so however far a clock change jumps, at most one letter is waiting.
 *  - **family** (F1–F18): one at Hesper's counter from 18:00 ({@link deliverEvening}) from day 2,
 *    only while the counter is empty. The player collects it ({@link carry}) and takes it to its
 *    door ({@link deliverToDoor}). At a lit porch Juniper returns the heirloom at once (and the four
 *    `lightsPorch` letters light their porch); at a dark porch the heirloom waits in `awaiting`
 *    until {@link releaseHeirlooms} sees the porch lit. F1, F5, F9, F13 also return a creature.
 *  - **town** (T1–T18): delivered the moment its find is pinned on Barnaby's string wall
 *    ({@link pinFind}); any still locked once every Keeper letter has come arrive by morning post
 *    from day 22 (`townPostFromDay`, `townPostPerMorning` a morning).
 *  - **event**: the Lantern letter and "I saw the light" ({@link deliverEvent}).
 *
 * When the last keeper/family/town letter arrives the Late Delivery party fires once (flag
 * {@link LATE_DELIVERY_FLAG} = GDD day; event `letters:late-delivery`).
 *
 * Reading ({@link markRead}) sets the row's `flags` (reveal hooks) and returns its `reveal` ops for
 * the script host to run. Rewards are handed to injected collaborators (`opts.giveItem`,
 * `opts.addCreature`) so this module needs nothing from bag/party internals.
 *
 * Events (§3.4): `letter:delivered {n, id, channel, label, where, day}`, `letter:read`,
 * `letter:collected`, `letter:door`, `letter:heirloom`, `letter:pinned`, `letters:late-delivery`.
 *
 * Pure: no DOM, no randomness.
 * @module systems/letters
 */

import {
  CALENDAR_DEFAULTS, CALENDAR_SPEC, resolveTuning, tuningSource, rows, holds, emit, coreDay, minuteNow,
  gameDay, inWindow, isPorchLit, porchFlag,
} from './townCommon.js';
import { setFlag, hasFlag } from './flags.js';
import { inc as incStat } from './stats.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').LettersState} LettersState */
/** @typedef {{emit: (evt: string, payload?: any) => any}} Bus */

/** Letter channels, in display order. */
export const CHANNELS = Object.freeze(['keeper', 'family', 'town', 'event']);
/** Label prefix per channel (`K10`, `F9`, `T7`, `E1`). */
export const CHANNEL_PREFIX = Object.freeze({ keeper: 'K', family: 'F', town: 'T', event: 'E' });
/** Flag set (to the GDD day) when the last serial letter arrives. */
export const LATE_DELIVERY_FLAG = 'sp.late-delivery';

/**
 * Designer numbers (GDD-00 §5, §11). [GDD values]
 */
export const DEFAULTS = Object.freeze({
  ...CALENDAR_DEFAULTS,
  /** Hour the Keeper letter arrives (GDD-00 §5: 06:00 mailbox). */
  letterHour: 6,
  /** Hour the family letter reaches Hesper's counter (GDD-00 §5: one family letter from 18:00). */
  familyLetterHour: 18,
  /** Hesper's counter hours, minutes [from, to) (GDD-00 §5: 18:00–02:00). */
  hesperCounterHours: Object.freeze([18 * 60, 2 * 60]),
  /** First GDD day a Keeper letter can arrive (K1 on day 2). */
  keeperFirstDay: 2,
  /** First GDD day a family letter can arrive. */
  familyFirstDay: 2,
  /** Keeper letters wait for a lit home porch (Hesper delivers only to a lit porch). */
  keeperNeedsLitPorch: true,
  /** The next Keeper letter waits while one is still uncollected in the mailbox (no accrual). */
  mailboxHoldsOne: true,
  /** Collecting at the counter only during Hesper's hours. */
  counterHoursEnforced: true,
  /** First GDD day locked town letters arrive by morning post (after the last Keeper letter). */
  townPostFromDay: 22,
  /** Locked town letters delivered per morning post. */
  townPostPerMorning: 1,
});

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

const isInt = (v) => Number.isInteger(v);
const isBool = (v) => typeof v === 'boolean';
const SPEC = {
  ...CALENDAR_SPEC,
  letterHour: [(v) => isInt(v) && v >= 0 && v <= 23, 'integer 0..23'],
  familyLetterHour: [(v) => isInt(v) && v >= 0 && v <= 23, 'integer 0..23'],
  hesperCounterHours: [(v) => Array.isArray(v) && v.length === 2 && v.every((m) => isInt(m) && m >= 0 && m <= 1440), '[from, to] minutes'],
  keeperFirstDay: [isInt, 'integer'],
  familyFirstDay: [isInt, 'integer'],
  keeperNeedsLitPorch: [isBool, 'boolean'],
  mailboxHoldsOne: [isBool, 'boolean'],
  counterHoursEnforced: [isBool, 'boolean'],
  townPostFromDay: [isInt, 'integer'],
  townPostPerMorning: [(v) => isInt(v) && v >= 0, 'integer >= 0'],
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
  return resolveTuning(DEFAULTS, SPEC, tuningSource(data, opts), CACHE, 'letters');
}

/**
 * @typedef {Object} LetterOpts
 * @property {number} [day]            core day (default: the world clock's)
 * @property {number} [minute]         minute of day (default: the world clock's)
 * @property {Bus|null} [bus]
 * @property {(porchId: string) => boolean} [isPorchLit]    override porch state
 * @property {(world: World, itemId: string, n: number) => any} [giveItem]   heirloom hand-off (systems/bag)
 * @property {(world: World, spec: {species: string, level: number, nick?: string}) => any} [addCreature]   creature hand-off (systems/party)
 * @property {any} [tuning]
 */

// ---------------------------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------------------------

/**
 * A letter row's channel: `row.channel`, else its id prefix (`k1`, `f-3`, `t12`, `e1`), else keeper.
 * @param {any} letter
 * @returns {'keeper'|'family'|'town'|'event'}
 */
export function channelOf(letter) {
  if (letter && CHANNELS.includes(letter.channel)) return letter.channel;
  const m = typeof letter?.id === 'string' ? /^([kfte])-?\d/.exec(letter.id) : null;
  if (m) return /** @type {any} */ ({ k: 'keeper', f: 'family', t: 'town', e: 'event' })[m[1]];
  return 'keeper';
}

/**
 * Every letter of a channel in serial order (`index`, else `n`).
 * @param {any} data
 * @param {string} channel
 * @returns {any[]}
 */
export function lettersIn(data, channel) {
  return rows(data, 'letters')
    .filter((l) => l && isInt(l.n) && channelOf(l) === channel)
    .slice()
    .sort((a, b) => (a.index ?? a.n) - (b.index ?? b.n) || a.n - b.n);
}

/**
 * A letter row by number, or null.
 * @param {any} data
 * @param {number} n
 * @returns {any|null}
 */
export function letterByN(data, n) {
  return rows(data, 'letters').find((l) => l && l.n === n) ?? null;
}

/**
 * The display label of a letter: channel prefix + position in its channel (`K10`, `F9`).
 * @param {any} data
 * @param {any} letter
 * @returns {string}
 */
export function labelOf(data, letter) {
  if (!letter) return '';
  const ch = channelOf(letter);
  const pos = isInt(letter.index) ? letter.index : lettersIn(data, ch).findIndex((l) => l.n === letter.n) + 1;
  return `${CHANNEL_PREFIX[ch]}${pos}`;
}

/**
 * @param {World} world
 * @param {number} n
 * @returns {boolean}
 */
export function isDelivered(world, n) {
  return (world?.letters?.got ?? []).includes(n);
}

/**
 * @param {World} world
 * @param {number} n
 * @returns {boolean}
 */
export function isRead(world, n) {
  return (world?.letters?.read ?? []).includes(n);
}

/**
 * Delivered letters not yet read, in arrival order.
 * @param {World} world
 * @returns {number[]}
 */
export function unread(world) {
  const read = new Set(world?.letters?.read ?? []);
  return (world?.letters?.got ?? []).filter((n) => !read.has(n));
}

/**
 * The next undelivered letter of a channel (in serial order), or null.
 * @param {World} world
 * @param {any} data
 * @param {string} channel
 * @returns {any|null}
 */
export function nextIn(world, data, channel) {
  const got = new Set(world?.letters?.got ?? []);
  return lettersIn(data, channel).find((l) => !got.has(l.n)) ?? null;
}

/**
 * Pushes a delivery into the record and emits `letter:delivered`.
 * @param {World} world
 * @param {any} data
 * @param {any} letter
 * @param {'mailbox'|'counter'|'wall'} where
 * @param {number} day
 * @param {LetterOpts} opts
 * @returns {number}
 */
function arrive(world, data, letter, where, day, opts) {
  const L = world.letters;
  L.got.push(letter.n);
  L.delivered = L.got.length;
  if (where === 'counter') L.counter = letter.n;
  else L.mailbox.push(letter.n);
  emit(opts.bus, 'letter:delivered', { n: letter.n, id: letter.id, channel: channelOf(letter), label: labelOf(data, letter), where, day });
  return letter.n;
}

/**
 * Fires the Late Delivery party once, when every keeper/family/town letter has arrived.
 * @param {World} world
 * @param {any} data
 * @param {number} day
 * @param {LetterOpts} opts
 * @returns {boolean} whether it fired now
 */
function checkLateDelivery(world, data, day, opts) {
  if (hasFlag(world, LATE_DELIVERY_FLAG)) return false;
  const serial = rows(data, 'letters').filter((l) => l && isInt(l.n) && channelOf(l) !== 'event');
  if (!serial.length) return false;
  const got = new Set(world.letters.got);
  if (!serial.every((l) => got.has(l.n))) return false;
  const t = tuningOf(data, opts);
  setFlag(world, LATE_DELIVERY_FLAG, gameDay(day, t), opts);
  emit(opts.bus, 'letters:late-delivery', { day, gameDay: gameDay(day, t), count: serial.length });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Morning and evening
// ---------------------------------------------------------------------------------------------

/**
 * Why the next Keeper letter would not arrive on `day` (null = it would).
 * @param {World} world
 * @param {any} data
 * @param {number} day core day
 * @param {LetterOpts} [opts]
 * @param {{ignoreMailbox?: boolean, ignoreDay?: boolean}} [flags]
 * @returns {null|'already'|'too-early'|'porch-dark'|'mailbox-full'|'none-left'|'locked'}
 */
export function keeperBlock(world, data, day, opts = {}, flags = {}) {
  const t = tuningOf(data, opts);
  const L = world.letters;
  if (!flags.ignoreDay && L.keeperDay >= day) return 'already';
  if (gameDay(day, t) < t.keeperFirstDay) return 'too-early';
  const next = nextIn(world, data, 'keeper');
  if (!next) return 'none-left';
  if (t.keeperNeedsLitPorch && !isPorchLit(world, data, t.homePorchId, opts)) return 'porch-dark';
  if (!flags.ignoreMailbox && t.mailboxHoldsOne) {
    const keeperNs = new Set(lettersIn(data, 'keeper').map((l) => l.n));
    if (L.mailbox.some((n) => keeperNs.has(n))) return 'mailbox-full';
  }
  if (!holds(world, next.unlock, data)) return 'locked';
  return null;
}

/**
 * The 06:00 delivery for `day` (call once per `day:start`, or from the overnight; repeated calls on
 * one day do nothing). Clears yesterday's `today`, delivers the next Keeper letter when
 * {@link keeperBlock} allows, then the town morning post. At most one Keeper letter per call.
 * @param {World} world
 * @param {any} data
 * @param {LetterOpts} [opts]
 * @returns {{keeper: number|null, town: number[], reason: string|null, lateDelivery: boolean}}
 */
export function deliverMorning(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const L = world.letters;
  /** @type {number|null} */
  let keeper = null;
  /** @type {number[]} */
  const town = [];
  if (L.keeperDay < day && L.today !== null) L.today = null;
  const reason = keeperBlock(world, data, day, opts);
  if (reason === null) {
    const next = nextIn(world, data, 'keeper');
    keeper = arrive(world, data, next, 'mailbox', day, opts);
    L.today = keeper;
    L.keeperDay = day;
  }
  // town morning post: once every Keeper letter has come (not on the morning the last one came)
  const keepersDone = lettersIn(data, 'keeper').length > 0 && nextIn(world, data, 'keeper') === null;
  if (keepersDone && keeper === null && L.townDay < day && gameDay(day, t) >= t.townPostFromDay) {
    for (let i = 0; i < t.townPostPerMorning; i++) {
      const next = nextIn(world, data, 'town');
      if (!next) break;
      town.push(arrive(world, data, next, 'mailbox', day, opts));
    }
    if (town.length) L.townDay = day;
  }
  const lateDelivery = (keeper !== null || town.length > 0) && checkLateDelivery(world, data, day, opts);
  return { keeper, town, reason: keeper === null ? reason : null, lateDelivery };
}

/**
 * Why the next family letter would not reach the counter on `day` (null = it would).
 * @param {World} world
 * @param {any} data
 * @param {number} day
 * @param {LetterOpts} [opts]
 * @param {{ignoreHour?: boolean}} [flags]   skip the "not before 18:00" check (previews)
 * @returns {null|'already'|'too-early'|'not-yet'|'counter-full'|'none-left'|'locked'}
 */
export function familyBlock(world, data, day, opts = {}, flags = {}) {
  const t = tuningOf(data, opts);
  const L = world.letters;
  if (L.familyDay >= day) return 'already';
  if (gameDay(day, t) < t.familyFirstDay) return 'too-early';
  if (!flags.ignoreHour && minuteNow(world, opts) < t.familyLetterHour * 60) return 'not-yet';
  if (L.counter !== null) return 'counter-full';
  const next = nextIn(world, data, 'family');
  if (!next) return 'none-left';
  if (!holds(world, next.unlock, data)) return 'locked';
  return null;
}

/**
 * The evening the family-letter window open at `minute` belongs to: the window runs from
 * `familyLetterHour` to the close of Hesper's counter (18:00–02:00), so 00:30 on day 5 is still
 * day 4's evening. Null outside the window.
 * @param {number} day core day of `minute`
 * @param {number} minute
 * @param {Readonly<typeof DEFAULTS>} t
 * @returns {number|null}
 */
function familyEvening(day, minute, t) {
  const from = t.familyLetterHour * 60;
  const close = t.hesperCounterHours[1] % 1440;
  if (minute >= from) return day;
  // past midnight: still the evening before while the counter is open (close <= from wraps)
  if (close < from && minute < close) return day - 1;
  return null;
}

/**
 * The 18:00 family letter (call at 18:00; repeats for one evening do nothing; before
 * `familyLetterHour` it is `'not-yet'`): the next family letter goes to Hesper's counter if the
 * counter is empty. After midnight, while Hesper's counter is still open (to 02:00), a call that
 * missed 18:00 (a load, a clock jump) delivers the evening-before's letter.
 * @param {World} world
 * @param {any} data
 * @param {LetterOpts} [opts]
 * @returns {{family: number|null, reason: string|null, lateDelivery: boolean}}
 */
export function deliverEvening(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const evening = familyEvening(coreDay(world, opts), minuteNow(world, opts), t);
  if (evening === null) return { family: null, reason: 'not-yet', lateDelivery: false };
  const day = evening;
  const reason = familyBlock(world, data, day, opts, { ignoreHour: true });
  if (reason !== null) return { family: null, reason, lateDelivery: false };
  const next = nextIn(world, data, 'family');
  const n = arrive(world, data, next, 'counter', day, opts);
  world.letters.familyDay = day;
  return { family: n, reason: null, lateDelivery: checkLateDelivery(world, data, day, opts) };
}

/**
 * Takes everything out of the mailbox (opening it). Emits `letter:collected` per letter.
 * @param {World} world
 * @param {any} [data]
 * @param {LetterOpts} [opts]
 * @returns {number[]} the letters collected
 */
export function collectMail(world, data, opts = {}) {
  const L = world.letters;
  const out = L.mailbox.slice();
  L.mailbox.length = 0;
  for (const n of out) emit(opts.bus, 'letter:collected', { n, from: 'mailbox' });
  return out;
}

/**
 * Collects the family letter from Hesper's counter into the satchel ("carry").
 * @param {World} world
 * @param {any} data
 * @param {LetterOpts} [opts]
 * @returns {{ok: true, n: number} | {ok: false, reason: 'empty'|'closed'}}
 */
export function carry(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const L = world.letters;
  if (L.counter === null) return { ok: false, reason: 'empty' };
  if (t.counterHoursEnforced && !inWindow(minuteNow(world, opts), t.hesperCounterHours)) return { ok: false, reason: 'closed' };
  const n = L.counter;
  L.counter = null;
  if (!L.carrying.includes(n)) L.carrying.push(n);
  emit(opts.bus, 'letter:collected', { n, from: 'counter' });
  return { ok: true, n };
}

// ---------------------------------------------------------------------------------------------
// Doors and heirlooms
// ---------------------------------------------------------------------------------------------

/**
 * The porch a family letter's heirloom depends on: `row.porch`, else `row.lightsPorch`, else `row.door`.
 * @param {any} letter
 * @returns {string|null}
 */
export function porchOfLetter(letter) {
  const p = letter?.porch ?? letter?.lightsPorch ?? letter?.door ?? null;
  return typeof p === 'string' && p ? p : null;
}

/**
 * @typedef {Object} HeirloomReward
 * @property {number} n
 * @property {string} id
 * @property {string|null} item           heirloom item id
 * @property {{species: string, level: number, nick?: string}|null} creature
 * @property {string|null} lightsPorch    porch lit by this return
 */

/**
 * Returns a family letter's heirloom: records it, lights `lightsPorch`, hands the item and creature
 * to the injected collaborators, emits `letter:heirloom`.
 * @param {World} world
 * @param {any} data
 * @param {any} letter
 * @param {LetterOpts} opts
 * @returns {HeirloomReward}
 */
function returnHeirloom(world, data, letter, opts) {
  const L = world.letters;
  const ai = L.awaiting.indexOf(letter.n);
  if (ai >= 0) L.awaiting.splice(ai, 1);
  if (!L.returned.includes(letter.n)) L.returned.push(letter.n);
  const lights = typeof letter.lightsPorch === 'string' && letter.lightsPorch ? letter.lightsPorch : null;
  if (lights) setFlag(world, porchFlag(lights), true, opts);
  const item = typeof letter.heirloom === 'string' && letter.heirloom ? letter.heirloom : null;
  const c = letter.creature;
  const creature = c && typeof c === 'object' && typeof c.species === 'string'
    ? { species: c.species, level: isInt(c.level) ? c.level : 1, ...(typeof c.nick === 'string' ? { nick: c.nick } : {}) }
    : null;
  if (item && typeof opts.giveItem === 'function') opts.giveItem(world, item, 1);
  if (creature && typeof opts.addCreature === 'function') opts.addCreature(world, creature);
  /** @type {HeirloomReward} */
  const reward = { n: letter.n, id: letter.id, item, creature, lightsPorch: lights };
  emit(opts.bus, 'letter:heirloom', { ...reward, door: letter.door ?? null });
  return reward;
}

/**
 * Hands a carried family letter in at a door. The letter's `door` (when it names one) must match.
 * At a lit porch, or for a `lightsPorch` letter, the heirloom comes home now; otherwise it waits in
 * `awaiting`. Emits `letter:door`.
 * @param {World} world
 * @param {any} data
 * @param {number} n
 * @param {string} doorId
 * @param {LetterOpts} [opts]
 * @returns {{ok: true, returned: boolean, reward: HeirloomReward|null} | {ok: false, reason: 'not-carrying'|'unknown-letter'|'wrong-door'}}
 */
export function deliverToDoor(world, data, n, doorId, opts = {}) {
  const L = world.letters;
  if (!L.carrying.includes(n)) return { ok: false, reason: 'not-carrying' };
  const letter = letterByN(data, n);
  if (!letter) return { ok: false, reason: 'unknown-letter' };
  if (typeof letter.door === 'string' && letter.door && letter.door !== doorId) return { ok: false, reason: 'wrong-door' };
  L.carrying.splice(L.carrying.indexOf(n), 1);
  if (!L.doors.includes(n)) L.doors.push(n);
  const porch = porchOfLetter(letter) ?? doorId;
  const lit = Boolean(letter.lightsPorch) || isPorchLit(world, data, porch, opts);
  emit(opts.bus, 'letter:door', { n, id: letter.id, door: doorId, awaiting: !lit });
  if (!lit) {
    if (!L.awaiting.includes(n)) L.awaiting.push(n);
    return { ok: true, returned: false, reward: null };
  }
  return { ok: true, returned: true, reward: returnHeirloom(world, data, letter, opts) };
}

/**
 * Returns every awaiting heirloom whose porch is lit now (call when porches change, and overnight).
 * @param {World} world
 * @param {any} data
 * @param {LetterOpts} [opts]
 * @returns {HeirloomReward[]}
 */
export function releaseHeirlooms(world, data, opts = {}) {
  const out = [];
  for (const n of world.letters.awaiting.slice()) {
    const letter = letterByN(data, n);
    if (!letter) continue;
    const porch = porchOfLetter(letter);
    if (porch && isPorchLit(world, data, porch, opts)) out.push(returnHeirloom(world, data, letter, opts));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reading, the string wall, events
// ---------------------------------------------------------------------------------------------

/**
 * Marks a delivered letter read (and collected, if it was in the mailbox): sets the row's `flags`
 * (reveal hooks), counts `stats.lettersRead`, emits `letter:read`, and returns the row's `reveal`
 * ops for the script host. Reading twice is harmless.
 * @param {World} world
 * @param {any} data
 * @param {number} n
 * @param {LetterOpts} [opts]
 * @returns {{ok: true, already: boolean, reveal: any[], flags: string[]} | {ok: false, reason: 'not-delivered'}}
 */
export function markRead(world, data, n, opts = {}) {
  const L = world.letters;
  if (!L.got.includes(n)) return { ok: false, reason: 'not-delivered' };
  const mi = L.mailbox.indexOf(n);
  if (mi >= 0) L.mailbox.splice(mi, 1);
  if (L.read.includes(n)) return { ok: true, already: true, reveal: [], flags: [] };
  L.read.push(n);
  const letter = letterByN(data, n);
  const flags = Array.isArray(letter?.flags) ? letter.flags.filter((f) => typeof f === 'string' && f) : [];
  for (const f of flags) setFlag(world, f, true, opts);
  incStat(world, 'lettersRead', 1, opts);
  emit(opts.bus, 'letter:read', { n, id: letter?.id ?? null, channel: letter ? channelOf(letter) : null, label: labelOf(data, letter) });
  return { ok: true, already: false, reveal: Array.isArray(letter?.reveal) ? letter.reveal : [], flags };
}

/**
 * The town letter a find unlocks (`row.find`, or `row.relicId`), or null.
 * @param {any} data
 * @param {string} findId
 * @returns {any|null}
 */
export function townLetterFor(data, findId) {
  return lettersIn(data, 'town').find((l) => l.find === findId || l.relicId === findId) ?? null;
}

/**
 * Pins a find on Barnaby's string wall; its town letter (if any, and not yet here) is delivered on
 * the spot. Emits `letter:pinned`.
 * @param {World} world
 * @param {any} data
 * @param {string} findId
 * @param {LetterOpts} [opts]
 * @returns {{ok: true, letter: number|null, lateDelivery: boolean} | {ok: false, reason: 'already-pinned'|'bad-find'}}
 */
export function pinFind(world, data, findId, opts = {}) {
  if (typeof findId !== 'string' || !findId) return { ok: false, reason: 'bad-find' };
  const L = world.letters;
  if (L.pinned.includes(findId)) return { ok: false, reason: 'already-pinned' };
  L.pinned.push(findId);
  emit(opts.bus, 'letter:pinned', { findId });
  const letter = townLetterFor(data, findId);
  if (!letter || L.got.includes(letter.n)) return { ok: true, letter: null, lateDelivery: false };
  const day = coreDay(world, opts);
  const n = arrive(world, data, letter, 'wall', day, opts);
  return { ok: true, letter: n, lateDelivery: checkLateDelivery(world, data, day, opts) };
}

/**
 * Delivers an event letter (the Lantern letter at the Relighting; "I saw the light" post-credits),
 * found by `row.event` or `row.id`.
 * @param {World} world
 * @param {any} data
 * @param {string} eventId
 * @param {LetterOpts} [opts]
 * @returns {{ok: true, n: number} | {ok: false, reason: 'unknown-event'|'already'}}
 */
export function deliverEvent(world, data, eventId, opts = {}) {
  const letter = lettersIn(data, 'event').find((l) => l.event === eventId || l.id === eventId);
  if (!letter) return { ok: false, reason: 'unknown-event' };
  if (world.letters.got.includes(letter.n)) return { ok: false, reason: 'already' };
  return { ok: true, n: arrive(world, data, letter, 'mailbox', coreDay(world, opts), opts) };
}

// ---------------------------------------------------------------------------------------------
// Previews and validation
// ---------------------------------------------------------------------------------------------

/**
 * What the next morning post should bring, for the Day Page's *Tomorrow:* line (assumes the mailbox
 * is emptied before then). `blocked` names why nothing will come.
 * @param {World} world
 * @param {any} data
 * @param {LetterOpts} [opts]   `opts.day` = the day to preview (default: tomorrow)
 * @returns {{n: number|null, id: string|null, label: string|null, channel: string|null, gameDay: number, blocked: string|null}}
 */
export function nextLetterPreview(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const day = isInt(opts.day) ? opts.day : coreDay(world) + 1;
  const block = keeperBlock(world, data, day, opts, { ignoreMailbox: true });
  if (block === null) {
    const next = nextIn(world, data, 'keeper');
    return { n: next.n, id: next.id, label: labelOf(data, next), channel: 'keeper', gameDay: gameDay(day, t), blocked: null };
  }
  if (block === 'none-left' && gameDay(day, t) >= t.townPostFromDay) {
    const next = nextIn(world, data, 'town');
    if (next) return { n: next.n, id: next.id, label: labelOf(data, next), channel: 'town', gameDay: gameDay(day, t), blocked: null };
  }
  return { n: null, id: null, label: null, channel: null, gameDay: gameDay(day, t), blocked: block };
}

/**
 * Content checks this lane relies on (beyond tools/validate-data): known channels, unique
 * channel positions, family rows with a door, town rows with a find, event rows with an event id.
 * @param {any} data
 * @returns {string[]} problems
 */
export function validateLetters(data) {
  const out = [];
  const pos = new Map();
  for (const l of rows(data, 'letters')) {
    if (!l || !isInt(l.n)) continue;
    if (l.channel !== undefined && !CHANNELS.includes(l.channel)) out.push(`letters:${l.id}: channel '${l.channel}' unknown (${CHANNELS.join(' ')})`);
    const ch = channelOf(l);
    if (isInt(l.index)) {
      const key = `${ch}:${l.index}`;
      if (pos.has(key)) out.push(`letters:${l.id}: ${ch} index ${l.index} also used by ${pos.get(key)}`);
      pos.set(key, l.id);
    }
    if (ch === 'family' && (typeof l.door !== 'string' || !l.door)) out.push(`letters:${l.id}: family letters need a door`);
    if (ch === 'town' && typeof l.find !== 'string' && typeof l.relicId !== 'string') out.push(`letters:${l.id}: town letters need a find (or relicId)`);
    if (ch === 'event' && typeof l.event !== 'string') out.push(`letters:${l.id}: event letters need an event id`);
    if (l.flags !== undefined && (!Array.isArray(l.flags) || l.flags.some((f) => typeof f !== 'string'))) out.push(`letters:${l.id}: flags must be a string[]`);
  }
  return out;
}

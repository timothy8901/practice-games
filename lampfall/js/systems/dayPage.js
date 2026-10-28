/**
 * The overnight and Dimity's Day Page (GDD-00 §5 anchors and Rest, §9 Day Page; pillar 6
 * "Tomorrow, always"; ARCHITECTURE §1 `overnight(world, data, rng)`). [SYS-TOWN]
 *
 * The only writer of `world.log` and `world.dayPage` (tools/lint-owners). Everything another lane
 * owns is reached through injected collaborators, so this module depends on no unfinished internals:
 *
 * {@link overnight} runs once per morning: at Sleep (before or after the skip to dawn), or at the
 * 06:00 anchor when the clock reaches the morning without a Rest; repeated calls for the same
 * morning do nothing and {@link nextMorning} picks the morning. The porch bench only SHOWS the page
 * ({@link summarize}, read-only); it does not run the night. In order:
 *
 *  1. closes the ending day: {@link summarize} -> `world.dayPage.last`, one line into `world.log`;
 *  2. runs the collaborator steps {@link OVERNIGHT_STEPS} that the caller supplied in `ctx.hooks`:
 *     `builds` (05:40, `loans.landDue`), `regrow` (trees), `reaches` (reach health recovery),
 *     `cracks` (today's cracks reset), `glint` (tomorrow's Glint, stream `glint:<day>`), `wanted`
 *     (Wanted Today reroll), `crate` (Consignment Crate sale), `weather` (the day's roll, stream
 *     `weather:<day>`), `purse` (Keeper's Purse refund plan). Each hook is `(world, data, stepCtx)
 *     -> any`; a missing hook is skipped; a throwing hook is recorded in `errors` and the night goes
 *     on (unless `ctx.strict`);
 *  3. its own town steps: awaiting heirlooms whose porch is now lit (`letters.releaseHeirlooms`) and
 *     the 06:00 letter queue (`letters.deliverMorning`);
 *  4. opens the new day's tally ({@link beginDay}).
 *
 * The tally: {@link beginDay} snapshots `world.stats`; {@link noteEvent} adds buttons earned
 * (`wallet:changed` with a positive `main` delta) and loan payments (`loan:paid`) and keeps short
 * note ids for notable events. Catches, Forecasts and letters read are stats deltas; "who you
 * talked to" comes from neighbour memory (`lastTalkDay`).
 *
 * *Tomorrow:* ({@link tomorrowList}): builds not landed, deferred Forecasts / Shift pips
 * (`pendingShifts`), the next letter, thread beats ready tomorrow, tomorrow's lows, a family letter
 * still to carry or at the counter, heirlooms waiting on a dark porch, then anything the injected
 * `ctx.tomorrow` providers add (grafts, bench fossils, the Errant, the Spire you are ready for).
 *
 * Pure: no DOM; randomness only through labelled forks of the injected rng source.
 * @module systems/dayPage
 */

import { LOG_MAX, DAY_NOTES_MAX, dayPageDefaults, STAT_COUNTERS } from '../state/schema.js';
import {
  CALENDAR_DEFAULTS, CALENDAR_SPEC, resolveTuning, tuningSource, emit, coreDay, minuteNow, gameDay, dowOf,
  rngFor, clone, inWindow,
} from './townCommon.js';
import * as letters from './letters.js';
import * as threads from './threads.js';
import { lowsOn, tuningOf as scheduleTuning } from './schedule.js';
import { MINUTES_PER_DAY } from '../core/time.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {{emit: (evt: string, payload?: any) => any}} Bus */

/** Collaborator steps of the overnight, in the order they run (see the module comment). */
// `bench`: the cottage rooms' overnight work (systems/flow/rooms.settleBenches: Workshop, Greenhouse)
export const OVERNIGHT_STEPS = Object.freeze(['builds', 'regrow', 'reaches', 'cracks', 'glint', 'wanted', 'crate', 'bench', 'weather', 'purse']);

/** Rng label per step (`<label>:<day>`); steps not listed use `<step>:<day>`. */
export const STEP_STREAMS = Object.freeze({ glint: 'glint', weather: 'weather', cracks: 'cracks', wanted: 'shop:wanted', regrow: 'regrow' });

/**
 * Which day number a step's stream label uses: `'game'` (1-based GDD day) for `weather` because
 * systems/weather names its stream `weather:<gameDay>`; every other step uses the CORE day, as
 * systems/gather does for `glint:<day>` (so `step.rng` equals `rngs.day(label, day)` there).
 */
export const STEP_DAY_BASIS = Object.freeze({ weather: 'game' });

/** Order of *Tomorrow:* items by kind; unknown kinds go last in insertion order. */
export const TOMORROW_ORDER = Object.freeze(['build', 'graft', 'bench', 'forecast', 'letter', 'meet', 'beat', 'low', 'carry', 'heirloom', 'errant', 'spire']);

/**
 * Designer numbers (GDD-00 §5, §9). [GDD values]
 */
export const DEFAULTS = Object.freeze({
  ...CALENDAR_DEFAULTS,
  /** Builds land at this minute (GDD-00 §5: 05:40 the Thatch tie off any overnight build). */
  buildLandMinute: 5 * 60 + 40,
  /** The morning the overnight leads into (GDD-00 §5: 06:00 mailbox, boards, Crate). */
  dayStartMinute: 6 * 60,
  /** Day Page lines kept in `world.log` (≤ schema LOG_MAX). */
  dayPageLogLines: LOG_MAX,
  /** *Tomorrow:* lists at most this many items. */
  tomorrowMax: 8,
});

/**
 * Minutes after `dayStartMinute` during which an overnight with no `toDay` still means "this
 * morning" ({@link nextMorning}: the 06:00 anchor, the wake from Sleep). An engineering margin for
 * a frame that crosses 06:00, not a designer number; `opts.graceMinutes` overrides it.
 */
export const OVERNIGHT_GRACE_MINUTES = 60;

/** Every tuning key this module reads (letters/threads/schedule keys are listed by those modules). */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

const isInt = (v) => Number.isInteger(v);
const SPEC = {
  ...CALENDAR_SPEC,
  buildLandMinute: [(v) => isInt(v) && v >= 0 && v < MINUTES_PER_DAY, 'minute 0..1439'],
  dayStartMinute: [(v) => isInt(v) && v >= 0 && v < MINUTES_PER_DAY, 'minute 0..1439'],
  dayPageLogLines: [(v) => isInt(v) && v >= 0 && v <= LOG_MAX, `integer 0..${LOG_MAX}`],
  tomorrowMax: [(v) => isInt(v) && v >= 1, 'integer >= 1'],
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
  return resolveTuning(DEFAULTS, SPEC, tuningSource(data, opts), CACHE, 'dayPage');
}

/**
 * Events {@link noteEvent} keeps a note for, and how the note id is built from the payload.
 * @type {Readonly<Record<string, (p: any) => string|null>>}
 */
export const NOTE_EVENTS = Object.freeze({
  'loan:built': (p) => (p && p.id ? `built:${p.id}` : null),
  'loan:tier': (p) => (p && isInt(p.prev) ? `cleared:${p.prev}` : null),
  'badge:won': (p) => (p && (p.spireId || p.id) ? `badge:${p.spireId ?? p.id}` : null),
  'letter:read': (p) => (p && p.label ? `read:${p.label}` : null),
  'letter:heirloom': (p) => (p && p.id ? `heirloom:${p.id}` : null),
  'thread:beat': (p) => (p && p.threadId ? `beat:${p.threadId}:${p.beat}` : null),
  'thread:done': (p) => (p && p.threadId ? `thread:${p.threadId}` : null),
  // the form it became is kept on the note (FE-10): a second Shift the same day must not rename the first
  'shift:resolved': (p) => (p && p.uid ? `shift:${p.uid}${p.anchored !== true && typeof p.to === 'string' && p.to ? `>${p.to}` : ''}` : 'shift'),
  // a lost fight (FE-10: the Day 2 Spire loss and blackout went unmentioned); friendly duels lose nothing
  'battle:end': (p) => (p && p.outcome === 'loss' && !p.porchDuel ? `lost:${typeof p.trainerId === 'string' && p.trainerId ? p.trainerId : 'wild'}` : null),
  // the blackout itself (battleFlow counts it only when the loss cost buttons and sent you home)
  'stat:inc': (p) => (p && p.key === 'blackouts' ? 'blackout' : null),
  'capture:ok': (p) => (p && (p.speciesId || p.formId) ? `caught:${p.speciesId ?? p.formId}` : null),
});

// ---------------------------------------------------------------------------------------------
// The tally
// ---------------------------------------------------------------------------------------------

/**
 * Snapshot of the stats counters.
 * @param {World} world
 * @returns {Record<string, number>}
 */
function statsSnapshot(world) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const k of STAT_COUNTERS) if (k !== 'playMs') out[k] = Number(world?.stats?.[k] ?? 0) || 0;
  return out;
}

/**
 * Opens the tally for a day: stats snapshot, zero amounts, no notes. Keeps `last`.
 * @param {World} world
 * @param {number} day core day
 * @returns {void}
 */
export function beginDay(world, day) {
  if (!isInt(day)) throw new TypeError('dayPage.beginDay: day must be an integer');
  const last = world.dayPage && typeof world.dayPage === 'object' ? world.dayPage.last ?? null : null;
  world.dayPage = { ...dayPageDefaults(), day, base: statsSnapshot(world), last };
}

/**
 * The core day the Day Page being written now belongs to: today from `dayStartMinute` (06:00), and
 * the previous day in the small hours before it (a night out past midnight is still that day's
 * page). Never below 0. Read-only.
 * @param {World} world
 * @param {{minute?: number, day?: number, tuning?: any}} [opts]
 * @param {any} [data]
 * @returns {number}
 */
export function pageDay(world, opts = {}, data = null) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  return Math.max(0, minuteNow(world, opts) < t.dayStartMinute ? day - 1 : day);
}

/**
 * The core day an overnight called now leads into, when the caller does not say (`ctx.toDay`):
 * this morning until {@link OVERNIGHT_GRACE_MINUTES} after 06:00 (Sleep after midnight, the 05:40 builds
 * anchor, the 06:00 anchor, the wake from a Sleep that skipped to dawn — clockSys.rest wakes at
 * 06:00), tomorrow after that (Sleep is offered from 21:00). A second call for a morning already
 * written therefore returns `'already'` instead of running tomorrow early, and a morning missed
 * altogether is never written late: like the letters it does not accrue (GDD-00 §11).
 * @param {World} world
 * @param {any} data
 * @param {{tuning?: any, graceMinutes?: number}} [opts]
 * @returns {number}
 */
export function nextMorning(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const cur = coreDay(world);
  const grace = isInt(opts.graceMinutes) && opts.graceMinutes >= 0 ? opts.graceMinutes : OVERNIGHT_GRACE_MINUTES;
  return minuteNow(world) < t.dayStartMinute + grace ? cur : cur + 1;
}

/**
 * Feeds a domain event into today's tally (FLOW forwards bus events here). Opens the tally first if
 * none is open, on the day the current page belongs to ({@link pageDay}: the small hours before
 * 06:00 still belong to the evening before). Returns whether anything changed.
 * @param {World} world
 * @param {string} evt
 * @param {any} payload
 * @returns {boolean}
 */
export function noteEvent(world, evt, payload) {
  if (typeof evt !== 'string') return false;
  if (!world.dayPage || !isInt(world.dayPage.day) || world.dayPage.day < 0) beginDay(world, pageDay(world));
  const D = world.dayPage;
  if (evt === 'wallet:changed') {
    const amount = payload?.currency === 'main' && isInt(payload?.delta) ? payload.delta : 0;
    if (amount <= 0) return false;
    D.earned += amount;
    return true;
  }
  if (evt === 'loan:paid') {
    const amount = isInt(payload?.amount) && payload.amount > 0 ? payload.amount : 0;
    if (!amount) return false;
    D.paid += amount;
    return true;
  }
  const make = NOTE_EVENTS[evt];
  if (!make) return false;
  const note = make(payload);
  if (typeof note !== 'string' || !note) return false;
  D.notes.push(note);
  if (D.notes.length > DAY_NOTES_MAX) D.notes.splice(0, D.notes.length - DAY_NOTES_MAX);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Summary and Tomorrow
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} TomorrowItem
 * @property {string} kind      build | graft | bench | forecast | letter | beat | low | carry | heirloom | errant | spire | <provider kind>
 * @property {any} [id]         what it is about (build id, uid, letter label, thread id, …)
 * @property {Record<string, any>} [params]   extra values for the strings template
 */

/**
 * @typedef {Object} DaySummary
 * @property {number} day          core day the page covers
 * @property {number} gameDay      GDD day number
 * @property {number} dow          GDD weekday (0 = Mon)
 * @property {number} buttons      buttons earned
 * @property {number} loanPaid     paid toward the loans
 * @property {number} catches  @property {number} fish  @property {number} forecasts  @property {number} battles
 * @property {number} lettersRead
 * @property {string[]} talkedTo   npc ids, sorted
 * @property {string[]} notes
 * @property {TomorrowItem[]} tomorrow
 */

/**
 * @typedef {Object} DayCtx
 * @property {number} [day]           core day the page covers (summaries) / today (previews)
 * @property {Bus|null} [bus]
 * @property {Array<(world: World, data: any, info: {day: number, gameDay: number}) => TomorrowItem[]|TomorrowItem|null>} [tomorrow]
 *   extra *Tomorrow:* providers (grafts, bench fossils, the Errant, the Spire you are ready for)
 * @property {(porchId: string) => boolean} [isPorchLit]
 * @property {any} [tuning]
 */

/**
 * The *Tomorrow:* list for the morning after `opts.day` (default: today), ordered by
 * {@link TOMORROW_ORDER}, at most `tomorrowMax` items. Read-only.
 * @param {World} world
 * @param {any} data
 * @param {DayCtx} [opts]
 * @returns {TomorrowItem[]}
 */
export function tomorrowList(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const today = coreDay(world, opts);
  const next = today + 1;
  /** @type {TomorrowItem[]} */
  const items = [];

  for (const b of world?.loans?.builds ?? []) {
    if (b && !b.done) items.push({ kind: 'build', id: b.id, params: { readyGameDay: gameDay(b.readyDay, t), lands: b.readyDay <= next, minute: t.buildLandMinute } });
  }
  for (const uid of world?.pendingShifts ?? []) {
    const c = (world.party ?? []).find((x) => x.uid === uid) ?? (world.box ?? []).find((x) => x.uid === uid);
    items.push({ kind: 'forecast', id: uid, params: { nickname: c?.nickname ?? null, speciesId: c?.speciesId ?? null } });
  }
  const letter = letters.nextLetterPreview(world, data, { ...opts, day: next });
  if (letter.n !== null) items.push({ kind: 'letter', id: letter.label, params: { n: letter.n, channel: letter.channel, minute: letters.tuningOf(data, opts).letterHour * 60 } });
  // Greenhouse grafts that take overnight (`sys.graft.<slot>` = `<fruit>|<core day>`, systems/flow/rooms)
  for (const [id, v] of Object.entries(world?.flags ?? {})) {
    if (!id.startsWith('sys.graft.') || typeof v !== 'string' || !v.includes('|')) continue;
    const [fruit, d] = v.split('|');
    if (Number(d) <= next) {
      let name = fruit;
      try { name = data && data.has && data.has('collections', fruit) ? data.get('collections', fruit).name ?? fruit : fruit; } catch { name = fruit; }
      items.push({ kind: 'graft', id: fruit, params: { fruit: String(name).toLowerCase() } });
    }
  }
  // a story appointment (FE-10): Corin's slip ("I'll be on the stones at the low"), which Dimity
  // says she has put under Tomorrow, stands until the first Forecast on the stones
  const f = world?.flags ?? {};
  if (f['seen.corin-slip'] === true && !f['sp.first-forecast']) items.push({ kind: 'meet', id: 'corin-stones', params: { who: 'Corin', place: 'the Lowmoor stones' } });
  for (const th of threads.openThreads(world, data, { ...opts, day: today })) {
    if (th.readyTomorrow) items.push({ kind: 'beat', id: th.threadId, params: { npcId: th.npcId, beat: th.nextBeat, title: th.title } });
  }
  const lows = lowsOn(world, next);
  if (lows.length) items.push({ kind: 'low', id: null, params: { minutes: lows } });
  const L = world?.letters;
  if (L) {
    if (L.counter !== null && L.counter !== undefined) items.push({ kind: 'carry', id: labelFor(data, L.counter), params: { n: L.counter, atCounter: true } });
    for (const n of L.carrying ?? []) items.push({ kind: 'carry', id: labelFor(data, n), params: { n, atCounter: false } });
    for (const n of L.awaiting ?? []) items.push({ kind: 'heirloom', id: labelFor(data, n), params: { n } });
  }
  for (const provider of Array.isArray(opts.tomorrow) ? opts.tomorrow : []) {
    if (typeof provider !== 'function') continue;
    const got = provider(world, data, { day: next, gameDay: gameDay(next, t) });
    for (const it of Array.isArray(got) ? got : got ? [got] : []) {
      if (it && typeof it.kind === 'string') items.push(clone(it));
    }
  }
  const rank = (k) => {
    const i = TOMORROW_ORDER.indexOf(k);
    return i < 0 ? TOMORROW_ORDER.length : i;
  };
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => rank(a.it.kind) - rank(b.it.kind) || a.i - b.i)
    .slice(0, t.tomorrowMax)
    .map((x) => x.it);
}

/**
 * @param {any} data
 * @param {number} n
 * @returns {string}
 */
function labelFor(data, n) {
  const row = letters.letterByN(data, n);
  return row ? letters.labelOf(data, row) : `#${n}`;
}

/**
 * The Day Page for a day (default: the open tally's day, else today). Read-only.
 * @param {World} world
 * @param {any} data
 * @param {DayCtx} [opts]
 * @returns {DaySummary}
 */
export function summarize(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const D = world?.dayPage && typeof world.dayPage === 'object' ? world.dayPage : dayPageDefaults();
  const day = isInt(opts.day) ? opts.day : D.day >= 0 ? D.day : coreDay(world);
  const own = D.day === day;
  const base = own ? D.base : statsSnapshot(world);
  const delta = (k) => Math.max(0, (Number(world?.stats?.[k] ?? 0) || 0) - (Number(base?.[k] ?? 0) || 0));
  const talkedTo = Object.keys(world?.npcs ?? {})
    .filter((id) => isInt(world.npcs[id]?.lastTalkDay) && world.npcs[id].lastTalkDay >= day)
    .sort();
  return {
    day,
    gameDay: gameDay(day, t),
    dow: dowOf(day, t),
    buttons: own ? D.earned : 0,
    loanPaid: own ? D.paid : 0,
    catches: delta('catches'),
    fish: delta('fishCaught'),
    forecasts: delta('forecasts'),
    battles: delta('battles'),
    lettersRead: delta('lettersRead'),
    talkedTo,
    notes: own ? D.notes.slice() : [],
    tomorrow: tomorrowList(world, data, { ...opts, day }),
  };
}

/**
 * One compact Archive line for a summary.
 * @param {DaySummary} s
 * @returns {string}
 */
export function logLine(s) {
  const parts = [`D${s.gameDay}`, `+${s.buttons}`];
  if (s.loanPaid) parts.push(`paid ${s.loanPaid}`);
  if (s.catches) parts.push(`${s.catches} caught`);
  if (s.fish) parts.push(`${s.fish} fish`);
  if (s.forecasts) parts.push(`${s.forecasts} Forecast${s.forecasts === 1 ? '' : 's'}`);
  if (s.talkedTo.length) parts.push(s.talkedTo.join(', '));
  return parts.join(' · ');
}

/**
 * What the night still holds, listed before confirming Sleep (GDD-00 §5 Rest): the next low before
 * morning, porch talk still open, porch-carried thread beats, a family letter at the counter, plus
 * the injected `opts.tonight` providers (Ludo, a Prismoth at your lamp). Read-only.
 * @param {World} world
 * @param {any} data
 * @param {DayCtx & {minute?: number, tonight?: Array<(world: World, data: any) => TomorrowItem[]|TomorrowItem|null>}} [opts]
 * @returns {TomorrowItem[]}
 */
export function tonightList(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const minute = minuteNow(world, opts);
  const now = day * MINUTES_PER_DAY + minute;
  const morning = (minute < t.dayStartMinute ? day : day + 1) * MINUTES_PER_DAY + t.dayStartMinute;
  /** @type {TomorrowItem[]} */
  const out = [];
  const lows = [...lowsOn(world, day).map((m) => day * MINUTES_PER_DAY + m), ...lowsOn(world, day + 1).map((m) => (day + 1) * MINUTES_PER_DAY + m)];
  const low = lows.find((x) => x > now && x < morning);
  if (low !== undefined) out.push({ kind: 'low', id: null, params: { minute: low % MINUTES_PER_DAY } });
  if (inWindow(minute, scheduleTuning(data, opts).porchWindow)) {
    out.push({ kind: 'porch', id: null, params: {} });
    for (const b of threads.eligibleBeats(world, data, opts)) if (b.porch) out.push({ kind: 'beat', id: b.threadId, params: { npcId: b.npcId, beat: b.beat } });
  }
  const L = world?.letters;
  if (L && L.counter !== null && L.counter !== undefined) out.push({ kind: 'carry', id: labelFor(data, L.counter), params: { n: L.counter, atCounter: true } });
  for (const provider of Array.isArray(opts.tonight) ? opts.tonight : []) {
    if (typeof provider !== 'function') continue;
    const got = provider(world, data);
    for (const it of Array.isArray(got) ? got : got ? [got] : []) if (it && typeof it.kind === 'string') out.push(clone(it));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The overnight
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} StepCtx
 * @property {number} day          the core day being started
 * @property {number} gameDay      its GDD day number
 * @property {number} endedDay     the core day being closed
 * @property {number} now          total minutes the step happens at (builds 05:40, others 06:00)
 * @property {Rng} rng             the step's labelled fork (`<stream>:<day>`, see {@link STEP_DAY_BASIS}),
 *   already positioned: draw from it directly. Do NOT hand it to a collaborator that forks its own
 *   `<stream>:<day>` label (gather.glintFor, weather.rollDay) or the stream is forked twice and no
 *   longer matches the overworld's; hand those `base` instead.
 * @property {{fork: (label: string) => Rng}} base   the base source the overworld uses (`rng.fork(label)`
 *   equals `rngs.fresh(label)` / `rngs.day(kind, day)`): pass it to gather.glintFor and weather.rollDay
 * @property {(label: string) => Rng} rngFor   any other labelled fork (same as `base.fork`)
 * @property {Bus|null} bus
 * @property {any} tuning
 */

/**
 * @typedef {Object} OvernightCtx
 * @property {number} [toDay]       core day the overnight leads into (default: {@link nextMorning})
 * @property {Bus|null} [bus]
 * @property {Partial<Record<string, (world: World, data: any, step: StepCtx) => any>>} [hooks]   collaborator steps by {@link OVERNIGHT_STEPS} name
 * @property {{landDue?: Function}} [loans]    shorthand: `loans.landDue(world, {data, bus, now})` becomes the `builds` hook
 * @property {boolean} [strict]     rethrow a failing hook instead of recording it
 * @property {DayCtx['tomorrow']} [tomorrow]
 * @property {(porchId: string) => boolean} [isPorchLit]
 * @property {(world: World, itemId: string, n: number) => any} [giveItem]
 * @property {(world: World, spec: any) => any} [addCreature]
 * @property {any} [tuning]
 */

/**
 * @typedef {Object} OvernightResult
 * @property {boolean} ran
 * @property {'already'|null} reason
 * @property {number} day           core day started
 * @property {number} endedDay      core day closed (always `day - 1`; a stale tally is relabelled to it)
 * @property {DaySummary|null} summary   the closed day's page
 * @property {Record<string, any>} steps  hook results by step name (skipped steps absent)
 * @property {Array<{step: string, message: string}>} errors
 * @property {any[]} heirlooms      heirlooms released this night
 * @property {ReturnType<typeof letters.deliverMorning>|null} mail
 */

/**
 * Runs the night (see the module comment). Idempotent per morning: a second call for a day the tally
 * already covers returns `{ran: false, reason: 'already'}`.
 * @param {World} world
 * @param {any} data
 * @param {any} rng   an `Rngs` registry, a `label -> Rng` function, an Rng (forked by label), or null
 * @param {OvernightCtx} [ctx]
 * @returns {OvernightResult}
 */
export function overnight(world, data, rng, ctx = {}) {
  const t = tuningOf(data, ctx);
  const toDay = isInt(ctx.toDay) ? ctx.toDay : nextMorning(world, data, ctx);
  const D = world.dayPage;
  const endedDay = toDay - 1;
  /** @type {OvernightResult} */
  const result = { ran: false, reason: null, day: toDay, endedDay, summary: null, steps: {}, errors: [], heirlooms: [], mail: null };
  if (D && isInt(D.day) && D.day >= toDay) {
    result.reason = 'already';
    return result;
  }
  const bus = ctx.bus ?? null;
  // a tally left open on an earlier day (mornings were skipped) is this night's page: what it
  // counted since then is what the night closes
  if (D && isInt(D.day) && D.day >= 0 && D.day < endedDay) D.day = endedDay;

  // 1. close the ending day
  const summary = summarize(world, data, { ...ctx, day: endedDay });
  result.summary = summary;
  const keep = t.dayPageLogLines;
  if (keep > 0) {
    world.log.push(logLine(summary));
    if (world.log.length > keep) world.log.splice(0, world.log.length - keep);
  }

  // 2. collaborator steps
  const hooks = { ...(ctx.hooks ?? {}) };
  if (!hooks.builds && ctx.loans && typeof ctx.loans.landDue === 'function') {
    const landDue = ctx.loans.landDue;
    hooks.builds = (w, d, s) => landDue(w, { data: d, bus: s.bus, now: s.now, tuning: ctx.tuning });
  }
  const fork = (label) => rngFor(rng, world, label);
  const base = Object.freeze({ fork });
  for (const step of OVERNIGHT_STEPS) {
    const hook = hooks[step];
    if (typeof hook !== 'function') continue;
    const minute = step === 'builds' ? t.buildLandMinute : t.dayStartMinute;
    /** @type {StepCtx} */
    const stepCtx = {
      day: toDay,
      gameDay: gameDay(toDay, t),
      endedDay,
      now: toDay * MINUTES_PER_DAY + minute,
      rng: fork(`${STEP_STREAMS[step] ?? step}:${STEP_DAY_BASIS[step] === 'game' ? gameDay(toDay, t) : toDay}`),
      base,
      rngFor: fork,
      bus,
      tuning: ctx.tuning ?? null,
    };
    try {
      result.steps[step] = hook(world, data, stepCtx);
    } catch (e) {
      if (ctx.strict) throw e;
      const message = String(e && /** @type {any} */ (e).message ? /** @type {any} */ (e).message : e);
      result.errors.push({ step, message });
      emit(bus, 'dayPage:error', { step, message, day: toDay });
    }
  }

  // 3. town steps: heirlooms, then the 06:00 mail
  const letterOpts = { day: toDay, bus, isPorchLit: ctx.isPorchLit, giveItem: ctx.giveItem, addCreature: ctx.addCreature, tuning: ctx.tuning };
  result.heirlooms = letters.releaseHeirlooms(world, data, letterOpts);
  result.mail = letters.deliverMorning(world, data, letterOpts);

  // 4. the new day's tally keeps the closed page for the porch-bench re-read
  beginDay(world, toDay);
  world.dayPage.last = clone(summary);
  result.ran = true;
  emit(bus, 'dayPage:written', { day: endedDay, gameDay: summary.gameDay, toDay });
  return result;
}

/**
 * Life threads, cast arcs and the template thread (GDD-00 §11; ARCHITECTURE §6.3, §14.7). [SYS-TOWN]
 *
 * The only writer of `world.threads` (tools/lint-owners). A thread row (`data.threads`):
 * `{id, npcId, title, kind?, involve?, beats: [{id, cond, script, advance?, where?, porch?, npcId?,
 * reward?, priority?}]}` with beats numbered 1..n. `kind` is `'lead'` (the six hand-written life
 * threads: finishing one pays the resident share), `'cast'` (Linnet, Wick, Ansel: scripted arcs on
 * the same system) or `'template'` (Thessaly's three beats); default `'lead'`.
 *
 * Rules (GDD-00 §11 "4–6 beats each, one beat a day at most, Monday beats for threads you are in;
 * finishing one pays the resident share"):
 *  - a beat is eligible when it is the next one, its `cond` holds, the player is involved (beat 1:
 *    the thread's NPC has been met and `involve` holds; later beats: the thread is under way), no beat
 *    of this thread advanced today (unless the beat says `advance.immediate`), its `advance.dayOfWeek`
 *    (GDD weekday) matches and `advance.days` have passed since the last beat — except that on Monday
 *    the spacing is waived for threads the player is in (`threadMondayWaivesSpacing`);
 *  - eligible beats become NPC topics through {@link beatTopics} (porch beats only at the porch), and
 *    the beat's script calls {@link advance} (or the `beat` op calls {@link setBeat});
 *  - completing a thread pays the resident share through the injected `opts.loans.residentShare
 *    (world, threadId, {data, tuning, bus, threadDay})` (RULES-ECON owns the money and
 *    `loans.residentShares`, and credits each thread once) when the last
 *    beat's `reward.share` says so, defaulting to "kind is in `threadShareKinds`".
 *
 * Events (§3.4): `thread:beat {threadId, npcId, kind, beat, day, done}`, `thread:done {threadId,
 * kind, share}`.
 *
 * Pure: no DOM, no randomness.
 * @module systems/threads
 */

import { threadStateDefaults } from '../state/schema.js';
import {
  CALENDAR_DEFAULTS, CALENDAR_SPEC, resolveTuning, tuningSource, rows, row, holds, emit, coreDay, dowOf,
} from './townCommon.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').ThreadState} ThreadState */
/** @typedef {{emit: (evt: string, payload?: any) => any}} Bus */

/** Thread kinds. */
export const THREAD_KINDS = Object.freeze(['lead', 'cast', 'template']);

/**
 * Designer numbers (GDD-00 §11). [GDD values]
 */
export const DEFAULTS = Object.freeze({
  ...CALENDAR_DEFAULTS,
  /** Kinds whose completion pays the resident share (GDD-00 §7: per finished lead thread). */
  threadShareKinds: Object.freeze(['lead']),
  /** Kinds limited to one beat per in-game day (GDD-00 §11). */
  threadDailyCapKinds: Object.freeze(['lead', 'template', 'cast']),
  /** GDD weekday of the Monday beat (0 = Monday). */
  threadMondayDow: 0,
  /** On Monday, `advance.days` spacing is waived for threads the player is in. */
  threadMondayWaivesSpacing: true,
  /** Beat 1 needs the thread's NPC met (the player is involved). */
  threadStartNeedsMet: true,
  /** Base topic priority of a beat (above every authored topic, §6.3 priority 1). */
  threadTopicPriority: 1000,
});

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

const isInt = (v) => Number.isInteger(v);
const kindList = (v) => Array.isArray(v) && v.every((k) => THREAD_KINDS.includes(k));
const SPEC = {
  ...CALENDAR_SPEC,
  threadShareKinds: [kindList, `(${THREAD_KINDS.join('|')})[]`],
  threadDailyCapKinds: [kindList, `(${THREAD_KINDS.join('|')})[]`],
  threadMondayDow: [(v) => isInt(v) && v >= 0 && v <= 6, 'integer 0..6'],
  threadMondayWaivesSpacing: [(v) => typeof v === 'boolean', 'boolean'],
  threadStartNeedsMet: [(v) => typeof v === 'boolean', 'boolean'],
  threadTopicPriority: [(v) => typeof v === 'number' && Number.isFinite(v), 'number'],
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
  return resolveTuning(DEFAULTS, SPEC, tuningSource(data, opts), CACHE, 'threads');
}

/**
 * @typedef {Object} ThreadOpts
 * @property {number} [day]          core day (default: the world clock's)
 * @property {Bus|null} [bus]
 * @property {{residentShare?: (world: World, threadId: string, ctx: {data: any, tuning: any, bus: Bus|null, threadDay: number}) => any}} [loans]
 *   RULES-ECON collaborator; only `residentShare` is used. Its ctx is a systems/econ `EconCtx`
 *   (`data` and `tuning` so the share follows the content ladder and the tuned fraction; no `day`,
 *   because econ reads `day` as its own 06:00-based economy day) plus `threadDay`, the core day the
 *   thread finished. `loans.residentShare` itself refuses a second credit for the same thread.
 * @property {boolean} [atPorch]     for {@link beatTopics}: the player is at the NPC's porch
 * @property {any} [tuning]
 */

/**
 * @typedef {Object} EligibleBeat
 * @property {string} threadId
 * @property {string} npcId          who carries the beat (`beat.npcId`, else the thread's)
 * @property {'lead'|'cast'|'template'} kind
 * @property {number} beat
 * @property {string} script
 * @property {{mapId: string, x: number, y: number}|null} where
 * @property {boolean} porch         carried by porch talk
 * @property {boolean} last          completes the thread
 * @property {string} title
 */

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

/**
 * A thread row's kind (default `'lead'`).
 * @param {any} def
 * @returns {'lead'|'cast'|'template'}
 */
export function kindOf(def) {
  return THREAD_KINDS.includes(def?.kind) ? def.kind : 'lead';
}

/**
 * A thread's state, read-only (defaults when it has not started).
 * @param {World} world
 * @param {string} threadId
 * @returns {ThreadState}
 */
export function stateOf(world, threadId) {
  const s = world?.threads?.[threadId];
  return s && typeof s === 'object' ? s : threadStateDefaults();
}

/**
 * Sorted beats of a thread row.
 * @param {any} def
 * @returns {any[]}
 */
function beatsOf(def) {
  return Array.isArray(def?.beats) ? def.beats.filter((b) => b && isInt(b.id)).slice().sort((a, b) => a.id - b.id) : [];
}

/**
 * The last beat id of a thread (0 when it has none).
 * @param {any} def
 * @returns {number}
 */
export function lastBeatOf(def) {
  const b = beatsOf(def);
  return b.length ? b[b.length - 1].id : 0;
}

/**
 * Whether the player is involved in a thread: under way (beat >= 1, not done), or — for beat 1 —
 * the thread's NPC has been met (when `threadStartNeedsMet`) and the row's `involve` holds.
 * @param {World} world
 * @param {any} data
 * @param {string|any} thread  id or row
 * @param {ThreadOpts} [opts]
 * @returns {boolean}
 */
export function isInvolved(world, data, thread, opts = {}) {
  const def = typeof thread === 'string' ? row(data, 'threads', thread) : thread;
  if (!def) return false;
  const st = stateOf(world, def.id);
  if (st.done) return false;
  if (st.beat >= 1) return true;
  const t = tuningOf(data, opts);
  if (t.threadStartNeedsMet && def.npcId && !world?.npcs?.[def.npcId]?.met) return false;
  return holds(world, def.involve, data, { npc: def.npcId ?? null });
}

/**
 * Why a thread's next beat is not eligible on `day` (null = it is).
 * @param {World} world
 * @param {any} data
 * @param {any} def   thread row
 * @param {ThreadOpts} [opts]
 * @returns {null|'done'|'no-beat'|'not-involved'|'today'|'weekday'|'spacing'|'cond'}
 */
export function beatBlock(world, data, def, opts = {}) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const st = stateOf(world, def.id);
  if (st.done) return 'done';
  const next = beatsOf(def).find((b) => b.id === st.beat + 1);
  if (!next) return 'no-beat';
  if (!isInvolved(world, data, def, opts)) return 'not-involved';
  const adv = next.advance && typeof next.advance === 'object' ? next.advance : {};
  const capped = t.threadDailyCapKinds.includes(kindOf(def));
  if (capped && !adv.immediate && st.lastAdvancedDay === day) return 'today';
  const dow = dowOf(day, t);
  if (Array.isArray(adv.dayOfWeek) && !adv.dayOfWeek.includes(dow)) return 'weekday';
  if (isInt(adv.days) && st.lastAdvancedDay >= 0 && day - st.lastAdvancedDay < adv.days) {
    const mondayWaiver = t.threadMondayWaivesSpacing && dow === t.threadMondayDow && st.beat >= 1;
    if (!mondayWaiver) return 'spacing';
  }
  if (!holds(world, next.cond, data, { npc: next.npcId ?? def.npcId ?? null })) return 'cond';
  return null;
}

/**
 * Every thread beat the player can see today.
 * @param {World} world
 * @param {any} data
 * @param {ThreadOpts} [opts]
 * @returns {EligibleBeat[]} in thread table order
 */
export function eligibleBeats(world, data, opts = {}) {
  const out = [];
  for (const def of rows(data, 'threads')) {
    if (!def || typeof def.id !== 'string') continue;
    if (beatBlock(world, data, def, opts) !== null) continue;
    const st = stateOf(world, def.id);
    const next = beatsOf(def).find((b) => b.id === st.beat + 1);
    out.push({
      threadId: def.id,
      npcId: next.npcId ?? def.npcId,
      kind: kindOf(def),
      beat: next.id,
      script: next.script,
      where: next.where && typeof next.where === 'object' ? next.where : null,
      porch: next.porch === true,
      last: next.id === lastBeatOf(def),
      title: typeof def.title === 'string' ? def.title : def.id,
    });
  }
  return out;
}

/**
 * Eligible beats as topics to inject into an NPC's topic list (§6.3 priority 1). Porch beats appear
 * only with `opts.atPorch`. Topic ids are `thread:<threadId>:<beat>`.
 * @param {World} world
 * @param {any} data
 * @param {string} npcId
 * @param {ThreadOpts} [opts]
 * @returns {Array<{id: string, script: string, priority: number, threadId: string, beat: number, porch: boolean, kind: string, where: any}>}
 */
export function beatTopics(world, data, npcId, opts = {}) {
  const t = tuningOf(data, opts);
  return eligibleBeats(world, data, opts)
    .filter((b) => b.npcId === npcId && (!b.porch || opts.atPorch))
    .map((b) => {
      const def = row(data, 'threads', b.threadId);
      const beat = beatsOf(def).find((x) => x.id === b.beat);
      return {
        id: `thread:${b.threadId}:${b.beat}`,
        script: b.script,
        priority: t.threadTopicPriority + (typeof beat?.priority === 'number' ? beat.priority : 0),
        threadId: b.threadId,
        beat: b.beat,
        porch: b.porch,
        kind: b.kind,
        where: b.where,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

/**
 * Applies a beat (no gating) and pays the completion reward.
 * @param {World} world
 * @param {any} data
 * @param {any} def
 * @param {number} beat
 * @param {ThreadOpts} opts
 * @returns {{done: boolean, share: any}}
 */
function applyBeat(world, data, def, beat, opts) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  if (!world.threads[def.id] || typeof world.threads[def.id] !== 'object') world.threads[def.id] = threadStateDefaults();
  const st = world.threads[def.id];
  const wasDone = st.done;
  st.beat = beat;
  if (st.startedDay < 0) st.startedDay = day;
  st.lastAdvancedDay = day;
  const lastId = lastBeatOf(def);
  st.done = lastId > 0 && beat >= lastId;
  const kind = kindOf(def);
  emit(opts.bus, 'thread:beat', { threadId: def.id, npcId: def.npcId ?? null, kind, beat, day, done: st.done });
  let share = null;
  if (st.done && !wasDone) {
    const last = beatsOf(def).find((b) => b.id === lastId);
    const pays = typeof last?.reward?.share === 'boolean' ? last.reward.share : t.threadShareKinds.includes(kind);
    if (pays && opts.loans && typeof opts.loans.residentShare === 'function') {
      share = opts.loans.residentShare(world, def.id, { data, tuning: opts.tuning ?? null, bus: opts.bus ?? null, threadDay: day });
    }
    emit(opts.bus, 'thread:done', { threadId: def.id, kind, share: pays, result: share ?? null });
  }
  return { done: st.done, share };
}

/**
 * Advances a thread by one beat after checking {@link beatBlock}. `opts.force` skips the checks
 * (still one beat forward), for scripted cast-arc triggers.
 * @param {World} world
 * @param {any} data
 * @param {string} threadId
 * @param {ThreadOpts & {force?: boolean}} [opts]
 * @returns {{ok: true, beat: number, done: boolean, share: any} | {ok: false, reason: string}}
 */
export function advance(world, data, threadId, opts = {}) {
  const def = row(data, 'threads', threadId);
  if (!def) return { ok: false, reason: 'unknown-thread' };
  const st = stateOf(world, threadId);
  if (st.done) return { ok: false, reason: 'done' };
  const nextId = st.beat + 1;
  if (!beatsOf(def).some((b) => b.id === nextId)) return { ok: false, reason: 'no-beat' };
  if (!opts.force) {
    const why = beatBlock(world, data, def, opts);
    if (why !== null) return { ok: false, reason: why };
  }
  const r = applyBeat(world, data, def, nextId, opts);
  return { ok: true, beat: nextId, done: r.done, share: r.share };
}

/**
 * Sets a thread's beat directly (the script `beat` / `thread` ops; debug). No gating; reaching the
 * last beat completes the thread and pays its reward once. Setting a lower beat re-opens it.
 * @param {World} world
 * @param {any} data
 * @param {string} threadId
 * @param {number} beat   0..last
 * @param {ThreadOpts} [opts]
 * @returns {{ok: true, beat: number, done: boolean, share: any} | {ok: false, reason: 'unknown-thread'|'bad-beat'}}
 */
export function setBeat(world, data, threadId, beat, opts = {}) {
  const def = row(data, 'threads', threadId);
  if (!def) return { ok: false, reason: 'unknown-thread' };
  const last = lastBeatOf(def);
  if (!isInt(beat) || beat < 0 || beat > last) return { ok: false, reason: 'bad-beat' };
  const r = applyBeat(world, data, def, beat, opts);
  return { ok: true, beat, done: r.done, share: r.share };
}

// ---------------------------------------------------------------------------------------------
// Previews
// ---------------------------------------------------------------------------------------------

/**
 * Beats of threads the player is in that will be eligible on the next Monday (today when it is
 * Monday): the Commons board's "this week's thread beats".
 * @param {World} world
 * @param {any} data
 * @param {ThreadOpts} [opts]
 * @returns {EligibleBeat[]}
 */
export function mondayBeats(world, data, opts = {}) {
  const t = tuningOf(data, opts);
  const day = coreDay(world, opts);
  const ahead = (t.threadMondayDow - dowOf(day, t) + 7) % 7;
  const monday = day + ahead;
  return eligibleBeats(world, data, { ...opts, day: monday })
    .filter((b) => stateOf(world, b.threadId).beat >= 1 || ahead === 0);
}

/**
 * Threads under way, for the Day Page's *Tomorrow:* list: each with its next beat and whether it
 * can land tomorrow.
 * @param {World} world
 * @param {any} data
 * @param {ThreadOpts} [opts]   `opts.day` = today
 * @returns {Array<{threadId: string, npcId: string, title: string, kind: string, beat: number, nextBeat: number|null, readyTomorrow: boolean}>}
 */
export function openThreads(world, data, opts = {}) {
  const day = coreDay(world, opts);
  const out = [];
  for (const def of rows(data, 'threads')) {
    if (!def || typeof def.id !== 'string') continue;
    const st = stateOf(world, def.id);
    if (st.done || st.beat < 1) continue;
    const next = beatsOf(def).find((b) => b.id === st.beat + 1) ?? null;
    out.push({
      threadId: def.id,
      npcId: def.npcId,
      title: typeof def.title === 'string' ? def.title : def.id,
      kind: kindOf(def),
      beat: st.beat,
      nextBeat: next ? next.id : null,
      readyTomorrow: next !== null && beatBlock(world, data, def, { ...opts, day: day + 1 }) === null,
    });
  }
  return out;
}

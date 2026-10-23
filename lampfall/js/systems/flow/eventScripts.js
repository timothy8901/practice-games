/**
 * Bus event -> `world.pendingScript` (ARCHITECTURE §3.4, §6.3 `EVENT_SCRIPTS`). [FLOW, built by SCN-UI]
 *
 * Content maps domain events to scripts with `data.eventScripts` rows `{id, event, script, cond?,
 * once?}`. `event` is a domain event name optionally followed by `:`-separated values that must all
 * appear among the payload's scalar fields: `'loan:tier:3'` fires on `loan:tier {tier: 3}`,
 * `'badge:won:moss-spire'` on `badge:won {spireId: 'moss-spire'}`, `'thread:beat:wren-tally:2'` on
 * `thread:beat {threadId, beat: 2}`. A row's `cond` (cond DSL) must hold, and a row is once-only by
 * default (skipped when `seen.<script>` is set; `once: false` repeats).
 *
 * The match is queued as `world.pendingScript`; the overworld runs it on its next enter / resume
 * through {@link runPending}, which also resumes a cutscene saved mid-run ({@link bookmarkCutscene}
 * keeps the runner's serialized position in `world.cutscene`). When a script is already pending the
 * next one waits in a small in-memory backlog and moves up when the first is taken.
 *
 * The only writer of `world.pendingScript` (with dayFlow) and of `world.cutscene` (tools/lint-owners).
 * Pure apart from {@link install} / {@link runPending}, which take the game context.
 * @module systems/flow/eventScripts
 */
import { evalCond } from '../../script/cond.js';

/** @typedef {import('../../state/schema.js').World} World */

/**
 * Domain events (§3.4 plus the town / economy events the systems emit), longest names first so a
 * row's base event is found by prefix.
 */
export const DOMAIN_EVENTS = Object.freeze([
  'world:replaced', 'party:changed', 'creature:levelUp', 'creature:learned', 'bag:changed', 'wallet:changed',
  'loan:paid', 'loan:tier', 'loan:built', 'flag:set', 'counter:inc', 'letter:delivered', 'letter:read',
  'letter:collected', 'letter:door', 'letter:heirloom', 'letter:pinned', 'letters:late-delivery',
  'thread:beat', 'thread:done', 'npc:talked', 'npc:nickname', 'npc:gift', 'npc:linger',
  'fieldLog:seen', 'fieldLog:read', 'fieldLog:held', 'collection:added', 'clock:minute', 'clock:hour',
  'clock:phase', 'clock:dayPart', 'clock:anchor', 'tide:change', 'day:start', 'day:end', 'weather:change',
  'map:enter', 'map:exit', 'player:step', 'encounter:start', 'battle:start', 'battle:end', 'capture:ok',
  'capture:fail', 'shift:window', 'shift:resolved', 'badge:won', 'summit:cleared', 'save:ok', 'save:fail',
  'shop:bought', 'shop:sold', 'crate:settled', 'dayPage:written', 'relighting:due', 'waystone:use',
].slice().sort((a, b) => b.length - a.length));

/** Payload fields whose scalar values a row's `:value` parts are matched against. */
export const MATCH_FIELDS = Object.freeze([
  'tier', 'id', 'spireId', 'n', 'label', 'threadId', 'beat', 'kind', 'mapId', 'npcId', 'uid',
  'speciesId', 'formId', 'phase', 'dayPart', 'hour', 'gameDay', 'channel', 'outcome', 'flag', 'name', 'choice',
]);

/** In-memory backlog of scripts waiting behind `world.pendingScript` (never serialized). */
const BACKLOG = new WeakMap();

/**
 * Splits a row's `event` into its domain event and the values that must match.
 * @param {string} event
 * @returns {{base: string, values: string[]}}
 */
export function parseEvent(event) {
  const e = String(event ?? '');
  const base = DOMAIN_EVENTS.find((d) => e === d || e.startsWith(`${d}:`));
  if (base) return { base, values: e === base ? [] : e.slice(base.length + 1).split(':').filter(Boolean) };
  const parts = e.split(':');
  return { base: parts.slice(0, 2).join(':'), values: parts.slice(2).filter(Boolean) };
}

/**
 * The scalar values of a payload a row may match (strings and finite numbers, as strings).
 * @param {any} payload
 * @returns {Set<string>}
 */
export function payloadValues(payload) {
  const out = new Set();
  if (payload === null || payload === undefined) return out;
  if (typeof payload !== 'object') { out.add(String(payload)); return out; }
  for (const f of MATCH_FIELDS) {
    const v = payload[f];
    if (typeof v === 'string' && v) out.add(v);
    else if (typeof v === 'number' && Number.isFinite(v)) out.add(String(v));
  }
  return out;
}

/**
 * Whether a row fires for an event and payload (ignores `cond` / `once`).
 * @param {{event: string}} row
 * @param {string} evt
 * @param {any} payload
 * @returns {boolean}
 */
export function rowMatches(row, evt, payload) {
  const { base, values } = parseEvent(row.event);
  if (base !== evt) return false;
  if (!values.length) return true;
  const have = payloadValues(payload);
  return values.every((v) => have.has(v));
}

/**
 * Rows of `data.eventScripts` (Registry or tables object).
 * @param {any} data
 * @returns {Array<{id: string, event: string, script: string, cond?: any, once?: boolean}>}
 */
export function eventRows(data) {
  if (!data) return [];
  try {
    if (typeof data.list === 'function') return data.list('eventScripts') ?? [];
  } catch { /* table missing */ }
  const t = data.eventScripts;
  return Array.isArray(t) ? t : [];
}

/**
 * @param {any} data
 * @param {string} id
 * @returns {boolean}
 */
function hasScript(data, id) {
  if (!data || typeof id !== 'string') return false;
  if (typeof data.has === 'function') return data.has('scripts', id);
  return Boolean(data.scripts && Object.prototype.hasOwnProperty.call(data.scripts, id));
}

/**
 * The script an event should queue, or null: the first row (data order) that matches, names a known
 * script, whose `cond` holds and which is not a spent once-only row.
 * @param {World} world
 * @param {any} data
 * @param {string} evt
 * @param {any} payload
 * @returns {string|null}
 */
export function scriptFor(world, data, evt, payload) {
  for (const row of eventRows(data)) {
    if (!row || typeof row.event !== 'string' || !rowMatches(row, evt, payload)) continue;
    if (!hasScript(data, row.script)) continue;
    if (row.once !== false && world?.flags?.[`seen.${row.script}`]) continue;
    if (row.cond !== undefined && row.cond !== null && !evalCond(world, row.cond, { data: typeof data?.has === 'function' ? data : null })) continue;
    if (world?.pendingScript === row.script || (BACKLOG.get(world) ?? []).includes(row.script)) continue;
    return row.script;
  }
  return null;
}

/**
 * Base domain events the rows listen to (deduplicated, data order).
 * @param {any} data
 * @returns {string[]}
 */
export function listenedEvents(data) {
  const out = [];
  for (const row of eventRows(data)) {
    if (!row || typeof row.event !== 'string') continue;
    const { base } = parseEvent(row.event);
    if (base && !out.includes(base)) out.push(base);
  }
  return out;
}

/**
 * Queues a script to run on the next overworld enter / resume. Call inside `store.tx`.
 * @param {World} world
 * @param {string} scriptId
 * @returns {{queued: boolean, where: 'pending'|'backlog'|null}}
 */
export function queue(world, scriptId) {
  if (typeof scriptId !== 'string' || !scriptId) return { queued: false, where: null };
  if (world.pendingScript === scriptId) return { queued: false, where: null };
  if (world.pendingScript === null || world.pendingScript === undefined || world.pendingScript === '') {
    world.pendingScript = scriptId;
    return { queued: true, where: 'pending' };
  }
  const list = BACKLOG.get(world) ?? [];
  if (!list.includes(scriptId)) list.push(scriptId);
  BACKLOG.set(world, list);
  return { queued: true, where: 'backlog' };
}

/**
 * The pending script without taking it.
 * @param {World} world
 * @returns {string|null}
 */
export function peekPending(world) {
  return typeof world?.pendingScript === 'string' && world.pendingScript ? world.pendingScript : null;
}

/**
 * Takes the pending script (clearing it; the backlog's next one moves up). Call inside `store.tx`.
 * @param {World} world
 * @returns {string|null}
 */
export function takePending(world) {
  const id = peekPending(world);
  const list = BACKLOG.get(world) ?? [];
  world.pendingScript = list.length ? /** @type {string} */ (list.shift()) : null;
  if (!list.length) BACKLOG.delete(world);
  return id;
}

/**
 * Scripts waiting behind the pending one (in memory only).
 * @param {World} world
 * @returns {string[]}
 */
export function backlog(world) {
  return (BACKLOG.get(world) ?? []).slice();
}

/**
 * Saves a running cutscene's position (`script/runner` `save()`), so a save mid-cutscene resumes at
 * the same request. Call inside `store.tx`.
 * @param {World} world
 * @param {string} scriptId
 * @param {any} state
 */
export function bookmarkCutscene(world, scriptId, state) {
  if (typeof scriptId !== 'string' || !scriptId || !state) return;
  world.cutscene = { scriptId, state: JSON.parse(JSON.stringify(state)) };
}

/**
 * Clears the bookmark when a cutscene ends. Call inside `store.tx`.
 * @param {World} world
 */
export function clearCutscene(world) {
  if (world.cutscene !== null) world.cutscene = null;
}

/**
 * The saved cutscene position, or null.
 * @param {World} world
 * @returns {{scriptId: string, state: any}|null}
 */
export function cutsceneBookmark(world) {
  const c = world?.cutscene;
  return c && typeof c.scriptId === 'string' && c.state ? c : null;
}

/**
 * Subscribes the event table on the bus: every matching event queues its script (inside a `tx`).
 * Returns the unsubscribe function.
 * @param {any} G   needs `bus`, `store`, `data`
 * @returns {() => void}
 */
export function install(G) {
  const offs = [];
  for (const evt of listenedEvents(G.data)) {
    offs.push(G.bus.on(evt, (payload) => {
      const id = scriptFor(G.world, G.data, evt, payload);
      if (id) G.store.tx(`eventScript:${evt}`, (w) => queue(w, id));
    }));
  }
  return () => { for (const off of offs) { try { off(); } catch { /* already gone */ } } };
}

/**
 * Starts what is waiting: a bookmarked cutscene resumes, else the pending script plays as a
 * cutscene. Call from the overworld's enter / resume (and after a load). Returns whether a scene was
 * pushed.
 * @param {any} G
 * @returns {boolean}
 */
export function runPending(G) {
  if (!G?.sceneFactories?.cutscene) return false;
  if (G.scenes.find && G.scenes.find('cutscene')) return false;
  const mark = cutsceneBookmark(G.world);
  if (mark && hasScript(G.data, mark.scriptId)) {
    G.push('cutscene', { resume: true });
    return true;
  }
  if (mark) G.store.tx('cutscene:drop', (w) => clearCutscene(w));
  const id = peekPending(G.world);
  if (!id) return false;
  G.store.tx('pendingScript:take', (w) => takePending(w));
  if (!hasScript(G.data, id)) return false;
  G.push('cutscene', { scriptId: id });
  return true;
}

/**
 * Registers the debug hook's `runScript` (draft §11): plays a script as a cutscene and resolves when
 * it ends.
 * @param {any} G
 */
export function bindDebug(G) {
  const hook = G?.debugHook;
  if (!hook || typeof hook.bind !== 'function') return;
  hook.bind('runScript', (scriptId) => new Promise((resolve) => {
    G.push('cutscene', { scriptId, onDone: () => resolve() });
  }));
}

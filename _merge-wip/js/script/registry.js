/**
 * Where scripts come from (ARCHITECTURE §6.3): `resolveScript(world, data, target)` picks the one
 * script or line an interaction should run. [SCRIPT]
 *
 * NPC priority, fixed: (1) the next beat of the npc's life thread whose `cond` holds; (2) a pending
 * favour topic (`topic.favour` ∈ `npcs[id].favours`); (3) the highest-priority eligible `topics`
 * entry (`once` / `repeatDays` honoured through `npcs[id].saidLines`); (4) the schedule pose line
 * (`lines[pose]`, then `lines[phase]`); (5) porch talk at the porch trigger inside the porch window;
 * (6) the memory-filtered generic pool (`lines.generic`, excluding ids said within
 * `tuning.noRepeatDays`; the least recently said wins; `linger` skips `lastLineId`); (7) the
 * default line. Line sources return an inline `say` script. No randomness.
 *
 * Pure. Writers never touch this; they add topics, beats and lines.
 * @module script/registry
 */

import { evalCond } from './cond.js';
import * as sel from '../state/selectors.js';
import { noRepeatDays, porchWindow } from '../data/tuning.js';
import { t } from '../data/strings.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../data/registry.js').Registry} Registry */
/** @typedef {import('./ops.js').Op} Op */

/**
 * @typedef {Object} ScriptTarget
 * @property {'npc'|'sign'|'trigger'|'porch'|'bed'|'mailbox'|'waystone'|'spire'|'commons'} kind
 * @property {string} id            npc id, entity id or trigger id
 * @property {boolean} [linger]     resolve again, skipping `lastLineId`
 * @property {string} [lastLineId]  the line just said (for `linger`)
 * @property {string} [pose]        the npc's current schedule pose (from systems/schedule)
 * @property {string} [script]      explicit script (triggers, use-verbs)
 * @property {string} [text]        sign text
 * @property {string|null} [mapId]
 */

/**
 * @typedef {Object} Resolved
 * @property {string} scriptId      a `scripts` id, or `<npcId>#<lineId>` for an inline line
 * @property {'thread'|'favour'|'topic'|'schedule'|'porch'|'generic'|'default'} source
 * @property {string} [lineId]
 * @property {string} [topicId]
 * @property {number} [beat]
 * @property {Op[]} ops             the ops to run (looked up or synthesized)
 */

/**
 * Source priority order, for tests and tooling.
 * @type {readonly string[]}
 */
export const SOURCE_ORDER = Object.freeze(['thread', 'favour', 'topic', 'schedule', 'porch', 'generic', 'default']);

/**
 * @param {string} npcId
 * @param {string} who
 * @param {string} lineId
 * @param {string} text
 * @param {Resolved['source']} source
 * @returns {Resolved}
 */
function line(npcId, who, lineId, text, source) {
  return { scriptId: `${npcId}#${lineId}`, source, lineId, ops: [{ op: 'say', who, text }, { op: 'end' }] };
}

/**
 * Resolves what to run for a target.
 * @param {World} world
 * @param {Registry} data
 * @param {ScriptTarget} target
 * @returns {Resolved}
 * @throws {TypeError} for a malformed target
 */
export function resolveScript(world, data, target) {
  if (!target || typeof target !== 'object' || typeof target.kind !== 'string' || typeof target.id !== 'string') {
    throw new TypeError('resolveScript: target needs {kind, id}');
  }
  if (target.kind === 'npc') return resolveNpc(world, data, target);
  if (target.kind === 'sign') {
    return { scriptId: `${target.id}#sign`, source: 'default', lineId: 'sign', ops: [{ op: 'say', text: target.text ?? t('npc.default') }, { op: 'end' }] };
  }
  const scriptId = target.script ?? `${target.kind}-${target.id}`;
  if (data.has('scripts', scriptId)) return { scriptId, source: 'default', ops: data.get('scripts', scriptId) };
  return { scriptId, source: 'default', ops: [{ op: 'say', text: t('npc.default') }, { op: 'end' }] };
}

/**
 * The NPC branch of {@link resolveScript}.
 * @param {World} world
 * @param {Registry} data
 * @param {ScriptTarget} target
 * @returns {Resolved}
 */
function resolveNpc(world, data, target) {
  const npcId = target.id;
  const npc = data.get('npcs', npcId);
  const mem = world.npcs?.[npcId] ?? null;
  const today = sel.day(world);
  const cctx = { data, npc: npcId, mapId: target.mapId ?? null };
  const holds = (cond) => cond === undefined || evalCond(world, cond, cctx);
  const script = (id, extra) => ({ scriptId: id, ops: data.get('scripts', id), ...extra });

  // (1) life thread: the next beat whose cond holds
  if (npc.threadId && data.has('threads', npc.threadId)) {
    const thread = data.get('threads', npc.threadId);
    const state = world.threads?.[thread.id] ?? { beat: 0, done: false };
    if (!state.done) {
      const next = thread.beats.find((b) => b.id === state.beat + 1);
      if (next && holds(next.cond) && data.has('scripts', next.script)) return script(next.script, { source: 'thread', beat: next.id });
    }
  }

  const topics = Array.isArray(npc.topics) ? npc.topics : [];
  const said = mem?.saidLines ?? {};
  const eligible = (topic) => {
    if (!holds(topic.cond)) return false;
    if (!data.has('scripts', topic.script)) return false;
    const last = said[topic.id];
    if (last !== undefined) {
      if (topic.once) return false;
      if (typeof topic.repeatDays === 'number' && today - last < topic.repeatDays) return false;
    }
    return true;
  };

  // (2) pending favour topic
  const favours = mem?.favours ?? [];
  const favour = topics.filter((tp) => typeof tp.favour === 'string' && favours.includes(tp.favour) && eligible(tp))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  if (favour) return script(favour.script, { source: 'favour', topicId: favour.id });

  // (3) highest-priority eligible topic
  const topic = topics.filter((tp) => typeof tp.favour !== 'string' && eligible(tp))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  if (topic) return script(topic.script, { source: 'topic', topicId: topic.id });

  // (4) schedule pose / phase line
  const lines = npc.lines ?? {};
  const pick = (key, source) => {
    const pool = lines[key];
    if (!Array.isArray(pool) || pool.length === 0) return null;
    const rows = pool.map((l, i) => (typeof l === 'string' ? { id: `${key}${i + 1}`, text: l } : l));
    const fresh = rows.filter((l) => l.id !== target.lastLineId || !target.linger);
    const row = (fresh.length ? fresh : rows).sort((a, b) => (said[a.id] ?? -1) - (said[b.id] ?? -1))[0];
    return line(npcId, npcId, row.id, row.text, source);
  };
  if (target.pose) { const r = pick(target.pose, 'schedule'); if (r) return r; }
  { const r = pick(sel.phase(world), 'schedule'); if (r) return r; }

  // (5) porch talk inside the porch window
  const minute = sel.minuteOfDay(world);
  if ((target.kind === 'porch' || target.pose === 'porch') && minute >= porchWindow[0] && minute < porchWindow[1]) {
    const r = pick('porch', 'porch');
    if (r) return r;
  }

  // (6) memory-filtered generic pool
  const generic = Array.isArray(lines.generic) ? lines.generic : [];
  if (generic.length) {
    const unsaidRecently = generic.filter((l) => {
      if (target.linger && l.id === target.lastLineId) return false;
      const last = said[l.id];
      return last === undefined || today - last >= noRepeatDays;
    });
    const pool = unsaidRecently.length ? unsaidRecently : generic.filter((l) => !(target.linger && l.id === target.lastLineId));
    const row = (pool.length ? pool : generic).slice().sort((a, b) => (said[a.id] ?? -1) - (said[b.id] ?? -1))[0];
    return line(npcId, npcId, row.id, row.text, 'generic');
  }

  // (7) default
  return line(npcId, npcId, 'default', t('npc.default'), 'default');
}

/**
 * Script id mapped to a bus event by `eventScripts` rows (§6.3 `EVENT_SCRIPTS`), or null.
 * @param {Registry} data
 * @param {string} event  e.g. `'loan:tier:3'`
 * @returns {string|null}
 */
export function eventScript(data, event) {
  const row = data.findBy('eventScripts', 'event', event)[0];
  return row && data.has('scripts', row.script) ? row.script : null;
}

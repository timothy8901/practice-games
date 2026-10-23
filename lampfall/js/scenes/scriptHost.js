/**
 * Shared script-host plumbing for the dialogue and cutscene scenes. [SCN-UI] — ARCHITECTURE §6.2.
 *
 * Both hosts drive one {@link Session}: a `script/runner` coroutine plus everything a host needs to
 * perform its requests (the system bindings for the pure ops, the speaker lookup, the text log).
 * A session is handed between scenes: `cutscene` runs the world ops and pushes `dialogue` with the
 * same session for text; `dialogue` keeps pulling requests while they are text and pops with the
 * first one it does not own (`{pending}`), so the slip never flickers between consecutive lines.
 *
 *  - {@link createSession}: builds the runner with `ctx.systems` bound to the owning systems
 *    (bag, wallet, party, memory, threads; flags default to systems/flags), always stepping inside
 *    `store.tx` so every pure op is a transaction and its domain events reach the bus.
 *  - {@link speakerOf}: display name, 48×48 bust id and the trade-tick pitch (GDD-09 §10.5).
 *  - {@link textLog}: the 100-line log of what was said (GDD-00 §15), per game context.
 *  - {@link textCps} / {@link reducedMotion}: settings reads with safe fallbacks.
 *  - {@link resolveTalk}: an NPC / sign target -> the session to run (script/registry priority).
 *
 * No DOM. The scenes import this; nothing in `systems/` does.
 * @module scenes/scriptHost
 */
import { createRunner, interpolate } from '../script/runner.js';
import { resolveScript } from '../script/registry.js';
import { TEXT_SPEEDS } from '../ui/theme.js';
import { PORTRAIT_IDS } from '../art/portraits.js';
import * as bag from '../systems/bag.js';
import * as wallet from '../systems/wallet.js';
import * as party from '../systems/party.js';
import * as memory from '../systems/memory.js';
import * as threads from '../systems/threads.js';

/** Host ops the dialogue scene performs itself (everything else goes back to a cutscene). */
export const DIALOGUE_OPS = Object.freeze(['say', 'choice', 'nickname', 'letter', 'openShop', 'toast', 'playSfx', 'take']);
/** Host ops that need the text slip (a cutscene pushes `dialogue` for these). */
export const TEXT_OPS = Object.freeze(['say', 'choice', 'nickname', 'take']);
/** Lines kept in the text log (GDD-00 §15 "a 100-line log"). */
export const LOG_MAX = 100;
/** Ms of the `~` beat in script text (ARCHITECTURE §6.1). */
export const TILDE_BEAT_MS = 300;

/**
 * Trade ticks by speaker (GDD-09 §10.5): semitone offsets for `textTick` until voices exist.
 * Everyone else: `hash(id) % 7 - 3`.
 */
export const SPEAKER_TICKS = Object.freeze({ wren: -3, ambrose: -10, juniper: 7, hesper: 0, barnaby: 0, corin: -5 });

/**
 * Small string hash (FNV-1a), for stable per-speaker pitches.
 * @param {string} s
 * @returns {number}
 */
export function hashId(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/**
 * The text-tick semitone offset for a speaker id (narration: 0).
 * @param {string|null|undefined} id
 * @returns {number}
 */
export function tickPitch(id) {
  if (!id) return 0;
  if (Object.prototype.hasOwnProperty.call(SPEAKER_TICKS, id)) return SPEAKER_TICKS[id];
  return (hashId(id) % 7) - 3;
}

/**
 * Characters per second for the current text-speed setting (`instant` = Infinity).
 * @param {any} G
 * @returns {number}
 */
export function textCps(G) {
  const s = G?.world?.settings?.textSpeed;
  return Object.prototype.hasOwnProperty.call(TEXT_SPEEDS, s) ? TEXT_SPEEDS[s] : TEXT_SPEEDS.normal;
}

/**
 * Whether reduced motion is on (settings or `?noanim=1`).
 * @param {any} G
 * @returns {boolean}
 */
export function reducedMotion(G) {
  return Boolean(G?.world?.settings?.reducedMotion);
}

/**
 * Whether long animations should collapse (`settings.skipAnims` or `?noanim=1`).
 * @param {any} G
 * @returns {boolean}
 */
export function skipAnims(G) {
  return Boolean(G?.world?.settings?.skipAnims || G?.flags?.noanim);
}

/**
 * Frames (60 fps) to ms, honouring skipAnims (collapses to 0).
 * @param {any} G
 * @param {number} frames
 * @returns {number}
 */
export function framesMs(G, frames) {
  return skipAnims(G) ? 0 : (frames * 1000) / 60;
}

/**
 * @typedef {Object} Speaker
 * @property {string|null} id          npc id (or the raw `who` when it is not an id)
 * @property {string} name             display name ('' for narration)
 * @property {string|null} portrait    a js/art/portraits id, or null (placeholder bust)
 * @property {number} tick             text-tick semitones
 */

/**
 * Who is speaking: name from the request (the runner resolves npc names and nicknames), bust from
 * the request's `portrait`, else the npc row's `portrait`, else the id itself when a bust exists.
 * @param {any} G
 * @param {{who?: string|null, name?: string|null, portrait?: string|null}} req
 * @returns {Speaker}
 */
export function speakerOf(G, req) {
  const who = typeof req?.who === 'string' && req.who ? req.who : null;
  if (!who) return { id: null, name: '', portrait: null, tick: 0 };
  const data = G?.data;
  const row = data && typeof data.has === 'function' && data.has('npcs', who) ? data.get('npcs', who) : null;
  const name = typeof req.name === 'string' && req.name ? req.name : row?.name ?? who;
  const candidates = [req.portrait, row?.portrait, who, typeof row?.id === 'string' ? row.id : null];
  const portrait = candidates.find((p) => typeof p === 'string' && PORTRAIT_IDS.includes(p)) ?? null;
  return { id: who, name, portrait, tick: tickPitch(who) };
}

// ---------------------------------------------------------------------------------------------
// The text log
// ---------------------------------------------------------------------------------------------

/** @type {WeakMap<object, Array<{who: string, text: string}>>} */
const LOGS = new WeakMap();

/**
 * The 100-line text log of a game context (what was said, newest last). The Journal's Log tab reads
 * `lines()`; dialogue pushes every say it shows (and every line a skipped cutscene ran past).
 * @param {object} G
 * @returns {{push: (who: string, text: string) => void, lines: () => Array<{who: string, text: string}>, clear: () => void, size: number}}
 */
export function textLog(G) {
  const key = G && typeof G === 'object' ? G : textLog;
  let list = LOGS.get(key);
  if (!list) { list = []; LOGS.set(key, list); }
  const L = list;
  return {
    push(who, text) {
      const clean = String(text ?? '').replace(/~/g, '').replace(/\|/g, ' ').replace(/\f/g, ' ').trim();
      if (!clean) return;
      L.push({ who: String(who ?? ''), text: clean });
      if (L.length > LOG_MAX) L.splice(0, L.length - LOG_MAX);
    },
    lines: () => L.map((l) => ({ ...l })),
    clear: () => { L.length = 0; },
    get size() { return L.length; },
  };
}

// ---------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------

/**
 * The runner's system bindings for a game context (ARCHITECTURE §6.2: one code path applies every
 * rule). Flags and counters use the runner defaults (systems/flags, forwarding the bus).
 * @param {any} G
 * @returns {import('../script/runner.js').ScriptSystems}
 */
export function scriptSystems(G) {
  const bus = G?.bus ?? null;
  const data = G?.data ?? null;
  return {
    give: (w, item, n) => bag.give(w, item, n, { data, bus, source: 'script' }),
    take: (w, item, n, c) => bag.take(w, item, n, { data, bus, source: 'script', confirm: c?.confirm === true }),
    earn: (w, amount) => wallet.earn(w, amount, { data, bus, source: 'script' }),
    spend: (w, amount) => wallet.spend(w, amount, { data, bus, source: 'script' }),
    addCreature: (w, spec, c) => party.giveCreature(w, { species: spec.species, level: spec.level, nick: spec.nick ?? undefined }, data, c?.rng ?? null, { bus }),
    remember: (w, npc, key, value) => memory.remember(w, npc, key, value),
    setBeat: (w, threadId, beat) => (beat === null || beat === undefined
      ? threads.advance(w, data, threadId, { bus })
      : threads.setBeat(w, data, threadId, beat, { bus })),
  };
}

/**
 * @typedef {Object} Session
 * @property {string|null} scriptId        data script id (null for inline lines)
 * @property {string|null} npc
 * @property {string|null} mapId
 * @property {any} target                  the talk target that resolved it (for Linger), or null
 * @property {string|null} lineId          registry line / topic id said (recorded when the session ends)
 * @property {(answer?: any) => any} next  steps the runner inside `store.tx`; returns a Request or `{done: true}`
 * @property {() => any} save              runner position (JSON)
 * @property {() => boolean} isDone
 * @property {any} runner
 * @property {Record<string, any>} vars
 * @property {boolean} skippable           a cutscene allows hold-to-skip
 * @property {string|null} recap           recap line for a skip (params or composed)
 */

/**
 * Creates (or resumes) a session.
 * @param {any} G
 * @param {{scriptId?: string|null, ops?: any[], npc?: string|null, mapId?: string|null, state?: any,
 *   vars?: Record<string, any>, target?: any, lineId?: string|null, skippable?: boolean, recap?: string|null}} o
 * @returns {Session}
 * @throws {Error} when neither ops nor a known script id is given
 */
export function createSession(G, o) {
  const data = G?.data ?? null;
  const known = typeof o.scriptId === 'string' && data && typeof data.has === 'function' && data.has('scripts', o.scriptId);
  const ops = Array.isArray(o.ops) ? o.ops : known ? data.get('scripts', /** @type {string} */ (o.scriptId)) : null;
  if (!ops) throw new Error(`script host: no script '${o.scriptId}' and no ops given`);
  const scriptId = known ? /** @type {string} */ (o.scriptId) : null;
  const rngs = G?.rngs;
  const rng = rngs && typeof rngs.fresh === 'function' ? rngs.fresh(`script:${scriptId ?? 'inline'}`) : null;
  const ctx = {
    world: G.world,
    data,
    rng,
    vars: o.vars ?? {},
    npc: o.npc ?? null,
    mapId: o.mapId ?? G?.world?.player?.mapId ?? null,
    scriptId,
    systems: scriptSystems(G),
    bus: G?.bus ?? null,
  };
  const runner = createRunner(ops, ctx, o.state ?? null);
  /** @type {Session} */
  const session = {
    scriptId,
    npc: ctx.npc,
    mapId: ctx.mapId,
    target: o.target ?? null,
    lineId: o.lineId ?? null,
    runner,
    vars: runner.vars,
    skippable: o.skippable === true,
    recap: typeof o.recap === 'string' ? o.recap : null,
    next(answer) {
      // the live world may have been replaced (load); the runner keeps the one it started with,
      // which is the right one for a running script
      return G.store.tx(`script:${scriptId ?? 'inline'}`, () => runner.step(answer));
    },
    save: () => runner.save(),
    isDone: () => runner.isDone(),
  };
  return session;
}

/**
 * Resolves a talk target (npc, porch, sign, trigger) into a session through script/registry, and
 * records the conversation in neighbour memory (met, talks, the line said) the way interactFlow will.
 * @param {any} G
 * @param {{kind: string, id: string, linger?: boolean, lastLineId?: string|null, pose?: string, mapId?: string|null, text?: string, script?: string, atPorch?: boolean}} target
 * @param {{record?: boolean}} [opts]
 * @returns {Session}
 */
export function resolveTalk(G, target, opts = {}) {
  const world = G.world;
  const resolved = resolveScript(world, G.data, { ...target, mapId: target.mapId ?? world.player?.mapId ?? null });
  const isNpc = (target.kind === 'npc' || target.kind === 'porch') && G.data.has('npcs', target.id);
  if (isNpc && opts.record !== false && !target.linger) {
    G.store.tx('npc:talk', (w) => memory.talk(w, target.id, G.data, { bus: G.bus, porch: target.kind === 'porch' || target.atPorch === true }));
  }
  const known = G.data.has('scripts', resolved.scriptId);
  return createSession(G, {
    scriptId: known ? resolved.scriptId : null,
    ops: resolved.ops,
    npc: isNpc ? target.id : null,
    mapId: target.mapId ?? null,
    target: isNpc ? { ...target } : null,
    lineId: resolved.topicId ?? resolved.lineId ?? (known ? resolved.scriptId : null),
  });
}

/**
 * Records the line / topic a finished NPC session said (memory.recordLine), so Linger and the
 * no-repeat window skip it next time.
 * @param {any} G
 * @param {Session} session
 */
export function recordSaid(G, session) {
  if (!session || !session.npc || !session.lineId) return;
  const id = session.lineId;
  if (typeof id !== 'string' || !id) return;
  G.store.tx('npc:line', (w) => memory.recordLine(w, /** @type {string} */ (session.npc), id));
}

/**
 * Whether the Linger seal is offered at the end of a session (an NPC, talked today, not lingered).
 * @param {any} G
 * @param {Session|null} session
 * @returns {boolean}
 */
export function canLinger(G, session) {
  if (!session || !session.npc || !session.target) return false;
  try {
    return memory.canLinger(G.world, session.npc, G.data);
  } catch {
    return false;
  }
}

/**
 * Uses today's Linger and resolves the second topic (never the line just said).
 * @param {any} G
 * @param {Session} session
 * @returns {Session|null}
 */
export function lingerSession(G, session) {
  if (!canLinger(G, session)) return null;
  const npc = /** @type {string} */ (session.npc);
  const res = G.store.tx('npc:linger', (w) => memory.linger(w, npc, G.data, { bus: G.bus }));
  if (!res.ok) return null;
  const last = G.world.npcs?.[npc]?.lastLineId ?? session.lineId ?? null;
  return resolveTalk(G, { ...session.target, linger: true, lastLineId: last }, { record: false });
}

/**
 * Text as the slip shows it: `{tokens}` filled (requests arrive filled; this is for raw strings),
 * `|` page breaks become form feeds.
 * @param {string} text
 * @param {any} [ctx]
 * @returns {string}
 */
export function slipText(text, ctx) {
  const filled = ctx ? interpolate(String(text ?? ''), ctx) : String(text ?? '');
  return filled.replace(/\|/g, '\f');
}

/**
 * Splits a page into its visible text and the positions of `~` beats (index in visible characters,
 * newlines not counted, as core/font `drawTextTyped` counts).
 * @param {string} page
 * @returns {{text: string, beats: number[]}}
 */
export function stripBeats(page) {
  const beats = [];
  let out = '';
  let visible = 0;
  for (const ch of Array.from(String(page ?? ''))) {
    if (ch === '~') { beats.push(visible); continue; }
    out += ch;
    if (ch !== '\n') visible++;
  }
  return { text: out, beats };
}

/**
 * Parses a compact move path (`"UUURRD"`, `"U3R2"`, `"up,up,left"`) into directions.
 * @param {string} path
 * @returns {Array<'up'|'down'|'left'|'right'>}
 */
export function parsePath(path) {
  const MAP = { U: 'up', D: 'down', L: 'left', R: 'right', N: 'up', S: 'down', W: 'left', E: 'right' };
  const s = String(path ?? '').trim();
  /** @type {Array<'up'|'down'|'left'|'right'>} */
  const out = [];
  if (/[a-z]{2,}/.test(s)) {
    for (const part of s.split(/[\s,]+/)) {
      const w = part.toLowerCase();
      if (w === 'up' || w === 'down' || w === 'left' || w === 'right') out.push(w);
    }
    return out;
  }
  const re = /([UDLRNSWE])(\d*)/gi;
  let m;
  while ((m = re.exec(s))) {
    const dir = MAP[m[1].toUpperCase()];
    const n = m[2] ? Math.min(64, parseInt(m[2], 10)) : 1;
    for (let i = 0; i < n; i++) out.push(dir);
  }
  return out;
}

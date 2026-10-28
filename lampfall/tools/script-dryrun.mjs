#!/usr/bin/env node
/**
 * Script dry-run: runs every script in the merged registry (story, NPC, thread and trainer scripts,
 * exactly as js/data/content.js assembles them) through js/script/runner.js against a stub host,
 * on every choice branch, and reports what would break in play. [TOOLS]
 *
 * Two passes per script:
 *  - **natural**: a fresh world on the script's own map (the map whose trigger runs it, else
 *    Pellwick), real conditions; every eligible option of every `choice` is taken at least once,
 *    plus both answers of `take {ask}` and the win/blackout answers of a `startBattle {onLose}`.
 *  - **forced**: the same exploration with every `if` and `branch` turned into a decision too and
 *    every option cond lifted, so each `then` / `else` / case / option block runs at least once
 *    whatever the world says. (Map bounds are not checked here: a forced `{map}` branch may stage
 *    another map's marker.)
 *
 * Exploration is coverage-driven: a path follows the first option at each decision and every option
 * not yet covered at that decision is queued as a new path (re-run from the start with the answers
 * so far). A decision revisited more than {@link LOOP_LIMIT} times on one path ends that path as a
 * deliberate loop (Maud's practice table), not an error.
 *
 * Findings:
 *  - `throw`      the runner threw (unknown op, missing label, unknown call target, unbound system,
 *                 a choice with no eligible option, ...)
 *  - `unknown-op` an op name not in script/ops.OPS (static, every branch)
 *  - `unknown-id` a reference that does not resolve: validateOps' table refs plus sfx names, music
 *                 tracks, spawn art, the actor of teleport/face/emote/move/despawn (`player`, an npc
 *                 with resolvable character art, or something this script spawned), letter numbers,
 *                 warp/teleport/camera cells inside their map
 *  - `dead-end`   a path that never finishes (more than {@link MAX_REQUESTS} host requests), a script
 *                 whose every path was cut as a loop, or a choice option whose `then` can never run
 *                 because the same option also has a `goto` (the runner jumps first)
 *
 * Usage: node tools/script-dryrun.mjs [--quiet] [--json] [--script <id>] [--warnings]
 * Exit 1 when anything is found. Pure apart from the CLI block.
 * @module tools/script-dryrun
 */
import { pathToFileURL } from 'node:url';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { createRunner } from '../js/script/runner.js';
import { OPS, normalizeOp, walkOps, validateOps } from '../js/script/ops.js';
import { validateCond } from '../js/script/cond.js';
import { isKnownSfx } from '../js/audio/sfxMap.js';
import { TRACKS } from '../js/audio/tracks/index.js';
import { resolveArtId } from '../js/art/atlas.js';
import '../js/art/chars/index.js';
import '../js/art/creatures/index.js';

/** Host requests one path may make before it counts as unbounded. */
export const MAX_REQUESTS = 1500;
/** Visits to one decision on one path before the path is cut as a loop. */
export const LOOP_LIMIT = 3;
/** Paths per script and pass before exploration stops (reported as `truncated`). */
export const MAX_PATHS = 4000;

const SEED = encodeSeedCode({ seed: 4242, dial: 'FLUX', toggles: [] });

/**
 * The merged registry the game runs on.
 * @returns {{data: any, scripts: Record<string, any[]>}}
 */
export function loadRegistry() {
  const data = createRegistry({ ...DATA_CONTENT });
  return { data, scripts: DATA_CONTENT.scripts };
}

/**
 * Script id -> the map a trigger runs it on (first trigger wins).
 * @param {any} data
 * @returns {Map<string, string>}
 */
function triggerMaps(data) {
  const out = new Map();
  for (const m of data.list('maps')) for (const t of m.triggers ?? []) if (t.script && !out.has(t.script)) out.set(t.script, m.id);
  return out;
}

// ---------------------------------------------------------------------------------------------
// forced mode: if / branch become decisions; option conds are lifted
// ---------------------------------------------------------------------------------------------

/**
 * @param {any[]} list
 * @param {(id: string) => boolean} isNpcId
 * @returns {any[]}
 */
export function forceOps(list, isNpcId) {
  if (!Array.isArray(list)) return list;
  return list.map((raw) => {
    if (typeof raw === 'string') return raw;
    let op;
    try { op = normalizeOp(raw, isNpcId); } catch { return raw; }
    if (op.op === 'if') {
      return { op: 'choice', dry: 'if', options: [
        { text: 'then', then: forceOps(Array.isArray(op.then) ? op.then : [], isNpcId) },
        { text: 'else', then: forceOps(Array.isArray(op.else) ? op.else : [], isNpcId) },
      ] };
    }
    if (op.op === 'branch') {
      const keys = Object.keys(op.cases ?? {});
      const options = keys.map((k) => ({ text: `case ${k}`, then: forceOps(op.cases[k], isNpcId) }));
      if (!keys.includes('default')) options.push({ text: 'no case', then: [] });
      return { op: 'choice', dry: 'branch', options };
    }
    if (op.op === 'choice' && Array.isArray(op.options)) {
      return { ...op, options: op.options.map(({ cond, ...o }) => (Array.isArray(o.then) ? { ...o, then: forceOps(o.then, isNpcId) } : o)) };
    }
    return op;
  });
}

// ---------------------------------------------------------------------------------------------
// static checks (every branch, no world)
// ---------------------------------------------------------------------------------------------

/**
 * @param {string} id
 * @param {any[]} ops
 * @param {any} data
 * @param {{trackIds: Set<string>, letterNs: Set<number>}} env
 * @returns {Array<{kind: string, msg: string}>}
 */
export function staticFindings(id, ops, data, env) {
  const out = [];
  const isNpcId = (x) => data.has('npcs', x);
  const has = (t, k) => data.has(t, k);
  const v = validateOps(ops, { scriptId: id, has, isNpcId, validateCond: (c) => validateCond(c, { has }) });
  for (const e of v.errors) out.push({ kind: /unknown op/.test(e) ? 'unknown-op' : 'unknown-id', msg: e });
  const spawned = new Set();
  walkOps(ops, (op) => { if (op.op === 'spawn' && typeof op.who === 'string') spawned.add(op.who); }, isNpcId);
  walkOps(ops, (op, path) => {
    const at = `scripts:${id}[${path.join('.')}]`;
    if (!OPS[op.op]) return; // reported by validateOps
    if (op.op === 'playSfx' && !isKnownSfx(op.name)) out.push({ kind: 'unknown-id', msg: `${at}: sfx '${op.name}' is not a known sound` });
    if (op.op === 'music' && op.track !== null && !env.trackIds.has(op.track)) out.push({ kind: 'unknown-id', msg: `${at}: music track '${op.track}' is not in audio/tracks` });
    if (op.op === 'spawn' && !resolveArtId(op.artId)) out.push({ kind: 'unknown-id', msg: `${at}: spawn art '${op.artId}' does not resolve` });
    if (['teleport', 'face', 'emote', 'move', 'despawn'].includes(op.op)) {
      const who = op.who;
      const ok = who === 'player' || spawned.has(who) || (isNpcId(who) && resolveArtId(`char-${who}`));
      if (!ok) out.push({ kind: 'unknown-id', msg: `${at}: ${op.op} actor '${who}' is not the player, a spawned actor or an npc with character art` });
    }
    if (op.op === 'letter' && op.n !== undefined && !env.letterNs.has(op.n)) out.push({ kind: 'unknown-id', msg: `${at}: letter ${op.n} is not in letters` });
    if (op.op === 'warp' && data.has('maps', op.mapId)) {
      const m = data.get('maps', op.mapId);
      if (!(op.x >= 0 && op.y >= 0 && op.x < m.w && op.y < m.h)) out.push({ kind: 'unknown-id', msg: `${at}: warp (${op.x},${op.y}) is outside map '${op.mapId}'` });
    }
    if (op.op === 'forecast' && !(typeof op.who === 'string' && (/^player:c\d+$/.test(op.who) || op.who === 'reading'))) out.push({ kind: 'unknown-id', msg: `${at}: forecast who '${op.who}' is not a party uid (player:cN) or 'reading'` });
    if (op.op === 'choice') (op.options ?? []).forEach((o, k) => {
      if (o && typeof o.goto === 'string' && Array.isArray(o.then) && o.then.length) out.push({ kind: 'dead-end', msg: `${at}: choice option ${k} has both goto and then; the runner jumps to '${o.goto}' and never runs then` });
    });
  }, isNpcId);
  return out;
}

// ---------------------------------------------------------------------------------------------
// dynamic exploration
// ---------------------------------------------------------------------------------------------

/**
 * A stub of the systems the pure ops call; records nothing but validates the ids it is given.
 * @param {any} data
 * @param {(msg: string) => void} report
 */
function stubSystems(data, report) {
  return {
    setFlag(w, id, value = true) { if (typeof id !== 'string' || !id) report(`setFlag with a bad id ${JSON.stringify(id)}`); w.flags[id] = value; },
    inc(w, id, by = 1) { w.counters = w.counters ?? {}; w.counters[id] = (w.counters[id] ?? 0) + by; },
    give(w, item) { if (!data.has('items', item)) report(`give: unknown item '${item}'`); return { ok: true }; },
    take(w, item) { if (!data.has('items', item)) report(`take: unknown item '${item}'`); return { ok: true }; },
    earn(w, n) { w.wallet.main += n; },
    spend(w, n) { w.wallet.main -= n; },
    addCreature(w, spec) { if (!data.has('species', spec.species)) report(`addCreature: unknown species '${spec.species}'`); },
    remember(w, npc) { if (!data.has('npcs', npc)) report(`remember: unknown npc '${npc}'`); },
    setBeat(w, thread) { if (!data.has('threads', thread)) report(`setBeat: unknown thread '${thread}'`); },
  };
}

/**
 * The answers a decision request offers, or null for an ordinary host request.
 * @param {any} req
 * @returns {any[]|null}
 */
function decisionAnswers(req) {
  if (req.op === 'choice') return req.options.map((_, i) => i);
  if (req.op === 'take') return [true, false];
  if (req.op === 'startBattle' && typeof req.onLose === 'string') return [{ outcome: 'win' }, { outcome: 'loss', blackout: true }];
  return null;
}

/** @param {any} req */
function plainAnswer(req) {
  switch (req.op) {
    case 'nickname': return 'Testy';
    case 'forecast': return { outcome: 'accepted' };
    case 'startBattle': return { outcome: 'win' };
    default: return undefined;
  }
}

/**
 * Explores one script in one mode.
 * @param {string} id
 * @param {{data: any, mode: 'natural'|'forced', mapId: string}} opts
 * @returns {{paths: number, completed: number, loops: number, truncated: boolean, findings: Array<{kind: string, msg: string}>}}
 */
export function exploreScript(id, { data, mode, mapId }) {
  const isNpcId = (x) => data.has('npcs', x);
  const forcedCache = new Map();
  const getScript = (sid) => {
    const ops = data.get('scripts', sid);
    if (mode !== 'forced') return ops;
    if (!forcedCache.has(sid)) forcedCache.set(sid, forceOps(ops, isNpcId));
    return forcedCache.get(sid);
  };
  const runData = { ...data, has: (t, k) => data.has(t, k), list: (t) => data.list(t), get: (t, k) => (t === 'scripts' ? getScript(k) : data.get(t, k)) };
  const covered = new Set();
  const queue = [[]];
  const findings = [];
  const seenMsg = new Set();
  const note = (kind, msg) => { const k = `${kind}|${msg}`; if (!seenMsg.has(k)) { seenMsg.add(k); findings.push({ kind, msg }); } };
  let paths = 0, completed = 0, loops = 0, truncated = false;

  while (queue.length) {
    if (paths >= MAX_PATHS) { truncated = true; break; }
    const prefix = /** @type {any[]} */ (queue.pop());
    paths++;
    const world = createNewWorld({ seedCode: SEED });
    world.player.mapId = mapId;
    let curMap = mapId;
    const where = () => `${id} (${mode}, answers ${JSON.stringify(taken)})`;
    const taken = [];
    const visits = new Map();
    let k = 0;
    const systems = stubSystems(data, (m) => note('unknown-id', `${id} (${mode}): ${m}`));
    let runner;
    try {
      runner = createRunner(getScript(id), { world, data: runData, scriptId: id, systems, mapId, npc: null });
      let res = runner.step();
      let requests = 0;
      let cut = false;
      while (!res.done) {
        if (++requests > MAX_REQUESTS) { note('dead-end', `${where()}: more than ${MAX_REQUESTS} host requests without finishing`); cut = true; break; }
        const req = /** @type {any} */ (res);
        if (mode === 'natural') {
          const m = data.has('maps', curMap) ? data.get('maps', curMap) : null;
          const inMap = (x, y) => !m || (x >= 0 && y >= 0 && x < m.w && y < m.h);
          if (req.op === 'teleport' && !req.mapId && !inMap(req.x, req.y)) note('unknown-id', `${id} (natural): teleport ${req.who} to (${req.x},${req.y}) is outside '${curMap}'`);
          if (req.op === 'camera' && Array.isArray(req.to) && !inMap(req.to[0], req.to[1])) note('unknown-id', `${id} (natural): camera (${req.to}) is outside '${curMap}'`);
        }
        if (req.op === 'warp') curMap = req.mapId;
        if (req.op === 'teleport' && req.who === 'player' && req.mapId) curMap = req.mapId;
        const answers = decisionAnswers(req);
        let answer;
        if (answers) {
          const st = runner.save();
          const dId = `${st.top ?? id}@${JSON.stringify(st.pc)}`;
          const n = (visits.get(dId) ?? 0) + 1;
          visits.set(dId, n);
          if (n > LOOP_LIMIT) { loops++; cut = true; break; }
          if (k < prefix.length) answer = prefix[k];
          else {
            const keyOf = (a) => `${dId}#${JSON.stringify(a)}`;
            const fresh = answers.filter((a) => !covered.has(keyOf(a)));
            answer = fresh.length ? fresh[0] : answers[0];
            for (const a of fresh.slice(1)) { covered.add(keyOf(a)); queue.push([...taken, a]); }
            covered.add(keyOf(answer));
          }
          k++;
          taken.push(answer);
        } else answer = plainAnswer(req);
        res = runner.step(answer);
      }
      if (!cut) completed++;
    } catch (e) {
      note('throw', `${where()}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  if (completed === 0 && loops > 0 && !findings.some((f) => f.kind === 'throw')) note('dead-end', `${id} (${mode}): every path was cut as a loop; no way out`);
  return { paths, completed, loops, truncated, findings };
}

/**
 * Dry-runs the merged registry (or the listed scripts).
 * @param {{only?: string[]}} [opts]
 * @returns {{scripts: number, paths: number, findings: Array<{script: string, kind: string, msg: string}>, truncated: string[]}}
 */
export function dryRunAll(opts = {}) {
  const { data, scripts } = loadRegistry();
  const env = {
    trackIds: new Set(Object.keys(TRACKS)),
    letterNs: new Set(data.list('letters').map((l) => l.n).filter((n) => Number.isInteger(n))),
  };
  const maps = triggerMaps(data);
  const ids = (opts.only && opts.only.length ? opts.only : Object.keys(scripts)).slice().sort();
  const findings = [];
  const truncated = [];
  let paths = 0;
  for (const id of ids) {
    if (!data.has('scripts', id)) { findings.push({ script: id, kind: 'unknown-id', msg: `script '${id}' is not in the registry` }); continue; }
    for (const f of staticFindings(id, data.get('scripts', id), data, env)) findings.push({ script: id, ...f });
    const mapId = maps.get(id) ?? 'pellwick';
    for (const mode of /** @type {const} */ (['natural', 'forced'])) {
      const r = exploreScript(id, { data, mode, mapId });
      paths += r.paths;
      if (r.truncated) truncated.push(`${id} (${mode})`);
      for (const f of r.findings) findings.push({ script: id, ...f });
    }
  }
  return { scripts: ids.length, paths, findings, truncated };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const json = args.includes('--json');
  const only = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '--script' && args[i + 1]) only.push(args[++i]);
  const report = dryRunAll({ only });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    const byKind = {};
    for (const f of report.findings) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
    if (!quiet || report.findings.length) for (const f of report.findings) console.log(`${f.kind.padEnd(10)} ${f.msg}`);
    if (report.truncated.length) console.log(`truncated (path cap ${MAX_PATHS}): ${report.truncated.join(', ')}`);
    const kinds = ['throw', 'unknown-op', 'unknown-id', 'dead-end'].map((k) => `${byKind[k] ?? 0} ${k}`).join(', ');
    console.log(`script-dryrun: ${report.scripts} scripts, ${report.paths} paths (natural + forced): ${kinds}`);
  }
  process.exit(report.findings.length ? 1 : 0);
}

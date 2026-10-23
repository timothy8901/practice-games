/**
 * The script interpreter (ARCHITECTURE §6.2): a resumable coroutine over an op array. [SCRIPT]
 *
 * `createRunner(ops, ctx, state?)` runs pure ops itself (labels, jumps, calls, conditions, flags,
 * items, money, threads) and yields every host op as a `Request` the scene performs before calling
 * `step(answer)` again. The position is a path of integers (`pc`) into nested blocks, so the whole
 * runner state (`save()`) is JSON and a save mid-cutscene resumes at the same request.
 *
 * Pure ops call the real system functions so one code path applies every rule. The runner does not
 * import those systems (several belong to lanes that land later and `script/` must stay importable
 * alone); the host binds them through `ctx.systems` (see {@link ScriptSystems}). Flags and counters
 * default to `systems/flags`. A pure op whose system is unbound throws a readable Error.
 *
 * Pure: no DOM, no `Math.random`; randomness comes from `ctx.rng` when an op needs it.
 * @module script/runner
 */

import { OPS, normalizeOp, subBlocks, walkOps } from './ops.js';
import { evalCond } from './cond.js';
import * as flags from '../systems/flags.js';

/** @typedef {import('./ops.js').Op} Op */
/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../data/registry.js').Registry} Registry */

/**
 * System functions the pure ops call. Each is `fn(world, ...) -> any` on the live world. Hosts
 * bind the owning system's export (e.g. `give: bag.give`); tests bind fakes.
 * @typedef {Object} ScriptSystems
 * @property {(world: World, id: string, value?: any) => any} [setFlag]          default systems/flags.setFlag
 * @property {(world: World, id: string, by?: number) => any} [inc]              default systems/flags.inc
 * @property {(world: World, item: string, n: number, ctx: {data: Registry|null}) => any} [give]
 * @property {(world: World, item: string, n: number, ctx: {data: Registry|null}) => any} [take]
 * @property {(world: World, amount: number) => any} [earn]
 * @property {(world: World, amount: number) => any} [spend]
 * @property {(world: World, spec: {species: string, level: number, nick: string|null}, ctx: {data: Registry|null, rng: any}) => any} [addCreature]
 * @property {(world: World, npc: string, key: string, value: any) => any} [remember]
 * @property {(world: World, threadId: string, beat: number|null) => any} [setBeat]   `null` = advance one beat
 */

/**
 * @typedef {Object} ScriptCtx
 * @property {World} world
 * @property {Registry|null} [data]
 * @property {import('../core/rng.js').Rng|null} [rng]
 * @property {Record<string, any>} [vars]      script variables; serialized with the runner
 * @property {string|null} [npc]               the npc being talked to (speaker default, `{npcNick}`)
 * @property {string|null} [mapId]
 * @property {string|null} [scriptId]          id of `ops` (for `seen.<id>` and call frames)
 * @property {ScriptSystems} [systems]
 * @property {{emit: (evt: string, payload: any) => any}|null} [bus]   forwarded to the default flag bindings
 */

/** @typedef {{id: number, op: string, [k: string]: any}} Request */

/**
 * Serialized runner position. `pc` addresses the top frame; `callStack` holds the frames below it,
 * bottom first (`[0]` is always the root script). `seq` keeps request ids unique across a resume.
 * @typedef {{pc: number[], vars: Record<string, any>, callStack: Array<{scriptId: string|null, pc: number[]}>, top: string|null, seq: number}} RunnerState
 */

/**
 * @typedef {Object} Runner
 * @property {(answer?: any) => Request|{done: true}} step   applies `answer` to the pending request, runs pure ops until the next host op
 * @property {() => RunnerState} save                         JSON position; `createRunner(ops, ctx, state)` resumes it
 * @property {() => boolean} isDone
 * @property {() => Request|null} pending                     the request awaiting an answer, if any
 * @property {Record<string, any>} vars
 */

/**
 * Default flag/counter bindings (systems/flags), forwarding `bus` so `flag:set` / `counter:inc`
 * reach listeners exactly as when a scene calls the system directly.
 * @param {{emit: (evt: string, payload: any) => any}|null} bus
 * @returns {ScriptSystems}
 */
function defaultSystems(bus) {
  const sctx = bus ? { bus } : undefined;
  return {
    setFlag: (world, id, value) => flags.setFlag(world, id, value, sctx),
    inc: (world, id, by) => flags.inc(world, id, by, sctx),
  };
}

/**
 * Fills `{player}`, `{nick:uid}`, `{npcNick}`, `{npc}`, `{wallet}`, `{var:name}` in text. `|` page
 * breaks and `~` beats are left for the textbox. Unknown tokens stay as written.
 * @param {string} text
 * @param {ScriptCtx} ctx
 * @returns {string}
 */
export function interpolate(text, ctx) {
  if (typeof text !== 'string') return text;
  const world = ctx?.world ?? {};
  const data = ctx?.data ?? null;
  return text.replace(/\{(player|npcNick|npc|wallet|nick:[^}]+|var:[^}]+)\}/g, (m, token) => {
    if (token === 'player') return world.player?.name ?? m;
    if (token === 'wallet') return String(world.wallet?.main ?? 0);
    if (token === 'npc' || token === 'npcNick') {
      const id = ctx.npc;
      if (!id) return m;
      const nick = world.npcs?.[id]?.nickname;
      if (token === 'npcNick' && nick) return nick;
      return data && data.has('npcs', id) ? data.get('npcs', id).name : id;
    }
    if (token.startsWith('nick:')) {
      const uid = token.slice(5);
      const c = [...(world.party ?? []), ...(world.box ?? [])].find((x) => x.uid === uid);
      return c ? c.nickname : m;
    }
    if (token.startsWith('var:')) {
      const v = ctx.vars?.[token.slice(4)];
      return v === undefined ? m : String(v);
    }
    return m;
  });
}

/**
 * Creates (or resumes) a runner.
 * @param {Array<Op|string>} ops   the root script
 * @param {ScriptCtx} ctx
 * @param {RunnerState|null} [state]   output of a previous `save()`
 * @returns {Runner}
 * @throws {TypeError} for a non-array script or a missing world
 */
export function createRunner(ops, ctx, state = null) {
  if (!Array.isArray(ops)) throw new TypeError('createRunner: ops must be an array');
  if (!ctx || typeof ctx !== 'object' || !ctx.world || typeof ctx.world !== 'object') throw new TypeError('createRunner: ctx.world is required');
  const data = ctx.data ?? null;
  const systems = { ...defaultSystems(ctx.bus ?? null), ...(ctx.systems ?? {}) };
  const isNpcId = (id) => Boolean(data && data.has('npcs', id));
  const vars = state?.vars ? { ...state.vars } : { ...(ctx.vars ?? {}) };
  const ictx = { ...ctx, vars };
  let seq = state?.seq ?? 0;
  let done = false;
  /** @type {{req: Request, op: Op, frame: Frame}|null} */
  let pending = null;

  /** @typedef {{ops: Array<Op|string>, scriptId: string|null, pc: number[], labels: Map<string, number[]>}} Frame */
  /** @type {Frame[]} */
  const frames = [];

  /**
   * @param {Array<Op|string>} list
   * @param {string|null} scriptId
   * @param {number[]} [pc]
   * @returns {Frame}
   */
  function makeFrame(list, scriptId, pc = [0]) {
    const labels = new Map();
    walkOps(list, (op, path) => { if (op.op === 'label') labels.set(op.id, path); }, isNpcId);
    return { ops: list, scriptId, pc: pc.slice(), labels };
  }

  /**
   * @param {string} scriptId
   * @returns {Array<Op|string>}
   */
  function scriptOps(scriptId) {
    if (!data) throw new Error(`script: call '${scriptId}' needs ctx.data`);
    return data.get('scripts', scriptId);
  }

  if (state) {
    const stack = Array.isArray(state.callStack) ? state.callStack : [];
    stack.forEach((f, i) => frames.push(makeFrame(i === 0 ? ops : scriptOps(f.scriptId), f.scriptId, f.pc)));
    frames.push(stack.length === 0 ? makeFrame(ops, ctx.scriptId ?? null, state.pc) : makeFrame(scriptOps(state.top), state.top, state.pc));
  } else {
    frames.push(makeFrame(ops, ctx.scriptId ?? null));
  }

  /**
   * Resolves the op at `frame.pc`, or null when the frame has run off its end. Positions that fall
   * past the end of a nested block are first ascended (and the parent advanced).
   * @param {Frame} frame
   * @returns {Op|null}
   */
  function locate(frame) {
    for (;;) {
      const pc = frame.pc;
      let list = frame.ops;
      let op = null;
      let ok = true;
      for (let i = 0; i < pc.length; i += 2) {
        const idx = pc[i];
        if (idx >= list.length) { ok = false; break; }
        op = normalizeOp(list[idx], isNpcId);
        if (i + 1 < pc.length) {
          const blocks = subBlocks(op);
          const k = pc[i + 1];
          if (k >= blocks.length) throw new Error(`script: bad pc ${JSON.stringify(pc)} (op '${op.op}' has ${blocks.length} blocks)`);
          list = blocks[k];
        }
      }
      if (ok) return op;
      if (pc.length === 1) return null;                 // root frame finished
      pc.splice(pc.length - 2, 2);                       // leave the block...
      pc[pc.length - 1]++;                               // ...and move past the op that owned it
    }
  }

  /** @param {Frame} frame */
  function advance(frame) { frame.pc[frame.pc.length - 1]++; }

  /**
   * @param {Frame} frame
   * @param {number} block
   */
  function descend(frame, block) { frame.pc.push(block, 0); }

  /**
   * @param {Frame} frame
   * @param {string} label
   */
  function jump(frame, label) {
    const path = frame.labels.get(label);
    if (!path) throw new Error(`script${frame.scriptId ? ` '${frame.scriptId}'` : ''}: goto '${label}': no such label`);
    frame.pc = path.slice();
  }

  /** @param {string} name @param {string} opName */
  function sys(name, opName) {
    const fn = systems[name];
    if (typeof fn !== 'function') throw new Error(`script: op '${opName}' needs ctx.systems.${name} (bind the owning system in the host)`);
    return fn;
  }

  /**
   * Value a `branch` switches on: a script var, else a flag, else a counter, else a world field by
   * dotted path (`'dial'` -> `run.dial`, `'player.tool'`).
   * @param {string} on
   * @returns {any}
   */
  function branchValue(on) {
    const w = ictx.world;
    if (on in vars) return vars[on];
    if (w.flags && on in w.flags) return w.flags[on];
    if (w.counters && on in w.counters) return w.counters[on];
    if (on === 'dial') return w.run?.dial;
    return on.split('.').reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), w);
  }

  /**
   * Runs one pure op. Returns true when it moved the pc itself.
   * @param {Op} op
   * @param {Frame} frame
   * @returns {boolean}
   */
  function runPure(op, frame) {
    const w = ictx.world;
    switch (op.op) {
      case 'label': return false;
      case 'goto': jump(frame, op.id); return true;
      case 'call': {
        advance(frame);
        frames.push(makeFrame(scriptOps(op.script), op.script));
        return true;
      }
      case 'end': frames.pop(); return true;
      case 'if': {
        const hit = evalCond(w, op.cond, { data, npc: ictx.npc ?? null, mapId: ictx.mapId ?? null });
        if (hit) descend(frame, 0);
        else if (Array.isArray(op.else)) descend(frame, 1);
        else advance(frame);
        return true;
      }
      case 'branch': {
        const keys = Object.keys(op.cases ?? {});
        const key = String(branchValue(op.on));
        let k = keys.indexOf(key);
        if (k < 0) k = keys.indexOf('default');
        if (k < 0) advance(frame); else descend(frame, k);
        return true;
      }
      case 'setFlag': sys('setFlag', op.op)(w, op.id, op.value === undefined ? true : op.value); return false;
      case 'inc': sys('inc', op.op)(w, op.id, op.by ?? 1); return false;
      case 'give': sys('give', op.op)(w, op.item, op.n ?? 1, { data }); return false;
      case 'take': sys('take', op.op)(w, op.item, op.n ?? 1, { data }); return false;
      case 'earn': sys('earn', op.op)(w, op.amount); return false;
      case 'spend': sys('spend', op.op)(w, op.amount); return false;
      case 'addCreature': sys('addCreature', op.op)(w, { species: op.species, level: op.level, nick: op.nick ?? null }, { data, rng: ictx.rng ?? null }); return false;
      case 'remember': sys('remember', op.op)(w, op.npc ?? ictx.npc, op.key, op.value); return false;
      case 'thread': sys('setBeat', op.op)(w, op.id, op.beat ?? null); return false;
      case 'beat': sys('setBeat', op.op)(w, op.thread, op.to); return false;
      default: throw new Error(`script: unknown pure op '${op.op}'`);
    }
  }

  /**
   * Builds the Request for a host op: text fields interpolated, speaker name resolved, choice
   * options filtered by their conds (`index` keeps the author's option number).
   * @param {Op} op
   * @returns {Request}
   */
  function makeRequest(op) {
    const schema = OPS[op.op];
    /** @type {Request} */
    const req = { id: ++seq, ...op };
    for (const f of schema.text ?? []) if (typeof req[f] === 'string') req[f] = interpolate(req[f], ictx);
    if (op.op === 'say') {
      const who = op.who ?? ictx.npc ?? null;
      req.who = who;
      req.name = who && data && data.has('npcs', who) ? (ictx.world.npcs?.[who]?.nickname || data.get('npcs', who).name) : who;
    }
    if (op.op === 'choice') {
      const opts = [];
      op.options.forEach((o, index) => {
        if (o.cond === undefined || evalCond(ictx.world, o.cond, { data, npc: ictx.npc ?? null, mapId: ictx.mapId ?? null })) {
          opts.push({ text: interpolate(o.text, ictx), index });
        }
      });
      if (opts.length === 0) throw new Error('script: choice has no eligible option (every option cond failed)');
      req.options = opts;
      if (typeof op.defaultIndex === 'number') {
        const k = opts.findIndex((o) => o.index === op.defaultIndex);
        req.defaultIndex = k < 0 ? 0 : k;
      }
    }
    return req;
  }

  /**
   * Applies the host's answer to the request it was waiting on and moves the pc.
   * @param {{req: Request, op: Op, frame: Frame}} p
   * @param {any} answer
   */
  function applyAnswer(p, answer) {
    const { op, frame, req } = p;
    const w = ictx.world;
    switch (op.op) {
      case 'choice': {
        const shown = req.options[typeof answer === 'number' ? answer : req.defaultIndex ?? 0];
        if (!shown) throw new Error(`script: choice answer ${JSON.stringify(answer)} is not one of ${req.options.length} options`);
        const opt = op.options[shown.index];
        vars._choice = shown.index;
        if (typeof opt.goto === 'string') { jump(frame, opt.goto); return; }
        if (Array.isArray(opt.then)) { descend(frame, shown.index); return; }
        advance(frame);
        return;
      }
      case 'take': {
        vars._took = answer === true;
        if (answer === true) sys('take', op.op)(w, op.item, op.n ?? 1, { data });
        advance(frame);
        return;
      }
      case 'nickname': vars._nickname = typeof answer === 'string' ? answer : null; advance(frame); return;
      case 'forecast': vars._forecast = answer ?? null; advance(frame); return;
      case 'startBattle': {
        vars._battle = answer ?? null;
        if (answer && answer.blackout && typeof op.onLose === 'string') {
          if (frame.labels.has(op.onLose)) { jump(frame, op.onLose); return; }
          advance(frame);
          frames.push(makeFrame(scriptOps(op.onLose), op.onLose));
          return;
        }
        advance(frame);
        return;
      }
      default: advance(frame);
    }
  }

  function finish() {
    done = true;
    const id = ctx.scriptId;
    if (id && typeof systems.setFlag === 'function') systems.setFlag(ictx.world, `seen.${id}`, true);
    return { done: true };
  }

  /** @type {Runner} */
  const runner = {
    vars,
    isDone: () => done,
    pending: () => (pending ? pending.req : null),
    step(answer) {
      if (done) return { done: true };
      if (pending) {
        const p = pending;
        pending = null;
        applyAnswer(p, answer);
      }
      for (let guard = 0; guard < 10_000; guard++) {
        const frame = frames[frames.length - 1];
        if (!frame) return finish();
        const op = locate(frame);
        if (op === null) { frames.pop(); continue; }
        const schema = OPS[op.op];
        if (!schema) throw new Error(`script${frame.scriptId ? ` '${frame.scriptId}'` : ''}: unknown op '${op.op}' at ${JSON.stringify(frame.pc)}`);
        if (schema.kind === 'pure') {
          if (op.op === 'take' && op.ask === true) {
            const req = makeRequest(op);
            pending = { req, op, frame };
            return req;
          }
          if (!runPure(op, frame)) advance(frame);
          continue;
        }
        const req = makeRequest(op);
        pending = { req, op, frame };
        return req;
      }
      throw new Error('script: more than 10000 pure ops without a host op (infinite goto loop?)');
    },
    save() {
      const top = frames[frames.length - 1];
      const below = frames.slice(0, -1);
      const pc = top ? top.pc.slice() : [ops.length];
      // A pending `save` op completes by being saved: resume after it, not on it again.
      if (pending && pending.op.op === 'save' && top) pc[pc.length - 1]++;
      return {
        pc,
        vars: { ...vars },
        callStack: below.map((f) => ({ scriptId: f.scriptId, pc: f.pc.slice() })),
        top: top && below.length > 0 ? top.scriptId : null,
        seq,
      };
    },
  };
  return runner;
}

/**
 * Runs a script to completion in Node with a fake host that answers every request from `answers`
 * (by op name, a function or a value) and records them. Test and tool helper.
 * @param {Array<Op|string>} ops
 * @param {ScriptCtx} ctx
 * @param {Record<string, any>} [answers]   op -> answer | (req) => answer
 * @param {number} [max=1000]
 * @returns {{requests: Request[], runner: Runner}}
 */
export function runWithFakeHost(ops, ctx, answers = {}, max = 1000) {
  const runner = createRunner(ops, ctx);
  const requests = [];
  let res = runner.step();
  while (!('done' in res) && requests.length < max) {
    requests.push(res);
    const a = answers[res.op];
    res = runner.step(typeof a === 'function' ? a(res) : a);
  }
  return { requests, runner };
}

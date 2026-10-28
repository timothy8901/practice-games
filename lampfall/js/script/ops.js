/**
 * The script op vocabulary (ARCHITECTURE §6.1). [SCRIPT]
 *
 * `OPS` maps every op name to its field schema and whether the runner performs it itself (`pure`)
 * or yields it to the host scene (`host`). Field specs are `{t, req, ref?}`: `t` is the value type,
 * `req` whether the field is required, `ref` the data table the string must resolve in (used by the
 * validator, never at run time). `parseShorthand` turns `"Wren: Morning."` into a `say` op;
 * `validateOps` is the static checker `tools/validate-data.mjs` runs over every script.
 *
 * Pure: no DOM, no randomness, no world access.
 * @module script/ops
 */

import { kebab } from '../data/ids.js';

/** @typedef {{op: string, [k: string]: any}} Op */
/**
 * @typedef {Object} FieldSpec
 * @property {'string'|'number'|'boolean'|'any'|'cond'|'ops'|'cases'|'options'|'string[]'|'point'|'target'} t
 * @property {boolean} req
 * @property {string} [ref]     data table the string (or each string) must resolve in
 * @property {string[]} [enum]  allowed values
 */
/** @typedef {{kind: 'pure'|'host', fields: Record<string, FieldSpec>, text?: string[]}} OpSchema */

/** @type {(t: FieldSpec['t'], extra?: Partial<FieldSpec>) => FieldSpec} */
const req = (t, extra = {}) => ({ t, req: true, ...extra });
/** @type {(t: FieldSpec['t'], extra?: Partial<FieldSpec>) => FieldSpec} */
const opt = (t, extra = {}) => ({ t, req: false, ...extra });

/** Facing words accepted by `face.dir`. */
export const DIRS = Object.freeze(['up', 'down', 'left', 'right', 'player']);
/** Emote glyphs accepted by `emote.kind`. */
export const EMOTES = Object.freeze(['!', '?', '♥', '…', 'zzz']);

/**
 * The op table. `text` lists the fields `interpolate` runs over before a host op is yielded.
 * @type {Readonly<Record<string, OpSchema>>}
 */
export const OPS = Object.freeze({
  // ---- pure: performed inside the runner; never yielded -----------------------------------------
  label: { kind: 'pure', fields: { id: req('string') } },
  goto: { kind: 'pure', fields: { id: req('string') } },
  call: { kind: 'pure', fields: { script: req('string', { ref: 'scripts' }) } },
  end: { kind: 'pure', fields: {} },
  if: { kind: 'pure', fields: { cond: req('cond'), then: req('ops'), else: opt('ops') } },
  branch: { kind: 'pure', fields: { on: req('string'), cases: req('cases') } },
  setFlag: { kind: 'pure', fields: { id: req('string'), value: opt('any') } },
  inc: { kind: 'pure', fields: { id: req('string'), by: opt('number') } },
  give: { kind: 'pure', fields: { item: req('string', { ref: 'items' }), n: opt('number') } },
  take: { kind: 'pure', fields: { item: req('string', { ref: 'items' }), n: opt('number'), ask: opt('boolean') } }, // ask: yields a confirm
  earn: { kind: 'pure', fields: { amount: req('number') } },
  spend: { kind: 'pure', fields: { amount: req('number') } },
  addCreature: { kind: 'pure', fields: { species: req('string', { ref: 'species' }), level: req('number'), nick: opt('string') } },
  remember: { kind: 'pure', fields: { npc: req('string', { ref: 'npcs' }), key: req('string'), value: req('any') } },
  thread: { kind: 'pure', fields: { id: req('string', { ref: 'threads' }), beat: opt('number') } },
  beat: { kind: 'pure', fields: { thread: req('string', { ref: 'threads' }), to: req('number') } },
  restartSummit: { kind: 'pure', fields: {} },   // the Summit Bell's decline: the beaten Keepers stand again
  // ---- host: yielded as a Request; the scene performs them ---------------------------------------
  say: { kind: 'host', fields: { who: opt('string'), text: req('string'), emote: opt('string'), portrait: opt('string') }, text: ['text'] },
  choice: { kind: 'host', fields: { prompt: opt('string'), options: req('options'), defaultIndex: opt('number') }, text: ['prompt'] },
  nickname: { kind: 'host', fields: { who: req('string'), offer: opt('string') }, text: ['offer'] },
  move: { kind: 'host', fields: { who: req('string'), path: req('string'), run: opt('boolean'), wait: opt('boolean') } },
  face: { kind: 'host', fields: { who: req('string'), dir: req('string', { enum: [...DIRS] }) } },
  emote: { kind: 'host', fields: { who: req('string'), kind: req('string', { enum: [...EMOTES] }) } },
  teleport: { kind: 'host', fields: { who: req('string'), mapId: opt('string', { ref: 'maps' }), x: req('number'), y: req('number') } },
  spawn: { kind: 'host', fields: { who: req('string'), artId: req('string'), x: req('number'), y: req('number') } },
  despawn: { kind: 'host', fields: { who: req('string') } },
  wait: { kind: 'host', fields: { ms: req('number') } },
  camera: { kind: 'host', fields: { to: req('target'), ms: opt('number'), shake: opt('number') } },
  playSfx: { kind: 'host', fields: { name: req('string') } },
  music: { kind: 'host', fields: { track: req('any'), fade: opt('number') } },            // track: string|null
  stem: { kind: 'host', fields: { name: req('string'), on: req('boolean') } },
  openShop: { kind: 'host', fields: { shop: req('string', { ref: 'shops' }), mode: opt('string', { enum: ['buy', 'sell'] }) } }, // mode: the tab it opens on
  startBattle: { kind: 'host', fields: { trainer: opt('string', { ref: 'trainers' }), wild: opt('any'), source: opt('string'), holdOut: opt('number'), onLose: opt('string') } },
  forecast: { kind: 'host', fields: { who: req('string'), scripted: opt('any') } },
  letter: { kind: 'host', fields: { n: opt('number') } },
  toast: { kind: 'host', fields: { text: req('string') }, text: ['text'] },
  warp: { kind: 'host', fields: { mapId: req('string', { ref: 'maps' }), x: req('number'), y: req('number'), facing: opt('string') } },
  setTime: { kind: 'host', fields: { minute: req('number') } },
  tide: { kind: 'host', fields: { set: req('number') } },
  sleep: { kind: 'host', fields: {} },
  save: { kind: 'host', fields: { reason: opt('string') } },
});

/** Every op name. */
export const OP_NAMES = Object.freeze(Object.keys(OPS));
/** Op names the runner performs itself. */
export const PURE_OPS = Object.freeze(OP_NAMES.filter((n) => OPS[n].kind === 'pure'));
/** Op names yielded to the host. */
export const HOST_OPS = Object.freeze(OP_NAMES.filter((n) => OPS[n].kind === 'host'));

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isPureOp(name) {
  return OPS[name]?.kind === 'pure';
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isHostOp(name) {
  return OPS[name]?.kind === 'host';
}

/**
 * Parses the string shorthand: `"Wren: Morning, Keeper."` -> `{op:'say', who:'wren', text:'Morning, Keeper.'}`.
 * The speaker is resolved by id when `isNpcId(kebab(name))` says so, otherwise kept as the display
 * name written. A line written `* ...` is narration and says so with `who: null` (MID-16): the runner
 * never gives it the speaker of an NPC talk, so a thread beat's stage directions show no name tab or
 * bust. A plain string without a `Name: ` prefix has no `who` (in an NPC talk it is that NPC's line).
 * A leading `*` or the absence of a space after the colon keeps the colon in the text (`"Note: 3
 * boats"` is narration only if `isNpcId` rejects `note`... so authors write `"* Note: 3 boats"`).
 * @param {string} line
 * @param {(id: string) => boolean} [isNpcId]   defaults to accepting any speaker as a display name
 * @returns {Op}
 * @throws {TypeError} when `line` is not a string
 */
export function parseShorthand(line, isNpcId) {
  if (typeof line !== 'string') throw new TypeError(`parseShorthand: expected a string, got ${typeof line}`);
  if (line.startsWith('* ')) return { op: 'say', who: null, text: line.slice(2) };
  const m = /^([^:|~{}]{1,40}?):\s(.*)$/s.exec(line);
  if (!m) return { op: 'say', text: line };
  const name = m[1].trim();
  const id = kebab(name);
  const who = typeof isNpcId === 'function' && id && isNpcId(id) ? id : name;
  return { op: 'say', who, text: m[2] };
}

/**
 * Normalizes one op: strings go through {@link parseShorthand}; objects are returned as-is.
 * @param {Op|string} op
 * @param {(id: string) => boolean} [isNpcId]
 * @returns {Op}
 * @throws {TypeError} for anything else
 */
export function normalizeOp(op, isNpcId) {
  if (typeof op === 'string') return parseShorthand(op, isNpcId);
  if (op && typeof op === 'object' && typeof op.op === 'string') return op;
  throw new TypeError(`script: op must be a string or {op}, got ${JSON.stringify(op)}`);
}

/**
 * Nested op lists an op owns, in sub-block order: `if` -> [then, else]; `branch` -> one per case
 * (key order); `choice` -> one per option (`then` or `[]`). Everything else -> []. The runner
 * encodes a position inside sub-block `k` of op `i` as `[..., i, k, ...]`.
 * @param {Op} op
 * @returns {Array<Array<Op|string>>}
 */
export function subBlocks(op) {
  switch (op.op) {
    case 'if': return [Array.isArray(op.then) ? op.then : [], Array.isArray(op.else) ? op.else : []];
    case 'branch': return Object.values(op.cases ?? {}).map((b) => (Array.isArray(b) ? b : []));
    case 'choice': return (Array.isArray(op.options) ? op.options : []).map((o) => (o && Array.isArray(o.then) ? o.then : []));
    default: return [];
  }
}

/**
 * Depth-first walk over a script and every nested block. `fn(op, path)` receives the normalized op
 * and its position path (`[i]`, `[i, k, j]`, ...).
 * @param {Array<Op|string>} ops
 * @param {(op: Op, path: number[]) => void} fn
 * @param {(id: string) => boolean} [isNpcId]
 * @param {number[]} [prefix]
 */
export function walkOps(ops, fn, isNpcId, prefix = []) {
  if (!Array.isArray(ops)) return;
  ops.forEach((raw, i) => {
    let op;
    try { op = normalizeOp(raw, isNpcId); } catch { return; }
    const path = [...prefix, i];
    fn(op, path);
    subBlocks(op).forEach((block, k) => walkOps(block, fn, isNpcId, [...path, k]));
  });
}

/**
 * Label ids defined anywhere in a script.
 * @param {Array<Op|string>} ops
 * @returns {Set<string>}
 */
export function labelsOf(ops) {
  const out = new Set();
  walkOps(ops, (op) => { if (op.op === 'label' && typeof op.id === 'string') out.add(op.id); });
  return out;
}

/**
 * Checks one field value against its spec. Returns a problem string or null.
 * @param {string} name
 * @param {FieldSpec} spec
 * @param {any} v
 * @returns {string|null}
 */
function checkField(name, spec, v) {
  if (v === undefined || (v === null && spec.t !== 'any')) return spec.req ? `missing required field '${name}'` : null;
  switch (spec.t) {
    case 'string': if (typeof v !== 'string') return `field '${name}' must be a string`; break;
    case 'number': if (typeof v !== 'number' || !Number.isFinite(v)) return `field '${name}' must be a finite number`; break;
    case 'boolean': if (typeof v !== 'boolean') return `field '${name}' must be a boolean`; break;
    case 'string[]': if (!Array.isArray(v) || v.some((s) => typeof s !== 'string')) return `field '${name}' must be a string[]`; break;
    case 'ops': if (!Array.isArray(v)) return `field '${name}' must be an op array`; break;
    case 'cases': if (!v || typeof v !== 'object' || Array.isArray(v) || Object.values(v).some((b) => !Array.isArray(b))) return `field '${name}' must map case -> op array`; break;
    case 'options':
      if (!Array.isArray(v) || v.length === 0) return `field '${name}' needs at least one option`;
      for (let i = 0; i < v.length; i++) {
        const o = v[i];
        if (!o || typeof o !== 'object' || typeof o.text !== 'string') return `option ${i} needs a text`;
        if (o.goto !== undefined && typeof o.goto !== 'string') return `option ${i}: goto must be a label id`;
        if (o.then !== undefined && !Array.isArray(o.then)) return `option ${i}: then must be an op array`;
      }
      break;
    case 'target': if (!(typeof v === 'string' || (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number')))) return `field '${name}' must be a region id, 'player' or [x, y]`; break;
    case 'cond': if (!(typeof v === 'boolean' || (v && typeof v === 'object'))) return `field '${name}' must be a Cond`; break;
    default: break;
  }
  if (spec.enum && !spec.enum.includes(v)) return `field '${name}' must be one of ${spec.enum.join(' ')}`;
  return null;
}

/**
 * Static checks for one script (§8.2 "Scripts"): op names in `OPS`, required fields and types per
 * op, `goto` / `choice.goto` labels exist in this script, `call` targets exist, data references
 * resolve, `choice` has ≥ 1 option, an `end` is reachable (warning). Conditions are checked with
 * `opts.validateCond` when given (keeps this module free of cond.js so either can be loaded alone).
 * @param {Array<Op|string>} ops
 * @param {{scriptId?: string, has?: (table: string, id: string) => boolean, isNpcId?: (id: string) => boolean,
 *   validateCond?: (cond: any) => string[]}} [opts]
 * @returns {{errors: string[], warnings: string[]}} messages prefixed `scripts:<scriptId>:`
 */
export function validateOps(ops, opts = {}) {
  const errors = [];
  const warnings = [];
  const id = opts.scriptId ?? '?';
  const at = (path) => `scripts:${id}[${path.join('.')}]`;
  if (!Array.isArray(ops)) return { errors: [`scripts:${id}: must be an array of ops`], warnings };
  const labels = labelsOf(ops);
  let sawEnd = false;
  const isNpcId = opts.isNpcId;
  ops.forEach((raw, i) => {
    if (!(typeof raw === 'string' || (raw && typeof raw === 'object' && typeof raw.op === 'string'))) {
      errors.push(`${at([i])}: op must be a string or {op}, got ${JSON.stringify(raw)}`);
    }
  });
  walkOps(ops, (op, path) => {
    const schema = OPS[op.op];
    if (!schema) { errors.push(`${at(path)}: unknown op '${op.op}'`); return; }
    for (const [name, spec] of Object.entries(schema.fields)) {
      const problem = checkField(name, spec, op[name]);
      if (problem) { errors.push(`${at(path)}: ${op.op}: ${problem}`); continue; }
      const v = op[name];
      if (spec.ref && typeof v === 'string' && opts.has && !opts.has(spec.ref, v)) errors.push(`${at(path)}: ${op.op}.${name} '${v}' is not in ${spec.ref}`);
      if (spec.t === 'cond' && opts.validateCond) for (const p of opts.validateCond(v)) errors.push(`${at(path)}: ${op.op}.cond: ${p}`);
    }
    for (const name of Object.keys(op)) if (name !== 'op' && !(name in schema.fields)) warnings.push(`${at(path)}: ${op.op}: unknown field '${name}'`);
    if (op.op === 'goto' && typeof op.id === 'string' && !labels.has(op.id)) errors.push(`${at(path)}: goto '${op.id}': no such label in this script`);
    if (op.op === 'end') sawEnd = true;
    if (op.op === 'choice' && Array.isArray(op.options)) {
      op.options.forEach((o, k) => {
        if (o && typeof o.goto === 'string' && !labels.has(o.goto)) errors.push(`${at(path)}: choice option ${k} goto '${o.goto}': no such label`);
        if (o && o.cond !== undefined && opts.validateCond) for (const p of opts.validateCond(o.cond)) errors.push(`${at(path)}: choice option ${k} cond: ${p}`);
      });
      if (typeof op.defaultIndex === 'number' && (op.defaultIndex < 0 || op.defaultIndex >= op.options.length)) errors.push(`${at(path)}: choice defaultIndex ${op.defaultIndex} out of range`);
    }
    if (op.op === 'startBattle' && !op.trainer && !op.wild) errors.push(`${at(path)}: startBattle needs trainer or wild`);
    if (op.op === 'startBattle' && op.wild && opts.has && !(op.wild.speciesId && opts.has('species', op.wild.speciesId))) errors.push(`${at(path)}: startBattle.wild.speciesId '${op.wild?.speciesId}' is not in species`);
  }, isNpcId);
  if (!sawEnd) warnings.push(`scripts:${id}: no 'end' op (the script ends when it runs off the last op)`);
  return { errors, warnings };
}

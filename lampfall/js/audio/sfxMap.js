/**
 * Sound-effect map: domain-bus event / interaction verb / battle event -> {sfx, pitch rule, rate limit}.
 * [AUDIO] — ARCHITECTURE-DRAFT §1, §3.4, §12 ("sfx rate-limited").
 *
 * Systems emit domain events and never call audio; this module is the one place that turns those
 * events into `audio.sfx(name, {pitch, volume})` calls. It has three layers:
 *
 *  1. **Tables (data).** {@link BUS_SFX} (bus event name -> rule), {@link VERB_SFX} (`world/interact`
 *     verb -> rule) and {@link BATTLE_SFX} (`battle/events` type -> rule). A table entry is one
 *     {@link SfxRule} or an ordered list of them; the first rule whose `when` matches the payload wins.
 *     Numbers inside rules may be written as `'$KEY'`, a reference into the tuning table, so every
 *     designer number lives in {@link DEFAULTS} and can be overridden with `{tuning}`.
 *  2. **Pure resolution.** {@link resolveSfx} picks the rule, the sound and the pitch (deterministic
 *     given the injected rng and the explicit combo state); {@link createSfxLimiter} decides whether a
 *     play is allowed by a per-key minimum interval plus a global burst cap.
 *  3. **The router (impure only through the injected `audio`).** {@link createSfxRouter} subscribes to
 *     the bus, resolves, rate-limits and calls `audio.sfx`. `audio/director.js` creates one, so the
 *     game gets sfx without any scene wiring; scenes may also call `router.verb(...)` and
 *     `router.battle(ev)` directly (the battle scene plays battle events in animation order).
 *
 * Content-agnostic: no species, map or NPC names; the only names here are engine sound ids
 * (`core/audio.SFX_NAMES`) and the event / verb vocabulary of the architecture.
 *
 * Importable under Node (no DOM, no WebAudio at import time).
 * @module audio/sfxMap
 */
import { makeRng } from '../core/rng.js';

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * Every designer-tunable number of the sfx layer. Override any subset with `{tuning}`.
 * @type {Readonly<{
 *   SFX_DEFAULT_MIN_INTERVAL_MS: number, SFX_BURST_WINDOW_MS: number, SFX_BURST_MAX: number,
 *   STEP_MIN_INTERVAL_MS: number, STEP_PITCH_JITTER: number, STEP_VOLUME: number,
 *   TEXT_TICK_MIN_INTERVAL_MS: number, UI_MIN_INTERVAL_MS: number, TOAST_MIN_INTERVAL_MS: number,
 *   COIN_COMBO_SEMITONES: number, COIN_COMBO_MAX_STEPS: number, COIN_COMBO_RESET_MS: number,
 *   STAT_STAGE_SEMITONES: number, STAT_MAX_SEMITONES: number,
 *   HIT_STRONG_MULT: number, HIT_WEAK_MULT: number, HIT_MIN_INTERVAL_MS: number,
 *   CAPTURE_SHAKE_SEMITONES: number, CAPTURE_SHAKE_MAX_SEMITONES: number,
 *   LEVEL_UP_VOLUME: number, SAVE_OK_VOLUME: number, AMBIENT_VOLUME: number, AMBIENT_MIN_INTERVAL_MS: number
 * }>}
 */
export const DEFAULTS = Object.freeze({
  /** minimum ms between two plays of the same key when a rule names no interval */
  SFX_DEFAULT_MIN_INTERVAL_MS: 40,
  /** global burst cap: at most SFX_BURST_MAX plays inside any SFX_BURST_WINDOW_MS */
  SFX_BURST_WINDOW_MS: 200,
  SFX_BURST_MAX: 8,
  /** footsteps: min interval, random pitch spread (± fraction) and volume */
  STEP_MIN_INTERVAL_MS: 110,
  STEP_PITCH_JITTER: 0.06,
  STEP_VOLUME: 0.55,
  /** typewriter tick spacing */
  TEXT_TICK_MIN_INTERVAL_MS: 45,
  /** menu cursor / confirm / cancel spacing */
  UI_MIN_INTERVAL_MS: 35,
  /** toast chime spacing */
  TOAST_MIN_INTERVAL_MS: 250,
  /** coins picked up in a row climb by this many semitones per pickup, up to the max, reset after a pause */
  COIN_COMBO_SEMITONES: 1,
  COIN_COMBO_MAX_STEPS: 7,
  COIN_COMBO_RESET_MS: 900,
  /** stat change blip: semitones per stage (+ up / - down), clamped */
  STAT_STAGE_SEMITONES: 2,
  STAT_MAX_SEMITONES: 6,
  /** effectiveness accents: mult >= strong plays hitStrong, 0 < mult <= weak plays hitWeak */
  HIT_STRONG_MULT: 2,
  HIT_WEAK_MULT: 0.5,
  /** hit sounds share one key; this keeps a damage + effectiveness pair from doubling up */
  HIT_MIN_INTERVAL_MS: 60,
  /** Lantern shake ticks rise this many semitones per shake (payload.n / payload.shake), clamped */
  CAPTURE_SHAKE_SEMITONES: 2,
  CAPTURE_SHAKE_MAX_SEMITONES: 6,
  /** volume of the level-up fanfare, the save chime and ambient one-offs (wave, thunder, dawn) */
  LEVEL_UP_VOLUME: 0.9,
  SAVE_OK_VOLUME: 0.5,
  AMBIENT_VOLUME: 0.6,
  AMBIENT_MIN_INTERVAL_MS: 2000,
});

/** Every tuning key this module reads, for the GDD table. @type {readonly string[]} */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

// ---------------------------------------------------------------------------------------------
// Rule shapes
// ---------------------------------------------------------------------------------------------

/**
 * A number, or `'$KEY'` naming a tuning key.
 * @typedef {number|string} TunedNumber
 */
/**
 * A payload test. `field` is a dotted path into the payload; exactly one comparison is used, in this
 * order: `eq`, `ne`, `in`, `gt`, `gte`, `lt`, `lte`, `truthy`. `in` takes an array; others take a value
 * (numbers may be `'$KEY'`).
 * @typedef {{field: string, eq?: any, ne?: any, in?: any[], gt?: TunedNumber, gte?: TunedNumber, lt?: TunedNumber, lte?: TunedNumber, truthy?: boolean}} Match
 */
/**
 * How a rule bends the pitch.
 *  - `fixed`  : `semitones` (default 0)
 *  - `jitter` : a random multiplier in `1 ± amount` (from the injected rng)
 *  - `combo`  : `semitones` per consecutive play of the same key within `resetMs`, up to `max` steps
 *  - `field`  : `semitones` × the numeric payload `field`, clamped to ±`max`
 *  - `payload`: `pitch` (multiplier) / `semitones` taken straight from the payload (generic `sfx` event)
 * @typedef {{kind: 'fixed', semitones?: TunedNumber}
 *   | {kind: 'jitter', amount: TunedNumber}
 *   | {kind: 'combo', semitones: TunedNumber, max: TunedNumber, resetMs: TunedNumber}
 *   | {kind: 'field', field: string, semitones: TunedNumber, max?: TunedNumber}
 *   | {kind: 'payload'}} PitchRule
 */
/**
 * One way an event can sound.
 * @typedef {Object} SfxRule
 * @property {string|null} sfx              engine sound id; null = this case is silent
 * @property {string} [sfxField]            take the sound id from this payload field when it is a non-empty string
 * @property {Match|Match[]} [when]         all must match (omitted = always)
 * @property {PitchRule} [pitch]
 * @property {TunedNumber} [volume]         0..2 (default 1)
 * @property {TunedNumber} [minIntervalMs]  per-key spacing (default SFX_DEFAULT_MIN_INTERVAL_MS)
 * @property {string} [key]                 rate-limit / combo key (default: the sound id)
 */
/** @typedef {SfxRule | SfxRule[]} SfxEntry */

/**
 * The outcome of resolving an event.
 * @typedef {Object} SfxPlay
 * @property {string} sfx
 * @property {number} pitch          frequency multiplier (1 = as designed)
 * @property {number} semitones      the pitch as semitones (for logs and tests)
 * @property {number} volume
 * @property {string} key            rate-limit key
 * @property {number} minIntervalMs
 */

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

const ui = (sfx) => Object.freeze({ sfx, minIntervalMs: '$UI_MIN_INTERVAL_MS', key: `ui:${sfx}` });

/**
 * Domain-bus events (§3.4, plus the UI/feedback events scenes emit) -> sound. Events missing here
 * are silent on purpose: music stings own `letter:delivered`, `shift:resolved` and the victory.
 * @type {Readonly<Record<string, SfxEntry>>}
 */
export const BUS_SFX = Object.freeze({
  'player:step': Object.freeze([
    Object.freeze({ when: { field: 'terrain', in: ['water', 'shallows', 'mud', 'wet'] }, sfx: 'stepWater', key: 'step', pitch: { kind: 'jitter', amount: '$STEP_PITCH_JITTER' }, volume: '$STEP_VOLUME', minIntervalMs: '$STEP_MIN_INTERVAL_MS' }),
    Object.freeze({ sfx: 'step', key: 'step', pitch: { kind: 'jitter', amount: '$STEP_PITCH_JITTER' }, volume: '$STEP_VOLUME', minIntervalMs: '$STEP_MIN_INTERVAL_MS' }),
  ]),
  'player:bump': Object.freeze({ sfx: 'blocked', minIntervalMs: 250 }),
  'wallet:changed': Object.freeze([
    Object.freeze({ when: { field: 'delta', gt: 0 }, sfx: 'coin', pitch: { kind: 'combo', semitones: '$COIN_COMBO_SEMITONES', max: '$COIN_COMBO_MAX_STEPS', resetMs: '$COIN_COMBO_RESET_MS' } }),
    Object.freeze({ when: { field: 'delta', lt: 0 }, sfx: 'purse' }),
  ]),
  'loan:paid': Object.freeze({ sfx: 'stamp' }),
  'loan:tier': Object.freeze({ sfx: 'achievement' }),
  'loan:built': Object.freeze({ sfx: 'bell' }),
  'letter:read': Object.freeze({ sfx: 'blip' }),
  'thread:beat': Object.freeze({ sfx: 'bell' }),
  'npc:talked': Object.freeze({ sfx: 'blip', minIntervalMs: 150 }),
  'fieldLog:held': Object.freeze({ sfx: 'stamp' }),
  'fieldLog:read': Object.freeze({ sfx: 'blip' }),
  'collection:added': Object.freeze([
    Object.freeze({ when: { field: 'kind', eq: 'fish' }, sfx: 'catchFish' }),
    Object.freeze({ sfx: 'achievement' }),
  ]),
  'creature:levelUp': Object.freeze({ sfx: 'levelUp', volume: '$LEVEL_UP_VOLUME' }),
  'creature:learned': Object.freeze({ sfx: 'confirm' }),
  'capture:ok': Object.freeze({ sfx: 'capture' }),
  'capture:fail': Object.freeze({ sfx: 'captureFail' }),
  'shift:window': Object.freeze({ sfx: 'shiftFlip' }),
  'badge:won': Object.freeze({ sfx: 'achievement' }),
  'summit:cleared': Object.freeze({ sfx: 'achievement' }),
  'save:ok': Object.freeze({ sfx: 'stamp', volume: '$SAVE_OK_VOLUME', minIntervalMs: 1000 }),
  'save:fail': Object.freeze([
    Object.freeze({ when: { field: 'willRetry', truthy: true }, sfx: null }),
    Object.freeze({ sfx: 'error', minIntervalMs: 1000 }),
  ]),
  toast: Object.freeze({ sfx: 'toast', minIntervalMs: '$TOAST_MIN_INTERVAL_MS' }),
  'tide:change': Object.freeze([
    Object.freeze({ when: { field: 'state', eq: 'high' }, sfx: 'wave', volume: '$AMBIENT_VOLUME', minIntervalMs: '$AMBIENT_MIN_INTERVAL_MS' }),
    Object.freeze({ sfx: null }),
  ]),
  'weather:change': Object.freeze([
    Object.freeze({ when: { field: 'current', eq: 'storm' }, sfx: 'thunder', volume: '$AMBIENT_VOLUME', minIntervalMs: '$AMBIENT_MIN_INTERVAL_MS' }),
    Object.freeze({ when: { field: 'kind', eq: 'storm' }, sfx: 'thunder', volume: '$AMBIENT_VOLUME', minIntervalMs: '$AMBIENT_MIN_INTERVAL_MS' }),
    Object.freeze({ sfx: null }),
  ]),
  'clock:phase': Object.freeze([
    Object.freeze({ when: { field: 'phase', eq: 'dawn' }, sfx: 'dawn', volume: '$AMBIENT_VOLUME', minIntervalMs: '$AMBIENT_MIN_INTERVAL_MS' }),
    Object.freeze({ when: { field: 'phase', eq: 'night' }, sfx: 'night', volume: '$AMBIENT_VOLUME', minIntervalMs: '$AMBIENT_MIN_INTERVAL_MS' }),
    Object.freeze({ sfx: null }),
  ]),
  /** a warp / door: the warp's own `sfx` field, else the door sound */
  warp: Object.freeze({ sfx: 'doorOpen', sfxField: 'sfx', minIntervalMs: 300 }),
  /** scripts' `playSfx` op and anything else that names a sound outright */
  sfx: Object.freeze({ sfx: null, sfxField: 'name', pitch: { kind: 'payload' }, minIntervalMs: 0 }),
  'ui:cursor': ui('blip'),
  'ui:confirm': ui('confirm'),
  'ui:cancel': ui('cancel'),
  'ui:blocked': ui('blocked'),
  'ui:error': ui('error'),
  'ui:textTick': Object.freeze({ sfx: 'textTick', minIntervalMs: '$TEXT_TICK_MIN_INTERVAL_MS' }),
});

/**
 * Interaction verbs (`world/interact.KIND_VERBS` / `VERB_TOOLS` / tile verbs) -> sound. Played when a
 * verb is *performed* (`interact` bus event or `router.verb`). A disabled verb plays `blocked`.
 * @type {Readonly<Record<string, SfxEntry>>}
 */
export const VERB_SFX = Object.freeze({
  talk: Object.freeze({ sfx: 'blip' }),
  read: Object.freeze({ sfx: 'blip' }),
  look: Object.freeze({ sfx: 'blip' }),
  inspect: Object.freeze({ sfx: 'blip' }),
  pickUp: Object.freeze({ sfx: 'fruitDrop' }),
  shake: Object.freeze({ sfx: 'shake', minIntervalMs: 200 }),
  fish: Object.freeze({ sfx: 'splash' }),
  dig: Object.freeze({ sfx: 'dig', minIntervalMs: 150 }),
  catch: Object.freeze({ sfx: 'thwap' }),
  enter: Object.freeze({ sfx: 'doorOpen' }),
  board: Object.freeze({ sfx: 'splash' }),
  sit: Object.freeze({ sfx: 'blip' }),
  mailbox: Object.freeze({ sfx: 'letter' }),
  use: Object.freeze({ sfx: 'confirm' }),
  light: Object.freeze({ sfx: 'lantern' }),
  crack: Object.freeze({ sfx: 'crack' }),
});

/**
 * Battle events (`battle/events.EVENT_FIELDS` types) -> sound, for the battle scene's animation queue.
 * @type {Readonly<Record<string, SfxEntry>>}
 */
export const BATTLE_SFX = Object.freeze({
  damage: Object.freeze([
    Object.freeze({ when: { field: 'source', eq: 'status' }, sfx: 'hitWeak', key: 'hit', minIntervalMs: '$HIT_MIN_INTERVAL_MS' }),
    Object.freeze({ when: { field: 'amount', gt: 0 }, sfx: 'hit', key: 'hit', minIntervalMs: '$HIT_MIN_INTERVAL_MS' }),
    Object.freeze({ sfx: null }),
  ]),
  effectiveness: Object.freeze([
    Object.freeze({ when: { field: 'mult', eq: 0 }, sfx: 'blocked' }),
    Object.freeze({ when: { field: 'mult', gte: '$HIT_STRONG_MULT' }, sfx: 'hitStrong', key: 'hit-accent' }),
    Object.freeze({ when: { field: 'mult', lte: '$HIT_WEAK_MULT' }, sfx: 'hitWeak', key: 'hit-accent' }),
    Object.freeze({ sfx: null }),
  ]),
  crit: Object.freeze({ sfx: 'hitStrong', key: 'hit-accent' }),
  miss: Object.freeze({ sfx: 'cancel' }),
  blocked: Object.freeze({ sfx: 'blocked' }),
  guard: Object.freeze({ sfx: 'blocked' }),
  faint: Object.freeze({ sfx: 'thwap' }),
  heal: Object.freeze({ sfx: 'heal' }),
  status: Object.freeze([
    Object.freeze({ when: { field: 'action', in: ['inflict', 'tick'] }, sfx: 'hitWeak' }),
    Object.freeze({ when: { field: 'action', eq: 'cure' }, sfx: 'heal' }),
    Object.freeze({ sfx: null }),
  ]),
  stat: Object.freeze([
    Object.freeze({ when: { field: 'result', in: ['raised', 'lowered'] }, sfx: 'blip', pitch: { kind: 'field', field: 'stages', semitones: '$STAT_STAGE_SEMITONES', max: '$STAT_MAX_SEMITONES' } }),
    Object.freeze({ when: { field: 'result', in: ['capped', 'blocked'] }, sfx: 'blocked' }),
    Object.freeze({ sfx: null }),
  ]),
  switch: Object.freeze({ sfx: 'confirm' }),
  lantern: Object.freeze({ sfx: 'lantern' }),
  'capture-shake': Object.freeze({ sfx: 'shake', minIntervalMs: 0, pitch: { kind: 'field', field: 'n', semitones: '$CAPTURE_SHAKE_SEMITONES', max: '$CAPTURE_SHAKE_MAX_SEMITONES' } }),
  capture: Object.freeze({ sfx: 'capture' }),
  'capture-fail': Object.freeze({ sfx: 'captureFail' }),
  read: Object.freeze({ sfx: 'bell' }),
  'ward-readout': Object.freeze({ sfx: 'bell' }),
  reveal: Object.freeze({ sfx: 'shiftFlip' }),
  levelup: Object.freeze({ sfx: 'levelUp', volume: '$LEVEL_UP_VOLUME' }),
  learn: Object.freeze({ sfx: 'confirm' }),
  scrap: Object.freeze({ sfx: 'thwap' }),
  glint: Object.freeze({ sfx: 'coin' }),
  payout: Object.freeze({ sfx: 'coin' }),
  run: Object.freeze({ sfx: 'step' }),
  item: Object.freeze({ sfx: 'confirm' }),
  'mend-spent': Object.freeze({ sfx: 'heal' }),
  blackout: Object.freeze({ sfx: 'captureFail' }),
});

// ---------------------------------------------------------------------------------------------
// Pure resolution
// ---------------------------------------------------------------------------------------------

/**
 * Merged tuning: {@link DEFAULTS} under the given overrides (unknown keys kept; non-finite numbers
 * for known numeric keys fall back to the default).
 * @param {Record<string, any>} [tuning]
 * @returns {Readonly<Record<string, any>>}
 */
export function tuningOf(tuning) {
  const out = { ...DEFAULTS };
  if (tuning && typeof tuning === 'object') {
    for (const [k, v] of Object.entries(tuning)) {
      if (typeof DEFAULTS[k] === 'number' && !(typeof v === 'number' && Number.isFinite(v))) continue;
      out[k] = v;
    }
  }
  return Object.freeze(out);
}

/**
 * Resolves a tuned number: `'$KEY'` reads the tuning table, numbers pass through, anything else is
 * `fallback`.
 * @param {unknown} v
 * @param {Record<string, any>} tuning
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function resolveRef(v, tuning, fallback = 0) {
  if (typeof v === 'string' && v.startsWith('$')) {
    const r = tuning?.[v.slice(1)];
    return typeof r === 'number' && Number.isFinite(r) ? r : fallback;
  }
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Reads a dotted path from a payload (`'a.b'`); undefined when any step is missing.
 * @param {unknown} payload
 * @param {string} path
 * @returns {unknown}
 */
export function readField(payload, path) {
  let cur = payload;
  for (const part of String(path).split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * True when every match in `when` holds for `payload` (an omitted `when` always holds).
 * @param {Match|Match[]|undefined} when
 * @param {unknown} payload
 * @param {Record<string, any>} tuning
 * @returns {boolean}
 */
export function matches(when, payload, tuning) {
  if (!when) return true;
  const list = Array.isArray(when) ? when : [when];
  for (const m of list) {
    if (!m || typeof m.field !== 'string') return false;
    const v = readField(payload, m.field);
    const num = (x) => resolveRef(x, tuning, NaN);
    let ok;
    if ('eq' in m) ok = v === m.eq;
    else if ('ne' in m) ok = v !== m.ne;
    else if ('in' in m) ok = Array.isArray(m.in) && m.in.includes(v);
    else if ('gt' in m) ok = typeof v === 'number' && v > num(m.gt);
    else if ('gte' in m) ok = typeof v === 'number' && v >= num(m.gte);
    else if ('lt' in m) ok = typeof v === 'number' && v < num(m.lt);
    else if ('lte' in m) ok = typeof v === 'number' && v <= num(m.lte);
    else if ('truthy' in m) ok = Boolean(v) === Boolean(m.truthy);
    else ok = false;
    if (!ok) return false;
  }
  return true;
}

/**
 * The first rule of an entry whose `when` matches, or null.
 * @param {SfxEntry|undefined|null} entry
 * @param {unknown} payload
 * @param {Record<string, any>} tuning
 * @returns {SfxRule|null}
 */
export function selectRule(entry, payload, tuning) {
  if (!entry) return null;
  const list = Array.isArray(entry) ? entry : [entry];
  for (const r of list) if (r && matches(r.when, payload, tuning)) return r;
  return null;
}

/** Semitones -> frequency multiplier. @param {number} st @returns {number} */
export function semitonesToPitch(st) {
  return Math.pow(2, st / 12);
}

/**
 * Mutable per-router memory the `combo` pitch rule reads and writes: key -> {count, at}.
 * @typedef {Map<string, {count: number, at: number}>} ComboState
 */

/**
 * Pitch (as semitones) for a rule. Deterministic given `rng`, `now` and `combo`.
 * @param {PitchRule|undefined} rule
 * @param {unknown} payload
 * @param {{tuning: Record<string, any>, rng?: {next: () => number}, now?: number, combo?: ComboState, key?: string}} ctx
 * @returns {number} semitones (0 = as designed)
 */
export function pitchSemitones(rule, payload, ctx) {
  if (!rule) return 0;
  const t = ctx.tuning;
  switch (rule.kind) {
    case 'fixed': return resolveRef(rule.semitones, t, 0);
    case 'jitter': {
      const amount = Math.max(0, resolveRef(rule.amount, t, 0));
      if (!amount || !ctx.rng) return 0;
      const mult = 1 + (ctx.rng.next() * 2 - 1) * amount;
      return 12 * Math.log2(Math.max(0.25, mult));
    }
    case 'combo': {
      const step = resolveRef(rule.semitones, t, 0);
      const max = Math.max(0, Math.floor(resolveRef(rule.max, t, 0)));
      const resetMs = Math.max(0, resolveRef(rule.resetMs, t, 0));
      const now = ctx.now ?? 0;
      const key = ctx.key ?? 'combo';
      const combo = ctx.combo;
      if (!combo) return 0;
      const prev = combo.get(key);
      const count = prev && now - prev.at <= resetMs ? Math.min(max, prev.count + 1) : 0;
      combo.set(key, { count, at: now });
      return count * step;
    }
    case 'field': {
      const v = Number(readField(payload, rule.field));
      if (!Number.isFinite(v)) return 0;
      const st = v * resolveRef(rule.semitones, t, 0);
      const max = rule.max === undefined ? Infinity : Math.abs(resolveRef(rule.max, t, Infinity));
      return Math.max(-max, Math.min(max, st));
    }
    case 'payload': {
      const st = Number(readField(payload, 'semitones'));
      const p = Number(readField(payload, 'pitch'));
      return (Number.isFinite(st) ? st : 0) + (Number.isFinite(p) && p > 0 ? 12 * Math.log2(p) : 0);
    }
    default: return 0;
  }
}

/**
 * Resolves one event against one table entry: rule selection, sound id, pitch, volume and limiter
 * parameters. Returns null when no rule matches or the matching rule is silent. Mutates only
 * `ctx.combo` (when the rule has a `combo` pitch).
 * @param {SfxEntry|undefined|null} entry
 * @param {unknown} payload
 * @param {{tuning?: Record<string, any>, rng?: {next: () => number}, now?: number, combo?: ComboState}} [ctx]
 * @returns {SfxPlay|null}
 */
export function resolveSfx(entry, payload, ctx = {}) {
  const tuning = ctx.tuning ?? DEFAULTS;
  const rule = selectRule(entry, payload, tuning);
  if (!rule) return null;
  let sfx = rule.sfx;
  if (rule.sfxField) {
    const named = readField(payload, rule.sfxField);
    if (typeof named === 'string' && named.trim()) sfx = named.trim();
  }
  if (typeof sfx !== 'string' || !sfx) return null;
  const key = rule.key ?? sfx;
  const semitones = pitchSemitones(rule.pitch, payload, { ...ctx, tuning, key });
  const volRaw = rule.volume === undefined ? 1 : resolveRef(rule.volume, tuning, 1);
  const payloadVol = rule.pitch?.kind === 'payload' ? Number(readField(payload, 'volume')) : NaN;
  const volume = Math.max(0, Math.min(2, Number.isFinite(payloadVol) ? payloadVol : volRaw));
  const minIntervalMs = Math.max(0, rule.minIntervalMs === undefined
    ? resolveRef('$SFX_DEFAULT_MIN_INTERVAL_MS', tuning, 0)
    : resolveRef(rule.minIntervalMs, tuning, 0));
  return { sfx, pitch: semitonesToPitch(semitones), semitones, volume, key, minIntervalMs };
}

/**
 * Bus event -> sound (or null). Thin wrapper over {@link resolveSfx} with {@link BUS_SFX}.
 * @param {string} evt
 * @param {unknown} payload
 * @param {{tuning?: Record<string, any>, rng?: {next: () => number}, now?: number, combo?: ComboState, map?: Record<string, SfxEntry>}} [ctx]
 * @returns {SfxPlay|null}
 */
export function sfxForEvent(evt, payload, ctx = {}) {
  const map = ctx.map ?? BUS_SFX;
  return resolveSfx(Object.hasOwn(map, evt) ? map[evt] : null, payload, ctx);
}

/**
 * Interaction verb -> sound (or null). A payload with a truthy `disabled` plays `blocked`.
 * @param {string} verb
 * @param {unknown} [payload]
 * @param {{tuning?: Record<string, any>, rng?: {next: () => number}, now?: number, combo?: ComboState, verbs?: Record<string, SfxEntry>}} [ctx]
 * @returns {SfxPlay|null}
 */
export function sfxForVerb(verb, payload, ctx = {}) {
  if (payload && typeof payload === 'object' && payload.disabled) return resolveSfx(ui('blocked'), payload, ctx);
  const verbs = ctx.verbs ?? VERB_SFX;
  return resolveSfx(typeof verb === 'string' && Object.hasOwn(verbs, verb) ? verbs[verb] : null, payload, ctx);
}

/**
 * Battle event (`{type, ...}` from battle/engine) -> sound (or null).
 * @param {{type?: string}|null|undefined} ev
 * @param {{tuning?: Record<string, any>, rng?: {next: () => number}, now?: number, combo?: ComboState, battle?: Record<string, SfxEntry>}} [ctx]
 * @returns {SfxPlay|null}
 */
export function sfxForBattleEvent(ev, ctx = {}) {
  const table = ctx.battle ?? BATTLE_SFX;
  const type = ev && typeof ev === 'object' ? ev.type : undefined;
  return resolveSfx(typeof type === 'string' && Object.hasOwn(table, type) ? table[type] : null, ev, ctx);
}

/**
 * Rate limiter for sfx: per-key minimum spacing plus a global burst cap. Time is whatever monotonic
 * millisecond clock the caller passes (pure; no timers).
 * @param {{tuning?: Record<string, any>}} [opts]
 * @returns {{allow: (key: string, now: number, minIntervalMs?: number) => boolean, reset: () => void, size: () => number}}
 */
export function createSfxLimiter(opts = {}) {
  const t = tuningOf(opts.tuning);
  /** @type {Map<string, number>} */
  const last = new Map();
  /** @type {number[]} */
  let burst = [];
  return {
    allow(key, now, minIntervalMs = t.SFX_DEFAULT_MIN_INTERVAL_MS) {
      if (!Number.isFinite(now)) return false;
      const gap = Math.max(0, Number.isFinite(minIntervalMs) ? minIntervalMs : t.SFX_DEFAULT_MIN_INTERVAL_MS);
      const prev = last.get(key);
      if (prev !== undefined && now - prev < gap && now >= prev) return false;
      const windowMs = Math.max(0, t.SFX_BURST_WINDOW_MS);
      burst = burst.filter((at) => now - at < windowMs && now >= at);
      if (burst.length >= Math.max(1, t.SFX_BURST_MAX)) return false;
      burst.push(now);
      last.set(key, now);
      return true;
    },
    reset() { last.clear(); burst = []; },
    size: () => last.size,
  };
}

// ---------------------------------------------------------------------------------------------
// Router (bus -> audio.sfx)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} SfxRouter
 * @property {(evt: string, payload?: any) => SfxPlay|null} event   resolve + play a bus event by hand
 * @property {(verb: string, payload?: any) => SfxPlay|null} verb   resolve + play an interaction verb
 * @property {(ev: {type: string}) => SfxPlay|null} battle          resolve + play a battle event
 * @property {() => {played: number, limited: number, silent: number, failed: number, last: SfxPlay|null}} stats
 * @property {() => SfxPlay[]} log      the last plays (newest last; at most 32)
 * @property {() => void} destroy       unsubscribe from the bus
 */

/**
 * Subscribes to the bus and turns events into `audio.sfx` calls. Listens to every key of the map plus
 * `interact` (`{verb, disabled?}`) and `battle:event` (`{event}` or a bare battle event). A failing or
 * locked engine never throws into the bus.
 * @param {Object} opts
 * @param {{on: (evt: string, fn: Function) => (() => void)}} [opts.bus]
 * @param {{sfx: (name: string, o?: {pitch?: number, volume?: number}) => any}} [opts.audio]
 * @param {Record<string, any>} [opts.tuning]
 * @param {() => number} [opts.now]          monotonic ms (default performance.now / Date.now)
 * @param {{next: () => number}} [opts.rng]  pitch jitter source (default a seeded core/rng fork)
 * @param {Record<string, SfxEntry>} [opts.map]     replaces {@link BUS_SFX}
 * @param {Record<string, SfxEntry>} [opts.verbs]   replaces {@link VERB_SFX}
 * @param {Record<string, SfxEntry>} [opts.battle]  replaces {@link BATTLE_SFX}
 * @returns {SfxRouter}
 */
export function createSfxRouter(opts = {}) {
  const tuning = tuningOf(opts.tuning);
  const map = opts.map ?? BUS_SFX;
  const verbs = opts.verbs ?? VERB_SFX;
  const battleTable = opts.battle ?? BATTLE_SFX;
  const now = typeof opts.now === 'function' ? opts.now : defaultNow;
  const rng = opts.rng ?? makeRng('audio:sfx');
  const audio = opts.audio ?? null;
  const limiter = createSfxLimiter({ tuning });
  /** @type {ComboState} */
  const combo = new Map();
  const counts = { played: 0, limited: 0, silent: 0, failed: 0, last: null };
  /** @type {SfxPlay[]} */
  const recent = [];

  const ctx = () => ({ tuning, rng, now: now(), combo, map, verbs, battle: battleTable });

  function fire(play) {
    if (!play) { counts.silent++; return null; }
    if (!limiter.allow(play.key, now(), play.minIntervalMs)) { counts.limited++; return null; }
    try {
      if (audio && typeof audio.sfx === 'function') audio.sfx(play.sfx, { pitch: play.pitch, volume: play.volume });
    } catch {
      counts.failed++;
      return null;
    }
    counts.played++;
    counts.last = play;
    recent.push(play);
    if (recent.length > 32) recent.shift();
    return play;
  }

  const api = {
    event: (evt, payload) => fire(sfxForEvent(evt, payload, ctx())),
    verb: (v, payload) => fire(sfxForVerb(v, payload, ctx())),
    battle: (ev) => fire(sfxForBattleEvent(ev, ctx())),
    stats: () => ({ ...counts }),
    log: () => recent.slice(),
    destroy() { while (offs.length) offs.pop()(); },
  };

  /** @type {Array<() => void>} */
  const offs = [];
  const bus = opts.bus;
  if (bus && typeof bus.on === 'function') {
    const listen = (evt, fn) => {
      const off = bus.on(evt, (...args) => { try { fn(...args); } catch { counts.failed++; } });
      if (typeof off === 'function') offs.push(off);
    };
    for (const evt of Object.keys(map)) listen(evt, (payload) => api.event(evt, payload));
    listen('interact', (p) => { if (p && typeof p === 'object') api.verb(p.verb, p); else if (typeof p === 'string') api.verb(p, null); });
    listen('battle:event', (p) => { api.battle(p && typeof p === 'object' && p.event && typeof p.event === 'object' ? p.event : p); });
  }
  return Object.freeze(api);
}

/** @returns {number} */
function defaultNow() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

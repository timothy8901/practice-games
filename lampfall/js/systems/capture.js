/**
 * Capture odds and the capture roll (wildshift-rules §15; ARCHITECTURE §5.3). [RULES-CAPTURE]
 *
 * Thin over the battle engine's pure helpers (`battle/engine.js` re-exports `captureOdds` and
 * `captureBand` from `battle/effects.js`): the formula stays in the engine; this module owns the
 * designer numbers and the rules around it.
 *
 *  - {@link captureOdds} gives the odds the Lantern menu shows **before** a Lantern is spent: an
 *    exact whole percent on Drift and Flux, a Low / Fair / Good band on Freefall (per dial in
 *    `CAPTURE_DISPLAY`, or the dial rules' `captureDisplay`). With `ROUND_TO_SHOWN` the odds rolled
 *    are exactly the percent shown (GDD-00 "odds shown = odds rolled").
 *  - Each failed attempt on the same creature adds `CAPTURE_FAIL_BONUS`, capped at
 *    `CAPTURE_FAIL_CAP` (+3% per fail, +15% cap). The caller counts the fails (the engine keeps them
 *    per battle).
 *  - A sure-catch grade (`LANTERNS[grade].sure`, the Keepsake Lantern) always succeeds, draws no
 *    random number and is flagged `confirm` (one-of-a-kind items need a confirm naming the target).
 *  - Capture Stance: party damage never drops the wild creature below 1 HP ({@link stanceFloor},
 *    the same rule the engine applies), so the odds are computed from at least 1 HP.
 *  - {@link attemptCapture} rolls once on the injected rng (`rng.chance(p)`), exactly as the engine.
 *
 * No content is named; the catch rate comes from `ctx.catchRate` or the species row in `ctx.data`.
 * Pure: no DOM; deterministic given the injected rng.
 * @module systems/capture
 */

import { captureOdds as engineCaptureOdds, captureBand as engineCaptureBand } from '../battle/engine.js';
import { dataLookup } from './exp.js';

/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {'percent'|'band'} CaptureDisplay */

/**
 * @typedef {Object} LanternGrade
 * @property {number} mult          odds multiplier
 * @property {boolean} [sure]       never fails (one-of-a-kind; confirm before use)
 */

/**
 * @typedef {Object} CaptureTuning
 * @property {number} CAPTURE_FAIL_BONUS                 odds added per failed attempt on the same creature
 * @property {number} CAPTURE_FAIL_CAP                   cap on the fail bonus
 * @property {number} CAPTURE_ODDS_MIN                   clamp for ordinary Lanterns (low)
 * @property {number} CAPTURE_ODDS_MAX                   clamp for ordinary Lanterns (high)
 * @property {Record<string, number>} CAPTURE_STATUS_MULT  odds multiplier per status kind (`trap` when the target is trapped)
 * @property {Array<[number, string]>} CAPTURE_BANDS     ascending [upper limit (exclusive), band word]; the last word also covers anything above
 * @property {Record<string, CaptureDisplay>} CAPTURE_DISPLAY   per dial: exact percent or band; its keys are the known dials
 * @property {Record<string, LanternGrade>} LANTERNS     Lantern grade key -> multiplier (and `sure`)
 * @property {number} CAPTURE_SEGMENTS                   glow meter segments (a success fills all)
 * @property {boolean} ROUND_TO_SHOWN                    roll the whole percent that is shown, not the unrounded odds
 */

/**
 * Designer-tunable defaults. [GDD values] They mirror the verified battle prototype
 * (`battle/effects.DEFAULTS`): +3% per fail capped at +15% (rules §15.4), clamp 1-99%, status
 * multipliers, bands Low < 25% <= Fair < 60% <= Good, grades ×1 / ×1.5 / ×2 and the Keepsake sure
 * catch, a 3-segment meter (rules §15.3).
 * @type {Readonly<CaptureTuning>}
 */
export const DEFAULTS = deepFreeze({
  CAPTURE_FAIL_BONUS: 0.03,
  CAPTURE_FAIL_CAP: 0.15,
  CAPTURE_ODDS_MIN: 0.01,
  CAPTURE_ODDS_MAX: 0.99,
  CAPTURE_STATUS_MULT: { chill: 1.5, numb: 1.5, trap: 1.5, burn: 1.25, poison: 1.25 },
  CAPTURE_BANDS: [[0.25, 'Low'], [0.6, 'Fair'], [Infinity, 'Good']],
  CAPTURE_DISPLAY: { drift: 'percent', flux: 'percent', freefall: 'band' },
  LANTERNS: { 1: { mult: 1 }, 2: { mult: 1.5 }, 3: { mult: 2 }, sure: { mult: 1, sure: true } },
  CAPTURE_SEGMENTS: 3,
  ROUND_TO_SHOWN: true,
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isFrac = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isPos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const isBands = (v) => Array.isArray(v) && v.length > 0 && v.every((b, i) => Array.isArray(b) && b.length === 2
  && typeof b[0] === 'number' && !Number.isNaN(b[0]) && typeof b[1] === 'string' && b[1].length > 0 && (i === 0 || b[0] > v[i - 1][0]));
const isLanterns = (v) => isObj(v) && Object.keys(v).length > 0 && Object.values(v).every((g) => isObj(g) && isPos(g.mult) && (g.sure === undefined || typeof g.sure === 'boolean'));

/** @type {Record<keyof CaptureTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  CAPTURE_FAIL_BONUS: [isFrac, 'fraction 0..1'],
  CAPTURE_FAIL_CAP: [isFrac, 'fraction 0..1'],
  CAPTURE_ODDS_MIN: [isFrac, 'fraction 0..1'],
  CAPTURE_ODDS_MAX: [isFrac, 'fraction 0..1'],
  CAPTURE_STATUS_MULT: [(v) => isObj(v) && Object.values(v).every(isPos), '{kind: number > 0}'],
  CAPTURE_BANDS: [isBands, '[[limit, word], ...] with ascending limits'],
  CAPTURE_DISPLAY: [(v) => isObj(v) && Object.keys(v).length > 0 && Object.values(v).every((d) => d === 'percent' || d === 'band'), "{dial: 'percent'|'band'}"],
  LANTERNS: [isLanterns, '{grade: {mult: number > 0, sure?: boolean}}'],
  CAPTURE_SEGMENTS: [(v) => Number.isInteger(v) && v >= 1, 'integer >= 1'],
  ROUND_TO_SHOWN: [(v) => typeof v === 'boolean', 'boolean'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** @type {WeakMap<object, Readonly<CaptureTuning>>} */
const TUNING_CACHE = new WeakMap();

/**
 * Resolves a partial tuning override over {@link DEFAULTS}. Keys of other modules are ignored; a
 * known key with a malformed value throws (as does a min above the max). Cached per override.
 * @param {Partial<CaptureTuning>|Record<string, any>|null|undefined} [tuning]
 * @returns {Readonly<CaptureTuning>}
 * @throws {TypeError}
 */
export function tuningOf(tuning) {
  if (tuning == null) return DEFAULTS;
  if (typeof tuning !== 'object') throw new TypeError('capture.tuningOf: tuning must be an object');
  const hit = TUNING_CACHE.get(tuning);
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(tuning, key)) continue;
    const v = /** @type {any} */ (tuning)[key];
    const [pred, desc] = SPEC[/** @type {keyof CaptureTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`capture tuning ${key}: expected ${desc}, got ${String(JSON.stringify(v))}`);
    out[key] = v;
  }
  if (out.CAPTURE_ODDS_MIN > out.CAPTURE_ODDS_MAX) throw new TypeError('capture tuning: CAPTURE_ODDS_MIN must not exceed CAPTURE_ODDS_MAX');
  const frozen = deepFreeze(structuredClone(out));
  TUNING_CACHE.set(tuning, frozen);
  return frozen;
}

/** @type {WeakMap<object, Record<string, any>>} */
const ENGINE_TUNING = new WeakMap();

/**
 * Maps this module's tuning onto the engine helper's tuning keys.
 * @param {Readonly<CaptureTuning>} t
 * @returns {Record<string, any>}
 */
function engineTuning(t) {
  const hit = ENGINE_TUNING.get(t);
  if (hit) return hit;
  /** @type {Record<string, any>} */
  const lantern = {};
  for (const [g, L] of Object.entries(t.LANTERNS)) lantern[g] = { mult: L.sure ? Infinity : L.mult, price: null, name: g };
  const out = Object.freeze({
    captureFailBonus: t.CAPTURE_FAIL_BONUS,
    captureFailCap: t.CAPTURE_FAIL_CAP,
    captureOddsMin: t.CAPTURE_ODDS_MIN,
    captureOddsMax: t.CAPTURE_ODDS_MAX,
    captureStatusMult: t.CAPTURE_STATUS_MULT,
    captureBands: t.CAPTURE_BANDS,
    lantern,
  });
  ENGINE_TUNING.set(t, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Small rules
// ---------------------------------------------------------------------------------------------

/**
 * Odds bonus after `fails` failed attempts on the same creature: min(cap, fails × bonus).
 * @param {number} fails
 * @param {{tuning?: Record<string, any>|null}} [opts]
 * @returns {number}
 */
export function failBonus(fails, opts = {}) {
  const t = tuningOf(opts.tuning);
  const n = Math.max(0, Math.floor(Number(fails) || 0));
  return Math.min(t.CAPTURE_FAIL_CAP, n * t.CAPTURE_FAIL_BONUS);
}

/**
 * The band word for odds (Freefall display).
 * @param {number} p
 * @param {{tuning?: Record<string, any>|null}} [opts]
 * @returns {string}
 */
export function bandFor(p, opts = {}) {
  return engineCaptureBand(p, engineTuning(tuningOf(opts.tuning)));
}

/**
 * How odds are shown on a dial. Dial rules (data/dials `captureDisplay`: 'percent' | 'exact' |
 * 'band' | 'bands') win over CAPTURE_DISPLAY.
 * @param {string} dial
 * @param {{tuning?: Record<string, any>|null, rules?: {captureDisplay?: string}|null}} [opts]
 * @returns {CaptureDisplay}
 * @throws {RangeError} for an unknown dial without rules
 */
export function displayFor(dial, opts = {}) {
  const r = opts.rules?.captureDisplay;
  if (r === 'band' || r === 'bands') return 'band';
  if (r === 'percent' || r === 'exact') return 'percent';
  const t = tuningOf(opts.tuning);
  const d = typeof dial === 'string' && Object.prototype.hasOwnProperty.call(t.CAPTURE_DISPLAY, dial) ? t.CAPTURE_DISPLAY[dial] : null;
  if (!d) throw new RangeError(`capture.displayFor: unknown dial ${JSON.stringify(dial)}`);
  return d;
}

/**
 * Whether a Lantern grade is the sure catch (one-of-a-kind; the confirm names the target).
 * @param {string|number} grade
 * @param {{tuning?: Record<string, any>|null}} [opts]
 * @returns {boolean}
 */
export function isSureGrade(grade, opts = {}) {
  const L = tuningOf(opts.tuning).LANTERNS[grade];
  return !!(L && L.sure);
}

/**
 * Capture Stance (rules §15.2): damage from anything but the wild creature itself never takes it
 * below 1 HP while the Stance is on. Mirrors `Battle._applyDamage`.
 * @param {number} hp       current HP
 * @param {number} damage   damage wanted (floored, at least 0)
 * @param {{stance?: boolean, source?: string}} [opts]   `source: 'self'` (recoil, self-KO) is never floored
 * @returns {{hp: number, dealt: number, floored: boolean}}  `floored`: the floor stopped some damage
 */
export function stanceFloor(hp, damage, opts = {}) {
  const want = Math.max(0, Math.floor(Number(damage) || 0));
  const cur = Math.max(0, Math.floor(Number(hp) || 0));
  let dealt = want;
  const on = !!opts.stance && opts.source !== 'self';
  if (on) dealt = Math.min(dealt, Math.max(0, cur - 1));
  dealt = Math.min(dealt, cur);
  return { hp: cur - dealt, dealt, floored: on && dealt < want && cur - dealt === 1 };
}

// ---------------------------------------------------------------------------------------------
// Odds
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} CaptureCtx
 * @property {string|number} grade        Lantern grade key of LANTERNS
 * @property {number} [fails=0]           failed attempts on this creature so far
 * @property {number} [catchRate]         species catch rate (3..255); default: the species row in `data`
 * @property {any} [data]                 Registry or tables, to look the catch rate up
 * @property {boolean} [trapped]          the target is trapped
 * @property {boolean} [stance]           Capture Stance is on (odds use at least 1 HP)
 * @property {number} [maxHp]             default: target.stats.hp
 * @property {string|null} [status]       default: target.status.kind
 */

/**
 * @typedef {Object} CaptureOdds
 * @property {number} p                   probability {@link attemptCapture} rolls (1 for a sure catch)
 * @property {number} pct                 whole percent
 * @property {string} band                band word
 * @property {CaptureDisplay} display
 * @property {number|string} shown        what the Lantern menu shows: `pct` (percent) or `band`
 * @property {boolean} sure               the sure-catch grade
 * @property {boolean} confirm            spending it needs a confirm naming the target (one-of-a-kind)
 * @property {number} fails  @property {number} bonus
 * @property {string|number} grade
 * @property {{p: number, pct: number, band: string, shown: number|string}|null} next   odds after one more failed attempt (null for a sure catch)
 */

/**
 * Capture odds shown before a Lantern is spent (rules §15.4; ARCHITECTURE §5.3).
 * @param {{speciesId?: string, hp: number, stats?: {hp: number}, status?: {kind: string}|null}} target   the wild creature (world record or battle copy)
 * @param {CaptureCtx} ctx
 * @param {{dial?: string, tuning?: Record<string, any>|null, rules?: {captureDisplay?: string}|null}} [opts]
 * @returns {CaptureOdds}
 * @throws {RangeError} for an unknown grade / dial or a missing catch rate
 */
export function captureOdds(target, ctx, opts = {}) {
  if (!target || typeof target !== 'object') throw new TypeError('capture.captureOdds: target must be a creature');
  if (!ctx || typeof ctx !== 'object') throw new TypeError('capture.captureOdds: ctx must be an object');
  const t = tuningOf(opts.tuning);
  const display = displayFor(/** @type {string} */ (opts.dial), opts);
  const res = oddsFor(target, ctx, t, Math.max(0, Math.floor(Number(ctx.fails) || 0)), display);
  const next = res.sure ? null : oddsFor(target, ctx, t, res.fails + 1, display);
  return { ...res, next: next ? { p: next.p, pct: next.pct, band: next.band, shown: next.shown } : null };
}

/**
 * @param {any} target
 * @param {CaptureCtx} ctx
 * @param {Readonly<CaptureTuning>} t
 * @param {number} fails
 * @param {CaptureDisplay} display
 */
function oddsFor(target, ctx, t, fails, display) {
  const grade = ctx.grade;
  const L = t.LANTERNS[/** @type {any} */ (grade)];
  if (!L) throw new RangeError(`capture.captureOdds: unknown Lantern grade ${JSON.stringify(grade)}`);
  const bonus = Math.min(t.CAPTURE_FAIL_CAP, fails * t.CAPTURE_FAIL_BONUS);
  const et = engineTuning(t);
  let p;
  if (L.sure) {
    p = 1;
  } else {
    let catchRate = ctx.catchRate;
    if (catchRate === undefined) {
      if (!ctx.data || typeof target.speciesId !== 'string') throw new RangeError('capture.captureOdds: need ctx.catchRate or ctx.data with the target species');
      catchRate = dataLookup(ctx.data).species(target.speciesId).catchRate;
    }
    if (typeof catchRate !== 'number' || !Number.isFinite(catchRate) || catchRate < 0) throw new RangeError(`capture.captureOdds: bad catch rate ${JSON.stringify(catchRate)}`);
    const maxHp = ctx.maxHp ?? target.stats?.hp ?? target.hp;
    if (typeof target.hp !== 'number' || !Number.isFinite(target.hp) || target.hp < 0) throw new RangeError(`capture.captureOdds: bad target hp ${JSON.stringify(target.hp)}`);
    if (typeof maxHp !== 'number' || !Number.isFinite(maxHp) || maxHp <= 0) throw new RangeError(`capture.captureOdds: bad max hp ${JSON.stringify(maxHp)}`);
    const hp = ctx.stance ? Math.max(1, target.hp) : target.hp;
    const status = ctx.status !== undefined ? ctx.status : (target.status ? target.status.kind : null);
    const raw = engineCaptureOdds({ catchRate, hp, maxHp, status, trapped: !!ctx.trapped, grade, fails }, et);
    p = t.ROUND_TO_SHOWN ? roundShown(raw, t) : raw;
  }
  const pct = Math.round(p * 100);
  const band = engineCaptureBand(p, et);
  return { p, pct, band, display, shown: display === 'percent' ? pct : band, sure: !!L.sure, confirm: !!L.sure, fails, bonus, grade };
}

/**
 * Rounds odds to the whole percent shown, kept inside the clamp: a clamp that is not a whole percent
 * (e.g. a 0.4% floor) rounds inward, so the odds rolled never fall to 0 or leave the clamp range.
 * @param {number} raw
 * @param {Readonly<CaptureTuning>} t
 * @returns {number}
 */
function roundShown(raw, t) {
  const lo = Math.ceil(t.CAPTURE_ODDS_MIN * 100 - 1e-9);
  const hi = Math.floor(t.CAPTURE_ODDS_MAX * 100 + 1e-9);
  let pct = Math.round(raw * 100);
  if (lo <= hi) pct = Math.min(hi, Math.max(lo, pct));
  else return raw; // no whole percent inside the clamp: roll the exact odds
  return pct / 100;
}

// ---------------------------------------------------------------------------------------------
// Roll
// ---------------------------------------------------------------------------------------------

/**
 * Rolls one capture attempt. Ordinary odds draw exactly one number (`rng.chance(p)`); a sure catch
 * (odds `sure`, or p >= 1) succeeds without drawing, exactly as the engine's capture attempt does.
 * `segments` is how far the glow meter fills (all of it on success).
 * @param {Rng} rng
 * @param {number|CaptureOdds} odds   probability 0..1, or a {@link captureOdds} result
 * @param {{tuning?: Record<string, any>|null}} [opts]
 * @returns {{success: boolean, p: number, segments: number, drew: boolean}}
 * @throws {TypeError} for odds that are not a number in [0, 1] or an rng without `chance`
 */
export function attemptCapture(rng, odds, opts = {}) {
  const t = tuningOf(opts.tuning);
  const p = typeof odds === 'number' ? odds : odds && typeof odds === 'object' ? odds.p : NaN;
  if (typeof p !== 'number' || Number.isNaN(p) || p < 0 || p > 1) throw new TypeError(`capture.attemptCapture: odds must be in [0, 1], got ${String(p)}`);
  const sure = (typeof odds === 'object' && !!odds.sure) || p >= 1;
  if (sure) return { success: true, p, segments: t.CAPTURE_SEGMENTS, drew: false };
  if (!rng || typeof rng.chance !== 'function') throw new TypeError('capture.attemptCapture: rng must be a core/rng Rng');
  const success = rng.chance(p);
  const segments = success ? t.CAPTURE_SEGMENTS : Math.min(t.CAPTURE_SEGMENTS - 1, Math.floor(p * t.CAPTURE_SEGMENTS));
  return { success, p, segments, drew: true };
}

/**
 * @template T
 * @param {T} o
 * @returns {T}
 */
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/**
 * The Shift Forecast: three cards (Up / Side / Down) with their odds, drawn before a Shift lands,
 * plus Accept (flip + apply), Reroll, Anchor and the per-creature presets. [RULES-SHIFT]
 *
 * Rules sources: wildshift-rules §2-§5, §17, §22.1; wildshift-creatures §6 (the Sloshkin table is
 * the worked example); ARCHITECTURE §5.4 and §9; GDD-00 (Freefall 30/30/40, `lit.steadied`,
 * `lit.keepersAnchor`, Workshop type tilt ×2).
 *
 * **Seeded stream.** Every random decision of a Forecast draws from the creature's own stateless
 * Shift stream: `forkFor(run.seed, 'shift:' + uid).fork(shiftCount)` ({@link shiftStream}, the
 * GDD-00 `shift:<uid>:<n>`). `creature.shiftCount` counts the draws consumed: showing a Forecast
 * consumes nothing, a Reroll consumes one (the next Forecast shows draw n+1), and resolving the
 * window (Accept or Anchor) consumes one so the next window starts on a fresh draw. Same seed + same
 * choices = same cards, picked card and Star-touched slot. Each draw takes exactly {@link DRAWS}
 * uniforms in a fixed slot order, so adding a rule never reshuffles another slot.
 *
 * **Odds** (whole percent, summing to 100): the dial's base odds; Bond moves `BOND_STEP` points per
 * pip from Down to Up, capped per dial and never taking Down below the dial floor; the optional
 * steadied rule then moves `STEADY_POINTS` Down to Side; an Errant's Down card is 0% on the dials in
 * `ERRANT_ZERO_DOWN` (its points spread to Up and Side in proportion); a card with an empty pool is
 * 0% the same way. The picked card is decided when the cards are drawn (the flip is theatre; no
 * input timing anywhere).
 *
 * **Pools.** The family's Shift table row for the current form: `{up, side, down}` lists of
 * `{form, w}` where `w` is a number (every dial) or `{drift, flux, freefall}`. Forms that do not
 * exist or are flagged `neverOnForecast` never reach a card. On a flat dial (POOL_FLAT_DIALS, or the
 * dial rules' `poolWeights: 'flat'`) every positive weight becomes the card's mean. The current form's
 * row drops out and its weight spreads across its card in proportion; each form already in the
 * Shiftlog gets `SHIFTLOG_PULL` weight on its card; a held type tilt multiplies the weight of forms
 * of that type by `TILT_WEIGHT_MULT` and (with `TILT_GUARANTEE`) makes sure at least one card keeps
 * that type. Star-touched: with `STAR_CHANCE` per Forecast, outside every weight rule, the family's
 * star form takes the `STAR_CARD` slot at that card's odds.
 *
 * A held Still Knot blocks the Forecast and the Shift (rules §4.8). The Rerolls taken in the current
 * Shift live in `world.counters['sys.rerolls.<uid>']` (through `systems/flags`), so a reload keeps
 * the escalated cost; Accept and Anchor reset it. Dial data (`opts.rules`: `rerollCostMult`,
 * `anchorsAllowed`, `poolWeights`) wins over the matching tuning.
 *
 * World writes: `creature.shiftCount` and the Shift itself (through `systems/creature.shiftTo`),
 * `pendingShifts` / `windowsUsed` (through `systems/exp.resolveWindow` / `refreshPending`), the
 * wallet (through `systems/wallet.spend`), the Reroll count (through `systems/flags`), the Field Log
 * (through `systems/fieldLog`) and stats (through `systems/stats`). Callers run the mutating functions inside `store.tx`. Domain events go to
 * `opts.bus`: `shift:resolved {uid, from, to, dir, anchored, level, ...}`.
 *
 * No species, family, map or NPC is named here; content arrives as `data`. Pure: no DOM.
 * @module systems/forecast
 */

import { forkFor } from '../state/rngs.js';
import { dataLookup, openWindows, refreshPending, resolveWindow } from './exp.js';
import { shiftTo } from './creature.js';
import { findCreature } from './party.js';
import * as wallet from './wallet.js';
import * as fieldLog from './fieldLog.js';
import * as stats from './stats.js';
import * as flags from './flags.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Creature} Creature */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {'up'|'side'|'down'} Dir */
/** @typedef {{emit: (evt: string, payload: any) => any}} Bus */

/** Card order on screen and in every odds triple. */
export const DIRS = Object.freeze(/** @type {Dir[]} */ (['up', 'side', 'down']));

/** Label prefix of the per-creature Shift stream (§9). Architecture constant, not tuning. */
export const STREAM_PREFIX = 'shift:';

/** Uniforms drawn per Forecast draw, in this slot order (spare slots keep room for new rules). */
export const SLOT = Object.freeze({ star: 0, up: 1, side: 2, down: 3, pick: 4, tiltCard: 5, tiltForm: 6 });
/** Number of uniforms every Forecast draw consumes from its stream. */
export const DRAWS = 8;

/** Species flag of a form that never appears on a Forecast card (data contract with the species rows). */
export const NEVER_ON_FORECAST_FLAG = 'neverOnForecast';

/**
 * @typedef {Object} ForecastTuning
 * @property {Record<string, {up: number, side: number, down: number}>} CARD_ODDS   base odds per dial, whole percent summing to 100; its keys are the known dials
 * @property {number} BOND_STEP                         points moved Down -> Up per Bond pip
 * @property {Record<string, number>} BOND_CAP          max points Bond may move, per dial
 * @property {Record<string, number>} DOWN_FLOOR        Bond / steadying never take Down below this, per dial
 * @property {number} STEADY_POINTS                     `steadied` option: points moved Down -> Side after Bond
 * @property {number} STAR_CHANCE                       chance per Forecast that the star form takes STAR_CARD's slot
 * @property {Dir} STAR_CARD                            which card the star form replaces
 * @property {number} SHIFTLOG_PULL                     weight added on its card to each form already in the Shiftlog
 * @property {boolean} PULL_REVIVES_ZERO                true: the pull also applies to a form whose weight on this dial is 0
 * @property {string[]} POOL_FLAT_DIALS                 dials whose pool weights are flattened: every entry with a positive weight on the dial weighs the card's mean (rules §6.2 "Freefall flattens"; GDD-00 §8)
 * @property {string} ERRANT_FLAG                       species flag that marks an Errant form
 * @property {Record<string, boolean>} ERRANT_ZERO_DOWN per dial: an Errant's Down card shows (and is) 0%
 * @property {boolean} TILT_GUARANTEE                   a held type tilt guarantees at least one card of that type (when any pool has one)
 * @property {number} TILT_WEIGHT_MULT                  a held type tilt multiplies that type's forms' weight on every card
 * @property {string[]} SILHOUETTE_DIALS                dials on which unseen forms show as silhouettes and unread abilities as "?"
 * @property {boolean} SILHOUETTE_MARKS_SEEN            true: a silhouette card still marks its form Seen in the Field Log
 * @property {number} REROLL_BASE                       Starsalt for the first Reroll of one Shift
 * @property {number} REROLL_GROWTH                     each further Reroll of the same Shift costs × this
 * @property {Record<string, number>} REROLL_COST_MULT  per-dial multiplier on the Reroll cost
 * @property {number} REROLL_UNLOCK_BADGES              badges needed before Reroll is offered
 * @property {number} ANCHOR_COST                       anchor stones per Anchor
 * @property {Record<string, number>} ANCHOR_CHALLENGE_COST   challenge id -> stones per Anchor while it is active (highest wins)
 * @property {string[]} ANCHOR_DISABLED_CHALLENGES      challenge ids that disable Anchor
 * @property {boolean} AUTO_UP_STRICT                   auto-accept Up needs Up strictly above both others (false: ties count)
 */

/**
 * Designer-tunable defaults. [GDD values] Sources: rules §4.1 (Drift / Flux odds), GDD-00 (Freefall
 * 30/30/40, steadied 5, tilt ×2), §4.2 (Star 2%), §4.3 (Bond 5/pip, caps 5/15/10, Drift Down floor
 * 5%), creatures §6.3 (Shiftlog pull +5), §4.6 (Reroll 1, 2, 4, ... from the 1st Spire), §4.7 / §18.5
 * (Anchor 1 stone; Restless 2; Ride the Dice disables).
 * @type {Readonly<ForecastTuning>}
 */
export const DEFAULTS = deepFreeze({
  CARD_ODDS: {
    drift: { up: 50, side: 40, down: 10 },
    flux: { up: 40, side: 35, down: 25 },
    freefall: { up: 30, side: 30, down: 40 },
  },
  BOND_STEP: 5,
  BOND_CAP: { drift: 5, flux: 15, freefall: 10 },
  DOWN_FLOOR: { drift: 5, flux: 0, freefall: 0 },
  STEADY_POINTS: 5,
  STAR_CHANCE: 0.02,
  STAR_CARD: 'side',
  SHIFTLOG_PULL: 5,
  PULL_REVIVES_ZERO: false,
  POOL_FLAT_DIALS: ['freefall'],
  ERRANT_FLAG: 'errant',
  ERRANT_ZERO_DOWN: { drift: true, flux: true, freefall: false },
  TILT_GUARANTEE: true,
  TILT_WEIGHT_MULT: 2,
  SILHOUETTE_DIALS: ['freefall'],
  SILHOUETTE_MARKS_SEEN: false,
  REROLL_BASE: 1,
  REROLL_GROWTH: 2,
  REROLL_COST_MULT: { drift: 1, flux: 1, freefall: 1 },
  REROLL_UNLOCK_BADGES: 1,
  ANCHOR_COST: 1,
  ANCHOR_CHALLENGE_COST: { restless: 2 },
  ANCHOR_DISABLED_CHALLENGES: ['ride-the-dice'],
  AUTO_UP_STRICT: true,
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonNegInt = (v) => Number.isInteger(v) && v >= 0;
const nonNegNum = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const recordOf = (pred) => (v) => isObj(v) && Object.values(v).every(pred);
const strArray = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length > 0);
const isOddsRow = (r) => isObj(r) && DIRS.every((d) => nonNegInt(r[d])) && r.up + r.side + r.down === 100;

/** @type {Record<keyof ForecastTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  CARD_ODDS: [(v) => isObj(v) && Object.keys(v).length > 0 && Object.values(v).every(isOddsRow), '{dial: {up, side, down}} whole percents summing to 100'],
  BOND_STEP: [nonNegInt, 'integer >= 0'],
  BOND_CAP: [recordOf(nonNegInt), '{dial: integer >= 0}'],
  DOWN_FLOOR: [recordOf((x) => nonNegInt(x) && x <= 100), '{dial: integer 0..100}'],
  STEADY_POINTS: [nonNegInt, 'integer >= 0'],
  STAR_CHANCE: [(v) => nonNegNum(v) && v <= 1, 'probability 0..1'],
  STAR_CARD: [(v) => DIRS.includes(v), DIRS.join('|')],
  SHIFTLOG_PULL: [nonNegNum, 'number >= 0'],
  PULL_REVIVES_ZERO: [(v) => typeof v === 'boolean', 'boolean'],
  POOL_FLAT_DIALS: [strArray, 'dial id[]'],
  ERRANT_FLAG: [(v) => typeof v === 'string' && v.length > 0, 'non-empty string'],
  ERRANT_ZERO_DOWN: [recordOf((x) => typeof x === 'boolean'), '{dial: boolean}'],
  TILT_GUARANTEE: [(v) => typeof v === 'boolean', 'boolean'],
  TILT_WEIGHT_MULT: [nonNegNum, 'number >= 0'],
  SILHOUETTE_DIALS: [strArray, 'dial id[]'],
  SILHOUETTE_MARKS_SEEN: [(v) => typeof v === 'boolean', 'boolean'],
  REROLL_BASE: [nonNegInt, 'integer >= 0'],
  REROLL_GROWTH: [(v) => nonNegNum(v) && v >= 1, 'number >= 1'],
  REROLL_COST_MULT: [recordOf(nonNegNum), '{dial: number >= 0}'],
  REROLL_UNLOCK_BADGES: [nonNegInt, 'integer >= 0'],
  ANCHOR_COST: [nonNegInt, 'integer >= 0'],
  ANCHOR_CHALLENGE_COST: [recordOf(nonNegInt), '{challengeId: integer >= 0}'],
  ANCHOR_DISABLED_CHALLENGES: [strArray, 'challenge id[]'],
  AUTO_UP_STRICT: [(v) => typeof v === 'boolean', 'boolean'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** @type {WeakMap<object, Readonly<ForecastTuning>>} */
const TUNING_CACHE = new WeakMap();

/**
 * Resolves a partial tuning override over {@link DEFAULTS}. Keys of other modules are ignored, so
 * one combined tuning object can be passed to every system; a known key with a malformed value
 * throws. Results are cached per override object.
 * @param {Partial<ForecastTuning>|Record<string, any>|null|undefined} [tuning]
 * @returns {Readonly<ForecastTuning>}
 * @throws {TypeError} for a non-object or a malformed known key
 */
export function tuningOf(tuning) {
  if (tuning == null) return DEFAULTS;
  if (typeof tuning !== 'object') throw new TypeError('forecast.tuningOf: tuning must be an object');
  const hit = TUNING_CACHE.get(tuning);
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(tuning, key)) continue;
    const v = /** @type {any} */ (tuning)[key];
    const [pred, desc] = SPEC[/** @type {keyof ForecastTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`forecast tuning ${key}: expected ${desc}, got ${safeJson(v)}`);
    out[key] = v;
  }
  const frozen = deepFreeze(structuredClone(out));
  TUNING_CACHE.set(tuning, frozen);
  return frozen;
}

/**
 * Error with a stable `code` for refusals that are programming or content errors (stale cards,
 * a form that never Shifts, a missing Shift table). Expected player-facing refusals (not enough
 * Starsalt, no anchor stone) are `{ok: false, reason}` results instead.
 */
export class ForecastError extends Error {
  /**
   * @param {'NO_CREATURE'|'NEVER_SHIFTS'|'STILL_KNOT'|'NO_TABLE'|'EMPTY_POOL'|'STALE'|'BAD_CARD'|'ZERO_ODDS'|'BAD_DIAL'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'ForecastError';
    /** @type {string} */
    this.code = code;
  }
}

// ---------------------------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------------------------

/**
 * One Forecast card.
 * @typedef {Object} Card
 * @property {Dir} dir
 * @property {string|null} formId       null only for an empty card (no form in that pool; odds 0)
 * @property {number} odds              whole percent
 * @property {string[]} types           the candidate form's types
 * @property {number} statTotalDelta    base stat total after the Shift − now (the dial's stat floor applied)
 * @property {string|null} ability      ability id the form would bring (per-seed pick when the run has one)
 * @property {boolean} isWard           the ability is a Ward
 * @property {number} keepsMoves        current moves that stay ("Keeps n/movesTotal")
 * @property {number} movesTotal        current move count
 * @property {string[]} toMemory        move ids that would go to Memory
 * @property {boolean} isStarTouched
 * @property {boolean} silhouette       drawn as a silhouette (dial in SILHOUETTE_DIALS and form not Seen)
 * @property {boolean} abilityHidden    ability shows "?" (dial in SILHOUETTE_DIALS and form not Read)
 * @property {boolean} seen  @property {boolean} read   Field Log state before this Forecast
 * @property {boolean} empty
 * @property {string} from              the creature's form when drawn (stale-card guard)
 * @property {number} draw              the stream draw index (creature.shiftCount when drawn)
 */

/**
 * @typedef {Object} Forecast
 * @property {string} uid  @property {string} formId   the creature's current form
 * @property {string} dial
 * @property {number} draw                  stream draw index this Forecast shows
 * @property {[Card, Card, Card]} cards     up, side, down
 * @property {{up: number, side: number, down: number}} odds
 * @property {0|1|2} picked                 the card Accept will land on (decided at draw time)
 * @property {number} roll                  the uniform in [0, 1) that decided `picked`
 * @property {number} bondTilt              points Bond moved Down -> Up
 * @property {number} steadied              points the steadied rule moved Down -> Side
 * @property {boolean} errant               the Errant rule zeroed the Down card
 * @property {string|null} starTouched      the star form when it took its slot this draw
 * @property {{type: string, applied: boolean}|null} tilt   held type tilt; `applied`: the guarantee replaced a card
 * @property {string|null} heartmark        the Heartmark technique (kept in every form)
 * @property {number} rerolls               Rerolls already taken in this Shift
 * @property {number} rerollCost            Starsalt the next Reroll costs
 * @property {boolean} canReroll  @property {'locked'|'starsalt'|null} rerollReason
 * @property {boolean} canAnchor  @property {number} anchorCost  @property {'disabled'|'no-stones'|'no-window'|null} anchorReason
 * @property {'auto-anchor'|'auto-up'|null} preset   the creature's preset (settings.autoAnchor)
 */

/**
 * @typedef {Object} ForecastOpts
 * @property {string} [dial]                 defaults to world.run.dial
 * @property {Record<string, any>|null} [tuning]   one combined override (forecast + creature + exp + wallet keys)
 * @property {Rng} [stream]                  use this positioned stream instead of {@link shiftStream}
 * @property {string|null} [tilt]            held type tilt (type name); default: the held item row's `tilt`
 * @property {boolean} [errant]              override the Errant flag of the current form
 * @property {boolean} [steadied]            the GDD-00 `lit.steadied` rule is on
 * @property {number} [rerolls]              Rerolls already taken in this Shift (default 0)
 * @property {boolean} [freeAnchor]          the next Anchor costs nothing (GDD-00 `lit.keepersAnchor`)
 * @property {string[]} [challenges]         defaults to world.run.challenges
 * @property {DialRuleOpts|null} [rules]     the dial's data rules (data/dials `rules` and/or `shift` row); they win over tuning
 * @property {Bus|null} [bus]
 */

/**
 * The dial-data keys this module reads (ARCHITECTURE §5.4: "the cost table is dial data"). Any may be
 * missing; a present key wins over the matching tuning value.
 * @typedef {Object} DialRuleOpts
 * @property {number} [rerollCostMult]          multiplier on the Reroll cost (over REROLL_COST_MULT[dial])
 * @property {boolean} [anchorsAllowed]         false: Anchor is not offered on this dial
 * @property {'source'|'flat'} [poolWeights]    'flat' flattens the pool weights (over POOL_FLAT_DIALS)
 */

// ---------------------------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------------------------

/**
 * The stateless Shift stream for a creature's draw `n`: `forkFor(seed, 'shift:' + uid).fork(n)`.
 * Equal inputs always give an equal stream.
 * @param {number} seed   world.run.seed
 * @param {string} uid
 * @param {number} n      draw index (creature.shiftCount)
 * @returns {Rng}
 * @throws {TypeError} for a bad seed, uid or index
 */
export function streamFor(seed, uid, n) {
  if (!Number.isInteger(seed) || seed < 0) throw new TypeError(`forecast.streamFor: seed must be a non-negative integer, got ${String(seed)}`);
  if (typeof uid !== 'string' || !uid) throw new TypeError('forecast.streamFor: uid must be a non-empty string');
  if (!nonNegInt(n)) throw new TypeError(`forecast.streamFor: n must be an integer >= 0, got ${String(n)}`);
  return forkFor(seed, STREAM_PREFIX + uid).fork(n);
}

/**
 * The creature's Shift stream positioned at its current draw (`creature.shiftCount`).
 * @param {World} world
 * @param {Creature} c
 * @returns {Rng}
 */
export function shiftStream(world, c) {
  return streamFor(world.run.seed, c.uid, c.shiftCount);
}

/**
 * Takes the {@link DRAWS} uniforms of one Forecast draw.
 * @param {Rng} rng
 * @returns {number[]}
 */
function takeDraws(rng) {
  const u = new Array(DRAWS);
  for (let i = 0; i < DRAWS; i++) u[i] = rng.next();
  return u;
}

// ---------------------------------------------------------------------------------------------
// Odds
// ---------------------------------------------------------------------------------------------

/**
 * @param {Readonly<ForecastTuning>} t
 * @param {string} dial
 */
function assertDial(t, dial) {
  if (typeof dial !== 'string' || !Object.prototype.hasOwnProperty.call(t.CARD_ODDS, dial)) {
    throw new ForecastError('BAD_DIAL', `forecast: unknown dial ${safeJson(dial)} (known: ${Object.keys(t.CARD_ODDS).join(', ')})`);
  }
}

/**
 * Zeroes the cards in `zero` and spreads their points over the others in proportion to their odds
 * (equally when all others are 0), by largest remainder so the result stays whole and sums to 100.
 * Ties go to the earlier card (Up, then Side).
 * @param {number[]} odds   [up, side, down]
 * @param {Set<number>} zero
 * @returns {number[]}
 */
export function redistribute(odds, zero) {
  const out = odds.slice();
  let freed = 0;
  for (const i of zero) { freed += out[i]; out[i] = 0; }
  const recv = [0, 1, 2].filter((i) => !zero.has(i));
  if (freed === 0 || recv.length === 0) return out;
  const total = recv.reduce((a, i) => a + out[i], 0);
  const weights = recv.map((i) => (total > 0 ? out[i] : 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (freed * w) / wsum);
  const floors = exact.map(Math.floor);
  let left = freed - floors.reduce((a, b) => a + b, 0);
  const order = recv.map((_, k) => k).sort((a, b) => (exact[b] - floors[b]) - (exact[a] - floors[a]) || a - b);
  for (const k of order) {
    if (left <= 0) break;
    floors[k] += 1;
    left -= 1;
  }
  recv.forEach((i, k) => { out[i] += floors[k]; });
  return out;
}

/**
 * Card odds for a dial (rules §4.1, §4.3, §5.5; GDD-00 steadied).
 * @param {string} dial
 * @param {{bond?: number, errant?: boolean, steadied?: boolean, empty?: Dir[]}} [state]
 * @param {{tuning?: Record<string, any>|null}} [opts]
 * @returns {{up: number, side: number, down: number, bondTilt: number, steadied: number, errant: boolean}}
 * @throws {ForecastError} BAD_DIAL
 */
export function cardOdds(dial, state = {}, opts = {}) {
  const t = tuningOf(opts.tuning);
  assertDial(t, dial);
  const base = t.CARD_ODDS[dial];
  let up = base.up;
  let side = base.side;
  let down = base.down;
  const floor = t.DOWN_FLOOR[dial] ?? 0;
  const pips = Math.max(0, Math.floor(Number(state.bond) || 0));
  const bondTilt = Math.max(0, Math.min(pips * t.BOND_STEP, t.BOND_CAP[dial] ?? 0, down - floor));
  up += bondTilt;
  down -= bondTilt;
  let steadied = 0;
  if (state.steadied) {
    steadied = Math.max(0, Math.min(t.STEADY_POINTS, down - floor));
    side += steadied;
    down -= steadied;
  }
  let odds = [up, side, down];
  const zero = new Set();
  const errant = !!state.errant && t.ERRANT_ZERO_DOWN[dial] === true;
  if (errant) zero.add(2);
  for (const d of state.empty || []) zero.add(DIRS.indexOf(d));
  zero.delete(-1);
  if (zero.size) odds = redistribute(odds, zero);
  return { up: odds[0], side: odds[1], down: odds[2], bondTilt, steadied, errant };
}

/**
 * Index of the card a uniform lands on, by the whole-percent odds (0% cards never land).
 * @param {number[]|{up: number, side: number, down: number}} odds
 * @param {number} u   uniform in [0, 1)
 * @returns {0|1|2}
 */
export function pickIndex(odds, u) {
  const arr = Array.isArray(odds) ? odds : [odds.up, odds.side, odds.down];
  const total = arr.reduce((a, b) => a + Math.max(0, b), 0);
  const r = u * total;
  let cum = 0;
  let last = 0;
  for (let i = 0; i < 3; i++) {
    if (!(arr[i] > 0)) continue;
    last = i;
    cum += arr[i];
    if (r < cum) return /** @type {0|1|2} */ (i);
  }
  return /** @type {0|1|2} */ (last);
}

// ---------------------------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------------------------

/**
 * Weight of one pool entry on a dial: `w` (number, or `{dial: number}`) or a prototype-style
 * `weights: {dial: number}`.
 * @param {any} e
 * @param {string} dial
 * @returns {number}
 */
function weightOn(e, dial) {
  let w = 0;
  if (typeof e.w === 'number') w = e.w;
  else if (isObj(e.w)) w = e.w[dial] ?? 0;
  else if (e.w !== undefined && e.w !== null) w = e.w; // malformed: reported below
  else if (isObj(e.weights)) w = e.weights[dial] ?? 0;
  if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
    throw new TypeError(`forecast: pool weight of ${safeJson(e.form)} on ${dial} must be a finite number >= 0, got ${safeJson(w)}`);
  }
  return w;
}

/**
 * The weighted pool of one card for a creature (creatures §6.3): flattens the weights on a flat dial
 * (every entry with a positive weight takes the card's mean, so 0 still means "never on this dial"),
 * drops the current form and spreads its weight across the card in proportion, adds the Shiftlog
 * pull, applies the type tilt multiplier. Duplicate forms merge. Only entries with a positive weight
 * are returned.
 * @param {ReadonlyArray<any>|null|undefined} entries   `{form, w}` rows of one direction
 * @param {string} dial
 * @param {{speciesId: string, shiftlog?: string[]}} c
 * @param {{tuning?: Record<string, any>|null, tilt?: string|null, typesOf?: (formId: string) => string[], flat?: boolean, rules?: DialRuleOpts|null, allow?: (formId: string) => boolean}} [opts]
 *   `flat` forces flattening on or off (default: dial rules `poolWeights`, then POOL_FLAT_DIALS);
 *   `allow` drops entries it rejects before any weight rule (unknown forms, `neverOnForecast`)
 * @returns {Array<{form: string, w: number}>}
 */
export function cardPool(entries, dial, c, opts = {}) {
  const t = tuningOf(opts.tuning);
  /** @type {Map<string, number>} */
  const merged = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || typeof e.form !== 'string' || !e.form) continue;
    if (opts.allow && !opts.allow(e.form)) continue;
    merged.set(e.form, (merged.get(e.form) ?? 0) + weightOn(e, dial));
  }
  const flat = typeof opts.flat === 'boolean' ? opts.flat : flatOn(t, dial, opts);
  if (flat) {
    const live = [...merged.values()].filter((w) => w > 0);
    const mean = live.length ? live.reduce((a, b) => a + b, 0) / live.length : 0;
    for (const [form, w] of merged) merged.set(form, w > 0 ? mean : 0);
  }
  const total = [...merged.values()].reduce((a, b) => a + b, 0);
  const wc = merged.get(c.speciesId) ?? 0;
  merged.delete(c.speciesId);
  const scale = wc > 0 && total - wc > 0 ? total / (total - wc) : 1;
  const held = new Set(Array.isArray(c.shiftlog) ? c.shiftlog : []);
  const out = [];
  for (const [form, w0] of merged) {
    let w = w0 * scale;
    if (held.has(form) && (w0 > 0 || t.PULL_REVIVES_ZERO)) w += t.SHIFTLOG_PULL;
    if (opts.tilt && t.TILT_WEIGHT_MULT !== 1 && opts.typesOf && opts.typesOf(form).includes(opts.tilt)) w *= t.TILT_WEIGHT_MULT;
    if (w > 0) out.push({ form, w });
  }
  return out;
}

/**
 * Weighted choice from one uniform (no rng call, so the slot always costs exactly one draw).
 * @param {Array<{form: string, w: number}>} pool
 * @param {number} u
 * @returns {string|null}
 */
function pickForm(pool, u) {
  const total = pool.reduce((a, e) => a + e.w, 0);
  if (!(total > 0)) return null;
  let r = u * total;
  for (const e of pool) {
    r -= e.w;
    if (r < 0) return e.form;
  }
  return pool[pool.length - 1].form;
}

/**
 * Finds the Shift table row for the creature's current form: the individual's family first, then the
 * current form's own family.
 * @param {ReturnType<typeof dataLookup>} look
 * @param {Creature} c
 * @param {{familyId: string}} cur
 * @returns {{row: {up?: any[], side?: any[], down?: any[]}|null, star: string|null}}
 */
function tableFor(look, c, cur) {
  const own = c.familyId ? look.familyOrNull(c.familyId) : null;
  const formFam = cur.familyId && cur.familyId !== c.familyId ? look.familyOrNull(cur.familyId) : null;
  const starOf = (f) => (f ? (typeof f.star === 'string' ? f.star : (f.starTouched && typeof f.starTouched.form === 'string' ? f.starTouched.form : null)) : null);
  for (const fam of [own, formFam]) {
    const row = fam && isObj(fam.shiftTable) ? fam.shiftTable[c.speciesId] : null;
    if (isObj(row)) return { row, star: starOf(own) ?? starOf(fam) };
  }
  return { row: null, star: starOf(own) };
}

/**
 * The ability a form brings in this run: the per-seed Ward placement, else the per-seed ability
 * pick, else the species row's ability.
 * @param {World} world
 * @param {string} formId
 * @param {{ability: string}} sp
 * @returns {string}
 */
export function abilityFor(world, formId, sp) {
  const gen = world?.run?.gen;
  return gen?.wards?.[formId] ?? gen?.abilities?.[formId] ?? sp.ability;
}

/**
 * Exact preview of a Shift on a throwaway copy (stat floor, kept moves, Memory): the same code path
 * as the real Shift, so the card never disagrees with the outcome.
 * @param {Creature} c
 * @param {string} formId
 * @param {any} data
 * @param {string} dial
 * @param {Record<string, any>|null|undefined} tuning
 */
function preview(c, formId, data, dial, tuning) {
  const copy = JSON.parse(JSON.stringify(c));
  return shiftTo(copy, formId, data, dial, { tuning });
}

/**
 * The held type tilt for a creature: `opts.tilt` when given (null = none), else the `tilt` field of
 * its held item's row.
 * @param {Creature} c
 * @param {ReturnType<typeof dataLookup>} look
 * @param {ForecastOpts} opts
 * @returns {string|null}
 */
function tiltOf(c, look, opts) {
  if (opts.tilt !== undefined) return typeof opts.tilt === 'string' && opts.tilt ? opts.tilt : null;
  if (!c.heldItem) return null;
  const row = look.itemOrNull(c.heldItem);
  return row && typeof row.tilt === 'string' && row.tilt ? row.tilt : null;
}

/**
 * The dial rules in `opts.rules` (null when absent or not an object).
 * @param {{rules?: any}} opts
 * @returns {DialRuleOpts|null}
 */
function rulesOf(opts) {
  return isObj(opts.rules) ? opts.rules : null;
}

/**
 * Whether the pool weights are flattened on this dial (dial rules first, then POOL_FLAT_DIALS).
 * @param {Readonly<ForecastTuning>} t
 * @param {string} dial
 * @param {{rules?: any}} opts
 * @returns {boolean}
 */
function flatOn(t, dial, opts) {
  const pw = rulesOf(opts)?.poolWeights;
  if (pw === 'flat') return true;
  if (pw === 'source') return false;
  return t.POOL_FLAT_DIALS.includes(dial);
}

/**
 * @param {World} world
 * @param {Creature|string} creature
 * @returns {Creature}
 */
function creatureOf(world, creature) {
  if (typeof creature === 'string') {
    const hit = findCreature(world, creature);
    if (!hit) throw new ForecastError('NO_CREATURE', `forecast: no creature ${safeJson(creature)} in the party or box`);
    return hit.c;
  }
  if (!creature || typeof creature !== 'object' || typeof creature.uid !== 'string') throw new ForecastError('NO_CREATURE', 'forecast: creature must be a Creature or a uid');
  return creature;
}

// ---------------------------------------------------------------------------------------------
// Rolling
// ---------------------------------------------------------------------------------------------

/**
 * Whether a Forecast can be drawn for this creature now (and why not).
 * @param {World} world
 * @param {Creature|string} creature
 * @param {any} data
 * @param {ForecastOpts} [opts]
 * @returns {{ok: true} | {ok: false, reason: 'no-creature'|'still-knot'|'never-shifts'|'no-table'|'empty-pool'|'bad-dial'}}
 */
export function canForecast(world, creature, data, opts = {}) {
  let c;
  try { c = creatureOf(world, creature); } catch { return { ok: false, reason: 'no-creature' }; }
  if (c.stillKnot) return { ok: false, reason: 'still-knot' };
  try {
    rollForecast(world, c, data, opts);
    return { ok: true };
  } catch (err) {
    if (err instanceof ForecastError) {
      const map = { STILL_KNOT: 'still-knot', NEVER_SHIFTS: 'never-shifts', NO_TABLE: 'no-table', EMPTY_POOL: 'empty-pool', BAD_DIAL: 'bad-dial' };
      const reason = /** @type {any} */ (map)[err.code];
      if (reason) return { ok: false, reason };
    }
    throw err;
  }
}

/**
 * Draws the Forecast for a creature from its Shift stream at `creature.shiftCount` (§5.4, §9).
 * Reads only; nothing in the world changes and no draw is consumed (Reroll / Accept / Anchor do that).
 * @param {World} world
 * @param {Creature|string} creature   a world creature (or its uid)
 * @param {any} data                   Registry or tables `{species, abilities, families, items, moves}`
 * @param {ForecastOpts} [opts]
 * @returns {Forecast}
 * @throws {ForecastError} NO_CREATURE, BAD_DIAL, STILL_KNOT (a Still Knot is held, rules §4.8), NEVER_SHIFTS (form flagged `neverShifts`), NO_TABLE (no Shift table row for the current form), EMPTY_POOL (all three pools empty, or no card can land)
 */
export function rollForecast(world, creature, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const c = creatureOf(world, creature);
  const dial = opts.dial ?? world.run.dial;
  assertDial(t, dial);
  if (c.stillKnot) throw new ForecastError('STILL_KNOT', `forecast: ${c.uid} holds a Still Knot; it never Shifts while held`);
  const look = dataLookup(data);
  const cur = look.species(c.speciesId);
  if (cur.flags.neverShifts) throw new ForecastError('NEVER_SHIFTS', `forecast: form ${safeJson(cur.id)} never Shifts`);
  const { row, star } = tableFor(look, c, cur);
  if (!row) throw new ForecastError('NO_TABLE', `forecast: no Shift table row for form ${safeJson(cur.id)}`);

  const u = takeDraws(opts.stream ?? shiftStream(world, c));
  const tilt = tiltOf(c, look, opts);
  const typesOf = (id) => look.speciesOrNull(id)?.types ?? [];
  // a form can appear on a card only when it exists and is not flagged `neverOnForecast` (GDD-00: the comet form)
  const allow = (id) => {
    const sp = look.speciesOrNull(id);
    return !!sp && !sp.flags[NEVER_ON_FORECAST_FLAG];
  };
  const flat = flatOn(t, dial, opts);
  const pools = DIRS.map((d) => cardPool(row[d], dial, c, { tuning: opts.tuning, tilt, typesOf, flat, allow }));

  const starForm = star && star !== c.speciesId && allow(star) && u[SLOT.star] < t.STAR_CHANCE ? star : null;
  const starIdx = DIRS.indexOf(t.STAR_CARD);
  /** @type {(string|null)[]} */
  const forms = DIRS.map((d, i) => (starForm && i === starIdx ? starForm : pickForm(pools[i], u[SLOT[d]])));

  let tiltApplied = false;
  if (tilt && t.TILT_GUARANTEE && !forms.some((f) => f && typesOf(f).includes(tilt))) {
    const eligible = [0, 1, 2].filter((i) => !(starForm && i === starIdx) && pools[i].some((e) => typesOf(e.form).includes(tilt)));
    if (eligible.length) {
      const i = eligible[Math.min(eligible.length - 1, Math.floor(u[SLOT.tiltCard] * eligible.length))];
      forms[i] = pickForm(pools[i].filter((e) => typesOf(e.form).includes(tilt)), u[SLOT.tiltForm]);
      tiltApplied = true;
    }
  }

  if (forms.every((f) => f === null)) throw new ForecastError('EMPTY_POOL', `forecast: every pool is empty for form ${safeJson(cur.id)}`);
  const errantFlag = opts.errant !== undefined ? !!opts.errant : !!cur.flags[t.ERRANT_FLAG];
  const o = cardOdds(dial, {
    bond: c.bond, errant: errantFlag, steadied: !!opts.steadied,
    empty: DIRS.filter((_, i) => forms[i] === null),
  }, opts);
  const odds = [o.up, o.side, o.down];
  if (!odds.some((x) => x > 0)) throw new ForecastError('EMPTY_POOL', `forecast: no card can land for form ${safeJson(cur.id)} on ${dial}`);

  const silhouetteDial = t.SILHOUETTE_DIALS.includes(dial);
  const logOf = (id) => world.fieldLog?.forms?.[id] ?? null;
  const cards = /** @type {[Card, Card, Card]} */ (DIRS.map((dir, i) => {
    const formId = forms[i];
    const base = { dir, from: c.speciesId, draw: c.shiftCount, movesTotal: c.moves.length };
    if (formId === null) {
      return {
        ...base, formId: null, odds: odds[i], types: [], statTotalDelta: 0, ability: null, isWard: false, keepsMoves: 0, toMemory: [],
        isStarTouched: false, silhouette: false, abilityHidden: false, seen: false, read: false, empty: true,
      };
    }
    const sp = look.species(formId);
    const pv = preview(c, formId, data, dial, opts.tuning);
    const ability = abilityFor(world, formId, sp);
    const abilityRow = look.abilityOrNull(ability);
    const log = logOf(formId);
    const seen = !!log?.seen;
    const read = !!log?.read;
    return {
      ...base, formId, odds: odds[i], types: sp.types.slice(), statTotalDelta: pv.statDelta, ability,
      isWard: !!(abilityRow && abilityRow.ward), keepsMoves: pv.kept.length, toMemory: pv.toMemory.slice(),
      isStarTouched: formId === starForm || !!sp.flags.starTouched,
      silhouette: silhouetteDial && !seen, abilityHidden: silhouetteDial && !read, seen, read, empty: false,
    };
  }));

  const rerolls = nonNegInt(opts.rerolls) ? opts.rerolls : rerollsTaken(world, c.uid);
  const cost = rerollCost(rerolls, { dial, tuning: opts.tuning, rules: rulesOf(opts) });
  const rs = rerollStatus(world, cost, opts);
  const as = anchorStatus(world, c, data, opts);
  const preset = world.settings?.autoAnchor?.[c.uid] ?? null;
  return {
    uid: c.uid, formId: c.speciesId, dial, draw: c.shiftCount, cards,
    odds: { up: o.up, side: o.side, down: o.down },
    picked: pickIndex(odds, u[SLOT.pick]), roll: u[SLOT.pick],
    bondTilt: o.bondTilt, steadied: o.steadied, errant: o.errant,
    starTouched: starForm, tilt: tilt ? { type: tilt, applied: tiltApplied } : null,
    heartmark: c.heartmark ?? null,
    rerolls, rerollCost: cost, canReroll: rs.can, rerollReason: rs.reason,
    canAnchor: as.can, anchorCost: as.cost, anchorReason: as.reason,
    preset: preset === 'auto-anchor' || preset === 'auto-up' ? preset : null,
  };
}

/**
 * Reveals the card a Forecast lands on (rules §3.4: decided by the odds, nothing reads input
 * timing). Without an rng the outcome is the one drawn from the Shift stream with the cards
 * (`forecast.picked`), so a seed reproduces it; with an rng one uniform is drawn from it instead.
 * @param {Forecast} forecast
 * @param {Rng|null} [rng]
 * @returns {{index: 0|1|2, card: Card}}
 * @throws {ForecastError} BAD_CARD when every card is 0%
 */
export function flip(forecast, rng = null) {
  const odds = forecast.cards.map((cd) => cd.odds);
  if (!odds.some((x) => x > 0)) throw new ForecastError('BAD_CARD', 'forecast.flip: every card is 0%');
  const index = rng ? pickIndex(odds, rng.next()) : forecast.picked;
  return { index, card: forecast.cards[index] };
}

// ---------------------------------------------------------------------------------------------
// Reroll
// ---------------------------------------------------------------------------------------------

/** Counter-id prefix holding the Rerolls taken in a creature's current Shift (saved with the world). */
export const REROLL_COUNTER_PREFIX = 'sys.rerolls.';

/**
 * Rerolls already taken in the creature's current Shift (window): kept in `world.counters` through
 * `systems/flags`, so a reload mid-Forecast keeps the escalated cost. Reset when the window resolves.
 * @param {World} world
 * @param {string} uid
 * @returns {number}
 */
export function rerollsTaken(world, uid) {
  const n = flags.get(world, REROLL_COUNTER_PREFIX + uid);
  return nonNegInt(n) ? n : 0;
}

/**
 * Clears the Reroll count when a Shift resolves (no counter key is created when it is already 0).
 * @param {World} world
 * @param {string} uid
 * @param {Bus|null} bus
 */
function resetRerolls(world, uid, bus) {
  if (flags.get(world, REROLL_COUNTER_PREFIX + uid) !== 0) flags.set(world, REROLL_COUNTER_PREFIX + uid, 0, { bus });
}

/**
 * Starsalt for the Reroll after `n` Rerolls in the same Shift: REROLL_BASE × REROLL_GROWTH^n × the
 * dial multiplier (dial rules `rerollCostMult`, else REROLL_COST_MULT[dial]), rounded up (1, 2, 4,
 * 8, ... by default; no cap; saturates at Number.MAX_SAFE_INTEGER).
 * @param {number} n   Rerolls already taken in this Shift
 * @param {{dial?: string, tuning?: Record<string, any>|null, rules?: DialRuleOpts|null}} [opts]
 * @returns {number}
 * @throws {TypeError} for a negative / non-integer n
 */
export function rerollCost(n, opts = {}) {
  if (!nonNegInt(n)) throw new TypeError(`forecast.rerollCost: n must be an integer >= 0, got ${String(n)}`);
  const t = tuningOf(opts.tuning);
  const rm = rulesOf(opts)?.rerollCostMult;
  const mult = nonNegNum(rm) ? rm : opts.dial !== undefined ? (t.REROLL_COST_MULT[opts.dial] ?? 1) : 1;
  const cost = Math.ceil(t.REROLL_BASE * t.REROLL_GROWTH ** n * mult - 1e-9);
  return Number.isSafeInteger(cost) ? cost : Number.MAX_SAFE_INTEGER;
}

/**
 * @param {World} world
 * @param {number} cost
 * @param {ForecastOpts} opts
 * @returns {{can: boolean, reason: 'locked'|'starsalt'|null}}
 */
function rerollStatus(world, cost, opts) {
  const t = tuningOf(opts.tuning);
  if ((world.badges?.length ?? 0) < t.REROLL_UNLOCK_BADGES) return { can: false, reason: 'locked' };
  if (!wallet.canAfford(world, cost, 'starsalt')) return { can: false, reason: 'starsalt' };
  return { can: true, reason: null };
}

/**
 * @param {Creature} c
 * @param {Forecast} forecast
 */
function assertFresh(c, forecast) {
  if (!forecast || forecast.uid !== c.uid || forecast.draw !== c.shiftCount || forecast.formId !== c.speciesId) {
    throw new ForecastError('STALE', `forecast: this Forecast no longer matches ${c.uid} (draw ${forecast?.draw} vs ${c.shiftCount})`);
  }
}

/**
 * Rerolls a Forecast (rules §4.6): spends the escalating Starsalt cost, consumes one stream draw
 * (`shiftCount + 1`) and returns the redrawn Forecast. Refusals change nothing.
 * @param {World} world
 * @param {string} uid
 * @param {Forecast} forecast    the Forecast on screen (must be the creature's current draw)
 * @param {any} data
 * @param {ForecastOpts} [opts]
 * @returns {{ok: true, spent: number, forecast: Forecast} | {ok: false, reason: 'locked'|'starsalt', cost: number}}
 * @throws {ForecastError} NO_CREATURE, STALE
 */
export function reroll(world, uid, forecast, data, opts = {}) {
  const c = creatureOf(world, uid);
  assertFresh(c, forecast);
  const cost = rerollCost(forecast.rerolls, { dial: forecast.dial, tuning: opts.tuning, rules: rulesOf(opts) });
  const st = rerollStatus(world, cost, opts);
  if (!st.can) return { ok: false, reason: /** @type {'locked'|'starsalt'} */ (st.reason), cost };
  const nextOpts = { ...opts, stream: undefined, dial: forecast.dial, rerolls: forecast.rerolls + 1 };
  // Draw the next Forecast before paying, so a content error (or a Still Knot put on since) changes nothing.
  c.shiftCount += 1;
  try {
    rollForecast(world, c, data, nextOpts);
  } catch (err) {
    c.shiftCount -= 1;
    throw err;
  }
  const paid = wallet.spend(world, cost, { currency: 'starsalt', bus: opts.bus ?? null, source: 'reroll' });
  if (!paid.ok) {
    c.shiftCount -= 1;
    return { ok: false, reason: 'starsalt', cost };
  }
  flags.set(world, REROLL_COUNTER_PREFIX + c.uid, forecast.rerolls + 1, { bus: opts.bus ?? null });
  stats.inc(world, 'rerolls', 1, { bus: opts.bus ?? null });
  // drawn again after paying so canReroll / rerollCost reflect the new balance
  const next = rollForecast(world, c, data, nextOpts);
  return { ok: true, spent: cost, forecast: next };
}

// ---------------------------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} ShiftApplied
 * @property {string} uid  @property {string} from  @property {string} to  @property {Dir|null} dir
 * @property {string[]} kept  @property {string[]} toMemory  @property {number} statDelta  @property {string[]} floored
 * @property {number|null} level   the window resolved (null when none was open or `consumeWindow` is false)
 * @property {boolean} starTouched  @property {boolean} firstHeld   first time this form is Held
 */

/**
 * Applies a Shift (rules §2.6, §3.4, §5.3): the window consumed (`exp.resolveWindow`, read on the
 * form the window opened on, before the Shift), `systems/creature.shiftTo` (stat floor, Memory,
 * Shiftlog append), the run's per-seed ability for the new form, `shiftCount + 1`, `pendingShifts`
 * refreshed for the new form, the Reroll count reset, Field Log Held, `stats.forecasts`, then emits
 * `shift:resolved`. The Shift is tried on a copy first, so a refusal changes nothing.
 * @param {World} world
 * @param {string} uid
 * @param {Card|string} card   a card of the creature's current Forecast (checked against its draw), or a bare form id (scripts, tests)
 * @param {any} data
 * @param {ForecastOpts & {heartmark?: string, rng?: Rng|null, consumeWindow?: boolean}} [opts]   `heartmark` pins the technique at the first Shift; `rng` seeds an Unfixed loop
 * @returns {ShiftApplied}
 * @throws {ForecastError} NO_CREATURE, STILL_KNOT, BAD_CARD (empty card / missing form), STALE (card from another draw or form), ZERO_ODDS (a 0% card never lands), BAD_DIAL; {Error} from shiftTo
 */
export function applyShift(world, uid, card, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const c = creatureOf(world, uid);
  const dial = opts.dial ?? world.run.dial;
  assertDial(t, dial);
  /** @type {string} */
  let formId;
  /** @type {Dir|null} */
  let dir = null;
  let starTouched = false;
  if (typeof card === 'string') {
    formId = card;
  } else {
    if (!card || card.empty || typeof card.formId !== 'string') throw new ForecastError('BAD_CARD', 'forecast.applyShift: the card has no form');
    if (card.from !== c.speciesId || card.draw !== c.shiftCount) throw new ForecastError('STALE', `forecast.applyShift: the card is from another draw of ${c.uid}`);
    if (!(card.odds > 0)) throw new ForecastError('ZERO_ODDS', 'forecast.applyShift: a 0% card never lands');
    formId = card.formId;
    dir = card.dir;
    starTouched = !!card.isStarTouched;
  }
  if (c.stillKnot) throw new ForecastError('STILL_KNOT', `forecast.applyShift: ${c.uid} holds a Still Knot; it never Shifts while held`);
  const look = dataLookup(data);
  const shiftOpts = { tuning: opts.tuning, heartmark: opts.heartmark, rng: opts.rng ?? null };
  // dry run on a copy: throws (unknown form, a form that never Shifts, a bad Heartmark pin) before any write
  // (no rng: an rng that cannot fork would otherwise lose draws to the dry run)
  shiftTo(JSON.parse(JSON.stringify(c)), formId, data, dial, { ...shiftOpts, rng: null });
  const bus = opts.bus ?? null;
  const level = opts.consumeWindow === false ? null : resolveWindow(world, c.uid, data, { tuning: opts.tuning, bus });
  const res = shiftTo(c, formId, data, dial, shiftOpts);
  c.ability = abilityFor(world, formId, look.species(formId));
  c.shiftCount += 1;
  refreshPending(world, c.uid, data, { tuning: opts.tuning });
  resetRerolls(world, c.uid, bus);
  const held = fieldLog.markHeld(world, formId, { bus: opts.bus ?? null, data });
  stats.inc(world, 'forecasts', 1, { bus: opts.bus ?? null });
  /** @type {ShiftApplied} */
  const out = {
    uid: c.uid, from: res.from, to: res.to, dir, kept: res.kept, toMemory: res.toMemory, statDelta: res.statDelta, floored: res.floored,
    level, starTouched, firstHeld: held.first,
  };
  opts.bus?.emit('shift:resolved', { ...out, anchored: false });
  return out;
}

/**
 * Accept (rules §3.4): flips the Forecast (the pick drawn with the cards) and applies the card it
 * lands on.
 * @param {World} world
 * @param {string} uid
 * @param {Forecast} forecast
 * @param {any} data
 * @param {ForecastOpts & {heartmark?: string, rng?: Rng|null}} [opts]
 * @returns {{index: 0|1|2, card: Card, result: ShiftApplied}}
 * @throws {ForecastError} STALE when the Forecast is not the creature's current draw
 */
export function accept(world, uid, forecast, data, opts = {}) {
  const c = creatureOf(world, uid);
  assertFresh(c, forecast);
  const { index, card } = flip(forecast);
  const result = applyShift(world, uid, card, data, { ...opts, dial: forecast.dial });
  return { index, card, result };
}

// ---------------------------------------------------------------------------------------------
// Anchor
// ---------------------------------------------------------------------------------------------

/**
 * Stones one Anchor costs now: ANCHOR_COST, raised by active challenges (ANCHOR_CHALLENGE_COST,
 * highest wins), 0 with `freeAnchor`.
 * @param {World} world
 * @param {ForecastOpts} [opts]
 * @returns {number}
 */
export function anchorCost(world, opts = {}) {
  if (opts.freeAnchor) return 0;
  const t = tuningOf(opts.tuning);
  let cost = t.ANCHOR_COST;
  for (const id of challengesOf(world, opts)) {
    const v = t.ANCHOR_CHALLENGE_COST[id];
    if (nonNegInt(v) && v > cost) cost = v;
  }
  return cost;
}

/**
 * @param {World} world
 * @param {ForecastOpts} opts
 * @returns {string[]}
 */
function challengesOf(world, opts) {
  const list = opts.challenges ?? world.run?.challenges ?? [];
  return Array.isArray(list) ? list : [];
}

/**
 * Whether Anchor is offered now and what it costs (rules §4.7, §18.5). Disabled by an active
 * challenge in ANCHOR_DISABLED_CHALLENGES or by dial rules `anchorsAllowed: false`. Anchor needs an
 * open window unless `requireWindow` is false.
 * @param {World} world
 * @param {Creature|string} creature
 * @param {any} [data]
 * @param {ForecastOpts & {requireWindow?: boolean}} [opts]
 * @returns {{can: boolean, cost: number, reason: 'disabled'|'no-stones'|'no-window'|null}}
 */
export function anchorStatus(world, creature, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const c = creatureOf(world, creature);
  const cost = anchorCost(world, opts);
  if (rulesOf(opts)?.anchorsAllowed === false) return { can: false, cost, reason: 'disabled' };
  if (challengesOf(world, opts).some((id) => t.ANCHOR_DISABLED_CHALLENGES.includes(id))) return { can: false, cost, reason: 'disabled' };
  if (opts.requireWindow !== false && openWindows(c, data, { tuning: opts.tuning }).length === 0) return { can: false, cost, reason: 'no-window' };
  if (!wallet.canAfford(world, cost, 'anchors')) return { can: false, cost, reason: 'no-stones' };
  return { can: true, cost, reason: null };
}

/**
 * Anchor (rules §4.7): spends the stones (`wallet.spend`, currency `anchors`), uses the window up
 * (`exp.resolveWindow`; it does not re-open), consumes one stream draw, counts `stats.anchors` and
 * `stats.forecasts`, resets the Reroll count, emits `shift:resolved {anchored: true}`. Stone supply per dial (Drift issued
 * free and refilled per badge, Flux bought, Freefall one per badge) is `systems/wallet`'s
 * `anchorRulesFor`. Refusals change nothing.
 * @param {World} world
 * @param {string} uid
 * @param {any} [data]
 * @param {ForecastOpts & {requireWindow?: boolean}} [opts]
 * @returns {{ok: true, uid: string, level: number|null, spent: number} | {ok: false, reason: 'disabled'|'no-stones'|'no-window', cost: number}}
 * @throws {ForecastError} NO_CREATURE
 */
export function anchor(world, uid, data, opts = {}) {
  const c = creatureOf(world, uid);
  const st = anchorStatus(world, c, data, opts);
  if (!st.can) return { ok: false, reason: /** @type {'disabled'|'no-stones'|'no-window'} */ (st.reason), cost: st.cost };
  if (st.cost > 0) {
    const paid = wallet.spend(world, st.cost, { currency: 'anchors', bus: opts.bus ?? null, source: 'anchor' });
    if (!paid.ok) return { ok: false, reason: 'no-stones', cost: st.cost };
  }
  c.shiftCount += 1;
  const level = resolveWindow(world, c.uid, data, { tuning: opts.tuning, bus: opts.bus ?? null });
  resetRerolls(world, c.uid, opts.bus ?? null);
  stats.inc(world, 'anchors', 1, { bus: opts.bus ?? null });
  stats.inc(world, 'forecasts', 1, { bus: opts.bus ?? null });
  opts.bus?.emit('shift:resolved', { uid: c.uid, from: c.speciesId, to: c.speciesId, dir: null, anchored: true, level, spent: st.cost });
  return { ok: true, uid: c.uid, level, spent: st.cost };
}

// ---------------------------------------------------------------------------------------------
// Presets and the Field Log
// ---------------------------------------------------------------------------------------------

/**
 * The automatic action a preset takes for this Forecast (rules §2.3): 'anchor' for Auto-Anchor while
 * Anchor is possible; 'accept' for Auto-accept Up when the Up card has the highest odds; otherwise
 * null (the Forecast opens).
 * @param {Forecast} forecast
 * @param {{tuning?: Record<string, any>|null, preset?: 'auto-anchor'|'auto-up'|null}} [opts]  `preset` overrides `forecast.preset`
 * @returns {'anchor'|'accept'|null}
 */
export function autoDecision(forecast, opts = {}) {
  const t = tuningOf(opts.tuning);
  const preset = opts.preset !== undefined ? opts.preset : forecast.preset;
  if (preset === 'auto-anchor') return forecast.canAnchor ? 'anchor' : null;
  if (preset === 'auto-up') {
    const [up, side, down] = forecast.cards;
    if (up.empty || !(up.odds > 0)) return null;
    const beats = (o) => (t.AUTO_UP_STRICT ? up.odds > o : up.odds >= o);
    return beats(side.odds) && beats(down.odds) ? 'accept' : null;
  }
  return null;
}

/**
 * Runs a creature's preset for its open window: Auto-Anchor anchors (no cards are drawn) while it
 * can; Auto-accept Up accepts when Up leads; anything else returns the Forecast to open.
 * @param {World} world
 * @param {string} uid
 * @param {any} data
 * @param {ForecastOpts & {heartmark?: string}} [opts]
 * @returns {{action: 'anchored', result: {ok: true, uid: string, level: number|null, spent: number}}
 *   | {action: 'accepted', forecast: Forecast, index: 0|1|2, card: Card, result: ShiftApplied}
 *   | {action: 'open', forecast: Forecast}}
 */
export function runPreset(world, uid, data, opts = {}) {
  const c = creatureOf(world, uid);
  const preset = world.settings?.autoAnchor?.[c.uid] ?? null;
  if (preset === 'auto-anchor') {
    const r = anchor(world, c.uid, data, opts);
    if (r.ok) return { action: 'anchored', result: r };
  }
  const forecast = rollForecast(world, c, data, opts);
  if (preset === 'auto-up' && autoDecision(forecast, { tuning: opts.tuning, preset }) === 'accept') {
    const r = accept(world, c.uid, forecast, data, opts);
    return { action: 'accepted', forecast, ...r };
  }
  return { action: 'open', forecast };
}

/**
 * Marks every face-up card's form Seen in the Field Log (creatures §6.4 step 4). Silhouettes stay
 * unseen unless SILHOUETTE_MARKS_SEEN. Call once when the Forecast is shown.
 * @param {World} world
 * @param {Forecast} forecast
 * @param {{bus?: Bus|null, data?: any, tuning?: Record<string, any>|null}} [opts]
 * @returns {string[]} forms Seen for the first time
 */
export function markSeen(world, forecast, opts = {}) {
  const t = tuningOf(opts.tuning);
  const first = [];
  for (const cd of forecast.cards) {
    if (cd.empty || !cd.formId) continue;
    if (cd.silhouette && !t.SILHOUETTE_MARKS_SEEN) continue;
    const r = fieldLog.markSeen(world, cd.formId, { bus: opts.bus ?? null, data: opts.data });
    if (r.first) first.push(cd.formId);
  }
  return first;
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/** @param {unknown} v @returns {string} */
function safeJson(v) {
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
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

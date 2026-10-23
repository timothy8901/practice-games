/**
 * The wallet (`world.wallet`): buttons, Starsalt, anchor stones and the Keeper's Purse. [RULES-ECON]
 *
 * GDD-00 §6-7:
 *  - **Buttons** (`main`) are uncapped. {@link earn} / {@link spend} / {@link canAfford}.
 *  - **Starsalt** (`starsalt`) steers Shifts; bought at 800 with a cap of 3 a day shared by the Raft and
 *    Ludo ({@link buyStarsalt}); earned free elsewhere through {@link earn}. Never sold back.
 *  - **Anchor stones** (`anchors`) follow the dial ({@link anchorRulesFor}): Drift starts with 3 and is
 *    refilled to 3 per badge; Flux buys them at 500 (Corin hands over 2); Freefall gets 1 per badge
 *    and cannot buy any.
 *  - **Blackout** ({@link blackout}): 10% of the buttons on hand, capped at 1,500, nothing under 500 and
 *    never taking you below 500. Half of what drops goes into the **Keeper's Purse** (`purse`) and comes
 *    back in equal shares on the next three Glints ({@link collectGlint}).
 *
 * Every function is `fn(world, ...args, ctx?)` (see `systems/econ` EconCtx), mutates only
 * `world.wallet`, returns a plain result and emits `wallet:changed` after a change:
 * `{currency, delta, balance, source}`. Expected refusals (not enough buttons, daily cap) are results
 * with `ok: false` and a `reason`; malformed arguments throw.
 *
 * Pure: no DOM, no randomness.
 * @module systems/wallet
 */

import { makeTuning, dayOf, gameDay, emit, assertAmount, assertCount, assertId, deepFreeze, is } from './econ.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('./econ.js').EconCtx} EconCtx */

/** Currency keys (§15.4; display names live in strings.js). */
export const CURRENCIES = Object.freeze(['main', 'starsalt', 'anchors', 'purse']);
/** Currencies that {@link earn} and {@link spend} move (the purse only fills through {@link blackout}). */
export const SPENDABLE = Object.freeze(['main', 'starsalt', 'anchors']);
/** `wallet.anchorGrants` key of the run-start grant (content ids never start with '@'). */
export const START_GRANT = '@start';

/**
 * @typedef {Object} AnchorRule
 * @property {number} start       stones granted once at the start of the run ({@link grantStartingAnchors})
 * @property {number} refillTo    on each badge the count is raised to at least this (0 = no refill)
 * @property {number} perBadge    stones added on each badge
 * @property {boolean} buyable    whether shops sell stones on this dial
 */

/**
 * Designer defaults, GDD-00 §6-7 values. Override any key through `data.tuning` / `ctx.tuning`.
 * @type {Readonly<{blackoutCostFraction: number, blackoutCap: number, blackoutFloor: number, purseRefundFraction: number,
 *   purseGlints: number, glintBase: number, glintPerDay: number, starsaltPrice: number, starsaltDailyCap: number,
 *   anchorPrice: number, anchorRules: Readonly<Record<string, AnchorRule>>, anchorRulesFallback: string}>}
 */
export const DEFAULTS = deepFreeze({
  blackoutCostFraction: 0.1,   // §6: 10% of buttons on hand
  blackoutCap: 1500,           // §6: capped at 1,500
  blackoutFloor: 500,          // §6: nothing under 500; never takes you below 500
  purseRefundFraction: 0.5,    // §6: half the dropped amount goes into the Keeper's Purse
  purseGlints: 3,              // §6: back in equal thirds over the next three Glints
  glintBase: 500,              // §7 income: the Glint = 500 + 60 × day
  glintPerDay: 60,
  starsaltPrice: 800,          // §7: Starsalt 800, max 3 a day (shared Raft + Ludo)
  starsaltDailyCap: 3,
  anchorPrice: 500,            // §7: anchor stone 500 (Flux)
  anchorRules: {               // §3 Corin (Flux 2 stones), §7 sourcing
    drift: { start: 3, refillTo: 3, perBadge: 0, buyable: true },
    flux: { start: 2, refillTo: 0, perBadge: 0, buyable: true },
    freefall: { start: 0, refillTo: 0, perBadge: 1, buyable: false },
  },
  anchorRulesFallback: 'flux', // rules used for an unknown dial id
});

const isRule = (r) => !!r && typeof r === 'object' && is.nonNegInt(r.start) && is.nonNegInt(r.refillTo) && is.nonNegInt(r.perBadge) && typeof r.buyable === 'boolean';

/** @type {Record<string, [(v: any) => boolean, string]>} */
const SPEC = {
  blackoutCostFraction: [is.fraction, 'fraction 0..1'],
  blackoutCap: [is.nonNegInt, 'integer >= 0'],
  blackoutFloor: [is.nonNegInt, 'integer >= 0'],
  purseRefundFraction: [is.fraction, 'fraction 0..1'],
  purseGlints: [is.posInt, 'integer >= 1'],
  glintBase: [is.nonNegInt, 'integer >= 0'],
  glintPerDay: [is.nonNegInt, 'integer >= 0'],
  starsaltPrice: [is.nonNegInt, 'integer >= 0'],
  starsaltDailyCap: [is.nonNegInt, 'integer >= 0'],
  anchorPrice: [is.nonNegInt, 'integer >= 0'],
  anchorRules: [(v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isRule), 'Record<dial, {start, refillTo, perBadge, buyable}>'],
  anchorRulesFallback: [is.id, 'dial id'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * Resolved tuning for a context (`ctx.tuning` > `data.tuning` > {@link DEFAULTS}).
 * @type {(ctx?: EconCtx|null) => Readonly<typeof DEFAULTS & {econDayStartMinute: number}>}
 */
export const tuningOf = makeTuning('wallet', DEFAULTS, SPEC);

/**
 * @param {unknown} currency
 * @param {readonly string[]} allowed
 * @returns {string}
 */
function assertCurrency(currency, allowed) {
  if (typeof currency !== 'string' || !allowed.includes(currency)) {
    throw new TypeError(`wallet: currency must be one of ${allowed.join(' ')}, got ${JSON.stringify(currency)}`);
  }
  return currency;
}

/**
 * @param {World} world
 * @param {string} currency
 * @param {number} delta
 * @param {EconCtx|undefined} ctx
 * @param {string} fallbackSource
 */
function changed(world, currency, delta, ctx, fallbackSource) {
  if (delta === 0) return;
  emit(ctx, 'wallet:changed', { currency, delta, balance: world.wallet[currency], source: ctx?.source ?? fallbackSource });
}

/**
 * Current balance of a currency.
 * @param {World} world
 * @param {string} [currency='main']
 * @returns {number}
 */
export function balance(world, currency = 'main') {
  assertCurrency(currency, CURRENCIES);
  return world.wallet[currency];
}

/**
 * Whether the wallet holds at least `amount` of a currency.
 * @param {World} world
 * @param {number} amount   non-negative integer
 * @param {string} [currency='main']
 * @returns {boolean}
 */
export function canAfford(world, amount, currency = 'main') {
  assertAmount(amount, 'wallet.canAfford');
  assertCurrency(currency, CURRENCIES);
  return world.wallet[currency] >= amount;
}

/**
 * Adds to a currency (`ctx.currency`, default `main`). Uncapped.
 * @param {World} world
 * @param {number} amount   non-negative integer (0 is a no-op)
 * @param {EconCtx & {currency?: string}} [ctx]
 * @returns {{ok: true, currency: string, earned: number, balance: number}}
 * @throws {RangeError|TypeError} for a negative / non-integer amount or an unknown currency
 */
export function earn(world, amount, ctx) {
  assertAmount(amount, 'wallet.earn');
  const currency = assertCurrency(ctx?.currency ?? 'main', SPENDABLE);
  world.wallet[currency] += amount;
  changed(world, currency, amount, ctx, 'earn');
  return { ok: true, currency, earned: amount, balance: world.wallet[currency] };
}

/**
 * Takes from a currency (`ctx.currency`, default `main`) when the wallet holds enough; otherwise
 * changes nothing.
 * @param {World} world
 * @param {number} amount   non-negative integer (0 always succeeds)
 * @param {EconCtx & {currency?: string}} [ctx]
 * @returns {{ok: true, currency: string, spent: number, balance: number} | {ok: false, reason: 'insufficient', currency: string, balance: number, short: number}}
 * @throws {RangeError|TypeError} for a negative / non-integer amount or an unknown currency
 */
export function spend(world, amount, ctx) {
  assertAmount(amount, 'wallet.spend');
  const currency = assertCurrency(ctx?.currency ?? 'main', SPENDABLE);
  const have = world.wallet[currency];
  if (have < amount) return { ok: false, reason: 'insufficient', currency, balance: have, short: amount - have };
  world.wallet[currency] = have - amount;
  changed(world, currency, -amount, ctx, 'spend');
  return { ok: true, currency, spent: amount, balance: world.wallet[currency] };
}

/**
 * Debug / test adjustment: adds a signed delta to a currency, clamping at 0 (the debug hook's `earn`).
 * @param {World} world
 * @param {number} delta   finite number (truncated toward 0)
 * @param {EconCtx & {currency?: string}} [ctx]
 * @returns {{currency: string, delta: number, balance: number}}  `delta` is the change actually applied
 * @throws {TypeError} for a non-finite delta
 */
export function adjust(world, delta, ctx) {
  const d = Math.trunc(Number(delta));
  if (!Number.isFinite(d)) throw new TypeError('wallet.adjust: delta must be a finite number');
  const currency = assertCurrency(ctx?.currency ?? 'main', SPENDABLE);
  const before = world.wallet[currency];
  world.wallet[currency] = Math.max(0, before + d);
  const applied = world.wallet[currency] - before;
  changed(world, currency, applied, ctx, 'debug');
  return { currency, delta: applied, balance: world.wallet[currency] };
}

// ---------------------------------------------------------------------------------------------
// Blackout and the Keeper's Purse
// ---------------------------------------------------------------------------------------------

/**
 * What a blackout costs with `main` buttons on hand: `floor(main × fraction)`, at most the cap, zero
 * under the floor, and never more than `main - floor` (so you keep at least the floor).
 * @param {number} main
 * @param {{blackoutCostFraction: number, blackoutCap: number, blackoutFloor: number}} [tuning]
 * @returns {number}
 */
export function blackoutCost(main, tuning = DEFAULTS) {
  assertAmount(main, 'wallet.blackoutCost');
  if (main < tuning.blackoutFloor) return 0;
  const raw = Math.floor(main * tuning.blackoutCostFraction);
  return Math.max(0, Math.min(raw, tuning.blackoutCap, main - tuning.blackoutFloor));
}

/**
 * Applies the blackout cost to `main` and pays half into the Keeper's Purse, resetting the purse's
 * Glint countdown. A second blackout before the purse is empty adds to it and restarts the count.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{lost: number, refund: number, balance: number, purse: number, purseGlints: number}}
 */
export function blackout(world, ctx) {
  const t = tuningOf(ctx);
  const w = world.wallet;
  const lost = blackoutCost(w.main, t);
  const refund = Math.floor(lost * t.purseRefundFraction);
  w.main -= lost;
  if (refund > 0) {
    w.purse += refund;
    w.purseGlints = t.purseGlints;
  }
  changed(world, 'main', -lost, ctx, 'blackout');
  changed(world, 'purse', refund, ctx, 'blackout');
  return { lost, refund, balance: w.main, purse: w.purse, purseGlints: w.purseGlints };
}

/**
 * The Glint's value on a GDD day (1 = arrival): `glintBase + glintPerDay × day`.
 * @param {number} day   GDD day number (integer >= 1; smaller values clamp to 1)
 * @param {{glintBase: number, glintPerDay: number}} [tuning]
 * @returns {number}
 */
export function glintValue(day, tuning = DEFAULTS) {
  if (!Number.isInteger(day)) throw new RangeError('wallet.glintValue: day must be an integer');
  return tuning.glintBase + tuning.glintPerDay * Math.max(1, day);
}

/**
 * The share of the Keeper's Purse the next Glint returns (`ceil(purse / glintsLeft)`, the whole rest
 * on the last one), or 0 when the purse is empty.
 * @param {World} world
 * @returns {number}
 */
export function purseShare(world) {
  const { purse, purseGlints } = world.wallet;
  if (purse <= 0) return 0;
  if (purseGlints <= 1) return purse;
  return Math.ceil(purse / purseGlints);
}

/**
 * Pays out a dug Glint: its value for today (`ctx.gameDay`, else the economy day's GDD number) plus
 * the purse share. Called by the gather system when the Glint is dug (one a day is its rule).
 * @param {World} world
 * @param {EconCtx & {gameDay?: number}} [ctx]
 * @returns {{value: number, refund: number, total: number, balance: number, purseLeft: number, glintsLeft: number}}
 */
export function collectGlint(world, ctx) {
  const t = tuningOf(ctx);
  const day = Number.isInteger(ctx?.gameDay) ? /** @type {number} */ (ctx.gameDay) : gameDay(dayOf(world, ctx, t));
  const value = glintValue(day, t);
  const w = world.wallet;
  const refund = purseShare(world);
  w.purse -= refund;
  if (refund > 0) w.purseGlints = w.purse > 0 ? Math.max(0, w.purseGlints - 1) : 0;
  w.main += value + refund;
  emit(ctx, 'wallet:changed', { currency: 'main', delta: value + refund, balance: w.main, source: ctx?.source ?? 'glint', glint: value, purse: refund });
  changed(world, 'purse', -refund, ctx, 'glint');
  return { value, refund, total: value + refund, balance: w.main, purseLeft: w.purse, glintsLeft: w.purseGlints };
}

// ---------------------------------------------------------------------------------------------
// Starsalt
// ---------------------------------------------------------------------------------------------

/**
 * Starsalt still buyable today (shared cap across every seller).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function starsaltLeftToday(world, ctx) {
  const t = tuningOf(ctx);
  const day = dayOf(world, ctx, t);
  const bought = world.wallet.starsaltDay === day ? world.wallet.starsaltBought : 0;
  return Math.max(0, t.starsaltDailyCap - bought);
}

/**
 * Buys Starsalt with buttons, under the shared daily cap. All or nothing.
 * @param {World} world
 * @param {number} n       positive integer
 * @param {EconCtx & {unitPrice?: number}} [ctx]   `unitPrice` overrides the tuned price (a shop's own price)
 * @returns {{ok: true, bought: number, spent: number, starsalt: number, leftToday: number}
 *   | {ok: false, reason: 'daily-cap', leftToday: number}
 *   | {ok: false, reason: 'insufficient', cost: number, balance: number}}
 */
export function buyStarsalt(world, n, ctx) {
  assertCount(n, 'wallet.buyStarsalt');
  const t = tuningOf(ctx);
  const day = dayOf(world, ctx, t);
  const left = starsaltLeftToday(world, ctx);
  if (n > left) return { ok: false, reason: 'daily-cap', leftToday: left };
  const unit = ctx?.unitPrice ?? t.starsaltPrice;
  assertAmount(unit, 'wallet.buyStarsalt unitPrice');
  const cost = unit * n;
  const w = world.wallet;
  if (w.main < cost) return { ok: false, reason: 'insufficient', cost, balance: w.main };
  w.main -= cost;
  w.starsalt += n;
  if (w.starsaltDay !== day) {
    w.starsaltDay = day;
    w.starsaltBought = 0;
  }
  w.starsaltBought += n;
  changed(world, 'main', -cost, ctx, 'buy:starsalt');
  changed(world, 'starsalt', n, ctx, 'buy:starsalt');
  return { ok: true, bought: n, spent: cost, starsalt: w.starsalt, leftToday: t.starsaltDailyCap - w.starsaltBought };
}

// ---------------------------------------------------------------------------------------------
// Anchor stones
// ---------------------------------------------------------------------------------------------

/**
 * Anchor rules for a dial (unknown dials use `anchorRulesFallback`).
 * @param {string} dial
 * @param {EconCtx|null} [ctx]
 * @returns {AnchorRule}
 */
export function anchorRulesFor(dial, ctx) {
  const t = tuningOf(ctx);
  return t.anchorRules[dial] ?? t.anchorRules[t.anchorRulesFallback] ?? { start: 0, refillTo: 0, perBadge: 0, buyable: false };
}

/**
 * @param {World} world
 * @param {EconCtx|undefined} ctx
 * @returns {string}
 */
function dialOf(world, ctx) {
  return String(ctx?.dial ?? world.run?.dial ?? '');
}

/**
 * Buys anchor stones with buttons when the dial sells them.
 * @param {World} world
 * @param {number} n       positive integer
 * @param {EconCtx & {unitPrice?: number}} [ctx]
 * @returns {{ok: true, bought: number, spent: number, anchors: number}
 *   | {ok: false, reason: 'not-sold', dial: string}
 *   | {ok: false, reason: 'insufficient', cost: number, balance: number}}
 */
export function buyAnchors(world, n, ctx) {
  assertCount(n, 'wallet.buyAnchors');
  const t = tuningOf(ctx);
  const dial = dialOf(world, ctx);
  if (!anchorRulesFor(dial, ctx).buyable) return { ok: false, reason: 'not-sold', dial };
  const unit = ctx?.unitPrice ?? t.anchorPrice;
  assertAmount(unit, 'wallet.buyAnchors unitPrice');
  const cost = unit * n;
  const w = world.wallet;
  if (w.main < cost) return { ok: false, reason: 'insufficient', cost, balance: w.main };
  w.main -= cost;
  w.anchors += n;
  changed(world, 'main', -cost, ctx, 'buy:anchors');
  changed(world, 'anchors', n, ctx, 'buy:anchors');
  return { ok: true, bought: n, spent: cost, anchors: w.anchors };
}

/**
 * @param {World} world
 * @param {string} key
 * @param {AnchorRule} rule
 * @param {'start'|'badge'} kind
 * @param {EconCtx|undefined} ctx
 * @returns {{granted: number, anchors: number}}
 */
function grant(world, key, rule, kind, ctx) {
  const w = world.wallet;
  const before = w.anchors;
  if (kind === 'start') w.anchors += rule.start;
  else w.anchors = Math.max(w.anchors, rule.refillTo) + rule.perBadge;
  w.anchorGrants.push(key);
  const granted = w.anchors - before;
  changed(world, 'anchors', granted, ctx, kind === 'start' ? 'anchors:start' : 'anchors:badge');
  return { granted, anchors: w.anchors };
}

/**
 * Grants the dial's starting stones once per run (Drift 3, Flux 2 from Corin, Freefall none).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, granted: number, anchors: number} | {ok: false, reason: 'already-granted'}}
 */
export function grantStartingAnchors(world, ctx) {
  if (world.wallet.anchorGrants.includes(START_GRANT)) return { ok: false, reason: 'already-granted' };
  return { ok: true, ...grant(world, START_GRANT, anchorRulesFor(dialOf(world, ctx), ctx), 'start', ctx) };
}

/**
 * Applies the dial's per-badge stones once per spire: Drift refills to 3, Freefall adds 1, Flux nothing.
 * @param {World} world
 * @param {string} spireId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, granted: number, anchors: number} | {ok: false, reason: 'already-granted'}}
 */
export function onBadge(world, spireId, ctx) {
  assertId(spireId, 'wallet.onBadge');
  if (world.wallet.anchorGrants.includes(spireId)) return { ok: false, reason: 'already-granted' };
  return { ok: true, ...grant(world, spireId, anchorRulesFor(dialOf(world, ctx), ctx), 'badge', ctx) };
}

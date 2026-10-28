/**
 * Shops (`world.shops`): hours, daily stock, fixed-price buying and selling, Wanted Today and the
 * Consignment Crate. [RULES-ECON]
 *
 * GDD-00 §5, §7, §9 (fixed prices, no dynamic pricing):
 *  - **Definitions** come from `data.shops` (§14.9: `{id, keeper, hours: [open, close], stock, buys,
 *    priceMult, nightKeeper}` plus the optional fields documented on {@link ShopRow}).
 *  - **Hours** ({@link isOpen}): `[open, close)` in minutes of day, wrapping midnight when `open > close`
 *    (Pell's 08:00-22:00, Ludo 22:00-08:00, so someone is always buying: {@link buyersAt}).
 *  - **Stock** ({@link stockFor}): staples (rows without `rotate`) are always there when their `cond`
 *    holds; rotating rows are grouped by their `rotate` pool and `rotations[pool]` of them (default 2:
 *    "two discs a day") are drawn from the fork `shop:<day>` -> `<shopId>` -> `<pool>`, so the same seed
 *    and day always show the same shelf. `qty` caps a row per day.
 *  - **Buying** ({@link buy}) at `price × priceMult`; Starsalt is capped at 3 a day across every seller
 *    (`systems/wallet.buyStarsalt`) and anchor stones follow the dial; Freefall asks to confirm a disc
 *    above 2,500. Purchases that do not fit spill into the basket at your feet.
 *  - **Selling** ({@link sell}): goods (fish, bugs, fruit, finds, ...) sell at full value to a shop that
 *    buys their kind (Pell's and Ludo: "sell at full price to the two buyers"); spare shop items sell at
 *    their `sell` price (50%). Wanted Today ({@link wantedToday}): three items at +50%, one stack each a
 *    day. One-of-a-kind items ask first.
 *  - **Consignment Crate** ({@link crateDeposit}, {@link settleCrate}): anything, paid at 90% overnight.
 *  - **Listings** ({@link listing}) carry the "After: n" preview and, for discs, the move they teach.
 *  - **Items** are `items` rows or, for gathered goods (fish, bugs, finds, fruit), `collections` rows
 *    (`systems/econ.itemOf`). A row without a valid `price` is never sold ('unpriced'), and anchor
 *    stones are neither listed nor sold on a dial that does not sell them (Freefall).
 *
 * Day-scoped counters live in `world.shops` and reset lazily when the economy day changes.
 * Every function is `fn(world, ...args, ctx?)` (`systems/econ` EconCtx); it writes `world.shops`, and
 * buttons / items only through `systems/wallet` and `systems/bag`. Events: `shop:bought {shopId, itemId,
 * n, spent}`, `shop:sold {shopId, itemId, n, earned, wanted}`, `crate:changed {items}`, `crate:settled
 * {earned, lines}` (plus the `wallet:changed` / `bag:changed` the owning systems emit).
 *
 * Pure: no DOM, no Math.random (stock draws use the labelled fork of the run seed).
 * @module systems/shops
 */

import { MINUTES_PER_DAY } from '../core/time.js';
import { evalCond } from '../script/cond.js';
import { forkFor } from '../state/rngs.js';
import { makeTuning, lookup, itemOf, allItems, money, isPriced, nowOf, minuteOfDay, dayOf, gameDay, emit, assertCount, assertId, deepFreeze, is } from './econ.js';
import * as wallet from './wallet.js';
import * as bag from './bag.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').ItemStack} ItemStack */
/** @typedef {import('./econ.js').EconCtx} EconCtx */
/** @typedef {import('../core/rng.js').Rng} Rng */

/**
 * A shop row (§14.9 plus the optional fields this system reads).
 * @typedef {Object} ShopRow
 * @property {string} id  @property {string} keeper
 * @property {[number, number]} hours          [open, close) minutes of day; wraps when open > close
 * @property {Array<{item: string, cond?: any, rotate?: string, qty?: number}>} stock
 * @property {string[]} buys                   item kinds it buys at full value
 * @property {boolean} [buysAll]               buys anything (Ludo)
 * @property {number} priceMult
 * @property {Record<string, number>} [rotations]   rotating pool -> rows drawn per day
 * @property {boolean} [wanted]                runs the Wanted Today board (Pell's)
 * @property {string[]} [wantedPool]           item ids Wanted Today may name (default: items of the kinds it buys)
 * @property {number} [fromDay]                GDD day it opens from (the Raft: day 3)
 * @property {any} [cond]                      condition for being open at all (cond DSL)
 * @property {string|null} [nightKeeper]
 */

/**
 * Designer defaults, GDD-00 §7 / §9 values. Override through `data.tuning` / `ctx.tuning`.
 */
export const DEFAULTS = deepFreeze({
  wantedTodayMult: 1.5,          // §7: Wanted Today +50%
  wantedTodayCount: 3,           // §7: on 3 items
  wantedStacksPerDay: 1,         // §7: one stack each a day
  crateRate: 0.9,                // §7: Consignment Crate 90% of value, overnight
  spareSellRate: 0.5,            // §7: spare items sold back at 50% (rows without `sell`)
  fullPriceKinds: ['fish', 'bug', 'fruit', 'relic', 'fossil', 'find', 'shell', 'honey'], // goods sold at full value
  rotatePickDefault: 2,          // §9: two discs a day (rows drawn per rotating pool)
  freefallDiscConfirmAbove: 2500, // §7: Freefall asks to confirm a disc above 2,500
  freefallDial: 'freefall',
  discPocket: 'discs',
});

/** @type {Record<string, [(v: any) => boolean, string]>} */
const SPEC = {
  wantedTodayMult: [(v) => typeof v === 'number' && Number.isFinite(v) && v >= 1, 'number >= 1'],
  wantedTodayCount: [is.nonNegInt, 'integer >= 0'],
  wantedStacksPerDay: [is.nonNegInt, 'integer >= 0'],
  crateRate: [is.fraction, 'fraction 0..1'],
  spareSellRate: [is.fraction, 'fraction 0..1'],
  fullPriceKinds: [is.ids, 'kind[]'],
  rotatePickDefault: [is.nonNegInt, 'integer >= 0'],
  freefallDiscConfirmAbove: [is.nonNegInt, 'integer >= 0'],
  freefallDial: [is.id, 'dial id'],
  discPocket: [is.id, 'pocket id'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * Resolved tuning for a context (`ctx.tuning` > `data.tuning` > {@link DEFAULTS}).
 * @type {(ctx?: EconCtx|null) => Readonly<typeof DEFAULTS & {econDayStartMinute: number}>}
 */
export const tuningOf = makeTuning('shops', DEFAULTS, SPEC);

// ---------------------------------------------------------------------------------------------
// Definitions and hours
// ---------------------------------------------------------------------------------------------

/**
 * Every shop row.
 * @param {EconCtx} [ctx]
 * @returns {ShopRow[]}
 */
export function shopList(ctx) {
  return lookup(ctx?.data).list('shops');
}

/**
 * A shop row by id (or the row itself), or null.
 * @param {string|ShopRow} shop
 * @param {EconCtx} [ctx]
 * @returns {ShopRow|null}
 */
export function shopRow(shop, ctx) {
  if (shop && typeof shop === 'object') return shop;
  return lookup(ctx?.data).row('shops', /** @type {string} */ (shop));
}

/**
 * Whether `[open, close)` contains a minute of day (wrapping midnight when open > close; open ===
 * close means always open).
 * @param {[number, number]} hours
 * @param {number} minute
 * @returns {boolean}
 */
export function withinHours(hours, minute) {
  if (!Array.isArray(hours) || hours.length !== 2) return false;
  const m = minuteOfDay(minute);
  const [open, close] = hours.map((h) => h % MINUTES_PER_DAY);
  if (open === close) return true;
  return open < close ? m >= open && m < close : m >= open || m < close;
}

/**
 * The registry handed to the cond DSL (it needs `has/get`; a plain tables object is not passed).
 * @param {EconCtx|undefined} ctx
 * @returns {{has: Function, get: Function}|null}
 */
function condData(ctx) {
  return ctx?.data && typeof ctx.data.has === 'function' && typeof ctx.data.get === 'function' ? ctx.data : null;
}

/**
 * Whether a shop is open now (`ctx.now`, else the world clock): hours, `fromDay` and `cond`.
 * The day test uses the shop day of the opening minute, so Ludo's after-midnight hours count as the
 * evening's day.
 * @param {World} world
 * @param {string|ShopRow} shop
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function isOpen(world, shop, ctx) {
  const row = shopRow(shop, ctx);
  if (!row) return false;
  const now = nowOf(world, ctx);
  if (!withinHours(row.hours, now)) return false;
  if (Number.isInteger(row.fromDay) && gameDay(dayOf(world, ctx, tuningOf(ctx))) < /** @type {number} */ (row.fromDay)) return false;
  if (row.cond !== undefined && row.cond !== null && !evalCond(world, row.cond, { data: condData(ctx) })) return false;
  return true;
}

/**
 * Whether a shop buys anything from the player.
 * @param {ShopRow} row
 * @returns {boolean}
 */
export function isBuyer(row) {
  return row.buysAll === true || (Array.isArray(row.buys) && row.buys.length > 0);
}

/**
 * Shops open and buying at the current minute ("someone is always buying").
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {string[]} shop ids
 */
export function buyersAt(world, ctx) {
  return shopList(ctx).filter((s) => isBuyer(s) && isOpen(world, s, ctx)).map((s) => s.id);
}

// ---------------------------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------------------------

/**
 * Item row (`items`, else `collections`; null when unknown).
 * @param {string} itemId
 * @param {EconCtx|undefined} ctx
 * @returns {Record<string, any>|null}
 */
function item(itemId, ctx) {
  return itemOf(ctx?.data, itemId);
}

/**
 * What a shop charges for one: `round(price × priceMult)` (0 for an unpriced row; {@link buy}
 * refuses those).
 * @param {Record<string, any>} itemRow
 * @param {ShopRow} shop
 * @returns {number}
 */
export function buyPrice(itemRow, shop) {
  const mult = typeof shop.priceMult === 'number' && Number.isFinite(shop.priceMult) && shop.priceMult > 0 ? shop.priceMult : 1;
  return Math.round(money(itemRow.price) * mult);
}

/**
 * Whether the dial lets the player buy this row: anchor stones are not sold on a dial whose anchor
 * rule says so (Freefall).
 * @param {World} world
 * @param {Record<string, any>} itemRow
 * @param {EconCtx|undefined} ctx
 * @returns {boolean}
 */
function soldOnDial(world, itemRow, ctx) {
  if (bag.walletCurrencyOf(itemRow) !== 'anchors') return true;
  return wallet.anchorRulesFor(String(ctx?.dial ?? world.run?.dial ?? ''), ctx).buyable;
}

/**
 * Whether an item counts as goods (sold at full value).
 * @param {Record<string, any>} itemRow
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function isGoods(itemRow, ctx) {
  return typeof itemRow.kind === 'string' && tuningOf(ctx).fullPriceKinds.includes(itemRow.kind);
}

/**
 * What one is worth when sold, in whole buttons: goods at full `price`; other items at `sell`, else
 * `floor(price × spareSellRate)`. Currency items, keepsakes priced 0 and broken values (missing,
 * negative, NaN) are worth 0; fractional values floor.
 * @param {Record<string, any>} itemRow
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function sellValue(itemRow, ctx) {
  if (bag.walletCurrencyOf(itemRow)) return 0;
  const price = money(itemRow.price);
  if (isGoods(itemRow, ctx)) return price;
  if (typeof itemRow.sell === 'number' && Number.isFinite(itemRow.sell)) return money(itemRow.sell);
  return Math.floor(price * tuningOf(ctx).spareSellRate);
}

/**
 * Whether a shop takes an item.
 * @param {ShopRow} row
 * @param {Record<string, any>} itemRow
 * @returns {boolean}
 */
export function buysItem(row, itemRow) {
  if (bag.walletCurrencyOf(itemRow)) return false;
  if (row.buysAll === true) return true;
  return Array.isArray(row.buys) && typeof itemRow.kind === 'string' && row.buys.includes(itemRow.kind);
}

// ---------------------------------------------------------------------------------------------
// Day counters
// ---------------------------------------------------------------------------------------------

/**
 * Resets the day-scoped counters when the economy day changed.
 * @param {World} world
 * @param {number} day
 */
function rollover(world, day) {
  const S = world.shops;
  if (S.day === day) return;
  S.day = day;
  S.sold = {};
  S.wantedSold = {};
}

/**
 * Today's value of a day counter without writing.
 * @param {World} world
 * @param {'sold'|'wantedSold'} table
 * @param {string} key
 * @param {number} day
 * @returns {number}
 */
function counter(world, table, key, day) {
  return world.shops.day === day ? world.shops[table][key] ?? 0 : 0;
}

// ---------------------------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} StockLine
 * @property {string} item
 * @property {number|null} qty      per-day cap (null = unlimited)
 * @property {boolean} staple       never randomized
 * @property {string|null} pool     rotating pool name
 */

/**
 * The rng a shop draws its day from: `ctx.rng`, else the fork `shop:<day>` of the run seed.
 * @param {World} world
 * @param {number} day
 * @param {EconCtx|undefined} ctx
 * @returns {Rng}
 */
export function dayRng(world, day, ctx) {
  return ctx?.rng ?? forkFor(world.run.seed, `shop:${day}`);
}

/**
 * A shop's shelf on an economy day: staples (cond permitting) in data order, then the day's draw from
 * each rotating pool (in data order). Deterministic per seed, shop and day.
 * @param {World} world
 * @param {string|ShopRow} shop
 * @param {number} [day]   economy day (default: today)
 * @param {EconCtx} [ctx]
 * @returns {StockLine[]}
 */
export function stockFor(world, shop, day, ctx) {
  const row = shopRow(shop, ctx);
  if (!row) return [];
  const t = tuningOf(ctx);
  const d = Number.isInteger(day) ? /** @type {number} */ (day) : dayOf(world, ctx, t);
  const data = condData(ctx);
  const holds = (s) => s.cond === undefined || s.cond === null || evalCond(world, s.cond, { data });
  const rows = Array.isArray(row.stock) ? row.stock : [];
  /** @type {Map<string, Array<{s: any, i: number}>>} */
  const pools = new Map();
  /** @type {Array<{s: any, i: number, pool: string|null}>} */
  const chosen = [];
  rows.forEach((s, i) => {
    if (!s || typeof s.item !== 'string') return;
    if (typeof s.rotate === 'string' && s.rotate) {
      if (!pools.has(s.rotate)) pools.set(s.rotate, []);
      if (holds(s)) pools.get(s.rotate)?.push({ s, i });
    } else if (holds(s)) {
      chosen.push({ s, i, pool: null });
    }
  });
  const rng = dayRng(world, d, ctx).fork(row.id);
  for (const [pool, list] of pools) {
    const k = Number.isInteger(row.rotations?.[pool]) ? row.rotations[pool] : t.rotatePickDefault;
    const picked = rng.fork(pool).shuffle(list).slice(0, Math.max(0, k));
    for (const p of picked) chosen.push({ ...p, pool });
  }
  const staples = chosen.filter((c) => c.pool === null);
  const rotating = chosen.filter((c) => c.pool !== null).sort((a, b) => a.i - b.i);
  /** @type {StockLine[]} */
  const out = [];
  for (const c of [...staples, ...rotating]) {
    if (out.some((o) => o.item === c.s.item)) continue; // one line per item
    out.push({ item: c.s.item, qty: Number.isInteger(c.s.qty) ? c.s.qty : null, staple: c.pool === null, pool: c.pool });
  }
  return out;
}

/**
 * How many of a stocked item can still be bought today (row qty, Starsalt cap), or 0 when it is not
 * on today's shelf. `Infinity` when unlimited.
 * @param {World} world
 * @param {string|ShopRow} shop
 * @param {string} itemId
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function leftToday(world, shop, itemId, ctx) {
  const row = shopRow(shop, ctx);
  if (!row) return 0;
  const t = tuningOf(ctx);
  const day = dayOf(world, ctx, t);
  const line = stockFor(world, row, day, ctx).find((l) => l.item === itemId);
  if (!line) return 0;
  let left = line.qty === null ? Infinity : Math.max(0, line.qty - counter(world, 'sold', `${row.id}/${itemId}`, day));
  const it = item(itemId, ctx);
  if (it && bag.walletCurrencyOf(it) === 'starsalt') left = Math.min(left, wallet.starsaltLeftToday(world, ctx));
  if (it && bag.isOneOfAKind(it)) left = Math.min(left, bag.count(world, itemId, { baskets: true }, ctx) > 0 ? 0 : 1);
  if (it && (!isPriced(it) || !soldOnDial(world, it, ctx))) left = 0;
  return left;
}

// ---------------------------------------------------------------------------------------------
// Wanted Today
// ---------------------------------------------------------------------------------------------

/**
 * The three items a Wanted Today shop pays +50% for on an economy day. Drawn from the shop's
 * `wantedPool`, else from every goods item of the kinds it buys; fork `shop:<day>` -> `wanted:<shopId>`.
 * Empty for a shop without `wanted: true`.
 * @param {World} world
 * @param {string|ShopRow} shop
 * @param {number} [day]
 * @param {EconCtx} [ctx]
 * @returns {string[]}
 */
export function wantedToday(world, shop, day, ctx) {
  const row = shopRow(shop, ctx);
  if (!row || row.wanted !== true) return [];
  const t = tuningOf(ctx);
  const d = Number.isInteger(day) ? /** @type {number} */ (day) : dayOf(world, ctx, t);
  const pool = Array.isArray(row.wantedPool) && row.wantedPool.length
    ? row.wantedPool.filter((id) => itemOf(ctx?.data, id))
    : allItems(ctx?.data).filter((it) => isGoods(it, ctx) && buysItem(row, it) && sellValue(it, ctx) > 0).map((it) => it.id);
  const unique = [...new Set(pool)];
  return dayRng(world, d, ctx).fork(`wanted:${row.id}`).shuffle(unique).slice(0, t.wantedTodayCount);
}

/**
 * How many more of an item sell at the Wanted Today rate today (one stack a day each).
 * @param {World} world
 * @param {string|ShopRow} shop
 * @param {string} itemId
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function wantedLeft(world, shop, itemId, ctx) {
  const t = tuningOf(ctx);
  const day = dayOf(world, ctx, t);
  if (!wantedToday(world, shop, day, ctx).includes(itemId)) return 0;
  const cap = bag.stackLimit(item(itemId, ctx), ctx) * t.wantedStacksPerDay;
  return Math.max(0, cap - counter(world, 'wantedSold', itemId, day));
}

/**
 * What selling `n` of an item at a shop pays right now, split into Wanted and plain units.
 * @param {World} world
 * @param {string|ShopRow} shop
 * @param {string} itemId
 * @param {number} n
 * @param {EconCtx} [ctx]
 * @returns {{unit: number, wantedUnit: number, wantedUnits: number, total: number}}
 */
export function sellQuote(world, shop, itemId, n, ctx) {
  const it = item(itemId, ctx);
  if (!it) return { unit: 0, wantedUnit: 0, wantedUnits: 0, total: 0 };
  const unit = sellValue(it, ctx);
  const wantedUnit = Math.round(unit * tuningOf(ctx).wantedTodayMult);
  const wantedUnits = Math.min(n, wantedLeft(world, shop, itemId, ctx));
  return { unit, wantedUnit, wantedUnits, total: wantedUnits * wantedUnit + (n - wantedUnits) * unit };
}

// ---------------------------------------------------------------------------------------------
// Buying and selling
// ---------------------------------------------------------------------------------------------

/**
 * Buys `n` of a stocked item. Checks hours, today's shelf, the row's daily qty, one-of-a-kind, the
 * dial (anchor stones, Freefall disc confirm), the Starsalt cap and the wallet, then pays and gives.
 * @param {World} world
 * @param {string} shopId
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {EconCtx & {anyHour?: boolean}} [ctx]   `anyHour` skips the hours check (scripted gifts, tests)
 * @returns {{ok: true, spent: number, unitPrice: number, added: number, overflow: number, basketId: string|null, after: number}
 *   | {ok: false, needsConfirm: true, itemId: string, unitPrice: number}
 *   | {ok: false, reason: 'unknown-shop'|'unknown-item'|'unpriced'|'closed'|'not-stocked'|'sold-out'|'daily-cap'|'not-sold'|'already-held'|'insufficient', left?: number, short?: number}}
 */
export function buy(world, shopId, itemId, n = 1, ctx) {
  assertId(shopId, 'shops.buy');
  assertId(itemId, 'shops.buy');
  assertCount(n, 'shops.buy');
  const t = tuningOf(ctx);
  const row = shopRow(shopId, ctx);
  if (!row) return { ok: false, reason: 'unknown-shop' };
  const it = item(itemId, ctx);
  if (!it) return { ok: false, reason: 'unknown-item' };
  if (!isPriced(it)) return { ok: false, reason: 'unpriced' };
  if (!ctx?.anyHour && !isOpen(world, row, ctx)) return { ok: false, reason: 'closed' };
  if (!soldOnDial(world, it, ctx)) return { ok: false, reason: 'not-sold' };
  const day = dayOf(world, ctx, t);
  const line = stockFor(world, row, day, ctx).find((l) => l.item === itemId);
  if (!line) return { ok: false, reason: 'not-stocked' };
  const key = `${row.id}/${itemId}`;
  const rowLeft = line.qty === null ? Infinity : line.qty - counter(world, 'sold', key, day);
  if (n > rowLeft) return { ok: false, reason: 'sold-out', left: Math.max(0, rowLeft) };
  if (bag.isOneOfAKind(it) && (n > 1 || bag.count(world, itemId, { baskets: true }, ctx) > 0)) return { ok: false, reason: 'already-held' };
  const unitPrice = buyPrice(it, row);
  const dial = String(ctx?.dial ?? world.run.dial);
  if (dial === t.freefallDial && bag.pocketOf(it, ctx) === t.discPocket && unitPrice > t.freefallDiscConfirmAbove && ctx?.confirm !== true) {
    return { ok: false, needsConfirm: true, itemId, unitPrice };
  }
  const currency = bag.walletCurrencyOf(it);
  const sub = { ...ctx, unitPrice, source: ctx?.source ?? `shop:${row.id}` };
  /** @type {{added: number, overflow: number, basketId: string|null}} */
  let got;
  if (currency === 'starsalt') {
    const r = wallet.buyStarsalt(world, n, sub);
    if (!r.ok) return r.reason === 'daily-cap' ? { ok: false, reason: 'daily-cap', left: r.leftToday } : { ok: false, reason: 'insufficient', short: r.cost - r.balance };
    got = { added: n, overflow: 0, basketId: null };
  } else if (currency === 'anchors') {
    const r = wallet.buyAnchors(world, n, sub);
    if (!r.ok) return r.reason === 'not-sold' ? { ok: false, reason: 'not-sold' } : { ok: false, reason: 'insufficient', short: r.cost - r.balance };
    got = { added: n, overflow: 0, basketId: null };
  } else {
    const paid = wallet.spend(world, unitPrice * n, sub);
    if (!paid.ok) return { ok: false, reason: 'insufficient', short: paid.short };
    const g = bag.give(world, itemId, n, sub);
    got = g.ok ? { added: g.added, overflow: g.overflow, basketId: g.basketId } : { added: 0, overflow: 0, basketId: null };
  }
  rollover(world, day);
  world.shops.sold[key] = (world.shops.sold[key] ?? 0) + n;
  emit(ctx, 'shop:bought', { shopId: row.id, itemId, n, spent: unitPrice * n });
  return { ok: true, spent: unitPrice * n, unitPrice, ...got, after: world.wallet.main };
}

/**
 * Sells `n` of an item to an open shop that buys it, at full value for goods (Wanted Today +50% for
 * up to one stack a day) and at the `sell` price otherwise. One-of-a-kind items ask first.
 * @param {World} world
 * @param {string} shopId
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {EconCtx & {anyHour?: boolean}} [ctx]
 * @returns {{ok: true, earned: number, wantedUnits: number, after: number, left: number}
 *   | {ok: false, needsConfirm: true, itemId: string}
 *   | {ok: false, reason: 'unknown-shop'|'unknown-item'|'closed'|'not-buying'|'worthless'|'not-enough', have?: number}}
 */
export function sell(world, shopId, itemId, n = 1, ctx) {
  assertId(shopId, 'shops.sell');
  assertId(itemId, 'shops.sell');
  assertCount(n, 'shops.sell');
  const t = tuningOf(ctx);
  const row = shopRow(shopId, ctx);
  if (!row) return { ok: false, reason: 'unknown-shop' };
  const it = item(itemId, ctx);
  if (!it) return { ok: false, reason: 'unknown-item' };
  if (!ctx?.anyHour && !isOpen(world, row, ctx)) return { ok: false, reason: 'closed' };
  if (!buysItem(row, it)) return { ok: false, reason: 'not-buying' };
  if (sellValue(it, ctx) <= 0) return { ok: false, reason: 'worthless' };
  const quote = sellQuote(world, row, itemId, n, ctx);
  const took = bag.take(world, itemId, n, { ...ctx, source: ctx?.source ?? `sell:${row.id}` });
  if (!took.ok) return 'needsConfirm' in took ? took : { ok: false, reason: 'not-enough', have: took.have };
  const day = dayOf(world, ctx, t);
  rollover(world, day);
  if (quote.wantedUnits > 0) world.shops.wantedSold[itemId] = (world.shops.wantedSold[itemId] ?? 0) + quote.wantedUnits;
  if (quote.total > 0) wallet.earn(world, quote.total, { ...ctx, source: ctx?.source ?? `sell:${row.id}` });
  emit(ctx, 'shop:sold', { shopId: row.id, itemId, n, earned: quote.total, wanted: quote.wantedUnits });
  return { ok: true, earned: quote.total, wantedUnits: quote.wantedUnits, after: world.wallet.main, left: took.left };
}

/**
 * The "After: n" preview for a buy or sell row, without changing anything.
 * @param {World} world
 * @param {string} shopId
 * @param {string} itemId
 * @param {number} n
 * @param {'buy'|'sell'} mode
 * @param {EconCtx} [ctx]
 * @returns {{unitPrice: number, total: number, afterMoney: number, afterCount: number, canAfford: boolean, wantedUnits: number}}
 */
export function preview(world, shopId, itemId, n, mode, ctx) {
  assertCount(n, 'shops.preview');
  const row = shopRow(shopId, ctx);
  const it = item(itemId, ctx);
  const have = bag.count(world, itemId, undefined, ctx);
  if (!row || !it) return { unitPrice: 0, total: 0, afterMoney: world.wallet.main, afterCount: have, canAfford: false, wantedUnits: 0 };
  if (mode === 'sell') {
    const q = sellQuote(world, row, itemId, Math.min(n, have), ctx);
    return { unitPrice: q.unit, total: q.total, afterMoney: world.wallet.main + q.total, afterCount: Math.max(0, have - n), canAfford: have >= n, wantedUnits: q.wantedUnits };
  }
  const unitPrice = buyPrice(it, row);
  const total = unitPrice * n;
  return { unitPrice, total, afterMoney: world.wallet.main - total, afterCount: have + n, canAfford: world.wallet.main >= total, wantedUnits: 0 };
}

/**
 * @typedef {Object} ListingRow
 * @property {string} item  @property {string} name  @property {number} price  @property {string} pocket
 * @property {number|null} left        buyable today (null = unlimited)
 * @property {number} have             in the satchel now
 * @property {number} after            buttons after buying one ("After: n")
 * @property {boolean} canAfford
 * @property {boolean} staple
 * @property {boolean} confirm         buying asks first (Freefall disc above the line)
 * @property {string|null} move        disc listings: the move id it teaches
 * @property {string|null} moveName
 * @property {string[]|null} learners  creature uids that can learn it (when `ctx.learnersOf` is given)
 */

/**
 * Today's buy list for a shop, ready for the shop scene.
 * @param {World} world
 * @param {string} shopId
 * @param {EconCtx & {learnersOf?: (moveId: string) => string[]}} [ctx]
 * @returns {ListingRow[]}
 */
export function listing(world, shopId, ctx) {
  const row = shopRow(shopId, ctx);
  if (!row) return [];
  const t = tuningOf(ctx);
  const lk = lookup(ctx?.data);
  const dial = String(ctx?.dial ?? world.run.dial);
  return stockFor(world, row, undefined, ctx).flatMap((line) => {
    const it = item(line.item, ctx);
    if (!it || !isPriced(it) || !soldOnDial(world, it, ctx)) return [];
    const price = buyPrice(it, row);
    const left = leftToday(world, row, line.item, ctx);
    const pocket = bag.pocketOf(it, ctx);
    const move = typeof it.move === 'string' ? it.move : null;
    return [{
      item: line.item,
      name: typeof it.name === 'string' ? it.name : line.item,
      price,
      pocket,
      left: left === Infinity ? null : left,
      have: bag.count(world, line.item, undefined, ctx),
      after: world.wallet.main - price,
      canAfford: world.wallet.main >= price,
      staple: line.staple,
      confirm: dial === t.freefallDial && pocket === t.discPocket && price > t.freefallDiscConfirmAbove,
      move,
      moveName: move ? lk.row('moves', move)?.name ?? null : null,
      learners: move && typeof ctx?.learnersOf === 'function' ? ctx.learnersOf(move) : null,
    }];
  });
}

// ---------------------------------------------------------------------------------------------
// Refining (the Carnival Raft: skyglass relics into Starsalt, 1:1; GDD-00 §7, GDD-02 §1)
// ---------------------------------------------------------------------------------------------

/**
 * A shop's refining rule (`refine: {from: itemId[], to, rate}`), normalized, or null.
 * @param {ShopRow & {refine?: any}|null} row
 * @returns {{from: string[], to: string, rate: number}|null}
 */
export function refineRule(row) {
  const r = row && row.refine;
  if (!r || !Array.isArray(r.from) || typeof r.to !== 'string') return null;
  const rate = Number.isInteger(r.rate) && r.rate > 0 ? r.rate : 1;
  return { from: r.from.filter((id) => typeof id === 'string'), to: r.to, rate };
}

/**
 * The satchel lines a refiner takes: each refinable item held, with what it turns into. Pure.
 * @param {World} world
 * @param {string} shopId
 * @param {EconCtx} [ctx]
 * @returns {Array<{item: string, name: string, have: number, to: string, rate: number}>}
 */
export function refineRows(world, shopId, ctx) {
  const rule = refineRule(shopRow(shopId, ctx));
  if (!rule) return [];
  return rule.from.flatMap((id) => {
    const have = bag.count(world, id, undefined, ctx);
    if (have < 1) return [];
    const it = item(id, ctx);
    return [{ item: id, name: typeof it?.name === 'string' ? it.name : id, have, to: rule.to, rate: rule.rate }];
  });
}

/**
 * Refines `n` of a relic at an open refiner: the relics leave the satchel and `n × rate` of the
 * product arrive (Starsalt straight into the wallet; refining is not buying, so the 3-a-day
 * purchase cap does not apply). Emits `shop:refined {shopId, itemId, n, to, got}`.
 * @param {World} world
 * @param {string} shopId
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {EconCtx & {anyHour?: boolean}} [ctx]
 * @returns {{ok: true, got: number, to: string} | {ok: false, reason: 'unknown-shop'|'no-refining'|'not-refinable'|'closed'|'not-enough', have?: number}}
 */
export function refine(world, shopId, itemId, n = 1, ctx) {
  assertId(shopId, 'shops.refine');
  assertId(itemId, 'shops.refine');
  assertCount(n, 'shops.refine');
  const row = shopRow(shopId, ctx);
  if (!row) return { ok: false, reason: 'unknown-shop' };
  const rule = refineRule(row);
  if (!rule) return { ok: false, reason: 'no-refining' };
  if (!rule.from.includes(itemId)) return { ok: false, reason: 'not-refinable' };
  if (!ctx?.anyHour && !isOpen(world, row, ctx)) return { ok: false, reason: 'closed' };
  const have = bag.count(world, itemId, undefined, ctx);
  if (have < n) return { ok: false, reason: 'not-enough', have };
  const took = bag.take(world, itemId, n, { ...ctx, source: `refine:${row.id}`, confirm: true });
  if (!took.ok) return { ok: false, reason: 'not-enough', have };
  const got = n * rule.rate;
  const to = item(rule.to, ctx);
  const currency = to ? bag.walletCurrencyOf(to) : null;
  if (currency) wallet.earn(world, got, { ...ctx, currency, source: `refine:${row.id}` });
  else bag.give(world, rule.to, got, { ...ctx, source: `refine:${row.id}` });
  emit(ctx, 'shop:refined', { shopId: row.id, itemId, n, to: rule.to, got });
  return { ok: true, got, to: rule.to };
}

// ---------------------------------------------------------------------------------------------
// Consignment Crate
// ---------------------------------------------------------------------------------------------

/**
 * What the Crate would pay overnight for one line: `floor(sellValue × n × crateRate)`.
 * @param {Record<string, any>|null} itemRow
 * @param {number} n
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function crateValue(itemRow, n, ctx) {
  if (!itemRow) return 0;
  return Math.floor(sellValue(itemRow, ctx) * n * tuningOf(ctx).crateRate);
}

/**
 * Puts `n` of an item in the Crate at your gate (anything with a value; one-of-a-kind asks first).
 * @param {World} world
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, inCrate: number, estimate: number} | {ok: false, needsConfirm: true, itemId: string}
 *   | {ok: false, reason: 'unknown-item'|'worthless'|'not-enough', have?: number}}
 */
export function crateDeposit(world, itemId, n = 1, ctx) {
  assertId(itemId, 'shops.crateDeposit');
  assertCount(n, 'shops.crateDeposit');
  const it = item(itemId, ctx);
  if (!it) return { ok: false, reason: 'unknown-item' };
  if (crateValue(it, 1, ctx) <= 0 && sellValue(it, ctx) <= 0) return { ok: false, reason: 'worthless' };
  const took = bag.take(world, itemId, n, { ...ctx, source: ctx?.source ?? 'crate' });
  if (!took.ok) return 'needsConfirm' in took ? took : { ok: false, reason: 'not-enough', have: took.have };
  const line = world.shops.crate.find((s) => s.id === itemId);
  if (line) line.n += n;
  else world.shops.crate.push({ id: itemId, n });
  emit(ctx, 'crate:changed', { items: world.shops.crate.map((s) => ({ ...s })) });
  return { ok: true, inCrate: world.shops.crate.find((s) => s.id === itemId)?.n ?? n, estimate: crateEstimate(world, ctx) };
}

/**
 * Takes `n` of an item back out of the Crate before it sells (spills to the basket when full).
 * @param {World} world
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, returned: number, overflow: number} | {ok: false, reason: 'not-in-crate', have: number}}
 */
export function crateWithdraw(world, itemId, n = 1, ctx) {
  assertId(itemId, 'shops.crateWithdraw');
  assertCount(n, 'shops.crateWithdraw');
  const idx = world.shops.crate.findIndex((s) => s.id === itemId);
  const have = idx >= 0 ? world.shops.crate[idx].n : 0;
  if (have < n) return { ok: false, reason: 'not-in-crate', have };
  world.shops.crate[idx].n -= n;
  if (world.shops.crate[idx].n === 0) world.shops.crate.splice(idx, 1);
  const g = bag.give(world, itemId, n, { ...ctx, source: ctx?.source ?? 'crate' });
  emit(ctx, 'crate:changed', { items: world.shops.crate.map((s) => ({ ...s })) });
  return { ok: true, returned: g.ok ? g.added + g.overflow : 0, overflow: g.ok ? g.overflow : 0 };
}

/**
 * What the Crate would pay if it sold now.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function crateEstimate(world, ctx) {
  return world.shops.crate.reduce((s, line) => s + crateValue(item(line.id, ctx), line.n, ctx), 0);
}

/**
 * Sells the Crate overnight (the 06:00 result): pays every line at 90% and empties it.
 * Lines whose item is unknown to the data stay in the Crate.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{earned: number, lines: Array<{id: string, n: number, earned: number}>}}
 */
export function settleCrate(world, ctx) {
  /** @type {Array<{id: string, n: number, earned: number}>} */
  const lines = [];
  /** @type {ItemStack[]} */
  const kept = [];
  for (const line of world.shops.crate) {
    const it = item(line.id, ctx);
    if (!it) {
      kept.push(line);
      continue;
    }
    lines.push({ id: line.id, n: line.n, earned: crateValue(it, line.n, ctx) });
  }
  const earned = lines.reduce((s, l) => s + l.earned, 0);
  world.shops.crate = kept;
  if (earned > 0) wallet.earn(world, earned, { ...ctx, source: ctx?.source ?? 'crate' });
  if (lines.length) emit(ctx, 'crate:settled', { earned, lines: lines.map((l) => ({ ...l })) });
  return { earned, lines };
}

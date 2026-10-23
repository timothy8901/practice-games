/**
 * The satchel (`world.bag`): pockets, stacks, slots, the overflow basket and item use. [RULES-ECON]
 *
 * GDD-00 §13 / §15 and the Porchlight hands rules:
 *  - **Pockets**: the satchel tabs are Wicks, Medicine, Discs, Finds, Held and Keepsakes
 *    ({@link SATCHEL_TABS}); tool-ring items live in the untabbed `tools` pocket. An item's pocket is
 *    its data row's `pocket`.
 *  - **Slots**: 20 shared slots (one stack each) across the slotted pockets, expandable to 40
 *    ({@link expand}: the cottage and the Cellar each add 10). Keepsakes and tools take no slot, so a
 *    one-of-a-kind thing can never spill.
 *  - **Items** are rows of the `items` table or, for what the player gathers (fish, bugs, finds,
 *    fruit), of the `collections` table (`systems/econ.itemOf`); a collection row without `pocket`
 *    goes to `bagDefaultPocket` (Finds).
 *  - **Stacks**: fruit and shells stack to 10 (`stackByKind` on the row's `kind`, then `stackByGroup`
 *    on its `group`, so the collections' shore finds count as shells; both win over the row);
 *    everything else stacks to its row's `stack` (wicks per data), else `stackMax`. One-of-a-kind items
 *    stack to 1 and you can hold only one.
 *  - **Overflow**: what does not fit drops into a **basket at your feet**, a world-map item
 *    (`world.bag.baskets`, at the player's tile or `ctx.at`) picked up with {@link takeBasket}. A give
 *    never fails for space and never stops on a prompt.
 *  - **One-of-a-kind** (`oneOfAKind: true`): spending one returns `{ok: false, needsConfirm: true}`
 *    and changes nothing until the call is repeated with `ctx.confirm: true` (cursor on No is the
 *    scene's job).
 *  - **Currency items**: a row with `wallet: 'starsalt' | 'anchors' | 'main'` is money, not a stack;
 *    give / take route to `systems/wallet`.
 *
 * Every function is `fn(world, ...args, ctx?)` (see `systems/econ` EconCtx), mutates only
 * `world.bag` (plus `world.wallet` through `systems/wallet` for currency items) and emits
 * `bag:changed` `{itemId, pocket, delta, count, overflow, basketId, source}` after a change.
 *
 * Pure: no DOM, no randomness.
 * @module systems/bag
 */

import { POCKET_IDS } from '../state/schema.js';
import { makeTuning, itemOf, knowsItems, dayOf, emit, assertCount, assertId, deepFreeze, is } from './econ.js';
import * as wallet from './wallet.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').ItemStack} ItemStack */
/** @typedef {import('../state/schema.js').Basket} Basket */
/** @typedef {import('./econ.js').EconCtx} EconCtx */

/** Satchel tabs in display order (GDD-00 §13). Pockets never remember a cursor; that is the scene's rule. */
export const SATCHEL_TABS = Object.freeze(['wicks', 'medicine', 'discs', 'finds', 'held', 'keepsakes']);
/** Every pocket the schema guarantees (the tabs plus `tools`). */
export { POCKET_IDS };

/**
 * Designer defaults (GDD-00 §13 satchel 20 -> 40; Porchlight: fruit and shells stack to 10).
 * @type {Readonly<{bagSlotsBase: number, bagSlotsMax: number, bagUnslottedPockets: readonly string[],
 *   stackByKind: Readonly<Record<string, number>>, stackByGroup: Readonly<Record<string, number>>, stackMax: number,
 *   bagDefaultPocket: string}>}
 */
export const DEFAULTS = deepFreeze({
  bagSlotsBase: 20,                            // §13: 20 slots
  bagSlotsMax: 40,                             // §13: expandable to 40
  bagUnslottedPockets: ['keepsakes', 'tools'], // never count against slots, never spill
  stackByKind: { fruit: 10, shell: 10 },       // fruit and shells stack to 10 (wins over the row)
  stackByGroup: { shore: 10 },                 // collections' shore finds (cockles, whelks, ...) are the shells
  stackMax: 99,                                // stack limit for a row without `stack`
  bagDefaultPocket: 'finds',                   // pocket for a row without `pocket` / without data
});

/** @type {Record<string, [(v: any) => boolean, string]>} */
const SPEC = {
  bagSlotsBase: [is.nonNegInt, 'integer >= 0'],
  bagSlotsMax: [is.nonNegInt, 'integer >= 0'],
  bagUnslottedPockets: [is.ids, 'pocket id[]'],
  stackByKind: [(v) => is.intRecord(v) && Object.values(v).every((x) => x >= 1), 'Record<kind, integer >= 1>'],
  stackByGroup: [(v) => is.intRecord(v) && Object.values(v).every((x) => x >= 1), 'Record<group, integer >= 1>'],
  stackMax: [is.posInt, 'integer >= 1'],
  bagDefaultPocket: [is.id, 'pocket id'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * Resolved tuning for a context (`ctx.tuning` > `data.tuning` > {@link DEFAULTS}).
 * @type {(ctx?: EconCtx|null) => Readonly<typeof DEFAULTS & {econDayStartMinute: number}>}
 */
export const tuningOf = makeTuning('bag', DEFAULTS, SPEC);

// ---------------------------------------------------------------------------------------------
// Item facts
// ---------------------------------------------------------------------------------------------

/**
 * The item row for an id (`items`, else `collections`), or `null` (no data, or an unknown id).
 * @param {string} itemId
 * @param {EconCtx} [ctx]
 * @returns {Record<string, any>|null}
 */
export function itemRow(itemId, ctx) {
  return itemOf(ctx?.data, itemId);
}

/**
 * Resolves an id to its row, a generic row when the data has no item table at all, or `null` when
 * item tables exist and none has the id.
 * @param {string} itemId
 * @param {EconCtx|undefined} ctx
 * @returns {Record<string, any>|null}
 */
function resolveItem(itemId, ctx) {
  const row = itemOf(ctx?.data, itemId);
  if (row) return row;
  return knowsItems(ctx?.data) ? null : { id: itemId };
}

/**
 * The pocket an item lives in.
 * @param {Record<string, any>|null} item
 * @param {EconCtx} [ctx]
 * @returns {string}
 */
export function pocketOf(item, ctx) {
  return item && typeof item.pocket === 'string' && item.pocket ? item.pocket : tuningOf(ctx).bagDefaultPocket;
}

/**
 * Stack limit of an item: 1 for one-of-a-kind, the kind rule (fruit/shell 10), the group rule (shore
 * finds 10), the row's `stack`, else `stackMax`.
 * @param {Record<string, any>|null} item
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function stackLimit(item, ctx) {
  const t = tuningOf(ctx);
  if (item?.oneOfAKind) return 1;
  if (item && typeof item.kind === 'string' && Object.hasOwn(t.stackByKind, item.kind)) return t.stackByKind[item.kind];
  if (item && typeof item.group === 'string' && Object.hasOwn(t.stackByGroup, item.group)) return t.stackByGroup[item.group];
  if (item && Number.isInteger(item.stack) && item.stack >= 1) return item.stack;
  return t.stackMax;
}

/**
 * Whether an item is one-of-a-kind.
 * @param {Record<string, any>|null} item
 * @returns {boolean}
 */
export function isOneOfAKind(item) {
  return item?.oneOfAKind === true;
}

/**
 * The wallet currency a currency item maps to, or null for an ordinary item.
 * @param {Record<string, any>|null} item
 * @returns {string|null}
 */
export function walletCurrencyOf(item) {
  const c = item?.wallet;
  return typeof c === 'string' && wallet.SPENDABLE.includes(c) ? c : null;
}

// ---------------------------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------------------------

/**
 * Satchel slot totals.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{total: number, used: number, free: number, max: number, extra: number}}
 */
export function slots(world, ctx) {
  const t = tuningOf(ctx);
  const total = Math.min(t.bagSlotsMax, t.bagSlotsBase + world.bag.extraSlots);
  let used = 0;
  for (const [pocket, stacks] of Object.entries(world.bag.pockets)) {
    if (!t.bagUnslottedPockets.includes(pocket)) used += stacks.length;
  }
  return { total, used, free: Math.max(0, total - used), max: t.bagSlotsMax, extra: world.bag.extraSlots };
}

/**
 * Adds satchel slots (a build's reward), never past `bagSlotsMax`.
 * @param {World} world
 * @param {number} by      positive integer
 * @param {EconCtx} [ctx]
 * @returns {{added: number, total: number}}
 */
export function expand(world, by, ctx) {
  assertCount(by, 'bag.expand');
  const t = tuningOf(ctx);
  const before = slots(world, ctx).total;
  const room = Math.max(0, t.bagSlotsMax - t.bagSlotsBase - world.bag.extraSlots);
  world.bag.extraSlots += Math.min(by, room);
  const total = slots(world, ctx).total;
  if (total !== before) emit(ctx, 'bag:changed', { itemId: null, pocket: null, delta: 0, count: 0, overflow: 0, basketId: null, slots: total, source: ctx?.source ?? 'expand' });
  return { added: total - before, total };
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

/**
 * Count of an item in the satchel (and, with `opts.baskets`, in every basket too).
 * Currency items read the wallet.
 * @param {World} world
 * @param {string} itemId
 * @param {{baskets?: boolean}} [opts]
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function count(world, itemId, opts, ctx) {
  const cur = walletCurrencyOf(itemRow(itemId, ctx));
  if (cur) return world.wallet[cur];
  let n = 0;
  for (const stacks of Object.values(world.bag.pockets)) for (const s of stacks) if (s.id === itemId) n += s.n;
  if (opts?.baskets) for (const b of world.bag.baskets) for (const s of b.items) if (s.id === itemId) n += s.n;
  return n;
}

/**
 * Whether the satchel holds at least `n` of an item.
 * @param {World} world
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {{baskets?: boolean}} [opts]
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function has(world, itemId, n = 1, opts, ctx) {
  return count(world, itemId, opts, ctx) >= n;
}

/**
 * A copy of one pocket's stacks, in order.
 * @param {World} world
 * @param {string} pocket
 * @returns {ItemStack[]}
 */
export function pocketList(world, pocket) {
  return (world.bag.pockets[pocket] ?? []).map((s) => ({ id: s.id, n: s.n }));
}

/**
 * How many of an item would go into the satchel right now without spilling into a basket.
 * @param {World} world
 * @param {string} itemId
 * @param {EconCtx} [ctx]
 * @returns {number}  `Infinity` for currency items
 */
export function roomFor(world, itemId, ctx) {
  const item = resolveItem(itemId, ctx);
  if (!item) return 0;
  if (walletCurrencyOf(item)) return Infinity;
  const ooak = isOneOfAKind(item);
  if (ooak && count(world, itemId, { baskets: true }, ctx) > 0) return 0;
  const t = tuningOf(ctx);
  const pocket = pocketOf(item, ctx);
  const limit = stackLimit(item, ctx);
  const stacks = world.bag.pockets[pocket] ?? [];
  let room = 0;
  for (const s of stacks) if (s.id === itemId && s.n < limit) room += limit - s.n;
  const cap = world.bag.capacity[pocket] ?? 0;
  const pocketRoom = cap > 0 ? Math.max(0, cap - stacks.length) : Infinity;
  const slotRoom = t.bagUnslottedPockets.includes(pocket) ? Infinity : slots(world, ctx).free;
  const newStacks = Math.min(pocketRoom, slotRoom);
  const total = newStacks === Infinity ? Infinity : room + newStacks * limit;
  return ooak ? Math.min(1, total) : total;
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

/**
 * @param {World} world
 * @param {string} pocket
 * @returns {ItemStack[]}
 */
function ensurePocket(world, pocket) {
  if (!Array.isArray(world.bag.pockets[pocket])) world.bag.pockets[pocket] = [];
  if (!Number.isInteger(world.bag.capacity[pocket])) world.bag.capacity[pocket] = 0;
  return world.bag.pockets[pocket];
}

/**
 * Places up to `n` into the satchel (topping up partial stacks, then new stacks while slots allow).
 * @param {World} world
 * @param {Record<string, any>} item
 * @param {number} n
 * @param {EconCtx|undefined} ctx
 * @returns {number} how many were placed
 */
function place(world, item, n, ctx) {
  const t = tuningOf(ctx);
  const pocket = pocketOf(item, ctx);
  const limit = stackLimit(item, ctx);
  const stacks = ensurePocket(world, pocket);
  let left = n;
  for (const s of stacks) {
    if (left === 0) break;
    if (s.id !== item.id || s.n >= limit) continue;
    const put = Math.min(limit - s.n, left);
    s.n += put;
    left -= put;
  }
  const unslotted = t.bagUnslottedPockets.includes(pocket);
  const cap = world.bag.capacity[pocket] ?? 0;
  while (left > 0 && (cap === 0 || stacks.length < cap) && (unslotted || slots(world, ctx).free > 0)) {
    const put = Math.min(limit, left);
    stacks.push({ id: item.id, n: put });
    left -= put;
  }
  return n - left;
}

/**
 * The basket at a tile, created when absent.
 * @param {World} world
 * @param {{mapId: string, x: number, y: number}} at
 * @param {EconCtx|undefined} ctx
 * @returns {Basket}
 */
function basketAt(world, at, ctx) {
  const found = world.bag.baskets.find((b) => b.mapId === at.mapId && b.x === at.x && b.y === at.y);
  if (found) return found;
  world.bag.basketSeq += 1;
  /** @type {Basket} */
  const b = { id: `b${world.bag.basketSeq}`, mapId: at.mapId, x: at.x, y: at.y, day: dayOf(world, ctx, tuningOf(ctx)), items: [] };
  world.bag.baskets.push(b);
  return b;
}

/**
 * @param {World} world
 * @param {EconCtx|undefined} ctx
 * @returns {{mapId: string, x: number, y: number}}
 */
function feetOf(world, ctx) {
  const at = ctx?.at;
  if (at && typeof at.mapId === 'string' && Number.isInteger(at.x) && Number.isInteger(at.y)) return { mapId: at.mapId, x: at.x, y: at.y };
  const p = world.player ?? {};
  return { mapId: typeof p.mapId === 'string' ? p.mapId : '', x: Number.isInteger(p.x) ? p.x : 0, y: Number.isInteger(p.y) ? p.y : 0 };
}

/**
 * @param {ItemStack[]} list
 * @param {string} id
 * @param {number} n
 */
function addTo(list, id, n) {
  const s = list.find((x) => x.id === id);
  if (s) s.n += n;
  else list.push({ id, n });
}

/**
 * Gives `n` of an item. What fits goes into the satchel; the rest drops into the basket at the
 * player's feet (or `ctx.at`). Never fails for lack of space. A second one-of-a-kind is refused.
 * Matches the script runner's `give(world, item, n, {data})` binding.
 *
 * @param {World} world
 * @param {string} itemId
 * @param {number} [n=1]  positive integer
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, itemId: string, pocket: string|null, added: number, overflow: number, basketId: string|null, currency?: string}
 *   | {ok: false, reason: 'unknown-item'|'already-held', itemId: string}}
 * @throws {TypeError|RangeError} for a malformed id or count
 */
export function give(world, itemId, n = 1, ctx) {
  assertId(itemId, 'bag.give');
  assertCount(n, 'bag.give');
  const item = resolveItem(itemId, ctx);
  if (!item) return { ok: false, reason: 'unknown-item', itemId };
  const currency = walletCurrencyOf(item);
  if (currency) {
    wallet.earn(world, n, { ...ctx, currency, source: ctx?.source ?? `give:${itemId}` });
    return { ok: true, itemId, pocket: null, added: n, overflow: 0, basketId: null, currency };
  }
  if (isOneOfAKind(item)) {
    if (count(world, itemId, { baskets: true }, ctx) > 0) return { ok: false, reason: 'already-held', itemId };
    n = 1;
  }
  const pocket = pocketOf(item, ctx);
  const added = place(world, item, n, ctx);
  const overflow = n - added;
  let basketId = null;
  if (overflow > 0) {
    const b = basketAt(world, feetOf(world, ctx), ctx);
    addTo(b.items, itemId, overflow);
    basketId = b.id;
  }
  emit(ctx, 'bag:changed', { itemId, pocket, delta: added, count: count(world, itemId, undefined, ctx), overflow, basketId, source: ctx?.source ?? 'give' });
  return { ok: true, itemId, pocket, added, overflow, basketId };
}

/**
 * Removes `n` of an item from the satchel (baskets are never spent from). All or nothing.
 * One-of-a-kind items need `ctx.confirm`. Matches the script runner's `take` binding.
 *
 * @param {World} world
 * @param {string} itemId
 * @param {number} [n=1]  positive integer
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, itemId: string, taken: number, left: number}
 *   | {ok: false, needsConfirm: true, itemId: string}
 *   | {ok: false, reason: 'unknown-item'|'not-enough', itemId: string, have?: number}}
 * @throws {TypeError|RangeError} for a malformed id or count
 */
export function take(world, itemId, n = 1, ctx) {
  assertId(itemId, 'bag.take');
  assertCount(n, 'bag.take');
  const item = resolveItem(itemId, ctx);
  if (!item) return { ok: false, reason: 'unknown-item', itemId };
  const currency = walletCurrencyOf(item);
  if (currency) {
    const r = wallet.spend(world, n, { ...ctx, currency, source: ctx?.source ?? `take:${itemId}` });
    return r.ok ? { ok: true, itemId, taken: n, left: r.balance } : { ok: false, reason: 'not-enough', itemId, have: r.balance };
  }
  const have = count(world, itemId, undefined, ctx);
  if (have < n) return { ok: false, reason: 'not-enough', itemId, have };
  if (isOneOfAKind(item) && ctx?.confirm !== true) return { ok: false, needsConfirm: true, itemId };
  let left = n;
  /** @type {string|null} */
  let pocketHit = null;
  for (const [pocket, stacks] of Object.entries(world.bag.pockets)) {
    for (let i = stacks.length - 1; i >= 0 && left > 0; i--) {
      const s = stacks[i];
      if (s.id !== itemId) continue;
      pocketHit ??= pocket;
      const cut = Math.min(s.n, left);
      s.n -= cut;
      left -= cut;
      if (s.n === 0) stacks.splice(i, 1);
    }
    if (left === 0) break;
  }
  const after = have - n;
  emit(ctx, 'bag:changed', { itemId, pocket: pocketHit, delta: -n, count: after, overflow: 0, basketId: null, source: ctx?.source ?? 'take' });
  return { ok: true, itemId, taken: n, left: after };
}

/**
 * "Let it go": discards `n` of an item for good (one-of-a-kind still asks first).
 * @param {World} world
 * @param {string} itemId
 * @param {number} [n=1]
 * @param {EconCtx} [ctx]
 * @returns {ReturnType<typeof take>}
 */
export function toss(world, itemId, n = 1, ctx) {
  return take(world, itemId, n, { ...ctx, source: ctx?.source ?? 'toss' });
}

// ---------------------------------------------------------------------------------------------
// Baskets
// ---------------------------------------------------------------------------------------------

/**
 * Copies of the baskets lying on a map (all maps when `mapId` is omitted).
 * @param {World} world
 * @param {string} [mapId]
 * @returns {Basket[]}
 */
export function baskets(world, mapId) {
  return world.bag.baskets
    .filter((b) => mapId === undefined || b.mapId === mapId)
    .map((b) => ({ ...b, items: b.items.map((s) => ({ id: s.id, n: s.n })) }));
}

/**
 * Picks a basket up: moves what fits back into the satchel; whatever does not fit stays in the
 * basket, which disappears once empty.
 * @param {World} world
 * @param {string} basketId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, moved: ItemStack[], left: ItemStack[], removed: boolean} | {ok: false, reason: 'no-basket'}}
 */
export function takeBasket(world, basketId, ctx) {
  const idx = world.bag.baskets.findIndex((b) => b.id === basketId);
  if (idx < 0) return { ok: false, reason: 'no-basket' };
  const b = world.bag.baskets[idx];
  /** @type {ItemStack[]} */
  const moved = [];
  for (const s of b.items) {
    const item = resolveItem(s.id, ctx) ?? { id: s.id };
    if (isOneOfAKind(item) && count(world, s.id, undefined, ctx) > 0) continue;
    const put = place(world, item, isOneOfAKind(item) ? Math.min(1, s.n) : s.n, ctx);
    if (put > 0) {
      s.n -= put;
      moved.push({ id: s.id, n: put });
      emit(ctx, 'bag:changed', { itemId: s.id, pocket: pocketOf(item, ctx), delta: put, count: count(world, s.id, undefined, ctx), overflow: 0, basketId, source: ctx?.source ?? 'basket' });
    }
  }
  b.items = b.items.filter((s) => s.n > 0);
  const removed = b.items.length === 0;
  if (removed) world.bag.baskets.splice(idx, 1);
  return { ok: true, moved, left: b.items.map((s) => ({ id: s.id, n: s.n })), removed };
}

/**
 * Tidies the satchel after a load or a content change: stacks move to the pocket their row names,
 * same-id stacks merge and re-split at the stack limit, and anything over the slot count spills into
 * a basket at the player's feet. Unknown ids are left where they are (the validator reports them).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{moved: number, spilled: number, basketId: string|null}}
 */
export function normalize(world, ctx) {
  const data = ctx?.data;
  /** @type {Array<{pocket: string, id: string, n: number}>} */
  const all = [];
  let moved = 0;
  for (const [pocket, stacks] of Object.entries(world.bag.pockets)) {
    for (const s of stacks) {
      const row = itemOf(data, s.id);
      const home = row ? pocketOf(row, ctx) : pocket;
      if (home !== pocket) moved += 1;
      const prev = all.find((e) => e.pocket === home && e.id === s.id);
      if (prev) prev.n += s.n;
      else all.push({ pocket: home, id: s.id, n: s.n });
    }
    stacks.length = 0;
  }
  let spilled = 0;
  /** @type {string|null} */
  let basketId = null;
  for (const e of all) {
    const item = itemOf(data, e.id) ?? { id: e.id, pocket: e.pocket };
    const put = place(world, { ...item, pocket: e.pocket }, e.n, ctx);
    if (put < e.n) {
      const b = basketAt(world, feetOf(world, ctx), ctx);
      addTo(b.items, e.id, e.n - put);
      basketId = b.id;
      spilled += e.n - put;
    }
  }
  if (moved || spilled) emit(ctx, 'bag:changed', { itemId: null, pocket: null, delta: 0, count: 0, overflow: spilled, basketId, source: ctx?.source ?? 'normalize' });
  return { moved, spilled, basketId };
}

// ---------------------------------------------------------------------------------------------
// Item use
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} UseHandler
 * @property {readonly ('field'|'battle')[]} contexts   where the item can be used
 * @property {'creature'|'none'} target                 what it is used on
 * @property {boolean} consume                          whether one is spent on success
 * @property {(item: Record<string, any>) => Record<string, any>} effect   the effect descriptor the caller applies
 */

/**
 * Item `use` handler keys (the validator checks every row's `use` against these). Handlers do not
 * touch creatures: they describe the effect, and the caller (battle / party scene) applies it through
 * the owning system, usually by passing `ctx.apply` to {@link use}. Row fields read: `amount`,
 * `fraction`, `cures`, `turns`, `move`, `type`.
 * @type {Readonly<Record<string, Readonly<UseHandler>>>}
 */
export const USE_HANDLERS = deepFreeze({
  // Wicks: one burns per Lantern raise; grade = capture odds multiplier key (tuning.lanternGrades).
  'capture:1': { contexts: ['battle'], target: 'none', consume: true, effect: () => ({ kind: 'wick', grade: 'capture:1' }) },
  'capture:2': { contexts: ['battle'], target: 'none', consume: true, effect: () => ({ kind: 'wick', grade: 'capture:2' }) },
  'capture:3': { contexts: ['battle'], target: 'none', consume: true, effect: () => ({ kind: 'wick', grade: 'capture:3' }) },
  // Salve / Tonic / Full Salve: `amount` HP, or full when absent.
  heal: { contexts: ['field', 'battle'], target: 'creature', consume: true, effect: (it) => ({ kind: 'heal', amount: Number.isInteger(it.amount) ? it.amount : null }) },
  // Revive: back from fainted at `fraction` of max HP (default 0.5).
  revive: { contexts: ['field', 'battle'], target: 'creature', consume: true, effect: (it) => ({ kind: 'revive', fraction: typeof it.fraction === 'number' ? it.fraction : 0.5 }) },
  // Ether / Full Ether: `amount` PP to every move, or full when absent.
  pp: { contexts: ['field', 'battle'], target: 'creature', consume: true, effect: (it) => ({ kind: 'pp', amount: Number.isInteger(it.amount) ? it.amount : null }) },
  // Poultice (burn, poison) / Warm Shawl (chill, numb): `cures` lists the statuses.
  cure: { contexts: ['field', 'battle'], target: 'creature', consume: true, effect: (it) => ({ kind: 'cure', statuses: Array.isArray(it.cures) ? [...it.cures] : [] }) },
  // Crackdust: suppresses the foe's Ward for `turns` (default 3).
  'ward-suppress': { contexts: ['battle'], target: 'none', consume: true, effect: (it) => ({ kind: 'ward-suppress', turns: Number.isInteger(it.turns) ? it.turns : 3 }) },
  // Held items (Still Knot, type tilts): moved onto a creature.
  hold: { contexts: ['field'], target: 'creature', consume: true, effect: (it) => ({ kind: 'hold', item: it.id, type: typeof it.type === 'string' ? it.type : null }) },
  // Technique discs: reusable; teach `move`.
  disc: { contexts: ['field'], target: 'creature', consume: false, effect: (it) => ({ kind: 'teach', move: typeof it.move === 'string' ? it.move : null }) },
  // Isolde's Lantern: one sure catch (a Keepsake: asks first).
  'sure-catch': { contexts: ['battle'], target: 'none', consume: true, effect: () => ({ kind: 'sure-catch' }) },
  // Key items and tools: used through their verb, never consumed.
  key: { contexts: ['field'], target: 'none', consume: false, effect: (it) => ({ kind: 'key', item: it.id }) },
});

/**
 * Uses one item. Validates ownership, handler, context and the one-of-a-kind confirm, then builds
 * the effect. With `ctx.apply(effect, item)` the effect is applied right away and one is spent on
 * success (a return of `false` or `{ok: false}` means "did nothing", so nothing is spent); without
 * it the effect is returned and nothing is spent (call {@link take} after applying).
 *
 * @param {World} world
 * @param {string} itemId
 * @param {EconCtx & {context?: 'field'|'battle', apply?: (effect: Record<string, any>, item: Record<string, any>) => any}} [ctx]
 * @returns {{ok: true, effect: Record<string, any>, target: string, consumed: boolean, applied: any}
 *   | {ok: false, needsConfirm: true, itemId: string}
 *   | {ok: false, reason: 'unknown-item'|'not-held'|'no-use'|'wrong-context'|'not-applied', itemId: string}}
 */
export function use(world, itemId, ctx) {
  assertId(itemId, 'bag.use');
  const item = resolveItem(itemId, ctx);
  if (!item) return { ok: false, reason: 'unknown-item', itemId };
  if (count(world, itemId, undefined, ctx) < 1) return { ok: false, reason: 'not-held', itemId };
  const handler = typeof item.use === 'string' ? USE_HANDLERS[item.use] : undefined;
  if (!handler) return { ok: false, reason: 'no-use', itemId };
  const where = ctx?.context ?? 'field';
  if (!handler.contexts.includes(where)) return { ok: false, reason: 'wrong-context', itemId };
  if (handler.consume && isOneOfAKind(item) && ctx?.confirm !== true) return { ok: false, needsConfirm: true, itemId };
  const effect = handler.effect(item);
  if (typeof ctx?.apply !== 'function') return { ok: true, effect, target: handler.target, consumed: false, applied: null };
  const applied = ctx.apply(effect, item);
  if (applied === false || (applied && typeof applied === 'object' && applied.ok === false)) return { ok: false, reason: 'not-applied', itemId };
  let consumed = false;
  if (handler.consume) consumed = take(world, itemId, 1, { ...ctx, confirm: true, source: ctx?.source ?? 'use' }).ok;
  return { ok: true, effect, target: handler.target, consumed, applied };
}

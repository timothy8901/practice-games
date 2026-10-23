// Shared fixture for the RULES-ECON tests: GDD-00-shaped items, shops and loans, and world helpers.
import { createNewWorld } from '../../js/state/schema.js';
import { createRegistry } from '../../js/data/registry.js';

/** Items shaped like the DATA-ECON rows the systems expect (§14.12 + the econ fields). */
export const ITEMS = Object.freeze([
  { id: 'tallow-wick', name: 'Tallow Wick', pocket: 'wicks', price: 100, sell: 50, stack: 20, use: 'capture:1', oneOfAKind: false, text: '' },
  { id: 'brass-wick', name: 'Brass Wick', pocket: 'wicks', price: 300, sell: 150, stack: 20, use: 'capture:2', oneOfAKind: false, text: '' },
  { id: 'skyglass-wick', name: 'Skyglass Wick', pocket: 'wicks', price: 600, sell: 300, stack: 20, use: 'capture:3', oneOfAKind: false, text: '' },
  { id: 'salve', name: 'Salve', pocket: 'medicine', price: 80, sell: 40, stack: 20, use: 'heal', amount: 20, oneOfAKind: false, text: '' },
  { id: 'full-salve', name: 'Full Salve', pocket: 'medicine', price: 600, sell: 300, stack: 20, use: 'heal', oneOfAKind: false, text: '' },
  { id: 'revive', name: 'Revive', pocket: 'medicine', price: 600, sell: 300, stack: 20, use: 'revive', oneOfAKind: false, text: '' },
  { id: 'ether', name: 'Ether', pocket: 'medicine', price: 250, sell: 125, stack: 20, use: 'pp', amount: 10, oneOfAKind: false, text: '' },
  { id: 'poultice', name: 'Poultice', pocket: 'medicine', price: 150, sell: 75, stack: 20, use: 'cure', cures: ['burn', 'poison'], oneOfAKind: false, text: '' },
  { id: 'crackdust', name: 'Crackdust', pocket: 'medicine', price: 300, sell: 150, stack: 20, use: 'ward-suppress', oneOfAKind: false, text: '' },
  { id: 'still-knot', name: 'Still Knot', pocket: 'held', price: 2000, sell: 1000, stack: 5, use: 'hold', oneOfAKind: false, text: '' },
  { id: 'disc-ember', name: 'Disc: Ember Bite', pocket: 'discs', price: 3000, sell: 1500, stack: 1, use: 'disc', move: 'ember-bite', oneOfAKind: false, text: '' },
  { id: 'disc-chip', name: 'Disc: Chip', pocket: 'discs', price: 1500, sell: 750, stack: 1, use: 'disc', move: 'chip', oneOfAKind: false, text: '' },
  { id: 'disc-gust', name: 'Disc: Gust', pocket: 'discs', price: 2000, sell: 1000, stack: 1, use: 'disc', move: 'gust', oneOfAKind: false, text: '' },
  { id: 'disc-tide', name: 'Disc: Tide', pocket: 'discs', price: 4000, sell: 2000, stack: 1, use: 'disc', move: 'tide', oneOfAKind: false, text: '' },
  { id: 'pear', name: 'Pear', kind: 'fruit', pocket: 'finds', price: 120, sell: 120, stack: 99, use: null, oneOfAKind: false, text: '' },
  { id: 'plum', name: 'Plum', kind: 'fruit', pocket: 'finds', price: 120, sell: 120, stack: 99, use: null, oneOfAKind: false, text: '' },
  { id: 'shell', name: 'Shell', kind: 'shell', pocket: 'finds', price: 100, sell: 100, stack: 99, use: null, oneOfAKind: false, text: '' },
  { id: 'john-dory', name: 'John Dory', kind: 'fish', pocket: 'finds', price: 2400, sell: 2400, stack: 5, use: null, oneOfAKind: false, text: '' },
  { id: 'ammonite', name: 'Ammonite', kind: 'fossil', pocket: 'finds', price: 800, sell: 800, stack: 1, use: null, oneOfAKind: false, text: '' },
  { id: 'moth', name: 'Moth', kind: 'bug', pocket: 'finds', price: 60, sell: 60, stack: 10, use: null, oneOfAKind: false, text: '' },
  { id: 'isolde-lantern', name: "Isolde's Lantern", pocket: 'keepsakes', price: 0, sell: 0, stack: 1, use: 'sure-catch', oneOfAKind: true, text: '' },
  { id: 'heirloom-bell', name: 'Ship Bell', pocket: 'keepsakes', price: 1000, sell: 500, stack: 1, use: null, oneOfAKind: true, text: '' },
  { id: 'reading-glass', name: 'Reading Glass', pocket: 'keepsakes', price: 0, sell: 0, stack: 1, use: 'key', oneOfAKind: true, text: '' },
  { id: 'rod', name: 'Rod', pocket: 'tools', price: 0, sell: 0, stack: 1, use: 'key', oneOfAKind: false, text: '' },
  { id: 'starsalt', name: 'Starsalt', pocket: 'keepsakes', wallet: 'starsalt', price: 800, sell: 0, stack: 99, use: null, oneOfAKind: false, text: '' },
  { id: 'anchor-stone', name: 'Anchor stone', pocket: 'keepsakes', wallet: 'anchors', price: 500, sell: 0, stack: 99, use: null, oneOfAKind: false, text: '' },
]);

/** GDD-00 §9 shops. */
export const SHOPS = Object.freeze([
  {
    id: 'pells', keeper: 'juniper', hours: [8 * 60, 22 * 60], priceMult: 1, wanted: true,
    buys: ['fish', 'fruit', 'bug', 'fossil', 'relic', 'shell'],
    rotations: { discs: 2 },
    stock: [
      { item: 'tallow-wick' }, { item: 'salve' }, { item: 'brass-wick' }, { item: 'anchor-stone' },
      { item: 'skyglass-wick', cond: { badge: 2 } }, { item: 'ether', cond: { badge: 3 } },
      { item: 'disc-ember', rotate: 'discs' }, { item: 'disc-chip', rotate: 'discs' },
      { item: 'disc-gust', rotate: 'discs' }, { item: 'disc-tide', rotate: 'discs' },
    ],
  },
  { id: 'ludo', keeper: 'ludo', hours: [22 * 60, 8 * 60], priceMult: 1, buysAll: true, buys: [], stock: [{ item: 'starsalt', qty: 3 }] },
  { id: 'raft', keeper: 'varga', hours: [12 * 60, 2 * 60], priceMult: 1, fromDay: 3, buys: ['relic'], stock: [{ item: 'starsalt' }] },
  { id: 'anchorage', keeper: 'merrow', hours: [7 * 60, 19 * 60], priceMult: 1.1, buys: [], stock: [{ item: 'anchor-stone' }, { item: 'still-knot' }] },
]);

/** GDD-00 §7 ladder in the `data/loans.js` row shape. */
export const LOANS = Object.freeze([
  { id: 'tier-1', tier: 1, amount: 6000, build: 'bedsit', clearFlags: ['sp.porch-lit'] },
  { id: 'tier-2', tier: 2, amount: 15000, build: 'cottage' },
  { id: 'tier-3', tier: 3, amount: 25000, commissionSlot: true },
  { id: 'tier-4', tier: 4, amount: 36000, commissionSlot: true },
  { id: 'tier-5', tier: 5, amount: 50000, commissionSlot: true },
  { id: 'tier-6', tier: 6, amount: 66000, commissionSlot: true },
  { id: 'tier-7', tier: 7, amount: 80000, build: 'lamp-room', buildFlags: ['sp.lamp-room'] },
]);

export const MOVES = Object.freeze([
  { id: 'ember-bite', name: 'Ember Bite' }, { id: 'chip', name: 'Chip' }, { id: 'gust', name: 'Gust' }, { id: 'tide', name: 'Tide' },
]);

/** Plain tables object (what most tests pass as `ctx.data`). */
export const TABLES = Object.freeze({ items: ITEMS, shops: SHOPS, loans: LOANS, moves: MOVES });
/** The same content behind the real registry. */
export const REGISTRY = createRegistry({ items: ITEMS, shops: SHOPS, loans: LOANS, moves: MOVES });

/** Registry-like for validateWorld that checks item ids only (maps/npcs are other lanes' content). */
export const ITEM_CHECK = Object.freeze({ has: (table, id) => (table === 'items' ? REGISTRY.has('items', id) : true) });

/** Minutes helpers. */
export const DAY = 1440;
/** @param {number} day clock day @param {number} h @param {number} [m] */
export const at = (day, h, m = 0) => day * DAY + h * 60 + m;

/**
 * A fresh world standing on a map tile, with an optional starting wallet.
 * @param {{main?: number, dial?: string, seedCode?: string}} [o]
 */
export function freshWorld(o = {}) {
  const w = createNewWorld({ seedCode: o.seedCode ?? 'ECON-TEST', dial: o.dial ?? 'flux' });
  w.player.mapId = 'harbor';
  w.player.x = 3;
  w.player.y = 4;
  w.wallet.main = o.main ?? 0;
  return w;
}

/** A recording bus. */
export function recBus() {
  const events = [];
  return { events, emit: (e, p) => { events.push([e, p]); }, of: (e) => events.filter(([n]) => n === e).map(([, p]) => p) };
}

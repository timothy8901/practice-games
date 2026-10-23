#!/usr/bin/env node
/**
 * LAMPFALL headless economy sim (GDD-00 §7 acceptance; GDD-02 §4.4). [DATA-ECON]
 *
 * Plays the season day by day for three player profiles (casual, typical, grinder) against the REAL
 * content tables and the REAL money systems:
 *  - income comes from the shipped rows: fruit and foreign trees (data/collections FRUIT, town TREES,
 *    a per-tree regrow / ripen model), purses and bee trees (town TREES), the Glint
 *    (`systems/wallet.collectGlint`), fish (data/collections FISH filtered by `systems/gather.rowActive`
 *    on the Pellwick map's reaches at the real tide, picking the biggest shadow class in view; reach
 *    health dips 10% a fish, floors at 40% and recovers linearly over a day, exactly as
 *    `systems/fishing`), bugs and finds (collections BUGS / FINDS; the first of each find is pinned on
 *    Barnaby's wall and never sold), skyglass at the real night lows (`clockSys.tidesForDay`,
 *    `gather.lowTouchesNight`), route trainers and Spires (data/trainers payouts), Porch Duels
 *    (town PORCH_DUELS curve × `porchDuelPerCurve`), Errants, Wanted Today and the Crate (tuning);
 *  - every button moves through `systems/wallet` and every credit through `systems/loans` (pay,
 *    errands, Spire and resident shares, commissions, one build a night at 05:40, the Relighting at the
 *    dusk the Lamp Room lands, the Commons Jar);
 *  - sinks are the shipped prices (items, shops, town FURNITURE, loans COMMONS).
 *
 * What a profile decides (how many trees, casts, duels, which days it climbs a Spire, what it buys) is
 * player behaviour, documented in PROFILES; everything a profile is paid or charged comes from data.
 * The sim is deterministic: expected values, with fractional events (a 0.5-a-day Errant) accumulated
 * Bresenham-style so they land on whole days.
 *
 * Usage:  node tools/economy-sim.mjs            all three profiles, summary + typical day table
 *         node tools/economy-sim.mjs casual     one profile's day table
 *         node tools/economy-sim.mjs --json     machine-readable results
 * @module tools/economy-sim
 */

import { TUNING } from '../js/data/tuning.js';
import { LOANS, COMMISSIONS, COMMONS } from '../js/data/loans.js';
import { ITEMS } from '../js/data/items.js';
import { FISH, BUGS, FINDS, FRUIT } from '../js/data/collections.js';
import { TREES, PORCH_DUELS, FURNITURE } from '../js/data/town.js';
import { TRAINERS } from '../js/data/trainers.js';
import { MAPS_BY_ID } from '../js/data/maps/index.js';
import { createNewWorld } from '../js/state/schema.js';
import * as loans from '../js/systems/loans.js';
import * as wallet from '../js/systems/wallet.js';
import { tidesForDay, tideOffsetFor } from '../js/systems/clockSys.js';
import { rowActive, modsFor, lowTouchesNight } from '../js/systems/gather.js';
import { phaseOfMinute, tideStateAt } from '../js/core/time.js';

const H = 60;
const DAY = 1440;
const T = TUNING;
const TIDE_OFFSET = tideOffsetFor(T.TIDE_DAY1_LOW);
const ITEM = new Map(ITEMS.map((i) => [i.id, i]));
const ISLES = ['lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt'];
const SPIRES = ['turn', 'ward', 'weather', 'hollow', 'relay', 'mirror'];

/** Income sources, in report order. Shares and errands are credits to Wren's ledger, not buttons. */
export const SOURCES = Object.freeze([
  'fruit', 'purses', 'glint', 'honey', 'fish', 'bugs', 'finds', 'trainers', 'spires', 'duels',
  'errants', 'wanted', 'gallery', 'spireShares', 'residentShares', 'errands',
]);
/** Sink kinds, in report order. `crate` is the 10% the Consignment Crate keeps. */
export const SINKS = Object.freeze([
  'wicks', 'medicine', 'ferry', 'starsalt', 'anchors', 'discs', 'held', 'commons', 'decor',
  'seedlings', 'blackout', 'crate',
]);

// ---------------------------------------------------------------------------------------------
// Real-time model: what a verb costs in real seconds of running clock (1 real second = 1 game
// minute), and what a scene costs in paused real minutes. These are the sim's measuring stick,
// not game tuning; they match GDD-00 §12's first 30 minutes (six trees, a purse and a nest in
// ~90 seconds; a route trainer about a minute at 2× battle speed; a Spire about five).
// ---------------------------------------------------------------------------------------------

export const ACTION_SECONDS = Object.freeze({
  tree: 9, purse: 4, nest: 6, glint: 15, crack: 9, sparkle: 7, rake: 5, skyglass: 10, cast: 11,
  bug: 10, townWalk: 150, legWalk: 240, legPath: 40,
});
export const PAUSED_MINUTES = Object.freeze({
  trainer: 1.3, spire: 5, duel: 1.2, errant: 1.5, capture: 1.2, shop: 0.4, forecast: 0.6, letter: 0.5,
  ceremony: 0.6,
});

// ---------------------------------------------------------------------------------------------
// The three profiles (player behaviour only)
// ---------------------------------------------------------------------------------------------

/**
 * A profile is what a player chooses to do, never what it is paid.
 *  - `awakeUntil`: the minute (may pass 24:00) the player sleeps; the clock skips to 06:00.
 *  - `trees`, `purses`, `nests`: verbs a day (capped by what the town holds); `glint`: share of days
 *    the Glint is dug; `cracks`, `dayLows` (low-tide flats visits a day: sparkles + rakes), `rakes`.
 *  - `castsDay` / `castsNight`: fishing casts by day (river, quay) and after dark (quay, river mouth);
 *    `skill` multiplies the bite window the player can hit (the Brine lead and Gentle mode raise it).
 *  - `bugsDay` / `bugsNight`; `duels` (Porch Duels a day) and `duelsFrom`; `errant` (share of days an
 *    available Errant is beaten or caught); `wantedHits` (stacks a day that match Wanted Today);
 *    `crate` (share of goods left in the Crate overnight instead of sold to Pell's / Ludo).
 *  - `badgeDays`: the day each Spire is climbed (story and level pace, not money); `optional`: share of
 *    the declinable night trainers fought; `longRoad`: walks the Bar the day after badge 6.
 *  - `threadDays`: the day each lead thread finishes (one beat a day at most); `captures` a day.
 *  - purchases: `seedlings` (days), `commons` ([day, id]), `discs` ([day, id]), `held` ([day, id]),
 *    `starsalt` ([day, n]), `anchors` ([day, n]), `decorEvery` (days between furniture pieces, from
 *    `decorFrom`), `ferryLegs` (legs taken by ferry before badge 2), `blackouts` (days).
 *  - `rooms`: the four commissions in pick order. `dialogue`: paused real minutes of talk a day.
 */
export const PROFILES = Object.freeze({
  casual: Object.freeze({
    id: 'casual', label: 'Casual (≈45 real min a day, sleeps at 22:00, talks to everyone)',
    awakeUntil: 22 * H, dialogue: 21, reserve: 600, payDaily: true,
    trees: 9, purses: 2, nests: 1, glint: 0.7, cracks: 2, dayLows: 1, rakes: 2, nightLows: 0,
    castsDay: 3, castsNight: 2, skill: 1.0, bugsDay: 2, bugsNight: 1,
    duels: 1, duelsFrom: 2, errant: 0.25, wantedHits: 0.5, crate: 0.3,
    badgeDays: [4, 7, 10, 13, 16, 19], optional: 0, longRoad: false,
    threadDays: [10, 12, 14, 16, 18, 20], captures: 0.9, wicksPerCatch: 2.2,
    seedlings: [7, 14], commons: [[6, 'dark-house-1'], [11, 'mudlark-mile-flags'], [17, 'quay-lamps']],
    discs: [[5, 'disc-sandtrap'], [12, 'disc-shardlight']], held: [], starsalt: [], anchors: [[9, 1]],
    decorFrom: 3, decorEvery: 2, ferryLegs: 3, blackouts: [6, 13],
    rooms: ['greenhouse', 'porch-loft', 'gallery', 'cellar'],
  }),
  typical: Object.freeze({
    id: 'typical', label: 'Typical (≈32 real min a day, sleeps at 01:00, a leg most days)',
    awakeUntil: 25 * H, dialogue: 9, reserve: 400, payDaily: true,
    trees: 16, purses: 4, nests: 2, glint: 0.95, cracks: 3, dayLows: 1, rakes: 3, nightLows: 1,
    castsDay: 4, castsNight: 9, skill: 1.2, bugsDay: 2, bugsNight: 3,
    duels: 2, duelsFrom: 2, duelsAllFrom: 8, errant: 0.5, wantedHits: 1.2, crate: 0.05,
    badgeDays: [3, 5, 7, 10, 11, 13], optional: 0.5, longRoad: true,
    threadDays: [8, 9, 10, 11, 12, 13], captures: 1.3, wicksPerCatch: 1.8,
    seedlings: [5, 7, 9, 11], commons: [[4, 'dark-house-1'], [7, 'quay-lamps'], [10, 'mudlark-mile-flags']],
    discs: [[4, 'disc-spore-drift'], [8, 'disc-flashover'], [10, 'disc-cairn-crash'], [12, 'disc-live-wire']],
    held: [], starsalt: [[5, 1], [8, 1], [10, 1], [12, 1]], anchors: [[6, 1], [11, 1]],
    decorFrom: 5, decorEvery: 3, ferryLegs: 1, blackouts: [9],
    rooms: ['workshop', 'greenhouse', 'training-yard', 'porch-loft'],
  }),
  grinder: Object.freeze({
    id: 'grinder', label: 'Grinder (≈35 real min a day, never sleeps, every verb at its cap)',
    awakeUntil: 30 * H, dialogue: 3, reserve: 200, payDaily: true,
    trees: 50, purses: 6, nests: 4, glint: 1, cracks: 4, dayLows: 2, rakes: 4, nightLows: 2,
    castsDay: 8, castsNight: 22, skill: 1.5, bugsDay: 4, bugsNight: 5,
    duels: 3, duelsFrom: 1, errant: 0.9, wantedHits: 2, crate: 0,
    badgeDays: [3, 5, 7, 9, 11, 13], optional: 1, longRoad: false,
    threadDays: [7, 8, 9, 10, 11, 12], captures: 0.5, wicksPerCatch: 1.6,
    seedlings: [2, 3, 4, 5, 6, 7, 7, 7, 7, 8], commons: [[3, 'quay-lamps']],
    discs: [[4, 'disc-spore-drift']], held: [[5, 'lucky-button']], starsalt: [], anchors: [],
    decorFrom: 99, decorEvery: 99, ferryLegs: 0, blackouts: [],
    rooms: ['greenhouse', 'workshop', 'porch-loft', 'training-yard'],
  }),
});

// ---------------------------------------------------------------------------------------------
// Content lookups
// ---------------------------------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const avg = (a, b) => (a + b) / 2;
const totalAt = (day, minute) => (day - 1) * DAY + minute;
const isNight = (minute) => {
  const m = ((minute % DAY) + DAY) % DAY;
  return m >= T.nightStartMinute || m < T.nightEndMinute;
};

/** Pellwick's reaches as GDD-01 drew them (fallback: two river and two quay reaches). */
function pellwickReaches() {
  const map = MAPS_BY_ID.pellwick;
  const list = Array.isArray(map?.reaches) && map.reaches.length ? map.reaches : [
    { id: 'river-a', kind: 'river' }, { id: 'river-b', kind: 'river', nightKind: 'sea' },
    { id: 'quay-a', kind: 'quay', nightKind: 'sea' }, { id: 'quay-b', kind: 'quay', nightKind: 'sea' },
  ];
  return list.filter((r) => r.cond === undefined).map((r) => ({ id: r.id, kind: r.kind, nightKind: r.nightKind ?? null, shadows: r.shadows ?? T.fishShadowsPerReach }));
}
const TOWN_REACHES = pellwickReaches();
/** An isle's two reaches (GDD-01 stubs: a river and a lagoon). */
const ISLE_REACHES = [{ id: 'isle-river', kind: 'river', nightKind: null, shadows: T.fishShadowsPerReach }, { id: 'isle-lagoon', kind: 'lagoon', nightKind: null, shadows: T.fishShadowsPerReach }];

/** The tide state the core clock reports at a total. */
const tideAt = (total) => tideStateAt(total, TIDE_OFFSET);

/** gather's row environment at a total. */
function envAt(world, total, mapId = 'pellwick') {
  const minute = ((total % DAY) + DAY) % DAY;
  return { phase: phaseOfMinute(minute), tideState: tideAt(total), weather: 'clear', night: isNight(minute), world, data: null, mapId, region: mapId };
}

const CLASS_RANK = { small: 1, medium: 2, large: 3, forked: 4 };

/** Chance a player lands a fish of this row (bite window × skill; Gentle / Patient fishers sit at the top). */
function landChance(row, skill) {
  const [a, b] = row.biteFrames ?? [T.fishBiteFramesDefault, T.fishBiteFramesDefault];
  return clamp(0.2 + 0.03 * avg(a, b) * skill, 0.35, 0.95);
}

/**
 * One cast's expected value when the player picks the biggest shadow class in view: with `n`
 * shadows drawn by `w × mods`, P(best class = c) = (1 − P(>c))^n − (1 − P(≥c))^n.
 */
function castValue(pool, n, skill) {
  const W = pool.reduce((s, p) => s + p.w, 0);
  if (W <= 0 || n <= 0) return { value: 0, caught: 0, headliners: 0 };
  const classes = [4, 3, 2, 1].map((rank) => {
    const rows = pool.filter((p) => (CLASS_RANK[p.r.shadow] ?? 2) === rank);
    const w = rows.reduce((s, p) => s + p.w, 0);
    return { rank, rows, q: w / W, w };
  });
  let above = 0; let value = 0; let caught = 0; let headliners = 0;
  for (const c of classes) {
    const pBest = (1 - above) ** n - (1 - above - c.q) ** n;
    above += c.q;
    if (c.w <= 0 || pBest <= 0) continue;
    for (const p of c.rows) {
      const share = p.w / c.w;
      const land = landChance(p.r, skill);
      value += pBest * share * land * p.r.price;
      caught += pBest * share * land;
      if (p.r.headliner) headliners += pBest * share * land;
    }
  }
  return { value, caught, headliners };
}

/** Fish rows active on a reach at a total, with their weights. */
function fishPool(world, reach, total, mapId) {
  const env = envAt(world, total, mapId);
  const places = [reach.id, reach.kind];
  if (env.night && reach.nightKind) places.push(reach.nightKind);
  return FISH.filter((r) => rowActive(r, env, places)).map((r) => ({ r, w: (r.w ?? 1) * modsFor(r, env) }));
}

/** Bug rows a player can net here and now (habitats in reach), weighted; light bugs ×bugLightMult at night. */
function bugPool(world, total, habitats) {
  const env = envAt(world, total);
  return BUGS.filter((b) => rowActive(b, env) && b.habitat.some((h) => habitats.includes(h)))
    .map((b) => ({ r: b, w: (b.w ?? 1) * modsFor(b, env) * (env.night && b.light ? T.bugLightMult : 1) }));
}
const BUG_DAY = ['orchard', 'green', 'lanes', 'river', 'creek', 'hedges', 'beans', 'reeds', 'point'];
const BUG_NIGHT = ['lit-porch', 'string-lights', 'orchard', 'green', 'lanes', 'hedges', 'beans', 'reeds', 'point'];
const BUG_FLATS = ['flats'];
const BUG_GLOW = ['flats', 'glowing-flats'];

/** Expected value of one net swing at a pool (the careful swing still misses `wary` of the time). */
function bugValue(pool) {
  const W = pool.reduce((s, p) => s + p.w, 0);
  return W > 0 ? pool.reduce((s, p) => s + p.w * (1 - (p.r.wary ?? 0)) * p.r.price, 0) / W : 0;
}

/** Find rows a source turns up on a map, with weights. */
function findPool(source, mapId) {
  return FINDS.filter((f) => f.source.includes(source) && (!Array.isArray(f.where) || f.where.includes(mapId)) && !(source !== 'skyglass' && f.skyglass))
    .map((f) => ({ r: f, w: f.w ?? 1 }));
}

/** Route trainers, Spire leaders and the Long Road, from data/trainers. */
const ROUTE = Object.fromEntries(ISLES.map((isle) => [isle, TRAINERS.filter((t) => t.region === isle && t.payoutRule?.kind === 'highest' && !t.story && t.band)]));
const SPIRE_TRAINER = ISLES.map((isle) => TRAINERS.find((t) => t.region === isle && t.payoutRule?.kind === 'ace'));
const LONG_ROAD = TRAINERS.filter((t) => t.region === 'the-bar' && t.id.startsWith('bar-'));
const PIP = TRAINERS.find((t) => t.id === 'pip');
const LINNET_REMATCH = TRAINERS.find((t) => t.id === 'linnet-brackenford');

/** The town's trees (town TREES groves), the native fruit row and the foreign rows. */
const TREE_COUNT = TREES.groves.reduce((s, g) => s + g.trees, 0);
const NATIVE = FRUIT.find((f) => f.origin === 'native');
const FOREIGN = FRUIT.filter((f) => f.origin === 'foreign');
const FOREIGN_PRICE = FOREIGN[0].price;
const FOREIGN_RIPE = FOREIGN[0].ripePrice;
/** The six lead threads; finishing one credits the resident share (5% of the open loan). */
const THREADS = ['mudlark-mile', 'twelve-lights', 'oyster-boat', 'the-fence', 'heirlooms-going-home', 'the-bell'];

// ---------------------------------------------------------------------------------------------
// The sim
// ---------------------------------------------------------------------------------------------

/** Bresenham accumulator: `take(key, rate)` returns whole events as the fraction builds up. */
function accumulator() {
  const acc = new Map();
  return (key, rate) => {
    const v = (acc.get(key) ?? 0) + rate;
    const n = Math.floor(v + 1e-9);
    acc.set(key, v - n);
    return n;
  };
}

/**
 * Runs one profile.
 * @param {string|object} profileOrId  a PROFILES key or a profile object
 * @param {{maxDays?: number, tuning?: object}} [opts]
 */
export function simulate(profileOrId, opts = {}) {
  const P = typeof profileOrId === 'string' ? PROFILES[profileOrId] : profileOrId;
  if (!P) throw new Error(`economy-sim: unknown profile ${profileOrId}`);
  const maxDays = opts.maxDays ?? 30;
  const tuning = opts.tuning ?? T;
  const world = createNewWorld({ seedCode: `SIM-${P.id}`, dial: 'flux' });
  const data = { loans: LOANS, commissions: COMMISSIONS, commons: COMMONS };
  const ctxAt = (total, source) => ({ data, tuning, now: total, source });
  const take = accumulator();

  // trees: [{fruitDay, foreign}]; fruit is on every town tree at arrival, ripe from day 2
  const trees = Array.from({ length: TREE_COUNT }, () => ({ fruitDay: 1, foreign: false }));
  const reachState = new Map();
  const findCounts = new Map();
  const badges = [];
  let heldForms = 1; let framed = 0; let luckyButton = false; let quayLamps = false;
  let workshop = false; let greenhouse = false; let gallery = false;
  const cleared = {}; let relightDay = null; let lampRoomDay = null;
  const days = [];
  const income = Object.fromEntries(SOURCES.map((s) => [s, 0]));
  const sinks = Object.fromEntries(SINKS.map((s) => [s, 0]));
  const warnings = [];

  /** Books buttons earned from a source (rounded) through the wallet. */
  function earn(day, source, amount, total, crateable = true) {
    let n = Math.round(amount);
    if (n <= 0) return 0;
    if (crateable && P.crate > 0 && ['fruit', 'fish', 'bugs', 'finds', 'honey'].includes(source)) {
      const crated = Math.round(n * P.crate);
      const lost = Math.round(crated * (1 - tuning.crateRate));
      sinks.crate += lost; day.sinks.crate = (day.sinks.crate ?? 0) + lost;
      n -= lost;
    }
    wallet.earn(world, n, ctxAt(total, source));
    income[source] += n; day.gross[source] = (day.gross[source] ?? 0) + n;
    return n;
  }
  /** Spends on a sink if the wallet holds it; returns whether it was bought. */
  function spend(day, kind, amount, total) {
    const n = Math.round(amount);
    if (n <= 0) return true;
    const r = wallet.spend(world, n, ctxAt(total, kind));
    if (!r.ok) { day.skipped.push(`${kind} ${n}`); return false; }
    sinks[kind] += n; day.sinks[kind] = (day.sinks[kind] ?? 0) + n;
    return true;
  }
  /** Books a credit to the ledger (shares, errands) by what the loans system actually applied. */
  function credit(day, source, r) {
    const n = r && r.ok ? (r.credited ?? 0) : 0;
    income[source] += n; day.gross[source] = (day.gross[source] ?? 0) + n;
  }

  function health(reach, total) {
    const s = reachState.get(reach.id) ?? { h: 1, t: total };
    return Math.min(1, s.h + Math.max(0, total - s.t) / tuning.fishReachRecoverMinutes);
  }
  /** A fishing session of `casts` on the best reaches at a total; returns value and casts made. */
  function fishSession(reaches, casts, total, mapId, extraNight = 0) {
    let value = 0; let headliners = 0; let caught = 0;
    for (let i = 0; i < casts; i++) {
      const t = total + i * Math.round(ACTION_SECONDS.cast); // one real second = one game minute
      let best = null;
      for (const reach of reaches) {
        const pool = fishPool(world, reach, t, mapId);
        if (!pool.length) continue;
        const h = health(reach, t);
        const [lo, hi] = reach.shadows;
        const extra = (isNight(t) && quayLamps && reach.kind === 'quay' ? 1 : 0) + extraNight;
        const n = clamp(Math.round(hi * h), lo, hi) + extra;
        const cv = castValue(pool, n, P.skill);
        if (!best || cv.value > best.cv.value) best = { reach, cv, h };
      }
      if (!best) break;
      value += best.cv.value; headliners += best.cv.headliners; caught += best.cv.caught;
      reachState.set(best.reach.id, { h: Math.max(tuning.fishReachFloor, best.h - tuning.fishReachCatchCost * best.cv.caught), t });
    }
    return { value, headliners, caught };
  }
  /** Expected value of `n` finds from a pool; the first of each row is pinned on the string wall. */
  function findsValue(pool, n, priceOf = (r) => r.price) {
    const W = pool.reduce((s, p) => s + p.w, 0);
    if (W <= 0 || n <= 0) return 0;
    let v = 0;
    for (const p of pool) {
      const got = n * p.w / W;
      const before = findCounts.get(p.r.id) ?? 0;
      const after = before + got;
      findCounts.set(p.r.id, after);
      const sold = Math.max(0, after - 1) - Math.max(0, before - 1);
      v += sold * priceOf(p.r);
    }
    return v;
  }
  /** Harvests up to `n` trees (home foreign trees first, then the ripest town trees). */
  function harvest(dayNo, n) {
    let v = 0; let shaken = 0;
    const ready = trees.filter((t) => t.fruitDay <= dayNo).sort((a, b) => (Number(b.foreign) - Number(a.foreign)) || (a.fruitDay - b.fruitDay));
    for (const t of ready) {
      if (!t.foreign && shaken >= n) break;
      const ripe = dayNo >= t.fruitDay + (tuning.fruitRipeDays - tuning.regrowDaysDefault);
      const price = t.foreign ? (ripe ? FOREIGN_RIPE : FOREIGN_PRICE) : (ripe ? NATIVE.ripePrice : NATIVE.price);
      v += price * tuning.fruitPerTree;
      t.fruitDay = dayNo + tuning.regrowDaysDefault;
      if (!t.foreign) shaken++;
    }
    return { value: v, shaken };
  }

  const duelCurve = PORCH_DUELS.curveByBadges;
  const purseAvg = avg(...tuning.purseRange);
  const honey = ITEM.get('honeycomb').price;
  const seedlingPrice = ITEM.get('fruit-seedling').price;
  const decorQueue = FURNITURE.filter((f) => !f.cond && f.source.some((s) => s === 'pells' || s === 'market')).map((f) => f.price);
  let decorIdx = 0;
  let ferryLeft = P.ferryLegs;

  for (let d = 1; d <= maxDays; d++) {
    const day = { day: d, gross: {}, sinks: {}, skipped: [], running: 0, paused: 0, tierBefore: world.loans.tier };
    const dayStart = totalAt(d, 6 * H);
    const arrival = d === 1;

    // 05:40: the overnight build lands; the Relighting fires at the dusk the Lamp Room lands
    if (!arrival) {
      const r = loans.landDue(world, ctxAt(totalAt(d, 5 * H + 40)));
      for (const b of r.landed) {
        if (b.id === 'greenhouse') { greenhouse = true; const indoor = COMMISSIONS.find((c) => c.id === 'greenhouse').effects.indoorTrees; for (let i = 0; i < indoor; i++) trees.push({ fruitDay: d + 3, foreign: true }); }
        if (b.id === 'workshop') workshop = true;
        if (b.id === 'gallery') gallery = true;
        if (b.tier === LOANS.length) lampRoomDay = d;
      }
      if (lampRoomDay !== null && relightDay === null) relightDay = lampRoomDay; // dusk of the landing day
    }

    const awakeEnd = arrival ? 23 * H + 30 : P.awakeUntil;
    const runningMin = arrival ? (awakeEnd - (17 * H + 40)) : (awakeEnd - 6 * H);
    day.running = Math.min(24, runningMin / 60);
    day.paused += P.dialogue * (arrival ? 0.5 : 1) + PAUSED_MINUTES.shop * 3 + PAUSED_MINUTES.letter;
    let seconds = 0;

    if (arrival) {
      // GDD-00 §12, the first 30 minutes: six trees, a purse, a nest, a perch, Pip, the errands
      for (let i = 0; i < 6; i++) earn(day, 'fruit', harvest(1, 1).value, totalAt(1, 19 * H + 20), false);
      if (P.trees > 20) earn(day, 'fruit', harvest(1, Math.min(P.trees, 24) - 6).value, totalAt(1, 20 * H), false);
      earn(day, 'purses', 300, totalAt(1, 19 * H + 20), false);
      earn(day, 'honey', honey, totalAt(1, 19 * H + 20), false);
      earn(day, 'fish', FISH.find((f) => f.id === 'perch').price, totalAt(1, 20 * H + 45), false);
      earn(day, 'trainers', PIP.payout, totalAt(1, 21 * H + 30), false);
      for (let i = 0; i < tuning.errandCount; i++) credit(day, 'errands', loans.errand(world, `errand-${i + 1}`, ctxAt(totalAt(1, 18 * H + 30))));
      if (P.duelsFrom <= 1) earn(day, 'duels', tuning.porchDuelPerCurve * duelCurve[0], totalAt(1, 22 * H + 45), false);
      if (P.castsNight > 10) earn(day, 'fish', fishSession(TOWN_REACHES, 8, totalAt(1, 22 * H + 50), 'pellwick').value, totalAt(1, 23 * H + 20), false);
      day.paused += PAUSED_MINUTES.trainer * 2 + PAUSED_MINUTES.capture + PAUSED_MINUTES.ceremony;
    } else {
      // ---- the morning: the Glint at the day's low, the orchard, purses, bees, cracks ----
      const lows = tidesForDay(d).filter((e) => e.kind === 'low');
      const awakeLows = lows.filter((l) => l.minute + tuning.flatsWindowMinutes >= 6 * H && l.minute - tuning.flatsWindowMinutes <= awakeEnd);
      if (awakeLows.length && take('glint', P.glint)) {
        const g = wallet.collectGlint(world, { ...ctxAt(awakeLows[0].total, 'glint'), gameDay: d });
        income.glint += g.total; day.gross.glint = (day.gross.glint ?? 0) + g.total;
        seconds += ACTION_SECONDS.glint;
      }
      const h = harvest(d, P.trees);
      earn(day, 'fruit', h.value, totalAt(d, 9 * H));
      seconds += ACTION_SECONDS.tree * h.shaken;
      const purses = Math.min(P.purses, TREES.purse.trees);
      earn(day, 'purses', purses * purseAvg, totalAt(d, 8 * H));
      seconds += ACTION_SECONDS.purse * purses;
      const nests = Math.min(P.nests, TREES.bees.trees);
      earn(day, 'honey', nests * honey, totalAt(d, 8 * H));
      seconds += ACTION_SECONDS.nest * nests;
      const cracks = Math.min(P.cracks, tuning.cracksPerDay);
      const workshopBonus = workshop ? (tuning.findCleanMult - 1) : 0;
      earn(day, 'finds', findsValue(findPool('crack', 'pellwick'), cracks) + (workshop ? workshopBonus * avg(300, 800) : 0), totalAt(d, 10 * H));
      seconds += ACTION_SECONDS.crack * cracks;

      // ---- low-tide flats in daylight: sparkles, cockle rakes, sandhoppers ----
      const dayLows = awakeLows.filter((l) => !lowTouchesNight(l.total, { tuning }));
      const flatsVisits = Math.min(P.dayLows, Math.max(dayLows.length, awakeLows.length));
      for (let i = 0; i < flatsVisits; i++) {
        earn(day, 'finds', findsValue(findPool('sparkle', 'pellwick'), tuning.sparklesPerLow), totalAt(d, 12 * H));
        const rakes = Math.min(P.rakes, tuning.cockleRakesPerLow);
        earn(day, 'finds', rakes * avg(...tuning.cockleRange) * FINDS.find((f) => f.id === 'cockle').price, totalAt(d, 12 * H));
        earn(day, 'bugs', bugValue(bugPool(world, (awakeLows[i] ?? lows[0]).total, BUG_FLATS)), totalAt(d, 12 * H));
        seconds += ACTION_SECONDS.sparkle * tuning.sparklesPerLow + ACTION_SECONDS.rake * rakes + ACTION_SECONDS.bug;
      }

      // ---- day fishing and day bugs ----
      const dayFish = fishSession(TOWN_REACHES, P.castsDay, totalAt(d, 10 * H + 30), 'pellwick');
      earn(day, 'fish', dayFish.value, totalAt(d, 11 * H));
      seconds += ACTION_SECONDS.cast * P.castsDay;
      earn(day, 'bugs', P.bugsDay * bugValue(bugPool(world, totalAt(d, 11 * H), BUG_DAY)), totalAt(d, 11 * H));
      seconds += ACTION_SECONDS.bug * P.bugsDay;

      // ---- the leg: route trainers, the Spire, a catch or two ----
      const k = P.badgeDays.indexOf(d);
      const visit = k >= 0 ? k : P.badgeDays.findIndex((bd, i) => bd - 1 === d && (i === 0 ? bd >= 3 : bd - P.badgeDays[i - 1] >= 2));
      if (visit >= 0) {
        const isle = ISLES[visit];
        const pathOpen = badges.length >= 2;
        seconds += pathOpen ? ACTION_SECONDS.legPath : ACTION_SECONDS.legWalk;
        if (!pathOpen && ferryLeft > 0) { ferryLeft--; spend(day, 'ferry', tuning.ferryFare, totalAt(d, 10 * H)); }
        const firstHalf = k < 0; // the day before the Spire
        const twoDays = (visit === 0 ? P.badgeDays[0] >= 3 : P.badgeDays[visit] - P.badgeDays[visit - 1] >= 2);
        const roster = ROUTE[isle].filter((t) => !t.declinable || take(`opt-${isle}-${t.id}`, P.optional));
        const mine = roster.filter((_, i) => !twoDays || (firstHalf ? i < Math.ceil(roster.length / 2) : i >= Math.ceil(roster.length / 2)));
        const mult = luckyButton ? 1 + (ITEM.get('lucky-button').held.payoutMult - 1) : 1;
        for (const t of mine) earn(day, 'trainers', t.payout * mult, totalAt(d, 12 * H));
        day.paused += PAUSED_MINUTES.trainer * mine.length;
        const medBy = [40, 60, 100, 160, 240, 300, 360];
        spend(day, 'medicine', medBy[badges.length] * mine.length, totalAt(d, 9 * H));
        // isle fishing while the tide turns
        earn(day, 'fish', fishSession(ISLE_REACHES, 2, totalAt(d, 13 * H), isle).value, totalAt(d, 13 * H));
        seconds += ACTION_SECONDS.cast * 2;
        if (k >= 0) {
          const sp = SPIRE_TRAINER[visit];
          earn(day, 'spires', sp.payout * mult, totalAt(d, 14 * H));
          if (badges.length >= 2) spend(day, 'medicine', ITEM.get('revive').price * 2, totalAt(d, 9 * H));
          const id = SPIRES[visit];
          badges.push(id);
          world.badges.push(id);
          credit(day, 'spireShares', loans.spireShare(world, id, ctxAt(totalAt(d, 14 * H))));
          day.paused += PAUSED_MINUTES.spire;
          if (visit === 0 && LINNET_REMATCH) { earn(day, 'trainers', LINNET_REMATCH.payout, totalAt(d, 15 * H)); day.paused += PAUSED_MINUTES.trainer; }
        }
      }
      // the Long Road and the Summit the days after badge 6, for a player who walks it before the light
      if (P.longRoad && badges.length === 6 && relightDay === null) {
        const after = d - P.badgeDays[5];
        if (after === 1) { for (const t of LONG_ROAD) earn(day, 'trainers', t.payout, totalAt(d, 12 * H)); day.paused += PAUSED_MINUTES.trainer * LONG_ROAD.length; spend(day, 'medicine', 360 * LONG_ROAD.length, totalAt(d, 9 * H)); }
      }

      // captures (wild, wicks burned) and the Gallery frames
      const caps = take('captures', P.captures);
      if (caps) {
        heldForms += caps;
        const wickPrice = badges.length < 2 ? ITEM.get('tallow-wick').price : badges.length < 4 ? avg(ITEM.get('tallow-wick').price, ITEM.get('brass-wick').price) : avg(ITEM.get('brass-wick').price, ITEM.get('skyglass-wick').price);
        spend(day, 'wicks', Math.max(0, caps * P.wicksPerCatch - (d <= 3 ? 1.5 : 0)) * wickPrice, totalAt(d, 9 * H));
        day.paused += PAUSED_MINUTES.capture * caps;
      }
      if (gallery) {
        const frames = Math.floor(heldForms / tuning.galleryFrameForms);
        if (frames > framed) { earn(day, 'gallery', (frames - framed) * tuning.galleryFrameButtons, totalAt(d, 16 * H), false); framed = frames; }
      }
      day.paused += PAUSED_MINUTES.forecast * 1.3;

      // Errants: Squallcoil from the Emberstep leg on, Hailcoil from the Rimeholt leg on; each returns the next day
      const errants = (badges.length >= 2 || (P.badgeDays[2] - 1 <= d) ? 1 : 0) + (badges.length >= 5 ? 1 : 0);
      for (let e = 0; e < errants; e++) {
        if (take(`errant-${e}`, P.errant)) { earn(day, 'errants', tuning.errantButtons, totalAt(d, 15 * H), false); day.paused += PAUSED_MINUTES.errant; }
      }

      // Wanted Today: one stack each of three items at +50% (sold at Pell's)
      const hits = take('wanted', P.wantedHits);
      if (hits) earn(day, 'wanted', hits * (tuning.wantedTodayMult - 1) * (0.6 * 10 * NATIVE.ripePrice + 0.4 * 300), totalAt(d, 9 * H), false);

      // ---- evening and night: Porch Duels, night fishing, moths, the night low ----
      if (d >= P.duelsFrom) {
        const n = Math.min(tuning.porchDuelsPerDay, d >= (P.duelsAllFrom ?? 99) ? tuning.porchDuelsPerDay : P.duels);
        const mult = luckyButton ? ITEM.get('lucky-button').held.payoutMult : 1;
        earn(day, 'duels', n * tuning.porchDuelPerCurve * duelCurve[Math.min(badges.length, duelCurve.length - 1)] * mult, totalAt(d, 21 * H), false);
        day.paused += PAUSED_MINUTES.duel * n;
      }
      const nightStart = totalAt(d, 21 * H + 30);
      const nightCasts = awakeEnd > 21 * H + 30 ? P.castsNight : Math.min(P.castsNight, 2);
      const nf = fishSession(TOWN_REACHES, nightCasts, nightStart, 'pellwick');
      earn(day, 'fish', nf.value, nightStart);
      seconds += ACTION_SECONDS.cast * nightCasts;
      earn(day, 'bugs', P.bugsNight * bugValue(bugPool(world, totalAt(d, 21 * H), BUG_NIGHT)), totalAt(d, 21 * H));
      seconds += ACTION_SECONDS.bug * P.bugsNight;
      // night lows (this evening's and the small hours' before the player sleeps)
      const nightLows = [...tidesForDay(d), ...tidesForDay(d + 1)].filter((e) => e.kind === 'low' && e.total >= totalAt(d, 17 * H) && e.total < totalAt(d, awakeEnd + 60) && e.total - tuning.flatsWindowMinutes <= totalAt(d, awakeEnd) && lowTouchesNight(e.total, { tuning }));
      for (const low of nightLows.slice(0, P.nightLows)) {
        const sky = avg(...tuning.skyglassPerNightLow);
        earn(day, 'finds', findsValue(findPool('skyglass', 'pellwick'), sky, () => tuning.relicBarnabyPrice), low.total);
        earn(day, 'bugs', bugValue(bugPool(world, low.total, BUG_GLOW)), low.total);
        earn(day, 'finds', findsValue(findPool('sparkle', 'pellwick'), tuning.sparklesPerLow), low.total);
        seconds += ACTION_SECONDS.skyglass * sky + ACTION_SECONDS.bug + ACTION_SECONDS.sparkle * tuning.sparklesPerLow;
      }
      seconds += ACTION_SECONDS.townWalk;
    }
    day.paused += PAUSED_MINUTES.ceremony;

    // time check: the verbs must fit the awake running clock
    day.activeSeconds = seconds;
    if (seconds > runningMin) warnings.push(`day ${d}: ${seconds} s of verbs in ${runningMin} s awake`);

    // ---- sinks at Pell's, the Anchorage, the jar ----
    if (!arrival) {
      for (const [dd, id] of P.discs) if (dd === d) spend(day, 'discs', ITEM.get(id).price, totalAt(d, 9 * H));
      for (const [dd, id] of P.held) if (dd === d && spend(day, 'held', ITEM.get(id).price, totalAt(d, 9 * H)) && id === 'lucky-button') luckyButton = true;
      for (const [dd, n] of P.starsalt) if (dd === d) spend(day, 'starsalt', n * tuning.starsaltPrice, totalAt(d, 13 * H));
      for (const [dd, n] of P.anchors) if (dd === d) spend(day, 'anchors', n * tuning.anchorPrice, totalAt(d, 9 * H));
      for (const dd of P.seedlings) if (dd === d && spend(day, 'seedlings', seedlingPrice, totalAt(d, 23 * H))) trees.push({ fruitDay: d + 3, foreign: true });
      for (const [dd, id] of P.commons) {
        if (dd !== d) continue;
        const p = COMMONS.find((c) => c.id === id);
        const share = loans.projectShare(p, ctxAt(totalAt(d, 12 * H)));
        if (wallet.balance(world) >= share) {
          loans.depositJar(world, share, ctxAt(totalAt(d, 12 * H), 'commons'));
          const f = loans.fundProject(world, id, ctxAt(totalAt(d, 12 * H)));
          if (f.ok) { sinks.commons += share; day.sinks.commons = (day.sinks.commons ?? 0) + share; if (id === 'quay-lamps') quayLamps = true; }
        } else day.skipped.push(`commons ${id}`);
      }
      if (d >= P.decorFrom && (d - P.decorFrom) % P.decorEvery === 0 && decorQueue.length) {
        spend(day, 'decor', decorQueue[decorIdx % decorQueue.length], totalAt(d, 9 * H));
        decorIdx++;
      }
      if (P.blackouts.includes(d)) {
        const b = wallet.blackout(world, ctxAt(totalAt(d, 14 * H)));
        sinks.blackout += b.lost - b.refund; day.sinks.blackout = b.lost - b.refund; // the refund comes back through the Glints
      }
    }

    // ---- a lead thread finishes on its day: the resident share (5% of the open loan) ----
    P.threadDays.forEach((td, i) => {
      if (td === d) credit(day, 'residentShares', loans.residentShare(world, THREADS[i], ctxAt(totalAt(d, 19 * H))));
    });

    // ---- the yard before midnight: pay everything above the reserve ----
    const payAt = totalAt(d, Math.min(awakeEnd, 23 * H + 30) - 15);
    const before = { tier: world.loans.tier, paid: world.loans.paid };
    const cash = wallet.balance(world) - P.reserve;
    if (cash > 0 && !loans.isPaidOff(world, ctxAt(payAt))) {
      const r = loans.pay(world, cash, ctxAt(payAt, 'pay'));
      day.paid = r.ok ? r.paid : 0;
      // pay on through every loan this cash clears
      let guard = 0;
      while (r.ok && !loans.isPaidOff(world, ctxAt(payAt)) && wallet.balance(world) - P.reserve > 0 && guard++ < 8) {
        if (loans.needsCommission(world, ctxAt(payAt))) pickRoom(payAt);
        const more = loans.pay(world, wallet.balance(world) - P.reserve, ctxAt(payAt, 'pay'));
        if (!more.ok) break;
        day.paid += more.paid;
      }
    } else day.paid = 0;
    // a commission tier that cleared waits for its pick; pick at once
    while (loans.needsCommission(world, ctxAt(payAt))) pickRoom(payAt);
    for (let tier = before.tier; tier < world.loans.tier || (tier === LOANS.length && loans.isPaidOff(world, ctxAt(payAt))); tier++) {
      if (!(tier in cleared)) cleared[tier] = d;
      if (tier === LOANS.length) break;
    }
    // shares credited before the yard may have cleared tiers too
    for (const s of world.loans.tally) if (!(s.tier in cleared)) cleared[s.tier] = d;

    day.tierAfter = world.loans.tier;
    day.paidOnOpen = world.loans.paid;
    day.balance = loans.balance(world, ctxAt(payAt));
    day.wallet = wallet.balance(world);
    day.grossTotal = Object.values(day.gross).reduce((s, v) => s + v, 0);
    day.sinkTotal = Object.values(day.sinks).reduce((s, v) => s + v, 0);
    day.realMinutes = Math.round((day.running + day.paused) * 10) / 10;
    days.push(day);
    if (relightDay !== null && d >= relightDay) break;
  }

  function pickRoom(at) {
    const opts = loans.commissionOptions(world, ctxAt(at));
    const room = P.rooms.find((r) => opts.includes(r)) ?? opts[0];
    loans.chooseCommission(world, room, ctxAt(at));
  }

  const totalIncome = SOURCES.reduce((s, k) => s + income[k], 0);
  const mix = Object.fromEntries(SOURCES.map((k) => [k, totalIncome ? income[k] / totalIncome : 0]));
  const totalSinks = SINKS.reduce((s, k) => s + sinks[k], 0);
  const buttonsIncome = SOURCES.filter((k) => !['spireShares', 'residentShares', 'errands'].includes(k)).reduce((s, k) => s + income[k], 0);
  const played = days.filter((x) => x.day > 1);
  const realPerDay = played.length ? played.reduce((s, x) => s + x.realMinutes, 0) / played.length : 0;
  return {
    profile: P.id, label: P.label, days, cleared, relightDay, lampRoomDay,
    income, sinks, mix, totalIncome, totalSinks, sinkShare: buttonsIncome ? totalSinks / buttonsIncome : 0,
    realMinutesPerDay: Math.round(realPerDay * 10) / 10, warnings, badges: [...badges],
    day1RealMinutes: days[0]?.realMinutes ?? 0,
  };
}

/**
 * Grind check (GDD-00 §7): on each loan's target day, the shortfall divided by that day's earning rate
 * (buttons a real minute played) must stay under `grindCapRealMinutes`.
 */
export function grindMinutes(result) {
  const out = {};
  for (const l of LOANS) {
    const dd = result.days.find((x) => x.day === l.targetDay);
    if (!dd) continue;
    if ((result.cleared[l.tier] ?? Infinity) <= l.targetDay) { out[l.tier] = 0; continue; }
    const short = dd.tierAfter === l.tier ? dd.balance : l.amount;
    const rate = (dd.grossTotal - dd.sinkTotal) / Math.max(1, dd.realMinutes);
    out[l.tier] = Math.round((short / Math.max(1, rate)) * 10) / 10;
  }
  return out;
}

/** Runs all three profiles. */
export function runAll(opts) {
  return Object.fromEntries(Object.keys(PROFILES).map((id) => [id, simulate(id, opts)]));
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const pct = (x) => `${(x * 100).toFixed(1)}%`;

function printDays(r) {
  console.log(`\n${r.label}`);
  console.log('day | gross   | sinks  | paid    | open loan (paid / amount) | real min | top sources');
  for (const x of r.days) {
    const row = LOANS[x.tierAfter - 1];
    const top = Object.entries(x.gross).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${fmt(v)}`).join(', ');
    const open = loans.isPaidOff({ loans: { tier: x.tierAfter, paid: x.paidOnOpen } }, { data: { loans: LOANS } }) ? 'paid off' : `${x.tierAfter}: ${fmt(x.paidOnOpen)} / ${fmt(row?.amount ?? 0)}`;
    console.log(`${String(x.day).padStart(3)} | ${fmt(x.grossTotal).padStart(7)} | ${fmt(x.sinkTotal).padStart(6)} | ${fmt(x.paid ?? 0).padStart(7)} | ${open.padEnd(25)} | ${String(x.realMinutes).padStart(8)} | ${top}`);
  }
}

function printSummary(all) {
  console.log('\nprofile  | loans cleared on day (1..7)      | Relighting | real min/day | sinks | biggest source');
  for (const r of Object.values(all)) {
    const c = LOANS.map((l) => r.cleared[l.tier] ?? '-').join(' / ');
    const [topK, topV] = Object.entries(r.mix).sort((a, b) => b[1] - a[1])[0];
    console.log(`${r.profile.padEnd(8)} | ${c.padEnd(32)} | day ${String(r.relightDay ?? '-').padEnd(6)} | ${String(r.realMinutesPerDay).padStart(12)} | ${pct(r.sinkShare).padStart(5)} | ${topK} ${pct(topV)}`);
  }
  for (const r of Object.values(all)) {
    console.log(`\n${r.profile} income mix: ` + SOURCES.filter((k) => r.income[k] > 0).map((k) => `${k} ${pct(r.mix[k])}`).join(', '));
    console.log(`${r.profile} sinks: ` + SINKS.filter((k) => r.sinks[k] > 0).map((k) => `${k} ${fmt(r.sinks[k])}`).join(', '));
    if (r.warnings.length) console.log(`${r.profile} time warnings: ${r.warnings.join('; ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const all = runAll();
  if (args.includes('--json')) {
    console.log(JSON.stringify(Object.fromEntries(Object.entries(all).map(([k, r]) => [k, { cleared: r.cleared, relightDay: r.relightDay, mix: r.mix, income: r.income, sinks: r.sinks, realMinutesPerDay: r.realMinutesPerDay, grind: grindMinutes(r) }])), null, 2));
  } else {
    const which = args.find((a) => PROFILES[a]);
    if (which) printDays(all[which]);
    else { printDays(all.typical); printSummary(all); console.log('\ntypical grind minutes by tier:', grindMinutes(all.typical)); }
  }
}

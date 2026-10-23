/**
 * The loan ladder, the tally wall, the overnight builds, room commissions, the Relighting trigger
 * and the Commons Jar (`world.loans`). [RULES-ECON]
 *
 * GDD-00 §7 (and §2, §9):
 *  - **Ladder**: 6,000 / 15,000 / 25,000 / 36,000 / 50,000 / 66,000 / 80,000 (= 278,000), interest-free,
 *    no deadline. The ladder comes from `data.loans` (`{id: 'tier-N', tier, amount, build,
 *    commissionSlot, roofChoices}`), else the `loanLadder` tuning default. `world.loans.tier` is the open
 *    loan; `paid` is what is paid toward it. When it reaches zero the stick splits, the next loan is
 *    offered (tier + 1, paid 0) and the cleared tier's build is queued ({@link tierUp} does the same for
 *    a loan already at zero, e.g. after a load). The last tier stays open at full payment once cleared
 *    ({@link isPaidOff}). A malformed ladder row (no integer tier / amount, a repeated tier) throws.
 *  - **Paying** ({@link pay}) at the yard spends buttons and returns the ceremony: one abacus bead per
 *    1,000 (speeding up after ten), a notch per 5% of the open loan on a twenty-notch stick, the split
 *    and the stick appended to the tally wall (`loans.tally`).
 *  - **Credits that are not buttons**: First Night Errands ({@link errand}: six × 500 off loan 1 only),
 *    the Spire share ({@link spireShare}: 10% of the open loan per badge) and the resident share
 *    ({@link residentShare}: 5% per finished lead thread; after payoff 4,000 to the Commons Jar).
 *  - **Builds**: one per night, landing at 05:40 ({@link landDue}); the scaffold stage is the number of
 *    tiers paid; roof colour per build (8 colours, slate blue default, {@link chooseRoof}).
 *  - **Commissions**: pick 4 of 6 for loans 3-6 ({@link chooseCommission}); the two left over cost 20,000
 *    each after the Relighting ({@link buyLeftoverCommission}). A commission tier that clears before
 *    its pick waits ("Pick" on the Ledger) and is queued the moment it is picked.
 *  - **The Relighting**: when the last loan is paid AND the Lamp Room (its build) has landed, the flag
 *    `relightFlag` is set to the clock day whose dusk (18:00) fires it ({@link checkRelighting},
 *    {@link relightingDue}).
 *  - **Commons**: the jar ({@link depositJar}) funds the six Commons projects ({@link fundProject});
 *    neighbors cover `neighborShare` of each cost.
 *  - **Ledger Board**: {@link paceEstimate} ("about two days at this pace"), {@link todayBySource},
 *    {@link status} (houses Paid / Paying / Pick / Later / Finale).
 *
 * Every function is `fn(world, ...args, ctx?)` (`systems/econ` EconCtx); it writes `world.loans`, and
 * only through the owning systems anything else (`systems/wallet` for buttons, `systems/bag` for satchel
 * slots, `systems/flags` for flags). Events (§3.4): `loan:paid {amount, source, tier, paid, balance}`,
 * `loan:tier {tier, prev, done}`, `loan:built {id, tier, choice}`, plus `loan:commission {roomId, tier}`,
 * `commons:changed {jar, delta, source}` and `commons:built {id}`.
 *
 * Pure: no DOM, no randomness.
 * @module systems/loans
 */

import { MINUTES_PER_DAY } from '../core/time.js';
import { evalCond } from '../script/cond.js';
import { makeTuning, lookup, nowOf, minuteOfDay, clockDay, dayOf, emit, assertCount, assertId, deepFreeze, is } from './econ.js';
import * as wallet from './wallet.js';
import * as bag from './bag.js';
import * as flags from './flags.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Build} Build */
/** @typedef {import('./econ.js').EconCtx} EconCtx */

/**
 * One rung of the ladder, normalized.
 * @typedef {Object} LoanRow
 * @property {string} id               'tier-N'
 * @property {number} tier
 * @property {number} amount
 * @property {string|null} build       build id for a fixed build (null on commission tiers)
 * @property {boolean} commission      whether this tier's build is a room commission
 * @property {string[]} roofChoices    roof colour ids offered for this tier's build
 * @property {number} satchel          satchel slots its build adds (row `satchel`, else `buildSatchel[build]`)
 * @property {string[]} clearFlags     flags set true when the loan clears (porch lamp lit at payment)
 * @property {string[]} buildFlags     flags set true when the build lands
 */

/**
 * @typedef {Object} CommonsProject
 * @property {string} id  @property {number} cost  @property {number} [neighborShare]  @property {any} [cond]  @property {string[]} [flags]
 */

const DEFAULT_LADDER = [
  { tier: 1, amount: 6000, build: 'bedsit' },        // porch lamp lit at payment; bedsit roof overnight
  { tier: 2, amount: 15000, build: 'cottage' },      // two rooms, mirror, satchel +10
  { tier: 3, amount: 25000, commission: true },      // commission 1 (Wren's first own design)
  { tier: 4, amount: 36000, commission: true },
  { tier: 5, amount: 50000, commission: true },
  { tier: 6, amount: 66000, commission: true },      // Wren offers the Lamp Room
  { tier: 7, amount: 80000, build: 'lamp-room' },    // the Relighting at the next dusk
];

/**
 * Designer defaults, GDD-00 §7 / §9 values. Override any key through `data.tuning` / `ctx.tuning`.
 */
export const DEFAULTS = deepFreeze({
  loanLadder: DEFAULT_LADDER,                // §7 loan ladder (used when data has no `loans` table)
  notchesPerStick: 20,                       // §7: every stick has twenty notches (one per 5%)
  beadValue: 1000,                           // §7: one abacus bead per 1,000
  beadSpeedUpAfter: 10,                      // §7: the count speeds up after ten beads
  spireShareFraction: 0.1,                   // §7: Spire share = 10% of the open loan
  residentShareFraction: 0.05,               // §7: resident share = 5% (one notch)
  residentShareAfterPayoff: 4000,            // §7: after payoff, 4,000 to the Commons Jar
  errandCredit: 500,                         // §7: First Night Errands, 6 × 500 off loan 1
  errandCount: 6,
  errandTier: 1,
  commissionTiers: [3, 4, 5, 6],             // §7: pick 4 of 6 at loans 3-6
  commissionRooms: ['training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery'],
  leftoverCommissionPrice: 20000,            // §7: leftover rooms 20,000 each after the Relighting
  buildSatchel: { cottage: 10, cellar: 10 }, // §7: cottage satchel +10; Cellar satchel +10
  roofColours: ['slate-blue', 'ochre', 'harbor-red', 'moss', 'sea-blue', 'straw', 'tar', 'heather'], // §7: 8 colours (GDD-ids ROOF_COLOUR_IDS)
  roofDefault: 'slate-blue',                 // §7: slate blue is the cursor default
  buildLandMinute: 5 * 60 + 40,              // §5: 05:40 the Thatch tie off any overnight build
  buildsPerNight: 1,                         // §7: one build per night
  relightMinute: 18 * 60,                    // §7: the Relighting at the next dusk (18:00)
  relightFlag: 'sys.relighting-due',         // set to the clock day whose dusk fires the Relighting
  relitFlag: 'sp.relighting',                // GDD-ids: the Relighting done (the ending flow sets it via markRelit)
  firstPaymentFlag: 'sp.first-payment',      // GDD-ids: first THWAP (set when the first loan clears)
  lampRoomBuiltFlag: 'sp.lamp-room-built',   // GDD-ids: Lamp Room built (set when the last tier's build lands)
  clearedFlag: 'sys.loan.cleared',           // highest tier cleared (number)
  paceWindowDays: 3,                         // Ledger pace line: credits over the last N economy days
  ledgerLogMax: 60,                          // credits kept in loans.log
  yardHours: [6 * 60, 24 * 60],              // §5: Wren's yard 06:00-24:00 (yardOpen helper)
  commonsNeighborShare: 0.2,                 // §7: neighbors add 10-30% (per-project override: neighborShare)
  commonsProjects: [                         // §9: the six Commons projects (GDD-ids COMMONS_PROJECT_IDS)
    { id: 'dark-house-1', cost: 3000 },
    { id: 'quay-lamps', cost: 4000 },
    { id: 'mudlark-mile-flags', cost: 5000 },
    { id: 'north-creek-footbridge', cost: 6000 },
    { id: 'training-yard-green', cost: 10000, cond: { badge: 5 } },
    { id: 'third-stall', cost: 12000 },
  ],
});

const isLadderRow = (r) => !!r && typeof r === 'object' && is.posInt(r.tier) && is.nonNegInt(r.amount)
  && (r.build === undefined || r.build === null || is.id(r.build)) && (r.commission === undefined || typeof r.commission === 'boolean');
const isProject = (p) => !!p && typeof p === 'object' && is.id(p.id) && is.nonNegInt(p.cost) && (p.neighborShare === undefined || is.fraction(p.neighborShare));

/** @type {Record<string, [(v: any) => boolean, string]>} */
const SPEC = {
  loanLadder: [(v) => Array.isArray(v) && v.length > 0 && v.every(isLadderRow), '[{tier, amount, build?, commission?}] (non-empty)'],
  notchesPerStick: [is.posInt, 'integer >= 1'],
  beadValue: [is.posInt, 'integer >= 1'],
  beadSpeedUpAfter: [is.nonNegInt, 'integer >= 0'],
  spireShareFraction: [is.fraction, 'fraction 0..1'],
  residentShareFraction: [is.fraction, 'fraction 0..1'],
  residentShareAfterPayoff: [is.nonNegInt, 'integer >= 0'],
  errandCredit: [is.nonNegInt, 'integer >= 0'],
  errandCount: [is.nonNegInt, 'integer >= 0'],
  errandTier: [is.posInt, 'integer >= 1'],
  commissionTiers: [(v) => Array.isArray(v) && v.every(is.posInt), 'tier[]'],
  commissionRooms: [is.ids, 'room id[]'],
  leftoverCommissionPrice: [is.nonNegInt, 'integer >= 0'],
  buildSatchel: [is.intRecord, 'Record<build id, integer >= 0>'],
  roofColours: [(v) => is.ids(v) && v.length > 0, 'colour id[] (non-empty)'],
  roofDefault: [is.id, 'colour id'],
  buildLandMinute: [is.minute, 'minute 0..1439'],
  buildsPerNight: [is.posInt, 'integer >= 1'],
  relightMinute: [is.minute, 'minute 0..1439'],
  relightFlag: [is.flagId, 'namespaced flag id'],
  relitFlag: [is.flagId, 'namespaced flag id'],
  firstPaymentFlag: [is.flagId, 'namespaced flag id'],
  lampRoomBuiltFlag: [is.flagId, 'namespaced flag id'],
  clearedFlag: [is.flagId, 'namespaced flag id'],
  paceWindowDays: [is.posInt, 'integer >= 1'],
  ledgerLogMax: [is.posInt, 'integer >= 1'],
  yardHours: [(v) => Array.isArray(v) && v.length === 2 && v.every((m) => Number.isInteger(m) && m >= 0 && m <= MINUTES_PER_DAY), '[open, close] minutes 0..1440'],
  commonsNeighborShare: [is.fraction, 'fraction 0..1'],
  commonsProjects: [(v) => Array.isArray(v) && v.every(isProject), '[{id, cost, neighborShare?, cond?, flags?}]'],
};

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/**
 * Resolved tuning for a context (`ctx.tuning` > `data.tuning` > {@link DEFAULTS}).
 * @type {(ctx?: EconCtx|null) => Readonly<typeof DEFAULTS & {econDayStartMinute: number}>}
 */
export const tuningOf = makeTuning('loans', DEFAULTS, SPEC);

// ---------------------------------------------------------------------------------------------
// Ladder
// ---------------------------------------------------------------------------------------------

/**
 * Rejects a malformed ladder loudly (a row without an integer `tier` >= 1 or a non-negative integer
 * `amount`, or two rows on one tier). Without this a missing amount reads as NaN, and a NaN rung
 * would clear itself and silently skip a loan.
 * @param {readonly any[]} rows
 * @throws {TypeError}
 */
function assertLadderRows(rows) {
  const seen = new Set();
  rows.forEach((r, i) => {
    const where = `loans: ladder row ${i}${r && typeof r.id === 'string' ? ` (${r.id})` : ''}`;
    if (!r || typeof r !== 'object') throw new TypeError(`${where}: must be an object`);
    if (!Number.isInteger(r.tier) || r.tier < 1) throw new TypeError(`${where}: tier must be an integer >= 1, got ${JSON.stringify(r.tier)}`);
    if (!Number.isInteger(r.amount) || r.amount < 0) throw new TypeError(`${where}: amount must be a non-negative integer, got ${JSON.stringify(r.amount)}`);
    if (seen.has(r.tier)) throw new TypeError(`${where}: tier ${r.tier} appears twice`);
    seen.add(r.tier);
  });
}

/** @type {WeakMap<object, WeakMap<object, readonly LoanRow[]>>} rows -> tuning -> normalized ladder */
const LADDER_CACHE = new WeakMap();

/**
 * The ladder, sorted by tier: `data.loans` when the source has rows, else the `loanLadder` tuning.
 * @param {EconCtx} [ctx]
 * @returns {readonly LoanRow[]}
 */
export function ladder(ctx) {
  const t = tuningOf(ctx);
  const lk = lookup(ctx?.data);
  const fromData = lk.list('loans');
  const rows = fromData.length ? fromData : t.loanLadder;
  let byTuning = LADDER_CACHE.get(rows);
  if (!byTuning) LADDER_CACHE.set(rows, (byTuning = new WeakMap()));
  const hit = byTuning.get(t);
  if (hit) return hit;
  assertLadderRows(rows);
  const out = deepFreeze(rows.slice().sort((a, b) => a.tier - b.tier).map((r) => {
    const commission = r.commission === true || r.commissionSlot === true;
    const build = commission ? null : (typeof r.build === 'string' && r.build ? r.build : null);
    return {
      id: typeof r.id === 'string' ? r.id : `tier-${r.tier}`,
      tier: r.tier,
      amount: r.amount,
      build,
      commission,
      roofChoices: Array.isArray(r.roofChoices) && r.roofChoices.length ? [...r.roofChoices] : [...t.roofColours],
      satchel: Number.isInteger(r.satchel) ? r.satchel : (build ? t.buildSatchel[build] ?? 0 : 0),
      clearFlags: Array.isArray(r.clearFlags) ? [...r.clearFlags] : [],
      buildFlags: Array.isArray(r.buildFlags) ? [...r.buildFlags] : [],
    };
  }));
  byTuning.set(t, out);
  return out;
}

/**
 * Highest tier of the ladder.
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function maxTier(ctx) {
  const l = ladder(ctx);
  return l.length ? l[l.length - 1].tier : 0;
}

/**
 * The row of a tier, or null.
 * @param {number} tier
 * @param {EconCtx} [ctx]
 * @returns {LoanRow|null}
 */
export function loanRow(tier, ctx) {
  return ladder(ctx).find((r) => r.tier === tier) ?? null;
}

/**
 * Sum of every loan amount (278,000 at defaults).
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function ladderTotal(ctx) {
  return ladder(ctx).reduce((s, r) => s + r.amount, 0);
}

/**
 * What is left on the open loan.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function balance(world, ctx) {
  const row = loanRow(world.loans.tier, ctx);
  return row ? Math.max(0, row.amount - world.loans.paid) : 0;
}

/**
 * Whether the whole ladder is paid.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function isPaidOff(world, ctx) {
  return world.loans.tier >= maxTier(ctx) && balance(world, ctx) === 0;
}

/**
 * Whether a tier's loan has been paid off.
 * @param {World} world
 * @param {number} tier
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function isCleared(world, tier, ctx) {
  return tier < world.loans.tier || (tier === world.loans.tier && balance(world, ctx) === 0 && loanRow(tier, ctx) !== null);
}

/**
 * Whether Wren's yard takes payments at a minute of day (06:00-24:00). The scene decides whether to ask.
 * @param {number} minute  minute of day
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function yardOpen(minute, ctx) {
  const [open, close] = tuningOf(ctx).yardHours;
  const m = minuteOfDay(minute);
  return open <= close ? m >= open && m < close : m >= open || m < close;
}

// ---------------------------------------------------------------------------------------------
// Ceremony
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Ceremony
 * @property {number} tier
 * @property {number} amount            buttons counted
 * @property {number} beads             abacus beads (one per `beadValue`)
 * @property {number} fastBeads         beads after the speed-up
 * @property {number} notchValue        buttons per notch on this stick (5% of the loan)
 * @property {number} notchesPerStick
 * @property {number} notchesBefore
 * @property {number} notchesAfter
 * @property {number} notchesCut
 * @property {boolean} split            the loan cleared: Ambrose splits the stick (THWAP)
 */

/**
 * The ceremony for counting `amount` onto a stick that already holds `paidBefore` of `loanAmount`.
 * Notches are `floor(paid × notchesPerStick / loanAmount)`, so integer amounts never drift.
 * @param {number} amount
 * @param {number} paidBefore
 * @param {number} loanAmount
 * @param {number} tier
 * @param {EconCtx|null} [ctx]
 * @returns {Ceremony}
 */
export function ceremonyFor(amount, paidBefore, loanAmount, tier, ctx) {
  const t = tuningOf(ctx);
  const N = t.notchesPerStick;
  const notchesAt = (paid) => (loanAmount <= 0 ? N : Math.min(N, Math.floor((paid * N) / loanAmount)));
  const notchesBefore = notchesAt(paidBefore);
  const notchesAfter = notchesAt(paidBefore + amount);
  const beads = Math.floor(amount / t.beadValue);
  return {
    tier,
    amount,
    beads,
    fastBeads: Math.max(0, beads - t.beadSpeedUpAfter),
    notchValue: loanAmount / N,
    notchesPerStick: N,
    notchesBefore,
    notchesAfter,
    notchesCut: notchesAfter - notchesBefore,
    split: paidBefore + amount >= loanAmount,
  };
}

// ---------------------------------------------------------------------------------------------
// Credits (payments, errands, shares)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Clearance
 * @property {number} tier              the tier that cleared
 * @property {string|null} build        build queued for it (null while a commission is unpicked)
 * @property {boolean} needsPick        its commission still has to be picked
 * @property {string[]} roofChoices     colours to offer for that build
 * @property {number|null} nextTier     the loan now offered (null when the ladder is done)
 * @property {boolean} nextNeedsPick    the newly offered loan is a commission tier without a pick
 * @property {boolean} done             the ladder is paid off
 */

/**
 * @param {World} world
 * @param {number} amount
 * @param {string} source
 * @param {number} day
 * @param {EconCtx|undefined} ctx
 */
function logCredit(world, amount, source, day, ctx) {
  const t = tuningOf(ctx);
  const log = world.loans.log;
  log.push({ day, amount, source });
  if (log.length > t.ledgerLogMax) log.splice(0, log.length - t.ledgerLogMax);
}

/**
 * Commission room picked for a tier, or null.
 * @param {World} world
 * @param {number} tier
 * @param {EconCtx} [ctx]
 * @returns {string|null}
 */
export function commissionFor(world, tier, ctx) {
  const idx = tuningOf(ctx).commissionTiers.indexOf(tier);
  return idx >= 0 ? world.loans.commissions[idx] ?? null : null;
}

/**
 * @param {World} world
 * @param {LoanRow} row
 * @param {EconCtx|undefined} ctx
 * @returns {Clearance}
 */
function clearTier(world, row, ctx) {
  const t = tuningOf(ctx);
  const L = world.loans;
  L.tally.push({ tier: row.tier, day: dayOf(world, ctx, t) });
  L.scaffold = Math.min(ladder(ctx).length, L.tally.length);
  flags.setFlag(world, t.clearedFlag, row.tier, ctx);
  if (L.tally.length === 1) flags.setFlag(world, t.firstPaymentFlag, true, ctx);
  for (const f of row.clearFlags) flags.setFlag(world, f, true, ctx);
  const build = row.commission ? commissionFor(world, row.tier, ctx) : row.build;
  if (build && !L.builds.some((b) => b.tier === row.tier)) enqueue(world, row.tier, build, ctx);
  const last = row.tier >= maxTier(ctx);
  if (!last) {
    L.tier = row.tier + 1;
    L.paid = 0;
  }
  emit(ctx, 'loan:tier', { tier: L.tier, prev: row.tier, done: last });
  checkRelighting(world, ctx);
  return {
    tier: row.tier,
    build,
    needsPick: row.commission && !build,
    roofChoices: [...row.roofChoices],
    nextTier: last ? null : L.tier,
    nextNeedsPick: !last && needsCommission(world, ctx),
    done: last,
  };
}

/**
 * Applies a credit to the open loan. A credit that clears the loan carries its remainder onto the
 * next one when `carry` is true (shares), and stops there otherwise.
 * @param {World} world
 * @param {number} amount
 * @param {string} source
 * @param {boolean} carry
 * @param {EconCtx|undefined} ctx
 * @returns {{applied: number, left: number, steps: Array<{tier: number, amount: number, paidBefore: number, ceremony: Ceremony, cleared: Clearance|null}>}}
 */
function credit(world, amount, source, carry, ctx) {
  const t = tuningOf(ctx);
  const day = dayOf(world, ctx, t);
  const L = world.loans;
  let left = amount;
  const steps = [];
  for (let guard = 0; guard <= ladder(ctx).length; guard++) {
    const row = loanRow(L.tier, ctx);
    if (!row) break;
    const bal = Math.max(0, row.amount - L.paid);
    if (bal === 0) {
      // a zero-amount rung clears on its own and the credit moves on
      if (row.tier >= maxTier(ctx)) break;
      steps.push({ tier: row.tier, amount: 0, paidBefore: L.paid, ceremony: ceremonyFor(0, L.paid, row.amount, row.tier, ctx), cleared: clearTier(world, row, ctx) });
      continue;
    }
    if (left <= 0) break;
    const put = Math.min(left, bal);
    const paidBefore = L.paid;
    L.paid += put;
    left -= put;
    logCredit(world, put, source, day, ctx);
    const ceremony = ceremonyFor(put, paidBefore, row.amount, row.tier, ctx);
    emit(ctx, 'loan:paid', { amount: put, source, tier: row.tier, paid: L.paid, balance: row.amount - L.paid });
    const cleared = L.paid >= row.amount ? clearTier(world, row, ctx) : null;
    steps.push({ tier: row.tier, amount: put, paidBefore, ceremony, cleared });
    if (!cleared || !carry) break;
  }
  return { applied: amount - left, left, steps };
}

/**
 * Clears every open loan whose balance is already zero (a zero-amount rung, or a save loaded against
 * a ladder whose amount dropped), offering the next one each time.
 * @param {World} world
 * @param {EconCtx|undefined} ctx
 * @returns {Clearance[]}
 */
function settleZeroRungs(world, ctx) {
  /** @type {Clearance[]} */
  const out = [];
  for (let guard = 0; guard <= ladder(ctx).length; guard++) {
    const row = loanRow(world.loans.tier, ctx);
    if (!row || row.amount - world.loans.paid > 0) break;
    if (row.tier >= maxTier(ctx)) {
      // the last loan stays open at full payment; clear it once if it never split (no tally stick)
      if (!world.loans.tally.some((s) => s.tier === row.tier)) out.push(clearTier(world, row, ctx));
      break;
    }
    out.push(clearTier(world, row, ctx));
  }
  return out;
}

/**
 * Tier-up: when the open loan's balance is zero, splits its stick, queues its build and offers the
 * next loan, repeating while the next one is also at zero. {@link pay} and the share credits do this
 * as part of crediting; call it after a load or a content change so a loan never sits at zero. Safe to
 * call any time (does nothing when the open loan still has a balance).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{cleared: Clearance[], tier: number}}
 */
export function tierUp(world, ctx) {
  return { cleared: settleZeroRungs(world, ctx), tier: world.loans.tier };
}

/**
 * Pays buttons toward the open loan at the yard. The amount is capped at what is owed (`capped`
 * says so); paying more than the wallet holds is refused.
 * @param {World} world
 * @param {number} amount   positive integer
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, paid: number, capped: boolean, tier: number, balance: number, ceremony: Ceremony, cleared: Clearance|null}
 *   | {ok: false, reason: 'nothing-owed'}
 *   | {ok: false, reason: 'insufficient', balance: number, short: number}}
 */
export function pay(world, amount, ctx) {
  assertCount(amount, 'loans.pay');
  settleZeroRungs(world, ctx);
  if (isPaidOff(world, ctx)) return { ok: false, reason: 'nothing-owed' };
  const owed = balance(world, ctx);
  const put = Math.min(amount, owed);
  const spent = wallet.spend(world, put, { ...ctx, source: ctx?.source ?? 'loan' });
  if (!spent.ok) return { ok: false, reason: 'insufficient', balance: spent.balance, short: spent.short };
  const tier = world.loans.tier;
  const r = credit(world, put, ctx?.source ?? 'pay', false, ctx);
  const step = r.steps[r.steps.length - 1];
  return { ok: true, paid: put, capped: put < amount, tier, balance: balance(world, ctx), ceremony: step.ceremony, cleared: step.cleared };
}

/**
 * Credits one First Night Errand (500 off loan 1; six of them; loan 1 only; once per errand id).
 * @param {World} world
 * @param {string} errandId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, credited: number, done: number, balance: number, cleared: Clearance|null, ceremony: Ceremony}
 *   | {ok: false, reason: 'already-credited'|'all-done'|'wrong-tier'}}
 */
export function errand(world, errandId, ctx) {
  assertId(errandId, 'loans.errand');
  const t = tuningOf(ctx);
  const L = world.loans;
  settleZeroRungs(world, ctx);
  if (L.errands.includes(errandId)) return { ok: false, reason: 'already-credited' };
  if (L.errands.length >= t.errandCount) return { ok: false, reason: 'all-done' };
  if (L.tier !== t.errandTier || balance(world, ctx) === 0) return { ok: false, reason: 'wrong-tier' };
  L.errands.push(errandId);
  const r = credit(world, Math.min(t.errandCredit, balance(world, ctx)), 'errand', false, ctx);
  const step = r.steps[r.steps.length - 1];
  return { ok: true, credited: r.applied, done: L.errands.length, balance: balance(world, ctx), cleared: step?.cleared ?? null, ceremony: step?.ceremony ?? ceremonyFor(0, L.paid, loanRow(L.tier, ctx)?.amount ?? 0, L.tier, ctx) };
}

/**
 * The share of the open loan a fraction is worth (rounded to whole buttons).
 * @param {World} world
 * @param {number} fraction
 * @param {EconCtx|undefined} ctx
 * @returns {number}
 */
function shareOf(world, fraction, ctx) {
  const row = loanRow(world.loans.tier, ctx);
  return row ? Math.round(row.amount * fraction) : 0;
}

/**
 * Credits the Spire share when a badge is won: 10% of the open loan, once per spire, notched onto
 * Wren's ledger. A share bigger than the balance clears the loan and carries onto the next one.
 * @param {World} world
 * @param {string} spireId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, credited: number, share: number, balance: number, cleared: Clearance[]}
 *   | {ok: false, reason: 'already-credited'|'nothing-owed'}}
 */
export function spireShare(world, spireId, ctx) {
  assertId(spireId, 'loans.spireShare');
  const L = world.loans;
  if (L.spireShares.includes(spireId)) return { ok: false, reason: 'already-credited' };
  if (isPaidOff(world, ctx)) return { ok: false, reason: 'nothing-owed' };
  const share = shareOf(world, tuningOf(ctx).spireShareFraction, ctx);
  L.spireShares.push(spireId);
  const r = credit(world, share, 'spire', true, ctx);
  return { ok: true, credited: r.applied, share, balance: balance(world, ctx), cleared: r.steps.map((s) => s.cleared).filter(Boolean) };
}

/**
 * Credits a resident share when a neighbor's lead thread finishes: 5% of the open loan (one notch),
 * once per thread; after payoff the neighbor drops 4,000 into the Commons Jar instead.
 * @param {World} world
 * @param {string} threadId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, to: 'loan', credited: number, share: number, balance: number, cleared: Clearance[]}
 *   | {ok: true, to: 'jar', credited: number, jar: number}
 *   | {ok: false, reason: 'already-credited'}}
 */
export function residentShare(world, threadId, ctx) {
  assertId(threadId, 'loans.residentShare');
  const t = tuningOf(ctx);
  const L = world.loans;
  if (L.residentShares.includes(threadId)) return { ok: false, reason: 'already-credited' };
  L.residentShares.push(threadId);
  if (isPaidOff(world, ctx)) {
    L.commons.jar += t.residentShareAfterPayoff;
    emit(ctx, 'commons:changed', { jar: L.commons.jar, delta: t.residentShareAfterPayoff, source: 'resident' });
    return { ok: true, to: 'jar', credited: t.residentShareAfterPayoff, jar: L.commons.jar };
  }
  const share = shareOf(world, t.residentShareFraction, ctx);
  const r = credit(world, share, 'resident', true, ctx);
  return { ok: true, to: 'loan', credited: r.applied, share, balance: balance(world, ctx), cleared: r.steps.map((s) => s.cleared).filter(Boolean) };
}

// ---------------------------------------------------------------------------------------------
// Commissions and roofs
// ---------------------------------------------------------------------------------------------

/**
 * Room ids that can be commissioned: `data.commissions` rows when present, else `commissionRooms`.
 * @param {EconCtx} [ctx]
 * @returns {string[]}
 */
export function commissionRooms(ctx) {
  const rows = lookup(ctx?.data).list('commissions');
  return rows.length ? rows.map((r) => r.id) : [...tuningOf(ctx).commissionRooms];
}

/**
 * Rooms not commissioned yet.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {string[]}
 */
export function commissionOptions(world, ctx) {
  return commissionRooms(ctx).filter((id) => !world.loans.commissions.includes(id));
}

/**
 * The commission tier waiting for a pick (offered or already cleared), or null.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {number|null}
 */
export function pendingPickTier(world, ctx) {
  const tiers = tuningOf(ctx).commissionTiers;
  const idx = world.loans.commissions.length;
  if (idx >= tiers.length) return null;
  return tiers[idx] <= world.loans.tier ? tiers[idx] : null;
}

/**
 * Whether Wren is waiting on a room pick.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function needsCommission(world, ctx) {
  return pendingPickTier(world, ctx) !== null;
}

/**
 * Picks the room for the next commission tier (loans 3-6, in order). Allowed once that loan is
 * offered; if it has already cleared, its build is queued now.
 * @param {World} world
 * @param {string} roomId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, roomId: string, tier: number, queued: Build|null}
 *   | {ok: false, reason: 'unknown-room'|'already-chosen'|'no-slot'|'not-yet'}}
 */
export function chooseCommission(world, roomId, ctx) {
  assertId(roomId, 'loans.chooseCommission');
  const t = tuningOf(ctx);
  const L = world.loans;
  if (!commissionRooms(ctx).includes(roomId)) return { ok: false, reason: 'unknown-room' };
  if (L.commissions.includes(roomId)) return { ok: false, reason: 'already-chosen' };
  const idx = L.commissions.length;
  if (idx >= t.commissionTiers.length) return { ok: false, reason: 'no-slot' };
  const tier = t.commissionTiers[idx];
  if (tier > L.tier) return { ok: false, reason: 'not-yet' };
  L.commissions.push(roomId);
  emit(ctx, 'loan:commission', { roomId, tier });
  const queued = isCleared(world, tier, ctx) && !L.builds.some((b) => b.tier === tier) ? enqueue(world, tier, roomId, ctx) : null;
  return { ok: true, roomId, tier, queued };
}

/**
 * Buys one of the rooms left over after the four picks, once the lamp is relit (20,000 each).
 * Queued as a build like any other (tier 0).
 * @param {World} world
 * @param {string} roomId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, roomId: string, spent: number, queued: Build}
 *   | {ok: false, reason: 'not-relit'|'pick-first'|'unknown-room'|'already-chosen'|'insufficient', short?: number}}
 */
export function buyLeftoverCommission(world, roomId, ctx) {
  assertId(roomId, 'loans.buyLeftoverCommission');
  const t = tuningOf(ctx);
  const L = world.loans;
  if (!world.flags[t.relitFlag]) return { ok: false, reason: 'not-relit' };
  if (L.commissions.length < t.commissionTiers.length) return { ok: false, reason: 'pick-first' };
  if (!commissionRooms(ctx).includes(roomId)) return { ok: false, reason: 'unknown-room' };
  if (L.commissions.includes(roomId)) return { ok: false, reason: 'already-chosen' };
  const spent = wallet.spend(world, t.leftoverCommissionPrice, { ...ctx, source: ctx?.source ?? 'commission' });
  if (!spent.ok) return { ok: false, reason: 'insufficient', short: spent.short };
  L.commissions.push(roomId);
  emit(ctx, 'loan:commission', { roomId, tier: 0 });
  return { ok: true, roomId, spent: t.leftoverCommissionPrice, queued: enqueue(world, 0, roomId, ctx) };
}

/**
 * Roof colours offered for a tier's build.
 * @param {number} tier
 * @param {EconCtx} [ctx]
 * @returns {string[]}
 */
export function roofChoices(tier, ctx) {
  const row = loanRow(tier, ctx);
  return row ? [...row.roofChoices] : [...tuningOf(ctx).roofColours];
}

/**
 * Sets the roof colour of a queued build (by tier, or by build id) before it lands.
 * @param {World} world
 * @param {number|string} target   tier number or build id
 * @param {string} colour
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, id: string, tier: number, choice: string} | {ok: false, reason: 'no-build'|'already-built'|'unknown-colour'}}
 */
export function chooseRoof(world, target, colour, ctx) {
  assertId(colour, 'loans.chooseRoof');
  const b = world.loans.builds.find((x) => (typeof target === 'number' ? x.tier === target : x.id === target) && !x.done)
    ?? world.loans.builds.find((x) => (typeof target === 'number' ? x.tier === target : x.id === target));
  if (!b) return { ok: false, reason: 'no-build' };
  if (b.done) return { ok: false, reason: 'already-built' };
  if (!roofChoices(b.tier, ctx).includes(colour)) return { ok: false, reason: 'unknown-colour' };
  b.choice = colour;
  return { ok: true, id: b.id, tier: b.tier, choice: colour };
}

// ---------------------------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------------------------

/**
 * Total minute a build with `readyDay` lands at.
 * @param {number} readyDay
 * @param {EconCtx|undefined} ctx
 * @returns {number}
 */
function landTotal(readyDay, ctx) {
  return readyDay * MINUTES_PER_DAY + tuningOf(ctx).buildLandMinute;
}

/**
 * Queues a build for the first night that still has room (one per night), landing at 05:40.
 * @param {World} world
 * @param {number} tier
 * @param {string} id
 * @param {EconCtx|undefined} ctx
 * @returns {Build}
 */
function enqueue(world, tier, id, ctx) {
  const t = tuningOf(ctx);
  const now = nowOf(world, ctx);
  let readyDay = Math.floor((now - t.buildLandMinute) / MINUTES_PER_DAY) + 1; // the next 05:40 strictly after now
  const perNight = (d) => world.loans.builds.filter((b) => b.readyDay === d).length;
  while (perNight(readyDay) >= t.buildsPerNight) readyDay += 1;
  /** @type {Build} */
  const b = { id, tier, startedDay: clockDay(now), readyDay, choice: null, done: false };
  world.loans.builds.push(b);
  return { ...b };
}

/**
 * Copies of the builds not landed yet, soonest first.
 * @param {World} world
 * @returns {Build[]}
 */
export function buildQueue(world) {
  return world.loans.builds.filter((b) => !b.done).sort((a, b) => a.readyDay - b.readyDay).map((b) => ({ ...b }));
}

/**
 * When the next queued build lands, or null.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{id: string, tier: number, total: number, day: number, minute: number}|null}
 */
export function nextLanding(world, ctx) {
  const next = buildQueue(world)[0];
  if (!next) return null;
  return { id: next.id, tier: next.tier, total: landTotal(next.readyDay, ctx), day: next.readyDay, minute: tuningOf(ctx).buildLandMinute };
}

/**
 * Satchel slots a build adds.
 * @param {Build} b
 * @param {EconCtx|undefined} ctx
 * @returns {number}
 */
function satchelBonus(b, ctx) {
  const row = b.tier > 0 ? loanRow(b.tier, ctx) : null;
  if (row && !row.commission) return row.satchel;
  const room = lookup(ctx?.data).row('commissions', b.id);
  if (room && Number.isInteger(room.satchel)) return room.satchel;
  return tuningOf(ctx).buildSatchel[b.id] ?? 0;
}

/**
 * Flags a landing build sets: `sys.build.<id>` always, plus the row's `buildFlags` (fixed builds) or
 * the commission row's `flags`.
 * @param {Build} b
 * @param {EconCtx|undefined} ctx
 * @returns {string[]}
 */
function buildFlagsOf(b, ctx) {
  const out = [`sys.build.${b.id}`];
  const row = b.tier > 0 ? loanRow(b.tier, ctx) : null;
  if (row && !row.commission) out.push(...row.buildFlags);
  const room = lookup(ctx?.data).row('commissions', b.id);
  if (room && Array.isArray(room.flags)) out.push(...room.flags);
  return out;
}

/**
 * Lands every queued build whose 05:40 has come (call on the clock tick, at Rest, and after a load).
 * A build with no roof picked takes the default colour. Then checks the Relighting.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{landed: Build[], relighting: {set: boolean, day: number|null}}}
 */
export function landDue(world, ctx) {
  const t = tuningOf(ctx);
  const now = nowOf(world, ctx);
  const due = world.loans.builds.filter((b) => !b.done && landTotal(b.readyDay, ctx) <= now).sort((a, b) => a.readyDay - b.readyDay);
  /** @type {Build[]} */
  const landed = [];
  for (const b of due) {
    b.done = true;
    if (b.choice === null) b.choice = t.roofDefault;
    const slotsAdded = satchelBonus(b, ctx);
    if (slotsAdded > 0) bag.expand(world, slotsAdded, { ...ctx, source: `build:${b.id}` });
    for (const f of buildFlagsOf(b, ctx)) flags.setFlag(world, f, true, ctx);
    if (b.tier > 0 && b.tier === maxTier(ctx)) flags.setFlag(world, t.lampRoomBuiltFlag, true, ctx);
    emit(ctx, 'loan:built', { id: b.id, tier: b.tier, choice: b.choice });
    landed.push({ ...b });
  }
  return { landed, relighting: checkRelighting(world, ctx) };
}

// ---------------------------------------------------------------------------------------------
// The Relighting
// ---------------------------------------------------------------------------------------------

/**
 * Sets the Relighting flag once the last loan is paid AND its build (the Lamp Room) has landed. The
 * value is the clock day whose dusk fires it: today when it is before dusk, else tomorrow.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{set: boolean, day: number|null}}  `set` is true only on the call that set the flag
 */
export function checkRelighting(world, ctx) {
  const t = tuningOf(ctx);
  const existing = world.flags[t.relightFlag];
  if (Number.isInteger(existing)) return { set: false, day: /** @type {number} */ (existing) };
  if (world.flags[t.relitFlag]) return { set: false, day: null };
  const last = maxTier(ctx);
  if (!last || !isPaidOff(world, ctx)) return { set: false, day: null };
  if (!world.loans.builds.some((b) => b.tier === last && b.done)) return { set: false, day: null };
  const now = nowOf(world, ctx);
  const day = clockDay(now) + (minuteOfDay(now) < t.relightMinute ? 0 : 1);
  flags.setFlag(world, t.relightFlag, day, ctx);
  return { set: true, day };
}

/**
 * Whether the Relighting should fire now (its dusk has come and the lamp is not lit yet).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {boolean}
 */
export function relightingDue(world, ctx) {
  const t = tuningOf(ctx);
  const day = world.flags[t.relightFlag];
  if (!Number.isInteger(day) || world.flags[t.relitFlag]) return false;
  return nowOf(world, ctx) >= /** @type {number} */ (day) * MINUTES_PER_DAY + t.relightMinute;
}

/**
 * Marks the lamp lit (the ending flow calls this when the Relighting plays).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{changed: boolean}}
 */
export function markRelit(world, ctx) {
  return { changed: flags.setFlag(world, tuningOf(ctx).relitFlag, true, ctx).changed };
}

// ---------------------------------------------------------------------------------------------
// Commons Jar
// ---------------------------------------------------------------------------------------------

/**
 * The Commons projects: `data.commons` rows when present, else the `commonsProjects` tuning.
 * @param {EconCtx} [ctx]
 * @returns {CommonsProject[]}
 * @throws {TypeError} for a malformed data row (a NaN cost would otherwise corrupt the jar)
 */
export function commonsProjects(ctx) {
  const rows = lookup(ctx?.data).list('commons');
  if (!rows.length) return tuningOf(ctx).commonsProjects;
  rows.forEach((p, i) => {
    if (!isProject(p)) throw new TypeError(`loans: commons row ${i} must be {id, cost: integer >= 0, neighborShare?: 0..1}, got ${JSON.stringify(p)}`);
  });
  return rows;
}

/**
 * The player's share of a project's cost (the neighbors cover `neighborShare`).
 * @param {CommonsProject} project
 * @param {EconCtx} [ctx]
 * @returns {number}
 */
export function projectShare(project, ctx) {
  const frac = typeof project.neighborShare === 'number' ? project.neighborShare : tuningOf(ctx).commonsNeighborShare;
  return project.cost - Math.round(project.cost * frac);
}

/**
 * Drops buttons into the Commons Jar.
 * @param {World} world
 * @param {number} amount   positive integer
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, jar: number} | {ok: false, reason: 'insufficient', short: number}}
 */
export function depositJar(world, amount, ctx) {
  assertCount(amount, 'loans.depositJar');
  const r = wallet.spend(world, amount, { ...ctx, source: ctx?.source ?? 'commons' });
  if (!r.ok) return { ok: false, reason: 'insufficient', short: r.short };
  world.loans.commons.jar += amount;
  emit(ctx, 'commons:changed', { jar: world.loans.commons.jar, delta: amount, source: ctx?.source ?? 'deposit' });
  return { ok: true, jar: world.loans.commons.jar };
}

/**
 * @param {World} world
 * @param {CommonsProject} p
 * @param {EconCtx|undefined} ctx
 * @returns {boolean}
 */
function projectUnlocked(world, p, ctx) {
  if (p.cond === undefined || p.cond === null) return true;
  const data = ctx?.data && typeof ctx.data.has === 'function' ? ctx.data : null;
  return evalCond(world, p.cond, { data });
}

/**
 * Funds a Commons project from the jar when it holds the player's share and the project is unlocked.
 * @param {World} world
 * @param {string} projectId
 * @param {EconCtx} [ctx]
 * @returns {{ok: true, id: string, spent: number, jar: number}
 *   | {ok: false, reason: 'unknown-project'|'already-built'|'locked'|'short', short?: number}}
 */
export function fundProject(world, projectId, ctx) {
  assertId(projectId, 'loans.fundProject');
  const p = commonsProjects(ctx).find((x) => x.id === projectId);
  const C = world.loans.commons;
  if (!p) return { ok: false, reason: 'unknown-project' };
  if (C.built.includes(projectId)) return { ok: false, reason: 'already-built' };
  if (!projectUnlocked(world, p, ctx)) return { ok: false, reason: 'locked' };
  const share = projectShare(p, ctx);
  if (C.jar < share) return { ok: false, reason: 'short', short: share - C.jar };
  C.jar -= share;
  C.built.push(projectId);
  flags.setFlag(world, `sys.commons.${projectId}`, true, ctx);
  for (const f of Array.isArray(p.flags) ? p.flags : []) flags.setFlag(world, f, true, ctx);
  emit(ctx, 'commons:changed', { jar: C.jar, delta: -share, source: `project:${projectId}` });
  emit(ctx, 'commons:built', { id: projectId });
  return { ok: true, id: projectId, spent: share, jar: C.jar };
}

/**
 * The Commons board rows: each project's share, whether it is built, unlocked and affordable.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {Array<{id: string, cost: number, share: number, built: boolean, unlocked: boolean, affordable: boolean}>}
 */
export function commonsStatus(world, ctx) {
  const C = world.loans.commons;
  return commonsProjects(ctx).map((p) => {
    const share = projectShare(p, ctx);
    const built = C.built.includes(p.id);
    const unlocked = projectUnlocked(world, p, ctx);
    return { id: p.id, cost: p.cost, share, built, unlocked, affordable: !built && unlocked && C.jar >= share };
  });
}

// ---------------------------------------------------------------------------------------------
// Ledger Board
// ---------------------------------------------------------------------------------------------

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/**
 * Wren's pace line: what is left on the open loan over the average daily credit of the last
 * `paceWindowDays` economy days (fewer when the run is younger).
 * `key` / `n` are for strings.js (`loan.pace.<key>`); `text` is the default English line.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{remaining: number, perDay: number, days: number|null, key: 'paid'|'none'|'day'|'days'|'long', n: number|null, text: string}}
 */
export function paceEstimate(world, ctx) {
  const t = tuningOf(ctx);
  const remaining = isPaidOff(world, ctx) ? 0 : balance(world, ctx);
  if (remaining === 0) return { remaining, perDay: 0, days: 0, key: 'paid', n: null, text: 'Paid in full.' };
  const today = dayOf(world, ctx, t);
  const log = world.loans.log;
  const first = log.length ? Math.min(...log.map((e) => e.day)) : today;
  const span = Math.max(1, Math.min(t.paceWindowDays, today - first + 1));
  const sum = log.filter((e) => e.day > today - span && e.day <= today).reduce((s, e) => s + e.amount, 0);
  const perDay = sum / span;
  if (perDay <= 0) return { remaining, perDay: 0, days: null, key: 'none', n: null, text: 'No pace yet.' };
  const days = Math.max(1, Math.ceil(remaining / perDay));
  if (days === 1) return { remaining, perDay, days, key: 'day', n: 1, text: 'About a day at this pace.' };
  if (days < NUMBER_WORDS.length) return { remaining, perDay, days, key: 'days', n: days, text: `About ${NUMBER_WORDS[days]} days at this pace.` };
  return { remaining, perDay, days, key: 'long', n: days, text: 'More than twenty days at this pace.' };
}

/**
 * Credits toward the loans today, by source (`pay`, `errand`, `spire`, `resident`, ...).
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {Record<string, number>}
 */
export function todayBySource(world, ctx) {
  const today = dayOf(world, ctx, tuningOf(ctx));
  /** @type {Record<string, number>} */
  const out = {};
  for (const e of world.loans.log) if (e.day === today) out[e.source] = (out[e.source] ?? 0) + e.amount;
  return out;
}

/**
 * The split sticks on the tally wall, in order.
 * @param {World} world
 * @returns {Array<{tier: number, day: number}>}
 */
export function tallyWall(world) {
  return world.loans.tally.map((s) => ({ tier: s.tier, day: s.day }));
}

/**
 * @typedef {Object} House
 * @property {number} tier
 * @property {'paid'|'paying'|'pick'|'later'|'finale'} state   the Hearth Ledger's seven carved houses
 * @property {string|null} build     build id (or the picked room)
 * @property {string|null} roof      roof colour once chosen / landed
 * @property {boolean} built         landed
 */

/**
 * Everything the Ledger, the Ledger Board and the Day Page show about the loans.
 * @param {World} world
 * @param {EconCtx} [ctx]
 * @returns {{tier: number, amount: number, paid: number, balance: number, notches: number, notchesPerStick: number,
 *   notchValue: number, paidOff: boolean, scaffold: number, scaffoldMax: number, totalPaid: number, totalOwed: number,
 *   ladderTotal: number, needsCommission: boolean, pendingPickTier: number|null, houses: House[], jar: number}}
 */
export function status(world, ctx) {
  const t = tuningOf(ctx);
  const L = world.loans;
  const rows = ladder(ctx);
  const row = loanRow(L.tier, ctx);
  const amount = row?.amount ?? 0;
  const bal = balance(world, ctx);
  const paidOff = isPaidOff(world, ctx);
  const totalPaid = rows.filter((r) => isCleared(world, r.tier, ctx)).reduce((s, r) => s + r.amount, 0) + (paidOff || bal === 0 ? 0 : L.paid);
  const last = maxTier(ctx);
  const houses = rows.map((r) => {
    const b = L.builds.find((x) => x.tier === r.tier) ?? null;
    const buildId = r.commission ? commissionFor(world, r.tier, ctx) : r.build;
    /** @type {House['state']} */
    let state;
    if (isCleared(world, r.tier, ctx)) state = r.commission && !buildId ? 'pick' : 'paid';
    else if (r.tier === L.tier) state = r.commission && !buildId ? 'pick' : 'paying';
    else state = r.tier === last ? 'finale' : 'later';
    return { tier: r.tier, state, build: buildId, roof: b?.choice ?? null, built: b?.done ?? false };
  });
  return {
    tier: L.tier,
    amount,
    paid: L.paid,
    balance: bal,
    notches: amount > 0 ? Math.min(t.notchesPerStick, Math.floor((L.paid * t.notchesPerStick) / amount)) : t.notchesPerStick,
    notchesPerStick: t.notchesPerStick,
    notchValue: amount / t.notchesPerStick,
    paidOff,
    scaffold: L.scaffold,
    scaffoldMax: rows.length,
    totalPaid,
    totalOwed: ladderTotal(ctx) - totalPaid,
    ladderTotal: ladderTotal(ctx),
    needsCommission: needsCommission(world, ctx),
    pendingPickTier: pendingPickTier(world, ctx),
    houses,
    jar: L.commons.jar,
  };
}

// GDD-02 Economy tables (js/data/{tuning,loans,dials,shops,items}.js): the validator is clean for
// every table this chapter owns, the tables are complete against the id manifest, references into
// other chapters' tables resolve against the manifest's id lists, every system accepts the tuning
// table, the GDD-00 numbers hold, and the average-day economy sim lands the Relighting on day 11-16.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as M from '../js/data/ids.manifest.js';
import { DATA } from '../js/data/index.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import TUNING_DEFAULT, * as tuningMod from '../js/data/tuning.js';
import { LOANS, COMMISSIONS, COMMONS, LADDER_TOTAL } from '../js/data/loans.js';
import { DIALS, CHALLENGES, TOGGLE_ORDER, DEFAULT_DIAL } from '../js/data/dials.js';
import { SHOPS } from '../js/data/shops.js';
import { ITEMS } from '../js/data/items.js';
import { USE_HANDLERS } from '../js/systems/bag.js';
import { withinHours } from '../js/systems/shops.js';
import { DAY1_LOW_MINUTE, POCKET_IDS } from '../js/state/schema.js';
import { setSeedToggles, encodeSeedCode, decodeSeedCode } from '../js/core/rng.js';

const { TUNING } = tuningMod;
const OWNED = ['items', 'loans', 'shops', 'dials', 'challenges'];
const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
const ITEM = byId(ITEMS);
const SHOP = byId(SHOPS);

// Other chapters' tables are still placeholders: stub the rows our references point at from the
// manifest (npcs for shop keepers), then keep only the errors that name a table this chapter owns.
const ECON_DATA = {
  ...DATA,
  items: ITEMS, loans: LOANS, shops: SHOPS, dials: DIALS, challenges: CHALLENGES,
  commissions: COMMISSIONS, commons: COMMONS,
  npcs: M.NPC_IDS.map((id) => ({ id, name: id })),
};
const mine = (lines) => lines.filter((l) => OWNED.some((t) => l.startsWith(`${t}:`)));

describe('validator and manifest', () => {
  test('validateData reports zero errors for the economy tables (use handlers checked)', () => {
    const { errors, warnings } = validateData(ECON_DATA, { tuning: TUNING, useHandlers: new Set(Object.keys(USE_HANDLERS)) });
    assert.deepEqual(mine(errors), []);
    // A flag read by a stock cond is set by a story script (GDD-07); the reference test checks it is a manifest flag.
    assert.deepEqual(mine(warnings).filter((w) => !w.includes('is read but never set')), [], 'no warnings either (sell above price, unchecked handlers)');
  });

  test('checkManifest: items, shops, dials and challenges are complete with no extra ids', () => {
    const { warnings, notes } = checkManifest(ECON_DATA, M.MANIFEST);
    assert.deepEqual(mine(warnings).filter((w) => !w.startsWith('loans:')), []);
    for (const t of ['items', 'shops', 'dials', 'challenges']) assert.ok(!notes.some((n) => n.includes(`'${t}'`)), `${t} counts as authored`);
    assert.equal(ITEMS.length, M.MANIFEST.items.ids.length);
    assert.deepEqual(ITEMS.map((i) => i.id).sort(), [...M.MANIFEST.items.ids].sort());
    assert.deepEqual(SHOPS.map((s) => s.id).sort(), [...M.SHOP_IDS].sort());
    assert.deepEqual(DIALS.map((d) => d.id), [...M.DIAL_IDS]);
    assert.deepEqual(CHALLENGES.map((c) => c.id), [...M.CHALLENGE_IDS]);
  });

  test('loans: tier-N ids (cond DSL, systems/loans, validator) equal the manifest LOAN_IDS', () => {
    assert.deepEqual(LOANS.map((l) => l.id), LOANS.map((l) => `tier-${l.tier}`));
    assert.deepEqual(LOANS.map((l) => l.id), [...M.LOAN_IDS]);
    assert.deepEqual(LOANS.map((l) => l.manifestId), [...M.LOAN_IDS]);
  });

  test('commissions and Commons projects match the manifest', () => {
    assert.deepEqual(COMMISSIONS.map((c) => c.id), [...M.COMMISSION_IDS]);
    assert.deepEqual(COMMONS.map((c) => c.id), [...M.COMMONS_PROJECT_IDS]);
    assert.deepEqual([...TUNING.commissionRooms], [...M.COMMISSION_IDS]);
    assert.deepEqual(TUNING.commonsProjects.map((p) => p.id), [...M.COMMONS_PROJECT_IDS]);
  });
});

describe('references into other chapters resolve against the manifest', () => {
  const collections = new Set([...M.FISH_IDS, ...M.BUG_IDS, ...M.FIND_IDS, ...M.FRUIT_IDS]);
  const flags = new Set(M.FLAG_IDS);
  const condFlags = (c, out = []) => {
    if (!c || typeof c !== 'object') return out;
    if (typeof c.flag === 'string') out.push(c.flag);
    for (const v of Object.values(c)) if (v && typeof v === 'object') (Array.isArray(v) ? v : [v]).forEach((x) => condFlags(x, out));
    return out;
  };

  test('shop keepers, flags, decor, wanted pools, back room, refining, auction, bounty', () => {
    for (const s of SHOPS) {
      assert.ok(M.NPC_IDS.includes(s.keeper), `${s.id} keeper ${s.keeper}`);
      for (const st of s.stock) for (const f of condFlags(st.cond)) assert.ok(flags.has(f), `${s.id}: flag ${f}`);
      for (const f of condFlags(s.cond)) assert.ok(flags.has(f), `${s.id}: flag ${f}`);
      if (s.decor) {
        for (const f of s.decor.furniture) assert.ok(M.FURNITURE_IDS.includes(f), `${s.id}: furniture ${f}`);
        for (const c of s.decor.clothes) assert.ok(M.CLOTHES_IDS.includes(c), `${s.id}: clothes ${c}`);
      }
      for (const id of s.wantedPool ?? []) assert.ok(collections.has(id) || ITEM.has(id), `${s.id}: wanted ${id}`);
      for (const id of s.backRoom ?? []) assert.ok(ITEM.get(id)?.pocket === 'keepsakes', `${s.id}: back room ${id}`);
      for (const id of s.refine?.from ?? []) assert.ok(M.FIND_IDS.includes(id), `${s.id}: refines ${id}`);
      if (s.refine) assert.ok(ITEM.has(s.refine.to));
      for (const lot of s.auction?.lots ?? []) for (const d of lot.pool) assert.ok(M.DISC_IDS.includes(d), `${s.id}: lot ${d}`);
      if (s.auction) assert.ok(M.SCRIPT_IDS.includes(s.auction.script));
      for (const id of s.bounty?.pool ?? []) assert.ok(collections.has(id), `${s.id}: bounty ${id}`);
      if (s.services?.recall) assert.ok(M.NPC_IDS.includes(s.services.recall.keeper));
    }
  });

  test('items: disc moves, tilt types, seedling fruit, workshop tilts, loan roofs', () => {
    for (const [discId, move] of Object.entries(M.DISC_MOVES)) assert.equal(ITEM.get(discId).move, move, discId);
    for (const it of ITEMS) if (it.move) assert.ok(M.TECHNIQUE_IDS.includes(it.move), it.id);
    const typeNames = M.TYPE_IDS.map((t) => t[0].toUpperCase() + t.slice(1));
    for (const it of ITEMS.filter((i) => i.kind === 'tilt')) {
      assert.ok(typeNames.includes(it.type), it.id);
      assert.equal(it.id, `tilt-${it.type.toLowerCase()}`);
    }
    for (const f of ITEM.get('fruit-seedling').plants) assert.ok(M.FRUIT_IDS.includes(f));
    const ws = COMMISSIONS.find((c) => c.id === 'workshop').effects;
    for (const t of ws.tiltIds) assert.ok(ITEM.has(t));
    for (const r of ws.tiltsFrom) assert.ok(M.FIND_IDS.includes(r));
    for (const l of LOANS) for (const r of l.roofChoices) assert.ok(M.ROOF_COLOUR_IDS.includes(r), `${l.id} roof ${r}`);
    assert.deepEqual([...TUNING.roofColours], [...M.ROOF_COLOUR_IDS]);
    assert.equal(TUNING.roofDefault, 'slate-blue');
    for (const f of [TUNING.relitFlag, TUNING.firstPaymentFlag, TUNING.lampRoomBuiltFlag]) assert.ok(flags.has(f), f);
    assert.ok(M.PORCH_IDS.includes(TUNING.homePorchId));
    assert.equal(TUNING.porchesLitAtStart.length, 7);
    for (const p of TUNING.porchesLitAtStart) assert.ok(M.PORCH_IDS.includes(p), p);
    assert.ok(M.FLAG_IDS.includes(TUNING.TIDE_BAR_LIT_FLAG));
    for (const f of TUNING.festivals) assert.ok(M.FESTIVAL_IDS.includes(f.id));
  });
});

describe('items: GDD-00 §7 price list', () => {
  const price = (id) => ITEM.get(id).price;

  test('every row is well-formed', () => {
    for (const it of ITEMS) {
      assert.ok(POCKET_IDS.includes(it.pocket), it.id);
      assert.ok(typeof it.name === 'string' && it.name.length > 0 && !/placeholder|todo|tbd/i.test(it.name + it.text), it.id);
      assert.ok(it.text.length >= 20, `${it.id} has real text`);
      assert.ok(it.sell <= it.price, `${it.id} sell <= price`);
      assert.equal(it.oneOfAKind, it.pocket === 'keepsakes', `${it.id} oneOfAKind iff keepsake`);
      if (it.use) assert.ok(USE_HANDLERS[it.use], `${it.id} use ${it.use}`);
    }
  });

  test('wicks, medicine, cures, Crackdust, Still Knot, Starsalt, anchor stones', () => {
    assert.deepEqual(['tallow-wick', 'brass-wick', 'skyglass-wick'].map(price), [100, 300, 600]);
    assert.deepEqual(['tallow-wick', 'brass-wick', 'skyglass-wick'].map((id) => TUNING.lanternGrades[ITEM.get(id).use]), [1, 1.5, 2]);
    assert.deepEqual(['salve', 'tonic', 'full-salve', 'revive', 'ether', 'full-ether'].map(price), [80, 240, 600, 600, 250, 700]);
    assert.equal(ITEM.get('revive').fraction, 0.5);
    assert.deepEqual(['poultice', 'warm-shawl'].map(price), [150, 150]);
    assert.deepEqual(ITEM.get('poultice').cures, ['burn', 'poison']);
    assert.deepEqual(ITEM.get('warm-shawl').cures, ['chill', 'numb']);
    assert.equal(price('crackdust'), 300);
    assert.equal(ITEM.get('crackdust').turns, TUNING.crackdustTurns);
    assert.ok(price('crackdust') < TUNING.payoutPerLevel * 9, 'below one Cairnhold route payout (Lv9+)');
    assert.equal(price('still-knot'), 2000);
    assert.equal(price('starsalt'), TUNING.starsaltPrice);
    assert.equal(ITEM.get('starsalt').wallet, 'starsalt');
    assert.equal(ITEM.get('starsalt').sell, 0, 'never sold back');
    assert.equal(price('anchor-stone'), TUNING.anchorPrice);
    assert.equal(ITEM.get('anchor-stone').wallet, 'anchors');
    assert.equal(price('honeycomb'), 350);
  });

  test('spares sell back at 50%; goods at full price', () => {
    for (const it of ITEMS) {
      if (it.wallet || it.pocket === 'keepsakes' || it.pocket === 'tools') continue;
      if (TUNING.fullPriceKinds.includes(it.kind)) assert.equal(it.sell, it.price, it.id);
      else assert.equal(it.sell, Math.floor(it.price * TUNING.spareSellRate), it.id);
    }
  });

  test('12 reusable discs at 1,500-4,000; Gnash and Plumbline never sold', () => {
    const discs = ITEMS.filter((i) => i.pocket === 'discs');
    assert.equal(discs.length, 12);
    for (const d of discs) {
      assert.equal(d.use, 'disc');
      assert.equal(USE_HANDLERS.disc.consume, false, 'reusable');
      if (['disc-gnash', 'disc-plumbline'].includes(d.id)) assert.equal(d.price, 0);
      else assert.ok(d.price >= TUNING.discPriceRange[0] && d.price <= TUNING.discPriceRange[1], d.id);
    }
  });

  test('Isolde\'s Lantern: one sure catch, a one-of-a-kind keepsake that asks first', () => {
    const l = ITEM.get('isoldes-lantern');
    assert.equal(l.pocket, 'keepsakes');
    assert.equal(l.oneOfAKind, true);
    assert.equal(l.use, 'sure-catch');
    assert.equal(USE_HANDLERS['sure-catch'].consume, true);
    assert.equal(TUNING.lantern.sure.mult, Infinity);
  });
});

describe('loans, commissions, Commons', () => {
  test('the ladder: 278,000 over seven tiers, 5% notches, target days, one scaffold section each', () => {
    assert.equal(LADDER_TOTAL, 278000);
    assert.deepEqual(LOANS.map((l) => l.amount), [6000, 15000, 25000, 36000, 50000, 66000, 80000]);
    assert.deepEqual(LOANS.map((l) => l.notch), [300, 750, 1250, 1800, 2500, 3300, 4000]);
    for (const l of LOANS) assert.equal(l.notch, l.amount * TUNING.residentShareFraction);
    assert.deepEqual(LOANS.map((l) => l.targetDay), [...TUNING.loanTargetDays]);
    assert.deepEqual(LOANS.map((l) => l.scaffoldStage), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(LOANS.map((l) => l.commissionSlot), [false, false, true, true, true, true, false]);
    assert.deepEqual(LOANS.filter((l) => l.commissionSlot).map((l) => l.tier), [...TUNING.commissionTiers]);
    assert.deepEqual(LOANS.map((l) => l.build), ['bedsit', 'cottage', null, null, null, null, 'lamp-room']);
    assert.equal(LOANS[1].satchel, 10, 'the cottage adds ten satchel slots');
    assert.deepEqual(TUNING.loanLadder.map((r) => r.amount), LOANS.map((l) => l.amount));
    assert.equal(TUNING.errandCredit * TUNING.errandCount, 3000, 'errands cover 3,000 of loan 1');
  });

  test('commissions: six rooms with town and creature effects; the Cellar doubles storage', () => {
    for (const c of COMMISSIONS) assert.ok(c.town.length > 20 && c.creature.length > 20 && c.text.length > 20, c.id);
    const cellar = COMMISSIONS.find((c) => c.id === 'cellar');
    assert.equal(cellar.satchel, 10);
    assert.equal(cellar.effects.boxCapacity, TUNING.boxCapacityCellar);
    assert.equal(TUNING.BOX_CAPACITY * 2, cellar.effects.boxCapacity);
    assert.equal(COMMISSIONS.find((c) => c.id === 'training-yard').effects.yardShare, TUNING.YARD_SHARE);
    assert.equal(COMMISSIONS.find((c) => c.id === 'workshop').effects.cleanMult, TUNING.findCleanMult);
    assert.equal(TUNING.leftoverCommissionPrice, 20000);
  });

  test('Commons projects: 3,000-12,000, neighbours add 10-30%, the green Yard waits for badge 5', () => {
    assert.deepEqual(COMMONS.map((p) => p.cost), [3000, 4000, 5000, 6000, 10000, 12000]);
    for (const p of COMMONS) assert.ok(p.neighborShare >= 0.1 && p.neighborShare <= 0.3, p.id);
    assert.deepEqual(COMMONS.find((p) => p.id === 'training-yard-green').cond, { badge: 5 });
    assert.deepEqual(TUNING.commonsProjects.map((p) => [p.cost, p.neighborShare]), COMMONS.map((p) => [p.cost, p.neighborShare]));
  });
});

describe('dials, challenges, toggles', () => {
  test('dial shift tables equal GDD-00 §8 and the tuning keys the systems read', () => {
    for (const d of DIALS) {
      const s = d.shift;
      assert.equal(s.odds.up + s.odds.side + s.odds.down, 100, d.id);
      assert.equal(s.steadied.up + s.steadied.side + s.steadied.down, 100, d.id);
      assert.deepEqual(s.steadied, { up: s.odds.up, side: s.odds.side + TUNING.STEADY_POINTS, down: s.odds.down - TUNING.STEADY_POINTS }, d.id);
      assert.deepEqual(s.odds, TUNING.CARD_ODDS[d.id]);
      assert.equal(s.bondCap, TUNING.BOND_CAP[d.id]);
      assert.equal(s.bondStep, TUNING.BOND_STEP);
      assert.equal(s.statFloor, TUNING.STAT_FLOOR[d.id]);
      const a = TUNING.anchorRules[d.id];
      assert.deepEqual([s.anchors.start, s.anchors.refillTo, s.anchors.perBadge, s.anchors.buyable], [a.start, a.refillTo, a.perBadge, a.buyable]);
      assert.equal(d.rules.captureDisplay, TUNING.CAPTURE_DISPLAY[d.id]);
      assert.equal(d.rules.readCostsTurn, !s.readFree);
      assert.equal(s.unseenForms === 'silhouette', TUNING.SILHOUETTE_DIALS.includes(d.id));
      assert.equal(s.starTouched, TUNING.STAR_CHANCE);
    }
    const [drift, flux, freefall] = DIALS.map((d) => d.shift);
    assert.deepEqual([drift.odds, flux.odds, freefall.odds].map((o) => [o.up, o.side, o.down]), [[50, 40, 10], [40, 35, 25], [30, 30, 40]]);
    assert.deepEqual([drift.steadied, flux.steadied, freefall.steadied].map((o) => [o.up, o.side, o.down]), [[50, 45, 5], [40, 40, 20], [30, 35, 35]]);
    assert.deepEqual([drift.bondCap, flux.bondCap, freefall.bondCap], [5, 15, 10]);
    assert.deepEqual([drift.poolWeights, flux.poolWeights, freefall.poolWeights], ['source', 'source', 'flat']);
    assert.deepEqual([drift.summitBellHolds, flux.summitBellHolds, freefall.summitBellHolds], [true, true, false]);
    assert.equal(freefall.discConfirmAbove, TUNING.freefallDiscConfirmAbove);
    assert.equal(DEFAULT_DIAL, 'flux');
  });

  test('challenges: No Rewind and One Heart ship; Ride the Dice and Blind Read are optional', () => {
    assert.deepEqual(CHALLENGES.filter((c) => !c.optional).map((c) => c.id), ['no-rewind', 'one-heart']);
    assert.deepEqual(CHALLENGES.filter((c) => c.optional).map((c) => c.id), [...M.MANIFEST.challenges.optional]);
    assert.ok(TUNING.ANCHOR_DISABLED_CHALLENGES.includes('ride-the-dice'));
    assert.equal(CHALLENGES.find((c) => c.id === 'ride-the-dice').rules.anchorDisabled, true);
  });

  test('TOGGLE_ORDER is append-only, fits the seed code and round-trips', () => {
    // Append-only snapshot: new names may only be added at the end.
    assert.deepEqual(TOGGLE_ORDER.slice(0, 4), ['no-rewind', 'one-heart', 'ride-the-dice', 'blind-read']);
    assert.ok(TOGGLE_ORDER.length <= 8 && new Set(TOGGLE_ORDER).size === TOGGLE_ORDER.length);
    for (const t of TOGGLE_ORDER) assert.ok(M.CHALLENGE_IDS.includes(t));
    setSeedToggles(TOGGLE_ORDER);
    try {
      const code = encodeSeedCode({ dial: 'FLUX', seed: 12345, toggles: ['one-heart', 'no-rewind'] });
      const back = decodeSeedCode(code);
      assert.deepEqual([...back.toggles].sort(), ['no-rewind', 'one-heart']);
    } finally {
      setSeedToggles([]);
    }
  });
});

describe('shops', () => {

  test('someone is always buying, at every minute of the day', () => {
    for (let m = 0; m < 1440; m++) {
      const buyers = SHOPS.filter((s) => s.buysAll === true && withinHours(s.hours, m));
      assert.ok(buyers.length >= 1, `nobody buying at minute ${m}`);
    }
  });

  test('hours match GDD-00 §5', () => {
    const h = (id) => SHOP.get(id).hours.map((m) => m / 60);
    assert.deepEqual(h('pells-sundries'), [8, 22]);
    assert.deepEqual(h('ludo-eave'), [22, 8]);
    assert.deepEqual(h('carnival-raft'), [12, 2]);
    assert.equal(SHOP.get('carnival-raft').fromDay, 3);
    assert.deepEqual(h('the-anchorage'), [7, 19]);
    assert.deepEqual(h('lantern-market'), [20, 2]);
    assert.equal(SHOP.get('lantern-market').fromDay, 7);
    assert.deepEqual(h('archive-desk'), [9, 19]);
  });

  test('Pell\'s: staples never rotate, two discs a day, the chip disc by badge 1, Crackdust always, Wanted Today', () => {
    const p = SHOP.get('pells-sundries');
    const staples = p.stock.filter((s) => !s.rotate).map((s) => s.item);
    for (const id of ['tallow-wick', 'brass-wick', 'salve', 'tonic', 'full-salve', 'revive', 'poultice', 'warm-shawl', 'crackdust']) assert.ok(staples.includes(id), id);
    assert.deepEqual(p.stock.find((s) => s.item === 'skyglass-wick').cond, { badge: 2 });
    assert.deepEqual(p.stock.find((s) => s.item === 'ether').cond, { badge: 3 });
    assert.deepEqual(p.stock.find((s) => s.item === 'disc-spore-drift' && !s.rotate).cond, { badge: 1 });
    assert.ok(!p.stock.find((s) => s.item === 'crackdust').cond, 'Crackdust before every mandatory Ward');
    assert.equal(p.rotations.discs, TUNING.rotatePickDefault);
    assert.equal(p.rotations.coverage, 1);
    for (const s of p.stock.filter((x) => x.rotate === 'coverage')) assert.deepEqual(s.cond, { badge: 4 });
    assert.equal(p.wanted, true);
    assert.ok(p.wantedPool.length >= TUNING.wantedTodayCount);
    assert.equal(p.buysAll, true);
  });

  test('Starsalt: 800, 3 a day, at the Raft, Ludo and the market only; stones not sold on Freefall', () => {
    const sellers = SHOPS.filter((s) => s.stock.some((x) => x.item === 'starsalt'));
    assert.deepEqual(sellers.map((s) => s.id).sort(), ['carnival-raft', 'lantern-market', 'ludo-eave']);
    for (const s of sellers) assert.equal(s.stock.find((x) => x.item === 'starsalt').qty, TUNING.starsaltDailyCap);
    for (const s of SHOPS) for (const x of s.stock.filter((y) => y.item === 'anchor-stone')) assert.deepEqual(x.cond, { dial: ['drift', 'flux'] }, s.id);
    assert.deepEqual(SHOPS.filter((s) => s.stock.some((x) => x.item === 'anchor-stone')).map((s) => s.id).sort(), ['cairnhold-clinic', 'pells-sundries', 'the-anchorage']);
    assert.ok(SHOP.get('the-anchorage').stock.some((x) => x.item === 'still-knot'));
    assert.ok(SHOP.get('cairnhold-clinic').stock.some((x) => x.item === 'crackdust'));
  });

  test('Dov\'s auction guarantees Stand Firm and never charges more than the shelf price', () => {
    const a = SHOP.get('lantern-market').auction;
    assert.equal(a.festivalDay, 7);
    assert.ok(a.lots.some((l) => l.pool.length === 1 && l.pool[0] === 'disc-stand-firm'));
    assert.equal(a.maxBidIsShelfPrice, true);
    for (const l of a.lots) for (const d of l.pool) assert.ok(a.openingBid < ITEM.get(d).price);
  });

  test('the Raft refines skyglass 1:1; Barnaby pays 900; the Crate pays 90%', () => {
    assert.equal(SHOP.get('carnival-raft').refine.rate, TUNING.relicStarsaltRate);
    assert.equal(SHOP.get('archive-desk').skyglassPrice, TUNING.relicBarnabyPrice);
    assert.equal(SHOP.get('consignment-crate').crate.rate, TUNING.crateRate);
    assert.equal(SHOP.get('archive-desk').services.recall.starsalt, TUNING.recallStarsalt);
  });
});

describe('tuning: every system key, accepted by every system', () => {
  const R = '../js/';
  const MODULES = {
    'systems/bag': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/capture': (m) => m.tuningOf(TUNING),
    'systems/clockSys': (m) => m.tuningOf(TUNING),
    'systems/creature': (m) => m.tuningOf(TUNING),
    'systems/dayPage': (m) => m.tuningOf(null, { tuning: TUNING }),
    'systems/encounter': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/exp': (m) => m.tuningOf(TUNING),
    'systems/fieldLog': (m) => m.tuningOf(TUNING),
    'systems/fishing': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/forecast': (m) => m.tuningOf(TUNING),
    'systems/gather': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/letters': (m) => m.tuningOf(null, { tuning: TUNING }),
    'systems/loans': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/memory': (m) => m.tuningOf(null, { tuning: TUNING }),
    'systems/party': (m) => m.tuningOf(TUNING),
    'systems/schedule': (m) => m.tuningOf(null, { tuning: TUNING }),
    'systems/shops': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/threads': (m) => m.tuningOf(null, { tuning: TUNING }),
    'systems/wallet': (m) => m.tuningOf({ tuning: TUNING }),
    'systems/weather': (m) => m.tuningOf(TUNING),
  };

  for (const [path, resolve] of Object.entries(MODULES)) {
    test(`${path}: every DEFAULTS key is in TUNING and resolves to the TUNING value`, async () => {
      const mod = await import(`${R}${path}.js`);
      const t = resolve(mod);
      for (const k of Object.keys(mod.DEFAULTS)) {
        assert.ok(Object.prototype.hasOwnProperty.call(TUNING, k), `${path}: TUNING lacks '${k}'`);
        assert.deepEqual(t[k], TUNING[k], `${path}: ${k}`);
      }
    });
  }

  test('battle engine: every DEFAULTS key is in TUNING and mergeTuning accepts the engine slice', async () => {
    const engine = await import(`${R}battle/engine.js`);
    const { mergeTuning } = await import(`${R}battle/effects.js`);
    const ai = await import(`${R}battle/ai.js`);
    const slice = {};
    for (const k of Object.keys(engine.DEFAULTS)) {
      assert.ok(k in TUNING, `TUNING lacks engine key '${k}'`);
      slice[k] = TUNING[k];
    }
    const t = mergeTuning(engine.DEFAULTS, slice, 'economy-test');
    assert.equal(t.payoutPerLevel, 50);
    assert.equal(t.expYieldDivisor, 5);
    assert.equal(t.blackoutCap, TUNING.blackoutCap);
    for (const k of Object.keys(ai.DEFAULTS)) assert.ok(k in TUNING, `TUNING lacks ai key '${k}'`);
  });

  test('world feel tables carry every npc and roamer key', async () => {
    const { NPC_DEFAULTS } = await import(`${R}world/npc.js`);
    const { ROAMER_DEFAULTS } = await import(`${R}world/roamer.js`);
    for (const k of Object.keys(NPC_DEFAULTS)) assert.ok(k in TUNING.npcFeel, `npcFeel lacks ${k}`);
    for (const k of Object.keys(ROAMER_DEFAULTS)) assert.ok(k in TUNING.roamerFeel, `roamerFeel lacks ${k}`);
    assert.equal(TUNING.npcFeel.catchUpTiles, TUNING.npcCatchUpTiles);
  });

  test('frozen deep, default export and named exports mirror TUNING', () => {
    assert.equal(TUNING_DEFAULT, TUNING);
    assert.ok(Object.isFrozen(TUNING) && Object.isFrozen(TUNING.CARD_ODDS.flux) && Object.isFrozen(TUNING.dailyIncomeTargets[0]));
    for (const k of ['wardCount', 'benchShare', 'noRepeatDays', 'porchWindow', 'letterHour', 'npcCatchUpTiles', 'toolRingHoldMs', 'routeAutosaveMs', 'animatedTileCap', 'encounterMinLevel', 'encounterMaxLevel', 'stackMax']) {
      assert.deepEqual(tuningMod[k], TUNING[k], k);
    }
  });
});

describe('tuning: GDD-00 numbers', () => {
  test('clock and tide: the day-1 seed is a low at 16:40', () => {
    assert.equal(TUNING.TIDE_DAY1_LOW, 16 * 60 + 40);
    assert.equal(TUNING.TIDE_DAY1_LOW, DAY1_LOW_MINUTE);
    assert.equal(TUNING.TIDE_DAY1_LOW + TUNING.TIDE_WINDOWS.mainland, 17 * 60 + 40, 'the causeway shuts at 17:40 behind you');
    assert.deepEqual(TUNING.TIDE_WINDOWS, { causeway: 150, stones: 120, flats: 90, bar: 90, spur: 90, mainland: 60 });
    assert.equal(TUNING.CLOCK_DEFAULT_MINUTES_PER_DAY, 24);
    assert.deepEqual([TUNING.CLOCK_NIGHT_START, TUNING.CLOCK_NIGHT_END], [1080, 360]);
    assert.equal(TUNING.CLOCK_DAY1_WEEKDAY, 6, 'day 1 is a Sunday');
    assert.deepEqual([TUNING.TIDE_SPRING_FIRST_DAY, TUNING.TIDE_SPRING_EVERY_DAYS], [7, 7]);
    assert.deepEqual([TUNING.REST_NAP_FROM, TUNING.REST_SLEEP_FROM, TUNING.REST_LIE_MINUTES], [720, 1260, 10]);
    assert.deepEqual([...TUNING.porchWindow], [19 * 60, 60]);
  });

  test('EXP: 8 × L² through Lv8 (a cubic above, MID-06), KO EXP ÷ 5, and night one takes a Lv5 starter past Lv7', () => {
    const c = TUNING.GROWTH_CURVES['medium-fast'];
    const expAt = (L) => {
      let seg = c;
      for (const st of c.steps ?? []) if (L >= st.from) seg = st;
      return Math.floor((seg.num[0] * L ** 3 + seg.num[1] * L ** 2 + seg.num[2] * L + seg.num[3]) / seg.den);
    };
    assert.deepEqual([5, 7, 8].map(expAt), [200, 392, 512]);
    for (let L = 2; L <= 8; L++) assert.equal(expAt(L), 8 * L * L, `8 × L² at Lv${L}`);
    assert.equal(expAt(9), Math.floor((3 * 729 - 512) / 2), 'the cubic joins at 512 and takes over from Lv9');
    for (let L = 9; L <= 100; L++) assert.ok(expAt(L) - expAt(L - 1) >= expAt(L - 1) - expAt(L - 2), `a level never costs less than the one before (Lv${L})`);
    for (const g of Object.values(TUNING.GROWTH_CURVES)) assert.deepEqual(g, c);
    assert.ok(200 + 100 + 40 + 66 > 392, 'Linnet + the Tossup catch + Pip\'s Wirewhisk');
    assert.deepEqual([...TUNING.WINDOW_LEVELS], [8, 20, 34]);
    assert.equal(TUNING.EXP_DIVISOR, TUNING.expYieldDivisor);
    assert.equal(TUNING.BENCH_SHARE, TUNING.benchShare);
  });

  test('capture, reroll, blackout, shares, Glint', () => {
    assert.deepEqual([TUNING.CAPTURE_ODDS_MIN, TUNING.CAPTURE_ODDS_MAX], [0.01, 0.95]);
    assert.deepEqual([TUNING.captureOddsMin, TUNING.captureOddsMax], [0.01, 0.95]);
    assert.deepEqual(TUNING.CAPTURE_BANDS.map((b) => b[1]), ['Slim', 'Fair', 'Good', 'Sure']);
    assert.deepEqual(TUNING.captureBands, TUNING.CAPTURE_BANDS);
    assert.deepEqual([TUNING.CAPTURE_FAIL_BONUS, TUNING.CAPTURE_FAIL_CAP], [0.03, 0.15]);
    const reroll = (n) => TUNING.REROLL_BASE * TUNING.REROLL_GROWTH ** n;
    assert.deepEqual([0, 1, 2, 3].map(reroll), [1, 2, 4, 8]);
    const blackout = (held) => (held < TUNING.blackoutFloor ? 0 : Math.min(TUNING.blackoutCap, Math.floor(held * TUNING.blackoutCostFraction)));
    assert.deepEqual([400, 5000, 40000].map(blackout), [0, 500, 1500]);
    assert.equal(TUNING.spireShareFraction, 0.1);
    assert.equal(TUNING.residentShareFraction, 0.05);
    assert.equal(TUNING.glintBase + TUNING.glintPerDay * 2, 620, 'the night-one Glint (day 2 at 03:40) is 620');
    assert.deepEqual(TUNING.spireAceLevels.map((a) => a * TUNING.spireWinPerAce), [2000, 3200, 4400, 5800, 7200, 8600]);
    assert.equal(TUNING.wardCount, 3);
  });
});

describe('economy sim (average-day model)', () => {
  /**
   * One deterministic pass over the GDD-00 §7 model: daily gross from `dailyIncomeTargets`, a quarter
   * to sinks from day 2, errands on night one, a Spire share per badge, a resident share per finished
   * lead thread, everything else paid at the yard each evening; one build lands per night at 05:40 and
   * the Relighting fires at the dusk of the day the Lamp Room lands.
   */
  const BADGE_DAYS = [3, 5, 7, 10, 11, 13];
  const THREAD_DAYS = [8, 9, 10, 11, 12, 13];
  const grossOn = (d) => (TUNING.dailyIncomeTargets.find((r) => d >= r.from && d <= r.to) ?? TUNING.dailyIncomeTargets.at(-1)).gross;

  function run() {
    let tier = 1; let paid = 0; let wallet = 0; let relight = null; let shares = 0;
    const queue = []; const cleared = {}; const shortAtTarget = {};
    for (let d = 1; d <= 40 && relight === null; d++) {
      if (queue.length) { const b = queue.shift(); if (b === LOANS.length) relight = d; }
      const g = grossOn(d);
      wallet += d === 1 ? g : Math.round(g * (1 - TUNING.sinkShare));
      const open = () => (tier <= LOANS.length ? LOANS[tier - 1].amount : 0);
      if (d === 1) paid += TUNING.errandCredit * TUNING.errandCount;
      if (BADGE_DAYS.includes(d) && tier <= LOANS.length) { const s = Math.round(open() * TUNING.spireShareFraction); paid += s; shares += s; }
      if (THREAD_DAYS.includes(d) && tier <= LOANS.length) paid += Math.round(open() * TUNING.residentShareFraction);
      while (tier <= LOANS.length) {
        const need = open() - paid;
        if (need <= 0) { cleared[tier] = d; queue.push(tier); paid = -need; tier++; continue; }
        const pay = Math.min(wallet, need); wallet -= pay; paid += pay;
        if (paid < open()) break;
      }
      for (const l of LOANS) if (l.targetDay === d && !(l.tier in cleared)) {
        shortAtTarget[l.tier] = l.tier === tier ? l.amount - paid : l.amount;
      }
    }
    return { relight, cleared, shortAtTarget, shares };
  }

  test('the Relighting lands on day 11-16 and never before the seven-night floor', () => {
    const { relight, cleared } = run();
    assert.ok(relight >= TUNING.relightingDayRange[0] && relight <= TUNING.relightingDayRange[1], `Relighting on day ${relight}`);
    assert.ok(relight > TUNING.hardFloorNights);
    assert.equal(cleared[1], 1, 'loan 1 is paid on night one');
    for (const l of LOANS) assert.ok(cleared[l.tier] - l.targetDay <= 1, `loan ${l.tier} within a day of its target`);
  });

  test('no tier needs more than 30 real minutes of grind to land on its target day', () => {
    const { shortAtTarget } = run();
    for (const [tier, short] of Object.entries(shortAtTarget)) {
      const d = LOANS[tier - 1].targetDay;
      const perRealMinute = (grossOn(d) * (1 - TUNING.sinkShare)) / TUNING.CLOCK_DEFAULT_MINUTES_PER_DAY;
      const minutes = short / perRealMinute;
      assert.ok(minutes <= TUNING.grindCapRealMinutes, `loan ${tier}: ${minutes.toFixed(1)} real minutes short on day ${d}`);
    }
  });

  test('cumulative gross by day 14 is about 335,000 and Spire shares about 27,000', () => {
    let sum = 0;
    for (let d = 1; d <= 14; d++) sum += grossOn(d) + (d === 1 ? 3000 : 0);
    assert.ok(Math.abs(sum - 335000) <= 15000, `gross by day 14: ${sum}`);
    const { shares } = run();
    assert.ok(shares >= 15000 && shares <= 30000, `Spire shares: ${shares}`);
  });
});

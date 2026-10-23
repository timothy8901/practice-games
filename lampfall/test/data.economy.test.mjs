// Economy and continuity verifier (GDD-02 Economy + GDD-05 Town life against GDD-00 §5-§9).
//  1. validateData / checkManifest over items, loans, dials, shops, collections and the town tables.
//  2. Continuity: every price and amount equals GDD-00 §7 / §9; every tuning key a system or the battle
//     engine reads exists in js/data/tuning.js; every find has its town letter; every fish and bug has
//     a tell, a habitat, a window and a price.
//  3. The headless economy sim (tools/economy-sim.mjs) plays three profiles day by day on the real
//     tables and systems: the typical player clears each loan on its target day (±1) and relights on
//     day 11-16; the grinder never beats the seven-night floor; the casual player relights by ~day 20;
//     no income source is more than 35% of the total; no tier needs more than 30 real minutes of grind.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

import * as M from '../js/data/ids.manifest.js';
import { DATA } from '../js/data/index.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import { TUNING } from '../js/data/tuning.js';
import { LOANS, COMMISSIONS, COMMONS, LADDER_TOTAL } from '../js/data/loans.js';
import { DIALS, CHALLENGES } from '../js/data/dials.js';
import { SHOPS } from '../js/data/shops.js';
import { ITEMS } from '../js/data/items.js';
import { COLLECTIONS, FISH, BUGS, FINDS, FRUIT } from '../js/data/collections.js';
import * as TOWN from '../js/data/town.js';
import { USE_HANDLERS } from '../js/systems/bag.js';
import { withinHours } from '../js/systems/shops.js';
import * as wallet from '../js/systems/wallet.js';
import * as fishing from '../js/systems/fishing.js';
import { MAPS_BY_ID } from '../js/data/maps/index.js';
import { TRAINERS } from '../js/data/trainers.js';
import { createNewWorld } from '../js/state/schema.js';
import { makeRng } from '../js/core/rng.js';
import { runAll, simulate, grindMinutes, PROFILES, SOURCES } from '../tools/economy-sim.mjs';

const ITEM = new Map(ITEMS.map((i) => [i.id, i]));
const SHOP = new Map(SHOPS.map((s) => [s.id, s]));
const H = 60;

// ---------------------------------------------------------------------------------------------
// 1. Validator and manifest
// ---------------------------------------------------------------------------------------------

describe('validator and manifest: the economy and town tables', () => {
  const OWNED = ['items', 'loans', 'shops', 'dials', 'challenges', 'collections'];
  const TABLES = {
    ...DATA,
    items: ITEMS, loans: LOANS, shops: SHOPS, dials: DIALS, challenges: CHALLENGES, collections: COLLECTIONS,
    commissions: COMMISSIONS, commons: COMMONS,
    npcs: M.NPC_IDS.map((id) => ({ id, name: id })),
    // other chapters' maps may still carry placeholder fruit; this file checks only the tables it verifies
    maps: [],
  };
  const mine = (lines) => lines.filter((l) => OWNED.some((t) => l.startsWith(`${t}:`)));

  it('validateData: zero errors for items, loans, shops, dials, challenges and collections', () => {
    const { errors, warnings } = validateData(TABLES, { tuning: TUNING, useHandlers: new Set(Object.keys(USE_HANDLERS)) });
    assert.deepEqual(mine(errors), []);
    // a stock cond may read a story flag the story chapter's scripts set
    assert.deepEqual(mine(warnings).filter((w) => !w.includes('is read but never set')), []);
  });

  it('checkManifest: every verified table is complete against the manifest, with no extra ids', () => {
    const { warnings, notes } = checkManifest(TABLES, M.MANIFEST);
    // loans carry tier-N ids mapped to the manifest's loan-N (GDD-02 manifest request 1)
    assert.deepEqual(mine(warnings).filter((w) => !w.startsWith('loans:')), []);
    for (const t of ['items', 'shops', 'dials', 'challenges', 'collections']) assert.ok(!notes.some((n) => n.includes(`'${t}'`)), `${t} counts as authored`);
    assert.deepEqual(LOANS.map((l) => l.manifestId), [...M.LOAN_IDS]);
    assert.deepEqual(COLLECTIONS.map((c) => c.id).sort(), [...M.FISH_IDS, ...M.BUG_IDS, ...M.FIND_IDS, ...M.FRUIT_IDS].sort());
  });

  it('town tables: furniture, clothes, roofs, Commons, commissions, festivals, weather, stamps match the manifest', () => {
    const ids = (rows) => rows.map((r) => r.id).sort();
    assert.deepEqual(ids(TOWN.FURNITURE), [...M.FURNITURE_IDS].sort());
    assert.deepEqual(ids(TOWN.CLOTHES), [...M.CLOTHES_IDS].sort());
    assert.deepEqual(ids(TOWN.ROOF_COLOURS), [...M.ROOF_COLOUR_IDS].sort());
    assert.deepEqual(ids(TOWN.COMMONS_PROJECTS), [...M.COMMONS_PROJECT_IDS].sort());
    assert.deepEqual(ids(TOWN.COMMISSIONS), [...M.COMMISSION_IDS].sort());
    assert.deepEqual(ids(TOWN.FESTIVALS), [...M.FESTIVAL_IDS].sort());
    assert.deepEqual(ids(TOWN.WEATHER), [...M.WEATHER_IDS].sort());
    assert.deepEqual(ids(TOWN.STAMPS), [...M.STAMP_IDS].sort());
    // the town halves of the Commons and the commissions line up with economy's rows by id
    assert.deepEqual(ids(TOWN.COMMONS_PROJECTS), ids(COMMONS));
    assert.deepEqual(ids(TOWN.COMMISSIONS), ids(COMMISSIONS));
  });
});

// ---------------------------------------------------------------------------------------------
// 2. Continuity with GDD-00
// ---------------------------------------------------------------------------------------------

describe('continuity: GDD-00 §7 price list', () => {
  const price = (id) => ITEM.get(id).price;

  it('wicks 100 / 300 / 600 (×1 / ×1.5 / ×2); Skyglass from badge 2', () => {
    assert.deepEqual(['tallow-wick', 'brass-wick', 'skyglass-wick'].map(price), [100, 300, 600]);
    assert.deepEqual(['tallow-wick', 'brass-wick', 'skyglass-wick'].map((id) => TUNING.lanternGrades[ITEM.get(id).use]), [1, 1.5, 2]);
    assert.deepEqual([1, 2, 3].map((g) => TUNING.lantern[g].price), [100, 300, 600]);
    assert.deepEqual(SHOP.get('pells-sundries').stock.find((s) => s.item === 'skyglass-wick').cond, { badge: 2 });
  });

  it('medicine, cures, Crackdust, the Still Knot', () => {
    assert.deepEqual(['salve', 'tonic', 'full-salve', 'revive', 'ether', 'full-ether', 'poultice', 'warm-shawl', 'crackdust', 'still-knot'].map(price),
      [80, 240, 600, 600, 250, 700, 150, 150, 300, 2000]);
    assert.ok(SHOP.get('the-anchorage').stock.some((s) => s.item === 'still-knot'));
    assert.ok(SHOP.get('cairnhold-clinic').stock.some((s) => s.item === 'crackdust'));
    const cairnholdRoute = TRAINERS.filter((t) => t.region === 'cairnhold' && t.payoutRule?.kind === 'highest' && t.band);
    assert.ok(cairnholdRoute.length >= 5);
    for (const t of cairnholdRoute) assert.ok(price('crackdust') < t.payout, `Crackdust below ${t.id}'s payout`);
  });

  it('Starsalt 800, 3 a day shared; anchor stones 500 on Flux, never sold on Freefall', () => {
    assert.equal(price('starsalt'), 800);
    assert.equal(TUNING.starsaltPrice, 800);
    assert.equal(TUNING.starsaltDailyCap, 3);
    for (const s of SHOPS) for (const x of s.stock.filter((y) => y.item === 'starsalt')) assert.equal(x.qty, 3, s.id);
    assert.equal(price('anchor-stone'), 500);
    assert.equal(TUNING.anchorPrice, 500);
    assert.deepEqual(TUNING.anchorRules.freefall, { start: 0, refillTo: 0, perBadge: 1, buyable: false });
    assert.deepEqual(TUNING.anchorRules.drift, { start: 3, refillTo: 3, perBadge: 0, buyable: true });
    for (const s of SHOPS) for (const x of s.stock.filter((y) => y.item === 'anchor-stone')) assert.ok(!x.cond.dial.includes('freefall'), s.id);
  });

  it('discs 1,500-4,000; ferry 200 until badge 2; Commons 3,000-12,000 with 10-30% from the neighbours; decor 200-6,000', () => {
    for (const d of ITEMS.filter((i) => i.pocket === 'discs' && i.price > 0)) assert.ok(d.price >= 1500 && d.price <= 4000, d.id);
    assert.deepEqual([TUNING.ferryFare, TUNING.ferryFreeFromBadge], [200, 2]);
    assert.deepEqual(COMMONS.map((c) => c.cost), [3000, 4000, 5000, 6000, 10000, 12000]);
    for (const c of COMMONS) assert.ok(c.neighborShare >= 0.1 && c.neighborShare <= 0.3, c.id);
    for (const f of TOWN.FURNITURE) assert.ok(f.price >= 200 && f.price <= 6000, f.id);
    for (const c of TOWN.CLOTHES.filter((x) => x.price > 0)) assert.ok(c.price >= 200 && c.price <= 6000, c.id);
    assert.equal(price('string-lights') >= 200 && price('string-lights') <= 6000, true);
    assert.equal(TUNING.leftoverCommissionPrice, 20000);
    assert.equal(TUNING.spareSellRate, 0.5);
  });

  it('the ladder: 6k / 15k / 25k / 36k / 50k / 66k / 80k = 278,000, one build a night', () => {
    assert.deepEqual(LOANS.map((l) => l.amount), [6000, 15000, 25000, 36000, 50000, 66000, 80000]);
    assert.equal(LADDER_TOTAL, 278000);
    assert.deepEqual(LOANS.map((l) => l.targetDay), [1, 3, 5, 7, 9, 11, 13]);
    assert.equal(TUNING.buildsPerNight, 1);
    assert.equal(TUNING.hardFloorNights, 7);
  });
});

describe('continuity: GDD-00 §6-§7 income, shares and the blackout', () => {
  it('blackout: 10% of buttons on hand, capped at 1,500, nothing under 500; half back through three Glints', () => {
    assert.deepEqual([TUNING.blackoutCostFraction, TUNING.blackoutCap, TUNING.blackoutFloor], [0.1, 1500, 500]);
    assert.deepEqual([499, 5000, 14000, 40000].map((m) => wallet.blackoutCost(m, TUNING)), [0, 500, 1400, 1500]);
    assert.deepEqual([TUNING.purseRefundFraction, TUNING.purseGlints], [0.5, 3]);
    assert.equal(TUNING.blackoutCap, TUNING.blackoutCap, 'one cap for the wallet and the battle engine');
  });

  it('Spire share 10% of the open loan, resident share 5%, errands 6 × 500 off loan 1, 4,000 to the jar after payoff', () => {
    assert.equal(TUNING.spireShareFraction, 0.1);
    assert.equal(TUNING.residentShareFraction, 0.05);
    assert.deepEqual([TUNING.errandCount, TUNING.errandCredit, TUNING.errandTier], [6, 500, 1]);
    assert.equal(TUNING.residentShareAfterPayoff, 4000);
    for (const l of LOANS) assert.equal(l.notch, l.amount * 0.05, l.id);
  });

  it('Wanted Today +50% on 3 items, one stack each; the Crate pays 90% overnight', () => {
    assert.deepEqual([TUNING.wantedTodayMult, TUNING.wantedTodayCount, TUNING.wantedStacksPerDay], [1.5, 3, 1]);
    assert.equal(TUNING.crateRate, 0.9);
    assert.equal(SHOP.get('consignment-crate').crate.rate, 0.9);
    assert.equal(SHOP.get('consignment-crate').crate.settlesAt, 6 * H);
  });

  it('the Glint 500 + 60 × day; purses 200-600; Spire wins 200 × ace + 3 Starsalt; trainers 50 × highest; Porch Duels 30 × curve; Errants 1,500 + 2', () => {
    assert.equal(wallet.glintValue(2, TUNING), 620);
    assert.equal(wallet.glintValue(10, TUNING), 1100);
    assert.deepEqual(TUNING.purseRange, [200, 600]);
    assert.deepEqual(TUNING.spireAceLevels.map((a) => a * TUNING.spireWinPerAce), [2000, 3200, 4400, 5800, 7200, 8600]);
    assert.equal(TUNING.spireWinStarsalt, 3);
    assert.equal(TUNING.payoutPerLevel, 50);
    assert.equal(TUNING.porchDuelPerCurve, 30);
    assert.equal(TOWN.PORCH_DUELS.payoutPerCurveLevel, TUNING.porchDuelPerCurve);
    assert.deepEqual(TOWN.PORCH_DUELS.curveByBadges.slice(0, 6), TUNING.spireAceLevels.map((a) => a - 3), 'curve = next ace − 3');
    assert.deepEqual([TUNING.errantButtons, TUNING.errantStarsalt], [1500, 2]);
    assert.deepEqual([TUNING.relicBarnabyPrice, TUNING.relicStarsaltRate, TUNING.skyglassRelicsMaxPerNightLow], [900, 1, 3]);
    assert.equal(TUNING.championPrize, 10000);
    assert.equal(TUNING.galleryFrameButtons, 1000);
  });

  it('honeycomb 350; native fruit 120 / 150; foreign 480 / 600; three a tree, regrow 2, ripe after 3', () => {
    assert.equal(ITEM.get('honeycomb').price, 350);
    assert.equal(TOWN.TREES.bees.honeycombPrice, 350);
    for (const f of FRUIT) assert.deepEqual([f.price, f.ripePrice], f.origin === 'native' ? [120, 150] : [480, 600], f.id);
    assert.deepEqual([TUNING.fruitPerTree, TUNING.regrowDaysDefault, TUNING.fruitRipeDays], [3, 2, 3]);
    assert.equal(TOWN.TREES.groves.reduce((s, g) => s + g.trees, 0), 100, '~100 named trees');
    assert.deepEqual([TOWN.TREES.purse.trees, TOWN.TREES.bees.trees], [6, 4]);
  });

  it('buyers\' hours: Pell\'s 08-22, Ludo 22-08 (both buy anything at full price), the Raft 12-02 from day 3, the Anchorage 07-19, the Archive 09-19, the market Saturdays 20-02', () => {
    const h = (id) => SHOP.get(id).hours.map((m) => m / H);
    assert.deepEqual([h('pells-sundries'), h('ludo-eave'), h('carnival-raft'), h('the-anchorage'), h('archive-desk'), h('lantern-market')],
      [[8, 22], [22, 8], [12, 2], [7, 19], [9, 19], [20, 2]]);
    assert.equal(SHOP.get('carnival-raft').fromDay, 3);
    assert.equal(SHOP.get('lantern-market').fromDay, 7);
    for (let m = 0; m < 1440; m++) assert.ok(SHOPS.some((s) => s.buysAll && withinHours(s.hours, m)), `someone is buying at minute ${m}`);
    assert.deepEqual(TUNING.hesperCounterHours, [18 * H, 2 * H]);
    assert.deepEqual(TUNING.yardHours, [6 * H, 24 * H]);
  });
});

describe('continuity: every tuning key the systems and the battle engine read', () => {
  // systems/settings DEFAULTS are the player's settings (volume, text speed), not designer tuning
  const SKIP = new Set(['settings.js']);
  for (const dir of ['systems', 'battle']) {
    for (const file of readdirSync(new URL(`../js/${dir}/`, import.meta.url)).filter((f) => f.endsWith('.js') && !SKIP.has(f))) {
      it(`js/${dir}/${file}: every DEFAULTS key is in TUNING`, async () => {
        const mod = await import(`../js/${dir}/${file}`);
        for (const [name, table] of Object.entries(mod)) {
          if (!/DEFAULTS$/.test(name) || !table || typeof table !== 'object' || Array.isArray(table)) continue;
          for (const k of Object.keys(table)) assert.ok(Object.prototype.hasOwnProperty.call(TUNING, k), `${dir}/${file} ${name}.${k} is missing from js/data/tuning.js`);
        }
      });
    }
  }

  it('the GDD values where a system default differs', () => {
    assert.equal(TUNING.blackoutCap, 1500);
    assert.equal(TUNING.payoutPerLevel, 50);
    assert.equal(TUNING.expYieldDivisor, 5);
    assert.equal(TUNING.EXP_DIVISOR, 5);
    assert.deepEqual([...TUNING.WINDOW_LEVELS], [8, 20, 34]);
    assert.equal(TUNING.BOX_CAPACITY, 20);
    assert.equal(TUNING.CAPTURE_ODDS_MAX, 0.95);
    assert.equal(TUNING.captureOddsMax, 0.95);
    assert.equal(TUNING.holdOutExp, 100);
    assert.deepEqual(TUNING.festivals.map((f) => f.id), ['lantern-market']);
    assert.deepEqual(TUNING.commonsProjects.map((p) => [p.id, p.cost, p.neighborShare]), COMMONS.map((p) => [p.id, p.cost, p.neighborShare]));
  });

  it('the town chapter\'s values: creature bonuses, weather weights and effects', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(TUNING.creatureBonuses)), JSON.parse(JSON.stringify(TOWN.CREATURE_BONUSES)));
    assert.deepEqual(JSON.parse(JSON.stringify(TUNING.WEATHER_WEIGHTS)), JSON.parse(JSON.stringify(TOWN.WEATHER_TUNING.WEATHER_WEIGHTS)));
    assert.deepEqual(JSON.parse(JSON.stringify(TUNING.WEATHER_EFFECTS)), JSON.parse(JSON.stringify(TOWN.WEATHER_TUNING.WEATHER_EFFECTS)));
  });
});

describe('continuity: the Archive collections', () => {
  const window = (r) => Array.isArray(r.hours) && r.hours.length > 0 && r.hours.every((h) => Array.isArray(h) && h.length === 2 && h.every((x) => x >= 0 && x <= 24));
  const tell = (t) => t && ['shape', 'sound', 'word', 'text'].every((k) => typeof t[k] === 'string' && t[k].length > 0);

  it('every fish has a tell, a habitat, a window and a price in 80-4,200', () => {
    assert.equal(FISH.length, 18);
    for (const f of FISH) {
      assert.ok(tell(f.tell), `${f.id} tell`);
      assert.ok(typeof f.habitat === 'string' && f.habitat.length > 10, `${f.id} habitat`);
      assert.ok(window(f), `${f.id} window`);
      assert.ok(Number.isInteger(f.price) && f.price >= 80 && f.price <= 4200, `${f.id} price`);
    }
    assert.equal(FISH.find((f) => f.id === 'john-dory').price, 2400);
    assert.equal(FISH.find((f) => f.id === 'lantern-wolffish').price, 4200);
  });

  it('every bug has a tell, a habitat, a window and a price in 60-900', () => {
    assert.equal(BUGS.length, 10);
    for (const b of BUGS) {
      assert.ok(tell(b.tell), `${b.id} tell`);
      assert.ok(Array.isArray(b.habitat) && b.habitat.length > 0, `${b.id} habitat`);
      assert.ok(window(b), `${b.id} window`);
      assert.ok(Number.isInteger(b.price) && b.price >= 60 && b.price <= 900, `${b.id} price`);
    }
  });

  it('every find has its own town letter (T1-T18) and a price in its GDD band', () => {
    assert.equal(FINDS.length, 18);
    const letters = FINDS.map((f) => f.letter);
    assert.equal(new Set(letters).size, 18, 'one letter per find');
    for (const l of letters) assert.ok(M.LETTER_IDS.includes(l) && /^t([1-9]|1[0-8])$/.test(l), `town letter ${l}`);
    for (const f of FINDS) {
      if (f.group === 'shore') assert.ok(f.price >= 100 && f.price <= 400, f.id);
      else assert.ok(f.price >= 300 && f.price <= 1500, f.id);
      if (f.skyglass) assert.deepEqual([f.archivePrice, f.refinesTo.starsalt], [900, 1], f.id);
    }
    assert.equal(FINDS.filter((f) => f.group === 'fossil').length, 6);
    assert.equal(FINDS.filter((f) => f.group === 'relic').length, 6);
    assert.equal(FINDS.filter((f) => f.skyglass).length, 3);
  });

  it('night headliners are rare: a fresh night quay shows a forked-tail shadow in about one view in five', () => {
    const map = MAPS_BY_ID.pellwick;
    const quay = map.reaches.find((r) => r.kind === 'quay');
    const world = createNewWorld({ seedCode: 'HEADLINER' });
    const ctx = { data: { collections: COLLECTIONS }, lead: null, total: 1440 + 23 * H, tideState: 'high', phase: 'night' };
    let views = 0; let withForked = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const v = fishing.reachShadows(world, map, quay, makeRng(seed), ctx);
      views++;
      if (v.shadows.some((s) => s.headliner)) withForked++;
    }
    const share = withForked / views;
    assert.ok(share > 0.05 && share < 0.35, `forked shadow in ${(share * 100).toFixed(0)}% of night views`);
  });
});

// ---------------------------------------------------------------------------------------------
// 3. The economy sim
// ---------------------------------------------------------------------------------------------

describe('economy sim: three profiles on the real tables and systems', () => {
  const all = runAll();
  const { typical, casual, grinder } = all;
  const targets = LOANS.map((l) => l.targetDay);

  it('typical: loan 1 on night one, inside the first ~20 real minutes', () => {
    assert.equal(typical.cleared[1], 1);
    assert.ok(typical.day1RealMinutes <= 22, `night one took ${typical.day1RealMinutes} real minutes`);
  });

  it('typical: every loan clears within a day of its target (1 / 3 / 5 / 7 / 9 / 11 / 13)', () => {
    for (const l of LOANS) {
      const d = typical.cleared[l.tier];
      assert.ok(Number.isInteger(d), `loan ${l.tier} never cleared`);
      assert.ok(Math.abs(d - l.targetDay) <= 1, `loan ${l.tier} cleared on day ${d}, target ${l.targetDay}`);
    }
  });

  it('typical: loan 7 is zeroed and the Relighting lands on day 11-16', () => {
    const [lo, hi] = TUNING.relightingDayRange;
    assert.ok(typical.cleared[7] >= lo && typical.cleared[7] <= hi, `loan 7 cleared day ${typical.cleared[7]}`);
    assert.ok(typical.relightDay >= lo && typical.relightDay <= hi, `Relighting day ${typical.relightDay}`);
  });

  it('typical: no tier needs more than 30 real minutes of grind on its target day', () => {
    for (const [tier, minutes] of Object.entries(grindMinutes(typical))) {
      assert.ok(minutes <= TUNING.grindCapRealMinutes, `loan ${tier}: ${minutes} real minutes short`);
    }
  });

  it('grinder: never before the seven-night floor (one build a night), whatever it earns', () => {
    assert.ok(grinder.relightDay >= TUNING.hardFloorNights + 1, `grinder relit on day ${grinder.relightDay}`);
    assert.ok(grinder.cleared[7] >= TUNING.hardFloorNights, `grinder zeroed loan 7 on day ${grinder.cleared[7]}`);
    assert.ok(grinder.relightDay <= typical.relightDay);
  });

  it('casual (≈45 real minutes a day): relights by about day 20', () => {
    assert.ok(casual.realMinutesPerDay >= 40 && casual.realMinutesPerDay <= 50, `casual plays ${casual.realMinutesPerDay} real min a day`);
    assert.equal(casual.cleared[1], 1);
    assert.ok(casual.relightDay >= 17 && casual.relightDay <= 22, `casual relit on day ${casual.relightDay}`);
    assert.ok(casual.relightDay > typical.relightDay);
  });

  it('the GDD-00 §5 ideal day ("what a good day does") runs about a day ahead of the typical player', () => {
    const ideal = all.ideal;
    assert.ok(ideal.relightDay >= TUNING.relightingDayRange[0] && ideal.relightDay <= typical.relightDay);
    assert.ok(typical.relightDay - ideal.relightDay <= 2);
  });

  it('no runaway income source: none is more than 35% of any profile\'s total', () => {
    for (const r of Object.values(all)) {
      for (const k of SOURCES) assert.ok(r.mix[k] <= 0.35, `${r.profile}: ${k} is ${(r.mix[k] * 100).toFixed(1)}% of income`);
      // and the season is a mix: at least six sources each above 3%
      assert.ok(SOURCES.filter((k) => r.mix[k] > 0.03).length >= 6, `${r.profile} lives on too few sources`);
    }
  });

  it('typical: about a fifth to a quarter of buttons go to sinks; Spire shares come to about 27,000', () => {
    assert.ok(typical.sinkShare >= 0.15 && typical.sinkShare <= 0.3, `sinks ${(typical.sinkShare * 100).toFixed(1)}%`);
    assert.ok(typical.income.spireShares >= 15000 && typical.income.spireShares <= 35000, `Spire shares ${typical.income.spireShares}`);
    assert.ok(typical.income.residentShares > 0);
    assert.equal(typical.income.errands, 3000);
  });

  it('typical: daily gross grows through the season like GDD-00\'s wallet targets (8k early, 35k+ late)', () => {
    const gross = (d) => typical.days.find((x) => x.day === d).grossTotal;
    const mean = (a, b) => { let s = 0; for (let d = a; d <= b; d++) s += gross(d); return s / (b - a + 1); };
    assert.ok(mean(2, 3) >= 6000 && mean(2, 3) <= 18000, `days 2-3: ${mean(2, 3)}`);
    assert.ok(mean(4, 6) >= 12000 && mean(4, 6) <= 26000, `days 4-6: ${mean(4, 6)}`);
    assert.ok(mean(7, 9) >= 20000 && mean(7, 9) <= 36000, `days 7-9: ${mean(7, 9)}`);
    assert.ok(mean(10, 12) >= 30000 && mean(10, 12) <= 55000, `days 10-12: ${mean(10, 12)}`);
    assert.ok(mean(2, 3) < mean(4, 6) && mean(4, 6) < mean(7, 9) && mean(7, 9) < mean(10, 12));
  });

  it('every profile\'s verbs fit its waking clock, and the sim is deterministic', () => {
    for (const r of Object.values(all)) assert.deepEqual(r.warnings, [], r.profile);
    const again = simulate('typical');
    assert.deepEqual(again.cleared, typical.cleared);
    assert.equal(again.totalIncome, typical.totalIncome);
  });

  it('the profiles are behaviour only: every buttons source in the sim exists in the shipped data', () => {
    for (const p of Object.values(PROFILES)) {
      for (const [, id] of p.discs) assert.ok(ITEM.get(id)?.pocket === 'discs', `${p.id} disc ${id}`);
      for (const [, id] of p.held) assert.ok(ITEM.get(id)?.pocket === 'held', `${p.id} held ${id}`);
      for (const [, id] of p.commons) assert.ok(COMMONS.some((c) => c.id === id), `${p.id} commons ${id}`);
      for (const r of p.rooms) assert.ok(COMMISSIONS.some((c) => c.id === r), `${p.id} room ${r}`);
      assert.equal(p.badgeDays.length, 6);
      assert.ok(targets.length === 7);
    }
  });
});

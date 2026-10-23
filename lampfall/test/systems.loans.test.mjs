// Unit tests for js/systems/loans.js. Run: node --test test/systems.loans.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as loans from '../js/systems/loans.js';
import * as bag from '../js/systems/bag.js';
import { validateWorld } from '../js/state/schema.js';
import { DATA } from '../js/data/index.js';
import { createRegistry } from '../js/data/registry.js';
import { evalCond } from '../js/script/cond.js';
import { freshWorld, recBus, TABLES, at, DAY } from './fixtures/econ.fixture.mjs';

const C = (extra = {}) => ({ data: TABLES, ...extra });
const GDD = [6000, 15000, 25000, 36000, 50000, 66000, 80000];

/** Pays a tier off completely at a given time (tops the wallet up first). */
function clearTier(w, now, extra = {}) {
  const owed = loans.balance(w, C());
  w.wallet.main += owed;
  return loans.pay(w, owed, C({ now, ...extra }));
}

describe('loans: the ladder', () => {
  it('defaults and data both give the GDD ladder of 278,000', () => {
    assert.deepEqual(loans.ladder().map((r) => r.amount), GDD);
    assert.deepEqual(loans.ladder(C()).map((r) => r.amount), GDD);
    assert.equal(loans.ladderTotal(), 278000);
    assert.equal(loans.maxTier(C()), 7);
    const r3 = loans.loanRow(3, C());
    assert.deepEqual([r3.commission, r3.build, r3.roofChoices.length], [true, null, 8]);
    assert.equal(loans.loanRow(2, C()).satchel, 10, 'cottage adds 10 slots');
    assert.equal(loans.loanRow(9, C()), null);
  });

  it('sorts data rows by tier and reads the placeholder table through the registry', () => {
    const shuffled = { loans: [TABLES.loans[2], TABLES.loans[0], TABLES.loans[1]] };
    assert.deepEqual(loans.ladder({ data: shuffled }).map((r) => r.tier), [1, 2, 3]);
    assert.deepEqual(loans.ladder({ data: createRegistry(DATA) }).map((r) => r.amount), DATA.loans.map((l) => l.amount));
  });

  it('the cond DSL agrees with balance / tier', () => {
    const w = freshWorld();
    const data = createRegistry({ loans: TABLES.loans });
    assert.equal(evalCond(w, { loan: { paid: false } }, { data }), true);
    clearTier(w, at(0, 19));
    assert.equal(evalCond(w, { loan: { tier: 2 } }, { data }), true);
  });
});

describe('loans: pay and the ceremony', () => {
  it('spends buttons, notches the stick and counts beads', () => {
    const w = freshWorld({ main: 5000 });
    const bus = recBus();
    const r = loans.pay(w, 3000, C({ bus, now: at(0, 20) }));
    assert.equal(r.ok, true);
    assert.deepEqual([r.paid, r.capped, r.tier, r.balance, r.cleared], [3000, false, 1, 3000, null]);
    assert.deepEqual(r.ceremony, { tier: 1, amount: 3000, beads: 3, fastBeads: 0, notchValue: 300, notchesPerStick: 20, notchesBefore: 0, notchesAfter: 10, notchesCut: 10, split: false });
    assert.equal(w.wallet.main, 2000);
    assert.deepEqual(bus.of('loan:paid'), [{ amount: 3000, source: 'pay', tier: 1, paid: 3000, balance: 3000 }]);
    assert.deepEqual(w.loans.log, [{ day: 0, amount: 3000, source: 'pay' }]);
    assert.deepEqual(validateWorld(w), []);
  });

  it('beads speed up after ten; notches never drift on odd amounts', () => {
    const c = loans.ceremonyFor(15000, 0, 66000, 6);
    assert.deepEqual([c.beads, c.fastBeads, c.notchesAfter], [15, 5, 4]);
    assert.equal(loans.ceremonyFor(3299, 0, 66000, 6).notchesCut, 0);
    assert.equal(loans.ceremonyFor(1, 3299, 66000, 6).notchesCut, 1);
    assert.equal(loans.ceremonyFor(750, 0, 15000, 2).notchesCut, 1, 'one notch is 5%');
    assert.equal(loans.ceremonyFor(999, 0, 6000, 1).beads, 0);
    assert.equal(loans.ceremonyFor(0, 0, 0, 1).notchesAfter, 20, 'a free rung is a full stick');
  });

  it('caps at the balance, refuses more than the wallet, and nothing once paid off', () => {
    const w = freshWorld({ main: 100_000 });
    const r = loans.pay(w, 9000, C());
    assert.deepEqual([r.paid, r.capped], [6000, true]);
    assert.equal(w.wallet.main, 94000);
    const poor = freshWorld({ main: 100 });
    assert.deepEqual(loans.pay(poor, 500, C()), { ok: false, reason: 'insufficient', balance: 100, short: 400 });
    assert.equal(poor.loans.paid, 0);
    assert.throws(() => loans.pay(poor, 0, C()), RangeError);
    assert.throws(() => loans.pay(poor, 1.5, C()), RangeError);
  });

  it('clearing a loan splits the stick, offers the next loan and queues the build for 05:40', () => {
    const w = freshWorld({ main: 6000 });
    const bus = recBus();
    const r = loans.pay(w, 6000, C({ bus, now: at(0, 21) }));
    assert.equal(r.ceremony.split, true);
    assert.deepEqual(r.cleared, { tier: 1, build: 'bedsit', needsPick: false, roofChoices: loans.DEFAULTS.roofColours.slice(), nextTier: 2, nextNeedsPick: false, done: false });
    assert.deepEqual([w.loans.tier, w.loans.paid, w.loans.scaffold], [2, 0, 1]);
    assert.deepEqual(w.loans.tally, [{ tier: 1, day: 0 }]);
    assert.deepEqual(w.loans.builds, [{ id: 'bedsit', tier: 1, startedDay: 0, readyDay: 1, choice: null, done: false }]);
    assert.equal(w.flags['sys.loan.cleared'], 1);
    assert.equal(w.flags['sp.porch-lit'], true, 'porch lamp lit at payment');
    assert.deepEqual(bus.of('loan:tier'), [{ tier: 2, prev: 1, done: false }]);
    assert.deepEqual(loans.nextLanding(w, C()), { id: 'bedsit', tier: 1, total: at(1, 5, 40), day: 1, minute: 340 });
    assert.deepEqual(validateWorld(w), []);
  });

  it('yardOpen follows Wren\'s 06:00-24:00', () => {
    assert.equal(loans.yardOpen(5 * 60 + 59), false);
    assert.equal(loans.yardOpen(6 * 60), true);
    assert.equal(loans.yardOpen(23 * 60 + 59), true);
    assert.equal(loans.yardOpen(DAY + 30), false);
  });
});

describe('loans: First Night Errands', () => {
  it('six errands credit 500 each off loan 1, once per id', () => {
    const w = freshWorld();
    for (let i = 1; i <= 6; i++) {
      const r = loans.errand(w, `errand-${i}`, C());
      assert.deepEqual([r.ok, r.credited, r.done], [true, 500, i]);
    }
    assert.equal(w.loans.paid, 3000);
    assert.equal(w.wallet.main, 0, 'errands cost no buttons');
    assert.deepEqual(loans.errand(w, 'errand-1', C()), { ok: false, reason: 'already-credited' });
    assert.deepEqual(loans.errand(w, 'errand-7', C()), { ok: false, reason: 'all-done' });
    assert.deepEqual(loans.todayBySource(w, C()), { errand: 3000 });
  });

  it('only while loan 1 is open', () => {
    const w = freshWorld();
    clearTier(w, at(0, 20));
    assert.deepEqual(loans.errand(w, 'late', C()), { ok: false, reason: 'wrong-tier' });
    assert.throws(() => loans.errand(w, '', C()), TypeError);
  });

  it('an errand that finishes loan 1 clears it and stops there', () => {
    const w = freshWorld({ main: 5800 });
    loans.pay(w, 5800, C());
    const r = loans.errand(w, 'e1', C());
    assert.equal(r.credited, 200);
    assert.equal(r.cleared.tier, 1);
    assert.deepEqual([w.loans.tier, w.loans.paid], [2, 0]);
  });
});

describe('loans: Spire and resident shares', () => {
  it('a badge credits 10% of the open loan, once per spire', () => {
    const w = freshWorld();
    clearTier(w, at(0, 20)); // on loan 2 (15,000)
    const r = loans.spireShare(w, 'turn', C());
    assert.deepEqual([r.ok, r.credited, r.share, r.balance], [true, 1500, 1500, 13500]);
    assert.deepEqual(loans.spireShare(w, 'turn', C()), { ok: false, reason: 'already-credited' });
    assert.deepEqual(w.loans.spireShares, ['turn']);
    assert.equal(w.wallet.main, 0);
  });

  it('a share bigger than the balance clears the loan and carries the rest', () => {
    const w = freshWorld({ main: 5900 });
    loans.pay(w, 5900, C());
    const r = loans.spireShare(w, 'turn', C()); // 600 of which 100 clears loan 1, 500 onto loan 2
    assert.deepEqual([r.credited, r.cleared.length, w.loans.tier, w.loans.paid], [600, 1, 2, 500]);
  });

  it('a finished lead thread credits 5% (one notch); after payoff 4,000 goes to the Commons Jar', () => {
    const w = freshWorld();
    const r = loans.residentShare(w, 'wren-roof', C());
    assert.deepEqual([r.to, r.credited, r.share], ['loan', 300, 300]);
    assert.equal(loans.status(w, C()).notches, 1);
    assert.deepEqual(loans.residentShare(w, 'wren-roof', C()), { ok: false, reason: 'already-credited' });
    for (let t = 1; t <= 7; t++) clearTier(w, at(t, 10));
    assert.equal(loans.isPaidOff(w, C()), true);
    const bus = recBus();
    assert.deepEqual(loans.residentShare(w, 'odile', C({ bus })), { ok: true, to: 'jar', credited: 4000, jar: 4000 });
    assert.deepEqual(bus.of('commons:changed'), [{ jar: 4000, delta: 4000, source: 'resident' }]);
    assert.deepEqual(loans.spireShare(w, 'mirror', C()), { ok: false, reason: 'nothing-owed' });
  });
});

describe('loans: builds', () => {
  it('one build per night, each landing at 05:40', () => {
    const w = freshWorld();
    clearTier(w, at(2, 10));
    loans.spireShare(w, 'turn', C({ now: at(2, 11) }));
    clearTier(w, at(2, 12)); // two clears the same day
    assert.deepEqual(w.loans.builds.map((b) => [b.id, b.readyDay]), [['bedsit', 3], ['cottage', 4]]);
    assert.deepEqual(loans.landDue(w, C({ now: at(3, 5, 39) })).landed, []);
    const bus = recBus();
    const r = loans.landDue(w, C({ now: at(3, 5, 40), bus }));
    assert.deepEqual(r.landed.map((b) => b.id), ['bedsit']);
    assert.deepEqual(bus.of('loan:built'), [{ id: 'bedsit', tier: 1, choice: 'slate-blue' }]);
    assert.equal(w.flags['sys.build.bedsit'], true);
    assert.equal(loans.buildQueue(w).length, 1);
    loans.landDue(w, C({ now: at(9, 12) }));
    assert.equal(loans.buildQueue(w).length, 0);
    assert.equal(loans.nextLanding(w, C()), null);
  });

  it('a payment after midnight still lands at that night\'s 05:40', () => {
    const w = freshWorld();
    clearTier(w, at(3, 2));
    assert.equal(w.loans.builds[0].readyDay, 3);
    const w2 = freshWorld();
    clearTier(w2, at(3, 5, 40));
    assert.equal(w2.loans.builds[0].readyDay, 4, 'exactly 05:40 waits for the next night');
  });

  it('the cottage adds 10 satchel slots when it lands', () => {
    const w = freshWorld();
    clearTier(w, at(1, 10));
    clearTier(w, at(1, 11));
    loans.landDue(w, C({ now: at(5, 6) }));
    assert.equal(bag.slots(w).total, 30);
    assert.deepEqual(validateWorld(w), []);
  });

  it('roof colours: 8 offered, slate blue by default, changeable until it lands', () => {
    const w = freshWorld();
    clearTier(w, at(1, 10));
    assert.equal(loans.roofChoices(1, C()).length, 8);
    assert.deepEqual(loans.chooseRoof(w, 1, 'plum', C()), { ok: true, id: 'bedsit', tier: 1, choice: 'plum' });
    assert.deepEqual(loans.chooseRoof(w, 1, 'neon', C()), { ok: false, reason: 'unknown-colour' });
    assert.deepEqual(loans.chooseRoof(w, 'bedsit', 'ochre', C()).choice, 'ochre');
    assert.deepEqual(loans.chooseRoof(w, 2, 'ochre', C()), { ok: false, reason: 'no-build' });
    loans.landDue(w, C({ now: at(2, 6) }));
    assert.equal(w.loans.builds[0].choice, 'ochre');
    assert.deepEqual(loans.chooseRoof(w, 1, 'plum', C()), { ok: false, reason: 'already-built' });
  });
});

describe('loans: commissions', () => {
  it('pick 4 of 6 for loans 3-6, in order, once each loan is offered', () => {
    const w = freshWorld();
    assert.deepEqual(loans.chooseCommission(w, 'cellar', C()), { ok: false, reason: 'not-yet' });
    clearTier(w, at(1, 10));
    clearTier(w, at(1, 11));
    assert.equal(loans.needsCommission(w, C()), true);
    assert.equal(loans.status(w, C()).houses[2].state, 'pick');
    const bus = recBus();
    assert.deepEqual(loans.chooseCommission(w, 'cellar', C({ bus })), { ok: true, roomId: 'cellar', tier: 3, queued: null });
    assert.deepEqual(bus.of('loan:commission'), [{ roomId: 'cellar', tier: 3 }]);
    assert.equal(loans.needsCommission(w, C()), false);
    assert.deepEqual(loans.chooseCommission(w, 'cellar', C()), { ok: false, reason: 'already-chosen' });
    assert.deepEqual(loans.chooseCommission(w, 'ballroom', C()), { ok: false, reason: 'unknown-room' });
    assert.deepEqual(loans.chooseCommission(w, 'gallery', C()), { ok: false, reason: 'not-yet' }, 'loan 4 is not offered yet');
    const r = clearTier(w, at(1, 12));
    assert.equal(r.cleared.build, 'cellar');
    assert.equal(r.cleared.nextNeedsPick, true);
    assert.deepEqual(loans.commissionOptions(w, C()), ['training-yard', 'workshop', 'greenhouse', 'porch-loft', 'gallery']);
  });

  it('a commission loan cleared before its pick waits, and is queued the moment it is picked', () => {
    const w = freshWorld();
    for (let t = 1; t <= 3; t++) clearTier(w, at(1, 9 + t));
    assert.equal(w.loans.tier, 4);
    assert.equal(loans.status(w, C()).houses[2].state, 'pick');
    assert.equal(w.loans.builds.some((b) => b.tier === 3), false);
    const r = loans.chooseCommission(w, 'greenhouse', C({ now: at(1, 20) }));
    assert.equal(r.tier, 3);
    assert.equal(r.queued.id, 'greenhouse');
    assert.equal(loans.status(w, C()).houses[2].state, 'paid');
    assert.equal(loans.pendingPickTier(w, C()), 4);
  });

  it('the Cellar adds 10 more satchel slots (to 40)', () => {
    const w = freshWorld();
    clearTier(w, at(1, 10));
    clearTier(w, at(1, 11));
    loans.chooseCommission(w, 'cellar', C());
    clearTier(w, at(1, 12));
    loans.landDue(w, C({ now: at(9, 6) }));
    assert.equal(bag.slots(w).total, 40);
  });

  it('leftover rooms cost 20,000 each, only after the Relighting and the four picks', () => {
    const w = freshWorld();
    assert.equal(loans.buyLeftoverCommission(w, 'gallery', C()).reason, 'not-relit');
    w.flags['sp.relit'] = true;
    assert.equal(loans.buyLeftoverCommission(w, 'gallery', C()).reason, 'pick-first');
    w.loans.commissions.push('cellar', 'workshop', 'greenhouse', 'porch-loft');
    assert.deepEqual(loans.buyLeftoverCommission(w, 'gallery', C()), { ok: false, reason: 'insufficient', short: 20000 });
    w.wallet.main = 45000;
    const r = loans.buyLeftoverCommission(w, 'gallery', C({ now: at(20, 9) }));
    assert.deepEqual([r.ok, r.spent, r.queued.id, r.queued.tier, r.queued.readyDay], [true, 20000, 'gallery', 0, 21]);
    assert.equal(loans.buyLeftoverCommission(w, 'gallery', C()).reason, 'already-chosen');
    assert.equal(loans.buyLeftoverCommission(w, 'ballroom', C()).reason, 'unknown-room');
    assert.equal(loans.buyLeftoverCommission(w, 'training-yard', C({ now: at(20, 9) })).queued.readyDay, 22, 'one build per night');
    assert.equal(loans.commissionOptions(w, C()).length, 0);
  });

  it('commission rooms can come from data', () => {
    const data = { ...TABLES, commissions: [{ id: 'attic', satchel: 5 }, { id: 'boathouse' }] };
    assert.deepEqual(loans.commissionRooms({ data }), ['attic', 'boathouse']);
  });
});

describe('loans: the Relighting', () => {
  /** Pays the whole ladder with picks, landing builds as it goes. */
  function payOff(w, payDay = 1) {
    for (let t = 1; t <= 7; t++) {
      if (loans.needsCommission(w, C())) loans.chooseCommission(w, loans.commissionOptions(w, C())[0], C());
      clearTier(w, at(payDay, 9 + t));
    }
  }

  it('fires at the next dusk once loan 7 is zero AND the Lamp Room has landed', () => {
    const w = freshWorld();
    payOff(w);
    assert.equal(loans.isPaidOff(w, C()), true);
    assert.equal(w.loans.tier, 7, 'the last tier stays open at full payment');
    assert.equal(loans.checkRelighting(w, C()).set, false, 'not before the Lamp Room is built');
    // builds land one per night from day 2: bedsit d2, cottage d3, 4 rooms d4-d7, lamp room d8
    assert.equal(w.loans.builds.find((b) => b.id === 'lamp-room').readyDay, 8);
    loans.landDue(w, C({ now: at(7, 6) }));
    assert.equal(w.flags['sp.relighting-due'], undefined);
    const bus = recBus();
    const r = loans.landDue(w, C({ now: at(8, 5, 40), bus }));
    assert.deepEqual(r.relighting, { set: true, day: 8 });
    assert.equal(w.flags['sp.relighting-due'], 8);
    assert.equal(w.flags['sp.lamp-room'], true);
    assert.equal(loans.relightingDue(w, C({ now: at(8, 17, 59) })), false);
    assert.equal(loans.relightingDue(w, C({ now: at(8, 18) })), true);
    assert.equal(loans.checkRelighting(w, C()).set, false, 'idempotent');
    assert.deepEqual(loans.markRelit(w, C()), { changed: true });
    assert.equal(loans.relightingDue(w, C({ now: at(8, 19) })), false);
    assert.deepEqual(validateWorld(w), []);
  });

  it('a Lamp Room noticed after dusk fires the next day', () => {
    const w = freshWorld();
    payOff(w);
    const r = loans.landDue(w, C({ now: at(8, 19) }));
    assert.deepEqual(r.relighting, { set: true, day: 9 });
  });

  it('the hard floor holds: seven builds take at least seven nights', () => {
    const w = freshWorld();
    payOff(w, 0);
    const days = w.loans.builds.map((b) => b.readyDay);
    assert.equal(new Set(days).size, 7);
    assert.ok(Math.max(...days) - Math.min(...days) >= 6);
  });
});

describe('loans: Commons Jar', () => {
  it('deposits from the wallet and funds projects net of the neighbors\' share', () => {
    const w = freshWorld({ main: 5000 });
    const bus = recBus();
    assert.deepEqual(loans.depositJar(w, 3000, C({ bus })), { ok: true, jar: 3000 });
    assert.equal(w.wallet.main, 2000);
    assert.equal(loans.projectShare({ id: 'x', cost: 3000 }), 2400);
    assert.equal(loans.projectShare({ id: 'x', cost: 3000, neighborShare: 0.3 }), 2100);
    assert.deepEqual(loans.fundProject(w, 'dark-house-1', C({ bus })), { ok: true, id: 'dark-house-1', spent: 2400, jar: 600 });
    assert.equal(w.flags['sys.commons.dark-house-1'], true);
    assert.deepEqual(bus.of('commons:built'), [{ id: 'dark-house-1' }]);
    assert.deepEqual(loans.fundProject(w, 'dark-house-1', C()), { ok: false, reason: 'already-built' });
    assert.deepEqual(loans.fundProject(w, 'quay-lamps', C()), { ok: false, reason: 'short', short: 2600 });
    assert.deepEqual(loans.fundProject(w, 'nope', C()), { ok: false, reason: 'unknown-project' });
    assert.deepEqual(loans.depositJar(w, 9999, C()), { ok: false, reason: 'insufficient', short: 7999 });
    assert.deepEqual(validateWorld(w), []);
  });

  it('the green\'s Training Yard waits for badge 5', () => {
    const w = freshWorld({ main: 20000 });
    loans.depositJar(w, 20000, C());
    assert.equal(loans.fundProject(w, 'green-training-yard', C()).reason, 'locked');
    w.badges.push('turn', 'ward', 'weather', 'hollow', 'relay');
    assert.equal(loans.fundProject(w, 'green-training-yard', C()).spent, 8000);
  });

  it('commonsStatus lists the six projects', () => {
    const w = freshWorld();
    const s = loans.commonsStatus(w, C());
    assert.deepEqual(s.map((p) => p.cost), [3000, 4000, 5000, 6000, 10000, 12000]);
    assert.equal(s[4].unlocked, false);
    assert.deepEqual(loans.commonsProjects({ data: { commons: [{ id: 'well', cost: 100 }] } }), [{ id: 'well', cost: 100 }]);
  });
});

describe('loans: Ledger Board', () => {
  it('pace: no credits yet, then "about two days at this pace", then paid', () => {
    const w = freshWorld({ main: 100_000 });
    assert.equal(loans.paceEstimate(w, C()).key, 'none');
    loans.pay(w, 2000, C({ now: at(0, 20) }));
    // day 0 only: 2000/day, 4000 left -> two days
    const p = loans.paceEstimate(w, C({ now: at(0, 21) }));
    assert.deepEqual([p.remaining, p.perDay, p.days, p.key, p.n, p.text], [4000, 2000, 2, 'days', 2, 'About two days at this pace.']);
    // a day later with nothing paid, the window averages over two days
    assert.equal(loans.paceEstimate(w, C({ now: at(1, 9) })).perDay, 1000);
    loans.pay(w, 3000, C({ now: at(1, 9) }));
    assert.deepEqual(loans.paceEstimate(w, C({ now: at(1, 9) })).text, 'About a day at this pace.');
    for (let t = 1; t <= 7; t++) clearTier(w, at(2, 9 + t));
    assert.equal(loans.paceEstimate(w, C()).key, 'paid');
  });

  it('pace beyond twenty days says so', () => {
    const w = freshWorld({ main: 100 });
    loans.pay(w, 100, C({ now: at(0, 20) }));
    const p = loans.paceEstimate(w, C({ now: at(0, 21) }));
    assert.deepEqual([p.key, p.days], ['long', 59]);
  });

  it('the log is capped and today groups by source', () => {
    const w = freshWorld({ main: 5000 });
    for (let i = 0; i < 70; i++) loans.pay(w, 1, C({ now: at(0, 20), tuning: { ledgerLogMax: 60 } }));
    assert.equal(w.loans.log.length, 60);
    loans.residentShare(w, 'a', C({ now: at(0, 20) }));
    assert.deepEqual(loans.todayBySource(w, C({ now: at(0, 20) })), { pay: 59, resident: 300 });
    assert.deepEqual(loans.todayBySource(w, C({ now: at(1, 7) })), {});
  });

  it('status shows the seven houses and the totals', () => {
    const w = freshWorld();
    let s = loans.status(w, C());
    assert.deepEqual(s.houses.map((h) => h.state), ['paying', 'later', 'later', 'later', 'later', 'later', 'finale']);
    assert.deepEqual([s.balance, s.totalOwed, s.ladderTotal, s.scaffold, s.scaffoldMax], [6000, 278000, 278000, 0, 7]);
    clearTier(w, at(0, 20));
    w.wallet.main = 750;
    loans.pay(w, 750, C());
    s = loans.status(w, C());
    assert.deepEqual(s.houses.map((h) => h.state).slice(0, 3), ['paid', 'paying', 'later']);
    assert.deepEqual([s.notches, s.totalPaid, s.totalOwed, s.houses[0].build], [1, 6750, 271250, 'bedsit']);
    assert.deepEqual(loans.tallyWall(w), [{ tier: 1, day: 0 }]);
  });

  it('a full run pays 278,000, scaffolds seven sections and hangs seven sticks', () => {
    const w = freshWorld();
    for (let t = 1; t <= 7; t++) {
      if (loans.needsCommission(w, C())) loans.chooseCommission(w, loans.commissionOptions(w, C())[0], C());
      clearTier(w, at(t, 10));
      loans.landDue(w, C({ now: at(t + 1, 6) }));
    }
    const s = loans.status(w, C());
    assert.deepEqual([s.paidOff, s.totalPaid, s.totalOwed, s.scaffold, w.loans.tally.length], [true, 278000, 0, 7, 7]);
    assert.deepEqual(s.houses.map((h) => h.state), Array(7).fill('paid'));
    assert.equal(loans.pay(w, 1, C()).reason, 'nothing-owed');
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('loans: edges and tuning', () => {
  it('a zero-amount rung clears on its own', () => {
    const data = { loans: [{ id: 'tier-1', tier: 1, amount: 100, build: 'a' }, { id: 'tier-2', tier: 2, amount: 0, build: 'b' }, { id: 'tier-3', tier: 3, amount: 50, build: 'c' }] };
    const w = freshWorld({ main: 1000 });
    loans.pay(w, 100, { data });
    assert.equal(w.loans.tier, 2);
    const r = loans.pay(w, 50, { data });
    assert.equal(r.ok, true);
    assert.equal(w.loans.tier, 3);
    assert.equal(loans.isPaidOff(w, { data }), true);
    assert.deepEqual(w.loans.tally.map((s) => s.tier), [1, 2, 3]);
  });

  it('defaults match GDD-00, every key is listed, bad values throw', () => {
    const d = loans.DEFAULTS;
    assert.deepEqual(d.loanLadder.map((r) => r.amount), GDD);
    assert.deepEqual([d.notchesPerStick, d.beadValue, d.spireShareFraction, d.residentShareFraction, d.residentShareAfterPayoff], [20, 1000, 0.1, 0.05, 4000]);
    assert.deepEqual([d.errandCredit, d.errandCount, d.leftoverCommissionPrice, d.buildLandMinute, d.relightMinute], [500, 6, 20000, 340, 1080]);
    assert.equal(d.roofColours.length, 8);
    assert.equal(d.roofDefault, 'slate-blue');
    assert.deepEqual(d.commonsProjects.map((p) => p.cost), [3000, 4000, 5000, 6000, 10000, 12000]);
    assert.deepEqual([...loans.TUNING_KEYS].sort(), Object.keys(d).sort());
    assert.throws(() => loans.tuningOf({ tuning: { relightFlag: 'no-namespace' } }), TypeError);
    assert.throws(() => loans.tuningOf({ tuning: { loanLadder: [] } }), TypeError);
    assert.equal(loans.ladder({ tuning: { loanLadder: [{ tier: 1, amount: 10, build: 'x' }] } }).length, 1);
  });
});

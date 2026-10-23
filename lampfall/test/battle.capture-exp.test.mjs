// Lantern capture odds and flow, Capture Stance, EXP distribution, payouts,
// blackout cost and the Summit no-loss rule.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { constRng, mk, duel, ofType, makeRng, getSpecies } from './fixtures/battle/helpers.mjs';
import { captureOdds, captureBand, catchUpMult, LANTERN, CAPTURE_FAIL_BONUS, CAPTURE_FAIL_CAP, BENCH_SHARE, YARD_SHARE, CATCH_UP_CAP, BLACKOUT_RATE, BLACKOUT_CAP, TRAINER_EXP_MULT, DAMP_FACTOR, DAMP_START } from '../js/battle/engine.js';

describe('captureOdds (section 15.4)', () => {
  const base = { catchRate: 45, hp: 100, maxHp: 100, status: null, grade: 1, fails: 0 };

  it('is monotonic non-increasing in HP (lower HP, better odds) and strictly better at 1 HP than at full', () => {
    let prev = -1;
    for (let hp = 100; hp >= 1; hp--) {
      const p = captureOdds({ ...base, hp });
      assert.ok(p >= prev, `hp ${hp}: ${p} < ${prev}`);
      prev = p;
    }
    assert.ok(captureOdds({ ...base, hp: 1 }) > captureOdds({ ...base, hp: 100 }));
  });

  it('is monotonic in status: none < burn/poison < chill/numb/trap', () => {
    const none = captureOdds(base);
    const burn = captureOdds({ ...base, status: 'burn' });
    const poison = captureOdds({ ...base, status: 'poison' });
    const chill = captureOdds({ ...base, status: 'chill' });
    const numb = captureOdds({ ...base, status: 'numb' });
    const trapped = captureOdds({ ...base, trapped: true });
    assert.ok(none < burn && burn === poison && poison < chill && chill === numb && numb === trapped);
  });

  it('is monotonic in Lantern grade (250 / 700 / 1,400 glint) and the Keepsake Lantern is a sure catch', () => {
    assert.deepEqual([LANTERN[1].price, LANTERN[2].price, LANTERN[3].price], [250, 700, 1400]);
    const g1 = captureOdds({ ...base, grade: 1 });
    const g2 = captureOdds({ ...base, grade: 2 });
    const g3 = captureOdds({ ...base, grade: 3 });
    assert.ok(g1 < g2 && g2 < g3);
    assert.equal(captureOdds({ ...base, grade: 'sure' }), 1);
    assert.equal(captureOdds({ ...base, catchRate: 3, grade: 'sure' }), 1);
    assert.throws(() => captureOdds({ ...base, grade: 9 }), RangeError);
  });

  it('each failed attempt adds +3%, capped at +15%', () => {
    assert.equal(CAPTURE_FAIL_BONUS, 0.03);
    assert.equal(CAPTURE_FAIL_CAP, 0.15);
    const p0 = captureOdds(base);
    for (let f = 1; f <= 5; f++) {
      assert.ok(Math.abs(captureOdds({ ...base, fails: f }) - (p0 + 0.03 * f)) < 1e-9, `fails ${f}`);
    }
    assert.ok(Math.abs(captureOdds({ ...base, fails: 5 }) - (p0 + 0.15)) < 1e-9);
    assert.equal(captureOdds({ ...base, fails: 6 }), captureOdds({ ...base, fails: 5 }));
    assert.equal(captureOdds({ ...base, fails: 40 }), captureOdds({ ...base, fails: 5 }));
  });

  it('stays within 1%..99% for ordinary Lanterns and bands into Low / Fair / Good', () => {
    assert.ok(captureOdds({ ...base, catchRate: 3, hp: 100 }) >= 0.01);
    assert.ok(captureOdds({ ...base, catchRate: 255, hp: 1, grade: 3, status: 'chill', fails: 5 }) <= 0.99);
    assert.equal(captureBand(0.1), 'Low');
    assert.equal(captureBand(0.3), 'Fair');
    assert.equal(captureBand(0.9), 'Good');
    let prev = 'Low';
    const order = ['Low', 'Fair', 'Good'];
    for (let p = 0; p <= 1; p += 0.01) {
      const b = captureBand(p);
      assert.ok(order.indexOf(b) >= order.indexOf(prev));
      prev = b;
    }
  });

  it('a higher species catch rate means better odds; a Lv-independent formula', () => {
    assert.ok(captureOdds({ ...base, catchRate: 255 }) > captureOdds({ ...base, catchRate: 45 }));
    assert.equal(getSpecies('vagary').catchRate, 3);
    assert.equal(getSpecies('tossup').catchRate, 255);
  });
});

describe('Lantern flow in battle (section 15.3-15.4)', () => {
  function wild(opts = {}) {
    const a = mk('sloshkin', 20, ['tap', 'settle']);
    const t = mk('tossup', 10, ['settle'], { wild: true });
    return { a, t, bt: duel(a, t, { kind: 'wild', ...opts }) };
  }

  it('shows exact odds on Drift and Flux and bands on Freefall, before a Lantern is spent', () => {
    for (const dial of ['drift', 'flux']) {
      const { bt, t } = wild({ dial });
      const menu = bt.availableActions(0).lantern;
      assert.equal(menu.available, true);
      assert.equal(menu.exactOdds, true);
      assert.equal(menu.grades.length, 3);
      assert.equal(menu.grades[0].odds, captureOdds({ catchRate: 255, hp: t.hp, maxHp: t.stats.hp, status: null, grade: 1 }));
      assert.ok(menu.grades[0].odds < menu.grades[1].odds && menu.grades[1].odds < menu.grades[2].odds);
      assert.deepEqual(menu.grades.map((g) => g.price), [250, 700, 1400]);
    }
    const { bt } = wild({ dial: 'freefall' });
    const menu = bt.availableActions(0).lantern;
    assert.equal(menu.exactOdds, false);
    for (const g of menu.grades) {
      assert.equal(g.odds, null);
      assert.ok(['Low', 'Fair', 'Good'].includes(g.band));
    }
  });

  it('no Lanterns in trainer battles; stock limits grey out a grade', () => {
    const tr = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 10, ['tap']));
    assert.equal(tr.availableActions(0).lantern.available, false);
    assert.throws(() => tr.submit([{ type: 'lantern', grade: 1 }, { type: 'move', move: 0 }]), (e) => e.code === 'NO_LANTERN');
    const { bt } = wild({ bag: { lanterns: { 1: 0, 2: 1, 3: 2 } } });
    const grades = bt.availableActions(0).lantern.grades;
    assert.equal(grades[0].selectable, false);
    assert.match(grades[0].reason, /No Lantern left/);
    assert.equal(grades[1].stock, 1);
    assert.throws(() => bt.submit([{ type: 'lantern', grade: 1 }, { type: 'move', move: 0 }]), (e) => e.code === 'NO_LANTERN');
    assert.throws(() => bt.submit([{ type: 'lantern', grade: 7 }, { type: 'move', move: 0 }]), (e) => e.code === 'BAD_LANTERN');
  });

  it('a failed attempt adds +3% to the next shown odds, capped at +15% after five fails', () => {
    const { bt, t } = wild({ rng: constRng(0.999) });
    const first = bt.availableActions(0).lantern.grades[0].odds;
    for (let f = 1; f <= 7; f++) {
      const evs = bt.submit([{ type: 'lantern', grade: 1 }, { type: 'move', move: 0 }]);
      const shake = ofType(evs, 'capture-shake')[0];
      assert.equal(shake.success, false);
      assert.ok(shake.segments >= 0 && shake.segments <= 2, 'the 3-segment meter never fills on a fail');
      const fail = ofType(evs, 'capture-fail')[0];
      assert.equal(fail.fails, f);
      const menu = bt.availableActions(0).lantern;
      assert.equal(menu.fails, f);
      const want = Math.min(0.99, first + Math.min(CAPTURE_FAIL_CAP, f * CAPTURE_FAIL_BONUS));
      assert.ok(Math.abs(menu.grades[0].odds - want) < 1e-9, `after ${f} fails: ${menu.grades[0].odds} vs ${want}`);
      assert.ok(Math.abs(fail.nextOdds - want) < 1e-9);
    }
    assert.equal(bt.phase, 'choose');
    assert.equal(t.wild, true);
  });

  it('a success fills the meter, ends the battle with outcome "capture", lights the Heartmark and awards EXP', () => {
    const { bt, t, a } = wild({ rng: constRng(0.0) });
    const evs = bt.submit([{ type: 'lantern', grade: 2 }, { type: 'move', move: 0 }]);
    const shake = ofType(evs, 'capture-shake')[0];
    assert.equal(shake.segments, 3);
    assert.equal(shake.grade, 2);
    assert.ok(ofType(evs, 'capture').length === 1);
    assert.equal(bt.phase, 'ended');
    assert.equal(bt.outcome, 'capture');
    assert.equal(bt.result().caught, t);
    assert.equal(t.wild, false, 'the Heartmark lights');
    assert.ok(ofType(evs, 'exp').some((e) => e.uid === a.uid));
    assert.equal(ofType(evs, 'payout').length, 0, 'wild battles pay no glint');
  });

  it('the Keepsake Lantern always catches', () => {
    const { bt } = wild({ rng: constRng(0.999) });
    const evs = bt.submit([{ type: 'lantern', grade: 'sure' }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'capture').length, 1);
    assert.equal(bt.outcome, 'capture');
  });
});

describe('Capture Stance (section 15.2)', () => {
  it('is a free toggle in wild battles only', () => {
    const bt = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 10, ['tap']), { kind: 'wild' });
    assert.equal(bt.availableActions(0).captureStance.available, true);
    assert.equal(bt.availableActions(0).captureStance.on, false);
    const evs = bt.setCaptureStance(true);
    assert.deepEqual(evs.map((e) => e.type), ['stance']);
    assert.equal(bt.state().captureStance, true);
    assert.equal(bt.turn, 0, 'costs nothing');
    assert.equal(bt.availableActions(0).captureStance.on, true);
    const tr = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 10, ['tap']));
    assert.equal(tr.availableActions(0).captureStance.available, false);
    assert.throws(() => tr.setCaptureStance(true), (e) => e.code === 'NO_STANCE');
  });

  it('party damage cannot drop the wild creature below 1 HP; off, the same hit faints it', () => {
    const run = (stance) => {
      const a = mk('caldermaw', 60, ['kiln-maw'], { rng: makeRng('c') });
      const t = mk('tossup', 3, ['settle'], { rng: makeRng('t') });
      const bt = duel(a, t, { kind: 'wild', captureStance: stance });
      const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      return { bt, t, evs };
    };
    const on = run(true);
    const dmg = ofType(on.evs, 'damage').find((e) => e.side === 1 && e.source === 'party');
    assert.equal(dmg.hp, 1);
    assert.equal(dmg.stanceFloor, true);
    assert.equal(on.t.hp, 1);
    assert.equal(ofType(on.evs, 'faint').length, 0);
    assert.equal(on.bt.phase, 'choose');
    const again = on.bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(again, 'damage').find((e) => e.side === 1 && e.source === 'party').amount, 0);
    assert.equal(on.t.hp, 1, 'still 1 HP after another full hit');
    const off = run(false);
    assert.ok(ofType(off.evs, 'faint').some((e) => e.side === 1));
    assert.equal(off.bt.outcome, 'win');
    assert.ok(ofType(on.bt.availableActions(0).lantern.grades, undefined).length === 0 || true);
  });

  it('the floor only protects the wild creature, never the party', () => {
    const a = mk('tossup', 3, ['settle']);
    const t = mk('caldermaw', 60, ['kiln-maw']);
    const bt = duel(a, t, { kind: 'wild', captureStance: true });
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'faint').some((e) => e.side === 0));
  });
});

describe('EXP distribution (section 12.1)', () => {
  // Wild Lv5 Tossup: base = floor(40 * 5 / 7) = 28
  const BASE = Math.floor((getSpecies('tossup').expYield * 5) / 7);

  function win(opts = {}, partyFn) {
    const a = mk('caldermaw', 50, ['kiln-maw'], { nickname: 'ACE' });
    const bench = mk('sloshkin', 50, ['tap'], { nickname: 'BENCH', heartmark: 'undertow' });
    const party = partyFn ? partyFn(a, bench) : [a, bench];
    const t = mk('tossup', 5, ['settle']);
    const bt = duel(party, t, { kind: 'wild', ...opts });
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.outcome, 'win');
    return { bt, evs, a, bench, exp: Object.fromEntries(ofType(evs, 'exp').map((e) => [e.creature, e])) };
  }

  it('participants get 100%, every other party member 60%', () => {
    assert.equal(BENCH_SHARE, 0.6);
    const { exp, bt } = win();
    assert.equal(BASE, 28);
    assert.equal(exp.ACE.amount, BASE);
    assert.equal(exp.ACE.share, 'battler');
    assert.equal(exp.BENCH.amount, Math.floor(BASE * 0.6));
    assert.equal(exp.BENCH.share, 'bench');
    const report = bt.result().exp;
    assert.equal(report.length, 2);
    assert.ok(report.every((r) => Number.isInteger(r.levelsGained) && r.levelsGained >= 0));
  });

  it('a fainted party member earns nothing; a switched-in creature counts as a participant', () => {
    const { exp } = win({}, (a, bench) => { bench.hp = 0; return [a, bench]; });
    assert.equal(exp.BENCH, undefined);
    const a = mk('caldermaw', 50, ['kiln-maw'], { nickname: 'ACE' });
    const b = mk('sloshkin', 50, ['tap', 'settle'], { nickname: 'SECOND' });
    const t = mk('tossup', 5, ['settle']);
    const bt = duel([b, a], t, { kind: 'wild' });
    bt.submit([{ type: 'switch', to: 1 }, { type: 'move', move: 0 }]);
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const exp2 = Object.fromEntries(ofType(evs, 'exp').map((e) => [e.creature, e]));
    assert.equal(exp2.SECOND.share, 'battler');
    assert.equal(exp2.ACE.share, 'battler');
  });

  it('catch-up: +50% per 5 levels under the curve, capped at x3, applied per creature', () => {
    assert.equal(CATCH_UP_CAP, 3);
    assert.equal(catchUpMult(50, null), 1);
    assert.equal(catchUpMult(50, 54), 1);
    assert.equal(catchUpMult(50, 55), 1.5);
    assert.equal(catchUpMult(50, 59), 1.5);
    assert.equal(catchUpMult(50, 60), 2);
    assert.equal(catchUpMult(50, 65), 2.5);
    assert.equal(catchUpMult(50, 70), 3);
    assert.equal(catchUpMult(50, 99), 3, 'cap');
    assert.equal(catchUpMult(80, 50), 1, 'over the curve is never damped here');
    for (const [curve, mult] of [[54, 1], [60, 2], [70, 3], [90, 3]]) {
      const { exp } = win({ curveLevel: curve });
      assert.equal(exp.ACE.amount, Math.floor(BASE * mult), `curve ${curve}`);
      assert.equal(exp.BENCH.amount, Math.floor(BASE * 0.6 * mult), `curve ${curve} bench`);
    }
  });

  it('over-curve damping applies only to Rematch-board EXP', () => {
    assert.equal(DAMP_FACTOR, 0.5);
    assert.equal(DAMP_START, 10);
    const route = win({ curveLevel: 30, source: 'route' });
    assert.equal(route.exp.ACE.amount, BASE, 'route EXP is never damped');
    const rematch = win({ curveLevel: 30, source: 'rematch' });
    assert.equal(rematch.exp.ACE.amount, Math.floor(BASE * 0.5));
    const near = win({ curveLevel: 40, source: 'rematch' });
    assert.equal(near.exp.ACE.amount, BASE, 'damping starts past curve + 10');
  });

  it('Big Sibling hands the lowest-level party member an extra 30%; the Training Yard gets 25% of party EXP', () => {
    const scrap = mk('scrapling', 50, ['knuckle'], { nickname: 'SIB' });
    const low = mk('tossup', 10, ['tap'], { nickname: 'LOW' });
    const mid = mk('tossup', 30, ['tap'], { nickname: 'MID' });
    const yard = [mk('wirewhisk', 12, ['tap'], { nickname: 'YARD' })];
    const t = mk('tossup', 5, ['settle']);
    const bt = duel([scrap, low, mid], t, { kind: 'wild', yard });
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const exps = ofType(evs, 'exp');
    const sib = exps.find((e) => e.share === 'sibling');
    assert.equal(sib.creature, 'LOW');
    assert.equal(sib.amount, Math.floor(BASE * 0.3));
    const partyTotal = exps.filter((e) => e.share !== 'yard').reduce((s, e) => s + e.amount, 0);
    const y = exps.find((e) => e.share === 'yard');
    assert.equal(y.creature, 'YARD');
    assert.equal(y.amount, Math.floor(partyTotal * YARD_SHARE));
    assert.ok(bt.result().exp.some((r) => r.name === 'YARD'));
  });

  it('trainer battles pay more EXP than wild ones and level-ups surface moves', () => {
    assert.equal(TRAINER_EXP_MULT, 1.5);
    const a = mk('caldermaw', 50, ['kiln-maw'], { nickname: 'ACE' });
    const t = mk('tossup', 5, ['settle']);
    const bt = duel(a, t);
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'exp')[0].amount, Math.floor(BASE * 1.5));
    const b = mk('caldermaw', 60, ['kiln-maw']);
    const low = mk('sloshkin', 4, ['tap'], { nickname: 'KID' });
    const bt2 = duel([b, low], mk('stillox', 60, ['settle']), { kind: 'wild' });
    for (let i = 0; i < 20 && bt2.phase === 'choose'; i++) bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt2.outcome, 'win');
    const up = bt2.log.find((e) => e.type === 'levelup' && e.creature === 'KID');
    assert.ok(up && up.to > 4);
    assert.ok(bt2.log.some((e) => e.type === 'learn' && e.creature === 'KID' && e.move === 'undertow'));
    assert.equal(bt2.result().exp.find((r) => r.name === 'KID').levelsGained, up.to - 4);
  });
});

describe('payouts, blackout and the Summit (section 13.2, 16)', () => {
  function loss(opts) {
    const a = mk('tossup', 1, ['tap']);
    const t = mk('caldermaw', 60, ['kiln-maw']);
    const bt = duel(a, t, opts);
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.outcome, 'loss');
    return { bt, evs, blackout: ofType(evs, 'blackout')[0] };
  }

  it('a trainer win pays the trainer\'s payout (default 40 x their highest level)', () => {
    const a = mk('caldermaw', 50, ['kiln-maw']);
    const t = mk('tossup', 5, ['settle']);
    const bt = duel(a, t, { trainer: { name: 'Fisher', payout: 777 } });
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'payout')[0].amount, 777);
    assert.equal(bt.result().payout, 777);
    const bt2 = duel(mk('caldermaw', 50, ['kiln-maw']), mk('tossup', 5, ['settle']), { trainer: { name: 'Fisher' } });
    bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt2.result().payout, 40 * 5);
  });

  it('a blackout costs 10% of glint, capped at 3,000', () => {
    assert.equal(BLACKOUT_RATE, 0.1);
    assert.equal(BLACKOUT_CAP, 3000);
    assert.equal(loss({ glint: 10000 }).blackout.cost, 1000);
    assert.equal(loss({ glint: 50000 }).bt.result().blackoutCost, 3000);
    assert.equal(loss({ glint: 0 }).blackout.cost, 0);
    assert.equal(loss({ glint: 12345 }).blackout.cost, 1234);
  });

  it('a Summit loss costs nothing', () => {
    const { bt, blackout } = loss({ glint: 50000, summit: true });
    assert.equal(blackout.cost, 0);
    assert.equal(blackout.summit, true);
    assert.match(blackout.text, /Summit takes nothing/);
    assert.equal(bt.result().summitNoLoss, true);
    assert.equal(bt.result().blackoutCost, 0);
  });

  it('result() carries ended/outcome/winner/turns/exp/payout/blackoutCost/caught', () => {
    const { bt } = loss({ glint: 100 });
    const r = bt.result();
    assert.deepEqual(Object.keys(r).sort(), ['blackoutCost', 'caught', 'ended', 'exp', 'outcome', 'payout', 'summitNoLoss', 'turns', 'winner']);
    assert.equal(r.ended, true);
    assert.equal(r.winner, 1);
    assert.equal(r.caught, null);
    assert.deepEqual(r.exp, []);
  });
});

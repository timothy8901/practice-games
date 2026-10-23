// Unit tests for js/systems/party.js. Run: node --test test/systems.party.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/systems/party.js';
import * as C from '../js/systems/creature.js';
import * as E from '../js/systems/exp.js';
import { validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createBus } from '../js/core/events.js';
import { DATA, REG, mk, world, spyBus, makeRng } from './fixtures/rules-creature.fixture.mjs';

/** Unbound creature (no uid yet), as a catch arrives. */
const fresh = (speciesId, level, extra = {}) => ({ ...mk('tmp', speciesId, level, extra), uid: '' });

/** World with `n` party creatures added through the system. */
function withParty(n, level = 10) {
  const w = world();
  for (let i = 0; i < n; i++) P.addCreature(w, fresh('sloshkin', level), DATA);
  return w;
}

describe('tuning', () => {
  it('DEFAULTS are frozen; ALL_TUNING_KEYS covers the three modules without duplicates', () => {
    assert.ok(Object.isFrozen(P.DEFAULTS));
    assert.equal(P.DEFAULTS.PARTY_MAX, 6);
    assert.equal(new Set(P.ALL_TUNING_KEYS).size, P.ALL_TUNING_KEYS.length);
    for (const k of [...C.TUNING_KEYS, ...E.TUNING_KEYS, ...P.TUNING_KEYS]) assert.ok(P.ALL_TUNING_KEYS.includes(k), k);
    assert.throws(() => P.tuningOf({ PARTY_MAX: 7 }), TypeError);
    assert.equal(P.tuningOf({ BOX_CAPACITY: 2 }).BOX_CAPACITY, 2);
  });

  it('checkTuning reports unknown keys and malformed values across the lane', () => {
    assert.deepEqual(P.checkTuning({ BENCH_SHARE: 0.5, MENDS_PER_BATTLE: 2, BOX_CAPACITY: 30 }), []);
    assert.deepEqual(P.checkTuning(null), []);
    const probs = P.checkTuning({ BENCH_SHAER: 0.5, MAX_BOND: 9, PARTY_MAX: 0, CATCH_UP_CAP: 0.5 });
    assert.equal(probs.length, 4, probs.join('\n'));
    assert.ok(probs[0].includes('BENCH_SHAER'));
    assert.deepEqual(P.checkTuning(5), ['tuning: expected an object']);
  });
});

describe('uids', () => {
  it('nextUid allocates c1, c2, ... from the sys.uid counter and skips uids already present', () => {
    const w = world();
    assert.equal(P.nextUid(w), 'c1');
    assert.equal(P.nextUid(w), 'c2');
    w.box.push(mk('c3', 'sloshkin', 5), mk('c4', 'sloshkin', 5));
    assert.equal(P.nextUid(w), 'c5');
    assert.equal(w.counters['sys.uid'], 5);
  });

  it('findCreature finds by uid in party or box', () => {
    const w = withParty(1);
    w.box.push(mk('b1', 'tossup', 5));
    assert.equal(P.findCreature(w, 'c1').where, 'party');
    assert.deepEqual(P.findCreature(w, 'b1').where, 'box');
    assert.equal(P.findCreature(w, 'zz'), null);
  });
});

describe('addCreature', () => {
  it('stores a normalized copy with a fresh uid, catch day/map, a lit Heartmark, and emits party:changed', () => {
    const w = world();
    w.player.mapId = 'route-a';
    w.clock.total = 3 * 1440 + 60;
    const { bus, events } = spyBus();
    const c = fresh('sloshkin', 5, { wild: true });
    const r = P.addCreature(w, c, DATA, { bus });
    assert.equal(r.ok, true);
    assert.equal(r.uid, 'c1');
    assert.equal(r.where, 'party');
    assert.notEqual(w.party[0], c, 'a copy');
    assert.equal(w.party[0].caughtDay, 3);
    assert.equal(w.party[0].caughtMap, 'route-a');
    assert.equal(w.party[0].wild, false);
    assert.deepEqual(events, [['party:changed', { reason: 'add', uid: 'c1', where: 'party' }]]);
    assert.deepEqual(validateWorld(w), []);
  });

  it('skips windows already passed at catch time, and does not when caught:false', () => {
    const w = world();
    const r = P.addCreature(w, fresh('sloshkin', 22), DATA);
    assert.deepEqual(r.skippedWindows, [9, 20]);
    assert.deepEqual(w.party[0].windowsUsed, [9, 20]);
    assert.deepEqual(w.pendingShifts, []);
    const g = P.addCreature(w, { ...fresh('sloshkin', 22), caughtDay: 7 }, DATA, { caught: false });
    assert.deepEqual(g.skippedWindows, []);
    assert.equal(w.party[1].caughtDay, 7);
    assert.deepEqual(w.pendingShifts, [g.uid], 'an un-skipped reached window is pending at once');
  });

  it('fills the party, then the box, then refuses; `to` forces a destination; LIGHT_ON_CATCH is tunable', () => {
    const tuning = { BOX_CAPACITY: 2 };
    const w = world();
    for (let i = 0; i < 6; i++) assert.equal(P.addCreature(w, fresh('tossup', 5), DATA, { tuning }).where, 'party');
    assert.equal(P.addCreature(w, fresh('tossup', 5), DATA, { tuning }).where, 'box');
    assert.deepEqual(P.addCreature(w, fresh('tossup', 5), DATA, { tuning, to: 'party' }), { ok: false, reason: 'party-full' });
    assert.equal(P.addCreature(w, fresh('tossup', 5), DATA, { tuning }).where, 'box');
    assert.deepEqual(P.addCreature(w, fresh('tossup', 5), DATA, { tuning }), { ok: false, reason: 'full' });
    assert.deepEqual(P.addCreature(w, fresh('tossup', 5), DATA, { tuning, to: 'box' }), { ok: false, reason: 'box-full' });
    assert.equal(w.counters['sys.uid'], 8, 'refusals allocate no uid');
    const v = world();
    P.addCreature(v, fresh('tossup', 5, { wild: true }), DATA, { tuning: { LIGHT_ON_CATCH: false, PARTY_MAX: 1 } });
    assert.equal(v.party[0].wild, true);
    assert.equal(P.addCreature(v, fresh('tossup', 5), DATA, { tuning: { PARTY_MAX: 1 }, to: 'box' }).where, 'box');
  });

  it('keeps an explicit unused uid; throws on a duplicate uid or a non-object', () => {
    const w = world();
    assert.equal(P.addCreature(w, mk('x9', 'tossup', 5), DATA).uid, 'x9');
    assert.throws(() => P.addCreature(w, mk('x9', 'tossup', 5), DATA), /already/);
    assert.throws(() => P.addCreature(w, null, DATA), TypeError);
  });
});

describe('arranging', () => {
  it('swap exchanges slots and validates indices', () => {
    const w = withParty(3);
    const { bus, events } = spyBus();
    assert.deepEqual(P.swap(w, 0, 2, { bus }), { ok: true });
    assert.deepEqual(w.party.map((c) => c.uid), ['c3', 'c2', 'c1']);
    assert.deepEqual(P.swap(w, 1, 1), { ok: true });
    assert.deepEqual(P.swap(w, 0, 3), { ok: false, reason: 'bad-index' });
    assert.deepEqual(P.swap(w, -1, 0), { ok: false, reason: 'bad-index' });
    assert.deepEqual(P.swap(w, 0.5, 0), { ok: false, reason: 'bad-index' });
    assert.equal(events.length, 1);
  });

  it('toBox refuses the last member, the last conscious one and a full box', () => {
    const w = withParty(2);
    assert.deepEqual(P.toBox(w, 'zz'), { ok: false, reason: 'not-in-party' });
    w.party[1].hp = 0;
    assert.deepEqual(P.toBox(w, 'c1'), { ok: false, reason: 'last-alive' });
    assert.deepEqual(P.toBox(w, 'c2'), { ok: true, index: 0 });
    assert.deepEqual(P.toBox(w, 'c1'), { ok: false, reason: 'last' });
    const v = withParty(3);
    for (const c of v.party) c.hp = 0;
    assert.equal(P.toBox(v, 'c1').ok, true, 'an all-fainted party may still be rearranged');
    assert.deepEqual(P.toBox(v, 'c2', null, { tuning: { BOX_CAPACITY: 1 } }), { ok: false, reason: 'box-full' });
  });

  it('a pending window is held while boxed and comes back on fromBox', () => {
    const w = withParty(2, 5);
    const c = w.party[0];
    P.giveExp(w, c.uid, E.expForLevel('medium-slow', 9) - c.exp, DATA);
    assert.deepEqual(w.pendingShifts, [c.uid]);
    P.toBox(w, c.uid, DATA);
    assert.deepEqual(w.pendingShifts, []);
    const r = P.fromBox(w, c.uid, DATA);
    assert.deepEqual(r, { ok: true, index: 1, pending: true });
    assert.deepEqual(w.pendingShifts, [c.uid]);
  });

  it('fromBox refuses a full party and takes the creature off the Yard', () => {
    const w = withParty(6);
    w.box.push(mk('b1', 'tossup', 5));
    assert.deepEqual(P.toYard(w, 'b1'), { ok: true });
    assert.deepEqual(P.fromBox(w, 'b1'), { ok: false, reason: 'party-full' });
    assert.deepEqual(P.fromBox(w, 'zz'), { ok: false, reason: 'not-in-box' });
    P.toBox(w, 'c6');
    assert.equal(P.fromBox(w, 'b1').ok, true);
    assert.deepEqual(w.yard, []);
  });

  it('Training Yard holds stored creatures only, up to YARD_CAP', () => {
    const w = withParty(1);
    for (const u of ['b1', 'b2', 'b3', 'b4']) w.box.push(mk(u, 'tossup', 5));
    assert.deepEqual(P.toYard(w, 'c1'), { ok: false, reason: 'not-in-box' });
    for (const u of ['b1', 'b2', 'b3']) assert.deepEqual(P.toYard(w, u), { ok: true });
    assert.deepEqual(P.toYard(w, 'b1'), { ok: false, reason: 'already' });
    assert.deepEqual(P.toYard(w, 'b4'), { ok: false, reason: 'yard-full' });
    assert.deepEqual(P.toYard(w, 'b4', { tuning: { YARD_CAP: 4 } }), { ok: true });
    assert.deepEqual(P.fromYard(w, 'b2'), { ok: true });
    assert.deepEqual(P.fromYard(w, 'b2'), { ok: false });
    assert.deepEqual(w.yard, ['b1', 'b3', 'b4']);
    assert.deepEqual(validateWorld(w), []);
  });

  it('release removes a creature everywhere, never the last party member', () => {
    const w = withParty(2, 25);
    w.box.push(mk('b1', 'tossup', 5));
    P.toYard(w, 'b1');
    assert.equal(P.release(w, 'b1', DATA).ok, true);
    assert.deepEqual(w.yard, []);
    w.party[0].windowsUsed = [];
    E.refreshPending(w, 'c1', DATA);
    assert.deepEqual(w.pendingShifts, ['c1']);
    assert.equal(P.release(w, 'c1', DATA).ok, true);
    assert.deepEqual(w.pendingShifts, []);
    assert.deepEqual(P.release(w, 'c2', DATA), { ok: false, reason: 'last' });
    assert.deepEqual(P.release(w, 'zz', DATA), { ok: false, reason: 'unknown' });
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('care', () => {
  it('heal restores the party (or listed uids, box included) and emits once', () => {
    const w = withParty(2);
    w.box.push(mk('b1', 'tossup', 5));
    for (const c of [...w.party, ...w.box]) { c.hp = 0; c.status = { kind: 'numb', turns: 1 }; c.moves[0].pp = 0; c.mends = 0; }
    const { bus, events } = spyBus();
    assert.deepEqual(P.heal(w, { bus }), { healed: ['c1', 'c2'] });
    for (const c of w.party) assert.equal(c.hp, c.stats.hp);
    assert.equal(w.box[0].hp, 0);
    assert.deepEqual(P.heal(w, { uids: ['b1', 'zz'], tuning: { MENDS_PER_BATTLE: 1 } }), { healed: ['b1'] });
    assert.equal(w.box[0].mends, 1);
    assert.deepEqual(P.heal(w, { uids: [] }), { healed: [] });
    assert.equal(events.length, 1);
  });

  it('nickname sanitizes, enforces NICKNAME_MAX and refuses empty names', () => {
    const w = withParty(1);
    assert.deepEqual(P.nickname(w, 'c1', '  Pud\u0007dle   Jr  '), { ok: true, nickname: 'Puddle Jr' });
    assert.equal(w.party[0].nickname, 'Puddle Jr');
    assert.deepEqual(P.nickname(w, 'c1', ' \n '), { ok: false, reason: 'empty' });
    assert.deepEqual(P.nickname(w, 'c1', 'abcdefghijklm'), { ok: false, reason: 'too-long' });
    assert.deepEqual(P.nickname(w, 'c1', 'abcdefghijklm', { tuning: { NICKNAME_MAX: 13 } }).ok, true);
    assert.deepEqual(P.nickname(w, 'zz', 'x'), { ok: false, reason: 'unknown' });
    assert.equal(P.nickname(w, 'c1', '🐟🐟').ok, true, 'counts code points');
  });

  it('pinHeartmark pins a known move once and emits', () => {
    const w = world();
    P.addCreature(w, fresh('tossup', 20), DATA);
    const { bus, events } = spyBus();
    const move = w.party[0].moves[0].id;
    assert.deepEqual(P.pinHeartmark(w, 'c1', 'riptide', DATA, { bus }), { ok: false, reason: 'not-known' });
    assert.deepEqual(P.pinHeartmark(w, 'c1', move, DATA, { bus }), { ok: true });
    assert.deepEqual(P.pinHeartmark(w, 'c1', w.party[0].moves[1].id, DATA), { ok: false, reason: 'already-pinned' });
    assert.deepEqual(P.pinHeartmark(w, 'zz', move, DATA), { ok: false, reason: 'unknown' });
    assert.deepEqual(events, [['party:changed', { reason: 'heartmark', uid: 'c1', move }]]);
  });

  it('giveExp levels up, emits creature:levelUp / creature:learned / shift:window', () => {
    const w = withParty(1, 8);
    const { bus, events } = spyBus();
    const c = w.party[0];
    const r = P.giveExp(w, 'c1', E.expForLevel('medium-slow', 9) - c.exp, DATA, { bus });
    assert.equal(r.ok, true);
    assert.deepEqual(r.windowsOpened, [9]);
    assert.equal(r.levelUp.to, 9);
    assert.deepEqual(events.map((e) => e[0]), ['creature:levelUp', ...r.levelUp.newMoves.map(() => 'creature:learned'), 'shift:window', 'party:changed']);
    assert.deepEqual(P.giveExp(w, 'zz', 5, DATA), { ok: false, reason: 'unknown' });
    const quiet = P.giveExp(w, 'c1', 1, DATA, { bus });
    assert.equal(quiet.levelUp, null);
  });
});

describe('applyOutcome', () => {
  /** Party of three, a box creature on the Yard; returns world + engine-style copies. */
  function setup() {
    const w = world('OUTCOME');
    P.addCreature(w, fresh('sloshkin', 18), DATA);   // c1 lead
    P.addCreature(w, fresh('scrapling', 15), DATA);  // c2 bench (Big Sibling ability)
    P.addCreature(w, fresh('tossup', 6), DATA);      // c3 bench, lowest
    P.addCreature(w, fresh('wirewhisk', 3), DATA, { to: 'box' }); // c4 Yard
    P.toYard(w, 'c4');
    const copies = w.party.map((c) => C.serialize(c));
    return { w, copies };
  }

  it('writes HP / PP / status back by uid (clamped), dropping volatile statuses', () => {
    const { w, copies } = setup();
    copies[0].hp = 7; copies[0].moves[0].pp = 2; copies[0].status = { kind: 'burn', turns: 3 };
    copies[1].hp = 99999; copies[1].moves[0].pp = -4; copies[1].status = { kind: 'trap', turns: 2 };
    copies[2].hp = -3;
    const r = P.applyOutcome(w, { party: [...copies, { uid: 'ghost', hp: 1 }, null], outcome: 'run' }, DATA);
    assert.equal(w.party[0].hp, 7);
    assert.equal(w.party[0].moves[0].pp, 2);
    assert.deepEqual(w.party[0].status, { kind: 'burn', turns: 3 });
    assert.equal(w.party[1].hp, w.party[1].stats.hp);
    assert.equal(w.party[1].moves[0].pp, 0);
    assert.equal(w.party[1].status, null);
    assert.equal(w.party[2].hp, 0);
    assert.deepEqual(r.awards, []);
    assert.deepEqual(validateWorld(w), []);
  });

  it('splits EXP via systems/exp when `defeated` is given (bench, sibling, yard, fainted get none)', () => {
    const { w, copies } = setup();
    copies[2].hp = 0; // tossup fainted
    const before = Object.fromEntries([...w.party, ...w.box].map((c) => [c.uid, c.exp]));
    const result = { party: copies, kind: 'wild', source: 'route', curveLevel: 18, defeated: [{ speciesId: 'mudfist', level: 12 }], participants: ['c1'] };
    const r = P.applyOutcome(w, result, DATA);
    const expected = E.computeAward({
      kind: 'wild', source: 'route', curveLevel: 18, defeated: result.defeated,
      party: w.party.map((c) => ({ uid: c.uid, level: c.level, fainted: c.uid === 'c3', participated: c.uid === 'c1', ability: c.ability })),
      yard: [{ uid: 'c4', level: 3 }],
    }, DATA).totals;
    assert.deepEqual(r.awards, expected);
    assert.ok(!r.awards.some((a) => a.uid === 'c3'));
    assert.ok(r.awards.some((a) => a.uid === 'c4'), 'Yard share');
    for (const a of r.awards) {
      const c = P.findCreature(w, a.uid).c;
      assert.ok(c.exp > before[a.uid], a.uid);
    }
  });

  it('falls back to the engine\'s per-uid EXP amounts when no `defeated` is given', () => {
    const { w, copies } = setup();
    const before = w.party[1].exp;
    const r = P.applyOutcome(w, { party: copies, exp: [{ uid: 'c2', amount: 30 }, { uid: 'c2', amount: 12.7 }, { uid: 'c1', amount: -5 }, { uid: 'nobody', amount: 50 }, { amount: 3 }] }, DATA);
    assert.deepEqual(r.awards, [{ uid: 'c2', amount: 42 }]);
    assert.equal(w.party[1].exp, before + 42);
  });

  it('level-ups report new moves, open windows into pendingShifts once and emit events in order', () => {
    const { w, copies } = setup();
    const { bus, events } = spyBus();
    const r = P.applyOutcome(w, { party: copies, exp: [{ uid: 'c1', amount: E.expForLevel('medium-slow', 21) - w.party[0].exp }, { uid: 'c3', amount: 100000 }] }, DATA, null, { bus });
    assert.deepEqual(r.levelUps.map((l) => [l.uid, l.from, l.to]), [['c1', 18, 21], ['c3', 6, w.party[2].level]]);
    assert.deepEqual(r.windows.filter((x) => x.uid === 'c1'), [{ uid: 'c1', level: 20 }], 'Lv9 was skipped at catch');
    assert.ok(r.windowsOpened.includes('c1'));
    assert.deepEqual(w.pendingShifts, r.windowsOpened);
    assert.equal(new Set(w.pendingShifts).size, w.pendingShifts.length);
    const names = events.map((e) => e[0]);
    assert.equal(names[0], 'creature:levelUp');
    assert.equal(names[names.length - 1], 'party:changed');
    assert.ok(names.includes('shift:window'));
    assert.deepEqual(validateWorld(w), []);
  });

  it('adds the catch (fresh uid on collision), marks the Field Log and reports a lost catch when full', () => {
    const { w, copies } = setup();
    const caught = { ...C.serialize(mk('c2', 'rushling', 9, { wild: true })), hp: 3 };
    const marks = [];
    const markFieldLog = (world, state, formId) => { assert.equal(world, w); marks.push([state, formId]); };
    const r = P.applyOutcome(w, { party: copies, caught, defeated: [{ speciesId: 'rushling', level: 9 }], participants: ['c1'], seen: ['rushling', 'mudfist'], read: ['rushling'] }, DATA, makeRng('o'), { markFieldLog });
    assert.equal(r.caught.uid, 'c5');
    assert.equal(r.caught.where, 'party');
    const c = P.findCreature(w, 'c5').c;
    assert.equal(c.hp, 3);
    assert.equal(c.wild, false);
    assert.deepEqual(marks, [['seen', 'rushling'], ['seen', 'mudfist'], ['read', 'rushling'], ['held', 'rushling']]);
    const full = world();
    for (let i = 0; i < 6; i++) P.addCreature(full, fresh('tossup', 5), DATA);
    const lost = P.applyOutcome(full, { caught: fresh('rushling', 9) }, DATA, null, { tuning: { BOX_CAPACITY: 0 }, markFieldLog: (_w, state, formId) => marks.push([state, formId]) });
    assert.equal(lost.caught, null);
    assert.equal(lost.caughtLost, 'full');
    assert.deepEqual(marks.slice(4), [['seen', 'rushling']], 'a lost catch is Seen, never Held');
  });

  it('draws a Heartmark placement for a caught record that lacks one, deterministically', () => {
    const run = () => {
      const { w } = setup();
      const caught = C.serialize(mk('w1', 'rushling', 9));
      delete caught.mark;
      P.applyOutcome(w, { caught }, DATA, makeRng('mark-seed'), { tuning: { MARK_SPREAD: { x: 9, y: 9 } } });
      return P.findCreature(w, 'w1').c.mark;
    };
    assert.deepEqual(run(), run());
    const { w } = setup();
    const caught = C.serialize(mk('w1', 'rushling', 9));
    delete caught.mark;
    P.applyOutcome(w, { caught }, DATA, null);
    assert.deepEqual(P.findCreature(w, 'w1').c.mark, { x: 0, y: 0 });
  });

  it('is deterministic: two identical worlds and results end deep-equal', () => {
    const go = () => {
      const { w, copies } = setup();
      copies[0].hp = 5;
      const r = P.applyOutcome(w, { party: copies, kind: 'trainer', source: 'spire', curveLevel: 25, defeated: [{ speciesId: 'mudfist', level: 20 }, { speciesId: 'sedgehare', level: 22 }], participants: ['c1', 'c2'], caught: null }, REG);
      return { w, r };
    };
    assert.deepEqual(go(), go());
  });

  it('runs inside a strict store.tx (no write escapes the transaction) and rejects a non-object', () => {
    const { w, copies } = setup();
    const bus = createBus();
    const seen = [];
    bus.on('*', (evt) => seen.push(evt));
    const store = createStore(w, { strict: true, bus });
    const r = store.tx('battle.apply', (world) => P.applyOutcome(world, { party: copies, defeated: [{ speciesId: 'mudfist', level: 30 }], participants: ['c1'] }, DATA, null, { bus }));
    assert.ok(r.levelUps.length > 0);
    assert.ok(seen.includes('creature:levelUp'));
    assert.throws(() => P.addCreature(store.world, fresh('tossup', 3), DATA), /outside|tx|write/i);
    assert.throws(() => P.applyOutcome(w, null, DATA), TypeError);
    assert.deepEqual(validateWorld(store.world, REG), []);
  });
});

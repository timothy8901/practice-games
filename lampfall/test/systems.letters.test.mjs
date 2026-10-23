// Unit tests for js/systems/letters.js (SYS-TOWN). Run: node --test test/systems.letters.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/systems/letters.js';
import { validateWorld } from '../js/state/schema.js';
import { porchFlag } from '../js/systems/townCommon.js';
import { unreadLetters } from '../js/state/selectors.js';
import { evalCond } from '../js/script/cond.js';
import { createRegistry } from '../js/data/registry.js';
import { makeWorld, makeData, at, recBus, MIN } from './fixtures/town.fixture.mjs';

const data = makeData();
/** World with the home porch lit (loan 1 paid), on core `day` at 06:00. */
const litWorld = (day = 1) => {
  const w = makeWorld({ day, minute: 6 * MIN });
  w.loans.tier = 2;
  return w;
};
const morning = (w, day, opts = {}) => { at(w, day, 6 * MIN); return L.deliverMorning(w, data, opts); };

describe('content helpers', () => {
  it('channels, order, labels', () => {
    assert.equal(L.channelOf({ channel: 'family' }), 'family');
    assert.equal(L.channelOf({ id: 'k7' }), 'keeper');
    assert.equal(L.channelOf({ id: 'f-3' }), 'family');
    assert.equal(L.channelOf({ id: 't12' }), 'town');
    assert.equal(L.channelOf({ id: 'e1' }), 'event');
    assert.equal(L.channelOf({ id: 'letter-1' }), 'keeper', 'default');
    assert.equal(L.channelOf({ id: 'k1', channel: 'bogus' }), 'keeper');
    assert.equal(L.lettersIn(data, 'keeper').length, 20);
    assert.equal(L.lettersIn(data, 'family').length, 18);
    assert.equal(L.lettersIn(data, 'town').length, 18);
    assert.equal(L.lettersIn(data, 'event').length, 2);
    assert.equal(L.labelOf(data, L.letterByN(data, 30)), 'F10');
    assert.equal(L.labelOf(data, { n: 3, id: 'x' }), 'K3', 'no index: position in channel');
    assert.equal(L.labelOf(data, null), '');
    assert.equal(L.letterByN(data, 999), null);
    const shuffled = { letters: [...data.letters].reverse() };
    assert.deepEqual(L.lettersIn(shuffled, 'keeper').slice(0, 3).map((l) => l.n), [1, 2, 3], 'serial order, not table order');
    const reg = createRegistry({ letters: data.letters });
    assert.equal(L.lettersIn(reg, 'town')[0].id, 't1');
  });

  it('validateLetters', () => {
    assert.deepEqual(L.validateLetters(data), []);
    const bad = { letters: [
      { id: 'a', n: 1, channel: 'post' },
      { id: 'f1', n: 2, channel: 'family' },
      { id: 't1', n: 3, channel: 'town' },
      { id: 'e1', n: 4, channel: 'event' },
      { id: 'k1', n: 5, channel: 'keeper', index: 1 },
      { id: 'k2', n: 6, channel: 'keeper', index: 1, flags: 'sp.x' },
    ] };
    assert.deepEqual(L.validateLetters(bad), [
      "letters:a: channel 'post' unknown (keeper family town event)",
      'letters:f1: family letters need a door',
      'letters:t1: town letters need a find (or relicId)',
      'letters:e1: event letters need an event id',
      'letters:k2: keeper index 1 also used by k1',
      'letters:k2: flags must be a string[]',
    ]);
  });
});

describe('Keeper letters (06:00)', () => {
  it('none on day 1, none to a dark porch, K1 on day 2 once the porch is lit', () => {
    const w = makeWorld({ day: 0, minute: 6 * MIN });
    assert.equal(L.deliverMorning(w, data).reason, 'too-early', 'GDD day 1');
    at(w, 1, 6 * MIN);
    const dark = L.deliverMorning(w, data);
    assert.deepEqual([dark.keeper, dark.reason], [null, 'porch-dark']);
    assert.equal(w.letters.keeperDay, -1, 'a dark morning is not a delivery');
    w.loans.tier = 2;
    const bus = recBus();
    const r = L.deliverMorning(w, data, { bus });
    assert.deepEqual(r, { keeper: 1, town: [], reason: null, lateDelivery: false });
    assert.deepEqual([w.letters.today, w.letters.got, w.letters.mailbox, w.letters.delivered, w.letters.keeperDay], [1, [1], [1], 1, 1]);
    assert.deepEqual(bus.of('letter:delivered'), [{ n: 1, id: 'k1', channel: 'keeper', label: 'K1', where: 'mailbox', day: 1 }]);
    assert.equal(L.deliverMorning(w, data).reason, 'already', 'one per date');
    assert.deepEqual(w.letters.got, [1]);
    assert.deepEqual(validateWorld(w), []);
  });

  it('K1 on day 2 through K20 on day 21 when the mail is collected each morning', () => {
    const w = litWorld(1);
    const got = [];
    for (let day = 1; day <= 20; day++) {
      const r = morning(w, day);
      got.push([day + 1, r.keeper]);
      L.collectMail(w, data);
    }
    assert.deepEqual(got, Array.from({ length: 20 }, (_, i) => [i + 2, i + 1]), 'GDD day n brings K(n-1)');
    assert.equal(morning(w, 21).reason, 'none-left');
  });

  it('no accrual: missed mornings slide the series; an uncollected letter holds the next', () => {
    const w = litWorld(1);
    morning(w, 1);
    assert.equal(morning(w, 2).reason, 'mailbox-full', 'K1 still in the mailbox');
    assert.equal(w.letters.today, null, 'yesterday’s letter is no longer today’s');
    assert.equal(morning(w, 5).reason, 'mailbox-full', 'a long jump still adds nothing while the mailbox is full');
    L.collectMail(w, data);
    const r = morning(w, 9);
    assert.equal(r.keeper, 2, 'eight days later: one letter, the next in order (a clock change adds at most one)');
    assert.deepEqual(w.letters.got, [1, 2]);
    assert.equal(morning(w, 9).keeper, null);
    L.markRead(w, data, 2);
    assert.equal(morning(w, 10).keeper, 3, 'reading collects the letter too');
    const loose = litWorld(1);
    morning(loose, 1);
    assert.equal(morning(loose, 2, { tuning: { mailboxHoldsOne: false } }).keeper, 2, 'tuning can let letters pile up, still one per date');
  });

  it('a Keeper letter with an unlock cond waits for it', () => {
    const d = makeData();
    d.letters[1] = { ...d.letters[1], unlock: { flag: 'sp.ready' } };
    const w = litWorld(1);
    L.deliverMorning(w, d);
    L.collectMail(w, d);
    at(w, 2, 6 * MIN);
    assert.equal(L.deliverMorning(w, d).reason, 'locked');
    w.flags['sp.ready'] = true;
    at(w, 3, 6 * MIN);
    assert.equal(L.deliverMorning(w, d).keeper, 2);
  });

  it('a dark home porch (flag) stops the post again; tuning can drop the porch rule', () => {
    const w = litWorld(1);
    w.flags[porchFlag('porch-keepers-cottage')] = false;
    assert.equal(morning(w, 1).reason, 'porch-dark');
    assert.equal(morning(w, 2, { tuning: { keeperNeedsLitPorch: false } }).keeper, 1);
    assert.equal(morning(w, 3, { isPorchLit: () => true }).reason, 'mailbox-full');
  });

  it('town letters by morning post from day 22, after the last Keeper letter, one a morning', () => {
    const w = litWorld(1);
    for (let day = 1; day <= 20; day++) { morning(w, day); L.collectMail(w, data); }
    assert.deepEqual(morning(w, 20).town, [], 'K20 arrived on day 21: no post that morning');
    const r22 = morning(w, 21);
    assert.deepEqual([r22.keeper, r22.town], [null, [39]], 'GDD day 22: T1');
    assert.deepEqual(morning(w, 21).town, [], 'once a morning');
    assert.deepEqual(morning(w, 22).town, [40]);
    assert.deepEqual(morning(w, 23, { tuning: { townPostPerMorning: 3 } }).town, [41, 42, 43]);
    assert.equal(w.letters.townDay, 23);
    assert.deepEqual(validateWorld(w), []);
  });

  it('town post waits while Keeper letters remain, even after day 22', () => {
    const w = litWorld(25);
    const r = L.deliverMorning(w, data);
    assert.deepEqual([r.keeper, r.town], [1, []]);
  });
});

describe('family letters (18:00), doors and heirlooms', () => {
  it('one at the counter from day 2, only while the counter is empty', () => {
    const w = makeWorld({ day: 0, minute: 18 * MIN });
    assert.equal(L.deliverEvening(w, data).reason, 'too-early');
    at(w, 1, 17 * MIN + 59);
    assert.equal(L.deliverEvening(w, data).reason, 'not-yet', 'not before 18:00');
    at(w, 2, MIN);
    assert.equal(L.familyBlock(w, data, 2), 'not-yet', '01:00 belongs to the next day, still before its 18:00');
    assert.equal(L.familyBlock(w, data, 2, {}, { ignoreHour: true }), null);
    assert.equal(L.deliverEvening(at(w, 1, 12 * MIN), data, { tuning: { familyLetterHour: 12 } }).family, 21, 'tunable hour');
    w.letters = { ...w.letters, got: [], delivered: 0, counter: null, familyDay: -1 };
    at(w, 1, 18 * MIN);
    const bus = recBus();
    const r = L.deliverEvening(w, data, { bus });
    assert.deepEqual(r, { family: 21, reason: null, lateDelivery: false });
    assert.equal(w.letters.counter, 21);
    assert.deepEqual(bus.of('letter:delivered')[0], { n: 21, id: 'f1', channel: 'family', label: 'F1', where: 'counter', day: 1 });
    assert.equal(L.deliverEvening(w, data).reason, 'already');
    at(w, 2, 18 * MIN);
    assert.equal(L.deliverEvening(w, data).reason, 'counter-full', 'no accrual');
    assert.deepEqual(validateWorld(w), []);
  });

  it('carry: during Hesper’s hours 18:00–02:00 only', () => {
    const w = makeWorld({ day: 1, minute: 18 * MIN });
    assert.deepEqual(L.carry(w, data), { ok: false, reason: 'empty' });
    L.deliverEvening(w, data);
    at(w, 2, 3 * MIN);
    assert.deepEqual(L.carry(w, data), { ok: false, reason: 'closed' });
    assert.deepEqual(L.carry(w, data, { tuning: { counterHoursEnforced: false } }).ok, true);
    const w2 = makeWorld({ day: 1, minute: 18 * MIN });
    L.deliverEvening(w2, data);
    at(w2, 2, 1 * MIN + 30);
    const bus = recBus();
    assert.deepEqual(L.carry(w2, data, { bus }), { ok: true, n: 21 }, '01:30 is still open');
    assert.deepEqual([w2.letters.counter, w2.letters.carrying], [null, [21]]);
    assert.deepEqual(bus.of('letter:collected'), [{ n: 21, from: 'counter' }]);
    at(w2, 2, 18 * MIN);
    assert.equal(L.deliverEvening(w2, data).family, 22, 'counter empty again');
  });

  it('a lightsPorch letter returns its heirloom and creature at once and lights the porch', () => {
    const w = makeWorld({ day: 1, minute: 18 * MIN });
    L.deliverEvening(w, data);
    L.carry(w, data);
    assert.deepEqual(L.deliverToDoor(w, data, 21, 'odile'), { ok: false, reason: 'wrong-door' });
    assert.deepEqual(L.deliverToDoor(w, data, 22, 'odile'), { ok: false, reason: 'not-carrying' });
    const gave = [];
    const bus = recBus();
    const r = L.deliverToDoor(w, data, 21, 'dorrows', {
      bus, giveItem: (world, id, n) => gave.push(['item', id, n]), addCreature: (world, spec) => gave.push(['creature', spec]),
    });
    assert.deepEqual(r, { ok: true, returned: true, reward: { n: 21, id: 'f1', item: 'heirloom-1', creature: { species: 'crit-1', level: 5 }, lightsPorch: 'dorrows' } });
    assert.deepEqual(gave, [['item', 'heirloom-1', 1], ['creature', { species: 'crit-1', level: 5 }]]);
    assert.equal(w.flags[porchFlag('dorrows')], true);
    assert.deepEqual([w.letters.carrying, w.letters.doors, w.letters.returned, w.letters.awaiting], [[], [21], [21], []]);
    assert.deepEqual(bus.names(), ['letter:door', 'flag:set', 'letter:heirloom'], 'handed in, then the porch lights and the heirloom comes home');
    assert.equal(bus.of('letter:door')[0].awaiting, false);
    assert.deepEqual(L.deliverToDoor(w, data, 21, 'dorrows'), { ok: false, reason: 'not-carrying' }, 'only once');
    assert.deepEqual(validateWorld(w), []);
  });

  it('at a dark porch the heirloom waits until the porch is lit', () => {
    const w = makeWorld({ day: 1, minute: 18 * MIN });
    L.deliverEvening(w, data);
    L.carry(w, data);
    L.deliverToDoor(w, data, 21, 'dorrows');
    at(w, 2, 18 * MIN);
    L.deliverEvening(w, data);
    L.carry(w, data);
    const r = L.deliverToDoor(w, data, 22, 'odile');
    assert.deepEqual(r, { ok: true, returned: false, reward: null });
    assert.deepEqual(w.letters.awaiting, [22]);
    assert.deepEqual(L.releaseHeirlooms(w, data), [], 'still dark');
    w.flags[porchFlag('odile')] = true;
    const gave = [];
    const out = L.releaseHeirlooms(w, data, { giveItem: (_w, id) => gave.push(id) });
    assert.deepEqual(out.map((x) => x.id), ['f2']);
    assert.deepEqual(gave, ['heirloom-2']);
    assert.deepEqual([w.letters.awaiting, w.letters.returned], [[], [21, 22]]);
    assert.deepEqual(L.releaseHeirlooms(w, data), []);
    assert.deepEqual(validateWorld(w), []);
  });

  it('a letter row without a door can go to any door; its porch decides', () => {
    const d = makeData();
    d.letters[22] = { ...d.letters[22], door: undefined };
    const w = makeWorld({ day: 1, minute: 18 * MIN });
    w.letters.got.push(23); w.letters.delivered = 1; w.letters.carrying.push(23);
    const r = L.deliverToDoor(w, d, 23, 'wren', { isPorchLit: (id) => id === 'wren' });
    assert.equal(r.returned, true, 'handed in at a lit porch');
    const missing = makeWorld();
    missing.letters.got.push(99); missing.letters.delivered = 1; missing.letters.carrying.push(99);
    assert.deepEqual(L.deliverToDoor(missing, d, 99, 'x'), { ok: false, reason: 'unknown-letter' });
    assert.equal(L.porchOfLetter({ porch: 'p', door: 'd' }), 'p');
    assert.equal(L.porchOfLetter({ door: '' }), null);
  });
});

describe('reading, the string wall, event letters, the Late Delivery', () => {
  it('markRead sets reveal flags, counts the stat, returns reveal ops, collects', () => {
    const w = litWorld(1);
    assert.deepEqual(L.markRead(w, data, 1), { ok: false, reason: 'not-delivered' });
    L.deliverMorning(w, data);
    const bus = recBus();
    const r = L.markRead(w, data, 1, { bus });
    assert.deepEqual(r, { ok: true, already: false, reveal: [{ op: 'setFlag', id: 'sp.k1-reveal' }], flags: ['sp.k1-read'] });
    assert.equal(w.flags['sp.k1-read'], true);
    assert.equal(w.stats.lettersRead, 1);
    assert.deepEqual(w.letters.mailbox, []);
    assert.deepEqual(bus.of('letter:read'), [{ n: 1, id: 'k1', channel: 'keeper', label: 'K1' }]);
    assert.equal(evalCond(w, { letter: { read: 1 } }), true, 'the cond DSL sees it');
    assert.deepEqual(L.markRead(w, data, 1), { ok: true, already: true, reveal: [], flags: [] });
    assert.equal(w.stats.lettersRead, 1);
    assert.equal(L.isRead(w, 1), true);
    assert.equal(L.isDelivered(w, 1), true);
    assert.deepEqual(validateWorld(w), []);
  });

  it('pinFind delivers the find’s town letter on the spot', () => {
    const w = makeWorld({ day: 3, minute: 10 * MIN });
    const bus = recBus();
    assert.deepEqual(L.pinFind(w, data, 'find-7', { bus }), { ok: true, letter: 45, lateDelivery: false });
    assert.deepEqual(bus.of('letter:pinned'), [{ findId: 'find-7' }]);
    assert.equal(bus.of('letter:delivered')[0].where, 'wall');
    assert.deepEqual(L.pinFind(w, data, 'find-7'), { ok: false, reason: 'already-pinned' });
    assert.deepEqual(L.pinFind(w, data, 'plain-shell'), { ok: true, letter: null, lateDelivery: false });
    assert.deepEqual(L.pinFind(w, data, ''), { ok: false, reason: 'bad-find' });
    assert.deepEqual(w.letters.pinned, ['find-7', 'plain-shell']);
    assert.equal(L.townLetterFor({ letters: [{ id: 't1', n: 1, channel: 'town', relicId: 'bell' }] }, 'bell').id, 't1', 'relicId works too');
    assert.deepEqual(unreadLetters(w), [45]);
    assert.deepEqual(L.unread(w), [45]);
    assert.deepEqual(validateWorld(w), []);
  });

  it('a pinned town letter is not posted again later', () => {
    const w = litWorld(1);
    L.pinFind(w, data, 'find-1');
    for (let day = 1; day <= 20; day++) { morning(w, day); L.collectMail(w, data); }
    assert.deepEqual(morning(w, 21).town, [40], 'T1 already came; the post brings T2');
  });

  it('event letters', () => {
    const w = makeWorld({ day: 13 });
    assert.deepEqual(L.deliverEvent(w, data, 'nope'), { ok: false, reason: 'unknown-event' });
    assert.deepEqual(L.deliverEvent(w, data, 'lantern'), { ok: true, n: 57 });
    assert.deepEqual(L.deliverEvent(w, data, 'lantern'), { ok: false, reason: 'already' });
    assert.deepEqual(L.deliverEvent(w, data, 'e2'), { ok: true, n: 58 }, 'by id too');
    assert.deepEqual(validateWorld(w), []);
  });

  it('the Late Delivery party fires once, the day the last serial letter arrives', () => {
    const w = litWorld(1);
    const bus = recBus();
    for (let i = 1; i <= 18; i++) L.pinFind(w, data, `find-${i}`, { bus });
    for (let day = 1; day <= 18; day++) {
      at(w, day, 18 * MIN);
      L.deliverEvening(w, data, { bus });
      L.carry(w, data);
    }
    for (let day = 1; day <= 19; day++) { morning(w, day, { bus }); L.collectMail(w, data); }
    assert.equal(bus.of('letters:late-delivery').length, 0);
    const last = morning(w, 20, { bus });
    assert.equal(last.lateDelivery, true, 'K20 was the 56th');
    assert.deepEqual(bus.of('letters:late-delivery'), [{ day: 20, gameDay: 21, count: 56 }]);
    assert.equal(w.flags[L.LATE_DELIVERY_FLAG], 21);
    L.deliverEvent(w, data, 'lantern', { bus });
    assert.equal(bus.of('letters:late-delivery').length, 1, 'once');
    assert.equal(w.letters.delivered, 57);
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('previews and tuning', () => {
  it('nextLetterPreview: tomorrow’s letter or why none comes', () => {
    const w = makeWorld({ day: 0, minute: 20 * MIN });
    assert.deepEqual(L.nextLetterPreview(w, data), { n: null, id: null, label: null, channel: null, gameDay: 2, blocked: 'porch-dark' });
    w.loans.tier = 2;
    assert.deepEqual(L.nextLetterPreview(w, data), { n: 1, id: 'k1', label: 'K1', channel: 'keeper', gameDay: 2, blocked: null });
    assert.equal(L.nextLetterPreview(w, data, { day: 0 }).blocked, 'too-early');
    const done = litWorld(1);
    for (let day = 1; day <= 20; day++) { morning(done, day); L.collectMail(done, data); }
    assert.equal(L.nextLetterPreview(done, data, { day: 21 }).label, 'T1');
    assert.equal(L.nextLetterPreview(done, data, { day: 21, tuning: { townPostFromDay: 30 } }).blocked, 'none-left', 'before the post day nothing comes');
  });

  it('tuning defaults are the GDD values', () => {
    const t = L.tuningOf(null);
    assert.deepEqual([t.letterHour, t.familyLetterHour, t.keeperFirstDay, t.familyFirstDay, t.townPostFromDay], [6, 18, 2, 2, 22]);
    assert.deepEqual(t.hesperCounterHours, [18 * MIN, 2 * MIN]);
    assert.deepEqual(L.TUNING_KEYS, Object.keys(L.DEFAULTS));
    assert.throws(() => L.tuningOf({ tuning: { letterHour: 25 } }), /letterHour/);
    assert.throws(() => L.tuningOf({ tuning: { mailboxHoldsOne: 'yes' } }), /mailboxHoldsOne/);
  });

  it('a long mixed run keeps the world valid', () => {
    const w = litWorld(1);
    for (let day = 1; day <= 30; day++) {
      morning(w, day);
      for (const n of L.collectMail(w, data)) L.markRead(w, data, n);
      at(w, day, 18 * MIN);
      L.deliverEvening(w, data);
      const c = L.carry(w, data);
      if (c.ok) {
        const row = L.letterByN(data, c.n);
        L.deliverToDoor(w, data, c.n, row.door, { isPorchLit: (id) => (id.startsWith('door-') ? true : undefined) });
      }
      if (day % 3 === 0) L.pinFind(w, data, `find-${day / 3}`);
      if (day === 10) w.flags[porchFlag('odile')] = true;
      L.releaseHeirlooms(w, data);
      assert.deepEqual(validateWorld(w), [], `day ${day}`);
    }
    assert.equal(w.letters.returned.length, 18, 'every heirloom home');
    assert.equal(new Set(w.letters.got).size, w.letters.got.length);
  });
});

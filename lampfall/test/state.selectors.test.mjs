// Unit tests for js/state/selectors.js. Run: node --test test/state.selectors.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as sel from '../js/state/selectors.js';
import { createNewWorld, creatureDefaults } from '../js/state/schema.js';
import { createClock, MINUTES_PER_DAY } from '../js/core/time.js';

const world = (over = {}) => {
  const w = createNewWorld({ seedCode: 'SEL-TEST', lease: { mapId: 'harbor' } });
  Object.assign(w, over);
  return w;
};
const at = (w, dayN, minute) => { w.clock.total = dayN * MINUTES_PER_DAY + minute; return w; };
const creature = (uid, hp, level = 5) => ({ ...creatureDefaults(), uid, hp, level, stats: { ...creatureDefaults().stats, hp: 30 } });

describe('time selectors', () => {
  it('read day, hour, minute, phase and weekday from clock.total', () => {
    const w = at(world(), 9, 13 * 60 + 7.5);
    assert.equal(sel.totalMinutes(w), 9 * MINUTES_PER_DAY + 787.5);
    assert.equal(sel.day(w), 9);
    assert.equal(sel.minuteOfDay(w), 787.5);
    assert.equal(sel.hour(w), 13);
    assert.equal(sel.dayOfWeek(w), 2);
    assert.equal(sel.phase(w), 'midday');
    assert.equal(sel.isNight(w), false);
    assert.equal(sel.formatTime(w), '13:07');
    assert.equal(sel.formatTime(w, { hour12: true }), '1:07 PM');
    assert.equal(sel.phase(at(world(), 0, 23 * 60)), 'night');
    assert.equal(sel.isNight(at(world(), 0, 20 * 60)), true, 'evening counts as night');
    assert.equal(sel.phase(at(world(), 0, 6 * 60)), 'dawn');
  });

  it('tolerates a missing clock', () => {
    assert.equal(sel.totalMinutes({}), 0);
    assert.equal(sel.hour(null), 0);
    assert.equal(sel.formatTime({ clock: { total: -5 } }), '00:00');
  });

  it('agrees with a live core/time clock restored from the same state', () => {
    const w = world();
    for (const total of [0, 1120, 5000, 12345, 99999.5]) {
      w.clock.total = total;
      const clock = createClock({ seed: w.clock.seed });
      clock.restore({ ...w.clock });
      assert.equal(sel.tideState(w), clock.tideState, `tideState at ${total}`);
      assert.ok(Math.abs(sel.tide(w) - clock.tide) < 1e-9, `tide at ${total}`);
      assert.equal(sel.phase(w), clock.phase, `phase at ${total}`);
      assert.equal(sel.hour(w), clock.hour, `hour at ${total}`);
      assert.equal(sel.day(w), clock.day, `day at ${total}`);
      assert.equal(sel.isNight(w), clock.isNight, `isNight at ${total}`);
      assert.equal(sel.isLowTide(w), clock.isLowTide, `isLowTide at ${total}`);
    }
  });

  it('tide depends on the clock seed and cycles through every state', () => {
    const w = world();
    const states = new Set();
    for (let m = 0; m < 2000; m += 15) states.add(sel.tideState(w, m));
    assert.deepEqual([...states].sort(), ['falling', 'high', 'low', 'rising']);
    const other = world();
    other.clock.seed = 'different';
    const a = Array.from({ length: 20 }, (_, i) => sel.tide(w, i * 60).toFixed(3));
    const b = Array.from({ length: 20 }, (_, i) => sel.tide(other, i * 60).toFixed(3));
    assert.notDeepEqual(a, b);
    assert.equal(sel.LOW_TIDE < sel.HIGH_TIDE, true);
  });
});

describe('party selectors', () => {
  it('partyAlive, hasAliveParty, lead, creatureByUid, partyMaxLevel', () => {
    const w = world();
    assert.deepEqual(sel.partyAlive(w), []);
    assert.equal(sel.hasAliveParty(w), false);
    assert.equal(sel.lead(w), null);
    w.party.push(creature('c1', 0, 7), creature('c2', 10, 3));
    w.box.push(creature('c3', 5, 12));
    assert.deepEqual(sel.partyAlive(w).map((c) => c.uid), ['c2']);
    assert.equal(sel.lead(w).uid, 'c2');
    assert.equal(sel.hasAliveParty(w), true);
    w.party[1].hp = 0;
    assert.equal(sel.lead(w).uid, 'c1', 'falls back to the first slot');
    assert.equal(sel.creatureByUid(w, 'c3').level, 12);
    assert.equal(sel.creatureByUid(w, 'zz'), null);
    assert.equal(sel.partyMaxLevel(w), 7);
    assert.equal(sel.partyMaxLevel({}), 0);
  });

  it('curveLevel prefers the map region band and falls back to the party', () => {
    const w = world();
    assert.equal(sel.curveLevel(w), 1);
    w.party.push(creature('c1', 1, 9));
    assert.equal(sel.curveLevel(w), 9);
    const tables = { maps: { harbor: { region: 'bay' } }, regions: { bay: { curveLevel: 14 } } };
    const data = { has: (t, id) => Boolean(tables[t]?.[id]), get: (t, id) => tables[t][id] };
    assert.equal(sel.curveLevel(w, data), 14);
    w.player.mapId = 'unknown';
    assert.equal(sel.curveLevel(w, data), 9);
    assert.equal(sel.curveLevel(w, { has: () => { throw new Error('x'); }, get: () => 1 }), 9);
  });
});

describe('run selectors', () => {
  it('loanTier, hasBadge, badgeCount, hasChallenge, hasSeen', () => {
    const w = world();
    assert.equal(sel.loanTier(w), 1);
    w.loans.tier = 4;
    assert.equal(sel.loanTier(w), 4);
    assert.equal(sel.hasBadge(w, 'spire-1'), false);
    w.badges.push('spire-1');
    assert.equal(sel.hasBadge(w, 'spire-1'), true);
    assert.equal(sel.badgeCount(w), 1);
    assert.equal(sel.hasChallenge(w, 'no-rewind'), false);
    w.run.challenges.push('no-rewind');
    assert.equal(sel.hasChallenge(w, 'no-rewind'), true);
    assert.equal(sel.hasSeen(w, 'arrival'), false);
    w.flags['seen.arrival'] = true;
    assert.equal(sel.hasSeen(w, 'arrival'), true);
    assert.equal(sel.loanTier(null), 1);
  });

  it('itemCount sums stacks across pockets', () => {
    const w = world();
    w.bag.pockets.medicine.push({ id: 'berry', n: 3 });
    w.bag.pockets.wicks.push({ id: 'berry', n: 2 }, { id: 'rod', n: 1 });
    assert.equal(sel.itemCount(w, 'berry'), 5);
    assert.equal(sel.itemCount(w, 'rod'), 1);
    assert.equal(sel.itemCount(w, 'none'), 0);
    assert.equal(sel.itemCount({}, 'x'), 0);
  });

  it('unreadLetters, fieldLogState, mapState, placeLabel', () => {
    const w = world();
    w.letters = { delivered: 4, read: [2, 4], today: null };
    assert.deepEqual(sel.unreadLetters(w), [1, 3]);
    assert.equal(sel.fieldLogState(w, 'sloshkin'), 'unknown');
    w.fieldLog.forms.sloshkin = { seen: true, read: false, held: false, ability: null };
    assert.equal(sel.fieldLogState(w, 'sloshkin'), 'seen');
    w.fieldLog.forms.sloshkin.read = true;
    assert.equal(sel.fieldLogState(w, 'sloshkin'), 'read');
    w.fieldLog.forms.sloshkin.held = true;
    assert.equal(sel.fieldLogState(w, 'sloshkin'), 'held');
    const ms = sel.mapState(w, 'nowhere');
    assert.deepEqual(ms, { visited: false, picked: {}, trees: {}, cracks: {}, reach: {}, reachAt: {}, opened: [] });
    assert.equal('nowhere' in w.maps, false, 'reading never writes');
    w.maps.harbor = { ...ms, visited: true };
    assert.equal(sel.mapState(w, 'harbor').visited, true);
    assert.equal(sel.placeLabel(w), 'harbor');
    assert.equal(sel.placeLabel({}), '—');
  });
});

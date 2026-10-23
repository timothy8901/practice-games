// Unit tests for js/systems/flags.js. Run: node --test test/state.flags.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as flags from '../js/systems/flags.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createBus } from '../js/core/events.js';

const world = () => createNewWorld({ seedCode: 'FLAGS-TEST' });
const spy = () => {
  const bus = createBus();
  const events = [];
  bus.on('flag:set', (p) => events.push(['flag:set', p]));
  bus.on('counter:inc', (p) => events.push(['counter:inc', p]));
  return { bus, events, ctx: { bus } };
};

describe('flag ids', () => {
  it('require a known namespace and a name', () => {
    for (const ok of ['sp.arrived', 'th.wren.1', 'np.wren.met', 'sys.uid', 'seen.arrival']) assert.equal(flags.assertFlagId(ok), ok);
    for (const bad of ['', 'arrived', 'sp.', 'xx.y', 3, null]) {
      assert.throws(() => flags.assertFlagId(bad), TypeError, String(bad));
      assert.equal(flags.isFlagId(bad), false);
    }
    assert.equal(flags.isFlagId('sp.x'), true);
  });
});

describe('setFlag / getFlag / hasFlag / clearFlag', () => {
  it('sets, reports change, emits only on change', () => {
    const w = world();
    const { events, ctx } = spy();
    assert.deepEqual(flags.setFlag(w, 'sp.arrived', true, ctx), { changed: true, id: 'sp.arrived', value: true, prev: null });
    assert.deepEqual(flags.setFlag(w, 'sp.arrived', true, ctx), { changed: false, id: 'sp.arrived', value: true, prev: true });
    assert.deepEqual(flags.setFlag(w, 'sp.arrived', 'later', ctx), { changed: true, id: 'sp.arrived', value: 'later', prev: true });
    assert.equal(events.length, 2);
    assert.deepEqual(events[1], ['flag:set', { id: 'sp.arrived', value: 'later', prev: true }]);
    assert.equal(flags.setFlag(w, 'sp.other').value, true, 'default value is true');
    assert.equal(flags.getFlag(w, 'sp.arrived'), 'later');
    assert.equal(flags.getFlag(w, 'sp.none'), null);
    assert.equal(flags.getFlag(w, 'sp.none', 0), 0);
    assert.equal(flags.hasFlag(w, 'sp.arrived'), true);
    assert.equal(flags.hasFlag(w, 'sp.none'), false);
    flags.setFlag(w, 'sp.zero', 0);
    assert.equal(flags.hasFlag(w, 'sp.zero'), false);
    assert.equal(flags.getFlag(w, 'sp.zero'), 0);
    assert.deepEqual(validateWorld(w), []);
  });

  it('works without a ctx and rejects bad values', () => {
    const w = world();
    assert.doesNotThrow(() => flags.setFlag(w, 'sp.a', 1));
    assert.throws(() => flags.setFlag(w, 'arrived', true), TypeError);
    assert.throws(() => flags.setFlag(w, 'sp.a', null), TypeError);
    assert.throws(() => flags.setFlag(w, 'sp.a', {}), TypeError);
    assert.throws(() => flags.setFlag(w, 'sp.a', NaN), TypeError);
  });

  it('clearFlag removes the key and reports prev', () => {
    const w = world();
    const { events, ctx } = spy();
    flags.setFlag(w, 'sp.a', 5);
    assert.deepEqual(flags.clearFlag(w, 'sp.a', ctx), { changed: true, id: 'sp.a', prev: 5 });
    assert.equal('sp.a' in w.flags, false);
    assert.deepEqual(flags.clearFlag(w, 'sp.a', ctx), { changed: false, id: 'sp.a', prev: null });
    assert.equal(events.length, 1);
    assert.deepEqual(events[0][1], { id: 'sp.a', value: null, prev: 5 });
  });

  it('markSeen sets seen.<scriptId>', () => {
    const w = world();
    flags.markSeen(w, 'arrival');
    assert.equal(w.flags['seen.arrival'], true);
    assert.throws(() => flags.markSeen(w, ''), TypeError);
  });

  it('flagsWithPrefix filters by prefix', () => {
    const w = world();
    flags.setFlag(w, 'th.wren.1', true);
    flags.setFlag(w, 'th.wren.2', 3);
    flags.setFlag(w, 'th.mo.1', true);
    assert.deepEqual(flags.flagsWithPrefix(w, 'th.wren.'), { 'th.wren.1': true, 'th.wren.2': 3 });
    assert.deepEqual(flags.flagsWithPrefix({}, 'x'), {});
  });
});

describe('counters', () => {
  it('inc creates at 0, adds, returns the new value and emits', () => {
    const w = world();
    const { events, ctx } = spy();
    assert.equal(flags.inc(w, 'sys.steps', 1, ctx), 1);
    assert.equal(flags.inc(w, 'sys.steps', 4, ctx), 5);
    assert.equal(flags.inc(w, 'sys.steps', -2), 3);
    assert.equal(flags.inc(w, 'sys.other'), 1);
    assert.equal(flags.get(w, 'sys.steps'), 3);
    assert.equal(flags.get(w, 'sys.none'), 0);
    assert.deepEqual(events[1], ['counter:inc', { id: 'sys.steps', value: 5, prev: 1, by: 4 }]);
    assert.throws(() => flags.inc(w, 'sys.steps', NaN), TypeError);
    assert.throws(() => flags.inc(w, 'steps'), TypeError);
    assert.deepEqual(validateWorld(w), []);
  });

  it('set stores an exact value and emits only on change', () => {
    const w = world();
    const { events, ctx } = spy();
    assert.equal(flags.set(w, 'sys.x', 10, ctx), 10);
    assert.equal(flags.set(w, 'sys.x', 10, ctx), 10);
    assert.equal(flags.set(w, 'sys.x', 4, ctx), 4);
    assert.equal(events.length, 2);
    assert.deepEqual(events[1][1], { id: 'sys.x', value: 4, prev: 10, by: -6 });
    assert.throws(() => flags.set(w, 'sys.x', Infinity), TypeError);
  });

  it('nextUid draws c1, c2, ... from sys.uid', () => {
    const w = world();
    assert.equal(flags.nextUid(w), 'c1');
    assert.equal(flags.nextUid(w), 'c2');
    assert.equal(w.counters[flags.UID_COUNTER], 2);
    w.counters[flags.UID_COUNTER] = 41;
    assert.equal(flags.nextUid(w), 'c42');
  });
});

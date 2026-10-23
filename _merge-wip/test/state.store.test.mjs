// Unit tests for js/state/store.js. Run: node --test test/state.store.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, StrictWriteError } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createBus } from '../js/core/events.js';

const world = () => createNewWorld({ seedCode: 'STORE-TEST' });

describe('createStore', () => {
  it('exposes the world, a bus and the derived table', () => {
    const w = world();
    const s = createStore(w);
    assert.equal(s.world, w);
    assert.equal(s.raw(), w);
    assert.equal(typeof s.bus.emit, 'function');
    assert.ok(s.derived instanceof Map);
    assert.equal(s.dirty(), false);
    assert.equal(s.strict, false);
    assert.equal(s.inTx(), false);
  });

  it('shares a bus passed in', () => {
    const bus = createBus();
    const s = createStore(world(), { bus });
    assert.equal(s.bus, bus);
  });

  it('rejects a non-object world', () => {
    assert.throws(() => createStore(null), TypeError);
    assert.throws(() => createStore('w'), TypeError);
  });
});

describe('tx', () => {
  it('runs fn with the world, returns its value, marks dirty and emits tx once', () => {
    const s = createStore(world());
    const events = [];
    s.bus.on('tx', (p) => events.push(p));
    const out = s.tx('wallet.earn', (w) => { w.wallet.main += 10; return w.wallet.main; });
    assert.equal(out, 10);
    assert.equal(s.world.wallet.main, 10);
    assert.equal(s.dirty(), true);
    assert.deepEqual(events, [{ label: 'wallet.earn' }]);
    s.clean();
    assert.equal(s.dirty(), false);
  });

  it('collapses nested transactions into the outer one', () => {
    const s = createStore(world());
    const events = [];
    s.bus.on('tx', (p) => events.push(p.label));
    s.tx('outer', (w) => {
      assert.equal(s.inTx(), true);
      s.tx('inner', (w2) => {
        assert.equal(w2, w);
        s.tx('innermost', () => { w.wallet.main = 3; });
      });
      assert.equal(events.length, 0, 'inner tx did not emit');
    });
    assert.deepEqual(events, ['outer']);
    assert.equal(s.inTx(), false);
  });

  it('propagates exceptions, still marks dirty and leaves the tx depth balanced', () => {
    const s = createStore(world(), { strict: true });
    assert.throws(() => s.tx('boom', (w) => { w.wallet.main = 1; throw new Error('boom'); }), /boom/);
    assert.equal(s.dirty(), true);
    assert.equal(s.inTx(), false);
    assert.throws(() => { s.world.wallet.main = 2; }, StrictWriteError, 'guard is back on after a throw');
  });

  it('validates its arguments', () => {
    const s = createStore(world());
    assert.throws(() => s.tx('', () => {}), TypeError);
    assert.throws(() => s.tx('x', null), TypeError);
  });
});

describe('strict write guard', () => {
  it('throws on any write outside a tx, at any depth, and allows it inside', () => {
    const s = createStore(world(), { strict: true });
    assert.equal(s.strict, true);
    assert.throws(() => { s.world.wallet.main = 5; }, StrictWriteError);
    assert.throws(() => { s.world.party.push({}); }, StrictWriteError);
    assert.throws(() => { s.world.bag.pockets.items.push({ id: 'x', n: 1 }); }, StrictWriteError);
    assert.throws(() => { delete s.world.flags['sp.x']; }, StrictWriteError);
    assert.throws(() => { s.world.flags['sp.x'] = true; }, (e) => e instanceof StrictWriteError && e.path === 'flags.sp.x');
    assert.throws(() => { Object.defineProperty(s.world.wallet, 'main', { value: 1 }); }, StrictWriteError);
    assert.throws(() => { s.world.log.splice(0, 0, 'a'); }, StrictWriteError);
    assert.equal(s.raw().wallet.main, 0, 'nothing leaked through');
    s.tx('ok', (w) => {
      w.wallet.main = 5;
      w.party.push({ uid: 'c1' });
      w.bag.pockets.items.push({ id: 'x', n: 1 });
      w.flags['sp.x'] = true;
      delete w.flags['sp.x'];
      w.log.unshift('a');
    });
    assert.equal(s.raw().wallet.main, 5);
    assert.equal(s.raw().party.length, 1);
    assert.deepEqual(s.raw().log, ['a']);
  });

  it('reads freely and keeps proxy identity stable', () => {
    const s = createStore(world(), { strict: true });
    assert.equal(s.world.wallet, s.world.wallet);
    assert.equal(s.world.wallet.main, 0);
    assert.equal(JSON.stringify(s.world.wallet), '{"main":0,"starsalt":0,"anchors":0,"purse":0}');
    assert.deepEqual(Object.keys(s.world.letters), ['delivered', 'read', 'today']);
    assert.equal(Array.isArray(s.world.party), true);
    assert.notEqual(s.world, s.raw(), 'exposed world is the proxy');
  });

  it('is off by default', () => {
    const s = createStore(world());
    s.world.wallet.main = 9;
    assert.equal(s.raw().wallet.main, 9);
  });

  it('stays attached after replace', () => {
    const s = createStore(world(), { strict: true });
    const next = world();
    s.replace(next);
    assert.throws(() => { s.world.wallet.main = 1; }, StrictWriteError);
    assert.equal(s.raw(), next);
  });
});

describe('replace and derived', () => {
  it('swaps the world, clears derived, resets dirty and emits world:replaced', () => {
    const s = createStore(world());
    s.derived.set('path', [1, 2]);
    s.tx('x', (w) => { w.wallet.main = 1; });
    const replaced = [];
    s.bus.on('world:replaced', (p) => replaced.push(p.world));
    const next = world();
    s.replace(next);
    assert.equal(s.world, next);
    assert.equal(s.derived.size, 0);
    assert.equal(s.dirty(), false);
    assert.deepEqual(replaced, [next]);
    assert.throws(() => s.replace(null), TypeError);
  });

  it('clears derived on map:enter', () => {
    const s = createStore(world());
    s.derived.set('chunks', 1);
    s.bus.emit('map:enter', { mapId: 'harbor' });
    assert.equal(s.derived.size, 0);
  });
});

describe('snapshot', () => {
  it('returns an independent deep copy of the raw world', () => {
    const s = createStore(world(), { strict: true });
    const snap = s.snapshot();
    assert.deepEqual(snap, s.raw());
    assert.notEqual(snap, s.raw());
    snap.wallet.main = 99;
    assert.equal(s.raw().wallet.main, 0);
    assert.doesNotThrow(() => { snap.party.push({}); }, 'the snapshot is not guarded');
  });

  it('runs snapshot hooks with the guard suspended, without marking dirty or emitting tx', () => {
    const s = createStore(world(), { strict: true });
    const txEvents = [];
    s.bus.on('tx', (p) => txEvents.push(p));
    const seen = [];
    const off = s.onSnapshot((w) => { seen.push(w); w.rng.loot = [1, 2, 3, 4]; });
    const snap = s.snapshot();
    assert.equal(seen.length, 1);
    assert.equal(seen[0], s.raw(), 'hooks get the raw world');
    assert.deepEqual(snap.rng, { loot: [1, 2, 3, 4] });
    assert.equal(s.dirty(), false);
    assert.equal(txEvents.length, 0);
    off();
    s.snapshot();
    assert.equal(seen.length, 1, 'unsubscribed');
    assert.throws(() => s.onSnapshot(1), TypeError);
  });
});

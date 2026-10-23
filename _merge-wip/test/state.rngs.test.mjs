// Unit tests for js/state/rngs.js. Run: node --test test/state.rngs.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRngs, forkFor } from '../js/state/rngs.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { makeRng } from '../js/core/rng.js';

const setup = (seedCode = 'RNG-TEST', opts) => {
  const store = createStore(createNewWorld({ seedCode }), opts);
  return { store, rngs: createRngs(store) };
};
const draws = (rng, n) => Array.from({ length: n }, () => rng.int(0, 1_000_000));

describe('forkFor', () => {
  it('derives a stable fork from seed + label', () => {
    assert.deepEqual(draws(forkFor(7, 'a'), 5), draws(forkFor(7, 'a'), 5));
    assert.notDeepEqual(draws(forkFor(7, 'a'), 5), draws(forkFor(7, 'b'), 5));
    assert.notDeepEqual(draws(forkFor(7, 'a'), 5), draws(forkFor(8, 'a'), 5));
    assert.equal(forkFor(7, 'a').seed, makeRng(7).fork('a').seed);
  });
});

describe('stateless forks', () => {
  it('fresh() restarts the stream on every call', () => {
    const { rngs } = setup();
    const a = draws(rngs.fresh('weather:3'), 4);
    assert.deepEqual(draws(rngs.fresh('weather:3'), 4), a);
    assert.notDeepEqual(draws(rngs.fresh('weather:4'), 4), a);
  });

  it('day / dayFork, creature and battle are labelled fresh forks', () => {
    const { rngs, store } = setup();
    assert.deepEqual(draws(rngs.day('weather', 3), 3), draws(rngs.fresh('weather:3'), 3));
    assert.equal(rngs.dayFork, rngs.day);
    assert.deepEqual(draws(rngs.creature('c7'), 3), draws(rngs.fresh('shift:c7'), 3));
    assert.deepEqual(draws(rngs.battle(), 3), draws(rngs.fresh('battle:0'), 3));
    store.world.stats.battles = 5;
    assert.deepEqual(draws(rngs.battle(), 3), draws(rngs.fresh('battle:5'), 3));
    assert.deepEqual(draws(rngs.battle({ stats: { battles: 2 } }), 3), draws(rngs.fresh('battle:2'), 3));
  });

  it('a creature stream positioned by shiftCount reproduces the next card after a reload', () => {
    const { rngs } = setup();
    const first = rngs.creature('c1');
    const consumed = draws(first, 3); // three Forecasts already resolved
    const next = first.int(0, 1_000_000);
    const reloaded = rngs.creature('c1');
    draws(reloaded, consumed.length); // forecast.shiftStream skips c.shiftCount draws
    assert.equal(reloaded.int(0, 1_000_000), next);
  });

  it('are never written to world.rng', () => {
    const { rngs, store } = setup();
    rngs.fresh('x').next();
    rngs.day('shop', 1).next();
    rngs.commit();
    assert.deepEqual(store.world.rng, {});
  });

  it('validates labels', () => {
    const { rngs } = setup();
    assert.throws(() => rngs.fresh(''), TypeError);
    assert.throws(() => rngs.stream(3), TypeError);
    assert.throws(() => rngs.day('', 1), TypeError);
    assert.throws(() => rngs.day('w', 1.5), TypeError);
    assert.throws(() => rngs.creature(''), TypeError);
    assert.throws(() => rngs.battle({}), TypeError);
  });
});

describe('stateful streams', () => {
  it('stream() keeps advancing across calls and is cached per label', () => {
    const { rngs } = setup();
    const a = rngs.stream('loot');
    assert.equal(rngs.stream('loot'), a);
    const seq = draws(a, 3).concat(draws(rngs.stream('loot'), 3));
    assert.deepEqual(seq, draws(rngs.fresh('loot'), 6), 'the stream is the fork, consumed continuously');
    assert.deepEqual(rngs.labels(), ['loot']);
  });

  it('commit writes every cached stream state into world.rng and snapshot() does it automatically', () => {
    const { rngs, store } = setup();
    draws(rngs.stream('loot'), 2);
    draws(rngs.stream('enc:harbor'), 1);
    rngs.commit();
    assert.deepEqual(Object.keys(store.world.rng).sort(), ['enc:harbor', 'loot']);
    assert.deepEqual(store.world.rng.loot, rngs.stream('loot').state());
    draws(rngs.stream('loot'), 1);
    const snap = store.snapshot();
    assert.deepEqual(snap.rng.loot, rngs.stream('loot').state(), 'snapshot committed the newer position');
    assert.deepEqual(store.world.rng.loot, snap.rng.loot);
  });

  it('commit works under the strict guard (through snapshot) and on an explicit world', () => {
    const { rngs, store } = setup('RNG-TEST', { strict: true });
    draws(rngs.stream('loot'), 2);
    assert.doesNotThrow(() => store.snapshot());
    const other = { rng: null };
    rngs.commit(other);
    assert.deepEqual(Object.keys(other.rng), ['loot']);
    assert.throws(() => rngs.commit(null), TypeError);
  });

  it('continues from the saved position after save / restore while stateless forks replay', () => {
    const { rngs, store } = setup();
    const loot = rngs.stream('loot');
    draws(loot, 10);
    const saved = store.snapshot(); // what persist writes
    const expectedNext = draws(rngs.stream('loot'), 5); // what play would have produced next

    // "Reload": a new store + registry over the saved world.
    const store2 = createStore(structuredClone(saved));
    const rngs2 = createRngs(store2);
    assert.deepEqual(draws(rngs2.stream('loot'), 5), expectedNext, 'stateful: resumed, not replayed');
    assert.deepEqual(draws(rngs2.fresh('weather:1'), 5), draws(rngs.fresh('weather:1'), 5), 'stateless: identical from the start');
    assert.deepEqual(draws(rngs2.stream('fish:r1'), 3), draws(rngs.fresh('fish:r1'), 3), 'an unsaved stream starts fresh');
  });

  it('falls back to a fresh fork when the saved state is corrupt', () => {
    const { store, rngs } = setup();
    store.world.rng.loot = [0, 0, 0, 0];
    assert.deepEqual(draws(rngs.stream('loot'), 3), draws(rngs.fresh('loot'), 3));
    store.world.rng.other = 'junk';
    assert.deepEqual(draws(rngs.stream('other'), 3), draws(rngs.fresh('other'), 3));
  });

  it('resets its cache on world:replaced and re-seeds from the new run', () => {
    const { store, rngs } = setup('RNG-TEST');
    const before = draws(rngs.stream('loot'), 3);
    const otherWorld = createNewWorld({ seedCode: 'OTHER-SEED' });
    store.replace(otherWorld);
    assert.deepEqual(rngs.labels(), []);
    assert.equal(rngs.seed(), otherWorld.run.seed);
    const after = draws(rngs.stream('loot'), 3);
    assert.notDeepEqual(after, before);
    assert.deepEqual(after, draws(forkFor(otherWorld.run.seed, 'loot'), 3));
    rngs.reset();
    assert.deepEqual(rngs.labels(), []);
  });

  it('drops the cache if the seed changes under it', () => {
    const { store, rngs } = setup();
    draws(rngs.stream('loot'), 3);
    store.world.run.seed = 99;
    assert.deepEqual(draws(rngs.stream('loot'), 3), draws(forkFor(99, 'loot'), 3));
  });

  it('two seeds diverge, one seed repeats', () => {
    const a = setup('SEED-A').rngs;
    const b = setup('SEED-B').rngs;
    const a2 = setup('SEED-A').rngs;
    assert.notDeepEqual(draws(a.stream('enc:harbor'), 8), draws(b.stream('enc:harbor'), 8));
    assert.deepEqual(draws(a.fresh('mail:2'), 8), draws(a2.fresh('mail:2'), 8));
  });

  it('refuses a store without a valid seed', () => {
    assert.throws(() => createRngs(null), TypeError);
    const store = createStore({ run: { seed: -1 } });
    const rngs = createRngs(store);
    assert.throws(() => rngs.fresh('x'), TypeError);
  });
});

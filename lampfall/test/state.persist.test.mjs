// Unit tests for js/state/persist.js. Run: node --test test/state.persist.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPersist, summarize, wantsNoRewind, sceneTransitioning, sceneOnStack, AUTOSAVE_TRIGGERS, DEFAULT_ROUTE_AUTOSAVE_MS, RETRY_MS, PERSIST_ERRORS, CLEAN_EXIT_KEY,
} from '../js/state/persist.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createNewWorld, SCHEMA_VERSION } from '../js/state/schema.js';
import { createMemoryStorage, ERROR_CODES } from '../js/core/save.js';
import { createSceneStack } from '../js/core/scene.js';

/** A game context with a store, bus and a fake scene stack. */
function makeG({ seedCode = 'PERSIST-TEST', top = 'overworld', battle = false, transitioning = false, strict = false } = {}) {
  const store = createStore(createNewWorld({ seedCode, lease: { name: 'Pell', mapId: 'harbor' } }), { strict });
  const rngs = createRngs(store);
  const scenes = {
    topName: top,
    battle,
    transitioning,
    top: () => ({ name: scenes.topName }),
    has: (name) => (name === 'battle' ? scenes.battle : false),
    isTransitioning: () => scenes.transitioning,
  };
  const events = [];
  store.bus.on('save:ok', (p) => events.push(['ok', p]));
  store.bus.on('save:fail', (p) => events.push(['fail', p]));
  return { store, bus: store.bus, rngs, scenes, events, get world() { return store.world; } };
}

let clock = 1_000_000;
const now = () => (clock += 1000);
const make = (over = {}) => createPersist({ storage: new Map(), prefix: 'GAME.', now, ...over });

describe('createPersist', () => {
  it('validates options and exposes identity', () => {
    assert.throws(() => createPersist(), TypeError);
    assert.throws(() => createPersist({}), TypeError);
    assert.throws(() => createPersist({ prefix: 'x.', routeAutosaveMs: 0 }), TypeError);
    const p = make();
    assert.equal(p.prefix, 'GAME.');
    assert.equal(p.version, SCHEMA_VERSION);
    assert.equal(p.summarize, summarize);
    assert.equal(p.system().version, SCHEMA_VERSION);
  });

  it('accepts a Map, a StorageLike, or nothing', () => {
    assert.doesNotThrow(() => createPersist({ storage: new Map(), prefix: 'a.' }));
    assert.doesNotThrow(() => createPersist({ storage: createMemoryStorage(), prefix: 'a.' }));
    assert.doesNotThrow(() => createPersist({ storage: null, prefix: 'a.' }));
    assert.doesNotThrow(() => createPersist({ prefix: 'a.' }));
  });
});

describe('autosave / saveManual / load', () => {
  it('writes a validated snapshot, cleans the store, emits save:ok and reloads deep-equal', () => {
    const G = makeG();
    const p = make();
    G.store.tx('earn', (w) => { w.wallet.main = 50; });
    G.rngs.stream('loot').next();
    const res = p.autosave(G, 'map:enter');
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.slot, 'auto:1');
    assert.equal(res.place, 'harbor');
    assert.equal(res.time, '17:40'); // a new run starts at the arrival (GDD-00 §12)
    assert.equal(res.day, 0);
    assert.equal(res.reason, 'map:enter');
    assert.equal(G.store.dirty(), false);
    assert.equal(G.events.length, 1);
    assert.equal(G.events[0][0], 'ok');
    assert.equal(G.events[0][1].slot, 'auto:1');
    const loaded = p.load('auto:1');
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.world, G.store.snapshot());
    assert.deepEqual(Object.keys(loaded.world.rng), ['loot'], 'rngs committed before the write');
    assert.equal(loaded.meta.migratedFrom, null);
    assert.equal(loaded.slot, 'auto:1');
    assert.deepEqual(p.status(), { failed: false, lastError: null, retryPending: false, lastOk: res });
  });

  it('rotates through three autosave slots and supports manual slots, list, latest, remove', () => {
    const G = makeG();
    const p = make();
    const slots = [1, 2, 3, 4].map(() => { G.store.tx('x', (w) => { w.stats.steps++; }); return p.autosave(G, 'route').slot; });
    assert.deepEqual(slots, ['auto:1', 'auto:2', 'auto:3', 'auto:1']);
    const m = p.saveManual(G, 2);
    assert.equal(m.ok, true);
    assert.equal(m.slot, 'manual:2');
    assert.equal(p.latest().slot, 'manual:2');
    assert.deepEqual(p.list().map((e) => e.slot).sort(), ['auto:1', 'auto:2', 'auto:3', 'manual:2']);
    assert.equal(p.list({ all: true }).length, 6);
    assert.equal(p.list()[0].summary.name, 'Pell');
    assert.equal(p.remove('manual:2'), true);
    assert.equal(p.load('manual:2').error.code, ERROR_CODES.EMPTY);
    assert.equal(p.remove('manual:9'), false);
    const bad = p.saveManual(G, 'manual:9');
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, ERROR_CODES.INVALID_SLOT);
    assert.equal(p.status().retryPending, false, 'an invalid slot is not retried');
  });

  it('refuses to write an invalid world and does not retry', () => {
    const G = makeG();
    const p = make();
    G.store.tx('corrupt', (w) => { w.wallet.main = -1; w.party.push({ uid: 'x' }); });
    const res = p.autosave(G, 'test');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, PERSIST_ERRORS.INVALID_WORLD);
    assert.ok(res.error.problems.length >= 2);
    assert.match(res.error.message, /refusing to save/);
    assert.equal(p.list().length, 0, 'nothing written');
    assert.equal(G.store.dirty(), true);
    assert.equal(G.events[0][0], 'fail');
    assert.equal(G.events[0][1].willRetry, false);
    assert.equal(p.status().failed, true);
    assert.equal(p.status().retryPending, false);
  });

  it('refuses while busy and without a store', () => {
    const G = makeG({ transitioning: true });
    const p = make();
    assert.equal(p.autosave(G, 't').error.code, PERSIST_ERRORS.BUSY);
    G.scenes.transitioning = false;
    G.scenes.battle = true;
    assert.equal(p.autosave(G, 't').error.code, PERSIST_ERRORS.BUSY);
    assert.equal(p.autosave(null, 't').error.code, PERSIST_ERRORS.NO_STORE);
    assert.equal(p.autosave({}, 't').error.code, PERSIST_ERRORS.NO_STORE);
    assert.equal(p.list().length, 0);
  });

  it('takes the real core/scene SceneStack as G.scenes (isTransitioning getter, find by name)', () => {
    const G = makeG();
    const stack = createSceneStack({ width: 480, height: 270 });
    G.scenes = stack;
    const p = make();
    stack.push({ name: 'overworld' });
    assert.equal(sceneTransitioning(stack), false);
    assert.equal(sceneOnStack(stack, 'battle'), false);
    assert.equal(p.autosave(G, 't').ok, true);
    stack.push({ name: 'battle' });
    assert.equal(sceneOnStack(stack, 'battle'), true, 'core has(scene) takes an object; persist must use find(name)');
    assert.equal(p.autosave(G, 't').error.code, PERSIST_ERRORS.BUSY);
    stack.pop();
    stack.transition('fade', 400, () => {});
    assert.equal(sceneTransitioning(stack), true);
    assert.equal(p.autosave(G, 't').error.code, PERSIST_ERRORS.BUSY);
    assert.equal(sceneTransitioning(null), false);
    assert.equal(sceneOnStack({ has: (n) => n === 'x' }, 'x'), true, 'test doubles with has(name) still work');
  });

  it('works under the strict guard (snapshot hooks write rng without a tx)', () => {
    const G = makeG({ strict: true });
    const p = make();
    G.rngs.stream('loot').next();
    assert.equal(p.autosave(G, 't').ok, true);
  });

  it('heals a thin record on load and rejects a wrong-typed one', () => {
    const p = make();
    const thin = { v: SCHEMA_VERSION, player: { name: 'Thin', mapId: 'harbor' }, wallet: { main: 3 } };
    assert.equal(p.system().save('manual:1', thin).ok, true);
    const ok = p.load('manual:1');
    assert.equal(ok.ok, true, JSON.stringify(ok.error));
    assert.equal(ok.world.player.name, 'Thin');
    assert.equal(ok.world.wallet.purse, 0);
    assert.equal(p.system().save('manual:2', { v: SCHEMA_VERSION, wallet: { main: 'rich' } }).ok, true);
    const bad = p.load('manual:2');
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, PERSIST_ERRORS.INVALID_WORLD);
    assert.ok(bad.error.problems.some((s) => s.startsWith('world.wallet.main')));
    assert.equal(p.load('nope').error.code, ERROR_CODES.INVALID_SLOT);
  });

  it('migrates a legacy record on load', () => {
    const p = make();
    const legacySys = createPersist({ storage: new Map(), prefix: 'GAME.', version: 0, migrations: {}, now }).system();
    const storage = new Map();
    const legacy = createPersist({ storage, prefix: 'GAME.', version: 0, migrations: {}, now });
    assert.equal(legacy.system().save('manual:1', { player: { name: 'Old' } }).ok, true);
    assert.equal(legacySys.version, 0);
    const current = createPersist({ storage, prefix: 'GAME.', now });
    const res = current.load('manual:1');
    assert.equal(res.ok, true, JSON.stringify(res.error));
    assert.equal(res.meta.migratedFrom, 0);
    assert.equal(res.world.v, SCHEMA_VERSION);
    assert.equal(res.world.player.name, 'Old');
    assert.equal(p.load('manual:1').error.code, ERROR_CODES.EMPTY, 'separate storage untouched');
  });
});

describe('verified-write failure path', () => {
  /** Storage whose writes fail `failures` times, then work. */
  function flakyStorage(failures, error = new Error('disk on fire')) {
    const inner = createMemoryStorage();
    let left = failures;
    return {
      writes: 0,
      getItem: (k) => inner.getItem(k),
      removeItem: (k) => inner.removeItem(k),
      setItem(k, v) {
        this.writes++;
        if (k.endsWith(CLEAN_EXIT_KEY)) return inner.setItem(k, v);
        if (left > 0) { left--; throw error; }
        inner.setItem(k, v);
      },
    };
  }

  it('returns a structured error, emits save:fail, retries once after RETRY_MS, then stops', () => {
    const G = makeG();
    const storage = flakyStorage(Infinity);
    const p = createPersist({ storage, prefix: 'GAME.', now });
    G.store.tx('x', (w) => { w.stats.steps = 1; });
    const res = p.autosave(G, 'capture:ok');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, ERROR_CODES.STORAGE);
    assert.equal(res.slot, 'auto:1');
    assert.equal(res.place, 'harbor');
    assert.equal(G.store.dirty(), true, 'a failed save leaves the store dirty');
    assert.deepEqual(G.events.map((e) => e[0]), ['fail']);
    assert.equal(G.events[0][1].willRetry, true);
    assert.equal(p.status().retryPending, true);
    const writesBefore = storage.writes;
    p.tick(G, RETRY_MS - 1);
    assert.equal(storage.writes, writesBefore, 'not yet');
    p.tick(G, 1);
    assert.ok(storage.writes > writesBefore, 'retried');
    assert.deepEqual(G.events.map((e) => e[0]), ['fail', 'fail']);
    assert.equal(G.events[1][1].willRetry, false, 'only one retry');
    assert.equal(p.status().retryPending, false);
    assert.equal(p.status().failed, true);
    p.tick(G, RETRY_MS * 5);
    assert.equal(G.events.length, 2);
  });

  it('a retry that succeeds clears the failure banner', () => {
    const G = makeG();
    const storage = flakyStorage(1);
    const p = createPersist({ storage, prefix: 'GAME.', now });
    G.store.tx('x', (w) => { w.stats.steps = 1; });
    assert.equal(p.autosave(G, 'day:start').ok, false);
    p.tick(G, RETRY_MS);
    assert.deepEqual(G.events.map((e) => e[0]), ['fail', 'ok']);
    assert.equal(G.events[1][1].reason, 'day:start');
    assert.equal(p.status().failed, false);
    assert.equal(G.store.dirty(), false);
    assert.equal(p.load('auto:1').ok, true);
  });

  it('a storage that lies on read-back yields a verify error', () => {
    const G = makeG();
    const inner = createMemoryStorage();
    const liar = {
      getItem: (k) => (k.endsWith(CLEAN_EXIT_KEY) ? inner.getItem(k) : (inner.getItem(k) === null ? null : 'garbage')),
      setItem: (k, v) => inner.setItem(k, v),
      removeItem: (k) => inner.removeItem(k),
    };
    const p = createPersist({ storage: liar, prefix: 'GAME.', now });
    const res = p.autosave(G, 't');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, ERROR_CODES.VERIFY);
  });

  it('never throws, even when the world, the bus or the storage misbehave', () => {
    const G = makeG();
    G.store.bus.on('save:ok', () => { throw new Error('listener boom'); });
    const p = createPersist({ storage: { getItem() { throw new Error('r'); }, setItem() { throw new Error('w'); }, removeItem() { throw new Error('d'); } }, prefix: 'GAME.', now });
    assert.doesNotThrow(() => p.autosave(G, 't'));
    assert.doesNotThrow(() => p.load('auto:1'));
    assert.deepEqual(p.list(), []);
    assert.equal(p.latest(), null);
    assert.equal(p.exportString('auto:1'), null);
    assert.equal(p.remove('auto:1'), false);
    assert.doesNotThrow(() => p.tick(G, 16));
    assert.doesNotThrow(() => p.tick(null, 16));
    assert.doesNotThrow(() => p.tick(G, NaN));
    assert.equal(p.markBoot(), false);
    assert.equal(p.crashed(), false);
    const G2 = makeG();
    const p2 = make();
    G2.store.snapshot = () => { throw new Error('clone failed'); };
    const res = p2.autosave(G2, 't');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, PERSIST_ERRORS.EXCEPTION);
    assert.match(res.error.message, /clone failed/);
  });
});

describe('export / import strings', () => {
  it('round-trips a world through a string, optionally into a slot', () => {
    const G = makeG();
    const p = make();
    G.store.tx('x', (w) => { w.wallet.main = 77; });
    assert.equal(p.saveManual(G, 1).ok, true);
    const str = p.exportString('manual:1');
    assert.equal(typeof str, 'string');
    assert.match(str, /^[A-Za-z0-9+/=]+$/);
    const imp = p.importString(str);
    assert.equal(imp.ok, true, JSON.stringify(imp.error));
    assert.deepEqual(imp.world, G.store.snapshot());
    assert.equal(imp.saved, undefined);
    assert.equal(p.list().length, 1, 'plain import writes nothing');
    const into = p.importString(str, { slot: 'manual:3' });
    assert.equal(into.ok, true);
    assert.equal(into.slot, 'manual:3');
    assert.equal(into.saved.ok, true);
    assert.equal(into.saved.reason, 'import');
    assert.deepEqual(p.load('manual:3').world, imp.world);
    assert.equal(p.exportString('manual:2'), null);
  });

  it('rejects garbage and tampered strings with structured errors', () => {
    const p = make();
    assert.equal(p.importString('not base64!!').error.code, ERROR_CODES.FORMAT);
    assert.equal(p.importString(Buffer.from('WSAVE1 nope').toString('base64')).ok, false);
    assert.doesNotThrow(() => p.importString(null));
    assert.equal(p.importString(null).ok, false);
    const other = make();
    assert.equal(other.system().save('manual:1', { v: SCHEMA_VERSION, wallet: { main: 'rich' } }).ok, true);
    const bad = p.importString(other.exportString('manual:1'));
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, PERSIST_ERRORS.INVALID_WORLD);
  });
});

describe('route timer and triggers', () => {
  it('autosaves after routeAutosaveMs of dirty overworld time only', () => {
    const G = makeG();
    const p = make({ routeAutosaveMs: 1000 });
    p.tick(G, 5000);
    assert.equal(p.list().length, 0, 'clean store: no save');
    G.store.tx('x', (w) => { w.stats.steps = 1; });
    G.scenes.topName = 'menu';
    p.tick(G, 5000);
    assert.equal(p.list().length, 0, 'menu on top: no save');
    G.scenes.topName = 'overworld';
    G.store.tx('x', (w) => { w.cutscene = { scriptId: 's', state: { pc: [0], vars: {}, callStack: [] } }; });
    p.tick(G, 5000);
    assert.equal(p.list().length, 0, 'cutscene running: no save');
    G.store.tx('x', (w) => { w.cutscene = null; });
    p.tick(G, 600);
    assert.equal(p.list().length, 0);
    p.tick(G, 400);
    assert.equal(p.list().length, 1);
    assert.equal(G.events.at(-1)[1].reason, 'route');
    assert.equal(G.store.dirty(), false);
    p.tick(G, 5000);
    assert.equal(p.list().length, 1, 'clean again');
    assert.equal(DEFAULT_ROUTE_AUTOSAVE_MS > 0, true);
  });

  it('a successful save resets the route accumulator', () => {
    const G = makeG();
    const p = make({ routeAutosaveMs: 1000 });
    G.store.tx('x', (w) => { w.stats.steps = 1; });
    p.tick(G, 900);
    p.autosave(G, 'map:enter');
    G.store.tx('x', (w) => { w.stats.steps = 2; });
    p.tick(G, 200);
    assert.equal(p.list().length, 1, 'accumulator restarted at the save');
    p.tick(G, 800);
    assert.equal(p.list().length, 2);
  });

  it('attach() autosaves on the trigger events and detaches cleanly', () => {
    const G = makeG();
    const p = make();
    const detach = p.attach(G);
    assert.deepEqual([...AUTOSAVE_TRIGGERS], ['map:enter', 'waystone:use', 'battle:start:story', 'capture:ok', 'shift:resolved', 'loan:paid', 'letter:read', 'day:start']);
    G.bus.emit('map:enter', { mapId: 'harbor' });
    assert.equal(G.events.length, 1);
    assert.equal(G.events[0][1].reason, 'map:enter');
    G.bus.emit('battle:start', { kind: 'wild' });
    assert.equal(G.events.length, 1, 'wild battles do not autosave');
    G.bus.emit('battle:start', { kind: 'story', trainerId: 't1' });
    assert.equal(G.events.length, 2);
    assert.equal(G.events[1][1].reason, 'battle:start:story');
    G.bus.emit('battle:start', { story: true });
    assert.equal(G.events.length, 3);
    for (const evt of ['waystone:use', 'capture:ok', 'shift:resolved', 'loan:paid', 'letter:read', 'day:start']) G.bus.emit(evt, {});
    assert.equal(G.events.length, 9);
    detach();
    G.bus.emit('map:enter', {});
    assert.equal(G.events.length, 9);
    assert.doesNotThrow(() => p.attach(null)());
  });
});

describe('crash marker', () => {
  it('reports a crash when the previous session never wrote a clean exit', () => {
    const storage = new Map();
    const first = createPersist({ storage, prefix: 'GAME.', now });
    assert.equal(first.crashed(), false, 'first ever boot');
    assert.equal(first.markBoot(), true);
    assert.equal(storage.get('GAME.cleanExit'), '0');
    const afterCrash = createPersist({ storage, prefix: 'GAME.', now });
    assert.equal(afterCrash.crashed(), true);
    afterCrash.markBoot();
    assert.equal(afterCrash.markCleanExit(), true);
    assert.equal(storage.get('GAME.cleanExit'), '1');
    const afterClean = createPersist({ storage, prefix: 'GAME.', now });
    assert.equal(afterClean.crashed(), false);
  });

  it('exposes the same operations as crashMarker.arm / clear / check (what main.js calls)', () => {
    const storage = new Map();
    const first = createPersist({ storage, prefix: 'GAME.', now });
    assert.equal(first.crashMarker.arm(), false, 'arm returns whether the previous session crashed');
    assert.equal(storage.get('GAME.cleanExit'), '0', 'arm writes the dirty marker');
    const afterCrash = createPersist({ storage, prefix: 'GAME.', now });
    assert.equal(afterCrash.crashMarker.check(), true);
    assert.equal(afterCrash.crashMarker.arm(), true);
    assert.equal(afterCrash.crashMarker.clear(), true);
    assert.equal(storage.get('GAME.cleanExit'), '1');
    assert.equal(createPersist({ storage, prefix: 'GAME.', now }).crashMarker.check(), false);
  });

  it('marker operations never throw on a broken storage', () => {
    const broken = { getItem() { throw new Error('nope'); }, setItem() { throw new Error('nope'); }, removeItem() { throw new Error('nope'); } };
    const p = createPersist({ storage: broken, prefix: 'GAME.', now });
    assert.equal(p.crashed(), false);
    assert.equal(p.markBoot(), false);
    assert.equal(p.markCleanExit(), false);
    assert.equal(p.crashMarker.arm(), false);
    assert.equal(p.crashMarker.clear(), false);
  });
});

describe('No Rewind', () => {
  it('limits slots to one autosave and no manual saves', () => {
    const G = makeG();
    const p = make({ noRewind: true });
    assert.equal(p.saveManual(G, 1).error.code, ERROR_CODES.INVALID_SLOT);
    for (let i = 0; i < 3; i++) { G.store.tx('x', (w) => { w.stats.steps++; }); assert.equal(p.autosave(G, 'x').slot, 'auto:1'); }
    assert.equal(p.list({ all: true }).length, 1);
    p.setNoRewind(false);
    assert.equal(p.saveManual(G, 1).ok, true);
    assert.equal(p.list().length, 2, 'the earlier auto:1 is still there on the same storage');
    p.setNoRewind(true);
    assert.equal(p.list({ all: true }).length, 1);
  });

  it('wantsNoRewind reads the run challenges', () => {
    assert.equal(wantsNoRewind(createNewWorld({ seedCode: 'x' })), false);
    assert.equal(wantsNoRewind(createNewWorld({ seedCode: 'x', challenges: ['no-rewind'] })), true);
  });
});

describe('summarize', () => {
  it('derives the menu summary from the world', () => {
    const w = createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F', lease: { name: 'Pell', mapId: 'harbor' } });
    w.party.push({ nickname: 'Slosh' });
    w.badges.push('spire-1');
    w.stats.playMs = 1234;
    w.loans.tier = 3;
    w.clock.total = 1440 * 4 + 6 * 60 + 5;
    assert.deepEqual(summarize(w), { name: 'Pell', place: 'harbor', day: 4, time: '06:05', tier: 3, badges: 1, playMs: 1234, lead: 'Slosh', seedCode: w.run.seedCode, dial: w.run.dial });
    assert.equal(summarize({}).lead, null);
    assert.equal(summarize(null).name, '');
  });
});

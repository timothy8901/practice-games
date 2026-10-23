import { test } from 'node:test';
import assert from 'node:assert/strict';
import { primaryKeyboardToken, keyInitFor, fallbackGive, fallbackEarn, installDebugHook, LANE_HOOKS, FALLBACK_POCKET } from '../js/debug/hook.js';
import { DEFAULT_BINDINGS } from '../js/core/input.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';

test('hook: primaryKeyboardToken picks the first keyboard code of an action', () => {
  const code = primaryKeyboardToken(DEFAULT_BINDINGS, 'confirm');
  assert.equal(typeof code, 'string');
  assert.ok(/^(Key|Digit|Enter|Space|Escape|Arrow)/.test(code), code);
  assert.equal(primaryKeyboardToken(DEFAULT_BINDINGS, 'no-such-action'), null);
  assert.equal(primaryKeyboardToken({ a: ['gp:0'] }, 'a'), null);
});

test('hook: keyInitFor builds a plausible KeyboardEventInit', () => {
  assert.deepEqual(keyInitFor('KeyZ'), { code: 'KeyZ', key: 'z', bubbles: true, cancelable: true });
  assert.equal(keyInitFor('Digit3').key, '3');
  assert.equal(keyInitFor('Space').key, ' ');
  assert.equal(keyInitFor('ArrowLeft').key, 'ArrowLeft');
});

test('hook: fallbackGive merges stacks and keeps the world valid', () => {
  const w = createNewWorld({ seedCode: 'DRIFT-TEST-0000' });
  assert.equal(fallbackGive(w, 'rope', 2), 2);
  assert.equal(fallbackGive(w, 'rope', 3), 5);
  assert.equal(fallbackGive(w, 'lamp'), 1);
  assert.deepEqual(w.bag.pockets[FALLBACK_POCKET], [{ id: 'rope', n: 5 }, { id: 'lamp', n: 1 }]);
  assert.deepEqual(validateWorld(w), []);
  assert.throws(() => fallbackGive(w, '', 1), TypeError);
});

test('hook: fallbackEarn adds, spends and never goes negative', () => {
  const w = createNewWorld({ seedCode: 'DRIFT-TEST-0000' });
  assert.equal(fallbackEarn(w, 40), 40);
  assert.equal(fallbackEarn(w, -15.9), 25);
  assert.equal(fallbackEarn(w, -100), 0);
  assert.deepEqual(validateWorld(w), []);
  assert.throws(() => fallbackEarn(w, NaN), TypeError);
});

/** A minimal G for the hook: real store, fake scenes/loop/persist. */
function fakeG(world) {
  const store = createStore(world);
  const saves = [];
  return {
    store,
    get world() { return store.world; },
    bus: store.bus,
    scenes: { top: () => ({ name: 'overworld' }), stack: [{ name: 'overworld', opaque: true, debugText: () => 'HUD' }], isTransitioning: false },
    loop: { paused: false, pause() { this.paused = true; }, resume() { this.paused = false; }, step() {} },
    persist: { autosave: (G, reason) => { saves.push({ G, reason }); return { ok: true, slot: 'auto:1', reason }; }, load: () => ({ ok: false }) },
    persistView: { tag: 'view' },
    rngs: { fresh: (label) => ({ label }) },
    data: null,
    perf: { fps: 60 },
    flags: { noanim: false },
    speed: 1,
    tweens: { count: 0 },
    saves,
  };
}

test('hook: mutating hooks go through store.tx and emit domain events', () => {
  const G = fakeG(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }));
  const target = new EventTarget();
  const labels = [];
  const events = [];
  G.bus.on('tx', ({ label }) => labels.push(label));
  G.bus.on('bag:changed', (p) => events.push(['bag', p.n]));
  G.bus.on('wallet:changed', (p) => events.push(['wallet', p.main]));
  const hook = installDebugHook(G, { target, expose: true });
  assert.equal(target.__game, hook);

  hook.give('rope', 2);
  hook.earn(30);
  hook.warp('', 3, 4);
  hook.flag('sys.x', 7);
  assert.deepEqual(labels, ['debug:give', 'debug:earn', 'debug:warp', 'debug:flag']);
  assert.deepEqual(events, [['bag', 2], ['wallet', 30]]);
  assert.deepEqual([G.world.player.x, G.world.player.y, G.world.flags['sys.x']], [3, 4, 7]);
  assert.ok(G.store.dirty());
  assert.deepEqual(hook.validate(), []);
  assert.notEqual(hook.state(), G.world, 'state() is a copy');
  assert.deepEqual(hook.state().wallet, G.world.wallet);

  assert.equal(hook.save('t').ok, true);
  assert.equal(G.saves[0].G, G.persistView, 'persist receives the PersistG view');
  assert.equal(hook.scene(), 'overworld');
  assert.equal(hook.text(), 'HUD');
  assert.deepEqual(hook.rng('loot'), { label: 'loot' });
  hook.uninstall();
  assert.equal(target.__game, undefined);
});

test('hook: lane hooks throw a readable error until bound; bind replaces fallbacks too', () => {
  const G = fakeG(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }));
  const hook = installDebugHook(G, { target: new EventTarget(), expose: false });
  for (const name of Object.keys(LANE_HOOKS)) assert.equal(typeof hook[name], 'function', name);
  assert.throws(() => hook.heal(), /not wired yet \(owner: RULES-CREATURE\)/);
  assert.equal(hook.isBound('give'), false);
  hook.bind('give', (id, n) => `bound:${id}:${n}`);
  assert.equal(hook.isBound('give'), true);
  assert.equal(hook.give('rope', 1), 'bound:rope:1');
  assert.throws(() => hook.bind('earn', 'nope'), TypeError);
});

test('hook: errors[] collects window error and unhandledrejection events', () => {
  const G = fakeG(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }));
  const target = new EventTarget();
  const hook = installDebugHook(G, { target, expose: false });
  target.dispatchEvent(Object.assign(new Event('error'), { error: new Error('boom') }));
  target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('later') }));
  assert.deepEqual(hook.errors.map((e) => e.message), ['boom', 'later']);
  assert.throws(() => installDebugHook(G, { target: {} }), TypeError);
});

test('hook: strict store still clones state()', () => {
  const G = fakeG(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }));
  G.store = createStore(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }), { strict: true });
  G.bus = G.store.bus;
  const hook = installDebugHook(G, { target: new EventTarget(), expose: false });
  hook.earn(5);
  assert.equal(hook.state().wallet.main, 5);
  assert.throws(() => { G.store.world.wallet.main = 9; }, /outside a transaction/);
});

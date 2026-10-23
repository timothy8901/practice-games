import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneFactories, SCENE_NAMES } from '../js/scenes/index.js';
import { createStubScene } from '../js/scenes/stub.js';
import { buildTestMap, passable, cameraFor, MAP_W, MAP_H, TEST_TILES, SPAWN, STUB_MAP_ID } from '../js/scenes/overworld.js';
import { describeSave } from '../js/scenes/title.js';
import { lastSessionCrashed, fadeMs, DEFAULT_LEASE } from '../js/scenes/boot.js';
import { MENU_ITEMS } from '../js/scenes/menu.js';
import { makePersistView } from '../js/main.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { TILE, NATIVE_W, NATIVE_H } from '../js/config.js';

/** Every scene the manifest (ARCHITECTURE-DRAFT §1) names. */
const MANIFEST = ['boot', 'title', 'leaseCard', 'overworld', 'dialogue', 'cutscene', 'battle', 'forecast', 'menu',
  'party', 'box', 'bag', 'fieldLog', 'ledger', 'mapScreen', 'shop', 'letter', 'dayPage', 'fishing', 'settings',
  'saveLoad', 'seedCard', 'ending', 'credits', 'debugOverlay'];

/** Fake input: `pressed` reads from a set, nothing else fires. */
function fakeInput(pressed = []) {
  const set = new Set(pressed);
  return { pressed: (a) => set.has(a), held: () => false, repeat: () => false, axis: () => ({ x: 0, y: 0 }), pointer: { x: 0, y: 0, justDown: false, inside: false } };
}

/** Fake G with a real store and a tiny scene stack. */
function fakeG() {
  const store = createStore(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }));
  const stack = [];
  const G = {
    store,
    get world() { return store.world; },
    bus: store.bus,
    flags: { noanim: true },
    clock: { formatTime: () => '18:40', dateLabel: () => 'Mon', tide: 0.5, tideState: 'rising' },
    entropy: { int: () => 0, next: () => 0 },
    scenes: {
      get size() { return stack.length; },
      pop: (r) => { G.popped = r; stack.pop(); },
      push: (s) => stack.push(s),
      replace: (s) => { stack.pop(); stack.push(s); },
      top: () => stack[stack.length - 1] ?? null,
      find: (n) => stack.find((s) => s.name === n) ?? null,
      isTransitioning: false,
      transition: (kind, ms, fn) => { fn(); return true; },
    },
    push: (name, params) => { const s = sceneFactories[name](G); stack.push(s); s.enter?.(params ?? {}); },
    replaceWith: (name) => { G.replaced = name; },
    stackRef: stack,
  };
  return G;
}

test('scenes/index: every manifest scene has a factory; names are sorted and frozen', () => {
  for (const name of MANIFEST) assert.equal(typeof sceneFactories[name], 'function', name);
  assert.deepEqual([...SCENE_NAMES], [...SCENE_NAMES].sort());
  assert.ok(Object.isFrozen(sceneFactories));
});

test('scenes: every factory builds a scene with the core interface, without a DOM', () => {
  const G = fakeG();
  for (const name of SCENE_NAMES) {
    const s = sceneFactories[name](G);
    assert.equal(s.name, name);
    for (const fn of ['update', 'draw', 'handleInput']) assert.equal(typeof s[fn], 'function', `${name}.${fn}`);
  }
});

test('stub: pops on cancel with a result, or returns to the title when alone', () => {
  const G = fakeG();
  const stub = createStubScene(G, 'bag', { label: 'Bag' });
  G.stackRef.push({ name: 'overworld' }, stub);
  stub.enter({ from: 'menu' });
  stub.handleInput(fakeInput(['confirm']));
  assert.equal(G.stackRef.length, 2, 'confirm does nothing');
  stub.handleInput(fakeInput(['cancel']));
  assert.deepEqual(G.popped, { stub: 'bag' });
  assert.equal(G.stackRef.length, 1);
  G.stackRef.length = 0;
  G.stackRef.push(stub);
  stub.handleInput(fakeInput(['cancel']));
  assert.equal(G.replaced, 'title');
  assert.equal(stub.debugText(), 'Bag (stub)');
});

test('menu: lists the draft order with Save last and pushes by scene name', () => {
  assert.equal(MENU_ITEMS[MENU_ITEMS.length - 1].scene, 'saveLoad');
  assert.deepEqual(MENU_ITEMS.map((m) => m.scene), ['party', 'bag', 'fieldLog', 'mapScreen', 'ledger', 'settings', 'saveLoad']);
  const G = fakeG();
  G.stackRef.push({ name: 'overworld' });
  G.push('menu');
  G.scenes.top().handleInput(fakeInput(['confirm']));
  assert.equal(G.scenes.top().name, 'party');
  G.scenes.top().handleInput(fakeInput(['cancel']));
  assert.equal(G.scenes.top().name, 'menu');
  G.scenes.top().handleInput(fakeInput(['cancel']));
  assert.equal(G.scenes.top().name, 'overworld');
});

test('overworld stub: deterministic 40x24 map, walkable spawn, clamped camera', () => {
  const a = buildTestMap(123);
  const b = buildTestMap(123);
  assert.deepEqual([a.w, a.h, a.tiles.length], [MAP_W, MAP_H, MAP_W * MAP_H]);
  assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
  assert.notDeepEqual(Array.from(buildTestMap(124).tiles), Array.from(a.tiles));
  assert.ok(a.tiles.every((k) => k < TEST_TILES.length));
  assert.ok(passable(a, SPAWN.x, SPAWN.y));
  assert.equal(passable(a, -1, 0), false);
  assert.equal(passable(a, 0, MAP_H), false);
  assert.equal(passable(a, 0, MAP_H - 1), false, 'bottom rows are water');
  assert.deepEqual(cameraFor(0, 0, a), { x: 0, y: 0 });
  const far = cameraFor(MAP_W * TILE, MAP_H * TILE, a);
  assert.deepEqual(far, { x: MAP_W * TILE - NATIVE_W, y: MAP_H * TILE - NATIVE_H });
  assert.equal(typeof STUB_MAP_ID, 'string');
});

test('overworld stub: enter spawns a fresh lease at the crossroads and emits map:enter', () => {
  const G = fakeG();
  const events = [];
  G.bus.on('map:enter', (p) => events.push(p));
  const scene = sceneFactories.overworld(G);
  scene.enter({ fresh: true });
  assert.deepEqual([G.world.player.x, G.world.player.y], [SPAWN.x, SPAWN.y]);
  assert.equal(events.length, 1);
  assert.deepEqual(validateWorld(G.world), []);
});

test('title: describeSave formats place, time and age', () => {
  const now = () => 1_000_000;
  assert.equal(describeSave(null), '');
  assert.equal(describeSave({ state: 'empty' }), '');
  assert.equal(describeSave({ state: 'ok', time: now() - 20_000, summary: { place: 'Harbor', time: '18:40' } }, now), 'Harbor, 18:40, just now');
  assert.equal(describeSave({ state: 'ok', time: now() - 5 * 60_000, summary: { place: 'Harbor', time: '18:40' } }, now), 'Harbor, 18:40, 5 min ago');
  assert.equal(describeSave({ state: 'ok', time: now() - 3 * 3_600_000, summary: {} }, now), '3 h ago');
});

test('boot: crash detection tolerates both persist shapes; DEFAULT_LEASE builds a valid world', () => {
  assert.equal(lastSessionCrashed(null), false);
  assert.equal(lastSessionCrashed({ crashed: () => true }), true);
  assert.equal(lastSessionCrashed({ crashMarker: { check: () => false } }), false);
  assert.equal(fadeMs({ flags: { noanim: true } }), 0);
  assert.equal(fadeMs({ flags: { noanim: false } }, 300), 300);
  const w = createNewWorld({ seedCode: 'DRIFT-TEST-0000', lease: DEFAULT_LEASE });
  assert.equal(w.player.name, DEFAULT_LEASE.name);
  assert.deepEqual(validateWorld(w), []);
});

test('main: makePersistView exposes isTransitioning() and has(name) as functions', () => {
  const store = createStore(createNewWorld({ seedCode: 'DRIFT-TEST-0000' }));
  let transitioning = true;
  const scenes = { top: () => ({ name: 'overworld' }), find: (n) => (n === 'battle' ? {} : null), get isTransitioning() { return transitioning; } };
  const view = makePersistView(store, scenes, { has: () => true });
  assert.equal(view.store, store);
  assert.equal(view.bus, store.bus);
  assert.equal(view.scenes.isTransitioning(), true);
  transitioning = false;
  assert.equal(view.scenes.isTransitioning(), false);
  assert.equal(view.scenes.has('battle'), true);
  assert.equal(view.scenes.has('menu'), false);
  assert.equal(view.scenes.top().name, 'overworld');
});

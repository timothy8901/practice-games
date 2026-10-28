import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneFactories, SCENE_NAMES } from '../js/scenes/index.js';
import { createOverworldScene, ARRIVAL, gateOfTile, resolveVariant } from '../js/scenes/overworld.js';
import { createMapScreenScene } from '../js/scenes/mapScreen.js';
import { describeSave } from '../js/scenes/title.js';
import { lastSessionCrashed, fadeMs, DEFAULT_LEASE, buildRunWorld, newGame } from '../js/scenes/boot.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createClock } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { MAPS } from '../js/data/maps/index.js';
import { ITEMS } from '../js/data/items.js';
import { COLLECTIONS } from '../js/data/collections.js';

const MANIFEST = ['boot', 'title', 'leaseCard', 'overworld', 'dialogue', 'cutscene', 'battle', 'forecast', 'menu', 'party', 'box', 'bag', 'fieldLog', 'ledger', 'mapScreen', 'shop', 'letter', 'dayPage', 'fishing', 'settings', 'saveLoad', 'seedCard', 'ending', 'credits', 'debugOverlay'];
const registry = (scripts = {}) => createRegistry({ ...DATA, maps: MAPS, items: ITEMS, collections: COLLECTIONS, npcs: [], scripts });

function fakeG(data = registry()) {
  const store = createStore(createNewWorld({ seedCode: 'TEST-FIELD' }), { strict: true });
  const clock = createClock(clockSys.optionsFrom(store.world));
  clockSys.restoreFrom(store.world, clock);
  const stack = [], calls = [];
  const G = {
    store, get world() { return store.world; }, bus: store.bus, data, clock, rngs: createRngs(store),
    flags: { noanim: true }, input: { flush() {} }, audio: { sfx() {} },
    toasts: { show: (text) => calls.push(['toast', text]) },
    persist: { latest: () => null }, entropy: { int: () => 0, next: () => 0 }, sceneFactories, calls,
    scenes: {
      get size() { return stack.length; },
      top: () => stack.at(-1) ?? null,
      find: (name) => [...stack].reverse().find((s) => s.name === name),
      push(s, p) { stack.at(-1)?.pause?.(); stack.push(s); s.enter?.(p ?? {}); },
      pop(r) { stack.pop()?.exit?.(); stack.at(-1)?.resume?.(r); },
      transition(kind, ms, fn) { fn(); return true; }, isTransitioning: false,
    },
    push(name, params) { calls.push(['push', name, params]); },
    replaceWith(name, params) { calls.push(['replace', name, params]); },
    stack,
  };
  return G;
}

function startField(G, x = 40, y = 31) {
  G.store.tx('test:place', (w) => { w.player.mapId = 'pellwick'; w.player.x = x; w.player.y = y; w.player.facing = 'left'; });
  const scene = createOverworldScene(G); G.stack.push(scene); scene.enter({}); return scene;
}

function input(dir = null) {
  return { pressed: () => false, held: () => false, released: () => false, repeat: () => false, axis: () => ({ x: dir === 'left' ? -1 : dir === 'right' ? 1 : 0, y: dir === 'up' ? -1 : dir === 'down' ? 1 : 0 }), pointer: {} };
}

test('all manifest scenes build the current core interface without a DOM', () => {
  const G = fakeG();
  assert.deepEqual([...SCENE_NAMES], [...SCENE_NAMES].sort());
  assert.ok(Object.isFrozen(sceneFactories));
  for (const name of MANIFEST) {
    assert.equal(typeof sceneFactories[name], 'function', name);
    const s = sceneFactories[name](G);
    assert.equal(s.name, name);
    for (const fn of ['update', 'draw', 'handleInput']) assert.equal(typeof s[fn], 'function', `${name}.${fn}`);
  }
});

test('new game preserves settings, lease identity and one opening script', () => {
  const G = fakeG(registry({ 'arrival-causeway': [], arrival: [] }));
  const w = buildRunWorld(G, { seedCode: 'TEST-FIELD', lease: { ...DEFAULT_LEASE, name: 'Rowan', town: 'Harbor' } });
  assert.equal(w.player.name, 'Rowan');
  assert.equal(w.flags['sys.lease.town'], 'Harbor');
  assert.equal(w.pendingScript, 'arrival-causeway');
  assert.equal(w.flags['sp.lease-signed'], true);
  assert.deepEqual(validateWorld(w), []);
  newGame(G, { seedCode: 'TEST-FIELD' });
  assert.equal(G.calls.at(-1)[1], 'overworld');
  assert.equal(G.world.pendingScript, 'arrival-causeway');
});

test('field fresh arrival uses the authored marker and does not duplicate the opening', () => {
  const G = fakeG(registry({ 'arrival-causeway': [], arrival: [] }));
  const scene = createOverworldScene(G); G.stack.push(scene); scene.enter({ fresh: true });
  const marker = G.data.get('maps', ARRIVAL.mapId).markers[ARRIVAL.marker];
  assert.deepEqual([G.world.player.mapId, G.world.player.x, G.world.player.y], ['pellwick', marker.x, marker.y]);
  scene.update(16);
  assert.deepEqual(G.calls.filter((c) => c[0] === 'push').map((c) => c[2].scriptId), ['arrival-causeway']);
  assert.deepEqual(validateWorld(G.world), []);
});

test('field walking produces every landing event once and keeps saved coordinates in step', () => {
  const G = fakeG(); const scene = startField(G);
  const steps = []; G.bus.on('player:step', (p) => steps.push(p));
  for (let i = 0; i < 56; i++) { scene.handleInput(input('left')); scene.update(1000 / 60); }
  scene.handleInput(input());
  for (let i = 0; i < 20; i++) scene.update(1000 / 60);
  const e = scene.field().player.ent;
  assert.ok(steps.length >= 3, `${steps.length} steps`);
  assert.equal(40 - e.x, steps.length);
  assert.deepEqual([G.world.player.x, G.world.player.y], [e.x, e.y]);
  assert.equal(G.world.stats.steps, steps.length);
  assert.deepEqual(validateWorld(G.world), []);
});

test('cutscene stage walks, spawns and warps the live field while its clock is frozen', () => {
  const G = fakeG(); const scene = startField(G);
  const before = G.world.clock.total;
  G.stack.push({ name: 'cutscene' });
  assert.equal(scene.stage.walk('player', ['left', 'left'], {}), true);
  for (let i = 0; i < 40; i++) scene.update(1000 / 60);
  assert.equal(G.world.player.x, 38);
  assert.equal(scene.stage.isMoving('player'), false);
  assert.equal(G.world.clock.total, before);
  scene.stage.spawn('story-wren', 'char-wren', 40, 31);
  assert.equal(scene.stage.entity('story-wren').artId, 'char-wren');
  scene.stage.face('story-wren', 'up');
  assert.equal(scene.stage.entity('story-wren').facing, 'up');
  scene.stage.despawn('story-wren');
  assert.equal(scene.stage.entity('story-wren'), null);
  const map = G.data.get('maps', 'int-cottage');
  scene.stage.warp(map.id, map.entry.x, map.entry.y, 'up');
  assert.equal(scene.field().mapId, 'int-cottage');
  assert.equal(G.world.player.facing, 'up');
  assert.deepEqual(validateWorld(G.world), []);
});

test('tide ways honor permanent openings, spring windows and the selected map variant', () => {
  assert.equal(gateOfTile({ way: 'bar', openFlag: 'lit.calls' }, { bar: 'high' }, 'high', { flags: { 'lit.calls': true } }, false), 'low');
  assert.equal(gateOfTile({ way: 'stones', spring: true }, { stones: 'low' }, 'low', { flags: {} }, false), 'high');
  const map = { id: 'test', variants: [{ id: 'first', cond: { flag: 'sp.open' }, artTier: 1 }, { id: 'second', cond: { flag: 'sp.open' }, artTier: 2 }] };
  assert.equal(resolveVariant(map, { flags: { 'sp.open': true } }, registry()).artTier, 2);
});

test('title save description formats place, time and age', () => {
  const now = () => 1_000_000;
  assert.equal(describeSave(null), '');
  assert.equal(describeSave({ state: 'empty' }), '');
  assert.equal(describeSave({ state: 'ok', time: now() - 20_000, summary: { place: 'Harbor', time: '18:40' } }, now), 'Harbor, 18:40, just now');
  assert.equal(describeSave({ state: 'ok', time: now() - 5 * 60_000, summary: { place: 'Harbor', time: '18:40' } }, now), 'Harbor, 18:40, 5 min ago');
});

test('boot crash detection and reduced-motion fade settings tolerate the supported shapes', () => {
  assert.equal(lastSessionCrashed(null), false);
  assert.equal(lastSessionCrashed({ crashed: () => true }), true);
  assert.equal(lastSessionCrashed({ crashMarker: { check: () => false } }), false);
  assert.equal(fadeMs({ flags: { noanim: true } }), 0);
  assert.equal(fadeMs({ flags: { noanim: false } }, 300), 300);
});

test('map chart prioritizes Enter confirm over its shared menu binding', () => {
  const G = fakeG(); startField(G);
  const scene = createMapScreenScene(G); G.stack.push(scene); scene.enter({});
  scene.handleInput({ ...input(), pressed: (a) => ['confirm', 'menu'].includes(a) });
  assert.equal(scene.state().local, true);
  assert.equal(G.scenes.top(), scene);
});

test('tools granted by the opening become usable on the field ring', async () => {
  const bag = await import('../js/systems/bag.js');
  const G = fakeG(); const scene = startField(G);
  G.store.tx('test:tools', (w) => { for (const id of ['rod', 'net', 'shovel', 'keepers-lantern']) bag.give(w, id, 1, { data: G.data, bus: G.bus }); });
  scene.update(16);
  assert.deepEqual([...G.world.player.toolRing], ['rod', 'net', 'shovel', 'keepers-lantern']);
  assert.equal(scene.field().player.tool, 'rod');
  assert.deepEqual(validateWorld(G.world), []);
});

test('authored Spire trainer posts present a challenge and hand off the chosen roster', async () => {
  const { TRAINERS } = await import('../js/data/trainers.js');
  const { doInteraction } = await import('../js/systems/flow/interactFlow.js');
  const G = fakeG(createRegistry({ ...DATA, maps: MAPS, items: ITEMS, collections: COLLECTIONS, npcs: [], scripts: {}, trainers: TRAINERS }));
  const scene = startField(G);
  const map = G.data.get('maps', 'spire-turn');
  scene.stage.warp(map.id, map.entry.x, map.entry.y, 'up');
  const field = scene.field();
  const leader = field.ents.list.find((e) => e.def?.trainerId === 'maud-spire');
  assert.ok(leader, 'the first Spire is staffed even while Maud is scheduled at the ferry');
  scene.stage.teleport('player', leader.x, leader.y + 1); scene.stage.face('player', 'up'); scene.update(16);
  const action = scene.field().action;
  assert.equal(action.verb, 'challenge');
  assert.equal(action.payload.trainerId, 'maud-spire');
  G.store.tx('test:companion', (w) => w.party.push({ hp: 1 }));
  let requested;
  const result = await doInteraction(G, action, { ...field.host, ask: async () => 1, startBattle: (setup) => { requested = setup; } });
  assert.equal(result.ok, true);
  // the intro is spoken once, by the battle scene's trainer-in: no dialogue is pushed before it
  assert.ok(!G.calls.some((c) => c[1] === 'dialogue' && c[2]?.text === TRAINERS.find((tr) => tr.id === 'maud-spire').lines.intro));
  assert.deepEqual(requested, { kind: 'trainer', trainerId: 'maud-spire', source: 'spire' });
});

test('rectangular step triggers fire once and use triggers execute their authored script', async () => {
  const { doInteraction } = await import('../js/systems/flow/interactFlow.js');
  const map = { ...MAPS[0], triggers: [{ id: 'rect-story', kind: 'step', x: 38, y: 31, w: 2, h: 1, once: true, script: 'rect-story' }] };
  const G = fakeG(createRegistry({ ...DATA, maps: [map, ...MAPS.slice(1)], items: ITEMS, collections: COLLECTIONS, npcs: [], trainers: [], scripts: { 'rect-story': [], 'use-story': [] } }));
  const scene = startField(G);
  for (let i = 0; i < 16; i++) { scene.handleInput(input('left')); scene.update(1000 / 60); }
  scene.handleInput(input());
  for (let i = 0; i < 20; i++) scene.update(1000 / 60);
  assert.ok(G.world.maps.pellwick.opened.includes('rect-story'));
  assert.equal(G.calls.filter((c) => c[0] === 'push' && c[2]?.scriptId === 'rect-story').length, 1);
  scene.stage.teleport('player', 40, 31);
  for (let i = 0; i < 30; i++) { scene.handleInput(input('left')); scene.update(1000 / 60); }
  assert.equal(G.calls.filter((c) => c[0] === 'push' && c[2]?.scriptId === 'rect-story').length, 1);
  doInteraction(G, { verb: 'use', kind: 'trigger', targetId: 'use-story', target: { once: true }, payload: { script: 'use-story' } }, scene.field().host);
  assert.equal(G.calls.at(-1)[2].scriptId, 'use-story');
  assert.ok(G.world.maps.pellwick.opened.includes('use-story'));
});

test('a new No Rewind run tells persist to drop to one autosave slot at once (LG-RN103)', () => {
  for (const [challenges, want] of [[['no-rewind'], true], [[], false]]) {
    const G = fakeG(); const seen = [];
    G.persist = { latest: () => null, setNoRewind: (on) => seen.push(on) };
    newGame(G, { seedCode: 'TEST-FIELD', challenges });
    assert.deepEqual(seen, [want]);
    assert.deepEqual([...G.world.run.challenges], challenges);
  }
});

test('the Pellwick cottage shows the THWAP roof colour and grows outside over the loans (MID-13)', async () => {
  const { cottageRoofArt, cottageGrowth } = await import('../js/scenes/overworld.js');
  const { fakeCtx, installFakeCanvas } = await import('./ui.fakes.mjs');
  const pixelart = await import('../js/core/pixelart.js');
  installFakeCanvas(pixelart);
  const G = fakeG(); const scene = startField(G, 9, 24);
  const draw = () => { const ctx = fakeCtx(); scene.draw(ctx); return ctx.calls.filter((c) => c[0] === 'fillRect').map((c) => c[1]); };
  assert.equal(cottageRoofArt(G.world), 'slate');
  assert.ok(!draw().includes('#9FD4C8'), 'no greenhouse before it is built');
  G.store.tx('test:builds', (w) => {
    w.loans.builds.push({ id: 'bedsit', tier: 1, startedDay: 0, readyDay: 1, choice: 'harbor-red', done: true });
    w.loans.builds.push({ id: 'cottage', tier: 2, startedDay: 1, readyDay: 2, choice: 'ochre', done: true });
    w.loans.builds.push({ id: 'greenhouse', tier: 3, startedDay: 2, readyDay: 3, choice: 'moss', done: true });
    w.loans.builds.push({ id: 'workshop', tier: 4, startedDay: 3, readyDay: 9, choice: null, done: false });
  });
  assert.equal(cottageRoofArt(G.world), 'moss', 'the latest landed build\'s choice, through the roof art map');
  assert.deepEqual(cottageGrowth(G.world), ['bedsit', 'cottage', 'greenhouse'], 'only landed builds show');
  const fills = draw();
  assert.ok(fills.includes('#9FD4C8'), 'the greenhouse glass is drawn on the exterior');
  assert.ok(fills.includes('#6B4F3A'), 'the cottage chimney is drawn');
  assert.ok(!fills.includes('#7A5230'), 'the unbuilt workshop is not');
});

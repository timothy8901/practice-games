import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFishingScene } from '../js/scenes/fishing.js';
import { createCreditsScene, creditDuration, SEED_HOLD_MS } from '../js/scenes/credits.js';
import { installEndingTrigger, endingSteps } from '../js/scenes/ending.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createClock } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import * as bag from '../js/systems/bag.js';
import * as fishing from '../js/systems/fishing.js';
import { setFlag } from '../js/systems/flags.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { CREDITS } from '../js/data/credits.js';
import { TOWN, COLLECTIONS, SPECIES } from './fixtures/gatherLane.fixture.mjs';

function setup(mode = 'standard') {
  const data = createRegistry({ ...DATA, collections: COLLECTIONS, species: SPECIES, maps: [TOWN], scripts: { 'coda-morning': [] } });
  const store = createStore(createNewWorld({ seedCode: 'FIELD-FLOW' }), { strict: true });
  store.tx('test:settings', (w) => { w.settings.fishingMode = mode; w.player.mapId = TOWN.id; w.clock.total = 12 * 60; });
  const clock = createClock(clockSys.optionsFrom(store.world)); clockSys.restoreFrom(store.world, clock);
  const stack = [{ name: 'overworld' }], calls = [];
  const G = {
    data, store, bus: store.bus, get world() { return store.world; }, clock, rngs: createRngs(store), flags: { noanim: true }, audio: { sfx() {} }, input: { flush() {} },
    persist: { autosave: () => calls.push('autosave') },
    scenes: {
      get size() { return stack.length; }, top: () => stack.at(-1), find: (name) => stack.find((s) => s.name === name), isTransitioning: false,
      pop: (r) => { calls.push(['pop', r]); stack.pop(); }, transition: (k, ms, fn) => { fn(); return true; },
    },
    push: (name, p) => { calls.push(['push', name, p]); stack.push({ name }); }, replaceWith: (name, p) => calls.push(['replace', name, p]), calls, stack,
  };
  return G;
}
const input = (pressed = [], held = []) => ({ pressed: (a) => pressed.includes(a), repeat: (a) => pressed.includes(a), held: (a) => held.includes(a), pointer: {} });
const tick = (s, n) => { for (let i = 0; i < n; i++) s.update(1000 / 60); };
function atBite(scene) { for (let i = 0; i < 600 && scene.state().session.phase !== 'bite'; i++) tick(scene, 1); assert.equal(scene.state().session.phase, 'bite'); }
function openFishing(G) { const s = createFishingScene(G); G.stack.push(s); s.enter({ mapId: TOWN.id, reachId: 'r-quay' }); return s; }

test('fishing Standard lets the player wait through feints, hook the bite and keep the catch', () => {
  const G = setup(), s = openFishing(G), before = G.world.clock.total;
  atBite(s); s.handleInput(input(['confirm']));
  assert.equal(s.state().session.phase, 'landed');
  const id = s.state().session.shadow.fishId;
  s.handleInput(input(['confirm', 'menu']));
  assert.equal(s.state().session.phase, 'kept');
  assert.equal(bag.count(G.world, id, undefined, { data: G.data }), 1);
  assert.equal(G.world.collections.fish[id].n, 1);
  assert.equal(G.world.stats.fishCaught, 1);
  assert.ok(G.world.clock.total > before, 'the harbor clock continues while fishing');
  assert.ok(fishing.reachHealth(G.world, TOWN.id, 'r-quay') < 1);
  assert.deepEqual(validateWorld(G.world), []);
  s.handleInput(input(['cancel'])); assert.equal(G.stack.at(-1).name, 'overworld');
});

test('fishing Patient ignores early presses, waits at the bite and records a released fish', () => {
  const G = setup('patient'), s = openFishing(G);
  s.handleInput(input(['confirm']));
  atBite(s);
  s.handleInput(input()); tick(s, 120);
  assert.equal(s.state().session.phase, 'bite', 'Patient never times out');
  s.handleInput(input([], ['confirm'])); tick(s, 60);
  assert.equal(s.state().session.phase, 'landed');
  const id = s.state().session.shadow.fishId;
  s.handleInput(input(['right'])); s.handleInput(input(['confirm']));
  assert.equal(s.state().session.phase, 'released');
  assert.equal(G.world.stats.fishCaught, 1);
  assert.equal(bag.count(G.world, id, undefined, { data: G.data }), 0);
  assert.ok(G.world.collections.patientBest[id] > 0);
});

test('fishing cancelling a landed fish releases it; an early Standard reel misses and can recast', () => {
  const G = setup(), s = openFishing(G);
  while (s.state().session.phase === 'approach') tick(s, 1);
  s.handleInput(input(['confirm']));
  assert.equal(s.state().session.phase, 'missed');
  s.handleInput(input(['confirm']));
  assert.equal(s.state().session.phase, 'approach');
  atBite(s); s.handleInput(input(['confirm']));
  s.handleInput(input(['cancel']));
  assert.equal(G.world.stats.fishCaught, 1);
  assert.equal(s.state().session.phase, 'released');
});

test('first credits viewing reaches the Seed Card, marks completion and queues the playable coda', () => {
  const G = setup();
  G.store.tx('test:lit', (w) => setFlag(w, 'lit.calls', true, { bus: G.bus }));
  const s = createCreditsScene(G); G.stack.push(s); s.enter({ fromEnding: true });
  s.handleInput(input(['cancel'])); assert.equal(G.stack.at(-1), s, 'the first roll cannot be skipped');
  for (const row of CREDITS) s.update(creditDuration(row));
  assert.equal(s.state().seedPage, true);
  s.handleInput(input(['confirm'])); assert.equal(G.world.flags['sp.credits-seen'], undefined);
  s.update(SEED_HOLD_MS); s.handleInput(input(['confirm']));
  assert.equal(G.world.flags['sp.credits-seen'], true);
  assert.equal(G.world.pendingScript, 'coda-morning');
  assert.equal(G.world.clock.total % 1440, 360);
  assert.equal(G.stack.at(-1).name, 'overworld');
  assert.ok(G.calls.includes('autosave'));
});

test('ending recovers a loaded relit save, runs story handoffs, and never repeats after credits', async () => {
  const G = setup();
  installEndingTrigger(G);
  const loaded = createNewWorld({ seedCode: 'LOADED' }); loaded.flags['lit.calls'] = true;
  G.store.replace(loaded); await Promise.resolve();
  assert.equal(G.calls.filter((x) => Array.isArray(x) && x[0] === 'push' && x[1] === 'ending').length, 1);
  const done = createNewWorld({ seedCode: 'DONE' }); done.flags['lit.calls'] = true; done.flags['sp.credits-seen'] = true;
  G.stack.pop(); G.store.replace(done); await Promise.resolve();
  assert.equal(G.calls.filter((x) => Array.isArray(x) && x[0] === 'push' && x[1] === 'ending').length, 1);
  const steps = endingSteps(() => true);
  assert.deepEqual(steps.filter((s) => s.kind === 'script').map((s) => s.id), ['the-crossing', 'the-reading', 'credits-dawn']);
  G.__endingTrigger();
});

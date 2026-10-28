// MID-10 in the field: after a Summit loss the overworld stages you at the Bell's marker (Drift / Flux:
// the Keeper who beat you; Freefall: the hall door), never on the Pellwick porch, with no blackout toast.
// Run: node --test test/scn.summitBell.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneFactories } from '../js/scenes/index.js';
import { createOverworldScene, HOME } from '../js/scenes/overworld.js';
import { createNewWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createClock } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';

function fakeG() {
  const data = createRegistry(DATA_CONTENT);
  const store = createStore(createNewWorld({ seedCode: 'TEST-FIELD' }), { strict: true });
  const clock = createClock(clockSys.optionsFrom(store.world));
  clockSys.restoreFrom(store.world, clock);
  const stack = [], calls = [];
  return {
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
}

async function loseAtSummit(post, at = { mapId: 'keepers-hall', x: 10, y: 4 }) {
  const G = fakeG();
  G.store.tx('test:place', (w) => { w.player.mapId = at.mapId; w.player.x = at.x; w.player.y = at.y; w.player.facing = 'up'; });
  // the Summit climbs in order (battleFlow.summitBlocker, LF-01): the Keepers before the fought one are beaten
  const order = ['bastien-keeper', 'cass-keeper', 'idris-champion'];
  G.store.tx('test:climb', (w) => { for (const id of order.slice(0, order.indexOf(post.summitBell.trainerId))) w.flags[`sys.trainer.${id}`] = true; });
  const scene = createOverworldScene(G);
  G.stack.push(scene);
  scene.enter({});
  scene.field().host.startBattle({ kind: 'trainer', trainerId: post.summitBell.trainerId });
  const call = G.calls.find((c) => c[0] === 'push' && c[1] === 'battle');
  assert.ok(call, 'the battle scene was pushed');
  call[2].onDone(post);
  await new Promise((r) => setImmediate(r));
  return G;
}

test('Drift / Flux: the Bell puts you back at the Keeper who beat you, no porch, no blackout toast', async () => {
  const G = await loseAtSummit({ outcome: 'loss', blackout: null, script: 'summit-bell', summitBell: { holds: true, trainerId: 'cass-keeper', mapId: 'keepers-hall', marker: 'bell-restart-cass' } });
  const m = G.data.get('maps', 'keepers-hall').markers['bell-restart-cass'];
  assert.equal(G.world.player.mapId, 'keepers-hall');
  assert.deepEqual([G.world.player.x, G.world.player.y], [m.x, m.y]);
  assert.notDeepEqual([G.world.player.mapId, G.world.player.x, G.world.player.y], [HOME.mapId, HOME.x, HOME.y]);
  assert.ok(!G.calls.some((c) => c[0] === 'toast' && /came home carried/.test(c[1])), 'no Dimity blackout toast');
});

test('Idris: the Bell holds your place in his hall', async () => {
  const G = await loseAtSummit({ outcome: 'loss', blackout: null, script: 'summit-bell', summitBell: { holds: true, trainerId: 'idris-champion', mapId: 'idris-hall', marker: 'bell-restart-idris' } }, { mapId: 'idris-hall', x: 10, y: 5 });
  const m = G.data.get('maps', 'idris-hall').markers['bell-restart-idris'];
  assert.deepEqual([G.world.player.mapId, G.world.player.x, G.world.player.y], ['idris-hall', m.x, m.y]);
});

test('Freefall: the climb restarts at the hall door, with the line that says so', async () => {
  const line = 'Freefall: the Bell keeps nothing. The climb starts again at the first Keeper.';
  const G = await loseAtSummit({ outcome: 'loss', blackout: null, script: null, summitBell: { holds: false, trainerId: 'cass-keeper', mapId: 'keepers-hall', marker: 'from-door', restarted: ['bastien-keeper'], line } });
  const m = G.data.get('maps', 'keepers-hall').markers['from-door'];
  assert.deepEqual([G.world.player.mapId, G.world.player.x, G.world.player.y], ['keepers-hall', m.x, m.y]);
  assert.ok(G.calls.some((c) => c[0] === 'toast' && c[1] === line));
});

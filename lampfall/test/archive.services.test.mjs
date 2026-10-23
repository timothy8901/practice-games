import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recallAtArchive, createArchiveScene } from '../js/scenes/archive.js';
import { createCutsceneScene } from '../js/scenes/cutscene.js';
import { realBattleData } from '../js/scenes/battleData.js';
import { createNewWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import * as creature from '../js/systems/creature.js';
import * as party from '../js/systems/party.js';
import { TUNING } from '../js/data/tuning.js';

const data = realBattleData();
function makeG() {
  const store = createStore(createNewWorld({ seedCode: 'FLUX-ARCH-TEST' }));
  const pushed = [];
  const G = { store, get world() { return store.world; }, data, bus: store.bus, flags: { noanim: true }, pushed,
    scenes: { find() {}, top() {}, pop() {} }, push(name, params) { pushed.push({ name, params }); } };
  return G;
}
function add(G) {
  return G.store.tx('add', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), speciesId: 'sloshkin', level: 20, moves: ['tap'], heartmark: null }, data);
    c.shiftlog = ['sloshkin', 'siltback'];
    c.memory = ['salt-spray'];
    party.addCreature(w, c, data, { tuning: TUNING });
    return c.uid;
  });
}

test('Recall is gated, priced once, and keeps the creature identity, level, mark and pending windows', () => {
  const G = makeG();
  const uid = add(G);
  assert.equal(recallAtArchive(G.world, uid, 'siltback', data, { tuning: TUNING }).ok, false);
  G.store.tx('seals', (w) => { w.badges = ['turn', 'ward', 'weather', 'hollow']; w.wallet.starsalt = 6; });
  const c = G.world.party[0];
  const before = { uid, level: c.level, exp: c.exp, mark: { ...c.mark }, windows: c.windowsUsed.slice(), nickname: c.nickname };
  const r = G.store.tx('recall', (w) => recallAtArchive(w, uid, 'siltback', data, { tuning: TUNING }));
  assert.equal(r.ok, true);
  assert.equal(G.world.party[0].speciesId, 'siltback');
  assert.equal(G.world.wallet.starsalt, 0);
  assert.deepEqual({ uid: c.uid, level: c.level, exp: c.exp, mark: c.mark, windows: c.windowsUsed, nickname: c.nickname }, before);
  assert.equal(recallAtArchive(G.world, uid, 'sloshkin', data, { tuning: TUNING }).ok, false);
});

test('the Archive Memory service relearns eligible moves for free through scene controls', async () => {
  const G = makeG();
  add(G);
  const scene = createArchiveScene(G);
  scene.enter({ mode: 'memory' });
  const press = (key) => scene.handleInput({ pressed: (a) => a === key, repeat: () => false, pointer: null });
  press('confirm');
  press('confirm');
  await Promise.resolve();
  assert.ok(G.world.party[0].moves.some((m) => m.id === 'salt-spray'));
  assert.ok(!G.world.party[0].memory.includes('salt-spray'));
  assert.equal(G.world.wallet.starsalt, 0);
});

test('a battle child runs its outcome script once before continuing the parent cutscene', () => {
  const G = makeG();
  const scene = createCutsceneScene(G);
  scene.enter({ ops: [{ op: 'startBattle', trainer: 'pip' }, { op: 'setFlag', id: 'sp.parent-continued' }, { op: 'end' }] });
  assert.equal(G.pushed.at(-1).name, 'battle');
  scene.resume({ result: { outcome: 'holdout', script: 'dock-after' } });
  assert.equal(G.pushed.at(-1).name, 'cutscene');
  assert.equal(G.pushed.at(-1).params.scriptId, 'dock-after');
  assert.equal(G.world.flags['sp.parent-continued'], undefined);
  scene.resume({ done: true });
  assert.equal(G.world.flags['sp.parent-continued'], true);
  assert.equal(G.pushed.filter((p) => p.name === 'cutscene').length, 1);
});

// The battle scene runs the Relay Spire as three rounds with the pick screen between them (MID-05)
// and shows a posted boss Shift's strip until it lands (MID-04), driven headless (no DOM, no draw).
// Run: node --test test/scn.battleRelay.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattleScene } from '../js/scenes/battle.js';
import * as F from '../js/systems/flow/battleFlow.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';

const data = realBattleData();
const tuning = F.tuningFor(data);

function fakeG() {
  const store = createStore(createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' }));
  store.tx('dial', (w) => { w.run.dial = 'flux'; });
  const stack = [];
  const pushed = [];
  const G = {
    store, get world() { return store.world; }, bus: store.bus, data, battleData: data, rngs: createRngs(store),
    flags: { noanim: true }, audio: { sfx() {} }, toasts: { show() {} },
    scenes: {
      get size() { return stack.length; },
      top: () => stack.at(-1) ?? null,
      push(s, p) { stack.push(s); s.enter?.(p ?? {}); },
      pop(r) { stack.pop()?.exit?.(); stack.at(-1)?.resume?.(r); },
    },
    push(name, params) { pushed.push([name, params]); },
    stack, pushed,
  };
  return G;
}

function give(G, speciesId, level) {
  G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, speciesId, level }, data);
    party.addCreature(w, c, data, { tuning, caught: true });
  });
}

const press = (key) => ({ pressed: (k) => k === key, held: () => false, released: () => false, repeat: () => false, axis: () => ({ x: 0, y: 0 }), pointer: null });
const idle = press(null);

/** Runs frames, answering every menu with its first enabled choice; `onRelay` handles the pick screen. */
function drive(scene, frames, onRelay) {
  for (let i = 0; i < frames && scene.mode !== 'done'; i++) {
    scene.update(16);
    if (scene.overlay === 'relay') { onRelay(scene.overlayState); continue; }
    scene.handleInput(i % 2 ? press('confirm') : idle);
  }
}

const tick = () => new Promise((r) => setImmediate(r));

test('the Relay plays three rounds in one scene: two of yours each, no repeats, a pick screen between, the badge after round 3', async () => {
  const G = fakeG();
  for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest', 'floeback', 'duskowl', 'cragmitt']) give(G, sp, 80);
  const scene = createBattleScene(G);
  let result = null;
  G.stack.push(scene);
  scene.enter({ setup: { kind: 'trainer', trainerId: 'hallorans-spire', source: 'spire' }, onDone: (r) => { result = r; } });
  const rounds = [];
  const seen = new Set();
  let picks = 0;
  const note = () => {
    const s = scene.session;
    if (!s || seen.has(s.battleId)) return;
    seen.add(s.battleId);
    rounds.push({ round: s.relay.round, mine: s.battle.sides[0].party.map((c) => c.uid), foes: s.battle.sides[1].party.map((c) => c.speciesId) });
  };
  for (let k = 0; k < 40000 && scene.mode !== 'done'; k += 50) {
    await tick();
    note();
    drive(scene, 50, (o) => {
      picks++;
      assert.match(o.title, /^Round [123] of 3$/);
      if (o.title === 'Round 1 of 3') {
        // before round 1: nothing has fought; choose the last two (not the party's first two)
        rounds.length = 0;
        seen.clear();
        assert.ok(o.rows.filter((x) => x.uid).every((x) => x.enabled));
        for (const r of o.rows.filter((x) => x.uid)) assert.equal(r.enabled, true);
        const want = G.world.party.slice(4).map((c) => c.uid);
        for (const u of [...o.picks]) { o.focus.index = o.rows.findIndex((r) => r.uid === u); scene.handleInput(press('confirm')); }
        for (const u of want) { o.focus.index = o.rows.findIndex((r) => r.uid === u); scene.handleInput(press('confirm')); }
        assert.deepEqual(o.picks, want);
        o.focus.index = o.rows.findIndex((r) => r.id === 'begin');
        scene.handleInput(press('confirm'));
        return;
      }
      // the pick screen offers only fresh faces while they last, then Begin
      const used = rounds.flatMap((r) => r.mine);
      for (const r of o.rows.filter((x) => x.uid)) assert.equal(r.enabled, !used.includes(r.uid), r.label);
      assert.equal(o.picks.length, 2);
      o.focus.index = o.rows.findIndex((r) => r.id === 'begin');
      scene.handleInput(press('confirm'));
    });
  }
  note();
  assert.equal(scene.mode, 'done');
  assert.equal(picks, 3, 'a pick screen before round 1 and between rounds 1-2 and 2-3');
  assert.deepEqual(rounds.map((r) => r.round), [1, 2, 3]);
  const all = rounds.flatMap((r) => r.mine);
  assert.equal(new Set(all).size, 6, 'nobody fights two rounds');
  for (const r of rounds) assert.equal(r.mine.length, 2);
  assert.deepEqual(rounds[0].mine, G.world.party.slice(4).map((c) => c.uid), 'round 1 fields the pair picked before it');
  assert.equal(result.outcome, 'win');
  assert.equal(result.badge, 'relay');
  assert.deepEqual(G.world.badges, ['relay']);
});

test('the pick screen can open the satchel between rounds and comes back to the picks', async () => {
  const G = fakeG();
  for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest', 'floeback', 'duskowl', 'cragmitt']) give(G, sp, 80);
  const scene = createBattleScene(G);
  G.stack.push(scene);
  scene.enter({ setup: { kind: 'trainer', trainerId: 'hallorans-spire', source: 'spire' } });
  let opened = false;
  for (let k = 0; k < 20000 && !opened; k += 50) {
    await tick();
    drive(scene, 50, (o) => {
      if (opened) return;
      if (o.title === 'Round 1 of 3') { o.focus.index = o.rows.findIndex((r) => r.id === 'begin'); scene.handleInput(press('confirm')); return; }
      o.focus.index = o.rows.findIndex((r) => r.id === 'satchel');
      scene.handleInput(press('confirm'));
      opened = true;
    });
  }
  assert.ok(opened, 'round 1 won and the pick screen opened');
  assert.deepEqual(G.pushed.at(-1), ['bag', { pocket: 'medicine' }]);
  assert.equal(scene.overlayState.busy, true, 'the picks wait for the satchel');
  scene.resume();
  assert.equal(scene.overlay, 'relay');
  assert.equal(scene.overlayState.busy, false);
});

test("Linnet's dock: the scene starts on the posted strip's Sootling, not the Caldermaw the engine already holds", async () => {
  const G = fakeG();
  give(G, 'stillox', 30);
  const scene = createBattleScene(G);
  G.stack.push(scene);
  scene.enter({ setup: { kind: 'trainer', trainerId: 'linnet-dock', source: 'story', holdOut: 3 } });
  assert.equal(scene.session.battle.active(1).speciesId, 'caldermaw', 'the engine Shifted it as it entered');
  assert.equal(scene.shown(1).speciesId, 'sootling', 'the display waits for the boss-shift animation');
  for (let i = 0; i < 2000 && scene.mode !== 'menu'; i++) {
    if (i % 50 === 0) await tick();
    scene.update(16);
    scene.handleInput(i % 2 ? press('confirm') : idle);
  }
  assert.equal(scene.mode, 'menu');
  assert.equal(scene.shown(1).speciesId, 'caldermaw', 'after the intro the Caldermaw stands');
  assert.equal(scene.shown(1).name, 'Cinder');
});

test("Linnet's dock: the Up 100% strip is on screen over the Sootling before the Shift lands", async () => {
  const G = fakeG();
  G.flags.noanim = false;   // played at speed, so the strip has frames of its own before the Shift
  give(G, 'stillox', 30);
  const scene = createBattleScene(G);
  G.stack.push(scene);
  scene.enter({ setup: { kind: 'trainer', trainerId: 'linnet-dock', source: 'story', holdOut: 3 } });
  let sawStrip = null;
  for (let i = 0; i < 20000 && scene.mode !== 'menu'; i++) {
    if (i % 50 === 0) await tick();
    scene.update(16);
    const sh = scene.shown(1);
    if (sh.strip && !sawStrip) sawStrip = { species: sh.speciesId, cards: sh.strip.cards.map((k) => `${k.form}:${k.odds}`) };
    scene.handleInput(i % 2 ? press('confirm') : idle);
  }
  assert.deepEqual(sawStrip, { species: 'sootling', cards: ['caldermaw:100'] });
  assert.equal(scene.shown(1).strip, null, 'the strip comes down when the Shift lands');
});

test('a posted strip belongs to its creature: it does not stay up over the foe that replaces a fainted one (Maud)', async () => {
  const G = fakeG();
  G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh('t:0'), tuning, speciesId: 'stillox', level: 30, moves: ['grind-down'] }, data);
    party.addCreature(w, c, data, { tuning, caught: true });
  });
  const scene = createBattleScene(G);
  G.stack.push(scene);
  scene.enter({ setup: { kind: 'trainer', trainerId: 'maud-spire', source: 'spire' } });
  const toMenu = async () => {
    for (let i = 0; i < 4000 && scene.mode !== 'menu' && scene.mode !== 'done'; i++) { if (i % 50 === 0) await tick(); scene.update(16); scene.handleInput(i % 2 ? press('confirm') : idle); }
  };
  const turn = async () => {
    const t0 = scene.session.battle.turn;
    for (let i = 0; i < 4000 && (scene.session.battle.turn === t0 || scene.mode !== 'menu') && scene.mode !== 'done'; i++) { if (i % 50 === 0) await tick(); scene.update(16); scene.handleInput(i % 2 ? press('confirm') : idle); }
  };
  await toMenu();
  const b = scene.session.battle;
  const pip = b.active(1);
  const max = pip.stats.hp;
  pip.stats.hp = 5000; pip.hp = 5000;   // Puddlepip lives through turn 1 and posts its strip
  await turn();
  assert.equal(scene.shown(1).speciesId, 'puddlepip');
  assert.deepEqual(scene.shown(1).strip.cards.map((k) => k.form), ['sloshkin']);
  pip.stats.hp = max; pip.hp = 1;        // ...and falls in turn 2, before its Shift lands
  await turn();
  assert.notEqual(scene.shown(1).speciesId, 'puddlepip');
  assert.equal(scene.shown(1).strip, null, "Puddlepip's strip is not shown over the next foe");
});

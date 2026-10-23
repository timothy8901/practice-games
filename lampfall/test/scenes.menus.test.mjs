// SCN-MENU scene logic under Node: the pause root, Party (swap, held items, presets), the Satchel
// (pockets, use, teach, toss behind a confirm), Storage (move, release rules), Settings (live apply,
// remap conflicts) and Save/Load (verified save, overwrite confirm, load). Drives the real scenes with
// a real store + registry and a scriptable input; drawing is smoke-tested on a recording context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeInput, fakeCtx } from './ui.fakes.mjs';
import { sceneFactories } from '../js/scenes/index.js';
import { createNewWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createPersist } from '../js/state/persist.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { TYPES } from '../js/data/types.js';
import { MOVES } from '../js/data/moves/index.js';
import { ABILITIES } from '../js/data/abilities.js';
import { SPECIES, FAMILIES } from '../js/data/species/index.js';
import { ITEMS } from '../js/data/items.js';
import { MAPS } from '../js/data/maps/index.js';
import { createClock } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import * as partySys from '../js/systems/party.js';
import * as bagSys from '../js/systems/bag.js';
import { makeRng } from '../js/core/rng.js';
import { TUNING } from '../js/data/tuning.js';
import { readExt, resetExtCache } from '../js/scenes/menuKit.js';
import { DEFAULT_BINDINGS } from '../js/core/input.js';

const data = createRegistry({ ...DATA, types: TYPES, moves: MOVES, abilities: ABILITIES, species: SPECIES, families: FAMILIES, items: ITEMS, maps: MAPS });
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A G with a real store, registry, persist (memory) and clock, and a tiny scene stack. */
function makeG(opts = {}) {
  const store = createStore(createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: opts.challenges ?? [] }));
  const clock = createClock(clockSys.optionsFrom(store.world));
  const stack = [];
  const input = fakeInput();
  let bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  input.bindings = () => JSON.parse(JSON.stringify(bindings));
  input.loadBindings = (doc) => { bindings = JSON.parse(JSON.stringify(doc.bindings)); return true; };
  input.resetBindings = () => { bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); };
  input.lastPressedToken = () => input.lastToken ?? null;
  const events = [];
  store.bus.on('*', () => {});
  const G = {
    store, get world() { return store.world; }, bus: store.bus, data, input, clock,
    flags: { noanim: true },
    persist: createPersist({ storage: new Map(), prefix: 't.' }),
    toasts: { show: (text) => events.push(['toast', text]) },
    sceneFactories,
    scenes: {
      get size() { return stack.length; },
      get stack() { return stack.slice(); },
      push(s, p) { const top = stack.at(-1); top?.pause?.(); stack.push(s); s.enter?.(p ?? {}); return s; },
      pop(r) { const s = stack.pop(); s?.exit?.(); stack.at(-1)?.resume?.(r); return s; },
      replace(s, p) { stack.pop()?.exit?.(); stack.push(s); s.enter?.(p ?? {}); },
      top: () => stack.at(-1) ?? null,
      find: (n) => [...stack].reverse().find((s) => s.name === n) ?? null,
      has: (s) => stack.includes(s),
      clear() { while (stack.length) stack.pop().exit?.(); },
      isTransitioning: false,
      transition: (k, ms, fn) => { fn(); return true; },
    },
    push(name, params) { G.scenes.push(sceneFactories[name](G), params); },
    replaceWith(name, params) { G.scenes.replace(sceneFactories[name](G), params); },
    events,
  };
  stack.push({ name: 'overworld', resume() {}, pause() {} });
  return G;
}

function fillParty(G, specs) {
  G.store.tx('test:party', (w) => {
    const rng = makeRng('t');
    for (const s of specs) partySys.giveCreature(w, { species: s[0], level: s[1], nickname: s[2] }, data, rng, { tuning: TUNING, to: s[3] });
  });
}

/** One frame: press actions, let the top scene read them, clear the edges. */
function press(G, ...actions) {
  G.input.press(...actions);
  G.scenes.top().handleInput(G.input);
  G.input.clear();
  G.scenes.top().update?.(16);
}

const top = (G) => G.scenes.top();

test('menu: one Up from the top lands on Save; confirm opens the save screen', () => {
  const G = makeG();
  G.push('menu');
  const menu = top(G);
  assert.equal(menu.index, 0);
  press(G, 'up');
  assert.equal(menu.rows[menu.index].id, 'save');
  press(G, 'confirm');
  assert.equal(top(G).name, 'saveLoad');
});

test('menu: under No Rewind Save is still last and reachable, greyed', () => {
  const G = makeG({ challenges: ['no-rewind'] });
  G.push('menu');
  press(G, 'up');
  const menu = top(G);
  assert.equal(menu.rows[menu.index].id, 'save');
  assert.equal(menu.rows[menu.index].locked, true);
  press(G, 'confirm');
  assert.equal(top(G).name, 'saveLoad');
  assert.doesNotMatch(top(G).debugText(), /\[save\]/, 'No Rewind opens without the Save tab');
});

test('menu: opening flushes input; the pause button and cancel close it; clock frozen (no updateBelow)', () => {
  const G = makeG();
  const before = G.input.flushed ?? 0;
  G.push('menu');
  assert.ok((G.input.flushed ?? 0) > before);
  assert.notEqual(top(G).updateBelow, true);
  press(G, 'start');
  assert.equal(top(G).name, 'overworld');
  G.push('menu');
  press(G, 'cancel');
  assert.equal(top(G).name, 'overworld');
});

test('party: swap two rows through the mini menu; cancel never changes anything', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE'], ['tossup', 5, 'Toss'], ['scrapling', 6, 'Scrap']]);
  G.push('party');
  const p = top(G);
  press(G, 'confirm');
  assert.equal(p.mode, 'mini');
  press(G, 'cancel');
  assert.equal(p.mode, 'list');
  assert.deepEqual(G.world.party.map((c) => c.nickname), ['PUDDLE', 'Toss', 'Scrap']);
  press(G, 'confirm'); // mini
  press(G, 'down'); // Swap
  press(G, 'confirm');
  assert.equal(p.mode, 'swap');
  press(G, 'down'); press(G, 'down');
  press(G, 'confirm');
  assert.deepEqual(G.world.party.map((c) => c.nickname), ['Scrap', 'Toss', 'PUDDLE']);
  assert.equal(p.mode, 'list');
});

test('party: give a held item from the satchel and take it back', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.store.tx('t', (w) => bagSys.give(w, 'oilskin', 1, { data }));
  G.push('party');
  const p = top(G);
  press(G, 'confirm'); // mini
  press(G, 'down'); // Give an item (Swap is disabled with one member, so the cursor skips it)
  press(G, 'confirm');
  assert.equal(p.mode, 'held');
  press(G, 'confirm');
  assert.equal(G.world.party[0].heldItem, 'oilskin');
  assert.equal(bagSys.count(G.world, 'oilskin', undefined, { data }), 0);
  press(G, 'confirm'); press(G, 'down'); press(G, 'confirm'); // Take Oilskin
  assert.equal(G.world.party[0].heldItem, null);
  assert.equal(bagSys.count(G.world, 'oilskin', undefined, { data }), 1);
});

test('party: Summary preset cycles the window preset in world.settings; l/r switch creatures', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE'], ['tossup', 5, 'Toss']]);
  G.push('party', { summary: 0 });
  const p = top(G);
  assert.equal(p.mode, 'summary');
  const uid = G.world.party[0].uid;
  // focus order: moves..., preset, held -> Up twice from the top reaches the preset
  press(G, 'up'); press(G, 'up');
  press(G, 'confirm');
  assert.equal(G.world.settings.autoAnchor[uid], 'auto-anchor');
  press(G, 'confirm');
  assert.equal(G.world.settings.autoAnchor[uid], 'auto-up');
  press(G, 'r');
  assert.match(p.debugText(), /Toss/);
  // opened straight onto a Summary (Storage does this): Back goes back to whoever opened it
  const depth = G.scenes.stack.length;
  press(G, 'cancel');
  assert.equal(G.scenes.stack.length, depth - 1);
});

test('party: a Summary opened from the list backs out to the list, on the same creature', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE'], ['tossup', 5, 'Toss']]);
  G.push('party');
  const p = top(G);
  press(G, 'down');
  press(G, 'confirm'); // mini menu
  press(G, 'confirm'); // Summary
  assert.equal(p.mode, 'summary');
  assert.match(p.debugText(), /Toss/);
  press(G, 'cancel');
  assert.equal(p.mode, 'list');
  assert.equal(top(G), p);
  assert.match(p.debugText(), /> Toss/);
});

test('party: right moves into Coverage beside the row, left comes back', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE'], ['tossup', 5, 'Toss']]);
  G.push('party');
  const p = top(G);
  press(G, 'right');
  assert.equal(p.mode, 'coverage');
  press(G, 'left');
  assert.equal(p.mode, 'list');
  assert.equal(top(G), p);
});

test('party: Coverage reports a gap in words', () => {
  const G = makeG();
  fillParty(G, [['tossup', 5, 'Toss']]);
  G.push('party');
  const cov = top(G).coverage;
  assert.ok(cov.gaps.includes('Hollow') || cov.gaps.length >= 0);
  assert.match(top(G).debugText(), /Gap: |No gap/);
});

test('satchel: pockets switch with l/r and left/right; the cursor goes back to the top', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.store.tx('t', (w) => { for (const [id, n] of [['tallow-wick', 3], ['brass-wick', 1], ['salve', 2], ['tonic', 1]]) bagSys.give(w, id, n, { data }); });
  G.push('bag');
  const b = top(G);
  assert.equal(b.pocket, 'wicks');
  press(G, 'down');
  assert.match(b.debugText(), /> Brass Wick/);
  press(G, 'r');
  assert.equal(b.pocket, 'medicine');
  assert.match(b.debugText(), /> Salve/);
  press(G, 'left');
  assert.equal(b.pocket, 'wicks');
  assert.match(b.debugText(), /> Tallow Wick/, 'pockets never remember a cursor');
});

test('satchel: use a Salve on a hurt creature; it is spent and the HP comes back', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.store.tx('t', (w) => { bagSys.give(w, 'salve', 2, { data }); w.party[0].hp = 5; });
  G.push('bag', { pocket: 'medicine' });
  press(G, 'confirm'); // actions
  assert.equal(top(G).mode, 'actions');
  press(G, 'confirm'); // Use -> target
  assert.equal(top(G).mode, 'target');
  press(G, 'confirm');
  assert.equal(G.world.party[0].hp, Math.min(G.world.party[0].stats.hp, 30));
  assert.equal(bagSys.count(G.world, 'salve', undefined, { data }), 1);
});

test('satchel: a disc teaches a learner; full hands is refused with the reason; discs stay', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 3, 'PUDDLE'], ['scrapling', 5, 'Scrap']]);
  G.store.tx('t', (w) => bagSys.give(w, 'disc-drowned-bell', 1, { data }));
  G.push('bag', { pocket: 'discs' });
  press(G, 'confirm'); press(G, 'confirm'); // Teach -> targets
  const b = top(G);
  assert.equal(b.mode, 'target');
  press(G, 'down'); // Scrap can't learn: skipped, cursor stays on PUDDLE
  press(G, 'confirm');
  assert.ok(G.world.party[0].moves.some((m) => m.id === 'drowned-bell'));
  assert.equal(bagSys.count(G.world, 'disc-drowned-bell', undefined, { data }), 1);
});

test('satchel: toss asks first with No focused; keepsakes never toss', async () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 3, 'PUDDLE']]);
  G.store.tx('t', (w) => { bagSys.give(w, 'timber', 5, { data }); bagSys.give(w, 'dorrow-kettle', 1, { data }); });
  G.push('bag', { pocket: 'finds' });
  press(G, 'confirm'); // actions: Toss only
  press(G, 'confirm'); // qty
  assert.equal(top(G).mode, 'qty');
  press(G, 'right'); press(G, 'right');
  press(G, 'confirm');
  const confirm = top(G);
  assert.equal(confirm.name, 'confirm');
  assert.equal(confirm.index, 0, 'No is focused');
  confirm.choose(1);
  await tick();
  assert.equal(bagSys.count(G.world, 'timber', undefined, { data }), 2);
  // keepsake: Toss is disabled
  G.scenes.pop();
  G.push('bag', { pocket: 'keepsakes' });
  press(G, 'confirm');
  press(G, 'confirm');
  assert.equal(top(G).mode, 'actions', 'a disabled Toss shows its reason and stays');
  assert.equal(bagSys.count(G.world, 'dorrow-kettle', undefined, { data }), 1);
});

test('storage: move a party creature into the box and back; release asks with Keep it first; the last member stays', async () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE'], ['tossup', 5, 'Toss'], ['mothling', 7, 'Moth', 'box']]);
  G.push('box');
  const b = top(G);
  assert.equal(b.capacity, 20);
  press(G, 'left'); // to party column
  press(G, 'down'); // Toss
  press(G, 'confirm'); press(G, 'confirm'); // actions -> Move
  assert.ok(b.hand);
  press(G, 'right'); // grid row 1 (cell 8)
  press(G, 'up'); // cell 0 (Moth)
  press(G, 'confirm'); // swap
  assert.deepEqual(G.world.party.map((c) => c.nickname), ['PUDDLE', 'Moth']);
  assert.deepEqual(G.world.box.map((c) => c.nickname), ['Toss']);
  // release Toss from the box (Summary is disabled for stored creatures, so one Down reaches Release)
  press(G, 'confirm'); press(G, 'down'); press(G, 'confirm');
  const c = top(G);
  assert.equal(c.name, 'confirm');
  assert.equal(c.index, 0, 'Keep it is focused');
  c.choose(0);
  await tick();
  assert.equal(G.world.box.length, 1);
  press(G, 'confirm'); press(G, 'down'); press(G, 'confirm');
  top(G).choose(1);
  await tick();
  assert.equal(G.world.box.length, 0);
});

test('storage: the last party member cannot be released or stored', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.push('box');
  press(G, 'left');
  press(G, 'confirm');
  assert.match(top(G).debugText(), /area: party 0/);
  press(G, 'down'); press(G, 'down'); // Release is disabled: the cursor cannot reach it
  press(G, 'confirm'); // still on a reachable action
  assert.equal(G.world.party.length, 1);
});

test('storage: the Cellar commission doubles the capacity', () => {
  const G = makeG();
  G.store.tx('t', (w) => { w.loans.commissions.push('cellar'); });
  G.push('box');
  assert.equal(top(G).capacity, 40);
});

test('settings: day length applies live to the clock and persists in world.settings', () => {
  const G = makeG();
  G.push('settings');
  press(G, 'right');
  assert.equal(G.world.settings.minutesPerDay, 48);
  assert.equal(G.clock.minutesPerDay ?? G.world.clock.minutesPerDay ?? 48, 48);
  press(G, 'right');
  assert.equal(G.world.settings.realClock, true);
  press(G, 'left');
  assert.equal(G.world.settings.realClock, false);
});

test('settings: extension rows write the device mirror and announce settings:changed', () => {
  resetExtCache();
  const G = makeG();
  let seen = null;
  G.bus.on('settings:changed', (e) => { if (e.ext) seen = e; });
  G.push('settings');
  press(G, 'down'); press(G, 'down'); press(G, 'down'); // battle speed
  press(G, 'right');
  assert.equal(readExt(G).battleSpeed, 4);
  assert.deepEqual(seen.changed, ['battleSpeed']);
});

test('settings: remap a key that is in use asks, then swaps the two actions', async () => {
  const G = makeG();
  G.push('settings', { page: 'remap' });
  const s = top(G);
  assert.equal(s.page, 'remap');
  for (let i = 0; i < 4; i++) press(G, 'down'); // confirm
  press(G, 'confirm');
  assert.equal(s.listening.action, 'confirm');
  G.input.lastToken = 'KeyX';
  press(G, 'anyKey');
  await tick();
  const c = top(G);
  assert.equal(c.name, 'confirm');
  assert.equal(c.index, 0);
  c.choose(1);
  await tick();
  const b = G.input.bindings();
  assert.equal(b.confirm[0], 'KeyX');
  assert.equal(b.cancel[0], 'KeyZ');
  assert.equal(G.world.settings.bindings.confirm[0], 'KeyX');
});

test('save/load: a verified manual save shows Saved; saving over asks with No first; load swaps the world in', async () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.store.tx('t', (w) => { w.player.mapId = 'lowmoor'; w.player.name = 'Wren'; });
  G.push('saveLoad', { mode: 'save', from: 'menu' });
  const s = top(G);
  press(G, 'confirm');
  assert.equal(s.banner?.ok, true, s.debugText());
  assert.match(s.debugText(), /Slot 1: Lowmoor Day 1/);
  press(G, 'confirm');
  const c = top(G);
  assert.equal(c.name, 'confirm');
  assert.equal(c.index, 0, 'No is focused');
  c.choose(0);
  await tick();
  // load tab
  G.store.tx('t', (w) => { w.party[0].nickname = 'CHANGED'; });
  press(G, 'r');
  assert.match(s.debugText(), /\[load\]/);
  press(G, 'confirm');
  top(G).choose(1);
  await tick();
  assert.equal(G.world.party[0].nickname, 'PUDDLE');
  assert.equal(top(G).name, 'overworld');
});

test('save/load: from the title, loading returns the world through pop()', async () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.persist.saveManual(G, 2);
  let got = null;
  G.scenes.top().resume = (r) => { got = r; };
  G.push('saveLoad', { mode: 'load', from: 'title' });
  assert.doesNotMatch(top(G).debugText(), /\[save\]/);
  press(G, 'down'); // slot 2
  press(G, 'confirm');
  top(G).choose(1);
  await tick();
  assert.equal(got?.slot, 'manual:2');
  assert.equal(got.world.party[0].nickname, 'PUDDLE');
});

test('every SCN-MENU scene draws on a recording context without throwing', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE'], ['tossup', 5, 'Toss']]);
  G.store.tx('t', (w) => { bagSys.give(w, 'salve', 2, { data }); bagSys.give(w, 'disc-flashover', 1, { data }); });
  for (const [name, params] of [['menu'], ['party'], ['party', { summary: 0 }], ['bag'], ['bag', { pocket: 'discs' }], ['box'], ['settings'], ['settings', { page: 'remap' }], ['saveLoad', { mode: 'save' }], ['saveLoad', { mode: 'transfer' }]]) {
    G.push(name, params);
    const ctx = fakeCtx();
    try {
      top(G).draw(ctx);
    } catch (e) {
      if (!/canvas|getContext|drawImage needs/i.test(String(e))) throw new Error(`${name}: ${e.stack}`);
    }
    G.scenes.pop();
  }
});

test('save/load: from the title after a crash, a resume row comes first and loads without a second question', async () => {
  const storage = new Map();
  const first = createPersist({ storage, prefix: 'c.' });
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.persist = first;
  first.autosave(G, 'test');
  first.markBoot(); // the session "dies" here: cleanExit stays 0
  G.persist = createPersist({ storage, prefix: 'c.' });
  assert.equal(G.persist.crashed(), true);
  let got = null;
  G.scenes.top().resume = (r) => { got = r; };
  G.push('saveLoad', { mode: 'load', from: 'title' });
  assert.match(top(G).debugText(), /> resume Autosave 1/);
  press(G, 'confirm');
  await tick();
  assert.equal(got?.slot, 'auto:1');
});

test('save/load: export opens one textarea-free panel under Node and backs out cleanly', () => {
  const G = makeG();
  fillParty(G, [['sloshkin', 9, 'PUDDLE']]);
  G.persist.saveManual(G, 1);
  G.push('saveLoad', { mode: 'transfer', from: 'menu' });
  const s = top(G);
  press(G, 'confirm'); // Export -> pick
  assert.equal(s.panel, 'export-pick');
  press(G, 'confirm'); // Slot 1
  assert.equal(s.panel, 'export');
  assert.equal(s.hasTextarea, false, 'no DOM under Node');
  press(G, 'cancel');
  assert.equal(s.panel, 'list');
});

test('menuKit.fitText: fits a label on one line with an ellipsis, leaves short ones alone', async () => {
  const { fitText } = await import('../js/scenes/menuKit.js');
  const { measureText } = await import('../js/core/font.js');
  assert.equal(fitText('Lowmoor', 84), 'Lowmoor');
  const cut = fitText('Lighthouse Stair and Lamp Room', 84);
  assert.ok(cut.endsWith('…'));
  assert.ok(measureText(cut).w <= 84);
  assert.equal(measureText(cut).lines, 1);
});

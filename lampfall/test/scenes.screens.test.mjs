// Screens, menus and economy prompts (audit lane: LG-RN104 Journal tabs, LG-PF2 map labels +
// objective, MID-09 Lantern-paths, MID-11 room commissions at the yard, LG-RN108 storage reorder,
// LG-RN130 name entry under the slip, LG-PF5 empty-state next steps). Drives the real scenes with
// a real store + registry and a scriptable input; drawing is checked on a recording context.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeInput, fakeCtx, installFakeCanvas } from './ui.fakes.mjs';
import { sceneFactories } from '../js/scenes/index.js';
import { createNewWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createPersist } from '../js/state/persist.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { createClock } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import * as partySys from '../js/systems/party.js';
import { makeRng } from '../js/core/rng.js';
import { TUNING } from '../js/data/tuning.js';
import { DEFAULT_BINDINGS } from '../js/core/input.js';
import * as pixelart from '../js/core/pixelart.js';

installFakeCanvas(pixelart);
const data = createRegistry(DATA_CONTENT);

/** A G with a real store, the live registry, persist (memory) and clock, and a tiny scene stack. */
function makeG(opts = {}) {
  const store = createStore(createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: opts.challenges ?? [] }));
  const clock = createClock(clockSys.optionsFrom(store.world));
  const stack = [];
  const input = fakeInput();
  let bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
  input.bindings = () => JSON.parse(JSON.stringify(bindings));
  input.loadBindings = (doc) => { bindings = JSON.parse(JSON.stringify(doc.bindings)); return true; };
  input.resetBindings = () => { bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); };
  input.lastPressedToken = () => null;
  const events = [];
  const G = {
    store, get world() { return store.world; }, bus: store.bus, data, input, clock,
    flags: { noanim: true },
    persist: createPersist({ storage: new Map(), prefix: 't.' }),
    toasts: { show: (text) => events.push(['toast', text]) },
    audio: { sfx() {}, setVolumes() {} },
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

function giveParty(G, specs, to) {
  G.store.tx('test:party', (w) => {
    const rng = makeRng('t');
    for (const s of specs) partySys.giveCreature(w, { species: s[0], level: s[1] }, data, rng, { tuning: TUNING, to });
  });
}

const speciesIds = () => data.list('species').filter((s) => !s.legendary).slice(0, 12).map((s) => s.id);

test('LG-RN130: the name-entry panel is not covered by the old dialogue slip', () => {
  const G = makeG();
  giveParty(G, [[speciesIds()[0], 5]]);
  const uid = G.world.party[0].uid;
  G.push('dialogue', { ops: [{ op: 'nickname', who: uid }] });
  const dlg = G.scenes.top();
  for (let i = 0; i < 30; i++) dlg.update(16);
  assert.equal(dlg.state, 'entry');
  const ctx = fakeCtx();
  const draws = [];
  const raw = ctx.drawImage;
  ctx.drawImage = (...a) => { draws.push(a); return raw(...a); };
  dlg.draw(ctx);
  const slipAt = draws.filter((a) => a[1] === 8 && a[2] === 198);
  assert.equal(slipAt.length, 0, 'no slip panel drawn at 8,198 while typing a name');
});

function press(G, ...actions) {
  G.input.press(...actions);
  G.scenes.top().handleInput(G.input);
  G.input.clear();
  G.scenes.top().update?.(16);
}
const top = (G) => G.scenes.top();

test('LG-RN108: party.boxMove / boxSwap reorder storage and keep it dense', () => {
  const G = makeG();
  const sp = speciesIds();
  giveParty(G, [[sp[0], 5]]);
  giveParty(G, [[sp[1], 5], [sp[2], 5], [sp[3], 5]], 'box');
  const ids = () => G.world.box.map((c) => c.uid);
  const [a, b, c] = ids();
  assert.deepEqual(G.store.tx('t', (w) => partySys.boxSwap(w, a, c)), { ok: true });
  assert.deepEqual(ids(), [c, b, a]);
  assert.deepEqual(G.store.tx('t', (w) => partySys.boxMove(w, c, 99)), { ok: true, index: 2 });
  assert.deepEqual(ids(), [b, a, c]);
  assert.deepEqual(G.store.tx('t', (w) => partySys.boxMove(w, c, 0)), { ok: true, index: 0 });
  assert.deepEqual(ids(), [c, b, a]);
  assert.equal(G.store.tx('t', (w) => partySys.boxMove(w, 'nope', 0)).reason, 'not-in-box');
  assert.equal(G.store.tx('t', (w) => partySys.boxSwap(w, a, G.world.party[0].uid)).reason, 'not-in-box');
});

test('LG-RN108: Storage drops a stored creature onto another cell (swap) or an empty cell (move)', () => {
  const G = makeG();
  const sp = speciesIds();
  giveParty(G, [[sp[0], 5]]);
  giveParty(G, [[sp[1], 5], [sp[2], 5], [sp[3], 5]], 'box');
  const [a, b, c] = G.world.box.map((x) => x.uid);
  G.push('box');
  press(G, 'confirm'); press(G, 'confirm'); // cell 0 -> actions -> Move
  assert.ok(top(G).hand, 'holding the creature');
  press(G, 'right'); press(G, 'right'); // cell 2
  press(G, 'confirm');
  assert.deepEqual(G.world.box.map((x) => x.uid), [c, b, a]);
  assert.ok(!G.events.some((e) => /own order/.test(e[1])), 'no "keeps its own order" refusal');
  // now pick cell 0 (c) up and drop it on the empty cell 5: it moves to the end
  press(G, 'left'); press(G, 'left');
  press(G, 'confirm'); press(G, 'confirm');
  for (let i = 0; i < 5; i++) press(G, 'right');
  press(G, 'confirm');
  assert.deepEqual(G.world.box.map((x) => x.uid), [b, a, c]);
});

test('MID-20: knocking at a resident\'s dark porch names the resident, never "nobody has lived here"', async () => {
  const { knockText } = await import('../js/systems/flow/interactFlow.js');
  const G = makeG();
  for (const hour of [3, 10, 15, 21]) {
    G.store.tx('t:clock', (w) => { w.clock.total = 1440 * 3 + hour * 60; });
    for (const [porch, npc] of [['porch-dorrow', 'wick'], ['porch-odile', 'odile'], ['porch-bryony', 'bryony'], ['porch-thessaly', 'thessaly']]) {
      const s = knockText(G, porch, npc, false);
      assert.ok(!/Nobody has lived here/.test(s), `${porch} at ${hour}: ${s}`);
      assert.ok(s.includes(data.get('npcs', npc).name), `${porch} names the resident: ${s}`);
    }
  }
  G.store.tx('t:clock', (w) => { w.clock.total = 1440 * 3 + 3 * 60; });
  assert.match(knockText(G, 'porch-odile', 'odile', false), /asleep/);
  // genuinely empty houses keep the empty-house line
  assert.match(knockText(G, 'porch-dark-3', null, false), /Nobody has lived here for years/);
  assert.match(knockText(G, 'porch-dark-1', 'tamsin', false), /Nobody has lived here for years/);
  assert.match(knockText(G, 'porch-dark-3', null, true), /lamp is on/);
});

test('LG-PF5: the empty mailbox says Hesper needs a lit porch until yours is lit', async () => {
  const { mailboxEmptyText } = await import('../js/systems/flow/interactFlow.js');
  const G = makeG();
  assert.match(mailboxEmptyText(G), /lit porch/);
  assert.doesNotMatch(mailboxEmptyText(G), /Post comes at six/);
  G.store.tx('t:tier', (w) => { w.loans.tier = 2; });
  assert.match(mailboxEmptyText(G), /Post comes at six/);
});

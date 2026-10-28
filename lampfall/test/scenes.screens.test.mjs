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
/** A recording context with the few extra methods the full-screen pages call. */
const ctx2d = () => Object.assign(fakeCtx(), { scale() {}, strokeRect() {}, setLineDash() {}, moveTo() {}, lineTo() {}, stroke() {}, strokeStyle: '#000' });

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

// ---- MID-11: room commissions at the yard -------------------------------------------------------
async function payAtYard(G, pickIndex = 0) {
  const { doInteraction } = await import('../js/systems/flow/interactFlow.js');
  const { createCeremonyScene } = await import('../js/scenes/fieldOverlays.js');
  const pushed = [];
  const host = {
    mapId: 'pellwick',
    ask: async () => pickIndex,
    toast: (text) => G.events.push(['toast', text]),
    overlays: { createCeremonyScene },
    pushScene: (s, p) => { pushed.push(s); G.scenes.push(s, p); },
  };
  const res = await doInteraction(G, { verb: 'pay', target: { id: 'yard-counter' } }, host);
  return { res, ceremony: pushed[0] ?? null };
}
function runCeremony(G, cer, steps) {
  for (let i = 0; i < 2000 && cer.phase === 'count'; i++) cer.update(16);
  for (const s of steps) { press(G, s); }
}
function readyToClear(G, tier) {
  G.store.tx('t:loan', (w) => {
    w.loans.tier = tier; w.loans.paid = 0;
    w.loans.tally = Array.from({ length: tier - 1 }, (_, i) => ({ tier: i + 1, day: 1 }));
    w.clock.total = 1440 * 2 + 12 * 60;
  });
  const owed = (G.data.get('loans', `tier-${tier}`).amount);
  G.store.tx('t:cash', (w) => { w.wallet.main = owed; });
}

test('MID-11: clearing loan 3 at the yard opens the chalk plan before the roof and queues the room', async () => {
  const loans = await import('../js/systems/loans.js');
  const G = makeG();
  readyToClear(G, 3);
  assert.equal(loans.needsCommission(G.world, { data }), true, 'loan 3 is waiting on a room');
  const { res, ceremony } = await payAtYard(G, 0);
  assert.equal(res.ok, true);
  assert.ok(ceremony, 'ceremony pushed');
  assert.equal(G.world.loans.tier, 4, 'loan 3 cleared');
  runCeremony(G, ceremony, []);
  assert.equal(ceremony.phase, 'room', 'room first: the cleared loan has no room yet');
  press(G, 'right'); press(G, 'confirm'); // second room on the plan
  const room = loans.commissionRooms({ data })[1];
  assert.deepEqual([...G.world.loans.commissions], [room]);
  assert.ok(G.world.loans.builds.some((b) => b.tier === 3 && b.id === room && !b.done), 'its build is queued for tonight');
  assert.equal(ceremony.phase, 'roof', 'then its roof');
  press(G, 'right'); press(G, 'confirm');
  const b = G.world.loans.builds.find((x) => x.tier === 3);
  assert.notEqual(b.choice, null, 'the roof choice landed on the room build');
  // loan 4 is now offered and waiting on a room too: the plan shows again after the roof
  assert.equal(ceremony.phase, 'room');
  press(G, 'cancel'); // later
  assert.equal(ceremony.phase, 'done');
  assert.equal(G.world.loans.commissions.length, 1);
});

test('MID-11: clearing loan 2 offers loan 3\'s room after the roof; Back leaves it for later', async () => {
  const G = makeG();
  readyToClear(G, 2);
  const { ceremony } = await payAtYard(G, 0);
  runCeremony(G, ceremony, []);
  assert.equal(ceremony.phase, 'roof');
  press(G, 'confirm');
  assert.equal(ceremony.phase, 'room');
  press(G, 'confirm');
  assert.equal(G.world.loans.commissions.length, 1, 'loan 3 has its room before it is paid');
  assert.equal(ceremony.phase, 'done');
});

test('MID-11: commissionPrompt is null when no pick is pending', async () => {
  const loans = await import('../js/systems/loans.js');
  const G = makeG();
  assert.equal(loans.commissionPrompt(G.world, null, { data }), null);
  readyToClear(G, 3);
  const p = loans.commissionPrompt(G.world, null, { data });
  assert.equal(p.tier, 3); assert.equal(p.roomFirst, false); assert.equal(p.rooms.length, 6);
  assert.ok(p.rooms.every((r) => r.name && typeof r.blurb === 'string'));
});

// ---- LG-RN102: settings that must take effect ----------------------------------------------------
test('LG-RN102: High contrast — the canvas filter and the dialogue slip in night ink with cream edges', async () => {
  const { displayFilterFor, COLORS } = await import('../js/ui/theme.js');
  const { resetExtCache } = await import('../js/scenes/menuKit.js');
  assert.equal(displayFilterFor({ highContrast: false }), '');
  assert.match(displayFilterFor({ highContrast: true }), /contrast\(/);
  const G = makeG();
  resetExtCache();
  const slipEdges = () => {
    G.push('dialogue', { text: 'Hello there.' });
    const dlg = G.scenes.top();
    for (let i = 0; i < 30; i++) dlg.update(16);
    const ctx = fakeCtx(); dlg.draw(ctx);
    G.scenes.pop();
    return ctx.calls.filter((c) => c[0] === 'fillRect' && c[1] === COLORS.paper.light && c[2] === 9 && c[3] === 198).length;
  };
  assert.equal(slipEdges(), 0, 'paper slip by default');
  G.store.tx('t:hc', (w) => { w.settings.highContrast = true; });
  resetExtCache();
  assert.equal(slipEdges(), 1, 'cream 2 px top edge on the night-ink slip');
});

test('LG-RN102: the ambience bus scales ambient layers and one-shots; default leaves the mix alone', async () => {
  const A = await import('../js/core/audio.js');
  assert.equal(A.ambienceScale(A.AMBIENCE_DEFAULT), 1);
  assert.equal(A.ambienceScale(0), 0);
  assert.ok(A.ambienceScale(1) > 1);
  for (const n of ['night', 'tide', 'rain', 'storm', 'night.bells']) assert.ok(A.isAmbientLayer(n), n);
  for (const n of ['core', 'melody', 'bass', 'perc', 'tense', 'battle']) assert.ok(!A.isAmbientLayer(n), n);
  const a = A.createAudio();
  assert.equal(a.getAmbience(), A.AMBIENCE_DEFAULT);
  assert.equal(a.setAmbience(0.25), 0.25);
  assert.equal(a.setAmbience('x'), 0.25, 'junk leaves it alone');
  assert.equal(a.setAmbience(5), 1);
  assert.deepEqual(Object.keys(a.getVolume()), ['master', 'music', 'sfx'], 'setVolume keeps its three buses');
});

// ---- LG-RN104 / LG-PF5: the Journal ----------------------------------------------------------------
test('LG-RN104: Pause → Journal opens the tabbed Journal, not the empty mailbox page', async () => {
  const { textLog } = await import('../js/scenes/scriptHost.js');
  const G = makeG();
  G.push('menu');
  const menu = top(G);
  const journalRow = menu.rows.findIndex((r) => r.id === 'journal');
  for (let i = 0; i < journalRow; i++) press(G, 'down');
  press(G, 'confirm');
  const j = top(G);
  assert.equal(j.name, 'letter');
  assert.equal(j.state, 'journal');
  assert.equal(j.journal.tab, 'letters');
  assert.doesNotMatch(j.debugText(), /mailbox is empty this morning/);
  assert.match(j.debugText(), /lit porch/, 'empty Letters says how to get post (LG-PF5)');
  // every tab draws and answers
  const seen = [];
  for (let i = 0; i < 5; i++) { seen.push(j.journal.tab); j.draw(ctx2d()); press(G, 'r'); }
  assert.deepEqual(seen, ['letters', 'stamps', 'seasonBook', 'seedCard', 'log']);
  assert.equal(j.journal.tab, 'letters', 'wraps');
  // log: the text log lines
  press(G, 'l');
  assert.equal(j.journal.tab, 'log');
  assert.match(j.debugText(), /Talk to someone/);
  textLog(G).push('Wren', 'Six thousand buttons, no interest.');
  j.journal.refresh();
  press(G, 'r'); press(G, 'l');
  assert.match(j.debugText(), /Wren: Six thousand buttons/);
  press(G, 'cancel');
  assert.equal(top(G).name, 'menu');
});

test('LG-RN104: Letters groups by channel and re-reads; Stamps count what holds; Season Book tallies', async () => {
  const lettersSys = await import('../js/systems/letters.js');
  const G = makeG();
  const k1 = lettersSys.lettersIn(data, 'keeper')[0];
  const f1 = lettersSys.lettersIn(data, 'family')[0];
  G.store.tx('t:letters', (w) => { w.letters.got.push(k1.n, f1.n); w.letters.read.push(k1.n); w.letters.delivered = 2; });
  G.store.tx('t:flags', (w) => { w.flags['sp.starter-chosen'] = true; w.flags['sp.first-payment'] = true; });
  G.push('letter', { journal: true });
  const j = top(G);
  const txt = j.debugText();
  assert.match(txt, /Keeper letters/); assert.match(txt, /Family letters/);
  assert.match(txt, new RegExp(`${lettersSys.labelOf(data, f1)} .*\\(unread\\)`));
  press(G, 'confirm');
  assert.equal(top(G).name, 'letter');
  assert.notEqual(top(G).state, 'journal', 'a plain letter on top');
  G.scenes.pop();
  assert.equal(top(G), j);
  press(G, 'r');
  assert.equal(j.journal.tab, 'stamps');
  assert.match(j.debugText(), /2 of 24 stamps/);
  assert.match(j.debugText(), /Someone Picked You/);
  press(G, 'r');
  assert.match(j.debugText(), /Loan 1 of 7/);
  assert.match(j.debugText(), /1 letter read/);
});

test('LG-RN104: the empty letter page is not time-of-day specific', () => {
  const G = makeG();
  G.push('letter', { from: 'mailbox' });
  const l = top(G);
  assert.doesNotMatch(l.debugText(), /this morning/);
  assert.match(l.debugText(), /porch/);
});

test('LG-PF2: currentObjective follows the story, the yard and the Spires', async () => {
  const { currentObjective, hasProgressGate } = await import('../js/scenes/menuModel.js');
  const G = makeG();
  const set = (o) => G.store.tx('t:f', (w) => Object.assign(w.flags, o));
  set({ 'sp.arrived': true });
  assert.match(currentObjective(G.world, data).text, /stones/);
  set({ 'sp.starter-chosen': true });
  let o = currentObjective(G.world, data);
  assert.equal(o.mapId, 'pellwick'); assert.match(o.text, /Wick/);
  // the errands start after the dock (sp.dock-battle); without it the dock-retry trigger is the beat
  set({ 'seen.wick-keeper': true, 'sp.reading-glass': true, 'sp.dock-battle': true, 'sp.errands-started': true });
  o = currentObjective(G.world, data);
  assert.match(o.text, /Errand/); assert.equal(o.mapId, 'pellwick');
  assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y));
  assert.equal(hasProgressGate({ not: { seen: 'x' } }), false);
  assert.equal(hasProgressGate({ all: [{ badge: 1 }, { not: { flag: 'y' } }] }), true);
  // with no beat ready: the room Wren waits on, then the next Spire
  const G2 = makeG();
  giveParty(G2, [[speciesIds()[0], 5]]); // a mid-game save: a party, no story beat waiting
  G2.store.tx('t', (w) => { w.loans.tier = 3; w.loans.tally = [{ tier: 1, day: 1 }, { tier: 2, day: 2 }]; });
  assert.equal(currentObjective(G2.world, data).kind, 'room');
  G2.store.tx('t', (w) => { w.loans.commissions.push('cellar'); });
  o = currentObjective(G2.world, data);
  assert.equal(o.kind, 'spire'); assert.match(o.text, /Turn Spire/); assert.equal(o.mapId, 'lowmoor');
});

test('LG-PF2: the pause menu shows the objective line; the local map shows names and the pin', async () => {
  const { mapLabels } = await import('../js/scenes/mapScreen.js');
  const G = makeG();
  G.store.tx('t:f', (w) => Object.assign(w.flags, { 'sp.arrived': true, 'sp.starter-chosen': true }));
  G.push('menu');
  assert.match(top(G).debugText(), /Next: Go home: Wick/);
  top(G).draw(ctx2d());
  G.scenes.pop();
  const names = mapLabels(data.get('maps', 'pellwick'), data).map((l) => l.text);
  for (const n of ['Your cottage', 'Co-op yard', 'Post office', 'Archive', 'Lighthouse']) assert.ok(names.includes(n), n);
  const low = mapLabels(data.get('maps', 'lowmoor'), data).map((l) => l.text);
  assert.ok(low.includes('Brackenford') && low.includes('Turn Spire'), low.join(','));
  G.push('mapScreen', {});
  const m = top(G);
  assert.equal(m.state().objective.mapId, 'pellwick');
  press(G, 'confirm'); // local chart of Pellwick
  assert.match(m.debugText(), /Your cottage/);
  assert.match(m.debugText(), /Next: Go home/);
  m.draw(ctx2d());
});

// ---- MID-09: Lantern-paths -------------------------------------------------------------------------
test('MID-09: Lantern-paths open with the second seal, to visited Waystones and home', async () => {
  const { lanternPathTo } = await import('../js/systems/flow/interactFlow.js');
  const G = makeG();
  assert.equal(lanternPathTo(G.world, data, 'lowmoor').reason, 'locked');
  G.store.tx('t:badges', (w) => { w.badges.push('turn', 'ward'); });
  assert.equal(lanternPathTo(G.world, data, 'lowmoor').reason, 'unlit', 'not visited on foot yet');
  assert.deepEqual(lanternPathTo(G.world, data, 'pellwick').to, { mapId: 'pellwick', x: 9, y: 23, facing: 'down' });
  G.store.tx('t:stone', (w) => { w.flags['sys.waystone.brackenford'] = 0; });
  const r = lanternPathTo(G.world, data, 'lowmoor');
  assert.equal(r.ok, true); assert.equal(r.stone, 'brackenford');
  assert.deepEqual(r.to, { mapId: 'lowmoor', x: 21, y: 22, facing: 'right' });
});

test('MID-09: every authored Waystone has a walkable tile beside it for the Lantern-path landing', async () => {
  const { TILES, DEFAULT_LEGEND } = await import('../js/data/tilesets.js');
  const { loadMap } = await import('../js/world/tilemap.js');
  for (const m of data.list('maps')) {
    const stone = (m.entities ?? []).find((e) => e.waystone);
    if (!stone) continue;
    const rm = loadMap(m, TILES, { legend: DEFAULT_LEGEND });
    const a = rm.tileAt(stone.x - 1, stone.y);
    assert.ok(a && !a.solid && !a.water, `${m.id}: west of ${stone.id}`);
    assert.ok(!(m.entities ?? []).some((e) => e.x === stone.x - 1 && e.y === stone.y), `${m.id}: nothing stands west of ${stone.id}`);
  }
});

test('MID-09: the map screen walks the Lantern-path from the local chart', async () => {
  const G = makeG();
  G.store.tx('t', (w) => { w.badges.push('turn', 'ward'); w.flags['sys.waystone.brackenford'] = 0; w.player.mapId = 'pellwick'; w.player.x = 30; w.player.y = 30; });
  G.push('mapScreen', {});
  const m = top(G);
  // select Lowmoor on the chart, open its local chart, confirm walks
  for (let i = 0; i < 9 && m.state().region !== 'lowmoor'; i++) press(G, 'right');
  assert.equal(m.state().region, 'lowmoor');
  press(G, 'confirm');
  assert.equal(m.state().local, true);
  assert.equal(m.state().lanternPath.ok, true);
  press(G, 'confirm'); // offers the path (GDD-09 §3.21: Stay first)
  assert.equal(top(G).name, 'confirm', 'a confirm is open');
  for (let i = 0; i < 60; i++) top(G).update(16); // past the confirm's input lock
  press(G, 'right'); press(G, 'confirm'); // Go
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual([G.world.player.mapId, G.world.player.x, G.world.player.y], ['lowmoor', 21, 22]);
  assert.notEqual(top(G), m, 'the map closed back to the field');
  assert.ok(G.events.some((e) => /Lantern-path/.test(e[1])), 'a toast says so');
});

test('LG-RN102: path view hold/toggle rule', async () => {
  const { pathViewNext } = await import('../js/render/mapRenderer.js');
  assert.equal(pathViewNext('toggle', false, { pressed: true }), true);
  assert.equal(pathViewNext('toggle', true, { pressed: false, held: true }), true);
  assert.equal(pathViewNext('toggle', true, { pressed: true }), false);
  assert.equal(pathViewNext('hold', false, { held: true }), true);
  assert.equal(pathViewNext('hold', true, { held: false }), false);
});

// ---- verifier regressions --------------------------------------------------------------------------
test('MID-09: a second Confirm on the local chart never moves the player: Stay goes back to the chart', async () => {
  const G = makeG();
  G.store.tx('t', (w) => { w.badges.push('turn', 'ward'); w.player.mapId = 'pellwick'; w.player.x = 30; w.player.y = 30; });
  G.push('mapScreen', {});
  const m = top(G);
  assert.equal(m.state().region, 'pellwick');
  press(G, 'confirm'); // local chart of Pellwick: the path home is lit
  assert.equal(m.state().local, true);
  assert.equal(m.state().lanternPath.ok, true);
  press(G, 'confirm'); // offer
  assert.equal(top(G).name, 'confirm');
  assert.equal(top(G).index, 0, 'Stay is focused');
  for (let i = 0; i < 60; i++) top(G).update(16);
  press(G, 'confirm'); // Stay
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(top(G), m, 'still on the map screen');
  assert.deepEqual([G.world.player.mapId, G.world.player.x, G.world.player.y], ['pellwick', 30, 30], 'nobody moved');
  assert.equal(m.state().local, false, 'back to the isles chart');
});

test('LG-PF2: before the starter, the objective is the causeway, not the first Spire', async () => {
  const { currentObjective } = await import('../js/scenes/menuModel.js');
  const G = makeG();
  assert.equal(currentObjective(G.world, data).kind, 'story');
  assert.match(currentObjective(G.world, data).text, /causeway/);
});

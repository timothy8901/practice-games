// Regressions for the final core fix pass (FE-02, ...). Run: node --test test/final-fix-core.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/flow/battleFlow.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import * as bag from '../js/systems/bag.js';
import { DATA_CONTENT } from '../js/data/content.js';

const data = realBattleData();
const tuning = F.tuningFor(data);

function makeG(seedCode = 'FLUX-K7Q2-MD7F') {
  const store = createStore(createNewWorld({ seedCode }));
  const events = [];
  const bus = { emit: (e, p) => { events.push([e, p]); return store.bus.emit(e, p); }, on: (...a) => store.bus.on(...a) };
  return { store, get world() { return store.world; }, bus, rngs: createRngs(store), push: () => {}, events };
}

function give(G, spec) {
  return G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, ...spec }, data);
    return party.addCreature(w, c, data, { tuning, caught: true });
  });
}

const damaging = (c) => c.moves.some((m) => creature.isDamagingMove(data.moves?.[m.id] ?? DATA_CONTENT.moves?.find?.((x) => x.id === m.id)));

/** Every `startBattle` op with a wild in the story scripts. */
function storyWilds() {
  const out = [];
  const walk = (node, id) => {
    if (Array.isArray(node)) { for (const n of node) walk(n, id); return; }
    if (!node || typeof node !== 'object') return;
    const wild = node.op === 'startBattle' ? (node.wild ?? node.setup?.wild) : null;
    if (wild) out.push({ id, wild });
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v, id);
  };
  const scripts = DATA_CONTENT.scripts;
  const entries = Array.isArray(scripts) ? scripts.map((s) => [s.id, s]) : Object.entries(scripts ?? {});
  for (const [id, s] of entries) walk(s, id);
  return out;
}

describe('FE-02: a story capture joins able to hit', () => {
  it('the Capture Stance Tossup (Settle only in the fight) joins with a damaging move', () => {
    const G = makeG();
    give(G, { speciesId: 'scrapling', level: 6 });
    G.store.tx('wicks', (w) => bag.give(w, 'isoldes-lantern', 1, { data }));
    const s = F.buildBattle(G, { kind: 'wild', story: true, scripted: true, wild: { speciesId: 'tossup', level: 4, moves: ['settle'] } }, data);
    assert.deepEqual(s.battle.sides[1].party[0].moves.map((m) => m.id), ['settle'], 'the wild only Settles');
    s.battle.step(F.prepareAction(s, { type: 'lantern', grade: 'sure' }));
    const post = F.applyBattleResult(G, s, { bus: F.createDeferredBus() });
    assert.equal(post.outcome, 'capture');
    const penny = G.world.party.find((c) => c.uid === post.caught.uid);
    assert.ok(damaging(penny), `caught moves: ${penny.moves.map((m) => m.id)}`);
    assert.ok(penny.moves.every((m) => m.pp === m.maxPp && m.maxPp > 0));
  });

  it('every story wild, once caught, has at least one damaging move', () => {
    const wilds = storyWilds();
    assert.ok(wilds.length >= 1, 'found the scripted wilds');
    for (const { id, wild } of wilds) {
      if (!wild.speciesId) continue;
      const c = creature.makeCreature({ uid: 'x1', speciesId: wild.speciesId, level: wild.level ?? 5, moves: wild.moves ?? undefined, tuning }, data);
      creature.ensureDamagingMove(c, data, { tuning });
      assert.ok(damaging(c), `${id}: ${wild.speciesId} caught with ${c.moves.map((m) => m.id)}`);
    }
  });

  it('a catch that already hits keeps its own moves', () => {
    const c = creature.makeCreature({ uid: 'x1', speciesId: 'tossup', level: 9, moves: ['tap', 'settle'], tuning }, data);
    assert.equal(creature.ensureDamagingMove(c, data, { tuning }), false);
    assert.deepEqual(c.moves.map((m) => m.id), ['tap', 'settle']);
  });
});

describe('FE-09: the missed-raise line only counts what it moved', () => {
  it('pinned at the cap, a miss adds 0 shown points and the row says it is at the cap', () => {
    const G = makeG();
    give(G, { speciesId: 'scrapling', level: 6 });
    G.store.tx('wicks', (w) => bag.give(w, 'tallow-wick', 5, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    const foe = s.battle.foeOf(0);
    foe.hp = 1;
    s.battle.captureFails.set(foe.uid, 1);
    const row = F.captureMenu(s).rows.find((r) => !r.sure);
    assert.equal(row.pct, 95);
    assert.equal(row.missBonusPct, 0);
    assert.equal(row.atCap, true);
  });

  it('fresh at full HP, two misses add what the odds actually rose by', () => {
    const G = makeG();
    give(G, { speciesId: 'scrapling', level: 6 });
    G.store.tx('wicks', (w) => bag.give(w, 'tallow-wick', 5, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    const before = F.captureMenu(s).rows.find((r) => !r.sure);
    s.battle.captureFails.set(s.battle.foeOf(0).uid, 2);
    const row = F.captureMenu(s).rows.find((r) => !r.sure);
    assert.equal(row.missBonusPct, row.pct - before.pct);
    assert.ok(row.missBonusPct > 0);
    assert.equal(row.atCap, false);
  });
});

describe('LF-12: KO EXP is earned at the KO', () => {
  it('a creature that KOs a foe and faints later still earns it, and a later loss keeps it', () => {
    const G = makeG();
    give(G, { speciesId: 'scrapling', level: 12, nickname: 'LEAD' });
    give(G, { speciesId: 'sloshkin', level: 12, nickname: 'BACK' });
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'pip' }, data);
    const b = s.battle;
    const [lead, back] = b.sides[0].party;
    const bestMove = () => { const lg = b.legal(0); let k = 0, sc = -1; lg.moves.forEach((m, i) => { const v = m.selectable ? (m.power || 0) : -1; if (v > sc) { sc = v; k = i; } }); return { type: 'move', move: k }; };
    b.sides[1].party[0].hp = 1;
    for (let i = 0; i < 30 && b.phase !== 'ended'; i++) {
      if (b.phase === 'replace') {
        if (b.pendingReplace.includes(0)) b.step({ type: 'switch', to: b.legal(0).switches.find((x) => x.selectable).index });
        else b.step(null);
        continue;
      }
      // after the first KO every creature of ours stands at 1 HP: the Wirewhisk wins
      if (b.sides[1].party[0].hp <= 0) { if (lead.hp > 0) lead.hp = 1; if (back.hp > 0) back.hp = 1; b.sides[1].party[1].hp = b.sides[1].party[1].stats.hp; }
      b.step(F.prepareAction(s, bestMove()));
    }
    assert.equal(b.outcome, 'loss');
    const r = b.result();
    const leadExp = r.exp.filter((e) => e.uid === lead.uid).reduce((a, e) => a + e.amount, 0);
    assert.ok(leadExp > 0, `the KO paid LEAD although it fainted later: ${JSON.stringify(r.exp)}`);
    assert.equal(b.koLog.length, 1, 'one foe fell');
  });
});

describe('LF-16: Relay sitters take bench EXP', () => {
  it('a Relay round passes the sitters to the engine as bench', () => {
    const G = makeG();
    for (const sp of ['scrapling', 'sloshkin', 'tossup', 'wirewhisk']) give(G, { speciesId: sp, level: 50 });
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'hallorans-spire', source: 'spire' }, data);
    assert.ok(s.relay, 'a Relay round');
    const sitters = s.battle.bench.map((c) => c.uid).sort();
    const picked = s.battle.sides[0].party.map((c) => c.uid);
    assert.equal(sitters.length, 4 - picked.length);
    assert.ok(sitters.every((u) => !picked.includes(u)));
    // win the round: every sitter gains the bench share
    for (const foe of s.battle.sides[1].party) foe.hp = 1;
    for (let i = 0; i < 30 && s.battle.phase !== 'ended'; i++) {
      if (s.battle.phase === 'replace') {
        if (s.battle.pendingReplace.includes(0)) s.battle.step({ type: 'switch', to: s.battle.legal(0).switches.find((x) => x.selectable).index });
        else s.battle.step(null);
        continue;
      }
      const lg = s.battle.legal(0);
      const k = lg.moves.findIndex((m) => m.selectable && m.power > 0);
      s.battle.step(F.prepareAction(s, { type: 'move', move: k }));
    }
    assert.equal(s.battle.outcome, 'win');
    const r = s.battle.result();
    for (const u of sitters) assert.ok(r.exp.some((e) => e.uid === u && e.amount > 0), `sitter ${u} gained EXP`);
    const post = F.applyBattleResult(G, s, { bus: F.createDeferredBus() });
    assert.ok(post);
  });
});

describe('LF-01: the Summit climbs in order', () => {
  it('Cass waits for Bastien, Idris for both; startBattle refuses out of turn', async () => {
    const G = makeG();
    G.data = data;
    assert.equal(F.summitBlocker(G.world, 'bastien-keeper'), null);
    assert.equal(F.summitBlocker(G.world, 'cass-keeper'), 'bastien-keeper');
    assert.equal(F.summitBlocker(G.world, 'idris-champion'), 'bastien-keeper');
    assert.equal(F.summitBlocker(G.world, 'maud-spire'), null, 'not a Summit trainer');
    G.store.tx('beat', (w) => { w.flags['sys.trainer.bastien-keeper'] = true; });
    assert.equal(F.summitBlocker(G.world, 'idris-champion'), 'cass-keeper');
    let pushed = 0;
    G.push = () => { pushed++; };
    await assert.rejects(F.startBattle(G, { kind: 'trainer', trainerId: 'idris-champion', source: 'spire' }), /in order: Cass Rune first/);
    assert.equal(pushed, 0, 'no battle pushed');
    G.store.tx('beat', (w) => { w.flags['sys.trainer.cass-keeper'] = true; });
    assert.equal(F.summitBlocker(G.world, 'idris-champion'), null);
  });
});

import { createForecastScene, readingOfferCards, readingPick, READING_CHOICE_FLAG, READING_RING_FLAG, READING_REROLLS } from '../js/scenes/forecast.js';
import * as flagsSys from '../js/systems/flags.js';

/** A minimal host for the Forecast scene: a store, a stack that records pops, a scripted input. */
function sceneHost(G) {
  const popped = [];
  const stack = [];
  G.scenes = { top: () => stack[stack.length - 1], pop: (r) => { stack.pop(); popped.push(r); } };
  G.battleData = data;
  const input = (keys = []) => ({ pressed: (k) => keys.includes(k), repeat: () => false, pointer: null });
  return { popped, stack, input };
}

describe('FE-01: a script Forecast never rolls into a closed window', () => {
  it('pops at once (closed) when the creature has no open window, and rolls when it has one', () => {
    const G = makeG();
    give(G, { speciesId: 'scrapling', level: 8 });
    const h = sceneHost(G);
    const uid = G.world.party[0].uid;
    G.store.tx('used', (w) => { w.party[0].windowsUsed = [8]; });
    const sc = createForecastScene(G);
    h.stack.push(sc);
    sc.enter({ uid, from: 'script' });
    sc.update(16);
    assert.equal(h.popped.length, 1);
    assert.equal(h.popped[0].outcome, 'closed');
    assert.equal(G.world.party[0].speciesId, 'scrapling', 'no Shift');
    // with the window open the cards are drawn as before
    G.store.tx('open', (w) => { w.party[0].windowsUsed = []; });
    const sc2 = createForecastScene(G);
    h.stack.push(sc2);
    sc2.enter({ uid, from: 'script' });
    sc2.update(16);
    assert.equal(h.popped.length, 1, 'still open');
    assert.equal(sc2.mode, 'cards');
  });
});

describe('LF-02: the Reading offers its seventh-window cards with odds', () => {
  it('the cards are the Ring cards at the dial\'s steadied odds; a Reroll brings new faces', () => {
    const c0 = readingOfferCards('flux', data, 0);
    assert.deepEqual(c0.map((c) => c.name), ['Ring of the Light', 'Ring of the Tide', 'Ring of the Dark Water']);
    assert.equal(c0.reduce((a, c) => a + c.odds, 0), 100);
    const c1 = readingOfferCards('flux', data, 1);
    assert.notDeepEqual(c1.map((c) => c.name), c0.map((c) => c.name));
    assert.equal(readingPick([{ odds: 40 }, { odds: 40 }, { odds: 20 }], 0.1), 0);
    assert.equal(readingPick([{ odds: 40 }, { odds: 40 }, { odds: 20 }], 0.5), 1);
    assert.equal(readingPick([{ odds: 40 }, { odds: 40 }, { odds: 20 }], 0.95), 2);
  });

  it('Accept flips a card, names it and stores the ring; Reroll counts and closes', () => {
    const G = makeG();
    give(G, { speciesId: 'scrapling', level: 50 });
    const h = sceneHost(G);
    const sc = createForecastScene(G);
    h.stack.push(sc);
    sc.enter({ uid: 'reading', who: 'reading', from: 'script' });
    assert.equal(sc.mode, 'reading');
    for (let i = 0; i < 6; i++) sc.update(100);   // the 0.5 s input lock
    sc.handleInput(h.input(['confirm']));   // focus starts on Accept
    assert.equal(sc.mode, 'readingFlip');
    const ring = flagsSys.getFlag(G.world, READING_RING_FLAG);
    assert.match(String(ring), /^Ring of the /);
    assert.equal(flagsSys.getFlag(G.world, READING_CHOICE_FLAG), 'accept');
    for (let i = 0; i < 80; i++) sc.update(16.7);
    assert.equal(sc.mode, 'readingDone');
    sc.handleInput(h.input(['confirm']));
    assert.equal(h.popped[0].outcome, 'accepted');
    assert.equal(h.popped[0].result.ring, ring);
    // a Reroll: the counter goes up and the scene closes for the night to go on
    const sc2 = createForecastScene(G);
    h.stack.push(sc2);
    sc2.enter({ uid: 'reading', who: 'reading', from: 'script' });
    for (let i = 0; i < 6; i++) sc2.update(100);
    sc2.handleInput({ pressed: () => false, repeat: (k) => k === 'right', pointer: null });
    sc2.handleInput({ pressed: () => false, repeat: (k) => k === 'right', pointer: null });
    sc2.handleInput(h.input(['confirm']));
    assert.equal(h.popped[1].outcome, 'rerolled');
    assert.equal(flagsSys.get(G.world, READING_REROLLS), 1);
  });
});

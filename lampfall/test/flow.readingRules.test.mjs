// The Reading's phase rules from data/spires.js THE_READING (MID-18, wave 2 story lane):
//  - the Reading opens with its own line, never 'A wild Vagary appeared'
//  - phase 2 (the Ward): a min-power 50 lattice over the whole body; weak hits do nothing
//  - phase 5 (the Relay): the creature that ended phase 4 sits phase 5 out (a forced send-in)
//  - phase 6 (the Mirror): +2 evasion that resets when phase 7 opens
// Run: node --test test/flow.readingRules.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/flow/battleFlow.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import { THE_READING } from '../js/data/spires.js';

const data = realBattleData();
const tuning = F.tuningFor(data);

function makeG(dial = 'flux') {
  const store = createStore(createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' }));
  store.tx('dial', (w) => { w.run.dial = dial; });
  return { store, get world() { return store.world; }, bus: store.bus, data, rngs: createRngs(store), push: () => {} };
}

function give(G, speciesId, level) {
  return G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, speciesId, level }, data);
    return party.addCreature(w, c, data, { tuning, caught: true });
  });
}

const reading = (G) => F.buildBattle(G, { kind: 'wild', source: 'reading', holdOut: 14, wild: { speciesId: 'vagary', reading: THE_READING } }, data).battle;

/** Plays one turn with the first selectable move (or the first selectable send-in). */
function turn(b, pick = 'first') {
  if (b.phase === 'replace') return b.step({ type: 'switch', to: b.legal(0).switches.find((s) => s.selectable).index });
  const moves = b.legal(0).moves.filter((m) => m.selectable);
  const m = pick === 'strong' ? moves.slice().sort((x, y) => (y.power || 0) - (x.power || 0))[0] : moves[0];
  return b.step({ type: 'move', move: m.index });
}

describe('MID-18: the Reading phase rules', () => {
  it('opens with the Reading line, not a wild encounter line', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    const b = reading(G);
    const texts = b.intro.map((e) => e.text || '').join(' | ');
    assert.doesNotMatch(texts, /A wild/);
    assert.match(texts, /settles on the Lantern Stack/);
  });

  it('the Ward phase puts a min-power 50 lattice on the Passenger: weak moves read "Blocked by Ward" and do nothing', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    const b = reading(G);
    assert.ok(!b.effectiveAbility(1)?.ward, 'phase 1 has no lattice');
    turn(b); turn(b);
    assert.equal(b._readingView().index, 1, 'phase 2 is open');
    const lattice = b.effectiveAbility(1);
    assert.deepEqual(lattice.ward, { kind: 'min-power', minPower: 50 });
    const weak = b.legal(0).moves.find((m) => m.category !== 'status' && m.power > 0 && m.power < 50);
    if (weak) assert.equal(weak.word, 'Blocked by Ward');
    // the readout on phase open says so
    turn(b); turn(b);
    assert.equal(b._readingView().index, 2);
    assert.equal(b.effectiveAbility(1)?.id === 'reading-lattice', false, 'the lattice is gone in phase 3');
  });

  it('verify: Crackdust brings the Ward phase lattice down like any Ward (the Ward Spire lesson)', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    G.store.tx('dust', (w) => { (w.bag.pockets.medicine ??= []).push({ id: 'crackdust', n: 2 }); });
    const b = reading(G);
    assert.equal(b._crackdustBlocked(0), `${b.active(1).nickname} has no Ward.`, 'phase 1: nothing to crack');
    turn(b); turn(b);
    assert.equal(b._readingView().index, 1, 'phase 2 is open');
    assert.equal(b._crackdustBlocked(0), null, 'the lattice is a Ward Crackdust can reach');
    b.step({ type: 'item', item: 'crackdust' });
    assert.notEqual(b.effectiveAbility(1)?.id, 'reading-lattice', 'suppressed: the lattice is down');
    assert.equal(b.effectiveAbility(1)?.id, b.active(1).ability, 'its own ability shows through');
  });

  it('the Relay phase benches the creature that ended phase 4: a forced send-in, and it cannot come back that phase', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    give(G, 'tossup', 30);
    const b = reading(G);
    const lead = b.active(0).uid;
    for (let i = 0; i < 8 && !(b.phase === 'replace'); i++) turn(b);
    assert.equal(b._readingView().index, 4, 'phase 5 has opened');
    assert.equal(b.phase, 'replace');
    assert.deepEqual(b.pendingReplace, [0]);
    const sw = b.legal(0).switches;
    assert.equal(sw.find((s) => b.sides[0].party[s.index].uid === lead).selectable, false);
    assert.throws(() => b.step({ type: 'switch', to: b.sides[0].active }), /ended the last phase/);
    turn(b);
    assert.notEqual(b.active(0).uid, lead);
    const back = b.sides[0].party.findIndex((c) => c.uid === lead);
    assert.throws(() => b.step({ type: 'switch', to: back }), /ended the last phase/);
    // after phase 5 the bench lifts
    turn(b); turn(b);
    assert.equal(b._readingView().index, 5);
    assert.equal(b.legal(0).switches[back].selectable, true);
  });

  it('a party of one is never benched (nobody else can read)', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    const b = reading(G);
    for (let i = 0; i < 9; i++) turn(b);
    assert.notEqual(b.phase, 'replace');
    assert.ok(b.legal(0).moves.some((m) => m.selectable));
  });

  it('the Mirror phase raises evasion by 2 and the decoys fade when phase 7 opens', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    give(G, 'tossup', 30);
    const b = reading(G);
    for (let i = 0; i < 12 && b._readingView().index < 5; i++) turn(b);
    assert.equal(b._readingView().index, 5);
    assert.equal(b.sides[1].vol.stages.eva, 2);
    const evs = [];
    for (let i = 0; i < 4 && b._readingView().index < 6; i++) evs.push(...turn(b));
    assert.equal(b._readingView().index, 6, 'phase 7 is open');
    assert.equal(b.sides[1].vol.stages.eva, 0);
    assert.ok(evs.some((e) => e.type === 'stat' && e.result === 'reset' && /decoys fade/.test(e.text)));
  });
});

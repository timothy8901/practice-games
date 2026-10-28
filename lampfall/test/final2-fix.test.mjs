// Regressions for the second final fix pass: FE-06 (Memory relearn is a fairness tool; Maud's ace),
// LF-02 (the Reading's offer through the Forecast cards), LF-15 (one "Received" at the handover),
// FE-20 / FE-14 (Corin's dock line, Maud's practice table), LF-01 (Summit order before the confirm,
// the Keepers' Hall door), the post-battle Shift offer, FE-23 / LF-22 (chip and challenge text),
// and the engine's lines living in data/strings.js.
// Run: node --test test/final2-fix.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as creature from '../js/systems/creature.js';
import { realBattleData } from '../js/scenes/battleData.js';
import { memoryNote } from '../js/scenes/forecast.js';
import { windowsToOffer, trainerEndLine } from '../js/scenes/battle.js';
import { readingRing, seedCardText } from '../js/scenes/seedCard.js';
import { chipBody } from '../js/ui/objectiveChip.js';
import { challengeBody, doInteraction } from '../js/systems/flow/interactFlow.js';
import { runWithFakeHost, interpolate } from '../js/script/runner.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { createNewWorld } from '../js/state/schema.js';
import { THE_READING, SPIRE_BY_ID } from '../js/data/spires.js';
import { TRAINER_BY_ID } from '../js/data/trainers.js';
import { PORCH_DUELS } from '../js/data/town.js';
import { receivedText } from '../js/data/scripts/story-acts.js';
import { resolveWarp } from '../js/world/warps.js';
import { has as hasString, t } from '../js/data/strings.js';
import * as bag from '../js/systems/bag.js';
import { makeGame } from './fixtures/townDriver.mjs';

const data = realBattleData();
const REG = createRegistry(DATA_CONTENT);
const script = (id) => REG.get('scripts', id);
const newWorld = () => createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' });
const says = (requests) => requests.filter((r) => r.op === 'say').map((r) => r.text);

describe('FE-06: Memory relearn is a fairness tool', () => {
  it('a Down-Shifted Scrapling (now a Sootling) gets Knuckle back at the desk; Scrapling\'s signature waits', () => {
    const c = creature.makeCreature({ uid: 'c1', speciesId: 'scrapling', level: 8, moves: ['knuckle', 'shadowbox', 'tap'] }, data);
    const r = creature.shiftTo(c, 'sootling', data, 'drift');
    assert.ok(r.toMemory.includes('knuckle'), `to Memory: ${r.toMemory}`);
    assert.ok(!creature.canLearn(creature.speciesOf(c, data), 'knuckle'), 'Sootling cannot learn Knuckle by level');
    c.memory.push('sure-pinch'); // Tossup's signature, parked by an earlier form
    assert.deepEqual(creature.relearnable(c, data), ['knuckle'], 'Knuckle comes back; another form\'s signature does not');
    assert.equal(creature.relearnFromMemory(c, 'sure-pinch', data), false);
    assert.equal(creature.relearnFromMemory(c, 'knuckle', data), true);
    assert.ok(c.moves.some((m) => m.id === 'knuckle'));
    assert.deepEqual(c.memory, ['sure-pinch']);
  });

  it('the Forecast result says where a parked move went (only moves the desk can teach back)', () => {
    const c = creature.makeCreature({ uid: 'c1', speciesId: 'scrapling', level: 8, moves: ['knuckle', 'shadowbox', 'tap'] }, data);
    const r = creature.shiftTo(c, 'sootling', data, 'drift');
    assert.equal(memoryNote(r.toMemory, c, data), 'Knuckle went to Memory: Barnaby can teach it back.');
    assert.equal(memoryNote([], c, data), '');
    c.memory.push('sure-pinch');
    assert.equal(memoryNote(['sure-pinch'], c, data), '', 'another form\'s signature is not promised');
  });

  it('the Turn dossier points to the desk; Maud\'s ace is Lv9 and Lowmoor posts 6', () => {
    const turn = SPIRE_BY_ID.turn;
    assert.match(turn.dossier.text, /Barnaby's desk at the Archive teaches it back, free/);
    assert.match(turn.dossier.text, /Bilgebob Lv9/);
    const tr = TRAINER_BY_ID['maud-spire'];
    assert.equal(tr.party.at(-1).level, 9);
    assert.equal(turn.curveLevel, 6);
    assert.equal(PORCH_DUELS.curveByBadges[0], 6);
  });
});

describe('LF-02: the Reading\'s offer is the Forecast card view', () => {
  it('the battle\'s last posted strip and the offered cards use the same Ring names', () => {
    const ph = THE_READING.phases;
    const posted = ph[ph.length - 2].next.cards.map((k) => k.aspect.name);
    const offered = ph[ph.length - 1].next.cards.map((k) => k.aspect.name);
    assert.deepEqual(posted, offered);
    assert.deepEqual(offered, ['Ring of the Light', 'Ring of the Tide', 'Ring of the Dark Water']);
  });

  it('the ending script opens the Reading offer, loops on Reroll / Anchor and names the ring on Accept', () => {
    const ops = script('the-reading');
    const w = newWorld();
    const answers = ['reroll', 'anchor', 'accept'];
    let n = 0;
    const { requests, runner } = runWithFakeHost(ops, { world: w, data: REG }, {
      startBattle: { outcome: 'holdout' },
      forecast: (req) => {
        assert.equal(req.who, 'reading');
        const choice = answers[n++];
        w.flags['np.keeper.reading-choice'] = choice;
        if (choice === 'accept') w.flags['np.keeper.reading-ring'] = 'Ring of the Tide';
        return { outcome: choice === 'accept' ? 'accepted' : 'closed' };
      },
    });
    assert.ok(runner.isDone());
    assert.equal(requests.filter((r) => r.op === 'forecast').length, 3, 'one offer per night');
    assert.equal(requests.filter((r) => r.op === 'choice').length, 0, 'no blind Accept/Anchor/Reroll list');
    const lines = says(requests);
    assert.ok(lines.some((l) => l.startsWith('Again! Again.')), 'the Reroll night');
    assert.ok(lines.some((l) => l.startsWith('Hold it. Hold it still.')), 'the Anchor night');
    assert.ok(lines.some((l) => l.startsWith('The Ring of the Tide lands. The Passenger settles into it')), lines.join('\n'));
    assert.equal(w.flags['sp.reading-done'], true);
  });

  it('a Forecast that closes without a choice ends the night on Accept (no stale Anchor loop)', () => {
    const w = newWorld();
    w.flags['np.keeper.reading-choice'] = 'anchor';
    const { requests, runner } = runWithFakeHost(script('the-reading'), { world: w, data: REG }, { startBattle: { outcome: 'holdout' }, forecast: { outcome: 'closed' } });
    assert.ok(runner.isDone());
    assert.equal(requests.filter((r) => r.op === 'forecast').length, 1);
    assert.ok(says(requests).some((l) => l.startsWith('The cards turn. One lands.')));
  });

  it('{flag:id} fills from the world; the Seed Card shows the ring', () => {
    const w = newWorld();
    w.flags['np.keeper.reading-ring'] = 'Ring of the Gale';
    assert.equal(interpolate('The {flag:np.keeper.reading-ring} lands.', { world: w }), 'The Ring of the Gale lands.');
    assert.equal(interpolate('{flag:nope}', { world: w }), '{flag:nope}');
    assert.equal(readingRing(w), 'Ring of the Gale');
    assert.match(seedCardText(w, REG), /The Reading: Ring of the Gale/);
    assert.equal(readingRing(newWorld()), null);
    assert.doesNotMatch(seedCardText(newWorld(), REG), /The Reading/);
  });
});

describe('LF-15: a badge gift is announced once, at the handover', () => {
  const run = (held) => {
    const w = newWorld();
    if (held) bag.give(w, 'scouting-prism', 1, { data: REG });
    const { requests } = runWithFakeHost(script('story-spire-weather-badge'), { world: w, data: REG, systems: { give: (ww, item, n) => bag.give(ww, item, n, { data: REG }) } }, { choice: 0 });
    return { w, toasts: requests.filter((r) => r.op === 'toast').map((r) => r.text) };
  };
  it('already granted by the battle: one "Received" toast, no second item', () => {
    const { w, toasts } = run(true);
    assert.deepEqual(toasts.filter((x) => x.startsWith('Received')), ['Received: Scouting Prism']);
    assert.equal(bag.count(w, 'scouting-prism', undefined, { data: REG }), 1);
  });
  it('not yet held (an older save): the handover gives it and toasts once', () => {
    const { w, toasts } = run(false);
    assert.deepEqual(toasts.filter((x) => x.startsWith('Received')), ['Received: Scouting Prism']);
    assert.equal(bag.count(w, 'scouting-prism', undefined, { data: REG }), 1);
  });
  it('the disc reads as a disc', () => {
    assert.equal(receivedText('disc-plumbline'), 'Received: Plumbline disc');
    assert.equal(receivedText('weatherglass'), 'Received: Weatherglass');
  });
});

describe('FE-20 / FE-14: the dock line and Maud\'s practice table', () => {
  it('Corin tells you to stand as long as you can', () => {
    const all = JSON.stringify(DATA_CONTENT.scripts);
    assert.ok(all.includes('You are not meant to win. Stand as long as you can; three turns is a hold. ~ Read, then choose.'));
    assert.ok(!all.includes('Hold three turns. ~'));
  });

  it('after a Reroll the cursor rests on Accept, and each Reroll turns a different hand', () => {
    const w = newWorld();
    const picks = [0, 0, 0, 0, 0, 2]; // five Rerolls, then Accept
    let k = 0;
    const defaults = [];
    const { requests, runner } = runWithFakeHost(script('maud-practice-table'), { world: w, data: REG }, {
      choice: (req) => { if (req.prompt && req.prompt.startsWith('Maud: Your move')) { defaults.push(req.defaultIndex ?? 0); return picks[k++]; } return 0; },
    });
    assert.ok(runner.isDone());
    assert.deepEqual(defaults, [0, 2, 2, 2, 2, 2], 'Reroll first, Accept after a Reroll');
    const hands = says(requests).filter((l) => l.startsWith('Maud pinches salt')).map((l) => l.replace(/^.*turn back\. /, ''));
    assert.equal(hands.length, 5);
    for (let i = 1; i < hands.length; i++) assert.notEqual(hands[i], hands[i - 1], `reroll ${i + 1} repeats ${hands[i]}`);
    assert.equal(new Set(hands).size, 4, 'the practice deck goes round four hands');
  });
});

describe('LF-01: the Summit climbs in order before any confirm', () => {
  const host = () => {
    const asks = [];
    const toasts = [];
    return { asks, toasts, h: { ask: async (spec) => { asks.push(spec); return 1; }, toast: (m) => toasts.push(m), startBattle: () => { throw new Error('no battle'); } } };
  };
  it('Cass before Bastien and Idris before both Keepers refuse with no Challenge prompt', async () => {
    const G = makeGame('LF01-ORDER');
    for (const id of ['cass-keeper', 'idris-champion']) {
      const { asks, toasts, h } = host();
      const r = await doInteraction(G, { verb: 'challenge', kind: 'npc', payload: { trainerId: id }, target: { def: { trainerId: id } } }, h);
      assert.equal(r.ok, false, id);
      assert.equal(r.reason, 'out-of-order', id);
      assert.equal(asks.length, 0, `${id}: no confirm`);
      assert.deepEqual(toasts, [t('summit.order', { who: 'Bastien Kell' })]);
    }
    G.store.tx('b', (w) => { w.flags['sys.trainer.bastien-keeper'] = true; });
    const { asks, toasts, h } = host();
    const r = await doInteraction(G, { verb: 'challenge', kind: 'npc', payload: { trainerId: 'idris-champion' }, target: { def: { trainerId: 'idris-champion' } } }, h);
    assert.equal(r.reason, 'out-of-order');
    assert.equal(asks.length, 0);
    assert.deepEqual(toasts, [t('summit.order', { who: 'Cass Rune' })]);
  });

  it('the Keepers\' Hall north door opens only after both Keepers, with its own line', () => {
    const map = REG.get('maps', 'keepers-hall');
    const door = map.warps.find((wp) => wp.to?.mapId === 'idris-hall');
    assert.ok(door.cond && typeof door.refusal === 'string' && /both Keepers/.test(door.refusal));
    const w = newWorld();
    assert.equal(resolveWarp(w, door, REG, 'high', { mapId: 'keepers-hall' }).ok, false);
    w.flags['sys.trainer.bastien-keeper'] = true;
    assert.equal(resolveWarp(w, door, REG, 'high', { mapId: 'keepers-hall' }).ok, false);
    w.flags['sys.trainer.cass-keeper'] = true;
    assert.equal(resolveWarp(w, door, REG, 'high', { mapId: 'keepers-hall' }).ok, true);
  });
});

describe('the post-battle Shift offer', () => {
  const world = { party: [{ uid: 'c1', hp: 20 }, { uid: 'c2', hp: 0 }], box: [] };
  it('a lost battle offers nothing; a fainted creature waits', () => {
    assert.deepEqual(windowsToOffer({ outcome: 'loss', windowsOpened: ['c1'] }, world), { offer: [], waits: ['c1'] });
    assert.deepEqual(windowsToOffer({ outcome: 'win', windowsOpened: ['c1', 'c2'] }, world), { offer: ['c1'], waits: ['c2'] });
  });
  it('a creature healed after a story battle but fainted in it still waits', () => {
    const battle = { sides: [{ party: [{ uid: 'c1', hp: 0 }] }] };
    assert.deepEqual(windowsToOffer({ outcome: 'holdout', windowsOpened: ['c1'] }, world, battle), { offer: [], waits: ['c1'] });
  });
});

describe('FE-23 / LF-22: chip and challenge text', () => {
  it('the chip drops "Next seal:" under its own NEXT label', () => {
    assert.equal(chipBody('Next seal: Ward Spire on Cairnhold (posted Lv13).'), 'Ward Spire on Cairnhold (posted Lv13).');
    assert.equal(chipBody('Errand: shake a tree in the first orchard.'), 'Errand: shake a tree in the first orchard.');
  });
  it('the challenge body capitalises the tactic tag', () => {
    const body = challengeBody(TRAINER_BY_ID['maud-spire']);
    assert.equal(body, 'Spire Leader. 2 creatures, up to Lv9. Posted scripted Shifts, one sure, one rolled.');
  });
  it('the overworld re-reads the objective on flag, loan and counter events', () => {
    const src = readFileSync(new URL('../js/scenes/overworld.js', import.meta.url), 'utf8');
    assert.match(src, /on\('flag:set', \(\) => \{[^}]*nextDirty = true/);
    assert.match(src, /'loan:tier', 'loan:commission', 'loan:roof', 'commons:built', 'counter:inc'/);
  });
});

describe('battle lines live in data/strings.js', () => {
  it('every engine msg key exists and the engine has no inline event text', () => {
    const src = readFileSync(new URL('../js/battle/engine.js', import.meta.url), 'utf8');
    const keys = new Set([...src.matchAll(/msg\(\s*'([A-Za-z]+)'/g)].map((m) => m[1]));
    for (const m of src.matchAll(/msg\([^'(]*\?\s*'([A-Za-z]+)'\s*:\s*'([A-Za-z]+)'/g)) { keys.add(m[1]); keys.add(m[2]); }
    assert.ok(keys.size > 100, `${keys.size} keys`);
    for (const k of keys) assert.ok(hasString(`battle.msg.${k}`), `battle.msg.${k}`);
    assert.doesNotMatch(src, /text: `/, 'no template text in emitted events');
    assert.doesNotMatch(src, /text: '[A-Z]/, 'no literal text in emitted events');
  });

  it('visiting leaders have duel lines, used in a Porch Duel', () => {
    for (const l of PORCH_DUELS.leaders) {
      const tr = TRAINER_BY_ID[l.trainer];
      assert.ok(tr.lines.duelWin && tr.lines.duelLose, l.trainer);
    }
    const tr = TRAINER_BY_ID['idris-champion'];
    assert.match(trainerEndLine({ trainer: tr, porchDuel: true }, 'win', data), /porch|ring/i);
    assert.match(trainerEndLine({ trainer: tr, porchDuel: false }, 'win', data), /time I took the ring off/);
  });
});

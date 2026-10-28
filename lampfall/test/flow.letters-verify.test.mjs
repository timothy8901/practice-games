// Adversarial verification of the letters lane (wave 2): regressions for what the verifier found.
//  - the Porch Duel slate is frozen once posted for an evening (a load or a second dawn hook does not
//    reshuffle it; a neighbour met at noon joins tomorrow), and the Commons slip lists the posted slate;
//  - a neighbour's duel is won once an evening: the offer comes off the slate and a second win the
//    same evening (after midnight, or after a reload) pays nothing;
//  - Hesper's counter names the resident a carried letter is for;
//  - Barnaby's desk pins finds donated before the string wall was wired, and their letters arrive.
// Run: node --test test/flow.letters-verify.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as flags from '../js/systems/flags.js';
import * as bag from '../js/systems/bag.js';
import * as fieldLog from '../js/systems/fieldLog.js';
import * as letters from '../js/systems/letters.js';
import { PORCH_DUELS } from '../js/data/town.js';
import { postedDuels, duelEvening, PORCH_DUEL_DAY_FLAG } from '../js/systems/townCommon.js';
import * as dayFlow from '../js/systems/flow/dayFlow.js';
import { duelSlipLines, carryingText, doorLines } from '../js/systems/flow/interactFlow.js';
import { pinDonatedFinds } from '../js/scenes/shop.js';
import { makeGame } from './fixtures/townDriver.mjs';

const DAY = 1440;
const at = (G, day, h, m = 0) => G.store.tx('test:clock', (w) => { w.clock.total = (day - 1) * DAY + h * 60 + m; });
const meet = (G, ids) => G.store.tx('test:meet', (w) => { for (const id of ids) { w.npcs[id] = w.npcs[id] ?? { met: true }; w.npcs[id].met = true; } });
const posted = (G) => PORCH_DUELS.neighbours.map((n) => n.npc).filter((npc) => G.world.flags[`sys.duel.${npc}`]);
const morning = (G, day) => { at(G, day, 6); G.bus.emit('clock:anchor', { id: 'morning', minute: 360, day }); };

describe('the Porch Duel slate is frozen once posted', () => {
  it('a reload the same evening keeps tonight\'s slate even after new neighbours qualify at noon', () => {
    const G = makeGame('PROBE-1');
    const off = dayFlow.install(G);
    meet(G, ['wren', 'tully', 'juniper', 'odile', 'augusta', 'wick']);
    morning(G, 5);
    const first = posted(G);
    assert.equal(first.length, 3);
    assert.equal(G.world.flags[PORCH_DUEL_DAY_FLAG], 5);
    at(G, 5, 12);
    G.store.tx('story', (w) => { flags.setFlag(w, 'sp.tamsin-arrived', true, {}); flags.setFlag(w, 'sp.linnet-rematch', true, {}); });
    meet(G, ['tamsin', 'linnet']);
    at(G, 5, 20);
    G.bus.emit('world:replaced', { world: G.world });
    assert.deepEqual(posted(G), first, 'the reload did not reshuffle tonight');
    // a second dawn hook the same morning changes nothing either
    G.store.tx('again', (w) => dayFlow.postDuelSlate(w, G.data, { bus: G.bus }));
    assert.deepEqual(posted(G), first);
    off();
  });

  it('the Commons slip lists exactly the posted neighbours, by name, at their porch', () => {
    const G = makeGame('PROBE-1');
    const off = dayFlow.install(G);
    meet(G, ['wren', 'tully', 'juniper', 'odile', 'augusta', 'wick']);
    morning(G, 5);
    G.store.tx('story', (w) => { flags.setFlag(w, 'sp.tamsin-arrived', true, {}); });
    meet(G, ['tamsin']);
    at(G, 5, 20);
    const lines = duelSlipLines(G).slice(1);
    const names = posted(G).map((npc) => G.data.get('npcs', npc).name);
    assert.equal(lines.length, 3);
    for (const name of names) assert.ok(lines.some((l) => l.startsWith(`${name}:`)), `${name} on the slip`);
    assert.ok(!lines.some((l) => /porch porch|Keepers Cottage/.test(l)), 'porches read as words');
    // 00:30 is still tonight; 06:00 posts a new slate
    at(G, 6, 0, 30);
    assert.equal(postedDuels(G.world, PORCH_DUELS)?.gameDay, 5);
    assert.equal(duelEvening(G.world), 5);
    off();
  });
});

describe('a neighbour\'s Porch Duel is won once an evening', () => {
  it('the win takes the offer off the slate; a second win after midnight or a reload pays nothing', () => {
    const G = makeGame('PROBE-1');
    const off = dayFlow.install(G);
    meet(G, ['wren', 'tully', 'juniper', 'odile', 'augusta', 'wick']);
    morning(G, 5);
    const npc = posted(G)[0];
    const trainer = PORCH_DUELS.neighbours.find((n) => n.npc === npc).trainer;
    at(G, 5, 21);
    const before = G.world.wallet.main;
    G.bus.emit('battle:end', { outcome: 'loss', kind: 'trainer', trainerId: trainer, porchDuel: true });
    assert.equal(G.world.wallet.main, before, 'a loss pays nothing');
    assert.equal(G.world.flags[`sys.duel.${npc}`], true, 'a lost friendly duel can be tried again tonight');
    G.bus.emit('battle:end', { outcome: 'win', kind: 'trainer', trainerId: trainer, porchDuel: true });
    assert.equal(G.world.wallet.main - before, 180, 'the purse, once');
    assert.equal(G.world.flags[`sys.duel.${npc}`], undefined, 'the topic flag is cleared');
    assert.ok(duelSlipLines(G).some((l) => l.includes('fought')), 'the slip shows it fought');
    at(G, 6, 0, 20);
    G.bus.emit('battle:end', { outcome: 'win', kind: 'trainer', trainerId: trainer, porchDuel: true });
    G.bus.emit('world:replaced', { world: G.world });
    assert.equal(G.world.flags[`sys.duel.${npc}`], undefined, 'a reload does not re-post a won duel');
    G.bus.emit('battle:end', { outcome: 'win', kind: 'trainer', trainerId: trainer, porchDuel: true });
    assert.equal(G.world.wallet.main - before, 180, 'no second purse the same evening');
    off();
  });
});

describe('Hesper names the door', () => {
  it('a carried letter is for a resident\'s porch, by name', () => {
    const G = makeGame('CARRY');
    G.store.tx('carry', (w) => { w.letters.got.push(21); w.letters.carrying.push(21); w.letters.got.push(24); });
    assert.match(carryingText(G), /for Wick Dorrow's porch\.$/);
    G.store.tx('carry', (w) => { w.letters.carrying = [24]; });
    assert.match(carryingText(G), /for Tamsin[^']*'s porch\.$/, 'porch-dark-1 is Tamsin\'s, not "Dark 1"');
  });
});

describe('door lines read as English', () => {
  it('no "the The" for an heirloom whose name starts with The', () => {
    const G = makeGame('DOOR-LINES');
    const f1 = letters.letterByN(G.data, 21);
    const home = doorLines(G, { ok: true, returned: true, reward: { n: 21, item: 'dorrow-kettle', creature: null, lightsPorch: 'porch-dorrow' } }, f1);
    assert.ok(home.some((l) => l.includes('brings the Dorrows\' Kettle home')), home.join(' | '));
    const f4 = letters.letterByN(G.data, 24);
    const dark = doorLines(G, { ok: true, returned: false, reward: null }, f4);
    assert.ok(!dark.some((l) => /the the/i.test(l)), dark.join(' | '));
  });
});

describe('Barnaby pins finds donated before the string wall was wired', () => {
  it('opening the desk pins them and their town letters arrive', () => {
    const G = makeGame('PIN-CATCH');
    const find = G.data.list('collections').find((r) => r.group === 'relic' && !r.skyglass && letters.townLetterFor(G.data, r.id));
    assert.ok(find, 'a find with a town letter');
    G.store.tx('old-save', (w) => {
      fieldLog.recordFind(w, find.id, { bus: G.bus });
      bag.give(w, find.id, 1, { data: G.data });
      fieldLog.donate(w, find.id, { take: (id, n) => bag.take(w, id, n, { data: G.data }).ok });
    });
    assert.equal(fieldLog.isPinned(G.world, find.id), false);
    assert.deepEqual(pinDonatedFinds(G), [find.id]);
    assert.equal(fieldLog.isPinned(G.world, find.id), true);
    const n = letters.townLetterFor(G.data, find.id).n;
    assert.ok(G.world.letters.mailbox.includes(n), 'its town letter is in the mailbox');
    assert.deepEqual(pinDonatedFinds(G), [], 'nothing twice');
  });
});

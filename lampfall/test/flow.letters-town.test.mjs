// Letters, threads and the town economy, wired end to end (wave 2, letters lane):
// MID-02 family letters (counter at 18:00 -> carry -> door -> heirloom / porch / creature),
// the string-wall pins, LG-RN35/RN62 resident share, LG-RN36 Gallery frames / Raft refining /
// Barnaby's duplicates, LG-RN66 Mudlark spacing, LG-RN33 one-of-a-kind takes, the Porch Duel slate,
// and the Journal's stamp toasts.
// Run: node --test test/flow.letters-town.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CONTENT } from '../js/data/content.js';
import { TUNING } from '../js/data/tuning.js';
import { PORCH_DUELS } from '../js/data/town.js';
import * as letters from '../js/systems/letters.js';
import * as threads from '../js/systems/threads.js';
import * as loans from '../js/systems/loans.js';
import * as wallet from '../js/systems/wallet.js';
import * as bag from '../js/systems/bag.js';
import * as flags from '../js/systems/flags.js';
import * as shops from '../js/systems/shops.js';
import * as fieldLog from '../js/systems/fieldLog.js';
import { duelSlate } from '../js/systems/townCommon.js';
import * as dayFlow from '../js/systems/flow/dayFlow.js';
import { doInteraction, deliverCarriedTo, duelSlipLines, visitorDuelOffer, boardContent } from '../js/systems/flow/interactFlow.js';
import { resolveTalk, scriptSystems } from '../js/scenes/scriptHost.js';
import { archiveDonate, archiveSell, archiveSellRows, refineRowsFor } from '../js/scenes/shop.js';
import { newStamps, announceStamps, stampStates } from '../js/scenes/letter.js';
import { validateData } from '../tools/validate-data.mjs';
import { makeGame, prepare, runSession } from './fixtures/townDriver.mjs';
import { isLowTide } from '../js/state/selectors.js';

const DAY = 1440;
const at = (G, day, h, m = 0) => G.store.tx('test:clock', (w) => { w.clock.total = (day - 1) * DAY + h * 60 + m; });
const pushed = (G) => { const list = []; G.push = (name, params) => list.push({ name, params }); return list; };
const npcsMet = (G, ids) => G.store.tx('test:meet', (w) => { for (const id of ids) { w.npcs[id] = w.npcs[id] ?? { met: true }; w.npcs[id].met = true; } });

describe('MID-02: family letters reach the counter, the door and the porch', () => {
  it('F1 lands on Hesper\'s counter at 18:00 on day 2 through the clock, and not before', () => {
    const G = makeGame('FAM-ONE');
    const off = dayFlow.install(G);
    at(G, 2, 17, 30);
    G.bus.emit('clock:hour', { day: 1, hour: 17 });
    assert.equal(G.world.letters.counter, null, 'nothing before six');
    at(G, 2, 18, 0);
    G.bus.emit('clock:hour', { day: 1, hour: 18 });
    assert.equal(G.world.letters.counter, 21, 'F1 (n 21) is on the counter');
    assert.ok(G.toastLog.some((t) => /Hesper/.test(t)), 'the player is told');
    G.bus.emit('clock:hour', { day: 1, hour: 19 });
    assert.deepEqual(G.world.letters.got, [21], 'repeat hours deliver nothing new');
    off();
  });

  it('a load mid-evening catches the counter up (world:replaced)', () => {
    const G = makeGame('FAM-LOAD');
    const off = dayFlow.install(G);
    at(G, 3, 20, 0);
    G.bus.emit('world:replaced', { world: G.world });
    assert.equal(G.world.letters.counter, 21);
    off();
  });

  it('counter -> carry -> knock at the Dorrows\' door: kettle home, porch lit, a Bilgebob follows', async () => {
    const G = makeGame('FAM-DOOR');
    const scenes = pushed(G);
    at(G, 2, 18, 30);
    dayFlow.eveningLetter(G);
    const r = await doInteraction(G, { verb: 'hesperCounter', target: { def: {} } }, { toast: () => {} });
    assert.equal(r.ok, true);
    assert.deepEqual(G.world.letters.carrying, [21]);
    assert.equal(scenes[0].name, 'letter');
    G.store.tx('read', (w) => letters.markRead(w, G.data, 21, { bus: G.bus }));
    assert.equal(flags.hasFlag(G.world, 'sys.porch.porch-dorrow'), false);
    const said = [];
    const k = await doInteraction(G, { verb: 'knock', target: { def: { porch: 'porch-dorrow' } } }, { toast: (t) => said.push(t), mapId: 'pellwick' });
    assert.equal(k.ok, true);
    assert.deepEqual(G.world.letters.carrying, []);
    assert.ok(G.world.letters.returned.includes(21));
    assert.equal(bag.count(G.world, 'dorrow-kettle'), 1, 'the heirloom is in the satchel');
    assert.equal(flags.hasFlag(G.world, 'sys.porch.porch-dorrow'), true, 'F1 lights the Dorrows\' porch');
    const all = [...G.world.party, ...G.world.box];
    assert.ok(all.some((c) => c.speciesId === 'bilgebob' && c.level === 6), 'the Bilgebob came home with it');
    assert.ok(said.some((t) => /Kettle/i.test(t)) && said.some((t) => /porch lamp/.test(t)) && said.some((t) => /follows/.test(t)), said.join(' | '));
  });

  it('a letter is not handed in at the wrong door', () => {
    const G = makeGame('FAM-WRONG');
    at(G, 2, 18, 30);
    dayFlow.eveningLetter(G);
    G.store.tx('carry', (w) => letters.carry(w, G.data, { bus: G.bus }));
    assert.deepEqual(deliverCarriedTo(G, 'porch-odile', null), []);
    assert.deepEqual(G.world.letters.carrying, [21]);
  });

  it('all eighteen: six heirlooms come home, four creatures arrive, and the Bracks\' knot waits for dark house 1', () => {
    const G = makeGame('FAM-ALL');
    prepare(G); // loan 1 paid: your own porch is lit for F18
    const ctx = { bus: G.bus, tuning: TUNING };
    for (let day = 2; day <= 19; day++) {
      at(G, day, 18, 5);
      dayFlow.eveningLetter(G);
      const c = G.store.tx('carry', (w) => letters.carry(w, G.data, ctx));
      assert.equal(c.ok, true, `day ${day}: a letter to carry`);
      G.store.tx('read', (w) => letters.markRead(w, G.data, c.n, ctx));
      const door = letters.letterByN(G.data, c.n).door;
      const done = deliverCarriedTo(G, door, null);
      assert.equal(done.length, 1, `F${c.n - 20} handed in at ${door}`);
    }
    assert.equal(G.world.letters.doors.length, 18);
    assert.deepEqual(G.world.letters.awaiting, [24], 'F4 waits on the dark house');
    for (const id of ['dorrow-kettle', 'bryony-seed-tin', 'grade-two-lantern', 'odile-easel', 'thessaly-almanac']) assert.equal(bag.count(G.world, id), 1, id);
    assert.equal(bag.count(G.world, 'brack-still-knot'), 0);
    const species = [...G.world.party, ...G.world.box].map((c) => c.speciesId);
    for (const s of ['bilgebob', 'puddlepip', 'mothling', 'wirewhisk']) assert.ok(species.includes(s), s);
    for (const p of ['porch-dorrow', 'porch-bryony', 'porch-odile', 'porch-thessaly']) assert.equal(flags.hasFlag(G.world, `sys.porch.${p}`), true, p);
    // Tamsin moves into dark house 1: the overnight releases the knot
    G.store.tx('lit', (w) => flags.setFlag(w, 'sys.porch.porch-dark-1', true, ctx));
    const out = G.store.tx('release', (w) => letters.releaseHeirlooms(w, G.data, { ...ctx, ...dayFlow.letterHands(G.data, G.bus) }));
    assert.deepEqual(out.map((r) => r.item), ['brack-still-knot']);
    assert.equal(bag.count(G.world, 'brack-still-knot'), 1);
  });

  it('the overnight passes the heirloom hands (a knot released at dawn lands in the satchel)', () => {
    const G = makeGame('FAM-NIGHT');
    G.store.tx('setup', (w) => {
      w.letters.got.push(24); w.letters.doors.push(24); w.letters.awaiting.push(24);
      flags.setFlag(w, 'sys.porch.porch-dark-1', true);
    });
    at(G, 5, 5, 59);
    G.bus.emit('clock:anchor', { id: 'morning', minute: 360, day: 4 });
    const off = dayFlow.install(G);
    G.bus.emit('clock:anchor', { id: 'morning', minute: 360, day: 4 });
    off();
    assert.equal(bag.count(G.world, 'brack-still-knot'), 1);
  });

  it('donating a find pins it on the string wall and delivers its town letter on the spot', () => {
    const G = makeGame('PIN-WALL');
    const find = letters.lettersIn(G.data, 'town')[0].find;
    G.store.tx('find', (w) => { fieldLog.recordFind(w, find, { bus: G.bus }); bag.give(w, find, 2, { data: G.data, bus: G.bus }); });
    const res = archiveDonate(G, find);
    assert.equal(res.ok, true);
    assert.equal(res.pinned, true);
    assert.ok(Number.isInteger(res.letter));
    assert.ok(G.world.letters.pinned.includes(find));
    assert.ok(G.world.letters.got.includes(res.letter), 'the town letter arrived');
    assert.equal(bag.count(G.world, find), 1, 'one specimen left the satchel');
  });
});

describe('LG-RN36: Barnaby buys duplicates, the Raft refines, the Gallery frames', () => {
  it('Barnaby buys only donated finds, skyglass at its archivePrice (900)', () => {
    const G = makeGame('ARCH-SELL');
    G.store.tx('finds', (w) => {
      fieldLog.recordFind(w, 'skyglass-shard', { bus: G.bus }); bag.give(w, 'skyglass-shard', 3, { data: G.data });
      fieldLog.recordFind(w, 'ammonite', { bus: G.bus }); bag.give(w, 'ammonite', 1, { data: G.data });
    });
    assert.deepEqual(archiveSellRows(G.world, G.data), [], 'nothing donated, nothing to sell');
    archiveDonate(G, 'skyglass-shard');
    const rows = archiveSellRows(G.world, G.data);
    assert.deepEqual(rows.map((r) => [r.id, r.data.price, r.data.have]), [['skyglass-shard', 900, 2]]);
    const before = G.world.wallet.main;
    const r = archiveSell(G, 'skyglass-shard', 2);
    assert.equal(r.ok, true);
    assert.equal(G.world.wallet.main - before, 1800);
    assert.equal(bag.count(G.world, 'skyglass-shard'), 0);
    assert.equal(archiveSell(G, 'ammonite', 1).reason, 'not-donated');
  });

  it('the Raft refines skyglass relics 1:1 into Starsalt in its hours, outside the 3-a-day cap', () => {
    const G = makeGame('RAFT-REF');
    G.store.tx('relics', (w) => { bag.give(w, 'skyglass-bead', 5, { data: G.data }); });
    const raft = shops.shopRow('carnival-raft', { data: G.data });
    at(G, 4, 10, 0);
    assert.equal(G.store.tx('r', (w) => shops.refine(w, 'carnival-raft', 'skyglass-bead', 1, { data: G.data })).reason, 'closed');
    at(G, 4, 13, 0);
    assert.deepEqual(refineRowsFor(G.world, raft, G.data).map((r) => [r.id, r.data.have, r.data.gives]), [['skyglass-bead', 5, 1]]);
    const salt = G.world.wallet.starsalt;
    const r = G.store.tx('r', (w) => shops.refine(w, 'carnival-raft', 'skyglass-bead', 5, { data: G.data, bus: G.bus }));
    assert.deepEqual(r, { ok: true, got: 5, to: 'starsalt' });
    assert.equal(G.world.wallet.starsalt - salt, 5);
    assert.equal(bag.count(G.world, 'skyglass-bead'), 0);
    assert.equal(wallet.starsaltLeftToday(G.world, { data: G.data }), 3, 'refining is not buying');
    assert.equal(G.store.tx('r', (w) => shops.refine(w, 'carnival-raft', 'ammonite', 1, { data: G.data })).reason, 'not-refinable');
    assert.equal(G.store.tx('r', (w) => shops.refine(w, 'pells-sundries', 'skyglass-bead', 1, { data: G.data })).reason, 'no-refining');
  });

  it('the Gallery pays 1,000 per 6 Held forms once it has landed, once per frame (storyHooks on fieldLog:held)', () => {
    const G = makeGame('GALLERY');
    const forms = G.data.list('species').slice(0, 13).map((s) => s.id);
    G.store.tx('held', (w) => { for (const f of forms.slice(0, 11)) fieldLog.markHeld(w, f, { data: G.data }); });
    assert.equal(G.store.tx('g', (w) => loans.galleryFrames(w, { data: G.data })).reason, 'no-gallery');
    const before = G.world.wallet.main;
    G.store.tx('build', (w) => { w.loans.builds.push({ id: 'gallery', tier: 3, startedDay: 0, readyDay: 1, choice: null, done: true }); });
    G.bus.emit('loan:built', { id: 'gallery', tier: 3, choice: null });
    assert.equal(G.world.wallet.main - before, 1000, '11 Held: one frame');
    G.store.tx('held', (w) => fieldLog.markHeld(w, forms[11], { data: G.data, bus: G.bus }));
    assert.equal(G.world.wallet.main - before, 2000, 'the 12th Held form frames the second plate');
    G.store.tx('held', (w) => fieldLog.markHeld(w, forms[12], { data: G.data, bus: G.bus }));
    assert.equal(G.world.wallet.main - before, 2000, 'no frame until 18');
    assert.equal(G.store.tx('g', (w) => loans.galleryFrames(w, { data: G.data })).paid, 0, 'repeat calls pay nothing');
  });

  it('the Gallery strip gives the lead +1 Bond once', async () => {
    const G = makeGame('STRIP');
    prepare(G);
    at(G, 5, 10);
    G.store.tx('lead', (w) => {
      w.loans.builds.push({ id: 'gallery', tier: 3, startedDay: 0, readyDay: 1, choice: null, done: true });
    });
    G.store.tx('give', (w) => { /* a party lead */ });
    const party = await import('../js/systems/party.js');
    G.store.tx('c', (w) => party.giveCreature(w, { species: 'tossup', level: 5 }, G.data, null, {}));
    pushed(G);
    const b0 = G.world.party[0].bond;
    const r = await doInteraction(G, { verb: 'gallery', target: { def: {} } }, {});
    assert.equal(r.ok, true);
    assert.equal(G.world.party[0].bond, b0 + 1);
    await doInteraction(G, { verb: 'gallery', target: { def: {} } }, {});
    assert.equal(G.world.party[0].bond, b0 + 1, 'once');
  });
});

describe('LG-RN35/RN62: finishing a lead thread pays the resident share', () => {
  it('the production script bindings (no loans injected) still pay one notch, once', () => {
    const G = makeGame('SHARE-ONE');
    G.store.tx('b', (w) => { w.threads['the-fence'] = { beat: 3, startedDay: 0, lastAdvancedDay: 0, done: false }; });
    const owed = loans.balance(G.world, { data: G.data });
    const sys = scriptSystems(G);
    G.store.tx('beat', (w) => sys.setBeat(w, 'the-fence', 4));
    assert.ok(G.world.loans.residentShares.includes('the-fence'));
    assert.equal(owed - loans.balance(G.world, { data: G.data }), Math.round(6000 * TUNING.residentShareFraction), '5% of loan 1');
    G.store.tx('beat', (w) => sys.setBeat(w, 'the-fence', 3));
    G.store.tx('beat', (w) => sys.setBeat(w, 'the-fence', 4));
    assert.equal(G.world.loans.residentShares.filter((x) => x === 'the-fence').length, 1, 'paid once');
  });

  it('after payoff the share goes to the Commons Jar (4,000)', () => {
    const G = makeGame('SHARE-JAR');
    G.store.tx('rich', (w) => { wallet.earn(w, 400_000, { data: G.data }); for (let i = 0; i < 12 && !loans.isPaidOff(w, { data: G.data }); i++) loans.pay(w, loans.balance(w, { data: G.data }), { data: G.data }); });
    assert.equal(loans.isPaidOff(G.world, { data: G.data }), true);
    const jar = G.world.loans.commons.jar;
    G.store.tx('b', (w) => { w.threads['twelve-lights'] = { beat: 4, startedDay: 0, lastAdvancedDay: 0, done: false }; });
    G.store.tx('beat', (w) => scriptSystems(G).setBeat(w, 'twelve-lights', 5));
    assert.equal(G.world.loans.commons.jar - jar, TUNING.residentShareAfterPayoff);
  });

  it('a cast arc pays nothing', () => {
    const G = makeGame('SHARE-CAST');
    G.store.tx('b', (w) => { w.threads['water-pack'] = { beat: 3, startedDay: 0, lastAdvancedDay: 0, done: false }; });
    G.store.tx('beat', (w) => scriptSystems(G).setBeat(w, 'water-pack', 4));
    assert.deepEqual(G.world.loans.residentShares, []);
  });
});

describe('LG-RN66 and LG-RN33', () => {
  it('Mudlark Mile beat 2 waits two days after beat 1 ("Legs need a day")', () => {
    const G = makeGame('MUDLARK');
    npcsMet(G, ['tully']);
    at(G, 3, 7); // GDD day 3 is a Tuesday
    G.store.tx('b1', (w) => threads.setBeat(w, G.data, 'mudlark-mile', 1, {}));
    const def = G.data.get('threads', 'mudlark-mile');
    at(G, 4, 7);
    assert.equal(threads.beatBlock(G.world, G.data, def, { tuning: TUNING }), 'spacing', 'not the next morning');
    at(G, 5, 7);
    assert.equal(threads.beatBlock(G.world, G.data, def, { tuning: TUNING }), null, 'two days on');
  });

  it('every scripted one-of-a-kind hand-over asks, and the validator rejects one that does not', () => {
    const { errors } = validateData(DATA_CONTENT);
    assert.deepEqual(errors.filter((e) => /one-of-a-kind/.test(e)), []);
    const bad = { ...DATA_CONTENT, scripts: { ...DATA_CONTENT.scripts, 'x-bad-take': [{ op: 'take', item: 'fleet-bell', n: 1 }, { op: 'end' }] } };
    const r = validateData(bad);
    assert.ok(r.errors.some((e) => /x-bad-take.*one-of-a-kind 'fleet-bell'.*ask: true/.test(e)), r.errors.join('\n'));
  });

  it('the bell hand-over really takes the bell when the player agrees', () => {
    const G = makeGame('BELL-TAKE');
    G.store.tx('b', (w) => { w.threads['the-bell'] = { beat: 2, startedDay: 0, lastAdvancedDay: 0, done: false }; });
    npcsMet(G, ['barnaby']);
    // GDD day 7 is a spring-tide Saturday: find its low
    let m = 0;
    for (; m < DAY; m += 10) { at(G, 7, 0, m); if (isLowTide(G.world)) break; }
    assert.ok(isLowTide(G.world), 'a low on day 7');
    const s = resolveTalk(G, { kind: 'npc', id: 'barnaby', mapId: 'pellwick' }, { record: false });
    assert.equal(s.scriptId, 'th-the-bell-3');
    runSession(G, s);
    assert.equal(G.world.threads['the-bell'].beat, 3);
    assert.equal(flags.hasFlag(G.world, 'sp.bell-dug'), true);
    assert.equal(bag.count(G.world, 'fleet-bell'), 0, 'the bell went to Barnaby (the ask is the one-of-a-kind confirm)');
  });
});

describe('the Porch Duel slate (GDD-05 §8)', () => {
  const NEIGHBOURS = PORCH_DUELS.neighbours.map((n) => n.npc);
  const LIVE = { ...PORCH_DUELS, visitorsLive: true }; // battleFlow fights visitors as duels (setup.porchDuel)
  const OFF = { ...PORCH_DUELS, visitorsLive: false };
  it('visitors are live in the shipped table', () => { assert.equal(PORCH_DUELS.visitorsLive, true); });
  it('three offers from met neighbours, a visitor once a leader is beaten, never three days running', () => {
    const G = makeGame('DUELS');
    npcsMet(G, NEIGHBOURS);
    G.store.tx('flags', (w) => { flags.setFlag(w, 'sp.tamsin-arrived', true); flags.setFlag(w, 'sp.linnet-rematch', true); });
    const runs = new Map();
    for (let day = 0; day < 30; day++) {
      const s = duelSlate(G.world, PORCH_DUELS, { day, data: G.data });
      assert.equal(s.offers.length, 3, `day ${day}`);
      assert.equal(new Set(s.offers.map((o) => o.trainer)).size, 3, 'no opponent twice');
      assert.ok(s.offers.every((o) => o.kind === 'neighbour'), 'no visitor before a badge');
      for (const n of NEIGHBOURS) {
        const on = s.offers.some((o) => o.npc === n);
        runs.set(n, on ? (runs.get(n) ?? 0) + 1 : 0);
        assert.ok(runs.get(n) < 3, `${n} three days running on day ${day}`);
      }
      assert.equal(s.payout, 30 * PORCH_DUELS.curveByBadges[0]);
      assert.deepEqual(duelSlate(G.world, PORCH_DUELS, { day, data: G.data }), s, 'deterministic');
    }
    G.store.tx('badge', (w) => { w.badges.push('turn'); });
    assert.ok(duelSlate(G.world, OFF, { day: 3, data: G.data }).offers.every((o) => o.kind === 'neighbour'), 'visitors wait for visitorsLive');
    const s = duelSlate(G.world, LIVE, { day: 3, data: G.data });
    assert.equal(s.offers.filter((o) => o.kind === 'neighbour').length, 2);
    const v = s.offers.find((o) => o.kind !== 'neighbour');
    assert.ok(v && ['maud-spire', ...PORCH_DUELS.routePools[0].trainers].includes(v.trainer), JSON.stringify(v));
    assert.equal(v.porch, PORCH_DUELS.visitorVenue);
    assert.equal(s.payout, 30 * PORCH_DUELS.curveByBadges[1]);
  });

  it('unmet neighbours and those whose cond fails are never posted', () => {
    const G = makeGame('DUELS-2');
    npcsMet(G, ['wren', 'tully', 'odile', 'tamsin']);
    for (let day = 0; day < 10; day++) {
      const s = duelSlate(G.world, PORCH_DUELS, { day, data: G.data });
      assert.ok(s.offers.every((o) => ['wren', 'tully'].includes(o.npc)), JSON.stringify(s.offers));
    }
  });

  it('the 06:00 post sets sys.duel.<npc> for tonight\'s neighbours, and their porch topic offers the duel at 19:30', () => {
    const G = makeGame('DUELS-3');
    prepare(G);
    npcsMet(G, NEIGHBOURS);
    at(G, 4, 6);
    const off = dayFlow.install(G);
    G.bus.emit('clock:anchor', { id: 'morning', minute: 360, day: 3 });
    off();
    const posted = NEIGHBOURS.filter((n) => flags.hasFlag(G.world, `sys.duel.${n}`));
    const slate = duelSlate(G.world, PORCH_DUELS, { data: G.data });
    assert.deepEqual(posted.sort(), slate.offers.filter((o) => o.kind === 'neighbour').map((o) => o.npc).sort());
    assert.ok(posted.length >= 2);
    at(G, 4, 19, 30);
    // each posted neighbour offers the duel (unless a beat of their own thread outranks it today)
    let offered = 0;
    for (const who of posted) {
      const s = resolveTalk(G, { kind: 'npc', id: who, mapId: 'pellwick' }, { record: false });
      if (s.scriptId === `talk-${who}-duel`) offered++;
      else assert.match(String(s.scriptId), /^th-/, `${who}: ${s.scriptId} (only a thread beat may outrank the duel)`);
    }
    assert.ok(offered >= 1);
    // the next morning re-posts: anyone off tonight's slate is cleared
    at(G, 5, 6);
    G.store.tx('post', (w) => dayFlow.postDuelSlate(w, G.data, {}));
    const next = duelSlate(G.world, PORCH_DUELS, { data: G.data }).offers.map((o) => o.npc);
    for (const n of NEIGHBOURS) assert.equal(flags.hasFlag(G.world, `sys.duel.${n}`), next.includes(n), n);
  });

  it('the Commons slip lists tonight\'s duels; a visitor is offered under the lamp only when live', async () => {
    const G = makeGame('DUELS-4');
    prepare(G);
    const party = await import('../js/systems/party.js');
    G.store.tx('c', (w) => party.giveCreature(w, { species: 'tossup', level: 5 }, G.data, null, {}));
    npcsMet(G, NEIGHBOURS);
    G.store.tx('badge', (w) => { w.badges.push('turn'); });
    at(G, 6, 12);
    const lines = duelSlipLines(G);
    assert.equal(lines[0], PORCH_DUELS.slip.header);
    assert.equal(lines.length, 4);
    assert.ok(boardContent(G, 'commons').lines.includes(lines[1]));
    assert.equal(visitorDuelOffer(G, LIVE), null, 'not before seven');
    at(G, 6, 20);
    assert.equal(visitorDuelOffer(G, OFF), null, 'no visitors while visitorsLive is false');
    const v = visitorDuelOffer(G, LIVE);
    assert.ok(v && v.trainer && v.kind !== 'neighbour');
    assert.deepEqual(visitorDuelOffer(G), v, 'the shipped table offers the visitor');
    // the Commons lamp offers tonight's visitor as a Porch Duel; the battle starts straight away
    // (its intro is the battle scene's) with setup.porchDuel
    let setup = null;
    const pushed = [];
    const G2 = Object.create(G, { push: { value: (...a) => pushed.push(a) } });
    const r = await doInteraction(G2, { verb: 'commons', target: { def: {} } }, { ask: async () => 1, startBattle: (s) => { setup = s; } });
    assert.equal(r.duel, true);
    assert.deepEqual(setup, { kind: 'trainer', trainerId: v.trainer, source: 'duel', porchDuel: true });
    assert.ok(!pushed.some((p) => p[0] === 'dialogue'), 'no pre-battle dialogue');
    // fought tonight: the board is just the board
    const r2 = await doInteraction(G, { verb: 'commons', target: { def: {} } }, { ask: async () => 1, startBattle: () => {} });
    assert.notEqual(r2.duel, true);
    assert.ok(Array.isArray(r2.content.lines));
  });
});

describe('Journal stamps', () => {
  it('earned stamps come from systems/stamps and are announced once with stamp.earned', () => {
    const G = makeGame('STAMPS');
    assert.deepEqual(newStamps(G.world, G.data), []);
    G.store.tx('f', (w) => flags.setFlag(w, 'sp.starter-chosen', true));
    assert.deepEqual(newStamps(G.world, G.data), ['someone-picked-you']);
    assert.equal(stampStates(G.world, G.data).find((s) => s.id === 'someone-picked-you').earned, true);
    assert.deepEqual(announceStamps(G), ['someone-picked-you']);
    assert.ok(G.toastLog.includes('Stamp: Someone Picked You'), G.toastLog.join(' | '));
    assert.deepEqual(announceStamps(G), [], 'only once');
  });
});

describe('Porch Duel payout', () => {
  it('a won duel pays 30 × the posted curve by badges held; a lost one costs and pays nothing', () => {
    const G = makeGame('DUEL-PAY');
    const w0 = G.world.wallet.main;
    G.bus.emit('battle:end', { outcome: 'win', kind: 'trainer', trainerId: 'porch-tully', porchDuel: true });
    assert.equal(G.world.wallet.main - w0, 210);
    G.store.tx('b', (w) => { w.badges.push('turn', 'ward', 'weather'); });
    G.bus.emit('battle:end', { outcome: 'win', kind: 'trainer', trainerId: 'porch-wren', porchDuel: true });
    assert.equal(G.world.wallet.main - w0, 210 + 780, 'Day 10\'s Osric duel pays 780 at three badges');
    G.bus.emit('battle:end', { outcome: 'lose', kind: 'trainer', trainerId: 'porch-wren', porchDuel: true });
    G.bus.emit('battle:end', { outcome: 'win', kind: 'trainer', trainerId: 'lowmoor-osier', porchDuel: false });
    assert.equal(G.world.wallet.main - w0, 990);
  });
});

describe('the Ledger shows the resident shares', () => {
  it('counts the lead threads that have paid', async () => {
    const { residentShareLine } = await import('../js/scenes/ledger.js');
    const G = makeGame('LEDGER-SH');
    assert.equal(residentShareLine(G.world, G.data), 'Neighbours\' shares: 0 of 6 threads tied off');
    G.store.tx('b', (w) => { w.threads['the-fence'] = { beat: 3, startedDay: 0, lastAdvancedDay: 0, done: false }; });
    G.store.tx('beat', (w) => scriptSystems(G).setBeat(w, 'the-fence', 4));
    assert.equal(residentShareLine(G.world, G.data), 'Neighbours\' shares: 1 of 6 threads tied off');
  });
});

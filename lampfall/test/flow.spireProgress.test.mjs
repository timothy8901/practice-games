// Spire progress fixes from the mid/late-game audit:
//  MID-08   badge gifts (spires.js unlocks: Scouting Prism, Weatherglass, Plumbline disc) reach the bag, once, with a toast
//  LG-RN87  Journal stamp counters (systems/stamps) and the fields they match on (capture:ok scripted, battle:end porchDuel)
//  LG-NEW1 / MID-14  the Ward Spire's two teaching sentinels stand in the lattice gaps and battle
//  LG-NEW2  every Spire dossier lists exactly the leader's party
//  MID-15   the dais tile's Challenge chip challenges the Spire leader; the Relay's second twin offers it too
//  Porch Duels field `sizeByBadges` creatures (1 / 1 / 2 / 2 / 3 ...), as the EXP pacing sim assumes
// Run: node --test test/flow.spireProgress.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/flow/battleFlow.js';
import * as I from '../js/systems/flow/interactFlow.js';
import * as stamps from '../js/systems/stamps.js';
import * as flags from '../js/systems/flags.js';
import * as bag from '../js/systems/bag.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { STAMPS } from '../js/data/town.js';
import { SPIRES } from '../js/data/spires.js';
import { TRAINER_BY_ID } from '../js/data/trainers.js';
import { SPECIES } from '../js/data/species/index.js';
import { evalCond } from '../js/script/cond.js';
import WARD_MAP from '../js/data/maps/spire-ward.js';
import RELAY_MAP from '../js/data/maps/spire-relay.js';

const data = realBattleData();
const tuning = F.tuningFor(data);
const content = createRegistry(DATA_CONTENT);

function makeG(seedCode = 'FLUX-K7Q2-MD7F', gameData = data) {
  const store = createStore(createNewWorld({ seedCode }));
  store.tx('dial', (w) => { w.run.dial = 'flux'; });
  const events = [];
  const bus = { emit: (e, p) => { events.push([e, p]); return store.bus.emit(e, p); }, on: (...a) => store.bus.on(...a) };
  const pushed = [];
  return { store, get world() { return store.world; }, bus, data: gameData, rngs: createRngs(store), push: (name, params) => pushed.push([name, params]), events, pushed };
}

function give(G, speciesId, level, extra = {}) {
  return G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, speciesId, level, ...extra }, data);
    return party.addCreature(w, c, data, { tuning, caught: true });
  });
}

/** Strongest selectable move until the end; first healthy replacement. */
function playOut(session) {
  const b = session.battle;
  for (let i = 0; i < 600 && b.phase !== 'ended'; i++) {
    const lg = b.legal(0);
    if (b.phase === 'replace') {
      if (b.pendingReplace.includes(0)) b.step({ type: 'switch', to: lg.switches.find((s) => s.selectable).index });
      else b.step(null);
      continue;
    }
    let best = -1;
    let score = -Infinity;
    lg.moves.forEach((m, k) => { const v = m.selectable ? (m.power || 1) * (m.mult ?? 1) : -Infinity; if (v > score) { score = v; best = k; } });
    b.step(F.prepareAction(session, best >= 0 && score > -Infinity ? { type: 'move', move: best } : { type: 'scrap' }));
  }
  return b.result();
}

function strongParty(G) {
  for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest', 'floeback', 'duskowl', 'cragmitt']) give(G, sp, 90);
}

function winSpire(G, trainerId) {
  G.store.tx('heal', (w) => party.heal(w, { tuning }));
  let s = F.buildBattle(G, { kind: 'trainer', trainerId, source: 'spire' }, data);
  // the Relay Spire is three rounds (MID-05): play on until the post carries no next round
  for (;;) {
    const r = playOut(s);
    assert.equal(r.outcome, 'win', trainerId);
    const post = F.applyBattleResult(G, s);
    if (!post.relay) return post;
    s = F.buildBattle(G, F.relayNextSetup(s), data);
  }
}

describe('MID-08: badge gifts from spires.js unlocks', () => {
  it('the Weather, Relay and Mirror Spires hand over the Scouting Prism, the Weatherglass and the Plumbline disc, once', () => {
    const G = makeG();
    strongParty(G);
    const got = {};
    for (const [tr, item] of [['ines-spire', 'scouting-prism'], ['hallorans-spire', 'weatherglass'], ['seraphine-spire', 'disc-plumbline']]) {
      assert.equal(bag.count(G.world, item, undefined, { data }), 0, `${item} before`);
      const post = winSpire(G, tr);
      assert.ok(post.badge, tr);
      assert.equal(bag.count(G.world, item, undefined, { data }), 1, `${item} after ${tr}`);
      assert.deepEqual(post.rewards.map((r) => r.item), [item]);
      assert.match(post.rewards[0].line, /^Received: /);
      got[item] = post;
    }
    assert.ok(G.events.some(([e, p]) => e === 'toast' && /Scouting Prism/.test(p.text)), 'a toast names the gift');
    // a second win over a beaten leader is not a new badge: nothing more is given
    const again = winSpire(G, 'ines-spire');
    assert.equal(again.badge, null);
    assert.deepEqual(again.rewards, []);
    assert.equal(bag.count(G.world, 'scouting-prism', undefined, { data }), 1);
  });

  it('grantBadgeRewards gives only key items and discs, and never a key item twice', () => {
    const G = makeG();
    const weather = SPIRES.find((s) => s.id === 'weather');
    const first = G.store.tx('t', (w) => F.grantBadgeRewards(w, weather, { data }));
    assert.deepEqual(first.map((r) => r.item), ['scouting-prism']);
    const second = G.store.tx('t', (w) => F.grantBadgeRewards(w, weather, { data }));
    assert.deepEqual(second, []);
    const turn = SPIRES.find((s) => s.id === 'turn');
    assert.deepEqual(G.store.tx('t', (w) => F.grantBadgeRewards(w, turn, { data })), [], 'reader tools and stock are not bag items');
    assert.deepEqual(G.store.tx('t', (w) => F.grantBadgeRewards(w, null, { data })), []);
  });

  it('a full satchel spills the disc into the basket at your feet, and the line says so (verifier)', () => {
    const G = makeG();
    G.store.tx('fill', (w) => {
      for (const it of data.list('items')) {
        if (bag.slots(w, { data }).free <= 0) break;
        if (it.pocket === 'tools' || it.pocket === 'keepsakes' || it.pocket === 'discs') continue;
        try { bag.give(w, it.id, 1, { data }); } catch { /* not giveable */ }
      }
    });
    assert.equal(bag.slots(G.world, { data }).free, 0, 'satchel full');
    const mirror = SPIRES.find((s) => s.id === 'mirror');
    const got = G.store.tx('t', (w) => F.grantBadgeRewards(w, mirror, { data }));
    assert.deepEqual(got.map((r) => r.item), ['disc-plumbline']);
    assert.match(got[0].line, /basket/);
    assert.equal(G.world.bag.baskets.some((b) => b.items.some((s) => s.id === 'disc-plumbline')), true);
  });
});

describe('LG-RN87: stamp counters (systems/stamps)', () => {
  it('reads the counter rows the stamp table names', () => {
    const rows = stamps.stampCounters(STAMPS);
    const ids = rows.map((r) => r.id);
    for (const id of ['stamp.catches', 'stamp.rerolls', 'stamp.anchors', 'stamp.ward-reads', 'stamp.skyglass', 'stamp.porch-duels', 'stamp.heirlooms', 'stamp.errants', 'stamp.forms-held']) assert.ok(ids.includes(id), id);
    assert.ok(stamps.listenedEvents(STAMPS).includes('battle:end'));
  });

  it('counts matching events only, and the stamp cond then holds', () => {
    const w = createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' });
    assert.deepEqual(stamps.applyStampEvent(w, STAMPS, 'capture:ok', { uid: 'c2', speciesId: 'tossup', scripted: true }), []);
    assert.deepEqual(stamps.applyStampEvent(w, STAMPS, 'capture:ok', { uid: 'c2', speciesId: 'tossup', scripted: false }), [{ id: 'stamp.catches', value: 1 }]);
    stamps.applyStampEvent(w, STAMPS, 'capture:ok', { uid: 'c3', speciesId: 'tossup' });
    assert.equal(flags.get(w, 'stamp.catches'), 2, 'an emitter without the field counts as unscripted');
    const into = STAMPS.find((s) => s.id === 'into-the-light');
    assert.equal(evalCond(w, into.cond), true);
    stamps.applyStampEvent(w, STAMPS, 'stat:inc', { key: 'steps', value: 3 });
    assert.equal(flags.get(w, 'stamp.rerolls'), 0);
    stamps.applyStampEvent(w, STAMPS, 'stat:inc', { key: 'rerolls', value: 1 });
    assert.equal(flags.get(w, 'stamp.rerolls'), 1);
    stamps.applyStampEvent(w, STAMPS, 'fieldLog:read', { formId: 'chillnub', ability: 'stillcoat' });
    stamps.applyStampEvent(w, STAMPS, 'fieldLog:read', { formId: 'tossup', ability: 'scrappy' });
    assert.equal(flags.get(w, 'stamp.ward-reads'), 1);
    stamps.applyStampEvent(w, STAMPS, 'battle:end', { outcome: 'win', trainerId: 'maud-spire' }, { data });
    assert.equal(flags.get(w, 'stamp.porch-duels'), 0);
    stamps.applyStampEvent(w, STAMPS, 'battle:end', { outcome: 'win', trainerId: 'porch-wren' }, { data });
    assert.equal(flags.get(w, 'stamp.porch-duels'), 1, 'porchDuel derived from the trainer row when the emitter leaves it out');
    stamps.applyStampEvent(w, STAMPS, 'battle:end', { outcome: 'win', porchDuel: true });
    assert.equal(flags.get(w, 'stamp.porch-duels'), 2);
  });

  it('install subscribes the bus: one tx per counted event, unsubscribe stops it', () => {
    const G = makeG();
    const off = stamps.install(G, { rows: STAMPS });
    G.bus.emit('capture:ok', { uid: 'c1', speciesId: 'tossup', scripted: false });
    G.bus.emit('gather:skyglass', { n: 1 });
    G.bus.emit('battle:end', { outcome: 'win', trainerId: 'porch-tully' });
    assert.equal(flags.get(G.world, 'stamp.catches'), 1);
    assert.equal(flags.get(G.world, 'stamp.skyglass'), 1);
    assert.equal(flags.get(G.world, 'stamp.porch-duels'), 1);
    off();
    G.bus.emit('capture:ok', { uid: 'c2', speciesId: 'tossup', scripted: false });
    assert.equal(flags.get(G.world, 'stamp.catches'), 1);
  });

  it('battleFlow marks Porch Duels on the session, the start payload and the result', () => {
    const G = makeG();
    give(G, 'sloshkin', 30);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'porch-wren' }, data);
    assert.equal(s.porchDuel, true);
    assert.equal(s.startPayload.porchDuel, true);
    playOut(s);
    assert.equal(F.applyBattleResult(G, s).porchDuel, true);
    const G2 = makeG();
    give(G2, 'sloshkin', 30);
    const s2 = F.buildBattle(G2, { kind: 'trainer', trainerId: 'lowmoor-osier' }, data);
    assert.equal(s2.porchDuel, false);
  });
});

describe('Porch Duels field sizeByBadges creatures', () => {
  for (const [badges, size] of [[0, 1], [1, 1], [2, 2], [4, 3]]) {
    it(`${badges} badges: ${size}`, () => {
      const G = makeG();
      give(G, 'sloshkin', 20);
      G.store.tx('badges', (w) => { w.badges.push(...['turn', 'ward', 'weather', 'hollow'].slice(0, badges)); });
      const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'porch-wren' }, data);
      const foes = s.battle.sides[1].party;
      assert.equal(foes.length, size);
      assert.equal(foes[foes.length - 1].speciesId, 'scrapling', 'Peg always leads the line-up');
      assert.equal(foes[foes.length - 1].level, 21, 'party median + her offset');
    });
  }
});

// --- interactFlow: sentinels and the dais -------------------------------------------------------

function interactG() {
  const G = makeG('FLUX-K7Q2-MD7F', content);
  give(G, 'sloshkin', 40);
  return G;
}

const entityOf = (map, id) => {
  const def = map.entities.find((e) => e.id === id);
  return { id, kind: def.kind, x: def.x, y: def.y, def };
};

describe('LG-NEW1 / MID-14: the Ward Spire sentinels', () => {
  it('stand in the two lattice gaps, east first, until beaten or the Ward Seal is held', () => {
    const order = SPIRES.find((s) => s.id === 'ward').order.filter((o) => o.kind === 'sentinel').map((o) => o.id);
    assert.deepEqual(order, ['ward-sentinel-east', 'ward-sentinel-west']);
    for (const [entId, marker, sid] of [['sentinel-east', 'sentinel-east', 'ward-sentinel-east'], ['sentinel-west', 'sentinel-west', 'ward-sentinel-west']]) {
      const e = WARD_MAP.entities.find((x) => x.id === entId);
      assert.ok(e, entId);
      assert.deepEqual([e.x, e.y], [WARD_MAP.markers[marker].x, WARD_MAP.markers[marker].y], 'on the marker cell');
      assert.equal(e.sentinel, sid);
      assert.equal(e.verb, 'challenge');
      const w = createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' });
      assert.equal(evalCond(w, e.cond, { data: content }), true, 'there at first');
      w.flags[`sys.trainer.${sid}`] = true;
      assert.equal(evalCond(w, e.cond, { data: content }), false, 'gone once beaten');
      const w2 = createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' });
      w2.badges.push('ward');
      assert.equal(evalCond(w2, e.cond, { data: content }), false, 'gone for a save past Osric');
    }
    // each stands in its lattice's only gap
    assert.equal(WARD_MAP.detail[8][14], '.');
    assert.equal(WARD_MAP.detail[5][5], '.');
  });

  it('Challenge starts a capture-free, costless wild battle against the posted foe; a win sets the flag and posts the lesson', async () => {
    const G = interactG();
    let setup = null;
    const host = { mapId: 'spire-ward', mapDef: WARD_MAP, ask: async () => 1, startBattle: (s) => { setup = s; }, toast: () => {} };
    const res = await I.doInteraction(G, { kind: 'prop', verb: 'challenge', targetId: 'sentinel-east', target: entityOf(WARD_MAP, 'sentinel-east') }, host);
    assert.equal(res.ok, true);
    assert.equal(res.sentinelId, 'ward-sentinel-east');
    assert.deepEqual(setup.wild, { speciesId: 'chillnub', level: 13, moves: ['tap', 'frost-nip', 'settle'] });
    assert.equal(setup.capture, false);
    const s = F.buildBattle(G, setup, data);
    assert.equal(s.blackoutAllowed, false, 'costs nothing');
    assert.equal(s.battle.sides[1].party[0].ability, 'stillcoat', 'a Stillcoat lesson');
    assert.deepEqual(s.battle.sides[1].party[0].moves.map((m) => m.id), ['tap', 'frost-nip', 'settle']);
    assert.equal(F.captureMenu(s).available, false, 'the Lantern is refused');
    playOut(s);
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'win');
    assert.equal(G.world.flags['sys.trainer.ward-sentinel-east'], true);
    assert.match(post.lesson, /Stillcoat/);
    assert.ok(G.events.some(([e, p]) => e === 'toast' && /Stillcoat/.test(p.text)));
    // a beaten sentinel repeats its lesson
    const again = await I.doInteraction(G, { kind: 'prop', verb: 'challenge', targetId: 'sentinel-east', target: entityOf(WARD_MAP, 'sentinel-east') }, host);
    assert.equal(again.defeated, true);
  });

  it('the west sentinel fields the Cairnward', async () => {
    const G = interactG();
    let setup = null;
    const host = { mapId: 'spire-ward', mapDef: WARD_MAP, ask: async () => 1, startBattle: (s) => { setup = s; } };
    await I.doInteraction(G, { kind: 'prop', verb: 'challenge', targetId: 'sentinel-west', target: entityOf(WARD_MAP, 'sentinel-west') }, host);
    assert.equal(setup.wild.speciesId, 'cairnward');
    assert.equal(setup.wild.level, 14);
  });

  it('a loss to a sentinel costs nothing: no flag, no blackout, the party is rested to try again (verifier)', async () => {
    const G = makeG('FLUX-K7Q2-MD7F', content);
    give(G, 'tossup', 2);
    let setup = null;
    const host = { mapId: 'spire-ward', mapDef: WARD_MAP, ask: async () => 1, startBattle: (s) => { setup = s; }, toast: () => {} };
    await I.doInteraction(G, { kind: 'prop', verb: 'challenge', targetId: 'sentinel-west', target: entityOf(WARD_MAP, 'sentinel-west') }, host);
    const buttons = G.world.wallet.main;
    const s = F.buildBattle(G, setup, data);
    const r = playOut(s);
    assert.equal(r.outcome, 'loss');
    const post = F.applyBattleResult(G, s);
    assert.equal(post.blackout, null);
    assert.equal(G.world.wallet.main, buttons, 'nothing lost');
    assert.equal(G.world.flags['sys.trainer.ward-sentinel-west'], undefined, 'still in the gap');
    assert.ok(G.world.party.every((c) => c.hp === c.stats.hp), 'rested');
  });
});

describe('MID-15: the dais Challenge chip', () => {
  it('facing the dais from the challenger spot challenges the Spire leader', async () => {
    const G = interactG();
    let setup = null;
    const host = { mapId: 'spire-ward', mapDef: WARD_MAP, ask: async () => 1, startBattle: (s) => { setup = s; } };
    const res = await I.doInteraction(G, { kind: 'tile', verb: 'challenge', targetId: 'spire-dais', target: { id: 'spire-dais', verb: 'challenge' } }, host);
    assert.equal(res.ok, true);
    assert.equal(res.trainerId, 'osric-spire');
    // the battle starts at once: its trainer-in speaks the intro (no pre-battle dialogue repeating it)
    assert.equal(G.pushed.find(([name]) => name === 'dialogue'), undefined);
    assert.equal(setup.trainerId, 'osric-spire');
  });

  it('a dais tile off a Spire map still fails readably', async () => {
    const G = interactG();
    const res = await I.doInteraction(G, { kind: 'tile', verb: 'challenge', targetId: 'spire-dais', target: { id: 'spire-dais' } }, { mapId: 'pellwick', mapDef: { id: 'pellwick' } });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unknown-trainer');
  });

  it('the Relay twin who does not hold the post (Ivo) offers the same challenge until the Spire is won', async () => {
    const G = interactG();
    const host = { mapId: 'spire-relay', mapDef: RELAY_MAP, ask: async () => 1, startBattle: () => {} };
    const res = await I.doInteraction(G, { kind: 'npc', verb: 'talk', targetId: 'ivo', target: { id: 'ivo', npcId: 'ivo' } }, host);
    assert.equal(res.verb, 'challenge');
    assert.equal(res.trainerId, 'hallorans-spire');
    G.store.tx('won', (w) => flags.setFlag(w, 'sys.trainer.hallorans-spire', true));
    const after = await I.doInteraction(G, { kind: 'npc', verb: 'talk', targetId: 'ivo', target: { id: 'ivo', npcId: 'ivo' } }, host);
    assert.equal(after.verb, 'talk');
  });
});

describe('LG-NEW2: Spire dossiers list the leader\'s party', () => {
  const NAME = Object.fromEntries(SPECIES.map((s) => [s.id, s.name]));
  for (const s of SPIRES) {
    it(`${s.id}: every "Name LvN" matches ${s.trainer}, in order`, () => {
      const want = TRAINER_BY_ID[s.trainer].party.map((p) => `${NAME[p.species]} Lv${p.level}`);
      const got = [...s.dossier.text.matchAll(/([A-Z][a-z]+) Lv(\d+)/g)].map((m) => `${m[1]} Lv${m[2]}`);
      assert.deepEqual(got, want);
    });
  }
});

describe('LG-RN87: earnedStamps', () => {
  it('lists the stamps whose cond holds, counters included', () => {
    const w = createNewWorld({ seedCode: 'FLUX-K7Q2-MD7F' });
    assert.ok(!stamps.earnedStamps(w, STAMPS).includes('into-the-light'));
    stamps.applyStampEvent(w, STAMPS, 'capture:ok', { uid: 'c2', speciesId: 'tossup', scripted: false });
    stamps.applyStampEvent(w, STAMPS, 'battle:end', { outcome: 'win', porchDuel: true });
    const got = stamps.earnedStamps(w, STAMPS);
    assert.ok(got.includes('into-the-light') && got.includes('on-the-steps'), got.join(','));
    assert.ok(!got.includes('every-plate'));
  });
});

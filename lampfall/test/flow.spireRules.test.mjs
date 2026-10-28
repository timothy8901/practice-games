// Spire and boss rules from the mid/late-game audit:
//  MID-04 / LG-RN76  posted boss Shifts (data/trainers.js `bossShift`): the strip posts at `postAt`, the
//                    Shift lands at `shiftAt` on `bossShift:<trainerId>:<slot>`, at the player's dial odds
//                    (steadied after the Relighting); Maud, Linnet's dock Caldermaw, Wick and six route trainers
//  MID-05            the Relay Spire: three rounds, two of yours each, no repeats (reuse once dry), no heal
//                    between rounds, the twins' heals carried over, the badge and payout only after round 3
//  MID-10            a Summit loss never goes home: the Bell holds your place (Drift / Flux) with the party as
//                    that fight began; Freefall restarts the climb at the first Keeper
// Run: node --test test/flow.spireRules.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/flow/battleFlow.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import * as flags from '../js/systems/flags.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import { TRAINERS, TRAINER_BY_ID } from '../js/data/trainers.js';
import { SPIRE_BY_ID } from '../js/data/spires.js';
import { checkEvent } from '../js/battle/events.js';
import { createBattle, BOSS_SHIFT_FALLBACK_ODDS } from '../js/battle/engine.js';
import { mk, constRng, DATA } from './fixtures/battle/helpers.mjs';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';

const data = realBattleData();
const content = createRegistry(DATA_CONTENT);
const tuning = F.tuningFor(data);

function makeG(dial = 'flux', seedCode = 'FLUX-K7Q2-MD7F') {
  const store = createStore(createNewWorld({ seedCode }));
  store.tx('dial', (w) => { w.run.dial = dial; });
  const events = [];
  const bus = { emit: (e, p) => { events.push([e, p]); return store.bus.emit(e, p); }, on: (...a) => store.bus.on(...a) };
  return { store, get world() { return store.world; }, bus, data, rngs: createRngs(store), push: () => {}, events };
}

function give(G, speciesId, level, extra = {}) {
  return G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, speciesId, level, ...extra }, data);
    return party.addCreature(w, c, data, { tuning, caught: true });
  });
}

/** One player action: `settle`-style stalling (a status move when there is one) or the strongest hit. */
function step(session, mode) {
  const b = session.battle;
  if (b.phase === 'replace') {
    if (b.pendingReplace.includes(0)) return b.step({ type: 'switch', to: b.legal(0).switches.find((s) => s.selectable).index });
    return b.step(null);
  }
  const lg = b.legal(0);
  let best = -1;
  let score = -Infinity;
  lg.moves.forEach((m, k) => {
    if (!m.selectable) return;
    const v = mode === 'stall' ? (m.category === 'status' ? 1000 : 1 / ((m.power || 1) * (m.mult ?? 1))) : (m.power || 1) * (m.mult ?? 1);
    if (v > score) { score = v; best = k; }
  });
  return b.step(F.prepareAction(session, best >= 0 ? { type: 'move', move: best } : { type: 'scrap' }));
}

function playOut(session, mode = 'hit') {
  const all = [...session.battle.intro];
  for (let i = 0; i < 600 && session.battle.phase !== 'ended'; i++) all.push(...step(session, mode));
  return all;
}

const BOSS_TRAINERS = TRAINERS.filter((t) => t.party.some((e) => e.bossShift)).map((t) => t.id);

describe('MID-04 / LG-RN76: posted boss Shifts', () => {
  it('the data names Maud, Linnet at the dock, Wick and six route trainers', () => {
    for (const id of ['maud-spire', 'linnet-dock', 'wick-long-road']) assert.ok(BOSS_TRAINERS.includes(id), id);
    assert.ok(BOSS_TRAINERS.length >= 8, BOSS_TRAINERS.join(', '));
  });

  it('Maud: Puddlepip posts Up Sloshkin 100% at the end of its first turn and Shifts at the end of its second, keeping its HP fraction', () => {
    const G = makeG();
    give(G, 'stillox', 30);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'maud-spire', source: 'spire' }, data);
    const b = s.battle;
    assert.equal(b.active(1).speciesId, 'puddlepip');
    assert.deepEqual(b.active(1).bossShift, TRAINER_BY_ID['maud-spire'].party[0].bossShift, 'the flow copies the posted Shift onto the battle creature');
    const t1 = step(s, 'stall');
    const posted = t1.find((e) => e.type === 'shift-posted');
    assert.ok(posted, 'the strip posts at the end of turn 1');
    assert.deepEqual(checkEvent(posted), []);
    assert.deepEqual(posted.cards.map((k) => [k.dir, k.form, k.odds]), [['up', 'sloshkin', 100]]);
    assert.equal(posted.turnsLeft, 1);
    assert.deepEqual(b.state().sides[1].shiftStrip.cards.map((k) => k.form), ['sloshkin'], 'the strip stays up in state()');
    assert.equal(b.active(1).speciesId, 'puddlepip', 'not yet');
    const ratio = b.active(1).hp / b.active(1).stats.hp;
    const t2 = step(s, 'stall');
    const shifted = t2.find((e) => e.type === 'boss-shift');
    assert.ok(shifted, 'the Shift lands at the end of turn 2');
    assert.deepEqual(checkEvent(shifted), []);
    const c = b.active(1);
    assert.equal(c.speciesId, 'sloshkin');
    assert.equal(c.nickname, 'Sloshkin', 'an un-nicknamed creature answers to its new form');
    assert.equal(c.level, 8);
    assert.deepEqual(c.types, data.get('species', 'sloshkin').types);
    assert.ok(Math.abs(c.hp / c.stats.hp - ratio) < 0.05, 'HP fraction kept');
    assert.equal(b.state().sides[1].shiftStrip, null, 'the strip comes down when it lands');
  });

  it("Bilgebob's three cards roll at the player's dial (Drift / Freefall), steadied once lit.steadied is set", () => {
    const postedFor = (dial, steadied = false) => {
      const G = makeG(dial);
      if (steadied) G.store.tx('lit', (w) => flags.setFlag(w, 'lit.steadied', true));
      give(G, 'stillox', 40);
      const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'maud-spire', source: 'spire' }, data);
      // send Bilgebob straight in: Puddlepip faints first
      s.battle.sides[1].party[0].hp = 0;
      s.battle.sides[1].active = 1;
      const ev = step(s, 'stall').find((e) => e.type === 'shift-posted');
      return Object.fromEntries(ev.cards.map((k) => [k.dir, k.odds]));
    };
    assert.deepEqual(postedFor('drift'), { up: 50, side: 40, down: 10 });
    assert.deepEqual(postedFor('flux'), { up: 40, side: 35, down: 25 });
    assert.deepEqual(postedFor('freefall'), { up: 30, side: 30, down: 40 });
    assert.deepEqual(postedFor('flux', true), { up: 40, side: 40, down: 20 });
  });

  it('the roll is on bossShift:<trainerId>:<slot>: same seed, same card', () => {
    const landed = (seed) => {
      const G = makeG('flux', seed);
      give(G, 'stillox', 40);
      const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'maud-spire', source: 'spire' }, data);
      s.battle.sides[1].party[0].hp = 0;
      s.battle.sides[1].active = 1;
      step(s, 'stall');
      return step(s, 'stall').find((e) => e.type === 'boss-shift').to;
    };
    assert.equal(landed('FLUX-K7Q2-MD7F'), landed('FLUX-K7Q2-MD7F'));
    const forms = new Set(['FLUX-AAAA-0001', 'FLUX-BBBB-0002', 'FLUX-CCCC-0003', 'FLUX-DDDD-0004', 'FLUX-EEEE-0005', 'FLUX-FFFF-0006', 'FLUX-GGGG-0007', 'FLUX-HHHH-0008'].map(landed));
    for (const f of forms) assert.ok(['brinelance', 'rushling', 'puddlepip'].includes(f), f);
  });

  it("Linnet's dock Sootling posts Up Caldermaw 100% and Shifts as it enters (0 / 0)", () => {
    const G = makeG();
    give(G, 'sloshkin', 5);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'linnet-dock', source: 'story', holdOut: 3 }, data);
    const intro = s.battle.intro;
    const posted = intro.find((e) => e.type === 'shift-posted');
    assert.ok(posted, 'the strip is in the opening events');
    assert.deepEqual(posted.cards.map((k) => [k.dir, k.form, k.odds]), [['up', 'caldermaw', 100]]);
    assert.equal(posted.turnsLeft, 0);
    const shift = intro.find((e) => e.type === 'boss-shift');
    assert.equal(shift.from, 'sootling');
    assert.equal(shift.to, 'caldermaw');
    assert.equal(s.battle.active(1).speciesId, 'caldermaw');
    assert.equal(s.battle.active(1).nickname, 'Cinder', 'a given nickname stays');
    assert.equal(s.battle.active(1).level, 5);
    assert.equal(s.battle.active(1).hp, s.battle.active(1).stats.hp, 'enters at full HP as a Caldermaw');
  });

  it('every trainer that posts a Shift performs it on its announced turn in the real flow', () => {
    for (const id of BOSS_TRAINERS) {
      const tr = TRAINER_BY_ID[id];
      const slot = tr.party.findIndex((e) => e.bossShift);
      const bs = tr.party[slot].bossShift;
      const G = makeG();
      give(G, 'stillox', Math.max(5, Math.min(60, tr.party[slot].level + 5)));
      const s = F.buildBattle(G, { kind: 'trainer', trainerId: id }, data);
      const b = s.battle;
      for (let k = 0; k < slot; k++) b.sides[1].party[k].hp = 0;
      if (slot > 0) { b.sides[1].active = slot; }
      const evs = [...(slot === 0 ? b.intro : [])];
      // keep both sides alive for the posted turns: nobody gets hurt
      for (let n = 0; n < bs.shiftAt; n++) {
        b.active(0).hp = b.active(0).stats.hp;
        b.active(1).hp = b.active(1).stats.hp;
        evs.push(...step(s, 'stall'));
      }
      const posted = evs.find((e) => e.type === 'shift-posted');
      const shifted = evs.find((e) => e.type === 'boss-shift');
      assert.ok(posted, `${id}: strip posted`);
      assert.ok(shifted, `${id}: Shift landed on turn ${bs.shiftAt}`);
      assert.ok(bs.cards.some((k) => k.form === shifted.to), `${id}: landed on a posted card (${shifted.to})`);
      assert.equal(b.active(1).speciesId, shifted.to);
    }
  });

  it('the engine falls back to the Flux row when the flow passes no odds, and a card for the current form drops out', () => {
    const boss = mk('puddlepip', 20, ['settle']);
    boss.bossShift = { postAt: 0, shiftAt: 1, odds: 'dial', cards: [{ dir: 'up', form: 'sloshkin' }, { dir: 'side', form: 'tossup' }, { dir: 'down', form: 'puddlepip' }] };
    const b = createBattle({ sides: [{ party: [mk('stillox', 20, ['settle'])] }, { party: [boss], trainer: { name: 'T' } }], kind: 'trainer', data: DATA, rng: constRng(0.5), foeAi: () => ({ type: 'move', move: 0 }) });
    const posted = b.intro.find((e) => e.type === 'shift-posted');
    const odds = Object.fromEntries(posted.cards.map((k) => [k.dir, k.odds]));
    const total = BOSS_SHIFT_FALLBACK_ODDS.up + BOSS_SHIFT_FALLBACK_ODDS.side;
    assert.deepEqual(Object.keys(odds), ['up', 'side'], 'the Down card is its own form: dropped');
    assert.equal(odds.up + odds.side, 100);
    assert.equal(odds.up, Math.round((BOSS_SHIFT_FALLBACK_ODDS.up * 100) / total));
    assert.throws(() => createBattle({ sides: [{ party: [mk('stillox', 20, ['settle'])] }, { party: [Object.assign(mk('tossup', 5, ['tap']), { bossShift: { postAt: 2, shiftAt: 1, odds: 100, cards: [] } })], trainer: { name: 'T' } }], kind: 'trainer', data: DATA, rng: constRng(0.5) }), TypeError);
  });

  it('a Shift gives the player a fresh free Read of the new form', () => {
    const G = makeG();
    give(G, 'stillox', 30);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'maud-spire', source: 'spire' }, data);
    const b = s.battle;
    b.read(0);
    assert.equal(b.legal(0).read.free ?? true, true);
    assert.ok(b.sides[0].readUsed.has(b.active(1).uid));
    step(s, 'stall');
    step(s, 'stall');
    assert.equal(b.active(1).speciesId, 'sloshkin');
    assert.equal(b.sides[0].readUsed.has(b.active(1).uid), false);
  });
});

describe('MID-05: the Relay Spire runs three rounds', () => {
  const sixParty = (G, level = 70) => { for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest', 'floeback', 'duskowl', 'cragmitt']) give(G, sp, level); };

  it('spires.js names the rounds; buildBattle plays round 1 with two of yours against slots 0 and 1', () => {
    const rule = SPIRE_BY_ID.relay.theme.rule;
    assert.deepEqual(rule.rounds.map((r) => r.slots), [[0, 1], [2, 3], [4, 5]]);
    const G = makeG();
    sixParty(G);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'hallorans-spire', source: 'spire' }, data);
    assert.equal(s.relay.round, 1);
    assert.equal(s.battle.sides[0].party.length, 2);
    assert.deepEqual(s.battle.sides[0].party.map((c) => c.uid), G.world.party.slice(0, 2).map((c) => c.uid));
    const tr = TRAINER_BY_ID['hallorans-spire'];
    assert.deepEqual(s.battle.sides[1].party.map((c) => c.speciesId), [tr.party[0].species, tr.party[1].species]);
    assert.equal(s.battle.sides[1].trainer.name, 'Ivo Halloran');
  });

  it('a round won settles nothing; no creature repeats; the twins keep their heals; the badge and payout come after round 3', () => {
    const G = makeG();
    sixParty(G);
    let s = F.buildBattle(G, { kind: 'trainer', trainerId: 'hallorans-spire', source: 'spire' }, data);
    const fought = [];
    const tr = TRAINER_BY_ID['hallorans-spire'];
    for (let round = 1; round <= 3; round++) {
      assert.equal(s.relay.round, round);
      const uids = s.battle.sides[0].party.map((c) => c.uid);
      for (const u of uids) assert.ok(!fought.includes(u), `round ${round}: ${u} already fought`);
      fought.push(...uids);
      assert.deepEqual(s.battle.sides[1].party.map((c) => c.speciesId), SPIRE_BY_ID.relay.theme.rule.rounds[round - 1].slots.map((k) => tr.party[k].species));
      const evs = playOut(s);
      assert.equal(s.battle.outcome, 'win', `round ${round}`);
      const post = F.applyBattleResult(G, s);
      if (round < 3) {
        assert.equal(post.badge, null);
        assert.equal(post.payout, 0);
        assert.equal(evs.some((e) => e.type === 'payout'), false, 'no "You won 0" between rounds');
        assert.equal(flags.getFlag(G.world, 'sys.trainer.hallorans-spire'), null);
        assert.deepEqual(post.relay, { round, of: 3, next: round + 1, used: fought.slice() });
        s.battle.sides[1].items.pop();   // pretend the twins drank a Tonic
        const left = s.battle.sides[1].items.length;
        s = F.buildBattle(G, F.relayNextSetup(s), data);
        assert.equal(s.battle.sides[1].items.length, left, 'heals carry across rounds');
      } else {
        assert.equal(post.badge, 'relay');
        assert.equal(post.payout, tr.payout);
        assert.equal(post.relay, undefined);
        assert.ok(flags.getFlag(G.world, 'sys.trainer.hallorans-spire'));
      }
    }
  });

  it('no healing between rounds: round 2 starts from the HP round 1 left', () => {
    const G = makeG();
    sixParty(G, 50);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'hallorans-spire', source: 'spire' }, data);
    playOut(s);
    F.applyBattleResult(G, s);
    const hurt = G.world.party.slice(0, 2).map((c) => c.hp);
    // a fresh pair fights round 2, but the round-1 pair keeps its wounds in the world
    const s2 = F.buildBattle(G, F.relayNextSetup(s), data);
    assert.deepEqual(G.world.party.slice(0, 2).map((c) => c.hp), hurt);
    assert.equal(s2.relay.round, 2);
  });

  it('the player picks the next pair; repeats are refused while fresh creatures remain; a small party may reuse once dry', () => {
    const G = makeG();
    sixParty(G);
    const rule = F.relayRule(TRAINER_BY_ID['hallorans-spire'], data);
    const used = G.world.party.slice(0, 2).map((c) => c.uid);
    const ch = F.relayChoices(G.world, rule, used);
    assert.equal(ch.dry, false);
    assert.deepEqual(ch.rows.filter((r) => !r.ok).map((r) => r.uid), used);
    // a repeat is refused: the default (fresh) pair stands in
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'hallorans-spire', relay: { round: 2, used, picks: [used[0], G.world.party[4].uid] } }, data);
    assert.deepEqual(s.battle.sides[0].party.map((c) => c.uid), [G.world.party[2].uid, G.world.party[3].uid]);
    const s2 = F.buildBattle(G, { kind: 'trainer', trainerId: 'hallorans-spire', relay: { round: 2, used, picks: [G.world.party[5].uid, G.world.party[3].uid] } }, data);
    assert.deepEqual(s2.battle.sides[0].party.map((c) => c.uid), [G.world.party[5].uid, G.world.party[3].uid], 'a valid pick is honoured, in its order');
    // three creatures: round 2 has one fresh face, so anyone may come back
    const G3 = makeG();
    for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest']) give(G3, sp, 70);
    const used3 = G3.world.party.slice(0, 2).map((c) => c.uid);
    const ch3 = F.relayChoices(G3.world, rule, used3);
    assert.equal(ch3.dry, true);
    assert.equal(ch3.per, 2);
    assert.deepEqual(F.relayDefaultPicks(G3.world, rule, used3), [G3.world.party[2].uid, G3.world.party[0].uid], 'the fresh one first, then a reuse');
  });
});

describe('MID-10: the Summit Bell', () => {
  function loseTo(G, trainerId) {
    const s = F.buildBattle(G, { kind: 'trainer', trainerId }, data);
    const start = s.battle.sides[0].party.map((c) => ({ uid: c.uid, hp: c.hp, pp: c.moves.map((m) => m.pp) }));
    playOut(s);
    assert.equal(s.battle.outcome, 'loss');
    return { post: F.applyBattleResult(G, s), start };
  }

  it('Drift / Flux: no blackout, no trip home; the party stands as that fight began; you wait at the bell-restart marker', () => {
    for (const dial of ['drift', 'flux']) {
      const G = makeG(dial);
      give(G, 'puddlepip', 20);
      give(G, 'tossup', 20);
      G.store.tx('hurt', (w) => { w.party[0].hp = Math.floor(w.party[0].stats.hp / 2); });
      G.store.tx('beat', (w) => flags.setFlag(w, 'sys.trainer.bastien-keeper', true));
      const { post, start } = loseTo(G, 'cass-keeper');
      assert.equal(post.blackout, null, dial);
      assert.equal(post.script, 'summit-bell');
      assert.deepEqual(post.summitBell, { holds: true, trainerId: 'cass-keeper', mapId: 'keepers-hall', marker: 'bell-restart-cass' });
      assert.deepEqual(G.world.party.map((c) => c.hp), start.map((c) => c.hp), 'HP as the fight began (nothing refilled)');
      assert.deepEqual(G.world.party.map((c) => c.moves.map((m) => m.pp)), start.map((c) => c.pp), 'PP as the fight began');
      assert.ok(flags.getFlag(G.world, 'sys.trainer.bastien-keeper'), 'beaten Keepers stay beaten');
      assert.equal(G.world.player.mapId === 'pellwick' && G.world.player.x === 9 && G.world.player.y === 23, false);
    }
  });

  it('the marker the Bell names exists on the map of whoever beat you', () => {
    for (const id of ['bastien-keeper', 'cass-keeper', 'idris-champion']) {
      const tr = TRAINER_BY_ID[id];
      const map = content.get('maps', tr.map);
      assert.ok(map.markers[`bell-restart-${tr.npc}`], `${tr.map}: bell-restart-${tr.npc}`);
    }
  });

  it('Freefall: every loss restarts the climb (Keepers stand again, party healed, no Bell script)', () => {
    const G = makeG('freefall');
    give(G, 'puddlepip', 20);
    G.store.tx('beat', (w) => flags.setFlag(w, 'sys.trainer.bastien-keeper', true));
    const { post } = loseTo(G, 'cass-keeper');
    assert.equal(post.blackout, null);
    assert.equal(post.script, null);
    assert.equal(post.summitBell.holds, false);
    assert.deepEqual(post.summitBell.restarted, ['bastien-keeper']);
    assert.equal(post.summitBell.mapId, 'keepers-hall');
    assert.ok(content.get('maps', 'keepers-hall').markers[post.summitBell.marker]);
    assert.equal(flags.getFlag(G.world, 'sys.trainer.bastien-keeper'), null);
    assert.equal(G.world.party[0].hp, G.world.party[0].stats.hp);
  });

  it('summitBellHolds reads the dial row; declining the Bell restarts at the first Keeper', () => {
    assert.equal(F.summitBellHolds('drift', data), true);
    assert.equal(F.summitBellHolds('flux', data), true);
    assert.equal(F.summitBellHolds('freefall', data), false);
    const G = makeG('flux');
    G.store.tx('beat', (w) => { flags.setFlag(w, 'sys.trainer.bastien-keeper', true); flags.setFlag(w, 'sys.trainer.cass-keeper', true); });
    assert.deepEqual(F.declineSummitBell(G).sort(), ['bastien-keeper', 'cass-keeper']);
    assert.equal(flags.getFlag(G.world, 'sys.trainer.cass-keeper'), null);
  });
});

describe('MID-18 (engine side): the Reading from THE_READING', () => {
  it('posts three cards per phase at the dial odds (steadied), rolls them on reading:<phase>:<draw>, scales the level, carries weather and evasion', async () => {
    const { THE_READING } = await import('../js/data/spires.js');
    const G = makeG('flux');
    give(G, 'sloshkin', 20);
    give(G, 'tossup', 22);
    const setup = { kind: 'wild', source: 'reading', holdOut: 14, wild: { speciesId: 'vagary', reading: THE_READING } };
    const s = F.buildBattle(G, setup, data);
    const b = s.battle;
    assert.equal(b.active(1).level, 30, 'party max 22 + 2, floored at 30');
    assert.equal(b.state().reading.name, THE_READING.arrival.name);
    const evs = playOut(s, 'stall');
    const posted = evs.filter((e) => e.type === 'shift-posted');
    assert.equal(posted.length, 6, 'phases 2-7 each posted during the phase before');
    for (const [i, p] of posted.entries()) {
      assert.deepEqual(checkEvent(p), []);
      assert.deepEqual(p.cards.map((k) => k.name), THE_READING.phases[i].next.cards.map((k) => k.aspect.name));
      assert.deepEqual(p.cards.map((k) => k.odds), [40, 40, 20], 'Flux, steadied by the Relighting');
    }
    const opened = evs.filter((e) => e.type === 'type-shift' && e.aspect);
    assert.equal(opened.length, 7);
    for (const [i, e] of opened.slice(1).entries()) assert.ok(THE_READING.phases[i].next.cards.some((k) => k.aspect.name === e.aspect), e.aspect);
    // the Weather phase's aspect brings its weather; the Mirror raises evasion by 2
    const weatherAspect = opened[2].aspect;
    const wantWeather = THE_READING.phases[1].next.cards.find((k) => k.aspect.name === weatherAspect).aspect.weather;
    assert.ok(evs.some((e) => e.type === 'weather-start' && e.kind === wantWeather));
    assert.ok(evs.some((e) => e.type === 'stat' && e.side === 1 && e.stat === 'eva' && e.result === 'raised'));
    assert.equal(b.outcome, 'reading');
    // same seed, same aspects
    const G2 = makeG('flux');
    give(G2, 'sloshkin', 20);
    give(G2, 'tossup', 22);
    const again = playOut(F.buildBattle(G2, setup, data), 'stall').filter((e) => e.type === 'type-shift' && e.aspect).map((e) => e.aspect);
    assert.deepEqual(again, opened.map((e) => e.aspect));
  });

  it('readingPhasesFrom gives the one-phase night Anchor / Reroll adds (the rings), and a later draw on request', async () => {
    const { THE_READING } = await import('../js/data/spires.js');
    const offer = F.readingPhasesFrom(THE_READING, { offer: true });
    assert.equal(offer.length, 1);
    assert.deepEqual(offer[0].cards.map((k) => k.name), THE_READING.phases[6].next.cards.map((k) => k.aspect.name));
    assert.equal(F.readingPhasesFrom(THE_READING, { from: 7, count: 1 })[0].name, 'The Reading');
    const G = makeG('drift');
    give(G, 'sloshkin', 50);
    const s = F.buildBattle(G, { kind: 'wild', source: 'reading', holdOut: 2, wild: { speciesId: 'vagary', reading: THE_READING, readingOffer: true, readingFrom: 8, readingDraw: 1 } }, data);
    assert.equal(s.battle.active(1).level, 52);
    assert.ok(THE_READING.phases[6].next.cards.some((k) => k.aspect.name === s.battle.state().reading.name));
  });
});

describe('Summit between fights (spires.js SUMMIT.between, GDD-04 §5): no heal, every move regains 5 PP', () => {
  const winAgainst = (G, trainerId) => {
    const s = F.buildBattle(G, { kind: 'trainer', trainerId }, data);
    playOut(s);
    assert.equal(s.battle.outcome, 'win', trainerId);
    return F.applyBattleResult(G, s);
  };

  it('a Keeper beaten: PP +5 a move (capped at max), HP and faints stay as the fight left them', () => {
    const G = makeG('flux');
    for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest', 'floeback', 'duskowl', 'cragmitt']) give(G, sp, 80);
    const post = winAgainst(G, 'bastien-keeper');
    // what the fight left, before the top-up, is in the engine copy: compare against it
    for (const c of G.world.party) for (const m of c.moves) assert.ok(m.pp <= m.maxPp);
    assert.ok(post.ppTopUp > 0, 'the fight spent PP and some came back');
    // drain, then a second Keeper win gives back exactly 5 a move (or up to max)
    G.store.tx('drain', (w) => { for (const c of w.party) for (const m of c.moves) m.pp = Math.max(0, m.maxPp - 6); w.party[1].hp = 7; });
    const before = G.world.party.map((c) => c.moves.map((m) => m.pp));
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'cass-keeper' }, data);
    playOut(s);
    assert.equal(s.battle.outcome, 'win');
    const left = s.battle.sides[0].party.map((c) => ({ uid: c.uid, hp: c.hp, pp: c.moves.map((m) => m.pp) }));
    const post2 = F.applyBattleResult(G, s);
    const after = G.world.party;
    for (const [i, c] of after.entries()) {
      const l = left.find((x) => x.uid === c.uid);
      assert.equal(c.hp, Math.min(c.stats.hp, l.hp), 'no heal between Summit fights');
      c.moves.forEach((m, k) => assert.equal(m.pp, Math.min(m.maxPp, l.pp[k] + 5), `${c.nickname} ${m.id} (was ${before[i][k]})`));
    }
    assert.ok(post2.ppTopUp > 0);
  });

  it('nothing after the Champion, after a loss, or after a Spire leader', () => {
    const G = makeG('flux');
    for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest', 'floeback', 'duskowl', 'cragmitt']) give(G, sp, 80);
    G.store.tx('beat', (w) => { flags.setFlag(w, 'sys.trainer.bastien-keeper', true); flags.setFlag(w, 'sys.trainer.cass-keeper', true); });
    const post = winAgainst(G, 'idris-champion');
    assert.equal(post.ppTopUp, undefined);
    const G2 = makeG('flux');
    for (const sp of ['caldermaw', 'bogmonarch', 'coilcrest']) give(G2, sp, 80);
    assert.equal(winAgainst(G2, 'maud-spire').ppTopUp, undefined);
    const G3 = makeG('flux');
    give(G3, 'puddlepip', 10);
    const s = F.buildBattle(G3, { kind: 'trainer', trainerId: 'bastien-keeper' }, data);
    playOut(s);
    assert.equal(s.battle.outcome, 'loss');
    assert.equal(F.applyBattleResult(G3, s).ppTopUp, undefined);
  });

  it('summitPpTopUp never passes max PP and leaves HP and status alone', () => {
    const G = makeG('flux');
    give(G, 'caldermaw', 40);
    G.store.tx('hurt', (w) => { const c = w.party[0]; c.hp = 3; c.status = { kind: 'burn', turns: 0 }; c.moves[0].pp = c.moves[0].maxPp - 2; if (c.moves[1]) c.moves[1].pp = 0; });
    const given = G.store.tx('top', (w) => F.summitPpTopUp(w, 5, { data, tuning }));
    const c = G.world.party[0];
    assert.equal(c.hp, 3);
    assert.deepEqual(c.status, { kind: 'burn', turns: 0 });
    assert.equal(c.moves[0].pp, c.moves[0].maxPp);
    if (c.moves[1]) assert.equal(c.moves[1].pp, Math.min(5, c.moves[1].maxPp));
    assert.ok(given >= 2);
  });
});

// Unit tests for js/systems/flow/battleFlow.js: building battles from the world with the real
// tables and the GDD-00 tuning, routing captures through systems/capture, and writing outcomes back.
// Run: node --test test/flow.battleFlow.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/flow/battleFlow.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import * as bag from '../js/systems/bag.js';
import * as wallet from '../js/systems/wallet.js';
import * as loans from '../js/systems/loans.js';
import { TUNING_KEYS as ENGINE_KEYS } from '../js/battle/engine.js';
import { TUNING } from '../js/data/tuning.js';

const data = realBattleData();
const tuning = F.tuningFor(data);

/** A small game context: store, rngs, a recording bus, and a scene-push spy. */
function makeG(seedCode = 'FLUX-K7Q2-MD7F') {
  const store = createStore(createNewWorld({ seedCode }));
  store.tx('dial', (w) => { w.run.dial = 'flux'; });
  const events = [];
  const bus = { emit: (e, p) => { events.push([e, p]); return store.bus.emit(e, p); }, on: (...a) => store.bus.on(...a) };
  const pushed = [];
  return { store, get world() { return store.world; }, bus, rngs: createRngs(store), push: (name, params) => pushed.push([name, params]), events, pushed };
}

/** Adds a creature (fresh catch rules unless `caught: false`). */
function give(G, spec, extra = {}) {
  return G.store.tx('give', (w) => {
    const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, ...spec }, data);
    if (extra.exp !== undefined) c.exp = extra.exp;
    if (extra.hp !== undefined) c.hp = extra.hp;
    return party.addCreature(w, c, data, { tuning, caught: extra.caught ?? true });
  });
}

/** Plays a battle to its end: best damaging move, first healthy replacement. */
function playOut(session, pick) {
  const b = session.battle;
  for (let i = 0; i < 300 && b.phase !== 'ended'; i++) {
    const lg = b.legal(0);
    if (b.phase === 'replace') {
      if (b.pendingReplace.includes(0)) b.step({ type: 'switch', to: lg.switches.find((s) => s.selectable).index });
      else b.step(null);
      continue;
    }
    let action = pick ? pick(lg, b) : null;
    if (!action) {
      let best = -1;
      let score = -Infinity;
      lg.moves.forEach((m, k) => { const v = m.selectable ? (m.power || 1) * (m.mult ?? 1) : -Infinity; if (v > score) { score = v; best = k; } });
      action = best >= 0 && score > -Infinity ? { type: 'move', move: best } : { type: 'scrap' };
    }
    b.step(F.prepareAction(session, action));
  }
  return b.result();
}

describe('tuning (TUNING RECONCILIATION, GDD-00 wins)', () => {
  it('lays the GDD values under data.tuning when it lacks them', () => {
    const t = F.tuningFor({});
    assert.equal(t.mendsPerBattle, 3);
    assert.equal(t.benchShare, 0.6);
    assert.equal(t.payoutPerLevel, 50);
    assert.equal(t.expYieldDivisor, 5);
    assert.equal(t.holdOutExp, 100);
    assert.equal(t.captureOddsMax, 0.95);
    assert.deepEqual(t.captureBands.map((b) => b[1]), ['Slim', 'Fair', 'Good', 'Sure']);
    assert.deepEqual(t.WINDOW_LEVELS, [8, 20, 34]);
    for (const curve of Object.values(t.GROWTH_CURVES)) {
      assert.deepEqual(curve.num, [0, 8, 0, 0], '8 × L² through Lv8 on every curve');
      assert.deepEqual(curve.steps, [{ from: 9, num: [3, 0, 0, -512], den: 2 }], 'then the MID-06 cubic');
    }
    assert.deepEqual(JSON.parse(JSON.stringify(t.GROWTH_CURVES)), JSON.parse(JSON.stringify(TUNING.GROWTH_CURVES)), 'the flow fallback equals data/tuning.js');
  });

  it('lets data.tuning win where it speaks', () => {
    const t = F.tuningFor({ tuning: { payoutPerLevel: 55 } });
    assert.equal(t.payoutPerLevel, 55);
    assert.equal(t.mendsPerBattle, 3);
  });

  it('hands the engine only keys it knows', () => {
    const et = F.engineTuningFor(data);
    for (const k of Object.keys(et)) assert.ok(ENGINE_KEYS.includes(k), k);
    assert.equal(et.mendsPerBattle, 3);
    assert.equal(et.payoutPerLevel, 50);
  });

  it('Freefall shows the Ward badge only after the first blocked hit; story battles have no Run', () => {
    assert.equal(F.dialRulesFor('freefall', data).wardBadge, 'after-block');
    assert.notEqual(F.dialRulesFor('flux', data).wardBadge, 'after-block');
    assert.equal(F.dialRulesFor('flux', data, { story: true }).runAllowed, false);
    assert.equal(F.dialRulesFor('freefall', data).readCostsTurn, true);
  });
});

describe('buildBattle', () => {
  it('builds a wild battle from the world: stats.battles + 1, no bookmark, battle:start payload', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 7, nickname: 'PUDDLE' });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    assert.equal(G.world.stats.battles, 1);
    assert.equal(G.world.battleBookmark, null);
    assert.equal(s.kind, 'wild');
    assert.equal(s.startPayload.kind, 'wild');
    assert.equal(s.startPayload.hp, s.startPayload.maxHp);
    assert.equal(s.battle.active(1).speciesId, 'tossup');
    assert.equal(s.battle.active(0).mends, 3, 'Mends 3 per creature per battle');
    assert.deepEqual(validateWorld(G.store.raw ? G.store.raw() : G.world, data), []);
  });

  it('builds a trainer battle with the trainer row and sets the battle bookmark', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 9, nickname: 'PUDDLE' });
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'osric-spire' }, data);
    assert.equal(s.trainer.id, 'osric-spire');
    assert.equal(G.world.battleBookmark.trainerId, 'osric-spire');
    assert.equal(G.world.battleBookmark.kind, 'spire');
    assert.equal(s.startPayload.spire, true);
    assert.equal(s.battle.sides[1].party.length, 3);
  });

  it('refuses an unknown trainer, an unknown species or a party that cannot battle, writing nothing', () => {
    const G = makeG();
    assert.throws(() => F.buildBattle(G, { kind: 'trainer', trainerId: 'nobody' }, data), /no trainer/);
    assert.throws(() => F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'nope', level: 3 } }, data), /no species/);
    assert.throws(() => F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data), /no creature/);
    give(G, { speciesId: 'sloshkin', level: 7 }, { hp: 0 });
    assert.throws(() => F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data), /no creature/);
    assert.equal(G.world.stats.battles, 0);
  });

  it('a debug party appears only when asked and the party is empty', () => {
    const G = makeG();
    F.buildBattle(G, { kind: 'trainer', trainerId: 'pip', debugParty: true }, data);
    assert.ok(G.world.party.length >= 1);
  });

  it('One Heart: only the starter battles', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 9 });
    give(G, { speciesId: 'scrapling', level: 9 });
    G.store.tx('ch', (w) => { w.run.challenges = ['one-heart']; });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data);
    assert.equal(s.battle.sides[0].party.length, 1);
    assert.equal(s.battle.sides[0].party[0].speciesId, 'sloshkin');
  });
});

describe('capture through systems/capture', () => {
  it('the odds shown before spending are the odds rolled, and failures add +3%', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 7 });
    G.store.tx('wicks', (w) => bag.give(w, 'tallow-wick', 10, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    const menu = F.captureMenu(s);
    const tallow = menu.rows.find((r) => r.grade === 1);
    assert.equal(tallow.stock, 10);
    assert.equal(tallow.display, 'percent');
    assert.ok(Number.isInteger(tallow.shown) && tallow.shown >= 1 && tallow.shown <= 95);
    assert.equal(tallow.nextShown, tallow.shown + 3, '+3% per failed attempt');
    assert.ok(!menu.rows.some((r) => r.sure), "Isolde's Lantern only when held");
    // roll: the stream is capture:<battleId>:<attempt>; the engine's chance() receives the shown odds
    const fails = [];
    for (let i = 0; i < 6 && s.battle.phase !== 'ended'; i++) {
      const before = F.captureMenu(s).rows.find((r) => r.grade === 1).shown;
      const ev = s.battle.step(F.prepareAction(s, { type: 'lantern', grade: 1 }));
      F.noteEvents(G, s, ev);
      const shake = ev.find((e) => e.type === 'capture-shake');
      assert.ok(shake, 'a raise draws the light in');
      const stream = G.rngs.fresh(`capture:${s.battleId}:${i}`);
      const expected = stream.chance(before / 100);
      assert.equal(shake.success, expected, `attempt ${i}: odds shown (${before}%) = odds rolled`);
      if (!shake.success) fails.push(before);
    }
    assert.equal(bag.count(G.world, 'tallow-wick', undefined, { data }), 10 - Math.min(6, fails.length + (s.battle.outcome === 'capture' ? 1 : 0)), 'one wick burns per raise');
  });

  it('Freefall shows bands (Slim / Fair / Good / Sure)', () => {
    const G = makeG();
    G.store.tx('dial', (w) => { w.run.dial = 'freefall'; });
    give(G, { speciesId: 'sloshkin', level: 7 });
    G.store.tx('wicks', (w) => bag.give(w, 'tallow-wick', 2, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    const row = F.captureMenu(s).rows[0];
    assert.equal(row.display, 'band');
    assert.ok(['Slim', 'Fair', 'Good', 'Sure'].includes(row.shown));
  });

  it("Isolde's Lantern is listed when held and always succeeds", () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 20 });
    G.store.tx('keepsake', (w) => bag.give(w, 'isoldes-lantern', 1, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'squallcoil', level: 22 } }, data);
    const sure = F.captureMenu(s).rows.find((r) => r.sure);
    assert.ok(sure);
    assert.equal(sure.pct, 100);
    const ev = s.battle.step(F.prepareAction(s, { type: 'lantern', grade: 'sure' }));
    F.noteEvents(G, s, ev);
    assert.equal(s.battle.outcome, 'capture');
    assert.equal(bag.count(G.world, 'isoldes-lantern', undefined, { data }), 0, 'the Keepsake is spent');
  });
});

describe('applyBattleResult', () => {
  it('a catch joins the party with a fresh uid, Field Log Held, capture:ok, and the KO EXP (40 for the Tossup)', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 5, nickname: 'PUDDLE' });
    G.store.tx('wicks', (w) => bag.give(w, 'isoldes-lantern', 1, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    s.battle.step(F.prepareAction(s, { type: 'lantern', grade: 'sure' }));
    const deferred = F.createDeferredBus();
    const post = F.applyBattleResult(G, s, { bus: deferred });
    assert.equal(post.outcome, 'capture');
    assert.equal(post.caught.uid, 'c2');
    assert.equal(G.world.party.length, 2);
    assert.equal(G.world.party[1].wild, false, 'the Heartmark lights');
    assert.equal(G.world.fieldLog.forms.tossup.held, true);
    assert.equal(G.world.stats.catches, 1);
    assert.ok(deferred.list.some(([e]) => e === 'capture:ok'), 'capture:ok waits for the fold into light');
    assert.equal(G.world.party[0].exp, 200 + 40, 'Lv5 = 8 × 25 = 200, plus 40 for the catch');
    assert.equal(F.applyBattleResult(G, s), post, 'applied once');
    assert.deepEqual(validateWorld(G.store.raw ? G.store.raw() : G.world, data), []);
  });

  it('a trainer win pays 50 × the highest level, flags the trainer and hands back its script', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 12 });
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'pip' }, data);
    playOut(s);
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'win');
    assert.equal(post.payout, 50 * 4);
    assert.equal(G.world.wallet.main, 200);
    assert.equal(G.world.flags['sys.trainer.pip'], true);
    assert.equal(post.script, null, 'no after script: the battle scene speaks the win line once (FH-10)');
    assert.equal(G.world.battleBookmark, null);
  });

  it('trainer EXP is ×1.5 of yield × level ÷ 5', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 12 });
    const before = G.world.party[0].exp;
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'pip' }, data);
    playOut(s);
    F.applyBattleResult(G, s);
    const yieldW = data.get('species', 'wirewhisk').expYield;
    const yieldT = data.get('species', 'tossup').expYield;
    assert.equal(G.world.party[0].exp - before, Math.floor((yieldT * 2) / 5) * 1.5 + Math.floor((yieldW * 4) / 5) * 1.5, 'the Tossup opener, then the Wirewhisk ace');
  });

  it('a Spire win adds the seal, 3 Starsalt and the Spire share', () => {
    const G = makeG();
    give(G, { speciesId: 'caldermaw', level: 50 });
    const owed = loans.balance(G.world, { data });
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'maud-spire' }, data);
    playOut(s);
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'win');
    assert.equal(post.badge, 'turn');
    assert.deepEqual(G.world.badges, ['turn']);
    assert.equal(post.starsalt, 3);
    assert.ok(G.world.wallet.starsalt >= 3);
    if (owed > 0) assert.ok(post.spireShare > 0, 'the share notches the open loan');
    assert.ok(G.events.some(([e]) => e === 'badge:won'));
  });

  it('a route loss blacks out: 10% of buttons (cap 1,500), half to the purse, party healed', () => {
    const G = makeG();
    give(G, { speciesId: 'puddlepip', level: 3 });
    G.store.tx('cash', (w) => wallet.earn(w, 3000, { data }));
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'osric-spire' }, data);
    playOut(s);
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'loss');
    assert.equal(post.blackout.lost, 300);
    assert.equal(post.blackout.refund, 150);
    assert.equal(G.world.wallet.main, 2700);
    assert.equal(G.world.wallet.purse, 150);
    assert.equal(G.world.party[0].hp, G.world.party[0].stats.hp, 'you wake healed');
    assert.equal(G.world.stats.blackouts, 1);
    assert.equal(post.script, null, 'no generated loss script: the parting line shows once, in battle');
  });

  it('a Summit loss costs nothing', () => {
    const G = makeG();
    give(G, { speciesId: 'puddlepip', level: 3 });
    G.store.tx('cash', (w) => wallet.earn(w, 3000, { data }));
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'idris-champion' }, data);
    assert.equal(s.summit, true);
    playOut(s);
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'loss');
    assert.equal(G.world.wallet.main, 3000);
    // MID-10: no blackout and no trip home; the Bell holds your place at whoever beat you
    assert.equal(post.blackout, null);
    assert.equal(post.summitBell.holds, true);
    assert.equal(post.summitBell.mapId, 'idris-hall');
    assert.equal(post.summitBell.marker, 'bell-restart-idris');
  });

  it('a story hold-out never blacks out and grants the flat hold-out EXP', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 5 });
    G.store.tx('cash', (w) => wallet.earn(w, 3000, { data }));
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'linnet-dock', source: 'story', holdOut: 3 }, data);
    const before = G.world.party[0].exp;
    playOut(s, () => ({ type: 'move', move: 0 }));
    const post = F.applyBattleResult(G, s);
    assert.ok(['holdout', 'win', 'loss'].includes(post.outcome));
    assert.equal(G.world.wallet.main, 3000, 'story battles never cost money');
    if (post.outcome === 'holdout') assert.equal(G.world.party[0].exp - before, 100);
  });

  it('a level reaching a window puts it in pendingShifts and reports it', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 7, nickname: 'PUDDLE' }, { exp: 505 });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data);
    playOut(s);
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'win');
    assert.equal(G.world.party[0].level, 8);
    assert.deepEqual(post.windowsOpened, [G.world.party[0].uid]);
    assert.ok(G.world.pendingShifts.includes(G.world.party[0].uid), "the 'Shift pending' pip");
  });

  it('a level-up with full slots reports the offer; learnOffered applies the choice', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 8, moves: ['tap', 'salt-spray', 'undertow', 'shell-rattle'] }, { exp: 830 }); // Lv9 at 837
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 6 } }, data);
    playOut(s, (lg) => ({ type: 'move', move: lg.moves.findIndex((m) => m.id === 'undertow') }));
    const post = F.applyBattleResult(G, s);
    assert.equal(post.outcome, 'win');
    const lu = post.levelUps.find((l) => l.uid === G.world.party[0].uid);
    assert.ok(lu && lu.offers.includes('settle'), 'Settle at Lv9 waits for a slot');
    assert.equal(F.learnOffered(G, lu.uid, 'settle', null, data), false, 'keeping the techniques changes nothing');
    assert.equal(F.learnOffered(G, lu.uid, 'settle', 1, data), true);
    assert.deepEqual(G.world.party[0].moves.map((m) => m.id), ['tap', 'settle', 'undertow', 'shell-rattle']);
  });

  it('HP, PP and statuses come back by uid', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 12 });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    playOut(s);
    F.applyBattleResult(G, s);
    const copy = s.battle.sides[0].party[0];
    const rec = G.world.party[0];
    for (const m of rec.moves) assert.equal(m.pp, copy.moves.find((x) => x.id === m.id).pp);
    assert.ok(rec.hp <= rec.stats.hp);
  });
});

describe('between turns', () => {
  it('the battle Bag lists heal items, Crackdust with its refusal, and field-only medicine with a reason', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 10 });
    G.store.tx('items', (w) => { for (const [id, n] of [['salve', 2], ['crackdust', 1], ['revive', 1]]) bag.give(w, id, n, { data }); });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 4 } }, data);
    const rows = F.bagMenu(s, G.world);
    const salve = rows.find((r) => r.id === 'salve');
    assert.equal(salve.count, 2);
    assert.equal(salve.selectable, false, 'HP is full');
    const dust = rows.find((r) => r.id === 'crackdust');
    assert.equal(dust.selectable, false, 'Crackdust is refused (and kept) against a creature with no Ward');
    assert.equal(rows.find((r) => r.id === 'revive').reason, 'field-only');
  });

  it('a Salve heals its amount and is spent from the satchel', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 20 }, { hp: 10 });
    G.store.tx('items', (w) => bag.give(w, 'salve', 2, { data }));
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 2 } }, data);
    const ev = s.battle.step(F.prepareAction(s, { type: 'item', id: 'salve' }));
    F.noteEvents(G, s, ev);
    const heal = ev.find((e) => e.type === 'heal' && e.side === 0);
    assert.ok(heal);
    assert.equal(heal.amount, Math.min(25, s.battle.active(0).stats.hp - 10));
    assert.equal(bag.count(G.world, 'salve', undefined, { data }), 1);
  });

  it('the EXP bar model fills on exp events and wraps on a level', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 7 }, { exp: 392 });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data);
    const uid = G.world.party[0].uid;
    assert.equal(F.expDisplay(s, uid).frac, 0);
    F.applyExpEvent(s, { type: 'exp', uid, amount: 60 });
    assert.equal(F.expDisplay(s, uid).frac, 0.5, 'Lv7 → Lv8 spans 392..512');
    F.applyExpEvent(s, { type: 'exp', uid, amount: 60 });
    F.applyExpEvent(s, { type: 'levelup', uid, to: 8 });
    assert.equal(F.expDisplay(s, uid).level, 8);
    assert.equal(F.expDisplay(s, uid).frac, 0);
  });

  it('same seed and same choices give the same battle', () => {
    const run = () => {
      const G = makeG('FLUX-K7Q2-MD7F');
      give(G, { speciesId: 'sloshkin', level: 9 });
      const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'lowmoor-tibby' }, data);
      playOut(s);
      return JSON.stringify(s.battle.log.map((e) => [e.type, e.side, e.amount, e.hp]));
    };
    assert.equal(run(), run());
  });
});

describe('startBattle and the debug hooks', () => {
  it('startBattle pushes the battle scene and resolves with its PostBattle', async () => {
    const G = makeG();
    const p = F.startBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } });
    assert.equal(G.pushed[0][0], 'battle');
    G.pushed[0][1].onDone({ outcome: 'run' });
    assert.deepEqual(await p, { outcome: 'run' });
  });

  it('installBattleDebug binds battle / wild / forceForecast once', () => {
    const bound = {};
    const G = { ...makeG(), debugHook: { bind: (n, fn) => { bound[n] = fn; }, isBound: (n) => !!bound[n] } };
    assert.equal(F.installBattleDebug(G), true);
    assert.deepEqual(Object.keys(bound).sort(), ['battle', 'forceForecast', 'wild']);
    assert.equal(F.installBattleDebug({}), false, 'no hook, no binding');
  });
});

describe('finished battle integration', () => {
  it('runs the Weather Spire cycle and keeps trainer held items and entry weather', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 50 });
    const weather = F.buildBattle(G, { kind: 'trainer', trainerId: 'ines-spire' }, data);
    assert.equal(weather.battle.state().weather.kind, 'steam');
    assert.deepEqual(weather.battle.state().weather.posted.slice(0, 3).map((p) => p.kind), ['steam', 'steam', 'steam']);
    const cass = F.buildBattle(G, { kind: 'trainer', trainerId: 'cass-keeper' }, data);
    assert.equal(cass.battle.state().weather.kind, 'squall');
    assert.equal(cass.battle.sides[1].party.find((c) => c.speciesId === 'skeinwing').heldItem, 'whetstone');
  });

  it('uses cure and Ether items only when useful, and refuses a fourth Salve without spending it', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 30, moves: ['tap'], heartmark: null });
    G.store.tx('medicine', (w) => { for (const id of ['poultice', 'ether', 'salve']) bag.give(w, id, 4, { data }); });
    const s = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 2 } }, data);
    const b = s.battle;
    const c = b.active(0);
    assert.equal(F.bagMenu(s, G.world).find((x) => x.id === 'poultice').selectable, false);
    c.status = { kind: 'poison', turns: 0 };
    c.moves[0].pp = 0;
    let events = b.step(F.prepareAction(s, { type: 'item', id: 'poultice' }));
    F.noteEvents(G, s, events);
    assert.equal(c.status, null);
    assert.equal(bag.count(G.world, 'poultice', undefined, { data }), 3);
    events = b.step(F.prepareAction(s, { type: 'item', id: 'ether' }));
    F.noteEvents(G, s, events);
    assert.equal(c.moves[0].pp, Math.min(10, c.moves[0].maxPp));
    for (let i = 0; i < 3; i++) {
      c.hp = 1;
      events = b.step(F.prepareAction(s, { type: 'item', id: 'salve' }));
      F.noteEvents(G, s, events);
    }
    c.hp = 1;
    assert.equal(c.mends, 0);
    assert.equal(F.bagMenu(s, G.world).find((x) => x.id === 'salve').selectable, false);
    assert.throws(() => b.step(F.prepareAction(s, { type: 'item', id: 'salve' })), /No Mends/);
    assert.equal(bag.count(G.world, 'salve', undefined, { data }), 1);
  });

  it('activates Dusksight only between 18:00 and 06:00', () => {
    const G = makeG();
    give(G, { speciesId: 'duskowl', level: 30 });
    const build = (minute) => {
      G.store.tx('time', (w) => { w.clock.total = minute; });
      return F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 30 } }, data).battle.data.ability('dusksight');
    };
    const day = build(12 * 60);
    const night = build(20 * 60);
    assert.equal(day.hooks.onAttackMult, undefined);
    assert.equal(night.hooks.onAttackMult({ moveType: 'Hollow' }), 1.2);
  });

  it('plays seven protected two-turn Reading phases, closes without EXP and blocks capture and running', () => {
    const G = makeG();
    give(G, { speciesId: 'sloshkin', level: 5, moves: ['tap'], heartmark: null });
    const phases = ['Brine', 'Stone', 'Kiln', 'Hollow', 'Gust', 'Rime', 'Star'].map((type) => ({ id: type.toLowerCase(), name: type, types: [type], turns: 2 }));
    const s = F.buildBattle(G, { kind: 'wild', source: 'reading', holdOut: 14, wild: { speciesId: 'vagary', level: 50, readingPhases: phases } }, data);
    const b = s.battle;
    assert.equal(b.legal(0).run.available, false);
    assert.equal(b.legal(0).lantern.available, false);
    assert.throws(() => b.step({ type: 'lantern', grade: 1 }), /Reading/);
    b.active(0).hp = 1;
    b.active(1).hp = 1;
    for (let turn = 0; turn < 14; turn++) {
      assert.deepEqual(b.active(1).types, phases[Math.floor(turn / 2)].types);
      b.step({ type: 'move', move: 0 });
      assert.ok(b.active(0).hp >= 1 && b.active(1).hp >= 1);
    }
    assert.equal(b.result().outcome, 'reading');
    assert.deepEqual(b.result().exp, []);
    const before = G.world.party[0].exp;
    const post = F.applyBattleResult(G, s);
    assert.equal(post.blackout, null);
    assert.equal(post.payout, 0);
    assert.equal(G.world.party[0].exp, before);
  });
});

describe('capture storage', () => {
  it('refuses a raise before spending a wick at full storage, then the completed Cellar opens space', () => {
    const G = makeG();
    for (let i = 0; i < 26; i++) give(G, { speciesId: 'tossup', level: 5 });
    G.store.tx('wicks', (w) => bag.give(w, 'tallow-wick', 2, { data }));
    assert.equal(G.world.party.length, 6);
    assert.equal(G.world.box.length, 20);
    const full = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data);
    assert.equal(full.battle.legal(0).lantern.available, false);
    assert.throws(() => full.battle.step({ type: 'lantern', grade: 1 }), /storage are full/);
    assert.equal(bag.count(G.world, 'tallow-wick', undefined, { data }), 2);
    G.store.tx('cellar', (w) => w.loans.builds.push({ id: 'cellar', tier: 3, readyDay: 0, done: true, choice: null }));
    assert.equal(party.boxCapacity(G.world, { tuning }), 40);
    const space = F.buildBattle(G, { kind: 'wild', wild: { speciesId: 'tossup', level: 3 } }, data);
    assert.equal(space.battle.legal(0).lantern.available, true);
  });
});

describe('story battles cost nothing (GDD-00 §6, §8)', () => {
  it('the dock hold-out heals the party and pays its 100 EXP even when the starter falls', () => {
    const G = makeG();
    give(G, { speciesId: 'reedkit', level: 5 });
    const before = G.world.party[0].exp;
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'linnet-dock' }, data);
    playOut(s);
    const outcome = s.battle.outcome;
    F.applyBattleResult(G, s);
    const c = G.world.party[0];
    assert.equal(c.hp, c.stats.hp, `healed after the hold-out (outcome ${outcome})`);
    assert.ok(c.exp - before >= tuning.holdOutExp, `gained at least ${tuning.holdOutExp} EXP (got ${c.exp - before}, outcome ${outcome})`);
    assert.equal(G.world.flags['sys.blackout'] ?? false, false, 'no blackout');
  });
});

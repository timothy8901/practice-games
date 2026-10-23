// Independent verification pass: adversarial scenarios against the rules doc
// (sections 8, 9, 10, 12, 15, 17) and the architecture draft (section 5.1),
// plus a 2,000-battle headless fuzz. Every test here was written against the
// spec text, not the engine, so it catches drift in either direction.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, constRng, seqRng, mk, duel, ofType, slotOf } from './helpers.mjs';
import {
  createBattle, BattleError, damageFormula, captureOdds, catchUpMult, DIAL_RULES,
  EVASION_CAP, EVASION_MULT, PLUMBLINE_BLOCK_TURNS, CAPTURE_FAIL_BONUS, CAPTURE_FAIL_CAP, BENCH_SHARE, CATCH_UP_CAP, MAX_TURNS, LANTERN,
} from '../engine.js';
import { chooseAction, chooseTrainerAction, chooseWildAction, isLegal } from '../ai.js';
import { simulate, simulateBattle, randomParty } from '../sim.js';
import { SPECIES_LIST, ROSTER_IDS, getSpecies } from '../species.js';
import { makeCreature, MENDS_PER_BATTLE } from '../creature.js';
import { MOVE_LIST, getMove, isDamaging } from '../moves.js';
import { getAbility } from '../abilities.js';

const fixedFoe = (move = 0) => () => ({ type: 'move', move });

// ---------------------------------------------------------------------------
// 9.1 / 9.2: 0 PP everywhere -> Scrap, for every species and both brains
// ---------------------------------------------------------------------------
describe('0 PP everywhere -> Scrap (rules 9.1, 9.2)', () => {
  it('every species in the data, drained to 0 PP, gets exactly one legal attack: Scrap', () => {
    for (const sp of SPECIES_LIST) {
      for (const level of [5, 50]) {
        const me = makeCreature({ speciesId: sp.id, level, rng: makeRng(`drain-${sp.id}-${level}`) });
        for (const m of me.moves) m.pp = 0;
        for (const kind of ['trainer', 'wild']) {
          me.hp = me.stats.hp;
          const foe = mk('tossup', 1, ['settle']);
          const bt = duel(me, foe, { kind, foeAi: fixedFoe() });
          const menu = bt.availableActions(0);
          assert.ok(menu.moves.every((m) => !m.selectable && m.reason === 'No PP left.'), `${sp.id}: every move greyed with the reason`);
          assert.equal(menu.scrap.available, true, `${sp.id}: Scrap offered`);
          assert.equal(menu.scrap.usable, true);
          assert.ok(menu.scrap.cost >= 1);
          assert.throws(() => bt.submit([{ type: 'move', move: 0 }]), (e) => e instanceof BattleError && e.code === 'NO_PP', `${sp.id}: engine double-checks the menu rule`);
          const ai = kind === 'wild' ? chooseWildAction(bt, 0) : chooseTrainerAction(bt, 0);
          assert.deepEqual(ai, { type: 'scrap' }, `${sp.id}: ${kind} brain falls back to Scrap`);
          const evs = bt.submit([{ type: 'scrap' }]);
          assert.ok(ofType(evs, 'move').some((e) => e.side === 0 && e.move === 'scrap'));
          assert.ok(ofType(evs, 'scrap-cost').some((e) => e.side === 0), 'Scrap costs HP');
          assert.ok(me.moves.every((m) => m.pp === 0), 'Scrap spends no PP');
        }
      }
    }
  });

  it('Scrap is never offered while any move still has PP, and is typeless/neutral, 50 power, never misses', () => {
    const me = mk('tossup', 20, ['tap', 'knuckle']);
    me.moves[0].pp = 0;
    const bt = duel(me, mk('tossup', 20, ['tap']), { foeAi: fixedFoe() });
    assert.equal(bt.availableActions(0).scrap.available, false);
    assert.throws(() => bt.submit([{ type: 'scrap' }]), (e) => e.code === 'SCRAP_UNAVAILABLE');
    const scrap = getMove('scrap');
    assert.equal(scrap.type, null);
    assert.equal(scrap.power, 50);
    assert.equal(scrap.accuracy, null);
    assert.equal(scrap.pp, null);
  });

  it('Scrap through an evasion wall still never misses, and its HP cost applies when a Ward blocks it (9.2 Proposed)', () => {
    const me = mk('tossup', 30, ['tap']);
    me.moves[0].pp = 0;
    const ray = mk('vesperay', 30, ['mirror-step', 'salt-spray']);
    const bt = duel(me, ray, { rng: constRng(0.99), foeAi: fixedFoe(0) });
    bt.submit([{ type: 'scrap' }]);
    bt.submit([{ type: 'scrap' }]);
    assert.equal(bt.sides[1].vol.stages.eva, 2);
    const evs = bt.submit([{ type: 'scrap' }]);
    assert.equal(ofType(evs, 'miss').filter((e) => e.side === 0).length, 0, 'Scrap never misses');
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'));

    const prism = mk('prismoth', 30, ['settle']);
    const me2 = mk('tossup', 30, ['tap']);
    me2.moves[0].pp = 0;
    const bt2 = duel(me2, prism, { foeAi: fixedFoe() });
    const before = me2.hp;
    const evs2 = bt2.submit([{ type: 'scrap' }]);
    assert.ok(ofType(evs2, 'blocked').some((e) => e.reason === 'ward'), 'Scrap does not pierce the Ward (8.6)');
    assert.equal(me2.hp, before - Math.max(1, Math.floor(me2.stats.hp / 8)), 'the 1/8 cost still applies');
  });
});

// ---------------------------------------------------------------------------
// 8.3: Ward vs a party with no Strong move but a chip move
// ---------------------------------------------------------------------------
describe('Ward readout with no Strong technique but a chip technique (rules 8.3)', () => {
  it('lists the chip technique by creature and move name, the types that get through, and indirect damage', () => {
    const lead = mk('tossup', 25, ['tap', 'shell-rattle'], { nickname: 'TOSS' });
    const bench = mk('rushling', 25, ['reed-whip', 'spore-drift'], { nickname: 'RUSH' });
    const prism = mk('prismoth', 25, ['settle']);
    const bt = duel([lead, bench], prism, { foeAi: fixedFoe() });
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    const ro = ofType(evs, 'ward-readout')[0];
    assert.ok(ro, 'a readout follows the blocked hit');
    assert.deepEqual(ro.canLand, [], 'no direct technique lands');
    assert.deepEqual(ro.types, ['Kiln', 'Rime']);
    assert.deepEqual(ro.indirect, ['poison', 'burn', 'trap']);
    assert.deepEqual(ro.chip.map((e) => [e.creature, e.move, e.kind]), [['RUSH', 'spore-drift', 'poison']]);
    assert.match(ro.text, /RUSH's Spore Drift \(poison\)/);
    assert.match(ro.text, /Prism Ward held\. Only Strong hits get through\./);
    assert.equal(ro.crackdust, false);
  });

  it('the listed chip technique really works: poison applied through Prism Ward chips every turn', () => {
    const me = mk('rushling', 25, ['spore-drift', 'reed-whip']);
    const prism = mk('prismoth', 25, ['settle']);
    const bt = duel(me, prism, { rng: constRng(0.1), foeAi: fixedFoe() });
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'status').some((e) => e.side === 1 && e.kind === 'poison' && e.action === 'inflict'));
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'status'));
  });

  it('once the target already carries a condition, that status chip move is no longer listed; a trap still is', () => {
    const me = mk('rushling', 25, ['spore-drift', 'root-knot', 'reed-whip']);
    const prism = mk('prismoth', 25, ['settle']);
    const bt = duel(me, prism, { rng: constRng(0.1), foeAi: fixedFoe() });
    bt.submit([{ type: 'move', move: 0 }]);
    const evs = bt.submit([{ type: 'move', move: 2 }]);
    const ro = ofType(evs, 'ward-readout')[0];
    assert.deepEqual(ro.chip.map((e) => e.move), ['root-knot']);
  });

  it('against Mirrorveil (status moves fail) only chip from a damaging hit is listed, and the damaging moves land', () => {
    const me = mk('creelwight', 30, ['corrode', 'rust-bite', 'tap']);
    const lum = mk('lumenveil', 30, ['dazzle']);
    const bt = duel(me, lum, { foeAi: () => ({ type: 'move', move: 0 }) });
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    const ro = ofType(evs, 'ward-readout')[0];
    assert.ok(ro && ro.wardKind === 'no-status');
    assert.deepEqual(ro.chip.map((e) => e.move), ['rust-bite']);
    assert.ok(ro.canLand.some((e) => e.move === 'rust-bite') && ro.canLand.some((e) => e.move === 'tap'));
  });

  it('Stillcoat: a 50-power chip move lands (threshold is "under 50"), a 45-power one does not, and the readout agrees', () => {
    const me = mk('caldermaw', 30, ['ember-lick', 'slag-burst']);
    const nub = mk('chillnub', 30, ['settle']);
    const bt = duel(me, nub, { foeAi: fixedFoe() });
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    const ro = ofType(evs, 'ward-readout')[0];
    assert.ok(ro && ro.wardKind === 'min-power');
    assert.deepEqual(ro.canLand.map((e) => e.move), ['slag-burst']);
    assert.deepEqual(ro.chip.map((e) => e.move), ['slag-burst']);
    assert.equal(bt.availableActions(0).moves[0].word, 'Blocked by Ward');
    assert.equal(bt.availableActions(0).moves[1].word, 'Strong');
  });
});

// ---------------------------------------------------------------------------
// 10.1: evasion cap, Mends, guard
// ---------------------------------------------------------------------------
describe('evasion cap and Afterimage (rules 10.1)', () => {
  it('three, four and five evasion attempts never pass +2; the panel hit chance bottoms out at x0.67; at most 2 decoys', () => {
    const ray = mk('vesperay', 40, ['mirror-step', 'salt-spray']);
    const me = mk('tossup', 40, ['tap']);
    const bt = duel(me, ray, { foeAi: fixedFoe(0) });
    for (let i = 0; i < 5; i++) {
      const evs = bt.submit([{ type: 'move', move: 0 }]);
      const st = ofType(evs, 'stat').filter((e) => e.side === 1 && e.stat === 'eva');
      assert.ok(bt.sides[1].vol.stages.eva <= EVASION_CAP, `attempt ${i + 1}: eva ${bt.sides[1].vol.stages.eva}`);
      if (i >= 2) {
        assert.ok(st.some((e) => e.result === 'capped'), `attempt ${i + 1} reports the cap`);
        assert.equal(ofType(evs, 'decoy').length, 0, 'no third decoy');
      }
      assert.ok(ofType(evs, 'decoy').every((e) => e.count <= 2));
    }
    assert.equal(bt.sides[1].vol.stages.eva, EVASION_CAP);
    assert.equal(bt.availableActions(0).moves[0].hitChance, EVASION_MULT[2]);
    assert.equal(EVASION_MULT[2], 0.67);
    assert.equal(EVASION_MULT[1], 0.83);
    assert.equal(getMove('mirror-step').pp, 5, 'evasion move PP at most 5');
  });

  it('a 100%-accuracy move lands about two hits in three at the +2 cap (design goal 10.4)', () => {
    const ray = mk('vesperay', 40, ['mirror-step', 'settle']);
    const me = mk('stillox', 40, ['tap']);
    const rng = makeRng('two-in-three');
    const bt = duel(me, ray, { rng, foeAi: (b) => ({ type: 'move', move: b.sides[1].vol.stages.eva < 2 ? 0 : 1 }) });
    bt.submit([{ type: 'move', move: 0 }]);
    bt.submit([{ type: 'move', move: 0 }]);
    let hits = 0;
    let tries = 0;
    for (let i = 0; i < 190 && bt.phase === 'choose'; i++) {
      ray.hp = ray.stats.hp;
      for (const m of [...ray.moves, ...me.moves]) m.pp = m.maxPp;
      const evs = bt.submit([{ type: 'move', move: 0 }]);
      tries++;
      if (ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party')) hits++;
      if (ofType(evs, 'decoy-pop').length) bt.sides[1].vol.stages.eva = 2; // keep the wall at the cap
    }
    assert.ok(tries >= 150, `tries ${tries}`);
    assert.ok(hits / tries > 0.58 && hits / tries < 0.76, `hit rate ${(hits / tries).toFixed(2)}`);
  });
});

describe('Mends budget (rules 10.1, lead decision)', () => {
  it('three recovery uses succeed, the fourth fails with a blocked event and heals nothing', () => {
    const me = mk('sloshkin', 40, ['tidal-mend', 'tap']);
    const foe = mk('tossup', 5, ['settle']);
    const bt = duel(me, foe, { rng: constRng(0.99), foeAi: fixedFoe() });
    assert.equal(me.mends, MENDS_PER_BATTLE);
    let heals = 0;
    for (let i = 0; i < 4 && bt.phase === 'choose'; i++) {
      me.hp = Math.max(1, Math.floor(me.stats.hp * 0.3));
      const evs = bt.submit([{ type: 'move', move: 0 }]);
      const healed = ofType(evs, 'heal').filter((e) => e.side === 0 && e.source === 'tidal-mend');
      if (i < 3) {
        assert.equal(healed.length, 1, `use ${i + 1} heals`);
        heals++;
      } else {
        assert.equal(healed.length, 0, 'the fourth use heals nothing');
        assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'no-mends'), 'and the failure is announced');
        assert.equal(me.mends, 0);
      }
    }
    assert.equal(heals, 3);
  });

  it('the delayed Vesper Mend also counts against the same budget, and the Mend is spent even when a Hollow hit cancels it', () => {
    const ray = mk('vesperay', 50, ['vesper-mend']);
    const me = mk('scrapling', 10, ['shadowbox']);
    const bt = duel(me, ray, { rng: constRng(0.99), foeAi: fixedFoe(0) });
    for (let i = 0; i < 3; i++) {
      ray.hp = Math.floor(ray.stats.hp * 0.6);
      const evs = bt.submit([{ type: 'move', move: 0 }]);
      assert.ok(ofType(evs, 'mend-spent').some((e) => e.side === 1), `use ${i + 1} spends a Mend`);
      assert.ok(ofType(evs, 'mend-cancelled').some((e) => e.side === 1), `Shadowbox cancels use ${i + 1}`);
    }
    assert.equal(ray.mends, 0);
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 1 && e.reason === 'no-mends'));
  });

  it('Mends reset to 3 at the start of every battle', () => {
    const me = mk('sloshkin', 40, ['tidal-mend']);
    me.mends = 0;
    duel(me, mk('tossup', 5, ['tap']));
    assert.equal(me.mends, 3);
  });
});

describe('guard (rules 10.1)', () => {
  it('guard twice in a row: the second fails with a blocked event and does not guard; the third works again', () => {
    const me = mk('tossup', 30, ['shellguard']);
    const foe = mk('caldermaw', 30, ['kiln-maw']);
    const bt = duel(me, foe, { rng: constRng(0.99), foeAi: fixedFoe() });
    let evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'guard').some((e) => e.side === 0));
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 1 && e.reason === 'guard'), 'the foe is blocked');
    assert.equal(me.hp, me.stats.hp);
    evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'consecutive-guard'));
    assert.equal(ofType(evs, 'guard').length, 0);
    assert.ok(me.hp < me.stats.hp, 'the second guard protected nothing');
    me.hp = me.stats.hp;
    evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'guard').some((e) => e.side === 0), 'the third guard works again');
    assert.equal(me.hp, me.stats.hp);
  });
});

// ---------------------------------------------------------------------------
// 10.2: Plumbline
// ---------------------------------------------------------------------------
describe('Plumbline (rules 10.2)', () => {
  it('always hits a +2 evasion wall, clears every stage and blocks re-boosting for exactly 2 turns', () => {
    const ray = mk('vesperay', 50, ['mirror-step', 'lens-focus', 'settle']);
    const me = mk('tossup', 50, ['plumbline', 'settle']);
    const bt = duel(me, ray, { rng: constRng(0.99), foeAi: fixedFoe(0) });
    bt.submit([{ type: 'move', move: 1 }]);
    bt.submit([{ type: 'move', move: 1 }]);
    assert.equal(bt.sides[1].vol.stages.eva, 2);
    const foeBoost = () => ({ type: 'move', move: 1 });
    bt.foeAi = foeBoost;
    let evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'miss').length, 0);
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.result === 'cleared'));
    assert.deepEqual(bt.sides[1].vol.stages, { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, eva: 0 });
    assert.equal(bt.state().sides[1].boostBlocked, true);
    assert.equal(bt.state().sides[1].boostBlockedTurns, PLUMBLINE_BLOCK_TURNS);
    for (let t = 0; t < PLUMBLINE_BLOCK_TURNS; t++) {
      evs = bt.submit([{ type: 'move', move: 1 }]);
      assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.result === 'blocked' && e.reason === 'plumbline'), `re-boost blocked on turn +${t + 1}`);
      assert.equal(bt.sides[1].vol.stages.spa, 0);
    }
    assert.equal(bt.state().sides[1].boostBlocked, false, 'the menu for the third turn shows no lock');
    assert.equal(bt.state().sides[1].boostBlockedTurns, 0);
    evs = bt.submit([{ type: 'move', move: 1 }]);
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.result === 'raised'), 'the third turn after Plumbline may boost again');
    assert.equal(PLUMBLINE_BLOCK_TURNS, 2);
  });

  it('is sure-hit in the data and typeless', () => {
    const p = getMove('plumbline');
    assert.equal(p.accuracy, null);
    assert.equal(p.type, null);
    assert.equal(p.effect.plumbline, true);
  });
});

// ---------------------------------------------------------------------------
// 15.2: Capture Stance never KOs
// ---------------------------------------------------------------------------
describe('Capture Stance (rules 15.2)', () => {
  it('a Lv100 Caldermaw cannot drop a Lv2 wild creature below 1 HP: single hits, multi-hit, drain, chip and Scrap', () => {
    const rng = makeRng('stance-fuzz');
    let floors = 0;
    for (let i = 0; i < 120; i++) {
      const attacker = makeCreature({ speciesId: rng.pick(['caldermaw', 'stillox', 'brinelance', 'sedgehare', 'scrapling']), level: 100, moves: rng.pick([['kiln-maw', 'pummel'], ['bedrock-charge', 'grind-down'], ['echo-drain', 'gnash'], ['spore-drift', 'reap'], ['root-knot', 'pummel'], ['scorch', 'tap']]), rng });
      if (rng.chance(0.3)) for (const m of attacker.moves) m.pp = 0;
      const wild = makeCreature({ speciesId: rng.pick(ROSTER_IDS), level: 2, rng, wild: true });
      const bt = createBattle({ sides: [{ party: [attacker] }, { party: [wild] }], kind: 'wild', dial: 'flux', rng: rng.fork(`b${i}`), captureStance: true, foeAi: chooseAction });
      for (let t = 0; t < 8 && bt.phase === 'choose'; t++) {
        const menu = bt.availableActions(0);
        const action = menu.scrap.available ? { type: 'scrap' } : { type: 'move', move: rng.pick(menu.moves.filter((m) => m.selectable)).index };
        const evs = bt.submit([action]);
        assert.ok(wild.hp >= 1, `seed ${i} turn ${t}: wild at ${wild.hp}`);
        for (const e of ofType(evs, 'damage')) if (e.side === 1 && e.source !== 'self') assert.ok(e.hp >= 1);
        if (ofType(evs, 'damage').some((e) => e.side === 1 && e.stanceFloor)) floors++;
        assert.equal(ofType(evs, 'faint').filter((e) => e.side === 1).length, 0, `seed ${i}: the wild creature never faints under Stance`);
      }
      assert.notEqual(bt.outcome, 'win', 'the player cannot KO the wild creature while Stance is on');
    }
    assert.ok(floors > 50, `the floor actually engaged (${floors})`);
  });

  it('is a free toggle in wild battles only, costs no turn, and is refused in trainer battles', () => {
    const me = mk('caldermaw', 40, ['kiln-maw']);
    const wild = mk('tossup', 5, ['tap']);
    const bt = duel(me, wild, { kind: 'wild', foeAi: fixedFoe() });
    assert.equal(bt.availableActions(0).captureStance.on, false);
    const evs = bt.setCaptureStance(true);
    assert.ok(evs.some((e) => e.type === 'stance' && e.on));
    assert.equal(bt.turn, 0);
    assert.equal(bt.availableActions(0).captureStance.on, true);
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(wild.hp, 1);
    bt.setCaptureStance(false);
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(wild.hp, 0, 'with Stance off the KO lands');
    const tb = duel(me, mk('tossup', 5, ['tap']));
    assert.throws(() => tb.setCaptureStance(true), (e) => e.code === 'NO_STANCE');
    assert.equal(tb.availableActions(0).captureStance.available, false);
  });
});

// ---------------------------------------------------------------------------
// 15.4: capture odds
// ---------------------------------------------------------------------------
describe('capture odds (rules 15.4)', () => {
  it('for every species and every Lantern grade, 1 HP + a status beats full HP and no status', () => {
    for (const sp of SPECIES_LIST) {
      for (const grade of [1, 2, 3]) {
        const maxHp = 120;
        const full = captureOdds({ catchRate: sp.catchRate, hp: maxHp, maxHp, status: null, grade });
        for (const status of ['burn', 'poison', 'chill', 'numb']) {
          const low = captureOdds({ catchRate: sp.catchRate, hp: 1, maxHp, status, grade });
          assert.ok(low > full, `${sp.id} grade ${grade} ${status}: ${low} <= ${full}`);
        }
        const trapped = captureOdds({ catchRate: sp.catchRate, hp: 1, maxHp, status: null, trapped: true, grade });
        assert.ok(trapped > full);
        assert.ok(full >= 0.01 && full <= 0.99 && trapped <= 0.99);
      }
    }
  });

  it('each failed attempt adds exactly +3%, capped at +15% after five fails, then flat', () => {
    assert.equal(CAPTURE_FAIL_BONUS, 0.03);
    assert.equal(CAPTURE_FAIL_CAP, 0.15);
    const base = { catchRate: 45, hp: 60, maxHp: 100, status: null, grade: 1 };
    const p0 = captureOdds({ ...base, fails: 0 });
    for (let f = 1; f <= 10; f++) {
      const p = captureOdds({ ...base, fails: f });
      const expected = p0 + Math.min(0.15, 0.03 * f);
      assert.ok(Math.abs(p - expected) < 1e-12, `fails ${f}: ${p} vs ${expected}`);
    }
    assert.equal(captureOdds({ ...base, fails: 5 }), captureOdds({ ...base, fails: 50 }));
  });

  it('in battle the fail counter climbs per attempt on the same creature and the menu shows the bonus', () => {
    const me = mk('tossup', 10, ['tap']);
    const wild = mk('stillox', 60, ['settle']);
    const bt = duel(me, wild, { kind: 'wild', rng: constRng(0.999), foeAi: fixedFoe() });
    const first = bt.availableActions(0).lantern.grades[0].odds;
    for (let f = 1; f <= 7; f++) {
      const evs = bt.submit([{ type: 'lantern', grade: 1 }]);
      assert.ok(ofType(evs, 'capture-fail').some((e) => e.fails === f));
      const menu = bt.availableActions(0).lantern;
      assert.equal(menu.fails, f);
      assert.ok(Math.abs(menu.grades[0].odds - (first + Math.min(0.15, 0.03 * f))) < 1e-12, `menu after ${f} fails`);
    }
  });

  it('Freefall shows bands only: no exact odds in the menu or in the capture events', () => {
    const me = mk('tossup', 10, ['tap']);
    const wild = mk('tossup', 10, ['tap']);
    const bt = duel(me, wild, { kind: 'wild', dial: 'freefall', rng: constRng(0.999), foeAi: fixedFoe() });
    const menu = bt.availableActions(0).lantern;
    assert.equal(menu.exactOdds, false);
    assert.ok(menu.grades.every((g) => g.odds === null && ['Low', 'Fair', 'Good'].includes(g.band)));
    const evs = bt.submit([{ type: 'lantern', grade: 1 }]);
    assert.equal(ofType(evs, 'capture-shake')[0].odds, null);
    assert.equal(ofType(evs, 'capture-fail')[0].nextOdds, null);
    assert.ok(['Low', 'Fair', 'Good'].includes(ofType(evs, 'capture-fail')[0].nextBand));
    assert.ok(['Low', 'Fair', 'Good'].includes(ofType(evs, 'capture-shake')[0].band));
  });
});

// ---------------------------------------------------------------------------
// 12.1: bench EXP and catch-up
// ---------------------------------------------------------------------------
describe('EXP (rules 12.1)', () => {
  it('bench members get exactly 60% of what a battler gets, every time, for every level', () => {
    assert.equal(BENCH_SHARE, 0.6);
    for (const level of [5, 20, 45]) {
      const a = mk('sloshkin', level, ['tap'], { nickname: 'A' });
      const b = mk('tossup', level, ['tap'], { nickname: 'B' });
      const c = mk('wirewhisk', level, ['jolt'], { nickname: 'C' });
      const foe = mk('tossup', 5, ['settle']);
      const bt = duel([a, b, c], foe, { rng: constRng(0.5), foeAi: fixedFoe() });
      while (bt.phase === 'choose') bt.submit([{ type: 'move', move: 0 }]);
      assert.equal(bt.outcome, 'win');
      const got = Object.fromEntries(bt.result().exp.map((e) => [e.name, e.amount]));
      assert.ok(got.A > 0);
      assert.equal(got.B, Math.floor(got.A * 0.6), `level ${level}: bench B`);
      assert.equal(got.C, Math.floor(got.A * 0.6), `level ${level}: bench C`);
    }
  });

  it('catch-up follows the table and caps at x3 (20+ under); over-curve gains are never below x1 outside the Rematch board', () => {
    assert.equal(CATCH_UP_CAP, 3);
    const table = [[0, 1], [4, 1], [5, 1.5], [9, 1.5], [10, 2], [14, 2], [15, 2.5], [19, 2.5], [20, 3], [25, 3], [40, 3], [99, 3]];
    for (const [under, mult] of table) assert.equal(catchUpMult(50 - under, 50), mult, `${under} under`);
    assert.equal(catchUpMult(80, 50), 1);
    assert.equal(catchUpMult(30, null), 1);
    const far = mk('tossup', 1, ['tap'], { nickname: 'FAR' });
    const near = mk('tossup', 1, ['tap'], { nickname: 'NEAR' });
    const run = (party, curveLevel) => {
      const foe = mk('tossup', 5, ['settle']);
      const bt = duel(party, foe, { rng: constRng(0.5), foeAi: fixedFoe(), curveLevel });
      while (bt.phase === 'choose') bt.submit([{ type: 'move', move: 0 }]);
      assert.equal(bt.outcome, 'win');
      return bt.result().exp[0].amount;
    };
    const base = run([mk('tossup', 1, ['tap'])], null);
    assert.equal(run([far], 21), base * 3, 'Lv1 under a Lv21 curve: x3');
    assert.equal(run([near], 60), base * 3, 'Lv1 under a Lv60 curve: still x3, never more');
  });
});

// ---------------------------------------------------------------------------
// Damage never NaN / negative
// ---------------------------------------------------------------------------
describe('damage formula safety', () => {
  it('10,000 random inputs: integer, finite, never negative, 0 only on immunity or zero power, >= 1 otherwise', () => {
    const rng = makeRng('dmg-fuzz');
    for (let i = 0; i < 10000; i++) {
      const typeMult = rng.pick([0, 0.25, 0.5, 1, 2, 4]);
      const power = rng.pick([0, 1, 20, 50, 100, 150]);
      const d = damageFormula({
        level: rng.int(1, 100), power, attack: rng.int(1, 999), defense: rng.pick([0, 1, rng.int(1, 999)]), typeMult,
        stab: rng.chance(0.5), crit: rng.chance(0.5), rand: 0.85 + rng.next() * 0.15, burned: rng.chance(0.5), extra: rng.pick([0.5, 0.75, 1, 1.2, 1.3]),
      });
      assert.ok(Number.isInteger(d) && Number.isFinite(d) && d >= 0, `${d}`);
      if (typeMult === 0 || power === 0) assert.equal(d, 0);
      else assert.ok(d >= 1);
    }
  });

  it('every damaging technique against every roster species at Lv1 and Lv100 yields finite, non-negative damage events', () => {
    const rng = makeRng('all-moves');
    const dmg = MOVE_LIST.filter((m) => isDamaging(m) && !m.effect.scrap && !m.effect.charge && !m.effect.selfKo);
    for (const mv of dmg) {
      const target = makeCreature({ speciesId: rng.pick(ROSTER_IDS), level: rng.pick([1, 100]), rng });
      const user = makeCreature({ speciesId: 'vagary', level: rng.pick([1, 100]), moves: [mv.id], heartmark: null, rng });
      const bt = createBattle({ sides: [{ party: [user] }, { party: [target] }], kind: 'trainer', dial: 'drift', rng: rng.fork(mv.id), foeAi: () => ({ type: 'move', move: 0 }) });
      const evs = bt.submit([{ type: 'move', move: 0 }]);
      for (const e of ofType(evs, 'damage')) {
        assert.ok(Number.isInteger(e.amount) && e.amount >= 0 && Number.isFinite(e.hp) && e.hp >= 0 && e.hp <= e.maxHp, `${mv.id}: ${JSON.stringify(e)}`);
      }
      for (const s of bt.sides) for (const c of s.party) assert.ok(Number.isFinite(c.hp) && c.hp >= 0 && c.hp <= c.stats.hp);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixes from this verification pass
// ---------------------------------------------------------------------------
describe('verification fixes', () => {
  it('the "Ward ?" badge follows the creature: it disappears when the Ward creature switches out and returns with it', () => {
    const prism = mk('prismoth', 20, ['dust-veil']);
    const toss = mk('tossup', 20, ['tap']);
    const me = mk('sloshkin', 20, ['tap']);
    let foeAct = { type: 'switch', to: 1 };
    const bt = duel(me, [prism, toss], { dial: 'drift', foeAi: () => foeAct });
    assert.equal(bt.state().sides[1].wardBadge, true);
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.active(1).speciesId, 'tossup');
    assert.equal(bt.state().sides[1].wardBadge, false, 'no badge on a non-Ward creature');
    foeAct = { type: 'switch', to: 0 };
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].wardBadge, true, 'back with Prismoth');
  });

  it('on Freefall the badge is remembered per creature once a hit was blocked', () => {
    const prism = mk('prismoth', 20, ['dust-veil']);
    const toss = mk('tossup', 20, ['tap']);
    const me = mk('sloshkin', 20, ['tap']);
    let foeAct = { type: 'move', move: 0 };
    const bt = duel(me, [prism, toss], { dial: 'freefall', foeAi: () => foeAct });
    assert.equal(bt.state().sides[1].wardBadge, false);
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].wardBadge, true);
    foeAct = { type: 'switch', to: 1 };
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].wardBadge, false);
    foeAct = { type: 'switch', to: 0 };
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].wardBadge, true);
  });

  it('Keen Glint: whenever the chosen hit crits, the glint was announced first (Reap adds a crit stage)', () => {
    const rng = makeRng('glint-vs-crit');
    let crits = 0;
    for (let i = 0; i < 200; i++) {
      const hare = mk('sedgehare', 30, ['reap', 'reed-whip']);
      const foe = mk('stillox', 30, ['settle']);
      const bt = duel(hare, foe, { rng: rng.fork(i), foeAi: fixedFoe() });
      const evs = bt.submit([{ type: 'move', move: i % 2 }]);
      const crit = ofType(evs, 'crit').some((e) => e.side === 0);
      const glint = ofType(evs, 'glint').some((e) => e.side === 0);
      assert.equal(crit, glint, `battle ${i}: crit ${crit} glint ${glint}`);
      if (crit) crits++;
    }
    assert.ok(crits > 30, `crits happened (${crits})`);
  });

  it('accepts the architecture draft action shape {type:"item", id} as well as {item}', () => {
    const prism = mk('prismoth', 20, ['settle']);
    const me = mk('sloshkin', 20, ['tap']);
    const bt = duel(me, prism, { bag: { crackdust: 2 }, foeAi: fixedFoe() });
    assert.ok(isLegal(bt, 0, { type: 'item', id: 'crackdust' }));
    const evs = bt.submit([{ type: 'item', id: 'crackdust' }]);
    assert.ok(ofType(evs, 'ward-suppressed').length === 1);
    assert.equal(bt.sides[0].bag.crackdust, 1);
  });

  it('Crackdust against a creature without a Ward (or one already suppressed) is refused instead of wasted', () => {
    const me = mk('sloshkin', 20, ['tap']);
    const bt = duel(me, mk('tossup', 20, ['tap']), { bag: { crackdust: 1 }, foeAi: fixedFoe() });
    assert.throws(() => bt.submit([{ type: 'item', item: 'crackdust' }]), (e) => e.code === 'NO_WARD');
    assert.equal(bt.sides[0].bag.crackdust, 1);
    const bt2 = duel(mk('sloshkin', 20, ['tap']), mk('prismoth', 20, ['settle']), { bag: { crackdust: 2 }, foeAi: fixedFoe() });
    bt2.submit([{ type: 'item', item: 'crackdust' }]);
    assert.throws(() => bt2.submit([{ type: 'item', item: 'crackdust' }]), (e) => e.code === 'NO_WARD');
    assert.equal(bt2.sides[0].bag.crackdust, 1);
  });

  it('step(action) during a foe-only replacement ignores the player action and lets foeAi pick', () => {
    const me = mk('caldermaw', 60, ['kiln-maw']);
    const foes = [mk('tossup', 5, ['tap']), mk('tossup', 5, ['tap'])];
    const bt = duel(me, foes, { foeAi: (b) => (b.phase === 'replace' ? { type: 'switch', to: 1 } : { type: 'move', move: 0 }) });
    bt.step({ type: 'move', move: 0 });
    assert.equal(bt.phase, 'replace');
    assert.deepEqual(bt.pendingReplace, [1]);
    const evs = bt.step({ type: 'move', move: 0 });
    assert.ok(ofType(evs, 'switch').some((e) => e.side === 1));
    assert.equal(bt.phase, 'choose');
  });

  it('menu entries carry the architecture aliases i / usable alongside index / selectable', () => {
    const me = mk('tossup', 20, ['tap', 'knuckle']);
    me.moves[1].pp = 0;
    const bt = duel(me, mk('tossup', 20, ['tap']), { kind: 'wild', foeAi: fixedFoe() });
    const menu = bt.legal(0);
    for (const m of menu.moves) {
      assert.equal(m.i, m.index);
      assert.equal(m.usable, m.selectable);
    }
    assert.equal(menu.moves[1].usable, false);
    for (const s of menu.switches) assert.equal(s.usable, s.selectable);
    assert.equal(menu.run.usable, true);
    assert.equal(menu.read.usable, true);
    assert.ok(menu.lantern.grades.every((g) => g.usable === g.selectable));
  });

  it('DialRules: the per-dial table is exposed and any rule can be overridden (Read costing the turn on Drift, bands on Flux, no Run)', () => {
    assert.equal(DIAL_RULES.freefall.readCostsTurn, true);
    assert.equal(DIAL_RULES.drift.captureDisplay, 'exact');
    assert.equal(DIAL_RULES.freefall.wardBadge, 'after-block');
    const me = mk('tossup', 20, ['tap']);
    const wild = mk('prismoth', 20, ['settle']);
    const bt = duel(me, wild, { kind: 'wild', dial: 'drift', foeAi: fixedFoe() });
    assert.equal(bt.state().rules.readCostsTurn, false);
    const bt2 = createBattle({ sides: [{ party: [mk('tossup', 20, ['tap'])] }, { party: [mk('prismoth', 20, ['settle'])] }], kind: 'wild', dial: 'drift', rng: constRng(0.5), foeAi: fixedFoe(), rules: { readCostsTurn: true, captureDisplay: 'bands', wardBadge: 'after-block', runAllowed: false } });
    const menu = bt2.availableActions(0);
    assert.equal(menu.read.costsTurn, true);
    assert.equal(menu.lantern.exactOdds, false);
    assert.equal(menu.run.available, false);
    assert.equal(bt2.state().sides[1].wardBadge, false);
    assert.throws(() => bt2.read(0), (e) => e.code === 'READ_COSTS_TURN');
    assert.throws(() => bt2.submit([{ type: 'run' }]), (e) => e.code === 'NO_RUN');
    const evs = bt2.submit([{ type: 'read' }]);
    assert.ok(ofType(evs, 'read').some((e) => e.side === 0));
    assert.equal(bt2.turn, 1);
  });

  it('holdOut: the opening scene ends as a "holdout" after N turns with no blackout and no EXP from a standing foe', () => {
    const me = mk('sloshkin', 5, ['tap']);
    const cal = mk('caldermaw', 5, ['settle']);
    const bt = duel(me, cal, { glint: 1000, foeAi: fixedFoe(), holdOut: 3 });
    bt.submit([{ type: 'move', move: 0 }]);
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'choose');
    const evs = bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'ended');
    assert.equal(bt.result().outcome, 'holdout');
    assert.equal(bt.result().winner, null);
    assert.equal(bt.result().blackoutCost, 0);
    assert.deepEqual(bt.result().exp, []);
    assert.ok(evs.some((e) => e.type === 'end' && e.outcome === 'holdout'));
    assert.throws(() => duel(me, cal, { holdOut: 0 }), RangeError);
  });

  it('nextUid: a caught creature takes the uid the game allocated', () => {
    const me = mk('sloshkin', 20, ['tap']);
    const wild = mk('tossup', 5, ['tap']);
    const bt = createBattle({ sides: [{ party: [me] }, { party: [wild] }], kind: 'wild', dial: 'flux', rng: constRng(0.001), foeAi: fixedFoe(), nextUid: 'c17' });
    bt.submit([{ type: 'lantern', grade: 3 }]);
    assert.equal(bt.outcome, 'capture');
    assert.equal(bt.result().caught.uid, 'c17');
    assert.equal(bt.result().caught.wild, false);
  });

  it('read() after the battle ended is refused like submit()', () => {
    const me = mk('caldermaw', 60, ['kiln-maw']);
    const bt = duel(me, mk('tossup', 5, ['tap']), { dial: 'drift', foeAi: fixedFoe() });
    bt.submit([{ type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'ended');
    assert.throws(() => bt.read(0), (e) => e.code === 'ENDED');
  });
});

// ---------------------------------------------------------------------------
// 2,000 random battles
// ---------------------------------------------------------------------------
describe('2,000 simulated battles (rules 20: any hang or soft-lock fails the build)', () => {
  const report = simulate({ n: 2000, seed: 'verify-2000' });

  it('zero invariant violations, every battle ends, none reaches the turn cap', () => {
    assert.equal(report.n, 2000);
    assert.deepEqual(report.violations, [], report.violations.slice(0, 10).join('\n'));
    assert.equal(report.outcomes.draw || 0, 0);
    assert.ok(report.longest < MAX_TURNS, `longest ${report.longest}`);
    assert.equal(Object.values(report.outcomes).reduce((a, b) => a + b, 0), 2000);
  });

  it('covers every outcome and the rule-bearing events', () => {
    for (const o of ['win', 'loss', 'capture']) assert.ok(report.outcomes[o] > 20, o);
    for (const t of ['ward-readout', 'scrap-cost', 'mend-spent', 'mend-cancelled', 'decoy-pop', 'glint', 'capture-fail', 'ward-suppressed', 'blackout', 'payout', 'levelup']) {
      assert.ok(report.eventTypes.includes(t), `no ${t} event`);
    }
  });

  it('the AI never picks an illegal action across 400 drained random states on every dial', () => {
    const rng = makeRng('legal-fuzz');
    for (let i = 0; i < 400; i++) {
      const kind = rng.pick(['wild', 'trainer']);
      const player = randomParty(rng.fork(`p${i}`), { size: rng.int(1, 3) });
      const foe = randomParty(rng.fork(`f${i}`), { size: kind === 'wild' ? 1 : rng.int(1, 3) });
      for (const c of [...player, ...foe]) for (const m of c.moves) if (rng.chance(0.6)) m.pp = 0;
      const bt = createBattle({ sides: [{ party: player, bag: { crackdust: rng.int(0, 1) } }, kind === 'wild' ? { party: foe } : { party: foe, trainer: { name: 'T' } }], kind, dial: rng.pick(['drift', 'flux', 'freefall']), rng: rng.fork(`b${i}`), captureStance: rng.chance(0.5) });
      for (let t = 0; t < 6 && bt.phase !== 'ended'; t++) {
        const sides = bt.phase === 'replace' ? bt.pendingReplace : [0, 1];
        const acts = [];
        for (const s of sides) {
          const a = chooseAction(bt, s);
          assert.ok(isLegal(bt, s, a), `state ${i} turn ${t} side ${s}: ${JSON.stringify(a)}`);
          acts[s] = a;
        }
        bt.submit(acts);
      }
    }
  });

  it('a single seed replays to the identical event log, and intro events include the opening send-ins', () => {
    const a = simulateBattle({ seed: 'verify-replay' });
    const b = simulateBattle({ seed: 'verify-replay' });
    assert.equal(JSON.stringify(a.events), JSON.stringify(b.events));
    assert.ok(a.events[0].type === 'message');
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------
describe('purity', () => {
  it('no battle module touches the DOM, the clock or Math.random', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const url = await import('node:url');
    const dir = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
    for (const f of ['engine.js', 'creature.js', 'species.js', 'moves.js', 'abilities.js', 'types.js', 'ai.js', 'sim.js']) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const bad of ['document.', 'window.', 'Math.random', 'Date.now', 'performance.now', 'setTimeout', 'requestAnimationFrame']) {
        assert.ok(!src.includes(bad), `${f} uses ${bad}`);
      }
    }
    assert.ok(getAbility('prism-ward').ward && getSpecies('prismoth').flags.hpMultiplier === 0.25);
  });
});

// js/battle/creatureOps.js: the in-battle creature pieces (stats formula, faint/HP ratio,
// learnMove, gainExp with level-ups, growth curves). The stat/EXP/learn tests are ported from
// proto/battle/test/creature.test.mjs; building, Shifting and (de)serializing creatures belong to
// systems/creature.js (RULES-CREATURE) and are tested there.
// Run: node --test test/battle.creatureOps.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStats, gainExp, learnMove, recomputeStats, isFainted, hpRatio, moveSlot, expForLevel, levelFromExp, GROWTH_CURVES, STAT_KEYS, DEFAULTS,
} from '../js/battle/creatureOps.js';
import { createBattleData } from '../js/battle/data.js';
import { makeCreature, DATA, getSpecies } from './fixtures/battle/helpers.mjs';
import { computeStats as protoComputeStats, gainExp as protoGainExp } from '../proto/battle/creature.js';
import { expForLevel as protoExpForLevel } from '../proto/battle/species.js';

const V = createBattleData(DATA);
const ZERO = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

describe('stats', () => {
  it('computes stats from base + level with the documented formula', () => {
    // Sloshkin base hp 60 / atk 62 at Lv50: hp = floor(120*50/100) + 50 + 10 = 120; atk = floor(124*50/100) + 5 = 67
    const s = computeStats(getSpecies('sloshkin').base, 50, ZERO);
    assert.equal(s.hp, 120);
    assert.equal(s.atk, 67);
    for (const k of STAT_KEYS) assert.ok(Number.isInteger(s[k]) && s[k] > 0, k);
    assert.deepEqual(makeCreature({ speciesId: 'sloshkin', level: 50 }).stats, s, 'agrees with the creature builder');
  });

  it('trained points raise stats (up to +63 at Lv100); missing trained keys count as 0', () => {
    const base = getSpecies('tossup').base;
    assert.equal(computeStats(base, 100, { atk: 252 }).atk - computeStats(base, 100, ZERO).atk, 63);
    assert.deepEqual(computeStats(base, 100), computeStats(base, 100, ZERO));
  });

  it('a quartered-HP form has a quarter of the normal max HP, never below 1', () => {
    const base = getSpecies('prismoth').base;
    const normal = computeStats(base, 20, ZERO, 1).hp;
    assert.equal(computeStats(base, 20, ZERO, 0.25).hp, Math.max(1, Math.floor(normal * 0.25)));
    assert.equal(computeStats({ ...base, hp: 1 }, 1, ZERO, 0.001).hp, 1);
  });

  it('matches the prototype formula for every species at several levels', () => {
    for (const s of V.speciesList()) for (const lv of [1, 7, 33, 100]) assert.deepEqual(computeStats(s.base, lv, ZERO, s.flags.hpMultiplier || 1), protoComputeStats(s.base, lv, ZERO, s.flags.hpMultiplier || 1), `${s.id} ${lv}`);
  });

  it('recomputeStats keeps the HP ratio, and keeps a fainted creature fainted', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 20 });
    c.hp = Math.floor(c.stats.hp / 2);
    const ratio = hpRatio(c);
    c.level = 40;
    recomputeStats(c, V);
    assert.deepEqual(c.stats, computeStats(c.base, 40, c.trained));
    assert.ok(Math.abs(hpRatio(c) - ratio) < 0.02);
    c.hp = 0;
    c.level = 50;
    recomputeStats(c, V);
    assert.equal(c.hp, 0);
    assert.ok(isFainted(c));
  });

  it('isFainted / hpRatio edge cases', () => {
    assert.equal(isFainted({ hp: 0 }), true);
    assert.equal(isFainted({ hp: -3 }), true);
    assert.equal(isFainted({ hp: 1 }), false);
    assert.equal(hpRatio({ hp: 5, stats: { hp: 0 } }), 0, 'no division by zero');
    assert.equal(hpRatio({ hp: -5, stats: { hp: 10 } }), 0);
    assert.equal(hpRatio({ hp: 5, stats: { hp: 10 } }), 0.5);
  });
});

describe('EXP and levels', () => {
  it('gainExp levels up, recomputes stats and surfaces new moves', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 4, heartmark: null });
    const hpBefore = c.stats.hp;
    const r = gainExp(c, expForLevel('medium-slow', 6) - c.exp, V);
    assert.equal(r.from, 4);
    assert.equal(r.to, 6);
    assert.equal(c.level, 6);
    assert.ok(c.stats.hp > hpBefore);
    assert.ok(r.learned.includes('undertow'), 'learned at Lv5 on the way');
    assert.deepEqual(r.statsAfter, c.stats);
    assert.ok(r.statsBefore.hp < r.statsAfter.hp);
  });

  it('offers a move when the four slots are full and never passes the level cap', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 8, moves: ['tap', 'salt-spray', 'undertow', 'shell-rattle'], heartmark: null });
    const r = gainExp(c, expForLevel('medium-slow', 9) - c.exp, V);
    assert.deepEqual(r.offers, ['settle']);
    assert.equal(c.moves.length, 4);
    assert.equal(learnMove(c, 'settle', V, 0), true);
    assert.equal(c.moves[0].id, 'settle');
    const top = makeCreature({ speciesId: 'tossup', level: 100 });
    gainExp(top, 10 ** 9, V);
    assert.equal(top.level, 100);
    const capped = makeCreature({ speciesId: 'tossup', level: 10 });
    gainExp(capped, 10 ** 9, V, { tuning: { maxLevel: 50 } });
    assert.equal(capped.level, 50, 'tuning.maxLevel caps levelling');
  });

  it('zero or negative EXP changes nothing', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 10 });
    const before = JSON.stringify(c);
    assert.deepEqual(gainExp(c, 0, V).learned, []);
    gainExp(c, -500, V);
    assert.equal(JSON.stringify(c), before);
  });

  it('agrees with the prototype gainExp on level, moves and stats', () => {
    for (const [id, lv, amount] of [['sloshkin', 4, 900], ['scrapling', 12, 5000], ['vesperay', 30, 200000], ['tossup', 1, 50]]) {
      const a = makeCreature({ speciesId: id, level: lv, heartmark: null, uid: 'x' });
      const b = makeCreature({ speciesId: id, level: lv, heartmark: null, uid: 'x' });
      const ra = gainExp(a, amount, V);
      const rb = protoGainExp(b, amount);
      assert.deepEqual(ra, rb, id);
      assert.deepEqual(a, b, id);
    }
  });

  it('learnMove refuses duplicates, a full slot list without an index, a bad index and the Heartmark slot', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 30 });
    const i = c.moves.findIndex((m) => m.id === 'undertow');
    assert.equal(learnMove(c, 'reap', V, i), false, 'Heartmark slot');
    assert.equal(learnMove(c, c.moves[0].id, V, 1), false, 'duplicate');
    assert.equal(learnMove(c, 'reap', V), false, 'full, no index');
    assert.equal(learnMove(c, 'reap', V, 9), false, 'bad index');
    assert.throws(() => learnMove(c, 'not-a-move', V, 1), RangeError);
    const small = makeCreature({ speciesId: 'tossup', level: 5, moves: ['tap'] });
    assert.equal(learnMove(small, 'reap', V), true);
    assert.deepEqual(small.moves[1], moveSlot(V, 'reap'));
    const three = makeCreature({ speciesId: 'tossup', level: 5, moves: ['tap'] });
    assert.equal(learnMove(three, 'reap', V, undefined, { tuning: { moveSlots: 1 } }), false, 'tuning.moveSlots');
  });

  it('moveSlot gives full PP, and 0/0 for a never-running-out move', () => {
    assert.deepEqual(moveSlot(V, 'tap'), { id: 'tap', pp: 35, maxPp: 35 });
    assert.deepEqual(moveSlot(V, 'scrap'), { id: 'scrap', pp: 0, maxPp: 0 });
  });
});

describe('growth curves', () => {
  it('are monotonic, start at 0, round-trip through levelFromExp and match the prototype', () => {
    for (const g of Object.keys(GROWTH_CURVES)) {
      let prev = -1;
      for (let lv = 1; lv <= 100; lv++) {
        const e = expForLevel(g, lv);
        assert.ok(e > prev, `${g} ${lv}`);
        prev = e;
        assert.equal(e, protoExpForLevel(g, lv));
        assert.equal(levelFromExp(g, e), lv);
      }
      assert.equal(expForLevel(g, 1), 0);
      assert.equal(expForLevel(g, 0), 0, 'clamped below 1');
      assert.equal(expForLevel(g, 500), expForLevel(g, 100), 'clamped above the cap');
    }
    assert.throws(() => expForLevel('glacial', 5), RangeError);
    assert.equal(levelFromExp('fast', 10 ** 12, 40), 40);
  });

  it('data may supply its own curves', () => {
    const view = createBattleData({ ...DATA, expForLevel: (g, l) => l * 10, levelFromExp: (g, e) => Math.min(100, Math.max(1, Math.floor(e / 10))) });
    const c = makeCreature({ speciesId: 'tossup', level: 5 });
    c.exp = 50;
    const r = gainExp(c, 25, view);
    assert.equal(r.to, 7);
  });

  it('DEFAULTS is frozen and holds the prototype values', () => {
    assert.ok(Object.isFrozen(DEFAULTS));
    assert.deepEqual({ ...DEFAULTS }, { mendsPerBattle: 3, maxLevel: 100, moveSlots: 4 });
  });
});

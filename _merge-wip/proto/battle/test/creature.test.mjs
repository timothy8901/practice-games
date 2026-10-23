// Creature instances: stats, PP, status, Mends, Bond, Heartmark, Shiftlog,
// Shift recompute with the per-stat floor, EXP, (de)serialization.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../../js/core/rng.js';
import {
  makeCreature, computeStats, shiftTo, gainExp, serialize, deserialize, healFull, restorePp, learnMove, relearnFromMemory,
  currentTypes, expToNext, hpRatio, isFainted, recomputeStats, STAT_KEYS, MENDS_PER_BATTLE, MAX_BOND, MOVE_SLOTS, STAT_FLOOR,
} from '../creature.js';
import { getSpecies, expForLevel, baseTotal } from '../species.js';
import { getMove } from '../moves.js';

describe('makeCreature', () => {
  it('computes stats from base + level with the documented formula', () => {
    // Sloshkin base hp 60 / atk 62 at Lv50, no trained points:
    // hp = floor(120*50/100) + 50 + 10 = 120; atk = floor(124*50/100) + 5 = 67
    const c = makeCreature({ speciesId: 'sloshkin', level: 50 });
    assert.equal(c.stats.hp, 120);
    assert.equal(c.stats.atk, 67);
    assert.equal(c.hp, c.stats.hp);
    assert.deepEqual(computeStats(getSpecies('sloshkin').base, 50, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }), c.stats);
    for (const k of STAT_KEYS) assert.ok(Number.isInteger(c.stats[k]) && c.stats[k] > 0, k);
  });

  it('trained points raise stats (up to +63 at Lv100)', () => {
    const plain = makeCreature({ speciesId: 'tossup', level: 100 });
    const trained = makeCreature({ speciesId: 'tossup', level: 100, trained: { atk: 252 } });
    assert.equal(trained.stats.atk - plain.stats.atk, 63);
    assert.equal(trained.stats.def, plain.stats.def);
  });

  it('Prismoth has a quarter of the normal max HP for its level', () => {
    const p = makeCreature({ speciesId: 'prismoth', level: 20 });
    const normal = computeStats(getSpecies('prismoth').base, 20, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }, 1).hp;
    assert.equal(p.stats.hp, Math.max(1, Math.floor(normal * 0.25)));
    assert.ok(p.stats.hp < normal / 3);
  });

  it('gives move slots with full PP, status null, 3 Mends, clamped Bond, a one-entry Shiftlog', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 20, bond: 9 });
    assert.ok(c.moves.length >= 1 && c.moves.length <= MOVE_SLOTS);
    for (const m of c.moves) {
      assert.equal(m.pp, getMove(m.id).pp);
      assert.equal(m.maxPp, getMove(m.id).pp);
    }
    assert.equal(c.status, null);
    assert.equal(c.mends, MENDS_PER_BATTLE);
    assert.equal(c.mends, 3);
    assert.equal(c.bond, MAX_BOND);
    assert.equal(makeCreature({ speciesId: 'sloshkin', bond: -3 }).bond, 0);
    assert.deepEqual(c.shiftlog, ['sloshkin']);
    assert.equal(c.shiftCount, 0);
    assert.equal(c.heldItem, null);
    assert.equal(c.wild, false);
    assert.equal(makeCreature({ speciesId: 'sloshkin', wild: true }).wild, true);
    assert.equal(c.exp, expForLevel('medium-slow', 20));
  });

  it('pins the species Heartmark technique into a slot and keeps its same-type bonus', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 40 });
    assert.equal(c.heartmark, 'undertow');
    assert.ok(c.moves.some((m) => m.id === 'undertow'));
    assert.equal(c.heartmarkStab, true);
    const t = makeCreature({ speciesId: 'tossup', level: 40 });
    assert.equal(t.heartmark, null, 'Blank Slate: chosen at the first Shift');
    const explicit = makeCreature({ speciesId: 'sloshkin', level: 40, moves: ['tap', 'salt-spray', 'settle', 'riptide'] });
    assert.ok(explicit.moves.some((m) => m.id === 'undertow'), 'the Heartmark technique displaces a slot');
    assert.equal(explicit.moves.length, 4);
  });

  it('default moves are the latest learnset moves at that level', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 5, heartmark: null });
    assert.deepEqual(c.moves.map((m) => m.id), ['tap', 'salt-spray', 'undertow']);
    const c1 = makeCreature({ speciesId: 'sloshkin', level: 1, heartmark: null });
    assert.deepEqual(c1.moves.map((m) => m.id), ['tap', 'salt-spray']);
  });

  it('takes an explicit uid, draws one from the rng, or falls back to a counter (never two zeros)', () => {
    assert.equal(makeCreature({ speciesId: 'tossup', uid: 'c17' }).uid, 'c17');
    const a = makeCreature({ speciesId: 'tossup', rng: makeRng('a') });
    const b = makeCreature({ speciesId: 'tossup', rng: makeRng('a') });
    assert.equal(a.uid, b.uid, 'same rng seed, same uid');
    assert.ok(a.uid > 0);
    const x = makeCreature({ speciesId: 'tossup' });
    const y = makeCreature({ speciesId: 'tossup' });
    assert.notEqual(x.uid, y.uid);
  });

  it('Vagary gets a posted Unfixed loop of Star + 3 seeded types, deterministic per rng', () => {
    const v1 = makeCreature({ speciesId: 'vagary', level: 50, rng: makeRng('comet') });
    const v2 = makeCreature({ speciesId: 'vagary', level: 50, rng: makeRng('comet') });
    assert.deepEqual(v1.typeQueue, v2.typeQueue);
    assert.equal(v1.typeQueue.length, 4);
    assert.equal(v1.typeQueue[0], 'Star');
    assert.equal(new Set(v1.typeQueue).size, 4, 'no repeats');
    assert.deepEqual(currentTypes(v1), ['Star']);
    assert.equal(makeCreature({ speciesId: 'sloshkin' }).typeQueue, null);
  });

  it('clamps level to 1..100 and rejects unknown species', () => {
    assert.equal(makeCreature({ speciesId: 'tossup', level: 0 }).level, 1);
    assert.equal(makeCreature({ speciesId: 'tossup', level: 250 }).level, 100);
    assert.throws(() => makeCreature({ speciesId: 'mudkip' }), RangeError);
  });
});

describe('shiftTo (Shift recompute with the per-stat floor)', () => {
  function sloshkin(level = 34) {
    return makeCreature({ speciesId: 'sloshkin', level, nickname: 'PUDDLE', bond: 3, heldItem: 'still-knot', trained: { atk: 40 } });
  }

  it('never touches level, EXP, held item, nickname, Bond, trained points or the Heartmark technique', () => {
    const c = sloshkin();
    const before = { level: c.level, exp: c.exp, heldItem: c.heldItem, nickname: c.nickname, bond: c.bond, trained: { ...c.trained }, heartmark: c.heartmark };
    shiftTo(c, 'siltback', 'flux');
    assert.equal(c.level, before.level);
    assert.equal(c.exp, before.exp);
    assert.equal(c.heldItem, before.heldItem);
    assert.equal(c.nickname, before.nickname);
    assert.equal(c.bond, before.bond);
    assert.deepEqual(c.trained, before.trained);
    assert.equal(c.heartmark, before.heartmark);
    assert.ok(c.moves.some((m) => m.id === 'undertow'), 'Undertow stays in every form');
    assert.equal(c.speciesId, 'siltback');
    assert.deepEqual(c.types, ['Brine', 'Stone']);
    assert.equal(c.ability, 'tidecall', 'the ability follows the form');
    assert.deepEqual(c.shiftlog, ['sloshkin', 'siltback']);
    assert.equal(c.shiftCount, 1);
  });

  it('Up to Siltback is the Forecast mockup +55 total; the floor is per stat, so Drift still lifts its lower Speed', () => {
    const ff = sloshkin();
    const r = shiftTo(ff, 'siltback', 'freefall');
    assert.equal(r.statDelta, 55);
    assert.deepEqual(r.floored, []);
    assert.deepEqual(ff.base, getSpecies('siltback').base);
    // Sloshkin spe 38 -> Siltback spe 30 is a 21% drop: Drift (10%) floors it at ceil(34.2) = 35, Flux (20%) at ceil(30.4) = 31.
    const dr = sloshkin();
    assert.deepEqual(shiftTo(dr, 'siltback', 'drift').floored, ['spe']);
    assert.equal(dr.base.spe, 35);
    const fx = sloshkin();
    assert.deepEqual(shiftTo(fx, 'siltback', 'flux').floored, ['spe']);
    assert.equal(fx.base.spe, 31);
  });

  it('Down to Puddlepip: Drift floors every base stat at -10%, Flux at -20%, Freefall has no floor', () => {
    const from = getSpecies('sloshkin').base;
    const to = getSpecies('puddlepip').base;
    for (const [dial, floor] of [['drift', 0.1], ['flux', 0.2]]) {
      const c = sloshkin();
      const r = shiftTo(c, 'puddlepip', dial);
      for (const k of STAT_KEYS) {
        const min = Math.ceil(from[k] * (1 - floor));
        assert.ok(c.base[k] >= min, `${dial} ${k}: ${c.base[k]} >= ${min}`);
        assert.equal(c.base[k], Math.max(to[k], min), `${dial} ${k}`);
        if (to[k] < min) assert.ok(r.floored.includes(k), `${dial} ${k} floored`);
      }
      assert.ok(r.statDelta < 0 && r.statDelta >= -40, `${dial} never drops more than the raw -40 (${r.statDelta})`);
      if (dial === 'drift') assert.ok(r.floored.length > 0 && r.statDelta > -40, 'Drift softens the -40 drop');
    }
    const ff = sloshkin();
    const r = shiftTo(ff, 'puddlepip', 'freefall');
    assert.deepEqual(ff.base, to);
    assert.deepEqual(r.floored, []);
    assert.equal(r.statDelta, baseTotal(getSpecies('puddlepip')) - baseTotal(getSpecies('sloshkin')));
    assert.equal(r.statDelta, -40, 'Forecast mockup: Puddlepip -40');
    assert.deepEqual(STAT_FLOOR, { drift: 0.1, flux: 0.2, freefall: null });
  });

  it('recomputes stats at the kept level and keeps the HP ratio', () => {
    const c = sloshkin(40);
    c.hp = Math.floor(c.stats.hp / 2);
    const ratio = hpRatio(c);
    shiftTo(c, 'bogmonarch', 'flux');
    assert.equal(c.level, 40);
    assert.deepEqual(c.stats, computeStats(c.base, 40, c.trained));
    assert.ok(Math.abs(hpRatio(c) - ratio) < 0.02);
    assert.ok(c.stats.hp > 100);
  });

  it('moves the new form cannot learn go to Memory; the Heartmark technique always stays', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 30, moves: ['undertow', 'salt-spray', 'riptide', 'tidal-mend'] });
    const r = shiftTo(c, 'mudfist', 'flux'); // Mudfist (Grit) learns none of these
    assert.deepEqual(r.kept, ['undertow']);
    assert.deepEqual(r.toMemory.sort(), ['riptide', 'salt-spray', 'tidal-mend']);
    assert.deepEqual(c.memory.sort(), ['riptide', 'salt-spray', 'tidal-mend']);
    assert.deepEqual(c.moves.map((m) => m.id), ['undertow']);
    assert.equal(c.heartmarkStab, true, 'keeps its same-type bonus in a Grit body (Proposed)');
    // Relearn is free once a later form can use the move.
    assert.equal(relearnFromMemory(c, 'riptide'), false, 'Mudfist cannot use Riptide');
    shiftTo(c, 'siltback', 'flux');
    assert.equal(relearnFromMemory(c, 'riptide'), true);
    assert.ok(c.moves.some((m) => m.id === 'riptide'));
    assert.ok(!c.memory.includes('riptide'));
  });

  it('Blank Slate: Tossup pins any one of its techniques at the first Shift', () => {
    const t = makeCreature({ speciesId: 'tossup', level: 20, moves: ['sure-pinch', 'tap', 'settle'] });
    assert.throws(() => shiftTo(t, 'mudfist', 'flux', { heartmark: 'riptide' }), /current moves/);
    shiftTo(t, 'mudfist', 'flux', { heartmark: 'sure-pinch' });
    assert.equal(t.heartmark, 'sure-pinch');
    assert.ok(t.moves.some((m) => m.id === 'sure-pinch'));
    assert.equal(t.heartmarkStab, true, 'Plain move pinned in a Plain body');
  });

  it('Stillox and Vagary never Shift; unknown dials are rejected', () => {
    assert.throws(() => shiftTo(makeCreature({ speciesId: 'stillox' }), 'tossup', 'flux'), /never Shifts/);
    assert.throws(() => shiftTo(makeCreature({ speciesId: 'vagary' }), 'tossup', 'flux'), /never Shifts/);
    assert.throws(() => shiftTo(makeCreature({ speciesId: 'sloshkin' }), 'siltback', 'chaos'), RangeError);
  });
});

describe('EXP and levels', () => {
  it('gainExp levels up, recomputes stats and surfaces new moves', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 4, heartmark: null });
    const hpBefore = c.stats.hp;
    const r = gainExp(c, expForLevel('medium-slow', 6) - c.exp);
    assert.equal(r.from, 4);
    assert.equal(r.to, 6);
    assert.equal(c.level, 6);
    assert.ok(c.stats.hp > hpBefore);
    assert.ok(r.learned.includes('undertow'), 'learned at Lv5 on the way');
    assert.equal(expToNext(c), expForLevel('medium-slow', 7) - c.exp);
  });

  it('offers a move when the four slots are full and never passes Lv100', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 8, moves: ['tap', 'salt-spray', 'undertow', 'shell-rattle'], heartmark: null });
    const r = gainExp(c, expForLevel('medium-slow', 9) - c.exp);
    assert.deepEqual(r.offers, ['settle']);
    assert.equal(c.moves.length, 4);
    assert.equal(learnMove(c, 'settle', 0), true);
    assert.equal(c.moves[0].id, 'settle');
    const top = makeCreature({ speciesId: 'tossup', level: 100 });
    gainExp(top, 10 ** 9);
    assert.equal(top.level, 100);
    assert.equal(expToNext(top), 0);
  });

  it('learnMove refuses to overwrite the Heartmark slot', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 30 });
    const i = c.moves.findIndex((m) => m.id === 'undertow');
    assert.equal(learnMove(c, 'reap', i), false);
  });
});

describe('restore helpers', () => {
  it('healFull restores HP, PP, status and Mends; restorePp is an Ether', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 20 });
    c.hp = 0;
    c.status = { kind: 'burn', turns: 0 };
    c.mends = 0;
    for (const m of c.moves) m.pp = 0;
    assert.ok(isFainted(c));
    restorePp(c, 0, 10);
    assert.equal(c.moves[0].pp, Math.min(10, c.moves[0].maxPp));
    assert.equal(c.moves[1].pp, 0);
    restorePp(c, null, 99);
    for (const m of c.moves) assert.equal(m.pp, m.maxPp);
    for (const m of c.moves) m.pp = 0;
    healFull(c);
    assert.equal(c.hp, c.stats.hp);
    assert.equal(c.status, null);
    assert.equal(c.mends, 3);
    for (const m of c.moves) assert.equal(m.pp, m.maxPp);
  });

  it('recomputeStats keeps a fainted creature fainted', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 20 });
    c.hp = 0;
    c.level = 30;
    recomputeStats(c);
    assert.equal(c.hp, 0);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips every field through JSON', () => {
    const c = makeCreature({ speciesId: 'vagary', level: 44, rng: makeRng('save'), nickname: 'COMET', bond: 2, heldItem: 'skyglass', trained: { spe: 12 } });
    c.hp = 17;
    c.moves[0].pp = 3;
    c.status = { kind: 'poison', turns: 0 };
    c.mends = 1;
    c.memory.push('tap');
    const data = serialize(c);
    assert.equal(data.v, 1);
    const json = JSON.stringify(data);
    const back = deserialize(JSON.parse(json));
    assert.deepEqual(back, c);
    assert.deepEqual(serialize(back), data);
  });

  it('survives a Shifted creature and recomputes stats from base + level', () => {
    const c = makeCreature({ speciesId: 'sloshkin', level: 36, nickname: 'PUDDLE' });
    shiftTo(c, 'puddlepip', 'drift');
    const data = serialize(c);
    data.stats = { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 }; // stale save
    const back = deserialize(data);
    assert.deepEqual(back.stats, c.stats, 'stats self-heal from base + level');
    assert.deepEqual(back.base, c.base, 'floor-adjusted base survives');
    assert.deepEqual(back.shiftlog, ['sloshkin', 'puddlepip']);
    assert.equal(back.heartmark, 'undertow');
  });

  it('rejects anything but a v1 snapshot and clamps HP / PP into range', () => {
    assert.throws(() => deserialize({}), TypeError);
    assert.throws(() => deserialize(null), TypeError);
    const c = makeCreature({ speciesId: 'tossup', level: 10 });
    const data = serialize(c);
    data.hp = 10 ** 6;
    data.moves[0].pp = 99;
    const back = deserialize(data);
    assert.equal(back.hp, back.stats.hp);
    assert.equal(back.moves[0].pp, back.moves[0].maxPp);
    assert.equal(deserialize({ ...serialize(makeCreature({ speciesId: 'tossup', uid: 'c9' })) }).uid, 'c9');
  });
});

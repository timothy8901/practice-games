// Unit tests for js/systems/creature.js. Run: node --test test/systems.creature.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/systems/creature.js';
import { creatureDefaults, validateWorld, STAT_KEYS } from '../js/state/schema.js';
import * as proto from '../proto/battle/creature.js';
import { expForLevel as protoExpForLevel, SPECIES_LIST } from '../proto/battle/species.js';
import { DATA, REG, mk, world, makeRng, SPECIES } from './fixtures/rules-creature.fixture.mjs';

const KEYS = Object.keys(creatureDefaults()).sort();
const ROSTER = SPECIES_LIST.map((s) => s.id);

describe('DEFAULTS and tuning', () => {
  it('DEFAULTS are deep-frozen and list every key in TUNING_KEYS', () => {
    assert.ok(Object.isFrozen(C.DEFAULTS));
    assert.ok(Object.isFrozen(C.DEFAULTS.STAT_FLOOR));
    assert.ok(Object.isFrozen(C.DEFAULTS.MARK_SPREAD));
    assert.deepEqual([...C.TUNING_KEYS].sort(), Object.keys(C.DEFAULTS).sort());
    assert.deepEqual(C.DEFAULTS.STAT_FLOOR, { drift: 0.1, flux: 0.2, freefall: null });
    assert.equal(C.DEFAULTS.MENDS_PER_BATTLE, 3);
    assert.equal(C.DEFAULTS.MAX_BOND, 5);
  });

  it('tuningOf merges overrides, caches frozen overrides by identity, ignores foreign keys and rejects bad values', () => {
    const tun = Object.freeze({ MENDS_PER_BATTLE: 2, SOMETHING_ELSE: 1 });
    const t = C.tuningOf(tun);
    assert.equal(t.MENDS_PER_BATTLE, 2);
    assert.equal(t.MAX_BOND, 5);
    assert.equal(C.tuningOf(tun), t);
    const mutable = { MENDS_PER_BATTLE: 2 };
    assert.equal(C.tuningOf(mutable).MENDS_PER_BATTLE, 2);
    mutable.MENDS_PER_BATTLE = 1;
    assert.equal(C.tuningOf(mutable).MENDS_PER_BATTLE, 1, 'a mutable override is never served stale');
    assert.equal(C.tuningOf(null), C.DEFAULTS);
    assert.throws(() => C.tuningOf({ MOVE_SLOTS: 5 }), TypeError, 'above the schema cap');
    assert.throws(() => C.tuningOf({ MAX_BOND: 6 }), TypeError);
    assert.throws(() => C.tuningOf({ STAT_FLOOR: { drift: 2 } }), TypeError);
    assert.throws(() => C.tuningOf({ MARK_SPREAD: { x: -1, y: 0 } }), TypeError);
    assert.throws(() => C.tuningOf(3), TypeError);
  });
});

describe('makeCreature', () => {
  it('builds exactly the World Creature keys and passes validateWorld (with and without a registry)', () => {
    const c = mk('c1', 'sloshkin', 12);
    assert.deepEqual(Object.keys(c).sort(), KEYS);
    const w = world();
    w.party.push(c, mk('c2', 'vagary', 40), mk('c3', 'prismoth', 7));
    assert.deepEqual(validateWorld(w), []);
    assert.deepEqual(validateWorld(w, REG), []);
    assert.equal(c.familyId, 'sloshkin');
    assert.deepEqual(c.shiftlog, ['sloshkin']);
    assert.equal(c.hp, c.stats.hp);
    assert.equal(c.mends, 3);
  });

  it('requires a non-empty string uid and never generates one', () => {
    assert.throws(() => C.makeCreature({ speciesId: 'sloshkin' }, DATA), TypeError);
    assert.throws(() => C.makeCreature({ uid: '', speciesId: 'sloshkin' }, DATA), TypeError);
    assert.throws(() => C.makeCreature({ uid: 7, speciesId: 'sloshkin' }, DATA), TypeError);
    assert.throws(() => C.makeCreature(null, DATA), TypeError);
  });

  it('throws a RangeError for unknown species and moves', () => {
    assert.throws(() => C.makeCreature({ uid: 'c1', speciesId: 'nope' }, DATA), RangeError);
    assert.throws(() => C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', moves: ['nope'] }, DATA), RangeError);
    assert.throws(() => C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', heartmark: 'nope' }, DATA), RangeError);
  });

  it('matches the prototype (stats, moves, Heartmark, EXP, no-rng Unfixed loop) for every species at several levels', () => {
    for (const id of ROSTER) {
      for (const level of [1, 5, 9, 23, 50, 100]) {
        const ours = C.makeCreature({ uid: 'c1', speciesId: id, level }, DATA);
        const theirs = proto.makeCreature({ uid: 1, speciesId: id, level });
        for (const k of ['speciesId', 'nickname', 'types', 'ability', 'level', 'exp', 'base', 'stats', 'hp', 'moves', 'heartmark', 'heartmarkStab', 'typeQueue', 'mends', 'bond'])
          assert.deepEqual(ours[k], theirs[k], `${id} Lv${level} ${k}`);
      }
    }
  });

  it('clamps level, bond and trained points; clamps an explicit EXP into the level band', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 250, bond: 9, trained: { atk: 999, def: -4, spe: 10.7 } }, DATA);
    assert.equal(c.level, 100);
    assert.equal(c.bond, 5);
    assert.deepEqual(c.trained, { hp: 0, atk: 252, def: 0, spa: 0, spd: 0, spe: 10 });
    const low = C.makeCreature({ uid: 'c2', speciesId: 'sloshkin', level: 0 }, DATA);
    assert.equal(low.level, 1);
    const lo = protoExpForLevel('medium-slow', 20);
    const hi = protoExpForLevel('medium-slow', 21) - 1;
    assert.equal(C.makeCreature({ uid: 'c3', speciesId: 'sloshkin', level: 20, exp: 0 }, DATA).exp, lo);
    assert.equal(C.makeCreature({ uid: 'c4', speciesId: 'sloshkin', level: 20, exp: 10 ** 9 }, DATA).exp, hi);
    assert.equal(C.makeCreature({ uid: 'c5', speciesId: 'sloshkin', level: 20, exp: lo + 3 }, DATA).exp, lo + 3);
  });

  it('pins the Heartmark technique into the moves; explicit moves are de-duplicated and capped', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 40, moves: ['tap', 'tap', 'settle', 'riptide', 'shellguard', 'grind-down'] }, DATA);
    assert.equal(c.moves.length, 4);
    assert.equal(c.moves[0].id, 'undertow');
    assert.ok(!c.moves.some((m) => m.id === 'grind-down'));
    const none = C.makeCreature({ uid: 'c2', speciesId: 'sloshkin', level: 40, heartmark: null }, DATA);
    assert.equal(none.heartmark, null);
    assert.equal(none.heartmarkStab, false);
  });

  it('a held item with blocksShifts sets stillKnot', () => {
    assert.equal(C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', heldItem: 'fx-knot' }, DATA).stillKnot, true);
    assert.equal(C.makeCreature({ uid: 'c2', speciesId: 'sloshkin', heldItem: 'fx-charm' }, DATA).stillKnot, false);
    assert.equal(C.makeCreature({ uid: 'c3', speciesId: 'sloshkin', heldItem: 'unknown-item' }, DATA).stillKnot, false);
  });

  it('accepts a registry or plain tables with identical results', () => {
    for (const id of ['sloshkin', 'vagary', 'prismoth', 'tossup']) {
      const a = C.makeCreature({ uid: 'c1', speciesId: id, level: 30, rng: makeRng('same') }, DATA);
      const b = C.makeCreature({ uid: 'c1', speciesId: id, level: 30, rng: makeRng('same') }, REG);
      assert.deepEqual(a, b, id);
    }
  });
});

describe('Heartmark placement and the Unfixed loop (seeded)', () => {
  it('is deterministic per seed and uses all four lifetime body anchors', () => {
    const a = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', rng: makeRng('s1') }, DATA);
    const b = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', rng: makeRng('s1') }, DATA);
    assert.deepEqual(a.mark, b.mark);
    const marks = new Set();
    for (let i = 0; i < 200; i++) {
      const c = C.makeCreature({ uid: `c${i}`, speciesId: 'sloshkin', rng: makeRng(`seed-${i}`) }, DATA);
      assert.ok(Math.abs(c.mark.x) <= 2 && Math.abs(c.mark.y) <= 2);
      assert.ok(!Object.is(c.mark.x, -0) && !Object.is(c.mark.y, -0));
      marks.add(c.mark.anchor);
    }
    assert.equal(marks.size, 4, `only ${marks.size} distinct body anchors`);
  });

  it('draws from forks, so the caller\'s stream is not advanced', () => {
    const r1 = makeRng('caller');
    C.makeCreature({ uid: 'c1', speciesId: 'vagary', rng: r1 }, DATA);
    assert.equal(r1.next(), makeRng('caller').next());
  });

  it('keeps legacy explicit offsets and uses a stable body anchor without an rng', () => {
    const zero = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', rng: makeRng('x'), tuning: { MARK_SPREAD: { x: 0, y: 0 } } }, DATA);
    assert.equal(zero.mark.x, 0);
    assert.equal(zero.mark.y, 0);
    assert.ok(['head', 'chest', 'back', 'tail'].includes(zero.mark.anchor));
    assert.deepEqual(C.makeCreature({ uid: 'c2', speciesId: 'sloshkin' }, DATA).mark, C.drawBodyMark('c2'));
    assert.deepEqual(C.makeCreature({ uid: 'c3', speciesId: 'sloshkin', mark: { x: -3, y: 4 } }, DATA).mark, { x: -3, y: 4 });
    for (let i = 0; i < 50; i++) {
      const m = C.drawMark(makeRng(`w${i}`), { tuning: { MARK_SPREAD: { x: 5, y: 1 } } });
      assert.ok(Math.abs(m.x) <= 5 && Math.abs(m.y) <= 1);
    }
  });

  it('Unfixed loop: lead type then UNFIXED_PICKS distinct seeded types, deterministic per seed', () => {
    const a = C.makeCreature({ uid: 'c1', speciesId: 'vagary', rng: makeRng('loop') }, DATA);
    const b = C.makeCreature({ uid: 'c1', speciesId: 'vagary', rng: makeRng('loop') }, DATA);
    assert.deepEqual(a.typeQueue, b.typeQueue);
    assert.equal(a.typeQueue.length, 4);
    assert.equal(a.typeQueue[0], SPECIES.vagary.types[0]);
    assert.equal(new Set(a.typeQueue).size, 4);
    const seen = new Set();
    for (let i = 0; i < 30; i++) seen.add(C.makeCreature({ uid: 'c1', speciesId: 'vagary', rng: makeRng(`l${i}`) }, DATA).typeQueue.join());
    assert.ok(seen.size > 10);
    const two = C.makeCreature({ uid: 'c1', speciesId: 'vagary', rng: makeRng('loop'), tuning: { UNFIXED_PICKS: 1 } }, DATA);
    assert.equal(two.typeQueue.length, 2);
    assert.equal(C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', rng: makeRng('loop') }, DATA).typeQueue, null);
    assert.deepEqual(C.currentTypes(a), [a.typeQueue[0]]);
    assert.deepEqual(C.currentTypes(mk('c2', 'sloshkin', 5)), ['Brine']);
  });

  it('buildTypeQueue copes with an empty types table', () => {
    assert.deepEqual(C.buildTypeQueue(['Star'], [], null), ['Star']);
    assert.ok(C.isUnfixedAbility({ hook: 'unfixed' }));
    assert.ok(!C.isUnfixedAbility(null));
  });
});

describe('stats', () => {
  it('computeStats matches the prototype formula, including hpMultiplier', () => {
    for (const id of ROSTER) {
      const sp = SPECIES[id];
      for (const level of [1, 7, 33, 100]) {
        const trained = { hp: 252, atk: 100, def: 3, spa: 0, spd: 77, spe: 252 };
        assert.deepEqual(C.computeStats(sp.base, level, trained, sp.flags.hpMultiplier || 1), proto.computeStats(sp.base, level, trained, sp.flags.hpMultiplier || 1));
      }
    }
  });

  it('formula constants are tunable', () => {
    const base = SPECIES.sloshkin.base;
    const d = C.computeStats(base, 50, {});
    const t = C.computeStats(base, 50, {}, 1, { tuning: { HP_FLAT: 20, STAT_FLAT: 0 } });
    assert.equal(t.hp, d.hp + 10);
    assert.equal(t.atk, d.atk - 5);
  });

  it('recomputeStats keeps the HP ratio, keeps fainted at 0 and conscious at >= 1', () => {
    const c = mk('c1', 'sloshkin', 30);
    c.hp = Math.floor(c.stats.hp / 2);
    c.level = 60;
    C.recomputeStats(c, DATA);
    assert.ok(Math.abs(c.hp / c.stats.hp - 0.5) < 0.02);
    c.hp = 0;
    C.recomputeStats(c, DATA);
    assert.equal(c.hp, 0);
    c.hp = 1;
    c.level = 2;
    C.recomputeStats(c, DATA);
    assert.ok(c.hp >= 1);
    assert.equal(C.hpRatio({ hp: 5, stats: { hp: 0 } }), 0);
    assert.ok(C.isFainted({ hp: 0 }));
  });
});

describe('moves and Memory', () => {
  it('learnMove fills free slots, refuses duplicates, full sets without an index and the Heartmark slot', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 5, moves: ['tap'] }, DATA);
    assert.equal(c.moves.length, 2); // undertow pinned + tap
    assert.equal(C.learnMove(c, 'settle', DATA), true);
    assert.equal(C.learnMove(c, 'settle', DATA), false);
    assert.equal(C.learnMove(c, 'riptide', DATA), true);
    assert.equal(c.moves.length, 4);
    assert.equal(C.learnMove(c, 'shellguard', DATA), false);
    assert.equal(C.learnMove(c, 'shellguard', DATA, { replaceIndex: 9 }), false);
    const hm = c.moves.findIndex((m) => m.id === 'undertow');
    assert.equal(C.learnMove(c, 'shellguard', DATA, { replaceIndex: hm }), false);
    const other = c.moves.findIndex((m) => m.id === 'tap');
    assert.equal(C.learnMove(c, 'shellguard', DATA, { replaceIndex: other }), true);
    assert.equal(c.moves[other].id, 'shellguard');
    assert.equal(c.moves[other].pp, c.moves[other].maxPp);
    assert.throws(() => C.learnMove(c, 'nope', DATA), RangeError);
  });

  it('MOVE_SLOTS tuning caps slots', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 40, tuning: { MOVE_SLOTS: 2 } }, DATA);
    assert.equal(c.moves.length, 2);
    assert.equal(C.learnMove(c, 'tap', DATA, { tuning: { MOVE_SLOTS: 2 } }), false);
  });

  it('forgetMove refuses the Heartmark technique and the last move', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 5, moves: ['tap'] }, DATA);
    assert.equal(C.forgetMove(c, c.moves.findIndex((m) => m.id === 'undertow')), false);
    assert.equal(C.forgetMove(c, 7), false);
    assert.equal(C.forgetMove(c, c.moves.findIndex((m) => m.id === 'tap')), true);
    assert.equal(C.forgetMove(c, 0), false, 'last move');
  });

  it('relearnFromMemory only relearns moves the current form can learn', () => {
    const c = mk('c1', 'sloshkin', 30);
    c.memory = ['gale-cut', 'settle', 'settle'];
    c.moves = c.moves.filter((m) => m.id !== 'settle');
    assert.deepEqual(C.relearnable(c, DATA), ['settle']);
    assert.equal(C.relearnFromMemory(c, 'gale-cut', DATA), false);
    assert.equal(C.relearnFromMemory(c, 'nothing', DATA), false);
    assert.equal(c.moves.length, 4);
    assert.equal(C.relearnFromMemory(c, 'settle', DATA), false, 'slots full, no replacement index');
    const free = c.moves.findIndex((m) => m.id !== c.heartmark);
    assert.equal(C.relearnFromMemory(c, 'settle', DATA, { replaceIndex: free }), true);
    assert.ok(c.moves.some((m) => m.id === 'settle'));
    assert.deepEqual(c.memory, ['gale-cut', 'settle']);
  });

  it('pinHeartmarkTechnique pins a known move once (force overrides) and records STAB', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'tossup', level: 20 }, DATA);
    assert.equal(c.heartmark, null);
    assert.deepEqual(C.pinHeartmarkTechnique(c, 'riptide', DATA), { ok: false, reason: 'not-known' });
    const id = c.moves[0].id;
    assert.deepEqual(C.pinHeartmarkTechnique(c, id, DATA), { ok: true });
    assert.equal(c.heartmark, id);
    const other = c.moves[1].id;
    assert.deepEqual(C.pinHeartmarkTechnique(c, other, DATA), { ok: false, reason: 'already-pinned' });
    assert.deepEqual(C.pinHeartmarkTechnique(c, other, DATA, { force: true }), { ok: true });
    assert.equal(c.heartmarkStab, c.types.includes(DATA.moves[other].type));
  });

  it('defaultMoves falls back to FALLBACK_MOVE or the first learnset move when nothing is learnable', () => {
    const tiny = { ...DATA, species: { ...DATA.species, late: { ...SPECIES.sloshkin, id: 'late', learnset: [{ level: 30, move: 'riptide' }], heartmark: null } } };
    assert.deepEqual(C.defaultMoves('late', 5, null, tiny), ['riptide']);
    assert.deepEqual(C.defaultMoves('late', 5, null, tiny, { tuning: { FALLBACK_MOVE: 'tap' } }), ['tap']);
    const none = { ...DATA, species: { ...DATA.species, bare: { ...SPECIES.sloshkin, id: 'bare', learnset: [], heartmark: null } } };
    assert.deepEqual(C.makeCreature({ uid: 'c1', speciesId: 'bare' }, none).moves, []);
  });
});

describe('gainExp', () => {
  it('matches the prototype across a sequence of gains (levels, EXP, moves, stats, learned/offers)', () => {
    for (const id of ['sloshkin', 'tossup', 'scrapling', 'vesperay', 'wirewhisk']) {
      const ours = C.makeCreature({ uid: 'c1', speciesId: id, level: 3 }, DATA);
      const theirs = proto.makeCreature({ uid: 1, speciesId: id, level: 3 });
      for (const amount of [5, 40, 0, 300, 1234, 9000, 50000, 2e6]) {
        const a = C.gainExp(ours, amount, DATA);
        const b = proto.gainExp(theirs, amount);
        assert.deepEqual([a.from, a.to, a.learned, a.offers, a.statsAfter], [b.from, b.to, b.learned, b.offers, b.statsAfter], `${id} +${amount}`);
        assert.deepEqual(ours.moves, theirs.moves);
        assert.equal(ours.level, theirs.level);
        if (ours.level < 100) assert.equal(ours.exp, theirs.exp);
      }
    }
  });

  it('caps EXP at the MAX_LEVEL threshold, ignores negatives and rejects non-finite amounts', () => {
    const c = mk('c1', 'sloshkin', 99);
    const r = C.gainExp(c, 10 ** 9, DATA);
    assert.equal(c.level, 100);
    assert.equal(c.exp, protoExpForLevel('medium-slow', 100));
    assert.equal(C.gainExp(c, 500, DATA).gained, 0);
    assert.ok(r.gained > 0);
    assert.equal(C.expToNext(c, DATA), 0);
    const d = mk('c2', 'sloshkin', 10);
    const before = d.exp;
    assert.equal(C.gainExp(d, -50, DATA).gained, 0);
    assert.equal(d.exp, before);
    assert.throws(() => C.gainExp(d, NaN, DATA), TypeError);
    assert.throws(() => C.gainExp(d, Infinity, DATA), TypeError);
    assert.equal(C.expToNext(d, DATA), protoExpForLevel('medium-slow', 11) - before);
  });

  it('honours MAX_LEVEL and GROWTH_CURVES tuning from systems/exp', () => {
    const tuning = { MAX_LEVEL: 50, GROWTH_CURVES: { 'medium-slow': { num: [1, 0, 0, 0], den: 1 } } };
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 80, tuning }, DATA);
    assert.equal(c.level, 50);
    assert.equal(c.exp, 50 ** 3);
    const d = C.makeCreature({ uid: 'c2', speciesId: 'sloshkin', level: 10, tuning }, DATA);
    C.gainExp(d, 11 ** 3 - 10 ** 3, DATA, { tuning });
    assert.equal(d.level, 11);
  });

  it('never opens Shift windows (no window bookkeeping is touched in battle copies)', () => {
    const c = mk('c1', 'sloshkin', 8);
    C.gainExp(c, 10 ** 7, DATA);
    assert.equal(c.level, 100);
    assert.deepEqual(c.windowsUsed, []);
  });
});

describe('shiftTo', () => {
  const ratio = (num, den, v) => Math.ceil((v * num) / den); // exact floor value

  it('keeps level, EXP, held item, nickname, Bond, trained, Heartmark, mark, family and shiftCount', () => {
    const c = mk('c1', 'sloshkin', 34, { nickname: 'Puddle', bond: 3, heldItem: 'fx-charm', trained: { atk: 40 } });
    c.shiftCount = 4;
    const keep = JSON.parse(JSON.stringify({ level: c.level, exp: c.exp, heldItem: c.heldItem, nickname: c.nickname, bond: c.bond, trained: c.trained, heartmark: c.heartmark, heartmarkStab: c.heartmarkStab, mark: c.mark, familyId: c.familyId, shiftCount: c.shiftCount, uid: c.uid }));
    const r = C.shiftTo(c, 'mudfist', DATA, 'flux');
    for (const [k, v] of Object.entries(keep)) assert.deepEqual(c[k], v, k);
    assert.equal(c.speciesId, 'mudfist');
    assert.deepEqual(c.types, SPECIES.mudfist.types);
    assert.equal(c.ability, SPECIES.mudfist.ability);
    assert.deepEqual(c.shiftlog, ['sloshkin', 'mudfist']);
    assert.equal(r.from, 'sloshkin');
    assert.equal(r.to, 'mudfist');
    assert.ok(c.moves.some((m) => m.id === 'undertow'), 'Heartmark technique stays');
    assert.ok(r.kept.includes('undertow'));
    for (const id of r.toMemory) assert.ok(c.memory.includes(id));
    for (const m of c.moves) assert.ok(m.id === c.heartmark || C.canLearn(C.speciesOf(c, DATA), m.id));
  });

  it('applies the per-stat floor exactly: Drift 10%, Flux 20%, Freefall none — every form pair', () => {
    for (const from of ROSTER) {
      if (SPECIES[from].flags.neverShifts) continue;
      for (const to of ROSTER) {
        for (const [dial, num] of [['drift', 9], ['flux', 8], ['freefall', null]]) {
          const c = C.makeCreature({ uid: 'c1', speciesId: from, level: 30 }, DATA);
          const b0 = { ...c.base };
          const r = C.shiftTo(c, to, DATA, dial);
          for (const k of STAT_KEYS) {
            const want = num === null ? SPECIES[to].base[k] : Math.max(SPECIES[to].base[k], ratio(num, 10, b0[k]));
            assert.equal(c.base[k], want, `${from}->${to} ${dial} ${k}`);
            if (num !== null) assert.ok(c.base[k] >= b0[k] * (num / 10) - 1e-9);
          }
          assert.equal(r.statDelta, STAT_KEYS.reduce((a, k) => a + c.base[k] - b0[k], 0));
          assert.deepEqual(r.floored, STAT_KEYS.filter((k) => num !== null && SPECIES[to].base[k] < ratio(num, 10, b0[k])));
        }
      }
    }
  });

  it('agrees with the prototype on kept/toMemory and on base stats where the prototype has no float artefact', () => {
    for (const to of ['siltback', 'mudfist', 'puddlepip', 'skeinwing', 'chillnub', 'lumenveil']) {
      const ours = mk('c1', 'sloshkin', 40);
      const theirs = proto.makeCreature({ uid: 1, speciesId: 'sloshkin', level: 40 });
      const a = C.shiftTo(ours, to, DATA, 'drift');
      const b = proto.shiftTo(theirs, to, 'drift');
      assert.deepEqual(a.kept, b.kept, to);
      assert.deepEqual(a.toMemory, b.toMemory, to);
      assert.deepEqual(ours.base, theirs.base, to);
      // the one intended difference (FE-06): a form left with no same-type hit gets one in a free slot
      assert.deepEqual(ours.moves.filter((m) => !a.learned.includes(m.id)), theirs.moves, to);
    }
  });

  it('a Shift that leaves no hit of the new types gives the form\'s latest same-type move at or below the level (FE-06)', () => {
    // the FE-06 run: Fern the Scrapling L8 rolls Down to Sootling (Kiln) and kept only tap + shadowbox
    const c = C.makeCreature({ uid: 'c1', speciesId: 'scrapling', level: 8 }, DATA);
    const r = C.shiftTo(c, 'sootling', DATA, 'drift');
    const kiln = c.moves.map((m) => DATA.moves[m.id] ?? null).filter((mv) => mv && mv.type === 'Kiln' && mv.category !== 'status' && mv.power > 0);
    assert.ok(kiln.length >= 1, `a Kiln hit after the Shift: ${c.moves.map((m) => m.id)}`);
    assert.deepEqual(r.learned, ['ember-lick'], 'the latest Kiln hit learnable by Lv8 (Scorch is a status move)');
    assert.ok(c.moves.length <= 4);
    assert.ok(!c.memory.includes('ember-lick'));
    // a form that already keeps a same-type hit learns nothing
    const hit = (id, types) => { const mv = DATA.moves[id]; return !!mv && mv.category !== 'status' && mv.power > 0 && types.includes(mv.type); };
    for (const to of ['siltback', 'mudfist', 'puddlepip', 'skeinwing', 'chillnub', 'lumenveil']) {
      const d = mk('c2', 'sloshkin', 40);
      const types = SPECIES[to].types;
      const hadHit = d.moves.some((m) => hit(m.id, types) && SPECIES[to].learnset.some((l) => l.move === m.id));
      const rd = C.shiftTo(d, to, DATA, 'drift');
      if (hadHit) assert.deepEqual(rd.learned, [], `${to}: a kept same-type hit means nothing new`);
      else assert.ok(rd.learned.length <= 1, to);
    }
    // a full set: the new hit replaces the last non-Heartmark move, which goes to Memory
    const e = C.makeCreature({ uid: 'c3', speciesId: 'scrapling', level: 30, moves: ['tap', 'knuckle', 'settle', 'shadowbox'] }, DATA);
    const before = e.moves.map((m) => m.id);
    const re = C.shiftTo(e, 'sootling', DATA, 'drift');
    assert.equal(re.learned.length, 1);
    assert.equal(e.moves.length, 4);
    assert.ok(e.moves.some((m) => m.id === e.heartmark || !e.heartmark));
    assert.ok(re.toMemory.every((id) => before.includes(id)));
    assert.ok(e.memory.every((id) => !e.moves.some((m) => m.id === id)));
  });

  it('STAT_FLOOR is tunable per dial', () => {
    const c = mk('c1', 'sloshkin', 30);
    C.shiftTo(c, 'puddlepip', DATA, 'drift', { tuning: { STAT_FLOOR: { drift: 0, flux: 0.2, freefall: null } } });
    assert.deepEqual(c.base, SPECIES.sloshkin.base, 'a 0 floor means no stat may drop');
    assert.throws(() => C.shiftTo(mk('c2', 'sloshkin', 30), 'puddlepip', DATA, 'custom'), RangeError);
    const d = mk('c3', 'sloshkin', 30);
    C.shiftTo(d, 'puddlepip', DATA, 'custom', { tuning: { STAT_FLOOR: { custom: null } } });
    assert.deepEqual(d.base, SPECIES.puddlepip.base);
  });

  it('keeps the HP ratio, refuses forms that never Shift and unknown dials/forms', () => {
    const c = mk('c1', 'sloshkin', 40);
    c.hp = Math.floor(c.stats.hp * 0.25);
    C.shiftTo(c, 'bogmonarch', DATA, 'drift');
    assert.ok(Math.abs(c.hp / c.stats.hp - 0.25) < 0.02);
    assert.throws(() => C.shiftTo(mk('c2', 'stillox', 40), 'sloshkin', DATA, 'drift'), /never Shifts/);
    assert.throws(() => C.shiftTo(mk('c3', 'sloshkin', 40), 'sloshkin', DATA, 'sideways'), RangeError);
    assert.throws(() => C.shiftTo(mk('c4', 'sloshkin', 40), 'nope', DATA, 'drift'), RangeError);
  });

  it('pins a Heartmark technique at the first Shift via opts.heartmark (must be a current move)', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'tossup', level: 20 }, DATA);
    assert.throws(() => C.shiftTo(c, 'sloshkin', DATA, 'drift', { heartmark: 'riptide' }), /current moves/);
    const pick = c.moves[c.moves.length - 1].id;
    C.shiftTo(c, 'sloshkin', DATA, 'drift', { heartmark: pick });
    assert.equal(c.heartmark, pick);
    assert.ok(c.moves.some((m) => m.id === pick));
  });

  it('gives the fallback move when no move survives, and Memory never holds duplicates or slotted moves', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'wirewhisk', level: 10, heartmark: null, moves: ['jolt'] }, DATA);
    c.memory = ['jolt'];
    C.shiftTo(c, 'chillnub', DATA, 'freefall');
    assert.equal(c.moves.length, 1);
    assert.ok(C.canLearn(C.speciesOf(c, DATA), c.moves[0].id));
    assert.deepEqual(c.memory, ['jolt']);
    C.shiftTo(c, 'wirewhisk', DATA, 'freefall');
    assert.ok(!c.memory.some((id) => c.moves.some((m) => m.id === id)));
  });

  it('an Unfixed form gets a loop and leaving it clears the loop', () => {
    const data = { ...DATA, species: { ...DATA.species, 'fx-loop': { ...SPECIES.vagary, id: 'fx-loop', flags: {} } } };
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 30 }, data);
    C.shiftTo(c, 'fx-loop', data, 'flux', { rng: makeRng('u') });
    assert.equal(c.typeQueue.length, 4);
    c.typeIndex = 2;
    C.shiftTo(c, 'sloshkin', data, 'flux');
    assert.equal(c.typeQueue, null);
    assert.equal(c.typeIndex, 0);
  });
});

describe('care helpers', () => {
  it('healFull restores HP, PP, status and Mends (tunable)', () => {
    const c = mk('c1', 'sloshkin', 20);
    c.hp = 1; c.status = { kind: 'burn', turns: 2 }; c.mends = 0; c.moves[0].pp = 0;
    C.healFull(c);
    assert.equal(c.hp, c.stats.hp);
    assert.equal(c.status, null);
    assert.equal(c.mends, 3);
    assert.equal(c.moves[0].pp, c.moves[0].maxPp);
    C.healFull(c, { tuning: { MENDS_PER_BATTLE: 1 } });
    assert.equal(c.mends, 1);
  });

  it('restorePp restores one or all moves, defaulting to PP_RESTORE_DEFAULT', () => {
    const c = mk('c1', 'sloshkin', 20);
    for (const m of c.moves) m.pp = 0;
    C.restorePp(c, 0);
    assert.equal(c.moves[0].pp, Math.min(10, c.moves[0].maxPp));
    assert.equal(c.moves[1].pp, 0);
    C.restorePp(c, null, 3);
    assert.equal(c.moves[1].pp, 3);
    C.restorePp(c, 9, 5);
    C.restorePp(c, null, 999);
    for (const m of c.moves) assert.equal(m.pp, m.maxPp);
    C.restorePp(c, 0, undefined, { tuning: { PP_RESTORE_DEFAULT: 0 } });
  });

  it('addBond clamps to 0..MAX_BOND; setHeldItem tracks stillKnot', () => {
    const c = mk('c1', 'sloshkin', 20);
    assert.deepEqual(C.addBond(c, 3), { from: 0, to: 3 });
    assert.deepEqual(C.addBond(c, 10), { from: 3, to: 5 });
    assert.deepEqual(C.addBond(c, -9), { from: 5, to: 0 });
    assert.deepEqual(C.addBond(c, 4, { tuning: { MAX_BOND: 2 } }), { from: 0, to: 2 });
    assert.deepEqual(C.setHeldItem(c, 'fx-knot', DATA), { prev: null });
    assert.equal(c.stillKnot, true);
    assert.deepEqual(C.setHeldItem(c, null, DATA), { prev: 'fx-knot' });
    assert.equal(c.stillKnot, false);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips exactly, as a deep copy with only schema keys', () => {
    for (const id of ['sloshkin', 'vagary', 'prismoth']) {
      const c = mk('c9', id, 44, { bond: 2, heldItem: 'fx-charm' });
      c.status = { kind: 'poison', turns: 1 };
      c.hp = 3;
      c.memory = ['gale-cut'];
      c.windowsUsed = [9, 20];
      const s = C.serialize(c);
      assert.notEqual(s, c);
      assert.notEqual(s.moves, c.moves);
      assert.deepEqual(Object.keys(s).sort(), KEYS);
      assert.deepEqual(C.deserialize(s, DATA), c);
      assert.deepEqual(C.deserialize(JSON.parse(JSON.stringify(s)), DATA), c);
    }
  });

  it('serialize drops foreign keys and fills missing ones', () => {
    const c = /** @type {any} */ ({ ...mk('c1', 'sloshkin', 5), extra: 1 });
    delete c.caughtMap;
    const s = C.serialize(c);
    assert.ok(!('extra' in s));
    assert.equal(s.caughtMap, '');
  });

  it('deserialize self-heals clamped numbers, bad statuses, duplicate moves and out-of-band EXP', () => {
    const s = C.serialize(mk('c1', 'sloshkin', 20));
    Object.assign(s, {
      v: 1, junk: true, hp: 9999, level: 300, exp: -5, bond: 12, status: { kind: 'trap', turns: 2 }, mends: -1,
      moves: [{ id: 'tap', pp: 99, maxPp: 35 }, { id: 'tap', pp: 1, maxPp: 35 }, { id: 'settle', pp: -3 }, { id: 'riptide' }, { id: 'undertow', pp: 2, maxPp: 15 }, { id: 'shellguard', pp: 1, maxPp: 10 }],
      windowsUsed: [20, 9, 9, 0, 'x'], typeQueue: [], typeIndex: 4, mark: { x: 1.5, y: 0 }, trained: { atk: 300 },
    });
    const c = C.deserialize(s, DATA);
    assert.deepEqual(Object.keys(c).sort(), KEYS);
    assert.equal(c.level, 100);
    assert.equal(c.exp, protoExpForLevel('medium-slow', 100));
    assert.equal(c.hp, c.stats.hp);
    assert.equal(c.bond, 5);
    assert.equal(c.status, null);
    assert.equal(c.mends, 3);
    assert.deepEqual(c.moves.map((m) => [m.id, m.pp]), [['tap', 35], ['settle', 0], ['riptide', 10], ['undertow', 2]]);
    assert.deepEqual(c.windowsUsed, [9, 20]);
    assert.equal(c.typeQueue, null);
    assert.equal(c.typeIndex, 0);
    assert.deepEqual(c.mark, { x: 0, y: 0 });
    assert.equal(c.trained.atk, 252);
    const w = world();
    w.party.push(c);
    assert.deepEqual(validateWorld(w), []);
  });

  it('deserialize rejects non-objects, missing uids and unknown content', () => {
    assert.throws(() => C.deserialize(null, DATA), TypeError);
    assert.throws(() => C.deserialize([], DATA), TypeError);
    assert.throws(() => C.deserialize({ speciesId: 'sloshkin' }, DATA), TypeError);
    assert.throws(() => C.deserialize({ uid: 'c1', speciesId: 'nope' }, DATA), RangeError);
    assert.throws(() => C.deserialize({ uid: 'c1', speciesId: 'sloshkin', moves: [{ id: 'nope' }] }, DATA), RangeError);
  });
});

describe('dataLookup', () => {
  it('normalizes species rows and reads every table shape', () => {
    const look = C.dataLookup(DATA);
    assert.equal(look, C.dataLookup(DATA), 'cached per data object');
    const sp = look.species('sloshkin');
    assert.equal(sp.familyId, 'sloshkin');
    assert.deepEqual(sp.learnset[0], { level: 1, move: 'tap' });
    const tupleRows = { species: [{ ...SPECIES.sloshkin, familyId: 'x', family: undefined, learnset: [[1, 'tap'], [5, 'undertow']] }] };
    const sp2 = C.dataLookup(tupleRows).species('sloshkin');
    assert.equal(sp2.familyId, 'x');
    assert.deepEqual(sp2.learnset[1], { level: 5, move: 'undertow' });
    const fnTables = C.dataLookup({ moves: (id) => (id === 'tap' ? MOVES_TAP : undefined) });
    assert.equal(fnTables.move('tap'), MOVES_TAP);
    assert.equal(fnTables.moveOrNull('x'), null);
    assert.throws(() => fnTables.species('sloshkin'), RangeError);
    assert.deepEqual(C.dataLookup({}).typeNames(), []);
    assert.equal(C.dataLookup(REG).typeNames().length, 13);
    assert.throws(() => C.dataLookup(null), TypeError);
  });
});

const MOVES_TAP = DATA.moves.tap;

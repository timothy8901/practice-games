// Moves, abilities and species data checks. Run: node --test proto/battle/test/
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MOVES, MOVE_LIST, SCRAP, EVASION_MOVE_MAX_PP, getMove, isDamaging, isSureHit, isChipMove, isSelfTargeting, movesOfType } from '../moves.js';
import { ABILITIES, ABILITY_LIST, WARD_IDS, getAbility, isWard, wardCheck, wardHeldText } from '../abilities.js';
import { SPECIES, SPECIES_LIST, ROSTER_IDS, getSpecies, baseTotal, learnableAt, canLearn, expForLevel, levelFromExp, SLOSHKIN_SHIFT_TABLE } from '../species.js';
import { ORDINARY_TYPES, TYPES } from '../types.js';

describe('moves', () => {
  it('has around 45 techniques covering every type and all three categories', () => {
    assert.ok(MOVE_LIST.length >= 45, `${MOVE_LIST.length} moves`);
    for (const t of TYPES) assert.ok(movesOfType(t).some(isDamaging), `no damaging ${t} move`);
    for (const cat of ['physical', 'special', 'status']) assert.ok(MOVE_LIST.some((m) => m.category === cat));
  });

  it('every move is well formed', () => {
    for (const m of MOVE_LIST) {
      assert.ok(m.type === null || TYPES.includes(m.type), m.id);
      assert.ok(['physical', 'special', 'status'].includes(m.category), m.id);
      assert.ok(m.accuracy === null || (m.accuracy > 0 && m.accuracy <= 100), m.id);
      assert.ok(m.pp === null || m.pp > 0, m.id);
      if (m.category === 'status') assert.equal(m.power, 0, m.id);
      else assert.ok(m.power > 0, m.id);
    }
  });

  it('includes every signature move from the creatures doc with its stated numbers', () => {
    const want = {
      undertow: ['Brine', 65, 100], 'skein-sweep': ['Gust', 60], shadowbox: ['Hollow', 50], 'dust-veil': ['Glass', 30],
      'vesper-mend': ['Glass', 0], tailfall: ['Star', 90], gnash: ['Hollow', 60], snuff: ['Hollow', 50], reap: ['Moss', 70],
      'arc-ping': ['Bolt', 30], 'plate-toss': ['Rime', 60], bandlight: ['Bolt', 90], 'sure-pinch': ['Plain', 40],
      'bedrock-charge': ['Stone', 100], 'kiln-maw': ['Kiln', 75],
    };
    for (const [id, [type, power, acc]] of Object.entries(want)) {
      const m = getMove(id);
      assert.equal(m.type, type, id);
      assert.equal(m.power, power, id);
      if (acc) assert.equal(m.accuracy, acc, id);
    }
    assert.equal(getMove('shadowbox').pp, 10);
    assert.equal(getMove('arc-ping').priority, 1);
    assert.ok(getMove('sure-pinch').accuracy === null && isSureHit(getMove('sure-pinch')));
    assert.equal(getMove('vesper-mend').effect.recovery.delay, 1);
    assert.equal(getMove('vesper-mend').effect.recovery.cancelledBy, 'Hollow');
    assert.equal(getMove('gnash').effect.flinch, 0.3);
    assert.equal(getMove('gnash').effect.popsDecoy, 1);
    assert.equal(getMove('dust-veil').effect.status.chance, 0.3);
    assert.ok(getMove('bedrock-charge').effect.charge);
    assert.ok(getMove('tailfall').effect.queuedType);
    assert.ok(getMove('snuff').effect.clearRaised);
    assert.ok(getMove('reap').effect.highCrit);
  });

  it('Scrap is typeless, 50 power, never misses and never runs out', () => {
    assert.equal(SCRAP.type, null);
    assert.equal(SCRAP.power, 50);
    assert.equal(SCRAP.pp, null);
    assert.ok(isSureHit(SCRAP));
    assert.ok(SCRAP.effect.scrap);
  });

  it('Plumbline always hits, clears stages and is a status technique', () => {
    const p = getMove('plumbline');
    assert.ok(p.effect.plumbline && isSureHit(p));
    assert.equal(p.category, 'status');
  });

  it('evasion moves have at most 5 PP and there is a guard, a recovery, a poison and a trap disc', () => {
    const eva = MOVE_LIST.filter((m) => m.effect.evasion);
    assert.ok(eva.length >= 1);
    for (const m of eva) assert.ok(m.pp <= EVASION_MOVE_MAX_PP, m.id);
    assert.ok(MOVE_LIST.some((m) => m.effect.guard));
    assert.ok(MOVE_LIST.filter((m) => m.effect.recovery).length >= 2);
    assert.ok(MOVE_LIST.some((m) => m.effect.status && m.effect.status.kind === 'poison' && m.category === 'status'));
    assert.ok(MOVE_LIST.some((m) => m.effect.status && m.effect.status.kind === 'trap'));
    assert.ok(MOVE_LIST.filter((m) => isSureHit(m) && isDamaging(m) && !m.effect.scrap).length >= 1);
    assert.ok(MOVE_LIST.filter((m) => isSureHit(m)).length >= 3, 'at least three sure-hit techniques');
  });

  it('status helpers classify moves', () => {
    assert.ok(isChipMove(getMove('corrode')));
    assert.ok(!isChipMove(getMove('tap')));
    assert.ok(isSelfTargeting(getMove('settle')));
    assert.ok(isSelfTargeting(getMove('shellguard')));
    assert.ok(!isSelfTargeting(getMove('scorch')));
    assert.ok(!isSelfTargeting(getMove('plumbline')));
    assert.throws(() => getMove('nope'), RangeError);
    assert.equal(Object.keys(MOVES).length, MOVE_LIST.length);
  });
});

describe('abilities', () => {
  it('includes every ability named in the creatures doc plus the three Wards and generic ones', () => {
    const named = ['shoresense', 'featherbed', 'big-sibling', 'prism-ward', 'afterimage', 'unfixed', 'last-ebb', 'empty-weave', 'keen-glint', 'tailhum', 'plateshed', 'skyroam', 'blank-slate', 'unshifting', 'furnace-jaw', 'glasshide', 'mirrorveil', 'stillcoat', 'sodden'];
    for (const id of named) assert.ok(ABILITIES[id], id);
    assert.ok(ABILITY_LIST.length >= named.length + 5);
    assert.deepEqual(WARD_IDS.slice().sort(), ['glasshide', 'mirrorveil', 'prism-ward', 'stillcoat']);
    assert.ok(isWard(getAbility('prism-ward')) && !isWard(getAbility('tidecall')));
    assert.throws(() => getAbility('wonder-guard'), RangeError);
  });

  it('Glasshide / Prism Ward: only Strong hits land, status moves pass, Scrap never pierces', () => {
    const g = getAbility('prism-ward');
    assert.equal(wardCheck(g, getMove('tap'), ['Glass', 'Gust']).lands, false);
    assert.equal(wardCheck(g, getMove('tap'), ['Glass', 'Gust']).reason, 'ward');
    assert.equal(wardCheck(g, getMove('kiln-maw'), ['Glass', 'Gust']).lands, true);
    assert.equal(wardCheck(g, getMove('frost-nip'), ['Glass', 'Gust']).lands, true);
    assert.equal(wardCheck(g, getMove('scorch'), ['Glass', 'Gust']).lands, true, 'status moves pass a strong-only Ward');
    assert.equal(wardCheck(g, SCRAP, ['Glass', 'Gust']).lands, false);
  });

  it('Mirrorveil: status moves fail, damaging moves land', () => {
    const mv = getAbility('mirrorveil');
    assert.equal(wardCheck(mv, getMove('scorch'), ['Glass']).lands, false);
    assert.equal(wardCheck(mv, getMove('plumbline'), ['Glass']).lands, false);
    assert.equal(wardCheck(mv, getMove('tap'), ['Glass']).lands, true);
    assert.equal(wardCheck(mv, SCRAP, ['Glass']).lands, false);
  });

  it('Stillcoat: hits under 50 power do nothing; 50 and up land', () => {
    const sc = getAbility('stillcoat');
    assert.equal(wardCheck(sc, getMove('tap'), ['Rime']).lands, false);
    assert.equal(wardCheck(sc, getMove('shadowbox'), ['Rime']).lands, true);
    assert.equal(wardCheck(sc, getMove('knuckle'), ['Rime']).lands, true);
    assert.equal(wardCheck(sc, SCRAP, ['Rime']).lands, false, 'Scrap is 50 power but never pierces');
  });

  it('immunity is reported before a Ward and a non-Ward always lands', () => {
    assert.equal(wardCheck(getAbility('glasshide'), getMove('tap'), ['Hollow']).reason, 'immune');
    assert.equal(wardCheck(getAbility('tidecall'), getMove('tap'), ['Brine']).lands, true);
    assert.equal(wardCheck(null, getMove('tap'), ['Brine']).lands, true);
  });

  it('names the Ward in the readout header', () => {
    assert.equal(wardHeldText(getAbility('glasshide')), 'Glasshide held. Only Strong hits get through.');
    assert.match(wardHeldText(getAbility('stillcoat')), /under 50 power/);
  });

  it('hook functions behave', () => {
    const fb = getAbility('featherbed').hooks.onDefendMult;
    const flags = {};
    assert.equal(fb({ move: getMove('tap'), bflags: flags }).mult, 0.5);
    assert.equal(fb({ move: getMove('tap'), bflags: flags }).mult, 1, 'only the first contact hit');
    assert.equal(fb({ move: getMove('salt-spray'), bflags: {} }).mult, 1, 'non-contact is not softened');
    assert.equal(getAbility('last-ebb').hooks.onAttackMult({ hpRatio: 0.2, moveType: 'Brine' }), 1.3);
    assert.equal(getAbility('last-ebb').hooks.onAttackMult({ hpRatio: 0.5, moveType: 'Brine' }), 1);
    assert.equal(getAbility('last-ebb').hooks.onAttackMult({ hpRatio: 0.2, moveType: 'Kiln' }), 1);
    assert.equal(getAbility('keen-glint').hooks.critStages(), 2);
    const ew = getAbility('empty-weave').hooks.onDefendMult;
    assert.equal(ew({ eff: { word: 'Strong' }, bflags: {} }).mult, 1);
    const f2 = {};
    assert.equal(ew({ eff: { word: 'Neutral' }, bflags: f2 }).mult, 0.5);
    assert.equal(ew({ eff: { word: 'Neutral' }, bflags: f2 }).mult, 1);
    const ps = getAbility('plateshed').hooks.onDefendMult({ eff: { word: 'Strong', mult: 4 }, bflags: {} });
    assert.equal(ps.mult, 0.25);
    assert.ok(getAbility('still-mind').hooks.statusImmune('numb'));
    assert.ok(!getAbility('still-mind').hooks.statusImmune('burn'));
    assert.deepEqual(getAbility('big-sibling').expShare, { toLowest: 0.3 });
  });
});

describe('species', () => {
  it('has the 15 roster creatures and the Sloshkin family forms', () => {
    assert.equal(ROSTER_IDS.length, 15);
    for (const id of ['sloshkin', 'skeinwing', 'scrapling', 'prismoth', 'vesperay', 'vagary', 'brinelance', 'creelwight', 'sedgehare', 'wirewhisk', 'rimeplate', 'squallcoil', 'tossup', 'stillox', 'caldermaw']) assert.ok(SPECIES[id], id);
    for (const id of ['siltback', 'bogmonarch', 'lumenveil', 'mudfist', 'rushling', 'puddlepip', 'chillnub', 'star-touched-sloshkin', 'bilgebob', 'sootling', 'knuckleback', 'cragmitt']) assert.ok(SPECIES[id], id);
    assert.ok(SPECIES_LIST.length >= 22);
    assert.throws(() => getSpecies('mudkip'), RangeError);
  });

  it('types and abilities match the doc', () => {
    const want = {
      sloshkin: [['Brine'], 'shoresense'], skeinwing: [['Brine', 'Gust'], 'featherbed'], scrapling: [['Grit'], 'big-sibling'], prismoth: [['Glass', 'Gust'], 'prism-ward'],
      vesperay: [['Brine', 'Glass'], 'afterimage'], vagary: [['Star'], 'unfixed'], brinelance: [['Brine', 'Rime'], 'last-ebb'], creelwight: [['Hollow', 'Rust'], 'empty-weave'],
      sedgehare: [['Moss'], 'keen-glint'], wirewhisk: [['Bolt'], 'tailhum'], rimeplate: [['Rime', 'Stone'], 'plateshed'], squallcoil: [['Bolt', 'Brine'], 'skyroam'],
      tossup: [['Plain'], 'blank-slate'], stillox: [['Stone'], 'unshifting'], caldermaw: [['Kiln', 'Stone'], 'furnace-jaw'], puddlepip: [['Brine'], 'glasshide'], bilgebob: [['Brine'], 'sodden'],
    };
    for (const [id, [types, ability]] of Object.entries(want)) {
      assert.deepEqual(getSpecies(id).types, types, id);
      assert.equal(getSpecies(id).ability, ability, id);
    }
    assert.equal(getSpecies('sloshkin').heartmark, 'undertow');
    assert.equal(getSpecies('scrapling').heartmark, 'shadowbox');
    assert.equal(getSpecies('brinelance').heartmark, 'gnash');
    assert.equal(getSpecies('wirewhisk').heartmark, 'arc-ping');
    assert.equal(getSpecies('tossup').heartmark, null);
    assert.ok(getSpecies('tossup').flags.heartmarkChosenAtFirstShift);
  });

  it('base stat totals sit on the stage ladder (hatchling < stage 1 < 2 < 3; titan and legendary on top)', () => {
    const ranges = { 0: [250, 300], 1: [290, 360], 2: [370, 470], 3: [490, 525], 4: [515, 605] };
    for (const s of SPECIES_LIST) {
      const [lo, hi] = ranges[s.stage];
      const total = baseTotal(s);
      assert.ok(total >= lo && total <= hi, `${s.id} stage ${s.stage} total ${total}`);
    }
    assert.equal(baseTotal(getSpecies('vagary')), 600);
    assert.ok(baseTotal(getSpecies('stillox')) >= 520);
    assert.ok(getSpecies('stillox').base.def >= 120, 'a titan');
    assert.equal(getSpecies('prismoth').flags.hpMultiplier, 0.25);
    assert.ok(getSpecies('sloshkin').base.spe < 45, 'Sloshkin is slow');
    assert.ok(getSpecies('wirewhisk').base.atk < 50 && getSpecies('wirewhisk').base.hp < 50, 'Wirewhisk is a support pick');
    assert.equal(baseTotal(getSpecies('siltback')) - baseTotal(getSpecies('sloshkin')), 55, 'Forecast mockup: Siltback +55');
    assert.equal(baseTotal(getSpecies('mudfist')) - baseTotal(getSpecies('sloshkin')), 5, 'Forecast mockup: Mudfist +5');
    assert.equal(baseTotal(getSpecies('puddlepip')) - baseTotal(getSpecies('sloshkin')), -40, 'Forecast mockup: Puddlepip -40');
  });

  it('learnsets have 6-10 moves, all valid, and every signature is learnable by its creature', () => {
    for (const s of SPECIES_LIST) {
      assert.ok(s.learnset.length >= 6 && s.learnset.length <= 10, `${s.id}: ${s.learnset.length}`);
      for (const e of s.learnset) getMove(e.move);
      assert.ok(learnableAt(s, 1).length >= 1, `${s.id} knows something at Lv1`);
      if (s.heartmark && ROSTER_IDS.includes(s.id)) assert.ok(canLearn(s, s.heartmark), `${s.id} learns its Heartmark technique`);
    }
    for (const m of MOVE_LIST) if (m.signature) assert.ok(canLearn(getSpecies(m.signature), m.id), `${m.signature} learns ${m.id}`);
    assert.ok(learnableAt(getSpecies('sloshkin'), 20).includes('undertow'));
    assert.ok(!learnableAt(getSpecies('sloshkin'), 4).includes('undertow'));
  });

  it('catch rates, exp yields and growth curves are sane', () => {
    for (const s of SPECIES_LIST) {
      assert.ok(s.catchRate >= 3 && s.catchRate <= 255, s.id);
      assert.ok(s.expYield > 0, s.id);
      assert.ok(['fast', 'medium-fast', 'medium-slow', 'slow'].includes(s.growth), s.id);
    }
    assert.equal(getSpecies('vagary').catchRate, 3);
    assert.equal(getSpecies('tossup').catchRate, 255);
    assert.ok(getSpecies('squallcoil').flags.errant);
  });

  it('growth curves are monotonic and round-trip through levelFromExp', () => {
    for (const g of ['fast', 'medium-fast', 'medium-slow', 'slow']) {
      let prev = -1;
      for (let lv = 1; lv <= 100; lv++) {
        const e = expForLevel(g, lv);
        assert.ok(e > prev, `${g} ${lv}`);
        prev = e;
        assert.equal(levelFromExp(g, e), lv);
        assert.equal(levelFromExp(g, e + 1), lv === 100 ? 100 : lv);
      }
      assert.equal(expForLevel(g, 1), 0);
    }
    assert.ok(expForLevel('slow', 50) > expForLevel('fast', 50));
  });

  it('Sloshkin Shift table weights sum to 100 per card per dial', () => {
    for (const dial of ['drift', 'flux', 'freefall']) {
      for (const card of ['up', 'side', 'down']) {
        const sum = SLOSHKIN_SHIFT_TABLE.pool.filter((r) => r.card === card).reduce((a, r) => a + r.weights[dial], 0);
        assert.equal(sum, 100, `${dial} ${card}`);
      }
    }
    assert.deepEqual(SLOSHKIN_SHIFT_TABLE.cardOddsByDial.drift, { up: 0.5, side: 0.4, down: 0.1 });
    assert.deepEqual(SLOSHKIN_SHIFT_TABLE.cardOddsByDial.flux, { up: 0.4, side: 0.35, down: 0.25 });
    assert.equal(SLOSHKIN_SHIFT_TABLE.cardOddsByDial.freefall.up, null, '[NEED SOURCE]');
    assert.equal(SLOSHKIN_SHIFT_TABLE.starTouched.forecastChance, 0.02);
    for (const r of SLOSHKIN_SHIFT_TABLE.pool) getSpecies(r.form);
    assert.ok(ORDINARY_TYPES.length === 12);
  });
});

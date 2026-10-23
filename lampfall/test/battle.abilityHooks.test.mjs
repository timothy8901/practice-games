// js/battle/abilityHooks.js: the hook vocabulary, the runtime merge of data rows + hooks, row
// validation and tuning of hook defaults. Run: node --test test/battle.abilityHooks.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HOOKS, HOOK_KEYS, DEFAULTS, getAbilityRuntime, abilityProblems } from '../js/battle/abilityHooks.js';
import { ABILITIES } from './fixtures/battle/data.mjs';
import { getMove, mk, duel, ofType, constRng } from './fixtures/battle/helpers.mjs';

const row = (hook, hookParams, extra = {}) => ({ id: `t-${hook}`, name: `T ${hook}`, text: 'test', ward: null, hook, ...(hookParams ? { hookParams } : {}), ...extra });

describe('the hook vocabulary', () => {
  it('every hook has a description and builds without params', () => {
    assert.ok(HOOK_KEYS.length >= 15);
    for (const key of HOOK_KEYS) {
      assert.equal(typeof HOOKS[key].describe, 'string', key);
      const rt = getAbilityRuntime(row(key));
      assert.equal(rt.hook, key);
      assert.ok(Object.isFrozen(rt) && Object.isFrozen(rt.hooks) && Object.isFrozen(rt.params));
    }
  });

  it('hook keys name behaviour, never content: every fixture ability maps onto the vocabulary', () => {
    for (const a of ABILITIES) {
      assert.deepEqual(abilityProblems(a), [], a.id);
      if (a.hook !== null) assert.ok(HOOK_KEYS.includes(a.hook), a.id);
    }
    for (const key of HOOK_KEYS) assert.match(key, /^[a-z][a-z-]*$/);
  });

  it('a row with no hook is plain data: no hook functions, no flags', () => {
    const rt = getAbilityRuntime({ id: 'calm', name: 'Calm', text: 'Nothing.', ward: null, hook: null });
    assert.deepEqual(Object.keys(rt.hooks), []);
    assert.equal(rt.glint || rt.decoys || rt.blocksSelfKo || rt.unfixed, false);
    assert.equal(rt.expShare, null);
    const rt2 = getAbilityRuntime({ id: 'calm2', name: 'Calm2' });
    assert.equal(rt2.text, '');
    assert.equal(rt2.ward, null);
  });

  it('refuses an unknown hook and a malformed row', () => {
    assert.throws(() => getAbilityRuntime(row('wonder-guard')), /unknown hook "wonder-guard"/);
    assert.throws(() => getAbilityRuntime(null), TypeError);
    assert.throws(() => getAbilityRuntime({ name: 'no id' }), TypeError);
  });

  it('abilityProblems names bad hooks, Ward kinds, min-power without a threshold and bad params', () => {
    assert.ok(abilityProblems(row('nope'))[0].includes('unknown hook'));
    assert.ok(abilityProblems({ id: 'w', name: 'W', hook: null, ward: { kind: 'mirror' } })[0].includes('unknown ward kind'));
    assert.ok(abilityProblems({ id: 'w', name: 'W', hook: null, ward: { kind: 'min-power' } })[0].includes('minPower'));
    assert.ok(abilityProblems({ id: 'w', name: 'W', hook: 'decoys', hookParams: [1] })[0].includes('hookParams'));
    assert.ok(abilityProblems({ id: 'w', hook: null })[0].includes('name'));
    assert.deepEqual(abilityProblems(null), ['ability ?: not an object']);
  });
});

describe('hook behaviour (ported from proto data.test "hook functions behave")', () => {
  const byId = Object.fromEntries(ABILITIES.map((a) => [a.id, getAbilityRuntime(a)]));

  it('first-hit softeners, low-HP boost, crit boost, neutralizer, status immunity, EXP share', () => {
    const fb = byId.featherbed.hooks.onDefendMult;
    const flags = {};
    assert.equal(fb({ move: getMove('tap'), bflags: flags }).mult, 0.5);
    assert.equal(fb({ move: getMove('tap'), bflags: flags }).mult, 1, 'only the first contact hit');
    assert.equal(fb({ move: getMove('salt-spray'), bflags: {} }).mult, 1, 'non-contact is not softened');
    assert.equal(byId['last-ebb'].hooks.onAttackMult({ hpRatio: 0.2, moveType: 'Brine' }), 1.3);
    assert.equal(byId['last-ebb'].hooks.onAttackMult({ hpRatio: 0.5, moveType: 'Brine' }), 1);
    assert.equal(byId['last-ebb'].hooks.onAttackMult({ hpRatio: 0.2, moveType: 'Kiln' }), 1);
    assert.equal(byId['last-ebb'].hooks.onAttackMult({ hpRatio: 0.2, moveType: null }), 1, 'typeless never boosted');
    assert.equal(byId['keen-glint'].hooks.critStages(), 2);
    assert.equal(byId['keen-glint'].glint, true);
    const ew = byId['empty-weave'].hooks.onDefendMult;
    assert.equal(ew({ eff: { word: 'Strong' }, bflags: {} }).mult, 1);
    const f2 = {};
    assert.equal(ew({ eff: { word: 'Neutral' }, bflags: f2 }).mult, 0.5);
    assert.equal(ew({ eff: { word: 'Neutral' }, bflags: f2 }).mult, 1);
    assert.equal(byId.plateshed.hooks.onDefendMult({ eff: { word: 'Strong', mult: 4 }, bflags: {} }).mult, 0.25);
    assert.ok(byId['still-mind'].hooks.statusImmune('numb'));
    assert.ok(!byId['still-mind'].hooks.statusImmune('burn'));
    assert.deepEqual(byId['big-sibling'].expShare, { toLowest: 0.3 });
    assert.equal(byId.slatehide.hooks.onDefendMult({ move: getMove('tap') }).mult, 0.75);
    assert.equal(byId.slatehide.hooks.onDefendMult({ move: getMove('salt-spray') }).mult, 1);
    assert.equal(byId.scavenger.hooks.healOnKo(), 1 / 8);
    assert.equal(byId['sure-footing'].hooks.blocksForeignStatDrops(), true);
    assert.equal(byId.afterimage.decoys, true);
    assert.equal(byId.sodden.blocksSelfKo, true);
    assert.equal(byId.unfixed.unfixed, true);
    assert.equal(typeof byId.unfixed.hooks.onTurnEnd, 'function');
    assert.equal(typeof byId.shoresense.hooks.onSwitchIn, 'function');
    assert.equal(byId.tailhum.params.count, 1);
  });

  it('first-type-sure-hit fires once per battle for its types only, and not for status moves', () => {
    const fj = byId['furnace-jaw'].hooks.sureHitOverride;
    const flags = {};
    assert.equal(fj({ move: getMove('scorch'), bflags: flags }), false, 'status move');
    assert.equal(fj({ move: getMove('tap'), bflags: flags }), false, 'other type');
    assert.equal(fj({ move: getMove('kiln-maw'), bflags: flags }), true);
    assert.equal(fj({ move: getMove('kiln-maw'), bflags: flags }), false, 'only the first');
  });

  it('two first-hit abilities never share a used-flag (flags are keyed by ability id)', () => {
    const a = getAbilityRuntime({ id: 'soft-a', name: 'A', hook: 'soften-first-contact' });
    const b = getAbilityRuntime({ id: 'soft-b', name: 'B', hook: 'soften-first-contact' });
    const flags = {};
    assert.equal(a.hooks.onDefendMult({ move: getMove('tap'), bflags: flags }).mult, 0.5);
    assert.equal(b.hooks.onDefendMult({ move: getMove('tap'), bflags: flags }).mult, 0.5);
    assert.match(a.hooks.onDefendMult({ move: getMove('tap'), bflags: {} }).text, /A softened the hit/);
  });
});

describe('params and tuning', () => {
  it('row hookParams beat tuning defaults, which beat DEFAULTS', () => {
    assert.ok(Object.isFrozen(DEFAULTS));
    assert.equal(getAbilityRuntime(row('type-power-boost', { types: ['Kiln'] })).params.mult, DEFAULTS.typeBoostMult);
    assert.equal(getAbilityRuntime(row('type-power-boost', { types: ['Kiln'] }), { tuning: { typeBoostMult: 1.5 } }).params.mult, 1.5);
    assert.equal(getAbilityRuntime(row('type-power-boost', { types: ['Kiln'], mult: 2 }), { tuning: { typeBoostMult: 1.5 } }).params.mult, 2);
    const boost = getAbilityRuntime(row('type-power-boost', { types: 'Kiln' }));
    assert.equal(boost.hooks.onAttackMult({ moveType: 'Kiln' }), DEFAULTS.typeBoostMult, 'a single type string works');
  });

  it('a wider battle tuning table is accepted (unknown keys for this module are ignored)', () => {
    const rt = getAbilityRuntime(row('heal-on-ko'), { tuning: { healOnKoFraction: 0.5, stab: 3 } });
    assert.equal(rt.hooks.healOnKo(), 0.5);
  });

  it('the data contract shorthands glint / expShare set the flags', () => {
    assert.equal(getAbilityRuntime({ id: 'g', name: 'G', hook: null, glint: true }).glint, true);
    assert.deepEqual(getAbilityRuntime({ id: 'e', name: 'E', hook: null, expShare: true }).expShare, { toLowest: DEFAULTS.expShareToLowest });
    assert.deepEqual(getAbilityRuntime({ id: 'e2', name: 'E', hook: null, expShare: 0.5 }).expShare, { toLowest: 0.5 });
    assert.deepEqual(getAbilityRuntime({ id: 'e3', name: 'E', hook: null, expShare: { toLowest: 0.1 } }).expShare, { toLowest: 0.1 });
    assert.equal(getAbilityRuntime(row('crit-boost', { glint: false })).glint, false);
  });

  it('a tuned hook default reaches the battle through createBattle({tuning})', () => {
    const run = (tuning) => {
      const a = mk('scrapling', 40, ['knuckle']);
      const d = mk('skeinwing', 80, ['tidal-mend']);
      const bt = duel(a, d, { rng: constRng(0.5), tuning });
      return ofType(bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]), 'damage').find((e) => e.side === 1).amount;
    };
    // Featherbed's fixture row sets mult 0.5 itself, so tuning softenMult does not change it.
    assert.equal(run({ softenMult: 0.1 }), run(undefined));
  });
});

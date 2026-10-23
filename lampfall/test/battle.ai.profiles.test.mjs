// js/battle/ai.js profiles ('wild' | 'trainer' | 'spire' | 'summit'): resolution, tuning,
// default profile per battle, the finisher step, and simulator runs under every profile.
// Run: node --test test/battle.ai.profiles.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROFILES, PROFILES, DEFAULTS, HEAL_THRESHOLD, MAX_EVASION_USES, resolveProfile, profileFor, chooseAction, chooseTrainerAction, makeFoeAi, foeAi, isLegal } from '../js/battle/ai.js';
import { mk, duel, ofType } from './fixtures/battle/helpers.mjs';
import { simulate } from './fixtures/battle/sim.mjs';

describe('profiles', () => {
  it('there are exactly the four named profiles, frozen, with the prototype trainer values', () => {
    assert.deepEqual(AI_PROFILES, ['wild', 'trainer', 'spire', 'summit']);
    assert.deepEqual(Object.keys(PROFILES), AI_PROFILES, 'the validator reads PROFILES');
    assert.ok(Object.isFrozen(DEFAULTS) && Object.isFrozen(DEFAULTS.profiles) && Object.isFrozen(DEFAULTS.profiles.summit));
    assert.equal(HEAL_THRESHOLD, 0.35);
    assert.equal(MAX_EVASION_USES, 2);
    for (const p of AI_PROFILES) assert.ok(DEFAULTS.profiles[p].maxEvasionUses <= 2, `${p}: rules 10.1 caps AI evasion at 2`);
    assert.equal(DEFAULTS.profiles.wild.brain, 'wild');
    assert.equal(DEFAULTS.profiles.trainer.finisher, false);
    assert.equal(DEFAULTS.profiles.spire.finisher, true);
  });

  it('resolveProfile merges a tuning override per profile and rejects unknown names', () => {
    assert.equal(resolveProfile('trainer'), DEFAULTS.profiles.trainer);
    const p = resolveProfile('summit', { profiles: { summit: { healThreshold: 0.6 } } });
    assert.equal(p.healThreshold, 0.6);
    assert.equal(p.finisher, true);
    assert.equal(resolveProfile('spire', { profiles: { summit: { healThreshold: 0.6 } } }), DEFAULTS.profiles.spire, 'other profiles untouched');
    assert.throws(() => resolveProfile('gym'), /unknown profile gym/);
    assert.throws(() => resolveProfile('trainer', { profiles: { trainer: { bravery: 1 } } }), /unknown profile field "bravery"/);
    assert.throws(() => resolveProfile('trainer', { profiles: { boss: {} } }), /unknown profile "boss"/);
    assert.throws(() => resolveProfile('trainer', { heal: 1 }), /unknown tuning key "heal"/);
  });

  it('profileFor: wild foe -> wild, Summit -> summit, Spire -> spire, else trainer (and the player side never gets wild)', () => {
    const mkb = (opts) => duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap']), opts);
    assert.equal(profileFor(mkb({ kind: 'wild' }), 1), 'wild');
    assert.equal(profileFor(mkb({ kind: 'wild' }), 0), 'trainer');
    assert.equal(profileFor(mkb({ summit: true, source: 'spire' }), 1), 'summit');
    assert.equal(profileFor(mkb({ source: 'spire' }), 1), 'spire');
    assert.equal(profileFor(mkb({ source: 'story' }), 1), 'trainer');
  });

  it('makeFoeAi binds a profile (checked at build time); foeAi uses the default profile', () => {
    assert.throws(() => makeFoeAi('gym'), RangeError);
    const bt = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap', 'settle']), { foeAi: makeFoeAi('summit') });
    const evs = bt.step({ type: 'move', move: 0 });
    assert.equal(ofType(evs, 'move').length, 2);
    const a = foeAi(bt, 1);
    assert.ok(isLegal(bt, 1, a));
    assert.deepEqual(chooseAction(bt, 1), a);
  });
});

describe('the finisher step (spire / summit)', () => {
  it('takes a guaranteed knock-out with the most accurate move, where the trainer brain plays for raw damage', () => {
    // Foe at low HP: Tap (100%) surely KOs; Grind Down (85 power, 90%) scores higher on raw expected damage.
    const setup = () => {
      const me = mk('tossup', 30, ['tap']);
      me.hp = 3;
      const foe = mk('scrapling', 30, ['grind-down', 'tap']);
      return duel(me, foe);
    };
    const trainer = chooseTrainerAction(setup(), 1, { profile: 'trainer' });
    const bt = setup();
    assert.equal(bt.active(1).moves[trainer.move].id, 'grind-down');
    for (const profile of ['spire', 'summit']) {
      const b = setup();
      const a = chooseTrainerAction(b, 1, { profile });
      assert.equal(b.active(1).moves[a.move].id, 'tap', profile);
    }
  });

  it('never "finishes" into a guard, a Ward or an immunity', () => {
    const me = mk('creelwight', 30, ['settle']); // Hollow/Rust: immune to Plain and Grit
    me.hp = 1;
    const bt = duel(me, mk('scrapling', 30, ['knuckle', 'tap', 'rust-bite']));
    const a = chooseTrainerAction(bt, 1, { profile: 'summit' });
    assert.equal(bt.active(1).moves[a.move].id, 'rust-bite');
    const guarded = duel(mk('tossup', 30, ['shellguard']), mk('scrapling', 30, ['tap', 'grind-down']), { foeAi: () => ({ type: 'move', move: 0 }) });
    guarded.sides[0].vol.guarding = true;
    guarded.active(0).hp = 1;
    const b = chooseTrainerAction(guarded, 1, { profile: 'spire' });
    assert.equal(b.type, 'move');
  });

  it('the summit heals earlier than a route trainer', () => {
    const setup = () => {
      const v = mk('vesperay', 40, ['tidal-mend', 'tap']);
      v.hp = Math.floor(v.stats.hp * 0.38);
      return { v, bt: duel(mk('tossup', 40, ['settle']), v) };
    };
    const s1 = setup();
    assert.equal(s1.v.moves[chooseTrainerAction(s1.bt, 1, { profile: 'trainer' }).move].id, 'tap');
    const s2 = setup();
    assert.equal(s2.v.moves[chooseTrainerAction(s2.bt, 1, { profile: 'summit' }).move].id, 'tidal-mend');
  });

  it('a wild-brain profile override plays the wild brain', () => {
    const bt = duel(mk('wirewhisk', 30, ['jolt']), mk('sedgehare', 30, ['reap', 'updraft']));
    const a = chooseAction(bt, 1, { profile: 'wild' });
    assert.equal(a.type, 'move');
    assert.equal(bt.active(1).moves[a.move].id, 'reap');
  });
});

describe('simulated battles under every foe profile', () => {
  for (const profile of AI_PROFILES) {
    it(`${profile}: 150 battles, no invariant violations, all legal`, () => {
      const r = simulate({ n: 150, seed: `profile-${profile}`, profile });
      assert.deepEqual(r.violations, [], r.violations.slice(0, 5).join('\n'));
      assert.equal(r.outcomes.draw || 0, 0);
    });
  }
});

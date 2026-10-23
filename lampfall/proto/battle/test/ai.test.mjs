// Trainer and wild AI: always legal, never a 0-PP move, Scrap when dry,
// evasion at most twice per battle, sensible Ward answers.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../../js/core/rng.js';
import { mk, duel, ofType, constRng } from './helpers.mjs';
import { chooseTrainerAction, chooseWildAction, chooseAction, chooseReplacement, isLegal, MAX_EVASION_USES } from '../ai.js';
import { createBattle } from '../engine.js';
import { randomParty } from '../sim.js';

describe('AI legality', () => {
  it('over 300 random battle states, both brains return only legal actions and never a 0-PP move', () => {
    let checked = 0;
    let scraps = 0;
    for (let i = 0; i < 300; i++) {
      const rng = makeRng(`ai-legal-${i}`);
      const kind = rng.pick(['wild', 'trainer']);
      const player = randomParty(rng.fork('p'), { size: rng.int(1, 3) });
      const foe = randomParty(rng.fork('f'), { size: kind === 'wild' ? 1 : rng.int(1, 3) });
      const battle = createBattle({
        sides: [{ party: player, bag: { crackdust: rng.int(0, 1) } }, kind === 'wild' ? { party: foe } : { party: foe, trainer: { name: 'T', items: [{ id: 'tonic', heal: 0.5 }] } }],
        kind, dial: rng.pick(['drift', 'flux', 'freefall']), rng: rng.fork('b'),
      });
      // Randomly drain PP, sometimes every move, and sometimes bleed HP.
      for (const side of battle.sides) {
        const c = battle.active(side.index);
        const drainAll = rng.chance(0.3);
        for (const m of c.moves) if (drainAll || rng.chance(0.4)) m.pp = 0;
        if (rng.chance(0.4)) c.hp = Math.max(1, Math.floor(c.hp * rng.next()));
      }
      for (const side of [0, 1]) {
        const c = battle.active(side);
        const action = side === 1 ? chooseAction(battle, side) : rng.chance(0.5) ? chooseTrainerAction(battle, side) : chooseWildAction(battle, side);
        assert.ok(isLegal(battle, side, action), `seed ${i} side ${side}: ${JSON.stringify(action)}`);
        if (action.type === 'move') assert.ok(c.moves[action.move].pp > 0, `seed ${i}: picked a 0-PP move`);
        if (c.moves.every((m) => m.pp <= 0)) {
          const acts = battle.availableActions(side);
          assert.equal(acts.scrap.available, true);
          if (action.type === 'scrap') scraps++;
          else assert.ok(action.type === 'switch' || action.type === 'item', `seed ${i}: with no PP the AI must Scrap, switch or use an item, got ${action.type}`);
        }
        checked++;
      }
      // And the action actually runs.
      const a0 = chooseTrainerAction(battle, 0);
      const a1 = chooseAction(battle, 1);
      assert.doesNotThrow(() => battle.submit([a0, a1]), `seed ${i}`);
    }
    assert.equal(checked, 600);
    assert.ok(scraps > 10, `Scrap exercised ${scraps} times`);
  });

  it('never picks Run, Read-as-turn on Drift/Flux, or a Lantern as the foe', () => {
    for (let i = 0; i < 60; i++) {
      const rng = makeRng(`ai-foe-${i}`);
      const battle = createBattle({ sides: [{ party: randomParty(rng.fork('p')) }, { party: randomParty(rng.fork('f'), { size: 1 }) }], kind: 'wild', dial: rng.pick(['drift', 'flux']), rng: rng.fork('b') });
      const a = chooseAction(battle, 1);
      assert.ok(['move', 'scrap', 'switch'].includes(a.type), JSON.stringify(a));
    }
  });

  it('chooses a replacement after a faint and prefers the better matchup', () => {
    const a = mk('caldermaw', 60, ['kiln-maw']);
    const f1 = mk('tossup', 5, ['tap'], { nickname: 'first' });
    const bench1 = mk('tossup', 40, ['tap'], { nickname: 'plain' });
    const bench2 = mk('sloshkin', 40, ['undertow'], { nickname: 'brine' }); // Brine is Strong on Kiln/Stone
    const bt = duel(a, [f1, bench1, bench2]);
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'replace');
    const r = chooseReplacement(bt, 1);
    assert.deepEqual(r, { type: 'switch', to: 2 });
    assert.ok(isLegal(bt, 1, r));
    assert.deepEqual(chooseAction(bt, 1), r, 'chooseAction delegates in the replace phase');
  });
});

describe('trainer AI tactics', () => {
  it('uses an evasion move at most twice per battle', () => {
    assert.equal(MAX_EVASION_USES, 2);
    const v = mk('vesperay', 40, ['mirror-step', 'tap']);
    const a = mk('stillox', 40, ['settle']); // 20 PP: enough for the whole loop
    const bt = duel(a, v, { rng: constRng(0.5) });
    let uses = 0;
    for (let t = 0; t < 18 && bt.phase === 'choose'; t++) {
      const act = chooseTrainerAction(bt, 1);
      if (act.type === 'move' && v.moves[act.move].id === 'mirror-step') uses++;
      bt.submit([{ type: 'move', move: 0 }, act]);
    }
    assert.equal(uses, 2);
    assert.equal(v.moves[0].pp, 3);
  });

  it('prefers the Strong hit and switches out of a Blocked matchup when the bench has an answer', () => {
    const p = mk('prismoth', 40, ['dust-veil']);
    const foe1 = mk('tossup', 40, ['tap', 'knuckle'], { nickname: 'walled' });
    const foe2 = mk('caldermaw', 40, ['kiln-maw'], { nickname: 'answer' });
    const bt = duel(p, [foe1, foe2]);
    const act = chooseTrainerAction(bt, 1);
    assert.deepEqual(act, { type: 'switch', to: 1 });
    bt.submit([{ type: 'move', move: 0 }, act]);
    const act2 = chooseTrainerAction(bt, 1);
    assert.equal(act2.type, 'move');
    assert.equal(bt.active(1).moves[act2.move].id, 'kiln-maw');
    const s = mk('sedgehare', 40, ['reap', 'reed-whip', 'spore-drift']);
    const w = mk('wirewhisk', 40, ['jolt']);
    const bt2 = duel(w, s);
    const act3 = chooseTrainerAction(bt2, 1);
    assert.equal(s.moves[act3.move].id, 'reap', 'Moss 70 is Strong on Bolt');
  });

  it('chips a Ward holder it cannot hit directly, heals when low, and never guards twice in a row', () => {
    const p = mk('prismoth', 40, ['dust-veil']);
    const foe = mk('rushling', 40, ['reed-whip', 'spore-drift'], { nickname: 'chipper' });
    const bt = duel(p, foe);
    const act = chooseTrainerAction(bt, 1);
    assert.equal(foe.moves[act.move].id, 'spore-drift');
    const v = mk('vesperay', 40, ['vesper-mend', 'tap', 'shellguard']);
    const a = mk('tossup', 40, ['settle']);
    const bt2 = duel(a, v);
    v.hp = Math.floor(v.stats.hp * 0.2);
    const heal = chooseTrainerAction(bt2, 1);
    assert.equal(v.moves[heal.move].id, 'vesper-mend');
    bt2.submit([{ type: 'move', move: 0 }, heal]);
    const guard = chooseTrainerAction(bt2, 1);
    assert.equal(v.moves[guard.move].id, 'shellguard', 'guards to protect the pending heal');
    bt2.submit([{ type: 'move', move: 0 }, guard]);
    const next = chooseTrainerAction(bt2, 1);
    assert.notEqual(v.moves[next.move].id, 'shellguard', 'no consecutive guard');
  });

  it('uses Crackdust or Plumbline when they are the answer', () => {
    const p = mk('puddlepip', 40, ['salt-spray']); // Glasshide, only Grit/Bolt land
    const foe = mk('tossup', 40, ['tap'], { nickname: 'dust' });
    const bt = duel(p, foe, { trainer: { name: 'T' } });
    bt.sides[1].bag.crackdust = 1;
    const act = chooseTrainerAction(bt, 1);
    assert.deepEqual(act, { type: 'item', item: 'crackdust' });
    const v = mk('vesperay', 40, ['mirror-step']);
    const foe2 = mk('tossup', 40, ['tap', 'plumbline']);
    const bt2 = duel(v, foe2, { rng: constRng(0.5) });
    bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const act2 = chooseTrainerAction(bt2, 1);
    assert.equal(foe2.moves[act2.move].id, 'plumbline');
  });
});

describe('wild AI', () => {
  it('weights damaging moves by expected damage and stays deterministic for a seed', () => {
    const pick = () => {
      const w = mk('sedgehare', 30, ['reap', 'tap', 'updraft'], { rng: makeRng('w') });
      const a = mk('wirewhisk', 30, ['jolt'], { rng: makeRng('a') });
      const bt = duel(a, w, { kind: 'wild', rng: makeRng('wild-ai') });
      return Array.from({ length: 8 }, () => chooseWildAction(bt, 1).move);
    };
    assert.deepEqual(pick(), pick());
    assert.ok(pick().every((i) => i !== 2), 'never the status move while a damaging one is available');
  });

  it('falls back to Scrap when dry', () => {
    const w = mk('tossup', 30, ['tap']);
    w.moves[0].pp = 0;
    const bt = duel(mk('sloshkin', 30, ['tap']), w, { kind: 'wild' });
    assert.deepEqual(chooseWildAction(bt, 1), { type: 'scrap' });
    const evs = bt.submit([{ type: 'move', move: 0 }, chooseWildAction(bt, 1)]);
    assert.ok(ofType(evs, 'scrap-cost').some((e) => e.side === 1));
  });
});

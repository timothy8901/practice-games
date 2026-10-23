// Battle engine rules: legal actions, turn order, accuracy and evasion,
// damage, Wards and the readout, status, Mends, guard, Plumbline, Capture
// Stance, determinism and the architecture API names.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, constRng, seqRng, mk, duel, ofType, slotOf } from './helpers.mjs';
import { createBattle, Battle, BattleError, damageFormula, stageMult, EVASION_MULT, EVASION_CAP, STAB, CRIT_MULT, SCRAP_COST, CHIP, TRAP_TURNS, PLUMBLINE_BLOCK_TURNS, CRACKDUST_TURNS, MAX_TURNS, readCreature, readCard, dossier } from '../engine.js';
import { getMove } from '../moves.js';
import { MENDS_PER_BATTLE } from '../creature.js';

const names = (evs) => evs.map((e) => e.type);

describe('createBattle and the API the architecture names', () => {
  it('createBattle(setup, rng) and createBattle({...setup, rng}) both work; legal()/step() alias availableActions/submit', () => {
    const a = mk('sloshkin', 20, ['tap', 'undertow']);
    const b = mk('tossup', 20, ['tap']);
    const bt = createBattle({ sides: [{ party: [a] }, { party: [b], trainer: { name: 'Rival' } }], kind: 'trainer', dial: 'flux' }, makeRng('api'));
    assert.ok(bt instanceof Battle);
    assert.deepEqual(bt.legal(0), bt.availableActions(0));
    assert.equal(bt.phase, 'choose');
    assert.ok(Array.isArray(bt.intro));
    const st = bt.state();
    assert.equal(st.kind, 'trainer');
    assert.equal(st.sides[0].party[0].maxHp, a.stats.hp);
    assert.equal(st.sides[1].trainer, 'Rival');
    const evs = bt.step([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(evs.length > 0 && evs[0].type === 'turn' && evs[0].n === 1);
    assert.ok(bt.result().turns === 1 && bt.result().ended === false);
  });

  it('step(action) with a single player action lets foeAi fill the foe side', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const b = mk('tossup', 20, ['tap']);
    const bt = duel(a, b, { foeAi: () => ({ type: 'move', move: 0 }) });
    const evs = bt.step({ type: 'move', move: 0 });
    assert.equal(ofType(evs, 'move').length, 2);
  });

  it('validates its inputs', () => {
    const a = mk('sloshkin', 20, ['tap']);
    assert.throws(() => createBattle({ sides: [{ party: [a] }], kind: 'wild', rng: constRng() }), TypeError);
    assert.throws(() => createBattle({ sides: [{ party: [a] }, { party: [a] }], kind: 'duel', rng: constRng() }), RangeError);
    assert.throws(() => createBattle({ sides: [{ party: [a] }, { party: [a] }], kind: 'wild', dial: 'chaos', rng: constRng() }), RangeError);
    assert.throws(() => createBattle({ sides: [{ party: [a] }, { party: [a] }], kind: 'wild' }), TypeError);
    assert.throws(() => createBattle({ sides: [{ party: [] }, { party: [a] }], kind: 'wild', rng: constRng() }), TypeError);
    assert.throws(() => createBattle({ sides: [{ party: [a] }, { party: [a], trainer: { name: 'x' } }], kind: 'wild', rng: constRng() }), RangeError);
    const bt = duel(a, mk('tossup', 5, ['tap']));
    assert.throws(() => bt.submit([{ type: 'dance' }, { type: 'move', move: 0 }]), (e) => e instanceof BattleError && e.code === 'BAD_ACTION');
    assert.throws(() => bt.submit([null, { type: 'move', move: 0 }]), (e) => e.code === 'NO_ACTION');
    assert.throws(() => bt.submit([{ type: 'move', move: 7 }, { type: 'move', move: 0 }]), (e) => e.code === 'BAD_MOVE');
  });
});

describe('legal actions (menu rules, section 9.1)', () => {
  it('a move at 0 PP is unselectable with the reason "No PP left." and the engine refuses it', () => {
    const a = mk('sloshkin', 20, ['tap', 'undertow', 'salt-spray']);
    const b = mk('tossup', 20, ['tap']);
    const bt = duel(a, b);
    let menu = bt.availableActions(0);
    assert.equal(menu.moves.length, 3);
    assert.ok(menu.moves.every((m) => m.selectable && m.reason === null));
    a.moves[1].pp = 0;
    menu = bt.availableActions(0);
    assert.equal(menu.moves[1].selectable, false);
    assert.equal(menu.moves[1].reason, 'No PP left.');
    assert.equal(menu.moves[1].pp, 0);
    assert.ok(menu.moves[0].selectable);
    assert.throws(() => bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]), (e) => e instanceof BattleError && e.code === 'NO_PP');
    assert.equal(bt.turn, 0, 'a refused action does not advance the battle');
  });

  it('Scrap appears only when every move is at 0 PP, is typeless, never misses and costs 1/8 max HP even through a Ward', () => {
    const a = mk('sloshkin', 20, ['tap', 'undertow']);
    const b = mk('prismoth', 20, ['dust-veil']);
    const bt = duel(a, b);
    assert.equal(bt.availableActions(0).scrap.available, false);
    assert.match(bt.availableActions(0).scrap.reason, /every move/);
    assert.throws(() => bt.submit([{ type: 'scrap' }, { type: 'move', move: 0 }]), (e) => e.code === 'SCRAP_UNAVAILABLE');
    a.moves[0].pp = 0;
    a.moves[1].pp = 0;
    const menu = bt.availableActions(0);
    assert.equal(menu.scrap.available, true);
    assert.equal(menu.scrap.cost, Math.floor(a.stats.hp / 8));
    assert.ok(menu.moves.every((m) => !m.selectable));
    const hp = a.hp;
    const evs = bt.submit([{ type: 'scrap' }, { type: 'move', move: 0 }]);
    const mv = ofType(evs, 'move').find((e) => e.side === 0);
    assert.equal(mv.move, 'scrap');
    assert.equal(mv.moveType, null);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'ward'), 'Scrap does not pierce Prism Ward');
    const cost = ofType(evs, 'scrap-cost')[0];
    assert.equal(cost.amount, Math.floor(a.stats.hp * SCRAP_COST));
    assert.ok(a.hp <= hp - cost.amount, 'the HP cost applies even when blocked');
    assert.equal(b.hp, b.stats.hp);
  });

  it('Scrap against an unwarded foe lands as a Neutral typeless hit, so no fight can stall', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const b = mk('creelwight', 20, ['snuff']); // immune to Plain, not to typeless
    a.moves[0].pp = 0;
    const bt = duel(a, b);
    const evs = bt.submit([{ type: 'scrap' }, { type: 'move', move: 0 }]);
    const dmg = ofType(evs, 'damage').find((e) => e.side === 1 && e.source === 'party');
    assert.ok(dmg && dmg.amount > 0);
    assert.equal(ofType(evs, 'effectiveness').find((e) => e.side === 0).word, 'Neutral');
  });

  it('Run is greyed out in trainer battles with the reason, and available in wild battles', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const b = mk('tossup', 20, ['tap']);
    const tr = duel(a, b);
    assert.equal(tr.availableActions(0).run.available, false);
    assert.match(tr.availableActions(0).run.reason, /trainer battle/);
    assert.throws(() => tr.submit([{ type: 'run' }, { type: 'move', move: 0 }]), (e) => e.code === 'NO_RUN');
    const wild = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap']), { kind: 'wild' });
    assert.equal(wild.availableActions(0).run.available, true);
    assert.equal(wild.availableActions(1).run.available, false, 'only the player runs');
    const evs = wild.submit([{ type: 'run' }, { type: 'move', move: 0 }]);
    const run = ofType(evs, 'run')[0];
    assert.ok(run);
    if (run.success) {
      assert.equal(wild.phase, 'ended');
      assert.equal(wild.outcome, 'run');
    }
  });

  it('the menu never comes back empty: something is always selectable', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const b = mk('prismoth', 20, ['dust-veil']);
    a.moves[0].pp = 0;
    const bt = duel(a, b);
    const m = bt.availableActions(0);
    const any = m.moves.some((x) => x.selectable) || m.scrap.available || m.switches.some((x) => x.selectable) || m.run.available;
    assert.ok(any);
  });

  it('switching: the active creature and fainted creatures are not selectable, and a trapped creature cannot switch', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const a2 = mk('tossup', 20, ['tap'], { nickname: 'bench' });
    const a3 = mk('wirewhisk', 20, ['tap'], { nickname: 'down' });
    a3.hp = 0;
    const b = mk('rimeplate', 20, ['sandtrap']);
    const bt = duel([a, a2, a3], b);
    let sw = bt.availableActions(0).switches;
    assert.equal(sw[0].selectable, false);
    assert.match(sw[0].reason, /already out/);
    assert.equal(sw[1].selectable, true);
    assert.equal(sw[2].selectable, false);
    assert.match(sw[2].reason, /fainted/);
    assert.throws(() => bt.submit([{ type: 'switch', to: 2 }, { type: 'move', move: 0 }]), (e) => e.code === 'BAD_SWITCH');
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]); // Sandtrap (85%) hits with constRng(0.5)
    assert.ok(bt.state().sides[0].trapped);
    sw = bt.availableActions(0).switches;
    assert.equal(sw[1].selectable, false);
    assert.match(sw[1].reason, /trapped/);
    assert.throws(() => bt.submit([{ type: 'switch', to: 1 }, { type: 'move', move: 0 }]), (e) => e.code === 'TRAPPED');
  });
});

describe('Read per dial (section 6.4)', () => {
  function setup(dial) {
    const a = mk('tossup', 20, ['tap', 'settle']); // no Shoresense: the free Read is still unused
    const b = mk('prismoth', 20, ['dust-veil']);
    return { a, b, bt: duel(a, b, { dial }) };
  }

  it('Drift and Flux: free, once per foe, reveals the ability with a one-line effect, does not use the turn', () => {
    for (const dial of ['drift', 'flux']) {
      const { bt } = setup(dial);
      const menu = bt.availableActions(0);
      assert.equal(menu.read.available, true);
      assert.equal(menu.read.free, true);
      assert.equal(menu.read.costsTurn, false);
      const evs = bt.read(0);
      const r = ofType(evs, 'read')[0];
      assert.ok(r);
      assert.equal(r.info.ability.name, 'Prism Ward');
      assert.equal(r.info.ability.ward, true);
      assert.ok(r.info.ability.text.length > 10);
      assert.equal(bt.turn, 0, 'Read did not use the turn');
      assert.equal(bt.availableActions(0).read.available, false);
      assert.match(bt.availableActions(0).read.reason, /already been Read/);
      assert.equal(ofType(bt.read(0), 'read').length, 0, 'once per foe');
      assert.throws(() => bt.submit([{ type: 'read' }, { type: 'move', move: 0 }]), (e) => e.code === 'READ_FREE');
      assert.ok(bt.fieldLog.read.has('prismoth'));
    }
  });

  it('Freefall: Read costs the turn and is submitted as the action', () => {
    const { bt, b } = setup('freefall');
    const menu = bt.availableActions(0);
    assert.equal(menu.read.free, false);
    assert.equal(menu.read.costsTurn, true);
    assert.throws(() => bt.read(0), (e) => e.code === 'READ_COSTS_TURN');
    const evs = bt.submit([{ type: 'read' }, { type: 'move', move: 0 }]);
    assert.equal(bt.turn, 1);
    assert.ok(ofType(evs, 'read').some((e) => e.side === 0));
    assert.equal(ofType(evs, 'move').filter((e) => e.side === 0).length, 0, 'the player did not also attack');
    assert.ok(ofType(evs, 'move').some((e) => e.side === 1 && e.move === 'dust-veil'));
    assert.equal(b.moves[0].pp, getMove('dust-veil').pp - 1);
  });

  it('the "Ward ?" badge shows from the start on Drift/Flux and only after the first blocked hit on Freefall', () => {
    assert.equal(setup('drift').bt.state().sides[1].wardBadge, true);
    assert.equal(setup('flux').bt.state().sides[1].wardBadge, true);
    const { bt } = setup('freefall');
    assert.equal(bt.state().sides[1].wardBadge, false);
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].wardBadge, true);
  });

  it('readCreature / readCard / dossier follow the dial table (section 6.2)', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const p = mk('prismoth', 20, ['dust-veil']);
    const t = mk('tossup', 20, ['tap']);
    const info = readCreature(p, 'drift');
    assert.deepEqual(info.types, ['Glass', 'Gust']);
    assert.equal(info.moves, undefined);
    assert.deepEqual(readCreature(p, 'drift', { prism: true }).moves, ['dust-veil']);
    const foe = { party: [p, t], name: 'Keeper', items: [{ id: 'tonic', heal: 0.5 }] };
    assert.equal(readCard(foe, 'drift').roster.length, 2);
    assert.equal(readCard(foe, 'drift').roster[0].ability.name, 'Prism Ward');
    assert.equal(readCard(foe, 'flux').roster[0].ability, null, 'Flux shows abilities only once Read');
    assert.equal(readCard(foe, 'flux', { read: new Set(['prismoth']) }).roster[0].ability.name, 'Prism Ward');
    assert.equal(readCard(foe, 'freefall').roster.length, 1, 'Freefall: lead creature only');
    assert.equal(readCard(foe, 'freefall').pips, null);
    assert.equal(readCard(foe, 'drift').pips[0].wardShimmer, true);
    assert.equal(readCard(foe, 'drift', { read: new Set(['prismoth', 'tossup']) }).autoSkip, true);
    const d = dossier(foe);
    assert.equal(d.healPips, 1);
    assert.match(d.tacticTag, /Ward wall/);
    assert.equal(d.roster.length, 2);
    void a;
  });
});

describe('turn order', () => {
  it('higher priority first, then higher Speed; switches and items go before moves', () => {
    const fast = mk('wirewhisk', 30, ['tap', 'arc-ping']);
    const slow = mk('stillox', 30, ['tap', 'arc-ping']);
    const bt = duel(slow, fast);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    let moves = ofType(evs, 'move');
    assert.equal(moves[0].side, 1, 'Wirewhisk is faster');
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    moves = ofType(evs, 'move');
    assert.equal(moves[0].side, 0, 'Arc Ping (priority 1) goes first from the slower creature');
    const bench = mk('tossup', 30, ['tap']);
    const bt2 = duel([slow, bench], fast);
    evs = bt2.submit([{ type: 'switch', to: 1 }, { type: 'move', move: 0 }]);
    assert.ok(names(evs).indexOf('switch') < names(evs).indexOf('move'));
  });

  it('a Speed-lowering Undertow changes who goes first next turn', () => {
    const a = mk('sloshkin', 30, ['undertow']);
    const b = mk('tossup', 30, ['tap']);
    const bt = duel(a, b);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'move')[0].side, 1, 'Tossup (60 spe) outspeeds Sloshkin (38)');
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.stat === 'spe' && e.stages === -1));
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'move')[0].side, 0, 'after -2 Speed the Tossup is slower');
    assert.equal(stageMult(-2), 0.5);
  });
});

describe('accuracy, evasion cap and Afterimage (section 10)', () => {
  it('evasion multiplies accuracy by x0.83 then x0.67 and caps at +2', () => {
    assert.deepEqual(EVASION_MULT, [1, 0.83, 0.67]);
    assert.equal(EVASION_CAP, 2);
    const a = mk('sloshkin', 40, ['tap', 'settle', 'riptide', 'sure-pinch']);
    const v = mk('vesperay', 40, ['mirror-step', 'tap']);
    const bt = duel(a, v);
    const tap = getMove('tap');
    assert.equal(bt.hitChance(0, tap), 1);
    assert.equal(bt.availableActions(0).moves[0].hitChance, 1);
    bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].stages.eva, 1);
    assert.equal(bt.hitChance(0, tap), 0.83);
    bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.equal(bt.hitChance(0, tap), 0.67);
    const evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    const capped = ofType(evs, 'stat').find((e) => e.side === 1 && e.stat === 'eva');
    assert.equal(capped.result, 'capped');
    assert.match(capped.text, /cap \+2/);
    assert.equal(bt.state().sides[1].stages.eva, 2);
    assert.equal(bt.hitChance(0, tap), 0.67);
    assert.equal(bt.availableActions(0).moves[2].hitChance, 0.85 * 0.67, 'Riptide 85% at +2');
    assert.equal(bt.availableActions(0).moves[3].hitChance, 1, 'Sure Pinch never misses');
    assert.equal(bt.hitChance(0, getMove('plumbline')), 1);
    assert.equal(bt.hitChance(0, getMove('settle')), 1, 'self-targeting moves never miss');
    assert.equal(getMove('mirror-step').pp, 5, 'evasion move PP capped at 5');
  });

  it('a miss against Afterimage pops a decoy instead; Gnash pops one on a hit; sure-hit moves land', () => {
    const a = mk('brinelance', 40, ['tap', 'gnash', 'sure-pinch']);
    const v = mk('vesperay', 40, ['mirror-step', 'settle']);
    const bt = duel(a, v, { rng: constRng(0.5) });
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]); // tap lands (0.5 < 1), then mirror-step... order by speed: Vesperay 80 vs Brinelance 85
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[1].stages.eva, 2);
    bt.rng = constRng(0.9); // chance(0.67) fails -> miss
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 1 }]);
    const pop = ofType(evs, 'decoy-pop')[0];
    assert.ok(pop, 'a decoy pops');
    assert.equal(pop.remaining, 1);
    assert.equal(ofType(evs, 'miss').length, 0);
    assert.equal(bt.state().sides[1].stages.eva, 1);
    bt.rng = constRng(0.5);
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 1 }]); // Gnash hits and pops the last decoy
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'));
    assert.ok(ofType(evs, 'decoy-pop').some((e) => e.remaining === 0));
    assert.equal(bt.state().sides[1].stages.eva, 0);
    bt.submit([{ type: 'move', move: 2 }, { type: 'move', move: 0 }]);
    bt.submit([{ type: 'move', move: 2 }, { type: 'move', move: 0 }]);
    bt.rng = constRng(0.99);
    evs = bt.submit([{ type: 'move', move: 2 }, { type: 'move', move: 1 }]);
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'), 'Sure Pinch lands through +2 evasion');
  });

  it('a plain miss against a creature without decoys is a miss event', () => {
    const a = mk('sloshkin', 40, ['riptide']);
    const b = mk('tossup', 40, ['settle']);
    const bt = duel(a, b, { rng: constRng(0.9) }); // 0.9 >= 0.85
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'miss').length, 1);
    assert.equal(ofType(evs, 'damage').length, 0);
  });

  it('Furnace Jaw: the first Kiln move each battle never misses, later ones can', () => {
    const c = mk('caldermaw', 40, ['kiln-maw', 'shard-fling']);
    const b = mk('tossup', 40, ['tidal-mend']);
    const bt = duel(c, b, { rng: constRng(0.99) });
    bt.sides[1].vol.stages.eva = 2; // hit chance 0.67 < 0.99: an ordinary roll misses
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'ability').some((e) => e.ability === 'Furnace Jaw'));
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'));
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'miss').some((e) => e.side === 0), 'the second Kiln move misses at +2 evasion');
    assert.ok(ofType(evs, 'damage').every((e) => !(e.side === 1 && e.source === 'party')));
  });
});

describe('damage formula', () => {
  const base = { level: 50, power: 100, attack: 100, defense: 100, typeMult: 1, stab: false, crit: false, rand: 1 };

  it('is deterministic and matches the level-scaled formula', () => {
    // base = floor(floor(2*50/5 + 2) * 100 * 100 / 100 / 50) + 2 = 46
    assert.equal(damageFormula(base), 46);
    assert.equal(damageFormula(base), damageFormula({ ...base }));
  });

  it('applies STAB x1.5, crit x1.5, type multiplier, burn x0.5 and the 0.85..1 random factor', () => {
    assert.equal(STAB, 1.5);
    assert.equal(CRIT_MULT, 1.5);
    assert.equal(damageFormula({ ...base, stab: true }), 69);
    assert.equal(damageFormula({ ...base, crit: true }), 69);
    assert.equal(damageFormula({ ...base, stab: true, crit: true }), 103);
    assert.equal(damageFormula({ ...base, typeMult: 2 }), 92);
    assert.equal(damageFormula({ ...base, typeMult: 0.5 }), 23);
    assert.equal(damageFormula({ ...base, typeMult: 4 }), 184);
    assert.equal(damageFormula({ ...base, burned: true }), 23);
    assert.equal(damageFormula({ ...base, rand: 0.85 }), 39);
    assert.equal(damageFormula({ ...base, extra: 1.3 }), 59);
    assert.equal(damageFormula({ ...base, typeMult: 0 }), 0, 'immune = 0');
    assert.equal(damageFormula({ ...base, power: 0 }), 0);
    assert.equal(damageFormula({ ...base, power: 1, attack: 1, defense: 999 }), 2, 'the +2 floor: a landed hit always does something');
    assert.ok(damageFormula({ ...base, power: 1, attack: 1, defense: 999, typeMult: 0.25, rand: 0.85 }) >= 1);
  });

  it('in battle: same seed, same creatures, same events', () => {
    const run = () => {
      const a = mk('sedgehare', 35, ['reap', 'reed-whip', 'spore-drift'], { rng: makeRng('a') });
      const b = mk('rimeplate', 35, ['plate-toss', 'shard-fling', 'stand-firm'], { rng: makeRng('b') });
      const bt = duel(a, b, { rng: makeRng('battle-42') });
      const log = [];
      for (let i = 0; i < 6 && bt.phase === 'choose'; i++) log.push(...bt.submit([{ type: 'move', move: i % 3 }, { type: 'move', move: (i + 1) % 3 }]));
      return JSON.stringify(log);
    };
    assert.equal(run(), run());
  });

  it('in battle: a burned attacker deals about half physical damage; same-type bonus and Heartmark STAB apply', () => {
    const hit = (prep) => {
      const a = mk('mudfist', 40, ['tap', 'undertow'], { rng: makeRng('m') });
      prep(a);
      const b = mk('tossup', 40, ['settle'], { rng: makeRng('t') });
      const bt = duel(a, b, { rng: constRng(0.5) });
      const evs = bt.submit([{ type: 'move', move: a.heartmark === 'undertow' ? 1 : 0 }, { type: 'move', move: 0 }]);
      return ofType(evs, 'damage').find((e) => e.side === 1).amount;
    };
    const plain = hit(() => {});
    const burned = hit((a) => { a.status = { kind: 'burn', turns: 0 }; });
    assert.ok(Math.abs(burned - plain / 2) <= 1, `${burned} vs ${plain}`);
    const noStab = hit((a) => { a.heartmark = 'undertow'; a.heartmarkStab = false; });
    const heartStab = hit((a) => { a.heartmark = 'undertow'; a.heartmarkStab = true; });
    assert.ok(Math.abs(heartStab - noStab * 1.5) <= 1.5, `${heartStab} vs ${noStab}`);
  });

  it('crits: Keen Glint announces the crit at the start of the turn and the hit is x1.5', () => {
    const a = mk('sedgehare', 40, ['reed-whip']);
    const b = mk('tossup', 40, ['settle']);
    const low = duel(a, b, { rng: constRng(0.01) }); // critRoll 0.01 < 1/4 (two stages)
    const evs = low.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'glint').some((e) => e.side === 0));
    assert.equal(ofType(evs, 'crit').length, 1);
    const critDmg = ofType(evs, 'damage').find((e) => e.side === 1).amount;
    const a2 = mk('sedgehare', 40, ['reed-whip']);
    const b2 = mk('tossup', 40, ['settle']);
    const high = duel(a2, b2, { rng: seqRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.01]) });
    void high;
    const plain = duel(mk('sedgehare', 40, ['reed-whip']), mk('tossup', 40, ['settle']), { rng: constRng(0.5) });
    const evs2 = plain.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs2, 'crit').length, 0);
    const plainDmg = ofType(evs2, 'damage').find((e) => e.side === 1).amount;
    // rand differs (0.01 -> 0.8515 vs 0.5 -> 0.925), so compare against the formula ratio loosely
    assert.ok(critDmg > plainDmg * 1.2, `${critDmg} vs ${plainDmg}`);
  });
});

describe('Wards and the readout (section 8)', () => {
  it('Glasshide / Prism Ward: only Strong hits land; the readout lists techniques, types, indirect damage and Crackdust', () => {
    const a = mk('sloshkin', 30, ['tap', 'kiln-maw'], { nickname: 'PUDDLE' });
    const bench = mk('rimeplate', 30, ['plate-toss', 'shard-fling'], { nickname: 'PLATE' });
    bench.moves[0].pp = 0;
    const p = mk('prismoth', 30, ['dust-veil']);
    const bt = duel([a, bench], p, { bag: { crackdust: 1 } });
    const menu = bt.availableActions(0);
    assert.equal(menu.moves[0].word, 'Blocked by Ward');
    assert.equal(menu.moves[0].selectable, true, 'a blocked move is still selectable; the panel warns');
    assert.equal(menu.moves[1].word, 'Strong');
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const blocked = ofType(evs, 'blocked').find((e) => e.side === 0);
    assert.equal(blocked.reason, 'ward');
    assert.equal(blocked.ward, 'Prism Ward');
    assert.equal(blocked.text, 'Prism Ward held. Only Strong hits get through.');
    assert.ok(ofType(evs, 'effectiveness').some((e) => e.side === 0 && e.word === 'Blocked'));
    const ro = ofType(evs, 'ward-readout')[0];
    assert.equal(ro.ward, 'Prism Ward');
    assert.equal(ro.wardKind, 'strong-only');
    assert.deepEqual(ro.canLand.map((e) => [e.creature, e.move]), [['PUDDLE', 'kiln-maw']]);
    assert.deepEqual(ro.outOfPp.map((e) => [e.creature, e.move]), [['PLATE', 'plate-toss']]);
    assert.deepEqual(ro.types, ['Kiln', 'Rime']);
    assert.deepEqual(ro.indirect, ['poison', 'burn', 'trap']);
    assert.equal(ro.crackdust, true);
    assert.deepEqual(ro.targetTypes, ['Glass', 'Gust']);
    assert.match(ro.text, /Can land: PUDDLE's Kiln Maw/);
    assert.match(ro.text, /Types that get through: Kiln, Rime/);
    assert.match(ro.text, /Crackdust/);
    assert.equal(p.hp, p.stats.hp, 'no damage');
    const evs2 = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs2, 'damage').some((e) => e.side === 1 && e.source === 'party'), 'Kiln Maw lands');
    assert.ok(ofType(evs2, 'effectiveness').some((e) => e.side === 0 && e.word === 'Strong'));
  });

  it('the readout says so when nothing in the party lands', () => {
    const a = mk('sloshkin', 30, ['tap', 'salt-spray']);
    const p = mk('puddlepip', 30, ['salt-spray']); // Glasshide, Brine: Strong = Grit, Bolt
    const bt = duel(a, p);
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const ro = ofType(evs, 'ward-readout')[0];
    assert.equal(ro.ward, 'Glasshide');
    assert.deepEqual(ro.canLand, []);
    assert.deepEqual(ro.types, ['Grit', 'Bolt']);
    assert.match(ro.text, /Nothing in your party lands right now/);
  });

  it('Mirrorveil: status techniques fail (Plumbline included); damaging hits land', () => {
    const a = mk('sloshkin', 30, ['scorch', 'tap', 'plumbline']);
    const l = mk('lumenveil', 30, ['settle']);
    const bt = duel(a, l);
    assert.equal(bt.availableActions(0).moves[1].word, 'Neutral');
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'ward' && e.ward === 'Mirrorveil'));
    assert.equal(l.status, null);
    const ro = ofType(evs, 'ward-readout')[0];
    assert.equal(ro.wardKind, 'no-status');
    assert.ok(ro.canLand.some((e) => e.move === 'tap'));
    evs = bt.submit([{ type: 'move', move: 2 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'ward'));
    assert.ok(bt.state().sides[1].stages.def > 0, 'Settle boosts stayed: Plumbline failed');
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'));
  });

  it('Stillcoat: hits under 50 power do nothing; 50 and up land', () => {
    const a = mk('scrapling', 30, ['tap', 'shadowbox', 'knuckle']);
    const c = mk('chillnub', 30, ['settle']);
    const bt = duel(a, c);
    assert.equal(bt.availableActions(0).moves[0].word, 'Blocked by Ward');
    assert.equal(bt.availableActions(0).moves[1].word, 'Neutral');
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.ward === 'Stillcoat'));
    assert.match(ofType(evs, 'blocked').find((e) => e.ward === 'Stillcoat').text, /under 50 power/);
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'), 'Shadowbox (50) lands');
    evs = bt.submit([{ type: 'move', move: 2 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'), 'Knuckle (60) lands');
  });

  it('type immunity is "No effect", separate from a Ward', () => {
    const a = mk('scrapling', 30, ['knuckle', 'shadowbox']);
    const c = mk('creelwight', 30, ['settle']);
    const bt = duel(a, c);
    const menu = bt.availableActions(0);
    assert.equal(menu.moves[0].word, 'No effect');
    assert.equal(menu.moves[0].mult, 0);
    assert.equal(menu.moves[1].word, 'Weak', 'Hollow x1 on Hollow, x0.5 on Rust');
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'immune'));
    assert.equal(ofType(evs, 'ward-readout').length, 0);
  });

  it('indirect damage gets through: poison chips a Prism Ward holder', () => {
    const a = mk('sloshkin', 30, ['corrode']);
    const p = mk('prismoth', 30, ['settle']);
    const bt = duel(a, p);
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'status').some((e) => e.side === 1 && e.kind === 'poison' && e.action === 'inflict'));
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'status'));
    assert.ok(p.hp < p.stats.hp);
  });

  it('Crackdust suppresses the Ward for 3 full turns, then it returns', () => {
    const a = mk('sloshkin', 30, ['tap']);
    const p = mk('prismoth', 30, ['settle']);
    const bt = duel(a, p, { bag: { crackdust: 1 } });
    const item = bt.availableActions(0).items.find((it) => it.id === 'crackdust');
    assert.ok(item && item.selectable);
    let evs = bt.submit([{ type: 'item', item: 'crackdust' }, { type: 'move', move: 0 }]);
    const sup = ofType(evs, 'ward-suppressed')[0];
    assert.equal(sup.turns, CRACKDUST_TURNS);
    assert.equal(bt.availableActions(0).moves[0].word, 'Neutral', 'the panel now shows the hit lands');
    assert.equal(bt.availableActions(0).items.length, 0, 'the single Crackdust is spent');
    for (let i = 0; i < CRACKDUST_TURNS; i++) {
      evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'), `turn ${i + 2} lands`);
    }
    assert.ok(evs.some((e) => e.type === 'message' && /Ward returns/.test(e.text)));
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.reason === 'ward'), 'blocked again');
  });

  it('Crackdust is unselectable against a creature without a Ward', () => {
    const bt = duel(mk('sloshkin', 30, ['tap']), mk('tossup', 30, ['tap']), { bag: { crackdust: 2 } });
    const item = bt.availableActions(0).items.find((it) => it.id === 'crackdust');
    assert.equal(item.selectable, false);
    assert.match(item.reason, /no Ward/);
  });
});

describe('status ticks', () => {
  it('burn chips 1/16, poison 1/8 of max HP each end of turn', () => {
    for (const [move, kind] of [['scorch', 'burn'], ['corrode', 'poison']]) {
      const a = mk('sloshkin', 40, [move]);
      const b = mk('tossup', 40, ['settle']);
      const bt = duel(a, b);
      const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      assert.ok(ofType(evs, 'status').some((e) => e.side === 1 && e.kind === kind && e.action === 'inflict'));
      const tick = ofType(evs, 'damage').find((e) => e.side === 1 && e.source === 'status');
      assert.equal(tick.amount, Math.max(1, Math.floor(b.stats.hp * CHIP[kind])));
      assert.equal(b.status.kind, kind);
      const evs2 = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      assert.ok(ofType(evs2, 'status').some((e) => e.action === 'already'), 'one condition at a time');
    }
  });

  it('trap chips 1/8 for 4 turns, stops switching, then frees the target', () => {
    const a = mk('rimeplate', 40, ['sandtrap']);
    const b = mk('tossup', 40, ['settle']);
    const b2 = mk('tossup', 40, ['settle']);
    const bt = duel(a, [b, b2]);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'status').some((e) => e.kind === 'trap' && e.action === 'inflict' && e.turns === TRAP_TURNS));
    assert.equal(bt.availableActions(1).switches[1].selectable, false);
    let ticks = ofType(evs, 'damage').filter((e) => e.side === 1 && e.source === 'status').length;
    for (let i = 1; i < TRAP_TURNS; i++) {
      evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      ticks += ofType(evs, 'damage').filter((e) => e.side === 1 && e.source === 'status').length;
    }
    assert.equal(ticks, TRAP_TURNS);
    assert.ok(ofType(evs, 'status').some((e) => e.kind === 'trap' && e.action === 'cure'));
    assert.equal(bt.state().sides[1].trapped, false);
    assert.equal(bt.availableActions(1).switches[1].selectable, true);
  });

  it('numb halves Speed; chill wears off; a Kiln hit thaws a chilled target; type immunities to status hold', () => {
    const a = mk('wirewhisk', 40, ['static-net', 'rime-lock', 'ember-lick']);
    const b = mk('tossup', 40, ['settle']);
    const bt = duel(a, b);
    const spe = bt.effStat(1, 'spe');
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(b.status.kind, 'numb');
    assert.equal(bt.effStat(1, 'spe'), Math.floor(spe / 2));
    b.status = null;
    const evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'status').some((e) => e.kind === 'chill' && e.action === 'inflict'));
    b.status = { kind: 'chill', turns: 5 };
    const evs2 = bt.submit([{ type: 'move', move: 2 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs2, 'status').some((e) => e.kind === 'chill' && e.action === 'cure'));
    assert.equal(b.status, null);
    const k = duel(mk('sloshkin', 40, ['scorch']), mk('caldermaw', 40, ['settle']));
    const evs3 = k.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs3, 'status').some((e) => e.kind === 'burn' && e.action === 'immune'), 'Kiln types cannot be burned');
  });

  it('a chilled or numbed creature may lose its turn; a flinched one does', () => {
    const a = mk('brinelance', 40, ['gnash']);
    const b = mk('tossup', 40, ['tap']);
    const bt = duel(a, b, { rng: constRng(0.1) }); // flinch chance 0.3: 0.1 < 0.3 flinches
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'status').some((e) => e.side === 1 && e.kind === 'flinch'));
    assert.equal(ofType(evs, 'move').filter((e) => e.side === 1).length, 0);
  });
});

describe('Mends budget, guard and recovery (section 10.1)', () => {
  it('each recovery use spends one of 3 Mends; at 0 Mends recovery fails', () => {
    const a = mk('sloshkin', 40, ['tidal-mend']);
    const b = mk('tossup', 40, ['settle']);
    const bt = duel(a, b);
    assert.equal(a.mends, MENDS_PER_BATTLE);
    for (let i = 1; i <= 3; i++) {
      a.hp = 1;
      const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      const spent = ofType(evs, 'mend-spent')[0];
      assert.equal(spent.remaining, 3 - i);
      const heal = ofType(evs, 'heal').find((e) => e.side === 0);
      assert.equal(heal.amount, Math.floor(a.stats.hp * 0.5));
      assert.equal(a.hp, 1 + Math.floor(a.stats.hp * 0.5));
    }
    a.hp = 1;
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'no-mends'));
    assert.equal(ofType(evs, 'heal').filter((e) => e.side === 0).length, 0);
    assert.equal(a.hp, 1);
    assert.equal(a.mends, 0);
    assert.equal(bt.state().sides[0].party[0].mends, 0);
  });

  it('recovery at full HP fails without spending a Mend', () => {
    const a = mk('sloshkin', 40, ['tidal-mend']);
    const bt = duel(a, mk('tossup', 40, ['settle']));
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.reason === 'hp-full'));
    assert.equal(a.mends, 3);
  });

  it('Vesper Mend: the panel brightens on turn 1 and heals 50% at the end of turn 2; a Hollow hit in between cancels it, Mend spent either way', () => {
    const v = mk('vesperay', 40, ['vesper-mend']);
    const a = mk('scrapling', 40, ['settle', 'shadowbox']);
    const bt = duel(a, v);
    v.hp = 10;
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'mend-pending').some((e) => e.side === 1));
    assert.equal(ofType(evs, 'heal').filter((e) => e.side === 1).length, 0, 'no heal on turn 1');
    assert.equal(bt.state().sides[1].pendingHeal, 1);
    assert.equal(v.mends, 2);
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]); // a second Vesper Mend while one is pending fails without spending a Mend
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 1 && e.reason === 'heal-pending'));
    const heal = ofType(evs, 'heal').find((e) => e.side === 1);
    assert.ok(heal, 'heals at the end of turn 2');
    assert.equal(heal.amount, Math.floor(v.stats.hp * 0.5));
    assert.equal(v.mends, 2, 'only one Mend spent');
    assert.equal(bt.state().sides[1].pendingHeal, null);
    // Cancel case
    const v2 = mk('vesperay', 40, ['vesper-mend']);
    const a2 = mk('scrapling', 40, ['shadowbox']);
    const bt2 = duel(a2, v2);
    v2.hp = 10;
    evs = bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const cancelled = ofType(evs, 'mend-cancelled').some((e) => e.side === 1);
    const pending = ofType(evs, 'mend-pending').some((e) => e.side === 1);
    assert.ok(pending);
    if (!cancelled) {
      // Vesperay moved after Scrapling on turn 1; the Hollow hit on turn 2 cancels before the end-of-turn heal
      const evs2 = bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
      assert.ok(ofType(evs2, 'mend-cancelled').some((e) => e.side === 1));
      assert.equal(ofType(evs2, 'heal').filter((e) => e.side === 1 && e.source === 'vesper-mend').length, 0);
    }
    assert.ok(v2.mends < 3, 'the Mend is spent either way');
  });

  it('guard blocks the foe\'s technique and fails on consecutive turns', () => {
    const a = mk('sloshkin', 40, ['shellguard']);
    const b = mk('tossup', 40, ['tap']);
    const bt = duel(a, b);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'guard').some((e) => e.side === 0));
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 1 && e.reason === 'guard'));
    assert.equal(a.hp, a.stats.hp);
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.side === 0 && e.reason === 'consecutive-guard'));
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 0 && e.source === 'party'), 'the tap lands');
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'guard').some((e) => e.side === 0), 'works again after a gap');
  });
});

describe('Plumbline and Snuff (section 10.2)', () => {
  it('Plumbline always hits, clears the target\'s stat stages and blocks re-boosting for 2 turns', () => {
    assert.equal(PLUMBLINE_BLOCK_TURNS, 2);
    const a = mk('sloshkin', 40, ['plumbline', 'settle']);
    const v = mk('vesperay', 40, ['mirror-step', 'updraft', 'lens-focus']);
    const bt = duel(a, v, { rng: constRng(0.99) });
    bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 1 }]);
    assert.equal(bt.state().sides[1].stages.eva, 1);
    assert.equal(bt.state().sides[1].stages.spe, 2);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 2 }]);
    const clear = ofType(evs, 'stat').find((e) => e.side === 1 && e.result === 'cleared');
    assert.ok(clear, 'Plumbline landed through +1 evasion with a 0.99 roll');
    assert.deepEqual(bt.state().sides[1].stages, { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, eva: 0 });
    assert.equal(bt.state().sides[1].boostBlocked, true);
    for (let i = 0; i < PLUMBLINE_BLOCK_TURNS; i++) {
      evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
      const blocked = ofType(evs, 'stat').find((e) => e.side === 1 && e.result === 'blocked');
      assert.ok(blocked && blocked.reason === 'plumbline', `turn ${i + 1} after Plumbline is blocked`);
      assert.equal(bt.state().sides[1].stages.eva, 0);
    }
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.stat === 'eva' && e.result === 'raised'), 'the lock lifts after 2 turns');
    assert.equal(bt.state().sides[1].boostBlocked, false);
  });

  it('Snuff removes only raised stages', () => {
    const a = mk('creelwight', 40, ['snuff']);
    const b = mk('tossup', 40, ['updraft', 'sand-smother']);
    const bt = duel(a, b);
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]); // Tossup +2 spe, Snuff clears it (order: Tossup first)
    b.moves[1].pp = 10;
    const st0 = bt.state().sides[1].stages;
    assert.equal(st0.spe, 0);
    bt.sides[1].vol.stages.atk = -1;
    bt.sides[1].vol.stages.spe = 2;
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 1 }]);
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.result === 'cleared-raised'));
    assert.equal(bt.state().sides[1].stages.spe, 0);
    assert.equal(bt.state().sides[1].stages.atk, -1, 'drops stay');
  });

  it('stat stages cap at +6/-6 and Sure Footing blocks foreign drops', () => {
    const a = mk('sloshkin', 40, ['stand-firm', 'sand-smother']);
    const b = mk('tossup', 40, ['settle']);
    b.ability = 'sure-footing';
    const bt = duel(a, b);
    for (let i = 0; i < 3; i++) bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.state().sides[0].stages.def, 6);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 0 && e.result === 'capped'));
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'stat').some((e) => e.side === 1 && e.result === 'blocked' && e.reason === 'sure-footing'));
  });
});

describe('charge moves, multi-hit, drain, self-KO, Unfixed', () => {
  it('Bedrock Charge braces one turn (menu locked) then hits; Sodden blocks Hullburst', () => {
    const s = mk('stillox', 40, ['bedrock-charge', 'tap']);
    const b = mk('tossup', 40, ['settle']);
    const bt = duel(s, b);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'charge').some((e) => e.side === 0));
    assert.equal(ofType(evs, 'damage').length, 0);
    const menu = bt.availableActions(0);
    assert.ok(menu.locked && menu.locked.move === 0);
    assert.equal(bt.state().sides[0].charging, 'bedrock-charge');
    evs = bt.submit([{ type: 'move', move: 1 }, { type: 'move', move: 0 }]); // whatever is submitted, the braced move fires
    assert.ok(ofType(evs, 'move').some((e) => e.side === 0 && e.move === 'bedrock-charge'));
    assert.ok(ofType(evs, 'damage').some((e) => e.side === 1 && e.source === 'party'));
    assert.equal(s.moves[0].pp, getMove('bedrock-charge').pp - 1, 'PP is spent once');
    const h = mk('creelwight', 40, ['hullburst']);
    const w = mk('bilgebob', 40, ['settle']);
    const bt2 = duel(h, w);
    evs = bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'blocked').some((e) => e.reason === 'sodden'));
    assert.equal(h.hp, h.stats.hp);
    const bt3 = duel(mk('creelwight', 40, ['hullburst']), mk('tossup', 40, ['settle']));
    evs = bt3.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'faint').some((e) => e.side === 0), 'the user faints');
  });

  it('Pummel hits 2-5 times; Echo Drain heals half the damage without spending a Mend', () => {
    const a = mk('scrapling', 40, ['pummel']);
    const b = mk('stillox', 40, ['settle']);
    const bt = duel(a, b, { rng: constRng(0.5) });
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const hits = ofType(evs, 'damage').filter((e) => e.side === 1 && e.source === 'party').length;
    assert.ok(hits >= 2 && hits <= 5, `${hits} hits`);
    assert.ok(evs.some((e) => e.type === 'message' && /Hit \d time/.test(e.text)));
    const c = mk('creelwight', 40, ['echo-drain']);
    const d = mk('stillox', 40, ['settle']);
    const bt2 = duel(c, d);
    c.hp = 1;
    const evs2 = bt2.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    const dmg = ofType(evs2, 'damage').find((e) => e.side === 1 && e.source === 'party').amount;
    const heal = ofType(evs2, 'heal').find((e) => e.side === 0);
    assert.equal(heal.amount, Math.max(1, Math.floor(dmg / 2)));
    assert.equal(c.mends, 3);
  });

  it('Unfixed cycles Vagary\'s type at the end of each turn and Tailfall takes the next type in the queue', () => {
    const v = mk('vagary', 50, ['tailfall'], { rng: makeRng('comet') });
    const b = mk('stillox', 90, ['settle']); // tanky enough to take four Tailfalls
    const bt = duel(v, b);
    assert.deepEqual(bt.active(0).types, ['Star']);
    const menu = bt.availableActions(0);
    assert.equal(menu.moves[0].type, v.typeQueue[1], 'the panel shows next turn\'s type');
    const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(ofType(evs, 'move').find((e) => e.side === 0).moveType, v.typeQueue[1]);
    const shift = ofType(evs, 'type-shift')[0];
    assert.equal(shift.current, v.typeQueue[1]);
    assert.deepEqual(shift.next, [v.typeQueue[2], v.typeQueue[3]]);
    assert.deepEqual(v.types, [v.typeQueue[1]]);
    for (let i = 0; i < 3; i++) bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.deepEqual(v.types, ['Star'], 'back to Star after the three shards');
  });
});

describe('first-hit abilities', () => {
  it('Featherbed halves the first contact hit; Empty Weave the first non-Strong hit; Plateshed makes the first Strong hit neutral', () => {
    const dmgOf = (attackerMoves, defenderId, defenderAbility) => {
      const a = mk('scrapling', 40, attackerMoves, { rng: makeRng('a') });
      const d = mk(defenderId, 80, ['tidal-mend'], { rng: makeRng('d') }); // Lv80 so no hit is clamped by a KO; Tidal Mend at full HP is a harmless foe action
      if (defenderAbility) d.ability = defenderAbility;
      const bt = duel(a, d, { rng: constRng(0.5) });
      const out = [];
      for (let i = 0; i < 2; i++) {
        const evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
        out.push({ dmg: ofType(evs, 'damage').find((e) => e.side === 1 && e.source === 'party').amount, ab: ofType(evs, 'ability').map((e) => e.ability) });
      }
      return out;
    };
    const fb = dmgOf(['knuckle'], 'skeinwing');
    assert.ok(fb[0].ab.includes('Featherbed'));
    assert.ok(Math.abs(fb[0].dmg * 2 - fb[1].dmg) <= 2, `${fb[0].dmg} vs ${fb[1].dmg}`);
    const ew = dmgOf(['shadowbox'], 'creelwight');
    assert.ok(ew[0].ab.includes('Empty Weave'));
    assert.ok(Math.abs(ew[0].dmg * 2 - ew[1].dmg) <= 2);
    const ps = dmgOf(['shadowbox'], 'rimeplate'); // Hollow vs Rime/Stone is Strong
    assert.ok(ps[0].ab.includes('Plateshed'));
    assert.ok(Math.abs(ps[0].dmg * 2 - ps[1].dmg) <= 2);
  });

  it('Last Ebb boosts Brine and Hollow moves under 25% HP; Shoresense Reads on send-in; Tailhum reveals a move', () => {
    const a = mk('brinelance', 40, ['gnash']);
    const b = mk('stillox', 40, ['tidal-mend']);
    const bt = duel(a, b);
    const full = ofType(bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]), 'damage').find((e) => e.side === 1).amount;
    a.hp = 1;
    const low = ofType(bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]), 'damage').find((e) => e.side === 1).amount;
    assert.ok(Math.abs(low - full * 1.3) <= 2, `${low} vs ${full}`);
    const s = duel(mk('sloshkin', 20, ['tap']), mk('prismoth', 20, ['dust-veil']));
    assert.ok(ofType(s.intro, 'read').some((e) => e.source === 'Shoresense'));
    assert.equal(s.availableActions(0).read.available, false, 'Shoresense used the one Read');
    const w = duel(mk('wirewhisk', 20, ['tap']), mk('prismoth', 20, ['dust-veil', 'tap']));
    const rev = ofType(w.intro, 'reveal').find((e) => e.source === 'Tailhum');
    assert.deepEqual(rev.moves, ['dust-veil']);
  });
});

describe('fainting, replacement and the end of a battle', () => {
  it('a fainted side must send in a replacement before the next turn; the battle ends when a side is out', () => {
    const a = mk('caldermaw', 60, ['kiln-maw']);
    const b1 = mk('tossup', 5, ['tap'], { nickname: 'one' });
    const b2 = mk('tossup', 5, ['tap'], { nickname: 'two' });
    const bt = duel(a, [b1, b2]);
    let evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.ok(ofType(evs, 'faint').some((e) => e.side === 1));
    assert.equal(bt.phase, 'replace');
    assert.deepEqual(bt.pendingReplace, [1]);
    assert.ok(ofType(evs, 'replace-needed').some((e) => e.side === 1));
    const menu = bt.availableActions(1);
    assert.equal(menu.moves.length, 0);
    assert.equal(menu.switches[1].selectable, true);
    assert.throws(() => bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]), (e) => e.code === 'NEED_REPLACEMENT');
    evs = bt.submit([undefined, { type: 'switch', to: 1 }]);
    assert.ok(ofType(evs, 'switch').some((e) => e.to === 'two'));
    assert.equal(bt.phase, 'choose');
    assert.equal(bt.turn, 1, 'replacing does not spend a turn');
    evs = bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'ended');
    assert.equal(bt.outcome, 'win');
    assert.equal(bt.winner, 0);
    assert.ok(ofType(evs, 'end').length === 1);
    assert.throws(() => bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]), (e) => e.code === 'ENDED');
    assert.equal(bt.availableActions(0).moves.length, 0);
  });

  it('a draw is declared at MAX_TURNS so nothing can run forever', () => {
    assert.equal(MAX_TURNS, 200);
    const a = mk('sloshkin', 40, ['settle']);
    const b = mk('tossup', 40, ['settle']);
    const bt = duel(a, b);
    bt.turn = MAX_TURNS - 1;
    bt.submit([{ type: 'move', move: 0 }, { type: 'move', move: 0 }]);
    assert.equal(bt.phase, 'ended');
    assert.equal(bt.outcome, 'draw');
  });
});

describe('state snapshot', () => {
  it('is plain JSON with HP, stages, PP, Ward badges, stance and turn', () => {
    const a = mk('sloshkin', 20, ['tap']);
    const p = mk('prismoth', 20, ['dust-veil']);
    const bt = duel(a, p, { kind: 'wild', captureStance: true });
    const st = JSON.parse(JSON.stringify(bt.state()));
    assert.equal(st.captureStance, true);
    assert.equal(st.turn, 0);
    assert.equal(st.phase, 'choose');
    assert.equal(st.sides[1].wardBadge, true);
    assert.deepEqual(st.sides[0].stages, { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, eva: 0 });
    assert.deepEqual(st.sides[0].party[0].moves, [{ id: 'tap', pp: 35, maxPp: 35 }]);
    assert.equal(st.sides[0].party[0].mends, 3);
  });
});

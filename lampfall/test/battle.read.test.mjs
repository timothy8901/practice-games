// js/battle/read.js: the in-battle Read result, the pre-battle Read card per dial (rules table,
// overridable) and the dossier. Run: node --test test/battle.read.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCreature, readCard, dossier, inferTacticTag, READ_CARD_RULES, readRulesFor } from '../js/battle/read.js';
import { createBattleData } from '../js/battle/data.js';
import { mk, DATA } from './fixtures/battle/helpers.mjs';

const p = () => mk('prismoth', 20, ['dust-veil']);
const t = () => mk('tossup', 20, ['tap']);
const foe = () => ({ party: [p(), t()], name: 'Keeper', items: [{ id: 'tonic', heal: 0.5 }, { id: 'charm' }] });

describe('readCreature', () => {
  it('always reveals the ability with its one-line effect; the dial sets the cost', () => {
    const info = readCreature(p(), 'drift', DATA);
    assert.equal(info.speciesId, 'prismoth');
    assert.equal(info.species, 'Prismoth');
    assert.deepEqual(info.types, ['Glass', 'Gust']);
    assert.deepEqual(info.ability, { id: 'prism-ward', name: 'Prism Ward', text: info.ability.text, ward: true });
    assert.ok(info.ability.text.length > 10);
    assert.equal(info.costsTurn, false);
    assert.equal(readCreature(p(), 'freefall', DATA).costsTurn, true);
    assert.equal(readCreature(p(), 'drift', DATA, { costsTurn: true }).costsTurn, true, 'the engine passes its live rule');
    assert.equal(info.moves, undefined);
  });

  it('the Scouting Prism adds moves, held item and Mends', () => {
    const c = p();
    c.heldItem = 'shell-bell';
    const info = readCreature(c, 'flux', DATA, { prism: true });
    assert.deepEqual(info.moves, ['dust-veil']);
    assert.equal(info.heldItem, 'shell-bell');
    assert.equal(info.mends, c.mends);
  });

  it('accepts raw data, a BattleData view, and throws for unknown ids', () => {
    const v = createBattleData(DATA);
    assert.deepEqual(readCreature(p(), 'drift', v), readCreature(p(), 'drift', DATA));
    const c = p();
    c.ability = 'nope';
    assert.throws(() => readCreature(c, 'drift', DATA), RangeError);
  });
});

describe('readCard (rules 6.2)', () => {
  it('Drift shows everything, Flux abilities only once Read, Freefall the lead only with no pips', () => {
    const f = foe();
    assert.equal(readCard(f, 'drift', DATA).roster.length, 2);
    assert.equal(readCard(f, 'drift', DATA).roster[0].ability.name, 'Prism Ward');
    assert.equal(readCard(f, 'flux', DATA).roster[0].ability, null);
    assert.equal(readCard(f, 'flux', DATA, { read: new Set(['prismoth']) }).roster[0].ability.name, 'Prism Ward');
    assert.equal(readCard(f, 'flux', DATA, { read: new Set(['prismoth']) }).roster[1].ability, null);
    const ff = readCard(f, 'freefall', DATA);
    assert.equal(ff.roster.length, 1);
    assert.equal(ff.pips, null);
    assert.equal(ff.roster[0].ability, null);
    assert.equal(ff.roster[0].wardShimmer, false);
    const d = readCard(f, 'drift', DATA);
    assert.deepEqual(d.pips, [{ wardShimmer: true }, { wardShimmer: false }]);
    assert.equal(d.roster[0].wardShimmer, true);
    assert.equal(d.healPips, null, 'heal pips only with the Prism');
    assert.equal(d.dial, 'drift');
  });

  it('autoSkip when every foe species is already Read; the Prism adds moves, held items and heal pips', () => {
    const f = foe();
    assert.equal(readCard(f, 'drift', DATA, { read: new Set(['prismoth', 'tossup']) }).autoSkip, true);
    assert.equal(readCard(f, 'drift', DATA, { read: new Set(['prismoth']) }).autoSkip, false);
    const prism = readCard(f, 'flux', DATA, undefined, { prism: true });
    assert.deepEqual(prism.roster[0].moves, ['dust-veil']);
    assert.equal(prism.roster[0].heldItem, null);
    assert.equal(prism.healPips, 1);
  });

  it('per-dial rules are a table any call may override', () => {
    assert.ok(Object.isFrozen(READ_CARD_RULES) && Object.isFrozen(READ_CARD_RULES.drift));
    const f = foe();
    const card = readCard(f, 'freefall', DATA, undefined, { rules: { roster: 'all', pips: true } });
    assert.equal(card.roster.length, 2);
    assert.equal(card.pips.length, 2);
    assert.equal(readCard(f, 'drift', DATA, undefined, { rules: { ability: 'never' } }).roster[0].ability, null);
    assert.deepEqual(readRulesFor('drift'), { ...READ_CARD_RULES.drift });
    assert.throws(() => readRulesFor('chaos'), RangeError);
    assert.equal(readRulesFor('chaos', { roster: 'lead' }).roster, 'lead', 'an unknown dial needs an override');
  });
});

describe('dossier', () => {
  it('posts the full roster with abilities, heal pips and a tactic tag', () => {
    const d = dossier(foe(), DATA);
    assert.equal(d.name, 'Keeper');
    assert.equal(d.title, null);
    assert.equal(d.roster.length, 2);
    assert.equal(d.roster[0].ability.ward, true);
    assert.equal(d.healPips, 1);
    assert.match(d.tacticTag, /Ward wall/);
    assert.equal(dossier({ ...foe(), tacticTag: 'stall', title: 'Spire Keeper' }, DATA).tacticTag, 'stall');
    assert.equal(dossier({ ...foe(), title: 'Spire Keeper' }, DATA).title, 'Spire Keeper');
  });

  it('inferTacticTag names evasion, recovery, Wards, chip and crits, or "straight fight"', () => {
    assert.equal(inferTacticTag([t()], DATA), 'straight fight');
    assert.equal(inferTacticTag([mk('vesperay', 30, ['mirror-step', 'vesper-mend'])], DATA), 'evasion + recovery');
    assert.equal(inferTacticTag([mk('vesperay', 30, ['mirror-step'])], DATA), 'evasion');
    assert.equal(inferTacticTag([mk('sloshkin', 30, ['tidal-mend'])], DATA), 'recovery');
    assert.equal(inferTacticTag([mk('rushling', 30, ['spore-drift'])], DATA), 'chip');
    assert.equal(inferTacticTag([mk('sedgehare', 30, ['tap'])], DATA), 'crits', 'a glint ability counts');
    assert.equal(inferTacticTag([mk('tossup', 30, ['reap'])], DATA), 'crits', 'a high-crit move counts');
    assert.equal(inferTacticTag([p(), mk('rushling', 30, ['spore-drift'])], DATA), 'Ward wall, chip');
  });
});

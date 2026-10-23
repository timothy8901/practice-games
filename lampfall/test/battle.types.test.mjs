// Type chart and effectiveness words (palette tests stay with the art lane). Run: node --test test/battle.types.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTypeChart, wordFor, strongTypesAgainst as strongOf, immuneTypesOf as immuneOf } from '../js/battle/effects.js';
import { TYPE_DATA } from './fixtures/battle/data.mjs';

// The chart now comes in as data; these names bind the ported assertions to js/battle's chart helpers.
const chart = createTypeChart(TYPE_DATA.chart, TYPE_DATA.ordinary);
const TYPES = chart.types;
const ORDINARY_TYPES = chart.ordinary;
const TYPE_CHART = TYPE_DATA.chart;
const chartMult = chart.mult;
const effectiveness = chart.effectiveness;
const strongTypesAgainst = (types) => strongOf(chart, types);
const immuneTypesOf = (types) => immuneOf(chart, types);

describe('type chart', () => {
  it('has 12 ordinary types plus Star', () => {
    assert.equal(TYPES.length, 13);
    assert.equal(ORDINARY_TYPES.length, 12);
    assert.equal(TYPES[12], 'Star');
  });

  it('is a full 13x13 table of 0 / 0.5 / 1 / 2', () => {
    for (const a of TYPES) {
      assert.ok(TYPE_CHART[a], `row ${a}`);
      for (const d of TYPES) assert.ok([0, 0.5, 1, 2].includes(TYPE_CHART[a][d]), `${a} vs ${d}`);
      assert.equal(Object.keys(TYPE_CHART[a]).length, 13);
    }
  });

  it('has exactly 56 non-neutral pairings and one immunity (Hollow vs Plain and Grit)', () => {
    let nonNeutral = 0;
    const immune = [];
    for (const a of TYPES) for (const d of TYPES) {
      const v = TYPE_CHART[a][d];
      if (v !== 1) nonNeutral++;
      if (v === 0) immune.push(`${a}>${d}`);
    }
    assert.equal(nonNeutral, 56);
    assert.deepEqual(immune.sort(), ['Grit>Hollow', 'Plain>Hollow']);
  });

  it('matches the doc rows for a few spot values', () => {
    assert.equal(chartMult('Grit', 'Plain'), 2);
    assert.equal(chartMult('Kiln', 'Hollow'), 2);
    assert.equal(chartMult('Plain', 'Stone'), 0.5);
    assert.equal(chartMult('Hollow', 'Glass'), 2);
    assert.equal(chartMult('Rust', 'Rime'), 0.5);
  });

  it('keeps Star neutral both ways', () => {
    for (const t of TYPES) {
      assert.equal(chartMult('Star', t), 1);
      assert.equal(chartMult(t, 'Star'), 1);
    }
  });

  it('every type takes double from 2 or 3 types (Star from none)', () => {
    for (const d of ORDINARY_TYPES) {
      const n = ORDINARY_TYPES.filter((a) => TYPE_CHART[a][d] === 2).length;
      assert.ok(n >= 2 && n <= 3, `${d} takes double from ${n}`);
    }
    assert.equal(strongTypesAgainst(['Star']).length, 0);
  });
});

describe('effectiveness()', () => {
  it('returns the four words', () => {
    assert.deepEqual(effectiveness('Grit', ['Plain']), { mult: 2, word: 'Strong' });
    assert.deepEqual(effectiveness('Plain', ['Plain']), { mult: 1, word: 'Neutral' });
    assert.deepEqual(effectiveness('Plain', ['Stone']), { mult: 0.5, word: 'Weak' });
    assert.deepEqual(effectiveness('Plain', ['Hollow']), { mult: 0, word: 'Blocked' });
  });

  it('multiplies dual types (x4 is Strong, x0.25 is Weak)', () => {
    assert.deepEqual(effectiveness('Bolt', ['Brine', 'Gust']), { mult: 4, word: 'Strong' });
    assert.deepEqual(effectiveness('Glass', ['Brine', 'Stone']), { mult: 0.25, word: 'Weak' });
    assert.deepEqual(effectiveness('Moss', ['Brine', 'Glass']), { mult: 0.25, word: 'Weak' });
  });

  it('treats a typeless move as Neutral against anything, even Hollow', () => {
    assert.deepEqual(effectiveness(null, ['Hollow', 'Rust']), { mult: 1, word: 'Neutral' });
  });

  it('agrees with the derived defensive profiles from the creatures doc', () => {
    const cases = [
      [['Brine'], { x2: ['Grit', 'Bolt'], half: ['Kiln', 'Moss', 'Rime', 'Stone', 'Glass'] }],
      [['Glass', 'Gust'], { x2: ['Kiln', 'Rime'], half: ['Grit', 'Moss', 'Rust'] }],
      [['Brine', 'Glass'], { x2: ['Hollow'], half: ['Rime', 'Rust', 'Glass'] }],
      [['Hollow', 'Rust'], { x2: ['Moss', 'Rime', 'Gust'], half: ['Brine', 'Hollow'], x0: ['Plain', 'Grit'] }],
      [['Kiln', 'Stone'], { x2: ['Grit', 'Gust', 'Hollow'], half: ['Plain', 'Rime', 'Glass'] }],
      [['Rime', 'Stone'], { x2: ['Kiln', 'Moss', 'Hollow'], half: ['Plain', 'Gust', 'Rust', 'Glass'] }],
      [['Bolt', 'Brine'], { x2: ['Bolt', 'Rust'], half: ['Kiln', 'Rime', 'Glass'] }],
    ];
    for (const [types, want] of cases) {
      const x2 = ORDINARY_TYPES.filter((t) => effectiveness(t, types).mult === 2);
      const half = ORDINARY_TYPES.filter((t) => effectiveness(t, types).mult === 0.5);
      const x0 = ORDINARY_TYPES.filter((t) => effectiveness(t, types).mult === 0);
      assert.deepEqual(x2.sort(), want.x2.slice().sort(), `${types} x2`);
      assert.deepEqual(half.sort(), want.half.slice().sort(), `${types} x0.5`);
      assert.deepEqual(x0.sort(), (want.x0 || []).slice().sort(), `${types} x0`);
    }
  });

  it('Prismoth (Glass/Gust) is hit Strong only by Kiln and Rime', () => {
    assert.deepEqual(strongTypesAgainst(['Glass', 'Gust']), ['Kiln', 'Rime']);
  });

  it('immuneTypesOf and wordFor', () => {
    assert.deepEqual(immuneTypesOf(['Hollow']), ['Plain', 'Grit']);
    assert.equal(wordFor(4), 'Strong');
    assert.equal(wordFor(0.25), 'Weak');
  });

  it('throws for an unknown type', () => {
    assert.throws(() => effectiveness('Fire', ['Plain']), RangeError);
    assert.throws(() => effectiveness('Plain', ['Water']), RangeError);
  });
});

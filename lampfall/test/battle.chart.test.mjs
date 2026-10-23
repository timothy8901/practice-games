// The full 13x13 type chart against the creatures doc (section 5), encoded
// here independently of types.js, plus the section 4 / 5.1 lists and the
// section 2.1 / 3A derived defensive profiles. Run: node --test test/battle.chart.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTypeChart, wordFor, WORDS, strongTypesAgainst as strongOf, immuneTypesOf as immuneOf } from '../js/battle/effects.js';
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

// Section 5 of wildshift-creatures.md, rows attack, columns defend.
// Columns: Pla Gri Bri Kil Mos Bol Rim Gus Sto Rus Gla Hol Sta
const DOC_COLUMNS = ['Plain', 'Grit', 'Brine', 'Kiln', 'Moss', 'Bolt', 'Rime', 'Gust', 'Stone', 'Rust', 'Glass', 'Hollow', 'Star'];
const DOC_ROWS = {
  Plain: '. . . . . . . . h . . 0 .',
  Grit: '2 . 2 2 h h . . . 2 h 0 .',
  Brine: '. . . 2 2 . 2 . h h . . .',
  Kiln: '. . h . 2 . 2 . . h 2 2 .',
  Moss: '. . h h . 2 . . 2 2 h . .',
  Bolt: '. . 2 . . . . 2 . . h . .',
  Rime: '. . h h 2 . . 2 . 2 . . .',
  Gust: '. 2 . 2 . . h . . . . 2 .',
  Stone: '. . h . . 2 . h . . 2 . .',
  Rust: '2 . . . . 2 h . . . h . .',
  Glass: '. 2 h . . . . . h h . 2 .',
  Hollow: '. . . . . . . h 2 h 2 . .',
  Star: '. . . . . . . . . . . . .',
};
const CELL = { '.': 1, h: 0.5, 2: 2, 0: 0 };

function docChart() {
  const out = {};
  for (const [atk, row] of Object.entries(DOC_ROWS)) {
    const cells = row.split(' ');
    assert.equal(cells.length, 13, `doc row ${atk}`);
    out[atk] = {};
    cells.forEach((c, i) => { out[atk][DOC_COLUMNS[i]] = CELL[c]; });
  }
  return out;
}

// Section 5.1: the same chart as a Strong / Weak / Blocked list.
const DOC_LIST = {
  Plain: { strong: [], weak: ['Stone'], blocked: ['Hollow'] },
  Grit: { strong: ['Plain', 'Brine', 'Kiln', 'Rust'], weak: ['Moss', 'Bolt', 'Glass'], blocked: ['Hollow'] },
  Brine: { strong: ['Kiln', 'Moss', 'Rime'], weak: ['Stone', 'Rust'], blocked: [] },
  Kiln: { strong: ['Moss', 'Rime', 'Glass', 'Hollow'], weak: ['Brine', 'Rust'], blocked: [] },
  Moss: { strong: ['Bolt', 'Stone', 'Rust'], weak: ['Brine', 'Kiln', 'Glass'], blocked: [] },
  Bolt: { strong: ['Brine', 'Gust'], weak: ['Glass'], blocked: [] },
  Rime: { strong: ['Moss', 'Gust', 'Rust'], weak: ['Brine', 'Kiln'], blocked: [] },
  Gust: { strong: ['Grit', 'Kiln', 'Hollow'], weak: ['Rime'], blocked: [] },
  Stone: { strong: ['Bolt', 'Glass'], weak: ['Brine', 'Gust'], blocked: [] },
  Rust: { strong: ['Plain', 'Bolt'], weak: ['Rime', 'Glass'], blocked: [] },
  Glass: { strong: ['Grit', 'Hollow'], weak: ['Brine', 'Stone', 'Rust'], blocked: [] },
  Hollow: { strong: ['Stone', 'Glass'], weak: ['Gust', 'Rust'], blocked: [] },
  Star: { strong: [], weak: [], blocked: [] },
};

// Section 4 table, defensive columns: takes double from / resists / immune to.
const DOC_DEFENSE = {
  Plain: { double: ['Grit', 'Rust'], resists: [], immune: [] },
  Grit: { double: ['Gust', 'Glass'], resists: [], immune: [] },
  Brine: { double: ['Grit', 'Bolt'], resists: ['Kiln', 'Moss', 'Rime', 'Stone', 'Glass'], immune: [] },
  Kiln: { double: ['Grit', 'Brine', 'Gust'], resists: ['Moss', 'Rime'], immune: [] },
  Moss: { double: ['Brine', 'Kiln', 'Rime'], resists: ['Grit'], immune: [] },
  Bolt: { double: ['Moss', 'Stone', 'Rust'], resists: ['Grit'], immune: [] },
  Rime: { double: ['Brine', 'Kiln'], resists: ['Gust', 'Rust'], immune: [] },
  Gust: { double: ['Bolt', 'Rime'], resists: ['Stone', 'Hollow'], immune: [] },
  Stone: { double: ['Moss', 'Hollow'], resists: ['Plain', 'Brine', 'Glass'], immune: [] },
  Rust: { double: ['Grit', 'Moss', 'Rime'], resists: ['Brine', 'Kiln', 'Glass', 'Hollow'], immune: [] },
  Glass: { double: ['Kiln', 'Stone', 'Hollow'], resists: ['Grit', 'Moss', 'Bolt', 'Rust'], immune: [] },
  Hollow: { double: ['Kiln', 'Gust', 'Glass'], resists: [], immune: ['Plain', 'Grit'] },
  Star: { double: [], resists: [], immune: [] },
};

// Sections 2.1 and 3A: derived defensive profiles (dual types multiplied).
const DOC_PROFILES = [
  ['Sloshkin', ['Brine'], { x2: ['Grit', 'Bolt'], x05: ['Kiln', 'Moss', 'Rime', 'Stone', 'Glass'] }],
  ['Skeinwing', ['Brine', 'Gust'], { x4: ['Bolt'], x2: ['Grit'], x05: ['Kiln', 'Moss', 'Glass', 'Hollow'], x025: ['Stone'] }],
  ['Scrapling', ['Grit'], { x2: ['Gust', 'Glass'] }],
  ['Prismoth', ['Glass', 'Gust'], { x2: ['Kiln', 'Rime'], x05: ['Grit', 'Moss', 'Rust'] }],
  ['Vesperay', ['Brine', 'Glass'], { x2: ['Hollow'], x05: ['Rime', 'Rust', 'Glass'], x025: ['Moss'] }],
  ['Vagary', ['Star'], {}],
  ['Brinelance', ['Brine', 'Rime'], { x2: ['Grit', 'Brine', 'Bolt'], x05: ['Moss', 'Rime', 'Gust', 'Stone', 'Rust', 'Glass'] }],
  ['Creelwight', ['Hollow', 'Rust'], { x2: ['Moss', 'Rime', 'Gust'], x05: ['Brine', 'Hollow'], x0: ['Plain', 'Grit'] }],
  ['Sedgehare', ['Moss'], { x2: ['Brine', 'Kiln', 'Rime'], x05: ['Grit'] }],
  ['Wirewhisk', ['Bolt'], { x2: ['Moss', 'Stone', 'Rust'], x05: ['Grit'] }],
  ['Rimeplate', ['Rime', 'Stone'], { x2: ['Kiln', 'Moss', 'Hollow'], x05: ['Plain', 'Gust', 'Rust', 'Glass'] }],
  ['Squallcoil', ['Bolt', 'Brine'], { x2: ['Bolt', 'Rust'], x05: ['Kiln', 'Rime', 'Glass'] }],
  ['Tossup', ['Plain'], { x2: ['Grit', 'Rust'] }],
  ['Stillox', ['Stone'], { x2: ['Moss', 'Hollow'], x05: ['Plain', 'Brine', 'Glass'] }],
  ['Caldermaw', ['Kiln', 'Stone'], { x2: ['Grit', 'Gust', 'Hollow'], x05: ['Plain', 'Rime', 'Glass'] }],
  ['Bilgebob', ['Brine'], { x2: ['Grit', 'Bolt'], x05: ['Kiln', 'Moss', 'Rime', 'Stone', 'Glass'] }],
  ['Sootling', ['Kiln'], { x2: ['Grit', 'Brine', 'Gust'], x05: ['Moss', 'Rime'] }],
  ['Chillnub', ['Rime'], { x2: ['Brine', 'Kiln'], x05: ['Gust', 'Rust'] }],
  ['Knuckleback', ['Grit'], { x2: ['Gust', 'Glass'] }],
  ['Cragmitt', ['Grit', 'Stone'], { x2: ['Moss', 'Gust', 'Hollow'], x05: ['Plain', 'Brine'] }],
  ['Siltback', ['Brine', 'Stone'], { x2: ['Grit', 'Bolt', 'Hollow'], x05: ['Plain', 'Brine', 'Kiln', 'Rime', 'Stone'], x025: ['Glass'] }],
  ['Bogmonarch', ['Brine', 'Stone'], { x2: ['Grit', 'Bolt', 'Hollow'], x05: ['Plain', 'Brine', 'Kiln', 'Rime', 'Stone'], x025: ['Glass'] }],
  ['Lumenveil', ['Glass'], { x2: ['Kiln', 'Stone', 'Hollow'], x05: ['Grit', 'Moss', 'Bolt', 'Rust'] }],
  ['Mudfist', ['Grit'], { x2: ['Gust', 'Glass'] }],
  ['Rushling', ['Moss', 'Brine'], { x2: ['Brine', 'Bolt'], x05: ['Moss', 'Stone', 'Glass'] }],
  ['Puddlepip', ['Brine'], { x2: ['Grit', 'Bolt'], x05: ['Kiln', 'Moss', 'Rime', 'Stone', 'Glass'] }],
  ['Star-touched Sloshkin', ['Brine', 'Star'], { x2: ['Grit', 'Bolt'], x05: ['Kiln', 'Moss', 'Rime', 'Stone', 'Glass'] }],
];

const sorted = (a) => a.slice().sort();

describe('13x13 chart vs the doc table (section 5)', () => {
  const doc = docChart();

  it('type order matches the doc column heads', () => {
    assert.deepEqual(TYPES.slice(), DOC_COLUMNS);
  });

  it('every one of the 169 cells matches', () => {
    let checked = 0;
    for (const a of DOC_COLUMNS) {
      for (const d of DOC_COLUMNS) {
        assert.equal(TYPE_CHART[a][d], doc[a][d], `${a} -> ${d}`);
        assert.equal(chartMult(a, d), doc[a][d], `chartMult ${a} -> ${d}`);
        checked++;
      }
    }
    assert.equal(checked, 169);
  });

  it('has 56 non-neutral pairings, counted per attacking row as the doc states (2+8+5+6+6+3+5+4+4+4+5+4)', () => {
    const perRow = [2, 8, 5, 6, 6, 3, 5, 4, 4, 4, 5, 4];
    let total = 0;
    ORDINARY_TYPES.forEach((a, i) => {
      const n = DOC_COLUMNS.filter((d) => TYPE_CHART[a][d] !== 1).length;
      assert.equal(n, perRow[i], `${a} row`);
      total += n;
    });
    assert.equal(total, 56);
    assert.equal(DOC_COLUMNS.filter((d) => TYPE_CHART.Star[d] !== 1).length, 0);
  });

  it('the only immunity is Hollow against Plain and Grit', () => {
    const zeros = [];
    for (const a of TYPES) for (const d of TYPES) if (TYPE_CHART[a][d] === 0) zeros.push([a, d]);
    assert.deepEqual(zeros, [['Plain', 'Hollow'], ['Grit', 'Hollow']]);
    assert.deepEqual(immuneTypesOf(['Hollow']), ['Plain', 'Grit']);
    assert.deepEqual(immuneTypesOf(['Hollow', 'Rust']), ['Plain', 'Grit']);
  });
});

describe('chart vs the Strong / Weak / Blocked list (section 5.1)', () => {
  for (const [atk, want] of Object.entries(DOC_LIST)) {
    it(`${atk}`, () => {
      const strong = ORDINARY_TYPES.filter((d) => TYPE_CHART[atk][d] === 2);
      const weak = ORDINARY_TYPES.filter((d) => TYPE_CHART[atk][d] === 0.5);
      const blocked = ORDINARY_TYPES.filter((d) => TYPE_CHART[atk][d] === 0);
      assert.deepEqual(strong, want.strong);
      assert.deepEqual(weak, want.weak);
      assert.deepEqual(blocked, want.blocked);
    });
  }
});

describe('chart vs the per-type defensive columns (section 4)', () => {
  for (const [def, want] of Object.entries(DOC_DEFENSE)) {
    it(`${def} takes double from ${want.double.join('/') || 'nothing'}`, () => {
      assert.deepEqual(ORDINARY_TYPES.filter((a) => TYPE_CHART[a][def] === 2), want.double);
      assert.deepEqual(ORDINARY_TYPES.filter((a) => TYPE_CHART[a][def] === 0.5), want.resists);
      assert.deepEqual(ORDINARY_TYPES.filter((a) => TYPE_CHART[a][def] === 0), want.immune);
    });
  }

  it('every ordinary type takes double from 2 or 3 types', () => {
    for (const d of ORDINARY_TYPES) {
      const n = DOC_DEFENSE[d].double.length;
      assert.ok(n >= 2 && n <= 3, d);
    }
  });
});

describe('derived defensive profiles (sections 2.1 and 3A)', () => {
  for (const [name, types, want] of DOC_PROFILES) {
    it(`${name} (${types.join('/')})`, () => {
      const by = (m) => sorted(ORDINARY_TYPES.filter((t) => effectiveness(t, types).mult === m));
      assert.deepEqual(by(4), sorted(want.x4 || []), 'x4');
      assert.deepEqual(by(2), sorted(want.x2 || []), 'x2');
      assert.deepEqual(by(0.5), sorted(want.x05 || []), 'x0.5');
      assert.deepEqual(by(0.25), sorted(want.x025 || []), 'x0.25');
      assert.deepEqual(by(0), sorted(want.x0 || []), 'x0');
    });
  }

  it('Prismoth is hit Strong only by Kiln and Rime (the coral and blue bands)', () => {
    assert.deepEqual(strongTypesAgainst(['Glass', 'Gust']), ['Kiln', 'Rime']);
  });

  it('Shadowbox (Hollow) is neutral on Hollow and double on Stone and Glass', () => {
    assert.equal(effectiveness('Hollow', ['Hollow']).word, 'Neutral');
    assert.equal(effectiveness('Hollow', ['Stone']).word, 'Strong');
    assert.equal(effectiveness('Hollow', ['Glass']).word, 'Strong');
  });
});

describe('effectiveness words', () => {
  it('are exactly Strong / Neutral / Weak / Blocked', () => {
    assert.deepEqual(Object.values(WORDS).sort(), ['Blocked', 'Neutral', 'Strong', 'Weak']);
    assert.equal(wordFor(2), 'Strong');
    assert.equal(wordFor(4), 'Strong');
    assert.equal(wordFor(1), 'Neutral');
    assert.equal(wordFor(0.5), 'Weak');
    assert.equal(wordFor(0.25), 'Weak');
    assert.equal(wordFor(0), 'Blocked');
  });

  it('every chart cell maps to a word and dual types multiply before the word is chosen', () => {
    for (const a of TYPES) for (const d of TYPES) assert.ok(['Strong', 'Neutral', 'Weak', 'Blocked'].includes(effectiveness(a, [d]).word));
    // Strong x Weak cancels to Neutral: Grit vs Plain/Moss = 2 x 0.5
    assert.deepEqual(effectiveness('Grit', ['Plain', 'Moss']), { mult: 1, word: 'Neutral' });
    // Anything x 0 is Blocked
    assert.deepEqual(effectiveness('Grit', ['Plain', 'Hollow']), { mult: 0, word: 'Blocked' });
    // Star on either side is a no-op on the multiplier
    assert.deepEqual(effectiveness('Grit', ['Brine', 'Star']), { mult: 2, word: 'Strong' });
    assert.deepEqual(effectiveness('Star', ['Hollow', 'Rust']), { mult: 1, word: 'Neutral' });
  });

  it('typeless (Scrap) is Neutral against everything', () => {
    for (const d of TYPES) assert.equal(effectiveness(null, [d]).word, 'Neutral');
  });
});

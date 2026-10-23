// Unit tests for js/core/rng.js. Run: node --test test/rng.test.mjs
// Every statistical check uses a fixed seed, so results are reproducible.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashString,
  makeRng,
  Rng,
  encodeSeedCode,
  decodeSeedCode,
  randomSeedCode,
  setSeedToggles,
  getSeedToggles,
  SEED_CODE,
} from '../js/core/rng.js';

const TWO_32 = 2 ** 32;
const NAMES = ['permadeath', 'nomap', 'hardtide', 'realclock', 'fog', 'frost', 'storm', 'quiet'];
const PAYLOAD_RE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

/** `n` values from `fn(rng)` (defaults to `next()`). */
const draws = (rng, n, fn = (r) => r.next()) => Array.from({ length: n }, () => fn(rng));

/** Sample mean and standard deviation. */
function stats(xs) {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return { mean, sd: Math.sqrt(variance) };
}

/** Occurrence count per distinct value. */
function counts(xs) {
  const map = new Map();
  for (const x of xs) map.set(x, (map.get(x) ?? 0) + 1);
  return map;
}

/** Asserts every bucket count lies within `expected ± tolerance`. */
function assertBalanced(map, expected, tolerance) {
  for (const [key, n] of map) {
    assert.ok(Math.abs(n - expected) <= tolerance, `bucket ${String(key)}: ${n} vs ${expected} ± ${tolerance}`);
  }
}

// ---------------------------------------------------------------------------

describe('hashString', () => {
  it('returns an unsigned 32-bit integer', () => {
    for (const s of ['', 'a', 'porchlight', 'Wildshift', '🦊'.repeat(1000), '\u0000￿']) {
      const h = hashString(s);
      assert.ok(Number.isInteger(h) && h >= 0 && h < TWO_32, `${JSON.stringify(s.slice(0, 8))} -> ${h}`);
    }
  });

  it('is deterministic and matches the locked golden values', () => {
    assert.equal(hashString('porchlight'), 2554128684);
    assert.equal(hashString(''), 2872998923);
    assert.equal(hashString('porchlight'), hashString('porchlight'));
  });

  it('distinguishes similar inputs', () => {
    const pairs = [['a', 'b'], ['ab', 'ba'], ['hello', 'héllo'], ['Wild', 'wild'], ['a', 'a\0'], ['', ' ']];
    for (const [x, y] of pairs) assert.notEqual(hashString(x), hashString(y), `${x} vs ${y}`);
  });

  it('mixes the low bits well (the seed-code checksum relies on them)', () => {
    const buckets = counts(Array.from({ length: 2000 }, (_, i) => hashString(`key${i}`) & 31));
    assert.equal(buckets.size, 32);
    assertBalanced(buckets, 62.5, 37.5);
  });

  it('rejects non-strings', () => {
    for (const bad of [42, null, undefined, {}, [], true, Symbol('x')]) {
      assert.throws(() => hashString(bad), TypeError);
    }
  });
});

// ---------------------------------------------------------------------------

describe('makeRng', () => {
  it('rejects seeds that are neither strings nor finite numbers', () => {
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, {}, [], true, 10n]) {
      assert.throws(() => makeRng(bad), TypeError);
    }
  });

  it('produces identical streams for identical seeds', () => {
    assert.deepEqual(draws(makeRng('tide'), 100), draws(makeRng('tide'), 100));
    assert.deepEqual(draws(makeRng(2024), 100), draws(makeRng(2024), 100));
  });

  it('treats a number and its decimal string as the same seed', () => {
    assert.deepEqual(makeRng(42).state(), makeRng('42').state());
    assert.deepEqual(makeRng(-0).state(), makeRng(0).state());
    assert.deepEqual(makeRng(1.5).state(), makeRng('1.5').state());
  });

  it('produces different streams for different seeds', () => {
    const pairs = [[42, 43], ['a', 'b'], ['a', 'a '], [0, ''], ['seed', 'Seed']];
    for (const [x, y] of pairs) {
      assert.notDeepEqual(draws(makeRng(x), 8), draws(makeRng(y), 8), `${String(x)} vs ${String(y)}`);
    }
  });

  it('matches the locked golden sequences (algorithm must never silently change)', () => {
    assert.deepEqual(draws(makeRng('wildshift'), 4, (r) => r.nextUint32()), [1189000610, 2129617780, 3108808718, 412211399]);
    assert.deepEqual(draws(makeRng(7), 3), [0.9808573557529598, 0.1600172200705856, 0.9185360993724316]);
  });

  it('exposes the canonical seed key and the Rng class', () => {
    assert.equal(makeRng('x').seed, 'x');
    assert.equal(makeRng(42).seed, '42');
    assert.ok(makeRng('x') instanceof Rng);
    assert.deepEqual(new Rng('x').state(), makeRng('x').state());
  });
});

// ---------------------------------------------------------------------------

describe('next / nextUint32', () => {
  it('next() stays in [0, 1) and looks uniform', () => {
    const xs = draws(makeRng('uniform'), 20000);
    assert.ok(xs.every((x) => x >= 0 && x < 1));
    const { mean } = stats(xs);
    assert.ok(Math.abs(mean - 0.5) < 0.01, `mean ${mean}`);
    assert.ok(Math.min(...xs) < 0.001 && Math.max(...xs) > 0.999);
  });

  it('nextUint32() covers the full 32-bit range', () => {
    const xs = draws(makeRng('u32'), 1000, (r) => r.nextUint32());
    assert.ok(xs.every((x) => Number.isInteger(x) && x >= 0 && x < TWO_32));
    assert.ok(xs.some((x) => x >= 2 ** 31) && xs.some((x) => x < 2 ** 31));
  });

  it('both consume exactly one draw', () => {
    const a = makeRng('one');
    const b = makeRng('one');
    a.next();
    b.nextUint32();
    assert.deepEqual(a.state(), b.state());
  });
});

// ---------------------------------------------------------------------------

describe('int', () => {
  it('is inclusive at both ends', () => {
    const numeric = (a, b) => a - b;
    assert.deepEqual([...counts(draws(makeRng('inc'), 2000, (r) => r.int(0, 3))).keys()].sort(numeric), [0, 1, 2, 3]);
    assert.deepEqual([...counts(draws(makeRng('neg'), 2000, (r) => r.int(-2, 1))).keys()].sort(numeric), [-2, -1, 0, 1]);
  });

  it('handles a single-value range (and still consumes a draw)', () => {
    const r = makeRng('seven');
    const before = r.state();
    assert.ok(draws(r, 50, (x) => x.int(7, 7)).every((v) => v === 7));
    assert.notDeepEqual(r.state(), before);
  });

  it('tightens non-integer bounds inwards', () => {
    const seen = counts(draws(makeRng('frac'), 500, (r) => r.int(0.2, 2.9)));
    assert.deepEqual([...seen.keys()].sort(), [1, 2]);
    assert.ok(draws(makeRng('frac2'), 50, (r) => r.int(-0.5, 0.5)).every((v) => v === 0));
  });

  it('rejects empty, non-finite and oversized ranges', () => {
    const r = makeRng('bad');
    assert.throws(() => r.int(3, 2), RangeError);
    assert.throws(() => r.int(1.5, 1.6), RangeError);
    assert.throws(() => r.int(-(2 ** 53), 2 ** 53), RangeError);
    assert.throws(() => r.int(NaN, 1), TypeError);
    assert.throws(() => r.int(0, Infinity), TypeError);
    assert.throws(() => r.int('0', 5), TypeError);
    assert.throws(() => r.int(0), TypeError);
  });

  it('supports ranges wider than 2^32 up to 2^53', () => {
    const wide = draws(makeRng('wide'), 200, (r) => r.int(0, 2 ** 40));
    assert.ok(wide.every((v) => Number.isInteger(v) && v >= 0 && v <= 2 ** 40));
    assert.ok(wide.some((v) => v > TWO_32), 'should reach beyond 2^32');
    const max = draws(makeRng('max'), 50, (r) => r.int(0, 2 ** 53 - 1));
    assert.ok(max.every((v) => Number.isSafeInteger(v) && v >= 0));
    const signed = draws(makeRng('signed'), 50, (r) => r.int(-(2 ** 52), 2 ** 52 - 1));
    assert.ok(signed.every((v) => Number.isSafeInteger(v) && v >= -(2 ** 52) && v < 2 ** 52));
    assert.deepEqual(draws(makeRng('wide'), 20, (r) => r.int(0, 2 ** 40)), draws(makeRng('wide'), 20, (r) => r.int(0, 2 ** 40)));
  });

  it('is free of modulo bias', () => {
    assertBalanced(counts(draws(makeRng('ten'), 20000, (r) => r.int(0, 9))), 2000, 200);
    assertBalanced(counts(draws(makeRng('three'), 30000, (r) => r.int(0, 2))), 10000, 400);
  });
});

// ---------------------------------------------------------------------------

describe('chance', () => {
  it('honours the extremes', () => {
    const r = makeRng('edge');
    assert.ok(draws(r, 1000, (x) => x.chance(0)).every((v) => v === false));
    assert.ok(draws(r, 1000, (x) => x.chance(1)).every((v) => v === true));
    assert.equal(r.chance(-1), false);
    assert.equal(r.chance(2), true);
    assert.equal(r.chance(NaN), false);
  });

  it('is true about p of the time', () => {
    const hits = draws(makeRng('p'), 20000, (r) => r.chance(0.3)).filter(Boolean).length;
    assert.ok(Math.abs(hits / 20000 - 0.3) < 0.02, `rate ${hits / 20000}`);
  });

  it('always consumes exactly one draw, whatever p is', () => {
    for (const p of [0, 0.5, 1, NaN]) {
      const a = makeRng('draw');
      const b = makeRng('draw');
      a.chance(p);
      b.next();
      assert.deepEqual(a.state(), b.state(), `p=${p}`);
    }
  });

  it('rejects non-numbers', () => {
    const r = makeRng('t');
    for (const bad of ['0.5', undefined, null, {}]) assert.throws(() => r.chance(bad), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('pick', () => {
  it('returns undefined for an empty array without consuming a draw', () => {
    const r = makeRng('empty');
    const before = r.state();
    assert.equal(r.pick([]), undefined);
    assert.equal(r.pick({ length: 0 }), undefined);
    assert.deepEqual(r.state(), before);
  });

  it('picks every element with about equal frequency', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const seen = counts(draws(makeRng('pick'), 2000, (r) => r.pick(items)));
    assert.deepEqual([...seen.keys()].sort(), items);
    assertBalanced(seen, 400, 80);
  });

  it('consumes exactly one draw', () => {
    const a = makeRng('pd');
    const b = makeRng('pd');
    a.pick([1, 2, 3]);
    b.next();
    assert.deepEqual(a.state(), b.state());
  });

  it('accepts array-likes', () => {
    const r = makeRng('al');
    assert.equal(r.pick(Uint8Array.of(9)), 9);
    assert.ok('abc'.includes(r.pick('abc')));
  });

  it('rejects non-array-likes', () => {
    const r = makeRng('bad');
    for (const bad of [null, undefined, 5, {}, () => {}]) assert.throws(() => r.pick(bad), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('shuffle', () => {
  const input = Object.freeze([...Array(20).keys()]);

  it('returns a permuted copy and leaves the input untouched', () => {
    const out = makeRng('shuf').shuffle(input);
    assert.notEqual(out, input);
    assert.deepEqual([...out].sort((a, b) => a - b), [...input]);
    assert.notDeepEqual(out, [...input]);
    assert.deepEqual([...input], [...Array(20).keys()]);
  });

  it('is deterministic and matches the locked golden permutation', () => {
    assert.equal(makeRng('shuf').shuffle(input).join(','), '4,3,7,11,1,8,10,9,16,0,19,15,14,13,5,18,2,12,6,17');
    assert.deepEqual(makeRng('again').shuffle(input), makeRng('again').shuffle(input));
  });

  it('handles trivial inputs without consuming draws', () => {
    const r = makeRng('triv');
    const before = r.state();
    assert.deepEqual(r.shuffle([]), []);
    assert.deepEqual(r.shuffle([1]), [1]);
    assert.deepEqual(r.state(), before);
  });

  it('consumes length - 1 draws', () => {
    const a = makeRng('n1');
    const b = makeRng('n1');
    a.shuffle([1, 2, 3, 4]);
    draws(b, 3);
    assert.deepEqual(a.state(), b.state());
  });

  it('accepts array-likes and returns plain arrays', () => {
    const r = makeRng('al');
    const bytes = r.shuffle(Uint8Array.of(1, 2, 3));
    assert.ok(Array.isArray(bytes));
    assert.deepEqual([...bytes].sort(), [1, 2, 3]);
    assert.deepEqual(r.shuffle('abc').sort(), ['a', 'b', 'c']);
  });

  it('produces every permutation about equally often', () => {
    const seen = counts(draws(makeRng('perm'), 6000, (r) => r.shuffle([0, 1, 2]).join('')));
    assert.equal(seen.size, 6);
    assertBalanced(seen, 1000, 150);
  });

  it('rejects non-array-likes', () => {
    const r = makeRng('bad');
    for (const bad of [null, undefined, 5, () => {}]) assert.throws(() => r.shuffle(bad), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('weighted', () => {
  it('selects in proportion to the weights', () => {
    const table = [{ w: 1, v: 'a' }, { w: 3, v: 'b' }];
    const seen = counts(draws(makeRng('w'), 20000, (r) => r.weighted(table)));
    assert.ok(Math.abs(seen.get('b') / 20000 - 0.75) < 0.02, `b rate ${seen.get('b') / 20000}`);
  });

  it('never selects entries with zero or negative weight', () => {
    const table = [{ w: 0, v: 'x' }, { w: -5, v: 'y' }, { w: 1, v: 'z' }];
    assert.ok(draws(makeRng('zero'), 500, (r) => r.weighted(table)).every((v) => v === 'z'));
  });

  it('returns undefined without consuming a draw when nothing is eligible', () => {
    const r = makeRng('none');
    const before = r.state();
    assert.equal(r.weighted([]), undefined);
    assert.equal(r.weighted([{ w: 0, v: 'x' }, { w: -1, v: 'y' }]), undefined);
    assert.deepEqual(r.state(), before);
  });

  it('consumes exactly one draw when an entry is eligible', () => {
    const a = makeRng('wd');
    const b = makeRng('wd');
    assert.equal(a.weighted([{ w: 2, v: 'only' }]), 'only');
    b.next();
    assert.deepEqual(a.state(), b.state());
  });

  it('always resolves to an entry despite floating-point sums', () => {
    const table = [{ w: 0.1, v: 0 }, { w: 0.2, v: 1 }, { w: 0.7, v: 2 }];
    const seen = counts(draws(makeRng('float'), 10000, (r) => r.weighted(table)));
    assert.ok(!seen.has(undefined));
    assert.deepEqual([...seen.keys()].sort(), [0, 1, 2]);
  });

  it('is deterministic', () => {
    const table = [{ w: 1, v: 1 }, { w: 2, v: 2 }, { w: 3, v: 3 }];
    assert.deepEqual(draws(makeRng('det'), 50, (r) => r.weighted(table)), draws(makeRng('det'), 50, (r) => r.weighted(table)));
  });

  it('rejects malformed entries and non-finite weights', () => {
    const r = makeRng('bad');
    for (const table of [[{ w: NaN, v: 1 }], [{ w: Infinity, v: 1 }], [{ v: 1 }], [{ w: '1', v: 1 }], [5], [null], null, 'abc']) {
      assert.throws(() => r.weighted(table), TypeError, JSON.stringify(table));
    }
  });
});

// ---------------------------------------------------------------------------

describe('fork', () => {
  it('derives from the seed, not from the current position', () => {
    const fresh = makeRng('world');
    const advanced = makeRng('world');
    draws(advanced, 50);
    assert.deepEqual(draws(fresh.fork('zone'), 20), draws(advanced.fork('zone'), 20));
  });

  it('does not consume a draw', () => {
    const r = makeRng('world');
    const before = r.state();
    r.fork('zone');
    assert.deepEqual(r.state(), before);
  });

  it('gives distinct streams per label, parent and nesting order', () => {
    const r = makeRng('world');
    const seqs = [
      draws(r, 8),
      draws(r.fork('a'), 8),
      draws(r.fork('b'), 8),
      draws(r.fork('a').fork('b'), 8),
      draws(r.fork('b').fork('a'), 8),
      draws(r.fork('ab'), 8),
      draws(makeRng('other').fork('a'), 8),
    ];
    for (let i = 0; i < seqs.length; i++) {
      for (let j = i + 1; j < seqs.length; j++) assert.notDeepEqual(seqs[i], seqs[j], `${i} vs ${j}`);
    }
  });

  it('accepts numeric labels, equivalent to their string form', () => {
    const r = makeRng('world');
    assert.deepEqual(r.fork(3).state(), r.fork('3').state());
  });

  it('is reproducible from its seed key', () => {
    const f = makeRng('world').fork('zone').fork(3);
    assert.equal(typeof f.seed, 'string');
    assert.ok(f.seed.includes('zone'));
    assert.deepEqual(makeRng(f.seed).state(), f.state());
  });

  it('is unaffected by restore()', () => {
    const r = makeRng('world').restore(makeRng('elsewhere').state());
    assert.deepEqual(r.fork('x').state(), makeRng('world').fork('x').state());
  });

  it('rejects labels that are not strings or numbers', () => {
    const r = makeRng('world');
    for (const bad of [undefined, null, {}, [], true]) assert.throws(() => r.fork(bad), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('state / restore', () => {
  it('state() is a JSON-safe copy of four uint32 words', () => {
    const r = makeRng('snap');
    const s = r.state();
    assert.equal(s.length, 4);
    assert.ok(s.every((v) => Number.isInteger(v) && v >= 0 && v < TWO_32));
    s[0] = 123;
    assert.notEqual(r.state()[0], 123);
    assert.deepEqual(JSON.parse(JSON.stringify(s)).length, 4);
  });

  it('restore() reproduces the future exactly, even on a differently seeded rng', () => {
    const a = makeRng('a');
    draws(a, 10);
    const snapshot = JSON.parse(JSON.stringify(a.state()));
    const future = draws(a, 10);
    const b = makeRng('b');
    const returned = b.restore(snapshot);
    assert.equal(returned, b);
    assert.deepEqual(draws(b, 10), future);
  });

  it('accepts typed arrays', () => {
    const a = makeRng('typed');
    const b = makeRng('x').restore(Uint32Array.from(a.state()));
    assert.deepEqual(draws(a, 5), draws(b, 5));
  });

  it('rejects malformed states and leaves the rng untouched', () => {
    const r = makeRng('guard');
    const before = r.state();
    for (const bad of [null, undefined, 'abcd', [1, 2, 3], [1, 2, 3, 4, 5], {}]) {
      assert.throws(() => r.restore(bad), TypeError, JSON.stringify(bad));
    }
    for (const bad of [[-1, 0, 0, 1], [TWO_32, 0, 0, 1], [1.5, 0, 0, 1], ['1', 0, 0, 1], [0, 0, 0, 0]]) {
      assert.throws(() => r.restore(bad), RangeError, JSON.stringify(bad));
    }
    assert.deepEqual(r.state(), before);
  });
});

// ---------------------------------------------------------------------------

describe('gaussian', () => {
  it('has the requested mean and standard deviation', () => {
    const { mean, sd } = stats(draws(makeRng('gauss'), 20000, (r) => r.gaussian(10, 2)));
    assert.ok(Math.abs(mean - 10) < 0.1, `mean ${mean}`);
    assert.ok(Math.abs(sd - 2) < 0.1, `sd ${sd}`);
  });

  it('defaults to the standard normal', () => {
    const { mean, sd } = stats(draws(makeRng('std'), 20000, (r) => r.gaussian()));
    assert.ok(Math.abs(mean) < 0.05, `mean ${mean}`);
    assert.ok(Math.abs(sd - 1) < 0.05, `sd ${sd}`);
  });

  it('consumes exactly two draws and keeps no hidden state', () => {
    const a = makeRng('two');
    const b = makeRng('two');
    a.gaussian();
    draws(b, 2);
    assert.deepEqual(a.state(), b.state());
  });

  it('is always finite and collapses to the mean when sd is 0', () => {
    assert.ok(draws(makeRng('fin'), 10000, (r) => r.gaussian()).every(Number.isFinite));
    assert.ok(draws(makeRng('flat'), 20, (r) => r.gaussian(5, 0)).every((v) => v === 5));
  });

  it('rejects non-finite arguments', () => {
    const r = makeRng('bad');
    assert.throws(() => r.gaussian(NaN), TypeError);
    assert.throws(() => r.gaussian(0, Infinity), TypeError);
    assert.throws(() => r.gaussian('0'), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('seed codes', () => {
  const opts = { toggleNames: NAMES };

  it('publishes the format constants', () => {
    assert.ok(Object.isFrozen(SEED_CODE));
    assert.equal(SEED_CODE.alphabet.length, 32);
    assert.equal(new Set(SEED_CODE.alphabet).size, 32);
    assert.ok(!/[ILOU]/.test(SEED_CODE.alphabet));
    assert.equal(SEED_CODE.maxSeed, 2 ** 27 - 1);
    assert.equal(SEED_CODE.maxToggles, 8);
  });

  it('encodes as DIAL plus two groups of four unambiguous base-32 characters', () => {
    const r = makeRng('format');
    for (let i = 0; i < 200; i++) {
      const code = encodeSeedCode({ dial: 'FLUX', seed: r.int(0, SEED_CODE.maxSeed), toggles: r.chance(0.5) ? [r.pick(NAMES)] : [] }, opts);
      assert.match(code, /^FLUX-/);
      assert.match(code.slice(5), PAYLOAD_RE, code);
    }
  });

  it('matches the locked golden codes (layout must never silently change)', () => {
    assert.equal(encodeSeedCode({ dial: 'FLUX', seed: 123456, toggles: [] }), 'FLUX-8003-RJ0T');
    assert.equal(encodeSeedCode({ dial: 'WILD', seed: SEED_CODE.maxSeed, toggles: NAMES }, opts), 'WILD-03ZZ-ZZZW');
  });

  it('round-trips seeds and toggle sets, listing toggles in registry order', () => {
    const seeds = [0, 1, 2, 255, 256, 12345, 123456, 2 ** 26, SEED_CODE.maxSeed - 1, SEED_CODE.maxSeed];
    const sets = [[], [NAMES[0]], [NAMES[7]], [NAMES[5], NAMES[2]], [...NAMES].reverse()];
    for (const seed of seeds) {
      for (const toggles of sets) {
        const code = encodeSeedCode({ dial: 'FLUX', seed, toggles }, opts);
        const expected = NAMES.filter((n) => toggles.includes(n));
        assert.deepEqual(decodeSeedCode(code, opts), { dial: 'FLUX', seed, toggles: expected }, code);
      }
    }
  });

  it('round-trips a thousand random codes', () => {
    const r = makeRng('roundtrip');
    for (let i = 0; i < 1000; i++) {
      const seed = r.int(0, SEED_CODE.maxSeed);
      const toggles = NAMES.filter(() => r.chance(0.5));
      const dial = r.pick(['FLUX', 'CALM', 'WILD', 'STORM2', 'A']);
      assert.deepEqual(decodeSeedCode(encodeSeedCode({ dial, seed, toggles }, opts), opts), { dial, seed, toggles });
    }
  });

  it('whitens the toggle field so no-toggle codes do not share a prefix', () => {
    const r = makeRng('whiten');
    const firstChars = new Set(draws(r, 1000, (x) => encodeSeedCode({ dial: 'FLUX', seed: x.int(0, SEED_CODE.maxSeed) })[5]));
    assert.ok(firstChars.size >= 30, `only ${firstChars.size} distinct leading characters`);
  });

  it('deduplicates toggles and accepts any iterable of names', () => {
    const a = encodeSeedCode({ dial: 'FLUX', seed: 99, toggles: [NAMES[5], NAMES[1], NAMES[5]] }, opts);
    const b = encodeSeedCode({ dial: 'FLUX', seed: 99, toggles: new Set([NAMES[1], NAMES[5]]) }, opts);
    assert.equal(a, b);
    assert.deepEqual(decodeSeedCode(a, opts).toggles, [NAMES[1], NAMES[5]]);
    assert.equal(encodeSeedCode({ dial: 'FLUX', seed: 99, toggles: null }), encodeSeedCode({ dial: 'FLUX', seed: 99 }));
  });

  it('normalises the dial word and rejects malformed ones', () => {
    assert.match(encodeSeedCode({ dial: ' flux ', seed: 1 }), /^FLUX-/);
    assert.equal(decodeSeedCode(encodeSeedCode({ dial: 'Wild2', seed: 1 })).dial, 'WILD2');
    assert.match(encodeSeedCode({ dial: 'A', seed: 1 }), /^A-/);
    assert.match(encodeSeedCode({ dial: 'A'.repeat(16), seed: 1 }), /^A{16}-/);
    for (const bad of ['', '2X', 'FL-UX', 'FL UX', 'A'.repeat(17), 'FLÜX']) {
      assert.throws(() => encodeSeedCode({ dial: bad, seed: 1 }), RangeError, bad);
    }
    for (const bad of [undefined, 42, null]) assert.throws(() => encodeSeedCode({ dial: bad, seed: 1 }), TypeError);
  });

  it('rejects out-of-range seeds and malformed parts', () => {
    for (const bad of [-1, SEED_CODE.maxSeed + 1, 1.5, NaN, '42', undefined]) {
      assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: bad }), RangeError, String(bad));
    }
    for (const bad of [null, undefined, 'FLUX']) assert.throws(() => encodeSeedCode(bad), TypeError);
  });

  it('rejects unknown toggles and bad toggle lists', () => {
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: ['nope'] }, opts), /unknown toggle "nope"/);
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: [NAMES[0]] }), RangeError);
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: NAMES[0] }, opts), TypeError);
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: 42 }, opts), TypeError);
  });

  it('validates the toggle registry passed as an option', () => {
    const parts = { dial: 'FLUX', seed: 1 };
    assert.throws(() => encodeSeedCode(parts, { toggleNames: [...NAMES, 'extra'] }), RangeError);
    assert.throws(() => encodeSeedCode(parts, { toggleNames: ['a', 'a'] }), RangeError);
    assert.throws(() => encodeSeedCode(parts, { toggleNames: ['a', ''] }), TypeError);
    assert.throws(() => encodeSeedCode(parts, { toggleNames: ['a', 1] }), TypeError);
    assert.throws(() => encodeSeedCode(parts, { toggleNames: 'abc' }), TypeError);
    assert.throws(() => decodeSeedCode('FLUX-8003-RJ0T', { toggleNames: [...NAMES, 'extra'] }), RangeError);
  });

  it('decodes leniently: case, whitespace, separators and look-alike letters', () => {
    const code = encodeSeedCode({ dial: 'FLUX', seed: 123456 });
    const expected = { dial: 'FLUX', seed: 123456, toggles: [] };
    assert.deepEqual(decodeSeedCode(code.toLowerCase()), expected);
    assert.deepEqual(decodeSeedCode(`  \n${code}\t `), expected);
    assert.deepEqual(decodeSeedCode(code.replace(/-/g, ' ')), expected);
    assert.deepEqual(decodeSeedCode(code.replace(/-(?=[^-]*$)/, '')), expected);

    let sample = null;
    for (let seed = 0; seed < 5000 && !sample; seed++) {
      const c = encodeSeedCode({ dial: 'CALM', seed });
      if (c.slice(5).includes('0') && c.slice(5).includes('1')) sample = { seed, code: c };
    }
    assert.ok(sample, 'expected some code to contain both 0 and 1');
    const payload = sample.code.slice(5);
    const parts = { dial: 'CALM', seed: sample.seed, toggles: [] };
    assert.deepEqual(decodeSeedCode(`CALM-${payload.replace(/0/g, 'O').replace(/1/g, 'I')}`), parts);
    assert.deepEqual(decodeSeedCode(`calm-${payload.replace(/1/g, 'l').replace(/0/g, 'o')}`), parts);
  });

  it('returns null (never throws) for malformed input', () => {
    const invalid = [null, undefined, 42, {}, '', 'FLUX', 'FLUX-8003', 'FLUX-8003-RJ0', 'FLUX-8003-RJ0T-X',
      '-8003-RJ0T', 'FLUX-80U3-RJ0T', 'FLUX--8003--RJ0T-', '2X-8003-RJ0T', 'FLUX_8003_RJ0T'];
    for (const bad of invalid) assert.equal(decodeSeedCode(bad), null, String(bad));
  });

  it('rejects single-character typos with the checksum', () => {
    const r = makeRng('typos');
    let total = 0;
    let rejected = 0;
    for (let i = 0; i < 100; i++) {
      const parts = { dial: 'FLUX', seed: r.int(0, SEED_CODE.maxSeed), toggles: NAMES.filter(() => r.chance(0.3)) };
      const code = encodeSeedCode(parts, opts);
      const payload = code.slice(5).replace('-', '');
      for (let pos = 0; pos < 8; pos++) {
        const original = payload[pos];
        const replacement = SEED_CODE.alphabet[(SEED_CODE.alphabet.indexOf(original) + 1 + r.int(0, 30)) % 32];
        const mutated = payload.slice(0, pos) + replacement + payload.slice(pos + 1);
        const decoded = decodeSeedCode(`FLUX-${mutated.slice(0, 4)}-${mutated.slice(4)}`, opts);
        total++;
        if (decoded === null) rejected++;
        else assert.notDeepEqual(decoded, { ...parts, toggles: NAMES.filter((n) => parts.toggles.includes(n)) });
      }
    }
    assert.equal(total, 800);
    assert.ok(rejected >= 740, `only ${rejected}/${total} typos rejected`);
  });

  it('covers the dial word with the checksum', () => {
    let rejected = 0;
    for (let seed = 0; seed < 200; seed++) {
      const code = encodeSeedCode({ dial: 'FLUX', seed });
      if (decodeSeedCode(`FLUZ${code.slice(4)}`) === null) rejected++;
    }
    assert.ok(rejected >= 180, `only ${rejected}/200 dial typos rejected`);
  });

  it('returns null for toggle bits the registry cannot name, but accepts appended registries', () => {
    const code = encodeSeedCode({ dial: 'FLUX', seed: 777, toggles: [NAMES[7]] }, opts);
    assert.equal(decodeSeedCode(code, { toggleNames: NAMES.slice(0, 4) }), null);
    assert.equal(decodeSeedCode(code, { toggleNames: NAMES.slice(0, 7) }), null);
    assert.deepEqual(decodeSeedCode(code, opts).toggles, [NAMES[7]]);

    const early = encodeSeedCode({ dial: 'FLUX', seed: 777, toggles: [NAMES[1]] }, { toggleNames: NAMES.slice(0, 2) });
    assert.deepEqual(decodeSeedCode(early, opts).toggles, [NAMES[1]]);
  });
});

// ---------------------------------------------------------------------------

describe('toggle registry', () => {
  afterEach(() => setSeedToggles([]));

  it('is empty and frozen by default', () => {
    assert.deepEqual(getSeedToggles(), []);
    assert.ok(Object.isFrozen(getSeedToggles()));
  });

  it('stores a frozen copy that encode/decode use by default', () => {
    const input = NAMES.slice(0, 3);
    const stored = setSeedToggles(input);
    input.push('later');
    assert.deepEqual(getSeedToggles(), NAMES.slice(0, 3));
    assert.equal(getSeedToggles(), stored);
    assert.ok(Object.isFrozen(stored));

    const code = encodeSeedCode({ dial: 'FLUX', seed: 5, toggles: [NAMES[2], NAMES[0]] });
    assert.deepEqual(decodeSeedCode(code), { dial: 'FLUX', seed: 5, toggles: [NAMES[0], NAMES[2]] });
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 5, toggles: [NAMES[4]] }), RangeError);
  });

  it('validates the list and keeps the previous registry on failure', () => {
    setSeedToggles(['keep']);
    assert.throws(() => setSeedToggles([...NAMES, 'extra']), RangeError);
    assert.throws(() => setSeedToggles(['a', 'a']), RangeError);
    assert.throws(() => setSeedToggles(['a', 7]), TypeError);
    assert.throws(() => setSeedToggles(['']), TypeError);
    assert.throws(() => setSeedToggles('abc'), TypeError);
    assert.throws(() => setSeedToggles(null), TypeError);
    assert.deepEqual(getSeedToggles(), ['keep']);
  });
});

// ---------------------------------------------------------------------------

describe('randomSeedCode', () => {
  const opts = { toggleNames: NAMES };

  it('is deterministic given an entropy rng and matches the golden code', () => {
    assert.equal(randomSeedCode('FLUX', makeRng('entropy')), 'FLUX-E3WJ-E3GK');
    assert.equal(randomSeedCode('FLUX', makeRng('entropy')), randomSeedCode('FLUX', makeRng('entropy')));
  });

  it('decodes to the given dial, an in-range seed and no toggles by default', () => {
    const r = makeRng('codes');
    for (let i = 0; i < 100; i++) {
      const decoded = decodeSeedCode(randomSeedCode('CALM', r));
      assert.ok(decoded);
      assert.equal(decoded.dial, 'CALM');
      assert.ok(Number.isInteger(decoded.seed) && decoded.seed >= 0 && decoded.seed <= SEED_CODE.maxSeed);
      assert.deepEqual(decoded.toggles, []);
    }
  });

  it('consumes exactly one int() draw from the entropy rng', () => {
    const a = makeRng('draw');
    const b = makeRng('draw');
    randomSeedCode('FLUX', a);
    b.int(0, SEED_CODE.maxSeed);
    assert.deepEqual(a.state(), b.state());
  });

  it('can include toggles', () => {
    const code = randomSeedCode('FLUX', makeRng('t'), { toggles: [NAMES[1], NAMES[6]], ...opts });
    assert.deepEqual(decodeSeedCode(code, opts).toggles, [NAMES[1], NAMES[6]]);
  });

  it('uses platform entropy when no rng is given', () => {
    const codes = new Set(Array.from({ length: 30 }, (_, i) => randomSeedCode('FLUX', i % 2 ? null : undefined)));
    assert.ok(codes.size >= 2, 'codes should differ');
    for (const code of codes) {
      const decoded = decodeSeedCode(code);
      assert.ok(decoded && decoded.dial === 'FLUX' && decoded.seed <= SEED_CODE.maxSeed, code);
    }
  });

  it('rejects a bad entropy source or dial', () => {
    assert.throws(() => randomSeedCode('FLUX', {}), TypeError);
    assert.throws(() => randomSeedCode('FLUX', 5), TypeError);
    assert.throws(() => randomSeedCode('', makeRng('x')), RangeError);
    assert.throws(() => randomSeedCode(undefined, makeRng('x')), TypeError);
  });
});

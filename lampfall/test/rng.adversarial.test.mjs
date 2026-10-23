// Adversarial tests for js/core/rng.js: malformed input, boundaries, hostile
// strings, cross-process determinism, state round-trips and large inputs.
// Run: node --test test/rng.adversarial.test.mjs
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as mod from '../js/core/rng.js';

const { hashString, makeRng, Rng, encodeSeedCode, decodeSeedCode, randomSeedCode, setSeedToggles, getSeedToggles, SEED_CODE } = mod;

const TWO_32 = 2 ** 32;
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const NAMES = ['permadeath', 'nomap', 'hardtide', 'realclock', 'fog', 'frost', 'storm', 'quiet'];
const opts = { toggleNames: NAMES };
const MODULE_URL = new URL('../js/core/rng.js', import.meta.url).href;

/** `n` values from `fn(rng)` (defaults to `next()`). */
const draws = (rng, n, fn = (r) => r.next()) => Array.from({ length: n }, () => fn(rng));

/** Runs an async ES-module snippet in a separate Node process and parses its JSON result. */
function inFreshProcess(body) {
  const src = `const out = await (async () => { ${body} })();\nprocess.stdout.write(JSON.stringify(out));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8' }));
}

/** Like {@link inFreshProcess} with the module already imported as `m`. */
function inChildProcess(body) {
  return inFreshProcess(`const m = await import(${JSON.stringify(MODULE_URL)}); ${body}`);
}

/** Number of set bits in a uint32. */
function popcount(x) {
  let c = 0;
  for (x >>>= 0; x; x &= x - 1) c++;
  return c;
}

// ---------------------------------------------------------------------------

describe('API surface', () => {
  it('exports every name the core contract lists', () => {
    for (const name of ['hashString', 'makeRng', 'encodeSeedCode', 'decodeSeedCode', 'randomSeedCode']) {
      assert.equal(typeof mod[name], 'function', name);
    }
    const proto = Rng.prototype;
    for (const [name, arity] of [['next', 0], ['int', 2], ['chance', 1], ['pick', 1], ['shuffle', 1], ['weighted', 1], ['fork', 1], ['state', 0], ['restore', 1], ['gaussian', 0], ['nextUint32', 0]]) {
      assert.equal(typeof proto[name], 'function', name);
      assert.equal(proto[name].length, arity, `${name}.length`);
    }
  });

  it('keeps all generator state private (nothing enumerable, nothing patchable from outside)', () => {
    const r = makeRng('private');
    assert.deepEqual(Object.keys(r), []);
    assert.deepEqual(JSON.parse(JSON.stringify(r)), {});
    assert.throws(() => { r.seed = 'other'; }, TypeError);
    assert.equal(r.seed, 'private');
  });

  it('does not add globals or need the DOM when imported and used', () => {
    const result = inFreshProcess(`
      const before = Object.getOwnPropertyNames(globalThis);
      const m = await import(${JSON.stringify(MODULE_URL)});
      m.makeRng(1).next();
      m.randomSeedCode('FLUX');
      m.setSeedToggles(['a']);
      m.decodeSeedCode('FLUX-8003-RJ0T');
      const after = Object.getOwnPropertyNames(globalThis);
      return { added: after.filter((k) => !before.includes(k)), hasDocument: typeof document, hasWindow: typeof window };
    `);
    assert.deepEqual(result, { added: [], hasDocument: 'undefined', hasWindow: 'undefined' });
  });
});

// ---------------------------------------------------------------------------

describe('determinism across processes', () => {
  it('reproduces every golden value in a fresh Node process', () => {
    const local = {
      hash: hashString('porchlight'),
      raw: draws(makeRng('wildshift'), 4, (r) => r.nextUint32()),
      floats: draws(makeRng(7), 3),
      ints: draws(makeRng('ints'), 20, (r) => r.int(-1000, 1000)),
      wide: draws(makeRng('wide'), 5, (r) => r.int(0, 2 ** 40)),
      gauss: draws(makeRng('g'), 5, (r) => r.gaussian(3, 2)),
      shuffled: makeRng('shuf').shuffle([...Array(20).keys()]),
      fork: makeRng('world').fork('chunk:3,4').fork(9).state(),
      code: encodeSeedCode({ dial: 'FLUX', seed: 123456 }),
      codeToggles: encodeSeedCode({ dial: 'WILD', seed: 42, toggles: [NAMES[2], NAMES[7]] }, opts),
      random: randomSeedCode('FLUX', makeRng('entropy')),
    };
    const remote = inChildProcess(`
      const NAMES = ${JSON.stringify(NAMES)};
      const d = (rng, n, fn = (r) => r.next()) => Array.from({ length: n }, () => fn(rng));
      return {
        hash: m.hashString('porchlight'),
        raw: d(m.makeRng('wildshift'), 4, (r) => r.nextUint32()),
        floats: d(m.makeRng(7), 3),
        ints: d(m.makeRng('ints'), 20, (r) => r.int(-1000, 1000)),
        wide: d(m.makeRng('wide'), 5, (r) => r.int(0, 2 ** 40)),
        gauss: d(m.makeRng('g'), 5, (r) => r.gaussian(3, 2)),
        shuffled: m.makeRng('shuf').shuffle([...Array(20).keys()]),
        fork: m.makeRng('world').fork('chunk:3,4').fork(9).state(),
        code: m.encodeSeedCode({ dial: 'FLUX', seed: 123456 }),
        codeToggles: m.encodeSeedCode({ dial: 'WILD', seed: 42, toggles: [NAMES[2], NAMES[7]] }, { toggleNames: NAMES }),
        random: m.randomSeedCode('FLUX', m.makeRng('entropy')),
      };
    `);
    assert.deepEqual(remote, local);
    assert.equal(local.hash, 2554128684);
    assert.deepEqual(local.raw, [1189000610, 2129617780, 3108808718, 412211399]);
    assert.equal(local.code, 'FLUX-8003-RJ0T');
    assert.equal(local.random, 'FLUX-E3WJ-E3GK');
  });
});

// ---------------------------------------------------------------------------

describe('hashString: hostile and extreme input', () => {
  it('hashes by UTF-16 code unit: lone surrogates, NUL and non-BMP text all work and differ', () => {
    const inputs = ['\uD83E', '\uDD8A', '🦊', '🦊', '\0', '\0\0', 'é', 'é', 'ﬁ', 'fi'];
    const hashes = inputs.map(hashString);
    assert.ok(hashes.every((h) => Number.isInteger(h) && h >= 0 && h < TWO_32));
    assert.equal(hashes[2], hashes[3], 'the same code units hash the same');
    assert.notEqual(hashes[6], hashes[7], 'NFC and NFD are different strings');
    assert.notEqual(hashes[8], hashes[9], 'compatibility ligatures are not folded');
    assert.notEqual(hashes[4], hashes[5]);
  });

  it('shows avalanche: a one-character change flips about half the bits', () => {
    const r = makeRng('avalanche');
    let totalDistance = 0;
    const pairs = 2000;
    for (let i = 0; i < pairs; i++) {
      const base = `label-${r.int(0, 1e9)}`;
      const pos = r.int(0, base.length - 1);
      const flipped = base.slice(0, pos) + String.fromCharCode(base.charCodeAt(pos) ^ 1) + base.slice(pos + 1);
      totalDistance += popcount(hashString(base) ^ hashString(flipped));
    }
    const mean = totalDistance / pairs;
    assert.ok(mean > 14 && mean < 18, `mean Hamming distance ${mean}, expected about 16`);
  });

  it('handles multi-megabyte strings in linear time', () => {
    const big = 'porch'.repeat(1_000_000);
    const t = performance.now();
    const h = hashString(big);
    assert.ok(performance.now() - t < 2000);
    assert.equal(h, hashString(big));
    assert.notEqual(h, hashString(big + 'x'));
  });

  it('rejects wrapper objects, bigints and symbols rather than coercing them', () => {
    for (const bad of [new String('x'), 1n, Symbol('x'), ['x'], { toString: () => 'x' }]) {
      assert.throws(() => hashString(bad), TypeError);
    }
  });
});

// ---------------------------------------------------------------------------

describe('makeRng: seed keys', () => {
  it('uses string seeds verbatim, so near-miss strings are different worlds', () => {
    const keys = ['42', ' 42', '42 ', '4.2e1', '+42', '042', '42\0'];
    const states = new Set(keys.map((k) => makeRng(k).state().join(',')));
    assert.equal(states.size, keys.length);
    assert.deepEqual(makeRng(42).state(), makeRng('42').state());
  });

  it('keys numbers by their decimal string, including exotic ones', () => {
    assert.equal(makeRng(1e21).seed, '1e+21');
    assert.equal(makeRng(0.1 + 0.2).seed, '0.30000000000000004');
    assert.equal(makeRng(-0).seed, '0');
    assert.equal(makeRng(Number.MIN_VALUE).seed, '5e-324');
    assert.equal(makeRng(MAX_SAFE).seed, '9007199254740991');
  });

  it('accepts very long and NUL-laden string seeds', () => {
    const long = '\0'.repeat(100_000) + 'x';
    assert.notDeepEqual(makeRng(long).state(), makeRng(long.slice(0, -1)).state());
    assert.deepEqual(makeRng(long).state(), makeRng(long).state());
  });

  it('never starts from the forbidden all-zero state across many seeds', () => {
    for (let i = 0; i < 20_000; i++) {
      const s = makeRng(i).state();
      assert.ok(s.some((v) => v !== 0), `seed ${i}`);
    }
  });

  it('spreads sequential integer seeds into distinct states and balanced first outputs', () => {
    const seen = new Set();
    let ones = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const r = makeRng(i);
      seen.add(r.state().join(','));
      ones += r.nextUint32() & 1;
    }
    assert.equal(seen.size, n);
    assert.ok(Math.abs(ones / n - 0.5) < 0.01, `low-bit rate ${ones / n}`);
  });
});

// ---------------------------------------------------------------------------

describe('int: boundaries', () => {
  it('rejects bounds outside the safe-integer range (results could not be exact)', () => {
    const r = makeRng('unsafe');
    const before = r.state();
    for (const [lo, hi] of [[2 ** 53, 2 ** 53 + 10], [-(2 ** 53), -1], [0, 2 ** 60], [2 ** 60, 2 ** 60], [-1e300, 0], [0, 1e16]]) {
      assert.throws(() => r.int(lo, hi), RangeError, `[${lo}, ${hi}]`);
    }
    assert.deepEqual(r.state(), before, 'no draw consumed on failure');
  });

  it('accepts the extreme safe bounds', () => {
    const r = makeRng('safe');
    assert.ok([MAX_SAFE - 1, MAX_SAFE].includes(r.int(MAX_SAFE - 1, MAX_SAFE)));
    assert.ok([-MAX_SAFE, -MAX_SAFE + 1].includes(r.int(-MAX_SAFE, -MAX_SAFE + 1)));
    assert.equal(r.int(MAX_SAFE, MAX_SAFE), MAX_SAFE);
    assert.equal(r.int(-MAX_SAFE, -MAX_SAFE), -MAX_SAFE);
    const full = r.int(-(2 ** 52), 2 ** 52 - 1);
    assert.ok(Number.isSafeInteger(full));
  });

  it('uses one draw for exactly 2^32 values and two for 2^32 + 1', () => {
    const one = makeRng('width');
    const two = makeRng('width');
    const ref = makeRng('width');
    one.int(0, TWO_32 - 1);
    ref.next();
    assert.deepEqual(one.state(), ref.state());
    two.int(0, TWO_32);
    ref.next();
    assert.deepEqual(two.state(), ref.state());
  });

  it('is uniform on a 1000-value range', () => {
    const r = makeRng('chi');
    const buckets = new Array(1000).fill(0);
    const n = 200_000;
    for (let i = 0; i < n; i++) buckets[r.int(0, 999)]++;
    const expected = n / 1000;
    let chi2 = 0;
    for (const b of buckets) chi2 += (b - expected) ** 2 / expected;
    // 999 degrees of freedom: mean 999, sd ~44.7; 1200 is far beyond any plausible fluctuation.
    assert.ok(chi2 < 1200, `chi-square ${chi2}`);
    assert.ok(buckets.every((b) => b > 0));
  });

  it('reaches both ends of a 53-bit range and stays uniform in the top bits', () => {
    const r = makeRng('top');
    const max = 2 ** 53 - 1;
    let low = 0;
    let high = 0;
    for (let i = 0; i < 5000; i++) {
      const v = r.int(0, max);
      assert.ok(Number.isSafeInteger(v) && v >= 0 && v <= max);
      if (v < max * 0.1) low++;
      if (v > max * 0.9) high++;
    }
    assert.ok(low > 350 && low < 650, `low decile ${low}`);
    assert.ok(high > 350 && high < 650, `high decile ${high}`);
  });

  it('stays deterministic on ranges with a high rejection rate', () => {
    const n = 2 ** 31 + 1; // rejects ~50% of raw draws
    assert.deepEqual(draws(makeRng('rej'), 50, (r) => r.int(0, n - 1)), draws(makeRng('rej'), 50, (r) => r.int(0, n - 1)));
    const wide = 2 ** 52 + 1;
    assert.deepEqual(draws(makeRng('rej2'), 50, (r) => r.int(0, wide - 1)), draws(makeRng('rej2'), 50, (r) => r.int(0, wide - 1)));
  });

  it('treats -0 like 0 and swaps nothing silently', () => {
    const r = makeRng('zero');
    assert.equal(r.int(-0, 0), 0);
    assert.throws(() => r.int(5, 1), RangeError);
    assert.throws(() => r.int(0.5, 0.4), RangeError);
  });

  it('rejects bigint, boolean and string bounds', () => {
    const r = makeRng('types');
    for (const bad of [1n, true, '1', null, undefined, [], {}]) {
      assert.throws(() => r.int(bad, 10), TypeError, String(bad));
      assert.throws(() => r.int(0, bad), TypeError, String(bad));
    }
  });
});

// ---------------------------------------------------------------------------

describe('chance: edge probabilities', () => {
  it('handles probabilities below the generator resolution and tiny epsilons', () => {
    const r = makeRng('tiny');
    const hits = draws(r, 100_000, (x) => x.chance(1e-12)).filter(Boolean).length;
    assert.ok(hits <= 1, `${hits} hits for p=1e-12`);
    assert.ok(draws(r, 1000, (x) => x.chance(1 - 1e-12)).every(Boolean));
    assert.equal(r.chance(Number.MIN_VALUE), false);
    assert.equal(r.chance(-0), false);
  });

  it('rejects bigint and boolean probabilities', () => {
    const r = makeRng('t');
    for (const bad of [1n, true, [], Symbol('p')]) assert.throws(() => r.chance(bad), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('pick / shuffle: array-likes and large input', () => {
  it('index both by code unit, so strings with non-BMP characters are consistent', () => {
    const text = '🦊ab'; // length 4 (two code units for the fox)
    const a = makeRng('units');
    const b = makeRng('units');
    const out = a.shuffle(text);
    assert.equal(out.length, text.length);
    assert.deepEqual([...out].sort(), [...text.split('')].sort());
    draws(b, text.length - 1);
    assert.deepEqual(a.state(), b.state(), 'shuffle consumes length - 1 draws for strings too');
    assert.ok(text.split('').includes(makeRng('u2').pick(text)));
  });

  it('copies holes and array-like objects by index', () => {
    const r = makeRng('holes');
    const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
    const out = r.shuffle(sparse);
    assert.equal(out.length, 3);
    assert.ok(out.includes(undefined) && out.includes(1) && out.includes(3));
    const like = { length: 3, 0: 'x', 1: 'y', 2: 'z' };
    assert.deepEqual(r.shuffle(like).sort(), ['x', 'y', 'z']);
    assert.ok(['x', 'y', 'z'].includes(r.pick(like)));
  });

  it('shuffles 100k elements quickly into a permutation without touching the input', () => {
    const input = Object.freeze(Array.from({ length: 100_000 }, (_, i) => i));
    const t = performance.now();
    const out = makeRng('big').shuffle(input);
    assert.ok(performance.now() - t < 2000);
    assert.equal(out.length, input.length);
    const sorted = [...out].sort((a, b) => a - b);
    assert.ok(sorted.every((v, i) => v === i));
    assert.ok(out.some((v, i) => v !== i));
  });

  it('picks from a million-element typed array', () => {
    const big = new Uint32Array(1_000_000).map((_, i) => i);
    const r = makeRng('million');
    const seen = new Set(draws(r, 1000, (x) => x.pick(big)));
    assert.ok(seen.size > 990, 'picks should be spread out');
    assert.ok([...seen].every((v) => v >= 0 && v < big.length));
  });

  it('rejects negative or fractional lengths and functions', () => {
    const r = makeRng('len');
    for (const bad of [{ length: -1 }, { length: 1.5 }, { length: NaN }, { length: '3' }, () => {}, Math.max]) {
      assert.throws(() => r.pick(bad), TypeError);
      assert.throws(() => r.shuffle(bad), TypeError);
    }
  });
});

// ---------------------------------------------------------------------------

describe('weighted: numeric extremes', () => {
  it('rejects weights that overflow the sum instead of silently favouring the last entry', () => {
    const r = makeRng('overflow');
    const before = r.state();
    assert.throws(() => r.weighted([{ w: 1e308, v: 'a' }, { w: 1e308, v: 'b' }, { w: 1, v: 'c' }]), RangeError);
    assert.deepEqual(r.state(), before, 'no draw consumed');
  });

  it('handles huge finite and subnormal weights proportionally', () => {
    const big = draws(makeRng('huge'), 2000, (r) => r.weighted([{ w: 1e307, v: 'a' }, { w: 1e307, v: 'b' }]));
    const aCount = big.filter((v) => v === 'a').length;
    assert.ok(aCount > 850 && aCount < 1150, `a: ${aCount}`);
    const tiny = draws(makeRng('tiny'), 2000, (r) => r.weighted([{ w: Number.MIN_VALUE, v: 'never' }, { w: 1, v: 'always' }]));
    assert.ok(tiny.every((v) => v === 'always'));
    const mixed = draws(makeRng('mix'), 4000, (r) => r.weighted([{ w: 1e-300, v: 'a' }, { w: 1e-300, v: 'b' }]));
    const a = mixed.filter((v) => v === 'a').length;
    assert.ok(a > 1800 && a < 2200, `a: ${a}`);
  });

  it('validates every entry before drawing, so a bad trailing entry cannot desync the stream', () => {
    const r = makeRng('validate');
    const before = r.state();
    assert.throws(() => r.weighted([{ w: 1, v: 'ok' }, { w: NaN, v: 'bad' }]), TypeError);
    assert.throws(() => r.weighted([{ w: 1, v: 'ok' }, 'bad']), TypeError);
    assert.throws(() => r.weighted([{ w: 1, v: 'ok' }, { w: 1n, v: 'bad' }]), TypeError);
    assert.deepEqual(r.state(), before);
  });

  it('accepts array-like tables and entries whose v is falsy or undefined', () => {
    const r = makeRng('falsy');
    const table = { length: 3, 0: { w: 1, v: 0 }, 1: { w: 1, v: '' }, 2: { w: 1 } };
    const seen = new Set(draws(r, 300, (x) => x.weighted(table)));
    assert.deepEqual([...seen].map(String).sort(), ['', '0', 'undefined']);
  });

  it('never returns an ineligible entry, even with 10k entries and one eligible', () => {
    const table = Array.from({ length: 10_000 }, (_, i) => ({ w: i === 7777 ? 1 : 0, v: i }));
    assert.ok(draws(makeRng('needle'), 200, (r) => r.weighted(table)).every((v) => v === 7777));
  });
});

// ---------------------------------------------------------------------------

describe('fork: labels and independence', () => {
  it('rejects non-finite numeric labels like makeRng does', () => {
    const r = makeRng('world');
    for (const bad of [NaN, Infinity, -Infinity, 1n, Symbol('x')]) assert.throws(() => r.fork(bad), TypeError, String(bad));
  });

  it('treats -0, 0 and "0" as the same label', () => {
    const r = makeRng('world');
    assert.equal(r.fork(-0).seed, r.fork(0).seed);
    assert.deepEqual(r.fork(0).state(), r.fork('0').state());
  });

  it('documents the separator aliasing: a label containing U+001F equals a nested fork', () => {
    const r = makeRng('world');
    assert.equal(r.fork('a\u001fb').seed, r.fork('a').fork('b').seed);
    assert.notEqual(r.fork('a:b').seed, r.fork('a').fork('b').seed);
  });

  it('gives 20k chunk forks distinct states', () => {
    const w = makeRng('world');
    const seen = new Set();
    for (let x = 0; x < 100; x++) for (let y = 0; y < 200; y++) seen.add(w.fork(`chunk:${x},${y}`).state().join(','));
    assert.equal(seen.size, 20_000);
  });

  it('nests 200 levels deep and remains reproducible from the seed key', () => {
    let r = makeRng('root');
    for (let i = 0; i < 200; i++) r = r.fork(i);
    assert.deepEqual(makeRng(r.seed).state(), r.state());
    assert.ok(r.seed.length > 400);
  });

  it('is unaffected by interleaved use of parent, sibling and child streams', () => {
    const reference = draws(makeRng('w').fork('a'), 30);
    const parent = makeRng('w');
    const child = parent.fork('a');
    const sibling = parent.fork('b');
    const out = [];
    for (let i = 0; i < 30; i++) {
      parent.next();
      sibling.int(0, 9);
      out.push(child.next());
      child.fork('grandchild').next();
      parent.gaussian();
    }
    assert.deepEqual(out, reference);
    assert.deepEqual(draws(parent.fork('a'), 30), reference, 'forking after draws still yields the stable stream');
  });

  it('works on a restored generator and on one restored from a fork', () => {
    const r = makeRng('w');
    const f = r.fork('x');
    draws(f, 5);
    const snapshot = f.state();
    const g = makeRng('w').fork('x').restore(snapshot);
    assert.deepEqual(draws(g, 5), draws(f, 5));
    assert.equal(g.seed, f.seed);
  });
});

// ---------------------------------------------------------------------------

describe('state / restore: round-trips and tampering', () => {
  it('survives a save-style JSON round-trip and captures gaussian mid-stream (no hidden spare)', () => {
    const a = makeRng('save');
    a.gaussian();
    a.int(0, 100);
    const saved = JSON.stringify({ rng: a.state(), seed: a.seed });
    const future = [a.gaussian(), a.gaussian(), a.next(), a.int(0, 9)];
    const { rng, seed } = JSON.parse(saved);
    const b = makeRng(seed).restore(rng);
    assert.deepEqual([b.gaussian(), b.gaussian(), b.next(), b.int(0, 9)], future);
  });

  it('does not alias the array passed to restore()', () => {
    const r = makeRng('alias');
    const arr = [1, 2, 3, 4];
    r.restore(arr);
    arr[0] = 999;
    assert.deepEqual(r.state(), [1, 2, 3, 4]);
    const s = r.state();
    s.length = 0;
    assert.equal(r.state().length, 4);
  });

  it('accepts extreme valid words and array-like objects', () => {
    const r = makeRng('x');
    assert.deepEqual(r.restore([TWO_32 - 1, 0, 0, 0]).state(), [TWO_32 - 1, 0, 0, 0]);
    assert.deepEqual(r.restore({ length: 4, 0: 0, 1: 0, 2: 0, 3: 1 }).state(), [0, 0, 0, 1]);
    assert.deepEqual(r.restore(new Float64Array([5, 6, 7, 8])).state(), [5, 6, 7, 8]);
    assert.deepEqual(r.restore([-0, 0, 0, 1]).state(), [0, 0, 0, 1]);
  });

  it('rejects tampered or lossy states atomically', () => {
    const r = makeRng('guard');
    const before = r.state();
    const bads = [
      [1, 2, 3, 4.000001], [1, 2, 3, '4'], [1, 2, 3, null], [1, 2, 3, undefined], [1, 2, 3, 4n],
      [1, 2, 3, TWO_32], [1, 2, 3, -1], [1, 2, 3, NaN], [1, 2, 3, Infinity], [0, 0, 0, 0],
      new Uint32Array(0), new Uint32Array(5), Object.assign([1, 2, 3, 4], { length: 3 }),
    ];
    for (const bad of bads) assert.throws(() => r.restore(bad), (e) => e instanceof TypeError || e instanceof RangeError, String(bad));
    assert.throws(() => r.restore(new Set([1, 2, 3, 4])), TypeError);
    assert.throws(() => r.restore(() => {}), TypeError);
    assert.deepEqual(r.state(), before);
  });

  it('never reaches the all-zero state while running', () => {
    const r = makeRng('x').restore([0, 0, 0, 1]);
    for (let i = 0; i < 50_000; i++) {
      r.nextUint32();
      if (i % 997 === 0) assert.ok(r.state().some((v) => v !== 0));
    }
    assert.ok(r.state().some((v) => v !== 0));
  });
});

// ---------------------------------------------------------------------------

describe('gaussian: parameters', () => {
  it('mirrors for a negative sd and shifts for extreme means', () => {
    const pos = draws(makeRng('mirror'), 200, (r) => r.gaussian(0, 2));
    const neg = draws(makeRng('mirror'), 200, (r) => r.gaussian(0, -2));
    assert.deepEqual(neg, pos.map((v) => -v));
    assert.ok(draws(makeRng('far'), 100, (r) => r.gaussian(1e300, 1)).every((v) => v === 1e300));
  });

  it('is identical whether or not the stream is restored between calls', () => {
    const a = makeRng('mid');
    const b = makeRng('mid');
    const seq = draws(a, 10, (r) => r.gaussian());
    const out = [];
    for (let i = 0; i < 10; i++) {
      const s = b.state();
      out.push(makeRng('other').restore(s).gaussian());
      b.restore(s).gaussian();
    }
    assert.deepEqual(out, seq);
  });

  it('rejects bigint and null parameters', () => {
    const r = makeRng('g');
    assert.throws(() => r.gaussian(1n), TypeError);
    assert.throws(() => r.gaussian(null), TypeError);
    assert.throws(() => r.gaussian(0, null), TypeError);
  });
});

// ---------------------------------------------------------------------------

describe('seed codes: options handling', () => {
  afterEach(() => setSeedToggles([]));

  it('accepts null or undefined options everywhere', () => {
    const parts = { dial: 'FLUX', seed: 77 };
    assert.equal(encodeSeedCode(parts, null), encodeSeedCode(parts));
    assert.equal(encodeSeedCode(parts, undefined), encodeSeedCode(parts));
    assert.equal(encodeSeedCode(parts, { toggleNames: undefined }), encodeSeedCode(parts));
    const code = encodeSeedCode(parts);
    assert.deepEqual(decodeSeedCode(code, null), decodeSeedCode(code));
    assert.deepEqual(decodeSeedCode(code, {}), decodeSeedCode(code));
    assert.equal(randomSeedCode('FLUX', makeRng('e'), null), randomSeedCode('FLUX', makeRng('e')));
    assert.equal(randomSeedCode('FLUX', makeRng('e'), {}), randomSeedCode('FLUX', makeRng('e')));
  });

  it('throws for an invalid toggleNames option regardless of whether the code is valid', () => {
    for (const code of ['FLUX-8003-RJ0T', 'FLUX-8003-RJ0A', 'garbage', '', 42, null]) {
      assert.throws(() => decodeSeedCode(code, { toggleNames: 'bad' }), TypeError, String(code));
      assert.throws(() => decodeSeedCode(code, { toggleNames: [...NAMES, 'extra'] }), RangeError, String(code));
    }
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1 }, { toggleNames: null }), TypeError);
    assert.throws(() => randomSeedCode('FLUX', makeRng('e'), { toggleNames: 5 }), TypeError);
  });

  it('lets a per-call registry override the global one in both directions', () => {
    setSeedToggles(['alpha', 'beta']);
    const viaRegistry = encodeSeedCode({ dial: 'FLUX', seed: 9, toggles: ['beta'] });
    const viaOption = encodeSeedCode({ dial: 'FLUX', seed: 9, toggles: [NAMES[1]] }, opts);
    assert.equal(viaRegistry, viaOption, 'bit 1 is bit 1 whatever it is called');
    assert.deepEqual(decodeSeedCode(viaRegistry).toggles, ['beta']);
    assert.deepEqual(decodeSeedCode(viaRegistry, opts).toggles, [NAMES[1]]);
    assert.equal(decodeSeedCode(viaRegistry, { toggleNames: [] }), null);
    assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 9, toggles: ['beta'] }, opts), RangeError);
  });

  it('keeps the registry immutable from the outside', () => {
    const stored = setSeedToggles(['a']);
    assert.throws(() => { stored.push('b'); }, TypeError);
    assert.throws(() => { stored[0] = 'z'; }, TypeError);
    assert.deepEqual(getSeedToggles(), ['a']);
    const decoded = decodeSeedCode(encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: ['a'] }));
    decoded.toggles.push('tampered');
    assert.deepEqual(getSeedToggles(), ['a']);
  });
});

// ---------------------------------------------------------------------------

describe('seed codes: lenient decoding of real-world paste damage', () => {
  const code = encodeSeedCode({ dial: 'FLUX', seed: 123456 });
  const expected = { dial: 'FLUX', seed: 123456, toggles: [] };
  const [dial, g1, g2] = code.split('-');

  it('accepts hyphen and dash look-alikes from word processors and phone keyboards', () => {
    for (const dash of ['‐', '‑', '‒', '–', '—', '―', '−', '－']) {
      assert.deepEqual(decodeSeedCode(`${dial}${dash}${g1}${dash}${g2}`), expected, `U+${dash.codePointAt(0).toString(16)}`);
      assert.deepEqual(decodeSeedCode(`${dial} ${dash} ${g1} ${dash} ${g2}`), expected);
    }
  });

  it('accepts full-width (IME) characters and exotic whitespace', () => {
    const fullwidth = [...`${dial}-${g1}-${g2}`].map((ch) => (ch === '-' ? '－' : String.fromCodePoint(ch.codePointAt(0) + 0xFEE0))).join('');
    assert.deepEqual(decodeSeedCode(fullwidth), expected);
    assert.deepEqual(decodeSeedCode(`　${dial} ${g1} ${g2}　`), expected);
    assert.deepEqual(decodeSeedCode(`${dial}\n${g1}\r\n${g2}\n`), expected);
  });

  it('still rejects separators that are not dashes or whitespace', () => {
    for (const sep of ['_', '.', ':', '/', '+', '=', '|']) {
      assert.equal(decodeSeedCode(`${dial}${sep}${g1}${sep}${g2}`), null, sep);
    }
    assert.equal(decodeSeedCode(`${dial}${g1}${g2}`), null, 'no separator at all is ambiguous');
    assert.equal(decodeSeedCode(`${dial}${g1}-${g2}`), null);
  });

  it('keeps the dial word literal (no I/L/O substitution there)', () => {
    const oil = encodeSeedCode({ dial: 'OIL', seed: 5 });
    assert.deepEqual(decodeSeedCode(oil.toLowerCase()), { dial: 'OIL', seed: 5, toggles: [] });
    assert.equal(decodeSeedCode(oil.replace(/^OIL/, '01L')), null);
  });

  it('returns null, never throws, for hostile strings', () => {
    const hostile = [
      'FLUX-8003-RJ0T​', '​FLUX-8003-RJ0T', 'FLUX-80​03-RJ0T', 'FLUX-8003-RJ0T\0', 'FLUX-8003-RJ\u0000T',
      'FLUX-\uD83E-RJ0T', '\uD800-8003-RJ0T', 'FLUX-8003-RJ0T-', '-FLUX-8003-RJ0T', 'FLUX-8003-RJ0TT', 'FLUX-8003-RJ0',
      'FLUX-8003--RJ0T-X', '(FLUX)-8003-RJ0T', 'FLUX-8003-RJ0T\n\nFLUX-8003-RJ0T', 'FLUX-8003-RJ0T FLUX', '*', '^$', '[A-Z]-8003-RJ0T',
      'ß-8003-RJ0T', 'FLUX-ẞ003-RJ0T', 'ﬂux-8003-rj0t',
    ];
    for (const s of hostile) {
      let out;
      assert.doesNotThrow(() => { out = decodeSeedCode(s); }, JSON.stringify(s));
      if (out !== null) assert.deepEqual(out, expected, JSON.stringify(s));
    }
    for (const notString of [{ toString: () => code }, [code], Symbol('c'), 1n, true, () => code]) {
      assert.equal(decodeSeedCode(notString), null);
    }
  });

  it('rejects megabyte-sized input quickly', () => {
    const inputs = ['A'.repeat(1_000_000), 'FLUX' + ' '.repeat(1_000_000) + '8003 RJ0', 'FLUX-8003-RJ0T' + '-'.repeat(1_000_000), '-'.repeat(500_000) + ' '.repeat(500_000), 'FLUX ' + '8003 '.repeat(200_000), 'FLUX-8003-RJ0T'.repeat(100_000)];
    const t = performance.now();
    for (const s of inputs) assert.equal(decodeSeedCode(s), null);
    assert.ok(performance.now() - t < 3000, `took ${performance.now() - t}ms`);
    // A megabyte of padding around a valid code is still accepted.
    assert.deepEqual(decodeSeedCode(' '.repeat(500_000) + 'FLUX' + ' '.repeat(500_000) + '8003 RJ0T'), expected);
  });
});

// ---------------------------------------------------------------------------

describe('seed codes: exhaustive-ish round trips and checksum strength', () => {
  it('round-trips every toggle mask and the seed boundary bands', () => {
    const seeds = [];
    for (let s = 0; s < 300; s++) seeds.push(s, SEED_CODE.maxSeed - s);
    for (let s = 0; s < 27; s++) seeds.push(2 ** s, 2 ** s - 1);
    for (const seed of seeds) {
      for (let mask = 0; mask < 256; mask += seed % 7 === 0 ? 1 : 37) {
        const toggles = NAMES.filter((_, i) => mask & (1 << i));
        const code = encodeSeedCode({ dial: 'A1', seed, toggles }, opts);
        assert.match(code, /^A1-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
        assert.deepEqual(decodeSeedCode(code, opts), { dial: 'A1', seed, toggles }, code);
      }
    }
  });

  it('produces distinct codes for distinct (seed, toggles) pairs under one dial', () => {
    const r = makeRng('distinct');
    const seen = new Map();
    for (let i = 0; i < 20_000; i++) {
      const seed = r.int(0, SEED_CODE.maxSeed);
      const toggles = NAMES.filter(() => r.chance(0.2));
      const key = `${seed}|${toggles.join()}`;
      const code = encodeSeedCode({ dial: 'FLUX', seed, toggles }, opts);
      if (seen.has(code)) assert.equal(seen.get(code), key, `collision on ${code}`);
      seen.set(code, key);
    }
  });

  it('rejects adjacent transpositions and dial typos on long dials', () => {
    const r = makeRng('swap');
    let total = 0;
    let rejected = 0;
    for (let i = 0; i < 300; i++) {
      const code = encodeSeedCode({ dial: 'FLUX', seed: r.int(0, SEED_CODE.maxSeed) });
      const p = code.slice(5).replace('-', '');
      for (let k = 0; k < 7; k++) {
        if (p[k] === p[k + 1]) continue;
        const m = p.slice(0, k) + p[k + 1] + p[k] + p.slice(k + 2);
        total++;
        if (decodeSeedCode(`FLUX-${m.slice(0, 4)}-${m.slice(4)}`) === null) rejected++;
      }
    }
    assert.ok(rejected / total > 0.9, `transpositions rejected ${rejected}/${total}`);

    const dial = 'LIGHTHOUSEKEEPER';
    let dialRejected = 0;
    for (let seed = 0; seed < 200; seed++) {
      const code = encodeSeedCode({ dial, seed });
      const typo = dial.slice(0, seed % dial.length) + 'Z' + dial.slice((seed % dial.length) + 1);
      if (typo !== dial && decodeSeedCode(typo + code.slice(dial.length)) === null) dialRejected++;
    }
    assert.ok(dialRejected >= 180, `dial typos rejected ${dialRejected}/200`);
  });

  it('is case-insensitive for the dial in both directions', () => {
    const a = encodeSeedCode({ dial: 'flux', seed: 10 });
    const b = encodeSeedCode({ dial: 'FLUX', seed: 10 });
    const c = encodeSeedCode({ dial: 'Flux', seed: 10 });
    assert.equal(a, b);
    assert.equal(b, c);
    assert.deepEqual(decodeSeedCode('fLuX' + a.slice(4)), decodeSeedCode(a));
  });

  it('rejects dials that are not plain ASCII words after trimming and upper-casing', () => {
    for (const bad of ['ｆｌｕｘ', 'FL​UX', 'F L U X', 'FLUX-', '-FLUX', 'FLUX\u001f', 'ÉCLAT', 'FLUX!', '1FLUX', '']) {
      assert.throws(() => encodeSeedCode({ dial: bad, seed: 1 }), RangeError, JSON.stringify(bad));
    }
    assert.throws(() => encodeSeedCode({ dial: new String('FLUX'), seed: 1 }), TypeError);
    // Documented consequence of String#toUpperCase: a few letters expand to ASCII words.
    assert.match(encodeSeedCode({ dial: 'ﬂux', seed: 1 }), /^FLUX-/);
    assert.match(encodeSeedCode({ dial: 'straße', seed: 1 }), /^STRASSE-/);
    assert.match(encodeSeedCode({ dial: '\n flux \t', seed: 1 }), /^FLUX-/);
  });

  it('rejects seeds that are not plain safe integers in range', () => {
    for (const bad of [1n, true, [], {}, '1', 1e-7, 2 ** 27, Number.MAX_SAFE_INTEGER, -0.5, 1 + 2 ** -52]) {
      assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: bad }), RangeError, String(bad));
    }
    assert.equal(encodeSeedCode({ dial: 'FLUX', seed: -0 }), encodeSeedCode({ dial: 'FLUX', seed: 0 }));
    assert.equal(decodeSeedCode(encodeSeedCode({ dial: 'FLUX', seed: -0 })).seed, 0);
  });

  it('rejects toggle lists that are strings, maps or contain non-names', () => {
    for (const bad of ['fog', new Map([['fog', true]]), 42, true, { fog: true }]) {
      assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: bad }, opts), (e) => e instanceof TypeError || e instanceof RangeError, String(bad));
    }
    for (const bad of [[undefined], [null], [0], [['fog']], ['FOG']]) {
      assert.throws(() => encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: bad }, opts), RangeError, JSON.stringify(bad));
    }
    assert.equal(encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: (function* gen() { yield 'fog'; yield 'fog'; })() }, opts), encodeSeedCode({ dial: 'FLUX', seed: 1, toggles: ['fog'] }, opts));
  });
});

// ---------------------------------------------------------------------------

describe('randomSeedCode: entropy sources', () => {
  it('propagates an out-of-range seed from a misbehaving entropy source', () => {
    assert.throws(() => randomSeedCode('FLUX', { int: () => SEED_CODE.maxSeed + 1 }), RangeError);
    assert.throws(() => randomSeedCode('FLUX', { int: () => -1 }), RangeError);
    assert.throws(() => randomSeedCode('FLUX', { int: () => 1.5 }), RangeError);
    assert.throws(() => randomSeedCode('FLUX', { int: () => { throw new Error('boom'); } }), /boom/);
  });

  it('accepts a duck-typed entropy source and asks it for the full seed range', () => {
    let args;
    const code = randomSeedCode('FLUX', { int: (lo, hi) => { args = [lo, hi]; return 123456; } });
    assert.deepEqual(args, [0, SEED_CODE.maxSeed]);
    assert.equal(code, 'FLUX-8003-RJ0T');
  });

  it('draws well-spread seeds from platform entropy', () => {
    const seeds = new Set(Array.from({ length: 300 }, () => decodeSeedCode(randomSeedCode('CALM')).seed));
    assert.ok(seeds.size >= 295, `only ${seeds.size} distinct seeds`);
    assert.ok([...seeds].some((s) => s > SEED_CODE.maxSeed / 2) && [...seeds].some((s) => s < SEED_CODE.maxSeed / 2));
  });

  it('normalises the dial and carries toggles through', () => {
    const code = randomSeedCode(' calm ', makeRng('x'), { toggles: new Set([NAMES[0], NAMES[0]]), ...opts });
    assert.match(code, /^CALM-/);
    assert.deepEqual(decodeSeedCode(code, opts).toggles, [NAMES[0]]);
    assert.throws(() => randomSeedCode('calm', makeRng('x'), { toggles: ['nope'], ...opts }), RangeError);
    assert.throws(() => randomSeedCode(42, makeRng('x')), TypeError);
    assert.throws(() => randomSeedCode('calm', makeRng('x'), { toggles: 'fog', ...opts }), TypeError);
  });
});

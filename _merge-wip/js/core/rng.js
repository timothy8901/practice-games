/**
 * Deterministic random numbers and shareable seed codes for the game core.
 *
 * Pure module: no DOM access, no timers and no module-level side effects, so
 * it runs unchanged under Node (`node --test`) and in the browser.
 *
 * - {@link hashString}: 32-bit string hash (FNV-1a with a murmur3 finaliser).
 * - {@link makeRng}: seeded xoshiro128** generator with label-derived
 *   {@link Rng#fork forks} and save-friendly {@link Rng#state state}.
 * - {@link encodeSeedCode} / {@link decodeSeedCode} / {@link randomSeedCode}:
 *   human-friendly `DIAL-XXXX-XXXX` codes carrying a seed, up to eight named
 *   toggles and a typo-detecting checksum.
 *
 * @module core/rng
 */

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

const FNV_OFFSET_BASIS = 0x811c9dc5;
/** Alternate basis so one string yields a second, decorrelated 32-bit word. */
const FNV_ALT_BASIS = 0x9e3779b9;
const FNV_PRIME = 0x01000193;
/** Weyl-sequence increment used by splitmix32 to expand a seed into state. */
const GOLDEN_GAMMA = 0x9e3779b9;
const TWO_32 = 0x100000000;
const TWO_53 = 2 ** 53;

/**
 * murmur3's 32-bit finaliser: every input bit influences every output bit.
 * @param {number} h any int32/uint32
 * @returns {number} uint32
 */
function fmix32(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * FNV-1a over UTF-16 code units, finalised with {@link fmix32} so short or
 * similar strings still differ in every bit (important for the 5-bit checksum
 * and for seeding).
 * @param {string} str
 * @param {number} basis starting hash value
 * @returns {number} uint32
 */
function fnv1a32(str, basis) {
  let h = basis | 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), FNV_PRIME);
  }
  return fmix32(h);
}

/**
 * Human-readable type name for error messages.
 * @param {unknown} v
 * @returns {string}
 */
function describe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Hashes a string to an unsigned 32-bit integer. Deterministic across runs
 * and platforms; the same string always yields the same value.
 *
 * @param {string} str text to hash (any Unicode; hashed by UTF-16 code unit)
 * @returns {number} integer in `[0, 2^32)`
 * @throws {TypeError} when `str` is not a string
 */
export function hashString(str) {
  if (typeof str !== 'string') {
    throw new TypeError(`hashString: expected a string, got ${describe(str)}`);
  }
  return fnv1a32(str, FNV_OFFSET_BASIS);
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/** ASCII "unit separator": joins a parent seed key and a fork label. */
const FORK_SEPARATOR = '\u001f';

/**
 * Canonical string form of a seed. Numbers are keyed by their decimal string,
 * so `makeRng(42)` and `makeRng('42')` are the same stream.
 * @param {unknown} seed
 * @returns {string}
 * @throws {TypeError} for anything but a string or finite number
 */
function seedKey(seed) {
  if (typeof seed === 'string') return seed;
  if (typeof seed === 'number' && Number.isFinite(seed)) return String(seed);
  throw new TypeError(`makeRng: seed must be a string or finite number, got ${describe(seed)}`);
}

/**
 * Expands a seed key into the four xoshiro128** state words. Two independent
 * 32-bit hashes of the key feed a splitmix32 sequence, so distinct keys land
 * in well-separated states and the all-zero state is never produced.
 * @param {string} key
 * @returns {Uint32Array} 4 words
 */
function expandSeed(key) {
  const s = new Uint32Array(4);
  let x = fnv1a32(key, FNV_OFFSET_BASIS);
  const salt = fnv1a32(key, FNV_ALT_BASIS);
  const step = () => {
    x = (x + GOLDEN_GAMMA) >>> 0;
    return fmix32(x);
  };
  s[0] = step();
  x = (x ^ salt) >>> 0;
  s[1] = step();
  s[2] = step();
  s[3] = step();
  if ((s[0] | s[1] | s[2] | s[3]) === 0) s[0] = 1; // xoshiro's one forbidden state
  return s;
}

/**
 * 32-bit rotate left.
 * @param {number} x
 * @param {number} k 1..31
 * @returns {number} int32
 */
function rotl(x, k) {
  return (x << k) | (x >>> (32 - k));
}

/**
 * @param {string} method name used in the error message
 * @param {string} name parameter name
 * @param {unknown} v value to check
 * @throws {TypeError} unless `v` is a finite number
 */
function assertFinite(method, name, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`${method}: ${name} must be a finite number, got ${describe(v)}`);
  }
}

/**
 * Validates an array-like (arrays, typed arrays, strings, `arguments`) and
 * returns its length.
 * @param {string} method name used in the error message
 * @param {unknown} arr
 * @returns {number}
 * @throws {TypeError} when `arr` is not array-like
 */
function lengthOf(method, arr) {
  const n = arr == null || typeof arr === 'function' ? undefined : arr.length;
  if (!Number.isInteger(n) || n < 0) {
    throw new TypeError(`${method}: expected an array, got ${describe(arr)}`);
  }
  return n;
}

/**
 * Reads and validates the weight of a `weighted()` entry. Weights of zero or
 * less disable an entry; non-finite weights are rejected as bugs.
 * @param {unknown} entry
 * @returns {number} effective weight (`0` when disabled)
 * @throws {TypeError} for malformed entries or non-finite weights
 */
function weightOf(entry) {
  if (entry === null || typeof entry !== 'object') {
    throw new TypeError(`weighted: entries must be {w, v} objects, got ${describe(entry)}`);
  }
  const w = entry.w;
  if (typeof w !== 'number' || !Number.isFinite(w)) {
    throw new TypeError(`weighted: entry weight must be a finite number, got ${describe(w)}`);
  }
  return w > 0 ? w : 0;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Deterministic xoshiro128** generator (period 2^128 - 1, 4 x 32-bit state).
 *
 * Every method consumes a fixed, documented number of 32-bit draws, so a
 * sequence of calls is reproducible and {@link Rng#state} fully captures the
 * future of the stream (there is no hidden cache). Create instances with
 * {@link makeRng}; the class is exported so it can be referenced as a type.
 */
export class Rng {
  /** @type {string} */
  #key;
  /** @type {Uint32Array} */
  #s;

  /**
   * @param {number|string} seed any string, or a finite number
   * @throws {TypeError} for other seed types (including `NaN`/`Infinity`)
   */
  constructor(seed) {
    this.#key = seedKey(seed);
    this.#s = expandSeed(this.#key);
  }

  /**
   * Canonical seed key. `makeRng(rng.seed)` recreates this stream from its
   * start, including for forks (whose key embeds the parent key and label).
   * @type {string}
   */
  get seed() {
    return this.#key;
  }

  /**
   * Next raw 32-bit value. One draw.
   * @returns {number} integer in `[0, 2^32)`
   */
  nextUint32() {
    const s = this.#s;
    const result = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /**
   * Uniform float with 32 bits of resolution. One draw.
   * @returns {number} in `[0, 1)`
   */
  next() {
    return this.nextUint32() / TWO_32;
  }

  /**
   * Uniform integer in the inclusive range `[min, max]`, free of modulo bias.
   * Non-integer bounds are tightened inwards (`int(0.2, 2.9)` yields 1 or 2).
   * One draw for ranges up to 2^32 (two for wider ranges), plus rare rejections.
   *
   * @param {number} min lower bound (inclusive)
   * @param {number} max upper bound (inclusive)
   * @returns {number} integer
   * @throws {TypeError} for non-finite bounds
   * @throws {RangeError} when no integer lies in the range, or it spans more than 2^53
   */
  int(min, max) {
    assertFinite('int', 'min', min);
    assertFinite('int', 'max', max);
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    if (lo > hi) {
      throw new RangeError(`int: no integer in [${min}, ${max}]`);
    }
    if (!Number.isSafeInteger(hi - lo)) {
      throw new RangeError(`int: range [${min}, ${max}] is wider than 2^53`);
    }
    return lo + this.#below(hi - lo + 1);
  }

  /**
   * Bernoulli trial. Always one draw, so changing a probability never shifts
   * the rest of the stream. `p <= 0` (or `NaN`) is always false, `p >= 1` always true.
   * @param {number} p probability of `true`
   * @returns {boolean}
   * @throws {TypeError} when `p` is not a number
   */
  chance(p) {
    if (typeof p !== 'number') {
      throw new TypeError(`chance: p must be a number, got ${describe(p)}`);
    }
    return this.next() < p;
  }

  /**
   * Uniformly chosen element. One draw, or none for an empty array (which
   * yields `undefined`).
   * @template T
   * @param {ArrayLike<T>} arr
   * @returns {T|undefined}
   * @throws {TypeError} when `arr` is not array-like
   */
  pick(arr) {
    const n = lengthOf('pick', arr);
    return n === 0 ? undefined : arr[this.#below(n)];
  }

  /**
   * Fisher-Yates shuffled copy; the input is left untouched.
   * `length - 1` draws (none for 0 or 1 elements).
   * @template T
   * @param {ArrayLike<T>} arr
   * @returns {T[]} a new array
   * @throws {TypeError} when `arr` is not array-like
   */
  shuffle(arr) {
    lengthOf('shuffle', arr);
    const out = Array.from(arr);
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.#below(i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /**
   * Weighted choice: entry `i` is chosen with probability `w_i / sum(w)`.
   * Entries with `w <= 0` are never chosen. One draw, or none when no entry is
   * eligible (which yields `undefined`).
   * @template T
   * @param {ArrayLike<{w: number, v: T}>} entries
   * @returns {T|undefined} the chosen entry's `v`
   * @throws {TypeError} for malformed entries or non-finite weights
   */
  weighted(entries) {
    const n = lengthOf('weighted', entries);
    let total = 0;
    for (let i = 0; i < n; i++) total += weightOf(entries[i]);
    if (total <= 0) return undefined;

    let r = this.next() * total;
    let last;
    for (let i = 0; i < n; i++) {
      const w = weightOf(entries[i]);
      if (w <= 0) continue;
      last = entries[i];
      r -= w;
      if (r < 0) return last.v;
    }
    return last.v; // only reached through floating-point rounding
  }

  /**
   * Independent sub-stream derived from this generator's seed and `label`,
   * not from its current position. Forking before or after any number of
   * draws therefore yields the identical stream, and forks nest
   * (`rng.fork('zone').fork(3)`). No draw is consumed.
   * @param {string|number} label
   * @returns {Rng} a fresh generator
   * @throws {TypeError} when `label` is not a string or number
   */
  fork(label) {
    if (typeof label !== 'string' && typeof label !== 'number') {
      throw new TypeError(`fork: label must be a string or number, got ${describe(label)}`);
    }
    return new Rng(`${this.#key}${FORK_SEPARATOR}${label}`);
  }

  /**
   * Snapshot of the generator position: four uint32 values, JSON-safe.
   * The returned array is a copy.
   * @returns {number[]}
   */
  state() {
    return Array.from(this.#s);
  }

  /**
   * Restores a position captured by {@link Rng#state}. The seed key is
   * unaffected, so forks keep working after a restore.
   * @param {ArrayLike<number>} state four uint32 values, not all zero
   * @returns {this}
   * @throws {TypeError} when `state` is not a 4-element array-like
   * @throws {RangeError} when a word is outside `[0, 2^32)` or all words are zero
   */
  restore(state) {
    if (state == null || typeof state === 'string' || state.length !== 4) {
      throw new TypeError('restore: state must be an array of 4 integers');
    }
    let any = 0;
    for (let i = 0; i < 4; i++) {
      const v = state[i];
      if (!Number.isInteger(v) || v < 0 || v >= TWO_32) {
        throw new RangeError(`restore: state[${i}] must be an integer in [0, 2^32), got ${String(v)}`);
      }
      any |= v;
    }
    if (any === 0) {
      throw new RangeError('restore: the all-zero state is not valid');
    }
    this.#s.set(state);
    return this;
  }

  /**
   * Normally distributed value via Box-Muller. Exactly two draws per call
   * (the second Box-Muller output is discarded so no hidden state exists).
   * @param {number} [mean=0]
   * @param {number} [sd=1] standard deviation
   * @returns {number}
   * @throws {TypeError} for non-finite arguments
   */
  gaussian(mean = 0, sd = 1) {
    assertFinite('gaussian', 'mean', mean);
    assertFinite('gaussian', 'sd', sd);
    const u1 = 1 - this.next(); // (0, 1]: never log(0)
    const u2 = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Unbiased uniform integer in `[0, n)` by rejection sampling.
   * @param {number} n integer in `[1, 2^53]`
   * @returns {number}
   */
  #below(n) {
    if (n <= TWO_32) {
      const limit = TWO_32 - (TWO_32 % n);
      let x;
      do {
        x = this.nextUint32();
      } while (x >= limit);
      return x % n;
    }
    const limit = TWO_53 - (TWO_53 % n);
    let x;
    do {
      x = this.#next53();
    } while (x >= limit);
    return x % n;
  }

  /**
   * 53-bit integer from two draws (27 high bits + 26 low bits).
   * @returns {number} integer in `[0, 2^53)`
   */
  #next53() {
    const hi = this.nextUint32() >>> 5;
    const lo = this.nextUint32() >>> 6;
    return hi * 67108864 + lo;
  }
}

/**
 * Creates a deterministic generator. Equal seeds always produce equal streams;
 * a number and its decimal string (`42` and `'42'`) are the same seed.
 *
 * @param {number|string} seed any string, or a finite number
 * @returns {Rng}
 * @throws {TypeError} for other seed types (including `NaN`/`Infinity`)
 */
export function makeRng(seed) {
  return new Rng(seed);
}

// ---------------------------------------------------------------------------
// Seed codes: DIAL-XXXX-XXXX
// ---------------------------------------------------------------------------
//
// The eight payload characters are Crockford base-32 (no I, L, O, U) and carry
// 40 bits, most significant first:
//
//   [ 8 bits toggles ][ 27 bits seed ][ 5 bits checksum ]
//
// Toggle bit i stands for the i-th name of the toggle registry. The stored
// toggle field is XOR-ed with the seed's low byte (a bijection) so that codes
// without toggles do not all start with the same characters. The checksum
// covers the dial word, the toggle bits and the seed, so a single mistyped
// character is rejected with probability 31/32.

/** Crockford base-32 alphabet: digits plus letters without I, L, O and U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOGGLE_BITS = 8;
const SEED_BITS = 27;
const CHECK_BITS = 5;
const CHECK_MASK = 2 ** CHECK_BITS - 1;
const TOGGLE_MASK = 2 ** TOGGLE_BITS - 1;
const MAX_SEED = 2 ** SEED_BITS - 1;
const GROUP_LENGTH = 4;
const PAYLOAD_LENGTH = (TOGGLE_BITS + SEED_BITS + CHECK_BITS) / 5;
const DIAL_PATTERN = /^[A-Z][A-Z0-9]{0,15}$/;
const CODE_PATTERN = /^([A-Z][A-Z0-9]{0,15})[-\s]+([0-9A-Z]{4})[-\s]*([0-9A-Z]{4})$/;

/** Base-32 digit values, plus forgiving aliases for commonly confused glyphs. */
const DIGIT_VALUE = new Map(Array.from(ALPHABET, (ch, i) => [ch, i]));
DIGIT_VALUE.set('I', 1);
DIGIT_VALUE.set('L', 1);
DIGIT_VALUE.set('O', 0);

/**
 * Seed-code format constants, for UI limits and validation elsewhere.
 * @type {Readonly<{alphabet: string, seedBits: number, maxSeed: number, maxToggles: number, maxDialLength: number}>}
 */
export const SEED_CODE = Object.freeze({
  alphabet: ALPHABET,
  seedBits: SEED_BITS,
  maxSeed: MAX_SEED,
  maxToggles: TOGGLE_BITS,
  maxDialLength: 16,
});

/** @type {readonly string[]} */
let toggleRegistry = Object.freeze([]);

/**
 * Checks an ordered list of toggle names.
 * @param {string} method name used in error messages
 * @param {unknown} names
 * @returns {readonly string[]} `names`, unchanged
 * @throws {TypeError} when not an array of non-empty strings
 * @throws {RangeError} for more than {@link SEED_CODE}.maxToggles names, or duplicates
 */
function validateToggleNames(method, names) {
  if (!Array.isArray(names)) {
    throw new TypeError(`${method}: toggleNames must be an array of strings, got ${describe(names)}`);
  }
  if (names.length > TOGGLE_BITS) {
    throw new RangeError(`${method}: at most ${TOGGLE_BITS} toggle names can be encoded, got ${names.length}`);
  }
  const seen = new Set();
  for (const name of names) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError(`${method}: toggle names must be non-empty strings, got ${describe(name)}`);
    }
    if (seen.has(name)) {
      throw new RangeError(`${method}: duplicate toggle name ${JSON.stringify(name)}`);
    }
    seen.add(name);
  }
  return names;
}

/**
 * Registers the game's ordered toggle names, used by the seed-code functions
 * when no `toggleNames` option is passed. Order matters: it defines the bit
 * layout, so reordering or removing names changes the meaning of old codes
 * (appending is safe).
 *
 * @param {string[]} names up to {@link SEED_CODE}.maxToggles unique, non-empty names
 * @returns {readonly string[]} the frozen copy now in use
 * @throws {TypeError|RangeError} for an invalid list
 */
export function setSeedToggles(names) {
  validateToggleNames('setSeedToggles', names);
  toggleRegistry = Object.freeze([...names]);
  return toggleRegistry;
}

/**
 * The toggle names currently registered with {@link setSeedToggles}
 * (empty by default).
 * @returns {readonly string[]}
 */
export function getSeedToggles() {
  return toggleRegistry;
}

/**
 * Normalises a dial word: trimmed, upper-cased, letters/digits only, starting
 * with a letter, 1-16 characters.
 * @param {unknown} dial
 * @returns {string}
 * @throws {TypeError} when not a string
 * @throws {RangeError} when it does not fit the format
 */
function normalizeDial(dial) {
  if (typeof dial !== 'string') {
    throw new TypeError(`encodeSeedCode: dial must be a string, got ${describe(dial)}`);
  }
  const word = dial.trim().toUpperCase();
  if (!DIAL_PATTERN.test(word)) {
    throw new RangeError(
      `encodeSeedCode: dial must be 1-${SEED_CODE.maxDialLength} letters/digits starting with a letter, got ${JSON.stringify(dial)}`,
    );
  }
  return word;
}

/**
 * Converts toggle names into their bit mask.
 * @param {unknown} toggles iterable of names (duplicates are fine)
 * @param {readonly string[]} names registry defining the bit order
 * @returns {number} bit mask
 * @throws {TypeError} when `toggles` is not an iterable of names
 * @throws {RangeError} for a name missing from `names`
 */
function toggleBitsFrom(toggles, names) {
  if (toggles == null) return 0;
  if (typeof toggles === 'string' || typeof toggles[Symbol.iterator] !== 'function') {
    throw new TypeError(`encodeSeedCode: toggles must be an array of names, got ${describe(toggles)}`);
  }
  let bits = 0;
  for (const toggle of toggles) {
    const i = names.indexOf(toggle);
    if (i < 0) {
      throw new RangeError(
        `encodeSeedCode: unknown toggle ${JSON.stringify(toggle)}; known: ${names.length ? names.join(', ') : '(none registered)'}`,
      );
    }
    bits |= 1 << i;
  }
  return bits;
}

/**
 * 5-bit checksum over everything a code carries.
 * @param {string} dial normalised dial word
 * @param {number} toggleBits
 * @param {number} seed
 * @returns {number} in `[0, 32)`
 */
function checksum(dial, toggleBits, seed) {
  return hashString(`${dial}|${toggleBits}|${seed}`) & CHECK_MASK;
}

/**
 * @typedef {Object} SeedCodeParts
 * @property {string} dial dial word, e.g. `'FLUX'` (case-insensitive; codes are upper-case)
 * @property {number} seed integer in `[0, SEED_CODE.maxSeed]`
 * @property {string[]} toggles names from the toggle registry
 */

/**
 * @typedef {Object} SeedCodeOptions
 * @property {readonly string[]} [toggleNames] ordered toggle names; defaults to {@link getSeedToggles}
 */

/**
 * Builds a shareable code such as `FLUX-K7Q2-MD7F` from its parts.
 *
 * @param {{dial: string, seed: number, toggles?: Iterable<string>}} parts
 * @param {SeedCodeOptions} [options]
 * @returns {string} `DIAL-XXXX-XXXX`
 * @throws {TypeError} for malformed input
 * @throws {RangeError} for an out-of-range seed, bad dial word or unknown toggle
 */
export function encodeSeedCode(parts, { toggleNames = toggleRegistry } = {}) {
  if (parts === null || typeof parts !== 'object') {
    throw new TypeError(`encodeSeedCode: expected {dial, seed, toggles}, got ${describe(parts)}`);
  }
  const dial = normalizeDial(parts.dial);
  const seed = parts.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new RangeError(`encodeSeedCode: seed must be an integer in [0, ${MAX_SEED}], got ${String(seed)}`);
  }
  const names = validateToggleNames('encodeSeedCode', toggleNames);
  const bits = toggleBitsFrom(parts.toggles, names);

  const field = bits ^ (seed & TOGGLE_MASK);
  let payload = field * 2 ** (SEED_BITS + CHECK_BITS) + seed * 2 ** CHECK_BITS + checksum(dial, bits, seed);
  const digits = new Array(PAYLOAD_LENGTH);
  for (let i = PAYLOAD_LENGTH - 1; i >= 0; i--) {
    digits[i] = ALPHABET[payload % 32];
    payload = Math.floor(payload / 32);
  }
  const text = digits.join('');
  return `${dial}-${text.slice(0, GROUP_LENGTH)}-${text.slice(GROUP_LENGTH)}`;
}

/**
 * Parses a code produced by {@link encodeSeedCode}. Forgiving about case,
 * surrounding whitespace, spaces instead of hyphens and the look-alikes
 * `I`/`L` (read as `1`) and `O` (read as `0`).
 *
 * Returns `null` for anything that is not a well-formed code with a valid
 * checksum, or that uses a toggle bit the registry cannot name.
 *
 * @param {string} code
 * @param {SeedCodeOptions} [options]
 * @returns {SeedCodeParts|null} toggles are listed in registry order
 */
export function decodeSeedCode(code, { toggleNames = toggleRegistry } = {}) {
  if (typeof code !== 'string') return null;
  const match = CODE_PATTERN.exec(code.trim().toUpperCase());
  if (!match) return null;

  const dial = match[1];
  let payload = 0;
  for (const ch of match[2] + match[3]) {
    const digit = DIGIT_VALUE.get(ch);
    if (digit === undefined) return null;
    payload = payload * 32 + digit;
  }
  const check = payload % 2 ** CHECK_BITS;
  const seed = Math.floor(payload / 2 ** CHECK_BITS) % 2 ** SEED_BITS;
  const bits = Math.floor(payload / 2 ** (SEED_BITS + CHECK_BITS)) ^ (seed & TOGGLE_MASK);
  if (check !== checksum(dial, bits, seed)) return null;

  const names = validateToggleNames('decodeSeedCode', toggleNames);
  if (bits >= 2 ** names.length) return null;
  const toggles = [];
  for (let i = 0; i < names.length; i++) {
    if (bits & (1 << i)) toggles.push(names[i]);
  }
  return { dial, seed, toggles };
}

/**
 * Fresh seed from the platform CSPRNG when available, else `Math.random`.
 * @returns {number} integer in `[0, MAX_SEED]`
 */
function entropySeed() {
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.getRandomValues === 'function') {
    const word = new Uint32Array(1);
    crypto.getRandomValues(word);
    return word[0] & MAX_SEED;
  }
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

/**
 * Generates a code with a random seed, e.g. for a "new world" button.
 *
 * @param {string} dial dial word for the code
 * @param {Rng|null} [entropyRng] generator to draw the seed from (one `int`
 *   call); when omitted the platform's crypto entropy is used
 * @param {SeedCodeOptions & {toggles?: Iterable<string>}} [options] toggles to
 *   include (none by default) and an optional toggle registry
 * @returns {string} `DIAL-XXXX-XXXX`
 * @throws {TypeError|RangeError} as {@link encodeSeedCode}, or when `entropyRng` is not an Rng
 */
export function randomSeedCode(dial, entropyRng, { toggles = [], toggleNames } = {}) {
  if (entropyRng != null && typeof entropyRng.int !== 'function') {
    throw new TypeError(`randomSeedCode: entropyRng must be an Rng, got ${describe(entropyRng)}`);
  }
  const seed = entropyRng ? entropyRng.int(0, MAX_SEED) : entropySeed();
  return encodeSeedCode({ dial, seed, toggles }, { toggleNames });
}

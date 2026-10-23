/**
 * Adversarial tests for js/core/save.js: malformed inputs, boundaries, determinism across runs, large
 * inputs, interleaved and re-entrant calls, state restore, unicode, quota fallbacks, clock misbehaviour
 * and a deterministic fault-injection fuzz. Everything here is deterministic (no Math.random, no
 * wall clock).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ERROR_CODES,
  RECORD_MAGIC,
  SLOT_KINDS,
  checksumHex,
  crc32,
  createMemoryStorage,
  createSaveSystem,
  decodeRecord,
  encodeRecord,
  fromBase64,
  slotId,
  toBase64,
} from '../js/core/save.js';

// ---------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------

/** Deterministic 32-bit LCG; `next()` in [0, 1). */
function lcg(seed) {
  let s = seed >>> 0;
  return {
    next() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
  };
}

function pseudoBytes(n, seed = 7) {
  const rng = lcg(seed);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.int(0, 255);
  return out;
}

/** A clock the test controls; `dir` -1 makes it run backwards. */
function clock(start = 1_000_000, step = 1000) {
  let t = start;
  return { now: () => t, tick: () => { t += step; }, set: (v) => { t = v; } };
}

const quotaErr = () => Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });

/** Map-backed storage adapter with per-method overrides. */
function adapter(map, overrides = {}) {
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    ...overrides,
  };
}

/** Builds a record string with a correct checksum from arbitrary header/payload JSON text. */
const craft = (headerJson, dataJson) => {
  const body = `${headerJson}\n${dataJson}`;
  return `${RECORD_MAGIC}\n${checksumHex(body)}\n${body}`;
};

const header = (over = {}) => JSON.stringify({ version: 1, time: 5, seq: 1, kind: 'manual', slot: 'manual:1', summary: null, ...over });

// ---------------------------------------------------------------------------------------------------
// API surface vs. contract
// ---------------------------------------------------------------------------------------------------

describe('adversarial: contract surface', () => {
  it('exposes every contract method with the documented arity behaviour', () => {
    const sys = createSaveSystem({ storage: new Map() });
    for (const name of ['save', 'load', 'list', 'remove', 'autosave', 'latest', 'exportString', 'importString', 'migrate']) {
      assert.equal(typeof sys[name], 'function', name);
    }
    assert.ok(Object.isFrozen(sys));
    assert.throws(() => { sys.slots().push('x'); }, TypeError, 'slot list is frozen');
    // Contract shapes: {ok, error?} / {ok, data?, error?} / list entries carry slot, kind, time, summary.
    assert.deepEqual(Object.keys(sys.load(1)).sort(), ['error', 'ok']);
    sys.save(1, { summary: 's' });
    const entry = sys.list()[0];
    for (const key of ['slot', 'kind', 'time', 'summary']) assert.ok(key in entry, key);
    // Single-argument migrate works as the contract spells it.
    assert.equal(sys.migrate({ a: 1 }).ok, true);
    assert.equal(sys.migrate({ a: 1 }).migrated, false);
  });

  it('never throws from any runtime operation for any argument shape', () => {
    const sys = createSaveSystem({ storage: new Map() });
    const weird = [undefined, null, 0, -1, 1.5, NaN, Infinity, '', '1', 'manual:0', 'manual:01', 'auto:1.tmp', '__proto__',
      'constructor', true, Symbol('s'), {}, [], () => {}, 10n, new Date(0), 'manual:1\u0000'];
    for (const value of weird) {
      assert.doesNotThrow(() => {
        sys.save(value, value); sys.save(value, { ok: 1 }); sys.save(1, value);
        sys.load(value); sys.peek(value); sys.remove(value); sys.exportString(value);
        sys.importString(value); sys.importString(value, { slot: value }); sys.migrate(value); sys.migrate({}, value);
        sys.autosave(value); sys.list(value === null || typeof value !== 'object' ? undefined : value); sys.isValidSlot(value);
      }, `argument ${String(value)}`);
    }
    // `{}` and `[]` are valid payloads (the boundaries suite relies on that), so `save(1, value)` and
    // `autosave(value)` legitimately wrote manual:1, auto:1 and auto:2. Every call with a bad slot or
    // bad data wrote nothing.
    assert.deepEqual(sys.list({ all: true }).map((e) => e.state), ['ok', 'empty', 'empty', 'ok', 'ok', 'empty'],
      'only the calls with object-like data wrote');
    assert.deepEqual(sys.load(1).data, [], 'the last valid payload written to manual:1');
  });
});

// ---------------------------------------------------------------------------------------------------
// Malformed inputs
// ---------------------------------------------------------------------------------------------------

describe('adversarial: malformed slot references', () => {
  it('accepts only exact slot ids or positive integers for manual slots', () => {
    const sys = createSaveSystem({ storage: new Map() });
    const bad = ['1', 0, -1, 1.5, NaN, 'manual:0', 'manual:4', 'manual:01', ' manual:1', 'MANUAL:1', 'auto:0', 'auto:4',
      'auto:1.tmp', '__proto__', 'constructor', 'toString', null, undefined, true, {}, [], Symbol('x'), 10n];
    for (const slot of bad) {
      const r = sys.save(slot, { a: 1 });
      assert.equal(r.ok, false, `slot ${String(slot)}`);
      assert.equal(r.error.code, ERROR_CODES.INVALID_SLOT, `slot ${String(slot)}`);
      assert.equal(sys.isValidSlot(slot), false);
      assert.equal(sys.peek(slot), null);
      assert.equal(sys.exportString(slot), null);
    }
    for (const slot of [1, 2, 3, 'manual:1', 'manual:3', 'auto:1', 'auto:3', 3.0]) {
      assert.equal(sys.isValidSlot(slot), true, `slot ${String(slot)}`);
    }
  });
});

describe('adversarial: data that must be refused', () => {
  it('refuses anything that is not a non-null object with invalid-data', () => {
    const sys = createSaveSystem({ storage: new Map() });
    for (const data of [undefined, null, 1, 'str', true, Symbol('s'), 10n, () => {}]) {
      const r = sys.save(1, data);
      assert.equal(r.error?.code, ERROR_CODES.INVALID_DATA, `data ${String(data)}`);
      assert.equal(r.error.slot, 'manual:1');
    }
    assert.equal(sys.autosave('nope').error.code, ERROR_CODES.INVALID_DATA);
    assert.equal(sys.load(1).error.code, ERROR_CODES.EMPTY, 'nothing written');
  });

  it('refuses objects whose JSON form is not an object or array, so every saved slot can be loaded', () => {
    const sys = createSaveSystem({ storage: new Map(), now: () => 1 });
    const unloadable = [
      new Date(0), new Number(4), new String('x'), new Boolean(true),
      { toJSON: () => 5 }, { toJSON: () => null }, { toJSON: () => 'text' }, { toJSON: () => undefined }, { toJSON: () => true },
    ];
    for (const data of unloadable) {
      const r = sys.save(1, data);
      assert.equal(r.ok, false, `data ${Object.prototype.toString.call(data)}`);
      assert.equal(r.error.code, ERROR_CODES.SERIALIZE);
      assert.equal(sys.peek(1).state, 'empty', 'nothing written');
    }
    // Serialization errors proper.
    const cyc = {}; cyc.self = cyc;
    assert.equal(sys.save(1, cyc).error.code, ERROR_CODES.SERIALIZE);
    assert.equal(sys.save(1, { n: 10n }).error.code, ERROR_CODES.SERIALIZE);
    assert.equal(sys.save(1, { get boom() { throw new Error('getter'); } }).error.code, ERROR_CODES.SERIALIZE);
    assert.equal(sys.save(1, { toJSON() { throw new Error('toJSON'); } }).error.code, ERROR_CODES.SERIALIZE);
    // ...while object-shaped JSON of any flavour is fine.
    for (const data of [{}, [], [1, [2]], { toJSON: () => ({ via: 'toJSON' }) }, { toJSON: () => [1] }, new Map([[1, 2]]), new Set([1]),
      Object.create(null), new (class Thing { constructor() { this.x = 1; } })()]) {
      const r = sys.save(1, data);
      assert.equal(r.ok, true, Object.prototype.toString.call(data));
      assert.equal(sys.load(1).ok, true);
    }
    assert.deepEqual(sys.load(1).data, { x: 1 });
  });

  it('drops what JSON cannot express instead of failing', () => {
    const sys = createSaveSystem({ storage: new Map() });
    const r = sys.save(1, { f() {}, u: undefined, s: Symbol('x'), keep: 1, nested: { u: undefined, arr: [undefined, () => {}] } });
    assert.equal(r.ok, true);
    assert.deepEqual(sys.load(1).data, { keep: 1, nested: { arr: [null, null] } });
  });

  it('keeps prototype-pollution keys as plain data', () => {
    const sys = createSaveSystem({ storage: new Map() });
    const data = JSON.parse('{"__proto__": {"polluted": true}, "constructor": {"prototype": {"x": 1}}}');
    assert.equal(sys.save(1, data).ok, true);
    const back = sys.load(1).data;
    assert.equal(Object.hasOwn(back, '__proto__'), true);
    assert.equal(({}).polluted, undefined, 'global Object prototype untouched');
    assert.deepEqual(back.constructor, { prototype: { x: 1 } });
  });
});

describe('adversarial: malformed records in storage', () => {
  const sysOver = (value) => {
    const map = new Map([['save.manual:1', value]]);
    return { map, sys: createSaveSystem({ storage: map }) };
  };

  it('classifies every structural defect as corrupt (or format for foreign content) without throwing', () => {
    const good = encodeRecord({ version: 1, time: 1, seq: 1, kind: 'manual', slot: 'manual:1', data: { a: 1 } }).record;
    const cases = {
      'foreign text': ['hello world', ERROR_CODES.FORMAT],
      'json blob': ['{"a":1}', ERROR_CODES.FORMAT],
      'magic only': ['WSAVE1', ERROR_CODES.FORMAT],
      'magic + newline': ['WSAVE1\n', ERROR_CODES.CORRUPT],
      'bad checksum field': ['WSAVE1\nZZZZZZZZ\n{}\n{}', ERROR_CODES.CORRUPT],
      'uppercase checksum': [good.replace(/^(WSAVE1\n)([0-9a-f]{8})/, (_, m, h) => m + h.toUpperCase()), ERROR_CODES.CORRUPT],
      'short checksum': ['WSAVE1\nabc\n{}\n{}', ERROR_CODES.CORRUPT],
      'missing payload line': [`WSAVE1\n${checksumHex('{"version":1,"time":1,"seq":1}')}\n{"version":1,"time":1,"seq":1}`, ERROR_CODES.CORRUPT],
      'truncated by one char': [good.slice(0, -1), ERROR_CODES.CORRUPT],
      'one extra char': [`${good} `, ERROR_CODES.CORRUPT],
      'crlf line endings': [good.replace(/\n/g, '\r\n'), ERROR_CODES.FORMAT],
      'leading BOM': [`﻿${good}`, ERROR_CODES.FORMAT],
      'header null': [craft('null', '{}'), ERROR_CODES.CORRUPT],
      'header array': [craft('[1]', '{}'), ERROR_CODES.CORRUPT],
      'header not json': [craft('{nope', '{}'), ERROR_CODES.CORRUPT],
      'header seq float': [craft(header({ seq: 1.5 }), '{}'), ERROR_CODES.CORRUPT],
      'header seq negative': [craft(header({ seq: -1 }), '{}'), ERROR_CODES.CORRUPT],
      'header seq string': [craft(header({ seq: '1' }), '{}'), ERROR_CODES.CORRUPT],
      'header seq unsafe': [craft(header({ seq: 2 ** 53 }), '{}'), ERROR_CODES.CORRUPT],
      'header version unsafe': [craft(header({ version: 2 ** 53 }), '{}'), ERROR_CODES.CORRUPT],
      'header time missing': [craft(JSON.stringify({ version: 1, seq: 1 }), '{}'), ERROR_CODES.CORRUPT],
      'header time string': [craft(header({ time: '5' }), '{}'), ERROR_CODES.CORRUPT],
      'payload scalar': [craft(header(), '5'), ERROR_CODES.CORRUPT],
      'payload null': [craft(header(), 'null'), ERROR_CODES.CORRUPT],
      'payload string': [craft(header(), '"x"'), ERROR_CODES.CORRUPT],
      'payload not json': [craft(header(), '{broken'), ERROR_CODES.CORRUPT],
      'payload with trailing junk': [craft(header(), '{"a":1}\n{"b":2}'), ERROR_CODES.CORRUPT],
      'empty string': ['', ERROR_CODES.FORMAT],
    };
    for (const [name, [value, code]] of Object.entries(cases)) {
      const { sys } = sysOver(value);
      const loaded = sys.load(1);
      assert.equal(loaded.ok, false, name);
      assert.equal(loaded.error.code, code, name);
      assert.equal(loaded.error.slot, 'manual:1', name);
      const entry = sys.peek(1);
      assert.equal(entry.state, 'corrupt', name);
      assert.equal(entry.size, value.length, name);
      assert.equal(sys.exportString(1), null, name);
      assert.equal(sys.latest(), null, name);
      assert.deepEqual(sys.list(), [], name);
    }
  });

  it('treats non-string values from a sloppy backend as corrupt with a null size', () => {
    for (const value of [12345, { a: 1 }, true, Symbol('s'), 10n]) {
      const storage = { getItem: () => value, setItem() {}, removeItem() {} };
      const sys = createSaveSystem({ storage });
      const entry = sys.peek(1);
      assert.equal(entry.state, 'corrupt');
      assert.equal(entry.size, null);
      assert.equal(sys.load(1).error.code, ERROR_CODES.CORRUPT);
    }
  });

  it('reads a minimal header and ignores unknown header fields', () => {
    const { sys } = sysOver(craft(JSON.stringify({ version: 1, time: 0, seq: 3, future: { x: 1 } }), '{"a":1}'));
    const loaded = sys.load(1);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.data, { a: 1 });
    assert.equal(loaded.meta.seq, 3);
    assert.equal(loaded.meta.summary, null);
    assert.equal(sys.peek(1).state, 'ok');
  });

  it('a record passing its checksum with an unsafe or out-of-range seq cannot disturb ordering', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: map, now: () => 1 });
    map.set('save.manual:1', craft(header({ seq: 2 ** 53 }), '{"a":1}'));
    map.set('save.manual:2', craft(header({ seq: Number.MAX_SAFE_INTEGER - 5, slot: 'manual:2' }), '{"a":2}'));
    const r = sys.save(3, { a: 3 });
    assert.equal(r.ok, true);
    assert.equal(r.seq, Number.MAX_SAFE_INTEGER - 4, 'one above the largest valid seq');
    assert.equal(sys.latest().slot, 'manual:3');
    assert.equal(sys.peek(1).state, 'corrupt', 'unsafe seq is rejected outright');
  });
});

describe('adversarial: malformed import strings', () => {
  const sys = () => createSaveSystem({ storage: new Map(), now: () => 1 });
  const goodRecord = encodeRecord({ version: 1, time: 1, seq: 1, kind: 'manual', slot: 'manual:1', data: { a: 1 } }).record;

  it('rejects non-strings, empties and non-base64 as format errors', () => {
    const s = sys();
    for (const text of [undefined, null, 42, {}, [], true, '', '   ', '\n\t', '====', 'A', '!!!!', 'QUJD$', 'W1NBVkUxé', 'ééé', '\u0000']) {
      const r = s.importString(text);
      assert.equal(r.ok, false, JSON.stringify(text));
      assert.equal(r.error.code, ERROR_CODES.FORMAT, JSON.stringify(text));
    }
  });

  it('rejects base64 of invalid UTF-8, foreign text, and damaged records with the right codes', () => {
    const s = sys();
    assert.equal(s.importString(toBase64(new Uint8Array([0xff, 0xfe, 0x80]))).error.code, ERROR_CODES.FORMAT, 'invalid UTF-8');
    assert.equal(s.importString(toBase64(new Uint8Array([0xc3, 0x28]))).error.code, ERROR_CODES.FORMAT, 'bad continuation byte');
    assert.equal(s.importString(toBase64('just some text')).error.code, ERROR_CODES.FORMAT);
    assert.equal(s.importString(toBase64('WSAVE2\n00000000\n{}\n{}')).error.code, ERROR_CODES.FORMAT, 'other magic');
    assert.equal(s.importString(toBase64(goodRecord.slice(0, -2))).error.code, ERROR_CODES.CORRUPT, 'truncated');
    assert.equal(s.importString(toBase64(goodRecord.replace('"a":1', '"a":2'))).error.code, ERROR_CODES.CORRUPT, 'tampered payload');
    assert.equal(s.importString(toBase64(craft(header(), '7'))).error.code, ERROR_CODES.CORRUPT, 'scalar payload');
    assert.equal(s.importString(toBase64(craft(header({ version: 99 }), '{}'))).error.code, ERROR_CODES.VERSION, 'newer version');
    // Damage inside the base64 itself.
    const b64 = toBase64(goodRecord);
    assert.equal(s.importString(b64.slice(0, 10) + '!' + b64.slice(11)).error.code, ERROR_CODES.FORMAT, 'illegal char');
    const flipped = b64.slice(0, 40) + (b64[40] === 'A' ? 'B' : 'A') + b64.slice(41);
    assert.equal(s.importString(flipped).ok, false, 'flipped base64 char');
    // Nothing above wrote anything.
    assert.deepEqual(s.list({ all: true }).map((e) => e.state), Array(6).fill('empty'));
  });

  it('accepts the same record wrapped at 76 columns, url-safe, unpadded, and with pasted junk whitespace', () => {
    const s = sys();
    const b64 = toBase64(goodRecord);
    const wrapped = b64.match(/.{1,76}/g).join('\r\n');
    const urlSafe = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const spaced = [...b64].join(' ');
    const padded = `\n\t  ${b64}  \n\n`;
    for (const variant of [wrapped, urlSafe, spaced, padded, ` ${b64} `]) {
      const r = s.importString(variant);
      assert.equal(r.ok, true);
      assert.deepEqual(r.data, { a: 1 });
    }
  });

  it('with slot: a bad slot fails and writes nothing; a null slot means "do not save"', () => {
    const s = sys();
    const b64 = toBase64(goodRecord);
    const bad = s.importString(b64, { slot: 'manual:9' });
    assert.equal(bad.ok, false);
    assert.equal(bad.error.code, ERROR_CODES.INVALID_SLOT);
    const skipped = s.importString(b64, { slot: null });
    assert.equal(skipped.ok, true);
    assert.equal(skipped.slot, undefined);
    assert.deepEqual(s.list(), []);
    const saved = s.importString(b64, { slot: 'auto:2' });
    assert.equal(saved.ok, true);
    assert.equal(saved.slot, 'auto:2');
    assert.deepEqual(s.load('auto:2').data, { a: 1 });
  });
});

// ---------------------------------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------------------------------

describe('adversarial: boundaries', () => {
  it('a system with no slots at all is inert but valid', () => {
    const sys = createSaveSystem({ storage: new Map(), manualSlots: 0, autosaveSlots: 0 });
    assert.deepEqual(sys.slots(), []);
    assert.deepEqual(sys.list({ all: true }), []);
    assert.equal(sys.latest(), null);
    assert.equal(sys.save(1, {}).error.code, ERROR_CODES.INVALID_SLOT);
    assert.equal(sys.autosave({}).error.code, ERROR_CODES.INVALID_SLOT);
    assert.deepEqual(sys.clearAll(), { ok: true, removed: 0 });
    assert.deepEqual(sys.recover(), []);
  });

  it('one autosave slot rotates onto itself and keeps increasing seq', () => {
    const sys = createSaveSystem({ storage: new Map(), autosaveSlots: 1, manualSlots: 0, now: () => 0 });
    for (let i = 1; i <= 5; i++) {
      const r = sys.autosave({ i });
      assert.equal(r.slot, 'auto:1');
      assert.equal(r.seq, i);
    }
    assert.deepEqual(sys.load('auto:1').data, { i: 5 });
  });

  it('many slots stay ordered and addressable', () => {
    const sys = createSaveSystem({ storage: new Map(), manualSlots: 40, autosaveSlots: 25, now: () => 0 });
    assert.equal(sys.slots().length, 65);
    assert.equal(sys.slots()[39], 'manual:40');
    assert.equal(sys.slots()[40], 'auto:1');
    assert.equal(sys.save(40, { last: true }).ok, true);
    assert.equal(sys.save(41, {}).error.code, ERROR_CODES.INVALID_SLOT);
    for (let i = 0; i < 25; i++) sys.autosave({ i });
    assert.equal(sys.autosave({ wrap: true }).slot, 'auto:1', 'rotation wraps at the configured count');
    assert.equal(sys.latest().slot, 'auto:1');
  });

  it('accepts an empty prefix, version 0 and empty payloads', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: map, prefix: '', version: 0, now: () => 0 });
    assert.equal(sys.save(1, {}).ok, true);
    assert.ok(map.has('manual:1'));
    assert.equal(map.has('manual:1.tmp'), false);
    assert.deepEqual(sys.load(1).data, {});
    assert.equal(sys.save(2, []).ok, true);
    assert.deepEqual(sys.load(2).data, []);
    assert.equal(sys.peek(1).version, 0);
    assert.equal(sys.migrate({ version: 0 }).ok, true);
    assert.equal(sys.migrate({}, 1).error.code, ERROR_CODES.VERSION);
  });

  it('rejects invalid construction options loudly and only there', () => {
    const bad = [
      { prefix: 1 }, { autosaveSlots: -1 }, { autosaveSlots: 1.5 }, { manualSlots: '3' }, { version: -1 }, { version: 1.5 },
      { version: 2 ** 53 }, { migrations: null }, { migrations: 'x' }, { summarize: 1 }, { now: 'now' },
      { storage: 'local' }, { storage: {} }, { storage: { getItem() {} } }, { storage: new Set() }, { storage: new WeakMap() },
    ];
    for (const options of bad) assert.throws(() => createSaveSystem({ storage: new Map(), ...options }), TypeError, JSON.stringify(options));
    assert.doesNotThrow(() => createSaveSystem({ storage: null }));
    assert.doesNotThrow(() => createSaveSystem({ storage: undefined }));
    assert.doesNotThrow(() => createSaveSystem({ migrations: [] }));
  });

  it('summaries: empty string, 0, false and nested values survive; undefined becomes null', () => {
    const sys = createSaveSystem({ storage: new Map() });
    for (const summary of ['', 0, false, { deep: [1, { x: null }] }, 'é😀']) {
      assert.equal(sys.save(1, { v: 1 }, { summary }).ok, true);
      assert.deepEqual(sys.peek(1).summary, summary);
    }
    assert.equal(sys.save(1, { v: 1, summary: undefined }).ok, true);
    assert.equal(sys.peek(1).summary, null);
    assert.equal(sys.save(1, { v: 1, summary: 10n }).error?.code, ERROR_CODES.SERIALIZE, 'BigInt in the payload is still a payload error');
    assert.equal(sys.save(1, { v: 1 }, { summary: 10n }).ok, true, 'but a bad summary never blocks a save');
    assert.equal(sys.peek(1).summary, null);
  });
});

// ---------------------------------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------------------------------

describe('adversarial: determinism across runs', () => {
  const script = (sys) => {
    sys.save(1, { a: 1, summary: 'one' });
    sys.autosave({ b: 2 });
    sys.autosave({ b: 3 });
    sys.save('auto:2', { c: 4 }, { summary: { d: 1 } });
    sys.autosave({ b: 5 });
    sys.remove(1);
    sys.autosave({ b: 6 });
    sys.importString(sys.exportString('auto:1'), { slot: 2 });
    sys.save(3, { arr: [1, 2, 3], s: '日本😀' });
    sys.clearAll();
    sys.save(1, { again: true });
    sys.autosave({ final: true });
  };

  it('replays to byte-identical storage and identical export strings', () => {
    const run = () => {
      const map = new Map();
      let t = 50_000;
      const sys = createSaveSystem({ storage: map, now: () => (t -= 13) });
      script(sys);
      return { map: [...map.entries()], exports: sys.slots().map((s) => sys.exportString(s)), latest: sys.latest(), list: sys.list({ all: true }) };
    };
    const a = run();
    const b = run();
    assert.deepEqual(a, b);
    assert.ok(a.map.every(([k]) => !k.endsWith('.tmp')), 'no staging keys linger');
  });

  it('latest() does not depend on the order slots were written or on the clock direction', () => {
    const make = (dir) => {
      const map = new Map();
      let t = 1_000_000;
      const sys = createSaveSystem({ storage: map, now: () => (t += dir * 1000) });
      return { map, sys };
    };
    for (const dir of [1, -1, 0]) {
      const { sys } = make(dir);
      sys.save(3, { n: 1 });
      sys.save('auto:3', { n: 2 });
      sys.save(1, { n: 3 });
      sys.autosave({ n: 4 });
      assert.equal(sys.latest().slot, 'auto:1', `dir ${dir}`);
      assert.equal(sys.latest().seq, 4);
      sys.save(2, { n: 5 });
      assert.equal(sys.latest().slot, 'manual:2', `dir ${dir}`);
    }
  });

  it('records are canonical: identical fields give identical strings, and the CRC is the standard one', () => {
    const fields = { version: 3, time: 1234, seq: 9, kind: 'auto', slot: 'auto:2', summary: { k: 'v' }, data: { z: [1, 'two', { three: 3 }] } };
    const a = encodeRecord(fields).record;
    const b = encodeRecord({ ...fields, data: JSON.parse(JSON.stringify(fields.data)) }).record;
    assert.equal(a, b);
    const [magic, hex, headerLine, dataLine] = a.split('\n');
    assert.equal(magic, RECORD_MAGIC);
    assert.equal(a.split('\n').length, 4);
    assert.equal(hex, checksumHex(`${headerLine}\n${dataLine}`));
    assert.equal(crc32('The quick brown fox jumps over the lazy dog'), 0x414fa339);
    assert.equal(crc32(new Uint8Array(0)), 0);
    assert.equal(crc32('é'), crc32(new Uint8Array([0xc3, 0xa9])), 'UTF-8 bytes, not UTF-16 units');
  });
});

// ---------------------------------------------------------------------------------------------------
// Large inputs
// ---------------------------------------------------------------------------------------------------

describe('adversarial: large inputs', () => {
  it('round-trips a multi-megabyte payload through save, load, export and import', () => {
    const sys = createSaveSystem({ storage: new Map(), now: () => 1 });
    const big = {
      text: 'ünïcödé-😀-'.repeat(60_000),
      rows: Array.from({ length: 40_000 }, (_, i) => ({ i, v: i * 0.25, tags: ['a', 'b', 'c'] })),
    };
    const r = sys.save(1, big);
    assert.equal(r.ok, true);
    assert.ok(r.size > 2_000_000, `record is ${r.size} chars`);
    const back = sys.load(1);
    assert.equal(back.ok, true);
    assert.equal(back.data.text.length, big.text.length);
    assert.equal(back.data.rows[39_999].v, 9999.75);
    const exported = sys.exportString(1);
    assert.equal(exported.length % 4, 0);
    assert.ok(/^[A-Za-z0-9+/]+=*$/.test(exported));
    const imported = sys.importString(exported, { slot: 2 });
    assert.equal(imported.ok, true);
    assert.equal(imported.data.text, big.text);
    assert.equal(sys.load(2).data.rows.length, 40_000);
  });

  it('base64 round-trips every length and byte value, matching Node', () => {
    for (let n = 0; n <= 300; n++) {
      const bytes = pseudoBytes(n, n + 1);
      const ours = toBase64(bytes);
      assert.equal(ours, Buffer.from(bytes).toString('base64'), `length ${n}`);
      assert.deepEqual(fromBase64(ours), bytes, `length ${n}`);
    }
    const large = pseudoBytes(1_000_003, 99);
    assert.equal(toBase64(large), Buffer.from(large).toString('base64'));
    assert.deepEqual(fromBase64(toBase64(large)), large);
  });

  it('a huge summary is carried in the header and never parsed as payload by list()', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: map });
    const summary = { notes: 'n'.repeat(50_000) };
    assert.equal(sys.save(1, { tiny: 1 }, { summary }).ok, true);
    assert.equal(sys.list()[0].summary.notes.length, 50_000);
    // Break the payload JSON but keep the header and checksum consistent: list sees a corrupt slot.
    const raw = map.get('save.manual:1');
    map.set('save.manual:1', raw.replace('{"tiny":1}', '{"tiny":2}'));
    assert.equal(sys.peek(1).state, 'corrupt', 'checksum covers the payload too');
  });
});

// ---------------------------------------------------------------------------------------------------
// Interleaving and re-entrancy
// ---------------------------------------------------------------------------------------------------

describe('adversarial: interleaved and re-entrant calls', () => {
  it('two systems over one store (two tabs) share the sequence and never clobber each other silently', () => {
    const map = new Map();
    const a = createSaveSystem({ storage: map, now: () => 1 });
    const b = createSaveSystem({ storage: map, now: () => 1 });
    const seqs = [a.autosave({ t: 'a1' }), b.autosave({ t: 'b1' }), a.autosave({ t: 'a2' }), b.autosave({ t: 'b2' })].map((r) => r.seq);
    assert.deepEqual(seqs, [1, 2, 3, 4]);
    assert.deepEqual(a.list({ kind: 'auto' }).map((e) => e.slot), ['auto:1', 'auto:2', 'auto:3']);
    assert.deepEqual(a.load('auto:1').data, { t: 'b2' }, 'oldest slot was rotated');
    assert.equal(b.latest().slot, 'auto:1');
    assert.equal(a.remove(2).existed, false);
    assert.equal(b.remove('auto:2').existed, true);
    assert.equal(a.peek('auto:2').state, 'empty');
  });

  it('a re-entrant summarize that saves another slot does not throw or corrupt either slot', () => {
    const map = new Map();
    let sys;
    let depth = 0;
    sys = createSaveSystem({
      storage: map,
      now: () => 1,
      summarize: (data) => {
        if (depth === 0 && data.outer) {
          depth++;
          const inner = sys.save(2, { inner: true });
          assert.equal(inner.ok, true);
        }
        return 'sum';
      },
    });
    const r = sys.save(1, { outer: true });
    assert.equal(r.ok, true);
    assert.deepEqual(sys.load(1).data, { outer: true });
    assert.deepEqual(sys.load(2).data, { inner: true });
    assert.equal(sys.list().length, 2);
    assert.ok([...map.keys()].every((k) => !k.endsWith('.tmp')));
  });

  it('a migration step that calls back into the system during load is harmless', () => {
    const map = new Map();
    const v1 = createSaveSystem({ storage: map, version: 1, now: () => 1 });
    v1.save(1, { hp: 5 });
    let sys;
    sys = createSaveSystem({
      storage: map,
      version: 2,
      now: () => 2,
      migrations: {
        1: (data) => {
          sys.autosave({ backupOf: 'manual:1', ...data });
          return { ...data, stamina: data.hp * 2 };
        },
      },
    });
    const loaded = sys.load(1);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.data, { hp: 5, stamina: 10 });
    assert.equal(loaded.meta.migratedFrom, 1);
    assert.equal(loaded.meta.version, 1, 'slot is not rewritten by load');
    assert.deepEqual(sys.load('auto:1').data, { backupOf: 'manual:1', hp: 5 });
  });
});

// ---------------------------------------------------------------------------------------------------
// State restore / recovery
// ---------------------------------------------------------------------------------------------------

describe('adversarial: state restore across instances', () => {
  it('a fresh instance sees exactly what the previous one left, including the sequence', () => {
    const map = new Map();
    const c = clock();
    const first = createSaveSystem({ storage: map, now: c.now });
    first.save(1, { a: 1 }); c.tick();
    first.autosave({ b: 1 }); c.tick();
    first.autosave({ b: 2 }); c.tick();
    const snapshot = first.list({ all: true });
    const second = createSaveSystem({ storage: map, now: c.now });
    assert.deepEqual(second.list({ all: true }), snapshot);
    assert.equal(second.latest().seq, 3);
    assert.equal(second.autosave({ b: 3 }).seq, 4, 'sequence continues from storage');
    assert.equal(second.autosave({ b: 4 }).slot, 'auto:1', 'rotation state restored');
    const third = createSaveSystem({ storage: map, now: c.now, manualSlots: 1, autosaveSlots: 1 });
    assert.deepEqual(third.slots(), ['manual:1', 'auto:1']);
    assert.deepEqual(third.load('auto:1').data, { b: 4 });
    assert.ok(map.has('save.auto:2'), 'slots outside a narrower configuration are left untouched');
  });

  it('recover() is idempotent, ignores stale and equal-seq staged copies, and survives a throwing removeItem', () => {
    const inner = createMemoryStorage();
    const base = createSaveSystem({ storage: inner, now: () => 1 });
    base.save(1, { v: 'real' });
    base.save(2, { v: 'real2' });
    const realSeq = base.peek(2).seq;
    const rec = (seq, data, slot) => encodeRecord({ version: 1, time: 0, seq, kind: 'manual', slot, data }).record;
    inner.setItem('save.manual:1.tmp', rec(1, { v: 'stale' }, 'manual:1'));
    inner.setItem('save.manual:2.tmp', rec(realSeq, { v: 'same-seq' }, 'manual:2'));
    inner.setItem('save.manual:3.tmp', rec(50, { v: 'promoted' }, 'manual:3'));
    const sys = createSaveSystem({ storage: inner, now: () => 1 });
    assert.deepEqual(sys.load(1).data, { v: 'real' });
    assert.deepEqual(sys.load(2).data, { v: 'real2' }, 'equal seq is not newer');
    assert.deepEqual(sys.load(3).data, { v: 'promoted' });
    assert.equal(inner.length, 3, 'every staging key removed');
    assert.deepEqual(sys.recover(), []);

    inner.setItem('save.manual:1.tmp', rec(99, { v: 'newer' }, 'manual:1'));
    const flaky = adapter(new Map(), { getItem: (k) => inner.getItem(k), setItem: (k, v) => inner.setItem(k, v), removeItem: () => { throw new Error('nope'); } });
    const a = createSaveSystem({ storage: flaky, now: () => 1 });
    assert.deepEqual(a.load(1).data, { v: 'newer' });
    assert.ok(inner.getItem('save.manual:1.tmp'), 'could not delete the staged copy');
    const b = createSaveSystem({ storage: flaky, now: () => 1 });
    assert.deepEqual(b.recover(), [], 'already promoted: not promoted twice');
    assert.deepEqual(b.load(1).data, { v: 'newer' });
  });

  it('promotes a staged copy when the real key cannot even be read, and leaves it when the write fails', () => {
    const map = new Map([['save.manual:1.tmp', encodeRecord({ version: 1, time: 0, seq: 2, kind: 'manual', slot: 'manual:1', data: { s: 1 } }).record]]);
    const storage = adapter(map, {
      getItem: (k) => { if (k === 'save.manual:1') throw new Error('denied'); return map.has(k) ? map.get(k) : null; },
    });
    const sys = createSaveSystem({ storage });
    assert.deepEqual(sys.recover(), [], 'write succeeded but read-back is denied: not reported, staged copy kept');
    assert.ok(map.has('save.manual:1.tmp'));
    assert.equal(map.get('save.manual:1'), map.get('save.manual:1.tmp'), 'the promotion itself was written');
  });

  it('remove() clears a staged copy too, and clearAll reports partial progress on failure', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: map, now: () => 1 });
    sys.save(1, { a: 1 });
    sys.save(2, { a: 2 });
    sys.save('auto:1', { a: 3 });
    map.set('save.manual:1.tmp', 'stale');
    assert.deepEqual(sys.remove(1), { ok: true, slot: 'manual:1', existed: true });
    assert.equal(map.has('save.manual:1.tmp'), false);
    assert.deepEqual(sys.remove(1), { ok: true, slot: 'manual:1', existed: false });
    let calls = 0;
    const failing = createSaveSystem({ storage: adapter(map, { removeItem: (k) => { if (++calls > 2) throw new Error('stop'); map.delete(k); } }), now: () => 1 });
    const r = failing.clearAll();
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.STORAGE);
    assert.equal(r.removed, 0, 'manual:1 was already empty; manual:2 failed on its staging-key removal');
    assert.equal(map.has('save.manual:2'), false, 'the real key went before the failure');
  });
});

// ---------------------------------------------------------------------------------------------------
// Unicode
// ---------------------------------------------------------------------------------------------------

describe('adversarial: unicode', () => {
  const nasty = {
    astral: '😀🏳️‍🌈👨‍👩‍👧‍👦',
    lone: 'a\ud800b\udc00c',
    separators: 'x y z',
    control: '\u0000\u0001\u001f\u007f',
    bom: '﻿start',
    rtl: '‮evil‬',
    combining: 'ȩ́',
    nul: '\0',
    summary: 'Ünïcödé ✦ ♥ ◉ 日本語',
  };

  it('round-trips every awkward string through save/load and export/import, in payload and summary', () => {
    const sys = createSaveSystem({ storage: new Map(), now: () => 1 });
    assert.equal(sys.save(1, nasty).ok, true);
    const back = sys.load(1);
    assert.deepEqual(back.data, nasty);
    assert.equal(back.meta.summary, nasty.summary);
    const exported = sys.exportString(1);
    assert.ok(/^[A-Za-z0-9+/=]+$/.test(exported), 'export is plain ASCII base64');
    const imported = sys.importString(exported, { slot: 2 });
    assert.equal(imported.ok, true);
    assert.deepEqual(imported.data, nasty);
    assert.equal(imported.meta.summary, nasty.summary);
    assert.deepEqual(sys.load(2).data, nasty);
    assert.equal(sys.exportString(2).length, exported.length, 'same payload, same size');
  });

  it('keeps unicode keys and never confuses record delimiters with escaped newlines', () => {
    const sys = createSaveSystem({ storage: new Map() });
    const data = { 'ключ\n': 1, '😀': { '\n\n': ['\n', '\\n', '\r\n'] }, summary: 'line1\nline2' };
    assert.equal(sys.save(1, data).ok, true);
    assert.deepEqual(sys.load(1).data, data);
    assert.equal(sys.peek(1).summary, 'line1\nline2');
  });

  it('slot ids with lookalike unicode are rejected', () => {
    const sys = createSaveSystem({ storage: new Map() });
    for (const slot of ['manual：1', 'ｍanual:1', 'manual:１', 'manual:1​', '﻿manual:1']) {
      assert.equal(sys.save(slot, {}).error.code, ERROR_CODES.INVALID_SLOT, JSON.stringify(slot));
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// Quota and storage failure paths
// ---------------------------------------------------------------------------------------------------

describe('adversarial: quota', () => {
  const recordSize = (data) => createSaveSystem({ storage: new Map(), now: () => 1 }).save(1, data).size;

  it('saves a record that fits on its own even when there is no room for the staging copy', () => {
    const data = { pad: 'x'.repeat(2000) };
    const size = recordSize(data);
    const storage = createMemoryStorage({ quota: size + 'save.manual:1'.length + 50 });
    const sys = createSaveSystem({ storage, now: () => 1 });
    const first = sys.save(1, data);
    assert.equal(first.ok, true, 'first save: staging refused, direct write accepted');
    assert.deepEqual(sys.load(1).data, data);
    assert.equal(storage.getItem('save.manual:1.tmp'), null);
    const second = sys.save(1, { pad: 'y'.repeat(2000) });
    assert.equal(second.ok, true, 'overwrite of the same size fits without staging room');
    assert.equal(second.seq, 2);
    assert.deepEqual(sys.load(1).data, { pad: 'y'.repeat(2000) });
    assert.equal(storage.length, 1);
  });

  it('falls back to a direct write when only the final write hits the quota, and still verifies it', () => {
    const map = new Map();
    const writes = [];
    const storage = adapter(map, {
      setItem: (k, v) => {
        writes.push(k);
        if (!k.endsWith('.tmp') && map.has('save.manual:1.tmp')) throw quotaErr();
        map.set(k, String(v));
      },
    });
    const sys = createSaveSystem({ storage, now: () => 1 });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.ok, true);
    assert.deepEqual(writes, ['save.manual:1.tmp', 'save.manual:1', 'save.manual:1']);
    assert.equal(map.has('save.manual:1.tmp'), false);
    assert.deepEqual(sys.load(1).data, { a: 1 });
  });

  it('when the record itself does not fit, fails with quota, keeps the old record and leaves no staging key', () => {
    const storage = createMemoryStorage({ quota: 600 });
    const sys = createSaveSystem({ storage, now: () => 1 });
    assert.equal(sys.save(1, { small: 1 }).ok, true);
    const before = storage.getItem('save.manual:1');
    const r = sys.save(1, { big: 'x'.repeat(5000) });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.QUOTA);
    assert.equal(r.error.slot, 'manual:1');
    assert.equal(storage.getItem('save.manual:1'), before);
    assert.equal(storage.length, 1);
    assert.equal(sys.autosave({ big: 'x'.repeat(5000) }).error.code, ERROR_CODES.QUOTA);
    assert.equal(sys.list({ all: true }).filter((e) => e.state === 'ok').length, 1);
  });

  it('does not fall back for non-quota failures at the staging write', () => {
    const map = new Map();
    let n = 0;
    const storage = adapter(map, { setItem: (k, v) => { if (k.endsWith('.tmp')) { n++; throw new Error('disabled'); } map.set(k, String(v)); } });
    const sys = createSaveSystem({ storage, now: () => 1 });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.error.code, ERROR_CODES.STORAGE);
    assert.equal(n, 1);
    assert.equal(map.size, 0, 'no direct write attempted');
  });

  it('recognizes quota errors by name or code from every engine, including DOMException-style objects', () => {
    const shapes = [
      Object.assign(new Error('x'), { name: 'QuotaExceededError' }),
      Object.assign(new Error('x'), { code: 22 }),
      Object.assign(new Error('x'), { name: 'NS_ERROR_DOM_QUOTA_REACHED' }),
      Object.assign(new Error('x'), { code: 1014 }),
      { name: 'QuotaExceededError', message: 'plain object' },
    ];
    for (const err of shapes) {
      const sys = createSaveSystem({ storage: adapter(new Map(), { setItem: () => { throw err; } }) });
      const r = sys.save(1, { a: 1 });
      assert.equal(r.error.code, ERROR_CODES.QUOTA, JSON.stringify(err));
      assert.equal(r.error.cause, err);
    }
    for (const err of ['quota', 22, null, undefined, Object.assign(new Error('x'), { code: 21 })]) {
      const sys = createSaveSystem({ storage: adapter(new Map(), { setItem: () => { throw err; } }) });
      assert.equal(sys.save(1, { a: 1 }).error.code, ERROR_CODES.STORAGE, String(err));
    }
  });

  it('import into a slot reports quota failures as the save result', () => {
    const src = createSaveSystem({ storage: new Map(), now: () => 1 });
    src.save(1, { big: 'x'.repeat(3000) });
    const text = src.exportString(1);
    const dst = createSaveSystem({ storage: createMemoryStorage({ quota: 500 }), now: () => 1 });
    const r = dst.importString(text, { slot: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.QUOTA);
    assert.equal(dst.importString(text).ok, true, 'a dry import still decodes');
  });
});

// ---------------------------------------------------------------------------------------------------
// Clock misbehaviour
// ---------------------------------------------------------------------------------------------------

describe('adversarial: clock', () => {
  it('never throws when the clock throws, and leaves nothing behind', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: map, now: () => { throw new Error('clock'); } });
    for (const r of [sys.save(1, { a: 1 }), sys.autosave({ a: 1 }),
      sys.importString(toBase64(encodeRecord({ version: 1, time: 0, seq: 1, kind: 'manual', slot: 'manual:1', data: {} }).record), { slot: 1 })]) {
      assert.equal(r.ok, false);
      assert.equal(r.error.code, ERROR_CODES.SERIALIZE);
      assert.equal(r.error.cause.message, 'clock');
    }
    assert.equal(map.size, 0);
  });

  it('refuses non-finite times but accepts negative and zero ones', () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined, null, '5', new Date(5)]) {
      const sys = createSaveSystem({ storage: new Map(), now: () => bad });
      assert.equal(sys.save(1, { a: 1 }).error.code, ERROR_CODES.SERIALIZE, String(bad));
    }
    for (const fine of [0, -1, -1e15, 1e15, 0.5]) {
      const sys = createSaveSystem({ storage: new Map(), now: () => fine });
      assert.equal(sys.save(1, { a: 1 }).ok, true, String(fine));
      assert.equal(sys.peek(1).time, fine);
    }
  });

  it('rotation, latest() and tie-breaks hold under a backwards clock', () => {
    const c = clock(10_000, -1000);
    const sys = createSaveSystem({ storage: new Map(), now: c.now });
    const order = [];
    for (let i = 0; i < 7; i++) {
      order.push(sys.autosave({ i }).slot);
      c.tick();
    }
    assert.deepEqual(order, ['auto:1', 'auto:2', 'auto:3', 'auto:1', 'auto:2', 'auto:3', 'auto:1']);
    assert.equal(sys.latest().slot, 'auto:1');
    assert.deepEqual(sys.load(sys.latest().slot).data, { i: 6 });
    assert.ok(sys.list().every((e) => e.time < 10_000), 'times really went backwards');
    sys.save(1, { manual: true });
    assert.equal(sys.latest().slot, 'manual:1');
  });
});

// ---------------------------------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------------------------------

describe('adversarial: migrations', () => {
  it('reports the failing step, never throws, and does not touch the input on failure paths before the step', () => {
    const sys = createSaveSystem({
      storage: new Map(),
      version: 4,
      migrations: {
        0: (d) => ({ ...d, v1: true }),
        1: () => { throw new TypeError('bad step'); },
        2: () => 'not an object',
        3: (d) => d,
      },
    });
    const r0 = sys.migrate({ version: 0 });
    assert.equal(r0.ok, false);
    assert.equal(r0.error.code, ERROR_CODES.MIGRATE);
    assert.deepEqual([r0.error.from, r0.error.to, r0.error.at], [0, 4, 1]);
    assert.equal(r0.error.cause.message, 'bad step');
    const r2 = sys.migrate({}, 2);
    assert.equal(r2.error.code, ERROR_CODES.MIGRATE);
    assert.equal(r2.error.at, 2);
    const r3 = sys.migrate({}, 3);
    assert.deepEqual(r3, { ok: true, data: {}, from: 3, to: 4, migrated: true });
    const r5 = sys.migrate({}, 5);
    assert.equal(r5.error.code, ERROR_CODES.VERSION);
    assert.deepEqual([r5.error.from, r5.error.to], [5, 4]);
    for (const from of [-1, 1.5, '2', NaN, Infinity, 2 ** 53, null]) {
      assert.equal(sys.migrate({}, from).error.code, ERROR_CODES.VERSION, String(from));
    }
    assert.equal(sys.migrate(null).error.code, ERROR_CODES.INVALID_DATA);
    assert.equal(sys.migrate('x', 0).error.code, ERROR_CODES.INVALID_DATA);
  });

  it('load() trusts the header version over data.version and keeps the stored record untouched', () => {
    const map = new Map();
    const v1 = createSaveSystem({ storage: map, version: 1, now: () => 1 });
    v1.save(1, { version: 7, hp: 1 });
    const raw = map.get('save.manual:1');
    const v2 = createSaveSystem({ storage: map, version: 2, migrations: { 1: (d) => ({ ...d, migrated: true }) } });
    const loaded = v2.load(1);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.data, { version: 7, hp: 1, migrated: true });
    assert.equal(loaded.meta.migratedFrom, 1);
    assert.equal(map.get('save.manual:1'), raw);
    assert.equal(v2.migrate({ version: 7 }).error.code, ERROR_CODES.VERSION, 'standalone migrate reads data.version');
    assert.equal(v2.save(1, loaded.data).ok, true);
    assert.equal(v2.peek(1).version, 2, 'a re-save stamps the current version');
    assert.equal(v2.load(1).meta.migratedFrom, null);
  });

  it('a migration gap is reported as version with the exact missing step, before any step runs', () => {
    let ran = 0;
    const sys = createSaveSystem({ storage: new Map(), version: 3, migrations: { 0: (d) => { ran++; return d; } } });
    const r = sys.migrate({}, 0);
    assert.equal(r.error.code, ERROR_CODES.VERSION);
    assert.equal(r.error.at, 1);
    assert.equal(ran, 1, 'step 0 ran, step 1 was missing');
    const direct = sys.migrate({}, 1);
    assert.equal(direct.error.at, 1);
  });
});

// ---------------------------------------------------------------------------------------------------
// Fault-injection fuzz
// ---------------------------------------------------------------------------------------------------

describe('adversarial: deterministic fault-injection fuzz', () => {
  it('holds its invariants through 2000 random operations on a flaky backend', () => {
    const rng = lcg(0xc0ffee);
    const map = new Map();
    let failMode = 0; // 0 fine, 1 quota, 2 generic
    const storage = adapter(map, {
      setItem: (k, v) => {
        if (failMode === 1) throw quotaErr();
        if (failMode === 2) throw new Error('flaky');
        map.set(k, String(v));
      },
    });
    let t = 5_000_000;
    const sys = createSaveSystem({ storage, now: () => (t += rng.int(-2000, 2000)) });
    const slots = sys.slots();
    const shadow = new Map(); // what each slot must hold, as JSON text
    let maxSeq = 0;
    let okSaves = 0;
    let failedSaves = 0;

    for (let step = 0; step < 2000; step++) {
      failMode = rng.next() < 0.75 ? 0 : rng.next() < 0.5 ? 1 : 2;
      const op = rng.next();
      const payload = { step, blob: 'b'.repeat(rng.int(0, 300)), nested: { arr: [step, 'x'] } };
      if (op < 0.4) {
        const slot = slots[rng.int(0, slots.length - 1)];
        const r = sys.save(slot, payload, { summary: step });
        if (r.ok) { shadow.set(slot, JSON.stringify(payload)); okSaves++; assert.ok(r.seq > maxSeq); maxSeq = r.seq; } else {
          failedSaves++;
          assert.ok([ERROR_CODES.QUOTA, ERROR_CODES.STORAGE].includes(r.error.code), r.error.code);
        }
      } else if (op < 0.7) {
        const r = sys.autosave(payload);
        if (r.ok) { shadow.set(r.slot, JSON.stringify(payload)); okSaves++; assert.ok(r.seq > maxSeq); maxSeq = r.seq; } else failedSaves++;
      } else if (op < 0.8) {
        const slot = slots[rng.int(0, slots.length - 1)];
        const r = sys.remove(slot);
        assert.equal(r.ok, true, 'removeItem never fails in this fuzz');
        shadow.delete(slot);
      } else if (op < 0.9) {
        const slot = slots[rng.int(0, slots.length - 1)];
        const text = sys.exportString(slot);
        if (text) {
          const target = slots[rng.int(0, slots.length - 1)];
          const r = sys.importString(text, { slot: target });
          if (r.ok) { shadow.set(target, shadow.get(slot)); assert.ok(r.saved.seq > maxSeq); maxSeq = r.saved.seq; }
        }
      } else {
        sys.list({ all: true }); sys.latest(); sys.peek(slots[rng.int(0, slots.length - 1)]);
      }
      // Invariants after every operation (reads are reliable).
      failMode = 0;
      for (const slot of slots) {
        const expected = shadow.get(slot);
        const loaded = sys.load(slot);
        if (expected === undefined) {
          assert.equal(loaded.ok, false, `${slot} should be empty at step ${step}`);
          assert.equal(loaded.error.code, ERROR_CODES.EMPTY);
        } else {
          assert.equal(loaded.ok, true, `${slot} unreadable at step ${step}`);
          assert.equal(JSON.stringify(loaded.data), expected, `${slot} holds stale or foreign data at step ${step}`);
        }
      }
      assert.ok([...map.keys()].every((k) => !k.endsWith('.tmp')), `staging key left behind at step ${step}`);
      const latest = sys.latest();
      if (latest) assert.equal(latest.seq, Math.max(...sys.list().map((e) => e.seq)));
    }
    assert.ok(okSaves > 300 && failedSaves > 100, `mix of outcomes: ${okSaves} ok, ${failedSaves} failed`);
    // A fresh instance over the same backend agrees completely.
    const again = createSaveSystem({ storage: map });
    assert.deepEqual(again.recover(), []);
    for (const slot of slots) {
      const expected = shadow.get(slot);
      if (expected === undefined) assert.equal(again.peek(slot).state, 'empty');
      else assert.equal(JSON.stringify(again.load(slot).data), expected);
    }
  });

  it('random base64 garbage never throws and never yields a false positive', () => {
    const rng = lcg(42);
    const sys = createSaveSystem({ storage: new Map() });
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=-_ \n!@#é😀';
    const chars = [...alphabet];
    for (let i = 0; i < 500; i++) {
      let text = '';
      const len = rng.int(0, 120);
      for (let j = 0; j < len; j++) text += chars[rng.int(0, chars.length - 1)];
      let r;
      assert.doesNotThrow(() => { r = sys.importString(text); });
      assert.equal(r.ok, false);
      assert.ok([ERROR_CODES.FORMAT, ERROR_CODES.CORRUPT].includes(r.error.code), r.error.code);
    }
    for (let i = 0; i < 200; i++) {
      const bytes = pseudoBytes(rng.int(0, 200), i);
      let r;
      assert.doesNotThrow(() => { r = decodeRecord(new TextDecoder().decode(bytes)); });
      assert.equal(r.ok, false);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// Misc exports
// ---------------------------------------------------------------------------------------------------

describe('adversarial: helpers', () => {
  it('slotId and SLOT_KINDS agree with the system\'s own ids', () => {
    const sys = createSaveSystem({ storage: new Map(), manualSlots: 2, autosaveSlots: 2 });
    assert.deepEqual(sys.slots(), [slotId(SLOT_KINDS.MANUAL, 1), slotId(SLOT_KINDS.MANUAL, 2), slotId(SLOT_KINDS.AUTO, 1), slotId(SLOT_KINDS.AUTO, 2)]);
  });

  it('createMemoryStorage mirrors localStorage edge behaviour', () => {
    const s = createMemoryStorage({ quota: 20 });
    s.setItem(1, 2);
    assert.equal(s.getItem('1'), '2', 'keys and values are stringified');
    assert.equal(s.getItem(1), '2');
    s.setItem('k', null);
    assert.equal(s.getItem('k'), 'null');
    assert.equal(s.getItem('missing'), null);
    assert.equal(s.key(0), '1');
    assert.equal(s.key(5), null);
    assert.throws(() => s.setItem('big', 'x'.repeat(20)), (e) => e.name === 'QuotaExceededError' && e.code === 22);
    assert.equal(s.getItem('big'), null, 'a refused write stores nothing');
    s.setItem('k', 'x'.repeat(15));
    assert.equal(s.usage, 2 + 16);
    s.removeItem('nope');
    s.clear();
    assert.equal(s.length, 0);
    assert.equal(s.usage, 0);
  });
});

// ---------------------------------------------------------------------------------------------------
// Verifier additions: option bags, sequence monotonicity, list/load consistency, sloppy backends
// ---------------------------------------------------------------------------------------------------

describe('adversarial: option bags that are not objects', () => {
  it('treats null, primitives and arrays as "no options" everywhere instead of throwing', () => {
    const sys = createSaveSystem({ storage: new Map(), now: () => 1 });
    const text = toBase64(encodeRecord({ version: 1, time: 0, seq: 1, kind: 'manual', slot: 'manual:1', data: { a: 1 } }).record);
    for (const opts of [null, undefined, 0, 1, '', 'summary', true, false, [], () => {}, Symbol('o'), 10n]) {
      const label = typeof opts === 'symbol' ? 'symbol' : String(opts);
      assert.doesNotThrow(() => {
        assert.equal(sys.save(1, { v: 1, summary: 'from-data' }, opts).ok, true, `save ${label}`);
        assert.equal(sys.peek(1).summary, 'from-data', `summary derived when opts is ${label}`);
        assert.equal(sys.autosave({ v: 2 }, opts).ok, true, `autosave ${label}`);
        assert.equal(sys.importString(text, opts).ok, true, `importString ${label}`);
        assert.equal(sys.importString(text, opts).slot, undefined, `importString ${label} saves nothing`);
        assert.ok(Array.isArray(sys.list(opts)), `list ${label}`);
        assert.equal(decodeRecord(encodeRecord({ version: 1, time: 0, seq: 1, kind: 'manual', slot: 'manual:1', data: {} }).record, opts).ok, true);
      }, label);
    }
    assert.equal(sys.list(null).length, sys.list().length);
    assert.equal(sys.list([]).length, sys.list().length);
    assert.equal(sys.list({ all: 1 }).length, 6, 'all is truthy');
    assert.equal(encodeRecord(null).error.code, ERROR_CODES.INVALID_DATA);
    assert.equal(encodeRecord().error.code, ERROR_CODES.INVALID_DATA);
    assert.doesNotThrow(() => createMemoryStorage(null).setItem('k', 'v'));
  });
});

describe('adversarial: sequence numbers stay strictly increasing', () => {
  it('never reuses a sequence number after the newest slot is removed or everything is cleared', () => {
    const sys = createSaveSystem({ storage: new Map(), now: () => 0 });
    const seen = [];
    const record = (r) => { assert.equal(r.ok, true); seen.push(r.seq ?? r.saved.seq); };
    record(sys.save(1, { n: 1 }));
    record(sys.save(2, { n: 2 }));
    sys.remove(2);
    record(sys.save(3, { n: 3 }));
    sys.remove(3);
    sys.remove(1);
    record(sys.autosave({ n: 4 }));
    sys.clearAll();
    record(sys.save(1, { n: 5 }));
    sys.remove(1);
    record(sys.importString(toBase64(encodeRecord({ version: 1, time: 0, seq: 999, kind: 'manual', slot: 'manual:1', data: { imported: true } }).record), { slot: 2 }));
    sys.remove(2);
    record(sys.autosave({ n: 7 }));
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i] > seen[i - 1], `seq ${seen[i]} after ${seen[i - 1]}`);
    assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);
  });

  it('a failed write does not consume a number, and a staged leftover can never outrank the next write', () => {
    const map = new Map();
    let failFinal = false;
    const storage = adapter(map, {
      setItem: (k, v) => { map.set(k, failFinal && !k.endsWith('.tmp') ? 'garbage' : String(v)); },
    });
    const sys = createSaveSystem({ storage, now: () => 0 });
    assert.equal(sys.save(1, { n: 1 }).seq, 1);
    assert.equal(sys.save(2, { n: 2 }).seq, 2);
    sys.remove(2);
    failFinal = true;
    const failed = sys.save(2, { n: 'lost' });
    assert.equal(failed.error.code, ERROR_CODES.VERIFY);
    assert.ok(map.has('save.manual:2.tmp'), 'staged copy kept for recovery');
    failFinal = false;
    const next = sys.save(2, { n: 'kept' });
    assert.equal(next.ok, true);
    assert.equal(next.seq, 3, 'number after the highest ever issued, not after what storage holds');
    assert.equal(map.has('save.manual:2.tmp'), false, 'a successful commit clears the leftover');
    const fresh = createSaveSystem({ storage: map, now: () => 0 });
    assert.deepEqual(fresh.recover(), []);
    assert.deepEqual(fresh.load(2).data, { n: 'kept' });
  });

  it('refuses, without throwing, to issue a sequence number beyond the safe integer range', () => {
    const map = new Map([['save.manual:1', craft(header({ seq: Number.MAX_SAFE_INTEGER }), '{"a":1}')]]);
    const sys = createSaveSystem({ storage: map, now: () => 0 });
    assert.equal(sys.peek(1).state, 'ok');
    const r = sys.save(2, { a: 2 });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.SERIALIZE);
    assert.equal(r.error.slot, 'manual:2');
    assert.equal(map.size, 1, 'nothing written');
  });
});

describe('adversarial: list/peek/latest agree with load', () => {
  const scalar = (over = {}) => craft(header(over), '"not an object"');

  it('a checksum-valid record with an unloadable payload is corrupt everywhere, not just on load', () => {
    const map = new Map([
      ['save.manual:1', scalar()],
      ['save.manual:2', craft(header({ slot: 'manual:2', seq: 2 }), '{"a":1}\n{"trailing":true}')],
      ['save.auto:2', scalar({ kind: 'auto', slot: 'auto:2', seq: 7 })],
    ]);
    const sys = createSaveSystem({ storage: map, now: () => 0 });
    for (const slot of [1, 2, 'auto:2']) {
      assert.equal(sys.load(slot).error.code, ERROR_CODES.CORRUPT, `load ${slot}`);
      assert.equal(sys.peek(slot).state, 'corrupt', `peek ${slot}`);
      assert.equal(sys.peek(slot).error.code, ERROR_CODES.CORRUPT, `peek error ${slot}`);
      assert.equal(sys.exportString(slot), null, `export ${slot}`);
    }
    assert.deepEqual(sys.list(), []);
    assert.equal(sys.latest(), null, 'latest() never points at a slot load() would refuse');
    // Autosave reclaims the unreadable auto slot before touching the empty one after it.
    assert.equal(sys.autosave({ n: 1 }).slot, 'auto:1');
    assert.equal(sys.autosave({ n: 2 }).slot, 'auto:2');
    assert.equal(sys.autosave({ n: 3 }).slot, 'auto:3');
    assert.equal(sys.latest().slot, 'auto:3');
    assert.equal(sys.latest().seq, 3, 'crafted seq 7 on a corrupt slot did not leak into numbering');
  });

  it('recover() never promotes a staged record whose payload could not be loaded', () => {
    const map = new Map([
      ['save.manual:1', encodeRecord({ version: 1, time: 0, seq: 1, kind: 'manual', slot: 'manual:1', data: { real: true } }).record],
      ['save.manual:1.tmp', scalar({ seq: 50 })],
      ['save.manual:3.tmp', scalar({ slot: 'manual:3', seq: 50 })],
    ]);
    const sys = createSaveSystem({ storage: map });
    assert.deepEqual(sys.recover(), []);
    assert.deepEqual(sys.load(1).data, { real: true });
    assert.equal(sys.peek(3).state, 'empty');
    assert.equal(map.has('save.manual:1.tmp'), false, 'bad staged copies are discarded');
    assert.equal(map.has('save.manual:3.tmp'), false);
  });

  it('every entry list() returns loads, for any mix of good, bad and foreign slot contents', () => {
    const good = (slot, seq) => encodeRecord({ version: 1, time: 0, seq, kind: slot.split(':')[0], slot, data: { slot } }).record;
    const map = new Map([
      ['save.manual:1', good('manual:1', 1)],
      ['save.manual:2', 'plain text'],
      ['save.manual:3', scalar({ slot: 'manual:3' })],
      ['save.auto:1', good('auto:1', 4)],
      ['save.auto:2', good('auto:2', 3).slice(0, -3)],
      ['save.auto:3', 12345],
    ]);
    const sys = createSaveSystem({ storage: map });
    const listed = sys.list();
    assert.deepEqual(listed.map((e) => e.slot), ['manual:1', 'auto:1']);
    for (const entry of listed) assert.deepEqual(sys.load(entry.slot).data, { slot: entry.slot });
    assert.equal(sys.latest().slot, 'auto:1');
    assert.deepEqual(sys.list({ all: true }).map((e) => e.state), ['ok', 'corrupt', 'corrupt', 'ok', 'corrupt', 'corrupt']);
  });
});

describe('adversarial: input handling', () => {
  it('accepts frozen and sealed input, never mutates it, and never hands the same object back twice', () => {
    const sys = createSaveSystem({ storage: new Map(), now: () => 0 });
    const data = Object.freeze({ a: Object.freeze([1, 2]), summary: Object.freeze({ s: 1 }) });
    const snapshot = JSON.stringify(data);
    assert.equal(sys.save(1, data).ok, true);
    assert.equal(sys.autosave(Object.seal({ b: 1 })).ok, true);
    assert.equal(JSON.stringify(data), snapshot);
    const first = sys.load(1).data;
    const second = sys.load(1).data;
    assert.notEqual(first, second);
    assert.notEqual(first, data);
    first.a.push(3);
    assert.deepEqual(sys.load(1).data.a, [1, 2], 'mutating a loaded copy changes nothing stored');
    assert.deepEqual(sys.peek(1).summary, { s: 1 });
  });

  it('works with a unicode prefix and keeps keys exact', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: map, prefix: '✦ゲーム/', now: () => 0 });
    assert.equal(sys.save(1, { ok: true }).ok, true);
    assert.deepEqual([...map.keys()], ['✦ゲーム/manual:1']);
    assert.deepEqual(createSaveSystem({ storage: map, prefix: '✦ゲーム/' }).load(1).data, { ok: true });
    assert.equal(createSaveSystem({ storage: map, prefix: '✦ゲーム' }).peek(1).state, 'empty', 'prefixes do not overlap');
  });
});

describe('adversarial: sloppy and hostile backends', () => {
  it('a backend that silently drops writes yields verify errors and leaves nothing behind', () => {
    const map = new Map();
    const storage = adapter(map, { setItem: () => {} });
    const sys = createSaveSystem({ storage, now: () => 0 });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.VERIFY);
    assert.equal(r.error.slot, 'manual:1');
    assert.equal(sys.autosave({ a: 1 }).error.code, ERROR_CODES.VERIFY);
    assert.equal(map.size, 0);
    assert.equal(sys.load(1).error.code, ERROR_CODES.EMPTY);
  });

  it('a backend that answers reads with promises or other non-strings never throws and never counts as ok', () => {
    const map = new Map();
    const storage = adapter(map, { getItem: (k) => (map.has(k) ? Promise.resolve(map.get(k)) : null) });
    const sys = createSaveSystem({ storage, now: () => 0 });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.VERIFY, 'the read-back is not the record that was written');
    assert.equal(map.has('save.manual:1.tmp'), false);
    assert.equal(sys.peek(1).state, 'empty', 'the direct write was never attempted');
    map.set('save.manual:1', 'anything');
    assert.equal(sys.peek(1).state, 'corrupt');
    assert.equal(sys.peek(1).size, null);
    assert.equal(sys.load(1).error.code, ERROR_CODES.CORRUPT);
    assert.equal(sys.latest(), null);
  });

  it('a backend whose reads throw only for the staging key fails the save cleanly and keeps the old record', () => {
    const map = new Map();
    const storage = adapter(map, { getItem: (k) => { if (k.endsWith('.tmp')) throw new Error('tmp denied'); return map.has(k) ? map.get(k) : null; } });
    const sys = createSaveSystem({ storage, now: () => 0 });
    // Construction ran recover(), which could not read the staging keys: that must be silent.
    map.set('save.manual:1', encodeRecord({ version: 1, time: 0, seq: 1, kind: 'manual', slot: 'manual:1', data: { old: true } }).record);
    const r = sys.save(1, { fresh: true });
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.STORAGE);
    assert.deepEqual(sys.load(1).data, { old: true });
    assert.equal(map.has('save.manual:1.tmp'), false, 'the unreadable staging copy was removed');
  });
});

describe('adversarial: quota boundaries', () => {
  it('a record that exactly fills the remaining room succeeds; one character more fails with quota', () => {
    const data = { pad: 'p'.repeat(100) };
    const size = createSaveSystem({ storage: new Map(), now: () => 0 }).save(1, data).size;
    const key = 'q.manual:1';
    const exact = createMemoryStorage({ quota: key.length + size });
    const sysExact = createSaveSystem({ storage: exact, prefix: 'q.', now: () => 0 });
    assert.equal(sysExact.save(1, data).ok, true, 'no room for staging, direct write fits exactly');
    assert.equal(exact.usage, exact.length === 1 ? key.length + size : -1);
    const short = createMemoryStorage({ quota: key.length + size - 1 });
    const sysShort = createSaveSystem({ storage: short, prefix: 'q.', now: () => 0 });
    const r = sysShort.save(1, data);
    assert.equal(r.ok, false);
    assert.equal(r.error.code, ERROR_CODES.QUOTA);
    assert.equal(short.length, 0, 'nothing partially written');
    assert.equal(sysShort.load(1).error.code, ERROR_CODES.EMPTY);
  });

  it('quota failures during autosave rotation keep every other autosave slot intact', () => {
    const storage = createMemoryStorage({ quota: 1200 });
    const sys = createSaveSystem({ storage, now: () => 0, manualSlots: 0 });
    assert.equal(sys.autosave({ n: 1 }).ok, true);
    assert.equal(sys.autosave({ n: 2 }).ok, true);
    const before = sys.list().map((e) => [e.slot, e.seq]);
    const r = sys.autosave({ huge: 'h'.repeat(5000) });
    assert.equal(r.error.code, ERROR_CODES.QUOTA);
    assert.equal(r.error.slot, 'auto:3', 'the empty slot was the target');
    assert.deepEqual(sys.list().map((e) => [e.slot, e.seq]), before);
    assert.equal(storage.length, 2, 'no staging key left behind');
    assert.equal(sys.autosave({ n: 3 }).slot, 'auto:3', 'the rotation target is unchanged after a failure');
  });
});

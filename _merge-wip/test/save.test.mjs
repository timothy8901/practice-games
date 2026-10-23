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

/** A controllable clock: `clock.now` is what the save system sees, `clock.tick()` advances it. */
function makeClock(start = 1_700_000_000_000) {
  let t = start;
  return { now: () => t, tick: (ms = 1000) => { t += ms; return t; }, set: (v) => { t = v; } };
}

/**
 * Builds a save system over a fresh Map with a controllable clock.
 * @param {object} [opts] Extra createSaveSystem options.
 */
function freshSystem(opts = {}) {
  const map = new Map();
  const clock = makeClock();
  const sys = createSaveSystem({ storage: map, now: clock.now, ...opts });
  return { map, clock, sys };
}

/** Deterministic pseudo-random bytes (LCG) so binary round-trip tests never flake. */
function pseudoBytes(n, seed = 12345) {
  const out = new Uint8Array(n);
  let s = seed >>> 0;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s >>> 24;
  }
  return out;
}

/** Flips one character inside a string at `index`. */
function flipChar(str, index) {
  const ch = str[index];
  const replacement = ch === 'a' ? 'b' : 'a';
  return str.slice(0, index) + replacement + str.slice(index + 1);
}

/** Crafts a record string with a valid checksum from raw header and payload JSON text. */
function craftRecord(headerJson, dataJson) {
  const body = `${headerJson}\n${dataJson}`;
  return `${RECORD_MAGIC}\n${checksumHex(body)}\n${body}`;
}

/** A storage that throws `error` from every method. */
function brokenStorage(error = new Error('storage is disabled')) {
  const boom = () => { throw error; };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

/** Wraps a Map in a storage adapter whose behaviour the test can override per method. */
function wrappedMap(map, overrides = {}) {
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    ...overrides,
  };
}

const quotaErr = () => Object.assign(new Error('quota'), { name: 'QuotaExceededError', code: 22 });

/** A payload exercising nesting, newlines, non-ASCII text and JSON number edge cases. */
const SAMPLE = {
  player: { name: 'Wren', hp: 7, pos: { x: 12.5, y: -3 }, tags: ['fox', 'é', '日本', '😀'] },
  log: ['line one\nline two', 'tab\tseparated', 'quote"inside'],
  flags: { seenIntro: true, nothing: null },
  counters: [0, 1, 2, 3.25, 1e21, -0],
  summary: { day: 3, label: 'Dusk at the porch' },
};
/** What SAMPLE looks like after a JSON round trip (`-0` becomes `0`). */
const SAMPLE_JSON = JSON.parse(JSON.stringify(SAMPLE));

// ---------------------------------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------------------------------

describe('crc32 / checksumHex', () => {
  it('matches the standard CRC-32 check vectors', () => {
    assert.equal(crc32(''), 0);
    assert.equal(crc32('123456789'), 0xcbf43926);
    assert.equal(crc32('The quick brown fox jumps over the lazy dog'), 0x414fa339);
  });

  it('treats a string as its UTF-8 bytes', () => {
    const text = 'héllo ☾ 😀';
    assert.equal(crc32(text), crc32(new TextEncoder().encode(text)));
    assert.notEqual(crc32(text), crc32('hello'));
  });

  it('formats as exactly 8 lowercase hex chars, zero-padded', () => {
    for (const s of ['', 'a', '123456789', 'zero-pad?', 'x'.repeat(1000)]) {
      const hex = checksumHex(s);
      assert.match(hex, /^[0-9a-f]{8}$/);
      assert.equal(parseInt(hex, 16), crc32(s));
    }
    // A known input whose CRC has leading zero nibbles exercises the padding path.
    const padded = ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef', 'abcdefg', 'abcdefgh', 'abcdefghi', 'abcdefghij']
      .map(checksumHex).find((h) => h.startsWith('0'));
    assert.ok(padded, 'expected at least one short-CRC sample to need padding');
  });

  it('is deterministic across calls', () => {
    assert.equal(crc32(JSON.stringify(SAMPLE)), crc32(JSON.stringify(SAMPLE)));
  });
});

// ---------------------------------------------------------------------------------------------------
// Base64
// ---------------------------------------------------------------------------------------------------

describe('toBase64 / fromBase64', () => {
  it('matches Node for ASCII, UTF-8 text and binary', () => {
    for (const text of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'héllo ☾ 😀', JSON.stringify(SAMPLE)]) {
      assert.equal(toBase64(text), Buffer.from(text, 'utf8').toString('base64'), JSON.stringify(text));
    }
    for (const n of [0, 1, 2, 3, 4, 5, 255, 256, 1001]) {
      const bytes = pseudoBytes(n, n + 7);
      assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'), `length ${n}`);
    }
  });

  it('round-trips bytes and text exactly', () => {
    const bytes = pseudoBytes(3000);
    assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
    const text = 'héllo ☾ 😀 \n\t"quotes"';
    assert.equal(new TextDecoder().decode(fromBase64(toBase64(text))), text);
  });

  it('accepts whitespace, missing padding and the URL-safe alphabet when decoding', () => {
    const bytes = pseudoBytes(300, 99);
    const standard = toBase64(bytes);
    const wrapped = standard.replace(/(.{76})/g, '$1\r\n') + '\n';
    const spaced = standard.split('').join(' ');
    const unpadded = standard.replace(/=+$/, '');
    const urlSafe = standard.replace(/\+/g, '-').replace(/\//g, '_');
    assert.ok(/[+/]/.test(standard), 'sample should contain both special characters');
    for (const variant of [wrapped, spaced, unpadded, urlSafe]) {
      assert.deepEqual(fromBase64(variant), bytes);
    }
    assert.equal(new TextDecoder().decode(fromBase64('QQ')), 'A');
    assert.equal(new TextDecoder().decode(fromBase64('QQ==')), 'A');
  });

  it('returns null for anything that is not base64', () => {
    for (const bad of ['Q', 'AB*D', 'Q!==', 'héllo', '////*', 42, null, undefined, {}, []]) {
      assert.equal(fromBase64(bad), null, String(bad));
    }
    assert.deepEqual(fromBase64(''), new Uint8Array(0));
  });
});

// ---------------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------------

describe('encodeRecord / decodeRecord', () => {
  const FIELDS = { version: 2, time: 1_700_000_000_123, seq: 9, kind: 'manual', slot: 'manual:2', summary: { day: 3 }, data: SAMPLE };

  it('produces the documented four-line layout with a verifiable checksum', () => {
    const enc = encodeRecord(FIELDS);
    assert.equal(enc.ok, true);
    const lines = enc.record.split('\n');
    assert.equal(lines.length, 4, 'JSON never contains raw newlines, so exactly four lines');
    assert.equal(lines[0], RECORD_MAGIC);
    assert.match(lines[1], /^[0-9a-f]{8}$/);
    assert.deepEqual(JSON.parse(lines[2]), { version: 2, time: 1_700_000_000_123, seq: 9, kind: 'manual', slot: 'manual:2', summary: { day: 3 } });
    assert.deepEqual(JSON.parse(lines[3]), SAMPLE_JSON, 'JSON semantics apply: -0 becomes 0');
    assert.equal(lines[1], checksumHex(`${lines[2]}\n${lines[3]}`));
    assert.equal(enc.size, enc.record.length);
  });

  it('is deterministic and round-trips header and payload', () => {
    const a = encodeRecord(FIELDS);
    const b = encodeRecord(FIELDS);
    assert.equal(a.record, b.record);
    const dec = decodeRecord(a.record);
    assert.equal(dec.ok, true);
    assert.deepEqual(dec.header, { version: 2, time: 1_700_000_000_123, seq: 9, kind: 'manual', slot: 'manual:2', summary: { day: 3 } });
    assert.deepEqual(dec.data, SAMPLE_JSON);
    assert.equal(dec.size, a.record.length);
  });

  it('parses only the header with parseData: false', () => {
    const { record } = encodeRecord(FIELDS);
    const dec = decodeRecord(record, { parseData: false });
    assert.equal(dec.ok, true);
    assert.equal(dec.data, undefined);
    assert.equal(dec.header.seq, 9);
  });

  it('defaults a missing or unserializable summary to null without failing', () => {
    assert.equal(decodeRecord(encodeRecord({ ...FIELDS, summary: undefined }).record).header.summary, null);
    assert.equal(decodeRecord(encodeRecord({ ...FIELDS, summary: { big: 10n } }).record).header.summary, null);
    const cyclic = {};
    cyclic.self = cyclic;
    assert.equal(decodeRecord(encodeRecord({ ...FIELDS, summary: cyclic }).record).header.summary, null);
    assert.equal(decodeRecord(encodeRecord({ ...FIELDS, summary: () => 1 }).record).header.summary, null);
  });

  it('rejects data that is not a non-null object or not serializable', () => {
    for (const data of [undefined, null, 5, 'x', true, () => {}, Symbol('s'), 10n]) {
      assert.equal(encodeRecord({ ...FIELDS, data }).error.code, ERROR_CODES.INVALID_DATA, String(data));
    }
    const cyclic = { a: {} };
    cyclic.a.back = cyclic;
    assert.equal(encodeRecord({ ...FIELDS, data: cyclic }).error.code, ERROR_CODES.SERIALIZE);
    assert.equal(encodeRecord({ ...FIELDS, data: { n: 10n } }).error.code, ERROR_CODES.SERIALIZE);
    assert.equal(encodeRecord({ ...FIELDS, data: { toJSON: () => undefined } }).error.code, ERROR_CODES.SERIALIZE);
  });

  it('rejects invalid header fields', () => {
    for (const bad of [{ version: -1 }, { version: 1.5 }, { seq: -1 }, { time: NaN }, { time: Infinity }, { kind: 1 }, { slot: null }]) {
      assert.equal(encodeRecord({ ...FIELDS, ...bad }).error.code, ERROR_CODES.SERIALIZE, JSON.stringify(bad));
    }
  });

  it('detects every kind of damage', () => {
    const { record } = encodeRecord(FIELDS);
    const lines = record.split('\n');
    const headerStart = lines[0].length + 1 + lines[1].length + 1;
    const dataStart = headerStart + lines[2].length + 1;

    assert.equal(decodeRecord(42).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord('').error.code, ERROR_CODES.FORMAT);
    assert.equal(decodeRecord('{"not":"a record"}').error.code, ERROR_CODES.FORMAT);
    assert.equal(decodeRecord('OTHER1\n' + record.slice(7)).error.code, ERROR_CODES.FORMAT);
    assert.equal(decodeRecord(RECORD_MAGIC).error.code, ERROR_CODES.FORMAT);
    assert.equal(decodeRecord(RECORD_MAGIC + '\n').error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(RECORD_MAGIC + '\n00000000').error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(RECORD_MAGIC + '\nnothex!!\n{}\n{}').error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(RECORD_MAGIC + '\n00000000\n{}').error.code, ERROR_CODES.CORRUPT, 'missing payload line');

    const flippedData = decodeRecord(flipChar(record, dataStart + 5));
    assert.equal(flippedData.error.code, ERROR_CODES.CORRUPT);
    assert.match(flippedData.error.message, /checksum/);
    assert.equal(decodeRecord(flipChar(record, headerStart + 3)).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(record.slice(0, -1)).error.code, ERROR_CODES.CORRUPT, 'truncated');
    assert.equal(decodeRecord(record + ' ').error.code, ERROR_CODES.CORRUPT, 'appended');
  });

  it('rejects structurally invalid content even when the checksum is intact', () => {
    const header = JSON.stringify({ version: 1, time: 5, seq: 1, kind: 'manual', slot: 'manual:1', summary: null });
    assert.equal(decodeRecord(craftRecord('not json', '{}')).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(craftRecord('[1,2]', '{}')).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(craftRecord(JSON.stringify({ version: 1, time: 5, seq: -1 }), '{}')).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(craftRecord(JSON.stringify({ version: 1, seq: 1 }), '{}')).error.code, ERROR_CODES.CORRUPT, 'missing time');
    assert.equal(decodeRecord(craftRecord(header, 'null')).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(craftRecord(header, '42')).error.code, ERROR_CODES.CORRUPT);
    assert.equal(decodeRecord(craftRecord(header, '{bad json')).error.code, ERROR_CODES.CORRUPT);
    // Header-only decoding does not look at the payload at all.
    assert.equal(decodeRecord(craftRecord(header, '{bad json'), { parseData: false }).ok, true);
    // Informational fields are defaulted when absent.
    const minimal = decodeRecord(craftRecord(JSON.stringify({ version: 1, time: 5, seq: 1 }), '{"a":1}'));
    assert.equal(minimal.ok, true);
    assert.deepEqual(minimal.header, { version: 1, time: 5, seq: 1, kind: '', slot: '', summary: null });
  });
});

// ---------------------------------------------------------------------------------------------------
// Memory storage
// ---------------------------------------------------------------------------------------------------

describe('createMemoryStorage', () => {
  it('behaves like localStorage', () => {
    const s = createMemoryStorage();
    assert.equal(s.getItem('missing'), null);
    s.setItem('a', 1);
    s.setItem('b', 'two');
    assert.equal(s.getItem('a'), '1', 'values are coerced to strings');
    assert.equal(s.length, 2);
    assert.equal(s.key(0), 'a');
    assert.equal(s.key(1), 'b');
    assert.equal(s.key(2), null);
    s.removeItem('a');
    s.removeItem('never-there');
    assert.equal(s.getItem('a'), null);
    assert.equal(s.length, 1);
    s.clear();
    assert.equal(s.length, 0);
    assert.equal(s.usage, 0);
  });

  it('enforces an optional quota with a browser-shaped error and tracks usage by delta', () => {
    const s = createMemoryStorage({ quota: 10 });
    s.setItem('ab', 'cd'); // 4
    assert.equal(s.usage, 4);
    s.setItem('ab', 'cdefgh'); // replace: 2 + 6 = 8
    assert.equal(s.usage, 8);
    assert.throws(() => s.setItem('x', 'yyy'), (e) => e.name === 'QuotaExceededError' && e.code === 22);
    assert.equal(s.getItem('x'), null, 'a refused write stores nothing');
    assert.equal(s.usage, 8);
    s.setItem('x', 'y'); // 10, exactly at quota is fine
    assert.equal(s.usage, 10);
    s.removeItem('ab');
    assert.equal(s.usage, 2);
  });
});

// ---------------------------------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------------------------------

describe('createSaveSystem: construction', () => {
  it('exposes the contract API plus helpers on a frozen object', () => {
    const { sys } = freshSystem();
    for (const method of ['save', 'load', 'list', 'remove', 'autosave', 'latest', 'exportString', 'importString',
      'migrate', 'peek', 'recover', 'clearAll', 'slots', 'isValidSlot']) {
      assert.equal(typeof sys[method], 'function', method);
    }
    assert.ok(Object.isFrozen(sys));
    assert.equal(sys.version, 1);
    assert.equal(sys.prefix, 'save.');
    assert.equal(sys.persistent, false, 'a Map is memory');
  });

  it('lays out slots manual-first in index order and validates slot references', () => {
    const { sys } = freshSystem({ manualSlots: 2, autosaveSlots: 3 });
    assert.deepEqual(sys.slots(), ['manual:1', 'manual:2', 'auto:1', 'auto:2', 'auto:3']);
    assert.ok(Object.isFrozen(sys.slots()));
    assert.equal(slotId(SLOT_KINDS.AUTO, 2), 'auto:2');
    for (const good of [1, 2, 'manual:1', 'manual:2', 'auto:1', 'auto:3']) assert.equal(sys.isValidSlot(good), true, String(good));
    for (const bad of [0, 3, -1, 1.5, '3', 'manual:3', 'auto:4', 'manual:01', 'MANUAL:1', '', null, undefined, {}, NaN]) {
      assert.equal(sys.isValidSlot(bad), false, String(bad));
    }
  });

  it('supports zero slots of either kind', () => {
    const { sys } = freshSystem({ manualSlots: 0, autosaveSlots: 1 });
    assert.deepEqual(sys.slots(), ['auto:1']);
    assert.equal(sys.save(1, { a: 1 }).error.code, ERROR_CODES.INVALID_SLOT);
    assert.equal(sys.autosave({ a: 1 }).ok, true);
    const none = freshSystem({ manualSlots: 2, autosaveSlots: 0 }).sys;
    assert.equal(none.autosave({ a: 1 }).error.code, ERROR_CODES.INVALID_SLOT);
    assert.equal(none.latest(), null);
  });

  it('throws TypeError on invalid options, the only place the module throws', () => {
    const cases = [
      { prefix: 5 }, { autosaveSlots: -1 }, { autosaveSlots: 1.5 }, { manualSlots: '3' }, { version: -1 },
      { version: 1.2 }, { version: '1' }, { migrations: null }, { migrations: 'x' }, { summarize: 'nope' },
      { now: 123 }, { storage: 'localStorage' }, { storage: 42 }, { storage: {} }, { storage: { getItem() {} } },
    ];
    for (const opts of cases) assert.throws(() => createSaveSystem(opts), TypeError, JSON.stringify(opts));
  });

  it('accepts a Map, a localStorage-like object, and falls back to memory with nothing usable', () => {
    const map = new Map();
    const viaMap = createSaveSystem({ storage: map });
    assert.equal(viaMap.save(1, { a: 1 }).ok, true);
    assert.ok(map.has('save.manual:1'));
    assert.equal(viaMap.persistent, false);

    const memory = createMemoryStorage();
    const viaStorage = createSaveSystem({ storage: memory });
    assert.equal(viaStorage.save(1, { a: 1 }).ok, true);
    assert.equal(memory.getItem('save.manual:1')?.startsWith(RECORD_MAGIC), true);
    assert.equal(viaStorage.persistent, true, 'an explicitly supplied store is trusted');

    for (const storage of [undefined, null]) {
      const fallback = createSaveSystem({ storage });
      assert.equal(typeof fallback.persistent, 'boolean');
      assert.equal(fallback.save(1, { a: 1 }).ok, true);
      assert.equal(fallback.load(1).data.a, 1);
      fallback.clearAll();
    }
  });

  it('uses a host localStorage when it works and ignores one that throws', (t) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    if (descriptor && !descriptor.configurable) {
      t.skip('globalThis.localStorage is not configurable in this runtime');
      return;
    }
    const restore = () => {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      else delete globalThis.localStorage;
    };
    try {
      const fake = createMemoryStorage();
      Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
      const sys = createSaveSystem({ prefix: 'probe.' });
      assert.equal(sys.persistent, true);
      assert.equal(sys.save(1, { x: 1 }).ok, true);
      assert.ok(fake.getItem('probe.manual:1'));
      assert.equal(fake.getItem('__save_probe__'), null, 'probe key is cleaned up');

      Object.defineProperty(globalThis, 'localStorage', {
        get() { throw new Error('SecurityError: access denied'); }, configurable: true,
      });
      const denied = createSaveSystem();
      assert.equal(denied.persistent, false);
      assert.equal(denied.save(1, { x: 1 }).ok, true);

      // Present but every write is refused (old Safari private mode): not usable either.
      Object.defineProperty(globalThis, 'localStorage', {
        value: wrappedMap(new Map(), { setItem: () => { throw quotaErr(); } }), configurable: true, writable: true,
      });
      assert.equal(createSaveSystem().persistent, false);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// save / load
// ---------------------------------------------------------------------------------------------------

describe('save / load', () => {
  it('round-trips rich JSON data, including newlines and non-ASCII text', () => {
    const { sys, clock } = freshSystem();
    const result = sys.save('manual:1', SAMPLE);
    assert.deepEqual(result, { ok: true, slot: 'manual:1', kind: 'manual', index: 1, time: clock.now(), seq: 1, size: result.size });
    assert.ok(result.size > 0);
    const loaded = sys.load('manual:1');
    assert.equal(loaded.ok, true);
    assert.equal(loaded.slot, 'manual:1');
    assert.deepEqual(loaded.data, SAMPLE_JSON);
    assert.deepEqual(loaded.meta, {
      slot: 'manual:1', kind: 'manual', index: 1, state: 'ok', time: clock.now(), seq: 1, version: 1,
      summary: SAMPLE.summary, size: result.size, migratedFrom: null,
    });
  });

  it('accepts a manual slot number and explicit auto slot ids', () => {
    const { sys } = freshSystem();
    assert.equal(sys.save(2, { a: 1 }).slot, 'manual:2');
    assert.equal(sys.load('manual:2').data.a, 1);
    assert.equal(sys.load(2).data.a, 1);
    assert.equal(sys.save('auto:2', { b: 2 }).slot, 'auto:2');
    assert.equal(sys.load('auto:2').data.b, 2);
  });

  it('stores a snapshot: later mutation does not leak in, and each load is a fresh object', () => {
    const { sys } = freshSystem();
    const live = { party: ['a'], n: 1 };
    sys.save(1, live);
    live.party.push('b');
    live.n = 2;
    const first = sys.load(1).data;
    const second = sys.load(1).data;
    assert.deepEqual(first, { party: ['a'], n: 1 });
    assert.notEqual(first, second);
    assert.notEqual(first.party, second.party);
  });

  it('writes under prefix + slot and leaves no temp key behind', () => {
    const { sys, map } = freshSystem({ prefix: 'game/' });
    sys.save(1, { a: 1 });
    sys.autosave({ b: 2 });
    assert.deepEqual([...map.keys()].sort(), ['game/auto:1', 'game/manual:1']);
    assert.ok(map.get('game/manual:1').startsWith(RECORD_MAGIC + '\n'));
  });

  it('isolates systems with different prefixes on one store', () => {
    const map = new Map();
    const a = createSaveSystem({ storage: map, prefix: 'a.' });
    const b = createSaveSystem({ storage: map, prefix: 'b.' });
    a.save(1, { who: 'a' });
    assert.equal(b.load(1).error.code, ERROR_CODES.EMPTY);
    b.save(1, { who: 'b' });
    assert.equal(a.load(1).data.who, 'a');
    assert.equal(b.load(1).data.who, 'b');
  });

  it('returns structured errors for bad slots and bad data, writing nothing', () => {
    const { sys, map } = freshSystem();
    for (const slot of [0, 4, 'manual:9', 'nope', null, undefined, 1.5]) {
      const r = sys.save(slot, { a: 1 });
      assert.equal(r.ok, false, String(slot));
      assert.equal(r.error.code, ERROR_CODES.INVALID_SLOT);
      assert.equal(typeof r.error.message, 'string');
    }
    for (const data of [undefined, null, 1, 'str', true, () => {}]) {
      const r = sys.save(1, data);
      assert.equal(r.error.code, ERROR_CODES.INVALID_DATA, String(data));
      assert.equal(r.error.slot, 'manual:1');
    }
    const cyclic = {};
    cyclic.me = cyclic;
    const r = sys.save(1, cyclic);
    assert.equal(r.error.code, ERROR_CODES.SERIALIZE);
    assert.equal(r.error.slot, 'manual:1');
    assert.ok(r.error.cause instanceof TypeError);
    assert.equal(map.size, 0);
  });

  it('reports empty, corrupt and foreign content distinctly on load', () => {
    const { sys, map } = freshSystem();
    const empty = sys.load(1);
    assert.deepEqual(empty, { ok: false, error: { code: ERROR_CODES.EMPTY, message: 'slot manual:1 is empty', slot: 'manual:1' } });
    assert.equal(sys.load('bogus').error.code, ERROR_CODES.INVALID_SLOT);

    sys.save(1, SAMPLE);
    const good = map.get('save.manual:1');
    map.set('save.manual:1', flipChar(good, good.length - 3));
    const corrupt = sys.load(1);
    assert.equal(corrupt.error.code, ERROR_CODES.CORRUPT);
    assert.equal(corrupt.error.slot, 'manual:1');

    map.set('save.manual:1', '{"legacy":"save"}');
    assert.equal(sys.load(1).error.code, ERROR_CODES.FORMAT);
    map.set('save.manual:1', good);
    assert.equal(sys.load(1).ok, true, 'restoring the exact string makes it readable again');
  });

  it('refuses to load a record from a newer version', () => {
    const map = new Map();
    createSaveSystem({ storage: map, version: 5 }).save(1, { a: 1 });
    const older = createSaveSystem({ storage: map, version: 3 });
    const r = older.load(1);
    assert.equal(r.error.code, ERROR_CODES.VERSION);
    assert.equal(r.error.slot, 'manual:1');
    assert.equal(r.error.from, 5);
    assert.equal(r.error.to, 3);
    assert.equal(older.peek(1).state, 'ok', 'the record itself is intact');
    assert.equal(older.peek(1).version, 5);
  });

  it('fails cleanly when the clock misbehaves', () => {
    const { sys } = freshSystem({ now: () => NaN });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.error.code, ERROR_CODES.SERIALIZE);
  });

  it('handles a large payload', () => {
    const { sys } = freshSystem();
    const big = { blob: 'x'.repeat(300_000), rows: Array.from({ length: 5000 }, (_, i) => ({ i, v: i * 0.5 })) };
    assert.equal(sys.save(1, big).ok, true);
    const back = sys.load(1);
    assert.equal(back.data.blob.length, 300_000);
    assert.equal(back.data.rows[4999].v, 2499.5);
    assert.equal(sys.list().length, 1);
  });
});

// ---------------------------------------------------------------------------------------------------
// Summaries and versions
// ---------------------------------------------------------------------------------------------------

describe('summaries', () => {
  it('defaults to data.summary, supports a custom summarizer, and an explicit override', () => {
    const { sys } = freshSystem();
    sys.save(1, { summary: { day: 2 } });
    assert.deepEqual(sys.peek(1).summary, { day: 2 });
    sys.save(2, { noSummary: true });
    assert.equal(sys.peek(2).summary, null);
    sys.save(1, { summary: { day: 2 } }, { summary: 'override' });
    assert.equal(sys.peek(1).summary, 'override');
    sys.save(1, { summary: { day: 2 } }, { summary: null });
    assert.equal(sys.peek(1).summary, null, 'an explicit null is respected');

    const custom = freshSystem({ summarize: (d) => ({ hp: d.hp, label: `Day ${d.day}` }) }).sys;
    custom.save(1, { hp: 3, day: 7 });
    assert.deepEqual(custom.peek(1).summary, { hp: 3, label: 'Day 7' });
  });

  it('never lets a summary problem block the save', () => {
    const throwing = freshSystem({ summarize: () => { throw new Error('ui bug'); } }).sys;
    assert.equal(throwing.save(1, { a: 1 }).ok, true);
    assert.equal(throwing.peek(1).summary, null);
    const undef = freshSystem({ summarize: () => undefined }).sys;
    undef.save(1, { a: 1 });
    assert.equal(undef.peek(1).summary, null);
    const { sys } = freshSystem();
    assert.equal(sys.save(1, { a: 1 }, { summary: { n: 1n } }).ok, true);
    assert.equal(sys.peek(1).summary, null);
  });
});

// ---------------------------------------------------------------------------------------------------
// Verified writes
// ---------------------------------------------------------------------------------------------------

describe('verified writes', () => {
  it('never throws on quota and keeps the previous record intact', () => {
    const storage = createMemoryStorage({ quota: 400 });
    const sys = createSaveSystem({ storage, now: () => 1 });
    assert.equal(sys.save(1, { small: true }).ok, true);
    const before = storage.getItem('save.manual:1');
    let result;
    assert.doesNotThrow(() => { result = sys.save(1, { big: 'x'.repeat(1000) }); });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, ERROR_CODES.QUOTA);
    assert.equal(result.error.slot, 'manual:1');
    assert.equal(result.error.cause.name, 'QuotaExceededError');
    assert.equal(storage.getItem('save.manual:1'), before);
    assert.equal(storage.getItem('save.manual:1.tmp'), null);
    assert.deepEqual(sys.load(1).data, { small: true });
  });

  it('recognizes Gecko-style quota errors and classifies other failures as storage errors', () => {
    const gecko = Object.assign(new Error('quota'), { name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 });
    const g = createSaveSystem({ storage: wrappedMap(new Map(), { setItem: () => { throw gecko; } }) });
    assert.equal(g.save(1, { a: 1 }).error.code, ERROR_CODES.QUOTA);
    const other = createSaveSystem({ storage: wrappedMap(new Map(), { setItem: () => { throw new Error('nope'); } }) });
    const r = other.save(1, { a: 1 });
    assert.equal(r.error.code, ERROR_CODES.STORAGE);
    assert.equal(r.error.cause.message, 'nope');
  });

  it('cleans the staging key and keeps the old record when only the final write fails', () => {
    const map = new Map();
    let failReal = false;
    const storage = wrappedMap(map, {
      setItem: (k, v) => {
        if (failReal && !k.endsWith('.tmp')) throw quotaErr();
        map.set(k, String(v));
      },
    });
    const sys = createSaveSystem({ storage, now: () => 1 });
    sys.save(1, { v: 1 });
    const before = map.get('save.manual:1');
    failReal = true;
    const r = sys.save(1, { v: 2 });
    assert.equal(r.error.code, ERROR_CODES.QUOTA);
    assert.equal(map.get('save.manual:1'), before);
    assert.equal(map.has('save.manual:1.tmp'), false);
    assert.deepEqual(sys.load(1).data, { v: 1 });
  });

  it('detects a staging read-back mismatch and leaves nothing behind', () => {
    const map = new Map();
    const storage = wrappedMap(map, {
      setItem: (k, v) => { map.set(k, k.endsWith('.tmp') ? String(v).slice(0, -1) : String(v)); },
    });
    const sys = createSaveSystem({ storage });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.error.code, ERROR_CODES.VERIFY);
    assert.equal(r.error.slot, 'manual:1');
    assert.equal(map.size, 0);
  });

  it('detects a final read-back mismatch, keeps the staged copy, and recovers it next launch', () => {
    const map = new Map();
    const storage = wrappedMap(map, {
      setItem: (k, v) => { map.set(k, k.endsWith('.tmp') ? String(v) : String(v) + 'X'); },
    });
    const sys = createSaveSystem({ storage, now: () => 1 });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.error.code, ERROR_CODES.VERIFY);
    assert.ok(map.has('save.manual:1.tmp'), 'staged copy retained');
    assert.equal(sys.peek(1).state, 'corrupt');

    const next = createSaveSystem({ storage: map });
    assert.equal(next.peek(1).state, 'ok', 'constructor ran recover()');
    assert.deepEqual(next.load(1).data, { a: 1 });
    assert.equal(map.has('save.manual:1.tmp'), false);
  });

  it('surfaces read failures as storage errors', () => {
    const map = new Map();
    const storage = wrappedMap(map, { getItem: () => { throw new Error('read denied'); } });
    const sys = createSaveSystem({ storage });
    const r = sys.save(1, { a: 1 });
    assert.equal(r.error.code, ERROR_CODES.STORAGE);
    assert.equal(sys.load(1).error.code, ERROR_CODES.STORAGE);
    assert.equal(sys.peek(1).state, 'corrupt');
    assert.equal(sys.peek(1).error.code, ERROR_CODES.STORAGE);
  });
});

// ---------------------------------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------------------------------

describe('recover', () => {
  const record = (seq, data, extra = {}) => encodeRecord({ version: 1, time: 10, seq, kind: 'manual', slot: 'manual:1', data, ...extra }).record;

  it('promotes a staged record when the real one is missing', () => {
    const map = new Map([['save.manual:1.tmp', record(4, { staged: true })]]);
    const sys = createSaveSystem({ storage: map });
    assert.deepEqual(sys.load(1).data, { staged: true });
    assert.equal(map.has('save.manual:1.tmp'), false);
    assert.deepEqual(sys.recover(), [], 'nothing left to do');
  });

  it('promotes a staged record when the real one is corrupt', () => {
    const map = new Map([['save.manual:1', 'garbage'], ['save.manual:1.tmp', record(2, { staged: true })]]);
    assert.deepEqual(createSaveSystem({ storage: map }).load(1).data, { staged: true });
  });

  it('promotes a staged record that is newer than a valid real one, and discards one that is not', () => {
    const newer = new Map([['save.manual:1', record(3, { real: true })], ['save.manual:1.tmp', record(4, { staged: true })]]);
    assert.deepEqual(createSaveSystem({ storage: newer }).load(1).data, { staged: true });
    assert.equal(newer.has('save.manual:1.tmp'), false);

    for (const staleSeq of [3, 2]) {
      const stale = new Map([['save.manual:1', record(3, { real: true })], ['save.manual:1.tmp', record(staleSeq, { staged: true })]]);
      assert.deepEqual(createSaveSystem({ storage: stale }).load(1).data, { real: true }, `seq ${staleSeq}`);
      assert.equal(stale.has('save.manual:1.tmp'), false);
    }
  });

  it('discards a corrupt staged record and reports what it restored', () => {
    const map = new Map([
      ['save.manual:1.tmp', 'junk'],
      ['save.manual:2.tmp', record(1, { ok: 2 }, { slot: 'manual:2' })],
      ['save.auto:1.tmp', record(2, { ok: 'a' }, { kind: 'auto', slot: 'auto:1' })],
    ]);
    const sys = createSaveSystem({ storage: map, prefix: 'x.' }); // different prefix: untouched
    assert.equal(map.size, 3);
    assert.deepEqual(sys.recover(), []);
    const real = createSaveSystem({ storage: map });
    assert.equal(map.has('save.manual:1.tmp'), false);
    assert.equal(real.peek(1).state, 'empty');
    assert.deepEqual(real.load(2).data, { ok: 2 });
    assert.deepEqual(real.load('auto:1').data, { ok: 'a' });
    assert.equal([...map.keys()].some((k) => k.endsWith('.tmp')), false);
  });

  it('leaves the staged copy when promotion cannot be written', () => {
    const map = new Map([['save.manual:1.tmp', record(1, { staged: true })]]);
    const storage = wrappedMap(map, { setItem: () => { throw quotaErr(); } });
    let sys;
    assert.doesNotThrow(() => { sys = createSaveSystem({ storage }); });
    assert.deepEqual(sys.recover(), []);
    assert.ok(map.has('save.manual:1.tmp'));
  });
});

// ---------------------------------------------------------------------------------------------------
// list / peek / latest
// ---------------------------------------------------------------------------------------------------

describe('list / peek / latest', () => {
  it('lists readable slots in slot order, or every slot with all: true', () => {
    const { sys, map, clock } = freshSystem({ manualSlots: 2, autosaveSlots: 2 });
    sys.save(2, { b: 1, summary: 'two' });
    clock.tick();
    sys.autosave({ c: 1, summary: 'auto' });
    map.set('save.manual:1', 'not a record');

    const readable = sys.list();
    assert.deepEqual(readable.map((e) => e.slot), ['manual:2', 'auto:1']);
    assert.deepEqual(readable[0], {
      slot: 'manual:2', kind: 'manual', index: 2, state: 'ok', time: clock.now() - 1000, seq: 1, version: 1,
      summary: 'two', size: map.get('save.manual:2').length,
    });

    const all = sys.list({ all: true });
    assert.deepEqual(all.map((e) => [e.slot, e.state]), [['manual:1', 'corrupt'], ['manual:2', 'ok'], ['auto:1', 'ok'], ['auto:2', 'empty']]);
    assert.equal(all[0].error.code, ERROR_CODES.FORMAT);
    assert.equal(all[0].size, 'not a record'.length);
    assert.deepEqual(all[3], { slot: 'auto:2', kind: 'auto', index: 2, state: 'empty', time: null, seq: null, version: null, summary: null, size: null });

    assert.deepEqual(sys.list({ kind: 'auto' }).map((e) => e.slot), ['auto:1']);
    assert.deepEqual(sys.list({ kind: 'manual', all: true }).map((e) => e.slot), ['manual:1', 'manual:2']);
    assert.deepEqual(sys.list({ kind: 'other' }), []);
  });

  it('peeks one slot without parsing the payload, and returns null for unknown slots', () => {
    const { sys, map } = freshSystem();
    sys.save(1, { summary: 's', payload: 'p'.repeat(5000) });
    const entry = sys.peek(1);
    assert.equal(entry.state, 'ok');
    assert.equal(entry.summary, 's');
    assert.equal(entry.size, map.get('save.manual:1').length);
    assert.equal(sys.peek(3).state, 'empty');
    assert.equal(sys.peek('nope'), null);
    assert.equal(sys.peek(), null);
  });

  it('latest() follows the write sequence, not the clock', () => {
    const { sys, clock } = freshSystem();
    assert.equal(sys.latest(), null);
    sys.save(1, { n: 1 });
    clock.tick(-5000); // the clock steps backwards
    sys.autosave({ n: 2 });
    assert.equal(sys.latest().slot, 'auto:1');
    assert.equal(sys.latest().seq, 2);
    clock.tick(-5000);
    sys.save(3, { n: 3 });
    assert.equal(sys.latest().slot, 'manual:3');
    sys.remove(3);
    assert.equal(sys.latest().slot, 'auto:1');
  });

  it('breaks sequence ties deterministically: time, then manual before auto, then index', () => {
    const rec = (seq, time, kind, slot) => encodeRecord({ version: 1, time, seq, kind, slot, data: { slot } }).record;
    const map = new Map([
      ['save.manual:1', rec(5, 10, 'manual', 'manual:1')],
      ['save.manual:2', rec(5, 20, 'manual', 'manual:2')],
      ['save.auto:1', rec(5, 20, 'auto', 'auto:1')],
    ]);
    const sys = createSaveSystem({ storage: map });
    assert.equal(sys.latest().slot, 'manual:2');
    map.set('save.manual:2', rec(5, 10, 'manual', 'manual:2'));
    assert.equal(sys.latest().slot, 'auto:1', 'newest time wins');
    map.set('save.auto:1', rec(5, 10, 'auto', 'auto:1'));
    assert.equal(sys.latest().slot, 'manual:1', 'all equal: manual first, then lowest index');
    map.delete('save.manual:1');
    assert.equal(sys.latest().slot, 'manual:2');
    map.delete('save.manual:2');
    assert.equal(sys.latest().slot, 'auto:1');
  });
});

// ---------------------------------------------------------------------------------------------------
// autosave rotation
// ---------------------------------------------------------------------------------------------------

describe('autosave', () => {
  it('fills the autosave slots in order, then overwrites the oldest, under a frozen clock', () => {
    const { sys } = freshSystem({ autosaveSlots: 3 });
    const order = [];
    for (let i = 1; i <= 8; i++) {
      const r = sys.autosave({ i });
      assert.equal(r.ok, true);
      order.push(r.slot);
      assert.equal(r.seq, i);
    }
    assert.deepEqual(order, ['auto:1', 'auto:2', 'auto:3', 'auto:1', 'auto:2', 'auto:3', 'auto:1', 'auto:2']);
    assert.deepEqual(sys.list({ kind: 'auto' }).map((e) => e.seq), [7, 8, 6]);
    assert.equal(sys.load('auto:3').data.i, 6);
    assert.equal(sys.latest().slot, 'auto:2');
  });

  it('reuses empty and corrupt autosave slots before rotating', () => {
    const { sys, map } = freshSystem({ autosaveSlots: 3 });
    sys.autosave({ i: 1 });
    sys.autosave({ i: 2 });
    sys.autosave({ i: 3 });
    sys.remove('auto:2');
    assert.equal(sys.autosave({ i: 4 }).slot, 'auto:2');
    map.set('save.auto:3', 'corrupted');
    assert.equal(sys.autosave({ i: 5 }).slot, 'auto:3');
    assert.equal(sys.autosave({ i: 6 }).slot, 'auto:1', 'back to the oldest');
  });

  it('shares the sequence with manual saves and never touches manual slots', () => {
    const { sys } = freshSystem({ autosaveSlots: 2 });
    sys.autosave({ i: 1 });
    sys.save(1, { m: 1 });
    sys.autosave({ i: 2 });
    sys.save(2, { m: 2 });
    assert.deepEqual(sys.list().map((e) => [e.slot, e.seq]), [['manual:1', 2], ['manual:2', 4], ['auto:1', 1], ['auto:2', 3]]);
    assert.equal(sys.autosave({ i: 3 }).slot, 'auto:1');
    assert.equal(sys.load(1).data.m, 1);
    assert.equal(sys.load(2).data.m, 2);
  });

  it('carries summaries and validates data like save()', () => {
    const { sys } = freshSystem();
    sys.autosave({ summary: { day: 1 } });
    assert.deepEqual(sys.peek('auto:1').summary, { day: 1 });
    sys.autosave({ x: 1 }, { summary: 'explicit' });
    assert.equal(sys.peek('auto:2').summary, 'explicit');
    assert.equal(sys.autosave(null).error.code, ERROR_CODES.INVALID_DATA);
    assert.equal(sys.autosave(null).error.slot, 'auto:3');
  });
});

// ---------------------------------------------------------------------------------------------------
// remove / clearAll
// ---------------------------------------------------------------------------------------------------

describe('remove / clearAll', () => {
  it('removes a slot and its staging key, reporting whether it existed', () => {
    const { sys, map } = freshSystem();
    sys.save(1, { a: 1 });
    map.set('save.manual:1.tmp', 'leftover');
    assert.deepEqual(sys.remove(1), { ok: true, slot: 'manual:1', existed: true });
    assert.equal(map.size, 0);
    assert.deepEqual(sys.remove('manual:1'), { ok: true, slot: 'manual:1', existed: false });
    assert.equal(sys.load(1).error.code, ERROR_CODES.EMPTY);
    assert.equal(sys.remove('nope').error.code, ERROR_CODES.INVALID_SLOT);
  });

  it('reports storage errors from removal', () => {
    const sys = createSaveSystem({ storage: wrappedMap(new Map(), { removeItem: () => { throw new Error('ro'); } }) });
    const r = sys.remove(1);
    assert.equal(r.error.code, ERROR_CODES.STORAGE);
    assert.equal(r.error.slot, 'manual:1');
  });

  it('clearAll wipes every slot and counts the ones that held data', () => {
    const { sys, map } = freshSystem();
    sys.save(1, { a: 1 });
    sys.save(3, { a: 3 });
    sys.autosave({ b: 1 });
    map.set('other.key', 'kept');
    assert.deepEqual(sys.clearAll(), { ok: true, removed: 3 });
    assert.deepEqual([...map.keys()], ['other.key']);
    assert.deepEqual(sys.list(), []);
    assert.deepEqual(sys.clearAll(), { ok: true, removed: 0 });
  });
});

// ---------------------------------------------------------------------------------------------------
// export / import
// ---------------------------------------------------------------------------------------------------

describe('exportString / importString', () => {
  it('exports base64 of the verified record and imports it back identically', () => {
    const { sys, map, clock } = freshSystem();
    sys.save(2, SAMPLE);
    const text = sys.exportString(2);
    assert.match(text, /^[A-Za-z0-9+/]+=*$/);
    assert.equal(new TextDecoder().decode(fromBase64(text)), map.get('save.manual:2'));

    const imported = sys.importString(text);
    assert.equal(imported.ok, true);
    assert.deepEqual(imported.data, SAMPLE_JSON);
    assert.deepEqual(imported.meta, {
      version: 1, time: clock.now(), seq: 1, kind: 'manual', slot: 'manual:2', summary: SAMPLE.summary,
      migratedFrom: null, size: map.get('save.manual:2').length,
    });
    assert.equal(imported.slot, undefined, 'nothing written without a target slot');
    assert.equal(map.size, 1);
  });

  it('exports identically for identical saves (determinism)', () => {
    const a = freshSystem();
    const b = freshSystem();
    a.sys.save(1, SAMPLE);
    b.sys.save(1, SAMPLE);
    assert.equal(a.sys.exportString(1), b.sys.exportString(1));
    assert.deepEqual([...a.map], [...b.map]);
  });

  it('returns null when there is nothing exportable', () => {
    const { sys, map } = freshSystem();
    assert.equal(sys.exportString(1), null);
    assert.equal(sys.exportString('nope'), null);
    sys.save(1, { a: 1 });
    map.set('save.manual:1', flipChar(map.get('save.manual:1'), 40));
    assert.equal(sys.exportString(1), null);
    assert.equal(createSaveSystem({ storage: brokenStorage() }).exportString(1), null);
  });

  it('tolerates pasted whitespace and the URL-safe alphabet', () => {
    const { sys } = freshSystem();
    sys.save(1, { bytes: pseudoBytes(400).join(',') });
    const text = sys.exportString(1);
    const mangled = ` ${text.replace(/(.{40})/g, '$1\n').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}\t\n`;
    assert.deepEqual(sys.importString(mangled).data, sys.load(1).data);
  });

  it('rejects garbage, tampering and truncation with the right codes', () => {
    const { sys } = freshSystem();
    sys.save(1, SAMPLE);
    const text = sys.exportString(1);
    for (const bad of ['', '   ', 'not base64!!', 'Q', 42, null, undefined]) {
      assert.equal(sys.importString(bad).error.code, ERROR_CODES.FORMAT, String(bad));
    }
    assert.equal(sys.importString(toBase64('hello world')).error.code, ERROR_CODES.FORMAT);
    assert.equal(sys.importString(toBase64(new Uint8Array([0xff, 0xfe, 0xfd]))).error.code, ERROR_CODES.FORMAT, 'invalid UTF-8');
    assert.equal(sys.importString(text.slice(0, -12)).error.code, ERROR_CODES.CORRUPT, 'truncated');
    assert.equal(sys.importString(flipChar(text, Math.floor(text.length / 2))).error.code, ERROR_CODES.CORRUPT, 'tampered');
    const record = new TextDecoder().decode(fromBase64(text));
    assert.equal(sys.importString(toBase64(record + record)).error.code, ERROR_CODES.CORRUPT, 'doubled record');
    const doubledText = sys.importString(text + text);
    assert.equal(doubledText.ok, false, 'doubled base64 shifts bit alignment into garbage');
    assert.ok([ERROR_CODES.CORRUPT, ERROR_CODES.FORMAT].includes(doubledText.error.code));
  });

  it('imports straight into a slot when asked, keeping the exported summary', () => {
    const source = freshSystem({ summarize: (d) => `Day ${d.day}` });
    source.sys.save(1, { day: 9 });
    const text = source.sys.exportString(1);

    const target = freshSystem({ summarize: () => 'should not be used' });
    target.clock.tick(5000);
    const r = target.sys.importString(text, { slot: 'auto:2' });
    assert.equal(r.ok, true);
    assert.equal(r.slot, 'auto:2');
    assert.equal(r.saved.seq, 1);
    assert.deepEqual(target.sys.load('auto:2').data, { day: 9 });
    assert.equal(target.sys.peek('auto:2').summary, 'Day 9');
    assert.equal(target.sys.peek('auto:2').time, target.clock.now(), 'stamped with the import time');
    assert.equal(target.sys.importString(text, { slot: 'manual:7' }).error.code, ERROR_CODES.INVALID_SLOT);
    assert.equal(target.sys.importString('garbage!', { slot: 1 }).error.code, ERROR_CODES.FORMAT);
    assert.equal(target.sys.peek(1).state, 'empty', 'a failed import writes nothing');
  });

  it('refuses newer versions and migrates older ones on import', () => {
    const map = new Map();
    const text = createSaveSystem({ storage: map, version: 1 }).save(1, { hp: 5 }) && createSaveSystem({ storage: map, version: 1 }).exportString(1);
    const v2 = createSaveSystem({ storage: new Map(), version: 2, migrations: { 1: (d) => ({ ...d, mp: 0 }) } });
    const r = v2.importString(text);
    assert.deepEqual(r.data, { hp: 5, mp: 0 });
    assert.equal(r.meta.migratedFrom, 1);
    assert.equal(r.meta.version, 1, 'meta reports the exported version');
    const v0 = createSaveSystem({ storage: new Map(), version: 0 });
    assert.equal(v0.importString(text).error.code, ERROR_CODES.VERSION);
    const noPath = createSaveSystem({ storage: new Map(), version: 2 });
    assert.equal(noPath.importString(text).error.code, ERROR_CODES.VERSION);
  });
});

// ---------------------------------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------------------------------

describe('migrate', () => {
  const migrations = {
    1: (d) => ({ ...d, stamina: 10 }),
    2: (d, from) => { d.trail = [...(d.trail ?? []), from]; return d; },
  };

  it('applies the steps in order and reports the path', () => {
    const { sys } = freshSystem({ version: 3, migrations });
    const r = sys.migrate({ hp: 1 }, 1);
    assert.deepEqual(r, { ok: true, data: { hp: 1, stamina: 10, trail: [2] }, from: 1, to: 3, migrated: true });
    assert.deepEqual(sys.migrate({ hp: 1 }, 2).data, { hp: 1, trail: [2] });
    const same = { hp: 1 };
    const noop = sys.migrate(same, 3);
    assert.deepEqual(noop, { ok: true, data: same, from: 3, to: 3, migrated: false });
    assert.equal(noop.data, same, 'no-op returns the same object');
  });

  it('infers the source version from data.version, else assumes current', () => {
    const { sys } = freshSystem({ version: 3, migrations });
    assert.deepEqual(sys.migrate({ version: 1 }).data, { version: 1, stamina: 10, trail: [2] });
    assert.equal(sys.migrate({ version: 'old' }).migrated, false);
    assert.equal(sys.migrate({}).migrated, false);
  });

  it('fails with structured errors for bad inputs, gaps, newer saves and broken steps', () => {
    const { sys } = freshSystem({ version: 3, migrations: { 1: migrations[1] } });
    assert.equal(sys.migrate(null, 1).error.code, ERROR_CODES.INVALID_DATA);
    assert.equal(sys.migrate({}, -1).error.code, ERROR_CODES.VERSION);
    assert.equal(sys.migrate({}, 1.5).error.code, ERROR_CODES.VERSION);
    assert.equal(sys.migrate({}, '1').error.code, ERROR_CODES.VERSION);
    const newer = sys.migrate({}, 4);
    assert.equal(newer.error.code, ERROR_CODES.VERSION);
    assert.deepEqual([newer.error.from, newer.error.to], [4, 3]);
    const gap = sys.migrate({}, 1);
    assert.equal(gap.error.code, ERROR_CODES.VERSION);
    assert.equal(gap.error.at, 2);
    assert.match(gap.error.message, /no migration from version 2 to 3/);

    const throwing = freshSystem({ version: 2, migrations: { 1: () => { throw new Error('bad step'); } } }).sys;
    const t = throwing.migrate({}, 1);
    assert.equal(t.error.code, ERROR_CODES.MIGRATE);
    assert.equal(t.error.at, 1);
    assert.equal(t.error.cause.message, 'bad step');
    const empty = freshSystem({ version: 2, migrations: { 1: () => undefined } }).sys;
    assert.equal(empty.migrate({}, 1).error.code, ERROR_CODES.MIGRATE);
    const scalar = freshSystem({ version: 2, migrations: { 1: () => 42 } }).sys;
    assert.equal(scalar.migrate({}, 1).error.code, ERROR_CODES.MIGRATE);
  });

  it('runs on load and reports the source version, without rewriting the slot', () => {
    const map = new Map();
    createSaveSystem({ storage: map, version: 1 }).save(1, { hp: 2 });
    const stored = map.get('save.manual:1');
    const sys = createSaveSystem({ storage: map, version: 3, migrations });
    const r = sys.load(1);
    assert.equal(r.ok, true);
    assert.deepEqual(r.data, { hp: 2, stamina: 10, trail: [2] });
    assert.equal(r.meta.migratedFrom, 1);
    assert.equal(r.meta.version, 1);
    assert.equal(map.get('save.manual:1'), stored, 'load is read-only');
    assert.equal(sys.load(1).meta.migratedFrom, 1, 'repeatable');

    const gap = createSaveSystem({ storage: map, version: 3, migrations: { 2: migrations[2] } }).load(1);
    assert.equal(gap.error.code, ERROR_CODES.VERSION);
    assert.equal(gap.error.slot, 'manual:1');

    sys.save(1, sys.load(1).data);
    assert.equal(sys.load(1).meta.migratedFrom, null, 're-saving stamps the current version');
    assert.equal(sys.peek(1).version, 3);
  });
});

// ---------------------------------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------------------------------

describe('robustness', () => {
  it('never throws when the storage backend is completely broken', () => {
    let sys;
    assert.doesNotThrow(() => { sys = createSaveSystem({ storage: brokenStorage() }); });
    const checks = {
      save: sys.save(1, { a: 1 }),
      autosave: sys.autosave({ a: 1 }),
      load: sys.load(1),
      remove: sys.remove(1),
      clearAll: sys.clearAll(),
      importToSlot: sys.importString(toBase64(encodeRecord({ version: 1, time: 1, seq: 1, kind: 'manual', slot: 'manual:1', data: { a: 1 } }).record), { slot: 1 }),
    };
    for (const [name, result] of Object.entries(checks)) {
      assert.equal(result.ok, false, name);
      assert.equal(result.error.code, ERROR_CODES.STORAGE, name);
    }
    assert.deepEqual(sys.list(), []);
    assert.equal(sys.list({ all: true }).length, 6);
    assert.ok(sys.list({ all: true }).every((e) => e.state === 'corrupt' && e.error.code === ERROR_CODES.STORAGE));
    assert.equal(sys.latest(), null);
    assert.equal(sys.exportString(1), null);
    assert.deepEqual(sys.recover(), []);
    assert.equal(sys.peek(1).state, 'corrupt');
  });

  it('tolerates adapters that return undefined for missing keys', () => {
    const map = new Map();
    const sys = createSaveSystem({ storage: wrappedMap(map, { getItem: (k) => map.get(k) }) });
    assert.equal(sys.load(1).error.code, ERROR_CODES.EMPTY);
    assert.equal(sys.save(1, { a: 1 }).ok, true);
    assert.deepEqual(sys.load(1).data, { a: 1 });
  });

  it('keeps independent systems over the same store consistent', () => {
    const map = new Map();
    const clock = makeClock();
    const a = createSaveSystem({ storage: map, now: clock.now });
    const b = createSaveSystem({ storage: map, now: clock.now });
    a.save(1, { from: 'a' });
    assert.deepEqual(b.load(1).data, { from: 'a' });
    b.autosave({ from: 'b' });
    assert.equal(a.latest().slot, 'auto:1');
    assert.equal(a.autosave({ from: 'a' }).slot, 'auto:2', 'sequence read from storage, not cached');
  });
});

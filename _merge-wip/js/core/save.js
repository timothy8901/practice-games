/**
 * @module core/save
 *
 * Slot-based save persistence with verified writes, checksums, autosave rotation, export/import strings
 * and versioned migrations. Pure: the storage backend is injected (anything with the `localStorage`
 * `getItem`/`setItem`/`removeItem` trio, or a plain `Map`), so Node can import and unit-test the module.
 * The real `localStorage` is only looked up when `createSaveSystem` runs without a `storage` option,
 * never at import time.
 *
 * Record format, one string per slot key:
 *
 *     WSAVE1\n<crc32 as 8 hex chars>\n<header json>\n<data json>
 *
 * The CRC-32 covers everything after the second newline (`header\ndata`) as UTF-8 bytes, so a record can
 * be verified with any standard CRC-32 tool. The header (version, time, sequence number, summary) is
 * tiny and parsed on its own, so listing slots and choosing an autosave slot never parses the payload.
 * `JSON.stringify` never emits a raw newline, so the delimiters are unambiguous.
 *
 * Write protocol: serialize → checksum → write `<key>.tmp` → read back and compare → write `<key>` →
 * read back and compare → delete `<key>.tmp`. If the page dies between the two writes, the complete
 * `.tmp` record is promoted by `recover()` (run on construction) when it is newer than, or the only
 * valid alternative to, the real record.
 *
 * Ordering is by a persisted sequence number (`seq`, one higher than every record already stored), not
 * by wall-clock time, so autosave rotation and `latest()` behave identically under a frozen or
 * backwards-stepping clock.
 *
 * Storage-facing operations never throw: each returns `{ok: false, error}` with a structured
 * {@link SaveError}. Only invalid construction options throw, since those are programmer errors.
 */

/**
 * First line of every record; identifies the container format.
 * @type {'WSAVE1'}
 */
export const RECORD_MAGIC = 'WSAVE1';

/**
 * The two slot families. Slot ids are `${kind}:${index}` with a 1-based index, e.g. `manual:1`, `auto:3`.
 */
export const SLOT_KINDS = Object.freeze({ MANUAL: 'manual', AUTO: 'auto' });

/**
 * Stable error codes carried by every structured failure as `result.error.code`.
 */
export const ERROR_CODES = Object.freeze({
  /** The slot id or number does not name a configured slot. */
  INVALID_SLOT: 'invalid-slot',
  /** The data to save or migrate is not a non-null object. */
  INVALID_DATA: 'invalid-data',
  /** JSON serialization failed (cycles, BigInt, `toJSON` returning nothing, bad header fields). */
  SERIALIZE: 'serialize',
  /** The storage backend refused a write for lack of space. */
  QUOTA: 'quota',
  /** The storage backend threw for another reason (disabled, security policy, detached frame). */
  STORAGE: 'storage',
  /** A record read back right after writing did not match what was written. */
  VERIFY: 'verify',
  /** The slot holds nothing. */
  EMPTY: 'empty',
  /** The record failed its checksum or structural checks. */
  CORRUPT: 'corrupt',
  /** The text is not a save record at all (bad magic, not base64, not UTF-8). */
  FORMAT: 'format',
  /** The record's version is newer than this build, or no migration path reaches the current version. */
  VERSION: 'version',
  /** A migration step threw or returned no data. */
  MIGRATE: 'migrate',
});

/**
 * @typedef {Object} SaveError
 * @property {string} code One of {@link ERROR_CODES}.
 * @property {string} message Human-readable explanation.
 * @property {string} [slot] The slot involved, when there is one.
 * @property {unknown} [cause] The underlying exception, when there is one.
 */

/**
 * @typedef {Object} Failure
 * @property {false} ok
 * @property {SaveError} error
 */

/**
 * The minimal storage surface the save system needs; `localStorage` satisfies it.
 * @typedef {Object} StorageLike
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 */

/**
 * Metadata stored next to the payload in every record.
 * @typedef {Object} RecordHeader
 * @property {number} version Save-format version of the payload.
 * @property {number} time Wall-clock time of the write (ms since epoch, from the `now` option).
 * @property {number} seq Write sequence number, strictly increasing across the system's slots.
 * @property {string} kind Slot kind the record was written to.
 * @property {string} slot Slot id the record was written to.
 * @property {any} summary Caller-supplied JSON-able summary for menus, or `null`.
 */

/**
 * What {@link SaveSystem#peek} and {@link SaveSystem#list} report for a slot.
 * @typedef {Object} SlotEntry
 * @property {string} slot Slot id, e.g. `manual:2`.
 * @property {'manual'|'auto'} kind
 * @property {number} index 1-based index within its kind.
 * @property {'ok'|'empty'|'corrupt'} state
 * @property {number|null} time Write time, or `null` unless `state` is `ok`.
 * @property {number|null} seq Write sequence number, or `null` unless `state` is `ok`.
 * @property {number|null} version Payload version, or `null` unless `state` is `ok`.
 * @property {any} summary Stored summary, or `null` unless `state` is `ok`.
 * @property {number|null} size Record length in characters, or `null` when empty.
 * @property {SaveError} [error] Why the slot is unreadable, when `state` is `corrupt`.
 */

/**
 * @typedef {Object} SaveSystem
 * @property {number} version Current save-format version.
 * @property {string} prefix Storage key prefix.
 * @property {boolean} persistent `false` when no usable storage was given or found and saves live only
 *   in memory for this page load; a UI can warn the player.
 * @property {() => readonly string[]} slots All slot ids, manual slots first, each kind in index order.
 * @property {(slot: string|number) => boolean} isValidSlot
 * @property {(slot: string|number) => SlotEntry|null} peek Header-only inspection of one slot.
 * @property {(slot: string|number, data: object, opts?: {summary?: any}) => ({ok: true, slot: string,
 *   kind: string, index: number, time: number, seq: number, size: number} | Failure)} save
 * @property {(slot: string|number) => ({ok: true, slot: string, data: object,
 *   meta: SlotEntry & {migratedFrom: number|null}} | Failure)} load
 * @property {(opts?: {all?: boolean, kind?: 'manual'|'auto'}) => SlotEntry[]} list
 * @property {(slot: string|number) => ({ok: true, slot: string, existed: boolean} | Failure)} remove
 * @property {(data: object, opts?: {summary?: any}) => ReturnType<SaveSystem['save']>} autosave
 * @property {() => SlotEntry|null} latest
 * @property {(slot: string|number) => string|null} exportString
 * @property {(text: string, opts?: {slot?: string|number}) => ({ok: true, data: object,
 *   meta: RecordHeader & {migratedFrom: number|null, size: number}, slot?: string} | Failure)} importString
 * @property {(data: object, fromVersion?: number) => ({ok: true, data: object, from: number, to: number,
 *   migrated: boolean} | Failure)} migrate
 * @property {() => string[]} recover Promotes staged `.tmp` records; returns the slots it restored.
 * @property {() => ({ok: true, removed: number} | (Failure & {removed: number}))} clearAll
 */

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

const isObjectLike = (value) => typeof value === 'object' && value !== null;
const isCount = (value) => Number.isInteger(value) && value >= 0;

/**
 * Builds a {@link SaveError}, keeping only the extra fields that are defined.
 * @param {string} code
 * @param {string} message
 * @param {Object<string, unknown>} [extra]
 * @returns {SaveError}
 */
function makeError(code, message, extra) {
  const error = { code, message };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) error[key] = value;
    }
  }
  return error;
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Object<string, unknown>} [extra]
 * @returns {Failure}
 */
const failure = (code, message, extra) => ({ ok: false, error: makeError(code, message, extra) });

/**
 * Copies a failure, tagging its error with the slot it concerned.
 * @param {Failure} result
 * @param {string} slot
 * @returns {Failure}
 */
const withSlot = (result, slot) => ({ ok: false, error: { ...result.error, slot } });

// ---------------------------------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------------------------------

/** @type {Int32Array|null} */
let crcTable = null;

/** @returns {Int32Array} The reflected CRC-32 (IEEE 802.3) lookup table, built on first use. */
function getCrcTable() {
  if (crcTable) return crcTable;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  crcTable = table;
  return table;
}

/**
 * Standard CRC-32 (the zip/PNG polynomial) of a byte array, or of a string's UTF-8 encoding.
 * `crc32('123456789') === 0xcbf43926`.
 * @param {string|Uint8Array} input
 * @returns {number} Unsigned 32-bit checksum.
 */
export function crc32(input) {
  const bytes = typeof input === 'string' ? UTF8_ENCODER.encode(input) : input;
  const table = getCrcTable();
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/**
 * {@link crc32} as 8 lowercase hex characters, the form stored in records.
 * @param {string|Uint8Array} input
 * @returns {string}
 */
export function checksumHex(input) {
  return crc32(input).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------------------------------
// Base64 (environment-independent; handles UTF-8 text, unlike bare `btoa`)
// ---------------------------------------------------------------------------------------------------

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** @type {Int8Array|null} */
let b64Lookup = null;

/** @returns {Int8Array} Char code → sextet, accepting both the standard and the URL-safe alphabet. */
function getB64Lookup() {
  if (b64Lookup) return b64Lookup;
  const lookup = new Int8Array(128).fill(-1);
  for (let i = 0; i < 64; i++) lookup[B64_ALPHABET.charCodeAt(i)] = i;
  lookup['-'.charCodeAt(0)] = 62;
  lookup['_'.charCodeAt(0)] = 63;
  b64Lookup = lookup;
  return lookup;
}

/**
 * Encodes bytes, or a string's UTF-8 encoding, as standard padded base64.
 * @param {string|Uint8Array} input
 * @returns {string}
 */
export function toBase64(input) {
  const bytes = typeof input === 'string' ? UTF8_ENCODER.encode(input) : input;
  const parts = [];
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    parts.push(
      B64_ALPHABET[n >>> 18], B64_ALPHABET[(n >>> 12) & 63], B64_ALPHABET[(n >>> 6) & 63], B64_ALPHABET[n & 63],
    );
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    parts.push(B64_ALPHABET[n >>> 18], B64_ALPHABET[(n >>> 12) & 63], '==');
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    parts.push(B64_ALPHABET[n >>> 18], B64_ALPHABET[(n >>> 12) & 63], B64_ALPHABET[(n >>> 6) & 63], '=');
  }
  return parts.join('');
}

/**
 * Decodes base64 text to bytes. Forgiving about what a player pastes: whitespace anywhere, the URL-safe
 * alphabet, and missing padding are all accepted. Anything else that is not base64 yields `null`.
 * @param {string} text
 * @returns {Uint8Array|null}
 */
export function fromBase64(text) {
  if (typeof text !== 'string') return null;
  const clean = text.replace(/[\s=]+/g, '');
  if (clean.length % 4 === 1) return null;
  const lookup = getB64Lookup();
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean.charCodeAt(i);
    const v = c < 128 ? lookup[c] : -1;
    if (v < 0) return null;
    buffer = ((buffer << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >>> bits) & 0xff;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------------

/**
 * Serializes the header, dropping a summary that cannot be represented as JSON rather than failing the
 * whole save over a menu label.
 * @param {RecordHeader} fields
 * @returns {string}
 */
function serializeHeader(fields) {
  try {
    return JSON.stringify(fields);
  } catch {
    return JSON.stringify({ ...fields, summary: null });
  }
}

/**
 * Validates a parsed header and fills in defaults for the informational fields.
 * @param {unknown} raw
 * @returns {RecordHeader|null}
 */
function normalizeHeader(raw) {
  if (!isObjectLike(raw) || !isCount(raw.version) || !isCount(raw.seq) || !Number.isFinite(raw.time)) {
    return null;
  }
  return {
    version: raw.version,
    time: raw.time,
    seq: raw.seq,
    kind: typeof raw.kind === 'string' ? raw.kind : '',
    slot: typeof raw.slot === 'string' ? raw.slot : '',
    summary: raw.summary === undefined ? null : raw.summary,
  };
}

/**
 * Builds the string stored for a slot. Deterministic: identical fields give an identical record.
 * @param {Object} fields
 * @param {number} fields.version
 * @param {number} fields.time
 * @param {number} fields.seq
 * @param {string} fields.kind
 * @param {string} fields.slot
 * @param {any} [fields.summary]
 * @param {object} fields.data JSON-serializable payload. Values JSON cannot express (functions,
 *   `undefined`, symbols) are dropped as `JSON.stringify` does; cycles and BigInt are errors.
 * @returns {{ok: true, record: string, size: number} | Failure}
 */
export function encodeRecord({ version, time, seq, kind, slot, summary = null, data }) {
  if (!isObjectLike(data)) {
    return failure(ERROR_CODES.INVALID_DATA, 'record data must be a non-null object');
  }
  if (!isCount(version) || !isCount(seq) || !Number.isFinite(time)
    || typeof kind !== 'string' || typeof slot !== 'string') {
    return failure(ERROR_CODES.SERIALIZE, 'record header fields are invalid');
  }
  let dataJson;
  try {
    dataJson = JSON.stringify(data);
  } catch (cause) {
    return failure(ERROR_CODES.SERIALIZE, 'data is not JSON-serializable', { cause });
  }
  if (typeof dataJson !== 'string') {
    return failure(ERROR_CODES.SERIALIZE, 'data serialized to nothing');
  }
  const headerJson = serializeHeader({ version, time, seq, kind, slot, summary: summary ?? null });
  const body = `${headerJson}\n${dataJson}`;
  const record = `${RECORD_MAGIC}\n${checksumHex(body)}\n${body}`;
  return { ok: true, record, size: record.length };
}

/**
 * Parses and verifies a record string. The checksum is checked before anything is parsed.
 * @param {unknown} text
 * @param {{parseData?: boolean}} [opts] `parseData: false` verifies the record and parses only the
 *   header, which is all listing needs.
 * @returns {{ok: true, header: RecordHeader, data: object|undefined, size: number} | Failure}
 */
export function decodeRecord(text, { parseData = true } = {}) {
  if (typeof text !== 'string') return failure(ERROR_CODES.CORRUPT, 'record is not a string');
  const nl1 = text.indexOf('\n');
  if (nl1 < 0 || text.slice(0, nl1) !== RECORD_MAGIC) {
    return failure(ERROR_CODES.FORMAT, 'not a save record');
  }
  const nl2 = text.indexOf('\n', nl1 + 1);
  if (nl2 < 0) return failure(ERROR_CODES.CORRUPT, 'record is truncated');
  const hex = text.slice(nl1 + 1, nl2);
  if (!/^[0-9a-f]{8}$/.test(hex)) return failure(ERROR_CODES.CORRUPT, 'checksum field is malformed');
  const body = text.slice(nl2 + 1);
  const nl3 = body.indexOf('\n');
  if (nl3 < 0) return failure(ERROR_CODES.CORRUPT, 'record is truncated');
  if (checksumHex(body) !== hex) {
    return failure(ERROR_CODES.CORRUPT, 'checksum mismatch (record altered or truncated)');
  }
  let header;
  try {
    header = normalizeHeader(JSON.parse(body.slice(0, nl3)));
  } catch (cause) {
    return failure(ERROR_CODES.CORRUPT, 'header is not valid JSON', { cause });
  }
  if (!header) return failure(ERROR_CODES.CORRUPT, 'header fields are invalid');
  let data;
  if (parseData) {
    try {
      data = JSON.parse(body.slice(nl3 + 1));
    } catch (cause) {
      return failure(ERROR_CODES.CORRUPT, 'payload is not valid JSON', { cause });
    }
    if (!isObjectLike(data)) return failure(ERROR_CODES.CORRUPT, 'payload is not an object');
  }
  return { ok: true, header, data, size: text.length };
}

// ---------------------------------------------------------------------------------------------------
// Storage adapters
// ---------------------------------------------------------------------------------------------------

/** @returns {Error} An error shaped like the browsers' quota exception. */
function quotaError() {
  const error = new Error('The quota has been exceeded.');
  error.name = 'QuotaExceededError';
  error.code = 22;
  return error;
}

/**
 * Recognizes the quota exceptions thrown by Blink/WebKit (`QuotaExceededError`, code 22) and Gecko
 * (`NS_ERROR_DOM_QUOTA_REACHED`, code 1014).
 * @param {unknown} error
 * @returns {boolean}
 */
function isQuotaError(error) {
  if (!isObjectLike(error)) return false;
  const name = String(error.name || '');
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || error.code === 22 || error.code === 1014;
}

/**
 * An in-memory `localStorage` look-alike for tests and for browsers without usable storage.
 * @param {{quota?: number}} [opts] `quota` caps the total characters held (keys plus values); a write
 *   that would exceed it throws a `QuotaExceededError`-shaped error exactly like a real browser.
 * @returns {StorageLike & {length: number, usage: number, key: (i: number) => string|null,
 *   clear: () => void}}
 */
export function createMemoryStorage({ quota = Infinity } = {}) {
  /** @type {Map<string, string>} */
  const map = new Map();
  let used = 0;
  const sizeOf = (key) => key.length + map.get(key).length;
  return {
    get length() {
      return map.size;
    },
    get usage() {
      return used;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    getItem(key) {
      const k = String(key);
      return map.has(k) ? map.get(k) : null;
    },
    setItem(key, value) {
      const k = String(key);
      const v = String(value);
      const next = used - (map.has(k) ? sizeOf(k) : 0) + k.length + v.length;
      if (next > quota) throw quotaError();
      map.set(k, v);
      used = next;
    },
    removeItem(key) {
      const k = String(key);
      if (!map.has(k)) return;
      used -= sizeOf(k);
      map.delete(k);
    },
    clear() {
      map.clear();
      used = 0;
    },
  };
}

/**
 * @param {unknown} candidate
 * @returns {candidate is StorageLike}
 */
function isStorageLike(candidate) {
  return isObjectLike(candidate) || typeof candidate === 'function'
    ? typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function'
      && typeof candidate.removeItem === 'function'
    : false;
}

/**
 * @param {Map<string, string>} map
 * @returns {StorageLike}
 */
function wrapMap(map) {
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * Finds a working `localStorage`, if the host has one. Access itself can throw (sandboxed frames,
 * blocked cookies) and Safari's private mode used to accept the object but reject every write, so the
 * probe does a real round trip.
 * @returns {StorageLike|null}
 */
function detectLocalStorage() {
  try {
    const candidate = globalThis.localStorage;
    if (!isStorageLike(candidate)) return null;
    const probe = '__save_probe__';
    candidate.setItem(probe, '1');
    const ok = candidate.getItem(probe) === '1';
    candidate.removeItem(probe);
    return ok ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} option The `storage` option as given.
 * @returns {{storage: StorageLike, persistent: boolean}}
 */
function resolveStorage(option) {
  if (option instanceof Map) return { storage: wrapMap(option), persistent: false };
  if (isStorageLike(option)) return { storage: option, persistent: true };
  if (option !== null && option !== undefined) {
    throw new TypeError('storage must be localStorage-like (getItem/setItem/removeItem) or a Map');
  }
  const native = detectLocalStorage();
  return native
    ? { storage: native, persistent: true }
    : { storage: createMemoryStorage(), persistent: false };
}

// ---------------------------------------------------------------------------------------------------
// Save system
// ---------------------------------------------------------------------------------------------------

/**
 * Builds a slot id from its parts.
 * @param {'manual'|'auto'} kind
 * @param {number} index 1-based.
 * @returns {string}
 */
export function slotId(kind, index) {
  return `${kind}:${index}`;
}

/**
 * Default summary extractor: the payload's own `summary` property, if it has one.
 * @param {object} data
 * @returns {any}
 */
const defaultSummarize = (data) => (Object.hasOwn(data, 'summary') ? data.summary : null);

/**
 * Orders slot entries newest first: by sequence number, then write time, then manual before auto, then
 * index. Every tie-breaker is deterministic so `latest()` never depends on iteration luck.
 * @param {SlotEntry} a
 * @param {SlotEntry} b
 * @returns {number}
 */
function newerFirst(a, b) {
  if (a.seq !== b.seq) return b.seq - a.seq;
  if (a.time !== b.time) return b.time - a.time;
  if (a.kind !== b.kind) return a.kind === SLOT_KINDS.MANUAL ? -1 : 1;
  return a.index - b.index;
}

const EMPTY_ENTRY_FIELDS = Object.freeze({ time: null, seq: null, version: null, summary: null, size: null });

/**
 * Creates a save system over the given storage.
 *
 * @param {Object} [options]
 * @param {StorageLike|Map<string, string>|null} [options.storage] Backend. Omitted or `null`: the host's
 *   `localStorage` when it works, otherwise an in-memory store (then `persistent` is `false`).
 * @param {string} [options.prefix='save.'] Prepended to every storage key.
 * @param {number} [options.autosaveSlots=3] Number of `auto:N` slots that `autosave()` rotates through.
 * @param {number} [options.manualSlots=3] Number of `manual:N` slots.
 * @param {number} [options.version=1] Current save-format version, stamped on every record.
 * @param {Object<number, (data: object, fromVersion: number) => object>} [options.migrations] Upgrade
 *   steps keyed by the version they upgrade FROM; step `n` turns version-`n` data into version `n + 1`.
 *   A step may mutate and return its input or return a new object.
 * @param {(data: object) => any} [options.summarize] Derives the JSON-able summary stored in a record's
 *   header for menus. Default: `data.summary` when present, else `null`. A throwing summarizer yields
 *   `null` rather than blocking the save.
 * @param {() => number} [options.now=Date.now] Clock used for record times; inject for deterministic
 *   tests.
 * @returns {SaveSystem}
 * @throws {TypeError} On invalid options (the only place this module throws).
 */
export function createSaveSystem(options = {}) {
  const {
    storage: storageOption = null,
    prefix = 'save.',
    autosaveSlots = 3,
    manualSlots = 3,
    version = 1,
    migrations = {},
    summarize = defaultSummarize,
    now = Date.now,
  } = options;

  if (typeof prefix !== 'string') throw new TypeError('prefix must be a string');
  if (!isCount(autosaveSlots) || !isCount(manualSlots)) {
    throw new TypeError('autosaveSlots and manualSlots must be non-negative integers');
  }
  if (!isCount(version)) throw new TypeError('version must be a non-negative integer');
  if (!isObjectLike(migrations)) throw new TypeError('migrations must be an object keyed by source version');
  if (typeof summarize !== 'function') throw new TypeError('summarize must be a function');
  if (typeof now !== 'function') throw new TypeError('now must be a function');

  const { storage, persistent } = resolveStorage(storageOption);

  /**
   * @typedef {Object} SlotInfo
   * @property {string} slot
   * @property {'manual'|'auto'} kind
   * @property {number} index
   * @property {string} key
   * @property {string} tmpKey
   */

  /** @type {Map<string, SlotInfo>} */
  const slotTable = new Map();
  for (const [kind, count] of [[SLOT_KINDS.MANUAL, manualSlots], [SLOT_KINDS.AUTO, autosaveSlots]]) {
    for (let index = 1; index <= count; index++) {
      const slot = slotId(kind, index);
      slotTable.set(slot, { slot, kind, index, key: prefix + slot, tmpKey: `${prefix}${slot}.tmp` });
    }
  }
  const slotIds = Object.freeze([...slotTable.keys()]);

  /**
   * @param {unknown} slot A slot id, or a manual slot number.
   * @returns {SlotInfo|null}
   */
  function resolveSlot(slot) {
    const id = Number.isInteger(slot) ? slotId(SLOT_KINDS.MANUAL, slot) : slot;
    return (typeof id === 'string' && slotTable.get(id)) || null;
  }

  const invalidSlot = (slot) => failure(ERROR_CODES.INVALID_SLOT, `unknown slot ${String(slot)}`);

  // --- raw storage access: every backend call is fenced so nothing below ever throws ---

  /**
   * @param {string} key
   * @returns {{ok: true, value: string|null} | Failure}
   */
  function readRaw(key) {
    try {
      const value = storage.getItem(key);
      return { ok: true, value: value === undefined ? null : value };
    } catch (cause) {
      return failure(ERROR_CODES.STORAGE, `storage read failed for ${key}`, { cause });
    }
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {{ok: true} | Failure}
   */
  function writeRaw(key, value) {
    try {
      storage.setItem(key, value);
      return { ok: true };
    } catch (cause) {
      return isQuotaError(cause)
        ? failure(ERROR_CODES.QUOTA, 'storage quota exceeded', { cause })
        : failure(ERROR_CODES.STORAGE, `storage write failed for ${key}`, { cause });
    }
  }

  /**
   * @param {string} key
   * @returns {{ok: true} | Failure}
   */
  function removeRaw(key) {
    try {
      storage.removeItem(key);
      return { ok: true };
    } catch (cause) {
      return failure(ERROR_CODES.STORAGE, `storage remove failed for ${key}`, { cause });
    }
  }

  // --- inspection ---

  /**
   * @param {SlotInfo} info
   * @param {RecordHeader} header
   * @param {number} size
   * @returns {SlotEntry}
   */
  const okEntry = (info, header, size) => ({
    slot: info.slot,
    kind: info.kind,
    index: info.index,
    state: 'ok',
    time: header.time,
    seq: header.seq,
    version: header.version,
    summary: header.summary,
    size,
  });

  /**
   * @param {SlotInfo} info
   * @returns {SlotEntry}
   */
  function entryFor(info) {
    const base = { slot: info.slot, kind: info.kind, index: info.index };
    const raw = readRaw(info.key);
    if (!raw.ok) return { ...base, state: 'corrupt', ...EMPTY_ENTRY_FIELDS, error: raw.error };
    if (raw.value === null) return { ...base, state: 'empty', ...EMPTY_ENTRY_FIELDS };
    const decoded = decodeRecord(raw.value, { parseData: false });
    if (!decoded.ok) {
      return { ...base, state: 'corrupt', ...EMPTY_ENTRY_FIELDS, size: raw.value.length, error: decoded.error };
    }
    return okEntry(info, decoded.header, decoded.size);
  }

  /** @returns {SlotEntry[]} Every slot, manual first, in index order. */
  const allEntries = () => [...slotTable.values()].map(entryFor);

  /**
   * @param {string|number} slot
   * @returns {SlotEntry|null}
   */
  function peek(slot) {
    const info = resolveSlot(slot);
    return info ? entryFor(info) : null;
  }

  /**
   * @param {{all?: boolean, kind?: 'manual'|'auto'}} [opts] `all` includes empty and corrupt slots so a
   *   menu can draw every slot in order; `kind` restricts to one family.
   * @returns {SlotEntry[]}
   */
  function list({ all = false, kind } = {}) {
    return allEntries().filter((entry) => (kind === undefined || entry.kind === kind)
      && (all || entry.state === 'ok'));
  }

  /** @returns {SlotEntry|null} The most recently written readable slot of any kind. */
  function latest() {
    const readable = allEntries().filter((entry) => entry.state === 'ok');
    return readable.length ? readable.sort(newerFirst)[0] : null;
  }

  // --- migration ---

  /**
   * Brings `data` from `fromVersion` to the current version by applying the configured steps in order.
   * @param {object} data
   * @param {number} [fromVersion] Defaults to `data.version` when that is a non-negative integer,
   *   otherwise to the current version (a no-op).
   * @returns {{ok: true, data: object, from: number, to: number, migrated: boolean} | Failure}
   */
  function migrate(data, fromVersion) {
    if (!isObjectLike(data)) return failure(ERROR_CODES.INVALID_DATA, 'data must be a non-null object');
    const from = fromVersion === undefined ? (isCount(data.version) ? data.version : version) : fromVersion;
    if (!isCount(from)) return failure(ERROR_CODES.VERSION, 'source version must be a non-negative integer');
    if (from > version) {
      return failure(ERROR_CODES.VERSION,
        `save is from a newer version (${from}) than this build (${version})`, { from, to: version });
    }
    let current = data;
    for (let at = from; at < version; at++) {
      const step = migrations[at];
      if (typeof step !== 'function') {
        return failure(ERROR_CODES.VERSION, `no migration from version ${at} to ${at + 1}`,
          { from, to: version, at });
      }
      try {
        current = step(current, at);
      } catch (cause) {
        return failure(ERROR_CODES.MIGRATE, `migration ${at} -> ${at + 1} threw`, { from, to: version, at, cause });
      }
      if (!isObjectLike(current)) {
        return failure(ERROR_CODES.MIGRATE, `migration ${at} -> ${at + 1} returned no data`,
          { from, to: version, at });
      }
    }
    return { ok: true, data: current, from, to: version, migrated: from !== version };
  }

  // --- reading ---

  /**
   * @param {string|number} slot
   * @returns {{ok: true, slot: string, data: object, meta: SlotEntry & {migratedFrom: number|null}} | Failure}
   */
  function load(slot) {
    const info = resolveSlot(slot);
    if (!info) return invalidSlot(slot);
    const raw = readRaw(info.key);
    if (!raw.ok) return withSlot(raw, info.slot);
    if (raw.value === null) return failure(ERROR_CODES.EMPTY, `slot ${info.slot} is empty`, { slot: info.slot });
    const decoded = decodeRecord(raw.value);
    if (!decoded.ok) return withSlot(decoded, info.slot);
    const migrated = migrate(decoded.data, decoded.header.version);
    if (!migrated.ok) return withSlot(migrated, info.slot);
    return {
      ok: true,
      slot: info.slot,
      data: migrated.data,
      meta: { ...okEntry(info, decoded.header, decoded.size), migratedFrom: migrated.migrated ? migrated.from : null },
    };
  }

  // --- writing ---

  /**
   * @param {object} data
   * @returns {any}
   */
  function safeSummarize(data) {
    try {
      const summary = summarize(data);
      return summary === undefined ? null : summary;
    } catch {
      return null;
    }
  }

  /**
   * The verified write: stage under the temp key, read back, then write the real key and read back.
   * @param {SlotInfo} info
   * @param {string} record
   * @returns {{ok: true} | Failure}
   */
  function commit(info, record) {
    const staged = writeRaw(info.tmpKey, record);
    if (!staged.ok) {
      removeRaw(info.tmpKey);
      return withSlot(staged, info.slot);
    }
    const stagedBack = readRaw(info.tmpKey);
    if (!stagedBack.ok) {
      removeRaw(info.tmpKey);
      return withSlot(stagedBack, info.slot);
    }
    if (stagedBack.value !== record || !decodeRecord(stagedBack.value, { parseData: false }).ok) {
      removeRaw(info.tmpKey);
      return failure(ERROR_CODES.VERIFY, 'staged record did not read back intact', { slot: info.slot });
    }
    const written = writeRaw(info.key, record);
    if (!written.ok) {
      removeRaw(info.tmpKey);
      return withSlot(written, info.slot);
    }
    const writtenBack = readRaw(info.key);
    if (!writtenBack.ok) return withSlot(writtenBack, info.slot);
    if (writtenBack.value !== record) {
      // The staged copy is left in place: recover() promotes it on the next launch.
      return failure(ERROR_CODES.VERIFY, 'record did not read back intact', { slot: info.slot });
    }
    removeRaw(info.tmpKey);
    return { ok: true };
  }

  /**
   * @param {SlotInfo} info
   * @param {unknown} data
   * @param {any} summaryOverride `undefined` to derive the summary from the data.
   * @param {SlotEntry[]|null} entries Pre-computed entries for every slot, or `null` to compute them.
   * @returns {{ok: true, slot: string, kind: string, index: number, time: number, seq: number, size: number} | Failure}
   */
  function writeSlot(info, data, summaryOverride, entries) {
    if (!isObjectLike(data)) {
      return failure(ERROR_CODES.INVALID_DATA, 'save data must be a non-null object', { slot: info.slot });
    }
    const current = entries ?? allEntries();
    const seq = current.reduce((max, entry) => (entry.state === 'ok' && entry.seq > max ? entry.seq : max), 0) + 1;
    const time = now();
    const summary = summaryOverride === undefined ? safeSummarize(data) : summaryOverride;
    const encoded = encodeRecord({ version, time, seq, kind: info.kind, slot: info.slot, summary, data });
    if (!encoded.ok) return withSlot(encoded, info.slot);
    const committed = commit(info, encoded.record);
    if (!committed.ok) return committed;
    return { ok: true, slot: info.slot, kind: info.kind, index: info.index, time, seq, size: encoded.size };
  }

  /**
   * @param {string|number} slot
   * @param {object} data
   * @param {{summary?: any}} [opts]
   * @returns {ReturnType<typeof writeSlot>}
   */
  function save(slot, data, { summary } = {}) {
    const info = resolveSlot(slot);
    if (!info) return invalidSlot(slot);
    return writeSlot(info, data, summary, null);
  }

  /**
   * Chooses the autosave slot to overwrite: the first slot that is not readable (empty or corrupt),
   * else the one with the lowest sequence number (the oldest write).
   * @param {SlotEntry[]} entries
   * @returns {SlotEntry|null}
   */
  function pickAutosaveSlot(entries) {
    const autos = entries.filter((entry) => entry.kind === SLOT_KINDS.AUTO);
    if (!autos.length) return null;
    return autos.find((entry) => entry.state !== 'ok')
      ?? autos.reduce((oldest, entry) => (entry.seq < oldest.seq ? entry : oldest));
  }

  /**
   * @param {object} data
   * @param {{summary?: any}} [opts]
   * @returns {ReturnType<typeof writeSlot>}
   */
  function autosave(data, { summary } = {}) {
    const entries = allEntries();
    const target = pickAutosaveSlot(entries);
    if (!target) return failure(ERROR_CODES.INVALID_SLOT, 'no autosave slots are configured');
    return writeSlot(slotTable.get(target.slot), data, summary, entries);
  }

  // --- removal ---

  /**
   * @param {string|number} slot
   * @returns {{ok: true, slot: string, existed: boolean} | Failure}
   */
  function remove(slot) {
    const info = resolveSlot(slot);
    if (!info) return invalidSlot(slot);
    const before = readRaw(info.key);
    const existed = before.ok && before.value !== null;
    const removedReal = removeRaw(info.key);
    if (!removedReal.ok) return withSlot(removedReal, info.slot);
    const removedTmp = removeRaw(info.tmpKey);
    if (!removedTmp.ok) return withSlot(removedTmp, info.slot);
    return { ok: true, slot: info.slot, existed };
  }

  /** @returns {{ok: true, removed: number} | (Failure & {removed: number})} */
  function clearAll() {
    let removed = 0;
    for (const slot of slotIds) {
      const result = remove(slot);
      if (!result.ok) return { ...result, removed };
      if (result.existed) removed++;
    }
    return { ok: true, removed };
  }

  // --- export / import ---

  /**
   * @param {string|number} slot
   * @returns {string|null} Base64 of the verified record, or `null` when the slot is unknown, empty or
   *   unreadable.
   */
  function exportString(slot) {
    const info = resolveSlot(slot);
    if (!info) return null;
    const raw = readRaw(info.key);
    if (!raw.ok || raw.value === null || !decodeRecord(raw.value, { parseData: false }).ok) return null;
    return toBase64(raw.value);
  }

  /**
   * Decodes, verifies and migrates an exported string. Nothing is written unless `slot` is given.
   * @param {string} text
   * @param {{slot?: string|number}} [opts] With `slot`, the imported data is also saved there (keeping
   *   the exported summary); the save result is returned as `saved`.
   * @returns {{ok: true, data: object, meta: RecordHeader & {migratedFrom: number|null, size: number},
   *   slot?: string, saved?: object} | Failure}
   */
  function importString(text, { slot } = {}) {
    const bytes = fromBase64(text);
    if (!bytes) return failure(ERROR_CODES.FORMAT, 'not a base64 save string');
    let record;
    try {
      record = UTF8_DECODER.decode(bytes);
    } catch (cause) {
      return failure(ERROR_CODES.FORMAT, 'save string does not decode to text', { cause });
    }
    const decoded = decodeRecord(record);
    if (!decoded.ok) return decoded;
    const migrated = migrate(decoded.data, decoded.header.version);
    if (!migrated.ok) return migrated;
    const result = {
      ok: true,
      data: migrated.data,
      meta: { ...decoded.header, migratedFrom: migrated.migrated ? migrated.from : null, size: decoded.size },
    };
    if (slot === undefined) return result;
    const saved = save(slot, migrated.data, { summary: decoded.header.summary });
    return saved.ok ? { ...result, slot: saved.slot, saved } : saved;
  }

  // --- crash recovery ---

  /**
   * Replays staged writes. A valid `.tmp` record is promoted when the real record is missing or
   * unreadable, or when the staged one is newer (a crash between the two writes of a commit); otherwise
   * the stale temp key is simply removed.
   * @returns {string[]} Slots whose records were restored from their staged copy.
   */
  function recover() {
    const recovered = [];
    for (const info of slotTable.values()) {
      const staged = readRaw(info.tmpKey);
      if (!staged.ok || staged.value === null) continue;
      const stagedDecoded = decodeRecord(staged.value, { parseData: false });
      let promote = false;
      if (stagedDecoded.ok) {
        const real = readRaw(info.key);
        const realDecoded = real.ok && real.value !== null ? decodeRecord(real.value, { parseData: false }) : null;
        promote = !realDecoded?.ok || stagedDecoded.header.seq > realDecoded.header.seq;
      }
      if (promote) {
        const written = writeRaw(info.key, staged.value);
        const back = written.ok ? readRaw(info.key) : written;
        // On failure the staged copy stays for a later attempt.
        if (!back.ok || back.value !== staged.value) continue;
        recovered.push(info.slot);
      }
      removeRaw(info.tmpKey);
    }
    return recovered;
  }

  const system = Object.freeze({
    version,
    prefix,
    persistent,
    slots: () => slotIds,
    isValidSlot: (slot) => resolveSlot(slot) !== null,
    peek,
    save,
    load,
    list,
    remove,
    autosave,
    latest,
    exportString,
    importString,
    migrate,
    recover,
    clearAll,
  });
  recover();
  return system;
}

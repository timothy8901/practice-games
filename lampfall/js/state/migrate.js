/**
 * Save-format migrations (ARCHITECTURE §3.3).
 *
 * `MIGRATIONS` is keyed by the version being upgraded FROM; step `n` turns version-`n` data into
 * version `n + 1`. `core/save.createSaveSystem({version, migrations})` applies the same table on
 * `load()` / `importString()`; {@link migrateWorld} is the standalone path (fixtures, debug, tools)
 * and additionally runs {@link fillDefaults} so new keys appear with their defaults.
 *
 * Never rename a field in place: add the new one, fill it in the migration, delete the old one in
 * the migration. Each step has a fixture test (`test/fixtures/v<n>.json`).
 *
 * Pure. Lane: STATE.
 * @module state/migrate
 */

import { SCHEMA_VERSION, worldDefaults, creatureDefaults, npcMemoryDefaults, mapStateDefaults, threadStateDefaults, fieldLogEntryDefaults, weatherStateDefaults, isPlainObject } from './schema.js';

/** @typedef {import('./schema.js').World} World */

/**
 * Version 0 is "pre-versioned": any object without a numeric `v`. The step only stamps the version;
 * {@link fillDefaults} does the rest.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate0to1(data) {
  data.v = 1;
  return data;
}

/**
 * v1 -> v2 (SYS-TIME): `world.weather` grows from `{today, tomorrow, intensity}` to the full
 * WeatherState (`day, lead, current, onset, forecast, outlook`). A v1 save never rolled a forecast,
 * so `day` is 0 and `systems/weather.update` rolls the current day on the first tick after loading;
 * `lead` and `current` take the saved `today` so nothing changes on screen until then.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate1to2(data) {
  const old = isPlainObject(data.weather) ? data.weather : {};
  const base = weatherStateDefaults();
  const today = typeof old.today === 'string' && old.today !== '' ? old.today : base.today;
  data.weather = {
    ...base,
    today,
    lead: today,
    current: today,
    tomorrow: typeof old.tomorrow === 'string' && old.tomorrow !== '' ? old.tomorrow : base.tomorrow,
    intensity: typeof old.intensity === 'number' && old.intensity >= 0 && old.intensity <= 1 ? old.intensity : base.intensity,
  };
  data.v = 2;
  return data;
}

/**
 * Upgrade steps keyed by source version. Append one entry each time {@link SCHEMA_VERSION} bumps;
 * never edit an existing step once a save in the wild carries that version.
 * @type {Readonly<Record<number, (data: Record<string, any>, fromVersion: number) => Record<string, any>>>}
 */
export const MIGRATIONS = Object.freeze({
  0: migrate0to1,
  1: migrate1to2,
});

/**
 * Deep-merges defaults under `data`: keys missing from `data` get the default; keys present keep
 * their value unless the default is a plain object and the value is not (then the default wins, since
 * a wrong-typed sub-tree would break every system reading it). Arrays are kept as given. String-keyed
 * records (`npcs`, `maps`, `threads`, `fieldLog.forms`) and creatures get per-entry defaults too.
 *
 * Returns a NEW object; `data` is not modified.
 *
 * @param {Record<string, any>} data
 * @returns {World}
 */
export function fillDefaults(data) {
  const base = /** @type {Record<string, any>} */ (worldDefaults());
  const src = isPlainObject(data) ? data : {};
  const merged = /** @type {any} */ (mergeDefaults(base, src));

  for (const list of ['party', 'box']) {
    if (Array.isArray(merged[list])) {
      merged[list] = merged[list].map((c) => (isPlainObject(c) ? mergeDefaults(creatureDefaults(), c) : c));
    }
  }
  merged.npcs = fillRecord(merged.npcs, npcMemoryDefaults);
  merged.maps = fillRecord(merged.maps, mapStateDefaults);
  merged.threads = fillRecord(merged.threads, threadStateDefaults);
  if (isPlainObject(merged.fieldLog)) merged.fieldLog.forms = fillRecord(merged.fieldLog.forms, fieldLogEntryDefaults);
  return merged;
}

/**
 * @param {unknown} record
 * @param {() => Record<string, any>} defaults
 * @returns {Record<string, any>}
 */
function fillRecord(record, defaults) {
  if (!isPlainObject(record)) return {};
  /** @type {Record<string, any>} */
  const out = {};
  for (const [id, entry] of Object.entries(record)) {
    out[id] = isPlainObject(entry) ? mergeDefaults(defaults(), entry) : entry;
  }
  return out;
}

/**
 * @param {Record<string, any>} defaults a fresh default tree (it is consumed)
 * @param {Record<string, any>} value
 * @returns {Record<string, any>}
 */
function mergeDefaults(defaults, value) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const v = value[key];
    if (v === undefined) {
      out[key] = d;
    } else if (isPlainObject(d)) {
      out[key] = isPlainObject(v) ? mergeDefaults(d, v) : d;
    } else if (Array.isArray(d)) {
      out[key] = Array.isArray(v) ? cloneJson(v) : d;
    } else {
      out[key] = cloneJson(v);
    }
  }
  for (const key of Object.keys(value)) {
    if (!(key in defaults)) out[key] = cloneJson(value[key]);
  }
  return out;
}

/**
 * JSON-shaped deep copy (plain objects and arrays; other values by reference).
 * @template T
 * @param {T} v
 * @returns {T}
 */
function cloneJson(v) {
  if (Array.isArray(v)) return /** @type {any} */ (v.map(cloneJson));
  if (isPlainObject(v)) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of Object.keys(v)) out[k] = cloneJson(v[k]);
    return /** @type {any} */ (out);
  }
  return v;
}

/**
 * @typedef {Object} MigrateError
 * @property {'invalid-data'|'version'|'migrate'} code
 * @property {string} message
 * @property {number} [at]       the step that failed
 * @property {unknown} [cause]
 */

/**
 * Brings `data` from its own version (`data.v`, else 0) to {@link SCHEMA_VERSION}, then fills
 * defaults. Does not validate; call `validateWorld` on the result. Never throws; `data` is left as
 * it was (steps run on a copy).
 *
 * @param {unknown} data
 * @param {number} [fromVersion]   override the source version (defaults to `data.v` when an integer >= 0, else 0)
 * @returns {{ok: true, world: World, from: number, to: number, migrated: boolean} | {ok: false, error: MigrateError}}
 */
export function migrateWorld(data, fromVersion) {
  if (!isPlainObject(data)) {
    return { ok: false, error: { code: 'invalid-data', message: 'save data must be a plain object' } };
  }
  const from = fromVersion === undefined
    ? (Number.isInteger(data.v) && data.v >= 0 ? data.v : 0)
    : fromVersion;
  if (!Number.isInteger(from) || from < 0) {
    return { ok: false, error: { code: 'version', message: `source version must be a non-negative integer, got ${String(from)}` } };
  }
  if (from > SCHEMA_VERSION) {
    return { ok: false, error: { code: 'version', message: `save is from a newer version (${from}) than this build (${SCHEMA_VERSION})` } };
  }
  let current = cloneJson(data);
  for (let at = from; at < SCHEMA_VERSION; at++) {
    const step = MIGRATIONS[at];
    if (typeof step !== 'function') {
      return { ok: false, error: { code: 'version', message: `no migration from version ${at} to ${at + 1}`, at } };
    }
    try {
      current = step(current, at);
    } catch (cause) {
      return { ok: false, error: { code: 'migrate', message: `migration ${at} -> ${at + 1} threw`, at, cause } };
    }
    if (!isPlainObject(current)) {
      return { ok: false, error: { code: 'migrate', message: `migration ${at} -> ${at + 1} returned no data`, at } };
    }
  }
  const world = fillDefaults(current);
  world.v = SCHEMA_VERSION;
  return { ok: true, world, from, to: SCHEMA_VERSION, migrated: from !== SCHEMA_VERSION };
}

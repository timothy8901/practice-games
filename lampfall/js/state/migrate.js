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
 * WeatherState (`day, lead, current, onset, forecast, outlook, pinned`). A v1 save never rolled a forecast,
 * so `day` is 0 (and `pinned` null) and `systems/weather.update` rolls the current day on the first tick after loading;
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
/**
 * Pocket renames applied by {@link migrate2to3}: version-2 pocket id -> version-3 pocket id.
 * `systems/bag.normalize` later moves any stack whose item row names a different pocket.
 */
export const POCKET_RENAMES_V3 = Object.freeze({ items: 'medicine', catch: 'wicks', key: 'keepsakes', tools: 'tools', keepsakes: 'keepsakes' });

/**
 * v2 -> v3 (RULES-ECON): the satchel gets the GDD-00 pockets (`wicks medicine discs finds held
 * keepsakes tools`); old pockets fold in through {@link POCKET_RENAMES_V3} (an unknown old pocket keeps
 * its name; same-id stacks merge). The wallet, loans and the new `shops` key gain their bookkeeping
 * fields from {@link fillDefaults}; nothing else changes.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate2to3(data) {
  if (isPlainObject(data.bag) && isPlainObject(data.bag.pockets)) {
    /** @type {Record<string, Array<{id: string, n: number}>>} */
    const pockets = {};
    /** @type {Record<string, number>} */
    const capacity = {};
    const oldCap = isPlainObject(data.bag.capacity) ? data.bag.capacity : {};
    for (const [pocket, stacks] of Object.entries(data.bag.pockets)) {
      const to = Object.prototype.hasOwnProperty.call(POCKET_RENAMES_V3, pocket) ? POCKET_RENAMES_V3[pocket] : pocket;
      const list = pockets[to] ?? (pockets[to] = []);
      if (Array.isArray(stacks)) {
        for (const st of stacks) {
          if (!isPlainObject(st) || typeof st.id !== 'string' || !Number.isInteger(st.n) || st.n < 1) continue;
          const same = list.find((x) => x.id === st.id);
          if (same) same.n += st.n;
          else list.push({ id: st.id, n: st.n });
        }
      }
      if (!(to in capacity)) capacity[to] = Number.isInteger(oldCap[pocket]) && oldCap[pocket] >= 0 && !(pocket in POCKET_RENAMES_V3) ? oldCap[pocket] : 0;
    }
    data.bag = { ...data.bag, pockets, capacity };
  }
  data.v = 3;
  return data;
}

/**
 * v3 -> v4 (SYS-TOWN): letters arrive on three channels (GDD-00 §11), so `world.letters` records
 * which letters arrived (`got`) instead of assuming 1..delivered. A v3 save delivered letters in
 * order, so `got` is `1..delivered`, and an unread `today` is still in the mailbox; a `today` letter
 * stamps `keeperDay` with the save's clock day so loading never brings a second one. The other new
 * letter keys, the new NpcMemory keys (`gifts`, `nicknameChoice`, `lastLineId`, `lingerDay`,
 * `lastGiftDay`) come from {@link fillDefaults}; the new `dayPage` tally is opened on the save's
 * page day with the save's stats as its base.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate3to4(data) {
  if (isPlainObject(data.letters)) {
    const L = data.letters;
    const delivered = Number.isInteger(L.delivered) && L.delivered >= 0 ? L.delivered : 0;
    if (!Array.isArray(L.got)) {
      const read = Array.isArray(L.read) ? L.read : [];
      const today = Number.isInteger(L.today) && L.today >= 1 && L.today <= delivered ? L.today : null;
      // the v1 `today` letter came this morning: stamp the day so no second one arrives on load
      const total = isPlainObject(data.clock) && typeof data.clock.total === 'number' && Number.isFinite(data.clock.total) && data.clock.total >= 0 ? data.clock.total : 0;
      const keeperDay = Number.isInteger(L.keeperDay) ? L.keeperDay : today !== null ? Math.floor(total / 1440) : -1;
      data.letters = {
        ...L,
        delivered,
        today,
        keeperDay,
        got: Array.from({ length: delivered }, (_, i) => i + 1),
        mailbox: today !== null && !read.includes(today) ? [today] : [],
      };
    }
  }
  // open the Day Page tally on the save's page day (the small hours before 06:00 belong to the day
  // before), so the first overnight after loading knows which morning comes next
  if (!isPlainObject(data.dayPage)) {
    const total = isPlainObject(data.clock) && typeof data.clock.total === 'number' && Number.isFinite(data.clock.total) && data.clock.total >= 0 ? data.clock.total : 0;
    const day = Math.floor(total / 1440);
    /** @type {Record<string, number>} */
    const base = {};
    if (isPlainObject(data.stats)) for (const [k, v] of Object.entries(data.stats)) if (typeof v === 'number' && Number.isFinite(v) && k !== 'playMs') base[k] = v;
    data.dayPage = { day: Math.max(0, total % 1440 < 360 ? day - 1 : day), base, earned: 0, paid: 0, notes: [], last: null };
  }
  data.v = 4;
  return data;
}

/**
 * v4 -> v5 (SYS-GATHER / SYS-WORLD): fishing reaches recover from the time their health was set
 * (`maps[].reachAt`), the Patient record board and the Kiln clean day join `collections`, and the new
 * `encounter` key holds the step floor and Errant state. A v4 save never fished a reach with a
 * timestamp, so every stored reach health is stamped "now" (`clock.total`): it recovers from the
 * moment of loading, which is never harsher than the old fixed value. The rest is defaults.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate4to5(data) {
  const now = isPlainObject(data.clock) && typeof data.clock.total === 'number' && Number.isFinite(data.clock.total) && data.clock.total >= 0 ? data.clock.total : 0;
  if (isPlainObject(data.maps)) {
    for (const m of Object.values(data.maps)) {
      if (!isPlainObject(m)) continue;
      const at = isPlainObject(m.reachAt) ? { ...m.reachAt } : {};
      if (isPlainObject(m.reach)) for (const id of Object.keys(m.reach)) if (typeof at[id] !== 'number') at[id] = now;
      m.reachAt = at;
    }
  }
  if (isPlainObject(data.collections)) {
    const c = data.collections;
    if (!isPlainObject(c.patientBest)) c.patientBest = {};
    if (!Number.isInteger(c.cleanedDay)) c.cleanedDay = -1;
  }
  if (!isPlainObject(data.encounter)) data.encounter = { steps: 0, errants: {} };
  data.v = 5;
  return data;
}

/** EXP floors of the v5 curve (8·L² everywhere) and the v6 curve (8·L² through Lv8, then (3·L³ − 512)/2; audit MID-06). */
const V5_EXP = (L) => (L <= 1 ? 0 : 8 * L * L);
const V6_EXP = (L) => (L <= 1 ? 0 : L <= 8 ? 8 * L * L : Math.floor((3 * L ** 3 - 512) / 2));
/** Badge gifts (pocket, item) that v5 never handed over (audit MID-08): the third, fifth and sixth Spires. */
const V6_BADGE_GIFTS = Object.freeze({ weather: ['tools', 'scouting-prism'], relay: ['tools', 'weatherglass'], mirror: ['discs', 'disc-plumbline'] });

/**
 * 5 -> 6: the EXP curve steepened from Lv9 (MID-06). Every creature keeps its level and its progress
 * through it: EXP is rebased from the old curve's band onto the new one, so nobody stalls under a floor
 * that moved. Saves that already hold a Spire badge receive the gift v5 never gave (MID-08).
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate5to6(data) {
  for (const list of ['party', 'box']) {
    for (const c of Array.isArray(data[list]) ? data[list] : []) {
      if (!isPlainObject(c) || !Number.isInteger(c.level) || c.level < 2 || typeof c.exp !== 'number' || !Number.isFinite(c.exp)) continue;
      const L = Math.min(100, c.level);
      const lo = V6_EXP(L);
      const hi = L >= 100 ? lo + 1 : V6_EXP(L + 1);
      if (c.exp >= lo && c.exp < hi) continue;
      const olo = V5_EXP(L);
      const ohi = V5_EXP(L + 1);
      const frac = L < 100 && c.exp >= olo && c.exp < ohi ? (c.exp - olo) / (ohi - olo) : 0;
      c.exp = lo + Math.floor(frac * (hi - lo));
    }
  }
  const pockets = isPlainObject(data.bag) && isPlainObject(data.bag.pockets) ? data.bag.pockets : null;
  if (pockets) {
    const baskets = Array.isArray(data.bag.baskets) ? data.bag.baskets : [];
    const held = (id) => Object.values(pockets).some((l) => Array.isArray(l) && l.some((st) => st && st.id === id))
      || baskets.some((b) => b && Array.isArray(b.items) && b.items.some((st) => st && st.id === id));
    for (const badge of Array.isArray(data.badges) ? data.badges : []) {
      const gift = V6_BADGE_GIFTS[badge];
      if (!gift || held(gift[1])) continue;
      if (!Array.isArray(pockets[gift[0]])) pockets[gift[0]] = [];
      pockets[gift[0]].push({ id: gift[1], n: 1 });
    }
  }
  data.v = 6;
  return data;
}

/** Smallest epoch-day count a pre-LG-RN70 Real Clock save carried (systems/clockSys LEGACY_REAL_TOTAL_MIN ÷ 1440). */
export const LEGACY_REAL_DAY_MIN = 10_960;
const MINUTES_PER_DAY = 1440;
/** Records whose values are day stamps (`npcs[*].saidLines`, `maps[*].picked` / `trees`). */
const DAY_RECORDS = new Set(['saidLines', 'picked', 'trees']);
/** Records whose values are total-minute stamps (`maps[*].reachAt`). */
const MINUTE_RECORDS = new Set(['reachAt']);
/** World keys that hold no day stamps (the clock is rebased on its own). */
const NO_STAMPS = new Set(['v', 'clock', 'rng', 'settings', 'stats', 'log', 'run', 'flags', 'counters']);
const isDayKey = (k) => k === 'day' || /Day$/.test(k);
/** Flags whose value is a day stamp (loans relightFlag = a clock day; letters LATE_DELIVERY_FLAG = a GDD day). */
const DAY_FLAGS = new Set(['sys.relighting-due', 'sp.late-delivery']);

/**
 * Calls `visit(holder, key, kind)` for every day stamp (`day`, `*Day`, a saidLines / picked / trees
 * value) and total-minute stamp (a reachAt value) under `node`.
 * @param {any} node
 * @param {(holder: any, key: string|number, kind: 'day'|'minute') => void} visit
 * @param {string} [parentKey]
 */
function walkStamps(node, visit, parentKey = '') {
  if (Array.isArray(node)) {
    for (const v of node) if (v && typeof v === 'object') walkStamps(v, visit, parentKey);
    return;
  }
  if (!isPlainObject(node)) return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === 'number') {
      if (DAY_RECORDS.has(parentKey) || isDayKey(k)) visit(node, k, 'day');
      else if (MINUTE_RECORDS.has(parentKey)) visit(node, k, 'minute');
    } else if (v && typeof v === 'object') walkStamps(v, visit, k);
  }
}

/**
 * Whether a clock state is a Real Clock save written before LG-RN70 (its total holds the epoch day).
 * @param {any} clock
 * @returns {boolean}
 */
export function isLegacyRealClock(clock) {
  return isPlainObject(clock) && clock.realClock === true && typeof clock.total === 'number' && Number.isFinite(clock.total)
    && clock.total >= LEGACY_REAL_DAY_MIN * MINUTES_PER_DAY;
}

/**
 * 6 -> 7 (Real Clock across sessions, LG-RN70 follow-up): `clock.realOffset` holds the run-relative
 * calendar offset so the days that pass between sessions count (null until core/time writes it). A
 * legacy Real Clock save, whose `clock.total` held the epoch day, is rebased onto the run's own day
 * count: D whole days (the earliest day stamp in the save, so it lands on day 0) come off
 * `clock.total` and off every day stamp written on that count (letters, loans builds / tally / log,
 * threads, npc memory and saidLines, shops, the wallet's Starsalt day, gather picks and regrowth,
 * weather, the Day Page, the Kiln's cleanedDay, creatures' caughtDay, Errants, baskets, the Porch Duel,
 * Relighting and Late Delivery flags), and `realOffset` becomes D days so the wall clock keeps the same run day. Stamps below the
 * epoch range (-1 = never, 0 defaults) are left alone.
 * @param {Record<string, any>} data
 * @returns {Record<string, any>}
 */
function migrate6to7(data) {
  const clock = isPlainObject(data.clock) ? data.clock : null;
  if (clock && isLegacyRealClock(clock)) {
    const min = LEGACY_REAL_DAY_MIN;
    const days = [];
    const minutes = [];
    for (const key of Object.keys(data)) {
      if (NO_STAMPS.has(key)) continue;
      walkStamps(data[key], (holder, k, kind) => {
        const v = holder[k];
        if (!Number.isInteger(v)) return;
        if (kind === 'day' && v >= min) days.push([holder, k]);
        else if (kind === 'minute' && v >= min * MINUTES_PER_DAY) minutes.push([holder, k]);
      }, key);
    }
    // flags that hold a day: the Porch Duel slate (sys.duel.*), the Relighting's dusk day and the
    // Late Delivery day (left on the epoch count, the Relighting would never come due)
    const flags = isPlainObject(data.flags) ? data.flags : {};
    for (const k of Object.keys(flags)) {
      if ((k.startsWith('sys.duel.') || DAY_FLAGS.has(k)) && Number.isInteger(flags[k]) && flags[k] >= min) days.push([flags, k]);
    }
    const today = Math.floor(clock.total / MINUTES_PER_DAY);
    const D = Math.min(today, ...days.map(([h, k]) => h[k]));
    for (const [h, k] of days) h[k] -= D;
    for (const [h, k] of minutes) h[k] -= D * MINUTES_PER_DAY;
    clock.total -= D * MINUTES_PER_DAY;
    clock.realOffset = D * MINUTES_PER_DAY;
  } else if (clock && !('realOffset' in clock)) {
    clock.realOffset = null;
  }
  data.v = 7;
  return data;
}

export const MIGRATIONS = Object.freeze({
  0: migrate0to1,
  1: migrate1to2,
  2: migrate2to3,
  3: migrate3to4,
  4: migrate4to5,
  5: migrate5to6,
  6: migrate6to7,
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
  // Older gifts and starters were added without recording their owned form.
  const owned = ['party', 'box'].flatMap(key => Array.isArray(merged[key]) ? merged[key] : []);
  for (const c of owned) {
    if (isPlainObject(merged.fieldLog) && isPlainObject(merged.fieldLog.forms) && isPlainObject(c) && typeof c.speciesId === 'string' && c.speciesId) {
      const entry = merged.fieldLog.forms[c.speciesId] ??= fieldLogEntryDefaults();
      entry.seen = true;
      entry.held = true;
    }
  }
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

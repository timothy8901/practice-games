/**
 * Weather: today's weather, tomorrow's outlook and Augusta's honest forecast. [SYS-TIME]
 * ARCHITECTURE-DRAFT §1 (`rollDay`, `current`), §3.4 (`weather:change`), §4.7, §9 (`weather:<day>`);
 * GDD-00 §9 (Weather, the Commons board), §14 (overlays cap at 35%), §15 (seed streams).
 *
 * The only writer of `world.weather` (tools/lint-owners OWNERS).
 *
 * **Plans.** Every game day has one plan, a pure function of the run seed and the day: the stateless
 * fork `weather:<day>` (`<day>` is the 1-based game day, {@link module:systems/clockSys.gameDay})
 * draws, in a fixed order, the forecast kind, its odds, whether it comes true, the alternative kind,
 * the tide it names, the onset and the intensity. A reload mid-day, or rolling tomorrow's outlook
 * today, reproduces the same plan.
 *
 * **Honest odds.** Augusta posts "7 in 10, showers by the afternoon tide". The forecast kind comes
 * from the climate weights; the posted odds `o` come from `WEATHER_ODDS_WEIGHTS`; the day turns out
 * as forecast with probability exactly `o / 10`, otherwise as a different kind drawn from the climate.
 * Over many days every posted "7 in 10" is right seven times in ten — sometimes wrong, at the rate
 * it says.
 *
 * **During the day** the weather starts as the kind's `lead` (overcast before rain, for instance)
 * and turns into the day's kind at `onset`, shortly before the tide the forecast named.
 * {@link update} (call it from the overworld after `clockSys.tick`, and after a Rest) rolls a new day
 * when the clock has moved past `world.weather.day` and switches `current` at the onset, emitting
 * `weather:change`.
 *
 * **Effects** ({@link effects}, {@link multiplierFor}) are bonuses, never locks (GDD-00 §9): fog pulls
 * silver schools in, rain brings bugs, storms put Errant lightning on the sea and wash up shore finds.
 *
 * Kinds: clear, overcast, rain, fog, storm (GDD-00 §9) and snow, which only falls when seasons are on
 * (`WEATHER_USE_SEASONS`; GDD-00 has one season, so it is off) and only in the seasons its row names.
 *
 * Pure: no DOM, no `Math.random`; rng, data, clock state and bus are passed in.
 * @module systems/weather
 */
import { gameCalendar, formatMinute, MINUTES_PER_DAY } from '../core/time.js';
import { gameDay, minuteOfDay, tidesForDay, dayPartAt, isNightAt } from './clockSys.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').WeatherState} WeatherState */
/** @typedef {import('../state/schema.js').WeatherForecast} WeatherForecast */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {{emit: (evt: string, payload: any) => any}} Bus */
/**
 * Anything that yields the day's stream: the master `Rng` (or any Rng; `fork('weather:<day>')` is
 * derived from its seed), a `state/rngs` registry (`day('weather', day)`), or `(label) => Rng`.
 * @typedef {Rng | {day: (kind: string, day: number) => Rng} | ((label: string) => Rng)} RngSource
 */

// ---------------------------------------------------------------------------------------------
// Kinds (content) and tuning (numbers)
// ---------------------------------------------------------------------------------------------

/**
 * A weather kind's presentation and rules (content; `data.weather` rows override these by id).
 * @typedef {Object} WeatherKind
 * @property {string} id            kebab-case id
 * @property {string} name          display name
 * @property {string} phrase        forecast noun phrase: "showers", "fog", "clear skies"
 * @property {'by'|'through'} prep  "showers *by* the afternoon tide", "clear skies *through* the evening tide"
 * @property {string|null} lead     kind in effect before the onset (null: the kind holds all day)
 * @property {'rain'|'mist'|'snow'|null} particles   core/fx preset the render pass uses
 * @property {string[]} stems       music stems it turns on (`rain`)
 * @property {string[]} branches    tags scripts, NPC lines and conds can branch on
 * @property {string[]|null} seasons  seasons it can occur in when seasons are on (null: any)
 */

/** Built-in kinds (GDD-00 §9 plus seasonal snow). Frozen. @type {readonly WeatherKind[]} */
export const DEFAULT_KINDS = deepFreeze([
  { id: 'clear', name: 'Clear', phrase: 'clear skies', prep: 'through', lead: null, particles: null, stems: [], branches: ['weather:clear'], seasons: null },
  { id: 'overcast', name: 'Overcast', phrase: 'cloud', prep: 'by', lead: 'clear', particles: null, stems: [], branches: ['weather:overcast'], seasons: null },
  { id: 'rain', name: 'Rain', phrase: 'showers', prep: 'by', lead: 'overcast', particles: 'rain', stems: ['rain'], branches: ['weather:rain', 'weather:wet'], seasons: null },
  { id: 'fog', name: 'Fog', phrase: 'fog', prep: 'by', lead: 'clear', particles: 'mist', stems: [], branches: ['weather:fog'], seasons: null },
  { id: 'storm', name: 'Storm', phrase: 'a storm', prep: 'by', lead: 'overcast', particles: 'rain', stems: ['rain'], branches: ['weather:storm', 'weather:wet', 'errant-lightning'], seasons: null },
  { id: 'snow', name: 'Snow', phrase: 'snow', prep: 'by', lead: 'overcast', particles: 'snow', stems: [], branches: ['weather:snow'], seasons: ['winter'] },
]);

/**
 * One effect row: `target` names the system that reads it, `tag` what it boosts (`'*'` = all),
 * `mult` multiplies that system's rate or weight.
 * @typedef {{target: 'encounter'|'fish'|'bug'|'find'|'errant'|'shoal', tag: string, mult: number}} WeatherEffect
 */

/**
 * @typedef {Object} WeatherTuning
 * @property {Record<string, number>} WEATHER_WEIGHTS          climate weight per kind
 * @property {boolean} WEATHER_USE_SEASONS                    seasons shape the climate (GDD-00: one season, off)
 * @property {number} WEATHER_DAYS_PER_SEASON                 season length when seasons are on
 * @property {Record<string, Record<string, number>>} WEATHER_SEASON_WEIGHTS   per-season weights merged over WEATHER_WEIGHTS
 * @property {Array<[number, number]>} WEATHER_ODDS_WEIGHTS   [odds in 10, weight] for the posted odds
 * @property {[number, number]} WEATHER_ONSET_LEAD            the day's kind sets in this many minutes (min, max) before the named tide
 * @property {Record<string, [number, number]>} WEATHER_INTENSITY  intensity range per kind
 * @property {Record<string, WeatherEffect[]>} WEATHER_EFFECTS     effect rows per kind
 * @property {number} WEATHER_OVERLAY_CAP                     max screen overlay alpha (GDD-00 §14: 35%)
 * @property {Record<string, string>} WEATHER_FIXED           game day -> kind for scripted days (day 1: the arrival is clear)
 */

/**
 * Designer-tunable defaults. GDD-00 names the kinds, the effects' direction and the 35% overlay cap;
 * the weights, odds and multipliers are first passes for the town-life chapter to tune. [GDD values]
 * @type {Readonly<WeatherTuning>}
 */
export const DEFAULTS = deepFreeze({
  WEATHER_WEIGHTS: { clear: 34, overcast: 26, rain: 20, fog: 12, storm: 8, snow: 0 },
  WEATHER_USE_SEASONS: false,
  WEATHER_DAYS_PER_SEASON: 28,
  WEATHER_SEASON_WEIGHTS: { winter: { snow: 24, rain: 12, fog: 10, storm: 6 }, summer: { clear: 44, storm: 10 } },
  WEATHER_ODDS_WEIGHTS: [[5, 1], [6, 2], [7, 3], [8, 3], [9, 1]],
  WEATHER_ONSET_LEAD: [0, 120],
  WEATHER_INTENSITY: { clear: [0, 0], overcast: [0.2, 0.5], rain: [0.3, 0.9], fog: [0.4, 1], storm: [0.7, 1], snow: [0.3, 0.8] },
  WEATHER_EFFECTS: {
    clear: [],
    overcast: [],
    rain: [{ target: 'bug', tag: '*', mult: 1.5 }, { target: 'encounter', tag: 'brine', mult: 1.25 }],
    fog: [{ target: 'fish', tag: 'silver', mult: 2 }, { target: 'encounter', tag: 'hollow', mult: 1.25 }],
    storm: [{ target: 'errant', tag: 'lightning', mult: 2 }, { target: 'find', tag: 'shore', mult: 2 }, { target: 'fish', tag: 'storm', mult: 1.5 }],
    snow: [{ target: 'encounter', tag: 'rime', mult: 1.5 }],
  },
  WEATHER_OVERLAY_CAP: 0.35,
  WEATHER_FIXED: { 1: 'clear' },
});

/** Every tuning key this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));
/** Effect targets {@link multiplierFor} understands. */
export const EFFECT_TARGETS = Object.freeze(['encounter', 'fish', 'bug', 'find', 'errant', 'shoal']);
/** Prefix of the stateless per-day stream (`weather:<day>`, §9). */
export const STREAM_PREFIX = 'weather:';

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const SEASON_IDS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum) && v[0] <= v[1];
const isWeights = (v) => isObj(v) && Object.entries(v).every(([k, w]) => ID_RE.test(k) && isNum(w) && w >= 0);

/** @type {Record<keyof WeatherTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  WEATHER_WEIGHTS: [(v) => isWeights(v) && Object.values(v).some((w) => w > 0), '{kind: weight >= 0}, some weight > 0'],
  WEATHER_USE_SEASONS: [(v) => typeof v === 'boolean', 'boolean'],
  WEATHER_DAYS_PER_SEASON: [(v) => Number.isInteger(v) && v >= 1, 'integer >= 1'],
  WEATHER_SEASON_WEIGHTS: [(v) => isObj(v) && Object.entries(v).every(([s, w]) => SEASON_IDS.includes(s) && isWeights(w)), '{season: {kind: weight >= 0}}'],
  WEATHER_ODDS_WEIGHTS: [(v) => Array.isArray(v) && v.length > 0 && v.every((p) => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && p[0] >= 1 && p[0] <= 10 && isNum(p[1]) && p[1] >= 0) && v.some((p) => p[1] > 0), '[[odds 1..10, weight >= 0], ...] with some weight > 0'],
  WEATHER_ONSET_LEAD: [(v) => isRange(v) && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 0 && v[1] < MINUTES_PER_DAY, '[min, max] integer minutes, 0 <= min <= max < 1440'],
  WEATHER_INTENSITY: [(v) => isObj(v) && Object.values(v).every((r) => isRange(r) && r[0] >= 0 && r[1] <= 1), '{kind: [lo, hi] within 0..1}'],
  WEATHER_EFFECTS: [(v) => isObj(v) && Object.values(v).every((rows) => Array.isArray(rows) && rows.every((e) => isObj(e) && EFFECT_TARGETS.includes(e.target) && typeof e.tag === 'string' && e.tag.length > 0 && isNum(e.mult) && e.mult >= 0)), `{kind: [{target: ${EFFECT_TARGETS.join('|')}, tag, mult >= 0}]}`],
  WEATHER_OVERLAY_CAP: [(v) => isNum(v) && v >= 0 && v <= 1, 'number 0..1'],
  WEATHER_FIXED: [(v) => isObj(v) && Object.entries(v).every(([d, k]) => /^[1-9]\d*$/.test(d) && typeof k === 'string' && ID_RE.test(k)), '{gameDay: kind id}'],
};

/** @type {WeakMap<object, Readonly<WeatherTuning>>} */
const TUNING_CACHE = new WeakMap();
/** @type {WeakSet<object>} */
const RESOLVED = new WeakSet([DEFAULTS]);

/**
 * The tuning table inside `data` (see clockSys.tuningOf for the accepted shapes).
 * @param {any} data
 * @returns {object|null}
 */
function tuningSource(data) {
  if (data == null) return null;
  if (typeof data !== 'object' && typeof data !== 'function') throw new TypeError(`weather: data must be an object, got ${typeof data}`);
  if (isObj(data.tuning)) return data.tuning;
  if (Array.isArray(data.tables) && data.tables.includes('tuning') && typeof data.raw === 'function') {
    const t = data.raw('tuning');
    return isObj(t) ? t : null;
  }
  return data;
}

/**
 * The resolved weather tuning: every {@link TUNING_KEYS} key from the data's tuning table,
 * validated, over {@link DEFAULTS}. Cached per table.
 * @param {any} [data] Registry | DATA | {tuning} | flat tuning table | a tuning this returned | null
 * @returns {Readonly<WeatherTuning>}
 * @throws {TypeError} on a malformed value
 */
export function tuningOf(data) {
  if (data != null && RESOLVED.has(data)) return data;
  const src = tuningSource(data);
  if (src === null) return DEFAULTS;
  const hit = TUNING_CACHE.get(src);
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const v = /** @type {any} */ (src)[key];
    const [pred, desc] = SPEC[/** @type {keyof WeatherTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`weather tuning ${key}: expected ${desc}, got ${JSON.stringify(v)}`);
    out[key] = v;
  }
  const frozen = deepFreeze(structuredClone(out));
  TUNING_CACHE.set(src, frozen);
  RESOLVED.add(frozen);
  return frozen;
}

/** @type {WeakMap<object, ReadonlyMap<string, WeatherKind>>} */
const KIND_CACHE = new WeakMap();
const DEFAULT_KIND_MAP = new Map(DEFAULT_KINDS.map((k) => [k.id, k]));

/**
 * The weather kinds by id: {@link DEFAULT_KINDS} with `data.weather` rows (a Registry table, or a
 * `weather` array on the data object) merged over them field by field.
 * @param {any} [data]
 * @returns {ReadonlyMap<string, WeatherKind>}
 * @throws {TypeError} on a malformed row
 */
export function kinds(data) {
  if (data == null || (typeof data !== 'object' && typeof data !== 'function')) return DEFAULT_KIND_MAP;
  const hit = KIND_CACHE.get(data);
  if (hit) return hit;
  /** @type {any[]|null} */
  let rows = null;
  if (Array.isArray(data.weather)) rows = data.weather;
  else if (Array.isArray(data.tables) && data.tables.includes('weather') && typeof data.list === 'function') rows = data.list('weather');
  if (!rows) {
    KIND_CACHE.set(data, DEFAULT_KIND_MAP);
    return DEFAULT_KIND_MAP;
  }
  const map = new Map(DEFAULT_KIND_MAP);
  for (const row of rows) {
    if (!isObj(row) || typeof row.id !== 'string' || !ID_RE.test(row.id)) throw new TypeError(`weather: kind row needs a kebab-case id, got ${JSON.stringify(row)}`);
    const merged = { ...(map.get(row.id) ?? { name: row.id, phrase: row.id, prep: 'by', lead: null, particles: null, stems: [], branches: [], seasons: null }), ...row };
    if (merged.prep !== 'by' && merged.prep !== 'through') throw new TypeError(`weather:${row.id}: prep must be 'by' or 'through'`);
    if (merged.lead !== null && typeof merged.lead !== 'string') throw new TypeError(`weather:${row.id}: lead must be a kind id or null`);
    if (!Array.isArray(merged.stems) || !Array.isArray(merged.branches)) throw new TypeError(`weather:${row.id}: stems and branches must be arrays`);
    if (merged.seasons !== null && !(Array.isArray(merged.seasons) && merged.seasons.every((s) => SEASON_IDS.includes(s)))) throw new TypeError(`weather:${row.id}: seasons must be null or season ids`);
    map.set(row.id, deepFreeze(merged));
  }
  for (const k of map.values()) {
    if (k.lead !== null && !map.has(k.lead)) throw new TypeError(`weather:${k.id}: unknown lead kind ${JSON.stringify(k.lead)}`);
  }
  KIND_CACHE.set(data, map);
  return map;
}

// ---------------------------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------------------------

/**
 * One game day's weather, as the stream decides it.
 * @typedef {Object} DayPlan
 * @property {number} day                 game day (1-based)
 * @property {string} kind                what the day turns into
 * @property {string} lead                kind before the onset
 * @property {number} onset               minute of day the kind sets in
 * @property {number} intensity           0..1
 * @property {WeatherForecast} forecast   what Augusta posts for that day
 * @property {boolean} cameTrue           `kind === forecast.kind` (tests and the Archive; never shown before the day)
 * @property {boolean} fixed              a scripted (`WEATHER_FIXED`) or pinned day
 */

/**
 * The day's stream from any {@link RngSource}.
 * @param {RngSource} rng
 * @param {number} day
 * @returns {Rng}
 */
function streamFor(rng, day) {
  const label = `${STREAM_PREFIX}${day}`;
  if (typeof rng === 'function') return rng(label);
  if (rng && typeof (/** @type {any} */ (rng)).day === 'function') return /** @type {any} */ (rng).day('weather', day);
  if (rng && typeof (/** @type {any} */ (rng)).fork === 'function') return /** @type {any} */ (rng).fork(label);
  throw new TypeError('weather: rng must be an Rng, a state/rngs registry or a (label) => Rng function');
}

/**
 * The climate weights for a day: `WEATHER_WEIGHTS`, with the season's overrides and the kinds'
 * season limits when seasons are on. Kinds without a row are left out.
 * @param {number} day
 * @param {Readonly<WeatherTuning>} t
 * @param {ReadonlyMap<string, WeatherKind>} kindMap
 * @returns {Array<{w: number, v: string}>}
 */
function climate(day, t, kindMap) {
  /** @type {Record<string, number>} */
  let weights = { ...t.WEATHER_WEIGHTS };
  let season = null;
  if (t.WEATHER_USE_SEASONS) {
    season = gameCalendar(day - 1, t.WEATHER_DAYS_PER_SEASON).season;
    weights = { ...weights, ...(t.WEATHER_SEASON_WEIGHTS[season] ?? {}) };
  }
  /** @type {Array<{w: number, v: string}>} */
  const out = [];
  for (const [id, w] of Object.entries(weights)) {
    const k = kindMap.get(id);
    if (!k || !(w > 0)) continue;
    if (k.seasons !== null && (season === null || !k.seasons.includes(season))) continue;
    out.push({ w, v: id });
  }
  return out;
}

/**
 * Clamps a minute to a whole minute of day.
 * @param {number} m
 * @returns {number}
 */
function wholeMinute(m) {
  return Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(m)));
}

/**
 * The posted forecast for a kind naming one of the day's tides.
 * @param {string} kind
 * @param {number} odds
 * @param {{minute: number, kind: 'low'|'high'}} tide
 * @param {any} data
 * @returns {WeatherForecast}
 */
function makeForecast(kind, odds, tide, data) {
  const minute = wholeMinute(tide.minute);
  return { kind, odds, minute, tide: tide.kind, part: dayPartAt(minute, data).tideWord };
}

/**
 * Plans one game day from its `weather:<day>` stream (pure; writes nothing). Draw order is fixed:
 * forecast kind, odds, comes-true roll, alternative kind, named tide, onset lead, intensity; every
 * draw is made even when its result is not needed, so tuning one value never reshuffles the rest.
 * `opts.pin` forces the day's kind (Wren's small talk; a scripted day) and posts it at 10 in 10.
 * @param {number} day   game day, integer >= 1
 * @param {any} data     tuning / kinds source (null for defaults)
 * @param {RngSource} rng
 * @param {{pin?: string|null}} [opts]
 * @returns {DayPlan}
 */
export function planDay(day, data, rng, opts = {}) {
  if (!Number.isInteger(day) || day < 1) throw new TypeError(`weather.planDay: day must be an integer >= 1, got ${day}`);
  const t = tuningOf(data);
  const kindMap = kinds(data);
  const r = streamFor(rng, day);
  const table = climate(day, t, kindMap);
  if (table.length === 0) throw new RangeError(`weather.planDay: no kind can occur on day ${day} (check WEATHER_WEIGHTS and the kinds' seasons)`);

  const predicted = /** @type {string} */ (r.weighted(table));
  let odds = /** @type {number} */ (r.weighted(t.WEATHER_ODDS_WEIGHTS.map(([o, w]) => ({ w, v: o }))));
  const trueRoll = r.next();
  const others = table.filter((e) => e.v !== predicted);
  const alternative = others.length ? /** @type {string} */ (r.weighted(others)) : (r.next(), predicted);
  if (others.length === 0) odds = 10; // nothing else can happen: the only honest odds are certainty
  const tides = tidesForDay(day, data);
  const named = tides[r.int(0, tides.length - 1)];
  const lead = r.int(t.WEATHER_ONSET_LEAD[0], t.WEATHER_ONSET_LEAD[1]);
  const intensityRoll = r.next();

  const forced = opts.pin ?? t.WEATHER_FIXED[String(day)] ?? null;
  if (forced !== null && !kindMap.has(forced)) throw new RangeError(`weather.planDay: unknown kind ${JSON.stringify(forced)} for day ${day}`);
  const forecastKind = forced ?? predicted;
  const postedOdds = forced !== null ? 10 : odds;
  const kind = forced ?? (trueRoll < odds / 10 ? predicted : alternative);

  const row = kindMap.get(kind);
  const leadKind = row && row.lead !== null ? row.lead : kind;
  const onset = leadKind === kind ? 0 : wholeMinute(named.minute - lead);
  const [lo, hi] = t.WEATHER_INTENSITY[kind] ?? [0, 0];
  const intensity = Math.round((lo + (hi - lo) * intensityRoll) * 100) / 100;
  return {
    day,
    kind,
    lead: leadKind,
    onset,
    intensity,
    forecast: makeForecast(forecastKind, postedOdds, named, data),
    cameTrue: kind === forecastKind,
    fixed: forced !== null,
  };
}

/**
 * The kind in effect at a minute of day under a plan-shaped state.
 * @param {{today: string, lead: string, onset: number}} s
 * @param {number} minute
 * @returns {string}
 */
function kindAt(s, minute) {
  return minute >= s.onset ? s.today : s.lead;
}

/**
 * The pin that applies to a day, if any.
 * @param {WeatherState} w
 * @param {number} day
 * @returns {string|null}
 */
function pinFor(w, day) {
  return w.pinned && w.pinned.day === day ? w.pinned.kind : null;
}

/**
 * Emits `weather:change` when the kind in effect changed.
 * @param {Bus|null|undefined} bus
 * @param {WeatherState} w
 * @param {string} previous
 */
function emitChange(bus, w, previous) {
  if (!bus || w.current === previous) return;
  bus.emit('weather:change', { kind: w.current, previous, today: w.today, tomorrow: w.tomorrow, intensity: w.intensity, day: w.day });
}

/**
 * Rolls today's weather and tomorrow's outlook into `world.weather`: today's plan (kind, lead, onset,
 * intensity, the forecast Augusta posted) and tomorrow's posted forecast (`tomorrow` / `outlook`;
 * tomorrow's true weather stays unrolled until it is today). `current` follows the world clock when
 * `day` is today, else starts at the lead. Emits `weather:change` when `current` changes. Deterministic
 * per seed and day. Call inside `store.tx` (dayFlow on `day:start`, or {@link update}).
 * @param {World} world
 * @param {any} data
 * @param {RngSource} rng
 * @param {{day?: number, bus?: Bus|null}} [opts] `day` defaults to the world clock's game day
 * @returns {{today: DayPlan, tomorrow: DayPlan}} `tomorrow.kind` is the truth: do not show it
 */
export function rollDay(world, data, rng, opts = {}) {
  const day = opts.day ?? gameDay(world);
  const prev = world.weather;
  const pinned = prev?.pinned && prev.pinned.day >= day ? prev.pinned : null;
  const state0 = /** @type {WeatherState} */ ({ ...prev, pinned });
  const today = planDay(day, data, rng, { pin: pinFor(state0, day) });
  const tomorrow = planDay(day + 1, data, rng, { pin: pinFor(state0, day + 1) });
  const previous = typeof prev?.current === 'string' ? prev.current : today.lead;
  /** @type {WeatherState} */
  const next = {
    day,
    today: today.kind,
    lead: today.lead,
    current: today.lead,
    onset: today.onset,
    tomorrow: tomorrow.forecast.kind,
    intensity: today.intensity,
    forecast: today.forecast,
    outlook: tomorrow.forecast,
    pinned,
  };
  if (gameDay(world) === day) next.current = kindAt(next, minuteOfDay(world));
  world.weather = next;
  emitChange(opts.bus, next, previous);
  return { today, tomorrow };
}

/**
 * Keeps `world.weather` in step with the clock: rolls the current game day if the state belongs to
 * another day (a new day, a load, a Rest), then switches `current` from the lead to the day's kind at
 * the onset. Cheap when nothing changes (no write). Emits `weather:change`. Call inside `store.tx`
 * after `clockSys.tick` / `clockSys.rest`.
 * @param {World} world
 * @param {any} data
 * @param {RngSource} rng
 * @param {{bus?: Bus|null}} [ctx]
 * @returns {{rolled: boolean, changed: boolean, current: string}}
 */
export function update(world, data, rng, ctx = {}) {
  const day = gameDay(world);
  const w = world.weather;
  if (!w || w.day !== day) {
    const before = typeof w?.current === 'string' ? w.current : null;
    rollDay(world, data, rng, { day, bus: ctx.bus });
    return { rolled: true, changed: world.weather.current !== before, current: world.weather.current };
  }
  const now = kindAt(w, minuteOfDay(world));
  if (now === w.current) return { rolled: false, changed: false, current: now };
  const previous = w.current;
  world.weather = { ...w, current: now };
  emitChange(ctx.bus, world.weather, previous);
  return { rolled: false, changed: true, current: now };
}

/**
 * Pins a later day's weather (Wren's small talk on the lease card sets tomorrow's weather "and she
 * says so"): that day's plan turns out as `kind` and posts it at 10 in 10. If the day is tomorrow
 * the outlook is updated now. Call inside `store.tx`.
 * @param {World} world
 * @param {any} data
 * @param {string} kind
 * @param {{day?: number}} [opts] `day` defaults to tomorrow (game day + 1); must be later than today
 * @returns {{day: number, kind: string}}
 * @throws {RangeError} for an unknown kind or a day that is not in the future
 */
export function pinDay(world, data, kind, opts = {}) {
  const today = gameDay(world);
  const day = opts.day ?? today + 1;
  if (!kinds(data).has(kind)) throw new RangeError(`weather.pinDay: unknown kind ${JSON.stringify(kind)}`);
  if (!Number.isInteger(day) || day <= today) throw new RangeError(`weather.pinDay: day must be after today (${today}), got ${day}`);
  const w = world.weather;
  /** @type {WeatherState} */
  const next = { ...w, pinned: { day, kind } };
  if (w.day === today && day === today + 1 && w.outlook) {
    next.outlook = { ...w.outlook, kind, odds: 10 };
    next.tomorrow = kind;
  }
  world.weather = next;
  return { day, kind };
}

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

/**
 * The weather in effect now, ready for render, audio and the systems that read effects.
 * @typedef {Object} CurrentWeather
 * @property {string} kind           kind id in effect
 * @property {WeatherKind} row       its presentation row
 * @property {number} intensity      0..1 (0 before the onset)
 * @property {number} overlay        screen overlay alpha, `intensity × WEATHER_OVERLAY_CAP` (≤ 35%)
 * @property {boolean} night         night rules apply (18:00–06:00)
 * @property {WeatherEffect[]} effects
 * @property {string[]} branches
 */

/**
 * The weather in effect at the world clock's minute (from `world.weather`; nothing is rolled).
 * @param {World} world
 * @param {any} [data]
 * @returns {CurrentWeather}
 */
export function current(world, data) {
  const t = tuningOf(data);
  const kindMap = kinds(data);
  const w = world.weather;
  const m = minuteOfDay(world);
  const kind = w && typeof w.today === 'string' ? (w.day === gameDay(world) ? kindAt(w, m) : w.current) : 'clear';
  const row = kindMap.get(kind) ?? kindMap.get('clear') ?? DEFAULT_KIND_MAP.get('clear');
  const intensity = kind === w?.today ? Number(w.intensity) || 0 : 0;
  return {
    kind,
    row: /** @type {WeatherKind} */ (row),
    intensity,
    overlay: Math.round(intensity * t.WEATHER_OVERLAY_CAP * 1000) / 1000,
    night: isNightAt(m, data),
    effects: (t.WEATHER_EFFECTS[kind] ?? []).map((e) => ({ ...e })),
    branches: row ? [...row.branches] : [],
  };
}

/**
 * The effect rows in force now.
 * @param {World} world
 * @param {any} [data]
 * @returns {WeatherEffect[]}
 */
export function effects(world, data) {
  return current(world, data).effects;
}

/**
 * The product of every effect multiplier in force for `target` and `tag` (rows tagged `'*'` match
 * every tag; `tag` `'*'` asks for the target's blanket rows only). 1 when nothing applies. This is
 * what encounter, fishing and gathering systems multiply their rates by.
 * @param {World} world
 * @param {any} data
 * @param {string} target one of {@link EFFECT_TARGETS}
 * @param {string} [tag='*']
 * @returns {number}
 */
export function multiplierFor(world, data, target, tag = '*') {
  if (!EFFECT_TARGETS.includes(target)) throw new RangeError(`weather.multiplierFor: unknown target ${JSON.stringify(target)}`);
  let m = 1;
  for (const e of effects(world, data)) {
    if (e.target === target && (e.tag === '*' || e.tag === tag)) m *= e.mult;
  }
  return m;
}

/**
 * Whether a branch tag is active now (for script conds and NPC weather lines).
 * @param {World} world
 * @param {any} data
 * @param {string} tag e.g. `'weather:storm'`, `'errant-lightning'`
 * @returns {boolean}
 */
export function hasBranch(world, data, tag) {
  return current(world, data).branches.includes(tag);
}

/**
 * Augusta's line for a forecast: `"7 in 10, showers by the afternoon tide"`. English default; the UI
 * may build its own string from the same fields via `data/strings`.
 * @param {WeatherForecast|null} forecast
 * @param {any} [data]
 * @returns {string} empty for `null`
 */
export function forecastText(forecast, data) {
  if (!forecast) return '';
  const row = kinds(data).get(forecast.kind);
  const phrase = row ? row.phrase : forecast.kind;
  const prep = row ? row.prep : 'by';
  return `${forecast.odds} in 10, ${phrase} ${prep} the ${forecast.part} tide`;
}

/**
 * The tide time a forecast names, as `'HH:MM'` (for the Commons slip's small print).
 * @param {WeatherForecast|null} forecast
 * @returns {string}
 */
export function forecastTime(forecast) {
  return forecast ? formatMinute(forecast.minute) : '';
}

// ---------------------------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------------------------

/**
 * Deep-freezes plain objects and arrays in place.
 * @template T
 * @param {T} v
 * @returns {T}
 */
function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze(/** @type {any} */ (v)[k]);
  }
  return v;
}

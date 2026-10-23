/**
 * Music director: the only decider of what plays. [AUDIO] — ARCHITECTURE-DRAFT §1, §2.3, §3.4, §8.4.
 *
 * `createMusicDirector(G)` listens to the domain-event bus and the scene stack, keeps a small
 * *musical state* (hour, weekday, tide, weather, season, place, the scene stack, the battle, a
 * playing sting, a script override) and, after every change, asks the pure {@link decide} what should
 * be playing. It then reconciles the engine (`G.audio`, the `core/audio` API) with that decision:
 *
 *  - **World.** The hourly day-part theme from `tracks.CUES` (`themeForHour`; the Lantern Market waltz
 *    on its night in its place), with the `night`, `perc`, `tide` and `rain` stems set by clock, tide
 *    and weather (a weather kind's own `stems` list from `systems/weather` data counts too) and the
 *    season as the music intensity. A map's `music` field overrides the hourly
 *    track. A theme change *on the hour* waits for the next bar line of the playing track (capped by
 *    `HOUR_QUANTIZE_MAX_MS`) and crossfades over two bars of the incoming theme (`CUES.world.fade`).
 *  - **Battle.** `battle:start` picks the battle track by kind (wild / trainer / spire / summit); the
 *    `tense` stem turns on at or below `TENSE_HP_RATIO` of the player's lead HP (`battle:hp`, a
 *    `battle:event` with HP, or {@link MusicDirector.battleEvent}).
 *  - **Stings.** victory (`battle:end` won or caught), shift_reveal / its Anchor variant
 *    (`shift:resolved`), the letter (`letter:delivered`; the player's Signal when the world has one).
 *    A sting is a one-shot; when it has played (+ `STING_TAIL_MS`) the music returns to whatever the
 *    state now says, normally the world theme. Stings are dropped while audio is locked (a sting
 *    heard a minute late is wrong).
 *  - **Scenes.** The topmost scene in the stack that has an entry in the scene table decides
 *    (title, forecast, credits, the Relighting for the ending, silence for boot; overworld and
 *    fishing defer to the world; battle defers to the battle; menus and dialogue are transparent).
 *  - **Settings.** `world.settings.volumes` / `muted` (and `?mute=1`) are pushed to the engine at
 *    boot, on `settings:changed` and on `world:replaced`.
 *  - **Locked audio.** Nothing here throws when the context is locked: the engine queues the last
 *    `playMusic` itself, stems and volumes are stored by the engine, and the director polls
 *    `audio.ready` until unlock, then re-applies the decision.
 *
 * It also creates the sound-effect router (`audio/sfxMap.js`) on the same bus unless `{sfx: false}`.
 *
 * Every tunable number is in {@link DEFAULTS} and may be overridden with `createMusicDirector(G, {tuning})`.
 * Ids that arrive from scripts, maps or payloads are looked up as own keys only ({@link trackOf}), so a
 * prototype key (`'constructor'`) is never a track, cue, stem or scene.
 *
 * The pure parts ({@link decide}, {@link pickWorldTrack}, {@link worldStems}, {@link stemsFor},
 * {@link battleKindOf}, {@link planHourCrossfade}, {@link trackLengthMs}) are exported for tests.
 *
 * Importable under Node: WebAudio is touched only through the injected engine, timers are injectable.
 * @module audio/director
 */
import { TRACKS, CUES, themeForHour, twoBarsMs, toEngine, stemLayers, applyStems, signalSting } from './tracks/index.js';
import { createSfxRouter } from './sfxMap.js';
import * as selectors from '../state/selectors.js';
import * as clockSys from '../systems/clockSys.js';
import * as weatherSys from '../systems/weather.js';

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/**
 * Every designer-tunable value of the director. The defaults reproduce `tracks.CUES` exactly
 * (`test/audio.director.test.mjs` sweeps every hour, tide, weather and weekday to prove it).
 * Hours are 0..23; weekdays are 0 = Monday (core/time, clockSys).
 */
export const DEFAULTS = Object.freeze({
  /** brushes drop out from this hour (inclusive) … */
  PERC_OFF_FROM_HOUR: 1,
  /** … until this hour (exclusive) */
  PERC_OFF_TO_HOUR: 5,
  /** night stem (glass bells / music box) from this hour (inclusive) … */
  NIGHT_STEM_FROM_HOUR: 20,
  /** … until this hour (exclusive), wrapping midnight */
  NIGHT_STEM_TO_HOUR: 5,
  /** tide stem on while the tide height (0 low .. 1 high) is above this */
  TIDE_STEM_ABOVE: 0.7,
  /** weather kinds that turn the rain stem on */
  RAIN_STEM_WEATHERS: Object.freeze(['rain', 'storm']),
  /** battle `tense` stem on at or below this fraction of the lead's max HP */
  TENSE_HP_RATIO: 0.25,
  /** the market-night track plays on this weekday (0 = Monday; 5 = Saturday) … */
  MARKET_WEEKDAY: 5,
  /** … from this hour to midnight … */
  MARKET_FROM_HOUR: 18,
  /** … in a map whose region / place is this */
  MARKET_PLACE: 'market',
  /** the track played then */
  MARKET_TRACK: 'lantern_market',
  /** season -> music intensity (engine clamps to 0..1; > 1 means "fully open") */
  SEASON_INTENSITY: Object.freeze({ winter: 0.9, spring: 1.0, summer: 1.1, autumn: 1.0 }),
  /** hour-change crossfade length in bars of the incoming theme */
  HOUR_FADE_BARS: 2,
  /** 1 = wait for the playing track's next bar line before an hourly crossfade; 0 = switch at once */
  HOUR_QUANTIZE: 1,
  /** never wait longer than this for a bar line */
  HOUR_QUANTIZE_MAX_MS: 4000,
  /** fade into a battle track */
  BATTLE_FADE_MS: CUES.battle.fade,
  /** fade into a sting */
  STING_FADE_MS: 120,
  /** ring-out allowed after a sting's last bar before the music moves on */
  STING_TAIL_MS: 400,
  /** fade back to the world (after a sting, a battle, a scene, a load) */
  WORLD_RETURN_FADE_MS: 1200,
  /** fade when a map override or a place change switches the world track */
  MAP_FADE_MS: 1000,
  /** fade into a scene cue that names none */
  SCENE_FADE_MS: 800,
  /** per-cue fades (title, forecast, relighting, credits) */
  CUE_FADE_MS: Object.freeze({ title: CUES.title.fade, forecast: CUES.forecast.fade, relighting: CUES.relighting.fade, credits: CUES.credits.fade }),
  /** fade to silence */
  STOP_FADE_MS: 600,
  /** battle outcomes that play the victory sting */
  VICTORY_OUTCOMES: Object.freeze(['win', 'capture']),
  /** how often a locked engine is polled for unlock */
  UNLOCK_POLL_MS: 250,
  /** decisions kept in the history ring (debug overlay, tests) */
  HISTORY_LIMIT: 64,
});

/** Every tuning key, for the GDD table. @type {readonly string[]} */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));
/** Alias of {@link TUNING_KEYS} (the lane brief's spelling). @type {readonly string[]} */
export const tuningKeys = TUNING_KEYS;

/**
 * The track definition for an id, or null. Own keys only, so a prototype key (`'constructor'`,
 * `'__proto__'`, `'toString'`) arriving from a script, a map or a payload is never a track.
 * @param {unknown} id
 * @returns {import('./tracks/index.js').TrackDef|null}
 */
export function trackOf(id) {
  return typeof id === 'string' && Object.hasOwn(TRACKS, id) ? TRACKS[id] : null;
}
/** @param {unknown} id @returns {any} the CUES entry for an own string key, else null */
function cueOf(id) {
  return typeof id === 'string' && Object.hasOwn(CUES, id) ? CUES[id] : null;
}
/** @param {unknown} v @returns {boolean} */
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
/** A fade value: finite and >= 0, else `fallback`. @param {unknown} v @param {number} fallback */
function fadeOf(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : Math.max(0, fallback);
}

/**
 * Scene name -> what it does to the music. `'world'` / `'battle'` defer to those layers (battle falls
 * through to the scenes below once the battle has ended), `'silence'` stops the music, `{cue}` plays a
 * `CUES` entry (its track, stems, one-shot flag and `then`). Scenes not listed are transparent.
 * @type {Readonly<Record<string, 'world'|'battle'|'silence'|{cue: string}>>}
 */
export const SCENE_MUSIC = Object.freeze({
  boot: 'silence',
  title: Object.freeze({ cue: 'title' }),
  leaseCard: Object.freeze({ cue: 'title' }),
  overworld: 'world',
  fishing: 'world',
  battle: 'battle',
  forecast: Object.freeze({ cue: 'forecast' }),
  ending: Object.freeze({ cue: 'relighting' }),
  credits: Object.freeze({ cue: 'credits' }),
});

/** Bus events the director listens to (§3.4 plus the battle-HP feed). */
export const DIRECTOR_EVENTS = Object.freeze([
  'clock:hour', 'clock:phase', 'clock:minute', 'day:start', 'tide:change', 'weather:change',
  'map:enter', 'battle:start', 'battle:end', 'battle:hp', 'battle:event', 'scene:change',
  'shift:window', 'shift:resolved', 'letter:delivered', 'settings:changed', 'world:replaced', 'music:cue',
]);

/**
 * Merged tuning: {@link DEFAULTS} under the overrides. An override must have the default's shape to
 * apply: numbers must be finite, strings strings, lists arrays, and table-valued keys
 * (`SEASON_INTENSITY`, `CUE_FADE_MS`) plain objects, which are merged OVER the default table so a
 * partial override (`{SEASON_INTENSITY: {winter: 0.8}}`) keeps the other rows. Unknown keys are kept.
 * @param {Record<string, any>} [tuning]
 * @returns {Readonly<typeof DEFAULTS>}
 */
export function tuningOf(tuning) {
  /** @type {Record<string, any>} */
  const out = { ...DEFAULTS };
  if (tuning && typeof tuning === 'object') {
    for (const [k, v] of Object.entries(tuning)) {
      if (v === undefined || k === '__proto__') continue;
      if (!Object.hasOwn(DEFAULTS, k)) { out[k] = v; continue; }
      const d = /** @type {any} */ (DEFAULTS)[k];
      if (typeof d === 'number') { if (typeof v === 'number' && Number.isFinite(v)) out[k] = v; }
      else if (typeof d === 'string') { if (typeof v === 'string') out[k] = v; }
      else if (Array.isArray(d)) { if (Array.isArray(v)) out[k] = Object.freeze(v.slice()); }
      else if (isPlainObject(d)) {
        if (!isPlainObject(v)) continue;
        const merged = { ...d };
        for (const [rk, rv] of Object.entries(v)) if (rk !== '__proto__' && typeof rv === 'number' && Number.isFinite(rv)) merged[rk] = rv;
        out[k] = Object.freeze(merged);
      }
    }
  }
  return /** @type {any} */ (Object.freeze(out));
}

// ---------------------------------------------------------------------------------------------
// Pure decision logic
// ---------------------------------------------------------------------------------------------

/**
 * The director's view of the game, everything {@link decide} needs.
 * @typedef {Object} MusicState
 * @property {number} hour                 0..23
 * @property {number} weekday              0 = Monday
 * @property {string|null} weather         current weather kind id
 * @property {string[]|null} weatherStems  stems the weather kind turns on (`systems/weather` kind `stems`), null = unknown
 * @property {number|null} tide            0..1, null when unknown
 * @property {string|null} tideState       'low' | 'mid' | 'high' … (fallback when the height is unknown)
 * @property {string|null} season
 * @property {string|null} place           the map's region (music place)
 * @property {string|null} mapMusic        the map's `music` override track id
 * @property {string[]} scenes             scene names, bottom first
 * @property {boolean} scenesKnown         true once a scene feed exists (empty stack = silence)
 * @property {{kind: string, hpRatio: number}|null} battle
 * @property {{track: string}|null} sting
 * @property {{track: string|null, fade?: number}|null} override   a script's `music` op
 * @property {Record<string, boolean>} stemOverrides                a script's `stem` ops
 * @property {string|null} oneShotDone     a scene one-shot that has finished (its `then` plays)
 */

/**
 * What should be playing.
 * @typedef {Object} Decision
 * @property {'sting'|'override'|'scene'|'battle'|'map'|'world'|'silence'} source
 * @property {string|null} track       null = silence
 * @property {boolean} oneShot
 * @property {number} fade             ms to fade in (the shell may replace it for hour changes)
 * @property {Record<string, boolean>} stems   every layer of the track -> on/off
 * @property {number} intensity
 * @property {string|null} scene       the scene whose entry decided, if any
 */

/**
 * A fresh, neutral state (noon, Monday, clear, tide unknown, no scenes known).
 * @param {Partial<MusicState>} [over]
 * @returns {MusicState}
 */
export function initialState(over = {}) {
  return {
    hour: 12, weekday: 0, weather: null, weatherStems: null, tide: null, tideState: null, season: null, place: null, mapMusic: null,
    scenes: [], scenesKnown: false, battle: null, sting: null, override: null, stemOverrides: {}, oneShotDone: null,
    ...over,
  };
}

/** @param {unknown} h @returns {number} */
function hourOf(h) {
  const n = Math.floor(Number(h));
  return Number.isFinite(n) ? ((n % 24) + 24) % 24 : 12;
}

/**
 * True when `hour` lies in [from, to), wrapping midnight when from > to.
 * @param {number} hour @param {number} from @param {number} to
 * @returns {boolean}
 */
export function inHours(hour, from, to) {
  const h = hourOf(hour);
  if (from === to) return false;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

/**
 * The CUES-convention state object (`weekday` 0 = Sunday) for a director state — what
 * `tracks.CUES.world.pick` / `.stems` and `worldCue` take.
 * @param {MusicState} s
 * @returns {{hour: number, weekday: number, weather: string|null, tide: number, season: string|null, place: string|null, hpRatio: number, kind: string}}
 */
export function cueStateOf(s) {
  return {
    hour: hourOf(s.hour), weekday: ((Math.floor(Number(s.weekday) || 0) + 1) % 7 + 7) % 7,
    weather: s.weather ?? null, tide: tideHeightOf(s), season: s.season ?? null, place: s.place ?? null,
    hpRatio: s.battle ? s.battle.hpRatio : 1, kind: s.battle ? s.battle.kind : 'wild',
  };
}

/** Tide height for stem rules: the number when known, else 1 for a 'high' state, else 0. @param {MusicState} s */
function tideHeightOf(s) {
  if (typeof s.tide === 'number' && Number.isFinite(s.tide)) return s.tide;
  return s.tideState === 'high' ? 1 : 0;
}

/**
 * The world (hourly) track id for a state: the market track on its night in its place, else the
 * hour's day-part theme.
 * @param {MusicState} s
 * @param {Readonly<typeof DEFAULTS>} [t]
 * @returns {string}
 */
export function pickWorldTrack(s, t = DEFAULTS) {
  const h = hourOf(s.hour);
  if (s.weekday === t.MARKET_WEEKDAY && h >= t.MARKET_FROM_HOUR && s.place === t.MARKET_PLACE && trackOf(t.MARKET_TRACK)) return t.MARKET_TRACK;
  return themeForHour(h);
}

/**
 * The world stem rules (core, melody, bass, perc, night, tide, rain) evaluated for a state, limited
 * to the layers `trackId` has. Rain is on for a weather in `RAIN_STEM_WEATHERS` or whose weather
 * kind lists the stem (`state.weatherStems`, from `systems/weather` kind data); any other stem a
 * weather kind lists (e.g. a future `fog` layer) turns on too when the track has it.
 * @param {MusicState} s
 * @param {string} trackId
 * @param {Readonly<typeof DEFAULTS>} [t]
 * @returns {Record<string, boolean>}
 */
export function worldStems(s, trackId, t = DEFAULTS) {
  const track = trackOf(trackId);
  if (!track) return {};
  const h = hourOf(s.hour);
  const wx = Array.isArray(s.weatherStems) ? s.weatherStems : [];
  const rules = {
    core: true,
    melody: true,
    bass: true,
    perc: !inHours(h, t.PERC_OFF_FROM_HOUR, t.PERC_OFF_TO_HOUR),
    night: inHours(h, t.NIGHT_STEM_FROM_HOUR, t.NIGHT_STEM_TO_HOUR),
    tide: tideHeightOf(s) > t.TIDE_STEM_ABOVE,
    rain: (Array.isArray(t.RAIN_STEM_WEATHERS) && t.RAIN_STEM_WEATHERS.includes(s.weather)) || wx.includes('rain'),
  };
  /** @type {Record<string, boolean>} */
  const out = {};
  for (const [name, on] of Object.entries(rules)) if (Object.hasOwn(track.layers, name)) out[name] = on;
  for (const name of wx) if (typeof name === 'string' && !Object.hasOwn(rules, name) && Object.hasOwn(track.layers, name)) out[name] = true;
  return out;
}

/** `battle:start` kinds / sources that are trainer battles (rival, story, rematch, porch duel). */
const TRAINER_KINDS = Object.freeze(['trainer', 'story', 'rematch', 'duel', 'rival']);

/**
 * Normalizes a `battle:start` payload (a `BattleSetup`, §5.5) to a battle-music kind. Summit beats
 * Spire beats trainer; `{kind: 'story'}` / `{story: true}` (the autosave convention in
 * `state/persist.js`), a trainer id, or a rematch / duel / rival source are trainer battles.
 * @param {any} payload  {kind:'wild'|'trainer'|'spire'|'summit'|'story', source?, summit?, spire?, story?, trainerId?}
 * @returns {'wild'|'trainer'|'spire'|'summit'}
 */
export function battleKindOf(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  if (p.summit === true || p.kind === 'summit' || p.source === 'summit') return 'summit';
  if (p.spire === true || p.kind === 'spire' || p.source === 'spire') return 'spire';
  if (TRAINER_KINDS.includes(p.kind) || TRAINER_KINDS.includes(p.source) || p.story === true || (typeof p.trainerId === 'string' && p.trainerId)) return 'trainer';
  return 'wild';
}

/**
 * HP ratio from `{hpRatio}` / `{ratio}` / `{hp, maxHp}`; null when the payload has none.
 * @param {any} p
 * @returns {number|null}
 */
export function hpRatioOf(p) {
  if (typeof p === 'number') return Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : null;
  if (!p || typeof p !== 'object') return null;
  for (const k of ['hpRatio', 'ratio']) if (typeof p[k] === 'number' && Number.isFinite(p[k])) return Math.max(0, Math.min(1, p[k]));
  if (typeof p.hp === 'number' && Number.isFinite(p.hp) && typeof p.maxHp === 'number' && Number.isFinite(p.maxHp) && p.maxHp > 0) {
    return Math.max(0, Math.min(1, p.hp / p.maxHp));
  }
  return null;
}

/**
 * Every layer of a track -> on/off for a decision source: the layer defaults, then the source's rules
 * (world rules for world/map tracks that have them; the cue's `stems` for scene cues; `tense` for
 * battles), then any script stem overrides.
 * @param {string} trackId
 * @param {MusicState} s
 * @param {'sting'|'override'|'scene'|'battle'|'map'|'world'} source
 * @param {Readonly<typeof DEFAULTS>} [t]
 * @param {{cue?: string}} [extra]
 * @returns {Record<string, boolean>}
 */
export function stemsFor(trackId, s, source, t = DEFAULTS, extra = {}) {
  const track = trackOf(trackId);
  if (!track) return {};
  /** @type {Record<string, boolean>} */
  const out = {};
  for (const [name, L] of Object.entries(track.layers)) out[name] = L.default !== false;
  const has = (k) => Object.hasOwn(out, k);
  const applyCue = (cueId) => {
    const cueStems = cueOf(cueId)?.stems;
    if (isPlainObject(cueStems)) for (const [k, v] of Object.entries(cueStems)) if (has(k) && typeof v === 'boolean') out[k] = v;
  };
  if (source === 'world' || source === 'map') {
    Object.assign(out, worldStems(s, trackId, t));
    applyCue(trackId);
  } else if (source === 'battle') {
    if (has('tense')) out.tense = (s.battle ? s.battle.hpRatio : 1) <= t.TENSE_HP_RATIO;
  } else if (source === 'scene' && extra.cue) {
    applyCue(extra.cue);
  }
  if (isPlainObject(s.stemOverrides)) for (const [k, v] of Object.entries(s.stemOverrides)) if (has(k)) out[k] = Boolean(v);
  return out;
}

/** @param {MusicState} s @param {Readonly<typeof DEFAULTS>} t @returns {number} */
function seasonIntensity(s, t) {
  const v = t.SEASON_INTENSITY && s.season ? t.SEASON_INTENSITY[s.season] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : 1;
}

/**
 * Decides what should be playing. Priority: sting > script override > the topmost scene with an
 * entry in the scene table (battle and world entries resolve as below) > battle > map override >
 * the hourly world theme. An empty, known scene stack is silence.
 * @param {MusicState} s
 * @param {Readonly<typeof DEFAULTS>} [t]
 * @param {Readonly<Record<string, any>>} [sceneMusic]
 * @returns {Decision}
 */
export function decide(s, t = DEFAULTS, sceneMusic = SCENE_MUSIC) {
  const make = (source, track, fade, extra = {}) => ({
    source, track, fade: fadeOf(fade, t.SCENE_FADE_MS), oneShot: Boolean(trackOf(track) && trackOf(track).loop === false),
    stems: track ? stemsFor(track, s, source, t, extra) : {},
    intensity: source === 'world' || source === 'map' ? seasonIntensity(s, t) : 1,
    scene: extra.scene ?? null,
  });
  if (s.sting && trackOf(s.sting.track)) return make('sting', s.sting.track, t.STING_FADE_MS);
  if (s.override) {
    const tr = s.override.track;
    if (tr === null) return make('silence', null, s.override.fade ?? t.STOP_FADE_MS);
    if (trackOf(tr)) return make('override', tr, s.override.fade ?? t.SCENE_FADE_MS);
  }
  const battle = () => make('battle', CUES.battle.pick({ kind: s.battle.kind }), t.BATTLE_FADE_MS);
  const world = (scene = null) => {
    if (s.mapMusic && trackOf(s.mapMusic)) return make('map', s.mapMusic, t.MAP_FADE_MS, { scene });
    return make('world', pickWorldTrack(s, t), t.WORLD_RETURN_FADE_MS, { scene });
  };
  const scenes = Array.isArray(s.scenes) ? s.scenes : [];
  for (let i = scenes.length - 1; i >= 0; i--) {
    const name = scenes[i];
    const entry = typeof name === 'string' && sceneMusic && Object.hasOwn(sceneMusic, name) ? sceneMusic[name] : undefined;
    if (entry === undefined) continue;
    if (entry === 'world') return s.battle ? battle() : world(name);
    if (entry === 'battle') { if (s.battle) return battle(); continue; }
    if (entry === 'silence') return make('silence', null, t.STOP_FADE_MS, { scene: name });
    if (entry && typeof entry === 'object') {
      const cue = cueOf(entry.cue);
      let track = entry.track ?? cue?.track ?? null;
      if (!trackOf(track)) continue;
      if (trackOf(track).loop === false && s.oneShotDone === track) {
        const then = entry.then ?? cue?.then ?? null;
        if (!trackOf(then)) return make('silence', null, t.STOP_FADE_MS, { scene: name });
        track = then;
      }
      const cueFade = isPlainObject(t.CUE_FADE_MS) && typeof entry.cue === 'string' && Object.hasOwn(t.CUE_FADE_MS, entry.cue) ? t.CUE_FADE_MS[entry.cue] : undefined;
      const fade = [entry.fade, cueFade, cue?.fade, t.SCENE_FADE_MS].find((v) => typeof v === 'number' && Number.isFinite(v));
      return make('scene', track, fade, { scene: name, cue: track === (entry.track ?? cue?.track) ? entry.cue : undefined });
    }
  }
  if (s.battle) return battle();
  if (s.scenesKnown && scenes.length === 0) return make('silence', null, t.STOP_FADE_MS);
  return world();
}

/**
 * Length of one pass of a track in ms (`bars × beatsPerBar` beats at its bpm; 3/4 when 12 steps a bar).
 * @param {{bpm: number, bars: number, stepsPerBar?: number}} track
 * @returns {number}
 */
export function trackLengthMs(track) {
  if (!track || !(track.bpm > 0)) return 0;
  const spb = track.stepsPerBar || 16;
  const beatsPerBar = spb === 12 ? 3 : 4;
  return Math.round((track.bars * beatsPerBar * 60000) / track.bpm);
}

/**
 * Milliseconds until the playing track's next bar line, from `audio.nowPlaying()`.
 * 0 when nothing (or a pending track) is playing, the id does not match, or the step is on a bar line.
 * @param {any} nowPlaying
 * @param {{id: string, bpm: number, stepsPerBar?: number}|null|undefined} track  the track believed playing
 * @returns {number}
 */
export function msToNextBar(nowPlaying, track) {
  if (!nowPlaying || nowPlaying.pending || !track || nowPlaying.id !== track.id) return 0;
  const spb = track.stepsPerBar || 16;
  const beatsPerBar = spb === 12 ? 3 : 4;
  const stepMs = 60000 / (nowPlaying.bpm || track.bpm) / (spb / beatsPerBar);
  const step = Math.floor(Number(nowPlaying.step));
  if (!Number.isFinite(step) || step < 0) return 0;
  const inBar = step % spb;
  return inBar === 0 ? 0 : Math.round((spb - inBar) * stepMs);
}

/**
 * When and how long an on-the-hour crossfade runs: wait for the next bar line of the outgoing track
 * (only with HOUR_QUANTIZE, and only up to HOUR_QUANTIZE_MAX_MS), then fade over HOUR_FADE_BARS bars of
 * the incoming track (2 bars = `CUES.world.fade`).
 * @param {any} nowPlaying          `audio.nowPlaying()`
 * @param {string|null} fromId      track believed playing
 * @param {string} toId             incoming world track
 * @param {Readonly<typeof DEFAULTS>} [t]
 * @returns {{delayMs: number, fadeMs: number}}
 */
export function planHourCrossfade(nowPlaying, fromId, toId, t = DEFAULTS) {
  const to = trackOf(toId);
  const bars = Math.max(0, Number(t.HOUR_FADE_BARS) || 0);
  const fadeMs = to ? Math.round((twoBarsMs(to) * bars) / 2) : 0;
  let delayMs = 0;
  if (t.HOUR_QUANTIZE && trackOf(fromId)) {
    delayMs = msToNextBar(nowPlaying, { ...trackOf(fromId), id: fromId });
    if (delayMs > t.HOUR_QUANTIZE_MAX_MS) delayMs = 0;
  }
  return { delayMs, fadeMs };
}

/**
 * Applies a scene-stack change event to a stack of names (bottom first). Pure.
 * @param {string[]} stack
 * @param {{type?: string, scene?: any, top?: any}|null|undefined} event  core/scene onChange event (scene objects or names)
 * @returns {string[]} the new stack
 */
export function applySceneEvent(stack, event) {
  const nameOf = (x) => (typeof x === 'string' ? x : x && typeof x.name === 'string' ? x.name : null);
  const next = Array.isArray(stack) ? stack.slice() : [];
  if (!event || typeof event !== 'object') return next;
  const entered = nameOf(event.scene) ?? nameOf(event.top) ?? '?';
  if (event.type === 'push') next.push(entered);
  else if (event.type === 'pop') next.pop();
  else if (event.type === 'replace') { if (next.length) next[next.length - 1] = entered; else next.push(entered); }
  else if (event.type === 'clear') next.length = 0;
  // the event's `top` is authoritative: re-sync when the model drifted (an event was missed)
  if ('top' in event) {
    if (event.top === null) return [];
    const top = nameOf(event.top);
    if (top !== null && next[next.length - 1] !== top) { if (next.length) next[next.length - 1] = top; else next.push(top); }
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// The director (impure shell around the pure decision)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} MusicDirector
 * @property {(event: {type: string, scene?: any, top?: any}|null) => void} onSceneChange
 *   scene-stack `onChange` callback (main.js forwards every push/pop/replace/clear)
 * @property {() => DirectorStatus} status  what the director believes and plays
 * @property {() => Array<{n: number, action: string, track: string|null, source: string, fade: number, reason: string, delayMs?: number}>} history
 * @property {(id: string, opts?: {force?: boolean}) => boolean} sting   play a sting now (false when unknown or locked)
 * @property {(track: string|null, opts?: {fade?: number}) => void} play  script `music` op: force a track (null = silence)
 * @property {() => void} release           drop the script override
 * @property {(name: string, on: boolean|null) => void} setStem   script `stem` op (null clears that override)
 * @property {(ratio: number|{hp: number, maxHp: number}) => void} battleHp   lead HP for the tense stem
 * @property {(ev: {type: string, side?: number, hp?: number, maxHp?: number}) => void} battleEvent   feed engine battle events
 * @property {() => void} notifyUnlocked    call after `audio.unlock()` resolves (optional; the director also polls)
 * @property {(reason?: string) => void} refresh   re-read the world and reconcile
 * @property {import('./sfxMap.js').SfxRouter|null} sfx   the sound-effect router on the same bus
 * @property {() => void} destroy           unsubscribe, cancel timers
 */
/**
 * @typedef {Object} DirectorStatus
 * @property {string|null} scene       top of the scene stack
 * @property {string|null} lastEvent   last bus event handled
 * @property {string|null} track       what the director last asked the engine to play
 * @property {string} source
 * @property {Record<string, boolean>} stems
 * @property {boolean} locked
 * @property {{track: string, delayMs: number}|null} pending   an hourly crossfade waiting for its bar line
 * @property {MusicState} state
 */

/**
 * Creates the music director.
 * @param {{bus?: any, audio?: any, world?: any, clock?: any, data?: any, scenes?: any, flags?: any}} G   the game context
 * @param {Object} [opts]
 * @param {Record<string, any>} [opts.tuning]          overrides for {@link DEFAULTS}
 * @param {Record<string, any>} [opts.sceneMusic]      replaces {@link SCENE_MUSIC}
 * @param {Record<string, any>|false} [opts.sfx]       sfx router options (`{tuning, ...}`), false = no router
 * @param {{setTimeout: Function, clearTimeout: Function}} [opts.timers]   injectable timers (tests)
 * @param {(world: any) => number[]|null} [opts.signalOf]   the player's Signal (6 chime indices) or null
 * @returns {MusicDirector}
 */
export function createMusicDirector(G, opts = {}) {
  const ctxG = G && typeof G === 'object' ? G : {};
  const t = tuningOf(opts.tuning);
  const sceneMusic = opts.sceneMusic ?? SCENE_MUSIC;
  const timers = opts.timers ?? { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: (h) => globalThis.clearTimeout(h) };
  const signalOf = typeof opts.signalOf === 'function' ? opts.signalOf : defaultSignalOf;
  const audio = () => (ctxG.audio && typeof ctxG.audio === 'object' ? ctxG.audio : null);

  const state = initialState({ scenesKnown: Boolean(ctxG.scenes) });
  let directScenes = false;
  let lastEvent = null;
  let destroyed = false;
  /** @type {{track: string|null, source: string, stems: Record<string, boolean>, intensity: number}|null} */
  let playing = null;
  /** @type {{track: string, handle: any, delayMs: number, decision: Decision}|null} */
  let pending = null;
  let stingTimer = null;
  let oneShotTimer = null;
  let pollTimer = null;
  let locked = true;
  let lastSettings = null;
  /** the player's Signal letter sting while one plays (defined on demand as 'letter_signal') */
  let signalTrack = null;
  let historyN = 0;
  const hist = [];
  const defined = new Set();

  const log = (entry) => {
    hist.push({ n: ++historyN, ...entry });
    while (hist.length > Math.max(1, t.HISTORY_LIMIT)) hist.shift();
  };
  const call = (fn) => { try { return fn(); } catch { return undefined; } };

  // ----- reading the world ------------------------------------------------------------------
  function world() { return call(() => ctxG.world) ?? null; }
  function readHour() {
    const c = ctxG.clock;
    const h = call(() => c && c.hour);
    if (typeof h === 'number' && Number.isFinite(h)) return h;
    const w = world();
    return w ? hourOf(call(() => selectors.hour(w))) : state.hour;
  }
  function readTide() {
    const c = ctxG.clock;
    const v = call(() => c && c.tide);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const w = world();
    const s = w ? call(() => selectors.tide(w)) : undefined;
    return typeof s === 'number' && Number.isFinite(s) ? s : state.tide;
  }
  function readWeekday() {
    const w = world();
    const d = w ? call(() => clockSys.weekday(w)) : undefined;
    const i = d && typeof d === 'object' ? d.index : d; // clockSys.weekday -> {index, name, isSaturday}
    return Number.isInteger(i) ? i : state.weekday;
  }
  function readSeason() {
    const c = ctxG.clock;
    const s = call(() => c && c.season);
    return typeof s === 'string' ? s : state.season;
  }
  function readWeather() {
    const w = world();
    const k = w && w.weather ? (w.weather.current || w.weather.today) : null;
    return typeof k === 'string' && k ? k : state.weather;
  }
  /** Stems the weather kind lists in `systems/weather` kind data (`G.data` rows over the defaults). */
  function weatherStemsOf(kind) {
    if (typeof kind !== 'string') return null;
    const row = call(() => weatherSys.kinds(ctxG.data).get(kind));
    return row && Array.isArray(row.stems) ? row.stems.filter((x) => typeof x === 'string') : null;
  }
  function setWeather(kind) {
    state.weather = kind;
    state.weatherStems = weatherStemsOf(kind);
  }
  function mapInfo(mapId, payload = {}) {
    let def = null;
    const data = ctxG.data;
    if (typeof mapId === 'string' && data) {
      def = call(() => (typeof data.has === 'function' ? (data.has('maps', mapId) ? data.get('maps', mapId) : null)
        : data.maps && data.maps[mapId] ? data.maps[mapId] : null)) ?? null;
    }
    const place = payload.place ?? payload.region ?? def?.region ?? null;
    const music = payload.music ?? def?.music ?? null;
    return { place: typeof place === 'string' ? place : null, music: typeof music === 'string' ? music : null };
  }
  function syncFromWorld() {
    state.hour = hourOf(readHour());
    state.weekday = readWeekday();
    state.tide = readTide();
    state.season = readSeason();
    setWeather(readWeather());
    const w = world();
    const mapId = w && w.player ? w.player.mapId : null;
    if (typeof mapId === 'string') { const m = mapInfo(mapId); state.place = m.place; state.mapMusic = m.music; }
  }

  // ----- settings -----------------------------------------------------------------------------
  function applySettings() {
    const a = audio();
    const w = world();
    const s = w && w.settings ? w.settings : null;
    if (!a || !s) return;
    const muted = Boolean(s.muted) || Boolean(ctxG.flags && ctxG.flags.mute);
    const vol = s.volumes && typeof s.volumes === 'object' ? s.volumes : null;
    const sig = JSON.stringify([vol, muted]);
    if (sig === lastSettings) return;
    lastSettings = sig;
    if (vol && typeof a.setVolume === 'function') call(() => a.setVolume({ master: vol.master, music: vol.music, sfx: vol.sfx }));
    if (typeof a.mute === 'function') call(() => a.mute(muted));
  }

  // ----- engine plumbing ----------------------------------------------------------------------
  function isReady() { const a = audio(); return Boolean(a && a.ready); }
  function ensureDefined(id) {
    const a = audio();
    if (!a || defined.has(id)) return;
    if (typeof a.hasTrack === 'function' && call(() => a.hasTrack(id)) && id !== 'letter_signal') { defined.add(id); return; }
    const def = trackOf(id) ?? (id === 'letter_signal' ? signalTrack : null);
    if (!def || typeof a.defineTrack !== 'function') return;
    call(() => a.defineTrack(id, toEngine(def)));
    if (id !== 'letter_signal') defined.add(id);
  }
  function pushStems(decision, full) {
    const a = audio();
    const track = trackOf(decision.track) ?? (decision.track === 'letter_signal' ? signalTrack : null);
    if (!a || !track || typeof a.setStem !== 'function') return;
    const prev = full || !playing || playing.track !== decision.track ? null : playing.stems;
    const diff = {};
    for (const [k, v] of Object.entries(decision.stems)) if (!prev || prev[k] !== v) diff[k] = v;
    if (Object.keys(diff).length) call(() => applyStems(a, track, diff));
  }
  function pushIntensity(value) {
    const a = audio();
    if (a && typeof a.setMusicParam === 'function' && (!playing || playing.intensity !== value)) call(() => a.setMusicParam({ intensity: value }));
  }
  function cancelPending() { if (pending) { call(() => timers.clearTimeout(pending.handle)); pending = null; } }
  function clearTimer(h) { if (h !== null) call(() => timers.clearTimeout(h)); return null; }

  function start(decision, fadeIn, reason, restart = false) {
    const a = audio();
    const fade = fadeOf(fadeIn, decision.fade);
    cancelPending();
    oneShotTimer = clearTimer(oneShotTimer);
    if (decision.track === null) {
      if (playing && playing.track !== null && a && typeof a.stopMusic === 'function') call(() => a.stopMusic({ fade }));
      playing = { track: null, source: decision.source, stems: {}, intensity: decision.intensity };
      log({ action: 'stop', track: null, source: decision.source, fade, reason });
      return;
    }
    ensureDefined(decision.track);
    pushStems(decision, true);
    pushIntensity(decision.intensity);
    if (a && typeof a.playMusic === 'function') call(() => a.playMusic(decision.track, { fade, restart }));
    playing = { track: decision.track, source: decision.source, stems: { ...decision.stems }, intensity: decision.intensity };
    log({ action: 'play', track: decision.track, source: decision.source, fade, reason });
    if (decision.oneShot && decision.source === 'scene') {
      const def = trackOf(decision.track);
      const id = decision.track;
      oneShotTimer = timers.setTimeout(() => {
        oneShotTimer = null;
        if (destroyed) return;
        state.oneShotDone = id;
        reconcile('oneshot-end');
      }, trackLengthMs(def) + t.STING_TAIL_MS);
    }
  }

  /**
   * Brings the engine in line with {@link decide}.
   * @param {string} reason
   * @param {{force?: boolean}} [o]
   */
  function reconcile(reason, o = {}) {
    if (destroyed) return;
    const d = decide(state, t, sceneMusic);
    if (d.source === 'sting' && d.track === 'letter' && signalTrack) d.track = 'letter_signal';
    // an hourly crossfade is already waiting for its bar line with this very track: let it land
    if (pending && pending.track === d.track && !o.force) return;
    const same = playing && playing.track === d.track && (d.track !== null || playing.track === null);
    if (same && !o.force) {
      if (pending) cancelPending();
      if (d.track !== null) {
        pushStems(d, false);
        pushIntensity(d.intensity);
        if (playing) { playing.stems = { ...d.stems }; playing.intensity = d.intensity; playing.source = d.source; }
      }
      return;
    }
    if (same && o.force) {
      if (d.track !== null) { pushStems(d, true); pushIntensity(d.intensity); }
      log({ action: 'reapply', track: d.track, source: d.source, fade: 0, reason });
      return;
    }
    // an hourly change between world themes: wait for the bar line, then a two-bar crossfade
    const worldish = (src) => src === 'world' || src === 'map';
    if (reason === 'hour' && playing && worldish(playing.source) && d.source === 'world' && playing.track) {
      cancelPending();
      const np = isReady() ? call(() => audio().nowPlaying()) : null;
      const plan = planHourCrossfade(np, playing.track, d.track, t);
      if (plan.delayMs > 0) {
        const decision = d;
        pending = {
          track: d.track, delayMs: plan.delayMs, decision,
          handle: timers.setTimeout(() => {
            if (destroyed || !pending || pending.decision !== decision) return;
            pending = null;
            const now = decide(state, t, sceneMusic);
            if (now.track !== decision.track) { reconcile('hour-stale'); return; }
            start(now, plan.fadeMs, 'hour');
          }, plan.delayMs),
        };
        log({ action: 'schedule', track: d.track, source: d.source, fade: plan.fadeMs, reason, delayMs: plan.delayMs });
        return;
      }
      start(d, plan.fadeMs, reason);
      return;
    }
    start(d, d.fade, reason, d.source === 'sting');
  }

  // ----- stings -------------------------------------------------------------------------------
  function playSting(id, o = {}) {
    if (!trackOf(id)) return false;
    if (!isReady() && !o.force) { log({ action: 'drop', track: id, source: 'sting', fade: 0, reason: 'locked' }); return false; }
    stingTimer = clearTimer(stingTimer);
    signalTrack = null;
    if (id === 'letter') {
      const sig = call(() => signalOf(world()));
      if (Array.isArray(sig) && sig.length === 6 && sig.every((i) => Number.isInteger(i) && i >= 0 && i <= 5)) {
        signalTrack = call(() => signalSting(sig)) ?? null;
      }
    }
    state.sting = { track: id };
    const def = signalTrack && id === 'letter' ? signalTrack : trackOf(id);
    // a repeated sting (two letters in a row) must restart: make the playing track look different
    const shown = signalTrack && id === 'letter' ? 'letter_signal' : id;
    if (playing && playing.track === shown) playing = { ...playing, track: null, source: 'restart' };
    reconcile('sting');
    stingTimer = timers.setTimeout(() => {
      stingTimer = null;
      if (destroyed) return;
      state.sting = null;
      signalTrack = null;
      reconcile('sting-end');
    }, trackLengthMs(def) + t.STING_TAIL_MS);
    return true;
  }

  // ----- unlock -------------------------------------------------------------------------------
  function checkUnlock() {
    if (!locked) return;
    if (isReady()) {
      locked = false;
      pollTimer = clearTimer(pollTimer);
      applySettings();
      reconcile('unlock', { force: true });
    }
  }
  function poll() {
    pollTimer = null;
    if (destroyed) return;
    checkUnlock();
    if (locked) pollTimer = timers.setTimeout(poll, Math.max(16, t.UNLOCK_POLL_MS));
  }

  // ----- bus ----------------------------------------------------------------------------------
  const handlers = {
    'clock:hour': (p) => {
      state.hour = hourOf(p && typeof p.hour === 'number' ? p.hour : readHour());
      state.weekday = readWeekday();
      state.tide = readTide();
      reconcile('hour');
    },
    'clock:phase': () => { state.hour = hourOf(readHour()); reconcile('phase'); },
    'clock:minute': (p) => {
      const tide = readTide();
      const h = p && typeof p.hour === 'number' ? hourOf(p.hour) : state.hour;
      if (tide === state.tide && h === state.hour) return;
      const before = tideHeightOf(state) > t.TIDE_STEM_ABOVE;
      state.tide = tide;
      if (h !== state.hour) { state.hour = h; reconcile('hour'); return; }
      if ((tideHeightOf(state) > t.TIDE_STEM_ABOVE) !== before) reconcile('tide');
    },
    'day:start': (p) => {
      state.weekday = p && Number.isInteger(p.dayOfWeek) ? p.dayOfWeek : readWeekday();
      state.season = readSeason();
      reconcile('day');
    },
    'tide:change': (p) => {
      if (p && typeof p.tide === 'number' && Number.isFinite(p.tide)) state.tide = p.tide;
      if (p && typeof p.state === 'string') state.tideState = p.state;
      reconcile('tide');
    },
    'weather:change': (p) => {
      const k = typeof p === 'string' ? p : p && (p.current ?? p.kind ?? p.weather ?? p.today);
      if (typeof k === 'string') setWeather(k);
      reconcile('weather');
    },
    'map:enter': (p) => {
      const m = mapInfo(p && p.mapId, p && typeof p === 'object' ? p : {});
      state.place = m.place;
      state.mapMusic = m.music;
      reconcile('map');
    },
    'battle:start': (p) => {
      stingTimer = clearTimer(stingTimer);
      state.sting = null;
      const r = hpRatioOf(p);
      state.battle = { kind: battleKindOf(p), hpRatio: r ?? 1 };
      reconcile('battle');
    },
    'battle:end': (p) => {
      state.battle = null;
      const outcome = p && typeof p === 'object' ? p.outcome : p;
      if (Array.isArray(t.VICTORY_OUTCOMES) && t.VICTORY_OUTCOMES.includes(outcome) && playSting('victory')) return;
      reconcile('battle-end');
    },
    'battle:hp': (p) => api.battleHp(p),
    'battle:event': (p) => api.battleEvent(p && typeof p === 'object' && p.event && typeof p.event === 'object' ? p.event : p),
    'scene:change': (p) => {
      if (directScenes) return;
      state.scenesKnown = true;
      state.scenes = applySceneEvent(state.scenes, p);
      onStackChanged();
    },
    'shift:window': () => { /* sfx only (sfxMap: shiftFlip); the reveal sting plays when the Shift resolves */ },
    'shift:resolved': (p) => { playSting(p && (p.anchored || p.anchor) ? (CUES.shift_reveal.anchor ?? 'shift_reveal') : 'shift_reveal'); },
    'letter:delivered': () => { playSting('letter'); },
    'settings:changed': () => applySettings(),
    'world:replaced': () => {
      stingTimer = clearTimer(stingTimer);
      state.sting = null;
      state.battle = null;
      state.override = null;
      state.stemOverrides = {};
      lastSettings = null;
      syncFromWorld();
      applySettings();
      reconcile('load');
    },
    'music:cue': (p) => {
      if (!p || typeof p !== 'object') return;
      if (typeof p.sting === 'string') { playSting(p.sting); return; }
      if ('stem' in p && typeof p.stem === 'string') { api.setStem(p.stem, p.on === undefined ? null : p.on); return; }
      if (p.release) { api.release(); return; }
      if ('track' in p) api.play(p.track, { fade: p.fade });
    },
  };

  /** Track a scene entry plays (its cue's track), or null. @param {string} name */
  function sceneTrack(name) {
    const e = Object.hasOwn(sceneMusic, name) ? sceneMusic[name] : null;
    if (!e || typeof e !== 'object') return null;
    return e.track ?? cueOf(e.cue)?.track ?? null;
  }
  function onStackChanged() {
    // a finished scene one-shot is forgotten once no scene that plays it is on the stack
    if (state.oneShotDone && !state.scenes.some((n) => sceneTrack(n) === state.oneShotDone)) state.oneShotDone = null;
    reconcile('scene');
  }

  /** @type {Array<() => void>} */
  const offs = [];
  const bus = ctxG.bus;
  if (bus && typeof bus.on === 'function') {
    for (const evt of DIRECTOR_EVENTS) {
      const fn = handlers[evt];
      const off = bus.on(evt, (p) => {
        if (destroyed) return;
        lastEvent = evt;
        try { checkUnlock(); fn(p); } catch { /* the director never throws into the bus */ }
      });
      if (typeof off === 'function') offs.push(off);
    }
  }
  const sfx = opts.sfx === false ? null : call(() => createSfxRouter({ bus, audio: audio(), ...(opts.sfx && typeof opts.sfx === 'object' ? opts.sfx : {}) })) ?? null;

  const api = {
    onSceneChange(event) {
      if (destroyed) return;
      try {
        directScenes = true;
        state.scenesKnown = true;
        checkUnlock();
        state.scenes = applySceneEvent(state.scenes, event);
        onStackChanged();
      } catch { /* never throw into the scene stack */ }
    },
    status() {
      return {
        scene: state.scenes[state.scenes.length - 1] ?? null,
        lastEvent,
        track: playing ? playing.track : null,
        source: playing ? playing.source : 'none',
        stems: playing ? { ...playing.stems } : {},
        locked,
        pending: pending ? { track: pending.track, delayMs: pending.delayMs } : null,
        state: { ...state, scenes: state.scenes.slice(), stemOverrides: { ...state.stemOverrides } },
      };
    },
    history: () => hist.map((h) => ({ ...h })),
    sting(id, o) { try { checkUnlock(); return playSting(id, isPlainObject(o) ? o : {}); } catch { return false; } },
    play(track, o) {
      if (track !== null && !trackOf(track)) return;
      const fade = isPlainObject(o) ? o.fade : undefined;
      state.override = { track, fade: typeof fade === 'number' && Number.isFinite(fade) ? Math.max(0, fade) : undefined };
      call(() => reconcile('override'));
    },
    release() { state.override = null; call(() => reconcile('override')); },
    setStem(name, on) {
      if (typeof name !== 'string' || !name || name === '__proto__') return;
      if (on === null || on === undefined) delete state.stemOverrides[name];
      else state.stemOverrides[name] = Boolean(on);
      call(() => reconcile('stem'));
    },
    battleHp(p) {
      const r = hpRatioOf(p);
      if (r === null || !state.battle) return;
      state.battle.hpRatio = r;
      call(() => reconcile('hp'));
    },
    battleEvent(ev) {
      if (!ev || typeof ev !== 'object' || !state.battle) return;
      if ((ev.type === 'damage' || ev.type === 'heal') && ev.side === 0) api.battleHp(ev);
      else if (ev.type === 'switch' && ev.side === 0) api.battleHp(hpRatioOf(ev) ?? 1);
    },
    notifyUnlocked() { call(checkUnlock); },
    refresh(reason = 'refresh') { call(() => { syncFromWorld(); applySettings(); reconcile(reason); }); },
    sfx,
    destroy() {
      destroyed = true;
      while (offs.length) offs.pop()();
      cancelPending();
      stingTimer = clearTimer(stingTimer);
      oneShotTimer = clearTimer(oneShotTimer);
      pollTimer = clearTimer(pollTimer);
      if (sfx) sfx.destroy();
    },
  };

  // boot
  call(() => {
    syncFromWorld();
    const top = ctxG.scenes && typeof ctxG.scenes.top === 'function' ? call(() => ctxG.scenes.top()) : null;
    if (top && typeof top.name === 'string') state.scenes = [top.name];
    applySettings();
    locked = !isReady();
    reconcile('boot');
    if (locked) pollTimer = timers.setTimeout(poll, Math.max(16, t.UNLOCK_POLL_MS));
  });
  return Object.freeze(api);
}

/**
 * Default Signal reader: `world.player.signal` or `world.run.signal` when it is six chime indices.
 * @param {any} world
 * @returns {number[]|null}
 */
function defaultSignalOf(world) {
  const s = world && ((world.player && world.player.signal) || (world.run && world.run.signal));
  return Array.isArray(s) ? s : null;
}

/** Engine layer names a stem controls on a track id (re-export convenience for scenes and tests). */
export { stemLayers };

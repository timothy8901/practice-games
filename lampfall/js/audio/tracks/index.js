/**
 * The score: every track, the CUES table and the adapters to `js/core/audio.js`. [AUDIO]
 *
 * Split from `proto/music/tracks.js` (ARCHITECTURE-DRAFT §8.4): one file per track under this folder,
 * the shared score-writing helpers in `compose.js`, and this index, which keeps the prototype's
 * exports and bodies verbatim (`TRACKS`, `CUES`, `DAY_PARTS`, `themeForHour`, `twoBarsMs`, `toEngine`,
 * `stemLayers`, `defaultStems`, `applyStems`, `signalSting`, `worldCue`, plus the DSL helpers `midi`,
 * `P`, `at`, `rep`, `cat` and `SIGNAL_CHIMES`). Every note is exactly what the music director verified;
 * `test/audio.tracks.test.mjs` deep-compares each track and each `toEngine()` result with the prototype.
 *
 * Two additions, neither of which changes a note or a rule:
 *  - the exported tables are deep-frozen (data convention §8.1): tracks, layers, patterns, notes and
 *    the CUES entries, so no consumer can retune the shared score by accident;
 *  - `CUES[0]` … `CUES[23]` exist as NON-enumerable keys naming the hour's day-part theme, which is
 *    what `tools/validate-data.mjs` checks ("every hour 0..23 maps to a track in CUES"). They do not
 *    show up in `Object.keys(CUES)`, so the prototype's shape is unchanged.
 *
 * Who decides what plays is `audio/director.js`; this module only describes the music.
 *
 * Pure ES module: no DOM, no WebAudio. Conventions (docs-core-contract.md, audio section):
 *   track = {id, title, bpm, key, scale, bars, stepsPerBar (16 = 4/4 sixteenths, 12 = 3/4, 32 = 4/4 thirty-seconds), loop?, layers}
 *   layer = {inst: preset, gain: 0..1, pattern: [{t, n, d, v}], default: bool, role}
 *   note  = {t: stepIndex, n: midiNote | midiNote[], d: steps, v: velocity 0..1}
 * Stem names used by the game (see CUES): core, melody, bass, perc (on by default); night / tide / rain
 * (toggled by world state); tense (battle low HP).
 * @module audio/tracks
 */
import { midi, P, at, rep, cat } from './compose.js';
import { TRACK as H_NIGHT_DEEP } from './h_night_deep.js';
import { TRACK as H_PREDAWN } from './h_predawn.js';
import { TRACK as H_MORNING } from './h_morning.js';
import { TRACK as H_LATE_MORNING } from './h_late_morning.js';
import { TRACK as H_MIDDAY } from './h_midday.js';
import { TRACK as H_AFTERNOON } from './h_afternoon.js';
import { TRACK as H_DUSK } from './h_dusk.js';
import { TRACK as H_NIGHT } from './h_night.js';
import { TRACK as TITLE } from './title.js';
import { TRACK as FORECAST } from './forecast.js';
import { TRACK as BATTLE_WILD } from './battle_wild.js';
import { TRACK as BATTLE_TRAINER } from './battle_trainer.js';
import { TRACK as BATTLE_SPIRE } from './battle_spire.js';
import { TRACK as SUMMIT } from './summit.js';
import { TRACK as VICTORY } from './victory.js';
import { TRACK as SHIFT_REVEAL } from './shift_reveal.js';
import { TRACK as SHIFT_REVEAL_ANCHOR } from './shift_reveal_anchor.js';
import { TRACK as LETTER, SIGNAL_CHIMES, signalSting } from './letter.js';
import { TRACK as RELIGHTING } from './relighting.js';
import { TRACK as LANTERN_MARKET } from './lantern_market.js';
import { TRACK as CREDITS } from './credits.js';

export { midi, P, at, rep, cat, SIGNAL_CHIMES, signalSting };

/**
 * One note event of a layer pattern.
 * @typedef {{t: number, n: number|number[], d: number, v: number}} NoteEvt
 */
/**
 * One layer of a track as the score writes it.
 * @typedef {Object} TrackLayerDef
 * @property {string} inst        engine instrument preset ('pad', 'flute', 'kit', ...)
 * @property {number} gain        0..1
 * @property {boolean} default    on when the track starts (false = a stem that starts muted)
 * @property {string} role        core | melody | bass | perc | night | tide | rain | tense | pad | counter | bells | brass
 * @property {NoteEvt[]} pattern
 */
/**
 * A track as the score writes it (convert with {@link toEngine} before `audio.defineTrack`).
 * @typedef {Object} TrackDef
 * @property {string} id  @property {string} title
 * @property {number} bpm  @property {string} key  @property {string} scale
 * @property {number} bars  @property {number} stepsPerBar
 * @property {boolean} [loop]      false for one-shot stings
 * @property {string} [motif]  @property {string} [mood]
 * @property {Record<string, TrackLayerDef>} layers
 */

/**
 * Freezes an object graph in place (functions are left callable; already-frozen nodes are skipped).
 * @template T
 * @param {T} o
 * @returns {T}
 */
function deepFreeze(o) {
  if (o === null || (typeof o !== 'object' && typeof o !== 'function') || Object.isFrozen(o)) return o;
  Object.freeze(o);
  for (const k of Reflect.ownKeys(o)) {
    const d = Object.getOwnPropertyDescriptor(o, k);
    if (d && 'value' in d) deepFreeze(d.value);
  }
  return o;
}
for (const tr of [H_NIGHT_DEEP, H_PREDAWN, H_MORNING, H_LATE_MORNING, H_MIDDAY, H_AFTERNOON, H_DUSK, H_NIGHT, TITLE, FORECAST,
  BATTLE_WILD, BATTLE_TRAINER, BATTLE_SPIRE, SUMMIT, VICTORY, SHIFT_REVEAL, SHIFT_REVEAL_ANCHOR, LETTER, RELIGHTING, LANTERN_MARKET, CREDITS]) deepFreeze(tr);

/** The eight day-part themes, 00–03 … 21–24, in hour order. @type {readonly TrackDef[]} */
export const DAY_PARTS = Object.freeze([H_NIGHT_DEEP, H_PREDAWN, H_MORNING, H_LATE_MORNING, H_MIDDAY, H_AFTERNOON, H_DUSK, H_NIGHT]);

// ---------------------------------------------------------------------------
/** Every track by id. @type {Readonly<Record<string, TrackDef>>} */
export const TRACKS = Object.freeze(Object.fromEntries([
  ...DAY_PARTS, TITLE, FORECAST, BATTLE_WILD, BATTLE_TRAINER, BATTLE_SPIRE, SUMMIT,
  VICTORY, SHIFT_REVEAL, SHIFT_REVEAL_ANCHOR, LETTER, RELIGHTING, LANTERN_MARKET, CREDITS,
].map(t => [t.id, t])));

/**
 * Hour (0-23) -> day-part theme id.
 * @param {number} hour any finite number; wrapped into 0..23
 * @returns {string}
 */
export function themeForHour(hour) {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  return DAY_PARTS[Math.floor(h / 3)].id;
}

/**
 * Two-bar bridge length in ms at a track's tempo (the hour-change crossfade).
 * @param {{bpm: number, stepsPerBar?: number}} track
 * @returns {number}
 */
export function twoBarsMs(track) {
  const beatsPerBar = (track.stepsPerBar || 16) / 4;
  return Math.round(2 * beatsPerBar * 60000 / track.bpm);
}

/**
 * CUES: game moment -> track + stem rules. Pure data plus tiny evaluators the game loop can call with
 * state = {hour, minute, weekday (0=Sun), weather: 'clear'|'rain'|'fog'|'storm', tide: 0..1, season,
 *          place: 'town'|'market'|'mud'|'spire'|'summit'..., hpRatio}.
 * (Verbatim from the prototype. Note `weekday` here is 0 = Sunday; core/time and clockSys count
 * 0 = Monday, so `audio/director.js` converts before it builds a cue state.)
 */
export const CUES = {
  // World music: one theme per 3-hour block; crossfade with a two-bar bridge on the hour.
  world: {
    pick: (s) => (s.weekday === 6 && s.hour >= 18 && s.place === 'market') ? 'lantern_market' : themeForHour(s.hour),
    fade: (trackId) => twoBarsMs(TRACKS[trackId]),
    stems: {
      core: () => true,
      melody: () => true,
      bass: () => true,
      perc: (s) => !(s.hour >= 1 && s.hour < 5),                    // the quietest hours drop the brushes
      night: (s) => s.hour >= 20 || s.hour < 5,                      // glass bells / music box 20:00–05:00
      tide: (s) => (s.tide ?? 0) > 0.7,                              // low swell pad at high tide
      rain: (s) => s.weather === 'rain' || s.weather === 'storm',    // softer rhodes-like layer in rain
    },
    // Stems the hour themes expose for season/weather beyond rain (contract: season/weather/tide/night):
    // season is a mix tilt, not a layer: intensity 0.9 winter, 1.0 spring/autumn, 1.1 summer.
    intensity: (s) => ({ winter: 0.9, spring: 1.0, summer: 1.1, autumn: 1.0 })[s.season] ?? 1.0,
  },
  title:      { track: 'title',      stems: { night: true, tide: true, perc: false }, fade: 1500 },
  forecast:   { track: 'forecast',   fade: 600 },
  battle: {
    pick: (s) => s.kind === 'summit' ? 'summit' : s.kind === 'spire' ? 'battle_spire' : s.kind === 'trainer' ? 'battle_trainer' : 'battle_wild',
    fade: 400,
    stems: { tense: (s) => (s.hpRatio ?? 1) <= 0.25 },             // low HP: tremolo + hats
    speed: 'tempo stays at 2x/4x battle speed; only SFX shorten',
  },
  victory:      { track: 'victory',      oneShot: true, thenResume: 'world' },
  shift_reveal: { track: 'shift_reveal', oneShot: true, duckMusic: 0.3, anchor: 'shift_reveal_anchor', phasesMs: [300, 600, 700] },
  letter:       { track: 'letter',       oneShot: true, duckMusic: 0.5 },
  relighting:   { track: 'relighting',   oneShot: true, fade: 2000, then: 'h_night' },
  lantern_market: { track: 'lantern_market', when: 'Saturday 18:00–24:00 in the market', stems: { night: true } },
  credits:      { track: 'credits', fade: 2500 },
};
// Hour keys for tools/validate-data.mjs (non-enumerable: Object.keys(CUES) stays the prototype's).
for (let h = 0; h < 24; h++) Object.defineProperty(CUES, h, { value: themeForHour(h), enumerable: false });
deepFreeze(CUES);

/** Drum note -> engine preset. The data uses one 'kit' layer; the engine wants one layer per drum voice. */
const KIT_VOICES = { 36: 'kick', 38: 'snare', 42: 'hat', 37: 'snare' };

/**
 * Adapts a track definition to the shape js/core/audio.js `defineTrack` accepts:
 *   {bpm, key, scale, bars, beatsPerBar, stepsPerBar, layers: {name: {inst, pattern, gain, stem, pan, humanize}}}
 * - 'kit' layers are split into `<name>.kick` / `<name>.snare` / `<name>.hat` (the engine has no kit preset);
 *   `stemLayers(track, 'perc')` returns the full list of engine layer names a stem controls.
 * - `default:false` layers become `stem:true` (start muted, toggled with setStem).
 * - `rim` (37) hits are sent to the snare preset at low velocity.
 * - `loop: false` (stings) is forwarded; the engine plays those once and reports `oneShot` / `remaining` in nowPlaying().
 * @param {TrackDef} track
 * @param {{humanize?: number}} [opts]
 * @returns {{bpm: number, key: string, scale: string, bars: number, beatsPerBar: number, stepsPerBar: number, swing: number, loop: boolean, layers: Record<string, object>}}
 */
export function toEngine(track, { humanize = 0.35 } = {}) {
  const spb = track.stepsPerBar || 16;
  const beatsPerBar = spb === 12 ? 3 : 4;
  const layers = {};
  for (const [name, L] of Object.entries(track.layers)) {
    const base = { gain: L.gain ?? 1, stem: L.default === false || TOGGLABLE.has(L.role), pan: L.pan ?? PAN[L.role] ?? 0, humanize: L.humanize ?? humanize };
    if (L.inst === 'kit') {
      const groups = {};
      for (const e of L.pattern) {
        const voice = KIT_VOICES[Array.isArray(e.n) ? e.n[0] : e.n] || 'hat';
        const isRim = e.n === 37;
        (groups[voice] ||= []).push({ t: e.t, n: Array.isArray(e.n) ? e.n[0] : e.n, d: e.d, v: isRim ? e.v * 0.6 : e.v });
      }
      for (const [voice, pattern] of Object.entries(groups)) layers[`${name}.${voice}`] = { ...base, inst: voice, pattern, humanize: 0.2 };
    } else {
      layers[name] = { ...base, inst: L.inst, pattern: L.pattern.map(e => ({ t: e.t, n: e.n, d: e.d, v: e.v })) };
    }
  }
  return { bpm: track.bpm, key: track.key, scale: track.scale, bars: track.bars, beatsPerBar, stepsPerBar: spb, swing: track.swing ?? 0, loop: track.loop !== false, layers };
}
/** Roles the game toggles at runtime; they become engine stems even when on by default (engine stems are exact-name, global). */
const TOGGLABLE = new Set(['perc', 'night', 'tide', 'rain', 'tense']);
const PAN = { melody: 0.12, bass: 0, core: 0, perc: -0.1, night: -0.25, tide: 0.2, rain: 0.3, counter: -0.3, bells: 0.25, brass: 0, tense: 0.35, pad: 0 };

/**
 * Engine layer names a stem name controls on a track (handles the kit split).
 * @param {TrackDef} track
 * @param {string} stem
 * @returns {string[]} empty when the track has no such layer
 */
export function stemLayers(track, stem) {
  const L = track.layers[stem];
  if (!L) return [];
  if (L.inst !== 'kit') return [stem];
  const voices = new Set(L.pattern.map(e => KIT_VOICES[Array.isArray(e.n) ? e.n[0] : e.n] || 'hat'));
  return [...voices].map(v => `${stem}.${v}`);
}

/**
 * Engine layer names that should be ON when a track starts (before world-state rules apply).
 * @param {TrackDef} track
 * @returns {string[]}
 */
export function defaultStems(track) {
  const on = [];
  for (const [name, L] of Object.entries(track.layers)) if (L.default !== false) on.push(...stemLayers(track, name));
  return on;
}

/**
 * Applies a {stem: bool} map to the engine for a track, fanning kit stems out to their engine layers.
 * `engine` needs `setStem(name, on)`. Returns the engine layer names touched.
 * @param {{setStem: (name: string, on: boolean) => any}} engine
 * @param {TrackDef} track
 * @param {Record<string, boolean>} state
 * @returns {string[]}
 */
export function applyStems(engine, track, state) {
  const touched = [];
  for (const [stem, on] of Object.entries(state)) {
    for (const name of stemLayers(track, stem)) { engine.setStem(name, Boolean(on)); touched.push(name); }
  }
  return touched;
}

/**
 * Evaluates CUES.world for a world state: {track, fade, stems: {name: bool}, intensity}.
 * @param {{hour: number, weekday?: number, weather?: string, tide?: number, season?: string, place?: string}} state
 * @returns {{track: string, fade: number, stems: Record<string, boolean>, intensity: number}}
 */
export function worldCue(state) {
  const id = CUES.world.pick(state);
  const track = TRACKS[id];
  const stems = {};
  for (const [name, rule] of Object.entries(CUES.world.stems)) if (track.layers[name]) stems[name] = Boolean(rule(state));
  return { track: id, fade: CUES.world.fade(id), stems, intensity: CUES.world.intensity(state) };
}

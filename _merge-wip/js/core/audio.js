/**
 * @module core/audio
 * Procedural WebAudio engine: a synthesized SFX bank, a look-ahead step sequencer with crossfading
 * tracks and toggleable stems, and a master compressor/limiter chain.
 *
 * BROWSER-ONLY at *use* time: nothing here touches `window`, `document` or `AudioContext` while the
 * module is imported, so Node can import it and unit-test the pure parts (music theory, pattern
 * expansion, scheduler timing math, rate limiting, level analysis). Nothing plays until
 * {@link audio.unlock} is called from a user gesture.
 *
 * Pitch convention: `pitch` options are frequency multipliers (1 = as designed); `semitones` is the
 * alternative. Velocities and volumes are 0..1.
 */

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Music theory (pure)
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** Semitone offsets of each natural note name within an octave. @type {Readonly<Record<string, number>>} */
const NOTE_OFFSETS = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

/** Pitch-class names used when converting MIDI numbers back to note names. */
const PITCH_CLASSES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

/**
 * Scale definitions as semitone sets starting at the root.
 * @type {Readonly<Record<string, readonly number[]>>}
 */
export const SCALES = Object.freeze({
  major: Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  minor: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  dorian: Object.freeze([0, 2, 3, 5, 7, 9, 10]),
  mixolydian: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
  lydian: Object.freeze([0, 2, 4, 6, 7, 9, 11]),
  harmonicMinor: Object.freeze([0, 2, 3, 5, 7, 8, 11]),
  pentatonic: Object.freeze([0, 2, 4, 7, 9]),
  minorPentatonic: Object.freeze([0, 3, 5, 7, 10]),
  blues: Object.freeze([0, 3, 5, 6, 7, 10]),
  wholeTone: Object.freeze([0, 2, 4, 6, 8, 10]),
  chromatic: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
});

/**
 * Chord shapes as semitone offsets from the chord root.
 * @type {Readonly<Record<string, readonly number[]>>}
 */
export const CHORDS = Object.freeze({
  maj: Object.freeze([0, 4, 7]),
  min: Object.freeze([0, 3, 7]),
  dim: Object.freeze([0, 3, 6]),
  aug: Object.freeze([0, 4, 8]),
  sus2: Object.freeze([0, 2, 7]),
  sus4: Object.freeze([0, 5, 7]),
  power: Object.freeze([0, 7]),
  six: Object.freeze([0, 4, 7, 9]),
  maj7: Object.freeze([0, 4, 7, 11]),
  min7: Object.freeze([0, 3, 7, 10]),
  dom7: Object.freeze([0, 4, 7, 10]),
  add9: Object.freeze([0, 4, 7, 14]),
  maj9: Object.freeze([0, 4, 7, 11, 14]),
  min9: Object.freeze([0, 3, 7, 10, 14]),
});

/**
 * Clamp a number to a range.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * MIDI note number → frequency in Hz (A4 = 69 = 440 Hz). Fractional notes are allowed.
 * @param {number} midi
 * @returns {number}
 */
export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * Frequency in Hz → (fractional) MIDI note number.
 * @param {number} freq Must be > 0.
 * @returns {number}
 */
export function freqToMidi(freq) {
  if (!(freq > 0)) throw new RangeError(`freqToMidi: frequency must be > 0, got ${freq}`);
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Parse a scientific-pitch note name such as `"D4"`, `"F#3"`, `"Bb2"` or `"C-1"` into a MIDI number
 * (C4 = 60). Returns `null` for anything unparsable.
 * @param {string} name
 * @returns {number|null}
 */
export function noteToMidi(name) {
  if (typeof name !== 'string') return null;
  const m = /^\s*([A-Ga-g])([#♯b♭]?)(-?\d{1,2})\s*$/.exec(name);
  if (!m) return null;
  const base = NOTE_OFFSETS[m[1].toUpperCase()];
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

/**
 * MIDI number → note name with sharps (`60` → `"C4"`).
 * @param {number} midi Integer; fractional input is rounded.
 * @returns {string}
 */
export function midiToNote(midi) {
  const n = Math.round(midi);
  const octave = Math.floor(n / 12) - 1;
  return `${PITCH_CLASSES[((n % 12) + 12) % 12]}${octave}`;
}

/**
 * Resolve a key name (`"D"`, `"F#"`, `"Bb"`, or a full note like `"D3"`) to the MIDI root in the
 * given default octave. Returns `null` for unknown input.
 * @param {string} key
 * @param {number} [octave=3] Octave used when the key has none.
 * @returns {number|null}
 */
export function keyToMidi(key, octave = 3) {
  if (typeof key !== 'string') return null;
  const full = noteToMidi(key);
  if (full !== null) return full;
  return noteToMidi(`${key.trim()}${octave}`);
}

/**
 * The MIDI notes of a scale over `octaves` octaves starting at `root` (top root excluded).
 * @param {number} root MIDI root.
 * @param {string} scale Key of {@link SCALES}.
 * @param {{octaves?: number}} [opts]
 * @returns {number[]}
 */
export function scaleNotes(root, scale, { octaves = 1 } = {}) {
  const iv = SCALES[scale];
  if (!iv) throw new RangeError(`scaleNotes: unknown scale "${scale}"`);
  const out = [];
  for (let o = 0; o < octaves; o++) for (const s of iv) out.push(root + 12 * o + s);
  return out;
}

/**
 * Scale degree (0-based, any integer; wraps across octaves) → MIDI note.
 * @param {number} degree
 * @param {number} root
 * @param {string} scale
 * @returns {number}
 */
export function degreeToMidi(degree, root, scale) {
  const iv = SCALES[scale];
  if (!iv) throw new RangeError(`degreeToMidi: unknown scale "${scale}"`);
  const n = iv.length;
  const oct = Math.floor(degree / n);
  return root + 12 * oct + iv[((degree % n) + n) % n];
}

/**
 * Snap a MIDI note to the nearest scale tone (ties resolve downward).
 * @param {number} midi
 * @param {number} root
 * @param {string} scale
 * @returns {number}
 */
export function quantizeToScale(midi, root, scale) {
  const iv = SCALES[scale];
  if (!iv) throw new RangeError(`quantizeToScale: unknown scale "${scale}"`);
  const rel = midi - root;
  const oct = Math.floor(rel / 12);
  const pc = rel - oct * 12;
  let best = iv[0];
  let bestDist = Infinity;
  for (const s of [...iv, 12]) {
    const d = Math.abs(s - pc);
    if (d < bestDist || (d === bestDist && s < best)) {
      best = s;
      bestDist = d;
    }
  }
  return root + oct * 12 + best;
}

/**
 * Build a chord as MIDI notes.
 * @param {number} root MIDI root.
 * @param {string} [type='maj'] Key of {@link CHORDS}.
 * @param {{inversion?: number, octave?: number}} [opts] `inversion` moves that many low notes up an
 *   octave; `octave` transposes the whole chord.
 * @returns {number[]}
 */
export function chord(root, type = 'maj', { inversion = 0, octave = 0 } = {}) {
  const shape = CHORDS[type];
  if (!shape) throw new RangeError(`chord: unknown chord type "${type}"`);
  const notes = shape.map((s) => root + s + 12 * octave);
  const inv = clamp(Math.trunc(inversion), 0, notes.length - 1);
  for (let i = 0; i < inv; i++) notes.push(notes.shift() + 12);
  return notes;
}

/**
 * Decibels → linear gain.
 * @param {number} db
 * @returns {number}
 */
export function dbToGain(db) {
  return 10 ** (db / 20);
}

/**
 * Linear gain → decibels (0 gain → -Infinity).
 * @param {number} gain
 * @returns {number}
 */
export function gainToDb(gain) {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain);
}

/**
 * Perceptual volume curve: slider value 0..1 → gain. Quadratic so the lower half of the slider is
 * useful.
 * @param {number} v
 * @returns {number}
 */
export function volumeToGain(v) {
  const c = clamp(Number(v) || 0, 0, 1);
  return c * c;
}

/**
 * Equal-power fade curve for `setValueCurveAtTime`.
 * @param {number} n Number of samples (≥ 2).
 * @param {'in'|'out'} dir
 * @param {number} [scale=1] Multiplies the whole curve.
 * @returns {Float32Array}
 */
export function fadeCurve(n, dir, scale = 1) {
  const len = Math.max(2, Math.trunc(n));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * (Math.PI / 2);
    out[i] = (dir === 'out' ? Math.cos(x) : Math.sin(x)) * scale;
  }
  return out;
}

/**
 * Small deterministic PRNG (32-bit LCG) for humanization and offline-render reproducibility.
 * @param {number} seed
 * @returns {() => number} Returns values in [0, 1).
 */
export function makeLcg(seed) {
  let s = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * FNV-1a style string hash → uint32 (used to seed per-track humanization).
 * @param {string} str
 * @returns {number}
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Patterns and scheduling math (pure)
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} PatternEvent
 * @property {number} t Step index within the loop (may be fractional, e.g. 2.5 for a 32nd).
 * @property {number|string|Array<number|string>|null} [n] MIDI note, note name, chord array, or
 *   `null` for a rest. Defaults to the instrument's default note.
 * @property {number} [d=1] Duration in steps.
 * @property {number} [v=0.8] Velocity 0..1.
 */

/**
 * @typedef {object} NoteEvent Normalized event.
 * @property {number} t Step (0 ≤ t < loopSteps).
 * @property {number[]} n MIDI notes (≥ 1 entry).
 * @property {number} d Duration in steps (> 0).
 * @property {number} v Velocity 0..1.
 */

/**
 * Seconds per sequencer step.
 * @param {number} bpm
 * @param {number} [stepsPerBeat=4]
 * @returns {number}
 */
export function stepSeconds(bpm, stepsPerBeat = 4) {
  if (!(bpm > 0) || !(stepsPerBeat > 0)) throw new RangeError('stepSeconds: bpm and stepsPerBeat must be > 0');
  return 60 / bpm / stepsPerBeat;
}

/**
 * Resolve a note spec (`62`, `"D4"`, `[62, 66, 69]`, `["D4", "F#4"]`) to an array of MIDI numbers.
 * Unparsable entries are dropped; a rest resolves to `[]`.
 * @param {number|string|Array<number|string>|null|undefined} n
 * @returns {number[]}
 */
export function resolveNotes(n) {
  if (n === null || n === undefined) return [];
  const list = Array.isArray(n) ? n : [n];
  const out = [];
  for (const x of list) {
    if (typeof x === 'number' && Number.isFinite(x)) out.push(x);
    else if (typeof x === 'string') {
      const m = noteToMidi(x);
      if (m !== null) out.push(m);
    }
  }
  return out;
}

/**
 * Expand and validate a layer pattern into sorted, normalized {@link NoteEvent}s. Events outside
 * `[0, loopSteps)`, rests and malformed entries are dropped; velocities are clamped to 0..1 and
 * durations forced positive.
 * @param {PatternEvent[]} pattern
 * @param {{loopSteps: number, defaultNote?: number, defaultVel?: number, defaultDur?: number}} opts
 * @returns {NoteEvent[]}
 */
export function expandPattern(pattern, { loopSteps, defaultNote = 60, defaultVel = 0.8, defaultDur = 1 }) {
  if (!(loopSteps > 0)) throw new RangeError('expandPattern: loopSteps must be > 0');
  if (!Array.isArray(pattern)) throw new TypeError('expandPattern: pattern must be an array');
  const out = [];
  for (const ev of pattern) {
    if (!ev || typeof ev !== 'object') continue;
    const t = Number(ev.t);
    if (!Number.isFinite(t) || t < 0 || t >= loopSteps) continue;
    const n = ev.n === undefined ? [defaultNote] : resolveNotes(ev.n);
    if (n.length === 0) continue;
    const d = ev.d === undefined ? defaultDur : Number(ev.d);
    const v = ev.v === undefined ? defaultVel : Number(ev.v);
    out.push({
      t,
      n,
      d: Number.isFinite(d) && d > 0 ? d : defaultDur,
      v: Number.isFinite(v) ? clamp(v, 0, 1) : defaultVel,
    });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/**
 * Parse a drum-style step string into pattern events, one character per step: `x` hit, `X` accent,
 * `o` soft, `.`/`-`/space rest. Whitespace and `|` bar separators are ignored.
 * @param {string} str e.g. `"x...x...x...x..."`
 * @param {{note?: number, vel?: number}} [opts]
 * @returns {PatternEvent[]}
 */
export function parseStepString(str, { note = 60, vel = 0.8 } = {}) {
  if (typeof str !== 'string') throw new TypeError('parseStepString: expected a string');
  const out = [];
  let step = 0;
  for (const ch of str) {
    if (ch === '|' || ch === ' ' || ch === '\n' || ch === '\t') continue;
    if (ch === 'x') out.push({ t: step, n: note, d: 1, v: vel });
    else if (ch === 'X') out.push({ t: step, n: note, d: 1, v: 1 });
    else if (ch === 'o') out.push({ t: step, n: note, d: 1, v: vel * 0.55 });
    step++;
  }
  return out;
}

/**
 * Group events by integer step for O(1) lookup during scheduling.
 * @param {NoteEvent[]} events
 * @returns {Map<number, NoteEvent[]>}
 */
export function bucketEvents(events) {
  const map = new Map();
  for (const ev of events) {
    const k = Math.floor(ev.t);
    const arr = map.get(k);
    if (arr) arr.push(ev);
    else map.set(k, [ev]);
  }
  return map;
}

/**
 * Swing delay for a step: odd 16th-steps are pushed late by up to a triplet third.
 * @param {number} step Integer step within the bar.
 * @param {number} swing 0 (straight) .. 1 (full triplet swing).
 * @param {number} stepSec Seconds per step.
 * @returns {number} Seconds to add.
 */
export function swingOffset(step, swing, stepSec) {
  if (!(swing > 0)) return 0;
  return step % 2 === 1 ? clamp(swing, 0, 1) * stepSec / 3 : 0;
}

/**
 * @typedef {object} StepTick
 * @property {number} abs Absolute step since start (0-based, never repeats).
 * @property {number} step Step within the loop.
 * @property {number} bar Bar within the loop.
 * @property {number} loop Loop iteration (0-based).
 * @property {number} time Audio-context time of the step's downbeat.
 */

/**
 * A pure step clock for look-ahead scheduling. Call {@link StepClock#advance} each tick with the
 * horizon time (`now + lookahead`); it returns every step that starts before the horizon and has not
 * been returned yet. If the horizon jumps far ahead (tab was asleep) the clock catches up instead of
 * dumping thousands of steps.
 * @typedef {object} StepClock
 * @property {number} stepSec
 * @property {number} loopSec
 * @property {number} loopSteps
 * @property {(horizon: number) => StepTick[]} advance
 * @property {(time: number) => {abs: number, step: number, bar: number, beat: number, loop: number, phase: number}} positionAt
 * @property {(abs: number) => number} timeOf Downbeat time of an absolute step.
 * @property {(time: number) => number} nextBarTime First bar boundary at or after `time`.
 * @property {() => number} nextStep Next absolute step that `advance` will emit.
 */

/**
 * Create a {@link StepClock}.
 * @param {{bpm: number, loopSteps: number, stepsPerBeat?: number, stepsPerBar?: number,
 *   startTime?: number, maxCatchUpSteps?: number}} opts
 * @returns {StepClock}
 */
export function createStepClock({ bpm, loopSteps, stepsPerBeat = 4, stepsPerBar = 16, startTime = 0, maxCatchUpSteps }) {
  if (!(loopSteps > 0) || !Number.isInteger(loopSteps)) throw new RangeError('createStepClock: loopSteps must be a positive integer');
  const stepSec = stepSeconds(bpm, stepsPerBeat);
  const maxCatchUp = maxCatchUpSteps ?? stepsPerBar * 2;
  let next = 0;
  const timeOf = (abs) => startTime + abs * stepSec;
  const tickOf = (abs) => ({
    abs,
    step: abs % loopSteps,
    bar: Math.floor((abs % loopSteps) / stepsPerBar),
    loop: Math.floor(abs / loopSteps),
    time: timeOf(abs),
  });
  return {
    stepSec,
    loopSec: stepSec * loopSteps,
    loopSteps,
    advance(horizon) {
      const out = [];
      if (!(horizon > timeOf(next))) return out;
      const lastDue = Math.floor((horizon - startTime) / stepSec - 1e-9);
      if (lastDue - next > maxCatchUp) next = lastDue - maxCatchUp;
      while (timeOf(next) < horizon) out.push(tickOf(next++));
      return out;
    },
    positionAt(time) {
      const absF = Math.max(0, (time - startTime) / stepSec);
      const abs = Math.floor(absF);
      const step = abs % loopSteps;
      return {
        abs,
        step,
        bar: Math.floor(step / stepsPerBar),
        beat: Math.floor((step % stepsPerBar) / stepsPerBeat),
        loop: Math.floor(abs / loopSteps),
        phase: absF - abs,
      };
    },
    timeOf,
    nextBarTime(time) {
      const steps = Math.max(0, (time - startTime) / stepSec);
      return timeOf(Math.ceil(steps / stepsPerBar - 1e-9) * stepsPerBar);
    },
    nextStep: () => next,
  };
}

/**
 * Rate limiter for one-shot triggers: refuses the same key within `minInterval` seconds and refuses
 * everything once `maxBurst` triggers happened within the last `window` seconds.
 * @param {{minInterval?: number, maxBurst?: number, window?: number}} [opts]
 * @returns {{allow: (key: string, now: number) => boolean, reset: () => void}}
 */
export function createRateLimiter({ minInterval = 0.02, maxBurst = 16, window = 0.1 } = {}) {
  const last = new Map();
  let recent = [];
  return {
    allow(key, now) {
      const prev = last.get(key);
      if (prev !== undefined && now - prev < minInterval && now >= prev) return false;
      recent = recent.filter((t) => now - t < window);
      if (recent.length >= maxBurst) return false;
      last.set(key, now);
      recent.push(now);
      return true;
    },
    reset() {
      last.clear();
      recent = [];
    },
  };
}

/**
 * Peak and RMS level of rendered audio (all channels pooled).
 * @param {ArrayLike<number>[]} channels One Float32Array per channel.
 * @returns {{peak: number, rms: number, samples: number}}
 */
export function analyzeBuffer(channels) {
  let peak = 0;
  let sum = 0;
  let count = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i];
      const a = s < 0 ? -s : s;
      if (a > peak) peak = a;
      sum += s * s;
    }
    count += ch.length;
  }
  return { peak, rms: count ? Math.sqrt(sum / count) : 0, samples: count };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Track definitions (pure)
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** Instrument preset names available to sequencer layers. */
export const INSTRUMENT_NAMES = Object.freeze(['pluck', 'pad', 'bass', 'bell', 'flute', 'kick', 'hat', 'snare', 'marimba', 'glass']);

/** Default MIDI note per instrument when a pattern event omits `n` (drums ignore pitch mostly). */
const DEFAULT_NOTES = Object.freeze({ kick: 36, hat: 42, snare: 38 });

/** Layer-name → instrument guesses for the shorthand `layers: {name: pattern}` form. */
const LAYER_ALIASES = Object.freeze({
  melody: 'marimba', lead: 'pluck', arp: 'pluck', chords: 'pad', drums: 'kick', shaker: 'hat',
  hihat: 'hat', perc: 'snare', rim: 'snare', night: 'glass', tide: 'flute', rain: 'glass', battle: 'snare',
});

/**
 * Infer an instrument for a layer from its name.
 * @param {string} name
 * @returns {string} A member of {@link INSTRUMENT_NAMES}.
 */
export function inferInstrument(name) {
  const n = String(name).toLowerCase();
  if (INSTRUMENT_NAMES.includes(n)) return n;
  return LAYER_ALIASES[n] ?? 'pluck';
}

/**
 * @typedef {object} TrackLayer
 * @property {string} name
 * @property {string} inst Instrument preset.
 * @property {number} gain Layer gain 0..2.
 * @property {boolean} stem If true the layer starts muted and is toggled with `setStem`.
 * @property {number} minIntensity Layer is muted while music intensity is below this.
 * @property {number} pan -1..1.
 * @property {number} humanize 0..1 velocity/timing variation.
 * @property {NoteEvent[]} events
 * @property {Map<number, NoteEvent[]>} buckets Events grouped by integer step.
 */

/**
 * @typedef {object} Track
 * @property {string} id
 * @property {number} bpm
 * @property {string} key
 * @property {number} root MIDI root of the key (octave 3).
 * @property {string} scale
 * @property {number} bars
 * @property {number} beatsPerBar
 * @property {number} stepsPerBar
 * @property {number} stepsPerBeat
 * @property {number} loopSteps
 * @property {number} swing
 * @property {TrackLayer[]} layers
 */

/**
 * Validate and normalize a track definition. Layers may be given as a bare pattern array
 * (instrument inferred from the layer name) or as `{inst, pattern, gain, stem, minIntensity, pan,
 * humanize}` where `pattern` is an event array or a drum step string.
 * @param {string} id
 * @param {{bpm: number, key?: string, scale?: string, bars?: number, beatsPerBar?: number,
 *   stepsPerBar?: number, swing?: number, layers: Record<string, PatternEvent[]|string|object>}} def
 * @returns {Track}
 * @throws {TypeError|RangeError} On malformed definitions.
 */
export function normalizeTrack(id, def) {
  if (typeof id !== 'string' || !id) throw new TypeError('normalizeTrack: id must be a non-empty string');
  if (!def || typeof def !== 'object') throw new TypeError(`normalizeTrack(${id}): definition must be an object`);
  const bpm = Number(def.bpm);
  if (!(bpm >= 20 && bpm <= 300)) throw new RangeError(`normalizeTrack(${id}): bpm must be 20..300`);
  const bars = def.bars === undefined ? 4 : Number(def.bars);
  if (!Number.isInteger(bars) || bars < 1) throw new RangeError(`normalizeTrack(${id}): bars must be a positive integer`);
  const beatsPerBar = def.beatsPerBar === undefined ? 4 : Number(def.beatsPerBar);
  const stepsPerBar = def.stepsPerBar === undefined ? beatsPerBar * 4 : Number(def.stepsPerBar);
  if (!Number.isInteger(stepsPerBar) || stepsPerBar < 1 || !Number.isInteger(beatsPerBar) || beatsPerBar < 1 || stepsPerBar % beatsPerBar !== 0) {
    throw new RangeError(`normalizeTrack(${id}): stepsPerBar must be a positive multiple of beatsPerBar`);
  }
  const key = def.key === undefined ? 'C' : String(def.key);
  const root = keyToMidi(key, 3);
  if (root === null) throw new RangeError(`normalizeTrack(${id}): unknown key "${key}"`);
  const scale = def.scale === undefined ? 'major' : String(def.scale);
  if (!SCALES[scale]) throw new RangeError(`normalizeTrack(${id}): unknown scale "${scale}"`);
  if (!def.layers || typeof def.layers !== 'object') throw new TypeError(`normalizeTrack(${id}): layers must be an object`);
  const loopSteps = bars * stepsPerBar;
  const layers = [];
  for (const [name, raw] of Object.entries(def.layers)) {
    const spec = Array.isArray(raw) || typeof raw === 'string' ? { pattern: raw } : raw;
    if (!spec || typeof spec !== 'object') throw new TypeError(`normalizeTrack(${id}): layer "${name}" is malformed`);
    const inst = spec.inst === undefined ? inferInstrument(name) : String(spec.inst);
    if (!INSTRUMENT_NAMES.includes(inst)) throw new RangeError(`normalizeTrack(${id}): layer "${name}" uses unknown instrument "${inst}"`);
    const defaultNote = DEFAULT_NOTES[inst] ?? 60;
    const pattern = typeof spec.pattern === 'string' ? parseStepString(spec.pattern, { note: defaultNote }) : spec.pattern;
    if (!Array.isArray(pattern)) throw new TypeError(`normalizeTrack(${id}): layer "${name}" needs a pattern array or step string`);
    const events = expandPattern(pattern, { loopSteps, defaultNote });
    layers.push({
      name,
      inst,
      gain: clamp(spec.gain === undefined ? 1 : Number(spec.gain) || 0, 0, 2),
      stem: Boolean(spec.stem),
      minIntensity: clamp(Number(spec.minIntensity) || 0, 0, 1),
      pan: clamp(Number(spec.pan) || 0, -1, 1),
      humanize: clamp(spec.humanize === undefined ? 0.5 : Number(spec.humanize) || 0, 0, 1),
      events,
      buckets: bucketEvents(events),
    });
  }
  return {
    id, bpm, key, root, scale, bars, beatsPerBar, stepsPerBar,
    stepsPerBeat: stepsPerBar / beatsPerBar, loopSteps,
    swing: clamp(Number(def.swing) || 0, 0, 1), layers,
  };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Synth primitives (take a BaseAudioContext; safe to define under Node, only run in a browser)
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** Smallest value exponential ramps may target (they cannot reach 0). */
const EPS = 0.0005;

/** Cached noise buffers per context so offline and live contexts each get their own. */
const noiseCache = new WeakMap();

/**
 * Get (and lazily build) a 2-second looping noise buffer for a context.
 * @param {BaseAudioContext} ctx
 * @param {'white'|'pink'|'brown'} color
 * @returns {AudioBuffer}
 */
function noiseBuffer(ctx, color) {
  let perCtx = noiseCache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    noiseCache.set(ctx, perCtx);
  }
  let buf = perCtx.get(color);
  if (buf) return buf;
  const len = Math.floor(ctx.sampleRate * 2);
  buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = makeLcg(color === 'white' ? 11 : color === 'pink' ? 22 : 33);
  if (color === 'white') {
    for (let i = 0; i < len; i++) data[i] = rnd() * 2 - 1;
  } else if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }
  perCtx.set(color, buf);
  return buf;
}

/**
 * Gain node connected to `dest`.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} [value=1]
 * @returns {GainNode}
 */
function mkGain(ctx, dest, value = 1) {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(dest);
  return g;
}

/**
 * Biquad filter connected to `dest`.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {BiquadFilterType} type
 * @param {number} freq
 * @param {number} [q=0.7]
 * @returns {BiquadFilterNode}
 */
function mkFilter(ctx, dest, type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = clamp(freq, 10, 20000);
  f.Q.value = q;
  f.connect(dest);
  return f;
}

/**
 * Oscillator connected to `dest`, started at `t0` and stopped at `t1`.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {OscillatorType} type
 * @param {number} freq
 * @param {number} t0
 * @param {number} t1
 * @param {number} [detune=0] Cents.
 * @returns {OscillatorNode}
 */
function mkOsc(ctx, dest, type, freq, t0, t1, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(clamp(freq, 1, 20000), t0);
  if (detune) o.detune.value = detune;
  o.connect(dest);
  o.start(t0);
  o.stop(t1 + 0.01);
  return o;
}

/**
 * Looping noise source connected to `dest` with a randomized start offset.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t0
 * @param {number} t1
 * @param {{color?: 'white'|'pink'|'brown', rand?: () => number}} [opts]
 * @returns {AudioBufferSourceNode}
 */
function mkNoise(ctx, dest, t0, t1, { color = 'white', rand = Math.random } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  src.loop = true;
  src.connect(dest);
  src.start(t0, rand() * 1.5);
  src.stop(t1 + 0.01);
  return src;
}

/**
 * Attack/decay/sustain/release envelope on an AudioParam. The sustain segment holds until
 * `t0 + hold`, then releases. Returns the time the envelope reaches silence.
 * @param {AudioParam} param
 * @param {number} t0
 * @param {{a?: number, d?: number, s?: number, r?: number, peak?: number, hold?: number}} e
 * @returns {number}
 */
function adsr(param, t0, { a = 0.005, d = 0.1, s = 0, r = 0.1, peak = 1, hold = 0 }) {
  const p = Math.max(peak, EPS);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.linearRampToValueAtTime(p, t0 + a);
  const sus = Math.max(p * s, EPS);
  param.exponentialRampToValueAtTime(sus, t0 + a + d);
  const relStart = Math.max(t0 + a + d, t0 + hold);
  param.setValueAtTime(sus, relStart);
  param.exponentialRampToValueAtTime(EPS, relStart + r);
  return relStart + r;
}

/**
 * Percussive envelope: instant-ish attack, exponential decay to silence by `t0 + dur`.
 * @param {AudioParam} param
 * @param {number} t0
 * @param {number} peak
 * @param {number} dur
 * @param {number} [a=0.003]
 * @returns {number} End time.
 */
function perc(param, t0, peak, dur, a = 0.003) {
  const p = Math.max(peak, EPS);
  param.cancelScheduledValues(t0);
  param.setValueAtTime(EPS, t0);
  param.linearRampToValueAtTime(p, t0 + a);
  param.exponentialRampToValueAtTime(EPS, t0 + Math.max(dur, a + 0.005));
  return t0 + dur;
}

/**
 * Sweep an AudioParam from `from` at `t0` to `to` at `t1` (exponential when both are positive).
 * @param {AudioParam} param
 * @param {number} t0
 * @param {number} from
 * @param {number} t1
 * @param {number} to
 */
function sweep(param, t0, from, t1, to) {
  param.setValueAtTime(from, t0);
  if (from > 0 && to > 0) param.exponentialRampToValueAtTime(to, t1);
  else param.linearRampToValueAtTime(to, t1);
}

/**
 * Stereo panner when supported, otherwise a pass-through gain.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} pan -1..1
 * @returns {AudioNode}
 */
function mkPan(ctx, dest, pan) {
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(dest);
    return p;
  }
  return mkGain(ctx, dest, 1);
}

/**
 * Sum of sine partials with individual gains and decay times (bells, glass, marimba bars).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t0
 * @param {number} freq
 * @param {Array<[ratio: number, gain: number, decay: number]>} list
 * @param {number} [attack=0.004]
 * @returns {number} End time of the longest partial.
 */
function partials(ctx, dest, t0, freq, list, attack = 0.004) {
  let end = t0;
  for (const [ratio, gain, decay] of list) {
    const f = freq * ratio;
    if (f > 18000) continue;
    const g = mkGain(ctx, dest, 0);
    end = Math.max(end, perc(g.gain, t0, gain, decay, attack));
    mkOsc(ctx, g, 'sine', f, t0, t0 + decay);
  }
  return end;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Instrument presets for the sequencer
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} NoteSpec
 * @property {number} freq Hz.
 * @property {number} time Start time.
 * @property {number} dur Seconds the note is held.
 * @property {number} vel 0..1.
 */

/** @type {Record<string, (ctx: BaseAudioContext, dest: AudioNode, note: NoteSpec) => void>} */
const INSTRUMENTS = {
  pluck(ctx, dest, { freq, time, dur, vel }) {
    const decay = clamp(dur * 1.3, 0.35, 1.6);
    const amp = mkGain(ctx, dest, 0);
    perc(amp.gain, time, 0.32 * vel, decay);
    const lp = mkFilter(ctx, amp, 'lowpass', freq * 6, 1.2);
    sweep(lp.frequency, time, clamp(freq * 7, 300, 9000), time + 0.22, clamp(freq * 1.6, 200, 4000));
    mkOsc(ctx, lp, 'triangle', freq, time, time + decay);
    const sawG = mkGain(ctx, lp, 0.35);
    mkOsc(ctx, sawG, 'sawtooth', freq, time, time + decay, 6);
  },
  pad(ctx, dest, { freq, time, dur, vel }) {
    const amp = mkGain(ctx, dest, 0);
    const a = Math.min(0.35, dur * 0.4);
    adsr(amp.gain, time, { a, d: 0.3, s: 0.8, r: 0.7, peak: 0.11 * vel, hold: dur });
    const lp = mkFilter(ctx, amp, 'lowpass', clamp(freq * 2.5, 500, 3500), 0.8);
    mkOsc(ctx, mkGain(ctx, lp.frequency, clamp(freq * 0.8, 80, 600)), 'sine', 0.28, time, time + dur + 0.8);
    mkOsc(ctx, lp, 'sawtooth', freq, time, time + dur + 0.8, -7);
    mkOsc(ctx, lp, 'sawtooth', freq, time, time + dur + 0.8, 7);
    const sub = mkGain(ctx, lp, 0.5);
    mkOsc(ctx, sub, 'triangle', freq * 0.5, time, time + dur + 0.8);
  },
  bass(ctx, dest, { freq, time, dur, vel }) {
    const amp = mkGain(ctx, dest, 0);
    const end = adsr(amp.gain, time, { a: 0.006, d: 0.22, s: 0.35, r: 0.09, peak: 0.55 * vel, hold: dur });
    mkOsc(ctx, amp, 'sine', freq, time, end);
    const lp = mkFilter(ctx, amp, 'lowpass', freq * 4, 1.5);
    sweep(lp.frequency, time, clamp(freq * 6, 200, 2500), time + 0.16, clamp(freq * 1.3, 80, 600));
    const tri = mkGain(ctx, lp, 0.6);
    mkOsc(ctx, tri, 'triangle', freq, time, end);
    const saw = mkGain(ctx, lp, 0.25);
    mkOsc(ctx, saw, 'sawtooth', freq, time, end);
  },
  bell(ctx, dest, { freq, time, dur, vel }) {
    const len = clamp(dur * 2, 1.2, 2.8) * clamp(440 / freq, 0.5, 1.4);
    partials(ctx, dest, time, freq, [
      [0.5, 0.18 * vel, len * 1.1], [1, 0.3 * vel, len], [1.2, 0.14 * vel, len * 0.8],
      [1.5, 0.1 * vel, len * 0.7], [2, 0.12 * vel, len * 0.6], [2.67, 0.06 * vel, len * 0.45], [4, 0.03 * vel, len * 0.3],
    ]);
    const strike = mkGain(ctx, dest, 0);
    perc(strike.gain, time, 0.05 * vel, 0.03);
    mkNoise(ctx, mkFilter(ctx, strike, 'bandpass', freq * 3, 2), time, time + 0.04);
  },
  flute(ctx, dest, { freq, time, dur, vel }) {
    const amp = mkGain(ctx, dest, 0);
    const end = adsr(amp.gain, time, { a: 0.06, d: 0.1, s: 0.85, r: 0.14, peak: 0.24 * vel, hold: dur });
    const o = mkOsc(ctx, amp, 'sine', freq, time, end);
    const o2 = mkOsc(ctx, mkGain(ctx, amp, 0.18), 'triangle', freq * 2, time, end);
    const vib = mkGain(ctx, o.detune, 0);
    vib.connect(o2.detune);
    vib.gain.setValueAtTime(0, time);
    vib.gain.linearRampToValueAtTime(7, time + 0.25);
    mkOsc(ctx, vib, 'sine', 5.2, time, end);
    const breath = mkGain(ctx, amp, 0.06);
    mkNoise(ctx, mkFilter(ctx, breath, 'bandpass', freq * 2, 4), time, end);
  },
  kick(ctx, dest, { freq, time, vel }) {
    const tune = clamp(freq / midiToFreq(36), 0.6, 1.6);
    const amp = mkGain(ctx, dest, 0);
    perc(amp.gain, time, 0.75 * vel, 0.32);
    const o = mkOsc(ctx, amp, 'sine', 150 * tune, time, time + 0.35);
    sweep(o.frequency, time, 150 * tune, time + 0.09, 48 * tune);
    const click = mkGain(ctx, dest, 0);
    perc(click.gain, time, 0.12 * vel, 0.012);
    mkNoise(ctx, mkFilter(ctx, click, 'highpass', 1500, 0.7), time, time + 0.02);
  },
  hat(ctx, dest, { time, vel, dur }) {
    const len = clamp(dur * 0.5, 0.04, 0.14);
    const amp = mkGain(ctx, dest, 0);
    perc(amp.gain, time, 0.22 * vel, len, 0.001);
    const bp = mkFilter(ctx, amp, 'bandpass', 9000, 1.2);
    mkNoise(ctx, mkFilter(ctx, bp, 'highpass', 6500, 0.7), time, time + len);
  },
  snare(ctx, dest, { time, vel }) {
    const amp = mkGain(ctx, dest, 0);
    perc(amp.gain, time, 0.4 * vel, 0.19, 0.001);
    mkNoise(ctx, mkFilter(ctx, amp, 'bandpass', 1900, 0.8), time, time + 0.2);
    const body = mkGain(ctx, dest, 0);
    perc(body.gain, time, 0.3 * vel, 0.09);
    const o = mkOsc(ctx, body, 'triangle', 200, time, time + 0.1);
    sweep(o.frequency, time, 200, time + 0.07, 120);
  },
  marimba(ctx, dest, { freq, time, vel }) {
    const decay = clamp(0.45 * Math.sqrt(220 / freq), 0.18, 0.9);
    partials(ctx, dest, time, freq, [[1, 0.42 * vel, decay], [4, 0.14 * vel, decay * 0.22], [9.2, 0.04 * vel, decay * 0.1]], 0.002);
    const mallet = mkGain(ctx, dest, 0);
    perc(mallet.gain, time, 0.07 * vel, 0.01);
    mkNoise(ctx, mkFilter(ctx, mallet, 'bandpass', 2400, 1.5), time, time + 0.015);
  },
  glass(ctx, dest, { freq, time, dur, vel }) {
    const len = clamp(dur * 1.5, 1.0, 2.4);
    const hp = mkFilter(ctx, dest, 'highpass', 300, 0.5);
    partials(ctx, hp, time, freq, [
      [1, 0.2 * vel, len], [1.003, 0.14 * vel, len * 0.9], [2.0, 0.07 * vel, len * 0.6],
      [3.01, 0.045 * vel, len * 0.45], [4.16, 0.025 * vel, len * 0.3],
    ], 0.012);
  },
};

/**
 * Trigger an instrument note.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {string} inst Member of {@link INSTRUMENT_NAMES}.
 * @param {NoteSpec} note
 */
function playNote(ctx, dest, inst, note) {
  const fn = INSTRUMENTS[inst];
  if (!fn) throw new RangeError(`playNote: unknown instrument "${inst}"`);
  fn(ctx, dest, note);
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// SFX bank. Each entry: nominal duration in seconds and a synth routine.
// `p` = {pitch: frequency multiplier, gain: 0..1+, rand: () => number}.
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SfxParams
 * @property {number} pitch Frequency multiplier.
 * @property {number} gain Linear gain multiplier.
 * @property {() => number} rand Random source in [0, 1).
 */

/**
 * A short tonal ping: sine + a touch of 2nd harmonic with a percussive decay.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t0
 * @param {number} freq
 * @param {number} gain
 * @param {number} decay
 * @param {OscillatorType} [type='sine']
 */
function ping(ctx, dest, t0, freq, gain, decay, type = 'sine') {
  const g = mkGain(ctx, dest, 0);
  perc(g.gain, t0, gain, decay);
  mkOsc(ctx, g, type, freq, t0, t0 + decay);
  const h = mkGain(ctx, dest, 0);
  perc(h.gain, t0, gain * 0.18, decay * 0.5);
  mkOsc(ctx, h, 'sine', freq * 2, t0, t0 + decay * 0.5);
}

/**
 * A filtered noise burst.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t0
 * @param {{gain: number, dur: number, type?: BiquadFilterType, freq: number, q?: number,
 *   to?: number, color?: 'white'|'pink'|'brown', attack?: number, rand?: () => number}} o
 */
function burst(ctx, dest, t0, { gain, dur, type = 'bandpass', freq, q = 1, to, color = 'white', attack = 0.002, rand }) {
  const g = mkGain(ctx, dest, 0);
  perc(g.gain, t0, gain, dur, attack);
  const f = mkFilter(ctx, g, type, freq, q);
  if (to !== undefined) sweep(f.frequency, t0, freq, t0 + dur, to);
  mkNoise(ctx, f, t0, t0 + dur, { color, rand });
}

/**
 * Low thump: sine sweeping down with a percussive envelope.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t0
 * @param {number} from
 * @param {number} to
 * @param {number} gain
 * @param {number} dur
 */
function thump(ctx, dest, t0, from, to, gain, dur) {
  const g = mkGain(ctx, dest, 0);
  perc(g.gain, t0, gain, dur);
  const o = mkOsc(ctx, g, 'sine', from, t0, t0 + dur);
  sweep(o.frequency, t0, from, t0 + dur * 0.6, to);
}

/**
 * Slow noise swell with a filter sweep (waves, rain beds, whooshes).
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {number} t0
 * @param {{gain: number, attack: number, release: number, freq: number, peakFreq: number, q?: number,
 *   type?: BiquadFilterType, color?: 'white'|'pink'|'brown', rand?: () => number}} o
 * @returns {number} End time.
 */
function swell(ctx, dest, t0, { gain, attack, release, freq, peakFreq, q = 0.8, type = 'lowpass', color = 'pink', rand }) {
  const g = mkGain(ctx, dest, 0);
  const end = adsr(g.gain, t0, { a: attack, d: 0.01, s: 1, r: release, peak: gain, hold: attack });
  const f = mkFilter(ctx, g, type, freq, q);
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(peakFreq, t0 + attack);
  f.frequency.exponentialRampToValueAtTime(freq, end);
  mkNoise(ctx, f, t0, end, { color, rand });
  return end;
}

/** @type {Record<string, {dur: number, play: (ctx: BaseAudioContext, dest: AudioNode, t0: number, p: SfxParams) => void}>} */
const SFX = {
  blip: {
    dur: 0.09,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.28 * p.gain, 0.07);
      const o = mkOsc(ctx, mkFilter(ctx, g, 'lowpass', 4000 * p.pitch, 0.7), 'square', 880 * p.pitch, t0, t0 + 0.07);
      sweep(o.frequency, t0, 880 * p.pitch, t0 + 0.06, 740 * p.pitch);
    },
  },
  confirm: {
    dur: 0.42,
    play(ctx, dest, t0, p) {
      ping(ctx, dest, t0, 659 * p.pitch, 0.28 * p.gain, 0.16, 'triangle');
      ping(ctx, dest, t0 + 0.085, 988 * p.pitch, 0.3 * p.gain, 0.3, 'triangle');
      ping(ctx, dest, t0 + 0.13, 1976 * p.pitch, 0.06 * p.gain, 0.25);
    },
  },
  cancel: {
    dur: 0.3,
    play(ctx, dest, t0, p) {
      const lp = mkFilter(ctx, dest, 'lowpass', 2600 * p.pitch, 0.8);
      ping(ctx, lp, t0, 740 * p.pitch, 0.26 * p.gain, 0.12, 'triangle');
      ping(ctx, lp, t0 + 0.08, 494 * p.pitch, 0.24 * p.gain, 0.2, 'triangle');
    },
  },
  error: {
    dur: 0.36,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      const lp = mkFilter(ctx, g, 'lowpass', 1200 * p.pitch, 1.5);
      for (const [at, len] of [[0, 0.12], [0.16, 0.16]]) {
        g.gain.setValueAtTime(EPS, t0 + at);
        g.gain.linearRampToValueAtTime(0.3 * p.gain, t0 + at + 0.008);
        g.gain.setValueAtTime(0.3 * p.gain, t0 + at + len - 0.03);
        g.gain.exponentialRampToValueAtTime(EPS, t0 + at + len);
      }
      mkOsc(ctx, lp, 'square', 110 * p.pitch, t0, t0 + 0.33);
      mkOsc(ctx, lp, 'sawtooth', 112 * p.pitch, t0, t0 + 0.33);
    },
  },
  step: {
    dur: 0.12,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.3 * p.gain, dur: 0.06, type: 'lowpass', freq: 900 * p.pitch, q: 0.9, color: 'brown', rand: p.rand });
      burst(ctx, dest, t0, { gain: 0.12 * p.gain, dur: 0.035, type: 'bandpass', freq: 2600 * p.pitch, q: 0.8, rand: p.rand });
      thump(ctx, dest, t0, 130 * p.pitch, 65 * p.pitch, 0.32 * p.gain, 0.09);
    },
  },
  stepWater: {
    dur: 0.22,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.3 * p.gain, dur: 0.16, type: 'bandpass', freq: 1500 * p.pitch, to: 500 * p.pitch, q: 1.2, rand: p.rand });
      thump(ctx, dest, t0, 220 * p.pitch, 90 * p.pitch, 0.18 * p.gain, 0.08);
      const drop = mkGain(ctx, dest, 0);
      perc(drop.gain, t0 + 0.07, 0.12 * p.gain, 0.09);
      const o = mkOsc(ctx, drop, 'sine', 1700 * p.pitch, t0 + 0.07, t0 + 0.17);
      sweep(o.frequency, t0 + 0.07, 1700 * p.pitch, t0 + 0.15, 2500 * p.pitch);
    },
  },
  shake: {
    dur: 0.45,
    play(ctx, dest, t0, p) {
      let t = t0;
      for (let i = 0; i < 5; i++) {
        burst(ctx, dest, t, { gain: (0.2 + 0.1 * p.rand()) * p.gain, dur: 0.07, type: 'bandpass', freq: (2600 + 1200 * p.rand()) * p.pitch, q: 0.6, rand: p.rand });
        t += 0.05 + 0.04 * p.rand();
      }
      const creak = mkGain(ctx, dest, 0);
      adsr(creak.gain, t0, { a: 0.03, d: 0.1, s: 0.6, r: 0.15, peak: 0.12 * p.gain, hold: 0.22 });
      const o = mkOsc(ctx, mkFilter(ctx, creak, 'lowpass', 420, 2), 'sawtooth', 78 * p.pitch, t0, t0 + 0.4);
      sweep(o.frequency, t0, 78 * p.pitch, t0 + 0.3, 92 * p.pitch);
    },
  },
  fruitDrop: {
    dur: 0.18,
    play(ctx, dest, t0, p) {
      thump(ctx, dest, t0, 190 * p.pitch, 58 * p.pitch, 0.5 * p.gain, 0.14);
      burst(ctx, dest, t0, { gain: 0.1 * p.gain, dur: 0.02, type: 'lowpass', freq: 1800, rand: p.rand });
    },
  },
  coin: {
    dur: 0.5,
    play(ctx, dest, t0, p) {
      ping(ctx, dest, t0, 988 * p.pitch, 0.3 * p.gain, 0.22);
      ping(ctx, dest, t0 + 0.07, 1480 * p.pitch, 0.32 * p.gain, 0.4);
    },
  },
  purse: {
    dur: 0.4,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.25 * p.gain, dur: 0.07, type: 'lowpass', freq: 500, color: 'brown', rand: p.rand });
      for (let i = 0; i < 6; i++) {
        const t = t0 + 0.02 + i * 0.04 + p.rand() * 0.02;
        ping(ctx, dest, t, (2200 + p.rand() * 2400) * p.pitch, (0.07 + 0.06 * p.rand()) * p.gain, 0.12 + 0.1 * p.rand(), 'triangle');
      }
    },
  },
  splash: {
    dur: 0.75,
    play(ctx, dest, t0, p) {
      thump(ctx, dest, t0, 320 * p.pitch, 90 * p.pitch, 0.3 * p.gain, 0.09);
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0, { a: 0.035, d: 0.25, s: 0.3, r: 0.3, peak: 0.42 * p.gain, hold: 0.3 });
      const bp = mkFilter(ctx, g, 'bandpass', 500 * p.pitch, 0.9);
      sweep(bp.frequency, t0, 500 * p.pitch, t0 + 0.12, 2600 * p.pitch);
      bp.frequency.exponentialRampToValueAtTime(900 * p.pitch, t0 + 0.6);
      mkNoise(ctx, bp, t0, t0 + 0.7, { rand: p.rand });
      for (let i = 0; i < 3; i++) {
        const t = t0 + 0.2 + i * 0.11 + p.rand() * 0.06;
        const d = mkGain(ctx, dest, 0);
        perc(d.gain, t, 0.08 * p.gain, 0.08);
        const o = mkOsc(ctx, d, 'sine', (2200 + p.rand() * 1200) * p.pitch, t, t + 0.09);
        sweep(o.frequency, t, o.frequency.value, t + 0.07, o.frequency.value * 1.5);
      }
    },
  },
  bite: {
    dur: 0.22,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.35 * p.gain, dur: 0.035, type: 'highpass', freq: 1400 * p.pitch, rand: p.rand });
      burst(ctx, dest, t0 + 0.07, { gain: 0.28 * p.gain, dur: 0.05, type: 'bandpass', freq: 1900 * p.pitch, q: 0.6, rand: p.rand });
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.14 * p.gain, 0.07);
      mkOsc(ctx, mkFilter(ctx, g, 'lowpass', 700, 1), 'square', 150 * p.pitch, t0, t0 + 0.08);
      thump(ctx, dest, t0 + 0.07, 160 * p.pitch, 70 * p.pitch, 0.2 * p.gain, 0.09);
    },
  },
  catchFish: {
    dur: 0.9,
    play(ctx, dest, t0, p) {
      SFX.splash.play(ctx, dest, t0, { ...p, gain: p.gain * 0.6 });
      const notes = [587, 740, 880, 1175];
      notes.forEach((f, i) => ping(ctx, dest, t0 + 0.12 + i * 0.09, f * p.pitch, 0.24 * p.gain, 0.3 + i * 0.1, 'triangle'));
      burst(ctx, dest, t0 + 0.4, { gain: 0.08 * p.gain, dur: 0.35, type: 'highpass', freq: 6000, to: 9000, attack: 0.1, rand: p.rand });
    },
  },
  dig: {
    dur: 0.4,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.4 * p.gain, dur: 0.11, type: 'lowpass', freq: 1100 * p.pitch, to: 350 * p.pitch, q: 2, color: 'pink', rand: p.rand });
      thump(ctx, dest, t0, 120 * p.pitch, 55 * p.pitch, 0.25 * p.gain, 0.1);
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0 + 0.08, { a: 0.02, d: 0.2, s: 0.2, r: 0.1, peak: 0.2 * p.gain, hold: 0.18 });
      const trem = mkGain(ctx, g.gain, 0.08 * p.gain);
      mkOsc(ctx, trem, 'sine', 23, t0, t0 + 0.4);
      mkNoise(ctx, mkFilter(ctx, g, 'bandpass', 1500 * p.pitch, 1), t0 + 0.08, t0 + 0.4, { rand: p.rand });
    },
  },
  crack: {
    dur: 0.2,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.5 * p.gain, dur: 0.012, type: 'highpass', freq: 2000 * p.pitch, attack: 0.0005, rand: p.rand });
      burst(ctx, dest, t0 + 0.022, { gain: 0.3 * p.gain, dur: 0.01, type: 'highpass', freq: 3000 * p.pitch, attack: 0.0005, rand: p.rand });
      burst(ctx, dest, t0 + 0.05, { gain: 0.18 * p.gain, dur: 0.015, type: 'bandpass', freq: 2500 * p.pitch, q: 0.5, attack: 0.0005, rand: p.rand });
      thump(ctx, dest, t0, 210 * p.pitch, 85 * p.pitch, 0.22 * p.gain, 0.08);
    },
  },
  thwap: {
    dur: 0.26,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.22 * p.gain, dur: 0.005, type: 'highpass', freq: 3500, attack: 0.0005, rand: p.rand });
      burst(ctx, dest, t0, { gain: 0.45 * p.gain, dur: 0.065, type: 'bandpass', freq: 850 * p.pitch, to: 400 * p.pitch, q: 1.4, rand: p.rand });
      thump(ctx, dest, t0 + 0.004, 150 * p.pitch, 44 * p.pitch, 0.7 * p.gain, 0.17);
    },
  },
  bell: {
    dur: 2.6,
    play(ctx, dest, t0, p) {
      const f = 660 * p.pitch;
      partials(ctx, dest, t0, f, [
        [0.5, 0.2 * p.gain, 2.4], [1, 0.3 * p.gain, 2.2], [1.19, 0.16 * p.gain, 1.7], [1.5, 0.11 * p.gain, 1.5],
        [2.0, 0.12 * p.gain, 1.2], [2.51, 0.06 * p.gain, 0.9], [2.67, 0.05 * p.gain, 0.8], [4.07, 0.03 * p.gain, 0.5],
      ]);
      burst(ctx, dest, t0, { gain: 0.08 * p.gain, dur: 0.03, type: 'bandpass', freq: f * 3, q: 2, attack: 0.001, rand: p.rand });
    },
  },
  lantern: {
    dur: 0.8,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.1 * p.gain, dur: 0.012, type: 'highpass', freq: 2500, rand: p.rand });
      swell(ctx, dest, t0 + 0.01, { gain: 0.22 * p.gain, attack: 0.12, release: 0.2, freq: 200, peakFreq: 1400 * p.pitch, q: 1.2, rand: p.rand });
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0 + 0.08, { a: 0.1, d: 0.2, s: 0.5, r: 0.35, peak: 0.16 * p.gain, hold: 0.35 });
      const o = mkOsc(ctx, g, 'sine', 440 * p.pitch, t0 + 0.08, t0 + 0.8);
      const vib = mkGain(ctx, o.detune, 9);
      mkOsc(ctx, vib, 'sine', 6, t0, t0 + 0.8);
      ping(ctx, dest, t0 + 0.1, 1760 * p.pitch, 0.05 * p.gain, 0.4);
    },
  },
  capture: {
    dur: 1.5,
    play(ctx, dest, t0, p) {
      thump(ctx, dest, t0, 160 * p.pitch, 60 * p.pitch, 0.3 * p.gain, 0.12);
      [294, 440, 587].forEach((f, i) => INSTRUMENTS.pluck(ctx, dest, { freq: f * p.pitch, time: t0 + i * 0.09, dur: 0.3, vel: 0.9 * p.gain }));
      [587, 740, 880, 988].forEach((f, i) => INSTRUMENTS.glass(ctx, dest, { freq: f * p.pitch, time: t0 + 0.3 + i * 0.03, dur: 0.8, vel: 0.8 * p.gain }));
    },
  },
  captureFail: {
    dur: 0.6,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0, { a: 0.01, d: 0.1, s: 0.7, r: 0.12, peak: 0.26 * p.gain, hold: 0.36 });
      const o = mkOsc(ctx, mkFilter(ctx, g, 'lowpass', 2000, 0.8), 'triangle', 440 * p.pitch, t0, t0 + 0.5);
      sweep(o.frequency, t0, 440 * p.pitch, t0 + 0.42, 290 * p.pitch);
      const vib = mkGain(ctx, o.detune, 0);
      vib.gain.setValueAtTime(0, t0);
      vib.gain.linearRampToValueAtTime(45, t0 + 0.4);
      mkOsc(ctx, vib, 'sine', 11, t0, t0 + 0.5);
      burst(ctx, dest, t0 + 0.42, { gain: 0.14 * p.gain, dur: 0.15, type: 'lowpass', freq: 1200, to: 300, color: 'pink', attack: 0.01, rand: p.rand });
    },
  },
};

Object.assign(SFX, {
  hit: {
    dur: 0.2,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.4 * p.gain, dur: 0.09, type: 'lowpass', freq: 2400 * p.pitch, to: 500 * p.pitch, q: 1, rand: p.rand });
      thump(ctx, dest, t0, 210 * p.pitch, 60 * p.pitch, 0.45 * p.gain, 0.12);
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.14 * p.gain, 0.045);
      mkOsc(ctx, mkFilter(ctx, g, 'lowpass', 1500, 1), 'square', 330 * p.pitch, t0, t0 + 0.05);
    },
  },
  hitStrong: {
    dur: 0.5,
    play(ctx, dest, t0, p) {
      SFX.hit.play(ctx, dest, t0, p);
      thump(ctx, dest, t0 + 0.005, 95 * p.pitch, 34 * p.pitch, 0.6 * p.gain, 0.38);
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.2 * p.gain, 0.1);
      mkOsc(ctx, mkFilter(ctx, g, 'lowpass', 450, 2), 'sawtooth', 110 * p.pitch, t0, t0 + 0.11);
      burst(ctx, dest, t0 + 0.02, { gain: 0.15 * p.gain, dur: 0.25, type: 'bandpass', freq: 700, to: 250, q: 0.8, color: 'brown', rand: p.rand });
    },
  },
  hitWeak: {
    dur: 0.12,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.22 * p.gain, dur: 0.05, type: 'highpass', freq: 1800 * p.pitch, rand: p.rand });
      thump(ctx, dest, t0, 520 * p.pitch, 280 * p.pitch, 0.22 * p.gain, 0.07);
    },
  },
  blocked: {
    dur: 0.35,
    play(ctx, dest, t0, p) {
      partials(ctx, dest, t0, 880 * p.pitch, [[1, 0.22 * p.gain, 0.25], [1.5, 0.14 * p.gain, 0.2], [2.31, 0.1 * p.gain, 0.14], [3.7, 0.05 * p.gain, 0.08]], 0.001);
      thump(ctx, dest, t0, 160 * p.pitch, 80 * p.pitch, 0.25 * p.gain, 0.08);
      burst(ctx, dest, t0, { gain: 0.15 * p.gain, dur: 0.02, type: 'highpass', freq: 3000, rand: p.rand });
    },
  },
  heal: {
    dur: 1.0,
    play(ctx, dest, t0, p) {
      [587, 740, 880, 1175].forEach((f, i) => INSTRUMENTS.pluck(ctx, dest, { freq: f * p.pitch, time: t0 + i * 0.09, dur: 0.5, vel: 0.7 * p.gain }));
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0, { a: 0.25, d: 0.2, s: 0.6, r: 0.4, peak: 0.1 * p.gain, hold: 0.45 });
      const lp = mkFilter(ctx, g, 'lowpass', 1200, 0.7);
      mkOsc(ctx, lp, 'triangle', 294 * p.pitch, t0, t0 + 1.0);
      mkOsc(ctx, lp, 'triangle', 440 * p.pitch, t0, t0 + 1.0, 5);
    },
  },
  levelUp: {
    dur: 1.6,
    play(ctx, dest, t0, p) {
      [294, 370, 440, 587, 740, 880].forEach((f, i) => ping(ctx, dest, t0 + i * 0.06, f * p.pitch, 0.22 * p.gain, 0.22, 'triangle'));
      [587, 880, 1175].forEach((f) => INSTRUMENTS.glass(ctx, dest, { freq: f * p.pitch, time: t0 + 0.38, dur: 1.0, vel: 0.9 * p.gain }));
      INSTRUMENTS.bass(ctx, dest, { freq: 147 * p.pitch, time: t0 + 0.38, dur: 0.5, vel: 0.5 * p.gain });
      burst(ctx, dest, t0 + 0.38, { gain: 0.07 * p.gain, dur: 0.6, type: 'highpass', freq: 5000, to: 10000, attack: 0.15, rand: p.rand });
    },
  },
  shiftFlip: {
    dur: 0.3,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0, { a: 0.06, d: 0.08, s: 0.6, r: 0.08, peak: 0.3 * p.gain, hold: 0.14 });
      const bp = mkFilter(ctx, g, 'bandpass', 600 * p.pitch, 1.5);
      bp.frequency.setValueAtTime(600 * p.pitch, t0);
      bp.frequency.exponentialRampToValueAtTime(3200 * p.pitch, t0 + 0.11);
      bp.frequency.exponentialRampToValueAtTime(700 * p.pitch, t0 + 0.24);
      mkNoise(ctx, bp, t0, t0 + 0.25, { rand: p.rand });
      burst(ctx, dest, t0 + 0.11, { gain: 0.25 * p.gain, dur: 0.012, type: 'highpass', freq: 2500, attack: 0.0005, rand: p.rand });
      const t = mkGain(ctx, dest, 0);
      perc(t.gain, t0 + 0.04, 0.16 * p.gain, 0.2);
      const o = mkOsc(ctx, t, 'triangle', 300 * p.pitch, t0 + 0.04, t0 + 0.25);
      sweep(o.frequency, t0 + 0.04, 300 * p.pitch, t0 + 0.22, 640 * p.pitch);
    },
  },
  shiftReveal: {
    dur: 1.9,
    play(ctx, dest, t0, p) {
      [587, 740, 880, 1175, 1480, 1760].forEach((f, i) => INSTRUMENTS.glass(ctx, dest, { freq: f * p.pitch, time: t0 + i * 0.07, dur: 1.0 - i * 0.06, vel: (0.85 - i * 0.06) * p.gain }));
      const root = mkGain(ctx, dest, 0);
      adsr(root.gain, t0, { a: 0.3, d: 0.3, s: 0.6, r: 0.6, peak: 0.13 * p.gain, hold: 0.6 });
      mkOsc(ctx, root, 'sine', 147 * p.pitch, t0, t0 + 1.6);
      burst(ctx, dest, t0 + 0.2, { gain: 0.06 * p.gain, dur: 0.9, type: 'highpass', freq: 6000, to: 11000, attack: 0.3, rand: p.rand });
    },
  },
  letter: {
    dur: 0.9,
    play(ctx, dest, t0, p) {
      for (const [at, len] of [[0, 0.13], [0.11, 0.1]]) {
        const g = mkGain(ctx, dest, 0);
        adsr(g.gain, t0 + at, { a: 0.02, d: 0.04, s: 0.7, r: 0.06, peak: 0.2 * p.gain, hold: len });
        const trem = mkGain(ctx, g.gain, 0.1 * p.gain);
        mkOsc(ctx, trem, 'sine', 37, t0 + at, t0 + at + len + 0.08);
        mkNoise(ctx, mkFilter(ctx, g, 'bandpass', 2600, 0.7), t0 + at, t0 + at + len + 0.08, { rand: p.rand });
      }
      ping(ctx, dest, t0 + 0.17, 1760 * p.pitch, 0.12 * p.gain, 0.6);
      ping(ctx, dest, t0 + 0.24, 2637 * p.pitch, 0.08 * p.gain, 0.6);
    },
  },
  doorOpen: {
    dur: 0.55,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.2 * p.gain, dur: 0.02, type: 'bandpass', freq: 2200, q: 1.5, rand: p.rand });
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0 + 0.03, { a: 0.05, d: 0.1, s: 0.75, r: 0.1, peak: 0.16 * p.gain, hold: 0.3 });
      const lp = mkFilter(ctx, g, 'lowpass', 520, 3);
      const o = mkOsc(ctx, lp, 'sawtooth', 68 * p.pitch, t0 + 0.03, t0 + 0.45);
      sweep(o.frequency, t0 + 0.03, 68 * p.pitch, t0 + 0.38, 98 * p.pitch);
      const wob = mkGain(ctx, o.detune, 25);
      mkOsc(ctx, wob, 'sine', 14, t0, t0 + 0.45);
      thump(ctx, dest, t0 + 0.4, 170 * p.pitch, 90 * p.pitch, 0.2 * p.gain, 0.09);
      burst(ctx, dest, t0 + 0.4, { gain: 0.1 * p.gain, dur: 0.03, type: 'lowpass', freq: 1200, color: 'brown', rand: p.rand });
    },
  },
  textTick: {
    dur: 0.04,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.2 * p.gain, 0.028, 0.001);
      mkOsc(ctx, g, 'triangle', 1250 * p.pitch, t0, t0 + 0.03);
    },
  },
  toast: {
    dur: 0.35,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.26 * p.gain, 0.16);
      const o = mkOsc(ctx, g, 'sine', 520 * p.pitch, t0, t0 + 0.16);
      sweep(o.frequency, t0, 520 * p.pitch, t0 + 0.1, 780 * p.pitch);
      ping(ctx, dest, t0 + 0.1, 1040 * p.pitch, 0.18 * p.gain, 0.25, 'triangle');
    },
  },
  wave: {
    dur: 2.8,
    play(ctx, dest, t0, p) {
      swell(ctx, dest, t0, { gain: 0.3 * p.gain, attack: 0.9, release: 1.5, freq: 300 * p.pitch, peakFreq: 1600 * p.pitch, q: 0.7, rand: p.rand });
      swell(ctx, dest, t0 + 0.2, { gain: 0.22 * p.gain, attack: 0.7, release: 1.6, freq: 120, peakFreq: 500, q: 0.6, color: 'brown', rand: p.rand });
      swell(ctx, dest, t0 + 1.0, { gain: 0.12 * p.gain, attack: 0.3, release: 1.2, freq: 1500 * p.pitch, peakFreq: 4500 * p.pitch, q: 0.5, type: 'bandpass', color: 'white', rand: p.rand });
    },
  },
  rain: {
    dur: 2.6,
    play(ctx, dest, t0, p) {
      const bed = mkGain(ctx, dest, 0);
      adsr(bed.gain, t0, { a: 0.3, d: 0.1, s: 1, r: 0.6, peak: 0.16 * p.gain, hold: 1.9 });
      mkNoise(ctx, mkFilter(ctx, bed, 'bandpass', 4200 * p.pitch, 0.5), t0, t0 + 2.6, { rand: p.rand });
      const low = mkGain(ctx, dest, 0);
      adsr(low.gain, t0, { a: 0.4, d: 0.1, s: 1, r: 0.7, peak: 0.12 * p.gain, hold: 1.8 });
      mkNoise(ctx, mkFilter(ctx, low, 'lowpass', 900, 0.6), t0, t0 + 2.6, { color: 'pink', rand: p.rand });
      for (let i = 0; i < 14; i++) {
        const t = t0 + 0.15 + p.rand() * 2.1;
        burst(ctx, dest, t, { gain: (0.05 + 0.07 * p.rand()) * p.gain, dur: 0.02 + 0.02 * p.rand(), type: 'bandpass', freq: (3000 + 5000 * p.rand()) * p.pitch, q: 3, attack: 0.001, rand: p.rand });
      }
    },
  },
  thunder: {
    dur: 3.0,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.55 * p.gain, dur: 0.18, type: 'highpass', freq: 300 * p.pitch, to: 120, q: 0.6, attack: 0.004, rand: p.rand });
      const g = mkGain(ctx, dest, 0);
      g.gain.setValueAtTime(EPS, t0);
      g.gain.linearRampToValueAtTime(0.5 * p.gain, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.22 * p.gain, t0 + 0.6);
      g.gain.linearRampToValueAtTime(0.4 * p.gain, t0 + 1.0);
      g.gain.exponentialRampToValueAtTime(0.15 * p.gain, t0 + 1.7);
      g.gain.linearRampToValueAtTime(0.25 * p.gain, t0 + 2.0);
      g.gain.exponentialRampToValueAtTime(EPS, t0 + 2.9);
      const lp = mkFilter(ctx, g, 'lowpass', 140 * p.pitch, 1.1);
      sweep(lp.frequency, t0, 140 * p.pitch, t0 + 2.5, 55 * p.pitch);
      mkNoise(ctx, lp, t0, t0 + 2.95, { color: 'brown', rand: p.rand });
    },
  },
  firefly: {
    dur: 0.45,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      adsr(g.gain, t0, { a: 0.04, d: 0.1, s: 0.5, r: 0.2, peak: 0.14 * p.gain, hold: 0.2 });
      const trem = mkGain(ctx, g.gain, 0.06 * p.gain);
      mkOsc(ctx, trem, 'sine', 19, t0, t0 + 0.45);
      mkOsc(ctx, g, 'sine', 2100 * p.pitch, t0, t0 + 0.45);
      ping(ctx, dest, t0 + 0.02, 3150 * p.pitch, 0.04 * p.gain, 0.35);
    },
  },
  night: {
    dur: 2.6,
    play(ctx, dest, t0, p) {
      const pad = mkGain(ctx, dest, 0);
      adsr(pad.gain, t0, { a: 0.9, d: 0.3, s: 0.8, r: 0.9, peak: 0.16 * p.gain, hold: 1.4 });
      const lp = mkFilter(ctx, pad, 'lowpass', 500, 0.7);
      mkOsc(ctx, lp, 'triangle', 73.4 * p.pitch, t0, t0 + 2.6);
      mkOsc(ctx, lp, 'sine', 110 * p.pitch, t0, t0 + 2.6, 4);
      for (let i = 0; i < 3; i++) {
        const t = t0 + 0.4 + i * 0.55 + p.rand() * 0.15;
        const g = mkGain(ctx, dest, 0);
        adsr(g.gain, t, { a: 0.02, d: 0.05, s: 0.8, r: 0.08, peak: 0.07 * p.gain, hold: 0.26 });
        const am = mkGain(ctx, g.gain, 0.06 * p.gain);
        mkOsc(ctx, am, 'sine', 42, t, t + 0.4);
        mkOsc(ctx, g, 'sine', 4300 * p.pitch, t, t + 0.4);
      }
      for (const at of [1.5, 1.78]) {
        const g = mkGain(ctx, dest, 0);
        adsr(g.gain, t0 + at, { a: 0.05, d: 0.05, s: 0.8, r: 0.12, peak: 0.11 * p.gain, hold: 0.16 });
        mkOsc(ctx, mkFilter(ctx, g, 'lowpass', 900, 0.7), 'sine', 330 * p.pitch, t0 + at, t0 + at + 0.35);
      }
    },
  },
  dawn: {
    dur: 2.6,
    play(ctx, dest, t0, p) {
      [294, 370, 440, 587].forEach((f, i) => {
        const g = mkGain(ctx, dest, 0);
        adsr(g.gain, t0 + i * 0.25, { a: 0.7, d: 0.3, s: 0.8, r: 0.9, peak: 0.07 * p.gain, hold: 1.0 });
        const lp = mkFilter(ctx, g, 'lowpass', 1800, 0.6);
        mkOsc(ctx, lp, 'sawtooth', f * p.pitch, t0 + i * 0.25, t0 + 2.6, -5);
        mkOsc(ctx, lp, 'triangle', f * p.pitch, t0 + i * 0.25, t0 + 2.6, 5);
      });
      for (let i = 0; i < 3; i++) {
        const t = t0 + 0.9 + i * 0.22 + p.rand() * 0.05;
        const g = mkGain(ctx, dest, 0);
        perc(g.gain, t, 0.09 * p.gain, 0.14, 0.01);
        const o = mkOsc(ctx, g, 'sine', 2600 * p.pitch, t, t + 0.15);
        sweep(o.frequency, t, 2600 * p.pitch, t + 0.06, (3400 + 400 * p.rand()) * p.pitch);
        o.frequency.exponentialRampToValueAtTime(2900 * p.pitch, t + 0.13);
      }
      burst(ctx, dest, t0 + 0.5, { gain: 0.05 * p.gain, dur: 1.6, type: 'highpass', freq: 7000, attack: 0.6, rand: p.rand });
    },
  },
  stamp: {
    dur: 0.25,
    play(ctx, dest, t0, p) {
      burst(ctx, dest, t0, { gain: 0.35 * p.gain, dur: 0.06, type: 'lowpass', freq: 350, color: 'brown', rand: p.rand });
      thump(ctx, dest, t0, 150 * p.pitch, 70 * p.pitch, 0.5 * p.gain, 0.1);
      burst(ctx, dest, t0 + 0.09, { gain: 0.2 * p.gain, dur: 0.012, type: 'highpass', freq: 2500, attack: 0.0005, rand: p.rand });
    },
  },
  achievement: {
    dur: 2.0,
    play(ctx, dest, t0, p) {
      const chords = [[587, 740, 880], [659, 880, 1109], [740, 880, 1175, 1480]];
      chords.forEach((c, i) => c.forEach((f) => INSTRUMENTS.bell(ctx, dest, { freq: f * p.pitch, time: t0 + i * 0.22, dur: 0.6, vel: (0.5 + 0.12 * i) * p.gain })));
      thump(ctx, dest, t0, 120 * p.pitch, 50 * p.pitch, 0.3 * p.gain, 0.2);
      INSTRUMENTS.bass(ctx, dest, { freq: 147 * p.pitch, time: t0 + 0.44, dur: 0.7, vel: 0.5 * p.gain });
      burst(ctx, dest, t0 + 0.44, { gain: 0.07 * p.gain, dur: 0.9, type: 'highpass', freq: 5000, to: 12000, attack: 0.2, rand: p.rand });
    },
  },
});

/** Alternative names accepted by `sfx()`. */
const SFX_ALIASES = Object.freeze({ tailSlap: 'thwap', select: 'confirm', back: 'cancel', type: 'textTick', shift: 'shiftFlip' });

/** Names of every synthesized sound effect, in bank order. */
export const SFX_NAMES = Object.freeze(Object.keys(SFX));

/**
 * Nominal duration of a sound effect in seconds (`null` for unknown names).
 * @param {string} name
 * @returns {number|null}
 */
export function sfxDuration(name) {
  const def = SFX[SFX_ALIASES[name] ?? name];
  return def ? def.dur : null;
}

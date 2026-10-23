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
 *
 * Beyond the contract: a `kit` preset (one drum layer, GM-style notes pick kick/snare/hat), `rhodes`
 * and `brass` presets, scale-name aliases (`majorPentatonic`), prefix stems (`setStem('perc', on)`
 * covers `perc.kick`, `perc.hat`, …; any layer can be toggled, not only ones flagged `stem: true`),
 * one-shot tracks (`loop: false`) and offline renders (`renderSfx`, `renderTrack`) for level checks.
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

/** Alternative scale names accepted wherever a scale is named (resolved by {@link resolveScale}). */
export const SCALE_ALIASES = Object.freeze({
  ionian: 'major', aeolian: 'minor', naturalMinor: 'minor', majorPentatonic: 'pentatonic',
  'major-pentatonic': 'pentatonic', 'minor-pentatonic': 'minorPentatonic', 'harmonic-minor': 'harmonicMinor',
  'whole-tone': 'wholeTone',
});

/**
 * Canonical name of a scale given its name or an alias; `null` when unknown.
 * @param {unknown} name
 * @returns {string|null}
 */
export function resolveScale(name) {
  if (typeof name !== 'string') return null;
  if (Object.hasOwn(SCALES, name)) return name;
  return lookup(SCALE_ALIASES, name) ?? null;
}

/**
 * Semitone set of a scale (alias-aware).
 * @param {string} scale
 * @param {string} [caller='scaleIntervals'] Name used in the error message.
 * @returns {readonly number[]}
 * @throws {RangeError} For unknown scales.
 */
export function scaleIntervals(scale, caller = 'scaleIntervals') {
  const canon = resolveScale(scale);
  if (!canon) throw new RangeError(`${caller}: unknown scale "${String(scale)}"`);
  return SCALES[canon];
}

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
 * Coerce to a finite number, falling back when the input is missing, blank, non-numeric or infinite.
 * @param {unknown} v
 * @param {number} fallback
 * @returns {number}
 */
export function num(v, fallback) {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Own-property lookup that ignores prototype keys such as `"constructor"` or `"__proto__"`.
 * @template T
 * @param {Record<string, T>} table
 * @param {unknown} key
 * @returns {T|undefined}
 */
function lookup(table, key) {
  return typeof key === 'string' && Object.hasOwn(table, key) ? table[key] : undefined;
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
  const iv = scaleIntervals(scale, 'scaleNotes');
  const out = [];
  const n = Math.min(Math.max(0, Math.trunc(num(octaves, 1))), 64);
  for (let o = 0; o < n; o++) for (const s of iv) out.push(root + 12 * o + s);
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
  const iv = scaleIntervals(scale, 'degreeToMidi');
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
  const iv = scaleIntervals(scale, 'quantizeToScale');
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
  const shape = lookup(CHORDS, type);
  if (!shape) throw new RangeError(`chord: unknown chord type "${String(type)}"`);
  const notes = shape.map((s) => root + s + 12 * num(octave, 0));
  const inv = clamp(Math.trunc(num(inversion, 0)), 0, notes.length - 1);
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
  const len = Math.max(2, Math.trunc(num(n, 2)));
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
  if (!(bpm > 0) || !(stepsPerBeat > 0) || !Number.isFinite(Number(bpm)) || !Number.isFinite(Number(stepsPerBeat))) {
    throw new RangeError('stepSeconds: bpm and stepsPerBeat must be finite and > 0');
  }
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
      else if (x.trim() !== '' && Number.isFinite(Number(x))) out.push(Number(x));
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

/** Drum letters accepted by {@link parseStepString} (GM notes; upper case = accent). */
const STEP_DRUMS = Object.freeze({ k: 36, s: 38, h: 42 });

/**
 * Parse a drum-style step string into pattern events, one character per step: `x` hit, `X` accent,
 * `o` soft, `k`/`s`/`h` kick/snare/hat (upper case accents; meant for `kit` layers), anything else
 * (`.`, `-`, `_`) a rest. Whitespace and `|` bar separators are ignored.
 * @param {string} str e.g. `"x...x...x...x..."` or `"k.h.s.h.k.h.s.h."`
 * @param {{note?: number, vel?: number}} [opts]
 * @returns {PatternEvent[]}
 */
export function parseStepString(str, { note = 60, vel = 0.8 } = {}) {
  if (typeof str !== 'string') throw new TypeError('parseStepString: expected a string');
  const out = [];
  let step = 0;
  for (const ch of str) {
    if (ch === '|' || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') continue;
    const drum = STEP_DRUMS[ch.toLowerCase()];
    if (ch === 'x') out.push({ t: step, n: note, d: 1, v: vel });
    else if (ch === 'X') out.push({ t: step, n: note, d: 1, v: 1 });
    else if (ch === 'o') out.push({ t: step, n: note, d: 1, v: vel * 0.55 });
    else if (drum !== undefined) out.push({ t: step, n: drum, d: 1, v: ch === ch.toLowerCase() ? vel : 1 });
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
      if (!Number.isFinite(horizon) || !(horizon > timeOf(next))) return out;
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

/** Instrument preset names available to sequencer layers (the contract's ten plus `kit`, `rhodes`, `brass`). */
export const INSTRUMENT_NAMES = Object.freeze(['pluck', 'pad', 'bass', 'bell', 'flute', 'kick', 'hat', 'snare', 'marimba', 'glass', 'kit', 'rhodes', 'brass']);

/** Presets that are unpitched drums: no timing humanization, pitch picks the voice/tuning only. */
const DRUM_INSTRUMENTS = new Set(['kick', 'hat', 'snare', 'kit']);

/** Default MIDI note per instrument when a pattern event omits `n` (drums ignore pitch mostly). */
const DEFAULT_NOTES = Object.freeze({ kick: 36, hat: 42, snare: 38, kit: 36 });

/** Layer-name → instrument guesses for the shorthand `layers: {name: pattern}` form. */
const LAYER_ALIASES = Object.freeze({
  melody: 'marimba', lead: 'pluck', arp: 'pluck', chords: 'pad', drums: 'kit', perc: 'kit', shaker: 'hat',
  hihat: 'hat', rim: 'snare', night: 'glass', tide: 'flute', rain: 'glass', battle: 'snare', tense: 'glass',
  keys: 'rhodes', piano: 'rhodes', horns: 'brass',
});

/**
 * Layer names that are stems (start muted, toggled with `setStem`) unless the layer says otherwise.
 * Matches the contract's examples; a dotted suffix (`night.bells`) counts too.
 */
const DEFAULT_STEM_NAMES = Object.freeze(['night', 'tide', 'rain', 'battle', 'tense', 'storm']);

/**
 * Whether a layer name is a stem by default (see {@link DEFAULT_STEM_NAMES}).
 * @param {string} name
 * @returns {boolean}
 */
export function isDefaultStemName(name) {
  const n = String(name).toLowerCase();
  return DEFAULT_STEM_NAMES.some((s) => n === s || n.startsWith(`${s}.`));
}

/**
 * Infer an instrument for a layer from its name: an exact preset name, a known alias, the last
 * dotted segment (`perc.kick` → `kick`), else `pluck`.
 * @param {string} name
 * @returns {string} A member of {@link INSTRUMENT_NAMES}.
 */
export function inferInstrument(name) {
  const n = String(name).toLowerCase();
  if (INSTRUMENT_NAMES.includes(n)) return n;
  const alias = lookup(LAYER_ALIASES, n);
  if (alias) return alias;
  const dot = n.lastIndexOf('.');
  if (dot >= 0) return inferInstrument(n.slice(dot + 1));
  return 'pluck';
}

/**
 * Map a General-MIDI-style drum note to a kit voice, so one `kit` layer can hold a whole drum part:
 * ≤36 kick, 37 rim (quiet snare), 38–40 snare, 41–50 toms (kicks tuned by the note), 42/44 closed
 * hat, everything else (46 open hat, cymbals) a long hat.
 * @param {number} midi
 * @returns {{inst: 'kick'|'snare'|'hat', vel: number, dur: number}} Preset plus velocity and
 *   duration multipliers.
 */
export function kitVoice(midi) {
  const n = Math.round(num(midi, 36));
  if (n <= 36) return { inst: 'kick', vel: 1, dur: 1 };
  if (n === 37) return { inst: 'snare', vel: 0.6, dur: 1 };
  if (n <= 40) return { inst: 'snare', vel: 1, dur: 1 };
  if (n === 42 || n === 44) return { inst: 'hat', vel: 1, dur: 1 };
  if (n <= 50 && n !== 46 && n !== 49) return { inst: 'kick', vel: 0.9, dur: 1 };
  return { inst: 'hat', vel: 0.9, dur: 3 };
}

/**
 * Resolve whether a layer is on. `overrides` maps stem names to booleans (what `setStem` recorded);
 * an exact layer-name entry wins, then the longest dotted prefix (`'perc'` covers `'perc.kick'`),
 * then `defaultOn`.
 * @param {string} layerName
 * @param {Map<string, boolean>|Record<string, boolean>|null|undefined} overrides
 * @param {boolean} defaultOn
 * @returns {boolean}
 */
export function resolveStem(layerName, overrides, defaultOn) {
  if (!overrides) return defaultOn;
  const get = overrides instanceof Map ? (k) => overrides.get(k) : (k) => lookup(overrides, k);
  const name = String(layerName);
  let v = get(name);
  if (v !== undefined) return Boolean(v);
  for (let i = name.lastIndexOf('.'); i > 0; i = name.lastIndexOf('.', i - 1)) {
    v = get(name.slice(0, i));
    if (v !== undefined) return Boolean(v);
  }
  return defaultOn;
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
 * @property {boolean} loop False for one-shot tracks (stings) that play once and end.
 * @property {TrackLayer[]} layers
 */

/**
 * Validate and normalize a track definition. Layers may be given as a bare pattern array
 * (instrument inferred from the layer name, and names like `night`/`tide`/`rain`/`battle` become
 * stems) or as `{inst, pattern, gain, stem, minIntensity, pan, humanize}` where `pattern` is an
 * event array or a drum step string. Scale names may be aliases (`majorPentatonic`).
 * @param {string} id
 * @param {{bpm: number, key?: string, scale?: string, bars?: number, beatsPerBar?: number,
 *   stepsPerBar?: number, swing?: number, loop?: boolean,
 *   layers: Record<string, PatternEvent[]|string|object>}} def
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
  const scaleName = def.scale === undefined ? 'major' : String(def.scale);
  const scale = resolveScale(scaleName);
  if (!scale) throw new RangeError(`normalizeTrack(${id}): unknown scale "${scaleName}"`);
  if (!def.layers || typeof def.layers !== 'object') throw new TypeError(`normalizeTrack(${id}): layers must be an object`);
  const loop = def.loop === undefined ? true : Boolean(def.loop);
  const loopSteps = bars * stepsPerBar;
  const layers = [];
  for (const [name, raw] of Object.entries(def.layers)) {
    const spec = Array.isArray(raw) || typeof raw === 'string' ? { pattern: raw } : raw;
    if (!spec || typeof spec !== 'object') throw new TypeError(`normalizeTrack(${id}): layer "${name}" is malformed`);
    const inst = spec.inst === undefined ? inferInstrument(name) : String(spec.inst);
    if (!INSTRUMENT_NAMES.includes(inst)) throw new RangeError(`normalizeTrack(${id}): layer "${name}" uses unknown instrument "${inst}"`);
    const defaultNote = lookup(DEFAULT_NOTES, inst) ?? 60;
    const pattern = typeof spec.pattern === 'string' ? parseStepString(spec.pattern, { note: defaultNote }) : spec.pattern;
    if (!Array.isArray(pattern)) throw new TypeError(`normalizeTrack(${id}): layer "${name}" needs a pattern array or step string`);
    const events = expandPattern(pattern, { loopSteps, defaultNote });
    layers.push({
      name,
      inst,
      gain: clamp(num(spec.gain, 1), 0, 2),
      stem: spec.stem === undefined ? isDefaultStemName(name) : Boolean(spec.stem),
      minIntensity: clamp(num(spec.minIntensity, 0), 0, 1),
      pan: clamp(num(spec.pan, 0), -1, 1),
      humanize: clamp(num(spec.humanize, 0.5), 0, 1),
      events,
      buckets: bucketEvents(events),
    });
  }
  return {
    id, bpm, key, root, scale, bars, beatsPerBar, stepsPerBar,
    stepsPerBeat: stepsPerBar / beatsPerBar, loopSteps,
    swing: clamp(num(def.swing, 0), 0, 1), loop, layers,
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
 * @property {number} [midi] MIDI note (drum kits pick their voice from it).
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
  kit(ctx, dest, note) {
    const voice = kitVoice(note.midi ?? freqToMidi(note.freq));
    INSTRUMENTS[voice.inst](ctx, dest, { ...note, vel: note.vel * voice.vel, dur: note.dur * voice.dur });
  },
  rhodes(ctx, dest, { freq, time, dur, vel }) {
    const len = clamp(dur * 1.5, 0.6, 2.5);
    const amp = mkGain(ctx, dest, 0);
    const end = adsr(amp.gain, time, { a: 0.004, d: len * 0.6, s: 0.22, r: 0.3, peak: 0.3 * vel, hold: dur });
    const lp = mkFilter(ctx, amp, 'lowpass', clamp(freq * 3 + 2500 * vel * vel, 500, 7000), 0.6);
    mkOsc(ctx, lp, 'sine', freq, time, end);
    const body = mkGain(ctx, lp, 0.35);
    mkOsc(ctx, body, 'triangle', freq, time, end, 3);
    const tine = mkGain(ctx, lp, 0);
    perc(tine.gain, time, 0.16 * vel * vel, clamp(len * 0.25, 0.12, 0.5), 0.002);
    mkOsc(ctx, tine, 'sine', freq * 4, time, time + 0.6);
    const bark = mkGain(ctx, lp, 0);
    perc(bark.gain, time, 0.08 * vel, 0.05, 0.001);
    mkOsc(ctx, bark, 'sine', freq * 2, time, time + 0.08);
  },
  brass(ctx, dest, { freq, time, dur, vel }) {
    const amp = mkGain(ctx, dest, 0);
    const end = adsr(amp.gain, time, { a: 0.05, d: 0.12, s: 0.75, r: 0.18, peak: 0.17 * vel, hold: dur });
    const lp = mkFilter(ctx, amp, 'lowpass', clamp(freq * 2, 200, 4000), 1.2);
    lp.frequency.setValueAtTime(clamp(freq * 1.2, 120, 2000), time);
    lp.frequency.exponentialRampToValueAtTime(clamp(freq * (2.5 + 4 * vel), 300, 8000), time + 0.08);
    lp.frequency.exponentialRampToValueAtTime(clamp(freq * 2.2, 250, 5000), time + 0.4);
    const o1 = mkOsc(ctx, lp, 'sawtooth', freq, time, end, -5);
    const o2 = mkOsc(ctx, lp, 'sawtooth', freq, time, end, 5);
    const vib = mkGain(ctx, o1.detune, 0);
    vib.connect(o2.detune);
    vib.gain.setValueAtTime(0, time);
    vib.gain.linearRampToValueAtTime(5, time + 0.3);
    mkOsc(ctx, vib, 'sine', 5.5, time, end);
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
  const fn = lookup(INSTRUMENTS, inst);
  if (!fn) throw new RangeError(`playNote: unknown instrument "${String(inst)}"`);
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
        const f0 = (2200 + p.rand() * 1200) * p.pitch;
        const o = mkOsc(ctx, d, 'sine', f0, t, t + 0.09);
        sweep(o.frequency, t, f0, t + 0.07, f0 * 1.5);
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
    dur: 0.05,
    play(ctx, dest, t0, p) {
      const g = mkGain(ctx, dest, 0);
      perc(g.gain, t0, 0.3 * p.gain, 0.036, 0.001);
      mkOsc(ctx, g, 'triangle', 1250 * p.pitch, t0, t0 + 0.04);
      burst(ctx, dest, t0, { gain: 0.12 * p.gain, dur: 0.008, type: 'highpass', freq: 3000, attack: 0.0005, rand: p.rand });
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
  const def = lookup(SFX, lookup(SFX_ALIASES, name) ?? name);
  return def ? def.dur : null;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Demo track: "Harbor Lights" — 92 bpm, D major, 8 bars (I–V–vi–IV, two bars each).
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** Id under which {@link DEMO_TRACK} is pre-registered by {@link createAudio}. */
export const DEMO_TRACK_ID = 'harbor';

/**
 * Build the demo track definition (pure data; the composer's reference for the hourly themes).
 * @returns {{bpm: number, key: string, scale: string, bars: number, swing: number,
 *   layers: Record<string, object>}}
 */
export function buildDemoTrack() {
  // Per two-bar block: [root, fifth, approach note] for the plucked bass.
  const bassBlocks = [[38, 45, 43], [45, 40, 45], [47, 42, 45], [43, 38, 45]];
  const bass = [];
  bassBlocks.forEach(([r, f, ap], i) => {
    const o = i * 32;
    bass.push(
      { t: o, n: r, d: 6, v: 0.9 }, { t: o + 6, n: r, d: 2, v: 0.55 }, { t: o + 8, n: f, d: 4, v: 0.7 },
      { t: o + 14, n: r, d: 2, v: 0.5 }, { t: o + 16, n: r, d: 6, v: 0.85 }, { t: o + 22, n: r, d: 2, v: 0.5 },
      { t: o + 24, n: f, d: 4, v: 0.7 }, { t: o + 28, n: ap, d: 4, v: 0.6 },
    );
  });
  const melody = [
    { t: 0, n: 'A4', d: 2, v: 0.8 }, { t: 4, n: 'F#4', d: 2, v: 0.7 }, { t: 6, n: 'D4', d: 2, v: 0.65 }, { t: 8, n: 'E4', d: 4, v: 0.75 }, { t: 14, n: 'F#4', d: 2, v: 0.6 },
    { t: 16, n: 'A4', d: 4, v: 0.8 }, { t: 22, n: 'B4', d: 2, v: 0.7 }, { t: 24, n: 'A4', d: 2, v: 0.7 }, { t: 28, n: 'F#4', d: 4, v: 0.65 },
    { t: 32, n: 'E4', d: 2, v: 0.75 }, { t: 36, n: 'C#5', d: 2, v: 0.7 }, { t: 38, n: 'A4', d: 2, v: 0.65 }, { t: 40, n: 'B4', d: 4, v: 0.75 }, { t: 46, n: 'A4', d: 2, v: 0.6 },
    { t: 48, n: 'E5', d: 4, v: 0.85 }, { t: 54, n: 'D5', d: 2, v: 0.7 }, { t: 56, n: 'C#5', d: 2, v: 0.7 }, { t: 60, n: 'A4', d: 4, v: 0.65 },
    { t: 64, n: 'F#4', d: 2, v: 0.75 }, { t: 68, n: 'D4', d: 2, v: 0.65 }, { t: 70, n: 'B4', d: 2, v: 0.7 }, { t: 72, n: 'F#4', d: 4, v: 0.7 }, { t: 78, n: 'E4', d: 2, v: 0.6 },
    { t: 80, n: 'D4', d: 4, v: 0.75 }, { t: 86, n: 'F#4', d: 2, v: 0.65 }, { t: 88, n: 'B4', d: 2, v: 0.7 }, { t: 92, n: 'D5', d: 4, v: 0.8 },
    { t: 96, n: 'B4', d: 2, v: 0.8 }, { t: 100, n: 'G4', d: 2, v: 0.7 }, { t: 102, n: 'D5', d: 2, v: 0.7 }, { t: 104, n: 'B4', d: 4, v: 0.75 }, { t: 110, n: 'A4', d: 2, v: 0.6 },
    { t: 112, n: 'G4', d: 4, v: 0.75 }, { t: 118, n: 'F#4', d: 2, v: 0.65 }, { t: 120, n: 'E4', d: 2, v: 0.65 }, { t: 124, n: 'D4', d: 4, v: 0.7 },
  ];
  const padChords = [['D3', 'F#3', 'A3', 'E4'], ['A2', 'E3', 'A3', 'C#4'], ['B2', 'F#3', 'A3', 'D4'], ['G2', 'D3', 'F#3', 'B3']];
  const pad = padChords.map((n, i) => ({ t: i * 32, n, d: 31.5, v: 0.75 }));
  const arpTones = [[62, 66, 69, 74], [57, 61, 64, 69], [59, 62, 66, 71], [55, 59, 62, 67]];
  const arp = [];
  arpTones.forEach((tones, i) => {
    for (let k = 0; k < 8; k++) arp.push({ t: i * 32 + 2 + k * 4, n: tones[k % 4], d: 2, v: k % 2 ? 0.4 : 0.5 });
  });
  const night = [
    { t: 12, n: 'F#5', d: 4, v: 0.5 }, { t: 28, n: 'A5', d: 4, v: 0.45 }, { t: 44, n: 'E5', d: 4, v: 0.5 }, { t: 60, n: 'B5', d: 4, v: 0.45 },
    { t: 76, n: 'D5', d: 4, v: 0.5 }, { t: 92, n: 'F#5', d: 4, v: 0.45 }, { t: 108, n: 'B5', d: 4, v: 0.5 }, { t: 124, n: 'G5', d: 4, v: 0.45 },
  ];
  const bar = (s) => s.repeat(8);
  return {
    bpm: 92,
    key: 'D',
    scale: 'major',
    bars: 8,
    swing: 0.12,
    layers: {
      bass: { inst: 'bass', pattern: bass, gain: 0.9, humanize: 0.3 },
      melody: { inst: 'marimba', pattern: melody, gain: 0.8, pan: 0.15, humanize: 0.6 },
      pad: { inst: 'pad', pattern: pad, gain: 0.7, humanize: 0 },
      arp: { inst: 'pluck', pattern: arp, gain: 0.45, pan: -0.25, humanize: 0.5 },
      kick: { inst: 'kick', pattern: bar('x.........o.....'), gain: 0.55, humanize: 0.2 },
      hat: { inst: 'hat', pattern: bar('o.x.o.x.o.x.o.x.'), gain: 0.5, pan: 0.3, humanize: 0.6 },
      night: { inst: 'glass', pattern: night, gain: 0.7, stem: true, pan: -0.1, humanize: 0.4 },
      tide: { inst: 'flute', pattern: [{ t: 0, n: 'A4', d: 14, v: 0.45 }, { t: 32, n: 'E5', d: 14, v: 0.4 }, { t: 64, n: 'F#4', d: 14, v: 0.45 }, { t: 96, n: 'D5', d: 14, v: 0.4 }], gain: 0.45, stem: true, pan: 0.2, humanize: 0.2 },
    },
  };
}

/** The demo track definition (see {@link buildDemoTrack}). */
export const DEMO_TRACK = Object.freeze(buildDemoTrack());

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Engine
// ───────────────────────────────────────────────────────────────────────────────────────────────

const LOOKAHEAD_SEC = 0.3;
const HIDDEN_LOOKAHEAD_SEC = 1.6;
const TICK_MS = 60;
const HIDDEN_TICK_MS = 500;
const SFX_LATENCY = 0.005;
/** Most linear segments used to approximate an equal-power fade. */
const FADE_SEGMENTS = 16;

/**
 * Soft-clip transfer curve: identity below `knee`, tanh-shaped above, never exceeding ~0.905.
 * @param {number} [n=2048]
 * @param {number} [knee=0.6]
 * @returns {Float32Array}
 */
export function softClipCurve(n = 2048, knee = 0.6) {
  const len = Math.max(2, Math.trunc(num(n, 2048)));
  const k = clamp(num(knee, 0.6), 0, 0.99);
  const out = new Float32Array(len);
  const span = 1 - k;
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= k ? a : k + span * Math.tanh((a - k) / span);
    out[i] = x < 0 ? -y : y;
  }
  return out;
}

/**
 * Music-intensity (0..1) → low-pass cutoff in Hz (400 Hz closed … fully open).
 * @param {number} intensity
 * @returns {number}
 */
export function intensityToCutoff(intensity) {
  return 400 * 2 ** (clamp(num(intensity, 1), 0, 1) * 5.64);
}

/**
 * Compressor with the given settings.
 * @param {BaseAudioContext} ctx
 * @param {{threshold: number, knee: number, ratio: number, attack: number, release: number}} s
 * @returns {DynamicsCompressorNode}
 */
function mkCompressor(ctx, s) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = s.threshold;
  c.knee.value = s.knee;
  c.ratio.value = s.ratio;
  c.attack.value = s.attack;
  c.release.value = s.release;
  return c;
}

/**
 * @typedef {object} Graph
 * @property {GainNode} master
 * @property {GainNode} muteGain
 * @property {GainNode} sfxBus
 * @property {GainNode} musicVol
 * @property {BiquadFilterNode} musicFilter Music enters here (intensity low-pass).
 * @property {DynamicsCompressorNode} compressor
 * @property {DynamicsCompressorNode} limiter
 * @property {AnalyserNode} analyser
 */

/**
 * Build the master chain: buses → master → mute → compressor → limiter → analyser → soft clip →
 * ceiling → destination.
 * @param {BaseAudioContext} ctx
 * @returns {Graph}
 */
function buildGraph(ctx) {
  const ceiling = mkGain(ctx, ctx.destination, 0.95);
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClipCurve();
  shaper.oversample = '2x';
  shaper.connect(ceiling);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;
  analyser.connect(shaper);
  const limiter = mkCompressor(ctx, { threshold: -4, knee: 0, ratio: 20, attack: 0.001, release: 0.06 });
  limiter.connect(analyser);
  const compressor = mkCompressor(ctx, { threshold: -14, knee: 10, ratio: 3, attack: 0.004, release: 0.18 });
  compressor.connect(limiter);
  const muteGain = mkGain(ctx, compressor, 1);
  const master = mkGain(ctx, muteGain, 1);
  const sfxBus = mkGain(ctx, master, 1);
  const musicVol = mkGain(ctx, master, 1);
  const musicFilter = mkFilter(ctx, musicVol, 'lowpass', 20000, 0.5);
  return { master, muteGain, sfxBus, musicVol, musicFilter, compressor, limiter, analyser };
}

/**
 * Smoothly move a param to a value.
 * @param {AudioParam} param
 * @param {number} value
 * @param {number} now
 * @param {number} [ramp=0.03] Seconds (time constant ≈ ramp / 3).
 */
function glide(param, value, now, ramp = 0.03) {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, Math.max(ramp / 3, 0.001));
}

/**
 * Cancel pending automation but keep the current value (falls back for browsers without
 * `cancelAndHoldAtTime`).
 * @param {AudioParam} param
 * @param {number} now
 */
function hold(param, now) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else {
    const v = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(v, now);
  }
}

/**
 * Schedule an equal-power fade on an AudioParam as chained linear ramps. Ramps never conflict with
 * other automation (unlike `setValueCurveAtTime`, which throws when it overlaps anything).
 * @param {AudioParam} param
 * @param {number} t0
 * @param {number} sec
 * @param {number} from
 * @param {number} to
 */
function scheduleFade(param, t0, sec, from, to) {
  param.setValueAtTime(from, t0);
  const n = Math.max(2, Math.min(FADE_SEGMENTS, Math.round(sec * 40)));
  for (let i = 1; i <= n; i++) {
    const x = (i / n) * (Math.PI / 2);
    const v = to > from ? from + (to - from) * Math.sin(x) : to + (from - to) * Math.cos(x);
    param.linearRampToValueAtTime(v, t0 + (i / n) * sec);
  }
}

/**
 * A playing instance of a track: its own output gain (for crossfades), per-layer gains (stems and
 * intensity gating) and a step clock. One-shot tracks (`loop: false`) stop scheduling after a
 * single pass and report `ended()`.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} dest
 * @param {Track} track
 * @param {number} startTime
 * @param {{stems: Map<string, boolean>, intensity: number, offline?: boolean}} opts
 */
function createPlayer(ctx, dest, track, startTime, { stems, intensity, offline = false }) {
  const out = mkGain(ctx, dest, offline ? 1 : 0);
  const layers = track.layers.map((def) => ({ def, gain: mkGain(ctx, out, 0) }));
  const clock = createStepClock({
    bpm: track.bpm, loopSteps: track.loopSteps, stepsPerBeat: track.stepsPerBeat,
    stepsPerBar: track.stepsPerBar, startTime, maxCatchUpSteps: offline ? Infinity : track.stepsPerBar * 2,
  });
  const rand = makeLcg(hashString(track.id));
  const endAt = track.loop ? Infinity : startTime + clock.loopSec;
  let stopAt = Infinity;
  let stopping = false;

  const layerTarget = (def, st, inten) => (resolveStem(def.name, st, !def.stem) && inten >= def.minIntensity ? def.gain : 0);

  /** @param {Map<string, boolean>} st @param {number} inten @param {number} ramp @param {number} [at] */
  function applyMix(st, inten, ramp, at = ctx.currentTime) {
    for (const l of layers) {
      const target = layerTarget(l.def, st, inten);
      if (ramp <= 0) l.gain.gain.setValueAtTime(target, at);
      else glide(l.gain.gain, target, at, ramp);
    }
  }
  applyMix(stems, intensity, 0, startTime);

  return {
    track,
    get stopping() { return stopping; },
    applyMix,
    /** Schedule every step that starts before `horizon`. @param {number} horizon */
    schedule(horizon) {
      for (const tick of clock.advance(Math.min(horizon, stopAt, endAt))) {
        for (const l of layers) {
          const evs = l.def.buckets.get(tick.step);
          if (!evs) continue;
          const drum = DRUM_INSTRUMENTS.has(l.def.inst);
          for (const ev of evs) {
            const h = l.def.humanize;
            const jitter = drum ? 0 : (rand() - 0.5) * 0.008 * h;
            const time = tick.time + (ev.t - tick.step) * clock.stepSec + swingOffset(tick.step % track.stepsPerBar, track.swing, clock.stepSec) + jitter;
            const vel = clamp(ev.v * (1 - 0.12 * h * rand()), 0.02, 1);
            const dur = ev.d * clock.stepSec * 0.92;
            for (const n of ev.n) playNote(ctx, l.gain, l.def.inst, { freq: midiToFreq(n), midi: n, time, dur, vel });
          }
        }
      }
    },
    /** @param {number} now @param {number} sec */
    fadeIn(now, sec) {
      hold(out.gain, now);
      if (sec < 0.01) out.gain.setValueAtTime(1, now);
      else scheduleFade(out.gain, now, sec, 0, 1);
    },
    /** @param {number} now @param {number} sec */
    fadeOut(now, sec) {
      if (stopping) return;
      stopping = true;
      stopAt = now + Math.max(sec, 0.01);
      try {
        hold(out.gain, now);
        const from = clamp(out.gain.value, 0, 1);
        if (sec < 0.01 || from <= 0) out.gain.setValueAtTime(0, now);
        else scheduleFade(out.gain, now, sec, from, 0);
      } catch {
        // Automation conflicts must never leave a player audible forever.
        out.gain.cancelScheduledValues(0);
        out.gain.value = 0;
      }
    },
    /** True once a one-shot track has played through (its tail may still ring). @param {number} now */
    ended(now) { return now >= endAt; },
    /** Seconds until a one-shot ends, `null` for looping tracks. @param {number} now */
    remaining(now) { return track.loop ? null : Math.max(0, endAt - now); },
    /** @param {number} now */
    isDone(now) { return (stopping && now > stopAt + 3.0) || now > endAt + 3.0; },
    /** @param {number} now */
    position(now) { return clock.positionAt(now); },
    dispose() { out.disconnect(); },
  };
}

/**
 * @typedef {object} SfxOptions
 * @property {number} [pitch=1] Frequency multiplier (0.25..4).
 * @property {number} [semitones] Alternative to `pitch`.
 * @property {number} [volume=1] 0..2.
 * @property {number} [pan=0] -1..1.
 * @property {number} [delay=0] Seconds.
 */

/**
 * @typedef {object} AudioEngine
 * @property {boolean} ready True once `unlock()` has created the audio graph.
 * @property {string} state AudioContext state (`'closed'` before unlock).
 * @property {BaseAudioContext|null} context
 * @property {AnalyserNode|null} analyser Post-limiter analyser for visualizers.
 * @property {() => Promise<boolean>} unlock Create/resume the context (call from a user gesture).
 * @property {(v: {master?: number, music?: number, sfx?: number}) => {master: number, music: number, sfx: number}} setVolume
 * @property {() => {master: number, music: number, sfx: number}} getVolume
 * @property {(on?: boolean) => boolean} mute
 * @property {() => boolean} isMuted
 * @property {(name: string, opts?: SfxOptions) => {name: string, time: number, duration: number}|null} sfx
 * @property {(id: string, def: object) => Track} defineTrack
 * @property {(id: string) => boolean} hasTrack
 * @property {() => string[]} trackIds
 * @property {(id: string, opts?: {fade?: number, restart?: boolean}) => boolean} playMusic
 * @property {(opts?: {fade?: number}) => boolean} stopMusic
 * @property {(name: string, on: boolean) => string[]} setStem Turn a layer (or every `name.*`
 *   layer) on or off across all tracks; returns the names currently forced on.
 * @property {() => string[]} getStems
 * @property {(p: {intensity?: number}) => {intensity: number}} setMusicParam
 * @property {() => {id: string, bpm: number, bar: number, beat: number, step: number, loop: number,
 *   oneShot: boolean, remaining: number|null, stems: string[], intensity: number}|{id: string,
 *   pending: true}|null} nowPlaying
 * @property {(name: string, opts?: SfxOptions & {sampleRate?: number, seed?: number}) => Promise<AudioBuffer>} renderSfx
 * @property {(id: string, opts?: {bars?: number, sampleRate?: number, stems?: string[]|Record<string, boolean>,
 *   intensity?: number}) => Promise<AudioBuffer>} renderTrack
 * @property {() => Promise<void>} dispose
 */

/**
 * Normalize a `stems` option (array of names that are on, `{name: bool}` object, or Map) into the
 * override map {@link resolveStem} consumes.
 * @param {unknown} stems
 * @returns {Map<string, boolean>}
 */
function toStemMap(stems) {
  const m = new Map();
  if (stems instanceof Map) for (const [k, v] of stems) m.set(String(k), Boolean(v));
  else if (Array.isArray(stems)) for (const k of stems) m.set(String(k), true);
  else if (stems && typeof stems === 'object') for (const [k, v] of Object.entries(stems)) m.set(k, Boolean(v));
  return m;
}

/**
 * Combined frequency multiplier from `pitch` (multiplier) and `semitones`, clamped to 0.25..4.
 * Junk (NaN, strings, 0) falls back to 1.
 * @param {{pitch?: unknown, semitones?: unknown}} o
 * @returns {number}
 */
function pitchMult(o) {
  const p = num(o.pitch, 1);
  return clamp(2 ** (num(o.semitones, 0) / 12) * (p > 0 ? p : 1), 0.25, 4);
}

/**
 * Option bag or `{}` (so `null`/non-objects never throw).
 * @param {unknown} o
 * @returns {Record<string, any>}
 */
function opts(o) {
  return o && typeof o === 'object' ? o : {};
}

/**
 * Create an independent audio engine. Nothing touches WebAudio until `unlock()`.
 * @returns {AudioEngine}
 */
export function createAudio() {
  const tracks = new Map();
  /** Explicit stem overrides (name → on). Layers without an entry use their definition's default. */
  const stems = new Map();
  const vol = { master: 1, music: 0.8, sfx: 1 };
  const limiter = createRateLimiter({ minInterval: 0.02, maxBurst: 20, window: 0.1 });
  const warned = new Set();
  let muted = false;
  let intensity = 1;
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {Graph|null} */
  let graph = null;
  /** @type {Promise<boolean>|null} */
  let unlocking = null;
  let players = [];
  let current = null;
  let pending = null;
  let timer = null;
  let onVisibility = null;

  const warnOnce = (msg) => {
    if (warned.has(msg)) return;
    warned.add(msg);
    console.warn(msg);
  };

  const getStems = () => {
    const out = [];
    for (const [k, v] of stems) if (v) out.push(k);
    return out;
  };

  function applyVolumes(ramp) {
    if (!graph || !ctx) return;
    const now = ctx.currentTime;
    glide(graph.master.gain, volumeToGain(vol.master), now, ramp);
    glide(graph.sfxBus.gain, volumeToGain(vol.sfx), now, ramp);
    glide(graph.musicVol.gain, volumeToGain(vol.music), now, ramp);
    glide(graph.muteGain.gain, muted ? 0 : 1, now, ramp);
  }

  function tick() {
    timer = null;
    if (!graph || !ctx || players.length === 0) return;
    const hidden = typeof document !== 'undefined' && document.hidden === true;
    const horizon = ctx.currentTime + (hidden ? HIDDEN_LOOKAHEAD_SEC : LOOKAHEAD_SEC);
    for (const p of players) p.schedule(horizon);
    const now = ctx.currentTime;
    if (current && current.ended(now)) current = null;
    players = players.filter((p) => {
      if (!p.isDone(now)) return true;
      p.dispose();
      return false;
    });
    if (players.length) timer = setTimeout(tick, hidden ? HIDDEN_TICK_MS : TICK_MS);
  }

  function ensureTimer() {
    if (timer === null) tick();
  }

  function restartTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    tick();
  }

  async function resume() {
    if (!ctx || ctx.state === 'running') return;
    try {
      await ctx.resume();
    } catch {
      /* resume can reject before a gesture; callers retry on the next gesture */
    }
  }

  const api = {
    get ready() { return graph !== null; },
    get state() { return ctx ? ctx.state : 'closed'; },
    get context() { return ctx; },
    get analyser() { return graph ? graph.analyser : null; },

    unlock() {
      if (graph) return resume().then(() => ctx !== null && ctx.state === 'running');
      if (unlocking) return unlocking;
      const attempt = (async () => {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (typeof AC !== 'function') return false;
        let c;
        try {
          c = new AC({ latencyHint: 'interactive' });
        } catch (err) {
          warnOnce(`audio.unlock: could not create AudioContext (${err && err.message})`);
          return false;
        }
        ctx = c;
        graph = buildGraph(c);
        graph.musicFilter.frequency.value = intensityToCutoff(intensity);
        applyVolumes(0);
        try {
          const nudge = c.createBufferSource();
          nudge.buffer = c.createBuffer(1, 1, c.sampleRate);
          nudge.connect(c.destination);
          nudge.start(0);
        } catch {
          /* purely a mobile unlock nudge; ignore */
        }
        await resume();
        if (ctx !== c) return false; // disposed while resuming
        if (typeof c.addEventListener === 'function') {
          c.addEventListener('statechange', () => { if (ctx === c && c.state === 'running' && players.length) ensureTimer(); });
        }
        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
          onVisibility = () => { if (!document.hidden && players.length) restartTimer(); };
          document.addEventListener('visibilitychange', onVisibility);
        }
        if (pending) {
          const { id, opts: o } = pending;
          pending = null;
          api.playMusic(id, o);
        }
        return c.state === 'running';
      })();
      unlocking = attempt;
      const settle = () => { if (unlocking === attempt) unlocking = null; };
      attempt.then(settle, settle);
      return attempt;
    },

    setVolume(v) {
      const o = typeof v === 'number' ? { master: v } : opts(v);
      for (const k of ['master', 'music', 'sfx']) {
        const n = num(o[k], NaN);
        if (Number.isFinite(n)) vol[k] = clamp(n, 0, 1);
      }
      applyVolumes(0.03);
      return { ...vol };
    },
    getVolume() { return { ...vol }; },
    mute(on = true) {
      muted = Boolean(on);
      applyVolumes(0.02);
      return muted;
    },
    isMuted() { return muted; },

    sfx(name, options) {
      const o = opts(options);
      const key = lookup(SFX_ALIASES, name) ?? name;
      const def = lookup(SFX, key);
      if (!def) {
        warnOnce(`audio.sfx: unknown sfx "${String(name)}"`);
        return null;
      }
      if (!graph || !ctx) return null;
      if (ctx.state !== 'running') resume();
      const now = ctx.currentTime;
      if (!limiter.allow(key, now)) return null;
      const gain = clamp(num(o.volume, 1), 0, 2);
      if (!(gain > 0)) return null;
      const pan = clamp(num(o.pan, 0), -1, 1);
      const t0 = now + SFX_LATENCY + Math.max(0, num(o.delay, 0));
      try {
        const dest = pan ? mkPan(ctx, graph.sfxBus, pan) : graph.sfxBus;
        def.play(ctx, dest, t0, { pitch: pitchMult(o), gain, rand: Math.random });
      } catch (err) {
        warnOnce(`audio.sfx(${key}): ${err && err.message}`);
        return null;
      }
      return { name: key, time: t0, duration: def.dur };
    },

    defineTrack(id, def) {
      const track = normalizeTrack(id, def);
      tracks.set(id, track);
      return track;
    },
    hasTrack(id) { return tracks.has(id); },
    trackIds() { return [...tracks.keys()]; },

    playMusic(id, options) {
      const o = opts(options);
      const fade = num(o.fade, 800);
      const restart = Boolean(o.restart);
      const track = tracks.get(id);
      if (!track) {
        warnOnce(`audio.playMusic: unknown track "${String(id)}"`);
        return false;
      }
      if (!graph || !ctx) {
        pending = { id, opts: { fade, restart } };
        return true;
      }
      const now = ctx.currentTime;
      if (current && current.track === track && !current.stopping && !current.ended(now) && !restart) return true;
      const fadeSec = Math.max(0, fade) / 1000;
      const player = createPlayer(ctx, graph.musicFilter, track, now + 0.05, { stems, intensity });
      if (current) current.fadeOut(now, fadeSec);
      player.fadeIn(now, current ? fadeSec : Math.min(fadeSec, 0.25));
      current = player;
      players.push(player);
      ensureTimer();
      return true;
    },
    stopMusic(options) {
      const fade = num(opts(options).fade, 600);
      pending = null;
      if (!current) return false;
      current.fadeOut(ctx.currentTime, Math.max(0, fade) / 1000);
      current = null;
      return true;
    },
    setStem(name, on) {
      if (name === undefined || name === null) return getStems();
      const key = String(name).trim();
      if (!key) return getStems();
      stems.set(key, Boolean(on));
      if (ctx) for (const p of players) p.applyMix(stems, intensity, 0.5);
      return getStems();
    },
    getStems,
    setMusicParam(params) {
      const n = num(opts(params).intensity, NaN);
      if (Number.isFinite(n)) {
        intensity = clamp(n, 0, 1);
        if (graph && ctx) {
          glide(graph.musicFilter.frequency, intensityToCutoff(intensity), ctx.currentTime, 0.4);
          for (const p of players) p.applyMix(stems, intensity, 0.5);
        }
      }
      return { intensity };
    },
    nowPlaying() {
      if (!current) return pending ? { id: pending.id, pending: true } : null;
      const now = ctx.currentTime;
      if (current.ended(now)) return null;
      const pos = current.position(now);
      return {
        id: current.track.id, bpm: current.track.bpm, bar: pos.bar, beat: pos.beat, step: pos.step, loop: pos.loop,
        oneShot: !current.track.loop, remaining: current.remaining(now), stems: getStems(), intensity,
      };
    },

    async renderSfx(name, options) {
      const o = opts(options);
      const key = lookup(SFX_ALIASES, name) ?? name;
      const def = lookup(SFX, key);
      if (!def) throw new RangeError(`renderSfx: unknown sfx "${String(name)}"`);
      const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
      if (typeof OAC !== 'function') throw new Error('renderSfx: OfflineAudioContext is not available');
      const sampleRate = clamp(num(o.sampleRate, 44100), 8000, 96000);
      const oc = new OAC(2, Math.ceil((def.dur + 0.3) * sampleRate), sampleRate);
      const g = buildGraph(oc);
      const pan = clamp(num(o.pan, 0), -1, 1);
      const dest = pan ? mkPan(oc, g.sfxBus, pan) : g.sfxBus;
      def.play(oc, dest, 0.02, { pitch: pitchMult(o), gain: clamp(num(o.volume, 1), 0, 2), rand: makeLcg(num(o.seed, 1)) });
      return oc.startRendering();
    },
    async renderTrack(id, options) {
      const o = opts(options);
      const track = tracks.get(id);
      if (!track) throw new RangeError(`renderTrack: unknown track "${String(id)}"`);
      const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
      if (typeof OAC !== 'function') throw new Error('renderTrack: OfflineAudioContext is not available');
      const nBars = Math.max(1, Math.trunc(num(o.bars, track.bars)));
      const sampleRate = clamp(num(o.sampleRate, 44100), 8000, 96000);
      const inten = clamp(num(o.intensity, 1), 0, 1);
      const stepSec = stepSeconds(track.bpm, track.stepsPerBeat);
      const steps = nBars * track.stepsPerBar;
      const start = 0.05;
      const oc = new OAC(2, Math.ceil((start + steps * stepSec + 2.5) * sampleRate), sampleRate);
      const g = buildGraph(oc);
      g.musicFilter.frequency.value = intensityToCutoff(inten);
      const player = createPlayer(oc, g.musicFilter, track, start, { stems: toStemMap(o.stems ?? []), intensity: inten, offline: true });
      player.schedule(start + (steps - 0.5) * stepSec);
      return oc.startRendering();
    },

    async dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (onVisibility && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      onVisibility = null;
      for (const p of players) p.dispose();
      players = [];
      current = null;
      pending = null;
      limiter.reset();
      const c = ctx;
      ctx = null;
      graph = null;
      unlocking = null;
      if (c && typeof c.close === 'function') {
        try {
          await c.close();
        } catch {
          /* already closed */
        }
      }
    },
  };
  api.defineTrack(DEMO_TRACK_ID, DEMO_TRACK);
  return api;
}

/** The shared engine instance used by the game. */
export const audio = createAudio();

export default audio;

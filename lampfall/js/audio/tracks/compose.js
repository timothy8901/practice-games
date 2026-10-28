/**
 * Score-writing helpers shared by every track file: the note-name parser, the melody DSL, the
 * harmony-derived layer builders (pad, bass, night, tide, rain, counter, pulse, brass, tense), the
 * brushed-kit patterns and the two track builders ({@link theme} for the day-part themes,
 * {@link battle} for the battle themes). Moved verbatim from `proto/music/tracks.js` (the music
 * director verified that score); only `export` keywords and JSDoc were added.
 *
 * Pure ES module: no DOM, no WebAudio, no randomness. [AUDIO]
 * @module audio/tracks/compose
 */

// ---------------------------------------------------------------------------
// Note name -> MIDI
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'F#4' -> 66. C4 = 60. */
export function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error('bad note ' + name);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/**
 * Tiny melody DSL -> pattern. Tokens separated by whitespace, '|' is a cosmetic bar line.
 *   'D4:4'        note, 4 steps            'D4:4:0.6'  with velocity
 *   'r:4'         rest (advances time)     '[D4,F#4,A4]:16'  chord
 *   '>4'          jump: set the cursor to step 4 inside the current bar is NOT supported; use rests.
 * Time is cumulative, so melodies are written like sheet music.
 */
export function P(str, { v = 0.8, t0 = 0, legato = 1 } = {}) {
  const out = [];
  const barLines = []; // cursor at each '|' (non-enumerable metadata; validate/analyze check they fall on bar boundaries)
  let t = t0;
  for (const tok of str.split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') { barLines.push(t); continue; }
    const parts = tok.split(':');
    const head = parts[0];
    const d = Number(parts[1] ?? 1);
    const vel = parts[2] !== undefined ? Number(parts[2]) : v;
    if (head === 'r') { t += d; continue; }
    const n = head.startsWith('[') ? head.slice(1, -1).split(',').map(midi) : midi(head);
    out.push({ t, n, d: Math.max(1, Math.round(d * legato)), v: vel });
    t += d;
  }
  Object.defineProperty(out, 'barLines', { value: barLines, enumerable: false });
  return out;
}

/** Offsets a pattern in time. */
export function at(step, pattern) { return pattern.map(e => ({ ...e, t: e.t + step })); }
/** Repeats a pattern `times` times, each copy `len` steps later. */
export function rep(pattern, times, len) {
  const out = [];
  for (let i = 0; i < times; i++) out.push(...at(i * len, pattern));
  return out;
}
/** Concatenates patterns. */
export function cat(...patterns) { return patterns.flat(); }

// ---------------------------------------------------------------------------
// Harmony: one string per bar. 'D: F#3 A3 D4' = chord with root D voiced F#3 A3 D4.
// Two chords in a bar split by ' / '. Voicings are written by hand for voice leading.
/**
 * One bar of harmony -> its chords.
 * @param {string} str e.g. `'D: F#3 A3 D4'` or `'G: G3 B3 D4 / A: A3 C#4 E4'`
 * @returns {{root: string, notes: number[]}[]}
 */
export function parseBar(str) {
  return str.split('/').map(s => {
    const [root, voicing] = s.trim().split(':');
    return { root: root.trim(), notes: voicing.trim().split(/\s+/).map(midi) };
  });
}
/**
 * MIDI note of a chord root at an octave.
 * @param {string} root note letter (+ accidental)
 * @param {number} octave
 * @returns {number}
 */
export function rootMidi(root, octave) { return midi(root + octave); }

/** Sustained chord pad from a chord list; voice-led by the hand-written voicings. */
export function padLayer(bars, { v = 0.55, spb = 16, legato = 1 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => out.push({ t: i * spb + j * slice, n: c.notes, d: Math.max(1, Math.round(slice * legato)), v }));
  });
  return out;
}

/** Bass that follows the chord roots. style: calm | walk | drive | waltz | pulse. */
export function bassLayer(bars, { style = 'calm', v = 0.7, spb = 16, oct = 2 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => {
      const b = i * spb + j * slice;
      const r = rootMidi(c.root, oct);
      const fifth = r + 7;
      if (style === 'calm') {
        out.push({ t: b, n: r, d: Math.min(10, slice - 2), v });
        if (slice >= 16) out.push({ t: b + 10, n: fifth, d: 5, v: v * 0.7 });
      } else if (style === 'walk') {
        out.push({ t: b, n: r, d: 6, v });
        out.push({ t: b + 6, n: r, d: 2, v: v * 0.6 });
        if (slice >= 16) { out.push({ t: b + 8, n: fifth, d: 6, v: v * 0.85 }); out.push({ t: b + 14, n: r + 12, d: 2, v: v * 0.55 }); }
      } else if (style === 'drive') {
        for (let s = 0; s < slice; s += 2) {
          const octUp = (s % 8) === 6;
          out.push({ t: b + s, n: octUp ? r + 12 : (s % 8 === 4 ? fifth : r), d: 2, v: s % 4 === 0 ? v : v * 0.75 });
        }
      } else if (style === 'pulse') {
        for (let s = 0; s < slice; s += 4) out.push({ t: b + s, n: s % 8 === 4 ? fifth : r, d: 3, v: s === 0 ? v : v * 0.8 });
      } else if (style === 'waltz') { // spb = 12: oom-pah-pah
        out.push({ t: b, n: r, d: 4, v });
        out.push({ t: b + 4, n: c.notes.slice(0, 2), d: 3, v: v * 0.55 });
        out.push({ t: b + 8, n: c.notes.slice(0, 2), d: 3, v: v * 0.5 });
      }
    });
  });
  return out;
}

/** Glass-bell / music-box arpeggio over the chord tones (night stem). */
export function nightLayer(bars, { v = 0.32, spb = 16, steps = [0, 6, 10], oct = 12 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => {
      const tones = [...c.notes].sort((a, b) => b - a); // top voice first
      steps.forEach((s, k) => {
        if (s >= slice) return;
        out.push({ t: i * spb + j * slice + s, n: tones[k % tones.length] + oct, d: 2, v: v * (k === 0 ? 1 : 0.8) });
      });
    });
  });
  return out;
}

/**
 * Low pad swell on root + fifth two octaves below the pad (tide stem). Re-voiced every bar so it never pedals a root
 * against the next chord (a held G under the D bar put G against F# in the low mids); the pad's 0.35 s attack and 0.7 s
 * release overlap bar to bar, and the velocity peaks every `every` bars so the swell still breathes slowly.
 */
export function tideLayer(bars, { v = 0.42, spb = 16, oct = 2, every = 2 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const c = parseBar(bar)[0];
    const r = rootMidi(c.root, oct);
    out.push({ t: i * spb, n: [r, r + 7], d: spb, v: i % every === 0 ? v : v * 0.72 });
  });
  return out;
}

/**
 * Soft rhodes comping on the off-beats (rain stem). An off-beat that runs into the next chord anticipates it
 * (comping-style) instead of smearing the old chord's ring over the new downbeat.
 */
export function rainLayer(bars, { v = 0.2, spb = 16, steps = [2, 6, 10, 14] } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => {
      const next = j + 1 < chords.length ? chords[j + 1] : parseBar(bars[(i + 1) % bars.length])[0];
      steps.forEach((s, k) => {
        if (s >= slice) return;
        const d = 3;
        const tones = [...(s + d > slice ? next : c).notes].sort((a, b) => a - b);
        const n = k % 2 === 0 ? tones.slice(0, 2) : tones[(k + 1) % tones.length];
        const t = i * spb + j * slice + s;
        out.push({ t, n, d: Math.min(d, bars.length * spb - t), v });
      });
    });
  });
  return out;
}

/**
 * Chord-following counter line (marimba in the battles). `cells` = [[step, tone], ...] per chord slice, where
 * `tone` is an index into the voicing's notes sorted low→high (indices past the end wrap up an octave), or
 * 'r' / '3' / '5' for the chord root, third and fifth placed inside [lo, lo+12). Keeps the ostinato rhythm
 * while never planting a non-chord tone a semitone from what the pad is holding.
 */
export function counterLayer(bars, cells, { v = 0.45, spb = 16, oct = 0, lo = 57 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => {
      const tones = [...c.notes].sort((a, b) => a - b);
      const rootPc = midi(c.root + '0') % 12;
      const place = (pc) => { let n = pc; while (n < lo) n += 12; return n; };
      const third = tones.map(n => (n - rootPc + 120) % 12).find(iv => iv === 3 || iv === 4);
      for (const [s, tone] of cells) {
        if (s >= slice) continue;
        let n;
        if (tone === 'r') n = place(rootPc);
        else if (tone === '5') n = place((rootPc + 7) % 12);
        else if (tone === '3') n = place((rootPc + (third ?? 7)) % 12);
        else n = tones[tone % tones.length] + 12 * Math.floor(tone / tones.length) + oct;
        out.push({ t: i * spb + j * slice + s, n, d: 2, v });
      }
    });
  });
  return out;
}

/** GM drum notes the kit layers use (kick 36, snare 38, closed hat 42, rim 37). */
export const KICK = 36, SNARE = 38, HAT = 42, RIM = 37;
// Hat velocities: the engine's hat preset peaks at only 0.22 (kick 0.75), so brushed hats below v 0.3 render around -30 dBFS and
// vanish under the limiter; these sit the hour themes near -26 dB and the battles at the engine demo track's own hat level.
/** Brushed drum kit patterns by style. One bar given; repeated. @type {Record<string, {t: number, n: number, d: number, v: number}[]>} */
export const PERC = {
  whisper: [ { t: 4, n: HAT, d: 1, v: 0.34 }, { t: 12, n: HAT, d: 1, v: 0.3 } ],
  brush: [
    { t: 0, n: KICK, d: 1, v: 0.32 }, { t: 10, n: KICK, d: 1, v: 0.22 },
    { t: 4, n: SNARE, d: 1, v: 0.26 }, { t: 12, n: SNARE, d: 1, v: 0.28 },
    { t: 2, n: HAT, d: 1, v: 0.3 }, { t: 6, n: HAT, d: 1, v: 0.3 }, { t: 10, n: HAT, d: 1, v: 0.26 }, { t: 14, n: HAT, d: 1, v: 0.34 },
  ],
  light: [
    { t: 0, n: KICK, d: 1, v: 0.38 }, { t: 10, n: KICK, d: 1, v: 0.26 },
    { t: 4, n: SNARE, d: 1, v: 0.32 }, { t: 12, n: SNARE, d: 1, v: 0.34 }, { t: 15, n: SNARE, d: 1, v: 0.14 },
    ...[0, 2, 4, 6, 8, 10, 12, 14].map(t => ({ t, n: HAT, d: 1, v: t % 4 === 0 ? 0.36 : 0.22 })),
  ],
  drive: [
    { t: 0, n: KICK, d: 1, v: 0.6 }, { t: 6, n: KICK, d: 1, v: 0.35 }, { t: 8, n: KICK, d: 1, v: 0.55 }, { t: 14, n: KICK, d: 1, v: 0.3 },
    { t: 4, n: SNARE, d: 1, v: 0.55 }, { t: 12, n: SNARE, d: 1, v: 0.6 }, { t: 15, n: SNARE, d: 1, v: 0.22 },
    ...Array.from({ length: 16 }, (_, t) => ({ t, n: HAT, d: 1, v: t % 4 === 2 ? 0.5 : 0.26 })),
  ],
  heavy: [
    { t: 0, n: KICK, d: 1, v: 0.7 }, { t: 3, n: KICK, d: 1, v: 0.35 }, { t: 8, n: KICK, d: 1, v: 0.65 }, { t: 11, n: KICK, d: 1, v: 0.35 },
    { t: 4, n: SNARE, d: 1, v: 0.65 }, { t: 12, n: SNARE, d: 1, v: 0.7 }, { t: 14, n: SNARE, d: 1, v: 0.28 },
    ...Array.from({ length: 16 }, (_, t) => ({ t, n: HAT, d: 1, v: t % 4 === 2 ? 0.55 : 0.28 })),
  ],
  waltz: [ // 12 steps
    { t: 0, n: KICK, d: 1, v: 0.4 }, { t: 4, n: HAT, d: 1, v: 0.36 }, { t: 8, n: HAT, d: 1, v: 0.36 }, { t: 6, n: RIM, d: 1, v: 0.2 },
  ],
  tick: Array.from({ length: 16 }, (_, t) => ({ t, n: HAT, d: 1, v: t % 4 === 0 ? 0.34 : 0.15 })),
};
/**
 * A kit pattern repeated over `bars` bars.
 * @param {string} style key of {@link PERC}
 * @param {number} bars
 * @param {number} [spb=16] steps per bar
 * @returns {{t: number, n: number, d: number, v: number}[]}
 */
export function percLayer(style, bars, spb = 16) { return rep(PERC[style], bars, spb); }

/**
 * Melody gain per lead instrument so every hour's tune sits at about the same loudness. The engine's flute peaks at 0.24,
 * pluck 0.32, marimba 0.42, bell ~0.45 (see INSTRUMENTS in js/core/audio.js), but the flute sustains while the others decay,
 * so equal peaks left the flute hours ~7 dB fuller in RMS; the flute is trimmed and the marimba lifted to narrow that.
 */
export const MELODY_GAIN = { flute: 0.82, pluck: 0.8, marimba: 0.68, bell: 0.58, glass: 0.7 };

/**
 * Builds a day-part theme from hand-written harmony + melody (layers core, melody, bass, perc on;
 * night, tide, rain off by default).
 * @param {string} id
 * @param {Object} o title, bpm, key, scale, bars (harmony strings), melody (pattern), melodyInst, melodyGain,
 *   perc (style), bass (style), padGain, nightSteps, motif, mood
 * @returns {import('./index.js').TrackDef}
 */
export function theme(id, { title, bpm, key, scale, bars, melody, melodyInst = 'flute', melodyGain, perc = 'brush', bass = 'calm',
  padGain = 0.5, nightSteps, motif, mood }) {
  const n = bars.length;
  return {
    id, title, bpm, key, scale, bars: n, stepsPerBar: 16, mood, motif,
    layers: {
      core:   { inst: 'pad',   gain: padGain, default: true,  role: 'core',   pattern: padLayer(bars) },
      melody: { inst: melodyInst, gain: melodyGain ?? MELODY_GAIN[melodyInst] ?? 0.8, default: true, role: 'melody', pattern: melody },
      // bass preset peaks at 0.55 (the hottest pitched voice). The prototype's 0.6 still made it the largest RMS
      // contributor of every hour (solo ~0.15 vs 0.06–0.13 for the tunes) and kept the master limiter busy;
      // 0.5 (−1.6 dB) sits it under the tune (w3 mix polish, measured in test/pages/audio-mix.html).
      bass:   { inst: 'bass',  gain: 0.5,  default: true,  role: 'bass',   pattern: bassLayer(bars, { style: bass }) },
      perc:   { inst: 'kit',   gain: 0.6,  default: true,  role: 'perc',   pattern: percLayer(perc, n) },
      night:  { inst: 'glass', gain: 0.65, default: false, role: 'night',  pattern: nightLayer(bars, { steps: nightSteps }) },
      tide:   { inst: 'pad',   gain: 0.45, default: false, role: 'tide',   pattern: tideLayer(bars) },
      rain:   { inst: 'rhodes', gain: 0.5, default: false, role: 'rain',  pattern: rainLayer(bars, { v: 0.3 }) },
    },
  };
}

// ---------------------------------------------------------------------------
// BATTLES — driving, but inside the town's tonal world.
/**
 * Builds a battle theme: pulse core, melody, driving bass and kit on; a `tense` stem off by default;
 * optional pad, marimba counter-line and extra layers.
 * @param {string} id
 * @param {Object} o title, bpm, key, scale, bars, melody, counter, perc, bass, mood, motif, pad, extra
 * @returns {import('./index.js').TrackDef}
 */
export function battle(id, { title, bpm, key, scale, bars, melody, counter, perc = 'drive', bass = 'drive', mood, motif, pad = true, extra = {} }) {
  const n = bars.length;
  const layers = {
    core:   { inst: 'pluck', gain: 0.5, default: true, role: 'core', pattern: pulseLayer(bars) },
    melody: { inst: 'pluck', gain: 0.8, default: true, role: 'melody', pattern: melody },
    // 0.55 (prototype 0.7): the driving bass solo measured ~0.19 RMS, five times the tune, and with the kick it
    // set every battle peak (dry 0.95–1.2) — trimmed so the lead and the creature cries read over it (w3 mix polish)
    bass:   { inst: 'bass',  gain: 0.55, default: true, role: 'bass', pattern: bassLayer(bars, { style: bass, v: 0.8 }) },
    perc:   { inst: 'kit',   gain: 0.8, default: true, role: 'perc', pattern: percLayer(perc, n) },
    tense:  { inst: 'glass', gain: 0.5, default: false, role: 'tense', pattern: tenseLayer(n) },
    ...extra,
  };
  if (pad) layers.pad = { inst: 'pad', gain: 0.35, default: true, role: 'pad', pattern: padLayer(bars, { v: 0.45 }) };
  if (counter) layers.counter = { inst: 'marimba', gain: 0.55, default: true, role: 'counter', pattern: counter };
  return { id, title, bpm, key, scale, bars: n, stepsPerBar: 16, mood, motif, layers };
}
/** Pulsing off-beat chord stabs (GBA-style two-pulse-lead energy). */
export function pulseLayer(bars, { v = 0.45, spb = 16 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => {
      const b = i * spb + j * slice;
      for (let s = 2; s < slice; s += 4) out.push({ t: b + s, n: c.notes.slice(-2), d: 1, v: s % 8 === 2 ? v : v * 0.8 });
    });
  });
  return out;
}
/**
 * Low brass pedal (Spire): the fifth and octave above each chord root (A2–B3) held on the brass preset. The first draft
 * dropped the whole pad voicing an octave, which parked minor thirds at 80–100 Hz (E2 G2) under a driving 8th-note bass —
 * below the low-interval limit — and measured as the second-loudest layer in the track. An open fifth-and-octave above the
 * bass root keeps the weight, never doubles the bass's own pitch, and leaves the thirds to the pad.
 */
export function brassLayer(bars, { v = 0.45, spb = 16, oct = 2 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => { const r = rootMidi(c.root, oct); out.push({ t: i * spb + j * slice, n: [r + 7, r + 12], d: slice, v }); });
  });
  return out;
}
/** Low-HP layer: high tremolo on a minor-9th-ish colour plus extra sixteenth hats. */
export function tenseLayer(bars) {
  const out = [];
  for (let i = 0; i < bars; i++) {
    for (let s = 0; s < 16; s += 2) out.push({ t: i * 16 + s, n: s % 4 === 0 ? midi('G6') : midi('F#6'), d: 1, v: 0.22 });
    out.push({ t: i * 16 + 15, n: midi('C#6'), d: 1, v: 0.25 });
  }
  return out;
}

// proto/music/tracks.js — Porchlight x Wildshift music data.
// Pure ES module (no DOM): exports TRACKS, CUES, and helpers to adapt the data to js/core/audio.js.
//
// Conventions (match docs-core-contract.md, audio.js section):
//   track  = {id, title, bpm, key, scale, bars, stepsPerBar (16 = 4/4 sixteenths, 12 = 3/4), layers}
//   layer  = {inst: preset, gain: 0..1, pattern: [{t, n, d, v}], default: bool, role}
//   note   = {t: stepIndex, n: midiNote | midiNote[], d: steps, v: velocity 0..1}
// Stem names used by the game (see CUES): core, melody, bass, perc (always on by default);
// night / tide / rain (toggled by world state); tense (battle low HP).

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
function parseBar(str) {
  return str.split('/').map(s => {
    const [root, voicing] = s.trim().split(':');
    return { root: root.trim(), notes: voicing.trim().split(/\s+/).map(midi) };
  });
}
function rootMidi(root, octave) { return midi(root + octave); }

/** Sustained chord pad from a chord list; voice-led by the hand-written voicings. */
function padLayer(bars, { v = 0.55, spb = 16, legato = 1 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => out.push({ t: i * spb + j * slice, n: c.notes, d: Math.max(1, Math.round(slice * legato)), v }));
  });
  return out;
}

/** Bass that follows the chord roots. style: calm | walk | drive | waltz | pulse. */
function bassLayer(bars, { style = 'calm', v = 0.7, spb = 16, oct = 2 } = {}) {
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
function nightLayer(bars, { v = 0.32, spb = 16, steps = [0, 6, 10], oct = 12 } = {}) {
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
function tideLayer(bars, { v = 0.42, spb = 16, oct = 2, every = 2 } = {}) {
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
function rainLayer(bars, { v = 0.2, spb = 16, steps = [2, 6, 10, 14] } = {}) {
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
function counterLayer(bars, cells, { v = 0.45, spb = 16, oct = 0, lo = 57 } = {}) {
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

/** Brushed drum kit patterns. One bar given; repeated. */
const KICK = 36, SNARE = 38, HAT = 42, RIM = 37;
// Hat velocities: the engine's hat preset peaks at only 0.22 (kick 0.75), so brushed hats below v 0.3 render around -30 dBFS and
// vanish under the limiter; these sit the hour themes near -26 dB and the battles at the engine demo track's own hat level.
const PERC = {
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
function percLayer(style, bars, spb = 16) { return rep(PERC[style], bars, spb); }

/** Builds a day-part theme from hand-written harmony + melody. */
/**
 * Melody gain per lead instrument so every hour's tune sits at about the same loudness. The engine's flute peaks at 0.24,
 * pluck 0.32, marimba 0.42, bell ~0.45 (see INSTRUMENTS in js/core/audio.js), but the flute sustains while the others decay,
 * so equal peaks left the flute hours ~7 dB fuller in RMS; the flute is trimmed and the marimba lifted to narrow that.
 */
const MELODY_GAIN = { flute: 0.82, pluck: 0.8, marimba: 0.68, bell: 0.58, glass: 0.7 };

function theme(id, { title, bpm, key, scale, bars, melody, melodyInst = 'flute', melodyGain, perc = 'brush', bass = 'calm',
  padGain = 0.5, nightSteps, motif, mood }) {
  const n = bars.length;
  return {
    id, title, bpm, key, scale, bars: n, stepsPerBar: 16, mood, motif,
    layers: {
      core:   { inst: 'pad',   gain: padGain, default: true,  role: 'core',   pattern: padLayer(bars) },
      melody: { inst: melodyInst, gain: melodyGain ?? MELODY_GAIN[melodyInst] ?? 0.8, default: true, role: 'melody', pattern: melody },
      // bass preset peaks at 0.55 (the hottest pitched voice): 0.6 keeps it under the tune, not on top of it
      bass:   { inst: 'bass',  gain: 0.6,  default: true,  role: 'bass',   pattern: bassLayer(bars, { style: bass }) },
      perc:   { inst: 'kit',   gain: 0.6,  default: true,  role: 'perc',   pattern: percLayer(perc, n) },
      night:  { inst: 'glass', gain: 0.65, default: false, role: 'night',  pattern: nightLayer(bars, { steps: nightSteps }) },
      tide:   { inst: 'pad',   gain: 0.45, default: false, role: 'tide',   pattern: tideLayer(bars) },
      rain:   { inst: 'rhodes', gain: 0.5, default: false, role: 'rain',  pattern: rainLayer(bars, { v: 0.3 }) },
    },
  };
}

// ---------------------------------------------------------------------------
// THE EIGHT DAY-PART THEMES. One town, one tonal family: D major / B minor / G lydian / A mixolydian / E dorian.
// Motifs: HEARTMARK = 4 notes, intervals +4 +3 +2 (D F# A B; G B D E) — title, morning (home town), every Shift sting.
//         VAGARY    = falling phrase A G F# D (-2 -1 -4) — Spire/summit battles, skyglass.

// 00–03 "Harbor Asleep" — B minor, 84 bpm. Flute in long tones with a rest at every phrase end; low tide ticks live in the perc whisper.
const H_NIGHT_DEEP = [
  'B: B3 D4 F#4', 'G: G3 B3 D4 F#4', 'D: A3 D4 F#4', 'E: E3 G3 B3 D4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4', 'B: B3 D4 F#4',
  'D: A3 D4 F#4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'G: G3 B3 D4',
  'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
];
const M_NIGHT_DEEP = P(`
  r:4 F#4:4 A4:4 B4:4 | A4:8 r:8 | F#4:4 E4:4 D4:6 r:2 | E4:8 r:8 |
  r:4 F#4:4 A4:4 B4:4 | D5:6 C#5:2 B4:4 A4:4 | F#4:12 r:4 | E4:8 F#4:8 |
  r:4 A4:4 B4:4 D5:4 | C#5:8 E5:4 D5:4 | B4:8 D5:4 F#5:4 | G5:8 r:8 |
  E5:4 D5:4 B4:8 | C#5:8 A4:8 | B4:6 D5:2 B4:4 G4:4 | F#4:6 E4:6 r:4`, { v: 0.6 }); // last bar: 6-5 suspension over A, so the loop steps E4 -> F#4 back into the sigh

// 03–06 "Before the Gulls" — E dorian, 88 bpm. Plucked guitar, rising hopeful motif E G A B.
const H_PREDAWN = [
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'D: F#3 A3 D4', 'B: F#3 B3 D4',
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4',
  'D: F#3 A3 D4', 'G: G3 B3 D4', 'E: E3 G3 B3', 'A: E3 A3 C#4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
];
const M_PREDAWN = P(`
  E4:3 G4:3 A4:2 B4:8 | r:4 A4:2 G4:2 E4:8 | F#4:3 A4:3 D5:2 r:8 | D5:4 B4:4 F#4:8 |
  E4:3 G4:3 A4:2 B4:8 | C#5:4 B4:4 A4:4 r:4 | B4:6 A4:2 G4:4 F#4:4 | E4:12 r:4 |
  r:2 D5:2 E5:2 F#5:6 E5:4 | D5:8 B4:8 | E4:4 G4:4 B4:8 | C#5:6 B4:2 A4:4 r:4 |
  F#4:4 B4:4 D5:8 | C#5:4 A4:4 F#4:4 r:4 | G4:4 B4:4 D5:4 B4:4 | A4:4 B4:4 C#5:8`, { v: 0.7 });

// 06–09 "Porchlight Morning" — D major, 100 bpm. HOME TOWN theme: opens with the Heartmark motif D F# A B.
const H_MORNING = [
  'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4', 'D: A3 D4 F#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4', 'D: F#3 A3 D4',
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'F#: F#3 A3 C#4', 'B: F#3 B3 D4',
  'G: G3 B3 D4', 'D: F#3 A3 D4', 'G: G3 B3 D4 / A: A3 C#4 E4', 'D: A3 D4 F#4',
];
const M_MORNING = P(`
  D4:3 F#4:3 A4:2 B4:8 | A4:4 G4:2 F#4:2 G4:8 | E4:3 F#4:3 G4:2 A4:4 C#5:4 | D5:12 r:4 |
  D4:3 F#4:3 A4:2 B4:8 | D5:4 B4:4 G4:8 | A4:3 B4:3 C#5:2 E5:8 | D5:8 r:8 |
  r:4 B4:4 D5:4 E5:4 | C#5:6 E5:2 A4:8 | F#4:4 A4:4 C#5:8 | D5:4 B4:4 F#4:8 |
  G4:3 B4:3 D5:2 B4:8 | A4:4 F#4:4 D4:8 | G4:4 F#4:4 E4:4 C#4:4 | D4:12 r:4`, { v: 0.8 });

// 09–12 "Gull Market" — G lydian, 104 bpm. Marimba, syncopated, the II chord (A) gives the lydian lift.
const H_LATE_MORNING = [
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4', 'D: A3 D4 F#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'D: A3 D4 F#4',
  'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: B3 D4 F#4', 'A: A3 C#4 E4', 'G: G3 B3 D4 F#4', 'D: A3 D4 F#4',
];
const M_LATE_MORNING = P(`
  G4:2 r:2 B4:2 D5:2 r:2 E5:2 D5:4 | C#5:4 E5:2 C#5:2 A4:8 | G4:2 r:2 B4:2 D5:2 r:2 B4:2 G4:4 | F#4:4 A4:4 D5:8 |
  G4:2 r:2 B4:2 D5:2 r:2 E5:2 F#5:4 | E5:4 C#5:2 E5:2 A4:8 | B4:4 D5:4 F#5:8 | E5:4 D5:4 A4:8 |
  E4:2 G4:2 B4:2 D5:2 r:2 B4:2 G4:4 | F#4:2 A4:2 C#5:2 E5:2 r:2 C#5:2 A4:4 | G4:4 B4:4 D5:4 F#5:4 | E5:8 C#5:8 |
  D5:2 r:2 F#5:2 D5:2 r:2 B4:2 D5:4 | C#5:4 E5:4 A4:8 | B4:3 A4:3 G4:2 F#4:8 | A4:4 F#4:4 D4:8`, { v: 0.8 });

// 12–15 "High Sun on the Water" — D major, 108 bpm. Flute, the busiest hour; still leaves air.
const H_MIDDAY = [
  'D: F#3 A3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'D: F#3 A3 D4',
  'B: F#3 B3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'D: F#3 A3 D4',
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
];
const M_MIDDAY = P(`
  A4:2 r:2 D5:2 r:2 F#5:4 E5:2 D5:2 | C#5:6 r:2 A4:4 E4:4 | G4:2 r:2 B4:2 r:2 D5:4 B4:4 | A4:12 r:4 |
  F#4:2 r:2 B4:2 r:2 D5:4 F#5:4 | E5:4 C#5:4 A4:8 | B4:3 D5:3 G5:2 r:8 | E5:4 C#5:4 A4:4 r:4 |
  D5:4 F#5:4 B4:8 | C#5:4 A4:4 F#4:8 | G4:2 r:2 B4:2 D5:2 r:2 G5:2 D5:4 | F#5:8 A5:4 F#5:4 |
  E5:4 D5:4 B4:8 | C#5:4 E5:4 A4:8 | B4:4 G4:4 D5:8 | E5:8 C#5:8`, { v: 0.78 });

// 15–18 "Long Shadows on the Pier" — A mixolydian, 96 bpm. Lazy pluck, the G chord is the flat seventh.
const H_AFTERNOON = [
  'A: A3 C#4 E4', 'G: G3 B3 D4', 'D: A3 D4 F#4', 'A: A3 C#4 E4',
  'A: A3 C#4 E4', 'G: G3 B3 D4', 'E: E3 G3 B3 D4', 'D: F#3 A3 D4',
  'B: F#3 B3 D4', 'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'E: E3 G3 B3 D4', 'A: E3 A3 C#4',
];
const M_AFTERNOON = P(`
  E4:4 r:2 C#5:2 B4:4 A4:4 | G4:6 r:2 B4:4 D5:4 | A4:4 F#4:4 D4:8 | E4:12 r:4 |
  E4:4 r:2 C#5:2 B4:4 A4:4 | G4:4 B4:4 D5:4 E5:4 | D5:6 B4:2 G4:8 | A4:8 F#4:8 |
  F#4:4 B4:4 D5:8 | A4:4 F#4:4 D4:8 | G4:3 B4:3 D5:2 r:8 | E5:4 C#5:4 A4:8 |
  C#5:4 A4:4 F#4:8 | G4:4 B4:4 D5:8 | B4:6 D5:2 G4:8 | A4:4 B4:4 C#5:8`, { v: 0.72 });

// 18–21 "Lamps Along the Quay" — D major leaning B minor, 92 bpm. Heartmark quoted from G (G B D E) over the G chord.
const H_DUSK = [
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3 D4', 'A: E3 A3 C#4',
  'G: G3 B3 D4', 'D: F#3 A3 D4', 'B: F#3 B3 D4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'A: A3 D4 E4 / A: A3 C#4 E4',
];
const M_DUSK = P(`
  r:4 F#4:4 A4:4 D5:4 | B4:8 F#4:8 | G4:3 B4:3 D5:2 E5:8 | C#5:8 A4:8 |
  r:4 F#4:4 A4:4 D5:4 | B4:4 D5:4 F#5:8 | E5:4 D5:4 B4:8 | C#5:12 r:4 |
  G4:3 B4:3 D5:2 E5:8 | D5:4 A4:4 F#4:8 | F#4:4 B4:4 D5:8 | C#5:6 A4:2 F#4:8 |
  G4:3 B4:3 D5:2 E5:4 D5:4 | C#5:8 E5:8 | F#5:4 D5:4 B4:8 | E4:12 r:4`, { v: 0.7 });

// 21–24 "Porchlight" — B minor, 88 bpm. Bell melody like a music box; the night stem doubles it an octave up.
const H_NIGHT = [
  'B: B3 D4 F#4', 'F#: A3 C#4 F#4', 'G: G3 B3 D4', 'D: A3 D4 F#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'D: A3 D4 F#4',
  'E: E3 G3 B3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4',
];
const M_NIGHT = P(`
  B4:4 D5:4 F#5:4 E5:4 | C#5:8 A4:8 | B4:4 D5:4 G5:8 | F#5:8 D5:4 A4:4 |
  B4:4 D5:4 F#5:4 E5:4 | D5:4 B4:4 G4:8 | E4:4 G4:4 B4:8 | C#5:12 r:4 |
  r:4 G4:4 B4:4 D5:4 | C#5:8 E5:8 | F#5:4 D5:4 B4:8 | A4:4 D5:4 F#5:4 r:4 |
  E5:4 D5:4 B4:8 | D5:4 B4:4 G4:8 | A4:4 C#5:4 E5:8 | F#5:4 D5:4 B4:4 r:4`, { v: 0.62 });

export const DAY_PARTS = [
  theme('h_night_deep',   { title: 'Harbor Asleep',            bpm: 84,  key: 'B', scale: 'minor',      bars: H_NIGHT_DEEP,   melody: M_NIGHT_DEEP,   melodyInst: 'flute',   perc: 'whisper', bass: 'calm', padGain: 0.5, nightSteps: [0, 6, 10], motif: 'F#4 A4 B4 (rest) A4 — a sigh', mood: 'deep night, rigging creaks' }),
  theme('h_predawn',      { title: 'Before the Gulls',         bpm: 88,  key: 'E', scale: 'dorian',     bars: H_PREDAWN,      melody: M_PREDAWN,      melodyInst: 'pluck',   perc: 'whisper', bass: 'calm', padGain: 0.5, nightSteps: [0, 8],     motif: 'E4 G4 A4 B4 rising, answered by A4 G4 E4', mood: 'before dawn, first light' }),
  theme('h_morning',      { title: 'Porchlight Morning',       bpm: 100, key: 'D', scale: 'major',      bars: H_MORNING,      melody: M_MORNING,      melodyInst: 'pluck',   perc: 'brush',   bass: 'walk', padGain: 0.45, nightSteps: [0, 6, 10], motif: 'HEARTMARK D4 F#4 A4 B4 (home town theme)', mood: 'morning, doors opening' }),
  theme('h_late_morning', { title: 'Gull Market',              bpm: 104, key: 'G', scale: 'lydian',     bars: H_LATE_MORNING, melody: M_LATE_MORNING, melodyInst: 'marimba', perc: 'light',   bass: 'walk', padGain: 0.42, nightSteps: [0, 6, 10], motif: 'G4 . B4 D5 . E5 D5 — syncopated lydian bounce', mood: 'late morning, market' }),
  theme('h_midday',       { title: 'High Sun on the Water',    bpm: 108, key: 'D', scale: 'major',      bars: H_MIDDAY,       melody: M_MIDDAY,       melodyInst: 'flute',   perc: 'light',   bass: 'walk', padGain: 0.42, nightSteps: [0, 6, 10], motif: 'A4 . D5 . F#5 E5 D5 — a skipping stone', mood: 'midday, glare on the water' }),
  theme('h_afternoon',    { title: 'Long Shadows on the Pier', bpm: 96,  key: 'A', scale: 'mixolydian', bars: H_AFTERNOON,    melody: M_AFTERNOON,    melodyInst: 'pluck',   perc: 'brush',   bass: 'calm', padGain: 0.48, nightSteps: [0, 6, 10], motif: 'E4 . C#5 B4 A4 — lazy fall to the root', mood: 'afternoon, long shadows' }),
  theme('h_dusk',         { title: 'Lamps Along the Quay',     bpm: 92,  key: 'D', scale: 'major',      bars: H_DUSK,         melody: M_DUSK,         melodyInst: 'flute',   perc: 'brush',   bass: 'calm', padGain: 0.52, nightSteps: [0, 6, 10], motif: 'HEARTMARK from G: G4 B4 D5 E5 over the G chord', mood: 'dusk, lamps lit one by one' }),
  theme('h_night',        { title: 'Porchlight',               bpm: 88,  key: 'B', scale: 'minor',      bars: H_NIGHT,        melody: M_NIGHT,        melodyInst: 'bell',    perc: 'whisper', bass: 'calm', padGain: 0.5, nightSteps: [0, 4, 8, 12], motif: 'B4 D5 F#5 E5 — music box, up and settle', mood: 'night, porch lights' }),
];

// ---------------------------------------------------------------------------
// TITLE "Lighthouse" — D major, 72 bpm, 16 bars. Lighthouse swell = the tide layer (on by default here).
const H_TITLE = [
  'D: F#3 A3 D4', 'G: G3 B3 D4 F#4', 'A: A3 C#4 E4', 'D: A3 D4 F#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 D4 E4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'D: A3 D4 F#4',
  'E: E3 G3 B3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4 F#4', 'D: A3 D4 F#4',
];
const TITLE = {
  id: 'title', title: 'Lighthouse', bpm: 72, key: 'D', scale: 'major', bars: 16, stepsPerBar: 16,
  motif: 'HEARTMARK D4 F#4 A4 B4, then an octave up', mood: 'warm, slow, a beam sweeping the bay',
  layers: {
    core:   { inst: 'pad',   gain: 0.55, default: true, role: 'core',   pattern: padLayer(H_TITLE) },
    melody: { inst: 'flute', gain: 0.82, default: true, role: 'melody', pattern: P(`
      D4:4 F#4:4 A4:4 B4:4 | A4:12 r:4 | E4:4 F#4:4 A4:4 C#5:4 | D5:16 |
      D5:4 F#5:4 A5:4 B5:4 | A5:8 G5:4 F#5:4 | E5:8 D5:4 C#5:4 | E5:16 |
      A4:4 D5:4 F#5:4 A5:4 | C#5:8 A4:8 | B4:4 D5:4 G5:8 | F#5:12 r:4 |
      E5:4 G5:4 B5:8 | A5:8 E5:8 | F#5:4 D5:4 B4:4 A4:4 | D5:16`, { v: 0.7 }) },
    bass:   { inst: 'bass',  gain: 0.6,  default: true, role: 'bass',   pattern: bassLayer(H_TITLE, { style: 'calm' }) },
    night:  { inst: 'glass', gain: 0.45, default: true, role: 'night',  pattern: nightLayer(H_TITLE, { steps: [0, 8], v: 0.28 }) },
    tide:   { inst: 'pad',   gain: 0.5,  default: true, role: 'tide',   pattern: tideLayer(H_TITLE, { every: 4, v: 0.5 }) },
    perc:   { inst: 'kit',   gain: 0.4,  default: false, role: 'perc',  pattern: percLayer('whisper', 16) },
  },
};

// FORECAST — the Shift Forecast screen. 8 bars, 96 bpm, E dorian sus chords; glass ticking; nothing resolves.
const H_FORECAST = ['A: A3 B3 E4', 'E: E3 A3 B3', 'D: D4 E4 A4', 'G: G3 D4 F#4', 'A: A3 B3 E4', 'B: B3 E4 F#4', 'G: G3 B3 F#4', 'A: A3 D4 E4'];
const FORECAST = {
  id: 'forecast', title: 'Shift Forecast', bpm: 96, key: 'E', scale: 'dorian', bars: 8, stepsPerBar: 16,
  motif: 'E5 B4 glass tick every beat; melody only touches the 2nd and 6th', mood: 'suspended, glassy, ticking',
  layers: {
    core:   { inst: 'glass', gain: 0.6, default: true, role: 'core', pattern: rep(P('E5:2:0.4 r:2 B4:2:0.3 r:2 E5:2:0.35 r:2 B4:2:0.3 r:2'), 8, 16) },
    pad:    { inst: 'pad',   gain: 0.45, default: true, role: 'pad',  pattern: padLayer(H_FORECAST, { v: 0.5 }) },
    perc:   { inst: 'kit',   gain: 0.5, default: true, role: 'perc', pattern: percLayer('tick', 8) },
    melody: { inst: 'bell',  gain: 0.55, default: true, role: 'melody', pattern: P(`
      r:8 F#5:4 E5:4 | r:16 | A5:6 r:2 F#5:8 | r:16 | r:8 B5:4 C#6:4 | r:16 | F#5:4 E5:4 D5:8 | r:16`, { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.4, default: true, role: 'bass', pattern: bassLayer(H_FORECAST, { style: 'calm', v: 0.5 }) },
  },
};

// ---------------------------------------------------------------------------
// BATTLES — driving, but inside the town's tonal world.
function battle(id, { title, bpm, key, scale, bars, melody, counter, perc = 'drive', bass = 'drive', mood, motif, pad = true, extra = {} }) {
  const n = bars.length;
  const layers = {
    core:   { inst: 'pluck', gain: 0.5, default: true, role: 'core', pattern: pulseLayer(bars) },
    melody: { inst: 'pluck', gain: 0.8, default: true, role: 'melody', pattern: melody },
    bass:   { inst: 'bass',  gain: 0.7, default: true, role: 'bass', pattern: bassLayer(bars, { style: bass, v: 0.8 }) },
    perc:   { inst: 'kit',   gain: 0.8, default: true, role: 'perc', pattern: percLayer(perc, n) },
    tense:  { inst: 'glass', gain: 0.5, default: false, role: 'tense', pattern: tenseLayer(n) },
    ...extra,
  };
  if (pad) layers.pad = { inst: 'pad', gain: 0.35, default: true, role: 'pad', pattern: padLayer(bars, { v: 0.45 }) };
  if (counter) layers.counter = { inst: 'marimba', gain: 0.55, default: true, role: 'counter', pattern: counter };
  return { id, title, bpm, key, scale, bars: n, stepsPerBar: 16, mood, motif, layers };
}
/** Pulsing off-beat chord stabs (GBA-style two-pulse-lead energy). */
function pulseLayer(bars, { v = 0.45, spb = 16 } = {}) {
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
function brassLayer(bars, { v = 0.45, spb = 16, oct = 2 } = {}) {
  const out = [];
  bars.forEach((bar, i) => {
    const chords = parseBar(bar);
    const slice = spb / chords.length;
    chords.forEach((c, j) => { const r = rootMidi(c.root, oct); out.push({ t: i * spb + j * slice, n: [r + 7, r + 12], d: slice, v }); });
  });
  return out;
}
/** Low-HP layer: high tremolo on a minor-9th-ish colour plus extra sixteenth hats. */
function tenseLayer(bars) {
  const out = [];
  for (let i = 0; i < bars; i++) {
    for (let s = 0; s < 16; s += 2) out.push({ t: i * 16 + s, n: s % 4 === 0 ? midi('G6') : midi('F#6'), d: 1, v: 0.22 });
    out.push({ t: i * 16 + 15, n: midi('C#6'), d: 1, v: 0.25 });
  }
  return out;
}

const H_BATTLE_WILD = [
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3', 'F#: F#3 A3 C#4',
  'D: A3 D4 F#4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'G: G3 B3 D4',
  'E: E3 G3 B3', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
];
const BATTLE_WILD = battle('battle_wild', {
  title: 'Tall Grass', bpm: 126, key: 'B', scale: 'minor', bars: H_BATTLE_WILD, motif: 'F#5 . F#5 A5 B5 A5 F#5 — a snapped riff; B section lifts to D major',
  mood: 'wild battle: quick, bright, never menacing',
  melody: P(`
    F#5:2 r:2 F#5:2 A5:2 B5:4 A5:2 F#5:2 | E5:4 D5:2 E5:2 F#5:8 | G5:2 r:2 G5:2 B5:2 D6:4 B5:4 | A5:4 C#6:4 E5:8 |
    F#5:2 r:2 F#5:2 A5:2 B5:4 A5:2 F#5:2 | D5:4 E5:4 F#5:8 | G5:4 B5:4 E5:8 | C#5:4 E5:4 F#5:8 |
    A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4 | C#6:4 E6:4 A5:8 | B5:4 F#5:4 D5:8 | G5:2 B5:2 D6:2 B5:2 G5:8 |
    E5:4 G5:4 B5:8 | F#5:4 A5:4 C#6:8 | D6:4 B5:4 G5:8 | A5:4 C#6:4 E6:4 r:4`, { v: 0.78 }),
});

const H_BATTLE_TRAINER = [
  'F#: F#3 A3 C#4', 'D: F#3 A3 D4', 'B: F#3 B3 D4', 'A: E3 A3 C#4',
  'F#: F#3 A3 C#4', 'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: F#3 B3 D4', 'G: G3 B3 D4', 'D: F#3 A3 D4', 'A: E3 A3 C#4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
];
// Centred on F# but built from the town's two-sharp pitch set (G natural, never G#): F# phrygian, which the
// engine spells as B minor. The G-major bars (7, 15) are the Neapolitan lean that gives the rival his edge.
const BATTLE_TRAINER = battle('battle_trainer', {
  title: 'Across the Field', bpm: 132, key: 'B', scale: 'minor', bars: H_BATTLE_TRAINER, motif: 'C#5 F#5 A5 — stacked ascent, answered by the Heartmark rhythm',
  mood: 'trainer battle: a rival with a plan',
  melody: P(`
    C#5:2 F#5:2 A5:4 r:2 A5:2 F#5:4 | F#5:2 A5:2 D6:4 A5:4 F#5:4 | D5:2 F#5:2 B5:4 r:2 D6:2 B5:4 | C#6:4 A5:4 E5:4 r:4 |
    C#5:2 F#5:2 A5:4 r:2 A5:2 F#5:4 | A5:2 D6:2 F#6:4 D6:4 A5:4 | B5:4 D6:4 G5:8 | A5:2 C#6:2 E6:4 r:8 |
    F#5:3 B5:3 D6:2 F#6:8 | E6:4 D6:4 B5:8 | A5:3 D6:3 F#6:2 A6:8 | E6:4 C#6:4 A5:8 |
    D6:4 B5:4 F#5:8 | C#6:4 A5:4 F#5:8 | G5:4 B5:4 D6:8 | E6:8 C#6:4 A5:4`, { v: 0.8 }),
  // marimba answers on beat 3 with the current chord (A half), then a four-note chord arpeggio (B half)
  counter: cat(
    counterLayer(H_BATTLE_TRAINER.slice(0, 8), [[8, 0], [10, 1], [12, 2]], { v: 0.5, oct: 12 }),
    at(128, counterLayer(H_BATTLE_TRAINER.slice(8), [[4, 0], [6, 1], [12, 2], [14, 3]], { v: 0.5, oct: 12 }))),
});

// BATTLE_SPIRE — bigger: 120 bpm, 24 bars, low brass pedal (open fifths), quotes the Vagary motif (A G F# D).
const H_BATTLE_SPIRE = [
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'F#: F#3 A3 C#4',
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'B: B3 D4 F#4',
  'G: G3 B3 D4', 'E: E3 G3 B3', 'F#: F#3 A3 C#4', 'F#: F#3 A3 C#4',
];
const BATTLE_SPIRE = battle('battle_spire', {
  title: 'The Spire', bpm: 120, key: 'B', scale: 'minor', bars: H_BATTLE_SPIRE, perc: 'heavy', motif: 'VAGARY A5 G5 F#5 D5 falling, over a low brass B pedal',
  mood: 'Spire leader: heavier, wider, a storm coming in off the water',
  melody: P(`
    A5:4 G5:4 F#5:4 D5:4 | r:4 F#5:2 G5:2 F#5:4 D5:4 | B4:4 D5:4 G5:4 B5:4 | A5:4 F#5:4 C#5:8 |
    A5:4 G5:4 F#5:4 D5:4 | r:4 D5:2 F#5:2 B5:4 D6:4 | E6:4 D6:4 B5:8 | C#6:4 E6:4 A5:4 r:4 |
    F#5:2 r:2 A5:2 D6:2 F#6:4 D6:4 | B5:4 F#5:4 D5:8 | G5:2 r:2 B5:2 D6:2 G6:4 D6:4 | E6:4 C#6:4 A5:8 |
    F#6:4 D6:4 A5:8 | B5:8 F#5:8 | E5:4 G5:4 B5:4 D6:4 | C#6:12 r:4 |
    G5:4 B5:4 D6:8 | E6:4 C#6:4 A5:8 | A5:4 G5:4 F#5:4 D5:4 | A5:4 G5:4 F#5:4 D5:4 |
    G5:4 B5:4 D6:4 G6:4 | E6:8 B5:8 | A5:4 G5:4 F#5:4 C#5:4 | F#5:16`, { v: 0.8 }),
  // off-beat arpeggio of whatever the pad holds (B3 D4 F#4 B3 on the B bars; it bends with the G, E, F# and A bars)
  counter: counterLayer(H_BATTLE_SPIRE, [[2, 0], [6, 1], [10, 2], [14, 0]], { v: 0.45 }),
  extra: {
    brass: { inst: 'brass', gain: 0.4, default: true, role: 'brass', pattern: brassLayer(H_BATTLE_SPIRE) },
  },
});

// SUMMIT — biggest: 128 bpm, 32 bars, D major -> B minor; both motifs; bells.
const H_SUMMIT = [
  'D: F#3 A3 D4', 'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'A: E3 A3 C#4', 'B: F#3 B3 D4', 'G: G3 B3 D4',
  'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'F#: F#3 A3 C#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'E: E3 G3 B3', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'G: G3 B3 D4', 'B: B3 D4 F#4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'D: A3 D4 F#4', 'D: A3 D4 F#4',
];
const SUMMIT = battle('summit', {
  title: 'Summit', bpm: 128, key: 'D', scale: 'major', bars: H_SUMMIT, perc: 'heavy', motif: 'HEARTMARK D5 F#5 A5 B5 in sixteenth-note fire; VAGARY answers in the B-minor half',
  mood: 'final: everything the town has, at once',
  melody: P(`
    D5:2 F#5:2 A5:2 B5:2 A5:4 F#5:4 | D5:2 F#5:2 A5:2 B5:2 D6:8 | B5:2 D6:2 G5:4 B5:4 D6:4 | C#6:4 E6:4 A5:8 |
    D5:2 F#5:2 A5:2 B5:2 F#6:8 | E6:4 C#6:4 A5:8 | B5:4 D6:4 G5:8 | A5:4 C#6:4 E6:4 r:4 |
    F#6:4 D6:4 A5:8 | E6:4 C#6:4 A5:8 | D6:4 B5:4 F#5:8 | G5:4 B5:4 D6:8 |
    E6:2 D6:2 B5:4 G5:8 | C#6:4 A5:4 F#5:8 | G5:3 B5:3 D6:2 G6:8 | E6:8 C#6:8 |
    A5:4 G5:4 F#5:4 D5:4 | r:4 F#5:2 G5:2 F#5:4 D5:4 | B5:4 D6:4 G5:8 | C#6:4 A5:4 F#5:8 |
    A5:4 G5:4 F#5:4 D5:4 | G5:4 B5:4 D6:8 | E5:4 G5:4 B5:8 | C#6:8 E6:8 |
    D6:2 F#6:2 A6:2 B6:2 A6:4 F#6:4 | G6:4 D6:4 B5:8 | F#6:4 D6:4 B5:8 | C#6:4 A5:4 F#5:8 |
    G5:4 B5:4 D6:4 G6:4 | E6:4 C#6:4 A5:4 E5:4 | D5:2 F#5:2 A5:2 B5:2 D6:8 | D6:16`, { v: 0.82 }),
  // root-fifth-root-fifth-third ostinato that moves with the chords (D4 A4 … F#4 on D; B3 F#4 … D4 on Bm)
  counter: counterLayer(H_SUMMIT, [[0, 'r'], [4, '5'], [8, 'r'], [12, '5'], [14, '3']], { v: 0.45, lo: 57 }),
  extra: {
    bells: { inst: 'bell', gain: 0.4, default: true, role: 'bells', pattern: nightLayer(H_SUMMIT, { steps: [0, 8], v: 0.3 }) },
  },
});

// ---------------------------------------------------------------------------
// STINGS
const VICTORY = {
  id: 'victory', title: 'Caught the Light', bpm: 120, key: 'D', scale: 'major', bars: 4, stepsPerBar: 16, loop: false,
  motif: 'HEARTMARK D5 F#5 A5 B5 then a D major fanfare', mood: 'a 4-bar sting',
  layers: {
    melody: { inst: 'pluck', gain: 0.85, default: true, role: 'melody', pattern: P('D5:2 F#5:2 A5:2 B5:2 A5:4 D6:4 | r:2 D6:2 E6:2 F#6:10 | r:4 A5:2 B5:2 D6:8 | [D5,F#5,A5,D6]:16', { v: 0.85 }) },
    // bar 3 second half is Asus4 so the melody's held D6 is the suspension that resolves into bar 4, not a clash with C#
    core:   { inst: 'pad',   gain: 0.5,  default: true, role: 'core', pattern: P('[F#3,A3,D4]:8 [G3,B3,D4]:8 | [A3,C#4,E4]:16 | [G3,B3,D4]:8 [A3,D4,E4]:8 | [F#3,A3,D4,F#4]:16', { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.6,  default: true, role: 'bass', pattern: P('D2:6 r:2 G2:6 r:2 | A2:12 r:4 | G2:8 A2:8 | D2:16', { v: 0.75 }) },
    perc:   { inst: 'kit',   gain: 0.7,  default: true, role: 'perc', pattern: [{ t: 0, n: KICK, d: 1, v: 0.5 }, { t: 8, n: SNARE, d: 1, v: 0.4 }, { t: 16, n: KICK, d: 1, v: 0.5 }, { t: 24, n: SNARE, d: 1, v: 0.4 }, { t: 32, n: KICK, d: 1, v: 0.5 }, { t: 40, n: SNARE, d: 1, v: 0.45 }, { t: 44, n: SNARE, d: 1, v: 0.3 }, { t: 48, n: KICK, d: 1, v: 0.6 }] },
    bells:  { inst: 'glass', gain: 0.45, default: true, role: 'bells', pattern: P('r:48 D6:2 F#6:2 A6:2 B6:2 D7:8', { v: 0.35 }) },
  },
};

// Shift reveal: locked to the Wildshift animation (16.4): rising charge 18 f, granular scramble 36 f, resolved chord 36 f
// at 60 fps = 0.3 s + 0.6 s + 0.6 s. One bar of 32 steps at 150 bpm makes a step exactly 3 frames (0.05 s):
// charge = steps 0–5, scramble = 6–17, chord = 18–31 (0.7 s, the extra 0.1 s is ring-out).
const SHIFT_CHORD = ['D5', 'F#5', 'A5', 'B5', 'D6'].map(midi);
const SHIFT_REVEAL = {
  id: 'shift_reveal', title: 'Shift', bpm: 150, key: 'D', scale: 'major', bars: 1, stepsPerBar: 32, loop: false,
  motif: 'rising run (charge) → pentatonic scramble → HEARTMARK D F# A B as a chord (resolve)', mood: 'a 1.6 s rising sting; 0.3/0.6/0.7 s',
  layers: {
    melody: { inst: 'glass', gain: 0.7, default: true, role: 'melody', pattern: P(
      'D5:1 F#5:1 A5:1 B5:1 D6:1 F#6:1 ' +                                    // charge: Heartmark climbing, 6 steps
      'A6:1 D6:1 F#6:1 B5:1 E6:1 A5:1 G6:1 C#6:1 E5:1 B6:1 F#5:1 D7:1 ' +      // scramble: 12 steps of scattered D major
      '[D5,F#5,A5,B5,D6]:14', { v: 0.55 }) },                                 // resolve
    core:   { inst: 'pad',   gain: 0.5, default: true, role: 'core', pattern: P('[D3,A3,E4]:6 [E3,A3,D4]:12 [F#3,A3,D4,B4]:14', { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.6, default: true, role: 'bass', pattern: P('D2:18 D2:14', { v: 0.6 }) },
    perc:   { inst: 'kit',   gain: 0.5, default: true, role: 'perc', pattern: [{ t: 0, n: KICK, d: 1, v: 0.35 }, { t: 18, n: KICK, d: 1, v: 0.55 }, { t: 18, n: SNARE, d: 1, v: 0.3 }] },
  },
};
// "Anchor plays only the chord" (Wildshift 16.4): the resolve part alone on the same 32-step / 50 ms grid, so the chord holds
// exactly the chord phase (14 steps = 0.7 s) and the rest of the bar is ring-out.
const SHIFT_REVEAL_ANCHOR = {
  id: 'shift_reveal_anchor', title: 'Shift (Anchor)', bpm: 150, key: 'D', scale: 'major', bars: 1, stepsPerBar: 32, loop: false,
  motif: 'HEARTMARK chord only', mood: 'the resolved chord without the charge or scramble',
  layers: {
    melody: { inst: 'glass', gain: 0.7, default: true, role: 'melody', pattern: [{ t: 0, n: SHIFT_CHORD, d: 14, v: 0.55 }] },
    core:   { inst: 'pad',   gain: 0.5, default: true, role: 'core', pattern: P('[F#3,A3,D4,B4]:14', { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.6, default: true, role: 'bass', pattern: P('D2:14', { v: 0.6 }) },
    perc:   { inst: 'kit',   gain: 0.5, default: true, role: 'perc', pattern: [{ t: 0, n: KICK, d: 1, v: 0.55 }, { t: 0, n: SNARE, d: 1, v: 0.3 }] },
  },
};

// Letter: your Signal — six pentatonic chimes (D E F# A B D), 2 bars of music box.
export const SIGNAL_CHIMES = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'];
const LETTER = {
  id: 'letter', title: 'A Letter', bpm: 100, key: 'D', scale: 'pentatonic', bars: 2, stepsPerBar: 16, loop: false,
  motif: 'default Signal: D5 F#5 A5 B5 A5 D6 (player can re-author on the lease card)', mood: 'a 2-bar music-box sting',
  layers: {
    melody: { inst: 'glass', gain: 0.6, default: true, role: 'melody', pattern: P('D5:2 F#5:2 A5:2 B5:2 A5:4 D6:4 | [D5,A5]:8 r:8', { v: 0.5 }) },
    core:   { inst: 'bell',  gain: 0.35, default: true, role: 'core', pattern: P('r:4 [D4,F#4]:4 r:4 [A3,D4]:4 | [D4,F#4,A4]:8 r:8', { v: 0.3 }) },
  },
};

/** Builds a 'letter' sting from a player-authored Signal (6 indices 0..5 into SIGNAL_CHIMES). */
export function signalSting(indices = [0, 2, 3, 4, 3, 5]) {
  const notes = indices.map(i => SIGNAL_CHIMES[Math.max(0, Math.min(5, i | 0))]);
  const durs = [2, 2, 2, 2, 4, 4];
  const str = notes.map((n, i) => `${n}:${durs[i]}`).join(' ') + ' | [D5,A5]:8 r:8';
  return { ...LETTER, id: 'letter_signal', layers: { ...LETTER.layers, melody: { ...LETTER.layers.melody, pattern: P(str, { v: 0.5 }) } } };
}

// RELIGHTING — 24-bar build (80 bpm): pad alone, bass joins at 5, bells at 9, melody at 13, perc at 17, sustained D major with bells from 21.
const H_RELIGHT = [
  'D: A3 D4 F#4', 'D: A3 D4 F#4', 'G: G3 B3 D4', 'G: G3 B3 D4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'B: F#3 B3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
  'E: E3 G3 B3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4 F#4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4 F#4', 'D: F#3 A3 D4 F#4', 'D: F#3 A3 D4 F#4', 'D: F#3 A3 D4 F#4',
];
const RELIGHTING = {
  id: 'relighting', title: 'The Relighting', bpm: 80, key: 'D', scale: 'major', bars: 24, stepsPerBar: 16, loop: false,
  motif: 'HEARTMARK sung long (D4 F#4 A4 B4 at 4 steps each) over the final build; bells cascade on the sustained D', mood: 'a 24-bar build to one held chord',
  layers: {
    core:   { inst: 'pad',   gain: 0.55, default: true, role: 'core', pattern: padLayer(H_RELIGHT, { v: 0.5 }).map((e, i) => ({ ...e, v: 0.35 + 0.25 * Math.min(1, e.t / 320) })) },
    bass:   { inst: 'bass',  gain: 0.6,  default: true, role: 'bass', pattern: bassLayer(H_RELIGHT, { style: 'calm' }).filter(e => e.t >= 64) },
    bells:  { inst: 'glass', gain: 0.5,  default: true, role: 'bells', pattern: cat(
      nightLayer(H_RELIGHT.slice(8, 20), { steps: [0, 8], v: 0.3 }).map(e => ({ ...e, t: e.t + 128 })),
      at(320, rep(P('D5:2 F#5:2 A5:2 B5:2 D6:2 A5:2 F#5:2 B5:2 D6:2 F#6:2 A6:2 B5:2 D6:2 F#5:2 A5:2 D6:2', { v: 0.32 }), 2, 32))) },
    melody: { inst: 'flute', gain: 0.82, default: true, role: 'melody', pattern: at(192, P(`
      D4:4 F#4:4 A4:4 B4:4 | A4:12 r:4 | E4:4 F#4:4 A4:4 C#5:4 | D5:16 |
      D5:4 F#5:4 A5:4 B5:4 | A5:8 E5:8 | F#5:4 D5:4 B4:4 A4:4 | B4:8 C#5:8 |
      D5:32 | F#5:32`, { v: 0.7 })) },
    perc:   { inst: 'kit',   gain: 0.5,  default: true, role: 'perc', pattern: at(256, percLayer('brush', 4)) },
    swell:  { inst: 'pad',   gain: 0.5,  default: true, role: 'tide', pattern: [{ t: 320, n: [midi('D2'), midi('A2'), midi('D3')], d: 64, v: 0.6 }] },
  },
};

// LANTERN MARKET — Saturday-night waltz. 3/4: 12 steps per bar, 16 bars, 138 bpm. G lydian / D.
const H_WALTZ = [ // bar 2 is Bm so the lilt's held F#5 lands on a chord tone instead of a maj7 over the G downbeat
  'G: G3 B3 D4', 'B: F#3 B3 D4', 'D: F#3 A3 D4', 'D: F#3 A3 D4',
  'E: E3 G3 B3', 'A: E3 A3 C#4', 'D: F#3 A3 D4', 'D: F#3 A3 D4',
  'G: G3 B3 D4', 'B: F#3 B3 D4', 'E: E3 G3 B3', 'A: A3 C#4 E4',
  'G: G3 B3 D4', 'D: F#3 A3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4',
];
const LANTERN_MARKET = {
  id: 'lantern_market', title: 'Lantern Market Waltz', bpm: 138, key: 'G', scale: 'lydian', bars: 16, stepsPerBar: 12,
  motif: 'B4 D5 G5 (lilt) then the Heartmark from G: G4 B4 D5 E5 in bar 9', mood: 'Saturday night waltz, lanterns and cider',
  layers: {
    core:   { inst: 'pad',     gain: 0.4, default: true, role: 'core', pattern: padLayer(H_WALTZ, { v: 0.45, spb: 12 }) },
    melody: { inst: 'marimba', gain: 0.72, default: true, role: 'melody', pattern: P(`
      B4:4 D5:4 G5:4 | F#5:8 r:4 | A4:4 D5:4 F#5:4 | E5:8 D5:4 |
      B4:4 E5:4 G5:4 | A5:8 E5:4 | F#5:4 D5:4 A4:4 | D5:8 r:4 |
      G4:4 B4:4 D5:4 | E5:8 D5:4 | B4:4 D5:4 G5:4 | E5:8 r:4 |
      D5:4 B4:4 G4:4 | A4:4 D5:4 F#5:4 | E5:4 C#5:4 A4:4 | G4:8 r:4`, { v: 0.75 }) },
    bass:   { inst: 'bass',    gain: 0.5, default: true, role: 'bass', pattern: bassLayer(H_WALTZ, { style: 'waltz', spb: 12 }) },
    perc:   { inst: 'kit',     gain: 0.5, default: true, role: 'perc', pattern: percLayer('waltz', 16, 12) },
    night:  { inst: 'glass',   gain: 0.45, default: true, role: 'night', pattern: nightLayer(H_WALTZ, { spb: 12, steps: [0, 8], v: 0.26 }) },
    rain:   { inst: 'rhodes',  gain: 0.4, default: false, role: 'rain', pattern: rainLayer(H_WALTZ, { spb: 12, steps: [2, 6, 10], v: 0.3 }) },
  },
};

// CREDITS — 84 bpm, 32 bars: the title melody, then the morning (home town) melody, then the title's last line.
const H_CREDITS = [...H_TITLE, ...H_MORNING];
const CREDITS = {
  id: 'credits', title: 'Harbor Lights (Credits)', bpm: 84, key: 'D', scale: 'major', bars: 32, stepsPerBar: 16,
  motif: 'Lighthouse melody into Porchlight Morning; both carry the Heartmark', mood: 'a slow walk home along the quay',
  layers: {
    core:   { inst: 'pad',   gain: 0.5, default: true, role: 'core', pattern: padLayer(H_CREDITS, { v: 0.5 }) },
    melody: { inst: 'flute', gain: 0.82, default: true, role: 'melody', pattern: cat(TITLE.layers.melody.pattern, at(256, M_MORNING)) },
    bass:   { inst: 'bass',  gain: 0.6, default: true, role: 'bass', pattern: bassLayer(H_CREDITS, { style: 'calm' }) },
    perc:   { inst: 'kit',   gain: 0.45, default: true, role: 'perc', pattern: at(256, percLayer('brush', 16)) },
    night:  { inst: 'glass', gain: 0.4, default: true, role: 'night', pattern: nightLayer(H_CREDITS, { steps: [0, 8], v: 0.26 }) },
    tide:   { inst: 'pad',   gain: 0.45, default: true, role: 'tide', pattern: tideLayer(H_CREDITS, { every: 4, v: 0.45 }) },
  },
};

// ---------------------------------------------------------------------------
export const TRACKS = Object.fromEntries([
  ...DAY_PARTS, TITLE, FORECAST, BATTLE_WILD, BATTLE_TRAINER, BATTLE_SPIRE, SUMMIT,
  VICTORY, SHIFT_REVEAL, SHIFT_REVEAL_ANCHOR, LETTER, RELIGHTING, LANTERN_MARKET, CREDITS,
].map(t => [t.id, t]));

/** Hour (0-23) -> day-part theme id. */
export function themeForHour(hour) {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  return DAY_PARTS[Math.floor(h / 3)].id;
}

/** Two-bar bridge length in ms at a track's tempo (the hour-change crossfade). */
export function twoBarsMs(track) {
  const beatsPerBar = (track.stepsPerBar || 16) / 4;
  return Math.round(2 * beatsPerBar * 60000 / track.bpm);
}

/**
 * CUES: game moment -> track + stem rules. Pure data plus tiny evaluators the game loop can call with
 * state = {hour, minute, weekday (0=Sun), weather: 'clear'|'rain'|'fog'|'storm', tide: 0..1, season,
 *          place: 'town'|'market'|'mud'|'spire'|'summit'..., hpRatio}.
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

/** Engine layer names a stem name controls on a track (handles the kit split). */
export function stemLayers(track, stem) {
  const L = track.layers[stem];
  if (!L) return [];
  if (L.inst !== 'kit') return [stem];
  const voices = new Set(L.pattern.map(e => KIT_VOICES[Array.isArray(e.n) ? e.n[0] : e.n] || 'hat'));
  return [...voices].map(v => `${stem}.${v}`);
}

/** Engine layer names that should be ON when a track starts (before world-state rules apply). */
export function defaultStems(track) {
  const on = [];
  for (const [name, L] of Object.entries(track.layers)) if (L.default !== false) on.push(...stemLayers(track, name));
  return on;
}

/**
 * Applies a {stem: bool} map to the engine for a track, fanning kit stems out to their engine layers.
 * `engine` needs `setStem(name, on)`. Returns the engine layer names touched.
 */
export function applyStems(engine, track, state) {
  const touched = [];
  for (const [stem, on] of Object.entries(state)) {
    for (const name of stemLayers(track, stem)) { engine.setStem(name, Boolean(on)); touched.push(name); }
  }
  return touched;
}

/** Evaluates CUES.world for a world state: {track, fade, stems: {name: bool}, intensity}. */
export function worldCue(state) {
  const id = CUES.world.pick(state);
  const track = TRACKS[id];
  const stems = {};
  for (const [name, rule] of Object.entries(CUES.world.stems)) if (track.layers[name]) stems[name] = Boolean(rule(state));
  return { track: id, fade: CUES.world.fade(id), stems, intensity: CUES.world.intensity(state) };
}

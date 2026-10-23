/**
 * Track `h_night_deep`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_night_deep
 */
import { P, theme } from './compose.js';

// 00–03 "Harbor Asleep" — B minor, 84 bpm. Flute in long tones with a rest at every phrase end; low tide ticks live in the perc whisper.
/** Harmony: one hand-voiced chord string per bar. */
export const H_NIGHT_DEEP = [
  'B: B3 D4 F#4', 'G: G3 B3 D4 F#4', 'D: A3 D4 F#4', 'E: E3 G3 B3 D4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4', 'B: B3 D4 F#4',
  'D: A3 D4 F#4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'G: G3 B3 D4',
  'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
];
/** Melody pattern (P() DSL, written as sheet music). */
export const M_NIGHT_DEEP = P(`
  r:4 F#4:4 A4:4 B4:4 | A4:8 r:8 | F#4:4 E4:4 D4:6 r:2 | E4:8 r:8 |
  r:4 F#4:4 A4:4 B4:4 | D5:6 C#5:2 B4:4 A4:4 | F#4:12 r:4 | E4:8 F#4:8 |
  r:4 A4:4 B4:4 D5:4 | C#5:8 E5:4 D5:4 | B4:8 D5:4 F#5:4 | G5:8 r:8 |
  E5:4 D5:4 B4:8 | C#5:8 A4:8 | B4:6 D5:2 B4:4 G4:4 | F#4:6 E4:6 r:4`, { v: 0.6 }); // last bar: 6-5 suspension over A, so the loop steps E4 -> F#4 back into the sigh

/** The `h_night_deep` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_night_deep',   { title: 'Harbor Asleep',            bpm: 84,  key: 'B', scale: 'minor',      bars: H_NIGHT_DEEP,   melody: M_NIGHT_DEEP,   melodyInst: 'flute',   perc: 'whisper', bass: 'calm', padGain: 0.5, nightSteps: [0, 6, 10], motif: 'F#4 A4 B4 (rest) A4 — a sigh', mood: 'deep night, rigging creaks' });

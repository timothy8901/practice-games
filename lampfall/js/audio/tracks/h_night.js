/**
 * Track `h_night`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_night
 */
import { P, theme } from './compose.js';

// 21–24 "Porchlight" — B minor, 88 bpm. Bell melody like a music box; the night stem doubles it an octave up.
/** Harmony: one hand-voiced chord string per bar. */
export const H_NIGHT = [
  'B: B3 D4 F#4', 'F#: A3 C#4 F#4', 'G: G3 B3 D4', 'D: A3 D4 F#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'D: A3 D4 F#4',
  'E: E3 G3 B3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4',
];
/** Melody pattern (P() DSL, written as sheet music). */
export const M_NIGHT = P(`
  B4:4 D5:4 F#5:4 E5:4 | C#5:8 A4:8 | B4:4 D5:4 G5:8 | F#5:8 D5:4 A4:4 |
  B4:4 D5:4 F#5:4 E5:4 | D5:4 B4:4 G4:8 | E4:4 G4:4 B4:8 | C#5:12 r:4 |
  r:4 G4:4 B4:4 D5:4 | C#5:8 E5:8 | F#5:4 D5:4 B4:8 | A4:4 D5:4 F#5:4 r:4 |
  E5:4 D5:4 B4:8 | D5:4 B4:4 G4:8 | A4:4 C#5:4 E5:8 | F#5:4 D5:4 B4:4 r:4`, { v: 0.62 });

/** The `h_night` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_night',        { title: 'Porchlight',               bpm: 88,  key: 'B', scale: 'minor',      bars: H_NIGHT,        melody: M_NIGHT,        melodyInst: 'bell',    perc: 'whisper', bass: 'calm', padGain: 0.5, nightSteps: [0, 4, 8, 12], motif: 'B4 D5 F#5 E5 — music box, up and settle', mood: 'night, porch lights' });

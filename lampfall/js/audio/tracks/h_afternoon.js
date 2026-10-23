/**
 * Track `h_afternoon`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_afternoon
 */
import { P, theme } from './compose.js';

// 15–18 "Long Shadows on the Pier" — A mixolydian, 96 bpm. Lazy pluck, the G chord is the flat seventh.
/** Harmony: one hand-voiced chord string per bar. */
export const H_AFTERNOON = [
  'A: A3 C#4 E4', 'G: G3 B3 D4', 'D: A3 D4 F#4', 'A: A3 C#4 E4',
  'A: A3 C#4 E4', 'G: G3 B3 D4', 'E: E3 G3 B3 D4', 'D: F#3 A3 D4',
  'B: F#3 B3 D4', 'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'E: E3 G3 B3 D4', 'A: E3 A3 C#4',
];
/** Melody pattern (P() DSL, written as sheet music). */
export const M_AFTERNOON = P(`
  E4:4 r:2 C#5:2 B4:4 A4:4 | G4:6 r:2 B4:4 D5:4 | A4:4 F#4:4 D4:8 | E4:12 r:4 |
  E4:4 r:2 C#5:2 B4:4 A4:4 | G4:4 B4:4 D5:4 E5:4 | D5:6 B4:2 G4:8 | A4:8 F#4:8 |
  F#4:4 B4:4 D5:8 | A4:4 F#4:4 D4:8 | G4:3 B4:3 D5:2 r:8 | E5:4 C#5:4 A4:8 |
  C#5:4 A4:4 F#4:8 | G4:4 B4:4 D5:8 | B4:6 D5:2 G4:8 | A4:4 B4:4 C#5:8`, { v: 0.72 });

/** The `h_afternoon` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_afternoon',    { title: 'Long Shadows on the Pier', bpm: 96,  key: 'A', scale: 'mixolydian', bars: H_AFTERNOON,    melody: M_AFTERNOON,    melodyInst: 'pluck',   perc: 'brush',   bass: 'calm', padGain: 0.48, nightSteps: [0, 6, 10], motif: 'E4 . C#5 B4 A4 — lazy fall to the root', mood: 'afternoon, long shadows' });

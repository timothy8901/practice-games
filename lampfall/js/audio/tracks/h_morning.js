/**
 * Track `h_morning`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_morning
 */
import { P, theme } from './compose.js';

// 06–09 "Porchlight Morning" — D major, 100 bpm. HOME TOWN theme: opens with the Heartmark motif D F# A B.
/** Harmony: one hand-voiced chord string per bar. */
export const H_MORNING = [
  'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4', 'D: A3 D4 F#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4', 'D: F#3 A3 D4',
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'F#: F#3 A3 C#4', 'B: F#3 B3 D4',
  'G: G3 B3 D4', 'D: F#3 A3 D4', 'G: G3 B3 D4 / A: A3 C#4 E4', 'D: A3 D4 F#4',
];
/** Melody pattern (P() DSL, written as sheet music). */
export const M_MORNING = P(`
  D4:3 F#4:3 A4:2 B4:8 | A4:4 G4:2 F#4:2 G4:8 | E4:3 F#4:3 G4:2 A4:4 C#5:4 | D5:12 r:4 |
  D4:3 F#4:3 A4:2 B4:8 | D5:4 B4:4 G4:8 | A4:3 B4:3 C#5:2 E5:8 | D5:8 r:8 |
  r:4 B4:4 D5:4 E5:4 | C#5:6 E5:2 A4:8 | F#4:4 A4:4 C#5:8 | D5:4 B4:4 F#4:8 |
  G4:3 B4:3 D5:2 B4:8 | A4:4 F#4:4 D4:8 | G4:4 F#4:4 E4:4 C#4:4 | D4:12 r:4`, { v: 0.8 });

/** The `h_morning` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_morning',      { title: 'Porchlight Morning',       bpm: 100, key: 'D', scale: 'major',      bars: H_MORNING,      melody: M_MORNING,      melodyInst: 'pluck',   perc: 'brush',   bass: 'walk', padGain: 0.45, nightSteps: [0, 6, 10], motif: 'HEARTMARK D4 F#4 A4 B4 (home town theme)', mood: 'morning, doors opening' });

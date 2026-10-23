/**
 * Track `h_predawn`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_predawn
 */
import { P, theme } from './compose.js';

// 03–06 "Before the Gulls" — E dorian, 88 bpm. Plucked guitar, rising hopeful motif E G A B.
/** Harmony: one hand-voiced chord string per bar. */
export const H_PREDAWN = [
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'D: F#3 A3 D4', 'B: F#3 B3 D4',
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4',
  'D: F#3 A3 D4', 'G: G3 B3 D4', 'E: E3 G3 B3', 'A: E3 A3 C#4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
];
/** Melody pattern (P() DSL, written as sheet music). */
export const M_PREDAWN = P(`
  E4:3 G4:3 A4:2 B4:8 | r:4 A4:2 G4:2 E4:8 | F#4:3 A4:3 D5:2 r:8 | D5:4 B4:4 F#4:8 |
  E4:3 G4:3 A4:2 B4:8 | C#5:4 B4:4 A4:4 r:4 | B4:6 A4:2 G4:4 F#4:4 | E4:12 r:4 |
  r:2 D5:2 E5:2 F#5:6 E5:4 | D5:8 B4:8 | E4:4 G4:4 B4:8 | C#5:6 B4:2 A4:4 r:4 |
  F#4:4 B4:4 D5:8 | C#5:4 A4:4 F#4:4 r:4 | G4:4 B4:4 D5:4 B4:4 | A4:4 B4:4 C#5:8`, { v: 0.7 });

/** The `h_predawn` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_predawn',      { title: 'Before the Gulls',         bpm: 88,  key: 'E', scale: 'dorian',     bars: H_PREDAWN,      melody: M_PREDAWN,      melodyInst: 'pluck',   perc: 'whisper', bass: 'calm', padGain: 0.5, nightSteps: [0, 8],     motif: 'E4 G4 A4 B4 rising, answered by A4 G4 E4', mood: 'before dawn, first light' });

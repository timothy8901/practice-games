/**
 * Track `h_late_morning`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_late_morning
 */
import { P, theme } from './compose.js';

// 09–12 "Gull Market" — G lydian, 104 bpm. Marimba, syncopated, the II chord (A) gives the lydian lift.
/** Harmony: one hand-voiced chord string per bar. */
export const H_LATE_MORNING = [
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4', 'D: A3 D4 F#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'D: A3 D4 F#4',
  'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: B3 D4 F#4', 'A: A3 C#4 E4', 'G: G3 B3 D4 F#4', 'D: A3 D4 F#4',
];
/** Melody pattern (P() DSL, written as sheet music). */
// Polish (w3, design/polish-backlog.md): this was the busiest tune of the day (65 notes), ahead of midday. The
// syncopated bounce stays in every motif bar; the fills between them lose a neighbour note each: 55 notes.
export const M_LATE_MORNING = P(`
  G4:2 r:2 B4:2 D5:2 r:2 E5:2 D5:4 | C#5:4 E5:4 A4:8 | G4:2 r:2 B4:2 D5:2 r:4 G4:4 | F#4:4 A4:4 D5:8 |
  G4:2 r:2 B4:2 D5:2 r:2 E5:2 F#5:4 | E5:4 C#5:4 A4:8 | B4:4 D5:4 F#5:8 | E5:4 D5:4 A4:8 |
  E4:2 r:2 B4:2 D5:2 r:4 G4:4 | F#4:2 r:2 C#5:2 E5:2 r:4 A4:4 | G4:4 B4:4 D5:8 | E5:8 C#5:8 |
  D5:2 r:2 F#5:2 D5:2 r:2 B4:6 | C#5:4 E5:4 A4:8 | B4:4 G4:4 F#4:8 | A4:4 F#4:4 D4:8`, { v: 0.8 });

/** The `h_late_morning` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_late_morning', { title: 'Gull Market',              bpm: 104, key: 'G', scale: 'lydian',     bars: H_LATE_MORNING, melody: M_LATE_MORNING, melodyInst: 'marimba', perc: 'light',   bass: 'walk', padGain: 0.42, nightSteps: [0, 6, 10], motif: 'G4 . B4 D5 . E5 D5 — syncopated lydian bounce', mood: 'late morning, market' });

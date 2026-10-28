/**
 * Track `h_dusk`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_dusk
 */
import { P, theme } from './compose.js';

// 18–21 "Lamps Along the Quay" — D major leaning B minor, 92 bpm. Heartmark quoted from G (G B D E) over the G chord.
/** Harmony: one hand-voiced chord string per bar. */
export const H_DUSK = [
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3 D4', 'A: E3 A3 C#4',
  'G: G3 B3 D4', 'D: F#3 A3 D4', 'B: F#3 B3 D4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'A: A3 D4 E4 / A: A3 C#4 E4',
];
/** Melody pattern (P() DSL, written as sheet music). */
// Polish (w3, design/polish-backlog.md): the dusk line had the least rest of the day (6 %), so the evening never
// breathed. Long notes now lift early (a breath after each phrase), bar 11 opens on a rest like bar 1, and bar 13
// restates the Heartmark cell of bar 3 instead of adding a note: 43 notes, ~19 % rest.
export const M_DUSK = P(`
  r:4 F#4:4 A4:4 D5:4 | B4:6 r:2 F#4:6 r:2 | G4:3 B4:3 D5:2 E5:8 | C#5:8 A4:4 r:4 |
  r:4 F#4:4 A4:4 D5:4 | B4:4 D5:4 F#5:6 r:2 | E5:6 D5:2 B4:4 r:4 | C#5:12 r:4 |
  G4:3 B4:3 D5:2 E5:8 | D5:6 A4:2 F#4:4 r:4 | r:4 B4:4 D5:8 | C#5:6 A4:2 F#4:4 r:4 |
  G4:3 B4:3 D5:2 E5:8 | C#5:6 r:2 E5:8 | F#5:4 D5:4 B4:6 r:2 | E4:12 r:4`, { v: 0.7 });

/** The `h_dusk` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_dusk',         { title: 'Lamps Along the Quay',     bpm: 92,  key: 'D', scale: 'major',      bars: H_DUSK,         melody: M_DUSK,         melodyInst: 'flute',   perc: 'brush',   bass: 'calm', padGain: 0.52, nightSteps: [0, 6, 10], motif: 'HEARTMARK from G: G4 B4 D5 E5 over the G chord', mood: 'dusk, lamps lit one by one' });

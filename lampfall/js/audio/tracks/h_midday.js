/**
 * Track `h_midday`: one of the eight day-part themes (see the comment above its harmony).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/h_midday
 */
import { P, theme } from './compose.js';

// 12–15 "High Sun on the Water" — D major, 108 bpm. Flute, the busiest hour; still leaves air.
/** Harmony: one hand-voiced chord string per bar. */
export const H_MIDDAY = [
  'D: F#3 A3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'D: F#3 A3 D4',
  'B: F#3 B3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'D: F#3 A3 D4',
  'E: E3 G3 B3 D4', 'A: E3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
];
/** Melody pattern (P() DSL, written as sheet music). */
// Polish (w3, design/polish-backlog.md): midday is meant to be the busiest hour but had fewer notes than late
// morning. The skipping-stone figure (two on, two off, chord tones only) now skips through bars 6, 9, 10 and
// 13–16 as well: 58 notes, and more rest than before (~18 %), so it is busier and still airy.
export const M_MIDDAY = P(`
  A4:2 r:2 D5:2 r:2 F#5:4 E5:2 D5:2 | C#5:6 r:2 A4:4 E4:4 | G4:2 r:2 B4:2 r:2 D5:4 B4:4 | A4:12 r:4 |
  F#4:2 r:2 B4:2 r:2 D5:4 F#5:4 | E5:2 r:2 C#5:2 E5:2 A4:8 | B4:3 D5:3 G5:2 r:8 | E5:4 C#5:4 A4:4 r:4 |
  D5:2 r:2 F#5:2 D5:2 B4:8 | C#5:2 r:2 A4:2 C#5:2 F#4:8 | G4:2 r:2 B4:2 D5:2 r:2 G5:2 D5:4 | F#5:8 A5:4 F#5:4 |
  E5:2 r:2 G5:2 E5:2 B4:8 | C#5:2 r:2 E5:2 C#5:2 A4:8 | B4:2 r:2 G4:2 B4:2 D5:8 | E5:6 D5:2 C#5:8`, { v: 0.78 });

/** The `h_midday` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = theme('h_midday',       { title: 'High Sun on the Water',    bpm: 108, key: 'D', scale: 'major',      bars: H_MIDDAY,       melody: M_MIDDAY,       melodyInst: 'flute',   perc: 'light',   bass: 'walk', padGain: 0.42, nightSteps: [0, 6, 10], motif: 'A4 . D5 . F#5 E5 D5 — a skipping stone', mood: 'midday, glare on the water' });

/**
 * Track `battle_trainer`: the trainer-battle theme "Across the Field".
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/battle_trainer
 */
import { P, battle, cat, at, counterLayer } from './compose.js';

/** Harmony: one hand-voiced chord string per bar. */
export const H_BATTLE_TRAINER = [
  'F#: F#3 A3 C#4', 'D: F#3 A3 D4', 'B: F#3 B3 D4', 'A: E3 A3 C#4',
  'F#: F#3 A3 C#4', 'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: F#3 B3 D4', 'G: G3 B3 D4', 'D: F#3 A3 D4', 'A: E3 A3 C#4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
];
// Centred on F# but built from the town's two-sharp pitch set (G natural, never G#): F# phrygian, which the
// engine spells as B minor. The G-major bars (7, 15) are the Neapolitan lean that gives the rival his edge.
/** Track definition (also exported as `TRACK`). */
export const BATTLE_TRAINER = battle('battle_trainer', {
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

/** The `battle_trainer` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = BATTLE_TRAINER;

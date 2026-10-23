/**
 * Track `summit`: the Summit (final) battle theme.
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/summit
 */
import { P, battle, counterLayer, nightLayer } from './compose.js';

// SUMMIT — biggest: 128 bpm, 32 bars, D major -> B minor; both motifs; bells.
/** Harmony: one hand-voiced chord string per bar. */
export const H_SUMMIT = [
  'D: F#3 A3 D4', 'D: F#3 A3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: F#3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'A: E3 A3 C#4', 'B: F#3 B3 D4', 'G: G3 B3 D4',
  'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'F#: F#3 A3 C#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'E: E3 G3 B3', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'G: G3 B3 D4', 'B: B3 D4 F#4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'D: A3 D4 F#4', 'D: A3 D4 F#4',
];
/** Track definition (also exported as `TRACK`). */
export const SUMMIT = battle('summit', {
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

/** The `summit` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = SUMMIT;

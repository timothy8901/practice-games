/**
 * Track `battle_wild`: the wild-battle theme "Tall Grass".
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/battle_wild
 */
import { P, battle } from './compose.js';

/** Harmony: one hand-voiced chord string per bar. */
export const H_BATTLE_WILD = [
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3', 'F#: F#3 A3 C#4',
  'D: A3 D4 F#4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'G: G3 B3 D4',
  'E: E3 G3 B3', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
];
/** Track definition (also exported as `TRACK`). */
export const BATTLE_WILD = battle('battle_wild', {
  title: 'Tall Grass', bpm: 126, key: 'B', scale: 'minor', bars: H_BATTLE_WILD, motif: 'F#5 . F#5 A5 B5 A5 F#5 — a snapped riff; B section lifts to D major',
  mood: 'wild battle: quick, bright, never menacing',
  melody: P(`
    F#5:2 r:2 F#5:2 A5:2 B5:4 A5:2 F#5:2 | E5:4 D5:2 E5:2 F#5:8 | G5:2 r:2 G5:2 B5:2 D6:4 B5:4 | A5:4 C#6:4 E5:8 |
    F#5:2 r:2 F#5:2 A5:2 B5:4 A5:2 F#5:2 | D5:4 E5:4 F#5:8 | G5:4 B5:4 E5:8 | C#5:4 E5:4 F#5:8 |
    A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4 | C#6:4 E6:4 A5:8 | B5:4 F#5:4 D5:8 | G5:2 B5:2 D6:2 B5:2 G5:8 |
    E5:4 G5:4 B5:8 | F#5:4 A5:4 C#6:8 | D6:4 B5:4 G5:8 | A5:4 C#6:4 E6:4 r:4`, { v: 0.78 }),
});

/** The `battle_wild` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = BATTLE_WILD;

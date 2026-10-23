/**
 * Track `battle_spire`: the Spire-leader battle theme.
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/battle_spire
 */
import { P, battle, counterLayer, brassLayer } from './compose.js';

// BATTLE_SPIRE — bigger: 120 bpm, 24 bars, low brass pedal (open fifths), quotes the Vagary motif (A G F# D).
/** Harmony: one hand-voiced chord string per bar. */
export const H_BATTLE_SPIRE = [
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'F#: F#3 A3 C#4',
  'B: B3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'E: E3 G3 B3 D4', 'F#: F#3 A3 C#4',
  'G: G3 B3 D4', 'A: A3 C#4 E4', 'B: B3 D4 F#4', 'B: B3 D4 F#4',
  'G: G3 B3 D4', 'E: E3 G3 B3', 'F#: F#3 A3 C#4', 'F#: F#3 A3 C#4',
];
/** Track definition (also exported as `TRACK`). */
export const BATTLE_SPIRE = battle('battle_spire', {
  title: 'The Spire', bpm: 120, key: 'B', scale: 'minor', bars: H_BATTLE_SPIRE, perc: 'heavy', motif: 'VAGARY A5 G5 F#5 D5 falling, over a low brass B pedal',
  mood: 'Spire leader: heavier, wider, a storm coming in off the water',
  melody: P(`
    A5:4 G5:4 F#5:4 D5:4 | r:4 F#5:2 G5:2 F#5:4 D5:4 | B4:4 D5:4 G5:4 B5:4 | A5:4 F#5:4 C#5:8 |
    A5:4 G5:4 F#5:4 D5:4 | r:4 D5:2 F#5:2 B5:4 D6:4 | E6:4 D6:4 B5:8 | C#6:4 E6:4 A5:4 r:4 |
    F#5:2 r:2 A5:2 D6:2 F#6:4 D6:4 | B5:4 F#5:4 D5:8 | G5:2 r:2 B5:2 D6:2 G6:4 D6:4 | E6:4 C#6:4 A5:8 |
    F#6:4 D6:4 A5:8 | B5:8 F#5:8 | E5:4 G5:4 B5:4 D6:4 | C#6:12 r:4 |
    G5:4 B5:4 D6:8 | E6:4 C#6:4 A5:8 | A5:4 G5:4 F#5:4 D5:4 | A5:4 G5:4 F#5:4 D5:4 |
    G5:4 B5:4 D6:4 G6:4 | E6:8 B5:8 | A5:4 G5:4 F#5:4 C#5:4 | F#5:16`, { v: 0.8 }),
  // off-beat arpeggio of whatever the pad holds (B3 D4 F#4 B3 on the B bars; it bends with the G, E, F# and A bars)
  counter: counterLayer(H_BATTLE_SPIRE, [[2, 0], [6, 1], [10, 2], [14, 0]], { v: 0.45 }),
  extra: {
    brass: { inst: 'brass', gain: 0.4, default: true, role: 'brass', pattern: brassLayer(H_BATTLE_SPIRE) },
  },
});

/** The `battle_spire` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = BATTLE_SPIRE;

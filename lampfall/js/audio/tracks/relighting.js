/**
 * Track `relighting`: the 24-bar Relighting build (one-shot).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/relighting
 */
import { P, midi, at, rep, cat, padLayer, bassLayer, nightLayer, percLayer } from './compose.js';

// RELIGHTING — 24-bar build (80 bpm): pad alone, bass joins at 5, bells at 9, melody at 13, perc at 17, sustained D major with bells from 21.
/** Harmony: one hand-voiced chord string per bar. */
export const H_RELIGHT = [
  'D: A3 D4 F#4', 'D: A3 D4 F#4', 'G: G3 B3 D4', 'G: G3 B3 D4',
  'D: A3 D4 F#4', 'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'B: F#3 B3 D4', 'G: G3 B3 D4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'A: A3 D4 E4 / A: A3 C#4 E4',
  'E: E3 G3 B3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4 F#4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4 F#4', 'D: F#3 A3 D4 F#4', 'D: F#3 A3 D4 F#4', 'D: F#3 A3 D4 F#4',
];
/** Track definition (also exported as `TRACK`). */
export const RELIGHTING = {
  id: 'relighting', title: 'The Relighting', bpm: 80, key: 'D', scale: 'major', bars: 24, stepsPerBar: 16, loop: false,
  motif: 'HEARTMARK sung long (D4 F#4 A4 B4 at 4 steps each) over the final build; bells cascade on the sustained D', mood: 'a 24-bar build to one held chord',
  layers: {
    core:   { inst: 'pad',   gain: 0.55, default: true, role: 'core', pattern: padLayer(H_RELIGHT, { v: 0.5 }).map((e, i) => ({ ...e, v: 0.35 + 0.25 * Math.min(1, e.t / 320) })) },
    bass:   { inst: 'bass',  gain: 0.6,  default: true, role: 'bass', pattern: bassLayer(H_RELIGHT, { style: 'calm' }).filter(e => e.t >= 64) },
    bells:  { inst: 'glass', gain: 0.5,  default: true, role: 'bells', pattern: cat(
      nightLayer(H_RELIGHT.slice(8, 20), { steps: [0, 8], v: 0.3 }).map(e => ({ ...e, t: e.t + 128 })),
      at(320, rep(P('D5:2 F#5:2 A5:2 B5:2 D6:2 A5:2 F#5:2 B5:2 D6:2 F#6:2 A6:2 B5:2 D6:2 F#5:2 A5:2 D6:2', { v: 0.32 }), 2, 32))) },
    melody: { inst: 'flute', gain: 0.82, default: true, role: 'melody', pattern: at(192, P(`
      D4:4 F#4:4 A4:4 B4:4 | A4:12 r:4 | E4:4 F#4:4 A4:4 C#5:4 | D5:16 |
      D5:4 F#5:4 A5:4 B5:4 | A5:8 E5:8 | F#5:4 D5:4 B4:4 A4:4 | B4:8 C#5:8 |
      D5:32 | F#5:32`, { v: 0.7 })) },
    perc:   { inst: 'kit',   gain: 0.5,  default: true, role: 'perc', pattern: at(256, percLayer('brush', 4)) },
    swell:  { inst: 'pad',   gain: 0.5,  default: true, role: 'tide', pattern: [{ t: 320, n: [midi('D2'), midi('A2'), midi('D3')], d: 64, v: 0.6 }] },
  },
};

/** The `relighting` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = RELIGHTING;

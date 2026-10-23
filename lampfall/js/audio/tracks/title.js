/**
 * Track `title`: the title screen theme "Lighthouse".
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/title
 */
import { P, padLayer, bassLayer, nightLayer, tideLayer, percLayer } from './compose.js';

// TITLE "Lighthouse" — D major, 72 bpm, 16 bars. Lighthouse swell = the tide layer (on by default here).
/** Harmony: one hand-voiced chord string per bar. */
export const H_TITLE = [
  'D: F#3 A3 D4', 'G: G3 B3 D4 F#4', 'A: A3 C#4 E4', 'D: A3 D4 F#4',
  'B: B3 D4 F#4', 'G: G3 B3 D4', 'A: A3 D4 E4', 'A: A3 C#4 E4',
  'D: F#3 A3 D4', 'F#: F#3 A3 C#4', 'G: G3 B3 D4', 'D: A3 D4 F#4',
  'E: E3 G3 B3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4 F#4', 'D: A3 D4 F#4',
];
/** Track definition (also exported as `TRACK`). */
export const TITLE = {
  id: 'title', title: 'Lighthouse', bpm: 72, key: 'D', scale: 'major', bars: 16, stepsPerBar: 16,
  motif: 'HEARTMARK D4 F#4 A4 B4, then an octave up', mood: 'warm, slow, a beam sweeping the bay',
  layers: {
    core:   { inst: 'pad',   gain: 0.55, default: true, role: 'core',   pattern: padLayer(H_TITLE) },
    melody: { inst: 'flute', gain: 0.82, default: true, role: 'melody', pattern: P(`
      D4:4 F#4:4 A4:4 B4:4 | A4:12 r:4 | E4:4 F#4:4 A4:4 C#5:4 | D5:16 |
      D5:4 F#5:4 A5:4 B5:4 | A5:8 G5:4 F#5:4 | E5:8 D5:4 C#5:4 | E5:16 |
      A4:4 D5:4 F#5:4 A5:4 | C#5:8 A4:8 | B4:4 D5:4 G5:8 | F#5:12 r:4 |
      E5:4 G5:4 B5:8 | A5:8 E5:8 | F#5:4 D5:4 B4:4 A4:4 | D5:16`, { v: 0.7 }) },
    bass:   { inst: 'bass',  gain: 0.6,  default: true, role: 'bass',   pattern: bassLayer(H_TITLE, { style: 'calm' }) },
    night:  { inst: 'glass', gain: 0.45, default: true, role: 'night',  pattern: nightLayer(H_TITLE, { steps: [0, 8], v: 0.28 }) },
    tide:   { inst: 'pad',   gain: 0.5,  default: true, role: 'tide',   pattern: tideLayer(H_TITLE, { every: 4, v: 0.5 }) },
    perc:   { inst: 'kit',   gain: 0.4,  default: false, role: 'perc',  pattern: percLayer('whisper', 16) },
  },
};

/** The `title` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = TITLE;

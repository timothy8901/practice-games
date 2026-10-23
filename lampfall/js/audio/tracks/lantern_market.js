/**
 * Track `lantern_market`: the Saturday-night Lantern Market waltz (3/4).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/lantern_market
 */
import { P, padLayer, bassLayer, percLayer, nightLayer, rainLayer } from './compose.js';

// LANTERN MARKET — Saturday-night waltz. 3/4: 12 steps per bar, 16 bars, 138 bpm. G lydian / D.
/** Harmony: one hand-voiced chord string per bar. */
export const H_WALTZ = [ // bar 2 is Bm so the lilt's held F#5 lands on a chord tone instead of a maj7 over the G downbeat
  'G: G3 B3 D4', 'B: F#3 B3 D4', 'D: F#3 A3 D4', 'D: F#3 A3 D4',
  'E: E3 G3 B3', 'A: E3 A3 C#4', 'D: F#3 A3 D4', 'D: F#3 A3 D4',
  'G: G3 B3 D4', 'B: F#3 B3 D4', 'E: E3 G3 B3', 'A: A3 C#4 E4',
  'G: G3 B3 D4', 'D: F#3 A3 D4', 'A: A3 C#4 E4', 'G: G3 B3 D4',
];
/** Track definition (also exported as `TRACK`). */
export const LANTERN_MARKET = {
  id: 'lantern_market', title: 'Lantern Market Waltz', bpm: 138, key: 'G', scale: 'lydian', bars: 16, stepsPerBar: 12,
  motif: 'B4 D5 G5 (lilt) then the Heartmark from G: G4 B4 D5 E5 in bar 9', mood: 'Saturday night waltz, lanterns and cider',
  layers: {
    core:   { inst: 'pad',     gain: 0.4, default: true, role: 'core', pattern: padLayer(H_WALTZ, { v: 0.45, spb: 12 }) },
    melody: { inst: 'marimba', gain: 0.72, default: true, role: 'melody', pattern: P(`
      B4:4 D5:4 G5:4 | F#5:8 r:4 | A4:4 D5:4 F#5:4 | E5:8 D5:4 |
      B4:4 E5:4 G5:4 | A5:8 E5:4 | F#5:4 D5:4 A4:4 | D5:8 r:4 |
      G4:4 B4:4 D5:4 | E5:8 D5:4 | B4:4 D5:4 G5:4 | E5:8 r:4 |
      D5:4 B4:4 G4:4 | A4:4 D5:4 F#5:4 | E5:4 C#5:4 A4:4 | G4:8 r:4`, { v: 0.75 }) },
    bass:   { inst: 'bass',    gain: 0.5, default: true, role: 'bass', pattern: bassLayer(H_WALTZ, { style: 'waltz', spb: 12 }) },
    perc:   { inst: 'kit',     gain: 0.5, default: true, role: 'perc', pattern: percLayer('waltz', 16, 12) },
    night:  { inst: 'glass',   gain: 0.45, default: true, role: 'night', pattern: nightLayer(H_WALTZ, { spb: 12, steps: [0, 8], v: 0.26 }) },
    rain:   { inst: 'rhodes',  gain: 0.4, default: false, role: 'rain', pattern: rainLayer(H_WALTZ, { spb: 12, steps: [2, 6, 10], v: 0.3 }) },
  },
};

/** The `lantern_market` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = LANTERN_MARKET;

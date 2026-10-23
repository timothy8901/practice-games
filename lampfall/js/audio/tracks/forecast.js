/**
 * Track `forecast`: the Shift Forecast screen loop.
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/forecast
 */
import { P, rep, padLayer, bassLayer, percLayer } from './compose.js';

// FORECAST — the Shift Forecast screen. 8 bars, 96 bpm, E dorian sus chords; glass ticking; nothing resolves.
/** Harmony: one hand-voiced chord string per bar. */
export const H_FORECAST = ['A: A3 B3 E4', 'E: E3 A3 B3', 'D: D4 E4 A4', 'G: G3 D4 F#4', 'A: A3 B3 E4', 'B: B3 E4 F#4', 'G: G3 B3 F#4', 'A: A3 D4 E4'];
/** Track definition (also exported as `TRACK`). */
export const FORECAST = {
  id: 'forecast', title: 'Shift Forecast', bpm: 96, key: 'E', scale: 'dorian', bars: 8, stepsPerBar: 16,
  motif: 'E5 B4 glass tick every beat; melody only touches the 2nd and 6th', mood: 'suspended, glassy, ticking',
  layers: {
    core:   { inst: 'glass', gain: 0.6, default: true, role: 'core', pattern: rep(P('E5:2:0.4 r:2 B4:2:0.3 r:2 E5:2:0.35 r:2 B4:2:0.3 r:2'), 8, 16) },
    pad:    { inst: 'pad',   gain: 0.45, default: true, role: 'pad',  pattern: padLayer(H_FORECAST, { v: 0.5 }) },
    perc:   { inst: 'kit',   gain: 0.5, default: true, role: 'perc', pattern: percLayer('tick', 8) },
    melody: { inst: 'bell',  gain: 0.55, default: true, role: 'melody', pattern: P(`
      r:8 F#5:4 E5:4 | r:16 | A5:6 r:2 F#5:8 | r:16 | r:8 B5:4 C#6:4 | r:16 | F#5:4 E5:4 D5:8 | r:16`, { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.4, default: true, role: 'bass', pattern: bassLayer(H_FORECAST, { style: 'calm', v: 0.5 }) },
  },
};

/** The `forecast` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = FORECAST;

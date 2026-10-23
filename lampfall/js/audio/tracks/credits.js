/**
 * Track `credits`: the credits theme "Harbor Lights".
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/credits
 */
import { at, cat, padLayer, bassLayer, percLayer, nightLayer, tideLayer } from './compose.js';
import { H_TITLE, TRACK as TITLE } from './title.js';
import { H_MORNING, M_MORNING } from './h_morning.js';

// CREDITS — 84 bpm, 32 bars: the title melody, then the morning (home town) melody, then the title's last line.
/** Harmony: one hand-voiced chord string per bar. */
export const H_CREDITS = [...H_TITLE, ...H_MORNING];
/** Track definition (also exported as `TRACK`). */
export const CREDITS = {
  id: 'credits', title: 'Harbor Lights (Credits)', bpm: 84, key: 'D', scale: 'major', bars: 32, stepsPerBar: 16,
  motif: 'Lighthouse melody into Porchlight Morning; both carry the Heartmark', mood: 'a slow walk home along the quay',
  layers: {
    core:   { inst: 'pad',   gain: 0.5, default: true, role: 'core', pattern: padLayer(H_CREDITS, { v: 0.5 }) },
    melody: { inst: 'flute', gain: 0.82, default: true, role: 'melody', pattern: cat(TITLE.layers.melody.pattern, at(256, M_MORNING)) },
    bass:   { inst: 'bass',  gain: 0.6, default: true, role: 'bass', pattern: bassLayer(H_CREDITS, { style: 'calm' }) },
    perc:   { inst: 'kit',   gain: 0.45, default: true, role: 'perc', pattern: at(256, percLayer('brush', 16)) },
    night:  { inst: 'glass', gain: 0.4, default: true, role: 'night', pattern: nightLayer(H_CREDITS, { steps: [0, 8], v: 0.26 }) },
    tide:   { inst: 'pad',   gain: 0.45, default: true, role: 'tide', pattern: tideLayer(H_CREDITS, { every: 4, v: 0.45 }) },
  },
};

/** The `credits` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = CREDITS;

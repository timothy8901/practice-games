/**
 * Track `shift_reveal_anchor`: the Anchor variant of the Shift sting: the resolved chord alone (one-shot).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/shift_reveal_anchor
 */
import { P, KICK, SNARE } from './compose.js';
import { SHIFT_CHORD } from './shift_reveal.js';

// "Anchor plays only the chord" (Wildshift 16.4): the resolve part alone on the same 32-step / 50 ms grid, so the chord holds
// exactly the chord phase (14 steps = 0.7 s) and the rest of the bar is ring-out.
/** Track definition (also exported as `TRACK`). */
export const SHIFT_REVEAL_ANCHOR = {
  id: 'shift_reveal_anchor', title: 'Shift (Anchor)', bpm: 150, key: 'D', scale: 'major', bars: 1, stepsPerBar: 32, loop: false,
  motif: 'HEARTMARK chord only', mood: 'the resolved chord without the charge or scramble',
  layers: {
    melody: { inst: 'glass', gain: 0.7, default: true, role: 'melody', pattern: [{ t: 0, n: SHIFT_CHORD, d: 14, v: 0.55 }] },
    core:   { inst: 'pad',   gain: 0.5, default: true, role: 'core', pattern: P('[F#3,A3,D4,B4]:14', { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.6, default: true, role: 'bass', pattern: P('D2:14', { v: 0.6 }) },
    perc:   { inst: 'kit',   gain: 0.5, default: true, role: 'perc', pattern: [{ t: 0, n: KICK, d: 1, v: 0.55 }, { t: 0, n: SNARE, d: 1, v: 0.3 }] },
  },
};

/** The `shift_reveal_anchor` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = SHIFT_REVEAL_ANCHOR;

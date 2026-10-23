/**
 * Track `victory`: the 4-bar victory sting (one-shot).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/victory
 */
import { P, KICK, SNARE } from './compose.js';

// STINGS
/** Track definition (also exported as `TRACK`). */
export const VICTORY = {
  id: 'victory', title: 'Caught the Light', bpm: 120, key: 'D', scale: 'major', bars: 4, stepsPerBar: 16, loop: false,
  motif: 'HEARTMARK D5 F#5 A5 B5 then a D major fanfare', mood: 'a 4-bar sting',
  layers: {
    melody: { inst: 'pluck', gain: 0.85, default: true, role: 'melody', pattern: P('D5:2 F#5:2 A5:2 B5:2 A5:4 D6:4 | r:2 D6:2 E6:2 F#6:10 | r:4 A5:2 B5:2 D6:8 | [D5,F#5,A5,D6]:16', { v: 0.85 }) },
    // bar 3 second half is Asus4 so the melody's held D6 is the suspension that resolves into bar 4, not a clash with C#
    core:   { inst: 'pad',   gain: 0.5,  default: true, role: 'core', pattern: P('[F#3,A3,D4]:8 [G3,B3,D4]:8 | [A3,C#4,E4]:16 | [G3,B3,D4]:8 [A3,D4,E4]:8 | [F#3,A3,D4,F#4]:16', { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.6,  default: true, role: 'bass', pattern: P('D2:6 r:2 G2:6 r:2 | A2:12 r:4 | G2:8 A2:8 | D2:16', { v: 0.75 }) },
    perc:   { inst: 'kit',   gain: 0.7,  default: true, role: 'perc', pattern: [{ t: 0, n: KICK, d: 1, v: 0.5 }, { t: 8, n: SNARE, d: 1, v: 0.4 }, { t: 16, n: KICK, d: 1, v: 0.5 }, { t: 24, n: SNARE, d: 1, v: 0.4 }, { t: 32, n: KICK, d: 1, v: 0.5 }, { t: 40, n: SNARE, d: 1, v: 0.45 }, { t: 44, n: SNARE, d: 1, v: 0.3 }, { t: 48, n: KICK, d: 1, v: 0.6 }] },
    bells:  { inst: 'glass', gain: 0.45, default: true, role: 'bells', pattern: P('r:48 D6:2 F#6:2 A6:2 B6:2 D7:8', { v: 0.35 }) },
  },
};

/** The `victory` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = VICTORY;

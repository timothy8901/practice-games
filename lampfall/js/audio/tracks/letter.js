/**
 * Track `letter`: the letter sting (the Signal on a music box) and the player-Signal builder (one-shot).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/letter
 */
import { P } from './compose.js';

// Letter: your Signal — six pentatonic chimes (D E F# A B D), 2 bars of music box.
/** The six pentatonic chimes a Signal is written on (D E F# A B D). */
export const SIGNAL_CHIMES = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'];
/** Track definition (also exported as `TRACK`). */
export const LETTER = {
  id: 'letter', title: 'A Letter', bpm: 100, key: 'D', scale: 'pentatonic', bars: 2, stepsPerBar: 16, loop: false,
  motif: 'default Signal: D5 F#5 A5 B5 A5 D6 (player can re-author on the lease card)', mood: 'a 2-bar music-box sting',
  layers: {
    melody: { inst: 'glass', gain: 0.6, default: true, role: 'melody', pattern: P('D5:2 F#5:2 A5:2 B5:2 A5:4 D6:4 | [D5,A5]:8 r:8', { v: 0.5 }) },
    core:   { inst: 'bell',  gain: 0.35, default: true, role: 'core', pattern: P('r:4 [D4,F#4]:4 r:4 [A3,D4]:4 | [D4,F#4,A4]:8 r:8', { v: 0.3 }) },
  },
};

/** Builds a 'letter' sting from a player-authored Signal (6 indices 0..5 into SIGNAL_CHIMES). */
export function signalSting(indices = [0, 2, 3, 4, 3, 5]) {
  const notes = indices.map(i => SIGNAL_CHIMES[Math.max(0, Math.min(5, i | 0))]);
  const durs = [2, 2, 2, 2, 4, 4];
  const str = notes.map((n, i) => `${n}:${durs[i]}`).join(' ') + ' | [D5,A5]:8 r:8';
  return { ...LETTER, id: 'letter_signal', layers: { ...LETTER.layers, melody: { ...LETTER.layers.melody, pattern: P(str, { v: 0.5 }) } } };
}

/** The `letter` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = LETTER;

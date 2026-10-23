/**
 * Track `shift_reveal`: the Shift reveal sting, locked to the 0.3/0.6/0.7 s reveal animation (one-shot).
 * Moved verbatim from `proto/music/tracks.js` (every note as the music director verified it).
 * Pure data. [AUDIO]
 * @module audio/tracks/shift_reveal
 */
import { P, midi, KICK, SNARE } from './compose.js';

// Shift reveal: locked to the Wildshift animation (16.4): rising charge 18 f, granular scramble 36 f, resolved chord 36 f
// at 60 fps = 0.3 s + 0.6 s + 0.6 s. One bar of 32 steps at 150 bpm makes a step exactly 3 frames (0.05 s):
// charge = steps 0–5, scramble = 6–17, chord = 18–31 (0.7 s, the extra 0.1 s is ring-out).
/** The Heartmark chord D5 F#5 A5 B5 D6 as MIDI notes (the resolve of every Shift sting). */
export const SHIFT_CHORD = ['D5', 'F#5', 'A5', 'B5', 'D6'].map(midi);
/** Track definition (also exported as `TRACK`). */
export const SHIFT_REVEAL = {
  id: 'shift_reveal', title: 'Shift', bpm: 150, key: 'D', scale: 'major', bars: 1, stepsPerBar: 32, loop: false,
  motif: 'rising run (charge) → pentatonic scramble → HEARTMARK D F# A B as a chord (resolve)', mood: 'a 1.6 s rising sting; 0.3/0.6/0.7 s',
  layers: {
    melody: { inst: 'glass', gain: 0.7, default: true, role: 'melody', pattern: P(
      'D5:1 F#5:1 A5:1 B5:1 D6:1 F#6:1 ' +                                    // charge: Heartmark climbing, 6 steps
      'A6:1 D6:1 F#6:1 B5:1 E6:1 A5:1 G6:1 C#6:1 E5:1 B6:1 F#5:1 D7:1 ' +      // scramble: 12 steps of scattered D major
      '[D5,F#5,A5,B5,D6]:14', { v: 0.55 }) },                                 // resolve
    core:   { inst: 'pad',   gain: 0.5, default: true, role: 'core', pattern: P('[D3,A3,E4]:6 [E3,A3,D4]:12 [F#3,A3,D4,B4]:14', { v: 0.5 }) },
    bass:   { inst: 'bass',  gain: 0.6, default: true, role: 'bass', pattern: P('D2:18 D2:14', { v: 0.6 }) },
    perc:   { inst: 'kit',   gain: 0.5, default: true, role: 'perc', pattern: [{ t: 0, n: KICK, d: 1, v: 0.35 }, { t: 18, n: KICK, d: 1, v: 0.55 }, { t: 18, n: SNARE, d: 1, v: 0.3 }] },
  },
};

/** The `shift_reveal` track definition. @type {import('./index.js').TrackDef} */
export const TRACK = SHIFT_REVEAL;

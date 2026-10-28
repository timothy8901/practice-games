/**
 * Creature cries from species data. [AUDIO] — GDD-09 §10.5, first-hour review FH-13 / top10 #8.
 *
 * {@link cryParams} turns a species row into the `audio.cry({base, slide, wave, tail})` voice:
 *  - `base` (MIDI) by stage: 0 → 76, 1 → 69, 2 → 62, 3 → 55, 4 → 50, plus `hash(speciesId) % 5 − 2`,
 *    and a size tilt (a 96-cell form sits 5 semitones lower; a 24-cell form 3 higher);
 *  - `slide` (semitones over the cry) and `wave` by primary type (the §10.5 table; Bolt slides up an
 *    octave and snaps back);
 *  - `tail`: bonded creatures end on the shared two-note tail (A5, D6), so a creature still sounds
 *    like itself after a Shift; Star-touched forms add the octave `shimmer`; the Vagary cries its
 *    falling motif (A G F# D) on glass.
 * Deterministic: the same species always cries the same (FNV hash of the id; no rng stream).
 *
 * Pure and Node-importable: no DOM, no WebAudio.
 * @module audio/cries
 */
import { hashString } from '../core/audio.js';

/** Base MIDI note by evolution stage (GDD-09 §10.5). */
export const STAGE_BASE = Object.freeze([76, 69, 62, 55, 50]);

/** Slide (semitones) by primary type. */
export const TYPE_SLIDE = Object.freeze({
  plain: 0, grit: -2, brine: -3, kiln: 4, moss: 2, bolt: 12, rime: 5, gust: 7, stone: -5, rust: -7, glass: 9, hollow: -12, star: 12,
});

/** Waveform by primary type. */
export const TYPE_WAVE = Object.freeze({
  brine: 'sine', rime: 'sine', glass: 'sine', star: 'sine',
  plain: 'triangle', moss: 'triangle', gust: 'triangle', hollow: 'triangle',
  grit: 'square', bolt: 'square', kiln: 'saw', stone: 'saw', rust: 'sawNoise',
});

/** The Vagary's falling motif (A4 G4 F#4 D4). */
export const VAGARY_MOTIF = Object.freeze([69, 67, 66, 62]);

/**
 * The cry voice of a species.
 * @param {{id?: string, stage?: number, types?: string[], flags?: {size?: number}}|null|undefined} species  a species row
 * @param {{bonded?: boolean, star?: boolean, speciesId?: string, types?: string[]}} [o]
 *   `bonded`: the creature's Heartmark is lit (adds the tail); `star`: Star-touched (adds the shimmer);
 *   `speciesId` / `types` stand in when the row is missing (a placeholder form)
 * @returns {{base: number, slide: number, wave: string, tail: boolean, snap: boolean, shimmer: boolean, motif?: number[]}}
 */
export function cryParams(species, o = {}) {
  const id = String(species?.id ?? o.speciesId ?? 'unknown');
  const stage = Number.isInteger(species?.stage) ? Math.max(0, Math.min(4, species.stage)) : 1;
  const type = String((species?.types ?? o.types ?? ['Plain'])[0] ?? 'Plain').toLowerCase();
  const size = Number(species?.flags?.size) || 32;
  const sizeTilt = size >= 96 ? -5 : size <= 24 ? 3 : 0;
  const base = STAGE_BASE[stage] + ((hashString(id) % 5) - 2) + sizeTilt;
  const out = {
    base,
    slide: TYPE_SLIDE[type] ?? 0,
    wave: TYPE_WAVE[type] ?? 'triangle',
    tail: !!o.bonded,
    snap: type === 'bolt',
    shimmer: !!o.star,
  };
  if (id === 'vagary') return { ...out, motif: VAGARY_MOTIF.slice(), tail: false };
  return out;
}

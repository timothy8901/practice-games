/**
 * Credits roll lines. [DATA-IDX]
 *
 * Rows `{id, heading, lines}` in roll order; `scenes/credits.js` draws them one heading at a time.
 * Blank `lines` entries are spacing. // [GDD] names and the closing line come from the panel.
 * @module data/credits
 */

/** @type {ReadonlyArray<Readonly<{id: string, heading: string, lines: readonly string[]}>>} */
export const CREDITS = Object.freeze([
  Object.freeze({ id: 'title', heading: 'GAME', lines: Object.freeze(['[GDD] title card']) }),
  Object.freeze({ id: 'design', heading: 'Design', lines: Object.freeze(['PLACEHOLDER: the design panel']) }),
  Object.freeze({ id: 'engineering', heading: 'Engineering', lines: Object.freeze(['PLACEHOLDER: the lane engineers']) }),
  Object.freeze({ id: 'art', heading: 'Art', lines: Object.freeze(['PLACEHOLDER: pixel art, string-encoded']) }),
  Object.freeze({ id: 'music', heading: 'Music and sound', lines: Object.freeze(['PLACEHOLDER: procedural WebAudio']) }),
  Object.freeze({ id: 'thanks', heading: 'Thanks', lines: Object.freeze(['PLACEHOLDER: every playtester', '']) }),
  Object.freeze({ id: 'closing', heading: '', lines: Object.freeze(['[GDD] closing line']) }),
]);

export default CREDITS;

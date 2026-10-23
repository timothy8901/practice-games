/**
 * Credits roll lines. [DATA-IDX] (GDD-09 §9.3)
 *
 * Rows `{id, heading, lines}` in roll order; `scenes/credits.js` draws them one heading at a time
 * over the beam, the tally wall, Odile's canvases and the Seed Card. Blank `lines` entries are
 * spacing (one 10 px line each). The only real-world handle here is the repo owner's.
 * @module data/credits
 */

/**
 * @param {string} id @param {string} heading @param {string[]} lines
 * @returns {Readonly<{id: string, heading: string, lines: readonly string[]}>}
 */
const row = (id, heading, lines) => Object.freeze({ id, heading, lines: Object.freeze(lines) });

/** @type {ReadonlyArray<Readonly<{id: string, heading: string, lines: readonly string[]}>>} */
export const CREDITS = Object.freeze([
  row('title', 'LAMPFALL', ["A Keeper's Season on the Brindle Isles", '']),
  row('studio', 'A game by', ["Token Maxxer's Anonymous Game Studio", '']),
  row('direction', 'Direction', ['timothy8901', '']),
  row('inspirations', 'Grown from two pitches', [
    'WILDSHIFT',
    'creatures that Shift on odds you read first',
    '',
    'PORCHLIGHT',
    'a harbor town that lives on a real tide',
    '',
    'Two pitches, one town, one clock.',
  ]),
  row('design', 'Design', [
    'A panel of three judges and one decisions file',
    'Nine chapters, every number written down',
    '',
  ]),
  row('built-with', 'Built with', [
    'Made with Claude Code',
    'Plain JavaScript, one 480×270 canvas, no build step',
    '',
  ]),
  row('art', 'Pixel art', [
    'Every creature, neighbor and roof drawn in palette letters',
    'Night ink, cream, porchlight amber and one comet magenta',
    '',
  ]),
  row('music', 'Music and sound', [
    'Played live by WebAudio, eight themes for eight parts of the day',
    'The Heartmark motif: D, F#, A, B. It never changes.',
    '',
  ]),
  row('residents', 'The people of Pellwick', [
    'Wren Hearthwright, who lent you a roof',
    'Ambrose Hearthwright, who notched it wide',
    'Hesper Coil, a little late, every morning',
    'Juniper Pell, who kept the shop open on credit',
    'Ludo, buying from the eave all night',
    'Barnaby Thole, Exhibit 1',
    'Dimity, who kept your place',
    'Augusta Skerry, Harbor Warden',
    'Ansel Stalk, at the weir wheel',
    'Wick Dorrow, who called you Keeper first',
    'Tully, never the slowest',
    'Odile, twelve canvases',
    'Bryony, over a lower fence',
    'Thessaly, on her bench',
    'Tamsin Brack, under sail',
    'Corin Vale, who taught you to look',
    'Linnet Rask, who asked you to read it',
    '',
  ]),
  row('isles', 'On the isles', [
    'Maud Tallis, who always asks first',
    'Osric, Ines, Wendel, Ada and Ivo, Seraphine',
    'Hollis Brandt and the Readers\' fund',
    'Agathe Merrow and the Mooring',
    'Teo Varga and the Scatter',
    'Bastien Kell, Cass Rune and Idris Fenwake',
    '',
  ]),
  row('keeper', 'And the last keeper', ['Isolde Petrel, on a thirty-year road', '']),
  row('creatures', 'And the creatures', ['Every one of them, in every shape', 'Same mark, same spot', '']),
  row('thanks', 'Thanks', [
    'To everyone who sat on the porch a little longer',
    'To whoever keeps the next light',
    '',
  ]),
  row('seed-card', 'Your Seed Card', ['is on the last page of the Season Book', '']),
  row('closing', '', ["Read the odds. Pay what's owed. Keep the light."]),
]);

export default CREDITS;

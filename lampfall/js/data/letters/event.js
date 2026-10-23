/**
 * The two event letters. [DATA-LETTERS] GDD-08 §5.
 *
 * E1, the Lantern letter: posted to Pell's in Isolde's twenty-seventh year away, "to be kept with
 * the lantern"; Juniper brings it up the point with Isolde's Lantern at 17:30 on the Relighting
 * (systems/letters.deliverEvent(world, data, 'lantern')). E2: post-credits, the one letter in the
 * sack that is not from the backlog, postmarked last week from the Outer Isles
 * (deliverEvent(..., 'saw-the-light')). Both are canon text (GDD-00 §11). E2 is the only letter
 * outside the 40-160 word band, by canon. Global serial numbers: E = n 57-58.
 * Pure data: no imports, no function values in the export.
 * @module data/letters/event
 */

/** @type {ReadonlyArray<import('../index.js').Letter>} */
const EVENT = [
  {
    id: 'e1', n: 57, index: 1, channel: 'event', event: 'lantern',
    author: 'isolde', byline: null, from: 'Isolde Petrel', to: 'Whoever lights it', addressee: 'player', seal: 'petrel',
    date: 'The twenty-seventh year; care of Pell\'s Sundries, to be kept with the lantern',
    deliver: { at: 'event', event: 'lantern', script: 'the-relighting' },
    relicId: null, unlock: null,
    subject: 'The Lantern letter.',
    reveal: [{ op: 'setFlag', id: 'np.corin.lantern-letter' }],
    body: 'You lit it. I know because the lantern\'s in your hand and I left it on Juniper\'s counter for exactly this.|The wanderer is back tonight. It drinks light; it will come to yours. Don\'t fight it. Read it, the way you\'d read anything else with a mark: three ways, odds showing, and then choose.|I taught a boy on the Isles to do this. He\'ll have taught you.|—Isolde Petrel, Keeper',
  },
  {
    id: 'e2', n: 58, index: 2, channel: 'event', event: 'saw-the-light',
    author: 'isolde', byline: null, from: 'I. Petrel', to: 'The Keeper, Point Cottage', addressee: 'player', seal: 'outer-isles',
    date: 'Postmarked last week, the Outer Isles',
    deliver: { at: 'event', event: 'saw-the-light', script: 'coda-morning' },
    relicId: null, unlock: null,
    subject: '"I saw the light."',
    envelope: 'A postcard of a black rock in a grey sea, one small white tower on it. The stamp is new. The handwriting is the same, a little shakier.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.saw-the-light' }],
    body: 'I saw the light.|—I. Petrel',
  },
];

export default EVENT;

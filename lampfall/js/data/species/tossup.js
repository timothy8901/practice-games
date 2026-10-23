/**
 * Tossup (GDD-00 §8 family 12; wildshift-creatures §3.13). [DATA-SPECIES]
 * One form. Its pools draw from other families: one form per type in each card, split evenly on
 * every dial, so a player can put full chaos in one party slot while the rest stays steady.
 * Blank Slate: its Heartmark technique is chosen at its first Shift (`heartmark: null`).
 * @module data/species/tossup
 */

import { sp, even, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('tossup', 'Tossup', ['Plain'], 'tossup', 1, [50, 45, 50, 45, 50, 60], 'blank-slate',
    [[1, 'tap'], [1, 'sure-pinch'], [7, 'settle'], [13, 'shell-rattle'], [19, 'shellguard'], [25, 'knuckle'], [31, 'rust-bite'], [37, 'shardlight']],
    null, 255, 50, 'fast', {
      roleTag: 'wild_card_common', heartmarkChosenAtFirstShift: true,
      sprite: 'drawn', size: 32, palette: 'kwvebahu', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([14, 8], [10, 12], [20, 16], [24, 15]),
      feature: 'a hermit crab living in a chipped blue-banded teacup',
      mustNotReadAs: ['a hermit crab in a spiral shell', 'a crab under a rock'],
      habitat: 'everywhere: the Pellwick reeds, every isle, the back of your cupboard',
      log: 'The most common creature on the isles and the least predictable. It lives in whatever it finds: a bottle, a teacup, a net float. Children treat them like lottery tickets.',
      teachable: ['spore-drift', 'sandtrap', 'flashover', 'cairn-crash', 'hoarfrost', 'drowned-bell', 'shardlight', 'live-wire', 'gale-cut', 'stand-firm', 'gnash', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'tossup', name: 'Tossup', windows: [8, 20, 34],
  shiftTable: {
    tossup: {
      up: even(['knuckleback', 'sedgehare', 'prismoth', 'cairnward', 'vesperay', 'brinelance', 'creelwight', 'coilcrest', 'rimeplate', 'emberjaw', 'gillwick', 'duskowl']),
      side: even(['sloshkin', 'scrapling', 'reedkit', 'mothling', 'wirewhisk', 'chillnub', 'sootling', 'rustcreel', 'skirl', 'duskwisp', 'mudfist', 'rillfin']),
      down: even(['puddlepip']),
    },
  },
  star: 'tossup',
  starPalette: { b: 'd', a: 'v', h: 'e' },
  starText: 'The teacup\'s blue band has gone night-grey and the crab with it; it still chips the same rim.',
});

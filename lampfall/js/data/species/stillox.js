/**
 * Stillox, unshifting (GDD-00 §8; wildshift-creatures §3.14). [DATA-SPECIES]
 * The only ordinary species outside the Shift system and the Mooring's emblem. Its family row exists
 * so `familyId` resolves (GDD-ids ruling 3): no windows, no Shift table, no Star-touched form.
 * @module data/species/stillox
 */

import { sp, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('stillox', 'Stillox', ['Stone'], 'stillox', 4, [110, 115, 130, 50, 85, 30], 'unshifting',
    [[1, 'tap'], [1, 'shard-fling'], [10, 'stand-firm'], [20, 'grind-down'], [28, 'bedrock-charge'], [34, 'sandtrap'], [42, 'cairn-crash'], [50, 'iron-pin'], [60, 'hullburst']],
    null, 25, 230, 'slow', {
      roleTag: 'unshifting_titan', neverShifts: true, titan: true, rare: true,
      sprite: 'drawn', size: 32, palette: 'kwvedn', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([9, 13], [5, 17], [18, 10], [28, 12]),
      feature: 'a carved stone ox: withers hump, chisel-cut horns, fluted column legs with capital and base',
      mustNotReadAs: ['a rock-armoured rhino', 'a granite bull statue come to life'],
      habitat: 'Thistlewind moor, rarely, standing in one place long enough to be mistaken for a milestone',
      log: 'The oldest line on the isles and the only one that has never Shifted. Its horns are carved on the Mooring\'s banners. The mark on it only ever sits on one body.',
      teachable: ['gnash', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'stillox', name: 'Stillox', windows: [], shiftTable: {}, star: null, single: true,
});

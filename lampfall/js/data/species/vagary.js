/**
 * Vagary, the Passenger (GDD-00 §2, §8; wildshift-creatures §3.6). [DATA-SPECIES]
 * The comet and the creature it carries: Star, Unfixed, never Shifts, never on a Forecast card.
 * Drawn 96×96 for the Reading (the 32×32 concept is the Field Log plate; anchors scale ×3).
 * Catch rate 18: on the Lantern Stack perch a Skyglass wick shows 14% once it is at the Stance
 * floor (GDD-00 §12, day 40). Its magenta body is the one place `m` is allowed outside Heartmarks,
 * skyglass, Shift effects and the Forecast panel.
 * @module data/species/vagary
 */

import { sp, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('vagary', 'Vagary', ['Star'], 'vagary', 4, [100, 90, 90, 120, 100, 100], 'unfixed',
    [[1, 'starfall'], [1, 'tailfall'], [20, 'shardlight'], [30, 'hoarfrost'], [40, 'riptide'], [50, 'kiln-maw'], [60, 'bandlight'], [70, 'echo-drain']],
    null, 18, 300, 'slow', {
      roleTag: 'comet_legendary', legendary: true, neverShifts: true, neverOnForecast: true, displayName: 'Vagary (the Passenger)',
      sprite: 'drawn', size: 96, conceptSize: 32, palette: 'kmpwi', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([10, 8], [9, 12], [20, 14], [26, 19]),
      feature: 'a faceted crystal head with a cracked brow riding a ring of comet tail; the only magenta body',
      mustNotReadAs: ['a wish-star legendary with tags on its head', 'a crystal-headed space alien'],
      habitat: 'the Lantern Stack, after the Reading; once in thirty years, the sky',
      log: 'A comet on a thirty-year road. Part of it was alive. It has not held one type since it broke over the isles, and every Shift echoes the crack on its brow.',
      teachable: [],
    }),
]);

export const family = fam({
  id: 'vagary', name: 'Vagary', windows: [], shiftTable: {}, star: null, single: true,
});

/**
 * Bilgebob line (GDD-00 §8 family 6; wildshift-creatures §3.7, §3A). [DATA-SPECIES]
 * Bilgebob (1) · Brinelance (2). Brinelance is the accidental Shift hero: it sits in Bilgebob's Up
 * card at 6 of 100 on Flux (about one Up card in 17). Nobody plans for it.
 * @module data/species/bilgebob
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('bilgebob', 'Bilgebob', ['Brine'], 'bilgebob', 1, [110, 55, 45, 50, 45, 25], 'sodden',
    [[1, 'tap'], [1, 'salt-spray'], [8, 'gnash'], [14, 'settle'], [20, 'shellguard'], [26, 'riptide'], [30, 'breaker'], [36, 'tidal-mend']],
    'gnash', 120, 70, 'slow', {
      roleTag: 'harbour_floater',
      sprite: 'brief', size: 32, palette: 'knbsvwy', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([9, 13], [11, 20], [17, 10], [26, 15]),
      feature: 'a barrel-round harbour whale with a painted-looking waterline and a cork-float freckle on each cheek',
      mustNotReadAs: ['a round blue cartoon whale with a water spout', 'a beach-ball whale', 'a small round baby whale with a spout'],
      habitat: 'Drownwood harbour mouths and Pellwick\'s quay, dozing in warm water by the pilings',
      log: 'A Bilgebob floats where the water is warmest and lets the tide do the rest. It is not lazy. It is moored.',
      teachable: ['hoarfrost', 'drowned-bell', 'stand-firm', 'sandtrap', 'plumbline'],
    }),
  sp('brinelance', 'Brinelance', ['Brine', 'Rime'], 'bilgebob', 2, [75, 105, 65, 60, 65, 85], 'last-ebb',
    [[1, 'tap'], [1, 'gnash'], [8, 'salt-spray'], [16, 'frost-nip'], [20, 'floe-ram'], [24, 'riptide'], [28, 'breaker'], [32, 'hoarfrost'], [40, 'iron-pin'], [48, 'pummel']],
    'gnash', 30, 170, 'slow', {
      roleTag: 'accidental_shift_hero',
      sprite: 'drawn', size: 32, palette: 'kbnsiwv', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([12, 17], [7, 18], [18, 15], [28, 14]),
      feature: 'a single long lance of rime on a lean, salt-crusted hunter',
      mustNotReadAs: ['a narwhal', 'a swordfish'],
      habitat: 'none wild: every Brinelance was a Bilgebob that took the long shot',
      log: 'A few Bilgebobs become Brinelances: lean, salt-crusted hunters with one long lance of rime. They fight like they know they were a long shot.',
      teachable: ['drowned-bell', 'gale-cut', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'bilgebob', name: 'Bilgebob line', windows: [8, 20, 34],
  shiftTable: {
    bilgebob: {
      up: [e('siltback', 50, 44, 25), e('rimeplate', 27, 30, 25), e('gillwick', 20, 20, 25), e('brinelance', 3, 6, 25)],
      side: [e('rayling', 40, 35, 33), e('rillfin', 30, 35, 33), e('rushling', 30, 30, 33)],
      down: [e('puddlepip', 100, 70, 50), e('chillnub', 0, 30, 50)],
    },
    brinelance: {
      up: [e('strandrunner', 40, 35, 33), e('floeback', 35, 35, 33), e('hulkwight', 25, 30, 33)],
      side: [e('rimeplate', 35, 35, 33), e('skeinwing', 35, 30, 33), e('creelwight', 30, 35, 33)],
      down: [e('bilgebob', 80, 60, 33), e('rayling', 20, 25, 33), e('chillnub', 0, 15, 33)],
    },
  },
  star: 'bilgebob',
  starPalette: { b: 'e', s: 'v', n: 'd' },
  starText: 'Its hide has gone the grey of a comet\'s tail; the cork-float freckles stay gold.',
});

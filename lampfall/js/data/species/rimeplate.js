/**
 * Rimeplate line (GDD-00 §8 family 9; wildshift-creatures §3.11). [DATA-SPECIES]
 * Chillnub (1, Stillcoat Ward) · Rimeplate (2, the Down-Shift example) · Floeback (3).
 * Chillnub is stage 1 for stats (GDD-ids ruling 4) but still reads as the line's hatchling, so the
 * isles' pools treat it as a Down card for stage-1 forms.
 * @module data/species/rimeplate
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('chillnub', 'Chillnub', ['Rime'], 'rimeplate', 1, [61, 50, 67, 44, 50, 28], 'stillcoat',
    [[1, 'tap'], [1, 'frost-nip'], [8, 'settle'], [14, 'shard-fling'], [17, 'floe-ram'], [20, 'plate-toss'], [26, 'rime-lock'], [32, 'hoarfrost']],
    'frost-nip', 160, 52, 'medium-slow', {
      roleTag: 'ward', ward: true, smallForm: true,
      sprite: 'drawn', size: 32, palette: 'kwisbnv', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([11, 18], [6, 23], [15, 10], [24, 22]),
      feature: 'one oversized rime plate on a curled ball',
      mustNotReadAs: ['an ice-cube creature', 'a rolled-up armadillo'],
      habitat: 'Cairnhold quarry pools in the shade, where the cold keeps',
      log: 'A Rimeplate hatchling with one plate and a lot of opinions. Pry it loose and it curls up tighter, like it planned that.',
      teachable: ['sandtrap', 'stand-firm', 'plumbline'],
    }),
  sp('rimeplate', 'Rimeplate', ['Rime', 'Stone'], 'rimeplate', 2, [80, 85, 115, 50, 75, 30], 'plateshed',
    [[1, 'tap'], [1, 'frost-nip'], [8, 'shard-fling'], [14, 'plate-toss'], [17, 'floe-ram'], [20, 'stand-firm'], [26, 'hoarfrost'], [32, 'rime-lock'], [38, 'sandtrap'], [44, 'bedrock-charge']],
    'plate-toss', 90, 150, 'medium-slow', {
      roleTag: 'down_shift_example', slow: true,
      sprite: 'drawn', size: 32, palette: 'kwisbned', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([6, 16], [5, 20], [18, 11], [29, 18]),
      feature: 'eight overlapping plates of rime over a stone body',
      mustNotReadAs: ['an armoured woodlouse', 'a horseshoe crab'],
      habitat: 'Rimeholt tide-pool rocks, clinging under eight plates',
      log: 'Rimeplates cling to cold rocks under eight plates of rime. Count them: one falls away when something hits hard, and grows back by morning.',
      teachable: ['cairn-crash', 'plumbline'],
    }),
  sp('floeback', 'Floeback', ['Rime', 'Stone'], 'rimeplate', 3, [105, 100, 135, 60, 90, 25], 'plateshed',
    [[1, 'tap'], [1, 'frost-nip'], [1, 'plate-toss'], [8, 'shard-fling'], [17, 'floe-ram'], [20, 'stand-firm'], [26, 'hoarfrost'], [32, 'rime-lock'], [38, 'cairn-crash'], [44, 'sandtrap'], [50, 'bedrock-charge']],
    'plate-toss', 30, 235, 'medium-slow', {
      roleTag: 'line_top', slow: true,
      sprite: 'brief', size: 32, palette: 'kwisbned', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([5, 17], [7, 22], [17, 10], [29, 19]),
      feature: 'a low, wide body under a single ice floe with a small fir-tree of frost growing on top',
      mustNotReadAs: ['an island-backed sea turtle', 'an ice-shelled tortoise'],
      habitat: 'Rimeholt glacier edge; seals sometimes nap on it by mistake',
      log: 'A Floeback moves about a yard an hour and has never once been late. Ice grows on its back faster than it melts.',
      teachable: ['gnash', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'rimeplate', name: 'Rimeplate line', windows: [8, 20, 34],
  shiftTable: {
    chillnub: {
      up: [e('rimeplate', 70, 55, 25), e('cairnward', 10, 15, 25), e('siltback', 10, 15, 25), e('brinelance', 10, 15, 25)],
      side: [e('sootling', 40, 35, 33), e('mothling', 30, 35, 33), e('tossup', 30, 30, 33)],
      down: [e('puddlepip', 100, 100, 100)],
    },
    rimeplate: {
      up: [e('floeback', 70, 50, 25), e('bogmonarch', 10, 20, 25), e('cragmitt', 10, 15, 25), e('lumenveil', 10, 15, 25)],
      side: [e('siltback', 40, 35, 33), e('cairnward', 30, 35, 33), e('brinelance', 30, 30, 33)],
      down: [e('chillnub', 80, 65, 50), e('bilgebob', 20, 35, 50)],
    },
    floeback: {
      up: [e('caldermaw', 50, 40, 25), e('hulkwight', 40, 40, 25), e('squallcoil', 5, 10, 25), e('hailcoil', 5, 10, 25)],
      side: [e('bogmonarch', 40, 35, 33), e('cragmitt', 35, 35, 33), e('lumenveil', 25, 30, 33)],
      down: [e('rimeplate', 80, 60, 33), e('siltback', 20, 25, 33), e('chillnub', 0, 15, 33)],
    },
  },
  star: 'rimeplate',
  starPalette: { i: 'v', s: 'e', b: 'd' },
  starText: 'The eight plates have gone the grey of comet ice; the one that grows back grows back grey.',
});

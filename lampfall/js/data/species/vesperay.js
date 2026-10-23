/**
 * Vesperay line (GDD-00 §8 family 5; wildshift-creatures §3.5). [DATA-SPECIES]
 * Rayling (1) · Vesperay (2). Champion Idris's Vesperay is anchored by his ring and keeps the same
 * kit on every seed. The pool leans Brine and Glass. Vesperay keeps the prototype's 520 total: the
 * two-form line tops out at stage 2, so its top form carries a stage-3 total.
 * @module data/species/vesperay
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('rayling', 'Rayling', ['Brine'], 'vesperay', 1, [55, 40, 50, 65, 65, 60], 'tidecall',
    [[1, 'tap'], [1, 'salt-spray'], [6, 'dust-veil'], [11, 'settle'], [16, 'breaker'], [20, 'riptide'], [22, 'shardlight'], [34, 'tidal-mend'], [38, 'mirror-step']],
    'salt-spray', 120, 66, 'medium-fast', {
      roleTag: 'champion_kin',
      sprite: 'brief', size: 32, palette: 'knbsiwp', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([8, 15], [11, 19], [15, 13], [26, 20]),
      feature: 'a small dusk ray with one round glass freckle on its back where the eye panel will be',
      mustNotReadAs: ['a manta-ray mascot', 'a flying stingray kite'],
      habitat: 'Emberstep hot-spring outflows at dusk, skimming the warm water',
      log: 'Raylings rise at dusk and skim so low their reflection keeps up. The glass freckle on the back is just a freckle. For now.',
      teachable: ['hoarfrost', 'drowned-bell', 'plumbline'],
    }),
  sp('vesperay', 'Vesperay', ['Brine', 'Glass'], 'vesperay', 2, [95, 60, 85, 100, 100, 80], 'afterimage',
    [[1, 'salt-spray'], [1, 'dust-veil'], [10, 'shellguard'], [18, 'shardlight'], [26, 'vesper-mend'], [34, 'mirror-step'], [42, 'riptide'], [50, 'lens-focus'], [58, 'echo-drain']],
    'vesper-mend', 20, 220, 'slow', {
      roleTag: 'champion_ace', wildPostGame: true,
      sprite: 'drawn', size: 32, palette: 'knbsiwpd', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([5, 13], [10, 20], [13, 11], [25, 23]),
      feature: 'a glass eye panel on its back that brightens before it heals',
      mustNotReadAs: ['a red-and-blue jet dragon', 'a manta ray'],
      habitat: 'Shardcrown\'s outer reef after the Relighting; Idris\'s since it hatched',
      log: 'Vesperays rise from the deep at dusk and glide just above the water, trailing reflections. When the eye panel brightens, every sailor knows what comes next.',
      teachable: ['hoarfrost', 'drowned-bell', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'vesperay', name: 'Vesperay line', windows: [8, 20, 34],
  shiftTable: {
    rayling: {
      up: [e('vesperay', 70, 50, 25), e('prismoth', 10, 15, 25), e('siltback', 10, 15, 25), e('gillwick', 10, 20, 25)],
      side: [e('mothling', 40, 35, 33), e('rillfin', 35, 35, 33), e('bilgebob', 25, 30, 33)],
      down: [e('puddlepip', 100, 75, 50), e('chillnub', 0, 25, 50)],
    },
    vesperay: {
      up: [e('lumenveil', 60, 45, 33), e('strandrunner', 25, 30, 33), e('bogmonarch', 15, 25, 33)],
      side: [e('prismoth', 35, 35, 33), e('brinelance', 35, 35, 33), e('skeinwing', 30, 30, 33)],
      down: [e('rayling', 80, 60, 33), e('mothling', 20, 25, 33), e('puddlepip', 0, 15, 33)],
    },
  },
  star: 'vesperay',
  starPalette: { s: 'v', b: 'e', n: 'd' },
  starText: 'Its wings have gone comet-dusk grey; the eye panel still brightens blue before it heals.',
});

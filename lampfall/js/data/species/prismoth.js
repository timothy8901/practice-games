/**
 * Prismoth line, the Ward family (GDD-00 §8 family 4; wildshift-creatures §3.4). [DATA-SPECIES]
 * Mothling (1) · Prismoth (2, Glasshide) · Cairnward (2, Stillcoat) · Lumenveil (3, Mirrorveil).
 * Three of the four Ward forms live here; none is encounterable before Cairnhold. The pool leans
 * Glass and Gust. Prismoth's max HP is quartered (`hpMultiplier`), so one Strong hit ends it.
 * @module data/species/prismoth
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('mothling', 'Mothling', ['Glass'], 'prismoth', 1, [45, 35, 45, 65, 60, 70], 'still-mind',
    [[1, 'tap'], [1, 'dust-veil'], [6, 'dazzle'], [11, 'downdraft'], [12, 'shardlight'], [22, 'updraft'], [28, 'lens-focus'], [34, 'mirror-step']],
    'dust-veil', 150, 58, 'medium-fast', {
      roleTag: 'ward_kin',
      sprite: 'brief', size: 32, palette: 'kdivwyn', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([12, 11], [13, 16], [18, 13], [15, 22]),
      feature: 'a fuzzy collar of skyglass dust and two folded wings with one clear window each',
      mustNotReadAs: ['a fuzzy bug-eyed moth larva mascot', 'a butterfly'],
      habitat: 'Cairnhold standing stones at dusk; follows a lit porch home (F9)',
      log: 'Mothlings sip the light off skyglass dust and doze on warm lamp glass. Leave the porch light on and one may stay the winter.',
      teachable: ['spore-drift', 'gale-cut', 'plumbline', 'flashover'],
    }),
  sp('prismoth', 'Prismoth', ['Glass', 'Gust'], 'prismoth', 2, [60, 40, 55, 90, 80, 95], 'glasshide',
    [[1, 'tap'], [1, 'dust-veil'], [8, 'shardlight'], [14, 'updraft'], [20, 'skein-sweep'], [26, 'lens-focus'], [32, 'mirror-step'], [38, 'spore-drift']],
    'dust-veil', 90, 140, 'medium-fast', {
      roleTag: 'ward', ward: true, hpMultiplier: 0.25,
      sprite: 'drawn', size: 32, palette: 'kdniyowv', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([14, 10], [13, 13], [21, 9], [12, 22]),
      feature: 'dark glass wings with three translucent colour bands',
      mustNotReadAs: ['an eyespot-winged bug moth', 'a stained-glass butterfly'],
      habitat: 'Cairnhold quarry at dusk; visits lit porches across the isles',
      log: 'Prismoths drink the light off skyglass dust. Their wings are thin dark glass, and only the bands let light through. Read the wings, then swing.',
      teachable: ['gale-cut', 'plumbline', 'flashover'],
    }),
  sp('cairnward', 'Cairnward', ['Stone', 'Glass'], 'prismoth', 2, [80, 65, 110, 70, 95, 30], 'stillcoat',
    [[1, 'tap'], [1, 'shard-fling'], [1, 'dust-veil'], [8, 'settle'], [14, 'dazzle'], [20, 'shardlight'], [26, 'stand-firm'], [32, 'sandtrap'], [38, 'cairn-crash'], [44, 'lens-focus'], [50, 'bedrock-charge']],
    'shard-fling', 25, 160, 'slow', {
      roleTag: 'ward', ward: true, rare: true,
      sprite: 'brief', size: 32, palette: 'kevdiwtn', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([14, 6], [13, 17], [19, 12], [19, 25]),
      feature: 'a three-stone cairn on moth legs with a skyglass lamp-eye set in the top stone',
      mustNotReadAs: ['a stacked-boulder rock golem', 'a stone lantern spirit'],
      habitat: 'Cairnhold standing stones, rarely; Merrow keeps one at the Anchorage',
      log: 'Quarry folk stack cairns to mark the way; some of the cairns wander off. The Mooring calls that a good omen and licenses it.',
      teachable: ['hoarfrost', 'plumbline', 'spore-drift', 'flashover'],
    }),
  sp('lumenveil', 'Lumenveil', ['Glass'], 'prismoth', 3, [75, 55, 70, 120, 95, 80], 'mirrorveil',
    [[1, 'tap'], [1, 'dust-veil'], [10, 'shardlight'], [18, 'lens-focus'], [26, 'dazzle'], [34, 'mirror-step'], [42, 'echo-drain'], [50, 'tidal-mend']],
    'shardlight', 45, 235, 'medium-slow', {
      roleTag: 'ward', ward: true,
      sprite: 'drawn', size: 32, palette: 'kwistyv', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([14, 4], [14, 17], [20, 11], [20, 22]),
      feature: 'a hanging veil of faceted skyglass under a small lamp core',
      mustNotReadAs: ['a jellyfish', 'a gowned psychic dancer'],
      habitat: 'Rimeholt mirror-ice caves, where light comes back off every wall',
      log: 'A veil of skyglass that hangs from a little lamp of its own. Ask it to forget something and it simply declines.',
      teachable: ['drowned-bell', 'hoarfrost', 'spore-drift', 'plumbline', 'flashover'],
    }),
]);

export const family = fam({
  id: 'prismoth', name: 'Prismoth line', windows: [8, 20, 34],
  shiftTable: {
    mothling: {
      up: [e('prismoth', 60, 45, 25), e('cairnward', 20, 20, 25), e('coilcrest', 20, 20, 25), e('lumenveil', 0, 15, 25)],
      side: [e('skirl', 40, 35, 33), e('rayling', 30, 35, 33), e('wirewhisk', 30, 30, 33)],
      down: [e('puddlepip', 60, 50, 50), e('chillnub', 40, 50, 50)],
    },
    prismoth: {
      up: [e('lumenveil', 75, 55, 33), e('strandrunner', 25, 30, 33), e('hulkwight', 0, 15, 33)],
      side: [e('cairnward', 40, 35, 33), e('coilcrest', 30, 35, 33), e('vesperay', 30, 30, 33)],
      down: [e('mothling', 80, 60, 33), e('skirl', 20, 25, 33), e('duskwisp', 0, 15, 33)],
    },
    cairnward: {
      up: [e('lumenveil', 60, 45, 33), e('floeback', 25, 30, 33), e('cragmitt', 15, 25, 33)],
      side: [e('prismoth', 40, 35, 33), e('rimeplate', 35, 35, 33), e('siltback', 25, 30, 33)],
      down: [e('mothling', 70, 55, 33), e('chillnub', 30, 30, 33), e('rustcreel', 0, 15, 33)],
    },
    lumenveil: {
      up: [e('hulkwight', 35, 30, 20), e('floeback', 30, 25, 20), e('caldermaw', 25, 25, 20), e('squallcoil', 5, 10, 20), e('hailcoil', 5, 10, 20)],
      side: [e('strandrunner', 40, 35, 33), e('bogmonarch', 30, 35, 33), e('cragmitt', 30, 30, 33)],
      down: [e('prismoth', 45, 40, 33), e('cairnward', 35, 35, 33), e('vesperay', 20, 25, 33)],
    },
  },
  star: 'prismoth',
  starPalette: { i: 'w', y: 'v', o: 'e' },
  starText: 'The three wing bands have dimmed to comet-ash; the Ward shimmer is unchanged.',
});

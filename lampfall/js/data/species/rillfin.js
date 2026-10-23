/**
 * Rillfin line (GDD-00 §8 family 11). [DATA-SPECIES]
 * Rillfin (1) · Gillwick (2, gill-breather) · Strandrunner (3, walks and swims).
 * Wick's line (The Water Pack): his Rillfin Shifts to a gill-breather and he builds it a pack.
 * @module data/species/rillfin
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('rillfin', 'Rillfin', ['Brine'], 'rillfin', 1, [48, 55, 45, 55, 45, 75], 'scavenger',
    [[1, 'tap'], [1, 'salt-spray'], [4, 'downdraft'], [7, 'breaker'], [10, 'shellguard'], [12, 'settle'], [18, 'reed-whip'], [24, 'riptide'], [30, 'tidal-mend']],
    'breaker', 170, 58, 'medium-fast', {
      roleTag: 'wick_partner',
      sprite: 'brief', size: 32, palette: 'kbsnwoy', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([10, 14], [11, 20], [16, 13], [23, 17]),
      feature: 'a little hopping fish with two front fins like elbows and a tall dorsal fin it raises when pleased',
      mustNotReadAs: ['a flopping orange carp', 'a walking goldfish'],
      habitat: 'quick streams and river reaches; Wick\'s goes where Wick goes',
      log: 'Rillfins hop from pool to pool on their front fins and think nothing of a short walk. Wick\'s has never once waited for him.',
      teachable: ['hoarfrost', 'gale-cut', 'stand-firm', 'plumbline'],
    }),
  sp('gillwick', 'Gillwick', ['Brine', 'Moss'], 'rillfin', 2, [75, 70, 70, 85, 75, 65], 'tidecall',
    [[1, 'tap'], [1, 'salt-spray'], [1, 'breaker'], [8, 'reed-whip'], [14, 'root-knot'], [20, 'mire-bloom'], [26, 'riptide'], [30, 'tidal-mend'], [32, 'spore-drift'], [44, 'reap']],
    'breaker', 75, 150, 'medium-fast', {
      roleTag: 'gill_breather',
      sprite: 'brief', size: 32, palette: 'kbsngltw', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([9, 10], [10, 18], [17, 13], [26, 19]),
      feature: 'feathery green weed-gills that float around its head like a wick\'s flame; it carries water on land in a gill-pouch',
      mustNotReadAs: ['a pink frilled axolotl', 'a seaweed-haired mermaid creature'],
      habitat: 'Thistlewind mill-ponds and the moor\'s peat streams',
      log: 'A Rillfin that grew gills for land. The weed-gills drink the morning mist; a dry day makes it sulk. Wick built his a pack.',
      teachable: ['hoarfrost', 'stand-firm', 'gale-cut', 'plumbline'],
    }),
  sp('strandrunner', 'Strandrunner', ['Brine', 'Gust'], 'rillfin', 3, [85, 100, 80, 85, 70, 90], 'sure-footing',
    [[1, 'tap'], [1, 'breaker'], [1, 'downdraft'], [8, 'salt-spray'], [14, 'gale-cut'], [20, 'updraft'], [26, 'floe-ram'], [32, 'riptide'], [38, 'skein-sweep'], [44, 'pummel'], [50, 'tidal-mend']],
    'breaker', 30, 230, 'medium-fast', {
      roleTag: 'line_top',
      sprite: 'brief', size: 32, palette: 'kbsnwvoa', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([8, 6], [10, 15], [17, 12], [25, 13]),
      feature: 'long stilt legs with webbed toes, fins swept back like a running sail; leaves a double line of prints at the waterline',
      mustNotReadAs: ['a long-legged wading heron', 'a running ostrich'],
      habitat: 'Rimeholt\'s cold strand at low tide, running the waterline; Wick\'s Long Road ace',
      log: 'It runs the line where the sea meets the sand and never gets its knees wet. If you see two lines of prints, one of them was a Strandrunner.',
      teachable: ['live-wire', 'gnash', 'hoarfrost', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'rillfin', name: 'Rillfin line', windows: [8, 20, 34],
  shiftTable: {
    rillfin: {
      up: [e('gillwick', 70, 55, 25), e('siltback', 20, 20, 25), e('skeinwing', 10, 15, 25), e('vesperay', 0, 10, 25)],
      side: [e('rayling', 40, 35, 33), e('rushling', 30, 35, 33), e('skirl', 30, 30, 33)],
      down: [e('puddlepip', 100, 80, 50), e('chillnub', 0, 20, 50)],
    },
    gillwick: {
      up: [e('strandrunner', 70, 55, 33), e('bogmonarch', 20, 25, 33), e('lumenveil', 10, 20, 33)],
      side: [e('sedgehare', 35, 35, 33), e('siltback', 35, 35, 33), e('vesperay', 30, 30, 33)],
      down: [e('rillfin', 80, 60, 33), e('rushling', 20, 25, 33), e('puddlepip', 0, 15, 33)],
    },
    strandrunner: {
      up: [e('hulkwight', 30, 25, 20), e('floeback', 30, 25, 20), e('caldermaw', 30, 30, 20), e('squallcoil', 5, 10, 20), e('hailcoil', 5, 10, 20)],
      side: [e('bogmonarch', 40, 35, 33), e('cragmitt', 30, 35, 33), e('lumenveil', 30, 30, 33)],
      down: [e('gillwick', 75, 55, 33), e('skeinwing', 25, 30, 33), e('rillfin', 0, 15, 33)],
    },
  },
  star: 'rillfin',
  starPalette: { b: 'e', s: 'v', n: 'd' },
  starText: 'Its scales have gone comet-dusk grey; the dorsal fin still goes up when it is pleased.',
});

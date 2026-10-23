/**
 * Sloshkin line (GDD-00 §8 family 1; wildshift-creatures §3.1-§3.2, §6). [DATA-SPECIES]
 * Puddlepip (0) · Sloshkin (1, starter) · Siltback (2) · Skeinwing (2, Shift-only) · Bogmonarch (3).
 * Sloshkin's own row is the source table verbatim (§6.2); the other rows follow the §6.3
 * pool-building rules. Star-touched Sloshkin is a palette variant (`star` + `starPalette`).
 * @module data/species/sloshkin
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('puddlepip', 'Puddlepip', ['Brine'], 'sloshkin', 0, [50, 50, 48, 45, 50, 37], 'shoresense',
    [[1, 'tap'], [1, 'salt-spray'], [3, 'undertow'], [6, 'settle'], [12, 'shell-rattle'], [18, 'shellguard'], [24, 'tidal-mend'], [30, 'riptide']],
    'undertow', 120, 45, 'medium-slow', {
      roleTag: 'hatchling', hatchling: true,
      sprite: 'drawn', size: 32, palette: 'kbsniw', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([13, 12], [14, 19], [16, 13], [24, 26]),
      feature: 'a droplet head rising out of its own small puddle',
      mustNotReadAs: ['a generic water-drop mascot or slime blob', 'a tadpole'],
      habitat: 'Lowmoor tide flats, in the warm puddles the ebb leaves behind',
      log: 'Sloshkin hatchlings sit in a puddle no bigger than a saucer and refuse to leave it. Step around.',
      teachable: ['sandtrap', 'stand-firm', 'plumbline'],
    }),
  sp('sloshkin', 'Sloshkin', ['Brine'], 'sloshkin', 1, [60, 62, 55, 50, 55, 38], 'shoresense',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'undertow'], [9, 'settle'], [13, 'shell-rattle'], [17, 'shellguard'], [22, 'riptide'], [25, 'breaker'], [28, 'tidal-mend'], [34, 'grind-down']],
    'undertow', 45, 64, 'medium-slow', {
      roleTag: 'starter_base', starter: true, slow: true, suggestedName: 'PUDDLE',
      sprite: 'drawn', size: 32, palette: 'ksbnorwu', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([10, 6], [9, 20], [19, 20], [30, 19]),
      feature: 'coral ruff collar; sits buried to the belly in tide-flat mud',
      mustNotReadAs: ['a blue frill-gilled mudfish starter', 'an axolotl'],
      habitat: 'Lowmoor tide flats, buried to the eyes in warm mud',
      log: 'Sloshkins sit buried to the eyes where the first skyglass fell and pop up when someone walks past. Islanders say a Sloshkin picks its keeper.',
      teachable: ['sandtrap', 'stand-firm', 'hoarfrost', 'drowned-bell', 'cairn-crash', 'plumbline'],
    }),
  sp('siltback', 'Siltback', ['Brine', 'Stone'], 'sloshkin', 2, [86, 92, 86, 63, 69, 34], 'tidecall',
    [[1, 'tap'], [1, 'salt-spray'], [1, 'undertow'], [5, 'shard-fling'], [12, 'settle'], [18, 'stand-firm'], [24, 'riptide'], [30, 'sandtrap'], [36, 'bedrock-charge'], [42, 'tidal-mend']],
    'undertow', 45, 145, 'medium-slow', {
      roleTag: 'forward_line',
      sprite: 'drawn', size: 32, palette: 'ksbnorve', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([10, 10], [7, 16], [25, 16], [29, 21]),
      feature: 'a cairn of three silt-stone slabs piled on its back; bigger scalloped coral ruff',
      mustNotReadAs: ['a mud-armoured fish-frog final starter', 'a turtle with a rock shell'],
      habitat: 'Shift only in this season (Isolde\'s creature in the letters)',
      log: 'A Sloshkin that kept growing the way the old books expected. It carries the bar on its back, one slab at a time.',
      teachable: ['cairn-crash', 'hoarfrost', 'drowned-bell', 'plumbline'],
    }),
  sp('skeinwing', 'Skeinwing', ['Brine', 'Gust'], 'sloshkin', 2, [55, 60, 50, 85, 65, 105], 'featherbed',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'undertow'], [8, 'downdraft'], [12, 'gale-cut'], [18, 'skein-sweep'], [24, 'updraft'], [30, 'mirror-step'], [36, 'riptide'], [42, 'hoarfrost']],
    'undertow', 45, 150, 'medium-slow', {
      roleTag: 'starter_shift', shiftOnly: true, fragile: true,
      sprite: 'drawn', size: 32, palette: 'kwvebnor', heartmarkHighlight: 'y', idle: 'hover',
      heartmarkAnchors: anchors([10, 8], [19, 21], [20, 16], [25, 25]),
      feature: 'coral collar on a white sea bird; feather fringe on the near wing flattens once Featherbed is spent',
      mustNotReadAs: ['a cloud-winged cotton bird', 'a plain gull'],
      habitat: 'none: no Skeinwing hatches; every one started as something else',
      log: 'After a skyglass storm, skeins of them fly high over the outer isles. Old fishers study the coral collars to guess what each bird used to be.',
      teachable: ['shardlight', 'drowned-bell', 'plumbline'],
    }),
  sp('bogmonarch', 'Bogmonarch', ['Brine', 'Stone'], 'sloshkin', 3, [100, 105, 95, 75, 80, 45], 'tidecall',
    [[1, 'tap'], [1, 'salt-spray'], [1, 'undertow'], [5, 'shard-fling'], [12, 'settle'], [20, 'stand-firm'], [28, 'riptide'], [32, 'breaker'], [36, 'sandtrap'], [44, 'bedrock-charge'], [52, 'tidal-mend'], [60, 'grind-down']],
    'undertow', 45, 240, 'medium-slow', {
      roleTag: 'skip_ahead',
      sprite: 'drawn', size: 32, palette: 'ksbnorev', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([10, 9], [9, 17], [22, 12], [29, 21]),
      feature: 'seated king toad: chunky stone crown, coral mane across the chest, webbed hands planted in front',
      mustNotReadAs: ['a crowned frog king', 'a toad mascot with a tongue out'],
      habitat: 'Shift only in this season; the bog kings of the old songs',
      log: 'It sits like it owns the marsh and, to be fair, nobody has argued. The crown is stone. The patience is real.',
      teachable: ['cairn-crash', 'hoarfrost', 'drowned-bell', 'gnash', 'plumbline', 'spore-drift'],
    }),
]);

export const family = fam({
  id: 'sloshkin', name: 'Sloshkin line', windows: [8, 20, 34],
  shiftTable: {
    puddlepip: {
      up: [e('sloshkin', 85, 70, 33), e('rushling', 15, 20, 33), e('siltback', 0, 10, 33)],
      side: [e('chillnub', 50, 40, 33), e('tossup', 50, 40, 33), e('sootling', 0, 20, 33)],
      down: [],
    },
    sloshkin: {
      up: [e('siltback', 70, 45, 25), e('skeinwing', 20, 25, 25), e('bogmonarch', 10, 15, 25), e('lumenveil', 0, 15, 25)],
      side: [e('mudfist', 50, 50, 50), e('rushling', 50, 50, 50)],
      down: [e('puddlepip', 100, 70, 50), e('chillnub', 0, 30, 50)],
    },
    siltback: {
      up: [e('bogmonarch', 70, 50, 25), e('lumenveil', 10, 20, 25), e('cragmitt', 10, 15, 25), e('floeback', 10, 15, 25)],
      side: [e('skeinwing', 45, 35, 33), e('rimeplate', 30, 35, 33), e('gillwick', 25, 30, 33)],
      down: [e('sloshkin', 80, 60, 33), e('mudfist', 20, 25, 33), e('puddlepip', 0, 15, 33)],
    },
    skeinwing: {
      up: [e('bogmonarch', 60, 50, 50), e('lumenveil', 40, 50, 50)],
      side: [e('siltback', 100, 100, 100)],
      down: [e('sloshkin', 60, 40, 25), e('mudfist', 15, 20, 25), e('rushling', 15, 20, 25), e('puddlepip', 10, 20, 25)],
    },
    bogmonarch: {
      up: [e('caldermaw', 35, 30, 20), e('floeback', 30, 25, 20), e('hulkwight', 25, 25, 20), e('squallcoil', 5, 10, 20), e('hailcoil', 5, 10, 20)],
      side: [e('lumenveil', 40, 35, 33), e('cragmitt', 30, 35, 33), e('strandrunner', 30, 30, 33)],
      down: [e('siltback', 60, 45, 25), e('skeinwing', 30, 30, 25), e('sloshkin', 10, 15, 25), e('rimeplate', 0, 10, 25)],
    },
  },
  star: 'sloshkin',
  starPalette: { b: 'e', s: 'v', n: 'd', w: 'i' },
  starText: 'Its hide has gone comet-dusk grey; the coral ruff and the mud are unchanged.',
});

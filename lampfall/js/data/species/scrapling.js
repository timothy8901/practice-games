/**
 * Scrapling line (GDD-00 §8 family 2; wildshift-creatures §3.3). [DATA-SPECIES]
 * Scrapling (1, starter) · Mudfist (1) · Knuckleback (2) · Cragmitt (3).
 * Narrow on purpose: from Scrapling the forward line holds 70 of 100 Up weight on Drift.
 * @module data/species/scrapling
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('scrapling', 'Scrapling', ['Grit'], 'scrapling', 1, [65, 80, 60, 30, 45, 35], 'big-sibling',
    [[1, 'tap'], [1, 'knuckle'], [5, 'shadowbox'], [10, 'sand-smother'], [15, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'shellguard'], [38, 'rust-bite']],
    'shadowbox', 180, 60, 'medium-fast', {
      roleTag: 'early_carry', starter: true, slow: true,
      sprite: 'drawn', size: 32, palette: 'kahuwvr', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([12, 10], [13, 21], [17, 24], [23, 28]),
      feature: 'red shoulder patch ("its badge"), torn ear, sailcloth-wrapped fists up in a guard',
      mustNotReadAs: ['a boxing kangaroo', 'a grey four-armed wrestler', 'a bandaged-hand fighting monkey'],
      habitat: 'Lowmoor marsh edges and the Brackenford boardwalk; wherever gulls need chasing',
      log: 'The smallest creature on the first route and the quickest to start a fight. Dock workers keep one to chase off gulls three times its size.',
      teachable: ['sandtrap', 'cairn-crash', 'gnash', 'live-wire', 'plumbline'],
    }),
  sp('mudfist', 'Mudfist', ['Grit'], 'scrapling', 1, [65, 75, 60, 35, 50, 40], 'slatehide',
    [[1, 'tap'], [1, 'knuckle'], [8, 'sand-smother'], [14, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'shellguard'], [38, 'iron-pin']],
    'knuckle', 150, 62, 'medium-fast', {
      roleTag: 'side_card',
      sprite: 'drawn', size: 32, palette: 'kcahuw', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([16, 7], [11, 13], [24, 12], [27, 18]),
      feature: 'one oversized knuckled mud fist carried in front of a lumpy mud body; thumb folded across the front',
      mustNotReadAs: ['a mud-blob monster', 'a disembodied giant hand'],
      habitat: 'Lowmoor tide flats at the low, in the stickiest mud',
      log: 'Mudfists dry hard by noon and soften again at the evening tide. One good knock from that fist and the argument is over.',
      teachable: ['sandtrap', 'cairn-crash', 'gnash', 'plumbline', 'spore-drift', 'live-wire'],
    }),
  sp('knuckleback', 'Knuckleback', ['Grit'], 'scrapling', 2, [80, 110, 75, 40, 60, 55], 'big-sibling',
    [[1, 'tap'], [1, 'knuckle'], [6, 'shadowbox'], [10, 'sand-smother'], [15, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'shellguard'], [38, 'rust-bite'], [45, 'iron-pin']],
    'shadowbox', 90, 145, 'medium-fast', {
      roleTag: 'forward_line',
      sprite: 'brief', size: 32, palette: 'kahuwvre', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([12, 8], [13, 18], [20, 14], [23, 26]),
      feature: 'a ridge of knuckle-shaped bone plates down the spine; the red badge patch grown to a sash',
      mustNotReadAs: ['a muscled four-armed wrestler', 'a pangolin'],
      habitat: 'Shift only in this season; Tully swears he saw one on the quay once',
      log: 'A Scrapling that grew into its fists. It still wraps them in sailcloth, and still picks fights with gulls, but now the gulls know.',
      teachable: ['sandtrap', 'cairn-crash', 'gnash', 'live-wire', 'gale-cut', 'plumbline'],
    }),
  sp('cragmitt', 'Cragmitt', ['Grit', 'Stone'], 'scrapling', 3, [95, 125, 110, 45, 70, 60], 'slatehide',
    [[1, 'tap'], [1, 'knuckle'], [6, 'shadowbox'], [10, 'shard-fling'], [15, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'sandtrap'], [36, 'cairn-crash'], [40, 'bedrock-charge'], [48, 'iron-pin']],
    'shadowbox', 45, 235, 'medium-fast', {
      roleTag: 'line_top',
      sprite: 'brief', size: 32, palette: 'kahuevdr', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([11, 8], [12, 17], [21, 10], [25, 24]),
      feature: 'two quarry-stone mitts bigger than its head, bound on with frayed net cord',
      mustNotReadAs: ['a rock golem with boulder fists', 'a gorilla'],
      habitat: 'Shift only in this season; the Cairnhold quarrymen claim the mitts are offcuts',
      log: 'It wears two quarry stones for gloves and takes them off for nobody. Osric charges it rent for the granite.',
      teachable: ['gnash', 'live-wire', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'scrapling', name: 'Scrapling line', windows: [8, 20, 34],
  shiftTable: {
    scrapling: {
      up: [e('knuckleback', 60, 45, 25), e('cragmitt', 10, 10, 25), e('sedgehare', 15, 20, 25), e('siltback', 15, 25, 25)],
      side: [e('mudfist', 60, 45, 33), e('tossup', 25, 30, 33), e('rustcreel', 15, 25, 33)],
      down: [e('puddlepip', 70, 50, 33), e('sootling', 30, 30, 33), e('chillnub', 0, 20, 33)],
    },
    mudfist: {
      up: [e('knuckleback', 50, 40, 25), e('siltback', 30, 30, 25), e('cragmitt', 10, 15, 25), e('rimeplate', 10, 15, 25)],
      side: [e('scrapling', 50, 40, 33), e('rushling', 30, 35, 33), e('sloshkin', 20, 25, 33)],
      down: [e('puddlepip', 70, 55, 50), e('sootling', 30, 45, 50)],
    },
    knuckleback: {
      up: [e('cragmitt', 70, 50, 25), e('caldermaw', 10, 15, 25), e('bogmonarch', 10, 15, 25), e('hulkwight', 10, 20, 25)],
      side: [e('sedgehare', 40, 35, 33), e('brinelance', 30, 30, 33), e('siltback', 30, 35, 33)],
      down: [e('scrapling', 70, 50, 33), e('mudfist', 30, 35, 33), e('tossup', 0, 15, 33)],
    },
    cragmitt: {
      up: [e('caldermaw', 40, 35, 20), e('floeback', 30, 25, 20), e('hulkwight', 20, 20, 20), e('squallcoil', 5, 10, 20), e('hailcoil', 5, 10, 20)],
      side: [e('bogmonarch', 50, 40, 33), e('strandrunner', 25, 30, 33), e('lumenveil', 25, 30, 33)],
      down: [e('knuckleback', 70, 55, 33), e('siltback', 20, 25, 33), e('rimeplate', 10, 20, 33)],
    },
  },
  star: 'scrapling',
  starPalette: { a: 'v', h: 'e', u: 'd', w: 'i' },
  starText: 'Its fur has gone the grey of a comet\'s tail; the red badge patch stays red.',
});

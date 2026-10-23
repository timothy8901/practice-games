/**
 * Caldermaw line (GDD-00 §8 family 10; wildshift-creatures §3.15). [DATA-SPECIES]
 * Sootling (1, the ember grub) · Emberjaw (2) · Caldermaw (3). Linnet's line (The Ember Grub):
 * her Sootling Shifts Up 100% to Caldermaw at the dock (a scripted boss Shift with a posted strip,
 * not this table) and later Down to Sootling at the Lantern Market fair.
 * @module data/species/caldermaw
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('sootling', 'Sootling', ['Kiln'], 'caldermaw', 1, [50, 56, 44, 67, 44, 39], 'ember-core',
    [[1, 'tap'], [1, 'ember-lick'], [8, 'scorch'], [14, 'settle'], [20, 'slag-burst'], [26, 'kiln-maw'], [32, 'flashover']],
    'ember-lick', 160, 54, 'slow', {
      roleTag: 'rival_lead', smallForm: true,
      sprite: 'brief', size: 32, palette: 'koyrdhu', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([9, 22], [11, 25], [15, 20], [22, 24]),
      feature: 'a palm-sized ember grub in a soot-dark husk with glowing seams, like a coal that learned to crawl',
      mustNotReadAs: ['a fire caterpillar', 'a lava slug'],
      habitat: 'Emberstep volcano vents; rides on a shoulder if allowed',
      log: 'A Sootling is a coal that learned to crawl. It sleeps in the warm side of a pocket and leaves a small scorch mark as thanks.',
      teachable: ['sandtrap', 'stand-firm', 'gnash', 'plumbline'],
    }),
  sp('emberjaw', 'Emberjaw', ['Kiln'], 'caldermaw', 2, [75, 95, 65, 90, 60, 60], 'furnace-jaw',
    [[1, 'tap'], [1, 'ember-lick'], [1, 'kiln-maw'], [8, 'scorch'], [14, 'knuckle'], [20, 'slag-burst'], [26, 'stand-firm'], [32, 'flashover'], [38, 'grind-down'], [44, 'cairn-crash']],
    'kiln-maw', 45, 150, 'slow', {
      roleTag: 'spire_ace',
      sprite: 'brief', size: 32, palette: 'koryedvw', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([8, 13], [10, 20], [18, 12], [27, 19]),
      feature: 'a long low lizard whose lower jaw is a hinged kiln door with a glow behind the grate',
      mustNotReadAs: ['a fire-tailed lizard starter', 'a salamander with a flame tail'],
      habitat: 'Emberstep lava tubes; Ines Calloway\'s Weather Spire ace',
      log: 'Emberjaws open their jaws to cool down, which is when everyone else warms up. Spa keepers feed them the slag.',
      teachable: ['gnash', 'sandtrap', 'plumbline'],
    }),
  sp('caldermaw', 'Caldermaw', ['Kiln', 'Stone'], 'caldermaw', 3, [90, 110, 100, 95, 70, 55], 'furnace-jaw',
    [[1, 'ember-lick'], [1, 'shard-fling'], [5, 'kiln-maw'], [12, 'scorch'], [20, 'slag-burst'], [28, 'stand-firm'], [36, 'grind-down'], [40, 'flashover'], [44, 'bedrock-charge'], [52, 'hullburst']],
    'kiln-maw', 30, 210, 'slow', {
      roleTag: 'rival_opener',
      sprite: 'drawn', size: 32, palette: 'kvednyor', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([8, 9], [8, 19], [17, 8], [27, 13]),
      feature: 'a lava-lit maw in a stone skull: heavy brow, hollow socket with an ember eye, lava cracks down the back',
      mustNotReadAs: ['a volcanic ground titan', 'a lava-backed dinosaur'],
      habitat: 'Emberstep\'s deepest lava tubes; Linnet\'s, for a while',
      log: 'A volcanic titan that dens in the lava tubes. Linnet\'s was a grub the night before and a titan by the end of the fight. She has not stopped talking about it.',
      teachable: ['cairn-crash', 'sandtrap', 'gnash', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'caldermaw', name: 'Caldermaw line', windows: [8, 20, 34],
  shiftTable: {
    sootling: {
      up: [e('emberjaw', 65, 50, 25), e('caldermaw', 10, 10, 25), e('knuckleback', 15, 20, 25), e('duskowl', 10, 20, 25)],
      side: [e('chillnub', 40, 35, 33), e('scrapling', 30, 35, 33), e('rustcreel', 30, 30, 33)],
      down: [e('puddlepip', 100, 100, 100)],
    },
    emberjaw: {
      up: [e('caldermaw', 70, 55, 33), e('cragmitt', 20, 25, 33), e('hulkwight', 10, 20, 33)],
      side: [e('knuckleback', 40, 35, 33), e('sedgehare', 30, 30, 33), e('creelwight', 30, 35, 33)],
      down: [e('sootling', 80, 60, 33), e('scrapling', 20, 25, 33), e('chillnub', 0, 15, 33)],
    },
    caldermaw: {
      up: [e('hulkwight', 40, 35, 25), e('floeback', 40, 35, 25), e('squallcoil', 10, 15, 25), e('hailcoil', 10, 15, 25)],
      side: [e('cragmitt', 40, 35, 33), e('bogmonarch', 35, 35, 33), e('strandrunner', 25, 30, 33)],
      down: [e('emberjaw', 60, 45, 33), e('sootling', 30, 35, 33), e('knuckleback', 10, 20, 33)],
    },
  },
  star: 'caldermaw',
  starPalette: { y: 'w', o: 'i', r: 'v' },
  starText: 'The lava in its cracks runs cold and pale as comet light; the skull is the same old stone.',
});

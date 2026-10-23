/**
 * Sedgehare line (GDD-00 §8 family 3; wildshift-creatures §3.9). [DATA-SPECIES]
 * Reedkit (1, starter) · Rushling (1) · Sedgehare (2). The pool leans Moss and Grit.
 * Bryony's bean-row Sedgehare is a story creature that chooses you (GDD-00 §11, The Fence).
 * @module data/species/sedgehare
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('reedkit', 'Reedkit', ['Moss'], 'sedgehare', 1, [52, 62, 48, 50, 50, 56], 'sure-footing',
    [[1, 'tap'], [1, 'reed-whip'], [4, 'sand-smother'], [8, 'root-knot'], [12, 'updraft'], [16, 'spore-drift'], [21, 'reap'], [27, 'mire-bloom'], [33, 'grind-down']],
    'reed-whip', 45, 64, 'medium-slow', {
      roleTag: 'starter_moss', starter: true,
      sprite: 'brief', size: 32, palette: 'klgtauwy', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([9, 12], [10, 20], [17, 15], [24, 14]),
      feature: 'a bushy tail of bundled reed heads held up like a brush; one ear always folded',
      mustNotReadAs: ['a leaf-tailed fox starter', 'a green rabbit mascot'],
      habitat: 'Lowmoor reed edges and the Brackenford ditches',
      log: 'Reedkits sleep standing up in the reed beds and are only found when the reeds sneeze. It will not be hurried and it will not be pushed.',
      teachable: ['gale-cut', 'sandtrap', 'stand-firm', 'cairn-crash', 'plumbline'],
    }),
  sp('rushling', 'Rushling', ['Moss', 'Brine'], 'sedgehare', 1, [60, 50, 55, 70, 60, 35], 'scavenger',
    [[1, 'tap'], [1, 'reed-whip'], [7, 'salt-spray'], [13, 'spore-drift'], [19, 'root-knot'], [22, 'mire-bloom'], [25, 'riptide'], [31, 'tidal-mend'], [37, 'reap']],
    'reed-whip', 150, 63, 'medium-fast', {
      roleTag: 'side_card',
      sprite: 'drawn', size: 32, palette: 'klgtubw', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([14, 13], [12, 19], [22, 15], [25, 21]),
      feature: 'a reed-and-cattail hat on a moss ball with webbed feet',
      mustNotReadAs: ['a lily-pad-hatted duck creature', 'a walking bush'],
      habitat: 'Drownwood shallows; any reach in Pellwick can hook one',
      log: 'Rushlings wear whatever the river gives them and call it a hat. Anglers hook them by accident and let them go on purpose.',
      teachable: ['sandtrap', 'stand-firm', 'hoarfrost', 'plumbline'],
    }),
  sp('sedgehare', 'Sedgehare', ['Moss'], 'sedgehare', 2, [70, 95, 60, 55, 60, 100], 'keen-glint',
    [[1, 'tap'], [1, 'reed-whip'], [9, 'updraft'], [15, 'reap'], [21, 'root-knot'], [27, 'spore-drift'], [33, 'gale-cut'], [39, 'grind-down']],
    'reap', 75, 145, 'medium-fast', {
      roleTag: 'crit_threat',
      sprite: 'drawn', size: 32, palette: 'klgtnwa', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([11, 14], [9, 21], [16, 17], [23, 26]),
      feature: 'ears are two serrated blades of sawgrass; the edges glint white before a crit',
      mustNotReadAs: ['a blade-eared rabbit fighter', 'a grass-type jackrabbit'],
      habitat: 'Emberstep spa terraces and warm sedge meadows; one lives in Bryony\'s beans',
      log: 'It sits still in the reeds until something steps close, then the ears come down. Reed-cutters have a saying: if the ears glint, step back.',
      teachable: ['sandtrap', 'cairn-crash', 'gnash', 'stand-firm', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'sedgehare', name: 'Sedgehare line', windows: [8, 20, 34],
  shiftTable: {
    reedkit: {
      up: [e('sedgehare', 70, 55, 33), e('gillwick', 15, 25, 33), e('knuckleback', 15, 20, 33)],
      side: [e('rushling', 60, 45, 33), e('scrapling', 25, 30, 33), e('skirl', 15, 25, 33)],
      down: [e('puddlepip', 60, 50, 50), e('sootling', 40, 50, 50)],
    },
    rushling: {
      up: [e('sedgehare', 45, 35, 25), e('gillwick', 35, 30, 25), e('siltback', 20, 20, 25), e('vesperay', 0, 15, 25)],
      side: [e('reedkit', 50, 40, 33), e('sloshkin', 30, 30, 33), e('rillfin', 20, 30, 33)],
      down: [e('puddlepip', 100, 70, 50), e('chillnub', 0, 30, 50)],
    },
    sedgehare: {
      up: [e('cragmitt', 45, 35, 33), e('strandrunner', 35, 35, 33), e('bogmonarch', 20, 30, 33)],
      side: [e('knuckleback', 40, 35, 33), e('gillwick', 40, 35, 33), e('duskowl', 20, 30, 33)],
      down: [e('reedkit', 70, 50, 33), e('rushling', 30, 35, 33), e('scrapling', 0, 15, 33)],
    },
  },
  star: 'sedgehare',
  starPalette: { l: 'v', g: 'e', t: 'd', w: 'i' },
  starText: 'Its sawgrass has bleached to comet-ash grey; the ears still glint before a crit.',
});

/**
 * Duskowl line (GDD-00 §8 family 14). [DATA-SPECIES]
 * Skirl (1, Gust) · Duskwisp (1, Hollow) · Duskowl (2, Hollow/Gust). Night owls: Dusksight gives
 * their Hollow and Gust moves +20% under night rules. Corin's Tossup exhibitions face them.
 * @module data/species/duskowl
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('skirl', 'Skirl', ['Gust'], 'duskowl', 1, [45, 58, 40, 45, 42, 85], 'featherbed',
    [[1, 'tap'], [1, 'downdraft'], [5, 'updraft'], [10, 'gale-cut'], [16, 'mirror-step'], [22, 'murk'], [28, 'skein-sweep'], [34, 'pummel']],
    'downdraft', 170, 56, 'fast', {
      roleTag: 'night_kin',
      sprite: 'brief', size: 32, palette: 'kwvsbny', heartmarkHighlight: 'y', idle: 'hover',
      heartmarkAnchors: anchors([9, 11], [10, 17], [16, 12], [22, 18]),
      feature: 'a small swift with one long tail streamer that whistles when it dives',
      mustNotReadAs: ['a round blue songbird', 'a cartoon swallow'],
      habitat: 'Thistlewind moor, diving round the windmill sails',
      log: 'You hear a Skirl before you see it: one long whistle as it drops past the sails. Then it is gone and the mill is still turning.',
      teachable: ['plumbline', 'drowned-bell', 'gnash'],
    }),
  sp('duskwisp', 'Duskwisp', ['Hollow'], 'duskowl', 1, [48, 40, 45, 73, 62, 62], 'dusksight',
    [[1, 'tap'], [1, 'murk'], [6, 'hush'], [11, 'dust-veil'], [16, 'echo-drain'], [22, 'mirror-step'], [28, 'drowned-bell'], [34, 'snuff']],
    'murk', 140, 62, 'medium-fast', {
      roleTag: 'night_kin',
      sprite: 'brief', size: 32, palette: 'kpndyiw', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([14, 11], [14, 18], [18, 14], [15, 25]),
      feature: 'an owlet of smoke with two round amber eyes and no edges, trailing off below like a snuffed wick',
      mustNotReadAs: ['a ghost blob with a tongue', 'a will-o\'-wisp flame'],
      habitat: 'Drownwood\'s stilt town after dark, under the boardwalks',
      log: 'A Duskwisp is mostly eyes and the idea of feathers. It follows lantern-carriers home and is gone by breakfast.',
      teachable: ['spore-drift', 'shardlight', 'gnash', 'plumbline', 'flashover'],
    }),
  sp('duskowl', 'Duskowl', ['Hollow', 'Gust'], 'duskowl', 2, [75, 78, 65, 90, 72, 70], 'dusksight',
    [[1, 'tap'], [1, 'murk'], [1, 'downdraft'], [8, 'hush'], [14, 'gale-cut'], [20, 'echo-drain'], [26, 'updraft'], [32, 'drowned-bell'], [38, 'skein-sweep'], [44, 'snuff']],
    'echo-drain', 60, 160, 'medium-fast', {
      roleTag: 'night_owl',
      sprite: 'brief', size: 32, palette: 'kpndveyw', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([13, 7], [13, 17], [19, 12], [20, 27]),
      feature: 'a tall night owl whose facial disc is an empty ring of dusk, with a lantern-amber glint in each eye',
      mustNotReadAs: ['a tawny owl with a book', 'a top-hatted owl'],
      habitat: 'Thistlewind moor at night, hunting the mill-lanes',
      log: 'Duskowls hunt the moor after the mills stop. Its face is a ring with nothing in it, which it uses to listen. Corin will not say whether they are related.',
      teachable: ['gnash', 'shardlight', 'plumbline', 'flashover'],
    }),
]);

export const family = fam({
  id: 'duskowl', name: 'Duskowl line', windows: [8, 20, 34],
  shiftTable: {
    skirl: {
      up: [e('duskowl', 60, 45, 25), e('skeinwing', 15, 20, 25), e('coilcrest', 15, 20, 25), e('prismoth', 10, 15, 25)],
      side: [e('duskwisp', 50, 45, 33), e('wirewhisk', 25, 30, 33), e('mothling', 25, 25, 33)],
      down: [e('puddlepip', 70, 55, 50), e('sootling', 30, 45, 50)],
    },
    duskwisp: {
      up: [e('duskowl', 65, 50, 33), e('creelwight', 25, 30, 33), e('prismoth', 10, 20, 33)],
      side: [e('skirl', 45, 40, 33), e('rustcreel', 30, 30, 33), e('mothling', 25, 30, 33)],
      down: [e('puddlepip', 60, 50, 50), e('chillnub', 40, 50, 50)],
    },
    duskowl: {
      up: [e('hulkwight', 45, 35, 33), e('strandrunner', 30, 35, 33), e('lumenveil', 25, 30, 33)],
      side: [e('creelwight', 40, 35, 33), e('coilcrest', 30, 35, 33), e('skeinwing', 30, 30, 33)],
      down: [e('skirl', 50, 40, 33), e('duskwisp', 50, 40, 33), e('rustcreel', 0, 20, 33)],
    },
  },
  star: 'duskowl',
  starPalette: { p: 'e', n: 'd', y: 'i' },
  starText: 'Its plumage has gone comet-ash; the empty ring of its face holds a little starlight now.',
});

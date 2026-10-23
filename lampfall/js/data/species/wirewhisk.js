/**
 * Wirewhisk line (GDD-00 §8 family 8; wildshift-creatures §3.10). [DATA-SPECIES]
 * Wirewhisk (1, scout) · Coilcrest (2). The pool is mostly Bolt and Gust.
 * @module data/species/wirewhisk
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('wirewhisk', 'Wirewhisk', ['Bolt'], 'wirewhisk', 1, [45, 40, 45, 62, 55, 88], 'tailhum',
    [[1, 'tap'], [1, 'arc-ping'], [3, 'fizz'], [9, 'jolt'], [12, 'static-net'], [18, 'updraft'], [24, 'shell-rattle'], [30, 'mirror-step'], [36, 'gale-cut']],
    'arc-ping', 190, 55, 'medium-fast', {
      roleTag: 'scout',
      sprite: 'drawn', size: 32, palette: 'kyahorw', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([9, 15], [9, 19], [16, 19], [26, 12]),
      feature: 'a copper spring-coil tail with a spark at the tip; it hums when another creature is near',
      mustNotReadAs: ['a yellow electric mouse', 'a lightning-tailed squirrel'],
      habitat: 'Lowmoor ferry pavilion rafters; harbour towns keep them to sniff out trouble',
      log: 'The copper coil of its tail hums when another creature is near. A good handler can tell from the hum what that creature knows.',
      teachable: ['live-wire', 'shardlight', 'plumbline', 'flashover'],
    }),
  sp('coilcrest', 'Coilcrest', ['Bolt', 'Gust'], 'wirewhisk', 2, [65, 55, 60, 100, 65, 105], 'still-mind',
    [[1, 'arc-ping'], [1, 'fizz'], [1, 'downdraft'], [8, 'jolt'], [14, 'static-net'], [18, 'updraft'], [20, 'gale-cut'], [30, 'live-wire'], [40, 'bandlight'], [44, 'mirror-step']],
    'arc-ping', 45, 165, 'medium-fast', {
      roleTag: 'spire_ace',
      sprite: 'brief', size: 32, palette: 'kyahorws', heartmarkHighlight: 'y', idle: 'hover',
      heartmarkAnchors: anchors([9, 8], [10, 17], [18, 13], [26, 10]),
      feature: 'a crest of three copper coils that spark in turn, and wide wire-ribbed gliding flaps',
      mustNotReadAs: ['a thunderbird', 'a flying squirrel'],
      habitat: 'Thistlewind windmill sails in a high wind; the Hallorans\' Relay Spire ace',
      log: 'Coilcrests ride the mill sails and drop off at the top of the turn. The Hallorans time their sails by the sparks.',
      teachable: ['shardlight', 'plumbline', 'flashover'],
    }),
]);

export const family = fam({
  id: 'wirewhisk', name: 'Wirewhisk line', windows: [8, 20, 34],
  shiftTable: {
    wirewhisk: {
      up: [e('coilcrest', 70, 50, 25), e('skeinwing', 10, 20, 25), e('prismoth', 10, 15, 25), e('duskowl', 10, 15, 25)],
      side: [e('skirl', 45, 40, 33), e('rillfin', 30, 30, 33), e('mothling', 25, 30, 33)],
      down: [e('puddlepip', 70, 55, 50), e('sootling', 30, 45, 50)],
    },
    coilcrest: {
      up: [e('strandrunner', 50, 40, 33), e('lumenveil', 30, 30, 33), e('bogmonarch', 20, 30, 33)],
      side: [e('skeinwing', 40, 35, 33), e('duskowl', 30, 35, 33), e('prismoth', 30, 30, 33)],
      down: [e('wirewhisk', 80, 60, 33), e('skirl', 20, 25, 33), e('mothling', 0, 15, 33)],
    },
  },
  star: 'wirewhisk',
  starPalette: { y: 'v', a: 'e', h: 'd', w: 'i' },
  starText: 'Its coat has gone comet-ash grey; the copper coil still hums and still sparks.',
});

/**
 * The Errants (GDD-00 §8 family 13; wildshift-creatures §3.12). [DATA-SPECIES]
 * Squallcoil (Bolt/Brine, Emberstep onward) · Hailcoil (Rime/Gust, Rimeholt). Great creatures the
 * Starfall scattered onto ordinary routes; Skyroam moves them one route an hour. Each Errant's Side
 * card is the other Errant; nothing sits above them, so Up stays empty. Their Down card is never a
 * hatchling on Drift or Flux (the hatchling rows weigh 0 there), and `systems/forecast` zeroes an
 * Errant's Down card on those dials outright (`ERRANT_ZERO_DOWN`).
 * Catch rate 56: about 22% with a Tallow wick once Capture Stance has it at the floor (GDD-00 §8).
 * @module data/species/errant
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('squallcoil', 'Squallcoil', ['Bolt', 'Brine'], 'errant', 4, [90, 85, 75, 125, 90, 115], 'skyroam',
    [[1, 'jolt'], [1, 'salt-spray'], [12, 'bandlight'], [18, 'static-net'], [25, 'riptide'], [35, 'updraft'], [45, 'live-wire'], [55, 'hullburst'], [65, 'gale-cut']],
    'bandlight', 56, 280, 'slow', {
      roleTag: 'errant', errant: true,
      sprite: 'drawn', size: 32, palette: 'knbsywo', heartmarkHighlight: 'w', idle: 'squash',
      heartmarkAnchors: anchors([6, 4], [10, 14], [20, 19], [27, 25]),
      feature: 'a storm krait with yellow bands that light in sequence the turn before it strikes',
      mustNotReadAs: ['a sea-serpent dragon', 'an electric eel'],
      habitat: 'roams from Emberstep onward, one route an hour; follow the lightning walking on the sea',
      log: 'A storm krait that never stays near one island. Fishers track it by the lightning walking across the water and go home early.',
      teachable: ['hoarfrost', 'drowned-bell', 'plumbline'],
    }),
  sp('hailcoil', 'Hailcoil', ['Rime', 'Gust'], 'errant', 4, [90, 115, 80, 110, 80, 105], 'skyroam',
    [[1, 'frost-nip'], [1, 'gale-cut'], [12, 'floe-ram'], [18, 'rime-lock'], [25, 'hoarfrost'], [35, 'updraft'], [45, 'skein-sweep'], [55, 'cairn-crash'], [65, 'downdraft']],
    'gale-cut', 56, 280, 'slow', {
      roleTag: 'errant', errant: true,
      sprite: 'brief', size: 32, palette: 'knsiwvbe', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([6, 5], [10, 14], [20, 19], [27, 25]),
      feature: 'a frost krait in three loose coils with frilled fin-wings; hailstones rattle inside its pale bands',
      mustNotReadAs: ['an ice dragon', 'a winged sea serpent'],
      habitat: 'roams Rimeholt in hard weather; the sky goes white a minute before it arrives',
      log: 'Where Squallcoil brings the lightning, Hailcoil brings the rattle on the roof. Rimeholt children count the hail and guess how close.',
      teachable: ['drowned-bell', 'gnash', 'plumbline'],
    }),
]);

export const family = fam({
  id: 'errant', name: 'Errants', windows: [8, 20, 34],
  shiftTable: {
    squallcoil: {
      up: [],
      side: [e('hailcoil', 100, 100, 100)],
      down: [e('strandrunner', 40, 40, 25), e('coilcrest', 30, 30, 25), e('vesperay', 30, 30, 25), e('puddlepip', 0, 0, 25)],
    },
    hailcoil: {
      up: [],
      side: [e('squallcoil', 100, 100, 100)],
      down: [e('floeback', 35, 35, 25), e('strandrunner', 35, 35, 25), e('skeinwing', 30, 30, 25), e('chillnub', 0, 0, 25)],
    },
  },
  star: 'squallcoil',
  starPalette: { b: 'e', s: 'v', n: 'd', y: 'i' },
  starText: 'Its bands have gone the white of comet light; they still light in order before it strikes.',
});

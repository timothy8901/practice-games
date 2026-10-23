/**
 * Creelwight line (GDD-00 §8 family 7; wildshift-creatures §3.8). [DATA-SPECIES]
 * Rustcreel (1) · Creelwight (2) · Hulkwight (3). The pool stays mostly Hollow and Rust, so a
 * Hollow wall stays a Hollow wall. Tamsin's Creelwight "Kettle" holds her boat's nameboard.
 * @module data/species/creelwight
 */

import { sp, e, family as fam, anchors } from './_helpers.js';

export const forms = Object.freeze([
  sp('rustcreel', 'Rustcreel', ['Rust'], 'creelwight', 1, [55, 62, 80, 40, 55, 30], 'scavenger',
    [[1, 'tap'], [1, 'rust-bite'], [5, 'corrode'], [10, 'settle'], [15, 'murk'], [21, 'iron-pin'], [27, 'stand-firm'], [33, 'shellguard'], [40, 'hullburst']],
    'rust-bite', 140, 62, 'medium-fast', {
      roleTag: 'hollow_kin',
      sprite: 'brief', size: 32, palette: 'kroedvy', heartmarkHighlight: 'y', idle: 'squash',
      heartmarkAnchors: anchors([11, 15], [12, 21], [17, 13], [23, 20]),
      feature: 'a crab wearing a rusted lobster-pot as a shell, one claw much bigger, a frayed buoy line trailing behind',
      mustNotReadAs: ['a hermit crab in a shell', 'a crab with a giant claw'],
      habitat: 'Drownwood\'s drowned street, among the sunken pots',
      log: 'It moved into a lost lobster pot and kept the door. Rustcreels pinch what they can and keep the rest of the day free.',
      teachable: ['sandtrap', 'drowned-bell', 'gnash', 'plumbline', 'live-wire'],
    }),
  sp('creelwight', 'Creelwight', ['Hollow', 'Rust'], 'creelwight', 2, [70, 65, 110, 70, 95, 30], 'empty-weave',
    [[1, 'tap'], [1, 'snuff'], [8, 'rust-bite'], [12, 'murk'], [15, 'corrode'], [22, 'echo-drain'], [29, 'iron-pin'], [36, 'stand-firm'], [40, 'drowned-bell'], [43, 'shellguard'], [50, 'hullburst']],
    'snuff', 60, 150, 'medium-slow', {
      roleTag: 'hollow_wall',
      sprite: 'drawn', size: 32, palette: 'kdprovi', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([14, 10], [10, 19], [21, 9], [25, 20]),
      feature: 'a rusting iron creel with two lights inside; a ring of rope circles it until Empty Weave is spent',
      mustNotReadAs: ['a haunted cage ghost', 'a lantern spirit'],
      habitat: 'Drownwood mangroves at night; any Pellwick reach can hook one',
      log: 'An iron creel lost in a storm, still fishing. The cage is empty, but something inside keeps the door shut. Fishers who hear it knock on a hull cut their lines.',
      teachable: ['gnash', 'sandtrap', 'plumbline', 'live-wire'],
    }),
  sp('hulkwight', 'Hulkwight', ['Hollow', 'Rust'], 'creelwight', 3, [90, 80, 130, 80, 105, 30], 'empty-weave',
    [[1, 'tap'], [1, 'snuff'], [1, 'rust-bite'], [8, 'corrode'], [15, 'murk'], [22, 'echo-drain'], [24, 'stand-firm'], [28, 'drowned-bell'], [29, 'iron-pin'], [34, 'hush'], [50, 'shellguard'], [56, 'hullburst']],
    'snuff', 30, 235, 'medium-slow', {
      roleTag: 'spire_ace',
      sprite: 'brief', size: 32, palette: 'kdproeiv', heartmarkHighlight: 'w', idle: 'hover',
      heartmarkAnchors: anchors([10, 9], [11, 19], [20, 8], [28, 18]),
      feature: 'the bow section of a lost fleet boat, ribs showing, two lights low in the hold; a nameboard nobody can read',
      mustNotReadAs: ['a ghost pirate ship', 'a shipwreck boss monster'],
      habitat: 'Drownwood\'s deepest channel; Wendel\'s Hollow Spire ace',
      log: 'Some of the lost fleet did not sink so much as settle in. Wendel taps the hull twice before every match and swears it taps back.',
      teachable: ['gnash', 'sandtrap', 'cairn-crash', 'plumbline', 'live-wire'],
    }),
]);

export const family = fam({
  id: 'creelwight', name: 'Creelwight line', windows: [8, 20, 34],
  shiftTable: {
    rustcreel: {
      up: [e('creelwight', 70, 55, 33), e('duskowl', 20, 25, 33), e('rimeplate', 10, 20, 33)],
      side: [e('duskwisp', 50, 45, 33), e('bilgebob', 25, 30, 33), e('tossup', 25, 25, 33)],
      down: [e('puddlepip', 60, 50, 50), e('sootling', 40, 50, 50)],
    },
    creelwight: {
      up: [e('hulkwight', 75, 60, 33), e('caldermaw', 15, 20, 33), e('floeback', 10, 20, 33)],
      side: [e('duskowl', 50, 40, 33), e('cairnward', 25, 30, 33), e('brinelance', 25, 30, 33)],
      down: [e('rustcreel', 75, 55, 33), e('duskwisp', 25, 30, 33), e('chillnub', 0, 15, 33)],
    },
    hulkwight: {
      up: [e('caldermaw', 50, 40, 25), e('floeback', 40, 40, 25), e('squallcoil', 5, 10, 25), e('hailcoil', 5, 10, 25)],
      side: [e('lumenveil', 40, 35, 33), e('cragmitt', 30, 35, 33), e('bogmonarch', 30, 30, 33)],
      down: [e('creelwight', 80, 60, 33), e('duskowl', 20, 25, 33), e('rustcreel', 0, 15, 33)],
    },
  },
  star: 'creelwight',
  starPalette: { r: 'e', o: 'v', p: 'd' },
  starText: 'The rust has gone comet-ash grey; the two lights inside burn as they always did.',
});

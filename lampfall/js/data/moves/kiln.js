/** Kiln techniques (5: four prototype + Flashover, the "Kiln disc"). [GDD-04 BATTLE] @module data/moves/kiln */
import { m } from './_helpers.js';

export default Object.freeze([
  m('ember-lick', 'Ember Lick', 'Kiln', 'special', 45, 100, 25, 0, { status: { kind: 'burn', chance: 0.1 } }, 'May burn the target.'),
  m('kiln-maw', 'Kiln Maw', 'Kiln', 'special', 75, 100, 15, 0, {}, 'A furnace blast from the jaws.', 'caldermaw'),
  m('scorch', 'Scorch', 'Kiln', 'status', 0, 85, 15, 0, { status: { kind: 'burn', chance: 1 } }, 'Burns the target.'),
  m('slag-burst', 'Slag Burst', 'Kiln', 'physical', 80, 100, 10, 0, { status: { kind: 'burn', chance: 0.2 }, contact: true }, 'A slam of molten slag. May burn.'),
  // New (GDD-ids): the coverage nuke sold as a disc for 2,500 (Day 10's "Gap: Hollow" answer).
  m('flashover', 'Flashover', 'Kiln', 'special', 100, 90, 5, 0, { stat: [{ target: 'self', stat: 'spa', stages: -1 }] }, "The whole room catches at once. Lowers the user's Sp. Attack one stage."),
]);

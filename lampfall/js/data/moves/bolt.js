/** Bolt techniques (6: four prototype + Fizz, Live Wire). [GDD-04 BATTLE] @module data/moves/bolt */
import { m } from './_helpers.js';

export default Object.freeze([
  m('arc-ping', 'Arc Ping', 'Bolt', 'special', 30, 100, 20, 1, { revealMoves: true }, "Moves first. Reveals the target's full moveset.", 'wirewhisk'),
  m('jolt', 'Jolt', 'Bolt', 'special', 65, 100, 20, 0, { status: { kind: 'numb', chance: 0.1 } }, 'May numb the target.'),
  m('bandlight', 'Bandlight', 'Bolt', 'special', 90, 100, 10, 0, { charge: 1 }, 'The bands light in sequence one turn, then it strikes the next.', 'squallcoil'),
  m('static-net', 'Static Net', 'Bolt', 'status', 0, 90, 20, 0, { status: { kind: 'numb', chance: 1 } }, 'Numbs the target.'),
  // New (GDD-ids): the cheap early Bolt poke and the late reckless one.
  m('fizz', 'Fizz', 'Bolt', 'special', 40, 100, 30, 0, { status: { kind: 'numb', chance: 0.1 } }, 'A pop of static, like a shuffled rug. 10% chance to numb.'),
  m('live-wire', 'Live Wire', 'Bolt', 'physical', 95, 100, 10, 0, { stat: [{ target: 'self', stat: 'def', stages: -1 }], contact: true }, "Grabs the current bare-handed. Lowers the user's Defence one stage."),
]);

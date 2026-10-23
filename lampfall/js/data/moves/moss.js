/** Moss techniques (5: four prototype + Mire Bloom). [GDD-04 BATTLE] @module data/moves/moss */
import { m } from './_helpers.js';

export default Object.freeze([
  m('reed-whip', 'Reed Whip', 'Moss', 'physical', 50, 100, 25, 0, { contact: true }, 'A lash of sharp reeds.'),
  m('reap', 'Reap', 'Moss', 'physical', 70, 100, 15, 0, { highCrit: 1, contact: true }, 'High crit rate.', 'sedgehare'),
  m('root-knot', 'Root Knot', 'Moss', 'status', 0, 90, 15, 0, { status: { kind: 'trap', chance: 1 } }, 'Traps the target for 4 turns; it takes chip damage and cannot switch.'),
  m('spore-drift', 'Spore Drift', 'Moss', 'status', 0, 90, 20, 0, { status: { kind: 'poison', chance: 1 } }, 'Poisons the target.'),
  // New (GDD-ids): a drain that is not a Mend, so it keeps working after the pips run out.
  m('mire-bloom', 'Mire Bloom', 'Moss', 'special', 80, 100, 10, 0, { drain: 0.25 }, 'Marsh flowers open on the target and close on the user. Heals 1/4 of the damage dealt (not a Mend).'),
]);

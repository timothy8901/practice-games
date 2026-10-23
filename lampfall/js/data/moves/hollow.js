/** Hollow techniques (7: four prototype + Murk, Drowned Bell, Hush). [GDD-04 BATTLE] @module data/moves/hollow */
import { m } from './_helpers.js';

export default Object.freeze([
  m('shadowbox', 'Shadowbox', 'Hollow', 'physical', 50, 100, 10, 0, { contact: true }, 'A jab at its own shadow.', 'scrapling'),
  m('gnash', 'Gnash', 'Hollow', 'physical', 60, 100, 15, 0, { flinch: 0.3, popsDecoy: 1, contact: true }, '30% flinch chance. Each hit pops one Afterimage decoy.', 'brinelance'),
  m('snuff', 'Snuff', 'Hollow', 'special', 50, 100, 15, 0, { clearRaised: true }, "Removes the target's raised stat stages.", 'creelwight'),
  m('echo-drain', 'Echo Drain', 'Hollow', 'special', 70, 100, 10, 0, { drain: 0.5 }, 'Heals the user by half the damage dealt (not a Mend).'),
  // New (GDD-ids): the night line's toolkit.
  m('murk', 'Murk', 'Hollow', 'special', 40, 100, 30, 0, { stat: [{ target: 'foe', stat: 'spd', stages: -1 }], chance: 0.2 }, "A smear of dusk. 20% chance to lower the target's Sp. Defence one stage."),
  m('drowned-bell', 'Drowned Bell', 'Hollow', 'special', 90, 90, 10, 0, { flinch: 0.1 }, 'A bell tolls from under the bar. 10% chance to flinch.'),
  m('hush', 'Hush', 'Hollow', 'status', 0, 100, 15, 0, { stat: [{ target: 'foe', stat: 'spa', stages: -2 }] }, "A finger to the lips. Sharply lowers the target's Sp. Attack."),
]);

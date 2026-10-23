/** Grit techniques (4). Prototype numbers kept. [GDD-04 BATTLE] @module data/moves/grit */
import { m } from './_helpers.js';

export default Object.freeze([
  m('knuckle', 'Knuckle', 'Grit', 'physical', 60, 100, 25, 0, { contact: true }, 'A wrapped-fist punch.'),
  m('grind-down', 'Grind Down', 'Grit', 'physical', 85, 90, 15, 0, { contact: true }, 'A grinding grapple.'),
  m('pummel', 'Pummel', 'Grit', 'physical', 20, 100, 20, 0, { multiHit: [2, 5], contact: true }, 'Hits 2 to 5 times. Each hit pops one Afterimage decoy.'),
  m('sand-smother', 'Sand Smother', 'Grit', 'status', 0, 100, 20, 0, { stat: [{ target: 'foe', stat: 'atk', stages: -1 }] }, "Lowers the target's Attack."),
]);

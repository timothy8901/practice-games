/** Brine techniques (5: four prototype + Breaker). [GDD-04 BATTLE] @module data/moves/brine */
import { m } from './_helpers.js';

export default Object.freeze([
  m('undertow', 'Undertow', 'Brine', 'physical', 65, 100, 15, 0, { stat: [{ target: 'foe', stat: 'spe', stages: -1 }], contact: true }, "Lowers the target's Speed one stage.", 'sloshkin'),
  m('salt-spray', 'Salt Spray', 'Brine', 'special', 50, 100, 25, 0, {}, 'A spray of stinging salt water.'),
  m('riptide', 'Riptide', 'Brine', 'special', 90, 85, 10, 0, {}, 'A dragging surge of sea.'),
  m('tidal-mend', 'Tidal Mend', 'Brine', 'status', 0, null, 10, 0, { recovery: { fraction: 0.5, delay: 0 } }, 'Heals 50% of max HP. Spends one Mend.'),
  // New (GDD-ids): the honest physical Brine hit the Sloshkin and Rillfin lines grow into.
  m('breaker', 'Breaker', 'Brine', 'physical', 75, 95, 15, 0, { contact: true }, 'A wave-slam with the whole body behind it. Nothing fancy.'),
]);

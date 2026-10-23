/** Gust techniques (5: four prototype + Downdraft). [GDD-04 BATTLE] @module data/moves/gust */
import { m } from './_helpers.js';

export default Object.freeze([
  // Text trimmed for singles (no doubles, GDD-00 §8); numbers and the `spread` decoy rule kept.
  m('skein-sweep', 'Skein Sweep', 'Gust', 'special', 60, 100, 15, 0, { spread: true }, 'A whole skein of wind at once. Pops every Afterimage decoy, even on a miss.', 'skeinwing'),
  m('gale-cut', 'Gale Cut', 'Gust', 'physical', 70, 100, 15, 0, { contact: true }, 'A cutting wind.'),
  m('updraft', 'Updraft', 'Gust', 'status', 0, null, 20, 0, { stat: [{ target: 'self', stat: 'spe', stages: 2 }] }, "Sharply raises the user's Speed."),
  m('mirror-step', 'Mirror Step', 'Gust', 'status', 0, null, 5, 0, { evasion: 1 }, 'Raises evasion one stage (max +2).'),
  // New (GDD-ids): the Gust priority poke; finishes a weakened foe before it moves.
  m('downdraft', 'Downdraft', 'Gust', 'special', 40, 100, 30, 1, {}, 'A sudden push of air from above. Moves first.'),
]);

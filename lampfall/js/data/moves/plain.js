/** Plain techniques (5). Prototype numbers kept. [GDD-04 BATTLE] @module data/moves/plain */
import { m } from './_helpers.js';

export default Object.freeze([
  m('tap', 'Tap', 'Plain', 'physical', 40, 100, 35, 0, { contact: true }, 'An everyday blow.'),
  m('sure-pinch', 'Sure Pinch', 'Plain', 'physical', 40, null, 20, 0, { sureHit: true, contact: true }, 'Never misses. An early answer to evasion.', 'tossup'),
  m('shell-rattle', 'Shell Rattle', 'Plain', 'special', 55, 100, 25, 0, {}, 'A rattling shock of sound.'),
  m('settle', 'Settle', 'Plain', 'status', 0, null, 20, 0, { stat: [{ target: 'self', stat: 'def', stages: 1 }, { target: 'self', stat: 'spd', stages: 1 }] }, "Raises the user's Defence and Sp. Defence."),
  m('shellguard', 'Shellguard', 'Plain', 'status', 0, null, 10, 4, { guard: true }, 'Guards against every move this turn. Fails if used on consecutive turns.'),
]);

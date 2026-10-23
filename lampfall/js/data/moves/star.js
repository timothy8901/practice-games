/** Star techniques (2): the Vagary's signature and Starfall. [GDD-04 BATTLE] @module data/moves/star */
import { m } from './_helpers.js';

export default Object.freeze([
  m('tailfall', 'Tailfall', 'Star', 'special', 90, 100, 10, 0, { queuedType: true }, "Takes the type next in the user's Unfixed queue.", 'vagary'),
  m('starfall', 'Starfall', 'Star', 'special', 70, 100, 15, 0, {}, 'Comet light. Neutral against everything.'),
]);

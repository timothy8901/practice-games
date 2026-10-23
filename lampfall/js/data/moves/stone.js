/** Stone techniques (5: four prototype + Cairn Crash). [GDD-04 BATTLE] @module data/moves/stone */
import { m } from './_helpers.js';

export default Object.freeze([
  m('shard-fling', 'Shard Fling', 'Stone', 'physical', 55, 95, 25, 0, {}, 'Flings sharp stone.'),
  m('bedrock-charge', 'Bedrock Charge', 'Stone', 'physical', 100, 100, 5, 0, { charge: 1, contact: true }, 'Braces for one turn while dust falls, then hits.', 'stillox'),
  m('sandtrap', 'Sandtrap', 'Stone', 'status', 0, 85, 15, 0, { status: { kind: 'trap', chance: 1 } }, 'Traps the target for 4 turns; chip damage, no switching.'),
  m('stand-firm', 'Stand Firm', 'Stone', 'status', 0, null, 15, 0, { stat: [{ target: 'self', stat: 'def', stages: 2 }] }, "Sharply raises the user's Defence."),
  // New (GDD-ids): the coverage disc that answers Prismoth's Glasshide... if it lands.
  m('cairn-crash', 'Cairn Crash', 'Stone', 'physical', 95, 85, 10, 0, { contact: true }, 'Topples a whole cairn onto the target. Heavy, and it misses more than it likes to admit.'),
]);

/**
 * Typeless rows (2): Plumbline (a technique, badge 6's disc) and Scrap (no slot). [GDD-04 BATTLE]
 * Plumbline ignores every Ward, Mirrorveil included (GDD-00 §8 rulings: the Mirror Spire's disc must
 * answer the Mirror Spire); Scrap never pierces a Ward and its recoil applies even when one blocks it.
 * @module data/moves/typeless
 */
import { m } from './_helpers.js';

export default Object.freeze([
  m('plumbline', 'Plumbline', null, 'status', 0, null, 10, 0, { plumbline: true, sureHit: true }, "Always hits, through every Ward and Mirrorveil too. Clears the target's stat stages and blocks re-boosting for 2 turns."),
  m('scrap', 'Scrap', null, 'physical', 50, null, null, 0, { scrap: true, sureHit: true }, 'Typeless fallback. Never misses, costs the user 1/8 max HP, never pierces Wards.'),
]);

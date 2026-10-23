/**
 * Move row helper for the technique files (ARCHITECTURE §14.3). [GDD-04 BATTLE]
 *
 * `m(id, name, type|null, category, power, accuracy|null, pp|null, priority, effect, text, signature?)`
 * returns one frozen §14.3 row. `type` is the type's display name ('Brine') or null for typeless;
 * `accuracy: null` never misses; `pp: null` is reserved for Scrap. `effect` keys come from
 * `battle/effects.EFFECT_KEYS`. Pure data: no imports, no behaviour.
 * @module data/moves/_helpers
 */

/**
 * @param {string} id @param {string} name @param {string|null} type
 * @param {'physical'|'special'|'status'} category
 * @param {number} power @param {number|null} accuracy @param {number|null} pp @param {number} priority
 * @param {Record<string, any>} effect @param {string} text @param {string} [signature]
 * @returns {Readonly<import('../index.js').Move>}
 */
export function m(id, name, type, category, power, accuracy, pp, priority, effect, text, signature) {
  const row = { id, name, type, category, power, accuracy, pp, priority, effect: Object.freeze({ ...effect }), text };
  if (signature) row.signature = signature;
  return Object.freeze(row);
}

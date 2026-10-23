/** SHIM for js/data/dials.js [DATA-ECON]. Delete at integration. */

/** Dial ids in display order. */
export const DIAL_IDS = Object.freeze(['drift', 'flux', 'freefall']);

/** Seed-code toggle registry (append-only in the real file). */
export const TOGGLE_ORDER = Object.freeze([]);

/** Challenge ids (empty until DATA-ECON lands). */
export const CHALLENGES = Object.freeze([]);

/**
 * Dial rule tables. `default` names the dial a fresh seed uses. [GDD values]
 * @type {Readonly<{default: string} & Record<string, Readonly<{id: string, name: string, text: string}>>>}
 */
export const DIALS = Object.freeze({
  default: 'drift',
  drift: Object.freeze({ id: 'drift', name: 'Drift', text: 'Gentle odds, visible Forecasts.' }),
  flux: Object.freeze({ id: 'flux', name: 'Flux', text: 'The intended game.' }),
  freefall: Object.freeze({ id: 'freefall', name: 'Freefall', text: 'No anchors, no rerolls.' }),
});

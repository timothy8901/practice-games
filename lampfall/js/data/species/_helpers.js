/**
 * Row builders for the species and family files (ARCHITECTURE §14.1-§14.2). [DATA-SPECIES]
 *
 * Content files call these once at load; they return plain frozen data, so the tables stay pure
 * data (no function values reach `DATA`). Pure: imports only `../ids.js`.
 * @module data/species/_helpers
 */

import { deepFreeze } from '../ids.js';

/**
 * One form (ARCHITECTURE §14.1).
 * @param {string} id  @param {string} name  @param {string[]} types type names (`'Brine'`)
 * @param {string} familyId  @param {number} stage 0..4
 * @param {[number, number, number, number, number, number]} base [hp, atk, def, spa, spd, spe]
 * @param {string} ability  @param {Array<[number, string]>} learnset [level, moveId]
 * @param {string|null} heartmark  @param {number} catchRate 3..255  @param {number} expYield
 * @param {'fast'|'medium-fast'|'medium-slow'|'slow'} growth  @param {Record<string, any>} flags
 * @returns {import('../index.js').Species}
 */
export function sp(id, name, types, familyId, stage, base, ability, learnset, heartmark, catchRate, expYield, growth, flags) {
  const [hp, atk, def, spa, spd, spe] = base;
  const sorted = learnset.slice().sort((a, b) => a[0] - b[0]);
  return deepFreeze({
    id, name, types: types.slice(), familyId, stage,
    base: { hp, atk, def, spa, spd, spe },
    ability, learnset: sorted.map(([lv, mv]) => [lv, mv]), heartmark, catchRate, expYield, growth,
    flags: { ...(flags ?? {}) },
  });
}

/**
 * Per-dial pool weight `{drift, flux, freefall}` (ARCHITECTURE §14.2 amendment). A 0 means the form
 * never shows on that dial; Freefall weights are equal inside a card (GDD-00 §8 "flattened").
 * @param {number} drift  @param {number} flux  @param {number} freefall
 * @returns {{drift: number, flux: number, freefall: number}}
 */
export function W(drift, flux, freefall) {
  return { drift, flux, freefall };
}

/**
 * One pool entry.
 * @param {string} form  @param {number} drift  @param {number} flux  @param {number} freefall
 * @returns {{form: string, w: {drift: number, flux: number, freefall: number}}}
 */
export function e(form, drift, flux, freefall) {
  return { form, w: W(drift, flux, freefall) };
}

/**
 * A pool where every entry weighs the same on every dial (Tossup's lottery: "split evenly").
 * @param {string[]} forms
 * @returns {Array<{form: string, w: {drift: number, flux: number, freefall: number}}>}
 */
export function even(forms) {
  return forms.map((form) => ({ form, w: W(1, 1, 1) }));
}

/**
 * Pixel point helper for Heartmark anchors.
 * @param {number} x  @param {number} y
 * @returns {{x: number, y: number}}
 */
export function pt(x, y) {
  return { x, y };
}

/**
 * The four Heartmark anchors a form declares (GDD-00 §14): each individual rolls one at hatch.
 * @param {[number, number]} head  @param {[number, number]} chest  @param {[number, number]} back  @param {[number, number]} tail
 * @returns {{head: {x: number, y: number}, chest: {x: number, y: number}, back: {x: number, y: number}, tail: {x: number, y: number}}}
 */
export function anchors(head, chest, back, tail) {
  return { head: pt(...head), chest: pt(...chest), back: pt(...back), tail: pt(...tail) };
}

/**
 * One family row (ARCHITECTURE §14.2).
 * @param {{id: string, name: string, windows: number[], shiftTable: Record<string, any>, star: string|null, [k: string]: any}} row
 * @returns {import('../index.js').Family}
 */
export function family(row) {
  return deepFreeze({ ...row });
}

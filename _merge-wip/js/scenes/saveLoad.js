/**
 * Save / Load scene. [SCN-MENU] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/saveLoad
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createSaveLoadScene(G) {
  return createStubScene(G, 'saveLoad', { label: 'Save / Load', lane: 'SCN-MENU' });
}

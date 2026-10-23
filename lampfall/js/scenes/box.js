/**
 * Box scene. [SCN-MENU] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/box
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createBoxScene(G) {
  return createStubScene(G, 'box', { label: 'Box', lane: 'SCN-MENU' });
}

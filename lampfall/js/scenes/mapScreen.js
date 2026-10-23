/**
 * Map scene. [SCN-MENU] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/mapScreen
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createMapScreenScene(G) {
  return createStubScene(G, 'mapScreen', { label: 'Map', lane: 'SCN-MENU' });
}

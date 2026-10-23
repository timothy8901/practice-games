/**
 * Fishing scene. [SCN-GATHER] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/fishing
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createFishingScene(G) {
  return createStubScene(G, 'fishing', { label: 'Fishing', lane: 'SCN-GATHER' });
}

/**
 * Seed Card scene. [SCN-FLOW] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/seedCard
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createSeedCardScene(G) {
  return createStubScene(G, 'seedCard', { label: 'Seed Card', lane: 'SCN-FLOW' });
}

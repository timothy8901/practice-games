/**
 * Credits scene. [SCN-FLOW] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/credits
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createCreditsScene(G) {
  return createStubScene(G, 'credits', { label: 'Credits', lane: 'SCN-FLOW' });
}

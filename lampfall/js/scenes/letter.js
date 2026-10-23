/**
 * Letter scene. [SCN-UI] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/letter
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createLetterScene(G) {
  return createStubScene(G, 'letter', { label: 'Letter', lane: 'SCN-UI' });
}

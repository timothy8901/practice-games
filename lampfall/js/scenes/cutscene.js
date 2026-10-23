/**
 * Cutscene scene. [SCN-UI] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/cutscene
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createCutsceneScene(G) {
  return createStubScene(G, 'cutscene', { label: 'Cutscene', lane: 'SCN-UI', opaque: false });
}

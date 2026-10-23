/**
 * Battle scene. [SCN-BATTLE] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/battle
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createBattleScene(G) {
  return createStubScene(G, 'battle', { label: 'Battle', lane: 'SCN-BATTLE' });
}

/**
 * Settings scene. [SCN-MENU] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/settings
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createSettingsScene(G) {
  return createStubScene(G, 'settings', { label: 'Settings', lane: 'SCN-MENU' });
}

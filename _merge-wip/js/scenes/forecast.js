/**
 * Forecast scene. [SCN-BATTLE] DAY-1 STUB: draws its name on paper and pops on cancel.
 * Replace this file wholesale; keep the export name so `scenes/index.js` stays append-only.
 * @module scenes/forecast
 */
import { createStubScene } from './stub.js';

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createForecastScene(G) {
  return createStubScene(G, 'forecast', { label: 'Forecast', lane: 'SCN-BATTLE' });
}

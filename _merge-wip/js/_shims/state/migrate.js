/** SHIM for js/state/migrate.js [STATE]. Delete at integration. */
import { createNewWorld, SCHEMA_VERSION } from './schema.js';

/** Keyed by the version being upgraded FROM. */
export const MIGRATIONS = Object.freeze({});

/**
 * Runs migrations in order, then fills missing keys from a fresh world of the same seed.
 * @param {object} data a saved world
 * @returns {object}
 */
export function migrateWorld(data) {
  let w = data;
  for (let v = w.v ?? 1; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    w = step ? step(w) : w;
    w.v = v + 1;
  }
  const seedCode = w.run && typeof w.run.seedCode === 'string' ? w.run.seedCode : null;
  if (!seedCode) return w;
  const defaults = createNewWorld({ seedCode });
  for (const key of Object.keys(defaults)) if (!(key in w)) w[key] = defaults[key];
  return w;
}

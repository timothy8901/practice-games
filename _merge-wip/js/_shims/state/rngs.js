/** SHIM for js/state/rngs.js [STATE]. Delete at integration. Signature per ARCHITECTURE-DRAFT §9. */
import { makeRng } from '../../core/rng.js';

/**
 * @typedef {Object} Rngs
 * @property {(label: string) => import('../../core/rng.js').Rng} stream   stateful, saved in world.rng
 * @property {(label: string) => import('../../core/rng.js').Rng} fresh    stateless fork
 * @property {(kind: string, day: number) => import('../../core/rng.js').Rng} day
 * @property {(uid: string) => import('../../core/rng.js').Rng} creature
 * @property {(world: object) => import('../../core/rng.js').Rng} battle
 * @property {(world: object) => void} commit
 */

/**
 * @param {import('./store.js').Store} store
 * @returns {Rngs}
 */
export function createRngs(store) {
  /** @type {Map<string, import('../../core/rng.js').Rng>} */
  let streams = new Map();
  let master = null;
  let masterSeed = null;

  function root() {
    const seed = store.world.run.seed;
    if (master === null || seed !== masterSeed) {
      master = makeRng(seed);
      masterSeed = seed;
      streams = new Map();
    }
    return master;
  }
  store.bus.on('world:replaced', () => { master = null; streams = new Map(); });

  const fresh = (label) => root().fork(label);
  return Object.freeze({
    fresh,
    stream(label) {
      root();
      let rng = streams.get(label);
      if (!rng) {
        rng = root().fork(label);
        const saved = store.world.rng && store.world.rng[label];
        if (Array.isArray(saved) && saved.length === 4) rng.restore(saved);
        streams.set(label, rng);
      }
      return rng;
    },
    day: (kind, day) => fresh(`${kind}:${day}`),
    creature: (uid) => fresh(`shift:${uid}`),
    battle: (world) => fresh(`battle:${world.stats.battles}`),
    commit(world) {
      if (!world.rng || typeof world.rng !== 'object') world.rng = {};
      for (const [label, rng] of streams) world.rng[label] = rng.state();
    },
  });
}

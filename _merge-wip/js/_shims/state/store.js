/** SHIM for js/state/store.js [STATE]. Delete at integration. Signature per ARCHITECTURE-DRAFT §3.2. */
import { createBus } from '../../core/events.js';

/**
 * @typedef {Object} Store
 * @property {object} world
 * @property {import('../../core/events.js').EventBus} bus
 * @property {<T>(label: string, fn: (world: object) => T) => T} tx
 * @property {() => boolean} dirty
 * @property {() => void} clean
 * @property {Map<string, any>} derived
 * @property {(world: object) => void} replace
 * @property {() => object} snapshot
 * @property {() => boolean} inTx
 */

/**
 * @param {object} world
 * @param {{bus?: import('../../core/events.js').EventBus, strict?: boolean}} [opts]
 * @returns {Store}
 */
export function createStore(world, opts = {}) {
  if (!world || typeof world !== 'object') throw new TypeError('createStore: world must be an object');
  const bus = opts.bus ?? createBus();
  const derived = new Map();
  let live = world;
  let isDirty = false;
  let depth = 0;

  const store = {
    get world() { return live; },
    bus,
    derived,
    tx(label, fn) {
      if (typeof label !== 'string' || !label) throw new TypeError('store.tx: label must be a non-empty string');
      if (typeof fn !== 'function') throw new TypeError('store.tx: fn must be a function');
      depth++;
      try {
        return fn(live);
      } finally {
        depth--;
        isDirty = true;
        if (depth === 0) bus.emit('tx', { label });
      }
    },
    dirty: () => isDirty,
    clean() { isDirty = false; },
    inTx: () => depth > 0,
    replace(next) {
      if (!next || typeof next !== 'object') throw new TypeError('store.replace: world must be an object');
      live = next;
      derived.clear();
      isDirty = false;
      bus.emit('world:replaced', live);
    },
    snapshot() { return structuredClone(live); },
  };
  return store;
}

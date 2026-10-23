/**
 * The game state store (ARCHITECTURE §3.2): holds the one live `world`, the domain event bus, the
 * dirty flag, the non-serialized `derived` side table, and the transaction wrapper every mutation
 * goes through (`G.store.tx(label, w => system.fn(w, ...))`).
 *
 * In strict mode (`?debug=1&strict=1`) `store.world` is a deep Proxy that throws on any write made
 * outside a transaction: the runtime half of rule 1 (the static half is `tools/lint-owners.mjs`).
 *
 * Pure: no DOM. Lane: STATE.
 * @module state/store
 */

import { createBus } from '../core/events.js';

/** @typedef {import('./schema.js').World} World */
/** @typedef {import('../core/events.js').EventBus} Bus */

/**
 * @typedef {Object} Store
 * @property {World} world        the live object; read freely, mutate only inside `tx` via a system function
 * @property {Bus} bus            core/events bus (domain events, §3.4)
 * @property {<T>(label: string, fn: (world: World) => T) => T} tx
 *   runs `fn(world)`, marks the store dirty and emits `'tx'` `{label}` once the OUTERMOST transaction
 *   completes; nested calls collapse into the outer one (one `tx` event, one dirty mark). An exception
 *   propagates after the store is still marked dirty (the world may be half-changed).
 * @property {() => boolean} dirty      unsaved changes since the last `clean()`
 * @property {() => void} clean         called by persist after a successful write
 * @property {() => boolean} inTx       true while a transaction is running
 * @property {Map<string, any>} derived NOT serialized: path caches, schedule lookups, chunk handles; cleared on `replace` and `map:enter`
 * @property {(world: World) => void} replace   swap in a loaded world; clears `derived`; emits `'world:replaced'` `{world}`
 * @property {() => World} snapshot     runs the snapshot hooks (rngs.commit, clock serialize) then returns a structuredClone, for saving
 * @property {(fn: (world: World) => void) => () => void} onSnapshot
 *   registers a hook run inside `snapshot()` before cloning (write guard suspended, no `tx` event); returns an unsubscribe
 * @property {boolean} strict           whether the write guard is active
 * @property {() => World} raw          the unproxied world (strict mode only differs); for structuredClone / JSON
 */

/**
 * @typedef {Object} StoreOptions
 * @property {Bus} [bus]        an existing bus to share; one is created otherwise
 * @property {boolean} [strict] wrap `world` in the write guard (debug only)
 */

/**
 * Raised by the strict-mode write guard.
 */
export class StrictWriteError extends Error {
  /**
   * @param {string} op
   * @param {string} path
   */
  constructor(op, path) {
    super(`store: ${op} on world.${path} outside a transaction (wrap it in store.tx(label, fn))`);
    this.name = 'StrictWriteError';
    this.path = path;
  }
}

/**
 * Creates the store around `world`.
 * @param {World} world
 * @param {StoreOptions} [opts]
 * @returns {Store}
 * @throws {TypeError} when `world` is not an object
 */
export function createStore(world, opts = {}) {
  if (world === null || typeof world !== 'object') {
    throw new TypeError('createStore: world must be an object');
  }
  const bus = opts.bus ?? createBus();
  const strict = opts.strict === true;

  /** @type {World} */
  let target = world;
  /** @type {World} */
  let exposed = world;
  let depth = 0;
  let dirtyFlag = false;
  /** @type {Set<(world: World) => void>} */
  const snapshotHooks = new Set();
  /** @type {Map<string, any>} */
  const derived = new Map();

  // --- strict proxy -----------------------------------------------------------------------------

  /** @type {WeakMap<object, object>} proxy cache so identity is stable per target */
  const proxies = new WeakMap();
  /** @type {WeakMap<object, string>} target -> path label for error messages */
  const paths = new WeakMap();

  /**
   * @param {object} obj
   * @param {string} path
   * @returns {object}
   */
  function guard(obj, path) {
    const cached = proxies.get(obj);
    if (cached) return cached;
    paths.set(obj, path);
    const proxy = new Proxy(obj, {
      get(t, key, receiver) {
        const value = Reflect.get(t, key, receiver);
        if (value !== null && typeof value === 'object' && typeof key === 'string' && isGuardable(value)) {
          return guard(value, path ? `${path}.${key}` : key);
        }
        return value;
      },
      set(t, key, value, receiver) {
        if (depth === 0) throw new StrictWriteError('set', join(path, key));
        return Reflect.set(t, key, value, receiver);
      },
      deleteProperty(t, key) {
        if (depth === 0) throw new StrictWriteError('delete', join(path, key));
        return Reflect.deleteProperty(t, key);
      },
      defineProperty(t, key, desc) {
        if (depth === 0) throw new StrictWriteError('defineProperty', join(path, key));
        return Reflect.defineProperty(t, key, desc);
      },
      setPrototypeOf() {
        throw new StrictWriteError('setPrototypeOf', path);
      },
    });
    proxies.set(obj, proxy);
    return proxy;
  }

  /**
   * Arrays and plain objects are guarded; anything else (typed arrays, class instances that slipped
   * in) is returned as-is so the proxy never changes semantics beyond the write check.
   * @param {object} v
   */
  function isGuardable(v) {
    if (Array.isArray(v)) return true;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  }

  /** @param {string} path @param {string|symbol} key */
  function join(path, key) {
    const k = typeof key === 'symbol' ? key.toString() : key;
    return path ? `${path}.${k}` : k;
  }

  function expose() {
    exposed = strict ? /** @type {World} */ (guard(target, '')) : target;
  }
  expose();

  // --- transactions -----------------------------------------------------------------------------

  /**
   * @template T
   * @param {string} label
   * @param {(world: World) => T} fn
   * @returns {T}
   */
  function tx(label, fn) {
    if (typeof label !== 'string' || label.length === 0) throw new TypeError('store.tx: label must be a non-empty string');
    if (typeof fn !== 'function') throw new TypeError('store.tx: fn must be a function');
    depth++;
    try {
      const result = fn(exposed);
      dirtyFlag = true;
      return result;
    } catch (err) {
      dirtyFlag = true;
      throw err;
    } finally {
      depth--;
      if (depth === 0) bus.emit('tx', { label });
    }
  }

  /**
   * Runs `fn` with the write guard suspended, without marking dirty or emitting `tx`. Internal:
   * used by `snapshot()` so commit hooks may write `world.rng` / `world.clock`.
   * @template T
   * @param {(world: World) => T} fn
   * @returns {T}
   */
  function unguarded(fn) {
    depth++;
    try {
      return fn(target);
    } finally {
      depth--;
    }
  }

  // --- replace / snapshot -----------------------------------------------------------------------

  /** @param {World} next */
  function replace(next) {
    if (next === null || typeof next !== 'object') throw new TypeError('store.replace: world must be an object');
    target = next;
    expose();
    derived.clear();
    dirtyFlag = false;
    bus.emit('world:replaced', { world: exposed });
  }

  /** @returns {World} */
  function snapshot() {
    unguarded((w) => {
      for (const hook of snapshotHooks) hook(w);
    });
    return structuredClone(target);
  }

  /** @param {(world: World) => void} fn */
  function onSnapshot(fn) {
    if (typeof fn !== 'function') throw new TypeError('store.onSnapshot: fn must be a function');
    snapshotHooks.add(fn);
    return () => { snapshotHooks.delete(fn); };
  }

  bus.on('map:enter', () => { derived.clear(); });

  /** @type {Store} */
  const store = {
    get world() { return exposed; },
    bus,
    tx,
    dirty: () => dirtyFlag,
    clean: () => { dirtyFlag = false; },
    inTx: () => depth > 0,
    derived,
    replace,
    snapshot,
    onSnapshot,
    strict,
    raw: () => target,
  };
  return store;
}

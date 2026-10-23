/** SHIM for js/state/persist.js [STATE]. Delete at integration. Signature per ARCHITECTURE-DRAFT §10. */
import { createSaveSystem, createMemoryStorage } from '../../core/save.js';
import { validateWorld } from './schema.js';
import { migrateWorld } from './migrate.js';

/** Bus events that trigger an autosave once the real persist lands. */
export const AUTOSAVE_TRIGGERS = Object.freeze([
  'map:enter', 'waystone:use', 'battle:start:story', 'capture:ok', 'shift:resolved', 'loan:paid', 'letter:read', 'day:start',
]);

/** Route autosave period while dirty and on the overworld (tuning.routeAutosaveMs placeholder). */
export const ROUTE_AUTOSAVE_MS = 60_000;

/**
 * @param {object} w
 * @returns {object} summary stored beside the record
 */
export function summarize(w) {
  return {
    name: w.player?.name ?? '',
    place: w.player?.mapId ?? '',
    day: w.clock?.total != null ? Math.floor(w.clock.total / 1440) : 0,
    time: w.clock?.total != null ? formatTotal(w.clock.total) : '',
    tier: w.loans?.tier ?? 0,
    badges: w.badges?.length ?? 0,
    playMs: w.stats?.playMs ?? 0,
    lead: w.party?.[0]?.nickname ?? null,
  };
}

/** @param {number} total @returns {string} 'HH:MM' */
function formatTotal(total) {
  const m = Math.floor(total % 1440);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * @typedef {Object} Persist
 * @property {(G: any, reason?: string) => object} autosave
 * @property {(G: any, slot: number|string) => object} saveManual
 * @property {(G: any, reason?: string) => object} save  alias of autosave
 * @property {(slot: string) => {ok: boolean, world?: object, error?: object}} load
 * @property {() => object[]} list
 * @property {(slot: string) => void} remove
 * @property {() => object|null} latest
 * @property {(slot: string) => string|null} exportString
 * @property {(str: string) => {ok: boolean, world?: object, error?: object}} importString
 * @property {(G: any, ms: number) => void} tick
 * @property {() => boolean} crashed
 * @property {{arm: () => boolean, clear: () => void, check: () => boolean}} crashMarker
 * @property {import('../../core/save.js').SaveSystem} system
 */

/**
 * @param {{storage?: object|null, prefix: string, version: number, migrations?: object, now?: () => number}} opts
 * @returns {Persist}
 */
export function createPersist(opts) {
  if (!opts || typeof opts.prefix !== 'string') throw new TypeError('createPersist: prefix is required');
  const storage = opts.storage ?? createMemoryStorage();
  const system = createSaveSystem({
    storage,
    prefix: opts.prefix,
    version: opts.version,
    migrations: opts.migrations ?? {},
    summarize,
    now: opts.now,
  });
  system.recover();
  const markerKey = `${opts.prefix}cleanExit`;
  let crashed = false;
  let routeMs = 0;

  function readWorld(result) {
    if (!result.ok) return result;
    const world = migrateWorld(result.data);
    const problems = validateWorld(world);
    if (problems.length) return { ok: false, error: { code: 'INVALID_WORLD', message: problems.join('; ') } };
    return { ok: true, world, slot: result.slot };
  }

  function write(G, kind, slot, reason) {
    if (G.scenes?.isTransitioning) return { ok: false, error: { code: 'BUSY', message: 'save refused during a transition' }, slot: String(slot) };
    G.store.tx('save:prepare', (w) => { G.rngs?.commit?.(w); });
    const world = G.store.snapshot();
    const problems = validateWorld(world);
    if (problems.length) {
      const res = { ok: false, error: { code: 'INVALID_WORLD', message: problems.join('; ') }, slot: String(slot) };
      G.bus.emit('save:fail', { ...res, reason });
      return res;
    }
    const summary = summarize(world);
    const res = kind === 'auto' ? system.autosave(world, { summary }) : system.save(slot, world, { summary });
    const out = { ...res, place: summary.place, time: summary.time, reason };
    if (res.ok) {
      G.store.clean();
      routeMs = 0;
      G.bus.emit('save:ok', out);
    } else {
      G.bus.emit('save:fail', out);
    }
    return out;
  }

  const persist = {
    system,
    autosave: (G, reason = 'auto') => write(G, 'auto', null, reason),
    saveManual: (G, slot) => write(G, 'manual', slot, 'manual'),
    save: (G, reason = 'auto') => write(G, 'auto', null, reason),
    load: (slot) => readWorld(system.load(slot)),
    list: () => system.list(),
    remove: (slot) => { system.remove(slot); },
    latest: () => system.latest(),
    exportString: (slot) => system.exportString(slot),
    importString: (str) => readWorld(system.importString(str)),
    tick(G, ms) {
      if (!G.store.dirty()) { routeMs = 0; return; }
      const top = G.scenes.top();
      if (!top || top.name !== 'overworld' || G.scenes.isTransitioning) return;
      routeMs += ms;
      if (routeMs >= ROUTE_AUTOSAVE_MS) persist.autosave(G, 'route');
    },
    crashed: () => crashed,
    crashMarker: {
      /** Reads the previous session's marker, then marks this session dirty. @returns {boolean} crashed */
      arm() {
        let prev = null;
        try { prev = storage.getItem(markerKey); } catch { prev = null; }
        crashed = prev === '0';
        try { storage.setItem(markerKey, '0'); } catch { /* quota: ignore */ }
        return crashed;
      },
      clear() { try { storage.setItem(markerKey, '1'); } catch { /* ignore */ } },
      check: () => crashed,
    },
  };
  return persist;
}

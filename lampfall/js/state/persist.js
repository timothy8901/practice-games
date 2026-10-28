/**
 * Save / load glue over `core/save` (ARCHITECTURE §10): autosave triggers, the route autosave
 * timer, the crash marker, export / import strings and the menu summary.
 *
 * Every write goes `store.snapshot()` (which runs the snapshot hooks: `rngs.commit`,
 * `clockSys.serializeInto`) -> `validateWorld` (refuse on any problem) -> `core/save` verified
 * write -> `store.clean()`. Loading never writes. Nothing here throws: every public method returns
 * a structured result, and the bus carries `save:ok` / `save:fail`.
 *
 * Pure: the storage is injected (`localStorage` from main.js, a Map in tests); `pagehide` wiring
 * belongs to BOOT, which calls {@link Persist.markBoot} / {@link Persist.markCleanExit}.
 *
 * Lane: STATE.
 * @module state/persist
 */

import { createSaveSystem, createMemoryStorage, ERROR_CODES } from '../core/save.js';
import { SCHEMA_VERSION, validateWorld } from './schema.js';
import { MIGRATIONS, fillDefaults } from './migrate.js';
import { day as dayOf, formatTime, placeLabel, hasChallenge } from './selectors.js';

/** @typedef {import('./schema.js').World} World */
/** @typedef {import('../core/save.js').SaveError} SaveError */
/** @typedef {import('../core/save.js').SlotEntry} SlotEntry */
/** @typedef {import('../core/save.js').StorageLike} StorageLike */
/** @typedef {import('../core/save.js').SaveSystem} SaveSystem */

/**
 * Minimal view of the game context persist reads. Everything beyond `store` is optional so tests
 * and early boot can pass a partial object.
 * @typedef {Object} PersistG
 * @property {import('./store.js').Store} store
 * @property {import('../core/events.js').EventBus} [bus]
 * @property {{top?: () => {name?: string}|null, find?: (name: string) => object|null, has?: (name: string) => boolean, isTransitioning?: boolean|(() => boolean)}} [scenes]
 *   a `core/scene` SceneStack (`find(name)`, `isTransitioning` getter) or a test double that offers
 *   `has(name)` / `isTransitioning()` as functions; see {@link sceneTransitioning} and {@link sceneOnStack}
 * @property {{has: Function}} [data]   registry for id validation
 */

/**
 * Whether the scene stack is mid-transition. Accepts the `core/scene` getter (a boolean) or a function.
 * @param {PersistG['scenes']} scenes
 * @returns {boolean}
 */
export function sceneTransitioning(scenes) {
  if (!scenes) return false;
  const t = scenes.isTransitioning;
  return typeof t === 'function' ? t.call(scenes) === true : t === true;
}

/**
 * Whether a scene with `name` is on the stack. Uses `core/scene`'s `find(name)` when present (its
 * `has` takes a scene object, not a name), else a `has(name)` test double.
 * @param {PersistG['scenes']} scenes
 * @param {string} name
 * @returns {boolean}
 */
export function sceneOnStack(scenes, name) {
  if (!scenes) return false;
  if (typeof scenes.find === 'function') return scenes.find(name) != null;
  return typeof scenes.has === 'function' ? scenes.has(name) === true : false;
}

/**
 * @typedef {Object} SaveResult
 * @property {boolean} ok
 * @property {SaveError} [error]
 * @property {string} slot      slot written (or targeted), `''` when none
 * @property {string} place     map id at save time
 * @property {string} time      `HH:MM` world time at save time
 * @property {number} day       world day at save time
 * @property {string} reason    trigger or caller-supplied reason
 */

/**
 * @typedef {Object} SaveSummary
 * @property {string} name
 * @property {string} place
 * @property {number} day
 * @property {string} time
 * @property {number} tier
 * @property {number} badges
 * @property {number} playMs
 * @property {string|null} lead
 * @property {string} seedCode
 * @property {string} dial
 * @property {number} [autoAnchor]   auto slots: the game minute (day * 1440 + time) the slot was rotated in (FE-16 spacing)
 */

/**
 * @typedef {Object} LoadResult
 * @property {boolean} ok
 * @property {World} [world]
 * @property {SaveError & {problems?: string[]}} [error]
 * @property {string} [slot]
 * @property {{migratedFrom: number|null, time: number|null, version: number|null}} [meta]
 */

/**
 * @typedef {Object} Persist
 * @property {(G: PersistG, reason: string) => SaveResult} autosave      rotates through auto slots (1 slot under No Rewind)
 * @property {(G: PersistG, slot: number|string) => SaveResult} saveManual
 * @property {(slot: string|number) => LoadResult} load                migrates + fillDefaults + validateWorld; never writes
 * @property {(opts?: {all?: boolean, kind?: 'manual'|'auto'}) => SlotEntry[]} list
 * @property {(slot: string|number) => boolean} remove
 * @property {() => SlotEntry|null} latest
 * @property {(slot: string|number) => string|null} exportString
 * @property {(str: string, opts?: {slot?: string|number|null}) => LoadResult & {saved?: SaveResult}} importString
 * @property {(G: PersistG, ms: number) => void} tick                  route timer + failure retry
 * @property {(G: PersistG) => () => void} attach                      subscribes {@link AUTOSAVE_TRIGGERS} on `G.bus`; returns detach
 * @property {() => boolean} crashed                                   last session did not exit cleanly
 * @property {() => boolean} markBoot                                  writes the dirty marker (`cleanExit = 0`)
 * @property {() => boolean} markCleanExit                             writes `cleanExit = 1`
 * @property {{arm: () => boolean, clear: () => boolean, check: () => boolean}} crashMarker
 *   the same three operations grouped as BOOT's `main.js` calls them: `arm()` = markBoot (returns
 *   `crashed()`), `clear()` = markCleanExit, `check()` = crashed
 * @property {() => {failed: boolean, lastError: SaveError|null, retryPending: boolean, lastOk: SaveResult|null}} status
 * @property {(on: boolean) => void} setNoRewind                       rebuild with 1 auto slot and no manual slots
 * @property {() => SaveSystem} system                                 the inner core/save system (debug, tools)
 * @property {string} prefix  @property {number} version
 * @property {(world: World) => SaveSummary} summarize
 */

/**
 * Bus events that trigger an autosave (§10). `battle:start` counts only with a story payload
 * (`{kind: 'story'}` or `{story: true}`), which is what the draft's `battle:start:story` means.
 */
export const AUTOSAVE_TRIGGERS = Object.freeze([
  'map:enter', 'waystone:use', 'battle:start:story', 'capture:ok', 'shift:resolved', 'loan:paid', 'letter:read', 'day:start',
]);

/**
 * Autosaves that come from a bus trigger (or the route timer) wait while a cutscene runs and land
 * when it ends. A save taken mid-script stores the cutscene bookmark at the request that was just
 * answered, so Continue would replay it (a Forecast could Shift the same creature twice, FE-01).
 * Explicit `autosave(G, reason)` calls (a script's `save` op, sleep, the ledger) still write at once.
 */
export const CUTSCENE_DEFERRED_REASONS = Object.freeze(new Set([...AUTOSAVE_TRIGGERS, 'route']));

/**
 * Minimum game-time spacing between rotated autosaves, in game minutes. An autosave closer than this
 * to the newest auto slot (same run) overwrites that slot instead of rotating, so the other two keep
 * an older moment to roll back to (FE-16). `day:start` always rotates.
 */
export const AUTOSAVE_MIN_SPACING_MIN = 120;

/** `map:enter` kinds that are a map being loaded (Continue, a new game), not a walk into it. */
export const LOAD_MAP_ENTER_KINDS = Object.freeze(['load', 'enter']);

/**
 * Absolute game minutes of a save summary (`day * 1440 + HH:MM`), or null.
 * @param {any} summary
 * @returns {number|null}
 */
export function summaryMinutes(summary) {
  if (!summary || !Number.isFinite(summary.day)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(summary.time ?? ''));
  if (!m) return null;
  return summary.day * 1440 + Number(m[1]) * 60 + Number(m[2]);
}

/** Route autosave interval while dirty on the overworld. // [GDD: tuning.routeAutosaveMs] */
export const DEFAULT_ROUTE_AUTOSAVE_MS = 90_000;
/** Delay before the single retry after a failed write. */
export const RETRY_MS = 2_000;
/** Storage key suffix of the crash marker. */
export const CLEAN_EXIT_KEY = 'cleanExit';
/** Challenge id that limits saves to one autosave slot and no manual slots. */
export const NO_REWIND = 'no-rewind';

/** Extra error codes persist adds to core/save's. */
export const PERSIST_ERRORS = Object.freeze({
  /** `validateWorld` reported problems; nothing was written. */
  INVALID_WORLD: 'invalid-world',
  /** A save was requested during a transition or with a battle on the stack. */
  BUSY: 'busy',
  /** `G` has no store. */
  NO_STORE: 'no-store',
  /** Something threw where it should not have; the cause is attached. */
  EXCEPTION: 'exception',
});

/**
 * Menu summary stored in each record's header (`core/save` `summarize` option).
 * @param {World} world
 * @returns {SaveSummary}
 */
export function summarize(world) {
  return {
    name: world?.player?.name ?? '',
    place: placeLabel(world),
    day: dayOf(world),
    time: formatTime(world),
    tier: world?.loans?.tier ?? 1,
    badges: world?.badges?.length ?? 0,
    playMs: world?.stats?.playMs ?? 0,
    lead: world?.party?.[0]?.nickname ?? null,
    seedCode: world?.run?.seedCode ?? '',
    dial: world?.run?.dial ?? '',
  };
}

/**
 * @typedef {Object} PersistOptions
 * @property {StorageLike|Map<string, string>|null} [storage]   `localStorage` in the browser; a Map / memory storage in tests. `null` = in-memory
 * @property {string} prefix                                     e.g. `'GAME.'` // [GDD: title]
 * @property {number} [version]                                  defaults to SCHEMA_VERSION
 * @property {Record<number, Function>} [migrations]             defaults to MIGRATIONS
 * @property {boolean} [noRewind]                                1 auto slot, 0 manual slots
 * @property {number} [routeAutosaveMs]                          defaults to {@link DEFAULT_ROUTE_AUTOSAVE_MS}
 * @property {() => number} [now]                                record clock (inject for tests)
 */

/**
 * Creates the persist layer. Construction reads the crash marker and runs `core/save`'s `.tmp`
 * recovery; it does not write.
 * @param {PersistOptions} opts
 * @returns {Persist}
 * @throws {TypeError} on invalid options (the only place this module throws)
 */
export function createPersist(opts) {
  if (!opts || typeof opts !== 'object') throw new TypeError('createPersist: opts must be an object');
  const {
    prefix,
    version = SCHEMA_VERSION,
    migrations = MIGRATIONS,
    routeAutosaveMs = DEFAULT_ROUTE_AUTOSAVE_MS,
    now = Date.now,
  } = opts;
  if (typeof prefix !== 'string') throw new TypeError('createPersist: prefix must be a string');
  if (!(routeAutosaveMs > 0)) throw new TypeError('createPersist: routeAutosaveMs must be > 0');

  /** @type {StorageLike} */
  const storage = resolveStorage(opts.storage);
  const markerKey = prefix + CLEAN_EXIT_KEY;
  const sawDirtyMarker = readMarker() === '0';

  let noRewind = opts.noRewind === true;
  /** @type {SaveSystem} */
  let sys = build();

  /** @type {SaveError|null} */
  let lastError = null;
  /** @type {SaveResult|null} */
  let lastOk = null;
  /** @type {{kind: 'auto'|'manual', slot: string|number|null, reason: string, ms: number}|null} */
  let retry = null;
  let pendingAuto = null;
  let routeAcc = 0;

  function build() {
    return createSaveSystem({
      storage,
      prefix,
      version,
      migrations,
      summarize,
      now,
      autosaveSlots: noRewind ? 1 : 3,
      manualSlots: noRewind ? 0 : 3,
    });
  }

  // --- crash marker -----------------------------------------------------------------------------

  /** @returns {string|null} */
  function readMarker() {
    try {
      const v = storage.getItem(markerKey);
      return v === undefined ? null : v;
    } catch {
      return null;
    }
  }

  /** @param {string} v */
  function writeMarker(v) {
    try {
      storage.setItem(markerKey, v);
      return true;
    } catch {
      return false;
    }
  }

  // --- writing ----------------------------------------------------------------------------------

  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, any>} [extra]
   * @returns {SaveError}
   */
  const err = (code, message, extra) => ({ code, message, ...extra });

  /**
   * @param {PersistG} G
   * @param {'auto'|'manual'} kind
   * @param {string|number|null} slot
   * @param {string} reason
   * @param {boolean} isRetry
   * @returns {SaveResult}
   */
  function write(G, kind, slot, reason, isRetry) {
    /** @type {SaveResult} */
    const base = { ok: false, slot: typeof slot === 'string' ? slot : '', place: '', time: '', day: 0, reason };
    try {
      if (!G || !G.store || typeof G.store.snapshot !== 'function') {
        return fail(G, { ...base, error: err(PERSIST_ERRORS.NO_STORE, 'no store to save') }, kind, slot, isRetry);
      }
      const scenes = G.scenes;
      if (kind === 'auto' && (sceneTransitioning(scenes) || sceneOnStack(scenes, 'battle')
        || (CUTSCENE_DEFERRED_REASONS.has(reason) && cutsceneRunning(G)))) {
        // A story checkpoint can arrive after its battle/transition was pushed. Keep it pending;
        // this is a scheduling constraint, not a failed storage write.
        // a held day:start keeps its place (it always rotates); a later trigger does not clobber it
        if (pendingAuto !== 'day:start') pendingAuto = reason;
        return { ...base, error: err(PERSIST_ERRORS.BUSY, 'autosave queued until the scene is ready'), deferred: true };
      }
      if (sceneTransitioning(scenes)) {
        return fail(G, { ...base, error: err(PERSIST_ERRORS.BUSY, 'cannot save during a transition') }, kind, slot, isRetry);
      }
      if (sceneOnStack(scenes, 'battle')) {
        return fail(G, { ...base, error: err(PERSIST_ERRORS.BUSY, 'cannot save while a battle is on the stack') }, kind, slot, isRetry);
      }
      const world = G.store.snapshot();
      base.place = placeLabel(world);
      base.time = formatTime(world);
      base.day = dayOf(world);
      const problems = validateWorld(world, G.data ?? null);
      if (problems.length) {
        return fail(G, { ...base, error: err(PERSIST_ERRORS.INVALID_WORLD, `refusing to save an invalid world: ${problems[0]}`, { problems }) }, kind, slot, isRetry);
      }
      const summary = summarize(world);
      const near = kind === 'auto' ? nearAutoSlot(summary, reason) : null;
      // the game minute this auto slot was rotated in: an overwrite keeps it, so the spacing is
      // measured from the rotation, not from the last overwrite (a save every 30 game minutes would
      // otherwise never rotate)
      if (kind === 'auto') summary.autoAnchor = near ? near.anchor : summaryMinutes(summary);
      const res = kind === 'auto'
        ? (near ? sys.save(near.slot, world, { summary }) : sys.autosave(world, { summary }))
        : sys.save(/** @type {any} */ (slot), world, { summary });
      if (!res.ok) return fail(G, { ...base, slot: res.error.slot ?? base.slot, error: res.error }, kind, slot, isRetry);
      G.store.clean?.();
      routeAcc = 0;
      retry = null;
      pendingAuto = null;
      lastError = null;
      const ok = { ...base, ok: true, slot: res.slot };
      lastOk = ok;
      G.bus?.emit?.('save:ok', { slot: res.slot, kind, reason, time: res.time });
      return ok;
    } catch (cause) {
      return fail(G, { ...base, error: err(PERSIST_ERRORS.EXCEPTION, `save threw: ${cause?.message ?? String(cause)}`, { cause }) }, kind, slot, isRetry);
    }
  }

  /**
   * Whether a cutscene is running: the scene is on the stack. (The world's bookmark alone is not
   * enough: it is also set between a load and the resume, and a stale one must never stop saving.)
   * @param {PersistG} G
   * @returns {boolean}
   */
  function cutsceneRunning(G) {
    return sceneOnStack(G?.scenes, 'cutscene');
  }

  /**
   * The auto slot to overwrite instead of rotating: the newest readable auto slot of the same run
   * when it was rotated in less than {@link AUTOSAVE_MIN_SPACING_MIN} game minutes ago (its
   * summary's `autoAnchor`, else its own time). Null = rotate.
   * @param {SaveSummary} summary
   * @param {string} reason
   * @returns {{slot: string, anchor: number}|null}
   */
  function nearAutoSlot(summary, reason) {
    if (reason === 'day:start') return null;
    try {
      const autos = sys.list({ kind: 'auto' });
      if (autos.length < 2) return null;
      const newest = autos.reduce((a, b) => ((b.seq ?? 0) > (a.seq ?? 0) ? b : a));
      if (!newest?.summary || newest.summary.seedCode !== summary.seedCode) return null;
      const then = summaryMinutes(newest.summary);
      const nowMin = summaryMinutes(summary);
      if (then === null || nowMin === null || nowMin < then) return null;
      const a = typeof newest.summary.autoAnchor === 'number' ? newest.summary.autoAnchor : NaN;
      const anchor = Number.isFinite(a) && a <= then ? a : then;
      return nowMin - anchor < AUTOSAVE_MIN_SPACING_MIN ? { slot: newest.slot, anchor } : null;
    } catch {
      return null;
    }
  }

  /**
   * @param {PersistG} G
   * @param {SaveResult} result
   * @param {'auto'|'manual'} kind
   * @param {string|number|null} slot
   * @param {boolean} isRetry
   * @returns {SaveResult}
   */
  function fail(G, result, kind, slot, isRetry) {
    lastError = result.error ?? null;
    const code = result.error?.code;
    const retryable = code !== PERSIST_ERRORS.INVALID_WORLD && code !== ERROR_CODES.INVALID_SLOT && code !== PERSIST_ERRORS.NO_STORE;
    retry = !isRetry && retryable ? { kind, slot, reason: result.reason, ms: RETRY_MS } : null;
    try {
      G?.bus?.emit?.('save:fail', { error: result.error, kind, reason: result.reason, willRetry: retry !== null });
    } catch {
      // a throwing listener must not turn a save failure into a crash
    }
    return result;
  }

  // --- reading ----------------------------------------------------------------------------------

  /**
   * Shared tail of load / import: fill defaults, validate.
   * @param {object} data
   * @param {string|undefined} slot
   * @param {{migratedFrom: number|null, time: number|null, version: number|null}} meta
   * @returns {LoadResult}
   */
  function finishRead(data, slot, meta) {
    const world = fillDefaults(data);
    world.v = version;
    const problems = validateWorld(world);
    if (problems.length) {
      return { ok: false, slot, error: err(PERSIST_ERRORS.INVALID_WORLD, `save is not a valid world: ${problems[0]}`, { slot, problems }) };
    }
    return { ok: true, world, slot, meta };
  }

  /** @param {string|number} slot @returns {LoadResult} */
  function load(slot) {
    try {
      const res = sys.load(slot);
      if (!res.ok) return { ok: false, slot: res.error.slot, error: res.error };
      return finishRead(res.data, res.slot, { migratedFrom: res.meta.migratedFrom, time: res.meta.time, version: res.meta.version });
    } catch (cause) {
      return { ok: false, error: err(PERSIST_ERRORS.EXCEPTION, `load threw: ${cause?.message ?? String(cause)}`, { cause }) };
    }
  }

  /**
   * @param {string} text
   * @param {{slot?: string|number|null}} [o]
   * @returns {LoadResult & {saved?: SaveResult}}
   */
  function importString(text, o = {}) {
    try {
      const res = sys.importString(text);
      if (!res.ok) return { ok: false, error: res.error };
      const read = finishRead(res.data, undefined, { migratedFrom: res.meta.migratedFrom, time: res.meta.time, version: res.meta.version });
      if (!read.ok || o.slot === undefined || o.slot === null) return read;
      const saved = sys.save(o.slot, read.world, { summary: summarize(read.world) });
      if (!saved.ok) return { ...read, ok: false, error: saved.error };
      return { ...read, slot: saved.slot, saved: { ok: true, slot: saved.slot, place: read.world.player.mapId, time: formatTime(read.world), day: dayOf(read.world), reason: 'import' } };
    } catch (cause) {
      return { ok: false, error: err(PERSIST_ERRORS.EXCEPTION, `import threw: ${cause?.message ?? String(cause)}`, { cause }) };
    }
  }

  // --- timers and triggers ----------------------------------------------------------------------

  /**
   * @param {PersistG} G
   * @param {number} ms
   */
  function tick(G, ms) {
    try {
      if (!(ms > 0) || !G?.store) return;
      if (pendingAuto !== null && !sceneTransitioning(G.scenes) && !sceneOnStack(G.scenes, 'battle')
        && !(CUTSCENE_DEFERRED_REASONS.has(pendingAuto) && cutsceneRunning(G))) {
        const reason = pendingAuto;
        pendingAuto = null;
        write(G, 'auto', null, reason, false);
      }
      if (retry) {
        retry.ms -= ms;
        if (retry.ms <= 0) {
          const r = retry;
          retry = null;
          write(G, r.kind, r.slot, r.reason, true);
        }
      }
      const topName = G.scenes?.top?.()?.name;
      const eligible = G.store.dirty?.() === true
        && topName === 'overworld'
        && !G.store.world?.cutscene
        && !sceneTransitioning(G.scenes);
      if (!eligible) return;
      routeAcc += ms;
      if (routeAcc >= routeAutosaveMs) {
        routeAcc = 0;
        write(G, 'auto', null, 'route', false);
      }
    } catch {
      // the main loop must never die because of persistence
    }
  }

  /**
   * @param {PersistG} G
   * @returns {() => void}
   */
  function attach(G) {
    const bus = G?.bus ?? G?.store?.bus;
    if (!bus || typeof bus.on !== 'function') return () => {};
    /** @type {Array<() => void>} */
    const offs = [];
    for (const trigger of AUTOSAVE_TRIGGERS) {
      if (trigger === 'battle:start:story') {
        offs.push(bus.on('battle:start', (payload) => {
          if (payload && (payload.kind === 'story' || payload.story === true)) write(G, 'auto', null, trigger, false);
        }));
      } else if (trigger === 'map:enter') {
        // a map loaded on Continue / new game is not a walk into it: the slot just loaded already
        // holds this moment, and saving it again collapsed the three autosaves into copies (FE-16)
        offs.push(bus.on(trigger, (payload) => {
          if (payload && LOAD_MAP_ENTER_KINDS.includes(payload.kind)) return;
          write(G, 'auto', null, trigger, false);
        }));
      } else {
        offs.push(bus.on(trigger, () => { write(G, 'auto', null, trigger, false); }));
      }
    }
    return () => { for (const off of offs) off(); };
  }

  return {
    autosave: (G, reason = 'manual') => write(G, 'auto', null, String(reason), false),
    saveManual: (G, slot) => write(G, 'manual', slot, 'manual', false),
    load,
    list: (o) => { try { return sys.list(o); } catch { return []; } },
    remove: (slot) => { try { return sys.remove(slot).ok; } catch { return false; } },
    latest: () => { try { return sys.latest(); } catch { return null; } },
    exportString: (slot) => { try { return sys.exportString(slot); } catch { return null; } },
    importString,
    tick,
    attach,
    crashed: () => sawDirtyMarker,
    markBoot: () => writeMarker('0'),
    markCleanExit: () => writeMarker('1'),
    crashMarker: Object.freeze({
      arm: () => { writeMarker('0'); return sawDirtyMarker; },
      clear: () => writeMarker('1'),
      check: () => sawDirtyMarker,
    }),
    status: () => ({ failed: lastError !== null, lastError, retryPending: retry !== null || pendingAuto !== null, lastOk }),
    setNoRewind(on) {
      const next = on === true;
      if (next === noRewind) return;
      noRewind = next;
      sys = build();
    },
    system: () => sys,
    prefix,
    version,
    summarize,
  };
}

/**
 * Whether the world's run demands No Rewind slots (for `setNoRewind` after a new game / load).
 * @param {World} world
 * @returns {boolean}
 */
export function wantsNoRewind(world) {
  return hasChallenge(world, NO_REWIND);
}

/**
 * @param {unknown} option
 * @returns {StorageLike}
 */
function resolveStorage(option) {
  if (option instanceof Map) {
    const map = option;
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); },
    };
  }
  if (option && typeof option === 'object' && typeof option.getItem === 'function' && typeof option.setItem === 'function' && typeof option.removeItem === 'function') {
    return /** @type {StorageLike} */ (option);
  }
  return createMemoryStorage();
}

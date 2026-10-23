/**
 * @module core/events
 *
 * A tiny, deterministic, synchronous event bus. Pure: it never touches `document`, `window` or any
 * global, so it can be imported and unit-tested under Node.
 *
 * Dispatch rules (fixed, so game systems built on the bus replay identically):
 *  - Listeners run synchronously, in registration order, and receive the emitted arguments by
 *    reference. The same function may be registered more than once and then fires once per
 *    registration.
 *  - The listener list is snapshotted when `emit()` starts. A listener registered during an emit
 *    does not fire for that emit; a listener removed during an emit (via `off`, its unsubscribe
 *    function or `clear`) does not fire if it has not run yet.
 *  - `once` listeners are detached *before* they run, so re-entrant emits can never fire them twice.
 *  - Wildcard listeners (`on('*', fn)`) receive `(evt, ...args)` for every event, after that event's
 *    own listeners. `'*'` itself cannot be emitted.
 *  - If a listener throws, the error propagates out of `emit()` and the remaining listeners are
 *    skipped, unless the bus was created with an `onError` handler; then the error is handed to it
 *    and dispatch continues. Either way the bus stays in a consistent state.
 *  - Emits may nest (a listener may emit), but at most `maxDepth` emits can be in flight at once
 *    (default {@link DEFAULT_MAX_DEPTH}). Going deeper means a listener feedback loop: the bus then
 *    throws a `RangeError` (name `'EmitDepthError'`) that is never handed to `onError` and that
 *    unwinds every emit in flight, so a loop fails fast with a readable error instead of a native
 *    stack overflow or, with `onError`, a frozen game. Until the outermost emit has unwound, every
 *    further `emit` on that bus throws the same error, even if a listener swallowed the first one.
 *  - Listeners are expected to be synchronous. A returned promise is ignored and its rejection is
 *    not routed to `onError`.
 */

/**
 * Reserved event name for wildcard listeners, which observe every emitted event.
 * @type {'*'}
 */
export const WILDCARD = '*';

/**
 * Default for {@link BusOptions} `maxDepth`: how many emits may be in flight at once on one bus.
 * Generous for any legitimate chain of game events, yet small enough that the guard always trips
 * long before the JavaScript call stack would.
 * @type {128}
 */
export const DEFAULT_MAX_DEPTH = 128;

/**
 * A listener for a specific event.
 * @callback Listener
 * @param {...any} args The arguments passed to `emit`, by reference.
 * @returns {void}
 */

/**
 * A listener registered on {@link WILDCARD}.
 * @callback WildcardListener
 * @param {string} evt The name of the event being emitted.
 * @param {...any} args The arguments passed to `emit`, by reference.
 * @returns {void}
 */

/**
 * Removes the registration it was returned for. Safe to call repeatedly.
 * @callback Unsubscribe
 * @returns {boolean} `true` if the listener was still registered and has now been removed.
 */

/**
 * Receives errors thrown by listeners when the bus was created with `onError`.
 * @callback ErrorHandler
 * @param {unknown} error Whatever the listener threw.
 * @param {string} evt The event whose dispatch triggered the error.
 * @param {any[]} args The arguments that were passed to `emit`.
 * @returns {void}
 */

/**
 * @typedef {Object} EventBus
 * @property {(evt: string, fn: Listener|WildcardListener) => Unsubscribe} on
 *   Registers `fn` for `evt` and returns a function that removes exactly that registration.
 * @property {(evt: string, fn: Listener|WildcardListener) => Unsubscribe} once
 *   Like `on`, but the listener is detached right before its first (and only) invocation.
 * @property {(evt: string, fn?: Function) => number} off
 *   Removes every registration of `fn` for `evt`, or every listener of `evt` when `fn` is omitted.
 *   Returns how many registrations were removed.
 * @property {(evt: string, ...args: any[]) => number} emit
 *   Synchronously calls the listeners of `evt`, then the wildcard listeners. Returns the number of
 *   listeners invoked (wildcards included). Throws a `RangeError` when emits nest deeper than
 *   `maxDepth` (see the module notes).
 * @property {() => number} clear
 *   Removes every listener of every event. Returns how many registrations were removed.
 * @property {(evt: string) => number} listenerCount
 *   Number of live registrations for `evt` (pass `'*'` for the wildcard listeners).
 * @property {() => string[]} eventNames
 *   Names that currently have at least one listener, including `'*'` when wildcards are registered.
 */

/**
 * @typedef {Object} BusOptions
 * @property {ErrorHandler|null} [onError] When given, listener exceptions are routed here instead
 *   of aborting the emit. `null` means "no handler", like omitting it.
 * @property {number} [maxDepth] Maximum number of emits in flight at once on this bus (a positive
 *   integer; `1` forbids nesting entirely). Defaults to {@link DEFAULT_MAX_DEPTH}. Keep it well
 *   below the engine's call-stack limit so that the guard, not the engine, reports a feedback loop.
 */

/**
 * One registration. `active` is the single source of truth: snapshots taken by `emit` check it so
 * that a listener removed mid-dispatch is skipped. Invariant: an active entry is always present in
 * the live list for its event.
 * @typedef {Object} Entry
 * @property {string} evt
 * @property {Function} fn
 * @property {boolean} once
 * @property {boolean} active
 */

/**
 * Thrown by `emit` when more than `maxDepth` emits are in flight. Module-private on purpose:
 * `dispatch` must recognise it so that it is re-thrown instead of handed to `onError`. If it were
 * treated as an ordinary listener error, every level of the loop would resume dispatch and re-enter
 * the loop, which is exponential work and in practice never finishes.
 */
class EmitDepthError extends RangeError {
  /**
   * @param {string} evt The event whose emit exceeded the limit.
   * @param {number} maxDepth The limit of the bus that tripped.
   */
  constructor(evt, maxDepth) {
    super(
      `events.emit: more than maxDepth (${maxDepth}) emits in flight while emitting ${JSON.stringify(evt)}; ` +
        'a listener is probably re-emitting the event it handles',
    );
    this.name = 'EmitDepthError';
  }
}

/**
 * Human-friendly description of a value for error messages.
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
    case 'boolean':
      return String(value);
    default:
      return typeof value;
  }
}

/**
 * Throws unless `evt` is a usable event name.
 * @param {unknown} evt
 * @param {string} method Name of the calling method, for the error message.
 * @returns {asserts evt is string}
 */
function assertName(evt, method) {
  if (typeof evt !== 'string' || evt.length === 0) {
    throw new TypeError(`events.${method}: event name must be a non-empty string, got ${describe(evt)}`);
  }
}

/**
 * Throws unless `fn` is callable.
 * @param {unknown} fn
 * @param {string} method Name of the calling method, for the error message.
 * @returns {asserts fn is Function}
 */
function assertListener(fn, method) {
  if (typeof fn !== 'function') {
    throw new TypeError(`events.${method}: listener must be a function, got ${describe(fn)}`);
  }
}

/**
 * Validates and normalises {@link BusOptions}.
 * @param {BusOptions|null|undefined} options
 * @returns {{ onError: ErrorHandler|undefined, maxDepth: number }}
 */
function readOptions(options) {
  const onError = options?.onError ?? undefined;
  if (onError !== undefined && typeof onError !== 'function') {
    throw new TypeError(`events.createBus: onError must be a function, got ${describe(onError)}`);
  }
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new TypeError(`events.createBus: maxDepth must be a positive integer, got ${describe(maxDepth)}`);
  }
  return { onError, maxDepth };
}

/**
 * Creates an independent event bus.
 *
 * @param {BusOptions} [options]
 * @returns {EventBus} A frozen object; its methods are plain functions that may be detached
 *   (`const { on, emit } = createBus()`).
 * @throws {TypeError} If `options.onError` is neither a function nor `null`/`undefined`, or if
 *   `options.maxDepth` is not a positive integer.
 *
 * @example
 * const bus = createBus();
 * const off = bus.on('coin', (amount) => purse.add(amount));
 * bus.emit('coin', 5);
 * off();
 */
export function createBus(options) {
  const { onError, maxDepth } = readOptions(options);

  /** Live registrations per event name, in registration order. @type {Map<string, Entry[]>} */
  const lists = new Map();
  /** Number of emits currently in flight on this bus. */
  let depth = 0;
  /** Set once the depth guard trips; cleared when the outermost emit has unwound. */
  let tripped = false;

  /**
   * Registers an entry and returns its unsubscribe function.
   * @param {string} evt
   * @param {Function} fn
   * @param {boolean} once
   * @param {string} method
   * @returns {Unsubscribe}
   */
  function add(evt, fn, once, method) {
    assertName(evt, method);
    assertListener(fn, method);
    /** @type {Entry} */
    const entry = { evt, fn, once, active: true };
    let list = lists.get(evt);
    if (!list) {
      list = [];
      lists.set(evt, list);
    }
    list.push(entry);
    return () => remove(entry);
  }

  /**
   * Detaches a single entry from its live list.
   * @param {Entry} entry
   * @returns {boolean} `false` if the entry had already been removed.
   */
  function remove(entry) {
    if (!entry.active) return false;
    entry.active = false;
    const list = /** @type {Entry[]} */ (lists.get(entry.evt));
    list.splice(list.indexOf(entry), 1);
    if (list.length === 0) lists.delete(entry.evt);
    return true;
  }

  /**
   * Marks every entry of a list inactive. The caller is responsible for dropping the list itself.
   * @param {Entry[]} list
   * @returns {number} How many entries were deactivated.
   */
  function deactivate(list) {
    for (const entry of list) entry.active = false;
    return list.length;
  }

  /**
   * Invokes the still-active entries of a snapshot.
   * @param {Entry[]} snapshot Copy of a live list, taken before any listener ran.
   * @param {string} evt Event being emitted (for `onError`).
   * @param {any[]} args Original emit arguments (for `onError`).
   * @param {any[]} callArgs Arguments actually passed to each listener.
   * @returns {number} How many listeners were invoked.
   */
  function dispatch(snapshot, evt, args, callArgs) {
    let invoked = 0;
    for (const entry of snapshot) {
      if (!entry.active) continue;
      if (entry.once) remove(entry);
      invoked++;
      if (onError) {
        try {
          entry.fn(...callArgs);
        } catch (error) {
          // A tripped depth guard (on this or any nested bus) must unwind the whole cascade.
          if (error instanceof EmitDepthError) throw error;
          onError(error, evt, args);
        }
      } else {
        entry.fn(...callArgs);
      }
    }
    return invoked;
  }

  /** @type {EventBus['on']} */
  function on(evt, fn) {
    return add(evt, fn, false, 'on');
  }

  /** @type {EventBus['once']} */
  function once(evt, fn) {
    return add(evt, fn, true, 'once');
  }

  /** @type {EventBus['off']} */
  function off(evt, fn) {
    assertName(evt, 'off');
    if (fn !== undefined) assertListener(fn, 'off');
    const list = lists.get(evt);
    if (!list) return 0;
    if (fn === undefined) {
      lists.delete(evt);
      return deactivate(list);
    }
    const victims = list.filter((entry) => entry.fn === fn);
    for (const entry of victims) remove(entry);
    return victims.length;
  }

  /** @type {EventBus['emit']} */
  function emit(evt, ...args) {
    assertName(evt, 'emit');
    if (evt === WILDCARD) {
      throw new TypeError(`events.emit: '${WILDCARD}' is reserved for wildcard listeners and cannot be emitted`);
    }
    if (tripped || depth >= maxDepth) {
      tripped = true;
      throw new EmitDepthError(evt, maxDepth);
    }
    depth++;
    try {
      // Both snapshots are taken before any listener runs, so a listener that registers new
      // listeners (specific or wildcard) never affects the emit that is already in flight.
      const specific = lists.get(evt);
      const wild = lists.get(WILDCARD);
      const specificSnapshot = specific ? specific.slice() : null;
      const wildSnapshot = wild ? wild.slice() : null;
      let invoked = 0;
      if (specificSnapshot) invoked += dispatch(specificSnapshot, evt, args, args);
      if (wildSnapshot) invoked += dispatch(wildSnapshot, evt, args, [evt, ...args]);
      return invoked;
    } finally {
      depth--;
      if (depth === 0) tripped = false;
    }
  }

  /** @type {EventBus['clear']} */
  function clear() {
    let removed = 0;
    for (const list of lists.values()) removed += deactivate(list);
    lists.clear();
    return removed;
  }

  /** @type {EventBus['listenerCount']} */
  function listenerCount(evt) {
    assertName(evt, 'listenerCount');
    const list = lists.get(evt);
    return list ? list.length : 0;
  }

  /** @type {EventBus['eventNames']} */
  function eventNames() {
    return [...lists.keys()];
  }

  return Object.freeze({ on, once, off, emit, clear, listenerCount, eventNames });
}

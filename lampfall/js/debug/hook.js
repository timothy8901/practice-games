/**
 * `window.__game` debug and test hook. [BOOT] (day 1) — ARCHITECTURE-DRAFT §11.
 *
 * Installed only with `?debug=1` or on localhost. Every mutating hook goes through `store.tx`, so
 * events and autosave behave as in play. `press()`/`tap()` synthesize real `KeyboardEvent`s on the
 * window (keyboard tokens are `KeyboardEvent.code`), `idle()` resolves when no transition, tween or
 * busy scene is running, and `errors` collects `window.onerror` + `unhandledrejection`.
 *
 * Hooks whose system lives in another lane are REBINDABLE: the owning module registers the real
 * implementation with `__game.bind(name, fn)` (or `G.debugHook.bind`). Until then `give` and `earn`
 * run a day-1 fallback that edits the schema shape directly inside `store.tx`, and the others throw a
 * readable "not wired" error.
 * @module debug/hook
 */
import { tokenDevice } from '../core/input.js';
import { validateWorld } from '../state/schema.js';
import * as clockSys from '../systems/clockSys.js';
import { setFlag } from '../systems/flags.js';
import * as wallet from '../systems/wallet.js';

/** Hooks that belong to another lane, with the lane that owns the real implementation. */
export const LANE_HOOKS = Object.freeze({
  give: 'RULES-ECON', earn: 'RULES-ECON', addCreature: 'RULES-CREATURE', heal: 'RULES-CREATURE',
  battle: 'FLOW', wild: 'FLOW', forceForecast: 'RULES-SHIFT', deliverLetter: 'SYS-TOWN',
  sleep: 'FLOW', runScript: 'SCRIPT',
});

/** Pocket the day-1 `give` fallback drops items into (`systems/bag` resolves the real pocket from item data). */
export const FALLBACK_POCKET = 'items';

/**
 * Primary keyboard token for an action.
 * @param {Record<string, string[]>} bindings  `input.bindings()`
 * @param {string} action
 * @returns {string|null} a `KeyboardEvent.code`, or null when the action has no keyboard token
 */
export function primaryKeyboardToken(bindings, action) {
  const tokens = bindings && bindings[action];
  if (!Array.isArray(tokens)) return null;
  return tokens.find((t) => tokenDevice(t) === 'keyboard') ?? null;
}

const KEY_FOR_CODE = Object.freeze({
  Space: ' ', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Tab: 'Tab',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', AltLeft: 'Alt',
  BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/',
});

/**
 * `KeyboardEventInit` for a code so synthesized events look like real ones.
 * @param {string} code
 * @returns {{code: string, key: string, bubbles: boolean, cancelable: boolean}}
 */
export function keyInitFor(code) {
  let key = KEY_FOR_CODE[code];
  if (!key) {
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3).toLowerCase();
    else if (/^Digit\d$/.test(code)) key = code.slice(5);
    else key = code;
  }
  return { code, key, bubbles: true, cancelable: true };
}

/**
 * Day-1 `give`: adds `n` of an item to the fallback pocket (merging into an existing stack).
 * Pure on the world; the hook wraps it in `store.tx`.
 * @param {object} world
 * @param {string} itemId
 * @param {number} n
 * @returns {number} stack size after the gift
 */
export function fallbackGive(world, itemId, n) {
  if (typeof itemId !== 'string' || !itemId) throw new TypeError('__game.give: itemId must be a non-empty string');
  const count = Math.max(1, Math.floor(Number(n) || 1));
  const pockets = world.bag.pockets;
  if (!Array.isArray(pockets[FALLBACK_POCKET])) pockets[FALLBACK_POCKET] = [];
  const pocket = pockets[FALLBACK_POCKET];
  const stack = pocket.find((s) => s.id === itemId);
  if (stack) { stack.n += count; return stack.n; }
  pocket.push({ id: itemId, n: count });
  return count;
}

/**
 * `earn`: adds to the main wallet through `systems/wallet.adjust` (negative amounts spend; the
 * balance never drops below 0).
 * @param {object} world
 * @param {number} amount
 * @returns {number} new balance
 */
export function fallbackEarn(world, amount) {
  const delta = Math.trunc(Number(amount));
  if (!Number.isFinite(delta)) throw new TypeError('__game.earn: amount must be a finite number');
  return wallet.adjust(/** @type {any} */ (world), delta).balance;
}

/**
 * @param {string} name
 * @returns {Error}
 */
function notWired(name) {
  return new Error(`__game.${name}: not wired yet (owner: ${LANE_HOOKS[name] ?? 'unknown'}); call __game.bind('${name}', fn) from the owning module`);
}

/**
 * @typedef {Object} DebugHook
 * @property {object} G
 * @property {object} world                                      live (not a copy)
 * @property {() => object} state                                structuredClone of the raw world
 * @property {(mapId: string, x: number, y: number) => void} warp
 * @property {(itemId: string, n?: number) => void} give
 * @property {(amount: number) => void} earn
 * @property {(hour: number, minute?: number) => void} setTime
 * @property {(x: number|null) => void} setTide                  core/time.freezeTide
 * @property {(speciesId: string, level: number, opts?: object) => object} addCreature
 * @property {() => void} heal
 * @property {(trainerId: string) => Promise<object>} battle
 * @property {(speciesId: string, level: number) => Promise<object>} wild
 * @property {(uid?: string) => Promise<string>} forceForecast
 * @property {(id: string, value?: any) => void} flag
 * @property {() => object} flags
 * @property {(n: number) => void} deliverLetter
 * @property {() => void} sleep
 * @property {(scriptId: string) => Promise<void>} runScript
 * @property {(mult: number) => void} speed
 * @property {(on: boolean) => void} skipAnims
 * @property {(action: string, frames?: number) => Promise<void>} press   dispatches KeyboardEvent(code) for the action's primary keyboard token
 * @property {(action: string) => Promise<void>} tap
 * @property {() => Promise<void>} idle                          resolves when no transition, tween or busy scene is running
 * @property {() => string} scene
 * @property {() => string[]} stack
 * @property {() => string} text                                 visible dialogue/menu text for assertions
 * @property {(label: string) => import('../core/rng.js').Rng} rng
 * @property {() => string[]} validate
 * @property {(name: string) => void} marker                     1-frame label in the corner + console `MARK name`
 * @property {Array<{message: string, stack: string}>} errors    window.onerror + unhandledrejection
 * @property {() => object} perf
 * @property {(reason?: string) => object} save
 * @property {(slot: string) => boolean} load
 * @property {(n: number) => void} step
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {(name: string, fn: Function) => void} bind         register a lane-owned hook implementation
 * @property {(name: string) => boolean} isBound                 whether a lane has replaced the default for `name`
 * @property {(name: string, params?: any) => void} push         push a scene by name (visual work)
 * @property {() => void} uninstall
 */

/**
 * @param {object} G  the game context from main.js
 * @param {{target?: EventTarget & {requestAnimationFrame?: Function}, expose?: boolean}} [opts]
 *   `target` defaults to `window`; `expose` (default true) assigns `window.__game`
 * @returns {DebugHook}
 */
export function installDebugHook(G, opts = {}) {
  const target = opts.target ?? globalThis.window;
  if (!target || typeof target.addEventListener !== 'function') {
    throw new TypeError('installDebugHook: needs a window-like EventTarget');
  }
  const raf = typeof target.requestAnimationFrame === 'function'
    ? target.requestAnimationFrame.bind(target)
    : (fn) => setTimeout(() => fn(performance.now()), 16);
  const nextFrame = () => new Promise((resolve) => raf(() => resolve()));
  /** The unproxied world (strict mode wraps `store.world` in a Proxy that structuredClone rejects). */
  const rawWorld = () => (typeof G.store.raw === 'function' ? G.store.raw() : G.world);

  /** @type {Array<{message: string, stack: string}>} */
  const errors = [];
  const onError = (e) => {
    const err = e && (e.error ?? e.reason ?? e);
    errors.push({
      message: String((err && err.message) ?? e?.message ?? err),
      stack: String((err && err.stack) ?? ''),
    });
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onError);

  /** @type {Record<string, Function>} lane-bound implementations */
  const bound = Object.create(null);
  /** Day-1 fallbacks for lane hooks; replaced by `bind`. */
  const fallbacks = Object.freeze({
    give(itemId, n = 1) {
      const total = G.store.tx('debug:give', (w) => fallbackGive(w, itemId, n));
      G.bus.emit('bag:changed', { itemId, n: total, pocket: FALLBACK_POCKET, source: 'debug' });
      return total;
    },
    earn(amount) {
      const balance = G.store.tx('debug:earn', (w) => fallbackEarn(w, amount));
      G.bus.emit('wallet:changed', { main: balance, delta: Math.trunc(Number(amount)), source: 'debug' });
      return balance;
    },
  });

  function isIdle() {
    if (G.loop && G.loop.paused) return true;
    if (G.scenes.isTransitioning) return false;
    if (G.tweens && G.tweens.count > 0) return false;
    return !G.scenes.stack.some((s) => typeof s.isBusy === 'function' && s.isBusy());
  }

  const hook = {
    G,
    get world() { return G.world; },
    state: () => structuredClone(rawWorld()),
    errors,

    warp(mapId, x, y) {
      G.store.tx('debug:warp', (w) => { w.player.mapId = mapId; w.player.x = Math.round(x); w.player.y = Math.round(y); });
      G.bus.emit('debug:warp', { mapId, x, y });
    },
    setTime(hour, minute = 0) {
      G.store.tx('debug:setTime', (w) => clockSys.setTime(w, G.clock, hour * 60 + minute));
    },
    setTide(x) {
      if (typeof G.clock.freezeTide !== 'function') throw new Error('__game.setTide: core/time.freezeTide is not available yet (owner: CORE, draft §13.6)');
      G.clock.freezeTide(x);
    },
    flag(id, value = true) { G.store.tx('debug:flag', (w) => setFlag(w, id, value, { bus: G.bus })); },
    flags: () => ({ ...G.world.flags }),
    speed(mult) { G.speed = Math.min(64, Math.max(0.25, Number(mult) || 1)); },
    skipAnims(on) { G.flags.noanim = Boolean(on); },

    async press(action, frames = 1) {
      const code = primaryKeyboardToken(G.input.bindings(), action);
      if (!code) throw new Error(`__game.press: action '${action}' has no keyboard binding`);
      const init = keyInitFor(code);
      target.dispatchEvent(new KeyboardEvent('keydown', init));
      for (let i = 0; i < Math.max(1, frames); i++) await nextFrame();
      target.dispatchEvent(new KeyboardEvent('keyup', init));
      await nextFrame();
    },
    tap: (action) => hook.press(action, 1),
    idle() {
      return new Promise((resolve) => {
        let calm = 0;
        const check = () => {
          if (isIdle()) { if (++calm >= 2) { resolve(); return; } } else calm = 0;
          raf(check);
        };
        raf(check);
      });
    },

    scene: () => G.scenes.top()?.name ?? '',
    stack: () => G.scenes.stack.map((s) => s.name ?? '?'),
    text() {
      const out = [];
      for (const s of G.scenes.stack.slice().reverse()) {
        if (typeof s.debugText === 'function') out.push(s.debugText());
        if (s.opaque !== false) break;
      }
      return out.join('\n');
    },
    rng: (label) => G.rngs.fresh(label),
    validate: () => validateWorld(rawWorld(), G.data),
    marker(name) {
      console.log(`MARK ${name}`);
      if (G.debugOverlay) G.debugOverlay.marker(name);
      G.bus.emit('debug:marker', { name });
    },
    perf: () => ({ ...(G.perf ?? {}) }),
    save: (reason = 'debug') => G.persist.autosave(G, reason),   // G is the PersistG (§10)
    load(slot) {
      const res = G.persist.load(slot);
      if (!res.ok) return false;
      G.store.replace(res.world);
      return true;
    },
    step: (n = 1) => G.loop.step(n),
    pause: () => G.loop.pause(),
    resume: () => G.loop.resume(),
    push: (name, params) => G.push(name, params),

    bind(name, fn) {
      if (typeof fn !== 'function') throw new TypeError(`__game.bind: fn for '${name}' must be a function`);
      bound[name] = fn;
    },
    isBound: (name) => typeof bound[name] === 'function',
    uninstall() {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onError);
      if (opts.expose !== false && target.__game === hook) delete target.__game;
    },
  };
  for (const name of Object.keys(LANE_HOOKS)) {
    hook[name] = (...args) => {
      const impl = bound[name] ?? fallbacks[name];
      if (!impl) throw notWired(name);
      return impl(...args);
    };
  }
  if (opts.expose !== false) target.__game = hook;
  return hook;
}

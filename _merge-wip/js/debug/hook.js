/**
 * `window.__game` debug and test hook. [BOOT] (day 1) — ARCHITECTURE-DRAFT §11.
 *
 * Installed only with `?debug=1` or on localhost. Every mutating hook goes through `store.tx`, so
 * events and autosave behave as in play. `press()`/`tap()` synthesize real `KeyboardEvent`s on the
 * window (keyboard tokens are `KeyboardEvent.code`), `idle()` resolves when no transition, tween or
 * busy scene is running, and `errors` collects `window.onerror` + `unhandledrejection`.
 *
 * Hooks whose system has not landed (`give`, `earn`, `addCreature`, `heal`, `battle`, `wild`,
 * `forceForecast`, `deliverLetter`, `sleep`, `runScript`) throw a readable "not wired" error until the
 * owning lane registers an implementation with `hook.bind(name, fn)`.
 * @module debug/hook
 */
import { tokenDevice } from '../core/input.js';
import { validateWorld } from '../_shims/state/schema.js'; // INTEGRATOR: '../state/schema.js'

/** Hooks that wait on another lane, with the lane that owns them. */
export const LANE_HOOKS = Object.freeze({
  give: 'RULES-ECON', earn: 'RULES-ECON', addCreature: 'RULES-CREATURE', heal: 'RULES-CREATURE',
  battle: 'FLOW', wild: 'FLOW', forceForecast: 'RULES-SHIFT', deliverLetter: 'SYS-TOWN',
  sleep: 'FLOW', runScript: 'SCRIPT',
});

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
 * @param {string} name
 * @returns {Error}
 */
function notWired(name) {
  return new Error(`__game.${name}: not wired yet (owner: ${LANE_HOOKS[name] ?? 'unknown'}); call __game.bind('${name}', fn) from the owning module`);
}

/**
 * @typedef {Object} DebugHook
 * @property {object} G
 * @property {object} world
 * @property {() => object} state
 * @property {(mapId: string, x: number, y: number) => void} warp
 * @property {(hour: number, minute?: number) => void} setTime
 * @property {(x: number|null) => void} setTide
 * @property {(id: string, value?: any) => void} flag
 * @property {() => object} flags
 * @property {(mult: number) => void} speed
 * @property {(on: boolean) => void} skipAnims
 * @property {(action: string, frames?: number) => Promise<void>} press
 * @property {(action: string) => Promise<void>} tap
 * @property {() => Promise<void>} idle
 * @property {() => string} scene
 * @property {() => string[]} stack
 * @property {() => string} text
 * @property {(label: string) => import('../core/rng.js').Rng} rng
 * @property {() => string[]} validate
 * @property {(name: string) => void} marker
 * @property {Array<{message: string, stack: string}>} errors
 * @property {() => object} perf
 * @property {(reason?: string) => object} save
 * @property {(slot: string) => boolean} load
 * @property {(n: number) => void} step
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {(name: string, fn: Function) => void} bind   register a lane-owned hook implementation
 * @property {(name: string, params?: any) => void} push   push a scene by name (visual work)
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

  const bound = Object.create(null);

  function isIdle() {
    if (G.loop && G.loop.paused) return true;
    if (G.scenes.isTransitioning) return false;
    if (G.tweens && G.tweens.count > 0) return false;
    return !G.scenes.stack.some((s) => typeof s.isBusy === 'function' && s.isBusy());
  }

  const hook = {
    G,
    get world() { return G.world; },
    state: () => structuredClone(G.world),
    errors,

    warp(mapId, x, y) {
      G.store.tx('debug:warp', (w) => { w.player.mapId = mapId; w.player.x = x; w.player.y = y; });
      G.bus.emit('debug:warp', { mapId, x, y });
    },
    setTime(hour, minute = 0) {
      G.clock.skipTo(((hour * 60 + minute) % 1440 + 1440) % 1440);
      G.store.tx('debug:setTime', (w) => { w.clock = G.clock.serialize(); });
    },
    setTide(x) {
      if (typeof G.clock.freezeTide !== 'function') throw new Error('__game.setTide: core/time.freezeTide is not available yet (owner: CORE)');
      G.clock.freezeTide(x);
    },
    flag(id, value = true) { G.store.tx('debug:flag', (w) => { w.flags[id] = value; }); },
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
    validate: () => validateWorld(G.world, G.data),
    marker(name) {
      console.log(`MARK ${name}`);
      if (G.debugOverlay) G.debugOverlay.marker(name);
      G.bus.emit('debug:marker', { name });
    },
    perf: () => ({ ...(G.perf ?? {}) }),
    save: (reason = 'debug') => G.persist.autosave(G, reason),
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
    uninstall() {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onError);
      if (opts.expose !== false && target.__game === hook) delete target.__game;
    },
  };
  for (const name of Object.keys(LANE_HOOKS)) {
    hook[name] = (...args) => {
      if (!bound[name]) throw notWired(name);
      return bound[name](...args);
    };
  }
  if (opts.expose !== false) target.__game = hook;
  return hook;
}

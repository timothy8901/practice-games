/**
 * Boot and main loop. [BOOT] (day 1) — ARCHITECTURE-DRAFT §2.3 / §2.4.
 *
 * Builds the one context object `G`, runs a fixed-step loop with no interpolation, pauses on blur,
 * watches the frame budget for the low-power fallback and installs the debug hook. Nothing else
 * touches `requestAnimationFrame` or the DOM shell.
 * @module main
 */
import * as config from './config.js';
import { parseFlags, isLocalhost } from './debug/flags.js';
import { installDebugHook } from './debug/hook.js';
import { createDisplay } from './core/canvas.js';
import { createInput } from './core/input.js';
import { createSceneStack } from './core/scene.js';
import { audio } from './core/audio.js';
import { createTweens } from './core/tween.js';
import { createFX } from './core/fx.js';
import { createClock } from './core/time.js';
import { makeRng, randomSeedCode, setSeedToggles } from './core/rng.js';
// ---- sibling lanes. INTEGRATOR: delete js/_shims and replace '/_shims/' with '/' in these paths. ----
import { createStore } from './_shims/state/store.js';
import { createPersist } from './_shims/state/persist.js';
import { createNewWorld, SCHEMA_VERSION } from './_shims/state/schema.js';
import { MIGRATIONS } from './_shims/state/migrate.js';
import { createRngs } from './_shims/state/rngs.js';
import { DATA } from './_shims/data/index.js';
import { createRegistry } from './_shims/data/registry.js';
import { DIALS, TOGGLE_ORDER } from './_shims/data/dials.js';
import * as clockSys from './_shims/systems/clockSys.js';
import { createMusicDirector } from './_shims/audio/director.js';
import { createToasts } from './_shims/ui/toast.js';
// ---------------------------------------------------------------------------------------------------
import { sceneFactories } from './scenes/index.js';
import { createDebugOverlay } from './scenes/debugOverlay.js';

/**
 * The one context object, created once here and handed to every scene factory. Never imported.
 * See ARCHITECTURE-DRAFT §2.2 for the shared fields; BOOT adds `perf`, `loop`, `debugOverlay` and
 * `debugHook` (debug builds only).
 * @typedef {Object} G
 * @property {import('./_shims/state/store.js').Store} store
 * @property {object} world            getter: store.world (re-pointed on load; read each frame, never cache)
 * @property {import('./core/events.js').EventBus} bus
 * @property {import('./core/canvas.js').Display} display
 * @property {import('./core/input.js').Input} input
 * @property {import('./core/scene.js').SceneStack} scenes
 * @property {import('./core/audio.js').AudioEngine} audio
 * @property {object} music
 * @property {import('./_shims/data/registry.js').Registry} data
 * @property {import('./_shims/state/rngs.js').Rngs} rngs
 * @property {import('./core/time.js').Clock} clock
 * @property {import('./core/tween.js').Tweens} tweens
 * @property {import('./core/fx.js').FX} fx
 * @property {import('./_shims/state/persist.js').Persist} persist
 * @property {import('./_shims/ui/toast.js').Toasts} toasts
 * @property {import('./debug/flags.js').BootFlags} flags
 * @property {Record<string, (G: G) => import('./core/scene.js').Scene>} sceneFactories
 * @property {(name: string, params?: any) => void} push
 * @property {(name: string, params?: any) => void} replaceWith
 * @property {number} speed
 * @property {boolean} lowPower
 * @property {import('./core/rng.js').Rng} entropy
 * @property {PerfCounters} perf
 * @property {{paused: boolean, pause: () => void, resume: () => void, step: (n?: number) => void}} loop
 * @property {import('./scenes/debugOverlay.js').DebugOverlay|null} debugOverlay
 */

/**
 * @typedef {Object} PerfCounters
 * @property {number} fps        smoothed frames per second
 * @property {number} update     last frame's simulation time in ms
 * @property {number} draw       last frame's draw time in ms
 * @property {number} drawImages drawImage calls in the last frame (debug builds count them)
 * @property {number} chunks     tile chunks drawn (RENDER fills in)
 * @property {number} entities   entities drawn (RENDER fills in)
 * @property {number} particles  live particles
 * @property {number} slowFrames consecutive frames over SLOW_FRAME_MS
 * @property {number} frames     frames since boot
 */

/**
 * Storage that survives a throwing `localStorage` getter (private mode, blocked site data).
 * @param {Window} win
 * @returns {Storage|null}
 */
function safeLocalStorage(win) {
  try {
    const s = win.localStorage;
    const probe = `${config.SAVE_PREFIX}__probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/**
 * Seed code for the pre-title world: `?seed=` when it decodes, else a fresh random code.
 * @param {string|null} requested
 * @param {import('./core/rng.js').Rng} entropy
 * @returns {string}
 */
function initialSeedCode(requested, entropy) {
  if (requested) {
    try {
      createNewWorld({ seedCode: requested });
      return requested;
    } catch (e) {
      console.warn(`main: ignoring ?seed=${requested}: ${e.message}`);
    }
  }
  return randomSeedCode(DIALS.default.toUpperCase(), entropy);
}

/**
 * Boots the game into the document. Exported so tests and tools can boot against an injected window.
 * @param {{window?: Window, document?: Document}} [env]
 * @returns {G}
 */
export function boot(env = {}) {
  const win = env.window ?? globalThis.window;
  const doc = env.document ?? globalThis.document;

  // 1. flags
  const flags = parseFlags(win.location.search);
  const debug = flags.debug || isLocalhost(win.location.hostname);
  const entropy = makeRng(`${Date.now()}:${Math.random()}`); // the only unseeded rng; cosmetic use only
  /** @type {G|null} assigned in step 7; display/scene callbacks that fire earlier see null */
  let G = null;

  // 2. display + input
  const stage = doc.getElementById('stage') ?? doc.body;
  const touchHost = doc.getElementById('touch') ?? doc.body;
  const display = createDisplay({
    width: config.NATIVE_W,
    height: config.NATIVE_H,
    parent: stage,
    mode: flags.scale ?? 'integer',
    onResize: (layout) => { if (G) G.bus.emit('display:resize', layout); },
  });
  const input = createInput({ canvas: display.canvas, display, touchParent: touchHost, touch: flags.touch });

  // 3. persistence
  const persist = createPersist({
    storage: safeLocalStorage(win),
    prefix: config.SAVE_PREFIX,
    version: SCHEMA_VERSION,
    migrations: MIGRATIONS,
  });

  // 4. data registry
  const data = createRegistry(DATA);
  if (debug) {
    const problems = data.verify();
    if (problems.length) throw new Error(`data.verify failed:\n${problems.join('\n')}`);
  }

  // 5. store, rngs, clock
  setSeedToggles(TOGGLE_ORDER);
  const store = createStore(createNewWorld({ seedCode: initialSeedCode(flags.seed, entropy) }), { strict: flags.strict });
  const rngs = createRngs(store);
  const clock = createClock(clockSys.optionsFrom(store.world));
  store.bus.on('world:replaced', (world) => clockSys.restoreFrom(world, clock));

  // 6. scene stack
  const scenes = createSceneStack({
    input,
    width: config.NATIVE_W,
    height: config.NATIVE_H,
    onChange: (event) => {
      if (G && G.music && typeof G.music.onSceneChange === 'function') G.music.onSceneChange(event);
      store.bus.emit('scene:change', { type: event.type, scene: event.scene?.name ?? null, top: event.top?.name ?? null });
    },
  });

  // 7. assemble G
  /** @type {PerfCounters} */
  const perf = { fps: 0, update: 0, draw: 0, drawImages: 0, chunks: 0, entities: 0, particles: 0, slowFrames: 0, frames: 0 };
  const loop = {
    paused: false,
    pause() { loop.paused = true; },
    resume() { loop.paused = false; acc = 0; last = win.performance.now(); },
    step(n = 1) { for (let i = 0; i < n; i++) step(config.TICK_MS); },
  };
  G = {
    store,
    get world() { return store.world; },
    bus: store.bus,
    display,
    input,
    scenes,
    audio,
    music: null,
    data,
    rngs,
    clock,
    tweens: createTweens(),
    fx: createFX({ width: config.NATIVE_W, height: config.NATIVE_H, rng: entropy.fork('fx') }),
    persist,
    toasts: createToasts({ width: config.NATIVE_W, height: config.NATIVE_H }),
    flags,
    sceneFactories,
    push(name, params) { scenes.push(makeScene(name), params); },
    replaceWith(name, params) { scenes.replace(makeScene(name), params); },
    speed: flags.speed,
    lowPower: false,
    entropy,
    perf,
    loop,
    debugOverlay: null,
  };
  function makeScene(name) {
    const factory = sceneFactories[name];
    if (typeof factory !== 'function') throw new Error(`main: no scene named '${name}' (have: ${Object.keys(sceneFactories).join(', ')})`);
    return factory(G);
  }
  G.music = createMusicDirector(G);
  G.bus.on('toast', (payload) => G.toasts.push(typeof payload === 'string' ? payload : payload?.text ?? ''));
  G.bus.on('save:fail', (res) => G.toasts.push(`Save failed: ${res.error?.code ?? 'unknown'}`, { color: '#ff9b9b' }));

  if (debug) {
    if (config.FEATURES.debugOverlay) G.debugOverlay = createDebugOverlay(G);
    G.debugHook = installDebugHook(G, { target: win });
    const ctx = display.ctx;
    const rawDrawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (...args) => { perf.drawImages++; return rawDrawImage(...args); };
  }

  // 8. audio: unlock on the first gesture; honour ?mute=1
  if (flags.mute) audio.mute(true);
  const unlock = () => {
    audio.unlock();
    win.removeEventListener('pointerdown', unlock);
    win.removeEventListener('keydown', unlock);
  };
  win.addEventListener('pointerdown', unlock);
  win.addEventListener('keydown', unlock);

  // 9. crash marker + clean exit
  if (persist.crashMarker && typeof persist.crashMarker.arm === 'function') persist.crashMarker.arm();
  win.addEventListener('pagehide', () => {
    if (persist.crashMarker && typeof persist.crashMarker.clear === 'function') persist.crashMarker.clear();
  });

  // 10. pause on blur / resume on focus
  let hiddenPause = false;
  let mutedBefore = false;
  function onHide() {
    if (hiddenPause) return;
    hiddenPause = true;
    mutedBefore = audio.isMuted();
    audio.mute(true);
    if (scenes.find('overworld') && !scenes.find('menu') && !scenes.isTransitioning && scenes.top()?.name === 'overworld') {
      G.push('menu');
    }
  }
  function onShow() {
    if (!hiddenPause) return;
    hiddenPause = false;
    if (!mutedBefore && !flags.mute) audio.mute(false);
    acc = 0;
    last = win.performance.now();
  }
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) onHide(); else onShow(); });
  win.addEventListener('blur', onHide);
  win.addEventListener('focus', onShow);

  // 11. the loop (§2.4): fixed timestep, no interpolation
  const TICK = config.TICK_MS;
  let acc = 0;
  let last = win.performance.now();
  let fpsAcc = 0;
  let fpsFrames = 0;
  if (store.world.settings && store.world.settings.fps30) engageLowPower();

  function engageLowPower() {
    if (G.lowPower) return;
    G.lowPower = true;
    if (typeof G.fx.setBudget === 'function') G.fx.setBudget(config.LOW_POWER_FX_BUDGET);
    G.bus.emit('display:lowPower', { on: true });
  }

  function watchBudget(dt) {
    if (dt > config.SLOW_FRAME_MS) {
      perf.slowFrames++;
      if (perf.slowFrames >= config.SLOW_FRAMES_TO_LOW_POWER) engageLowPower();
    } else {
      perf.slowFrames = 0;
    }
  }

  function step(ms) {
    G.input.update();
    G.tweens.update(ms);
    G.fx.update(ms);
    G.toasts.update(ms);
    G.scenes.handleInput(G.input);
    G.scenes.update(ms);
    G.persist.tick(G, ms);
    if (G.debugOverlay) G.debugOverlay.update(ms);
  }

  function draw() {
    const ctx = G.display.ctx;
    G.display.clear('#000');
    G.scenes.draw(ctx);
    G.fx.draw(ctx, { layer: 'front' });
    G.toasts.draw(ctx);
    if (G.debugOverlay) G.debugOverlay.draw(ctx);
  }

  function frame(now) {
    win.requestAnimationFrame(frame);
    const dt = Math.min(now - last, config.MAX_FRAME_DT_MS);
    last = now;
    perf.frames++;
    fpsAcc += dt;
    fpsFrames++;
    if (fpsAcc >= 500) { perf.fps = (fpsFrames * 1000) / fpsAcc; fpsAcc = 0; fpsFrames = 0; }

    const t0 = win.performance.now();
    if (!loop.paused) {
      acc += dt * G.speed;
      const maxSteps = config.MAX_STEPS_PER_FRAME * Math.max(1, G.speed);
      let steps = 0;
      while (acc >= TICK && steps < maxSteps) { step(TICK); acc -= TICK; steps++; }
      if (steps === maxSteps) acc = 0;
    }
    const t1 = win.performance.now();
    perf.drawImages = 0;
    draw();
    G.display.present();
    const t2 = win.performance.now();
    perf.update = t1 - t0;
    perf.draw = t2 - t1;
    perf.particles = G.fx.particleCount;
    watchBudget(dt);
  }

  // 12. go
  scenes.push(sceneFactories.boot(G));
  win.requestAnimationFrame(frame);
  return G;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementById('stage')) {
  boot();
}

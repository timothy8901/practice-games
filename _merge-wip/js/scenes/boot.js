/**
 * Boot scene. [SCN-FLOW] (day 1)
 *
 * First scene on the stack. Reads the crash marker, then routes: `?skipTitle=1` builds a default
 * lease card and replaces itself with the overworld; otherwise it fades to the title, handing it the
 * crash verdict and the newest save entry so it can offer "Resume from autosave".
 * @module scenes/boot
 */
import { createNewWorld } from '../_shims/state/schema.js'; // INTEGRATOR: '../state/schema.js'
import { FEATURES, TRANSITION_MS } from '../config.js';
import { KIT } from './day1kit.js';
import { drawText } from '../core/font.js';

/**
 * Whether the previous session ended without a clean exit. Tolerates the two shapes the STATE lane
 * may ship (`persist.crashed()` or `persist.crashMarker.check()`).
 * @param {object} persist
 * @returns {boolean}
 */
export function lastSessionCrashed(persist) {
  if (!persist) return false;
  if (typeof persist.crashed === 'function') return Boolean(persist.crashed());
  const m = persist.crashMarker;
  if (typeof m === 'function') return Boolean(m());
  if (m && typeof m.check === 'function') return Boolean(m.check());
  return false;
}

/**
 * Transition length honouring `?noanim=1`.
 * @param {object} G
 * @param {number} [ms]
 * @returns {number}
 */
export function fadeMs(G, ms = TRANSITION_MS) {
  return G.flags && G.flags.noanim ? 0 : ms;
}

/**
 * Starts a new run: builds the world, swaps it into the store and fades to the overworld. When
 * `?scene=<name>` is set the named scene is pushed on top for visual work. The arrival cutscene is
 * data (`world.pendingScript`) and is the panel's to write. [GDD: arrival script content]
 * @param {object} G
 * @param {{seedCode: string, lease?: object}} opts
 */
export function newGame(G, opts) {
  const world = createNewWorld({ seedCode: opts.seedCode, lease: opts.lease });
  G.scenes.transition('fade', fadeMs(G), () => {
    G.store.replace(world);
    G.replaceWith('overworld', { fresh: true });
    if (G.flags.scene && G.flags.scene !== 'overworld' && G.sceneFactories[G.flags.scene]) {
      G.push(G.flags.scene, { trainer: G.flags.trainer });
    }
  });
}

/**
 * Loads a slot into the store and fades to the overworld.
 * @param {object} G
 * @param {string} slot
 * @returns {{ok: boolean, error?: object}}
 */
export function continueGame(G, slot) {
  const res = G.persist.load(slot);
  if (!res.ok) return res;
  G.scenes.transition('fade', fadeMs(G), () => {
    G.store.replace(res.world);
    G.replaceWith('overworld', { loaded: slot });
  });
  return { ok: true };
}

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createBootScene(G) {
  let routed = false;
  return {
    name: 'boot',
    opaque: true,
    enter() {
      routed = false;
    },
    update() {
      if (routed) return;
      routed = true;
      const crashed = FEATURES.crashRecovery && lastSessionCrashed(G.persist);
      const latest = typeof G.persist.latest === 'function' ? G.persist.latest() : null;
      if (G.flags.slot) {
        const res = continueGame(G, G.flags.slot);
        if (res.ok) return;
        console.warn(`boot: could not load ?slot=${G.flags.slot}: ${res.error?.message ?? 'unknown error'}`);
      }
      if (G.flags.skipTitle) {
        newGame(G, { seedCode: G.world.run.seedCode });
        return;
      }
      G.scenes.transition('fade', fadeMs(G, 250), () => G.replaceWith('title', { crashed, latest }));
    },
    draw(ctx) {
      ctx.fillStyle = KIT.night;
      ctx.fillRect(0, 0, 480, 270);
      drawText(ctx, '. . .', 240, 130, { color: KIT.inkSoft, align: 'center' });
    },
    handleInput() {},
  };
}

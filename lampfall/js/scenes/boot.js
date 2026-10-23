/**
 * Boot scene. [SCN-FLOW] — ARCHITECTURE §2.5.
 *
 * First scene on the stack. Reads the crash marker, then routes:
 * - `?slot=` loads that save into the overworld;
 * - `?skipTitle=1` builds a default lease card (Sorrel, red panda) and replaces itself with the
 *   overworld, the arrival pending;
 * - `?scene=title|seedCard|leaseCard|ending|credits` opens that flow screen directly (debug /
 *   visual work: ending and credits get a default run world), and any other `?scene=` is pushed over
 *   the overworld after a skipTitle-style start;
 * - otherwise it fades to the title, handing it the crash verdict.
 *
 * New Game runs title -> seedCard -> leaseCard -> overworld; {@link buildRunWorld} is the one place
 * a run's world is made from the Seed Card and Lease Card answers. Boot also installs the ending
 * trigger once (scenes/ending `installEndingTrigger`).
 * @module scenes/boot
 */
import { createNewWorld } from '../state/schema.js';
import { FEATURES, TRANSITION_MS } from '../config.js';
import { drawText } from '../core/font.js';
import { PALETTE } from '../ui/theme.js';
import { setFlag } from '../systems/flags.js';
import * as weather from '../systems/weather.js';
import { LEASE_FLAGS, marksToMask, DEFAULT_SIGNAL } from './flowKit.js';
import { installEndingTrigger } from './ending.js';
import * as eventScripts from '../systems/flow/eventScripts.js';

/**
 * Lease card used when no lease-card scene ran (`?skipTitle=1`). GDD-00 §3 defaults.
 * @type {Readonly<{name: string, species: string, pronouns: string}>}
 */
export const DEFAULT_LEASE = Object.freeze({ name: 'Sorrel', species: 'red-panda', pronouns: 'they' });

/** Arrival script ids, in preference order (story chapter id first, the day-1 placeholder last). */
export const ARRIVAL_SCRIPTS = Object.freeze(['arrival-causeway', 'arrival', 'ph-arrival']);

/** Flow screens `?scene=` opens directly instead of pushing over the overworld. */
export const DIRECT_SCENES = Object.freeze(['title', 'seedCard', 'leaseCard', 'ending', 'credits']);

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
 * The first arrival script id the data has, or null.
 * @param {any} data registry
 * @returns {string|null}
 */
export function arrivalScriptOf(data) {
  if (!data || typeof data.has !== 'function') return null;
  return ARRIVAL_SCRIPTS.find((id) => data.has('scripts', id)) ?? null;
}

/**
 * @typedef {Object} LeaseAnswers
 * @property {string} [name]  @property {string} [species]  @property {string} [pronouns]
 * @property {number} [fur]   @property {string[]} [markings]  @property {string} [eyes]  @property {boolean} [blush]
 * @property {string} [town]  @property {number[]} [signal]  @property {string} [wake]
 * @property {string} [plant] windowsill plant (Wren's small talk)
 * @property {string} [weather] tomorrow's weather kind (Wren's small talk)
 */

/**
 * Builds a run's world from the Seed Card and Lease Card answers: `createNewWorld`, the lease
 * flags (`sys.lease.*`, see scenes/flowKit), `sp.lease-signed`, tomorrow's weather pinned and the
 * arrival script pending. Pure apart from reading `G.data` / `G.world.settings`.
 * @param {any} G
 * @param {{seedCode: string, dial?: string, challenges?: string[], lease?: LeaseAnswers}} opts
 * @returns {any} the world
 */
export function buildRunWorld(G, opts) {
  const L = { ...DEFAULT_LEASE, ...(opts.lease ?? {}) };
  let settings;
  try { settings = G.world?.settings ? structuredClone(G.world.settings) : undefined; } catch { settings = undefined; }
  const world = createNewWorld({
    seedCode: opts.seedCode,
    dial: opts.dial,
    challenges: opts.challenges ?? [],
    settings,
    lease: {
      name: L.name,
      species: L.species,
      pronouns: L.pronouns,
      look: { fur: Number.isInteger(L.fur) ? L.fur : 0, marks: marksToMask(L.markings ?? []), outfit: 0 },
    },
  });
  const put = (id, v) => { if (v !== undefined && v !== null) setFlag(world, id, v); };
  put(LEASE_FLAGS.eyes, L.eyes ?? 'round');
  put(LEASE_FLAGS.blush, L.blush === true);
  put(LEASE_FLAGS.town, (L.town ?? 'Pellwick').trim() || 'Pellwick');
  put(LEASE_FLAGS.signal, (L.signal ?? DEFAULT_SIGNAL).join(','));
  put(LEASE_FLAGS.wake, L.wake ?? 'porch');
  if (L.plant) put(LEASE_FLAGS.plant, L.plant);
  put(LEASE_FLAGS.signed, true);
  if (L.weather) {
    try { weather.pinDay(world, G.data, L.weather); } catch { /* an unknown kind leaves the roll alone */ }
  }
  const arrival = arrivalScriptOf(G.data);
  if (arrival) eventScripts.queue(world, arrival);
  return world;
}

/**
 * Starts a new run: builds the world, swaps it into the store and fades to the overworld. When
 * `?scene=<name>` names a non-flow scene it is pushed on top for visual work.
 * @param {object} G
 * @param {{seedCode: string, dial?: string, challenges?: string[], lease?: LeaseAnswers, transition?: string}} opts
 */
export function newGame(G, opts) {
  const world = buildRunWorld(G, opts);
  G.scenes.transition(opts.transition ?? 'fade', fadeMs(G), () => {
    G.store.replace(world);
    G.replaceWith('overworld', { fresh: true });
    const s = G.flags.scene;
    if (s && s !== 'overworld' && !DIRECT_SCENES.includes(s) && G.sceneFactories[s]) {
      G.push(s, { trainer: G.flags.trainer });
    }
  }, { color: PALETTE.nightInk });
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
  }, { color: PALETTE.nightInk });
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
      try { installEndingTrigger(G); } catch (e) { console.warn(`boot: ending trigger not installed: ${e.message}`); }
    },
    update() {
      if (routed) return;
      routed = true;
      const crashed = FEATURES.crashRecovery && lastSessionCrashed(G.persist);
      if (G.flags.slot) {
        const res = continueGame(G, G.flags.slot);
        if (res.ok) return;
        console.warn(`boot: could not load ?slot=${G.flags.slot}: ${res.error?.message ?? 'unknown error'}`);
      }
      const direct = G.flags.scene && DIRECT_SCENES.includes(G.flags.scene) ? G.flags.scene : null;
      if (direct === 'ending' || direct === 'credits') {
        const world = buildRunWorld(G, { seedCode: G.world.run.seedCode });
        eventScripts.takePending(world);
        G.store.replace(world);
        G.replaceWith(direct, { debug: true });
        return;
      }
      if (direct === 'seedCard' || direct === 'leaseCard') {
        G.replaceWith(direct, { seedCode: G.world.run.seedCode, dial: G.world.run.dial, challenges: [] });
        return;
      }
      if (G.flags.skipTitle && direct !== 'title') {
        newGame(G, { seedCode: G.world.run.seedCode });
        return;
      }
      G.scenes.transition('fade', fadeMs(G, 250), () => G.replaceWith('title', { crashed }), { color: PALETTE.nightInk });
    },
    draw(ctx) {
      ctx.fillStyle = PALETTE.nightInk;
      ctx.fillRect(0, 0, 480, 270);
      drawText(ctx, '. . .', 240, 130, { color: PALETTE.inkSoft, align: 'center' });
    },
    handleInput() {},
  };
}

/**
 * Music director. [AUDIO] — ARCHITECTURE-DRAFT §1, §2.3, §3.4.
 *
 * DAY-1 VERSION written by the integrator at Checkpoint 0 so `main.js` assembles `G.music` without a
 * shim. It decides nothing yet: it records the last scene change and the bus events it will react to,
 * so the debug overlay and tests can see the wiring. The AUDIO lane owns this file and replaces the
 * body (bus -> `audio.playMusic` / `audio.setStem` from `audio/tracks` CUES), keeping the exported
 * names: `createMusicDirector(G)` returning {@link MusicDirector}.
 * @module audio/director
 */

/** Bus events the director listens to (§3.4). The real director adds tracks and stems per event. */
export const DIRECTOR_EVENTS = Object.freeze(['map:enter', 'clock:phase', 'battle:start', 'battle:end', 'weather:change', 'world:replaced']);

/**
 * @typedef {Object} MusicDirector
 * @property {(event: {type: string, scene?: {name?: string}|null, top?: {name?: string}|null}) => void} onSceneChange
 *   scene-stack `onChange` callback (main.js forwards every push/pop/replace)
 * @property {() => {scene: string|null, lastEvent: string|null}} status  what the director last saw
 * @property {() => void} destroy  unsubscribes from the bus
 */

/**
 * @param {{bus?: {on: (evt: string, fn: Function) => (() => void)}}} G  the game context (only `bus` is read)
 * @returns {MusicDirector}
 */
export function createMusicDirector(G) {
  let scene = null;
  let lastEvent = null;
  /** @type {Array<() => void>} */
  const offs = [];
  if (G && G.bus && typeof G.bus.on === 'function') {
    for (const evt of DIRECTOR_EVENTS) {
      const off = G.bus.on(evt, () => { lastEvent = evt; });
      if (typeof off === 'function') offs.push(off);
    }
  }
  return Object.freeze({
    onSceneChange(event) { scene = event?.top?.name ?? null; },
    status: () => ({ scene, lastEvent }),
    destroy() { while (offs.length) offs.pop()(); },
  });
}

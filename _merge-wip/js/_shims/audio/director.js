/** SHIM for js/audio/director.js [AUDIO]. Delete at integration. Decides nothing yet. */

/**
 * @typedef {Object} MusicDirector
 * @property {(event: import('../../core/scene.js').ChangeEvent) => void} onSceneChange
 * @property {() => void} destroy
 */

/**
 * @param {object} G
 * @returns {MusicDirector}
 */
export function createMusicDirector(G) {
  void G;
  return Object.freeze({
    onSceneChange() {},
    destroy() {},
  });
}

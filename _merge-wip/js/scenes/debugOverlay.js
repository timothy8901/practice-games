/**
 * Debug overlay. [BOOT]
 *
 * Perf counters, `validateWorld` failures and 1-frame markers, drawn by `main.js` above the scene
 * stack when `?debug=1`. Also registered as a scene so `__game`/the menu can toggle it: pushing the
 * scene flips visibility and pops itself.
 * @module scenes/debugOverlay
 */
import { drawText } from '../core/font.js';
import { validateWorld } from '../_shims/state/schema.js'; // INTEGRATOR: '../state/schema.js'

/** How long a marker label stays up (long enough for a screenshot after `marker()`). */
export const MARKER_MS = 250;

/**
 * @typedef {Object} DebugOverlay
 * @property {boolean} visible
 * @property {() => void} toggle
 * @property {(name: string) => void} marker   show `name` in the corner for MARKER_MS
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 * @property {() => string[]} problems   last validateWorld result
 */

/**
 * @param {object} G
 * @returns {DebugOverlay}
 */
export function createDebugOverlay(G) {
  let visible = true;
  let mark = '';
  let markMs = 0;
  let sinceValidate = 1e9;
  let problems = [];
  const overlay = {
    get visible() { return visible; },
    set visible(v) { visible = Boolean(v); },
    toggle() { visible = !visible; },
    marker(name) { mark = String(name); markMs = MARKER_MS; },
    problems: () => problems.slice(),
    update(dt) {
      if (markMs > 0) markMs -= dt;
      sinceValidate += dt;
      if (sinceValidate >= 1000) {
        sinceValidate = 0;
        try { problems = validateWorld(G.world, G.data); } catch (e) { problems = [`validateWorld threw: ${e.message}`]; }
      }
    },
    draw(ctx) {
      if (markMs > 0) {
        ctx.fillStyle = '#ffdd57';
        ctx.fillRect(0, 0, 6, 6);
        drawText(ctx, mark, 8, 0, { color: '#ffdd57', font: 'small', outline: true });
      }
      if (!visible) return;
      const p = G.perf ?? {};
      const lines = [
        `fps ${Math.round(p.fps ?? 0)}  upd ${(p.update ?? 0).toFixed(1)}  drw ${(p.draw ?? 0).toFixed(1)}  img ${p.drawImages ?? 0}${G.lowPower ? '  LOW' : ''}`,
        `x${G.speed}  ${G.scenes.stack.map((s) => s.name).join('>')}${G.scenes.isTransitioning ? ' ~' : ''}`,
      ];
      if (problems.length) lines.push(`world: ${problems.length} problem(s): ${problems[0]}`);
      lines.forEach((line, i) => drawText(ctx, line, 478, 2 + i * 8, { color: problems.length && i === 2 ? '#ff7b7b' : '#c8ffc8', align: 'right', font: 'small', outline: true }));
    },
  };
  return overlay;
}

/**
 * Scene wrapper: toggles the overlay and pops immediately.
 * @param {object} G
 * @returns {import('../core/scene.js').Scene}
 */
export function createDebugOverlayScene(G) {
  return {
    name: 'debugOverlay',
    opaque: false,
    enter() { if (G.debugOverlay) G.debugOverlay.toggle(); },
    update() { if (G.scenes.top()?.name === 'debugOverlay') G.scenes.pop(); },
    handleInput() {},
    draw() {},
  };
}

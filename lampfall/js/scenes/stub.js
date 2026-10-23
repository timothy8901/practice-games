/**
 * Stub scene factory. [BOOT]
 *
 * Every scene in the manifest exists from day 1 so the menu graph is complete before any content.
 * A stub draws its name on paper and pops on `cancel` (or a pointer tap); when it is the only scene
 * on the stack it returns to the title instead of leaving the stack empty.
 * @module scenes/stub
 */
import { drawText } from '../core/font.js';
import { drawPaper, KIT } from './day1kit.js';

/**
 * @param {object} G   the game context
 * @param {string} name   scene name as registered in `scenes/index.js`
 * @param {{label?: string, lane?: string, opaque?: boolean}} [opts]
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createStubScene(G, name, opts = {}) {
  const label = opts.label ?? name;
  const lane = opts.lane ?? '';
  let params = null;
  return {
    name,
    opaque: opts.opaque ?? true,
    enter(p) { params = p ?? null; },
    exit() {},
    pause() {},
    resume() {},
    update() {},
    handleInput(input) {
      if (input.pressed('cancel') || (input.pointer && input.pointer.justDown)) {
        if (G.scenes.size > 1) G.scenes.pop({ stub: name });
        else G.replaceWith('title');
      }
    },
    draw(ctx) {
      ctx.fillStyle = KIT.night;
      ctx.fillRect(0, 0, 480, 270);
      drawPaper(ctx, 120, 80, 240, 110);
      drawText(ctx, label, 240, 96, { color: KIT.ink, align: 'center', scale: 2 });
      drawText(ctx, `scene '${name}'${lane ? `  [${lane}]` : ''}`, 240, 122, { color: KIT.inkSoft, align: 'center' });
      drawText(ctx, 'stub — not built yet', 240, 138, { color: KIT.wax, align: 'center' });
      if (params && Object.keys(params).length) {
        drawText(ctx, JSON.stringify(params).slice(0, 44), 240, 154, { color: KIT.inkSoft, align: 'center', font: 'small' });
      }
      drawText(ctx, 'cancel: back', 240, 172, { color: KIT.inkSoft, align: 'center' });
    },
    debugText: () => `${label} (stub)`,
  };
}

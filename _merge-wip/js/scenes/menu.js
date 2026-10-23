/**
 * Pause menu root. [SCN-MENU] DAY-1 STUB: lists Party, Bag, Field Log, Map, Ledger, Settings, Save
 * and pushes the matching scene by name. Modal over the overworld; `cancel` pops.
 * @module scenes/menu
 */
import { drawText } from '../core/font.js';
import { createLocalList, drawPaper, KIT } from './day1kit.js';

/** Menu entries in order; Save is always last. */
export const MENU_ITEMS = Object.freeze([
  Object.freeze({ label: 'Party', scene: 'party' }),
  Object.freeze({ label: 'Bag', scene: 'bag' }),
  Object.freeze({ label: 'Field Log', scene: 'fieldLog' }),
  Object.freeze({ label: 'Map', scene: 'mapScreen' }),
  Object.freeze({ label: 'Ledger', scene: 'ledger' }),
  Object.freeze({ label: 'Settings', scene: 'settings' }),
  Object.freeze({ label: 'Save', scene: 'saveLoad' }),
]);

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createMenuScene(G) {
  const x = 320;
  const y = 24;
  const w = 140;
  const list = createLocalList({
    items: MENU_ITEMS.map((it) => ({ label: it.label, value: it.scene })),
    x: x + 6, y: y + 22, w: w - 12, rowH: 14,
    onPick: (i, item) => G.push(item.value),
  });
  return {
    name: 'menu',
    opaque: false,
    enter() { list.index = 0; },
    resume() {},
    update() {},
    handleInput(input) {
      if (input.pressed('cancel')) { G.scenes.pop(); return; }
      list.handleInput(input);
    },
    draw(ctx) {
      ctx.fillStyle = 'rgba(10,12,24,0.45)';
      ctx.fillRect(0, 0, 480, 270);
      drawPaper(ctx, x, y, w, 22 + 14 * MENU_ITEMS.length + 10);
      drawText(ctx, 'MENU', x + 8, y + 6, { color: KIT.ink });
      drawText(ctx, G.clock ? G.clock.formatTime() : '', x + w - 8, y + 6, { color: KIT.inkSoft, align: 'right' });
      list.draw(ctx);
    },
    debugText: () => ['MENU', ...list.texts()].join('\n'),
  };
}

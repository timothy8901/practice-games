/**
 * Pause root. [SCN-MENU] — GDD-00 §13, GDD-09 §3.24.
 *
 * A non-opaque column over the field (night-ink scrim): Party, Satchel, Ledger, Map, Field Log,
 * Journal, Settings and **Save, always last**. One Up from the top lands on Save (the focus wraps and
 * Save is never skipped: under No Rewind it stays focusable, greyed, and opens the save screen in its
 * no-manual-saves mode). The column slides in from the right over 6 frames and out over 4 (a dissolve
 * under reduced motion). Opening flushes input (the stack does, and `enter` does again so a pause
 * press never leaks into the column). The overworld clock is paused while the menu is up by
 * construction: the stack updates only the top scene and this scene never sets `updateBelow`.
 *
 * Input: up/down (auto-repeat) move, confirm opens, cancel or the pause button closes, a pointer
 * hover focuses and a tap opens (two-step on touch, through `ui/focus`).
 * @module scenes/menu
 */
import { drawText } from '../core/font.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { createFocus } from '../ui/focus.js';
import { drawCurrency } from '../ui/widgets.js';
import { t } from '../data/strings.js';
import { formatTime, day as dayOf } from '../state/selectors.js';
import { MENU_ITEMS as MODEL_ITEMS, pauseRows, placeName, isNoRewind } from './menuModel.js';
// the HUD chip's picker, so the pause menu names the same objective as the chip (optional 'meet-*' beats rank last)
import { objectiveFor } from '../ui/objectiveChip.js';
import { prefsOf, skinOf, drawSkinPanel, createSlide, drawGlyph, drawCursorAt, drawHints, fitText, sfx, toast } from './menuKit.js';

/** Menu entries in order (`{label, scene}`); Save is always last. */
export const MENU_ITEMS = Object.freeze(MODEL_ITEMS.map((it) => Object.freeze({ id: it.id, label: it.label, scene: it.scene })));

/** Column geometry (GDD-09 §3.24). */
export const MENU_RECT = Object.freeze({ x: 320, y: 24, w: 140 });
/** The "Next:" slip left of the column (LG-PF2): the current objective in one or two lines. */
export const OBJECTIVE_RECT = Object.freeze({ x: 12, y: 24, w: 296, h: 34 });
const ROW_H = 14;
const HEAD_H = 20;

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createMenuScene(G) {
  const slide = createSlide({ dx: 12 });
  let rows = pauseRows(G.world);
  let ms = 0;
  /** @type {{text: string}|null} */ let objective = null;
  const readObjective = () => { try { objective = objectiveFor(G.world, G.data); } catch { objective = null; } };
  const focus = createFocus({ cols: 1, wrap: true, index: 0, items: [] });

  let layoutKey = '';
  /**
   * Lays the rows out at the slide offset. Only re-feeds the focus model when something changed:
   * `setItems` disarms the touch two-step, so calling it every frame would eat every second tap.
   */
  function layout(off = 0) {
    rows = pauseRows(G.world);
    const key = `${off}|${rows.map((r) => `${r.id}:${r.locked ? 1 : 0}`).join(',')}`;
    if (key === layoutKey) return;
    layoutKey = key;
    focus.setItems(rows.map((r, i) => ({
      id: r.id,
      rect: { x: MENU_RECT.x + 6 + off, y: MENU_RECT.y + HEAD_H + i * ROW_H, w: MENU_RECT.w - 12, h: ROW_H },
      enabled: true,
    })));
  }

  function open(row) {
    if (!row) return;
    if (typeof G.sceneFactories?.[row.scene] !== 'function' && G.sceneFactories) {
      sfx(G, 'blocked');
      toast(G, `${row.label}: not open yet.`); // str
      return;
    }
    sfx(G, 'confirm');
    G.push(row.scene, row.params ? { ...row.params } : { from: 'menu' });
  }

  function close() {
    if (slide.closing) return;
    sfx(G, 'cancel');
    slide.close(() => { if (G.scenes.top() === scene) G.scenes.pop(); }, prefsOf(G));
  }

  focus.on('activate', (ev) => open(rows[ev.index]));
  focus.on('cancel', () => close());
  focus.on('change', () => sfx(G, 'cursor'));

  const scene = {
    name: 'menu',
    opaque: false,
    enter() {
      G.input?.flush?.();
      layoutKey = '';
      layout();
      focus.set(0, { force: true });
      ms = 0;
      readObjective();
      slide.open(prefsOf(G));
    },
    exit() {},
    pause() {},
    resume() {
      G.input?.flush?.();
      layout();
      readObjective();
    },
    update(dt) {
      ms += dt;
      slide.update(dt);
      focus.update(dt);
    },
    handleInput(input) {
      if (slide.closing) return;
      if (input.pressed('start')) { close(); return; }
      focus.handle(input);
    },
    draw(ctx) {
      const prefs = prefsOf(G);
      const skin = skinOf(prefs);
      const a = slide.alpha();
      const off = slide.offset();
      ctx.save();
      ctx.globalAlpha = 0.45 * a;
      ctx.fillStyle = COLORS.night.ink;
      ctx.fillRect(0, 0, 480, 270);
      ctx.globalAlpha = prefs.reduced ? a : 1;
      layout(off);
      if (objective && objective.text) {
        const O = OBJECTIVE_RECT;
        drawSkinPanel(ctx, { x: O.x - off, y: O.y, w: O.w, h: O.h }, skin, 'notice');
        drawText(ctx, t('menu.next'), O.x - off + 8, O.y + 6, { color: skin.accent, font: 'small' });
        drawText(ctx, objective.text, O.x - off + 34, O.y + 6, { color: skin.text, font: 'small', maxWidth: O.w - 42 });
      }
      const x = MENU_RECT.x + off, y = MENU_RECT.y;
      const h = HEAD_H + rows.length * ROW_H + 40;
      drawSkinPanel(ctx, { x, y, w: MENU_RECT.w, h }, skin, 'paper');
      // heading + clock
      drawText(ctx, t('menu.heading'), x + 8, y + 7, { color: skin.text });
      const clock = G.clock?.formatTime ? G.clock.formatTime() : formatTime(G.world);
      drawText(ctx, clock, x + MENU_RECT.w - 8, y + 7, { color: skin.soft, align: 'right' });
      ctx.fillStyle = skin.rule;
      ctx.fillRect(x + 6, y + HEAD_H - 3, MENU_RECT.w - 12, 1);
      // rows
      rows.forEach((r, i) => {
        const ry = y + HEAD_H + i * ROW_H;
        const focused = i === focus.index;
        if (r.id === 'save') {
          ctx.fillStyle = skin.rule;
          for (let dx = 0; dx < MENU_RECT.w - 12; dx += 2) ctx.fillRect(x + 6 + dx, ry - 1, 1, 1);
        }
        if (focused) {
          ctx.fillStyle = focus.pointerActive ? (skin.dark ? PALETTE.deepBlue : COLORS.paper.grain) : skin.band;
          ctx.fillRect(x + 5, ry, MENU_RECT.w - 10, ROW_H - 1);
        }
        const ink = r.locked ? skin.faint : skin.text;
        drawGlyph(ctx, r.icon, x + 16, ry + 3, { ink, accent: r.locked ? skin.faint : (skin.dark ? PALETTE.y : COLORS.wax.fill), light: skin.dark ? COLORS.night.ink : COLORS.paper.light });
        drawText(ctx, r.label, x + 28, ry + 4, { color: ink });
        if (r.locked) drawText(ctx, '–', x + MENU_RECT.w - 14, ry + 4, { color: skin.faint });
        if (focused) drawCursorAt(ctx, x + 6, ry + 4, ms, skin);
      });
      // footer: day, place, buttons
      const fy = y + HEAD_H + rows.length * ROW_H + 4;
      ctx.fillStyle = skin.rule;
      ctx.fillRect(x + 6, fy, MENU_RECT.w - 12, 1);
      const w = G.world;
      const place = placeName(w?.player?.mapId, G.data);
      const dayW = drawText(ctx, `Day ${dayOf(w) + 1}`, x + 8, fy + 5, { color: skin.soft }).w; // str
      drawText(ctx, fitText(place, MENU_RECT.w - 24 - dayW), x + MENU_RECT.w - 8, fy + 5, { color: skin.soft, align: 'right' });
      drawCurrency(ctx, w?.wallet?.main ?? 0, x + 8, fy + 17, { dark: skin.dark });
      const cur = rows[focus.index];
      if (cur && cur.locked) {
        drawText(ctx, cur.note, x + 8, fy + 27, { color: skin.faint, font: 'small', maxWidth: MENU_RECT.w - 16 });
      } else if (isNoRewind(w)) {
        drawText(ctx, 'No Rewind', x + MENU_RECT.w - 8, fy + 16, { color: skin.faint, font: 'small', align: 'right' }); // str
      }
      focus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
      // key hints on a strip under the column, clear of whatever the field draws
      const hy = y + h + 5;
      ctx.fillStyle = COLORS.night.ink;
      ctx.globalAlpha = 0.85 * (prefs.reduced ? a : 1);
      ctx.fillRect(x, hy - 2, MENU_RECT.w, 13);
      ctx.globalAlpha = prefs.reduced ? a : 1;
      drawHints(ctx, G.input, [['confirm', 'Open'], ['cancel', 'Close']], { x: x + MENU_RECT.w - 4, y: hy }); // str
      ctx.restore();
    },
    debugText: () => [t('menu.heading'), ...rows.map((r, i) => `${i === focus.index ? '>' : ' '} ${r.label}${r.locked ? ' (locked)' : ''}`), ...(objective ? [`${t('menu.next')} ${objective.text}`] : [])].join('\n'),
    /** The objective line shown left of the column (LG-PF2). */
    get objective() { return objective; },
    isBusy: () => slide.phase === 'in' || slide.phase === 'out',
    /** Test/harness view of the column. */
    get index() { return focus.index; },
    get rows() { return rows; },
  };
  return scene;
}

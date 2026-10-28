/**
 * Confirm dialog. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `openConfirm(G, {title, body, options, defaultIndex, lockMs, danger})` -> Promise<number>.
 * Pushes a non-opaque scene on `G.scenes`, draws a torn-paper notice over the dimmed scene beneath
 * and resolves with the chosen option index when it pops. `defaultIndex` is the SAFE option (the
 * last one, "No", by default) and holds the cursor; `cancel` resolves to it as well, so backing
 * out never changes state. The dialog ignores every input (including a button held from before it
 * opened: the stack flushes on push) for `lockMs` (500 ms by default) and shows the lock as a
 * shrinking ledger rule under the options; nothing ever asks for a press inside a window.
 *
 * `createConfirmScene(opts)` builds the scene without a `G` (test pages, custom stacks) and
 * `layoutConfirm()` is the pure geometry.
 * @module ui/confirm
 */
import { drawText, measureText } from '../core/font.js';
import { createFocus } from './focus.js';
import { COLORS, PALETTE, ROLE_GLYPH, SPACE, TIMING, TYPE } from './theme.js';
import { drawPanel, drawDim } from './panel.js';
import { drawSealButton } from './widgets.js';

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} [title]
 * @property {string} body
 * @property {string[]} [options=['Yes','No']]
 * @property {number} [defaultIndex]  The safe option; defaults to the last.
 * @property {number} [lockMs=500]
 * @property {boolean} [danger]       Mark the non-default options as destructive (× glyph, red ink).
 * @property {boolean[]} [disabled]   Options shown greyed out that focus skips (LF-14: the bed's Sleep before 21:00).
 * @property {number} [width]         Screen width (default 480) @property {number} [height]
 */

/**
 * Geometry for a confirm box: centred notice sized to the wrapped body and the option row.
 * @param {ConfirmOptions} o
 * @returns {{panel: {x: number, y: number, w: number, h: number}, body: {x: number, y: number, w: number, h: number}, buttons: {x: number, y: number, w: number, h: number}[], note?: {x: number, y: number, w: number, h: number}, title?: {x: number, y: number}}}
 */
export function layoutConfirm(o) {
  const W = o.width || 480, H = o.height || 270;
  const options = o.options && o.options.length ? o.options : ['Yes', 'No'];
  const bodyW = 200;
  const m = measureText(o.body || '', { maxWidth: bodyW });
  const btnWs = options.map((t) => measureText(t).w + 22);
  const gap = SPACE.lg + SPACE.xs; // room for the ▶ cursor between seals
  const rowW = btnWs.reduce((a, b) => a + b, 0) + (options.length - 1) * gap;
  const w = Math.max(bodyW + 24, rowW + 24, (o.title ? measureText(o.title).w + 40 : 0));
  const bodyH = Math.max(TYPE.lineH, m.h);
  // A destructive confirm gets its own note line ("× cannot be undone") between body and seals.
  const noteH = o.danger ? 8 : 0;
  const h = 12 + bodyH + noteH + 10 + 13 + 12;
  const x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
  const by = y + h - 12 - 13;
  let bx = x + Math.floor((w - rowW) / 2);
  const buttons = btnWs.map((bw) => { const r = { x: bx, y: by, w: bw, h: 13 }; bx += bw + gap; return r; });
  return {
    panel: { x, y, w, h }, body: { x: x + 12, y: y + 12, w: w - 24, h: bodyH }, buttons,
    note: o.danger ? { x: x + 12, y: y + 12 + bodyH + 3, w: w - 24, h: 5 } : undefined,
    title: o.title ? { x: x + 6, y: y - 9 } : undefined,
  };
}

/**
 * Build the modal scene. `onDone(index)` fires once; the scene asks `pop(index)` on the stack it was
 * pushed on through `scene.stack` if set, else the caller pops in `onDone`.
 * @param {ConfirmOptions & {onDone: (index: number) => void, input?: import('../core/input.js').Input, stack?: {pop: (r?: any) => any}}} o
 * @returns {import('../core/scene.js').Scene & {lockLeft: number, index: number, choose: (i: number) => void, focus: import('./focus.js').Focus}}
 */
export function createConfirmScene(o) {
  const options = o.options && o.options.length ? o.options.slice() : ['Yes', 'No'];
  const safe = Number.isInteger(o.defaultIndex) ? Math.min(Math.max(0, o.defaultIndex), options.length - 1) : options.length - 1;
  const lockMs = o.lockMs === undefined ? TIMING.inputLockMs : Math.max(0, o.lockMs);
  const lay = layoutConfirm({ ...o, options });
  let lockLeft = lockMs;
  let resolved = false;

  const focus = createFocus({
    cols: options.length, wrap: true, index: safe,
    items: options.map((t, i) => ({ id: String(i), rect: lay.buttons[i], enabled: !(Array.isArray(o.disabled) && o.disabled[i]) })),
  });

  function finish(i) {
    if (resolved) return;
    resolved = true;
    if (scene.stack && typeof scene.stack.pop === 'function') scene.stack.pop(i);
    o.onDone(i);
  }

  focus.on('activate', (ev) => finish(ev.index));
  focus.on('cancel', () => finish(safe));

  const scene = {
    name: 'confirm',
    opaque: false,
    updateBelow: false,
    stack: o.stack || null,
    focus,
    get lockLeft() { return lockLeft; },
    get index() { return focus.index; },
    get locked() { return lockLeft > 0; },
    choose: finish,
    enter() {
      lockLeft = lockMs;
      if (o.input && typeof o.input.flush === 'function') o.input.flush();
    },
    update(dt) {
      if (lockLeft > 0) lockLeft = Math.max(0, lockLeft - dt);
      focus.update(dt);
    },
    handleInput(input) {
      if (lockLeft > 0) {
        // Swallow everything while locked; a held button never counts, a buffered press is dropped.
        return;
      }
      focus.handle(input);
    },
    draw(ctx) {
      drawDim(ctx, o.width, o.height);
      drawPanel(ctx, lay.panel, 'notice', { torn: 'both', title: o.title, titleStyle: 'wax', pin: !o.title });
      drawText(ctx, o.body || '', lay.body.x, lay.body.y, { color: COLORS.paper.ink, maxWidth: lay.body.w });
      options.forEach((label, i) => {
        const b = lay.buttons[i];
        const role = i === safe ? 'safe' : o.danger ? 'danger' : 'neutral';
        drawSealButton(ctx, label, b.x, b.y, { focused: i === focus.index, role, w: b.w, disabled: Array.isArray(o.disabled) && !!o.disabled[i] });
      });
      // lock gauge: a ledger rule that shrinks while input is ignored (no press is ever asked for)
      const gx = lay.panel.x + 12, gw = lay.panel.w - 24, gy = lay.panel.y + lay.panel.h - 7;
      if (lockLeft > 0 && lockMs > 0) {
        ctx.fillStyle = COLORS.paper.rule;
        ctx.fillRect(gx, gy, Math.round(gw * (lockLeft / lockMs)), 1);
        // The default is visible from the first frame: a still, faint cursor on the safe option
        // that wakes (wax red, bobbing) once input is accepted.
        const b = lay.buttons[focus.index];
        if (b) drawText(ctx, TYPE.cursor, b.x - 7, b.y + Math.floor((b.h - TYPE.capH) / 2), { color: COLORS.paper.inkFaint });
      } else {
        focus.drawCursor(ctx, { style: 'paper', ring: false });
      }
      if (lay.note) {
        drawText(ctx, `${ROLE_GLYPH.danger} cannot be undone`, lay.note.x, lay.note.y, { font: 'small', color: PALETTE.r });
      }
    },
  };
  return scene;
}

/**
 * Open a confirm over the current scene and resolve with the chosen index.
 * @param {{scenes: {push: Function, pop: Function}, input?: import('../core/input.js').Input, display?: {width?: number, height?: number}}} G
 * @param {ConfirmOptions} opts
 * @returns {Promise<number>}
 */
export function openConfirm(G, opts) {
  return new Promise((resolve) => {
    const scene = createConfirmScene({
      ...opts,
      width: opts.width || (G.display && G.display.width) || 480,
      height: opts.height || (G.display && G.display.height) || 270,
      input: G.input,
      stack: G.scenes,
      onDone: resolve,
    });
    G.scenes.push(scene);
  });
}

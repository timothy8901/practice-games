/**
 * Controller-first name entry (GDD-09 §3.27), shared by creature naming, a neighbour's nickname
 * counter-offer and (later) the lease card. [SCN-UI]
 *
 * A paper card with the name field (blinking caret), a 10×4 grid of 24×18 keys (A–Z / a–z by
 * Caps, digits, `'` `-` `.`, Space) and a row of wide keys: Caps, Del, Suggest, Done. The d-pad
 * moves through the grid with wrap; `confirm` presses the focused key; `cancel` deletes a letter,
 * and on an empty field backs out (never commits). Touch taps a key (two-step like every menu).
 *
 * Physical keyboards type directly: a printable key types its character, Backspace deletes, Enter
 * finishes, Escape backs out, arrows move the grid cursor. While a keyboard is typing, the action
 * layer's keyboard presses are ignored (Z, X, WASD are letters here), so gamepad and touch keep
 * working side by side.
 *
 * Empty -> `entry.empty`; longer than `maxLen` (10) -> `entry.tooLong`. No DOM at import time.
 * @module scenes/nameEntry
 */
import { drawText, measureText } from '../core/font.js';
import { createFocus, drawDottedRect } from '../ui/focus.js';
import { drawPanel } from '../ui/panel.js';
import { COLORS, PALETTE, TIMING, TYPE } from '../ui/theme.js';
import { t } from '../data/strings.js';

/** Grid columns and rows (GDD-09 §3.27). */
export const COLS = 10;
export const ROWS = 4;
/** Key cell size. */
export const KEY_W = 24;
export const KEY_H = 18;
/** Default maximum length (GDD-09 §3.27 / memory.nicknameMaxLength). */
export const MAX_LEN = 10;

const UPPER = ['ABCDEFGHIJ', 'KLMNOPQRST', "UVWXYZ'-. ", '0123456789'];

/**
 * The 40 grid characters for a case (a space key sits at the end of row three).
 * @param {boolean} caps
 * @returns {string[]}
 */
export function gridChars(caps) {
  const rows = caps ? UPPER : UPPER.map((r, i) => (i < 3 ? r.replace(/[A-Z]/g, (c) => c.toLowerCase()) : r));
  return rows.join('').split('');
}

/**
 * Applies one edit to a name; pure.
 * @param {string} name
 * @param {{type: 'char', ch: string} | {type: 'delete'} | {type: 'set', text: string}} edit
 * @param {number} [maxLen]
 * @returns {{name: string, error: string|null}}
 */
export function editName(name, edit, maxLen = MAX_LEN) {
  const chars = Array.from(name);
  if (edit.type === 'delete') return { name: chars.slice(0, -1).join(''), error: null };
  if (edit.type === 'set') {
    const next = Array.from(String(edit.text ?? '').replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, maxLen).join('');
    return { name: next, error: null };
  }
  const ch = edit.ch;
  if (typeof ch !== 'string' || Array.from(ch).length !== 1 || /[\u0000-\u001f\u007f]/.test(ch)) return { name, error: null };
  if (ch === ' ' && (chars.length === 0 || chars[chars.length - 1] === ' ')) return { name, error: null };
  if (chars.length >= maxLen) return { name, error: t('entry.tooLong', { n: maxLen }) };
  return { name: name + ch, error: null };
}

/**
 * Validates a finished name: trimmed, at least one letter, at most `maxLen`.
 * @param {string} name
 * @param {number} [maxLen]
 * @returns {{ok: true, name: string} | {ok: false, error: string}}
 */
export function finishName(name, maxLen = MAX_LEN) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!clean || !/[\p{L}\p{N}]/u.test(clean)) return { ok: false, error: t('entry.empty') };
  if (Array.from(clean).length > maxLen) return { ok: false, error: t('entry.tooLong', { n: maxLen }) };
  return { ok: true, name: clean };
}

/**
 * @typedef {Object} NameEntryOptions
 * @property {any} input                core/input
 * @property {string} [prompt]          line above the field
 * @property {string} [initial]         starting text
 * @property {string|null} [suggest]    what Suggest fills in (null hides the key's effect: it greys out)
 * @property {number} [maxLen]
 * @property {(name: string) => void} onDone
 * @property {() => void} onCancel
 * @property {(evt: string, payload?: any) => void} [sfx]   ui sound hook (`ui:cursor`, `ui:confirm`, ...)
 * @property {EventTarget|null} [keyTarget]   where physical keys are read (default: globalThis when it has addEventListener)
 * @property {{x: number, y: number}} [origin]   top-left of the card (default 104,26)
 */

/**
 * @param {NameEntryOptions} o
 */
export function createNameEntry(o) {
  const maxLen = o.maxLen ?? MAX_LEN;
  const X = o.origin?.x ?? 104;
  const Y = o.origin?.y ?? 26;
  const card = { x: X, y: Y, w: 272, h: 168 };
  const field = { x: X + 56, y: Y + 26, w: 160, h: 16 };
  const gx = X + 16, gy = Y + 50;
  let caps = true;
  let name = String(o.initial ?? '').slice(0, 64);
  let error = null;
  let errorMs = 0;
  let caretMs = 0;
  let typing = false; // a physical keyboard is typing
  let gridNav = false; // the keyboard last moved the grid cursor (Enter presses the focused key)
  let pressFlash = -1;
  let pressMs = 0;
  /** @type {string[]} */
  const keyQueue = [];
  const sfx = typeof o.sfx === 'function' ? o.sfx : () => {};

  const SPECIAL = [
    { id: 'caps', label: t('entry.caps'), w: 56 },
    { id: 'del', label: t('entry.delete'), w: 48 },
    { id: 'suggest', label: t('entry.suggest'), w: 64 },
    { id: 'done', label: t('entry.done'), w: 56 },
  ];
  const items = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    items.push({ id: `k${i}`, rect: { x: gx + (i % COLS) * KEY_W, y: gy + Math.floor(i / COLS) * KEY_H, w: KEY_W - 2, h: KEY_H - 2 }, enabled: true });
  }
  // the wide keys sit on a fifth row; focus treats them as one row of 10 columns (each spans cells)
  let sx = gx;
  const specialRects = SPECIAL.map((s) => { const r = { x: sx, y: gy + ROWS * KEY_H + 4, w: s.w, h: 16 }; sx += s.w + 8; return r; });
  const focus = createFocus({ items: items.slice(), cols: COLS, wrap: true, index: 0 });
  let row5 = -1; // index into SPECIAL when the cursor is on the wide-key row

  function current() { return name; }

  function flash(err) { error = err; errorMs = 1800; if (err) sfx('ui:blocked'); }

  function apply(edit) {
    const r = editName(name, edit, maxLen);
    name = r.name;
    if (r.error) flash(r.error); else error = null;
  }

  function done() {
    const r = finishName(name, maxLen);
    if (!r.ok) { flash(r.error); return; }
    sfx('ui:confirm');
    o.onDone(r.name);
  }

  function back() {
    if (Array.from(name).length > 0) { apply({ type: 'delete' }); sfx('ui:cancel'); return; }
    sfx('ui:cancel');
    o.onCancel();
  }

  function pressSpecial(id) {
    if (id === 'caps') { caps = !caps; sfx('ui:cursor'); return; }
    if (id === 'del') { apply({ type: 'delete' }); sfx('ui:cancel'); return; }
    if (id === 'suggest') {
      if (typeof o.suggest === 'string' && o.suggest) { apply({ type: 'set', text: o.suggest }); sfx('ui:confirm'); } else flash(null);
      return;
    }
    done();
  }

  function pressKey(i) {
    const ch = gridChars(caps)[i];
    pressFlash = i; pressMs = 100;
    apply({ type: 'char', ch });
    sfx('ui:cursor');
    // after the first capital, drop to lower case like a name is written
    if (caps && /[A-Z]/.test(ch) && Array.from(name).length === 1) caps = false;
  }

  /** @param {KeyboardEvent} ev */
  function onKey(ev) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key;
    const arrows = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' };
    if (arrows[k]) { keyQueue.push(`\x00${arrows[k]}`); ev.preventDefault?.(); return; }
    // Enter finishes the name, unless the arrows were just used to walk the grid (then it presses the key)
    if (k === 'Enter') { keyQueue.push('\r'); ev.preventDefault?.(); return; }
    if (k === 'Backspace') { keyQueue.push('\b'); ev.preventDefault?.(); return; }
    if (k === 'Escape') { keyQueue.push('\x1b'); ev.preventDefault?.(); return; }
    if (typeof k === 'string' && Array.from(k).length === 1) { keyQueue.push(k); typing = true; ev.preventDefault?.(); }
  }

  const target = o.keyTarget !== undefined ? o.keyTarget : (typeof globalThis.addEventListener === 'function' ? globalThis : null);
  let attached = false;

  function attach() {
    if (attached || !target) return;
    target.addEventListener('keydown', onKey, true);
    attached = true;
  }
  function detach() {
    if (!attached || !target) return;
    target.removeEventListener('keydown', onKey, true);
    attached = false;
  }

  function drainKeys() {
    while (keyQueue.length) {
      const k = /** @type {string} */ (keyQueue.shift());
      if (k.startsWith('\x00')) { typing = false; gridNav = true; moveDir(k.slice(1)); continue; }
      if (k === '\r') {
        if (!gridNav) { done(); return true; }
        if (row5 >= 0) pressSpecial(SPECIAL[row5].id); else pressKey(focus.index);
        continue;
      }
      if (k === '\b') { apply({ type: 'delete' }); sfx('ui:cancel'); continue; }
      // Escape backs out one level (Backspace is the keyboard's delete); never commits
      if (k === '\x1b') { typing = false; sfx('ui:cancel'); o.onCancel(); return true; }
      gridNav = false;
      apply({ type: 'char', ch: k });
      sfx('ui:textTick');
    }
    return false;
  }

  /** One grid step: 'U' | 'D' | 'L' | 'R'. */
  function moveDir(d) {
    const dx = d === 'L' ? -1 : d === 'R' ? 1 : 0, dy = d === 'U' ? -1 : d === 'D' ? 1 : 0;
    if (row5 >= 0) { moveRow5(dx, dy); sfx('ui:cursor'); return; }
    const idx = focus.index;
    const r = Math.floor(idx / COLS);
    if ((dy > 0 && r === ROWS - 1) || (dy < 0 && r === 0)) { row5 = specialOfCol(idx % COLS); sfx('ui:cursor'); return; }
    focus.move(dx, dy);
    sfx('ui:cursor');
  }

  /** The column under a wide key, and the wide key over a column. */
  function colOfSpecial(i) {
    const r = specialRects[i];
    return Math.max(0, Math.min(COLS - 1, Math.floor((r.x + r.w / 2 - gx) / KEY_W)));
  }
  function specialOfCol(col) {
    const cx = gx + col * KEY_W + KEY_W / 2;
    let best = 0, bestD = Infinity;
    specialRects.forEach((r, i) => { const d = Math.abs(r.x + r.w / 2 - cx); if (d < bestD) { bestD = d; best = i; } });
    return best;
  }

  function moveRow5(dx, dy) {
    if (dy < 0) { const c = colOfSpecial(row5); row5 = -1; focus.set((ROWS - 1) * COLS + c, { force: true }); return; }
    if (dy > 0) { const c = colOfSpecial(row5); row5 = -1; focus.set(c, { force: true }); return; }
    row5 = (row5 + dx + SPECIAL.length) % SPECIAL.length;
  }

  /**
   * One frame of input. Returns true when the entry finished or backed out this frame.
   * @param {any} input
   */
  function handle(input = o.input) {
    if (drainKeys()) return true;
    // a physical keyboard is read through the key listener above (letters type, arrows move, Enter
    // presses / finishes); the action layer serves the gamepad and the touch overlay
    const kb = input.lastDevice === 'keyboard' && attached;
    const usable = (action) => input.pressed(action) && !kb;
    const rep = (dir) => !kb && input.repeat(dir, { delay: TIMING.repeatDelayMs, rate: TIMING.repeatRateMs });
    const p = input.pointer;
    if (p && p.inside && p.justDown) {
      for (let i = 0; i < SPECIAL.length; i++) {
        const r = specialRects[i];
        if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
          if (row5 === i || p.type !== 'touch') { row5 = i; pressSpecial(SPECIAL[i].id); } else { row5 = i; sfx('ui:cursor'); }
          return false;
        }
      }
      const ev = focus.handle(input);
      if (ev && ev.type === 'activate') { row5 = -1; pressKey(ev.index); }
      else if (ev && (ev.type === 'hover' || ev.type === 'move')) row5 = -1;
      return false;
    }
    for (const [dir, d] of [['left', 'L'], ['right', 'R'], ['up', 'U'], ['down', 'D']]) {
      if (rep(dir)) { typing = false; moveDir(d); break; }
    }
    if (usable('confirm')) { typing = false; if (row5 >= 0) pressSpecial(SPECIAL[row5].id); else pressKey(focus.index); return false; }
    if (usable('cancel')) { back(); return false; }
    if (usable('start')) { done(); return false; }
    return false;
  }

  function update(dt) {
    caretMs = (caretMs + dt) % 1000;
    if (errorMs > 0) { errorMs -= dt; if (errorMs <= 0) error = null; }
    if (pressMs > 0) { pressMs -= dt; if (pressMs <= 0) pressFlash = -1; }
    focus.update(dt);
  }

  function drawKey(ctx, r, label, focused, pressed, opts = {}) {
    const lift = focused && !pressed ? 1 : 0;
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(r.x + 1, r.y + 1, r.w, r.h);
    ctx.fillStyle = pressed ? COLORS.paper.deep : focused ? COLORS.paper.light : COLORS.paper.shade;
    ctx.fillRect(r.x, r.y - lift, r.w, r.h);
    ctx.fillStyle = focused ? COLORS.wax.fill : COLORS.paper.edge;
    ctx.fillRect(r.x, r.y - lift + r.h - 1, r.w, 1);
    const color = opts.dim ? COLORS.paper.inkFaint : opts.wax ? COLORS.wax.fill : COLORS.paper.ink;
    drawText(ctx, label, r.x + Math.floor(r.w / 2), r.y - lift + Math.floor((r.h - TYPE.capH) / 2), { align: 'center', color });
    if (focused) drawDottedRect(ctx, r.x - 2, r.y - lift - 2, r.w + 4, r.h + 4, COLORS.focus.ringOnPaper);
  }

  function draw(ctx) {
    drawPanel(ctx, card, 'paper', { title: o.prompt ? undefined : t('entry.nameCreature') });
    if (o.prompt) drawText(ctx, o.prompt, card.x + card.w / 2, card.y + 9, { align: 'center', color: COLORS.paper.inkSoft, maxWidth: card.w - 16 });
    // field
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(field.x, field.y, field.w, field.h);
    ctx.fillStyle = COLORS.paper.edge;
    ctx.fillRect(field.x, field.y + field.h - 1, field.w, 1);
    const shown = name;
    const m = measureText(shown);
    const tx = field.x + Math.floor((field.w - m.w) / 2);
    drawText(ctx, shown, tx, field.y + 5, { color: COLORS.paper.ink });
    if (caretMs < 520) {
      ctx.fillStyle = COLORS.wax.fill;
      ctx.fillRect(tx + m.w + 1, field.y + 3, 1, 10);
    }
    drawText(ctx, `${Array.from(name).length}/${maxLen}`, field.x + field.w + 6, field.y + 6, { font: 'small', color: COLORS.paper.inkFaint });
    // grid
    const chars = gridChars(caps);
    for (let i = 0; i < chars.length; i++) {
      const r = items[i].rect;
      const ch = chars[i];
      drawKey(ctx, r, ch === ' ' ? '_' : ch, row5 < 0 && focus.index === i && !typing, pressFlash === i);
    }
    for (let i = 0; i < SPECIAL.length; i++) {
      const s = SPECIAL[i];
      const label = s.id === 'caps' ? (caps ? 'abc' : 'ABC') : s.label;
      drawKey(ctx, specialRects[i], label, row5 === i && !typing, false, { wax: s.id === 'done', dim: s.id === 'suggest' && !o.suggest });
    }
    // focus cursor
    const r = row5 >= 0 ? specialRects[row5] : items[focus.index].rect;
    if (!typing) drawText(ctx, TYPE.cursor, r.x - 7, r.y + Math.floor((r.h - TYPE.capH) / 2), { color: COLORS.focus.cursorOnPaper });
    // status line
    const kbHint = gridNav ? 'Arrows + Enter: press key   Esc: back' : 'Type a name. Enter: done   Bksp: delete   Esc: back'; // str
    const status = error ?? (o.input?.lastDevice === 'keyboard' ? kbHint : 'A: press   B: delete   Start: done'); // str
    drawText(ctx, status, card.x + card.w / 2, card.y + card.h - 11, { align: 'center', font: 'small', color: error ? PALETTE.r : COLORS.paper.inkFaint });
  }

  return {
    handle, update, draw, attach, detach,
    get name() { return current(); },
    get typing() { return typing; },
    get caps() { return caps; },
    get error() { return error; },
    /** test helper: type a string as if from the keyboard */
    type(s) { for (const ch of Array.from(String(s))) keyQueue.push(ch); typing = true; gridNav = false; },
    debugText: () => `entry: ${name}`,
  };
}

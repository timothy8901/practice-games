// UI-KIT adversarial cases: degenerate focus lists, huge lists, very long and unicode-heavy text,
// toast overflow against the textbox, theme tokens as strict hex, and the layout regressions found
// in the verifier pass (grid paging, key-glyph widths, ledger rules, danger note).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureText } from '../js/core/font.js';
import { createBus } from '../js/core/events.js';
import { createFocus, navigate, firstEnabled } from '../js/ui/focus.js';
import { createList } from '../js/ui/list.js';
import { createGrid } from '../js/ui/grid.js';
import { createTextbox, paginate } from '../js/ui/textbox.js';
import { createToasts, clampLines, TOAST_MAX_LINES } from '../js/ui/toast.js';
import { PALETTE, COLORS, TYPE_CHIPS, isPureBlackOrWhite } from '../js/ui/theme.js';
import { drawKeyGlyph, keyGlyphWidth } from '../js/ui/widgets.js';
import { drawPanel, LEDGER_RULE_OFFSET, panelInner, tearProfile } from '../js/ui/panel.js';
import { layoutConfirm } from '../js/ui/confirm.js';
import { drawHud } from '../js/ui/hud.js';
import * as pixelart from '../js/core/pixelart.js';
import { fakeInput, fakeCtx, installFakeCanvas } from './ui.fakes.mjs';

installFakeCanvas(pixelart);

// ---------------------------------------------------------------- focus: 0 / 1 / all-disabled
test('focus with zero items: every entry point is a safe no-op', () => {
  const events = [];
  const f = createFocus({ items: [], onChange: (e) => events.push(e), onActivate: (e) => events.push(e) });
  const input = fakeInput();
  assert.equal(f.index, 0);
  assert.equal(f.current(), null);
  for (const a of ['up', 'down', 'left', 'right', 'confirm']) { assert.doesNotThrow(() => f.handle(input.press(a))); input.clear(); }
  assert.equal(f.move(0, 1), null);
  assert.equal(f.activate(), null);
  assert.doesNotThrow(() => f.point(10, 10, 'mouse'));
  assert.doesNotThrow(() => f.set(5));
  assert.doesNotThrow(() => f.drawCursor(fakeCtx()));
  f.update(16);
  assert.deepEqual(events, [], 'nothing fires on an empty list');
  assert.deepEqual(navigate([], 0, 0, 1), { index: 0, moved: false, blocked: null });
  assert.equal(firstEnabled([], 0), -1);
  const cancels = [];
  f.on('cancel', (e) => cancels.push(e));
  f.handle(input.press('cancel'));
  assert.equal(cancels.length, 1, 'cancel still backs out of an empty menu');
  assert.equal(cancels[0].item, null);
});

test('focus with one item: moves never fire, wrap stays put, confirm activates', () => {
  const changes = [];
  const acts = [];
  const f = createFocus({ items: [{ id: 'only', rect: { x: 0, y: 0, w: 10, h: 10 } }], cols: 1, onChange: (e) => changes.push(e), onActivate: (e) => acts.push(e) });
  const input = fakeInput();
  for (const a of ['up', 'down', 'left', 'right']) { f.handle(input.press(a)); input.clear(); }
  assert.equal(f.index, 0);
  assert.deepEqual(changes, []);
  f.handle(input.press('confirm'));
  assert.equal(acts.length, 1);
  assert.equal(acts[0].item.id, 'only');
  const g = createFocus({ items: [{ id: 'only' }], cols: 4 });
  assert.equal(g.move(1, 0), null);
  assert.equal(g.move(0, -1), null);
});

test('focus with every item disabled: nothing activates, every attempt explains why', () => {
  const items = Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, enabled: false, reason: `Locked ${i}`, rect: { x: i * 20, y: 0, w: 18, h: 10 } }));
  const acts = [];
  const blocked = [];
  const f = createFocus({ items, cols: 3, onActivate: (e) => acts.push(e), onBlocked: (e) => blocked.push(e) });
  const input = fakeInput();
  assert.equal(f.index, 0);
  for (const a of ['down', 'right', 'up', 'left']) { f.handle(input.press(a)); input.clear(); }
  assert.equal(f.index, 0, 'the cursor stays put');
  f.handle(input.press('confirm')); input.clear();
  f.point(25, 5, 'mouse');
  f.point(45, 5, 'touch');
  f.point(45, 5, 'touch');
  assert.deepEqual(acts, [], 'a disabled item never activates by any device');
  assert.ok(blocked.length >= 5);
  assert.ok(blocked.every((e) => /^Locked \d$/.test(e.reason)), 'each refusal carries its reason');
  assert.ok(f.tooltip && /^Locked/.test(f.tooltip.text));
  f.setItems(items.map((it) => ({ ...it })));
  assert.equal(f.current().enabled, false);
  f.set(4);
  assert.equal(f.index, 0, 'set() cannot land on a disabled item without force');
  f.set(4, { force: true });
  assert.equal(f.index, 4);
});

test('architecture form: update(dt) reads input once per frame even when handle() is also called', () => {
  const input = fakeInput();
  const changes = [];
  const f = createFocus(input, { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], onChange: (e) => changes.push(e.index) });
  input.press('down');
  const ev = f.update(16);
  assert.equal(ev && ev.type, 'move');
  assert.equal(f.handle(input), null, 'same frame: the press is not processed twice');
  assert.equal(f.index, 1);
  input.clear().press('down');
  f.handle(input);
  assert.equal(f.update(16), null, 'handle-then-update in one frame is also single');
  assert.deepEqual(changes, [1, 2]);
});

// ---------------------------------------------------------------- list with 10k rows
test('list with 10,000 rows: paging, wrap and drawing stay O(visible)', () => {
  const N = 10000;
  const items = Array.from({ length: N }, (_, i) => ({ id: `r${i}`, label: `Row ${i}`, value: i, enabled: i % 97 !== 5, reason: 'Locked' }));
  const t0 = Date.now();
  const list = createList({ rect: { x: 8, y: 8, w: 200, h: 200 }, rowH: 12, items });
  assert.ok(Date.now() - t0 < 1500, 'building is fast');
  const input = fakeInput();
  list.handle(input.press('up')); input.clear();
  assert.equal(list.index, N - 1, 'up from the top wraps to the last row');
  assert.equal(list.top, N - list.visible);
  assert.equal(list.page, list.pages - 1);
  assert.equal(list.focus.items.filter((it) => it.rect).length, list.visible, 'only visible rows are hit-testable');
  list.select(0);
  for (let k = 0; k < 40; k++) list.pageBy(1);
  assert.equal(list.index, 40 * list.visible + (list.items[40 * list.visible].enabled ? 0 : 1));
  for (let k = 0; k < 2000; k++) list.pageBy(1);
  assert.equal(list.index, N - 1, 'paging past the end clamps');
  list.select(5); // disabled row: settles on the next enabled one
  assert.equal(list.index, 6);
  const ctx = fakeCtx();
  list.draw(ctx);
  const small = createList({ rect: { x: 8, y: 8, w: 200, h: 200 }, rowH: 12, items: items.slice(0, 200) });
  small.select(6);
  const ctx2 = fakeCtx();
  small.draw(ctx2);
  assert.ok(Math.abs(ctx.calls.length - ctx2.calls.length) < 40, `10k rows: ${ctx.calls.length} calls vs 200 rows: ${ctx2.calls.length}`);
  assert.equal(list.selected().id, 'r6');
});

test('list: empty, all-disabled and setItems shrinking under the cursor', () => {
  const ctx = fakeCtx();
  const empty = createList({ rect: { x: 0, y: 0, w: 120, h: 80 }, items: [] });
  assert.equal(empty.selected(), null);
  assert.doesNotThrow(() => { empty.pageBy(1); empty.draw(ctx); empty.handle(fakeInput().press('confirm')); });
  const dead = createList({ rect: { x: 0, y: 0, w: 120, h: 80 }, items: Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, enabled: false, reason: 'No' })) });
  assert.doesNotThrow(() => { dead.pageBy(1); dead.pageBy(-1); dead.draw(ctx); });
  const shrink = createList({ rect: { x: 0, y: 0, w: 120, h: 80 }, items: Array.from({ length: 50 }, (_, i) => ({ id: `${i}` })) });
  shrink.select(49);
  shrink.setItems([{ id: 'a' }, { id: 'b' }]);
  assert.equal(shrink.index, 1);
  assert.equal(shrink.top, 0);
});

// ---------------------------------------------------------------- textbox: long and unicode text
const WORDS = 'tide lamp gull harbour ledger brass wick ladder porch kelp salt moon glass ember perch goby'.split(' ');
function paragraph(chars) {
  let s = '';
  let k = 0;
  while (s.length < chars) { s += (s ? ' ' : '') + WORDS[(k * 7 + 3) % WORDS.length] + (k % 11 === 10 ? ',' : k % 17 === 16 ? '.' : ''); k++; }
  return s.slice(0, chars);
}
const squash = (t) => t.replace(/\s+/g, '');

test('textbox: a 2,000-character paragraph pages cleanly, no word past the edge, nothing lost', () => {
  const text = paragraph(2000);
  assert.equal(text.length, 2000);
  const box = createTextbox({ rect: { x: 16, y: 186, w: 448, h: 64 }, speed: 'instant' });
  box.setText(text, { who: 'Wren', portrait: null });
  const T = box.textRect;
  const seen = [];
  for (let guard = 0; guard < 500 && !box.finished; guard++) {
    const lines = box.pageText.split('\n');
    assert.ok(lines.length <= T.maxLines, `page ${box.page} has ${lines.length} lines`);
    for (const l of lines) assert.ok(measureText(l).w <= T.w, `"${l}" is ${measureText(l).w}px > ${T.w}`);
    assert.notEqual(lines[0].trim(), '', 'no page starts blank');
    seen.push(box.pageText);
    box.advance();
  }
  assert.equal(box.finished, true);
  assert.equal(seen.length, box.pages);
  assert.equal(squash(seen.join(' ')), squash(text), 'every character arrives exactly once');
});

test('textbox: unicode symbols and an unbreakable word still fit and type out exactly', () => {
  const longWord = 'Ladderkeepers'.repeat(10);
  const text = `Paid ◉ 1,240 to the Hearth ✦ and left a ♥ on the ledger. ${longWord} ◉◉◉ ✦✦✦ ♥♥♥ — “quotes” … ×3 ★`;
  const box = createTextbox({ rect: { x: 16, y: 186, w: 448, h: 64 }, speed: 'normal' });
  box.setText(text, { portrait: null });
  const T = box.textRect;
  const all = [];
  for (let guard = 0; guard < 50 && !box.finished; guard++) {
    for (const l of box.pageText.split('\n')) assert.ok(measureText(l).w <= T.w, `"${l}" overflows`);
    box.update(10);
    box.skip();
    assert.equal(box.shown, Array.from(box.pageText.replace(/\n/g, '')).length, 'reveal counts code points');
    assert.equal(box.done, true);
    all.push(box.pageText);
    box.advance();
  }
  assert.equal(squash(all.join('')), squash(text));
  for (const w of [8, 16, 33, 61]) {
    for (const p of paginate(text, { maxWidth: w, maxLines: 2 })) for (const l of p.split('\n')) assert.ok(measureText(l).w <= w || Array.from(l).length === 1, `${w}px: "${l}"`);
  }
});

test('textbox: empty, whitespace-only and form-feed-only text never throw or hang', () => {
  const box = createTextbox({ rect: { x: 0, y: 0, w: 200, h: 40 } });
  for (const t of ['', '   ', '\f\f\f', '\n\n\n', undefined, null]) {
    box.setText(t);
    assert.ok(box.pages >= 1);
    let n = 0;
    while (!box.finished && n++ < 20) box.advance();
    assert.equal(box.finished, true, JSON.stringify(t));
  }
});

test('textbox: the choice slip never overlaps the text and flips below when there is no room above', () => {
  const box = createTextbox({ rect: { x: 16, y: 186, w: 448, h: 64 } });
  box.setText('Light it?', { choices: [{ label: 'Yes' }, { label: 'After supper' }, { label: 'No', enabled: false, reason: 'x' }] });
  const C = box.choiceRect;
  assert.ok(C.y + C.h <= 186, 'docked above the box');
  assert.ok(C.x + C.w <= 16 + 448);
  assert.equal(box.textRect.w >= 400, true, 'text keeps the full width on every page');
  const top = createTextbox({ rect: { x: 16, y: 8, w: 448, h: 64 } });
  top.setText('Go?', { choices: [{ label: 'Yes' }, { label: 'No' }] });
  assert.ok(top.choiceRect.y >= 8 + 64, 'a box at the top of the screen opens its choices below');
});

// ---------------------------------------------------------------- toasts vs the textbox
test('toasts: long messages are capped at three lines and the stack never reaches the textbox', () => {
  const t = createToasts({ width: 480, height: 270 });
  const huge = paragraph(600);
  for (let i = 0; i < 8; i++) t.show(huge, { kind: i % 2 ? 'warn' : 'info' });
  const textboxTop = 186;
  const rects = t.rects();
  assert.ok(rects.length >= 1 && rects.length <= 3);
  for (const r of rects) {
    assert.ok(r.y >= t.top);
    assert.ok(r.y + r.h <= textboxTop, `slip ends at ${r.y + r.h}`);
    assert.ok(r.x >= 0 && r.x + r.w <= 480);
  }
  assert.equal(t.count, 8, 'the rest wait their turn');
  const lines = clampLines(huge, 176);
  assert.equal(lines.length, TOAST_MAX_LINES);
  assert.ok(lines[2].endsWith('…'));
  for (const l of lines) assert.ok(measureText(l).w <= 176);
  t.setBottom(120);
  t.clear();
  for (let i = 0; i < 5; i++) t.show(huge);
  for (const r of t.rects()) assert.ok(r.y + r.h <= 120 || t.rects().length === 1);
});

test('toasts subscribe to the bus "toast" event when given G', () => {
  const bus = createBus();
  const t = createToasts({ bus, display: { width: 480, height: 270 } });
  bus.emit('toast', 'Saved 14:02, verified');
  bus.emit('toast', { text: 'Not saved', kind: 'danger', ms: Infinity });
  assert.deepEqual(t.texts(), ['Saved 14:02, verified', 'Not saved']);
  t.destroy();
  bus.emit('toast', 'ignored');
  assert.equal(t.count, 2);
});

// ---------------------------------------------------------------- theme tokens as strict hex
test('theme tokens: every colour is strict #RRGGBB (or a translucent night-ink rgba), never #000/#FFF', () => {
  const HEX = /^#[0-9A-F]{6}$/;
  const RGBA = /^rgba\((\d+), (\d+), (\d+), (0?\.\d+)\)$/;
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (v.startsWith('#')) {
        assert.match(v, HEX, `${path} = ${v}`);
        assert.equal(isPureBlackOrWhite(v), false, path);
      } else {
        const m = RGBA.exec(v);
        assert.ok(m, `${path} = ${v} is neither hex nor rgba`);
        const [r, g, b] = [m[1], m[2], m[3]].map(Number);
        assert.ok(r <= 255 && g <= 255 && b <= 255 && Number(m[4]) < 1);
        assert.ok(!(r === 0 && g === 0 && b === 0) && !(r === 255 && g === 255 && b === 255), path);
      }
    } else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
  };
  walk(PALETTE, 'PALETTE');
  walk(COLORS, 'COLORS');
  for (const [id, c] of Object.entries(TYPE_CHIPS)) { assert.match(c.color, HEX, id); assert.match(c.ink, HEX, id); }
  const palette = new Set(Object.values(PALETTE));
  const semantic = [];
  const collect = (v) => { if (typeof v === 'string' && v.startsWith('#')) semantic.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  collect(COLORS);
  for (const c of semantic) assert.ok(palette.has(c), `semantic token ${c} is not a palette entry`);
  for (const c of Object.values(TYPE_CHIPS)) { assert.ok(palette.has(c.color)); assert.ok(palette.has(c.ink)); }
});

// ---------------------------------------------------------------- verifier-pass regressions
test('grid: paging onto a page whose target cell is disabled lands on that page, not on item 0', () => {
  const items = Array.from({ length: 16 }, (_, i) => ({ id: `t${i}`, enabled: i < 13 }));
  const grid = createGrid({ rect: { x: 0, y: 0 }, cols: 3, rows: 4, cellW: 20, cellH: 20, items });
  grid.select(4);
  grid.pageBy(1);
  assert.equal(grid.page, 1);
  assert.equal(grid.index, 12, 'nearest enabled cell back towards the cursor');
  grid.pageBy(-1);
  assert.equal(grid.index, 0);
  assert.equal(grid.page, 0);
});

test('key glyph widths match what drawKeyGlyph draws, for every device', () => {
  const ctx = fakeCtx();
  for (const d of ['keyboard', 'gamepad', 'touch']) for (const l of ['Z', 'C', 'Tool', 'Esc', 'Start', 'A']) {
    assert.equal(keyGlyphWidth(d, l), drawKeyGlyph(ctx, d, l, 0, 0), `${d} ${l}`);
  }
  assert.doesNotThrow(() => drawHud(ctx, { display: { width: 480, height: 270 } }, { verb: { verb: 'talk', label: 'Talk' }, showClock: false, wallet: -5 }));
});

test('ledger rules clear every descender of text drawn from the content top', () => {
  assert.equal(LEDGER_RULE_OFFSET, 9, 'cap 0-6, descender 7-8, rule on the leading row');
  const ctx = fakeCtx();
  for (const torn of ['top', 'bottom', 'both', 'none']) for (const style of ['paper', 'ledger', 'card', 'notice', 'dark']) {
    assert.doesNotThrow(() => drawPanel(ctx, { x: 4, y: 4, w: 60, h: 40 }, style, { torn, title: 'T', seal: true }));
  }
  assert.deepEqual(panelInner({ x: 0, y: 0, w: 10, h: 10 }, 'ledger'), { x: 6, y: 6, w: 0, h: 0 });
  for (const w of [4, 17, 144, 448]) {
    const p = tearProfile(w, w);
    assert.equal(p.length, w);
    assert.equal(p[0], 1); assert.equal(p[w - 1], 1);
    for (let x = 1; x < w; x++) assert.ok(Math.abs(p[x] - p[x - 1]) <= 1 && p[x] >= 0 && p[x] <= 2, 'torn edge stays connected');
    assert.deepEqual(tearProfile(w, w), p, 'deterministic');
  }
});

test('textbox: a full page leaves the bottom-right corner to the more-arrow and page counter', () => {
  const box = createTextbox({ rect: { x: 16, y: 186, w: 448, h: 64 } });
  box.setText(paragraph(600));
  const T = box.textRect;
  const lastLineBottom = T.y + (T.maxLines - 1) * T.lineH + 9; // cap + descender of the last line
  const markTop = 186 + 64 - 10; // where draw() puts the ▼ and the counter
  assert.ok(lastLineBottom < markTop, `last line ends at ${lastLineBottom}, marks start at ${markTop}`);
  assert.equal(T.maxLines, 4);
});

test('confirm: a destructive confirm puts its note on its own row between body and seals', () => {
  const L = layoutConfirm({ body: 'Release Puddle?', options: ['Release', 'Keep'], danger: true });
  assert.ok(L.note);
  assert.ok(L.note.y >= L.body.y + L.body.h);
  for (const b of L.buttons) assert.ok(L.note.y + L.note.h < b.y, 'note clears the seals');
  assert.equal(layoutConfirm({ body: 'x' }).note, undefined);
});

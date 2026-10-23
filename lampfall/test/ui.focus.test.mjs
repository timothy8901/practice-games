// UI-KIT focus model: wrap, columns, disabled skipping, pointer hover/click and two-step touch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigate, hitTest, layoutIndex, firstEnabled, createFocus } from '../js/ui/focus.js';
import { fakeInput } from './ui.fakes.mjs';

const mk = (n, disabled = [], reason = 'Not yet') =>
  Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    enabled: !disabled.includes(i),
    reason: disabled.includes(i) ? `${reason} ${i}` : undefined,
    rect: { x: (i % 4) * 20, y: Math.floor(i / 4) * 10, w: 18, h: 9 },
  }));

test('layoutIndex maps a flat index to row/col', () => {
  assert.deepEqual(layoutIndex(0, 3), { row: 0, col: 0 });
  assert.deepEqual(layoutIndex(5, 3), { row: 1, col: 2 });
  assert.deepEqual(layoutIndex(7, 1), { row: 7, col: 0 });
});

test('single column: down/up move and wrap; no-wrap clamps', () => {
  const items = mk(4);
  assert.equal(navigate(items, 0, 0, 1).index, 1);
  assert.equal(navigate(items, 3, 0, 1).index, 0, 'wraps bottom -> top');
  assert.equal(navigate(items, 0, 0, -1).index, 3, 'wraps top -> bottom (Save is last)');
  const r = navigate(items, 3, 0, 1, { wrap: false });
  assert.equal(r.index, 3);
  assert.equal(r.moved, false);
  assert.equal(navigate(items, 0, 0, -1, { wrap: false }).index, 0);
});

test('single column: left/right are left to the owner (paging)', () => {
  const r = navigate(mk(4), 1, 1, 0);
  assert.equal(r.moved, false);
  assert.equal(r.index, 1);
});

test('columns: horizontal stays in the row and wraps within it; vertical keeps the column', () => {
  const items = mk(10); // 4 cols: rows [0..3] [4..7] [8,9]
  const o = { cols: 4 };
  assert.equal(navigate(items, 0, 1, 0, o).index, 1);
  assert.equal(navigate(items, 3, 1, 0, o).index, 0, 'right wraps within the row');
  assert.equal(navigate(items, 4, -1, 0, o).index, 7, 'left wraps within the row');
  assert.equal(navigate(items, 8, 1, 0, o).index, 9);
  assert.equal(navigate(items, 9, 1, 0, o).index, 8, 'ragged last row wraps over its own length');
  assert.equal(navigate(items, 1, 0, 1, o).index, 5);
  assert.equal(navigate(items, 5, 0, 1, o).index, 9);
  assert.equal(navigate(items, 6, 0, 1, o).index, 9, 'ragged last row: column 2 clamps to the last cell');
  assert.equal(navigate(items, 1, 0, -1, o).index, 9, 'up from the top row wraps to the bottom row');
  assert.equal(navigate(items, 3, 1, 0, { cols: 4, wrap: false }).index, 3, 'no wrap at the row edge');
});

test('disabled items are skipped in every direction', () => {
  const items = mk(5, [1, 2]);
  assert.equal(navigate(items, 0, 0, 1).index, 3, 'down skips 1 and 2');
  assert.equal(navigate(items, 3, 0, -1).index, 0, 'up skips back over them');
  const grid = mk(8, [1, 5]);
  assert.equal(navigate(grid, 0, 1, 0, { cols: 4 }).index, 2, 'right skips a disabled cell');
  assert.equal(navigate(grid, 1, 0, 1, { cols: 4 }).index, 1, 'column with every other cell disabled is blocked');
});

test('a fully blocked move reports the first disabled item met (for its reason)', () => {
  const items = mk(3, [1, 2]);
  const r = navigate(items, 0, 0, 1, { wrap: false });
  assert.equal(r.moved, false);
  assert.equal(r.index, 0);
  assert.equal(r.blocked.id, 'i1');
  const all = navigate(items, 0, 0, 1); // wrap: every other row is disabled
  assert.equal(all.moved, false);
  assert.equal(all.blocked.reason, 'Not yet 1');
});

test('firstEnabled finds the next enabled index or -1', () => {
  assert.equal(firstEnabled(mk(4, [0, 1])), 2);
  assert.equal(firstEnabled(mk(4, [3]), 3), 0, 'wraps to the start');
  assert.equal(firstEnabled(mk(2, [0, 1])), -1);
});

test('hitTest returns the item under a point, topmost first, ignoring null rects', () => {
  const items = mk(4);
  assert.equal(hitTest(items, 25, 3), 1);
  assert.equal(hitTest(items, 19, 3), -1, 'the 2px gutter between cells is not a hit');
  items[1].rect = null;
  assert.equal(hitTest(items, 25, 3), -1);
});

test('createFocus accepts ({items, cols, wrap}) and (input, opts); starts on an enabled item', () => {
  const f = createFocus({ items: mk(4, [0]), cols: 1, wrap: true });
  assert.equal(f.index, 1, 'a disabled first item is skipped at start');
  const input = fakeInput();
  const g = createFocus(input, { items: mk(3), wrap: false });
  assert.equal(g.wrap, false);
  input.press('down');
  g.handle();
  assert.equal(g.index, 1, 'the bound input is used when handle() gets none');
});

test('d-pad through input.repeat moves focus and fires onChange', () => {
  const seen = [];
  const f = createFocus({ items: mk(4), onChange: (ev) => seen.push([ev.type, ev.index, ev.from]) });
  const input = fakeInput();
  f.handle(input.press('down'));
  f.handle(input.press('down'));
  f.handle(input.press('up'));
  assert.equal(f.index, 1);
  assert.deepEqual(seen, [['move', 1, 0], ['move', 2, 1], ['move', 1, 2]]);
  assert.equal(f.device, 'keyboard');
  const pad = fakeInput({ device: 'gamepad' });
  f.handle(pad.press('down'));
  assert.equal(f.device, 'gamepad');
});

test('confirm activates (callback + item.onActivate); cancel fires onCancel', () => {
  let hit = 0;
  const items = mk(3);
  items[0].onActivate = () => hit++;
  const acts = [];
  let cancels = 0;
  const f = createFocus({ items, onActivate: (ev) => acts.push(ev.item.id), onCancel: () => cancels++ });
  const input = fakeInput();
  const ev = f.handle(input.press('confirm'));
  assert.equal(ev.type, 'activate');
  assert.equal(hit, 1);
  assert.deepEqual(acts, ['i0']);
  f.handle(input.press('cancel'));
  assert.equal(cancels, 1);
});

test('confirm on a disabled item does not activate; it shows the reason tooltip', () => {
  const items = mk(3, [1]);
  const acts = [];
  const blocked = [];
  const f = createFocus({ items, onActivate: () => acts.push(1), onBlocked: (ev) => blocked.push(ev.reason) });
  f.set(1, { force: true });
  assert.equal(f.index, 1);
  f.handle(fakeInput().press('confirm'));
  assert.equal(acts.length, 0);
  assert.deepEqual(blocked, ['Not yet 1']);
  assert.equal(f.tooltip.text, 'Not yet 1');
  f.update(5000);
  assert.equal(f.tooltip, null, 'the tooltip times out');
});

test('a d-pad move blocked by disabled items surfaces the reason', () => {
  const f = createFocus({ items: mk(3, [1, 2]), wrap: false });
  const ev = f.handle(fakeInput().press('down'));
  assert.equal(ev.type, 'blocked');
  assert.equal(f.index, 0);
  assert.equal(f.tooltip.text, 'Not yet 1');
});

test('a pointer resting on the canvas when focus starts does not steal the default', () => {
  const f = createFocus({ items: mk(4), cols: 4, index: 3 });
  const input = fakeInput().move(5, 3); // resting over item 0
  f.handle(input);
  assert.equal(f.index, 3, 'first frame only records the pointer');
  f.handle(input.move(25, 3));
  assert.equal(f.index, 1, 'real movement hovers');
});

test('pointer hover moves focus (pointerActive) and a mouse click activates at once', () => {
  const acts = [];
  const f = createFocus({ items: mk(8), cols: 4, onActivate: (ev) => acts.push(ev.index) });
  const input = fakeInput();
  f.handle(input.move(0, 40)); // prime: resting outside every item
  f.handle(input.move(45, 3)); // item 2
  assert.equal(f.index, 2);
  assert.equal(f.pointerActive, true);
  assert.equal(f.device, 'pointer');
  input.clear();
  f.handle(input.tap(25, 13, 'mouse')); // item 5
  assert.equal(f.index, 5);
  assert.deepEqual(acts, [5], 'mouse click = focus + activate');
  input.clear();
  f.handle(input.press('right'));
  assert.equal(f.pointerActive, false, 'keyboard input hides the hover highlight');
});

test('hovering a disabled item does not move focus but shows its reason', () => {
  const f = createFocus({ items: mk(4, [2]), cols: 4 });
  const input = fakeInput().move(0, 40);
  f.handle(input);
  f.handle(input.move(45, 3));
  assert.equal(f.index, 0);
  assert.equal(f.tooltip.text, 'Not yet 2');
});

test('touch is two-step: first tap focuses, second tap on the same item activates', () => {
  const acts = [];
  const f = createFocus({ items: mk(4), cols: 4, onActivate: (ev) => acts.push(ev.index) });
  const input = fakeInput({ device: 'touch' });
  f.handle(input.tap(65, 3)); // item 3
  assert.equal(f.index, 3);
  assert.equal(acts.length, 0, 'first tap only focuses');
  assert.equal(f.armed, 3);
  assert.equal(f.device, 'touch');
  input.clear();
  f.handle(input.tap(65, 3));
  assert.deepEqual(acts, [3], 'second tap activates');
  input.clear();
  f.handle(input.tap(5, 3)); // item 0: focus moves, not activated
  assert.equal(f.index, 0);
  assert.deepEqual(acts, [3]);
});

test('touch: a tap on the already-focused (but unarmed) item only arms it', () => {
  const acts = [];
  const f = createFocus({ items: mk(4), cols: 4, onActivate: () => acts.push(1) });
  const input = fakeInput({ device: 'touch' });
  f.handle(input.tap(5, 3)); // item 0 is focused by default, but not armed
  assert.equal(acts.length, 0);
  input.clear();
  f.handle(input.tap(5, 3));
  assert.equal(acts.length, 1);
});

test('touch: a d-pad move disarms the two-step', () => {
  const acts = [];
  const f = createFocus({ items: mk(4), cols: 4, onActivate: () => acts.push(1) });
  const input = fakeInput({ device: 'touch' });
  f.handle(input.tap(25, 3));
  input.clear();
  f.handle(input.press('left'));
  input.clear();
  f.handle(input.press('right'));
  input.clear();
  f.handle(input.tap(25, 3));
  assert.equal(acts.length, 0, 'the tap after a d-pad move is a first tap again');
});

test('touch on a disabled item shows the reason and never activates', () => {
  const acts = [];
  const f = createFocus({ items: mk(4, [1]), cols: 4, onActivate: () => acts.push(1) });
  const input = fakeInput({ device: 'touch' });
  f.handle(input.tap(25, 3));
  input.clear();
  f.handle(input.tap(25, 3));
  assert.equal(acts.length, 0);
  assert.equal(f.index, 0);
  assert.equal(f.tooltip.text, 'Not yet 1');
});

test('setItems keeps the focused id and re-settles off disabled items', () => {
  const f = createFocus({ items: mk(5) });
  f.set(3);
  const next = mk(5).reverse();
  f.setItems(next);
  assert.equal(f.current().id, 'i3');
  assert.equal(f.index, 1);
  f.setItems(mk(5, [1]));
  assert.equal(f.index, 3, 'keepId wins: i3 lives at index 3 in the fresh list');
  f.setItems(mk(5, [3]));
  assert.equal(f.index, 4, 'the kept item became disabled: settle on the next enabled one');
});

test('set() skips to the next enabled item unless forced', () => {
  const f = createFocus({ items: mk(4, [2]) });
  f.set(2);
  assert.equal(f.index, 3);
  f.set(2, { force: true });
  assert.equal(f.index, 2);
});

test('empty item lists never throw', () => {
  const f = createFocus({ items: [] });
  assert.equal(f.current(), null);
  assert.equal(f.handle(fakeInput().press('down')), null);
  assert.equal(f.handle(fakeInput().press('confirm')), null);
});

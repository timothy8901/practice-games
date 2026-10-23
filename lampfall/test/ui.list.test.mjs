// UI-KIT list + grid paging maths and widget behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleRows, scrollFor, pageOf, pageCount, createList, PAGER_H } from '../js/ui/list.js';
import { cellRect, pageOf as gridPageOf, pageIndexRange, createGrid } from '../js/ui/grid.js';
import { tabLayout, nextTab, createTabs } from '../js/ui/tabs.js';
import { fakeInput } from './ui.fakes.mjs';

const rows = (n, disabled = []) =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: `Row ${i}`, value: i * 10, enabled: !disabled.includes(i), reason: 'Locked' }));

test('visibleRows: rows that fit after the pager line', () => {
  assert.equal(visibleRows(120, 12), Math.floor((120 - PAGER_H) / 12));
  assert.equal(visibleRows(120, 12, false), 10);
  assert.equal(visibleRows(5, 12), 1, 'never fewer than one row');
});

test('scrollFor keeps the index in view and clamps to the list', () => {
  assert.equal(scrollFor(0, 3, 8, 40), 0);
  assert.equal(scrollFor(0, 8, 8, 40), 1, 'one past the bottom scrolls by one');
  assert.equal(scrollFor(10, 4, 8, 40), 4, 'above the top scrolls up to it');
  assert.equal(scrollFor(0, 39, 8, 40), 32, 'last row: top = n - visible');
  assert.equal(scrollFor(50, 0, 8, 5), 0, 'short list never scrolls');
});

test('pageOf / pageCount', () => {
  assert.equal(pageOf(0, 9), 0);
  assert.equal(pageOf(8, 9), 0);
  assert.equal(pageOf(9, 9), 1);
  assert.equal(pageCount(40, 9), 5);
  assert.equal(pageCount(0, 9), 1);
  assert.equal(pageCount(9, 9), 1);
});

test('list of 40: down scrolls, right pages by a screen, wrap goes to the end', () => {
  const list = createList({ rect: { x: 10, y: 10, w: 160, h: 116 }, rowH: 12, items: rows(40) });
  assert.equal(list.visible, 9);
  assert.equal(list.pages, 5);
  const input = fakeInput();
  for (let i = 0; i < 9; i++) { list.handle(input.press('down')); input.clear(); }
  assert.equal(list.index, 9);
  assert.equal(list.top, 1);
  list.handle(input.press('right'));
  assert.equal(list.index, 18);
  assert.equal(list.page, 2);
  list.handle(input.press('left'));
  list.handle(input.press('left'));
  input.clear();
  assert.equal(list.index, 0);
  list.handle(input.press('up'));
  assert.equal(list.index, 39, 'up from the top wraps to the last row');
  assert.equal(list.top, 31);
  list.handle(input.press('r'));
  assert.equal(list.index, 39, 'paging past the end clamps');
});

test('list: paging onto a disabled row lands on the nearest enabled one', () => {
  const list = createList({ rect: { x: 0, y: 0, w: 160, h: 116 }, rowH: 12, items: rows(40, [9, 10]) });
  list.pageBy(1);
  assert.equal(list.index, 11);
  const all = createList({ rect: { x: 0, y: 0, w: 160, h: 116 }, rowH: 12, items: rows(12, [9, 10, 11]) });
  all.pageBy(1);
  assert.equal(all.index, 8, 'nothing enabled below: nudges back');
});

test('list: confirm selects, cancel calls back, disabled rows refuse', () => {
  const picked = [];
  let cancelled = 0;
  const list = createList({ rect: { x: 0, y: 0, w: 160, h: 60 }, items: rows(5, [1]), onSelect: (it, i) => picked.push([it.id, i]), onCancel: () => cancelled++ });
  const input = fakeInput();
  list.handle(input.press('down'));
  assert.equal(list.index, 2, 'skips the disabled row');
  list.handle(input.press('confirm'));
  list.handle(input.press('cancel'));
  assert.deepEqual(picked, [['r2', 2]]);
  assert.equal(cancelled, 1);
});

test('list: pointer rows only cover visible rows (rects are null off-screen)', () => {
  const list = createList({ rect: { x: 0, y: 0, w: 160, h: 116 }, rowH: 12, items: rows(40) });
  const f = list.focus;
  assert.ok(f.items[0].rect);
  assert.equal(f.items[20].rect, null);
  list.select(20);
  assert.ok(f.items[20].rect);
  assert.equal(f.items[0].rect, null);
});

test('grid paging maths', () => {
  const g = { rect: { x: 10, y: 20 }, cols: 4, rows: 2, cellW: 30, cellH: 20, gap: 2 };
  assert.deepEqual(cellRect(0, g), { x: 10, y: 20, w: 30, h: 20 });
  assert.deepEqual(cellRect(5, g), { x: 42, y: 42, w: 30, h: 20 });
  assert.deepEqual(cellRect(9, g), cellRect(1, g), 'page two reuses page one positions');
  assert.equal(gridPageOf(7, 8), 0);
  assert.equal(gridPageOf(8, 8), 1);
  assert.deepEqual(pageIndexRange(1, 8, 13), { start: 8, end: 13 });
});

test('grid: cursor moves in 2D and the page follows it; L/R jump a page', () => {
  const items = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, label: `C${i}` }));
  const grid = createGrid({ rect: { x: 0, y: 0 }, cols: 4, rows: 2, cellW: 30, cellH: 20, items });
  const input = fakeInput();
  grid.handle(input.press('right'));
  grid.handle(input.press('down'));
  assert.equal(grid.index, 5);
  assert.equal(grid.page, 0);
  grid.handle(input.press('down'));
  assert.equal(grid.index, 9);
  assert.equal(grid.page, 1, 'moving onto row 3 shows page 2');
  grid.handle(input.press('l'));
  assert.equal(grid.index, 1);
  assert.equal(grid.page, 0);
  assert.equal(grid.pages, 2);
});

test('tabs: layout, wrap, L/R and pointer', () => {
  const tabs = [{ id: 'a', label: 'Fish' }, { id: 'b', label: 'Bugs' }, { id: 'c', label: 'Relics' }];
  const lay = tabLayout(tabs, { x: 0, w: 200 });
  assert.equal(lay.length, 3);
  assert.ok(lay[1].x > lay[0].x + lay[0].w - 1);
  assert.equal(nextTab(['a', 'b', 'c'], 'c', 1), 'a');
  assert.equal(nextTab(['a', 'b', 'c'], 'a', -1), 'c');
  const changes = [];
  const t = createTabs({ tabs, rect: { x: 0, y: 0, w: 200 }, onChange: (id, prev) => changes.push(`${prev}>${id}`) });
  const input = fakeInput();
  t.handle(input.press('r'));
  t.handle(input.press('l'));
  t.handle(input.press('l'));
  input.clear();
  assert.equal(t.active, 'c');
  t.handle(input.tap(lay[1].x + 2, 4, 'mouse'));
  assert.equal(t.active, 'b');
  assert.deepEqual(changes, ['a>b', 'b>a', 'a>c', 'c>b']);
});

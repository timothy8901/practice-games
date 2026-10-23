// UI-KIT textbox: measured pagination, beat pauses, typing, skip/advance and choices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate, beatFor, createTextbox } from '../js/ui/textbox.js';
import { measureText } from '../js/core/font.js';
import { TEXT_SPEEDS, TIMING } from '../js/ui/theme.js';
import { fakeInput } from './ui.fakes.mjs';

const LONG = 'The lamp on the Hearth porch has been dark since the storm. Wren says the wick is fine, ' +
  'the oil is fine, and the glass is only a little sooty. Still, nobody has managed to light it, and the ' +
  'gulls have started roosting on the rail as if they know. Will you take a look before the tide comes in?';

test('paginate: every page fits maxLines and every line fits maxWidth', () => {
  for (const maxWidth of [120, 200, 300]) {
    for (const maxLines of [1, 2, 3, 4]) {
      const pages = paginate(LONG, { maxWidth, maxLines });
      for (const p of pages) {
        const lines = p.split('\n');
        assert.ok(lines.length <= maxLines, `${lines.length} > ${maxLines}`);
        for (const l of lines) assert.ok(measureText(l).w <= maxWidth, `"${l}" wider than ${maxWidth}`);
      }
      // no word is lost or duplicated
      const words = pages.join(' ').split(/\s+/).filter(Boolean);
      assert.deepEqual(words, LONG.split(/\s+/));
    }
  }
});

test('paginate: fewer lines per page means more pages; short text is one page', () => {
  const a = paginate(LONG, { maxWidth: 200, maxLines: 3 }).length;
  const b = paginate(LONG, { maxWidth: 200, maxLines: 1 }).length;
  assert.ok(b > a);
  assert.deepEqual(paginate('Hi.', { maxWidth: 200, maxLines: 3 }), ['Hi.']);
  assert.deepEqual(paginate('', { maxWidth: 200, maxLines: 3 }), ['']);
});

test('paginate: \\f forces a page break and blank lines never start a page', () => {
  const pages = paginate('One.\fTwo.\f\nThree.', { maxWidth: 200, maxLines: 3 });
  assert.deepEqual(pages, ['One.', 'Two.', 'Three.']);
});

test('paginate: the number of pages equals ceil(wrapped lines / maxLines)', () => {
  const lines = paginate(LONG, { maxWidth: 160, maxLines: 1000 })[0].split('\n').length;
  assert.equal(paginate(LONG, { maxWidth: 160, maxLines: 3 }).length, Math.ceil(lines / 3));
});

test('beatFor: commas pause short, stops pause long, runs of punctuation pause once', () => {
  assert.equal(beatFor('a', 'b'), 0);
  assert.equal(beatFor(',', ' '), TIMING.beatCommaMs);
  assert.equal(beatFor('.', ' '), TIMING.beatStopMs);
  assert.equal(beatFor('.', '.'), 0, 'mid-ellipsis: wait for the last dot');
  assert.equal(beatFor('?', '!'), 0);
  assert.equal(beatFor('.', ' ', TEXT_SPEEDS.instant), 0, 'instant never pauses');
  assert.ok(beatFor('.', ' ', TEXT_SPEEDS.slow) > beatFor('.', ' ', TEXT_SPEEDS.fast), 'slower text pauses longer');
});

test('typing reveals characters at the speed, with a beat after a comma', () => {
  const box = createTextbox({ rect: { x: 0, y: 0, w: 300, h: 50 }, speed: 'normal' });
  box.setText('Ab, cd.');
  assert.equal(box.shown, 0);
  box.update(1000 / TEXT_SPEEDS.normal * 3 + 1); // 'A', 'b', ','
  assert.equal(box.shown, 3);
  box.update(TIMING.beatCommaMs - 5);
  assert.equal(box.shown, 3, 'held on the comma beat');
  box.update(10 + 1000 / TEXT_SPEEDS.normal);
  assert.ok(box.shown >= 4);
  box.update(5000);
  assert.equal(box.done, true);
});

test('confirm while typing skips to the end of the page; then advances; then finishes', () => {
  let done = 0;
  const box = createTextbox({ rect: { x: 0, y: 0, w: 200, h: 34 }, speed: 'slow', onDone: () => done++ });
  box.setText(LONG);
  assert.ok(box.pages > 2);
  const input = fakeInput();
  box.handle(input.press('confirm'));
  assert.equal(box.done, true, 'skip');
  assert.equal(box.page, 0);
  box.handle(input.press('confirm'));
  assert.equal(box.page, 1, 'advance');
  assert.equal(box.shown, 0, 'new page starts typing from zero');
  while (box.page < box.pages - 1) { box.skip(); box.advance(); }
  box.skip();
  assert.equal(box.advance(), false, 'last page: finished');
  assert.equal(box.finished, true);
  assert.equal(done, 1);
  box.advance();
  assert.equal(done, 1, 'onDone fires once');
});

test('instant speed shows each page at once; setSpeed switches live', () => {
  const box = createTextbox({ rect: { x: 0, y: 0, w: 200, h: 34 }, speed: 'instant' });
  box.setText(LONG);
  assert.equal(box.done, true);
  box.setSpeed('fast');
  box.advance();
  assert.equal(box.done, false);
  box.setSpeed('instant');
  assert.equal(box.done, true);
});

test('portrait slot narrows the text column (more pages)', () => {
  const a = createTextbox({ rect: { x: 0, y: 0, w: 300, h: 50 } });
  a.setText(LONG);
  const b = createTextbox({ rect: { x: 0, y: 0, w: 300, h: 50 } });
  b.setText(LONG, { portrait: null, who: 'Wren' });
  assert.ok(b.pages >= a.pages);
  assert.equal(b.who, 'Wren');
});

test('choices appear after the last page and resolve through the focus model', () => {
  const picks = [];
  const box = createTextbox({ rect: { x: 0, y: 0, w: 320, h: 50 }, onChoice: (i) => picks.push(i) });
  box.setText('Light the lamp?', { choices: [{ label: 'Yes' }, { label: 'Not yet' }], cancelIndex: 1, defaultChoice: 1 });
  const input = fakeInput();
  box.skip();
  assert.equal(box.choicesUp, true);
  assert.equal(box.choiceFocus.index, 1, 'default choice holds the cursor');
  box.handle(input.press('confirm'));
  assert.deepEqual(picks, [], 'a mashed confirm right as the choices appear is swallowed');
  box.update(300);
  input.clear();
  box.handle(input.press('up'));
  box.handle(input.press('confirm'));
  assert.deepEqual(picks, [0]);
  assert.equal(box.finished, true);
  box.setText('Again?', { choices: [{ label: 'Yes' }, { label: 'No' }], cancelIndex: 1 });
  box.skip();
  box.update(0); box.update(300);
  box.handle(input.press('cancel'));
  assert.deepEqual(picks, [0, 1], 'cancel picks the cancel index');
});


test('holding confirm fast-forwards typing (x4) without skipping the page', () => {
  const a = createTextbox({ rect: { x: 0, y: 0, w: 300, h: 50 }, speed: 'slow' });
  const b = createTextbox({ rect: { x: 0, y: 0, w: 300, h: 50 }, speed: 'slow' });
  a.setText('abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz');
  b.setText('abcdefghijklmnopqrstuvwxyz abcdefghijklmnopqrstuvwxyz');
  const input = fakeInput().hold('confirm', 400);
  b.handle(input);
  assert.equal(b.fastForward, true);
  a.update(200); b.update(200);
  assert.ok(b.shown >= a.shown * 3, `${b.shown} vs ${a.shown}`);
  assert.equal(b.done, false);
});

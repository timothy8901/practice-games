// UI-KIT theme tokens, icons and the small widgets: palette law, 4px grid, type chips, explicit-state
// strings, confirm lock, toast queue and tool-ring maths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PALETTE, COLORS, TYPE_CHIPS, TYPE_IDS, STRINGS, ROLE_GLYPH, ROLE_ICON, SPACE, GRID, TIMING, TEXT_SPEEDS,
  allColors, isPureBlackOrWhite, normalizeHexToken, snap, surfaceFor,
} from '../js/ui/theme.js';
import { ICON_ART, ICON_NAMES, VERB_ICONS, SEAL_ART, sealRows, PORTRAIT_PLACEHOLDER_ART, hasIcon } from '../js/ui/icons.js';
import { hasGlyph } from '../js/core/font.js';
import { formatNumber, barFill, hpBand, BAR_TEXTURE, wardShimmerFrame } from '../js/ui/widgets.js';
import { tearDepth, panelInner } from '../js/ui/panel.js';
import { createConfirmScene, layoutConfirm, openConfirm } from '../js/ui/confirm.js';
import { createToasts } from '../js/ui/toast.js';
import { socketFromDir, socketFromAngle, socketPos, createToolRing, SOCKETS } from '../js/ui/toolRing.js';
import { tideWord } from '../js/ui/hud.js';
import { fakeInput } from './ui.fakes.mjs';

test('no pure black or pure white anywhere in the theme', () => {
  const colors = allColors();
  assert.ok(colors.length > 30);
  for (const c of colors) assert.equal(isPureBlackOrWhite(c), false, c);
  assert.equal(isPureBlackOrWhite('#fff'), true);
  assert.equal(isPureBlackOrWhite('#000000ff'), true);
  assert.equal(normalizeHexToken('#abc'), '#AABBCC');
});

test('bible hexes are the ones the art bibles name', () => {
  assert.equal(PALETTE.ledgerPaper, '#F4F1E6');
  assert.equal(PALETTE.ledgerRule, '#C9A77C');
  assert.equal(PALETTE.waxRed, '#A8323A');
  assert.equal(PALETTE.brass, '#D9A441');
  assert.equal(PALETTE.nightInk, '#141B33');
  assert.equal(PALETTE.paperLightest, '#F6F1E3');
  assert.equal(PALETTE.deskInk, '#2A2433');
  assert.equal(PALETTE.n, '#29366F');
  assert.equal(PALETTE.v, '#94B0C2');
  assert.equal(COLORS.dark.fill, PALETTE.n, 'dark panel = n fill');
  assert.equal(COLORS.dark.border, PALETTE.v, 'with a 1px v border');
  assert.equal(COLORS.role.safe, PALETTE.g);
  assert.equal(COLORS.role.warn, PALETTE.o);
  assert.equal(COLORS.role.danger, PALETTE.r);
  assert.equal(COLORS.role.disabled, PALETTE.e);
});

test('comet magenta (m) is reserved: no type chip uses it', () => {
  for (const id of TYPE_IDS) {
    assert.notEqual(TYPE_CHIPS[id].color, PALETTE.m, id);
    assert.notEqual(TYPE_CHIPS[id].ink, PALETTE.m, id);
  }
});

test('spacing sits on the 4px grid (hairline insets excepted)', () => {
  assert.equal(GRID, 4);
  for (const [k, v] of Object.entries(SPACE)) {
    if (k === 'hair' || k === 'xs') continue;
    assert.equal(v % GRID, 0, k);
  }
  assert.equal(snap(5), 4);
  assert.equal(snap(7), 8);
  assert.equal(snap(1), 4);
});

test('13 type chips: unique 3-letter codes, words and unique icons that exist', () => {
  assert.equal(TYPE_IDS.length, 13);
  const codes = new Set(), icons = new Set(), art = new Set();
  for (const id of TYPE_IDS) {
    const c = TYPE_CHIPS[id];
    assert.match(c.code, /^[A-Z]{3}$/);
    assert.ok(c.word.length > 2);
    assert.ok(hasIcon(c.icon), c.icon);
    codes.add(c.code); icons.add(c.icon); art.add(ICON_ART[c.icon].join('|'));
  }
  assert.equal(codes.size, 13);
  assert.equal(icons.size, 13);
  assert.equal(art.size, 13, 'every type icon is a distinct silhouette');
  assert.deepEqual([...codes].sort(), ['BLT', 'BRN', 'GLS', 'GRT', 'GST', 'HLW', 'KLN', 'MOS', 'PLN', 'RIM', 'RST', 'STN', 'STR']);
});

test('explicit-state strings are exact (wildshift §18.3)', () => {
  assert.equal(STRINGS.unknown, '???');
  assert.equal(STRINGS.empty, 'EMPTY');
  assert.equal(STRINGS.wardUnknown, 'Ward ?');
  assert.equal(STRINGS.wardKnown, 'Ward: known');
  assert.equal(STRINGS.notSaved, 'Not saved');
  assert.equal(STRINGS.mendsUnknown, 'Mends ?');
  assert.equal(STRINGS.noAnchor, 'No anchor stones');
});

test('every role has a font glyph AND an icon, so no role is colour alone', () => {
  for (const [role, g] of Object.entries(ROLE_GLYPH)) {
    for (const ch of g) assert.ok(hasGlyph(ch), `${role}: '${ch}' has no font glyph`);
    assert.ok(hasIcon(ROLE_ICON[role]), `${role}: icon ${ROLE_ICON[role]}`);
  }
});

test('timing: 0.5 s input lock, 3 s toasts, 220 ms tool-ring hold; text speeds ascend', () => {
  assert.equal(TIMING.inputLockMs, 500);
  assert.equal(TIMING.toastMs, 3000);
  assert.equal(TIMING.toolRingHoldMs, 220);
  assert.ok(TEXT_SPEEDS.slow < TEXT_SPEEDS.normal && TEXT_SPEEDS.normal < TEXT_SPEEDS.fast);
  assert.equal(TEXT_SPEEDS.instant, Infinity);
});

test('surfaceFor gives distinct ink for paper and dark panels', () => {
  assert.notEqual(surfaceFor('paper').text, surfaceFor('dark').text);
  assert.equal(surfaceFor('dark').dark, true);
});

test('icons: every icon is 8x8 using only . # o w; the required families exist', () => {
  for (const name of ICON_NAMES) {
    const rows = ICON_ART[name];
    assert.equal(rows.length, 8, name);
    for (const r of rows) {
      assert.equal(r.length, 8, `${name}: "${r}"`);
      assert.match(r, /^[.#ow]+$/, name);
    }
  }
  const required = [...VERB_ICONS, 'key', 'button', 'tap', 'pad', 'keyboard', 'glint', 'bars', 'wiggle', 'sun', 'moon', 'clock',
    'tideUp', 'tideDown', 'burn', 'poison', 'chill', 'numb', 'heartmark', 'ward', 'wardKnown', 'check', 'cross', 'lock', 'strike'];
  for (const r of required) assert.ok(hasIcon(r), r);
  assert.equal(VERB_ICONS.length, 8);
  assert.equal(SEAL_ART.length, 11);
  for (const r of sealRows('check')) assert.equal(r.length, 11);
  assert.notDeepEqual(sealRows('check'), sealRows('cross'));
  assert.equal(PORTRAIT_PLACEHOLDER_ART.length, 32);
});

test('widgets maths: thousands, bar fill never empty for > 0, hp bands, textures differ per kind', () => {
  assert.equal(formatNumber(1240), '1,240');
  assert.equal(formatNumber(-1234567), '-1,234,567');
  assert.equal(formatNumber(999), '999');
  assert.equal(barFill(1, 1000, 40), 1);
  assert.equal(barFill(0, 10, 40), 0);
  assert.equal(barFill(10, 10, 40), 40);
  assert.equal(barFill(20, 10, 40), 40);
  assert.equal(hpBand(51, 100), 'full');
  assert.equal(hpBand(50, 100), 'low');
  assert.equal(hpBand(20, 100), 'crit');
  const kinds = new Set([BAR_TEXTURE.hp, BAR_TEXTURE.exp, BAR_TEXTURE.glow, BAR_TEXTURE.bond]);
  assert.ok(kinds.size >= 3, 'bars are told apart by texture, not only colour');
  assert.notEqual(BAR_TEXTURE.hp, BAR_TEXTURE.hpCrit, 'low HP changes texture too');
});

test('ward shimmer: 6 frames over 800 ms, every 4 s', () => {
  assert.equal(wardShimmerFrame(0), 0);
  assert.equal(wardShimmerFrame(799), 5);
  assert.equal(wardShimmerFrame(1000), -1);
  assert.equal(wardShimmerFrame(4000), 0);
  assert.equal(wardShimmerFrame(4400), 3);
});

test('panel helpers: inner rect per style, deterministic torn edge', () => {
  assert.deepEqual(panelInner({ x: 0, y: 0, w: 100, h: 50 }, 'paper'), { x: 6, y: 6, w: 88, h: 38 });
  for (let x = 0; x < 50; x++) {
    const d = tearDepth(x, 7);
    assert.ok(d >= 0 && d <= 2);
    assert.equal(d, tearDepth(x, 7));
  }
});

test('hud: tide word reads low / rising / falling / high', () => {
  assert.equal(tideWord(0.1), 'low');
  assert.equal(tideWord(0.5, 'rising'), 'rising');
  assert.equal(tideWord(0.5, 'falling'), 'falling');
  assert.equal(tideWord(0.95), 'high');
});

test('confirm: cursor starts on the safe default, input ignored for the 0.5 s lock, cancel = safe', () => {
  const done = [];
  const input = fakeInput();
  const scene = createConfirmScene({ body: 'Use the Old Key? You have only one.', options: ['Yes', 'No'], onDone: (i) => done.push(i), input });
  scene.enter();
  assert.equal(input.flushed, 1, 'entering flushes held/buffered input');
  assert.equal(scene.index, 1, 'default = the last option (No)');
  scene.handleInput(input.press('left'));
  scene.handleInput(input.press('confirm'));
  assert.deepEqual(done, [], 'locked: nothing registers');
  scene.update(499);
  scene.handleInput(input.press('confirm'));
  assert.deepEqual(done, []);
  scene.update(2);
  assert.equal(scene.locked, false);
  scene.handleInput(input.press('confirm'));
  assert.deepEqual(done, [1], 'confirm on the untouched default picks the safe option');
  const s2 = createConfirmScene({ body: 'Release?', options: ['Release', 'Keep'], defaultIndex: 1, lockMs: 0, onDone: (i) => done.push(i) });
  s2.handleInput(input.press('cancel'));
  assert.deepEqual(done, [1, 1], 'cancel resolves to the safe option');
  const s3 = createConfirmScene({ body: 'Overwrite?', options: ['Overwrite', 'Cancel'], defaultIndex: 1, lockMs: 0, onDone: (i) => done.push(i) });
  s3.handleInput(input.press('left'));
  s3.handleInput(input.press('confirm'));
  assert.deepEqual(done, [1, 1, 0]);
  s3.handleInput(input.press('confirm'));
  assert.equal(done.length, 3, 'resolves once');
});

test('openConfirm pushes a non-opaque scene and resolves when it pops', async () => {
  const stack = [];
  const G = { input: fakeInput(), scenes: { push: (s) => { stack.push(s); s.enter && s.enter(); }, pop: () => stack.pop() } };
  const p = openConfirm(G, { title: 'Save', body: 'Overwrite slot 1?', options: ['Overwrite', 'Cancel'], defaultIndex: 1 });
  assert.equal(stack.length, 1);
  assert.equal(stack[0].opaque, false);
  stack[0].update(600);
  stack[0].handleInput(G.input.press('confirm'));
  assert.equal(await p, 1);
  assert.equal(stack.length, 0);
});

test('confirm: a mouse resting over the risky option does not move the safe default', () => {
  const done = [];
  const input = fakeInput();
  const scene = createConfirmScene({ body: 'Release?', options: ['Release', 'Keep'], defaultIndex: 1, lockMs: 0, onDone: (i) => done.push(i) });
  const b = layoutConfirm({ body: 'Release?', options: ['Release', 'Keep'] }).buttons[0];
  input.move(b.x + 2, b.y + 2);
  scene.handleInput(input);
  assert.equal(scene.index, 1);
  scene.handleInput(input.press('confirm'));
  assert.deepEqual(done, [1]);
});

test('tool ring: a resting pointer does not aim the ring when it opens', () => {
  const ring = createToolRing({ tools: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], current: 'a', center: { x: 100, y: 100 } });
  const input = fakeInput().move(60, 100); // left of centre = socket 6
  ring.openRing();
  ring.handle(input);
  assert.equal(ring.focusIndex, 0);
  ring.handle(input.move(100, 60));
  assert.equal(ring.focusIndex, 0, 'moving up aims socket 0');
  ring.handle(input.move(140, 100));
  assert.equal(ring.focusIndex, 2);
});

test('confirm layout: buttons inside the panel, centred on screen', () => {
  const L = layoutConfirm({ body: 'Release Puddle? This cannot be undone.', options: ['Release', 'Keep'] });
  assert.ok(L.panel.x > 0 && L.panel.x + L.panel.w < 480);
  for (const b of L.buttons) {
    assert.ok(b.x >= L.panel.x && b.x + b.w <= L.panel.x + L.panel.w);
    assert.ok(b.y + b.h <= L.panel.y + L.panel.h);
  }
});

test('toasts: queue, 3 s each, max 3 visible, sticky until dismissed, never reads input', () => {
  const t = createToasts();
  t.show('one'); t.show('two'); t.show('three'); t.show('four');
  assert.equal(t.visible, 3);
  assert.equal(t.count, 4);
  t.update(2999);
  assert.equal(t.visible, 3);
  t.update(2);
  assert.equal(t.visible, 1, 'the first three expire together; the fourth takes a slot');
  assert.deepEqual(t.texts(), ['four']);
  const id = t.show('Not saved', { kind: 'danger', ms: Infinity });
  t.update(60000);
  assert.deepEqual(t.texts(), ['Not saved']);
  assert.equal(t.dismiss(id), true);
  assert.equal(t.count, 0);
  t.push('shim name works', { color: '#f00' });
  assert.deepEqual(t.texts(), ['shim name works']);
  assert.equal(createToasts({ display: { width: 640 } }).show('x') > 0, true, 'accepts G');
});

test('tool ring maths: directions and angles map to 8 sockets clockwise from up', () => {
  assert.equal(SOCKETS, 8);
  assert.equal(socketFromDir(0, -1), 0);
  assert.equal(socketFromDir(1, -1), 1);
  assert.equal(socketFromDir(1, 0), 2);
  assert.equal(socketFromDir(0, 1), 4);
  assert.equal(socketFromDir(-1, 0), 6);
  assert.equal(socketFromDir(-1, -1), 7);
  assert.equal(socketFromDir(0, 0), -1);
  assert.equal(socketFromAngle(-Math.PI / 2 + 0.3), 0);
  assert.deepEqual(socketPos(0, 100, 100, 30), { x: 100, y: 70 });
  assert.deepEqual(socketPos(2, 100, 100, 30), { x: 130, y: 100 });
});

test('tool ring: hold >= 220 ms opens, release equips the focused socket; tap swaps last two; cancel changes nothing', () => {
  const tools = [{ id: 'net', name: 'Net', icon: 'shake' }, { id: 'rod', name: 'Rod', icon: 'fish' }, null, { id: 'spade', name: 'Spade', icon: 'dig' }];
  const log = [];
  const ring = createToolRing({ tools, current: 'net', last: 'rod', onEquip: (id) => log.push(`equip ${id}`), onSwap: (c, l) => log.push(`swap ${c}/${l}`), onCancel: () => log.push('cancel') });
  const input = fakeInput();
  // tap: press then release before the hold threshold
  ring.handle(input.press('tool').hold('tool', 16));
  input.clear();
  ring.handle(input.hold('tool', 120));
  ring.handle(input.release('tool'));
  assert.equal(ring.open, false);
  assert.equal(ring.current, 'rod');
  assert.equal(ring.last, 'net');
  // hold to open, push right (socket 2 is empty) then down-right... choose socket 1 via up-right
  input.clear();
  ring.handle(input.press('tool').hold('tool', 16));
  input.clear();
  ring.handle(input.hold('tool', 230));
  assert.equal(ring.open, true);
  ring.handle(input.hold('right', 16).hold('up', 16));
  assert.equal(ring.focusIndex, 1);
  input.unhold('right').unhold('up');
  ring.handle(input.release('tool'));
  assert.equal(ring.open, false);
  assert.equal(ring.current, 'rod', 'socket 1 is the rod (already equipped): no change');
  // open again and cancel
  input.clear();
  ring.openRing();
  ring.focusSocket(3);
  ring.handle(input.press('cancel'));
  assert.equal(ring.open, false);
  assert.equal(ring.current, 'rod', 'cancel never changes the tool');
  // open and equip the spade with confirm (touch path)
  ring.openRing();
  ring.focusSocket(3);
  input.clear();
  ring.handle(input.press('confirm'));
  assert.equal(ring.current, 'spade');
  assert.equal(ring.last, 'rod');
  assert.deepEqual(log, ['swap rod/net', 'cancel', 'equip spade']);
  ring.update(200);
  assert.equal(ring.anim, 0, 'closed ring animates shut');
});

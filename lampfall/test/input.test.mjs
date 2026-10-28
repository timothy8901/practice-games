// Unit tests for js/core/input.js. Runs under plain Node (no DOM): the module is driven with
// fake EventTargets, a fake document for the touch overlay, a fake navigator for gamepads and
// an injected clock so every timing assertion is deterministic.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, ANY_KEY, BINDINGS_VERSION, DEFAULT_BINDINGS, DEVICES, TOUCH_TOKENS,
  createInput, detectTouchPreference, dpadDirections, parseBindings,
  tokenDevice, tokenFromKeyEvent, tokenLabel,
} from '../js/core/input.js';

// ---------------------------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------------------------

const evt = (type, props = {}) => Object.assign(new Event(type, { cancelable: true, bubbles: true }), props);

class FakeCanvas extends EventTarget {
  constructor() {
    super();
    this.width = 960;
    this.height = 540;
    this.style = {};
    this.rect = { left: 10, top: 20, width: 960, height: 540 };
    this.captured = [];
  }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.push(id); }
}

class FakeClassList {
  constructor() { this.set = new Set(); }
  add(c) { this.set.add(c); }
  remove(c) { this.set.delete(c); }
  contains(c) { return this.set.has(c); }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(c) : Boolean(force);
    if (on) this.set.add(c); else this.set.delete(c);
    return on;
  }
}

class FakeElement extends EventTarget {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.classList = new FakeClassList();
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this.id = '';
    this.rect = { left: 0, top: 0, width: 100, height: 100 };
    this.captures = [];
  }
  get className() { return [...this.classList.set].join(' '); }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captures.push(id); }
  find(pred) {
    for (const c of this.children) {
      if (pred(c)) return c;
      const inner = c.find(pred);
      if (inner) return inner;
    }
    return null;
  }
}

class FakeDocument extends EventTarget {
  constructor() {
    super();
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.hidden = false;
    this.visibilityState = 'visible';
  }
  createElement(tag) { return new FakeElement(tag); }
  getElementById(id) { return this.head.find((e) => e.id === id) || this.body.find((e) => e.id === id); }
}

function makeGamepad(overrides = {}) {
  return {
    connected: true,
    mapping: 'standard',
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0],
    ...overrides,
  };
}

/** Build an input with fakes. `touch` defaults to false; pass `touch: true|'auto'` for overlay tests. */
function harness(opts = {}) {
  const target = new EventTarget();
  const canvas = new FakeCanvas();
  const doc = new FakeDocument();
  const pads = [];
  const nav = {
    maxTouchPoints: 0,
    getGamepads: () => pads,
    vibrateCalls: [],
    vibrate(ms) { this.vibrateCalls.push(ms); return true; },
  };
  const clock = { t: 0 };
  const display = { toGame: (cx, cy) => ({ x: (cx - 10) / 2, y: (cy - 20) / 2 }) };
  const input = createInput({
    canvas, display, target, doc, nav, now: () => clock.t, touch: false, search: '', ...opts,
  });
  const key = (type, code, extra = {}) => {
    const e = evt(type, { code, ...extra });
    target.dispatchEvent(e);
    return e;
  };
  const press = (code, extra) => key('keydown', code, extra);
  const release = (code, extra) => key('keyup', code, extra);
  const tick = (ms = 16) => { clock.t += ms; input.update(); };
  const at = (t) => { clock.t = t; input.update(); };
  const overlayRoot = () => doc.body.children.find((c) => c.classList.contains('wsp-touch')) || null;
  const overlayPart = (cls) => { const root = overlayRoot(); return root ? root.find((e) => e.classList.contains(cls)) : null; };
  return { input, target, canvas, doc, nav, pads, clock, display, key, press, release, tick, at, overlayRoot, overlayPart };
}

const ALL_ACTIONS = [...ACTIONS, ANY_KEY];
const activeActions = (input, fn) => ALL_ACTIONS.filter((a) => input[fn](a));

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

describe('constants', () => {
  it('lists the sixteen contract actions (anyKey virtual) and is frozen', () => {
    assert.deepEqual([...ACTIONS], ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu', 'run', 'tool', 'map', 'log', 'start', 'select', 'l', 'r']);
    assert.equal(ANY_KEY, 'anyKey');
    assert.ok(Object.isFrozen(ACTIONS));
    assert.ok(Object.isFrozen(TOUCH_TOKENS));
    assert.ok(Object.isFrozen(DEVICES));
    assert.deepEqual([...DEVICES], ['keyboard', 'gamepad', 'touch']);
    assert.equal(BINDINGS_VERSION, 1);
  });

  it('default bindings cover every action with valid tokens and are deeply frozen', () => {
    assert.deepEqual(Object.keys(DEFAULT_BINDINGS).sort(), [...ACTIONS].sort());
    for (const action of ACTIONS) {
      assert.ok(DEFAULT_BINDINGS[action].length > 0, `${action} has bindings`);
      for (const token of DEFAULT_BINDINGS[action]) assert.ok(tokenDevice(token), `${token} is valid`);
      assert.ok(Object.isFrozen(DEFAULT_BINDINGS[action]));
    }
    assert.ok(Object.isFrozen(DEFAULT_BINDINGS));
    assert.throws(() => { DEFAULT_BINDINGS.up.push('KeyQ'); }, TypeError);
  });

  it('matches the contract key layout', () => {
    const b = DEFAULT_BINDINGS;
    assert.ok(b.up.includes('ArrowUp') && b.up.includes('KeyW'));
    assert.ok(b.left.includes('ArrowLeft') && b.left.includes('KeyA'));
    for (const t of ['KeyZ', 'Enter', 'Space']) assert.ok(b.confirm.includes(t), `confirm has ${t}`);
    for (const t of ['KeyX', 'Escape', 'Backspace']) assert.ok(b.cancel.includes(t), `cancel has ${t}`);
    assert.ok(!b.menu.includes('Enter') && !b.menu.includes('NumpadEnter') && b.menu.includes('Escape'));
    assert.ok(b.run.includes('ShiftLeft') && b.run.includes('ShiftRight'));
    assert.ok(b.tool.includes('KeyC') && b.map.includes('KeyM') && b.log.includes('Tab') && b.start.includes('KeyP'));
    assert.ok(b.l.includes('BracketLeft') && b.r.includes('BracketRight'));
    assert.ok(b.confirm.includes('gp:b0') && b.cancel.includes('gp:b1') && b.start.includes('gp:b9'));
    assert.ok(b.up.includes('gp:b12') && b.up.includes('gp:axis1-') && b.right.includes('gp:axis0+'));
    assert.ok(b.confirm.includes('touch:a') && b.cancel.includes('touch:b') && b.menu.includes('touch:menu'));
  });
});

// ---------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------

describe('tokenDevice', () => {
  it('classifies tokens', () => {
    assert.equal(tokenDevice('KeyZ'), 'keyboard');
    assert.equal(tokenDevice('ArrowUp'), 'keyboard');
    assert.equal(tokenDevice('F1'), 'keyboard');
    assert.equal(tokenDevice('gp:b0'), 'gamepad');
    assert.equal(tokenDevice('gp:b16'), 'gamepad');
    assert.equal(tokenDevice('gp:axis0-'), 'gamepad');
    assert.equal(tokenDevice('gp:axis3+'), 'gamepad');
    assert.equal(tokenDevice('touch:a'), 'touch');
    assert.equal(tokenDevice('touch:menu'), 'touch');
  });
  it('rejects malformed tokens', () => {
    for (const bad of ['', 'gp:', 'gp:b', 'gp:b123', 'gp:axis0', 'gp:axisX+', 'touch:x', 'touch:', 'Key Z', '1Key', 'Key-Z', null, undefined, 5, {}]) {
      assert.equal(tokenDevice(bad), null, `rejects ${JSON.stringify(bad)}`);
    }
  });
});

describe('tokenFromKeyEvent', () => {
  it('prefers code and falls back to key', () => {
    assert.equal(tokenFromKeyEvent({ code: 'KeyZ', key: 'y' }), 'KeyZ');
    assert.equal(tokenFromKeyEvent({ code: '', key: 'a' }), 'KeyA');
    assert.equal(tokenFromKeyEvent({ code: 'Unidentified', key: 'ArrowUp' }), 'ArrowUp');
    assert.equal(tokenFromKeyEvent({ key: '5' }), 'Digit5');
    assert.equal(tokenFromKeyEvent({ key: ' ' }), 'Space');
    assert.equal(tokenFromKeyEvent({ key: 'Esc' }), 'Escape');
    assert.equal(tokenFromKeyEvent({ key: 'Up' }), 'ArrowUp');
    assert.equal(tokenFromKeyEvent({ key: 'Shift' }), 'ShiftLeft');
    assert.equal(tokenFromKeyEvent({ key: 'Enter' }), 'Enter');
  });
  it('returns null when nothing identifies the key', () => {
    assert.equal(tokenFromKeyEvent(null), null);
    assert.equal(tokenFromKeyEvent({}), null);
    assert.equal(tokenFromKeyEvent({ key: 'Dead' }), null);
    assert.equal(tokenFromKeyEvent({ key: 'Unidentified' }), null);
    assert.equal(tokenFromKeyEvent({ key: 'é' }), null);
    assert.equal(tokenFromKeyEvent({ key: 'Some Key' }), null);
  });
});

describe('tokenLabel', () => {
  it('produces short prompt labels', () => {
    const cases = {
      KeyZ: 'Z', Digit3: '3', ArrowUp: '↑', ArrowLeft: '←', ShiftLeft: 'Shift', Escape: 'Esc', BracketLeft: '[',
      Backquote: '`', Numpad5: 'Num 5', NumpadEnter: 'Num Enter', Enter: 'Enter', Space: 'Space', F5: 'F5',
      'gp:b0': 'A', 'gp:b1': 'B', 'gp:b9': 'Start', 'gp:b12': 'D↑', 'gp:b17': 'B17',
      'gp:axis0-': 'L←', 'gp:axis0+': 'L→', 'gp:axis1-': 'L↑', 'gp:axis1+': 'L↓', 'gp:axis2+': 'R→', 'gp:axis3-': 'R↑',
      'touch:a': 'A', 'touch:b': 'B', 'touch:menu': 'Menu', 'touch:up': 'Up',
    };
    for (const [token, label] of Object.entries(cases)) assert.equal(tokenLabel(token), label, token);
    assert.equal(tokenLabel('gp:weird'), 'gp:weird');
    assert.equal(tokenLabel(42), '');
  });
});

describe('dpadDirections', () => {
  const only = (...dirs) => ({ up: dirs.includes('up'), down: dirs.includes('down'), left: dirs.includes('left'), right: dirs.includes('right') });
  it('resolves the eight directions', () => {
    assert.deepEqual(dpadDirections(10, 0), only('right'));
    assert.deepEqual(dpadDirections(-10, 0), only('left'));
    assert.deepEqual(dpadDirections(0, -10), only('up'));
    assert.deepEqual(dpadDirections(0, 10), only('down'));
    assert.deepEqual(dpadDirections(10, 10), only('right', 'down'));
    assert.deepEqual(dpadDirections(-10, 10), only('left', 'down'));
    assert.deepEqual(dpadDirections(-10, -10), only('left', 'up'));
    assert.deepEqual(dpadDirections(10, -10), only('right', 'up'));
  });
  it('switches to a diagonal at 22.5 degrees', () => {
    assert.deepEqual(dpadDirections(100, 41), only('right'));
    assert.deepEqual(dpadDirections(100, 42), only('right', 'down'));
    assert.deepEqual(dpadDirections(41, -100), only('up'));
    assert.deepEqual(dpadDirections(42, -100), only('up', 'right'));
  });
  it('honours the deadzone and bad input', () => {
    assert.deepEqual(dpadDirections(0, 0), only());
    assert.deepEqual(dpadDirections(5, 0, 5), only());
    assert.deepEqual(dpadDirections(5.1, 0, 5), only('right'));
    assert.deepEqual(dpadDirections(NaN, 3), only());
    assert.deepEqual(dpadDirections(Infinity, 0), only('right'));
  });
});

describe('detectTouchPreference', () => {
  const coarse = (q) => ({ matches: q.includes('coarse') });
  const fine = (q) => ({ matches: q.includes('fine') });
  it('lets the query string force the overlay', () => {
    assert.deepEqual(detectTouchPreference({ search: '?touch=1' }), { visible: true, forced: true });
    assert.deepEqual(detectTouchPreference({ search: '?a=1&touch=true' }), { visible: true, forced: true });
    assert.deepEqual(detectTouchPreference({ search: '?touch' }), { visible: true, forced: true });
    assert.deepEqual(detectTouchPreference({ search: '?touch&x=1' }), { visible: true, forced: true });
    assert.deepEqual(detectTouchPreference({ search: '?touchy=1' }), { visible: false, forced: false });
    assert.deepEqual(detectTouchPreference({ search: '?touch=0#x', touch: true }), { visible: false, forced: true });
    assert.deepEqual(detectTouchPreference({ search: '?touch=false', matchMedia: coarse }), { visible: false, forced: true });
    assert.deepEqual(detectTouchPreference({ search: '?touch=maybe', touch: false }), { visible: false, forced: true });
  });
  it('honours explicit booleans', () => {
    assert.deepEqual(detectTouchPreference({ touch: true }), { visible: true, forced: true });
    assert.deepEqual(detectTouchPreference({ touch: false, matchMedia: coarse }), { visible: false, forced: true });
  });
  it('detects coarse pointers and touch-only devices in auto mode', () => {
    assert.deepEqual(detectTouchPreference({ matchMedia: coarse }), { visible: true, forced: false });
    assert.deepEqual(detectTouchPreference({ matchMedia: fine, nav: { maxTouchPoints: 10 } }), { visible: false, forced: false });
    assert.deepEqual(detectTouchPreference({ nav: { maxTouchPoints: 5 } }), { visible: true, forced: false });
    assert.deepEqual(detectTouchPreference({}), { visible: false, forced: false });
    assert.deepEqual(detectTouchPreference({ matchMedia: () => { throw new Error('nope'); }, nav: { maxTouchPoints: 1 } }), { visible: true, forced: false });
    assert.deepEqual(detectTouchPreference({ search: 42, nav: null }), { visible: false, forced: false });
  });
});

describe('parseBindings', () => {
  it('accepts documents, bare tables and JSON strings', () => {
    const doc = { version: 1, bindings: { up: ['KeyI'], confirm: 'KeyJ' } };
    assert.deepEqual(parseBindings(doc), { bindings: { up: ['KeyI'], confirm: ['KeyJ'] }, dropped: [] });
    assert.deepEqual(parseBindings(JSON.stringify(doc)), parseBindings(doc));
    assert.deepEqual(parseBindings({ left: ['KeyH', 'gp:b14'] }), { bindings: { left: ['KeyH', 'gp:b14'] }, dropped: [] });
  });
  it('drops unknown actions, bad tokens and duplicates', () => {
    const out = parseBindings({ up: ['KeyI', 'bad token', 'KeyI', 7], anyKey: ['KeyA'], jump: ['Space'], down: 12 });
    assert.deepEqual(out.bindings, { up: ['KeyI'] });
    assert.deepEqual(out.dropped, ['up:bad token', 'up:KeyI', 'up:7', 'anyKey', 'jump', 'down']);
    assert.deepEqual(parseBindings({ up: ['nope!'], down: [] }), { bindings: { down: [] }, dropped: ['up:nope!'] });
  });
  it('returns null for non-objects', () => {
    assert.equal(parseBindings('{nope'), null);
    assert.equal(parseBindings('[]'), null);
    assert.equal(parseBindings(null), null);
    assert.equal(parseBindings(42), null);
    assert.equal(parseBindings([1]), null);
  });
});

// ---------------------------------------------------------------------------------------------
// createInput: construction and basic state
// ---------------------------------------------------------------------------------------------

describe('createInput basics', () => {
  it('requires a canvas event target', () => {
    assert.throws(() => createInput(), TypeError);
    assert.throws(() => createInput({ canvas: {} }), TypeError);
  });

  it('starts idle with default bindings and frozen pointer snapshot', () => {
    const { input } = harness();
    assert.equal(input.frame, 0);
    assert.deepEqual(activeActions(input, 'pressed'), []);
    assert.deepEqual(activeActions(input, 'held'), []);
    assert.deepEqual(activeActions(input, 'released'), []);
    assert.deepEqual(input.axis(), { x: 0, y: 0 });
    assert.equal(input.lastDevice, 'keyboard');
    assert.equal(input.lastPressedToken(), null);
    assert.equal(input.enabled, true);
    assert.equal(input.touchVisible, false);
    assert.equal(input.gamepads, 0);
    assert.deepEqual(input.pointer, { x: 0, y: 0, down: false, justDown: false, justUp: false, inside: false, type: '', button: 0 });
    assert.ok(Object.isFrozen(input.pointer));
    assert.deepEqual(input.bindings(), DEFAULT_BINDINGS);
    assert.equal(input.frame, 0);
    input.update();
    assert.equal(input.frame, 1);
  });

  it('bindings() returns an independent copy', () => {
    const { input } = harness();
    const copy = input.bindings();
    copy.up.push('KeyQ');
    delete copy.down;
    assert.deepEqual(input.bindings(), DEFAULT_BINDINGS);
  });

  it('rejects unknown actions with RangeError', () => {
    const { input } = harness();
    for (const fn of ['pressed', 'held', 'released', 'repeat', 'heldFor']) {
      assert.throws(() => input[fn]('jump'), RangeError, fn);
    }
    assert.throws(() => input.rebind('jump', 'KeyJ'), RangeError);
    assert.throws(() => input.rebind(ANY_KEY, 'KeyJ'), RangeError);
    assert.throws(() => input.heldFor(ANY_KEY), RangeError);
    assert.throws(() => input.addBinding('nope', 'KeyJ'), RangeError);
    assert.doesNotThrow(() => input.pressed(ANY_KEY));
    assert.doesNotThrow(() => input.repeat(ANY_KEY));
  });

  it('sets touch-action on the canvas', () => {
    const { canvas } = harness();
    assert.equal(canvas.style.touchAction, 'none');
  });
});

// ---------------------------------------------------------------------------------------------
// Keyboard edges
// ---------------------------------------------------------------------------------------------

describe('keyboard edges', () => {
  it('latches pressed / held / released across frames', () => {
    const { input, press, release, tick } = harness();
    press('KeyZ');
    assert.equal(input.pressed('confirm'), false, 'nothing until update()');
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), ['confirm', ANY_KEY]);
    assert.deepEqual(activeActions(input, 'held'), ['confirm', ANY_KEY]);
    assert.deepEqual(activeActions(input, 'released'), []);
    assert.equal(input.lastDevice, 'keyboard');
    assert.equal(input.lastPressedToken(), 'KeyZ');
    tick();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.held('confirm'), true);
    release('KeyZ');
    tick();
    assert.equal(input.held('confirm'), false);
    assert.deepEqual(activeActions(input, 'released'), ['confirm', ANY_KEY]);
    tick();
    assert.deepEqual(activeActions(input, 'released'), []);
  });

  it('sees a tap shorter than a frame as pressed and released', () => {
    const { input, press, release, tick } = harness();
    press('KeyX');
    release('KeyX');
    tick();
    assert.equal(input.pressed('cancel'), true);
    assert.equal(input.released('cancel'), true);
    assert.equal(input.held('cancel'), false);
  });

  it('counts one press per key-down even when a frame sees several keys for the action', () => {
    const { input, press, release, tick } = harness();
    press('ArrowUp');
    tick();
    assert.equal(input.pressed('up'), true);
    press('KeyW');
    tick();
    assert.equal(input.pressed('up'), true, 'a second physical key is a fresh press');
    release('KeyW');
    tick();
    assert.equal(input.released('up'), false, 'still held via ArrowUp');
    assert.equal(input.held('up'), true);
    release('ArrowUp');
    tick();
    assert.equal(input.released('up'), true);
  });

  it('ignores OS auto-repeat but recovers held state from it', () => {
    const { input, press, release, tick } = harness();
    press('KeyZ');
    tick();
    press('KeyZ', { repeat: true });
    tick();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.held('confirm'), true);
    release('KeyZ');
    tick();
    // A repeat with no key-down seen (key was held when focus arrived): held, never pressed.
    press('KeyZ', { repeat: true });
    tick();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.held('confirm'), true);
    release('KeyZ');
    tick();
    assert.equal(input.released('confirm'), true);
  });

  it('shares Escape between cancel and menu; Enter is confirm only (MID-21)', () => {
    const { input, press, release, tick } = harness();
    press('Escape');
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), ['cancel', 'menu', ANY_KEY]);
    release('Escape');
    press('Enter');
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), ['confirm', ANY_KEY]);
  });

  it('reports anyKey for unbound keys without touching bound actions', () => {
    const { input, press, release, tick } = harness();
    press('KeyQ');
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), [ANY_KEY]);
    assert.equal(input.held(ANY_KEY), true);
    release('KeyQ');
    tick();
    assert.deepEqual(activeActions(input, 'released'), [ANY_KEY]);
    assert.equal(input.held(ANY_KEY), false);
  });

  it('prevents browser defaults for bound keys only', () => {
    const { input, press, tick } = harness();
    assert.equal(press('Tab').defaultPrevented, true);
    assert.equal(press('Space').defaultPrevented, true);
    assert.equal(press('KeyQ').defaultPrevented, false);
    assert.equal(press('F5').defaultPrevented, false);
    tick();
    assert.equal(input.pressed('log'), true);
    const relaxed = harness({ preventDefault: false });
    assert.equal(relaxed.press('Tab').defaultPrevented, false);
  });

  it('leaves Ctrl/Meta shortcuts, IME composition and text fields alone', () => {
    const { input, press, release, tick } = harness();
    assert.equal(press('KeyS', { ctrlKey: true }).defaultPrevented, false);
    press('KeyR', { metaKey: true });
    press('KeyZ', { isComposing: true });
    const inField = evt('keydown', { code: 'KeyX' });
    Object.defineProperty(inField, 'target', { value: { tagName: 'INPUT' } });
    input; // (listener is on the window target)
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), []);
    assert.deepEqual(activeActions(input, 'held'), []);
    release('KeyS');
    release('KeyR');
    tick();
    assert.deepEqual(activeActions(input, 'released'), []);
  });

  it('ignores key-downs whose target is editable', () => {
    const { input, target, tick } = harness();
    const inField = evt('keydown', { code: 'KeyX' });
    Object.defineProperty(inField, 'target', { value: { tagName: 'TEXTAREA' } });
    target.dispatchEvent(inField);
    const editable = evt('keydown', { code: 'KeyZ' });
    Object.defineProperty(editable, 'target', { value: { isContentEditable: true } });
    target.dispatchEvent(editable);
    assert.equal(inField.defaultPrevented, false);
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), []);
  });

  it('falls back to event.key when code is missing', () => {
    const { input, key, tick } = harness();
    key('keydown', '', { key: 'z' });
    tick();
    assert.equal(input.pressed('confirm'), true);
    key('keyup', '', { key: 'z' });
    tick();
    assert.equal(input.released('confirm'), true);
  });

  it('releases every key when Command lifts (macOS swallowed key-ups)', () => {
    const { input, press, release, tick } = harness();
    press('ArrowLeft');
    tick();
    press('MetaLeft', { metaKey: true });
    release('MetaLeft');
    tick();
    assert.equal(input.released('left'), true);
    assert.equal(input.held('left'), false);
  });
});

// ---------------------------------------------------------------------------------------------
// flush / axis / repeat / heldFor
// ---------------------------------------------------------------------------------------------

describe('flush', () => {
  it('never lets a key held at scene entry count as a press', () => {
    const { input, press, release, tick } = harness();
    press('KeyZ');
    input.flush();
    tick();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.held('confirm'), true);
    release('KeyZ');
    tick();
    assert.equal(input.released('confirm'), true);
  });

  it('clears latched edges immediately but keeps held state', () => {
    const { input, press, tick } = harness();
    press('KeyZ');
    tick();
    assert.equal(input.pressed('confirm'), true);
    input.flush();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.pressed(ANY_KEY), false);
    assert.equal(input.held('confirm'), true);
    assert.equal(input.held(ANY_KEY), true);
  });

  it('clears pointer edges and buffered pointer taps', () => {
    const { input, canvas, target, tick } = harness();
    canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' }));
    tick();
    assert.equal(input.pointer.justDown, true);
    input.flush();
    assert.equal(input.pointer.justDown, false);
    assert.equal(input.pointer.down, true);
    target.dispatchEvent(evt('pointerup', { clientX: 100, clientY: 100, pointerId: 1 }));
    input.flush();
    tick();
    assert.equal(input.pointer.justUp, false);
    assert.equal(input.pointer.down, false);
  });
});

describe('axis', () => {
  it('is digital from held directions with opposites cancelling', () => {
    const { input, press, release, tick } = harness();
    press('ArrowRight');
    tick();
    assert.deepEqual(input.axis(), { x: 1, y: 0 });
    press('ArrowLeft');
    tick();
    assert.deepEqual(input.axis(), { x: 0, y: 0 });
    release('ArrowRight');
    press('KeyW');
    tick();
    assert.deepEqual(input.axis(), { x: -1, y: -1 });
    release('KeyW');
    press('KeyS');
    tick();
    assert.deepEqual(input.axis(), { x: -1, y: 1 });
  });
});

describe('repeat', () => {
  it('fires on press, then after delay every rate (deterministic clock)', () => {
    const { input, press, release, at } = harness();
    const r = () => input.repeat('down', { delay: 300, rate: 80 });
    press('ArrowDown');
    at(0);
    assert.equal(r(), true, 'press');
    at(100);
    assert.equal(r(), false);
    at(299);
    assert.equal(r(), false);
    at(300);
    assert.equal(r(), true, 'first repeat');
    at(350);
    assert.equal(r(), false);
    at(380);
    assert.equal(r(), true);
    at(460);
    assert.equal(r(), true);
    at(2000);
    assert.equal(r(), true, 'after a stall');
    at(2040);
    assert.equal(r(), false, 'no catch-up burst');
    at(2080);
    assert.equal(r(), true);
    release('ArrowDown');
    at(2100);
    assert.equal(r(), false);
    press('ArrowDown');
    at(3000);
    assert.equal(r(), true, 're-press restarts');
    at(3100);
    assert.equal(r(), false);
  });

  it('returns the same answer for every caller within a frame', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(0);
    assert.equal(input.repeat('down'), true);
    assert.equal(input.repeat('down'), true);
    at(300);
    assert.equal(input.repeat('down'), true);
    assert.equal(input.repeat('down'), true);
    at(380);
    assert.equal(input.repeat('down'), true, 'double call did not double-advance');
  });

  it('uses default delay 300 / rate 80 and sanitises options', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(0);
    assert.equal(input.repeat('down'), true);
    at(299);
    assert.equal(input.repeat('down'), false);
    at(300);
    assert.equal(input.repeat('down'), true);
    at(379);
    assert.equal(input.repeat('down'), false);
    at(380);
    assert.equal(input.repeat('down'), true);
    const other = harness();
    other.press('ArrowUp');
    other.at(0);
    assert.equal(other.input.repeat('up', { delay: -5, rate: 0 }), true);
    other.at(1);
    assert.equal(other.input.repeat('up', { delay: -5, rate: 0 }), true, 'rate clamps to 1ms');
  });

  it('does not repeat a key that was already held when the menu opened (flush)', () => {
    const { input, press, release, at } = harness();
    press('ArrowDown');
    at(0);
    assert.equal(input.repeat('down'), true);
    input.flush();
    at(1000);
    assert.equal(input.repeat('down'), false);
    at(2000);
    assert.equal(input.repeat('down'), false);
    release('ArrowDown');
    press('ArrowDown');
    at(2016);
    assert.equal(input.repeat('down'), true);
  });

  it('supports anyKey', () => {
    const { input, press, at } = harness();
    press('KeyQ');
    at(0);
    assert.equal(input.repeat(ANY_KEY, { delay: 10, rate: 10 }), true);
    at(10);
    assert.equal(input.repeat(ANY_KEY, { delay: 10, rate: 10 }), true);
  });
});

describe('heldFor', () => {
  it('measures hold time with the injected clock', () => {
    const { input, press, release, at } = harness();
    assert.equal(input.heldFor('run'), 0);
    press('ShiftLeft');
    at(100);
    assert.equal(input.heldFor('run'), 0);
    at(350);
    assert.equal(input.heldFor('run'), 250);
    release('ShiftLeft');
    at(400);
    assert.equal(input.heldFor('run'), 0);
  });
});

// ---------------------------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------------------------

describe('rebind', () => {
  it('replaces the tokens of one device and keeps the others', () => {
    const { input, press, release, tick } = harness();
    assert.deepEqual(input.rebind('confirm', 'KeyJ'), ['KeyJ', 'gp:b0', 'touch:a']);
    press('KeyZ');
    tick();
    assert.equal(input.pressed('confirm'), false);
    release('KeyZ');
    press('KeyJ');
    tick();
    assert.equal(input.pressed('confirm'), true);
    assert.deepEqual(input.actionsFor('KeyJ'), ['confirm']);
    assert.deepEqual(input.actionsFor('KeyZ'), []);
    assert.deepEqual(input.bindings().menu, DEFAULT_BINDINGS.menu, 'other actions untouched');
  });

  it('supports slots, arrays, unbinding and device selection', () => {
    const { input } = harness();
    assert.deepEqual(input.rebind('up', 'KeyI', { slot: 0 }), ['KeyI', 'KeyW', 'gp:b12', 'gp:axis1-', 'touch:up']);
    assert.deepEqual(input.rebind('up', 'KeyK', { slot: 7 }), ['KeyI', 'KeyW', 'KeyK', 'gp:b12', 'gp:axis1-', 'touch:up']);
    assert.deepEqual(input.rebind('up', null, { slot: 1 }), ['KeyI', 'KeyK', 'gp:b12', 'gp:axis1-', 'touch:up']);
    assert.deepEqual(input.rebind('up', ['gp:b12', 'gp:axis3-']), ['KeyI', 'KeyK', 'gp:b12', 'gp:axis3-', 'touch:up']);
    assert.deepEqual(input.rebind('up', null), ['gp:b12', 'gp:axis3-', 'touch:up']);
    assert.deepEqual(input.rebind('up', null, { device: 'gamepad' }), ['touch:up']);
    assert.deepEqual(input.rebind('up', []), ['touch:up']);
    assert.deepEqual(input.rebind('up', 'KeyW', { slot: -3 }), ['KeyW', 'touch:up']);
    assert.deepEqual(input.rebind('up', ['KeyW', 'KeyW']), ['KeyW', 'touch:up'], 'duplicates collapse');
  });

  it('validates tokens and devices', () => {
    const { input } = harness();
    assert.throws(() => input.rebind('up', 'not a key'), TypeError);
    assert.throws(() => input.rebind('up', ['KeyI', 'gp:b0']), TypeError);
    assert.throws(() => input.rebind('up', null, { device: 'mouse' }), TypeError);
    assert.throws(() => input.rebind('up', 7), TypeError);
    assert.deepEqual(input.bindings(), DEFAULT_BINDINGS, 'nothing changed after errors');
  });

  it('does not steal a token from other actions (shared keys stay shared)', () => {
    const { input, press, tick } = harness();
    input.rebind('tool', 'Escape');
    press('Escape');
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), ['cancel', 'menu', 'tool', ANY_KEY]);
    assert.deepEqual(input.actionsFor('Escape'), ['cancel', 'menu', 'tool']);
  });

  it('addBinding / removeBinding / resetBindings', () => {
    const { input, press, tick } = harness();
    assert.deepEqual(input.addBinding('run', 'KeyB'), ['ShiftLeft', 'ShiftRight', 'KeyB', 'gp:b7']);
    assert.deepEqual(input.addBinding('run', 'KeyB'), ['ShiftLeft', 'ShiftRight', 'KeyB', 'gp:b7'], 'idempotent');
    assert.throws(() => input.addBinding('run', 'gp:nope'), TypeError);
    press('KeyB');
    tick();
    assert.equal(input.held('run'), true);
    assert.deepEqual(input.removeBinding('run', 'KeyB'), ['ShiftLeft', 'ShiftRight', 'gp:b7']);
    assert.deepEqual(input.removeBinding('run', 'KeyB'), ['ShiftLeft', 'ShiftRight', 'gp:b7']);
    tick();
    assert.equal(input.held('run'), false, 'binding changes apply to keys already held');
    input.rebind('confirm', 'KeyJ');
    input.resetBindings();
    assert.deepEqual(input.bindings(), DEFAULT_BINDINGS);
  });
});

describe('saveBindings / loadBindings', () => {
  it('round-trips through JSON', () => {
    const a = harness();
    a.input.rebind('confirm', 'KeyJ');
    a.input.rebind('up', 'KeyI', { slot: 0 });
    a.input.rebind('run', null);
    const json = a.input.saveBindings();
    const parsed = JSON.parse(json);
    assert.equal(parsed.version, BINDINGS_VERSION);
    assert.deepEqual(Object.keys(parsed.bindings).sort(), [...ACTIONS].sort());
    const b = harness();
    assert.equal(b.input.loadBindings(json), true);
    assert.deepEqual(b.input.bindings(), a.input.bindings());
    assert.deepEqual(b.input.bindings().run, ['gp:b7']);
    b.press('KeyJ');
    b.tick();
    assert.equal(b.input.pressed('confirm'), true);
  });

  it('merges partial documents onto the defaults', () => {
    const { input, press, tick } = harness();
    assert.equal(input.loadBindings('{"up":["KeyI"],"down":[]}'), true);
    assert.deepEqual(input.bindings().up, ['KeyI']);
    assert.deepEqual(input.bindings().down, []);
    assert.deepEqual(input.bindings().left, DEFAULT_BINDINGS.left);
    press('ArrowDown');
    tick();
    assert.equal(input.held('down'), false, 'explicitly empty list unbinds');
    assert.equal(input.loadBindings({ bindings: { left: 'KeyH' }, extra: true }), true);
    assert.deepEqual(input.bindings().left, ['KeyH']);
    assert.deepEqual(input.bindings().up, DEFAULT_BINDINGS.up, 'a new document resets what it omits');
  });

  it('rejects unusable input without changing anything', () => {
    const { input } = harness();
    input.rebind('confirm', 'KeyJ');
    const before = input.bindings();
    for (const bad of ['nope', 42, null, [], { bogus: ['KeyA'] }, { bindings: {} }, { up: 'bad token' }]) {
      assert.equal(input.loadBindings(bad), false, JSON.stringify(bad));
    }
    assert.deepEqual(input.bindings(), before);
  });
});

// ---------------------------------------------------------------------------------------------
// Pointer
// ---------------------------------------------------------------------------------------------

describe('pointer', () => {
  it('maps through display.toGame and latches justDown / justUp', () => {
    const { input, canvas, target, tick } = harness();
    canvas.dispatchEvent(evt('pointerdown', { clientX: 110, clientY: 120, pointerId: 1, pointerType: 'mouse', button: 0 }));
    tick();
    assert.deepEqual(input.pointer, { x: 50, y: 50, down: true, justDown: true, justUp: false, inside: true, type: 'mouse', button: 0 });
    assert.deepEqual(canvas.captured, [1]);
    assert.equal(input.pressed(ANY_KEY), true, 'a click counts as anyKey');
    assert.equal(input.pointer, input.pointer, 'stable snapshot within a frame');
    target.dispatchEvent(evt('pointermove', { clientX: 210, clientY: 220, pointerId: 1, pointerType: 'mouse' }));
    tick();
    assert.equal(input.pointer.x, 100);
    assert.equal(input.pointer.y, 100);
    assert.equal(input.pointer.justDown, false);
    assert.equal(input.held(ANY_KEY), true);
    target.dispatchEvent(evt('pointerup', { clientX: 210, clientY: 220, pointerId: 1, pointerType: 'mouse' }));
    tick();
    assert.equal(input.pointer.down, false);
    assert.equal(input.pointer.justUp, true);
    assert.equal(input.released(ANY_KEY), true);
    tick();
    assert.equal(input.pointer.justUp, false);
  });

  it('tracks hover position and inside flag', () => {
    const { input, target, tick } = harness();
    target.dispatchEvent(evt('pointermove', { clientX: 5, clientY: 20, pointerId: 1 }));
    tick();
    assert.equal(input.pointer.x, -2.5);
    assert.equal(input.pointer.inside, false);
    target.dispatchEvent(evt('pointermove', { clientX: 10 + 2 * 479, clientY: 20 + 2 * 269, pointerId: 1 }));
    tick();
    assert.equal(input.pointer.inside, true);
    target.dispatchEvent(evt('pointermove', { clientX: 10 + 2 * 480, clientY: 20, pointerId: 1 }));
    tick();
    assert.equal(input.pointer.inside, false);
  });

  it('ignores extra fingers and tolerates events without pointerId', () => {
    const { input, canvas, target, tick } = harness();
    canvas.dispatchEvent(evt('pointerdown', { clientX: 110, clientY: 120, pointerId: 1, pointerType: 'touch' }));
    canvas.dispatchEvent(evt('pointerdown', { clientX: 310, clientY: 320, pointerId: 2, pointerType: 'touch' }));
    tick();
    assert.equal(input.pointer.x, 50, 'second finger did not move the pointer');
    assert.equal(input.lastDevice, 'touch');
    target.dispatchEvent(evt('pointerup', { clientX: 310, clientY: 320, pointerId: 2 }));
    tick();
    assert.equal(input.pointer.down, true, 'lifting the second finger keeps the first');
    target.dispatchEvent(evt('pointerup', { clientX: 110, clientY: 120, pointerId: 1 }));
    tick();
    assert.equal(input.pointer.down, false);
    canvas.dispatchEvent(evt('pointerdown', { clientX: 110, clientY: 120, pointerType: 'mouse' }));
    target.dispatchEvent(evt('pointerup', { clientX: 110, clientY: 120 }));
    tick();
    assert.equal(input.pointer.justDown, true);
    assert.equal(input.pointer.justUp, true);
    assert.equal(input.pointer.down, false);
  });

  it('falls back to scaling the canvas rect when no display is given', () => {
    const { input, canvas, target, tick } = harness({ display: null });
    canvas.dispatchEvent(evt('pointerdown', { clientX: 490, clientY: 290, pointerId: 1 }));
    tick();
    assert.equal(input.pointer.x, 240);
    assert.equal(input.pointer.y, 135);
    assert.equal(input.pointer.inside, true);
    canvas.rect = { left: 0, top: 0, width: 0, height: 0 };
    target.dispatchEvent(evt('pointermove', { clientX: 7, clientY: 9, pointerId: 1 }));
    tick();
    assert.deepEqual([input.pointer.x, input.pointer.y], [7, 9], 'degenerate rect passes client coords through');
  });

  it('sanitises NaN coordinates from a display', () => {
    const { input, canvas, tick } = harness({ display: { toGame: () => ({ x: NaN, y: 'x' }) } });
    canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1 }));
    tick();
    assert.deepEqual([input.pointer.x, input.pointer.y], [0, 0]);
  });
});

// ---------------------------------------------------------------------------------------------
// Gamepad
// ---------------------------------------------------------------------------------------------

describe('gamepad', () => {
  it('polls buttons into edges and sets lastDevice', () => {
    const { input, pads, tick } = harness();
    const pad = makeGamepad();
    pads.push(pad);
    tick();
    assert.equal(input.gamepads, 1);
    assert.equal(input.lastDevice, 'keyboard', 'a connected pad alone is not input');
    pad.buttons[0].pressed = true;
    tick();
    assert.equal(input.pressed('confirm'), true);
    assert.equal(input.lastDevice, 'gamepad');
    assert.equal(input.lastPressedToken(), 'gp:b0');
    tick();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.held('confirm'), true);
    pad.buttons[0].pressed = false;
    tick();
    assert.equal(input.released('confirm'), true);
    pad.buttons[9].pressed = true;
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), ['menu', 'start', ANY_KEY]);
    pad.buttons[9].pressed = false;
    pad.buttons[7] = { pressed: false, value: 0.8 };
    tick();
    assert.equal(input.held('run'), true, 'analogue trigger value counts');
  });

  it('digitises sticks with hysteresis', () => {
    const { input, pads, tick } = harness();
    const pad = makeGamepad();
    pads.push(pad);
    pad.axes[1] = -0.45;
    tick();
    assert.equal(input.held('up'), false);
    pad.axes[1] = -0.5;
    tick();
    assert.equal(input.pressed('up'), true);
    pad.axes[1] = -0.4;
    tick();
    assert.equal(input.held('up'), true, 'stays engaged above 70% of the deadzone');
    pad.axes[1] = -0.3;
    tick();
    assert.equal(input.released('up'), true);
    pad.axes[0] = 0.9;
    pad.axes[1] = 0.9;
    tick();
    assert.deepEqual(input.axis(), { x: 1, y: 1 });
    const custom = harness({ deadzone: 0.2 });
    const pad2 = makeGamepad({ axes: [0.25, 0, 0, 0] });
    custom.pads.push(pad2);
    custom.tick();
    assert.equal(custom.input.held('right'), true);
  });

  it('merges several pads and skips disconnected or null entries', () => {
    const { input, pads, tick } = harness();
    const a = makeGamepad();
    const b = makeGamepad();
    const dead = makeGamepad({ connected: false });
    dead.buttons[3].pressed = true;
    pads.push(null, a, dead, b);
    a.buttons[1].pressed = true;
    b.buttons[2].pressed = true;
    tick();
    assert.equal(input.gamepads, 2);
    assert.deepEqual(activeActions(input, 'held'), ['cancel', 'tool', ANY_KEY]);
  });

  it('survives a navigator without gamepads or one that throws', () => {
    const noPads = harness({ nav: {} });
    noPads.tick();
    assert.equal(noPads.input.gamepads, 0);
    let calls = 0;
    const throwing = harness({ nav: { getGamepads() { calls += 1; throw new Error('SecurityError'); } } });
    throwing.tick();
    throwing.tick();
    assert.equal(throwing.input.gamepads, 0);
    assert.equal(calls, 1, 'stops polling after the first failure');
  });

  it('does not fabricate a press when focus returns with a button still held', () => {
    const { input, pads, target, tick } = harness();
    const pad = makeGamepad();
    pads.push(pad);
    pad.buttons[0].pressed = true;
    tick();
    assert.equal(input.pressed('confirm'), true);
    target.dispatchEvent(new Event('blur'));
    tick();
    assert.equal(input.pressed('confirm'), false);
    assert.equal(input.held('confirm'), true, 'still physically held: state recovers without a press');
    tick();
    assert.equal(input.pressed('confirm'), false);
    pad.buttons[0].pressed = false;
    tick();
    assert.equal(input.released('confirm'), true);
    pad.buttons[0].pressed = true;
    tick();
    assert.equal(input.pressed('confirm'), true, 'a fresh press after release counts');
  });
});

// ---------------------------------------------------------------------------------------------
// Focus loss, enable toggle, destroy
// ---------------------------------------------------------------------------------------------

describe('focus loss', () => {
  it('releases held keys on blur exactly once', () => {
    const { input, press, release, target, tick } = harness();
    press('ShiftLeft');
    tick();
    target.dispatchEvent(new Event('blur'));
    tick();
    assert.equal(input.released('run'), true);
    assert.equal(input.held('run'), false);
    release('ShiftLeft');
    tick();
    assert.equal(input.released('run'), false);
  });

  it('releases on visibilitychange to hidden and lifts the pointer', () => {
    const { input, press, canvas, doc, tick } = harness();
    press('KeyZ');
    canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }));
    tick();
    doc.hidden = true;
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    tick();
    assert.equal(input.released('confirm'), true);
    assert.equal(input.pointer.down, false);
    assert.equal(input.pointer.justUp, true);
    doc.hidden = false;
    doc.visibilityState = 'visible';
    press('KeyX');
    doc.dispatchEvent(new Event('visibilitychange'));
    tick();
    assert.equal(input.held('cancel'), true, 'becoming visible releases nothing');
  });
});

describe('setEnabled', () => {
  it('releases everything and ignores input while disabled', () => {
    const { input, press, release, tick } = harness();
    press('KeyZ');
    tick();
    input.setEnabled(false);
    assert.equal(input.enabled, false);
    tick();
    assert.equal(input.released('confirm'), true);
    assert.equal(input.held('confirm'), false);
    press('KeyX');
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), []);
    input.setEnabled(true);
    input.setEnabled(true);
    tick();
    assert.deepEqual(activeActions(input, 'pressed'), []);
    release('KeyZ');
    release('KeyX');
    tick();
    assert.deepEqual(activeActions(input, 'released'), []);
    press('KeyX');
    tick();
    assert.equal(input.pressed('cancel'), true);
  });

  it('tracks gamepad state silently while disabled', () => {
    const { input, pads, tick } = harness();
    const pad = makeGamepad();
    pads.push(pad);
    input.setEnabled(false);
    pad.buttons[0].pressed = true;
    tick();
    input.setEnabled(true);
    tick();
    assert.equal(input.pressed('confirm'), false, 'button pressed during the disabled window is not a press');
    tick();
    assert.equal(input.held('confirm'), true);
    pad.buttons[0].pressed = false;
    tick();
    assert.equal(input.released('confirm'), true);
  });
});

describe('destroy', () => {
  it('removes listeners and the overlay', () => {
    const h = harness({ touch: true });
    assert.ok(h.overlayRoot());
    h.press('KeyZ');
    h.tick();
    assert.equal(h.input.held('confirm'), true);
    h.input.destroy();
    assert.equal(h.overlayRoot(), null);
    h.tick();
    assert.equal(h.input.held('confirm'), false);
    h.press('KeyX');
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 }));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'pressed'), []);
    assert.equal(h.input.pointer.justDown, false);
    assert.doesNotThrow(() => h.input.destroy());
  });
});

// ---------------------------------------------------------------------------------------------
// Touch overlay
// ---------------------------------------------------------------------------------------------

describe('touch overlay', () => {
  it('builds the DOM once per document and shows when forced', () => {
    const h = harness({ touch: true });
    const root = h.overlayRoot();
    assert.ok(root, 'overlay root appended to body');
    assert.equal(root.hidden, false);
    assert.equal(h.input.touchVisible, true);
    assert.equal(h.input.lastDevice, 'touch');
    assert.equal(root.getAttribute('aria-hidden'), 'true');
    for (const cls of ['wsp-touch__dpad', 'wsp-touch__btn--a', 'wsp-touch__btn--b', 'wsp-touch__btn--menu', 'wsp-touch__arm--up', 'wsp-touch__hub']) {
      assert.ok(h.overlayPart(cls), cls);
    }
    const styles = () => h.doc.head.children.filter((c) => c.id === 'wsp-touch-style');
    assert.equal(styles().length, 1);
    assert.match(styles()[0].textContent, /\.wsp-touch\[hidden\]\{display:none\}/);
    createInput({ canvas: new FakeCanvas(), target: new EventTarget(), doc: h.doc, nav: h.nav, touch: true, search: '' });
    assert.equal(styles().length, 1, 'style injected once');
    const custom = new FakeElement('div');
    const parented = harness({ touch: true, touchParent: custom });
    assert.ok(custom.children[0].classList.contains('wsp-touch--abs'));
    assert.equal(parented.overlayRoot(), null);
  });

  it('is absent when touch is false and hidden on desktop in auto mode', () => {
    const off = harness({ touch: false });
    assert.equal(off.overlayRoot(), null);
    assert.equal(off.input.touchVisible, false);
    off.input.setTouchVisible(true);
    assert.equal(off.input.touchVisible, false);
    const desktop = harness({ touch: 'auto', matchMedia: (q) => ({ matches: q.includes('fine') }) });
    assert.equal(desktop.overlayRoot(), null, 'no overlay DOM on a mouse-and-keyboard device (contract: shown only on touch devices or ?touch=1)');
    assert.equal(desktop.input.touchVisible, false);
    assert.equal(desktop.input.lastDevice, 'keyboard');
    desktop.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' }));
    assert.ok(desktop.overlayRoot(), 'first touch builds the overlay lazily');
    assert.equal(desktop.input.touchVisible, true);
    const noDoc = harness({ touch: true, doc: null });
    assert.equal(noDoc.input.touchVisible, false);
    assert.doesNotThrow(() => { noDoc.press('KeyZ'); noDoc.tick(); noDoc.input.setTouchVisible('auto'); noDoc.input.destroy(); });
  });

  it('drives directions from the d-pad with sliding and multi-touch guards', () => {
    const h = harness({ touch: true });
    const dpad = h.overlayPart('wsp-touch__dpad');
    dpad.rect = { left: 0, top: 0, width: 100, height: 100 };
    const arm = (d) => h.overlayPart(`wsp-touch__arm--${d}`).classList.contains('is-on');
    dpad.dispatchEvent(evt('pointerdown', { clientX: 90, clientY: 50, pointerId: 7, pointerType: 'touch' }));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'pressed'), ['right', ANY_KEY]);
    assert.deepEqual(h.input.axis(), { x: 1, y: 0 });
    assert.equal(arm('right'), true);
    assert.deepEqual(dpad.captures, [7]);
    dpad.dispatchEvent(evt('pointermove', { clientX: 85, clientY: 85, pointerId: 7, pointerType: 'touch' }));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'pressed'), ['down', ANY_KEY]);
    assert.deepEqual(activeActions(h.input, 'held'), ['down', 'right', ANY_KEY]);
    dpad.dispatchEvent(evt('pointermove', { clientX: 50, clientY: 10, pointerId: 7, pointerType: 'touch' }));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'pressed'), ['up', ANY_KEY]);
    assert.deepEqual(activeActions(h.input, 'released'), ['down', 'right', ANY_KEY]);
    assert.equal(arm('up'), true);
    assert.equal(arm('right'), false);
    dpad.dispatchEvent(evt('pointerdown', { clientX: 10, clientY: 50, pointerId: 8, pointerType: 'touch' }));
    dpad.dispatchEvent(evt('pointermove', { clientX: 10, clientY: 50, pointerId: 8, pointerType: 'touch' }));
    h.tick();
    assert.equal(h.input.held('left'), false, 'second finger on the pad is ignored');
    dpad.dispatchEvent(evt('pointerup', { clientX: 10, clientY: 50, pointerId: 8, pointerType: 'touch' }));
    dpad.dispatchEvent(evt('pointermove', { clientX: 50, clientY: 52, pointerId: 7, pointerType: 'touch' }));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'held'), [], 'inside the deadzone releases');
    dpad.dispatchEvent(evt('pointermove', { clientX: 50, clientY: 90, pointerId: 7, pointerType: 'touch' }));
    dpad.dispatchEvent(evt('pointerup', { clientX: 50, clientY: 90, pointerId: 7, pointerType: 'touch' }));
    dpad.dispatchEvent(evt('lostpointercapture', { pointerId: 7 }));
    h.tick();
    assert.equal(h.input.pressed('down'), true);
    assert.equal(h.input.released('down'), true);
    assert.deepEqual(activeActions(h.input, 'held'), []);
  });

  it('maps A / B / MENU buttons and releases them on focus loss', () => {
    const h = harness({ touch: true });
    const btn = (n) => h.overlayPart(`wsp-touch__btn--${n}`);
    btn('a').dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 3, pointerType: 'touch' }));
    btn('b').dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 4, pointerType: 'touch' }));
    btn('menu').dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 5, pointerType: 'touch' }));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'pressed'), ['confirm', 'cancel', 'menu', ANY_KEY]);
    assert.equal(btn('a').classList.contains('is-on'), true);
    btn('a').dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 9, pointerType: 'touch' }));
    btn('b').dispatchEvent(evt('lostpointercapture', { pointerId: 4 }));
    btn('b').dispatchEvent(evt('pointerup', { pointerId: 4 }));
    h.tick();
    assert.equal(h.input.pressed('confirm'), false, 'second finger on A ignored');
    assert.equal(h.input.released('cancel'), true, 'released once despite two end events');
    h.tick();
    assert.equal(h.input.released('cancel'), false);
    h.target.dispatchEvent(new Event('blur'));
    h.tick();
    assert.deepEqual(activeActions(h.input, 'released'), ['confirm', 'menu', ANY_KEY]);
    assert.equal(btn('a').classList.contains('is-on'), false);
    btn('a').dispatchEvent(evt('pointerup', { pointerId: 3 }));
    btn('a').dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 11, pointerType: 'touch' }));
    h.tick();
    assert.equal(h.input.pressed('confirm'), true, 'button is usable again after a blur');
  });

  it('auto mode shows on touch and hides on keyboard or gamepad', () => {
    const h = harness({ touch: 'auto', matchMedia: (q) => ({ matches: q.includes('coarse') }) });
    assert.equal(h.input.touchVisible, true);
    assert.equal(h.input.lastDevice, 'touch');
    h.press('KeyZ');
    assert.equal(h.input.touchVisible, false);
    assert.equal(h.input.lastDevice, 'keyboard');
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' }));
    assert.equal(h.input.touchVisible, true);
    h.target.dispatchEvent(evt('pointerup', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' }));
    const pad = makeGamepad();
    h.pads.push(pad);
    pad.buttons[0].pressed = true;
    h.tick();
    assert.equal(h.input.touchVisible, false);
    assert.equal(h.input.lastDevice, 'gamepad');
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 2, pointerType: 'mouse' }));
    assert.equal(h.input.lastDevice, 'keyboard');
    assert.equal(h.input.touchVisible, false);
  });

  it('respects forcing via query string and setTouchVisible', () => {
    const forced = harness({ touch: 'auto', search: '?touch=1' });
    assert.equal(forced.input.touchVisible, true);
    forced.press('KeyZ');
    assert.equal(forced.input.touchVisible, true, '?touch=1 never auto-hides');
    const h = harness({ touch: 'auto', matchMedia: (q) => ({ matches: q.includes('coarse') }) });
    h.input.setTouchVisible(false);
    assert.equal(h.input.touchVisible, false);
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1, pointerType: 'touch' }));
    assert.equal(h.input.touchVisible, false, 'explicit setting sticks');
    h.input.setTouchVisible('auto');
    assert.equal(h.input.touchVisible, true, 'back to auto follows lastDevice');
    h.press('KeyZ');
    assert.equal(h.input.touchVisible, false);
    h.input.setTouchVisible(true);
    h.press('KeyX');
    assert.equal(h.input.touchVisible, true);
    const hiddenByQuery = harness({ touch: true, search: '?touch=0' });
    assert.equal(hiddenByQuery.input.touchVisible, false);
  });
});

// ---------------------------------------------------------------------------------------------
// Vibration
// ---------------------------------------------------------------------------------------------

describe('vibrate', () => {
  it('uses navigator.vibrate only for touch input', () => {
    const h = harness();
    assert.equal(h.input.vibrate(40), false);
    assert.deepEqual(h.nav.vibrateCalls, []);
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1, pointerType: 'touch' }));
    assert.equal(h.input.vibrate(40), true);
    assert.equal(h.input.vibrate(), true);
    assert.equal(h.input.vibrate(99999), true);
    assert.deepEqual(h.nav.vibrateCalls, [40, 50, 5000]);
    for (const bad of [0, -5, NaN, 'x']) assert.equal(h.input.vibrate(bad), false, String(bad));
    h.input.setVibrationEnabled(false);
    assert.equal(h.input.vibrationEnabled, false);
    assert.equal(h.input.vibrate(40), false);
    h.input.setVibrationEnabled(true);
    assert.equal(h.input.vibrate(40), true);
    const throwing = harness({ nav: { vibrate() { throw new Error('no'); } } });
    throwing.canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1, pointerType: 'touch' }));
    assert.equal(throwing.input.vibrate(10), false);
  });

  it('rumbles gamepads through playEffect or hapticActuators', async () => {
    const h = harness();
    const effects = [];
    const pad = makeGamepad({
      vibrationActuator: { playEffect(type, params) { effects.push([type, params]); return Promise.reject(new Error('unsupported')); } },
    });
    h.pads.push(pad);
    pad.buttons[0].pressed = true;
    h.tick();
    assert.equal(h.input.vibrate(120, { strong: 2, weak: -1 }), true);
    assert.deepEqual(effects, [['dual-rumble', { startDelay: 0, duration: 120, strongMagnitude: 1, weakMagnitude: 0 }]]);
    await new Promise((resolve) => setImmediate(resolve));
    const pulses = [];
    const legacy = harness();
    legacy.pads.push(makeGamepad({ hapticActuators: [{ pulse: (v, ms) => { pulses.push([v, ms]); return true; } }] }));
    legacy.pads[0].buttons[0].pressed = true;
    legacy.tick();
    assert.equal(legacy.input.vibrate(), true);
    assert.deepEqual(pulses, [[0.6, 50]]);
    const broken = harness();
    broken.pads.push(makeGamepad({ vibrationActuator: { playEffect() { throw new Error('nope'); } } }));
    broken.pads[0].buttons[0].pressed = true;
    broken.tick();
    assert.equal(broken.input.vibrate(30), false);
    const plain = harness();
    plain.pads.push(makeGamepad());
    plain.pads[0].buttons[0].pressed = true;
    plain.tick();
    assert.equal(plain.input.vibrate(30), false, 'no actuator: nothing to do, touch vibrate not used');
    assert.deepEqual(plain.nav.vibrateCalls, []);
  });
});

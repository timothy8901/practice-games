// Adversarial tests for js/core/input.js: calls before init, malformed inputs, boundaries,
// zero/negative/NaN clocks, rapid repeated calls, large inputs, determinism, lazy touch DOM,
// destroy semantics and rebind persistence. Self-contained fakes (no DOM, plain Node).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, ANY_KEY, DEFAULT_BINDINGS,
  createInput, parseBindings, tokenFromKeyEvent, tokenDevice, tokenLabel,
} from '../js/core/input.js';

// ---------------------------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------------------------

const evt = (type, props = {}) => Object.assign(new Event(type, { cancelable: true, bubbles: true }), props);

class FakeCanvas extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.rect = { left: 10, top: 20, width: 960, height: 540 };
  }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture() {}
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
  }
  get className() { return [...this.classList.set].join(' '); }
  set className(value) { this.classList.set = new Set(String(value).split(/\s+/).filter(Boolean)); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture() {}
  contains(el) { return el === this || this.children.some((c) => c.contains(el)); }
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

function harness(opts = {}) {
  const target = new EventTarget();
  const canvas = new FakeCanvas();
  const doc = new FakeDocument();
  const pads = [];
  const nav = { maxTouchPoints: 0, getGamepads: () => pads, vibrateCalls: [], vibrate(ms) { this.vibrateCalls.push(ms); return true; } };
  const clock = { t: 0 };
  const display = { toGame: (cx, cy) => ({ x: (cx - 10) / 2, y: (cy - 20) / 2 }) };
  const input = createInput({ canvas, display, target, doc, nav, now: () => clock.t, touch: false, search: '', ...opts });
  const key = (type, code, extra = {}) => { const e = evt(type, { code, ...extra }); target.dispatchEvent(e); return e; };
  const press = (code, extra) => key('keydown', code, extra);
  const release = (code, extra) => key('keyup', code, extra);
  const tick = (ms = 16) => { clock.t += ms; input.update(); };
  const at = (t) => { clock.t = t; input.update(); };
  const overlayRoots = () => doc.body.children.filter((c) => c.classList.contains('wsp-touch'));
  const overlayPart = (cls) => { const root = overlayRoots()[0]; return root ? root.find((e) => e.classList.contains(cls)) : null; };
  return { input, target, canvas, doc, nav, pads, clock, key, press, release, tick, at, overlayRoots, overlayPart };
}

const ALL = [...ACTIONS, ANY_KEY];
const active = (input, fn) => ALL.filter((a) => input[fn](a));
const snapshot = (input) => JSON.stringify({
  p: active(input, 'pressed'), h: active(input, 'held'), r: active(input, 'released'), a: input.axis(), ptr: input.pointer,
});

// ---------------------------------------------------------------------------------------------
// Calls before init / idle behaviour
// ---------------------------------------------------------------------------------------------

describe('before init', () => {
  it('every query is safe before the first update()', () => {
    const { input } = harness();
    for (const a of ALL) {
      assert.equal(input.pressed(a), false);
      assert.equal(input.held(a), false);
      assert.equal(input.released(a), false);
      assert.equal(input.repeat(a), false);
    }
    for (const a of ACTIONS) assert.equal(input.heldFor(a), 0);
    assert.deepEqual(input.axis(), { x: 0, y: 0 });
    assert.equal(input.lastPressedToken(), null);
    assert.doesNotThrow(() => input.flush());
    assert.doesNotThrow(() => input.flush());
    assert.equal(input.vibrate(10), false);
    assert.equal(input.frame, 0);
  });

  it('a key-down buffered before the first update, then flushed, is never a press', () => {
    const { input, press, release, tick } = harness();
    press('KeyZ');
    input.flush();
    for (let i = 0; i < 50; i++) {
      tick();
      assert.equal(input.pressed('confirm'), false, `frame ${i}`);
      assert.equal(input.held('confirm'), true, `frame ${i}`);
      assert.equal(input.repeat('confirm', { delay: 0, rate: 1 }), false, `frame ${i}: no repeat either`);
    }
    release('KeyZ');
    tick();
    assert.equal(input.released('confirm'), true);
  });

  it('survives thousands of idle updates and flushes', () => {
    const { input, tick } = harness();
    for (let i = 0; i < 10000; i++) { tick(); if (i % 7 === 0) input.flush(); }
    assert.equal(input.frame, 10000);
    assert.deepEqual(active(input, 'held'), []);
    assert.deepEqual(input.pointer, { x: 0, y: 0, down: false, justDown: false, justUp: false, inside: false, type: '', button: 0 });
  });

  it('works without window, document or navigator (pointer only)', () => {
    const canvas = new FakeCanvas();
    let input;
    assert.doesNotThrow(() => { input = createInput({ canvas, target: null, doc: null, nav: null, search: '' }); });
    canvas.dispatchEvent(evt('pointerdown', { clientX: 490, clientY: 290, pointerId: 1, pointerType: 'mouse' }));
    input.update();
    assert.equal(input.pointer.justDown, true);
    assert.equal(input.pointer.x, 240);
    assert.equal(input.touchVisible, false);
    assert.equal(input.gamepads, 0);
    assert.doesNotThrow(() => input.setTouchVisible(true));
    assert.doesNotThrow(() => input.destroy());
  });

  it('tolerates a bad `now`, a bad deadzone and a bad display size', () => {
    for (const now of [null, 'x', 42, undefined]) {
      const h = harness({ now });
      assert.doesNotThrow(() => h.input.update(), `now=${String(now)}`);
      h.press('ShiftLeft');
      h.input.update();
      assert.equal(h.input.held('run'), true);
      assert.ok(h.input.heldFor('run') >= 0);
    }
    const loose = harness({ deadzone: 0 });
    loose.pads.push(makeGamepad({ axes: [0.06, 0, 0, 0] }));
    loose.tick();
    assert.equal(loose.input.held('right'), true, 'deadzone 0 clamps to the 0.05 floor, not to the 0.5 default');
    for (const dz of [NaN, 'abc', Infinity, -1]) {
      const h = harness({ deadzone: dz });
      h.pads.push(makeGamepad({ axes: [0.3, 0, 0, 0] }));
      h.tick();
      assert.equal(h.input.held('right'), dz === -1, `deadzone ${String(dz)}`);
    }
    const sized = harness({ display: { toGame: (x, y) => ({ x, y }), width: 320, height: 180 } });
    sized.target.dispatchEvent(evt('pointermove', { clientX: 319, clientY: 179, pointerId: 1 }));
    sized.tick();
    assert.equal(sized.input.pointer.inside, true, 'uses display.width/height');
    sized.target.dispatchEvent(evt('pointermove', { clientX: 320, clientY: 10, pointerId: 1 }));
    sized.tick();
    assert.equal(sized.input.pointer.inside, false);
    const junkSize = harness({ width: -5, height: NaN, display: { toGame: (x, y) => ({ x, y }), width: 'a', height: 0 } });
    junkSize.target.dispatchEvent(evt('pointermove', { clientX: 479, clientY: 269, pointerId: 1 }));
    junkSize.tick();
    assert.equal(junkSize.input.pointer.inside, true, 'falls back to 480x270');
  });
});

// ---------------------------------------------------------------------------------------------
// Malformed inputs
// ---------------------------------------------------------------------------------------------

describe('malformed inputs', () => {
  it('rejects non-action names consistently', () => {
    const { input } = harness();
    for (const bad of [null, undefined, '', 1, {}, 'UP', 'any', 'anykey', 'constructor', '__proto__']) {
      for (const fn of ['pressed', 'held', 'released', 'repeat', 'heldFor']) {
        assert.throws(() => input[fn](bad), RangeError, `${fn}(${String(bad)})`);
      }
      assert.throws(() => input.rebind(bad, 'KeyJ'), RangeError);
      assert.throws(() => input.addBinding(bad, 'KeyJ'), RangeError);
      assert.throws(() => input.removeBinding(bad, 'KeyJ'), RangeError);
    }
    assert.deepEqual(input.actionsFor(null), []);
    assert.deepEqual(input.actionsFor('constructor'), []);
  });

  it('accepts null / junk option bags', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(0);
    assert.equal(input.repeat('down', null), true);
    at(299);
    assert.equal(input.repeat('down', 'x'), false, 'defaults still apply');
    at(300);
    assert.equal(input.repeat('down', { delay: 'a', rate: null }), true);
    at(379);
    assert.equal(input.repeat('down', { delay: NaN, rate: {} }), false);
    at(380);
    assert.equal(input.repeat('down', { delay: Infinity, rate: 80 }), true, 'options are read fresh but the armed timer stands');
    assert.doesNotThrow(() => input.rebind('up', 'KeyI', null));
    assert.doesNotThrow(() => input.rebind('up', 'KeyI', 'slot'));
    assert.deepEqual(input.rebind('up', ''), ['gp:b12', 'gp:axis1-', 'touch:up'], 'empty string unbinds the keyboard');
    assert.deepEqual(input.rebind('up', 'KeyW', { slot: NaN }), ['KeyW', 'gp:b12', 'gp:axis1-', 'touch:up']);
    assert.deepEqual(input.rebind('up', 'KeyI', { slot: Infinity }), ['KeyW', 'KeyI', 'gp:b12', 'gp:axis1-', 'touch:up']);
    assert.deepEqual(input.rebind('up', 'ArrowUp', { slot: '1' }), ['KeyW', 'ArrowUp', 'gp:b12', 'gp:axis1-', 'touch:up']);
    assert.doesNotThrow(() => input.vibrate(50, null));
    assert.doesNotThrow(() => input.vibrate(50, { strong: 'x', weak: null }));
  });

  it('vibrate coerces and clamps durations', () => {
    const h = harness();
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1, pointerType: 'touch' }));
    assert.equal(h.input.vibrate('40'), true);
    assert.equal(h.input.vibrate(0.4), true);
    assert.equal(h.input.vibrate(Infinity), true);
    assert.equal(h.input.vibrate(-Infinity), false);
    assert.deepEqual(h.nav.vibrateCalls, [40, 1, 5000]);
    const pulses = [];
    const g = harness();
    g.pads.push(makeGamepad({ hapticActuators: [{ pulse: (v, ms) => { pulses.push([v, ms]); return true; } }] }));
    g.pads[0].buttons[0].pressed = true;
    g.tick();
    assert.equal(g.input.vibrate(20, { strong: 'x', weak: NaN }), true);
    assert.deepEqual(pulses, [[0.6, 20]], 'bad magnitudes fall back to defaults');
  });

  it('does not trust a keyboard event whose code is not a keyboard token', () => {
    const { input, key, tick } = harness();
    key('keydown', 'gp:b0');
    key('keydown', 'touch:a');
    key('keydown', 'Key Z');
    key('keydown', 'Unidentified', { key: 'Unidentified' });
    key('keydown', 123, { key: 'Dead' });
    tick();
    assert.deepEqual(active(input, 'pressed'), [], 'none of them is a press (not even anyKey)');
    key('keydown', 'gp:b0', { key: 'z' });
    tick();
    assert.deepEqual(active(input, 'pressed'), ['confirm', ANY_KEY], 'falls back to the key name');
    assert.equal(tokenFromKeyEvent({ code: 'gp:b0' }), null);
    assert.equal(tokenFromKeyEvent({ code: 'gp:b0', key: 'Enter' }), 'Enter');
  });

  it('maps punctuation key names when code is missing (default l / r)', () => {
    const { input, key, tick } = harness();
    key('keydown', '', { key: '[' });
    key('keydown', '', { key: ']' });
    tick();
    assert.deepEqual(active(input, 'pressed'), ['l', 'r', ANY_KEY]);
    assert.equal(tokenFromKeyEvent({ key: '`' }), 'Backquote');
    assert.equal(tokenFromKeyEvent({ key: '\\' }), 'Backslash');
    assert.equal(tokenFromKeyEvent({ key: '/' }), 'Slash');
    assert.equal(tokenFromKeyEvent({ key: '€' }), null);
  });

  it('lets the modifier keys themselves register while still skipping Ctrl/Cmd shortcuts', () => {
    const { input, press, release, tick } = harness();
    press('ControlLeft', { ctrlKey: true });
    press('KeyS', { ctrlKey: true });
    tick();
    assert.deepEqual(active(input, 'pressed'), [ANY_KEY]);
    assert.equal(input.lastPressedToken(), 'ControlLeft');
    release('KeyS', { ctrlKey: true });
    release('ControlLeft');
    tick();
    assert.deepEqual(active(input, 'released'), [ANY_KEY]);
    input.addBinding('run', 'ControlLeft');
    press('ControlLeft', { ctrlKey: true });
    tick();
    assert.equal(input.held('run'), true, 'Ctrl is bindable');
    release('ControlLeft');
    tick();
    assert.equal(input.released('run'), true);
  });

  it('keeps going when the display or pointer coordinates are broken', () => {
    const throwing = harness({ display: { toGame() { throw new Error('display gone'); } } });
    assert.doesNotThrow(() => throwing.canvas.dispatchEvent(evt('pointerdown', { clientX: 490, clientY: 290, pointerId: 1 })));
    throwing.tick();
    assert.equal(throwing.input.pointer.justDown, true);
    assert.deepEqual([throwing.input.pointer.x, throwing.input.pointer.y], [240, 135], 'falls back to the canvas rect');
    const { input, canvas, target, tick } = harness();
    canvas.dispatchEvent(evt('pointerdown', { clientX: NaN, clientY: undefined, pointerId: 'a', pointerType: 7, button: 'left' }));
    tick();
    assert.equal(input.pointer.justDown, true);
    assert.ok(Number.isFinite(input.pointer.x) && Number.isFinite(input.pointer.y));
    assert.equal(input.pointer.type, '');
    assert.equal(input.pointer.button, 0);
    target.dispatchEvent(evt('pointerup', { clientX: 1e308 * 10, clientY: -Infinity }));
    tick();
    assert.equal(input.pointer.down, false, 'a pointerId-less up matches the pointerId-less down');
    assert.ok(Number.isFinite(input.pointer.x) && Number.isFinite(input.pointer.y));
  });

  it('tolerates junk gamepad records', () => {
    const { input, pads, tick } = harness();
    pads.push(
      undefined,
      { connected: true },
      { connected: true, buttons: null, axes: null },
      { connected: true, buttons: [null, undefined, { pressed: 'true' }, { value: NaN }, { value: 'x' }, { pressed: true }], axes: [NaN, 'x', null, {}, 1, 1] },
      makeGamepad({ axes: ['-0.9', 0] }),
    );
    assert.doesNotThrow(() => tick());
    assert.equal(input.gamepads, 4);
    assert.deepEqual(active(input, 'held'), ['left', 'r', ANY_KEY], 'only b5 (pressed: true) and the stringly -0.9 axis count');
    assert.equal(input.lastPressedToken(), 'gp:axis0-');
  });

  it('parseBindings / loadBindings ignore prototype keys and odd shapes', () => {
    const { input } = harness();
    assert.equal(input.loadBindings('{"__proto__":{"polluted":1},"constructor":["KeyA"],"up":["KeyI"]}'), true);
    assert.equal(({}).polluted, undefined);
    assert.deepEqual(input.bindings().up, ['KeyI']);
    assert.equal(input.loadBindings({ bindings: { up: ['KeyK'] }, up: ['KeyJ'] }), true);
    assert.deepEqual(input.bindings().up, ['KeyK'], 'nested document wins over stray top-level keys');
    assert.equal(input.loadBindings({ bindings: 'x', up: ['KeyJ'] }), true);
    assert.deepEqual(input.bindings().up, ['KeyJ'], 'non-object bindings field: the bare table is used');
    assert.equal(input.loadBindings({ version: 'abc', bindings: { down: ['KeyK'] } }), true, 'version is advisory');
    assert.equal(input.loadBindings({ up: { 0: 'KeyI' } }), false);
    assert.equal(input.loadBindings({ up: [null, 1, {}, [], 'gp:', 'touch:z'] }), false, 'all-bad list is no document');
    assert.equal(input.loadBindings(''), false);
    assert.equal(input.loadBindings('null'), false);
    assert.equal(input.loadBindings('"KeyA"'), false);
    assert.equal(input.loadBindings(() => {}), false);
    assert.deepEqual(parseBindings({ up: 'KeyI' }), { bindings: { up: ['KeyI'] }, dropped: [] });
  });

  it('collapses a huge duplicated token list', () => {
    const { input } = harness();
    const list = Array.from({ length: 10000 }, (_, i) => (i % 3 === 0 ? 'KeyI' : i % 3 === 1 ? 'gp:b7' : 'nope!'));
    assert.equal(input.loadBindings({ up: list }), true);
    assert.deepEqual(input.bindings().up, ['KeyI', 'gp:b7']);
    const parsed = parseBindings({ up: list });
    assert.equal(parsed.dropped.length, 10000 - 2);
  });

  it('rebind never aliases the frozen defaults', () => {
    const { input } = harness();
    input.resetBindings();
    input.addBinding('up', 'KeyI');
    assert.deepEqual([...DEFAULT_BINDINGS.up], ['ArrowUp', 'KeyW', 'gp:b12', 'gp:axis1-', 'touch:up']);
    input.rebind('up', null, { device: 'touch' });
    assert.ok(Object.isFrozen(DEFAULT_BINDINGS.up));
    const copy = input.bindings();
    copy.up.length = 0;
    assert.ok(input.bindings().up.length > 0);
  });
});

// ---------------------------------------------------------------------------------------------
// Edge semantics under stress
// ---------------------------------------------------------------------------------------------

describe('edge semantics under stress', () => {
  it('a thousand taps in one frame is one pressed + one released, never held', () => {
    const { input, press, release, tick } = harness();
    for (let i = 0; i < 1000; i++) { press('KeyZ'); release('KeyZ'); }
    tick();
    assert.equal(input.pressed('confirm'), true);
    assert.equal(input.released('confirm'), true);
    assert.equal(input.held('confirm'), false);
    tick();
    assert.deepEqual(active(input, 'pressed'), []);
    assert.deepEqual(active(input, 'released'), []);
  });

  it('key-ups without key-downs, duplicate downs and duplicate ups are inert', () => {
    const { input, press, release, tick } = harness();
    release('KeyZ');
    release('KeyZ');
    tick();
    assert.deepEqual(active(input, 'released'), []);
    press('KeyZ');
    press('KeyZ');
    press('KeyZ');
    tick();
    assert.equal(input.pressed('confirm'), true);
    tick();
    assert.equal(input.pressed('confirm'), false, 'duplicate downs are one press');
    release('KeyZ');
    release('KeyZ');
    tick();
    assert.equal(input.released('confirm'), true);
    tick();
    assert.equal(input.released('confirm'), false);
  });

  it('flush in the middle of a frame clears the latched press but keeps the hold', () => {
    const { input, press, release, tick } = harness();
    press('ArrowRight');
    tick();
    assert.equal(input.pressed('right'), true);
    assert.deepEqual(input.axis(), { x: 1, y: 0 });
    input.flush();
    assert.equal(input.pressed('right'), false);
    assert.equal(input.pressed(ANY_KEY), false);
    assert.deepEqual(input.axis(), { x: 1, y: 0 }, 'held state is movement, not a press');
    tick();
    assert.equal(input.pressed('right'), false);
    assert.equal(input.held('right'), true);
    release('ArrowRight');
    tick();
    assert.equal(input.released('right'), true);
  });

  it('a tap wholly inside a flushed window still reports its release only', () => {
    const { input, press, release, tick } = harness();
    press('KeyX');
    input.flush();
    release('KeyX');
    tick();
    assert.equal(input.pressed('cancel'), false);
    assert.equal(input.held('cancel'), false);
    assert.equal(input.released('cancel'), true);
  });

  it('swapping between two tokens of one action never produces a spurious release', () => {
    const { input, press, release, tick } = harness();
    press('ArrowUp');
    tick();
    for (let i = 0; i < 200; i++) {
      const [next, prev] = i % 2 === 0 ? ['KeyW', 'ArrowUp'] : ['ArrowUp', 'KeyW'];
      press(next);
      release(prev);
      tick();
      assert.equal(input.held('up'), true, `frame ${i} held`);
      assert.equal(input.released('up'), false, `frame ${i} not released`);
      assert.equal(input.pressed('up'), true, `frame ${i} the new key is a fresh press`);
    }
  });

  it('a thousand flushes are harmless', () => {
    const { input, press, tick } = harness();
    press('KeyZ');
    tick();
    for (let i = 0; i < 1000; i++) input.flush();
    assert.equal(input.held('confirm'), true);
    tick();
    assert.equal(input.held('confirm'), true);
  });

  it('blur / enable toggles spammed between frames stay consistent', () => {
    const { input, press, target, tick } = harness();
    press('KeyZ');
    tick();
    for (let i = 0; i < 100; i++) {
      target.dispatchEvent(new Event('blur'));
      input.setEnabled(false);
      input.setEnabled(true);
    }
    tick();
    assert.equal(input.released('confirm'), true);
    assert.equal(input.held('confirm'), false);
    tick();
    assert.equal(input.released('confirm'), false);
  });
});

// ---------------------------------------------------------------------------------------------
// Auto-repeat timing under hostile clocks
// ---------------------------------------------------------------------------------------------

describe('repeat timing', () => {
  it('a NaN clock neither throws nor repeats forever', () => {
    const h = harness({ now: () => NaN });
    h.press('ArrowDown');
    assert.doesNotThrow(() => h.input.update());
    assert.equal(h.input.repeat('down'), true, 'the press itself still fires');
    assert.equal(h.input.heldFor('down'), 0);
    let fired = 0;
    for (let i = 0; i < 100; i++) { h.input.update(); if (h.input.repeat('down')) fired += 1; }
    assert.ok(fired <= 1, `frozen clock: at most one repeat, got ${fired}`);
  });

  it('a clock that runs backwards or stalls never bursts', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(1000);
    assert.equal(input.repeat('down'), true);
    at(500);
    assert.equal(input.repeat('down'), false);
    assert.equal(input.heldFor('down'), 0, 'negative hold clamps to 0');
    at(1299);
    assert.equal(input.repeat('down'), false);
    at(1300);
    assert.equal(input.repeat('down'), true);
    at(1200);
    assert.equal(input.repeat('down'), false);
    at(50000);
    assert.equal(input.repeat('down'), true, 'after a long stall');
    at(50001);
    assert.equal(input.repeat('down'), false, 'no catch-up burst');
    at(50080);
    assert.equal(input.repeat('down'), true);
  });

  it('negative timestamps and zero delay / unit rate work frame by frame', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(-1000);
    assert.equal(input.repeat('down', { delay: 0, rate: 1 }), true);
    at(-984);
    assert.equal(input.repeat('down', { delay: 0, rate: 1 }), true);
    at(-968);
    assert.equal(input.repeat('down', { delay: 0, rate: 1 }), true);
    assert.equal(input.repeat('down', { delay: 0, rate: 1 }), true, 'still once per frame');
    assert.equal(input.heldFor('down'), 32);
  });

  it('a press that repeat() did not observe never arms (edge-triggered by design)', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(0); // nobody asks this frame
    for (const t of [16, 300, 1000, 5000]) {
      at(t);
      assert.equal(input.repeat('down'), false, `t=${t}`);
      assert.equal(input.held('down'), true);
    }
  });

  it('actions repeat independently and a second key re-arms the delay', () => {
    const { input, press, at } = harness();
    press('ArrowDown');
    at(0);
    assert.equal(input.repeat('down'), true);
    assert.equal(input.repeat('right'), false);
    press('ArrowRight');
    at(100);
    assert.equal(input.repeat('right'), true);
    assert.equal(input.repeat('down'), false);
    at(300);
    assert.equal(input.repeat('down'), true);
    assert.equal(input.repeat('right'), false);
    press('KeyS'); // second physical key for `down`
    at(310);
    assert.equal(input.repeat('down'), true, 'fresh press');
    at(400);
    assert.equal(input.repeat('right'), true);
    assert.equal(input.repeat('down'), false, 'delay restarted at 310');
    at(610);
    assert.equal(input.repeat('down'), true);
  });

  it('the pressed frame wins even if the key was released in the same frame', () => {
    const { input, press, release, at } = harness();
    press('ArrowDown');
    release('ArrowDown');
    at(0);
    assert.equal(input.repeat('down'), true);
    at(400);
    assert.equal(input.repeat('down'), false);
  });
});

// ---------------------------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------------------------

describe('determinism', () => {
  it('the same event script on two instances yields identical per-frame traces', () => {
    const script = (h) => {
      const trace = [];
      const step = () => { h.tick(16); trace.push(snapshot(h.input), h.input.repeat('down', { delay: 40, rate: 20 }), h.input.heldFor('run')); };
      h.press('ArrowDown'); step();
      h.press('ShiftLeft'); step(); step();
      h.canvas.dispatchEvent(evt('pointerdown', { clientX: 300, clientY: 200, pointerId: 1, pointerType: 'mouse' })); step();
      h.input.flush(); step();
      h.press('KeyZ'); h.release('KeyZ'); step();
      const pad = makeGamepad(); h.pads.push(pad); pad.buttons[1].pressed = true; step();
      pad.axes[0] = -1; step(); step();
      h.release('ArrowDown'); h.target.dispatchEvent(evt('pointerup', { clientX: 300, clientY: 200, pointerId: 1 })); step();
      h.target.dispatchEvent(new Event('blur')); step(); step();
      return trace;
    };
    const a = script(harness());
    const b = script(harness());
    assert.deepEqual(a, b);
    assert.ok(a.some((s) => typeof s === 'string' && s.includes('"down"')), 'trace is not trivially empty');
  });
});

// ---------------------------------------------------------------------------------------------
// Large inputs
// ---------------------------------------------------------------------------------------------

describe('large inputs', () => {
  it('handles pads with many buttons and axes (only the first four axes are digitised)', () => {
    const { input, pads, tick } = harness();
    const pad = makeGamepad({ buttons: Array.from({ length: 64 }, () => ({ pressed: false, value: 0 })), axes: Array.from({ length: 12 }, () => 0) });
    pads.push(pad);
    input.addBinding('tool', 'gp:b63');
    pad.buttons[63].pressed = true;
    pad.axes[4] = 1;
    pad.axes[11] = -1;
    tick();
    assert.deepEqual(active(input, 'pressed'), ['tool', ANY_KEY]);
    assert.equal(input.lastPressedToken(), 'gp:b63');
    assert.equal(tokenLabel('gp:b63'), 'B63');
    assert.equal(tokenDevice('gp:b100'), null, 'three-digit button indices are out of range');
    assert.equal(tokenDevice('gp:axis4+'), null, 'axes that are never polled are not valid tokens');
    assert.throws(() => input.addBinding('tool', 'gp:axis4+'), TypeError);
    assert.equal(input.loadBindings({ tool: ['gp:axis9-', 'gp:axis3-'] }), true);
    assert.deepEqual(input.bindings().tool, ['gp:axis3-']);
  });

  it('merges four pads pressing the same button into one action', () => {
    const { input, pads, tick } = harness();
    for (let i = 0; i < 4; i++) pads.push(makeGamepad());
    for (const pad of pads) pad.buttons[0].pressed = true;
    tick();
    assert.equal(input.pressed('confirm'), true);
    tick();
    assert.equal(input.pressed('confirm'), false);
    pads[0].buttons[0].pressed = false;
    pads[1].buttons[0].pressed = false;
    tick();
    assert.equal(input.held('confirm'), true, 'still held by the other pads');
    assert.equal(input.released('confirm'), false);
    for (const pad of pads) pad.buttons[0].pressed = false;
    tick();
    assert.equal(input.released('confirm'), true);
  });

  it('carries hundreds of bindings on one action through save / load', () => {
    const { input, press, tick } = harness();
    const keys = [];
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') keys.push(`Key${letter}`);
    for (let i = 0; i < 10; i++) keys.push(`Digit${i}`, `Numpad${i}`);
    for (let i = 1; i <= 24; i++) keys.push(`F${i}`);
    for (let i = 0; i < 40; i++) keys.push(`gp:b${i}`);
    for (const k of keys) input.addBinding('select', k);
    const json = input.saveBindings();
    const fresh = harness();
    assert.equal(fresh.input.loadBindings(json), true);
    assert.deepEqual(fresh.input.bindings(), input.bindings());
    assert.equal(fresh.input.bindings().select.length, new Set([...DEFAULT_BINDINGS.select, ...keys]).size, 'gp:b8 is already a default');
    press('F13');
    tick();
    assert.equal(input.held('select'), true);
  });

  it('a key held for ten thousand frames keeps an exact hold time', () => {
    const { input, press, tick } = harness();
    press('ShiftLeft');
    for (let i = 0; i < 10000; i++) tick(16);
    assert.equal(input.heldFor('run'), 16 * 9999);
    assert.equal(input.held('run'), true);
    assert.equal(input.pressed('run'), false);
  });
});

// ---------------------------------------------------------------------------------------------
// Lazy touch overlay DOM
// ---------------------------------------------------------------------------------------------

describe('lazy touch overlay', () => {
  const fine = (q) => ({ matches: q.includes('fine') });

  it('creates no DOM on a mouse-and-keyboard device until a touch is seen', () => {
    const h = harness({ touch: 'auto', matchMedia: fine });
    assert.equal(h.overlayRoots().length, 0);
    assert.equal(h.doc.head.children.length, 0, 'no stylesheet either');
    h.press('KeyZ');
    h.tick();
    h.pads.push(makeGamepad());
    h.pads[0].buttons[0].pressed = true;
    h.tick();
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' }));
    h.target.dispatchEvent(evt('pointerup', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'mouse' }));
    h.tick();
    assert.equal(h.overlayRoots().length, 0, 'keyboard, gamepad and mouse never build it');
    assert.equal(h.input.touchVisible, false);
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 2, pointerType: 'touch' }));
    assert.equal(h.overlayRoots().length, 1, 'first touch builds it');
    assert.equal(h.input.touchVisible, true);
    assert.equal(h.doc.head.children.filter((c) => c.id === 'wsp-touch-style').length, 1);
    h.press('KeyX');
    assert.equal(h.input.touchVisible, false, 'keyboard hides it again');
    assert.equal(h.overlayRoots().length, 1, 'but it is not rebuilt');
    assert.equal(h.overlayRoots()[0].hidden, true);
    h.target.dispatchEvent(evt('pointerup', { clientX: 100, clientY: 100, pointerId: 2, pointerType: 'touch' }));
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 3, pointerType: 'touch' }));
    assert.equal(h.overlayRoots().length, 1);
    assert.equal(h.input.touchVisible, true);
  });

  it('never builds it when touch is false, even after a touch or setTouchVisible(true)', () => {
    const h = harness({ touch: false, matchMedia: (q) => ({ matches: q.includes('coarse') }) });
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1, pointerType: 'touch' }));
    h.input.setTouchVisible(true);
    h.input.setTouchVisible('auto');
    assert.equal(h.overlayRoots().length, 0);
    assert.equal(h.input.touchVisible, false);
    assert.equal(h.input.lastDevice, 'touch');
  });

  it('?touch=1 beats touch:false and builds it immediately; ?touch=0 beats a coarse pointer', () => {
    const forced = harness({ touch: false, search: '?x=1&touch=1' });
    assert.equal(forced.overlayRoots().length, 1);
    assert.equal(forced.input.touchVisible, true);
    forced.press('KeyZ');
    assert.equal(forced.input.touchVisible, true);
    const off = harness({ touch: 'auto', search: '?touch=0', matchMedia: (q) => ({ matches: q.includes('coarse') }) });
    assert.equal(off.overlayRoots().length, 0);
    off.canvas.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 1, pointerType: 'touch' }));
    assert.equal(off.overlayRoots().length, 0, 'forced off stays off on touch');
    off.input.setTouchVisible(true);
    assert.equal(off.overlayRoots().length, 1, 'an explicit API call still wins');
    assert.equal(off.input.touchVisible, true);
  });

  it('setTouchVisible(true) builds it on demand and auto returns to following the device', () => {
    const h = harness({ touch: 'auto', matchMedia: fine });
    h.input.setTouchVisible(false);
    assert.equal(h.overlayRoots().length, 0, 'hiding what does not exist builds nothing');
    h.input.setTouchVisible(true);
    assert.equal(h.overlayRoots().length, 1);
    assert.equal(h.input.touchVisible, true);
    h.press('KeyZ');
    assert.equal(h.input.touchVisible, true, 'forced on ignores the keyboard');
    h.input.setTouchVisible('auto');
    assert.equal(h.input.touchVisible, false, 'auto follows lastDevice (keyboard)');
  });

  it('the overlay works the moment it is built (same frame as the first touch)', () => {
    const h = harness({ touch: 'auto', matchMedia: fine });
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' }));
    h.target.dispatchEvent(evt('pointerup', { clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' }));
    const a = h.overlayPart('wsp-touch__btn--a');
    a.dispatchEvent(evt('pointerdown', { clientX: 1, clientY: 1, pointerId: 2, pointerType: 'touch' }));
    h.tick();
    assert.deepEqual(active(h.input, 'pressed'), ['confirm', ANY_KEY]);
    assert.equal(h.input.pointer.justDown, true, 'the canvas tap is still the game pointer');
  });

  it('pointer moves that come from the overlay do not drag the game pointer', () => {
    const h = harness({ touch: true });
    h.target.dispatchEvent(evt('pointermove', { clientX: 110, clientY: 120, pointerId: 1, pointerType: 'mouse' }));
    h.tick();
    assert.deepEqual([h.input.pointer.x, h.input.pointer.y], [50, 50]);
    const dpad = h.overlayPart('wsp-touch__dpad');
    const fromDpad = evt('pointermove', { clientX: 900, clientY: 500, pointerId: 7, pointerType: 'touch' });
    Object.defineProperty(fromDpad, 'target', { value: dpad });
    h.target.dispatchEvent(fromDpad);
    const fromArm = evt('pointermove', { clientX: 900, clientY: 500, pointerId: 7, pointerType: 'touch' });
    Object.defineProperty(fromArm, 'target', { value: h.overlayPart('wsp-touch__arm--up') });
    h.target.dispatchEvent(fromArm);
    h.tick();
    assert.deepEqual([h.input.pointer.x, h.input.pointer.y], [50, 50], 'unchanged');
    assert.equal(h.input.pointer.type, 'mouse');
    h.canvas.dispatchEvent(evt('pointerdown', { clientX: 210, clientY: 220, pointerId: 1, pointerType: 'mouse' }));
    const dragged = evt('pointermove', { clientX: 310, clientY: 320, pointerId: 1, pointerType: 'mouse' });
    Object.defineProperty(dragged, 'target', { value: dpad });
    h.target.dispatchEvent(dragged);
    h.tick();
    assert.deepEqual([h.input.pointer.x, h.input.pointer.y], [150, 150], 'the captured game pointer always tracks');
  });
});

// ---------------------------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------------------------

describe('destroy', () => {
  it('stops gamepad polling and cannot be re-enabled', () => {
    const h = harness({ touch: true });
    const pad = makeGamepad();
    h.pads.push(pad);
    pad.buttons[0].pressed = true;
    h.tick();
    assert.equal(h.input.pressed('confirm'), true);
    h.input.destroy();
    assert.equal(h.overlayRoots().length, 0);
    h.tick();
    assert.equal(h.input.released('confirm'), true, 'destroy releases what was held');
    pad.buttons[0].pressed = false;
    h.tick();
    pad.buttons[0].pressed = true;
    h.tick();
    assert.deepEqual(active(h.input, 'pressed'), [], 'no gamepad input after destroy');
    assert.equal(h.input.enabled, false);
    h.input.setEnabled(true);
    assert.equal(h.input.enabled, false);
    h.input.setTouchVisible(true);
    assert.equal(h.overlayRoots().length, 0, 'no overlay resurrection');
    assert.equal(h.input.touchVisible, false);
    assert.equal(h.input.vibrate(10), false);
    assert.doesNotThrow(() => { h.input.flush(); h.input.destroy(); h.tick(); });
    assert.equal(h.input.bindings().confirm.length > 0, true, 'bindings survive (pure data)');
  });
});

// ---------------------------------------------------------------------------------------------
// Rebind persistence
// ---------------------------------------------------------------------------------------------

describe('rebind persistence', () => {
  it('save -> load is idempotent and an identity for the defaults', () => {
    const a = harness();
    const defaults = a.input.saveBindings();
    assert.equal(a.input.loadBindings(defaults), true);
    assert.deepEqual(a.input.bindings(), DEFAULT_BINDINGS);
    a.input.rebind('confirm', 'KeyJ');
    a.input.rebind('cancel', ['KeyK', 'Escape']);
    a.input.rebind('run', null, { device: 'gamepad' });
    const once = a.input.saveBindings();
    assert.equal(a.input.loadBindings(once), true);
    assert.equal(a.input.saveBindings(), once, 'loading what was saved changes nothing');
    assert.equal(a.input.loadBindings(JSON.parse(once)), true, 'object form too');
    assert.equal(a.input.saveBindings(), once);
    const doc = JSON.parse(once);
    assert.equal(doc.version, 1);
    assert.deepEqual(doc.bindings.confirm, ['KeyJ', 'gp:b0', 'touch:a']);
    assert.deepEqual(doc.bindings.run, ['ShiftLeft', 'ShiftRight']);
  });

  it('a save with every keyboard binding removed restores to keyboard-less play', () => {
    const a = harness();
    for (const action of ACTIONS) a.input.rebind(action, null, { device: 'keyboard' });
    const json = a.input.saveBindings();
    const b = harness();
    assert.equal(b.input.loadBindings(json), true);
    for (const action of ACTIONS) assert.ok(b.input.bindings()[action].every((t) => tokenDevice(t) !== 'keyboard'), action);
    b.press('KeyZ');
    b.press('ArrowUp');
    b.tick();
    assert.deepEqual(active(b.input, 'pressed'), [ANY_KEY]);
    assert.deepEqual(b.input.axis(), { x: 0, y: 0 });
    assert.equal(b.press('Space').defaultPrevented, false, 'unbound keys are left to the browser');
  });

  it('a hand-edited save with a typo keeps the default for that action only', () => {
    const { input } = harness();
    assert.equal(input.loadBindings({ confirm: ['KeyJ'], cancel: ['Key K'], menu: ['KeyM', 'gp:b9x'] }), true);
    assert.deepEqual(input.bindings().confirm, ['KeyJ']);
    assert.deepEqual(input.bindings().cancel, DEFAULT_BINDINGS.cancel, 'all-bad list: default kept');
    assert.deepEqual(input.bindings().menu, ['KeyM'], 'partially bad list: good tokens kept');
  });

  it('a binding change made while a key is held takes effect on the next frame', () => {
    const { input, press, release, tick } = harness();
    press('KeyZ');
    tick();
    assert.equal(input.held('confirm'), true);
    input.loadBindings({ confirm: ['KeyJ'], tool: ['KeyZ'] });
    tick();
    assert.equal(input.held('confirm'), false);
    assert.equal(input.held('tool'), true);
    assert.equal(input.pressed('tool'), false, 'retargeting a held key is not a press');
    release('KeyZ');
    tick();
    assert.equal(input.released('tool'), true);
    assert.equal(input.released('confirm'), false);
  });
});

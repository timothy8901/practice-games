import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MODES,
  isDisplayMode,
  normalizeDpr,
  computeLayout,
  pointToGame,
  gameToPoint,
  createDisplay,
} from '../js/core/canvas.js';

// ---------------------------------------------------------------------------------------------
// Minimal fake DOM so the browser-only wiring can be exercised under Node.
// ---------------------------------------------------------------------------------------------

class FakeCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.imageSmoothingEnabled = true;
    this.fillStyle = '#000000';
    this.ops = [];
  }
  fillRect(...args) {
    this.ops.push({ op: 'fillRect', args, fillStyle: this.fillStyle });
  }
  clearRect(...args) {
    this.ops.push({ op: 'clearRect', args });
  }
  drawImage(...args) {
    this.ops.push({ op: 'drawImage', args });
  }
}

class FakeCanvas {
  constructor() {
    this.tagName = 'CANVAS';
    this.style = {};
    this.parentNode = null;
    this.ctx = null;
    this.contextAttrs = null;
    this.sizeWrites = 0;
    this.rect = null;
    this._w = 300;
    this._h = 150;
  }
  get width() {
    return this._w;
  }
  set width(v) {
    this._w = v;
    this.sizeWrites++;
    if (this.ctx) this.ctx.imageSmoothingEnabled = true; // browsers reset context state here
  }
  get height() {
    return this._h;
  }
  set height(v) {
    this._h = v;
    this.sizeWrites++;
    if (this.ctx) this.ctx.imageSmoothingEnabled = true;
  }
  getContext(type, attrs) {
    if (type !== '2d') return null;
    this.contextAttrs = attrs;
    this.ctx ??= new FakeCtx(this);
    return this.ctx;
  }
  getBoundingClientRect() {
    return (
      this.rect ?? {
        left: 0,
        top: 0,
        width: parseFloat(this.style.width) || 0,
        height: parseFloat(this.style.height) || 0,
      }
    );
  }
}

class FakeElement {
  constructor(clientWidth = 0, clientHeight = 0) {
    this.children = [];
    this.clientWidth = clientWidth;
    this.clientHeight = clientHeight;
    this.style = {};
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i < 0) throw new Error('removeChild: not a child');
    this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
}

/**
 * @param {object} [opts]
 * @param {number} [opts.innerWidth]
 * @param {number} [opts.innerHeight]
 * @param {number} [opts.dpr]
 * @param {boolean} [opts.resizeObserver]  Provide window.ResizeObserver.
 * @param {'modern'|'legacy'|'none'} [opts.matchMedia]  MediaQueryList API flavour.
 * @param {boolean} [opts.contextFails]  getContext returns null.
 */
function makeEnv({
  innerWidth = 960,
  innerHeight = 540,
  dpr = 1,
  resizeObserver = true,
  matchMedia = 'modern',
  contextFails = false,
} = {}) {
  const observers = [];
  const queries = [];
  const winListeners = new Map();
  const window = {
    devicePixelRatio: dpr,
    innerWidth,
    innerHeight,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatch(type) {
      for (const fn of winListeners.get(type) ?? []) fn();
    },
    listenerCount(type) {
      return winListeners.get(type)?.size ?? 0;
    },
  };
  if (resizeObserver) {
    window.ResizeObserver = class {
      constructor(cb) {
        this.cb = cb;
        this.targets = [];
        this.disconnected = false;
        observers.push(this);
      }
      observe(el) {
        this.targets.push(el);
      }
      disconnect() {
        this.disconnected = true;
      }
    };
  }
  if (matchMedia !== 'none') {
    window.matchMedia = (media) => {
      const q = { media, listeners: new Set() };
      if (matchMedia === 'modern') {
        q.addEventListener = (_t, fn) => q.listeners.add(fn);
        q.removeEventListener = (_t, fn) => q.listeners.delete(fn);
      } else {
        q.addListener = (fn) => q.listeners.add(fn);
        q.removeListener = (fn) => q.listeners.delete(fn);
      }
      q.fire = () => {
        for (const fn of [...q.listeners]) fn();
      };
      queries.push(q);
      return q;
    };
  }
  const document = {
    body: new FakeElement(),
    documentElement: new FakeElement(),
    createElement(tag) {
      if (tag !== 'canvas') return new FakeElement();
      const c = new FakeCanvas();
      if (contextFails) c.getContext = () => null;
      return c;
    },
  };
  return { env: { document, window }, document, window, observers, queries };
}

/** Tiny deterministic LCG for property-style sweeps. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ---------------------------------------------------------------------------------------------
// Constants & small helpers
// ---------------------------------------------------------------------------------------------

describe('constants and mode helpers', () => {
  test('native size and modes match the contract', () => {
    assert.equal(DEFAULT_WIDTH, 480);
    assert.equal(DEFAULT_HEIGHT, 270);
    assert.deepEqual([...MODES], ['integer', 'fit']);
    assert.ok(Object.isFrozen(MODES));
  });

  test('isDisplayMode accepts only the two modes', () => {
    assert.equal(isDisplayMode('integer'), true);
    assert.equal(isDisplayMode('fit'), true);
    assert.equal(isDisplayMode('stretch'), false);
    assert.equal(isDisplayMode(''), false);
    assert.equal(isDisplayMode(undefined), false);
    assert.equal(isDisplayMode(1), false);
  });

  test('normalizeDpr coerces invalid ratios to 1', () => {
    assert.equal(normalizeDpr(2), 2);
    assert.equal(normalizeDpr(1.25), 1.25);
    assert.equal(normalizeDpr('1.5'), 1.5);
    assert.equal(normalizeDpr(0), 1);
    assert.equal(normalizeDpr(-2), 1);
    assert.equal(normalizeDpr(NaN), 1);
    assert.equal(normalizeDpr(Infinity), 1);
    assert.equal(normalizeDpr(undefined), 1);
    assert.equal(normalizeDpr(null), 1);
  });
});

// ---------------------------------------------------------------------------------------------
// computeLayout
// ---------------------------------------------------------------------------------------------

describe('computeLayout', () => {
  test('exact double at dpr 1 fills the box with no bars', () => {
    const L = computeLayout({ cssWidth: 960, cssHeight: 540 });
    assert.equal(L.mode, 'integer');
    assert.equal(L.integer, true);
    assert.equal(L.pixelScale, 2);
    assert.equal(L.scale, 2);
    assert.equal(L.backingWidth, 960);
    assert.equal(L.backingHeight, 540);
    assert.equal(L.destWidth, 960);
    assert.equal(L.destHeight, 540);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
    assert.equal(L.offsetX, 0);
    assert.equal(L.offsetY, 0);
    assert.equal(L.viewWidth, 960);
    assert.equal(L.viewHeight, 540);
    assert.equal(L.width, 480);
    assert.equal(L.height, 270);
  });

  test('integer scale is taken in device pixels at dpr 2', () => {
    const L = computeLayout({ cssWidth: 1920, cssHeight: 1080, dpr: 2 });
    assert.equal(L.backingWidth, 3840);
    assert.equal(L.backingHeight, 2160);
    assert.equal(L.pixelScale, 8);
    assert.equal(L.scale, 4); // CSS px per game px
    assert.equal(L.integer, true);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
  });

  test('letterbox bars are centred and floored to whole device pixels', () => {
    const L = computeLayout({ cssWidth: 1000, cssHeight: 600 });
    assert.equal(L.pixelScale, 2);
    assert.equal(L.destWidth, 960);
    assert.equal(L.destHeight, 540);
    assert.equal(L.deviceOffsetX, 20);
    assert.equal(L.deviceOffsetY, 30);
    assert.equal(L.offsetX, 20);
    assert.equal(L.offsetY, 30);
  });

  test('fractional dpr: crisp in device px, fractional in CSS px', () => {
    const L = computeLayout({ cssWidth: 960, cssHeight: 540, dpr: 1.25 });
    assert.equal(L.backingWidth, 1200);
    assert.equal(L.backingHeight, 675);
    assert.equal(L.pixelScale, 2);
    assert.equal(L.integer, true);
    assert.equal(L.destWidth, 960);
    assert.equal(L.destHeight, 540);
    assert.equal(L.deviceOffsetX, 120);
    assert.equal(L.deviceOffsetY, 67); // floor(135 / 2)
    assert.equal(L.scale, 1.6);
    assert.equal(L.offsetX, 96);
    assert.equal(L.offsetY, 53.6);
    assert.equal(L.viewWidth, 768);
    assert.equal(L.viewHeight, 432);
  });

  test('odd backing sizes round the css*dpr product', () => {
    const L = computeLayout({ cssWidth: 333, cssHeight: 111, dpr: 1.5 });
    assert.equal(L.backingWidth, 500); // 499.5 -> 500
    assert.equal(L.backingHeight, 167); // 166.5 -> 167
  });

  test('integer mode falls back to fractional fit when the box is smaller than native', () => {
    const L = computeLayout({ cssWidth: 240, cssHeight: 135 });
    assert.equal(L.mode, 'integer');
    assert.equal(L.integer, false);
    assert.equal(L.pixelScale, 0.5);
    assert.equal(L.destWidth, 240);
    assert.equal(L.destHeight, 135);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
  });

  test('fit mode fills the limiting axis and bars the other', () => {
    const L = computeLayout({ cssWidth: 800, cssHeight: 540, mode: 'fit' });
    assert.equal(L.mode, 'fit');
    assert.equal(L.integer, false);
    assert.ok(near(L.pixelScale, 800 / 480));
    assert.equal(L.destWidth, 800); // clamped exactly to the backing width
    assert.ok(near(L.destHeight, 450));
    assert.equal(L.deviceOffsetX, 0);
    assert.ok(L.deviceOffsetY === 44 || L.deviceOffsetY === 45);
    assert.ok(near(L.scale, 800 / 480));
  });

  test('fit mode never exceeds the backing store even with float error', () => {
    // 1000/480 * 480 can overshoot 1000 by an ulp without the clamp.
    const L = computeLayout({ cssWidth: 1000, cssHeight: 900, mode: 'fit' });
    assert.ok(L.destWidth <= L.backingWidth);
    assert.ok(L.destHeight <= L.backingHeight);
    assert.ok(L.deviceOffsetX >= 0 && L.deviceOffsetY >= 0);
  });

  test('fit mode prefers an exact integer when one fits exactly', () => {
    const L = computeLayout({ cssWidth: 1440, cssHeight: 810, mode: 'fit' });
    assert.equal(L.pixelScale, 3);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
  });

  test('custom native size', () => {
    const L = computeLayout({ width: 320, height: 180, cssWidth: 1280, cssHeight: 720 });
    assert.equal(L.width, 320);
    assert.equal(L.height, 180);
    assert.equal(L.pixelScale, 4);
    assert.equal(L.destWidth, 1280);
  });

  test('hidden / unmeasured boxes are treated as 1x1 and do not throw', () => {
    for (const bad of [0, -5, NaN, undefined, Infinity, 'nope']) {
      const L = computeLayout({ cssWidth: bad, cssHeight: bad });
      assert.equal(L.cssWidth, 1);
      assert.equal(L.cssHeight, 1);
      assert.equal(L.backingWidth, 1);
      assert.equal(L.backingHeight, 1);
      assert.equal(L.integer, false);
      assert.ok(L.pixelScale > 0 && L.pixelScale < 1);
      assert.equal(L.deviceOffsetX, 0);
      assert.equal(L.deviceOffsetY, 0);
    }
  });

  test('invalid dpr falls back to 1', () => {
    for (const bad of [0, -1, NaN, undefined, Infinity]) {
      const L = computeLayout({ cssWidth: 960, cssHeight: 540, dpr: bad });
      assert.equal(L.dpr, 1);
      assert.equal(L.backingWidth, 960);
    }
  });

  test('maxBackingPixels lowers the effective dpr', () => {
    const L = computeLayout({ cssWidth: 1000, cssHeight: 1000, dpr: 2, maxBackingPixels: 1_000_000 });
    assert.equal(L.dpr, 1);
    assert.equal(L.backingWidth, 1000);
    assert.equal(L.backingHeight, 1000);
    const L2 = computeLayout({ cssWidth: 4000, cssHeight: 2000, dpr: 2, maxBackingPixels: 4_000_000 });
    assert.ok(L2.backingWidth * L2.backingHeight <= 4_000_000 + L2.backingWidth + L2.backingHeight);
    assert.ok(near(L2.dpr, Math.SQRT1_2));
    assert.equal(L2.cssWidth, 4000); // CSS size is untouched
  });

  test('maxBackingPixels that is not binding leaves dpr alone', () => {
    const L = computeLayout({ cssWidth: 100, cssHeight: 100, dpr: 2, maxBackingPixels: 1e9 });
    assert.equal(L.dpr, 2);
    for (const noCap of [0, -1, NaN, Infinity, undefined]) {
      assert.equal(computeLayout({ cssWidth: 100, cssHeight: 100, dpr: 2, maxBackingPixels: noCap }).dpr, 2);
    }
  });

  test('rejects bad native sizes with RangeError', () => {
    for (const [w, h] of [[0, 270], [480, 0], [-480, 270], [480.5, 270], [NaN, 270], ['480', 270]]) {
      assert.throws(() => computeLayout({ width: w, height: h, cssWidth: 960, cssHeight: 540 }), RangeError);
    }
  });

  test('rejects unknown modes with TypeError', () => {
    for (const mode of ['stretch', '', null, 42, 'INTEGER']) {
      assert.throws(() => computeLayout({ cssWidth: 960, cssHeight: 540, mode }), TypeError);
    }
  });

  test('result is frozen and deterministic', () => {
    const spec = { cssWidth: 1234, cssHeight: 567, dpr: 1.75, mode: 'integer' };
    const a = computeLayout(spec);
    const b = computeLayout(spec);
    assert.ok(Object.isFrozen(a));
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
  });

  test('invariants hold across a sweep of sizes, ratios and modes', () => {
    const rnd = lcg(0xc0ffee);
    for (let i = 0; i < 2000; i++) {
      const cssWidth = Math.floor(rnd() * 4000) + 1;
      const cssHeight = Math.floor(rnd() * 2500) + 1;
      const dpr = [1, 1.25, 1.5, 1.75, 2, 2.625, 3][Math.floor(rnd() * 7)];
      const mode = rnd() < 0.5 ? 'integer' : 'fit';
      const L = computeLayout({ cssWidth, cssHeight, dpr, mode });
      const tag = `${cssWidth}x${cssHeight}@${dpr} ${mode}`;

      assert.ok(Number.isInteger(L.backingWidth) && L.backingWidth >= 1, tag);
      assert.ok(Number.isInteger(L.backingHeight) && L.backingHeight >= 1, tag);
      assert.ok(L.destWidth <= L.backingWidth && L.destHeight <= L.backingHeight, tag);
      assert.ok(Number.isInteger(L.deviceOffsetX) && L.deviceOffsetX >= 0, tag);
      assert.ok(Number.isInteger(L.deviceOffsetY) && L.deviceOffsetY >= 0, tag);
      // Centred: the leftover after a floored half-offset on each side is 0 or 1 device px when
      // the frame is whole-pixel sized (integer), and strictly < 2 when the frame is fractional.
      const slackX = L.backingWidth - (L.deviceOffsetX * 2 + L.destWidth);
      const slackY = L.backingHeight - (L.deviceOffsetY * 2 + L.destHeight);
      const maxSlack = L.integer ? 1 + 1e-6 : 2;
      assert.ok(slackX >= -1e-6 && slackX < maxSlack, `${tag} slackX=${slackX}`);
      assert.ok(slackY >= -1e-6 && slackY < maxSlack, `${tag} slackY=${slackY}`);
      // Aspect preserved.
      assert.ok(near(L.destWidth / L.width, L.destHeight / L.height, 1e-9), tag);
      // At least one axis is (almost) full in fit mode.
      if (mode === 'fit') {
        assert.ok(L.backingWidth - L.destWidth < 1 || L.backingHeight - L.destHeight < 1, tag);
      }
      // Integer mode gives whole device-pixel scale whenever the box is big enough.
      const bigEnough = L.backingWidth >= L.width && L.backingHeight >= L.height;
      if (mode === 'integer') assert.equal(L.integer, bigEnough, tag);
      if (L.integer) assert.ok(Number.isInteger(L.pixelScale) && L.pixelScale >= 1, tag);
      // Derived CSS values.
      assert.ok(near(L.scale, L.pixelScale / L.dpr), tag);
      assert.ok(near(L.offsetX, L.deviceOffsetX / L.dpr), tag);
      assert.ok(near(L.viewWidth, L.destWidth / L.dpr), tag);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// pointToGame / gameToPoint
// ---------------------------------------------------------------------------------------------

describe('pointToGame / gameToPoint', () => {
  const L = computeLayout({ cssWidth: 1000, cssHeight: 600 }); // scale 2, offsets (20, 30)

  test('frame origin maps to (0,0) and is inside', () => {
    assert.deepEqual(pointToGame(20, 30, L), { x: 0, y: 0, inside: true });
  });

  test('scales by CSS px per game px', () => {
    assert.deepEqual(pointToGame(20 + 2 * 100, 30 + 2 * 50, L), { x: 100, y: 50, inside: true });
    assert.deepEqual(pointToGame(21, 31, L), { x: 0.5, y: 0.5, inside: true });
  });

  test('letterbox bars and far edges are outside', () => {
    assert.equal(pointToGame(0, 0, L).inside, false);
    assert.equal(pointToGame(19.99, 300, L).inside, false);
    assert.equal(pointToGame(20 + 960, 300, L).inside, false); // x === width
    assert.equal(pointToGame(500, 30 + 540, L).inside, false); // y === height
    assert.equal(pointToGame(20 + 959.99, 30 + 539.99, L).inside, true);
    assert.equal(pointToGame(-100, -100, L).inside, false);
  });

  test('coordinates are unclamped so callers can detect direction', () => {
    const p = pointToGame(0, 0, L);
    assert.equal(p.x, -10);
    assert.equal(p.y, -15);
  });

  test('gameToPoint is the inverse of pointToGame', () => {
    assert.deepEqual(gameToPoint(0, 0, L), { x: 20, y: 30 });
    assert.deepEqual(gameToPoint(480, 270, L), { x: 980, y: 570 });
    const rnd = lcg(42);
    for (let i = 0; i < 500; i++) {
      const layout = computeLayout({
        cssWidth: Math.floor(rnd() * 3000) + 1,
        cssHeight: Math.floor(rnd() * 2000) + 1,
        dpr: 1 + rnd() * 2,
        mode: rnd() < 0.5 ? 'integer' : 'fit',
      });
      const x = rnd() * layout.width;
      const y = rnd() * layout.height;
      const p = gameToPoint(x, y, layout);
      const g = pointToGame(p.x, p.y, layout);
      assert.ok(near(g.x, x, 1e-7) && near(g.y, y, 1e-7), `round trip ${x},${y}`);
      assert.equal(g.inside, true);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay (browser wiring exercised with the fake DOM)
// ---------------------------------------------------------------------------------------------

describe('createDisplay: construction and errors', () => {
  test('imports under Node but refuses to run without a DOM', () => {
    assert.throws(() => createDisplay(), /browser-only/);
    assert.throws(() => createDisplay({ parent: new FakeElement(), env: {} }), /browser-only/);
    const { document } = makeEnv();
    assert.throws(() => createDisplay({ parent: new FakeElement(), env: { document } }), /browser-only/);
  });

  test('requires a parent element', () => {
    const { env } = makeEnv();
    assert.throws(() => createDisplay({ env }), TypeError);
    assert.throws(() => createDisplay({ env, parent: 'stage' }), TypeError);
    assert.throws(() => createDisplay({ env, parent: {} }), TypeError);
  });

  test('validates mode and native size before touching the DOM', () => {
    const { env, document } = makeEnv();
    const parent = new FakeElement(960, 540);
    assert.throws(() => createDisplay({ env, parent, mode: 'stretch' }), TypeError);
    assert.throws(() => createDisplay({ env, parent, width: 0 }), RangeError);
    assert.throws(() => createDisplay({ env, parent, height: 1.5 }), RangeError);
    assert.equal(parent.children.length, 0);
    assert.equal(document.body.children.length, 0);
  });

  test('throws when a 2D context cannot be created', () => {
    const { env } = makeEnv({ contextFails: true });
    assert.throws(() => createDisplay({ env, parent: new FakeElement(960, 540) }), /context/);
  });

  test('sets up canvas, buffer and contexts', () => {
    const { env, observers, window } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });

    assert.equal(d.canvas.parentNode, parent);
    assert.equal(parent.children[0], d.canvas);
    assert.equal(d.canvas.style.display, 'block');
    assert.equal(d.canvas.style.imageRendering, 'pixelated');
    assert.equal(d.canvas.style.touchAction, 'none');
    assert.equal(d.canvas.style.width, '960px');
    assert.equal(d.canvas.style.height, '540px');
    assert.equal(d.canvas.width, 960);
    assert.equal(d.canvas.height, 540);
    assert.deepEqual(d.canvas.contextAttrs, { alpha: false });

    assert.equal(d.width, 480);
    assert.equal(d.height, 270);
    assert.equal(d.buffer.width, 480);
    assert.equal(d.buffer.height, 270);
    assert.equal(d.ctx, d.buffer.ctx);
    assert.deepEqual(d.buffer.contextAttrs, { alpha: false });
    assert.equal(d.ctx.imageSmoothingEnabled, false);
    assert.equal(d.canvas.ctx.imageSmoothingEnabled, false);

    assert.equal(d.mode, 'integer');
    assert.equal(d.scale, 2);
    assert.equal(d.pixelScale, 2);
    assert.equal(d.offsetX, 0);
    assert.equal(d.offsetY, 0);
    assert.equal(d.dpr, 1);
    assert.equal(d.background, '#000');
    assert.ok(Object.isFrozen(d.layout));
    assert.deepEqual(d.layout, computeLayout({ cssWidth: 960, cssHeight: 540 }));

    assert.equal(observers.length, 1);
    assert.deepEqual(observers[0].targets, [parent]);
    assert.equal(window.listenerCount('resize'), 1);
  });

  test('honours width/height/mode/alpha/background options', () => {
    const { env } = makeEnv();
    const d = createDisplay({
      env,
      parent: new FakeElement(640, 360),
      width: 320,
      height: 180,
      mode: 'fit',
      alpha: true,
      background: '#123456',
    });
    assert.equal(d.buffer.width, 320);
    assert.equal(d.buffer.height, 180);
    assert.deepEqual(d.buffer.contextAttrs, { alpha: true });
    assert.equal(d.mode, 'fit');
    assert.equal(d.pixelScale, 2);
    assert.equal(d.background, '#123456');
  });

  test('the first layout is presented and reported immediately', () => {
    const { env } = makeEnv();
    const seen = [];
    const d = createDisplay({ env, parent: new FakeElement(960, 540), onResize: (L, disp) => seen.push([L, disp]) });
    assert.equal(seen.length, 1);
    assert.equal(seen[0][0], d.layout);
    assert.equal(seen[0][1], d);
    const ops = d.canvas.ctx.ops;
    assert.equal(ops.length, 1);
    assert.equal(ops[0].op, 'drawImage');
    assert.deepEqual(ops[0].args, [d.buffer, 0, 0, 480, 270, 0, 0, 960, 540]);
  });

  test('a zero-sized parent is tolerated and recovers on the next measurement', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(0, 0);
    const d = createDisplay({ env, parent });
    assert.equal(d.canvas.width, 1);
    assert.equal(d.canvas.height, 1);
    assert.ok(d.scale > 0 && d.scale < 1);
    parent.clientWidth = 960;
    parent.clientHeight = 540;
    observers[0].cb();
    assert.equal(d.scale, 2);
    assert.equal(d.canvas.width, 960);
  });

  test('body / documentElement parents measure the window instead', () => {
    const { env, document } = makeEnv({ innerWidth: 1440, innerHeight: 810 });
    const d = createDisplay({ env, parent: document.body });
    assert.equal(d.layout.cssWidth, 1440);
    assert.equal(d.pixelScale, 3);
    const d2 = createDisplay({ env, parent: document.documentElement });
    assert.equal(d2.layout.cssHeight, 810);
  });
});

describe('createDisplay: present()', () => {
  test('blits only the frame when it fills the canvas', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    d.canvas.ctx.ops.length = 0;
    d.present();
    assert.deepEqual(
      d.canvas.ctx.ops.map((o) => o.op),
      ['drawImage'],
    );
  });

  test('paints exactly the four letterbox strips with the background colour', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(800, 540), background: '#102030' });
    // 800x540 @1 integer -> pixelScale 1, frame 480x270 at (160, 135)
    assert.equal(d.pixelScale, 1);
    assert.equal(d.offsetX, 160);
    assert.equal(d.offsetY, 135);
    d.canvas.ctx.ops.length = 0;
    d.present();
    const ops = d.canvas.ctx.ops;
    const fills = ops.filter((o) => o.op === 'fillRect');
    assert.equal(fills.length, 4);
    assert.ok(fills.every((f) => f.fillStyle === '#102030'));
    assert.deepEqual(
      fills.map((f) => f.args),
      [
        [0, 0, 800, 135], // top
        [0, 405, 800, 135], // bottom
        [0, 135, 160, 270], // left
        [640, 135, 160, 270], // right
      ],
    );
    assert.deepEqual(ops.at(-1).args, [d.buffer, 0, 0, 480, 270, 160, 135, 480, 270]);
  });

  test('paints only the strips that exist (one axis barred)', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 600) });
    d.canvas.ctx.ops.length = 0;
    d.present();
    const fills = d.canvas.ctx.ops.filter((o) => o.op === 'fillRect');
    assert.deepEqual(
      fills.map((f) => f.args),
      [
        [0, 0, 960, 30],
        [0, 570, 960, 30],
      ],
    );
  });

  test('setBackground changes the bar colour and rejects non-strings', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(800, 540) });
    d.setBackground('#abcdef');
    assert.equal(d.background, '#abcdef');
    d.canvas.ctx.ops.length = 0;
    d.present();
    assert.ok(d.canvas.ctx.ops.filter((o) => o.op === 'fillRect').every((f) => f.fillStyle === '#abcdef'));
    assert.throws(() => d.setBackground(''), TypeError);
    assert.throws(() => d.setBackground(null), TypeError);
    assert.throws(() => d.setBackground(0x000000), TypeError);
    assert.equal(d.background, '#abcdef');
  });

  test('clear() fills or clears the buffer', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 540), background: '#222' });
    d.clear();
    d.clear('#fff');
    d.clear(null);
    assert.deepEqual(
      d.ctx.ops.map((o) => [o.op, o.fillStyle, ...o.args]),
      [
        ['fillRect', '#222', 0, 0, 480, 270],
        ['fillRect', '#fff', 0, 0, 480, 270],
        ['clearRect', undefined, 0, 0, 480, 270],
      ],
    );
  });
});

describe('createDisplay: resizing', () => {
  test('ResizeObserver notifications re-lay-out, present, and notify once', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const seen = [];
    const d = createDisplay({ env, parent, onResize: (L) => seen.push(L) });
    const writesBefore = d.canvas.sizeWrites;

    parent.clientWidth = 800;
    d.canvas.ctx.ops.length = 0;
    observers[0].cb();

    assert.equal(seen.length, 2);
    assert.equal(seen[1], d.layout);
    assert.equal(d.layout.cssWidth, 800);
    assert.equal(d.pixelScale, 1);
    assert.equal(d.canvas.width, 800);
    assert.equal(d.canvas.style.width, '800px');
    assert.equal(d.canvas.sizeWrites, writesBefore + 1); // only width changed
    assert.equal(d.canvas.ctx.imageSmoothingEnabled, false); // restored after the reset
    assert.ok(d.canvas.ctx.ops.some((o) => o.op === 'drawImage')); // re-presented
  });

  test('unchanged measurements are deduplicated', () => {
    const { env, observers, window } = makeEnv();
    const parent = new FakeElement(960, 540);
    let count = 0;
    const d = createDisplay({ env, parent, onResize: () => count++ });
    const layout = d.layout;
    const writes = d.canvas.sizeWrites;
    d.canvas.ctx.ops.length = 0;

    observers[0].cb();
    window.dispatch('resize');
    assert.equal(d.resize(), layout);

    assert.equal(count, 1);
    assert.equal(d.layout, layout);
    assert.equal(d.canvas.sizeWrites, writes);
    assert.equal(d.canvas.ctx.ops.length, 0);
  });

  test('falls back to the window resize event without ResizeObserver', () => {
    const { env, observers, window } = makeEnv({ resizeObserver: false });
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    assert.equal(observers.length, 0);
    parent.clientWidth = 1920;
    parent.clientHeight = 1080;
    window.dispatch('resize');
    assert.equal(d.pixelScale, 4);
  });

  test('tracks devicePixelRatio changes through a media query', () => {
    const { env, queries, window } = makeEnv({ dpr: 1 });
    const d = createDisplay({ env, parent: new FakeElement(800, 540) });
    assert.equal(queries.length, 1);
    assert.equal(queries[0].media, '(resolution: 1dppx)');
    assert.equal(queries[0].listeners.size, 1);

    window.devicePixelRatio = 2;
    queries[0].fire();

    assert.equal(d.dpr, 2);
    assert.equal(d.canvas.width, 1600);
    assert.equal(d.canvas.height, 1080);
    assert.equal(d.canvas.style.width, '800px');
    assert.equal(d.pixelScale, 3);
    assert.equal(d.scale, 1.5);
    assert.equal(queries.length, 2);
    assert.equal(queries[0].listeners.size, 0); // old query released
    assert.equal(queries[1].media, '(resolution: 2dppx)');
    assert.equal(queries[1].listeners.size, 1);
  });

  test('supports the legacy MediaQueryList addListener API', () => {
    const { env, queries, window } = makeEnv({ dpr: 1, matchMedia: 'legacy' });
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    assert.equal(queries[0].listeners.size, 1);
    window.devicePixelRatio = 1.5;
    queries[0].fire();
    assert.equal(d.dpr, 1.5);
    assert.equal(queries[0].listeners.size, 0);
    assert.equal(queries[1].listeners.size, 1);
    d.destroy();
    assert.equal(queries[1].listeners.size, 0);
  });

  test('works without matchMedia at all', () => {
    const { env, queries, window } = makeEnv({ matchMedia: 'none' });
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    assert.equal(queries.length, 0);
    window.devicePixelRatio = 2;
    window.dispatch('resize');
    assert.equal(d.dpr, 2);
  });

  test('a forced dpr ignores the window and does not watch for changes', () => {
    const { env, queries, window } = makeEnv({ dpr: 2 });
    const d = createDisplay({ env, parent: new FakeElement(960, 540), dpr: 1 });
    assert.equal(d.dpr, 1);
    assert.equal(d.canvas.width, 960);
    assert.equal(queries.length, 0);
    window.devicePixelRatio = 3;
    window.dispatch('resize');
    assert.equal(d.dpr, 1);
  });

  test('maxBackingPixels is passed through', () => {
    const { env } = makeEnv({ dpr: 2 });
    const d = createDisplay({ env, parent: new FakeElement(1000, 1000), maxBackingPixels: 1_000_000 });
    assert.equal(d.canvas.width, 1000);
    assert.equal(d.dpr, 1);
  });

  test('setMode switches scaling, notifies, and is idempotent', () => {
    const { env } = makeEnv();
    let count = 0;
    const d = createDisplay({ env, parent: new FakeElement(800, 540), onResize: () => count++ });
    assert.equal(count, 1);

    const fit = d.setMode('fit');
    assert.equal(d.mode, 'fit');
    assert.equal(fit, d.layout);
    assert.ok(near(d.scale, 800 / 480));
    assert.equal(d.layout.destWidth, 800);
    assert.equal(count, 2);

    assert.equal(d.setMode('fit'), fit);
    assert.equal(count, 2);

    assert.throws(() => d.setMode('stretch'), TypeError);
    assert.throws(() => d.setMode(), TypeError);
    assert.equal(d.mode, 'fit');
    assert.equal(count, 2);

    d.setMode('integer');
    assert.equal(d.mode, 'integer');
    assert.equal(d.pixelScale, 1);
    assert.equal(count, 3);
  });

  test('switching mode notifies even when the pixels are identical', () => {
    const { env } = makeEnv();
    let count = 0;
    const d = createDisplay({ env, parent: new FakeElement(960, 540), onResize: () => count++ });
    d.setMode('fit'); // 960x540 is an exact x2 either way
    assert.equal(d.layout.mode, 'fit');
    assert.equal(d.pixelScale, 2);
    assert.equal(count, 2);
  });

  test('onResize subscribers can unsubscribe and must be functions', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    const seen = [];
    const off = d.onResize((L) => seen.push(L));
    assert.throws(() => d.onResize(null), TypeError);
    assert.throws(() => d.onResize('fn'), TypeError);

    parent.clientWidth = 800;
    observers[0].cb();
    assert.equal(seen.length, 1);

    off();
    off(); // double unsubscribe is harmless
    parent.clientWidth = 700;
    observers[0].cb();
    assert.equal(seen.length, 1);
  });
});

describe('createDisplay: coordinate mapping', () => {
  function barred() {
    const { env } = makeEnv();
    const parent = new FakeElement(800, 540); // frame 480x270 at (160, 135), scale 1
    const d = createDisplay({ env, parent });
    d.canvas.rect = { left: 10, top: 20, width: 800, height: 540 };
    return d;
  }

  test('toGame accounts for the canvas position and the letterbox offset', () => {
    const d = barred();
    assert.deepEqual(d.toGame(170, 155), { x: 0, y: 0, inside: true });
    assert.deepEqual(d.toGame(170 + 479, 155 + 269), { x: 479, y: 269, inside: true });
    assert.deepEqual(d.toGame(170 + 480, 155), { x: 480, y: 0, inside: false });
    assert.deepEqual(d.toGame(10, 20), { x: -160, y: -135, inside: false });
  });

  test('toClient is the inverse of toGame', () => {
    const d = barred();
    assert.deepEqual(d.toClient(0, 0), { clientX: 170, clientY: 155 });
    assert.deepEqual(d.toClient(480, 270), { clientX: 650, clientY: 425 });
    const rnd = lcg(7);
    for (let i = 0; i < 200; i++) {
      const x = rnd() * 480;
      const y = rnd() * 270;
      const c = d.toClient(x, y);
      const g = d.toGame(c.clientX, c.clientY);
      assert.ok(near(g.x, x, 1e-9) && near(g.y, y, 1e-9));
      assert.equal(g.inside, true);
    }
  });

  test('compensates for CSS transforms that shrink or stretch the canvas on screen', () => {
    const d = barred();
    d.canvas.rect = { left: 10, top: 20, width: 400, height: 270 }; // scaled to 50% on screen
    assert.deepEqual(d.toGame(10 + 80, 20 + 67.5), { x: 0, y: 0, inside: true });
    assert.deepEqual(d.toGame(10 + 80 + 240, 20 + 67.5 + 135), { x: 480, y: 270, inside: false });
    assert.deepEqual(d.toClient(0, 0), { clientX: 90, clientY: 87.5 });
    assert.deepEqual(d.toClient(240, 135), { clientX: 210, clientY: 155 });
  });

  test('a hidden canvas (zero rect) does not divide by zero', () => {
    const d = barred();
    d.canvas.rect = { left: 0, top: 0, width: 0, height: 0 };
    const g = d.toGame(160, 135);
    assert.deepEqual(g, { x: 0, y: 0, inside: true });
    assert.deepEqual(d.toClient(0, 0), { clientX: 160, clientY: 135 });
  });

  test('uses fractional CSS scale at fractional dpr', () => {
    const { env } = makeEnv({ dpr: 1.25 });
    const d = createDisplay({ env, parent: new FakeElement(960, 540) }); // scale 1.6, offsets (96, 53.6)
    const g = d.toGame(96 + 1.6 * 10, 53.6 + 1.6 * 20);
    assert.ok(near(g.x, 10) && near(g.y, 20));
    assert.equal(g.inside, true);
  });
});

describe('createDisplay: destroy()', () => {
  test('releases every hook and detaches the canvas', () => {
    const { env, observers, queries, window } = makeEnv();
    const parent = new FakeElement(960, 540);
    let count = 0;
    const d = createDisplay({ env, parent, onResize: () => count++ });
    const layout = d.layout;

    d.destroy();

    assert.equal(d.canvas.parentNode, null);
    assert.equal(parent.children.length, 0);
    assert.equal(window.listenerCount('resize'), 0);
    assert.equal(observers[0].disconnected, true);
    assert.equal(queries[0].listeners.size, 0);

    parent.clientWidth = 100;
    observers[0].cb();
    window.dispatch('resize');
    assert.equal(d.resize(), layout);
    assert.equal(d.layout, layout);
    assert.equal(count, 1);

    assert.doesNotThrow(() => d.destroy());
    assert.doesNotThrow(() => d.present());
  });

  test('tolerates a canvas that was already detached by someone else', () => {
    const { env } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    parent.removeChild(d.canvas);
    assert.doesNotThrow(() => d.destroy());
  });
});

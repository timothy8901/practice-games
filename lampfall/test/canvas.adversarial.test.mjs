/**
 * Adversarial / robustness tests for js/core/canvas.js (independent verification pass).
 *
 * Complements test/canvas.test.mjs: malformed inputs, boundaries, determinism, large inputs,
 * re-entrancy, failure cleanup, destroyed-state behaviour and the float-exactness of fit mode.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const GLOBALS_BEFORE = new Set(Object.getOwnPropertyNames(globalThis));
const mod = await import('../js/core/canvas.js');
const { DEFAULT_WIDTH, DEFAULT_HEIGHT, MODES, computeLayout, pointToGame, gameToPoint, createDisplay, normalizeDpr } = mod;

// ---------------------------------------------------------------------------------------------
// Fake DOM with failure injection
// ---------------------------------------------------------------------------------------------

class FakeCtx {
  constructor() {
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
    if (this.ctx) this.ctx.imageSmoothingEnabled = true;
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
    this.ctx ??= new FakeCtx();
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
 * @param {number} [opts.dpr]
 * @param {'modern'|'legacy'|'none'|'undefined'|'throws'} [opts.matchMedia]
 * @param {'ok'|'none'|'throws'} [opts.resizeObserver]
 */
function makeEnv({ dpr = 1, matchMedia = 'modern', resizeObserver = 'ok', innerWidth = 960, innerHeight = 540 } = {}) {
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
      for (const fn of [...(winListeners.get(type) ?? [])]) fn();
    },
    listenerCount(type) {
      return winListeners.get(type)?.size ?? 0;
    },
  };
  if (resizeObserver === 'ok') {
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
  } else if (resizeObserver === 'throws') {
    window.ResizeObserver = class {
      constructor() {
        throw new Error('ResizeObserver unavailable in this frame');
      }
    };
  }
  if (matchMedia === 'undefined') window.matchMedia = () => undefined;
  else if (matchMedia === 'throws') {
    window.matchMedia = () => {
      throw new Error('matchMedia disabled');
    };
  } else if (matchMedia !== 'none') {
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
      return tag === 'canvas' ? new FakeCanvas() : new FakeElement();
    },
  };
  return { env: { document, window }, document, window, observers, queries };
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const fills = (d) => d.canvas.ctx.ops.filter((o) => o.op === 'fillRect');

// ---------------------------------------------------------------------------------------------
// Module hygiene
// ---------------------------------------------------------------------------------------------

describe('module hygiene', () => {
  test('importing leaks no globals and never touches document/window', () => {
    const after = Object.getOwnPropertyNames(globalThis).filter((k) => !GLOBALS_BEFORE.has(k));
    assert.deepEqual(after, []);
    assert.equal(globalThis.document, undefined);
    assert.equal(globalThis.window, undefined);
  });

  test('exports exactly the contract surface plus documented helpers', () => {
    assert.equal(typeof createDisplay, 'function');
    assert.equal(createDisplay.length, 0); // single options object with a default
    for (const name of ['computeLayout', 'pointToGame', 'gameToPoint', 'normalizeDpr', 'isDisplayMode']) {
      assert.equal(typeof mod[name], 'function', name);
    }
    assert.equal(DEFAULT_WIDTH, 480);
    assert.equal(DEFAULT_HEIGHT, 270);
    assert.throws(() => MODES.push('stretch'), TypeError);
  });
});

// ---------------------------------------------------------------------------------------------
// computeLayout: malformed inputs and boundaries
// ---------------------------------------------------------------------------------------------

describe('computeLayout: malformed inputs', () => {
  test('no spec at all gives the native layout in a 1x1 box without throwing', () => {
    const L = computeLayout();
    assert.equal(L.width, 480);
    assert.equal(L.backingWidth, 1);
    assert.equal(L.integer, false);
    assert.ok(Number.isFinite(L.scale) && L.scale > 0);
  });

  test('a null spec is a TypeError, not a crash deeper down', () => {
    assert.throws(() => computeLayout(null), TypeError);
  });

  test('exotic mode values are rejected without throwing on stringification', () => {
    for (const mode of [Symbol('fit'), {}, [], () => 'fit', 0, true, 'Fit', ' fit', 'fit\u0000', '\ufb01t', 'ｆｉｔ', 'integer\u200b', new String('fit')]) {
      assert.throws(() => computeLayout({ cssWidth: 960, cssHeight: 540, mode }), TypeError);
    }
  });

  test('exotic native sizes are RangeErrors (strings, unicode digits, bigints, floats, huge)', () => {
    for (const bad of ['480', '４８０', 480.000001, -0, Number.MAX_SAFE_INTEGER + 2, Infinity, null, true, [480]]) {
      assert.throws(() => computeLayout({ width: bad, height: 270, cssWidth: 960, cssHeight: 540 }), RangeError, String(bad));
      assert.throws(() => computeLayout({ width: 480, height: bad, cssWidth: 960, cssHeight: 540 }), RangeError, String(bad));
    }
    assert.throws(() => computeLayout({ width: 10n, height: 10n }), RangeError);
  });

  test('numeric strings for css sizes and dpr are coerced; garbage falls back', () => {
    const L = computeLayout({ cssWidth: '960', cssHeight: '540', dpr: '2' });
    assert.equal(L.dpr, 2);
    assert.equal(L.backingWidth, 1920);
    const G = computeLayout({ cssWidth: 'wide', cssHeight: {}, dpr: 'retina' });
    assert.equal(G.cssWidth, 1);
    assert.equal(G.cssHeight, 1);
    assert.equal(G.dpr, 1);
  });

  test('maxBackingPixels: strings coerce, junk means no cap', () => {
    assert.equal(computeLayout({ cssWidth: 1000, cssHeight: 1000, dpr: 2, maxBackingPixels: '1000000' }).dpr, 1);
    for (const none of ['lots', null, -5, 0, NaN, Infinity, undefined, {}]) {
      assert.equal(computeLayout({ cssWidth: 1000, cssHeight: 1000, dpr: 2, maxBackingPixels: none }).dpr, 2, String(none));
    }
  });

  test('negative zero and tiny positive css sizes clamp to 1 without producing -0 anywhere', () => {
    const L = computeLayout({ cssWidth: -0, cssHeight: 1e-12 });
    for (const [k, v] of Object.entries(L)) {
      if (typeof v === 'number') assert.ok(!Object.is(v, -0), `${k} is -0`);
    }
    assert.equal(L.cssWidth, 1);
    assert.equal(L.cssHeight, 1);
  });

  test('extreme dpr values stay finite', () => {
    const tiny = computeLayout({ cssWidth: 960, cssHeight: 540, dpr: 1e-9 });
    assert.equal(tiny.backingWidth, 1);
    assert.equal(tiny.backingHeight, 1);
    assert.ok(Number.isFinite(tiny.scale) && tiny.scale > 0);
    const huge = computeLayout({ cssWidth: 960, cssHeight: 540, dpr: 1e6, maxBackingPixels: 16_777_216 });
    assert.ok(huge.backingWidth * huge.backingHeight <= 16_777_216 + huge.backingWidth + huge.backingHeight);
    assert.ok(Number.isInteger(huge.pixelScale) && huge.pixelScale >= 1);
  });
});

describe('computeLayout: boundaries', () => {
  test('exactly native size: scale 1, no bars, integer', () => {
    const L = computeLayout({ cssWidth: 480, cssHeight: 270 });
    assert.equal(L.pixelScale, 1);
    assert.equal(L.integer, true);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
    assert.equal(L.destWidth, 480);
    assert.equal(L.destHeight, 270);
  });

  test('one pixel short of native falls back to a fractional fit that is still full on the short axis', () => {
    const L = computeLayout({ cssWidth: 479, cssHeight: 270 });
    assert.equal(L.integer, false);
    assert.equal(L.destWidth, 479);
    assert.ok(L.destHeight < 270);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
    const M = computeLayout({ cssWidth: 480, cssHeight: 269 });
    assert.equal(M.destHeight, 269);
    assert.ok(M.destWidth < 480);
  });

  test('one pixel over native keeps scale 1 and puts the odd pixel on the far side', () => {
    const L = computeLayout({ cssWidth: 481, cssHeight: 271 });
    assert.equal(L.pixelScale, 1);
    assert.equal(L.deviceOffsetX, 0);
    assert.equal(L.deviceOffsetY, 0);
    assert.equal(L.backingWidth - L.destWidth, 1);
    assert.equal(L.backingHeight - L.destHeight, 1);
  });

  test('just under the next integer step stays on the lower step', () => {
    const L = computeLayout({ cssWidth: 959, cssHeight: 540 });
    assert.equal(L.pixelScale, 1);
    assert.equal(L.deviceOffsetX, 239);
    const M = computeLayout({ cssWidth: 960, cssHeight: 539 });
    assert.equal(M.pixelScale, 1);
  });

  test('the `integer` flag reports the achieved scale, not just the requested mode', () => {
    assert.equal(computeLayout({ cssWidth: 1440, cssHeight: 810, mode: 'fit' }).integer, true);
    assert.equal(computeLayout({ cssWidth: 960, cssHeight: 540, mode: 'fit', dpr: 2 }).integer, true);
    assert.equal(computeLayout({ cssWidth: 800, cssHeight: 540, mode: 'fit' }).integer, false);
    assert.equal(computeLayout({ cssWidth: 240, cssHeight: 135, mode: 'integer' }).integer, false);
    assert.equal(computeLayout({ cssWidth: 240, cssHeight: 135, mode: 'fit' }).integer, false);
  });

  test('fit mode fills the limiting axis EXACTLY (no float sliver) across a dense sweep', () => {
    let checked = 0;
    for (let bw = 1; bw <= 3000; bw += 1) {
      for (const bh of [97, 270, 541, 1000, 1080, 2161]) {
        const L = computeLayout({ cssWidth: bw, cssHeight: bh, mode: 'fit' });
        const widthLimited = bw / 480 <= bh / 270;
        if (widthLimited) {
          assert.equal(L.destWidth, L.backingWidth, `${bw}x${bh} width`);
          assert.equal(L.deviceOffsetX, 0, `${bw}x${bh} offsetX`);
        } else {
          assert.equal(L.destHeight, L.backingHeight, `${bw}x${bh} height`);
          assert.equal(L.deviceOffsetY, 0, `${bw}x${bh} offsetY`);
        }
        assert.ok(L.destWidth <= L.backingWidth && L.destHeight <= L.backingHeight, `${bw}x${bh} clamp`);
        assert.ok(near(L.destWidth / 480, L.destHeight / 270, 1e-9), `${bw}x${bh} aspect`);
        checked++;
      }
    }
    assert.ok(checked > 10_000);
  });

  test('integer mode at fractional dpr: dest sizes are whole device pixels and bars are integers', () => {
    const rnd = lcg(99);
    for (let i = 0; i < 1000; i++) {
      const dpr = 1 + Math.round(rnd() * 300) / 100; // 1.00 .. 4.00 in 0.01 steps
      const L = computeLayout({ cssWidth: 480 + Math.floor(rnd() * 3000), cssHeight: 270 + Math.floor(rnd() * 2000), dpr });
      assert.ok(Number.isInteger(L.destWidth) && Number.isInteger(L.destHeight), `${dpr}`);
      assert.ok(Number.isInteger(L.deviceOffsetX) && Number.isInteger(L.deviceOffsetY));
      assert.ok(Number.isInteger(L.pixelScale) && L.pixelScale >= 1);
    }
  });
});

describe('computeLayout: determinism', () => {
  test('identical specs produce deep-equal, frozen, JSON-stable layouts across runs and call orders', () => {
    const rnd = lcg(1234);
    const specs = Array.from({ length: 500 }, () => ({
      cssWidth: Math.floor(rnd() * 5000),
      cssHeight: Math.floor(rnd() * 3000),
      dpr: [1, 1.25, 1.5, 2, 2.75, 3][Math.floor(rnd() * 6)],
      mode: rnd() < 0.5 ? 'integer' : 'fit',
      maxBackingPixels: rnd() < 0.3 ? 4_000_000 : Infinity,
    }));
    const first = specs.map((s) => computeLayout(s));
    const second = [...specs].reverse().map((s) => computeLayout(s)).reverse();
    for (let i = 0; i < specs.length; i++) {
      assert.deepEqual(first[i], second[i]);
      assert.equal(JSON.stringify(first[i]), JSON.stringify(second[i]));
      assert.ok(Object.isFrozen(first[i]));
    }
  });

  test('a layout cannot be mutated by callers', () => {
    const L = computeLayout({ cssWidth: 960, cssHeight: 540 });
    assert.throws(() => {
      'use strict';
      L.scale = 99;
    }, TypeError);
    assert.equal(L.scale, 2);
  });
});

describe('pointToGame / gameToPoint: edge values', () => {
  const L = computeLayout({ cssWidth: 1000, cssHeight: 600 }); // scale 2, offsets (20, 30)

  test('non-finite inputs give non-finite output and are never inside', () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined]) {
      const p = pointToGame(bad, 100, L);
      assert.ok(!Number.isFinite(p.x));
      assert.equal(p.inside, false);
      const q = gameToPoint(bad, 0, L);
      assert.ok(!Number.isFinite(q.x));
    }
  });

  test('numeric strings are coerced by the arithmetic', () => {
    assert.deepEqual(pointToGame('220', '130', L), { x: 100, y: 50, inside: true });
  });

  test('sub-pixel edges: 1e-9 inside the frame counts, exactly on the far edge does not', () => {
    assert.equal(pointToGame(20 + 960 - 1e-9, 30 + 540 - 1e-9, L).inside, true);
    assert.equal(pointToGame(20 + 960, 30 + 540 - 1, L).inside, false);
    assert.equal(pointToGame(20 - 1e-9, 100, L).inside, false);
  });

  test('round-trips survive a hidden (1x1) layout', () => {
    const tiny = computeLayout({ cssWidth: 0, cssHeight: 0 });
    const p = gameToPoint(123, 45, tiny);
    const g = pointToGame(p.x, p.y, tiny);
    assert.ok(near(g.x, 123, 1e-6) && near(g.y, 45, 1e-6));
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: option validation
// ---------------------------------------------------------------------------------------------

describe('createDisplay: option validation', () => {
  test('rejects a non-function onResize instead of silently ignoring it', () => {
    const { env } = makeEnv();
    for (const bad of ['fn', 42, {}, true]) {
      assert.throws(() => createDisplay({ env, parent: new FakeElement(960, 540), onResize: bad }), TypeError);
    }
    assert.doesNotThrow(() => createDisplay({ env, parent: new FakeElement(960, 540), onResize: null }));
    assert.doesNotThrow(() => createDisplay({ env, parent: new FakeElement(960, 540), onResize: undefined }));
  });

  test('rejects a non-string background at construction (same rule as setBackground)', () => {
    const { env } = makeEnv();
    for (const bad of [null, '', 0, 0x102030, {}, ['#fff']]) {
      assert.throws(() => createDisplay({ env, parent: new FakeElement(960, 540), background: bad }), TypeError);
    }
    const d = createDisplay({ env, parent: new FakeElement(960, 540), background: 'rgb(0 0 0 / 1)' });
    assert.equal(d.background, 'rgb(0 0 0 / 1)');
  });

  test('rejects dpr values other than "auto" or a positive finite number', () => {
    const { env } = makeEnv();
    for (const bad of [0, -1, NaN, Infinity, '2', 'retina', 'AUTO', null, true]) {
      assert.throws(() => createDisplay({ env, parent: new FakeElement(960, 540), dpr: bad }), TypeError, String(bad));
    }
    assert.equal(createDisplay({ env, parent: new FakeElement(960, 540), dpr: 1.5 }).dpr, 1.5);
    assert.equal(createDisplay({ env, parent: new FakeElement(960, 540), dpr: 'auto' }).dpr, 1);
  });

  test('a failed validation leaves nothing attached', () => {
    const { env, window } = makeEnv();
    const parent = new FakeElement(960, 540);
    assert.throws(() => createDisplay({ env, parent, dpr: 'nope' }), TypeError);
    assert.throws(() => createDisplay({ env, parent, background: null }), TypeError);
    assert.equal(parent.children.length, 0);
    assert.equal(window.listenerCount('resize'), 0);
  });

  test('alpha is coerced to a boolean for the context attributes', () => {
    const { env } = makeEnv();
    assert.deepEqual(createDisplay({ env, parent: new FakeElement(960, 540), alpha: 'yes' }).buffer.contextAttrs, { alpha: true });
    assert.deepEqual(createDisplay({ env, parent: new FakeElement(960, 540), alpha: 0 }).buffer.contextAttrs, { alpha: false });
  });

  test('unicode colour strings are accepted as opaque CSS strings', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(800, 540), background: 'color(display-p3 0.1 0.2 0.3)' });
    d.setBackground('—日本—');
    assert.equal(d.background, '—日本—');
    d.canvas.ctx.ops.length = 0;
    d.present();
    assert.ok(fills(d).every((f) => f.fillStyle === '—日本—'));
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: construction failures must not leak
// ---------------------------------------------------------------------------------------------

describe('createDisplay: setup failure cleanup', () => {
  test('a window without addEventListener is "no DOM", and nothing is attached', () => {
    const { env } = makeEnv();
    delete env.window.addEventListener;
    const parent = new FakeElement(960, 540);
    assert.throws(() => createDisplay({ env, parent }), /browser-only/);
    assert.equal(parent.children.length, 0);
  });

  test('matchMedia returning undefined is tolerated (no DPR tracking, everything else works)', () => {
    const { env, window } = makeEnv({ matchMedia: 'undefined' });
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    assert.equal(d.scale, 2);
    window.devicePixelRatio = 2;
    window.dispatch('resize');
    assert.equal(d.dpr, 2);
    d.destroy();
    assert.equal(parent.children.length, 0);
  });

  test('matchMedia throwing propagates but the canvas and window listener are released', () => {
    const { env, window } = makeEnv({ matchMedia: 'throws' });
    const parent = new FakeElement(960, 540);
    assert.throws(() => createDisplay({ env, parent }), /matchMedia disabled/);
    assert.equal(parent.children.length, 0);
    assert.equal(window.listenerCount('resize'), 0);
  });

  test('a ResizeObserver constructor that throws is cleaned up too', () => {
    const { env, window } = makeEnv({ resizeObserver: 'throws' });
    const parent = new FakeElement(960, 540);
    assert.throws(() => createDisplay({ env, parent }), /ResizeObserver/);
    assert.equal(parent.children.length, 0);
    assert.equal(window.listenerCount('resize'), 0);
  });

  test('an onResize option that throws on the initial layout tears the display down and rethrows', () => {
    const { env, window, observers, queries } = makeEnv();
    const parent = new FakeElement(960, 540);
    assert.throws(
      () =>
        createDisplay({
          env,
          parent,
          onResize: () => {
            throw new Error('listener boom');
          },
        }),
      /listener boom/,
    );
    assert.equal(parent.children.length, 0);
    assert.equal(window.listenerCount('resize'), 0);
    assert.equal(observers[0].disconnected, true);
    assert.equal(queries[0].listeners.size, 0);
  });

  test('a parent whose appendChild throws leaves no window listener behind', () => {
    const { env, window } = makeEnv();
    const parent = new FakeElement(960, 540);
    parent.appendChild = () => {
      throw new Error('read-only tree');
    };
    assert.throws(() => createDisplay({ env, parent }), /read-only tree/);
    assert.equal(window.listenerCount('resize'), 0);
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: re-entrancy and listener isolation
// ---------------------------------------------------------------------------------------------

describe('createDisplay: re-entrancy', () => {
  test('a listener that switches mode never leaves later listeners with a stale layout', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(800, 540);
    const seen = [];
    let d = null;
    d = createDisplay({
      env,
      parent,
      onResize: (L) => {
        if (d && L.mode === 'integer' && L.cssWidth === 700) d.setMode('fit');
      },
    });
    d.onResize((L) => seen.push(`${L.mode}@${L.cssWidth}`));
    parent.clientWidth = 700;
    observers[0].cb();
    assert.deepEqual(seen, ['fit@700']);
    assert.equal(d.layout.mode, 'fit');
    assert.equal(d.mode, 'fit');
    assert.equal(d.canvas.style.width, '700px');
  });

  test('a listener that calls resize() while the parent changed again delivers only the newest layout', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const widths = [];
    const d = createDisplay({ env, parent });
    d.onResize(() => {
      if (parent.clientWidth === 800) {
        parent.clientWidth = 700; // the parent moved again while we were reacting
        d.resize();
      }
    });
    d.onResize((L) => widths.push(L.cssWidth));
    parent.clientWidth = 800;
    observers[0].cb();
    assert.deepEqual(widths, [700]);
    assert.equal(d.layout.cssWidth, 700);
  });

  test('destroy() from inside a listener stops the dispatch cleanly', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    let later = 0;
    d.onResize(() => d.destroy());
    d.onResize(() => later++);
    parent.clientWidth = 800;
    assert.doesNotThrow(() => observers[0].cb());
    assert.equal(later, 0);
    assert.equal(d.destroyed, true);
    assert.equal(parent.children.length, 0);
  });

  test('listeners that unsubscribe themselves or others mid-dispatch are handled', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    const calls = { a: 0, b: 0, c: 0 };
    let offB;
    const offA = d.onResize(() => {
      calls.a++;
      offA();
      offB();
    });
    offB = d.onResize(() => calls.b++);
    d.onResize(() => calls.c++);
    parent.clientWidth = 800;
    observers[0].cb();
    parent.clientWidth = 700;
    observers[0].cb();
    assert.deepEqual(calls, { a: 1, b: 0, c: 2 });
  });

  test('a listener that subscribes a new listener does not cause infinite growth', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    let added = 0;
    d.onResize(() => {
      if (added < 1) {
        added++;
        d.onResize(() => {});
      }
    });
    parent.clientWidth = 800;
    assert.doesNotThrow(() => observers[0].cb());
    parent.clientWidth = 700;
    assert.doesNotThrow(() => observers[0].cb());
    assert.equal(added, 1);
  });

  test('a throwing listener does not starve the others; the first error is rethrown afterwards', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    const order = [];
    d.onResize(() => {
      order.push('a');
      throw new Error('first');
    });
    d.onResize(() => {
      order.push('b');
      throw new Error('second');
    });
    d.onResize(() => order.push('c'));
    parent.clientWidth = 800;
    assert.throws(() => observers[0].cb(), /first/);
    assert.deepEqual(order, ['a', 'b', 'c']);
    assert.equal(d.layout.cssWidth, 800); // state stayed consistent
    assert.equal(d.canvas.width, 800);
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: destroyed state
// ---------------------------------------------------------------------------------------------

describe('createDisplay: after destroy()', () => {
  test('setMode is a no-op that keeps mode and layout.mode in agreement', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(800, 540) });
    const layout = d.layout;
    d.destroy();
    assert.equal(d.setMode('fit'), layout);
    assert.equal(d.mode, 'integer');
    assert.equal(d.layout.mode, 'integer');
    assert.throws(() => d.setMode('bogus'), TypeError); // still validates
  });

  test('exposes `destroyed`, keeps the last layout readable, and never fires late subscribers', () => {
    const { env, window, queries } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(800, 540) });
    assert.equal(d.destroyed, false);
    d.destroy();
    assert.equal(d.destroyed, true);
    let fired = 0;
    const off = d.onResize(() => fired++);
    window.devicePixelRatio = 2;
    window.dispatch('resize');
    queries[0].fire();
    d.resize();
    assert.equal(fired, 0);
    assert.doesNotThrow(off);
    assert.equal(d.scale, 1);
    assert.deepEqual(d.toGame(160, 135), { x: 0, y: 0, inside: true });
    assert.doesNotThrow(() => d.clear());
    assert.doesNotThrow(() => d.setBackground('#fff'));
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: state restore, dedupe identity, large inputs
// ---------------------------------------------------------------------------------------------

describe('createDisplay: state restore and large inputs', () => {
  test('mode round-trip and size round-trip restore a deep-equal layout', () => {
    const { env, observers } = makeEnv({ dpr: 1.5 });
    const parent = new FakeElement(1000, 700);
    const d = createDisplay({ env, parent });
    const original = d.layout;
    d.setMode('fit');
    assert.notDeepEqual(d.layout, original);
    d.setMode('integer');
    assert.deepEqual(d.layout, original);
    parent.clientWidth = 300;
    observers[0].cb();
    assert.ok(d.layout.pixelScale < 1);
    parent.clientWidth = 1000;
    observers[0].cb();
    assert.deepEqual(d.layout, original);
  });

  test('unchanged measurements keep the very same layout object (cheap identity checks for callers)', () => {
    const { env, observers, window } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    const L = d.layout;
    for (let i = 0; i < 10_000; i++) {
      observers[0].cb();
      window.dispatch('resize');
      d.resize();
    }
    assert.equal(d.layout, L);
    assert.equal(d.canvas.sizeWrites, 2); // the initial width + height only
  });

  test('5000 subscribers each hear exactly one notification per change', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    const counts = new Array(5000).fill(0);
    const offs = counts.map((_, i) => d.onResize(() => counts[i]++));
    parent.clientWidth = 800;
    observers[0].cb();
    observers[0].cb(); // duplicate measurement
    assert.ok(counts.every((c) => c === 1));
    offs.forEach((off) => off());
    parent.clientWidth = 700;
    observers[0].cb();
    assert.ok(counts.every((c) => c === 1));
  });

  test('a resize storm keeps canvas, style, smoothing and notifications consistent', () => {
    const { env, observers, window, queries } = makeEnv({ dpr: 1 });
    const parent = new FakeElement(960, 540);
    const notified = [];
    const d = createDisplay({ env, parent, onResize: (L) => notified.push(L) });
    const rnd = lcg(2024);
    let distinct = 1;
    for (let i = 0; i < 1000; i++) {
      const prev = d.layout;
      const r = rnd();
      if (r < 0.4) {
        parent.clientWidth = Math.floor(rnd() * 2500);
        parent.clientHeight = Math.floor(rnd() * 1500);
        observers[0].cb();
      } else if (r < 0.6) {
        window.devicePixelRatio = [1, 1.25, 1.5, 2, 3][Math.floor(rnd() * 5)];
        queries.at(-1).fire();
      } else if (r < 0.8) {
        d.setMode(rnd() < 0.5 ? 'fit' : 'integer');
      } else {
        window.dispatch('resize');
      }
      const L = d.layout;
      if (L !== prev) distinct++;
      assert.equal(d.canvas.width, L.backingWidth);
      assert.equal(d.canvas.height, L.backingHeight);
      assert.equal(d.canvas.style.width, `${L.cssWidth}px`);
      assert.equal(d.canvas.style.height, `${L.cssHeight}px`);
      assert.equal(d.canvas.ctx.imageSmoothingEnabled, false);
      assert.equal(L.mode, d.mode);
      assert.equal(L.dpr, Math.min(window.devicePixelRatio, L.dpr));
      assert.deepEqual(
        L,
        computeLayout({ cssWidth: parent.clientWidth, cssHeight: parent.clientHeight, dpr: window.devicePixelRatio, mode: d.mode }),
      );
      // Exactly one live DPR query, armed for the current ratio.
      assert.equal(queries.filter((q) => q.listeners.size > 0).length, 1);
      assert.equal(queries.at(-1).media, `(resolution: ${window.devicePixelRatio}dppx)`);
    }
    assert.equal(notified.length, distinct);
    assert.ok(distinct > 100);
  });

  test('resizing never touches the game buffer (no clears, no fills on ctx)', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    for (const w of [800, 700, 2000, 10, 960]) {
      parent.clientWidth = w;
      observers[0].cb();
      d.setMode('fit');
      d.setMode('integer');
    }
    assert.deepEqual(d.ctx.ops, []);
    assert.equal(d.buffer.width, 480);
    assert.equal(d.buffer.height, 270);
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: present() strip accounting and DPR edge cases
// ---------------------------------------------------------------------------------------------

describe('createDisplay: present() strips', () => {
  test('fit mode paints at most two strips (never a float sliver on the full axis)', () => {
    const { env } = makeEnv();
    for (const [w, h] of [[123, 540], [800, 540], [1000, 600], [333, 111], [4000, 2999]]) {
      const d = createDisplay({ env, parent: new FakeElement(w, h), mode: 'fit' });
      d.canvas.ctx.ops.length = 0;
      d.present();
      const f = fills(d);
      assert.ok(f.length <= 2, `${w}x${h} painted ${f.length} strips: ${JSON.stringify(f.map((x) => x.args))}`);
      for (const strip of f) assert.ok(strip.args[2] >= 1 && strip.args[3] >= 1, `${w}x${h} sub-pixel strip ${strip.args}`);
    }
  });

  test('one pixel over native: only the right and bottom strips exist', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(481, 271) });
    d.canvas.ctx.ops.length = 0;
    d.present();
    assert.deepEqual(
      fills(d).map((f) => f.args),
      [
        [0, 270, 481, 1],
        [480, 0, 1, 270],
      ],
    );
  });

  test('clear() without arguments uses the current background, including after setBackground', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 540), background: '#111' });
    d.setBackground('#abc');
    d.clear();
    assert.deepEqual(d.ctx.ops.at(-1), { op: 'fillRect', args: [0, 0, 480, 270], fillStyle: '#abc' });
  });

  test('the visible context is created opaque and the canvas is styled for crisp pixels', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    assert.deepEqual(d.canvas.contextAttrs, { alpha: false });
    assert.equal(d.canvas.style.imageRendering, 'pixelated');
    assert.equal(d.canvas.style.display, 'block');
  });
});

describe('createDisplay: DPR tracking edge cases', () => {
  test('a DPR event that reports the same ratio does not relayout or re-arm', () => {
    const { env, queries } = makeEnv({ dpr: 2 });
    let count = 0;
    const d = createDisplay({ env, parent: new FakeElement(960, 540), onResize: () => count++ });
    const L = d.layout;
    queries[0].fire();
    assert.equal(d.layout, L);
    assert.equal(count, 1);
    assert.equal(queries.length, 1);
  });

  test('maxBackingPixels lowering the effective dpr does not change which raw dpr is watched', () => {
    const { env, queries } = makeEnv({ dpr: 3 });
    const d = createDisplay({ env, parent: new FakeElement(2000, 2000), maxBackingPixels: 4_000_000 });
    assert.equal(d.dpr, 1);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].media, '(resolution: 3dppx)');
  });

  test('garbage devicePixelRatio is normalised, including mid-flight', () => {
    const { env, window, queries } = makeEnv({ dpr: 2 });
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    window.devicePixelRatio = NaN;
    queries[0].fire();
    assert.equal(d.dpr, 1);
    assert.equal(normalizeDpr(window.devicePixelRatio), 1);
    assert.equal(queries.at(-1).media, '(resolution: 1dppx)');
  });

  test('a body parent follows window.inner* and ignores its own clientWidth', () => {
    const { env, document, window, observers } = makeEnv({ innerWidth: 1920, innerHeight: 1080 });
    document.body.clientWidth = 5;
    document.body.clientHeight = 5;
    const d = createDisplay({ env, parent: document.body });
    assert.equal(d.pixelScale, 4);
    window.innerWidth = 960;
    window.innerHeight = 540;
    observers[0].cb();
    assert.equal(d.pixelScale, 2);
  });
});

// ---------------------------------------------------------------------------------------------
// createDisplay: coordinate mapping under stress
// ---------------------------------------------------------------------------------------------

describe('createDisplay: coordinate mapping under stress', () => {
  test('toGame tolerates garbage client coordinates without throwing and never reports inside', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(800, 540) });
    for (const bad of [NaN, undefined, Infinity, -Infinity, 'x', {}, null]) {
      const p = d.toGame(bad, bad);
      assert.equal(typeof p.x, 'number');
      assert.equal(p.inside, false, String(bad));
    }
    assert.deepEqual(d.toGame(null, null), { x: -160, y: -135, inside: false }); // null -> 0
  });

  test('round-trips hold under letterbox + fractional dpr + CSS transform + canvas offset', () => {
    const { env } = makeEnv({ dpr: 1.75 });
    const d = createDisplay({ env, parent: new FakeElement(1234, 777) });
    d.canvas.rect = { left: 13.25, top: 7.5, width: 1234 * 0.6, height: 777 * 0.6 };
    const rnd = lcg(77);
    for (let i = 0; i < 1000; i++) {
      const x = rnd() * 480;
      const y = rnd() * 270;
      const c = d.toClient(x, y);
      const g = d.toGame(c.clientX, c.clientY);
      assert.ok(near(g.x, x, 1e-7) && near(g.y, y, 1e-7), `${x},${y} -> ${g.x},${g.y}`);
      assert.equal(g.inside, true);
    }
    // The bar region maps outside.
    assert.equal(d.toGame(13.25 + 1, 7.5 + 1).inside, false);
  });

  test('two displays on one parent map independently and destroy independently', () => {
    const { env, window } = makeEnv();
    const parent = new FakeElement(800, 540);
    const a = createDisplay({ env, parent });
    const b = createDisplay({ env, parent, mode: 'fit' });
    assert.equal(parent.children.length, 2);
    assert.equal(a.scale, 1);
    assert.ok(near(b.scale, 800 / 480));
    a.destroy();
    assert.equal(parent.children.length, 1);
    assert.equal(parent.children[0], b.canvas);
    assert.equal(window.listenerCount('resize'), 1);
    assert.ok(near(b.toGame(0, 45).x, 0));
    b.destroy();
    assert.equal(window.listenerCount('resize'), 0);
  });
});

// ---------------------------------------------------------------------------------------------
// Second verification pass: boundaries, huge inputs, validation, determinism, restore
// ---------------------------------------------------------------------------------------------

describe('computeLayout: safe-integer boundary and huge inputs', () => {
  test('the largest safe integer is accepted and still yields a finite, consistent layout', () => {
    const L = computeLayout({ width: Number.MAX_SAFE_INTEGER, height: 1, cssWidth: 1, cssHeight: 1 });
    for (const [k, v] of Object.entries(L)) {
      if (typeof v === 'number') assert.ok(Number.isFinite(v) && v >= 0, `${k}=${v}`);
    }
    assert.ok(L.pixelScale > 0 && L.pixelScale < 1);
    assert.equal(L.integer, false);
    assert.equal(L.destWidth, 1);
  });

  test('MAX_SAFE_INTEGER + 1 and 2 ** 60 are RangeErrors even though Number.isInteger says yes', () => {
    for (const huge of [Number.MAX_SAFE_INTEGER + 1, 2 ** 60, 1e300]) {
      assert.ok(Number.isInteger(huge));
      assert.throws(() => computeLayout({ width: huge, height: 270 }), RangeError, String(huge));
      assert.throws(() => computeLayout({ width: 480, height: huge }), RangeError, String(huge));
      const { env } = makeEnv();
      assert.throws(() => createDisplay({ env, parent: new FakeElement(960, 540), width: huge }), RangeError);
    }
  });

  test('a 1x1 native buffer and a 10000x10000 one both lay out sanely', () => {
    const tiny = computeLayout({ width: 1, height: 1, cssWidth: 960, cssHeight: 540 });
    assert.equal(tiny.pixelScale, 540);
    assert.equal(tiny.destWidth, 540);
    assert.equal(tiny.deviceOffsetX, 210);
    const big = computeLayout({ width: 10_000, height: 10_000, cssWidth: 960, cssHeight: 540 });
    assert.equal(big.integer, false);
    assert.equal(big.destHeight, 540);
    assert.ok(near(big.destWidth, 540));
  });

  test('enormous CSS boxes stay finite with and without a backing cap', () => {
    const free = computeLayout({ cssWidth: 1e7, cssHeight: 1e7, dpr: 3 });
    assert.equal(free.backingWidth, 3e7);
    assert.equal(free.pixelScale, Math.floor(3e7 / 480));
    assert.ok(Number.isInteger(free.deviceOffsetX) && free.deviceOffsetX >= 0);
    const capped = computeLayout({ cssWidth: 1e7, cssHeight: 1e7, dpr: 3, maxBackingPixels: 16_777_216 });
    assert.ok(capped.backingWidth * capped.backingHeight <= 16_777_216 + capped.backingWidth + capped.backingHeight);
    assert.ok(capped.dpr < 3 && capped.dpr > 0);
    assert.equal(capped.cssWidth, 1e7);
    const absurd = computeLayout({ cssWidth: 1e308, cssHeight: 1e308 });
    assert.ok(Number.isFinite(absurd.backingWidth));
    assert.equal(absurd.backingWidth, 1e308);
    assert.ok(Number.isFinite(absurd.scale));
  });

  test('100k random specs never produce NaN, negative or non-finite fields', () => {
    const rnd = lcg(0xdeadbeef);
    const dprs = [1e-6, 0.5, 1, 1.25, 1.5, 1.75, 2, 2.625, 3, 4, 10];
    for (let i = 0; i < 100_000; i++) {
      const L = computeLayout({
        width: 1 + Math.floor(rnd() * 2000),
        height: 1 + Math.floor(rnd() * 2000),
        cssWidth: Math.floor(rnd() * 6000) - 10,
        cssHeight: Math.floor(rnd() * 4000) - 10,
        dpr: dprs[Math.floor(rnd() * dprs.length)],
        mode: rnd() < 0.5 ? 'integer' : 'fit',
        maxBackingPixels: rnd() < 0.2 ? Math.floor(rnd() * 1e7) : Infinity,
      });
      for (const key of ['dpr', 'cssWidth', 'cssHeight', 'backingWidth', 'backingHeight', 'pixelScale', 'destWidth', 'destHeight', 'deviceOffsetX', 'deviceOffsetY', 'scale', 'offsetX', 'offsetY', 'viewWidth', 'viewHeight']) {
        const v = L[key];
        if (!(Number.isFinite(v) && v >= 0 && !Object.is(v, -0))) assert.fail(`${key}=${v} for ${JSON.stringify(L)}`);
      }
      assert.ok(L.destWidth <= L.backingWidth + 1e-9 && L.destHeight <= L.backingHeight + 1e-9);
      assert.ok(L.pixelScale > 0 && L.scale > 0);
    }
  });

  test('non-object specs are tolerated as "no overrides" (strings/numbers) or rejected (null)', () => {
    assert.deepEqual(computeLayout('nope'), computeLayout());
    assert.deepEqual(computeLayout(42), computeLayout());
    assert.throws(() => computeLayout(null), TypeError);
  });
});

describe('createDisplay: validation (second pass)', () => {
  test('a null or primitive options argument is a clear TypeError, not a destructuring crash', () => {
    for (const bad of [null, 'opts', 42, true]) {
      assert.throws(() => createDisplay(bad), { name: 'TypeError', message: /options object/ }, String(bad));
    }
  });

  test('clear() rejects non-string colours instead of silently reusing the last fillStyle', () => {
    const { env } = makeEnv();
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    d.ctx.fillStyle = '#bad';
    for (const bad of [0, 0xffffff, {}, [], true, '', NaN]) {
      assert.throws(() => d.clear(bad), TypeError, String(bad));
    }
    assert.deepEqual(d.ctx.ops, []);
    d.clear('rgba(1, 2, 3, .5)');
    d.clear(null);
    d.clear(undefined); // explicit undefined -> the default (background)
    assert.deepEqual(
      d.ctx.ops.map((o) => [o.op, o.fillStyle]),
      [
        ['fillRect', 'rgba(1, 2, 3, .5)'],
        ['clearRect', undefined],
        ['fillRect', '#000'],
      ],
    );
  });

  test('a window devicePixelRatio given as a numeric string is coerced; a negative one falls back to 1', () => {
    const { env, window, queries } = makeEnv({ dpr: '2' });
    const d = createDisplay({ env, parent: new FakeElement(960, 540) });
    assert.equal(d.dpr, 2);
    assert.equal(d.canvas.width, 1920);
    assert.equal(queries.at(-1).media, '(resolution: 2dppx)');
    window.devicePixelRatio = -3;
    queries.at(-1).fire();
    assert.equal(d.dpr, 1);
    assert.equal(d.canvas.width, 960);
  });

  test('unicode-named modes are rejected by setMode without changing state', () => {
    const { env } = makeEnv();
    let count = 0;
    const d = createDisplay({ env, parent: new FakeElement(800, 540), onResize: () => count++ });
    for (const bad of ['ﬁt', 'ｉｎｔｅｇｅｒ', 'fit ', 'FIT', 'fit\n']) {
      assert.throws(() => d.setMode(bad), TypeError, JSON.stringify(bad));
    }
    assert.equal(d.mode, 'integer');
    assert.equal(count, 1);
  });

  test('the native size is exposed read-only in spirit: layout.width/height never drift from options', () => {
    const { env, observers } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent, width: 320, height: 180 });
    for (const w of [10, 5000, 320, 0, 961]) {
      parent.clientWidth = w;
      observers[0].cb();
      assert.equal(d.layout.width, 320);
      assert.equal(d.layout.height, 180);
      assert.equal(d.buffer.width, 320);
      assert.equal(d.buffer.height, 180);
    }
  });
});

describe('createDisplay: determinism and state restore (second pass)', () => {
  test('two displays built from identical inputs issue identical present() op streams', () => {
    const run = () => {
      const { env } = makeEnv({ dpr: 1.5 });
      const d = createDisplay({ env, parent: new FakeElement(1234, 777), background: '#123' });
      d.setMode('fit');
      d.setMode('integer');
      d.canvas.ctx.ops.length = 0;
      d.present();
      d.present();
      return JSON.stringify(d.canvas.ctx.ops.map((o) => ({ ...o, args: o.args.map((a) => (typeof a === 'object' ? 'buffer' : a)) })));
    };
    assert.equal(run(), run());
  });

  test('destroying and recreating a display on the same parent restores a deep-equal layout and a clean DOM', () => {
    const { env, window, document, observers } = makeEnv({ dpr: 2 });
    const parent = new FakeElement(1000, 700);
    const first = createDisplay({ env, parent, mode: 'fit' });
    const snapshot = first.layout;
    const style = { ...first.canvas.style };
    first.destroy();
    assert.equal(parent.children.length, 0);
    assert.equal(window.listenerCount('resize'), 0);
    assert.ok(observers.every((o) => o.disconnected));
    const second = createDisplay({ env, parent, mode: 'fit' });
    assert.deepEqual(second.layout, snapshot);
    assert.notEqual(second.layout, snapshot);
    assert.deepEqual({ ...second.canvas.style }, style);
    assert.equal(parent.children.length, 1);
    assert.equal(document.body.children.length, 0);
    second.destroy();
  });

  test('present() after a resize storm draws the frame exactly where the current layout says', () => {
    const { env, observers, window } = makeEnv();
    const parent = new FakeElement(960, 540);
    const d = createDisplay({ env, parent });
    const rnd = lcg(31337);
    for (let i = 0; i < 300; i++) {
      parent.clientWidth = 1 + Math.floor(rnd() * 3000);
      parent.clientHeight = 1 + Math.floor(rnd() * 2000);
      window.devicePixelRatio = [1, 1.5, 2][Math.floor(rnd() * 3)];
      observers[0].cb();
      d.canvas.ctx.ops.length = 0;
      d.present();
      const L = d.layout;
      const blit = d.canvas.ctx.ops.at(-1);
      assert.equal(blit.op, 'drawImage');
      assert.deepEqual(blit.args.slice(1), [0, 0, 480, 270, L.deviceOffsetX, L.deviceOffsetY, L.destWidth, L.destHeight]);
      for (const f of fills(d)) {
        const [x, y, w, h] = f.args;
        // No strip may overlap the frame rectangle.
        const overlapsX = x < L.deviceOffsetX + L.destWidth && x + w > L.deviceOffsetX;
        const overlapsY = y < L.deviceOffsetY + L.destHeight && y + h > L.deviceOffsetY;
        assert.ok(!(overlapsX && overlapsY), `strip ${f.args} overlaps frame ${JSON.stringify(L)}`);
        assert.ok(x >= 0 && y >= 0 && x + w <= L.backingWidth + 1e-9 && y + h <= L.backingHeight + 1e-9, `strip ${f.args} outside canvas`);
      }
    }
  });

  test('toGame is pure with respect to repeated calls (no hidden state, 50k calls)', () => {
    const { env } = makeEnv({ dpr: 1.25 });
    const d = createDisplay({ env, parent: new FakeElement(1000, 600) });
    d.canvas.rect = { left: 3, top: 4, width: 1000, height: 600 };
    const ref = d.toGame(503, 304);
    for (let i = 0; i < 50_000; i++) {
      const p = d.toGame(503, 304);
      if (p.x !== ref.x || p.y !== ref.y || p.inside !== ref.inside) assert.fail(`drifted at ${i}`);
    }
  });
});

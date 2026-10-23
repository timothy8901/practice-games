import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSceneStack,
  drawTransition,
  transitionFrame,
  isTransitionKind,
  isWipeDirection,
  TRANSITION_KINDS,
  WIPE_DIRECTIONS,
  DEFAULT_TRANSITION_MS,
  DEFAULT_TRANSITION_COLOR,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
} from '../js/core/scene.js';

const W = 480;
const H = 270;

/**
 * Builds a scene whose hooks append `[name, hook, ...args]` to `trace`.
 * @param {string} name
 * @param {any[]} trace
 * @param {object} [extra] Extra properties / hook overrides merged on top.
 */
function makeScene(name, trace, extra = {}) {
  const hooks = ['enter', 'exit', 'pause', 'resume', 'update', 'draw', 'handleInput'];
  const scene = { name };
  for (const hook of hooks) {
    scene[hook] = (...args) => {
      trace.push(args.length ? [name, hook, ...args] : [name, hook]);
    };
  }
  return Object.assign(scene, extra);
}

/**
 * A recording 2D-context double. `save`/`restore` keep a real state stack for fillStyle / alpha /
 * composite so leak tests are meaningful; `fillRect` records what was drawn with the live state.
 * @param {number} [width]
 * @param {number} [height]
 */
function fakeCtx(width = W, height = H) {
  const calls = [];
  const rects = [];
  const saved = [];
  const ctx = {
    canvas: { width, height },
    fillStyle: '#ffffff',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    calls,
    rects,
    get depth() {
      return saved.length;
    },
    save() {
      saved.push({ fillStyle: ctx.fillStyle, globalAlpha: ctx.globalAlpha, op: ctx.globalCompositeOperation });
      calls.push(['save']);
    },
    restore() {
      const s = saved.pop();
      if (s) {
        ctx.fillStyle = s.fillStyle;
        ctx.globalAlpha = s.globalAlpha;
        ctx.globalCompositeOperation = s.op;
      }
      calls.push(['restore']);
    },
    setTransform(...m) {
      calls.push(['setTransform', ...m]);
    },
    fillRect(x, y, w, h) {
      const r = { x, y, w, h, fillStyle: ctx.fillStyle, alpha: ctx.globalAlpha };
      rects.push(r);
      calls.push(['fillRect', x, y, w, h, ctx.fillStyle, ctx.globalAlpha]);
    },
  };
  return ctx;
}

/** An input double counting `flush()` calls. */
function fakeInput() {
  return {
    flushes: 0,
    flush() {
      this.flushes += 1;
    },
  };
}

/** Sum of the areas of every recorded fillRect. */
const coveredArea = (ctx) => ctx.rects.reduce((sum, r) => sum + r.w * r.h, 0);

/** Only the fillRect entries of a call log (so save/restore noise is ignored). */
const fills = (ctx) => ctx.calls.filter((c) => c[0] === 'fillRect');

describe('module exports', () => {
  it('exposes frozen constant tables and sane defaults', () => {
    assert.deepEqual([...TRANSITION_KINDS], ['fade', 'iris', 'wipe', 'none']);
    assert.deepEqual([...WIPE_DIRECTIONS], ['right', 'left', 'down', 'up']);
    assert.ok(Object.isFrozen(TRANSITION_KINDS));
    assert.ok(Object.isFrozen(WIPE_DIRECTIONS));
    assert.equal(DEFAULT_TRANSITION_MS, 400);
    assert.equal(DEFAULT_TRANSITION_COLOR, '#000000');
    assert.equal(DEFAULT_WIDTH, 480);
    assert.equal(DEFAULT_HEIGHT, 270);
  });

  it('isTransitionKind / isWipeDirection accept exactly the documented strings', () => {
    for (const k of TRANSITION_KINDS) assert.equal(isTransitionKind(k), true, k);
    for (const bad of ['Fade', 'slide', '', 0, null, undefined, {}, ['fade']]) {
      assert.equal(isTransitionKind(bad), false, String(bad));
    }
    for (const d of WIPE_DIRECTIONS) assert.equal(isWipeDirection(d), true, d);
    for (const bad of ['Right', 'diagonal', '', 1, null, undefined]) {
      assert.equal(isWipeDirection(bad), false, String(bad));
    }
  });
});

describe('createSceneStack', () => {
  it('returns the contract API plus helpers on a frozen object', () => {
    const stack = createSceneStack();
    for (const m of ['push', 'pop', 'replace', 'top', 'update', 'draw', 'handleInput', 'transition',
      'transitionState', 'find', 'has', 'clear']) {
      assert.equal(typeof stack[m], 'function', `${m} should be a function`);
    }
    assert.deepEqual(stack.stack, []);
    assert.equal(stack.size, 0);
    assert.equal(stack.isTransitioning, false);
    assert.equal(stack.top(), null);
    assert.equal(stack.transitionState(), null);
    assert.ok(Object.isFrozen(stack));
    assert.throws(() => {
      stack.extra = 1;
    }, TypeError);
  });

  it('accepts no options, {}, null or undefined', () => {
    for (const o of [undefined, null, {}]) assert.doesNotThrow(() => createSceneStack(o));
  });

  it('rejects malformed options', () => {
    assert.throws(() => createSceneStack('opts'), { name: 'TypeError', message: /options/ });
    assert.throws(() => createSceneStack({ input: 'kbd' }), { name: 'TypeError', message: /input/ });
    assert.throws(() => createSceneStack({ onChange: 42 }), { name: 'TypeError', message: /onChange/ });
    assert.throws(() => createSceneStack({ width: 0 }), { name: 'TypeError', message: /width/ });
    assert.throws(() => createSceneStack({ height: -1 }), { name: 'TypeError', message: /height/ });
    assert.throws(() => createSceneStack({ height: NaN }), { name: 'TypeError', message: /height/ });
  });

  it('keeps stacks independent', () => {
    const a = createSceneStack();
    const b = createSceneStack();
    a.push({ name: 'x' });
    assert.equal(a.size, 1);
    assert.equal(b.size, 0);
  });
});

describe('push', () => {
  it('enters the scene with params, pauses the previous top and returns the scene', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace);
    assert.equal(stack.push(a, { level: 1 }), a);
    assert.equal(stack.push(b, 'params'), b);
    assert.deepEqual(trace, [['a', 'enter', { level: 1 }], ['a', 'pause'], ['b', 'enter', 'params']]);
    assert.equal(stack.top(), b);
    assert.equal(stack.size, 2);
    assert.deepEqual(stack.stack.map((s) => s.name), ['a', 'b']);
  });

  it('defaults params to an empty object when omitted (but passes null through)', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace), null);
    assert.deepEqual(trace[0], ['a', 'enter', {}]);
    assert.deepEqual(trace[2], ['b', 'enter', null]);
  });

  it('rejects things that are not scene objects, with a hint for forgotten `new`', () => {
    const stack = createSceneStack();
    for (const bad of [null, undefined, 42, 'title', [], Symbol('s')]) {
      assert.throws(() => stack.push(bad), { name: 'TypeError', message: /scene\.push/ });
    }
    class Title {}
    assert.throws(() => stack.push(Title), { name: 'TypeError', message: /forget `new`/ });
    assert.equal(stack.size, 0);
  });

  it('rejects a scene instance that is already on the stack', () => {
    const stack = createSceneStack();
    const a = { name: 'a' };
    stack.push(a);
    stack.push({ name: 'b' });
    assert.throws(() => stack.push(a), { name: 'Error', message: /"a" is already on the stack/ });
    assert.equal(stack.size, 2);
  });

  it('accepts scenes with no hooks at all', () => {
    const stack = createSceneStack();
    const bare = {};
    assert.doesNotThrow(() => {
      stack.push(bare);
      stack.update(16);
      stack.draw(fakeCtx());
      stack.handleInput({});
      stack.pop();
    });
  });

  it('invokes hooks as methods so class instances keep `this`', () => {
    class Counter {
      constructor() {
        this.name = 'counter';
        this.ticks = 0;
        this.entered = null;
      }
      enter(params) {
        this.entered = params;
      }
      update(dt) {
        this.ticks += dt;
      }
    }
    const stack = createSceneStack();
    const c = new Counter();
    stack.push(c, { hi: true });
    stack.update(5);
    stack.update(7);
    assert.deepEqual(c.entered, { hi: true });
    assert.equal(c.ticks, 12);
  });

  it('supports a scene pushing a modal from its own enter()', () => {
    const trace = [];
    const stack = createSceneStack();
    const modal = makeScene('modal', trace, { opaque: false });
    const world = makeScene('world', trace, {
      enter() {
        trace.push(['world', 'enter']);
        stack.push(modal);
      },
    });
    stack.push(world);
    assert.deepEqual(trace, [['world', 'enter'], ['world', 'pause'], ['modal', 'enter', {}]]);
    assert.deepEqual(stack.stack, [world, modal]);
  });

  it('lets hook errors propagate while keeping the structural change', () => {
    const stack = createSceneStack();
    const boom = {
      name: 'boom',
      enter() {
        throw new Error('enter failed');
      },
    };
    assert.throws(() => stack.push(boom), /enter failed/);
    assert.equal(stack.top(), boom);
    assert.equal(stack.size, 1);
  });
});

describe('pop', () => {
  it('exits the top, resumes the new top with the result and returns the popped scene', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace);
    stack.push(a);
    stack.push(b);
    trace.length = 0;
    assert.equal(stack.pop({ choice: 'yes' }), b);
    assert.deepEqual(trace, [['b', 'exit'], ['a', 'resume', { choice: 'yes' }]]);
    assert.equal(stack.top(), a);
    assert.equal(stack.has(b), false);
  });

  it('passes an undefined result through unchanged', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace));
    trace.length = 0;
    stack.pop();
    assert.deepEqual(trace, [['b', 'exit'], ['a', 'resume', undefined]]);
  });

  it('is a no-op returning null on an empty stack', () => {
    const stack = createSceneStack();
    assert.equal(stack.pop(), null);
    assert.equal(stack.pop('x'), null);
    assert.equal(stack.size, 0);
  });

  it('does not resume anything when the last scene is popped', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    trace.length = 0;
    stack.pop();
    assert.deepEqual(trace, [['a', 'exit']]);
    assert.equal(stack.top(), null);
  });

  it('round-trips: push then pop restores the previous top exactly', () => {
    const stack = createSceneStack();
    const a = { name: 'a' };
    const b = { name: 'b' };
    stack.push(a);
    const before = stack.stack;
    stack.push(b);
    stack.pop();
    assert.deepEqual(stack.stack, before);
    assert.equal(stack.top(), a);
  });

  it('lets a scene pop itself from update() without updating the newly exposed scene that frame', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace, {
      update(dt) {
        trace.push(['b', 'update', dt]);
        stack.pop('bye');
      },
    });
    stack.push(a);
    stack.push(b);
    trace.length = 0;
    stack.update(16);
    assert.deepEqual(trace, [['b', 'update', 16], ['b', 'exit'], ['a', 'resume', 'bye']]);
    assert.equal(stack.top(), a);
  });
});

describe('replace', () => {
  it('exits the old top and enters the new one without touching the scene beneath', () => {
    const trace = [];
    const stack = createSceneStack();
    const base = makeScene('base', trace);
    const a = makeScene('a', trace);
    const b = makeScene('b', trace);
    stack.push(base);
    stack.push(a);
    trace.length = 0;
    assert.equal(stack.replace(b, { from: 'a' }), a);
    assert.deepEqual(trace, [['a', 'exit'], ['b', 'enter', { from: 'a' }]]);
    assert.deepEqual(stack.stack, [base, b]);
    assert.equal(stack.size, 2);
  });

  it('acts like push on an empty stack and returns null', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    assert.equal(stack.replace(a, 7), null);
    assert.deepEqual(trace, [['a', 'enter', 7]]);
    assert.equal(stack.top(), a);
  });

  it('restarts the top when replaced with itself (exit, then enter)', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    stack.push(a, 1);
    trace.length = 0;
    assert.equal(stack.replace(a, 2), a);
    assert.deepEqual(trace, [['a', 'exit'], ['a', 'enter', 2]]);
    assert.equal(stack.size, 1);
  });

  it('rejects a scene that sits lower in the stack', () => {
    const stack = createSceneStack();
    const a = { name: 'a' };
    stack.push(a);
    stack.push({ name: 'b' });
    assert.throws(() => stack.replace(a), { name: 'Error', message: /already on the stack/ });
    assert.equal(stack.size, 2);
  });

  it('rejects non-scenes', () => {
    const stack = createSceneStack();
    stack.push({});
    assert.throws(() => stack.replace(null), { name: 'TypeError', message: /scene\.replace/ });
    assert.throws(() => stack.replace(() => {}), { name: 'TypeError', message: /forget `new`/ });
  });
});

describe('update', () => {
  it('updates only the top scene with the given dt', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace));
    trace.length = 0;
    stack.update(16.7);
    assert.deepEqual(trace, [['b', 'update', 16.7]]);
  });

  it('updates an updateBelow chain bottom-to-top and stops at the first scene that opts out', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('deep', trace));
    stack.push(makeScene('world', trace));
    stack.push(makeScene('dialogue', trace, { updateBelow: true }));
    stack.push(makeScene('toast', trace, { updateBelow: true }));
    trace.length = 0;
    stack.update(10);
    assert.deepEqual(trace, [['world', 'update', 10], ['dialogue', 'update', 10], ['toast', 'update', 10]]);
  });

  it('treats a truthy-but-not-true updateBelow as false', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace, { updateBelow: 1 }));
    trace.length = 0;
    stack.update(1);
    assert.deepEqual(trace, [['b', 'update', 1]]);
  });

  it('clamps negative dt to 0 and rejects non-finite or non-numeric dt', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    trace.length = 0;
    stack.update(-5);
    assert.deepEqual(trace, [['a', 'update', 0]]);
    for (const bad of [NaN, Infinity, -Infinity, '16', undefined, null, {}]) {
      assert.throws(() => stack.update(bad), { name: 'TypeError', message: /dt/ });
    }
  });

  it('is harmless on an empty stack', () => {
    assert.doesNotThrow(() => createSceneStack().update(16));
  });

  it('skips a chained scene that was removed earlier in the same update', () => {
    const trace = [];
    const stack = createSceneStack();
    const world = makeScene('world', trace, {
      update(dt) {
        trace.push(['world', 'update', dt]);
        stack.pop();
      },
    });
    const modal = makeScene('modal', trace, { updateBelow: true });
    stack.push(world);
    stack.push(modal);
    trace.length = 0;
    stack.update(4);
    assert.deepEqual(trace, [['world', 'update', 4], ['modal', 'exit'], ['world', 'resume', undefined]]);
  });
});

describe('draw', () => {
  it('draws only the top scene when it is opaque', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace));
    trace.length = 0;
    const ctx = fakeCtx();
    stack.draw(ctx);
    assert.deepEqual(trace, [['b', 'draw', ctx]]);
  });

  it('draws from the topmost opaque scene upward, bottom to top', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('title', trace));
    stack.push(makeScene('world', trace));
    stack.push(makeScene('dialogue', trace, { opaque: false }));
    stack.push(makeScene('pause', trace, { opaque: false }));
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.map((t) => t[0]), ['world', 'dialogue', 'pause']);
  });

  it('draws everything when no scene is opaque, and treats undefined opaque as opaque', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace, { opaque: false }));
    stack.push(makeScene('b', trace, { opaque: false }));
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.map((t) => t[0]), ['a', 'b']);

    const stack2 = createSceneStack();
    stack2.push(makeScene('x', trace, { opaque: false }));
    stack2.push(makeScene('y', trace, { opaque: undefined }));
    stack2.push(makeScene('z', trace, { opaque: false }));
    trace.length = 0;
    stack2.draw(fakeCtx());
    assert.deepEqual(trace.map((t) => t[0]), ['y', 'z']);
  });

  it('isolates each scene inside save/restore so context state cannot leak', () => {
    const stack = createSceneStack();
    const seen = [];
    stack.push({
      opaque: false,
      draw(ctx) {
        ctx.fillStyle = '#ff0000';
        ctx.globalAlpha = 0.25;
      },
    });
    stack.push({
      opaque: false,
      draw(ctx) {
        seen.push(ctx.fillStyle, ctx.globalAlpha);
      },
    });
    const ctx = fakeCtx();
    stack.draw(ctx);
    assert.deepEqual(seen, ['#ffffff', 1]);
    assert.equal(ctx.depth, 0);
  });

  it('restores the context even when a scene draw throws, and propagates the error', () => {
    const stack = createSceneStack();
    stack.push({
      draw() {
        throw new Error('draw failed');
      },
    });
    const ctx = fakeCtx();
    assert.throws(() => stack.draw(ctx), /draw failed/);
    assert.equal(ctx.depth, 0);
  });

  it('works on a minimal context that only has fillRect', () => {
    const stack = createSceneStack();
    const log = [];
    stack.push({ draw: (ctx) => ctx.fillRect(0, 0, 1, 1) });
    stack.transition('fade', 100);
    stack.update(50);
    const ctx = { fillRect: (...a) => log.push(a) };
    assert.doesNotThrow(() => stack.draw(ctx));
    assert.deepEqual(log, [[0, 0, 1, 1], [0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT]]);
  });

  it('rejects a missing context', () => {
    const stack = createSceneStack();
    for (const bad of [undefined, null, 'ctx', 3]) {
      assert.throws(() => stack.draw(bad), { name: 'TypeError', message: /ctx/ });
    }
  });

  it('skips a scene removed by an earlier scene during the same draw', () => {
    const trace = [];
    const stack = createSceneStack();
    const base = makeScene('base', trace, {
      draw() {
        trace.push(['base', 'draw']);
        stack.pop();
      },
    });
    const modal = makeScene('modal', trace, { opaque: false });
    stack.push(base);
    stack.push(modal);
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.map((t) => t.slice(0, 2)), [['base', 'draw'], ['modal', 'exit'], ['base', 'resume']]);
  });
});

describe('handleInput', () => {
  it('forwards input to the top scene only and reports whether it was received', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace, { updateBelow: true, opaque: false }));
    trace.length = 0;
    const input = fakeInput();
    assert.equal(stack.handleInput(input), true);
    assert.deepEqual(trace, [['b', 'handleInput', input]]);
  });

  it('returns false on an empty stack or when the top has no handleInput', () => {
    const stack = createSceneStack();
    assert.equal(stack.handleInput({}), false);
    stack.push({});
    assert.equal(stack.handleInput({}), false);
  });

  it('is ignored for the whole duration of a transition', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.transition('fade', 100);
    trace.length = 0;
    const input = fakeInput();
    assert.equal(stack.handleInput(input), false);
    stack.update(50);
    assert.equal(stack.handleInput(input), false);
    stack.update(49.9);
    assert.equal(stack.handleInput(input), false);
    stack.update(0.1);
    assert.equal(stack.isTransitioning, false);
    assert.equal(stack.handleInput(input), true);
    assert.deepEqual(trace.filter((t) => t[1] === 'handleInput'), [['a', 'handleInput', input]]);
  });

  it('flushes the input on push/pop/replace/clear and when a transition ends, never mid-transition', () => {
    const input = fakeInput();
    const stack = createSceneStack({ input });
    stack.push({ name: 'a' });
    assert.equal(input.flushes, 1);
    stack.push({ name: 'b' });
    assert.equal(input.flushes, 2);
    stack.replace({ name: 'c' });
    assert.equal(input.flushes, 3);
    stack.pop();
    assert.equal(input.flushes, 4);
    stack.transition('fade', 100);
    assert.equal(input.flushes, 4);
    stack.update(50);
    assert.equal(input.flushes, 4);
    stack.update(25);
    assert.equal(input.flushes, 4);
    stack.update(25);
    assert.equal(input.flushes, 5);
    stack.clear();
    assert.equal(input.flushes, 6);
  });

  it('remembers the input object passed to handleInput and flushes it on later scene changes', () => {
    const stack = createSceneStack();
    const input = fakeInput();
    stack.push({ name: 'a' });
    stack.handleInput(input);
    assert.equal(input.flushes, 0);
    stack.pop();
    assert.equal(input.flushes, 1);
  });

  it('tolerates inputs without flush(), and non-object inputs', () => {
    const stack = createSceneStack();
    stack.push({ handleInput() {} });
    assert.doesNotThrow(() => {
      stack.handleInput({});
      stack.handleInput(null);
      stack.handleInput(undefined);
      stack.pop();
    });
  });
});

describe('transitionFrame', () => {
  it('follows out -> (hold) -> in with coverage 0 -> 1 -> 0', () => {
    const cases = [
      [[0, 400], { phase: 'out', coverage: 0, progress: 0, done: false }],
      [[100, 400], { phase: 'out', coverage: 0.5, progress: 0.25, done: false }],
      [[199.99, 400], { phase: 'out', coverage: 0.99995, progress: 0.499975, done: false }],
      [[200, 400], { phase: 'in', coverage: 1, progress: 0.5, done: false }],
      [[300, 400], { phase: 'in', coverage: 0.5, progress: 0.75, done: false }],
      [[400, 400], { phase: 'in', coverage: 0, progress: 1, done: true }],
      [[200, 400, 100], { phase: 'hold', coverage: 1, progress: 0.4, done: false }],
      [[299, 400, 100], { phase: 'hold', coverage: 1, progress: 0.598, done: false }],
      [[300, 400, 100], { phase: 'in', coverage: 1, progress: 0.6, done: false }],
      [[400, 400, 100], { phase: 'in', coverage: 0.5, progress: 0.8, done: false }],
      [[500, 400, 100], { phase: 'in', coverage: 0, progress: 1, done: true }],
      [[0, 0, 100], { phase: 'hold', coverage: 1, progress: 0, done: false }],
      [[50, 0, 100], { phase: 'hold', coverage: 1, progress: 0.5, done: false }],
      [[100, 0, 100], { phase: 'in', coverage: 0, progress: 1, done: true }],
      [[0, 0, 0], { phase: 'in', coverage: 0, progress: 1, done: true }],
    ];
    for (const [args, expected] of cases) {
      const frame = transitionFrame(...args);
      assert.equal(frame.phase, expected.phase, `phase for ${args}`);
      assert.ok(Math.abs(frame.coverage - expected.coverage) < 1e-9, `coverage for ${args}: ${frame.coverage}`);
      assert.ok(Math.abs(frame.progress - expected.progress) < 1e-9, `progress for ${args}: ${frame.progress}`);
      assert.equal(frame.done, expected.done, `done for ${args}`);
    }
  });

  it('clamps elapsed into [0, ms + hold]', () => {
    assert.deepEqual(transitionFrame(-50, 400), transitionFrame(0, 400));
    assert.deepEqual(transitionFrame(9999, 400, 100), transitionFrame(500, 400, 100));
  });

  it('is pure and deterministic', () => {
    assert.deepEqual(transitionFrame(123.4, 400, 50), transitionFrame(123.4, 400, 50));
  });

  it('rejects invalid arguments', () => {
    assert.throws(() => transitionFrame(NaN, 400), { name: 'TypeError', message: /elapsed/ });
    assert.throws(() => transitionFrame('0', 400), { name: 'TypeError', message: /elapsed/ });
    assert.throws(() => transitionFrame(0, -1), { name: 'TypeError', message: /ms/ });
    assert.throws(() => transitionFrame(0, Infinity), { name: 'TypeError', message: /ms/ });
    assert.throws(() => transitionFrame(0, 400, -1), { name: 'TypeError', message: /hold/ });
  });
});

describe('transition', () => {
  it('validates its arguments', () => {
    const stack = createSceneStack();
    assert.throws(() => stack.transition('slide', 100), { name: 'TypeError', message: /kind/ });
    assert.throws(() => stack.transition(undefined, 100), { name: 'TypeError', message: /kind/ });
    assert.throws(() => stack.transition('fade', -1), { name: 'TypeError', message: /ms/ });
    assert.throws(() => stack.transition('fade', NaN), { name: 'TypeError', message: /ms/ });
    assert.throws(() => stack.transition('fade', '100'), { name: 'TypeError', message: /ms/ });
    assert.throws(() => stack.transition('fade', 100, 'cb'), { name: 'TypeError', message: /fn/ });
    assert.throws(() => stack.transition('fade', 100, null, 'opts'), { name: 'TypeError', message: /options/ });
    assert.throws(() => stack.transition('fade', 100, null, { hold: -5 }), { name: 'TypeError', message: /hold/ });
    assert.throws(() => stack.transition('fade', 100, null, { direction: 'diag' }), { name: 'TypeError', message: /direction/ });
    assert.throws(() => stack.transition('fade', 100, null, { color: '' }), { name: 'TypeError', message: /color/ });
    assert.throws(() => stack.transition('fade', 100, null, { color: 0 }), { name: 'TypeError', message: /color/ });
    assert.throws(() => stack.transition('fade', 100, null, { onDone: 1 }), { name: 'TypeError', message: /onDone/ });
    assert.equal(stack.isTransitioning, false);
  });

  it('defaults ms to DEFAULT_TRANSITION_MS and options to black / right / no hold', () => {
    const stack = createSceneStack();
    assert.equal(stack.transition('fade'), true);
    const s = stack.transitionState();
    assert.equal(s.ms, DEFAULT_TRANSITION_MS);
    assert.equal(s.total, DEFAULT_TRANSITION_MS);
    assert.equal(s.hold, 0);
    assert.equal(s.color, DEFAULT_TRANSITION_COLOR);
    assert.equal(s.direction, 'right');
    assert.equal(s.elapsed, 0);
    assert.equal(s.phase, 'out');
    assert.equal(s.coverage, 0);
    assert.equal(s.fired, false);
    assert.ok(Object.isFrozen(s));
  });

  it("'none' runs fn and onDone synchronously with the stack, leaving no transition behind", () => {
    const stack = createSceneStack();
    const calls = [];
    assert.equal(stack.transition('none', 500, (s) => calls.push(['fn', s]), { onDone: (s) => calls.push(['done', s]) }), true);
    assert.deepEqual(calls, [['fn', stack], ['done', stack]]);
    assert.equal(stack.isTransitioning, false);
    assert.equal(stack.transitionState(), null);
  });

  it('a zero total duration is applied immediately like none', () => {
    const stack = createSceneStack();
    let fired = 0;
    assert.equal(stack.transition('iris', 0, () => fired++), true);
    assert.equal(fired, 1);
    assert.equal(stack.isTransitioning, false);
  });

  it('fires fn exactly once, at the midpoint, and finishes after ms', () => {
    const stack = createSceneStack();
    const calls = [];
    stack.transition('fade', 100, (s) => calls.push(s), { onDone: () => calls.push('done') });
    assert.equal(stack.isTransitioning, true);
    stack.update(49);
    assert.deepEqual(calls, []);
    assert.equal(stack.transitionState().phase, 'out');
    assert.ok(Math.abs(stack.transitionState().coverage - 0.98) < 1e-9);
    stack.update(1);
    assert.deepEqual(calls, [stack]);
    assert.equal(stack.transitionState().fired, true);
    assert.equal(stack.transitionState().coverage, 1);
    stack.update(25);
    assert.deepEqual(calls, [stack]);
    assert.equal(stack.transitionState().phase, 'in');
    assert.ok(Math.abs(stack.transitionState().coverage - 0.5) < 1e-9);
    stack.update(25);
    assert.deepEqual(calls, [stack, 'done']);
    assert.equal(stack.isTransitioning, false);
    assert.equal(stack.transitionState(), null);
  });

  it('a single huge dt still fires fn exactly once and completes', () => {
    const stack = createSceneStack();
    let fired = 0;
    let done = 0;
    stack.transition('wipe', 300, () => fired++, { onDone: () => done++ });
    stack.update(100000);
    assert.equal(fired, 1);
    assert.equal(done, 1);
    assert.equal(stack.isTransitioning, false);
    stack.update(16);
    assert.equal(fired, 1);
    assert.equal(done, 1);
  });

  it('honours hold: fully covered between the phases, fn fires when the hold begins', () => {
    const stack = createSceneStack();
    let fired = 0;
    stack.transition('fade', 200, () => fired++, { hold: 300 });
    assert.equal(stack.transitionState().total, 500);
    stack.update(99);
    assert.equal(fired, 0);
    stack.update(1);
    assert.equal(fired, 1);
    assert.equal(stack.transitionState().phase, 'hold');
    stack.update(299);
    assert.equal(stack.transitionState().phase, 'hold');
    assert.equal(stack.transitionState().coverage, 1);
    stack.update(1);
    assert.equal(stack.transitionState().phase, 'in');
    stack.update(100);
    assert.equal(stack.isTransitioning, false);
  });

  it('with ms 0 and a hold, fn fires on the first update and the screen stays covered for the hold', () => {
    const stack = createSceneStack();
    let fired = 0;
    assert.equal(stack.transition('fade', 0, () => fired++, { hold: 50 }), true);
    assert.equal(fired, 0);
    stack.update(0);
    assert.equal(fired, 1);
    assert.equal(stack.transitionState().coverage, 1);
    stack.update(50);
    assert.equal(stack.isTransitioning, false);
  });

  it('ignores a second timed transition while one is running, then accepts one afterwards', () => {
    const stack = createSceneStack();
    let first = 0;
    let second = 0;
    assert.equal(stack.transition('fade', 100, () => first++), true);
    assert.equal(stack.transition('iris', 100, () => second++), false);
    stack.update(100);
    assert.equal(first, 1);
    assert.equal(second, 0);
    assert.equal(stack.transition('iris', 100, () => second++), true);
    stack.update(100);
    assert.equal(second, 1);
  });

  it("'none' and zero-length transitions still run while another is in progress", () => {
    const stack = createSceneStack();
    let ran = 0;
    stack.transition('fade', 100);
    assert.equal(stack.transition('none', 0, () => ran++), true);
    assert.equal(stack.transition('wipe', 0, () => ran++), true);
    assert.equal(ran, 2);
    assert.equal(stack.transitionState().kind, 'fade');
  });

  it('lets fn change scenes; the new top updates in the same frame', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace);
    stack.push(a);
    stack.transition('fade', 100, (s) => s.replace(b, { via: 'fade' }));
    trace.length = 0;
    stack.update(50);
    assert.deepEqual(trace, [['a', 'exit'], ['b', 'enter', { via: 'fade' }], ['b', 'update', 50]]);
    assert.equal(stack.top(), b);
    assert.equal(stack.isTransitioning, true);
  });

  it('propagates an error thrown by fn but never calls fn again and still completes', () => {
    const stack = createSceneStack();
    let attempts = 0;
    let done = 0;
    stack.transition('fade', 100, () => {
      attempts++;
      throw new Error('midpoint failed');
    }, { onDone: () => done++ });
    assert.throws(() => stack.update(60), /midpoint failed/);
    assert.equal(attempts, 1);
    assert.equal(stack.isTransitioning, true);
    stack.update(60);
    assert.equal(attempts, 1);
    assert.equal(done, 1);
    assert.equal(stack.isTransitioning, false);
  });

  it('survives fn calling clear(): the transition is cancelled and onDone is not called', () => {
    const stack = createSceneStack();
    let done = 0;
    stack.push({ name: 'a' });
    stack.transition('fade', 100, (s) => s.clear(), { onDone: () => done++ });
    assert.doesNotThrow(() => stack.update(50));
    assert.equal(stack.isTransitioning, false);
    assert.equal(stack.size, 0);
    stack.update(50);
    assert.equal(done, 0);
  });

  it('allows direct push/pop while a transition runs', () => {
    const stack = createSceneStack();
    stack.transition('fade', 100);
    stack.push({ name: 'a' });
    stack.push({ name: 'b' });
    stack.pop();
    assert.equal(stack.top().name, 'a');
    assert.equal(stack.isTransitioning, true);
  });
});

describe('transition overlay drawing', () => {
  it('draws the overlay after every scene, with identity transform and opaque composite', () => {
    const stack = createSceneStack();
    stack.push({ draw: (ctx) => ctx.fillRect(1, 2, 3, 4) });
    stack.transition('fade', 100);
    stack.update(25);
    const ctx = fakeCtx();
    stack.draw(ctx);
    const f = fills(ctx);
    assert.equal(f.length, 2);
    assert.deepEqual(f[0].slice(1, 5), [1, 2, 3, 4]);
    assert.deepEqual(f[1].slice(1, 5), [0, 0, W, H]);
    assert.equal(f[1][5], DEFAULT_TRANSITION_COLOR);
    assert.ok(Math.abs(f[1][6] - 0.5) < 1e-9, 'fade alpha equals coverage');
    const transformIdx = ctx.calls.findIndex((c) => c[0] === 'setTransform');
    assert.deepEqual(ctx.calls[transformIdx], ['setTransform', 1, 0, 0, 1, 0, 0]);
    assert.ok(transformIdx < ctx.calls.length - 1 && ctx.calls.indexOf(f[1]) > transformIdx);
    assert.equal(ctx.depth, 0, 'overlay restores the context');
    assert.equal(ctx.globalAlpha, 1);
  });

  it('draws nothing at coverage 0 and uses the custom colour when given', () => {
    const stack = createSceneStack();
    stack.transition('fade', 100, null, { color: '#102030' });
    const ctx0 = fakeCtx();
    stack.draw(ctx0);
    assert.equal(fills(ctx0).length, 0);
    stack.update(50);
    const ctx1 = fakeCtx();
    stack.draw(ctx1);
    assert.deepEqual(fills(ctx1), [['fillRect', 0, 0, W, H, '#102030', 1]]);
  });

  it('sizes the overlay from stack options, else ctx.canvas, else the native defaults', () => {
    const fromOptions = createSceneStack({ width: 100, height: 50 });
    fromOptions.transition('fade', 10);
    fromOptions.update(5);
    const c1 = fakeCtx(640, 360);
    fromOptions.draw(c1);
    assert.deepEqual(fills(c1)[0].slice(1, 5), [0, 0, 100, 50]);

    const fromCanvas = createSceneStack();
    fromCanvas.transition('fade', 10);
    fromCanvas.update(5);
    const c2 = fakeCtx(640, 360);
    fromCanvas.draw(c2);
    assert.deepEqual(fills(c2)[0].slice(1, 5), [0, 0, 640, 360]);

    const c3 = fakeCtx(640, 360);
    delete c3.canvas;
    fromCanvas.draw(c3);
    assert.deepEqual(fills(c3)[0].slice(1, 5), [0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT]);
  });

  it('wipe: the band grows from the start edge, holds, then shrinks away from it (all four directions)', () => {
    const expectations = {
      right: { out: [0, 0, 120, H], in: [360, 0, 120, H] },
      left: { out: [360, 0, 120, H], in: [0, 0, 120, H] },
      down: { out: [0, 0, W, 68], in: [0, 202, W, 68] },
      up: { out: [0, 202, W, 68], in: [0, 0, W, 68] },
    };
    for (const direction of WIPE_DIRECTIONS) {
      const out = fakeCtx();
      drawTransition(out, 'wipe', transitionFrame(100, 800), { direction });
      assert.deepEqual(fills(out)[0].slice(1, 5), expectations[direction].out, `${direction} out`);
      assert.equal(fills(out)[0][6], 1, 'wipe is fully opaque');

      const hold = fakeCtx();
      drawTransition(hold, 'wipe', transitionFrame(400, 800, 100), { direction });
      assert.deepEqual(fills(hold)[0].slice(1, 5), [0, 0, W, H], `${direction} hold`);

      const inn = fakeCtx();
      drawTransition(inn, 'wipe', transitionFrame(700, 800), { direction });
      assert.deepEqual(fills(inn)[0].slice(1, 5), expectations[direction].in, `${direction} in`);
    }
  });

  it('wipe: snaps the edge to whole pixels and draws nothing for a sub-pixel band', () => {
    const ctx = fakeCtx();
    drawTransition(ctx, 'wipe', { phase: 'out', coverage: 1 / 3 }, {});
    assert.deepEqual(fills(ctx)[0].slice(1, 5), [0, 0, 160, H]);
    const tiny = fakeCtx();
    assert.equal(drawTransition(tiny, 'wipe', { phase: 'out', coverage: 0.0001 }, {}), false);
    assert.equal(fills(tiny).length, 0);
  });

  it('iris: full coverage is one full-screen rectangle, zero coverage draws nothing', () => {
    const full = fakeCtx();
    assert.equal(drawTransition(full, 'iris', { phase: 'hold', coverage: 1 }), true);
    assert.deepEqual(fills(full), [['fillRect', 0, 0, W, H, DEFAULT_TRANSITION_COLOR, 1]]);
    const none = fakeCtx();
    assert.equal(drawTransition(none, 'iris', { phase: 'out', coverage: 0 }), false);
    assert.equal(fills(none).length, 0);
  });

  it('iris: at half coverage the rectangles tile exactly the outside of the circle, without overlap', () => {
    const ctx = fakeCtx();
    drawTransition(ctx, 'iris', { phase: 'out', coverage: 0.5 });
    const cx = W / 2;
    const cy = H / 2;
    const radius = Math.hypot(cx, cy) * 0.5;
    const hits = new Uint8Array(W * H);
    for (const r of ctx.rects) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H, `rect in bounds: ${JSON.stringify(r)}`);
      assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.w) && Number.isInteger(r.h));
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) hits[y * W + x] += 1;
      }
    }
    let covered = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = hits[y * W + x];
        assert.ok(n <= 1, `pixel ${x},${y} painted ${n} times`);
        covered += n;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < radius - 1) assert.equal(n, 0, `inside pixel ${x},${y} must be clear`);
        if (d > radius + 1) assert.equal(n, 1, `outside pixel ${x},${y} must be covered`);
      }
    }
    const expected = W * H - Math.PI * radius * radius;
    assert.ok(Math.abs(covered - expected) / expected < 0.02, `area ${covered} vs ${expected}`);
    assert.equal(coveredArea(ctx), covered);
  });

  it('iris: a near-zero coverage only touches the far corners', () => {
    const ctx = fakeCtx();
    drawTransition(ctx, 'iris', { phase: 'out', coverage: 0.01 });
    assert.ok(ctx.rects.length > 0);
    assert.ok(coveredArea(ctx) < W * H * 0.01);
    assert.ok(ctx.rects.every((r) => r.y < 10 || r.y >= H - 10), 'only rows near the top and bottom edges');
  });

  it('drawTransition validates inputs, returns false for none, and needs only fillRect', () => {
    assert.throws(() => drawTransition(null, 'fade', { coverage: 1 }), { name: 'TypeError', message: /ctx/ });
    assert.throws(() => drawTransition(fakeCtx(), 'blur', { coverage: 1 }), { name: 'TypeError', message: /kind/ });
    assert.throws(() => drawTransition(fakeCtx(), 'fade', null), { name: 'TypeError', message: /frame/ });
    assert.throws(() => drawTransition(fakeCtx(), 'fade', { coverage: '1' }), { name: 'TypeError', message: /frame/ });
    assert.throws(() => drawTransition(fakeCtx(), 'fade', { coverage: 1 }, { width: 0 }), { name: 'TypeError', message: /width/ });
    assert.throws(() => drawTransition(fakeCtx(), 'wipe', { coverage: 1 }, { direction: 'x' }), { name: 'TypeError', message: /direction/ });
    assert.equal(drawTransition(fakeCtx(), 'none', { phase: 'hold', coverage: 1 }), false);
    const log = [];
    assert.equal(drawTransition({ fillRect: (...a) => log.push(a) }, 'fade', { phase: 'hold', coverage: 1 }), true);
    assert.deepEqual(log, [[0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT]]);
  });

  it('clamps out-of-range coverage values', () => {
    const over = fakeCtx();
    drawTransition(over, 'fade', { phase: 'hold', coverage: 7 });
    assert.equal(fills(over)[0][6], 1);
    const under = fakeCtx();
    assert.equal(drawTransition(under, 'fade', { phase: 'out', coverage: -2 }), false);
  });
});

describe('clear', () => {
  it('exits every scene top to bottom, cancels transitions and returns the removed scenes', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace);
    const c = makeScene('c', trace);
    stack.push(a);
    stack.push(b);
    stack.push(c);
    stack.transition('iris', 100);
    trace.length = 0;
    const removed = stack.clear();
    assert.deepEqual(removed, [c, b, a]);
    assert.deepEqual(trace, [['c', 'exit'], ['b', 'exit'], ['a', 'exit']]);
    assert.equal(stack.size, 0);
    assert.equal(stack.top(), null);
    assert.equal(stack.isTransitioning, false);
    assert.deepEqual(stack.clear(), []);
  });
});

describe('introspection helpers', () => {
  it('find returns the topmost scene with a name, has reports membership', () => {
    const stack = createSceneStack();
    const a1 = { name: 'a' };
    const a2 = { name: 'a' };
    const b = { name: 'b' };
    stack.push(a1);
    stack.push(b);
    stack.push(a2);
    assert.equal(stack.find('a'), a2);
    assert.equal(stack.find('b'), b);
    assert.equal(stack.find('zzz'), null);
    assert.equal(stack.has(a1), true);
    assert.equal(stack.has({ name: 'a' }), false);
  });

  it('stack is a defensive copy', () => {
    const stack = createSceneStack();
    stack.push({ name: 'a' });
    const copy = stack.stack;
    copy.push({ name: 'rogue' });
    copy.length = 0;
    assert.equal(stack.size, 1);
    assert.notEqual(stack.stack, copy);
  });
});

describe('onChange', () => {
  it('reports push, pop, replace and clear after their hooks ran', () => {
    const events = [];
    const hooks = [];
    const stack = createSceneStack({ onChange: (e) => events.push({ ...e }) });
    const a = { name: 'a', enter: () => hooks.push('a.enter') };
    const b = { name: 'b', enter: () => hooks.push('b.enter'), exit: () => hooks.push('b.exit') };
    const c = { name: 'c' };
    stack.push(a);
    assert.deepEqual(events.at(-1), { type: 'push', scene: a, top: a });
    assert.deepEqual(hooks, ['a.enter']);
    stack.push(b);
    assert.deepEqual(events.at(-1), { type: 'push', scene: b, top: b });
    stack.replace(c);
    assert.deepEqual(events.at(-1), { type: 'replace', scene: c, top: c, replaced: b });
    stack.pop('r');
    assert.deepEqual(events.at(-1), { type: 'pop', scene: c, top: a });
    stack.clear();
    assert.deepEqual(events.at(-1), { type: 'clear', scene: null, top: null, removed: [a] });
    assert.equal(events.length, 5);
  });

  it('reports a replace on an empty stack as a push', () => {
    const events = [];
    const stack = createSceneStack({ onChange: (e) => events.push(e.type) });
    stack.replace({ name: 'a' });
    assert.deepEqual(events, ['push']);
  });
});

describe('determinism', () => {
  /** Runs one scripted session and returns everything observable about it. */
  function session() {
    const trace = [];
    const ctx = fakeCtx();
    const stack = createSceneStack({ onChange: (e) => trace.push(['change', e.type, e.scene?.name ?? null]) });
    const title = makeScene('title', trace, { draw: (c) => c.fillRect(0, 0, 10, 10) });
    const world = makeScene('world', trace, { draw: (c) => c.fillRect(5, 5, 20, 20) });
    const menu = makeScene('menu', trace, { opaque: false, updateBelow: true, draw: (c) => c.fillRect(100, 100, 50, 30) });
    stack.push(title);
    stack.transition('iris', 240, (s) => s.replace(world), { hold: 40 });
    const steps = [16, 16, 33, 16, 50, 16, 16, 100, 16, 16];
    for (const dt of steps) {
      stack.update(dt);
      stack.handleInput({});
      stack.draw(ctx);
    }
    stack.push(menu);
    stack.transition('wipe', 120, null, { direction: 'up' });
    for (const dt of steps) {
      stack.update(dt);
      stack.draw(ctx);
    }
    stack.pop('closed');
    stack.transition('fade', 90, (s) => s.pop());
    for (const dt of steps) {
      stack.update(dt);
      stack.draw(ctx);
    }
    const scrubbed = trace.map((t) => t.map((v) => (v === ctx ? '<ctx>' : v)));
    return { trace: scrubbed, calls: ctx.calls, size: stack.size, busy: stack.isTransitioning };
  }

  it('two identical sessions produce identical hook traces and identical draw call logs', () => {
    const a = session();
    const b = session();
    assert.deepEqual(a.trace, b.trace);
    assert.deepEqual(a.calls, b.calls);
    assert.equal(a.size, b.size);
    assert.equal(a.busy, b.busy);
    assert.ok(a.calls.filter((c) => c[0] === 'fillRect').length > 100, 'the session actually drew overlays');
    assert.ok(a.trace.some((t) => t[0] === 'change' && t[1] === 'replace'), 'the iris midpoint replaced the scene');
  });
});

// Adversarial / edge-case tests for js/core/scene.js: calls before any scene exists, malformed
// scenes, re-entrant lifecycle hooks, transition timing edges, dt edge cases, rapid repeated calls,
// large stacks, drawing bounds and determinism. The happy paths live in scene.test.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSceneStack,
  drawTransition,
  transitionFrame,
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  TRANSITION_KINDS,
} from '../js/core/scene.js';

const W = 480;
const H = 270;

/** A scene whose hooks append `[name, hook, ...args]` to `trace`; `extra` overrides hooks. */
function makeScene(name, trace, extra = {}) {
  const scene = { name };
  for (const hook of ['enter', 'exit', 'pause', 'resume', 'update', 'draw', 'handleInput']) {
    scene[hook] = (...args) => {
      trace.push(args.length ? [name, hook, ...args] : [name, hook]);
    };
  }
  return Object.assign(scene, extra);
}

/** Recording 2D-context double with a real save/restore stack for fillStyle / alpha. */
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
    },
    restore() {
      const s = saved.pop();
      if (s) {
        ctx.fillStyle = s.fillStyle;
        ctx.globalAlpha = s.globalAlpha;
        ctx.globalCompositeOperation = s.op;
      }
    },
    setTransform() {},
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fillStyle: ctx.fillStyle, alpha: ctx.globalAlpha });
      calls.push(['fillRect', x, y, w, h, ctx.fillStyle, ctx.globalAlpha]);
    },
  };
  return ctx;
}

function fakeInput() {
  return {
    flushes: 0,
    flush() {
      this.flushes += 1;
    },
  };
}

const fills = (ctx) => ctx.calls.filter((c) => c[0] === 'fillRect');
const hooksOf = (trace, name) => trace.filter((t) => t[0] === name).map((t) => t[1]);

describe('calls before anything is pushed', () => {
  it('every query and mutator is safe on a fresh stack', () => {
    const stack = createSceneStack();
    const ctx = fakeCtx();
    assert.equal(stack.top(), null);
    assert.equal(stack.pop(), null);
    assert.equal(stack.pop('x'), null);
    assert.deepEqual(stack.clear(), []);
    assert.equal(stack.find('a'), null);
    assert.equal(stack.has({}), false);
    assert.equal(stack.handleInput({}), false);
    assert.doesNotThrow(() => {
      stack.update(0);
      stack.update(16);
      stack.update(-1);
      stack.draw(ctx);
    });
    assert.equal(fills(ctx).length, 0);
    assert.equal(stack.transitionState(), null);
    assert.deepEqual(stack.stack, []);
    assert.equal(stack.size, 0);
    assert.equal(stack.isTransitioning, false);
  });

  it('a transition on an empty stack runs, draws over nothing, and its fn can populate the stack', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace, {
      draw(c) {
        trace.push(['a', 'draw']);
        c.fillRect(1, 1, 2, 2);
      },
    });
    assert.equal(stack.transition('fade', 100, (s) => s.push(a)), true);
    const ctx0 = fakeCtx();
    stack.draw(ctx0);
    assert.equal(fills(ctx0).length, 0, 'coverage 0 and no scenes: nothing drawn');
    stack.update(50);
    assert.deepEqual(trace, [['a', 'enter', {}], ['a', 'update', 50]]);
    const ctx1 = fakeCtx();
    stack.draw(ctx1);
    const f = fills(ctx1);
    assert.deepEqual(f.map((c) => c.slice(1, 5)), [[1, 1, 2, 2], [0, 0, W, H]]);
    assert.equal(f[1][6], 1, 'fully covered at the midpoint');
    assert.equal(stack.handleInput({}), false);
    stack.update(50);
    assert.equal(stack.handleInput({}), true);
  });
});

describe('malformed scenes and hooks', () => {
  it('skips hooks that are not functions instead of throwing', () => {
    const stack = createSceneStack();
    const odd = { name: 'odd', enter: 'go', exit: true, pause: 1, resume: [], update: null, draw: 5, handleInput: {} };
    assert.doesNotThrow(() => {
      stack.push(odd);
      stack.update(16);
      stack.draw(fakeCtx());
      assert.equal(stack.handleInput({}), false);
      stack.push({});
      stack.pop();
      stack.replace({});
      stack.clear();
    });
    assert.equal(stack.size, 0);
  });

  it('accepts frozen scenes, Proxy scenes and prototype hooks', () => {
    const trace = [];
    const stack = createSceneStack();
    const frozen = Object.freeze({ name: 'frozen', enter: () => trace.push('frozen.enter') });
    class Proto {
      enter() {
        trace.push('proto.enter');
      }
      exit() {
        trace.push('proto.exit');
      }
    }
    const target = { name: 'target', enter: () => trace.push('proxy.enter') };
    const proxy = new Proxy(target, {});
    stack.push(frozen);
    stack.push(new Proto());
    stack.push(proxy);
    assert.deepEqual(trace, ['frozen.enter', 'proto.enter', 'proxy.enter']);
    assert.equal(stack.has(proxy), true);
    assert.equal(stack.has(target), false, 'identity is the proxy, not its target');
    assert.equal(stack.find('target'), proxy);
    stack.pop();
    stack.pop();
    assert.deepEqual(trace.at(-1), 'proto.exit');
  });

  it('reads opaque through a getter every frame', () => {
    const trace = [];
    const stack = createSceneStack();
    let seeThrough = true;
    stack.push(makeScene('below', trace));
    const top = makeScene('top', trace);
    Object.defineProperty(top, 'opaque', { get: () => !seeThrough, enumerable: true });
    stack.push(top);
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.map((t) => t[0]), ['below', 'top']);
    seeThrough = false;
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.map((t) => t[0]), ['top']);
  });

  it('find matches only string names and never a nameless scene', () => {
    const stack = createSceneStack();
    const numeric = { name: 1 };
    const nameless = {};
    const x = { name: 'x' };
    stack.push(numeric);
    stack.push(nameless);
    stack.push(x);
    assert.equal(stack.find('x'), x);
    for (const bad of [undefined, null, 1, '1', '', Symbol('x'), {}]) {
      assert.equal(stack.find(bad), null, String(bad));
    }
  });

  it('a scene may live on two stacks at once with independent lifecycles', () => {
    const trace = [];
    const a = makeScene('a', trace);
    const s1 = createSceneStack();
    const s2 = createSceneStack();
    s1.push(a, 1);
    s2.push(a, 2);
    assert.deepEqual(trace, [['a', 'enter', 1], ['a', 'enter', 2]]);
    s1.pop();
    assert.deepEqual(trace.at(-1), ['a', 'exit']);
    assert.equal(s2.has(a), true);
    assert.equal(s1.has(a), false);
    s2.pop();
    assert.equal(hooksOf(trace, 'a').filter((h) => h === 'exit').length, 2);
  });
});

describe('lifecycle pairing under re-entrant hooks', () => {
  it('a throwing enter still gets its exit when popped', () => {
    const trace = [];
    const stack = createSceneStack();
    const boom = makeScene('boom', trace, {
      enter() {
        trace.push(['boom', 'enter']);
        throw new Error('enter failed');
      },
    });
    assert.throws(() => stack.push(boom), /enter failed/);
    trace.length = 0;
    stack.pop();
    assert.deepEqual(trace, [['boom', 'exit']]);
  });

  it('pause() that pops the stack cancels the push: the newcomer is never entered nor exited', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace, {
      pause() {
        trace.push(['a', 'pause']);
        stack.pop('bail');
      },
    });
    const b = makeScene('b', trace);
    stack.push(a);
    trace.length = 0;
    assert.equal(stack.push(b), b);
    assert.deepEqual(trace, [['a', 'pause'], ['a', 'resume', 'bail']]);
    assert.deepEqual(stack.stack, [a]);
    assert.deepEqual(hooksOf(trace, 'b'), []);
    trace.length = 0;
    stack.pop();
    assert.deepEqual(trace, [['a', 'exit']]);
  });

  it('exit() that pushes a successor during pop: the successor enters once and nothing is resumed', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const c = makeScene('c', trace);
    const b = makeScene('b', trace, {
      exit() {
        trace.push(['b', 'exit']);
        stack.push(c);
      },
    });
    stack.push(a);
    stack.push(b);
    trace.length = 0;
    assert.equal(stack.pop('r'), b);
    assert.deepEqual(trace, [['b', 'exit'], ['c', 'enter', {}]]);
    assert.deepEqual(stack.stack, [a, c]);
    trace.length = 0;
    stack.pop('r2');
    assert.deepEqual(trace, [['c', 'exit'], ['a', 'resume', 'r2']]);
  });

  it('exit() that pops during replace cancels the replacement and resumes the exposed scene', () => {
    const trace = [];
    const stack = createSceneStack();
    const base = makeScene('base', trace);
    const nu = makeScene('nu', trace);
    const old = makeScene('old', trace, {
      exit() {
        trace.push(['old', 'exit']);
        stack.pop();
      },
    });
    stack.push(base);
    stack.push(old);
    trace.length = 0;
    assert.equal(stack.replace(nu), old);
    assert.deepEqual(trace, [['old', 'exit'], ['base', 'resume', undefined]]);
    assert.deepEqual(stack.stack, [base]);
    assert.deepEqual(hooksOf(trace, 'nu'), []);
  });

  it('enter() that pops itself leaves a paired enter/exit and resumes the scene beneath', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace, {
      enter(params) {
        trace.push(['b', 'enter', params]);
        stack.pop('oops');
      },
    });
    stack.push(a);
    trace.length = 0;
    stack.push(b);
    assert.deepEqual(trace, [['a', 'pause'], ['b', 'enter', {}], ['b', 'exit'], ['a', 'resume', 'oops']]);
    assert.deepEqual(stack.stack, [a]);
  });

  it('enter() that pushes a modal pauses the entering scene exactly once, and pop resumes it', () => {
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
    trace.length = 0;
    stack.pop('closed');
    assert.deepEqual(trace, [['modal', 'exit'], ['world', 'resume', 'closed']]);
  });

  it('pause() that pushes another scene: the newcomer enters, then is paused because it is no longer top', () => {
    const trace = [];
    const stack = createSceneStack();
    const other = makeScene('other', trace);
    let pushed = false;
    const prev = makeScene('prev', trace, {
      pause() {
        trace.push(['prev', 'pause']);
        if (!pushed) {
          pushed = true;
          stack.push(other);
        }
      },
    });
    const scene = makeScene('scene', trace);
    stack.push(prev);
    trace.length = 0;
    stack.push(scene);
    assert.deepEqual(trace, [['prev', 'pause'], ['other', 'enter', {}], ['scene', 'enter', {}], ['scene', 'pause']]);
    assert.deepEqual(stack.stack, [prev, scene, other]);
    trace.length = 0;
    stack.pop('x');
    assert.deepEqual(trace, [['other', 'exit'], ['scene', 'resume', 'x']]);
  });

  it('resume() that pops itself hands the second result to the scene beneath', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const c = makeScene('c', trace);
    const b = makeScene('b', trace, {
      resume(result) {
        trace.push(['b', 'resume', result]);
        stack.pop('r2');
      },
    });
    stack.push(a);
    stack.push(b);
    stack.push(c);
    trace.length = 0;
    stack.pop('r1');
    assert.deepEqual(trace, [['c', 'exit'], ['b', 'resume', 'r1'], ['b', 'exit'], ['a', 'resume', 'r2']]);
    assert.deepEqual(stack.stack, [a]);
  });

  it('exit() that re-pushes the exiting scene re-enters it fresh without resuming anything', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    let readded = false;
    const b = makeScene('b', trace, {
      exit() {
        trace.push(['b', 'exit']);
        if (!readded) {
          readded = true;
          stack.push(b);
        }
      },
    });
    stack.push(a);
    stack.push(b);
    trace.length = 0;
    stack.pop('r');
    assert.deepEqual(trace, [['b', 'exit'], ['b', 'enter', {}]]);
    assert.deepEqual(stack.stack, [a, b]);
    trace.length = 0;
    stack.pop();
    assert.deepEqual(trace, [['b', 'exit'], ['a', 'resume', undefined]]);
  });

  it('exit() that clears the stack during pop leaves an empty, usable stack', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace, {
      exit() {
        trace.push(['b', 'exit']);
        stack.clear();
      },
    });
    stack.push(a);
    stack.push(b);
    trace.length = 0;
    assert.equal(stack.pop(), b);
    assert.deepEqual(trace, [['b', 'exit'], ['a', 'exit']]);
    assert.equal(stack.size, 0);
    stack.push(makeScene('c', trace));
    assert.deepEqual(trace.at(-1), ['c', 'enter', {}]);
  });

  it('a throwing pause() leaves the pushed scene un-entered; popping it does not exit it', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace, {
      pause() {
        trace.push(['a', 'pause']);
        throw new Error('pause failed');
      },
    });
    const b = makeScene('b', trace);
    stack.push(a);
    trace.length = 0;
    assert.throws(() => stack.push(b), /pause failed/);
    assert.deepEqual(stack.stack, [a, b], 'the structural change stays applied');
    assert.deepEqual(trace, [['a', 'pause']]);
    trace.length = 0;
    stack.pop('r');
    assert.deepEqual(trace, [['a', 'resume', 'r']]);
    assert.deepEqual(hooksOf(trace, 'b'), []);
  });
});

describe('fuzz: random re-entrant operations keep the lifecycle state machine legal', () => {
  /** Tiny deterministic LCG so the fuzz never depends on rng.js. */
  function lcg(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * Drives one stack with random operations, some of them issued from inside hooks, and checks the
   * per-scene state machine (out -> enter -> active -> pause -> paused -> resume -> active -> exit)
   * plus the boundary invariant "top is active, everything beneath is paused, everything else is out".
   */
  function fuzz(seed, rounds = 300) {
    const rnd = lcg(seed);
    const stack = createSceneStack();
    const ctx = fakeCtx();
    const states = new Map();
    const violations = [];
    const log = [];
    let depth = 0;
    let nextId = 0;
    let round = 0;

    function mark(scene, hook, allowed, next) {
      const state = states.get(scene);
      if (!allowed.includes(state)) violations.push(`${scene.name}.${hook} while ${state} (round ${round})`);
      states.set(scene, next);
      log.push(`${scene.name}.${hook}`);
    }
    function chaos() {
      if (depth >= 3 || rnd() < 0.55) return;
      depth += 1;
      try {
        op();
      } finally {
        depth -= 1;
      }
    }
    function spawn() {
      const scene = {
        name: `s${nextId++}`,
        opaque: rnd() < 0.5,
        updateBelow: rnd() < 0.5,
        enter() {
          mark(this, 'enter', ['out'], 'active');
          chaos();
        },
        exit() {
          mark(this, 'exit', ['active', 'paused'], 'out');
          chaos();
        },
        pause() {
          mark(this, 'pause', ['active'], 'paused');
          chaos();
        },
        resume() {
          mark(this, 'resume', ['paused'], 'active');
          chaos();
        },
        update() {
          chaos();
        },
        draw() {
          chaos();
        },
        handleInput() {
          chaos();
        },
      };
      states.set(scene, 'out');
      return scene;
    }
    function op() {
      const r = rnd();
      if (r < 0.28) stack.push(spawn());
      else if (r < 0.48) stack.pop(r);
      else if (r < 0.62) stack.replace(spawn());
      else if (r < 0.67) stack.clear();
      else if (r < 0.77) {
        const kind = TRANSITION_KINDS[Math.floor(rnd() * TRANSITION_KINDS.length)];
        stack.transition(kind, Math.floor(rnd() * 60), () => chaos(), { hold: rnd() < 0.3 ? 10 : 0 });
      } else if (r < 0.9) stack.update(Math.floor(rnd() * 40));
      else if (r < 0.95) stack.draw(ctx);
      else stack.handleInput({});
    }

    for (round = 0; round < rounds; round++) {
      op();
      const scenes = stack.stack;
      if (new Set(scenes).size !== scenes.length) violations.push(`duplicate scene on the stack (round ${round})`);
      scenes.forEach((scene, i) => {
        const expected = i === scenes.length - 1 ? 'active' : 'paused';
        if (states.get(scene) !== expected) {
          violations.push(`${scene.name} is ${states.get(scene)} at index ${i} of ${scenes.length} (round ${round})`);
        }
      });
      for (const [scene, state] of states) {
        if (!scenes.includes(scene) && state !== 'out') violations.push(`${scene.name} is off the stack but ${state} (round ${round})`);
      }
    }
    stack.clear();
    for (const [scene, state] of states) if (state !== 'out') violations.push(`${scene.name} still ${state} after clear`);
    return { violations, log, scenesMade: nextId };
  }

  it('never calls a hook in an illegal state across several seeds', () => {
    for (const seed of [1, 2, 3, 7, 42, 1234, 99991]) {
      const { violations, log, scenesMade } = fuzz(seed);
      assert.deepEqual(violations, [], `seed ${seed}`);
      assert.ok(scenesMade > 50, `seed ${seed} made ${scenesMade} scenes`);
      assert.ok(log.length > 200, `seed ${seed} logged ${log.length} hooks`);
    }
  });

  it('is deterministic: the same seed yields the same hook log', () => {
    assert.deepEqual(fuzz(7).log, fuzz(7).log);
    assert.notDeepEqual(fuzz(7).log, fuzz(8).log);
  });
});

describe('resume(result) delivery', () => {
  it('delivers each result to exactly the scene directly beneath, preserving identity and falsy values', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace));
    stack.push(makeScene('c', trace));
    trace.length = 0;
    const obj = { ok: 1 };
    stack.pop(obj);
    assert.equal(trace.length, 2);
    assert.equal(trace[1][0], 'b');
    assert.equal(trace[1][2], obj, 'same object, not a copy');
    assert.deepEqual(hooksOf(trace, 'a'), [], 'the scene two below hears nothing');
    for (const falsy of [0, false, '', null, NaN]) {
      stack.push(makeScene('tmp', trace));
      trace.length = 0;
      stack.pop(falsy);
      assert.equal(trace[1][0], 'b');
      assert.ok(Object.is(trace[1][2], falsy), `falsy result ${String(falsy)} passes through`);
    }
  });

  it('delivers the result when the pop happens inside a transition midpoint', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.push(makeScene('b', trace));
    stack.transition('fade', 100, (s) => s.pop('from-fade'));
    trace.length = 0;
    stack.update(50);
    assert.deepEqual(trace, [['b', 'exit'], ['a', 'resume', 'from-fade'], ['a', 'update', 50]]);
  });

  it('replace never resumes the scene beneath; a later pop does', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    stack.push(a);
    stack.push(makeScene('b', trace));
    trace.length = 0;
    stack.replace(makeScene('c', trace));
    stack.replace(makeScene('d', trace));
    assert.deepEqual(hooksOf(trace, 'a'), []);
    stack.pop('z');
    assert.deepEqual(trace.at(-1), ['a', 'resume', 'z']);
  });
});

describe('ordering with transitions', () => {
  it('push, replace and pop issued from fn run in order and the transition keeps running', () => {
    const trace = [];
    const stack = createSceneStack();
    const a = makeScene('a', trace);
    const b = makeScene('b', trace);
    const c = makeScene('c', trace);
    stack.push(a);
    stack.transition('iris', 200, (s) => {
      s.push(b);
      s.replace(c);
      s.pop('done');
    });
    trace.length = 0;
    stack.update(100);
    assert.deepEqual(trace, [
      ['a', 'pause'],
      ['b', 'enter', {}],
      ['b', 'exit'],
      ['c', 'enter', {}],
      ['c', 'exit'],
      ['a', 'resume', 'done'],
      ['a', 'update', 100],
    ]);
    assert.equal(stack.isTransitioning, true);
    assert.equal(stack.transitionState().phase, 'in');
    assert.equal(stack.transitionState().coverage, 1);
  });

  it('a transition requested from fn is refused; one requested from onDone starts fresh at elapsed 0', () => {
    const stack = createSceneStack();
    const seen = [];
    stack.transition('fade', 100, (s) => seen.push(['fn', s.transition('wipe', 50)]), {
      onDone: (s) => seen.push(['done', s.transition('iris', 80)]),
    });
    stack.update(1000);
    assert.deepEqual(seen, [['fn', false], ['done', true]]);
    const state = stack.transitionState();
    assert.equal(state.kind, 'iris');
    assert.equal(state.elapsed, 0, 'overshoot is not carried into the next transition');
  });

  it('an onDone that throws leaves the stack idle, flushed and usable', () => {
    const input = fakeInput();
    const stack = createSceneStack({ input });
    stack.transition('fade', 100, null, {
      onDone() {
        throw new Error('done failed');
      },
    });
    assert.throws(() => stack.update(100), /done failed/);
    assert.equal(stack.isTransitioning, false);
    assert.equal(input.flushes, 1);
    assert.equal(stack.transition('fade', 10), true);
  });

  it('input is ignored in out, hold and in phases (including the frame fn fires) and accepted on the frame it ends', () => {
    const trace = [];
    const input = fakeInput();
    const stack = createSceneStack({ input });
    stack.push(makeScene('a', trace));
    input.flushes = 0;
    let fired = 0;
    stack.transition('wipe', 100, () => fired++, { hold: 100 });
    const probe = () => stack.handleInput(input);
    assert.equal(probe(), false);
    stack.update(50);
    assert.equal(fired, 1);
    assert.equal(probe(), false, 'the frame fn fires');
    stack.update(50);
    assert.equal(stack.transitionState().phase, 'hold');
    assert.equal(probe(), false);
    stack.update(50);
    assert.equal(stack.transitionState().phase, 'in');
    assert.equal(probe(), false);
    stack.update(49.5);
    assert.equal(probe(), false);
    assert.equal(input.flushes, 0, 'no flush while running, however often input is offered');
    stack.update(0.5);
    assert.equal(stack.isTransitioning, false);
    assert.equal(input.flushes, 1);
    assert.equal(probe(), true);
    assert.equal(hooksOf(trace, 'a').filter((h) => h === 'handleInput').length, 1);
  });

  it("'none' and zero-length transitions never block input", () => {
    const stack = createSceneStack();
    stack.push({ handleInput() {} });
    stack.transition('none', 500);
    assert.equal(stack.handleInput({}), true);
    stack.transition('fade', 0);
    assert.equal(stack.handleInput({}), true);
  });

  it('keeps updating the top scene and its updateBelow chain during every phase', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('world', trace));
    stack.push(makeScene('modal', trace, { opaque: false, updateBelow: true }));
    stack.transition('fade', 100, null, { hold: 50 });
    trace.length = 0;
    for (let i = 0; i < 15; i++) stack.update(10);
    assert.equal(stack.isTransitioning, false);
    assert.equal(hooksOf(trace, 'world').filter((h) => h === 'update').length, 15);
    assert.equal(hooksOf(trace, 'modal').filter((h) => h === 'update').length, 15);
  });

  it('scenes pushed mid-transition draw under the overlay, which is always the last fill', () => {
    const stack = createSceneStack();
    stack.push({ draw: (c) => c.fillRect(0, 0, 10, 10) });
    stack.transition('fade', 100);
    stack.update(25);
    stack.push({ opaque: false, draw: (c) => c.fillRect(20, 20, 5, 5) });
    const ctx = fakeCtx();
    stack.draw(ctx);
    const f = fills(ctx).map((c) => c.slice(1, 5));
    assert.deepEqual(f, [[0, 0, 10, 10], [20, 20, 5, 5], [0, 0, W, H]]);
    assert.ok(Math.abs(fills(ctx)[2][6] - 0.5) < 1e-9);
  });

  it('clear() mid-transition drops it; the next transition starts from zero', () => {
    const stack = createSceneStack();
    let fired = 0;
    stack.transition('fade', 100, () => fired++);
    stack.update(25);
    stack.clear();
    assert.equal(stack.isTransitioning, false);
    stack.update(100);
    assert.equal(fired, 0, 'the cancelled midpoint never fires');
    stack.transition('fade', 100, () => fired++);
    assert.equal(stack.transitionState().elapsed, 0);
    stack.update(50);
    assert.equal(fired, 1);
  });

  it('transitionState() is a frozen snapshot, not a live view', () => {
    const stack = createSceneStack();
    stack.transition('fade', 100);
    const s1 = stack.transitionState();
    stack.update(10);
    const s2 = stack.transitionState();
    assert.equal(s1.elapsed, 0);
    assert.equal(s2.elapsed, 10);
    assert.notEqual(s1, s2);
    assert.throws(() => {
      s2.elapsed = 99;
    }, TypeError);
  });

  it('rejects durations whose sum overflows, and survives a merely enormous one', () => {
    const stack = createSceneStack();
    assert.throws(() => stack.transition('fade', Number.MAX_VALUE, null, { hold: Number.MAX_VALUE }), {
      name: 'TypeError',
      message: /finite/,
    });
    assert.throws(() => transitionFrame(0, Number.MAX_VALUE, Number.MAX_VALUE), { name: 'TypeError', message: /finite/ });
    assert.equal(stack.isTransitioning, false);
    assert.equal(stack.transition('fade', Number.MAX_VALUE), true);
    stack.update(1e300);
    stack.update(1e300);
    const state = stack.transitionState();
    assert.equal(state.phase, 'out');
    assert.ok(state.progress > 0 && state.progress < 1e-6);
    assert.equal(stack.handleInput({}), false);
    stack.clear();
    assert.equal(stack.isTransitioning, false);
  });

  it('tiny durations fire fn on the first update that reaches the midpoint', () => {
    const stack = createSceneStack();
    let fired = 0;
    stack.transition('fade', 1e-9, () => fired++);
    stack.update(0);
    assert.equal(fired, 0);
    stack.update(1e-9);
    assert.equal(fired, 1);
    assert.equal(stack.isTransitioning, false);
  });

  it('-0 is accepted as a duration and as dt, and treated as zero', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    let fired = 0;
    assert.equal(stack.transition('fade', -0, () => fired++), true);
    assert.equal(fired, 1);
    trace.length = 0;
    stack.update(-0);
    assert.equal(trace.length, 1);
    assert.ok(Object.is(trace[0][2], 0), 'scenes see +0, never -0');
  });

  it('many exact small steps reach the same state as one big step', () => {
    let firedA = 0;
    let firedB = 0;
    const a = createSceneStack();
    const b = createSceneStack();
    a.transition('iris', 100, () => firedA++, { hold: 20 });
    b.transition('iris', 100, () => firedB++, { hold: 20 });
    for (let i = 0; i < 200; i++) a.update(0.25);
    b.update(50);
    assert.deepEqual(a.transitionState(), b.transitionState());
    assert.equal(firedA, 1);
    assert.equal(firedB, 1);
    for (let i = 0; i < 280; i++) a.update(0.25);
    b.update(70);
    assert.equal(a.isTransitioning, false);
    assert.equal(b.isTransitioning, false);
  });
});

describe('dt edge cases', () => {
  it('rejects NaN, infinities and non-numbers before any scene or transition is touched', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.transition('fade', 100);
    trace.length = 0;
    for (const bad of [NaN, Infinity, -Infinity, '16', 16n, undefined, null, {}, [], true]) {
      assert.throws(() => stack.update(bad), { name: 'TypeError', message: /dt/ }, String(bad));
    }
    assert.deepEqual(trace, []);
    assert.equal(stack.transitionState().elapsed, 0);
  });

  it('negative dt counts as zero for scenes and does not rewind a transition', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    stack.transition('fade', 100);
    stack.update(30);
    trace.length = 0;
    stack.update(-1e9);
    assert.deepEqual(trace, [['a', 'update', 0]]);
    assert.equal(stack.transitionState().elapsed, 30);
  });

  it('a huge dt reaches scenes unclamped and completes a transition in one step', () => {
    const trace = [];
    const stack = createSceneStack();
    stack.push(makeScene('a', trace));
    let fired = 0;
    stack.transition('wipe', 100, () => fired++, { hold: 100 });
    trace.length = 0;
    stack.update(1e15);
    assert.deepEqual(trace, [['a', 'update', 1e15]]);
    assert.equal(fired, 1);
    assert.equal(stack.isTransitioning, false);
  });
});

describe('rapid repeated calls and large stacks', () => {
  it('10k push/pop cycles keep every hook paired and leave the stack as it started', () => {
    const counts = { enter: 0, exit: 0, pause: 0, resume: 0 };
    const count = (hook) => () => counts[hook]++;
    const mk = () => ({ enter: count('enter'), exit: count('exit'), pause: count('pause'), resume: count('resume') });
    const stack = createSceneStack();
    const base = mk();
    stack.push(base);
    for (let i = 0; i < 10000; i++) {
      stack.push(mk());
      stack.pop(i);
    }
    assert.deepEqual(counts, { enter: 10001, exit: 10000, pause: 10000, resume: 10000 });
    assert.deepEqual(stack.stack, [base]);
  });

  it('1000 non-opaque modals draw bottom to top in order, under the overlay', () => {
    const stack = createSceneStack();
    const order = [];
    for (let i = 0; i < 1000; i++) stack.push({ opaque: false, draw: () => order.push(i) });
    stack.transition('fade', 10);
    stack.update(5);
    const ctx = fakeCtx();
    stack.draw(ctx);
    assert.deepEqual(order, Array.from({ length: 1000 }, (_, i) => i));
    assert.deepEqual(fills(ctx).at(-1).slice(1, 5), [0, 0, W, H]);
  });

  it('a 1000-deep updateBelow chain updates bottom to top; one opaque-out scene cuts it', () => {
    const stack = createSceneStack();
    const order = [];
    for (let i = 0; i < 1000; i++) stack.push({ updateBelow: true, update: () => order.push(i) });
    stack.update(1);
    assert.deepEqual(order, Array.from({ length: 1000 }, (_, i) => i));
    order.length = 0;
    stack.push({ update: () => order.push('top') });
    stack.update(1);
    assert.deepEqual(order, ['top']);
  });

  it('1000 sequential transitions each fire exactly once and the stack ends idle', () => {
    const stack = createSceneStack();
    let fired = 0;
    for (let i = 0; i < 1000; i++) {
      const kind = ['fade', 'iris', 'wipe'][i % 3];
      assert.equal(stack.transition(kind, 10, () => fired++), true, `transition ${i}`);
      stack.update(5);
      stack.update(5);
    }
    assert.equal(fired, 1000);
    assert.equal(stack.isTransitioning, false);
  });

  it('transition() hammered every frame while busy is refused without side effects', () => {
    const stack = createSceneStack();
    let first = 0;
    let others = 0;
    assert.equal(stack.transition('fade', 160, () => first++), true);
    for (let i = 0; i < 100; i++) {
      assert.equal(stack.transition('iris', 10, () => others++, { color: '#fff' }), false);
      stack.update(1);
    }
    assert.equal(stack.transitionState().kind, 'fade');
    assert.equal(stack.transitionState().color, '#000000');
    assert.equal(stack.transitionState().elapsed, 100);
    assert.equal(first, 1);
    assert.equal(others, 0);
  });
});

describe('drawing edge cases', () => {
  it('falls back to the native size when ctx.canvas has a zero, NaN or negative size', () => {
    for (const canvas of [{ width: 0, height: 0 }, { width: NaN, height: NaN }, { width: -1, height: -1 }, {}]) {
      const stack = createSceneStack();
      stack.transition('fade', 10);
      stack.update(5);
      const ctx = fakeCtx();
      ctx.canvas = canvas;
      stack.draw(ctx);
      assert.deepEqual(fills(ctx)[0].slice(1, 5), [0, 0, DEFAULT_WIDTH, DEFAULT_HEIGHT], JSON.stringify(canvas));
    }
  });

  it('every kind stays inside a non-default buffer at every phase, with positive integer rectangles', () => {
    for (const kind of ['fade', 'iris', 'wipe']) {
      for (const direction of ['right', 'left', 'down', 'up']) {
        for (const elapsed of [0, 1, 10, 50, 99, 100, 101, 150, 199, 200]) {
          const ctx = fakeCtx();
          drawTransition(ctx, kind, transitionFrame(elapsed, 200), { width: 100, height: 60, direction });
          for (const r of ctx.rects) {
            const where = `${kind}/${direction}@${elapsed}: ${JSON.stringify(r)}`;
            assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 100 && r.y + r.h <= 60, where);
            assert.ok(r.w > 0 && r.h > 0, where);
            assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), where);
          }
          if (elapsed === 0 || elapsed === 200) assert.equal(ctx.rects.length, 0, `${kind}: nothing at coverage 0`);
        }
      }
    }
  });

  it('iris on an odd-sized buffer never paints a pixel twice and keeps the centre clear', () => {
    const w = 101;
    const h = 61;
    for (const coverage of [0.1, 0.33, 0.5, 0.77, 0.99]) {
      const ctx = fakeCtx(w, h);
      drawTransition(ctx, 'iris', { phase: 'out', coverage });
      const hits = new Uint8Array(w * h);
      for (const r of ctx.rects) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) hits[y * w + x] += 1;
      }
      assert.ok(hits.every((n) => n <= 1), `coverage ${coverage}: overlapping rectangles`);
      assert.equal(hits[Math.floor(h / 2) * w + Math.floor(w / 2)], 0, `coverage ${coverage}: centre pixel covered`);
    }
  });

  it('a scene pushed from draw() is not drawn until the next frame', () => {
    const trace = [];
    const stack = createSceneStack();
    let pushed = false;
    const modal = makeScene('modal', trace, { opaque: false });
    const base = makeScene('base', trace, {
      draw() {
        trace.push(['base', 'draw']);
        if (!pushed) {
          pushed = true;
          stack.push(modal);
        }
      },
    });
    stack.push(base);
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.filter((t) => t[1] === 'draw').map((t) => t[0]), ['base']);
    trace.length = 0;
    stack.draw(fakeCtx());
    assert.deepEqual(trace.filter((t) => t[1] === 'draw').map((t) => t[0]), ['base', 'modal']);
  });
});

describe('determinism', () => {
  it('two stacks fed the same fractional dt sequence report identical snapshots and draw calls', () => {
    const dts = [16.6667, 0.1, 33.3, 7.25, 100, 0, 12.5, 16.6667, 50.01, 3];
    const run = () => {
      const stack = createSceneStack();
      const ctx = fakeCtx();
      const snaps = [];
      stack.push({ draw: (c) => c.fillRect(0, 0, 4, 4) });
      stack.transition('iris', 150, (s) => s.push({ opaque: false, draw: (c) => c.fillRect(1, 1, 1, 1) }), { hold: 25 });
      for (const dt of dts) {
        stack.update(dt);
        stack.draw(ctx);
        snaps.push(stack.transitionState());
      }
      return { snaps, calls: ctx.calls, size: stack.size };
    };
    const a = run();
    const b = run();
    assert.deepEqual(a.snaps, b.snaps);
    assert.deepEqual(a.calls, b.calls);
    assert.equal(a.size, 2);
    assert.equal(b.size, 2);
  });
});

// Unit tests for js/core/tween.js: easing math and the deterministic tween scheduler.
// Contract (docs-core-contract.md): `ease` with linear, inQuad, outQuad, inOutQuad, outCubic,
// inOutCubic, outBack, outElastic, outBounce; `createTweens() -> {to(obj, props, ms, {ease, delay,
// onDone}), update(dt), clear(), count}`. Durations and dt are milliseconds.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ease, createTweens, resolveEase, lerp, clamp01, Tween } from '../js/core/tween.js';

const CONTRACT_EASES = ['linear', 'inQuad', 'outQuad', 'inOutQuad', 'outCubic', 'inOutCubic', 'outBack', 'outElastic', 'outBounce'];
/** Curves that must be monotonic non-decreasing and stay inside [0, 1]. */
const MONOTONIC = ['linear', 'inQuad', 'outQuad', 'inOutQuad', 'inCubic', 'outCubic', 'inOutCubic', 'inQuart', 'outQuart',
  'inOutQuart', 'inSine', 'outSine', 'inOutSine', 'inExpo', 'outExpo', 'inOutExpo', 'inCirc', 'outCirc', 'smoothstep',
  'smootherstep', 'step'];
/** Curves that overshoot past 1 (or below 0) on purpose. */
const OVERSHOOT = ['inBack', 'outBack', 'inOutBack', 'inElastic', 'outElastic', 'inOutElastic'];

/**
 * @param {number} a
 * @param {number} b
 * @param {number} [eps]
 * @param {string} [msg]
 */
function near(a, b, eps = 1e-9, msg) {
  assert.ok(Math.abs(a - b) <= eps, msg ?? `expected ${a} to be within ${eps} of ${b}`);
}

/** Evenly spaced sample points in [0, 1], ends included. */
function grid(n = 1001) {
  return Array.from({ length: n }, (_, i) => i / (n - 1));
}

// ---------------------------------------------------------------------------
// Easing math
// ---------------------------------------------------------------------------

describe('ease table', () => {
  test('exposes every contract curve as a function and is frozen', () => {
    for (const name of CONTRACT_EASES) assert.equal(typeof ease[name], 'function', `ease.${name}`);
    assert.ok(Object.isFrozen(ease));
    assert.throws(() => { ease.linear = null; }, TypeError);
  });

  test('every curve maps exactly 0 -> 0 and 1 -> 1', () => {
    for (const [name, fn] of Object.entries(ease)) {
      assert.equal(fn(0), 0, `${name}(0)`);
      assert.equal(fn(1), 1, `${name}(1)`);
    }
  });

  test('every curve returns a finite number on a fine grid', () => {
    for (const [name, fn] of Object.entries(ease)) {
      for (const t of grid()) assert.ok(Number.isFinite(fn(t)), `${name}(${t}) = ${fn(t)}`);
    }
  });

  test('monotonic curves never decrease and stay in [0, 1]', () => {
    for (const name of MONOTONIC) {
      const fn = ease[name];
      let prev = -Infinity;
      for (const t of grid()) {
        const v = fn(t);
        assert.ok(v >= prev - 1e-12, `${name} decreased at t=${t}: ${prev} -> ${v}`);
        assert.ok(v >= -1e-12 && v <= 1 + 1e-12, `${name}(${t}) = ${v} left [0,1]`);
        prev = v;
      }
    }
  });

  test('outBounce stays in [0, 1] and touches 1 at the end of its first bounce', () => {
    for (const t of grid()) {
      const v = ease.outBounce(t);
      assert.ok(v >= 0 && v <= 1 + 1e-12, `outBounce(${t}) = ${v}`);
    }
    near(ease.outBounce(1 / 2.75), 1, 1e-12);
    near(ease.outBounce(0.5), 0.765625, 1e-12);
    // It is NOT monotonic: it dips after the first touch.
    assert.ok(ease.outBounce(1.5 / 2.75) < ease.outBounce(1 / 2.75));
  });

  test('known midpoint values', () => {
    near(ease.linear(0.3), 0.3);
    near(ease.inQuad(0.5), 0.25);
    near(ease.outQuad(0.5), 0.75);
    near(ease.inOutQuad(0.5), 0.5);
    near(ease.inOutQuad(0.25), 0.125);
    near(ease.outCubic(0.5), 0.875);
    near(ease.inOutCubic(0.5), 0.5);
    near(ease.inOutCubic(0.25), 0.0625);
    near(ease.inCubic(0.5), 0.125);
    near(ease.smoothstep(0.5), 0.5);
    assert.equal(ease.step(0.999), 0);
    assert.equal(ease.step(1), 1);
  });

  test('in/out pairs are mirror images and inOut curves are point-symmetric', () => {
    for (const t of grid(101)) {
      near(ease.inQuad(t), 1 - ease.outQuad(1 - t), 1e-12);
      near(ease.inCubic(t), 1 - ease.outCubic(1 - t), 1e-12);
      near(ease.inOutQuad(t) + ease.inOutQuad(1 - t), 1, 1e-12);
      near(ease.inOutCubic(t) + ease.inOutCubic(1 - t), 1, 1e-12);
    }
  });

  test('outBack overshoots by about 10% and never undershoots 0', () => {
    let max = 0;
    for (const t of grid()) {
      const v = ease.outBack(t);
      max = Math.max(max, v);
      assert.ok(v >= 0, `outBack(${t}) = ${v} < 0`);
    }
    assert.ok(max > 1.05 && max < 1.15, `outBack peak ${max}`);
  });

  test('outElastic overshoots, oscillates and settles', () => {
    const vals = grid().map((t) => ease.outElastic(t));
    assert.ok(Math.max(...vals) > 1.1, 'no overshoot');
    const firstOver = vals.findIndex((v) => v > 1);
    assert.ok(vals.slice(firstOver).some((v) => v < 1), 'never swung back below 1');
    // Settles: in the last 20% the deviation is tiny.
    for (const v of vals.slice(800)) assert.ok(Math.abs(v - 1) < 0.03, `late value ${v}`);
  });

  test('overshooting curves stay bounded', () => {
    for (const name of OVERSHOOT) {
      for (const t of grid()) {
        const v = ease[name](t);
        assert.ok(v > -1 && v < 2, `${name}(${t}) = ${v}`);
      }
    }
  });

  test('curves clamp sensibly outside [0, 1] where guarded', () => {
    assert.equal(ease.outBack(-1), 0);
    assert.equal(ease.outBack(2), 1);
    assert.equal(ease.outElastic(-0.5), 0);
    assert.equal(ease.outElastic(1.5), 1);
    assert.equal(ease.inExpo(-1), 0);
    assert.equal(ease.outExpo(2), 1);
  });
});

describe('helpers', () => {
  test('resolveEase accepts names, functions and nullish; rejects the rest', () => {
    assert.equal(resolveEase('outQuad'), ease.outQuad);
    assert.equal(resolveEase(undefined), ease.linear);
    assert.equal(resolveEase(null), ease.linear);
    const fn = (t) => t;
    assert.equal(resolveEase(fn), fn);
    assert.throws(() => resolveEase('nope'), /unknown easing "nope"/);
    assert.throws(() => resolveEase('toString'), TypeError); // prototype keys are not easings
    assert.throws(() => resolveEase('__proto__'), TypeError);
    assert.throws(() => resolveEase(42), TypeError);
    assert.throws(() => resolveEase({}), TypeError);
  });

  test('clamp01 clamps and maps NaN to 0', () => {
    assert.equal(clamp01(-1), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(0.5), 0.5);
    assert.equal(clamp01(NaN), 0);
    assert.equal(clamp01(Infinity), 1);
    assert.equal(clamp01(-Infinity), 0);
  });

  test('lerp is exact at both ends and extrapolates', () => {
    for (const [a, b] of [[0.1, 0.7], [-3.3, 1e6], [1e-9, 1e9], [5, 5]]) {
      assert.equal(lerp(a, b, 0), a);
      assert.equal(lerp(a, b, 1), b);
    }
    assert.equal(lerp(0, 10, 0.5), 5);
    assert.equal(lerp(0, 10, 1.5), 15);
    assert.equal(lerp(0, 10, -0.5), -5);
  });
});

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

describe('createTweens: basics', () => {
  test('returns the contract API', () => {
    const tw = createTweens();
    for (const k of ['to', 'update', 'clear']) assert.equal(typeof tw[k], 'function', k);
    assert.equal(tw.count, 0);
  });

  test('to() returns a Tween, does not touch the target until update()', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const t = tw.to(o, { x: 100 }, 1000);
    assert.ok(t instanceof Tween);
    assert.equal(o.x, 0);
    assert.equal(tw.count, 1);
    assert.equal(t.done, false);
    assert.equal(t.started, false);
    assert.equal(t.progress, 0);
  });

  test('linear interpolation per update, exact landing, onDone exactly once', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const calls = [];
    const t = tw.to(o, { x: 100 }, 1000, { onDone: (tt) => calls.push(tt) });
    tw.update(250);
    assert.equal(o.x, 25);
    assert.equal(t.progress, 0.25);
    tw.update(500);
    assert.equal(o.x, 75);
    assert.equal(calls.length, 0);
    tw.update(250);
    assert.equal(o.x, 100);
    assert.deepEqual(calls, [t]);
    assert.equal(t.done, true);
    assert.equal(t.finished, true);
    assert.equal(t.progress, 1);
    assert.equal(tw.count, 0);
    tw.update(1000);
    tw.update(1000);
    assert.equal(calls.length, 1, 'onDone must fire once');
    assert.equal(o.x, 100);
  });

  test('values land exactly on the target even with awkward dt steps', () => {
    const tw = createTweens();
    const o = { a: 0.1, b: -7.3, c: 1e6 };
    tw.to(o, { a: 0.7, b: 2.2, c: -1e-3 }, 1000, { ease: 'outElastic' });
    for (let i = 0; i < 59; i++) tw.update(16.666666666666668);
    assert.notEqual(o.a, 0.7);
    tw.update(16.666666666666668);
    tw.update(16.666666666666668);
    assert.equal(o.a, 0.7);
    assert.equal(o.b, 2.2);
    assert.equal(o.c, -1e-3);
    assert.equal(tw.count, 0);
  });

  test('multiple properties and multiple targets advance together', () => {
    const tw = createTweens();
    const a = { x: 0, y: 10 };
    const b = { v: 1 };
    tw.to(a, { x: 10, y: 0 }, 100);
    tw.to(b, { v: 3 }, 200);
    assert.equal(tw.count, 2);
    tw.update(50);
    assert.deepEqual(a, { x: 5, y: 5 });
    assert.equal(b.v, 1.5);
    tw.update(50);
    assert.deepEqual(a, { x: 10, y: 0 });
    assert.equal(b.v, 2);
    assert.equal(tw.count, 1);
    tw.update(100);
    assert.equal(b.v, 3);
    assert.equal(tw.count, 0);
  });

  test('easing option by name or function changes the curve', () => {
    const tw = createTweens();
    const o = { x: 0, y: 0 };
    tw.to(o, { x: 100 }, 1000, { ease: 'outQuad' });
    tw.to(o, { y: 100 }, 1000, { ease: (t) => t * t });
    tw.update(500);
    assert.equal(o.x, 75);
    assert.equal(o.y, 25);
    assert.throws(() => tw.to(o, { x: 1 }, 10, { ease: 'wiggle' }), /unknown easing/);
  });

  test('a huge dt completes a tween instead of overshooting it', () => {
    const tw = createTweens();
    const o = { x: 0 };
    let done = 0;
    tw.to(o, { x: 100 }, 1000, { ease: 'outBack', onDone: () => done++ });
    tw.update(1e9);
    assert.equal(o.x, 100);
    assert.equal(done, 1);
    assert.equal(tw.count, 0);
  });

  test('zero dt starts the tween but moves nothing; negative dt is treated as zero', () => {
    const tw = createTweens();
    const o = { x: 5 };
    const t = tw.to(o, { x: 100 }, 1000);
    tw.update(0);
    assert.equal(o.x, 5);
    assert.equal(t.started, true);
    assert.equal(t.done, false);
    tw.update(-500);
    assert.equal(o.x, 5);
    assert.equal(t.elapsed, 0);
    tw.update(100);
    assert.equal(o.x, 14.5);
    tw.update(-1e9);
    assert.equal(o.x, 14.5);
    assert.equal(tw.count, 1);
  });

  test('update rejects NaN, undefined, strings and infinities', () => {
    const tw = createTweens();
    tw.to({ x: 0 }, { x: 1 }, 100);
    for (const bad of [NaN, undefined, null, '16', Infinity, -Infinity, {}, []]) {
      assert.throws(() => tw.update(bad), TypeError, `dt=${String(bad)}`);
    }
    assert.equal(tw.count, 1, 'a rejected update must not disturb the list');
  });

  test('update with no tweens is a no-op', () => {
    const tw = createTweens();
    tw.update(16);
    tw.update(0);
    tw.clear();
    assert.equal(tw.count, 0);
  });

  test('zero-duration tween snaps to the target on the first update (even update(0)) and fires onDone', () => {
    const tw = createTweens();
    const o = { x: 0 };
    let done = 0;
    const t = tw.to(o, { x: 7 }, 0, { onDone: () => done++ });
    assert.equal(o.x, 0);
    tw.update(0);
    assert.equal(o.x, 7);
    assert.equal(done, 1);
    assert.equal(t.progress, 1);
    assert.equal(tw.count, 0);
  });

  test('zero-duration tween with a delay waits out the delay first', () => {
    const tw = createTweens();
    const o = { x: 0 };
    tw.to(o, { x: 7 }, 0, { delay: 100 });
    tw.update(99);
    assert.equal(o.x, 0);
    tw.update(1);
    assert.equal(o.x, 7);
  });
});

describe('createTweens: delay', () => {
  test('delay holds the tween, captures start values when the delay ends', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const t = tw.to(o, { x: 10 }, 100, { delay: 50 });
    tw.update(49);
    assert.equal(o.x, 0);
    assert.equal(t.started, false);
    o.x = 50; // moved by something else during the delay
    tw.update(1); // delay ends exactly here; nothing animated yet
    assert.equal(t.started, true);
    assert.equal(o.x, 50);
    tw.update(50);
    assert.equal(o.x, 30, 'tweens from the value seen when the delay ended');
    tw.update(50);
    assert.equal(o.x, 10);
    assert.equal(t.done, true);
  });

  test('a dt that overruns the delay carries the remainder into the animation', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const t = tw.to(o, { x: 100 }, 100, { delay: 50 });
    tw.update(80);
    assert.equal(o.x, 30);
    assert.equal(t.elapsed, 30);
    tw.update(1000);
    assert.equal(o.x, 100);
  });

  test('a huge dt completes a delayed tween in one step', () => {
    const tw = createTweens();
    const o = { x: 0 };
    let done = 0;
    tw.to(o, { x: 1 }, 100, { delay: 1e6, onDone: () => done++ });
    tw.update(1e9);
    assert.equal(o.x, 1);
    assert.equal(done, 1);
  });

  test('onStart fires once after the delay; onUpdate reports eased k ending at 1', () => {
    const tw = createTweens();
    const o = { x: 0 };
    let starts = 0;
    const ks = [];
    tw.to(o, { x: 1 }, 100, { delay: 20, onStart: () => starts++, onUpdate: (k) => ks.push(k) });
    tw.update(10);
    assert.equal(starts, 0);
    assert.equal(ks.length, 0);
    tw.update(10);
    assert.equal(starts, 1);
    tw.update(50);
    tw.update(50);
    tw.update(50);
    assert.equal(starts, 1);
    assert.equal(ks.at(-1), 1);
    assert.ok(ks.every((k, i) => i === 0 || k >= ks[i - 1]));
  });

  test('rejects negative, NaN and infinite delays', () => {
    const tw = createTweens();
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 100, { delay: -1 }), RangeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 100, { delay: NaN }), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 100, { delay: Infinity }), RangeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 100, { delay: '5' }), TypeError);
  });
});

describe('createTweens: clear / cancel / finish / stop', () => {
  test('clear() cancels everything, leaves values in place and never fires onDone', () => {
    const tw = createTweens();
    const o = { x: 0, y: 0 };
    let done = 0;
    const a = tw.to(o, { x: 100 }, 1000, { onDone: () => done++ });
    const b = tw.to(o, { y: 100 }, 1000, { onDone: () => done++ });
    tw.update(300);
    tw.clear();
    assert.equal(tw.count, 0);
    assert.deepEqual(o, { x: 30, y: 30 });
    assert.equal(done, 0);
    assert.equal(a.cancelled, true);
    assert.equal(b.done, true);
    assert.equal(a.finished, false);
    tw.update(5000);
    assert.deepEqual(o, { x: 30, y: 30 });
    assert.equal(done, 0);
  });

  test('clear() on an empty scheduler and repeated clear() are harmless', () => {
    const tw = createTweens();
    tw.clear();
    tw.clear();
    tw.to({ x: 0 }, { x: 1 }, 10);
    tw.clear();
    tw.clear();
    assert.equal(tw.count, 0);
  });

  test('the scheduler is usable again after clear()', () => {
    const tw = createTweens();
    const o = { x: 0 };
    tw.to(o, { x: 100 }, 100);
    tw.clear();
    tw.to(o, { x: 50 }, 100);
    tw.update(100);
    assert.equal(o.x, 50);
  });

  test('clear() called from inside onDone during update() is safe and cancels the siblings', () => {
    const tw = createTweens();
    const o = { x: 0, y: 0, z: 0 };
    let others = 0;
    tw.to(o, { x: 1 }, 10, { onDone: () => tw.clear() });
    tw.to(o, { y: 1 }, 10, { onDone: () => others++ });
    tw.to(o, { z: 1 }, 1000, { onDone: () => others++ });
    tw.update(10);
    assert.equal(o.x, 1);
    assert.equal(tw.count, 0);
    assert.equal(others, 0);
    tw.update(1000);
    assert.equal(o.z, 0);
  });

  test('to() called from inside onDone registers a tween that starts on the next update', () => {
    const tw = createTweens();
    const o = { x: 0, y: 0 };
    tw.to(o, { x: 1 }, 10, { onDone: () => tw.to(o, { y: 1 }, 10) });
    tw.update(10);
    assert.equal(o.x, 1);
    assert.equal(o.y, 0, 'chained tween is not stepped in the same frame');
    assert.equal(tw.count, 1);
    tw.update(10);
    assert.equal(o.y, 1);
    assert.equal(tw.count, 0);
  });

  test('cancel() stops one tween without onDone; cancel twice is fine', () => {
    const tw = createTweens();
    const o = { x: 0, y: 0 };
    let done = 0;
    const a = tw.to(o, { x: 100 }, 100, { onDone: () => done++ });
    tw.to(o, { y: 100 }, 100, { onDone: () => done++ });
    tw.update(50);
    a.cancel();
    a.cancel();
    assert.equal(tw.count, 1);
    tw.update(50);
    assert.deepEqual(o, { x: 50, y: 100 });
    assert.equal(done, 1);
  });

  test('finish() jumps to the end and fires onDone once', () => {
    const tw = createTweens();
    const o = { x: 0 };
    let done = 0;
    const t = tw.to(o, { x: 100 }, 1000, { onDone: () => done++ });
    tw.update(10);
    t.finish();
    t.finish();
    assert.equal(o.x, 100);
    assert.equal(done, 1);
    assert.equal(t.finished, true);
    assert.equal(tw.count, 0);
    tw.update(10);
    assert.equal(done, 1);
  });

  test('finish() on a pending (delayed) tween applies from and lands on the target', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const t = tw.to(o, { x: 100 }, 1000, { delay: 500, from: { x: 20 } });
    t.finish();
    assert.equal(o.x, 100);
    assert.equal(t.done, true);
  });

  test('stop(obj) cancels only that target and returns how many', () => {
    const tw = createTweens();
    const a = { x: 0 };
    const b = { x: 0 };
    tw.to(a, { x: 1 }, 100);
    tw.to(a, { x: 2 }, 100);
    tw.to(b, { x: 1 }, 100);
    assert.equal(tw.stop(a), 2);
    assert.equal(tw.stop(a), 0);
    assert.equal(tw.count, 1);
    tw.update(100);
    assert.equal(a.x, 0);
    assert.equal(b.x, 1);
  });

  test('overwrite: true cancels earlier tweens on the same target', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const a = tw.to(o, { x: 100 }, 100);
    tw.update(50);
    tw.to(o, { x: 0 }, 100, { overwrite: true });
    assert.equal(a.cancelled, true);
    assert.equal(tw.count, 1);
    tw.update(100);
    assert.equal(o.x, 0);
  });

  test('pause()/resume() freeze a single tween', () => {
    const tw = createTweens();
    const o = { x: 0 };
    const t = tw.to(o, { x: 100 }, 100);
    tw.update(20);
    t.pause();
    assert.equal(t.paused, true);
    tw.update(50);
    assert.equal(o.x, 20);
    t.resume();
    tw.update(30);
    assert.equal(o.x, 50);
  });
});

describe('createTweens: repeat / yoyo / from / promise', () => {
  test('repeat replays the cycle; yoyo alternates direction and ends at the start value', () => {
    const tw = createTweens();
    const o = { x: 0 };
    tw.to(o, { x: 10 }, 100, { repeat: 1 });
    tw.update(150);
    assert.equal(o.x, 5);
    tw.update(50);
    assert.equal(o.x, 10);
    assert.equal(tw.count, 0);

    const p = { x: 0 };
    let done = 0;
    const t = tw.to(p, { x: 10 }, 100, { repeat: 1, yoyo: true, onDone: () => done++ });
    tw.update(100);
    assert.equal(p.x, 10);
    assert.equal(t.done, false);
    tw.update(50);
    assert.equal(p.x, 5);
    tw.update(50);
    assert.equal(p.x, 0, 'yoyo ends back at the start');
    assert.equal(done, 1);
  });

  test('repeat: Infinity never completes; progress wraps; finish() ends at a cycle boundary', () => {
    const tw = createTweens();
    const o = { x: 0 };
    let done = 0;
    const t = tw.to(o, { x: 10 }, 100, { repeat: Infinity, yoyo: true, onDone: () => done++ });
    for (let i = 0; i < 1000; i++) {
      tw.update(7);
      assert.ok(o.x >= 0 && o.x <= 10, `x=${o.x}`);
      assert.ok(t.progress >= 0 && t.progress < 1);
    }
    assert.equal(t.done, false);
    assert.equal(tw.count, 1);
    t.finish();
    assert.equal(done, 1);
    assert.ok(o.x === 0 || o.x === 10, `finish lands on a cycle end, got ${o.x}`);
    assert.equal(tw.count, 0);
  });

  test('from applies explicit start values at start', () => {
    const tw = createTweens();
    const o = { x: 999 };
    tw.to(o, { x: 10 }, 100, { from: { x: 0 } });
    assert.equal(o.x, 999);
    tw.update(0);
    assert.equal(o.x, 0);
    tw.update(50);
    assert.equal(o.x, 5);
  });

  test('from lets a missing property be animated', () => {
    const tw = createTweens();
    const o = {};
    tw.to(o, { x: 10 }, 100, { from: { x: 0 } });
    tw.update(100);
    assert.equal(o.x, 10);
  });

  test('promise resolves true on completion, false on cancel, and immediately when already done', async () => {
    const tw = createTweens();
    const a = tw.to({ x: 0 }, { x: 1 }, 10);
    const b = tw.to({ x: 0 }, { x: 1 }, 10);
    const pa = a.promise;
    b.cancel();
    tw.update(10);
    assert.equal(await pa, true);
    assert.equal(await b.promise, false);
    assert.equal(await a.promise, true);
    assert.equal(a.promise, a.promise, 'promise is cached');
  });

  test('wait() is a timer that fires after ms of scheduler time', () => {
    const tw = createTweens();
    let fired = 0;
    const t = tw.wait(100, () => fired++);
    assert.ok(t instanceof Tween);
    tw.update(99);
    assert.equal(fired, 0);
    tw.update(1);
    assert.equal(fired, 1);
    tw.update(1000);
    assert.equal(fired, 1);
    tw.wait(10);
    tw.update(10);
    assert.equal(tw.count, 0);
  });
});

describe('createTweens: timeScale and determinism', () => {
  test('timeScale scales dt; 0 pauses; invalid values throw', () => {
    const tw = createTweens({ timeScale: 2 });
    const o = { x: 0 };
    tw.to(o, { x: 100 }, 100);
    tw.update(25);
    assert.equal(o.x, 50);
    tw.timeScale = 0;
    tw.update(1000);
    assert.equal(o.x, 50);
    tw.timeScale = 1;
    tw.update(50);
    assert.equal(o.x, 100);
    for (const bad of [-1, NaN, Infinity, '1', null]) assert.throws(() => { tw.timeScale = bad; }, RangeError);
    assert.throws(() => createTweens({ timeScale: -1 }), RangeError);
  });

  test('two schedulers fed identical calls and dts produce identical values', () => {
    const run = () => {
      const tw = createTweens();
      const o = { x: 0, y: 1, z: -5 };
      const trace = [];
      tw.to(o, { x: 100 }, 777, { ease: 'outElastic', delay: 33 });
      tw.to(o, { y: -1 }, 400, { ease: 'outBounce', repeat: 2, yoyo: true });
      tw.to(o, { z: 5 }, 1234, { ease: 'inOutCubic', onDone: () => tw.to(o, { z: 0 }, 100) });
      let dt = 3;
      for (let i = 0; i < 400; i++) {
        dt = (dt * 7 + 5) % 23; // deterministic, uneven steps
        tw.update(dt);
        trace.push(o.x, o.y, o.z);
      }
      return trace;
    };
    assert.deepEqual(run(), run());
  });

  test('sum of small steps lands exactly where one big step lands', () => {
    const a = { x: 0 };
    const b = { x: 0 };
    const ta = createTweens();
    const tb = createTweens();
    ta.to(a, { x: 10 }, 1000);
    tb.to(b, { x: 10 }, 1000);
    for (let i = 0; i < 1000; i++) ta.update(1);
    tb.update(1000);
    assert.equal(a.x, 10);
    assert.equal(b.x, 10);
  });
});

describe('createTweens: validation and adversarial input', () => {
  test('rejects bad targets, props and options', () => {
    const tw = createTweens();
    for (const bad of [null, undefined, 1, 'str', true]) {
      assert.throws(() => tw.to(bad, { x: 1 }, 10), TypeError, `target ${String(bad)}`);
    }
    for (const bad of [null, undefined, 1, 'str', [1]]) {
      assert.throws(() => tw.to({ x: 0 }, bad, 10), TypeError, `props ${String(bad)}`);
    }
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, null), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, 'fast'), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: NaN }, 10), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: '5' }, 10), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: Infinity }, 10), TypeError);
    assert.throws(() => tw.to({ x: '0' }, { x: 1 }, 10), /target\.x/);
    assert.throws(() => tw.to({}, { x: 1 }, 10), /target\.x/);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { from: { y: 0 } }), /from\.y/);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { from: { x: NaN } }), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { from: [0] }), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { onDone: 'later' }), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { onUpdate: 1 }), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { repeat: 1.5 }), RangeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { repeat: -1 }), RangeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, 10, { repeat: NaN }), RangeError);
    assert.equal(tw.count, 0, 'nothing leaked from rejected calls');
  });

  test('rejects bad durations', () => {
    const tw = createTweens();
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, -1), RangeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, NaN), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, Infinity), RangeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }, '100'), TypeError);
    assert.throws(() => tw.to({ x: 0 }, { x: 1 }), TypeError);
  });

  test('empty props is a pure timer', () => {
    const tw = createTweens();
    let done = 0;
    tw.to({}, {}, 50, { onDone: () => done++ });
    tw.update(50);
    assert.equal(done, 1);
  });

  test('a target whose property turns non-numeric during the delay falls back to the creation value', () => {
    const tw = createTweens();
    const o = { x: 0 };
    tw.to(o, { x: 10 }, 100, { delay: 10 });
    o.x = 'oops';
    tw.update(10);
    tw.update(50);
    assert.equal(o.x, 5);
  });

  test('rapid repeated calls: 10k tweens complete and the list does not leak', () => {
    const tw = createTweens();
    const targets = Array.from({ length: 10000 }, (_, i) => ({ v: i }));
    let done = 0;
    for (const t of targets) tw.to(t, { v: 0 }, 1 + (t.v % 97), { onDone: () => done++ });
    assert.equal(tw.count, 10000);
    for (let i = 0; i < 100; i++) tw.update(1);
    assert.equal(done, 10000);
    assert.equal(tw.count, 0);
    assert.ok(targets.every((t) => t.v === 0));
  });

  test('exceptions thrown by onDone propagate but leave the scheduler consistent', () => {
    const tw = createTweens();
    const o = { x: 0, y: 0 };
    tw.to(o, { x: 1 }, 10, { onDone: () => { throw new Error('boom'); } });
    tw.to(o, { y: 1 }, 20);
    assert.throws(() => tw.update(10), /boom/);
    assert.equal(o.x, 1);
    tw.update(10);
    assert.equal(o.y, 1);
    assert.equal(tw.count, 0);
  });

  test('tween targets may be arrays or functions (any object)', () => {
    const tw = createTweens();
    const arr = [0, 0];
    const fn = () => {};
    fn.k = 0;
    tw.to(arr, { 0: 10, 1: 20 }, 10);
    tw.to(fn, { k: 1 }, 10);
    tw.update(10);
    assert.deepEqual(arr, [10, 20]);
    assert.equal(fn.k, 1);
  });

  test('the count getter excludes tweens cancelled between updates', () => {
    const tw = createTweens();
    const t = tw.to({ x: 0 }, { x: 1 }, 100);
    tw.to({ x: 0 }, { x: 1 }, 100);
    t.cancel();
    assert.equal(tw.count, 1);
    tw.update(1);
    assert.equal(tw.count, 1);
  });
});

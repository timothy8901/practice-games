// Unit tests for js/core/fx.js: particle presets, emitters, camera shake, flashes and drawing.
// Contract (docs-core-contract.md): `createFX() -> {particles(spec), shake(amount, ms), flash(color,
// ms), update(dt), draw(ctx), cameraOffset()}` with the emitters fireflies, sparkles, splash, leaves,
// dust, rain, snow, motes, confetti defined as pure data presets. Units are milliseconds.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createFX, PARTICLE_PRESETS, SPEC_DEFAULTS, Emitter, Flash } from '../js/core/fx.js';

const CONTRACT_PRESETS = ['fireflies', 'sparkles', 'splash', 'leaves', 'dust', 'rain', 'snow', 'motes', 'confetti'];
const W = 480;
const H = 270;

/**
 * A recording 2D-context double with a real save/restore stack for the three state fields fx.js
 * touches, so state-leak assertions are meaningful.
 */
function fakeCtx() {
  const rects = [];
  const saved = [];
  const ctx = {
    fillStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    rects,
    get depth() {
      return saved.length;
    },
    save() {
      saved.push({ f: ctx.fillStyle, a: ctx.globalAlpha, o: ctx.globalCompositeOperation });
    },
    restore() {
      const s = saved.pop();
      if (s) {
        ctx.fillStyle = s.f;
        ctx.globalAlpha = s.a;
        ctx.globalCompositeOperation = s.o;
      }
    },
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, fill: ctx.fillStyle, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation });
    },
  };
  return ctx;
}

/** Runs `ms` of simulation in `step`-sized updates. */
function run(fx, ms, step = 16) {
  let t = 0;
  while (t + step <= ms) {
    fx.update(step);
    t += step;
  }
  if (ms - t > 0) fx.update(ms - t);
}

/** One particle that lives practically forever and moves at a known velocity. */
function probe(fx, extra = {}) {
  return fx.particles({ count: 1, life: 1e9, speed: 0, angle: 0, x: 100, y: 100, ...extra });
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} eps
 * @param {string} [msg]
 */
function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= eps, msg ?? `expected ${a} to be within ${eps} of ${b}`);
}

// ---------------------------------------------------------------------------
// Presets as pure data
// ---------------------------------------------------------------------------

describe('presets', () => {
  test('every contract emitter exists as a frozen, pure-data preset', () => {
    assert.ok(Object.isFrozen(PARTICLE_PRESETS));
    for (const name of CONTRACT_PRESETS) {
      const p = PARTICLE_PRESETS[name];
      assert.ok(p && typeof p === 'object', `preset ${name}`);
      assert.ok(Object.isFrozen(p), `${name} frozen`);
      assert.deepEqual(JSON.parse(JSON.stringify(p)), p, `${name} is plain JSON data`);
      for (const v of Object.values(p)) assert.notEqual(typeof v, 'function', `${name} has a function field`);
    }
    assert.ok(Object.isFrozen(SPEC_DEFAULTS));
    assert.throws(() => { PARTICLE_PRESETS.sparkles.count = 1; }, TypeError);
  });

  test('every preset resolves without error and spawns particles', () => {
    for (const name of Object.keys(PARTICLE_PRESETS)) {
      const fx = createFX({ seed: name });
      const em = fx.particles(name);
      assert.ok(em instanceof Emitter, `${name} returns an Emitter`);
      let peak = fx.particleCount;
      for (let i = 0; i < 90; i++) {
        fx.update(16);
        peak = Math.max(peak, fx.particleCount);
        for (const p of fx.snapshot()) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${name} particle at ${p.x},${p.y}`);
          assert.ok(p.alpha >= 0 && p.alpha <= 1, `${name} alpha ${p.alpha}`);
          assert.ok(p.size >= 0, `${name} size ${p.size}`);
        }
      }
      assert.ok(peak > 0, `${name} produced no particles within 1.5s`);
      for (const p of fx.snapshot()) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${name} particle at ${p.x},${p.y}`);
        assert.ok(p.alpha >= 0 && p.alpha <= 1, `${name} alpha ${p.alpha}`);
        assert.ok(p.size >= 0, `${name} size ${p.size}`);
      }
    }
  });

  test('bursts are one-shot, continuous presets keep emitting', () => {
    const fx = createFX();
    const burst = fx.particles('sparkles');
    const cont = fx.particles('fireflies', { x: 100, y: 100 });
    assert.equal(fx.particleCount, 12);
    assert.equal(burst.emitting, false);
    assert.equal(cont.emitting, true);
    run(fx, 5000);
    assert.equal(burst.done, true, 'sparkles all died');
    assert.ok(cont.alive > 0 && cont.emitting, 'fireflies keep going');
    assert.ok(fx.presetNames.includes('confetti'));
  });

  test('rain and snow are screen-space back-layer emitters that cover the screen', () => {
    for (const name of ['rain', 'snow']) {
      const fx = createFX({ seed: name });
      fx.particles(name);
      run(fx, 3000);
      const snap = fx.snapshot();
      assert.ok(snap.length > 20, `${name}: ${snap.length}`);
      assert.ok(snap.every((p) => p.space === 'screen' && p.layer === 'back'));
      const xs = snap.map((p) => p.x);
      assert.ok(Math.min(...xs) < 60 && Math.max(...xs) > W - 60, `${name} spans the width`);
      assert.ok(snap.every((p) => p.y < H + 40), `${name} culled below the screen`);
    }
  });

  test('presets can be given by name with overrides, or as a spec with preset:', () => {
    const fx = createFX();
    const a = fx.particles('dust', { x: 10, y: 20 });
    const b = fx.particles({ preset: 'dust', x: 30, y: 40, count: 2 });
    assert.equal(a.spec.preset, 'dust');
    assert.equal(a.x, 10);
    assert.equal(b.y, 40);
    assert.equal(fx.particleCount, 6 + 2);
    assert.ok(Object.isFrozen(a.spec));
  });

  test('custom presets merge over the built-ins', () => {
    const fx = createFX({ presets: { puff: { count: 3, colors: '#abc' }, dust: { count: 1 } } });
    fx.particles('puff');
    assert.equal(fx.particleCount, 3);
    fx.particles('dust');
    assert.equal(fx.particleCount, 4);
    assert.ok(fx.presetNames.includes('puff'));
    assert.equal(createFX().presetNames.includes('puff'), false, 'built-in table untouched');
  });
});

// ---------------------------------------------------------------------------
// createFX API and defaults
// ---------------------------------------------------------------------------

describe('createFX: API and initial state', () => {
  test('returns the contract API', () => {
    const fx = createFX();
    for (const k of ['particles', 'shake', 'flash', 'update', 'draw', 'cameraOffset']) {
      assert.equal(typeof fx[k], 'function', k);
    }
  });

  test('before any update: zero offset, nothing to draw, nothing throws', () => {
    const fx = createFX();
    assert.deepEqual(fx.cameraOffset(), { x: 0, y: 0 });
    assert.equal(fx.particleCount, 0);
    assert.deepEqual(fx.stats(), { particles: 0, emitters: 0, shakes: 0, flashes: 0, pooled: 0 });
    const ctx = fakeCtx();
    fx.draw(ctx);
    assert.equal(ctx.rects.length, 0);
    assert.equal(ctx.depth, 0);
    fx.clear();
    assert.deepEqual(fx.snapshot(), []);
  });

  test('cameraOffset returns a fresh object each call', () => {
    const fx = createFX();
    const a = fx.cameraOffset();
    a.x = 99;
    assert.deepEqual(fx.cameraOffset(), { x: 0, y: 0 });
  });

  test('validates options', () => {
    assert.throws(() => createFX(null), TypeError);
    assert.throws(() => createFX({ width: -1 }), RangeError);
    assert.throws(() => createFX({ maxParticles: NaN }), RangeError);
    assert.throws(() => createFX({ maxDt: 0 }), RangeError);
    assert.throws(() => createFX({ presets: null }), TypeError);
    assert.throws(() => createFX({ rng: {} }), TypeError);
    assert.throws(() => createFX({ random: 1 }), TypeError);
    assert.throws(() => createFX({ seed: {} }), TypeError);
    assert.ok(createFX({ seed: 42 }));
    assert.ok(createFX({ random: Math.random }));
  });
});

// ---------------------------------------------------------------------------
// Particles: emission, motion, lifetime
// ---------------------------------------------------------------------------

describe('particles: emission', () => {
  test('a burst spawns count particles immediately at the origin', () => {
    const fx = createFX();
    const em = fx.particles({ count: 5, x: 12, y: 34 });
    assert.equal(fx.particleCount, 5);
    assert.equal(em.alive, 5);
    for (const p of fx.snapshot()) {
      assert.equal(p.x, 12);
      assert.equal(p.y, 34);
    }
  });

  test('emission box spreads spawn positions uniformly inside it', () => {
    const fx = createFX();
    fx.particles({ count: 500, x: 10, y: 20, w: 100, h: 50 });
    const snap = fx.snapshot();
    assert.ok(snap.every((p) => p.x >= 10 && p.x <= 110 && p.y >= 20 && p.y <= 70));
    const xs = snap.map((p) => p.x);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 80);
  });

  test('rate emits floor(rate * seconds) particles over time with a carried remainder', () => {
    const fx = createFX();
    fx.particles({ rate: 100, life: 1e9, cull: false });
    assert.equal(fx.particleCount, 0);
    run(fx, 1000, 16);
    near(fx.particleCount, 100, 1);
    run(fx, 1000, 7);
    near(fx.particleCount, 200, 1);
  });

  test('duration ends continuous emission; the emitter lingers while particles live', () => {
    const fx = createFX();
    const em = fx.particles({ rate: 100, duration: 500, life: 2000 });
    run(fx, 1000, 10);
    assert.equal(fx.particleCount, 50);
    assert.equal(em.emitting, false);
    assert.equal(em.done, false);
    assert.equal(fx.emitterCount, 1);
    run(fx, 2500, 10);
    assert.equal(fx.particleCount, 0);
    assert.equal(em.done, true);
    assert.equal(fx.emitterCount, 0);
  });

  test('particles die when age reaches life; dead emitters are dropped', () => {
    const fx = createFX();
    const em = fx.particles({ count: 5, life: 100 });
    fx.update(99);
    assert.equal(fx.particleCount, 5);
    fx.update(1);
    assert.equal(fx.particleCount, 0);
    assert.equal(em.alive, 0);
    assert.equal(em.done, true);
    assert.equal(fx.emitterCount, 0);
    assert.equal(fx.stats().pooled, 5, 'dead particles return to the pool');
  });

  test('life ranges: nothing outlives the maximum', () => {
    const fx = createFX();
    fx.particles({ count: 200, life: [50, 150] });
    fx.update(49);
    assert.equal(fx.particleCount, 200);
    run(fx, 100, 10);
    assert.ok(fx.particleCount > 0 && fx.particleCount < 200);
    fx.update(2);
    assert.equal(fx.particleCount, 0);
  });

  test('maxParticles caps spawning; the cap frees up as particles die', () => {
    const fx = createFX({ maxParticles: 10 });
    const em = fx.particles({ count: 50, life: 100 });
    assert.equal(fx.particleCount, 10);
    assert.equal(em.burst(5), 0);
    fx.update(100);
    assert.equal(fx.particleCount, 0);
    assert.equal(em.burst(5), 5);
    assert.equal(fx.particleCount, 5);
  });

  test('huge burst counts are bounded by the default cap without hanging', () => {
    const fx = createFX();
    fx.particles({ count: 1e6 });
    assert.equal(fx.particleCount, 2000);
  });

  test('emitter handle: moveTo, burst, stop, kill, elapsed', () => {
    const fx = createFX();
    const em = fx.particles({ rate: 1000, life: 1e9, x: 0, y: 0 });
    fx.update(10);
    assert.equal(em.elapsed, 10);
    em.moveTo(50, 60);
    assert.equal(em.burst(3), 3);
    const latest = fx.snapshot().slice(-3);
    assert.ok(latest.every((p) => p.x === 50 && p.y === 60));
    em.stop();
    assert.equal(em.emitting, false);
    const n = fx.particleCount;
    fx.update(100);
    assert.equal(fx.particleCount, n, 'stopped emitter spawns nothing, particles live on');
    em.kill();
    assert.equal(fx.particleCount, 0);
    assert.equal(em.done, true);
    assert.throws(() => em.burst(NaN), RangeError);
    assert.throws(() => em.burst(-1), RangeError);
    assert.throws(() => em.burst(Infinity), RangeError);
  });

  test('a burst emitter with nothing to emit is dropped on the next update', () => {
    const fx = createFX();
    fx.particles({});
    assert.equal(fx.emitterCount, 1);
    fx.update(1);
    assert.equal(fx.emitterCount, 0);
  });
});

describe('particles: motion', () => {
  test('speed/angle: 0 = right, 90 = down, 270 = up; distance equals speed * seconds', () => {
    const fx = createFX();
    probe(fx, { speed: 100, angle: 0 });
    probe(fx, { speed: 100, angle: 90 });
    probe(fx, { speed: 100, angle: 270 });
    run(fx, 1000, 16);
    const [r, d, u] = fx.snapshot();
    near(r.x, 200, 1e-6);
    near(r.y, 100, 1e-6);
    near(d.y, 200, 1e-6);
    near(u.y, 0, 1e-6);
  });

  test('vx/vy add to the angular velocity', () => {
    const fx = createFX();
    probe(fx, { vx: 10, vy: -20 });
    run(fx, 500, 10);
    const [p] = fx.snapshot();
    near(p.x, 105, 1e-6);
    near(p.y, 90, 1e-6);
  });

  test('gravity accelerates downward (semi-implicit Euler)', () => {
    const fx = createFX();
    probe(fx, { gravity: 100 });
    run(fx, 1000, 10);
    const [p] = fx.snapshot();
    assert.ok(p.y > 149 && p.y < 152, `y=${p.y}`); // 0.5*g*t^2 = 50 plus a half step of bias
  });

  test('drag damps velocity', () => {
    const fx = createFX();
    probe(fx, { speed: 100, angle: 0, drag: 2 });
    run(fx, 1000, 10);
    const [p] = fx.snapshot();
    assert.ok(p.x > 100 && p.x < 160, `x=${p.x}`);
  });

  test('wind only moves particles that listen to it', () => {
    const fx = createFX();
    probe(fx, { wind: 1 });
    probe(fx, { wind: 0 });
    fx.setWind(50, 0);
    assert.deepEqual(fx.wind(), { x: 50, y: 0 });
    run(fx, 1000, 10);
    const [a, b] = fx.snapshot();
    assert.ok(a.x > 120, `windy x=${a.x}`);
    assert.equal(b.x, 100);
    assert.throws(() => fx.setWind(NaN, 0), TypeError);
  });

  test("floor: 'origin' kills a drop when it falls back past its spawn height", () => {
    const fx = createFX();
    probe(fx, { speed: 100, angle: 270, gravity: 500, floor: 'origin' });
    run(fx, 300, 10);
    assert.equal(fx.particleCount, 1, 'still airborne');
    run(fx, 1000, 10);
    assert.equal(fx.particleCount, 0, 'landed');
    probe(fx, { gravity: 100, floor: 120 });
    run(fx, 2000, 10);
    assert.equal(fx.particleCount, 0, 'numeric floor');
  });

  test('screen-space particles are culled past the margin; world-space ones are not', () => {
    const fx = createFX();
    probe(fx, { space: 'screen', vx: 1000 });
    probe(fx, { space: 'screen', vx: 1000, cull: false });
    probe(fx, { space: 'world', vx: 1000 });
    run(fx, 1000, 10);
    const snap = fx.snapshot();
    assert.equal(snap.length, 2);
    assert.ok(snap.every((p) => p.x > 1000));
    assert.equal(fx.particleCount, 2);
  });

  test('colour ramp, fade curves and sizeEnd evolve over the lifetime', () => {
    const fx = createFX();
    fx.particles({ count: 1, life: 1000, ramp: ['#000', '#fff'], fade: 'out', size: 4, sizeEnd: 0 });
    fx.particles({ count: 1, life: 1000, fade: 'in', colors: '#123' });
    fx.particles({ count: 1, life: 1000, fade: 'none', alpha: 0.5 });
    let [a, b, c] = fx.snapshot();
    assert.equal(a.color, '#000');
    assert.equal(a.alpha, 1);
    assert.equal(a.size, 4);
    assert.equal(b.alpha, 0);
    assert.equal(c.alpha, 0.5);
    run(fx, 500, 50); // several updates: the particle sim clamps each step to maxDt (100ms)
    [a, b, c] = fx.snapshot();
    assert.equal(a.color, '#fff');
    assert.equal(a.alpha, 0.5);
    assert.equal(a.size, 2);
    assert.equal(b.alpha, 0.5);
    assert.equal(b.color, '#123');
    assert.equal(c.alpha, 0.5);
  });

  test('snapshot returns copies', () => {
    const fx = createFX();
    probe(fx);
    const s = fx.snapshot();
    s[0].x = -1;
    assert.equal(fx.snapshot()[0].x, 100);
  });
});

// ---------------------------------------------------------------------------
// update(dt) edge cases
// ---------------------------------------------------------------------------

describe('update(dt)', () => {
  test('rejects NaN, undefined, strings and infinities', () => {
    const fx = createFX();
    probe(fx);
    for (const bad of [NaN, undefined, null, '16', Infinity, -Infinity, {}]) {
      assert.throws(() => fx.update(bad), TypeError, `dt=${String(bad)}`);
    }
    assert.equal(fx.particleCount, 1);
  });

  test('zero and negative dt change nothing', () => {
    const fx = createFX();
    fx.particles('sparkles', { x: 50, y: 50 });
    fx.shake(4, 300);
    fx.flash('#fff', 200);
    const before = JSON.stringify([fx.snapshot(), fx.cameraOffset(), fx.stats()]);
    fx.update(0);
    fx.update(-16);
    fx.update(-1e9);
    assert.equal(JSON.stringify([fx.snapshot(), fx.cameraOffset(), fx.stats()]), before);
  });

  test('a large dt is clamped to maxDt for the particle simulation (no tunnelling, no spawn explosion)', () => {
    const fx = createFX({ maxDt: 100 });
    probe(fx, { speed: 100, angle: 0 });
    fx.particles({ rate: 100, life: 1e9 });
    fx.update(10000);
    const [p] = fx.snapshot();
    near(p.x, 110, 1e-6, 'moved 100ms worth');
    assert.equal(fx.particleCount, 1 + 10, 'emitted 100ms worth');
  });

  test('a large dt still ends shakes and flashes (envelopes follow real time, like tweens)', () => {
    const fx = createFX();
    fx.shake(8, 300);
    fx.flash('#fff', 200);
    fx.update(10000);
    assert.deepEqual(fx.cameraOffset(), { x: 0, y: 0 });
    assert.equal(fx.shakeStrength(), 0);
    assert.equal(fx.stats().shakes, 0);
    assert.equal(fx.stats().flashes, 0);
  });

  test('many tiny steps and one equal step reach the same place for constant-velocity motion', () => {
    const a = createFX();
    const b = createFX();
    probe(a, { speed: 60, angle: 0 });
    probe(b, { speed: 60, angle: 0 });
    for (let i = 0; i < 100; i++) a.update(1);
    b.update(100);
    near(a.snapshot()[0].x, b.snapshot()[0].x, 1e-9);
  });

  test('long runs stay finite and bounded', () => {
    const fx = createFX();
    for (const name of CONTRACT_PRESETS) fx.particles(name, { x: 240, y: 135 });
    fx.setWind(20, -5);
    for (let i = 0; i < 2000; i++) {
      fx.update(16);
      if (i % 100 === 0) fx.shake(3, 200);
    }
    assert.ok(fx.particleCount <= 2000);
    for (const p of fx.snapshot()) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    const o = fx.cameraOffset();
    assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y));
  });
});

// ---------------------------------------------------------------------------
// Shake
// ---------------------------------------------------------------------------

describe('shake', () => {
  test('starts at full strength, decays monotonically, ends after ms with a zero offset', () => {
    const fx = createFX();
    fx.shake(4, 300);
    assert.equal(fx.shakeStrength(), 4);
    assert.equal(fx.stats().shakes, 1);
    let prev = 4;
    let moved = false;
    for (let t = 0; t < 300; t += 10) {
      fx.update(10);
      const s = fx.shakeStrength();
      assert.ok(s <= prev + 1e-12, `strength rose ${prev} -> ${s} at ${t + 10}ms`);
      prev = s;
      const o = fx.cameraOffset();
      assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y), 'integer offsets');
      assert.ok(Math.abs(o.x) <= 4 && Math.abs(o.y) <= 4, `offset ${o.x},${o.y} exceeds amount`);
      if (o.x !== 0 || o.y !== 0) moved = true;
    }
    assert.ok(moved, 'the camera never moved');
    assert.equal(fx.shakeStrength(), 0);
    assert.deepEqual(fx.cameraOffset(), { x: 0, y: 0 });
    assert.equal(fx.stats().shakes, 0);
  });

  test('default decay is quadratic: half-time strength is a quarter', () => {
    const fx = createFX();
    fx.shake(8, 400);
    fx.update(200);
    near(fx.shakeStrength(), 2, 1e-9);
    const lin = createFX();
    lin.shake(8, 400, { decay: 1 });
    lin.update(200);
    near(lin.shakeStrength(), 4, 1e-9);
    const flat = createFX();
    flat.shake(8, 400, { decay: 0 });
    flat.update(399);
    near(flat.shakeStrength(), 8, 1e-9);
  });

  test('shakes stack and each ends on its own schedule', () => {
    const fx = createFX();
    fx.shake(2, 100);
    fx.shake(3, 1000);
    assert.equal(fx.shakeStrength(), 5);
    fx.update(100);
    assert.equal(fx.stats().shakes, 1);
    assert.ok(fx.shakeStrength() < 3 && fx.shakeStrength() > 0);
  });

  test('axis restricts the offset to one direction', () => {
    const fx = createFX();
    fx.shake(10, 500, { axis: 'x' });
    let movedX = false;
    for (let i = 0; i < 40; i++) {
      fx.update(10);
      const o = fx.cameraOffset();
      assert.equal(o.y, 0);
      if (o.x !== 0) movedX = true;
    }
    assert.ok(movedX);
    const fy = createFX();
    fy.shake(10, 500, { axis: 'y' });
    for (let i = 0; i < 40; i++) {
      fy.update(10);
      assert.equal(fy.cameraOffset().x, 0);
    }
  });

  test('zero / negative amount or duration is a no-op; bad input throws', () => {
    const fx = createFX();
    fx.shake(0, 100);
    fx.shake(-5, 100);
    fx.shake(5, 0);
    fx.shake(5, -1);
    assert.equal(fx.stats().shakes, 0);
    assert.throws(() => fx.shake(NaN, 100), TypeError);
    assert.throws(() => fx.shake(5, NaN), TypeError);
    assert.throws(() => fx.shake(5, Infinity), TypeError);
    assert.throws(() => fx.shake('5', 100), TypeError);
    assert.throws(() => fx.shake(5, 100, { axis: 'z' }), TypeError);
    assert.throws(() => fx.shake(5, 100, { freq: NaN }), TypeError);
    assert.throws(() => fx.shake(5, 100, null), TypeError);
    assert.throws(() => fx.shake(), TypeError);
  });

  test('shake is deterministic and independent of the particle stream', () => {
    const trace = (withParticles) => {
      const fx = createFX({ seed: 'same' });
      if (withParticles) fx.particles('confetti', { x: 100, y: 100 });
      fx.shake(6, 400);
      const out = [];
      for (let i = 0; i < 30; i++) {
        fx.update(13);
        if (withParticles && i === 10) fx.particles('sparkles');
        out.push(fx.cameraOffset());
      }
      return out;
    };
    assert.deepEqual(trace(false), trace(true));
  });

  test('rapid repeated shakes do not accumulate forever', () => {
    const fx = createFX();
    for (let i = 0; i < 1000; i++) fx.shake(1, 50);
    assert.equal(fx.stats().shakes, 1000);
    assert.equal(fx.shakeStrength(), 1000);
    run(fx, 60, 10);
    assert.equal(fx.stats().shakes, 0);
    assert.deepEqual(fx.cameraOffset(), { x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// Flash
// ---------------------------------------------------------------------------

describe('flash', () => {
  test('fades from alpha to 0 over ms and is then dropped', () => {
    const fx = createFX();
    const fl = fx.flash('#ffffff', 200);
    assert.ok(fl instanceof Flash);
    assert.equal(fl.alpha, 0.85);
    assert.equal(fl.color, '#ffffff');
    fx.update(100);
    assert.ok(fl.alpha > 0 && fl.alpha < 0.85, `mid alpha ${fl.alpha}`);
    assert.equal(fl.done, false);
    fx.update(100);
    assert.equal(fl.alpha, 0);
    assert.equal(fl.done, true);
    assert.equal(fx.stats().flashes, 0);
  });

  test('alpha, ease and hold options', () => {
    const fx = createFX();
    const fl = fx.flash('#f00', 100, { alpha: 0.5, ease: 'linear', hold: 100 });
    fx.update(50);
    assert.equal(fl.alpha, 0.5, 'holding');
    fx.update(50);
    assert.equal(fl.alpha, 0.5, 'hold just ended');
    fx.update(50);
    near(fl.alpha, 0.25, 1e-12);
    fx.update(50);
    assert.equal(fl.done, true);
    const capped = fx.flash('#f00', 100, { alpha: 5 });
    assert.equal(capped.alpha, 1);
  });

  test('a zero-length flash is done immediately; cancel() removes one early', () => {
    const fx = createFX();
    const z = fx.flash('#fff', 0);
    assert.equal(z.done, true);
    assert.equal(fx.stats().flashes, 0);
    const held = fx.flash('#fff', 0, { hold: 50 });
    assert.equal(held.done, false);
    assert.equal(held.alpha, 0.85);
    const fl = fx.flash('#fff', 1000);
    fl.cancel();
    assert.equal(fl.alpha, 0);
    assert.equal(fl.done, true);
    fx.update(1);
    assert.equal(fx.stats().flashes, 1, 'only the held one remains');
  });

  test('bad input throws', () => {
    const fx = createFX();
    assert.throws(() => fx.flash('', 100), TypeError);
    assert.throws(() => fx.flash(null, 100), TypeError);
    assert.throws(() => fx.flash('#fff', NaN), RangeError);
    assert.throws(() => fx.flash('#fff', -1), RangeError);
    assert.throws(() => fx.flash('#fff', Infinity), RangeError);
    assert.throws(() => fx.flash('#fff', 100, { alpha: -1 }), RangeError);
    assert.throws(() => fx.flash('#fff', 100, { ease: 'nope' }), TypeError);
    assert.throws(() => fx.flash('#fff', 100, null), TypeError);
    assert.throws(() => fx.flash('#fff'), RangeError);
  });

  test('rapid repeated flashes are all tracked and all expire', () => {
    const fx = createFX();
    for (let i = 0; i < 500; i++) fx.flash('#fff', 10 + (i % 5));
    assert.equal(fx.stats().flashes, 500);
    fx.update(15);
    assert.equal(fx.stats().flashes, 0);
  });
});

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

describe('draw', () => {
  test('draws every live particle as integer-aligned rects and restores ctx state', () => {
    const fx = createFX();
    for (const name of CONTRACT_PRESETS) fx.particles(name, { x: 240, y: 135 });
    run(fx, 500);
    const ctx = fakeCtx();
    ctx.fillStyle = '#123456';
    ctx.globalAlpha = 0.5;
    fx.draw(ctx);
    assert.ok(ctx.rects.length >= fx.particleCount * 0.5, `${ctx.rects.length} rects for ${fx.particleCount} particles`);
    for (const r of ctx.rects) {
      assert.ok(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.w) && Number.isInteger(r.h), JSON.stringify(r));
      assert.ok(r.w >= 1 && r.h >= 1);
      assert.ok(r.alpha > 0 && r.alpha <= 1);
      assert.equal(typeof r.fill, 'string');
    }
    assert.equal(ctx.depth, 0);
    assert.equal(ctx.fillStyle, '#123456');
    assert.equal(ctx.globalAlpha, 0.5);
    assert.equal(ctx.globalCompositeOperation, 'source-over');
  });

  test('every shape rasterises at several sizes without non-integer output', () => {
    for (const shape of ['pixel', 'rect', 'circle', 'ring', 'spark', 'line']) {
      for (const size of [0, 0.4, 1, 2, 3, 5, 9]) {
        const fx = createFX();
        fx.particles({ count: 1, life: 1e9, shape, size, x: 100.4, y: 50.6, vx: 10, vy: -3, tumble: 1 });
        const ctx = fakeCtx();
        fx.draw(ctx);
        assert.ok(ctx.rects.length >= 1, `${shape}@${size} drew nothing`);
        for (const r of ctx.rects) {
          assert.ok([r.x, r.y, r.w, r.h].every(Number.isInteger), `${shape}@${size}: ${JSON.stringify(r)}`);
        }
      }
    }
  });

  test('layer filtering and camera offsets', () => {
    const fx = createFX();
    fx.particles({ count: 1, life: 1e9, layer: 'back', x: 100, y: 100, fade: 'none' });
    fx.particles({ count: 1, life: 1e9, layer: 'front', x: 200, y: 50, fade: 'none' });
    fx.particles({ count: 1, life: 1e9, layer: 'front', space: 'screen', x: 300, y: 60, fade: 'none' });
    const back = fakeCtx();
    fx.draw(back, { layer: 'back', camera: { x: 10, y: 5 } });
    assert.deepEqual(back.rects.map((r) => [r.x, r.y]), [[90, 95]]);
    const front = fakeCtx();
    fx.draw(front, { layer: 'front', camera: { x: 10, y: 5 } });
    assert.deepEqual(front.rects.map((r) => [r.x, r.y]), [[190, 45], [300, 60]]);
    const all = fakeCtx();
    fx.draw(all);
    assert.equal(all.rects.length, 3);
  });

  test('flashes cover the whole screen, on the front pass only, with the flash colour and alpha', () => {
    const fx = createFX();
    fx.flash('#ff00ff', 100, { alpha: 0.6 });
    const back = fakeCtx();
    fx.draw(back, { layer: 'back' });
    assert.equal(back.rects.length, 0);
    const front = fakeCtx();
    fx.draw(front, { layer: 'front' });
    assert.equal(front.rects.length, 1);
    const r = front.rects[0];
    assert.ok(r.x <= 0 && r.y <= 0 && r.x + r.w >= W && r.y + r.h >= H);
    assert.equal(r.fill, '#ff00ff');
    assert.equal(r.alpha, 0.6);
    assert.equal(r.op, 'source-over');
    assert.equal(front.depth, 0);
  });

  test('blend modes are applied per particle', () => {
    const fx = createFX();
    fx.particles({ count: 1, life: 1e9, blend: 'lighter', fade: 'none' });
    fx.particles({ count: 1, life: 1e9, blend: 'source-over', fade: 'none' });
    const ctx = fakeCtx();
    fx.draw(ctx);
    assert.deepEqual(ctx.rects.map((r) => r.op), ['lighter', 'source-over']);
  });

  test('invisible particles are skipped; bad ctx or layer throws', () => {
    const fx = createFX();
    fx.particles({ count: 3, life: 1e9, alpha: 0 });
    const ctx = fakeCtx();
    fx.draw(ctx);
    assert.equal(ctx.rects.length, 0);
    assert.throws(() => fx.draw(null), TypeError);
    assert.throws(() => fx.draw({}), TypeError);
    assert.throws(() => fx.draw(ctx, { layer: 'middle' }), TypeError);
    assert.throws(() => fx.draw(ctx, null), TypeError);
  });

  test('draw does not advance the simulation', () => {
    const fx = createFX();
    fx.particles('sparkles');
    fx.shake(4, 100);
    const before = JSON.stringify([fx.snapshot(), fx.cameraOffset()]);
    fx.draw(fakeCtx());
    fx.draw(fakeCtx());
    assert.equal(JSON.stringify([fx.snapshot(), fx.cameraOffset()]), before);
  });
});

// ---------------------------------------------------------------------------
// Determinism, rng injection, clear, validation
// ---------------------------------------------------------------------------

describe('determinism and rng', () => {
  const script = (fx) => {
    const out = [];
    fx.particles('confetti', { x: 240, y: 100 });
    fx.particles('fireflies', { x: 50, y: 50 });
    fx.shake(5, 300);
    for (let i = 0; i < 60; i++) {
      fx.update(16);
      if (i === 20) fx.particles('splash', { x: 10, y: 200 });
      if (i % 15 === 0) out.push(fx.snapshot(), fx.cameraOffset());
    }
    return JSON.stringify(out);
  };

  test('same seed -> identical snapshots; different seeds differ', () => {
    assert.equal(script(createFX({ seed: 'a' })), script(createFX({ seed: 'a' })));
    assert.equal(script(createFX()), script(createFX()));
    assert.notEqual(script(createFX({ seed: 'a' })), script(createFX({ seed: 'b' })));
    assert.notEqual(script(createFX({ seed: 1 })), script(createFX({ seed: '1' })));
  });

  test('an injected rng or random function drives all particle randomness', () => {
    const mk = () => {
      let i = 0;
      return { next: () => ((i++ * 7919) % 1000) / 1000 };
    };
    assert.equal(script(createFX({ rng: mk() })), script(createFX({ rng: mk() })));
    let j = 0;
    const random = () => ((j++ * 104729) % 1000) / 1000;
    const viaFn = script(createFX({ random }));
    j = 0;
    assert.equal(viaFn, script(createFX({ random })));
    assert.notEqual(viaFn, script(createFX({ rng: mk() })));
  });

  test('a degenerate random source (always 0 or ~1) still yields finite particles', () => {
    for (const r of [() => 0, () => 0.9999999]) {
      const fx = createFX({ random: r });
      for (const name of CONTRACT_PRESETS) fx.particles(name);
      run(fx, 500);
      for (const p of fx.snapshot()) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.size >= 0, JSON.stringify(p));
        assert.equal(typeof p.color, 'string');
      }
      fx.draw(fakeCtx());
    }
  });
});

describe('clear and validation', () => {
  test('clear() removes everything and stops emitters; the system stays usable', () => {
    const fx = createFX();
    const em = fx.particles('fireflies', { x: 10, y: 10 });
    fx.particles('sparkles');
    fx.shake(5, 1000);
    fx.flash('#fff', 1000);
    run(fx, 200);
    fx.clear();
    assert.deepEqual(fx.cameraOffset(), { x: 0, y: 0 });
    assert.equal(fx.shakeStrength(), 0);
    const s = fx.stats();
    assert.equal(s.particles + s.emitters + s.shakes + s.flashes, 0);
    assert.ok(s.pooled > 0);
    assert.equal(em.emitting, false);
    assert.equal(em.done, true);
    run(fx, 500);
    assert.equal(fx.particleCount, 0);
    fx.particles('dust');
    assert.equal(fx.particleCount, 6);
  });

  test('malformed specs throw with clear messages and leave no state behind', () => {
    const fx = createFX();
    const bad = [
      [() => fx.particles('nope'), /unknown preset "nope"/],
      [() => fx.particles({ preset: 5 }), /unknown preset/],
      [() => fx.particles({ bogus: 1 }), /unknown spec field "bogus"/],
      [() => fx.particles(null), TypeError],
      [() => fx.particles(['dust']), TypeError],
      [() => fx.particles('dust', []), TypeError],
      [() => fx.particles('dust', 'x'), TypeError],
      [() => fx.particles({ life: 0 }), RangeError],
      [() => fx.particles({ life: -5 }), RangeError],
      [() => fx.particles({ life: [1, 2, 3] }), TypeError],
      [() => fx.particles({ life: NaN }), TypeError],
      [() => fx.particles({ life: Infinity }), RangeError],
      [() => fx.particles({ count: 1.5 }), RangeError],
      [() => fx.particles({ count: -1 }), RangeError],
      [() => fx.particles({ rate: -1 }), RangeError],
      [() => fx.particles({ rate: '5' }), TypeError],
      [() => fx.particles({ duration: -1 }), RangeError],
      [() => fx.particles({ alpha: 2 }), RangeError],
      [() => fx.particles({ alpha: [0, 1.5] }), RangeError],
      [() => fx.particles({ size: -1 }), RangeError],
      [() => fx.particles({ colors: [] }), TypeError],
      [() => fx.particles({ colors: [''] }), TypeError],
      [() => fx.particles({ colors: 7 }), TypeError],
      [() => fx.particles({ ramp: ['#fff', 3] }), TypeError],
      [() => fx.particles({ shape: 'blob' }), TypeError],
      [() => fx.particles({ layer: 'mid' }), TypeError],
      [() => fx.particles({ space: 'cam' }), TypeError],
      [() => fx.particles({ fade: 'pulse' }), TypeError],
      [() => fx.particles({ floor: 'ceiling' }), TypeError],
      [() => fx.particles({ wobble: 3 }), TypeError],
      [() => fx.particles({ wobble: { amp: -1 } }), RangeError],
      [() => fx.particles({ blend: '' }), TypeError],
      [() => fx.particles({ cull: 'yes' }), TypeError],
      [() => fx.particles({ w: -1 }), RangeError],
      [() => fx.particles({ x: NaN }), TypeError],
      [() => fx.particles({ gravity: Infinity }), RangeError],
    ];
    for (const [fn, expected] of bad) assert.throws(fn, expected);
    assert.equal(fx.particleCount, 0);
    assert.equal(fx.emitterCount, 0);
    const custom = createFX({ presets: { broken: { nope: 1 } } });
    assert.throws(() => custom.particles('broken'), /unknown field "nope"/);
  });

  test('ranges may be given reversed and undefined fields fall back', () => {
    const fx = createFX();
    const em = fx.particles({ count: 1, life: [500, 100], size: undefined, colors: undefined });
    assert.deepEqual(em.spec.life, [100, 500]);
    assert.deepEqual(em.spec.size, [1, 1]);
    assert.deepEqual([...em.spec.colors], ['#ffffff']);
    assert.equal(em.spec.duration, 0);
    const cont = fx.particles({ rate: 1 });
    assert.equal(cont.spec.duration, Infinity);
  });

  test('a preset field can be nulled out by an override', () => {
    const fx = createFX();
    const em = fx.particles('fireflies', { wobble: null, sizeEnd: null });
    assert.equal(em.spec.wobbleAmp, null);
    fx.update(16);
    fx.draw(fakeCtx());
  });
});

// Unit tests for js/world/camera.js. Run: node --test test/world.camera.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, clampAxis, CAMERA_TICK_MS, DEFAULT_LERP } from '../js/world/camera.js';
import { loadMap } from '../js/world/tilemap.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';
import harborDef from './fixtures/world/harbor.fixture.js';

const TICK = CAMERA_TICK_MS;
/** A 60x40 tile map (960x640 px) so the 480x270 view has room to move. */
const bigDef = {
  id: 'big', name: 'Big', kind: 'exterior', region: 'r', w: 60, h: 40,
  ground: Array.from({ length: 40 }, () => 'G'.repeat(60)),
  entry: { x: 0, y: 0 }, entities: [], triggers: [], warps: [], spawns: [],
  regions: { yard: { x: 10, y: 10, w: 40, h: 20 }, tiny: { x: 5, y: 5, w: 4, h: 4 } },
};
const big = loadMap(bigDef, TILES, { legend: DEFAULT_LEGEND });
const harbor = loadMap(harborDef, TILES, { legend: DEFAULT_LEGEND });
const settle = (cam, n = 600) => { for (let i = 0; i < n; i++) cam.update(TICK); };

describe('createCamera', () => {
  it('defaults to the native frame and validates options', () => {
    const cam = createCamera();
    assert.equal(cam.viewW, 480);
    assert.equal(cam.viewH, 270);
    assert.equal(cam.tile, 16);
    assert.equal(cam.x, 0);
    assert.equal(cam.y, 0);
    assert.equal(cam.limits, null);
    assert.equal(cam.target, null);
    assert.throws(() => createCamera({ viewW: 0 }), TypeError);
    assert.throws(() => createCamera({ tile: 1.5 }), TypeError);
    assert.throws(() => createCamera({ viewH: -1 }), TypeError);
    assert.equal(DEFAULT_LERP > 0 && DEFAULT_LERP < 1, true);
  });

  it('follow with snap centres on the target (px/py or tile x/y) and snaps to whole pixels', () => {
    const cam = createCamera({ viewW: 480, viewH: 270, tile: 16 });
    cam.follow({ px: 400, py: 300 }, { snap: true });
    assert.equal(cam.x, 400 + 8 - 240);
    assert.equal(cam.y, 300 + 8 - 135);
    cam.follow({ x: 10, y: 5 }, { snap: true });
    assert.equal(cam.x, 160 + 8 - 240);
    assert.equal(cam.y, 80 + 8 - 135);
    cam.follow({ px: 100.4, py: 50.6 }, { snap: true });
    assert.equal(Number.isInteger(cam.x), true);
    assert.equal(Number.isInteger(cam.y), true);
    assert.equal(cam.x, Math.round(100.4 + 8 - 240));
    assert.equal(cam.rawX, 100.4 + 8 - 240, 'raw position keeps the fraction');
    assert.throws(() => cam.follow({ px: 0, py: 0 }, { lerp: 0 }), TypeError);
    assert.throws(() => cam.follow({ px: 0, py: 0 }, { lerp: 2 }), TypeError);
  });

  it('eases toward a moving target, frame-rate independent, and settles exactly', () => {
    const cam = createCamera();
    const target = { px: 0, py: 0 };
    cam.follow(target, { snap: true, lerp: 0.2 });
    target.px = 320;
    cam.update(TICK);
    const afterOne = cam.rawX;
    assert.ok(afterOne > -240 && afterOne < 80, 'moved part of the way');
    assert.ok(Math.abs(afterOne - (-240 + 320 * 0.2)) < 1e-9, 'one tick moves lerp of the gap');
    // two half ticks equal one full tick
    const cam2 = createCamera();
    const t2 = { px: 0, py: 0 };
    cam2.follow(t2, { snap: true, lerp: 0.2 });
    t2.px = 320;
    cam2.update(TICK / 2);
    cam2.update(TICK / 2);
    assert.ok(Math.abs(cam2.rawX - afterOne) < 1e-9, 'frame-rate independent');
    settle(cam);
    assert.equal(cam.rawX, 80, 'settles exactly on the target');
    assert.equal(cam.x, 80);
    // lerp 1 is instant
    const cam3 = createCamera();
    cam3.follow({ px: 1000, py: 1000 }, { lerp: 1 });
    cam3.update(TICK);
    assert.equal(cam3.x, 1000 + 8 - 240);
    assert.throws(() => cam.update(-1), TypeError);
    assert.throws(() => cam.update(NaN), TypeError);
  });

  it('is deterministic: the same inputs give the same positions', () => {
    const run = () => {
      const cam = createCamera();
      const t = { px: 0, py: 0 };
      cam.follow(t, { snap: true });
      const out = [];
      for (let i = 0; i < 100; i++) {
        t.px += 3;
        t.py += (i % 7) - 3;
        if (i === 20) cam.shake(6, 300);
        cam.update(TICK);
        out.push(cam.x, cam.y);
      }
      return out;
    };
    assert.deepEqual(run(), run());
  });
});

describe('bounds and clamping', () => {
  it('clamps to the map and the view never leaves it', () => {
    const cam = createCamera();
    cam.bounds(big);
    assert.deepEqual(cam.limits, { x: 0, y: 0, w: 960, h: 640 });
    const t = { px: -500, py: -500 };
    cam.follow(t, { snap: true });
    assert.equal(cam.x, 0);
    assert.equal(cam.y, 0);
    t.px = 5000;
    t.py = 5000;
    cam.snap();
    assert.equal(cam.x, 960 - 480);
    assert.equal(cam.y, 640 - 270);
    // easing through the middle stays clamped every step
    t.px = -500;
    t.py = -500;
    for (let i = 0; i < 200; i++) {
      cam.update(TICK);
      assert.ok(cam.x >= 0 && cam.x <= 480 && cam.y >= 0 && cam.y <= 370, `step ${i}: ${cam.x},${cam.y}`);
    }
    assert.equal(cam.x, 0);
    assert.equal(cam.y, 0);
  });

  it('centres a map smaller than the view (negative offset) instead of panning', () => {
    const cam = createCamera();
    cam.bounds(harbor); // 256 x 160 px
    cam.follow({ px: 100, py: 100 }, { snap: true });
    assert.equal(cam.x, -Math.floor((480 - 256) / 2));
    assert.equal(cam.y, -Math.floor((270 - 160) / 2));
    cam.follow({ px: 0, py: 0 }, { snap: true });
    assert.equal(cam.x, -112);
    assert.equal(cam.y, -55);
    assert.equal(clampAxis(123, 0, 100, 480), -190);
    assert.equal(clampAxis(-5, 0, 1000, 480), 0);
    assert.equal(clampAxis(700, 0, 1000, 480), 520);
    assert.equal(clampAxis(300, 0, 1000, 480), 300);
  });

  it('clamps to a named region or a rect, and rejects unknown regions', () => {
    const cam = createCamera();
    cam.bounds(big, 'yard'); // 160,160 .. 800,480 px
    cam.follow({ px: 0, py: 0 }, { snap: true });
    assert.equal(cam.x, 160);
    assert.equal(cam.y, 160);
    cam.follow({ px: 5000, py: 5000 }, { snap: true });
    assert.equal(cam.x, 800 - 480);
    assert.equal(cam.y, 480 - 270);
    cam.bounds(big, { x: 0, y: 0, w: 60, h: 40 });
    cam.snap();
    assert.equal(cam.x, 480);
    cam.bounds(big, 'tiny'); // 64x64 px: smaller than the view, centred on the region
    assert.equal(cam.x, 80 - Math.floor((480 - 64) / 2));
    assert.throws(() => cam.bounds(big, 'attic'), /no region 'attic'/);
    assert.throws(() => cam.bounds({}), TypeError);
    cam.setLimits(null);
    cam.follow({ px: -1000, py: -1000 }, { snap: true });
    assert.equal(cam.x, -1000 + 8 - 240, 'unbounded again');
  });
});

describe('visibleTiles, conversions, visibility', () => {
  it('returns a reused rect covering the view, clamped to the map', () => {
    const cam = createCamera();
    cam.bounds(big);
    cam.follow({ px: 0, py: 0 }, { snap: true });
    const r = cam.visibleTiles();
    assert.deepEqual(r, { x: 0, y: 0, w: 30, h: 17 }, '480/16 = 30 columns, 270/16 = 16.9 -> 17 rows');
    cam.follow({ px: 300, py: 200 }, { snap: true });
    const r2 = cam.visibleTiles();
    assert.equal(r2, r, 'same object');
    assert.equal(cam.x, 68);
    assert.equal(cam.y, 73);
    assert.deepEqual(r2, { x: 4, y: 4, w: 31, h: 18 }, 'partial edge tiles on both sides');
    cam.follow({ px: 10000, py: 10000 }, { snap: true });
    assert.deepEqual(cam.visibleTiles(), { x: 30, y: 23, w: 30, h: 17 });
    // small map: clamped to the map even though the view is wider
    const small = createCamera();
    small.bounds(harbor);
    small.follow({ px: 0, py: 0 }, { snap: true });
    assert.deepEqual(small.visibleTiles(), { x: 0, y: 0, w: 16, h: 10 });
    // unbounded camera: raw tile rect, may be negative
    const free = createCamera();
    free.lookAt(0, 0, { snap: true });
    assert.deepEqual(free.visibleTiles(), { x: -15, y: -9, w: 30, h: 17 });
  });

  it('worldToScreen / screenToWorld / screenToTile round trip and reuse their point', () => {
    const cam = createCamera();
    cam.bounds(big);
    cam.follow({ px: 300, py: 200 }, { snap: true });
    const p = cam.worldToScreen(300, 200);
    assert.deepEqual(p, { x: 232, y: 127 });
    assert.equal(cam.toScreen(300, 200), p, 'toScreen alias shares the point');
    const w = cam.screenToWorld(232, 127);
    assert.deepEqual(w, { x: 300, y: 200 });
    assert.equal(w, p, 'reused');
    const out = { x: 0, y: 0 };
    assert.equal(cam.worldToScreen(0, 0, out), out);
    assert.deepEqual(out, { x: -68, y: -73 });
    assert.deepEqual(cam.screenToTile(232, 127), { x: 18, y: 12 });
    assert.deepEqual(cam.screenToTile(0, 0), { x: 4, y: 4 });
    assert.deepEqual(cam.center(), { x: 68 + 240, y: 73 + 135 });
    assert.equal(cam.center(), cam.center());
    assert.equal(cam.isVisible(300, 200), true);
    assert.equal(cam.isVisible(60, 200), false);
    assert.equal(cam.isVisible(60, 200, 16), true, 'margin');
    assert.equal(cam.isVisible(68 + 480, 200), false, 'right edge is exclusive');
    assert.equal(cam.isVisible(68 + 479, 200), true);
  });

  it('lookAt pans a cutscene camera without a target', () => {
    const cam = createCamera();
    cam.bounds(big);
    cam.follow({ px: 0, py: 0 }, { snap: true });
    cam.lookAt(500, 400, { lerp: 0.5 });
    assert.equal(cam.target, null);
    settle(cam);
    assert.equal(cam.x, 500 - 240);
    assert.equal(cam.y, 400 - 135);
    cam.lookAt(0, 0, { snap: true });
    assert.equal(cam.x, 0);
    assert.throws(() => cam.lookAt(NaN, 0), TypeError);
  });
});

describe('shake', () => {
  it('offsets deterministically, decays to zero and respects reduced motion', () => {
    const cam = createCamera();
    cam.bounds(big);
    cam.follow({ px: 400, py: 300 }, { snap: true });
    const base = { x: cam.x, y: cam.y };
    cam.shake(6, 200);
    let moved = false;
    let maxDx = 0;
    for (let i = 0; i < 12; i++) {
      cam.update(TICK);
      const off = cam.shakeOffset();
      if (off.x !== 0 || off.y !== 0) moved = true;
      maxDx = Math.max(maxDx, Math.abs(off.x), Math.abs(off.y));
      assert.equal(cam.x, base.x + off.x);
      assert.equal(cam.y, base.y + off.y);
      assert.ok(Number.isInteger(off.x) && Number.isInteger(off.y));
    }
    assert.equal(moved, true);
    assert.ok(maxDx <= 6);
    assert.equal(cam.shakeOffset(), cam.shakeOffset(), 'reused');
    settle(cam, 30); // 500 ms > 200 ms
    assert.deepEqual(cam.shakeOffset(), { x: 0, y: 0 });
    assert.equal(cam.x, base.x);
    // a weaker shake during a strong one only extends it; a stronger one restarts
    cam.shake(8, 100);
    cam.update(TICK);
    cam.shake(2, 1000);
    cam.update(TICK);
    assert.ok(Math.abs(cam.shakeOffset().x) <= 8);
    cam.shake(10, 100);
    settle(cam, 5);
    // reduced motion: zero offsets while a shake is active
    const still = createCamera();
    still.bounds(big);
    still.follow({ px: 400, py: 300 }, { snap: true });
    still.setShakeEnabled(false);
    still.shake(10, 500);
    for (let i = 0; i < 10; i++) {
      still.update(TICK);
      assert.deepEqual(still.shakeOffset(), { x: 0, y: 0 });
      assert.equal(still.x, base.x);
    }
    assert.throws(() => cam.shake(-1, 100), TypeError);
    assert.throws(() => cam.shake(1, 0), TypeError);
  });

  it('two cameras shaken identically produce identical offsets (no randomness)', () => {
    const a = createCamera();
    const b = createCamera();
    for (const c of [a, b]) {
      c.lookAt(100, 100, { snap: true });
      c.shake(5, 400);
    }
    for (let i = 0; i < 40; i++) {
      a.update(TICK);
      b.update(TICK);
      assert.equal(a.x, b.x);
      assert.equal(a.y, b.y);
    }
  });
});

// Unit tests for js/render/lightPass.js: light selection caps and order, the beam's sweep timing, fog
// coverage cap, dither discs, firefly zones and the pool pass's composite order.
// Run: node --test test/render.lightPass.test.mjs
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeCanvas, createFakeCanvas } from './fixtures/render.fakeCanvas.mjs';
import {
  selectLights, beamAngle, fogCoverage, ditherDisc, tintDisc, fireflyZones, createLightPass, styleOf,
  MAX_LIGHTS, MAX_LIGHTS_LOW_POWER, BEAM_PERIOD_MS, BEAM_FIRST_SWEEP_MS, FOG_CAP, FOG_LAYERS, LIGHT_STYLE,
} from '../js/render/lightPass.js';
import { analyzeMap } from '../js/render/tileRenderer.js';
import { loadMap } from '../js/world/tilemap.js';
import { TILES, DEFAULT_LEGEND } from '../js/data/tilesets.js';
import { gradeFor } from '../js/world/lighting.js';
import { HARBOR_RENDER, EXTRA_TILES } from './fixtures/maps/harbor-render.js';

before(() => installFakeCanvas());

const view = { x: 0, y: 0, w: 480, h: 230 };
const L = (kind, px, py, intensity = 1, radius = 30) => ({ id: `${kind}@${px},${py}`, kind, x: 0, y: 0, px, py, radius, color: null, intensity });

describe('selectLights', () => {
  it('caps at 16 (8 in low power)', () => {
    const many = Array.from({ length: 60 }, (_, i) => L('lamp', (i % 15) * 32, Math.floor(i / 15) * 50));
    assert.equal(MAX_LIGHTS, 16);
    assert.equal(selectLights(many, view).length, 16);
    assert.equal(selectLights(many, view, { lowPower: true }).length, MAX_LIGHTS_LOW_POWER);
    assert.equal(selectLights(many, view, { max: 3 }).length, 3);
  });
  it('orders by class priority, then by distance to the view centre', () => {
    const lights = [L('window', 240, 115), L('bio', 240, 115), L('lamp', 10, 10), L('lamp', 230, 110), L('beam', 470, 220), L('lantern', 400, 100), L('fire', 100, 100)];
    const out = selectLights(lights, view).map((l) => l.kind + (l.kind === 'lamp' ? `@${l.px}` : ''));
    assert.deepEqual(out, ['beam', 'lantern', 'fire', 'lamp@230', 'lamp@10', 'window', 'bio']);
    for (let i = 1; i < out.length; i++) assert.ok(styleOf(out[i - 1].split('@')[0]).priority <= styleOf(out[i].split('@')[0]).priority);
  });
  it('drops pools that miss the view and lights with no intensity', () => {
    const lights = [L('lamp', -200, 50), L('lamp', 600, 50), L('lamp', 100, 500), L('lamp', 100, 100, 0), L('lamp', -20, 100, 1, 30)];
    const out = selectLights(lights, view);
    assert.equal(out.length, 1, 'only the pool reaching in from the left edge');
    assert.equal(out[0].px, -20);
  });
  it('reuses the out array (no allocation per frame)', () => {
    const out = [];
    const a = selectLights([L('lamp', 10, 10)], view, { out });
    assert.equal(a, out);
    selectLights([], view, { out });
    assert.equal(out.length, 0);
  });
  it('the most important lights survive the cap', () => {
    const lights = [...Array.from({ length: 30 }, (_, i) => L('bio', 200 + i, 100)), L('beam', 5, 5), L('lamp', 470, 225)];
    const out = selectLights(lights, view);
    assert.equal(out[0].kind, 'beam');
    assert.equal(out[1].kind, 'lamp');
    assert.equal(out.length, 16);
  });
});

describe('the beam', () => {
  it('sweeps once every 8 s', () => {
    assert.equal(BEAM_PERIOD_MS, 8000);
    assert.equal(beamAngle(0), 0);
    assert.ok(Math.abs(beamAngle(2000) - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(beamAngle(10000) - beamAngle(2000)) < 1e-9);
  });
  it('the first sweep after the Relighting takes 16 s', () => {
    assert.equal(BEAM_FIRST_SWEEP_MS, 16000);
    const start = 5000;
    assert.ok(Math.abs(beamAngle(start + 8000, start) - Math.PI) < 1e-9, 'half way round after 8 s');
    assert.ok(Math.abs(beamAngle(start + 16000 + 2000, start) - Math.PI / 2) < 1e-9, 'then the 8 s period');
    for (let t = 0; t < 40000; t += 777) {
      const a = beamAngle(t, start);
      assert.ok(a >= 0 && a < Math.PI * 2);
    }
  });
});

describe('weather caps', () => {
  it('fog layers union under 35%', () => {
    assert.equal(FOG_CAP, 0.35);
    assert.ok(fogCoverage() <= FOG_CAP, `coverage ${fogCoverage()}`);
    assert.ok(fogCoverage(FOG_LAYERS) > 0.2);
    assert.ok(fogCoverage([0.3, 0.2]) > FOG_CAP, 'the helper does detect an over-cap stack');
  });
});

describe('dither discs', () => {
  it('are cached, sized 2r+1 and ring-dithered (dense centre, sparse rim)', () => {
    const d = ditherDisc(20, 10, '#F9C46B', 0.3);
    assert.equal(ditherDisc(20, 10, '#F9C46B', 0.3), d, 'cached');
    assert.equal(d.canvas.width, 41);
    assert.equal(d.canvas.height, 21);
    const img = d.canvas.getContext('2d').calls.find((c) => c[0] === 'putImageData')[1];
    const on = (x, y) => img.data[(y * 41 + x) * 4 + 3] > 0;
    let centre = 0, rim = 0;
    for (let y = 8; y <= 12; y++) for (let x = 18; x <= 22; x++) centre += on(x, y) ? 1 : 0;
    for (let x = 0; x < 41; x++) rim += on(x, 10) && (x < 3 || x > 37) ? 1 : 0;
    assert.equal(centre, 25, 'solid core');
    assert.ok(rim <= 2, 'sparse rim');
    assert.ok(!on(0, 0) && !on(40, 20), 'transparent outside the ellipse');
  });
  it('the tint half never darkens past the light colour and is transparent outside', () => {
    const t = tintDisc(12, 6, '#F9C46B', 0.3);
    const img = t.canvas.getContext('2d').calls.find((c) => c[0] === 'putImageData')[1];
    const i = (6 * 25 + 12) * 4;
    assert.ok(img.data[i] >= 249 && img.data[i + 2] >= 107 && img.data[i + 2] < 255, 'warm tint at the centre');
    assert.equal(img.data[3], 0);
  });
});

describe('the pool pass', () => {
  it('draws a multiply tint pass then an additive pass, and restores source-over', () => {
    const pass = createLightPass();
    const canvas = createFakeCanvas(480, 270);
    const ctx = canvas.getContext('2d');
    const modes = [];
    const orig = ctx.drawImage;
    ctx.drawImage = function (...a) { modes.push(this.globalCompositeOperation); return orig.apply(this, a); };
    const grade = gradeFor(22 * 60, 'clear');
    const n = pass.drawPools(ctx, [L('lamp', 100, 100), L('porch', 200, 100)], { x: 0, y: 40, w: 480, h: 230 }, 0, 0, grade, 0);
    assert.equal(n, 2 + 2 + 2, 'tint + pool per light, plus a halo each');
    assert.deepEqual([...new Set(modes)], ['multiply', 'lighter']);
    assert.equal(modes.indexOf('lighter'), 2, 'every tint first');
    assert.equal(ctx.globalCompositeOperation, 'source-over');
  });
  it('every light kind has a style; magenta only for runes (skyglass)', () => {
    for (const [kind, st] of Object.entries(LIGHT_STYLE)) {
      assert.ok(st.pool.length === 4, kind);
      if (kind !== 'rune') assert.notEqual(st.color.toUpperCase(), '#FF5BD6', `${kind} must not use comet magenta`);
    }
  });
});

describe('firefly zones', () => {
  it('cluster over cover and flowers on the harbor fixture', () => {
    const map = loadMap(HARBOR_RENDER, { ...TILES, ...EXTRA_TILES }, { legend: DEFAULT_LEGEND });
    const zones = fireflyZones(analyzeMap(map));
    assert.ok(zones.length >= 3, `${zones.length} zones`);
    for (const z of zones) assert.ok(z.x >= 0 && z.y >= 0 && z.x < map.w * 16 && z.y < map.h * 16);
  });
});

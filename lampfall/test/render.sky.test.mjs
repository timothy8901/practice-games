// Unit tests for js/render/sky.js: Skyband geometry (band, horizon, tide dial), sun and moon arcs,
// moon phase, comet growth, the compass mark and the sky stops; plus a smoke draw of both views.
// Run: node --test test/render.sky.test.mjs
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeCanvas, createFakeCanvas } from './fixtures/render.fakeCanvas.mjs';
import {
  skyLayout, sunPos, moonPos, moonPhase, cometLayout, compassX, skyStops, drawSkyband, drawShoreView,
  SKYBAND_H, SKYBAND_SEA_H, TIDE_DIAL_RECT, SUNRISE, SUNSET,
} from '../js/render/sky.js';
import { gradeFor } from '../js/world/lighting.js';

before(() => installFakeCanvas());

const BAND = { x: 0, y: 0, w: 480, h: SKYBAND_H };

describe('Skyband geometry', () => {
  it('is the top 40 px: sky rows over a sea strip, horizon between', () => {
    assert.equal(SKYBAND_H, 40);
    const L = skyLayout(BAND);
    assert.equal(L.seaH, SKYBAND_SEA_H);
    assert.equal(L.skyRows + L.seaH, 40);
    assert.equal(L.horizonY, L.skyRows);
    assert.equal(L.seaY, L.horizonY);
  });
  it('puts the tide dial inside GDD-09\'s rect (408,8,64,24) and above the horizon', () => {
    const { dial, horizonY } = skyLayout(BAND);
    assert.deepEqual(TIDE_DIAL_RECT, { x: 408, y: 8, w: 64, h: 24 });
    assert.ok(dial.x >= 408 && dial.x + dial.w <= 408 + 64);
    assert.ok(dial.y >= 0 && dial.y + dial.h <= horizonY, 'the dial sits in the sky');
    const moved = skyLayout({ x: 10, y: 20, w: 480, h: 40 });
    assert.equal(moved.dial.x, dial.x + 10);
    assert.equal(moved.horizonY, horizonY + 20);
  });
  it('the sun rises at 06:00 on the left, peaks at midday and sets at 19:00 left of the dial', () => {
    const sky = { x: 0, y: 0, w: 480, h: skyLayout(BAND).skyRows };
    const rise = sunPos(SUNRISE, sky), noon = sunPos((SUNRISE + SUNSET) / 2, sky), set = sunPos(SUNSET, sky);
    assert.ok(rise.visible && noon.visible && set.visible);
    assert.ok(rise.x < noon.x && noon.x < set.x);
    assert.ok(noon.y < rise.y && noon.y < set.y, 'highest at midday');
    assert.ok(noon.y >= 0 && rise.y < sky.h, 'inside the band');
    assert.ok(set.x + 6 < TIDE_DIAL_RECT.x, 'never behind the tide dial');
    assert.ok(rise.low && set.low && !noon.low);
    assert.equal(sunPos(2 * 60, sky).visible, false);
    assert.equal(sunPos(12 * 60 + 1440, sky).x, sunPos(12 * 60, sky).x, 'wraps by day');
  });
  it('the moon rides the night arc right to left and hides by day', () => {
    const sky = { x: 0, y: 0, w: 480, h: 31 };
    const early = moonPos(SUNSET + 30, sky), mid = moonPos(0, sky), late = moonPos(SUNRISE - 30, sky);
    assert.ok(early.visible && mid.visible && late.visible);
    assert.ok(early.x > mid.x && mid.x > late.x);
    assert.equal(moonPos(12 * 60, sky).visible, false);
    for (const p of [early, mid, late]) assert.ok(p.x >= 0 && p.x + 6 < TIDE_DIAL_RECT.x && p.y >= 0 && p.y < 31);
  });
  it('moon phases cycle through 8 frames over 29.5 days', () => {
    assert.equal(moonPhase(0), 0);
    assert.equal(moonPhase(14.75), 4, 'full at half cycle');
    const seen = new Set();
    for (let d = 0; d < 30; d++) seen.add(moonPhase(d));
    assert.equal(seen.size, 8);
    assert.equal(moonPhase(-1), moonPhase(28.5));
  });
  it('the comet smudge grows, lengthens and brightens over the season', () => {
    const a = cometLayout(0.05, BAND), b = cometLayout(0.5, BAND), c = cometLayout(1, BAND);
    assert.deepEqual([a.stage, b.stage, c.stage], [0, 1, 2]);
    assert.ok(a.tail < b.tail && b.tail < c.tail);
    assert.ok(a.density < c.density && c.density <= 1);
    assert.ok(c.y >= 0 && c.y + 8 <= skyLayout(BAND).horizonY);
    assert.ok(c.x + 8 < TIDE_DIAL_RECT.x);
  });
  it('the lighthouse compass mark follows the bearing and stays in the band', () => {
    assert.equal(compassX(0, 480), 240);
    assert.ok(compassX(-10, 480) < 240);
    assert.ok(compassX(10, 480) > 240);
    assert.equal(compassX(-500, 480), 12);
    assert.equal(compassX(500, 480), 468);
  });
});

describe('sky stops', () => {
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const sat = (c) => Math.max(...c) - Math.min(...c);
  it('night is dark, noon is bright, overcast greys the sky', () => {
    assert.ok(lum(skyStops(23 * 60)[0]) < 0.15);
    assert.ok(lum(skyStops(12 * 60)[2]) > 0.6);
    const clear = skyStops(12 * 60, 'clear'), rain = skyStops(12 * 60, 'rain');
    assert.ok(sat(rain[0]) < sat(clear[0]), 'rain desaturates');
  });
});

describe('drawing', () => {
  it('draws the Skyband with the dial, sun, isles and sea', () => {
    const c = createFakeCanvas(480, 270);
    const ctx = c.getContext('2d');
    drawSkyband(ctx, BAND, { minute: 12 * 60, grade: gradeFor(12 * 60), ms: 1000, day: 3, tide: 0.5, comet: 0.4, compass: { dx: -6, lit: false } });
    const draws = ctx.calls.filter((k) => k[0] === 'drawImage').length;
    assert.ok(draws >= 6, `${draws} images`);
    assert.ok(ctx.calls.some((k) => k[0] === 'fillRect'));
  });
  it('draws the shore view at night with a lit lighthouse without throwing', () => {
    const c = createFakeCanvas(480, 270);
    const ctx = c.getContext('2d');
    drawShoreView(ctx, { x: 0, y: 0, w: 480, h: 270 }, { minute: 22 * 60, ms: 5000, day: 9, tide: 0.2, comet: 0.8, lighthouse: { stage: 7, lit: true }, porches: 8 });
    assert.equal(ctx.globalCompositeOperation, 'source-over');
    assert.ok(ctx.calls.filter((k) => k[0] === 'drawImage').length >= 4);
  });
});

// Unit tests for js/render/mapRenderer.js (LUT key quantization, the frame's pass order and budget,
// atomic grade switches) and js/render/minimap.js (the map-screen raster).
// Run: node --test test/render.mapRenderer.test.mjs
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeCanvas, createFakeCanvas } from './fixtures/render.fakeCanvas.mjs';
import { lutKey, createMapRenderer, drawFrame, MAP_RECT, FULL_RECT } from '../js/render/mapRenderer.js';
import { minimapPixels, buildMinimap, artAverage } from '../js/render/minimap.js';
import { GRADES_PER_DAY } from '../js/world/lighting.js';
import { loadMap } from '../js/world/tilemap.js';
import { createEntities, createEntity } from '../js/world/entities.js';
import { createCamera } from '../js/world/camera.js';
import { TILES, DEFAULT_LEGEND } from '../js/data/tilesets.js';
import '../js/art/chars/index.js';
import { HARBOR_RENDER, EXTRA_TILES } from './fixtures/maps/harbor-render.js';

before(() => installFakeCanvas());

const harbor = () => loadMap(HARBOR_RENDER, { ...TILES, ...EXTRA_TILES }, { legend: DEFAULT_LEGEND });

describe('LUT key quantization', () => {
  it('one key per 30 in-game minutes, 48 a day', () => {
    assert.equal(GRADES_PER_DAY, 48);
    const ids = new Set();
    for (let m = 0; m < 1440; m++) ids.add(lutKey(m, 'clear').id);
    assert.equal(ids.size, 48);
    assert.equal(lutKey(600, 'clear').id, lutKey(629, 'clear').id);
    assert.notEqual(lutKey(629, 'clear').id, lutKey(630, 'clear').id);
    assert.equal(lutKey(600, 'clear').index, lutKey(615, 'clear').index, 'same interned index');
  });
  it('weather is part of the key; unknown weather grades as clear; indoors is one key', () => {
    assert.notEqual(lutKey(600, 'rain').id, lutKey(600, 'clear').id);
    assert.equal(lutKey(600, 'sandstorm').id, lutKey(600, 'clear').id);
    assert.equal(lutKey(100, 'rain', true).id, 'indoor');
    assert.equal(lutKey(900, 'clear', true).index, lutKey(100, 'fog', true).index);
  });
  it('wraps by day and is bounded (48 slots x 6 weathers + indoor)', () => {
    assert.equal(lutKey(600 + 1440 * 3, 'clear').id, lutKey(600, 'clear').id);
    assert.equal(lutKey(-30, 'clear').id, lutKey(1410, 'clear').id);
    const all = new Set();
    for (const w of ['clear', 'rain', 'storm', 'fog', 'overcast', 'snow']) for (let m = 0; m < 1440; m += 15) all.add(lutKey(m, w).index);
    all.add(lutKey(0, 'clear', true).index);
    assert.equal(all.size, 48 * 6 + 1);
  });
});

function scene(minute = 12 * 60, extra = {}) {
  const map = harbor();
  const ents = createEntities(map);
  const player = ents.add(createEntity({ id: 'player', kind: 'player', x: 12, y: 14, artId: 'char-player' }));
  ents.add(createEntity({ id: 'wren', kind: 'npc', x: 16, y: 11, artId: 'char-wren', npcId: 'wren' }));
  const camera = createCamera({ w: 480, h: 230 });
  camera.bounds(map);
  camera.follow(player, { snap: true });
  const canvas = createFakeCanvas(480, 270);
  const ctx = canvas.getContext('2d');
  return { map, ents, player, camera, ctx, view: { ctx, map, entities: ents, camera, minute, weather: 'clear', tide: 0.05, time: 1000, player, flags: {}, ...extra } };
}

describe('drawFrame', () => {
  it('composes ground, detail, sprites, overlay, lights and the Skyband within the draw budget', () => {
    const s = scene(22 * 60);
    const r = createMapRenderer();
    const st = r.drawFrame(null, s.view);
    assert.equal(st.grade, lutKey(22 * 60, 'clear').id);
    assert.equal(st.tide, 'low');
    assert.ok(st.sprites >= 3, 'objects and entities');
    assert.ok(st.lights > 0 && st.lights <= 16, 'at most 16 pools');
    // chunk layer draws: at most 5x3 chunks per layer under the Skyband
    const chunkDraws = s.ctx.calls.filter((c) => c[0] === 'drawImage' && c[1] && c[1].width === 128 && c[1].height === 128).length;
    assert.ok(chunkDraws > 0 && chunkDraws <= 45, `${chunkDraws} chunk draws`);
    // the Skyband comes last: the final draws are inside the top 40 px
    const lastDraw = [...s.ctx.calls].reverse().find((c) => c[0] === 'drawImage');
    const y = lastDraw.length >= 9 ? lastDraw[6] : lastDraw[3];
    assert.ok(y < 40, `last draw at y ${y}`);
    assert.equal(s.ctx.globalCompositeOperation, 'source-over');
  });
  it('without the Skyband the map fills the frame', () => {
    const s = scene(12 * 60, { skyband: false });
    createMapRenderer().drawFrame(null, s.view);
    assert.deepEqual(FULL_RECT, { x: 0, y: 0, w: 480, h: 270 });
    assert.deepEqual(MAP_RECT, { x: 0, y: 40, w: 480, h: 230 });
  });
  it('a grade change shows the old complete chunk set until the new one is baked and warm', () => {
    const s = scene(12 * 60);
    const r = createMapRenderer({ budgetMs: 0.001 });
    assert.equal(r.drawFrame(null, s.view).grade, lutKey(720).id);
    s.view.minute = 23 * 60;
    const after = r.drawFrame(null, s.view);
    assert.equal(after.grade, lutKey(720).id, 'still noon on the first frame');
    let guard = 0, g = after.grade;
    while (g !== lutKey(23 * 60).id && guard++ < 400) g = r.drawFrame(null, s.view).grade;
    assert.equal(g, lutKey(23 * 60).id, 'switches once ready');
    assert.ok(guard > 1, 'the bake was spread over frames');
  });
  it('a still frame bakes nothing and allocates no new chunks', () => {
    const s = scene(12 * 60);
    const r = createMapRenderer();
    for (let i = 0; i < 200; i++) { s.view.time += 16; r.drawFrame(null, s.view); }
    const before = r.tiles.stats().baked;
    s.view.time += 16;
    const st = r.drawFrame(null, s.view);
    assert.equal(st.bakes, 0);
    assert.equal(r.tiles.stats().baked, before);
  });
  it('the default renderer per G works and needs a context', () => {
    const s = scene(12 * 60);
    const G = { display: { ctx: s.ctx } };
    const v = { ...s.view };
    delete v.ctx;
    assert.ok(drawFrame(G, v).drawImages > 0);
    assert.throws(() => createMapRenderer().drawFrame({}, v), /no context/);
  });
  it('the Relighting draws the beam and lights the lamp', () => {
    const s = scene(22 * 60, { lighthouse: { stage: 7, relit: true }, flags: { 'sp.relighting': true } });
    const r = createMapRenderer();
    r.drawFrame(null, s.view);
    s.ctx.calls.length = 0;
    r.drawFrame(null, s.view);
    assert.ok(s.ctx.calls.some((c) => c[0] === 'fill' && c[2] === 'lighter'), 'beam cones');
  });
});

describe('minimap', () => {
  it('rasterises scale px per tile with water, relief and a coast line', () => {
    const map = harbor();
    const px = minimapPixels(map, { scale: 2, tide: 'low' });
    assert.equal(px.w, map.w * 2);
    assert.equal(px.h, map.h * 2);
    assert.equal(px.data.length, px.w * px.h * 4);
    const at = (x, y) => [...px.data.slice((y * px.w + x) * 4, (y * px.w + x) * 4 + 3)];
    const deep = artAverage('water-deep');
    assert.deepEqual(at(1, 1), deep, 'deep sea in its own average colour');
    for (let i = 3; i < px.data.length; i += 4) assert.equal(px.data[i], 255);
  });
  it('the flats read as water at high tide, and a graded raster is darker at night', () => {
    const map = harbor();
    const low = minimapPixels(map, { scale: 1, tide: 'low' });
    const high = minimapPixels(map, { scale: 1, tide: 'high' });
    const i = (5 * map.w + 30) * 4; // a mud-flat cell
    assert.notDeepEqual([...low.data.slice(i, i + 3)], [...high.data.slice(i, i + 3)]);
    const night = buildMinimap(map, { scale: 1, grade: { id: '46|clear', mult: [0.3, 0.36, 0.6], floor: [0.08, 0.1, 0.2], sat: 0.7, lamp: 1, night: 1, slot: 46, minute: 1380, weather: 'clear', indoor: false } });
    assert.equal(night.w, map.w);
    assert.equal(buildMinimap(map, { scale: 1, grade: night.grade }), buildMinimap(map, { scale: 1, grade: night.grade }), 'cached');
  });
});

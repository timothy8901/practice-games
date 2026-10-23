// Unit tests for js/render/tileRenderer.js: chunk keys, the LRU / combination-evicting chunk cache,
// cell resolution and edges, tide canonicalization, the work queue, and baked pixels.
// Run: node --test test/render.tileRenderer.test.mjs
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeCanvas } from './fixtures/render.fakeCanvas.mjs';
import {
  chunkKey, decodeChunkKey, comboOf, createChunkCache, gradeIndex, gradeAt, analyzeMap, resolveCell, cellEdges,
  cellStates, createTileRenderer, CELL, CHUNK_TILES, CHUNK_PX, TIDE_INDEX, TIDE_CANON, isObjectArt,
} from '../js/render/tileRenderer.js';
import { loadMap } from '../js/world/tilemap.js';
import { TILES, DEFAULT_LEGEND } from '../js/data/tilesets.js';
import { gradeFor } from '../js/world/lighting.js';
import { getTile } from '../js/art/atlas.js';
import { HARBOR_RENDER, EXTRA_TILES } from './fixtures/maps/harbor-render.js';

before(() => installFakeCanvas());

const NOON = gradeFor(12 * 60, 'clear');
const NIGHT = gradeFor(23 * 60, 'clear');

// 16x16 = 2x2 chunks. Top-left holds wet sand (floods), top-right a causeway; the bottom chunks hold
// no tide tile and no tide neighbour, so they share one canonical tide variant.
const SMALL = {
  id: 'small', name: 'small', kind: 'exterior', region: 'test', w: 16, h: 16,
  ground: [
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'SSSSSSSSSSSSSSSS',
    'WWWWAAAAAAAAEEEE',
    'GGGGGGPPGGGGGGGG',
    'GGGGGGPPGGGGGGGG',
    'GGGGGGPPGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GG111GGGGGGGGGGG',
    'GG111GGGGGGGGGGG',
    'GG#+%GGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
  ],
  detail: [
    '................', '................', '................', '................',
    '................', '................', '................', '.........9......',
    '................', '................', '................', '................',
    '..........o.....', '................', '................', '................',
  ],
  entry: { x: 8, y: 8 },
};
const small = () => loadMap(SMALL, TILES, { legend: DEFAULT_LEGEND });

describe('chunk keys', () => {
  it('round-trips every field and never collides', () => {
    const seen = new Set();
    for (const g of [0, 1, 7, 288]) for (const t of [0, 1, 2]) for (const L of [0, 1, 2]) for (const c of [0, 1, 255, 65535]) {
      const k = chunkKey(c, L, t, g);
      assert.ok(Number.isSafeInteger(k));
      assert.ok(!seen.has(k), `collision at ${c},${L},${t},${g}`);
      seen.add(k);
      const d = decodeChunkKey(k);
      assert.deepEqual([d.chunk, d.layer, d.tide, d.grade], [c, L, t, g]);
      assert.equal(d.combo, g * 3 + t);
      assert.equal(comboOf(k), g * 3 + t);
    }
  });
  it('interns grades by id (stable small integers)', () => {
    const a = gradeIndex(NOON);
    assert.equal(gradeIndex(gradeFor(12 * 60 + 29, 'clear')), a, 'same 30-minute slot -> same index');
    assert.notEqual(gradeIndex(gradeFor(12 * 60 + 30, 'clear')), a);
    assert.notEqual(gradeIndex(gradeFor(12 * 60, 'rain')), a, 'weather is part of the key');
    assert.equal(gradeAt(a), NOON);
  });
});

describe('chunk cache', () => {
  const key = (c, g, t = 1, L = 0) => chunkKey(c, L, t, g);
  it('evicts the least recently used chunk at capacity and reports it', () => {
    const evicted = [];
    const cache = createChunkCache({ capacity: 3, maxCombos: 8, onEvict: (v) => evicted.push(v) });
    cache.set(key(1, 0), 'a');
    cache.set(key(2, 0), 'b');
    cache.set(key(3, 0), 'c');
    assert.equal(cache.get(key(1, 0)), 'a'); // touch a: b is now the oldest
    cache.set(key(4, 0), 'd');
    assert.deepEqual(evicted, ['b']);
    assert.equal(cache.has(key(2, 0)), false);
    assert.equal(cache.size(), 3);
    assert.equal(cache.peek(key(1, 0)), 'a');
    assert.equal(cache.stats().evictions, 1);
  });
  it('keeps at most maxCombos (grade, tide) combinations and evicts the stalest one whole', () => {
    const evicted = [];
    const cache = createChunkCache({ capacity: 100, maxCombos: 2, onEvict: (v) => evicted.push(v) });
    cache.set(key(1, 0), 'g0-1');
    cache.set(key(2, 0), 'g0-2');
    cache.set(key(1, 1), 'g1-1');
    cache.touchCombo(0 * 3 + 1); // grade 0 shown this frame: grade 1 is now the stalest
    cache.set(key(1, 2), 'g2-1');
    assert.deepEqual(evicted, ['g1-1']);
    assert.deepEqual(cache.combos().sort((a, b) => a - b), [0 * 3 + 1, 2 * 3 + 1]);
    assert.equal(cache.stats().comboEvictions, 1);
    // tide is part of the combination
    cache.set(key(5, 0, 2), 'g0-high');
    assert.equal(cache.stats().combos, 2);
  });
  it('a hit allocates no new record (same value object back)', () => {
    const cache = createChunkCache({ capacity: 4 });
    const v = { canvas: null };
    cache.set(key(9, 3), v);
    for (let i = 0; i < 100; i++) assert.equal(cache.get(key(9, 3)), v);
    assert.equal(cache.stats().hits, 100);
  });
  it('rejects bad options', () => {
    assert.throws(() => createChunkCache({ capacity: 0 }), RangeError);
    assert.throws(() => createChunkCache({ maxCombos: 0 }), RangeError);
  });
});

describe('map analysis', () => {
  it('flags tide-sensitive chunks (cell or neighbour) and finds objects', () => {
    const A = analyzeMap(small());
    assert.equal(A.chunksX, 2);
    assert.equal(A.chunksY, 2);
    assert.deepEqual([...A.tideSensitive], [1, 1, 0, 0]);
    assert.equal(A.objects.length, 1, 'the alder (32x32) is an object, the rock (16x16) is baked');
    assert.equal(A.objects[0].art, 'tree-alder');
    assert.equal(A.objects[0].sortY, 8 * 16);
    assert.ok(isObjectArt('tree-alder'));
    assert.ok(!isObjectArt('rock-a'));
  });
  it('the harbor fixture loads and lists the lighthouse, boats and lamp posts as objects', () => {
    const map = loadMap(HARBOR_RENDER, { ...TILES, ...EXTRA_TILES }, { legend: DEFAULT_LEGEND });
    const A = analyzeMap(map);
    assert.equal(A.chunksX, 6);
    assert.equal(A.chunksY, 4);
    assert.ok(A.objects.some((o) => o.special === 'lighthouse'));
    assert.ok(A.objects.some((o) => o.special === 'boat'));
    assert.ok(A.objects.filter((o) => o.art === 'lamp-post').length >= 10);
    for (let i = 1; i < A.objects.length; i++) assert.ok(A.objects[i - 1].sortY <= A.objects[i].sortY, 'objects come y-sorted');
  });
});

describe('cell resolution', () => {
  const A = analyzeMap(small());
  const at = (x, y) => y * 16 + x;
  it('tide tiles draw their submerged art when awash', () => {
    assert.equal(resolveCell(A, 0, at(13, 3), { tide: 'low', grade: NOON }).art, 'causeway');
    assert.equal(resolveCell(A, 0, at(13, 3), { tide: 'mid', grade: NOON }).art, 'causeway-sub');
    assert.equal(resolveCell(A, 0, at(1, 3), { tide: 'mid', grade: NOON }).art, 'wet-sand');
    assert.equal(resolveCell(A, 0, at(1, 3), { tide: 'high', grade: NOON }).art, 'water-shallow');
  });
  it('a roof block autotiles to ridge / eave with ends', () => {
    const r = (x, y) => resolveCell(A, 0, at(x, y), { tide: 'low', grade: NOON }).art;
    assert.deepEqual([r(2, 9), r(3, 9), r(4, 9)], ['roof-red-ridge-l', 'roof-red-ridge', 'roof-red-ridge-r']);
    assert.deepEqual([r(2, 10), r(3, 10), r(4, 10)], ['roof-red-eave-l', 'roof-red-eave', 'roof-red-eave-r']);
  });
  it('windows light after dusk', () => {
    assert.equal(resolveCell(A, 0, at(4, 11), { tide: 'low', grade: NOON }).art, 'window-unlit');
    assert.equal(resolveCell(A, 0, at(4, 11), { tide: 'low', grade: NIGHT }).art, 'window-lit');
  });
  it('water meets land with surf, swell, shelf and banks', () => {
    const st = cellStates(A, 'low');
    assert.equal(st[at(5, 0)], CELL.DEEP);
    assert.equal(st[at(5, 2)], CELL.SEA);
    assert.equal(st[at(13, 3)], CELL.CROSSING);
    assert.equal(st[at(5, 3)], CELL.LAND);
    const ids = (x, y, t = 'low') => cellEdges(A, at(x, y), t).map((e) => e[0]);
    assert.deepEqual(ids(5, 1), ['shelf-s']);
    assert.deepEqual(ids(5, 2), ['swell-s', 'foam-s']);
    assert.ok(ids(5, 3).includes('bank-n'));
    assert.ok(ids(13, 2).length === 0 || !ids(13, 2).includes('foam-s'), 'no surf against a causeway');
    // at high tide the wet sand is water: the sand next to it gets a bank, the old tide line goes
    assert.ok(ids(4, 3, 'high').includes('bank-w'));
    assert.ok(ids(3, 3, 'low').includes('tideline-e'));
  });
  it('paths get grass fringes', () => {
    const e = cellEdges(A, at(6, 5), 'low').map((x) => x[0]);
    assert.ok(e.includes('fringe-w'));
    assert.ok(!e.includes('fringe-e'), 'path to the east is not turf');
  });
});

describe('tile renderer', () => {
  const rect = { x: 0, y: 0, w: 256, h: 256 };
  it('bakes visible chunks once per key; a tide flip re-bakes only tide-sensitive chunks', () => {
    const tr = createTileRenderer();
    tr.setMap(small());
    assert.ok(tr.missing(rect, 0, 0, 'low', NOON) > 0);
    const first = tr.bakeNow(rect, 0, 0, 'low', NOON);
    assert.equal(tr.missing(rect, 0, 0, 'low', NOON), 0);
    assert.equal(tr.bakeNow(rect, 0, 0, 'low', NOON), 0, 'already baked');
    const flip = tr.bakeNow(rect, 0, 0, 'high', NOON);
    assert.ok(flip > 0 && flip < first, `tide flip baked ${flip} of ${first}`);
    const A = tr.analysis();
    // the bottom chunks' ground layer is keyed by the canonical tide
    assert.equal(tr.cache.has(chunkKey(2, 0, TIDE_CANON, gradeIndex(NOON))), true);
    assert.equal(tr.cache.has(chunkKey(2, 0, TIDE_INDEX.high, gradeIndex(NOON))), false);
    assert.ok(A.layerUsed[0] & 1);
  });
  it('queues work and pumps it within a budget; unwanted keys are dropped', () => {
    const tr = createTileRenderer();
    tr.setMap(small());
    tr.want([['low', NOON]]);
    tr.request(rect, 0, 0, 'low', NOON);
    const q = tr.queueLength();
    assert.ok(q > 0);
    let n = 0, guard = 0;
    while (tr.queueLength() && guard++ < 100) n += tr.pump(50);
    assert.equal(tr.missing(rect, 0, 0, 'low', NOON), 0);
    tr.request(rect, 0, 0, 'low', NIGHT);
    tr.want([['low', NOON]]);
    assert.equal(tr.pump(50), 0, 'night keys are no longer wanted');
  });
  it('draws one image per used chunk layer and composes chunks in one upload each', () => {
    const tr = createTileRenderer();
    tr.setMap(small());
    tr.bakeNow(rect, 0, 0, 'low', NOON);
    const ctx = { calls: 0, drawImage() { this.calls++; } };
    const n = tr.drawLayer(ctx, 0, rect, 0, 0, 'low', NOON);
    assert.equal(n, 4);
    assert.equal(ctx.calls, 4);
    // the ground chunk's pixels match the graded tile at a grass cell
    const key = chunkKey(2, 0, TIDE_CANON, gradeIndex(NOON));
    const ch = tr.cache.peek(key);
    const ctx2 = ch.canvas.getContext('2d');
    const puts = ctx2.calls.filter((c) => c[0] === 'putImageData');
    assert.equal(puts.length, 1, 'one upload per bake');
    const data = puts[0][1].data;
    const tile = getTile('grass-a', 0, NOON, ((0 * 7 + 13 * 13) >> 1) & 3);
    const cellX = 0, cellY = 13 - CHUNK_TILES; // (0, 13) in the bottom-left chunk
    const px = (x, y, buf, w) => [...buf.slice(((y * w) + x) * 4, ((y * w) + x) * 4 + 4)];
    assert.deepEqual(px(cellX * 16 + 5, cellY * 16 + 5, data, CHUNK_PX), px(5, 5, tile.pixels, 16));
  });
  it('animated cells draw from one atlas per grade and skip still gust frames', () => {
    const tr = createTileRenderer();
    tr.setMap(small());
    tr.bakeNow(rect, 0, 0, 'low', NOON);
    const seen = new Set();
    const ctx = { drawImage(img) { seen.add(img); } };
    const n = tr.drawAnimated(ctx, 0, rect, 0, 0, 'low', NOON, 1234);
    assert.ok(n > 0, 'shallows and surf animate');
    assert.equal(seen.size, 1, 'one atlas texture for every animated frame');
  });
  it('stats count bakes, size and evictions', () => {
    const tr = createTileRenderer({ maxChunks: 4 });
    tr.setMap(small());
    tr.bakeNow(rect, 0, 0, 'low', NOON);
    const s = tr.stats();
    assert.ok(s.baked >= 4);
    assert.ok(s.size <= 4);
    assert.ok(s.evictions >= 0);
  });
});

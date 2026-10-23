// Unit tests for js/world/tide.js. Run: node --test test/world.tide.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tideVariant, tideMaskOf, gateOpen, drawsAsWater, flooded, awash, dry, nearestDry, floodDelta, strandedTiles,
  TIDE_MASK, TIDE_MASK_NAMES, LOW_TIDE, HIGH_TIDE, COLLISION, COLLISION_CHARS, TIDE_VARIANTS,
} from '../js/world/tide.js';
import { loadMap } from '../js/world/tilemap.js';
import { DEFAULT_LOW_TIDE, DEFAULT_HIGH_TIDE, tideAt, tideStateAt, TIDE_PERIOD_MINUTES } from '../js/core/time.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';
import harborDef from './fixtures/world/harbor.fixture.js';

const load = (def = harborDef) => loadMap(def, TILES, { legend: DEFAULT_LEGEND });

describe('tideVariant', () => {
  it('uses core/time thresholds for heights', () => {
    assert.equal(LOW_TIDE, DEFAULT_LOW_TIDE);
    assert.equal(HIGH_TIDE, DEFAULT_HIGH_TIDE);
    assert.equal(tideVariant(0), 'low');
    assert.equal(tideVariant(0.19), 'low');
    assert.equal(tideVariant(0.2), 'mid');
    assert.equal(tideVariant(0.5), 'mid');
    assert.equal(tideVariant(0.8), 'mid');
    assert.equal(tideVariant(0.81), 'high');
    assert.equal(tideVariant(1), 'high');
    assert.deepEqual(TIDE_VARIANTS, ['low', 'mid', 'high']);
  });

  it('maps tide states and passes variants through', () => {
    assert.equal(tideVariant('low'), 'low');
    assert.equal(tideVariant('rising'), 'mid');
    assert.equal(tideVariant('falling'), 'mid');
    assert.equal(tideVariant('high'), 'high');
    assert.equal(tideVariant('mid'), 'mid');
  });

  it('agrees with core/time over a full tide cycle', () => {
    for (let m = 0; m <= TIDE_PERIOD_MINUTES * 2; m += 7) {
      const h = tideAt(m, 123);
      const s = tideStateAt(m, 123);
      assert.equal(tideVariant(h), tideVariant(s), `minute ${m}: height ${h} vs state ${s}`);
    }
  });

  it('throws on garbage', () => {
    assert.throws(() => tideVariant(undefined), TypeError);
    assert.throws(() => tideVariant(NaN), TypeError);
    assert.throws(() => tideVariant('wet'), TypeError);
    assert.throws(() => tideVariant({ tide: 0.5 }), TypeError);
  });
});

describe('tide masks and gates', () => {
  it('tideMaskOf accepts names, codes and nothing', () => {
    assert.equal(tideMaskOf(null), 0);
    assert.equal(tideMaskOf(undefined), 0);
    assert.equal(tideMaskOf(false), 0);
    assert.equal(tideMaskOf('low'), TIDE_MASK.LOW_ONLY);
    assert.equal(tideMaskOf('high'), TIDE_MASK.HIGH_ONLY);
    assert.equal(tideMaskOf('floods'), TIDE_MASK.FLOODS);
    assert.equal(tideMaskOf('glow'), TIDE_MASK.GLOW);
    assert.equal(tideMaskOf(3), 3);
    assert.throws(() => tideMaskOf('deep'), TypeError);
    assert.throws(() => tideMaskOf(5), TypeError);
    assert.deepEqual(TIDE_MASK_NAMES, [null, 'low', 'high', 'floods', 'glow']);
    assert.deepEqual(COLLISION_CHARS, ['-', '#', '.', 'L', 'H']);
    assert.equal(COLLISION.SOLID, 1);
  });

  it('gateOpen and drawsAsWater per class and variant', () => {
    const table = [
      // mask, variant, open, draws(water=false)
      [TIDE_MASK.NONE, 'low', true, false],
      [TIDE_MASK.LOW_ONLY, 'low', true, false],
      [TIDE_MASK.LOW_ONLY, 'mid', false, true],
      [TIDE_MASK.LOW_ONLY, 'high', false, true],
      [TIDE_MASK.GLOW, 'low', true, false],
      [TIDE_MASK.GLOW, 'high', false, true],
      [TIDE_MASK.HIGH_ONLY, 'high', true, false],
      [TIDE_MASK.HIGH_ONLY, 'mid', false, true],
      [TIDE_MASK.HIGH_ONLY, 'low', false, true],
      [TIDE_MASK.FLOODS, 'low', true, false],
      [TIDE_MASK.FLOODS, 'mid', true, false],
      [TIDE_MASK.FLOODS, 'high', true, true],
    ];
    for (const [mask, v, open, draws] of table) {
      assert.equal(gateOpen(mask, v), open, `gateOpen(${mask}, ${v})`);
      assert.equal(drawsAsWater(mask, v, false), draws, `drawsAsWater(${mask}, ${v})`);
    }
    assert.equal(drawsAsWater(TIDE_MASK.NONE, 'low', true), true, 'plain water is water');
  });
});

describe('flooded / awash / dry on the harbor', () => {
  const map = load();

  it('causeway tile: dry at low, flooded otherwise', () => {
    assert.equal(flooded(map, 14, 4, 'low'), false);
    assert.equal(flooded(map, 14, 4, 'rising'), true);
    assert.equal(flooded(map, 14, 4, 'high'), true);
    assert.equal(flooded(map, 14, 4, 0.05), false);
    assert.equal(flooded(map, 14, 4, 0.5), true);
    assert.equal(dry(map, 14, 4, 'low'), true);
    assert.equal(dry(map, 14, 4, 'high'), false);
  });

  it('open sea is always flooded; land never; walls and the void are not water', () => {
    for (const t of ['low', 'mid', 'high']) {
      assert.equal(flooded(map, 0, 0, t), true);
      assert.equal(flooded(map, 6, 5, t), false);
      assert.equal(flooded(map, 13, 6, t), false, 'cliff');
      assert.equal(flooded(map, 9, 0, t), false, 'pier');
      assert.equal(flooded(map, -1, 0, t), false);
      assert.equal(dry(map, -1, 0, t), false);
      assert.equal(dry(map, 13, 6, t), false, 'a cliff is not somewhere to stand');
    }
  });

  it('collision overrides: a ford is never flooded, L/H gates flood like their class', () => {
    assert.equal(flooded(map, 0, 5, 'high'), false, "'.' ford");
    assert.equal(flooded(map, 1, 4, 'low'), false, "'L' at low");
    assert.equal(flooded(map, 1, 4, 'high'), true, "'L' at high");
    assert.equal(flooded(map, 0, 9, 'high'), false, "'#' is a wall");
    const def = structuredClone(harborDef);
    def.collision[6] = '-------------L--';
    const m = load(def);
    assert.equal(flooded(m, 13, 6, 'high'), true, 'L on a cliff makes it a tide gate');
    assert.equal(flooded(m, 13, 6, 'low'), false);
  });

  it('awash follows the art, including wet sand at high tide', () => {
    assert.equal(awash(map, 0, 6, 'low'), false);
    assert.equal(awash(map, 0, 6, 'high'), true);
    assert.equal(flooded(map, 0, 6, 'high'), false, 'but still walkable');
    assert.equal(awash(map, 0, 5, 'high'), true, 'the ford still looks like water');
    assert.equal(awash(map, 14, 4, 'mid'), true);
    assert.equal(awash(map, 10, 8, 'high'), true);
    assert.equal(awash(map, 3, 1, 'low'), true, 'slipway under water at low tide');
    assert.equal(awash(map, 3, 1, 'high'), false);
    assert.equal(awash(map, 99, 0, 'high'), false);
  });
});

describe('nearestDry', () => {
  const map = load();

  it('returns the tile itself when it is already dry', () => {
    assert.deepEqual(nearestDry(map, 6, 5, 'high'), { x: 6, y: 5, dist: 0 });
    assert.deepEqual(nearestDry(map, 14, 4, 'low'), { x: 14, y: 4, dist: 0 });
  });

  it('wades from a flooded causeway to the nearest dry land, deterministically', () => {
    // (14,4) at high tide: south (14,5) and west (13,4) are both sand one step away; N,E,S,W order picks south
    assert.deepEqual(nearestDry(map, 14, 4, 'high'), { x: 14, y: 5, dist: 1 });
    assert.deepEqual(nearestDry(map, 14, 4, 0.9), { x: 14, y: 5, dist: 1 });
    // (15,4): two steps either way; BFS order N,E,S,W and discovery order settle it
    const r = nearestDry(map, 15, 4, 'high');
    assert.equal(r.dist, 2);
    assert.deepEqual(r, { x: 15, y: 6, dist: 2 });
    for (let i = 0; i < 20; i++) assert.deepEqual(nearestDry(map, 15, 4, 'high'), r);
    // from the flats at high tide
    assert.deepEqual(nearestDry(map, 11, 9, 'high'), { x: 11, y: 7, dist: 2 });
    // from open sea: wades to the beach
    assert.deepEqual(nearestDry(map, 6, 0, 'high'), { x: 6, y: 2, dist: 2 });
  });

  it('never passes through walls or out of bounds', () => {
    // a 1-wide flooded corridor walled on both sides, dry land only past the far end
    const def = {
      id: 'corridor', name: 'c', kind: 'exterior', region: 'r', w: 5, h: 3,
      ground: ['CCCCC', 'GEEEE', 'CCCCC'],
      entry: { x: 0, y: 1 }, entities: [], triggers: [], warps: [], spawns: [],
    };
    const m = load(def);
    assert.deepEqual(nearestDry(m, 4, 1, 'high'), { x: 0, y: 1, dist: 4 });
    assert.equal(nearestDry(m, 4, 1, 'high', { maxDist: 3 }), null);
    assert.deepEqual(nearestDry(m, 4, 1, 'high', { maxDist: 4 }), { x: 0, y: 1, dist: 4 });
    assert.equal(nearestDry(m, 9, 9, 'high'), null, 'out of bounds start');
    const sealed = load({ ...def, id: 'sealed', ground: ['CCCCC', 'CEEEC', 'CCCCC'] });
    assert.equal(nearestDry(sealed, 2, 1, 'high'), null, 'no dry tile anywhere');
  });

  it('strandedTiles lists low-tide tiles with nowhere dry to go; the harbor has none', () => {
    assert.deepEqual(strandedTiles(map), []);
    const sealed = load({
      id: 'sealed', name: 's', kind: 'exterior', region: 'r', w: 5, h: 3,
      ground: ['CCCCC', 'CEEEC', 'CCCCC'],
      entry: { x: 1, y: 1 }, entities: [], triggers: [], warps: [], spawns: [],
    });
    assert.deepEqual(strandedTiles(sealed), [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
  });
});

describe('floodDelta', () => {
  const map = load();

  it('lists exactly the cells whose water art changes between variants', () => {
    assert.deepEqual(floodDelta(map, 'low', 'low'), []);
    assert.deepEqual(floodDelta(map, 'rising', 'falling'), []);
    const lowMid = floodDelta(map, 'low', 'mid');
    const ids = lowMid.map((i) => `${i % map.w},${Math.floor(i / map.w)}`);
    assert.ok(ids.includes('14,4') && ids.includes('15,4'), 'causeway');
    assert.ok(ids.includes('10,8') && ids.includes('13,9'), 'flats');
    assert.ok(!ids.includes('0,6'), 'wet sand floods at high, not mid');
    assert.ok(!ids.includes('0,0'), 'open sea does not change');
    assert.ok(!ids.includes('3,1'), 'slipway is under water at both low and mid');
    assert.equal(lowMid.length, 2 + 8);
    const midHigh = floodDelta(map, 0.5, 0.95);
    const ids2 = midHigh.map((i) => `${i % map.w},${Math.floor(i / map.w)}`);
    assert.deepEqual(ids2, ['3,1', '0,6', '1,6']);
    assert.deepEqual(floodDelta(map, 'high', 'mid'), midHigh, 'symmetric');
    for (let i = 1; i < lowMid.length; i++) assert.ok(lowMid[i] > lowMid[i - 1], 'ascending');
  });
});

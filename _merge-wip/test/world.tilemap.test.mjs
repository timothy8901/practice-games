// Unit tests for js/world/tilemap.js. Run: node --test test/world.tilemap.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadMap, LAYER, AUTOTILE, MOVERS } from '../js/world/tilemap.js';
import { TIDE_MASK, COLLISION } from '../js/world/tide.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';
import harborDef from './fixtures/world/harbor.fixture.js';
import cottageDef from './fixtures/world/cottage.fixture.js';

const load = (def = harborDef) => loadMap(def, TILES, { legend: DEFAULT_LEGEND });
const clone = (def, over) => ({ ...structuredClone(def), ...over });

describe('loadMap: parsing', () => {
  it('parses the fixture harbor map with its legend merged over the default legend', () => {
    const map = load();
    assert.equal(map.id, 'harbor');
    assert.equal(map.name, 'The Harbor');
    assert.equal(map.kind, 'exterior');
    assert.equal(map.w, 16);
    assert.equal(map.h, 10);
    assert.equal(map.indoor, false);
    assert.equal(map.def, harborDef);
    assert.deepEqual(map.entry, { x: 6, y: 5, facing: 'up' });
    assert.ok(Object.isFrozen(map));
    assert.equal(map.layers.length, 3);
    for (const l of map.layers) {
      assert.ok(l instanceof Uint16Array);
      assert.equal(l.length, 160);
    }
    // the map's own legend entry '=' -> cobbles sits beside the default 'O' -> cobbles
    assert.equal(map.layerTile(LAYER.GROUND, 6, 3), 'cobbles');
    assert.equal(map.layerTile(LAYER.GROUND, 6, 4), 'cobbles');
    assert.equal(map.layerTile(LAYER.GROUND, 0, 0), 'deep');
    assert.equal(map.layerTile(LAYER.DETAIL, 9, 0), 'pier');
    assert.equal(map.layerTile(LAYER.DETAIL, 0, 0), null, "'.' is no tile");
    assert.equal(map.layerTile(LAYER.OVERLAY, 12, 6), 'tree-crown');
    assert.equal(map.layerTile(LAYER.GROUND, -1, 0), null);
    assert.equal(map.layerTile(LAYER.GROUND, 16, 0), null);
    assert.equal(map.layerDef(LAYER.GROUND, 0, 0), TILES.deep);
    assert.equal(map.tileIds[0], null);
    assert.equal(map.tileIds.length, new Set(map.tileIds).size, 'tile slots are unique');
  });

  it('accepts a map without optional layers and derives indoor from light / kind', () => {
    const map = load(cottageDef);
    assert.equal(map.kind, 'interior');
    assert.equal(map.indoor, true);
    assert.equal(map.layerTile(LAYER.OVERLAY, 1, 1), null);
    assert.equal(map.layerTile(LAYER.DETAIL, 1, 1), 'candle');
    assert.equal(map.collision[0], COLLISION.INHERIT);
    const bare = load(clone(cottageDef, { id: 'bare', kind: 'exterior', light: undefined, detail: null, triggers: undefined, warps: undefined }));
    assert.equal(bare.indoor, false);
    assert.deepEqual(bare.triggers, []);
    assert.deepEqual(bare.warps, []);
  });

  it('rejects malformed definitions with readable errors', () => {
    assert.throws(() => loadMap(null, TILES), /def must be a map definition/);
    assert.throws(() => loadMap(harborDef, null), /tiles must be the tileset/);
    assert.throws(() => load(clone(harborDef, { id: '' })), /id must be/);
    assert.throws(() => load(clone(harborDef, { h: 9 })), /map harbor: ground has 10 rows, want 9/);
    const shortRow = structuredClone(harborDef);
    shortRow.ground[3] = 'DSAAAA';
    assert.throws(() => load(shortRow), /ground\[3\] has 6 chars, want 16/);
    const badChar = structuredClone(harborDef);
    badChar.ground[0] = 'DDDDDDDDDDDDDDD?';
    assert.throws(() => load(badChar), /ground\[0\]\[15\] char '\?' is not in the legend/);
    assert.throws(() => load(clone(harborDef, { legend: { '=': 'no-such-tile' } })), /legend '=' names unknown tile 'no-such-tile'/);
    const badCol = structuredClone(harborDef);
    badCol.collision[2] = '--x-------------';
    assert.throws(() => load(badCol), /collision\[2\]\[2\] char 'x'/);
    assert.throws(() => load(clone(harborDef, { entry: { x: 16, y: 0 } })), /entry \(16, 0\) is outside/);
    assert.throws(() => load(clone(harborDef, { warps: [{ x: 0, y: 0, to: { mapId: 'x' }, kind: 'door' }] })), /warps\[0\] needs to \{mapId, x, y\}/);
    assert.throws(() => load(clone(harborDef, { triggers: [{ x: 15, y: 9, w: 2, kind: 'step', id: 't' }] })), /triggers\[0\] .* is outside/);
    assert.throws(() => load(clone(harborDef, { regions: { bad: { x: 0, y: 0, w: 0, h: 1 } } })), /regions\.bad w\/h/);
    assert.throws(() => load(clone(harborDef, { spawns: [{ area: 42, table: 't', rate: 1 }] })), /spawns\[0\]\.area/);
    const badTide = { ...TILES, sand: { ...TILES.sand, tide: 'sometimes' } };
    assert.throws(() => loadMap(harborDef, badTide, { legend: DEFAULT_LEGEND }), /tile 'sand': .*unknown tile tide value "sometimes"/);
    const badAnim = { ...TILES, sand: { ...TILES.sand, anim: 1.5 } };
    assert.throws(() => loadMap(harborDef, badAnim, { legend: DEFAULT_LEGEND }), /tile 'sand': anim frame count/);
    const badGlow = { ...TILES, sand: { ...TILES.sand, glow: { when: 'sometimes' } } };
    assert.throws(() => loadMap(harborDef, badGlow, { legend: DEFAULT_LEGEND }), /glow\.when/);
  });
});

describe('classification from tile definitions', () => {
  const map = load();
  const at = (x, y) => y * map.w + x;

  it('derives solid, water and tide masks, with detail falling through to ground', () => {
    assert.equal(map.solidMask[at(13, 6)], 1, 'cliff is solid');
    assert.equal(map.solidMask[at(2, 7)], 1, 'wall is solid');
    assert.equal(map.solidMask[at(11, 3)], 1, 'rock detail on sand is solid');
    assert.equal(map.solidMask[at(5, 3)], 1, 'lamp detail is solid');
    assert.equal(map.solidMask[at(3, 8)], 0, 'door tile is open');
    assert.equal(map.waterMask[at(0, 0)], 1);
    assert.equal(map.waterMask[at(9, 0)], 0, 'pier over deep water is not water');
    assert.equal(map.waterMask[at(5, 8)], 0, 'porch light (no water field) inherits grass');
    assert.equal(map.tideMask[at(14, 4)], TIDE_MASK.LOW_ONLY);
    assert.equal(map.tideMask[at(0, 6)], TIDE_MASK.FLOODS);
    assert.equal(map.tideMask[at(10, 8)], TIDE_MASK.GLOW);
    assert.equal(map.tideMask[at(3, 1)], TIDE_MASK.HIGH_ONLY, 'slipway detail sets the tide class');
    assert.equal(map.tideMask[at(4, 4)], TIDE_MASK.NONE);
    assert.equal(map.collision[at(0, 9)], COLLISION.SOLID);
    assert.equal(map.collision[at(0, 5)], COLLISION.OPEN);
    assert.equal(map.collision[at(1, 4)], COLLISION.LOW);
  });

  it('treats a cell with no ground tile as solid void', () => {
    const def = structuredClone(cottageDef);
    def.legend = { ...def.legend, '.': null };
    def.ground[2] = 'H.fffH';
    const m = load(def);
    assert.equal(m.layerTile(LAYER.GROUND, 1, 2), null);
    assert.equal(m.passable(1, 2, 'low', 'walk'), false);
    assert.equal(m.tileAt(1, 2).id, null);
  });

  it('tileAt merges the layers into a cached, frozen TileInfo', () => {
    const info = map.tileAt(9, 0);
    assert.equal(info, map.tileAt(9, 0), 'same object on repeat');
    assert.ok(Object.isFrozen(info));
    assert.equal(info.id, 'pier');
    assert.equal(info.ground, 'deep');
    assert.equal(info.detail, 'pier');
    assert.equal(info.overlay, null);
    assert.equal(info.water, false);
    assert.equal(info.solid, false);
    assert.equal(info.sfx, 'wood');
    assert.equal(info.verb, null, "the pier's explicit verb: null is kept (null is a value, undefined falls through)");
    assert.equal(info.art, 'pier');
    assert.equal(info.i, 9);
    const mud = map.tileAt(10, 8);
    assert.equal(mud.tide, TIDE_MASK.GLOW);
    assert.deepEqual(mud.anim, { frames: 3, fps: 1 });
    assert.equal(mud.glow.kind, 'bio');
    assert.equal(mud.glow.when, 'night-low');
    assert.equal(mud.spawn, 'mud');
    const deep = map.tileAt(0, 0);
    assert.deepEqual(deep.anim, { frames: 3, fps: 2 });
    assert.deepEqual(map.tileAt(4, 1).anim, { frames: 3, fps: 4 }, 'a bare frame count gets the default fps');
    // a detail definition with no fields at all falls through completely
    const rugDef = { ...structuredClone(harborDef), id: 'rug-test', detail: harborDef.detail.map((r, y) => (y === 0 ? '..R.............' : r)), legend: { '=': 'cobbles', R: 'rug' } };
    const rug = load(rugDef).tileAt(2, 0);
    assert.equal(rug.id, 'rug');
    assert.equal(rug.verb, 'fish');
    assert.equal(rug.water, true);
    assert.equal(rug.solid, false);
    assert.deepEqual(rug.anim, { frames: 3, fps: 2 }, 'anim falls through to the ground tile');
    assert.equal(rug.art, 'rug');
    assert.equal(map.tileAt(12, 6).overlay, 'tree-crown');
    assert.equal(map.tileAt(12, 6).id, 'grass', 'overlay never becomes the top tile');
    assert.equal(map.tileAt(-1, 0), null);
    assert.equal(map.tileAt(0, 10), null);
    assert.equal(map.tileAt(0.5, 0), null);
  });

  it('inBounds and index', () => {
    assert.equal(map.inBounds(0, 0), true);
    assert.equal(map.inBounds(15, 9), true);
    assert.equal(map.inBounds(16, 9), false);
    assert.equal(map.inBounds(2.5, 1), false);
    assert.equal(map.index(3, 2), 35);
    assert.equal(map.index(-1, 2), -1);
  });
});

describe('passable', () => {
  const map = load();

  it('walkers: land open, water and solids blocked, at every tide', () => {
    for (const tide of ['low', 'rising', 'high', 'falling', 0, 0.5, 1]) {
      assert.equal(map.passable(6, 5, tide, 'walk'), true, `path at ${tide}`);
      assert.equal(map.passable(0, 0, tide, 'walk'), false, `deep at ${tide}`);
      assert.equal(map.passable(13, 6, tide, 'walk'), false, `cliff at ${tide}`);
      assert.equal(map.passable(11, 3, tide, 'walk'), false, `rock at ${tide}`);
      assert.equal(map.passable(9, 0, tide, 'walk'), true, `pier at ${tide}`);
      assert.equal(map.passable(12, 6, tide, 'walk'), true, `under a tree crown at ${tide}`);
      assert.equal(map.passable(-1, 5, tide, 'walk'), false, 'west of the map');
      assert.equal(map.passable(16, 5, tide, 'walk'), false, 'east of the map');
      assert.equal(map.passable(5, 10, tide, 'walk'), false, 'south of the map');
    }
    assert.equal(map.passable(6, 5, 'low'), true, 'mover defaults to a walker');
  });

  it('causeway: open at low tide only; the sea takes it at mid and high', () => {
    assert.equal(map.passable(14, 4, 'low', 'walk'), true);
    assert.equal(map.passable(14, 4, 0.1, 'walk'), true);
    assert.equal(map.passable(14, 4, 'rising', 'walk'), false);
    assert.equal(map.passable(14, 4, 0.5, 'walk'), false);
    assert.equal(map.passable(14, 4, 'falling', 'walk'), false);
    assert.equal(map.passable(14, 4, 'high', 'walk'), false);
    assert.equal(map.passable(14, 4, 0.95, 'walk'), false);
    assert.equal(map.passable(15, 4, 'low', 'npc'), true);
    assert.equal(map.passable(15, 4, 'high', 'roamer'), false);
    // thresholds match core/time: 0.2 is not low, 0.8 is not high
    assert.equal(map.passable(14, 4, 0.2, 'walk'), false);
    assert.equal(map.passable(14, 4, 0.19999, 'walk'), true);
  });

  it('glow mud behaves as low-only; wet sand always walkable; slipway high-only', () => {
    assert.equal(map.passable(10, 8, 'low', 'walk'), true);
    assert.equal(map.passable(10, 8, 'high', 'walk'), false);
    assert.equal(map.passable(0, 6, 'low', 'walk'), true);
    assert.equal(map.passable(0, 6, 'high', 'walk'), true);
    assert.equal(map.passable(3, 1, 'high', 'walk'), true);
    assert.equal(map.passable(3, 1, 'low', 'walk'), false);
    assert.equal(map.passable(3, 1, 'rising', 'walk'), false);
  });

  it('collision overrides: # blocks, . opens, L and H replace the tide class', () => {
    assert.equal(map.passable(0, 9, 'low', 'walk'), false, 'invisible wall on grass');
    assert.equal(map.passable(0, 5, 'high', 'walk'), true, 'ford through the shallows');
    assert.equal(map.passable(1, 4, 'low', 'walk'), true, 'L on shallows: wadeable at low tide');
    assert.equal(map.passable(1, 4, 'high', 'walk'), false);
    const def = structuredClone(harborDef);
    def.collision[6] = '-------------LH-'; // L on cliff (13,6), H on cliff (14,6)
    const m = load(def);
    assert.equal(m.passable(13, 6, 'low', 'walk'), true, 'L overrides solid');
    assert.equal(m.passable(13, 6, 'high', 'walk'), false);
    assert.equal(m.passable(14, 6, 'high', 'walk'), true, 'H overrides solid');
    assert.equal(m.passable(14, 6, 'low', 'walk'), false);
  });

  it('boats float where walkers would be under water', () => {
    assert.equal(map.passable(0, 0, 'low', 'boat'), true, 'deep');
    assert.equal(map.passable(4, 1, 'high', 'boat'), true, 'shallows');
    assert.equal(map.passable(6, 5, 'low', 'boat'), false, 'path');
    assert.equal(map.passable(9, 0, 'low', 'boat'), false, 'pier');
    assert.equal(map.passable(14, 4, 'low', 'boat'), false, 'causeway dry');
    assert.equal(map.passable(14, 4, 'high', 'boat'), true, 'causeway under water');
    assert.equal(map.passable(0, 6, 'high', 'boat'), true, 'wet sand floods');
    assert.equal(map.passable(0, 6, 'low', 'boat'), false);
    assert.equal(map.passable(0, 5, 'low', 'boat'), true, 'the ford is still water for a boat');
    assert.equal(map.passable(0, 9, 'low', 'boat'), false, '# blocks boats too');
    assert.equal(map.passable(3, 1, 'low', 'boat'), true, 'slipway afloat at low tide');
    assert.equal(map.passable(3, 1, 'high', 'boat'), false);
  });

  it('rejects a missing or garbage tide so callers cannot forget it', () => {
    assert.throws(() => map.passable(6, 5, undefined, 'walk'), TypeError);
    assert.throws(() => map.passable(6, 5, 'wet', 'walk'), TypeError);
    assert.deepEqual(MOVERS, ['walk', 'npc', 'roamer', 'boat']);
  });
});

describe('triggers, warps, spawns, regions', () => {
  const map = load();

  it('triggersAt returns every trigger covering the cell and a shared empty array otherwise', () => {
    assert.deepEqual(map.triggersAt(6, 5).map((t) => t.id), ['mailbox']);
    assert.deepEqual(map.triggersAt(6, 6).map((t) => t.id), ['green-enter', 'first-step']);
    assert.deepEqual(map.triggersAt(7, 7).map((t) => t.id), ['green-enter']);
    assert.equal(map.triggersAt(8, 8).length, 0);
    assert.equal(map.triggersAt(8, 8), map.triggersAt(0, 0), 'shared empty result');
    assert.equal(map.triggersAt(-1, 0), map.triggersAt(99, 99));
    assert.ok(Object.isFrozen(map.triggersAt(6, 6)));
    assert.equal(map.triggers.length, 3);
  });

  it('warpAt finds the warp on a cell, first listed wins', () => {
    assert.equal(map.warpAt(3, 8).to.mapId, 'cottage');
    assert.equal(map.warpAt(15, 4).kind, 'edge');
    assert.equal(map.warpAt(3, 9), null);
    assert.equal(map.warpAt(16, 4), null);
    const def = structuredClone(harborDef);
    def.warps.push({ x: 3, y: 8, to: { mapId: 'other', x: 0, y: 0 }, kind: 'door' });
    assert.equal(load(def).warpAt(3, 8).to.mapId, 'cottage');
    const wide = load(clone(harborDef, { warps: [{ x: 14, y: 4, w: 2, h: 1, to: { mapId: 'flats', x: 0, y: 4 }, kind: 'edge' }] }));
    assert.equal(wide.warpAt(14, 4).to.mapId, 'flats');
    assert.equal(wide.warpAt(15, 4).to.mapId, 'flats');
  });

  it('spawnAt resolves keyword areas by tile class and rect areas by cell, first listed wins', () => {
    assert.equal(map.spawnAt(4, 4).table, 'town-grass', 'grass');
    assert.equal(map.spawnAt(7, 7).table, 'town-grass', 'tall grass is grass');
    assert.equal(map.spawnAt(4, 1).table, 'quay-shallows', 'rect over the shallows');
    assert.equal(map.spawnAt(8, 1).table, 'quay-shallows');
    assert.equal(map.spawnAt(9, 1), null, 'the pier covers the shallows there');
    assert.equal(map.spawnAt(0, 0).table, 'open-sea', 'water keyword');
    assert.equal(map.spawnAt(6, 5), null, 'path spawns nothing');
    assert.equal(map.spawnAt(0, 6), null, 'wet sand is class mud, not water');
    assert.equal(map.spawnAt(99, 0), null);
    const noClass = { ...TILES, grass: { ...TILES.grass, spawn: undefined }, 'tall-grass': { ...TILES['tall-grass'], spawn: undefined } };
    const m = loadMap(harborDef, noClass, { legend: DEFAULT_LEGEND });
    assert.equal(m.spawnAt(7, 7).table, 'town-grass', "without a spawn class 'tall-grass' still contains 'grass'");
  });

  it('regions: inRegion and regionsAt', () => {
    assert.equal(map.inRegion('porch', 3, 9), true);
    assert.equal(map.inRegion('porch', 3, 8), false);
    assert.equal(map.inRegion('nope', 3, 9), false);
    assert.deepEqual(map.regionsAt(7, 3), ['quay', 'town']);
    assert.deepEqual(map.regionsAt(0, 0), []);
    assert.equal(map.regionsAt(0, 0), map.regionsAt(1, 1), 'shared empty result');
    assert.deepEqual(Object.keys(map.regions), ['porch', 'quay', 'town']);
  });

  it('passes entities, props, animated and glow lists through', () => {
    assert.equal(map.entities.length, 2);
    assert.equal(map.props.length, 3);
    const anim = map.animated;
    assert.ok(anim.every((a) => a.frames >= 2 && a.fps > 0));
    assert.equal(anim.filter((a) => a.id === 'deep').length, 30, 'every deep cell, including the one under the pier');
    assert.equal(anim.filter((a) => a.id === 'tall-grass').length, 2);
    assert.equal(anim.filter((a) => a.id === 'glow-mud').length, 8);
    const glowIds = map.glows.map((g) => `${g.id}@${g.x},${g.y}`);
    assert.ok(glowIds.includes('lamp@5,3'), 'detail lamp');
    assert.ok(glowIds.includes('lamp@7,3'), 'prop lamp');
    assert.ok(glowIds.includes('porch-light@5,8'));
    assert.ok(glowIds.includes('rune@9,3'));
    assert.ok(!glowIds.some((g) => g.startsWith('lighthouse')), 'non-tile prop art is ignored');
    assert.equal(map.glows.find((g) => g.x === 7 && g.y === 3).layer, -1);
    assert.equal(map.glows.find((g) => g.x === 11 && g.y === 7).prop.cond.flag, 'sp.inn-open');
  });
});

describe('autotile masks', () => {
  const map = load();

  it('water edge bits on a shore tile, cardinal and diagonal', () => {
    // (5,2) sand: water to the north only
    assert.equal(map.autotileMask(5, 2, 'water'), AUTOTILE.N);
    assert.equal(map.edgeMask(5, 2, 'water'), AUTOTILE.N);
    // (4,2) sand: north (4,1) shallows, west (3,2) shallows, NW (3,1) slipway... which is water at low tide
    assert.equal(map.autotileMask(4, 2, 'water', 'low'), AUTOTILE.N | AUTOTILE.W | AUTOTILE.NW);
    assert.equal(map.autotileMask(4, 2, 'water', 'high'), AUTOTILE.N | AUTOTILE.W, 'the slipway is dry at high tide');
    // (2,3) sand: north (2,2) shallows, west (1,3) shallows, NW (1,2) deep; SW (1,4) shallows but S (2,4) is sand -> no SW bit
    assert.equal(map.autotileMask(2, 3, 'water'), AUTOTILE.N | AUTOTILE.W | AUTOTILE.NW);
    // (3,4) sand: W (2,4) sand, N (3,3) sand, SW (2,5) sand -> nothing; (2,4): W (1,4) shallows only
    assert.equal(map.autotileMask(3, 4, 'water'), 0);
    assert.equal(map.autotileMask(2, 4, 'water'), AUTOTILE.W);
    // deep water in the open sea: everything around is water, including beyond the map edge
    assert.equal(map.autotileMask(0, 0, 'water'), 255);
    assert.equal(map.autotileMask(1, 1, 'water'), 255);
    // 'land' is the inverse class
    assert.equal(map.autotileMask(5, 2, 'land'), 255 & ~(AUTOTILE.N | AUTOTILE.NE | AUTOTILE.NW));
  });

  it('the tide changes the water class of causeway, flats and wet sand', () => {
    // (13,4) sand next to the causeway (14,4)
    assert.equal(map.autotileMask(13, 4, 'water', 'low') & AUTOTILE.E, 0);
    assert.equal(map.autotileMask(13, 4, 'water', 'mid') & AUTOTILE.E, AUTOTILE.E);
    assert.equal(map.autotileMask(13, 4, 'water', 0.9) & AUTOTILE.E, AUTOTILE.E);
    // (2,6) grass west of... (1,6) wet sand floods only at high
    assert.equal(map.autotileMask(2, 6, 'water', 'low') & AUTOTILE.W, 0);
    assert.equal(map.autotileMask(2, 6, 'water', 'high') & AUTOTILE.W, AUTOTILE.W);
    // (9,8) grass next to glow mud (10,8)
    assert.equal(map.autotileMask(9, 8, 'water', 'low') & AUTOTILE.E, 0);
    assert.equal(map.autotileMask(9, 8, 'water', 'high') & AUTOTILE.E, AUTOTILE.E);
    assert.equal(map.autotileMask(13, 4, 'water'), map.autotileMask(13, 4, 'water', 'low'), 'tide defaults to low');
  });

  it('cliff rims and same-tile paths', () => {
    // cliff block at x 13..14, y 6..7; (13,6): E and S and SE are cliff
    assert.equal(map.autotileMask(13, 6, 'solid'), AUTOTILE.E | AUTOTILE.S | AUTOTILE.SE);
    assert.equal(map.autotileMask(14, 7, 'solid'), AUTOTILE.N | AUTOTILE.W | AUTOTILE.NW);
    assert.equal(map.autotileMask(12, 6, 'solid'), AUTOTILE.E, 'SE (13,7) is cliff but S (12,7) is grass, so no SE bit');
    // the invisible wall counts as solid for rims
    assert.equal(map.autotileMask(1, 9, 'solid') & AUTOTILE.W, AUTOTILE.W);
    // path corner at (6,5): path runs E (7,5) and S (6,6) -> SE (7,6) is grass so no SE bit
    assert.equal(map.autotileMask(6, 5, 'same'), AUTOTILE.E | AUTOTILE.S);
    assert.equal(map.autotileMask(6, 6, 'path'), AUTOTILE.N | AUTOTILE.S);
    assert.equal(map.autotileMask(6, 6, 'same'), map.autotileMask(6, 6, 'path'));
    // predicate match
    assert.equal(map.autotileMask(6, 5, (def) => def && def.sfx === 'dirt'), AUTOTILE.E | AUTOTILE.S);
    // a detail id matches too
    assert.equal(map.autotileMask(9, 1, 'pier') & AUTOTILE.N, AUTOTILE.N);
  });

  it('autotile masks are stable across calls and allocate nothing observable', () => {
    const a = map.autotileMask(4, 2, 'water', 'low');
    for (let i = 0; i < 1000; i++) assert.equal(map.autotileMask(4, 2, 'water', 'low'), a);
    assert.equal(typeof a, 'number');
  });
});

/**
 * Fixtures for the WORLD-ENT lane tests: a tileset, a map definition (ARCHITECTURE §4.1 / §14.4),
 * an encounter table (§14.11), a tiny data registry stub and a minimal pure RuntimeMap builder that
 * honours the §4.2 contract (`passable(x, y, tideState, mover)`, `tileAt`, `triggersAt`, `warpAt`,
 * `spawnAt`, `regions`). `js/world/tilemap.js` (WORLD-MAP) is the real implementation; this builder
 * exists only so WORLD-ENT modules can be tested before it lands.
 */

/** Tile definitions in the `data/tilesets.js` shape `{id -> {art, solid, water, tide, verb, sfx, anim, glow}}`. */
export const TILES = Object.freeze({
  grass:        { art: 'grass',      solid: false, water: false, tide: null,  verb: null,   sfx: 'step',      anim: 0, glow: false },
  'tall-grass': { art: 'tall-grass', solid: false, water: false, tide: null,  verb: null,   sfx: 'step',      anim: 0, glow: false },
  sand:         { art: 'sand',       solid: false, water: false, tide: null,  verb: null,   sfx: 'step',      anim: 0, glow: false },
  path:         { art: 'path',       solid: false, water: false, tide: null,  verb: null,   sfx: 'step',      anim: 0, glow: false },
  deep:         { art: 'deep',       solid: false, water: true,  tide: null,  verb: 'fish', sfx: 'stepWater', anim: 4, glow: false },
  causeway:     { art: 'causeway',   solid: false, water: false, tide: 'low', verb: null,   sfx: 'step',      anim: 0, glow: false },
  mud:          { art: 'mud',        solid: false, water: false, tide: 'low', verb: 'dig',  sfx: 'step',      anim: 0, glow: true },
  wall:         { art: 'wall',       solid: true,  water: false, tide: null,  verb: 'look', sfx: null,        anim: 0, glow: false },
});

/** Legend chars -> tile ids (stands in for `tilesets.DEFAULT_LEGEND`). */
export const LEGEND = Object.freeze({
  G: 'grass', T: 'tall-grass', A: 'sand', P: 'path', D: 'deep', E: 'causeway', M: 'mud', '#': 'wall',
});

/** Encounter tables in the §14.11 shape, with the optional roamer hints WORLD-ENT reads. */
export const ENCOUNTERS = Object.freeze({
  'test-grass': Object.freeze([
    Object.freeze({ species: 'puddlepip', levels: [2, 4], w: 40 }),
    Object.freeze({ species: 'wirewhisk', levels: [3, 5], w: 25, behaviour: 'approach' }),
    Object.freeze({ species: 'chillnub', levels: [3, 5], w: 20, cond: { phase: ['night', 'evening'] } }),
    Object.freeze({ species: 'squallcoil', levels: [30, 30], w: 0.1, errant: true, cond: { weather: ['storm'] } }),
  ]),
  'test-flats': Object.freeze([
    Object.freeze({ species: 'mudlurk', levels: [4, 6], w: 10, cond: { tide: ['low'] } }),
  ]),
});

/**
 * Two islands joined by a causeway (row 3, columns 5-6) that is dry only at low tide; mud flats at
 * the bottom right; a walled hut with a door on the west island.
 *
 *     0123456789AB
 *   0 ########GGGG
 *   1 #PPP#GGGTTGG
 *   2 #PPP#GGGTTGG
 *   3 PPPPPEEGGGGG      <- (5,3),(6,3) causeway
 *   4 GGGGGDDGGGGA
 *   5 GGGGGDDGGGAA
 *   6 GGGGGDDGGMMA
 *   7 GGGGGDDGGMMM
 */
export const MAP_DEF = Object.freeze({
  id: 'test-isle', name: 'Test Isle', kind: 'exterior', region: 'test', w: 12, h: 8,
  legend: {},
  ground: Object.freeze([
    '########GGGG',
    '#PPP#GGGTTGG',
    '#PPP#GGGTTGG',
    'PPPPPEEGGGGG',
    'GGGGGDDGGGGA',
    'GGGGGDDGGGAA',
    'GGGGGDDGGMMA',
    'GGGGGDDGGMMM',
  ]),
  entities: Object.freeze([
    { kind: 'npc', id: 'wren', x: 2, y: 5, facing: 'down' },
    { kind: 'item', id: 'quay-potion', item: 'potion', x: 1, y: 6 },
    { kind: 'sign', id: 'isle-sign', x: 3, y: 6, text: 'Mind the tide.' },
    { kind: 'tree', id: 'pear-1', x: 9, y: 1, fruit: 'pear' },
    { kind: 'crack', id: 'crack-1', x: 10, y: 4 },
    { kind: 'npc', id: 'ghost', x: 4, y: 7, cond: { flag: 'sp.ghost' } },
  ]),
  triggers: Object.freeze([
    { x: 3, y: 4, kind: 'use', id: 'mailbox', verb: 'mailbox' },
    { x: 2, y: 5, kind: 'use', id: 'bench', verb: 'sit' },
    { x: 0, y: 3, kind: 'step', id: 'west-edge', script: 'arrive-west' },
  ]),
  warps: Object.freeze([
    { x: 2, y: 2, to: { mapId: 'int-hut', x: 2, y: 4, facing: 'up' }, kind: 'door', sfx: 'doorOpen' },
  ]),
  spawns: Object.freeze([
    { area: 'grass', table: 'test-grass', rate: 0.08 },
    { area: { x: 9, y: 6, w: 3, h: 2 }, table: 'test-flats', rate: 0.2 },
  ]),
  regions: Object.freeze({ hut: { x: 1, y: 1, w: 3, h: 2 } }),
  entry: Object.freeze({ x: 2, y: 4, facing: 'up' }),
});

/** Item rows: `use` names the verb a tool enables. */
export const ITEMS = Object.freeze({
  rod:    { id: 'rod', name: 'Rod', pocket: 'tools', use: 'fish' },
  shovel: { id: 'shovel', name: 'Shovel', pocket: 'tools', use: 'dig' },
  net:    { id: 'net', name: 'Net', pocket: 'tools', use: 'catch' },
  potion: { id: 'potion', name: 'Potion', pocket: 'items', use: 'heal' },
});

/**
 * Minimal registry stub with the §1 `data/registry.js` read surface.
 * @param {Record<string, Record<string, object>>} [tables]
 */
export function createDataStub(tables = { items: ITEMS, encounters: ENCOUNTERS }) {
  return {
    has: (table, id) => Boolean(tables[table] && Object.prototype.hasOwnProperty.call(tables[table], id)),
    get(table, id) {
      if (!this.has(table, id)) throw new Error(`data: no ${table} '${id}'`);
      return tables[table][id];
    },
    list: (table) => Object.values(tables[table] || {}),
  };
}

/**
 * Which spawn `area` strings a tile answers to.
 * @param {string} tileId
 * @param {object} tile
 * @returns {string|null}
 */
function spawnClassOf(tileId, tile) {
  if (tileId === 'grass' || tileId === 'tall-grass') return 'grass';
  if (tile.water) return 'water';
  if (tileId === 'mud') return 'mud';
  return null;
}

/**
 * Builds a RuntimeMap-compatible object from a MapDef and a tileset (§4.2 read surface only).
 * @param {object} [def]
 * @param {Record<string, object>} [tiles]
 * @param {Record<string, string>} [legend]
 */
export function buildRuntimeMap(def = MAP_DEF, tiles = TILES, legend = LEGEND) {
  const { w, h } = def;
  const merged = { ...legend, ...(def.legend || {}) };
  const ids = new Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = def.ground[y];
    for (let x = 0; x < w; x++) {
      const id = merged[row[x]];
      if (!id || !tiles[id]) throw new Error(`fixture map: unknown legend char '${row[x]}' at ${x},${y}`);
      ids[y * w + x] = id;
    }
  }
  const collision = def.collision || null;
  const infos = ids.map((id, i) => Object.freeze({ id, x: i % w, y: (i / w) | 0, ...tiles[id] }));
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const inRect = (r, x, y) => x >= r.x && y >= r.y && x < r.x + (r.w || 1) && y < r.y + (r.h || 1);

  return {
    id: def.id, w, h, def,
    layers: [],
    tideMask: new Uint8Array(w * h).map((_, i) => (tiles[ids[i]].tide === 'low' ? 1 : tiles[ids[i]].tide === 'high' ? 2 : 0)),
    animated: [],
    regions: def.regions || {},
    /** @param {number} x @param {number} y @param {string} tideState @param {string} mover */
    passable(x, y, tideState, mover) {
      if (!inside(x, y)) return false;
      const t = tiles[ids[y * w + x]];
      if (collision) {
        const c = collision[y][x];
        if (c === '#') return false;
        if (c === '.') return true;
        if (c === 'L') return tideState === 'low';
        if (c === 'H') return tideState === 'high';
      }
      if (t.solid) return false;
      if (t.tide === 'low') return mover === 'boat' ? tideState !== 'low' : tideState === 'low';
      if (t.tide === 'high') return mover === 'boat' ? tideState === 'high' : tideState !== 'high';
      if (t.water) return mover === 'boat';
      return mover !== 'boat';
    },
    tileAt: (x, y) => (inside(x, y) ? infos[y * w + x] : null),
    triggersAt: (x, y) => def.triggers.filter((t) => inRect(t, x, y)),
    warpAt: (x, y) => def.warps.find((wp) => inRect(wp, x, y)) || null,
    spawnAt(x, y) {
      if (!inside(x, y)) return null;
      const cls = spawnClassOf(ids[y * w + x], tiles[ids[y * w + x]]);
      for (const s of def.spawns) {
        if (typeof s.area === 'string' ? s.area === cls : inRect(s.area, x, y)) return s;
      }
      return null;
    },
  };
}

/**
 * A `World`-shaped stub with the keys WORLD-ENT reads (`player`, `maps`, `flags`, `clock`).
 * `clock.total` is chosen so `state/selectors.tideState` reports the requested state for seed `null`.
 * @param {{tide?: 'low'|'high', mapId?: string, x?: number, y?: number, facing?: string, tool?: string|null}} [o]
 */
export function createWorldStub(o = {}) {
  // With seed null the tide offset is 0: total 0 is low water, half a period later is high water.
  const total = o.tide === 'high' ? 372 : 0;
  return {
    v: 1,
    clock: { version: 1, total, speed: 1, paused: false, realClock: false, seed: null },
    player: {
      name: 'Tess', species: 'otter', pronouns: 'they', look: { fur: 0, marks: 0, outfit: 0 },
      mapId: o.mapId ?? MAP_DEF.id, x: o.x ?? 2, y: o.y ?? 4, facing: o.facing ?? 'up',
      tool: o.tool ?? null, lastTool: null, toolRing: [], title: '',
    },
    maps: { [MAP_DEF.id]: { visited: true, picked: {}, trees: {}, cracks: {}, reach: {}, opened: [] } },
    flags: {},
    counters: {},
    weather: { today: 'clear', tomorrow: 'clear', intensity: 0 },
  };
}

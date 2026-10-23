/**
 * Runtime map (ARCHITECTURE §4.1, §4.2, §14.4). Pure: no DOM, no canvas, no data imports.
 *
 * {@link loadMap} parses a hand-edited ASCII map definition against a tileset and returns a
 * {@link RuntimeMap}: typed-array layers, passability derived from the tile definitions (with the
 * optional `collision` override layer), per-cell trigger / warp / spawn lookups, named regions and
 * the autotile neighbour mask renderers use for shore foam, cliff rims and path corners.
 *
 * Map and tile definitions arrive as **arguments** (`js/data/maps/<map>.js` default export and
 * `js/data/tilesets.TILES`); this module never imports `js/data`. Everything the renderer and the
 * movement code ask per step or per chunk bake is allocation-free: `passable`, `layerTile`,
 * `triggersAt`, `warpAt`, `spawnAt` and `autotileMask` return numbers, cached objects or shared
 * frozen arrays.
 *
 * Lane: WORLD-MAP.
 * @module world/tilemap
 */

import { COLLISION, COLLISION_CHARS, TIDE_MASK, tideMaskOf, tideVariant, gateOpen } from './tide.js';

/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {import('./tide.js').TideVariant} TideVariant */

/**
 * One entry of `data/tilesets.TILES` (§1 manifest). Every field but `art` is optional.
 * @typedef {Object} TileDef
 * @property {string} [art]            art id for `art/atlas.getTile`; defaults to the tile id
 * @property {boolean} [solid]         blocks every mover
 * @property {boolean} [water]         open sea / river: blocks walkers, carries boats, fishable
 * @property {'low'|'high'|'floods'|'glow'|null} [tide]   tide class, see {@link TIDE_MASK}
 * @property {string|null} [verb]      context verb offered when facing the tile ('fish', 'dig', 'look')
 * @property {string|null} [sfx]       footstep sfx id
 * @property {number|{frames: number, fps?: number}|null} [anim]   animated tile: frame count (+ fps)
 * @property {boolean|string|GlowDef|null} [glow]   emits light; see {@link GlowDef}
 * @property {string} [spawn]          spawn class for keyword spawn areas ('grass', 'water', 'mud')
 */

/**
 * Normalised light definition of a glowing tile (lighting.js reads `RuntimeMap.glows`).
 * @typedef {Object} GlowDef
 * @property {'lamp'|'porch'|'window'|'bio'|'rune'|'fire'|string} kind
 * @property {string|null} color      hex colour of the pool (`null` = renderer default for the kind)
 * @property {number} radius          pool radius in pixels
 * @property {'night'|'always'|'night-low'} when   lit after dusk, always, or at night on low tide
 * @property {string|null} flag       world flag that must be truthy (porches: the house is occupied)
 * @property {number} ox              pixel offset of the light centre from the tile centre
 * @property {number} oy
 */

/**
 * Map definition module shape (§4.1 / §14.4).
 * @typedef {Object} MapDef
 * @property {string} id
 * @property {string} name
 * @property {'exterior'|'interior'} kind
 * @property {string} region
 * @property {number} w
 * @property {number} h
 * @property {Record<string, string>} [legend]   char -> tile id, merged over the default legend
 * @property {string[]} ground
 * @property {string[]|null} [detail]
 * @property {string[]|null} [overlay]
 * @property {string[]|null} [collision]        '#' solid '.' open '-' inherit 'L' low-tide only 'H' high-tide only
 * @property {PropDef[]} [props]
 * @property {EntityDef[]} [entities]
 * @property {TriggerDef[]} [triggers]
 * @property {WarpDef[]} [warps]
 * @property {SpawnDef[]} [spawns]
 * @property {Record<string, Rect>} [regions]
 * @property {string} [music]
 * @property {{indoor?: boolean, ambient?: string}} [light]
 * @property {{x: number, y: number, facing?: string}} entry
 */
/** @typedef {{x: number, y: number, w: number, h: number}} Rect */
/** @typedef {{art: string, x: number, y: number, cond?: any}} PropDef */
/** @typedef {{kind: string, id: string, x: number, y: number, cond?: any, [k: string]: any}} EntityDef */
/** @typedef {{x: number, y: number, w?: number, h?: number, kind: 'step'|'use'|'enter', id: string, cond?: any, script?: string, verb?: string, once?: boolean}} TriggerDef */
/** @typedef {{x: number, y: number, w?: number, h?: number, to: {mapId: string, x: number, y: number, facing?: string}, kind: 'door'|'edge'|'stairs', cond?: any, sfx?: string}} WarpDef */
/** @typedef {{area: Rect|'grass'|'water'|'mud'|string, table: string, rate: number, cond?: any}} SpawnDef */

/**
 * Merged per-cell information from {@link RuntimeMap.tileAt}. Properties fall through from the
 * detail tile to the ground tile when the detail definition leaves them undefined (a bridge over
 * a river is dry; a flower on grass stays grass). The overlay layer never affects passability.
 * @typedef {Object} TileInfo
 * @property {number} x
 * @property {number} y
 * @property {number} i          cell index `y * w + x`
 * @property {string|null} id    the topmost of detail / ground
 * @property {string|null} ground
 * @property {string|null} detail
 * @property {string|null} overlay
 * @property {boolean} solid
 * @property {boolean} water
 * @property {number} tide       {@link TIDE_MASK} code
 * @property {number} collision  {@link COLLISION} code from the override layer
 * @property {string|null} verb
 * @property {string|null} sfx
 * @property {string} art
 * @property {{frames: number, fps: number}|null} anim
 * @property {GlowDef|null} glow
 * @property {string|null} spawn spawn class
 */

/** Layer indexes into {@link RuntimeMap.layers}. @enum {number} */
export const LAYER = Object.freeze({ GROUND: 0, DETAIL: 1, OVERLAY: 2 });

/** Layer names in index order. */
export const LAYER_NAMES = Object.freeze(['ground', 'detail', 'overlay']);

/** Movers `passable` distinguishes. Walkers share one rule; boats need water. */
export const MOVERS = Object.freeze(['walk', 'npc', 'roamer', 'boat']);

/**
 * Autotile neighbour bits returned by {@link RuntimeMap.autotileMask} (clockwise from north).
 * @enum {number}
 */
export const AUTOTILE = Object.freeze({ N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 });

/** Default frame rate for a tile whose `anim` is a bare frame count. */
export const DEFAULT_ANIM_FPS = 4;

/** Default light pool radius in pixels for a tile with `glow: true`. */
export const DEFAULT_GLOW_RADIUS = 40;

/** Default `when` per glow kind; anything else defaults to `'night'`. */
const GLOW_WHEN = Object.freeze({ bio: 'night-low', rune: 'always', fire: 'always' });

/** Shared empty results, so lookups never allocate for the common "nothing here" case. */
const NO_TRIGGERS = Object.freeze([]);
const NO_REGIONS = Object.freeze([]);

/**
 * Parses a map definition against a tileset.
 *
 * Throws a readable `Error` (`map <id>: ...`) on malformed data: wrong row counts or lengths, a
 * character missing from the legend, a legend entry naming an unknown tile, an unknown
 * `collision` character, a bad `tide` value, an out-of-bounds trigger / warp / entry. The content
 * validator reports the same problems in bulk; this is the last line of defence.
 *
 * @param {MapDef} def
 * @param {Record<string, TileDef>} tiles   `data/tilesets.TILES`: tile id -> definition
 * @param {{legend?: Record<string, string>}} [opts]   `legend`: `data/tilesets.DEFAULT_LEGEND`, merged under `def.legend`
 * @returns {RuntimeMap}
 */
export function loadMap(def, tiles, opts) {
  if (!def || typeof def !== 'object') throw new TypeError('loadMap: def must be a map definition object');
  if (!tiles || typeof tiles !== 'object') throw new TypeError('loadMap: tiles must be the tileset record {id -> TileDef}');
  const id = typeof def.id === 'string' && def.id ? def.id : '?';
  const fail = (msg) => { throw new Error(`map ${id}: ${msg}`); };
  if (id === '?') fail('id must be a non-empty string');
  const w = def.w;
  const h = def.h;
  if (!Number.isInteger(w) || w <= 0 || !Number.isInteger(h) || h <= 0) fail(`w/h must be positive integers (got ${w}x${h})`);
  if (!Array.isArray(def.ground)) fail('ground must be an array of rows');
  if (!def.entry || !Number.isInteger(def.entry.x) || !Number.isInteger(def.entry.y)) fail('entry {x, y} is required');
  if (def.entry.x < 0 || def.entry.y < 0 || def.entry.x >= w || def.entry.y >= h) fail(`entry (${def.entry.x}, ${def.entry.y}) is outside ${w}x${h}`);

  const legend = Object.assign({}, (opts && opts.legend) || {}, def.legend || {});
  const n = w * h;

  // --- tile index: 0 = none; every id used by this map (via legend or props) gets one slot --------
  /** @type {(string|null)[]} */
  const tileIds = [null];
  /** @type {(TileDef|null)[]} */
  const tileDefs = [null];
  /** @type {Map<string, number>} */
  const slotOf = new Map();
  const slotFor = (tileId, where) => {
    let s = slotOf.get(tileId);
    if (s !== undefined) return s;
    const td = tiles[tileId];
    if (!td || typeof td !== 'object') fail(`${where} names unknown tile '${tileId}'`);
    s = tileIds.length;
    tileIds.push(tileId);
    tileDefs.push(td);
    slotOf.set(tileId, s);
    return s;
  };

  // --- layers ---------------------------------------------------------------------------------
  const layers = [new Uint16Array(n), new Uint16Array(n), new Uint16Array(n)];
  const parseLayer = (rows, name, out) => {
    if (rows === null || rows === undefined) return;
    if (!Array.isArray(rows) || rows.length !== h) fail(`${name} has ${Array.isArray(rows) ? rows.length : 'no'} rows, want ${h}`);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      if (typeof row !== 'string' || row.length !== w) fail(`${name}[${y}] has ${typeof row === 'string' ? row.length : 'no'} chars, want ${w}`);
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const tileId = legend[ch];
        if (tileId === undefined) fail(`${name}[${y}][${x}] char '${ch}' is not in the legend`);
        if (tileId === null) continue;
        out[y * w + x] = slotFor(tileId, `legend '${ch}'`);
      }
    }
  };
  parseLayer(def.ground, 'ground', layers[LAYER.GROUND]);
  parseLayer(def.detail, 'detail', layers[LAYER.DETAIL]);
  parseLayer(def.overlay, 'overlay', layers[LAYER.OVERLAY]);

  // --- collision override layer -----------------------------------------------------------------
  const collision = new Uint8Array(n);
  if (def.collision !== null && def.collision !== undefined) {
    const rows = def.collision;
    if (!Array.isArray(rows) || rows.length !== h) fail(`collision has ${Array.isArray(rows) ? rows.length : 'no'} rows, want ${h}`);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      if (typeof row !== 'string' || row.length !== w) fail(`collision[${y}] has ${typeof row === 'string' ? row.length : 'no'} chars, want ${w}`);
      for (let x = 0; x < w; x++) {
        const code = COLLISION_CHARS.indexOf(row[x]);
        if (code < 0) fail(`collision[${y}][${x}] char '${row[x]}' is not one of ${COLLISION_CHARS.join(' ')}`);
        collision[y * w + x] = code;
      }
    }
  }

  // --- per-tile classification, baked once (detail falls through to ground per property) ---------
  const solidMask = new Uint8Array(n);
  const waterMask = new Uint8Array(n);
  const tideMask = new Uint8Array(n);
  /** @type {number[]} slot -> tide mask code, validated once per tile */
  const slotTide = tileDefs.map((td, s) => {
    if (!td) return 0;
    try {
      return tideMaskOf(td.tide);
    } catch (e) {
      return fail(`tile '${tileIds[s]}': ${e.message}`);
    }
  });
  const ground = layers[LAYER.GROUND];
  const detail = layers[LAYER.DETAIL];
  for (let i = 0; i < n; i++) {
    const g = tileDefs[ground[i]];
    const d = tileDefs[detail[i]];
    const solid = pick(d, g, 'solid');
    const water = pick(d, g, 'water');
    // a cell with no ground tile at all is void: solid
    solidMask[i] = g === null && d === null ? 1 : solid === true ? 1 : 0;
    waterMask[i] = water === true ? 1 : 0;
    tideMask[i] = d && d.tide !== undefined ? slotTide[detail[i]] : slotTide[ground[i]];
  }

  // --- animated and glowing cells (all three layers) -----------------------------------------------
  /** @type {{x: number, y: number, layer: number, id: string, frames: number, fps: number}[]} */
  const animated = [];
  /** @type {{x: number, y: number, layer: number, id: string, glow: GlowDef}[]} */
  const glows = [];
  /** @type {(({frames: number, fps: number})|null)[]} */
  const slotAnim = tileDefs.map((td, s) => (td ? normaliseAnim(td.anim, tileIds[s], fail) : null));
  /** @type {(GlowDef|null)[]} */
  const slotGlow = tileDefs.map((td, s) => (td ? normaliseGlow(td.glow, tileIds[s], fail) : null));
  for (let L = 0; L < 3; L++) {
    const layer = layers[L];
    for (let i = 0; i < n; i++) {
      const s = layer[i];
      if (s === 0) continue;
      const x = i % w;
      const y = (i - x) / w;
      const a = slotAnim[s];
      if (a) animated.push({ x, y, layer: L, id: /** @type {string} */ (tileIds[s]), frames: a.frames, fps: a.fps });
      const gl = slotGlow[s];
      if (gl) glows.push({ x, y, layer: L, id: /** @type {string} */ (tileIds[s]), glow: gl });
    }
  }
  // props whose art is itself a glowing tile (lamps, the lighthouse) light the map too
  const props = Object.freeze(Array.isArray(def.props) ? def.props.slice() : []);
  for (const p of props) {
    if (!p || typeof p.art !== 'string') fail('every prop needs an art id');
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) fail(`prop '${p.art}' needs integer x, y`);
    const td = tiles[p.art];
    if (!td) continue; // prop art that is not a tile (buildings, trees) is the renderer's business
    const gl = normaliseGlow(td.glow, p.art, fail);
    if (gl) glows.push({ x: p.x, y: p.y, layer: -1, id: p.art, glow: gl, prop: p });
  }

  // --- triggers, warps, spawns, regions --------------------------------------------------------------
  const triggers = Object.freeze(Array.isArray(def.triggers) ? def.triggers.slice() : []);
  const warps = Object.freeze(Array.isArray(def.warps) ? def.warps.slice() : []);
  const spawns = Object.freeze(Array.isArray(def.spawns) ? def.spawns.slice() : []);
  const entities = Object.freeze(Array.isArray(def.entities) ? def.entities.slice() : []);
  const regions = Object.freeze(Object.assign({}, def.regions || {}));

  /** @type {(TriggerDef[]|undefined)[]} per-cell trigger lists (sparse) */
  const triggerCells = new Array(n);
  triggers.forEach((t, k) => {
    checkRect(t, `triggers[${k}]`, w, h, fail);
    if (typeof t.id !== 'string' || !t.id) fail(`triggers[${k}] needs an id`);
    forRect(t, w, (i) => {
      (triggerCells[i] || (triggerCells[i] = [])).push(t);
    });
  });
  for (let i = 0; i < n; i++) if (triggerCells[i]) triggerCells[i] = Object.freeze(triggerCells[i]);

  /** @type {Int16Array} per-cell warp index (-1 none; first warp listed wins) */
  const warpCells = new Int16Array(n).fill(-1);
  warps.forEach((wp, k) => {
    checkRect(wp, `warps[${k}]`, w, h, fail);
    if (!wp.to || typeof wp.to.mapId !== 'string' || !Number.isInteger(wp.to.x) || !Number.isInteger(wp.to.y)) fail(`warps[${k}] needs to {mapId, x, y}`);
    forRect(wp, w, (i) => {
      if (warpCells[i] < 0) warpCells[i] = k;
    });
  });

  /** @type {Int16Array} per-cell spawn index (-1 none; first spawn listed wins) */
  const spawnCells = new Int16Array(n).fill(-1);
  spawns.forEach((sp, k) => {
    if (!sp || typeof sp.table !== 'string') fail(`spawns[${k}] needs a table id`);
    if (sp.area && typeof sp.area === 'object') {
      checkRect(sp.area, `spawns[${k}].area`, w, h, fail);
      forRect(sp.area, w, (i) => {
        if (spawnCells[i] < 0) spawnCells[i] = k;
      });
    } else if (typeof sp.area === 'string') {
      const cls = sp.area;
      for (let i = 0; i < n; i++) {
        if (spawnCells[i] >= 0) continue;
        if (cellMatchesClass(cls, tileDefs[detail[i]], tileIds[detail[i]], tileDefs[ground[i]], tileIds[ground[i]], waterMask[i])) spawnCells[i] = k;
      }
    } else {
      fail(`spawns[${k}].area must be a rect or a class keyword`);
    }
  });

  for (const [name, r] of Object.entries(regions)) checkRect(r, `regions.${name}`, w, h, fail);

  /** @type {(TileInfo|undefined)[]} lazily built, one object per cell, reused afterwards */
  const infoCache = new Array(n);

  // --- the map ---------------------------------------------------------------------------------------
  /** @type {RuntimeMap} */
  const map = {
    id,
    name: typeof def.name === 'string' ? def.name : id,
    kind: def.kind === 'interior' ? 'interior' : 'exterior',
    region: typeof def.region === 'string' ? def.region : '',
    w,
    h,
    def,
    indoor: Boolean(def.light && def.light.indoor) || def.kind === 'interior',
    entry: Object.freeze({ x: def.entry.x, y: def.entry.y, facing: def.entry.facing || 'down' }),
    layers,
    tileIds: Object.freeze(tileIds),
    tileDefs: Object.freeze(tileDefs),
    collision,
    solidMask,
    waterMask,
    tideMask,
    animated: Object.freeze(animated),
    glows: Object.freeze(glows),
    props,
    entities,
    triggers,
    warps,
    spawns,
    regions,

    inBounds(x, y) {
      return x >= 0 && y >= 0 && x < w && y < h && Number.isInteger(x) && Number.isInteger(y);
    },

    index(x, y) {
      return x >= 0 && y >= 0 && x < w && y < h && Number.isInteger(x) && Number.isInteger(y) ? y * w + x : -1;
    },

    layerTile(layer, x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const arr = layers[layer];
      if (!arr) throw new RangeError(`layerTile: layer ${layer} is not 0..2`);
      return tileIds[arr[y * w + x]];
    },

    layerDef(layer, x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const arr = layers[layer];
      if (!arr) throw new RangeError(`layerDef: layer ${layer} is not 0..2`);
      return tileDefs[arr[y * w + x]];
    },

    passable(x, y, tide, mover) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const i = y * w + x;
      const c = collision[i];
      if (c === COLLISION.SOLID) return false;
      const v = tideVariant(tide);
      const boat = mover === 'boat';
      if (c === COLLISION.OPEN) return !boat || waterMask[i] === 1;
      const gate = c === COLLISION.LOW ? TIDE_MASK.LOW_ONLY : c === COLLISION.HIGH ? TIDE_MASK.HIGH_ONLY : tideMask[i];
      if (c === COLLISION.INHERIT && solidMask[i] === 1) return false;
      const open = gateOpen(gate, v);
      if (boat) {
        // a boat floats wherever a walker would be under water
        if (gate === TIDE_MASK.NONE) return waterMask[i] === 1;
        if (gate === TIDE_MASK.FLOODS) return v === 'high';
        return !open;
      }
      if (!open) return false;
      return gate !== TIDE_MASK.NONE || waterMask[i] === 0;
    },

    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h || !Number.isInteger(x) || !Number.isInteger(y)) return null;
      const i = y * w + x;
      let info = infoCache[i];
      if (info) return info;
      const gs = ground[i];
      const ds = detail[i];
      const os = layers[LAYER.OVERLAY][i];
      const g = tileDefs[gs];
      const d = tileDefs[ds];
      const topSlot = ds !== 0 ? ds : gs;
      const top = tileDefs[topSlot];
      info = Object.freeze({
        x,
        y,
        i,
        id: tileIds[topSlot],
        ground: tileIds[gs],
        detail: tileIds[ds],
        overlay: tileIds[os],
        solid: solidMask[i] === 1,
        water: waterMask[i] === 1,
        tide: tideMask[i],
        collision: collision[i],
        verb: pick(d, g, 'verb') ?? null,
        sfx: pick(d, g, 'sfx') ?? null,
        art: top ? (typeof top.art === 'string' ? top.art : /** @type {string} */ (tileIds[topSlot])) : '',
        anim: slotAnim[topSlot] ?? (ds !== 0 ? slotAnim[gs] : null),
        glow: slotGlow[topSlot] ?? (ds !== 0 ? slotGlow[gs] : null),
        spawn: pick(d, g, 'spawn') ?? null,
      });
      infoCache[i] = info;
      return info;
    },

    triggersAt(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return NO_TRIGGERS;
      return triggerCells[y * w + x] || NO_TRIGGERS;
    },

    warpAt(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const k = warpCells[y * w + x];
      return k < 0 ? null : warps[k];
    },

    spawnAt(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const k = spawnCells[y * w + x];
      return k < 0 ? null : spawns[k];
    },

    inRegion(name, x, y) {
      const r = regions[name];
      return Boolean(r) && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
    },

    regionsAt(x, y) {
      let out = null;
      for (const name in regions) {
        const r = regions[name];
        if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) (out || (out = [])).push(name);
      }
      return out || NO_REGIONS;
    },

    autotileMask(x, y, match, tide) {
      return autotileMaskAt(map, x, y, match, tide);
    },

    edgeMask(x, y, match, tide) {
      return autotileMaskAt(map, x, y, match, tide) & 15;
    },
  };
  return Object.freeze(map);
}

/**
 * @typedef {Object} RuntimeMap
 * @property {string} id
 * @property {string} name
 * @property {'exterior'|'interior'} kind
 * @property {string} region
 * @property {number} w
 * @property {number} h
 * @property {MapDef} def                 the source definition (frozen by its data module)
 * @property {boolean} indoor             `def.light.indoor` or `kind === 'interior'`: fixed lamp grade
 * @property {{x: number, y: number, facing: string}} entry
 * @property {Uint16Array[]} layers       `[ground, detail, overlay]` tile slots (0 = none); see `tileIds`
 * @property {readonly (string|null)[]} tileIds    slot -> tile id (slot 0 is `null`)
 * @property {readonly (TileDef|null)[]} tileDefs  slot -> tile definition
 * @property {Uint8Array} collision       per cell {@link COLLISION} code from the override layer
 * @property {Uint8Array} solidMask       per cell 1 = solid by tile definition (void cells are solid)
 * @property {Uint8Array} waterMask       per cell 1 = water by tile definition
 * @property {Uint8Array} tideMask        per cell {@link TIDE_MASK} code (0 none, 1 low-only, 2 high-only, 3 floods-visually-at-high, 4 glows-at-night-low)
 * @property {readonly {x: number, y: number, layer: number, id: string, frames: number, fps: number}[]} animated   tiles not baked into chunks (validator caps at 400)
 * @property {readonly {x: number, y: number, layer: number, id: string, glow: GlowDef, prop?: PropDef}[]} glows   light-emitting cells (layer -1 = from a prop)
 * @property {readonly PropDef[]} props
 * @property {readonly EntityDef[]} entities
 * @property {readonly TriggerDef[]} triggers
 * @property {readonly WarpDef[]} warps
 * @property {readonly SpawnDef[]} spawns
 * @property {Readonly<Record<string, Rect>>} regions
 * @property {(x: number, y: number) => boolean} inBounds
 * @property {(x: number, y: number) => number} index        cell index `y * w + x`, or -1 outside
 * @property {(layer: number, x: number, y: number) => string|null} layerTile   tile id in a layer (null = none / outside)
 * @property {(layer: number, x: number, y: number) => TileDef|null} layerDef
 * @property {(x: number, y: number, tide: number|TideState|TideVariant, mover?: 'walk'|'npc'|'roamer'|'boat') => boolean} passable
 *   Walkers: not solid, not water, tide gate open. Boats: afloat (water, or a closed gate). The
 *   `collision` layer wins: `'#'` blocks everyone, `'.'` opens for walkers (boats still need water),
 *   `'L'` / `'H'` replace the tile's tide class. Outside the map is never passable.
 * @property {(x: number, y: number) => TileInfo|null} tileAt   merged info (cached per cell)
 * @property {(x: number, y: number) => readonly TriggerDef[]} triggersAt   shared empty array when none
 * @property {(x: number, y: number) => WarpDef|null} warpAt
 * @property {(x: number, y: number) => SpawnDef|null} spawnAt
 * @property {(name: string, x: number, y: number) => boolean} inRegion
 * @property {(x: number, y: number) => readonly string[]} regionsAt
 * @property {(x: number, y: number, match: AutotileMatch, tide?: number|TideState|TideVariant) => number} autotileMask
 *   8-bit neighbour mask ({@link AUTOTILE}); diagonal bits are set only when both adjacent cardinals
 *   match (the 47-tile blob convention). Outside the map counts as matching so edges draw no rim.
 *   `match`: `'water'` (draws as water at `tide`), `'land'` (its inverse), `'solid'`, `'same'` (the
 *   ground tile at x, y), a tile id, or `(def, id) => boolean`.
 * @property {(x: number, y: number, match: AutotileMatch, tide?: number|TideState|TideVariant) => number} edgeMask   the four cardinal bits only
 */
/** @typedef {'water'|'land'|'solid'|'same'|string|((def: TileDef|null, id: string|null) => boolean)} AutotileMatch */

// --- helpers --------------------------------------------------------------------------------------

/**
 * Detail-over-ground property fall-through: the detail definition wins when it defines the key.
 * @param {TileDef|null} d
 * @param {TileDef|null} g
 * @param {string} key
 * @returns {any}
 */
function pick(d, g, key) {
  if (d && d[key] !== undefined) return d[key];
  return g ? g[key] : undefined;
}

/**
 * @param {any} anim
 * @param {string|null} tileId
 * @param {(msg: string) => never} fail
 * @returns {{frames: number, fps: number}|null}
 */
function normaliseAnim(anim, tileId, fail) {
  if (anim === null || anim === undefined || anim === false || anim === 0 || anim === 1) return null;
  if (typeof anim === 'number') {
    if (!Number.isInteger(anim) || anim < 2) fail(`tile '${tileId}': anim frame count must be an integer >= 2`);
    return Object.freeze({ frames: anim, fps: DEFAULT_ANIM_FPS });
  }
  if (typeof anim === 'object') {
    const frames = anim.frames;
    const fps = anim.fps ?? DEFAULT_ANIM_FPS;
    if (!Number.isInteger(frames) || frames < 2) fail(`tile '${tileId}': anim.frames must be an integer >= 2`);
    if (!(fps > 0)) fail(`tile '${tileId}': anim.fps must be > 0`);
    return Object.freeze({ frames, fps });
  }
  return fail(`tile '${tileId}': anim must be a frame count or {frames, fps}`);
}

/**
 * @param {any} glow
 * @param {string|null} tileId
 * @param {(msg: string) => never} fail
 * @returns {GlowDef|null}
 */
function normaliseGlow(glow, tileId, fail) {
  if (glow === null || glow === undefined || glow === false) return null;
  let src;
  if (glow === true) src = {};
  else if (typeof glow === 'string') src = { kind: glow };
  else if (typeof glow === 'object') src = glow;
  else return fail(`tile '${tileId}': glow must be true, a kind, or {kind, color, radius, when, flag}`);
  const kind = typeof src.kind === 'string' ? src.kind : 'lamp';
  const when = src.when ?? GLOW_WHEN[kind] ?? 'night';
  if (when !== 'night' && when !== 'always' && when !== 'night-low') fail(`tile '${tileId}': glow.when must be 'night' | 'always' | 'night-low'`);
  const radius = src.radius ?? DEFAULT_GLOW_RADIUS;
  if (!(radius > 0)) fail(`tile '${tileId}': glow.radius must be > 0`);
  return Object.freeze({
    kind,
    color: typeof src.color === 'string' ? src.color : null,
    radius,
    when,
    flag: typeof src.flag === 'string' ? src.flag : null,
    ox: Number.isFinite(src.ox) ? src.ox : 0,
    oy: Number.isFinite(src.oy) ? src.oy : 0,
  });
}

/**
 * @param {{x: number, y: number, w?: number, h?: number}} r
 * @param {string} where
 * @param {number} w
 * @param {number} h
 * @param {(msg: string) => never} fail
 */
function checkRect(r, where, w, h, fail) {
  if (!r || !Number.isInteger(r.x) || !Number.isInteger(r.y)) fail(`${where} needs integer x, y`);
  const rw = r.w ?? 1;
  const rh = r.h ?? 1;
  if (!Number.isInteger(rw) || !Number.isInteger(rh) || rw < 1 || rh < 1) fail(`${where} w/h must be positive integers`);
  if (r.x < 0 || r.y < 0 || r.x + rw > w || r.y + rh > h) fail(`${where} (${r.x}, ${r.y}, ${rw}x${rh}) is outside ${w}x${h}`);
}

/**
 * @param {{x: number, y: number, w?: number, h?: number}} r
 * @param {number} w map width
 * @param {(i: number) => void} fn
 */
function forRect(r, w, fn) {
  const rw = r.w ?? 1;
  const rh = r.h ?? 1;
  for (let y = r.y; y < r.y + rh; y++) for (let x = r.x; x < r.x + rw; x++) fn(y * w + x);
}

/**
 * Keyword spawn areas (`'grass'`, `'water'`, `'mud'`, ...) match a cell when the topmost tile's
 * `spawn` class equals the keyword, or (without a `spawn` field) when `'water'` meets a water
 * tile, or the tile id contains the keyword (`'tall-grass'` is grass).
 * @param {string} cls
 * @param {TileDef|null} d
 * @param {string|null} dId
 * @param {TileDef|null} g
 * @param {string|null} gId
 * @param {number} water
 * @returns {boolean}
 */
function cellMatchesClass(cls, d, dId, g, gId, water) {
  const top = d || g;
  const topId = d ? dId : gId;
  if (!top || topId === null) return false;
  if (typeof top.spawn === 'string') return top.spawn === cls;
  if (cls === 'water') return water === 1;
  return topId.includes(cls);
}

/**
 * Neighbour-class test for {@link autotileMaskAt}: whether cell `(x, y)` matches `match`.
 * Out-of-bounds cells match, so map borders never draw an edge.
 * @param {RuntimeMap} map
 * @param {number} x
 * @param {number} y
 * @param {AutotileMatch} match
 * @param {TideVariant} v
 * @param {number} sameSlot ground slot at the probe centre (for `'same'`)
 * @returns {boolean}
 */
function cellMatches(map, x, y, match, v, sameSlot) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  const i = y * map.w + x;
  switch (match) {
    case 'water':
      return drawsWater(map, i, v);
    case 'land':
      return !drawsWater(map, i, v);
    case 'solid':
      return map.solidMask[i] === 1 || map.collision[i] === COLLISION.SOLID;
    case 'same':
      return map.layers[LAYER.GROUND][i] === sameSlot;
    default: {
      const gs = map.layers[LAYER.GROUND][i];
      const ds = map.layers[LAYER.DETAIL][i];
      if (typeof match === 'function') return match(map.tileDefs[ds || gs], map.tileIds[ds || gs]);
      return map.tileIds[gs] === match || map.tileIds[ds] === match;
    }
  }
}

/**
 * @param {RuntimeMap} map
 * @param {number} i
 * @param {TideVariant} v
 * @returns {boolean}
 */
function drawsWater(map, i, v) {
  const m = map.tideMask[i];
  if (m === TIDE_MASK.LOW_ONLY || m === TIDE_MASK.GLOW) return v !== 'low';
  if (m === TIDE_MASK.HIGH_ONLY) return v !== 'high';
  if (m === TIDE_MASK.FLOODS) return v === 'high';
  return map.waterMask[i] === 1;
}

/**
 * @param {RuntimeMap} map
 * @param {number} x
 * @param {number} y
 * @param {AutotileMatch} match
 * @param {number|TideState|TideVariant|undefined} tide
 * @returns {number}
 */
function autotileMaskAt(map, x, y, match, tide) {
  const v = tide === undefined ? 'low' : tideVariant(tide);
  const sameSlot = map.index(x, y) < 0 ? 0 : map.layers[LAYER.GROUND][y * map.w + x];
  const n = cellMatches(map, x, y - 1, match, v, sameSlot);
  const e = cellMatches(map, x + 1, y, match, v, sameSlot);
  const s = cellMatches(map, x, y + 1, match, v, sameSlot);
  const wv = cellMatches(map, x - 1, y, match, v, sameSlot);
  let bits = (n ? AUTOTILE.N : 0) | (e ? AUTOTILE.E : 0) | (s ? AUTOTILE.S : 0) | (wv ? AUTOTILE.W : 0);
  if (n && e && cellMatches(map, x + 1, y - 1, match, v, sameSlot)) bits |= AUTOTILE.NE;
  if (s && e && cellMatches(map, x + 1, y + 1, match, v, sameSlot)) bits |= AUTOTILE.SE;
  if (s && wv && cellMatches(map, x - 1, y + 1, match, v, sameSlot)) bits |= AUTOTILE.SW;
  if (n && wv && cellMatches(map, x - 1, y - 1, match, v, sameSlot)) bits |= AUTOTILE.NW;
  return bits;
}

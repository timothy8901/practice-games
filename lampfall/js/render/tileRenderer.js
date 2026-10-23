/**
 * Tile layers as baked chunks (ARCHITECTURE §4.7 steps 2-4 and 6, §12). [RENDER]
 *
 * The map is cut into 8x8-tile chunks (128x128 px). Each chunk layer (ground, detail, overlay) is
 * baked once per `(chunk, layer, tideVariant, gradeId)` into an `OffscreenCanvas` (canvas fallback)
 * and drawn with one `drawImage`. A view touches at most 5x3 chunks (480x230 under the Skyband) or
 * 5x4 (full 480x270), so the three layers cost <= 60 draws.
 *
 * - **Keys** are packed integers ({@link chunkKey}); grade ids are interned to small integers
 *   ({@link gradeIndex}); a cache hit allocates nothing. Chunks with no tide-sensitive cell (and no
 *   tide-sensitive neighbour, since edges read neighbours) share one canonical tide variant, so a
 *   tide flip re-bakes only the shore.
 * - **Eviction** ({@link createChunkCache}): LRU by use stamp under a chunk cap, and at most
 *   `maxCombos` `(grade, tide)` combinations resident; the least recently used combination is evicted
 *   whole (old grades leave together). Evicted canvases are pooled and reused by the next bake.
 * - **Work queue**: when the grade or tide changes, missing visible chunks are queued first, then a
 *   one-chunk ring; {@link TileRenderer.pump} bakes within a time budget per frame. `mapRenderer`
 *   keeps showing the previous complete set until the new one is ready, so a grade change never
 *   shows a patchwork.
 * - **Pixel composition**: a bake composes the chunk in a JS pixel buffer from the atlas's graded
 *   pixels and uploads it with one `putImageData`; no per-tile canvas is created, so a new grade costs
 *   one texture upload per chunk.
 * - **Animated pass**: water frames, surf / ripple / swell edges, glowing mud, skyglass, string
 *   lights and the wind gusts through tall grass are drawn per cell over the baked frame 0 from
 *   per-chunk entry lists whose frames were packed at bake time into one atlas canvas per grade (one
 *   array index and one 9-argument `drawImage` per visible animated cell). Grass, reeds and heather
 *   rustle when walked through. A tide flip dissolves the old waterline over 1 s through a dither mask.
 *
 * Cell art is resolved per `(tide, grade)`: tide tiles draw their `-sub` (or water) art when awash,
 * glowing mud shows only at night, windows and lamps use their lit art after dusk (a `glow.flag`
 * must also hold), roofs / fences / piers / boardwalks / causeways / ledges autotile from their
 * neighbours, and land meeting water gets banks, surf, swell, shelf, fringe, tide line, quay lip and
 * cliff ends. Houses cast a dithered bottom-right shadow by the sun (`lighting.shadowFor`) and eaves
 * shade the wall below. Art taller or wider than a tile is not baked: it is listed in
 * {@link TileRenderer.objects} and y-sorted with the entities.
 *
 * DOM-free at import; canvases come from `render/surface.makeCanvas`.
 * @module render/tileRenderer
 */

import { getTile, getSprite, getShadow, artDef, resolveArtId, gradeColour } from '../art/atlas.js';
import { houseLayout } from '../art/props.js';
import { drawsAsWater, tideVariant, tideMaskOf, TIDE_MASK } from '../world/tide.js';
import { lampsLit, BIO_ON, shadowFor } from '../world/lighting.js';
import { makeCanvas, ctx2d, DRAW, hash2, nowMs } from './surface.js';

/** Tiles per chunk edge. */
export const CHUNK_TILES = 8;
/** Tile edge in pixels. */
export const TILE_PX = 16;
/** Chunk edge in pixels. */
export const CHUNK_PX = CHUNK_TILES * TILE_PX;
/** Baked layers: ground, detail, overlay. */
export const LAYER_COUNT = 3;
/** Tide variant -> index in chunk keys. */
export const TIDE_INDEX = Object.freeze({ low: 0, mid: 1, high: 2 });
/** Index used by chunks that look the same at every tide. */
export const TIDE_CANON = 1;
/** Chunk records resident at once (§12: visible + ring for ~3 grades x 2 tides). */
export const DEFAULT_MAX_CHUNKS = 240;
/** `(grade, tide)` combinations resident at once (§12: 3 grades x 2 tide variants, plus slack). */
export const DEFAULT_MAX_COMBOS = 8;
/** Bake budget per frame in ms when the queue is pumped. */
export const DEFAULT_BAKE_BUDGET_MS = 3;
/** Chunk indexes must fit 16 bits (maps up to 256x256 chunks = 2048x2048 tiles). */
const CHUNK_SPACE = 65536;

/* ================================================================== grade interning */

/** @type {Map<string, number>} */
const gradeIds = new Map();
/** @type {object[]} */
const gradeList = [];

/**
 * Small integer for a grade (interned by `grade.id`, stable for the session). `lighting.gradeFor`
 * returns at most 48 slots x 6 weathers + indoor, so the table is bounded.
 * @param {{id: string}} grade
 * @returns {number}
 */
export function gradeIndex(grade) {
  let i = gradeIds.get(grade.id);
  if (i === undefined) {
    i = gradeList.length;
    gradeIds.set(grade.id, i);
    gradeList.push(grade);
  }
  return i;
}

/**
 * The grade object for an interned index.
 * @param {number} i
 * @returns {object}
 */
export function gradeAt(i) {
  return gradeList[i];
}

/* ================================================================== keys */

/**
 * Packs a chunk key. Pure integer math (no strings), so lookups allocate nothing.
 * @param {number} chunk   chunk index `cy * chunksX + cx` (< 65536)
 * @param {number} layer   0 ground, 1 detail, 2 overlay
 * @param {number} tide    {@link TIDE_INDEX} value
 * @param {number} grade   {@link gradeIndex} value
 * @returns {number}
 */
export function chunkKey(chunk, layer, tide, grade) {
  return ((grade * 3 + tide) * LAYER_COUNT + layer) * CHUNK_SPACE + chunk;
}

/**
 * Unpacks {@link chunkKey}.
 * @param {number} key
 * @returns {{chunk: number, layer: number, tide: number, grade: number, combo: number}}
 */
export function decodeChunkKey(key) {
  const chunk = key % CHUNK_SPACE;
  let rest = (key - chunk) / CHUNK_SPACE;
  const layer = rest % LAYER_COUNT;
  rest = (rest - layer) / LAYER_COUNT;
  const tide = rest % 3;
  const grade = (rest - tide) / 3;
  return { chunk, layer, tide, grade, combo: grade * 3 + tide };
}

/**
 * `(grade, tide)` combination id of a key (the unit of whole-combination eviction).
 * @param {number} key
 * @returns {number}
 */
export function comboOf(key) {
  return Math.floor(key / (CHUNK_SPACE * LAYER_COUNT));
}

/* ================================================================== chunk cache */

/**
 * @typedef {Object} ChunkCache
 * @property {(key: number) => any} get      touch + return, or undefined
 * @property {(key: number) => any} peek     return without touching
 * @property {(key: number) => boolean} has
 * @property {(key: number, value: any) => void} set   insert (evicting by LRU / combo cap first)
 * @property {(combo: number) => void} touchCombo      mark a combination as in use this frame
 * @property {(key: number) => boolean} delete
 * @property {() => void} clear
 * @property {() => number} size
 * @property {() => number[]} combos   resident combination ids
 * @property {() => {hits: number, misses: number, evictions: number, comboEvictions: number, size: number, combos: number}} stats
 */

/**
 * LRU chunk cache keyed by {@link chunkKey}.
 * @param {{capacity?: number, maxCombos?: number, onEvict?: (value: any, key: number) => void}} [opts]
 * @returns {ChunkCache}
 */
export function createChunkCache(opts = {}) {
  const capacity = opts.capacity ?? DEFAULT_MAX_CHUNKS;
  const maxCombos = opts.maxCombos ?? DEFAULT_MAX_COMBOS;
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('createChunkCache: capacity must be a positive integer');
  if (!Number.isInteger(maxCombos) || maxCombos < 1) throw new RangeError('createChunkCache: maxCombos must be a positive integer');
  const onEvict = opts.onEvict || null;
  /** @type {Map<number, {value: any, used: number}>} */
  const map = new Map();
  /** @type {Map<number, {used: number, count: number}>} */
  const combos = new Map();
  let stamp = 0;
  let hits = 0, misses = 0, evictions = 0, comboEvictions = 0;

  function drop(key, rec) {
    map.delete(key);
    const c = comboOf(key);
    const cr = combos.get(c);
    if (cr && --cr.count <= 0) combos.delete(c);
    evictions++;
    if (onEvict) onEvict(rec.value, key);
  }

  function evictCombo(combo) {
    for (const [k, rec] of map) if (comboOf(k) === combo) drop(k, rec);
    combos.delete(combo);
    comboEvictions++;
  }

  return {
    get(key) {
      const rec = map.get(key);
      if (!rec) { misses++; return undefined; }
      hits++;
      rec.used = ++stamp;
      const cr = combos.get(comboOf(key));
      if (cr) cr.used = stamp;
      return rec.value;
    },
    peek(key) {
      const rec = map.get(key);
      return rec ? rec.value : undefined;
    },
    has(key) {
      return map.has(key);
    },
    set(key, value) {
      const old = map.get(key);
      if (old) {
        old.value = value;
        old.used = ++stamp;
        return;
      }
      const combo = comboOf(key);
      if (!combos.has(combo) && combos.size >= maxCombos) {
        let lru = -1, lruUsed = Infinity;
        for (const [c, cr] of combos) if (cr.used < lruUsed) { lruUsed = cr.used; lru = c; }
        if (lru >= 0) evictCombo(lru);
      }
      while (map.size >= capacity) {
        let lk = -1, lu = Infinity, lrec = null;
        for (const [k, rec] of map) if (rec.used < lu) { lu = rec.used; lk = k; lrec = rec; }
        if (!lrec) break;
        drop(lk, lrec);
      }
      map.set(key, { value, used: ++stamp });
      let cr = combos.get(combo);
      if (!cr) { cr = { used: stamp, count: 0 }; combos.set(combo, cr); }
      cr.count++;
      cr.used = stamp;
    },
    touchCombo(combo) {
      const cr = combos.get(combo);
      if (cr) cr.used = ++stamp;
    },
    delete(key) {
      const rec = map.get(key);
      if (!rec) return false;
      drop(key, rec);
      evictions--;
      return true;
    },
    clear() {
      if (onEvict) for (const [k, rec] of map) onEvict(rec.value, k);
      map.clear();
      combos.clear();
    },
    size: () => map.size,
    combos: () => [...combos.keys()],
    stats: () => ({ hits, misses, evictions, comboEvictions, size: map.size, combos: combos.size }),
  };
}

/* ================================================================== art classification */

/** Water appearance classes used by the edge rules. */
export const CELL = Object.freeze({ LAND: 0, DEEP: 1, SEA: 2, RIVER: 3, CROSSING: 4, POOL: 5 });

const DEEP_ART = new Set(['water-deep']);
const SEA_ART = new Set(['water-shallow', 'water-mud', 'water-lagoon']);
const RIVER_ART = new Set(['river', 'water-tannin', 'water-spring']);
const POOL_ART = new Set(['tidepool', 'weir']);
const CROSSING_RE = /^(stepstone|causeway|mainland-causeway|pier|bridge|boardwalk)/;
const TURF_RE = /^(grass-|tall-grass|flowers-)/;
const FRINGE_BASE = new Set(['path', 'sand']);
const DRY_SAND = new Set(['sand', 'sand-ripples']);
const QUAY_RE = /^cobbles/;
/** Ground textures mirrored per tile to break repetition (the prototype's set). */
const TEXTURE_FLIP = new Set(['grass-a', 'grass-b', 'grass-c', 'sand', 'wet-sand', 'mud-dry', 'mud-wet', 'mud-glow', 'water-deep', 'water-shallow', 'water-mud']);
/** Cover that rustles when walked through and in wind gusts (never on a constant loop). */
export const COVER_ART = new Set(['tall-grass', 'reeds', 'heather']);
/** Art that casts the procedural house shadow and takes eave shade. */
const BUILDING_RE = /^(wall-|window-|door|roof-|cottage-wall|lighthouse-wall)/;
const ROOF_RE = /^roof-([a-z]+)-(body|ridge|eave)/;
/** Day art of night-only glowing tiles. */
const GLOW_DAY_ART = Object.freeze({ 'mud-glow': 'mud-wet' });
/** Walkable ground that shows rain ripples. */
const RAIN_WALK_RE = /^(path|cobbles|sand|wet-sand|mud-|grass-|flowers-|steps|pier|deck-planks|boardwalk|causeway|stepstone|flagstones|gravel)/;

const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [-1, 0, 1, 0];
const DIR_NAME = ['n', 'e', 's', 'w'];

/**
 * Whether an art id is an object (taller or wider than a tile): y-sorted, never baked.
 * @param {string} id resolved art id
 * @returns {boolean}
 */
export function isObjectArt(id) {
  const d = artDef(id);
  return d.w > TILE_PX || d.h > TILE_PX;
}

/** @param {string} id @returns {boolean} */
function hasArt(id) {
  return resolveArtId(id) !== null;
}

/**
 * Static per-slot facts, derived once per map.
 * @typedef {Object} SlotInfo
 * @property {string|null} art        resolved base art (null = unknown art: drawn as nothing)
 * @property {string|null} sub        art when a tide tile is awash
 * @property {number} mask            ground tide mask code
 * @property {boolean} water
 * @property {number} wcls            CELL class when it draws as water
 * @property {boolean} crossing
 * @property {boolean} pool
 * @property {boolean} object
 * @property {boolean} building
 * @property {boolean} cover
 * @property {string|null} autotile
 * @property {string|null} litArt
 * @property {boolean} litVariant     art has a `lit` variant
 * @property {string|null} glowFlag
 * @property {string[]|null} artByTier
 * @property {string|null} roofBase   `roof-<colour>` for roof tiles
 * @property {boolean} roofPlayer
 */

/**
 * @param {object|null} def tile definition
 * @param {string|null} id tile id
 * @returns {SlotInfo|null}
 */
function slotInfoOf(def, id) {
  if (!def) return null;
  const art = resolveArtId(def.art || id) || null;
  let mask = 0;
  try { mask = tideMaskOf(def.tide); } catch { mask = 0; }
  const info = {
    art,
    sub: null,
    mask,
    water: def.water === true,
    wcls: CELL.SEA,
    crossing: false,
    pool: false,
    object: false,
    building: false,
    cover: false,
    autotile: typeof def.autotile === 'string' ? def.autotile : null,
    litArt: def.litArt && hasArt(def.litArt) ? resolveArtId(def.litArt) : null,
    litVariant: false,
    glowFlag: def.glow && typeof def.glow === 'object' && def.glow.flag ? def.glow.flag : null,
    artByTier: Array.isArray(def.artByTier) ? def.artByTier.map((a) => resolveArtId(a)) : null,
    roofBase: null,
    roofPlayer: def.roofFrom === 'player',
  };
  if (!art) return info;
  const ad = artDef(art);
  info.object = ad.w > TILE_PX || ad.h > TILE_PX;
  info.litVariant = !!(ad.variants && ad.variants.lit);
  info.crossing = CROSSING_RE.test(art);
  info.pool = POOL_ART.has(art);
  info.building = BUILDING_RE.test(art);
  info.cover = COVER_ART.has(art);
  if (DEEP_ART.has(art)) info.wcls = CELL.DEEP;
  else if (RIVER_ART.has(art)) info.wcls = CELL.RIVER;
  else info.wcls = CELL.SEA;
  if (mask !== TIDE_MASK.NONE && !info.water) {
    const sub = `${art}-sub`;
    info.sub = hasArt(sub) ? sub : mask === TIDE_MASK.FLOODS ? 'water-shallow' : 'water-mud';
  }
  const rm = ROOF_RE.exec(art);
  if (rm || info.autotile === 'roof') info.roofBase = rm ? `roof-${rm[1]}` : null;
  return info;
}

/* ================================================================== map analysis */

/**
 * One y-sorted object (art taller or wider than a tile) found on the map.
 * @typedef {Object} MapObject
 * @property {number} x            anchor tile (bottom-left)
 * @property {number} y
 * @property {string} art          resolved art id
 * @property {string|null} litArt
 * @property {boolean} litVariant
 * @property {string|null} glowFlag
 * @property {number} w            pixels
 * @property {number} h
 * @property {number} sortY        world pixel row of the base (y-sort key)
 * @property {number} phase        animation phase (frames)
 * @property {'tile'|'prop'|'house'} source
 * @property {string|null} special 'lighthouse' | 'boat' | null
 * @property {any} cond            prop condition (evaluated by the caller), or undefined
 */

/**
 * Everything static the renderer derives from a RuntimeMap once.
 * @param {import('../world/tilemap.js').RuntimeMap} map
 * @returns {object}
 */
export function analyzeMap(map) {
  const { w, h } = map;
  const n = w * h;
  const slots = map.tileDefs.map((d, s) => slotInfoOf(d, map.tileIds[s]));
  const chunksX = Math.ceil(w / CHUNK_TILES);
  const chunksY = Math.ceil(h / CHUNK_TILES);
  if (chunksX * chunksY > CHUNK_SPACE) throw new RangeError(`tileRenderer: map ${map.id} is too large (${chunksX}x${chunksY} chunks)`);

  /** 16x16 prop art per cell (map props and house recipes): cell -> [{art, lit?, litVariant}] */
  const propCells = new Map();
  /** @type {MapObject[]} */
  const objects = [];
  const pushObject = (x, y, art, extra) => {
    const ad = artDef(art);
    objects.push({
      x, y, art, w: ad.w, h: ad.h, sortY: (y + 1) * TILE_PX,
      phase: (x + y) % 4,
      litArt: null, litVariant: !!(ad.variants && ad.variants.lit), glowFlag: null,
      source: 'tile', special: art === 'lighthouse' || art === 'lighthouse-dark' || art === 'lighthouse-lit' ? 'lighthouse' : art === 'boat' || art === 'punt' ? 'boat' : null,
      cond: undefined,
      ...extra,
    });
  };

  // objects painted in any layer
  for (let L = 0; L < LAYER_COUNT; L++) {
    const layer = map.layers[L];
    for (let i = 0; i < n; i++) {
      const s = layer[i];
      if (!s) continue;
      const info = slots[s];
      if (!info || !info.art || !info.object) continue;
      const x = i % w, y = (i - x) / w;
      pushObject(x, y, info.art, { litArt: info.litArt, glowFlag: info.glowFlag, source: 'tile' });
    }
  }
  // map props: objects y-sort, 16x16 props bake into the detail layer; `art: 'house'` expands a recipe
  for (const p of map.props || []) {
    if (p.art === 'house' && p.house) {
      for (const piece of houseLayout(p.house)) {
        const art = resolveArtId(piece.art);
        if (!art) continue;
        const x = p.x + piece.dx, y = p.y + piece.dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (isObjectArt(art)) pushObject(x, y, art, { source: 'house', cond: p.cond });
        else addProp(propCells, y * w + x, { art, lit: piece.lit ? resolveArtId(piece.lit) : null, cond: p.cond, building: true });
      }
      continue;
    }
    const art = resolveArtId(p.art);
    if (!art) continue;
    if (isObjectArt(art)) {
      pushObject(p.x, p.y, art, { source: 'prop', cond: p.cond, variant: p.variant || null, frame: Number.isInteger(p.frame) ? p.frame : null });
    } else if (p.x >= 0 && p.y >= 0 && p.x < w && p.y < h) {
      const ad = artDef(art);
      addProp(propCells, p.y * w + p.x, { art, lit: null, litVariant: !!(ad.variants && ad.variants.lit), cond: p.cond, building: BUILDING_RE.test(art) });
    }
  }
  objects.sort((a, b) => a.sortY - b.sortY || a.x - b.x);

  // per-chunk: does any layer have content, is it tide-sensitive (cell or neighbour)
  const nChunks = chunksX * chunksY;
  const layerUsed = new Uint8Array(nChunks); // bit per layer
  const tideSensitive = new Uint8Array(nChunks);
  const tideCell = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const g = slots[map.layers[0][i]];
    const d = slots[map.layers[1][i]];
    if ((g && (g.mask || g.art === 'tidepool')) || (d && d.mask)) tideCell[i] = 1;
  }
  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const c = cy * chunksX + cx;
      let used = 0, sens = 0;
      for (let y = cy * CHUNK_TILES - 1; y <= (cy + 1) * CHUNK_TILES; y++) {
        for (let x = cx * CHUNK_TILES - 1; x <= (cx + 1) * CHUNK_TILES; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const i = y * w + x;
          if (tideCell[i]) sens = 1;
          const inside = x >= cx * CHUNK_TILES && x < (cx + 1) * CHUNK_TILES && y >= cy * CHUNK_TILES && y < (cy + 1) * CHUNK_TILES;
          if (!inside) continue;
          for (let L = 0; L < LAYER_COUNT; L++) {
            const s = map.layers[L][i];
            if (s && slots[s] && slots[s].art && !slots[s].object) used |= 1 << L;
          }
          if (propCells.has(i)) used |= 2;
        }
      }
      // building shadows can fall into a chunk from a neighbour column / row: ground layer always used when any ground exists
      layerUsed[c] = used;
      tideSensitive[c] = sens;
    }
  }

  // rain ripple spots: walkable ground, one candidate per cell
  const rainCells = [];
  for (let i = 0; i < n; i++) {
    const g = slots[map.layers[0][i]];
    if (!g || !g.art || map.layers[1][i] && slots[map.layers[1][i]] && !slots[map.layers[1][i]].crossing) continue;
    if (RAIN_WALK_RE.test(g.art) && !g.building) rainCells.push(i);
  }

  let propBuildings = false;
  for (const list of propCells.values()) if (list.some((q) => q.building)) { propBuildings = true; break; }
  return { map, w, h, slots, chunksX, chunksY, layerUsed, tideSensitive, propCells, propBuildings, objects, rainCells: Int32Array.from(rainCells), states: [null, null, null] };
}

function addProp(propCells, i, rec) {
  let list = propCells.get(i);
  if (!list) { list = []; propCells.set(i, list); }
  list.push(rec);
}

/**
 * Per-cell water class at a tide variant (cached per map and variant).
 * @param {object} A analyzeMap result
 * @param {'low'|'mid'|'high'} v
 * @returns {Uint8Array}
 */
export function cellStates(A, v) {
  const ti = TIDE_INDEX[v];
  if (A.states[ti]) return A.states[ti];
  const { map, w, h, slots } = A;
  const out = new Uint8Array(w * h);
  const ground = map.layers[0];
  for (let i = 0; i < out.length; i++) {
    const info = slots[ground[i]];
    if (!info || !info.art) { out[i] = CELL.POOL; continue; }
    if (info.crossing) { out[i] = CELL.CROSSING; continue; }
    if (info.pool) { out[i] = CELL.POOL; continue; }
    if (!drawsAsWater(info.mask, v, info.water)) { out[i] = CELL.LAND; continue; }
    out[i] = info.water ? info.wcls : CELL.SEA;
  }
  A.states[ti] = out;
  return out;
}

/**
 * Bake-time context: everything a cell's appearance depends on besides the map.
 * @typedef {Object} BakeCtx
 * @property {'low'|'mid'|'high'} tide
 * @property {object} grade
 * @property {Record<string, any>} [flags]   world flags (lit porches / windows)
 * @property {number} [tier]                 cottage tier for `artByTier`
 * @property {string} [roof]                 the player's roof colour for `roofFrom: 'player'`
 * @property {(cond: any) => boolean} [cond] prop condition evaluator
 */

/**
 * Whether a lit-able cell is lit under a grade and flags.
 * @param {SlotInfo|{glowFlag: string|null}} info
 * @param {object} grade
 * @param {Record<string, any>|undefined} flags
 * @returns {boolean}
 */
export function isLit(info, grade, flags) {
  if (!lampsLit(grade)) return false;
  if (info.glowFlag && !(flags && flags[info.glowFlag])) return false;
  return true;
}

/**
 * Resolved base art of a ground / detail / overlay cell at a tide and grade (autotiling included).
 * @param {object} A analyzeMap result
 * @param {number} layer
 * @param {number} i cell index
 * @param {BakeCtx} bc
 * @returns {{art: string, variant: string|null, flip: number}|null}
 */
export function resolveCell(A, layer, i, bc) {
  const { map, w, h, slots } = A;
  const s = map.layers[layer][i];
  if (!s) return null;
  const info = slots[s];
  if (!info || !info.art || info.object) return null;
  const x = i % w, y = (i - x) / w;
  let art = info.art;
  let variant = null;
  if (info.artByTier && Number.isInteger(bc.tier) && info.artByTier[bc.tier]) art = info.artByTier[bc.tier];
  if (layer === 0 && info.mask !== TIDE_MASK.NONE && drawsAsWater(info.mask, bc.tide, info.water)) {
    return { art: info.sub, variant: null, flip: 0 };
  }
  if (GLOW_DAY_ART[art] && bc.grade.night < BIO_ON) art = GLOW_DAY_ART[art];
  // tide pools sit on the flats: the high tide covers them (the prototype's rule)
  if (layer === 0 && art === 'tidepool' && bc.tide === 'high') return { art: 'water-mud', variant: null, flip: 0 };
  const same = (dx, dy) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
    return map.layers[layer][ny * w + nx] === s;
  };
  const sameFamily = (dx, dy, re) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
    const o = slots[map.layers[layer][ny * w + nx]];
    return !!(o && o.art && re.test(o.art));
  };
  switch (info.autotile) {
    case 'roof': {
      let base = info.roofBase || 'roof-slate';
      if (info.roofPlayer && bc.roof) base = `roof-${bc.roof}`;
      const top = !same(0, -1), bottom = !same(0, 1), left = !same(-1, 0), right = !same(1, 0);
      const part = bottom ? 'eave' : top ? 'ridge' : 'body';
      const end = part === 'body' ? '' : left && !right ? '-l' : right && !left ? '-r' : '';
      const cand = `${base}-${part}${end}`;
      art = hasArt(cand) ? cand : hasArt(`${base}-${part}`) ? `${base}-${part}` : art;
      break;
    }
    case 'fence':
      if ((same(0, -1) || same(0, 1)) && !(same(-1, 0) || same(1, 0)) && hasArt('fence-v')) art = 'fence-v';
      break;
    case 'pier':
      if (!same(0, -1) && same(0, 1) && hasArt('pier-end')) art = 'pier-end';
      else if ((same(-1, 0) || same(1, 0)) && !same(0, -1) && !same(0, 1) && hasArt('pier-h')) art = 'pier-h';
      break;
    case 'boardwalk':
      if ((same(0, -1) || same(0, 1)) && !(same(-1, 0) || same(1, 0)) && hasArt('boardwalk-v')) art = 'boardwalk-v';
      break;
    case 'bridge':
      if ((same(0, -1) || same(0, 1)) && !(same(-1, 0) || same(1, 0)) && hasArt('bridge-wood-v')) art = 'bridge-wood-v';
      break;
    case 'causeway':
      if ((sameFamily(0, -1, /^causeway/) || sameFamily(0, 1, /^causeway/)) && !(sameFamily(-1, 0, /^causeway/) || sameFamily(1, 0, /^causeway/)) && hasArt(`${art}-v`)) art = `${art}-v`;
      break;
    case 'ledge':
      if (!same(-1, 0) && hasArt('ledge-l')) art = 'ledge-l';
      else if (!same(1, 0) && hasArt('ledge-r')) art = 'ledge-r';
      else if ((x & 1) && hasArt('ledge-b')) art = 'ledge-b';
      break;
    default:
      break;
  }
  if (info.litArt && isLit(info, bc.grade, bc.flags)) art = info.litArt;
  else if (info.litVariant && isLit(info, bc.grade, bc.flags)) variant = 'lit';
  const flip = layer === 0 && TEXTURE_FLIP.has(art) ? ((x * 7 + y * 13) >> 1) & 3 : 0;
  return { art, variant, flip };
}

/**
 * Edge overlays of a ground cell at a tide, in draw order. Each entry is `[artId, flip]`.
 * @param {object} A
 * @param {number} i
 * @param {'low'|'mid'|'high'} tide
 * @returns {Array<[string, number]>}
 */
export function cellEdges(A, i, tide) {
  const { map, w, h, slots } = A;
  const st = cellStates(A, tide);
  const s = st[i];
  const x = i % w, y = (i - x) / w;
  const out = [];
  const nState = (d) => {
    const nx = x + DIR_DX[d], ny = y + DIR_DY[d];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return s;
    return st[ny * w + nx];
  };
  const nArt = (dx, dy) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return null;
    const info = slots[map.layers[0][ny * w + nx]];
    return info ? info.art : null;
  };
  const open = (c) => c === CELL.DEEP || c === CELL.SEA || c === CELL.RIVER;
  const info = slots[map.layers[0][i]];
  if (!info || !info.art) return out;
  if (open(s)) {
    const kind = s === CELL.RIVER ? 'ripple' : 'foam';
    for (let d = 0; d < 4; d++) {
      const ns = nState(d);
      if (s === CELL.DEEP && (ns === CELL.SEA || ns === CELL.RIVER)) out.push([`shelf-${DIR_NAME[d]}`, 0]);
    }
    for (let d = 0; d < 4; d++) {
      if (nState(d) !== CELL.LAND) continue;
      if (s === CELL.SEA) out.push([`swell-${DIR_NAME[d]}`, 0]);
      out.push([`${kind}-${DIR_NAME[d]}`, 0]);
    }
    if (nArt(0, -1) === 'reeds' && nState(0) === CELL.LAND) out.push(['reed-edge', 0]);
    return out;
  }
  if (s !== CELL.LAND) return out;
  const art = info.art;
  const solidFace = info.building || info.autotile === 'cliff';
  if (!solidFace) {
    if (open(nState(2))) out.push(['bank-s', 0]);
    if (open(nState(0)) && !QUAY_RE.test(art) && info.autotile !== 'quay-lip') out.push(['bank-n', 0]);
    if (open(nState(1))) out.push(['bank-e', 0]);
    if (open(nState(3))) out.push(['bank-w', 0]);
  }
  if (FRINGE_BASE.has(art)) {
    const turf = (dx, dy) => { const a = nArt(dx, dy); return !!a && TURF_RE.test(a); };
    if (turf(0, -1)) out.push(['fringe-n', (x * 5 + y) & 1]);
    if (turf(0, 1)) out.push(['fringe-s', (x * 3 + y) & 1]);
    if (turf(1, 0)) out.push(['fringe-e', (x + y * 7) & 2]);
    if (turf(-1, 0)) out.push(['fringe-w', (x + y * 5) & 2]);
    if (!turf(0, -1) && !turf(-1, 0) && turf(-1, -1)) out.push(['fringe-corner', 0]);
    if (!turf(0, -1) && !turf(1, 0) && turf(1, -1)) out.push(['fringe-corner-r', 0]);
  }
  if (art === 'wet-sand') {
    for (let d = 0; d < 4; d++) {
      const a = nArt(DIR_DX[d], DIR_DY[d]);
      if (a && DRY_SAND.has(a) && nState(d) === CELL.LAND) out.push([`tideline-${DIR_NAME[d]}`, 0]);
    }
  }
  if (info.autotile === 'quay-lip' && open(nState(0))) out.push([hash2(x, y) % 4 === 1 ? 'quay-lip-b' : 'quay-lip', 0]);
  if (info.autotile === 'cliff') {
    const face = (dx) => { const a = nArt(dx, 0); return !!a && (a.startsWith('cliff-face') || a === 'steps'); };
    if (!face(-1) && hasArt(`${art}-l`)) out.push([`${art}-l`, 0]);
    if (!face(1) && hasArt(`${art}-r`)) out.push([`${art}-r`, 0]);
  }
  return out;
}

/* ================================================================== renderer */

/**
 * One animated cell of a baked chunk (frame canvases resolved at bake time for that chunk's grade).
 * @typedef {Object} AnimEntry
 * @property {number} px  @property {number} py   world pixels
 * @property {Int32Array|null} base  atlas slots (`sx | sy << 16`) of an animated base's frames (null = static base)
 * @property {number} fps
 * @property {number} phase          frame offset
 * @property {number} mode           0 loop, 1 wind gust (cover: draws only while a gust passes)
 * @property {number} gust           per-cell offset of the wind gust (ms)
 * @property {Array<{frames: Int32Array, fps: number}>} edges   overlays redrawn after the base (atlas slots)
 */

/**
 * @typedef {Object} TileRenderer
 * @property {(map: object) => void} setMap
 * @property {() => object|null} analysis
 * @property {(rect: {x: number, y: number, w: number, h: number}, camX: number, camY: number, tide: string, grade: object) => number} missing
 *   count of visible chunk layers not baked for this key (0 = ready)
 * @property {(rect: object, camX: number, camY: number, tide: string, grade: object, opts?: {ring?: boolean}) => void} request   queue the missing ones (visible first, then a ring)
 * @property {(pairs: Array<[string, object]>) => void} want   queued work for other (tide, grade) pairs is dropped when popped
 * @property {(rect: object, camX: number, camY: number, tide: string, grade: object) => number} bakeNow   bake every missing visible chunk synchronously
 * @property {(budgetMs?: number) => number} pump   bake queued chunks within a budget; returns how many
 * @property {(ctx: any, layer: number, rect: object, camX: number, camY: number, tide: string, grade: object) => number} drawLayer
 * @property {(ctx: any, layer: number, rect: object, camX: number, camY: number, tide: string, grade: object, ms: number) => number} drawAnimated
 * @property {(x: number, y: number, ms: number) => void} rustle   start a cover rustle at a cell
 * @property {(ctx: any, rect: object, camX: number, camY: number, grade: object, ms: number) => void} drawRain   rain ripples on walkable ground
 * @property {(ctx: any, layer: number, rect: object, camX: number, camY: number, fromTide: string, grade: object, density: number) => number} drawDissolve
 *   the previous tide's chunks through a dither mask (the 1 s shoreline dissolve)
 * @property {() => number} queueLength
 * @property {MapObject[]} objects
 * @property {() => void} invalidate   drop every bake (flags / tier / roof changed)
 * @property {(bc: Partial<BakeCtx>) => void} setBakeContext   flags, tier, roof, cond (invalidates when they change)
 * @property {() => object} stats
 */

/**
 * @param {{maxChunks?: number, maxCombos?: number, budgetMs?: number, atlasH?: number}} [opts]   `atlasH`: animated-frame atlas height (tests)
 * @returns {TileRenderer}
 */
export function createTileRenderer(opts = {}) {
  const pool = [];
  const cache = createChunkCache({
    capacity: opts.maxChunks ?? DEFAULT_MAX_CHUNKS,
    maxCombos: opts.maxCombos ?? DEFAULT_MAX_COMBOS,
    onEvict: (chunk) => { if (chunk && chunk.canvas) pool.push(chunk.canvas); },
  });
  const budgetDefault = opts.budgetMs ?? DEFAULT_BAKE_BUDGET_MS;
  /** @type {any} */
  let A = null;
  /** queued keys */
  const queue = [];
  let qHead = 0;
  const queued = new Set();
  /** combos wanted now (others are dropped from the queue when popped) */
  const wanted = new Set();
  let baked = 0, bakeMs = 0, bakeEma = 1, starved = 0;
  /** @type {Partial<BakeCtx>} */
  let bakeCtx = { flags: null, tier: undefined, roof: undefined, cond: null };
  let ctxSig = '';
  // cover rustles: ring buffer of {i, t0}
  const RUSTLE_N = 48;
  const rustleCell = new Int32Array(RUSTLE_N).fill(-1);
  const rustleT0 = new Float64Array(RUSTLE_N);
  let rustleHead = 0;

  function chunkIndex(cx, cy) { return cy * A.chunksX + cx; }

  function tideIdxFor(c, tide) {
    return A.tideSensitive[c] ? TIDE_INDEX[tide] : TIDE_CANON;
  }

  function visibleRange(rect, camX, camY, ring) {
    const r = ring ? 1 : 0;
    const x0 = Math.max(0, Math.floor(camX / CHUNK_PX) - r);
    const y0 = Math.max(0, Math.floor(camY / CHUNK_PX) - r);
    const x1 = Math.min(A.chunksX - 1, Math.floor((camX + rect.w - 1) / CHUNK_PX) + r);
    const y1 = Math.min(A.chunksY - 1, Math.floor((camY + rect.h - 1) / CHUNK_PX) + r);
    RANGE.x0 = x0; RANGE.y0 = y0; RANGE.x1 = x1; RANGE.y1 = y1;
    return RANGE;
  }
  const RANGE = { x0: 0, y0: 0, x1: -1, y1: -1 };

  function takeCanvas() {
    const c = pool.pop();
    return c || makeCanvas(CHUNK_PX, CHUNK_PX);
  }

  /* -------------------------------------------------------- pixel composition */
  // A chunk is composed in a JS pixel buffer and uploaded with ONE putImageData: no per-tile canvas
  // is ever created for baking, so a new grade costs one texture upload per chunk instead of one per
  // distinct tile frame (the frame-time spike a grade change used to cause).
  const buf = new Uint8ClampedArray(CHUNK_PX * CHUNK_PX * 4);
  let bufImage = null;

  /** Straight-alpha source-over of `src` pixels at (dx, dy) into the chunk buffer, times `alpha`. */
  function blit(src, sw, sh, dx, dy, alpha) {
    const x0 = Math.max(0, -dx), y0 = Math.max(0, -dy);
    const x1 = Math.min(sw, CHUNK_PX - dx), y1 = Math.min(sh, CHUNK_PX - dy);
    for (let y = y0; y < y1; y++) {
      let si = (y * sw + x0) * 4;
      let di = ((dy + y) * CHUNK_PX + dx + x0) * 4;
      for (let x = x0; x < x1; x++, si += 4, di += 4) {
        const a = src[si + 3];
        if (a === 0) continue;
        if (a === 255 && alpha === 1) {
          buf[di] = src[si]; buf[di + 1] = src[si + 1]; buf[di + 2] = src[si + 2]; buf[di + 3] = 255;
          continue;
        }
        blend(di, src[si], src[si + 1], src[si + 2], (a / 255) * alpha);
      }
    }
  }

  /** Blends one colour into the buffer at byte index `di` with coverage `sa` (0..1). */
  function blend(di, r, g, b, sa) {
    const da = buf[di + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    const k = da * (1 - sa);
    buf[di] = (r * sa + buf[di] * k) / oa;
    buf[di + 1] = (g * sa + buf[di + 1] * k) / oa;
    buf[di + 2] = (b * sa + buf[di + 2] * k) / oa;
    buf[di + 3] = oa * 255;
  }

  /** Fills a rect of the buffer with a colour at coverage `sa`; `checker` keeps only (x+y) even pixels. */
  function shadeRect(x, y, w, h, rgb, sa, checker) {
    const xa = Math.max(0, x), ya = Math.max(0, y), xb = Math.min(CHUNK_PX, x + w), yb = Math.min(CHUNK_PX, y + h);
    for (let yy = ya; yy < yb; yy++) {
      for (let xx = xa; xx < xb; xx++) {
        if (checker && ((xx + yy) & 1)) continue;
        const di = (yy * CHUNK_PX + xx) * 4;
        if (mark[yy * CHUNK_PX + xx] === markStamp) continue; // union: never shade a pixel twice
        mark[yy * CHUNK_PX + xx] = markStamp;
        blend(di, rgb[0], rgb[1], rgb[2], sa);
      }
    }
  }
  const mark = new Uint32Array(CHUNK_PX * CHUNK_PX);
  let markStamp = 0;

  function upload(canvas) {
    const g = ctx2d(canvas);
    if (!bufImage) bufImage = typeof g.createImageData === 'function' ? g.createImageData(CHUNK_PX, CHUNK_PX) : null;
    if (bufImage) {
      bufImage.data.set(buf);
      g.putImageData(bufImage, 0, 0);
    }
  }

  /* -------------------------------------------------------- the animated-frame atlas */
  // Animated cells draw their frames from one atlas canvas per grade (9-argument drawImage), so the
  // animated pass touches a handful of textures instead of hundreds of tiny canvases.
  const ATLAS_W = 512, ATLAS_H = Math.max(TILE_PX, opts.atlasH ?? 256), SLOTS_X = ATLAS_W / TILE_PX, SLOTS = SLOTS_X * Math.floor(ATLAS_H / TILE_PX);
  /** headroom a bake may need: an atlas with fewer free slots rolls over before the bake starts */
  const ROLL = Math.min(160, SLOTS >> 1);
  /** @type {Map<number, {canvas: any, ctx: any, slots: Map<object, number>, n: number, img: any}>} grade index -> atlas */
  const atlases = new Map();
  const ATLAS_MAX = 6;

  function atlasFor(gi) {
    let a = atlases.get(gi);
    // a nearly full (or overflowed) atlas rolls over to a fresh canvas: chunks already baked keep
    // their own atlas object, so their slots stay valid
    if (a && !a.full && a.n <= SLOTS - ROLL) return a;
    if (a) atlases.delete(gi);
    if (atlases.size >= ATLAS_MAX) atlases.delete(atlases.keys().next().value);
    const canvas = makeCanvas(ATLAS_W, ATLAS_H);
    const ctx = ctx2d(canvas);
    a = { canvas, ctx, slots: new Map(), n: 0, full: false, img: typeof ctx.createImageData === 'function' ? ctx.createImageData(TILE_PX, TILE_PX) : null };
    atlases.set(gi, a);
    return a;
  }

  /** Atlas slot (packed sx | sy << 16) of a 16x16 image at a grade; written on first use. */
  function slotOf(a, img) {
    let s = a.slots.get(img);
    if (s !== undefined) return s;
    // never clear a live atlas (baked chunks point into it): mark it full; the caller rolls over
    if (a.n >= SLOTS) { a.full = true; return 0; }
    const k = a.n++;
    const sx = (k % SLOTS_X) * TILE_PX, sy = Math.floor(k / SLOTS_X) * TILE_PX;
    if (a.img) {
      a.img.data.set(img.pixels.length === TILE_PX * TILE_PX * 4 ? img.pixels : img.pixels.subarray(0, TILE_PX * TILE_PX * 4));
      a.ctx.putImageData(a.img, sx, sy);
    }
    s = sx | (sy << 16);
    a.slots.set(img, s);
    return s;
  }

  /** Atlas slots of every frame of an art at a grade (16x16 art only). */
  function frameSlots(a, art, grade, flip, variant) {
    const d = artDef(art);
    const nf = (variant && d.variants && d.variants[variant] ? d.variants[variant] : d.frames).length;
    const out = new Int32Array(nf);
    for (let f = 0; f < nf; f++) {
      const img = variant ? getSprite(art, { frame: f, name: variant, grade, flipX: !!(flip & 1), flipY: !!(flip & 2) }) : getTile(art, f, grade, flip);
      out[f] = slotOf(a, img);
    }
    return out;
  }

  /* -------------------------------------------------------- bake */

  /**
   * Bakes one chunk layer.
   * @returns {{canvas: any, anim: AnimEntry[], key: number, ox: number, oy: number, atlas: object}}
   */
  function bake(key, retried = false) {
    const t0 = nowMs();
    const { chunk: c, layer, tide: ti, grade: gi } = decodeChunkKey(key);
    const grade = gradeAt(gi);
    const tide = ti === 0 ? 'low' : ti === 2 ? 'high' : 'mid';
    const bc = { tide, grade, flags: bakeCtx.flags, tier: bakeCtx.tier, roof: bakeCtx.roof, cond: bakeCtx.cond };
    const cx = c % A.chunksX, cy = (c - cx) / A.chunksX;
    const ox = cx * CHUNK_PX, oy = cy * CHUNK_PX;
    const { w, h } = A;
    buf.fill(0);
    const atlas = atlasFor(gi);
    const anim = [];
    const sh = shadowFor(grade.minute < 0 ? 720 : grade.minute, grade);
    const tx0 = cx * CHUNK_TILES, ty0 = cy * CHUNK_TILES;
    const tx1 = Math.min(w, tx0 + CHUNK_TILES), ty1 = Math.min(h, ty0 + CHUNK_TILES);
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) {
        const i = y * w + x;
        const px = (x - tx0) * TILE_PX, py = (y - ty0) * TILE_PX;
        const cell = resolveCell(A, layer, i, bc);
        let entry = null;
        if (cell) {
          const d = artDef(cell.art);
          const nf = (cell.variant && d.variants && d.variants[cell.variant] ? d.variants[cell.variant] : d.frames).length;
          const animated = nf > 1 && d.fps > 0;
          const cover = layer === 0 && COVER_ART.has(cell.art);
          if (layer === 1) cellShadow(cell.art, px, py, sh);
          const img = cell.variant ? getSprite(cell.art, { frame: 0, name: cell.variant, grade, flipX: !!(cell.flip & 1), flipY: !!(cell.flip & 2) }) : getTile(cell.art, 0, grade, cell.flip);
          blit(img.pixels, img.w, img.h, px, py, 1);
          if (animated) {
            entry = { px: x * TILE_PX, py: y * TILE_PX, base: frameSlots(atlas, cell.art, grade, cell.flip, cell.variant), fps: d.fps, phase: cover ? 0 : (x * 3 + y * 5) & 3, mode: cover ? 1 : 0, edges: [], gust: cover ? (hash2(x, y) % 400) : 0 };
          }
        }
        if (layer === 0) {
          const edges = cellEdges(A, i, tide);
          for (let k = 0; k < edges.length; k++) {
            const [eid, flip] = edges[k];
            if (!hasArt(eid)) continue;
            const ed = artDef(eid);
            const eAnim = ed.frames.length > 1 && ed.fps > 0;
            if (eAnim) {
              if (!entry) entry = { px: x * TILE_PX, py: y * TILE_PX, base: null, fps: 0, phase: (x * 3 + y * 5) & 3, mode: 0, edges: [], gust: 0 };
              entry.edges.push({ frames: frameSlots(atlas, eid, grade, flip, null), fps: ed.fps });
            } else {
              const eimg = getTile(eid, 0, grade, flip);
              blit(eimg.pixels, eimg.w, eimg.h, px, py, 1);
              if (entry && entry.base && entry.mode === 0) entry.edges.push({ frames: Int32Array.of(slotOf(atlas, eimg)), fps: 0 });
            }
          }
        }
        if (layer === 1) {
          const props = A.propCells.get(i);
          if (props) {
            const lit = isLit({ glowFlag: null }, grade, bc.flags);
            for (const p of props) {
              if (p.cond !== undefined && p.cond !== null && bc.cond && !bc.cond(p.cond)) continue;
              cellShadow(p.art, px, py, sh);
              const art = p.lit && lit ? p.lit : p.art;
              const img = p.litVariant && lit ? getSprite(art, { name: 'lit', grade }) : getTile(art, 0, grade, 0);
              blit(img.pixels, img.w, img.h, px, py, 1);
            }
          }
        }
        if (entry && (entry.base || entry.edges.length)) anim.push(entry);
      }
    }
    // the atlas overflowed mid-bake: retire it and bake this chunk again into a fresh one
    if (atlas.full) {
      if (atlases.get(gi) === atlas) atlases.delete(gi);
      if (!retried) return bake(key, true);
    }
    if (layer === 0) shade(tx0, ty0, tx1, ty1, grade, sh, groundBuilding);
    if (layer === 1 && A.propBuildings) shade(tx0, ty0, tx1, ty1, grade, sh, propBuilding);
    // an all-transparent layer needs no canvas
    let empty = true;
    for (let k = 3; k < buf.length; k += 4) if (buf[k] !== 0) { empty = false; break; }
    let canvas = null;
    if (!empty) {
      canvas = takeCanvas();
      upload(canvas);
    }
    baked++;
    DRAW.bakes++;
    bakeMs += nowMs() - t0;
    return { canvas, anim, key, ox, oy, atlas };
  }

  function cellShadow(art, px, py, sh) {
    if (sh.alpha < 0.01) return;
    const s = getShadow(art, 0);
    if (!s) return;
    blit(s.pixels, s.w, s.h, px + sh.dx, py + sh.dy, sh.alpha);
  }

  function roofAt(x, y) {
    if (x < 0 || y < 0 || x >= A.w || y >= A.h) return false;
    const i = y * A.w + x;
    const g = A.slots[A.map.layers[0][i]];
    if (g && g.art && g.art.startsWith('roof-')) return true;
    const props = A.propCells.get(i);
    if (props) for (const p of props) if (p.art.startsWith('roof-')) return true;
    return false;
  }
  function groundBuilding(x, y) {
    if (x < 0 || y < 0 || x >= A.w || y >= A.h) return false;
    const s = A.slots[A.map.layers[0][y * A.w + x]];
    return !!(s && s.building);
  }
  function propBuilding(x, y) {
    if (x < 0 || y < 0 || x >= A.w || y >= A.h) return false;
    const p = A.propCells.get(y * A.w + x);
    return !!(p && p.some((q) => q.building));
  }

  /**
   * House cast shadows (bottom-right, by the sun; a 50% dither of the graded shadow colour, as a
   * union so overlapping strips never double-darken) and eave shade on the wall under a roof. A
   * one-tile margin lets shadows cross chunk edges.
   */
  function shade(tx0, ty0, tx1, ty1, grade, sh, pred) {
    const ox = tx0 * TILE_PX, oy = ty0 * TILE_PX;
    const rgb = shadeRgb(grade);
    markStamp++;
    if (sh.alpha >= 0.01) {
      const a = Math.min(0.5, sh.alpha * 1.4);
      for (let y = ty0 - 1; y < ty1; y++) {
        for (let x = tx0 - 1; x < tx1; x++) {
          if (!pred(x, y)) continue;
          const px = x * TILE_PX - ox, py = y * TILE_PX - oy;
          if (!pred(x, y + 1)) shadeRect(px + sh.dx, py + TILE_PX, TILE_PX, sh.dy + 2, rgb, a, true);
          if (!pred(x + 1, y)) {
            const top = roofAt(x, y) && !roofAt(x, y - 1) ? 6 : 0;
            shadeRect(px + TILE_PX, py + top + sh.dy, sh.dx + 1, TILE_PX - top + (pred(x, y + 1) ? 0 : 2), rgb, a, true);
          }
        }
      }
    }
    markStamp++;
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) {
        if (!pred(x, y) || roofAt(x, y) || !roofAt(x, y - 1)) continue;
        const px = x * TILE_PX - ox, py = y * TILE_PX - oy;
        shadeRect(px, py, TILE_PX, 2, rgb, 0.42, false);
        shadeRect(px, py + 2, TILE_PX, 1, rgb, 0.42, true);
      }
    }
  }
  /** @type {WeakMap<object, string>} grade -> rain ripple colour */
  const rainCache = new WeakMap();
  function rainColour(grade) {
    let c = rainCache.get(grade);
    if (!c) { c = gradeColour('snow2', grade); rainCache.set(grade, c); }
    return c;
  }
  /** @type {WeakMap<object, number[]>} */
  const shadeCache = new WeakMap();
  function shadeRgb(grade) {
    let c = shadeCache.get(grade);
    if (!c) { const hx = gradeColour('shadow', grade); c = [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]; shadeCache.set(grade, c); }
    return c;
  }

  function keyFor(cx, cy, layer, tide, grade) {
    const c = chunkIndex(cx, cy);
    return chunkKey(c, layer, tideIdxFor(c, tide), gradeIndex(grade));
  }

  function layerUsed(cx, cy, layer) {
    // the ground layer also hosts shadows cast from neighbours; it is used whenever ground exists
    return (A.layerUsed[chunkIndex(cx, cy)] >> layer) & 1;
  }

  function ensure(key) {
    let ch = cache.get(key);
    if (!ch) {
      ch = bake(key);
      cache.set(key, ch);
    }
    return ch;
  }

  function sigOf(bc) {
    const f = bc.flags ? Object.keys(bc.flags).filter((k) => bc.flags[k]).sort().join(',') : '';
    return `${f}|${bc.tier ?? ''}|${bc.roof ?? ''}`;
  }

  const api = {
    setMap(map) {
      A = map ? analyzeMap(map) : null;
      cache.clear();
      queue.length = 0;
      qHead = 0;
      queued.clear();
      rustleCell.fill(-1);
    },
    analysis: () => A,
    get objects() { return A ? A.objects : []; },

    setBakeContext(bc) {
      const next = { ...bakeCtx, ...bc };
      const sig = sigOf(next);
      bakeCtx = next;
      if (sig !== ctxSig) {
        ctxSig = sig;
        api.invalidate();
      }
    },

    invalidate() {
      cache.clear();
      queue.length = 0;
      qHead = 0;
      queued.clear();
    },

    missing(rect, camX, camY, tide, grade) {
      if (!A) return 0;
      const R = visibleRange(rect, camX, camY, false);
      let n = 0;
      for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
        for (let L = 0; L < LAYER_COUNT; L++) {
          if (!layerUsed(cx, cy, L)) continue;
          if (!cache.has(keyFor(cx, cy, L, tide, grade))) n++;
        }
      }
      return n;
    },

    request(rect, camX, camY, tide, grade, o = {}) {
      if (!A) return;
      const g = gradeIndex(grade);
      wanted.add(g * 3 + TIDE_INDEX[tide]);
      wanted.add(g * 3 + TIDE_CANON);
      for (const pass of o.ring === false ? [false] : [false, true]) {
        const R = visibleRange(rect, camX, camY, pass);
        for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
          for (let L = 0; L < LAYER_COUNT; L++) {
            if (!layerUsed(cx, cy, L)) continue;
            const k = keyFor(cx, cy, L, tide, grade);
            if (cache.has(k) || queued.has(k)) continue;
            queued.add(k);
            queue.push(k);
          }
        }
      }
    },

    /** Forget queued work for combinations other than the listed (grade, tide) pairs. */
    want(pairs) {
      wanted.clear();
      for (const [tide, grade] of pairs) {
        const g = gradeIndex(grade);
        wanted.add(g * 3 + TIDE_INDEX[tide]);
        wanted.add(g * 3 + TIDE_CANON);
      }
    },

    bakeNow(rect, camX, camY, tide, grade) {
      if (!A) return 0;
      const R = visibleRange(rect, camX, camY, false);
      let n = 0;
      for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
        for (let L = 0; L < LAYER_COUNT; L++) {
          if (!layerUsed(cx, cy, L)) continue;
          const k = keyFor(cx, cy, L, tide, grade);
          if (cache.has(k)) continue;
          cache.set(k, bake(k));
          queued.delete(k);
          n++;
        }
      }
      return n;
    },

    pump(budgetMs = budgetDefault) {
      if (!A) return 0;
      const t0 = nowMs();
      let n = 0;
      while (qHead < queue.length) {
        // predictive budget: start a bake only if it should fit (an EMA of recent bake costs), but
        // never starve: after two idle frames one bake always runs
        const spent = nowMs() - t0;
        if (spent + bakeEma > budgetMs && (n > 0 || starved < 2)) break;
        const k = queue[qHead++];
        queued.delete(k);
        if (cache.has(k)) continue;
        if (wanted.size && !wanted.has(comboOf(k))) continue;
        const b0 = nowMs();
        cache.set(k, bake(k));
        bakeEma = bakeEma * 0.8 + (nowMs() - b0) * 0.2;
        n++;
      }
      starved = n === 0 && qHead < queue.length ? starved + 1 : 0;
      if (qHead >= queue.length) { queue.length = 0; qHead = 0; }
      else if (qHead > 256) { queue.splice(0, qHead); qHead = 0; }
      return n;
    },

    queueLength: () => queue.length - qHead,

    drawLayer(ctx, layer, rect, camX, camY, tide, grade) {
      if (!A) return 0;
      const R = visibleRange(rect, camX, camY, false);
      const gi = gradeIndex(grade);
      cache.touchCombo(gi * 3 + TIDE_INDEX[tide]);
      cache.touchCombo(gi * 3 + TIDE_CANON);
      let n = 0;
      for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
        if (!layerUsed(cx, cy, layer)) continue;
        const ch = ensure(keyFor(cx, cy, layer, tide, grade));
        if (!ch.canvas) continue;
        ctx.drawImage(ch.canvas, rect.x + ch.ox - camX, rect.y + ch.oy - camY);
        n++;
      }
      DRAW.images += n;
      return n;
    },

    /**
     * The tide dissolve (§12: "a 1 s shoreline dissolve"): the previous tide's chunks of the
     * tide-sensitive area drawn through an ordered-dither mask of `density` (1 -> 0 over the second),
     * so the waterline crumbles into the new one instead of jumping. Chunks that look the same at
     * every tide are skipped; nothing is drawn if the old bake was evicted.
     */
    drawDissolve(ctx, layer, rect, camX, camY, fromTide, grade, density) {
      if (!A || density <= 0) return 0;
      const level = Math.min(15, Math.max(1, Math.round(density * 16)));
      const R = visibleRange(rect, camX, camY, false);
      const gi = gradeIndex(grade);
      let n = 0;
      for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
        const c = chunkIndex(cx, cy);
        if (!A.tideSensitive[c] || !layerUsed(cx, cy, layer)) continue;
        const ch = cache.peek(chunkKey(c, layer, TIDE_INDEX[fromTide], gi));
        if (!ch || !ch.canvas) continue;
        const sg = ctx2d(scratch());
        sg.globalCompositeOperation = 'copy';
        sg.drawImage(ditherMask(level), 0, 0);
        sg.globalCompositeOperation = 'source-in';
        sg.drawImage(ch.canvas, 0, 0);
        sg.globalCompositeOperation = 'source-over';
        ctx.drawImage(scratchCanvas, rect.x + ch.ox - camX, rect.y + ch.oy - camY);
        n += 3;
      }
      DRAW.images += n;
      return n;
    },

    drawAnimated(ctx, layer, rect, camX, camY, tide, grade, ms) {
      if (!A) return 0;
      const R = visibleRange(rect, camX, camY, false);
      let n = 0;
      const vx0 = camX - TILE_PX, vy0 = camY - TILE_PX, vx1 = camX + rect.w, vy1 = camY + rect.h;
      const dx = rect.x - camX, dy = rect.y - camY;
      for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
        if (!layerUsed(cx, cy, layer)) continue;
        const ch = cache.peek(keyFor(cx, cy, layer, tide, grade));
        if (!ch) continue;
        const list = ch.anim;
        const ac = ch.atlas.canvas;
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (e.px < vx0 || e.py < vy0 || e.px > vx1 || e.py > vy1) continue;
          if (e.mode === 1) {
            // a wind gust rolls east across cover every ~6 s; each tuft bends for 3 poses
            let t = (ms - e.px * 9 - e.py * 3 + e.gust) % 6000;
            if (t < 0) t += 6000;
            const f = t < 70 ? 1 : t < 140 ? 2 : t < 210 ? 1 : 0;
            if (f === 0 || !e.base) continue;
            const s = e.base[f % e.base.length];
            ctx.drawImage(ac, s & 0xffff, s >>> 16, TILE_PX, TILE_PX, e.px + dx, e.py + dy, TILE_PX, TILE_PX);
            n++;
            continue;
          }
          if (e.base) {
            const s = e.base[Math.floor((ms * e.fps) / 1000 + e.phase) % e.base.length];
            ctx.drawImage(ac, s & 0xffff, s >>> 16, TILE_PX, TILE_PX, e.px + dx, e.py + dy, TILE_PX, TILE_PX);
            n++;
          }
          for (let j = 0; j < e.edges.length; j++) {
            const ed = e.edges[j];
            const fr = ed.frames;
            const s = fr[fr.length > 1 ? Math.floor((ms * ed.fps) / 1000 + e.phase) % fr.length : 0];
            ctx.drawImage(ac, s & 0xffff, s >>> 16, TILE_PX, TILE_PX, e.px + dx, e.py + dy, TILE_PX, TILE_PX);
            n++;
          }
        }
      }
      if (layer === 0) n += drawRustles(ctx, rect, camX, camY, grade, ms);
      DRAW.images += n;
      return n;
    },

    rustle(x, y, ms) {
      if (!A || x < 0 || y < 0 || x >= A.w || y >= A.h) return;
      const i = y * A.w + x;
      const s = A.slots[A.map.layers[0][i]];
      if (!s || !s.cover) return;
      rustleCell[rustleHead] = i;
      rustleT0[rustleHead] = ms;
      rustleHead = (rustleHead + 1) % RUSTLE_N;
    },

    drawRain(ctx, rect, camX, camY, grade, ms) {
      if (!A) return;
      ctx.fillStyle = rainColour(grade);
      const tx0 = Math.max(0, Math.floor(camX / TILE_PX)), ty0 = Math.max(0, Math.floor(camY / TILE_PX));
      const tx1 = Math.min(A.w - 1, Math.floor((camX + rect.w) / TILE_PX)), ty1 = Math.min(A.h - 1, Math.floor((camY + rect.h) / TILE_PX));
      const dx = rect.x - camX, dy = rect.y - camY;
      const cells = A.rainCells;
      // binary-search the first candidate row
      let lo = 0, hi = cells.length;
      const first = ty0 * A.w;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cells[mid] < first) lo = mid + 1; else hi = mid; }
      const last = ty1 * A.w + tx1;
      for (let k = lo; k < cells.length && cells[k] <= last; k++) {
        const i = cells[k];
        const x = i % A.w;
        if (x < tx0 || x > tx1) continue;
        const y = (i - x) / A.w;
        const hh = hash2(x * 3 + 1, y * 5 + 2);
        const st = (Math.floor(ms / 100) + (hh & 15)) % 11;
        if (st >= RIPPLE.length) continue;
        const r = RIPPLE[st];
        const ox = x * TILE_PX + 3 + ((hh >>> 5) % 8) + dx, oy = y * TILE_PX + 4 + ((hh >>> 9) % 8) + dy;
        ctx.globalAlpha = st === RIPPLE.length - 1 ? 0.35 : 0.7;
        for (let j = 0; j < r.length; j += 3) ctx.fillRect(ox + r[j], oy + r[j + 1], r[j + 2], 1);
        DRAW.fills++;
      }
      ctx.globalAlpha = 1;
    },

    stats() {
      let atlasSlots = 0;
      for (const a of atlases.values()) atlasSlots = Math.max(atlasSlots, a.n);
      return { ...cache.stats(), baked, bakeMs: Math.round(bakeMs * 100) / 100, queued: queue.length - qHead, pooled: pool.length, atlases: atlases.size, atlasSlots };
    },
    cache,
  };

  function drawRustles(ctx, rect, camX, camY, grade, ms) {
    let n = 0;
    const dx = rect.x - camX, dy = rect.y - camY;
    for (let k = 0; k < RUSTLE_N; k++) {
      const i = rustleCell[k];
      if (i < 0) continue;
      const t = ms - rustleT0[k];
      if (t < 0 || t >= 280) { if (t >= 280) rustleCell[k] = -1; continue; }
      const f = t < 70 ? 1 : t < 140 ? 2 : t < 210 ? 1 : 2;
      const x = i % A.w, y = (i - x) / A.w;
      const px = x * TILE_PX, py = y * TILE_PX;
      if (px < camX - TILE_PX || py < camY - TILE_PX || px > camX + rect.w || py > camY + rect.h) continue;
      const art = A.slots[A.map.layers[0][i]].art;
      const a = atlasFor(gradeIndex(grade));
      const s = slotOf(a, getTile(art, f, grade, 0));
      ctx.drawImage(a.canvas, s & 0xffff, s >>> 16, TILE_PX, TILE_PX, px + dx, py + dy, TILE_PX, TILE_PX);
      n++;
    }
    return n;
  }

  return api;
}

/** Rain ripple rings as `[x, y, len]` runs (flattened rings, never a plus: that glyph is the Heartmark's). */
const RIPPLE = [
  [0, 0, 1],
  [1, 0, 2, 0, 1, 1, 3, 1, 1, 1, 2, 2],
  [1, 0, 4, 0, 1, 1, 5, 1, 1, 1, 2, 4],
  [2, 0, 1, 5, 0, 1, 0, 1, 1, 7, 1, 1, 2, 2, 1, 5, 2, 1],
];

/** Ordered-dither masks (128x128, opaque where the Bayer threshold is under the level), cached. */
const masks = new Array(17).fill(null);
function ditherMask(level) {
  let m = masks[level];
  if (m) return m;
  m = makeCanvas(CHUNK_PX, CHUNK_PX);
  const g = ctx2d(m);
  if (typeof g.createImageData === 'function') {
    const img = g.createImageData(CHUNK_PX, CHUNK_PX);
    for (let y = 0; y < CHUNK_PX; y++) for (let x = 0; x < CHUNK_PX; x++) {
      if (BAYER_4[((y & 3) << 2) | (x & 3)] < level) img.data[(y * CHUNK_PX + x) * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  masks[level] = m;
  return m;
}
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
let scratchCanvas = null;
function scratch() {
  if (!scratchCanvas) scratchCanvas = makeCanvas(CHUNK_PX, CHUNK_PX);
  return scratchCanvas;
}

/**
 * The tide variant for a clock tide (height 0..1, state or variant): `world/tide.tideVariant`.
 * @param {number|string} tide
 * @returns {'low'|'mid'|'high'}
 */
export function tideOf(tide) {
  return tideVariant(tide);
}

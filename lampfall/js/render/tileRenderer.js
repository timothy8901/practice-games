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
 * - **Animated pass**: water frames, surf / ripple / swell edges, glowing mud, skyglass, string
 *   lights and the wind gusts through tall grass are drawn per cell over the baked frame 0 from
 *   per-chunk entry lists whose frame canvases were resolved at bake time (one array index and one
 *   `drawImage` per visible animated cell). Grass, reeds and heather rustle when walked through.
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
    if ((g && g.mask) || (d && d.mask)) tideCell[i] = 1;
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

  return { map, w, h, slots, chunksX, chunksY, layerUsed, tideSensitive, propCells, objects, rainCells: Int32Array.from(rainCells), states: [null, null, null] };
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
 * @property {any[]|null} base       frame canvases of an animated base (null = static base)
 * @property {number} fps
 * @property {number} phase          frame offset
 * @property {number} mode           0 loop, 1 wind gust (cover: draws only while a gust passes)
 * @property {Array<{frames: any[], fps: number}>} edges   overlays redrawn after the base
 */

/**
 * @typedef {Object} TileRenderer
 * @property {(map: object) => void} setMap
 * @property {() => object|null} analysis
 * @property {(rect: {x: number, y: number, w: number, h: number}, tide: string, grade: object, bc?: Partial<BakeCtx>) => number} missing
 *   count of visible chunk layers not baked for this key (0 = ready)
 * @property {(rect: object, tide: string, grade: object, opts?: {ring?: boolean, bc?: Partial<BakeCtx>}) => void} request   queue the missing ones (visible first, then a ring)
 * @property {(rect: object, tide: string, grade: object, bc?: Partial<BakeCtx>) => number} bakeNow   bake every missing visible chunk synchronously
 * @property {(budgetMs?: number) => number} pump   bake queued chunks within a budget; returns how many
 * @property {(ctx: any, layer: number, rect: object, camX: number, camY: number, tide: string, grade: object) => number} drawLayer
 * @property {(ctx: any, layer: number, rect: object, camX: number, camY: number, tide: string, grade: object, ms: number) => number} drawAnimated
 * @property {(x: number, y: number, ms: number) => void} rustle   start a cover rustle at a cell
 * @property {(ctx: any, rect: object, camX: number, camY: number, grade: object, ms: number) => void} drawRain   rain ripples on walkable ground
 * @property {MapObject[]} objects
 * @property {() => void} invalidate   drop every bake (flags / tier / roof changed)
 * @property {(bc: Partial<BakeCtx>) => void} setBakeContext   flags, tier, roof, cond (invalidates when they change)
 * @property {() => object} stats
 */

/**
 * @param {{maxChunks?: number, maxCombos?: number, budgetMs?: number}} [opts]
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
  let baked = 0, bakeMs = 0;
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
    if (c) {
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
      return c;
    }
    return makeCanvas(CHUNK_PX, CHUNK_PX);
  }

  function framesOf(art, grade, flip, variant) {
    const d = artDef(art);
    const nf = (variant && d.variants && d.variants[variant] ? d.variants[variant] : d.frames).length;
    const out = new Array(nf);
    for (let f = 0; f < nf; f++) {
      out[f] = variant ? getSprite(art, { frame: f, name: variant, grade, flipX: !!(flip & 1), flipY: !!(flip & 2) }).canvas : getTile(art, f, grade, flip).canvas;
    }
    return out;
  }

  /**
   * Bakes one chunk layer.
   * @returns {{canvas: any, anim: AnimEntry[], key: number}}
   */
  function bake(key) {
    const t0 = nowMs();
    const { chunk: c, layer, tide: ti, grade: gi } = decodeChunkKey(key);
    const grade = gradeAt(gi);
    const tide = ti === 0 ? 'low' : ti === 2 ? 'high' : 'mid';
    const bc = { tide, grade, flags: bakeCtx.flags, tier: bakeCtx.tier, roof: bakeCtx.roof, cond: bakeCtx.cond };
    const cx = c % A.chunksX, cy = (c - cx) / A.chunksX;
    const ox = cx * CHUNK_PX, oy = cy * CHUNK_PX;
    const { w, h, map } = A;
    const canvas = takeCanvas();
    const g = ctx2d(canvas);
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
          if (layer === 1) drawCellShadow(g, cell.art, px, py, sh);
          const img = cell.variant ? getSprite(cell.art, { frame: 0, name: cell.variant, grade, flipX: !!(cell.flip & 1), flipY: !!(cell.flip & 2) }) : getTile(cell.art, 0, grade, cell.flip);
          g.drawImage(img.canvas, px, py);
          if (animated) {
            entry = { px: x * TILE_PX, py: y * TILE_PX, base: framesOf(cell.art, grade, cell.flip, cell.variant), fps: d.fps, phase: cover ? 0 : (x * 3 + y * 5) & 3, mode: cover ? 1 : 0, edges: [], gust: cover ? (hash2(x, y) % 400) : 0 };
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
              entry.edges.push({ frames: framesOf(eid, grade, flip, null), fps: ed.fps });
            } else {
              g.drawImage(getTile(eid, 0, grade, flip).canvas, px, py);
              if (entry && entry.base && entry.mode === 0) entry.edges.push({ frames: [getTile(eid, 0, grade, flip).canvas], fps: 0 });
            }
          }
        }
        if (layer === 1) {
          const props = A.propCells.get(i);
          if (props) {
            for (const p of props) {
              if (p.cond !== undefined && p.cond !== null && bc.cond && !bc.cond(p.cond)) continue;
              const lit = isLit({ glowFlag: null }, grade, bc.flags);
              drawCellShadow(g, p.art, px, py, sh);
              const art = p.lit && lit ? p.lit : p.art;
              const img = p.litVariant && lit ? getSprite(art, { name: 'lit', grade }) : getTile(art, 0, grade, 0);
              g.drawImage(img.canvas, px, py);
            }
          }
        }
        if (entry && (entry.base || entry.edges.length)) anim.push(entry);
      }
    }
    if (layer === 0) bakeBuildingShade(g, tx0, ty0, tx1, ty1, grade, sh, bc);
    if (layer === 1) bakePropBuildingShade(g, tx0, ty0, tx1, ty1, grade, sh);
    baked++;
    DRAW.bakes++;
    bakeMs += nowMs() - t0;
    return { canvas, anim, key, ox, oy };
  }

  function drawCellShadow(g, art, px, py, sh) {
    if (sh.alpha < 0.01) return;
    const s = getShadow(art, 0);
    if (!s) return;
    g.globalAlpha = sh.alpha;
    g.drawImage(s.canvas, px + sh.dx, py + sh.dy);
    g.globalAlpha = 1;
  }

  /** Whether a cell holds building art (ground, detail or a house-recipe prop). */
  function buildingAt(x, y) {
    if (x < 0 || y < 0 || x >= A.w || y >= A.h) return false;
    const i = y * A.w + x;
    const g = A.slots[A.map.layers[0][i]];
    if (g && g.building) return true;
    const d = A.slots[A.map.layers[1][i]];
    if (d && d.building) return true;
    const props = A.propCells.get(i);
    if (props) for (const p of props) if (p.building) return true;
    return false;
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

  /**
   * House cast shadows (bottom-right, by the sun) and eave shade, drawn as one dithered union so
   * overlapping strips never double-darken. Considers a one-tile margin so shadows cross chunk edges.
   */
  function shadeInto(g, tx0, ty0, tx1, ty1, grade, sh, pred) {
    const ox = tx0 * TILE_PX, oy = ty0 * TILE_PX;
    let any = false;
    g.save();
    g.beginPath();
    g.rect(0, 0, CHUNK_PX, CHUNK_PX);
    g.clip();
    g.beginPath();
    if (sh.alpha >= 0.01) {
      for (let y = ty0 - 1; y < ty1; y++) {
        for (let x = tx0 - 1; x < tx1; x++) {
          if (!pred(x, y)) continue;
          const px = x * TILE_PX - ox, py = y * TILE_PX - oy;
          if (!pred(x, y + 1)) { g.rect(px + sh.dx, py + TILE_PX, TILE_PX, sh.dy + 2); any = true; }
          if (!pred(x + 1, y)) {
            const top = roofAt(x, y) && !roofAt(x, y - 1) ? 6 : 0;
            g.rect(px + TILE_PX, py + top + sh.dy, sh.dx + 1, TILE_PX - top + (pred(x, y + 1) ? 0 : 2));
            any = true;
          }
        }
      }
    }
    if (any) {
      g.fillStyle = checkerPattern(g, gradeColour('shadow', grade));
      g.globalAlpha = Math.min(0.5, sh.alpha * 1.4);
      g.fill();
      g.globalAlpha = 1;
    }
    // eave shade on the wall row under a roof: two solid rows then a dithered row
    g.beginPath();
    let eave = false;
    for (let y = ty0; y < ty1; y++) {
      for (let x = tx0; x < tx1; x++) {
        if (!pred(x, y) || roofAt(x, y) || !roofAt(x, y - 1)) continue;
        const px = x * TILE_PX - ox, py = y * TILE_PX - oy;
        g.rect(px, py, TILE_PX, 2);
        for (let k = (py & 1); k < TILE_PX; k += 2) g.rect(px + k, py + 2, 1, 1);
        eave = true;
      }
    }
    if (eave) {
      g.fillStyle = gradeColour('shadow', grade);
      g.globalAlpha = 0.42;
      g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
    if (any || eave) DRAW.fills++;
  }

  function bakeBuildingShade(g, tx0, ty0, tx1, ty1, grade, sh) {
    shadeInto(g, tx0, ty0, tx1, ty1, grade, sh, (x, y) => {
      if (x < 0 || y < 0 || x >= A.w || y >= A.h) return false;
      const i = y * A.w + x;
      const s = A.slots[A.map.layers[0][i]];
      return !!(s && s.building);
    });
  }
  function bakePropBuildingShade(g, tx0, ty0, tx1, ty1, grade, sh) {
    let has = false;
    for (let y = ty0 - 1; y < ty1 && !has; y++) for (let x = tx0 - 1; x < tx1; x++) {
      if (x < 0 || y < 0 || x >= A.w || y >= A.h) continue;
      const p = A.propCells.get(y * A.w + x);
      if (p && p.some((q) => q.building)) { has = true; break; }
    }
    if (!has) return;
    shadeInto(g, tx0, ty0, tx1, ty1, grade, sh, (x, y) => {
      if (x < 0 || y < 0 || x >= A.w || y >= A.h) return false;
      const p = A.propCells.get(y * A.w + x);
      return !!(p && p.some((q) => q.building));
    });
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

    missing(rect, tide, grade) {
      if (!A) return 0;
      const R = visibleRange(rect, rect.camX ?? 0, rect.camY ?? 0, false);
      let n = 0;
      for (let cy = R.y0; cy <= R.y1; cy++) for (let cx = R.x0; cx <= R.x1; cx++) {
        for (let L = 0; L < LAYER_COUNT; L++) {
          if (!layerUsed(cx, cy, L)) continue;
          if (!cache.has(keyFor(cx, cy, L, tide, grade))) n++;
        }
      }
      return n;
    },

    request(rect, tide, grade, o = {}) {
      if (!A) return;
      const g = gradeIndex(grade);
      wanted.add(g * 3 + TIDE_INDEX[tide]);
      wanted.add(g * 3 + TIDE_CANON);
      for (const pass of o.ring === false ? [false] : [false, true]) {
        const R = visibleRange(rect, rect.camX ?? 0, rect.camY ?? 0, pass);
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

    bakeNow(rect, tide, grade) {
      if (!A) return 0;
      const R = visibleRange(rect, rect.camX ?? 0, rect.camY ?? 0, false);
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
        const k = queue[qHead++];
        queued.delete(k);
        if (cache.has(k)) continue;
        if (wanted.size && !wanted.has(comboOf(k))) continue;
        cache.set(k, bake(k));
        n++;
        if (nowMs() - t0 >= budgetMs) break;
      }
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
        for (let k = 0; k < list.length; k++) {
          const e = list[k];
          if (e.px < vx0 || e.py < vy0 || e.px > vx1 || e.py > vy1) continue;
          if (e.mode === 1) {
            // a wind gust rolls east across cover every ~6 s; each tuft bends for 3 poses
            let t = (ms - e.px * 9 - e.py * 3 + e.gust) % 6000;
            if (t < 0) t += 6000;
            const f = t < 70 ? 1 : t < 140 ? 2 : t < 210 ? 1 : 0;
            if (f === 0 || !e.base) continue;
            ctx.drawImage(e.base[f % e.base.length], e.px + dx, e.py + dy);
            n++;
            continue;
          }
          if (e.base) {
            const f = Math.floor((ms * e.fps) / 1000 + e.phase) % e.base.length;
            ctx.drawImage(e.base[f], e.px + dx, e.py + dy);
            n++;
          }
          for (let j = 0; j < e.edges.length; j++) {
            const ed = e.edges[j];
            const fr = ed.frames;
            const f = fr.length > 1 ? Math.floor((ms * ed.fps) / 1000 + e.phase) % fr.length : 0;
            ctx.drawImage(fr[f], e.px + dx, e.py + dy);
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
      const color = gradeColour('snow2', grade);
      ctx.fillStyle = color;
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
      return { ...cache.stats(), baked, bakeMs: Math.round(bakeMs * 100) / 100, queued: queue.length - qHead, pooled: pool.length };
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
      ctx.drawImage(getTile(art, f, grade, 0).canvas, px + dx, py + dy);
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

/** @type {WeakMap<object, Map<string, any>>} per-context checker patterns by colour */
const PATTERNS = new WeakMap();

/**
 * A 2x2 checker pattern (50% dither) in one colour, cached per context and colour.
 * @param {any} g context
 * @param {string} color
 * @returns {any}
 */
function checkerPattern(g, color) {
  let m = PATTERNS.get(g);
  if (!m) { m = new Map(); PATTERNS.set(g, m); }
  let p = m.get(color);
  if (!p) {
    const c = makeCanvas(2, 2);
    const cg = ctx2d(c);
    cg.fillStyle = color;
    cg.fillRect(0, 0, 1, 1);
    cg.fillRect(1, 1, 1, 1);
    p = g.createPattern(c, 'repeat');
    m.set(color, p);
  }
  return p;
}

/**
 * The tide variant for a clock tide (height 0..1, state or variant): `world/tide.tideVariant`.
 * @param {number|string} tide
 * @returns {'low'|'mid'|'high'}
 */
export function tideOf(tide) {
  return tideVariant(tide);
}

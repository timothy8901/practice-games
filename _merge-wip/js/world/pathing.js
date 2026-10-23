/**
 * Grid pathfinding on a runtime map (ARCHITECTURE §4.4): 4-directional A* over `passable(x, y,
 * tideState, mover)`, bounded by a maximum path length, plus an LRU cache keyed by
 * `(mapId, from, to, tideVariant, mover)` so NPC schedules do not re-search every tick.
 *
 * Pure and deterministic: a fixed neighbour order and total tie-breaking (f, then h, then cell
 * index) mean the same grid always yields the same path. The search scratch (open heap, scores,
 * parents) is a set of typed arrays grown on demand and reused, stamped by a generation counter so
 * nothing is cleared between searches; the only allocation per search is the returned path.
 *
 * Paths are flat arrays `[x0, y0, x1, y1, ...]` of the tiles to step onto, excluding the start tile
 * and including the goal. An empty array means "already there"; `null` means unreachable within
 * the limits. Cached paths are frozen: treat every returned path as read-only.
 *
 * Lane: WORLD-ENT.
 * @module world/pathing
 */

import { tideVariant } from './tide.js';

/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {import('./entities.js').Mover} Mover */
/** @typedef {(x: number, y: number, tideState: TideState, mover: Mover) => boolean} Passable */
/** @typedef {{w: number, h: number, passable: Passable, id?: string}} PathGrid */

/**
 * @typedef {Object} PathOptions
 * @property {TideState} tideState
 * @property {Mover} [mover='npc']
 * @property {number} [maxLen=DEFAULT_MAX_PATH]   longest path (in steps) to return; longer targets count as unreachable
 * @property {number} [maxNodes]                  search budget in expanded cells (default: the whole grid)
 * @property {boolean} [adjacent=false]           succeed on any passable tile orthogonally next to the goal (walk up to an entity)
 * @property {(x: number, y: number) => boolean} [blocked]   extra dynamic obstacles; never part of a cache key
 */

/** Default cap on path length in steps (§4.4 `tuning.npcCatchUpTiles` is the catch-up cap, this is the search cap). */
export const DEFAULT_MAX_PATH = 96;
/** Default number of entries a {@link createPathCache} cache holds. */
export const PATH_CACHE_MAX = 256;

/** Neighbour order: up, right, down, left (matches entities.DIRS). */
const NDX = [0, 1, 0, -1];
const NDY = [-1, 0, 1, 0];

// ---- reusable scratch -------------------------------------------------------------------------
let cap = 0;
/** @type {Int32Array} */ let gScore;    // steps from start
/** @type {Int32Array} */ let fScore;    // g + h
/** @type {Int32Array} */ let hScore;    // heuristic (tie-break)
/** @type {Int32Array} */ let parent;    // cell index of predecessor, -1 at start
/** @type {Int32Array} */ let seen;      // generation stamp: cell has a g value
/** @type {Int32Array} */ let closed;    // generation stamp: cell expanded
/** @type {Int32Array} */ let heap;      // binary heap of cell indices
let gen = 0;

/** @param {number} n */
function ensureScratch(n) {
  if (n <= cap) return;
  cap = Math.max(n, cap * 2, 1024);
  gScore = new Int32Array(cap); fScore = new Int32Array(cap); hScore = new Int32Array(cap);
  parent = new Int32Array(cap); seen = new Int32Array(cap); closed = new Int32Array(cap);
  heap = new Int32Array(cap + 1);
  gen = 0;
}

/** Total order on heap entries: lower f, then lower h, then lower index. */
function less(a, b) {
  if (fScore[a] !== fScore[b]) return fScore[a] < fScore[b];
  if (hScore[a] !== hScore[b]) return hScore[a] < hScore[b];
  return a < b;
}

let heapSize = 0;
/** @param {number} i cell index */
function heapPush(i) {
  let k = heapSize++;
  heap[k] = i;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (!less(heap[k], heap[p])) break;
    const t = heap[k]; heap[k] = heap[p]; heap[p] = t;
    k = p;
  }
}
/** @returns {number} cell index with the smallest key */
function heapPop() {
  const top = heap[0];
  const last = heap[--heapSize];
  if (heapSize > 0) {
    heap[0] = last;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < heapSize && less(heap[l], heap[m])) m = l;
      if (r < heapSize && less(heap[r], heap[m])) m = r;
      if (m === k) break;
      const t = heap[k]; heap[k] = heap[m]; heap[m] = t;
      k = m;
    }
  }
  return top;
}

/**
 * Finds a shortest 4-directional path.
 * @param {PathGrid} grid     anything with `w`, `h` and `passable(x, y, tideState, mover)` (a RuntimeMap)
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {PathOptions} opts
 * @returns {number[]|null}   flat `[x, y, ...]` steps excluding `from`; `[]` when already at the goal; `null` when unreachable
 */
export function findPath(grid, from, to, opts) {
  const w = grid.w | 0, h = grid.h | 0;
  if (!opts || typeof opts.tideState !== 'string') throw new TypeError('findPath: opts.tideState is required');
  if (!Number.isInteger(from.x) || !Number.isInteger(from.y) || !Number.isInteger(to.x) || !Number.isInteger(to.y)) {
    throw new TypeError('findPath: from/to must be integer tiles');
  }
  if (from.x < 0 || from.y < 0 || from.x >= w || from.y >= h) return null;
  if (to.x < 0 || to.y < 0 || to.x >= w || to.y >= h) return null;
  const mover = opts.mover || 'npc';
  const maxLen = opts.maxLen ?? DEFAULT_MAX_PATH;
  const maxNodes = opts.maxNodes ?? w * h;
  const adjacent = opts.adjacent === true;
  const blocked = opts.blocked || null;
  const passable = grid.passable;
  const tide = opts.tideState;
  const n = w * h;

  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  if (start === goal) return [];
  if (adjacent && Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1) return [];
  if (!adjacent && (!passable(to.x, to.y, tide, mover) || (blocked && blocked(to.x, to.y)))) return null;
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) - (adjacent ? 1 : 0) > maxLen) return null;

  ensureScratch(n);
  gen++;
  if (gen === 0x7fffffff) { seen.fill(0); closed.fill(0); gen = 1; }
  heapSize = 0;

  gScore[start] = 0;
  hScore[start] = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  fScore[start] = hScore[start];
  parent[start] = -1;
  seen[start] = gen;
  heapPush(start);

  let expanded = 0;
  let found = -1;
  while (heapSize > 0) {
    const cur = heapPop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) { found = cur; break; }
    const cx = cur % w, cy = (cur - cx) / w;
    if (adjacent && Math.abs(cx - to.x) + Math.abs(cy - to.y) === 1) { found = cur; break; }
    if (++expanded > maxNodes) break;
    const g = gScore[cur];
    if (g >= maxLen) continue;
    for (let d = 0; d < 4; d++) {
      const nx = cx + NDX[d], ny = cy + NDY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (closed[ni] === gen) continue;
      if (!passable(nx, ny, tide, mover)) continue;
      if (blocked && blocked(nx, ny)) continue;
      const ng = g + 1;
      if (seen[ni] === gen && gScore[ni] <= ng) continue;
      seen[ni] = gen;
      gScore[ni] = ng;
      hScore[ni] = Math.abs(nx - to.x) + Math.abs(ny - to.y);
      fScore[ni] = ng + hScore[ni];
      parent[ni] = cur;
      heapPush(ni);
    }
  }
  if (found === -1) return null;

  const len = gScore[found];
  if (len > maxLen) return null;
  const path = new Array(len * 2);
  let i = found, k = len - 1;
  while (i !== start) {
    const x = i % w;
    path[k * 2] = x;
    path[k * 2 + 1] = (i - x) / w;
    i = parent[i];
    k--;
  }
  return path;
}

/**
 * Number of steps in a path.
 * @param {number[]|null} path
 * @returns {number}
 */
export function pathLength(path) {
  return path ? path.length >> 1 : 0;
}

/**
 * Cache key for a path request. `variant` is the tide passability class (from `world/tide.tideVariant`:
 * `'low'`, `'mid'` or `'high'`); passing the raw tide state also works, at the cost of duplicate entries.
 * @param {string} mapId
 * @param {number} fx @param {number} fy @param {number} tx @param {number} ty
 * @param {string} variant
 * @param {string} mover
 * @param {boolean} [adjacent=false]
 * @returns {string}
 */
export function pathKey(mapId, fx, fy, tx, ty, variant, mover, adjacent = false) {
  return `${mapId}|${fx},${fy}>${tx},${ty}|${variant}|${mover}${adjacent ? '|adj' : ''}`;
}

/**
 * @typedef {Object} PathCache
 * @property {(key: string) => (readonly number[]|null|undefined)} get   `undefined` = miss; `null` = cached "unreachable"
 * @property {(key: string, path: readonly number[]|null) => readonly number[]|null} set
 * @property {(pred?: string|((key: string) => boolean)) => number} invalidate   drop entries whose key starts with `pred` (a map id prefix) or satisfies the predicate; no argument clears all; returns the count dropped
 * @property {(variant: string, mapId?: string) => number} invalidateVariant   drop every entry computed under a tide variant (optionally on one map); call on a tide flip to free the stale half early; returns the count dropped
 * @property {() => void} clear
 * @property {() => number} size
 * @property {{hits: number, misses: number, evictions: number}} stats
 * @property {number} max
 */

/**
 * Creates an LRU path cache. A hit refreshes the entry; when full, the least recently used entry goes.
 * @param {{max?: number}} [opts]
 * @returns {PathCache}
 */
export function createPathCache(opts = {}) {
  const max = opts.max ?? PATH_CACHE_MAX;
  if (!Number.isInteger(max) || max < 1) throw new RangeError('createPathCache: max must be a positive integer');
  /** @type {Map<string, readonly number[]|null>} */
  const map = new Map();
  const stats = { hits: 0, misses: 0, evictions: 0 };
  return {
    max, stats,
    get(key) {
      if (!map.has(key)) { stats.misses++; return undefined; }
      const v = map.get(key);
      map.delete(key); map.set(key, v);
      stats.hits++;
      return v;
    },
    set(key, path) {
      const v = path === null ? null : Object.freeze(path);
      if (map.has(key)) map.delete(key);
      else if (map.size >= max) { map.delete(map.keys().next().value); stats.evictions++; }
      map.set(key, v);
      return v;
    },
    invalidate(pred) {
      if (pred === undefined) { const n = map.size; map.clear(); return n; }
      let n = 0;
      const test = typeof pred === 'function' ? pred : (k) => k.startsWith(pred + '|');
      for (const k of map.keys()) if (test(k)) { map.delete(k); n++; }
      return n;
    },
    invalidateVariant(variant, mapId) {
      let n = 0;
      const mid = `|${variant}|`;
      const prefix = mapId === undefined ? null : mapId + '|';
      for (const k of map.keys()) {
        if (prefix !== null && !k.startsWith(prefix)) continue;
        if (k.includes(mid)) { map.delete(k); n++; }
      }
      return n;
    },
    clear() { map.clear(); },
    size: () => map.size,
  };
}

/**
 * Cached {@link findPath}. The key uses `opts.variant` (default: `world/tide.tideVariant(opts.tideState)`,
 * so `'rising'` and `'falling'` share the `'mid'` entries), and a tide change therefore misses the
 * cache and re-searches with the new passability; stale entries age out by LRU or go at once with
 * `cache.invalidateVariant(old)`. `opts.blocked` is NOT part of the key: pass dynamic obstacles only
 * to uncached `findPath` calls.
 * @param {PathCache} cache
 * @param {PathGrid & {id: string}} map
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {PathOptions & {variant?: string}} opts
 * @returns {readonly number[]|null}
 */
export function findPathCached(cache, map, from, to, opts) {
  if (opts.blocked) throw new TypeError('findPathCached: opts.blocked is not cacheable; use findPath');
  if (!opts || typeof opts.tideState !== 'string') throw new TypeError('findPathCached: opts.tideState is required');
  const variant = opts.variant ?? tideVariant(opts.tideState);
  const key = pathKey(map.id, from.x, from.y, to.x, to.y, variant, opts.mover || 'npc', opts.adjacent === true);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  return cache.set(key, findPath(map, from, to, opts));
}

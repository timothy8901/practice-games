#!/usr/bin/env node
// Map reachability prover (GDD-00 §4 "a map test proves every Waystone and Spire reachable at any
// tide"; GDD-01 §17). Loads every map through js/world/tilemap.loadMap, resolves every tide-gated tile
// against the real tide windows (js/systems/clockSys.tideWindow: causeway ±150, stones ±120, flats ±90,
// the Bar ±90 of the day's LOWER low or any tide once `lit.bar` is set, the spur ±90 of every low,
// mainland ±60; spring-only tiles on spring days), and breadth-first walks the whole world from the
// Keeper's Cottage door, following warps (doors, edges, stairs; their conds evaluated against the flags
// of the scenario) and treating solid entities as walls.
//
//   node tools/map-reachability.mjs            human report, exit 1 on any failed claim
//   import { proveWorld, ... } from './map-reachability.mjs'   (test/data.world.reach.test.mjs)
//
// Tide-gated tiles declare their way in data/tilesets (`way: 'stones'|'causeway'|'flats'|'bar'|'spur'|
// 'mainland'`, `openFlag`, `spring`). Each short-way warp declares `via: 'short-way'` and `way`; each
// long way `via: 'long-way'`. Pure apart from the CLI block at the bottom.
import { loadMap } from '../js/world/tilemap.js';
import { tideVariant, strandedTiles } from '../js/world/tide.js';
import { evalCond } from '../js/script/cond.js';
import { tideWindow, tidesForDay, tideOffsetFor, isSpringTideDay, DEFAULTS as CLOCK } from '../js/systems/clockSys.js';
import { tideAt, MINUTES_PER_DAY } from '../js/core/time.js';
import { TILES, DEFAULT_LEGEND } from '../js/data/tilesets.js';
import { MAPS, MAPS_BY_ID } from '../js/data/maps/index.js';
import { WAYSTONE_IDS } from '../js/data/ids.manifest.js';

/** Where the player starts: the cell in front of the Keeper's Cottage door (GDD-01 §5). */
export const START = Object.freeze({ mapId: 'pellwick', x: 9, y: 23 });

/** Way kinds a tide tile may name (clockSys TIDE_WINDOWS keys). */
export const WAYS = Object.freeze(Object.keys(CLOCK.TIDE_WINDOWS));

const TIDE_OFFSET = tideOffsetFor(CLOCK.TIDE_DAY1_LOW);

/**
 * The world state a moment needs: the clock total and the scenario flags.
 * @param {number} total absolute in-game minute
 * @param {Record<string, any>} flags
 */
export function worldAt(total, flags = {}) {
  return { clock: { total }, flags: { ...flags }, counters: {}, inventory: {}, wallet: { main: 0 }, player: { mapId: START.mapId, x: START.x, y: START.y, facing: 'down' } };
}

/**
 * Which tide-gated ways are open at a moment, keyed by way kind (plus `spring` for spring-only tiles).
 * @param {number} total
 * @param {Record<string, any>} flags
 * @returns {Record<string, boolean>}
 */
export function openWays(total, flags = {}) {
  const world = worldAt(total, flags);
  const out = {};
  for (const way of WAYS) out[way] = tideWindow(world, way, { total, barLit: flags[CLOCK.TIDE_BAR_LIT_FLAG] === true }).open;
  out.spring = isSpringTideDay(Math.floor(total / MINUTES_PER_DAY) + 1);
  return out;
}

/**
 * Whether one tide tile is dry at a moment.
 * @param {any} t TileDef with tide 'low'|'glow'
 * @param {Record<string, boolean>} ways from {@link openWays}
 * @param {Record<string, any>} flags
 */
export function tileOpen(t, ways, flags) {
  if (t.openFlag && flags[t.openFlag] === true) return true;
  const way = t.way ?? inferWay(t);
  let open = Boolean(ways[way]);
  if (t.spring) open = open && ways.spring;
  return open;
}

/** Fallback for a tide tile without `way`: by its window length (GDD-00 §4). */
function inferWay(t) {
  if (t.lowerLow) return 'bar';
  return { 150: 'causeway', 120: 'stones', 90: 'flats', 60: 'mainland' }[t.tideWindow] ?? 'flats';
}

/**
 * The tileset with every tide-gated tile resolved for a moment: open tiles are plain dry ground,
 * closed ones plain water. Every other field (solid, verb, art, ...) is kept.
 * @param {Record<string, boolean>} ways
 * @param {Record<string, any>} flags
 */
export function resolveTiles(ways, flags, tiles = TILES) {
  const out = {};
  for (const [id, t] of Object.entries(tiles)) {
    if (t.tide === 'low' || t.tide === 'glow') {
      const open = tileOpen(t, ways, flags);
      out[id] = { ...t, tide: null, water: !open };
    } else out[id] = t;
  }
  return out;
}

/** Solid entity cells of a map def for a scenario (an entity whose cond fails is absent). */
export function blockedCells(def, world) {
  const s = new Set();
  for (const e of def.entities ?? []) {
    if (e.solid === false || e.kind === 'npc') continue;
    if (e.cond !== undefined && e.cond !== null) {
      let present = true;
      try { present = evalCond(world, e.cond, {}); } catch { present = true; }
      if (!present) continue;
    }
    s.add(e.y * def.w + e.x);
  }
  return s;
}

function warpPasses(world, w) {
  if (w.cond === undefined || w.cond === null) return true;
  try { return Boolean(evalCond(world, w.cond, {})); } catch { return false; }
}

/**
 * A snapshot of the whole world at one moment: every map loaded with the resolved tileset.
 * @param {number} total
 * @param {Record<string, any>} flags
 */
export function snapshot(total, flags = {}) {
  const ways = openWays(total, flags);
  const tiles = resolveTiles(ways, flags);
  const world = worldAt(total, flags);
  const variant = tideVariant(tideAt(total, TIDE_OFFSET));
  const maps = new Map();
  for (const def of MAPS) {
    const rm = loadMap(def, tiles, { legend: DEFAULT_LEGEND });
    maps.set(def.id, { def, rm, blocked: blockedCells(def, world) });
  }
  return { total, flags, ways, world, variant, maps };
}

/** Whether a walker may stand on a cell in a snapshot. */
export function walkable(snap, mapId, x, y) {
  const m = snap.maps.get(mapId);
  if (!m || !m.rm.inBounds(x, y)) return false;
  return m.rm.passable(x, y, snap.variant, 'walk') && !m.blocked.has(y * m.def.w + x);
}

/**
 * Breadth-first over the world from `start`, following warps. Returns the reached cells per map.
 * @param {ReturnType<typeof snapshot>} snap
 * @param {{mapId: string, x: number, y: number}} [start]
 * @param {{warps?: boolean}} [opts] `warps: false` keeps the walk on the start map
 * @returns {Map<string, Set<number>>}
 */
export function reachWorld(snap, start = START, opts = {}) {
  const followWarps = opts.warps !== false;
  const seen = new Map();
  const mark = (mapId, x, y) => {
    let s = seen.get(mapId);
    if (!s) { s = new Set(); seen.set(mapId, s); }
    const k = y * snap.maps.get(mapId).def.w + x;
    if (s.has(k)) return false;
    s.add(k);
    return true;
  };
  if (!walkable(snap, start.mapId, start.x, start.y)) return seen;
  const q = [[start.mapId, start.x, start.y]];
  mark(start.mapId, start.x, start.y);
  while (q.length) {
    const [mapId, x, y] = q.shift();
    const m = snap.maps.get(mapId);
    if (followWarps) {
      const w = m.rm.warpAt(x, y);
      if (w && warpPasses(snap.world, w) && snap.maps.has(w.to.mapId) && walkable(snap, w.to.mapId, w.to.x, w.to.y)) {
        if (mark(w.to.mapId, w.to.x, w.to.y)) q.push([w.to.mapId, w.to.x, w.to.y]);
      }
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (walkable(snap, mapId, nx, ny) && mark(mapId, nx, ny)) q.push([mapId, nx, ny]);
    }
  }
  return seen;
}

const has = (reach, mapId, def, x, y) => Boolean(reach.get(mapId)?.has(y * def.w + x));
const nextTo = (reach, mapId, def, x, y) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => has(reach, mapId, def, x + dx, y + dy));

/** Waystone entities across the maps: {id, mapId, x, y}. */
export function waystones() {
  const out = [];
  for (const def of MAPS) for (const e of def.entities ?? []) if (e.waystone && WAYSTONE_IDS.includes(e.id)) out.push({ id: e.id, mapId: def.id, x: e.x, y: e.y });
  return out;
}

/** Spire doors: {spire, mapId, x, y}. */
export function spireDoors() {
  const out = [];
  for (const def of MAPS) for (const w of def.warps ?? []) if (w.to.mapId.startsWith('spire-') && !def.id.startsWith('spire-')) out.push({ spire: w.to.mapId, mapId: def.id, x: w.x, y: w.y });
  return out;
}

/** Tide-gated warps (short ways, the Bar road, the far Bar door, the spur door): {mapId, x, y, way, to}. */
export function shortWays() {
  const out = [];
  for (const def of MAPS) for (const w of def.warps ?? []) if (w.way !== undefined || w.via === 'short-way') out.push({ mapId: def.id, x: w.x, y: w.y, w: w.w ?? 1, way: w.way, openFlag: w.openFlag ?? null, to: w.to });
  return out;
}

/** What the world reaches in a snapshot: every Waystone, Spire door and map, by name. */
export function census(snap, reach = reachWorld(snap)) {
  const ws = Object.fromEntries(waystones().map((s) => [s.id, nextTo(reach, s.mapId, MAPS_BY_ID[s.mapId], s.x, s.y)]));
  const spires = Object.fromEntries(spireDoors().map((d) => [d.spire, has(reach, d.mapId, MAPS_BY_ID[d.mapId], d.x, d.y) && reach.has(d.spire)]));
  const maps = Object.fromEntries(MAPS.map((m) => [m.id, reach.has(m.id)]));
  return { waystones: ws, spires, maps };
}

/** Absolute minute of the first high water on a game day (the hardest moment for walkers). */
export function highWater(day) {
  return tidesForDay(day).find((t) => t.kind === 'high').total;
}
/** Absolute minute of the day's lower low and of its other low. */
export function lowsOf(day) {
  const lows = tidesForDay(day).filter((t) => t.kind === 'low');
  return { lower: lows.find((t) => t.lower)?.total ?? null, other: lows.find((t) => !t.lower)?.total ?? null };
}

/**
 * Short-way window check: for each short way, at every sampled minute, the warp cell is reachable on
 * its own map (no warps, from the map's entry) exactly when its declared way is open.
 * @param {{from: number, to: number, step: number, flags?: Record<string, any>}} range
 * @returns {{mapId: string, x: number, y: number, way: string, total: number, open: boolean, reached: boolean}[]} mismatches
 */
export function shortWayMismatches({ from, to, step, flags = {} }) {
  const ways = shortWays();
  const bad = [];
  const cache = new Map();
  for (let t = from; t < to; t += step) {
    const open = openWays(t, flags);
    const key = JSON.stringify(open);
    let snap = cache.get(key);
    if (!snap) { snap = snapshot(t, flags); cache.set(key, snap); }
    for (const sw of ways) {
      const def = MAPS_BY_ID[sw.mapId];
      const reach = reachWorld(snap, { mapId: sw.mapId, x: def.entry.x, y: def.entry.y }, { warps: false });
      let reached = false;
      for (let i = 0; i < sw.w; i++) reached ||= has(reach, sw.mapId, def, sw.x + i, sw.y);
      const expect = sw.openFlag && flags[sw.openFlag] === true ? true : Boolean(open[sw.way]);
      if (reached !== expect) bad.push({ mapId: sw.mapId, x: sw.x, y: sw.y, way: sw.way, total: t, open: expect, reached });
    }
  }
  return bad;
}

/**
 * Static warp checks: every destination exists, is in bounds and walkable at some tide, is not itself
 * a warp cell (no ping-pong) and is not under a solid entity; every door/stairs destination is dry at
 * both high and low water; every warp pairs with a return warp beside its arrival cell whose own
 * arrival lands beside it (doors in and out of interiors, edges between exteriors).
 * @returns {string[]} problems
 */
export function warpProblems() {
  const out = [];
  const flagsAll = allFlags();
  const lowSnap = snapshot(lowsOf(3).lower, flagsAll);
  const highSnap = snapshot(highWater(3), flagsAll);
  for (const def of MAPS) {
    for (const w of allWarps(def)) {
      const where = `${def.id} warp (${w.x},${w.y}) -> ${w.to.mapId} (${w.to.x},${w.to.y})`;
      const dest = MAPS_BY_ID[w.to.mapId];
      if (!dest) { out.push(`${where}: unknown map`); continue; }
      if (w.to.x < 0 || w.to.y < 0 || w.to.x >= dest.w || w.to.y >= dest.h) { out.push(`${where}: outside the map`); continue; }
      const lo = walkable(lowSnap, dest.id, w.to.x, w.to.y), hi = walkable(highSnap, dest.id, w.to.x, w.to.y);
      if (!lo && !hi) out.push(`${where}: destination is never walkable`);
      if (w.kind !== 'edge' && !(lo && hi)) out.push(`${where}: ${w.kind} destination is not dry at both tides`);
      const destRm = lowSnap.maps.get(dest.id).rm;
      if (destRm.warpAt(w.to.x, w.to.y)) out.push(`${where}: lands on another warp`);
      // the return warp: on the destination map, beside the arrival, leading back beside this warp
      const back = allWarps(dest).filter((b) => b.to.mapId === def.id && cellsOf(b).some(([bx, by]) => Math.abs(bx - w.to.x) + Math.abs(by - w.to.y) <= 1));
      if (!back.length) { out.push(`${where}: no return warp beside the arrival`); continue; }
      if (!back.some((b) => cellsOf(w).some(([wx, wy]) => Math.abs(wx - b.to.x) + Math.abs(wy - b.to.y) <= 1))) out.push(`${where}: the return warp does not land beside this warp`);
    }
  }
  return out;
}

/** A map's warps plus those of its layout variants (GDD-01 §1.14: house tiers add doors). */
export function allWarps(def) {
  return [...(def.warps ?? []), ...(def.variants ?? []).flatMap((v) => v.warps ?? [])];
}

function cellsOf(w) {
  const c = [];
  for (let j = 0; j < (w.h ?? 1); j++) for (let i = 0; i < (w.w ?? 1); i++) c.push([w.x + i, w.y + j]);
  return c;
}

/** Every flag any warp or entity cond on any map reads, set true (the late-game world, for static checks). */
export function allFlags() {
  const f = {};
  const walk = (c) => {
    if (!c || typeof c !== 'object') return;
    if (typeof c.flag === 'string') f[c.flag] = true;
    for (const k of ['all', 'any']) if (Array.isArray(c[k])) c[k].forEach(walk);
  };
  for (const def of MAPS) for (const x of [...(def.warps ?? []), ...(def.entities ?? [])]) walk(x.cond);
  f[CLOCK.TIDE_BAR_LIT_FLAG] = true;
  return f;
}

/** Interiors and enclosed maps whose own door sits behind a tide way or a story flag (not "any tide" claims). */
export const GATED_MAPS = Object.freeze({
  'the-bar': 'the Bar road: every low (the spur window), any tide after lit.bar',
  'hollis-gate': 'the far Bar road: the day\'s lower low, or any tide after lit.bar',
  'keepers-hall': 'sp.summit-open (six badges)',
  'idris-hall': 'sp.summit-open (six badges)',
  'lantern-stack': 'the spur: +-1.5 h of every low',
});

/**
 * The full proof: claims and their results.
 * @returns {{claim: string, ok: boolean, detail?: string}[]}
 */
export function proveWorld() {
  const results = [];
  const claim = (name, ok, detail) => results.push({ claim: name, ok, detail });
  const days = [2, 3, 4, 7, 9];

  for (const day of days) {
    const hw = highWater(day);
    const snap = snapshot(hw, {});
    const c = census(snap);
    const missingWs = Object.entries(c.waystones).filter(([id, ok]) => id !== 'hollis-gate' && !ok).map(([id]) => id);
    claim(`day ${day} high water: every isle Waystone reachable on foot from the cottage door`, missingWs.length === 0, missingWs.join(', '));
    const missingSp = Object.entries(c.spires).filter(([, ok]) => !ok).map(([id]) => id);
    claim(`day ${day} high water: every Spire entrance and Spire reachable`, missingSp.length === 0, missingSp.join(', '));
    const missingMaps = MAPS.filter((m) => !GATED_MAPS[m.id] && !c.maps[m.id]).map((m) => m.id);
    claim(`day ${day} high water: every map but the gated ones reachable (all six interiors, all isles, the Bar head)`, missingMaps.length === 0, missingMaps.join(', '));
    claim(`day ${day} high water, Bar unlit: Shardcrown (hollis-gate) is NOT reachable`, !c.maps['hollis-gate'], '');
    const lit = census(snapshot(hw, { 'lit.bar': true }));
    claim(`day ${day} high water, lit.bar: Shardcrown and the seventh Waystone reachable`, lit.maps['hollis-gate'] && lit.waystones['hollis-gate'], '');
    claim(`day ${day} high water, lit.bar: the Lantern Stack stays behind its spur window`, !lit.maps['lantern-stack'], '');
    const summit = census(snapshot(hw, { 'lit.bar': true, 'sp.summit-open': true }));
    claim(`day ${day} high water, lit.bar + sp.summit-open: the Keepers' Hall and Idris's Hall reachable`, summit.maps['keepers-hall'] && summit.maps['idris-hall'], '');
    const { lower, other } = lowsOf(day);
    if (lower !== null) {
      const atLower = census(snapshot(lower, {}));
      claim(`day ${day} lower low, unlit: Shardcrown and the Lantern Stack reachable`, atLower.maps['hollis-gate'] && atLower.maps['lantern-stack'], '');
    }
    if (other !== null) {
      const atOther = census(snapshot(other, {}));
      claim(`day ${day} other low, unlit: the Lantern Stack reachable by the spur, Shardcrown not`, atOther.maps['lantern-stack'] && !atOther.maps['hollis-gate'], '');
    }
  }

  const from = 1 * MINUTES_PER_DAY, to = 5 * MINUTES_PER_DAY;
  const mm = shortWayMismatches({ from, to, step: 5 });
  claim('every short way is open exactly inside its tide window (days 2-5, every 5 min)', mm.length === 0, summarise(mm));
  const mmLit = shortWayMismatches({ from, to: from + MINUTES_PER_DAY, step: 10, flags: { 'lit.bar': true } });
  claim('after lit.bar the Bar road is open at every sampled minute', mmLit.length === 0, summarise(mmLit));
  const undeclared = shortWays().filter((s) => !WAYS.includes(s.way));
  claim('every short-way warp declares a known way', undeclared.length === 0, undeclared.map((s) => `${s.mapId}(${s.x},${s.y})`).join(', '));

  const wp = warpProblems();
  claim('every warp lands on a walkable cell, doors pair with their return doors, edges pair with their return edges', wp.length === 0, wp.join('; '));

  const stranded = [];
  for (const def of MAPS) {
    const rm = loadMap(def, TILES, { legend: DEFAULT_LEGEND });
    const s = strandedTiles(rm);
    if (s.length) stranded.push(`${def.id}: ${s.length} (first ${s[0].x},${s[0].y})`);
  }
  claim('wade rule: no low-tide cell is cut off from dry land at high water', stranded.length === 0, stranded.join('; '));
  return results;
}

function summarise(mm) {
  if (!mm.length) return '';
  const by = new Map();
  for (const m of mm) {
    const k = `${m.mapId}(${m.x},${m.y}) ${m.way}`;
    const e = by.get(k) || { n: 0, first: m };
    e.n++;
    by.set(k, e);
  }
  return [...by].map(([k, e]) => `${k}: ${e.n} minute(s), e.g. t=${e.first.total} open=${e.first.open} reached=${e.first.reached}`).join('; ');
}

// ------------------------------------------------------------------------------------------------
// CLI
// ------------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = proveWorld();
  let bad = 0;
  for (const r of results) {
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.claim}${!r.ok && r.detail ? `\n       ${r.detail}` : ''}`);
  }
  console.log(`\n${results.length - bad}/${results.length} claims hold`);
  process.exit(bad ? 1 : 0);
}

/**
 * Entity manager for one runtime map (ARCHITECTURE §4.3). Pure: no DOM, no canvas.
 *
 * Entities live on a tile grid. Movement is tile-to-tile: `tryMove` checks collision once at step
 * start and reserves the target tile immediately (the tile being left is freed at the same moment),
 * so two entities can never share a tile and the result does not depend on frame timing.
 * `tickMovement` only advances the sub-tile interpolation `t` and the derived pixel position.
 *
 * Hot paths allocate nothing: the spatial index is a pair of typed arrays (cell head + per-slot
 * chain), `near()` and `ySorted()` return reused arrays, and `tryMove` / `tickMovement` touch only
 * the entity's own fields.
 *
 * Lane: WORLD-ENT.
 * @module world/entities
 */

import { TILE } from '../config.js';
import { evalCond as dslEvalCond } from '../script/cond.js';

/** @typedef {'up'|'down'|'left'|'right'} Dir */
/** @typedef {import('../core/time.js').TideState} TideState */
/** @typedef {'player'|'npc'|'roamer'|'item'|'tree'|'rock'|'crack'|'sign'|'prop'|'boat'} EntityKind */
/** @typedef {'walk'|'npc'|'roamer'|'boat'} Mover */

/**
 * @typedef {Object} Entity
 * @property {string} id            unique within the manager
 * @property {EntityKind} kind
 * @property {number} x             tile coordinates (the target tile while moving)
 * @property {number} y
 * @property {number} fromX         tile the current step started from (equals x/y when idle)
 * @property {number} fromY
 * @property {number} t             step progress 0..1
 * @property {number} px            derived pixel position (whole pixels, top-left of the tile)
 * @property {number} py
 * @property {Dir} facing
 * @property {boolean} moving
 * @property {number} speedMs       ms per tile for the current step (160 walk / 100 run)
 * @property {number} spill         ms left over past the end of the last step (consumed by the next step)
 * @property {boolean} solid        blocks other entities from entering its tile
 * @property {number} z             y-sort offset in pixels (positive draws later)
 * @property {string} artId
 * @property {number} frame
 * @property {string|null} emote
 * @property {object|null} def      the EntityDef this entity was built from, or null for dynamic entities
 * @property {string|null} npcId
 * @property {string|null} speciesId
 * @property {string|null} itemId
 * @property {number[]|null} path   flat [x0, y0, x1, y1, ...] from world/pathing; owner-managed
 * @property {number} slot          index in the manager's slot table; -1 while unmanaged (internal)
 */

/** Ordered directions; `DIR_INDEX`, `DX`, `DY` and `OPPOSITE` follow this order. @type {readonly Dir[]} */
export const DIRS = Object.freeze(['up', 'right', 'down', 'left']);
/** Direction -> index into {@link DIRS}. */
export const DIR_INDEX = Object.freeze({ up: 0, right: 1, down: 2, left: 3 });
/** Tile delta x per direction, in {@link DIRS} order. */
export const DX = Object.freeze([0, 1, 0, -1]);
/** Tile delta y per direction, in {@link DIRS} order. */
export const DY = Object.freeze([-1, 0, 1, 0]);
/** Opposite of each direction. */
export const OPPOSITE = Object.freeze({ up: 'down', down: 'up', left: 'right', right: 'left' });

/** Walking speed in ms per tile. */
export const WALK_MS = 160;
/** Running speed in ms per tile. */
export const RUN_MS = 100;
/** Default ms per tile for NPCs and roamers (a stroll). */
export const STROLL_MS = 220;
/** Slots per manager; the §12 simulation budget (64) is enforced by the scene, this is the hard table size. */
export const ENTITY_CAPACITY = 256;

/** Entity kind -> the `mover` class passed to `map.passable`. */
export const MOVER_OF_KIND = Object.freeze({
  player: 'walk', npc: 'npc', roamer: 'roamer', item: 'walk', tree: 'walk', rock: 'walk',
  crack: 'walk', sign: 'walk', prop: 'walk', boat: 'boat',
});

/**
 * Direction that moves from (0,0) by (dx, dy). Vertical wins on exact diagonals.
 * @param {number} dx
 * @param {number} dy
 * @returns {Dir|null} null for (0, 0)
 */
export function dirTo(dx, dy) {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'up' : 'down';
  return dx < 0 ? 'left' : 'right';
}

/**
 * Builds a fully-populated entity record (every §4.3 key present, `null` never `undefined`).
 * @param {Partial<Entity> & {id: string, kind: EntityKind, x: number, y: number}} init
 * @returns {Entity}
 */
export function createEntity(init) {
  if (typeof init.id !== 'string' || init.id === '') throw new TypeError('createEntity: id must be a non-empty string');
  if (!(init.kind in MOVER_OF_KIND)) throw new TypeError(`createEntity: unknown kind '${init.kind}'`);
  if (!Number.isInteger(init.x) || !Number.isInteger(init.y)) throw new TypeError('createEntity: x and y must be integers');
  const facing = init.facing ?? 'down';
  if (!(facing in DIR_INDEX)) throw new TypeError(`createEntity: bad facing '${facing}'`);
  const e = {
    id: init.id,
    kind: init.kind,
    x: init.x, y: init.y,
    fromX: init.x, fromY: init.y,
    t: 1,
    px: 0, py: 0,
    facing,
    moving: false,
    speedMs: init.speedMs ?? (init.kind === 'player' ? WALK_MS : STROLL_MS),
    spill: 0,
    solid: init.solid ?? true,
    z: init.z ?? 0,
    artId: init.artId ?? `${init.kind}:${init.id}`,
    frame: 0,
    emote: init.emote ?? null,
    def: init.def ?? null,
    npcId: init.npcId ?? null,
    speciesId: init.speciesId ?? null,
    itemId: init.itemId ?? null,
    path: null,
    slot: -1,
  };
  updatePixels(e);
  return e;
}

/**
 * Builds an entity from a map `EntityDef` (§4.1). `art` on the def overrides the default art id.
 * @param {object} def   {kind, id, x, y, facing?, art?, item?, species?, solid?, ...}
 * @returns {Entity}
 */
export function entityFromDef(def) {
  return createEntity({
    id: def.id, kind: def.kind, x: def.x, y: def.y,
    facing: def.facing ?? 'down',
    artId: def.art ?? undefined,
    solid: def.solid ?? true,
    def,
    npcId: def.kind === 'npc' ? def.id : null,
    speciesId: def.species ?? null,
    itemId: def.item ?? null,
  });
}

/**
 * Recomputes `px, py` from the step interpolation. Whole pixels so sprites stay crisp.
 * @param {Entity} e
 */
export function updatePixels(e) {
  const t = e.t;
  e.px = Math.round((e.fromX + (e.x - e.fromX) * t) * TILE);
  e.py = Math.round((e.fromY + (e.y - e.fromY) * t) * TILE);
}

/**
 * @typedef {Object} MoveCtx
 * @property {{passable: (x:number, y:number, tideState: TideState, mover: Mover) => boolean, w: number, h: number}} [map]
 * @property {(x:number, y:number, tideState: TideState, mover: Mover) => boolean} [passable]  overrides `map.passable`
 * @property {TideState} tideState
 * @property {boolean} [run]       use {@link RUN_MS}; otherwise `speedMs` (or {@link WALK_MS} for the player)
 * @property {number} [speedMs]    explicit ms per tile for this step (wins over `run`)
 * @property {Mover} [mover]       overrides {@link MOVER_OF_KIND}
 */

/**
 * @typedef {Object} RebuildCtx
 * @property {(world: object, cond: object, ctx: object) => boolean} [evalCond]   condition evaluator; defaults to the
 *   condition DSL (`script/cond.evalCond`), so a cond-gated neighbour stays away unless its cond holds
 * @property {(npcId: string) => ({x:number, y:number, facing?: Dir}|null)} [placeNpc]   schedule placement; null = not on this map; default = the def's tile
 */

/**
 * @typedef {Object} EntityManager
 * @property {Entity[]} list                       live entities in insertion order (read-only view; do not splice)
 * @property {number} w  @property {number} h
 * @property {(e: Entity) => Entity} add            throws on duplicate id, out-of-bounds tile or full table
 * @property {(id: string) => boolean} remove
 * @property {(id: string) => Entity|null} find
 * @property {(x:number, y:number) => Entity|null} at        solid entity on the tile first, else any
 * @property {(x:number, y:number) => boolean} solidAt
 * @property {(x:number, y:number, r:number, out?: Entity[]) => Entity[]} near   entities with Chebyshev distance <= r; returns a REUSED array unless `out` is given
 * @property {(e: Entity, dir: Dir, ctx: MoveCtx) => boolean} tryMove   faces `dir`; starts the step when the target tile is passable and free
 * @property {(e: Entity, ms: number) => 'arrived'|'moving'|'idle'} tickMovement
 * @property {(ms: number) => Entity[]} tickAll   advances every moving entity; returns the entities that arrived this call (REUSED array)
 * @property {(e: Entity, x:number, y:number, facing?: Dir) => void} teleport   instant placement (no collision check)
 * @property {() => Entity[]} ySorted            live entities ordered by draw order (py + z); REUSED array
 * @property {(world: object, data: object, tideState: TideState, ctx?: RebuildCtx) => {added: string[], removed: string[], skipped: string[]}} rebuildFromDefs   reconciles only entities built from this map's defs; dynamic ones (`def === null` or `def.dynamic`) are never touched
 * @property {() => void} clear
 */

/**
 * Creates an entity manager for a runtime map (needs only `id`, `w`, `h` and `def.entities`).
 * @param {{id: string, w: number, h: number, def?: {entities?: object[]}}} map
 * @param {{capacity?: number}} [opts]
 * @returns {EntityManager}
 */
export function createEntities(map, opts = {}) {
  const w = map.w | 0, h = map.h | 0;
  if (w <= 0 || h <= 0) throw new RangeError('createEntities: map must have positive w and h');
  const capacity = opts.capacity ?? ENTITY_CAPACITY;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 32000) throw new RangeError('createEntities: capacity must be 1..32000');

  /** @type {Entity[]} */
  const list = [];
  /** @type {Map<string, Entity>} */
  const byId = new Map();
  /** slot -> entity (or null when free). */
  const slots = new Array(capacity).fill(null);
  /** free slot stack */
  const free = new Int32Array(capacity);
  let freeTop = capacity;
  for (let i = 0; i < capacity; i++) free[i] = capacity - 1 - i;
  /** cell -> slot + 1 of the first entity in it (0 = empty). */
  const head = new Int32Array(w * h);
  /** slot -> slot + 1 of the next entity in the same cell (0 = end). */
  const next = new Int32Array(capacity);
  /** @type {Entity[]} */
  const nearBuf = [];
  /** @type {Entity[]} */
  const sortBuf = [];
  /** @type {Entity[]} */
  const arrivedBuf = [];
  /** bumped by add/remove so ySorted() knows when to refresh its membership */
  let version = 0;
  let sortedVersion = -1;

  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;

  /** @param {Entity} e @param {number} x @param {number} y */
  function link(e, x, y) {
    const c = y * w + x;
    next[e.slot] = head[c];
    head[c] = e.slot + 1;
  }

  /** @param {Entity} e @param {number} x @param {number} y */
  function unlink(e, x, y) {
    const c = y * w + x;
    let cur = head[c];
    if (cur === e.slot + 1) { head[c] = next[e.slot]; next[e.slot] = 0; return; }
    while (cur !== 0) {
      const s = cur - 1;
      if (next[s] === e.slot + 1) { next[s] = next[e.slot]; next[e.slot] = 0; return; }
      cur = next[s];
    }
  }

  /** @param {number} x @param {number} y @returns {boolean} */
  function solidAt(x, y) {
    if (!inside(x, y)) return false;
    let cur = head[y * w + x];
    while (cur !== 0) {
      const e = slots[cur - 1];
      if (e.solid) return true;
      cur = next[cur - 1];
    }
    return false;
  }

  /** @param {number} x @param {number} y @returns {Entity|null} */
  function at(x, y) {
    if (!inside(x, y)) return null;
    let cur = head[y * w + x];
    let any = null;
    while (cur !== 0) {
      const e = slots[cur - 1];
      if (e.solid) return e;
      if (any === null) any = e;
      cur = next[cur - 1];
    }
    return any;
  }

  /** @param {Entity} e @returns {Entity} */
  function add(e) {
    if (byId.has(e.id)) throw new Error(`entities: duplicate id '${e.id}'`);
    if (!Number.isInteger(e.x) || !Number.isInteger(e.y)) throw new TypeError(`entities: '${e.id}' needs integer tile x, y (got ${e.x}, ${e.y})`);
    if (!inside(e.x, e.y)) throw new RangeError(`entities: '${e.id}' at ${e.x},${e.y} is outside ${w}x${h}`);
    if (e.slot !== -1) throw new Error(`entities: '${e.id}' is already managed`);
    if (freeTop === 0) throw new RangeError(`entities: table full (${capacity})`);
    e.slot = free[--freeTop];
    slots[e.slot] = e;
    byId.set(e.id, e);
    list.push(e);
    version++;
    e.moving = false; e.t = 1; e.fromX = e.x; e.fromY = e.y; e.spill = 0;
    updatePixels(e);
    link(e, e.x, e.y);
    return e;
  }

  /** @param {string} id @returns {boolean} */
  function remove(id) {
    const e = byId.get(id);
    if (!e) return false;
    unlink(e, e.x, e.y);
    slots[e.slot] = null;
    free[freeTop++] = e.slot;
    e.slot = -1;
    byId.delete(id);
    const i = list.indexOf(e);
    if (i !== -1) list.splice(i, 1);
    version++;
    return true;
  }

  /** @param {number} x @param {number} y @param {number} r @param {Entity[]} [out] */
  function near(x, y, r, out = nearBuf) {
    out.length = 0;
    const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let cur = head[cy * w + cx];
        while (cur !== 0) { out.push(slots[cur - 1]); cur = next[cur - 1]; }
      }
    }
    return out;
  }

  /** @param {Entity} e @param {Dir} dir @param {MoveCtx} ctx @returns {boolean} */
  function tryMove(e, dir, ctx) {
    const di = DIR_INDEX[dir];
    if (di === undefined) throw new TypeError(`tryMove: bad direction '${dir}'`);
    if (e.slot === -1 || slots[e.slot] !== e) throw new Error(`tryMove: '${e.id}' is not managed here`);
    e.facing = dir;
    if (e.moving) return false;
    const nx = e.x + DX[di], ny = e.y + DY[di];
    if (!inside(nx, ny)) return false;
    const passable = ctx.passable || (ctx.map && ctx.map.passable);
    if (typeof passable !== 'function') throw new TypeError('tryMove: ctx needs passable() or map.passable()');
    if (!passable(nx, ny, ctx.tideState, ctx.mover || MOVER_OF_KIND[e.kind])) return false;
    if (solidAt(nx, ny)) return false;
    unlink(e, e.x, e.y);
    e.fromX = e.x; e.fromY = e.y;
    e.x = nx; e.y = ny;
    link(e, nx, ny);
    e.t = 0;
    e.moving = true;
    if (ctx.speedMs !== undefined) e.speedMs = ctx.speedMs;
    else if (e.kind === 'player') e.speedMs = ctx.run ? RUN_MS : WALK_MS;
    else if (ctx.run) e.speedMs = RUN_MS;
    updatePixels(e);
    return true;
  }

  /** @param {Entity} e @param {number} ms @returns {'arrived'|'moving'|'idle'} */
  function tickMovement(e, ms) {
    if (!e.moving) return 'idle';
    e.t += ms / e.speedMs;
    if (e.t >= 1) {
      e.spill = (e.t - 1) * e.speedMs;
      e.t = 1;
      e.moving = false;
      e.fromX = e.x; e.fromY = e.y;
      updatePixels(e);
      return 'arrived';
    }
    updatePixels(e);
    return 'moving';
  }

  /** @param {Entity} e @param {number} x @param {number} y @param {Dir} [facing] */
  function teleport(e, x, y, facing) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) throw new TypeError(`teleport: x, y must be integer tiles (got ${x}, ${y})`);
    if (!inside(x, y)) throw new RangeError(`teleport: ${x},${y} is outside ${w}x${h}`);
    if (e.slot === -1 || slots[e.slot] !== e) throw new Error(`teleport: '${e.id}' is not managed here`);
    unlink(e, e.x, e.y);
    e.x = x; e.y = y; e.fromX = x; e.fromY = y; e.t = 1; e.moving = false; e.spill = 0;
    if (facing) e.facing = facing;
    link(e, x, y);
    updatePixels(e);
  }

  /** @param {number} ms @returns {Entity[]} */
  function tickAll(ms) {
    arrivedBuf.length = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.moving && tickMovement(e, ms) === 'arrived') arrivedBuf.push(e);
    }
    return arrivedBuf;
  }

  /** Insertion sort on the reused buffer: near-sorted every frame, so ~O(n). */
  function ySorted() {
    const n = list.length;
    if (sortedVersion !== version) {
      // Membership changed since the last sort: refill from the live list (keeps the old order's
      // benefit only when nothing changed, which is the common per-frame case).
      sortBuf.length = n;
      for (let i = 0; i < n; i++) sortBuf[i] = list[i];
      sortedVersion = version;
    }
    for (let i = 1; i < n; i++) {
      const e = sortBuf[i];
      const key = e.py + e.z;
      let j = i - 1;
      while (j >= 0 && (sortBuf[j].py + sortBuf[j].z > key || (sortBuf[j].py + sortBuf[j].z === key && sortBuf[j].slot > e.slot))) {
        sortBuf[j + 1] = sortBuf[j];
        j--;
      }
      sortBuf[j + 1] = e;
    }
    return sortBuf;
  }

  /**
   * Reconciles def-backed entities with the map's `entities` list under the current world state:
   * conditions, picked items, opened cracks and NPC placement. Dynamic entities (`def === null`,
   * e.g. the player and spawned roamers) are never touched; existing def-backed entities keep
   * their position so an NPC mid-walk is not reset.
   * @param {object} world
   * @param {object} data
   * @param {TideState} tideState
   * @param {RebuildCtx} [ctx]
   */
  function rebuildFromDefs(world, data, tideState, ctx = {}) {
    const evalCond = ctx.evalCond || dslEvalCond;
    const defs = (map.def && map.def.entities) || [];
    const defIds = new Set();
    for (let i = 0; i < defs.length; i++) defIds.add(defs[i].id);
    const mapState = world && world.maps ? world.maps[map.id] : null;
    const condCtx = { data, mapId: map.id, x: 0, y: 0 };
    const added = [], removed = [], skipped = [];
    const wanted = new Map();
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      let ok = true;
      if (def.cond != null) { condCtx.x = def.x; condCtx.y = def.y; ok = Boolean(evalCond(world, def.cond, condCtx)); }
      if (ok && def.kind === 'item' && mapState && mapState.picked && mapState.picked[def.id] != null) ok = false;
      if (ok && def.kind === 'crack' && mapState && mapState.cracks && mapState.cracks[def.id]) ok = false;
      let place = null;
      if (ok && def.kind === 'npc' && ctx.placeNpc) {
        place = ctx.placeNpc(def.id);
        if (place === null) ok = false;
      }
      if (ok) wanted.set(def.id, { def, place });
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.def === null || e.def.dynamic === true || !defIds.has(e.id)) continue;
      if (!wanted.has(e.id)) { remove(e.id); removed.push(e.id); }
    }
    for (const [id, { def, place }] of wanted) {
      const existing = byId.get(id);
      if (existing) { existing.def = def; continue; }
      const e = entityFromDef(def);
      if (place) { e.x = place.x; e.y = place.y; e.fromX = e.x; e.fromY = e.y; if (place.facing) e.facing = place.facing; }
      if (!inside(e.x, e.y) || (e.solid && solidAt(e.x, e.y)) || freeTop === 0) { skipped.push(id); continue; }
      add(e);
      added.push(id);
    }
    return { added, removed, skipped };
  }

  function clear() {
    for (let i = list.length - 1; i >= 0; i--) remove(list[i].id);
  }

  return {
    list, w, h,
    add, remove, find: (id) => byId.get(id) || null,
    at, solidAt, near, tryMove, tickMovement, tickAll, teleport, ySorted, rebuildFromDefs, clear,
  };
}

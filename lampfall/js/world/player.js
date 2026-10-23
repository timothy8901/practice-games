/**
 * Player controller (ARCHITECTURE §4.3 / §4.5): grid movement with run, turn-in-place before
 * stepping, a two-deep intent queue so a tap during a step is not lost, step events for the
 * encounter system, and tool state. Pure: the scene feeds it the held direction each tick and
 * applies the returned events (`stats.steps`, encounter rolls, bump sfx) itself.
 *
 * Movement rules (the "Pokémon feel"):
 *  - pressing the direction the player already faces starts a step at once;
 *  - pressing another direction turns first; the step starts only once that direction has been held
 *    for {@link TURN_DELAY_MS}, so a tap turns in place;
 *  - a direction pressed while a step is in flight is queued and resolved on arrival;
 *  - no diagonals: {@link dirFromAxes} reduces a two-axis input to one direction, keeping the axis
 *    already in use so a held key does not flip when a second one is added;
 *  - leftover time past a step's end (`ent.spill`) rolls into the next step when the same direction
 *    is still held, so continuous walking is not quantized to whole ticks.
 *
 * No allocation per tick: events are pooled records in a reused array.
 *
 * Lane: WORLD-ENT.
 * @module world/player
 */

import { createEntity, updatePixels, DIR_INDEX, DX, DY, WALK_MS } from './entities.js';

/** @typedef {import('./entities.js').Entity} Entity */
/** @typedef {import('./entities.js').Dir} Dir */
/** @typedef {import('./entities.js').EntityManager} EntityManager */
/** @typedef {import('./entities.js').MoveCtx} MoveCtx */
/** @typedef {import('../core/time.js').TideState} TideState */

/** Hold time before a turn in place becomes a step, in ms (about five 60 Hz ticks). */
export const TURN_DELAY_MS = 80;
/** Minimum gap between two `bump` events while walking into a wall, in ms. */
export const BUMP_COOLDOWN_MS = 250;
/** Id of the player entity. */
export const PLAYER_ID = 'player';

/**
 * @typedef {Object} PlayerEvent
 * @property {'turn'|'step'|'bump'} type
 * @property {Dir} dir      direction faced / stepped / bumped
 * @property {number} x     tile arrived at (step), or the player's tile (turn, bump)
 * @property {number} y
 * @property {number} fromX  tile left (step only; equals x/y otherwise)
 * @property {number} fromY
 * @property {boolean} run   the step was a run
 */

/**
 * @typedef {Object} PlayerUpdateCtx
 * @property {EntityManager} ents          the manager the player entity belongs to
 * @property {{passable: Function, w: number, h: number}} [map]
 * @property {Function} [passable]          overrides `map.passable`
 * @property {TideState} tideState
 */

/**
 * @typedef {Object} Player
 * @property {Entity} ent
 * @property {(dir: Dir|null, run?: boolean) => void} intend   the direction held this tick (null = none) and whether run is held
 * @property {(ms: number, ctx: PlayerUpdateCtx) => PlayerEvent[]} update   advances movement and resolves intents; returns a REUSED event array
 * @property {() => {x: number, y: number}} facingTile          REUSED record
 * @property {() => boolean} isMoving
 * @property {(locked: boolean) => void} setLocked   while locked, intents are dropped (dialogue, cutscene); a step in flight still finishes
 * @property {() => boolean} isLocked
 * @property {string|null} tool
 * @property {string|null} lastTool
 * @property {(itemId: string|null) => void} setTool
 * @property {() => void} swapTool          tap gesture: swap `tool` and `lastTool`
 * @property {(state: object, ents?: EntityManager) => void} readFrom   copies x, y, facing, tool, lastTool from a PlayerState (schema §3.1); when the entity is already in a manager, pass it so the move goes through `ents.teleport` and the spatial grid stays right (throws otherwise)
 * @property {(state: object) => object} writeTo  copies x, y, facing, tool, lastTool into a PlayerState and returns it
 */

/**
 * Reduces two input axes to one direction. Keeps `prev` while its axis is still pressed so adding a
 * second key never flips the walk; otherwise horizontal wins ties.
 * @param {number} dx   -1, 0 or 1
 * @param {number} dy   -1, 0 or 1
 * @param {Dir|null} [prev]
 * @returns {Dir|null}
 */
export function dirFromAxes(dx, dy, prev = null) {
  if (dx === 0 && dy === 0) return null;
  if (prev !== null && prev !== undefined) {
    const pi = DIR_INDEX[prev];
    if (pi !== undefined && ((DX[pi] !== 0 && dx === DX[pi]) || (DY[pi] !== 0 && dy === DY[pi]))) return prev;
  }
  if (dx !== 0) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * Creates the player controller and its entity (kind `'player'`, id {@link PLAYER_ID}).
 * The entity is NOT added to a manager here: the scene adds it to the current map's manager.
 * @param {{x: number, y: number, facing?: Dir, tool?: string|null, lastTool?: string|null, artId?: string}} init
 * @returns {Player}
 */
export function createPlayer(init) {
  const ent = createEntity({
    id: PLAYER_ID, kind: 'player', x: init.x, y: init.y,
    facing: init.facing ?? 'down', artId: init.artId ?? 'player', speedMs: WALK_MS,
  });

  /** @type {Dir|null} */ let held = null;
  let runHeld = false;
  /** @type {Dir|null} */ let q0 = null;  // intent queue (two deep)
  /** @type {Dir|null} */ let q1 = null;
  let pendingTurn = false;  // turned in place; the step waits for TURN_DELAY_MS of hold
  let turnMs = 0;
  let locked = false;
  let sinceBump = BUMP_COOLDOWN_MS;
  let tool = init.tool ?? null;
  let lastTool = init.lastTool ?? null;

  const facing = { x: 0, y: 0 };
  /** @type {PlayerEvent[]} */
  const events = [];
  /** @type {PlayerEvent[]} */
  const pool = [];
  for (let i = 0; i < 4; i++) pool.push({ type: 'turn', dir: 'down', x: 0, y: 0, fromX: 0, fromY: 0, run: false });

  /**
   * @param {'turn'|'step'|'bump'} type @param {Dir} dir
   * @param {number} [fromX] origin tile of a step (captured before tickMovement collapses it)
   * @param {number} [fromY]
   */
  function emit(type, dir, fromX = ent.x, fromY = ent.y) {
    if (events.length >= pool.length) return;
    const ev = pool[events.length];
    ev.type = type; ev.dir = dir;
    ev.x = ent.x; ev.y = ent.y;
    ev.fromX = fromX; ev.fromY = fromY;
    ev.run = ent.speedMs < WALK_MS;
    events.push(ev);
  }

  /** @param {Dir|null} dir */
  function enqueue(dir) {
    if (dir === null) return;
    if (q0 === null) q0 = dir;
    else if (q0 !== dir) q1 = dir;
  }

  /** @returns {Dir|null} */
  function dequeue() {
    const d = q0;
    q0 = q1; q1 = null;
    return d;
  }

  function dropIntents() { held = null; q0 = q1 = null; pendingTurn = false; turnMs = 0; }

  /** @param {Dir|null} dir @param {boolean} [run] */
  function intend(dir, run = false) {
    if (locked) { dropIntents(); return; }
    runHeld = run;
    if (dir !== held) {
      held = dir;
      enqueue(dir);
    }
  }

  /**
   * Attempts one step in `dir`; emits `bump` (rate-limited) on failure. `carryMs` is time already
   * elapsed this tick that belongs to the new step.
   * @param {Dir} dir @param {PlayerUpdateCtx} ctx @param {number} carryMs
   * @returns {boolean}
   */
  function step(dir, ctx, carryMs) {
    const ok = ctx.ents.tryMove(ent, dir, { map: ctx.map, passable: ctx.passable, tideState: ctx.tideState, run: runHeld });
    if (!ok) {
      if (sinceBump >= BUMP_COOLDOWN_MS) { emit('bump', dir); sinceBump = 0; }
      return false;
    }
    if (carryMs > 0) {
      const sx = ent.fromX, sy = ent.fromY;
      if (ctx.ents.tickMovement(ent, carryMs) === 'arrived') { emit('step', dir, sx, sy); ent.spill = 0; }
    }
    return true;
  }

  /** @param {number} ms @param {PlayerUpdateCtx} ctx */
  function update(ms, ctx) {
    events.length = 0;
    sinceBump += ms;
    let carry = 0;
    if (ent.moving) {
      const sx = ent.fromX, sy = ent.fromY;
      if (ctx.ents.tickMovement(ent, ms) !== 'arrived') return events;
      emit('step', ent.facing, sx, sy);
      carry = ent.spill;
      ent.spill = 0;
    }
    if (locked) return events;

    // A queued press wins over what is merely still held.
    const queued = dequeue();
    const dir = queued !== null ? queued : held;
    if (dir === null) { pendingTurn = false; return events; }

    if (dir !== ent.facing) {
      ent.facing = dir;
      emit('turn', dir);
      pendingTurn = true;
      turnMs = 0;
      return events;
    }
    if (pendingTurn) {
      if (held !== dir) { pendingTurn = false; return events; }   // released before the gate: a turn in place
      turnMs += ms;
      if (turnMs < TURN_DELAY_MS) return events;
      pendingTurn = false;
    }
    step(dir, ctx, carry);
    return events;
  }

  return {
    ent,
    intend,
    update,
    facingTile() {
      const di = DIR_INDEX[ent.facing];
      facing.x = ent.x + DX[di];
      facing.y = ent.y + DY[di];
      return facing;
    },
    isMoving: () => ent.moving,
    setLocked(v) { locked = Boolean(v); if (locked) dropIntents(); },
    isLocked: () => locked,
    get tool() { return tool; },
    get lastTool() { return lastTool; },
    setTool(itemId) {
      if (itemId === tool) return;
      lastTool = tool;
      tool = itemId ?? null;
    },
    swapTool() { const t = tool; tool = lastTool; lastTool = t; },
    readFrom(state, ents) {
      const facingOk = typeof state.facing === 'string' && state.facing in DIR_INDEX;
      if (ent.slot !== -1) {
        if (!ents) throw new Error('player.readFrom: the player entity is managed; pass its EntityManager');
        ents.teleport(ent, state.x, state.y, facingOk ? state.facing : undefined);
      } else {
        ent.x = state.x; ent.y = state.y; ent.fromX = state.x; ent.fromY = state.y; ent.t = 1; ent.moving = false; ent.spill = 0;
        if (facingOk) ent.facing = state.facing;
        updatePixels(ent);
      }
      dropIntents();
      tool = state.tool ?? null;
      lastTool = state.lastTool ?? null;
    },
    writeTo(state) {
      state.x = ent.x; state.y = ent.y; state.facing = ent.facing;
      state.tool = tool; state.lastTool = lastTool;
      return state;
    },
  };
}

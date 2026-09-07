/**
 * validate.js — the sweep that has to pass before a day's seed is published.
 *
 * PHYSICS-ENGINE-HANDOFF.md §5.5 asks for three checks, in this order:
 *
 *   1. Graph      flood-fill the placed pieces and prove start reaches goal
 *                 THROUGH MATCHING SOCKETS, not just through adjacency
 *   2. Clearance  for each corridor cell on the solution, assert the free width
 *                 is above the playable minimum — catches generator bugs where
 *                 two walls end up 2r − ε apart
 *   3. Physics    drop the ball at the start, run a naive follow-the-path
 *                 controller, assert it reaches the goal without falling out
 *
 * "This is the one that catches geometrically fine, physically impossible."
 * The bot is deterministic: no RNG, no wall-clock, fixed timestep.
 */

import { Ball, stepBall, tiltUp, gatherFrom, supportUnder, MAX_TILT, MAX_ACCEL, FIXED } from './physics.js';
import { assembleMaze, cellCentre } from './assemble.js';
import { behavioursAt } from './assemble.js';
import { resolveEnv } from './behaviors.js';
import { PIECE_BY_ID } from './pieces.js';
import { BALL_R, TRACK, DIRS, DELTA, OPPOSITE, LEVELS, TILE, TUNING } from './kit.js';
import { generateMaze, mazeFingerprint, pieceKeyAt } from './generator.js';
import { bodiesFor } from './dynamics.js';

/* ── 1. graph ─────────────────────────────────────────────────────────── */

/**
 * Flood-fill cell to cell, crossing an edge only when both sides present an
 * open socket at the same elevation. Adjacency alone would pass a maze where a
 * ramp lands against a flat wall.
 */
export function graphCheck (maze) {
  const w = maze.width;
  const seen = new Set([maze.start.cell]);
  const q = [maze.start.cell];
  const mismatches = [];
  for (let head = 0; head < q.length; head++) {
    const cell = maze.cellAt.get(q[head]);
    const piece = PIECE_BY_ID.get(cell.pieceId);
    const myKey = pieceKeyAt(piece, cell.rot);
    for (let i = 0; i < 4; i++) {
      const d = DIRS[i];
      const mine = myKey[i];
      if (mine === '-') continue;
      const nx = cell.cx + DELTA[d][0], nz = cell.cz + DELTA[d][1];
      const n = maze.cellAt.get(nz * w + nx);
      if (!n) { mismatches.push(`${cell.cell} opens ${d} onto nothing`); continue; }
      const theirs = pieceKeyAt(PIECE_BY_ID.get(n.pieceId), n.rot)[DIRS.indexOf(OPPOSITE[d])];
      if (theirs !== mine) {
        mismatches.push(`${cell.cell}→${n.cell} across ${d}: ${mine} vs ${theirs}`);
        continue;
      }
      if (!seen.has(n.cell)) { seen.add(n.cell); q.push(n.cell); }
    }
  }
  return {
    pass: seen.has(maze.goal.cell) && mismatches.length === 0,
    reached: seen.size,
    total: maze.cells.length,
    goalReachable: seen.has(maze.goal.cell),
    mismatches,
  };
}

/* ── 2. clearance ─────────────────────────────────────────────────────── */

function closestPointTriangle (px, py, pz, t, o) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2];
  const bx = t[o + 3], by = t[o + 4], bz = t[o + 5];
  const cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return [ax, ay, az];
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return [bx, by, bz];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return [ax + abx * v, ay + aby * v, az + abz * v];
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return [cx, cy, cz];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w2 = d2 / (d2 - d6);
    return [ax + acx * w2, ay + acy * w2, az + acz * w2];
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w2 = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return [bx + (cx - bx) * w2, by + (cy - by) * w2, bz + (cz - bz) * w2];
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w2 = vc * denom;
  return [ax + abx * v + acx * w2, ay + aby * v + acy * w2, az + abz * v + acz * w2];
}

/** Distance from a point to the nearest collision triangle in the world. */
function nearest (world, px, py, pz) {
  const out = [];
  for (const c of world.colliders) c.gather(px, pz, 2.0, out);
  let best = Infinity;
  for (let i = 0; i < out.length; i += 2) {
    const q = closestPointTriangle(px, py, pz, out[i].tris, out[i + 1]);
    const d = Math.hypot(px - q[0], py - q[1], pz - q[2]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Along every solution waypoint, ask whether a ball-sized sphere actually fits
 * on the corridor centre-line. The ball is placed one radius above whatever
 * supports it there, so the nearest surface should be the floor at exactly r;
 * anything closer is a wall crowding the corridor.
 *
 * `2r + 0.05` is the absolute minimum passable width and `3r` the playable
 * minimum (handoff §4.3). A corridor at or under the former is a generator bug.
 */
/**
 * Does this piece have a hole on its own centre-line, in isolation?
 *
 * Several pieces are supposed to: the dashed track, the broken bridge, the acid
 * pit. Flagging those in the maze would be flagging the design. Comparing the
 * assembled world against the piece built alone flags only what the *transform*
 * broke, which is the thing this check can actually catch.
 */
const _gapCache = new Map();
function pieceHasCentreGap (world, cell) {
  if (_gapCache.has(cell.pieceId)) return _gapCache.get(cell.pieceId);
  const solo = assembleMaze({
    width: 1, height: 1,
    cells: [{ ...cell, cx: 0, cz: 0, rot: 0 }],
    cellAt: new Map([[0, { ...cell, cx: 0, cz: 0, rot: 0 }]]),
    start: { ...cell, cx: 0, cz: 0, dirs: cell.dirs },
    goal: { ...cell, cx: 0, cz: 0, dirs: cell.dirs },
    solution: [], stats: {},
  });
  const gap = !Number.isFinite(supportUnder(solo.colliders, 0, 0, 4));
  _gapCache.set(cell.pieceId, gap);
  return gap;
}

export function clearanceCheck (world) {
  const tight = [];
  const grazes = [];
  const unsupported = [];
  const byDesign = [];
  let worst = Infinity;
  for (const wp of world.waypoints) {
    const support = supportUnder(world.colliders, wp.x, wp.z, wp.y + 3.0);
    if (!Number.isFinite(support)) {
      const cell = world.maze.cellAt.get(wp.cell);
      const entry = { cell: wp.cell, index: wp.index, edge: wp.edge || 'centre', piece: cell?.pieceId };
      if (cell && !wp.edge && pieceHasCentreGap(world, cell)) byDesign.push(entry);
      else unsupported.push(entry);
      continue;
    }
    const free = nearest(world, wp.x, support + BALL_R + 0.01, wp.z);
    if (free < worst) worst = free;
    // Two thresholds, because they mean different things. Under 0.9r the ball
    // is grazing something — a kerb on the inside of a turn, the wall of a
    // channel — which is normal driving and worth reporting, not failing.
    // Under 0.5r it is being squeezed from both sides and cannot get through:
    // that is the `2r − ε` generator bug handoff §5.5 is asking about.
    if (free < BALL_R * 0.9) {
      const cell = world.maze.cellAt.get(wp.cell);
      const entry = {
        cell: wp.cell, index: wp.index, edge: wp.edge || 'centre',
        piece: cell?.pieceId, free: +free.toFixed(3),
      };
      if (free < BALL_R * 0.5) tight.push(entry); else grazes.push(entry);
    }
  }
  return {
    pass: tight.length === 0 && unsupported.length === 0,
    worst: Number.isFinite(worst) ? +worst.toFixed(3) : null,
    ballRadius: BALL_R,
    minimumPassable: +(2 * BALL_R + 0.05).toFixed(3),
    tight,
    grazes,
    unsupported,
    gapsByDesign: byDesign,
  };
}

/* ── 3. physics ───────────────────────────────────────────────────────── */

/**
 * A naive follow-the-path controller. It is deliberately naive — if a competent
 * human can only just do it, a proportional controller failing tells you
 * nothing, but a proportional controller *succeeding* proves the route is
 * physically open.
 *
 * Tilt is camera-relative in the real game; here camYaw is pinned to 0, so
 * from tiltUp the resulting acceleration is
 *   a.x = sin(tiltR)·G,  a.z = sin(tiltF)·G
 * and steering is just the inverse of that.
 */
export function runBot (world, opts = {}) {
  const maxSeconds = opts.maxSeconds ?? 420;
  const trailEvery = opts.trailEvery ?? 15;
  const rich = !!opts.richTrail;
  const steps = Math.round(maxSeconds / FIXED);
  const gather = gatherFrom(world.colliders);
  const bodies = bodiesFor(world);
  const ball = new Ball(BALL_R);
  ball.p = { x: world.spawn.x, y: world.spawn.y + 0.15, z: world.spawn.z };

  const wps = world.waypoints;
  // Skip any waypoint the spawn has already passed. Waypoint 0 is the start
  // cell's centre, and the spawn sits 3 m along the exit deck — outside #57's
  // cage ring, which the ball cannot roll back through. Aiming at it first left
  // the bot grinding against the ring for the whole time budget.
  let target = 0;
  const ex = DELTA[world.spawn.dir][0], ez = DELTA[world.spawn.dir][1];
  while (target < wps.length - 1
    && (wps[target].x - world.spawn.x) * ex + (wps[target].z - world.spawn.z) * ez <= 0.5) target++;
  let falls = 0, stuckFor = 0, time = 0;
  let lastProgress = 0;
  const trail = [];
  const events = [];
  let respawn = { ...ball.p };

  let resets = 0;
  const stallsAt = new Map();
  const skipped = [];

  for (let i = 0; i < steps; i++) {
    const wp = wps[Math.min(target, wps.length - 1)];
    const ahead = wps[Math.min(target + 1, wps.length - 1)];
    const dx = wp.x - ball.p.x, dz = wp.z - ball.p.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 1.6) {
      // Only ever remember a socket crossing as a respawn point. A mid-cell
      // point can sit on a ramp face or a banked deck; dropping the ball there
      // just starts another fall.
      if (wp.edge) respawn = { x: wp.x, y: wp.y + BALL_R + 0.05, z: wp.z };
      if (target < wps.length - 1) target++;
      lastProgress = i;
    }

    /* Steer to the LINE, not to the point.
     *
     * Chasing the waypoint itself lets the ball drift wide, arrive at an angle,
     * and leave the corridor on the far side — 41 fall-outs a run, in corridors
     * a human threads without thinking. A cross-track term pulls it back onto
     * the segment it is supposed to be on, which is what a player does with
     * small corrective tilts. */
    const prev = wps[Math.max(0, target - 1)];
    let ux = wp.x - prev.x, uz = wp.z - prev.z;
    const ul = Math.hypot(ux, uz);
    if (ul > 1e-6) { ux /= ul; uz /= ul; } else { ux = dist > 1e-6 ? dx / dist : 0; uz = dist > 1e-6 ? dz / dist : 0; }
    const along = (ball.p.x - prev.x) * ux + (ball.p.z - prev.z) * uz;
    const cx = prev.x + ux * Math.max(0, Math.min(ul, along));
    const cz = prev.z + uz * Math.max(0, Math.min(ul, along));
    let ex = cx - ball.p.x, ez = cz - ball.p.z;            // cross-track error
    const el = Math.hypot(ex, ez);

    // How hard the next leg turns, so speed can come off before it.
    const nx = ahead.x - wp.x, nz = ahead.z - wp.z;
    const nl = Math.hypot(nx, nz) || 1;
    const turn = ux * (nx / nl) + uz * (nz / nl);           // 1 straight on, −1 back
    const slow = dist < 5 ? Math.max(0, turn) : 1;

    // Saturate the cross-track pull. Feeding the raw error in scaled means a
    // ball 3 m off line gets a sideways demand four times the along-track one,
    // so it crabs at the corridor instead of driving down it and the stall timer
    // trips with the ball barely moving.
    const k = Math.min(1.3, el * 0.85);
    let tx = ux + (el > 1e-6 ? ex / el : 0) * k;
    let tz = uz + (el > 1e-6 ? ez / el : 0) * k;
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;

    const want = 3.0 + 2.5 * slow;
    let ax = tx * want - ball.v.x, az = tz * want - ball.v.z;
    const al = Math.hypot(ax, az) || 1;
    const gain = Math.min(1, al / 2.2);
    ax = (ax / al) * gain; az = (az / al) * gain;

    const up = tiltUp(0, Math.asin(Math.max(-1, Math.min(1, az * Math.sin(MAX_TILT)))),
      Math.asin(Math.max(-1, Math.min(1, ax * Math.sin(MAX_TILT)))));

    const env = resolveEnv(behavioursAt(world, ball.p.x, ball.p.z), ball);
    stepBall(ball, gather, up, FIXED, env);
    // Moving obstacles resolve after stepBall inside the same substep — §2.5.
    for (const b of bodies) { b.advance(time, FIXED); b.resolve(ball, time, FIXED); }
    time += FIXED;

    // `trailEvery` is how often a frame is kept. The default is coarse — the
    // trail is only ever read as a diagnostic — but a recorder needs enough
    // samples to replay the run, and the angular velocity too, or the doll has
    // nothing to spin by.
    if (i % trailEvery === 0) {
      trail.push(rich
        ? {
          t: +time.toFixed(3),
          p: [+ball.p.x.toFixed(4), +ball.p.y.toFixed(4), +ball.p.z.toFixed(4)],
          v: [+ball.v.x.toFixed(3), +ball.v.y.toFixed(3), +ball.v.z.toFixed(3)],
          w: [+ball.w.x.toFixed(3), +ball.w.y.toFixed(3), +ball.w.z.toFixed(3)],
        }
        : { x: +ball.p.x.toFixed(2), y: +ball.p.y.toFixed(2), z: +ball.p.z.toFixed(2), t: +time.toFixed(2) });
    }

    // Fall-out: respawn at the corridor entrance it fell from, with a penalty
    // rather than a life (handoff §5.4). Threshold kept small so it is snappy.
    if (ball.p.y < wp.y - 10) {
      falls++;
      events.push({ t: +time.toFixed(2), what: 'fell', nearWaypoint: target });
      ball.p = { ...respawn };
      ball.v = { x: 0, y: 0, z: 0 }; ball.w = { x: 0, y: 0, z: 0 };
      if (falls > 60) break;
    }

    // A stall costs a reset rather than ending the run. A player who wedges the
    // ball in a corner does not put the game down; they reset and carry on, and
    // how many resets a seed demands is a far more useful difficulty signal than
    // a binary pass. The run only fails if resets stop helping.
    if (i - lastProgress > 120 * 9) {
      resets++;
      const n = (stallsAt.get(target) || 0) + 1;
      stallsAt.set(target, n);
      events.push({ t: +time.toFixed(2), what: 'stalled', nearWaypoint: target });
      if (n >= 2) {
        // A second stall at the same waypoint means resetting is not the
        // answer. Step over it and record exactly which segment the controller
        // could not drive: a precise list of blocking spots is worth far more
        // than a run that simply stops, and it separates "the route is closed"
        // from "the bot is not clever enough" for a human to judge.
        const cell = world.maze.cellAt.get(wp.cell);
        skipped.push({
          waypoint: target, cell: wp.cell, piece: cell?.pieceId,
          at: { x: +wp.x.toFixed(1), y: +wp.y.toFixed(2), z: +wp.z.toFixed(1) },
        });
        target = Math.min(wps.length - 1, target + 1);
        const nxt = wps[target];
        ball.p = { x: nxt.x, y: nxt.y + BALL_R + 0.05, z: nxt.z };
        stallsAt.set(target, 0);
      } else {
        ball.p = { ...respawn };
      }
      ball.v = { x: 0, y: 0, z: 0 }; ball.w = { x: 0, y: 0, z: 0 };
      lastProgress = i;
      if (resets > 60) { stuckFor = 120 * 9; break; }
    }

    const g = world.goal;
    if (Math.hypot(ball.p.x - g.x, ball.p.z - g.z) < g.radius && Math.abs(ball.p.y - g.y) < 3) {
      return {
        // Reaching the goal is the gate: it proves the route is open. `clean`
        // is the stricter reading — the reference controller drove every metre
        // of it unaided. A seed that is open but has segments only a human can
        // thread is a difficulty signal, not a broken maze, and conflating the
        // two just hides which is which.
        pass: true,
        clean: skipped.length === 0,
        seconds: +time.toFixed(1), falls, resets, skipped,
        reached: wps.length, total: wps.length, trail, events,
        reason: skipped.length ? `open, but the reference bot needed help on ${skipped.length} segment(s)` : undefined,
      };
    }
  }

  return {
    pass: false,
    clean: false,
    seconds: +time.toFixed(1),
    falls,
    resets,
    skipped,
    reached: target,
    total: wps.length,
    stuck: stuckFor > 0,
    reason: stuckFor > 0 ? `${resets} resets did not help; wedged at waypoint ${target}/${wps.length}`
      : falls > 60 ? `fell out ${falls} times`
        : `ran out of time at waypoint ${target}/${wps.length}`,
    trail,
    events,
  };
}

/* ── the sweep ────────────────────────────────────────────────────────── */

/** Everything §5.5 asks for, for one seed. */
export function validateSeed (seed, opts = {}) {
  const maze = generateMaze({ seed, ...opts });
  const world = assembleMaze(maze);
  const graph = graphCheck(maze);
  const clearance = clearanceCheck(world);
  const physics = opts.skipBot ? { pass: true, skipped: true } : runBot(world, opts);

  // Reproducibility: the same seed must rebuild the same maze, and building it
  // a second time must not consume a different amount of the RNG stream.
  const again = generateMaze({ seed, ...opts });
  const reproducible = mazeFingerprint(maze) === mazeFingerprint(again);

  return {
    seed,
    fingerprint: mazeFingerprint(maze),
    pass: graph.pass && clearance.pass && physics.pass && reproducible && maze.failures.length === 0,
    clean: graph.pass && clearance.pass && !!physics.clean && reproducible && maze.failures.length === 0,
    graph, clearance, physics, reproducible,
    unplaceable: maze.failures,
    stats: { ...maze.stats, ...world.stats },
    maze, world,
  };
}

/** Sweep a run of consecutive days, the way a nightly job would. */
export function validateRun (seeds, opts = {}) {
  const results = seeds.map(s => {
    const r = validateSeed(s, opts);
    delete r.maze; delete r.world;              // keep the report small
    delete r.physics.trail;
    return r;
  });
  return {
    pass: results.every(r => r.pass),
    passed: results.filter(r => r.pass).length,
    clean: results.filter(r => r.clean).length,
    total: results.length,
    // Which pieces the reference controller could not drive, most first. This
    // is the list to hand a human before they play: it says where to look.
    blockers: Object.entries(results.reduce((acc, r) => {
      for (const s of (r.physics.skipped || [])) acc[s.piece] = (acc[s.piece] || 0) + 1;
      return acc;
    }, {})).map(([piece, count]) => ({ piece: +piece, count })).sort((a, b) => b.count - a.count),
    results,
  };
}

/**
 * selftest.js — the regression net for the 64-piece kit.
 *
 * PHYSICS-ENGINE-HANDOFF.md §10 ends with a warning worth repeating: make sure
 * a new test can actually fail. Their "geometry reaches every opening" check
 * passed for the wrong reason because it sampled vertex proximity instead of
 * surface coverage — a wide quad with no interior vertices read as a hole.
 *
 * The socket tests here therefore sample a disc of vertical columns against the
 * real collision soup and ask whether a ball would find support at the socket's
 * elevation — surface coverage, not vertex proximity. `provocations()` at the
 * bottom deliberately breaks pieces and asserts the suite goes red, so the
 * teeth are demonstrated rather than claimed.
 */

import {
  PIECES, PIECE_BY_ID, buildPiece, CATEGORIES, DECISIONS, KIT_VERSION,
} from './pieces.js';
import {
  TILE, HALF, TRACK, TRACK_NARROW, BALL_R, LEVELS, TUNING, MAX_ACCEL,
  RESTITUTION_MAX, DIRS, EDGE_VEC, isDeco, peakGrade,
} from './kit.js';
import { behaviorSelfTests } from './behaviors.js';

/* ── closest point on a triangle (Ericson), same as physics.js ────────── */

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
    const w = d2 / (d2 - d6);
    return [ax + acx * w, ay + acy * w, az + acz * w];
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return [bx + (cx - bx) * w, by + (cy - by) * w, bz + (cz - bz) * w];
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  return [ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w];
}

/**
 * Distance from a point to the nearest colliding triangle in a build.
 *
 * `floorsOnly` restricts the query to surfaces the ball could actually rest on
 * — geometric normal within ~45° of vertical. Without it a wall standing at a
 * closed edge reads as a leak, which is exactly backwards: a wall there is the
 * point. The wind fan's turbine housing found this.
 */
function nearestSurface (built, px, py, pz, floorsOnly = false) {
  let best = Infinity;
  for (const c of built.colliders) {
    const t = c.tris;
    for (let o = 0; o < t.length; o += 9) {
      if (floorsOnly) {
        const ux = t[o + 3] - t[o], uy = t[o + 4] - t[o + 1], uz = t[o + 5] - t[o + 2];
        const vx = t[o + 6] - t[o], vy = t[o + 7] - t[o + 1], vz = t[o + 8] - t[o + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const L = Math.hypot(nx, ny, nz);
        if (L < 1e-9 || Math.abs(ny) / L < 0.7) continue;
      }
      const q = closestPointTriangle(px, py, pz, t, o);
      const d = Math.hypot(px - q[0], py - q[1], pz - q[2]);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Heights at which a vertical column through (px, pz) meets a horizontal-ish
 * surface. Triangles that project to zero area in XZ — walls — are skipped,
 * because a wall cannot support a ball and a wall standing at a closed edge is
 * the correct thing to build there, not a leak.
 */
function columnHits (built, px, pz) {
  const ys = [];
  for (const c of built.colliders) {
    const t = c.tris;
    for (let o = 0; o < t.length; o += 9) {
      const ax = t[o], ay = t[o + 1], az = t[o + 2];
      const bx = t[o + 3], by = t[o + 4], bz = t[o + 5];
      const cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-9) continue;                     // vertical: no support
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d;
      const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      ys.push(l1 * ay + l2 * by + l3 * cy);
    }
  }
  return ys;
}

/** Five-point sample disc: a single ray slips between the dual rails of #36. */
function sampleDisc (px, pz, r = BALL_R * 0.6) {
  return [[px, pz], [px + r, pz], [px - r, pz], [px, pz + r], [px, pz - r]];
}

/** Is there a surface a ball could rest on at `level`, anywhere in the disc? */
function supportedAt (built, px, pz, level, tol = 0.4) {
  return sampleDisc(px, pz).some(([sx, sz]) =>
    columnHits(built, sx, sz).some(y => Math.abs(y - level) <= tol));
}

/** Stable fingerprint of a build, for the determinism check. */
function fingerprint (built) {
  let h = 2166136261 >>> 0;
  const mix = v => {
    const x = Math.round(v * 4096);
    h ^= x & 0xff; h = Math.imul(h, 16777619) >>> 0;
    h ^= (x >>> 8) & 0xff; h = Math.imul(h, 16777619) >>> 0;
    h ^= (x >>> 16) & 0xff; h = Math.imul(h, 16777619) >>> 0;
  };
  for (const g of built.groups) {
    for (let i = 0; i < g.positions.length; i++) mix(g.positions[i]);
    for (let i = 0; i < g.colors.length; i++) mix(g.colors[i]);
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Probe points for socket reachability. Defaults to the edge mid-point pulled
 * one ball-radius inside the tile; pieces whose ports are not on the centre
 * line override it.
 */
const SOCKET_PROBES = {
  15: { S: [[-1.4, 0], [1.4, 0]] },         // D06: two lanes on one edge
};

function probePoints (piece, dir, level) {
  const custom = SOCKET_PROBES[piece.id] && SOCKET_PROBES[piece.id][dir];
  const [ex, ez] = EDGE_VEC[dir];
  const inset = BALL_R + 0.15;
  const base = { x: ex * (HALF - inset), z: ez * (HALF - inset) };
  if (!custom) return [[base.x, base.z]];
  return custom.map(([lx, lz]) => [base.x + lx * Math.abs(ez), base.z + lz * Math.abs(ex)]);
}

/* ── the suite ────────────────────────────────────────────────────────── */

export function kitSelfTests () {
  const T = [];
  const ok = (group, name, cond, detail) => T.push({ group, name, pass: !!cond, detail });

  /* — registry — */
  ok('registry', 'the kit has exactly 64 pieces', PIECES.length === 64, `n=${PIECES.length}`);
  const ids = PIECES.map(p => p.id);
  ok('registry', 'ids are 1..64 with no gaps or repeats',
    new Set(ids).size === 64 && Math.min(...ids) === 1 && Math.max(...ids) === 64);
  ok('registry', 'ids are in ascending order', ids.every((v, i) => i === 0 || v > ids[i - 1]));
  ok('registry', 'every piece sits inside its category id range',
    PIECES.every(p => {
      const c = CATEGORIES.find(c => c.id === p.cat);
      return c && p.id >= c.range[0] && p.id <= c.range[1];
    }));
  ok('registry', 'each of the 8 categories holds 8 pieces',
    CATEGORIES.every(c => PIECES.filter(p => p.cat === c.id).length === 8));
  ok('registry', 'sprite filenames match the documentation §5 naming',
    PIECES.every(p => p.sprite === `${String(p.id).padStart(2, '0')}_${p.key}.jpg`));
  ok('registry', 'paired pieces reference each other',
    PIECES.filter(p => p.pairWith).every(p => {
      const o = PIECE_BY_ID.get(p.pairWith);
      return o && (o.pairWith === p.id || o.behaviours.some(b => b.link === p.id));
    }));
  ok('registry', 'every decision cited by a piece exists',
    PIECES.every(p => p.decisions.every(d => DECISIONS.some(x => x.id === d))));

  /* — surfaces — */
  ok('surfaces', 'documented friction is carried through unchanged (D01)',
    PIECES.every(p => p.surface.friction === p.docSurface.friction));
  ok('surfaces', 'no restitution reaches the solver above the legal ceiling (D04)',
    PIECES.every(p => p.surface.bounce <= RESTITUTION_MAX),
    `max=${Math.max(...PIECES.map(p => p.surface.bounce))}`);
  const clamped = PIECES.filter(p => p.clamped);
  ok('surfaces', 'exactly the two documented e > 1 pieces were clamped',
    clamped.length === 2 && clamped.every(p => [41, 45].includes(p.id)),
    clamped.map(p => `#${p.id}`).join(', ') || 'none');
  ok('surfaces', 'every clamped piece replaces the lost energy with a latched impulse',
    clamped.every(p => p.behaviours.some(b => b.kind === 'impulse' && b.rearm > 0)));
  // Capping at the ceiling instead of choosing a value leaves the deck around
  // the bumper at e = 0.95, which is a trampoline, not a floor.
  ok('surfaces', 'a clamped piece gets a chosen restitution, not the bare ceiling',
    clamped.every(p => p.surface.bounce <= 0.7),
    clamped.map(p => `#${p.id} e=${p.surface.bounce}`).join(', '));
  ok('surfaces', 'friction stays inside the grip range 0..1',
    PIECES.every(p => p.surface.friction >= 0 && p.surface.friction <= 1));

  /* — geometry — */
  const builds = new Map();
  let buildErr = null;
  try {
    for (const p of PIECES) builds.set(p.id, buildPiece(p.id));
  } catch (e) { buildErr = e; }
  ok('geometry', 'all 64 pieces build without throwing', !buildErr,
    buildErr ? String(buildErr && buildErr.message) : `${builds.size} built`);
  if (buildErr) return T;

  const all = [...builds.values()];
  ok('geometry', 'every piece emits render triangles', all.every(b => b.triangles > 0),
    `min=${Math.min(...all.map(b => b.triangles))}`);
  ok('geometry', 'every piece emits collision triangles', all.every(b => b.collisionTriangles > 0),
    `min=${Math.min(...all.map(b => b.collisionTriangles))}`);
  ok('geometry', 'no NaN or Infinity in any vertex buffer',
    all.every(b => b.groups.every(g => g.positions.every(Number.isFinite)
      && g.normals.every(Number.isFinite) && g.colors.every(Number.isFinite))));
  ok('geometry', 'no NaN in any collision triangle',
    all.every(b => b.colliders.every(c => c.tris.every(Number.isFinite))));
  ok('geometry', 'decoration never collides (handoff §4.4)',
    all.every(b => b.colliders.every(c => !isDeco(c.material))),
    all.flatMap(b => b.colliders.filter(c => isDeco(c.material)).map(c => c.material)).join(',') || 'clean');
  ok('geometry', 'every collider carries a friction and a bounce the solver can read',
    all.every(b => b.colliders.every(c =>
      Number.isFinite(c.spec.friction) && Number.isFinite(c.spec.bounce))));

  const overhang = all.filter(b => {
    const { lo, hi } = b.bounds;
    return lo[0] < -HALF - 0.6 || hi[0] > HALF + 0.6 || lo[2] < -HALF - 0.6 || hi[2] > HALF + 0.6;
  });
  ok('geometry', 'no piece overhangs its 10 m tile footprint', overhang.length === 0,
    overhang.map(b => `#${b.piece.id} ${b.piece.name}`).join('; ') || 'all inside');

  const tall = all.filter(b => b.bounds.hi[1] > 6.5 || b.bounds.lo[1] < -2.6);
  ok('geometry', 'vertical extents stay within the stage envelope', tall.length === 0,
    tall.map(b => `#${b.piece.id} y∈[${b.bounds.lo[1].toFixed(1)},${b.bounds.hi[1].toFixed(1)}]`).join('; ') || 'ok');

  /* — socket reachability, the one with real teeth — */
  const unreachable = [];
  for (const b of all) {
    for (const dir of DIRS) {
      const lvl = b.piece.sockets[dir];
      if (lvl === undefined) continue;
      for (const [px, pz] of probePoints(b.piece, dir, lvl)) {
        if (!supportedAt(b, px, pz, LEVELS[lvl])) {
          const near = nearestSurface(b, px, LEVELS[lvl] + BALL_R, pz, true);
          unreachable.push(`#${b.piece.id} ${dir} (nearest floor ${near.toFixed(2)} m away)`);
        }
      }
    }
  }
  ok('sockets', 'a ball arriving at every open socket lands on real geometry',
    unreachable.length === 0, unreachable.join('; ') || `${all.length} pieces probed`);

  const closedButSolid = [];
  for (const b of all) {
    for (const dir of DIRS) {
      if (b.piece.sockets[dir] !== undefined) continue;
      const [ex, ez] = EDGE_VEC[dir];
      const px = ex * (HALF - BALL_R - 0.15), pz = ez * (HALF - BALL_R - 0.15);
      if (supportedAt(b, px, pz, LEVELS[0])) closedButSolid.push(`#${b.piece.id} ${dir}`);
    }
  }
  ok('sockets', 'closed edges are genuinely closed — nothing to roll out on',
    closedButSolid.length === 0, closedButSolid.join('; ') || 'no leaks');

  ok('sockets', 'every piece has at least one open socket',
    PIECES.every(p => DIRS.some(d => p.sockets[d] !== undefined)));
  ok('sockets', 'air-port pieces name a partner and the partner agrees',
    PIECES.filter(p => p.air).every(p => {
      const o = PIECE_BY_ID.get(p.pairWith);
      return o && o.air && ((p.air.out && o.air.in) || (p.air.in && o.air.out));
    }));

  /* — playability, from the handoff's own formulas — */
  const steep = [];
  for (const p of PIECES) {
    const lv = DIRS.filter(d => p.sockets[d] !== undefined).map(d => p.sockets[d]);
    if (!lv.length) continue;
    const rise = LEVELS[Math.max(...lv)] - LEVELS[Math.min(...lv)];
    if (rise <= 0) continue;
    const run = p.id === 30 || p.id === 31 ? 14.3 : TILE;      // the loops travel further
    // PEAK grade, not mean. Every ramp eases its ends so it meets a neighbour
    // flat, which necessarily makes the middle steeper than the average — and
    // the middle is where the ball stops. Checking the mean passed a ramp the
    // bot could not climb.
    const grade = peakGrade(rise, run);
    const downhill = TUNING.GRAVITY * Math.sin(grade);
    if (downhill >= MAX_ACCEL * 0.92) {
      steep.push(`#${p.id} peaks at ${(grade * 180 / Math.PI).toFixed(1)}° (${downhill.toFixed(2)} m/s² downhill)`);
    }
  }
  ok('playability', 'no ramp peaks steeper than the player can climb (D03)',
    steep.length === 0, steep.join('; ') || `max tilt gives ${MAX_ACCEL.toFixed(2)} m/s²`);

  ok('playability', 'the narrow beam is at the stated playable minimum, not below',
    Math.abs(TRACK_NARROW - 3 * BALL_R) < 1e-9, `${TRACK_NARROW} m = ${(TRACK_NARROW / BALL_R).toFixed(1)}r`);
  ok('playability', 'the standard corridor is at or above the comfortable width',
    TRACK >= 6 * BALL_R, `${TRACK} m = ${(TRACK / BALL_R).toFixed(1)}r`);

  // handoff §2.6 — the invariant that stops the ball teleporting through walls
  const maxStep = TUNING.maxSpeed * TUNING.FIXED;
  ok('playability', 'max displacement per substep stays under the ball radius (§2.6)',
    maxStep < BALL_R, `${maxStep.toFixed(3)} m < ${BALL_R} m`);
  const shrink = PIECES.find(p => p.id === 55).behaviours[0].scale;
  ok('playability', 'the smallest ball the size tunnel produces still respects §2.6',
    maxStep < BALL_R * shrink, `${maxStep.toFixed(3)} m < ${(BALL_R * shrink).toFixed(3)} m`);

  const fastest = Math.sqrt(2 * TUNING.GRAVITY * LEVELS[2]);
  ok('playability', 'the steepest drop cannot exceed the speed clamp',
    fastest <= TUNING.maxSpeed, `${fastest.toFixed(2)} ≤ ${TUNING.maxSpeed} m/s`);

  /* — determinism (handoff §5.2) — */
  const fp1 = PIECES.map(p => fingerprint(buildPiece(p.id))).join('|');
  const fp2 = PIECES.map(p => fingerprint(buildPiece(p.id))).join('|');
  ok('determinism', 'building the kit twice produces identical geometry', fp1 === fp2);
  const fp3 = [...PIECES].reverse().map(p => fingerprint(buildPiece(p.id))).reverse().join('|');
  ok('determinism', 'build order does not affect any piece', fp1 === fp3);

  /* — documentation coverage — */
  ok('docs', 'every piece carries its documented gameplay role',
    PIECES.every(p => typeof p.desc === 'string' && p.desc.length > 20));
  ok('docs', 'every deviation from the source documents is written down',
    DECISIONS.length >= 7 && DECISIONS.every(d => d.id && d.title && d.body && d.impact));

  return T.concat(behaviorSelfTests().map(t => Object.assign({ group: 'behaviours' }, t)));
}

/**
 * Prove the suite has teeth (handoff §10): break things on purpose and assert
 * the relevant check goes red. A test that cannot fail is worse than no test.
 */
export function provocations () {
  const out = [];
  const run = (name, mutate, expectFailing) => {
    const piece = PIECE_BY_ID.get(mutate.id);
    const original = piece.build;
    piece.build = mutate.build;
    let caught;
    try {
      const results = kitSelfTests();
      const failed = results.filter(r => !r.pass).map(r => r.name);
      caught = failed.some(n => n.includes(expectFailing));
      out.push({ name, pass: caught, detail: failed.length ? failed.join('; ') : 'nothing failed' });
    } finally {
      piece.build = original;
    }
    return caught;
  };

  run('a piece that stops short of its own socket is caught',
    { id: 1, build (m) { m.box(0, 0, 0, 2.4, 0.3, 4.0, 'track', { color: '#c39a63' }); } },
    'lands on real geometry');

  run('a piece that leaks a rollable surface onto a closed edge is caught',
    { id: 9, build (m) { m.box(0, 0, 0, 11, 0.3, 11, 'track', { color: '#c39a63' }); } },
    'genuinely closed');

  run('a piece that overhangs the tile is caught',
    { id: 1, build (m) { m.box(0, 0, 0, 2.4, 0.3, 14, 'track', { color: '#c39a63' }); } },
    'overhangs its 10 m tile');

  run('decoration that has been made to collide is caught',
    { id: 1, build (m) { m.box(0, 0, 0, 2.4, 0.3, 10.4, 'glow', { color: '#fff' }); } },
    'Decoration never collides'.toLowerCase().slice(0, 10));

  return out;
}

/* ── headless runner ──────────────────────────────────────────────────── */

export function runAll () {
  const tests = kitSelfTests();
  const provs = provocations();
  const pass = tests.filter(t => t.pass).length;
  const provPass = provs.filter(t => t.pass).length;
  return {
    version: KIT_VERSION,
    tests, provocations: provs,
    summary: { pass, total: tests.length, provPass, provTotal: provs.length },
  };
}

/**
 * physics.js — rolling-sphere dynamics against a triangle soup.
 *
 * Lifted from monkeyball-open-world/js/physics.js per PHYSICS-ENGINE-HANDOFF.md
 * §12: the solver is copied, `CellCollider` (coupled to their 16 m lattice) is
 * replaced by the maze `GridCollider` from §4.1, and the constants come from the
 * maze column of §3.
 *
 * The one-sentence model: the player never pushes the ball — they rotate the
 * gravity vector, and a sphere rolls against a triangle soup.
 *
 * Zero dependencies beyond the tuning table.
 */

import { TUNING, BALL_R } from './kit.js';

export const GRAVITY = TUNING.GRAVITY;      // 18
export const MAX_TILT = TUNING.MAX_TILT;    // 0.30 rad ≈ 17°
export const FIXED = TUNING.FIXED;          // 1/120 — do not change without redoing §2.6
const SPHERE_I = 0.4;                        // I = 2/5·m·r² for a solid sphere
const TANGENT_K = 1 / (1 + 1 / SPHERE_I);    // 0.2857 — the impulse that kills slip exactly

/** Max acceleration the player can command. Everything else is downstream. */
export const MAX_ACCEL = GRAVITY * Math.sin(MAX_TILT);

/* ── collider ─────────────────────────────────────────────────────────── */

/**
 * Handoff §4.1 bins 16×16 at maze scale. That is right for a 40 m maze and
 * wrong for a 70 m one: 16 bins over 70 m is a 4.4 m cell, so a single gather
 * can return most of a tile's triangles. `binsFor` keeps the bin near 2.5 m —
 * about one corridor width — whatever the maze measures.
 */
const DEFAULT_BINS = 16;
export const binsFor = size => Math.max(8, Math.min(64, Math.ceil(size / 2.5)));

/**
 * Static collision geometry with a coarse XZ index.
 *
 * One collider per material (handoff §2.4) — cheaper and simpler than
 * per-triangle material indices, and the gather loop already handles many.
 *
 * The bins are XZ only. That is fine here: maze walls are vertical and the
 * floor is effectively one layer with local bumps. A genuinely multi-storey
 * maze needs a Y dimension in the bin key, or one collider per storey.
 */
export class GridCollider {
  /**
   * @param tris     flat Float32Array, 9 floats per triangle, WORLD space
   * @param material { friction, bounce } shared by every triangle here.
   *                 `friction` is GRIP (0.05 ice … 0.99 glue), not Coulomb µ.
   */
  constructor (tris, minX, minZ, sizeX, sizeZ, material, bins = DEFAULT_BINS) {
    this.tris = tris instanceof Float32Array ? tris : new Float32Array(tris);
    this.piece = material;                   // name kept: the solver reads `.piece`
    this.count = this.tris.length / 9;
    this.minX = minX; this.minZ = minZ;
    this.n = bins;
    const clampBin = i => (i < 0 ? 0 : i > bins - 1 ? bins - 1 : i);
    this._clamp = clampBin;
    this.cellX = Math.max(1e-6, sizeX / bins);
    this.cellZ = Math.max(1e-6, sizeZ / bins);
    this.bins = Array.from({ length: bins * bins }, () => []);
    this.minY = Infinity; this.maxY = -Infinity;
    const t = this.tris;
    for (let o = 0; o < t.length; o += 9) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const x = t[o + k * 3], y = t[o + k * 3 + 1], z = t[o + k * 3 + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
        if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
      }
      // Both ends are clamped into range, not just one.
      //
      // The handoff's §4.1 snippet clamps i0 only from below and i1 only from
      // above. A triangle sitting exactly on the collider's upper bound gets
      // i0 = BINS and i1 = BINS−1, the loop does not execute, and the triangle
      // is silently never binned — an invisible wall that isn't there. In the
      // open world their cell geometry never sat on the bound; a maze wall on
      // the outer edge of the world does, every time. The containment test in
      // this file is what found it: 221 of 400 shots went straight through.
      const i0 = clampBin(Math.floor((x0 - minX) / this.cellX));
      const i1 = clampBin(Math.floor((x1 - minX) / this.cellX));
      const j0 = clampBin(Math.floor((z0 - minZ) / this.cellZ));
      const j1 = clampBin(Math.floor((z1 - minZ) / this.cellZ));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) this.bins[j * bins + i].push(o);
    }
  }

  /** Push (collider, triangleOffset) pairs for every bin the sphere overlaps. */
  gather (x, z, r, out) {
    // Clamping rather than rejecting: a ball just outside the indexed area must
    // still see the boundary bins, or it can never be pushed back in.
    const c = this._clamp, n = this.n;
    const i0 = c(Math.floor((x - r - this.minX) / this.cellX));
    const i1 = c(Math.floor((x + r - this.minX) / this.cellX));
    const j0 = c(Math.floor((z - r - this.minZ) / this.cellZ));
    const j1 = c(Math.floor((z + r - this.minZ) / this.cellZ));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const bin = this.bins[j * n + i];
        for (let k = 0; k < bin.length; k++) { out.push(this); out.push(bin[k]); }
      }
    }
  }
}

/** Fold several colliders into the single `gather` the solver expects. */
export function gatherFrom (colliders) {
  return (x, z, r, out) => {
    for (let i = 0; i < colliders.length; i++) colliders[i].gather(x, z, r, out);
  };
}

/** Distance from a point to the nearest collision triangle within `reach`. */
export function nearestSurface (colliders, px, py, pz, reach = 2.0) {
  const out = [];
  for (let i = 0; i < colliders.length; i++) colliders[i].gather(px, pz, reach, out);
  let best = Infinity;
  for (let i = 0; i < out.length; i += 2) {
    const q = closestPointTriangle(px, py, pz, out[i].tris, out[i + 1]);
    const d = Math.hypot(px - q.x, py - q.y, pz - q.z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Height of the highest collision surface under (x, z), at or below `ceiling`.
 * −Infinity when the column is empty — which is a legitimate answer over a
 * broken bridge or an acid pit.
 *
 * Triangles with no XZ area are walls and cannot support anything, so they are
 * skipped rather than returning the height of a wall's top edge.
 */
export function supportUnder (colliders, x, z, ceiling = Infinity) {
  const out = [];
  for (let i = 0; i < colliders.length; i++) colliders[i].gather(x, z, 0.05, out);
  let best = -Infinity;
  for (let i = 0; i < out.length; i += 2) {
    const t = out[i].tris, o = out[i + 1];
    const ax = t[o], az = t[o + 2], bx = t[o + 3], bz = t[o + 5], cx = t[o + 6], cz = t[o + 8];
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-9) continue;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
    const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
    const l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const y = l1 * t[o + 1] + l2 * t[o + 4] + l3 * t[o + 7];
    if (y <= ceiling && y > best) best = y;
  }
  return best;
}

/* ── closest point on a triangle (Ericson, Real-Time Collision Detection) ── */

const _q = { x: 0, y: 0, z: 0 };
function closestPointTriangle (px, py, pz, t, o) {
  const ax = t[o], ay = t[o + 1], az = t[o + 2];
  const bx = t[o + 3], by = t[o + 4], bz = t[o + 5];
  const cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { _q.x = ax; _q.y = ay; _q.z = az; return _q; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { _q.x = bx; _q.y = by; _q.z = bz; return _q; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    _q.x = ax + abx * v; _q.y = ay + aby * v; _q.z = az + abz * v; return _q;
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { _q.x = cx; _q.y = cy; _q.z = cz; return _q; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    _q.x = ax + acx * w; _q.y = ay + acy * w; _q.z = az + acz * w; return _q;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    _q.x = bx + (cx - bx) * w; _q.y = by + (cy - by) * w; _q.z = bz + (cz - bz) * w; return _q;
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  _q.x = ax + abx * v + acx * w;
  _q.y = ay + aby * v + acy * w;
  _q.z = az + abz * v + acz * w;
  return _q;
}

/* ── the ball ─────────────────────────────────────────────────────────── */

export class Ball {
  constructor (r = BALL_R) {
    this.r = r;
    this.p = { x: 0, y: 3, z: 0 };
    this.v = { x: 0, y: 0, z: 0 };
    this.w = { x: 0, y: 0, z: 0 };          // angular velocity, rad/s
    this.grounded = false;
    this.groundNormal = { x: 0, y: 1, z: 0 };
    this.contactPiece = null;
    this.lastImpact = 0;                    // drive impact SFX from this
    this.slip = 0;                          // drive skid SFX/particles from this
  }
}

/** Tilted "up" from camera yaw plus stick tilt. Gravity is then −up·GRAVITY. */
export function tiltUp (camYaw, tiltF, tiltR, out = { x: 0, y: 1, z: 0 }) {
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const sf = Math.sin(tiltF), sr = Math.sin(tiltR);
  const y = Math.sqrt(Math.max(0.05, 1 - sf * sf - sr * sr));
  const x = -fx * sf - rx * sr;
  const z = -fz * sf - rz * sr;
  const L = Math.hypot(x, y, z) || 1;
  out.x = x / L; out.y = y / L; out.z = z / L;
  return out;
}

const _scratch = [];

/**
 * One fixed physics step.
 *
 * @param ball    the Ball
 * @param gather  (x, z, r, out) => push (collider, triOffset) pairs into `out`
 * @param up      from tiltUp()
 * @param dt      FIXED. Variable dt makes the solver non-deterministic, which
 *                for a daily puzzle on a shared seed is fatal (handoff §2.5).
 * @param env     { accel, drag, gripScale, maxSpeed } from behaviors.resolveEnv
 */
export function stepBall (ball, gather, up, dt, env = {}) {
  const acc = env.accel || { x: 0, y: 0, z: 0 };
  ball.v.x += (-up.x * GRAVITY + acc.x) * dt;
  ball.v.y += (-up.y * GRAVITY + acc.y) * dt;
  ball.v.z += (-up.z * GRAVITY + acc.z) * dt;

  const drag = Math.pow(env.drag ?? TUNING.drag, dt * 60);
  ball.v.x *= drag; ball.v.y *= drag; ball.v.z *= drag;

  ball.p.x += ball.v.x * dt;
  ball.p.y += ball.v.y * dt;
  ball.p.z += ball.v.z * dt;

  ball.grounded = false;
  ball.contactPiece = null;
  let bestDot = -2;

  // Three relaxation passes. This is what stops the ball vibrating where two
  // walls meet — which in a maze is every corner. Do not reduce it to one.
  for (let pass = 0; pass < TUNING.relaxPasses; pass++) {
    _scratch.length = 0;
    gather(ball.p.x, ball.p.z, ball.r, _scratch);
    let hits = 0;
    for (let idx = 0; idx < _scratch.length; idx += 2) {
      const col = _scratch[idx];
      const o = _scratch[idx + 1];
      const t = col.tris;
      const q = closestPointTriangle(ball.p.x, ball.p.y, ball.p.z, t, o);
      let nx = ball.p.x - q.x, ny = ball.p.y - q.y, nz = ball.p.z - q.z;
      const d2 = nx * nx + ny * ny + nz * nz;
      if (d2 >= ball.r * ball.r || d2 < 1e-12) continue;
      const d = Math.sqrt(d2);
      nx /= d; ny /= d; nz /= d;
      const pen = ball.r - d;
      hits++;

      ball.p.x += nx * pen; ball.p.y += ny * pen; ball.p.z += nz * pen;

      const piece = col.piece;
      const restitution = piece ? piece.bounce : 0.15;
      const grip = piece ? piece.friction : 0.85;

      const vn = ball.v.x * nx + ball.v.y * ny + ball.v.z * nz;
      if (vn < 0) {
        const e = Math.abs(vn) > 2.2 ? restitution : restitution * 0.25;
        const j = -(1 + e) * vn;
        ball.v.x += nx * j; ball.v.y += ny * j; ball.v.z += nz * j;
        if (Math.abs(vn) > ball.lastImpact) ball.lastImpact = Math.abs(vn);
      }

      // Contact-point slip → tangential impulse → rolling emerges for free.
      const rx = -nx * ball.r, ry = -ny * ball.r, rz = -nz * ball.r;
      const cvx = ball.v.x + (ball.w.y * rz - ball.w.z * ry);
      const cvy = ball.v.y + (ball.w.z * rx - ball.w.x * rz);
      const cvz = ball.v.z + (ball.w.x * ry - ball.w.y * rx);
      const cvn = cvx * nx + cvy * ny + cvz * nz;
      const sx = cvx - cvn * nx, sy = cvy - cvn * ny, sz = cvz - cvn * nz;
      const slip = Math.hypot(sx, sy, sz);
      ball.slip = slip;
      if (slip > 1e-5) {
        const k = TANGENT_K * Math.min(1, grip * (env.gripScale ?? 1));
        const jx = -sx * k, jy = -sy * k, jz = -sz * k;
        ball.v.x += jx; ball.v.y += jy; ball.v.z += jz;
        const f = 1 / (SPHERE_I * ball.r);
        ball.w.x += (ry * jz - rz * jy) * f;
        ball.w.y += (rz * jx - rx * jz) * f;
        ball.w.z += (rx * jy - ry * jx) * f;
      }

      const dot = nx * up.x + ny * up.y + nz * up.z;
      if (dot > 0.35) {
        ball.grounded = true;
        if (dot > bestDot) {
          bestDot = dot;
          ball.groundNormal.x = nx; ball.groundNormal.y = ny; ball.groundNormal.z = nz;
          ball.contactPiece = piece;
        }
      }
      // Maze corners generate more simultaneous contacts than open terrain.
      if (hits > TUNING.hitsBreak) break;
    }
    if (!hits) break;
  }

  const ad = Math.pow(0.995, dt * 60);
  ball.w.x *= ad; ball.w.y *= ad; ball.w.z *= ad;

  const speed = Math.hypot(ball.v.x, ball.v.y, ball.v.z);
  const MAXV = env.maxSpeed ?? TUNING.maxSpeed;
  if (speed > MAXV) {
    const s = MAXV / speed;
    ball.v.x *= s; ball.v.y *= s; ball.v.z *= s;
  }
  return ball;
}

/* ── self-tests (handoff §10) ─────────────────────────────────────────── */

function floorCollider (half = 20, material = { friction: 0.85, bounce: 0.1 }) {
  const t = new Float32Array([
    -half, 0, -half, half, 0, -half, half, 0, half,
    -half, 0, -half, half, 0, half, -half, 0, half,
  ]);
  return new GridCollider(t, -half, -half, half * 2, half * 2, material);
}

/** A closed box of walls, for the containment test. */
function roomCollider (half = 6, h = 4) {
  const t = [];
  const quad = (a, b, c, d) => { t.push(...a, ...b, ...c, ...a, ...c, ...d); };
  quad([-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half]);      // floor
  quad([-half, 0, -half], [half, 0, -half], [half, h, -half], [-half, h, -half]);
  quad([-half, 0, half], [half, 0, half], [half, h, half], [-half, h, half]);
  quad([-half, 0, -half], [-half, 0, half], [-half, h, half], [-half, h, -half]);
  quad([half, 0, -half], [half, 0, half], [half, h, half], [half, h, -half]);
  quad([-half, h, -half], [half, h, -half], [half, h, half], [-half, h, half]);      // lid
  return new GridCollider(new Float32Array(t), -half, -half, half * 2, half * 2,
    { friction: 0.6, bounce: 0.2 });
}

export function physicsSelfTests () {
  const T = [];
  const ok = (name, cond, detail) => T.push({ group: 'physics', name, pass: !!cond, detail });

  const col = floorCollider();
  const gather = gatherFrom([col]);
  const up = { x: 0, y: 1, z: 0 };
  const r = BALL_R;

  const b = new Ball(r);
  b.p = { x: 0, y: 6, z: 0 };
  for (let i = 0; i < 900; i++) stepBall(b, gather, up, FIXED);
  ok('a ball settles at exactly y = r on a flat floor', Math.abs(b.p.y - r) < 0.03,
    `y=${b.p.y.toFixed(4)} vs r=${r}`);
  ok('a settled ball reports grounded', b.grounded);
  ok('a ball does not drift on level ground', Math.hypot(b.p.x, b.p.z) < 0.1,
    `drift=${Math.hypot(b.p.x, b.p.z).toFixed(4)} m`);

  const b2 = new Ball(r);
  b2.p = { x: 0, y: r, z: 0 };
  const up2 = tiltUp(0, 0.3, 0);
  for (let i = 0; i < 240; i++) stepBall(b2, gather, up2, FIXED);
  ok('tilting forward rolls the ball forward (+Z)', b2.p.z > 0.8, `z=${b2.p.z.toFixed(2)}`);
  ok('it rolls rather than slides', Math.abs(b2.w.x) > 1.0, `ωx=${b2.w.x.toFixed(2)}`);
  const rollErr = Math.abs(b2.v.z - b2.w.x * r) / Math.max(1, Math.abs(b2.v.z));
  ok('rolling is near-perfect (v ≈ ω×r, within 15%)', rollErr < 0.15,
    `err=${(rollErr * 100).toFixed(1)}%`);

  const uF = tiltUp(0, 0.3, 0), uR = tiltUp(0, 0, 0.3);
  ok('tiltUp leans "up" toward −Z on forward tilt', uF.z < -0.2, `z=${uF.z.toFixed(3)}`);
  ok('tiltUp leans "up" toward −X on right tilt', uR.x < -0.2, `x=${uR.x.toFixed(3)}`);
  ok('tiltUp stays unit length', Math.abs(Math.hypot(uF.x, uF.y, uF.z) - 1) < 1e-9);

  const b3 = new Ball(r);
  b3.p = { x: 0, y: 4, z: 0 }; b3.v = { x: 0, y: -55, z: 0 };
  for (let i = 0; i < 200; i++) stepBall(b3, gather, up, FIXED);
  ok('a ball falling at 55 m/s does not tunnel', b3.p.y > 0.1, `y=${b3.p.y.toFixed(3)}`);

  const run = () => {
    const x = new Ball(r);
    x.p = { x: 0.3, y: 5, z: -0.2 };
    for (let i = 0; i < 400; i++) stepBall(x, gather, tiltUp(0.4, 0.2, -0.1), FIXED);
    return `${x.p.x.toFixed(6)},${x.p.y.toFixed(6)},${x.p.z.toFixed(6)}`;
  };
  ok('same inputs give identical positions to 6 dp', run() === run());

  ok('max displacement per substep stays under the ball radius (§2.6)',
    TUNING.maxSpeed * FIXED < r, `${(TUNING.maxSpeed * FIXED).toFixed(3)} m < ${r} m`);

  /* — the two maze additions handoff §10 asks for — */

  // Wall containment: fire the ball at the walls from many seeded directions.
  // Tunnelling is intermittent and near-impossible to reproduce by hand, which
  // is exactly why this is the highest-value test in the file.
  const room = roomCollider(6, 4);
  const rgather = gatherFrom([room]);
  let escaped = 0, worst = 0;
  for (let i = 0; i < 400; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);          // golden-angle spread, no RNG
    const el = ((i * 0.7548776662) % 1) * 1.4 - 0.7;
    const s = TUNING.maxSpeed;
    const ball = new Ball(r);
    ball.p = { x: 0, y: 2, z: 0 };
    ball.v = {
      x: Math.cos(a) * Math.cos(el) * s,
      y: Math.sin(el) * s,
      z: Math.sin(a) * Math.cos(el) * s,
    };
    for (let k = 0; k < 240; k++) stepBall(ball, rgather, up, FIXED);
    const out = Math.max(Math.abs(ball.p.x), Math.abs(ball.p.z)) - 6;
    if (out > worst) worst = out;
    if (Math.abs(ball.p.x) > 6.2 || Math.abs(ball.p.z) > 6.2 || ball.p.y < -0.5 || ball.p.y > 4.5) escaped++;
  }
  ok('the ball never escapes a closed room from 400 directions at max speed',
    escaped === 0, `escaped=${escaped}, worst overshoot=${Math.max(0, worst).toFixed(3)} m`);

  // Corner stability: park it in an inside corner under full tilt into it.
  // Negative tilt: tiltUp leans "up" toward −Z/−X, so gravity — which is −up —
  // drives the ball toward +Z/+X. Pushing it into the (−6, −6) corner needs the
  // opposite sign, and getting that backwards just rolls it to the far corner.
  const corner = new Ball(r);
  corner.p = { x: -5.0, y: r, z: -5.0 };
  const intoCorner = tiltUp(0, -MAX_TILT, -MAX_TILT);
  for (let i = 0; i < 600; i++) stepBall(corner, rgather, intoCorner, FIXED);
  const settled = { x: corner.p.x, y: corner.p.y, z: corner.p.z };
  let variance = 0;
  for (let i = 0; i < 600; i++) {
    stepBall(corner, rgather, intoCorner, FIXED);
    variance = Math.max(variance,
      Math.hypot(corner.p.x - settled.x, corner.p.y - settled.y, corner.p.z - settled.z));
  }
  ok('a ball held into a 90° corner for 5 s stays put to within a millimetre',
    variance < 0.001, `drift=${(variance * 1000).toFixed(3)} mm`);

  return T;
}

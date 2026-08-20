/**
 * dynamics.js — the moving obstacles a triangle soup cannot express.
 *
 * PHYSICS-ENGINE-HANDOFF.md §8: rotating bars, sliding walls, lifts and
 * swinging weights are resolved analytically against the ball, after stepBall,
 * inside the same substep. Two shapes cover every moving part in the 64-piece
 * set: a sphere, and a box with an arbitrary-axis rotation.
 *
 * Every pose is a pure function of stage time and a placement-derived phase —
 * no wall-clock, no Math.random — so a daily seed replays identically for
 * everyone (handoff §5.2 rule 2).
 *
 * The trap this file exists to not fall into is §8's: **the world→local
 * transform for a rotated box is the transpose of local→world, not the same
 * matrix with a negated angle.** Getting it backwards mirrors the collider
 * about the box axis, so the ball hits empty air on one side and passes through
 * the visible mesh on the other. It reads as a physics glitch, not a maths
 * error, which is why it is expensive to find.
 */

import { rotXZ } from './assemble.js';

/* ── small matrix helpers (column-major, for the renderer) ────────────── */

export function identity () {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mul (a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

export function translation (x, y, z) {
  const m = identity(); m[12] = x; m[13] = y; m[14] = z; return m;
}

/** Rotation about a principal axis, `axis` ∈ 'x' | 'y' | 'z'. */
export function rotation (axis, a) {
  const m = identity(), c = Math.cos(a), s = Math.sin(a);
  if (axis === 'x') { m[5] = c; m[6] = s; m[9] = -s; m[10] = c; }
  else if (axis === 'z') { m[0] = c; m[1] = s; m[4] = -s; m[5] = c; }
  else { m[0] = c; m[2] = -s; m[8] = s; m[10] = c; }
  return m;
}

/* ── pose ─────────────────────────────────────────────────────────────── */

const TAU = Math.PI * 2;
const wrap01 = t => t - Math.floor(t);
/** Ease a 0→1→0 gate so a spike bed or a bridge does not teleport. */
const gate = (t, duty) => {
  const u = wrap01(t);
  if (u < duty * 0.5) return Math.min(1, u / (duty * 0.25));
  if (u < duty) return 1;
  const d = (u - duty) / Math.max(1e-6, (1 - duty) * 0.4);
  return Math.max(0, 1 - d);
};

/**
 * The pose of one moving part at stage time `t`, in PIECE-LOCAL space.
 *
 * Returns { offset, angle, active }: a translation along `slide`, a rotation of
 * `angle` about `axis` through `pivot`, and whether the part is collidable at
 * all right now (a retracted spike bed is not).
 */
export function poseOf (spec, t, phase = 0) {
  const period = spec.period || 4;
  const u = (t / period) + phase;
  switch (spec.effect) {
    case 'pendulum':
      return { angle: spec.swing * Math.sin(TAU * u), offset: 0, active: true };
    case 'spindle':
    case 'coreArm':
      return { angle: TAU * u, offset: 0, active: true };
    case 'turntable': {
      // Steps 90° and holds, rather than sweeping — the documentation says
      // "rotates 90° every 3 seconds", and a hold is what makes it readable.
      const step = spec.step || Math.PI / 2;
      const k = Math.floor(u);
      const frac = Math.min(1, (u - k) / 0.28);
      const ease = frac * frac * (3 - 2 * frac);
      return { angle: step * (k + ease), offset: 0, active: true };
    }
    case 'boulder':
      return { angle: spec.roll ? -TAU * u * 1.6 : 0, offset: spec.amplitude * Math.sin(TAU * u), active: true };
    case 'lift':
      return { angle: 0, offset: spec.amplitude * Math.sin(TAU * u), active: true };
    case 'spikes': {
      const g = gate(u, spec.dutyCycle ?? 0.4);
      return { angle: 0, offset: spec.amplitude * (g - 1), active: g > 0.05 };
    }
    case 'drawbridge':
    case 'trapdoor': {
      const g = gate(u, spec.dutyCycle ?? 0.5);
      return { angle: spec.openAngle * g, offset: 0, active: g < 0.9 };
    }
    case 'switchBlade': {
      const flip = wrap01(u) < 0.5 ? spec.yawA : spec.yawB;
      return { angle: flip, offset: 0, active: true };
    }
    case 'keyGate':
      return { angle: 0, offset: 0, active: true };
    default:
      return { angle: 0, offset: 0, active: true };
  }
}

/* ── the body ─────────────────────────────────────────────────────────── */

/**
 * One placed moving part. Owns its piece-local spec plus the cell's rotation
 * and world origin, so `resolve` can move the ball into local space, do the
 * collision there, and move the result back out.
 */
export class DynamicBody {
  constructor (spec, cell, originX, originZ) {
    this.spec = spec;
    this.shape = spec.shape;
    this.effect = spec.effect;
    this.rot = cell.rot;
    this.ox = originX; this.oz = originZ;
    this.cell = cell.cell;
    this.pieceId = cell.pieceId;
    // Phase from the cell index: deterministic, but two identical pieces in one
    // maze do not beat in lockstep.
    this.phase = ((cell.cell * 0.6180339887) % 1);
    this.axis = spec.axis || 'y';
    this.pivot = spec.pivot || spec.at || [0, 0, 0];
    this.slide = spec.slide || null;
    this.blades = spec.blades || 1;
    this.lastPos = null;
    this.vel = { x: 0, y: 0, z: 0 };
  }

  /** Local→world for a point, using the cell placement. */
  toWorld (p) {
    const [x, z] = rotXZ(p[0], p[2], this.rot);
    return [x + this.ox, p[1], z + this.oz];
  }

  /** World→local: the inverse cell rotation, then the origin removed. */
  toLocal (x, y, z) {
    const [lx, lz] = rotXZ(x - this.ox, z - this.oz, (4 - (this.rot & 3)) & 3);
    return [lx, y, lz];
  }

  /** Local-space centre and orientation of blade `b` at stage time `t`. */
  poseAt (t, b = 0) {
    const pose = poseOf(this.spec, t, this.phase);
    // Blades are spaced over π, not 2π: a box is 180°-symmetric, so the four
    // blades of the spindle sit at 0/45/90/135° and cover a full eight-armed
    // star. Spacing them over 2π would put two colliders on top of each other
    // and leave the other two arms visible but intangible.
    const bladeOffset = this.blades > 1 ? (b / this.blades) * Math.PI : 0;
    const angle = pose.angle + bladeOffset;
    const at = this.spec.at || [0, 0, 0];
    let c = [at[0], at[1], at[2]];

    if (this.slide) {
      c = [c[0] + this.slide[0] * pose.offset, c[1] + this.slide[1] * pose.offset,
        c[2] + this.slide[2] * pose.offset];
    }
    if (this.effect === 'pendulum' || this.effect === 'drawbridge'
      || this.effect === 'trapdoor' || (this.spec.pivot && this.effect !== 'switchBlade'
        && this.effect !== 'spindle' && this.effect !== 'coreArm' && this.effect !== 'turntable')) {
      // Swing the centre about the pivot.
      const p = this.pivot;
      const dx = c[0] - p[0], dy = c[1] - p[1], dz = c[2] - p[2];
      const s = Math.sin(angle), co = Math.cos(angle);
      if (this.axis === 'z') c = [p[0] + dx * co - dy * s, p[1] + dx * s + dy * co, p[2] + dz];
      else if (this.axis === 'x') c = [p[0] + dx, p[1] + dy * co - dz * s, p[2] + dy * s + dz * co];
      else c = [p[0] + dx * co + dz * s, p[1] + dy, p[2] - dx * s + dz * co];
    } else if (this.axis === 'y' && (this.effect === 'spindle' || this.effect === 'coreArm'
      || this.effect === 'turntable')) {
      const p = this.pivot;
      const dx = c[0] - p[0], dz = c[2] - p[2];
      const s = Math.sin(angle), co = Math.cos(angle);
      c = [p[0] + dx * co + dz * s, c[1], p[2] - dx * s + dz * co];
    }
    return { centre: c, angle, active: pose.active };
  }

  /**
   * The model matrix the renderer needs, in world space.
   *
   * No blade offset here: the piece already emitted every blade at its own
   * resting angle, so one rotation animates the whole assembly.
   */
  modelMatrix (t) {
    const pose = poseOf(this.spec, t, this.phase);
    const p = this.pivot;
    let local = mul(translation(p[0], p[1], p[2]),
      mul(rotation(this.axis, pose.angle), translation(-p[0], -p[1], -p[2])));
    if (this.slide) {
      local = mul(translation(this.slide[0] * pose.offset, this.slide[1] * pose.offset,
        this.slide[2] * pose.offset), local);
    }
    const q = (this.rot & 3) * (Math.PI / 2);
    // rotXZ turns local north into world east, which is a −90° yaw in the
    // right-handed frame the renderer uses.
    return mul(mul(translation(this.ox, 0, this.oz), rotation('y', -q)), local);
  }

  /**
   * Push the ball out of this body and impart the body's surface velocity.
   * Call AFTER stepBall, inside the same substep (handoff §2.5).
   */
  resolve (ball, t, dt) {
    let hit = false;
    for (let b = 0; b < this.blades; b++) {
      const { centre, angle, active } = this.poseAt(t, b);
      if (!active) continue;
      const [lx, ly, lz] = this.toLocal(ball.p.x, ball.p.y, ball.p.z);
      let n = null, pen = 0;

      if (this.shape === 'sphere') {
        const R = this.spec.radius + ball.r;
        const dx = lx - centre[0], dy = ly - centre[1], dz = lz - centre[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < R && d > 1e-6) { n = [dx / d, dy / d, dz / d]; pen = R - d; }
      } else {
        const [hx, hy, hz] = [this.spec.size[0] / 2, this.spec.size[1] / 2, this.spec.size[2] / 2];
        const dx = lx - centre[0], dy = ly - centre[1], dz = lz - centre[2];
        // world→local for the box's own yaw is the TRANSPOSE (handoff §8)
        const c = Math.cos(angle), s = Math.sin(angle);
        let bx, by, bz;
        if (this.axis === 'y') { bx = dx * c - dz * s; by = dy; bz = dx * s + dz * c; }
        else if (this.axis === 'x') { bx = dx; by = dy * c - dz * s; bz = dy * s + dz * c; }
        else { bx = dx * c - dy * s; by = dx * s + dy * c; bz = dz; }

        const qx = Math.max(-hx, Math.min(hx, bx));
        const qy = Math.max(-hy, Math.min(hy, by));
        const qz = Math.max(-hz, Math.min(hz, bz));
        let ox = bx - qx, oy = by - qy, oz = bz - qz;
        const d = Math.hypot(ox, oy, oz);
        if (d > 1e-9) {
          if (d >= ball.r) continue;
          pen = ball.r - d;
          ox /= d; oy /= d; oz /= d;
        } else {
          // Centre already inside the box — push out through the nearest face.
          const ex = hx - Math.abs(bx), ey = hy - Math.abs(by), ez = hz - Math.abs(bz);
          if (ex <= ey && ex <= ez) { ox = Math.sign(bx) || 1; oy = 0; oz = 0; pen = ex + ball.r; }
          else if (ey <= ez) { ox = 0; oy = Math.sign(by) || 1; oz = 0; pen = ey + ball.r; }
          else { ox = 0; oy = 0; oz = Math.sign(bz) || 1; pen = ez + ball.r; }
        }
        // local→world for the yaw is the forward rotation
        if (this.axis === 'y') n = [ox * c + oz * s, oy, -ox * s + oz * c];
        else if (this.axis === 'x') n = [ox, oy * c + oz * s, -oy * s + oz * c];
        else n = [ox * c + oy * s, -ox * s + oy * c, oz];
      }

      if (!n) continue;
      hit = true;
      // back out of the cell rotation into world space
      const [wnx, wnz] = rotXZ(n[0], n[2], this.rot);
      const wn = [wnx, n[1], wnz];

      ball.p.x += wn[0] * pen; ball.p.y += wn[1] * pen; ball.p.z += wn[2] * pen;

      // Surface velocity: a moving wall has to actually shove you, or you slide
      // through it as it passes (handoff §8).
      const rel = {
        x: ball.v.x - (this.spec.surfaceVel ? this.vel.x : 0),
        y: ball.v.y - (this.spec.surfaceVel ? this.vel.y : 0),
        z: ball.v.z - (this.spec.surfaceVel ? this.vel.z : 0),
      };
      const vn = rel.x * wn[0] + rel.y * wn[1] + rel.z * wn[2];
      if (vn < 0) {
        const e = this.spec.bounce ?? 0.35;
        const j = -(1 + e) * vn;
        ball.v.x += wn[0] * j; ball.v.y += wn[1] * j; ball.v.z += wn[2] * j;
        if (Math.abs(vn) > ball.lastImpact) ball.lastImpact = Math.abs(vn);
      }
      if (this.spec.surfaceVel) {
        ball.v.x += (this.vel.x - ball.v.x) * 0.22;
        ball.v.z += (this.vel.z - ball.v.z) * 0.22;
        if (this.vel.y > 0) ball.v.y = Math.max(ball.v.y, this.vel.y);
      }
    }
    return hit;
  }

  /** Track world-space velocity so `resolve` can impart it. */
  advance (t, dt) {
    const { centre } = this.poseAt(t, 0);
    const w = this.toWorld(centre);
    if (this.lastPos && dt > 0) {
      this.vel.x = (w[0] - this.lastPos[0]) / dt;
      this.vel.y = (w[1] - this.lastPos[1]) / dt;
      this.vel.z = (w[2] - this.lastPos[2]) / dt;
    }
    this.lastPos = w;
  }
}

/** Build every DynamicBody in an assembled world. */
export function bodiesFor (world) {
  const out = [];
  for (const cell of world.placed || []) {
    for (const spec of cell.piece.bodies) {
      if (spec.shape === 'none') continue;
      out.push(new DynamicBody(spec, cell, cell.world.x, cell.world.z));
    }
  }
  return out;
}

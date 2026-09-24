/**
 * behaviors.js — what each piece *does*, expressed as data the fixed-step loop
 * can consume, plus the small amount of runtime that is genuinely shared.
 *
 * The rules this file exists to enforce, all of them from
 * PHYSICS-ENGINE-HANDOFF.md §11 ("bugs already paid for"):
 *
 *   §11.3  A one-shot effect applied "while grounded" fires 120 times a second
 *          and becomes a rocket. Every impulse here goes through a Latch.
 *   §11.4  A teleport that lands inside the destination's own trigger bounces
 *          forever. Portals carry an exit offset AND a cooldown.
 *   §2.4    restitution > 1 gains energy every bounce. The documentation's
 *          e = 1.80 bumper and e = 1.20 mouse-trap are re-expressed here as a
 *          latched impulse on top of a legal restitution. (Decision D04.)
 */

import { TUNING } from './kit.js';

/* ── effect kinds ─────────────────────────────────────────────────────── */

export const KIND = {
  SURFACE: 'surface',   // continuous env override while in contact
  IMPULSE: 'impulse',   // one-shot velocity change, latched
  FIELD: 'field',       // continuous acceleration inside a volume
  TRIGGER: 'trigger',   // discrete event: teleport, pickup, checkpoint, kill
  DYNAMIC: 'dynamic',   // a moving collider resolved after stepBall
};

/**
 * A latch. Fires once per entry into a region and re-arms only when the ball
 * has been clear of it for `rearm` seconds. This is the §11.3 fix and every
 * IMPULSE behaviour must be gated on one.
 */
export class Latch {
  constructor (rearm = 0.25) { this.rearm = rearm; this.armed = true; this.clear = 0; }
  /** @returns true exactly once per entry. */
  fire (inside, dt) {
    if (inside) {
      this.clear = 0;
      if (this.armed) { this.armed = false; return true; }
      return false;
    }
    this.clear += dt;
    if (this.clear >= this.rearm) this.armed = true;
    return false;
  }
}

/* ── behaviour constructors, used by pieces.js ────────────────────────── */

const b = (kind, o) => Object.assign({ kind }, o);

export const surface = o => b(KIND.SURFACE, o);
export const impulse = o => b(KIND.IMPULSE, Object.assign({ rearm: 0.35 }, o));
export const field = o => b(KIND.FIELD, o);
export const trigger = o => b(KIND.TRIGGER, o);
export const dynamic = o => b(KIND.DYNAMIC, o);

/* ── the shared env resolver ──────────────────────────────────────────── */

/**
 * Fold every SURFACE and FIELD behaviour that currently applies into the single
 * `env` object stepBall takes (handoff §2.2).
 *
 * @param active  behaviours in effect this substep
 * @param ball    the Ball — FIELDs read its position, belts read its velocity
 */
export function resolveEnv (active, ball = null) {
  const env = {
    accel: { x: 0, y: 0, z: 0 },
    drag: TUNING.drag,
    gripScale: 1,
    maxSpeed: TUNING.maxSpeed,
  };
  for (const fx of active) {
    if (fx.kind === KIND.SURFACE) {
      if (fx.gripScale !== undefined) env.gripScale *= fx.gripScale;
      if (fx.drag !== undefined) env.drag = Math.min(env.drag, fx.drag);
      if (fx.maxSpeed !== undefined) env.maxSpeed = Math.min(env.maxSpeed, fx.maxSpeed);
      if (fx.accel) { env.accel.x += fx.accel[0]; env.accel.y += fx.accel[1]; env.accel.z += fx.accel[2]; }
      if (fx.belt && ball) {
        // A conveyor is a velocity target the surface chases, not a constant
        // force: a raw +8 m/s² would run the ball all the way to the speed
        // clamp instead of settling at the 8 m/s the documentation quotes.
        //
        // The authority is capped, and that cap matters. Unclamped, a stationary
        // ball on an 8 m/s belt sees 48 m/s² — nine times what full tilt can
        // command — so the reverse belt was not "requires steep tilt", it was
        // impassable. `beltAccel` keeps it under MAX_ACCEL so the player can win.
        const k = fx.stiffness ?? 6;
        const cap = fx.beltAccel ?? 4.0;
        const clamp = v => (v > cap ? cap : v < -cap ? -cap : v);
        env.accel.x += clamp((fx.belt[0] - ball.v.x) * k);
        env.accel.z += clamp((fx.belt[2] - ball.v.z) * k);
      }
    } else if (fx.kind === KIND.FIELD) {
      const a = fx.at ? fx.at(ball && ball.p) : fx.accel;
      if (a) { env.accel.x += a[0]; env.accel.y += a[1]; env.accel.z += a[2]; }
    }
  }
  return env;
}

/** Terminal speed a belt drives the ball to, ignoring drag. Used by the tests. */
export function beltTerminal (fx) { return Math.hypot(fx.belt[0], fx.belt[1], fx.belt[2]); }

/**
 * Apply a latched IMPULSE. `dir` is a unit vector; `speed` is the m/s the
 * documentation quotes. `mode: 'set'` replaces the component along dir (a boost
 * panel), `'add'` adds to it (a bumper).
 */
export function applyImpulse (ball, fx, dir) {
  const [dx, dy, dz] = dir;
  if (fx.mode === 'set') {
    const along = ball.v.x * dx + ball.v.y * dy + ball.v.z * dz;
    const need = Math.max(0, fx.speed - along);
    ball.v.x += dx * need; ball.v.y += dy * need; ball.v.z += dz * need;
  } else {
    ball.v.x += dx * fx.speed; ball.v.y += dy * fx.speed; ball.v.z += dz * fx.speed;
  }
}

/**
 * Teleport, with both §11.4 defences: the ball lands `exitOffset` metres beyond
 * the destination along its own exit direction — outside that portal's trigger
 * radius — and the pair is put on a cooldown regardless.
 */
export function teleport (ball, dest, exitDir, exitOffset = 1.2, carryMomentum = true) {
  ball.p.x = dest.x + exitDir[0] * exitOffset;
  ball.p.y = dest.y + exitDir[1] * exitOffset;
  ball.p.z = dest.z + exitDir[2] * exitOffset;
  if (!carryMomentum) { ball.v.x = ball.v.y = ball.v.z = 0; return; }
  const s = Math.hypot(ball.v.x, ball.v.y, ball.v.z);
  ball.v.x = exitDir[0] * s; ball.v.y = exitDir[1] * s; ball.v.z = exitDir[2] * s;
}

/**
 * Ballistic launch speed needed to travel `range` metres and land `dy` metres
 * higher, at `angle` above horizontal. Used to size the cannon (#50 → #51) and
 * to check the ski jump (#32 → #33) actually clears its gap.
 */
export function launchSpeed (range, dy, angle = Math.PI / 4, g = TUNING.GRAVITY) {
  const c = Math.cos(angle), t = Math.tan(angle);
  const denom = 2 * c * c * (range * t - dy);
  if (denom <= 0) return NaN;
  return Math.sqrt(g * range * range / denom);
}

/* ── dynamic bodies ───────────────────────────────────────────────────── */

/**
 * Descriptor for a moving collider (handoff §8). The host resolves these after
 * stepBall inside the same substep. `phase` is derived from stage time only —
 * never from Math.random or Date.now — so a daily seed replays identically
 * (handoff §5.2).
 */
export function body (shape, o) {
  return Object.assign({ shape, period: 3, phase: 0, surfaceVel: true }, o);
}

/**
 * World→local for a yaw-rotated box is the TRANSPOSE of local→world, not the
 * same matrix with a negated angle (handoff §8). Getting this backwards mirrors
 * the collider about the box axis and reads as a physics glitch, not a maths
 * error. Both directions are spelled out here so nobody has to re-derive them.
 */
export function worldToLocalYaw (dx, dz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [dx * c - dz * s, dx * s + dz * c];
}
export function localToWorldYaw (ox, oz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [ox * c + oz * s, -ox * s + oz * c];
}

/* ── self-tests ───────────────────────────────────────────────────────── */

export function behaviorSelfTests () {
  const t = [];
  const ok = (name, cond, detail) => t.push({ name, pass: !!cond, detail });

  // §11.3 — the whole point of the Latch
  const L = new Latch(0.25);
  let fires = 0;
  for (let i = 0; i < 120; i++) if (L.fire(true, 1 / 120)) fires++;
  ok('a latched impulse fires once, not once per substep', fires === 1, `fires=${fires}`);
  for (let i = 0; i < 40; i++) L.fire(false, 1 / 120);      // 0.33 s clear > rearm
  ok('a latch re-arms after the ball leaves', L.fire(true, 1 / 120) === true);

  // impulse maths
  const ball = { v: { x: 0, y: 0, z: 4 } };
  applyImpulse(ball, { mode: 'set', speed: 15 }, [0, 0, 1]);
  ok('boost mode "set" tops the ball up to the quoted speed', Math.abs(ball.v.z - 15) < 1e-9,
    `vz=${ball.v.z}`);
  applyImpulse(ball, { mode: 'set', speed: 15 }, [0, 0, 1]);
  ok('boost does not stack past its quoted speed', Math.abs(ball.v.z - 15) < 1e-9);
  applyImpulse(ball, { mode: 'add', speed: 20 }, [0, 0, 1]);
  ok('bumper mode "add" injects on top', Math.abs(ball.v.z - 35) < 1e-9, `vz=${ball.v.z}`);

  // §11.4 — the landing point must be outside the destination trigger
  const bl = { p: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 6 } };
  teleport(bl, { x: 5, y: 0, z: 5 }, [0, 0, 1], 1.2);
  const dist = Math.hypot(bl.p.x - 5, bl.p.y - 0, bl.p.z - 5);
  ok('teleport lands clear of the destination trigger', dist >= 1.0, `d=${dist.toFixed(2)}`);
  ok('teleport preserves speed', Math.abs(Math.hypot(bl.v.x, bl.v.y, bl.v.z) - 6) < 1e-9);

  // yaw transforms are transposes of each other
  const [lx, lz] = worldToLocalYaw(1, 0, 0.7);
  const [wx, wz] = localToWorldYaw(lx, lz, 0.7);
  ok('worldToLocalYaw and localToWorldYaw round-trip',
    Math.abs(wx - 1) < 1e-12 && Math.abs(wz) < 1e-12, `→(${wx.toFixed(6)}, ${wz.toFixed(6)})`);

  // env folding
  const env = resolveEnv([
    surface({ gripScale: 0.35 }),
    surface({ gripScale: 0.5, drag: 0.99 }),
    field({ accel: [2, 0, 0] }),
  ]);
  ok('gripScale multiplies across stacked surfaces', Math.abs(env.gripScale - 0.175) < 1e-12,
    `grip=${env.gripScale}`);
  ok('the tighter drag wins', env.drag === 0.99);
  ok('field acceleration reaches env.accel', env.accel.x === 2);

  // a belt must converge on its quoted speed, not run away to the clamp
  const belt = surface({ belt: [0, 0, -8], stiffness: 6 });
  const bb = { v: { x: 0, y: 0, z: 0 }, p: { x: 0, y: 0, z: 0 } };
  for (let i = 0; i < 600; i++) {
    const e = resolveEnv([belt], bb);
    bb.v.z += e.accel.z * (1 / 120);
  }
  ok('a conveyor settles at the speed it advertises', Math.abs(bb.v.z + 8) < 0.05,
    `vz=${bb.v.z.toFixed(3)} m/s (target −8)`);
  ok('the belt never exceeds the maze speed clamp', Math.abs(bb.v.z) <= TUNING.maxSpeed);

  // ballistics: the launch ramp must be able to clear its own gap
  const s = launchSpeed(6, 0, Math.PI / 4);
  ok('launchSpeed solves a 6 m level jump', Math.abs(s - Math.sqrt(TUNING.GRAVITY * 6)) < 1e-9,
    `v=${s.toFixed(2)} m/s`);
  ok('that launch speed is inside the speed clamp', s <= TUNING.maxSpeed,
    `${s.toFixed(2)} ≤ ${TUNING.maxSpeed}`);

  return t;
}

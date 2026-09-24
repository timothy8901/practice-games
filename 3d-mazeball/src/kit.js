/**
 * kit.js — the tile grid standard, the material table, and the path/profile
 * helpers every piece builder is written against.
 *
 * Sources reconciled here:
 *   • ENVIRONMENT_PIECES_DOCUMENTATION.md §2 (grid standard) and §3 (the 64-row
 *     friction / restitution / socket table)
 *   • PHYSICS-ENGINE-HANDOFF.md §3 (maze tuning column), §4.3 (corridor width),
 *     §2.4 (friction is GRIP, not Coulomb µ), §11 (bugs already paid for)
 *
 * Where the two disagree the reconciliation is recorded in DECISIONS at the
 * bottom of pieces.js and surfaced in the review page, because these are calls
 * a human should sign off on rather than find in a diff.
 */

/* ── grid standard (documentation §2) ─────────────────────────────────── */

export const TILE = 10.0;          // §2: 10 × 10 m tile — kept verbatim
export const HALF = TILE / 2;

/**
 * §2 specifies a 4.0 m track. The handoff (§3, §4.3) specifies a 0.35 m ball and
 * says to set corridor width from the ball, not the other way round: 6r = 2.1 m
 * is "comfortable", 9r = 3.15 m is "generous / tutorial". 4.0 m is 11.4r — wider
 * than the guide's own generous tier, which makes a maze read as an empty plain.
 * TRACK is therefore 2.4 m (6.9r). See decision D02.
 */
export const TRACK = 2.4;
export const TRACK_NARROW = 1.05;  // handoff §4.3 "playable minimum" = 3r
export const BALL_R = 0.35;        // handoff §3, maze column

/**
 * §2 specifies L1 = +3.0 m, L2 = +6.0 m. Over a 10 m tile that is 16.7° and 31°.
 * Max tilt acceleration is g·sin(MAX_TILT) = 18·sin(0.30) = 5.32 m/s²; gravity
 * down a 16.7° slope is 5.17 m/s². The *gentle* ramp would have been
 * unclimbable from rest and the steep one impossible.
 *
 * The ceiling is arithmetic, not taste. A single-tile climb needs its steepest
 * point under ~12.5° to leave a usable 1.4 m/s² of net uphill acceleration, and
 * with the 10% shoulders every ramp needs to meet its neighbours flat, that caps
 * the rise at 2.0 m over a 10 m run. Steps are therefore +1.0 m and +2.0 m.
 * See decision D03.
 */
export const LEVELS = [0.0, 1.0, 2.0];
export const DECK_T = 0.32;        // deck thickness
/**
 * Kerb height, and it is not a cosmetic number.
 *
 * To hop a kerb the ball must lift its centre by the kerb height, which needs
 * `v_lateral ≥ √(2·g·h)`. At h = 0.30 that is 3.3 m/s — well inside what the
 * ball picks up crossing a 2.4 m corridor — so ordinary corridors did not
 * contain it and the follow-the-path bot fell out 61 times a run.
 *
 * At h = 0.55 the bar is 4.45 m/s, while the most lateral speed full tilt can
 * build across half a corridor is √(2·5.32·1.2) = 3.57 m/s. So a corridor with
 * kerbs now genuinely holds the ball, and the pieces that are *supposed* to drop
 * you — the razor plank, the sharp corner, the rails — still do, because they
 * have no kerb at all. See decision D08.
 */
export const KERB_H = 0.55;
export const RAIL_H = 0.62;        // full rail: contains a ball at maxSpeed
export const RAIL_T = 0.20;

/* Physics constants the kit was authored against (handoff §3, maze column). */
export const TUNING = {
  GRAVITY: 18,
  MAX_TILT: 0.30,
  FIXED: 1 / 120,
  maxSpeed: 14,
  drag: 0.997,
  relaxPasses: 3,
  hitsBreak: 16,
  tiltEase: 11,
};

/** Max acceleration the player can command, m/s². */
export const MAX_ACCEL = TUNING.GRAVITY * Math.sin(TUNING.MAX_TILT);

/* ── directions ───────────────────────────────────────────────────────── */

export const DIRS = ['N', 'E', 'S', 'W'];
export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DELTA = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Outward unit vector of an edge, in piece-local space (+X east, +Z south). */
export const EDGE_VEC = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

/** Mid-point of an edge at elevation level `lvl`. */
export function edgePoint (dir, lvl = 0) {
  const [dx, dz] = EDGE_VEC[dir];
  return { x: dx * HALF, y: LEVELS[lvl], z: dz * HALF };
}

export function rotateDir (dir, rot) {
  return DIRS[(DIRS.indexOf(dir) + (rot % 4) + 4) % 4];
}

/* ── materials ────────────────────────────────────────────────────────── */

/**
 * `friction` here is the solver's GRIP coefficient, not a Coulomb µ
 * (handoff §2.4). The documentation's µ column happens to already be ordered as
 * grip — 0.05 ice, 0.95 melted cheese — so the numbers transfer verbatim onto
 * the rolling surface of each piece. See decision D01.
 *
 * `bounce` is restitution and MUST stay below 1: the solver applies
 * v += n·(1+e)·|vn| per contact, so e > 1 injects energy on every bounce and
 * the ball accelerates without bound. The documentation lists e = 1.80 for the
 * pinball bumper and 1.20 for the mouse-trap; those are re-expressed as a
 * latched one-shot impulse in behaviors.js. See decision D04.
 */
export const RESTITUTION_MAX = 0.95;

/** Shared, non-rolling materials. `track` is synthesised per piece. */
export const MATERIALS = {
  /* structural */
  rail:     { color: '#8d9aa8', friction: 0.35, bounce: 0.25, roughness: 0.4 },
  wall:     { color: '#6f7d8c', friction: 0.45, bounce: 0.30, roughness: 0.7 },
  rubber:   { color: '#3b4048', friction: 0.75, bounce: 0.80, roughness: 0.9 },
  steel:    { color: '#aab4c0', friction: 0.30, bounce: 0.05, roughness: 0.3 },
  stone:    { color: '#7c7a76', friction: 0.55, bounce: 0.15, roughness: 0.9 },
  timber:   { color: '#8a6a4a', friction: 0.55, bounce: 0.10, roughness: 0.85 },
  under:    { color: '#4a5058', friction: 0.40, bounce: 0.10, roughness: 0.8 },

  /* hazards + gimmicks that the ball touches */
  hazard:   { color: '#e0483c', friction: 0.40, bounce: 0.55, roughness: 0.5 },
  bumper:   { color: '#ff4d5e', friction: 0.20, bounce: 0.62, roughness: 0.3 },
  spring:   { color: '#ff5fa2', friction: 0.10, bounce: 0.95, roughness: 0.4 },
  cheese:   { color: '#f2c227', friction: 0.85, bounce: 0.05, roughness: 0.85 },
  magnet:   { color: '#5f7fd8', friction: 0.20, bounce: 0.10, roughness: 0.4 },

  /* decoration only — never collides */
  glass:    { color: '#bfe6ff', deco: true, opacity: 0.28 },
  glow:     { color: '#ffd93a', deco: true, emissive: 0.85 },
  glowBlue: { color: '#3ec6ff', deco: true, emissive: 0.85 },
  glowRed:  { color: '#ff3b3b', deco: true, emissive: 0.85 },
  slime:    { color: '#6fd36b', deco: true, emissive: 0.30, opacity: 0.85 },
  water:    { color: '#3aa8d8', deco: true, emissive: 0.20, opacity: 0.70 },
  marker:   { color: '#f5f5f5', deco: true, emissive: 0.15 },
};

/** Resolve a material key against a piece (so `track` picks up its surface). */
export function resolveMaterial (key, piece) {
  if (key === 'track') {
    return {
      color: piece?.color || '#c39a63',
      friction: piece?.surface.friction ?? 0.5,
      bounce: piece?.surface.bounce ?? 0.2,
      roughness: 0.75,
    };
  }
  return MATERIALS[key] || MATERIALS.stone;
}

/** True when this material key is decoration and must never collide. */
export const isDeco = key => !!(MATERIALS[key] && MATERIALS[key].deco);

/* ── path builders ────────────────────────────────────────────────────── */

/** Straight line of `n` stations from a to b, optional constant `up`. */
export function pathLine (a, b, n = 8, up = null) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      up,
    });
  }
  return out;
}

/** Smoothstep. Kept for anything that wants a genuinely S-shaped blend. */
export const smooth = t => t * t * (3 - 2 * t);

/**
 * Height blend for a ramp: flat at both ends, constant grade in between.
 *
 * Smoothstep looks right and plays wrong. Its peak slope is 1.5× the mean, so a
 * 2.4 m climb across a 10 m tile — a 13.5° average, comfortably inside the
 * 17° the player can command — hits 19.8° in the middle, where gravity pulls
 * 6.1 m/s² against 5.32 m/s² of tilt and the ball simply stops. The
 * follow-the-path bot crawled at 0.4 m/s and timed out; nothing about the
 * geometry looked wrong.
 *
 * With `s = 0.1` shoulders the peak is 1.11× the mean instead of 1.5×, and both
 * ends still meet a neighbouring tile flat.
 */
export const SHOULDER = 0.1;
export function shoulderEase (t, s = SHOULDER) {
  const k = 2 * s * (1 - s);
  if (t < s) return (t * t) / k;
  if (t > 1 - s) return 1 - ((1 - t) * (1 - t)) / k;
  return (t - s / 2) / (1 - s);
}

/** The steepest grade a shouldered ramp of `rise` over `run` actually reaches. */
export const peakGrade = (rise, run, s = SHOULDER) => Math.atan((rise / run) / (1 - s));

/** Line whose height eases in and out — a ramp that meets both edges flat. */
export function pathRamp (a, b, n = 18) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      y: a.y + (b.y - a.y) * shoulderEase(t),
      up: null,
    });
  }
  return out;
}

/**
 * Arc in XZ about (cx, cz), angles in radians measured from +X toward +Z.
 * `bank` rolls the frame's up-vector outward by that many radians at mid-arc,
 * eased in and out, which is how the banked turn and the helix are built.
 */
export function pathArc (cx, cz, r, a0, a1, y0 = 0, y1 = 0, n = 20, bank = 0) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    let up = null;
    if (bank) {
      // ease the bank in and out so the entry and exit are flat
      const k = Math.sin(Math.PI * t) * bank;
      const ox = Math.cos(a), oz = Math.sin(a);           // outward radial
      const s = Math.sin(k), c = Math.cos(k);
      up = [-ox * s, c, -oz * s];
    }
    out.push({ x, y: y0 + (y1 - y0) * t, z, up });
  }
  return out;
}

/** Multi-turn helix — pathArc with a wide angular span. */
export function pathHelix (cx, cz, r, a0, turns, y0, y1, n = 48, bank = 0) {
  return pathArc(cx, cz, r, a0, a0 + turns * Math.PI * 2, y0, y1, n, bank);
}

/**
 * Centripetal Catmull-Rom through control points — the S-curves, the doglegs,
 * the Y fork and the climbing loops.
 *
 * Uniform Catmull-Rom (α = 0) overshoots badly wherever the control spacing is
 * uneven: the first version of #13 bulged 0.9 m past the tile edge and the
 * footprint test caught it. α = 0.5 is the standard fix — it cannot cusp or
 * self-intersect between control points. Endpoints get reflected phantom
 * points so the curve leaves and arrives along the segment direction.
 */
export function pathSpline (pts, n = 28, alpha = 0.5) {
  const V = p => [p.x, p.y ?? 0, p.z];
  const raw = pts.map(V);
  const first = [2 * raw[0][0] - raw[1][0], 2 * raw[0][1] - raw[1][1], 2 * raw[0][2] - raw[1][2]];
  const L = raw.length;
  const last = [
    2 * raw[L - 1][0] - raw[L - 2][0],
    2 * raw[L - 1][1] - raw[L - 2][1],
    2 * raw[L - 1][2] - raw[L - 2][2],
  ];
  const C = [first, ...raw, last];
  const segs = L - 1;
  const out = [];

  const knot = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-6, alpha);
  const lerp = (a, b, s) => [
    a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s,
  ];

  for (let i = 0; i <= n; i++) {
    const u = (i / n) * segs;
    const k = Math.min(segs - 1, Math.floor(u));
    const s = u - k;
    const p0 = C[k], p1 = C[k + 1], p2 = C[k + 2], p3 = C[k + 3];
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const t = t1 + (t2 - t1) * s;
    const A1 = lerp(p0, p1, (t - t0) / (t1 - t0));
    const A2 = lerp(p1, p2, (t - t1) / (t2 - t1));
    const A3 = lerp(p2, p3, (t - t2) / (t3 - t2));
    const B1 = lerp(A1, A2, (t - t0) / (t2 - t0));
    const B2 = lerp(A2, A3, (t - t1) / (t3 - t1));
    const p = lerp(B1, B2, (t - t1) / (t2 - t1));
    out.push({ x: p[0], y: p[1], z: p[2], up: null });
  }
  return out;
}

/* ── cross-section profiles ───────────────────────────────────────────── */

/** Flat deck of width w. */
export const profDeck = (w = TRACK) => [[-w / 2, 0], [w / 2, 0]];

/** Deck with a lip on both sides. */
export function profKerb (w = TRACK, h = KERB_H, t = RAIL_T) {
  return [
    [-w / 2 - t, h], [-w / 2 - t, 0], [-w / 2, 0],
    [w / 2, 0], [w / 2 + t, 0], [w / 2 + t, h],
  ];
}

/**
 * Deck with a full-height wall on both sides.
 *
 * profKerb traces up the outer face, so the sweep's skirt closes the wall
 * cleanly only while the wall is about as tall as the deck is thick. For a wall
 * taller than `DECK_T` use a flat deck profile plus `railBar()`, which sweeps a
 * closed box and cannot leave an open face — an earlier one-sided wall profile
 * left the outer face hanging and rendered as a sawtooth.
 */
export const profWalls = (w = TRACK, h = RAIL_H) => profKerb(w, h);

/** Concave U channel — the half-pipe. */
export function profTrough (w = TRACK * 1.6, depth = 1.1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = -1 + 2 * (i / n);
    out.push([t * w / 2, depth * (t * t)]);
  }
  return out;
}

/** Parabolic bank rising on the outer (+lateral) side only. */
export function profBank (w = TRACK * 1.5, rise = 1.5, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([-w / 2 + t * w, rise * t * t]);
  }
  return out;
}

/** Closed circle — a pipe or tube. */
export function profTube (r = 0.5, n = 12) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/** Closed half-round rail cap — a pipe you roll on top of. */
export function profRailRound (r = 0.25, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n);
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/* ── shared decorations ───────────────────────────────────────────────── */

/** Thin stripe laid on the deck, decoration only. Handoff §11.5: float it. */
export function stripe (m, x, z, sx, sz, y, mat = 'marker', color) {
  m.box(x, y + 0.02, z, sx, 0.02, sz, mat, { color, collide: false });
}

/**
 * Support pylons under an elevated deck. Decoration — the ball can never reach
 * them, and making them collide only risks catching it on a corner.
 */
export function pylons (m, stations, y0 = -0.2, mat = 'under') {
  for (const s of stations) {
    const h = s.y - y0;
    if (h <= 0.15) continue;
    m.cyl(s.x, y0, s.z, 0.16, 0.16, h, mat, { seg: 8, collide: false, color: '#3f454d' });
  }
}

/**
 * Socket stubs: a short length of deck at each open edge so two neighbouring
 * pieces overlap rather than meet on a hairline. Handoff §4.2 — "do not leave
 * T-junction cracks; overlap by a few centimetres".
 */
export const STUB = 0.12;

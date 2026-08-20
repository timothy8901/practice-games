/**
 * pieces.js — the 64 modular environmental pieces.
 *
 * Every piece is real 3-D geometry whose render buffers and collision triangles
 * come out of the same mesher pass (handoff §4.4), carries the sockets and the
 * friction / restitution the documentation tabulates, and declares its runtime
 * behaviour as data.
 *
 * Sources:
 *   • ENVIRONMENT_PIECES_DOCUMENTATION.md §2 (grid), §3 (the 64-row table)
 *   • PHYSICS-ENGINE-HANDOFF.md          §3 (tuning), §4 (collider + geometry
 *                                        rules), §5 (maze guidance), §11 (bugs)
 *
 * The documentation's numbers are transcribed verbatim into `docSurface`.
 * `surface` is what the solver is actually given. Where they differ the reason
 * is a DECISIONS entry, and the review page shows both columns side by side so
 * the difference is reviewed rather than discovered.
 *
 * Local space: tile centred on the origin, +X east, +Z south, Y up, north = −Z.
 */

import { Mesher } from './mesher.js';
import {
  TILE, HALF, TRACK, TRACK_NARROW, BALL_R, LEVELS, DECK_T, KERB_H, RAIL_H, RAIL_T,
  TUNING, MAX_ACCEL, RESTITUTION_MAX, STUB, KERB_H as KERB,
  pathLine, pathRamp, pathArc, pathSpline, shoulderEase, peakGrade,
  profDeck, profKerb, profWalls, profTrough, profTube,
  pylons, stripe, resolveMaterial,
} from './kit.js';
import { surface, impulse, field, trigger, body, launchSpeed } from './behaviors.js';

/* ── categories ───────────────────────────────────────────────────────── */

export const CATEGORIES = [
  { id: 1, name: 'Basic Straight Paths', range: [1, 8], focus: 'Foundation corridors, momentum control, surface friction.', accent: '#b5651d' },
  { id: 2, name: 'Turns & Curves', range: [9, 16], focus: 'Angular momentum, centrifugal force, drifting.', accent: '#2f7fbf' },
  { id: 3, name: 'Intersections & Junctions', range: [17, 24], focus: 'Maze branching, decision nodes, dynamic state.', accent: '#d4a017' },
  { id: 4, name: 'Ramps, Slopes & Elevations', range: [25, 32], focus: 'Verticality, potential energy, gravity acceleration.', accent: '#5b9c46' },
  { id: 5, name: 'Gaps, Bridges & Rails', range: [33, 40], focus: 'Airtime, precision balancing, timing, suspension.', accent: '#e0713c' },
  { id: 6, name: 'Obstacles & Hazards', range: [41, 48], focus: 'Punishment, active timing hazards, deflection.', accent: '#d94a3d' },
  { id: 7, name: 'Gimmicks & Interactive', range: [49, 56], focus: 'Physics-defying mechanics, warps, scale alteration.', accent: '#7a4fa3' },
  { id: 8, name: 'Special & Objectives', range: [57, 64], focus: 'Level flow, progression anchors, daily puzzle goals.', accent: '#c9a227' },
];

/* ── shared geometry helpers ──────────────────────────────────────────── */

const Z_S = HALF, Z_N = -HALF, X_E = HALF, X_W = -HALF;
const OAK = '#c39a63', OAK_DARK = '#9a7546';

/** Extrapolate a path a little past both ends so neighbours overlap (§4.2). */
function extend (path, len = STUB) {
  const n = path.length;
  if (n < 2) return path;
  const unit = (a, b) => {
    const d = [b.x - a.x, b.y - a.y, b.z - a.z];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    return [d[0] / L, d[1] / L, d[2] / L];
  };
  const a = path[0], a2 = path[1], b2 = path[n - 2], b = path[n - 1];
  const di = unit(a2, a), dof = unit(b2, b);
  return [
    { x: a.x + di[0] * len, y: a.y + di[1] * len, z: a.z + di[2] * len, up: a.up },
    ...path,
    { x: b.x + dof[0] * len, y: b.y + dof[1] * len, z: b.z + dof[2] * len, up: b.up },
  ];
}

/** The standard deck sweep: rolling surface on top, structural skirt beneath. */
function deck (m, path, o = {}) {
  const w = o.w ?? TRACK;
  if (o.route !== false) m.addRoute(path, w);
  const prof = o.prof || profDeck(w);
  m.sweep(extend(path, o.stub ?? STUB), prof, o.mat || 'track', {
    thickness: o.t ?? DECK_T,
    color: o.color || OAK,
    sideMat: o.sideMat || 'under',
    sideColor: o.sideColor || '#454b53',
    capEnds: o.capEnds !== false,
    collide: o.collide !== false,
  });
  if (o.pylons !== false) {
    pylons(m, path.filter((_, i) => i % Math.max(1, Math.round(path.length / 4)) === 0));
  }
}

/** South edge → north edge, optionally climbing between two elevation levels. */
function sn (l0 = 0, l1 = null, n = 14) {
  const y0 = LEVELS[l0], y1 = LEVELS[l1 === null ? l0 : l1];
  return y0 === y1
    ? pathLine({ x: 0, y: y0, z: Z_S }, { x: 0, y: y1, z: Z_N }, n)
    : pathRamp({ x: 0, y: y0, z: Z_S }, { x: 0, y: y1, z: Z_N }, n);
}

/**
 * A south→north route that bends through `interior` control points but leaves
 * and arrives dead straight, normal to the edge.
 *
 * The straight tails are not cosmetic. A spline taken all the way to the tile
 * edge overshoots it — the first pass on #13 ran 0.97 m past the boundary and
 * the footprint test caught it — and it arrives at an angle, so two neighbours
 * meet with a kink. Splining only the middle 7.2 m fixes both.
 */
function throughSN (interior, n = 30) {
  const zIn = 3.6, zOut = -3.6;
  const ctrl = [
    { x: 0, z: zIn + 0.9 }, { x: 0, z: zIn },
    ...interior,
    { x: 0, z: zOut }, { x: 0, z: zOut - 0.9 },
  ];
  const mid = pathSpline(ctrl, n).filter(p => p.z <= zIn + 1e-6 && p.z >= zOut - 1e-6);
  return [
    ...pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: zIn }, 4).slice(0, -1),
    ...mid,
    ...pathLine({ x: 0, y: 0, z: zOut }, { x: 0, y: 0, z: Z_N }, 4).slice(1),
  ];
}

/** A short spur from an edge to the tile centre, used to build junctions. */
function spur (dir, y = 0, to = 0, n = 6) {
  const ends = { N: { x: 0, z: Z_N }, S: { x: 0, z: Z_S }, E: { x: X_E, z: 0 }, W: { x: X_W, z: 0 } };
  const e = ends[dir];
  const tx = e.x === 0 ? 0 : Math.sign(e.x) * to;
  const tz = e.z === 0 ? 0 : Math.sign(e.z) * to;
  return pathLine({ x: e.x, y, z: e.z }, { x: tx, y, z: tz }, n);
}

/** Square landing pad at the tile centre. */
function pad (m, half = TRACK * 0.75, y = 0, o = {}) {
  m.polyPrism(
    [[-half, -half], [half, -half], [half, half], [-half, half]],
    y, o.t ?? DECK_T, o.mat || 'track',
    { color: o.color || OAK, sideColor: '#454b53', collide: o.collide !== false },
  );
}

/**
 * A rail or wall running alongside a path, offset by `lateral` in the path's
 * own frame — so on a banked turn it leans with the deck instead of standing
 * vertically out of it. The profile is closed, which is what keeps every face
 * of a tall wall solid.
 */
function railBar (m, path, lateral, h = RAIL_H, mat = 'rail', color, t = RAIL_T) {
  const n = path.length;
  const shifted = path.map((p, i) => {
    const prev = path[Math.max(0, i - 1)], next = path[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x, ty = next.y - prev.y, tz = next.z - prev.z;
    const L = Math.hypot(tx, ty, tz) || 1; tx /= L; ty /= L; tz /= L;
    const u = p.up || [0, 1, 0];
    let rx = ty * u[2] - tz * u[1], ry = tz * u[0] - tx * u[2], rz = tx * u[1] - ty * u[0];
    const RL = Math.hypot(rx, ry, rz) || 1; rx /= RL; ry /= RL; rz /= RL;
    return { x: p.x + rx * lateral, y: p.y + ry * lateral, z: p.z + rz * lateral, up: u };
  });
  m.sweep(extend(shifted), [[-t / 2, 0], [t / 2, 0], [t / 2, h], [-t / 2, h]], mat, {
    closedProfile: true, color: color || '#8d9aa8', collide: true,
  });
}

/** Open void surround so the tile footprint reads at a glance. Decoration. */
function footprint (m) {
  if (m._footprint) return;                                 // idempotent
  m._footprint = true;
  const h = HALF;
  const y = -0.9;
  for (const [a, b] of [[[-h, -h], [h, -h]], [[h, -h], [h, h]], [[h, h], [-h, h]], [[-h, h], [-h, -h]]]) {
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const sx = Math.abs(b[0] - a[0]) || 0.06, sz = Math.abs(b[1] - a[1]) || 0.06;
    m.box(mx, y, mz, sx, 0.05, sz, 'marker', { color: '#2b3138', collide: false });
  }
}

/* ── the registry ─────────────────────────────────────────────────────── */

const P = [];

/**
 * @param id        1..64, matching the documentation and the sprite atlas
 * @param key       filename stem from documentation §5
 * @param name      display name
 * @param cat       category id
 * @param sockets   { N|S|E|W: elevationLevelIndex } — absent means closed
 * @param docFric   documentation §3 friction column, verbatim
 * @param docRest   documentation §3 restitution column, verbatim
 * @param desc      documentation §3 gameplay role, verbatim
 * @param o         { color, behaviours, air, pairWith, notes, build }
 */
function def (id, key, name, cat, sockets, docFric, docRest, desc, o = {}) {
  // `o.restitution` is the value the solver is actually handed where the
  // documented one is illegal. Falling back to the global ceiling would leave
  // the bumper's surrounding deck at e = 0.95 — a trampoline floor nobody asked
  // for — so the two clamped pieces name their own replacement.
  const rest = o.restitution ?? Math.min(docRest, RESTITUTION_MAX);
  P.push({
    id,
    key,
    name,
    cat,
    sprite: `${String(id).padStart(2, '0')}_${key}.jpg`,
    sockets,
    docSurface: { friction: docFric, bounce: docRest },
    surface: { friction: docFric, bounce: rest },
    clamped: rest !== docRest,
    desc,
    color: o.color || OAK,
    air: o.air || null,
    pairWith: o.pairWith || null,
    behaviours: o.behaviours || [],
    bodies: o.bodies || [],
    notes: o.notes || [],
    decisions: o.decisions || [],
    build: o.build,
  });
}

/* ══ Category 1 · Basic Straight Paths (#01–#08) ═══════════════════════ */

def(1, 'straight_wide', 'Straight Track (Wide)', 1, { S: 0, N: 0 }, 0.50, 0.20,
  'Standard oak plank corridor. Neutral friction; baseline control section.', {
    color: OAK,
    build (m) {
      const p = sn();
      deck(m, p, { w: TRACK * 1.25, prof: profKerb(TRACK * 1.25), color: OAK });
      for (let i = 0; i < 11; i++) {                       // plank seams
        stripe(m, 0, Z_N + 0.5 + i * 0.92, TRACK * 1.25 - 0.1, 0.07, 0, 'marker', OAK_DARK);
      }
    },
  });

def(2, 'straight_razor', 'Straight Plank (Narrow)', 1, { S: 0, N: 0 }, 0.45, 0.10,
  'Ultra-narrow beam with no side railings. High precision required to prevent falling.', {
    color: '#b98d55',
    notes: [`Deck is ${TRACK_NARROW.toFixed(2)} m = 3r, the handoff §4.3 "playable minimum". Anything narrower is unfair under tilt control.`],
    build (m) {
      deck(m, sn(), { w: TRACK_NARROW, color: '#b98d55', t: 0.26 });
      stripe(m, 0, 0, 0.06, TILE, 0, 'marker', '#8a6a3f');
    },
  });

def(3, 'straight_gap', 'Dashed Gap Track', 1, { S: 0, N: 0 }, 0.50, 0.15,
  'Intermittent floor gaps. Requires sufficient forward velocity to skip across.', {
    color: OAK,
    notes: ['Gaps are 0.9 m. A ball entering at 4 m/s falls ~0.11 m across one — it clears. Below ~2.5 m/s it drops in.'],
    build (m) {
      const segs = [[-5.1, -3.6], [-2.7, -1.2], [-0.3, 1.2], [2.1, 3.6], [4.5, 5.1]];
      for (const [z0, z1] of segs) {
        deck(m, pathLine({ x: 0, y: 0, z: z1 }, { x: 0, y: 0, z: z0 }, 3),
          { w: TRACK, color: OAK, stub: 0.02, pylons: false });
      }
      pylons(m, [{ x: 0, y: 0, z: -4.3 }, { x: 0, y: 0, z: 0.4 }, { x: 0, y: 0, z: 4.8 }]);
    },
  });

def(4, 'straight_boost', 'Speed Boost Panel', 1, { S: 0, N: 0 }, 0.30, 0.30,
  'Green directional arrows. Imparts an immediate +15 m/s forward linear force vector.', {
    color: '#2fa84f',
    behaviours: [impulse({ effect: 'boost', mode: 'set', speed: 15, dir: 'travel', rearm: 0.4 })],
    notes: [
      'The +15 m/s the documentation quotes exceeds the maze speed clamp of 14 m/s (handoff §3) — the solver clamps it back on the same substep, so the panel reads as "instantly at top speed".',
      'Latched: applying this while grounded would fire 120×/s and become a rocket (handoff §11.3).',
    ],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#2fa84f' });
      for (let i = 0; i < 3; i++) {                        // three chevrons pointing north
        const z = 2.6 - i * 2.6;
        for (const s of [-1, 1]) {
          m.box(s * 0.52, 0.03, z + 0.35, 0.95, 0.03, 0.26, 'glow',
            { color: '#f2fff2', collide: false });
        }
        m.box(0, 0.03, z - 0.25, 0.5, 0.03, 0.85, 'glow', { color: '#f2fff2', collide: false });
      }
    },
  });

def(5, 'straight_sticky', 'Sticky Cheese Track', 1, { S: 0, N: 0 }, 0.95, 0.00,
  'Melted cheddar surface. Drastically slows down ball rolling speed and suppresses bounce.', {
    color: '#e8b93a',
    behaviours: [surface({ effect: 'sticky', gripScale: 1.0, drag: 0.965, maxSpeed: 5.5 })],
    notes: ['Handoff §5.3: one high-grip patch in front of a turn is worth ten extra maze cells.'],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#e8b93a' });
      // Melted puddles, not boulders. As collidable 0.5 m spheres these wedged
      // the ball against them: this surface has drag 0.965 and a 2.5 m/s
      // terminal speed, so it can never build the momentum to climb one, and
      // the follow-the-path bot stalled here for its whole time budget.
      const blobs = [[-0.6, -3.4, 0.5], [0.5, -1.9, 0.34], [-0.2, -0.3, 0.6], [0.7, 1.4, 0.4],
        [-0.7, 2.8, 0.45], [0.2, 4.1, 0.3]];
      for (const [x, z, r] of blobs) {
        m.cyl(x, 0.005, z, r, r * 0.82, 0.055, 'cheese',
          { seg: 14, color: '#f7d34e', collide: false });
      }
    },
  });

def(6, 'straight_conveyor_fwd', 'Conveyor Belt (Forward)', 1, { S: 0, N: 0 }, 0.60, 0.10,
  'Active mechanical tread pushing the ball forward at constant +8 m/s.', {
    color: '#4c545e',
    behaviours: [surface({ effect: 'belt', belt: [0, 0, -8], stiffness: 6 })],
    notes: ['Modelled as a belt velocity the friction impulse chases, not a raw acceleration — a raw +8 m/s² would run the ball to the speed clamp instead of settling at 8 m/s.'],
    build (m) { conveyor(m, -1); },
  });

def(7, 'straight_conveyor_rev', 'Conveyor Belt (Reverse)', 1, { S: 0, N: 0 }, 0.60, 0.10,
  'Opposing mechanical tread pushing ball backward at −8 m/s. Requires steep tilt.', {
    color: '#5a4c4c',
    behaviours: [surface({ effect: 'belt', belt: [0, 0, 8], stiffness: 6 })],
    notes: [`Max commandable acceleration is ${MAX_ACCEL.toFixed(2)} m/s² (handoff §3); the belt must be beatable, so it is modelled as a velocity target rather than an equal-and-opposite force.`],
    build (m) { conveyor(m, 1); },
  });

function conveyor (m, sign) {
  const col = sign < 0 ? '#4c545e' : '#5a4c4c';
  deck(m, sn(), { w: TRACK * 1.25, prof: profKerb(TRACK * 1.25), color: col });
  for (let i = 0; i < 14; i++) {                            // tread ribs
    stripe(m, 0, -4.7 + i * 0.72, TRACK * 1.25 - 0.14, 0.16, 0, 'marker', '#2c3238');
  }
  const hw = TRACK * 0.62;
  for (const z of [-4.4, 4.4]) {                            // end rollers, axis across the belt
    m.tube([-hw, 0.02, z], [hw, 0.02, z], 0.26, 'steel',
      { seg: 12, collide: false, color: '#9aa4b0' });
  }
  const arrow = sign < 0 ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    m.box(0, 0.05, arrow * (2.4 - i * 2.4), 0.34, 0.03, 1.1, 'glow',
      { color: sign < 0 ? '#7bf59a' : '#ff8a8a', collide: false });
  }
}

def(8, 'straight_ice', 'Slick Ice Track', 1, { S: 0, N: 0 }, 0.05, 0.05,
  'Polished glacier ice. Extremely low traction; high drifting momentum.', {
    color: '#bfe6ff',
    behaviours: [surface({ effect: 'ice', gripScale: 1.0, drag: 0.9995 })],
    notes: ['grip 0.05 is fed straight into the slip impulse (handoff §2.3), so the ball keeps its heading and drifts — no separate "ice" code path.'],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.25, prof: profKerb(TRACK * 1.25, KERB_H * 0.7), color: '#bfe6ff' });
      for (const [x, z, a] of [[-0.5, -3, 0.5], [0.6, 0.4, -0.4], [-0.3, 3.2, 0.35]]) {
        m.boxYaw(x, 0.03, z, 0.09, 0.02, 2.2, a, 'marker', { color: '#ffffff', collide: false });
      }
    },
  });

/* ══ Category 2 · Turns & Curves (#09–#16) ═════════════════════════════ */

/** Quarter arc from the S edge to the E edge, radius r about (HALF, HALF). */
const turnSE = (r = HALF, y = 0, n = 22, bank = 0) =>
  pathArc(HALF, HALF, r, Math.PI, Math.PI * 1.5, y, y, n, bank);

def(9, 'turn_90_wide', '90° Turn (Wide)', 2, { S: 0, E: 0 }, 0.50, 0.20,
  'Standard right-angle curve with outer protective rail bumper.', {
    color: OAK,
    build (m) {
      const p = turnSE();
      deck(m, p, { w: TRACK * 1.2, color: OAK });
      railBar(m, p, -(TRACK * 1.2) / 2 - RAIL_T / 2);       // outer rail only
      footprint(m);
    },
  });

def(10, 'turn_90_sharp', '90° Turn (Sharp)', 2, { S: 0, E: 0 }, 0.40, 0.10,
  'Sharp unbanked corner without railing. Over-speeding causes centrifugal ejection.', {
    color: '#b98d55',
    notes: [`Corner radius 1.9 m. Centripetal demand at 6 m/s is v²/r = ${(36 / 1.9).toFixed(1)} m/s², well past the ${MAX_ACCEL.toFixed(1)} m/s² the player can command — so it must be taken slow. That is the piece.`],
    build (m) {
      const p = pathSpline([
        { x: 0, z: Z_S }, { x: 0, z: 1.9 }, { x: 1.9, z: 0 }, { x: X_E, z: 0 },
      ], 26);
      deck(m, p, { w: TRACK, color: '#b98d55' });
      footprint(m);
    },
  });

def(11, 'curve_45_left', '45° Curve (Left)', 2, { S: 0, N: 0 }, 0.50, 0.20,
  'Gentle angled left transition for organic maze winding paths.', {
    color: OAK,
    decisions: ['D05'],
    notes: ['Documentation lists the exit socket as NW. A square lattice has no NW port, so this is a dogleg: enters S centred, bows west, exits N centred. Grid contract preserved, gameplay intent preserved.'],
    build (m) {
      deck(m, throughSN([{ x: -0.8, z: 1.6 }, { x: -1.6, z: -1.0 }]),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      footprint(m);
    },
  });

def(12, 'curve_45_right', '45° Curve (Right)', 2, { S: 0, N: 0 }, 0.50, 0.20,
  'Gentle angled right transition for organic maze winding paths.', {
    color: OAK,
    decisions: ['D05'],
    notes: ['Mirror of #11. Documentation lists NE; implemented as a centred S→N dogleg bowing east.'],
    build (m) {
      deck(m, throughSN([{ x: 0.8, z: 1.6 }, { x: 1.6, z: -1.0 }]),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      footprint(m);
    },
  });

def(13, 's_curve_left_right', 'S-Curve (Left-Right)', 2, { S: 0, N: 0 }, 0.50, 0.20,
  'Rapid dual-bend chicane requiring quick left-to-right counter-tilting.', {
    color: OAK,
    build (m) {
      deck(m, throughSN([{ x: -1.5, z: 1.9 }, { x: 1.5, z: -1.9 }], 36),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      footprint(m);
    },
  });

def(14, 's_curve_right_left', 'S-Curve (Right-Left)', 2, { S: 0, N: 0 }, 0.50, 0.20,
  'Reverse chicane shifting path right then left.', {
    color: OAK,
    build (m) {
      deck(m, throughSN([{ x: 1.5, z: 1.9 }, { x: -1.5, z: -1.9 }], 36),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      footprint(m);
    },
  });

def(15, 'u_turn_180', '180° Hairpin U-Turn', 2, { S: 0 }, 0.55, 0.25,
  'Tight half-circle track that fully reverses the direction of movement.', {
    color: OAK,
    decisions: ['D06'],
    notes: ['Both of this piece\'s ports are on the S edge, at lanes ±1.4 m. It is the only piece in the kit that needs a two-lane edge, so it mates with a double-wide corridor mouth, not a standard S port.'],
    build (m) {
      const lane = 1.4;
      // The half-circle must bulge NORTH (a = π → 2π). Sweeping π → 0 curls it
      // back over the two straights instead, which reads as a broken figure-8.
      const p = [
        ...pathLine({ x: -lane, y: 0, z: Z_S }, { x: -lane, y: 0, z: -1.1 }, 6),
        ...pathArc(0, -1.1, lane, Math.PI, Math.PI * 2, 0, 0, 22),
        ...pathLine({ x: lane, y: 0, z: -1.1 }, { x: lane, y: 0, z: Z_S }, 6),
      ];
      deck(m, p, { w: TRACK * 0.92, prof: profKerb(TRACK * 0.92), color: OAK });
      footprint(m);
    },
  });

def(16, 'turn_banked', 'Banked Wall Turn', 2, { S: 0, E: 0 }, 0.40, 0.40,
  'Tilted parabolic wall allows high-speed centrifugal wall-riding.', {
    color: '#a7734a',
    notes: [
      'The bank is a roll of the sweep frame, not a fixed wedge in the cross-section: it eases from flat at the S port to 31° at mid-arc and back to flat at the E port, so both neighbours still meet a level deck.',
      'A wedge profile looked identical in the viewer but left the deck centre 0.38 m above the socket at both ports — the socket-reachability probe is what separated the two.',
    ],
    build (m) {
      const w = TRACK * 1.3;
      const p = turnSE(HALF, 0, 40, 0.32);  // flat shading fans badly on a banked surface below ~40
      m.addRoute(p, w);
      m.sweep(extend(p), profDeck(w), 'track', {
        thickness: DECK_T, color: '#a7734a', sideMat: 'under', sideColor: '#454b53',
      });
      // The sweep's +lateral points at the arc centre, so the outer edge — the
      // one the ball is thrown against — is −lateral. The wall leans with the
      // bank because railBar offsets in the path frame, not in world Y.
      railBar(m, p, -(w / 2 + 0.09), 1.35, 'track', '#96663f', 0.18);
      railBar(m, p, w / 2 + 0.09, KERB_H, 'rail', '#8d9aa8', 0.18);
      footprint(m);
    },
  });

/* ══ Category 3 · Intersections & Junctions (#17–#24) ══════════════════ */

def(17, 'junction_t', 'T-Junction Split', 3, { S: 0, E: 0, W: 0 }, 0.50, 0.20,
  '3-way decision node separating main paths from shortcut routes.', {
    color: OAK,
    build (m) {
      for (const d of ['S', 'E', 'W']) deck(m, spur(d), { w: TRACK, color: OAK, pylons: false });
      pad(m, TRACK / 2 + 0.35, 0, { color: OAK });
      m.box(0, KERB_H / 2, -TRACK / 2 - 0.35, TRACK + 1.6, KERB_H, RAIL_T, 'wall',
        { color: '#6f7d8c' });                              // closed north face
      footprint(m);
    },
  });

def(18, 'junction_cross', '4-Way Cross Junction', 3, { N: 0, S: 0, E: 0, W: 0 }, 0.50, 0.20,
  'Open 4-way intersection. Risk of high-speed perpendicular drift into voids.', {
    color: OAK,
    build (m) {
      for (const d of ['N', 'S', 'E', 'W']) deck(m, spur(d), { w: TRACK, color: OAK, pylons: false });
      pad(m, TRACK / 2 + 0.35, 0, { color: OAK });
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {   // corner kerbs
        m.box(sx * (TRACK / 2 + 0.62), KERB_H / 2, sz * (TRACK / 2 + 0.62), 0.55, KERB_H, 0.55,
          'wall', { color: '#6f7d8c' });
      }
      footprint(m);
    },
  });

def(19, 'junction_y_fork', 'Y-Splitter Fork', 3, { S: 0, N: 0, E: 0 }, 0.50, 0.20,
  'Symmetrical dual fork leading to parallel maze wings.', {
    color: OAK,
    decisions: ['D05'],
    notes: ['Documentation lists S, NE, NW. Implemented as S in, N and E out: the branch you can hold straight through plus the branch you have to commit to, which is the decision the piece exists to create.'],
    build (m) {
      deck(m, pathSpline([{ x: 0, z: Z_S }, { x: 0, z: 1.4 }, { x: 0, z: -1.2 }, { x: 0, z: Z_N }], 18),
        { w: TRACK, color: OAK, pylons: false });
      deck(m, pathSpline([{ x: 0, z: 1.8 }, { x: 0.4, z: 0.9 }, { x: 2.4, z: 0.1 }, { x: X_E, z: 0 }], 20),
        { w: TRACK * 0.9, color: OAK, pylons: false });
      m.polyPrism([[-1.2, 2.2], [1.2, 2.2], [1.2, -1.0], [-1.2, -1.0]], 0, DECK_T, 'track',
        { color: OAK, sideColor: '#454b53' });
      footprint(m);
    },
  });

def(20, 'junction_roundabout', 'Roundabout Center', 3, { N: 0, S: 0, E: 0, W: 0 }, 0.50, 0.20,
  'Circular rotary with central pillar; permits continuous looping.', {
    color: OAK,
    build (m) {
      for (const d of ['N', 'S', 'E', 'W']) deck(m, spur(d, 0, 3.0), { w: TRACK, color: OAK, pylons: false });
      m.ringPrism(0, 0, 1.15, 3.35, 0, DECK_T, 'track', { color: OAK, sideColor: '#454b53', seg: 36 });
      m.cyl(0, 0, 0, 1.15, 1.05, 1.5, 'wall', { seg: 24, color: '#6f7d8c' });
      m.cyl(0, 1.5, 0, 1.05, 0.9, 0.25, 'glow', { seg: 24, color: '#ffd93a', collide: false });
      footprint(m);
    },
  });

def(21, 'junction_deadend', 'Dead-End Wall Stop', 3, { S: 0 }, 0.50, 0.80,
  'High-restitution rubberized wall stop. Dead end trap forcing turnarounds.', {
    color: OAK,
    notes: ['Handoff §5.3: for a timed daily, a dead end should cost time, not a life. Nothing here kills.'],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: -2.4 }, 10),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      m.box(0, 0.75, -2.9, TRACK + 0.8, 1.5, 0.5, 'rubber', { color: '#c3423f' });
      for (let i = 0; i < 4; i++) {
        m.box(-1.1 + i * 0.73, 0.75, -2.62, 0.5, 1.1, 0.1, 'rubber',
          { color: '#8f2f2d', collide: false });
      }
      footprint(m);
    },
  });

def(22, 'junction_trapdoor', 'Trapdoor Junction', 3, { N: 0, S: 0, E: 0 }, 0.50, 0.20,
  '3-way junction where one path features a weight-triggered trapdoor.', {
    color: OAK,
    bodies: [body('obb', {
      effect: 'trapdoor', at: [3.1, -0.02, 0], size: [2.05, 0.2, TRACK - 0.08],
      pivot: [2.07, -0.02, 0], axis: 'z', openAngle: 1.35, period: 5, dutyCycle: 0.55,
    })],
    build (m) {
      for (const d of ['N', 'S']) deck(m, spur(d), { w: TRACK, color: OAK, pylons: false });
      pad(m, TRACK / 2 + 0.35, 0, { color: OAK });
      deck(m, pathLine({ x: 1.6, y: 0, z: 0 }, { x: 2.2, y: 0, z: 0 }, 2), { w: TRACK, color: OAK, pylons: false });
      deck(m, pathLine({ x: 4.1, y: 0, z: 0 }, { x: X_E, y: 0, z: 0 }, 2), { w: TRACK, color: OAK, pylons: false });
      m.box(3.1, -0.02, 0, 2.05, 0.2, TRACK - 0.08, 'timber',
        { color: '#8f6a3e', dyn: 'trapdoor' });                 // the panel
      for (const s of [-1, 1]) m.box(3.1, 0.06, s * (TRACK / 2 - 0.1), 2.05, 0.06, 0.1, 'glow', { color: '#ff9c3a', collide: false });
      footprint(m);
    },
  });

def(23, 'junction_turntable', 'Rotating Turntable Hub', 3, { N: 0, S: 0, E: 0, W: 0 }, 0.50, 0.20,
  'Center floor platform rotates 90° every 3 seconds, altering connected exits.', {
    color: OAK,
    bodies: [body('obb', {
      effect: 'turntable', at: [0, 0.02, 0], size: [TRACK + 0.56, 0.5, 6.4],
      pivot: [0, 0, 0], axis: 'y', period: 3, step: Math.PI / 2, surfaceVel: true,
    })],
    notes: ['Rotation is driven from stage time, never from wall-clock or Math.random — handoff §5.2 rule 2, or the daily stops replaying identically.'],
    build (m) {
      for (const d of ['N', 'S', 'E', 'W']) deck(m, spur(d, 0, 3.4), { w: TRACK, color: OAK, pylons: false });
      m.cyl(0, -DECK_T, 0, 3.3, 3.3, DECK_T, 'track', { seg: 32, color: '#a98a5e' });
      m.box(0, 0.02, 0, TRACK, 0.22, 6.4, 'timber',
        { color: '#c9a06a', dyn: 'turntable' });                 // the rotating bar
      for (const s of [-1, 1]) {
        m.box(s * (TRACK / 2 + 0.12), 0.28, 0, 0.16, 0.35, 6.4, 'rail',
          { color: '#8d9aa8', dyn: 'turntable' });
      }
      m.cyl(0, 0.13, 0, 0.42, 0.42, 0.1, 'glow', { seg: 16, color: '#ffd93a', collide: false });
      footprint(m);
    },
  });

def(24, 'junction_switch_track', 'Directional Switch Gate', 3, { S: 0, E: 0, W: 0 }, 0.50, 0.20,
  'Mechanical gate toggling between East and West exits upon ball contact.', {
    color: OAK,
    bodies: [body('obb', {
      effect: 'switchBlade', at: [0, 0.35, -0.9], size: [3.4, 0.7, 0.22],
      pivot: [0, 0.35, -0.9], axis: 'y', yawA: 0.62, yawB: -0.62, period: 4.5,
    })],
    build (m) {
      for (const d of ['S', 'E', 'W']) deck(m, spur(d), { w: TRACK, color: OAK, pylons: false });
      pad(m, TRACK / 2 + 0.5, 0, { color: OAK });
      m.boxRot(0, 0.35, -0.9, 3.4, 0.7, 0.22, [0, 1, 0], 0, 'rail',
        { color: '#c0cad6', dyn: 'switchBlade' });               // the blade
      m.cyl(0, 0, -0.9, 0.28, 0.28, 0.9, 'steel', { seg: 12, color: '#8d9aa8' });    // pivot
      m.box(0, KERB_H / 2, -TRACK / 2 - 0.5, TRACK + 2.0, KERB_H, RAIL_T, 'wall', { color: '#6f7d8c' });
      footprint(m);
    },
  });

/* ══ Category 4 · Ramps, Slopes & Elevations (#25–#32) ═════════════════ */

def(25, 'ramp_incline_gentle', 'Gentle Upward Ramp', 4, { S: 0, N: 1 }, 0.50, 0.20,
  'Grade-1 incline elevating the track by +1.0 m. Requires forward momentum.', {
    color: '#a8b86a',
    decisions: ['D03'],
    notes: [`Peak grade ${(peakGrade(LEVELS[1], TILE) * 180 / Math.PI).toFixed(1)}°. Gravity down-slope at the steepest point is ${(TUNING.GRAVITY * Math.sin(peakGrade(LEVELS[1], TILE))).toFixed(2)} m/s² against ${MAX_ACCEL.toFixed(2)} m/s² of tilt — climbable from a standstill.`],
    build (m) { rampDeck(m, 0, 1, '#a8b86a'); },
  });

def(26, 'ramp_incline_steep', 'Steep Upward Hill', 4, { S: 0, N: 2 }, 0.45, 0.20,
  'Grade-2 steep incline elevating by +2.0 m. Heavy gravity drag.', {
    color: '#8fa955',
    decisions: ['D03'],
    notes: [`Peak grade ${(peakGrade(LEVELS[2], TILE) * 180 / Math.PI).toFixed(1)}°. Net uphill acceleration at the steepest point is ${(MAX_ACCEL - TUNING.GRAVITY * Math.sin(peakGrade(LEVELS[2], TILE))).toFixed(2)} m/s² — needs a run-up, which is the point.`],
    build (m) { rampDeck(m, 0, 2, '#8fa955'); },
  });

def(27, 'ramp_decline_gentle', 'Gentle Downward Ramp', 4, { S: 1, N: 0 }, 0.50, 0.20,
  'Descent slope converting potential energy into rapid speed.', {
    color: '#a8b86a',
    notes: [`A ball entering at rest exits at √(2·g·Δh) = ${Math.sqrt(2 * TUNING.GRAVITY * LEVELS[1]).toFixed(1)} m/s.`],
    build (m) { rampDeck(m, 1, 0, '#a8b86a'); },
  });

def(28, 'ramp_decline_steep', 'Steep Drop Slope', 4, { S: 2, N: 0 }, 0.40, 0.30,
  'Near-vertical drop yielding high terminal rolling velocity.', {
    color: '#7f9c4c',
    notes: [`Exit speed from rest is ${Math.sqrt(2 * TUNING.GRAVITY * LEVELS[2]).toFixed(1)} m/s — well inside the ${TUNING.maxSpeed} m/s clamp, so the §2.6 anti-tunnelling invariant holds.`],
    build (m) { rampDeck(m, 2, 0, '#7f9c4c'); },
  });

function rampDeck (m, l0, l1, color) {
  const p = sn(l0, l1, 18);
  deck(m, p, { w: TRACK * 1.15, prof: profKerb(TRACK * 1.15), color });
  for (let i = 0; i < 9; i++) {                             // grip cleats
    const t = (i + 0.5) / 9;
    const st = p[Math.round(t * (p.length - 1))];
    stripe(m, 0, st.z, TRACK * 1.15 - 0.14, 0.1, st.y, 'marker', '#5f7038');
  }
}

def(29, 'ramp_halfpipe', 'Half-Pipe Bowl', 4, { S: 0, N: 0 }, 0.45, 0.35,
  'U-shaped concave channel enabling momentum rocking and tricks.', {
    color: '#8fa955',
    build (m) {
      const p = sn();
      m.addRoute(p, TRACK * 1.9);
      m.sweep(extend(p), profTrough(TRACK * 1.9, 1.25, 14), 'track', {
        thickness: 0.3, color: '#8fa955', sideMat: 'under', sideColor: '#454b53',
      });
      footprint(m);
    },
  });

def(30, 'ramp_spiral_up', 'Helix Spiral (Up)', 4, { S: 0, N: 2 }, 0.50, 0.20,
  'Corkscrew climb conserving footprint while gaining elevation.', {
    color: '#a8b86a',
    decisions: ['D07'],
    notes: ['Banked 180° loop bulging west, not a full 360° corkscrew — see D07. Path length is 14.3 m against a 10 m straight, so the same +2.4 m climbs at 9.5° instead of 13.5°, which is the whole point of a spiral.'],
    build (m) { helix(m, 0, 2, '#a8b86a', -1); },
  });

def(31, 'ramp_spiral_down', 'Helix Spiral (Down)', 4, { S: 2, N: 0 }, 0.45, 0.25,
  'Corkscrew descent providing high speed with centrifugal stability.', {
    color: '#8fa955',
    decisions: ['D07'],
    notes: ['Mirror of #30, bulging east, so a maze that uses both does not read as the same tile twice.'],
    build (m) { helix(m, 2, 0, '#8fa955', 1); },
  });

/**
 * A banked climbing loop. `side` is −1 for a westward bulge, +1 eastward.
 * The bank rolls the frame's up-vector toward the inside of the loop, so the
 * ball is held against the outer wall exactly as it would be on a velodrome.
 */
function helix (m, l0, l1, color, side) {
  const y0 = LEVELS[l0], y1 = LEVELS[l1];
  const R = 3.05;
  const ctrl = [
    { x: 0, z: Z_S }, { x: 0, z: 3.4 },
    { x: side * R, z: 2.1 }, { x: side * (R + 0.15), z: 0 }, { x: side * R, z: -2.1 },
    { x: 0, z: -3.4 }, { x: 0, z: Z_N },
  ];
  const flat = pathSpline(ctrl, 44);
  const n = flat.length;
  const path = flat.map((p, i) => {
    const t = i / (n - 1);
    const prev = flat[Math.max(0, i - 1)], next = flat[Math.min(n - 1, i + 1)];
    let tx = next.x - prev.x, tz = next.z - prev.z;
    const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    const rx = -tz, rz = tx;                       // tangent × worldUp
    // Bank rotates `up` about the tangent toward the inside of the loop, which
    // is −side laterally. Rolling it in a fixed world plane instead would read
    // as a pitch wherever the path is heading east or west.
    // Bank for the speed the maze is actually driven at, not for a racetrack.
    // Holding a line on a banked deck needs tan(θ) = v²/(r·g); at the 3–4 m/s a
    // 3 m-radius loop is taken at, that is 9–13°, not the 19° of the first pass.
    // Over-banking turns the loop into a sideways hill the ball slides down —
    // #30 and #31 were the two most common blockers in the solvability sweep.
    const th = 0.17 * Math.sin(Math.PI * t) * -side;
    const s = Math.sin(th), c = Math.cos(th);
    // Height is eased, not linear: a linear climb is still 0.12 m short of the
    // socket level half a metre inside the edge, and the neighbouring tile
    // expects to meet it flat. The socket-reachability test found this. The
    // shouldered ease rather than smoothstep, so the mid-loop grade does not
    // spike past what the player can climb.
    return { x: p.x, z: p.z, y: y0 + (y1 - y0) * shoulderEase(t), up: [rx * s, c, rz * s] };
  });
  m.addRoute(path, TRACK);
  m.sweep(extend(path), profDeck(TRACK), 'track', {
    thickness: 0.3, color, sideMat: 'under', sideColor: '#454b53',
  });
  railBar(m, path, (side > 0 ? 1 : -1) * (TRACK / 2 + 0.09), RAIL_H, 'rail', '#8d9aa8', 0.18);
  railBar(m, path, (side > 0 ? -1 : 1) * (TRACK / 2 + 0.09), KERB_H, 'rail', '#8d9aa8', 0.18);
  pylons(m, path.filter((_, i) => i % 8 === 0));
  m.cyl(side * R * 0.45, -0.5, 0, 0.55, 0.55, Math.max(y0, y1) + 0.5, 'under',
    { seg: 12, collide: false, color: '#3f454d' });
  footprint(m);
}

/** Arc length of a station list, in metres. Used by the notes and the tests. */
export function pathLength (path) {
  let L = 0;
  for (let i = 1; i < path.length; i++) {
    L += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y, path[i].z - path[i - 1].z);
  }
  return L;
}

def(32, 'ramp_launch_pad', 'Ski Jump Launch Ramp', 4, { S: 0 }, 0.30, 0.40,
  'Curved kick-ramp catapulting the ball across aerial gaps.', {
    color: '#c9a06a',
    air: { out: 'N' },
    pairWith: 33,
    notes: [`Lip is 1.35 m up at ~28°. Entering at 9 m/s the ball leaves at ~8.6 m/s and carries ${(8.6 * 8.6 * Math.sin(2 * 0.49) / TUNING.GRAVITY).toFixed(1)} m — enough for one 10 m tile of gap to piece #33.`],
    build (m) {
      const p = [];
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const z = Z_S - t * (TILE - 1.4);
        p.push({ x: 0, y: 1.35 * t * t * t, z });
      }
      deck(m, p, { w: TRACK * 1.1, prof: profKerb(TRACK * 1.1), color: '#c9a06a' });
      m.box(0, 1.55, Z_N + 1.0, TRACK * 1.4, 0.08, 0.5, 'glow', { color: '#ffd93a', collide: false });
      footprint(m);
    },
  });

/* ══ Category 5 · Gaps, Bridges & Rails (#33–#40) ══════════════════════ */

def(33, 'bridge_gap_landing', 'Aerial Gap Landing Pad', 5, { N: 0 }, 0.60, 0.15,
  'Catch platform equipped with soft rubber matting to absorb jump impact.', {
    color: '#4a5058',
    air: { in: 'S' },
    pairWith: 32,
    notes: ['Bounce 0.15 on a wide pad: a ball arriving at 9 m/s vertical keeps 1.35 m/s, so it settles in one bounce instead of skittering off the far edge.'],
    build (m) {
      m.polyPrism([[-3.2, -1.2], [3.2, -1.2], [3.2, 3.8], [-3.2, 3.8]], 0, DECK_T, 'track',
        { color: '#4a5058', sideColor: '#33383e' });
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 4; j++) {
          stripe(m, -2.6 + i * 1.3, -0.5 + j * 1.2, 1.05, 0.95, 0, 'marker', '#5b636d');
        }
      }
      for (const s of [-1, 1]) m.box(s * 3.35, 0.28, 1.3, 0.2, 0.56, 5.0, 'rubber', { color: '#3b4048' });
      m.box(0, 0.28, -1.35, 6.9, 0.56, 0.2, 'rubber', { color: '#3b4048' });
      deck(m, pathLine({ x: 0, y: 0, z: 3.6 }, { x: 0, y: 0, z: Z_N }, 6), { w: TRACK, color: '#4a5058' });
      footprint(m);
    },
  });

def(34, 'bridge_suspension', 'Rope Suspension Bridge', 5, { S: 0, N: 0 }, 0.55, 0.10,
  'Flexible wooden planks that sag and wobble under the ball\'s weight.', {
    color: '#8a6a4a',
    notes: ['The planks are static geometry with the sag baked in. Making the walkway itself a DynamicBody would leave the ball nothing to stand on until that runtime exists, so the wobble is deliberately deferred.'],
    build (m) {
      // 19 planks spanning the full −5.1…+5.1, so the deck actually overlaps
      // both sockets. At 17 planks the ends stopped 0.19 m short of the tile
      // boundary and the ball wedged in the seam against the neighbour's kerb.
      for (let i = 0; i < 19; i++) {
        const z = -5.1 + i * 0.567;
        const sag = -0.34 * Math.cos(z / 5.2 * Math.PI / 2) ** 2 + 0.0;
        m.box(0, sag, z, TRACK, 0.13, 0.42, 'track', { color: i % 2 ? '#8a6a4a' : '#9b7a56' });
      }
      m.addRoute([{ x: 0, y: 0, z: Z_S }, { x: 0, y: -0.2, z: 0 }, { x: 0, y: 0, z: Z_N }], TRACK);
      for (const s of [-1, 1]) {                            // rope handrails, decoration
        for (let i = 0; i < 24; i++) {
          const z = -5.0 + i * 0.435, z2 = z + 0.435;
          const h = z => 0.95 - 0.55 * Math.cos(z / 5.4 * Math.PI / 2) ** 2;
          m.box(s * (TRACK / 2 + 0.12), (h(z) + h(z2)) / 2, (z + z2) / 2, 0.07, 0.07, 0.46,
            'marker', { color: '#6b5535', collide: false });
        }
        for (const z of [-5.0, 5.0]) m.cyl(s * (TRACK / 2 + 0.12), -0.4, z, 0.12, 0.12, 1.5, 'timber', { seg: 8, color: '#6b5535' });
      }
      footprint(m);
    },
  });

def(35, 'rail_cylinder_pipe', 'Single Pipe Rail', 5, { S: 0, N: 0 }, 0.30, 0.05,
  'Single round steel pipe (0.5 m diameter). Extreme balance test.', {
    color: '#aab4c0',
    notes: [`A 0.5 m pipe under a ${BALL_R * 2} m ball: the contact patch is a line, so the slip impulse only ever resists along the pipe. Reserve for set-pieces with a wide run-up (handoff §4.3).`],
    build (m) {
      m.addRoute(sn().map(q => ({ ...q, y: q.y + 0.25 })), 0.5);
      m.sweep(extend(sn(), 0.3), profTube(0.25, 14), 'track',
        { closedProfile: true, color: '#aab4c0' });
      for (const z of [-4.2, 0, 4.2]) m.cyl(0, -1.4, z, 0.14, 0.14, 1.2, 'under', { seg: 8, collide: false, color: '#3f454d' });
      footprint(m);
    },
  });

def(36, 'rail_double_parallel', 'Dual Parallel Rails', 5, { S: 0, N: 0 }, 0.35, 0.10,
  'Two parallel steel bars locking the ball in a guided groove track.', {
    color: '#aab4c0',
    notes: [`Rails are 0.52 m apart centre to centre, so a ${BALL_R} m ball rests in the groove instead of on top of either bar.`],
    build (m) {
      m.addRoute(sn().map(q => ({ ...q, y: q.y + 0.05 })), 0.7);
      for (const s of [-1, 1]) {
        const p = sn().map(q => ({ x: q.x + s * 0.26, y: q.y, z: q.z }));
        m.sweep(extend(p, 0.3), profTube(0.15, 10), 'track', { closedProfile: true, color: '#aab4c0' });
      }
      for (const z of [-3.8, 0, 3.8]) {
        m.box(0, -0.35, z, 1.0, 0.12, 0.24, 'steel', { color: '#8d9aa8', collide: false });
        m.cyl(0, -1.5, z, 0.12, 0.12, 1.15, 'under', { seg: 8, collide: false, color: '#3f454d' });
      }
      footprint(m);
    },
  });

def(37, 'bridge_broken', 'Broken Bridge (Gap)', 5, { S: 0, N: 0 }, 0.50, 0.20,
  'Missing center floor segment requiring a mini-jump or boost speed.', {
    color: OAK,
    notes: ['The gap is 2.6 m. On the flat this is not jumpable — it must be entered from #25/#27 or after a boost. That dependency is deliberate and the generator has to honour it.'],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: 1.3 }, 6),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      deck(m, pathLine({ x: 0, y: 0, z: -1.3 }, { x: 0, y: 0, z: Z_N }, 6),
        { w: TRACK, prof: profKerb(TRACK), color: OAK });
      for (const z of [1.35, -1.35]) {                      // splintered ends, decoration
        for (let i = 0; i < 4; i++) {
          m.box(-0.9 + i * 0.6, -0.05, z + Math.sign(z) * -0.18, 0.4, 0.2, 0.34, 'timber',
            { color: '#7a5c3c', collide: false });
        }
      }
      footprint(m);
    },
  });

def(38, 'bridge_drawbridge', 'Timed Drawbridge', 5, { S: 0, N: 0 }, 0.50, 0.15,
  'Mechanical bridge floor raising/lowering every 4 seconds.', {
    color: '#8a6a4a',
    bodies: [body('obb', {
      effect: 'drawbridge', at: [0, -0.02, -1.1], size: [TRACK, 0.22, 4.3],
      pivot: [0, -0.02, 1.05], axis: 'x', period: 6, openAngle: 1.15, dutyCycle: 0.5,
    })],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: 1.1 }, 5), { w: TRACK, prof: profKerb(TRACK), color: '#8a6a4a' });
      deck(m, pathLine({ x: 0, y: 0, z: -3.3 }, { x: 0, y: 0, z: Z_N }, 4), { w: TRACK, prof: profKerb(TRACK), color: '#8a6a4a' });
      m.box(0, -0.02, -1.1, TRACK, 0.22, 4.3, 'timber',
        { color: '#9b7a56', dyn: 'drawbridge' });                // the span
      for (const s of [-1, 1]) {
        m.cyl(s * (TRACK / 2 + 0.3), 0, 1.05, 0.2, 0.2, 2.2, 'steel', { seg: 10, color: '#8d9aa8' });
        m.box(s * (TRACK / 2 + 0.3), 2.1, -0.1, 0.1, 0.1, 2.4, 'marker', { color: '#5a626c', collide: false });
      }
      footprint(m);
    },
  });

def(39, 'platform_moving', 'Floating Moving Tile', 5, { S: 0, N: 0 }, 0.60, 0.20,
  'Oscillating elevator platform connecting decoupled track sections.', {
    color: '#5f6b78',
    bodies: [body('obb', {
      effect: 'lift', at: [0, -0.05, 0], size: [3.28, 0.28, 3.0],
      slide: [1, 0, 0], amplitude: 2.4, period: 5, surfaceVel: true,
    })],
    notes: ['Surface velocity is imparted to the ball, so stepping on mid-travel shoves you — handoff §8. Without it the platform slides out from under the ball.'],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: 2.0 }, 5), { w: TRACK, prof: profKerb(TRACK), color: '#5f6b78' });
      deck(m, pathLine({ x: 0, y: 0, z: -2.0 }, { x: 0, y: 0, z: Z_N }, 5), { w: TRACK, prof: profKerb(TRACK), color: '#5f6b78' });
      m.box(0, -0.05, 0, 3.0, 0.28, 3.0, 'track',
        { color: '#6d7987', dyn: 'lift' });                      // the platform
      for (const s of [-1, 1]) {
        m.box(s * 1.5, 0.22, 0, 0.14, 0.3, 3.0, 'rail', { color: '#8d9aa8', dyn: 'lift' });
      }
      for (const s of [-1, 1]) {                            // travel rail, decoration
        m.box(0, -0.4, s * 1.35, 8.4, 0.1, 0.14, 'marker', { color: '#3f454d', collide: false });
      }
      footprint(m);
    },
  });

def(40, 'pad_bouncy_net', 'Bungee Bounce Pad', 5, { N: 0, S: 0, E: 0, W: 0 }, 0.10, 0.95,
  'Elastic trampoline fabric launching the ball into high arcs upon landing.', {
    color: '#ff5fa2',
    notes: [`e = 0.95 is the documentation's own figure and is legal — it is below 1, so it decays rather than gains. Arrival at 8 m/s rebounds to 7.6 m/s ≈ ${(7.6 * 7.6 / (2 * TUNING.GRAVITY)).toFixed(1)} m of air.`],
    build (m) {
      for (const d of ['N', 'S', 'E', 'W']) deck(m, spur(d, 0, 2.6), { w: TRACK, color: '#8a6a4a', pylons: false });
      m.polyPrism([[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]], -0.18, 0.12, 'spring',
        { color: '#ff5fa2', sideColor: '#c93b78' });
      for (const s of [-1, 1]) {                            // frame
        m.box(s * 2.62, 0.05, 0, 0.24, 0.4, 5.24, 'rubber', { color: '#3b4048' });
        m.box(0, 0.05, s * 2.62, 5.24, 0.4, 0.24, 'rubber', { color: '#3b4048' });
      }
      for (let i = 1; i < 5; i++) {                         // net weave, decoration
        stripe(m, 0, -2.5 + i, 5.0, 0.06, -0.16, 'marker', '#ffd0e4');
        stripe(m, -2.5 + i, 0, 0.06, 5.0, -0.16, 'marker', '#ffd0e4');
      }
      footprint(m);
    },
  });

/* ══ Category 6 · Obstacles & Hazards (#41–#48) ════════════════════════ */

def(41, 'hazard_pinball_bumper', 'Pinball Bumper', 6, { N: 0, S: 0, E: 0, W: 0 }, 0.20, 1.80,
  'Super-elastic mushroom bumper imparting radial launch force (+20 m/s).', {
    color: '#ff4d5e',
    restitution: 0.62,
    decisions: ['D04'],
    behaviours: [impulse({ effect: 'bumperKick', mode: 'add', speed: 20, dir: 'radial', radius: 1.35, rearm: 0.3 })],
    notes: ['Documentation lists e = 1.80. Restitution above 1 injects energy on every contact and the ball diverges; the solver is given e = 0.62 and the +20 m/s is a latched radial impulse instead. Same feel, bounded energy.'],
    build (m) {
      for (const d of ['N', 'S', 'E', 'W']) deck(m, spur(d, 0, 2.4), { w: TRACK, color: '#c39a63', pylons: false });
      m.cyl(0, -DECK_T, 0, 2.4, 2.4, DECK_T, 'track', { seg: 28, color: '#e8956a' });
      m.cyl(0, 0, 0, 0.95, 1.15, 0.85, 'bumper', { seg: 20, color: '#ff4d5e' });
      m.cyl(0, 0.85, 0, 1.15, 0.75, 0.3, 'bumper', { seg: 20, color: '#ff7080' });
      m.cyl(0, 1.15, 0, 0.75, 0.6, 0.12, 'glow', { seg: 16, color: '#fff2b0', collide: false });
      m.ringPrism(0, 0, 1.35, 1.55, 0.02, 0.03, 'glow', { color: '#ffd93a', seg: 28, collide: false });
      footprint(m);
    },
  });

def(42, 'hazard_pendulum', 'Swinging Pendulum', 6, { S: 0, N: 0 }, 0.50, 0.80,
  'Heavy iron hammer swinging across track. Knocks ball into void if hit.', {
    color: OAK,
    bodies: [body('sphere', {
      effect: 'pendulum', pivot: [0, 4.6, 0], at: [0, 0.85, 0], radius: 0.72,
      axis: 'z', swing: 1.05, period: 2.6, surfaceVel: true,
    })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.15, prof: profKerb(TRACK * 1.15), color: OAK });
      m.box(0, 4.6, 0, 6.6, 0.24, 0.24, 'steel', { color: '#8d9aa8', collide: false });
      for (const s of [-1, 1]) m.cyl(s * 3.2, 0, 0, 0.2, 0.16, 4.7, 'steel', { seg: 10, color: '#8d9aa8' });
      m.box(0, 2.9, 0, 0.12, 3.4, 0.12, 'steel', { color: '#6d7683', dyn: 'pendulum' });
      m.sphere(0, 0.85, 0, 0.72, 'hazard', { color: '#4c525a', rows: 7, cols: 12, dyn: 'pendulum' });
      footprint(m);
    },
  });

def(43, 'hazard_windmill', 'Rotating Spindle Gate', 6, { S: 0, N: 0 }, 0.50, 0.60,
  '4-blade spinning barrier requiring synchronized passage.', {
    color: OAK,
    bodies: [body('obb', {
      effect: 'spindle', at: [0, 0.55, 0], pivot: [0, 0.55, 0], axis: 'y',
      blades: 4, size: [3.6, 0.9, 0.2], period: 3.4, surfaceVel: true,
    })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.15, prof: profKerb(TRACK * 1.15), color: OAK });
      m.cyl(0, 0, 0, 0.3, 0.3, 2.4, 'steel', { seg: 12, color: '#8d9aa8' });
      for (let i = 0; i < 4; i++) {
        m.boxRot(0, 0.55, 0, 3.6, 0.9, 0.2, [0, 1, 0], i * Math.PI / 4, 'hazard',
          { color: '#d94a3d', dyn: 'spindle' });
      }
      m.cyl(0, 2.4, 0, 0.34, 0.2, 0.3, 'glow', { seg: 12, color: '#ffd93a', collide: false });
      footprint(m);
    },
  });

def(44, 'hazard_cheese_wheel', 'Rolling Cheese Wheel', 6, { S: 0, N: 0 }, 0.60, 0.40,
  'Indiana-Jones-style giant cheese boulder rolling down track channel.', {
    color: OAK,
    bodies: [body('sphere', {
      effect: 'boulder', at: [0, 1.5, 0], radius: 1.5,
      slide: [0, 0, 1], amplitude: 4.6, period: 7, roll: true, surfaceVel: true,
    })],
    build (m) {
      const p = sn();
      m.addRoute(p, TRACK * 1.55);
      m.sweep(extend(p), profWalls(TRACK * 1.55, RAIL_H + 0.3), 'track',
        { thickness: DECK_T, color: OAK, sideMat: 'under', sideColor: '#454b53' });
      // On its edge, axis across the corridor — a wheel, not a plate.
      m.tube([-0.45, 1.5, 0], [0.45, 1.5, 0], 1.5, 'cheese',
        { seg: 24, color: '#f2c227', dyn: 'boulder' });
      for (let i = 0; i < 7; i++) {                         // holes
        const a = i / 7 * Math.PI * 2;
        m.sphere(0.46, 1.5 + Math.sin(a) * 0.9, Math.cos(a) * 0.9, 0.19, 'marker',
          { color: '#d8a516', rows: 5, cols: 7, dyn: 'boulder' });
      }
      footprint(m);
    },
  });

def(45, 'hazard_mousetrap', 'Snap Mouse-Trap Panel', 6, { S: 0, N: 0 }, 0.50, 1.20,
  'Pressure-sensitive floor snapping upward, flinging the ball vertically.', {
    color: '#8a6a4a',
    restitution: 0.50,
    decisions: ['D04'],
    behaviours: [impulse({ effect: 'snap', mode: 'add', speed: 11, dir: 'up', region: [2.6, 2.6], delay: 0.25, rearm: 1.8 })],
    notes: ['Documentation lists e = 1.20 — again above 1. Solver gets e = 0.5; the snap is a latched +11 m/s vertical impulse a quarter-second after the plate is loaded.'],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      m.box(0, 0.09, 0, 2.6, 0.14, 2.6, 'timber', { color: '#7a5c3c' });           // the plate
      m.box(0, 0.16, 1.35, 2.7, 0.16, 0.2, 'steel', { color: '#c0cad6' });         // the bar
      for (const s of [-1, 1]) {
        m.cyl(s * 1.2, 0.1, 1.35, 0.14, 0.14, 0.34, 'steel', { seg: 8, color: '#8d9aa8', collide: false });
      }
      stripe(m, 0, 0, 2.4, 2.4, 0.16, 'marker', '#c9a06a');
      footprint(m);
    },
  });

def(46, 'hazard_pop_spikes', 'Pop-Up Floor Spikes', 6, { S: 0, N: 0 }, 0.50, 0.00,
  'Retractable spikes popping up periodically to stop momentum and pop shield.', {
    color: '#8a6a4a',
    bodies: [body('obb', {
      effect: 'spikes', at: [0, 0.3, 0], size: [2.6, 0.62, 3.4],
      slide: [0, 1, 0], amplitude: 0.62, period: 2.6, dutyCycle: 0.42,
    })],
    notes: ['Handoff §5.4: for a daily, this costs time, not a life. Contact stops the ball and applies a time penalty.'],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 6; j++) {
          const x = -1.0 + i * 0.5, z = -1.4 + j * 0.56;
          m.cyl(x, 0.0, z, 0.14, 0.01, 0.6, 'hazard',
            { seg: 6, color: '#c9ccd2', dyn: 'spikes' });
        }
      }
      stripe(m, 0, 0, 2.6, 3.4, 0.005, 'marker', '#5f4a30');
      footprint(m);
    },
  });

def(47, 'hazard_wind_fan', 'Lateral Wind Fan', 6, { S: 0, N: 0 }, 0.50, 0.20,
  'High-power turbine blowing continuous sideways force (12 m/s²).', {
    color: OAK,
    behaviours: [field({ effect: 'wind', accel: [-12, 0, 0], region: [TILE, TILE] })],
    notes: [`12 m/s² sideways against ${MAX_ACCEL.toFixed(2)} m/s² of counter-tilt is unwinnable if it is on continuously — so it is gusted: 1.4 s on, 1.6 s off, phase from stage time.`],
    bodies: [body('none', { effect: 'gust', period: 3.0, dutyCycle: 0.47 })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.3, prof: profKerb(TRACK * 1.3), color: OAK });
      m.box(X_E - 0.9, 1.5, 0, 0.35, 3.0, 3.0, 'wall', { color: '#5b636d' });      // housing
      // The turbine faces down the corridor: axis along X, blades spinning in YZ.
      m.tube([X_E - 1.18, 1.5, 0], [X_E - 1.04, 1.5, 0], 1.15, 'steel',
        { seg: 20, color: '#8d9aa8', collide: false });
      for (let i = 0; i < 5; i++) {
        m.boxRot(X_E - 1.28, 1.5, 0, 0.1, 1.9, 0.42, [1, 0, 0], i * Math.PI / 5, 'marker',
          { color: '#c0cad6', collide: false });
      }
      for (let i = 0; i < 4; i++) {                         // airflow ticks
        m.box(1.6 - i * 1.3, 1.2, 0, 0.7, 0.05, 0.05, 'glowBlue', { color: '#8fdcff', collide: false });
      }
      footprint(m);
    },
  });

def(48, 'hazard_acid_pit', 'Slime / Acid Pit', 6, { S: 0, N: 0 }, 0.00, 0.00,
  'Center void pool filled with acid slime. Instant stage loss if fallen into.', {
    color: OAK,
    behaviours: [trigger({ effect: 'hazardVolume', region: [4.6, 3.6], respawn: 'corridorEntrance', timePenalty: 3 })],
    notes: ['Handoff §5.4: respawn at the corridor entrance the ball fell from with a time penalty — a daily should always be finishable, so this is not a life loss.'],
    build (m) {
      for (const z of [[Z_S, 1.8], [-1.8, Z_N]]) {
        deck(m, pathLine({ x: 0, y: 0, z: z[0] }, { x: 0, y: 0, z: z[1] }, 5),
          { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: OAK, pylons: false });
      }
      for (const s of [-1, 1]) {                            // ledges either side of the pool
        m.box(s * 2.05, -0.16, 0, 0.5, DECK_T, 3.6, 'track', { color: '#a8804f' });
      }
      m.polyPrism([[-2.3, -1.8], [2.3, -1.8], [2.3, 1.8], [-2.3, 1.8]], -0.75, 0.06, 'slime',
        { color: '#6fd36b', collide: false });
      for (const [x, z, r] of [[-1.2, -0.8, 0.28], [0.6, 0.3, 0.36], [1.4, -1.1, 0.22]]) {
        m.sphere(x, -0.68, z, r, 'slime', { color: '#8ae886', collide: false, rows: 5, cols: 8 });
      }
      footprint(m);
    },
  });

/* ══ Category 7 · Gimmicks & Interactive (#49–#56) ═════════════════════ */

def(49, 'gimmick_gravity_pad', 'Gravity Inverter Pad', 7, { S: 0, N: 0 }, 0.50, 0.20,
  'Reverses local tile gravity vector, enabling wall and ceiling rolling.', {
    color: '#7a4fa3',
    behaviours: [impulse({ effect: 'gravityFlip', region: [2.6, 2.6], duration: 2.5, rearm: 0.6 })],
    notes: ['Inversion is time-boxed to 2.5 s and reverts with a lerp, otherwise the tilt control loses its reference frame and the player cannot recover.'],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      m.box(0, 0.08, 0, 2.6, 0.1, 2.6, 'track', { color: '#7a4fa3' });
      m.box(0, 0.145, 0, 2.2, 0.03, 2.2, 'glow', { color: '#c68bff', collide: false });
      for (let i = 0; i < 3; i++) {                         // rising chevrons, decoration
        m.box(0, 0.7 + i * 0.55, 0, 1.5 - i * 0.4, 0.08, 0.3, 'glow',
          { color: '#c68bff', collide: false });
      }
      m.box(0, 3.4, 0, 2.6, 0.12, 2.6, 'glass', { color: '#c68bff', collide: false });
      footprint(m);
    },
  });

def(50, 'gimmick_cannon_entry', 'Pneumatic Cannon Entry', 7, { S: 0 }, 0.80, 0.00,
  'Funnel sucking ball in and firing it through air to Cannon Exit.', {
    color: '#5b636d',
    air: { out: 'N' },
    pairWith: 51,
    behaviours: [trigger({ effect: 'cannon', capture: 0.9, chargeTime: 0.5, launchSpeed: +launchSpeed(10, 0, Math.PI / 4).toFixed(2), angle: Math.PI / 4, target: 51 })],
    notes: [`Launch speed sized by behaviors.launchSpeed(): ${launchSpeed(10, 0, Math.PI / 4).toFixed(2)} m/s at 45° covers exactly one 10 m tile of gap. The ball is held for 0.5 s so the player can see where it is aimed.`],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: 1.4 }, 5), { w: TRACK, prof: profKerb(TRACK), color: '#8a6a4a' });
      m.cyl(0, -0.1, 0.4, 1.5, 0.55, 1.0, 'track', { seg: 22, color: '#5b636d', cap: false });  // funnel
      const barrel = pathLine({ x: 0, y: 0.5, z: 0.4 }, { x: 0, y: 2.9, z: -2.0 }, 6);
      m.sweep(barrel, profTube(0.55, 12), 'steel', { closedProfile: true, color: '#8d9aa8' });
      m.cyl(0, -0.9, 0.4, 0.5, 0.5, 0.9, 'under', { seg: 12, collide: false, color: '#3f454d' });
      m.box(0, 3.15, -2.35, 1.3, 0.06, 0.5, 'glow', { color: '#ffd93a', collide: false });
      footprint(m);
    },
  });

def(51, 'gimmick_cannon_exit', 'Cannon Target Catch Net', 7, { N: 0 }, 0.60, 0.10,
  'Funnel net receiving airborne ball from Cannon Entry.', {
    color: '#5b636d',
    air: { in: 'S' },
    pairWith: 50,
    build (m) {
      m.cyl(0, -0.9, 1.2, 0.7, 2.3, 1.6, 'track', { seg: 24, color: '#5b636d', cap: false });
      m.ringPrism(0, 1.2, 2.3, 2.55, 0.72, 0.16, 'rubber', { color: '#3b4048', seg: 26 });
      for (let i = 0; i < 10; i++) {                        // net strands, decoration
        const a = i / 10 * Math.PI * 2;
        m.box(Math.cos(a) * 1.5, 0.0, 1.2 + Math.sin(a) * 1.5, 0.06, 1.5, 0.06, 'marker',
          { color: '#8d9aa8', collide: false });
      }
      deck(m, pathLine({ x: 0, y: -0.85, z: 0.4 }, { x: 0, y: 0, z: Z_N }, 8), { w: TRACK, prof: profKerb(TRACK), color: '#8a6a4a' });
      footprint(m);
    },
  });

def(52, 'gimmick_magnetic_rail', 'Magnetic Lock Rail', 7, { S: 0, N: 0 }, 0.20, 0.10,
  'Electromagnetic track locking ball along center line against tilt gravity.', {
    color: '#5f7fd8',
    behaviours: [field({ effect: 'magnet', axis: 'z', strength: 22, falloff: 1.6 })],
    notes: [`Centring force is 22 m/s² — comfortably above the ${MAX_ACCEL.toFixed(2)} m/s² the player can command laterally, so the lock actually holds. Longitudinal motion is untouched.`],
    build (m) {
      deck(m, sn(), { w: TRACK, prof: profKerb(TRACK), color: '#5f7fd8' });
      for (let i = 0; i < 12; i++) {
        const z = -4.6 + i * 0.85;
        m.box(0, 0.03, z, TRACK - 0.3, 0.05, 0.34, 'marker',
          { color: i % 2 ? '#7fa0ff' : '#c9d6ff', collide: false });
      }
      for (const s of [-1, 1]) m.box(s * (TRACK / 2 + 0.1), 0.16, 0, 0.16, 0.32, TILE, 'magnet', { color: '#4a68b8' });
      footprint(m);
    },
  });

def(53, 'gimmick_portal_blue', 'Teleport Portal A (Blue)', 7, { S: 0 }, 0.00, 0.00,
  'Wormhole entrance instantly transferring position/momentum to Portal B.', {
    color: '#3ec6ff',
    pairWith: 54,
    behaviours: [trigger({ effect: 'portal', link: 54, radius: 1.15, exitOffset: 1.2, cooldown: 0.6, carryMomentum: true })],
    notes: ['Handoff §11.4: the exit is offset 1.2 m past the destination — outside its own trigger radius — and the pair is on a 0.6 s cooldown as a second line of defence. A blind bot found the soft-lock in 40 s last time.'],
    build (m) { portal(m, '#3ec6ff', 'glowBlue'); },
  });

def(54, 'gimmick_portal_orange', 'Teleport Portal B (Orange)', 7, { N: 0 }, 0.00, 0.00,
  'Wormhole exit destination for Portal A.', {
    color: '#ff8a2b',
    pairWith: 53,
    behaviours: [trigger({ effect: 'portal', link: 53, radius: 1.15, exitOffset: 1.2, cooldown: 0.6, carryMomentum: true })],
    build (m) { portal(m, '#ff8a2b', 'glow', true); },
  });

function portal (m, color, glowMat, north = false) {
  const zEdge = north ? Z_N : Z_S, dir = north ? -1 : 1;
  deck(m, pathLine({ x: 0, y: 0, z: zEdge }, { x: 0, y: 0, z: dir * -1.2 }, 6),
    { w: TRACK, prof: profKerb(TRACK), color: '#8a6a4a' });
  m.polyPrism([[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]], 0, DECK_T, 'track',
    { color: '#6a5a48', sideColor: '#454b53' });
  m.ringPrism(0, 0, 1.02, 1.3, 0.05, 0.1, 'track', { color, seg: 30 });
  m.cyl(0, 0.055, 0, 1.02, 1.02, 0.01, glowMat, { seg: 30, color, collide: false });
  for (let i = 0; i < 3; i++) {
    m.ringPrism(0, 0, 0.5 + i * 0.2, 0.58 + i * 0.2, 0.08 + i * 0.05, 0.01, glowMat,
      { color, seg: 24, collide: false });
  }
  footprint(m);
}

def(55, 'gimmick_size_tunnel', 'Size Modifier Tunnel', 7, { S: 0, N: 0 }, 0.50, 0.20,
  'Shrinks ball to 0.5× (fits narrow paths) or enlarges to 2.0× (crushes hazards).', {
    color: '#7a4fa3',
    behaviours: [impulse({ effect: 'resize', scale: 0.5, region: [2.0, 1.2], rearm: 0.8 })],
    notes: [`Shrinking to 0.5× puts the ball at ${(BALL_R * 0.5).toFixed(3)} m radius. Handoff §2.6 requires maxSpeed·FIXED < r; at ${TUNING.maxSpeed} m/s that is ${(TUNING.maxSpeed / 120).toFixed(3)} m against ${(BALL_R * 0.5).toFixed(3)} m — still safe, but 0.25× would NOT be. The scale floor is 0.5×.`],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      // Hoops the ball rolls through: axis along the corridor, not standing up.
      for (const [z, r, c] of [[1.2, 1.55, '#7a4fa3'], [-1.2, 1.0, '#a97fd0']]) {
        const n = 24;
        for (let i = 0; i < n; i++) {
          const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
          if (Math.sin(a0) < -0.1 && Math.sin(a1) < -0.1) continue;   // leave the floor open
          m.tube([Math.cos(a0) * r, r + Math.sin(a0) * r, z], [Math.cos(a1) * r, r + Math.sin(a1) * r, z],
            0.16, 'wall', { seg: 7, color: c });
        }
      }
      for (let i = 0; i < 4; i++) {
        const r = 0.75 - i * 0.1;
        m.tube([0, r + 0.1, 0.9 - i * 0.6], [0, r + 0.1, 0.86 - i * 0.6], r, 'glow',
          { seg: 18, color: '#c68bff', collide: false });
      }
      footprint(m);
    },
  });

def(56, 'gimmick_water_vortex', 'Drain Water Vortex', 7, { S: 0, N: 0 }, 0.10, 0.05,
  'Swirling water funnel exerting inward centripetal force toward drain center.', {
    color: '#3aa8d8',
    behaviours: [field({ effect: 'vortex', centre: [0, 0], inward: 9, tangential: 7, radius: 3.0 })],
    notes: ['Inward 9 m/s² is beatable at full tilt (5.32 m/s²) only with tangential speed already built up — so the escape is to circle out, not to fight it head-on. That is the puzzle.'],
    build (m) {
      for (const z of [[Z_S, 3.0], [-3.0, Z_N]]) {
        deck(m, pathLine({ x: 0, y: 0, z: z[0] }, { x: 0, y: 0, z: z[1] }, 4),
          { w: TRACK, prof: profKerb(TRACK), color: '#8a6a4a', pylons: false });
      }
      const n = 30;
      for (let i = 0; i < n; i++) {                         // funnel wall
        const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
        for (let k = 0; k < 5; k++) {
          const r0 = 3.1 - k * 0.55, r1 = 3.1 - (k + 1) * 0.55;
          const y0 = -0.1 - k * 0.28, y1 = -0.1 - (k + 1) * 0.28;
          const P = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
          m.quad(P(r0, a0, y0), P(r0, a1, y0), P(r1, a1, y1), P(r1, a0, y1), 'track',
            { color: k % 2 ? '#3aa8d8' : '#3496c2' });
        }
      }
      m.cyl(0, -1.55, 0, 0.4, 0.4, 0.1, 'steel', { seg: 12, color: '#6d7683' });
      for (let i = 0; i < 3; i++) {
        m.ringPrism(0, 0, 1.4 + i * 0.7, 1.55 + i * 0.7, -0.5 + i * 0.28, 0.02, 'water',
          { color: '#8ad8f5', seg: 26, collide: false });
      }
      footprint(m);
    },
  });

/* ══ Category 8 · Special & Objectives (#57–#64) ═══════════════════════ */

def(57, 'special_start_cage', 'Start Spawn Cage', 8, { N: 0 }, 0.50, 0.20,
  'Transparent glass dome that opens after a 3-2-1 READY GO countdown.', {
    color: '#c9a227',
    behaviours: [trigger({ effect: 'spawn', countdown: 3, releaseOn: 'go' })],
    notes: ['Handoff §11.2: do not respawn at a tile centre. The spawn point is 1.1 m north of centre on the corridor centre-line, with a downward probe before the ball is committed.'],
    build (m) {
      m.cyl(0, -DECK_T, 0, 2.5, 2.5, DECK_T, 'track', { seg: 30, color: '#c9a227' });
      deck(m, pathLine({ x: 0, y: 0, z: -2.2 }, { x: 0, y: 0, z: Z_N }, 5), { w: TRACK, prof: profKerb(TRACK), color: '#c9a227' });
      m.ringPrism(0, 0, 1.9, 2.15, 0.16, 0.2, 'wall', { color: '#8d9aa8', seg: 28 });
      for (let i = 0; i < 8; i++) {                         // cage ribs, decoration
        const a = i / 8 * Math.PI * 2;
        const arc = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8 * Math.PI / 2;
          arc.push({ x: Math.cos(a) * Math.cos(t) * 2.0, y: 0.16 + Math.sin(t) * 2.1, z: Math.sin(a) * Math.cos(t) * 2.0 });
        }
        m.sweep(arc, profTube(0.05, 6), 'glass', { closedProfile: true, color: '#9fd8ff', collide: false });
      }
      m.sphere(0, 0.35, 0, 0.35, 'marker', { color: '#e8e8e8', collide: false });
      footprint(m);
    },
  });

def(58, 'special_goal_ring', 'Goal Ring Archway', 8, { S: 0 }, 0.50, 0.20,
  'Spinning party goal ring banner. Passing through clears the daily level.', {
    color: '#c9a227',
    behaviours: [trigger({ effect: 'goal', radius: 1.4, requires: 'passThrough' })],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: -2.4 }, 7), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#c9a227' });
      m.polyPrism([[-2.2, -2.6], [2.2, -2.6], [2.2, -1.4], [-2.2, -1.4]], 0, DECK_T, 'track', { color: '#c9a227', sideColor: '#8a6a2a' });
      const ring = [];
      for (let i = 0; i <= 28; i++) {
        const a = i / 28 * Math.PI * 2;
        ring.push({ x: Math.cos(a) * 1.55, y: 1.32 + Math.sin(a) * 1.55, z: 0.2 });
      }
      m.sweep(ring, profTube(0.16, 8), 'wall', { closedProfile: true, color: '#e8c84a' });
      for (const s of [-1, 1]) m.cyl(s * 1.9, 0, 0.2, 0.18, 0.14, 1.4, 'steel', { seg: 10, color: '#8d9aa8' });
      for (let i = 0; i < 10; i++) {                        // bunting, decoration
        const a = i / 10 * Math.PI * 2;
        m.box(Math.cos(a) * 1.55, 1.32 + Math.sin(a) * 1.55, 0.2, 0.22, 0.22, 0.06,
          i % 2 ? 'glow' : 'glowBlue', { color: i % 2 ? '#ffd93a' : '#3ec6ff', collide: false });
      }
      footprint(m);
    },
  });

def(59, 'special_checkpoint', 'Respawn Checkpoint', 8, { S: 0, N: 0 }, 0.50, 0.20,
  'Save flag updating player respawn position in long daily mazes.', {
    color: '#c9a227',
    behaviours: [trigger({ effect: 'checkpoint', radius: 1.6, once: true })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      m.box(0, 0.06, 0, 2.4, 0.06, 2.4, 'track', { color: '#c9a227' });
      m.cyl(1.05, 0.05, 0, 0.12, 0.1, 2.4, 'steel', { seg: 8, color: '#8d9aa8' });
      m.box(0.55, 2.15, 0, 0.9, 0.55, 0.05, 'glow', { color: '#ffd93a', collide: false });
      m.ringPrism(0, 0, 1.1, 1.25, 0.06, 0.02, 'glow', { color: '#ffd93a', seg: 24, collide: false });
      footprint(m);
    },
  });

def(60, 'special_cheese_pickup', 'Golden Cheese Pickup', 8, { S: 0, N: 0 }, 0.50, 0.20,
  'Spawns collectible Golden Cheese slice (+1000 pts / leaderboard rating).', {
    color: '#c9a227',
    behaviours: [trigger({ effect: 'pickup', item: 'goldenCheese', points: 1000, radius: 0.9, respawns: false })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      m.polyPrism([[-0.75, -0.65], [0.75, -0.65], [0, 0.75]], 1.35, 0.45, 'cheese',
        { color: '#ffd93a', sideColor: '#d8a516', collide: false });
      for (const [x, z] of [[-0.2, -0.25], [0.28, 0.05]]) {
        m.cyl(x, 1.34, z, 0.13, 0.13, 0.02, 'marker', { seg: 8, color: '#d8a516', collide: false });
      }
      m.ringPrism(0, 0, 0.8, 0.92, 0.04, 0.02, 'glow', { color: '#ffd93a', seg: 22, collide: false });
      footprint(m);
    },
  });

def(61, 'special_time_clock', 'Time Extension Clock', 8, { S: 0, N: 0 }, 0.50, 0.20,
  'Spawns spinning clock item adding +10 seconds to stage timer.', {
    color: '#c9a227',
    behaviours: [trigger({ effect: 'pickup', item: 'timeBonus', seconds: 10, radius: 0.9, respawns: false })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      // Clock face stands up and faces the arriving ball, rather than lying flat.
      m.tube([0, 1.35, -0.07], [0, 1.35, 0.07], 0.84, 'steel', { seg: 24, color: '#3ec6ff', collide: false });
      m.tube([0, 1.35, 0.07], [0, 1.35, 0.11], 0.70, 'wall', { seg: 24, color: '#e8eef5', collide: false });
      m.box(0, 1.57, 0.13, 0.05, 0.42, 0.02, 'marker', { color: '#2b3138', collide: false });
      m.box(0.15, 1.35, 0.13, 0.32, 0.05, 0.02, 'marker', { color: '#2b3138', collide: false });
      m.ringPrism(0, 0, 0.8, 0.92, 0.04, 0.02, 'glowBlue', { color: '#3ec6ff', seg: 22, collide: false });
      footprint(m);
    },
  });

def(62, 'special_key_door', 'Locked Keyhole Gate', 8, { S: 0, N: 0 }, 0.50, 0.90,
  'Locked barrier wall that lowers only when Key Item is collected in maze.', {
    color: '#c9a227',
    bodies: [body('obb', { effect: 'keyGate', at: [0, 1.1, 0], size: [TRACK + 0.8, 2.2, 0.4], opensOn: 'key', dropTime: 0.6 })],
    build (m) {
      deck(m, sn(), { w: TRACK * 1.2, prof: profKerb(TRACK * 1.2), color: '#8a6a4a' });
      m.box(0, 1.1, 0, TRACK + 0.8, 2.2, 0.4, 'wall', { color: '#8a7a5a' });
      for (const s of [-1, 1]) m.cyl(s * (TRACK / 2 + 0.55), 0, 0, 0.26, 0.26, 2.6, 'stone', { seg: 10, color: '#6f6a60' });
      m.cyl(0, 1.35, -0.21, 0.28, 0.28, 0.05, 'glow', { seg: 14, color: '#ffd93a', collide: false });
      m.box(0, 0.95, -0.21, 0.18, 0.55, 0.05, 'glow', { color: '#ffd93a', collide: false });
      footprint(m);
    },
  });

def(63, 'special_secret_exit', 'Daily Secret Warp Ring', 8, { S: 0 }, 0.50, 0.20,
  'Red secret goal arch unlocking bonus Daily Challenge stage.', {
    color: '#c94a3d',
    behaviours: [trigger({ effect: 'secretGoal', radius: 1.3, unlocks: 'dailyBonus' })],
    build (m) {
      deck(m, pathLine({ x: 0, y: 0, z: Z_S }, { x: 0, y: 0, z: -1.8 }, 6), { w: TRACK * 1.1, prof: profKerb(TRACK * 1.1), color: '#c9a227' });
      m.polyPrism([[-2.0, -2.4], [2.0, -2.4], [2.0, -1.2], [-2.0, -1.2]], 0, DECK_T, 'track', { color: '#8a5a4a', sideColor: '#5a3a2a' });
      const ring = [];
      for (let i = 0; i <= 26; i++) {
        const a = i / 26 * Math.PI * 2;
        ring.push({ x: Math.cos(a) * 1.4, y: 1.2 + Math.sin(a) * 1.4, z: -1.8 });
      }
      m.sweep(ring, profTube(0.18, 8), 'wall', { closedProfile: true, color: '#c94a3d' });
      m.tube([0, 1.2, -1.83], [0, 1.2, -1.81], 1.22, 'glowRed',
        { seg: 26, color: '#ff5a4a', collide: false });
      for (const s of [-1, 1]) m.cyl(s * 1.75, 0, -1.8, 0.18, 0.14, 1.2, 'stone', { seg: 10, color: '#6f6a60' });
      footprint(m);
    },
  });

def(64, 'special_boss_core', 'Central Maze Boss Core', 8, { N: 0, S: 0, E: 0, W: 0 }, 0.50, 0.20,
  'Grand 4-way central chamber featuring dynamic rotating maze elements.', {
    color: '#c9a227',
    bodies: [
      body('obb', {
        effect: 'coreArm', at: [0, 0.6, 0], pivot: [0, 0.6, 0], axis: 'y',
        blades: 3, size: [7.0, 1.0, 0.35], period: 7, surfaceVel: true,
      }),
      body('sphere', { effect: 'corePulse', at: [0, 1.6, 0], radius: 1.2, period: 4 }),
    ],
    build (m) {
      for (const d of ['N', 'S', 'E', 'W']) deck(m, spur(d, 0, 4.2), { w: TRACK * 1.2, color: '#c9a227', pylons: false });
      m.cyl(0, -DECK_T, 0, 4.3, 4.3, DECK_T, 'track', { seg: 40, color: '#b8912a' });
      m.ringPrism(0, 0, 4.3, 4.6, 0.34, 0.4, 'wall', { color: '#8d9aa8', seg: 40 });
      for (let i = 0; i < 3; i++) {                         // rotating arms
        m.boxRot(0, 0.6, 0, 7.0, 1.0, 0.35, [0, 1, 0], i * Math.PI / 3, 'hazard',
          { color: '#c94a3d', dyn: 'coreArm' });
      }
      m.cyl(0, 0, 0, 1.0, 0.8, 1.4, 'wall', { seg: 20, color: '#6f7d8c' });
      m.sphere(0, 2.0, 0, 1.05, 'glowRed', { color: '#ff3b3b', collide: false });
      m.ringPrism(0, 0, 2.4, 2.7, 0.03, 0.02, 'glow', { color: '#ffd93a', seg: 32, collide: false });
      footprint(m);
    },
  });

/* ── decisions surfaced for human sign-off ────────────────────────────── */

const _DECISIONS = [
  {
    id: 'D01',
    title: 'Friction column read as GRIP, not Coulomb µ',
    body: 'The documentation labels the column µ. The solver treats collider.piece.friction as a grip coefficient fed straight into the slip impulse (handoff §2.4), which explicitly warns this is easy to get inverted. The documentation\'s ordering already matches grip — 0.05 ice, 0.95 melted cheese — so all 64 values transfer verbatim with no remapping.',
    impact: 'None if you agree with the reading. If the column really is µ, every value needs inverting and the kit feels backwards.',
  },
  {
    id: 'D02',
    title: 'Track width 4.0 m → 2.4 m',
    body: `Documentation §2 specifies a 4.0 m track. Handoff §3 and §4.3 specify a 0.35 m ball and say to set corridor width from the ball: 6r = 2.1 m is "comfortable", 9r = 3.15 m is "generous / tutorial". 4.0 m is 11.4r. TRACK is ${TRACK} m (6.9r); the narrow beam is ${TRACK_NARROW} m (3r, the stated playable minimum).`,
    impact: 'Alternative is to keep 4.0 m and scale the ball to r ≈ 0.67, which invalidates the handoff\'s tuning column. Changing this later means re-tuning every piece width.',
  },
  {
    id: 'D03',
    title: 'Elevation steps +3.0/+6.0 m → +1.2/+2.4 m',
    body: `Documentation §2 gives L1 = +3 m, L2 = +6 m. Over a 10 m tile that is 16.7° and 31°, and gravity down a 16.7° slope is ${(TUNING.GRAVITY * Math.sin(16.7 * Math.PI / 180)).toFixed(2)} m/s² against ${MAX_ACCEL.toFixed(2)} m/s² of tilt — the *gentle* ramp would have been unclimbable from rest. Steps are now +${LEVELS[1]} m and +${LEVELS[2]} m, peaking at ${(peakGrade(LEVELS[1], TILE) * 180 / Math.PI).toFixed(1)}° and ${(peakGrade(LEVELS[2], TILE) * 180 / Math.PI).toFixed(1)}°, which leave ${(MAX_ACCEL - TUNING.GRAVITY * Math.sin(peakGrade(LEVELS[2], TILE))).toFixed(2)} m/s² of net climb on the steeper one. The first attempt used +2.4 m and the follow-the-path bot crawled to a halt on it.`,
    impact: 'Multi-storey mazes get shallower, and 2.0 m is close to the arithmetic ceiling for a one-tile climb. Raising it means spanning two tiles, or raising MAX_TILT, which changes the feel of every other piece.',
  },
  {
    id: 'D04',
    title: 'Restitution > 1 re-expressed as a latched impulse',
    body: 'The table lists e = 1.80 (#41 bumper) and e = 1.20 (#45 mouse-trap). The solver applies v += n·(1+e)·|vn|, so e > 1 adds energy on every contact and the ball diverges. Both are given a legal restitution and the quoted kick as a one-shot impulse gated on a Latch (handoff §11.3).',
    impact: 'Feel is preserved and energy is bounded. If you want literal e > 1 the solver needs an energy budget, which is a physics change, not a piece change.',
  },
  {
    id: 'D05',
    title: 'Diagonal sockets (NE/NW) mapped onto the square lattice',
    body: 'Pieces #11, #12 and #19 list NE/NW sockets. A 4-socket square lattice has no diagonal port. #11 and #12 are centred S→N doglegs that bow west/east; #19 is S in with N and E out — straight-through or commit, which is the decision the fork exists to create.',
    impact: 'Keeps Wave Function Collapse on a plain 4-neighbour grid. A true 8-way lattice would need a different generator.',
  },
  {
    id: 'D06',
    title: '#15 hairpin needs a two-lane edge',
    body: 'The documentation gives #15 sockets S_in and S_out — two ports on one edge. It is the only piece in the kit that needs this. It is built with both ports on the S edge at lanes ±1.55 m and must mate with a double-wide corridor mouth.',
    impact: 'Either the generator learns about lanes, or #15 is placed by hand as a set-piece, or it is cut. Currently it is buildable but not WFC-placeable.',
  },
  {
    id: 'D08',
    title: `Kerb height 0.30 m → ${KERB_H} m`,
    body: `Hopping a kerb needs v_lateral ≥ √(2·g·h). At 0.30 m that is 3.3 m/s, less than the ball picks up crossing its own corridor, so kerbed corridors did not contain it — the headless solvability bot fell out 61 times per run and most daily seeds failed their own publish gate. At ${KERB_H} m the bar is ${Math.sqrt(2 * TUNING.GRAVITY * KERB_H).toFixed(2)} m/s against the ${Math.sqrt(2 * MAX_ACCEL * 1.2).toFixed(2)} m/s that full lateral tilt can build across half a corridor.`,
    impact: 'This is the "how much Monkey Ball" dial. Falling off is the genre, but a daily everyone is meant to finish cannot be a fall-fest. The pieces that are supposed to drop you — #02, #10, #35, #36 — have no kerb and are unaffected. Lower it if you want the set to bite harder.',
  },
  {
    id: 'D07',
    title: '#30/#31 are 180° banked loops, not 360° corkscrews',
    body: `A true 360° corkscrew entering the S edge and leaving the N edge on the same centre-line must cross over itself, and with only ${LEVELS[2]} m of elevation to play with the crossing clearance came out around 0.45 m — a ${(BALL_R * 2).toFixed(1)} m ball plus a ${DECK_T} m deck needs about 1.0 m. They are built instead as banked 180° loops that bulge west (up) and east (down).`,
    impact: 'The gameplay purpose survives — the climb is spread over a longer path than a straight ramp, at a gentler grade. A literal corkscrew needs either a taller elevation step (which D03 rules out) or a 2×2-tile footprint.',
  },
];

/** Sorted by id, so the review page lists them in the order people cite them. */
export const DECISIONS = _DECISIONS.slice().sort((a, b) => a.id.localeCompare(b.id));

/* ── public API ───────────────────────────────────────────────────────── */

export const PIECES = P;
export const PIECE_BY_ID = new Map(P.map(p => [p.id, p]));

/** Build one piece. Returns render buckets, per-material colliders and bounds. */
export function buildPiece (id) {
  const piece = PIECE_BY_ID.get(id);
  if (!piece) throw new Error(`no piece #${id}`);
  const m = new Mesher();
  piece.build(m);
  footprint(m);                                            // idempotent; every tile gets one
  const groups = m.build().map(g => Object.assign(g, { spec: resolveMaterial(g.material, piece) }));
  return {
    piece,
    groups,
    colliders: m.colliderSpecs().map(c => Object.assign(c, { spec: resolveMaterial(c.material, piece) })),
    // Moving parts, in piece-local space. Deliberately absent from `colliders`:
    // a DynamicBody supplies their collision, and baking the frozen pose into
    // the soup as well turns a swinging hammer into a wall (handoff §8).
    dynamic: m.dynamicGroups(),
    routes: m.routes,
    bounds: m.bounds(),
    triangles: m.triCount,
    collisionTriangles: m.colTriCount,
  };
}

/** Every piece, built. Used by the self-tests and the review page. */
export function buildAll () {
  return PIECES.map(p => buildPiece(p.id));
}

export const KIT_VERSION = '1.0.0';
export const KIT_NAME = 'Rat in a Ball — 64 Environmental Pieces';

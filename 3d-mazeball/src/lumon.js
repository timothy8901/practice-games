/**
 * lumon.js — one authored floor, instead of a different one every day.
 *
 * The daily generator in generator.js is still there and still works. This is
 * the MVP path beside it: a single hand-drawn Lumon floor that is the same every
 * time you load it, so it can be *designed* — long sightlines, corridors that
 * come back on themselves, wings you can look down and choose not to enter.
 * A seeded maze cannot be designed, only tuned.
 *
 * WHY THE MAP IS ASCII
 * --------------------
 * The floor plan below is the actual source of truth, not a comment describing
 * one. You can see the shape of the building by looking at it, move a corridor
 * by moving a character, and review a change as a diff that reads like a floor
 * plan. Piece ids and rotations are *derived* from it — hand-authoring 30-odd
 * {pieceId, rot} pairs is how you get a corridor rotated 90 degrees into a wall
 * and spend an afternoon finding it.
 *
 * Connectivity is plain orthogonal adjacency: two neighbouring tiles are joined.
 * That one rule is what makes the drawing legible, and it is why loops cost
 * nothing to author — the corridor from MDR doubles back to the main hall at
 * column 3, so you can arrive at the same junction from two directions and not
 * be sure you have. That disorientation is the point of the floor.
 *
 * The piece for each tile comes from the same socket index the generator uses
 * (`pieceIndex()`, keyed N-E-S-W), so a tile here is matched by exactly the
 * rules that validate a daily seed. What this module adds is a *preference*:
 * given a signature, take the plain corridor piece, never the trapdoor or the
 * cheese wheel. An office floor has no gimmicks in it.
 */

import { PIECE_BY_ID } from './pieces.js';
import { pieceIndex, pieceKeyAt, mazeFingerprint } from './generator.js';
import { TILE, HALF, DIRS, DELTA } from './kit.js';
import { MDR } from './theme.js';

/**
 * The three floors, one character per 10 m tile.
 *
 *   .  nothing — the building does not extend here
 *   #  corridor
 *   S  MDR. Where you wake up, and the start.
 *   E  the elevator. The way out, and the goal.
 *   P  Perpetuity Wing   ·  B  Break Room  ·  W  Wellness  — dead ends
 *   ~  reserved: MDR's floor plate covers this square, so nothing may be
 *      placed here. No tile and no connection — identical to `.` for routing.
 *
 * Read each as a plan seen from above, north at the top.
 *
 * WHY `~` EXISTS
 * --------------
 * The lattice places pieces; it does not clamp their geometry. MDR is ONE cell
 * whose room is 19 x 20 m — four tiles' worth of floor — so the squares that
 * room covers have to be kept clear or a corridor gets built inside the office.
 * Marking them rather than leaving them blank means each plan shows the room's
 * real footprint. `lumonFloor` also checks it: the reservation is verified
 * against the room's actual bounds, so a new floor that gets it wrong fails
 * loudly at build time instead of quietly overlapping.
 *
 * DIFFICULTY IS SHAPE, NOT SPEED
 * ------------------------------
 * Nothing about the physics changes between these. What changes is how many
 * decisions the floor asks for: `easy` is one corridor with a single turn and
 * one wing you can see into from the junction, `hard` is a long serpentine with
 * junctions that look alike and wings that dead-end deep. The tilt, the ball
 * and the walls are identical on all three.
 */
export const FLOORS = {
  easy: {
    key: 'easy',
    name: 'Easy',
    blurb: 'One hallway, one turn. The elevator is almost in sight.',
    plan: `
~~.....
~S###..
~~.B#..
....#..
....E..
.......
.......
`,
  },

  medium: {
    key: 'medium',
    name: 'Medium',
    blurb: 'Two wings and a corridor that doubles back on itself.',
    plan: `
~~.......
~S######.
~~.#...#.
.#######.
.#...#...
.#...P...
.#.B.....
.####E...
.........
`,
  },

  hard: {
    key: 'hard',
    name: 'Hard',
    blurb: 'A full floor. Junctions that look alike, and three wings that do not help.',
    plan: `
~~..........
~S#########.
~~.#.....#..
.#########..
.#..#....#..
.#..P....#..
.#########..
.#..#....#..
.#..B....#..
.#########..
.#.......#..
.#W#####E#..
`,
  },
};

/** Kept for anything that still wants the default plan by name. */
export const FLOOR = FLOORS.medium.plan;

/** What the landmark characters mean, for the HUD and for the review page. */
export const LANDMARKS = {
  S: { name: 'Macrodata Refinement', short: 'MDR', pieceId: 57 },
  E: { name: 'The elevator', short: 'Elevator', pieceId: 58 },
  P: { name: 'Perpetuity Wing', short: 'Perpetuity', pieceId: 21 },
  B: { name: 'Break Room', short: 'Break Room', pieceId: 21 },
};

/**
 * Which piece to use for a given socket signature.
 *
 * The generator picks from every piece that fits, weighted by a difficulty
 * budget, which is what makes a daily maze varied. A floor of an office
 * building wants the opposite: the same corridor, over and over, so that the
 * few things that are not corridor carry all the meaning. These are the plain
 * ones — wide straight, wide turn, T, cross — and nothing else is ever chosen.
 */
const PREFERRED = [1, 9, 17, 18, 21, 57, 58];

const idx = (x, z, w) => z * w + x;

/** Parse the ASCII plan into a grid of { ch } or null. */
function parse (art) {
  const rows = art.split('\n').map(r => r.replace(/\s+$/, '')).filter(r => r.length);
  const height = rows.length;
  const width = Math.max(...rows.map(r => r.length));
  const grid = [];
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[z][x] || '.';
      grid[idx(x, z, width)] = ch === '.' ? null : ch;
    }
  }
  return { grid, width, height };
}

/**
 * Choose a piece for one tile.
 *
 * Landmarks are pinned by LANDMARKS, so MDR is always the spawn and the
 * elevator is always the goal; everything else is looked up by signature. The
 * rotation comes from the index rather than from arithmetic here, so a tile is
 * oriented by the same code that decides a daily seed is valid.
 */
function pieceFor (ch, sig) {
  const pin = LANDMARKS[ch]?.pieceId;
  const options = pieceIndex().get(sig) || [];
  if (pin != null) {
    const piece = PIECE_BY_ID.get(pin);
    for (let rot = 0; rot < 4; rot++) {
      if (pieceKeyAt(piece, rot) === sig) return { id: pin, rot, piece };
    }
  }
  for (const want of PREFERRED) {
    const hit = options.find(o => o.id === want);
    if (hit) return hit;
  }
  return options[0] || null;
}

/**
 * Build the floor.
 *
 * Returns the same shape generateMaze() does, so assembleMaze, the validator,
 * the bot and the review page all take it without knowing the difference.
 */
export function lumonFloor (difficulty = 'medium') {
  const spec = FLOORS[difficulty] || FLOORS.medium;
  const { grid, width, height } = parse(spec.plan);
  const cells = [];
  const cellAt = new Map();
  const open = new Set();
  const failures = [];

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[idx(x, z, width)];
      if (!ch || ch === '~') continue;          // reserved by MDR's floor plate

      const dirs = {};
      for (const d of DIRS) {
        const [dx, dz] = DELTA[d];
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
        // The value is the socket's ELEVATION LEVEL, not a boolean. Downstream
        // code reads it as `LEVELS[c.dirs[d]]`, so a `true` here becomes
        // LEVELS[true] === undefined and every edge waypoint loses its height —
        // which shows up far away as "the route is unsupported".
        // This floor is flat, so every opening is level 0.
        const n = grid[idx(nx, nz, width)];
        if (n && n !== '~') dirs[d] = 0;
      }
      const sig = DIRS.map(d => (dirs[d] === undefined ? '-' : String(dirs[d]))).join('');
      const chosen = pieceFor(ch, sig);
      if (!chosen) {
        failures.push({ cell: idx(x, z, width), cx: x, cz: z, key: sig, ch });
        continue;
      }

      const cell = {
        cell: idx(x, z, width), cx: x, cz: z,
        pieceId: chosen.id, rot: chosen.rot,
        key: sig,
        dirs,
        landmark: LANDMARKS[ch] ? { ch, ...LANDMARKS[ch] } : null,
        onPath: false, pathIndex: -1,
        danger: 0, budget: 0,
      };
      cells.push(cell);
      cellAt.set(cell.cell, cell);
      open.add(cell.cell);
    }
  }

  const start = cells.find(c => c.landmark?.ch === 'S');
  const goal = cells.find(c => c.landmark?.ch === 'E');
  const route = start && goal ? shortestPath(cellAt, start, goal, width, height) : [];
  route.forEach((c, i) => { c.onPath = true; c.pathIndex = i; });

  return {
    seed: 0,                         // authored, not seeded — kept for shape
    authored: true,
    difficulty: spec.key,
    floorName: spec.name,
    blurb: spec.blurb,
    reservation: checkReservation(start, cells, width, height),
    width, height, tile: TILE,
    cells, cellAt, open,
    start, goal,
    solution: route,
    solutionCells: route.map(c => c.cell),
    spurs: [], bumps: [], portalPair: null, secret: null,
    failures,
    world: null,
    stats: {
      occupied: cells.length,
      pathLength: route.length,
      deadEnds: cells.filter(c => Object.keys(c.dirs).length === 1).length,
      bumps: 0,
      distinctPieces: new Set(cells.map(c => c.pieceId)).size,
      hazards: 0,
      metres: Math.round(route.length * TILE),
      landmarks: cells.filter(c => c.landmark).length,
    },
  };
}

/**
 * Does MDR's floor plate land on top of anything?
 *
 * MDR is one cell that builds four tiles' worth of room, so the squares it
 * covers must be kept clear in the plan. Hand-tracing that on a 12 x 12 grid is
 * exactly the kind of check a person does wrong once and then trusts forever,
 * so it is computed here from the room's real bounds and reported on the maze.
 * A new floor that gets the `~` marks wrong shows up as a failure instead of a
 * corridor quietly buried inside the office.
 */
function checkReservation (start, cells, width, height) {
  if (!start) return { ok: true, overlaps: [] };
  const open = Object.keys(start.dirs);
  if (open.length !== 1) return { ok: true, overlaps: [] };

  const [fx, fz] = DELTA[open[0]];
  const rx = -fz, rz = fx;
  const centre = (cx, cz) => ({
    x: (cx - (width - 1) / 2) * TILE,
    z: (cz - (height - 1) / 2) * TILE,
  });
  const c = centre(start.cx, start.cz);
  const corners = [
    [MDR.back, -MDR.across], [MDR.back, MDR.across],
    [MDR.front, -MDR.across], [MDR.front, MDR.across],
  ].map(([a, ac]) => [c.x + fx * a + rx * ac, c.z + fz * a + rz * ac]);
  const lo = [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1]))];
  const hi = [Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))];

  const overlaps = [];
  for (const cell of cells) {
    if (cell === start) continue;
    const t = centre(cell.cx, cell.cz);
    if (t.x - HALF < hi[0] - 0.01 && t.x + HALF > lo[0] + 0.01
      && t.z - HALF < hi[1] - 0.01 && t.z + HALF > lo[1] + 0.01) {
      overlaps.push({ cx: cell.cx, cz: cell.cz, pieceId: cell.pieceId });
    }
  }
  return { ok: overlaps.length === 0, bounds: { lo, hi }, overlaps };
}

/** Breadth-first, because on a floor with loops the shortest way out is the route. */
function shortestPath (cellAt, start, goal, width, height) {
  const prev = new Map([[start.cell, null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goal) break;
    for (const d of Object.keys(cur.dirs)) {
      const [dx, dz] = DELTA[d];
      const nx = cur.cx + dx, nz = cur.cz + dz;
      if (nx < 0 || nz < 0 || nx >= width || nz >= height) continue;
      const next = cellAt.get(nz * width + nx);
      if (!next || prev.has(next.cell)) continue;
      prev.set(next.cell, cur);
      queue.push(next);
    }
  }
  if (!prev.has(goal.cell)) return [];
  const out = [];
  for (let c = goal; c; c = prev.get(c.cell)) out.push(c);
  return out.reverse();
}

/**
 * Name, blurb and measurements for one floor, for a menu to list.
 *
 * Derived by building the plan rather than typed alongside it: a hand-written
 * "70 m" next to the ASCII is a second source of truth that goes stale the
 * first time someone moves a corridor. Cached, because a stage list re-renders
 * on every arrow key.
 */
const _summary = new Map();
export function floorSummary (key) {
  if (!_summary.has(key)) {
    const f = lumonFloor(key);
    _summary.set(key, {
      key: f.difficulty, name: f.floorName, blurb: f.blurb,
      metres: f.stats.metres, route: f.stats.pathLength, rooms: f.stats.occupied,
    });
  }
  return _summary.get(key);
}

/**
 * The canonical maze fingerprint, re-exported.
 *
 * Deliberately NOT a second implementation: this floor had its own for a while
 * and the page ended up printing two different ids for one map — the header's
 * and the check row's — which reads as a bug in the floor rather than in the
 * labelling.
 */
export { mazeFingerprint as floorFingerprint };

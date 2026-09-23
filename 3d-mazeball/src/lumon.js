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
import { TILE, DIRS, DELTA } from './kit.js';

/**
 * The severed floor, one character per 10 m tile.
 *
 *   .  nothing — the building does not extend here
 *   #  corridor
 *   S  MDR. Where you wake up, and the start.
 *   E  the elevator. The way out, and the goal.
 *   P  Perpetuity Wing   — dead end off the main hall
 *   B  Break Room        — dead end off the south corridor
 *
 * Read it as a plan seen from above, north at the top.
 */
export const FLOOR = `
.........
.S######.
...#...#.
.#######.
.#...#...
.#...P...
.#.B.....
.####E...
.........
`;

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
export function lumonFloor () {
  const { grid, width, height } = parse(FLOOR);
  const cells = [];
  const cellAt = new Map();
  const open = new Set();
  const failures = [];

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[idx(x, z, width)];
      if (!ch) continue;

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
        if (grid[idx(nx, nz, width)]) dirs[d] = 0;
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
 * The canonical maze fingerprint, re-exported.
 *
 * Deliberately NOT a second implementation: this floor had its own for a while
 * and the page ended up printing two different ids for one map — the header's
 * and the check row's — which reads as a bug in the floor rather than in the
 * labelling.
 */
export { mazeFingerprint as floorFingerprint };

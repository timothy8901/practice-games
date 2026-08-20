/**
 * generator.js — the daily maze.
 *
 * Implements documentation §4's four phases against the socket contract in
 * pieces.js, under the determinism rules in PHYSICS-ENGINE-HANDOFF.md §5.2:
 *
 *   1. Graph topology       spanning tree → solution path → pruned branches
 *   2. Socket matching      exact (dirs × elevations) lookup over all rotations
 *   3. Difficulty injection budget curve along the path, plus collectibles
 *   4. Instantiation        assemble.js
 *
 * Every random decision comes from one seeded `mulberry32` stream. Nothing here
 * calls Math.random, Date.now or performance.now, nothing sorts with a random
 * comparator, and generation order never depends on the player — so the same
 * date rebuilds the same maze on every engine.
 */

import { hash32, mulberry32, shuffle, weightedPick } from './rng.js';
import { PIECES, PIECE_BY_ID } from './pieces.js';
import { DIRS, DELTA, OPPOSITE, rotateDir, TILE, LEVELS } from './kit.js';

/* ── seeds ────────────────────────────────────────────────────────────── */

/**
 * The daily seed, from the UTC date. Local dates would put a player in Auckland
 * and a player in Los Angeles on different puzzles, which breaks the entire
 * social loop of a daily (handoff §5.1).
 */
export function dailySeed (d = new Date()) {
  return hash32(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Seed for an explicit 'YYYY-MM-DD', so any day can be replayed or previewed. */
export function seedForDate (iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return hash32(y, m, d);
}

export function isoToday (d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* ── the piece index ──────────────────────────────────────────────────── */

/**
 * The socket signature a piece presents to the world at rotation `rot`, as four
 * characters in N,E,S,W order: an elevation digit for an open edge, '-' for a
 * closed one. "0-0-" is a north-south straight at ground level.
 */
export function pieceKeyAt (piece, rot) {
  const k = ['-', '-', '-', '-'];
  for (let i = 0; i < 4; i++) {
    const local = rotateDir(DIRS[i], -rot);
    const lvl = piece.sockets[local];
    if (lvl !== undefined) k[i] = String(lvl);
  }
  return k.join('');
}

/**
 * Pieces the generator will not place by itself, and why. Each one is a real
 * gap rather than an oversight, and each is surfaced in the review page.
 */
export const NOT_AUTO_PLACED = {
  15: 'D06 — both ports are on the S edge; needs a two-lane corridor mouth the lattice cannot express.',
  32: 'Air port. Needs a partnered gap and a ballistic check; place #32→#33 by hand.',
  33: 'Air port. Landing pad for #32.',
  50: 'Air port. Cannon entry, needs a partnered #51 and a flight path.',
  51: 'Air port. Cannon exit for #50.',
  62: 'The gate opens on a Key item, and no piece grants one yet — auto-placing it would wall off the maze.',
};

/** Pieces that hand the ball a lot of speed it did not ask for. */
const SPEED_PIECES = new Set([4, 6, 8, 28, 32]);

/** Reserved for a specific structural role rather than the general pool. */
const RESERVED = new Set([57, 58, 63, 53, 54, 59, 60, 61, 64, 21]);

/**
 * How dangerous each piece is, 0..1. Drives the Phase 3 budget curve. Derived
 * from the category with per-piece overrides where the category is too coarse.
 */
const DANGER_BY_CAT = { 1: 0.08, 2: 0.22, 3: 0.25, 4: 0.38, 5: 0.55, 6: 0.85, 7: 0.6, 8: 0.05 };
const DANGER_OVERRIDE = {
  2: 0.55,   // razor plank
  3: 0.5,    // dashed gaps
  8: 0.6,    // ice
  7: 0.45,   // reverse conveyor
  10: 0.45,  // sharp corner
  35: 0.85,  // single pipe rail
  36: 0.6,
  37: 0.7,   // broken bridge — needs speed
  40: 0.5,
  41: 0.55,  // bumper is chaotic, not lethal
  48: 1.0,   // acid pit
  46: 0.8,
  56: 0.7,
};

export function dangerOf (piece) {
  return DANGER_OVERRIDE[piece.id] ?? DANGER_BY_CAT[piece.cat] ?? 0.4;
}

let _index = null;

/** signature → [{ id, rot, piece, danger }], built once. */
export function pieceIndex () {
  if (_index) return _index;
  _index = new Map();
  for (const p of PIECES) {
    if (NOT_AUTO_PLACED[p.id]) continue;
    const seen = new Set();
    for (let rot = 0; rot < 4; rot++) {
      const key = pieceKeyAt(p, rot);
      if (seen.has(key)) continue;         // symmetric piece: one entry per distinct pose
      seen.add(key);
      if (!_index.has(key)) _index.set(key, []);
      _index.get(key).push({ id: p.id, rot, piece: p, danger: dangerOf(p) });
    }
  }
  return _index;
}

const candidatesFor = key => pieceIndex().get(key) || [];

/* ── phase 1: topology ────────────────────────────────────────────────── */

const idx = (x, z, w) => z * w + x;

/**
 * Recursive backtracker with a straightness bias. Produces a perfect maze —
 * every cell reachable, no loops — but with long corridors instead of the
 * corner-every-cell texture the unbiased version gives.
 *
 * Two reasons for the bias, and the first is the important one:
 *
 * 1. Handoff §5.3: "long straights before tight turns — the ball arrives fast
 *    and overshoots. This is your primary difficulty knob and it costs nothing
 *    to author." An unbiased maze never lets the ball build speed.
 * 2. Only three of the 64 pieces are corners (#09, #10, #16), against roughly
 *    thirty straights. An unbiased maze is ~50% corners, so half of it is those
 *    same three tiles. `straightness` is what keeps the set legible.
 */
function carve (rand, w, h, straightness = 4.5) {
  const walls = Array.from({ length: w * h }, () => ({ N: true, E: true, S: true, W: true }));
  const seen = new Uint8Array(w * h);
  const stack = [[Math.floor(rand() * w), Math.floor(rand() * h), null]];
  seen[idx(stack[0][0], stack[0][1], w)] = 1;
  while (stack.length) {
    const top = stack[stack.length - 1];
    const [x, z, came] = top;
    const options = [];
    for (const d of DIRS) {
      const [dx, dz] = DELTA[d];
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      if (seen[idx(nx, nz, w)]) continue;
      options.push(d);
    }
    if (!options.length) { stack.pop(); continue; }
    const d = weightedPick(rand, options, o => (o === came ? straightness : 1));
    const nx = x + DELTA[d][0], nz = z + DELTA[d][1];
    walls[idx(x, z, w)][d] = false;
    walls[idx(nx, nz, w)][OPPOSITE[d]] = false;
    seen[idx(nx, nz, w)] = 1;
    stack.push([nx, nz, d]);
  }
  return walls;
}

/** Breadth-first distances and parents over the carved tree. */
function bfs (walls, w, h, sx, sz) {
  const dist = new Int32Array(w * h).fill(-1);
  const from = new Int32Array(w * h).fill(-1);
  const q = [idx(sx, sz, w)];
  dist[q[0]] = 0;
  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const x = cur % w, z = (cur / w) | 0;
    for (const d of DIRS) {
      if (walls[cur][d]) continue;
      const [dx, dz] = DELTA[d];
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const n = idx(nx, nz, w);
      if (dist[n] !== -1) continue;
      dist[n] = dist[cur] + 1; from[n] = cur;
      q.push(n);
    }
  }
  return { dist, from };
}

const farthest = d => { let b = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[b]) b = i; return b; };

/* ── phase 3 helper: budget curve ─────────────────────────────────────── */

/** Difficulty allowance at position `t` along the solution path, 0..1. */
export const budgetAt = t => 0.12 + 0.78 * Math.pow(t, 1.15);

/** Calm / moderate / spicy, and where each band sits on the budget scale. */
export const bandOf = d => (d < 0.3 ? 0 : d < 0.6 ? 1 : 2);
export const BAND_CENTRE = [0.14, 0.45, 0.82];
export const BAND_NAME = ['calm', 'moderate', 'spicy'];

/* ── the generator ────────────────────────────────────────────────────── */

/**
 * @param opts.seed       32-bit integer; use dailySeed() for the daily
 * @param opts.width      lattice cells (each 10 m)
 * @param opts.height
 * @param opts.branches   how many dead-end spurs to keep off the solution path
 * @param opts.bumps      how many elevation bumps to attempt
 */
export function generateMaze (opts = {}) {
  const seed = opts.seed >>> 0;
  const w = opts.width ?? 6;
  const h = opts.height ?? 6;
  const branchBudget = opts.branches ?? 6;
  const bumpBudget = opts.bumps ?? 4;
  const rand = mulberry32(seed);

  /* Phase 1 — topology. */
  const walls = carve(rand, w, h, opts.straightness ?? 4.5);
  const a = farthest(bfs(walls, w, h, 0, 0).dist);
  const fromA = bfs(walls, w, h, a % w, (a / w) | 0);
  const b = farthest(fromA.dist);

  const path = [];
  for (let cur = b; cur !== -1; cur = fromA.from[cur]) path.push(cur);
  path.reverse();                                   // start = a, goal = b
  const onPath = new Map(path.map((c, i) => [c, i]));

  // Keep a handful of dead-end spurs off the path. Handoff §5.3: dead ends
  // should cost time, not lives, and they are what make the maze read as a maze
  // rather than as a corridor.
  const occupied = new Set(path);
  const spurs = [];
  const seeds = shuffle(rand, path.slice(1, -1));
  for (const cell of seeds) {
    if (spurs.length >= branchBudget) break;
    const x = cell % w, z = (cell / w) | 0;
    const outs = DIRS.filter(d => {
      if (walls[cell][d]) return false;
      const [dx, dz] = DELTA[d];
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) return false;
      return !occupied.has(idx(nx, nz, w));
    });
    if (!outs.length) continue;
    const d = shuffle(rand, outs)[0];
    let cx = x + DELTA[d][0], cz = z + DELTA[d][1];
    const spur = [];
    const len = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < len; k++) {
      const c = idx(cx, cz, w);
      if (occupied.has(c)) break;
      occupied.add(c); spur.push(c);
      const nexts = DIRS.filter(dd => {
        if (walls[c][dd]) return false;
        const nx = cx + DELTA[dd][0], nz = cz + DELTA[dd][1];
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) return false;
        return !occupied.has(idx(nx, nz, w));
      });
      if (!nexts.length) break;
      const nd = shuffle(rand, nexts)[0];
      cx += DELTA[nd][0]; cz += DELTA[nd][1];
    }
    if (spur.length) spurs.push(spur);
  }

  // Open directions per occupied cell: a tree edge to another occupied cell.
  const open = new Map();
  for (const c of occupied) {
    const x = c % w, z = (c / w) | 0;
    const dirs = {};
    for (const d of DIRS) {
      if (walls[c][d]) continue;
      const nx = x + DELTA[d][0], nz = z + DELTA[d][1];
      if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
      const n = idx(nx, nz, w);
      if (!occupied.has(n)) continue;
      dirs[d] = 0;                                  // elevation, filled in below
    }
    open.set(c, dirs);
  }

  /* Elevation bumps.
   *
   * The kit has no flat piece at L1 or L2 — every ramp starts or ends at L0 —
   * so a plateau is not expressible. An elevation change therefore has to be a
   * bump: one climbing cell immediately followed by a descending one, sharing a
   * raised edge. Both cells must be straight-through, because every ramp in the
   * set is a straight. This is a real constraint of the 64 pieces, not a
   * shortcut; see PIECES-SPEC.md §3 D03. */
  const bumps = [];
  const straightThrough = c => {
    const d = Object.keys(open.get(c) || {});
    return d.length === 2 && OPPOSITE[d[0]] === d[1];
  };
  const usedForBump = new Set();
  for (let i = 1; i < path.length - 2 && bumps.length < bumpBudget; i++) {
    const c0 = path[i], c1 = path[i + 1];
    if (usedForBump.has(c0) || usedForBump.has(c1)) continue;
    if (!straightThrough(c0) || !straightThrough(c1)) continue;
    if (rand() > 0.75) continue;
    const level = rand() < 0.62 ? 1 : 2;
    // the shared edge rises; every other edge of both cells stays at L0
    const x0 = c0 % w, z0 = (c0 / w) | 0;
    const dir = DIRS.find(d => idx(x0 + DELTA[d][0], z0 + DELTA[d][1], w) === c1);
    open.get(c0)[dir] = level;
    open.get(c1)[OPPOSITE[dir]] = level;
    usedForBump.add(c0); usedForBump.add(c1);
    bumps.push({ up: c0, down: c1, level, dir });
    i++;                                            // do not chain two bumps
  }

  /* Phase 2 + 3 — choose a piece for every cell. */
  const start = path[0], goal = path[path.length - 1];
  const deadEnds = [...occupied].filter(c => Object.keys(open.get(c)).length === 1 && c !== start && c !== goal);
  const deadEndOrder = shuffle(rand, deadEnds);

  // Structural assignments made before the general pool gets a say.
  const forced = new Map();
  forced.set(start, 57);
  forced.set(goal, 58);

  // A portal pair, if there are two dead ends to hang it off. Handoff §11.4 is
  // handled at runtime; here it just has to be a genuine pair.
  let portalPair = null;
  if (deadEndOrder.length >= 2) {
    forced.set(deadEndOrder[0], 53);
    forced.set(deadEndOrder[1], 54);
    portalPair = [deadEndOrder[0], deadEndOrder[1]];
  }
  // The bonus goal, on a third dead end.
  let secret = null;
  if (deadEndOrder.length >= 3) { forced.set(deadEndOrder[2], 63); secret = deadEndOrder[2]; }
  // Everything else that dead-ends gets the rubber wall.
  for (const c of deadEndOrder.slice(3)) forced.set(c, 21);

  // The boss chamber takes the 4-way junction nearest the middle, if there is one.
  const fourWays = [...occupied].filter(c => Object.keys(open.get(c)).length === 4);
  if (fourWays.length) {
    const mid = [(w - 1) / 2, (h - 1) / 2];
    let best = fourWays[0], bestD = Infinity;
    for (const c of fourWays) {                      // deterministic: scan in cell order
      const d = Math.hypot(c % w - mid[0], ((c / w) | 0) - mid[1]);
      if (d < bestD - 1e-9) { bestD = d; best = c; }
    }
    forced.set(best, 64);
  }

  // Checkpoints and pickups along the path, on plain straight-through cells.
  const pathStraights = path.filter((c, i) => i > 1 && i < path.length - 2
    && straightThrough(c) && !forced.has(c) && !usedForBump.has(c));
  const every = Math.max(4, Math.round(path.length / 4));
  pathStraights.forEach((c, i) => {
    if (i % every === every - 1) forced.set(c, 59);   // checkpoint
  });
  const treats = shuffle(rand, pathStraights.filter(c => !forced.has(c)));
  treats.slice(0, 3).forEach(c => forced.set(c, 60));            // golden cheese
  treats.slice(3, 5).forEach(c => forced.set(c, 61));            // +10 s clock

  const recent = [];
  const cells = [];
  const failures = [];

  for (const c of [...occupied].sort((p, q) => p - q)) {          // deterministic order
    const x = c % w, z = (c / w) | 0;
    const dirs = open.get(c);
    const key = DIRS.map(d => (dirs[d] === undefined ? '-' : String(dirs[d]))).join('');
    const t = onPath.has(c) ? onPath.get(c) / Math.max(1, path.length - 1) : 0.5;

    let pool = candidatesFor(key);

    // A bump cell must take one of the ramps — nothing else changes elevation.
    const bump = bumps.find(bp => bp.up === c || bp.down === c);
    if (bump) {
      pool = pool.filter(cand => cand.piece.cat === 4);
    } else if (forced.has(c)) {
      const want = forced.get(c);
      const exact = pool.filter(cand => cand.id === want);
      if (exact.length) pool = exact;
      else pool = pool.filter(cand => !RESERVED.has(cand.id));   // forced piece does not fit here
    } else {
      pool = pool.filter(cand => !RESERVED.has(cand.id));
    }

    if (!pool.length) {
      // Should not happen; recorded rather than thrown so the review page can
      // show which signature the kit cannot satisfy.
      failures.push({ cell: c, key });
      pool = candidatesFor(key);
      if (!pool.length) continue;
    }

    // Handoff §5.3 makes long straights before tight turns the difficulty knob.
    // A conveyor or a boost panel immediately before a sharp corner is that knob
    // turned past its stop: the ball arrives at 8 m/s with no room to shed it and
    // leaves the stage. Speed pieces are held back when the next cell turns.
    const nextCell = onPath.has(c) && onPath.get(c) + 1 < path.length ? path[onPath.get(c) + 1] : null;
    const nextDirs = nextCell ? Object.keys(open.get(nextCell) || {}) : [];
    const nextTurns = nextDirs.length === 2 && OPPOSITE[nextDirs[0]] !== nextDirs[1];

    const budget = budgetAt(t);
    // Weight by danger BAND rather than by piece, and divide by the band's own
    // size. Weighting per piece lets the ~30 calm straights out-vote the ~8
    // hazards by sheer count no matter what the budget says, and the curve
    // stops controlling anything: hazards came out at 3% of every maze.
    const bandSize = [0, 0, 0];
    for (const cand of pool) bandSize[bandOf(cand.danger)]++;
    const chosen = weightedPick(rand, pool, cand => {
      const band = bandOf(cand.danger);
      const fit = Math.exp(-Math.pow(BAND_CENTRE[band] - budget, 2) / 0.10) / bandSize[band];
      const stale = recent.includes(cand.id) ? 0.15 : 1;         // discourage repeats
      const offPath = onPath.has(c) ? 1 : 0.6;                    // keep spurs calmer
      const beforeTurn = nextTurns && SPEED_PIECES.has(cand.id) ? 0.08 : 1;
      return fit * stale * offPath * beforeTurn + 1e-4;
    });
    recent.push(chosen.id);
    if (recent.length > 5) recent.shift();

    cells.push({
      cell: c, cx: x, cz: z,
      pieceId: chosen.id, rot: chosen.rot,
      key,
      dirs: { ...dirs },
      onPath: onPath.has(c),
      pathIndex: onPath.has(c) ? onPath.get(c) : -1,
      danger: chosen.danger,
      budget,
      role: forced.has(c) ? 'forced' : bump ? 'ramp' : 'pool',
    });
  }

  const cellAt = new Map(cells.map(c => [c.cell, c]));
  const world = c => ({ x: (c % w - (w - 1) / 2) * TILE, z: (((c / w) | 0) - (h - 1) / 2) * TILE });

  return {
    seed,
    width: w, height: h, tile: TILE,
    cells,
    cellAt,
    open,
    start: cellAt.get(start),
    goal: cellAt.get(goal),
    solution: path.map(c => cellAt.get(c)).filter(Boolean),
    solutionCells: path,
    spurs,
    bumps,
    portalPair,
    secret,
    failures,
    world,
    stats: {
      occupied: cells.length,
      pathLength: path.length,
      deadEnds: deadEnds.length,
      bumps: bumps.length,
      distinctPieces: new Set(cells.map(c => c.pieceId)).size,
      hazards: cells.filter(c => PIECE_BY_ID.get(c.pieceId).cat === 6).length,
      metres: Math.round(path.length * TILE),
    },
  };
}

/** A stable fingerprint of a generated maze, for the reproducibility checks. */
export function mazeFingerprint (maze) {
  let h = 2166136261 >>> 0;
  const mix = n => {
    h ^= n & 0xff; h = Math.imul(h, 16777619) >>> 0;
    h ^= (n >>> 8) & 0xff; h = Math.imul(h, 16777619) >>> 0;
  };
  for (const c of maze.cells) { mix(c.cell); mix(c.pieceId); mix(c.rot); }
  mix(maze.start.cell); mix(maze.goal.cell);
  return h.toString(16).padStart(8, '0');
}

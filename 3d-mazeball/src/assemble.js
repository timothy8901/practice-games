/**
 * assemble.js — documentation §4 phase 4: turn a placement list into a world.
 *
 * Each placed piece is built in local space, rotated by its quarter-turn and
 * translated to its cell. Render geometry is merged by material so the whole
 * maze is a handful of draw calls; collision is merged by *surface* — material
 * plus friction plus bounce — because the solver reads one `{friction, bounce}`
 * per collider (handoff §2.4) and a timber deck and a steel rail must not end
 * up sharing one.
 *
 * The transform is applied once, here, to the same buffers the mesher emitted.
 * There is no second collision mesh to drift out of sync (handoff §4.4).
 */

import { buildPiece, PIECE_BY_ID } from './pieces.js';
import { TILE, HALF, BALL_R, DECK_T, LEVELS, DELTA, DIRS, EDGE_VEC, MATERIALS, resolveMaterial, isDeco } from './kit.js';
import { GridCollider, binsFor, supportUnder, nearestSurface } from './physics.js';
import { Mesher, parseColor } from './mesher.js';
import { PROPS, HALL, OFFICE } from './theme.js';

/**
 * Build a themed prop in place of a piece. Same shape as buildPiece(), so the
 * rest of assembly cannot tell the difference — including the route, so the
 * corridor walls and the racing line stitch onto it exactly as they would to a
 * normal tile.
 */
function buildProp (cell, piece) {
  const m = new Mesher();
  const dir = DIRS.find(d => piece.sockets[d] !== undefined) || 'N';
  const [ex, ez] = EDGE_VEC[dir];
  PROPS[piece.id](m, { x: ex, z: ez }, HALF, DECK_T);
  return {
    piece,
    groups: m.build().map(g => Object.assign(g, { spec: resolveMaterial(g.material, piece) })),
    colliders: m.colliderSpecs().map(c => Object.assign(c, { spec: resolveMaterial(c.material, piece) })),
    dynamic: m.dynamicGroups(),
    routes: m.routes,
    bounds: m.bounds(),
    triangles: m.triCount,
    collisionTriangles: m.colTriCount,
  };
}

/**
 * Rotate a local XZ pair by `rot` quarter-turns, matching the socket algebra:
 * one turn sends local north (0, −1) to world east (+1, 0), which is what
 * `rotateDir('N', 1) === 'E'` means. Get this inconsistent with sockets.js and
 * every piece faces the wrong way while the socket check still passes.
 */
export function rotXZ (x, z, rot) {
  for (let i = 0; i < (rot & 3); i++) { const t = x; x = -z; z = t; }
  return [x, z];
}

/** World-space centre of lattice cell (cx, cz) in a w×h maze. */
export function cellCentre (cx, cz, w, h) {
  return { x: (cx - (w - 1) / 2) * TILE, z: (cz - (h - 1) / 2) * TILE };
}

function transformInto (src, dst, at, rot, ox, oz, isDirection = false) {
  for (let i = 0; i < src.length; i += 3) {
    const [x, z] = rotXZ(src[i], src[i + 2], rot);
    dst[at + i] = x + (isDirection ? 0 : ox);
    dst[at + i + 1] = src[i + 1];
    dst[at + i + 2] = z + (isDirection ? 0 : oz);
  }
}

/**
 * @param maze from generateMaze()
 * @returns render groups, colliders, spawn/goal metadata and a cell lookup
 */
/**
 * @param maze  from generateMaze()
 * @param opts.trainingWheels  fence every corridor so the ball cannot leave the
 *        track sideways. Off by default: falling off is the genre, and a kit
 *        tuned around a containing kerb plays very differently from one that
 *        cannot drop you at all.
 */
export function assembleMaze (maze, opts = {}) {
  const w = maze.width, h = maze.height;
  const render = new Map();      // material → { pos: [], nor: [], col: [] }
  const surfaces = new Map();    // material|friction|bounce → { tris: [], spec }
  const placed = [];

  const office = !!opts.theme;
  for (const cell of maze.cells) {
    const piece = PIECE_BY_ID.get(cell.pieceId);
    const built = office && PROPS[cell.pieceId]
      ? buildProp(cell, piece)
      : buildPiece(cell.pieceId);
    const { x: ox, z: oz } = cellCentre(cell.cx, cell.cz, w, h);

    for (const g of built.groups) {
      let r = render.get(g.material);
      if (!r) { r = { pos: [], nor: [], col: [], spec: g.spec }; render.set(g.material, r); }
      const base = r.pos.length;
      r.pos.length += g.positions.length;
      r.nor.length += g.normals.length;
      transformInto(g.positions, r.pos, base, cell.rot, ox, oz);
      transformInto(g.normals, r.nor, base, cell.rot, 0, 0, true);
      for (let i = 0; i < g.colors.length; i++) r.col.push(g.colors[i]);
    }

    for (const c of built.colliders) {
      const spec = c.spec;
      const key = `${c.material}|${spec.friction}|${spec.bounce}`;
      let s = surfaces.get(key);
      if (!s) {
        s = { material: c.material, tris: [], spec: { friction: spec.friction, bounce: spec.bounce } };
        surfaces.set(key, s);
      }
      const base = s.tris.length;
      s.tris.length += c.tris.length;
      transformInto(c.tris, s.tris, base, cell.rot, ox, oz);
    }

    // Centre-lines, moved into world space alongside the geometry they describe.
    const routes = (built.routes || []).map(r => ({
      width: r.width,
      pts: r.pts.map(p => {
        const [x, z] = rotXZ(p.x, p.z, cell.rot);
        return { x: x + ox, y: p.y, z: z + oz };
      }),
    }));

    placed.push({ ...cell, piece, world: { x: ox, z: oz }, dynamic: built.dynamic, routes });
  }

  /* Walls.
   *
   * Rails follow each recorded centre-line at half the deck's own width plus a
   * margin, which is why routes carry their width. Segments that come near a
   * *different* route in the same tile are dropped, so a junction stays a
   * junction instead of being walled into four dead ends by its own spurs.
   *
   * Two dresses, one mechanism. `plain` is the bare bumper rail; `office` is the
   * same wall at hallway height with a skirting board, an accent stripe and a
   * ceiling panel every few metres. Either way it is real collision geometry —
   * this is what stops the ball leaving the corridor.
   *
   * It fences the sides only. A hole in the middle of a piece — the broken
   * bridge, the pit, the dashed floor — is the puzzle, and is left alone. */
  if (opts.walls || opts.trainingWheels) {
    const dress = office ? 'office' : 'plain';
    const H = dress === 'office' ? HALL.wallH : 0.95;
    const T = dress === 'office' ? HALL.wallT : 0.16;
    const OPEN = HALL.junctionOpen;

    const bucket = key => {
      let r = render.get(key);
      if (!r) {
        r = { pos: [], nor: [], col: [], spec: key === 'hallLight'
          ? { color: OFFICE.light, deco: true, emissive: 0.9 }
          : MATERIALS.rubber };
        render.set(key, r);
      }
      return r;
    };
    const wallTris = [];

    /**
     * @param collide  true renders and collides, false renders only,
     *                 'only' collides without rendering — which is how the wall
     *                 keeps its flat collidable top while the bullnose bead is
     *                 the thing you actually see there.
     */
    const face = (key, colour, quads, collide) => {
      const r = bucket(key);
      const [cr, cg, cb] = parseColor(colour);
      for (const [q0, q1, q2, q3] of quads) {
        for (const [a, b, c] of [[q0, q1, q2], [q0, q2, q3]]) {
          const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
          const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
          let mx = uy * vz - uz * vy, my = uz * vx - ux * vz, mz = ux * vy - uy * vx;
          const ml = Math.hypot(mx, my, mz);
          if (ml < 1e-9) continue;
          mx /= ml; my /= ml; mz /= ml;
          if (collide) wallTris.push(...a, ...b, ...c);
          if (collide === 'only') continue;
          r.pos.push(...a, ...b, ...c);
          r.nor.push(mx, my, mz, mx, my, mz, mx, my, mz);
          for (let i = 0; i < 3; i++) r.col.push(cr, cg, cb);
        }
      }
    };

    /**
     * Extrude a 2-D cross-section along a wall segment.
     *
     * `pts` are [lateral offset from the segment centre-line, height] pairs, and
     * consecutive pairs become one quad each. This is how every rounded edge in
     * the corridor is made: the profile carries the curve, the extrusion carries
     * it down the hallway. Decoration only, always.
     */
    const profile = (key, colour, off, pts) => {
      const quads = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [o0, y0] = pts[i], [o1, y1] = pts[i + 1];
        quads.push([off.a(o0, y0), off.b(o0, y0), off.b(o1, y1), off.a(o1, y1)]);
      }
      face(key, colour, quads, false);
    };

    /** A quarter turn as `bead` facets, from angle `t0` to `t1`. */
    const arc = (cx, cy, r, t0, t1, sign = 1) => {
      const out = [];
      for (let i = 0; i <= HALL.bead; i++) {
        const t = t0 + (t1 - t0) * (i / HALL.bead);
        out.push([cx + sign * r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      return out;
    };

    /** One wall segment between two points on the fence line. */
    const segment = (a, b, runFrom, side, half) => {
      const dx = b.x - a.x, dz = b.z - a.z;
      const L = Math.hypot(dx, dz) || 1;
      const nx = -dz / L, nz = dx / L;
      const off = (p, k, y) => [p.x + nx * k, p.y + y, p.z + nz * k];
      const t = T / 2;
      const inner = [off(a, -t, 0), off(b, -t, 0), off(b, -t, H), off(a, -t, H)];
      const outer = [off(a, t, 0), off(b, t, 0), off(b, t, H), off(a, t, H)];
      const cap = [off(a, -t, H), off(b, -t, H), off(b, t, H), off(a, t, H)];

      if (dress === 'plain') {
        face('guard', '#5cb88d', [inner, outer, cap], true);
        return runFrom + L;
      }

      // The wall proper stops short of its own top: the bullnose below covers
      // the last `capR` of it, so rendering the full slab would only put a hard
      // corner back inside the bead where it shows as a seam.
      const wallTop = H - HALL.capR;
      const shortInner = [off(a, -t, 0), off(b, -t, 0), off(b, -t, wallTop), off(a, -t, wallTop)];
      const shortOuter = [off(a, t, 0), off(b, t, 0), off(b, t, wallTop), off(a, t, wallTop)];
      face('hallWall', OFFICE.wall, [shortInner, shortOuter], false);
      // Collision keeps the original full-height slab and flat top. Nothing the
      // solver sees changed when the corridor got its radius.
      face('hallWall', OFFICE.wall, [inner, outer], 'only');
      face('hallWall', OFFICE.wallShade, [cap], 'only');

      // Bullnose over the top of the wall: a half-round laid along the segment,
      // from the inner face up over the crown and down to the outer face.
      profile('hallWall', OFFICE.wallShade,
        { a: (o, y) => off(a, o, y), b: (o, y) => off(b, o, y) },
        arc(0, wallTop, HALL.capR, Math.PI, 0));

      // Skirting board: stands proud of the wall face to catch the light, with
      // its top edge rounded over rather than mitred.
      const sk = HALL.skirtH, sp = t + HALL.skirtOut, R = HALL.skirtR;
      for (const s of [-1, 1]) {
        profile('hallTrim', OFFICE.skirting,
          { a: (o, y) => off(a, s * o, y), b: (o, y) => off(b, s * o, y) },
          [[sp, 0], [sp, sk - R], ...arc(sp - R, sk - R, R, 0, Math.PI / 2)]);
      }
      // the horizontal accent line every corridor in the building has
      const y0 = HALL.stripeY, y1 = y0 + HALL.stripeH;
      face('hallTrim', OFFICE.accent, [
        [off(a, -sp, y0), off(b, -sp, y0), off(b, -sp, y1), off(a, -sp, y1)],
      ], false);

      /* Ceiling.
       *
       * Emitted from one side only — both sides would lay two ceilings on top of
       * each other — and never collidable, so the camera's boom does not think
       * it is buried in geometry every frame.
       *
       * Three layers: the tile face, a T-bar grid on the real 0.6 m module, and
       * a recessed light panel every few metres. The grid is what sells it; a
       * flat pale plane overhead just reads as fog. */
      let run = runFrom;
      if (side < 0) {
        const hw = half * 0.995;
        const ux = dx / L, uz = dz / L;
        // The fence line is where the measurement came from; the ceiling belongs
        // over the middle of the corridor, one half-width back in from it.
        const mx = a.x - nx * half * side, mz = a.z - nz * half * side;
        const ey = a.y + H - HALL.ceilDrop;
        const At = (u, v, drop = 0) => [mx + ux * u - nx * v, ey - drop, mz + uz * u - nz * v];

        face('hallCeil', OFFICE.wallShade,
          [[At(0, -hw), At(L, -hw), At(L, hw), At(0, hw)]], false);

        // longitudinal T-bars on the module, plus one against each wall
        for (let v = -hw; v <= hw + 1e-6; v += HALL.tile) {
          face('hallBar', OFFICE.wallDark, [[
            At(0, v - HALL.barT / 2, HALL.barDrop), At(L, v - HALL.barT / 2, HALL.barDrop),
            At(L, v + HALL.barT / 2, HALL.barDrop), At(0, v + HALL.barT / 2, HALL.barDrop),
          ]], false);
        }
        // cross bars, spaced along the whole run so the rhythm survives however
        // finely the route happens to be sampled
        for (let k = Math.ceil(runFrom / HALL.tile) * HALL.tile; k <= runFrom + L; k += HALL.tile) {
          const u = k - runFrom;
          face('hallBar', OFFICE.wallDark, [[
            At(u - HALL.barT / 2, -hw, HALL.barDrop), At(u + HALL.barT / 2, -hw, HALL.barDrop),
            At(u + HALL.barT / 2, hw, HALL.barDrop), At(u - HALL.barT / 2, hw, HALL.barDrop),
          ]], false);
        }
        // recessed light panels
        const lit = Math.ceil(runFrom / HALL.lightEvery) * HALL.lightEvery;
        if (lit <= runFrom + L) {
          const u = lit - runFrom, hl = HALL.lightL / 2, lw = half * HALL.lightSpan;
          face('hallLight', OFFICE.light, [[
            At(u - hl, -lw, -0.004), At(u + hl, -lw, -0.004),
            At(u + hl, lw, -0.004), At(u - hl, lw, -0.004),
          ]], false);
        }
      }
      run += L;
      return run;
    };

    for (const cell of placed) {
      for (let ri = 0; ri < cell.routes.length; ri++) {
        const route = cell.routes[ri];
        const others = cell.routes.filter((_, i) => i !== ri).map(r => r.pts);
        const half = route.width / 2 + T;
        const pts = route.pts;
        for (const side of [-1, 1]) {
          let prev = null, run = 0;
          for (let i = 0; i < pts.length; i++) {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            let tx = b.x - a.x, tz = b.z - a.z;
            const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
            const q = {
              x: pts[i].x + (-tz) * half * side,
              y: pts[i].y,
              z: pts[i].z + tx * half * side,
            };
            const blocked = others.some(o => o.some(p2 =>
              (p2.x - q.x) ** 2 + (p2.z - q.z) ** 2 < OPEN * OPEN));
            if (blocked) { prev = null; continue; }
            if (prev) run = segment(prev, q, run, side, half);
            prev = q;
          }
        }
      }
    }
    /* Junction ceilings.
     *
     * The fence logic opens a gap around every junction mouth so a crossroads
     * stays passable — which also means the corridor ceiling stops there, and
     * from inside the corridor you see straight through the gap into black void.
     * A patch over the middle of any tile with more than one route closes it.
     * Lifted a few millimetres so it wins the depth test against the corridor
     * ceilings it overlaps rather than z-fighting with them. */
    if (dress === 'office') {
      for (const cell of placed) {
        if (cell.routes.length < 2) continue;
        const wMax = Math.max(...cell.routes.map(r => r.width));
        // Wide enough to overlap the ceilings of every arm — a patch that only
        // covers the gap leaves a ring of black between itself and them.
        const R = Math.min(HALF - 0.2, wMax / 2 + HALL.junctionOpen + 1.4);
        const y = (cell.routes[0].pts[0]?.y ?? 0) + H - HALL.ceilDrop + 0.006;
        const c = cell.world;
        const Q = (dxq, dzq) => [c.x + dxq, y, c.z + dzq];
        face('hallCeil', OFFICE.wallShade,
          [[Q(-R, -R), Q(R, -R), Q(R, R), Q(-R, R)]], false);
      }
    }

    if (wallTris.length) {
      surfaces.set('hallwall|0.55|0.30', {
        material: dress === 'office' ? 'hallWall' : 'guard',
        tris: wallTris,
        spec: { friction: 0.55, bounce: 0.30 },
      });
    }
  }

  /* Bounds, then one collider per surface over those bounds. */
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const s of surfaces.values()) {
    for (let i = 0; i < s.tris.length; i += 3) {
      const x = s.tris[i], y = s.tris[i + 1], z = s.tris[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  const pad = 1;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const sizeX = maxX - minX, sizeZ = maxZ - minZ;
  const bins = binsFor(Math.max(sizeX, sizeZ));

  /* Backdrop.
   *
   * Everything outside a corridor was pure black, so every gap — a junction
   * mouth, the space beside an open arm — read as a hole punched in reality
   * rather than as somewhere unlit. One dark plane under the whole floor turns
   * those into "a dark room off the corridor", which is both what the fiction
   * wants and free. Never collides: the fall-out threshold still governs. */
  if (office) {
    const y = minY - 0.9;
    const pad2 = 6;
    const b = { pos: [], nor: [], col: [], spec: { color: '#151a1e', deco: true } };
    const quad = [
      [minX - pad2, y, minZ - pad2], [maxX + pad2, y, minZ - pad2],
      [maxX + pad2, y, maxZ + pad2], [minX - pad2, y, maxZ + pad2],
    ];
    for (const [p0, p1, p2] of [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]) {
      b.pos.push(...p0, ...p1, ...p2);
      b.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      for (let i = 0; i < 3; i++) b.col.push(0.082, 0.102, 0.118);
    }
    render.set('hallVoid', b);
  }

  const colliders = [];
  for (const s of surfaces.values()) {
    if (!s.tris.length) continue;
    colliders.push(new GridCollider(
      new Float32Array(s.tris), minX, minZ, sizeX, sizeZ, s.spec, bins,
    ));
  }

  const groups = [];
  for (const [material, r] of render) {
    groups.push({
      material,
      spec: r.spec,
      positions: new Float32Array(r.pos),
      normals: new Float32Array(r.nor),
      colors: new Float32Array(r.col),
      triangles: r.pos.length / 9,
    });
  }

  /* Spawn.
   *
   * Handoff §11.2: never respawn at the exact centre of a tile — central
   * decorations, pits and lift shafts live there, and #57's own cage ring is
   * one of them. The spawn sits on the corridor centre-line 3 m along the start
   * cell's single open edge, which is clear of the ring and on the exit deck.
   */
  const start = maze.start;
  const startDir = DIRS.find(d => start.dirs[d] !== undefined) || 'N';
  const sc = cellCentre(start.cx, start.cz, w, h);
  const spawn = {
    x: sc.x + DELTA[startDir][0] * 3.0,
    y: LEVELS[start.dirs[startDir] || 0] + BALL_R + 0.02,
    z: sc.z + DELTA[startDir][1] * 3.0,
    dir: startDir,
  };

  const goalCell = maze.goal;
  const gc = cellCentre(goalCell.cx, goalCell.cz, w, h);
  const goalDir = DIRS.find(d => goalCell.dirs[d] !== undefined) || 'S';
  const goal = {
    x: gc.x + DELTA[goalDir][0] * 1.4,
    y: LEVELS[goalCell.dirs[goalDir] || 0],
    z: gc.z + DELTA[goalDir][1] * 1.4,
    radius: 1.5,
  };

  /* Waypoints: the corridor centre-line along the solution — one per edge
   * crossing, plus a mid-cell point.
   *
   * The mid-cell point is NOT simply the tile centre. On the climbing loops the
   * deck bulges to one side and the tile centre is open air, and a follower
   * chasing it drives straight off the edge — the bot fell 14 times in a row at
   * the same waypoint before this was sampled properly. Each mid-point is
   * therefore the supported spot nearest the centre, and cells with a genuine
   * hole (broken bridge, acid pit) get no mid-point at all. */
  const waypoints = [];

  /**
   * Sample the corridor between two edge points, snapping each sample sideways
   * onto whatever deck is actually there.
   *
   * A straight line from edge to edge is only the corridor on a straight piece.
   * On an S-curve the deck bows two metres off the centre-line, on a 90° turn it
   * arcs outside the chord, and on a climbing loop it is three metres to one
   * side. The bot steering down the naive line drove into the kerb and sat there
   * for the entire time budget with the geometry perfectly intact.
   */
  const placedBy = new Map(placed.map(p => [p.cell, p]));
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

  /**
   * The piece's own centre-line from `from` to `to`, if it has one.
   *
   * Every deck records the path it was swept along, so the exact racing line
   * already exists — it just has to be found and oriented. A junction stores one
   * spur per arm, so entering on one and leaving by another means stitching two.
   */
  const routeFromPiece = (cell, from, to) => {
    const p = placedBy.get(cell.cell);
    if (!p || !p.routes.length) return null;
    const near = (pt, r) => Math.min(dist2(pt, r[0]), dist2(pt, r[r.length - 1]));
    const oriented = (r, startPt) => (dist2(startPt, r[0]) <= dist2(startPt, r[r.length - 1]) ? r : [...r].reverse());
    const lines = p.routes.map(r => r.pts);

    let best = null, bestCost = Infinity;
    for (const r of lines) {                          // one route spanning both edges
      const cost = near(from, r) + near(to, r);
      if (cost < bestCost) { bestCost = cost; best = r; }
    }
    if (best && bestCost < 2.5 * 2.5 * 2) {
      const o = oriented(best, from);
      if (dist2(from, o[0]) < 2.5 * 2.5 && dist2(to, o[o.length - 1]) < 2.5 * 2.5) return o;
    }
    if (lines.length < 2) return null;

    let ra = null, rb = null, ca = Infinity, cb = Infinity;
    for (const r of lines) {
      const a = near(from, r), b = near(to, r);
      if (a < ca) { ca = a; ra = r; }
      if (b < cb) { cb = b; rb = r; }
    }
    if (!ra || !rb || ra === rb || ca > 2.5 * 2.5 || cb > 2.5 * 2.5) return null;
    const A = oriented(ra, from);
    const B = oriented(rb, to);
    return [...A, ...B.slice().reverse()];
  };

  const routeThrough = (from, to) => {
    const dx = to.x - from.x, dz = to.z - from.z;
    const L = Math.hypot(dx, dz) || 1;
    const px = -dz / L, pz = dx / L;                        // lateral
    const out = [];
    for (const t of [0.28, 0.5, 0.72]) {
      const bx = from.x + dx * t, bz = from.z + dz * t;
      const by = from.y + (to.y - from.y) * t;
      // Pick the sample with the most room around it, not the one closest to
      // the straight line. Snapping to the nearest supported point parks the
      // route against a kerb — the ball overlaps it, the clearance check flags
      // a corridor that is genuinely fine, and the bot scrapes the whole way.
      let best = null, bestScore = -Infinity;
      for (let off = -4.5; off <= 4.5 + 1e-9; off += 0.35) {
        const sx = bx + px * off, sz = bz + pz * off;
        const y = supportUnder(colliders, sx, sz, by + 2.5);
        if (!Number.isFinite(y) || y < by - 2.5) continue;
        const free = nearestSurface(colliders, sx, y + BALL_R + 0.01, sz, 1.6);
        const score = Math.min(free, BALL_R * 1.05) - 0.012 * Math.abs(off);
        if (score > bestScore) { bestScore = score; best = { x: sx, y, z: sz }; }
      }
      if (best) out.push(best);
    }
    return out;
  };

  for (let i = 0; i < maze.solution.length; i++) {
    const c = maze.solution[i];
    const cc = cellCentre(c.cx, c.cz, w, h);
    const prev = maze.solution[i - 1], next = maze.solution[i + 1];
    const edgeTo = n => {
      if (!n) return null;
      const d = DIRS.find(dd => c.cx + DELTA[dd][0] === n.cx && c.cz + DELTA[dd][1] === n.cz);
      if (!d) return null;
      return { x: cc.x + DELTA[d][0] * HALF, y: LEVELS[c.dirs[d] ?? 0], z: cc.z + DELTA[d][1] * HALF, d };
    };
    const inEdge = edgeTo(prev), outEdge = edgeTo(next);
    // The first cell has no incoming edge; start the route from the spawn side.
    const from = inEdge || { x: cc.x, y: LEVELS[0], z: cc.z };
    const to = outEdge || { x: cc.x, y: LEVELS[0], z: cc.z };
    if (inEdge && outEdge) {
      const exact = routeFromPiece(c, inEdge, outEdge);
      if (exact && exact.length > 2) {
        // Drop the ends (the edge waypoints cover those) and thin the rest.
        // Roughly one waypoint every 1.8 m of path. Four per cell was enough on
        // a straight and far too sparse on a 14 m climbing loop, where the chord
        // between waypoints cut across the bend and into the wall.
        const inner = exact.slice(1, -1);
        let len = 0;
        for (let k = 1; k < exact.length; k++) {
          len += Math.hypot(exact[k].x - exact[k - 1].x, exact[k].y - exact[k - 1].y, exact[k].z - exact[k - 1].z);
        }
        const want = Math.max(3, Math.round(len / 1.8));
        const step = Math.max(1, Math.round(inner.length / want));
        for (let k = 0; k < inner.length; k += step) {
          waypoints.push({ x: inner[k].x, y: inner[k].y, z: inner[k].z, cell: c.cell, index: i });
        }
      } else {
        for (const p of routeThrough(from, to)) waypoints.push({ ...p, cell: c.cell, index: i });
      }
    } else {
      const at = supportUnder(colliders, cc.x, cc.z, 4);
      if (Number.isFinite(at)) waypoints.push({ x: cc.x, y: at, z: cc.z, cell: c.cell, index: i });
    }
    if (outEdge) {
      waypoints.push({ x: outEdge.x, y: outEdge.y, z: outEdge.z, cell: c.cell, index: i, edge: outEdge.d });
    }
  }

  /** Which placed cell contains a world point. */
  const cellLookup = (x, z) => {
    const cx = Math.round(x / TILE + (w - 1) / 2);
    const cz = Math.round(z / TILE + (h - 1) / 2);
    if (cx < 0 || cz < 0 || cx >= w || cz >= h) return null;
    return maze.cellAt.get(cz * w + cx) || null;
  };

  /* Moving parts: one render group per body, kept in piece-local space so the
   * DynamicBody's model matrix can place AND animate it. Baking the cell
   * transform in here would mean re-deriving the pivot in world space, which is
   * exactly the kind of double transform that goes subtly wrong. */
  const dynamicGroups = [];
  for (const cell of placed) {
    for (const g of cell.dynamic) {
      const spec = cell.piece.bodies.find(b => b.effect === g.effect);
      dynamicGroups.push({
        effect: g.effect,
        cell: cell.cell,
        pieceId: cell.pieceId,
        rot: cell.rot,
        origin: cell.world,
        blades: spec?.blades || 1,
        positions: g.positions,
        normals: g.normals,
        colors: g.colors,
        triangles: g.triangles,
      });
    }
  }

  return {
    maze,
    placed,
    groups,
    dynamicGroups,
    colliders,
    surfaces: [...surfaces.values()].map(s => ({ material: s.material, ...s.spec, triangles: s.tris.length / 9 })),
    bounds: { lo: [minX, minY, minZ], hi: [maxX, maxY, maxZ] },
    bins,
    spawn,
    goal,
    waypoints,
    cellLookup,
    stats: {
      renderTriangles: groups.reduce((a, g) => a + g.triangles, 0),
      collisionTriangles: colliders.reduce((a, c) => a + c.count, 0),
      drawCalls: groups.length,
      colliders: colliders.length,
      metresSquared: Math.round(sizeX * sizeZ),
    },
  };
}

/** Behaviours in effect for a world point, for behaviors.resolveEnv. */
export function behavioursAt (world, x, z) {
  const cell = world.cellLookup(x, z);
  if (!cell) return [];
  return PIECE_BY_ID.get(cell.pieceId).behaviours;
}

export { isDeco, resolveMaterial };

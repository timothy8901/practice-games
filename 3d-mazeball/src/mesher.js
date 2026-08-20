/**
 * mesher.js — geometry and collision in one pass. Zero dependencies.
 *
 * Adapted from monkeyball-open-world/js/mesher.js, with the Three.js import
 * removed so the kit can be loaded headlessly (self-tests, generator, server)
 * exactly like PHYSICS-ENGINE-HANDOFF.md §4.4 asks for:
 *
 *   "mesher.js writes render buffers and the collision triangle list in the same
 *    call, so what you see is provably what you roll on."
 *
 * Piece-local space matches the engine's cell convention:
 *   +X east, +Z south, Y up, tile centred on the origin.
 *   North is −Z, because sockets.js has DELTA.N = [0, −1].
 *
 * Every triangle carries a material key. The solver reads `collider.piece =
 * { friction, bounce }`, and handoff §2.4 says to use one collider per material
 * rather than per-triangle material indices — so `build()` buckets triangles by
 * material and `colliderSpecs()` hands you exactly those buckets.
 *
 * Decoration passes `collide: false` (handoff §4.4). Getting that backwards is
 * how you ship invisible walls.
 */

/* ── colour ───────────────────────────────────────────────────────────── */

const _hexCache = new Map();

/**
 * Optional colour remap, applied to every authored colour on its way into a
 * vertex buffer.
 *
 * The 64 pieces were authored with literal hex in each builder, which is the
 * right way to write them and the wrong way to reskin them. A single hook here
 * is the only choke point every triangle passes through, so a theme can restyle
 * the entire kit without touching a single piece — and turning the theme off
 * gives back the original artwork exactly.
 */
let _remap = null;
export function setPalette (fn) { _remap = fn; _hexCache.clear(); }
export function getPalette () { return _remap; }

/** '#rgb' | '#rrggbb' | [r,g,b] → [r,g,b] in 0..1, sRGB values as authored. */
export function parseColor (c) {
  if (Array.isArray(c)) return c;
  if (typeof c !== 'string') return [1, 1, 1];
  let v = _hexCache.get(c);
  if (v) return v;
  const src = c;
  if (_remap) c = _remap(c) || c;
  let h = c.trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  v = Number.isFinite(n)
    ? [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
    : [1, 1, 1];
  _hexCache.set(src, v);
  return v;
}

/* ── small vector helpers used by the path builders ───────────────────── */

export const v3 = (x, y, z) => ({ x, y, z });
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export function norm3 (a) {
  const L = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / L, a[1] / L, a[2] / L];
}

/* ── the accumulator ──────────────────────────────────────────────────── */

export class Mesher {
  constructor () {
    /** matKey → { pos: number[], nor: number[], col: number[] } (render) */
    this.groups = new Map();
    /** matKey → number[] flat 9-per-triangle (collision only) */
    this.colTris = new Map();
    /**
     * effect → { pos, nor, col }: geometry belonging to a moving part.
     *
     * Handoff §8 — a triangle soup cannot express a swinging hammer or a
     * rising floor, so those are resolved analytically as DynamicBodies. Their
     * geometry therefore must NOT be baked into the static soup: if it is, the
     * ball collides with the frozen pose as well as the moving one, and the
     * pendulum becomes a wall.
     */
    this.dyn = new Map();
    /**
     * Centre-lines of every rollable run this piece emitted, in piece-local
     * space. The generator stitches these into the maze's racing line: sampling
     * a corridor by probing for support only approximates it, and on an S-curve
     * the approximation cut the bow and wedged the ball in the kerb.
     */
    this.routes = [];
    /** every colliding triangle, flat, in emission order */
    this.tris = [];
    this.triCount = 0;
    this.colTriCount = 0;
  }

  _g (key) {
    let g = this.groups.get(key);
    if (!g) { g = { pos: [], nor: [], col: [] }; this.groups.set(key, g); }
    return g;
  }

  _c (key) {
    let c = this.colTris.get(key);
    if (!c) { c = []; this.colTris.set(key, c); }
    return c;
  }

  /**
   * One triangle in piece-local space.
   *
   * Normals are always the flat geometric normal and every material renders
   * DoubleSide, so triangle winding never has to be reasoned about — see
   * handoff §11.1, a whole class of bug that simply stops existing.
   */
  tri (A, B, C, mat, opts = {}) {
    const collide = opts.collide !== false;
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz);
    if (L < 1e-12) return;               // degenerate: contributes nothing either way
    nx /= L; ny /= L; nz /= L;

    // A moving part goes to its own bucket and never to the static soup.
    if (opts.dyn) {
      let d = this.dyn.get(opts.dyn);
      if (!d) { d = { pos: [], nor: [], col: [] }; this.dyn.set(opts.dyn, d); }
      d.pos.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
      d.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      const dc = parseColor(opts.color || '#ffffff');
      for (let i = 0; i < 3; i++) d.col.push(dc[0], dc[1], dc[2]);
      this.triCount++;
      return;
    }

    const g = this._g(mat);
    g.pos.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
    g.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    const col = parseColor(opts.color || '#ffffff');
    for (let i = 0; i < 3; i++) g.col.push(col[0], col[1], col[2]);
    this.triCount++;

    if (collide) {
      this._c(mat).push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
      this.tris.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
      this.colTriCount++;
    }
  }

  /** Quad a→b→c→d. Winding is irrelevant (see tri). */
  quad (a, b, c, d, mat, opts = {}) {
    this.tri(a, b, c, mat, opts);
    this.tri(a, c, d, mat, opts);
  }

  /** Axis-aligned box centred at (x, y, z). */
  box (x, y, z, sx, sy, sz, mat, opts = {}) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const v = [
      [x - hx, y - hy, z - hz], [x + hx, y - hy, z - hz], [x + hx, y - hy, z + hz], [x - hx, y - hy, z + hz],
      [x - hx, y + hy, z - hz], [x + hx, y + hy, z - hz], [x + hx, y + hy, z + hz], [x - hx, y + hy, z + hz],
    ];
    this.quad(v[4], v[5], v[6], v[7], mat, opts);   // top
    this.quad(v[3], v[2], v[1], v[0], mat, opts);   // bottom
    this.quad(v[0], v[1], v[5], v[4], mat, opts);
    this.quad(v[1], v[2], v[6], v[5], mat, opts);
    this.quad(v[2], v[3], v[7], v[6], mat, opts);
    this.quad(v[3], v[0], v[4], v[7], mat, opts);
  }

  /** Box rotated about Y by `yaw`, centred at (x, y, z). */
  boxYaw (x, y, z, sx, sy, sz, yaw, mat, opts = {}) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const v = [
      P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz),
      P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz),
    ];
    this.quad(v[4], v[5], v[6], v[7], mat, opts);
    this.quad(v[3], v[2], v[1], v[0], mat, opts);
    this.quad(v[0], v[1], v[5], v[4], mat, opts);
    this.quad(v[1], v[2], v[6], v[5], mat, opts);
    this.quad(v[2], v[3], v[7], v[6], mat, opts);
    this.quad(v[3], v[0], v[4], v[7], mat, opts);
  }

  /** Box centred at (x, y, z), rotated `angle` radians about a unit `axis`. */
  boxRot (x, y, z, sx, sy, sz, axis, angle, mat, opts = {}) {
    const [ax, ay, az] = norm3(axis);
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const R = [
      [t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay],
      [t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax],
      [t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c],
    ];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (lx, ly, lz) => [
      x + R[0][0] * lx + R[0][1] * ly + R[0][2] * lz,
      y + R[1][0] * lx + R[1][1] * ly + R[1][2] * lz,
      z + R[2][0] * lx + R[2][1] * ly + R[2][2] * lz,
    ];
    const v = [
      P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz),
      P(-hx, hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), P(-hx, hy, hz),
    ];
    this.quad(v[4], v[5], v[6], v[7], mat, opts);
    this.quad(v[3], v[2], v[1], v[0], mat, opts);
    this.quad(v[0], v[1], v[5], v[4], mat, opts);
    this.quad(v[1], v[2], v[6], v[5], mat, opts);
    this.quad(v[2], v[3], v[7], v[6], mat, opts);
    this.quad(v[3], v[0], v[4], v[7], mat, opts);
  }

  /**
   * A capped cylinder between two arbitrary points — a roller, a wheel on its
   * edge, a fan disc facing down the corridor.
   *
   * `cyl()` is Y-axis only, and reaching for it to build a horizontal roller
   * silently produces a vertical post instead. The contact sheet made four of
   * those obvious at a glance, which is exactly what a contact sheet is for.
   */
  tube (a, b, r, mat, opts = {}) {
    const seg = opts.seg || 16;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    if (L < 1e-9) return;
    const t = [d[0] / L, d[1] / L, d[2] / L];
    // any vector not parallel to the axis will do for the reference up
    const ref = Math.abs(t[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
    let ux = t[1] * ref[2] - t[2] * ref[1];
    let uy = t[2] * ref[0] - t[0] * ref[2];
    let uz = t[0] * ref[1] - t[1] * ref[0];
    const UL = Math.hypot(ux, uy, uz) || 1; ux /= UL; uy /= UL; uz /= UL;
    const vx = t[1] * uz - t[2] * uy, vy = t[2] * ux - t[0] * uz, vz = t[0] * uy - t[1] * ux;
    const ring = (p, i) => {
      const ang = (i % seg) / seg * Math.PI * 2;
      const ca = Math.cos(ang) * r, sa = Math.sin(ang) * r;
      return [p[0] + ux * ca + vx * sa, p[1] + uy * ca + vy * sa, p[2] + uz * ca + vz * sa];
    };
    for (let i = 0; i < seg; i++) {
      this.quad(ring(a, i), ring(a, i + 1), ring(b, i + 1), ring(b, i), mat, opts);
      if (opts.cap !== false) {
        this.tri(a, ring(a, i + 1), ring(a, i), mat, opts);
        this.tri(b, ring(b, i), ring(b, i + 1), mat, opts);
      }
    }
  }

  /** Cylinder / cone along +Y, base at y. */
  cyl (x, y, z, r0, r1, h, mat, opts = {}) {
    const seg = opts.seg || 16;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const A = [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0];
      const B = [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0];
      const C = [x + Math.cos(a1) * r1, y + h, z + Math.sin(a1) * r1];
      const D = [x + Math.cos(a0) * r1, y + h, z + Math.sin(a0) * r1];
      this.quad(A, B, C, D, mat, opts);
      if (opts.cap !== false) {
        this.tri([x, y + h, z], D, C, mat, opts);
        this.tri([x, y, z], B, A, mat, opts);
      }
    }
  }

  /** Low-poly UV sphere. */
  sphere (x, y, z, r, mat, opts = {}) {
    const rows = opts.rows || 8, cols = opts.cols || 12;
    const pt = (p, t) => [
      x + r * Math.sin(p) * Math.cos(t), y + r * Math.cos(p), z + r * Math.sin(p) * Math.sin(t),
    ];
    for (let i = 0; i < rows; i++) {
      const p0 = i / rows * Math.PI, p1 = (i + 1) / rows * Math.PI;
      for (let j = 0; j < cols; j++) {
        const t0 = j / cols * Math.PI * 2, t1 = (j + 1) / cols * Math.PI * 2;
        const A = pt(p0, t0), B = pt(p1, t0), C = pt(p1, t1), D = pt(p0, t1);
        if (i === 0) this.tri(A, B, C, mat, opts);
        else if (i === rows - 1) this.tri(A, B, D, mat, opts);
        else this.quad(A, B, C, D, mat, opts);
      }
    }
  }

  /** Convex polygon prism. `pts` are [x, z]; top face at `y`, `t` thick. */
  polyPrism (pts, y, t, mat, opts = {}) {
    const n = pts.length;
    const top = pts.map(p => [p[0], y, p[1]]);
    const bot = pts.map(p => [p[0], y - t, p[1]]);
    for (let i = 1; i < n - 1; i++) this.tri(top[0], top[i], top[i + 1], mat, opts);
    const sideOpts = Object.assign({}, opts, { color: opts.sideColor || opts.color });
    for (let i = 1; i < n - 1; i++) this.tri(bot[0], bot[i + 1], bot[i], mat, sideOpts);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.quad(bot[i], bot[j], top[j], top[i], mat, sideOpts);
    }
  }

  /** Annulus (a ring with a hole) lying in XZ, top face at `y`. */
  ringPrism (cx, cz, rIn, rOut, y, t, mat, opts = {}) {
    const seg = opts.seg || 32;
    const a0deg = opts.from ?? 0, a1deg = opts.to ?? Math.PI * 2;
    const side = Object.assign({}, opts, { color: opts.sideColor || opts.color });
    for (let i = 0; i < seg; i++) {
      const a0 = a0deg + (a1deg - a0deg) * (i / seg);
      const a1 = a0deg + (a1deg - a0deg) * ((i + 1) / seg);
      const p = (r, a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      const q = (r, a) => [cx + Math.cos(a) * r, y - t, cz + Math.sin(a) * r];
      const A = p(rIn, a0), B = p(rOut, a0), C = p(rOut, a1), D = p(rIn, a1);
      this.quad(A, B, C, D, mat, opts);
      const a = q(rIn, a0), b = q(rOut, a0), c = q(rOut, a1), d = q(rIn, a1);
      this.quad(a, d, c, b, mat, side);
      this.quad(b, c, C, B, mat, side);      // outer skirt
      this.quad(d, a, A, D, mat, side);      // inner skirt
    }
  }

  /**
   * Sweep a cross-section along a path. The workhorse: decks, half-pipes,
   * banked turns, spirals, tubes and rails are all this call with a different
   * profile (handoff §4.4).
   *
   * @param path    stations [{x, y, z, up?: [x,y,z]}]
   * @param profile cross-section [[lateral, vertical], ...] in the frame's
   *                (right, up) plane
   * @param opts    { thickness, closedProfile, hollow, capEnds, collide, color,
   *                  sideColor, sideMat }
   */
  sweep (path, profile, mat, opts = {}) {
    const n = path.length, m = profile.length;
    if (n < 2 || m < 2) return;
    const closed = !!opts.closedProfile;
    const t = opts.thickness ?? 0.35;
    const collide = opts.collide !== false;
    const frames = [];

    for (let i = 0; i < n; i++) {
      const prev = path[Math.max(0, i - 1)], next = path[Math.min(n - 1, i + 1)];
      let tx = next.x - prev.x, ty = next.y - prev.y, tz = next.z - prev.z;
      const L = Math.hypot(tx, ty, tz) || 1; tx /= L; ty /= L; tz /= L;
      const u = norm3(path[i].up || [0, 1, 0]);
      // right = normalise(tangent × up)
      let rx = ty * u[2] - tz * u[1], ry = tz * u[0] - tx * u[2], rz = tx * u[1] - ty * u[0];
      const RL = Math.hypot(rx, ry, rz) || 1;
      frames.push({ c: [path[i].x, path[i].y, path[i].z], r: [rx / RL, ry / RL, rz / RL], u });
    }

    const at = (i, j, off = 0) => {
      const f = frames[i], p = profile[j];
      const lat = p[0], ver = p[1] + off;
      return [
        f.c[0] + f.r[0] * lat + f.u[0] * ver,
        f.c[1] + f.r[1] * lat + f.u[1] * ver,
        f.c[2] + f.r[2] * lat + f.u[2] * ver,
      ];
    };

    const lastJ = closed ? m : m - 1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < lastJ; j++) {
        const j2 = (j + 1) % m;
        this.quad(at(i, j), at(i + 1, j), at(i + 1, j2), at(i, j2), mat, opts);
      }
    }
    if (closed || opts.hollow) return;

    const sideMat = opts.sideMat || mat;
    const side = Object.assign({}, opts, { color: opts.sideColor || opts.color, collide });
    for (let i = 0; i < n - 1; i++) {                       // underside
      for (let j = 0; j < m - 1; j++) {
        this.quad(at(i, j, -t), at(i, j + 1, -t), at(i + 1, j + 1, -t), at(i + 1, j, -t), sideMat, side);
      }
    }
    for (let i = 0; i < n - 1; i++) {                       // lateral skirts
      for (const j of [0, m - 1]) {
        this.quad(at(i, j), at(i + 1, j), at(i + 1, j, -t), at(i, j, -t), sideMat, side);
      }
    }
    if (opts.capEnds !== false) {                           // end caps
      for (const i of [0, n - 1]) {
        for (let j = 0; j < m - 1; j++) {
          this.quad(at(i, j), at(i, j + 1), at(i, j + 1, -t), at(i, j, -t), sideMat, side);
        }
      }
    }
  }

  /* ── output ─────────────────────────────────────────────────────────── */

  /** Render buckets, one per material key. */
  build () {
    const out = [];
    for (const [key, g] of this.groups) {
      if (!g.pos.length) continue;
      out.push({
        material: key,
        positions: new Float32Array(g.pos),
        normals: new Float32Array(g.nor),
        colors: new Float32Array(g.col),
        triangles: g.pos.length / 9,
      });
    }
    return out;
  }

  /**
   * One collider bucket per material — the shape `GridCollider` wants
   * (handoff §4.1). Non-colliding decoration never appears here.
   */
  colliderSpecs () {
    const out = [];
    for (const [key, arr] of this.colTris) {
      if (!arr.length) continue;
      out.push({ material: key, tris: new Float32Array(arr), triangles: arr.length / 9 });
    }
    return out;
  }

  /**
   * Record a rollable centre-line and how wide the deck is there. Called by the
   * deck helpers, not by hand. The width is what lets the generator fence a
   * corridor without measuring geometry it cannot see.
   */
  addRoute (path, width = 2.4) {
    if (!path || path.length < 2) return;
    this.routes.push({ width, pts: path.map(p => ({ x: p.x, y: p.y, z: p.z })) });
  }

  /** Moving-part geometry, one entry per declared effect. */
  dynamicGroups () {
    const out = [];
    for (const [effect, d] of this.dyn) {
      if (!d.pos.length) continue;
      out.push({
        effect,
        positions: new Float32Array(d.pos),
        normals: new Float32Array(d.nor),
        colors: new Float32Array(d.col),
        triangles: d.pos.length / 9,
      });
    }
    return out;
  }

  /** Axis-aligned bounds of everything emitted (render + decoration). */
  bounds () {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const g of [...this.groups.values(), ...this.dyn.values()]) {
      for (let i = 0; i < g.pos.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = g.pos[i + k];
          if (v < lo[k]) lo[k] = v;
          if (v > hi[k]) hi[k] = v;
        }
      }
    }
    if (!Number.isFinite(lo[0])) return { lo: [0, 0, 0], hi: [0, 0, 0] };
    return { lo, hi };
  }
}

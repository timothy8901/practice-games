/**
 * gl.js — a small WebGL renderer for the piece viewer. No dependencies.
 *
 * The kit emits flat geometric normals and expects double-sided rendering
 * (PHYSICS-ENGINE-HANDOFF.md §11.1), so culling is off and the fragment shader
 * flips the normal for back faces. That is the whole reason triangle winding
 * never has to be reasoned about, and the review page has to honour it or
 * surfaces show up as flat unlit colour and get reported as art bugs.
 */

/* ── matrices (column-major, as WebGL wants them) ─────────────────────── */

export function perspective (fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function lookAt (eye, center, up = [0, 1, 0]) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let L = Math.hypot(zx, zy, zz) || 1; zx /= L; zy /= L; zz /= L;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  L = Math.hypot(xx, xy, xz) || 1; xx /= L; xy /= L; xz /= L;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ]);
}

export function multiply (a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
        + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

/* ── shaders ──────────────────────────────────────────────────────────── */

const VERT = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec3 aCol;
uniform mat4 uMVP;
uniform mat4 uModel;
uniform float uOutline;      // inverted-hull push along the world normal
varying vec3 vNor;
varying vec3 vCol;
varying vec3 vPos;
void main () {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec3 nw = mat3(uModel) * aNor;
  wp.xyz += normalize(nw) * uOutline;
  vNor = nw;
  vCol = aCol;
  vPos = wp.xyz;
  gl_Position = uMVP * wp;
}`;

const FRAG = `
precision mediump float;
varying vec3 vNor;
varying vec3 vCol;
varying vec3 vPos;
uniform vec3 uKey;
uniform vec3 uFill;
uniform vec3 uEye;
uniform float uAmbient;
uniform float uEmissive;
uniform float uOpacity;
uniform float uToon;         // 0 = smooth falloff, 1 = fully banded
uniform float uRim;          // strength of the wraparound rim
uniform vec4 uInk;           // rgb + flag: >0.5 means "draw flat, this is an outline"
void main () {
  if (uInk.w > 0.5) { gl_FragColor = vec4(uInk.rgb, uOpacity); return; }
  vec3 n = normalize(vNor);
  if (!gl_FrontFacing) n = -n;              // double-sided, per handoff §11.1
  float key  = max(dot(n, uKey), 0.0);
  // Quantise the key light into four steps. MySims-era hardware shaded in
  // bands because it had to; the banding is what makes a rounded form read as
  // a toy rather than a lit sphere, so it is worth reproducing deliberately.
  float band = floor(key * 3.0 + 0.5) / 3.0;
  key = mix(key, band, uToon);
  float fill = max(dot(n, uFill), 0.0) * 0.32;
  float sky  = max(n.y, 0.0) * 0.14;
  // Rim light along the silhouette: the cheap stand-in for the subsurface glow
  // that gives vinyl-toy renders their soft edge.
  float rim = pow(1.0 - abs(dot(n, normalize(uEye - vPos))), 3.0) * uRim;
  vec3 c = vCol * (uAmbient + key * 0.78 + fill + sky) + vCol * uEmissive + rim;
  gl_FragColor = vec4(c, uOpacity);
}`;

const LINE_VERT = `
attribute vec3 aPos;
uniform mat4 uMVP;
void main () { gl_Position = uMVP * vec4(aPos, 1.0); }`;

const LINE_FRAG = `
precision mediump float;
uniform vec4 uColor;
void main () { gl_FragColor = uColor; }`;

function compile (gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
    }
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) || 'program link failed');
  }
  return p;
}

/* ── renderer ─────────────────────────────────────────────────────────── */

export class Viewer {
  constructor (canvas, opts = {}) {
    const gl = canvas.getContext('webgl', {
      antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL is not available in this browser');
    this.gl = gl;
    this.canvas = canvas;
    this.prog = compile(gl, VERT, FRAG);
    this.lineProg = compile(gl, LINE_VERT, LINE_FRAG);
    this.loc = {
      pos: gl.getAttribLocation(this.prog, 'aPos'),
      nor: gl.getAttribLocation(this.prog, 'aNor'),
      col: gl.getAttribLocation(this.prog, 'aCol'),
      mvp: gl.getUniformLocation(this.prog, 'uMVP'),
      key: gl.getUniformLocation(this.prog, 'uKey'),
      fill: gl.getUniformLocation(this.prog, 'uFill'),
      ambient: gl.getUniformLocation(this.prog, 'uAmbient'),
      emissive: gl.getUniformLocation(this.prog, 'uEmissive'),
      opacity: gl.getUniformLocation(this.prog, 'uOpacity'),
      model: gl.getUniformLocation(this.prog, 'uModel'),
      outline: gl.getUniformLocation(this.prog, 'uOutline'),
      eye: gl.getUniformLocation(this.prog, 'uEye'),
      toon: gl.getUniformLocation(this.prog, 'uToon'),
      rim: gl.getUniformLocation(this.prog, 'uRim'),
      ink: gl.getUniformLocation(this.prog, 'uInk'),
    };
    // Shading style, set once and read by every draw. Defaults to the original
    // smooth look so the 64-piece inspector renders exactly as it always has;
    // the game turns the toon terms on.
    this.style = { toon: 0, rim: 0 };
    this.eye = [0, 0, 0];
    this.identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this.lineLoc = {
      pos: gl.getAttribLocation(this.lineProg, 'aPos'),
      mvp: gl.getUniformLocation(this.lineProg, 'uMVP'),
      color: gl.getUniformLocation(this.lineProg, 'uColor'),
    };
    this.cache = new Map();          // pieceId → GPU buffers
    this.background = opts.background || [0.086, 0.098, 0.110];
    gl.enable(gl.DEPTH_TEST);
    // LEQUAL, not the default LESS: the collision wireframe is exactly
    // coplanar with the surfaces it traces, so under LESS every line loses the
    // depth test and the overlay silently draws nothing.
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);        // handoff §11.1 — everything is DoubleSide
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  /** Upload a built piece. Safe to call repeatedly; results are cached. */
  upload (id, built) {
    if (this.cache.has(id)) return this.cache.get(id);
    const gl = this.gl;
    const buf = data => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    };
    const groups = built.groups.map(g => ({
      material: g.material,
      spec: g.spec,
      count: g.positions.length / 3,
      pos: buf(g.positions),
      nor: buf(g.normals),
      col: buf(g.colors),
      opacity: g.spec.opacity ?? 1,
      emissive: g.spec.emissive ?? 0,
    }));

    // Collision wireframe: three edges per colliding triangle.
    let n = 0;
    for (const c of built.colliders) n += c.tris.length / 9;
    const edges = new Float32Array(n * 18);
    let o = 0;
    for (const c of built.colliders) {
      const t = c.tris;
      for (let i = 0; i < t.length; i += 9) {
        for (const [a, b] of [[0, 3], [3, 6], [6, 0]]) {
          edges[o++] = t[i + a]; edges[o++] = t[i + a + 1]; edges[o++] = t[i + a + 2];
          edges[o++] = t[i + b]; edges[o++] = t[i + b + 1]; edges[o++] = t[i + b + 2];
        }
      }
    }

    const entry = { groups, wire: buf(edges), wireCount: edges.length / 3, bounds: built.bounds };
    this.cache.set(id, entry);
    return entry;
  }

  /** A 10 m tile grid plus the three axes, so scale is always legible. */
  _ensureGrid () {
    if (this.grid) return this.grid;
    const gl = this.gl;
    const pts = [];
    const H = 5, step = 1;
    for (let i = -H; i <= H; i += step) {
      pts.push(-H, -0.95, i, H, -0.95, i);
      pts.push(i, -0.95, -H, i, -0.95, H);
    }
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    this.grid = { buf: b, count: pts.length / 3 };
    return this.grid;
  }

  /** A wireframe sphere at the ball radius, for scale. */
  _ensureBall (r) {
    if (this.ball && this.ball.r === r) return this.ball;
    const gl = this.gl;
    const pts = [];
    const rings = 3, seg = 24;
    for (let k = 0; k < rings; k++) {
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
        const P = a => (k === 0 ? [Math.cos(a) * r, 0, Math.sin(a) * r]
          : k === 1 ? [Math.cos(a) * r, Math.sin(a) * r, 0]
            : [0, Math.sin(a) * r, Math.cos(a) * r]);
        pts.push(...P(a0), ...P(a1));
      }
    }
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    this.ball = { buf: b, count: pts.length / 3, r };
    return this.ball;
  }

  _lines (buf, count, mvp, color, width = 1) {
    const gl = this.gl;
    gl.useProgram(this.lineProg);
    gl.uniformMatrix4fv(this.lineLoc.mvp, false, mvp);
    gl.uniform4fv(this.lineLoc.color, color);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(this.lineLoc.pos);
    gl.vertexAttribPointer(this.lineLoc.pos, 3, gl.FLOAT, false, 0, 0);
    gl.lineWidth(width);
    gl.drawArrays(gl.LINES, 0, count);
  }

  /**
   * @param entry   the value returned by upload()
   * @param cam     { yaw, pitch, dist, target:[x,y,z] }
   * @param opts    { collision, grid, ballAt, ballR, ambient }
   */
  render (entry, cam, opts = {}) {
    const gl = this.gl;
    const w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    const bg = this.background;
    gl.clearColor(bg[0], bg[1], bg[2], opts.alpha ?? 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const t = cam.target || [0, 0.4, 0];
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const eye = [
      t[0] + Math.sin(cam.yaw) * cam.dist * cp,
      t[1] + sp * cam.dist,
      t[2] + Math.cos(cam.yaw) * cam.dist * cp,
    ];
    const proj = perspective(0.72, w / h, 0.25, 200);
    const mvp = multiply(proj, lookAt(eye, t));

    if (opts.grid !== false) {
      this._lines(this._ensureGrid().buf, this.grid.count, mvp, [1, 1, 1, 0.075]);
    }

    this.eye = eye;
    this._lit(mvp, opts);
    gl.uniformMatrix4fv(this.loc.model, false, this.identity);
    const draw = g => {
      gl.uniform1f(this.loc.opacity, g.opacity);
      gl.uniform1f(this.loc.emissive, g.emissive);
      this._bind(g);
      gl.drawArrays(gl.TRIANGLES, 0, g.count);
    };

    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (const g of entry.groups) if (g.opacity >= 1) draw(g);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    for (const g of entry.groups) if (g.opacity < 1) draw(g);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    if (opts.collision) {
      gl.enable(gl.BLEND);
      this._lines(entry.wire, entry.wireCount, mvp, [0.35, 0.92, 1.0, 0.55]);
      gl.disable(gl.BLEND);
    }

    if (opts.ballAt) {
      // The scale reference is drawn through the geometry on purpose: half its
      // point is seeing how it sits relative to a kerb or a rail.
      const b = this._ensureBall(opts.ballR || 0.35);
      const T = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
        opts.ballAt[0], opts.ballAt[1], opts.ballAt[2], 1]);
      gl.disable(gl.DEPTH_TEST);
      this._lines(b.buf, b.count, multiply(mvp, T), [1, 0.82, 0.28, 1], 2);
      gl.enable(gl.DEPTH_TEST);
    }
  }

    /**
   * Upload a loose geometry group under `key` — the maze shell, the character,
   * a moving obstacle. Anything drawn with its own model matrix.
   */
  uploadGroup (key, g) {
    if (this.cache.has(key)) return this.cache.get(key);
    const gl = this.gl;
    const buf = data => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    };
    const entry = {
      count: g.positions.length / 3,
      pos: buf(g.positions), nor: buf(g.normals), col: buf(g.colors),
      opacity: g.opacity ?? 1, emissive: g.emissive ?? 0,
    };
    this.cache.set(key, entry);
    return entry;
  }

  /** Bind the uniforms every draw shares. */
  _lit (mvp, opts) {
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.loc.mvp, false, mvp);
    gl.uniform3fv(this.loc.key, normalize([0.45, 0.82, 0.36]));
    gl.uniform3fv(this.loc.fill, normalize([-0.55, 0.35, -0.5]));
    gl.uniform3fv(this.loc.eye, this.eye);
    gl.uniform1f(this.loc.ambient, opts.ambient ?? 0.36);
    gl.uniform1f(this.loc.toon, opts.toon ?? this.style.toon);
    gl.uniform1f(this.loc.rim, opts.rim ?? this.style.rim);
    gl.uniform1f(this.loc.outline, 0);
    gl.uniform4fv(this.loc.ink, [0, 0, 0, 0]);
  }

  _bind (g) {
    const gl = this.gl;
    for (const [buf, loc] of [[g.pos, this.loc.pos], [g.nor, this.loc.nor], [g.col, this.loc.col]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    }
  }

  /** Draw an uploaded group with an explicit model matrix. */
  drawGroup (key, mvp, model, opts = {}) {
    const gl = this.gl;
    const g = this.cache.get(key);
    if (!g) return;
    this._lit(mvp, opts);
    gl.uniformMatrix4fv(this.loc.model, false, model || this.identity);
    this._bind(g);

    // Inverted hull: the same mesh grown along its normals, front faces culled
    // so only the back shell survives, drawn flat and dark before the model
    // itself covers it. Needs closed geometry and smooth normals — which is
    // exactly what the Blender character has and the maze shell does not, so
    // this is opt-in per group rather than a global pass.
    if (opts.outline) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.uniform1f(this.loc.outline, opts.outline);
      gl.uniform4fv(this.loc.ink, [...(opts.ink || [0.07, 0.09, 0.13]), 1]);
      gl.uniform1f(this.loc.opacity, 1);
      gl.drawArrays(gl.TRIANGLES, 0, g.count);
      gl.uniform1f(this.loc.outline, 0);
      gl.uniform4fv(this.loc.ink, [0, 0, 0, 0]);
      gl.disable(gl.CULL_FACE);
    }

    gl.uniform1f(this.loc.opacity, opts.opacity ?? g.opacity);
    gl.uniform1f(this.loc.emissive, opts.emissive ?? g.emissive);
    const blend = (opts.opacity ?? g.opacity) < 1;
    if (blend) { gl.enable(gl.BLEND); gl.depthMask(false); }
    gl.drawArrays(gl.TRIANGLES, 0, g.count);
    if (blend) { gl.disable(gl.BLEND); gl.depthMask(true); }
  }

  /** Clear and set up a frame; returns the MVP for this camera. */
  beginFrame (cam, opts = {}) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const bg = opts.background || this.background;
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Stashed for the rim term, which needs a view vector. Taking it here rather
    // than as a drawGroup argument keeps every existing call site unchanged.
    this.eye = cam.eye;
    const proj = perspective(cam.fov ?? 0.95, this.canvas.width / this.canvas.height, 0.12, 500);
    return multiply(proj, lookAt(cam.eye, cam.at, cam.up || [0, 1, 0]));
  }

  /** Polyline overlay in world space — the solution route, a bot trail. */
  drawPath (points, mvp, color = [1, 0.85, 0.3, 0.8], lift = 0.25) {
    if (!points || points.length < 2) return;
    const gl = this.gl;
    const arr = new Float32Array((points.length - 1) * 6);
    for (let i = 0; i < points.length - 1; i++) {
      arr[i * 6] = points[i].x; arr[i * 6 + 1] = points[i].y + lift; arr[i * 6 + 2] = points[i].z;
      arr[i * 6 + 3] = points[i + 1].x; arr[i * 6 + 4] = points[i + 1].y + lift; arr[i * 6 + 5] = points[i + 1].z;
    }
    if (!this._pathBuf) this._pathBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._pathBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    this._lines(this._pathBuf, arr.length / 3, mvp, color, 2);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

/** Fit the camera distance to a piece's bounds. */
  static frame (bounds, fov = 0.72, pad = 0.96) {
    const { lo, hi } = bounds;
    const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2;
    const r = Math.max(0.5, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2);
    return { target: [cx, cy, cz], dist: (r / Math.tan(fov / 2)) * pad };
  }
}

function normalize (v) {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return new Float32Array([v[0] / L, v[1] / L, v[2] / L]);
}

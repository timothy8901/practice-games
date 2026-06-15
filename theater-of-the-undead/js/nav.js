// ============ walkability grid + BFS flow-field + spatial hash ============
import * as THREE from 'three';

export class Nav {
  constructor(map) {
    this.map = map;
    this.cs = map.cellSize;
    this.minX = map.bounds.minX;
    this.minZ = map.bounds.minZ;
    this.cols = Math.ceil((map.bounds.maxX - map.bounds.minX) / this.cs);
    this.rows = Math.ceil((map.bounds.maxZ - map.bounds.minZ) / this.cs);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);   // 1 = wall / non-walkable
    this.field = new Int32Array(n);
    this.queue = new Int32Array(n);
    this.openRects = [];
    this.rebuild();
    this._lastCell = -1;
    this._sinceFlow = 99;

    // spatial hash for zombie separation / bullet queries
    this.hcs = 2.5;
    this.hcols = Math.ceil((map.bounds.maxX - map.bounds.minX) / this.hcs) + 1;
    this.hrows = Math.ceil((map.bounds.maxZ - map.bounds.minZ) / this.hcs) + 1;
    this.buckets = Array.from({ length: this.hcols * this.hrows }, () => []);
  }

  ci(x, z) {
    const i = Math.floor((x - this.minX) / this.cs);
    const j = Math.floor((z - this.minZ) / this.cs);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return -1;
    return j * this.cols + i;
  }
  cx(i) { return this.minX + (i % this.cols + 0.5) * this.cs; }
  cz(i) { return this.minZ + ((i / this.cols | 0) + 0.5) * this.cs; }

  rebuild() {
    this.openRects.length = 0;
    for (const id in this.map.rooms) { const r = this.map.rooms[id]; if (r.open) this.openRects.push(r.rect); }
    for (const d of this.map.doors) if (d.open) this.openRects.push(d.rect);
    const { cols, rows, cs, minX, minZ } = this;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = minX + (i + 0.5) * cs, z = minZ + (j + 0.5) * cs;
      this.blocked[j * cols + i] = this.inOpen(x, z) ? 0 : 1;
    }
    this._lastCell = -1;
  }

  inOpen(x, z) {
    for (const r of this.openRects) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return true;
    return false;
  }
  // standable if a small footprint is clear (cardinal samples)
  canStand(x, z, r = 0.4) {
    return this.inOpen(x, z) && this.inOpen(x + r, z) && this.inOpen(x - r, z) &&
      this.inOpen(x, z + r) && this.inOpen(x, z - r);
  }
  // axis-separated slide: returns adjusted {x,z}
  resolve(px, pz, nx, nz, r = 0.4) {
    let x = px, z = pz;
    if (this.canStand(nx, z, r)) x = nx;
    if (this.canStand(x, nz, r)) z = nz;
    return { x, z };
  }

  nearestOpenCell(x, z) {
    let c = this.ci(x, z);
    if (c >= 0 && !this.blocked[c]) return c;
    // spiral-ish search outward
    for (let rad = 1; rad < 20; rad++) {
      for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
        const cc = this.ci(x + di * this.cs, z + dj * this.cs);
        if (cc >= 0 && !this.blocked[cc]) return cc;
      }
    }
    return -1;
  }

  computeFlow(px, pz) {
    const start = this.nearestOpenCell(px, pz);
    if (start < 0) return;
    const { cols, rows, field, queue, blocked } = this;
    field.fill(-1);
    let head = 0, tail = 0;
    queue[tail++] = start; field[start] = 0;
    while (head < tail) {
      const i = queue[head++];
      const d = field[i];
      const ci = i % cols, cj = (i / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (blocked[n] || field[n] !== -1) continue;
        if (di && dj) { // no corner cutting through walls
          if (blocked[cj * cols + ni] || blocked[nj * cols + ci]) continue;
        }
        field[n] = d + 1;
        queue[tail++] = n;
      }
    }
  }

  // throttled flow update; call each frame, recomputes when player crosses a cell
  updateFlow(px, pz, dt) {
    this._sinceFlow += dt;
    const c = this.nearestOpenCell(px, pz);
    if (c !== this._lastCell || this._sinceFlow > 0.4) {
      this.computeFlow(px, pz);
      this._lastCell = c;
      this._sinceFlow = 0;
    }
  }

  // direction (Vector2 out) toward lower flow value; falls back to straight-to-player
  steer(x, z, out, px, pz) {
    const { cols, rows, field, blocked } = this;
    const i = this.ci(x, z);
    if (i < 0 || blocked[i] || field[i] < 0) {
      out.set(px - x, pz - z); if (out.lengthSq() > 0) out.normalize(); return out;
    }
    const ci = i % cols, cj = (i / cols) | 0;
    let best = -1, bestVal = field[i];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const n = nj * cols + ni;
      if (blocked[n] || field[n] < 0) continue;
      if (di && dj && (blocked[cj * cols + ni] || blocked[nj * cols + ci])) continue;
      if (field[n] < bestVal) { bestVal = field[n]; best = n; }
    }
    if (best < 0) { out.set(px - x, pz - z); }
    else out.set(this.cx(best) - x, this.cz(best) - z);
    if (out.lengthSq() > 0) out.normalize();
    return out;
  }

  // ---- spatial hash (rebuilt each frame from active agents) ----
  hi(x, z) {
    const i = Math.floor((x - this.minX) / this.hcs);
    const j = Math.floor((z - this.minZ) / this.hcs);
    return Math.max(0, Math.min(this.hrows - 1, j)) * this.hcols + Math.max(0, Math.min(this.hcols - 1, i));
  }
  clearHash() { for (const b of this.buckets) b.length = 0; }
  insert(agent) { this.buckets[this.hi(agent.pos.x, agent.pos.z)].push(agent); }
  forNear(x, z, cb) {
    const ci = Math.max(0, Math.min(this.hcols - 1, Math.floor((x - this.minX) / this.hcs)));
    const cj = Math.max(0, Math.min(this.hrows - 1, Math.floor((z - this.minZ) / this.hcs)));
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= this.hcols || nj >= this.hrows) continue;
      const b = this.buckets[nj * this.hcols + ni];
      for (let k = 0; k < b.length; k++) cb(b[k]);
    }
  }
}

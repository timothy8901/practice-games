// proto/chars/rig.js
// Tiny paper-doll compositor for palette-indexed string art. Pure: no DOM.
// A "part" is an array of strings ('.' = transparent). A "grid" is an array of
// char arrays. Everything composes at module load; the game only ever sees
// plain rows + palette, decoded by js/core/pixelart.js.

export const W = 16, H = 24;

export function blank(w = W, h = H) {
  return Array.from({ length: h }, () => Array(w).fill('.'));
}

/** Stamp `part` onto `g` with its top-left at (x, y). Out-of-bounds pixels are dropped. */
export function stamp(g, part, x, y) {
  if (!part) return g;
  for (let r = 0; r < part.length; r++) {
    const row = part[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const gy = y + r, gx = x + c;
      if (gy < 0 || gy >= g.length || gx < 0 || gx >= g[0].length) continue;
      g[gy][gx] = ch;
    }
  }
  return g;
}

/** Stamp only where the grid is still transparent (draw-behind). */
export function under(g, part, x, y) {
  if (!part) return g;
  for (let r = 0; r < part.length; r++) {
    const row = part[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const gy = y + r, gx = x + c;
      if (gy < 0 || gy >= g.length || gx < 0 || gx >= g[0].length) continue;
      if (g[gy][gx] === '.') g[gy][gx] = ch;
    }
  }
  return g;
}

export const rows = (g) => g.map((r) => r.join(''));
export const flipH = (rs) => rs.map((r) => [...r].reverse().join(''));

/** Replace characters in a part via a {from: to} map. */
export function remap(part, map) {
  return part.map((r) => [...r].map((ch) => (ch in map ? map[ch] : ch)).join(''));
}

/** Shift a part by dx, dy inside a w x h box. */
export function shift(part, dx, dy, w = W, h = H) {
  const g = blank(w, h);
  stamp(g, part, dx, dy);
  return rows(g);
}

/** Compose a list of [part, x, y] layers (bottom first) into rows. */
export function compose(layers, w = W, h = H) {
  const g = blank(w, h);
  for (const [part, x = 0, y = 0] of layers) stamp(g, part, x, y);
  return rows(g);
}

/** Trim common pixel letters used by a set of rows (for palette checks). */
export function usedChars(rs) {
  const s = new Set();
  for (const r of rs) for (const ch of r) if (ch !== '.') s.add(ch);
  return [...s].sort();
}

// ---------------------------------------------------------------------------
// Shape helpers (used by the portrait busts and a few props). All pure.
// ---------------------------------------------------------------------------

/** Fill an axis-aligned ellipse centred at (cx, cy) with radii rx, ry. */
export function ellipse(g, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1 && g[y] && x >= 0 && x < g[0].length) g[y][x] = ch;
    }
  }
  return g;
}

/** Fill a rectangle (x, y, w, h). */
export function rect(g, x, y, w, h, ch) {
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (g[r] && c >= 0 && c < g[0].length) g[r][c] = ch;
  return g;
}

/** Bresenham line. */
export function line(g, x0, y0, x1, y1, ch) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) {
    if (g[y0] && x0 >= 0 && x0 < g[0].length) g[y0][x0] = ch;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return g;
}

/** Replace `from` with `to` wherever the pixel is inside the ellipse (for shading bands). */
export function shadeEllipse(g, cx, cy, rx, ry, from, to) {
  const set = new Set(from);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
      if (dx * dx + dy * dy <= 1 && g[y] && x >= 0 && x < g[0].length && set.has(g[y][x])) g[y][x] = to;
    }
  }
  return g;
}

/**
 * Selective outline: every transparent pixel 4-adjacent to an opaque pixel
 * becomes `ch` (the silhouette edge only, never interior colour changes).
 * `skipBottom` leaves the bottom row open (busts that bleed off the frame).
 */
export function outlineSilhouette(g, ch, { skipBottom = false } = {}) {
  const h = g.length, w = g[0].length, out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== '.') continue;
    if (skipBottom && y === h - 1) continue;
    const n = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
      const yy = y + dy, xx = x + dx;
      return g[yy] && xx >= 0 && xx < w && g[yy][xx] !== '.';
    });
    if (n) out[y][x] = ch;
  }
  return out;
}

/** Dither a region: replace `from` with `to` on a checkerboard inside the rect. */
export function dither(g, x, y, w, h, from, to, phase = 0) {
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) {
    if (g[r] && c >= 0 && c < g[0].length && g[r][c] === from && ((r + c + phase) & 1) === 0) g[r][c] = to;
  }
  return g;
}

/** Parse a part into a grid (so hand-drawn parts can be edited with the helpers). */
export function toGrid(part) {
  return part.map((r) => [...r]);
}

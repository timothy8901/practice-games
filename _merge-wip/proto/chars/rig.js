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

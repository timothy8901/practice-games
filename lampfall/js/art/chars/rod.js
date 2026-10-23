// js/art/chars/rod.js  [ART-CHARS] (from proto/chars/rod.js; adds opts.water for tall bodies)
// Shared fishing rod for the 24-wide fish frames. Pure: no DOM.
// Four phases, so the game can play a real cast instead of a static pose:
//   0 hold   rod tip drooping out over the water, line to a floating bobber
//   1 wind   rod swung up and back over the shoulder (anticipation)
//   2 cast   rod snapped forward, line whipping out in an arc
//   3 bite   rod bowed hard toward the water, line taut, bobber pulled under
// Letters: a cork handle, O cane (light), k line, Y bobber, W splash glint.

/** Quadratic bezier from p0 via c to p1, rasterised as a clean 1px line. */
function curve(g, p0, c, p1, ch, onlyEmpty = true) {
  const raw = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    raw.push([Math.round(u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]), Math.round(u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1])]);
  }
  // connect samples 8-way, no duplicates
  const pts = [];
  for (const [x, y] of raw) {
    const last = pts[pts.length - 1];
    if (last && last[0] === x && last[1] === y) continue;
    if (last) {
      let [lx, ly] = last;
      while (Math.abs(x - lx) > 1 || Math.abs(y - ly) > 1) { lx += Math.sign(x - lx); ly += Math.sign(y - ly); pts.push([lx, ly]); }
    }
    pts.push([x, y]);
  }
  // pixel-perfect: drop a point whose neighbours are 4-adjacent to it and diagonal to each other
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = out[out.length - 1], b = pts[i + 1];
    if (a && b) {
      const adj = (q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) === 1;
      if (adj(a) && adj(b) && Math.abs(a[0] - b[0]) === 1 && Math.abs(a[1] - b[1]) === 1) continue;
    }
    out.push(p);
  }
  out.forEach(([x, y], i) => {
    if (!g[y] || x < 0 || x >= g[0].length) return;
    const v = typeof ch === 'function' ? ch(i, out.length) : ch;
    if (!onlyEmpty || g[y][x] === '.') g[y][x] = v;
  });
  return out;
}

function put(g, x, y, ch, onlyEmpty = true) {
  if (g[y] && x >= 0 && x < g[0].length && (!onlyEmpty || g[y][x] === '.')) g[y][x] = ch;
}

/**
 * Draw rod + line for one phase into a 24-wide grid. (hx, hy) is the hand.
 * rod=false draws a hand line only (heron's bill, Ludo's pole hook, Dimity).
 */
const ROD = (i) => (i < 3 ? 'a' : 'O');
export function drawRod(g, hx, hy, phase = 0, { rod = true, water = 21 } = {}) {
  if (!rod) {
    const sway = [0, 0, -1, 1][phase];
    curve(g, [hx, hy], [hx - 3, hy + 3], [2 + sway, water - 1], 'k');
    if (phase === 3) { put(g, 2, water, 'W'); put(g, 4, water, 'W'); put(g, 3, water, 'Y'); }
    else { put(g, 2 + sway, water, 'Y'); put(g, 3 + sway, water, 'Y'); }
    return g;
  }
  if (phase === 0) {
    // relaxed: shallow bow, tip just past the frame edge of the tile
    const tip = [hx - 8, hy - 6];
    curve(g, [hx, hy], [hx - 4, hy - 7], tip, ROD);
    curve(g, tip, [tip[0] - 1, tip[1] + 6], [tip[0] - 1, water - 1], 'k');
    put(g, tip[0] - 1, water, 'Y'); put(g, tip[0], water, 'Y');
  } else if (phase === 1) {
    // wind-up: rod reared up in front of the face, tip whipping back,
    // bobber swinging under the tip (anticipation before the cast)
    const tip = [hx + 1, Math.max(0, hy - 13)];
    curve(g, [hx, hy], [hx - 3, hy - 7], tip, ROD);
    curve(g, tip, [tip[0] - 3, tip[1] + 1], [tip[0] - 5, tip[1] + 4], 'k');
    put(g, tip[0] - 5, tip[1] + 5, 'Y');
  } else if (phase === 2) {
    // cast: rod snapped forward and flexed, line flying out in an arc
    const tip = [hx - 9, hy - 3];
    curve(g, [hx, hy], [hx - 5, hy - 6], tip, ROD);
    curve(g, tip, [tip[0] - 2, tip[1] - 5], [0, tip[1] - 2], 'k');
  } else {
    // bite: rod bowed hard, tip dragged down, line taut, bobber under
    const tip = [hx - 8, hy + 1];
    curve(g, [hx, hy], [hx - 7, hy - 6], tip, ROD);
    curve(g, tip, tip, [tip[0], water - 1], 'k');
    put(g, tip[0] - 1, water, 'W'); put(g, tip[0] + 1, water, 'W');
    put(g, tip[0] - 2, water - 1, 'W'); put(g, tip[0] + 2, water - 1, 'W');
  }
  return g;
}

// proto/chars/portraits.js
// 48x48 dialogue busts in the field-guide style: a soft plate disc behind a
// bust that bleeds off the bottom edge. Forms are modelled as lit ellipsoids
// (light from the top-left) quantised to 3-4 shade ramps with a 2x2 ordered
// dither on the band edges, then hand-placed features on top. Each layer gets a
// selective outline: the dark outline on the shadow side, a softer shade on the
// lit side, so forms read without a hard sticker edge.
//
// Plate letters '1' (fill) and '2' (rule) can be set to null in the palette for
// a clean bust on a dialogue box.
//
// Porchlight townsfolk use the cast hex tokens (no pure black or white).
// Wildshift people (Linnet, Idris, Corin) use master keys only, on an n / v
// plate (the UI panel fill and border).
import { blank, stamp } from './rig.js';
import { SW } from './palettes.js';

const N = 48;
const G = () => blank(N, N);
const L3 = (() => { const v = [-0.5, -0.62, 0.6]; const m = Math.hypot(...v); return v.map((c) => c / m); })();
const BAYER = [[0, 0.5], [0.75, 0.25]];

/**
 * Lit ellipsoid. ramp = [light, base, shade, deep?]. th = band thresholds.
 * opts.dither: dither amplitude; opts.only(x, y): extra clip; opts.light: dir.
 */
function ball(g, cx, cy, rx, ry, ramp, opts = {}) {
  const th = opts.th || (ramp.length >= 4 ? [0.86, 0.55, 0.2] : [0.78, 0.32]);
  const amp = opts.dither ?? 0.07;
  const Ld = opts.light || L3;
  for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(g.length - 1, Math.ceil(cy + ry + 1)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx - 1)); x <= Math.min(g[0].length - 1, Math.ceil(cx + rx + 1)); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      if (opts.only && !opts.only(x, y)) continue;
      const nz = Math.sqrt(1 - r2);
      let d = nx * Ld[0] + ny * Ld[1] + nz * Ld[2] + (opts.bias || 0);
      d += (BAYER[y & 1][x & 1] - 0.375) * 2 * amp;
      let i = th.findIndex((t) => d > t);
      if (i < 0) i = th.length;
      g[y][x] = ramp[Math.min(i, ramp.length - 1)];
    }
  }
  return g;
}

/** Flat polygon fill (even-odd, pixel centres). */
function poly(g, pts, ch, only) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(g.length - 1, Math.ceil(Math.max(...ys))); y++) {
    for (let x = 0; x < g[0].length; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside && (!only || only(x, y, g[y][x]))) g[y][x] = ch;
    }
  }
  return g;
}

/** Thick line: stamps a w x w square along a Bresenham path. */
function seg(g, x0, y0, x1, y1, ch, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) px(g, x + a, y + b, ch);
  }
  return g;
}

function px(g, x, y, ch) { if (g[y] && x >= 0 && x < g[0].length) g[y][x] = ch; return g; }
function pxs(g, list, ch) { for (const [x, y] of list) px(g, x, y, ch); return g; }
function rect(g, x, y, w, h, ch) { for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) px(g, c, r, ch); return g; }
/** Recolour pixels of `from` (string of letters) to `to` where test(x, y) holds. */
function tint(g, from, to, test) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (from.includes(g[y][x]) && test(x, y)) g[y][x] = to;
  return g;
}

/** Selective outline: `dark` on the shadow side, `soft` on the lit (top-left) side. */
function outline(g, dark, soft = dark) {
  const h = g.length, w = g[0].length, out = g.map((r) => r.slice());
  const op = (x, y) => y >= 0 && y < h && x >= 0 && x < w && g[y][x] !== '.';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== '.') continue;
    const r = op(x + 1, y), d = op(x, y + 1), l = op(x - 1, y), u = op(x, y - 1);
    if (!(r || d || l || u)) continue;
    out[y][x] = (r || d) && !(l || u) ? soft : dark;
  }
  return out;
}
/** Stamp layer grid `top` over `base` in place. */
function over(base, top) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (top[y][x] !== '.') base[y][x] = top[y][x];
  return base;
}
/** Layer stack -> rows on a plate disc. Each layer: [grid, dark, soft]. */
function finish(layers) {
  const fig = G();
  for (const [lay, dark, soft] of layers) over(fig, dark ? outline(lay, dark, soft) : lay);
  const g = G();
  // plate: disc with a 1px rule
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24);
    if (d <= 23.2) g[y][x] = d > 22.2 ? '2' : '1';
  }
  over(g, fig);
  return g.map((r) => r.join(''));
}

/** Rounded eye: w x h block of E, corners trimmed, glint W at the top-left. */
function eye(g, x, y, w, h, E = 'E', W = 'W', { glint = true, iris = null } = {}) {
  rect(g, x, y, w, h, E);
  if (iris) for (let r = y + 1; r < y + h; r++) for (let c = x; c < x + w; c++) if ((c === x || c === x + w - 1) && r > y) px(g, c, r, iris);
  if (glint) px(g, x + (w > 2 ? 1 : 0), y + (h > 3 ? 1 : 0), W);
  return g;
}
/** Trim the four corners of a rect region back to `ch` (for rounded features). */
function corners(g, x, y, w, h, ch) { pxs(g, [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]], ch); }

const PORCH_PLATE = { 1: '#efe6cf', 2: '#c9a77c' };
const WILD_PLATE = { 1: SW.n, 2: SW.v };

// ---------------------------------------------------------------------------
// Beavers: Wren and (grizzled, bottle-bottom lenses) Ambrose share one build.
// ---------------------------------------------------------------------------
function beaver({ elder = false } = {}) {
  const FUR = ['L', 'F', 'f', 'D'];
  // body: bare-fur shoulders, overall bib with straps, brass buttons
  const body = G();
  ball(body, 24, 56, 21, 16, FUR, { bias: 0.1 });
  const bib = G();
  poly(bib, [[14, 39], [34, 39], [35, 48], [13, 48]], 'C');
  tint(bib, 'C', 'Q', (x) => x <= 16);
  tint(bib, 'C', 'c', (x) => x >= 31);
  seg(bib, 15, 39, 11, 34, 'C', 2); seg(bib, 32, 39, 35, 34, 'c', 2);
  px(bib, 11, 34, 'Q'); px(bib, 12, 34, 'Q');
  rect(bib, 16, 40, 2, 2, 'A'); px(bib, 16, 40, 'B'); rect(bib, 30, 40, 2, 2, 'A'); px(bib, 30, 40, 'B'); px(bib, 31, 41, 'a');
  // pocket abacus clipped to the bib (Wren) / a folded rule (Ambrose)
  if (!elder) {
    rect(bib, 19, 42, 10, 6, 'T'); rect(bib, 20, 43, 8, 4, 'c');
    for (const [r, xs] of [[43, [20, 22, 25]], [44, [21, 23, 26]], [45, [20, 24, 27]]]) for (const x of xs) px(bib, x, r, 'A');
    rect(bib, 19, 42, 10, 1, 't'); px(bib, 20, 43, 'B');
  } else {
    rect(bib, 25, 41, 2, 7, 'T'); px(bib, 25, 41, 'A'); px(bib, 25, 44, 'A');
  }
  // head: ears, cheeks, crown; flat-topped
  const head = G();
  ball(head, 13, 11, 3.2, 3.2, ['F', 'f', 'D']); ball(head, 35, 11, 3.2, 3.2, ['f', 'D', 'D']);
  ball(head, 15, 27, 8, 7, FUR); ball(head, 33, 27, 8, 7, FUR);
  ball(head, 24, 21, 13, 12.5, FUR, { bias: 0.04 });
  ball(head, 24, 34, 9, 4.5, FUR); // jowl / chin
  if (elder) { // grizzle: light flecks on cheeks and crown
    tint(head, 'Ff', 'Z', (x, y) => y > 25 && y < 33 && (x < 12 || x > 36) && (x + y) % 2 === 0);
    tint(head, 'F', 'L', (x, y) => y < 14 && (x + 2 * y) % 5 === 0);
  }
  const face = G();
  ball(face, 24, 29.5, 8.5, 6, ['H', 'M', 'm'], { th: [0.7, 0.25] });
  ball(face, 24, 25.6, 3.2, 2.2, ['n', 'N', 'N'], { th: [0.8, 0.2] });
  px(face, 22, 25, 'W');
  seg(face, 24, 28, 24, 29, 'm');
  pxs(face, [[19, 30], [20, 31], [21, 31], [27, 31], [28, 31], [29, 30]], 'm');
  // incisors: always visible
  rect(face, 22, 31, 5, 5, 'Y'); rect(face, 24, 31, 1, 5, 'y'); rect(face, 22, 35, 5, 1, 'y'); px(face, 22, 31, 'H');
  // whisker dots
  pxs(face, [[18, 28], [20, 27], [30, 28], [28, 27]], 'm');
  // eyes + brows
  if (!elder) {
    eye(face, 17, 18, 3, 4); eye(face, 29, 18, 3, 4);
    pxs(face, [[16, 16], [17, 15], [18, 15], [19, 15]], 'D'); pxs(face, [[29, 15], [30, 15], [31, 15], [32, 16]], 'D');
    pxs(face, [[17, 22], [18, 22], [30, 22], [31, 22]], 'f');
    // blush
    pxs(face, [[14, 25], [15, 25], [33, 25], [34, 25]], 'P');
  } else {
    // bottle-bottom lenses over the eyes, eyes magnified
    for (const cx of [18.5, 30.5]) {
      ball(face, cx, 20, 4.6, 4.6, ['G', 'G', 'g'], { th: [0.6, 0.1] });
    }
    eye(face, 17, 18, 4, 4); eye(face, 29, 18, 4, 4);
    for (const cx of [18.5, 30.5]) ring(face, cx, 20, 5.1, 'A', 'B', 'a');
    seg(face, 24, 19, 25, 19, 'A');
    pxs(face, [[16, 17], [28, 17]], 'W');
    // bushy white brows
    rect(face, 14, 13, 6, 2, 'Z'); rect(face, 29, 13, 6, 2, 'Z'); pxs(face, [[13, 14], [35, 14]], 'Z');
  }
  // spectacles pushed up on the forehead (Wren) - the bump on the flat head
  const acc = G();
  if (!elder) {
    for (const cx of [18.5, 29.5]) { ball(acc, cx, 9.5, 2.6, 2.6, ['W', 'G', 'G'], { th: [0.85, 0.3] }); ring(acc, cx, 9.5, 3.4, 'A', 'B', 'a'); }
    seg(acc, 22, 9, 26, 9, 'A');
    // pencil behind her right ear (viewer's left)
    seg(acc, 8, 6, 12, 14, 'A'); px(acc, 8, 6, 'E'); px(acc, 9, 7, 'B'); px(acc, 12, 14, 'a');
  } else {
    // the co-op pencil he can no longer use, tucked behind his ear anyway
    seg(acc, 9, 7, 12, 13, 'A'); px(acc, 9, 7, 'E'); px(acc, 10, 8, 'B');
  }
  return finish([[body, 'K', 'f'], [bib, 'k', 'c'], [head, 'K', 'f'], [face, null], [acc, 'K', 'a']]);
}

/** 1px ring of radius r with light (top-left) / base / shade (bottom-right). */
function ring(g, cx, cy, r, base, light, shade) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (Math.abs(d - r) < 0.55) {
      const a = (x + 0.5 - cx) + (y + 0.5 - cy);
      px(g, x, y, a < -r * 0.6 ? light : a > r * 0.6 ? shade : base);
    }
  }
}

const WREN_PAL = {
  ...PORCH_PLATE, K: '#2e1c12', k: '#1e2a33',
  L: '#b07a52', F: '#8a5a3b', f: '#6a4330', D: '#4a2d2e',
  H: '#f6ead2', M: '#e9d3b0', m: '#b89c84', N: '#2e1c12', n: '#5a3a30',
  E: '#2e1c12', W: '#cfe7f2', Y: '#f2a541', y: '#c0742a', P: '#d9907a',
  A: '#d9a441', B: '#f2d27a', a: '#8a6a1e', G: '#9fc7d6', g: '#6e93a8',
  C: '#4f6d7a', c: '#34505c', Q: '#6f8f99', T: '#5a3a2a', t: '#3e2618', Z: '#cdbba4',
};
const AMBROSE_PAL = {
  ...WREN_PAL,
  L: '#a8927c', F: '#7a6a5a', f: '#5a4a44', D: '#3e3240', Z: '#e4dccb',
  H: '#efe6d6', M: '#d9cbb0', m: '#a89a88', Y: '#e0c77a', y: '#a8904a',
  C: '#5f7a85', c: '#3e5660', Q: '#7f98a0', G: '#cfe2ea', g: '#9ab8c6',
};

// ---------------------------------------------------------------------------
// Juniper Pell, magpie: 3/4 turn, beak jutting left; black/white split;
// iridescent sheen on the wing edges (I/i are palette-cycled by the game);
// shopkeeper's apron with too many pockets, one trinket glint.
// ---------------------------------------------------------------------------
function juniper() {
  const BLK = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 57, 22, 19, BLK, { bias: 0.08 });
  // the magpie tells: big white scapular patches on both shoulders
  ball(body, 9, 42, 6.5, 4.6, ['M', 'M', 'm', 'n'], { bias: 0.12 });
  ball(body, 39, 42, 6.5, 4.6, ['M', 'm', 'm', 'n'], { bias: 0.0 });
  // sheen along the wing edges
  tint(body, 'Ff', 'I', (x, y) => (x <= 3 || x >= 44) && y >= 40);
  tint(body, 'f', 'i', (x, y) => (x <= 4 || x >= 43) && y >= 44 && (x + y) % 2 === 0);
  // white belly rising between the apron straps (the black bib stays above)
  ball(body, 24, 44, 8.5, 10, ['M', 'M', 'm', 'n']);
  const apron = G();
  poly(apron, [[15, 38], [33, 38], [36, 48], [12, 48]], 'C');
  tint(apron, 'C', 'Q', (x, y) => x <= 15 || y === 38);
  tint(apron, 'C', 'c', (x) => x >= 32);
  seg(apron, 16, 38, 20, 31, 'C'); seg(apron, 32, 38, 29, 31, 'c');
  for (const [x, y] of [[16, 41], [21, 41], [27, 41], [31, 41], [18, 45], [24, 45], [30, 45]]) { rect(apron, x, y, 3, 2, 'c'); px(apron, x, y, 'x'); }
  px(apron, 28, 41, 'A'); px(apron, 27, 40, 'B');
  const head = G();
  ball(head, 27, 19, 11.5, 11.5, BLK, { bias: 0.05 });
  ball(head, 25, 29, 8, 4, BLK); // throat
  // crown sheen
  pxs(head, [[23, 9], [25, 9], [27, 8], [24, 10], [22, 11]], 'i');
  const beak = G();
  poly(beak, [[18, 16], [7, 20.5], [18, 24]], 'X');
  poly(beak, [[18, 20.5], [8, 20.8], [18, 24]], 'x');
  pxs(beak, [[16, 17], [14, 18], [12, 19]], 'L');
  const face = G();
  ring(face, 21.5, 16.5, 2.7, 'n', 'n', 'L');
  rect(face, 20, 15, 3, 3, 'E'); px(face, 20, 15, 'W'); px(face, 21, 15, 'W');
  pxs(face, [[19, 13], [20, 12], [21, 12], [22, 12]], 'L');
  // a tiny smile line where the beak meets the face
  pxs(face, [[19, 24], [20, 25]], 'L');
  return finish([[body, 'K', 'K'], [apron, 'K', 'c'], [head, 'K', 'K'], [beak, 'K', 'K'], [face, null]]);
}
const JUNIPER_PAL = {
  ...PORCH_PLATE, K: '#141b33',
  L: '#4a4862', F: '#2a2838', f: '#1f1d2a', D: '#171522',
  I: '#2a6f8f', i: '#3fae8c',
  M: '#f1eee6', m: '#b9b4c4', n: '#7f7a96',
  E: '#141b33', W: '#f1eee6', X: '#3a3848', x: '#2a2433',
  C: '#c97b2c', c: '#8a4f1a', Q: '#e39a4f',
  A: '#d9a441', B: '#f6e3a0',
};

// ---------------------------------------------------------------------------
// Barnaby Thole, hermit crab in a brass diving helmet one size too small:
// a sphere, porthole glass with two stalked eyes, rivets, valve, mismatched
// coral claws poking out of the neck ring.
// ---------------------------------------------------------------------------
function barnaby() {
  const BR = ['L', 'F', 'f', 'D'];
  const claws = G();
  // big claw (viewer's left), small claw (right)
  // big claw raised beside the helmet: palm + upper finger + lower finger
  ball(claws, 8, 38, 6, 5, ['Q', 'R', 'r', 's']);
  ball(claws, 5, 30, 3, 6, ['Q', 'R', 'r', 's']);
  ball(claws, 10.5, 30.5, 2.5, 4.5, ['Q', 'R', 'r', 's']);
  poly(claws, [[6.5, 25], [9.5, 25], [8.5, 33], [7.5, 33]], '.');
  // small claw low on the right
  ball(claws, 40.5, 41, 4, 3.5, ['Q', 'R', 'r', 's']);
  ball(claws, 43, 37.5, 2, 2.6, ['Q', 'R', 'r', 's']);
  px(claws, 42, 38, '.'); px(claws, 42, 37, '.');
  // legs under the rim
  for (const x of [15, 20, 28, 33]) { seg(claws, x, 43, x + (x < 24 ? -1 : 1), 47, 'r', 2); px(claws, x, 43, 'R'); }
  const helmet = G();
  ball(helmet, 24, 4.5, 3, 2.2, BR); rect(helmet, 23, 5, 3, 3, 'f'); px(helmet, 23, 5, 'L');
  ball(helmet, 24, 22, 17, 16.5, BR, { bias: 0.02 });
  // neck ring
  const collar = G();
  ball(collar, 24, 39.5, 16, 4, BR, { th: [0.8, 0.45, 0.15] });
  for (const x of [11, 18, 24, 30, 37]) px(collar, x, 39, 'W');
  // porthole
  const port = G();
  ball(port, 22, 22, 9.5, 9.5, BR, { light: [0.45, 0.55, 0.7] }); // rim lit from inside-bottom: reads as a recess
  ball(port, 22, 22, 7.5, 7.5, ['H', 'G', 'G', 'g'], { th: [0.9, 0.5, 0.05] });
  // fog in the lower right half (50% ordered dither)
  tint(port, 'Gg', 'H', (x, y) => (x + y) % 2 === 0 && (x - 22) + (y - 22) > 5 && Math.hypot(x + 0.5 - 22, y + 0.5 - 22) < 7.5);
  for (const [x, y] of [[21, 13], [30, 21], [22, 30], [13, 22]]) px(port, x, y, 'W');
  // stalked eyes + mouth inside the glass
  seg(port, 19, 27, 19, 20, 'g'); seg(port, 25, 27, 25, 20, 'g');
  rect(port, 18, 18, 2, 3, 'E'); rect(port, 24, 18, 2, 3, 'E'); px(port, 18, 18, 'W'); px(port, 24, 18, 'W');
  pxs(port, [[20, 28], [21, 29], [22, 29], [23, 28]], 's');
  pxs(port, [[17, 17], [16, 18]], 'W');
  return finish([[claws, 'K', 'r'], [helmet, 'K', 'f'], [collar, 'K', 'f'], [port, null]]);
}
const BARNABY_PAL = {
  ...PORCH_PLATE, K: '#3a2410',
  L: '#e3b867', F: '#b8862f', f: '#7a5a1e', D: '#4e3418',
  W: '#f6f1e3', G: '#9fd3c0', g: '#5f9a8e', H: '#e9f7f2', E: '#141b33',
  Q: '#f29a7a', R: '#e06a4f', r: '#a8402e', s: '#6e2a2a',
};

// ---------------------------------------------------------------------------
// Hesper Coil, garden snail: limbless; canvas mail satchel where a shell would
// be with envelope corners poking out; eyestalks in a wide V; she carries one
// old letter (wax seal) tucked against her foot.
// ---------------------------------------------------------------------------
function hesper() {
  const BODY = ['L', 'F', 'f', 'D'];
  const sat = G();
  ball(sat, 31, 31, 15, 13, ['S', 'C', 'c', 'q'], { bias: 0.05 });
  // squared flap: lighter band across the top with a seam
  tint(sat, 'Ccq', 'S', (x, y) => y < 25 && x < 30);
  for (let x = 17; x <= 45; x++) if (sat[30][x] !== '.') sat[30][x] = 'c';
  rect(sat, 33, 29, 3, 3, 'A'); px(sat, 33, 29, 'B'); px(sat, 35, 31, 'a');
  // spiral stitch hinting at the shell
  ring(sat, 37, 37, 3.4, 'c', 'C', 'q'); px(sat, 37, 37, 'c');
  const env = G();
  for (const [x, w] of [[22, 6], [30, 6], [38, 5]]) {
    poly(env, [[x, 20], [x + w / 2, 14 + (x % 3)], [x + w, 20]], 'M');
    px(env, x + Math.floor(w / 2), 15 + (x % 3), 'M');
  }
  tint(env, 'M', 'm', (x, y) => y >= 19);
  const body = G();
  ball(body, 21, 50, 17, 7, BODY, { bias: 0.15 }); // foot skirt
  ball(body, 21, 39, 10.5, 12, BODY, { bias: 0.05 });
  ball(body, 21, 27, 8, 7.5, BODY, { bias: 0.05 });
  // glisten streak along the skirt
  pxs(body, [[8, 47], [9, 46], [11, 45], [13, 45], [30, 45], [32, 46]], 'H');
  // stalks
  const stalk = G();
  seg(stalk, 18, 23, 11, 9, 'F', 2); seg(stalk, 24, 23, 30, 9, 'F', 2);
  seg(stalk, 18, 23, 11, 9, 'L'); seg(stalk, 25, 23, 31, 9, 'f');
  ball(stalk, 11, 8, 3, 3, ['W', 'E', 'E'], { th: [0.92, 0.3] });
  ball(stalk, 31, 8, 3, 3, ['W', 'E', 'E'], { th: [0.92, 0.3] });
  px(stalk, 10, 7, 'W'); px(stalk, 30, 7, 'W');
  const face = G();
  pxs(face, [[18, 31], [19, 32], [20, 32], [21, 32], [22, 31]], 'D');
  pxs(face, [[15, 29], [16, 29], [26, 29], [27, 29]], 'P');
  // the letter she carries, tilted against her foot
  const letter = G();
  poly(letter, [[9, 40], [25, 38], [27, 47], [10, 48]], 'X');
  tint(letter, 'X', 'x', (x, y) => y >= 46 || x >= 25);
  seg(letter, 10, 41, 18, 44, 'x'); seg(letter, 18, 44, 25, 39, 'x');
  rect(letter, 17, 43, 3, 3, 'Y'); px(letter, 17, 43, 'R');
  return finish([[sat, 'K', 'c'], [env, 'K', 'm'], [body, 'K', 'f'], [stalk, 'K', 'f'], [face, null], [letter, 'K', 'x']]);
}
const HESPER_PAL = {
  ...PORCH_PLATE, K: '#2e3a2c',
  L: '#c3d0ba', F: '#a9b8a0', f: '#7a8c74', D: '#566a5c', H: '#e9f7f2',
  S: '#ddcca0', C: '#c9b48a', c: '#8c7a5a', q: '#66573e',
  M: '#f4f1e6', m: '#d6ccb4', A: '#d9a441', B: '#f2d27a', a: '#8a6a1e',
  X: '#e8d3a0', x: '#bfa478', Y: '#a8323a', R: '#d0545a',
  E: '#2e3a2c', W: '#e9f7f2', P: '#d9a3a0',
};

// ---------------------------------------------------------------------------
// Linnet Rask, stoat rival (master keys): chestnut over cream, round ears,
// ponytail, determined brows, a smirk; popped jacket collar.
// ---------------------------------------------------------------------------
function linnet() {
  const FUR = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 57, 21, 17, ['O', 'R', 'p', 'k'], { bias: 0.08 });
  // tee + zip
  poly(body, [[19, 40], [29, 40], [27, 48], [21, 48]], 'v');
  tint(body, 'v', 'e', (x) => x >= 26);
  seg(body, 24, 41, 24, 47, 'e');
  // popped collar
  const collar = G();
  poly(collar, [[13, 36], [20, 38], [21, 46], [15, 42]], 'O');
  poly(collar, [[35, 36], [28, 38], [27, 46], [33, 42]], 'R');
  const hair = G();
  ball(hair, 38, 18, 4, 6, ['L', 'F', 'F', 'f'], { bias: 0.15 }); // ponytail
  ball(hair, 39, 26, 2.2, 3.5, ['F', 'F', 'f']);
  rect(hair, 36, 12, 4, 2, 'Y'); px(hair, 36, 12, 'w');
  const FURH = ['L', 'F', 'f', 'D'];
  const head = G();
  ball(head, 14.5, 11, 4, 4, FURH, { th: [0.8, 0.3, -0.1] }); ball(head, 33.5, 11, 4, 4, FURH, { th: [0.8, 0.3, -0.1] });
  ball(head, 24, 20, 11.5, 11, FURH, { th: [0.84, 0.4, -0.02], bias: 0.06 });
  ball(head, 24, 27, 8.5, 6, FURH, { th: [0.84, 0.4, -0.02], bias: 0.06 }); // muzzle mass
  const face = G();
  ball(face, 14.6, 11.4, 2, 2, ['c', 'c', 'V']); ball(face, 33.6, 11.4, 2, 2, ['c', 'V', 'V']);
  // white upper lip, chin and throat
  ball(face, 24, 29.5, 6.5, 4, ['w', 'c', 'V'], { th: [0.7, 0.25] });
  ball(face, 24, 34, 5, 3.5, ['w', 'c', 'V'], { th: [0.75, 0.3] });
  // eyes: 3x4, glint, sharp brows angled to the centre
  rect(face, 17, 18, 3, 4, 'k'); px(face, 18, 19, 'w'); px(face, 17, 18, 'f');
  rect(face, 28, 18, 3, 4, 'k'); px(face, 29, 19, 'w'); px(face, 30, 18, 'f');
  pxs(face, [[16, 16], [17, 16], [18, 16], [19, 17]], 'D'); pxs(face, [[31, 16], [30, 16], [29, 16], [28, 17]], 'D');
  pxs(face, [[17, 22], [18, 22], [29, 22], [30, 22]], 'L');
  // nose + smirk (one corner up)
  rect(face, 23, 25, 3, 2, 'k'); px(face, 23, 25, 'e');
  pxs(face, [[24, 27], [24, 28], [23, 29], [22, 29], [25, 29], [26, 29], [27, 28], [28, 27]], 'V');
  // fringe falling over the brow
  const fr = G();
  poly(fr, [[15, 12], [28, 7.5], [31, 12], [25, 11], [20, 15]], 'F');
  pxs(fr, [[19, 12], [21, 11], [23, 10], [25, 9], [27, 9]], 'L');
  pxs(fr, [[26, 11], [29, 11]], 'f');
  return finish([[hair, 'k', 'f'], [body, 'k', 'p'], [collar, 'k', 'p'], [head, 'k', 'f'], [face, null], [fr, 'k', 'f']]);
}
const LINNET_PAL = {
  ...WILD_PLATE, k: SW.k,
  L: SW.h, F: SW.u, f: SW.p, D: SW.k,
  w: SW.w, c: SW.c, V: SW.v, e: SW.e, v: SW.v,
  O: SW.o, R: SW.r, p: SW.p, Y: SW.y,
};

// ---------------------------------------------------------------------------
// Idris Fenwake, Champion (master keys): grey fox-like trainer, pale muzzle,
// calm half-lidded gold eyes, high navy collar, brass clasp, anchor pin.
// ---------------------------------------------------------------------------
function idris() {
  const FUR = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 58, 21, 18, ['b', 'n', 'd', 'k'], { bias: 0.1 });
  // cravat
  poly(body, [[20, 37], [28, 37], [26, 45], [24, 47], [22, 45]], 'w');
  tint(body, 'w', 'V', (x, y) => x >= 25 || y >= 45);
  const collar = G();
  poly(collar, [[12, 35], [20, 36], [22, 46], [14, 44]], 'n');
  poly(collar, [[36, 35], [28, 36], [26, 46], [34, 44]], 'd');
  tint(collar, 'n', 'b', (x, y) => x <= 14 || y <= 36);
  rect(collar, 23, 41, 2, 2, 'y'); px(collar, 24, 42, 'a');
  // anchor pin on the left lapel
  pxs(collar, [[16, 39], [16, 40], [16, 41], [15, 41], [17, 41], [15, 38], [16, 38], [17, 38]], 'V');
  const head = G();
  // tall pointed ears
  poly(head, [[12, 15], [11, 1], [21, 9]], 'F'); poly(head, [[36, 15], [37, 1], [27, 9]], 'f');
  poly(head, [[13, 12], [12.5, 4], [18, 9]], 'd'); poly(head, [[35, 12], [35.5, 4], [30, 9]], 'k');
  pxs(head, [[11, 2], [11, 3], [12, 5]], 'L');
  ball(head, 24, 21, 12, 11, FUR, { bias: 0.04 });
  ball(head, 15, 26, 6, 5, FUR); ball(head, 33, 26, 6, 5, FUR);
  ball(head, 24, 32, 7, 5, FUR);
  const face = G();
  ball(face, 24, 29, 7, 5, ['w', 'w', 'V'], { th: [0.6, 0.3] });
  poly(face, [[13, 25], [19, 23], [21, 30], [15, 30]], 'w');
  poly(face, [[35, 25], [29, 23], [27, 30], [33, 30]], 'V');
  // calm half-lidded eyes with gold irises
  rect(face, 17, 19, 4, 3, 'y'); rect(face, 18, 19, 2, 3, 'k'); rect(face, 17, 19, 4, 1, 'D'); px(face, 17, 20, 'u'); px(face, 18, 20, 'w');
  rect(face, 27, 19, 4, 3, 'y'); rect(face, 28, 19, 2, 3, 'k'); rect(face, 27, 19, 4, 1, 'D'); px(face, 30, 21, 'u'); px(face, 28, 20, 'w');
  seg(face, 16, 17, 20, 17, 'L'); seg(face, 28, 17, 32, 17, 'f');
  // nose + small courteous smile
  rect(face, 23, 25, 3, 2, 'k'); px(face, 23, 25, 'e');
  pxs(face, [[24, 27], [24, 28], [22, 29], [23, 30], [25, 30], [26, 29]], 'V');
  // grey streak (age) on the crown
  pxs(face, [[22, 12], [23, 11], [24, 12], [25, 11], [23, 13]], 'L');
  return finish([[body, 'k', 'd'], [collar, 'k', 'd'], [head, 'k', 'f'], [face, null]]);
}
const IDRIS_PAL = {
  ...WILD_PLATE, k: SW.k,
  L: SW.v, F: SW.e, f: SW.d, D: SW.k,
  w: SW.w, V: SW.v, e: SW.e, y: SW.y, u: SW.u, a: SW.a,
  b: SW.b, n: SW.n, d: SW.d,
};

// ---------------------------------------------------------------------------
// Corin Vale, barn owl Shiftreader (master keys): heart-shaped white disc,
// tawny crown with pale flecks, big dark eyes (the left clouded: his sight is
// failing), small pale beak, navy coat, the Reading Glass on its cord.
// ---------------------------------------------------------------------------
function corin() {
  const TAW = ['y', 'a', 'u', 'p'];
  const body = G();
  ball(body, 24, 58, 22, 18, ['e', 'n', 'd', 'k'], { bias: 0.1 });
  // feathered ruff at the neck
  ball(body, 24, 38, 12, 5, ['c', 'a', 'u', 'u'], { dither: 0 });
  const head = G();
  ball(head, 24, 20, 15, 15, TAW, { bias: 0.04 });
  tint(head, 'au', 'c', (x, y) => y < 16 && y > 6 && (x * 5 + y * 3) % 11 === 0);
  // heart-shaped facial disc: two lobes meeting in a point at the top centre
  const disc = G();
  ball(disc, 18, 22, 8, 10, ['w', 'w', 'c', 'v'], { th: [0.6, 0.3, 0.02] });
  ball(disc, 30, 22, 8, 10, ['w', 'c', 'v', 'v'], { th: [0.75, 0.3, 0.02] });
  poly(disc, [[13, 28], [35, 28], [24, 37]], 'c');
  tint(disc, 'c', 'v', (x, y) => y >= 33 || x >= 30);
  ball(disc, 24, 30, 6, 6, ['w', 'c', 'c']);
  const face = G();
  // eye wells
  ball(face, 18, 21, 3.5, 4, ['k', 'k', 'k']); ball(face, 30, 21, 3.5, 4, ['k', 'k', 'k']);
  pxs(face, [[17, 19], [16, 20]], 'w');
  // failing eye: milky film on the right
  ball(face, 30.5, 21.5, 2, 2.2, ['v', 'e', 'e']);
  px(face, 29, 20, 'w');
  // beak
  poly(face, [[21.5, 25], [26.5, 25], [24, 32]], 'h');
  tint(face, 'h', 'u', (x, y) => x >= 25 || y >= 31);
  px(face, 23, 26, 'c');
  // reading glass on its cord
  const glass = G();
  seg(glass, 16, 38, 29, 43, 'a');
  ball(glass, 32, 44, 4, 4, ['y', 'a', 'u']); ball(glass, 32, 44, 2.6, 2.6, ['w', 'i', 's'], { th: [0.85, 0.3] });
  return finish([[body, 'k', 'd'], [head, 'k', 'u'], [disc, 'u', 'a'], [face, null], [glass, 'k', 'u']]);
}
const CORIN_PAL = {
  ...WILD_PLATE, k: SW.k,
  y: SW.y, a: SW.a, u: SW.u, p: SW.p, w: SW.w, c: SW.c, v: SW.v, h: SW.h,
  e: SW.e, n: SW.n, d: SW.d, i: SW.i, s: SW.s,
};

const mk = (rowsFn, palette) => ({ w: N, h: N, rows: rowsFn(), palette });
export const PORTRAITS = {
  wren: mk(() => beaver(), WREN_PAL),
  ambrose: mk(() => beaver({ elder: true }), AMBROSE_PAL),
  hesper: mk(hesper, HESPER_PAL),
  juniper: mk(juniper, JUNIPER_PAL),
  barnaby: mk(barnaby, BARNABY_PAL),
  linnet: mk(linnet, LINNET_PAL),
  idris: mk(idris, IDRIS_PAL),
  corin: mk(corin, CORIN_PAL),
};
// the player species can share the sheet logic later; for now the busts above
// cover the story speakers the brief names.

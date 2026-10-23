// js/art/chars/bustkit.js  [ART-CHARS]
// Drawing kit for the 48x48 dialogue busts (from the helpers in
// proto/chars/portraits.js) plus the expression layer: eyes, brows and mouths
// for neutral / happy / worried / surprised. Pure: grids of letters only.
//
// Style (field-guide plates): forms are lit ellipsoids (light from the top
// left) quantised to 3-4 shade ramps with a 2x2 ordered dither on the band
// edges; each layer gets a selective outline (dark on the shadow side, a
// softer shade on the lit side); the bust sits on a plate disc ('1' fill,
// '2' rule) and bleeds off the bottom edge.
import { blank } from './rig.js';

export const N = 48;
export const G = () => blank(N, N);
const L3 = (() => { const v = [-0.5, -0.62, 0.6]; const m = Math.hypot(...v); return v.map((c) => c / m); })();
const BAYER = [[0, 0.5], [0.75, 0.25]];
export const EXPRESSIONS = Object.freeze(['neutral', 'happy', 'worried', 'surprised']);

/** Lit ellipsoid. ramp = [light, base, shade, deep?]; opts: th, dither, only(x,y), light, bias. */
export function ball(g, cx, cy, rx, ry, ramp, opts = {}) {
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
export function poly(g, pts, ch, only) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(g.length - 1, Math.ceil(Math.max(...ys))); y++) {
    for (let x = 0; x < g[0].length; x++) {
      const px0 = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px0 < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside && (!only || only(x, y, g[y][x]))) g[y][x] = ch;
    }
  }
  return g;
}

/** Thick line: stamps a w x w square along a Bresenham path. */
export function seg(g, x0, y0, x1, y1, ch, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) px(g, x + a, y + b, ch);
  }
  return g;
}
export function px(g, x, y, ch) { if (g[y] && x >= 0 && x < g[0].length) g[y][x] = ch; return g; }
export function pxs(g, list, ch) { for (const [x, y] of list) px(g, x, y, ch); return g; }
export function rect(g, x, y, w, h, ch) { for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) px(g, c, r, ch); return g; }
/** Recolour pixels of `from` (string of letters) to `to` where test(x, y) holds. */
export function tint(g, from, to, test) {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (from.includes(g[y][x]) && test(x, y)) g[y][x] = to;
  return g;
}
/** Mirror a list of points around the bust's centre line (x -> 47 - x). */
export const mirror = (pts) => pts.map(([x, y]) => [N - 1 - x, y]);

/** Selective outline: `dark` on the shadow side, `soft` on the lit (top-left) side. */
export function outline(g, dark, soft = dark) {
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
export function over(base, top) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (top[y][x] !== '.') base[y][x] = top[y][x];
  return base;
}
/** Layer stack -> rows on a plate disc. Each layer: [grid, dark, soft] (dark null = no outline). */
export function finish(layers) {
  const fig = G();
  for (const [lay, dark, soft] of layers) over(fig, dark ? outline(lay, dark, soft) : lay);
  const g = G();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - 24, y + 0.5 - 24);
    if (d <= 23.2) g[y][x] = d > 22.2 ? '2' : '1';
  }
  over(g, fig);
  return g.map((r) => r.join(''));
}

/** 1px ring of radius r with light (top-left) / base / shade (bottom-right). */
export function ring(g, cx, cy, r, base, light, shade) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (Math.abs(d - r) < 0.55) {
      const a = (x + 0.5 - cx) + (y + 0.5 - cy);
      px(g, x, y, a < -r * 0.6 ? light : a > r * 0.6 ? shade : base);
    }
  }
}

// ---------------------------------------------------------------------------
// Expression layer. Eye boxes are given by their top-left (x, y) and size; the
// right eye is usually the mirror of the left (x -> 48 - x - w).
// ---------------------------------------------------------------------------

/**
 * One eye in an expression.
 *  o: { E, W, lid (upper-lid / closed-arc letter, default E), iris?, glint? }
 * neutral: rounded block + glint; happy: closed upward arc; worried: lid
 * drawn over the top row (anxious squint) + glint low; surprised: one row
 * taller, two glints, a sliver of white (W) around the pupil.
 */
export function eyeX(g, x, y, w, h, expr = 'neutral', o = {}) {
  const E = o.E || 'E', W = o.W || 'W', lid = o.lid || E;
  if (expr === 'happy') {
    // ^ arc, two pixels thick at the shoulders
    for (let c = 0; c < w; c++) {
      const edge = c === 0 || c === w - 1;
      px(g, x + c, y + (edge ? 2 : 1), lid);
      if (edge && h > 3) px(g, x + c, y + 3, lid);
    }
    return g;
  }
  if (expr === 'surprised') {
    rect(g, x, y - 1, w, h + 1, E);
    if (o.iris) for (let r = y; r < y + h; r++) { px(g, x, r, o.iris); px(g, x + w - 1, r, o.iris); }
    px(g, x, y - 1, o.white || W); px(g, x + w - 1, y + h - 1, o.white || W);
    px(g, x + (w > 2 ? 1 : 0), y, W);
    return g;
  }
  rect(g, x, y, w, h, E);
  if (o.iris) for (let r = y + 1; r < y + h; r++) { px(g, x, r, o.iris); px(g, x + w - 1, r, o.iris); }
  if (expr === 'worried') {
    rect(g, x, y, w, 1, lid);
    if (o.glint !== false) px(g, x + (w > 2 ? 1 : 0), y + 1, W);
    return g;
  }
  if (o.glint !== false) px(g, x + (w > 2 ? 1 : 0), y + (h > 3 ? 1 : 0), W);
  return g;
}

/** A brow over an eye box. side 'l' | 'r'. Neutral flat-ish, happy arched up, worried inner end up, surprised high arch. */
export function browX(g, x, y, w, side, expr = 'neutral', ch = 'D') {
  const pts = [];
  const xs = Array.from({ length: w + 1 }, (_, i) => x - 1 + i);
  xs.forEach((xx, i) => {
    const t = i / w; // 0 outer .. 1 inner (for side l; mirrored below)
    const inner = side === 'l' ? t : 1 - t;
    let dy = 0;
    if (expr === 'neutral') dy = inner < 0.2 ? 1 : 0;
    else if (expr === 'happy') dy = Math.abs(inner - 0.5) > 0.35 ? 0 : -1;
    else if (expr === 'worried') dy = Math.round(1 - inner * 2.2);
    else if (expr === 'surprised') dy = Math.abs(inner - 0.5) > 0.35 ? -2 : -3;
    pts.push([xx, y + dy]);
  });
  return pxs(g, pts, ch);
}

/**
 * Mouth centred at (cx, y). o: { line (stroke letter), dark (open mouth), tongue, w (half width) }
 * neutral: small soft line; happy: open smile; worried: wobbly frown; surprised: small O.
 */
export function mouthX(g, cx, y, expr = 'neutral', o = {}) {
  const line = o.line || 'm', dark = o.dark || 'K', tongue = o.tongue || 'P', w = o.w || 3;
  if (expr === 'happy') {
    for (let i = -w; i <= w; i++) px(g, cx + i, y, line);
    px(g, cx - w - 1, y - 1, line); px(g, cx + w + 1, y - 1, line);
    for (let i = -w + 1; i <= w - 1; i++) px(g, cx + i, y + 1, dark);
    for (let i = -w + 2; i <= w - 2; i++) px(g, cx + i, y + 2, dark);
    for (let i = -1; i <= 1; i++) px(g, cx + i, y + 2, tongue);
    for (let i = -w + 2; i <= w - 2; i++) px(g, cx + i, y + 3, line);
    return g;
  }
  if (expr === 'worried') {
    pxs(g, [[cx - w, y + 2], [cx - w + 1, y + 1], [cx - 1, y + 1], [cx, y], [cx + 1, y + 1], [cx + w - 1, y + 1], [cx + w, y + 2]], line);
    for (let i = -w + 2; i <= -2; i++) px(g, cx + i, y + 1, line);
    for (let i = 2; i <= w - 2; i++) px(g, cx + i, y + 1, line);
    return g;
  }
  if (expr === 'surprised') {
    rect(g, cx - 1, y, 3, 4, dark); px(g, cx, y + 3, tongue);
    pxs(g, [[cx - 2, y + 1], [cx - 2, y + 2], [cx + 2, y + 1], [cx + 2, y + 2], [cx - 1, y - 1], [cx, y - 1], [cx + 1, y - 1], [cx - 1, y + 4], [cx, y + 4], [cx + 1, y + 4]], line);
    return g;
  }
  // neutral: a calm closed mouth with a slight lift at the corners
  for (let i = -w + 1; i <= w - 1; i++) px(g, cx + i, y + 1, line);
  px(g, cx - w, y, line); px(g, cx + w, y, line);
  return g;
}

/** Blush pair under the eyes (happy and surprised get it stronger). */
export function blushX(g, xl, xr, y, expr, ch = 'P') {
  if (expr === 'worried') return g;
  const n = expr === 'happy' || expr === 'surprised' ? 3 : 2;
  for (let i = 0; i < n; i++) { px(g, xl + i, y, ch); px(g, xr - i, y, ch); }
  return g;
}

/** Small sweat bead for worried faces (W highlight over a light-blue drop G). */
export function sweatX(g, x, y, drop = 'G', hi = 'W') {
  pxs(g, [[x, y], [x - 1, y + 1], [x, y + 1], [x + 1, y + 1], [x - 1, y + 2], [x, y + 2], [x + 1, y + 2], [x, y + 3]], drop);
  px(g, x - 1, y + 1, hi);
  return g;
}

// js/art/chars/player.js  [ART-CHARS]
// The lease card on the 16x24 rig (GDD-00 §3): six species as head / ears /
// tail swaps, eight fur palettes per species, markings (mask, socks, stripe,
// freckles, blaze), three eye shapes, blush, and the outfit (lighthouse-stripe
// jumper; co-op apron during errands). Pure: rows + palettes only.
//
//   PLAYER_SPECIES                 ['water-vole', 'pine-marten', 'red-panda', 'opossum', 'ferret', 'mongoose']
//   SPECIES_INFO[id]               { name, head, tail }
//   FUR_PALETTES[id]               8 x { id, name, ...role letters }
//   MARKINGS, EYE_SHAPES, OUTFITS  option lists (lease card order)
//   DEFAULT_CARD                   { species: 'red-panda', fur: 0, markings: [], eyes: 'round', blush: false, outfit: 'jumper' }
//   normalizeCard(card)            fills defaults, drops unknown values
//   cardKey(card)                  stable string for caches
//   playerLook(card)               { key, body, palette } (memoized; body is a BODIES-shaped frameset)
//   markHead(head, card)           the head with markings / eyes / blush applied (exported for busts and tests)
import { HEADS, TORSOS, TAILS, buildMammal } from './mammals.js';
import './heads.js';
import './backs.js';
import { JUMPER, APRON, INK, PAPER, snapRod } from './palettes.js';
import { recolorHSL } from '../../core/pixelart.js';

export const PLAYER_SPECIES = Object.freeze(['water-vole', 'pine-marten', 'red-panda', 'opossum', 'ferret', 'mongoose']);
export const SPECIES_INFO = Object.freeze({
  'water-vole': { name: 'Water vole', head: 'vole', tail: 'vole' },
  'pine-marten': { name: 'Pine marten', head: 'marten', tail: 'marten' },
  'red-panda': { name: 'Red panda', head: 'redpanda', tail: 'redpanda' },
  opossum: { name: 'Opossum', head: 'opossum', tail: 'opossum' },
  ferret: { name: 'Ferret', head: 'ferret', tail: 'ferret' },
  mongoose: { name: 'Mongoose', head: 'mongoose', tail: 'mongoose' },
});
export const MARKINGS = Object.freeze(['mask', 'socks', 'stripe', 'freckles', 'blaze']);
export const EYE_SHAPES = Object.freeze(['round', 'sleepy', 'bright']);
export const OUTFITS = Object.freeze(['jumper', 'apron']);
export const DEFAULT_CARD = Object.freeze({ species: 'red-panda', fur: 0, markings: Object.freeze([]), eyes: 'round', blush: false, outfit: 'jumper' });

// ---------------------------------------------------------------------------
// Fur palettes: per species eight [name, fur F, pale M, dark S] triples; the
// light / shade / outline steps are hue-shifted from F (light warmer, shade
// redder, never toward purple) so every option stays a coherent ramp.
// ---------------------------------------------------------------------------
const FUR = {
  'red-panda': [
    ['Ember', '#c2502a', '#f6f1e3', '#4a2a22'], ['Russet', '#a8442a', '#efe4cc', '#3a201a'],
    ['Copper', '#c8662e', '#f4e6c8', '#5a3020'], ['Cinnamon', '#b0603a', '#f0dcc0', '#4a2c22'],
    ['Sunset', '#d4703a', '#fbe8cc', '#6a3420'], ['Chestnut', '#8e4a30', '#e8d8c0', '#3a2018'],
    ['Ash', '#8a7a72', '#efe8e0', '#3a3236'], ['Honey', '#c88a3e', '#f6ead0', '#5a3a22'],
  ],
  'pine-marten': [
    ['Pine', '#6a4228', '#e8c486', '#3a2418'], ['Walnut', '#5a3a26', '#e6cc96', '#2e1c14'],
    ['Amber', '#8a5a30', '#f0d08e', '#4a2e1a'], ['Umber', '#7a4b2e', '#e2be88', '#3e2616'],
    ['Sable', '#4a3226', '#dcc08e', '#261810'], ['Russet', '#8a4a2a', '#ecc890', '#43231a'],
    ['Dusk', '#5a4a42', '#e0d0b0', '#2e2622'], ['Golden', '#a8763e', '#f4dca0', '#5a3e22'],
  ],
  'water-vole': [
    ['Chestnut', '#a8683a', '#e3c08e', '#7a4630'], ['Hazel', '#9a7046', '#e4cca0', '#6a4a2e'],
    ['Peat', '#6e4e36', '#cdb08a', '#4a3222'], ['Bracken', '#b07a44', '#ecd0a0', '#7a5030'],
    ['Oat', '#b89a6e', '#f0e0c0', '#8a6e4a'], ['Soot', '#4a3e38', '#a8988a', '#2e2622'],
    ['Rust', '#a85a36', '#e8bc90', '#743a24'], ['Mouse', '#8a7e70', '#d8ccbc', '#5e5448'],
  ],
  opossum: [
    ['Silver', '#8e8e9c', '#f1eee6', '#3a3440'], ['Pewter', '#74748a', '#ece8e0', '#2e2a36'],
    ['Frost', '#b0b0bc', '#f4f1ea', '#4a4452'], ['Smoke', '#5e5a66', '#e6e2dc', '#26222c'],
    ['Dove', '#9e968e', '#f2ede4', '#403a38'], ['Slate', '#6a7484', '#e8ecef', '#2a3038'],
    ['Cream', '#c8bca8', '#f6f1e3', '#5a4e44'], ['Ink', '#4a4656', '#d8d4dc', '#1e1c26'],
  ],
  ferret: [
    ['Sable', '#6b4a32', '#eadcb8', '#3a2818'], ['Champagne', '#b89a78', '#f2e8d4', '#7a5e46'],
    ['Cinnamon', '#9a5e3a', '#f0dcc0', '#5a3422'], ['Dark sable', '#3e2e24', '#e6dcc8', '#1e1610'],
    ['Silver', '#8a8890', '#ece8e4', '#4a4650'], ['Chocolate', '#5a3a2c', '#e8d4bc', '#2e1e16'],
    ['Cream', '#e0d4b8', '#f6f1e3', '#b09a78'], ['Butterscotch', '#c08a4a', '#f4e4c4', '#7a522a'],
  ],
  mongoose: [
    ['Agouti', '#a89a6e', '#d9cfa8', '#5a4e34'], ['Dune', '#bca878', '#e6dab4', '#6e5e3e'],
    ['Brush', '#8e7e5a', '#c8bc98', '#4a4030'], ['Ruddy', '#a8724a', '#dcc0a0', '#5e3e2a'],
    ['Pepper', '#7a7466', '#c4beb0', '#3e3a32'], ['Banded', '#9a8a6a', '#d4c8a8', '#3a3226'],
    ['Saffron', '#c09a52', '#ecd8a8', '#6e5428'], ['Ash', '#8e8a80', '#d4d0c4', '#4a4640'],
  ],
};
const PINK = '#f2a7b5';
const FLOOR = '#1a1210'; // nothing in a fur ramp goes darker than this (never pure black)
const lum = (h) => { const n = parseInt(h.slice(1, 7), 16); return 0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
const CEIL = '#f6f1e3'; // ... and nothing lighter than cream (never pure white)
const sh = (hex, dH, dS, dL) => { const v = recolorHSL(hex, dH, dS, dL); return lum(v) < lum(FLOOR) ? FLOOR : lum(v) > lum(CEIL) ? CEIL : v; };
function furPalette(species, [name, F, M, S], i) {
  const p = {
    id: `${species}-${i}`, name,
    F, L: sh(F, 6, -0.02, 0.12), f: sh(F, -5, 0.02, -0.12), K: sh(S, -4, -0.05, -0.08),
    M, m: sh(M, -4, 0.04, -0.14), N: sh(S, 0, 0, -0.04), P: PINK,
    S, s: null,
    R: sh(S, 0, 0, 0.02), r: sh(F, -6, 0.04, -0.22),
    T: sh(F, 8, -0.12, 0.2), t: sh(F, 4, -0.08, 0.06),
  };
  // near-duplicate darks share the outline so a card stays inside the 18-colour cap
  p.N = species === 'opossum' ? p.N : p.K; p.s = p.K;
  if (species === 'red-panda') { p.T = sh(M, 6, 0.1, -0.12); p.t = p.m; } // tail rings shade with the muzzle shade
  if (species === 'opossum') { p.N = '#e3a0a8'; p.P = '#e3a0a8'; p.T = '#e3a0a8'; p.t = '#b57a84'; p.K = sh(S, 0, 0, -0.06); }
  if (species === 'pine-marten') { p.P = sh(S, 0, 0, 0.06); }
  return Object.freeze(p);
}
export const FUR_PALETTES = Object.freeze(Object.fromEntries(
  Object.entries(FUR).map(([sp, list]) => [sp, Object.freeze(list.map((e, i) => furPalette(sp, e, i)))]),
));

// ---------------------------------------------------------------------------
// Head overlays. Eyes are found by scanning for E / W, so every species head
// works without per-species tables.
// ---------------------------------------------------------------------------
const FURS = new Set(['F', 'f', 'L', 'M', 'm']);
const grid = (part) => part.map((r) => [...r]);
const out = (g) => g.map((r) => r.join(''));
function eyeBoxes(g) {
  const pts = [];
  g.forEach((r, y) => r.forEach((ch, x) => { if (ch === 'E' || ch === 'W') pts.push([x, y]); }));
  if (!pts.length) return null;
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const left = pts.filter((p) => p[0] < 6), right = pts.filter((p) => p[0] >= 6);
  const box = (ps) => (ps.length ? { x0: Math.min(...ps.map((p) => p[0])), x1: Math.max(...ps.map((p) => p[0])) } : null);
  return { y0, y1, l: box(left), r: box(right), pts };
}
const setIf = (g, x, y, ch, ok = FURS) => { if (g[y] && g[y][x] !== undefined && ok.has(g[y][x])) g[y][x] = ch; };
function rowSpan(g, y) { const r = g[y]; let a = -1, b = -1; r.forEach((ch, x) => { if (ch !== '.' && ch !== 'K') { if (a < 0) a = x; b = x; } }); return [a, b]; }

function applyEyes(g, shape, side) {
  const e = eyeBoxes(g); if (!e || shape === 'round') return;
  for (const [x, y] of e.pts) {
    if (shape === 'sleepy') {
      if (y === e.y0) g[y][x] = 'f';           // heavy lid over the top row
      else g[y][x] = 'E';
    } else if (shape === 'bright') {
      if (y === e.y1) { const box = side === 'down' ? (x < 6 ? e.l : e.r) : e.l; if (box && x === box.x1) g[y][x] = 'W'; }
    }
  }
}
function applyMask(g, side) {
  const e = eyeBoxes(g); if (!e) return;
  for (let y = e.y0; y <= e.y1; y++) {
    const [a, b] = rowSpan(g, y);
    const xe = side === 'down' ? b : Math.min(b, (e.l ? e.l.x1 : a) + 2);
    for (let x = a; x <= xe; x++) setIf(g, x, y, 'R');
  }
}
function applyBlaze(g, side, noseRow) {
  if (side === 'down') {
    for (let y = 2; y < noseRow; y++) for (const x of [5, 6]) if (g[y][x] !== 'E' && g[y][x] !== 'W') setIf(g, x, y, 'M', new Set(['F', 'f', 'L', 'R', 'm']));
  } else {
    for (let y = 3; y < noseRow; y++) { const [a] = rowSpan(g, y); setIf(g, a, y, 'M', new Set(['F', 'f', 'L', 'R', 'm'])); }
  }
}
function applyStripe(g, side) {
  if (side === 'up') { for (let y = 2; y < g.length - 1; y++) for (const x of [5, 6]) setIf(g, x, y, 'R', new Set(['F', 'f', 'L'])); return; }
  if (side === 'down') { for (let y = 2; y <= 4; y++) for (const x of [5, 6]) setIf(g, x, y, 'R', new Set(['F', 'f', 'L'])); return; }
  for (let x = 4; x <= 9; x++) { for (let y = 0; y < g.length; y++) { if (g[y][x] !== '.' && g[y][x] !== 'K') { setIf(g, x, y, 'R', new Set(['F', 'f', 'L'])); break; } } }
}
function applyFreckles(g, side) {
  const e = eyeBoxes(g); if (!e) return;
  const y = e.y1 + 1, ok = new Set(['F', 'f', 'L', 'M', 'm']);
  if (side === 'down') {
    if (e.l) { setIf(g, e.l.x0 - 1, y, 'R', ok); setIf(g, e.l.x0, y + 1, 'R', ok); }
    if (e.r) { setIf(g, e.r.x1 + 1, y, 'R', ok); setIf(g, e.r.x1, y + 1, 'R', ok); }
  } else if (e.l) { setIf(g, e.l.x1 + 2, y, 'R', ok); setIf(g, e.l.x1 + 1, y + 1, 'R', ok); setIf(g, e.l.x1 + 3, y + 1, 'R', ok); }
}
function applyBlush(g, side) {
  const e = eyeBoxes(g); if (!e) return;
  const y = e.y1 + 1, ok = new Set(['F', 'f', 'L', 'M', 'm', 'R']);
  if (side === 'down') { if (e.l) setIf(g, e.l.x0 - 1, y, 'P', ok); if (e.r) setIf(g, e.r.x1 + 1, y, 'P', ok); }
  else if (e.l) setIf(g, e.l.x1 + 2, y, 'P', ok);
}
function noseRowOf(g) { for (let y = 0; y < g.length; y++) if (g[y].includes('N')) return y; return g.length - 2; }

/** Apply the card's markings, eye shape and blush to a {down, left, up} head. */
export function markHead(head, card) {
  const c = normalizeCard(card);
  const m = new Set(c.markings);
  const side = (part, s) => {
    const g = grid(part);
    if (s !== 'up') {
      if (m.has('mask')) applyMask(g, s);
      if (m.has('blaze')) applyBlaze(g, s, noseRowOf(g));
      if (m.has('freckles')) applyFreckles(g, s);
      if (c.blush) applyBlush(g, s);
      applyEyes(g, c.eyes, s);
    }
    if (m.has('stripe')) applyStripe(g, s);
    return out(g);
  };
  return { down: side(head.down, 'down'), left: side(head.left, 'left'), up: side(head.up, 'up') };
}

/** Fill defaults; unknown species / options fall back so a bad save never breaks drawing. */
export function normalizeCard(card) {
  const c = card || {};
  const species = PLAYER_SPECIES.includes(c.species) ? c.species : DEFAULT_CARD.species;
  const fur = Number.isInteger(c.fur) && c.fur >= 0 && c.fur < 8 ? c.fur : 0;
  const markings = Array.isArray(c.markings) ? MARKINGS.filter((k) => c.markings.includes(k)) : [];
  const eyes = EYE_SHAPES.includes(c.eyes) ? c.eyes : 'round';
  const outfit = OUTFITS.includes(c.outfit) ? c.outfit : 'jumper';
  return { species, fur, markings, eyes, blush: !!c.blush, outfit };
}
export function cardKey(card) {
  const c = normalizeCard(card);
  return [c.species, c.fur, c.markings.join('+') || '-', c.eyes, c.blush ? 'b' : '-', c.outfit].join('|');
}

const looks = new Map();
/** Body frameset + palette for a lease card (memoized by cardKey). */
export function playerLook(card) {
  const key = cardKey(card);
  let look = looks.get(key);
  if (look) return look;
  const c = normalizeCard(card);
  const info = SPECIES_INFO[c.species];
  const head = markHead(HEADS[info.head], c);
  const body = buildMammal({ head, torso: c.outfit === 'apron' ? TORSOS.apron : TORSOS.jumper, tail: TAILS[info.tail] });
  const fur = FUR_PALETTES[c.species][c.fur];
  let palette = { ...(c.outfit === 'apron' ? APRON : JUMPER), E: INK, W: PAPER, ...fur, b: fur.K };
  delete palette.id; delete palette.name;
  if (c.markings.includes('socks')) { palette.S = fur.M; palette.s = fur.m; }
  palette = snapRod(palette);
  look = Object.freeze({ key, body, palette: Object.freeze(palette) });
  looks.set(key, look);
  return look;
}

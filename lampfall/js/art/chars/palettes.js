// js/art/chars/palettes.js  [ART-CHARS] (from proto/chars/palettes.js)
// Per-character palettes for the role letters used by the rigs (see the
// mammals.js header for the letter roles). Porchlight townsfolk use the cast
// hex tokens; Spire and Summit people use the 21-key sprite set (SW) plus the
// brown ramp below. No pure black (darkest #141B33 / k #1a1c2c) and no pure
// white (#F6F1E3 / w #f4f4f4).
//
// LUT: the letter X is a real flame / lamp glass on every character palette
// (Hesper's eyestalk lantern, Ludo's lantern, Seraphine's headlamp, Isolde's
// storm lantern) and is always porchlight amber #F9C46B, which
// art/palette.isLutExempt already exempts, so art/atlas never grades it.
// CHAR_GLOW_KEYS names the letter for renderers that recolour by key.
//
// Changes on adoption: species fixes per GDD-00 §10 (Corin tawny owl, Idris
// great northern diver, Agathe cormorant, Teo raccoon; the otter palette is
// gone with the otter); Linnet's shadow fur no longer falls to purple (`p`);
// it uses the brown ramp in CHAR_RAMPS; every missing resident is added.

import { MASTER, CHAR_RAMPS as SHARED_RAMPS } from '../palette.js';

export const INK = '#141b33', PAPER = '#f6f1e3', BRASS = '#d9a441', BRASS_S = '#8a6a1e';

/** Letters that are real light on character palettes; art/atlas must not grade them. */
export const CHAR_GLOW_KEYS = Object.freeze(['X']);

/**
 * The 21-key sprite letter set by letter, lower-case hex, straight from
 * art/palette.MASTER (creatures and characters share one set).
 */
export const SW = Object.freeze(Object.fromEntries(Object.entries(MASTER).map(([k, v]) => [k, v.toLowerCase()])));

/**
 * The ART-CHARS brown ramp (owned by the ART-CHARS block of art/palette.js):
 * dark fur shades stay brown instead of dropping to p (purple) or d (slate).
 */
export const CHAR_RAMPS = Object.freeze(Object.fromEntries(Object.entries(SHARED_RAMPS).map(([k, v]) => [k, v.toLowerCase()])));
const CR = CHAR_RAMPS;

// Shared outfit tokens
export const JUMPER = { O: '#c9a16b', k: INK, C: '#f4e8c1', c: '#d8c79b', D: '#3b4a6b', d: '#2b3a67', Y: BRASS, A: BRASS, a: '#7a5a36', G: '#cfe7f2', B: '#5c4028', b: '#3e2618' };
export const APRON = { O: '#c9a16b', k: INK, C: '#e8dcc0', c: '#bfb090', D: '#8a5a3b', d: '#6a4330', Y: '#f2c14e', A: BRASS, a: '#7a5a36', G: '#cfe7f2', B: '#5c4028', b: '#3e2618' };
const EYES = { E: INK, W: PAPER };

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/**
 * The fishing rod's cane (O) and cork (a) snap to the nearest colour the
 * character already wears, so the 24-wide fish frames add no new keys (the
 * art linter caps people at 18 colours).
 */
export function snapRod(pal) {
  // candidates: letters every body actually draws (fur, limbs, boots, cloth), never optional marks
  const DRAWN = 'FfLMmKSsBbCcDdk';
  const vals = Object.entries(pal).filter(([k, v]) => DRAWN.includes(k) && typeof v === 'string' && v.length === 7).map(([, v]) => v);
  const near = (target) => {
    const t = rgbOf(target);
    let best = target, bd = Infinity;
    for (const v of vals) { const c = rgbOf(v); const d = (c[0] - t[0]) ** 2 + (c[1] - t[1]) ** 2 + (c[2] - t[2]) ** 2; if (d < bd) { bd = d; best = v; } }
    return best;
  };
  return { ...pal, O: near('#c9a16b'), a: near('#7a5a36') };
}
const ROD = { O: '#c9a16b', a: '#7a5a36' };

export const PALETTES = {
  // --- Porchlight townsfolk ----------------------------------------------------
  wren: {
    ...ROD,
    K: '#2e1c12', k: '#26363f', F: '#8a5a3b', f: '#6a4330', L: '#b07a52', M: '#e9d3b0', m: '#c9b48a',
    E: '#2e1c12', W: '#cfe7f2', N: '#2e1c12', Y: '#f2a541', A: BRASS, a: '#7a5a36', G: '#cfe7f2',
    C: '#4f6d7a', c: '#34505c', D: '#4f6d7a', d: '#34505c', T: '#5a3a2a', t: '#3e2618',
    S: '#6a4330', s: '#4a2a22', B: '#5c4028', b: '#3e2618',
  },
  ambrose: {
    ...ROD,
    K: '#2e1c12', k: '#26363f', F: '#7a6a5a', f: '#5a4a3e', L: '#a8927c', M: '#d9cbb0', m: '#b8a888',
    E: '#2e1c12', W: '#cfe7f2', N: '#2e1c12', Y: '#e0c77a', A: BRASS, a: '#7a5a36', G: '#b8cfe0',
    C: '#5f7a85', c: '#3e5660', D: '#5f7a85', d: '#3e5660', T: '#5a3a2a', t: '#3e2618',
    S: '#5a4a3e', s: '#3e2618', B: '#5c4028', b: '#3e2618',
  },
  tamsin: {
    ...ROD,
    K: '#1e1e28', k: '#2a3a33', F: '#8a8a96', f: '#5f5f70', L: '#a8a8b4', M: '#f1eee6', m: '#c8c4cc',
    E: INK, W: PAPER, N: '#1e1e28', R: '#2a2433', r: '#1e1e28',
    C: '#4e6e5d', c: '#3a5246', D: '#c9b48a', d: '#a8927c', Y: BRASS, a: '#7a5a36',
    S: '#3a3440', s: '#2a2433', B: '#5c4028', b: '#3e2618',
  },
  juniper: {
    ...ROD,
    K: INK, F: '#1f1d2a', f: '#141b33', L: '#3a3848', M: '#f1eee6', m: '#b9b4c4', E: INK, W: '#f1eee6',
    I: '#2a6f8f', i: '#3fae8c', C: '#c97b2c', c: '#8a4f1a', A: BRASS, S: '#3a3848', B: '#3a3848', N: '#3a3848', Y: BRASS, a: '#7a5a36', k: INK,
  },
  barnaby: {
    ...ROD,
    K: '#3a2410', A: '#b8862f', L: '#e3b867', a: '#7a5a1e', W: PAPER, G: '#9fd3c0', g: '#7ab8a4', E: INK,
    R: '#e06a4f', r: '#a8402e', S: '#a8402e', s: '#7a2e20', B: '#e06a4f', k: '#3a2410', Y: BRASS,
  },
  hesper: {
    ...ROD,
    K: '#2e3a2c', F: '#a9b8a0', f: '#7a8c74', L: '#c3d0ba', E: '#2e3a2c', W: '#e9f7f2',
    C: '#c9b48a', c: '#8c7a5a', M: '#f4f1e6', A: BRASS, a: '#7a5a36', k: '#2e3a2c', X: '#f9c46b', x: '#e8d3a0', Y: '#a8323a',
  },
  ansel: {
    ...ROD,
    K: '#2a3340', F: '#8ea0b0', f: '#607486', L: '#b8c8d4', M: '#e8edf0', m: '#c8d2da', E: '#141b33', W: PAPER,
    N: '#d9a441', n: '#b07a2a', S: '#8a7a5a', s: '#5a4e3a', B: '#d9a441', R: '#3b4a6b', k: '#1e2433', C: '#2b3a67', c: '#1e2a4a', Y: '#f2c14e', a: '#7a5a36',
  },
  wick: {
    ...ROD,
    K: '#1e1e28', F: '#2a2433', f: '#1e1e28', L: '#3a3848', M: '#f1eee6', m: '#c8c4cc', E: INK, W: PAPER,
    N: '#f28c28', n: '#c96a1a', B: '#f28c28', b: '#c96a1a', C: '#a3283a', c: '#7a1e2c', D: '#f4e8c1', Y: '#f4e8c1', k: '#1e1e28', a: '#7a5a36',
  },
  ludo: {
    ...ROD,
    K: '#2a1c22', F: '#5a3a44', f: '#3e2830', L: '#8a6a72', M: '#e0b8a0', m: '#b08878', E: INK, W: PAPER,
    N: '#3a1f1c', P: '#e3a0a8', S: '#3a2830', k: '#2a1c22', V: '#c49a94', v: '#946a70', z: '#141b3366', X: '#f9c46b', C: '#3b4a6b', c: '#2b3a67', Y: '#a8323a',
  },
  dimity: {
    ...ROD,
    z: '#141b3366', K: '#7a3b4e', k: '#7a3b4e', F: '#f2a7b5', f: '#d98a9c', L: '#f9d1d9', Y: '#ffe29a', y: '#f3c178', E: '#141b33', W: PAPER, M: '#fff3d6', m: '#f3c178', P: '#e07a9a',
  },
  // Augusta Skerry, grey seal, Harbor Warden: navy coat, brass badge, flipper hands.
  augusta: {
    ...ROD, ...EYES,
    K: '#262a33', k: INK, F: '#8a929c', f: '#646c78', L: '#b0b8c0', R: '#5a606c', M: '#c8ccd0', m: '#9aa0a8', N: '#2a2a33',
    C: '#2b3a67', c: '#1e2a4a', D: '#3b4a6b', d: '#2b3a67', Y: BRASS, A: BRASS, a: BRASS_S,
    S: '#4a505c', s: '#363a44', B: '#4a505c', b: '#363a44',
  },
  // Tully, wombat: red sweatband and matching running jersey.
  tully: {
    ...ROD, ...EYES,
    K: '#2a2018', k: INK, F: '#8a7560', f: '#6a5644', L: '#a8927a', M: '#b8a48c', m: '#8e7a64', N: '#2e2620',
    C: '#c0453a', c: '#8e2f2a', D: '#f4e8c1', d: '#d8c79b', Y: '#f4e8c1',
    S: '#6a5644', s: '#4e3e30', B: '#3b4a6b', b: '#2b3a67',
  },
  // Odile, roseate spoonbill: teal beret, paint-flecked smock.
  odile: {
    ...ROD, E: '#7a1e2c', W: PAPER,
    K: '#5a2a3a', k: '#1e3a40', F: '#e98aa6', f: '#c0607e', L: '#f6b8c8', M: '#e6e2c4', m: '#c2c09a', N: '#8a9a86', n: '#5e6e5c',
    D: '#2f7c86', d: '#1f5a62', C: '#f4ecd6', c: '#cfc3a4', Y: '#f2c14e', o: '#4f8fd9', S: '#d9607e', s: '#a8445e',
  },
  // Bryony, rock hyrax: garden apron, straw hat with a red ribbon, wellies.
  bryony: {
    ...ROD, ...EYES,
    K: '#2e241c', k: INK, F: '#8c7a64', f: '#6a5a48', L: '#ab9a82', M: '#d4c3a3', m: '#a8977c', N: '#2e241c', P: '#d9907a',
    C: '#e8dcc0', c: '#bfb090', D: '#5e7d4a', d: '#435c34', Y: '#e6c46e', y: '#b8963e', R: '#c0453a', A: BRASS, a: '#7a5a36',
    S: '#6a5a48', s: '#4e4234', B: '#3e5a3a', b: '#2c4228',
  },
  // Thessaly, bilby: mustard cardigan over a cream blouse.
  thessaly: {
    ...ROD, ...EYES,
    K: '#2e3242', k: INK, F: '#8a94a8', f: '#646e84', L: '#aeb6c6', M: '#e6e0d4', m: '#bcb6aa', N: '#e89aa8', P: '#e89aa8',
    C: '#c98a3a', c: '#9a6a2a', D: '#f4e8c1', d: '#d6c8a0', Y: BRASS,
    S: '#262a33', s: '#1e2230', B: '#6a4a3a', b: '#4e3428',
  },
  // Pip, water rat: navy dock jersey, brown flat cap, white tail tip.
  pip: {
    ...ROD, ...EYES,
    K: '#1e1410', k: INK, F: '#74503a', f: '#523828', L: '#9a7252', M: '#d9a85a', m: '#b08040', N: '#1e1410', P: '#c88a7a',
    C: '#3b4a6b', c: '#2b3a67', D: '#8a6a46', d: '#6a4e30', Y: BRASS,
    S: '#3e2a1e', s: '#2a1c14', B: '#2a2433', b: '#1e1a24',
  },
  // Osric Penhallow, tortoise stonecutter: leather apron, amber shell.
  osric: {
    ...ROD, ...EYES,
    K: '#2a2a18', k: INK, F: '#8a8a5a', f: '#666a40', L: '#aaa874', M: '#c9b48a', m: '#9e8a64', N: '#2a2a18',
    T: '#8a6a3a', t: '#5e4626', r: '#3a2a16', H: '#b08a4e',
    C: '#c9c2b0', c: '#9e9684', D: '#6a4a30', d: '#4e3420', Y: BRASS,
    S: '#666a40', s: '#4a4e2e', B: '#5a5a60', b: '#3e3e46',
  },
  // Ines Calloway, crested newt, spa keeper: towel turban and robe.
  ines: {
    ...ROD, E: INK, W: '#e8c060',
    K: '#1e1e12', k: '#3a4a48', F: '#5e5a3e', f: '#403e28', L: '#7e7a56', R: '#2a2814', M: '#e8a030', m: '#b87820', N: '#1e1e12',
    C: '#f4ecd6', c: '#cfc3a4', D: '#8fc7c0', d: '#5f9a94', Y: '#8fc7c0',
    S: '#33331f', s: '#22200f', B: '#8fc7c0', b: '#5f9a94',
  },
  // Wendel Teague, great crested grebe, boatwright: tan work overalls.
  wendel: {
    ...ROD, E: INK, W: PAPER,
    K: '#1e1a18', k: INK, F: '#3a3430', f: '#262220', L: '#5a524a', M: '#f1eee6', m: '#c8c4bc', R: '#a8502a', r: '#7a3a1e', S: '#1e1a18', N: '#d98a8a',
    C: '#a8885a', c: '#7e6440', D: '#a8885a', d: '#7e6440', Y: BRASS, A: BRASS, a: '#7a5a36', T: '#3a3430', t: '#262220',
    B: '#6a7a5a', b: '#4a5a3e',
  },
  // Ada Halloran, jackdaw: red scarf knotted left.
  ada: {
    ...ROD, E: INK, W: '#dce4ec',
    K: '#141b33', k: INK, F: '#2a2a36', f: '#1e1e28', L: '#4a4a5a', R: '#8a90a0', r: '#646a7a', N: '#1e1e28', P: '#c0453a',
    C: '#e8e0d0', c: '#bdb4a2', D: '#6a5a46', d: '#4e4232', Y: BRASS, T: '#2a2a36', t: '#1e1e28',
    S: '#1e1e28', s: '#141b33', B: '#1e1e28', b: '#141b33',
  },
  // Isolde Petrel, storm petrel: sea-grey shawl, navy dress, her storm lantern.
  isolde: {
    ...ROD, ...EYES,
    K: '#1e1a20', k: INK, F: '#4e4650', f: '#332d36', L: '#6e6670', M: '#ece6da', N: '#1e1a20', T: '#3a3438', t: '#26222a',
    C: '#2b3a67', c: '#1e2a4a', D: '#5e7d8a', d: '#43606c', A: BRASS, a: BRASS_S, X: '#f9c46b', Y: BRASS,
    S: '#26222a', s: '#1e1a20', B: '#26222a', b: '#1e1a20',
  },
  // The Thatch: goldfinches.
  thatch: {
    K: '#2a1c18', z: '#141b3355', R: '#c0453a', F: '#d9b88a', S: '#262433', Y: '#f2c14e', y: '#b8963e', W: PAPER, E: INK, N: '#e6d0b0', T: '#262433', M: '#f1eee6',
  },

  // --- Spire, Summit and isle folk (21-key set + ramps) --------------------------
  linnet: {
    ...ROD,
    K: SW.k, k: SW.k, F: SW.u, f: CR.brownDeep, L: SW.h, M: SW.w, m: SW.c, E: SW.k, W: SW.w, N: SW.k, P: SW.o,
    H: SW.h, Y: SW.y, C: SW.o, c: SW.r, D: SW.v, d: SW.e, S: SW.k, s: CR.brownDark, B: SW.d, b: SW.k, A: SW.y, a: SW.u, G: SW.i,
  },
  'linnet-ermine': {
    ...ROD,
    K: '#3e4258', k: SW.k, F: '#ece6da', f: '#b8bcc8', L: PAPER, M: PAPER, m: '#d6d2ca', E: SW.k, W: SW.w, N: SW.k, P: SW.o,
    H: '#ece6da', Y: SW.y, C: SW.o, c: SW.r, D: SW.v, d: SW.e, S: SW.k, s: SW.d, B: SW.d, b: SW.k, A: SW.y, a: SW.u, G: SW.i,
  },
  corin: {
    ...ROD, E: INK, W: PAPER,
    K: '#2e1c12', k: SW.k, F: '#8a5030', f: '#663a24', L: '#c08050', M: '#e0c090', m: '#b08a5a', N: '#e8d8a0',
    C: SW.n, c: SW.d, D: SW.v, d: SW.e, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, T: '#8a5030', t: '#663a24',
    S: '#c8b080', s: '#a08a5e', B: '#3a3438', b: '#26222a',
  },
  idris: {
    ...ROD, E: INK, W: PAPER,
    K: '#0f1a1c', k: SW.k, F: '#24302e', f: '#161e20', L: '#3e5250', R: '#c03030', M: '#e8e8e0', N: '#2a2e36',
    C: SW.n, c: SW.d, D: SW.w, d: SW.v, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, T: '#24302e', t: '#161e20',
    S: '#2a2e36', s: '#1a1e26', B: '#2a2e36', b: '#1a1e26',
  },
  agathe: {
    ...ROD, E: INK, W: PAPER,
    K: '#0f1014', k: SW.k, F: '#2a2a30', f: '#1a1a20', L: '#5a5040', G: SW.g, Y: SW.y, M: SW.w, m: SW.v, N: SW.v, n: SW.e,
    C: SW.d, c: SW.k, D: SW.v, d: SW.e, A: SW.i, a: SW.u, T: '#2a2a30', t: '#1a1a20',
    S: SW.k, s: SW.k, B: SW.k, b: SW.k,
  },
  teo: {
    ...ROD, ...EYES,
    K: SW.k, k: SW.k, F: '#8e8e96', f: '#62626e', L: '#b0b0b8', M: '#ece6dc', m: '#bdb8b0', R: '#262433', r: '#1a1c2c', N: SW.k,
    C: SW.y, c: SW.a, D: SW.t, d: SW.n, Y: SW.y, A: SW.y, a: SW.u, G: SW.i,
    S: '#262433', s: SW.k, B: SW.d, b: SW.k,
  },
  maud: {
    ...ROD, ...EYES,
    K: '#2a241e', k: INK, F: '#8a8070', f: '#625a4e', L: '#b0a898', N: '#e88a3a', n: '#b8602a', W: '#f4ecd6',
    C: '#e6b43a', c: '#b8862a', D: '#3b4a6b', d: '#2b3a67', Y: '#e6b43a', y: '#b8862a', A: BRASS, T: '#625a4e', t: '#4a443a', M: '#f1eee6',
    S: '#e8a08a', s: '#c07a66', B: '#e8a08a', b: '#c07a66',
  },
  seraphine: {
    ...ROD, E: INK, W: PAPER,
    K: '#4a5068', k: INK, F: '#ece6da', f: '#b8bcc8', L: PAPER, M: '#ece6da', N: '#2a2a33',
    C: '#c0603a', c: '#8e4428', D: '#3b4a6b', d: '#2b3a67', Y: BRASS, A: BRASS, a: BRASS_S, X: '#f9c46b',
    S: '#b8bcc8', s: '#8e94a4', B: '#5a4a3a', b: '#3e3228',
  },
  hollis: {
    ...ROD, ...EYES,
    K: '#5a5448', k: INK, F: '#e6e0d2', f: '#b4ae9e', L: '#f4efe2', M: '#d4ccb8', m: '#aaa290', R: '#2a2830', N: '#3a3438',
    S: '#b4ae9e', s: '#8e8878',
    C: '#6a5a46', c: '#4e4232', D: '#a8323a', d: '#7a2430', Y: '#c9a77c',
    B: '#3a3438', b: '#26222a',
  },
  dov: {
    ...ROD, ...EYES,
    K: '#3a2214', k: INK, F: '#b8843e', f: '#8e5e2a', L: '#d8a65a', M: '#e8c88a', m: '#c09a5e', P: '#d98a7a', N: '#3a2214',
    C: '#f4ecd6', c: '#cfc3a4', D: '#7a2e3a', d: '#5a1e2a', Y: BRASS,
    S: '#8e5e2a', s: '#6a4420', B: '#3a2214', b: '#26160c',
  },
  bastien: {
    ...ROD, ...EYES,
    K: '#1a1210', k: SW.k, F: '#4a3024', f: '#2e1e16', L: '#6a4634', M: '#e8e0d0', N: '#1a1210',
    C: '#3a3f4f', c: '#2a2e3a', D: SW.v, d: SW.e, Y: SW.y, A: SW.y,
    S: '#2e1e16', s: '#1a1210', B: SW.d, b: SW.k,
  },
  cass: {
    ...ROD, ...EYES,
    K: '#3a2c20', k: SW.k, F: '#b89a72', f: '#8e7454', L: '#d8c09a', M: '#ece4d4', m: '#c4b8a4', R: '#3a2c24', P: '#d98a8a', N: '#4a3030',
    S: '#8e7454', s: '#6a5640',
    C: '#2f5a4a', c: '#1f4034', D: '#d9c08a', d: '#b09a64', Y: SW.y,
    B: SW.d, b: SW.k,
  },
  routeTrainer: {
    ...ROD,
    K: SW.k, k: SW.k, F: SW.a, f: SW.u, L: SW.c, M: SW.w, m: SW.v, E: SW.k, W: SW.w, N: SW.k, P: SW.o,
    C: SW.w, c: SW.v, D: SW.g, d: SW.t, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, S: SW.u, s: SW.d, B: SW.d, b: SW.k,
  },
};
// Ivo shares Ada's palette with a blue scarf.
PALETTES.ivo = { ...PALETTES.ada, P: '#3b6dc9' };
// Osric: shell seams and limb shade share the outline (key cap)
PALETTES.osric = { ...PALETTES.osric, r: PALETTES.osric.K, s: PALETTES.osric.K };
for (const k of Object.keys(PALETTES)) PALETTES[k] = Object.freeze(snapRod(PALETTES[k]));

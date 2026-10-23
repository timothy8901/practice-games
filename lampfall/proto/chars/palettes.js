// proto/chars/palettes.js
// Per-character palettes for the role letters used by the rigs (see mammals.js
// header for the letter roles). Townsfolk use the Porchlight cast hex tokens;
// Wildshift trainers use the Sweetie-16 master keys (+ the five extras).
// No pure black (darkest #141B33 / k #1a1c2c) and no pure white (#F6F1E3 / w #f4f4f4).

export const INK = '#141b33', PAPER = '#f6f1e3', BRASS = '#d9a441', BRASS_S = '#8a6a1e';

/** Sweetie-16 master keys + extras (Wildshift bible 3.3; extras defined here). */
export const SW = {
  k: '#1a1c2c', p: '#5d275d', r: '#b13e53', o: '#ef7d57', y: '#ffcd75', l: '#a7f070', g: '#38b764', t: '#257179',
  n: '#29366f', b: '#3b5dc9', s: '#41a6f6', i: '#73eff7', w: '#f4f4f4', v: '#94b0c2', e: '#566c86', d: '#333c57',
  m: '#ff5bd6', c: '#f6d8ae', h: '#d9a066', u: '#8a5a3b', a: '#c9a16b',
};

// Shared outfit tokens
const JUMPER = { O: '#c9a16b', k: INK, C: '#f4e8c1', c: '#d8c79b', D: '#3b4a6b', d: '#2b3a67', Y: BRASS, A: BRASS, a: '#7a5a36', G: '#cfe7f2' };
const EYES = { E: INK, W: PAPER };

export const PALETTES = {
  // --- player species (6), shared rig + lighthouse-stripe jumper -------------
  redpanda: {
    ...JUMPER, ...EYES,
    K: '#3a1f1c', F: '#c2502a', f: '#8b3620', L: '#e07a3f', M: PAPER, m: '#e9c08a', N: '#3a1f1c', P: '#f2a7b5',
    S: '#4a2a22', s: '#3a1f1c', B: '#7a5a36', b: '#5c4028', T: '#e9c08a', t: '#c9a070',
  },
  otter: {
    ...JUMPER, ...EYES,
    K: '#241a1c', F: '#5a4030', f: '#3e2c2c', L: '#7a5c44', M: '#e6dcc4', m: '#b8aa94', N: '#241a1c', P: '#f2a7b5',
    S: '#3e2c2c', s: '#241a1c', B: '#7a5a36', b: '#5c4028', T: '#5a4030', t: '#3e2c2c',
  },
  vole: {
    ...JUMPER, ...EYES,
    K: '#3a2018', F: '#a8683a', f: '#7a4630', L: '#cc8e54', M: '#e3c08e', m: '#b8906c', N: '#3a2018', P: '#f2a7b5',
    S: '#7a4630', s: '#3a2018', B: '#5c4028', b: '#3e2618', T: '#a8683a', t: '#7a4630',
  },
  opossum: {
    ...JUMPER, ...EYES,
    K: '#2a2433', F: '#8e8e9c', f: '#5f5f70', L: '#b4b4c0', M: '#f1eee6', m: '#c8c4cc', N: '#e3a0a8', P: '#e3a0a8', R: '#3a3440',
    S: '#3a3440', s: '#2a2433', B: '#4a3a44', b: '#2a2433', T: '#e3a0a8', t: '#b57a84',
  },
  ferret: {
    ...JUMPER, ...EYES,
    K: '#2a1c12', F: '#6b4a32', f: '#4a3222', L: '#8a6646', M: '#eadcb8', m: '#c9b48a', N: '#2a1c12', P: '#f2a7b5',
    R: '#3a2818', r: '#2a1c12', S: '#3a2818', s: '#2a1c12', B: '#5c4028', b: '#3e2618', T: '#6b4a32', t: '#4a3222',
  },
  mongoose: {
    ...JUMPER, ...EYES,
    K: '#33301f', F: '#a89a6e', f: '#7a6e4a', L: '#c9bd8c', M: '#d9cfa8', m: '#b4a880', N: '#33301f', P: '#f2a7b5',
    R: '#6a5a3a', S: '#5a4e34', s: '#33301f', B: '#7a5a36', b: '#5c4028', T: '#a89a6e', t: '#7a6e4a',
  },

  // --- townsfolk ------------------------------------------------------------------
  wren: {
    O: '#c9a16b',
    K: '#2e1c12', k: '#26363f', F: '#8a5a3b', f: '#6a4330', L: '#b07a52', M: '#e9d3b0', m: '#c9b48a',
    E: '#2e1c12', W: '#cfe7f2', N: '#2e1c12', Y: '#f2a541', A: BRASS, a: '#7a5a36', G: '#cfe7f2',
    C: '#4f6d7a', c: '#34505c', D: '#4f6d7a', d: '#34505c', T: '#5a3a2a', t: '#3e2618',
    S: '#6a4330', s: '#4a2a22', B: '#5c4028', b: '#3e2618',
  },
  ambrose: {
    O: '#c9a16b',
    K: '#2e1c12', k: '#26363f', F: '#7a6a5a', f: '#5a4a3e', L: '#a8927c', M: '#d9cbb0', m: '#b8a888',
    E: '#2e1c12', W: '#cfe7f2', N: '#2e1c12', Y: '#e0c77a', A: BRASS, a: '#7a5a36', G: '#b8cfe0',
    C: '#5f7a85', c: '#3e5660', D: '#5f7a85', d: '#3e5660', T: '#5a3a2a', t: '#3e2618',
    S: '#5a4a3e', s: '#3e2618', B: '#5c4028', b: '#3e2618',
  },
  tamsin: {
    O: '#c9a16b',
    K: '#1e1e28', k: '#2a3a33', F: '#8a8a96', f: '#5f5f70', L: '#a8a8b4', M: '#f1eee6', m: '#c8c4cc',
    E: INK, W: PAPER, N: '#1e1e28', R: '#2a2433', r: '#1e1e28',
    C: '#4e6e5d', c: '#3a5246', D: '#c9b48a', d: '#a8927c', Y: BRASS, a: '#7a5a36',
    S: '#3a3440', s: '#2a2433', B: '#5c4028', b: '#3e2618',
  },

  // --- Wildshift cast (master keys) ----------------------------------------------
  linnet: {
    O: '#c9a16b',
    K: SW.k, k: SW.k, F: SW.u, f: SW.d, L: SW.h, M: SW.w, m: SW.c, E: SW.k, W: SW.w, N: SW.k, P: SW.o,
    H: SW.h, Y: SW.y, C: SW.o, c: SW.r, D: SW.v, d: SW.e, S: SW.u, s: SW.d, B: SW.d, b: SW.k, A: SW.y, a: SW.u, G: SW.i,
  },
  corin: {
    O: '#c9a16b',
    K: SW.k, k: SW.k, F: SW.a, f: SW.u, L: SW.y, M: SW.w, m: SW.v, E: SW.k, W: SW.w, N: SW.y, P: SW.o,
    C: SW.n, c: SW.d, D: SW.v, d: SW.e, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, S: SW.e, s: SW.d, B: SW.a, b: SW.u,
  },
  idris: {
    O: '#c9a16b',
    K: SW.k, k: SW.k, F: SW.e, f: SW.d, L: SW.v, M: SW.w, m: SW.v, E: SW.k, W: SW.w, N: SW.k, P: SW.d,
    C: SW.n, c: SW.d, D: SW.w, d: SW.v, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, S: SW.d, s: SW.k, B: SW.d, b: SW.k,
  },
  agathe: {
    O: '#c9a16b',
    K: SW.k, k: SW.k, F: SW.v, f: SW.e, L: SW.w, M: SW.w, m: SW.v, E: SW.k, W: SW.w, N: SW.k, P: SW.e,
    C: SW.d, c: SW.k, D: SW.v, d: SW.e, Y: SW.i, A: SW.i, a: SW.u, G: SW.i, S: SW.e, s: SW.d, B: SW.k, b: SW.k,
  },
  teo: {
    O: '#c9a16b',
    K: SW.k, k: SW.k, F: SW.o, f: SW.r, L: SW.y, M: SW.w, m: SW.v, E: SW.k, W: SW.w, N: SW.k, P: SW.o,
    C: SW.y, c: SW.a, D: SW.t, d: SW.n, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, S: SW.r, s: SW.p, B: SW.d, b: SW.k,
  },
  routeTrainer: {
    O: '#c9a16b',
    K: SW.k, k: SW.k, F: SW.a, f: SW.u, L: SW.c, M: SW.w, m: SW.v, E: SW.k, W: SW.w, N: SW.k, P: SW.o,
    C: SW.w, c: SW.v, D: SW.g, d: SW.t, Y: SW.y, A: SW.y, a: SW.u, G: SW.i, S: SW.u, s: SW.d, B: SW.d, b: SW.k,
  },

  // --- non-rig bodies -------------------------------------------------------------
  juniper: {
    O: '#c9a16b',
    K: INK, F: '#1f1d2a', f: '#141b33', L: '#3a3848', M: '#f1eee6', m: '#b9b4c4', E: INK, W: '#f1eee6',
    I: '#2a6f8f', i: '#3fae8c', C: '#c97b2c', c: '#8a4f1a', A: BRASS, S: '#3a3848', B: '#3a3848', N: '#3a3848', Y: BRASS, a: '#7a5a36', k: INK,
  },
  barnaby: {
    O: '#c9a16b',
    K: '#3a2410', A: '#b8862f', L: '#e3b867', a: '#7a5a1e', W: PAPER, G: '#9fd3c0', g: '#7ab8a4', E: INK,
    R: '#e06a4f', r: '#a8402e', S: '#a8402e', s: '#7a2e20', B: '#e06a4f', k: '#3a2410', Y: BRASS,
  },
  hesper: {
    O: '#c9a16b',
    K: '#2e3a2c', F: '#a9b8a0', f: '#7a8c74', L: '#c3d0ba', E: '#2e3a2c', W: '#e9f7f2',
    C: '#c9b48a', c: '#8c7a5a', M: '#f4f1e6', A: BRASS, a: '#7a5a36', k: '#2e3a2c', X: '#f9c46b', x: '#e8d3a0', Y: '#a8323a',
  },
  ansel: {
    O: '#c9a16b',
    K: '#2a3340', F: '#8ea0b0', f: '#607486', L: '#b8c8d4', M: '#e8edf0', m: '#c8d2da', E: '#141b33', W: PAPER,
    N: '#d9a441', n: '#b07a2a', S: '#607486', s: '#3b4a6b', B: '#d9a441', R: '#3b4a6b', k: '#1e2433', C: '#2b3a67', c: '#1e2a4a', Y: '#f2c14e', a: '#7a5a36',
  },
  wick: {
    O: '#c9a16b',
    K: '#1e1e28', F: '#2a2433', f: '#1e1e28', L: '#3a3848', M: '#f1eee6', m: '#c8c4cc', E: INK, W: PAPER,
    N: '#f28c28', n: '#c96a1a', B: '#f28c28', b: '#c96a1a', C: '#a3283a', c: '#7a1e2c', D: '#f4e8c1', Y: '#f4e8c1', k: '#1e1e28', a: '#7a5a36',
  },
  ludo: {
    O: '#c9a16b',
    K: '#2a1c22', F: '#6a4a52', f: '#4a3038', L: '#8a6a72', M: '#c9a090', m: '#a8807a', E: INK, W: PAPER,
    N: '#3a1f1c', P: '#e3a0a8', S: '#3a2830', k: '#2a1c22', V: '#a0727a', v: '#7e5260', z: '#141b3366', X: '#f9c46b', C: '#3b4a6b', c: '#2b3a67', Y: '#a8323a',
  },
  dimity: {
    O: '#c9a16b',
    z: '#141b3366', K: '#7a3b4e', k: '#7a3b4e', F: '#f2a7b5', f: '#d98a9c', L: '#f9d1d9', Y: '#ffe29a', y: '#f3c178', E: '#141b33', W: PAPER, M: '#fff3d6', m: '#f3c178', P: '#e07a9a',
  },
};

export const CHARACTERS = {
  player: { name: 'The Newcomer', species: 'red panda', body: 'redpanda', palette: 'redpanda' },
  otter: { name: 'Newcomer (otter)', species: 'river otter', body: 'otter', palette: 'otter' },
  vole: { name: 'Newcomer (vole)', species: 'water vole', body: 'vole', palette: 'vole' },
  opossum: { name: 'Newcomer (opossum)', species: 'opossum', body: 'opossum', palette: 'opossum' },
  ferret: { name: 'Newcomer (ferret)', species: 'ferret', body: 'ferret', palette: 'ferret' },
  mongoose: { name: 'Newcomer (mongoose)', species: 'mongoose', body: 'mongoose', palette: 'mongoose' },
  wren: { name: 'Wren Hearthwright', species: 'beaver', body: 'wren', palette: 'wren' },
  ambrose: { name: 'Ambrose', species: 'old beaver', body: 'ambrose', palette: 'ambrose' },
  hesper: { name: 'Hesper Coil', species: 'garden snail', body: 'snail', palette: 'hesper' },
  juniper: { name: 'Juniper Pell', species: 'magpie', body: 'magpie', palette: 'juniper' },
  barnaby: { name: 'Barnaby Thole', species: 'hermit crab', body: 'crab', palette: 'barnaby' },
  tamsin: { name: 'Tamsin Brack', species: 'badger', body: 'tamsin', palette: 'tamsin' },
  ansel: { name: 'Ansel Stalk', species: 'heron', body: 'heron', palette: 'ansel' },
  wick: { name: 'Wick Dorrow', species: 'puffling', body: 'puffling', palette: 'wick' },
  ludo: { name: 'Ludo', species: 'fruit bat', body: 'bat', palette: 'ludo' },
  dimity: { name: 'Dimity', species: 'rosy maple moth', body: 'moth', palette: 'dimity' },
  linnet: { name: 'Linnet Rask', species: 'stoat', body: 'linnet', palette: 'linnet' },
  corin: { name: 'Corin Vale', species: 'barn owl', body: 'corin', palette: 'corin' },
  idris: { name: 'Idris Fenwake', species: 'grey wolf', body: 'trainerCoat', palette: 'idris' },
  agathe: { name: 'Agathe Merrow', species: 'hare', body: 'trainerCoat', palette: 'agathe' },
  teo: { name: 'Teo Varga', species: 'red fox', body: 'trainerVest', palette: 'teo' },
  routeTrainer: { name: 'Route trainer', species: 'trainer', body: 'trainerVest', palette: 'routeTrainer' },
};

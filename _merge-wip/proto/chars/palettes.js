// proto/chars/palettes.js
// Per-character palettes for the role letters used by the rigs.
// Townsfolk use the Porchlight cast hex tokens; Wildshift trainers use the Sweetie-16 master keys.
// No pure black (darkest #141B33) and no pure white (lightest #F6F1E3).

const INK = '#141b33', PAPER = '#f6f1e3', BRASS = '#d9a441', BRASS_S = '#8a6a1e';

export const PALETTES = {
  // --- player species (6), shared rig -------------------------------------
  redpanda: {
    K: '#3a1f1c', F: '#c2502a', f: '#8b3620', L: '#e07a3f', M: PAPER, m: '#e9c08a',
    E: INK, W: PAPER, N: '#3a1f1c', P: '#f2a7b5',
    C: '#f4e8c1', c: '#d8c79b', D: '#3b4a6b', d: '#2b3a67',
    S: '#4a2a22', B: '#7a5a36', T: '#e9c08a', t: '#c9a070', A: BRASS, a: BRASS_S,
  },
};

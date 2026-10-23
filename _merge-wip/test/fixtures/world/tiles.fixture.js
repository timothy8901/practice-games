/**
 * Fixture tileset for the WORLD-MAP tests, in the `data/tilesets.js` shape:
 * `TILES {id -> {art, solid, water, tide, verb, sfx, anim, glow}}` plus `DEFAULT_LEGEND`.
 * Not game content: ids and numbers here are only what the tests need.
 */

export const TILES = Object.freeze({
  'deep': { art: 'water_deep', solid: false, water: true, tide: null, verb: 'fish', sfx: null, anim: { frames: 3, fps: 2 }, glow: null, spawn: 'water' },
  'shallows': { art: 'water_shallow', solid: false, water: true, tide: null, verb: 'fish', sfx: null, anim: 3, glow: null, spawn: 'water' },
  'sand': { art: 'sand', solid: false, water: false, tide: null, verb: null, sfx: 'sand', anim: null, glow: null },
  'wet-sand': { art: 'wetsand', solid: false, water: false, tide: 'floods', verb: 'dig', sfx: 'wet', anim: null, glow: null, spawn: 'mud' },
  'causeway': { art: 'causeway', solid: false, water: false, tide: 'low', verb: null, sfx: 'stone', anim: null, glow: null },
  'grass': { art: 'grass_a', solid: false, water: false, tide: null, verb: null, sfx: 'grass', anim: null, glow: null, spawn: 'grass' },
  'tall-grass': { art: 'tallgrass', solid: false, water: false, tide: null, verb: null, sfx: 'grass', anim: 2, glow: null, spawn: 'grass' },
  'path': { art: 'path', solid: false, water: false, tide: null, verb: null, sfx: 'dirt', anim: null, glow: null },
  'cobbles': { art: 'cobbles', solid: false, water: false, tide: null, verb: null, sfx: 'stone', anim: null, glow: null },
  'pier': { art: 'pier', solid: false, water: false, tide: null, verb: null, sfx: 'wood', anim: null, glow: null },
  'glow-mud': { art: 'mud_glow', solid: false, water: false, tide: 'glow', verb: 'dig', sfx: 'mud', anim: { frames: 3, fps: 1 }, glow: { kind: 'bio', color: '#3FF2E0', radius: 24 }, spawn: 'mud' },
  'cliff': { art: 'cliff', solid: true, water: false, tide: null, verb: 'look', sfx: null, anim: null, glow: null },
  'wall': { art: 'wall_timber', solid: true, water: false, tide: null, verb: null, sfx: null, anim: null, glow: null },
  'door': { art: 'door', solid: false, water: false, tide: null, verb: null, sfx: 'wood', anim: null, glow: null },
  'floor': { art: 'floor_plank', solid: false, water: false, tide: null, verb: null, sfx: 'wood', anim: null, glow: null },
  'lamp': { art: 'lamp_lit', solid: true, water: false, tide: null, verb: null, sfx: null, anim: null, glow: { kind: 'lamp', color: '#F9C46B', radius: 40, oy: -8 } },
  'porch-light': { art: 'porch', solid: false, tide: null, verb: null, sfx: null, anim: null, glow: { kind: 'porch', flag: 'np.wren.home', radius: 32 } },
  'rune': { art: 'waystone', solid: false, water: false, tide: null, verb: 'waystone', sfx: null, anim: null, glow: { kind: 'rune', color: '#73EFF7', radius: 20 } },
  'candle': { art: 'candle', solid: false, water: false, tide: null, verb: null, sfx: null, anim: 2, glow: true },
  'rock': { art: 'rock_a', solid: true, water: false, tide: null, verb: 'look', sfx: null, anim: null, glow: null },
  'slipway': { art: 'slipway', solid: false, water: false, tide: 'high', verb: null, sfx: 'stone', anim: null, glow: null },
  'tree-crown': { art: 'alder_crown', anim: null, glow: null },
  'rug': { art: 'rug' },
});

/** Default legend (`data/tilesets.DEFAULT_LEGEND` stand-in). */
export const DEFAULT_LEGEND = Object.freeze({
  D: 'deep',
  S: 'shallows',
  A: 'sand',
  W: 'wet-sand',
  E: 'causeway',
  G: 'grass',
  T: 'tall-grass',
  P: 'path',
  O: 'cobbles',
  K: 'pier',
  M: 'glow-mud',
  C: 'cliff',
  H: 'wall',
  d: 'door',
  f: 'floor',
  l: 'lamp',
  p: 'porch-light',
  r: 'rune',
  k: 'rock',
  Y: 'slipway',
  c: 'tree-crown',
});

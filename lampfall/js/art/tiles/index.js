/**
 * TILE_ART by tile id: the union of the tile groups (split from `proto/tiles/tiles.js`). [ART-TILES]
 *
 * Group files are imported here and nowhere else. Ids are kebab-case and unique across groups (a
 * collision throws at import). {@link TILE_ALIASES} maps the day-1 placeholder art ids
 * (`js/data/placeholder/world.js`) and the prototype's snake_case names onto real tiles, so existing
 * tile definitions keep resolving while the map lane retargets them.
 *
 * Pure: no DOM.
 * @module art/tiles/index
 */

import { BUILDINGS_TILES } from './buildings.js';
import { FLORA_TILES } from './flora.js';
import { GROUND_TILES } from './ground.js';
import { LIGHTHOUSE_TILES } from './lighthouse.js';
import { STONE_TILES } from './stone.js';
import { WATER_TILES } from './water.js';
import { WOOD_TILES } from './wood.js';

export { TILE } from './kit.js';

/** Group name -> its table, in sheet order. */
export const TILE_GROUPS = Object.freeze({
  ground: GROUND_TILES,
  water: WATER_TILES,
  stone: STONE_TILES,
  wood: WOOD_TILES,
  flora: FLORA_TILES,
  buildings: BUILDINGS_TILES,
  lighthouse: LIGHTHOUSE_TILES,
});

const all = {};
for (const [group, table] of Object.entries(TILE_GROUPS)) {
  for (const [id, t] of Object.entries(table)) {
    if (all[id]) throw new Error(`art/tiles: tile id '${id}' is defined in both ${all[id].group} and ${group}`);
    all[id] = t;
  }
}

/** Every tile by id. @type {Readonly<Record<string, object>>} */
export const TILE_ART = Object.freeze(all);

/** Tile ids in group order. */
export const TILE_IDS = Object.freeze(Object.keys(all));

/**
 * Alternative names -> tile id: day-1 placeholder art ids, then the prototype's snake_case names.
 * @type {Readonly<Record<string, string>>}
 */
export const TILE_ALIASES = Object.freeze(Object.fromEntries(Object.entries({
  // js/data/placeholder/world.js art ids
  'deep-water': 'water-deep',
  shallows: 'water-shallow',
  grass: 'grass-a',
  wall: 'wall-timber',
  floor: 'floor-boards',
  // proto/tiles/tiles.js names (snake_case)
  grass_a: 'grass-a', grass_b: 'grass-b', tallgrass: 'tall-grass', wetsand: 'wet-sand', mud_dry: 'mud-dry',
  mud_wet: 'mud-wet', mud_glow: 'mud-glow', water_deep: 'water-deep', water_shallow: 'water-shallow',
  water_mud: 'water-mud', stepstone_sub: 'stepstone-sub', causeway_sub: 'causeway-sub', cliff_face: 'cliff-face',
  cliff_face_l: 'cliff-face-l', cliff_face_r: 'cliff-face-r', ledge_b: 'ledge-b', ledge_l: 'ledge-l',
  ledge_r: 'ledge-r', cobbles_b: 'cobbles-b', quay_lip: 'quay-lip', quay_lip_b: 'quay-lip-b', pier_end: 'pier-end',
  wall_timber: 'wall-timber', wall_timber_x: 'wall-timber-x', wall_brick: 'wall-brick', window_unlit: 'window-unlit',
  window_lit: 'window-lit', window_brick_unlit: 'window-brick-unlit', window_brick_lit: 'window-brick-lit',
  lamp_unlit: 'lamp-unlit', lamp_lit: 'lamp-lit', fence_h: 'fence-h', fence_v: 'fence-v', flowers_a: 'flowers-a',
  flowers_b: 'flowers-b', rock_a: 'rock-a', rock_b: 'rock-b', tree_pine: 'tree-pine', tree_alder: 'tree-alder',
  tree_alder_b: 'tree-alder-b', tree_fruit: 'tree-fruit', tree_fruit_b: 'tree-fruit-b', tree_fruit_bare: 'tree-fruit-bare',
  lighthouse_dark: 'lighthouse-dark', lighthouse_lit: 'lighthouse-lit', lighthouse_scaffold: 'lighthouse-scaffold',
  light_pool: 'light-pool', fog_band: 'fog-band', cloud_a: 'cloud-a', cloud_b: 'cloud-b', isle_far: 'isle-far',
}).filter(([, to]) => to in all)));

/**
 * Canonical tile id for an id or alias, or `null` when unknown.
 * @param {string} id
 * @returns {string|null}
 */
export function resolveTileId(id) {
  if (Object.hasOwn(TILE_ART, id)) return id;
  if (Object.hasOwn(TILE_ALIASES, id)) return TILE_ALIASES[id];
  return null;
}

/**
 * The tile definition for an id or alias.
 * @param {string} id
 * @returns {object}
 * @throws {Error} on an unknown id
 */
export function tileDef(id) {
  const k = resolveTileId(id);
  if (!k) throw new Error(`art/tiles: unknown tile '${id}'`);
  return TILE_ART[k];
}

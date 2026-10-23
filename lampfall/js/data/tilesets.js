/**
 * Tile definitions for every map in LAMPFALL (GDD-01 §2). [DATA-MAPS]
 *
 * One row per tile kind. `char` is the DEFAULT_LEGEND character every map inherits (a map's own
 * `legend` merges over it); rows without a `char` are reached through a map legend, an entity's
 * `art`, or a prop. `art` names a tile in `js/art/tiles/index.js` (TILE_ART) or a prop in
 * `js/art/props.js` (PROP_ART); ids marked `ART REQUEST` have no art yet (GDD-01 §9).
 *
 * Fields beyond the TileDef typedef (ignored by `world/tilemap` and the validator today; GDD-01 §2.3
 * asks WORLD-MAP to honour them):
 *  - `tideWindow`  minutes either side of low water that a `tide:'low'|'glow'` tile is dry
 *                  (GDD-00 §4: causeways 150, stepping stones 120, flats 90, the Bar 90, mainland 60).
 *  - `lowerLow`    dry only around the day's lower low (the Bar, until `lit.bar`).
 *  - `openFlag`    a world flag that makes the tile dry at any tide (the Bar after the Relighting).
 *  - `spring`      dry only at a spring low (the Old Quay, every 7th day).
 *  - `way`         the clockSys TIDE_WINDOWS kind that opens the tile ('causeway' | 'stones' | 'flats' |
 *                  'bar' | 'spur' | 'mainland'): the runtime asks `clockSys.gateTide(world, way)` per tile,
 *                  and tools/map-reachability.mjs proves the routes with the same windows.
 *  - `autotile`    neighbour rule the renderer uses to pick ends/edges ('roof', 'fence', 'cliff', ...).
 *  - `roof`        roof colour family (ROOF_COLOUR_IDS) for roof tiles; `roofFrom:'player'` = the
 *                  colour picked at the payment ceremony.
 *  - `litArt`      art shown when the tile's light is on (windows, the lighthouse, the lens).
 *  - `layer`       'detail' when the art is drawn over a ground tile (fences, rocks, trees, crates);
 *                  a non-solid detail tile omits `tide` and `water` so the ground tile's apply.
 *
 * `spawn` is set on every tile whose id would otherwise match a keyword spawn class by name
 * (`grass`, `water`, `mud`), so lawns never roll encounters: only `spawn:'grass'` cover (tall grass,
 * reeds, heather, thistles) and `spawn:'mud'` flats do.
 *
 * Pure data: no imports, frozen exports.
 * @module data/tilesets
 */

/** Footstep sfx ids (core/audio SFX_NAMES). */
const STEP = 'step';
const WET = 'stepWater';

/** Light pools (world/tilemap GlowDef). */
const GLOW = Object.freeze({
  lamp: Object.freeze({ kind: 'lamp', color: '#F9C46B', radius: 40, when: 'night' }),
  pane: Object.freeze({ kind: 'window', color: '#F9C46B', radius: 20, when: 'night' }),
  bio: Object.freeze({ kind: 'bio', color: '#3FF2E0', radius: 24, when: 'night-low' }),
  skyglass: Object.freeze({ kind: 'rune', color: '#FF5BD6', radius: 20, when: 'always' }),
  fire: Object.freeze({ kind: 'fire', color: '#FFB547', radius: 36, when: 'always' }),
  beam: Object.freeze({ kind: 'lamp', color: '#FFB547', radius: 64, when: 'night', flag: 'sp.relighting' }),
  waystone: Object.freeze({ kind: 'lamp', color: '#F9C46B', radius: 32, when: 'night' }),
});

/**
 * Builds one frozen TileDef with every typedef field present.
 * @param {string} id
 * @param {string|null} char
 * @param {string} art
 * @param {Partial<import('./index.js').TileDef> & Record<string, any>} [o]
 * @returns {Readonly<import('./index.js').TileDef>}
 */
function t(id, char, art, o = {}) {
  const row = {
    id,
    ...(char ? { char } : {}),
    art,
    solid: o.solid ?? false,
    water: o.water ?? false,
    tide: o.tide ?? null,
    verb: o.verb ?? null,
    sfx: o.sfx === undefined ? (o.solid ? null : STEP) : o.sfx,
    anim: o.anim ?? 0,
    glow: o.glow ?? false,
  };
  for (const [k, v] of Object.entries(o)) if (!(k in row)) row[k] = v;
  // A non-solid decoration drawn over a ground tile (seaweed on the flats, glasswort, a gate) leaves
  // `tide` and `water` undefined so world/tilemap falls through to the ground tile beneath it.
  if ((o.layer === 'detail' || o.layer === 'overlay') && !o.solid) {
    if (!('tide' in o)) delete row.tide;
    if (!('water' in o)) delete row.water;
  }
  return Object.freeze(row);
}

/** Solid shorthand. */
const solid = (o = {}) => ({ solid: true, ...o });
/** Detail-layer solid prop shorthand (fences, rocks, crates, trees). */
const prop = (o = {}) => ({ solid: true, layer: 'detail', ...o });
/** Open water shorthand. */
const sea = (o = {}) => ({ water: true, verb: 'fish', sfx: WET, ...o });

/** @type {ReadonlyArray<Readonly<import('./index.js').TileDef>>} */
export const TILESETS = Object.freeze([
  // --- ground: lawns, cover, sand, mud --------------------------------------------------------
  t('grass', 'G', 'grass-a', { spawn: 'lawn' }),
  t('grass-b', 'g', 'grass-b', { spawn: 'lawn' }),
  t('meadow', ',', 'grass-c', { spawn: 'lawn' }),
  t('tall-grass', 'T', 'tall-grass', { anim: { frames: 3, fps: 4 }, spawn: 'grass' }),
  t('reeds', 'r', 'reeds', { anim: { frames: 3, fps: 4 }, spawn: 'grass', autotile: 'reed-edge' }),
  t('heather', 'n', 'heather', { anim: { frames: 3, fps: 4 }, spawn: 'grass' }),
  t('thistles', 't', 'thistles', { spawn: 'grass', layer: 'detail' }),
  t('marsh', 'U', 'marsh', { sfx: WET, spawn: 'marsh' }),
  t('moor-turf', 'F', 'moor-turf'),
  t('sand', 'A', 'sand'),
  t('sand-ripples', 'a', 'sand-ripples'),
  t('wet-sand', 'W', 'wet-sand', { tide: 'floods', verb: 'dig', sfx: WET, autotile: 'tideline' }),
  t('shingle', 'q', 'shingle'),
  t('mud-bank', 'm', 'mud-dry', { verb: 'dig', spawn: 'bank' }),
  t('mud-flat', 'M', 'mud-wet', { tide: 'low', tideWindow: 90, way: 'flats', verb: 'dig', sfx: WET, spawn: 'mud' }),
  t('mud-glow', 'Y', 'mud-glow', { tide: 'glow', tideWindow: 90, way: 'flats', verb: 'dig', sfx: WET, anim: { frames: 3, fps: 4 }, glow: GLOW.bio, spawn: 'mud' }),
  t('soil', ';', 'soil', { verb: 'dig' }),
  t('snow', '-', 'snow'),
  t('ash', '>', 'ash'),
  t('ice', 'x', 'ice', { slide: true }),
  t('ice-cracked', null, 'ice-cracked', { slide: true }),
  t('mirror-ice', '?', 'mirror-ice', { anim: { frames: 4, fps: 3 }, mirror: true }),
  t('cave-floor', null, 'cave-floor'),
  t('spa-terrace', null, 'spa-terrace'),

  // --- ground: made surfaces -------------------------------------------------------------------
  t('path', 'P', 'path', { autotile: 'path' }),
  t('cobbles', 'O', 'cobbles'),
  t('cobbles-worn', null, 'cobbles-b'),
  t('flagstones', 'f', 'flagstones'),
  t('gravel', ':', 'gravel'),
  t('quay', 'Q', 'cobbles-b', { autotile: 'quay-lip' }),
  t('steps', 'H', 'steps'),
  t('deck-planks', 'p', 'deck-planks'),
  t('porch-step', '_', 'deck-planks', { porch: true }),
  t('pier', 'K', 'pier', { autotile: 'pier' }),
  t('boardwalk', 'k', 'boardwalk-h', { autotile: 'boardwalk' }),
  t('bridge-wood', 'B', 'bridge-wood', { water: false, autotile: 'bridge' }),
  t('bridge-stone', 'N', 'bridge-stone', { water: false }),
  t('drowned-street', 'd', 'cobbles-b', { tide: 'low', tideWindow: 150, way: 'causeway', sfx: WET, note: 'Drownwood: the drowning street, dry around low water' }),
  t('old-quay', null, 'causeway-sub', { tide: 'low', tideWindow: 90, way: 'flats', spring: true, verb: 'dig', note: 'Pellwick: bared only at a spring low (GDD-00 §4)' }),

  // --- water ------------------------------------------------------------------------------------
  t('deep-water', 'D', 'water-deep', sea({ autotile: 'swell' })),
  t('shallows', 'S', 'water-shallow', sea({ autotile: 'foam', note: 'static: the foam edge overlay animates (animated-tile budget)' })),
  t('river', 'R', 'river', sea({ anim: { frames: 4, fps: 6 }, autotile: 'bank' })),
  t('lagoon', 'u', 'water-lagoon', sea({ anim: { frames: 4, fps: 4 } })),
  t('tannin-water', 'j', 'water-tannin', sea({ anim: { frames: 4, fps: 4 } })),
  t('hot-spring', 'J', 'water-spring', sea({ verb: 'look', anim: { frames: 4, fps: 3 } })),
  t('mud-water', null, 'water-mud', sea({ spawn: 'water' })),
  t('shoal', null, 'shoal', sea({ anim: { frames: 4, fps: 4 }, layer: 'detail' })),
  t('lily-pads', null, 'lily-pads', sea({ layer: 'detail' })),
  t('tidepool', '~', 'tidepool', { water: true, verb: 'look', sfx: WET }),
  t('weir', 'Z', 'weir', { solid: true, water: true, verb: 'look', anim: { frames: 4, fps: 8 } }),

  // --- tide roads (GDD-00 §4 windows) ----------------------------------------------------------
  t('stepping-stones', 'e', 'stepstone-sea', { tide: 'low', tideWindow: 120, way: 'stones' }),
  t('river-stones', 'z', 'stepstone', { tide: 'low', tideWindow: 120, way: 'stones' }),
  t('causeway', 'E', 'causeway', { tide: 'low', tideWindow: 150, way: 'causeway', autotile: 'causeway' }),
  t('mainland-causeway', 'X', 'mainland-causeway', { tide: 'low', tideWindow: 60, way: 'mainland', autotile: 'causeway' }),
  t('bar-road', 'b', 'causeway-v', { tide: 'low', tideWindow: 90, way: 'bar', lowerLow: true, openFlag: 'lit.bar', autotile: 'causeway', note: 'the Bar road beyond the spur foot: the day\'s lower low only, any tide after the Relighting' }),
  t('bar-road-near', null, 'causeway-v', { tide: 'low', tideWindow: 90, way: 'spur', openFlag: 'lit.bar', autotile: 'causeway', note: 'the Bar road from the point to the spur foot: every low (the Lantern Stack spur must be reachable at every low, GDD-00 §4), any tide after the Relighting' }),
  t('bar-spur', null, 'sand-ripples', { tide: 'low', tideWindow: 90, way: 'spur', sfx: WET, note: 'the Lantern Stack spur, a sand bar: every low +-1.5 h (ART REQUEST bar-spur: a sand-bar variant)' }),

  // --- solid terrain ------------------------------------------------------------------------------
  t('cliff', 'C', 'cliff-face', solid({ autotile: 'cliff' })),
  t('ledge', 'h', 'ledge', solid({ autotile: 'ledge' })),
  t('glacier', null, 'cliff-face-ice', solid({ autotile: 'cliff' })),
  t('quarry-face', null, 'quarry-face', solid()),
  t('basalt', null, 'basalt', solid()),
  t('cave-wall', null, 'cave-wall', solid()),
  t('spa-terrace-lip', null, 'spa-terrace-lip', solid()),
  t('quay-lip', null, 'quay-lip', solid({ verb: 'fish', layer: 'edge', note: 'normally drawn by the quay autotile; paint only for a free-standing lip' })),
  t('rock', 'o', 'rock-a', prop({ verb: 'look' })),
  t('rock-b', null, 'rock-b', prop({ verb: 'look' })),
  t('boulder', '0', 'crag', prop({ verb: 'look' })),
  t('volcanic-rock', '<', 'volcanic-rock', prop()),
  t('ember-vent', null, 'ember-vent', prop({ anim: { frames: 3, fps: 4 }, glow: GLOW.fire })),
  t('standing-stone', null, 'standing-stone', prop({ verb: 'look' })),
  t('sea-stack', null, 'sea-stack', prop()),
  t('wreck-ribs', null, 'wreck-ribs', prop({ verb: 'look' })),
  t('wreck-post', null, 'wreck-post', prop()),
  t('skyglass-node', null, 'skyglass', prop({ verb: 'chip', anim: { frames: 2, fps: 2 }, glow: GLOW.skyglass })),
  t('waystone', null, 'waystone', prop({ verb: 'waystone', litArt: 'waystone-lit', glow: GLOW.waystone })),
  t('brazier', null, 'brazier', prop({ verb: 'look', glow: GLOW.fire })),
  t('windmill', null, 'windmill', prop({ verb: 'look' })),

  // --- flora ------------------------------------------------------------------------------------
  t('pine', '8', 'tree-pine', prop()),
  t('alder', '9', 'tree-alder', prop()),
  t('alder-b', null, 'tree-alder-b', prop()),
  t('blossom', null, 'tree-blossom', prop()),
  t('pine-snow', null, 'tree-pine-snow', prop()),
  t('mangrove', null, 'tree-mangrove', prop()),
  t('drowned-tree', null, 'tree-drowned', prop()),
  t('tree-fruit', null, 'tree-fruit', prop({ verb: 'shake', note: 'entity art: named fruit trees' })),
  t('tree-purse', null, 'tree-purse', prop({ verb: 'shake', note: 'entity art: purse trees' })),
  t('tree-bee', null, 'tree-bee', prop({ verb: 'shake', anim: { frames: 4, fps: 6 }, note: 'entity art: bee trees' })),
  t('hedge', 'V', 'hedge', prop()),
  t('bush', 'v', 'bush', prop()),
  t('gorse', 'y', 'gorse', prop()),
  t('bean-rows', '=', 'bean-rows', prop({ verb: 'look' })),
  t('flowers', '*', 'flowers-a'),
  t('flowers-b', '&', 'flowers-b'),
  t('glasswort', 'i', 'glasswort', { layer: 'detail', spawn: 'marsh' }),
  t('seaweed', 'l', 'seaweed', { layer: 'detail', sfx: WET, spawn: 'shore' }),

  // --- buildings: walls, windows, doors ------------------------------------------------------------
  t('wall-timber', '#', 'wall-timber', solid()),
  t('wall-brick', 'w', 'wall-brick', solid()),
  t('wall-stone', 's', 'wall-stone', solid()),
  t('wall-shiplap', '$', 'wall-shiplap', solid()),
  t('window', '%', 'window-unlit', solid({ litArt: 'window-lit', glow: GLOW.pane })),
  t('window-brick', '[', 'window-brick-unlit', solid({ litArt: 'window-brick-lit', glow: GLOW.pane })),
  t('window-stone', ']', 'window-stone-unlit', solid({ litArt: 'window-stone-lit', glow: GLOW.pane })),
  t('window-shiplap', '{', 'window-shiplap-unlit', solid({ litArt: 'window-shiplap-lit', glow: GLOW.pane })),
  t('window-dark', '}', 'window-box-unlit', solid({ note: 'shuttered window of a dark house; the house porch flag lights it' })),
  t('porthole', null, 'lighthouse-porthole', solid({ verb: 'look', glow: GLOW.pane })),
  t('door', '+', 'door', { verb: 'enter', sfx: 'doorOpen' }),
  t('door-brick', '!', 'door-brick', { verb: 'enter', sfx: 'doorOpen' }),
  t('door-stone', '@', 'door-stone', { verb: 'enter', sfx: 'doorOpen' }),
  t('door-arch', '"', 'door-arch', { verb: 'enter', sfx: 'doorOpen' }),
  t('door-porch', null, 'door-porch', { verb: 'enter', sfx: 'doorOpen' }),

  // --- buildings: roofs (autotiled ridge/body/eave/ends from the block) ----------------------------
  t('roof-slate', '^', 'roof-slate-body', solid({ autotile: 'roof', roof: 'slate-blue' })),
  t('roof-red', '1', 'roof-red-body', solid({ autotile: 'roof', roof: 'harbor-red' })),
  t('roof-moss', '2', 'roof-moss-body', solid({ autotile: 'roof', roof: 'moss' })),
  t('roof-blue', '3', 'roof-blue-body', solid({ autotile: 'roof', roof: 'sea-blue' })),
  t('roof-straw', '4', 'roof-straw-body', solid({ autotile: 'roof', roof: 'straw' })),
  t('roof-dark', '5', 'roof-dark-body', solid({ autotile: 'roof', roof: 'tar' })),
  t('roof-teal', '6', 'roof-teal-body', solid({ autotile: 'roof', roof: 'heather' })),
  t('roof-ochre', '7', 'roof-ochre-body', solid({ autotile: 'roof', roof: 'ochre' })),
  t('roof-keeper', null, 'roof-slate-body', solid({ autotile: 'roof', roofFrom: 'player', note: 'the Keeper\'s Cottage: colour picked at each payment (slate-blue default)' })),

  // --- street furniture ----------------------------------------------------------------------------
  t('fence', '|', 'fence-h', prop({ autotile: 'fence' })),
  t('fence-gate', '/', 'fence-gate', { layer: 'detail', verb: 'open' }),
  t('lamp-post', 'L', 'lamp-post', prop({ glow: GLOW.lamp, note: 'PROP_ART lamp-post (16x24)' })),
  t('crates', 'c', 'crates', prop({ verb: 'look' })),
  t('barrel', '(', 'barrel', prop({ verb: 'look' })),
  t('mooring-post', ')', 'mooring-post', prop()),
  t('creel', null, 'creel', prop({ verb: 'look' })),
  t('net-rack', null, 'net-rack', prop({ verb: 'look' })),
  t('timber-stack', null, 'timber-stack', prop({ verb: 'look', note: 'ART REQUEST: Wren\'s alder planks' })),
  t('string-lights', null, 'string-lights', { layer: 'overlay', anim: { frames: 2, fps: 2 }, glow: GLOW.lamp }),
  t('market-stall', null, 'market-stall-red', prop({ verb: 'shop' })),
  t('bench', null, 'bench', prop({ verb: 'sit' })),
  t('dig-crack', null, 'dig-crack', { layer: 'detail', verb: 'dig' }),
  t('dig-hole', null, 'dig-hole', { layer: 'detail' }),

  // --- the lighthouse ---------------------------------------------------------------------------------
  t('lighthouse', null, 'lighthouse-dark', prop({ litArt: 'lighthouse-lit', glow: GLOW.beam, note: '32x80 object on a 2x2 stone base' })),
  t('lighthouse-scaffold', null, 'lighthouse-scaffold', prop({ note: 'seven sections, one per loan tier' })),
  t('lighthouse-wall', null, 'lighthouse-wall', solid()),
  t('lamp-room-floor', null, 'lamp-room-floor'),
  t('stair-spiral', null, 'stair-spiral', { verb: 'climb' }),
  t('lens', null, 'lens-dark', solid({ litArt: 'lens-lit', glow: GLOW.beam, verb: 'look' })),

  // --- interiors -------------------------------------------------------------------------------------
  t('floor-boards', null, 'floor-boards'),
  t('floor-stone', null, 'floor-stone'),
  t('cottage-floor', null, 'cottage-floor-1', { artByTier: ['cottage-floor-0', 'cottage-floor-1', 'cottage-floor-2', 'cottage-floor-3'] }),
  t('cottage-wall', null, 'cottage-wall-1', solid({ artByTier: ['cottage-wall-0', 'cottage-wall-1', 'cottage-wall-2', 'cottage-wall-3'] })),
  t('cottage-wall-top', null, 'cottage-wall-1-top', solid({ artByTier: ['cottage-wall-0-top', 'cottage-wall-1-top', 'cottage-wall-2-top', 'cottage-wall-3-top'] })),
  t('int-wall', null, 'cottage-wall-1', solid()),
  t('int-wall-top', null, 'cottage-wall-1-top', solid()),
  t('rug', null, 'rug', { layer: 'detail' }),
  t('hearth', null, 'hearth', solid({ verb: 'look', anim: { frames: 3, fps: 6 }, glow: GLOW.fire })),
  t('counter', null, 'counter', solid({ verb: 'shop', note: 'ART REQUEST' })),
  t('shelf', null, 'shelf', solid({ verb: 'look', note: 'ART REQUEST' })),
  t('table', null, 'table', solid({ verb: 'look', note: 'ART REQUEST' })),
  t('bed', null, 'bed', solid({ verb: 'bed', note: 'ART REQUEST' })),
  t('stairs-up', null, 'stairs-up', { verb: 'climb', note: 'ART REQUEST' }),
  t('stairs-down', null, 'stairs-down', { verb: 'climb', note: 'ART REQUEST' }),
  t('string-wall', null, 'string-wall', solid({ verb: 'look', note: 'ART REQUEST: Barnaby\'s string wall' })),
  t('spire-floor-turn', null, 'spire-floor-turn'),
  t('spire-wall-turn', null, 'spire-wall-turn', solid()),
  t('spire-floor-ward', null, 'spire-floor-ward'),
  t('spire-wall-ward', null, 'spire-wall-ward', solid()),
  t('spire-floor-weather', null, 'spire-floor-weather'),
  t('spire-wall-weather', null, 'spire-wall-weather', solid()),
  t('spire-floor-hollow', null, 'spire-floor-hollow'),
  t('spire-wall-hollow', null, 'spire-wall-hollow', solid()),
  t('spire-floor-relay', null, 'spire-floor-relay'),
  t('spire-wall-relay', null, 'spire-wall-relay', solid()),
  t('spire-floor-mirror', null, 'spire-floor-mirror'),
  t('spire-wall-mirror', null, 'spire-wall-mirror', solid()),
  t('spire-dais', null, 'spire-dais', { layer: 'edge', verb: 'challenge' }),
]);

/**
 * Tile definitions keyed by id: the `tiles` argument `world/tilemap.loadMap` takes.
 * @type {Readonly<Record<string, Readonly<import('./index.js').TileDef>>>}
 */
export const TILES = Object.freeze(Object.fromEntries(TILESETS.map((d) => [d.id, d])));

/**
 * `char -> tile id` for every row with a `char`; a map's `legend` merges over it.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_LEGEND = Object.freeze(Object.fromEntries(TILESETS.filter((d) => d.char).map((d) => [d.char, d.id])));

/** Tile art ids this table names that `js/art/tiles` / `js/art/props` do not draw yet (GDD-01 §9). */
export const ART_REQUESTS = Object.freeze([]); // every art id above now resolves in js/art (the interior and yard tiles landed); GDD-01 §9 lists the nice-to-haves

export default TILESETS;

/**
 * THE HOLLOW SPIRE (spire-hollow), Drownwood — Wendel Teague, immunities (GDD-00 §4; GDD-01 §12.4).
 * [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12); returns to Drownwood's `spire-step`.
 *
 * Wendel's boat shed, built round a drowned grove: the floor is dark tannin water, the hull ribs of a
 * boat that was never finished arch along the sides, drowned trees stand in the water, and one plank
 * walk winds from the slipway landing (row 12) east, back west, north and east again to the dry deck at
 * the bow where Wendel waits on his dais. "A hull is mostly what is not there."
 *
 * Legend (map-local): '#' spire-wall-hollow, 'F' spire-floor-hollow, 'd' spire-dais; defaults
 * 'j' tannin-water, 'k' boardwalk, 'p' deck-planks; detail 'w' wreck-ribs (32x32), 'x' drowned-tree
 * (32x32), 'y' wreck-post, 'c' crates.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'spire-hollow',
  name: 'Hollow Spire',
  kind: 'interior',
  region: 'drownwood',
  spire: 'hollow',
  w: 20,
  h: 14,
  legend: { '#': 'spire-wall-hollow', F: 'spire-floor-hollow', d: 'spire-dais', w: 'wreck-ribs', x: 'drowned-tree', y: 'wreck-post' },
  ground: [
    '####################', //  0
    '#jjjjjjFFFFFFjjjjjj#', //  1  the bow deck
    '#jjjjjFFddddFFjjjjj#', //  2  Wendel's dais (8-11,2-3)
    '#jjjjjFFddddFFjjjjj#', //  3
    '#jjjjjjjFkkFjjjjjjj#', //  4
    '#jjjjjjjjkkjjjjjjjj#', //  5
    '#jjjkkkkkkkjjjjjjjj#', //  6  the plank walk
    '#jjjkjjjjjjjjjjjjjj#', //  7
    '#jjjkjjjjjjjjjjjjjj#', //  8
    '#jjjkkkkkkkkkkkkjjj#', //  9
    '#jjjjjjjjjjjjjjkjjj#', // 10
    '#FFjjjjjjjkkkkkkjFF#', // 11
    '#FFFFFFFFFFFFFFFFFF#', // 12  the slipway landing
    '##########+#########', // 13
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '..w.............w...', //  2
    '....................', //  3
    '.y...............y..', //  4
    '............x.......', //  5
    '..............w.....', //  6
    '.......x............', //  7
    '.w..........x.......', //  8
    '....................', //  9
    '..x.................', // 10
    '................y...', // 11
    '.c................c.', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'lily-pads', x: 6, y: 10 },
    { art: 'lily-pads', x: 13, y: 7 },
    { art: 'lily-pads', x: 16, y: 4 },
  ],
  entities: [
    { kind: 'prop', id: 'dossier-board', x: 11, y: 12, art: 'commons-board', verb: 'dossier', spire: 'hollow', note: 'east of the door here, so the board does not cut the slipway landing in two' },
    { kind: 'prop', id: 'dossier-board-r', x: 12, y: 12, blocker: true },
    { kind: 'prop', id: 'unfinished-hull', x: 12, y: 1, art: 'boat', verb: 'look', text: 'A hull on the stocks, ribbed and unplanked. You can see straight through it.' },
  ],
  triggers: [
    { x: 11, y: 12, w: 2, h: 1, kind: 'use', id: 'dossier', verb: 'dossier', spire: 'hollow' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'drownwood', x: 24, y: 10, facing: 'down' }, toMarker: 'spire-step', sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'spire-hall': { x: 1, y: 1, w: 18, h: 12 },
    dais: { x: 8, y: 2, w: 4, h: 2 },
    'plank-walk': { x: 4, y: 4, w: 12, h: 8 },
    'bow-deck': { x: 6, y: 1, w: 8, h: 4 },
    slipway: { x: 1, y: 11, w: 18, h: 2 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'spire-hollow-dais': { x: 10, y: 2, facing: 'down', trainer: 'wendel-spire' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-wendel-spire': { x: 10, y: 2, facing: 'down', trainer: 'wendel-spire' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'dossier-front': { x: 10, y: 12, facing: 'right' },
    'leader-dais': { x: 10, y: 2, facing: 'down' },
    'wendel-dais': { x: 10, y: 2, facing: 'down' },
    'challenger-spot': { x: 10, y: 5, facing: 'up' },
    'badge-spot': { x: 10, y: 4, facing: 'up' },
    'walk-turn-east': { x: 15, y: 10, facing: 'up' },
    'walk-turn-west': { x: 4, y: 8, facing: 'up' },
    'hull-bow': { x: 12, y: 2, facing: 'up' },
  },
  music: 'battle_spire',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};

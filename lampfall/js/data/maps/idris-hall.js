/**
 * IDRIS'S HALL (idris-hall), Shardcrown — Champion Idris Fenwake and the Summit Bell (GDD-00 §4, §8;
 * GDD-01 §13.3). [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12) back to the Keepers' Hall
 * (10,1).
 *
 * The top of the atoll. The great windows of the north wall look straight down into the Starfall
 * Lagoon; two reflecting channels of lagoon water run the length of the hall; Idris waits on the dais
 * under the windows, his Vesperay's anchor stone on its pedestal beside him (the anchor-release scene,
 * `idris-anchor-release`, happens here: silence is an answer). The SUMMIT BELL hangs just inside the
 * door (`summit-bell`): after a loss on Drift or Flux it starts you again at whoever beat you.
 *
 * Legend (map-local): '#' cave-wall, 's' wall-stone, ']' window-stone, 'F' floor-stone, 'd' spire-dais;
 * default 'u' lagoon; detail 'B' brazier, 'L' lamp-post.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'idris-hall',
  name: 'Idris\'s Hall',
  kind: 'interior',
  region: 'shardcrown',
  w: 20,
  h: 14,
  legend: { '#': 'cave-wall', s: 'wall-stone', ']': 'window-stone', F: 'floor-stone', d: 'spire-dais', B: 'brazier' },
  ground: [
    '####################', //  0
    '#ss]]]]]ssss]]]]]ss#', //  1  the great windows over the Starfall Lagoon
    '#FFFFFFFddddFFFFFFF#', //  2  the Champion's dais (8-11,2-3)
    '#FFFFFFFddddFFFFFFF#', //  3
    '#FFuuFFFFFFFFFFuuFF#', //  4  the reflecting channels
    '#FFuuFFFFFFFFFFuuFF#', //  5
    '#FFuuFFFFFFFFFFuuFF#', //  6
    '#FFuuFFFFFFFFFFuuFF#', //  7
    '#FFuuFFFFFFFFFFuuFF#', //  8
    '#FFuuFFFFFFFFFFuuFF#', //  9
    '#FFFFFFFFFFFFFFFFFF#', // 10
    '#FFFFFFFFFFFFFFFFFF#', // 11
    '#FFFFFFFFFFFFFFFFFF#', // 12
    '##########@#########', // 13
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '.B................B.', //  2
    '....................', //  3
    '....................', //  4
    '.....L........L.....', //  5
    '....................', //  6
    '....................', //  7
    '.....L........L.....', //  8
    '....................', //  9
    '....................', // 10
    '....................', // 11
    '....................', // 12
    '....................', // 13
  ],
  overlay: null,
  // the Summit Bell is 32x32: hold its right half
  collision: [
    '--------------------', //  0
    '--------------------', //  1
    '--------------------', //  2
    '--------------------', //  3
    '--------------------', //  4
    '--------------------', //  5
    '--------------------', //  6
    '--------------------', //  7
    '--------------------', //  8
    '--------------------', //  9
    '--------------------', // 10
    '-------------##-----', // 11
    '--------------------', // 12
    '--------------------', // 13
  ],
  props: [
    { art: 'summit-seal', x: 10, y: 1, note: 'ART REQUEST summit-seal: the Summit seal set in the sill' },
  ],
  entities: [
    { kind: 'prop', id: 'summit-bell', x: 13, y: 12, art: 'summit-bell', verb: 'summitBell', note: 'the Summit Bell (32x32; collision holds its upper row)' },
    { kind: 'prop', id: 'summit-bell-r', x: 14, y: 12, blocker: true },
    { kind: 'prop', id: 'vesperay-anchor', x: 12, y: 2, art: 'anchor-stone', verb: 'look', cond: { not: { flag: 'sp.idris-beaten' } }, text: 'A Mooring anchor stone on a pedestal, worn smooth. It has held one creature since it hatched.', note: 'ART REQUEST anchor-stone' },
  ],
  triggers: [
    { x: 13, y: 12, w: 2, h: 1, kind: 'use', id: 'summit-bell', verb: 'summitBell', script: 'summit-bell' },
    { x: 3, y: 1, w: 5, h: 1, kind: 'use', id: 'lagoon-window-west', verb: 'look', text: 'Straight down: the Starfall Lagoon, round as a thrown stone. The comet made it.' },
    { x: 13, y: 1, w: 4, h: 1, kind: 'use', id: 'lagoon-window-east', verb: 'look' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'keepers-hall', x: 10, y: 1, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'idris-hall': { x: 1, y: 2, w: 18, h: 11 },
    dais: { x: 8, y: 2, w: 4, h: 2 },
    nave: { x: 5, y: 4, w: 10, h: 7 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'idris-hall-bell': { x: 10, y: 2, facing: 'down', trainer: 'idris-champion' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-idris-champion': { x: 10, y: 2, facing: 'down', trainer: 'idris-champion' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'leader-dais': { x: 10, y: 2, facing: 'down' },
    'idris-dais': { x: 10, y: 2, facing: 'down', trainer: 'idris-champion' },
    'challenger-spot': { x: 10, y: 5, facing: 'up' },
    'bell-restart-idris': { x: 10, y: 5, facing: 'up', note: 'the Summit Bell returns you here when Idris beat you' },
    'summit-bell-front': { x: 12, y: 12, facing: 'right' },
    'vesperay-anchor': { x: 12, y: 2, onSolid: true },
    'anchor-release-idris': { x: 11, y: 3, facing: 'right' },
    'anchor-release-player': { x: 10, y: 4, facing: 'up' },
    'anchor-release-vesperay': { x: 12, y: 3, facing: 'up' },
    'summit-seal': { x: 10, y: 3, facing: 'up' },
    'lagoon-window': { x: 5, y: 2, facing: 'up' },
    'linnet-coda': { x: 7, y: 11, facing: 'up' },
  },
  music: 'summit',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};

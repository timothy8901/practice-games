/**
 * THE MIRROR SPIRE (spire-mirror), Rimeholt — Seraphine Locke, evasion, Mends, true odds (GDD-00 §4;
 * GDD-01 §12.6). [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12); returns to Rimeholt's
 * `spire-step`.
 *
 * An ice cave polished to mirrors. The walls are banked with mirror-ice (walkable, it shows your
 * reflection); four glacier pillars stand down the hall, and the two nearest the dais are where the
 * AFTERIMAGES flicker during the fight (never more than two: evasion caps at +2). Seraphine's dais is
 * at the head of the hall. In the north-east, behind a rail and a wall of ice, is the GALLERY where
 * Idris Fenwake watches (`idris-gallery` script); the player sees him but cannot climb to it.
 *
 * Legend (map-local): '#' spire-wall-mirror, 'F' spire-floor-mirror, 'd' spire-dais, 'g' glacier;
 * defaults '?' mirror-ice, '-' snow; detail '|' rail (fence).
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'spire-mirror',
  name: 'Mirror Spire',
  kind: 'interior',
  region: 'rimeholt',
  spire: 'mirror',
  w: 20,
  h: 14,
  legend: { '#': 'spire-wall-mirror', F: 'spire-floor-mirror', d: 'spire-dais', g: 'glacier' },
  ground: [
    '####################', //  0
    '#g????FFFFFFFF#----#', //  1  the gallery (15-18,1-3) behind the ice wall (14,1-3)
    '#??FFFFFddddFF#----#', //  2  Seraphine's dais (8-11,2-3)
    '#??FFFFFddddFF#----#', //  3
    '#?FFFFFFFFFFFFF----#', //  4  the gallery rail (15-18,4)
    '#??FFFFFFFFFFFFFF??#', //  5
    '#???FFFgFFFFgFFF???#', //  6  the afterimage pillars (7,6) (12,6)
    '#??FFFFFFFFFFFFFF??#', //  7
    '#?FFFFFFFFFFFFFFFF?#', //  8
    '#??FFFgFFFFFFgFFF??#', //  9  pillars (6,9) (13,9)
    '#???FFFFFFFFFFFF???#', // 10
    '#????FFFFFFFFFF????#', // 11
    '#????FFFFFFFFFF????#', // 12
    '##########+#########', // 13
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '....................', //  2
    '....................', //  3
    '...............||||.', //  4
    '....................', //  5
    '....................', //  6
    '....................', //  7
    '....................', //  8
    '....................', //  9
    '....................', // 10
    '....................', // 11
    '....................', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'light-pool', x: 9, y: 7, note: 'the light radius is short in here; the pool marks the hall\'s one lamp' },
  ],
  entities: [
    { kind: 'prop', id: 'dossier-board', x: 7, y: 12, art: 'commons-board', verb: 'dossier', spire: 'mirror' },
    { kind: 'prop', id: 'dossier-board-r', x: 8, y: 12, blocker: true },
    { kind: 'sign', id: 'mends-notice', x: 12, y: 12, art: 'signpost', text: 'Two decoys at most. Three Mends each. The odds you see are the odds. Count first. -S.L.' },
  ],
  triggers: [
    { x: 7, y: 12, w: 2, h: 1, kind: 'use', id: 'dossier', verb: 'dossier', spire: 'mirror' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'rimeholt', x: 16, y: 6, facing: 'down' }, toMarker: 'spire-step', sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'spire-hall': { x: 1, y: 1, w: 13, h: 12 },
    dais: { x: 8, y: 2, w: 4, h: 2 },
    gallery: { x: 15, y: 1, w: 4, h: 3 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'spire-mirror-dais': { x: 10, y: 2, facing: 'down', trainer: 'seraphine-spire' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-seraphine-spire': { x: 10, y: 2, facing: 'down', trainer: 'seraphine-spire' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'dossier-front': { x: 9, y: 12, facing: 'left' },
    'leader-dais': { x: 10, y: 2, facing: 'down' },
    'seraphine-dais': { x: 10, y: 2, facing: 'down' },
    'challenger-spot': { x: 10, y: 5, facing: 'up' },
    'badge-spot': { x: 10, y: 4, facing: 'up' },
    'decoy-1': { x: 7, y: 6, onSolid: true },
    'decoy-2': { x: 12, y: 6, onSolid: true },
    'idris-gallery': { x: 16, y: 2, facing: 'down', apart: true },
    'idris-gallery-rail': { x: 17, y: 3, facing: 'down', apart: true },
    'gallery-look': { x: 14, y: 5, facing: 'up' },
    'reflection': { x: 3, y: 8, facing: 'left' },
  },
  music: 'battle_spire',
  light: { indoor: true, radius: 3 },
  entry: { x: 10, y: 12, facing: 'up' },
};

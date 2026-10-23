/**
 * THE WARD SPIRE (spire-ward), Cairnhold — Osric Penhallow, Wards (GDD-00 §4; GDD-01 §12.2). [DATA-MAPS]
 * 20x14 interior. Door (10,13), arrival (10,12); the door returns to Cairnhold's `spire-step`.
 *
 * A hall of cut granite. Two lattices of standing stones and quarried blocks cross it; each has one gap,
 * and a stone SENTINEL stands in each gap (spires.js: `ward-sentinel-east` Chillnub, then
 * `ward-sentinel-west` Cairnward) to teach the shimmer, the Ward ? badge and the readout before Osric
 * does. The walk zigzags: in at the door, east to the first gap (14,8), west to the second (5,5), and up
 * to Osric's dais in the quarry-cut apse. Gravel alcoves in the corners hold the stonecutter's offcuts.
 *
 * Legend (map-local): '#' spire-wall-ward, 'F' spire-floor-ward, 'd' spire-dais; defaults ':' gravel,
 * 'f' flagstones; detail 'I' standing-stone (16x32), '0' boulder, 'c' crates.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'spire-ward',
  name: 'Ward Spire',
  kind: 'interior',
  region: 'cairnhold',
  spire: 'ward',
  w: 20,
  h: 14,
  legend: { '#': 'spire-wall-ward', F: 'spire-floor-ward', d: 'spire-dais', I: 'standing-stone' },
  ground: [
    '####################', //  0
    '#ff###FFFFFFFF###ff#', //  1  the apse
    '#ff#FFFFddddFFFF#ff#', //  2  Osric's dais (8-11,2-3)
    '#FFFFFFFddddFFFFFFF#', //  3
    '#FFFFFFFFFFFFFFFFFF#', //  4
    '#FFFFFFFFFFFFFFFFFF#', //  5  the upper lattice; gap (5,5)
    '#FFFFFFFFFFFFFFFFFF#', //  6
    '#FFFFFFFFFFFFFFFFFF#', //  7
    '#FFFFFFFFFFFFFFFFFF#', //  8  the lower lattice; gap (14,8)
    '#ff:FFFFFFFFFFFF:ff#', //  9
    '#ff::FFFFFFFFFF::ff#', // 10
    '#FFFFFFFFFFFFFFFFFF#', // 11
    '#FFFFFFFFFFFFFFFFFF#', // 12
    '##########+#########', // 13
  ],
  detail: [
    '....................', //  0
    '.0................0.', //  1
    '....................', //  2
    '....................', //  3
    '....................', //  4
    '.I0I0.I0I0I0I0I0I0I.', //  5
    '....................', //  6
    '....................', //  7
    '.I0I0I0I0I0I0I.I0I0.', //  8
    '.0................0.', //  9
    '....................', // 10
    '.c................c.', // 11
    '....................', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'hex-lattice', x: 10, y: 1, note: 'ART REQUEST hex-lattice: the Ward Seal\'s lattice cut into the apse wall' },
  ],
  entities: [
    { kind: 'prop', id: 'dossier-board', x: 7, y: 12, art: 'commons-board', verb: 'dossier', spire: 'ward' },
    { kind: 'prop', id: 'dossier-board-r', x: 8, y: 12, blocker: true },
    { kind: 'sign', id: 'crackdust-notice', x: 12, y: 12, art: 'signpost', text: 'Crackdust at the clinic, 300. Read the shimmer first. -O.P.' },
  ],
  triggers: [
    { x: 7, y: 12, w: 2, h: 1, kind: 'use', id: 'dossier', verb: 'dossier', spire: 'ward' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'cairnhold', x: 40, y: 17, facing: 'down' }, toMarker: 'spire-step', sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'spire-hall': { x: 1, y: 1, w: 18, h: 12 },
    dais: { x: 8, y: 2, w: 4, h: 2 },
    'lower-court': { x: 1, y: 9, w: 18, h: 4 },
    'middle-court': { x: 1, y: 6, w: 18, h: 2 },
    'upper-court': { x: 1, y: 1, w: 18, h: 4 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'spire-ward-dais': { x: 10, y: 2, facing: 'down', trainer: 'osric-spire' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-osric-spire': { x: 10, y: 2, facing: 'down', trainer: 'osric-spire' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'dossier-front': { x: 9, y: 12, facing: 'left' },
    'sentinel-east': { x: 14, y: 8, facing: 'down', trainer: 'ward-sentinel-east' },
    'sentinel-east-challenger': { x: 14, y: 10, facing: 'up' },
    'sentinel-west': { x: 5, y: 5, facing: 'down', trainer: 'ward-sentinel-west' },
    'sentinel-west-challenger': { x: 5, y: 7, facing: 'up' },
    'leader-dais': { x: 10, y: 2, facing: 'down' },
    'osric-dais': { x: 10, y: 2, facing: 'down' },
    'challenger-spot': { x: 10, y: 4, facing: 'up' },
    'badge-spot': { x: 10, y: 4, facing: 'up' },
    'offcuts-west': { x: 2, y: 2, facing: 'down' },
    'offcuts-east': { x: 17, y: 2, facing: 'down' },
  },
  music: 'battle_spire',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};

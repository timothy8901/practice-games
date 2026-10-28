/**
 * THE LANTERN STACK (lantern-stack) — the Engine, the Reading, the Passenger's perch (GDD-00 §2, §4,
 * §11; GDD-01 §13.4). [DATA-MAPS] 20x16, a self-contained stack top open to the sky: `kind: 'exterior'`
 * with `light.indoor: false`, so it takes the day/night grade, the Skyband and the world mix (MID-17:
 * the finale at 23:00 is night up here, not the fixed lamp-lit interior grade). Door (10,15), arrival
 * (10,14) at the head of the cut stair; the stair foot returns to the Bar's `lantern-stack-step` on
 * the spur.
 *
 * A sea stack under the comet's road, seen from the Lamp Room all game: a turf-and-heather top inside a
 * rim of cliff, sea on every side, shingle where the spray lands, a basalt spur at the north edge that
 * the Passenger perches on after the Reading. Act III (`sp.two-plans`): Merrow's SINKING ENGINE stands
 * in the middle (story battle `merrow-engine`) while Varga's three charges sit on the rim for Linnet
 * and Wick to pull (`sp.charges-pulled`); both are gone after the Relighting. The finale (`the-crossing`,
 * `the-reading`): the shore party gathers at the south of the top, the Passenger comes down in the
 * middle, seven phases. Post-game the Passenger sits on the perch, catchable (table
 * `lantern-stack-perch`, cut-order 4).
 *
 * Legend: defaults ('D' deep-water, 'S' shallows, 'C' cliff, 'q' shingle, 'G' grass, 'n' heather,
 * 'H' steps, '~' tidepool; detail 'o' rock, '0' boulder); map-local 'X' sea-stack (32x48, the perch).
 * @type {import('../index.js').MapDef}
 */
const engine = { all: [{ flag: 'sp.two-plans' }, { not: { flag: 'sp.relighting' } }] };
const charges = { all: [{ flag: 'sp.two-plans' }, { not: { flag: 'sp.charges-pulled' } }, { not: { flag: 'sp.relighting' } }] };
const perched = { all: [{ flag: 'sp.reading-done' }, { not: { flag: 'sp.passenger-caught' } }] };

export default {
  id: 'lantern-stack',
  name: 'The Lantern Stack',
  kind: 'exterior',
  region: 'the-bar',
  // open to the sky: day/night grading and the full world mix (audio/director reads light.indoor)
  light: { indoor: false, ambient: 'sea' },
  w: 20,
  h: 16,
  legend: { X: 'sea-stack' },
  ground: [
    'DDDDDDDDDDDDDDDDDDDD', //  0
    'DDDDDDSSSSSSSSDDDDDD', //  1
    'DDDDSSCCCCCCCCSSDDDD', //  2
    'DDDSCCqqqqqqqqCCSDDD', //  3  the perch spur (9-10,3-4)
    'DDSCqqnnGGGGnnqqCSDD', //  4
    'DDSCqnnGGGGGGGnnqCSD', //  5
    'DSCqqnGGGGGGGGGnqqCS', //  6
    'DSCqnnGGGGGGGGGGnqCS', //  7
    'DSCqnGGGGGGGGGGGnqCS', //  8  the middle: Engine / the Reading
    'DSCqnnGGGGGGGGGnnqCS', //  9
    'DSCq~nnGGGGGGGGnnqCS', // 10
    'DDSCqqnnGGGGGnnqqCSD', // 11
    'DDSCCqqqqGGqqqqCCSDD', // 12  the shore party's ledge
    'DDDSCCCCqqHqCCCCSDDD', // 13  the stair cut down the south face (10,13-15)
    'DDDDSSSCCCHCCSSSDDDD', // 14
    'DDDDDDSSSSHSDDDDDDDD', // 15  the stair foot: the door (10,15)
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '....................', //  2
    '.........X..........', //  3  the perch (9,3), 32x48
    '.....0........o.....', //  4
    '....................', //  5
    '....o...........o...', //  6
    '....................', //  7
    '....................', //  8
    '.....0..............', //  9
    '................o...', // 10
    '....................', // 11
    '....................', // 12
    '....................', // 13
    '....................', // 14
    '....................', // 15
  ],
  overlay: null,
  // the perch is a 32x48 stack: hold its footprint
  collision: [
    '--------------------', //  0
    '--------------------', //  1
    '---------##---------', //  2
    '----------#---------', //  3
    '--------------------', //  4
    '--------------------', //  5
    '--------------------', //  6
    '--------------------', //  7
    '--------------------', //  8
    '--------------------', //  9
    '--------------------', // 10
    '--------------------', // 11
    '--------------------', // 12
    '--------------------', // 13
    '--------------------', // 14
    '--------------------', // 15
  ],
  props: [
    { art: 'skyglass', x: 8, y: 4, note: 'comet glass round the perch (glows magenta)' },
    { art: 'skyglass', x: 11, y: 4 },
    { art: 'skyglass', x: 6, y: 5 },
    { art: 'skyglass', x: 13, y: 6 },
  ],
  entities: [
    { kind: 'prop', id: 'sinking-engine', x: 9, y: 8, art: 'sinking-engine', verb: 'look', cond: engine, note: 'ART REQUEST sinking-engine (32x32): Merrow\'s Engine, Act III' },
    { kind: 'prop', id: 'sinking-engine-1', x: 10, y: 8, blocker: true, cond: engine },
    { kind: 'prop', id: 'sinking-engine-2', x: 9, y: 7, blocker: true, cond: engine },
    { kind: 'prop', id: 'sinking-engine-3', x: 10, y: 7, blocker: true, cond: engine },
    { kind: 'prop', id: 'scatter-charge-1', x: 5, y: 7, art: 'scatter-charge', verb: 'look', cond: charges, note: 'ART REQUEST scatter-charge: Varga\'s charges on the rim' },
    { kind: 'prop', id: 'scatter-charge-2', x: 15, y: 6, art: 'scatter-charge', verb: 'look', cond: charges },
    { kind: 'prop', id: 'scatter-charge-3', x: 14, y: 11, art: 'scatter-charge', verb: 'look', cond: charges },
    { kind: 'roamer', id: 'the-passenger', x: 10, y: 5, speciesId: 'vagary', static: true, table: 'lantern-stack-perch', cond: perched, note: 'post-game: perched and catchable (cut-order 4)' },
  ],
  triggers: [
    { x: 9, y: 3, w: 2, h: 1, kind: 'use', id: 'perch', verb: 'look', text: 'A spur of black rock, glassy at the top, as if something heavy and bright has sat there.' },
    { x: 10, y: 13, kind: 'use', id: 'lamp-view', verb: 'look', text: 'South, across the water: the point, the cottage, and the lighthouse.' },
  ],
  warps: [{ x: 10, y: 15, kind: 'door', to: { mapId: 'the-bar', x: 29, y: 2, facing: 'down' }, toMarker: 'lantern-stack-step', via: 'the-bar', sfx: null }],
  spawns: [
    { area: { x: 9, y: 4, w: 3, h: 2 }, table: 'lantern-stack-perch', rate: 0, via: 'perch', cond: perched, note: 'never stepped: the perched Passenger (roamer `the-passenger`) uses this table' },
  ],
  regions: {
    'stack-top': { x: 4, y: 4, w: 13, h: 9 },
    'engine-ring': { x: 7, y: 6, w: 6, h: 5 },
    'reading-ground': { x: 7, y: 5, w: 6, h: 6 },
    'shore-ledge': { x: 5, y: 11, w: 11, h: 2 },
    'the-perch': { x: 8, y: 3, w: 4, h: 3 },
    'stair-head': { x: 9, y: 12, w: 3, h: 3 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'lantern-stack-engine': { x: 8, y: 9, facing: 'right', trainer: 'merrow-engine' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-merrow-engine': { x: 8, y: 9, facing: 'right', trainer: 'merrow-engine' },
    'from-door': { x: 10, y: 14, facing: 'up' },
    'door-front': { x: 10, y: 14, facing: 'down' },
    'stair-head': { x: 10, y: 12, facing: 'up' },
    'crossing-arrival': { x: 10, y: 12, facing: 'up' },
    'lamp-view': { x: 10, y: 12, facing: 'down' },
    // Act III: two plans, one night
    'engine': { x: 9, y: 8, onSolid: true },
    'merrow-engine': { x: 8, y: 9, facing: 'right' },
    'engine-player': { x: 10, y: 10, facing: 'up' },
    'merrow-halts': { x: 11, y: 9, facing: 'left' },
    'charge-1': { x: 5, y: 7, onSolid: true },
    'charge-2': { x: 15, y: 6, onSolid: true },
    'charge-3': { x: 14, y: 11, onSolid: true },
    'linnet-charges': { x: 6, y: 7, facing: 'left' },
    'wick-charges': { x: 14, y: 6, facing: 'right' },
    'varga-stack': { x: 12, y: 10, facing: 'up' },
    // the finale: the crossing and the Reading
    'reading-player': { x: 10, y: 9, facing: 'up' },
    'reading-passenger': { x: 10, y: 6, facing: 'down' },
    'reading-corin': { x: 8, y: 11, facing: 'up' },
    'reading-wick': { x: 11, y: 11, facing: 'up' },
    'reading-linnet': { x: 7, y: 10, facing: 'up' },
    'reading-merrow': { x: 6, y: 11, facing: 'up' },
    'reading-varga': { x: 14, y: 10, facing: 'up' },
    'reading-idris': { x: 13, y: 11, facing: 'up' },
    // post-game
    'passenger-perch': { x: 9, y: 3, onSolid: true },
    'passenger-perched': { x: 10, y: 5, facing: 'down', onSolid: true, note: 'the roamer stands here' },
    'perch-front': { x: 10, y: 6, facing: 'up' },
  },
  music: null,
  entry: { x: 10, y: 14, facing: 'up' },
};

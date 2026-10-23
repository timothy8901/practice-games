/**
 * Fixture exterior map: a 16x10 harbor with deep water, shallows, a pier (detail over water), a
 * causeway to the east edge, bioluminescent flats, a cliff, a cottage with a door warp, a lamp
 * prop, a porch light gated by a flag and a collision override layer. Legend per tiles.fixture.js.
 */
//           0123456789012345
export default Object.freeze({
  id: 'harbor',
  name: 'The Harbor',
  kind: 'exterior',
  region: 'town',
  w: 16,
  h: 10,
  legend: { '=': 'cobbles' },
  ground: [
    'DDDDDDDDDDDDDDDD', // 0
    'DDDDSSSSSSSSSDDD', // 1
    'DDSSAAAAAAAAASDD', // 2
    'DSAAAA====AAAASD', // 3
    'DSAAGGOOOOGGAAEE', // 4  causeway E at 14,15
    'SAAGGGPPPPGGGAAS', // 5
    'WWGGGGPGGGGGGCCA', // 6  wet sand floods at 0,1; cliff at 13,14
    'GGHHHGPTTGGGGCCG', // 7  cottage walls 2..4
    'GGHdHGPGGGMMMMGG', // 8  door at 3; glow mud 10..13
    'GGGGGGPGGGMMMMGG', // 9
  ],
  detail: [
    '.........K......', // pier at 9,0 over deep
    '...Y.....K......', // slipway (high-tide only) at 3,1; pier at 9,1 over shallows
    '................',
    '.....l...r.k....', // lamp 5,3; rune 9,3; rock 11,3
    '................',
    '................',
    '................',
    '................',
    '.....p..........', // porch light at 5,8 (flag np.wren.home)
    '................',
  ],
  overlay: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '............c...', // tree crown over grass at 12,6: visual only
    '............c...',
    '................',
    '................',
  ],
  collision: [
    '----------------',
    '----------------',
    '----------------',
    '----------------',
    '-L--------------', // 1,4: shallows wadeable at low tide
    '.---------------', // 0,5: hidden ford through the shallows
    '----------------',
    '----------------',
    '----------------',
    '#---------------', // 0,9: invisible wall on grass
  ],
  props: [
    { art: 'lamp', x: 7, y: 3 },
    { art: 'lighthouse', x: 0, y: 0 },
    { art: 'porch-light', x: 11, y: 7, cond: { flag: 'sp.inn-open' } },
  ],
  entities: [
    { kind: 'npc', id: 'wren', x: 5, y: 7 },
    { kind: 'sign', id: 'quay-sign', x: 7, y: 5, text: 'Quay. Mind the tide.' },
  ],
  triggers: [
    { x: 6, y: 5, kind: 'use', id: 'mailbox', verb: 'mailbox' },
    { x: 6, y: 6, w: 2, h: 2, kind: 'enter', id: 'green-enter', once: true },
    { x: 6, y: 6, kind: 'step', id: 'first-step', script: 'arrival' },
  ],
  warps: [
    { x: 3, y: 8, to: { mapId: 'cottage', x: 2, y: 3, facing: 'up' }, kind: 'door', sfx: 'doorOpen' },
    { x: 15, y: 4, to: { mapId: 'flats', x: 0, y: 4 }, kind: 'edge', cond: { tide: ['low'] } },
    { x: 8, y: 3, to: { mapId: 'cellar', x: 1, y: 1 }, kind: 'stairs', cond: { flag: 'sp.cellar-key' } },
    { x: 0, y: 5, to: { mapId: 'sea-cave', x: 4, y: 4, facing: 'left' }, kind: 'edge', cond: { all: [{ lowTide: true }, { flag: 'sp.cave-found' }] } },
  ],
  spawns: [
    { area: 'grass', table: 'town-grass', rate: 0.08 },
    { area: { x: 4, y: 1, w: 5, h: 1 }, table: 'quay-shallows', rate: 0.05 },
    { area: 'water', table: 'open-sea', rate: 0.02 },
  ],
  regions: {
    porch: { x: 2, y: 9, w: 3, h: 1 },
    quay: { x: 6, y: 3, w: 4, h: 2 },
    town: { x: 0, y: 2, w: 16, h: 8 },
  },
  entry: { x: 6, y: 5, facing: 'up' },
});

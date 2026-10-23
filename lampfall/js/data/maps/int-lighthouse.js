/**
 * PELL POINT LIGHT: the stair and the Lamp Room (int-lighthouse) (GDD-00 §2, §4, §11; GDD-01 §11.6).
 * [DATA-MAPS] 12x18 interior, three levels stacked bottom to top. Door (6,17), arrival (6,16); the door
 * returns to (4,19) below the lighthouse door in Pellwick.
 *
 *  - THE FOOT (rows 12-16): Isolde's desk and tide log, the empty oil cans of the Ebb winter, the
 *    keeper's coat on its hook, the stair foot at (8,12). The keeper's stair trapdoor (10,13) opens
 *    when the Lamp Room is built (`sys.build.lamp-room`): a tunnel under the flagstone walk to the
 *    cottage's hearth room (int-cottage `lamp-room` tier, (9,10)).
 *  - THE STAIR (rows 6-10): a spiral of steps around the solid newel; one rotten tread is replaced per
 *    loan cleared (decorative props, never a wall: the Lamp Room is open to climb all game).
 *  - THE LAMP ROOM (rows 2-4) through the hatch at (3,5): the great lens, dark for thirty years, at
 *    (5,4) (32x32, its footprint held by `collision`); glazing all round; the north pane looks out at
 *    the Lantern Stack ("visible from the Lamp Room all game"). Before loan 7's build the glass is
 *    cracked and a tarpaulin flaps; after it the brass shines. The Relighting happens at the lens.
 *
 * Legend (map-local): '#' lighthouse-wall, ']' porthole (glazing), 'R' lamp-room-floor, 'F' floor-stone,
 * 'H' steps, 'v' stairs-down (the trapdoor); detail 'L' lens, 'T' table, 's' shelf, '(' barrel,
 * 'c' crates.
 * @type {import('../index.js').MapDef}
 */
const built = { flag: 'sys.build.lamp-room' };
const rotten = (n, x, y) => ({ art: 'rotten-tread', x, y, cond: { loan: { tier: { lte: n } } }, n });

export default {
  id: 'int-lighthouse',
  name: 'Lighthouse Stair and Lamp Room',
  kind: 'interior',
  region: 'pellwick',
  w: 12,
  h: 18,
  legend: { '#': 'lighthouse-wall', ']': 'porthole', R: 'lamp-room-floor', F: 'floor-stone', v: 'stairs-down', L: 'lens', T: 'table', s: 'shelf' },
  ground: [
    '############', //  0
    '##]]]]]]]]##', //  1  the glazing; the north panes (5-6,1) face the Lantern Stack
    '##RRRRRRRR##', //  2  THE LAMP ROOM
    '#RRRRRRRRRR#', //  3
    '#RRRRRRRRRR#', //  4  the lens (5,4)
    '###H########', //  5  the hatch (3,5)
    '##HHHHHHHH##', //  6  THE STAIR, round the newel
    '##HH####HH##', //  7
    '##HH####HH##', //  8
    '##HH####HH##', //  9
    '##HHHHHHHH##', // 10
    '#]######H###', // 11  a porthole on the stair (1,11); the stair foot opening (8,11)
    '#FFFFFFFFFF#', // 12  THE FOOT
    '#FFFFFFFFFv#', // 13  the keeper's stair trapdoor (10,13)
    '#FFFFFFFFFF#', // 14
    '#FFFFFFFFFF#', // 15
    '#FFFFFFFFFF#', // 16
    '######+#####', // 17
  ],
  detail: [
    '............', //  0
    '............', //  1
    '............', //  2
    '............', //  3
    '.....L......', //  4
    '............', //  5
    '............', //  6
    '............', //  7
    '............', //  8
    '............', //  9
    '............', // 10
    '............', // 11
    '.........((.', // 12  empty oil cans
    '..T.........', // 13  Isolde's desk
    '............', // 14
    '.s........(.', // 15  the log shelf
    '.c........c.', // 16
    '............', // 17
  ],
  overlay: null,
  // the lens is 32x32: hold its whole footprint
  collision: [
    '------------', //  0
    '------------', //  1
    '------------', //  2
    '-----##-----', //  3
    '------#-----', //  4
    '------------', //  5
    '------------', //  6
    '------------', //  7
    '------------', //  8
    '------------', //  9
    '------------', // 10
    '------------', // 11
    '------------', // 12
    '------------', // 13
    '------------', // 14
    '------------', // 15
    '------------', // 16
    '------------', // 17
  ],
  props: [
    { art: 'stair-spiral', x: 5, y: 9, note: 'the newel and the turn of the stair, drawn over the solid core' },
    rotten(1, 8, 10), rotten(2, 9, 8), rotten(3, 8, 6), rotten(4, 5, 6), rotten(5, 2, 7), rotten(6, 3, 10),
    { art: 'lamp-room-tarp', x: 8, y: 1, cond: { not: built }, note: 'ART REQUEST lamp-room-tarp: cracked panes and a flapping tarpaulin before loan 7\'s build' },
    { art: 'lamp-room-tarp', x: 3, y: 1, cond: { not: built } },
    { art: 'oil-reservoir', x: 8, y: 3, cond: built, note: 'ART REQUEST oil-reservoir: the brass reservoir, filled for the Relighting' },
    { art: 'keepers-coat', x: 4, y: 11, note: 'ART REQUEST keepers-coat: Isolde\'s coat on its hook (CLOTHES_IDS keepers-coat)' },
    { art: 'tide-log', x: 2, y: 13, note: 'ART REQUEST tide-log: Isolde\'s tide log, open on the desk' },
  ],
  entities: [
    { kind: 'prop', id: 'trapdoor-cover', x: 10, y: 13, art: 'trapdoor', verb: 'look', cond: { not: built }, text: 'A flagstone with an iron ring. It will not lift.', note: 'ART REQUEST trapdoor' },
  ],
  triggers: [
    { x: 5, y: 4, kind: 'use', id: 'lens', verb: 'look', note: 'the Relighting is staged here (GDD-07)' },
    { x: 5, y: 1, w: 2, h: 1, kind: 'use', id: 'lantern-stack-window', verb: 'look', text: 'Out past the point, a sea stack stands alone under the comet\'s road. The Lantern Stack.' },
    { x: 2, y: 13, kind: 'use', id: 'isolde-desk', verb: 'look' },
    { x: 9, y: 12, w: 2, h: 1, kind: 'use', id: 'oil-cans', verb: 'look', text: 'Oil cans. Empty, every one. The last went into the lamp thirty years ago.' },
    { x: 1, y: 11, kind: 'use', id: 'stair-porthole', verb: 'look' },
  ],
  warps: [
    { x: 6, y: 17, kind: 'door', to: { mapId: 'pellwick', x: 4, y: 19, facing: 'down' }, sfx: 'doorOpen' },
    { x: 10, y: 13, kind: 'stairs', to: { mapId: 'int-cottage', x: 9, y: 10, facing: 'left' }, via: 'keepers-stair', cond: built, sfx: 'doorOpen', note: 'the keeper\'s stair: tunnel to the cottage (Lamp Room access)' },
  ],
  spawns: [],
  regions: {
    'the-foot': { x: 1, y: 12, w: 10, h: 5 },
    'the-stair': { x: 2, y: 6, w: 8, h: 5 },
    'lamp-room': { x: 1, y: 2, w: 10, h: 3 },
    'lens-ring': { x: 4, y: 2, w: 4, h: 3 },
  },
  markers: {
    'from-door': { x: 6, y: 16, facing: 'up' },
    'door-front': { x: 6, y: 16, facing: 'down' },
    'isolde-desk-front': { x: 3, y: 13, facing: 'left' },
    'oil-cans-front': { x: 9, y: 13, facing: 'up' },
    'stair-foot': { x: 8, y: 12, facing: 'up' },
    'stair-landing': { x: 2, y: 8, facing: 'up' },
    'stair-top': { x: 3, y: 6, facing: 'up' },
    'lamp-room-hatch': { x: 3, y: 4, facing: 'down' },
    'lantern-stack-view': { x: 6, y: 2, facing: 'up' },
    'relight-player': { x: 4, y: 4, facing: 'right' },
    'relight-wick': { x: 7, y: 4, facing: 'left' },
    'relight-lens': { x: 5, y: 4, onSolid: true },
    'ambrose-lamp-room': { x: 8, y: 2, facing: 'left' },
    'credits-lamp-room': { x: 6, y: 2, facing: 'down' },
    'keepers-stair': { x: 10, y: 13 },
    'keepers-stair-arrival': { x: 9, y: 13, facing: 'right' },
    'ambrose-foot': { x: 5, y: 14, facing: 'up' },
  },
  music: null,
  light: { indoor: true },
  entry: { x: 6, y: 16, facing: 'up' },
};

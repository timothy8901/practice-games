/**
 * BARNABY'S ARCHIVE (int-archive) — 09:00-19:00 (GDD-00 §9, §10, §11; GDD-01 §11.4). [DATA-MAPS]
 * 16x12 interior. Door (8,11), arrival (8,10); the door returns to the porch step (32,20) in Pellwick.
 *
 * The STRING WALL fills the back wall's west half (each find Barnaby pins unlocks its town letter; the
 * last string ties the weir records, Isolde's letters and the lamp). Beside it the FIELD LOG plates.
 * Barnaby's desk by the door (identify finds in one batch, buy duplicates, Memory relearn); his diving
 * helmet home by the front PORTHOLE at (10,11) (the porthole the town sees at (34,19), which he fogs
 * from inside); after the bell dig he moves into the fleet's bell and the helmet becomes "Exhibit 1:
 * My Old House". The Shiftlog board, fish tanks, bug cases and the fossil/relic shelves line the
 * walls; Corin's reading desk (Recall, from badge 4) faces the plates; CORIN'S LOFT is the raised
 * platform in the north-east corner behind a railing, up the stair at (12,5): his desk, his bed, his
 * books, the perch for his Tossup. Odile's canvases hang here when Twelve Lights is done.
 *
 * Legend (map-local): '#' int-wall-top, 'W' int-wall, 'F' floor-boards, 'p' deck-planks (the loft),
 * 'Z' string-wall, 'o' porthole, 'u' stairs-up; detail 's' shelf, 'K' counter, 'T' table, 'b' bed,
 * '|' railing (fence), 'r' rug.
 * @type {import('../index.js').MapDef}
 */
const bellDug = { flag: 'sp.bell-dug' };

export default {
  id: 'int-archive',
  name: 'Barnaby\'s Archive',
  kind: 'interior',
  region: 'pellwick',
  w: 16,
  h: 12,
  legend: { '#': 'int-wall-top', W: 'int-wall', F: 'floor-boards', Z: 'string-wall', o: 'porthole', u: 'stairs-up', s: 'shelf', K: 'counter', T: 'table', b: 'bed', r: 'rug' },
  ground: [
    '################', //  0
    '#ZZZZZWWWWWWWsW#', //  1  the string wall (1-5,1); Field Log plates (6-10,1); Corin's books (13,1)
    '#FFFFFFFFFFpppp#', //  2  the loft (12-14,2-4) behind its railing (11,2-5)
    '#FFFFFFFFFFpppp#', //  3
    '#FFFFFFFFFFpppp#', //  4
    '#FFFFFFFFFFFupp#', //  5  the loft stair (12,5)
    '#FFFFFFFFFFFFFF#', //  6
    '#FFFFFFFFFFFFFF#', //  7
    '#FFFFFFFFFFFFFF#', //  8
    '#FFFFFFFFFFFFFF#', //  9
    '#FFFFFFFFFFFFFF#', // 10
    '########+#o#####', // 11  the door (8,11); the porthole (10,11)
  ],
  detail: [
    '................', //  0
    '................', //  1
    '...........|T.b.', //  2  railing; Corin's desk (12,2); his bed (14,2)
    '...........|....', //  3
    '........T..|....', //  4  Corin's reading desk (8,4)
    '...........|.||.', //  5
    '.s..............', //  6  fossil and relic shelves
    '.s..............', //  7
    '....KKK.........', //  8  Barnaby's desk
    '.s......r.......', //  9
    '........r.......', // 10
    '................', // 11
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'field-log-plates', x: 7, y: 1, note: 'ART REQUEST field-log-plates: the 42 plates, filled as forms are logged' },
    { art: 'field-log-plates', x: 9, y: 1 },
    { art: 'diving-helmet', x: 6, y: 4, cond: bellDug, note: 'Exhibit 1: My Old House (after the bell dig)' },
    { art: 'canvas-frame', x: 2, y: 10, cond: { thread: { id: 'twelve-lights', done: true } }, note: 'Odile\'s twelve canvases hang here when Twelve Lights is done' },
    { art: 'canvas-frame', x: 3, y: 10, cond: { thread: { id: 'twelve-lights', done: true } } },
    { art: 'canvas-frame', x: 4, y: 10, cond: { thread: { id: 'twelve-lights', done: true } } },
  ],
  entities: [
    { kind: 'prop', id: 'diving-helmet', x: 12, y: 10, art: 'diving-helmet', verb: 'look', cond: { not: bellDug }, text: 'A brass diving helmet. Somebody lives in it. The faceplate is fogged.', note: 'ART REQUEST diving-helmet: Barnaby\'s home' },
    { kind: 'prop', id: 'fleet-bell', x: 12, y: 10, art: 'fleet-bell', verb: 'look', cond: bellDug, text: 'The fleet\'s bell, up from the Old Quay. Somebody lives in it now.', note: 'ART REQUEST fleet-bell' },
    { kind: 'prop', id: 'shiftlog-wall', x: 1, y: 4, art: 'tide-chalkboard', verb: 'shiftlog', note: 'the Shiftlog wall: every strip you have read, pinned by date' },
    { kind: 'prop', id: 'fish-tank-1', x: 14, y: 7, art: 'fish-tank', verb: 'look', note: 'ART REQUEST fish-tank: the Field Log\'s fish' },
    { kind: 'prop', id: 'fish-tank-2', x: 14, y: 8, art: 'fish-tank', verb: 'look' },
    { kind: 'prop', id: 'bug-case', x: 14, y: 9, art: 'bug-case', verb: 'look', note: 'ART REQUEST bug-case' },
    { kind: 'prop', id: 'tossup-perch', x: 14, y: 4, art: 'perch', verb: 'look', note: 'ART REQUEST perch: Corin\'s Tossup sleeps here' },
  ],
  triggers: [
    { x: 1, y: 1, w: 5, h: 1, kind: 'use', id: 'string-wall', verb: 'stringWall' },
    { x: 6, y: 1, w: 5, h: 1, kind: 'use', id: 'field-log-plates', verb: 'fieldLog' },
    { x: 4, y: 8, kind: 'use', id: 'archive-desk-relearn', verb: 'relearn' },
    { x: 5, y: 8, w: 2, h: 1, kind: 'use', id: 'archive-desk', verb: 'shop', shop: 'archive-desk' },
    { x: 8, y: 4, kind: 'use', id: 'recall-desk', verb: 'recall', cond: { badge: 'hollow' } },
    { x: 1, y: 4, kind: 'use', id: 'shiftlog-wall', verb: 'shiftlog' },
    { x: 10, y: 11, kind: 'use', id: 'porthole', verb: 'look' },
    { x: 1, y: 6, w: 1, h: 2, kind: 'use', id: 'find-shelves', verb: 'look' },
    { x: 14, y: 7, w: 1, h: 3, kind: 'use', id: 'tanks-and-cases', verb: 'look' },
  ],
  warps: [{ x: 8, y: 11, kind: 'door', to: { mapId: 'pellwick', x: 32, y: 20, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'archive-floor': { x: 1, y: 2, w: 10, h: 9 },
    'string-wall': { x: 1, y: 2, w: 5, h: 2 },
    'corin-loft': { x: 12, y: 2, w: 3, h: 3 },
    'barnaby-corner': { x: 9, y: 9, w: 5, h: 2 },
  },
  markers: {
    'from-door': { x: 8, y: 10, facing: 'up' },
    'door-front': { x: 8, y: 10, facing: 'down' },
    'barnaby-desk': { x: 5, y: 7, facing: 'down' },
    'archive-desk-front': { x: 5, y: 9, facing: 'up' },
    'barnaby-porthole': { x: 10, y: 10, facing: 'down' },
    'barnaby-helmet': { x: 12, y: 10, onSolid: true },
    'barnaby-helmet-front': { x: 11, y: 10, facing: 'right' },
    'barnaby-string-wall': { x: 2, y: 2, facing: 'up' },
    'string-wall-front': { x: 3, y: 2, facing: 'up' },
    'field-log-front': { x: 8, y: 2, facing: 'up' },
    'shiftlog-front': { x: 1, y: 5, facing: 'up' },
    'corin-desk': { x: 8, y: 3, facing: 'down' },
    'recall-front': { x: 8, y: 5, facing: 'up' },
    'corin-loft-stair': { x: 12, y: 6, facing: 'up' },
    'corin-loft': { x: 13, y: 3, facing: 'down' },
    'corin-loft-desk': { x: 12, y: 3, facing: 'up' },
    'corin-loft-bed': { x: 14, y: 3, facing: 'up' },
    'corin-loft-rail': { x: 12, y: 4, facing: 'left' },
    'fish-tanks-front': { x: 13, y: 8, facing: 'right' },
    'finds-shelves-front': { x: 2, y: 7, facing: 'left' },
    'odile-gallery': { x: 3, y: 9, facing: 'down' },
    'bell-exhibit': { x: 12, y: 10, onSolid: true },
    'barnaby-bell-home': { x: 11, y: 10, facing: 'right' },
    'helmet-exhibit': { x: 6, y: 5, facing: 'up' },
    'reader-1': { x: 3, y: 5, facing: 'up' },
    'reader-2': { x: 10, y: 7, facing: 'left' },
  },
  music: null,
  light: { indoor: true },
  entry: { x: 8, y: 10, facing: 'up' },
};

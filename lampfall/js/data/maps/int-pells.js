/**
 * PELL'S SUNDRIES (int-pells) — Juniper's shop, 08:00-22:00 (GDD-00 §9, §11; GDD-01 §11.2). [DATA-MAPS]
 * 14x10 interior. Door (7,9), arrival (7,8); the door returns to the porch step (24,20) in Pellwick.
 *
 * Staples in the wall shelves and the two island shelves (never randomized), the disc case (two discs
 * a day), the Wanted Today chalkboard by the counter, and Juniper's counter across the east side.
 * Behind it, through a curtain, the BACK ROOM: the heirloom shelves (family letters send them home)
 * and, on the high shelf, Isolde's Lantern, "for whoever comes" (gone from the shelf after the
 * Relighting). The back room and the space behind the counter are staff-only (markers `staff: true`).
 *
 * Legend (map-local): '#' int-wall-top, 'W' int-wall, 'F' floor-boards; detail 's' shelf,
 * 'K' counter, 'T' table, '(' barrel, 'c' crates, 'r' rug.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'int-pells',
  name: 'Pell\'s Sundries',
  kind: 'interior',
  region: 'pellwick',
  w: 14,
  h: 10,
  legend: { '#': 'int-wall-top', W: 'int-wall', F: 'floor-boards', s: 'shelf', K: 'counter', T: 'table', r: 'rug' },
  ground: [
    '##############', // 0
    '#WsWsWsWW#WsW#', // 1  staple shelves set into the wall; the back room's high shelf (11,1)
    '#FFFFFFFF#FFF#', // 2
    '#FFFFFFFF#FFF#', // 3
    '#FFFFFFFF#WFW#', // 4  the curtain (11,4)
    '#FFFFFFFFFFFF#', // 5
    '#FFFFFFFFFFFF#', // 6
    '#FFFFFFFFFFFF#', // 7
    '#FFFFFFFFFFFF#', // 8
    '#######+######', // 9
  ],
  detail: [
    '..............', // 0
    '..............', // 1
    '..........T...', // 2  Juniper's credit ledger table (back room)
    '.ss..ss...s.s.', // 3  island shelves; heirloom shelves
    '..............', // 4
    '.(.......K....', // 5  counter end
    '.(.......KKKK.', // 6  the counter
    '.c....r.......', // 7
    '.c....r.......', // 8
    '..............', // 9
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'shop-sign', x: 8, y: 1, note: 'PELL\'S SUNDRIES, painted on the wall over the till' },
    { art: 'isolde-lantern', x: 11, y: 1, cond: { not: { flag: 'sp.relighting' } }, note: 'ART REQUEST isolde-lantern: on the high shelf until the Relighting' },
    { art: 'heirloom-shelf', x: 10, y: 3, note: 'ART REQUEST heirloom-shelf: the Dorrows\' kettle, the Bracks\' Still Knot, a grade-two lantern...' },
    { art: 'heirloom-shelf', x: 12, y: 3 },
  ],
  entities: [
    { kind: 'prop', id: 'disc-case', x: 4, y: 6, art: 'display-case', verb: 'discs', shop: 'pells-sundries', note: 'ART REQUEST display-case; two technique discs a day' },
    { kind: 'prop', id: 'wanted-today', x: 12, y: 8, art: 'tide-chalkboard', verb: 'wantedToday', note: 'Wanted Today: three items at +50%' },
  ],
  triggers: [
    { x: 9, y: 6, w: 4, h: 1, kind: 'use', id: 'pells-counter', verb: 'shop', shop: 'pells-sundries' },
    { x: 9, y: 5, kind: 'use', id: 'pells-counter-end', verb: 'shop', shop: 'pells-sundries' },
    { x: 4, y: 6, kind: 'use', id: 'disc-case', verb: 'discs', shop: 'pells-sundries' },
    { x: 12, y: 8, kind: 'use', id: 'wanted-today', verb: 'wantedToday' },
    { x: 2, y: 1, w: 5, h: 1, kind: 'use', id: 'staple-shelves', verb: 'look' },
    { x: 10, y: 2, kind: 'use', id: 'ebb-winter-ledger', verb: 'look', staff: true, text: 'A ledger of the Ebb winter. Every line is credit. Nobody has ever crossed one out.' },
  ],
  warps: [{ x: 7, y: 9, kind: 'door', to: { mapId: 'pellwick', x: 24, y: 20, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'shop-floor': { x: 1, y: 2, w: 8, h: 7 },
    'behind-counter': { x: 10, y: 5, w: 3, h: 1 },
    'back-room': { x: 10, y: 2, w: 3, h: 2 },
  },
  markers: {
    'from-door': { x: 7, y: 8, facing: 'up' },
    'door-front': { x: 7, y: 8, facing: 'down' },
    'juniper-counter': { x: 10, y: 5, facing: 'down', staff: true },
    'juniper-till': { x: 11, y: 5, facing: 'down', staff: true },
    'juniper-back-room': { x: 11, y: 3, facing: 'up', staff: true },
    'counter-front': { x: 10, y: 7, facing: 'up' },
    'disc-case-front': { x: 4, y: 7, facing: 'up' },
    'wanted-today-front': { x: 11, y: 8, facing: 'right' },
    'isolde-lantern-shelf': { x: 11, y: 1, onSolid: true },
    'heirloom-shelf': { x: 10, y: 3, onSolid: true },
    'browse-staples': { x: 3, y: 2, facing: 'up' },
    'browse-island': { x: 4, y: 4, facing: 'left' },
    'browse-barrels': { x: 2, y: 6, facing: 'left' },
    'juniper-ledger': { x: 11, y: 2, facing: 'left', staff: true },
    'pells-window': { x: 8, y: 2, facing: 'up' },
  },
  music: null,
  light: { indoor: true },
  entry: { x: 7, y: 8, facing: 'up' },
};

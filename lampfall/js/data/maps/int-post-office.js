/**
 * THE POST OFFICE (int-post-office) — Hesper's counter, 18:00-02:00 (GDD-00 §5, §10, §11; GDD-01 §11.3).
 * [DATA-MAPS] 12x10 interior. Door (6,9), arrival (6,8); the door returns to the porch step (48,20).
 *
 * The public room: the long counter with Hesper's lamp (it lights when she takes the night shift; on
 * night one, when you carry the mail sack in), the outgoing-post box, a bench for the queue. A hinged
 * flap at (8,6) lets you round the counter ("Mind the trail."). Behind it, through the doorway, the
 * SORTING ROOM: pigeonholes floor to ceiling, the sorting table, Mabry Coil's day book on its desk,
 * and in the corner the OLD POST SACK, thirty years full (Isolde's letters went into it the week the
 * office closed; it empties at the Late Delivery party, `sp.late-delivery`).
 *
 * Legend (map-local): '#' int-wall-top, 'W' int-wall, 'F' floor-boards; detail 's' shelf (pigeonholes),
 * 'K' counter, 'T' table, '/' the counter flap (fence-gate), 'r' rug.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'int-post-office',
  name: 'Post Office',
  kind: 'interior',
  region: 'pellwick',
  w: 12,
  h: 10,
  legend: { '#': 'int-wall-top', W: 'int-wall', F: 'floor-boards', s: 'shelf', K: 'counter', T: 'table', r: 'rug' },
  ground: [
    '############', // 0
    '#WsssWWsssW#', // 1  pigeonholes
    '#FFFFFFFFFF#', // 2  the sorting room
    '#FFFFFFFFFF#', // 3
    '#WWWWFWWWWW#', // 4  doorway (5,4)
    '#FFFFFFFFFF#', // 5  Hesper's side
    '#FFFFFFFFFF#', // 6  the counter row
    '#FFFFFFFFFF#', // 7  the public room
    '#FFFFFFFFFF#', // 8
    '######+#####', // 9
  ],
  detail: [
    '............', // 0
    '............', // 1
    '.........T..', // 2  Mabry's desk
    '...TT.......', // 3  the sorting table
    '............', // 4
    '............', // 5
    '.KKKKKKK/KK.', // 6  counter; the flap (8,6)
    '............', // 7
    '.....r......', // 8
    '............', // 9
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'day-book', x: 9, y: 2, note: 'ART REQUEST day-book: Mabry Coil\'s post-office day book on the desk' },
    { art: 'porch-lamp', x: 4, y: 6, note: 'Hesper\'s counter lamp (lit from 18:00, and on night one when the sack comes in)' },
    { art: 'letter-rack', x: 7, y: 1, note: 'ART REQUEST letter-rack' },
  ],
  entities: [
    { kind: 'prop', id: 'old-post-sack', x: 10, y: 2, art: 'post-sack', verb: 'look', cond: { not: { flag: 'sp.late-delivery' } }, text: 'A canvas sack, stitched shut thirty years ago. The tag says HOLD.', note: 'ART REQUEST post-sack' },
    { kind: 'prop', id: 'outgoing-post', x: 10, y: 8, art: 'post-box', verb: 'look', text: 'OUTGOING. Collected at 06:00.' },
    { kind: 'prop', id: 'queue-bench', x: 1, y: 8, art: 'bench', verb: 'sit' },
  ],
  triggers: [
    { x: 1, y: 6, w: 7, h: 1, kind: 'use', id: 'hesper-counter', verb: 'hesperCounter', note: 'Hesper\'s counter 18:00-02:00: one family letter from 18:00' },
    { x: 9, y: 6, w: 2, h: 1, kind: 'use', id: 'hesper-counter-east', verb: 'hesperCounter' },
    { x: 10, y: 2, kind: 'use', id: 'old-post-sack', verb: 'look' },
    { x: 9, y: 2, kind: 'use', id: 'mabry-daybook', verb: 'look', text: 'Mabry Coil\'s day book, open to the week the office closed.' },
    { x: 2, y: 1, w: 3, h: 1, kind: 'use', id: 'pigeonholes-west', verb: 'look' },
    { x: 7, y: 1, w: 3, h: 1, kind: 'use', id: 'pigeonholes-east', verb: 'look' },
  ],
  warps: [{ x: 6, y: 9, kind: 'door', to: { mapId: 'pellwick', x: 48, y: 20, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'public-room': { x: 1, y: 7, w: 10, h: 2 },
    'behind-counter': { x: 1, y: 5, w: 10, h: 1 },
    'sorting-room': { x: 1, y: 2, w: 10, h: 2 },
  },
  markers: {
    'from-door': { x: 6, y: 8, facing: 'up' },
    'door-front': { x: 6, y: 8, facing: 'down' },
    'hesper-counter': { x: 4, y: 5, facing: 'down' },
    'post-counter-front': { x: 4, y: 7, facing: 'up' },
    'mail-sack-drop': { x: 5, y: 7, facing: 'up' },
    'hesper-sorting': { x: 6, y: 3, facing: 'up' },
    'sorting-table-front': { x: 3, y: 2, facing: 'down' },
    'old-post-sack': { x: 10, y: 2, onSolid: true },
    'old-post-sack-front': { x: 10, y: 3, facing: 'up' },
    'mabry-daybook-front': { x: 9, y: 3, facing: 'up' },
    'counter-flap': { x: 8, y: 6 },
    'queue-1': { x: 3, y: 8, facing: 'up' },
    'queue-2': { x: 2, y: 7, facing: 'right' },
    'party-hesper': { x: 6, y: 5, facing: 'down' },
    'party-1': { x: 3, y: 7, facing: 'right' },
    'party-2': { x: 8, y: 7, facing: 'left' },
    'party-3': { x: 6, y: 2, facing: 'down' },
    'party-sack-opening': { x: 10, y: 3, facing: 'up' },
  },
  music: null,
  light: { indoor: true },
  entry: { x: 6, y: 8, facing: 'up' },
};

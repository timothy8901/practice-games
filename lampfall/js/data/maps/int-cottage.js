/**
 * THE KEEPER'S COTTAGE (int-cottage) — the house that grows (GDD-00 §3, §7; GDD-01 §10.1). [DATA-MAPS]
 * 16x12 interior. Door (8,11), arrival (8,10); the door returns to the porch step (9,23) in Pellwick.
 *
 * One layout per house tier (GDD-01 §1.14 `variants`). The top-level layers are tier 0, the BEDSIT you
 * walk into on night one (a cot, a cold hearth, a crate; until loan 1's roof lands the sky shows through a
 * hole and a bucket catches the drip). `variants` replace whole layers and lists when their `cond`
 * holds; the LAST variant whose cond holds wins:
 *   0 `bedsit`    default; `sys.build.bedsit` (loan 1's roof) only patches the hole and the bucket
 *   1 `cottage`   `sys.build.cottage` (loan 2): two rooms, the mirror (lease card edits), satchel +10
 *   2 `rooms`     any room commission built (loans 3-6): six room slots around the hearth room; each
 *                 slot opens on its own `sys.build.<commission>` flag (Wren's chalk plan seals the
 *                 doorway of a slot not built yet; its fittings are conditional entities)
 *   3 `lamp-room` `sys.build.lamp-room` (loan 7): the rooms tier plus the keeper's stair, a trapdoor in
 *                 the hearth room down to the tunnel under the flagstone walk and up into the
 *                 lighthouse foot (Lamp Room access without going out in the weather)
 * `artTier` picks the cottage-floor / cottage-wall art (`artByTier` in tilesets).
 *
 * Rooms tier plan:   A greenhouse (1-4,2-4) · B gallery (7-9,2-4) · C training yard, open to the sky
 * (11-14,2-4) · bedroom (1-3,6-10) with the loft ladder · hearth room (5-10,6-10) with the cellar
 * hatch · E workshop (12-14,6-10). The chimney breast (5-6,1-4) carries the hearth at (5,5).
 *
 * Legend (map-local): '#' cottage-wall-top (also the unbuilt dark), 'W' cottage-wall face,
 * 'F' cottage-floor, 'f' flagstones, '%' window; detail 'h' hearth (32x32), 'b' bed, 'T' table,
 * 'r' rug, 's' shelf, 'v' stairs-down (the keeper's stair trapdoor).
 * @type {import('../index.js').MapDef}
 */

const legend = Object.freeze({
  '#': 'cottage-wall-top', W: 'cottage-wall', F: 'cottage-floor',
  h: 'hearth', b: 'bed', T: 'table', r: 'rug', s: 'shelf', v: 'stairs-down',
});

const FRONT_DOOR = Object.freeze({ x: 8, y: 11, kind: 'door', to: Object.freeze({ mapId: 'pellwick', x: 9, y: 23, facing: 'down' }), sfx: 'doorOpen' });

/** Commission rooms: slot doorway (sealed by Wren's chalk plan until built). */
const SLOTS = Object.freeze([
  { room: 'greenhouse', x: 4, y: 5, name: 'GREENHOUSE' },
  { room: 'gallery', x: 8, y: 5, name: 'GALLERY' },
  { room: 'training-yard', x: 11, y: 5, name: 'TRAINING YARD' },
  { room: 'workshop', x: 12, y: 6, name: 'WORKSHOP' },
]);
const built = (room) => ({ flag: `sys.build.${room}` });
const notBuilt = (room) => ({ not: { flag: `sys.build.${room}` } });
const ANY_COMMISSION = Object.freeze({ any: ['training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery'].map(built) });

/** Rooms-tier entities (shared by `rooms` and `lamp-room`). */
const ROOMS_ENTITIES = [
  { kind: 'prop', id: 'storage-crate', x: 10, y: 8, art: 'crates', verb: 'storage', note: 'creature storage (20; 40 with the Cellar) and the dial change with Dimity' },
  { kind: 'prop', id: 'mirror', x: 2, y: 5, art: 'mirror', verb: 'mirror', note: 'ART REQUEST mirror; edit the lease card (from loan 2)' },
  // slot seals: Wren's chalk plan across the doorway of a room not built yet
  ...SLOTS.map((s) => ({ kind: 'prop', id: `plan-${s.room}`, x: s.x, y: s.y, art: 'chalk-plan', verb: 'look', cond: notBuilt(s.room), text: `Chalk on the boards, Wren's hand: ${s.name}? Pick it at the yard.` })),
  // greenhouse (A)
  { kind: 'prop', id: 'graft-bench', x: 2, y: 2, art: 'table', verb: 'graft', cond: built('greenhouse'), note: 'grafting bench: foreign fruit; a creature left overnight with its favourite fruit gains +1 Bond' },
  { kind: 'prop', id: 'greenhouse-bed-1', x: 1, y: 3, art: 'bean-rows', verb: 'look', cond: built('greenhouse') },
  { kind: 'prop', id: 'greenhouse-bed-2', x: 1, y: 4, art: 'bean-rows', verb: 'look', cond: built('greenhouse') },
  { kind: 'prop', id: 'greenhouse-pot', x: 4, y: 2, art: 'bush', verb: 'shake', cond: built('greenhouse'), note: 'the indoor fruit tree, potted' },
  // gallery (B)
  { kind: 'prop', id: 'gallery-bench', x: 9, y: 3, art: 'bench', verb: 'sit', cond: built('gallery') },
  // training yard (C)
  { kind: 'prop', id: 'training-dummy', x: 14, y: 2, art: 'training-dummy', verb: 'look', cond: built('training-yard'), note: 'ART REQUEST training-dummy' },
  // workshop (E)
  { kind: 'prop', id: 'fossil-bench', x: 14, y: 7, art: 'workbench', verb: 'workshop', cond: built('workshop'), note: 'ART REQUEST workbench; fossils cleaned overnight +40%' },
  { kind: 'prop', id: 'relic-polisher', x: 14, y: 9, art: 'table', verb: 'polish', cond: built('workshop'), note: 'polish a skyglass relic overnight into a type tilt' },
  { kind: 'prop', id: 'workshop-shelf', x: 12, y: 10, art: 'shelf', verb: 'look', cond: built('workshop') },
  // cellar and porch & loft (no floor of their own)
  { kind: 'prop', id: 'cellar-hatch', x: 6, y: 10, art: 'stairs-down', verb: 'cellar', cond: built('cellar'), note: 'cold storage; Keepsakes safe; storage 20 -> 40' },
  { kind: 'prop', id: 'loft-ladder', x: 1, y: 6, art: 'stairs-up', verb: 'loft', cond: built('porch-loft'), note: 'the loft telescope shows Errants on the map' },
];

const ROOMS_PROPS = [
  { art: 'season-book', x: 6, y: 8, note: 'ART REQUEST season-book: Dimity\'s Season Book on the table; the Seed Card is its last page' },
  { art: 'windowsill-plant', x: 2, y: 1, note: 'ART REQUEST windowsill-plant (the one Wren\'s small talk picked)' },
  { art: 'chalk-ring', x: 12, y: 3, cond: built('training-yard'), note: 'ART REQUEST chalk-ring (32x16)' },
  { art: 'tally-display', x: 7, y: 1, cond: built('gallery'), note: 'ART REQUEST tally-display: your split sticks and wax seals' },
  { art: 'canvas-frame', x: 8, y: 1, cond: built('gallery'), note: 'ART REQUEST canvas-frame: Odile\'s canvases, Field Log plates' },
  { art: 'canvas-frame', x: 9, y: 1, cond: built('gallery') },
];

const ROOMS_TRIGGERS = [
  { x: 1, y: 9, kind: 'use', id: 'bed', verb: 'bed' },
  { x: 10, y: 8, kind: 'use', id: 'storage-crate', verb: 'storage' },
  { x: 2, y: 5, kind: 'use', id: 'mirror', verb: 'mirror' },
  { x: 5, y: 5, kind: 'use', id: 'hearth', verb: 'look' },
  { x: 6, y: 8, kind: 'use', id: 'season-book', verb: 'seasonBook' },
  { x: 2, y: 2, kind: 'use', id: 'graft-bench', verb: 'graft', cond: built('greenhouse') },
  { x: 8, y: 1, kind: 'use', id: 'gallery-wall', verb: 'gallery', cond: built('gallery') },
  { x: 14, y: 7, kind: 'use', id: 'fossil-bench', verb: 'workshop', cond: built('workshop') },
  { x: 14, y: 9, kind: 'use', id: 'relic-polisher', verb: 'polish', cond: built('workshop') },
  { x: 6, y: 10, kind: 'use', id: 'cellar-hatch', verb: 'cellar', cond: built('cellar') },
  { x: 1, y: 6, kind: 'use', id: 'loft-ladder', verb: 'loft', cond: built('porch-loft') },
];

const ROOMS_MARKERS = {
  'from-door': { x: 8, y: 10, facing: 'up' },
  'door-front': { x: 8, y: 10, facing: 'down' },
  'bed-side': { x: 2, y: 9, facing: 'left' },
  'rest-wake': { x: 2, y: 9, facing: 'down' },
  'mirror-front': { x: 2, y: 6, facing: 'up' },
  'hearth-front': { x: 5, y: 6, facing: 'up' },
  'storage-front': { x: 10, y: 9, facing: 'up' },
  'table-side': { x: 7, y: 8, facing: 'left' },
  'season-book': { x: 6, y: 8, onSolid: true },
  'dimity-windowsill': { x: 2, y: 1, onSolid: true },
  'loft-ladder-front': { x: 1, y: 7, facing: 'up' },
  'cellar-hatch-front': { x: 7, y: 10, facing: 'left' },
  'greenhouse-door': { x: 4, y: 4, facing: 'up', room: 'greenhouse' },
  'graft-bench-front': { x: 2, y: 3, facing: 'up', room: 'greenhouse' },
  'gallery-door': { x: 8, y: 4, facing: 'up', room: 'gallery' },
  'gallery-wall': { x: 8, y: 2, facing: 'up', room: 'gallery' },
  'training-yard-door': { x: 11, y: 4, facing: 'up', room: 'training-yard' },
  'tully-training': { x: 13, y: 3, facing: 'left', room: 'training-yard' },
  'training-dummy-front': { x: 14, y: 3, facing: 'up', room: 'training-yard' },
  'workshop-door': { x: 12, y: 7, facing: 'right', room: 'workshop' },
  'workshop-bench-front': { x: 13, y: 7, facing: 'right', room: 'workshop' },
  'polisher-front': { x: 13, y: 9, facing: 'right', room: 'workshop' },
  'porch-loft-guest': { x: 3, y: 7, facing: 'left' },
  'coda-morning': { x: 8, y: 7, facing: 'down' },
};

const ROOMS_GROUND = [
  '################', //  0
  '#W%%W##WWW#WWWW#', //  1  greenhouse glass | chimney | gallery wall | yard wall
  '#ffff##FFF#ffff#', //  2
  '#ffff##FFF#ffff#', //  3
  '#ffff##FFF#ffff#', //  4
  '#WWWFWWWFWWFWWW#', //  5  doorways (4,5) (8,5) (11,5); hearth on (5,5)
  '#FFFFFFFFFFFFFF#', //  6
  '#FFF#FFFFFF#FFF#', //  7
  '#FFF#FFFFFF#FFF#', //  8
  '#FFF#FFFFFF#FFF#', //  9
  '#FFF#FFFFFF#FFF#', // 10
  '########+#######', // 11
];
const ROOMS_DETAIL = [
  '................', //  0
  '................', //  1
  '................', //  2
  '................', //  3
  '................', //  4
  '.....h..........', //  5
  '................', //  6
  '................', //  7
  '......T.r.......', //  8
  '.b..............', //  9
  '................', // 10
  '................', // 11
];
const ROOMS_FURNITURE = [[3, 10], [5, 7], [9, 10], [13, 10], [7, 3], [3, 2], [12, 2]];

export default {
  id: 'int-cottage',
  name: 'Keeper\'s Cottage',
  kind: 'interior',
  region: 'pellwick',
  w: 16,
  h: 12,
  legend,
  artTier: 0,
  // ---- tier 0: the bedsit -------------------------------------------------------------------------
  ground: [
    '################', //  0
    '################', //  1
    '################', //  2
    '################', //  3
    '################', //  4
    '################', //  5
    '######W%WWW#####', //  6  window (7,6); hearth on (9,6)
    '######FFFFF#####', //  7
    '######FFFFF#####', //  8
    '######FFFFF#####', //  9
    '######FFFFF#####', // 10
    '########+#######', // 11
  ],
  detail: [
    '................', //  0
    '................', //  1
    '................', //  2
    '................', //  3
    '................', //  4
    '................', //  5
    '.........h......', //  6
    '......b.........', //  7
    '................', //  8
    '........r.......', //  9
    '................', // 10
    '................', // 11
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'windowsill-plant', x: 7, y: 6, note: 'ART REQUEST windowsill-plant (Wren\'s small talk picks it)' },
    { art: 'light-pool', x: 7, y: 8, cond: { not: { flag: 'sys.build.bedsit' } }, note: 'moonlight through the roof hole until loan 1\'s roof lands' },
  ],
  entities: [
    { kind: 'prop', id: 'storage-crate', x: 10, y: 7, art: 'crates', verb: 'storage', note: 'creature storage and the dial change with Dimity' },
    { kind: 'prop', id: 'drip-bucket', x: 7, y: 8, art: 'drip-bucket', verb: 'look', cond: { not: { flag: 'sys.build.bedsit' } }, text: 'A bucket under the hole in the roof. Plink.', note: 'ART REQUEST drip-bucket' },
  ],
  triggers: [
    { x: 6, y: 7, kind: 'use', id: 'bed', verb: 'bed' },
    { x: 10, y: 7, kind: 'use', id: 'storage-crate', verb: 'storage' },
    { x: 9, y: 6, kind: 'use', id: 'hearth', verb: 'look' },
  ],
  warps: [FRONT_DOOR],
  spawns: [],
  regions: {
    bedsit: { x: 6, y: 7, w: 5, h: 4 },
    'bed-corner': { x: 6, y: 7, w: 2, h: 2 },
  },
  markers: {
    'from-door': { x: 8, y: 10, facing: 'up' },
    'door-front': { x: 8, y: 10, facing: 'down' },
    'bedsit-first-look': { x: 8, y: 9, facing: 'up' },
    'bed-side': { x: 7, y: 7, facing: 'left' },
    'rest-wake': { x: 7, y: 7, facing: 'down' },
    'hearth-front': { x: 9, y: 7, facing: 'up' },
    'storage-front': { x: 9, y: 7, facing: 'right' },
    'roof-hole': { x: 7, y: 8, onSolid: true, note: 'the bucket stands here until sys.build.bedsit' },
    'dimity-windowsill': { x: 7, y: 6, onSolid: true },
    'coda-morning': { x: 8, y: 8, facing: 'down' },
  },
  furnitureSlots: [[10, 10], [6, 10]],
  music: null,
  light: { indoor: true },
  entry: { x: 8, y: 10, facing: 'up' },

  // ---- tiers 1-3 ------------------------------------------------------------------------------------
  variants: [
    {
      id: 'cottage',
      tier: 1,
      cond: { flag: 'sys.build.cottage' },
      artTier: 1,
      ground: [
        '################', //  0
        '################', //  1
        '################', //  2
        '################', //  3
        '################', //  4
        '#W%WWWW%WWW#####', //  5  bedroom window (2,5); hearth (5,5); hearth-room window (7,5)
        '#FFFFFFFFFF#####', //  6
        '#FFF#FFFFFF#####', //  7
        '#FFF#FFFFFF#####', //  8
        '#FFF#FFFFFF#####', //  9
        '#FFF#FFFFFF#####', // 10
        '########+#######', // 11
      ],
      detail: [
        '................', //  0
        '................', //  1
        '................', //  2
        '................', //  3
        '................', //  4
        '.....h..........', //  5
        '................', //  6
        '................', //  7
        '......T.r.......', //  8
        '.b..............', //  9
        '...s............', // 10
        '................', // 11
      ],
      props: [{ art: 'windowsill-plant', x: 7, y: 5 }, { art: 'season-book', x: 6, y: 8 }],
      entities: [
        { kind: 'prop', id: 'storage-crate', x: 10, y: 8, art: 'crates', verb: 'storage' },
        { kind: 'prop', id: 'mirror', x: 3, y: 5, art: 'mirror', verb: 'mirror', note: 'ART REQUEST mirror; edit the lease card (from loan 2)' },
      ],
      triggers: [
        { x: 1, y: 9, kind: 'use', id: 'bed', verb: 'bed' },
        { x: 10, y: 8, kind: 'use', id: 'storage-crate', verb: 'storage' },
        { x: 3, y: 5, kind: 'use', id: 'mirror', verb: 'mirror' },
        { x: 5, y: 5, kind: 'use', id: 'hearth', verb: 'look' },
        { x: 6, y: 8, kind: 'use', id: 'season-book', verb: 'seasonBook' },
      ],
      warps: [FRONT_DOOR],
      regions: {
        bedroom: { x: 1, y: 6, w: 3, h: 5 },
        'hearth-room': { x: 5, y: 6, w: 6, h: 5 },
      },
      markers: {
        'from-door': { x: 8, y: 10, facing: 'up' },
        'door-front': { x: 8, y: 10, facing: 'down' },
        'bed-side': { x: 2, y: 9, facing: 'left' },
        'rest-wake': { x: 2, y: 9, facing: 'down' },
        'mirror-front': { x: 3, y: 6, facing: 'up' },
        'hearth-front': { x: 5, y: 6, facing: 'up' },
        'storage-front': { x: 10, y: 9, facing: 'up' },
        'table-side': { x: 7, y: 8, facing: 'left' },
        'season-book': { x: 6, y: 8, onSolid: true },
        'dimity-windowsill': { x: 7, y: 5, onSolid: true },
        'coda-morning': { x: 8, y: 7, facing: 'down' },
      },
      furnitureSlots: [[3, 7], [9, 10], [10, 6], [5, 9]],
    },
    {
      id: 'rooms',
      tier: 2,
      cond: ANY_COMMISSION,
      artTier: 2,
      ground: ROOMS_GROUND,
      detail: ROOMS_DETAIL,
      props: ROOMS_PROPS,
      entities: ROOMS_ENTITIES,
      triggers: ROOMS_TRIGGERS,
      warps: [FRONT_DOOR],
      regions: {
        bedroom: { x: 1, y: 6, w: 3, h: 5 },
        'hearth-room': { x: 5, y: 6, w: 6, h: 5 },
        greenhouse: { x: 1, y: 2, w: 4, h: 3 },
        gallery: { x: 7, y: 2, w: 3, h: 3 },
        'training-yard': { x: 11, y: 2, w: 4, h: 3, outdoor: true },
        workshop: { x: 12, y: 6, w: 3, h: 5 },
      },
      markers: ROOMS_MARKERS,
      furnitureSlots: ROOMS_FURNITURE,
    },
    {
      id: 'lamp-room',
      tier: 3,
      cond: { flag: 'sys.build.lamp-room' },
      artTier: 3,
      ground: ROOMS_GROUND,
      detail: ROOMS_DETAIL.map((r, y) => (y === 10 ? '..........v.....' : r)),
      props: [...ROOMS_PROPS, { art: 'lamp-room-key', x: 9, y: 5, note: 'ART REQUEST lamp-room-key: the brass key on its hook by the trapdoor' }],
      entities: ROOMS_ENTITIES,
      triggers: [...ROOMS_TRIGGERS],
      warps: [
        FRONT_DOOR,
        { x: 10, y: 10, kind: 'stairs', to: { mapId: 'int-lighthouse', x: 9, y: 13, facing: 'left' }, via: 'keepers-stair', cond: { flag: 'sys.build.lamp-room' }, sfx: 'doorOpen', note: 'the keeper\'s stair: tunnel under the flagstone walk to the lighthouse foot' },
      ],
      regions: {
        bedroom: { x: 1, y: 6, w: 3, h: 5 },
        'hearth-room': { x: 5, y: 6, w: 6, h: 5 },
        greenhouse: { x: 1, y: 2, w: 4, h: 3 },
        gallery: { x: 7, y: 2, w: 3, h: 3 },
        'training-yard': { x: 11, y: 2, w: 4, h: 3, outdoor: true },
        workshop: { x: 12, y: 6, w: 3, h: 5 },
      },
      markers: {
        ...ROOMS_MARKERS,
        'keepers-stair': { x: 10, y: 10, note: 'the trapdoor (warp)' },
        'keepers-stair-arrival': { x: 9, y: 10, facing: 'right' },
      },
      furnitureSlots: ROOMS_FURNITURE.filter(([x, y]) => !(x === 9 && y === 10)),
    },
  ],
};

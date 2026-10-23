/**
 * DROWNWOOD — isle 4 (GDD-00 §4; GDD-01 §15.4). [DATA-MAPS] 48x32 tiles, wild Lv22-27, Waystone Mossgate.
 *
 * The sinking isle: more water than land. West: the drowned forest, murky water full of dead trunks and
 * lilies round reed hummocks, cut by a tannin channel (a reach), with the skyglass node on a hummock and
 * boardwalks threading it: the mangrove boardwalk from Emberstep (the long way, any tide) comes up from
 * the south through the mangrove fringe. North-west: the hummock with the moor footbridge to Thistlewind
 * (the long way, any tide). Centre: the old town on its shrinking hummock (mud banks: the dig site): the
 * square, broken walls, the Hollow Spire; its high street runs east down into the water, the drowning
 * street, walkable only around low water (+-2.5 h), lined with drowned houses, the Mooring's pulse post
 * at its head. East: Mossgate, built on stilts: decks, boardwalks, the Waystone on the central deck, the
 * jetty and ferry stop, Teal's punt, the north loop boardwalk back to the old town (any tide). North:
 * the causeway to Thistlewind (short way, +-2.5 h). South-east: Wendel's boatyard on the shingle and the
 * causeway in from Emberstep (short way, +-2.5 h).
 *
 * Map-only legend chars: 'Y' murky water (mud-water), 'X' lily pads (detail), 'Z' drowned tree (detail),
 * '?' mangrove (detail) (they override glow mud, the mainland causeway, the weir and mirror-ice).
 * 'd' is the drowned street (DEFAULT_LEGEND). Generated once from a layout script, then hand-edited.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'drownwood',
  name: 'Drownwood',
  kind: 'exterior',
  region: 'drownwood',
  w: 48,
  h: 32,
  legend: { Y: 'mud-water', X: 'lily-pads', Z: 'drowned-tree', '?': 'mangrove' },
  ground: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    'DDDDDDDDDDBDDDDDDDDDDDDDDDDDDSqSDDDDDDDDDDDDDDDD', //  0
    'DDDDDSSSSDBSDDDSSDSDDDSDDSSSDSESDDDSDSDSDDSSDDDD', //  1
    'DSSSSSSSGGPGGSSSSSSSSSSSSSSSSSESSSSSSSSSSSSSSSDD', //  2
    'DDSSSSSGGTPTGGSSSSSSSSSSSSSSSSESSSSSSSSSSSSSSSSD', //  3
    'DSSSSSSGTTPTGGSSSSSSSSSSSSSSSSESSSSSpppppppppSSD', //  4
    'DDSSSSSGGTPTGGSSSSSSSS55555SSSEkkkkkkppppppppSDD', //  5
    'DDSSSSSSGGPGGSSSSSSSSS55555mmkkkSSSSSkSSSSSSSSDD', //  6
    'DSSSSSSSSSkSSSSSSSSSmm55555GGkmSSSSSSkS2222555SD', //  7
    'DDSSSSSSSSkYSSSSSSSmGGs]s]sGTTm555S22kS2222555DD', //  8
    'DDSSUrrrUkkkkkkkkkkmGGss"ssGTTT555S22kS${$$${$DD', //  9
    'DDSUrrrrUYYYYYYYSSkGsGGGOGGGG}Gs}sSs}kS$+{$$+$SD', // 10
    'DDSSUrrrUYYYYYYYYSmmsGOOOOOOGGGs@sSs@kpppppppSSD', // 11
    'DSSYYUUYYYYYYUrUYSS}GGOOOOOOOOOdddddddppppSSkSDD', // 12
    'DSSYYYjjjjjjUrrrUYYmTTOOOOOOOOOdddddddppppSSkSSD', // 13
    'DDYYYYjYYYYjYUrUYYkkTTTGGGGGGGm555S222ppppSSkSDD', // 14
    'DjjjjjjYYYYjYYYYYYksmmGGGGGGGmm555S222pppppppSSD', // 15
    'DDYrrrUYYYYjYYYYkkkYSsmmGGGmmmSs}sSs}spppppppSDD', // 16
    'DSSUrUYYYYYjjjjjkjYSSSSSmmmSSSSs@sSs@sSSpppppKDD', // 17
    'DDSYYYYYYYYYYYYYkYYSSSSSSSSSSSSSSSSSSSSSpppppSSD', // 18
    'DSSYYYYYYYYYYYUYkYYSSSSSSSSSSSSSSSSSSSSSpppppSDD', // 19
    'DDSYYYYYYYYYUrrrkYYSSSSSSSSSSSSSSSSSSSSSpppppSDD', // 20
    'DSSYYUYYYYYUUrrrkYYSSSSSSSSSSSSSSSSSSSSSpppppSDD', // 21
    'DDSUrrrYYYYYkkkkkYSSSSSSSSSSSSSSSSSSSSSSpppppSDD', // 22
    'DDSUrrrUYYYYkYYYYSSSSSSSSSSSSSSSSSSSSSSSSSkSSSSD', // 23
    'DSSUrrrUYYYYkYYYYSSSSSSSSSSSSSSSSSSSSSSSSSkSSSDD', // 24
    'DDSSSSYYYYYYkYSSSSSSSSSSSSSSSSSSSSSSSqqqqqqqSSSD', // 25
    'DDSSSSSSSYYYkYSSSSSSSSSSSSSSSSSSSSSqqqGGGGGqqSDD', // 26
    'DDSSSSSSSSSSkSSSSSSSSSSSSSSSSSSSSSSqqqGGGGGqqqDD', // 27
    'DDSSSSSSSSSSkSSSSSSSSSSSSSSSSSSSSSSSSqqqqqqqSSDD', // 28
    'DDSSSSSSSSSSkSSSSSSSSSSSSSSSSSSSSSSSSSSSESSSSSDD', // 29
    'DSDDSDDDDSDDkDDDDDSSDDSDDDSDDSDDSSDDDSSSESSSSDSD', // 30
    'DDDDDDDDDDDDkDDDDDDDDDDDDDDDDDDDDDDDDDSSqSSDDDDD', // 31
  ],
  detail: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    '................................................', //  0
    '................................................', //  1
    '................................................', //  2
    '........9...9...................................', //  3
    '......................................(.....(...', //  4
    '.............9..................................', //  5
    '................................................', //  6
    '................................................', //  7
    '...................9............................', //  8
    '.....9........................9.................', //  9
    '...........Z....................................', // 10
    '...............Z................................', // 11
    '...Z...XZ.Z.....X...............................', // 12
    '....Z................9...................L......', // 13
    '..Z.............................................', // 14
    '............Z....X.........9...........(........', // 15
    '...............Z..........9.....................', // 16
    '........Z.Z.......Z.............................', // 17
    '....Z......................................(....', // 18
    '....Z.....X......XX.......................L.....', // 19
    '...ZZ.....Z....9................................', // 20
    '....X.Z..........X..............................', // 21
    '...........X....................................', // 22
    '..............ZZ................................', // 23
    '........Z..X..Z.Z?..?...........................', // 24
    '.....?...Z...X....?........................c....', // 25
    '......?.?.ZZ.......?.................9c.........', // 26
    '.......?.....?..............................9...', // 27
    '........???.....?..?............................', // 28
    '.......?.............?..........................', // 29
    '................................................', // 30
    '................................................', // 31
  ],
  overlay: null,
  collision: null,
  props: [],
  entities: [
    // the dock: Waystone, tide chalkboard, ferry stop
    { kind: 'prop', id: 'mossgate', art: 'waystone', waystone: true, x: 42, y: 17, note: 'autosave, deferred Forecasts, heals once per tide (GDD-00 §4)' },
    { kind: 'prop', id: 'tide-board-drownwood', art: 'tide-chalkboard', verb: 'tideTable', x: 43, y: 17 },
    { kind: 'boat', id: 'ferry-punt-drownwood', x: 46, y: 17, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry stop: any tide, 05:00-01:00 (GDD-00 §4)' },
    // the skyglass node on a reed hummock in the drowned forest
    { kind: 'prop', id: 'node-drownwood', art: 'skyglass', node: true, x: 6, y: 10, note: '1-2 Starsalt; refills per badge (GDD-00 §4)' },
    // the Mooring's pulse post, the boatyard, signs
    { kind: 'prop', id: 'anchor-pulse-post', x: 30, y: 14, art: 'lamp-post', verb: 'look', note: 'the Mooring\'s Anchor Pulse emitter at the head of the drowning street (script anchor-pulse-misfire)' },
    { kind: 'boat', id: 'wendel-hull', x: 39, y: 27, art: 'boat', verb: 'look', note: 'Wendel\'s hull on the slip; the rollers that haul Tamsin\'s boat' },
    { kind: 'boat', id: 'stilt-punt', x: 37, y: 15, art: 'punt', note: 'Teal\'s poling punt' },
    { kind: 'prop', id: 'mossgate-bench', x: 40, y: 18, art: 'bench', verb: 'sit' },
    { kind: 'sign', id: 'sign-mossgate', x: 41, y: 16, art: 'signpost', text: 'Mossgate. Built on legs, because the ground gave up.' },
    { kind: 'sign', id: 'sign-drowning-street', x: 27, y: 14, art: 'signpost', text: 'High Street. Walkable at low water. Mind the doorways.' },
    { kind: 'sign', id: 'sign-hollow-spire', x: 25, y: 10, art: 'signpost', text: 'The Hollow Spire. Wendel Teague. Some things here will not be touched.' },
    { kind: 'sign', id: 'sign-thistlewind-causeway', x: 31, y: 7, art: 'signpost', text: 'Thistlewind by the causeway. Dry two and a half hours either side of low water.' },
    { kind: 'sign', id: 'sign-thistlewind-footbridge', x: 11, y: 6, art: 'signpost', text: 'Thistlewind the long way: the moor footbridge. Any tide.' },
    { kind: 'sign', id: 'sign-emberstep-causeway', x: 41, y: 25, art: 'signpost', text: 'Emberstep by the causeway. Dry two and a half hours either side of low water.' },
    { kind: 'sign', id: 'sign-mangrove-boardwalk', x: 13, y: 23, art: 'signpost', text: 'Emberstep the long way: the mangrove boardwalk. Any tide.' },
  ],
  triggers: [
    { x: 42, y: 17, kind: 'use', id: 'waystone-mossgate', verb: 'waystone', waystone: 'mossgate' },
    { x: 43, y: 17, kind: 'use', id: 'tide-board-drownwood', verb: 'tideTable' },
    { x: 46, y: 17, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 6, y: 10, kind: 'use', id: 'node-drownwood', verb: 'chip' },
    { x: 30, y: 14, kind: 'use', id: 'anchor-pulse-post', verb: 'look' },
  ],
  warps: [
    { x: 40, y: 31, kind: 'edge', to: { mapId: 'emberstep', x: 40, y: 1, facing: 'down' }, via: 'short-way', way: 'causeway', tideWindow: 150, note: 'the causeway to Emberstep (+-2.5 h)' },
    { x: 12, y: 31, kind: 'edge', to: { mapId: 'emberstep', x: 12, y: 1, facing: 'down' }, via: 'long-way', note: 'the mangrove boardwalk, any tide' },
    { x: 30, y: 0, kind: 'edge', to: { mapId: 'thistlewind', x: 30, y: 30, facing: 'up' }, via: 'short-way', way: 'causeway', tideWindow: 150, note: 'the causeway to Thistlewind (+-2.5 h)' },
    { x: 10, y: 0, kind: 'edge', to: { mapId: 'thistlewind', x: 10, y: 30, facing: 'up' }, via: 'long-way', note: 'the moor footbridge, any tide' },
    { x: 24, y: 9, kind: 'door', to: { mapId: 'spire-hollow', x: 10, y: 12, facing: 'up' }, sfx: 'doorOpen', note: 'the Hollow Spire; its door back lands on (24,10)' },
  ],
  spawns: [
    { area: 'grass', table: 'drownwood-land', rate: 0.1 },
    { area: { x: 32, y: 17, w: 7, h: 4 }, table: 'drownwood-water', rate: 0, via: 'hook', note: 'reaches hook this table through fishing' },
  ],
  regions: {
    'mossgate': { x: 36, y: 2, w: 10, h: 23 },
    'mossgate-dock': { x: 40, y: 15, w: 7, h: 6 },
    'drowning-street': { x: 28, y: 12, w: 10, h: 2 },
    'old-town': { x: 18, y: 5, w: 14, h: 13 },
    'hollow-spire': { x: 22, y: 5, w: 5, h: 6 },
    'drowned-forest': { x: 1, y: 7, w: 18, h: 21 },
    'boatyard': { x: 35, y: 24, w: 10, h: 5 },
    'short-way-emberstep': { x: 38, y: 28, w: 5, h: 4 },
    'long-way-emberstep': { x: 11, y: 22, w: 6, h: 10 },
    'short-way-thistlewind': { x: 29, y: 0, w: 3, h: 7 },
    'long-way-thistlewind': { x: 6, y: 0, w: 8, h: 7 },
    'dig-site': { x: 18, y: 5, w: 14, h: 13 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'drownwood-stilt-ladder': { x: 39, y: 13, facing: 'left', trainer: 'drownwood-wenna' },
    'drownwood-mangrove-boardwalk': { x: 12, y: 26, facing: 'down', trainer: 'drownwood-gil' },
    'drownwood-rescue-raft': { x: 28, y: 13, facing: 'right', trainer: 'drownwood-hettie' },
    'drownwood-anchor-post': { x: 24, y: 12, facing: 'up', trainer: 'drownwood-abner' },
    'drownwood-drowned-lamp': { x: 14, y: 9, facing: 'down', trainer: 'drownwood-sorcha' },
    'drownwood-scatter-raft': { x: 33, y: 12, facing: 'left', trainer: 'varga-drownwood', tide: 'low' },
    // the dock: Waystone, tide chalkboard, ferry stop
    'ferry-stop': { x: 45, y: 17, facing: 'right' },
    'maud-punt': { x: 46, y: 17, water: true },
    // the Mooring's pulse post, the boatyard, signs
    'door-spire-hollow': { x: 24, y: 9 },
    'spire-hollow-step': { x: 24, y: 10, facing: 'up' },
    'spire-step': { x: 24, y: 10, facing: 'down', note: 'where the Spire\'s door lets you out (the Spire interiors\' toMarker)' },
    // arrivals
    'from-emberstep-causeway': { x: 40, y: 30, facing: 'up', tide: 'low' },
    'from-emberstep-boardwalk': { x: 12, y: 30, facing: 'up' },
    'from-thistlewind-causeway': { x: 30, y: 1, facing: 'down', tide: 'low' },
    'from-thistlewind-footbridge': { x: 10, y: 1, facing: 'down' },
    'mossgate-dock': { x: 42, y: 18, facing: 'right' },
    // route trainers at their posts (TRAINER_IDS)
    'trainer-drownwood-wenna': { x: 39, y: 13, facing: 'left', trainer: 'drownwood-wenna', note: 'Stilt Fisher, on the west deck over the street\'s end' },
    'trainer-drownwood-gil': { x: 12, y: 26, facing: 'down', trainer: 'drownwood-gil', note: 'Mangrove Poler, on the mangrove boardwalk' },
    'trainer-drownwood-hettie': { x: 28, y: 13, facing: 'right', trainer: 'drownwood-hettie', note: 'Scatter Rescuer, at the head of the drowning street' },
    'trainer-drownwood-abner': { x: 24, y: 12, facing: 'up', trainer: 'drownwood-abner', note: 'Mooring Warden, in the old square before the Spire' },
    'trainer-drownwood-sorcha': { x: 14, y: 9, facing: 'down', trainer: 'drownwood-sorcha', optional: true, note: 'Lamp Diver, on the forest boardwalk (declinable)' },
    'trainer-varga-drownwood': { x: 33, y: 12, facing: 'left', trainer: 'varga-drownwood', tide: 'low', note: 'Varga in the street at low water (story, any result)' },
    // isle folk, leader posts, story staging
    'teal-poler': { x: 38, y: 15, facing: 'right', npc: 'teal-fenner', note: 'beside the punt' },
    'teal-drowning-street': { x: 34, y: 13, facing: 'left', npc: 'teal-fenner', tide: 'low' },
    'drowning-street': { x: 33, y: 13, facing: 'left', tide: 'low', note: 'the street at low tide: Scatter volunteers (script drowning-street)' },
    'drowning-street-player': { x: 37, y: 13, facing: 'left', tide: 'low' },
    'anchor-pulse': { x: 30, y: 13, facing: 'right', note: 'the pulse post (script anchor-pulse-misfire)' },
    'merrow-anchor-pulse': { x: 29, y: 13, facing: 'right', npc: 'merrow' },
    'varga-drowning-street': { x: 32, y: 12, facing: 'right', npc: 'varga', tide: 'low' },
    'wendel-boatyard': { x: 40, y: 26, facing: 'left', npc: 'wendel' },
    'tamsin-drownwood': { x: 41, y: 26, facing: 'left', npc: 'tamsin', note: 'reading Kettle the Creelwight: the nameboard glints' },
    'hollow-spire-door': { x: 24, y: 10, facing: 'up' },
  },
  reaches: [
    { id: 'reach-tannin-channel', kind: 'river', area: { x: 6, y: 13, w: 6, h: 1 }, creatureTable: 'drownwood-water', name: 'Tannin Cut' },
    { id: 'reach-mossgate-lagoon', kind: 'lagoon', area: { x: 32, y: 17, w: 7, h: 4 }, creatureTable: 'drownwood-water', nightKind: 'sea', name: 'Under the Stilts' },
  ],
  dig: { spots: [[27, 6], [19, 13], [21, 15], [30, 15], [22, 16], [28, 16], [26, 17]], note: 'the old town\'s mud banks' },
  bugSpots: [
    { x: 7, y: 10, habitat: 'reeds' },
    { x: 14, y: 21, habitat: 'reeds' },
    { x: 14, y: 13, habitat: 'reeds' },
    { x: 9, y: 4, habitat: 'lanes' },
    { x: 20, y: 14, habitat: 'lanes' },
    { x: 8, y: 14, habitat: 'creek' },
  ],
  music: null,
  light: { indoor: false, ambient: 'drowned' },
  entry: { x: 42, y: 18, facing: 'right' },
};

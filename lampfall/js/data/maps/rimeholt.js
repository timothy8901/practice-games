/**
 * RIMEHOLT — isle 6 (GDD-00 §4; GDD-01 §15.6). [DATA-MAPS] 48x32 tiles, wild Lv36-41, Waystone Frostwick.
 *
 * The last isle, under its glacier. North-west: the glacier; cut into it, the mirror-ice caves (dark: a
 * 3-tile light radius, `darkZones`): the tunnel from the cave mouth up to the gallery, a hall of mirror
 * ice round the great mirror where Idris waits, and the Mirror Spire's face cut into the ice at its north
 * end; side passages west (Sunniva's polishing bay) and east (the skyglass seam). Below the snout: the
 * moraine (dig site) and the meltwater stream (a reach); Brannoch's lamp hut at the cave mouth; Aldous's
 * hut among the snow pines in the west. East: the ice path in from Thistlewind (the long way, any tide)
 * and the stepping stones (the short way, +-2 h). South-east: Frostwick: the lane, houses, the quay, the
 * Waystone, the ferry stop; Linnet comes back here. The ring closes by Maud's ferry and the Lantern-paths
 * (no walking route on to Lowmoor: the critical path never backtracks, GDD-00 §4).
 *
 * Map-only legend chars: 'Y' glacier, 'X' cave wall, 'Z' cave floor, 'V' snow pine (detail) (they
 * override glow mud, the mainland causeway, the weir and the hedge). '?' is mirror ice, 'x' ice, '-' snow.
 * Generated once from a layout script, then hand-edited: edit the rows directly.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'rimeholt',
  name: 'Rimeholt',
  kind: 'exterior',
  region: 'rimeholt',
  w: 48,
  h: 32,
  legend: { Y: 'glacier', X: 'cave-wall', Z: 'cave-floor', V: 'pine-snow' },
  ground: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    'DDDDDDDDDDDDDDDDDDDSSSSSSSSSSSSDDDDDDDDDDDDDDDDD', //  0
    'DDDDDDDDDDYYYYYYYYYYYYYYYYSSSSSSSSDDDDDDDDDDDDDD', //  1
    'DDDDDDDDYYYYYYYYYYYYYYYYYYYqqSSSSSSSDDDDDDDDDDDD', //  2
    'DDDDDDDYYYYYYYYYYYYYYYYYYYYqqqSqSSSSDDSSSSSDDDDD', //  3
    'DDDDSSSSSSYYYs]s]s]sYYYYYY---qqqSqSSSSSSSSSSSSDD', //  4
    'DDDDSSSSSYXXXs]s"s]sXXXYYY-----qqqSSSSSSqSSSSSSS', //  5
    'DDDSZZXSYX?????????????XYYYY-----qqSqqqqqqqqSSSS', //  6
    'DDDSZZXXX???X???????X???XXYY------qqq------qSSSS', //  7
    'DDSSZZZZZ???????????????ZZXY--------PPPPPPPPxxxx', //  8
    'DSSSSZZZZ???X???????X???ZZXY--------P-------SSSS', //  9
    'DSSSYXXXXX?????????????XXZXY--------P-------SSSS', // 10
    'SSSqYYYYYYXXXXXZZZXXXXXYXZXY-----TT-P-------qqSS', // 11
    'SSSSq-YYYYYYYYXZZZXYYYYYYXYY--xTTTTTP-----qqqSSS', // 12
    'SSqSqR-Y-YYYYYXZZZ555Y-YYYYY-x-TTTTTPT----qSSSSS', // 13
    'SSSqqR------Y-XZZZs]s----------TTTTTPT---qqSSSSD', // 14
    'SSqSqR:::::::--ZZZs@s------------TTTPx---qSSSDDD', // 15
    'SSSqqR::::::::--P--P--xx------------P----qqSSDDD', // 16
    'SSSq-R:::::::::-PPPP--x-------^^^^-xP5555-qSSSDD', // 17
    'SSqRRR::::PPPPPPPxx-----TTTTT-^^^^x-P5555-qSSSSD', // 18
    'SSSR444:::P:----PPPPPPPPPPPPPPs]ssPPP#%##-qqSSSD', // 19
    'SSqR#%#---P-----------TTTTTTTTs@]s---##+#-xqSSSS', // 20
    'SRRR#+#---P-----x------TTTTTTTOOOOOOOOOOOO--SSSS', // 21
    'SSq-PPPPPPP-------------TTTT-----P----1111PPeeeq', // 22
    'SSqq--TTTTT--------------x-------P----1111--SSSS', // 23
    'SSSq--TTqqqq---------------------P-x--${$$-qSSSS', // 24
    'SSSqqqqqqSSqqqq-----x----x---x-QQQQQQQ$+{$qqSSSD', // 25
    'DSSSSqSSSSqqSSq-qqqq--x---qqqqqQQQQQQQqqqqqSSSSD', // 26
    'DSSSSSSSSSSSSSqqqSSqqqqqqqqSSSSSSSSKSSSSSSSSSSDD', // 27
    'DDDSSSSSSSSSSSSSSSSSSqqSSqqqSSSSSSSKSSSSSSSSSDDD', // 28
    'DDDDDDDDDDDDSSSSSSSSSSSSSSSSSSDSSSSKSSSDDDDDDDDD', // 29
    'DDDDDDDDDDDDDDDDDDDSSSSSSSSSSSDDDDDDDDDDDDDDDDDD', // 30
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 31
  ],
  detail: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    '................................................', //  0
    '................................................', //  1
    '................................................', //  2
    '................................................', //  3
    '................................................', //  4
    '................................................', //  5
    '................................................', //  6
    '................................................', //  7
    '................................................', //  8
    '................................................', //  9
    '................................................', // 10
    '................................................', // 11
    '......................................V.V.......', // 12
    '..............................V...........V.....', // 13
    '................................................', // 14
    '............................V..V................', // 15
    '......0....0....................................', // 16
    '.......0................V.......................', // 17
    '................................................', // 18
    '........0.......................................', // 19
    '.............V......................L...........', // 20
    '................................................', // 21
    '............V........V..........................', // 22
    '.............................V..................', // 23
    '.......................V........................', // 24
    '...........V...............V...c.....(..........', // 25
    '.....V..........................)....)..........', // 26
    '................................................', // 27
    '................................................', // 28
    '................................................', // 29
    '................................................', // 30
    '................................................', // 31
  ],
  overlay: null,
  collision: null,
  props: [],
  entities: [
    // the dock: Waystone, tide chalkboard, ferry stop
    { kind: 'prop', id: 'frostwick', art: 'waystone', waystone: true, x: 34, y: 25, note: 'autosave, deferred Forecasts, heals once per tide (GDD-00 §4)' },
    { kind: 'prop', id: 'tide-board-rimeholt', art: 'tide-chalkboard', verb: 'tideTable', x: 35, y: 25 },
    { kind: 'boat', id: 'ferry-punt-rimeholt', x: 36, y: 29, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry stop: any tide, 05:00-01:00 (GDD-00 §4)' },
    // the skyglass node: a seam at the end of the east passage
    { kind: 'prop', id: 'node-rimeholt', art: 'skyglass', node: true, x: 25, y: 12, note: '1-2 Starsalt; refills per badge (GDD-00 §4)' },
    // Brannoch's lamp rack at the cave mouth, signs
    { kind: 'prop', id: 'cave-lamp-rack', x: 18, y: 16, art: 'lamp-post', verb: 'look', note: 'Brannoch lends a lamp for the caves (3-tile light radius)' },
    { kind: 'prop', id: 'gallery-mirror', x: 16, y: 8, art: 'lens-dark', verb: 'look', note: 'the great mirror in the gallery floor; Idris stands beside it' },
    { kind: 'sign', id: 'sign-frostwick', x: 30, y: 22, art: 'signpost', text: 'Frostwick. Keep your lamp lit and your feet under you.' },
    { kind: 'sign', id: 'sign-caves', x: 14, y: 16, art: 'signpost', text: 'The mirror-ice caves. The gallery, and the Mirror Spire beyond it. Take a lamp.' },
    { kind: 'sign', id: 'sign-thistlewind-stones', x: 42, y: 21, art: 'signpost', text: 'Thistlewind by the stones. Dry two hours either side of low water.' },
    { kind: 'sign', id: 'sign-ice-path', x: 42, y: 9, art: 'signpost', text: 'Thistlewind the long way: the ice path. Any tide.' },
  ],
  triggers: [
    { x: 34, y: 25, kind: 'use', id: 'waystone-frostwick', verb: 'waystone', waystone: 'frostwick' },
    { x: 35, y: 25, kind: 'use', id: 'tide-board-rimeholt', verb: 'tideTable' },
    { x: 36, y: 29, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 25, y: 12, kind: 'use', id: 'node-rimeholt', verb: 'chip' },
    { x: 18, y: 16, kind: 'use', id: 'cave-lamp-rack', verb: 'look' },
    { x: 16, y: 8, kind: 'use', id: 'gallery-mirror', verb: 'look' },
  ],
  warps: [
    { x: 47, y: 22, kind: 'edge', to: { mapId: 'thistlewind', x: 1, y: 22, facing: 'right' }, via: 'short-way', way: 'stones', tideWindow: 120, note: 'the stepping stones to Thistlewind (+-2 h)' },
    { x: 47, y: 8, kind: 'edge', to: { mapId: 'thistlewind', x: 1, y: 8, facing: 'right' }, via: 'long-way', note: 'the ice path, any tide' },
    { x: 16, y: 5, kind: 'door', to: { mapId: 'spire-mirror', x: 10, y: 12, facing: 'up' }, sfx: 'doorOpen', note: 'the Mirror Spire; its door back lands on (16,6)' },
  ],
  spawns: [
    { area: 'grass', table: 'rimeholt-land', rate: 0.1 },
    { area: { x: 4, y: 6, w: 24, h: 10 }, table: 'rimeholt-land', rate: 0.06, note: 'the caves: mirror-ice and cave floor (Lumenveil and Floeback lean here)' },
    { area: { x: 31, y: 27, w: 4, h: 3 }, table: 'rimeholt-water', rate: 0, via: 'hook', note: 'reaches hook this table through fishing' },
  ],
  regions: {
    'frostwick': { x: 29, y: 17, w: 14, h: 13 },
    'frostwick-dock': { x: 31, y: 25, w: 8, h: 5 },
    'the-glacier': { x: 1, y: 0, w: 28, h: 15 },
    'mirror-caves': { x: 3, y: 4, w: 26, h: 13 },
    'the-gallery': { x: 9, y: 6, w: 15, h: 5 },
    'moraine': { x: 4, y: 15, w: 10, h: 5 },
    'short-way-thistlewind': { x: 43, y: 20, w: 5, h: 5 },
    'long-way-thistlewind': { x: 36, y: 6, w: 12, h: 5 },
    'dig-site': { x: 4, y: 15, w: 10, h: 5 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'rimeholt-ice-quarry': { x: 33, y: 23, facing: 'up', trainer: 'rimeholt-hild' },
    'rimeholt-cave-mouth': { x: 16, y: 12, facing: 'down', trainer: 'rimeholt-oskar' },
    'rimeholt-ice-path': { x: 24, y: 19, facing: 'left', trainer: 'rimeholt-greer' },
    'rimeholt-polished-wall': { x: 5, y: 9, facing: 'right', trainer: 'rimeholt-sunniva' },
    'rimeholt-hermit-hut': { x: 6, y: 22, facing: 'up', trainer: 'rimeholt-aldous' },
    'rimeholt-frostwick-jetty': { x: 33, y: 21, facing: 'down', trainer: 'linnet-rimeholt' },
    // the dock: Waystone, tide chalkboard, ferry stop
    'ferry-stop': { x: 35, y: 29, facing: 'right' },
    'maud-punt': { x: 36, y: 29, water: true },
    // Brannoch's lamp rack at the cave mouth, signs
    'door-spire-mirror': { x: 16, y: 5 },
    'spire-mirror-step': { x: 16, y: 6, facing: 'up' },
    'spire-step': { x: 16, y: 6, facing: 'down', note: 'where the Spire\'s door lets you out (the Spire interiors\' toMarker)' },
    // arrivals
    'from-thistlewind-stones': { x: 46, y: 22, facing: 'left', tide: 'low' },
    'from-thistlewind-ice-path': { x: 46, y: 8, facing: 'left' },
    'frostwick-dock': { x: 35, y: 26, facing: 'down' },
    // route trainers at their posts (TRAINER_IDS)
    'trainer-rimeholt-hild': { x: 33, y: 23, facing: 'up', trainer: 'rimeholt-hild', note: 'Ice Cutter, on the lane down to the quay' },
    'trainer-rimeholt-oskar': { x: 16, y: 12, facing: 'down', trainer: 'rimeholt-oskar', note: 'Cave Lamp-bearer, in the tunnel' },
    'trainer-rimeholt-greer': { x: 24, y: 19, facing: 'left', trainer: 'rimeholt-greer', note: 'Glacier Guide, on the track below the glacier' },
    'trainer-rimeholt-sunniva': { x: 5, y: 9, facing: 'right', trainer: 'rimeholt-sunniva', optional: true, note: 'Mirror Polisher, in the west passage (declinable)' },
    'trainer-rimeholt-aldous': { x: 6, y: 22, facing: 'up', trainer: 'rimeholt-aldous', optional: true, note: 'Frost Hermit, at his hut (declinable)' },
    'trainer-linnet-rimeholt': { x: 33, y: 21, facing: 'down', trainer: 'linnet-rimeholt', note: 'Linnet returns in ermine (story, any result)' },
    // isle folk, leader posts, story staging
    'brannoch-cave-lamp': { x: 17, y: 17, facing: 'up', npc: 'brannoch-vey' },
    'seraphine-caves': { x: 15, y: 15, facing: 'down', npc: 'seraphine', note: 'the cave guide at the mouth' },
    'idris-gallery': { x: 17, y: 8, facing: 'left', npc: 'idris', note: 'Idris in the gallery explains the ring (script idris-gallery)' },
    'gallery-player': { x: 16, y: 10, facing: 'up' },
    'linnet-returns': { x: 33, y: 21, facing: 'down', npc: 'linnet', note: 'ermine, a balanced six, Sootling on her shoulder (script linnet-returns)' },
    'linnet-returns-player': { x: 33, y: 22, facing: 'up' },
    'cave-mouth': { x: 16, y: 16, facing: 'up' },
    'mirror-spire-door': { x: 16, y: 6, facing: 'up' },
  },
  reaches: [
    { id: 'reach-meltwater', kind: 'river', area: { x: 5, y: 13, w: 1, h: 5 }, creatureTable: 'rimeholt-water', name: 'Meltwater' },
    { id: 'reach-frostwick-harbour', kind: 'lagoon', area: { x: 31, y: 27, w: 4, h: 3 }, creatureTable: 'rimeholt-water', nightKind: 'sea', name: 'Frostwick Harbour' },
  ],
  dig: { spots: [[7, 15], [9, 15], [11, 15], [8, 16], [10, 16], [12, 16], [9, 17], [11, 17], [13, 17], [6, 18]], note: 'the moraine' },
  darkZones: [
    { id: 'mirror-caves', area: { x: 3, y: 4, w: 26, h: 12 }, lightRadius: 3, note: 'GDD-00 §4: the mirror-ice caves see 3 tiles round your lamp' },
  ],
  bugSpots: [
    { x: 26, y: 20, habitat: 'lanes' },
    { x: 34, y: 13, habitat: 'lanes' },
    { x: 4, y: 16, habitat: 'river' },
    { x: 8, y: 24, habitat: 'hedges' },
  ],
  music: null,
  light: { indoor: false, ambient: 'glacier' },
  entry: { x: 35, y: 26, facing: 'down' },
};

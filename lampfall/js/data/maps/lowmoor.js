/**
 * LOWMOOR — isle 1 (GDD-00 §4; GDD-01 §15.1). [DATA-MAPS] 48x32 tiles, wild Lv3-8, Waystone Brackenford.
 *
 * A low, wet isle west of Pellwick. North-east: the marsh, its reed beds and tidal creeks, crossed by the
 * marsh boardwalk from Pellwick (the long way, any tide) with the skyglass node glinting in the reeds.
 * East: the shingle spit with Linnet's rematch stones (a ring of four boulders), the Pellwick stepping
 * stones over the channel to the last dry rock (the short way, +-2 h), and the Brackenford flats (mud,
 * glow seams, pools: the two starters you did not pick live here). Centre: Brackenford on the cove where
 * the Brack meets the sea: Ford Street over the old ford (a stone bridge now), the old ferry pavilion with
 * Maud's practice table on its deck, the quay, the Waystone at the pier head and the ferry stop. North and
 * west: the meadows (tall grass), the spring pool the Brack rises from, the Turn Spire on its knoll.
 * South: the causeway to Cairnhold (short way, +-2.5 h) and the quarry road over the old stone bridge
 * (long way, any tide); the peat cuttings (dig site) in the south-west.
 *
 * Layers as GDD-01 §1.2 (detail: trees '8' '9', boulders '0', rocks 'o', bollards ')', lamps 'L',
 * crates 'c', barrels '(', glasswort 'i', seaweed 'l', bushes 'v'). DEFAULT_LEGEND only.
 * Generated once from a layout script, then hand-edited: edit the rows directly.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'lowmoor',
  name: 'Lowmoor',
  kind: 'exterior',
  region: 'lowmoor',
  w: 48,
  h: 32,
  legend: {},
  ground: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    'DDSSSSSSSSSSSSDDDDDDDDDDDDSSSSSSSSSSSSSSSSSSSSDD', //  0
    'DSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSAASSSSASSSSSSSSS', //  1
    'SSSSGGGGGGGASSSSSSSSSSSSSSSSAAAAUUUSSSSSUUUASSSS', //  2
    'SSSG33333GGAASSAAAASAASASAAAUUUUUrrUrrrSrUrrUUSS', //  3
    'SSAG33333GGuAAAAGGAAAAAAAUUUUUkkkkkkkkkkkkkkkkkk', //  4
    'SAAG33333GGuuGGGGGTTTTTTTUUUUUkUrrrrrrrSrUrrrrrU', //  5
    'SSAGs]s]sGGRRRRRgGTTTTTTTUUUUrkrrrrrrrrSrrUUrUUU', //  6
    'SSAGss"ssGGRRRRRGGTTTTTT44444UkrrSSSSSSSSSSSSrUG', //  7
    'SSSGGGfGGGGgGGRRGGGTTTTT44444SkSSSrrUUUrrrrrSrAU', //  8
    'SSSSGGfffGGGGGRRGGGG,GGG#%#%#UkUrrUrrrrrUUrrSSSS', //  9
    'SSSSATTTfPPPPPBBPPPPPPPG##+##Gk,UUUUUUUUUUAASSSS', // 10
    'SSAAATTTPTTTG,RRRRRGgGPG,TPTTTkGGASASASSSSSSSSSS', // 11
    'SSSATTTTPTTTGGGGGRRGGGPGGTPTTTkGGAASSSSSSSSSSSDD', // 12
    'SSSAATTTPTTGGGgGGRRGGGPPPPPPPPPGGGAASSSSDDDDDDDD', // 13
    'SSASATTTPTTT,GGg,RRG2222211111GGgGGAASSSDDDDDDDD', // 14
    'SSS2222TP4444444GRRG2222211111GGGGGGAASSSSSSSSSS', // 15
    'SSS2222TP4444444GRRG#%#%#${${$GGGGqqqqSSSSSSSSSS', // 16
    'DSSs]ssgP${${${$GRR,##+##$$+$$G,GqqqqqqSSSSSSSSS', // 17
    'DDSss@sAP$${"{$$GRRG,g,PGGGGGGGG,qqqqqqSSSSSSSSS', // 18
    'DDSSSPPP:OOOOOOOONNOOOOOOOOOOOOOOqqqqqqSSSSSSSSS', // 19
    'DSSSAAAA:ppppppppRRGGGGGGGGGGGgGGqqqqqqSSSSSSSSS', // 20
    'SSSS***G:QQQQQQQQNNQQQQQQQGGGGAAAqqqqqqSSSSSSqqS', // 21
    'SSSAAGGT:TTTGQQQQNNQQQQQQG::gGASSqqqqqqeeeeeeqqq', // 22
    'SSAAGG:::TTGGAAAARRSSKSAGGG:GGAASMMMMMMYMMMSSqqS', // 23
    'SSA;;G:GG;;;;ASSSSSSSKSAAGG:GGAMMYMMMMMMMMMMMSSS', // 24
    'SSS;;G:GG;;;;ASSSSSSDKSSAAG:GAAMMMMMMMMMMMMMMMMD', // 25
    'SSS;;G:GG;;;;ASSDDDDDKSSSAA:AMMMMMMMMMMMM~MMMMMM', // 26
    'DSSAAA:GGGGAASSSDDDDDKSSSSA:ASMMYMMYMMMMMMMMYMMD', // 27
    'DSSSSA:AAAAASSSSDDDDDDDSSSSESSYMMMMMMMMMMMMMMYMD', // 28
    'DSSSSSNSAASSSSSDDDDDDDDDSSSESSSMMMMMMMMMMMMMMDDD', // 29
    'DDDSSSNSSSSSSSDDDDDDDDDDDDDEDDDDDMMMMYMMMM~MDDDD', // 30
    'DDDDDDNSSSSSDDDDDDDDDDDDDDDqDDDDDDDDDDDDDDDDDDDD', // 31
  ],
  detail: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    '................................................', //  0
    '................................................', //  1
    '..........8.....................................', //  2
    '.........8.................8....................', //  3
    '........................9.......................', //  4
    '...........................ii...................', //  5
    '................................................', //  6
    '.............................i..................', //  7
    '...........9.........9..............i...........', //  8
    '...................9...........i........i.......', //  9
    '.................................i..............', // 10
    '.........v..........9...........9...............', // 11
    '.............9.....9............................', // 12
    '............v..9.................9..............', // 13
    '...............................8................', // 14
    '................................................', // 15
    '.................................o..............', // 16
    '......................................o.........', // 17
    '................L...L*.....v.L.....0.0..........', // 18
    '................................................', // 19
    '.........................8.........0.0..........', // 20
    '.........(..............(........o..............', // 21
    '....9.....c..).).........)......................', // 22
    '..................................l.............', // 23
    '..........................................l.....', // 24
    '..............................................l.', // 25
    '............9............8.........l..........l.', // 26
    '.......9......................l...............l.', // 27
    '...........8.....................l..l...........', // 28
    '................................................', // 29
    '................................................', // 30
    '................................................', // 31
  ],
  overlay: null,
  collision: null,
  props: [],
  entities: [
    // the dock: Waystone, tide chalkboard, ferry stop
    { kind: 'prop', id: 'brackenford', art: 'waystone', waystone: true, x: 22, y: 22, note: 'autosave, deferred Forecasts, heals once per tide (GDD-00 §4)' },
    { kind: 'prop', id: 'tide-board-lowmoor', art: 'tide-chalkboard', verb: 'tideTable', x: 23, y: 22 },
    { kind: 'boat', id: 'ferry-punt-lowmoor', x: 22, y: 27, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry stop: any tide, 05:00-01:00 (GDD-00 §4)' },
    // the skyglass node in the reeds beside the boardwalk
    { kind: 'prop', id: 'node-lowmoor', art: 'skyglass', node: true, x: 38, y: 5, note: '1-2 Starsalt; refills per badge (GDD-00 §4)' },
    // Maud's practice table on the pavilion deck; benches; signs
    { kind: 'prop', id: 'maud-practice-table', x: 14, y: 20, art: 'table', verb: 'look', note: 'the Reroll lesson (script maud-practice-table)' },
    { kind: 'prop', id: 'bench-pavilion', x: 10, y: 20, art: 'bench', verb: 'sit' },
    { kind: 'prop', id: 'bench-quay', x: 19, y: 20, art: 'bench', verb: 'sit' },
    { kind: 'prop', id: 'pavilion-tide-slate', x: 15, y: 18, art: 'tide-chalkboard', verb: 'tideTable', note: 'Hobb chalks the old ferry times beside the tide' },
    { kind: 'sign', id: 'sign-brackenford', x: 8, y: 18, art: 'signpost', text: 'Brackenford. The ford is a bridge now; the ferry is a punt. Both still go.' },
    { kind: 'sign', id: 'sign-turn-spire', x: 9, y: 9, art: 'signpost', text: 'The Turn Spire. Maud Tallis posts her Shifts on the door.' },
    { kind: 'sign', id: 'sign-pellwick-stones', x: 32, y: 17, art: 'signpost', text: 'Pellwick by the stepping stones. Dry two hours either side of low water.' },
    { kind: 'sign', id: 'sign-pellwick-boardwalk', x: 31, y: 12, art: 'signpost', text: 'Pellwick the long way: over the marsh boardwalk. Any tide.' },
    { kind: 'sign', id: 'sign-cairnhold-causeway', x: 28, y: 23, art: 'signpost', text: 'Cairnhold by the causeway. Dry two and a half hours either side of low water.' },
    { kind: 'sign', id: 'sign-quarry-road', x: 7, y: 22, art: 'signpost', text: 'The quarry road to Cairnhold. Any tide, if you have the legs.' },
    { kind: 'boat', id: 'pavilion-skiff', x: 15, y: 24, art: 'boat', note: 'the old ferry\'s skiff, hauled out and holed' },
  ],
  triggers: [
    { x: 22, y: 22, kind: 'use', id: 'waystone-brackenford', verb: 'waystone', waystone: 'brackenford' },
    { x: 23, y: 22, kind: 'use', id: 'tide-board-lowmoor', verb: 'tideTable' },
    { x: 22, y: 27, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 38, y: 5, kind: 'use', id: 'node-lowmoor', verb: 'chip' },
    { x: 14, y: 20, kind: 'use', id: 'maud-practice-table', verb: 'look' },
    { x: 15, y: 18, kind: 'use', id: 'pavilion-tide-slate', verb: 'tideTable' },
  ],
  warps: [
    { x: 47, y: 22, kind: 'edge', to: { mapId: 'pellwick', x: 1, y: 38, facing: 'right' }, via: 'short-way', way: 'stones', tideWindow: 120, note: 'the stepping stones to the point flats (+-2 h)' },
    { x: 47, y: 4, kind: 'edge', to: { mapId: 'pellwick', x: 13, y: 1, facing: 'down' }, via: 'long-way', note: 'the marsh boardwalk and the river footbridge, any tide' },
    { x: 27, y: 31, kind: 'edge', to: { mapId: 'cairnhold', x: 27, y: 1, facing: 'down' }, via: 'short-way', way: 'causeway', tideWindow: 150, note: 'the causeway to Cairnhold (+-2.5 h)' },
    { x: 6, y: 31, kind: 'edge', to: { mapId: 'cairnhold', x: 6, y: 1, facing: 'down' }, via: 'long-way', note: 'the quarry road over the old stone bridge, any tide' },
    { x: 6, y: 7, kind: 'door', to: { mapId: 'spire-turn', x: 10, y: 12, facing: 'up' }, sfx: 'doorOpen', note: 'the Turn Spire; its door back lands on (6,8)' },
  ],
  spawns: [
    { area: 'grass', table: 'lowmoor-land', rate: 0.1 },
    { area: 'mud', table: 'lowmoor-land', rate: 0.07, note: 'the Brackenford flats at low water: the two starters you did not pick (GDD-00 §3)' },
    { area: { x: 11, y: 6, w: 5, h: 2 }, table: 'lowmoor-water', rate: 0, via: 'hook', note: 'reaches hook this table through fishing' },
  ],
  regions: {
    'brackenford': { x: 8, y: 14, w: 27, h: 10 },
    'ferry-pavilion': { x: 9, y: 15, w: 8, h: 6 },
    'brackenford-dock': { x: 19, y: 21, w: 7, h: 7 },
    'the-marsh': { x: 23, y: 1, w: 25, h: 12 },
    'boardwalk': { x: 29, y: 3, w: 19, h: 10 },
    'brackenford-flats': { x: 29, y: 23, w: 18, h: 8 },
    'rematch-stones': { x: 33, y: 16, w: 6, h: 7 },
    'the-meadow': { x: 3, y: 9, w: 26, h: 6 },
    'turn-spire': { x: 3, y: 3, w: 7, h: 7 },
    'peat-cuttings': { x: 2, y: 23, w: 12, h: 5 },
    'short-way-pellwick': { x: 38, y: 20, w: 10, h: 5 },
    'long-way-pellwick': { x: 29, y: 3, w: 19, h: 3 },
    'short-way-cairnhold': { x: 26, y: 26, w: 3, h: 6 },
    'long-way-cairnhold': { x: 5, y: 22, w: 4, h: 10 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'lowmoor-reed-beds': { x: 34, y: 5, facing: 'up', trainer: 'lowmoor-osier' },
    'lowmoor-mud-bank': { x: 33, y: 20, facing: 'right', trainer: 'lowmoor-dunlin' },
    'lowmoor-pavilion-steps': { x: 21, y: 25, facing: 'up', trainer: 'lowmoor-colm' },
    'lowmoor-boardwalk-bend': { x: 31, y: 9, facing: 'left', trainer: 'lowmoor-perrin' },
    'lowmoor-pavilion-bench': { x: 11, y: 20, facing: 'right', trainer: 'lowmoor-tibby' },
    'lowmoor-rematch-stones': { x: 36, y: 19, facing: 'left', trainer: 'linnet-brackenford' },
    'lowmoor-brackenford-stones': { x: 21, y: 21, facing: 'down', trainer: 'corin-exhibition-1' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-corin-exhibition-1': { x: 21, y: 21, facing: 'down', trainer: 'corin-exhibition-1', note: 'optional exhibition, Act I: by the Brackenford Waystone' },
    // the dock: Waystone, tide chalkboard, ferry stop
    'ferry-stop': { x: 21, y: 27, facing: 'right' },
    'maud-punt': { x: 22, y: 27, water: true },
    // Maud's practice table on the pavilion deck; benches; signs
    'door-spire-turn': { x: 6, y: 7 },
    'spire-turn-step': { x: 6, y: 8, facing: 'up' },
    'spire-step': { x: 6, y: 8, facing: 'down', note: 'where the Spire\'s door lets you out (the Spire interiors\' toMarker)' },
    // arrivals
    'from-pellwick-stones': { x: 46, y: 22, facing: 'left', tide: 'low' },
    'from-pellwick-boardwalk': { x: 46, y: 4, facing: 'left' },
    'from-cairnhold-causeway': { x: 27, y: 30, facing: 'up', tide: 'low' },
    'from-cairnhold-road': { x: 6, y: 30, facing: 'up' },
    'brackenford-dock': { x: 21, y: 22, facing: 'down' },
    // route trainers at their posts (TRAINER_IDS)
    'trainer-lowmoor-osier': { x: 34, y: 5, facing: 'up', trainer: 'lowmoor-osier', note: 'Reed Cutter, in the reed beds under the boardwalk' },
    'trainer-lowmoor-perrin': { x: 31, y: 9, facing: 'left', trainer: 'lowmoor-perrin', note: 'Marsh Walker, where the boardwalk comes down' },
    'trainer-lowmoor-dunlin': { x: 33, y: 20, facing: 'right', trainer: 'lowmoor-dunlin', note: 'Mudlarker, on the spit above the flats' },
    'trainer-lowmoor-colm': { x: 21, y: 25, facing: 'up', trainer: 'lowmoor-colm', optional: true, note: 'Ferry Hand, on the pier (declinable)' },
    'trainer-lowmoor-tibby': { x: 11, y: 20, facing: 'right', trainer: 'lowmoor-tibby', optional: true, note: 'Pavilion Regular, on the deck (declinable)' },
    // isle folk, leader and rival posts
    'hobb-pavilion': { x: 12, y: 19, facing: 'down', npc: 'hobb-fallow' },
    'hobb-tide-board': { x: 24, y: 22, facing: 'up', npc: 'hobb-fallow', note: 'chalking the Waystone board' },
    'maud-practice-table': { x: 15, y: 20, facing: 'left', npc: 'maud', note: 'Maud behind the table; the player stands at practice-table-player' },
    'practice-table-player': { x: 13, y: 20, facing: 'right' },
    'maud-brackenford-pier': { x: 21, y: 26, facing: 'down', npc: 'maud' },
    'linnet-rematch-stones': { x: 36, y: 19, facing: 'left', npc: 'linnet', note: 'inside the ring of four stones' },
    'trainer-linnet-brackenford': { x: 36, y: 19, facing: 'left', trainer: 'linnet-brackenford' },
    'rematch-player': { x: 34, y: 19, facing: 'right' },
    'linnet-decline': { x: 37, y: 21, facing: 'left', npc: 'linnet', note: 'day 2: she Declines until badge 1' },
    'corin-lowmoor-stones': { x: 38, y: 22, facing: 'right', npc: 'corin', note: 'on the stones at the low: two wilds, Lv8, the first Forecast' },
    'corin-first-forecast': { x: 36, y: 22, facing: 'right' },
    'wick-lowmoor': { x: 22, y: 21, facing: 'down', npc: 'wick' },
    'turn-spire-door': { x: 6, y: 8, facing: 'up' },
    'pavilion-door': { x: 12, y: 18 },
    'pellwick-view': { x: 44, y: 4, facing: 'right', note: 'end of the boardwalk: the dark lighthouse on the horizon' },
  },
  reaches: [
    { id: 'reach-brack', kind: 'river', area: { x: 11, y: 6, w: 5, h: 2 }, creatureTable: 'lowmoor-water', name: 'The Brack' },
    { id: 'reach-flats-channel', kind: 'flats', area: { x: 39, y: 17, w: 6, h: 4 }, creatureTable: 'lowmoor-water', nightKind: 'sea', name: 'Stones Channel' },
  ],
  dig: { spots: [[9, 24], [10, 25], [11, 26], [12, 24], [3, 24], [4, 26], [10, 26], [12, 25]], note: 'the peat cuttings' },
  flats: { spots: [[33, 23], [35, 23], [36, 23], [37, 23], [38, 23], [39, 23], [40, 23], [41, 23], [42, 23], [31, 24], [32, 24], [33, 24], [34, 24], [35, 24], [36, 24], [37, 24], [38, 24], [39, 24], [40, 24], [41, 24], [43, 24], [44, 24], [31, 25], [32, 25], [33, 25], [34, 25], [35, 25], [36, 25], [37, 25], [38, 25], [39, 25], [40, 25], [41, 25], [42, 25], [43, 25], [44, 25], [45, 25], [29, 26], [30, 26], [31, 26], [32, 26], [33, 26], [34, 26], [36, 26], [37, 26], [38, 26], [39, 26], [40, 26], [42, 26], [43, 26], [44, 26], [45, 26], [31, 27], [32, 27], [33, 27], [34, 27], [35, 27], [36, 27], [37, 27], [38, 27], [39, 27], [40, 27], [41, 27], [42, 27], [43, 27], [44, 27], [45, 27], [30, 28], [31, 28], [32, 28], [34, 28], [35, 28], [37, 28], [38, 28], [39, 28], [40, 28], [41, 28], [42, 28], [43, 28], [44, 28], [45, 28], [46, 28], [31, 29], [32, 29], [33, 29], [34, 29], [35, 29], [36, 29], [37, 29], [38, 29], [39, 29], [40, 29], [41, 29], [42, 29], [43, 29], [44, 29], [33, 30], [34, 30], [35, 30], [36, 30], [37, 30], [38, 30], [39, 30], [40, 30], [41, 30], [43, 30]], glint: false, skyglass: false, cockles: { item: 'cockle' } },
  bugSpots: [
    { x: 33, y: 6, habitat: 'reeds' },
    { x: 41, y: 9, habitat: 'reeds' },
    { x: 36, y: 3, habitat: 'reeds' },
    { x: 13, y: 8, habitat: 'river' },
    { x: 16, y: 14, habitat: 'river' },
    { x: 34, y: 24, habitat: 'flats' },
    { x: 40, y: 27, habitat: 'flats' },
    { x: 6, y: 13, habitat: 'lanes' },
    { x: 22, y: 12, habitat: 'lanes' },
    { x: 3, y: 10, habitat: 'hedges' },
  ],
  music: null,
  light: { indoor: false, ambient: 'marsh' },
  entry: { x: 21, y: 22, facing: 'down' },
};

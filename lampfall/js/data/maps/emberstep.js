/**
 * EMBERSTEP — isle 3 (GDD-00 §4; GDD-01 §15.3). [DATA-MAPS] 48x32 tiles, wild Lv15-20, Waystone Sulphur Cross.
 *
 * The volcanic isle. Centre-north: the volcano, an ash cone with a basalt rim round a crater of hot pools
 * and ember vents; the volcano path climbs from Sulphur Cross to the lookout notch in the south rim (the
 * skyglass node, the first Errant sighting). South-west flank: the spa terraces, three stepped bands of
 * hot pools behind basalt lips, joined by a stair, down to Sulphur Cross: the square and its sulphur-
 * yellow cross, Ines's spa house, the quay, the pier and ferry stop, the Waystone. West: the black-sand
 * beach with the stepping stones from Cairnhold (short way, +-2 h), the headland with the Weather Spire,
 * and the cliff path along the north-west cliffs from Cairnhold (long way, any tide). North: the mangrove
 * boardwalk to Drownwood (long way, any tide) and, north-east, the causeway (short way, +-2.5 h). East:
 * the Sulphur Burn and the ash fields (dig site).
 *
 * Map-only legend chars: 'X' basalt, 'Y' ember vent (detail), '?' spa terrace, 'x' spa-terrace lip,
 * 'Z' mangrove (detail) (they override glow mud, mirror-ice, ice and the weir, which Emberstep never
 * paints). 'J' in the crater and on the terraces is hot-spring water. Beaches are ash ('>', black sand).
 * Generated once from a layout script, then hand-edited: edit the rows directly.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'emberstep',
  name: 'Emberstep',
  kind: 'exterior',
  region: 'emberstep',
  w: 48,
  h: 32,
  legend: { X: 'basalt', Y: 'ember-vent', '?': 'spa-terrace', x: 'spa-terrace-lip', Z: 'mangrove' },
  ground: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    'DDDDDDDDDDDDkDDDDDDDDDDDDDDDDDDDDDDDSSSS>SSSSDDD', //  0
    'DDDDDDDDDDDDkDDDDDSSSSSSSSSSSSSDDDDSSSSSESSSSSSD', //  1
    'DDDDDSSSSSSSkSSSSSSSSSSSSSSSSSSSSDSSSSSSESSSSSSD', //  2
    'DDSSSSSSSSSSkSSSSSSS>>>>S>SS>SSSSSSSS>>GPG>>>SSD', //  3
    'SSSSSSS>S>SSkSS>S>>>S>G>>>>>S>>SSSSS>>gGPGGG>SSD', //  4
    'CCCSCCCCCCCCkSS>>>T>>>>>>>>XXXXXXX>>>>G>PGgG>SSD', //  5
    'CCCCChCCCCCCPC>>GGTTTT>>>>XXXXXXXXX>>PPPPGG>>SSD', //  6
    'CCCCCCCCChCCPCGGGGTTT>>>>XXXJJJJJXXX>P<>Gg>>SSSD', //  7
    'PPPPPPPPPPPPGTTTTGG>>>>>XXXJ>JJJJ>XXXP>>>G>SSSSD', //  8
    'CCCCGGGGGGGPTTTTTTgG>>>>XXJ>JJJ>JJXXXP>>>>>SSSSD', //  9
    'CCCCgGGGGGGPTTTTTTG>>>>>XXXJJ>JJ>JXXXP>>>G>SSSSD', // 10
    'SSS>ggGGGgGPTTTTTTGG>>>>>XXXJJJJJXXX>P>>>G<>>SSS', // 11
    'SSSG66666GGPPTTTGGGG>>>>>>XXXXXXXXX>>P><>>G>>SSS', // 12
    'SSSS66666GGPGxxxxxxxxxxx>>>>XfffX>>>>PRRRRG>S>SS', // 13
    'DSSS66666GGPg?JJJJ?JJJJ?>><>>>P>>>><<P>>GRG>S>SS', // 14
    'DDSSs]s]sGGPG???????????>>PPPPP>>>>>PPPPPNPPPSSS', // 15
    'DDSSss"ssGGPGxxxxxHxxxxx>>P>>><>>>>>G>GGGRG>>>SS', // 16
    'DSSSGGfGGGGPG?JJJ???JJJ?G777777>>g>>>>GGGRG>S>SS', // 17
    'SSSSGGfffffPg???????????G777777GG>>>>>>>GRRRRSSS', // 18
    'SSSS>>>GGGfPGxxxxxHxxxxxG${${$1111>>>>>>>>>>RSSS', // 19
    '>eeePPPPPPfGGGGGGGHGGGggG$$+${1111>>>>>>G>S>RSDD', // 20
    'SSSS>>>>>>ffffffOOOOOOOOOOOOOO#%##G>>>G>>>>SRSDD', // 21
    'SSSSSSSSSS>TGGGPGGGOOOOOOGGGgg#+%#TTTT>>S>SSRRRD', // 22
    'DDDSSSSSSS>>>GGPGGGOOOOOOGGGGGGPGTTTTT>S>SSSSDDD', // 23
    'DDDDDDDDSSSS>PPPGggOOOOOOGGGGGGPgTTT>>>SSSSSDDDD', // 24
    'DDDDDDDDSSSS>S>>QQQQQQQQQQQQQQ>P>>>>>SSSSSSDDDDD', // 25
    'DDDDDDDDDDSSSSSSQQQQQQQQQQQQQQSS>S>SSSSSSDDDDDDD', // 26
    'DDDDDDDDDDSSSSSSSSSSSSKSSSSSSSSSSSSSSSSDDDDDDDDD', // 27
    'DDDDDDDDDDDDDDDSSSSSSSKSSSSSSSSSSSSSSDDDDDDDDDDD', // 28
    'DDDDDDDDDDDDDDDSSSSSSSKSSSSSSSSSSDDDDDDDDDDDDDDD', // 29
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 30
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 31
  ],
  detail: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    '...........Z..Z.................................', //  0
    '..........Z.....................................', //  1
    '..........Z..ZZ.................................', //  2
    '...........Z...........8.................8......', //  3
    '..........Z..ZZ...8.............................', //  4
    '................8..........................8....', //  5
    '................................................', //  6
    '................................................', //  7
    '...............8............Y....Y........o.....', //  8
    '....................o......Y...Y................', //  9
    '.............................Y..Y...............', // 10
    '.................8....o....................8....', // 11
    '................................................', // 12
    '................................................', // 13
    '................................................', // 14
    '.........8......................................', // 15
    '................................................', // 16
    '................................................', // 17
    '................................................', // 18
    '................................................', // 19
    '................................................', // 20
    '........8............................o..........', // 21
    '................L.................o.............', // 22
    '.........................L......................', // 23
    '................................................', // 24
    '............8...(............c..................', // 25
    '.................).........).)..................', // 26
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
    { kind: 'prop', id: 'sulphur-cross', art: 'waystone', waystone: true, x: 23, y: 25, note: 'autosave, deferred Forecasts, heals once per tide (GDD-00 §4)' },
    { kind: 'prop', id: 'tide-board-emberstep', art: 'tide-chalkboard', verb: 'tideTable', x: 24, y: 25 },
    { kind: 'boat', id: 'ferry-punt-emberstep', x: 23, y: 29, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry stop: any tide, 05:00-01:00 (GDD-00 §4)' },
    // the skyglass node on the crater rim beside the lookout
    { kind: 'prop', id: 'node-emberstep', art: 'skyglass', node: true, x: 28, y: 13, note: '1-2 Starsalt; refills per badge (GDD-00 §4)' },
    // the cross, the spa gate, signs
    { kind: 'prop', id: 'the-cross', x: 21, y: 23, art: 'standing-stone', verb: 'look', note: 'the sulphur-yellow stone cross the village is named for' },
    { kind: 'prop', id: 'spa-bench', x: 20, y: 20, art: 'bench', verb: 'sit' },
    { kind: 'prop', id: 'spa-brazier', x: 24, y: 22, art: 'brazier', verb: 'look' },
    { kind: 'sign', id: 'sign-sulphur-cross', x: 15, y: 22, art: 'signpost', text: 'Sulphur Cross. Hot water, cold beer, warm weather on Tuesdays.' },
    { kind: 'sign', id: 'sign-weather-spire', x: 7, y: 18, art: 'signpost', text: 'The Weather Spire. Ines Calloway posts the next three turns of sky.' },
    { kind: 'sign', id: 'sign-volcano', x: 25, y: 19, art: 'signpost', text: 'To the crater lookout. The mountain is asleep. Do not wake it.' },
    { kind: 'sign', id: 'sign-drownwood-causeway', x: 39, y: 4, art: 'signpost', text: 'Drownwood by the causeway. Dry two and a half hours either side of low water.' },
    { kind: 'sign', id: 'sign-mangrove-boardwalk', x: 13, y: 7, art: 'signpost', text: 'Drownwood the long way: the mangrove boardwalk. Any tide.' },
    { kind: 'sign', id: 'sign-cairnhold-stones', x: 5, y: 21, art: 'signpost', text: 'Cairnhold by the stones. Dry two hours either side of low water.' },
  ],
  triggers: [
    { x: 23, y: 25, kind: 'use', id: 'waystone-sulphur-cross', verb: 'waystone', waystone: 'sulphur-cross' },
    { x: 24, y: 25, kind: 'use', id: 'tide-board-emberstep', verb: 'tideTable' },
    { x: 23, y: 29, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 28, y: 13, kind: 'use', id: 'node-emberstep', verb: 'chip' },
    { x: 21, y: 23, kind: 'use', id: 'the-cross', verb: 'look' },
    { x: 30, y: 13, kind: 'use', id: 'crater-lookout', verb: 'look', note: 'the ring of isles from the rim; Squallcoil\'s lightning when it is near' },
  ],
  warps: [
    { x: 0, y: 20, kind: 'edge', to: { mapId: 'cairnhold', x: 46, y: 20, facing: 'left' }, via: 'short-way', way: 'stones', tideWindow: 120, note: 'the stepping stones to Cairnhold (+-2 h)' },
    { x: 0, y: 8, kind: 'edge', to: { mapId: 'cairnhold', x: 46, y: 8, facing: 'left' }, via: 'long-way', note: 'the cliff path, any tide' },
    { x: 40, y: 0, kind: 'edge', to: { mapId: 'drownwood', x: 40, y: 30, facing: 'up' }, via: 'short-way', way: 'causeway', tideWindow: 150, note: 'the causeway to Drownwood (+-2.5 h)' },
    { x: 12, y: 0, kind: 'edge', to: { mapId: 'drownwood', x: 12, y: 30, facing: 'up' }, via: 'long-way', note: 'the mangrove boardwalk, any tide' },
    { x: 6, y: 16, kind: 'door', to: { mapId: 'spire-weather', x: 10, y: 12, facing: 'up' }, sfx: 'doorOpen', note: 'the Weather Spire; its door back lands on (6,17)' },
  ],
  spawns: [
    { area: 'grass', table: 'emberstep-land', rate: 0.1 },
    { area: { x: 16, y: 27, w: 6, h: 3 }, table: 'emberstep-water', rate: 0, via: 'hook', note: 'reaches hook this table through fishing' },
  ],
  regions: {
    'sulphur-cross': { x: 11, y: 17, w: 24, h: 13 },
    'sulphur-cross-dock': { x: 16, y: 25, w: 14, h: 5 },
    'spa-terraces': { x: 13, y: 13, w: 11, h: 7 },
    'the-volcano': { x: 19, y: 2, w: 23, h: 16 },
    'crater-lookout': { x: 27, y: 12, w: 6, h: 3 },
    'ash-fields': { x: 32, y: 16, w: 9, h: 6 },
    'weather-spire': { x: 3, y: 12, w: 7, h: 7 },
    'cliff-path': { x: 0, y: 6, w: 12, h: 4 },
    'black-sand': { x: 0, y: 17, w: 9, h: 6 },
    'short-way-cairnhold': { x: 0, y: 18, w: 4, h: 5 },
    'long-way-cairnhold': { x: 0, y: 7, w: 12, h: 3 },
    'short-way-drownwood': { x: 38, y: 0, w: 5, h: 4 },
    'long-way-drownwood': { x: 9, y: 0, w: 7, h: 8 },
    'dig-site': { x: 32, y: 16, w: 9, h: 6 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'emberstep-lower-terrace': { x: 16, y: 15, facing: 'down', trainer: 'emberstep-asha' },
    'emberstep-ash-cut': { x: 35, y: 18, facing: 'left', trainer: 'emberstep-kip' },
    'emberstep-chimney-ledge': { x: 7, y: 8, facing: 'left', trainer: 'emberstep-roswitha' },
    'emberstep-pipe-yard': { x: 30, y: 15, facing: 'down', trainer: 'emberstep-tobiah' },
    'emberstep-raft-flyer': { x: 7, y: 20, facing: 'left', trainer: 'emberstep-marl' },
    'emberstep-sulphur-cross-bench': { x: 22, y: 24, facing: 'down', trainer: 'corin-exhibition-2' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-corin-exhibition-2': { x: 22, y: 24, facing: 'down', trainer: 'corin-exhibition-2', note: 'optional exhibition, Act II: by the Sulphur Cross Waystone' },
    // the dock: Waystone, tide chalkboard, ferry stop
    'ferry-stop': { x: 22, y: 29, facing: 'right' },
    'maud-punt': { x: 23, y: 29, water: true },
    // the cross, the spa gate, signs
    'door-spire-weather': { x: 6, y: 16 },
    'spire-weather-step': { x: 6, y: 17, facing: 'up' },
    'spire-step': { x: 6, y: 17, facing: 'down', note: 'where the Spire\'s door lets you out (the Spire interiors\' toMarker)' },
    // arrivals
    'from-cairnhold-stones': { x: 1, y: 20, facing: 'right', tide: 'low' },
    'from-cairnhold-cliff': { x: 1, y: 8, facing: 'right' },
    'from-drownwood-causeway': { x: 40, y: 1, facing: 'down', tide: 'low' },
    'from-drownwood-boardwalk': { x: 12, y: 1, facing: 'down' },
    'sulphur-cross-dock': { x: 22, y: 25, facing: 'down' },
    // route trainers at their posts (TRAINER_IDS)
    'trainer-emberstep-asha': { x: 16, y: 15, facing: 'down', trainer: 'emberstep-asha', note: 'Spa Bather, on the top terrace walk' },
    'trainer-emberstep-kip': { x: 35, y: 18, facing: 'left', trainer: 'emberstep-kip', note: 'Ash Shoveller, in the ash fields' },
    'trainer-emberstep-roswitha': { x: 7, y: 8, facing: 'left', trainer: 'emberstep-roswitha', optional: true, note: 'Cliff Climber, on the cliff path (declinable)' },
    'trainer-emberstep-tobiah': { x: 30, y: 15, facing: 'down', trainer: 'emberstep-tobiah', note: 'Steam Fitter, on the volcano path below the lookout' },
    'trainer-emberstep-marl': { x: 7, y: 20, facing: 'left', trainer: 'emberstep-marl', optional: true, note: 'Scatter Volunteer, on the black-sand beach (declinable; forces a posted Shift on his own side)' },
    // isle folk, leader posts, story staging
    'gorse-spa': { x: 19, y: 20, facing: 'down', npc: 'gorse-abernethy', note: 'at the foot of the terrace stair' },
    'ines-spa': { x: 27, y: 21, facing: 'down', npc: 'ines' },
    'spa-house-door': { x: 27, y: 20 },
    'errant-sighting': { x: 30, y: 13, facing: 'up', note: 'the crater lookout (script first-errant-sighting)' },
    'errant-sighting-player': { x: 30, y: 14, facing: 'up' },
    'weather-spire-door': { x: 6, y: 17, facing: 'up' },
    'the-cross-step': { x: 21, y: 24, facing: 'up' },
  },
  reaches: [
    { id: 'reach-sulphur-cove', kind: 'lagoon', area: { x: 16, y: 27, w: 6, h: 3 }, creatureTable: 'emberstep-water', nightKind: 'sea', name: 'Sulphur Cove' },
    { id: 'reach-sulphur-burn', kind: 'river', area: { x: 41, y: 16, w: 1, h: 3 }, creatureTable: 'emberstep-water', name: 'Sulphur Burn' },
  ],
  dig: { spots: [[32, 16], [37, 17], [34, 18], [38, 18], [35, 19], [39, 19], [36, 20], [38, 22]], note: 'the ash fields' },
  bugSpots: [
    { x: 14, y: 10, habitat: 'lanes' },
    { x: 9, y: 23, habitat: 'lanes' },
    { x: 36, y: 23, habitat: 'lanes' },
    { x: 42, y: 17, habitat: 'river' },
    { x: 20, y: 6, habitat: 'hedges' },
  ],
  music: null,
  light: { indoor: false, ambient: 'volcanic' },
  entry: { x: 22, y: 25, facing: 'down' },
};

/**
 * THISTLEWIND — isle 5 (GDD-00 §4; GDD-01 §15.5). [DATA-MAPS] 48x32 tiles, wild Lv29-34, Waystone Windle.
 *
 * The high moor. North: the ridge walk past the windmills (landmarks from anywhere on the moor) and the
 * Relay Spire; the walkers' cairn and the skyglass node on the heather. Centre and west: open moor
 * (heather, thistles, gorse), the tarn and the Tarn Beck running north to the bay, the moor road to the west
 * coast, the barrow diggings (dig site). West: the ice path over the frozen strait to Rimeholt (the long
 * way, any tide) and the stepping stones (the short way, +-2 h). South: the moor footbridge in from
 * Drownwood (the long way, any tide) and the causeway (the short way, +-2.5 h). East: Windle: Weft Lane
 * (the street the Surge Shifts in one night), Rook Hayward's mill, the quay, the Waystone, the ferry stop.
 *
 * DEFAULT_LEGEND only ('x' is the ice path's ice). Generated once from a layout script, then hand-edited.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'thistlewind',
  name: 'Thistlewind',
  kind: 'exterior',
  region: 'thistlewind',
  w: 48,
  h: 32,
  legend: {},
  ground: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    'DDDDDDDDDDDDDDDDDDDDSSSSSSDDDDDDDDDDDDDDDDDDDDDD', //  0
    'DDDDDDDDDDDDDDDDDDSSSSSSSSSSSSSSDDDDDDDDDDDDDDDD', //  1
    'DDDDDDDDDDDDSSSSSSSSSSqqSSSSSSSSSSDDDDDDDDDDDDDD', //  2
    'DDDDDSSSSSSSSSSSSSRSqSqq66666qSSSSSSSSDDDDDDDDDD', //  3
    'DSSSSSSSSSSSSSqqSqRqqqqF66666SSqSSSSSSSSSDDDDDDD', //  4
    'SSSSSSSqSSSSqqqqqqRTTT,F66666FqqqqSqSSSSSSDDDDDD', //  5
    'SSSqqqqqqqqqqFFFFFRFPPPFs]s]sFPnnqqqqSqSSSSDDDDD', //  6
    'SSSqFFFFFFnnnnnnnnRFPF,Fss"ssFPnnnnnqqqqSSSDDDDD', //  7
    'xxxPFFFFnnnnnnnnnnRFPFFFFFfFFFPnnnnnnnFqqSSSSDDD', //  8
    'SSSPFFFFFnnnnnnnnnRFPFFFFFfFFFPnnnnn44447777SDDD', //  9
    'SSSPqqFFFnnnnnnnnnRFPFFFFFfFFFPnnnnF44447777SSDD', // 10
    'SSSSSqFF,FnnnnnnnFRFPFFFFFPFFFP,FFFFs]ss#%##SSSD', // 11
    'DSSSPPPPPPPPPPPPPPNPPPPPPPPPPPPPPPPFs@]s##+#SSSD', // 12
    'DSSqqPFFFFFFPFF,FFRFFFFFFFFF,F,FFGOOOOOOOOOOqSSS', // 13
    'DSSqFPFFFFFFPF,FuuuuuFFFFFFFF,FFFGOOOOOOOOOOqSSS', // 14
    'DSSqqPFFFFFFPFFFuuuuuFFFF,FFFFFFFGO44446666OqqSS', // 15
    'DSSSqPFFFFFFPFFFFuuuFFFFFFF,FFFF,GO44446666OFqSS', // 16
    'DSSqqPFFFFFFPFFFFFFFFFFFFFFFFFFFFGO#%###%##OFqSS', // 17
    'DSSSSPFFFFn,PFFFFF,FFFFFFFFFF,FFFGO#+%###+#PqqSS', // 18
    'SSSSqP,FFnnnPnFFFFFFFFTTTTTFFFFFFGPGGGGGGGqPSSSS', // 19
    'SSSqqPFFFnnnPnnF,FF,FTTTTTTT,FFFFGPGGGGGGGqPSSSS', // 20
    'SSSqFPFFnnnnPnFFFFFFFFTTTTTFFFFFFGPGGGGGGGqPSDDD', // 21
    'qeeqPPFFFFFnPFF;;;;;FFFF,F,FFFF,,PPQQQQQQQQQSDDD', // 22
    'SSSqqqqFFFFFPFF;;;;;FFFFFFFFFFFFFPFQQQQQQQQQSDDD', // 23
    'SSSSSSqFFFFFPFF;;;;;FFFFFF,FFFPPPPFSSSSSKSSSSDDD', // 24
    'DSSSSSqFFFFFPFFFFF,FFFFFFFFFFFP,FFqSSSSSKSSSSDDD', // 25
    'DDDDSSqFFFFFPFqqqqqqqqqqqqFFFFPFFFqSSSSSKSSSDDDD', // 26
    'DDDDSSqqFFFFPqqSSSSqqSSqSqqqFFqFFqqSSSSDDDDDDDDD', // 27
    'DDDDSSSqqFPPPqSSSSSSSSSSSSSqqSESqqSSSDDDDDDDDDDD', // 28
    'DDDDSSSSqqPqqSSSSSSSSSSSSSSSSSESSSSSSDDDDDDDDDDD', // 29
    'DDDDDSSSSSBSSSSSDDDDDDDDDSSSSSESSSSSDDDDDDDDDDDD', // 30
    'DDDDDDSSSSBSSSSDDDDDDDDDDDDDSSqSSDDDDDDDDDDDDDDD', // 31
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
    '.......t........................................', //  8
    '......t...............t.........................', //  9
    '................................................', // 10
    '.................y..............................', // 11
    '................................................', // 12
    '........tt.........................L......L.....', // 13
    '...........................t....................', // 14
    '.......t.y.............t........t...........9...', // 15
    '......y.........................................', // 16
    '................................................', // 17
    '.......t0......y...............t.9..............', // 18
    '.............................t..................', // 19
    '.............................t.y.....9...9......', // 20
    '....t.........t....tt...........................', // 21
    '...........................y..t....c.......(....', // 22
    '...............................t....)......)....', // 23
    '...........t....................................', // 24
    '.......y........t.....y.........................', // 25
    '..............y.0..........t....................', // 26
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
    { kind: 'prop', id: 'windle', art: 'waystone', waystone: true, x: 37, y: 22, note: 'autosave, deferred Forecasts, heals once per tide (GDD-00 §4)' },
    { kind: 'prop', id: 'tide-board-thistlewind', art: 'tide-chalkboard', verb: 'tideTable', x: 38, y: 22 },
    { kind: 'boat', id: 'ferry-punt-thistlewind', x: 41, y: 26, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry stop: any tide, 05:00-01:00 (GDD-00 §4)' },
    // the skyglass node at the cairn on the high moor
    { kind: 'prop', id: 'node-thistlewind', art: 'skyglass', node: true, x: 31, y: 9, note: '1-2 Starsalt; refills per badge (GDD-00 §4)' },
    // the windmills along the ridge (landmarks), Rook's mill in Windle, signs
    { kind: 'prop', id: 'windmill-west', x: 20, y: 5, art: 'windmill', verb: 'look', note: 'sails turn with the weather' },
    { kind: 'prop', id: 'windmill-ridge', x: 30, y: 5, art: 'windmill', verb: 'look' },
    { kind: 'prop', id: 'windmill-far', x: 14, y: 11, art: 'windmill', verb: 'look' },
    { kind: 'prop', id: 'windmill-windle', x: 44, y: 16, art: 'windmill', verb: 'look', note: 'Rook Hayward\'s mill' },
    { kind: 'prop', id: 'moor-cairn', x: 32, y: 10, art: 'rock-b', verb: 'look', note: 'a walkers\' cairn, a stone added for every crossing' },
    { kind: 'sign', id: 'sign-windle', x: 33, y: 14, art: 'signpost', text: 'Windle. Weft Lane, the mill, the quay.' },
    { kind: 'sign', id: 'sign-relay-spire', x: 27, y: 10, art: 'signpost', text: 'The Relay Spire. Ada and Ivo Halloran. No move twice.' },
    { kind: 'sign', id: 'sign-ice-path', x: 4, y: 9, art: 'signpost', text: 'Rimeholt the long way: the ice path. Any tide. Slippery.' },
    { kind: 'sign', id: 'sign-rimeholt-stones', x: 4, y: 21, art: 'signpost', text: 'Rimeholt by the stones. Dry two hours either side of low water.' },
    { kind: 'sign', id: 'sign-drownwood-causeway', x: 31, y: 25, art: 'signpost', text: 'Drownwood by the causeway. Dry two and a half hours either side of low water.' },
    { kind: 'sign', id: 'sign-moor-footbridge', x: 11, y: 27, art: 'signpost', text: 'Drownwood the long way: the moor footbridge. Any tide.' },
  ],
  triggers: [
    { x: 37, y: 22, kind: 'use', id: 'waystone-windle', verb: 'waystone', waystone: 'windle' },
    { x: 38, y: 22, kind: 'use', id: 'tide-board-thistlewind', verb: 'tideTable' },
    { x: 41, y: 26, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 31, y: 9, kind: 'use', id: 'node-thistlewind', verb: 'chip' },
    { x: 44, y: 16, kind: 'use', id: 'windmill-windle', verb: 'look' },
  ],
  warps: [
    { x: 30, y: 31, kind: 'edge', to: { mapId: 'drownwood', x: 30, y: 1, facing: 'down' }, via: 'short-way', way: 'causeway', tideWindow: 150, note: 'the causeway to Drownwood (+-2.5 h)' },
    { x: 10, y: 31, kind: 'edge', to: { mapId: 'drownwood', x: 10, y: 1, facing: 'down' }, via: 'long-way', note: 'the moor footbridge, any tide' },
    { x: 0, y: 22, kind: 'edge', to: { mapId: 'rimeholt', x: 46, y: 22, facing: 'left' }, via: 'short-way', way: 'stones', tideWindow: 120, note: 'the stepping stones to Rimeholt (+-2 h)' },
    { x: 0, y: 8, kind: 'edge', to: { mapId: 'rimeholt', x: 46, y: 8, facing: 'left' }, via: 'long-way', note: 'the ice path, any tide' },
    { x: 26, y: 7, kind: 'door', to: { mapId: 'spire-relay', x: 10, y: 12, facing: 'up' }, sfx: 'doorOpen', note: 'the Relay Spire; its door back lands on (26,8)' },
  ],
  spawns: [
    { area: 'grass', table: 'thistlewind-land', rate: 0.1 },
    { area: { x: 35, y: 24, w: 5, h: 3 }, table: 'thistlewind-water', rate: 0, via: 'hook', note: 'reaches hook this table through fishing' },
  ],
  regions: {
    'windle': { x: 33, y: 9, w: 12, h: 15 },
    'weft-lane': { x: 34, y: 13, w: 10, h: 2 },
    'windle-dock': { x: 35, y: 22, w: 9, h: 5 },
    'the-moor': { x: 3, y: 3, w: 30, h: 22 },
    'the-ridge': { x: 18, y: 3, w: 15, h: 5 },
    'relay-spire': { x: 23, y: 3, w: 7, h: 6 },
    'the-tarn': { x: 15, y: 13, w: 7, h: 4 },
    'barrow-diggings': { x: 14, y: 21, w: 7, h: 5 },
    'short-way-drownwood': { x: 29, y: 27, w: 3, h: 5 },
    'long-way-drownwood': { x: 9, y: 27, w: 4, h: 5 },
    'short-way-rimeholt': { x: 0, y: 20, w: 4, h: 5 },
    'long-way-rimeholt': { x: 0, y: 6, w: 5, h: 5 },
    'dig-site': { x: 14, y: 21, w: 7, h: 5 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'thistlewind-mill-race': { x: 43, y: 17, facing: 'right', trainer: 'thistlewind-ned' },
    'thistlewind-kite-hill': { x: 22, y: 6, facing: 'down', trainer: 'thistlewind-lark' },
    'thistlewind-sheepfold': { x: 12, y: 18, facing: 'up', trainer: 'thistlewind-cuthbert' },
    'thistlewind-sail-loft': { x: 41, y: 22, facing: 'right', trainer: 'thistlewind-maisie' },
    'thistlewind-surge-street': { x: 38, y: 14, facing: 'down', trainer: 'thistlewind-gideon' },
    'thistlewind-windle-mill-steps': { x: 40, y: 22, facing: 'down', trainer: 'corin-exhibition-3' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-corin-exhibition-3': { x: 40, y: 22, facing: 'down', trainer: 'corin-exhibition-3', note: 'optional exhibition, Act III: by the Windle Waystone' },
    // the dock: Waystone, tide chalkboard, ferry stop
    'ferry-stop': { x: 40, y: 26, facing: 'right' },
    'maud-punt': { x: 41, y: 26, water: true },
    // the windmills along the ridge (landmarks), Rook's mill in Windle, signs
    'door-spire-relay': { x: 26, y: 7 },
    'spire-relay-step': { x: 26, y: 8, facing: 'up' },
    'spire-step': { x: 26, y: 8, facing: 'down', note: 'where the Spire\'s door lets you out (the Spire interiors\' toMarker)' },
    // arrivals
    'from-drownwood-causeway': { x: 30, y: 30, facing: 'up', tide: 'low' },
    'from-drownwood-footbridge': { x: 10, y: 30, facing: 'up' },
    'from-rimeholt-stones': { x: 1, y: 22, facing: 'right', tide: 'low' },
    'from-rimeholt-ice-path': { x: 1, y: 8, facing: 'right' },
    'windle-dock': { x: 40, y: 23, facing: 'down' },
    // route trainers at their posts (TRAINER_IDS)
    'trainer-thistlewind-ned': { x: 43, y: 17, facing: 'right', trainer: 'thistlewind-ned', note: 'Millhand, under Rook\'s mill' },
    'trainer-thistlewind-lark': { x: 22, y: 6, facing: 'down', trainer: 'thistlewind-lark', note: 'Kite Flyer, on the ridge walk' },
    'trainer-thistlewind-cuthbert': { x: 12, y: 18, facing: 'up', trainer: 'thistlewind-cuthbert', note: 'Moor Shepherd, on the footbridge track' },
    'trainer-thistlewind-maisie': { x: 41, y: 22, facing: 'right', trainer: 'thistlewind-maisie', optional: true, note: 'Sail Mender, on the quay (declinable)' },
    'trainer-thistlewind-gideon': { x: 38, y: 14, facing: 'down', trainer: 'thistlewind-gideon', optional: true, note: 'Surge Witness, in Weft Lane (declinable)' },
    // isle folk, leader posts, story staging
    'rook-mill': { x: 43, y: 16, facing: 'right', npc: 'rook-hayward' },
    'rook-surge': { x: 40, y: 14, facing: 'down', npc: 'rook-hayward', note: 'witness to the Surge' },
    'surge-street': { x: 38, y: 13, facing: 'down', note: 'Weft Lane: the street that Shifts in one night (script the-surge)' },
    'surge-player': { x: 34, y: 15, facing: 'right' },
    'ada-ridge': { x: 25, y: 9, facing: 'down', npc: 'ada' },
    'ivo-ridge': { x: 27, y: 9, facing: 'down', npc: 'ivo' },
    'relay-spire-door': { x: 26, y: 8, facing: 'up' },
  },
  reaches: [
    { id: 'reach-tarn-beck', kind: 'river', area: { x: 18, y: 7, w: 1, h: 5 }, creatureTable: 'thistlewind-water', name: 'Tarn Beck' },
    { id: 'reach-windle-harbour', kind: 'lagoon', area: { x: 35, y: 24, w: 5, h: 3 }, creatureTable: 'thistlewind-water', nightKind: 'sea', name: 'Windle Harbour' },
  ],
  dig: { spots: [[15, 22], [17, 22], [19, 22], [16, 23], [18, 23], [15, 24], [17, 24], [19, 24]], note: 'the barrow diggings' },
  bugSpots: [
    { x: 13, y: 8, habitat: 'hedges' },
    { x: 33, y: 8, habitat: 'hedges' },
    { x: 24, y: 20, habitat: 'lanes' },
    { x: 17, y: 9, habitat: 'river' },
    { x: 37, y: 13, habitat: 'lanes' },
    { x: 11, y: 21, habitat: 'hedges' },
  ],
  music: null,
  light: { indoor: false, ambient: 'moor' },
  entry: { x: 40, y: 23, facing: 'down' },
};

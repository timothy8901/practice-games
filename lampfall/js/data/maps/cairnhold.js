/**
 * CAIRNHOLD — isle 2 (GDD-00 §4; GDD-01 §15.2). [DATA-MAPS] 48x32 tiles, wild Lv9-14, Waystone Knapp's End.
 *
 * The granite isle the Mooring cuts its anchor stones from. North-west: the quarry (granite faces, the
 * gravel floor, spoil heaps (the dig site), a flooded pool, the skyglass vein in the north face), reached
 * from Lowmoor by the quarry road (the long way, any tide). North: the causeway landing from Lowmoor (the
 * short way, +-2.5 h) and the road south. Centre-east: the hill with the standing stones (a ring of eight
 * round a fallen king-stone), the Ward Spire beyond it, the cliff path along the north-east ridge (the
 * long way to Emberstep, any tide) and the shingle beach with the stepping stones to Emberstep (the short
 * way, +-2 h). South: Knapp's End on its harbour: the quay, the pier and ferry stop, the Waystone, the
 * Mooring clinic (Wynn Cobble's counter), the stonecutter's shed, Mags Penny's boat. South-west, on the
 * headland: the memorial to the Night of Wrong Shapes.
 *
 * Map-only legend chars: 'X' quarry face, '?' standing stone (detail), 'Y' worn cobbles (they override
 * mainland causeway, mirror-ice and glow mud, which Cairnhold never paints).
 * Generated once from a layout script, then hand-edited: edit the rows directly.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'cairnhold',
  name: 'Cairnhold',
  kind: 'exterior',
  region: 'cairnhold',
  w: 48,
  h: 32,
  legend: { X: 'quarry-face', '?': 'standing-stone', Y: 'cobbles-worn' },
  ground: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    'DDDSSSNSSSSSSSSSDDDDDDSSSSDqDSSSSDDDDDDDDDDDDDDD', //  0
    'DDSSSSNSqqSSSSSSSDDDDSSSSSSESSSSSSDDDDDDDDDDDDDD', //  1
    'DSSSSq:XXXXXXqSSSSSSSSSSqqqEqqqSSSSDDDDDDDDDDDDD', //  2
    'DSSSqX:XX:XXXXXSSSSSSSSqqGgPgGqqSSSSSDDDDDDDDDDD', //  3
    'SSSqXX:::::::::XXXSSqqqqGgGPGGGqqSSSSSDDDDDDDDDD', //  4
    'SSSXX::::::::::::XqqqTTTgGGPGgGCSCSSSSSSSSSSSSSS', //  5
    'SSXXH::::::::::::XXTTTTTTgGPGTGCCCCCCCCCCCCCCCCC', //  6
    'SSSXH:::::::u::::XXTTTTTTGGPTTTCChCCCCCCCCChCCCC', //  7
    'SSSX:::::::uuu:::XTTTTTTTGGPPPPPPPPPPPPPPPPPPPPP', //  8
    'DSSSX:::::::u:::::::TTTTGGGPFFFCCCCCCChCCCCCCCCC', //  9
    'DSSSSX::::::R::X:GG:TG2222FPFFFCCCCCSSSSSSSSSSSS', // 10
    'DSSSSXXXXX:XRXXXGGg:GG2222FPFFFFFFFFFFFFqqSSSSSD', // 11
    'DSSSqqGGXXXXRGGgGGG:GGs]ssFPFFFFFFFFFF^^^^^SSSSD', // 12
    'DSSqqGGGGGGGRGGgGGGPGGs@]sFPFFFFFFFFFF^^^^^FqSSD', // 13
    'DSSqqGGGGGGGRGGgTTTPPPPPPPPPPPPPPPPPPF^^^^^FSSSD', // 14
    'DSSSqRRRRRRRRGTTTTTTTGGGGFFPFFFFFFFFFFs]s]sSSSSD', // 15
    'DSSSqRGGGGgGPGTTTTTTTGGGGGFPFFFFFFPFFFss"ssFSSSD', // 16
    'DDSRRRGGGgGGPGTTTTTTTGGGGGFPFFFFFFPFFFFFfFFFSSSS', // 17
    'DDSSqqGGGgGGPg11111T^^^^^GGP555555PPPFFFPFFFqSSS', // 18
    'DDSSSqGGgGGGPG11111G^^^^^ggP555555GGGPGqqqqqqSSS', // 19
    'DSSSqqGGGGGGPGw[w[wG#%#%#gGPs]s]ssTTTPPqqqqqqeeq', // 20
    'DSSSqGfffGGGPGww!wwG##+##GGPss@s]sTTTTTqqqqqqSSS', // 21
    'DSSqqfffffGGfOOOOOOOOOOOOOOOGgOGGGTTqqqqqqqqqSSS', // 22
    'DSSqGffffffffGGgGQQQQQQQQQQQQQQgGqqqqSSqqqqqSSSS', // 23
    'DSSqqfffffqqqqqGGQQQQQQQQQQQQQQqqqSqSSSSSSSSSSSD', // 24
    'DSSSqqGGGGqSSSqqSSSSSSSSKSSSSSSSqqSSSSSSSSSSSSDD', // 25
    'DSSSSqqqqqqSSSSSSSSSSSSSKSSSSSSSqSSSSSDDDDDDDDDD', // 26
    'DDSSSSqqSSSSSSSSSSSSSSSSKSSSSSSSSSSSDDDDDDDDDDDD', // 27
    'DDDSSSSSSSSSSDDSSSSSSSSSKSSSSSSSSSSDDDDDDDDDDDDD', // 28
    'DDDDSSSSSSDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 29
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 30
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 31
  ],
  detail: [
    //000000000011111111112222222222333333333344444444
    //012345678901234567890123456789012345678901234567
    '................................................', //  0
    '................................................', //  1
    '................................................', //  2
    '................................................', //  3
    '........0....0......8.8.y....8..................', //  4
    '................................................', //  5
    '...............0........8.8...8.................', //  6
    '................................................', //  7
    '................................................', //  8
    '.....0..........................................', //  9
    '.......0.......................y................', // 10
    '..................y..............?..............', // 11
    '.....................8........?.....?...........', // 12
    '....8...........8............?..............8...', // 13
    '.......8...y..8.................................', // 14
    '......................8..............?..........', // 15
    '........y...............8.....?.....?...........', // 16
    '.................................?..............', // 17
    '.....8..........................................', // 18
    '................................................', // 19
    '...................................y............', // 20
    '.............L.....L......L............y........', // 21
    '...8..............................8.......8.....', // 22
    '.................c(...........c.................', // 23
    '..................).).......).).................', // 24
    '................................................', // 25
    '.........8......................................', // 26
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
    { kind: 'prop', id: 'knapps-end', art: 'waystone', waystone: true, x: 25, y: 24, note: 'autosave, deferred Forecasts, heals once per tide (GDD-00 §4)' },
    { kind: 'prop', id: 'tide-board-cairnhold', art: 'tide-chalkboard', verb: 'tideTable', x: 26, y: 24 },
    { kind: 'boat', id: 'ferry-punt-cairnhold', x: 25, y: 28, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry stop: any tide, 05:00-01:00 (GDD-00 §4)' },
    // the skyglass node: a vein in the quarry face
    { kind: 'prop', id: 'node-cairnhold', art: 'skyglass', node: true, x: 14, y: 3, note: '1-2 Starsalt; refills per badge (GDD-00 §4)' },
    // the memorial, the clinic counter, the quarry, signs
    { kind: 'prop', id: 'cairnhold-memorial', x: 7, y: 22, art: 'memorial-stone', verb: 'look', note: 'ART REQUEST memorial-stone: the Night of Wrong Shapes, every name the town lost (Quill keeps it)' },
    { kind: 'prop', id: 'memorial-bench', x: 9, y: 24, art: 'bench', verb: 'sit' },
    { kind: 'prop', id: 'clinic-sign', x: 31, y: 21, art: 'shop-sign', verb: 'look', note: 'The Mooring: anchor stones, Still Knots, Crackdust' },
    { kind: 'prop', id: 'quarry-crane', x: 9, y: 5, art: 'timber-stack', verb: 'look', note: 'the quarry\'s hoist frame' },
    { kind: 'prop', id: 'stones-plinth', x: 33, y: 15, art: 'rock-b', verb: 'look', note: 'the fallen king-stone in the middle of the ring' },
    { kind: 'sign', id: 'sign-knapps-end', x: 16, y: 21, art: 'signpost', text: 'Knapp\'s End. Mind the quay, it is older than it looks.' },
    { kind: 'sign', id: 'sign-ward-spire', x: 39, y: 19, art: 'signpost', text: 'The Ward Spire. Osric Penhallow. Bring something that cracks.' },
    { kind: 'sign', id: 'sign-emberstep-stones', x: 41, y: 19, art: 'signpost', text: 'Emberstep by the stones. Dry two hours either side of low water.' },
    { kind: 'sign', id: 'sign-cliff-path', x: 30, y: 9, art: 'signpost', text: 'The cliff path to Emberstep. Any tide. Keep to the ledge.' },
    { kind: 'sign', id: 'sign-lowmoor-causeway', x: 28, y: 4, art: 'signpost', text: 'Lowmoor by the causeway. Dry two and a half hours either side of low water.' },
    { kind: 'sign', id: 'sign-quarry-road', x: 7, y: 2, art: 'signpost', text: 'The quarry road to Lowmoor. Any tide.' },
    { kind: 'boat', id: 'mags-boat', x: 21, y: 26, art: 'boat', note: 'Mags Penny\'s boat, unpaid for at the Anchorage' },
  ],
  triggers: [
    { x: 25, y: 24, kind: 'use', id: 'waystone-knapps-end', verb: 'waystone', waystone: 'knapps-end' },
    { x: 26, y: 24, kind: 'use', id: 'tide-board-cairnhold', verb: 'tideTable' },
    { x: 25, y: 28, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 14, y: 3, kind: 'use', id: 'node-cairnhold', verb: 'chip' },
    { x: 30, y: 21, kind: 'use', id: 'clinic-counter', verb: 'shop', shop: 'cairnhold-clinic', note: 'Wynn Cobble at the clinic door' },
    { x: 7, y: 22, kind: 'use', id: 'cairnhold-memorial', verb: 'look' },
  ],
  warps: [
    { x: 27, y: 0, kind: 'edge', to: { mapId: 'lowmoor', x: 27, y: 30, facing: 'up' }, via: 'short-way', way: 'causeway', tideWindow: 150, note: 'the causeway to Lowmoor (+-2.5 h)' },
    { x: 6, y: 0, kind: 'edge', to: { mapId: 'lowmoor', x: 6, y: 30, facing: 'up' }, via: 'long-way', note: 'the quarry road, any tide' },
    { x: 47, y: 20, kind: 'edge', to: { mapId: 'emberstep', x: 1, y: 20, facing: 'right' }, via: 'short-way', way: 'stones', tideWindow: 120, note: 'the stepping stones to Emberstep (+-2 h)' },
    { x: 47, y: 8, kind: 'edge', to: { mapId: 'emberstep', x: 1, y: 8, facing: 'right' }, via: 'long-way', note: 'the cliff path, any tide' },
    { x: 40, y: 16, kind: 'door', to: { mapId: 'spire-ward', x: 10, y: 12, facing: 'up' }, sfx: 'doorOpen', note: 'the Ward Spire; its door back lands on (40,17)' },
  ],
  spawns: [
    { area: 'grass', table: 'cairnhold-land', rate: 0.1 },
    { area: { x: 20, y: 27, w: 8, h: 3 }, table: 'cairnhold-water', rate: 0, via: 'hook', note: 'reaches hook this table through fishing' },
  ],
  regions: {
    'knapps-end': { x: 12, y: 18, w: 22, h: 11 },
    'knapps-end-dock': { x: 20, y: 23, w: 10, h: 6 },
    'the-quarry': { x: 2, y: 1, w: 17, h: 12 },
    'standing-stones': { x: 28, y: 10, w: 11, h: 9 },
    'ward-spire': { x: 37, y: 12, w: 7, h: 7 },
    'mooring-clinic': { x: 28, y: 18, w: 6, h: 5 },
    'the-memorial': { x: 3, y: 20, w: 8, h: 6 },
    'cliff-path': { x: 29, y: 6, w: 19, h: 4 },
    'stones-beach': { x: 38, y: 17, w: 10, h: 6 },
    'short-way-lowmoor': { x: 25, y: 0, w: 5, h: 3 },
    'long-way-lowmoor': { x: 4, y: 0, w: 4, h: 5 },
    'short-way-emberstep': { x: 43, y: 18, w: 5, h: 5 },
    'long-way-emberstep': { x: 31, y: 6, w: 17, h: 4 },
    'dig-site': { x: 4, y: 4, w: 13, h: 7 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'cairnhold-quarry-road': { x: 10, y: 10, facing: 'up', trainer: 'cairnhold-ruddock' },
    'cairnhold-clinic-gate': { x: 34, y: 18, facing: 'right', trainer: 'cairnhold-prudence' },
    'cairnhold-standing-stones': { x: 33, y: 13, facing: 'down', trainer: 'cairnhold-jory' },
    'cairnhold-memorial-path': { x: 11, y: 23, facing: 'left', trainer: 'cairnhold-ellery' },
    'cairnhold-quarry-floor': { x: 7, y: 6, facing: 'right', trainer: 'cairnhold-bette' },
    'cairnhold-knapps-end-dock': { x: 27, y: 16, facing: 'up', trainer: 'wick-cairnhold' },
    // the dock: Waystone, tide chalkboard, ferry stop
    'ferry-stop': { x: 24, y: 28, facing: 'right' },
    'maud-punt': { x: 25, y: 28, water: true },
    // the memorial, the clinic counter, the quarry, signs
    'door-spire-ward': { x: 40, y: 16 },
    'spire-ward-step': { x: 40, y: 17, facing: 'up' },
    'spire-step': { x: 40, y: 17, facing: 'down', note: 'where the Spire\'s door lets you out (the Spire interiors\' toMarker)' },
    // arrivals
    'from-lowmoor-causeway': { x: 27, y: 1, facing: 'down', tide: 'low' },
    'from-lowmoor-road': { x: 6, y: 1, facing: 'down' },
    'from-emberstep-stones': { x: 46, y: 20, facing: 'left', tide: 'low' },
    'from-emberstep-cliff': { x: 46, y: 8, facing: 'left' },
    'knapps-end-dock': { x: 24, y: 24, facing: 'down' },
    // route trainers at their posts (TRAINER_IDS)
    'trainer-cairnhold-ruddock': { x: 10, y: 10, facing: 'up', trainer: 'cairnhold-ruddock', note: 'Quarryman, on the quarry floor' },
    'trainer-cairnhold-prudence': { x: 34, y: 18, facing: 'right', trainer: 'cairnhold-prudence', note: 'Mooring Clerk: the first mandatory Ward, past the clinic (Crackdust stocked first)' },
    'trainer-cairnhold-jory': { x: 33, y: 13, facing: 'down', trainer: 'cairnhold-jory', note: 'Stonecutter, inside the stone ring' },
    'trainer-cairnhold-ellery': { x: 11, y: 23, facing: 'left', trainer: 'cairnhold-ellery', optional: true, note: 'Lamp Pilgrim, on the memorial walk (declinable)' },
    'trainer-cairnhold-bette': { x: 7, y: 6, facing: 'right', trainer: 'cairnhold-bette', optional: true, note: 'Quarry Forewoman, by the terrace steps (declinable)' },
    'trainer-wick-cairnhold': { x: 27, y: 16, facing: 'up', trainer: 'wick-cairnhold', note: 'Wick waits on the causeway road (story, any result)' },
    // isle folk, leader and faction posts
    'wynn-clinic': { x: 30, y: 22, facing: 'up', npc: 'wynn-cobble' },
    'clinic-door': { x: 30, y: 21 },
    'quill-memorial': { x: 8, y: 23, facing: 'up', npc: 'quill-hartsease' },
    'cairnhold-memorial': { x: 7, y: 23, facing: 'up', note: 'the memorial to the Night of Wrong Shapes (script cairnhold-memorial)' },
    'merrow-memorial': { x: 6, y: 23, facing: 'up', npc: 'merrow' },
    'memorial-player': { x: 7, y: 24, facing: 'up' },
    'mags-dock': { x: 22, y: 24, facing: 'down', npc: 'mags-penny', note: 'the fisher the Anchorage turns away (script anchorage-turns-away)' },
    'osric-quarry': { x: 13, y: 9, facing: 'left', npc: 'osric' },
    'osric-shed': { x: 23, y: 14, facing: 'up', npc: 'osric' },
    'standing-stones': { x: 33, y: 14, note: 'the centre of the ring' },
    'wick-cairnhold': { x: 27, y: 16, facing: 'up', npc: 'wick' },
    'ward-spire-door': { x: 40, y: 17, facing: 'up' },
  },
  reaches: [
    { id: 'reach-quarry-stream', kind: 'river', area: { x: 12, y: 11, w: 1, h: 6 }, creatureTable: 'cairnhold-water', name: 'Quarry Stream' },
    { id: 'reach-knapps-harbour', kind: 'lagoon', area: { x: 20, y: 27, w: 8, h: 3 }, creatureTable: 'cairnhold-water', nightKind: 'sea', name: 'Knapp\'s Harbour' },
  ],
  dig: { spots: [[6, 3], [9, 3], [11, 4], [14, 4], [7, 5], [10, 5], [13, 5], [16, 5], [6, 6], [9, 6], [12, 6], [5, 7]], note: 'the quarry spoil' },
  bugSpots: [
    { x: 20, y: 7, habitat: 'lanes' },
    { x: 17, y: 16, habitat: 'lanes' },
    { x: 12, y: 13, habitat: 'river' },
    { x: 12, y: 15, habitat: 'river' },
    { x: 32, y: 13, habitat: 'hedges' },
    { x: 36, y: 21, habitat: 'lanes' },
    { x: 9, y: 25, habitat: 'hedges' },
  ],
  music: null,
  light: { indoor: false, ambient: 'granite' },
  entry: { x: 24, y: 24, facing: 'down' },
};

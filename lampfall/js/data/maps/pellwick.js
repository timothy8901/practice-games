/**
 * PELLWICK — the hub (GDD-00 §4; GDD-01 §5). [DATA-MAPS] 64x48 tiles, 16 px, a 30x17 view.
 *
 * A tidal-island harbor town. West: the point, with the dark lighthouse at its north-west tip, the
 * Keeper's Cottage and Linnet's house behind the fence, Isolde's old orchard, Wick's cliff stair and the
 * Dorrows' burrow, the Keeper's jetty ("the dock") and the point flats (the Glint, sparkles, glowing
 * mud), the shingle spit to the Lowmoor stepping stones (+-2 h) and the Bar road running north from the
 * lighthouse's foot (the day's lower low until the Relighting). North: the marsh delta and its reeds,
 * the footbridge and marsh boardwalk (the Lowmoor long way, any tide), the river with its tidal
 * stepping stones and the stone bridge, the north bank orchard, Thessaly's cottage, the empty north
 * creek with the Bracks' oyster boat, the weir, Ansel's beached launch, Stalk's Hill orchard.
 * Centre: the green (the Commons orchard on its west lawn, the Commons board and Jar on the square,
 * the market lawn east), the Archive (Barnaby's porthole), Pell's Sundries, the Warden's house, the
 * post office (Ludo's eave). East: the co-op yard at the causeway end and the mainland causeway
 * (arrival only, +-1 h). South: the quay row (most of it dark), the Anchorage, the quay, Maud's berth,
 * the Old Pier (the Carnival Raft from day 3) and the Old Quay (bared at spring lows).
 *
 * Layers: `ground` is the base tile everywhere; `detail` holds props that stand on a ground tile
 * (trees '8' pine / '9' alder, rocks 'o', fences '|' and gates '/', hedges, crates 'c', barrels '(',
 * bollards ')', lamp posts 'L', bean rows '=', gorse 'y', glasswort 'i', seaweed 'l'). Map-only legend
 * chars: '?' the Keeper's roof (player colour), 'x' the Old Quay, 'd' Barnaby's porthole.
 * Named fruit trees, purse and bee trees, porches (PORCH_IDS, lamp cell + step + door), boats, signs
 * and furniture are entities; `markers` name every NPC post and story staging point (GDD-01 §1).
 *
 * Generated once from a layout script, then hand-edited: edit the rows directly.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'pellwick',
  name: 'Pellwick',
  kind: 'exterior',
  region: 'pellwick',
  w: 64,
  h: 48,
  legend: { '?': 'roof-keeper', x: 'old-quay', d: 'porthole' },
  ground: [
    //0000000000111111111122222222223333333333444444444455555555556666
    //0123456789012345678901234567890123456789012345678901234567890123
    'DDDDDDbbDDDDDkDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDSGGGGGGRRRGGGGGGGG', //  0
    'DDDDDDbbDDDDDkDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDSGGGGGGRRRG,GGG,,G', //  1
    'DDDDDDbbSSSSSkSSSSSSRRRSSSSSSSSSSSSSSSSSSSSSSSSGGGGGGRRR,,G,G,G,', //  2
    'DDDDDDbbSrrUUkrUrrrrRRRAaAaaaAaAaAammAaAAaAAAaAGGGGGGRRRG,GGGGGG', //  3
    'DDDDDDbbSrSUSkUUrrrrRRRaaaaaaaaGGGGmmmmm;mmmmm;mmmmmmRRRGGGGGGG,', //  4
    'DDDDDDbbSrrUrkSSrrrrRRRGGGGGGGGGGGGmGGGGGGGGGGGGGGGmmRRRGGG,G,GG', //  5
    'DDDDDDbbSrrrrkkkkkkkBBBG66666GGGGGGGGGGGGG5555GGGGGm;RRRG,,GGG,,', //  6
    'DDDDDDbbSrrUrUrUSrrrRRRG66666GGGGGGGGGGGGG5555GGGGGmmZZZG,GGGGGG', //  7
    'DDDDDDbbSrrUUUrrrSrrRRRG#%%%#GGGGGGGGGGGGG}}}$GGGGGGGRRR,GG,GGGG', //  8
    'DDDDDDbbSrrSUUUrUrrrRRRG%#+#%GGGGGGGGGGGGG$+$}GGGGGGGRRRGGGG,,,,', //  9
    'DDDDDDbbSrrSUUUUUrrrRRRAA___AAAaAAaaAAAaAA___AARRRRRRRRRGGGGGGGG', // 10
    'DDDDDDbbSrrrSrrrrrrrRRRRRRRRRRRRRzRRRNNRRRRRRRRRRRRRRRRR,G,GGGGG', // 11
    'DDDDDDbbSrrrrrrrrrrrRRRRRRRRRRRRRzRRRNNRRRrrrrrrrrrrRRGGG,,G,GGG', // 12
    'DDDSSSbbSrrrrrrrrrrrRRRRrrrrrrrRRzRRRNNRrrrrrrrrrrrrGGGGPPPPGGGG', // 13
    'DDSSqqqqqrrrrrrrrrrrPPPPPPPPPPPPPPPPPOOPPPPPPPPPPPPPPPPPPGGGSSSS', // 14
    'DDSCCqqqqCCCCCCCCCCGGG111111G^^^^^^^GOOGGGGGGG333333GGGGGGGASDDD', // 15
    'DDSCfffffqGGG,GGG5555G111111G^^^^^^^GOOG66666G333333G5555GGASDDD', // 16
    'DDSCssfffG,G,G,GG}}}$G111111G^^^^^^^GOOG66666G333333G5555GGASDDD', // 17
    'DDSC@sfff,GGG,G,G$+$}Gw[[[w[G]s]]]s]GOOG#%%%#Gw[[[w[G}}}#GGASDDD', // 18
    'DDSCfff?????G1111___GG[w!w[wGs]s@sdsGOOG%#+#%G[w!w[wG#+#}GGASDDD', // 19
    'DDSCfff?????,1111GGGGGG___GGGGG___GGGOOGG___GGG___GGG___GGGASDDD', // 20
    'DDSCGGP${{{$G%%%#POOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOASDDD', // 21
    'DDSCGGP{$+${G#+#%PGGGGGGGGGOgggggggggggggggggggggO77777GGGGASDDD', // 22
    'DDSSCGPG___GG___GPGGGG5555GOg**ggggggggggggggg**gO777774444ASDDD', // 23
    'DDDSC,PG,GGGGGGGGP,GGG5555GOg*&gggOOOOOOOOgggg&*gO#%%%#%%%#ASDDD', // 24
    'DDDSSCPPPPPPPPPPPPGGGG}}}#GOggggggOOOOOOOOgggggggO%#+#%#+#%ASDDD', // 25
    'DDDSCGGGGGGG,,GG77777G#+#}GOggggggOOOOOOOOgggggggOG___GGGGGASDDD', // 26
    'DDSSCGG,GGGGG,GG77777G___GGOggggggOOOOOOOOgggggggOfffffffGGASDDD', // 27
    'DDSC,GG,GGGGGGGG#%%%#GGGGGGOgggggggggggggggg&*gggOfffffffqqqSDDD', // 28
    'DDSCGGGGGGGGGGGG%#+#%GGGGGGOggg**&gggggggggg**gggOfffffffqqqSDDD', // 29
    'DDSSCGGG,GG,G,G,G___GGGGGGGOgggggggggggggggggggggOfffffffqqqXXXX', // 30
    'DDDSCCCCCCHCAAAAAGGGGGGOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOqqqXXXX', // 31
    'DDDSSCCCCCHCAAAAAA5555G44444GGG22222GOOG5555G5555G555555555qSDDD', // 32
    'DDDDSCCCCCHC"AAAKA5555G44444GGG22222GOOG5555G5555G555555555ASDDD', // 33
    'DDDDMMMMqqqAAAWWKW}}}$G#%%%#GGGw[[[wGOOG}}}#G$}}}G}}}#s]]]sASDDD', // 34
    'DDDMMMqqqMMMMMMMKW$+$}G%#+#%GGG[w!w[GOOG#+#}G}$+$G#+#}]s@s]ASDDD', // 35
    'DDDMMqqMMMMM~MMMKM___WGG___GGGGG___GGOOG___GGG___G___GGGGGGASDDD', // 36
    'DDDMqqMYYMMMMMMMKOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOSDDD', // 37
    'qeeqqMMMYYYMMMMMKOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOSDDD', // 38
    'DDDDMMMMMMYYMMMMKWHQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQSDDD', // 39
    'DDDDDMYMMMMMMMYYKWHQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQSDDD', // 40
    'DDDDDDMMM~MMYMMYWWHQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQSDDD', // 41
    'DDDDDDDDMMMMMYMWWWSSSSSSSSSSSSSSSKKSSSSSSSSSSSSSSSKKSxxxxxxSSDDD', // 42
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKDDDDDDDDDDDDDDDKKSxxxxxxSDDDD', // 43
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKDDDDDDDDDDDDDDDKKSxxxxxxSDDDD', // 44
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKSxxxxxxSDDDD', // 45
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKSSSxxxxSDDDD', // 46
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDSSSSSSSSDDDD', // 47
  ],
  detail: [
    //0000000000111111111122222222223333333333444444444455555555556666
    //0123456789012345678901234567890123456789012345678901234567890123
    '...............................................888888...88888888', //  0
    '...............................................888888...........', //  1
    '...............................................888888..........8', //  2
    '................................................................', //  3
    '......................................o.........................', //  4
    '...............................................................8', //  5
    '................................................................', //  6
    '.............i..................................................', //  7
    '................................................................', //  8
    '..............i...............................9................8', //  9
    '...............i................................................', // 10
    '................i...............................................', // 11
    '...............................................................8', // 12
    '................................................................', // 13
    '....................................L..L........................', // 14
    '................................................................', // 15
    '........o.......................................................', // 16
    '................................................................', // 17
    '................................................................', // 18
    '............|...................................................', // 19
    '............|...................................................', // 20
    '............|.....................................L.............', // 21
    '............|.............L.........L..L........................', // 22
    '............|...................................................', // 23
    '....y..|./.|||/||...............................................', // 24
    '................................................................', // 25
    '...............................................L................', // 26
    '....y...........................................................', // 27
    '................................................................', // 28
    '....y.................L.........................................', // 29
    '...............y....................L..L........................', // 30
    '................................................................', // 31
    '.............................|..................................', // 32
    '.............................|=.....=...........................', // 33
    '.............................|=.....=...........................', // 34
    '.........ll..................|=.....=...........................', // 35
    '..............o..............|..................................', // 36
    '................................................................', // 37
    '.............l..o...L.........L.............L........L..........', // 38
    '.......l.........l......cc...(..............c(..........cc......', // 39
    '................................................................', // 40
    '...........o..........)....)...)....).....)....).....)....).....', // 41
    '................................................................', // 42
    '................................................................', // 43
    '................................................................', // 44
    '................................................................', // 45
    '................................................................', // 46
    '................................................................', // 47
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'lighthouse-dark', x: 4, y: 18 },
    { art: 'lighthouse-scaffold', x: 4, y: 18, cond: { loan: { tier: { gte: 2 } } } },
  ],
  entities: [
    // ---- named trees: 95 fruit (native fruit per seed), 6 purse, 4 bee ----
    // hill-orchard
    { kind: 'tree', id: 'tree-old-meg', name: 'Old Meg', x: 56, y: 2, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-grandam', name: 'Grandam', x: 58, y: 2, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-parson-hobb', name: 'Parson Hobb', x: 60, y: 2, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'bee-hummer', name: 'Hummer', x: 62, y: 2, art: 'tree-bee', hive: 'honeycomb', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-crooked-kit', name: 'Crooked Kit', x: 56, y: 4, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-lantern-tree', name: 'Lantern Tree', x: 58, y: 4, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-ferryman', name: 'Ferryman', x: 60, y: 4, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-tide-widow', name: 'Tide Widow', x: 62, y: 4, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-gull-perch', name: 'Gull Perch', x: 56, y: 6, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-long-tom', name: 'Long Tom', x: 58, y: 6, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'purse-tightfist', name: 'Tightfist', x: 60, y: 6, art: 'tree-purse', purse: true, zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-whistler', name: 'Whistler', x: 62, y: 6, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-sweet-fanny', name: 'Sweet Fanny', x: 56, y: 8, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-the-bishop', name: 'The Bishop', x: 58, y: 8, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-hollow-jack', name: 'Hollow Jack', x: 60, y: 8, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-mabrys-tree', name: 'Mabry\'s Tree', x: 62, y: 8, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-captain-mallow', name: 'Captain Mallow', x: 56, y: 10, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'bee-queen-bess', name: 'Queen Bess', x: 58, y: 10, art: 'tree-bee', hive: 'honeycomb', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-lame-duck', name: 'Lame Duck', x: 60, y: 10, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-bell-tree', name: 'Bell Tree', x: 62, y: 10, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-saltlick', name: 'Saltlick', x: 56, y: 12, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-knuckles', name: 'Knuckles', x: 58, y: 12, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-weathervane', name: 'Weathervane', x: 60, y: 12, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    { kind: 'tree', id: 'tree-tallyman', name: 'Tallyman', x: 62, y: 12, art: 'tree-fruit', fruitFrom: 'native', zone: 'hill-orchard' },
    // north-bank
    { kind: 'tree', id: 'tree-brindle', name: 'Brindle', x: 30, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-mossback', name: 'Mossback', x: 32, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-bonny-lass', name: 'Bonny Lass', x: 34, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-rooks-rest', name: 'Rook\'s Rest', x: 30, y: 7, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-keel', name: 'Keel', x: 32, y: 7, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'purse-penny-hoard', name: 'Penny Hoard', x: 34, y: 7, art: 'tree-purse', purse: true, zone: 'north-bank' },
    { kind: 'tree', id: 'tree-gaffer', name: 'Gaffer', x: 30, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-nan-coil', name: 'Nan Coil', x: 32, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-little-ned', name: 'Little Ned', x: 34, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-stooper', name: 'Stooper', x: 36, y: 7, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-sunday-best', name: 'Sunday Best', x: 38, y: 7, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-owl-light', name: 'Owl Light', x: 40, y: 7, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-the-leaner', name: 'The Leaner', x: 36, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-shipwright', name: 'Shipwright', x: 38, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-barrow-queen', name: 'Barrow Queen', x: 40, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-cobbler', name: 'Cobbler', x: 24, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-tinker', name: 'Tinker', x: 26, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-haverel', name: 'Haverel', x: 28, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-fogbound', name: 'Fogbound', x: 36, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-tidewrack', name: 'Tidewrack', x: 38, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    { kind: 'tree', id: 'tree-starling', name: 'Starling', x: 40, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'north-bank' },
    // weir-clearing
    { kind: 'tree', id: 'tree-maypole', name: 'Maypole', x: 49, y: 5, art: 'tree-fruit', fruitFrom: 'native', zone: 'weir-clearing' },
    { kind: 'tree', id: 'tree-wicket', name: 'Wicket', x: 47, y: 7, art: 'tree-fruit', fruitFrom: 'native', zone: 'weir-clearing' },
    { kind: 'tree', id: 'purse-spendthrift', name: 'Spendthrift', x: 49, y: 7, art: 'tree-purse', purse: true, zone: 'weir-clearing' },
    { kind: 'tree', id: 'tree-plover', name: 'Plover', x: 48, y: 9, art: 'tree-fruit', fruitFrom: 'native', zone: 'weir-clearing' },
    // green-west
    { kind: 'tree', id: 'tree-dunlin', name: 'Dunlin', x: 29, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-curlew', name: 'Curlew', x: 31, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-godwit', name: 'Godwit', x: 33, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'purse-the-miser', name: 'The Miser', x: 29, y: 25, art: 'tree-purse', purse: true, zone: 'green-west' },
    { kind: 'tree', id: 'tree-turnstone', name: 'Turnstone', x: 31, y: 25, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-merlin', name: 'Merlin', x: 33, y: 25, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-tern', name: 'Tern', x: 29, y: 27, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-puffins-post', name: 'Puffin\'s Post', x: 31, y: 27, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'bee-honeypot', name: 'Honeypot', x: 33, y: 27, art: 'tree-bee', hive: 'honeycomb', zone: 'green-west' },
    { kind: 'tree', id: 'tree-oystercatcher', name: 'Oystercatcher', x: 29, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-spratling', name: 'Spratling', x: 31, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    { kind: 'tree', id: 'tree-grey-lady', name: 'Grey Lady', x: 33, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-west' },
    // green-east
    { kind: 'tree', id: 'tree-old-pew', name: 'Old Pew', x: 43, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-mizzen', name: 'Mizzen', x: 45, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-bowsprit', name: 'Bowsprit', x: 47, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-bosun', name: 'Bosun', x: 43, y: 25, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-anchor-watch', name: 'Anchor Watch', x: 45, y: 25, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-lighterman', name: 'Lighterman', x: 47, y: 25, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-thimble', name: 'Thimble', x: 43, y: 27, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'purse-old-purse', name: 'Old Purse', x: 45, y: 27, art: 'tree-purse', purse: true, zone: 'green-east' },
    { kind: 'tree', id: 'tree-darning-needle', name: 'Darning Needle', x: 47, y: 27, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-kettle-black', name: 'Kettle Black', x: 43, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-porch-light', name: 'Porch Light', x: 45, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    { kind: 'tree', id: 'tree-mooring', name: 'Mooring', x: 47, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'green-east' },
    // keepers-orchard
    { kind: 'tree', id: 'tree-low-water', name: 'Low Water', x: 5, y: 26, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-spring-tide', name: 'Spring Tide', x: 7, y: 26, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-neap', name: 'Neap', x: 9, y: 26, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'bee-the-hive', name: 'The Hive', x: 11, y: 26, art: 'tree-bee', hive: 'honeycomb', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-slack-water', name: 'Slack Water', x: 13, y: 26, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-flood', name: 'Flood', x: 5, y: 28, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-ebb', name: 'Ebb', x: 7, y: 28, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'purse-button-box', name: 'Button Box', x: 9, y: 28, art: 'tree-purse', purse: true, zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-shingle', name: 'Shingle', x: 11, y: 28, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-sea-coal', name: 'Sea Coal', x: 13, y: 28, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-hearthstone', name: 'Hearthstone', x: 5, y: 30, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-ingle', name: 'Ingle', x: 7, y: 30, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-tinderbox', name: 'Tinderbox', x: 9, y: 30, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-firkin', name: 'Firkin', x: 11, y: 30, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    { kind: 'tree', id: 'tree-hogshead', name: 'Hogshead', x: 13, y: 30, art: 'tree-fruit', fruitFrom: 'native', zone: 'keepers-orchard' },
    // point-north
    { kind: 'tree', id: 'tree-cooper', name: 'Cooper', x: 9, y: 17, art: 'tree-fruit', fruitFrom: 'native', zone: 'point-north' },
    { kind: 'tree', id: 'tree-quillet', name: 'Quillet', x: 11, y: 17, art: 'tree-fruit', fruitFrom: 'native', zone: 'point-north' },
    { kind: 'tree', id: 'tree-hobnail', name: 'Hobnail', x: 13, y: 17, art: 'tree-fruit', fruitFrom: 'native', zone: 'point-north' },
    { kind: 'tree', id: 'tree-gorsey', name: 'Gorsey', x: 15, y: 17, art: 'tree-fruit', fruitFrom: 'native', zone: 'point-north' },
    { kind: 'tree', id: 'tree-brackenbank', name: 'Brackenbank', x: 5, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'point-north' },
    { kind: 'tree', id: 'tree-fernside', name: 'Fernside', x: 5, y: 21, art: 'tree-fruit', fruitFrom: 'native', zone: 'point-north' },
    // river-walk
    { kind: 'tree', id: 'tree-herons-watch', name: 'Heron\'s Watch', x: 36, y: 17, art: 'tree-fruit', fruitFrom: 'native', zone: 'river-walk' },
    { kind: 'tree', id: 'tree-stilt', name: 'Stilt', x: 39, y: 15, art: 'tree-fruit', fruitFrom: 'native', zone: 'river-walk' },
    { kind: 'tree', id: 'tree-upstart', name: 'Upstart', x: 54, y: 13, art: 'tree-fruit', fruitFrom: 'native', zone: 'river-walk' },
    { kind: 'tree', id: 'tree-seedling-sal', name: 'Seedling Sal', x: 52, y: 13, art: 'tree-fruit', fruitFrom: 'native', zone: 'river-walk' },
    // east-shore
    { kind: 'tree', id: 'tree-lonely-bob', name: 'Lonely Bob', x: 57, y: 17, art: 'tree-fruit', fruitFrom: 'native', zone: 'east-shore' },
    { kind: 'tree', id: 'tree-old-faithful', name: 'Old Faithful', x: 57, y: 19, art: 'tree-fruit', fruitFrom: 'native', zone: 'east-shore' },
    { kind: 'tree', id: 'tree-patience', name: 'Patience', x: 57, y: 15, art: 'tree-fruit', fruitFrom: 'native', zone: 'east-shore' },
    // neck
    { kind: 'tree', id: 'tree-charity', name: 'Charity', x: 19, y: 23, art: 'tree-fruit', fruitFrom: 'native', zone: 'neck' },
    { kind: 'tree', id: 'tree-mercy', name: 'Mercy', x: 19, y: 25, art: 'tree-fruit', fruitFrom: 'native', zone: 'neck' },
    { kind: 'tree', id: 'tree-constance', name: 'Constance', x: 21, y: 31, art: 'tree-fruit', fruitFrom: 'native', zone: 'neck' },
    { kind: 'tree', id: 'tree-dorcas', name: 'Dorcas', x: 25, y: 29, art: 'tree-fruit', fruitFrom: 'native', zone: 'neck' },
    // ---- porches (PORCH_IDS): x,y = the lamp beside the door; step = where the household sits ----
    { kind: 'prop', id: 'porch-coop-yard', art: 'porch-lamp', x: 53, y: 25, porch: true, step: { x: 52, y: 26 }, door: { x: 52, y: 25 }, house: 'coop-yard', litAtStart: true },
    { kind: 'prop', id: 'porch-pells', art: 'porch-lamp', x: 25, y: 19, porch: true, step: { x: 24, y: 20 }, door: { x: 24, y: 19 }, house: 'pells', litAtStart: true },
    { kind: 'prop', id: 'porch-post-office', art: 'porch-lamp', x: 49, y: 19, porch: true, step: { x: 48, y: 20 }, door: { x: 48, y: 19 }, house: 'post-office', litAtStart: true },
    { kind: 'prop', id: 'porch-archive', art: 'porch-lamp', x: 33, y: 19, porch: true, step: { x: 32, y: 20 }, door: { x: 32, y: 19 }, house: 'archive', litAtStart: true },
    { kind: 'prop', id: 'porch-wardens-house', art: 'porch-lamp', x: 43, y: 19, porch: true, step: { x: 42, y: 20 }, door: { x: 42, y: 19 }, house: 'wardens-house', litAtStart: true },
    { kind: 'prop', id: 'porch-tully', art: 'porch-lamp', x: 26, y: 35, porch: true, step: { x: 25, y: 36 }, door: { x: 25, y: 35 }, house: 'tully', litAtStart: true },
    { kind: 'prop', id: 'porch-linnet', art: 'porch-lamp', x: 15, y: 22, porch: true, step: { x: 14, y: 23 }, door: { x: 14, y: 22 }, house: 'linnet', litAtStart: true, darkCond: { all: [{ flag: 'sp.linnet-fell' }, { not: { flag: 'sp.linnet-returned' } }] } },
    { kind: 'prop', id: 'porch-keepers-cottage', art: 'porch-lamp', x: 10, y: 22, porch: true, step: { x: 9, y: 23 }, door: { x: 9, y: 22 }, house: 'keepers-cottage', litAtStart: false, litBy: 'loan-1' },
    { kind: 'prop', id: 'porch-dorrow', art: 'porch-lamp', x: 11, y: 33, porch: true, step: { x: 12, y: 34 }, door: { x: 12, y: 33 }, house: 'dorrow', litAtStart: false, litBy: 'family-letter', heirloom: 'dorrow-kettle' },
    { kind: 'prop', id: 'porch-odile', art: 'porch-lamp', x: 19, y: 29, porch: true, step: { x: 18, y: 30 }, door: { x: 18, y: 29 }, house: 'odile', litAtStart: false, litBy: 'family-letter', heirloom: 'odile-easel' },
    { kind: 'prop', id: 'porch-bryony', art: 'porch-lamp', x: 34, y: 35, porch: true, step: { x: 33, y: 36 }, door: { x: 33, y: 35 }, house: 'bryony', litAtStart: false, litBy: 'family-letter', heirloom: 'bryony-seed-tin' },
    { kind: 'prop', id: 'porch-thessaly', art: 'porch-lamp', x: 27, y: 9, porch: true, step: { x: 26, y: 10 }, door: { x: 26, y: 9 }, house: 'thessaly', litAtStart: false, litBy: 'family-letter', heirloom: 'thessaly-almanac' },
    { kind: 'prop', id: 'porch-dark-1', art: 'porch-lamp', x: 20, y: 35, porch: true, step: { x: 19, y: 36 }, door: { x: 19, y: 35 }, house: 'dark-1', litAtStart: false, litBy: 'commons-project', commons: 'dark-house-1', resident: 'tamsin' },
    { kind: 'prop', id: 'porch-dark-2', art: 'porch-lamp', x: 52, y: 35, porch: true, step: { x: 51, y: 36 }, door: { x: 51, y: 35 }, house: 'dark-2', litAtStart: false, litBy: 'relighting', reopensNight: 1 },
    { kind: 'prop', id: 'porch-dark-3', art: 'porch-lamp', x: 24, y: 26, porch: true, step: { x: 23, y: 27 }, door: { x: 23, y: 26 }, house: 'dark-3', litAtStart: false, litBy: 'relighting', reopensNight: 2 },
    { kind: 'prop', id: 'porch-dark-4', art: 'porch-lamp', x: 55, y: 19, porch: true, step: { x: 54, y: 20 }, door: { x: 54, y: 19 }, house: 'dark-4', litAtStart: false, litBy: 'relighting', reopensNight: 3 },
    { kind: 'prop', id: 'porch-dark-5', art: 'porch-lamp', x: 42, y: 35, porch: true, step: { x: 41, y: 36 }, door: { x: 41, y: 35 }, house: 'dark-5', litAtStart: false, litBy: 'relighting', reopensNight: 4 },
    { kind: 'prop', id: 'porch-dark-6', art: 'porch-lamp', x: 48, y: 35, porch: true, step: { x: 47, y: 36 }, door: { x: 47, y: 35 }, house: 'dark-6', litAtStart: false, litBy: 'relighting', reopensNight: 5 },
    { kind: 'prop', id: 'porch-dark-7', art: 'porch-lamp', x: 19, y: 18, porch: true, step: { x: 18, y: 19 }, door: { x: 18, y: 18 }, house: 'dark-7', litAtStart: false, litBy: 'relighting', reopensNight: 6 },
    { kind: 'prop', id: 'porch-dark-8', art: 'porch-lamp', x: 44, y: 9, porch: true, step: { x: 43, y: 10 }, door: { x: 43, y: 9 }, house: 'dark-8', litAtStart: false, litBy: 'relighting', reopensNight: 7 },
    // ---- furniture, boats, signs ({town} = the town name on the lease card) ----
    { kind: 'prop', id: 'gate-boards', x: 8, y: 24, art: 'tide-chalkboard', verb: 'gateBoards', note: 'Ledger pace line, Tide Table, Commons slip (06:00)' },
    { kind: 'prop', id: 'mailbox', x: 10, y: 24, art: 'post-box', verb: 'mailbox' },
    { kind: 'prop', id: 'consignment-crate', x: 7, y: 25, art: 'crates', verb: 'crate', shop: 'consignment-crate' },
    { kind: 'prop', id: 'porch-bench', x: 8, y: 23, art: 'bench', verb: 'sit', note: 'your porch bench: Sit = Day Page, verified save, clock x6' },
    { kind: 'prop', id: 'commons-board', x: 36, y: 24, art: 'commons-board', verb: 'commons', note: 'Augusta\'s board: odds, slips, Porch Duel slate, dossiers, the Commons Jar' },
    { kind: 'prop', id: 'commons-jar', x: 41, y: 24, art: 'barrel', verb: 'commonsJar' },
    { kind: 'prop', id: 'bench-green', x: 28, y: 26, art: 'bench', verb: 'sit', note: 'Thessaly\'s bench (10-16)' },
    { kind: 'prop', id: 'yard-counter', x: 52, y: 28, art: 'crates', verb: 'pay', note: 'Wren\'s abacus table: payments, the THWAP (ART REQUEST abacus-counter)' },
    { kind: 'prop', id: 'bench-yard', x: 55, y: 28, art: 'bench', verb: 'sit', note: 'Ambrose\'s bench' },
    { kind: 'prop', id: 'timber-stack-1', x: 50, y: 28, art: 'timber-stack' },
    { kind: 'prop', id: 'timber-stack-2', x: 50, y: 30, art: 'timber-stack' },
    { kind: 'prop', id: 'tide-board-quay', x: 36, y: 39, art: 'tide-chalkboard', verb: 'tideTable' },
    { kind: 'prop', id: 'shop-sign-pells', x: 26, y: 19, art: 'shop-sign', verb: 'look' },
    { kind: 'prop', id: 'tally-post', x: 56, y: 27, art: 'signpost', verb: 'look', note: 'the yard\'s split-stick post (the tally wall proper is in the shed)' },
    { kind: 'boat', id: 'ansel-launch', x: 51, y: 9, art: 'launch-beached', note: 'beached; Ansel\'s post 17-23' },
    { kind: 'boat', id: 'oyster-boat', x: 44, y: 4, art: 'boat', note: 'the Bracks\' oyster boat, nameboard missing (thread The Oyster Boat)' },
    { kind: 'boat', id: 'maud-punt', x: 35, y: 44, art: 'punt', verb: 'ferry', note: 'Maud\'s ferry 05:00-01:00' },
    { kind: 'boat', id: 'carnival-raft', x: 52, y: 46, art: 'carnival-raft', verb: 'shop', shop: 'carnival-raft', cond: { flag: 'sp.raft-docked' }, note: 'ART REQUEST carnival-raft; moored at the Old Pier from day 3' },
    { kind: 'sign', id: 'sign-lowmoor-stones', x: 11, y: 35, art: 'signpost', text: 'Lowmoor by the stones. Dry two hours either side of low water. Mind the time.' },
    { kind: 'sign', id: 'sign-lowmoor-boardwalk', x: 19, y: 5, art: 'signpost', text: 'Lowmoor the long way: over the marsh boardwalk. Any tide.' },
    { kind: 'sign', id: 'sign-the-bar', x: 8, y: 14, art: 'signpost', text: 'The Bar. Dry only at the day\'s lower low. It does not wait for you.' },
    { kind: 'sign', id: 'sign-causeway', x: 59, y: 33, art: 'signpost', text: 'Mainland causeway. Dry an hour either side of low water. Last walker crossed: you.' },
    { kind: 'sign', id: 'sign-green', x: 28, y: 22, art: 'signpost', text: '{town} Green. The Commons board is by the bridge road.' },
    { kind: 'sign', id: 'sign-quay', x: 19, y: 39, art: 'signpost', text: '{town} Quay. Ferry at Maud\'s berth, 05:00 to 01:00.' },
    { kind: 'sign', id: 'sign-old-quay', x: 59, y: 41, art: 'signpost', text: 'Old Quay. Under water but for the spring lows.' },
    { kind: 'sign', id: 'sign-river-stones', x: 32, y: 10, art: 'signpost', text: 'Stepping stones: low water only. The bridge is just upstream.' },
    { kind: 'sign', id: 'sign-north-creek', x: 34, y: 6, art: 'signpost', text: 'North Creek. Dry since the weir went in. Ask the heron.' },
    { kind: 'sign', id: 'sign-lighthouse', x: 8, y: 17, art: 'signpost', text: 'Pell Point Light. Unlit thirty years.' },
  ],
  triggers: [
    { x: 10, y: 24, kind: 'use', id: 'mailbox', verb: 'mailbox' },
    { x: 8, y: 24, kind: 'use', id: 'gate-boards', verb: 'gateBoards' },
    { x: 7, y: 25, kind: 'use', id: 'consignment-crate', verb: 'crate' },
    { x: 8, y: 23, kind: 'use', id: 'porch-bench', verb: 'sit' },
    { x: 36, y: 24, kind: 'use', id: 'commons-board', verb: 'commons' },
    { x: 41, y: 24, kind: 'use', id: 'commons-jar', verb: 'commonsJar' },
    { x: 52, y: 28, kind: 'use', id: 'yard-counter', verb: 'pay' },
    { x: 35, y: 44, kind: 'use', id: 'ferry', verb: 'ferry' },
    { x: 36, y: 39, kind: 'use', id: 'tide-board-quay', verb: 'tideTable' },
    { x: 56, y: 35, kind: 'use', id: 'anchorage-counter', verb: 'shop', shop: 'the-anchorage' },
    { x: 52, y: 46, kind: 'use', id: 'raft', verb: 'shop', shop: 'carnival-raft', cond: { flag: 'sp.raft-docked' } },
    { x: 51, y: 19, kind: 'use', id: 'ludo-eave', verb: 'shop', shop: 'ludo-eave', note: 'the eave Ludo hangs from (22:00-08:00)' },
    { x: 52, y: 25, kind: 'use', id: 'knock-coop-yard', verb: 'knock', porch: 'porch-coop-yard' },
    { x: 42, y: 19, kind: 'use', id: 'knock-wardens-house', verb: 'knock', porch: 'porch-wardens-house' },
    { x: 25, y: 35, kind: 'use', id: 'knock-tully', verb: 'knock', porch: 'porch-tully' },
    { x: 14, y: 22, kind: 'use', id: 'knock-linnet', verb: 'knock', porch: 'porch-linnet' },
    { x: 12, y: 33, kind: 'use', id: 'knock-dorrow', verb: 'knock', porch: 'porch-dorrow' },
    { x: 18, y: 29, kind: 'use', id: 'knock-odile', verb: 'knock', porch: 'porch-odile' },
    { x: 33, y: 35, kind: 'use', id: 'knock-bryony', verb: 'knock', porch: 'porch-bryony' },
    { x: 26, y: 9, kind: 'use', id: 'knock-thessaly', verb: 'knock', porch: 'porch-thessaly' },
    { x: 19, y: 35, kind: 'use', id: 'knock-dark-1', verb: 'knock', porch: 'porch-dark-1' },
    { x: 51, y: 35, kind: 'use', id: 'knock-dark-2', verb: 'knock', porch: 'porch-dark-2' },
    { x: 23, y: 26, kind: 'use', id: 'knock-dark-3', verb: 'knock', porch: 'porch-dark-3' },
    { x: 54, y: 19, kind: 'use', id: 'knock-dark-4', verb: 'knock', porch: 'porch-dark-4' },
    { x: 41, y: 35, kind: 'use', id: 'knock-dark-5', verb: 'knock', porch: 'porch-dark-5' },
    { x: 47, y: 35, kind: 'use', id: 'knock-dark-6', verb: 'knock', porch: 'porch-dark-6' },
    { x: 18, y: 18, kind: 'use', id: 'knock-dark-7', verb: 'knock', porch: 'porch-dark-7' },
    { x: 43, y: 9, kind: 'use', id: 'knock-dark-8', verb: 'knock', porch: 'porch-dark-8' },
    { x: 53, y: 7, kind: 'use', id: 'weir', verb: 'look', note: 'the weir wheel (Ansel\'s coda)' },
    { x: 63, y: 30, kind: 'use', id: 'mainland-turnback', verb: 'look', h: 2, note: 'arrival only: the causeway is under behind you' },
  ],
  warps: [
    { x: 9, y: 22, kind: 'door', to: { mapId: 'int-cottage', x: 8, y: 10, facing: 'up' }, sfx: 'doorOpen' },
    { x: 24, y: 19, kind: 'door', to: { mapId: 'int-pells', x: 7, y: 8, facing: 'up' }, sfx: 'doorOpen' },
    { x: 48, y: 19, kind: 'door', to: { mapId: 'int-post-office', x: 6, y: 8, facing: 'up' }, sfx: 'doorOpen' },
    { x: 32, y: 19, kind: 'door', to: { mapId: 'int-archive', x: 8, y: 10, facing: 'up' }, sfx: 'doorOpen' },
    { x: 56, y: 25, kind: 'door', to: { mapId: 'int-yard-shed', x: 7, y: 8, facing: 'up' }, sfx: 'doorOpen' },
    { x: 4, y: 18, kind: 'door', to: { mapId: 'int-lighthouse', x: 6, y: 16, facing: 'up' }, sfx: 'doorOpen' },
    { x: 0, y: 38, kind: 'edge', to: { mapId: 'lowmoor', x: 46, y: 22, facing: 'left' }, via: 'short-way', tideWindow: 120, note: 'Lowmoor stones from the point flats (GDD-00 §4: +-2 h)' },
    { x: 13, y: 0, kind: 'edge', to: { mapId: 'lowmoor', x: 46, y: 4, facing: 'left' }, via: 'long-way', note: 'river footbridge + marsh boardwalk, any tide' },
    { x: 6, y: 0, w: 2, kind: 'edge', to: { mapId: 'the-bar', x: 1, y: 12, facing: 'right' }, via: 'the-bar', tideWindow: 90, lowerLow: true, openFlag: 'lit.bar', note: 'the Bar road (tile-gated); any tide after the Relighting' },
  ],
  spawns: [
    { area: { x: 4, y: 25, w: 12, h: 6 }, table: 'pellwick-point-night', rate: 0.05, reeds: true, cond: { all: [{ flag: 'lit.calls' }, { phase: ['dusk', 'evening', 'night'] }] } },
    { area: 'grass', table: 'pellwick-reeds', rate: 0.1, reeds: true },
    { area: { x: 29, y: 11, w: 14, h: 2 }, table: 'pellwick-reach', rate: 0, via: 'hook', note: 'never stepped: reaches hook this table through fishing (reaches[].creatureTable)' },
  ],
  regions: {
    'lowmoor-long-way': { x: 13, y: 0, w: 10, h: 7 },
    'marsh-reeds': { x: 9, y: 3, w: 11, h: 11 },
    'north-creek': { x: 35, y: 3, w: 18, h: 5 },
    'orchard': { x: 23, y: 5, w: 30, h: 6 },
    'bar-head': { x: 5, y: 13, w: 4, h: 4 },
    'point-flats': { x: 3, y: 34, w: 19, h: 9 },
    'lowmoor-short-way': { x: 0, y: 36, w: 7, h: 4 },
    'the-dock': { x: 15, y: 36, w: 4, h: 6 },
    'causeway-end': { x: 56, y: 28, w: 8, h: 5 },
    'old-quay': { x: 53, y: 42, w: 6, h: 5 },
    'reach-river-bridge': { x: 29, y: 11, w: 14, h: 2 },
    'reach-river-mouth': { x: 20, y: 2, w: 3, h: 9 },
    'reach-quay-west': { x: 19, y: 42, w: 14, h: 3 },
    'reach-quay-east': { x: 36, y: 42, w: 14, h: 3 },
    'point-heath': { x: 4, y: 25, w: 12, h: 6 },
    'arrival-causeway': { x: 56, y: 28, w: 8, h: 5 },
    'starter-stones': { x: 57, y: 28, w: 3, h: 5 },
    'the-point': { x: 3, y: 14, w: 16, h: 20 },
    'keepers-cottage': { x: 6, y: 19, w: 7, h: 6 },
    'keepers-orchard': { x: 5, y: 25, w: 11, h: 6 },
    'lighthouse': { x: 4, y: 14, w: 5, h: 7 },
    'green': { x: 27, y: 21, w: 23, h: 11 },
    'first-orchard': { x: 28, y: 22, w: 7, h: 9 },
    'commons-square': { x: 34, y: 24, w: 8, h: 4 },
    'lantern-market': { x: 34, y: 22, w: 15, h: 9 },
    'coop-yard': { x: 50, y: 22, w: 9, h: 9 },
    'quay': { x: 17, y: 37, w: 43, h: 6 },
    'maud-berth': { x: 32, y: 41, w: 4, h: 4 },
    'old-pier': { x: 49, y: 41, w: 4, h: 6 },
    'the-reeds': { x: 40, y: 12, w: 12, h: 2 },
    'reeds-by-pells': { x: 24, y: 13, w: 7, h: 1 },
    'hill-orchard': { x: 56, y: 1, w: 8, h: 13 },
    'weir': { x: 47, y: 3, w: 9, h: 8 },
    'mudlark-mile': { x: 3, y: 34, w: 19, h: 9 },
    'glint-area': { x: 3, y: 34, w: 16, h: 8 },
    'sparkle-area': { x: 3, y: 34, w: 19, h: 9 },
    'skyglass-area': { x: 4, y: 35, w: 13, h: 7 },
    'dark-row': { x: 40, y: 32, w: 19, h: 6 },
    'porchlight-view': { x: 17, y: 30, w: 5, h: 2 },
  },
  markers: {
    'porch-coop-yard-step': { x: 52, y: 26, facing: 'down' },
    'door-coop-yard': { x: 52, y: 25, facing: 'up' },
    'porch-pells-step': { x: 24, y: 20, facing: 'down' },
    'door-pells': { x: 24, y: 19, facing: 'up' },
    'porch-post-office-step': { x: 48, y: 20, facing: 'down' },
    'door-post-office': { x: 48, y: 19, facing: 'up' },
    'porch-archive-step': { x: 32, y: 20, facing: 'down' },
    'door-archive': { x: 32, y: 19, facing: 'up' },
    'porch-wardens-house-step': { x: 42, y: 20, facing: 'down' },
    'door-wardens-house': { x: 42, y: 19, facing: 'up' },
    'porch-tully-step': { x: 25, y: 36, facing: 'down' },
    'door-tully': { x: 25, y: 35, facing: 'up' },
    'porch-linnet-step': { x: 14, y: 23, facing: 'down' },
    'door-linnet': { x: 14, y: 22, facing: 'up' },
    'porch-keepers-cottage-step': { x: 9, y: 23, facing: 'down' },
    'door-keepers-cottage': { x: 9, y: 22, facing: 'up' },
    'porch-dorrow-step': { x: 12, y: 34, facing: 'down' },
    'door-dorrow': { x: 12, y: 33, facing: 'up' },
    'porch-odile-step': { x: 18, y: 30, facing: 'down' },
    'door-odile': { x: 18, y: 29, facing: 'up' },
    'porch-bryony-step': { x: 33, y: 36, facing: 'down' },
    'door-bryony': { x: 33, y: 35, facing: 'up' },
    'porch-thessaly-step': { x: 26, y: 10, facing: 'down' },
    'door-thessaly': { x: 26, y: 9, facing: 'up' },
    'porch-dark-1-step': { x: 19, y: 36, facing: 'down' },
    'door-dark-1': { x: 19, y: 35, facing: 'up' },
    'porch-dark-2-step': { x: 51, y: 36, facing: 'down' },
    'door-dark-2': { x: 51, y: 35, facing: 'up' },
    'porch-dark-3-step': { x: 23, y: 27, facing: 'down' },
    'door-dark-3': { x: 23, y: 26, facing: 'up' },
    'porch-dark-4-step': { x: 54, y: 20, facing: 'down' },
    'door-dark-4': { x: 54, y: 19, facing: 'up' },
    'porch-dark-5-step': { x: 41, y: 36, facing: 'down' },
    'door-dark-5': { x: 41, y: 35, facing: 'up' },
    'porch-dark-6-step': { x: 47, y: 36, facing: 'down' },
    'door-dark-6': { x: 47, y: 35, facing: 'up' },
    'porch-dark-7-step': { x: 18, y: 19, facing: 'down' },
    'door-dark-7': { x: 18, y: 18, facing: 'up' },
    'porch-dark-8-step': { x: 43, y: 10, facing: 'down' },
    'door-dark-8': { x: 43, y: 9, facing: 'up' },
    'door-yard-shed': { x: 56, y: 25, facing: 'up' },
    'door-anchorage': { x: 56, y: 35, facing: 'up' },
    'door-lighthouse': { x: 4, y: 18, facing: 'up' },
    'wren-yard': { x: 52, y: 27, facing: 'down' },
    'wren-causeway': { x: 57, y: 30, facing: 'right' },
    'ambrose-bench': { x: 56, y: 29, facing: 'up' },
    'ambrose-timber': { x: 51, y: 29, facing: 'left' },
    'hesper-post-step': { x: 48, y: 20, facing: 'down' },
    'hesper-cottage-gate': { x: 9, y: 25, facing: 'up' },
    'juniper-pells-step': { x: 24, y: 20, facing: 'down' },
    'ludo-eave': { x: 51, y: 20, facing: 'up', hangs: { x: 51, y: 19 } },
    'barnaby-archive-step': { x: 32, y: 20, facing: 'down' },
    'archive-porthole': { x: 34, y: 20, facing: 'up' },
    'barnaby-flats': { x: 12, y: 37, facing: 'down', tide: 'low' },
    'augusta-wardens-step': { x: 42, y: 20, facing: 'down' },
    'augusta-commons-board': { x: 37, y: 25, facing: 'up' },
    'ansel-launch': { x: 50, y: 9, facing: 'down' },
    'ansel-creek': { x: 47, y: 5, facing: 'up' },
    'ansel-weir': { x: 52, y: 7, facing: 'right' },
    'piling': { x: 50, y: 10, facing: 'down', onSolid: true },
    'wick-burrow': { x: 12, y: 34, facing: 'down' },
    'wick-cliff-stair': { x: 10, y: 30, facing: 'down' },
    'tully-porch': { x: 25, y: 36, facing: 'down' },
    'tully-lap-1': { x: 27, y: 21, facing: 'right' },
    'tully-lap-2': { x: 49, y: 21, facing: 'down' },
    'tully-lap-3': { x: 49, y: 31, facing: 'left' },
    'tully-lap-4': { x: 27, y: 31, facing: 'up' },
    'odile-porch': { x: 18, y: 30, facing: 'down' },
    'odile-easel': { x: 6, y: 23, facing: 'left' },
    'bryony-porch': { x: 33, y: 36, facing: 'down' },
    'bryony-beans': { x: 31, y: 36, facing: 'left' },
    'fence-bryony-tully': { x: 29, y: 37, facing: 'up' },
    'thessaly-porch': { x: 26, y: 10, facing: 'down' },
    'thessaly-bench': { x: 28, y: 27, facing: 'up' },
    'tamsin-porch': { x: 19, y: 36, facing: 'down' },
    'tamsin-flats': { x: 14, y: 38, facing: 'left', tide: 'low' },
    'corin-step': { x: 10, y: 23, facing: 'left' },
    'corin-archive-step': { x: 31, y: 20, facing: 'down' },
    'corin-reeds': { x: 42, y: 14, facing: 'up' },
    'corin-stones': { x: 5, y: 37, facing: 'left' },
    'corin-dock': { x: 16, y: 36, facing: 'down' },
    'linnet-porch': { x: 14, y: 23, facing: 'down' },
    'linnet-vault-to': { x: 11, y: 23, facing: 'left' },
    'dimity-lamp': { x: 10, y: 22, facing: 'down', onSolid: true },
    'thatch-roof': { x: 9, y: 19, facing: 'down', onSolid: true },
    'maud-berth': { x: 34, y: 43, facing: 'right' },
    'maud-punt': { x: 35, y: 44, facing: 'left', water: true },
    'maud-punt-dock': { x: 18, y: 42, facing: 'left', water: true },
    'pip-quay': { x: 40, y: 40, facing: 'left' },
    'merrow-anchorage': { x: 56, y: 36, facing: 'down' },
    'anchorage-counter': { x: 56, y: 36, facing: 'up' },
    'varga-raft': { x: 51, y: 46, facing: 'down' },
    'dov-stall': { x: 40, y: 26, facing: 'down' },
    'arrival-start': { x: 63, y: 30, facing: 'left', tide: 'low' },
    'causeway-foam': { x: 61, y: 30, facing: 'left', tide: 'low' },
    'lease-card-player': { x: 58, y: 31, facing: 'left' },
    'starter-sloshkin': { x: 59, y: 29, facing: 'left' },
    'starter-scrapling': { x: 59, y: 31, facing: 'left' },
    'starter-reedkit': { x: 59, y: 30, facing: 'left' },
    'starter-kneel': { x: 58, y: 30, facing: 'right' },
    'cottage-porch': { x: 9, y: 23, facing: 'down' },
    'cottage-door-inside-step': { x: 9, y: 23, facing: 'up' },
    'wick-errands': { x: 10, y: 25, facing: 'up' },
    'yard-apron': { x: 53, y: 29, facing: 'up' },
    'commons-pin': { x: 36, y: 25, facing: 'up' },
    'tully-nickname': { x: 38, y: 25, facing: 'left' },
    'meet-odile': { x: 18, y: 31, facing: 'up' },
    'meet-bryony': { x: 33, y: 37, facing: 'up' },
    'meet-thessaly': { x: 32, y: 23, facing: 'left' },
    'first-orchard': { x: 30, y: 26, facing: 'up' },
    'mail-sack': { x: 35, y: 40, facing: 'down' },
    'post-office-door': { x: 48, y: 20, facing: 'up' },
    'reeds-stance': { x: 43, y: 14, facing: 'up' },
    'reeds-tossup': { x: 43, y: 13, facing: 'down' },
    'ansel-tells-player': { x: 49, y: 9, facing: 'down' },
    'pip-player': { x: 39, y: 40, facing: 'right' },
    'ludo-sale': { x: 51, y: 21, facing: 'up' },
    'yard-payment': { x: 52, y: 29, facing: 'up' },
    'porchlight-player': { x: 9, y: 24, facing: 'up' },
    'prismoth-lamp': { x: 10, y: 23, facing: 'up' },
    'corin-slip': { x: 9, y: 23, facing: 'up' },
    'night-fishing': { x: 30, y: 41, facing: 'down' },
    'glowing-flats': { x: 9, y: 37, facing: 'down', tide: 'low' },
    'glint-hint': { x: 11, y: 38, facing: 'down', tide: 'low' },
    'mailbox-front': { x: 10, y: 25, facing: 'up' },
    'stones-start': { x: 3, y: 38, facing: 'left' },
    'boardwalk-start': { x: 19, y: 6, facing: 'left' },
    'bar-head': { x: 6, y: 14, facing: 'up' },
    'raft-berth': { x: 51, y: 45, facing: 'down' },
    'market-green': { x: 39, y: 26, facing: 'down' },
    'market-stall-1': { x: 43, y: 24, facing: 'down' },
    'market-stall-2': { x: 44, y: 26, facing: 'down' },
    'market-stall-3': { x: 46, y: 28, facing: 'down' },
    'shift-fair': { x: 40, y: 25, facing: 'down' },
    'linnet-ferry-leaves': { x: 34, y: 42, facing: 'down' },
    'point-skywatch': { x: 5, y: 20, facing: 'up' },
    'lighthouse-door': { x: 4, y: 19, facing: 'up' },
    'relighting-juniper': { x: 9, y: 25, facing: 'left' },
    'relighting-crowd-1': { x: 6, y: 19, facing: 'up' },
    'relighting-crowd-2': { x: 7, y: 18, facing: 'left' },
    'crossing-start': { x: 7, y: 14, facing: 'up' },
    'engine-watch': { x: 6, y: 16, facing: 'up' },
    'point-dawn': { x: 8, y: 27, facing: 'left' },
    'weir-wheel': { x: 52, y: 6, facing: 'right' },
    'bell-dig': { x: 56, y: 44, facing: 'down', tide: 'low', spring: true },
    'tamsin-boat': { x: 44, y: 5, facing: 'up' },
    'blackout-wake': { x: 9, y: 23, facing: 'down' },
    'party-green': { x: 30, y: 24, facing: 'down' },
    'commons-training-yard': { x: 30, y: 28, facing: 'down' },
    'commons-third-stall': { x: 44, y: 22, facing: 'down' },
    'north-creek-footbridge': { x: 36, y: 6, facing: 'up' },
    'mudlark-start': { x: 13, y: 34, facing: 'down', tide: 'low' },
    'mudlark-finish': { x: 17, y: 41, facing: 'down' },
    'weathervane-ansel': { x: 37, y: 26, facing: 'up' },
  },
  reaches: [
    { id: 'reach-river-bridge', kind: 'river', area: { x: 29, y: 11, w: 14, h: 2 }, creatureTable: 'pellwick-reach', name: 'Bridge Reach' },
    { id: 'reach-river-mouth', kind: 'river', area: { x: 20, y: 2, w: 3, h: 9 }, creatureTable: 'pellwick-reach', nightKind: 'sea', name: 'River Mouth' },
    { id: 'reach-quay-west', kind: 'quay', area: { x: 19, y: 42, w: 14, h: 3 }, creatureTable: 'pellwick-reach', nightKind: 'sea', name: 'Quay Steps' },
    { id: 'reach-quay-east', kind: 'quay', area: { x: 36, y: 42, w: 14, h: 3 }, creatureTable: 'pellwick-reach', nightKind: 'sea', name: 'Old Pier' },
    { id: 'north-creek', kind: 'creek', area: { x: 36, y: 4, w: 15, h: 1 }, shadows: [0, 2], cond: { flag: 'sp.weir-turned' }, name: 'North Creek', note: 'empty until the weir turns (GDD-00 §9); then a few shadows a week' },
  ],
  town: true,
  dig: { spots: [[40, 4], [45, 5], [49, 4], [15, 27], [6, 22], [30, 30], [46, 30], [57, 11], [61, 7], [25, 4], [15, 32], [58, 20], [33, 30], [11, 18], [44, 22], [24, 28]] },
  flats: { spots: [[4, 34], [5, 34], [6, 34], [7, 34], [14, 34], [15, 34], [17, 34], [3, 35], [4, 35], [5, 35], [12, 35], [13, 35], [14, 35], [15, 35], [17, 35], [3, 36], [4, 36], [7, 36], [8, 36], [9, 36], [10, 36], [11, 36], [13, 36], [15, 36], [17, 36], [21, 36], [3, 37], [6, 37], [7, 37], [8, 37], [9, 37], [10, 37], [11, 37], [12, 37], [13, 37], [14, 37], [15, 37], [5, 38], [6, 38], [7, 38], [8, 38], [9, 38], [10, 38], [11, 38], [12, 38], [14, 38], [15, 38], [4, 39], [5, 39], [6, 39], [8, 39], [9, 39], [10, 39], [11, 39], [12, 39], [13, 39], [14, 39], [15, 39], [5, 40], [6, 40], [7, 40], [8, 40], [9, 40], [10, 40], [11, 40], [12, 40], [13, 40], [14, 40], [15, 40], [17, 40], [6, 41], [7, 41], [8, 41], [10, 41], [12, 41], [13, 41], [14, 41], [15, 41], [16, 41], [17, 41], [8, 42], [9, 42], [10, 42], [11, 42], [12, 42], [13, 42], [14, 42], [15, 42], [16, 42], [17, 42]], glint: true, skyglass: true, cockles: { item: 'cockle' } },
  bugSpots: [
    { x: 57, y: 3, habitat: 'orchard' },
    { x: 61, y: 5, habitat: 'orchard' },
    { x: 59, y: 9, habitat: 'orchard' },
    { x: 61, y: 11, habitat: 'orchard' },
    { x: 31, y: 6, habitat: 'orchard' },
    { x: 39, y: 8, habitat: 'orchard' },
    { x: 30, y: 24, habitat: 'orchard' },
    { x: 32, y: 28, habitat: 'orchard' },
    { x: 44, y: 24, habitat: 'orchard' },
    { x: 46, y: 28, habitat: 'orchard' },
    { x: 8, y: 27, habitat: 'orchard' },
    { x: 12, y: 29, habitat: 'orchard' },
    { x: 10, y: 18, habitat: 'orchard' },
    { x: 26, y: 13, habitat: 'reeds' },
    { x: 44, y: 13, habitat: 'reeds' },
    { x: 49, y: 12, habitat: 'reeds' },
    { x: 14, y: 9, habitat: 'reeds' },
    { x: 11, y: 13, habitat: 'reeds' },
    { x: 17, y: 5, habitat: 'reeds' },
    { x: 13, y: 22, habitat: 'meadow' },
    { x: 6, y: 18, habitat: 'meadow' },
    { x: 15, y: 28, habitat: 'meadow' },
    { x: 24, y: 30, habitat: 'meadow' },
    { x: 57, y: 18, habitat: 'meadow' },
    { x: 14, y: 32, habitat: 'shore' },
    { x: 27, y: 3, habitat: 'shore' },
    { x: 44, y: 3, habitat: 'shore' },
    { x: 59, y: 25, habitat: 'shore' },
    { x: 20, y: 36, habitat: 'shore' },
    { x: 52, y: 26, habitat: 'porch', porch: 'porch-coop-yard' },
    { x: 24, y: 20, habitat: 'porch', porch: 'porch-pells' },
    { x: 48, y: 20, habitat: 'porch', porch: 'porch-post-office' },
    { x: 32, y: 20, habitat: 'porch', porch: 'porch-archive' },
    { x: 42, y: 20, habitat: 'porch', porch: 'porch-wardens-house' },
    { x: 25, y: 36, habitat: 'porch', porch: 'porch-tully' },
    { x: 14, y: 23, habitat: 'porch', porch: 'porch-linnet' },
    { x: 9, y: 23, habitat: 'porch', porch: 'porch-keepers-cottage' },
    { x: 12, y: 34, habitat: 'porch', porch: 'porch-dorrow' },
    { x: 18, y: 30, habitat: 'porch', porch: 'porch-odile' },
    { x: 33, y: 36, habitat: 'porch', porch: 'porch-bryony' },
    { x: 26, y: 10, habitat: 'porch', porch: 'porch-thessaly' },
    { x: 19, y: 36, habitat: 'porch', porch: 'porch-dark-1' },
    { x: 51, y: 36, habitat: 'porch', porch: 'porch-dark-2' },
    { x: 23, y: 27, habitat: 'porch', porch: 'porch-dark-3' },
    { x: 54, y: 20, habitat: 'porch', porch: 'porch-dark-4' },
    { x: 41, y: 36, habitat: 'porch', porch: 'porch-dark-5' },
    { x: 47, y: 36, habitat: 'porch', porch: 'porch-dark-6' },
    { x: 18, y: 19, habitat: 'porch', porch: 'porch-dark-7' },
    { x: 43, y: 10, habitat: 'porch', porch: 'porch-dark-8' },
  ],
  music: null,
  light: { indoor: false, ambient: 'harbor' },
  entry: { x: 9, y: 23, facing: 'down' },
};

/**
 * THE BAR (the-bar) — the drowned tide road from the point to Shardcrown (GDD-00 §2, §4, §8; GDD-01 §15.7).
 * [DATA-MAPS] 64x24 tiles, wild Lv40-44 (the tide pools), the Long Road.
 *
 * West: the Bar head shoal (dry), where Pellwick's Bar road comes up (the point's warp is tile-gated on the
 * Pellwick side). The Bar road (two wide) winds east over the shallows past the wreck ribs of the lost
 * fleet, tide pools and six dry sandbanks where Hollis's Long Road trainers stand. 'n' (bar-road-near) runs
 * from the shoal to the spur foot and is dry around EVERY low; 'b' (bar-road) beyond the spur foot is dry
 * only around the day's lower low (+-1.5 h); `lit.bar` opens both at any tide (GDD-01 §7, §17.2). Halfway,
 * at the spur foot where Wick waits, the Lantern Stack spur ('M' = bar-spur, dry around every low, +-1.5 h,
 * GDD-00 §4) runs north to the stack's ledge and its door (lantern-stack). East: the
 * shore of Shardcrown and Hollis's Gate (door to hollis-gate, where the seventh Waystone is).
 *
 * Map-only legend chars: 'X' wreck ribs (detail), 'Y' wreck post (detail), 'Z' sea stack (ground, solid),
 * 'M' bar-spur, 'n' bar-road-near (they override the mainland causeway, glow mud, the weir, mud flat, heather). Generated once from a layout script, then
 * hand-edited: edit the rows directly.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'the-bar',
  name: 'The Bar',
  kind: 'exterior',
  region: 'the-bar',
  w: 64,
  h: 24,
  legend: { X: 'wreck-ribs', Y: 'wreck-post', Z: 'sea-stack', M: 'bar-spur', n: 'bar-road-near' },
  ground: [
    //0000000000111111111122222222223333333333444444444455555555556666
    //0123456789012345678901234567890123456789012345678901234567890123
    'DDDDDDDDDDDDDDDDDDDDDDDDDDCCCCCCCDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', //  0
    'DDDDDDDDSSSDDDDDSSSSDDDDZDCCC"CCCZDDDDDDDDDDDDSSSSSDDDDDDDDSSSDD', //  1
    'SSSDDDDSSSSSSDDSSSSSSSDSDqqqqqqqqqSZDDSSSSSDDDSSSSSSSSDDDDSSSSSD', //  2
    'SSSSSSSSSSSSSSSSSSSSSSSZSqqqqqqqqqSSSSSSSSSSSSSSSSSSSSSSDSSSSSSS', //  3
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSMMSSSZSSSSSSSSSSSSSSSSSSSSSSqqqqqqq', //  4
    'SSSSSSSSSSSSSSSSa~aaSSSSSSSSSMMSSSSSSSSSSSSSSSSSSSSSSSSqqqqaaaaa', //  5
    'SSSSSSSSSSSSSSSa~aaaSSSSSSSSSMMSSSSSSa~aaSSSSSSSSSSSSSqq^^^^^^^a', //  6
    'SSSSSSSSSSSSSSSaaaaSSSSSSSSSSMMSSSSSaaaaaaSSSSSSSSSSSqqq^^^^^^^G', //  7
    'SSSSSSSSSSSSnnnnnnnnnnnSSSSSSMMSSSSSSaaaSSSSSSSSSSSSSqqq^^^^^^^G', //  8
    'SSSSSSSSSSSSnnnnnnnnnnnSSSSSSMMSSbbbbbbbbbbbbSSSSSSSSqqas]s]s]sG', //  9
    'aaaaSSSSSSSSnnSSSSSSSnnSSSSSSMMaSbbbbbbbbbbbbSSSSSSSqqqass]"]ssG', // 10
    'naannnnnnnnnnnSSSSSSSnnSSSSSaaaaabbSSSSSSSSbbSSSSSSSqqqaafffffGG', // 11
    'naannnnnnnnnnSSSSSSSSnnSSSSSSaaaSbbSSSSSSSSbbbbbbbbbqqqaafffffaa', // 12
    'naaaaSSSaaaaSSSSSSSSSnnnnnnnnnnnnbbSSSSSSSSbbbbbbbbbqqffffffffaa', // 13
    'aaaaSSaaaaaaSSSSSSSSSnnnnnnnnnnnnbSSSSSSSSSSSSaaaaSSqqqaaaaaaaaa', // 14
    'SSSSSSSSa~aaSSSSSSSSSSSSaaaaaSSSSSSSSSSSSSSSaaaa~aaSqqqaaaaaaaaa', // 15
    'SSSSSSSSSSSSSSSSSSSSSSSaa~aaaaSSSSSSSSSSSSSSSSa~aSSSSqqqaaaaaaaa', // 16
    'SSSSSSSSSSSSSSSSSSSSSSSSaa~aaSSSSSSSSSSSSSSSSSSSSSSSSSqqaaaaaaaa', // 17
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSqqqqaaaaaa', // 18
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSqqqqaaaaa', // 19
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSqqqqqqqq', // 20
    'SSSSDDDDSSSSSSDDDSSSSSSSSDDDDDSSSSSDDDSSSSSSSDDDDSSSSSSDDDDqqqqS', // 21
    'DDDDDDDDDSSSDDDDDDDSSSSDDDDDDDDDDSDDDDDSSSSDDDDDDDDSSSDDDDDDDDDD', // 22
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 23
  ],
  detail: [
    //0000000000111111111122222222223333333333444444444455555555556666
    //0123456789012345678901234567890123456789012345678901234567890123
    '................................................................', //  0
    '................................................................', //  1
    '................................................................', //  2
    '..........................o.....................................', //  3
    '...............................................................o', //  4
    '.......................XXX......................................', //  5
    '........................Y.....................XXX...............', //  6
    '...............................................Y................', //  7
    '.....XXX..............................................o.........', //  8
    '......Y.........................................................', //  9
    '..........Y.......................................Y.............', // 10
    '...................Y............................................', // 11
    '........................................................L.....L.', // 12
    '.........................................Y......................', // 13
    '................................................................', // 14
    '..............XXX...................XXX.........................', // 15
    '...............Y.....................Y..........................', // 16
    '.......................................................oX.....o.', // 17
    '................................................................', // 18
    '................................................................', // 19
    '................................................................', // 20
    '................................................................', // 21
    '................................................................', // 22
    '................................................................', // 23
  ],
  overlay: null,
  collision: null,
  props: [],
  entities: [
    // Shardcrown and the stack
    { kind: 'prop', id: 'hollis-gate-arch', x: 58, y: 13, art: 'signpost', verb: 'look', note: 'the Readers\' fund ledger is nailed by the gate; six badges open it' },
    { kind: 'prop', id: 'stack-chain', x: 32, y: 3, art: 'mooring-post', verb: 'look', note: 'Merrow\'s Engine is chained here in Act III' },
    { kind: 'sign', id: 'sign-the-bar', x: 3, y: 10, art: 'signpost', text: 'The Bar. Shardcrown at the far end. Dry only at the day\'s lower low.' },
    { kind: 'sign', id: 'sign-lantern-stack', x: 31, y: 10, art: 'signpost', text: 'The Lantern Stack. The spur is dry at every low.' },
    { kind: 'sign', id: 'sign-shardcrown', x: 53, y: 14, art: 'signpost', text: 'Shardcrown. Hollis\'s Gate. The Summit beyond.' },
  ],
  triggers: [],
  warps: [
    { x: 0, y: 12, kind: 'edge', to: { mapId: 'pellwick', x: 6, y: 1, facing: 'down' }, via: 'short-way', way: 'spur', tideWindow: 90, openFlag: 'lit.bar', note: 'back down the Bar road to the point' },
    { x: 59, y: 10, kind: 'door', to: { mapId: 'hollis-gate', x: 10, y: 12, facing: 'up' }, way: 'bar', sfx: 'doorOpen', note: 'Hollis\'s Gate (the Waystone is inside); behind the far Bar road: the day\'s lower low, any tide after lit.bar; its door back lands on (59,11)' },
    { x: 29, y: 1, kind: 'door', to: { mapId: 'lantern-stack', x: 10, y: 14, facing: 'up' }, way: 'spur', sfx: 'doorOpen', note: 'the Lantern Stack, at the end of the spur (every low); its door back lands on (29,2)' },
  ],
  spawns: [
    { area: { x: 7, y: 10, w: 6, h: 4 }, table: 'the-bar-pools', rate: 0.08, note: 'the road beside the tide pools' },
    { area: { x: 15, y: 7, w: 6, h: 3 }, table: 'the-bar-pools', rate: 0.08, note: 'the road beside the tide pools' },
    { area: { x: 23, y: 12, w: 6, h: 4 }, table: 'the-bar-pools', rate: 0.08, note: 'the road beside the tide pools' },
    { area: { x: 35, y: 8, w: 6, h: 3 }, table: 'the-bar-pools', rate: 0.08, note: 'the road beside the tide pools' },
    { area: { x: 44, y: 11, w: 6, h: 3 }, table: 'the-bar-pools', rate: 0.08, note: 'the road beside the tide pools' },
  ],
  regions: {
    'bar-head-shoal': { x: 0, y: 9, w: 5, h: 7 },
    'the-long-road': { x: 3, y: 5, w: 51, h: 14 },
    'lantern-stack-spur': { x: 28, y: 2, w: 4, h: 9 },
    'lantern-stack': { x: 23, y: 0, w: 13, h: 5 },
    'shardcrown': { x: 51, y: 3, w: 13, h: 18 },
    'hollis-gate': { x: 56, y: 6, w: 7, h: 8 },
    'wreck-ribs': { x: 3, y: 4, w: 50, h: 14 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'bar-wreck-ribs': { x: 9, y: 13, facing: 'up', trainer: 'bar-corwen', tide: 'low' },
    'bar-tide-pools': { x: 17, y: 7, facing: 'down', trainer: 'bar-tilda', tide: 'low' },
    'bar-ration-cairn': { x: 26, y: 15, facing: 'up', trainer: 'bar-ezra', tide: 'low' },
    'bar-pilgrim-step': { x: 38, y: 8, facing: 'down', trainer: 'bar-ottilie', tide: 'low' },
    'bar-channel-marker': { x: 47, y: 14, facing: 'up', trainer: 'bar-hamish', tide: 'low' },
    'bar-last-dry-stone': { x: 53, y: 12, facing: 'left', trainer: 'bar-delphine', tide: 'low' },
    'bar-shardcrown-gate': { x: 59, y: 13, facing: 'down', trainer: 'linnet-gate', tide: 'low' },
    'bar-halfway-post': { x: 31, y: 11, facing: 'left', trainer: 'wick-long-road', tide: 'low' },
    // arrivals and the gate
    'from-pellwick': { x: 1, y: 12, facing: 'right' },
    'bar-head-shoal': { x: 2, y: 11, facing: 'right' },
    'hollis-gate-door': { x: 59, y: 10, facing: 'up', tide: 'low' },
    'hollis-gate-step': { x: 59, y: 11, facing: 'down', tide: 'low', note: 'where hollis-gate\'s door lets you out (its toMarker)' },
    'hollis-gate': { x: 59, y: 12, facing: 'up', npc: 'hollis', tide: 'low', note: 'Hollis opens the gate at six badges (script summit-gate)' },
    'lantern-stack-door': { x: 29, y: 1, facing: 'up', tide: 'low' },
    'lantern-stack-step': { x: 29, y: 2, facing: 'down', tide: 'low', note: 'where lantern-stack\'s door lets you out (its toMarker)' },
    // the Long Road: six trainers on the sandbanks, Wick halfway (TRAINER_IDS)
    'trainer-bar-corwen': { x: 9, y: 13, facing: 'up', trainer: 'bar-corwen', tide: 'low', note: 'Wreck Diver, by the first hulls' },
    'trainer-bar-tilda': { x: 17, y: 7, facing: 'down', trainer: 'bar-tilda', tide: 'low', note: 'Tide-pool Warden' },
    'trainer-bar-ezra': { x: 26, y: 15, facing: 'up', trainer: 'bar-ezra', tide: 'low', note: 'Ex-Mooring Quartermaster' },
    'trainer-wick-long-road': { x: 31, y: 11, facing: 'left', trainer: 'wick-long-road', tide: 'low', note: 'Wick halfway, at the spur foot' },
    'wick-long-road': { x: 31, y: 11, facing: 'left', npc: 'wick', tide: 'low' },
    'trainer-bar-ottilie': { x: 38, y: 8, facing: 'down', trainer: 'bar-ottilie', tide: 'low', note: 'Brazier Pilgrim' },
    'trainer-bar-hamish': { x: 47, y: 14, facing: 'up', trainer: 'bar-hamish', tide: 'low', note: 'Bar Pilot' },
    'trainer-bar-delphine': { x: 53, y: 12, facing: 'left', trainer: 'bar-delphine', tide: 'low', note: 'Readers\' Fund Scholar, on Shardcrown\'s shore' },
    'trainer-linnet-gate': { x: 59, y: 13, facing: 'down', trainer: 'linnet-gate', tide: 'low', note: 'Linnet at the Shardcrown gate after badge 6' },
    'linnet-gate': { x: 59, y: 13, facing: 'down', npc: 'linnet', tide: 'low' },
    // Two plans, one night; the crossing on the Relighting night
    'spur-foot': { x: 29, y: 10, facing: 'up', tide: 'low' },
    'engine-stack-foot': { x: 28, y: 3, facing: 'up', tide: 'low', note: 'Merrow\'s Engine outside the stack (script merrow-engine-before)' },
    'charges-linnet': { x: 26, y: 2, facing: 'up', npc: 'linnet', tide: 'low', note: 'Linnet and Wick pull Varga\'s charges (script charges-pulled)' },
    'charges-wick': { x: 32, y: 2, facing: 'up', npc: 'wick', tide: 'low' },
    'crossing-start': { x: 2, y: 12, facing: 'right', note: 'the sea draws back (script the-crossing)' },
    'crossing-corin': { x: 2, y: 13, facing: 'right', npc: 'corin' },
    'crossing-wick': { x: 3, y: 13, facing: 'right', npc: 'wick' },
    'crossing-linnet': { x: 2, y: 11, facing: 'right', npc: 'linnet' },
    'crossing-merrow': { x: 1, y: 10, facing: 'right', npc: 'merrow' },
    'crossing-varga': { x: 1, y: 14, facing: 'right', npc: 'varga' },
    'crossing-idris': { x: 2, y: 10, facing: 'right', npc: 'idris' },
    'crossing-stack-foot': { x: 30, y: 3, facing: 'up', tide: 'low' },
  },
  reaches: [],
  bugSpots: [],
  music: null,
  light: { indoor: false, ambient: 'open-sea' },
  entry: { x: 1, y: 12, facing: 'right' },
};

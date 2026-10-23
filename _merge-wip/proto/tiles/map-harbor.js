/**
 * @file Hand-authored 40x24 sample harbor map: the point with the lighthouse and the
 * Keeper's cottage (west), the quay and pier (centre), the river mouth with stepping
 * stones, the tidal flats and causeway (east), and the green with houses to the south.
 * Legend in render.js `resolveGround`.
 */
//            1111111111222222222233333333334
//  0123456789012345678901234567890123456789
export const HARBOR = {
  w: 40,
  h: 24,
  ground: [
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 0
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 1
    'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 2
    'DDSSSSSSSSDDDDDDDDDDDDDDDDDSSSSSSSSSSSDD', // 3
    'DSCCCCCCCCSDDDDkDDDDDDDDDDSUUUUUUUUUUUSD', // 4
    'DSCCCCCCCCSDDDDKDDDDDDDDDDSUMMMMMMMMMUSD', // 5
    'DSCCCCCCCCSSDDDKDDDSSSSSSSSMMMQMMMMMMMSD', // 6
    'DSCCCCCCCCSSSSSKSSSSSSSRRRSMMMMMMMQMMEEE', // 7
    'DSCCCCCCCCSWAOOOOOOOOOORRRAMMMMMMMMMMMSD', // 8
    'DSCCCCCCCCSWAOOOOOOOOOORRRAWWWWWWWWWWWSD', // 9
    'DSCCCCCCCCSAAOOOOOOOOOOBBBAAAAAAAAAAAASS', // 10
    'DSFFFFYFFFSAGGOOOOOOOOORRRGGGGGGGGGGGGSS', // 11
    'SAAAAAPAAAAGZGGOOOOOGGGRRRGGGGGGGGGGGGGS', // 12
    'GGGGGGPGGGGGGGGGGGGGGGGRRRGGGGGGGTTTTGGG', // 13
    'GGGGGGPPPPPPPPPPPGGGGGGRRRGGGGGGGTTTTGGG', // 14
    'GGGGGGGGGGGGGGGPGGGGGGZRRRGGGGGGGTTTGGzz', // 15
    'GGGGGGGGGGGGGGGPGGGGGGGRRRGGGGGGGGGGGGzz', // 16
    'GGGGGGGGGGGGGGGPGGGGGGGRRRGGGGGGGGGGGGGG', // 17
    'GGGGGGGGGGGGGGGPPPPPPPPBBBPPPPGGGGGGGGGG', // 18
    'GZZGTTTGGGGGGGGGGGGGGGGRRRGGGGGGGGGGGGGG', // 19
    'GZZGTTTTGGGGGGGGGGGGGGGRRRGGLLLLLLLGGGGG', // 20
    'GGGGGTTTGGGGGGGGGGGGGGGRRRGGGTTTTTGGGGGG', // 21
    'GGGGGGGGGGGGGGGGGGGGGGRRRRGGGTTTTTTGGGGG', // 22
    'GGGGGGGGGGGGGGGGGGGGGGRRRRGGGGTTTTGGGGGG', // 23
  ],
  props: [
    // the point
    { type: 'lighthouse', x: 3, y: 8 },
    { type: 'house', x: 6, y: 9, w: 3, roof: 'dark', material: 'timber', door: 0 },
    { type: 'lamp', x: 7, y: 10 },
    { type: 'skyglass', x: 9, y: 5 },
    { type: 'rock', x: 8, y: 12, kind: 'b' },
    // the quay
    { type: 'waystone', x: 17, y: 8 },
    { type: 'boat', x: 16, y: 6 },
    { type: 'lamp', x: 14, y: 10 },
    { type: 'lamp', x: 21, y: 10 },
    { type: 'rock', x: 11, y: 10 },
    // flats
    { type: 'rock', x: 29, y: 6 },
    { type: 'rock', x: 35, y: 5, kind: 'b' },
    { type: 'rock', x: 33, y: 8 },
    { type: 'rock', x: 31, y: 8, kind: 'b' },
    // the green: houses (anchor = lower wall row)
    { type: 'house', x: 1, y: 17, w: 3, roof: 'slate', material: 'timber' },
    { type: 'lamp', x: 3, y: 18 },
    { type: 'house', x: 9, y: 18, w: 3, roof: 'moss', material: 'brick' },
    { type: 'lamp', x: 11, y: 19 },
    { type: 'house', x: 17, y: 16, w: 4, roof: 'red', material: 'timber' },
    { type: 'lamp', x: 19, y: 17 },
    { type: 'house', x: 30, y: 17, w: 3, roof: 'blue', material: 'timber' },
    { type: 'lamp', x: 33, y: 18 },
    { type: 'house', x: 35, y: 21, w: 3, roof: 'straw', material: 'brick' },
    { type: 'lamp', x: 37, y: 22 },
    // trees (anchor = bottom-left tile of the 2x2)
    { type: 'tree', kind: 'alder', x: 21, y: 13 },
    { type: 'tree', kind: 'alder', x: 26, y: 13 },
    { type: 'tree', kind: 'alder', x: 26, y: 21 },
    { type: 'tree', kind: 'alder', x: 21, y: 21 },
    { type: 'tree', kind: 'pine', x: 0, y: 22 },
    { type: 'tree', kind: 'pine', x: 2, y: 23 },
    { type: 'tree', kind: 'pine', x: 36, y: 13 },
    { type: 'tree', kind: 'pine', x: 38, y: 14 },
    { type: 'tree', kind: 'fruit', x: 5, y: 16 },
    { type: 'tree', kind: 'fruit', x: 13, y: 16 },
    { type: 'tree', kind: 'fruit', x: 13, y: 21 },
    { type: 'tree', kind: 'fruit', x: 18, y: 21, fruit: false },
    // bushes, fences, flowers already in ground
    { type: 'bush', x: 14, y: 12 },
    { type: 'bush', x: 27, y: 15 },
    { type: 'bush', x: 36, y: 19 },
    { type: 'bush', x: 1, y: 13 },
    { type: 'bush', x: 24, y: 15 },
    { type: 'fence', x: 28, y: 12, len: 5 },
    { type: 'fence', x: 16, y: 19, len: 3 },
    { type: 'fence', x: 4, y: 13, len: 2 },
    { type: 'skyglass', x: 31, y: 22 },
  ],
};

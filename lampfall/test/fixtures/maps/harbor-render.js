/**
 * Render fixture: the prototype harbor (`proto/tiles/map-harbor.js`, 40x24) converted to the
 * `world/tilemap` MapDef format with `data/tilesets.DEFAULT_LEGEND` characters, widened to 48x32 so
 * the camera streams chunks: the mainland shore and the causeway's landing to the east, and a
 * southern street (river bridge, post office, a house, the meadow, the orchard) below.
 *
 * Proto -> legend: D S R A W M stay; U -> M; B -> z (river stones); E causeway; Q -> ~ (tide pool);
 * G g T stay; Z/z -> * & (flowers); C (cliff top) -> G; F -> C (cliff face); Y -> H (steps);
 * L -> h (ledge); P O K stay (k -> K, the pier autotile finds its end); the quay's front row -> Q.
 * Houses are painted as tiles (roof block autotiles to ridge / eave / ends), trees and lamps sit in
 * the detail layer, the lighthouse, boat, chimneys and street furniture are props.
 *
 * Exports `HARBOR_RENDER` (the MapDef), `EXTRA_TILES` (fixture-only tile defs merged over
 * `data/tilesets.TILES`: the timber cross wall, a dormer, the porch lamp, a bare fruit tree) and
 * `ROUTE` / `NPC_ROUTES` (waypoints for the scripted walkers on test/pages/render.html).
 * @module test/fixtures/maps/harbor-render
 */

const W = 48;
const H = 32;

// --- prototype ground (40x24), converted -----------------------------------------------------------
//            1111111111222222222233333333334
//  0123456789012345678901234567890123456789
const PROTO = [
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 0
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 1
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD', // 2
  'DDSSSSSSSSDDDDDDDDDDDDDDDDDSSSSSSSSSSSDD', // 3
  'DSGGGGGGGGSDDDDKDDDDDDDDDDSMMMMMMMMMMMSD', // 4
  'DSGGGGGGGGSDDDDKDDDDDDDDDDSMMMMMMMMMMMSD', // 5
  'DSGGGGGGGGSSDDDKDDDSSSSSSSSMMM~MMMMMMMSD', // 6
  'DSGGGGGGGGSSSSSKSSSSSSSRRRSMMMMMMM~MMEEE', // 7
  'DSGGGGGGGGSWAQQQQQQQQQQRRRAMMMMMMMMMMMSD', // 8
  'DSGGGGGGGGSWAOOOOOOOOOORRRAWWWWWWWWWWWSD', // 9
  'DSGGGGGGGGSAAOOOOOOOOOOzzzAAAAAAAAAAAASS', // 10
  'DSCCCCHCCCSAGGOOOOOOOOORRRGGGGGGGGGGGGSS', // 11
  'SAAAAAPAAAAG*GGOOOOOGGGRRRGGGGGGGGGGGGGS', // 12
  'GGGGGGPGGGGGGGGGGGGGGGGRRRGGGGGGGTTTTGGG', // 13
  'GGGGGGPPPPPPPPPPPGGGGGGRRRGGGGGGGTTTTGGG', // 14
  'GGGGGGGGGGGGGGGPGGGGGG*RRRGGGGGGGTTTGG&&', // 15
  'GGGGGGGGGGGGGGGPGGGGGGGRRRGGGGGGGGGGGG&&', // 16
  'GGGGGGGGGGGGGGGPGGGGGGGRRRGGGGGGGGGGGGGG', // 17
  'GGGGGGGGGGGGGGGPPPPPPPPzzzPPPPGGGGGGGGGG', // 18
  'G**GTTTGGGGGGGGPGGGGGGGRRRGGGGGGGGGGGGGG', // 19
  'G**GTTTTGGGGGGGPGGGGGGGRRRGGhhhhhhhGGGGG', // 20
  'GGGGGTTTGGGGGGGPGGGGGGGRRRGGGTTTTTGGGGGG', // 21
  'GGGGGGGGGGGGGGGPGGGGGGRRRRGGGTTTTTTGGGGG', // 22
  'GGGGGGGGGGGGGGGPGGGGGGRRRRGGGGTTTTGGGGGG', // 23
];

// --- the mainland shore and orchard to the east (cols 40-47) ------------------------------------------
const EAST = [
  'DDDDDDDD', // 0
  'DDDDDDDD', // 1
  'DDDDDDDD', // 2
  'DDDDDDSA', // 3
  'DDDSSSAG', // 4
  'DDSSSWAG', // 5
  'DSSSWWAG', // 6
  'EEEEEAAG', // 7  the causeway lands on the mainland sand
  'DSSSWWAG', // 8
  'DDSSSWAG', // 9
  'SSSSSWAG', // 10
  'SSSSWAAG', // 11
  'SSWAAAGG', // 12
  'AAAAGGGG', // 13
  'GGGGGGGG', // 14
  'GGGGGGGG', // 15
  'GGGGGGGG', // 16
  'GGGGGGGG', // 17
  'GGPPPPPP', // 18
  'GGPGGGGG', // 19
  'GGPGGGGG', // 20
  'GGPGGgGG', // 21
  'GGPGGGGG', // 22
  'GGPGGGGG', // 23
];

// --- the southern street (rows 24-31, all 48 cols) ------------------------------------------------------
//            111111111122222222223333333333444444444
//  0123456789012345678901234567890123456789012345678
const SOUTH = [
  'GGGGGGGGGGGGGGGPGGGGGGRRRRGGGGGGGGGGGGGGGGPGGGGG', // 24
  'GGGG*GGGGGGGGGGPGGGGGGRRRRGGGGGGGGGGG&GGGGPGGGGG', // 25
  'GGGGGGGGGGGGGGGPGGGGGGRRRRGGGGGGGGGGGGGGGGPGGGGG', // 26
  'GGGPPPPPPPPPPPPPPPPPPPBBBBPPPPPPPPPPPPPPPPPPPPPG', // 27
  'TTTTTGGGGG*GGGGGGGGGrrRRRRrGGGGGGGGGgGGGGGGGGGGG', // 28
  'TTTTTTGG&&GGGGGGGGGrrRRRRrrGGGGGGGGGGGGGGGGGGGGG', // 29
  'TTTTTTTGGGGGGGgGGGGrRRRRRRrGGGGGGGGGGGGGGGGGGGGG', // 30
  'TTTTTTTGGGGGGGGGGGGrRRRRRRrrGGGGGGGGGGGGGGGGGGGG', // 31
];

/** Same hash as the tile prototype (glow patches on the flats). */
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const grid = (rows) => rows.map((r) => r.split(''));
const ground = grid([...PROTO.map((r, y) => r + EAST[y]), ...SOUTH]);
const detail = grid(Array.from({ length: H }, () => '.'.repeat(W)));
const overlay = grid(Array.from({ length: H }, () => '.'.repeat(W)));

// bioluminescent patches on the flats: 2x2-tile clusters with a few strays (the prototype's rule)
for (let y = 4; y <= 9; y++) {
  for (let x = 27; x <= 37; x++) {
    if (ground[y][x] !== 'M') continue;
    if (hash2(x >> 1, y >> 1) % 4 === 0 || hash2(x, y) % 13 === 0) ground[y][x] = 'Y';
  }
}
// the path south from the green to the street, and from the east orchard
for (let y = 19; y <= 26; y++) ground[y][15] = 'P';

/** Paints rows of chars into a layer at (x, y). '.' leaves a cell alone. */
function stamp(layer, x, y, rows) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') layer[y + j][x + i] = ch; }));
}

// --- houses (rows: ridge, eave, upper wall, lower wall; anchor = lower wall row) ----------------------
// the Keeper's Cottage on the point (roof colour from the player: 'U' = roof-keeper), porch door
stamp(ground, 6, 6, ['UUU', 'UUU', '%x%', 'u#%']);
stamp(ground, 1, 14, ['^^^', '^^^', '%x%', '#+%']); // slate timber
stamp(ground, 9, 15, ['222', '222', '[w[', 'w![']); // moss brick
stamp(ground, 17, 13, ['1I11', '1111', '%#x%', '#+#%']); // red timber with a dormer
stamp(ground, 30, 14, ['333', '333', '%x%', '%+#']); // blue timber
stamp(ground, 35, 18, ['444', '444', '[w[', 'w![']); // thatch brick
stamp(ground, 42, 14, ['6666', '6666', '{$${', '$u${']); // teal shiplap, porch door
stamp(ground, 8, 23, ['7777', '7777', ']ss]', 's@s]']); // ochre stone
stamp(ground, 28, 23, ['^^^^^', '^^^^^', '[w[w[', 'ww!w[']); // the post office: slate brick

// --- detail: trees, lamps, porch lamps, rocks, fences, quay clutter ----------------------------------
const put = (layer, ch, ...xy) => { for (let k = 0; k < xy.length; k += 2) layer[xy[k + 1]][xy[k]] = ch; };
put(detail, '9', 21, 13, 26, 13, 26, 21, 21, 21, 45, 24); // alders
put(detail, 'F', 4, 21); // blossom
put(detail, '8', 0, 22, 2, 23, 36, 13, 38, 14, 46, 13, 1, 26, 5, 31); // pines
put(detail, "'", 5, 16, 13, 16, 13, 21, 36, 30, 39, 29, 42, 31, 45, 30, 33, 25); // fruit trees
put(detail, '?', 18, 21); // a bare fruit tree
put(detail, 'v', 14, 12, 27, 15, 39, 20, 1, 13, 27, 18, 12, 26, 40, 24); // bushes
put(detail, 'L', 7, 10, 14, 10, 21, 10, 3, 18, 11, 19, 19, 17, 33, 18, 37, 22, 44, 18, 16, 28, 33, 28, 46, 9); // lamp posts
put(detail, '`', 7, 9, 1, 17, 19, 16, 32, 17, 44, 17, 10, 26); // porch lamps beside the doors
put(detail, 'o', 11, 10, 29, 6, 33, 8, 47, 12); // rocks
put(detail, ';', 8, 12, 35, 5, 31, 8); // rock-b
put(detail, '-', 9, 5, 2, 25); // skyglass nodes
put(detail, '>', 17, 9); // the Waystone (16x32, y-sorted)
put(detail, ')', 13, 8, 19, 8, 22, 8); // mooring posts on the quay edge
put(detail, 'c', 20, 9); put(detail, '(', 21, 9); put(detail, 'J', 14, 9); put(detail, 'j', 13, 11); // crates, barrel, creel, net rack
for (let x = 28; x <= 32; x++) detail[12][x] = '|';
for (let x = 16; x <= 18; x++) detail[19][x] = '|';
for (let x = 4; x <= 5; x++) detail[13][x] = '|';
for (let x = 36; x <= 46; x++) if (x !== 42) detail[26][x] = '|'; // the orchard fence
detail[26][42] = '/';

// --- overlay: string lights strung over the quay ---------------------------------------------------------
put(overlay, 'd', 16, 10, 17, 10, 18, 10);

/** Fixture-only tile definitions (merged over data/tilesets.TILES by the caller). */
export const EXTRA_TILES = Object.freeze({
  'wall-timber-x': Object.freeze({ id: 'wall-timber-x', art: 'wall-timber-x', solid: true, water: false, tide: null, verb: null, sfx: null, anim: 0, glow: false }),
  'roof-red-dormer': Object.freeze({ id: 'roof-red-dormer', art: 'roof-red-dormer', solid: true, water: false, tide: null, verb: null, sfx: null, anim: 0, litArt: 'roof-red-dormer-lit', glow: Object.freeze({ kind: 'window', color: '#F9C46B', radius: 18, when: 'night' }) }),
  'porch-lamp': Object.freeze({ id: 'porch-lamp', art: 'porch-lamp', solid: false, water: false, tide: null, verb: null, sfx: null, anim: 0, glow: Object.freeze({ kind: 'porch', color: '#F9C46B', radius: 34, when: 'night', oy: 4 }) }),
  'tree-fruit-bare': Object.freeze({ id: 'tree-fruit-bare', art: 'tree-fruit-bare', solid: true, water: false, tide: null, verb: 'shake', sfx: null, anim: 0, glow: false }),
});

/** The fixture's own legend (merged over DEFAULT_LEGEND): chars this map does not otherwise use. */
const LEGEND = Object.freeze({
  x: 'wall-timber-x', I: 'roof-red-dormer', '`': 'porch-lamp', "'": 'tree-fruit', '?': 'tree-fruit-bare',
  '-': 'skyglass-node', '>': 'waystone', ';': 'rock-b', J: 'creel', j: 'net-rack', u: 'door-porch',
  U: 'roof-keeper', d: 'string-lights', F: 'blossom',
});

const rows = (g) => g.map((r) => r.join(''));

/** The fixture MapDef. */
export const HARBOR_RENDER = Object.freeze({
  id: 'harbor-render',
  name: 'Pellwick Harbor (render fixture)',
  kind: 'exterior',
  region: 'pellwick',
  w: W,
  h: H,
  legend: LEGEND,
  ground: Object.freeze(rows(ground)),
  detail: Object.freeze(rows(detail)),
  overlay: Object.freeze(rows(overlay)),
  props: Object.freeze([
    Object.freeze({ art: 'lighthouse', x: 3, y: 8 }),
    Object.freeze({ art: 'boat', x: 16, y: 6 }),
    Object.freeze({ art: 'punt', x: 18, y: 7 }),
    Object.freeze({ art: 'chimney', x: 8, y: 6 }),
    Object.freeze({ art: 'chimney', x: 3, y: 14 }),
    Object.freeze({ art: 'chimney-stone', x: 11, y: 15 }),
    Object.freeze({ art: 'chimney', x: 19, y: 13 }),
    Object.freeze({ art: 'chimney-tin', x: 32, y: 14 }),
    Object.freeze({ art: 'chimney', x: 37, y: 18 }),
    Object.freeze({ art: 'chimney-tin', x: 44, y: 14 }),
    Object.freeze({ art: 'chimney-stone', x: 10, y: 23 }),
    Object.freeze({ art: 'chimney', x: 31, y: 23 }),
    Object.freeze({ art: 'market-stall-red', x: 18, y: 12 }),
    Object.freeze({ art: 'commons-board', x: 28, y: 16 }),
    Object.freeze({ art: 'post-box', x: 27, y: 26 }),
    Object.freeze({ art: 'signpost', x: 21, y: 26 }),
    Object.freeze({ art: 'bench', x: 34, y: 26 }),
    Object.freeze({ art: 'tide-chalkboard', x: 16, y: 9 }),
  ]),
  entities: Object.freeze([]),
  triggers: Object.freeze([]),
  warps: Object.freeze([]),
  spawns: Object.freeze([]),
  regions: Object.freeze({}),
  entry: Object.freeze({ x: 12, y: 14, facing: 'down' }),
});

/** Scripted loop for the player walker (tiles; the page paths between them at the current tide). */
export const ROUTE = Object.freeze([
  [12, 14], [15, 17], [22, 18], [28, 18], [29, 22], [33, 27], [42, 27], [44, 19], [41, 22], [36, 24],
  [24, 27], [10, 27], [6, 21], [6, 13], [7, 11], [9, 10], [12, 11], [17, 11], [20, 12], [16, 14],
]);

/** Two NPC patrols: Wren on the quay, Corin on the green. */
export const NPC_ROUTES = Object.freeze({
  wren: Object.freeze([[14, 11], [21, 11], [21, 12], [16, 13]]),
  corin: Object.freeze([[18, 18], [26, 18], [27, 23], [20, 20]]),
});

export default HARBOR_RENDER;

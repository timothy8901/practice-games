/**
 * Flora: flowers, bushes, the trees (pine, alder, fruit, bare fruit) and the plants of the isles: reeds
 * (the reed edges are the only wild encounters in town), moor heather, gorse, hedges, glasswort,
 * seaweed, garden beans, mangroves, drowned snags, purse trees, bee trees and snow pines. [ART-TILES]
 *
 * Trees are 32×32 (2×2 tiles), anchored on the bottom-left tile; every tree has a trunk, a dark base line
 * and a dithered cast shadow bottom-right so it reads as blocking, never as tall grass. Encounter plants
 * (tall grass, reeds, heather) show ground between tufts and sway in 3 frames.
 *
 * Backlog fix: broadleaf sway now bends the crown (the top lobes move a pixel, the lower crown stays)
 * instead of shifting the whole crown against the trunk.
 * @module art/tiles/flora
 */

import { createGroup, canopy, rowsOf, texture } from './kit.js';
import { blank, blit } from '../spriteUtil.js';
import { GROUND_TILES } from './ground.js';

const { tiles, def } = createGroup('flora');
const ground = (id) => rowsOf(GROUND_TILES[id]);

/* ---------------------------------------------------------------- flowers */
def('flowers-a', { g: 'grass2', d: 'grass1', s: 'grass0', p: 'blossom', q: 'blossom2', y: 'yellow', w: 'petal' }, [
  'gggggggggggggggg',
  'ggpgggggggggyggg',
  'gpwpggggggggggdg',
  'ggpgggggggggqggg',
  'ggdggggggggqwqgg',
  'ggggggyggggggqgg',
  'ggggggggggggdggg',
  'gggggggggggggggg',
  'gggggqgggggggggg',
  'ggggqwqggggpgggg',
  'gggggqggggpwpggg',
  'gggggdggggggpggg',
  'gggggggggggggggg',
  'gyggggggggggyggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
]);
def('flowers-b', { g: 'grass2', d: 'grass1', o: 'marigold', y: 'yellow', w: 'petal' }, [
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggoggggggggggg',
  'gggoyogggggggggg',
  'ggggogggggwggggg',
  'ggggdgggggdggggg',
  'gggggggggggggggg',
  'ggggggggggggoggg',
  'ggwggggggggoyogg',
  'ggdgggggggggoggg',
  'ggggggggggggdggg',
  'ggggggoggggggggg',
  'gggggoyogggggggg',
  'ggggggoggggggggg',
  'ggggggdgggggwggg',
  'gggggggggggggggg',
]);

/* ---------------------------------------------------------------- encounter plants */
// Reeds (the reed edges): tall stems with cattail heads over wet ground, ground showing between the
// clumps; three sway frames lean the heads.
const REED = [
  'h.h..',
  'hmh.h',
  'm.mhm',
  'mom.m',
  'momom',
  'omomo',
  '.ooo.',
];
const reedLean = (dx) => REED.map((r, i) => (i < 3 && dx ? (dx > 0 ? '.' + r.slice(0, -1) : r.slice(1) + '.') : r));
const REEDP = { m: 'wmud1', d: 'wmud0', l: 'wmud2', r: 'skyref', b: 'skyref2', o: 'reed0', g: 'reed1', h: 'wd1', q: 'reed2' };
const reedFrame = (dx) => {
  let r = ground('mud-wet');
  for (const [x, y] of [[1, 1], [8, 0], [11, 7], [3, 8]]) r = blit(r, reedLean(dx).map((s) => s.replace(/m/g, 'g')), x, y);
  return blit(r, ['q', 'q'], 7, 12);
};
def('reeds', REEDP, [reedFrame(0), reedFrame(1), reedFrame(-1)], { fps: 4 });
// Reed edge: a fringe of reeds standing in the shallows along a bank (drawn on water). N edge = bank north.
const reedEdge = (dx) => {
  let r = blank(16, 16);
  for (const [x, y] of [[0, 0], [5, 1], [10, 0], [13, 2]]) r = blit(r, reedLean(dx).slice(0, 6).map((s) => s.replace(/m/g, 'g')), x, y);
  return r;
};
def('reed-edge', { o: 'reed0', g: 'reed1', h: 'wd1' }, [reedEdge(0), reedEdge(1), reedEdge(-1)], { kind: 'edge', fps: 4 });
// Heather (moor encounter tile): low mauve-purple domes on moor turf, turf between; sway 3 frames.
const HEATH = ['.hph.', 'hpqph', 'pqpqp', 'oppqo', '.ooo.'];
const heathLean = (dx) => HEATH.map((r, i) => (i < 2 && dx ? (dx > 0 ? '.' + r.slice(0, -1) : r.slice(1) + '.') : r));
const HEP = { g: 'moor1', d: 'moor0', l: 'moor2', h: 'moor3', o: 'he0', p: 'he1', q: 'he2', y: 'he3' };
const heathFrame = (dx) => {
  let r = ground('moor-turf');
  for (const [x, y] of [[1, 2], [9, 1], [5, 9], [11, 10]]) r = blit(r, heathLean(dx), x, y);
  return blit(blit(r, ['y'], 3, 3), ['y'], 11, 2);
};
def('heather', HEP, [heathFrame(0), heathFrame(1), heathFrame(-1)], { fps: 4 });

/* ---------------------------------------------------------------- shrubs */
// Bush: blocking, with a base line and a cast shadow bottom-right; canopy lighter than the turf.
const BUSH_LOBES = [{ cx: 5.5, cy: 8, r: 4.6 }, { cx: 10, cy: 7, r: 4.6 }, { cx: 8, cy: 9.6, r: 4.6 }];
const BUSH_BASE = [
  '..............s.',
  '.............ss.',
  '.....xxxxxxxssss',
  '........ssssss..',
];
const bushRows = (lobes) => blit(blit(blank(16, 16), BUSH_BASE, 0, 12), canopy(16, 16, lobes, { out: 'k', deep: 'n', l: 'l', b: 'b', d: 'd' }), 0, 0);
def('bush', { k: 'grass0', n: 'pine0', d: 'grass1', b: 'grass3', l: 'grass4', s: 'shadow', x: 'base' }, bushRows(BUSH_LOBES), { kind: 'detail' });
// Gorse (moor, coast): a darker spiny bush starred with yellow blossom.
const GORSE = bushRows([{ cx: 6, cy: 8.5, r: 4.8 }, { cx: 10.5, cy: 8, r: 4.4 }]);
const GORSE_FLOWERS = [[5, 5], [9, 4], [11, 8], [4, 9], [8, 9], [12, 6], [7, 7]];
def('gorse', { k: 'moor0', n: 'pinek', d: 'moor1', b: 'moor2', l: 'moor3', s: 'shadow', x: 'base', y: 'yellow', o: 'straw2' },
  GORSE_FLOWERS.reduce((r, [x, y], i) => (r[y][x] !== '.' ? blit(r, [i % 3 ? 'y' : 'o'], x, y) : r), GORSE), { kind: 'detail' });
// Hedge: a clipped box hedge segment (gardens, the green); blocking, tiles east-west.
const HEDGE = [
  '................',
  '................',
  'kkkkkkkkkkkkkkkk',
  'llblllbllllblllb',
  'lbbblbbbllbbbllb',
  'bbbbbbbbbbbbbbbb',
  'bbdbbbbbdbbbbbdb',
  'bbbbbdbbbbbdbbbb',
  'dbbbbbbbbbbbbbbd',
  'bdbbbdbbbdbbbbdb',
  'ddbdddbddddbdddd',
  'dddddddddddddddd',
  'nnnnnnnnnnnnnnnn',
  'xxxxxxxxxxxxxxxx',
  'ssssssssssssssss',
  '.s.s.s.s.s.s.s.s',
];
def('hedge', { k: 'grass0', n: 'pine0', d: 'grass1', b: 'grass2', l: 'grass3', s: 'shadow', x: 'base' }, HEDGE, { kind: 'detail' });

/* ---------------------------------------------------------------- small plants */
// Glasswort (the flats in autumn; the crimson signature #A3283A): jointed succulent stems on wet mud.
const GW = ['.q.', 'qrq', '.r.', 'rkr'];
def('glasswort', { k: 'glass0', r: 'glass1', q: 'glass2' }, texture('.', [
  [GW, 2, 3], [GW, 9, 1], [['q', 'r', 'k'], 13, 6], [GW, 6, 9], [['.q', 'rr', 'kr'], 11, 11], [['q', 'k'], 3, 12],
]), { kind: 'detail' });
// Seaweed: bladderwrack draped over rocks and wet sand at the tide line.
const WRACK = ['.ol.', 'oddo', 'd.do'];
def('seaweed', { o: 'reed0', d: 'mgl0', l: 'reed1' }, texture('.', [
  [WRACK, 1, 2], [WRACK, 9, 4], [['ol', 'dd'], 5, 9], [WRACK, 11, 11], [['o', 'd'], 2, 13],
]), { kind: 'detail' });
// Bean rows (Bryony's garden): stakes with climbing runner beans and red flowers, on soil.
const BEAN = ['.l.', 'gkg', 'gkf', 'gkg', 'ekg', 'gke', '.k.'];
def('bean-rows', { k: 'wd1', l: 'wd3', g: 'grass2', e: 'grass1', f: 'red2', s: 'shadow' }, [0, 5, 10].reduce((r, x) => blit(blit(r, BEAN, x + 1, 2), BEAN, x + 2, 8), blank(16, 16)), { kind: 'detail' });
// Wildflowers on moor turf (thistles: the moor's name): purple-headed thistles with silver leaves.
const THISTLE = ['.q.', 'pqp', '.g.', 'vgv', '.g.'];
def('thistles', { p: 'he1', q: 'he2', g: 'moor1', v: 'st3' }, texture('.', [[THISTLE, 2, 2], [THISTLE, 10, 6], [THISTLE, 5, 10]]), { kind: 'detail' });

/* ---------------------------------------------------------------- trees */
// Pine: four stacked tiers, each a cone lit from the top-left with a sawtoothed drooping skirt and a deep
// shadow band where the tier above overhangs it. Sway bends the tree: the top tier moves a pixel.
const PINE_TIERS = [
  { t: 0, b: 8, w: 4 }, { t: 4, b: 13, w: 7 }, { t: 8, b: 18, w: 10 }, { t: 12, b: 24, w: 13 },
];
function pineCrown(sway) {
  const g = blank(32, 32).map((r) => r.split(''));
  const cx = 15.5;
  for (let i = PINE_TIERS.length - 1; i >= 0; i--) {
    const T = PINE_TIERS[i];
    const dx = i === 0 ? sway : i === 1 && sway ? sway * 0.5 : 0;
    const ox = cx + Math.round(dx);
    const halfAt = (y) => 0.6 + ((y - T.t) / (T.b - T.t)) * T.w;
    const inT = (x, y) => {
      if (y < T.t || y > T.b || Math.abs(x + 0.5 - ox) > halfAt(y)) return false;
      return y < T.b || (x + i) % 3 !== 0;
    };
    for (let y = T.t; y <= T.b; y++) {
      for (let x = 0; x < 32; x++) {
        if (!inT(x, y)) continue;
        const u = (x + 0.5 - ox) / Math.max(1, halfAt(y));
        const edgeL = !inT(x - 1, y) && y < T.b, edgeR = !inT(x + 1, y) && y < T.b, edgeB = !inT(x, y + 1);
        let c;
        if (edgeB) c = u < -0.4 ? 'd' : 'n';
        else if (edgeL) c = 'k';
        else if (edgeR) c = 'n';
        else {
          const checker = ((x + y) & 1) === 0;
          c = u < -0.45 || (u < -0.3 && checker) ? 'l' : u < 0.25 || (u < 0.4 && checker) ? 'b' : 'd';
          if (y === T.b - 1 && c === 'b') c = 'd';
          if (c === 'l' && (x * 5 + y * 3) % 7 === 0) c = 'h';
          else if (c === 'b' && (x * 3 + y * 7) % 9 === 0) c = u < 0 ? 'l' : 'd';
        }
        g[y][x] = c;
      }
    }
  }
  return g.map((r) => r.join(''));
}
const PINE_TRUNK = [
  '..............vutt..............',
  '..............vutt......s.......',
  '.............vvuttt...sssss.....',
  '............xxxxxxxxxsssssss....',
  '.........sssssssssssssssssssss..',
  '...........sssssssssssssssssss..',
  '..............ssssssssssss......',
];
const PINEPAL = { n: 'pinek', k: 'pine0', d: 'pine1', b: 'pine2', l: 'pine3', h: 'pine4', t: 'wd0', u: 'wd1', v: 'wd2', s: 'shadow', x: 'base' };
const PINE_FRAMES = [0, 1, 0, -1].map((sw) => blit(blit(blank(32, 32), PINE_TRUNK, 0, 25), pineCrown(sw), 0, 0));
def('tree-pine', PINEPAL, PINE_FRAMES, { w: 32, h: 32, kind: 'object', fps: 3 });
// Snow pine (Rimeholt): the same tree with snow caught on each tier's lit shoulders.
const snowOn = (rows) => rows.map((r, y) => r.split('').map((c, x) => {
  if (c === '.' || y >= 25 || c === 't' || c === 'u' || c === 'v' || c === 's' || c === 'x') return c;
  const up = rows[y - 1] ? rows[y - 1][x] : '.';
  const up2 = rows[y - 2] ? rows[y - 2][x] : '.';
  // snow lies on each tier's upper surface: where the pixel above is sky or the dark overhang band
  if (up === '.' || up === 'n') return x < 21 ? 'w' : 'h';
  if ((up2 === '.' || up2 === 'n') && x < 18 && (x + y) % 2 === 0) return 'h';
  return c;
}).join(''));
def('tree-pine-snow', { ...PINEPAL, w: 'snow3', h: 'snow2' }, PINE_FRAMES.map(snowOn), { w: 32, h: 32, kind: 'object', fps: 3 });

// Broadleaf trees: procedural clustered canopies over a hand-drawn trunk, base line and dithered cast
// shadow. Four sway frames bend the crown: rows above `bendRow` move a pixel, the rest stays.
const TRUNK_ROWS = [
  '...............vut..............',
  '...............vut..............',
  '...............vut..............',
  '...............vut..............',
  '...............vuut.............',
  '...............vuut.....s.......',
  '..............vvuutt..ssss......',
  '.............xxxxxxxxsssssss....',
  '..........sssssssssssssssssss...',
  '............ssssssssssssssss....',
  '...............ssssssssss.......',
];
const SWAY = [0, 1, 0, -1];
function bend(crown, dx, bendRow = 11) {
  if (!dx) return crown;
  return crown.map((r, y) => {
    if (y >= bendRow) return r;
    return dx > 0 ? '.' + r.slice(0, -1) : r.slice(1) + '.';
  });
}
function treeFrames(lobes, chars, decorate = (rows) => rows, trunk = TRUNK_ROWS) {
  const crown = decorate(canopy(32, 24, lobes, chars));
  return SWAY.map((dx) => blit(blit(blank(32, 32), trunk, 0, 21), bend(crown, dx), 0, 0));
}
const CH = { out: 'k', deep: 'n', l: 'l', b: 'b', d: 'd' };
const ALDER_LOBES = [
  { cx: 15.5, cy: 8, r: 7.5 }, { cx: 9, cy: 13, r: 7 }, { cx: 22, cy: 13, r: 7 }, { cx: 15.5, cy: 16, r: 6.5 },
];
const ALDERPAL = { k: 'ald0', n: 'pine1', d: 'ald1', b: 'ald2', l: 'ald3', t: 'aldbark0', u: 'aldbark1', v: 'aldbark2', s: 'shadow', x: 'base' };
def('tree-alder', ALDERPAL, treeFrames(ALDER_LOBES, CH), { w: 32, h: 32, kind: 'object', fps: 3 });
// Second crown layout: lopsided, taller on the west, a low lobe hanging east, so groves vary.
const ALDER_LOBES_B = [
  { cx: 12.5, cy: 7, r: 6.5 }, { cx: 20.5, cy: 9.5, r: 6.5 }, { cx: 8.5, cy: 15, r: 6 }, { cx: 17, cy: 15.5, r: 7.5 }, { cx: 24.5, cy: 16, r: 4.5 },
];
def('tree-alder-b', ALDERPAL, treeFrames(ALDER_LOBES_B, CH), { w: 32, h: 32, kind: 'object', fps: 3 });
// Fruit trees: pears hang only where they sit fully inside the crown (never on the outline).
const FRUIT_LOBES = [
  { cx: 15.5, cy: 7.5, r: 7 }, { cx: 9, cy: 12.5, r: 7.5 }, { cx: 22, cy: 12.5, r: 7.5 }, { cx: 15.5, cy: 15, r: 7 },
];
const PEAR = ['gf', 'ff', 'ee'];
const PEAR_SPOTS = [[8, 8], [19, 5], [13, 13], [23, 13], [9, 16], [17, 18], [21, 9], [6, 12]];
const hangOn = (glyph, spots) => (rows) => spots.reduce((r, [x, y]) => {
  const solid = (xx, yy) => rows[yy] && rows[yy][xx] && rows[yy][xx] !== '.' && rows[yy][xx] !== 'k' && rows[yy][xx] !== 'n';
  return solid(x, y) && solid(x + 1, y + 2) && solid(x - 1, y + 1) && solid(x + 2, y + 1) ? blit(r, glyph, x, y) : r;
}, rows);
const FRUITPAL = { k: 'fr0', n: 'pine0', d: 'fr1', b: 'fr2', l: 'fr3', t: 'wd0', u: 'wd1', v: 'wd2', s: 'shadow', x: 'base', f: 'pear', g: 'pear2', e: 'pear0' };
def('tree-fruit', FRUITPAL, treeFrames(FRUIT_LOBES, CH, hangOn(PEAR, PEAR_SPOTS)), { w: 32, h: 32, kind: 'object', fps: 3 });
def('tree-fruit-bare', { ...FRUITPAL, f: 'fr2', g: 'fr3', e: 'fr1' }, treeFrames(FRUIT_LOBES, CH, hangOn(PEAR, PEAR_SPOTS)), { w: 32, h: 32, kind: 'object', fps: 3 });
const FRUIT_LOBES_B = [
  { cx: 18, cy: 7, r: 6.5 }, { cx: 10.5, cy: 10.5, r: 6.5 }, { cx: 23, cy: 14, r: 6.5 }, { cx: 13.5, cy: 16, r: 7.5 },
];
def('tree-fruit-b', FRUITPAL, treeFrames(FRUIT_LOBES_B, CH, hangOn(PEAR, PEAR_SPOTS)), { w: 32, h: 32, kind: 'object', fps: 3 });
// Blossom tree (spring; the green's centrepiece): the fruit crown starred with blossom.
const BLOSSOM = [[7, 6], [12, 4], [18, 3], [22, 8], [10, 11], [15, 9], [20, 13], [25, 12], [6, 14], [13, 16], [18, 17], [9, 18]];
def('tree-blossom', { ...FRUITPAL, f: 'blossom', g: 'petal', e: 'blossom2' },
  treeFrames(FRUIT_LOBES, CH, hangOn(['g', 'f'], BLOSSOM)), { w: 32, h: 32, kind: 'object', fps: 3 });
// Purse tree (6 in town): a gnarled crown hung with brass seed-purses that shake loose coins.
const PURSE = ['ef', 'gf', 'ee'];
const PURSE_SPOTS = [[9, 9], [17, 6], [22, 12], [13, 15], [7, 14], [19, 17]];
def('tree-purse', { ...FRUITPAL, k: 'mgl0', n: 'pinek', d: 'mgl1', b: 'mgl2', l: 'mgl3', f: 'brass', g: 'pear2', e: 'brass0' },
  treeFrames(ALDER_LOBES_B, CH, hangOn(PURSE, PURSE_SPOTS)), { w: 32, h: 32, kind: 'object', fps: 3 });
// Bee tree (~4 in town): an old alder with a dark hive hollow in the trunk; bees drift in four frames.
const BEE_TRUNK = TRUNK_ROWS.map((r, y) => (y === 2 ? '..............vkkt..............' : y === 3 ? '..............vkut..............' : r));
const BEES = [[[19, 22], [12, 19]], [[20, 21], [11, 20]], [[21, 22], [12, 21]], [[20, 23], [13, 20]]];
const beeFrames = treeFrames(ALDER_LOBES, CH, (r) => r, BEE_TRUNK).map((f, i) => BEES[i].reduce((r, [x, y]) => blit(r, ['y'], x, y), f));
def('tree-bee', { ...ALDERPAL, y: 'yellow' }, beeFrames, { w: 32, h: 32, kind: 'object', fps: 6 });
// Mangrove (Drownwood): a dense low crown on arching stilt roots standing in tannin water.
const MANGROVE_ROOTS = [
  '..............vut...............',
  '.............vuutt..............',
  '...........vu.vut.tu............',
  '.........vu..vu.ut..tu..........',
  '........vu..vu...ut..tu.........',
  '.......vu..vu.....ut..tu........',
  '......vu...u.......t...tu.......',
  '.....wwwwwwwwwwwwwwwwwwwww......',
  '.....qwwqwwwqwwwwqwwwqwwww......',
  '................................',
  '................................',
];
const MANGPAL = { k: 'mgl0', n: 'pinek', d: 'mgl1', b: 'mgl2', l: 'mgl3', t: 'mg0', u: 'mg1', v: 'mg2', w: 'tan1', q: 'tan2' };
def('tree-mangrove', MANGPAL, SWAY.map((dx) => blit(blit(blank(32, 32), MANGROVE_ROOTS, 0, 20),
  bend(canopy(32, 22, [{ cx: 10, cy: 11, r: 7 }, { cx: 20, cy: 10, r: 7.5 }, { cx: 15, cy: 15, r: 7 }, { cx: 25, cy: 15, r: 5 }], CH), dx, 9), 0, 0)),
{ w: 32, h: 32, kind: 'object', fps: 2 });
// Drowned tree (Drownwood): a dead silver snag standing in the water, broken limbs, a ring of ripples.
def('tree-drowned', { k: 'ww0', d: 'ww1', m: 'ww2', l: 'ww3', h: 'ww4', f: 'foam', g: 'mgl1' }, [
  '................................',
  '................................',
  '..............k.................',
  '.......k.....klk................',
  '......klk....kmk.......k........',
  '.......kmk...kmk......klk.......',
  '........kmk..kmk.....kmk........',
  '.........kmk.klmk...kmk.........',
  '..........kmkklmk..kmk..........',
  '...........kmklmdkkmk...........',
  '............klmmdmmk............',
  '............klmmddk.............',
  '...........kklmmdk..............',
  '..........kmklmmdk..............',
  '.........kmk.klmdk..............',
  '..........k..klmdk..............',
  '.............khmdk..............',
  '.............klmdk..............',
  '.............klmdk..............',
  '.............klgdk..............',
  '.............klmdk..............',
  '.............kgmdk..............',
  '.............klmgk..............',
  '.........ff.fkkkkkf.ff..........',
  '.......f...f.......f...f........',
  '........ff...f.ff.f..ff.........',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
], { w: 32, h: 32, kind: 'object' });

export const FLORA_TILES = Object.freeze(tiles);
export default FLORA_TILES;

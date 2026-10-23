/**
 * Ground tiles: turf, tall grass, sand, wet sand, mud (dry / wet / glowing), paths, quay cobbles, and
 * the land-side autotile edges (grass fringe, wet bank, the hard tide line). Plus the biome grounds
 * GDD-00 §4 adds: dig cracks, garden soil, snow, volcanic ash, quarry gravel, shingle, rippled tide
 * flats, moor turf and marsh. [ART-TILES]
 *
 * Split from `proto/tiles/tiles.js` with the art-director fixes kept: tall grass shows turf between
 * outlined tufts and sways 3 frames; wet sand is two ramps darker with a hard tide line; glowing mud
 * uses irregular blobs (now varied per spot), never a plus or a four-point star.
 * @module art/tiles/ground
 */

import { createGroup, rowsOf, texture, wrapBlit } from './kit.js';
import { blank, blit, edgeSet, mirror } from '../spriteUtil.js';

const { tiles, def, get } = createGroup('ground');

/* ------------------------------------------------------------------ grass */
const GP = { g: 'grass2', d: 'grass1', l: 'grass3', k: 'grass0', h: 'grass4' };
def('grass-a', GP, [
  'gggggggggggggggg',
  'gggggggggglggggg',
  'ggdggggggggggggg',
  'ggdggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggdgg',
  'ggggglgggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggdgggggg',
  'ggggggggdlgggggg',
  'glgggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggglggg',
  'ggggdggggggggggg',
  'gggggggggggggggg',
]);
def('grass-b', GP, [
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggggggggggdggg',
  'gglggggggggggggg',
  'gggggggggggggggg',
  'gggggggdgggggggg',
  'gggggggdgggggggg',
  'gggggggggggggggg',
  'ggggggggggglgggg',
  'gggggggggggggggg',
  'ggdggggggggggggg',
  'gggggggggggggggg',
  'ggggggglgggggdgg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggdggggggggggg',
]);
// Clover patch: a third turf so wide greens never tile visibly.
def('grass-c', { ...GP, c: 'grass3' }, texture('g', [
  [['.c.', 'ccc', '.d.'], 3, 2], [['c.', 'cc'], 11, 9], [['d'], 7, 7], [['d', 'd'], 13, 3], [['l'], 1, 12],
  [['d'], 9, 14], [['l'], 14, 13], [['.c', 'cd'], 5, 11],
]));

// Tall grass (encounter tile): outlined tufts lighter than the turf, turf always visible between
// them, no trunk. Three sway frames lean the tuft heads one pixel.
const TUFT = [
  'h..h..h',
  'mo.mo.m',
  'mo.momo',
  'omo.mmo',
  'ommmmbo',
  '.ommbo.',
  '..ooo..',
];
const lean = (tuft, dx) => tuft.map((r, i) => (i < 3 && dx ? (dx > 0 ? '.' + r.slice(0, -1) : r.slice(1) + '.') : r));
const TG = { ...GP, o: 'grass0', m: 'grass3', b: 'grass1', h: 'grass3' };
const tgFrame = (dx) => {
  let r = rowsOf(get('grass-a'));
  for (const [x, y] of [[1, 0], [9, 3], [4, 9]]) r = blit(r, lean(TUFT, dx), x, y);
  return r;
};
def('tall-grass', TG, [tgFrame(0), tgFrame(1), tgFrame(-1)], { fps: 4 });

/* --------------------------------------------------------- sand / mud */
const SP = { s: 'sand2', d: 'sand1', l: 'sand3', k: 'sand0' };
def('sand', SP, [
  'ssssssssssssssss',
  'ssssssssssdsssss',
  'sslsssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssls',
  'sssssdssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'sssssssssslsssss',
  'ssdsssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssdsss',
  'sssslsssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
]);
const WSP = { s: 'wet1', d: 'wet0', l: 'wet2' };
def('wet-sand', WSP, [
  'ssssssssssssssss',
  'sssssssssslsssss',
  'ssdsssssssssssss',
  'ssssssssssssssss',
  'sssssssssssssdss',
  'ssssslsssssssdss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'sdsssssssssslsss',
  'ssssssssssssssss',
  'ssssssssdsssssss',
  'ssssssssssssssss',
  'ssslsssssssssdss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'sssssdssssssssss',
]);
// Tide-flat ripples: the wet sand the ebb leaves combed into soft wavy ridges (lit crest above a
// shaded trough), each ridge on its own phase and broken in places, seamless on a 16px period.
function rippleRows() {
  const g = blank(16, 16, 's').map((r) => r.split(''));
  const ridges = [[1, 0, 0], [6, 5, 1], [11, 10, 2]];
  for (const [y0, phase, gap] of ridges) {
    for (let x = 0; x < 16; x++) {
      if ((x + gap * 5) % 16 === 13 || (x + gap * 5) % 16 === 14) continue; // a break in the ridge
      const y = y0 + Math.round(Math.sin(((x + phase) / 16) * Math.PI * 2) * 1.2);
      g[(y + 16) % 16][x] = 'l';
      g[(y + 1 + 16) % 16][x] = 'd';
    }
  }
  return g.map((r) => r.join(''));
}
def('sand-ripples', WSP, rippleRows());
// Dry mud flat: cracked plates.
const MP = { m: 'mud1', d: 'mud0', l: 'mud2' };
def('mud-dry', MP, [
  'mmmmmmdmmmmmmmmm',
  'mlmmmmdmmmmmmmlm',
  'mmmmmmdmmmdmmmmm',
  'dddmmmmdddmmmmmm',
  'mmmdddmmmmmmmmmm',
  'mmmmmmmmmmmmmdmm',
  'mmlmmmmmmmmmmdmm',
  'mmmmmmmmmlmmdmmm',
  'mmmmmmdddddddmmm',
  'mmmmmdmmmmmmmmmm',
  'mmmmdmmmmmmmmmmm',
  'mmmmdmmlmmmmmmmm',
  'dddddmmmmmmmmddd',
  'mmmmmmmmmmmdddmm',
  'mlmmmmmmmmdmmmmm',
  'mmmmmmmmmmdmmmlm',
]);
// Wet mud: dark, with 2-px sky-reflection streaks.
const WMP = { m: 'wmud1', d: 'wmud0', l: 'wmud2', r: 'skyref', b: 'skyref2' };
def('mud-wet', WMP, [
  'mmmmmmmmmmmmmmmm',
  'mmlmmmmmmmmrrmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmmmmmmmm',
  'mrrmmmmmmmmmmlmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmrbmmmmmm',
  'mmmmmmmmmmmmmmdm',
  'mmmmdmmmmmmmmmmm',
  'mmmmmmmmmmmmrrmm',
  'mmlmmmmmmmmmmmmm',
  'mmmmmmrrmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmlmmm',
  'mrrmmmmmdmmmmmmm',
  'mmmmmmmmmmmmmmmm',
]);
// Glowing night mud: the wet mud with sparse bioluminescent clusters (LUT-exempt) that pulse out of
// phase over three frames (bright -> mid -> dim). Each spot has its own irregular blob shape (the
// backlog asked for varied shapes); never a plus or a four-point star (that glyph is the Heartmark's).
const GMP = { m: 'wmud1', d: 'wmud0', l: 'wmud2', a: '!bio1', b: '!bio2', c: '!bio0' };
const GLOW_SHAPES = [
  [['ab.', 'bac', '..c'], ['ac.', 'ca.', '...'], ['c..', '.c.', '...']],
  [['.ba', 'aac', 'c..'], ['.ca', 'ca.', '...'], ['..c', 'c..', '...']],
  [['bac.', '.cab'], ['ca..', '..ca'], ['c...', '...c']],
  [['ba..', '.cab', '...c'], ['ca..', '..ca', '....'], ['.c..', '...c', '....']],
];
const GLOW_SPOTS = [[2, 2, 0, 0], [10, 5, 1, 1], [5, 11, 2, 2], [12, 12, 0, 3]];
const GLOW_BASE = rowsOf(get('mud-wet')).map((r) => r.replace(/[rb]/g, 'l'));
const glowFrame = (f) => GLOW_SPOTS.reduce((rows, [x, y, ph, sh]) => blit(rows, GLOW_SHAPES[sh][(f + ph) % 3], x, y), GLOW_BASE);
def('mud-glow', GMP, [glowFrame(0), glowFrame(1), glowFrame(2)], { fps: 4 });

/* ------------------------------------------------------- paths & floors */
def('path', { p: 'pa1', d: 'pa0', l: 'pa2', h: 'pa3' }, [
  'pppppppppppppppp',
  'pplppppppppdpppp',
  'pppppppppppppppp',
  'ppppppphpppppppp',
  'pdpppppppppppppp',
  'pppppppppppplppp',
  'pppppppppppppppp',
  'pppplpppdppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pdpppppppppppphp',
  'pppppppplppppppp',
  'pppppppppppppppp',
  'pppppppppppdpppp',
  'pplppppppppppppp',
  'pppppppppppppppp',
]);
// Quay cobbles: rounded setts in three staggered courses (setts wrap across the tile edge so no
// mortar line runs on the grid), lit top-left, shaded bottom-right, mortar at the rounded corners.
const SETT_COURSES = [
  { y: 0, h: 4, cuts: [4, 9, 14] },
  { y: 5, h: 4, cuts: [1, 6, 11] },
  { y: 10, h: 5, cuts: [3, 8, 13] },
];
const SETT_TINTS = { n: ['l', 'c', 'd'], w: ['l', 'w', 'u'], k: ['c', 'u', 'd'] };
function cobbleTile(tints) {
  const g = blank(16, 16, 'g').map((r) => r.split(''));
  let si = 0;
  for (const C of SETT_COURSES) {
    for (let k = 0; k < C.cuts.length; k++) {
      const a = C.cuts[k] + 1, b = C.cuts[(k + 1) % C.cuts.length] - 1;
      const sw = ((b - a + 16) % 16) + 1;
      const [hi, body, lo] = SETT_TINTS[tints[si % tints.length]];
      for (let i = 0; i < sw; i++) {
        for (let j = 0; j < C.h; j++) {
          const x = (a + i) % 16, y = C.y + j;
          const corner = (i === 0 || i === sw - 1) && (j === 0 || j === C.h - 1);
          let c = body;
          if (corner) c = i === 0 && j === 0 ? body : 'g';
          else if (j === 0 || i === 0) c = hi;
          else if (j === C.h - 1 || i === sw - 1) c = lo;
          if (!corner && i === 1 && j === 1 && tints[si % tints.length] === 'n' && si % 3 === 0) c = 'h';
          g[y][x] = c;
        }
      }
      si++;
    }
  }
  return g.map((r) => r.join(''));
}
const COBP = { g: 'co1', d: 'co15', c: 'co2', l: 'co3', h: 'co4', w: 'cow2', u: 'cow1' };
def('cobbles', COBP, cobbleTile(['n', 'w', 'n', 'n', 'k', 'n', 'w', 'n', 'n']));
def('cobbles-b', COBP, cobbleTile(['k', 'n', 'n', 'w', 'n', 'n', 'n', 'k', 'w']));
// Market-square flags: big dressed slabs (the green's market and the Lantern Market pitch).
def('flagstones', { g: 'co1', c: 'co3', l: 'co4', d: 'co2', k: 'co15' }, [
  'gccccccclgcccccc',
  'clccccccdgcccccl',
  'cccccccc dglcccc'.replace(' ', 'c'),
  'ccccccccdgcccccc',
  'ccclccccdgcccccc',
  'ccccccccdgccccdc',
  'ddddddddggdddddd',
  'gggggggggggggggg',
  'cccclgcccccccccc',
  'ccccdgccclcccccc',
  'ccccdgcccccccccc',
  'lcccdgcccccccccc',
  'ccccdgccccccccdc',
  'ccccdgcccccccccc',
  'ddddggdddddddddd',
  'gggggggggggggggg',
]);

/* ------------------------------------------------ biome grounds (new) */
// Garden soil: tilled rows (Bryony's beans, the cottage plot). Ridges lit on top, furrows dark.
def('soil', { s: 'soil1', d: 'soil0', l: 'soil2' }, [
  'llllllllllllllll',
  'ssssssssssssssss',
  'ssssslssssssssss',
  'dddddddddddddddd',
  'dddddsddddddddsd',
  'llllllllllllllll',
  'sssssssssslsssss',
  'ssssssssssssssss',
  'dddddddddddddddd',
  'dsdddddddddddddd',
  'llllllllllllllll',
  'ssslssssssssssss',
  'ssssssssssssssss',
  'dddddddddddddddd',
  'dddddddddsdddddd',
  'ssssssssssssslss',
]);
// Snow: soft drifts (blue-grey shadow lobes on the lower right of each drift), a few sparkles.
def('snow', { s: 'snow2', d: 'snow1', l: 'snow3', k: 'snow0' }, texture('s', [
  [['..ll', 'ssss', 'sddd', '.dd.'], 2, 1], [['.lll.', 'sssss', 'ssddd', '.ddd.'], 9, 6], [['ll', 'sd'], 3, 11],
  [['l'], 13, 1], [['.l', 'sd', 'dd'], 12, 12], [['l'], 7, 14], [['k'], 6, 4], [['k'], 14, 9],
]));
// Volcanic ash: grey grit with darker cinders and pale pumice flecks (Emberstep slopes).
def('ash', { a: 'ash1', d: 'ash0', l: 'ash2', k: 'vo2', h: 'ash3' }, texture('a', [
  [['d'], 2, 1], [['kd'], 10, 2], [['l'], 6, 4], [['h'], 13, 5], [['d', 'd'], 4, 7], [['.k', 'kd'], 11, 9],
  [['l'], 1, 11], [['d'], 8, 12], [['hl'], 13, 13], [['d'], 3, 14], [['l'], 9, 15], [['d'], 15, 0],
]));
// Quarry gravel: angular chips over grey grit (Cairnhold quarry floor, roads).
const CHIP = ['.l', 'cd'];
def('gravel', { g: 'co1', c: 'co2', l: 'co3', d: 'co0', h: 'co4' }, texture('g', [
  [CHIP, 1, 1], [CHIP, 7, 3], [['l', 'd'], 12, 1], [CHIP, 4, 7], [['hc', 'cd'], 11, 7], [CHIP, 14, 11],
  [['l', 'd'], 2, 12], [CHIP, 8, 12], [['c'], 6, 10], [['c'], 15, 5], [['h'], 10, 14],
]));
// Shingle: densely packed, rounded beach pebbles over dark grit (the Bar, Cairnhold coves). Pebbles sit
// on a jittered 4px lattice, each lit top-left and shaded bottom-right, in three stone tints.
function shingleRows() {
  let r = blank(16, 16, 'k');
  const TINTS = [['l', 'm', 'd'], ['h', 'l', 'm'], ['a', 'b', 'c']];
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      const hsh = (cx * 7 + cy * 13 + cx * cy * 5) % 11;
      const [hi, mid, lo] = TINTS[hsh % 3];
      const wide = hsh % 2 === 0;
      const peb = wide ? [`.${hi}${mid}.`, `${hi}${mid}${mid}${lo}`, `.${lo}${lo}.`] : [`${hi}${mid}.`, `${mid}${lo}${lo}`];
      r = wrapBlit(r, peb, cx * 4 + (cy & 1) * 2 + (hsh % 2), cy * 4 + (hsh % 3 === 0 ? 1 : 0));
    }
  }
  return r.map((row) => row.replace(/k/g, (m, i) => (i % 5 === 2 ? 's' : 'k')));
}
def('shingle', { k: 'sand0', s: 'wet1', h: 'st4', l: 'st3', m: 'st2', d: 'st1', a: 'cl4', b: 'cl3', c: 'cl2' }, shingleRows());
// Moor turf: tussocky, olive-drab grass (Thistlewind), darker than town turf with straw tips.
def('moor-turf', { g: 'moor1', d: 'moor0', l: 'moor2', h: 'moor3' }, texture('g', [
  [['h.h', 'ldl', '.d.'], 2, 1], [['h', 'd'], 9, 3], [['.h.', 'ldl'], 12, 6], [['l', 'd'], 5, 8],
  [['h.h', 'ldl', '.d.'], 9, 11], [['d'], 1, 12], [['h', 'd'], 14, 13], [['d'], 6, 14], [['l'], 15, 2],
]));
// Marsh: sodden ground with irregular standing-water pockets catching the sky (Lowmoor). The pools
// are walkable but splash; reed stubs and darker sedge around their rims.
def('marsh', { g: 'moor1', d: 'moor0', l: 'moor2', w: 'tan2', r: 'skyref', b: 'skyref2', k: 'tan0' }, texture('g', [
  [['..kkkk...', '.kwwwwkk.', 'kwwrbwwwk', '.kkwwwwk.', '...kkkk..'], 1, 2],
  [['.kkk..', 'kwwrwk', '.kkkk.'], 10, 9],
  [['d.l', 'd.d'], 12, 2], [['l', 'd'], 6, 9], [['d'], 3, 13], [['l'], 14, 14], [['d', 'd'], 8, 13], [['l'], 15, 6],
]));

/* -------------------------------------------------- detail overlays */
// Dig crack (daily cracks): a jagged split in the ground with kicked-up grains; detail overlay that
// reads on sand, mud and path alike. A zig-zag, never a plus or an X.
def('dig-crack', { k: 'bank', d: 'wet0', l: 'sand3', m: 'sand1' }, [
  '................',
  '................',
  '................',
  '.........l......',
  '....l...kk......',
  '.......kd..m....',
  '......kkd.......',
  '...m.kd.........',
  '....kkd....l....',
  '...kd...........',
  '..kkd...m.......',
  '.lk.............',
  '................',
  '..........l.....',
  '................',
  '................',
], { kind: 'detail' });
// The same crack freshly opened (after a dig): a scooped hole with a spoil heap.
def('dig-hole', { k: 'bank', d: 'wet0', s: 'sand0', l: 'sand3', m: 'sand1' }, [
  '................',
  '................',
  '................',
  '................',
  '.....kkkkk......',
  '....kdddddk.....',
  '...kddkkkddk.mm.',
  '...kdkkkkkdkmlmm',
  '...kddkkkddkmmms',
  '....kdddddk.sss.',
  '.....kkkkk......',
  '................',
  '................',
  '................',
  '................',
  '................',
], { kind: 'detail' });

/* ------------------------------------------------------ land-side edges */
// Grass fringe: ragged turf creeping over a path or sand tile along a grass edge. N edge; rotated.
const FRINGE = edgeSet([
  'gg.ggg.g.gg.ggg.',
  '.g..g.....g..g..',
  '....d........d..',
  ...blank(16, 13),
]);
for (const [side, rows] of Object.entries(FRINGE)) def(`fringe-${side}`, { g: 'grass2', d: 'grass1' }, rows, { kind: 'edge' });
// Wet bank: where land meets open water the ground darkens along the edge (2px on the south, the side
// the camera sees, 1px elsewhere), so the walkable edge always has a dark cue.
def('bank-s', { d: 'wet0', k: 'bank' }, [...blank(16, 14), 'dddddddddddddddd', 'kkkkkkkkkkkkkkkk'], { kind: 'edge' });
const BANK_N = edgeSet(['kkkkkkkkkkkkkkkk', ...blank(16, 15)]);
def('bank-n', { k: 'bank' }, BANK_N.n, { kind: 'edge' });
def('bank-e', { k: 'bank' }, BANK_N.e, { kind: 'edge' });
def('bank-w', { k: 'bank' }, BANK_N.w, { kind: 'edge' });
// Hard tide line: dry sand meets wet sand with a crisp darker line and a wrack of dried foam dots.
// Drawn on the wet-sand tile along the side that touches dry sand. N edge; rotated.
const TIDELINE = edgeSet([
  'kkkkkkkkkkkkkkkk',
  'f..f.....f...f..',
  '..........f.....',
  ...blank(16, 13),
]);
for (const [side, rows] of Object.entries(TIDELINE)) def(`tideline-${side}`, { k: 'sand0', f: 'sand3' }, rows, { kind: 'edge' });
// Path corners: the fringe pieces cover straight edges; these round an inside corner of turf.
def('fringe-corner', { g: 'grass2', d: 'grass1' }, [
  'ggg.............',
  'gg..............',
  'g...............',
  'd...............',
  ...blank(16, 12),
], { kind: 'edge' });
def('fringe-corner-r', { g: 'grass2', d: 'grass1' }, mirror([
  'ggg.............',
  'gg..............',
  'g...............',
  'd...............',
  ...blank(16, 12),
]), { kind: 'edge' });

export const GROUND_TILES = Object.freeze(tiles);
export default GROUND_TILES;

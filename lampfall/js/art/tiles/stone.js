/**
 * Stone tiles: cliff faces and rims, one-way ledges with chevrons, cut steps, rocks, quay coping, the
 * Waystones (dormant / visited / lantern-lit), skyglass nodes (charged / spent), and the stone of the
 * isles: standing stones and the quarry face (Cairnhold), volcanic rock, basalt and ember vents
 * (Emberstep), spa terraces, sea stacks (the Bar, the Lantern Stack), stone bridges and the ice caves.
 * [ART-TILES]
 *
 * Every blocking thing keeps the readability rule (GDD-00 §14): a base, a dark 1px line and a dithered
 * cast shadow bottom-right (colour `'shadow'`, drawn separately by the renderer). Ledges keep the lit lip
 * and the chevron notch. Skyglass is the only magenta in the world (`reserved: 'skyglass'`).
 * @module art/tiles/stone
 */

import { createGroup, rowsOf, texture } from './kit.js';
import { blank, blit } from '../spriteUtil.js';

const { tiles, def, get } = createGroup('stone');

/* ---------------------------------------------------------- cliffs */
// Cliff face: 16px tall, strata, dark base line, lit top lip.
const CP = { k: 'base', d: 'cl1', m: 'cl2', b: 'cl3', l: 'cl4', g: 'grass1' };
def('cliff-face', CP, [
  'gggggggggggggggg',
  'llllllllllllllll',
  'bbbblbbbbbbblbbb',
  'bbbbbbbmbbbbbbbb',
  'mbbbbbbmbbbbbbbm',
  'mmbbbbmmbbbbbbbm',
  'mmmbbbmmmbbbbmmm',
  'dmmmmmmmmbbbmmmm',
  'dmmmdmmmmmmmmmmd',
  'dmmmdmmmdmmmmmmd',
  'ddmmdmmmdmmmdmdd',
  'ddddmmmdddmmdddd',
  'kdddddddddddddkd',
  'kkdddkkddddkkkkd',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
]);
// End pieces: where the face meets water or turf the rock rounds off, lit on the west, shaded east.
const CF = rowsOf(get('cliff-face'));
def('cliff-face-l', CP, CF.map((r, y) => (y === 0 ? r : y < 2 ? 'k' + r.slice(1) : 'kl' + r.slice(2))), { kind: 'edge' });
def('cliff-face-r', CP, CF.map((r, y) => (y === 0 ? r : r.slice(0, 13) + 'dkk')), { kind: 'edge' });
// Side faces for cliff-top edges (drawn over the cliff-top turf): a 5px stratified rock face.
const RIM_W = ['kmbbl', 'kmbbl', 'kdmbl', 'kmmbl', 'kmbbl', 'kdmbl', 'kmbbl', 'kmmbl', 'kdmbl', 'kmbbl', 'kmbbl', 'kdmml', 'kmbbl', 'kmmbl', 'kdmbl', 'kmbbl'];
def('cliff-rim-w', { k: 'cl0', m: 'cl2', d: 'cl1', l: 'cl4', b: 'cl3' }, RIM_W.map((r) => r + '.'.repeat(11)), { kind: 'edge' });
const RIM_E = ['bmddk', 'bmddk', 'bdmdk', 'bmmdk', 'bmddk', 'bmkdk', 'bmddk', 'bdmdk', 'bmddk', 'bmmdk', 'bmkdk', 'bmddk', 'bdmdk', 'bmddk', 'bmmdk', 'bmddk'];
def('cliff-rim-e', { k: 'cl0', m: 'cl2', d: 'cl1', b: 'cl3' }, RIM_E.map((r) => '.'.repeat(11) + r), { kind: 'edge' });
def('cliff-rim-n', { l: 'cl4', b: 'cl3', d: 'cl2' }, ['dddddddddddddddd', 'llllllllllllllll', 'bbbbbbbbbbbbbbbb', ...blank(16, 13)], { kind: 'edge' });
// Ice cliff (Rimeholt): the same massing in glacier blues, a snow cap instead of turf.
const ICECP = { k: 'base', d: 'ice0', m: 'st2', b: 'ice1', l: 'ice2', g: 'snow2' };
def('cliff-face-ice', ICECP, CF);

/* ---------------------------------------------------------- ledges */
const LEDGE_PAL = { g: 'grass2', y: 'sand3', l: 'cl4', m: 'cl2', d: 'cl1', k: 'cl0', s: 'grass0' };
const LEDGE = [
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'yyyyyyyyyyyyyyyy',
  'llllllllllllllll',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmdmmmmmm',
  'dmmmmmmddmmmmmmd',
  'ddmmmmmmmmmmmmdd',
  'kkkkkkkkkkkkkkkk',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'gggggggggggggggg',
];
def('ledge', LEDGE_PAL, LEDGE);
// The chevron notch (every other ledge tile): a light V pointing the way down.
def('ledge-b', LEDGE_PAL, LEDGE.map((r, y) => ({ 7: 'llllllyllyllllll', 8: 'mmmmmmmyymmmmmmm', 9: 'mmmmmmdmmdmmmmmm' }[y] || r)));
// Ends: lip and face taper back into the turf over 5px so a ledge never stops square.
const LEDGE_TAPER = { 6: 0, 7: 0, 8: 1, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6 };
const ledgeEnd = (rows, fromLeft) => rows.map((r, y) => {
  if (!(y in LEDGE_TAPER)) return r;
  const n = LEDGE_TAPER[y];
  const line = r.split('');
  for (let i = 0; i < n; i++) line[fromLeft ? i : 15 - i] = 'g';
  if (n < 16 && y >= 8 && y <= 12) line[fromLeft ? n : 15 - n] = 'k';
  return line.join('');
});
def('ledge-l', LEDGE_PAL, ledgeEnd(LEDGE, true));
def('ledge-r', LEDGE_PAL, ledgeEnd(LEDGE, false));
// Steps cut into a cliff face: three treads (lit nosing, riser, shadow line) between dark side walls.
def('steps', { g: 'grass1', k: 'cl0', d: 'cl1', b: 'cl3', l: 'cl4' }, [
  'gggggggggggggggg',
  'kllllllllllllllk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
  'kllllllllllllllk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
  'kllllllllllllllk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
]);

/* ---------------------------------------------------------- rocks */
const ROCKP = { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', s: 'shadow' };
def('rock-a', ROCKP, [
  '................',
  '................',
  '......kkk.......',
  '....kkhlmkk.....',
  '...khlmmmmdk....',
  '...klmmmmmddk...',
  '..kmmmmmmmdddk..',
  '..kmmmmmmddddk..',
  '..kdmmmmddddkk..',
  '...kdddddddkks..',
  '...kkkkkkkkkss..',
  '......ssssss....',
  '................',
  '................',
  '................',
  '................',
], { kind: 'detail' });
def('rock-b', ROCKP, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kk......kkk...',
  '.khlk....khmdk..',
  '.klmdk...kmmdk..',
  '.kmddk...kdddk..',
  '.kkkkks..kkkkks.',
  '...sss.....sss..',
  '................',
  '................',
  '................',
  '................',
  '................',
], { kind: 'detail' });
// Volcanic boulder: black basalt with a vesicular, glassy top; a dark base and cast shadow.
const VOP = { k: 'base', d: 'vo1', m: 'vo2', l: 'vo3', h: 'vo4', s: 'shadow', p: 'vo0' };
def('volcanic-rock', VOP, [
  '................',
  '................',
  '.....kkkkk......',
  '...kkhlllmkk....',
  '..khllmpmmmdk...',
  '..klmmmmmmpddk..',
  '.klmpmmmmmmmddk.',
  '.kmmmmmmpmmdddk.',
  '.kdmmmmmmmddddk.',
  '.kddmmmmmddddkk.',
  '..kdddddddddkks.',
  '..kkkkkkkkkkkss.',
  '....sssssssss...',
  '................',
  '................',
  '................',
], { kind: 'detail' });
// Crag: a 32×32 basalt outcrop (Emberstep slopes), columnar with lit tops.
const CRAG = [
  '................................',
  '................................',
  '............kkkk................',
  '...........khhlmk...............',
  '...........kllmmk..kkkk.........',
  '...........klmmdk.khhlmk........',
  '.......kkkkklmmdk.kllmdk........',
  '......khhllklmmdkkklmmdk........',
  '......kllmmklmmdkhhllmdk........',
  '......klmmdklmmdkllmmmdkkkk.....',
  '......klmmdklmmdklmmmdkhhlk.....',
  '......klmmdklmmdklmmddkllmdk....',
  '.....kklmmdklmpdklmmddklmmdk....',
  '....khhlmmdklmmdklmpddklmmdk....',
  '....kllmmmdklmmdklmmddklmmdk....',
  '....klmmmddklmmdklmmddklmpdk....',
  '....klmpmddklmmdklmmddklmmdk....',
  '....klmmmddkldmdklmmddklmmdk....',
  '....klmmmddklmmdkldmddklmmdk....',
  '....kldmmddklmmdklmmddkldmdk....',
  '....klmmmddklmmdklmmddklmmdk....',
  '....kdmmdddkdmmdkdmmddkdmmdk....',
  '....kddddddkdddddkddddkddddk....',
  '....kkkkkkkkkkkkkkkkkkkkkkkks...',
  '....xxxxxxxxxxxxxxxxxxxxxxxxss..',
  '......sssssssssssssssssssssss...',
  '........ssssssssssssssssssss....',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];
def('crag', { ...VOP, x: 'base' }, CRAG, { w: 32, h: 32, kind: 'object' });

/* ---------------------------------------------------------- isle stone */
// Basalt pavement (Emberstep paths, the Weather Spire forecourt): column tops in a staggered hex-like
// course, lit edges top-left, dark joints.
def('basalt', { j: 'vo1', m: 'vo2', l: 'vo3', d: 'vo1', h: 'vo4' }, [
  'jmmmmmjjmmmmmmjj',
  'mlllmmdjlmmmmmdj',
  'mlmmmmdjlmmmmmdj',
  'mlmmmmdjlmmhmmdj',
  'mlmmmmdjjddddddj',
  'jddddddjjjmmmmmj',
  'jjmmmmmmjlmmmmdj',
  'jlllmmmdjlmmmmdj',
  'jlmmmmmdjlmmmmdj',
  'jlmmhmmdjjddddjj',
  'jjdddddjmmmmmjjm',
  'mmmmmjjlllmmmdjl',
  'mmmmdjjlmmmmmdjl',
  'mmmmdjjlmmmmmdjl',
  'dddddjjjdddddjjj',
  'jmmmmmjjmmmmmmjj',
]);
// Ember vent: a fissure in the ash with real flame showing (LUT-exempt), pulsing over three frames.
const VENT = [
  '................',
  '................',
  '..........kk....',
  '.........kak....',
  '........kabk....',
  '.......kabk.....',
  '......kaak......',
  '....kkabk.......',
  '...kabbak.......',
  '..kaak.kk.......',
  '..kak...........',
  '...k............',
  '................',
  '................',
  '................',
  '................',
];
const ventFrame = (a, b) => VENT.map((r) => r.replace(/a/g, a).replace(/b/g, b));
def('ember-vent', { k: 'vo0', r: '!fire0', o: '!fire1', y: '!fire2' },
  [ventFrame('r', 'o'), ventFrame('o', 'y'), ventFrame('r', 'r')], { kind: 'detail', fps: 4 });
// Quarry face (Cairnhold): cut granite benches with drill scores; blocking, base line.
def('quarry-face', { g: 'co1', k: 'base', d: 'st1', m: 'st2', l: 'st3', h: 'st4', s: 'co0' }, [
  'gggggggggggggggg',
  'hhhhhhhhhhhhhhhh',
  'llllllllllllllll',
  'mmmdmmmmmmdmmmmm',
  'mmmdmmmmmmdmmmmm',
  'mmmmmmmmmmmmmmmm',
  'dddddddddddddddd',
  'hhhhhhhhhhhhhhhh',
  'lllllllllllllll',
  'mmmmmmdmmmmmmmdm',
  'mmmmmmdmmmmmmmdm',
  'mmmmmmmmmmmmmmmm',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  'ssssssssssssssss',
  'gggggggggggggggg',
].map((r) => (r + 'l').slice(0, 16)));
// Standing stone (Cairnhold, 16×32): a weathered menhir with lichen, lit west flank, base and shadow.
def('standing-stone', { k: 'base', d: 'st1', m: 'st2', l: 'st3', h: 'st4', g: 'moss2', y: 'straw2', s: 'shadow', x: 'base' }, [
  '................',
  '................',
  '......kkk.......',
  '.....khlmk......',
  '....khlmmdk.....',
  '....klmmmdk.....',
  '....khmmmdk.....',
  '....klmgmdk.....',
  '...kllmggmdk....',
  '...klmmmmmdk....',
  '...klmmmmmdk....',
  '...khmmmmddk....',
  '...klmmmmmdk....',
  '...klmmymmdk....',
  '...klmmmmmdk....',
  '...khmmmmddk....',
  '...klmmmmmdk....',
  '...klmmmmddk....',
  '...klmgmmmdk....',
  '..kllmggmmddk...',
  '..klmmmmmmddk...',
  '..khmmmmmmddk...',
  '..klmmmmmmddk...',
  '..klmmmmmdddk...',
  '..klmmmmmmddk...',
  '..klmmmmmdddks..',
  '..kkkkkkkkkkkss.',
  '..xxxxxxxxxxxsss',
  '.....sssssssss..',
  '................',
  '................',
  '................',
], { w: 16, h: 32, kind: 'object' });
// Ward Spire sentinel (LF-06): the standing stone with its mark glowing (LUT-exempt rune light) and
// a lattice shimmer that flickers round it on the second frame, so the stone that talks stands out
// from the lattice fence of plain stones.
{
  const base = [
    '................',
    '................',
    '......kkk.......',
    '.....khlmk......',
    '....khlmmdk.....',
    '....klmmmdk.....',
    '....khmmmdk.....',
    '....klmgmdk.....',
    '...kllmggmdk....',
    '...klmmrmmdk....',
    '...klmrwrmdk....',
    '...khmmrmddk....',
    '...klmrmrmdk....',
    '...klrmmmrdk....',
    '...klmmmmmdk....',
    '...khmmmmddk....',
    '...klmmmmmdk....',
    '...klmmmmddk....',
    '...klmgmmmdk....',
    '..kllmggmmddk...',
    '..klmmmmmmddk...',
    '..khmmmmmmddk...',
    '..klmmmmmmddk...',
    '..klmmmmmdddk...',
    '..klmmmmmmddk...',
    '..klmmmmmdddks..',
    '..kkkkkkkkkkkss.',
    '..xxxxxxxxxxxsss',
    '.....sssssssss..',
    '................',
    '................',
    '................',
  ];
  const SHIMMER = [[1, 6], [13, 9], [0, 14], [14, 17], [1, 21], [13, 24]];
  const lit = (rows, on) => rows.map((r, y) => {
    let row = on ? r : r.replace(/w/g, 'r');
    for (const [sx, sy] of SHIMMER) if (on && sy === y && row[sx] === '.') row = row.slice(0, sx) + 'w' + row.slice(sx + 1);
    return row;
  });
  def('sentinel-stone', { k: 'base', d: 'st1', m: 'st2', l: 'st3', h: 'st4', g: 'moss2', s: 'shadow', x: 'base', r: '!rune', w: '!runew' },
    [lit(base, false), lit(base, true)], { w: 16, h: 32, kind: 'object', fps: 3 });
}
// Sea stack (the Lantern Stack, the Bar; 32×48): a stratified column standing in the sea, a pale crown
// of birds' whitewash, kelp at the waterline and a foam ring at its foot.
const STACK = [];
for (let y = 0; y < 48; y++) {
  const half = y < 3 ? 0 : y < 6 ? 5 + y : y < 40 ? 10 + Math.round(Math.sin(y * 0.55) * 0.8) + (y > 30 ? 1 : 0) : 12;
  let row = '';
  for (let x = 0; x < 32; x++) {
    const dx = x - 15.5;
    if (y < 3 || Math.abs(dx) > half + 0.5) { row += '.'; continue; }
    const edgeL = dx < -half + 1.5, edgeR = dx > half - 1.5;
    let c = dx < -half / 3 ? 'b' : dx < half / 3 ? 'm' : 'd';
    if (y % 7 === 3 && !edgeL && !edgeR) c = 'd';
    if (y % 7 === 4 && dx < 0 && !edgeL) c = 'l';
    if (y < 9) c = (x + y) % 3 === 0 ? 'w' : y < 7 ? 'w' : c;
    if (y >= 38 && y < 42) c = (x * 3 + y) % 4 === 0 ? 'g' : y > 39 ? 'q' : c;
    if (edgeL) c = 'k';
    if (edgeR) c = y < 9 ? 'k' : 'k';
    row += c;
  }
  STACK.push(row);
}
for (let y = 42; y < 48; y++) {
  STACK[y] = y === 42 ? '...ff.fffkkkkkkkkkkkkkkfff.ff...' : y === 43 ? '..f..ff..ffffffffffffff..ff..f..' : y === 44 ? '....f...f..f...f...f..f...f.....' : '.'.repeat(32);
}
def('sea-stack', { k: 'cl0', d: 'cl1', m: 'cl2', b: 'cl3', l: 'cl4', w: 'pl3', g: 'mgl1', q: 'tan1', f: 'foam' }, STACK, { w: 32, h: 48, kind: 'object' });
// Stone bridge deck over the river (E-W): dressed slabs between low parapets.
def('bridge-stone', { k: 'base', p: 'st3', q: 'st2', h: 'st4', g: 'co2', l: 'co3', d: 'co1', s: 'co0' }, [
  'hhhhhhhhhhhhhhhh',
  'pppqpppppppqpppp',
  'kkkkkkkkkkkkkkkk',
  'llllllllllllllll',
  'ggggggdgggggggdg',
  'ggggggdgggggggdg',
  'ggggggdgggggggdg',
  'dddddddddddddddd',
  'gggdgggggggdgggg',
  'gggdgggggggdgggg',
  'gggdgggggggdgggg',
  'dddddddddddddddd',
  'ssssssssssssssss',
  'hhhhhhhhhhhhhhhh',
  'pppqpppppppqpppp',
  'kkkkkkkkkkkkkkkk',
]);

/* ---------------------------------------------------------- spa terraces */
// Travertine terrace (walkable): creamy mineral crust in scalloped flow lines.
def('spa-terrace', { t: 'tv1', l: 'tv2', h: 'tv3', d: 'tv0' }, texture('t', [
  [['..llll..', '.l....l.', 'l......d'], 1, 1], [['.lll.', 'l...d'], 9, 6], [['..lll..', '.l...l.', 'l.....d'], 3, 10],
  [['h'], 12, 2], [['h'], 6, 7], [['d'], 14, 13], [['h'], 13, 11],
]));
// Terrace lip: the rim of a pool terrace where water spills; a scalloped cream lip, drip streaks and
// a wet shadow onto the step below. One-way drop like a ledge.
def('spa-terrace-lip', { t: 'tv1', l: 'tv2', h: 'tv3', d: 'tv0', w: 'spr1', s: 'spr2', k: 'cl1' }, [
  'wwwwwwwwwwwwwwww',
  'wswwwwwswwwwwwsw',
  'wwwwwwwwwwwwwwww',
  'hhhwhhhhhhwhhhhh',
  'hlllhhlllllhhlll',
  'llllllllllllllll',
  'ltlltlllltllltll',
  'ttltttttttltttlt',
  'tttdttttttdtttdt',
  'ttwdtttttwdttwdt',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  'tttttttttttttttt',
  'tttdttttttttdttt',
  'tttttttttttttttt',
  'tttttttttttttttt',
]);

/* ---------------------------------------------------------- caves */
// Cave floor (Rimeholt ice caves): dark stone dusted with frost. Light radius in the caves is 3 tiles,
// so the floor keeps a 3:1 cue against the walls.
def('cave-floor', { f: 'st1', d: 'st0', l: 'st2', i: 'ice1', h: 'ice2' }, texture('f', [
  [['l.', '.d'], 2, 2], [['i'], 7, 4], [['h', 'i'], 12, 1], [['ll', 'dd'], 9, 9], [['i'], 3, 11], [['h'], 14, 12],
  [['d'], 6, 14], [['l'], 0, 7],
]));
// Cave wall: a rock face with an icy crust on its lip and hanging icicles; base line, blocking.
def('cave-wall', { k: 'base', d: 'st0', m: 'st1', b: 'st2', i: 'ice1', h: 'ice2', w: 'ice3' }, [
  'wwhwwwhwwwwhwwhw',
  'hhihhiihhhihhhih',
  'ibbibbbiibbbbibb',
  'bbbbbmbbbbbbmbbb',
  'mbbbbmmbbbbbmmbm',
  'mmbbmmmbbbmmmmmm',
  'mmmmmmmmbmmmmdmm',
  'dmmmdmmmmmmmmdmm',
  'dmmmdmmmdmmmmmmd',
  'ddmmdmmmdmmmdmdd',
  'ddddmmmdddmmdddd',
  'kddddddddddddddd',
  'kkddkkdddddkkkdd',
  'kkkkkkkkkkkkkkkk',
  'k.kkk.kk.kkkk.kk',
  '..k....k...k....',
]);

/* ---------------------------------------------------------- quay */
// Quay coping: dressed granite blocks along the water edge (wet dark waterline, lit nosing, block face
// with offset joints, a shadow line onto the cobbles). Variant b carries an iron bollard.
const COPE = [
  'kkkkkkkkkkkkkkkk',
  'hhhhhhhlhhhhhhhh',
  'mmmmmmmdlmmmmmmm',
  'mmmmmmmdmmmmmmmm',
  'mmmmmmmdmmmmmmmm',
  'dddddddddddddddd',
  'ssssssssssssssss',
];
def('quay-lip', { k: 'ink', h: 'st4', l: 'st3', m: 'st3', d: 'st2', s: 'co0' }, [...COPE, ...blank(16, 9)], { kind: 'edge' });
def('quay-lip-b', { k: 'ink', h: 'st4', l: 'st3', m: 'st3', d: 'st2', s: 'co0', i: 'iron', j: 'st1', e: 'pane1' },
  blit([...COPE, ...blank(16, 9)], ['.jiij.', 'jieiij', 'jiiiij', '.jjjj.'], 9, 1), { kind: 'edge' });

/* ---------------------------------------------------------- landmarks */
// Waystone (16×32, anchor bottom tile): stone pillar, iron ring, rune. Three states: dormant (never
// visited, the rune cut but unlit), visited (rune glows cyan, LUT-exempt), lantern-lit (Ludo's lantern
// hung on the ring: a lantern-path node, amber).
const WAYSTONE = [
  '.....kkkkk......',
  '....khhllmk.....',
  '...khhlllmmk....',
  '...khllmmmmdk...',
  '...kllmmmmmdk...',
  '...klmmrrmmdk...',
  '...klmrwwrmdk...',
  '...klmmrrmmdk...',
  '...klmmmrmmdk...',
  '...klmmmrmmdk...',
  '...klmrrrrmdk...',
  '...klmmmrmmdk...',
  '...klmmmrmmdk...',
  '...klmmmmmmdk...',
  '..iiiiiiiiiiii..',
  '.iklmmmmmmmddki.',
  '..iiiiiiiiiiii..',
  '...klmmmmmmdk...',
  '...klmmmmmmdk...',
  '...klmmmmmmdk...',
  '...klmmgmmmdk...',
  '...klmggmmmdk...',
  '...klmmmmmmdk...',
  '...klmmmmmmddk..',
  '..kklmmmmmmddk..',
  '..klmmmmmmmdddk.',
  '..klmmmmmmmdddk.',
  '..kkkkkkkkkkkkks',
  '..xxxxxxxxxxxxss',
  '....ssssssssss..',
  '................',
  '................',
];
const WSP = { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', i: 'iron', g: 'grass1', s: 'shadow', x: 'base' };
def('waystone', { ...WSP, r: 'rune0', w: 'rune1' }, WAYSTONE, { w: 16, h: 32, kind: 'object', note: 'dormant: not yet visited' });
def('waystone-lit', { ...WSP, r: '!rune', w: '!runew' }, WAYSTONE, { w: 16, h: 32, kind: 'object', note: 'visited: rune glows' });
// Ludo's lantern hangs from the east end of the iron ring: hook, cap, glass, base; the flame flickers.
const LANTERN = ['.i.', 'iii', 'aya', 'aaa', 'iii'];
def('waystone-lantern', { ...WSP, r: '!rune', w: '!runew', a: '!amber', y: '!lampcore' },
  [0, 1].map((f) => blit(WAYSTONE, f ? LANTERN.map((r) => r.replace('aya', 'yaa')) : LANTERN, 12, 16)),
  { w: 16, h: 32, kind: 'object', fps: 2, note: 'lantern path lit by Ludo' });
// Skyglass node: irregular faceted shard (>= 5 sides, never a plus or 4-point star). 2 frames = 1 s pulse.
const SGP = { k: '!m0', m: '!m1', h: '!m2', s: 'shadow', x: 'base', r: 'st1', q: 'st2' };
const SKYGLASS = [
  '................',
  '.........k......',
  '........khk.....',
  '.......khmk.....',
  '......khmmk.....',
  '......khmmmk....',
  '.....khmmmmk....',
  '.....kmmmmmkk...',
  '....khmmmmkmmk..',
  '....kmmmmkmmmk..',
  '....kmmmkmmmmk..',
  '....kmmkmmmkkk..',
  '...rkkkkmmkqqrk.',
  '..rqqkkkkkkqqqrk',
  '..rrrrrrrrrrrrrs',
  '...xxxxxxxxxxsss',
];
def('skyglass', SGP, [SKYGLASS, SKYGLASS.map((r) => r.replace(/h/g, 'm'))], { kind: 'detail', fps: 2, reserved: 'skyglass' });
// Spent node (harvested; refills per badge): the shard dulled to a grey-violet, no glow.
def('skyglass-spent', { ...SGP, k: 'sgd0', m: 'sgd1', h: 'sgd2' }, SKYGLASS, { kind: 'detail' });

export const STONE_TILES = Object.freeze(tiles);
export default STONE_TILES;

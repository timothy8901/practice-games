/**
 * The lighthouse (the compass of the game): the 32×80 tower dark and lit, the scaffold overlay (seven
 * 9-row sections climbed bottom-up, one per house tier), the lamp-room interior (iron grating floor,
 * whitewashed curved wall, porthole, the spiral stair, the great lens dark and lit), and the fx sprites
 * the light and weather passes draw (the lamp light pool, the fog band). [ART-TILES]
 *
 * Split from `proto/tiles/tiles.js`. The lit lamp uses the lighthouse amber `!lhamber` and lamp core
 * (LUT-exempt); after the Relighting the renderer adds the 8 s dithered sweep (never a flash).
 * @module art/tiles/lighthouse
 */

import { createGroup, texture } from './kit.js';
import { blank } from '../spriteUtil.js';

const { tiles, def } = createGroup('lighthouse');

/** Rows per scaffold section and the tower row the lowest section sits on. */
export const SCAFFOLD_SECTION_ROWS = 9;
export const SCAFFOLD_BASE_ROW = 77;
export const SCAFFOLD_SECTIONS = 7;

// The tower: whitewashed with a red band, gallery, lamp room. Lamp lit / dark via palette.
const LHP = {
  k: 'uiink', i: 'iron', w: 'pl2', s: 'pl1', d: 'pl0', h: 'pl3', r: 'red2', q: 'red1', e: 'red3',
  g: 'pane0', G: 'pane1', a: 'pane0', A: 'pane1', c: 'pane1', t: 'wd0', u: 'wd1', x: 'base', m: 'st2', n: 'st1', o: 'st3', b: 'brass', y: 'shadow',
};
const LH_ROWS = [
  '..............kkkk..............',
  '..............kbbk..............',
  '...............kk...............',
  '............kkkkkkkk............',
  '...........kiiiiiiiik...........',
  '..........kiggggggggik..........',
  '..........kigaaccaagik..........',
  '..........kigaccccagik..........',
  '..........kigaccccagik..........',
  '..........kigaaccaagik..........',
  '..........kiggggggggik..........',
  '.........kiiiiiiiiiiiik.........',
  '........kikikikikikikikk........',
  '........kkkkkkkkkkkkkkkk........',
  '.........kqqqqqqqqqqqqk.........',
  ...Array(9).fill('.........khwwwwwwwwwsdk.........'),
  ...Array(8).fill('.........keerrrrrrrrqqk.........'),
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwGGwwwsdk.........',
  '.........khwwwwggwwwsdk.........',
  '.........khwwwwggwwwsdk.........',
  ...Array(5).fill('.........khwwwwwwwwwsdk.........'),
  ...Array(5).fill('........khwwwwwwwwwwwsdk........'),
  '........khwwwwwGGwwwwsdk........',
  '........khwwwwwggwwwwsdk........',
  '........khwwwwwggwwwwsdk........',
  ...Array(4).fill('........khwwwwwwwwwwwsdk........'),
  ...Array(10).fill('.......khwwwwwwwwwwwwwsdk.......'),
  '......khwwwwwwwwwwwwwwwsdk......',
  '......khwwwwwwwwwwwwwwwsdk......',
  '......khwwwwwwwwwwwwwwwsdk......',
  '......khwwwwwwwkkkkwwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuutukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '.....komnnnnnnkuuuuknnnnmok.....',
  '.....komnnnnnnnnnnnnnnnnmok.....',
  '....kkkkkkkkkkkkkkkkkkkkkkkk....',
  '....xxxxxxxxxxxxxxxxxxxxxxxxyy..',
  '......yyyyyyyyyyyyyyyyyyyyyyyyy.',
  '.........yyyyyyyyyyyyyyyyyyyy...',
];
def('lighthouse-dark', LHP, LH_ROWS, { w: 32, h: 80, kind: 'object' });
def('lighthouse-lit', { ...LHP, g: '!lhamber', G: '!lhamber', a: '!lhamber', A: '!lampcore', c: '!lampcore' }, LH_ROWS, { w: 32, h: 80, kind: 'object' });

// Scaffolding: 7 sections of 9 rows hugging the tower's right flank, built bottom-up. Section n
// (0 = lowest) occupies rows [77 - 9(n+1), 77 - 9n). `art/props` composes the stage sprites.
const SCP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'wd0', r: 'iron' };
export const SC_SECTION = Object.freeze([
  '.......................lllllllll',
  '.......................ddddddddd',
  '..........................lk.dlk',
  '..........................lkd.lk',
  '..........................lk..lk',
  '..........................lk..lk',
  '..........................lk..lk',
  '..........................lk..lk',
  '..........................lk..lk',
]);
const SC_ROWS = blank(32, 80);
for (let n = 0; n < SCAFFOLD_SECTIONS; n++) {
  const top = SCAFFOLD_BASE_ROW - SCAFFOLD_SECTION_ROWS * (n + 1);
  for (let r = 0; r < SCAFFOLD_SECTION_ROWS; r++) SC_ROWS[top + r] = SC_SECTION[r];
}
def('lighthouse-scaffold', SCP, SC_ROWS, { w: 32, h: 80, kind: 'object' });

/* ---------------------------------------------------------------- lamp room / stair interior */
// Iron grating floor (the Lamp Room gallery): a lattice with the dark drop showing through.
def('lamp-room-floor', { i: 'iron2', k: 'iron', d: 'ink', h: 'st3' }, [
  'hiiihiiihiiihiii',
  'ikdkikdkikdkikdk',
  'idddidddidddiddd',
  'ikdkikdkikdkikdk',
  'hiiihiiihiiihiii',
  'ikdkikdkikdkikdk',
  'idddidddidddiddd',
  'ikdkikdkikdkikdk',
  'hiiihiiihiiihiii',
  'ikdkikdkikdkikdk',
  'idddidddidddiddd',
  'ikdkikdkikdkikdk',
  'hiiihiiihiiihiii',
  'ikdkikdkikdkikdk',
  'idddidddidddiddd',
  'ikdkikdkikdkikdk',
]);
// Curved whitewashed wall of the tower interior (face tile with a tarred skirting).
const LHWALL = texture('w', [[['h'], 3, 3], [['s', 's'], 10, 6], [['h'], 13, 10], [['s'], 5, 11]]);
def('lighthouse-wall', { w: 'pl2', h: 'pl3', s: 'pl1', d: 'pl0', k: 'uiink', t: 'wd0' },
  [...LHWALL.slice(0, 13).map((r) => 'd' + r.slice(1, 15) + 'd'), 'kkkkkkkkkkkkkkkk', 'tttttttttttttttt', 'kkkkkkkkkkkkkkkk']);
// Porthole: a round window in the wall; at night the sea outside is ink with one star.
def('lighthouse-porthole', { w: 'pl2', h: 'pl3', s: 'pl1', d: 'pl0', b: 'brass', o: 'brass0', g: 'deep1', l: 'deep2', k: 'uiink', t: 'wd0' }, [
  'dwwwwwwwwwwwwwwd',
  'dwwwwwoooowwwwwd',
  'dwwwwobbbbowwwwd',
  'dwwwobgglgbowwwd',
  'dwwobgglggbbowwd',
  'dwwobglggggbowwd',
  'dwwobgggggggbowd'.slice(0, 15) + 'd',
  'dwwobggggggbowwd',
  'dwwwobgggggbowwd',
  'dwwwwobbbbbowwwd',
  'dwwwwwooooowwwwd',
  'dwwwwwwwwwwwwwwd',
  'dwwwwwwwwwwwwwwd',
  'kkkkkkkkkkkkkkkk',
  'tttttttttttttttt',
  'kkkkkkkkkkkkkkkk',
]);
// Spiral stair (32×32, seen from above): wedge treads winding round a newel post, iron rail.
const STAIR = [];
for (let y = 0; y < 32; y++) {
  let row = '';
  for (let x = 0; x < 32; x++) {
    const dx = x - 15.5, dy = (y - 15.5) * 1.15;
    const r = Math.hypot(dx, dy);
    if (r > 15) { row += '.'; continue; }
    if (r > 13.6) { row += 'i'; continue; }
    if (r < 2.6) { row += r < 1.6 ? 'n' : 'k'; continue; }
    const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2); // 0..1
    const step = Math.floor(a * 12);
    const f = a * 12 - step;
    if (f < 0.12) row += 'k';
    else if (f < 0.3) row += 'l';
    else row += step % 2 ? 'm' : 'd';
  }
  STAIR.push(row);
}
def('stair-spiral', { i: 'iron', k: 'uiink', n: 'brass', l: 'co4', m: 'co3', d: 'co2' }, STAIR, { w: 32, h: 32, kind: 'object' });
// The great lens (32×32): a ribbed Fresnel beehive in a brass cradle. Dark: cool glass. Lit: the lamp
// burns inside (LUT-exempt) and the ribs catch it in a slow 4-frame shimmer.
const LENS = [];
for (let y = 0; y < 32; y++) {
  let row = '';
  for (let x = 0; x < 32; x++) {
    const dx = (x - 15.5) / 11, dy = (y - 13) / 13;
    const inside = dx * dx + dy * dy <= 1 && y >= 1 && y <= 24;
    if (y >= 25 && y <= 27 && x >= 7 && x <= 24) { row += y === 25 ? 'B' : y === 26 ? 'b' : 'o'; continue; }
    if (y >= 28 && y <= 29 && x >= 10 && x <= 21) { row += 'o'; continue; }
    if (!inside) { row += '.'; continue; }
    const edge = (dx * 1.1) ** 2 + (dy * 1.08) ** 2 > 1;
    if (edge) { row += 'k'; continue; }
    const rib = y % 3 === 0;
    const core = Math.abs(dx) < 0.28 && Math.abs(dy) < 0.3;
    row += core ? 'c' : rib ? (dx < -0.2 ? 'h' : 'r') : dx < -0.35 ? 'l' : dx < 0.3 ? 'g' : 'd';
  }
  LENS.push(row);
}
const LENS_DARK = { k: 'iron', r: 'pane1', h: 'skyref2', l: 'pane1', g: 'pane0', d: 'deep', c: 'pane0', B: 'brass', b: 'brass', o: 'brass0' };
def('lens-dark', LENS_DARK, LENS, { w: 32, h: 32, kind: 'object' });
const shimmer = (f) => LENS.map((row, y) => (y % 3 === 0 && (Math.floor(y / 3) + f) % 4 === 0 ? row.replace(/r/g, 'h') : row));
def('lens-lit', { ...LENS_DARK, r: '!lhamber', h: '!lampcore', l: '!amber', g: '!lhamber', d: '!amber', c: '!lampcore' },
  [0, 1, 2, 3].map(shimmer), { w: 32, h: 32, kind: 'object', fps: 4 });

/* ---------------------------------------------------------------- fx sprites */
// Cottage / porch lamp light pool (screen-composited at night by the light pass): a 2-step dither.
def('light-pool', { a: '!amber', b: '!amber' }, [
  '................................',
  '..............b.b.b.b...........',
  '...........b.b.b.b.b.b.b........',
  '.........b.b.baaaaaab.b.b.......',
  '.......b.b.baaaaaaaaaab.b.b.....',
  '......b.b.aaaaaaaaaaaaaa.b.b....',
  '.....b.b.aaaaaaaaaaaaaaaa.b.b...',
  '.....b.b.aaaaaaaaaaaaaaaa.b.b...',
  '......b.b.aaaaaaaaaaaaaa.b.b....',
  '.......b.b.baaaaaaaaaab.b.b.....',
  '.........b.b.baaaaaab.b.b.......',
  '...........b.b.b.b.b.b.b........',
  '..............b.b.b.b...........',
  '................................',
  '................................',
  '................................',
], { w: 32, h: 16, kind: 'fx' });
// Fog band (64×16, 2-step dither; drawn scrolled at low alpha, capped at 35% by the weather pass).
def('fog-band', { v: 'st4', w: 'cream' }, [
  '................................................................',
  '........v.v.v.v.v.v.v.v.........................v.v.v.v.v.......',
  '....v.v.vvvvvvvvvvvvvvv.v.v.................v.v.vvvvvvvvv.v.v...',
  '..v.vvvvvvvvvvvwvvvvvvvvvvv.v.v...........v.vvvvvvvwvvvvvvvvv.v.',
  'v.vvvvvvvvwvvvvvvvvvvvvvvvvvvvv.v.v.....v.vvvvvvvvvvvvvvvvvvvvv.',
  '.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.v.v.vvvvvvvvvvvvvvvvvvwvvvvv',
  'vvvvvvvvvvvvvvvvvvvvvvwvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  '.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.',
  'v.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvwvvvvvvvvvvvvvvvvvvv.v',
  '.v.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.v.',
  '..v.v.vvvvvvvvvvvvvvvvvvvvvvvvv.v.vvvvvvvvvvvvvvvvvvvvvvvvv.v.v.',
  '....v.v.vvvvvvvvvvvvvvvvvvvvv.v.v...v.v.vvvvvvvvvvvvvvvvv.v.v...',
  '......v.v.v.vvvvvvvvvvvvv.v.v.........v.v.v.vvvvvvvvv.v.v.......',
  '..........v.v.v.v.v.v.v.v...............v.v.v.v.v.v.v...........',
  '................................................................',
  '................................................................',
], { w: 64, h: 16, kind: 'fx' });

export const LIGHTHOUSE_TILES = Object.freeze(tiles);
export default LIGHTHOUSE_TILES;

/**
 * Buildings: exterior walls (timber, timber cross-brace, brick, stone, painted shiplap), doors (plain,
 * porch hood, Spire arch), windows (unlit / lit, LUT-exempt glow), roofs in the eight roof colours
 * (ridge, body, eave, verge ends, dormers), string lights; and the interiors: the Keeper's Cottage by
 * tier (floors and walls 0-3, rug, hearth), stone floors, and the six Spires' floors and walls by theme
 * (Turn, Ward, Weather, Hollow, Relay, Mirror). [ART-TILES]
 *
 * Split from `proto/tiles/tiles.js`. New against the backlog's "houses have one massing": a porch hood
 * door, dormers per roof colour and a painted shiplap wall so streets stop repeating. Chimneys, the
 * scaffold and the lighthouse are props (`art/props.js`).
 * @module art/tiles/buildings
 */

import { ROOF_COLOURS } from '../palette.js';
import { createGroup, texture } from './kit.js';
import { blank, blit } from '../spriteUtil.js';

const { tiles, def } = createGroup('buildings');

/* ---------------------------------------------------------------- exterior walls */
const WP = { p: 'pl2', s: 'pl1', d: 'pl0', h: 'pl3', t: 'wd1', k: 'wd0', X: 'base' };
def('wall-timber', WP, [
  'tttttttttttttttt',
  'hppppppppppppppd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hssssssssssssssd',
  'XXXXXXXXXXXXXXXX',
]);
def('wall-timber-x', WP, [
  'tttttttttttttttt',
  'hppppppppppppppd',
  'htpppppppppppptd',
  'hptpppppppppptsd',
  'hpptpppppppptpsd',
  'hppptppppppptpsd',
  'hpppptppppptppsd',
  'hppppptppptpppsd',
  'hpppppptttppppsd',
  'hppppptppptpppsd',
  'hpppptppppptppsd',
  'hppptppppppptpsd',
  'hpptppppppppptsd',
  'hptppppppppppptd',
  'htsssssssssssstd',
  'XXXXXXXXXXXXXXXX',
]);
const BP = { b: 'br2', d: 'br1', k: 'br0', l: 'br3', m: 'pl1', t: 'wd1', x: 'base' };
def('wall-brick', BP, [
  'tttttttttttttttt',
  'lbbbdmlbbbdmlbbd',
  'bbbbdmbbbbdmbbbd',
  'mmmmmmmmmmmmmmmm',
  'bdmlbbbdmlbbbdml',
  'bdmbbbbdmbbbbdmb',
  'mmmmmmmmmmmmmmmm',
  'lbbbdmlbbbdmlbbd',
  'bbbbdmbbbbdmbbbd',
  'mmmmmmmmmmmmmmmm',
  'bdmlbbbdmlbbbdml',
  'bdmbbbbdmbbbbdmb',
  'mmmmmmmmmmmmmmmm',
  'lbbbdmlbbbdmlbbd',
  'bbbbdmbbbbdmbbbd',
  'xxxxxxxxxxxxxxxx',
]);
// Rubble stone (the Keeper's Cottage, Spire exteriors, Cairnhold): irregular lit-top stones in mortar.
const SWALL = [
  'tttttttttttttttt',
  'jlmmdjlmmmdjlmmd',
  'jmmmdjmmmmdjmmmd',
  'jddddjddddddjddd',
  'jjjjjjjjjjjjjjjj',
  'mdjlmmmmdjlmmdjl',
  'mdjmmmmmdjmmmdjm',
  'ddjdddddddjdddjd',
  'jjjjjjjjjjjjjjjj',
  'jlmmmdjlmmdjlmmm',
  'jmmmmdjmmmdjmmmm',
  'jddddddjdddjdddd',
  'jjjjjjjjjjjjjjjj',
  'mmdjlmmmmdjlmmmd',
  'dddjddddddjddddd',
  'xxxxxxxxxxxxxxxx',
];
def('wall-stone', { t: 'wd1', j: 'co1', l: 'st4', m: 'st3', d: 'st2', x: 'base' }, SWALL);
// Painted shiplap (stilt town, the quay sheds): overlapping weatherboards in harbor blue.
def('wall-shiplap', { t: 'wd1', h: 'wpb2', p: 'wpb1', d: 'wpb0', k: 'blue0', x: 'base', l: 'pl1' }, [
  'tttttttttttttttt',
  'hhhhhhhhhhhhhhhh',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'dddddddddddddddd',
  'hhhhhhhhhhhhhhhh',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'dddddddddddddddd',
  'hhhhhhhhhhhhhhhh',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'dddddddddddddddd',
  'hhhhhhhhhhhhhhhh',
  'kkkkkkkkkkkkkkkk',
  'xxxxxxxxxxxxxxxx',
]);

/* ---------------------------------------------------------------- doors */
const DOOR = [
  'tttttttttttttttt',
  'hppppppppppppppk',
  'hpppkkkkkkkkpppk',
  'hppkwwwwwwwwkppk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwbwkppk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwwwkppk',
  'hppkdwdwdwdwkppk',
  'hsskkkkkkkkkkssk',
  'XXXXXXXXXXXXXXXX',
];
const DOORP = { X: 'base', p: 'pl2', s: 'pl1', h: 'pl3', t: 'wd1', k: 'wd0', w: 'wd2', d: 'wd1', l: 'wd3', b: 'brass' };
def('door', DOORP, DOOR);
def('door-brick', { ...DOORP, p: 'br2', s: 'br1', h: 'br3' }, DOOR);
def('door-stone', { ...DOORP, p: 'st3', s: 'st2', h: 'st4', w: 'blue2', l: 'blue3', d: 'blue1' }, DOOR);
// Porch hood: the door under a small gabled canopy on two brackets, a stone step in front.
def('door-porch', { ...DOORP, r: 'slate2', q: 'slate1', e: 'slate3', i: 'base', c: 'pl1', g: 'wd0' }, [
  '......eeee......',
  '....eerrrrqq....',
  '..eerrrrrrrrqq..',
  '.iiiiiiiiiiiiii.',
  'hkkpkkkkkkkkpkkk',
  'hpkkwwwwwwwwkkpk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwlwwwwbwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwwwkppk',
  'hppkdwdwdwdwkppk',
  'hsskkkkkkkkkkssk',
  'XXcccccccccccXXX',
  '..gggggggggggg..',
]);
// Spire door: a round-arched door in dressed stone with iron studs.
def('door-arch', { X: 'base', j: 'co1', l: 'st4', m: 'st3', d: 'st2', k: 'wd0', w: 'wd1', v: 'wd2', i: 'iron', b: 'brass' }, [
  'jlmmmdjlmmmdjlmm',
  'jmmmmkkkkkkmmmmd',
  'jmmkkwvvvvwkkmmd',
  'jmkwvvvvvvvvwkmd',
  'jmkwvivvvvivwkmd',
  'jkwvvvvvvvvvvwkd',
  'jkwvvvvkvvvvvwkd',
  'jkwvivvkvvivvwkd',
  'jkwvvvvkvvvvbwkd',
  'jkwvvvvkvvvvvwkd',
  'jkwvivvkvvivvwkd',
  'jkwvvvvkvvvvvwkd',
  'jkwvvvvkvvvvvwkd',
  'jkwwwwwkwwwwwwkd',
  'jkkkkkkkkkkkkkkd',
  'XXXXXXXXXXXXXXXX',
]);

/* ---------------------------------------------------------------- windows */
// Windows (unlit / lit). Lit pane colours are LUT-exempt.
const WINROWS = [
  'tttttttttttttttt',
  'hppppppppppppppk',
  'hppphhhhhhhhpppk',
  'hpphaaaamaaaahpk',
  'hpphaaaamaaaahpk',
  'hpphabaamaaaahpk',
  'hpphmmmmmmmmmhpk',
  'hpphaaaamaaaahpk',
  'hpphaaaamaaaahpk',
  'hpphaaaamaaaahpk',
  'hppphhhhhhhhhspk',
  'hpppsssssssssspk',
  'hppppppppppppppk',
  'hppppppppppppppk',
  'hsssssssssssssss',
  'XXXXXXXXXXXXXXXX',
];
const UNLIT = { a: 'pane0', b: 'pane1', m: 'wd0' };
const LIT = { a: '!wglow', b: '!amber', m: 'wd0' };
const TIMBER_WIN = { X: 'base', p: 'pl2', s: 'pl1', h: 'pl3', t: 'wd1', k: 'wd0' };
def('window-unlit', { ...TIMBER_WIN, ...UNLIT }, WINROWS);
def('window-lit', { ...TIMBER_WIN, ...LIT }, WINROWS);
const BRICK_WIN = { X: 'base', p: 'br2', s: 'br1', h: 'pl1', t: 'wd1', k: 'br0' };
def('window-brick-unlit', { ...BRICK_WIN, ...UNLIT }, WINROWS);
def('window-brick-lit', { ...BRICK_WIN, ...LIT }, WINROWS);
const STONE_WIN = { X: 'base', p: 'st3', s: 'st2', h: 'st4', t: 'wd1', k: 'co1' };
def('window-stone-unlit', { ...STONE_WIN, ...UNLIT }, WINROWS);
def('window-stone-lit', { ...STONE_WIN, ...LIT }, WINROWS);
const SHIP_WIN = { X: 'base', p: 'wpb1', s: 'wpb0', h: 'pl3', t: 'wd1', k: 'blue0' };
def('window-shiplap-unlit', { ...SHIP_WIN, ...UNLIT }, WINROWS);
def('window-shiplap-lit', { ...SHIP_WIN, ...LIT }, WINROWS);
// Window box (spring onwards): the timber window with a planter of geraniums on the sill.
const WINBOX = blit(WINROWS, ['wwwwwwwwwww', 'rgrgrgrrgrg', 'kkkkkkkkkkk'], 3, 10);
def('window-box-unlit', { ...TIMBER_WIN, ...UNLIT, w: 'wd2', r: 'red3', g: 'grass2' }, WINBOX);
def('window-box-lit', { ...TIMBER_WIN, ...LIT, w: 'wd2', r: 'red3', g: 'grass2' }, WINBOX);

/* ---------------------------------------------------------------- roofs */
// Staggered shingle courses (lit nosing top-left, dark joint, shadow line under each course), one
// shape, eight palettes (GDD-00 §16).
const COURSE_A = ['lbbdlbbdlbbdlbbd', 'bbbdbbbdbbbdbbbd', 'ssssssssssssssss'];
const COURSE_B = ['bdlbbdlbbdlbbdlb', 'bdbbbdbbbdbbbdbb', 'ssssssssssssssss'];
const ROOF_BODY = [...COURSE_A, ...COURSE_B, ...COURSE_A, ...COURSE_B, ...COURSE_A, COURSE_B[0]];
const ROOF_RIDGE = ['................', '................', 'llllllllllllllll', 'dddddddddddddddd', ...COURSE_A, ...COURSE_B, ...COURSE_A, ...COURSE_B];
const ROOF_EAVE = [...COURSE_A, ...COURSE_B, ...COURSE_A, ...COURSE_B, COURSE_A[0], COURSE_A[1], 'kkkkkkkkkkkkkkkk', '................'];
// Dormer: a small window poking through the body with its own cap in the roof colour.
const DORMER = blit(ROOF_BODY, [
  '....kkkkkkkk....',
  '...kllllllllk...',
  '..klbbbbbbbbdk..',
  '..kkkkkkkkkkkk..',
  '...hppppppph....',
  '...hpaaaaaaph...',
  '...hpaeaaaaph...',
  '...hpaaaaaaph...',
  '...hpmmmmmmph...',
  '...hsssssssss...',
  '...kkkkkkkkkk...',
], 0, 2);

/*
 * Roof massing (polish backlog: "houses have one massing so streets repeat"). The roof autotile picks
 * ridge / eave and the -l / -r ends per cell, and each house wears one roof colour, so each colour
 * carries its own massing in its end and ridge pieces:
 *   slate, moss, teal: hipped ends (a lit / shaded hip face, a capped hip line); moss adds tufts,
 *     teal is standing-seam copper (vertical seams) instead of shingle courses;
 *   red: a front cross-gable at the left end (plastered gable, bargeboards, a round vent), gable verge right;
 *   blue: the same cross-gable at the right end;
 *   ochre, dark: gable verges with a wood bargeboard and a finial; dark adds ridge vents;
 *   straw (thatch): rounded eyebrow ends, a scalloped ridge roll and a ragged fringe at the eave.
 * Every end is drawn on the 16x32 ridge+eave pair (combined) and split back into the two cells.
 */
const ROOF_PAIR = [...ROOF_RIDGE, ...ROOF_EAVE];
const LIGHTER = { d: 's', s: 'b', b: 'l', l: 'l' };
const DARKER = { l: 'b', b: 's', s: 'd', d: 'd' };
/** @param {string[]} rows @param {number} x @param {number} y @param {string} ch */
const setPx = (rows, x, y, ch) => { if (y >= 0 && y < rows.length && x >= 0 && x < 16) rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const mirrorRows = (rows) => rows.map((r) => [...r].reverse().join(''));
/** Standing-seam copper: vertical seams every 4 px instead of staggered courses. */
const seamed = (rows) => rows.map((r, y) => [...r].map((ch, x) => (ch === '.' || ch === 'k' || y < 4 ? ch : x % 4 === 0 ? 'l' : x % 4 === 3 ? 'd' : y % 6 === 5 ? 's' : 'b')).join(''));
/** A hipped left end on a 32-row pair: silhouette cut back from the ridge end, lit hip face, capped hip line. */
function hipLeft(pair, { face = LIGHTER } = {}) {
  const r = pair.slice();
  for (let y = 2; y < 31; y++) {
    const sil = Math.max(0, Math.round(7 - (y - 2) * 0.7));     // back hip: the silhouette
    const hx = Math.round(7 - (y - 2) * (7 / 28));              // front hip line, ridge end to eave corner
    for (let x = 0; x < 16; x++) {
      const ch = r[y][x];
      if (ch === '.') continue;
      if (x < sil) setPx(r, x, y, '.');
      else if (x === sil && y < 30) setPx(r, x, y, 'k');
      else if (x < hx && ch !== 'k') setPx(r, x, y, face[ch] || ch);
      else if (x === hx && ch !== 'k') setPx(r, x, y, 'l');
      else if (x === hx + 1 && ch !== 'k') setPx(r, x, y, 'd');
    }
  }
  return r;
}
/** A gable verge on the left: wood bargeboard down the end, finial at the ridge, the eave overhang. */
function vergeLeft(pair) {
  const r = pair.slice();
  for (let y = 2; y < 31; y++) {
    if (r[y][0] === '.') continue;
    setPx(r, 0, y, 'k'); setPx(r, 1, y, y < 30 ? 'w' : 'k'); setPx(r, 2, y, y < 30 ? 'm' : r[y][2]);
  }
  setPx(r, 1, 1, 'k'); setPx(r, 1, 0, 'k'); setPx(r, 0, 1, 'k'); setPx(r, 2, 1, 'k'); setPx(r, 1, 2, 'w'); // finial
  return r;
}
/**
 * A front cross-gable on the left end: a plastered triangle under bargeboards. The whole gable sits in
 * the eave cell (apex on its top row) so it stays one piece on roofs taller than ridge + eave, where
 * the autotile puts plain body cells between the two ends (art-director pass: it used to split there).
 */
function crossGableLeft(pair) {
  const r = vergeLeft(pair);
  const ax = 8, ay = 17;
  for (let y = ay; y < 30; y++) {
    const half = Math.round((y - ay) * 0.42);
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - ax);
      if (d > half + 2) continue;
      if (d > half) setPx(r, x, y, d === half + 2 ? 'k' : 'w');          // bargeboard (2 px) under ink
      else if (d === half) setPx(r, x, y, 'm');                           // the board's shadow on the plaster
      else setPx(r, x, y, y > 27 ? 'q' : x < ax ? 'h' : 'p');            // plaster, lit left
    }
  }
  setPx(r, ax, ay - 1, 'k'); setPx(r, ax, ay, 'w'); // apex finial (eave cell, row 0)
  // round vent / attic window
  for (const [x, y, ch] of [[7, 23, 'k'], [8, 23, 'k'], [9, 23, 'k'], [6, 24, 'k'], [10, 24, 'k'], [6, 25, 'k'], [10, 25, 'k'], [7, 26, 'k'], [8, 26, 'k'], [9, 26, 'k'],
    [7, 24, 'a'], [8, 24, 'e'], [9, 24, 'a'], [7, 25, 'a'], [8, 25, 'a'], [9, 25, 'a'], [8, 27, 'm']]) setPx(r, x, y, ch);
  for (let x = 0; x < 16; x++) if (r[30][x] !== '.') setPx(r, x, 30, 'k');
  return r;
}
/** Thatch: rounded eyebrow end, ragged fringe below the eave line. */
function thatchLeft(pair) {
  const r = pair.slice();
  for (let y = 2; y < 31; y++) {
    const cut = y < 8 ? Math.round(5 - Math.sqrt(Math.max(0, 25 - (8 - y) * (8 - y) * 0.9))) + 1 : 0;
    for (let x = 0; x < cut; x++) setPx(r, x, y, '.');
    if (r[y][cut] && r[y][cut] !== '.') setPx(r, cut, y, 'k');
    if (r[y][cut + 1] && r[y][cut + 1] !== '.' && y < 29) setPx(r, cut + 1, y, 'l');
  }
  return r;
}
/** Thatch body/ridge texture: combed straw strokes, a scalloped ridge roll, a fringe on the eave. */
function thatchPair(pair) {
  const r = pair.map((row, y) => [...row].map((ch, x) => (ch === '.' || ch === 'k' || y < 4 ? ch : (x * 3 + y * 5) % 7 === 0 ? 'd' : (x + y * 2) % 5 === 0 ? 'l' : y % 4 === 3 ? 's' : 'b')).join(''));
  for (let x = 0; x < 16; x++) { setPx(r, x, 2, 'k'); setPx(r, x, 3, x % 4 === 1 ? 'k' : 'l'); setPx(r, x, 4, x % 4 === 1 ? 'd' : 'l'); setPx(r, x, 5, 'd'); }
  for (let x = 0; x < 16; x++) { setPx(r, x, 29, x % 3 === 0 ? 'd' : 's'); setPx(r, x, 30, x % 3 === 1 ? '.' : 'k'); setPx(r, x, 31, x % 3 === 2 ? 'k' : '.'); }
  return r;
}
/** Moss tufts on the courses (lit tops), sparse and stable. */
const mossy = (pair) => pair.map((row, y) => [...row].map((ch, x) => (ch === '.' || ch === 'k' || y < 5 || y > 28 ? ch : (x * 7 + y * 11) % 23 === 0 ? 'g' : (x * 7 + y * 11) % 23 === 1 ? 'G' : ch)).join(''));
/** Ridge vents for tar roofs: small capped pipes on the ridge line. */
function vented(pair) {
  const r = pair.slice();
  for (const [x, y, ch] of [[5, 0, 'k'], [6, 0, 'k'], [7, 0, 'k'], [4, 1, 'k'], [5, 1, 'l'], [6, 1, 'b'], [7, 1, 's'], [8, 1, 'k'], [5, 2, 'k'], [6, 2, 'd'], [7, 2, 'k']]) setPx(r, x, y, ch);
  return r;
}
const STYLE = {
  slate: { mid: (p) => p, left: hipLeft, right: hipLeft },
  moss: { mid: mossy, left: hipLeft, right: hipLeft },
  teal: { mid: seamed, left: hipLeft, right: hipLeft },
  red: { mid: (p) => p, left: crossGableLeft, right: vergeLeft },
  blue: { mid: (p) => p, left: vergeLeft, right: crossGableLeft },
  ochre: { mid: (p) => p, left: vergeLeft, right: vergeLeft },
  dark: { mid: (p) => p, ridgeMid: vented, left: vergeLeft, right: vergeLeft },
  straw: { mid: thatchPair, left: thatchLeft, right: thatchLeft },
};
const split = (pair) => [pair.slice(0, 16), pair.slice(16, 32)];
/** The left end of a body cell for an end treatment: hip face + hip line at x 4, or the verge board. */
function bodyEnd(rows, left, face = LIGHTER) {
  return rows.map((row) => [...row].map((ch, x) => {
    if (ch === '.') return ch;
    if (x === 0) return 'k';
    if (left === hipLeft) return x < 4 && ch !== 'k' ? (face[ch] || ch) : x === 4 && ch !== 'k' ? 'l' : x === 5 && ch !== 'k' ? 'd' : ch;
    if (left === thatchLeft) return x === 1 ? 'l' : ch;
    return x === 1 ? 'w' : x === 2 ? 'm' : ch;                       // verge / cross-gable: the bargeboard
  }).join(''));
}
for (const c of ROOF_COLOURS) {
  const pal = { k: 'ink', d: `${c}0`, s: `${c}1`, b: `${c}2`, l: `${c}3`, w: 'wd2', m: 'wd0', h: 'pl3', p: 'pl2', q: 'pl1', a: 'pane0', e: 'pane1', g: 'moss2', G: 'moss3' };
  const st = STYLE[c] || STYLE.slate;
  const mid = st.mid(ROOF_PAIR);
  const [ridge, eave] = split(mid);
  def(`roof-${c}-ridge`, pal, st.ridgeMid ? split(st.ridgeMid(mid))[0] : ridge);
  const body = c === 'teal' ? seamed(ROOF_BODY) : c === 'straw' ? thatchPair([...ROOF_BODY, ...ROOF_BODY]).slice(8, 24)
    : c === 'moss' ? mossy([...ROOF_BODY, ...ROOF_BODY]).slice(8, 24) : ROOF_BODY;
  def(`roof-${c}-body`, pal, body);
  def(`roof-${c}-eave`, pal, eave);
  const [rl, el] = split(st.left(mid));
  // the right end: the left treatment on the mirrored pair, shaded (it faces away from the light)
  const rightRaw = st.right === hipLeft ? hipLeft(mirrorRows(mid), { face: DARKER }) : st.right(mirrorRows(mid));
  const [rr, er] = split(mirrorRows(rightRaw));
  def(`roof-${c}-ridge-l`, pal, rl);
  def(`roof-${c}-eave-l`, pal, el);
  def(`roof-${c}-ridge-r`, pal, rr);
  def(`roof-${c}-eave-r`, pal, er);
  // body ends for roofs taller than ridge + eave (the hip line / bargeboard carried straight down);
  // they take effect once the roof autotile asks for `-body-l` / `-body-r` (it uses plain body today)
  const bl = bodyEnd(body, st.left);
  def(`roof-${c}-body-l`, pal, bl);
  def(`roof-${c}-body-r`, pal, mirrorRows(bodyEnd(mirrorRows(body), st.right, DARKER)));
  def(`roof-${c}-dormer`, { ...pal, h: 'pl3', p: 'pl2', a: 'pane0', e: 'pane1', m: 'wd0' }, DORMER);
  def(`roof-${c}-dormer-lit`, { ...pal, h: 'pl3', p: 'pl2', a: '!wglow', e: '!amber', m: 'wd0' }, DORMER);
}

/* ---------------------------------------------------------------- string lights */
// String lights (the Lantern Market, Porchlight Hours, the tool-ring item): a sagging cord with warm
// bulbs (LUT-exempt) that twinkle out of phase over two frames. Overlay; tiles east-west.
const CORD = [
  'k..............k',
  '.k............k.',
  '..kk........kk..',
  '....kkk..kkk....',
  '.......kk.......',
];
// bulb x, y (row under the cord); alternate bulbs swap bright / dim each frame
const BULBS = [[2, 3], [5, 5], [9, 6], [13, 3]];
const lights = (f) => BULBS.reduce((r, [x, y], i) => blit(r, (i + f) % 2 ? ['b', 'a'] : ['c', 'c'], x, y), blit(blank(16, 16), CORD, 0, 1));
def('string-lights', { k: 'iron', a: '!amber', b: '!lampcore', c: '!wglow' }, [lights(0), lights(1)], { kind: 'detail', fps: 2 });

/* ---------------------------------------------------------------- cottage interiors by tier */
// Tier 0: bare, gapped boards with one broken plank; tier 1: mended (paler patches); tier 2: waxed,
// warmer; tier 3: herringbone parquet.
// Long boards run east-west: 3px courses over a 1px gap, a butt joint on only some courses (staggered),
// grain flecks along each board, so a floor reads as planking and not as brick.
const BOARDS = [
  'llllllllllllllll',
  'pppppdpppppppppp',
  'pppppppppppdpppp',
  'kkkkkkkkkkkkkkkk',
  'lllllllllllkllll',
  'ppdpppppppppkppp',
  'pppppppdppppkppp',
  'kkkkkkkkkkkkkkkk',
  'llllllllllllllll',
  'ppppppppppdppppp',
  'pppdpppppppppppp',
  'kkkkkkkkkkkkkkkk',
  'lllklllllllllllll'.slice(0, 16),
  'pppkpppppdpppppp',
  'pppkpppppppppdpp',
  'kkkkkkkkkkkkkkkk',
];
def('floor-boards', { l: 'wd3', p: 'wd2', d: 'wd1', k: 'wd0' }, BOARDS);
// tier 0: weathered, gapped boards; a knot hole and one sprung board end (the cottage is a wreck)
def('cottage-floor-0', { l: 'ww3', p: 'ww2', d: 'ww1', k: 'ww0', g: 'ink' }, blit(BOARDS, ['kg', 'gk'], 6, 9));
// tier 1: mended and scrubbed: the same boards, sound and pale (a new board is a detail, not a repeat)
def('cottage-floor-1', { l: 'ww4', p: 'ww3', d: 'ww2', k: 'ww1' }, BOARDS);
def('cottage-floor-2', { l: 'wd4', p: 'wd3', d: 'wd2', k: 'wd1' }, BOARDS);
def('cottage-floor-3', { l: 'wd4', p: 'wd3', d: 'wd2', k: 'wd1', h: 'wd0' }, [
  'pphlpphlpphlpphl',
  'phlppphlpphlpphl'.slice(0, 16),
  'hlpphlpphlpphlpp',
  'lpphlpphlpphlpph',
  'dddkdddkdddkdddk',
  'kdddkdddkdddkddd',
  'pdkppdkppdkppdkp',
  'ppdkppdkppdkppdk',
  'pphlpphlpphlpphl',
  'phlpphlpphlpphlp',
  'hlpphlpphlpphlpp',
  'lpphlpphlpphlpph',
  'dddkdddkdddkdddk',
  'kdddkdddkdddkddd',
  'pdkppdkppdkppdkp',
  'ppdkppdkppdkppdk',
]);
// Walls: a face tile (skirting board at the foot) and a top tile (crown moulding) per tier.
const plaster = (base, marks) => texture(base, marks);
const SKIRT = ['kkkkkkkkkkkkkkkk', 'wwwwwwwwwwwwwwww', 'tttttttttttttttt'];
const CROWN = ['tttttttttttttttt', 'wwwwwwwwwwwwwwww', 'kkkkkkkkkkkkkkkk'];
const face = (rows) => [...rows.slice(0, 13), ...SKIRT];
const top = (rows) => [...CROWN, ...rows.slice(3)];
const WALL0 = plaster('p', [[['.dd', 'd..', 'd..'], 3, 3], [['ll', 'll', 'll', 'll'], 10, 5], [['d', '.d'], 12, 4], [['s', 's'], 6, 9], [['ss', 's.'], 1, 11]]);
const W0P = { p: 'pl1', d: 'pl0', l: 'wd1', s: 'pl0', k: 'wd0', w: 'wd1', t: 'wd0' };
def('cottage-wall-0', W0P, face(WALL0));
def('cottage-wall-0-top', W0P, top(WALL0));
const WALL1 = plaster('p', [[['h'], 3, 4], [['h'], 11, 8], [['s'], 7, 11], [['h'], 14, 2]]);
const W1P = { p: 'pl3', h: 'cream', s: 'pl2', k: 'wd0', w: 'wd2', t: 'wd1' };
def('cottage-wall-1', W1P, face(WALL1));
def('cottage-wall-1-top', W1P, top(WALL1));
const STRIPES = blank(16, 16).map((_, y) => 'pphpppbpphpppbpp'.slice(0, 16));
const W2P = { p: 'wpb1', h: 'wpb2', b: 'wpb0', k: 'wd0', w: 'wd2', t: 'wd1' };
def('cottage-wall-2', W2P, face(STRIPES));
def('cottage-wall-2-top', W2P, top(STRIPES));
const PAPER3 = texture('g', [[['h.', '.h'], 2, 2], [['h.', '.h'], 10, 2], [['h.', '.h'], 6, 7], [['h.', '.h'], 14, 7]]);
const WAINSCOT = ['kkkkkkkkkkkkkkkk', 'llllllllllllllll', 'lppppdlppppppdll', 'lppppdlppppppdll', 'lppppdlppppppdll', 'lddddddddddddddl', 'tttttttttttttttt'];
const W3P = { g: 'wpg1', h: 'wpg2', k: 'wd0', l: 'wd3', p: 'wd2', d: 'wd1', w: 'wd2', t: 'wd0' };
def('cottage-wall-3', W3P, [...PAPER3.slice(0, 9), ...WAINSCOT]);
def('cottage-wall-3-top', W3P, top(PAPER3));
// The unbuilt part of a growing interior (FE-22): a transparent tile, so the night the map renderer
// paints behind every map shows through, as round the other interiors.
def('interior-void', { k: 'ink' }, Array.from({ length: 16 }, () => '................'));
// Rug (tier 2+): a woven mat with a border and fringe; detail over any floor.
def('rug', { r: 'rug1', d: 'rug0', l: 'rug2', y: 'rug3', f: 'pl2' }, [
  '................',
  '.f.f.f.f.f.f.f..',
  'dddddddddddddddd',
  'dyyyyyyyyyyyyyyd',
  'dyrrrrrrrrrrrryd',
  'dyrllrrrrrrllryd',
  'dyrlrrryyrrrlryd',
  'dyrrrryddyrrrryd',
  'dyrrrryddyrrrryd',
  'dyrlrrryyrrrlryd',
  'dyrllrrrrrrllryd',
  'dyrrrrrrrrrrrryd',
  'dyyyyyyyyyyyyyyd',
  'dddddddddddddddd',
  '.f.f.f.f.f.f.f..',
  '................',
], { kind: 'detail' });
// Hearth (32×32): a stone fireplace with a real fire (LUT-exempt), a kettle hook and a warm hearthstone.
const HEARTH = [
  '................................',
  '................................',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '..klllllllllllllllllllllllllmk..',
  '..kmmmmmmmmmmmmmmmmmmmmmmmmmdk..',
  '..kddddddddddddddddddddddddddk..',
  '...kjjjjjjjjjjjjjjjjjjjjjjjjk...',
  '...klmmdjlmmmdjlmmdjlmmmdjlmk...',
  '...kmmmdjmmmmdjmmmdjmmmmdjmmk...',
  '...kjjjjkkkkkkkkkkkkkkkkjjjjk...',
  '...klmdkiiiiiiiiiiiiiiiikmdlk...',
  '...kmmdki..............ikmdmk...',
  '...kjjjki.......i......ikjjjk...',
  '...klmdki......iii.....ikmdlk...',
  '...kmmdki.....iiiii....ikmdmk...',
  '...kjjjki......iii.....ikjjjk...',
  '...klmdki..............ikmdlk...',
  '...kmmdki..............ikmdmk...',
  '...kjjjki..............ikjjjk...',
  '...klmdki..............ikmdlk...',
  '...kmmdki..............ikmdmk...',
  '...kjjjki..............ikjjjk...',
  '...klmdkibbbbbbbbbbbbbbikmdlk...',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '..khhhhhhhhhhhhhhhhhhhhhhhhhhk..',
  '..kggggggggggggggggggggggggggk..',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];
const FLAMES = [
  ['......y......', '.....yoy.....', '....yooy..y..', '..y.oroo.yoy.', '.yoyorroyoro.', '.orrorrrorro.', 'rrrrrrrrrrrrr'],
  ['.....y.......', '....yoy...y..', '....oooy.yoy.', '.y.yorooyoro.', 'yoyorrroorro.', 'orrorrrrorrr.', 'rrrrrrrrrrrrr'],
  ['.......y.....', '..y...yoy....', '.yoy.yooy....', '.yooyorooy...', '.orroorrroyo.', 'rorrrrrrrrro.', 'rrrrrrrrrrrrr'],
];
def('hearth', { k: 'base', l: 'st4', m: 'st3', d: 'st2', j: 'co1', i: 'iron', b: 'vo1', h: 'cl4', g: 'cl3', r: '!fire0', o: '!fire1', y: '!fire2' },
  FLAMES.map((fl) => blit(HEARTH, fl, 9, 15)), { w: 32, h: 32, kind: 'object', fps: 6 });
// Stone floor (the lighthouse stair, the Archive cellar, Spire landings).
def('floor-stone', { j: 'co1', l: 'co4', m: 'co3', d: 'co2' }, [
  'jlmmmmmdjlmmmmmd',
  'jmmmmmmdjmmmmmmd',
  'jmmmmmmdjmmmmmmd',
  'jdddddddjddddddd',
  'jjjjjjjjjjjjjjjj',
  'mmmdjlmmmmmmdjlm',
  'mmmdjmmmmmmmdjmm',
  'mmmdjmmmmmmmdjmm',
  'dddddjdddddddjdd',
  'jjjjjjjjjjjjjjjj',
  'jlmmmmmdjlmmmmmd',
  'jmmmmmmdjmmmmmmd',
  'jmmmmmmdjmmmmmmd',
  'jdddddddjddddddd',
  'jjjjjjjjjjjjjjjj',
  'mmmdjlmmmmmmdjlm',
]);

/* ---------------------------------------------------------------- furniture & fittings (map lane requests) */
// Opaque single cells so they read in either the ground or the detail layer: furniture sits on boards,
// wall fittings on plaster.
const FLOOR_UNDER = { l: 'wd3', p: 'wd2', d: 'wd1', k: 'wd0' };
// Shop counter (Pell's, the post office): a panelled front with a lit top board and a brass bell.
def('counter', { ...FLOOR_UNDER, t: 'wd4', m: 'wd1', b: 'brass', o: 'brass0', x: 'base' }, [
  '.......bb.......'.replace(/\./g, 't'),
  'tttttttobttttttt',
  'llllllllllllllll',
  'kkkkkkkkkkkkkkkk',
  'kpppppkpppppkppk',
  'kplllpkplllpkplk',
  'kpl.dpkpl.dpkpl.'.replace(/\./g, 'p'),
  'kpldppkpldppkpld'.slice(0, 16),
  'kpddppkpddppkpdd',
  'kppppdkppppdkppd',
  'kpppppkpppppkppp',
  'kpldppkpldppkpld',
  'kpppppkpppppkppp',
  'kddddddddddddddd',
  'xxxxxxxxxxxxxxxx',
  'kkkkkkkkkkkkkkkk',
]);
// Wall shelf: two boards of jars and tins against plaster.
def('shelf', { w: 'pl2', s: 'pl1', h: 'pl3', k: 'wd0', p: 'wd2', l: 'wd3', r: 'red2', g: 'grass2', b: 'blue2', y: 'pear', c: 'st3', e: 'pane1' }, [
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wbbwrrwwyywcwwgw',
  'wbbwrrwyyywcwggw',
  'webwrrwyyywcwggw',
  'llllllllllllllll',
  'pppppppppppppppp',
  'kskssssssssssksk',
  'wwwwwwwwwwwwwwww',
  'wcwwggwbwwrrwyyw',
  'wcwggggbbwrrwyyw',
  'wcwggggbbwrrwyyw',
  'llllllllllllllll',
  'pppppppppppppppp',
  'kskssssssssssksk',
  'wwwwwwwwwwwwwwww',
]);
// Table: a round-topped kitchen table with a cloth runner and a cup, on boards.
def('table', { ...FLOOR_UNDER, t: 'wd3', h: 'wd4', m: 'wd1', c: 'pl3', r: 'red2', x: 'base', s: 'shadow', u: 'pl2' }, [
  'llllllllllllllll',
  'pppppppppppppppp',
  'kkhhhhhhhhhhhhkk',
  'khttttccttttttmk',
  'khttttccttuuttmk',
  'khttttccttuuttmk',
  'khttttccttttttmk',
  'khttttrrttttttmk',
  'kmmmmmmmmmmmmmmk',
  'kxxxxxxxxxxxxxxk',
  'pkmkppppppppkmkp',
  'pkmkppppppppkmkp',
  'pkmkppppppppkmkp',
  'kkkkkkkkkkkkkkkk',
  'llllllllllllllll',
  'pppppppppppppppp',
]);
// Bed (a cot, one cell): pillow at the head, quilt in wax red with a cream turn-down, on boards.
def('bed', { ...FLOOR_UNDER, f: 'wd1', c: 'pl3', u: 'pl2', r: 'rug1', q: 'rug0', y: 'rug3', x: 'base' }, [
  'kfffffffffffffkk',
  'kfccccccccccccfk',
  'kfcuuuuuuuuuucfk',
  'kfcuuuuuuuuuucfk',
  'kfccccccccccccfk',
  'kfcccccccccccc fk'.replace(' ', '').slice(0, 16),
  'kfrrrrrrrrrrrrfk',
  'kfryrryrryrrrrfk',
  'kfrrrrrrrrrrrrfk',
  'kfrryrrryrrryrfk',
  'kfrrrrrrrrrrrrfk',
  'kfqqqqqqqqqqqqfk',
  'kffffffffffffffk',
  'kxxxxxxxxxxxxxxk',
  'llllllllllllllll',
  'pppppppppppppppp',
]);
// Stairs up (interior): treads climbing away from the viewer, lit nosings, a rail on the right.
def('stairs-up', { k: 'wd0', d: 'wd1', p: 'wd2', l: 'wd3', h: 'wd4', i: 'iron' }, [
  'kdddddddddddddki',
  'kllllllllllllkki',
  'kdddddddddddddki',
  'kppppppppppppkki',
  'khhhhhhhhhhhhhki',
  'kddddddddddddkki',
  'kppppppppppppkki',
  'khhhhhhhhhhhhhki',
  'kddddddddddddkki',
  'kppppppppppppkki',
  'khhhhhhhhhhhhhki',
  'kddddddddddddkki',
  'kppppppppppppkki',
  'khhhhhhhhhhhhhki',
  'kppppppppppppkki',
  'kkkkkkkkkkkkkkki',
]);
// Stairs down: a dark well with the first treads dropping away under a lit floor edge.
def('stairs-down', { k: 'wd0', d: 'wd1', p: 'wd2', l: 'wd3', i: 'ink', h: 'wd4' }, [
  'llllllllllllllll',
  'kkkkkkkkkkkkkkkk',
  'khhhhhhhhhhhhhhk',
  'kppppppppppppppk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
  'kllllllllllllllk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
  'kppppppppppppppk',
  'kiiiiiiiiiiiiiik',
  'kiiiiiiiiiiiiiik',
  'kiiiiiiiiiiiiiik',
  'kiiiiiiiiiiiiiik',
  'kiiiiiiiiiiiiiik',
  'kkkkkkkkkkkkkkkk',
]);
// Barnaby's string wall (the Archive): a cork board of pinned notes joined by red string.
def('string-wall', { c: 'pa1', d: 'pa0', l: 'pa2', n: 'pl3', u: 'pl1', r: 'red2', b: 'brass', k: 'wd0' }, [
  'kkkkkkkkkkkkkkkk',
  'kcclcccdccclcccd',
  'kcnnnbccccccccck',
  'kcnuncrrrcnnnbck',
  'kcnnnrcccrnunnck',
  'kccrrcccccrnnnck',
  'kcrccdcccccrcccd',
  'kcrcccnnnbcrcccc',
  'kcrcccnuncrcccck',
  'kccrrrnnnrcccdck',
  'kcccccrrrccnnbck',
  'kcnnbcccccrnunck',
  'kcnunrrrrrrnnnck',
  'kcnnncccccccccck',
  'kccdcccclcccdcck',
  'kkkkkkkkkkkkkkkk',
]);

/* ---------------------------------------------------------------- Spire interiors (6 themes) */
// Each Spire: a floor and a wall face in its theme. Turn (Lowmoor, tides: teal wave tiles + brass),
// Ward (Cairnhold: granite flags carved with ward rings), Weather (Emberstep: basalt with ember grout),
// Hollow (Drownwood: dark planks, moss in the joints), Relay (Thistlewind: two-tone checker, no-repeat
// rounds), Mirror (Rimeholt: polished ice tiles with frost borders).
const SPIRE_FLOORS = {
  turn: [{ j: 'brass0', t: 'teal1', w: 'teal2', h: 'teal3', b: 'brass' }, [
    'jttttttjjttttttj', 'twwwhhwtthwwwwht', 'twhhwwwtthhwwwwt', 'twwwwwwtttwwhhwt', 'thwwwhhttwwhhwwt', 'twwhhwwttwhwwwwt', 'ttwwwwttttwwwwtt', 'jttttttjjttttttj',
    'jttttttjjttttttj', 'thwwwwbttwwhhwwt', 'twwhhwwttwhwwwwt', 'twhwwwwtthwwwhwt', 'twwwwhwttwwhwwwt', 'thhwwwwttwwwwhht', 'ttwwwwttttwwwwtt', 'jttttttjjttttttj']],
  ward: [{ j: 'st1', m: 'st3', l: 'st4', d: 'st2', r: 'moss2', c: 'st1' }, [
    'jlmmmmmmmmmmmmdj', 'lmmmmccccccmmmmd', 'mmmccmmmmmmccmmd', 'mmcmmmmmmmmmmcmd', 'mcmmmmmmmmmmmmcd', 'mcmmmmrmmmmmmmcd', 'cmmmmmmmmmmmmmmc', 'cmmmmmmmmmmrmmmc',
    'cmmmmmmmmmmmmmmc', 'cmmmmmmmmmmmmmmc', 'mcmmmmmmmmmmmmcd', 'mcmmmmmmmmmmmmcd', 'mmcmmmmmmmmmmcmd', 'mmmccmmmmmmccmmd', 'dmmmmccccccmmmdd', 'jdddddddddddddjj']],
  weather: [{ j: 'br0', m: 'vo2', l: 'vo3', d: 'vo1', r: 'br1' }, [
    'jjjjjjjjjjjjjjjj', 'jlllmmmdjlllmmdj', 'jlmmmmmdjlmmmmdj', 'jlmmmmmdjlmmmmdj', 'jlmmmmmdjlmmmmdj', 'jdddddddjddddddj', 'jjjjrjjjjjjjrjjj', 'jlmmmdjlllmmmmdj',
    'jlmmmdjlmmmmmmdj', 'jlmmmdjlmmmmmmdj', 'jlmmmdjlmmmmmmdj', 'jddddjjddddddddj', 'jjjjjjjjjjjjjjjj', 'jlllmmmdjlllmmdj', 'jlmmmmmdjlmmmmdj', 'jdddddddjddddddj']],
  hollow: [{ k: 'mg0', d: 'mg1', m: 'mg2', l: 'ww3', g: 'mgl2', h: 'mgl3' }, [
    'lllllllllllklllll'.slice(0, 16), 'mmmmmmmmmmmkmmmm', 'mmmdmmmmmmmkmmdm', 'kkgkkkkkkkhkkkkk', 'lllklllllllllllk', 'mmmkmmmmmmdmmmmk', 'mmmkmmmmmmmmmmmk', 'kkkkkkgkkkkkkgkk',
    'lllllllllkllllll', 'mmdmmmmmmkmmmmmm', 'mmmmmmmmmkmmmdmm', 'kkkkhkkkkkkkkkkk', 'llllllklllllllll', 'mmmmmmkmmmmmmdmm', 'mmmdmmkmmmmmmmmm', 'kgkkkkkkkkkgkkkk']],
  relay: [{ a: 'wd3', b: 'wd2', c: 'he2', d: 'he1', k: 'wd0' }, [
    'aaaaaaabccccccck', 'abbbbbbbcddddddk', 'abbbbbbbcddddddk', 'abbbbbbbcddddddk', 'abbbbbbbcddddddk', 'abbbbbbbcddddddk', 'abbbbbbbcddddddk', 'bbbbbbbbkkkkkkkk',
    'cccccccbaaaaaaak', 'cddddddkabbbbbbk', 'cddddddkabbbbbbk', 'cddddddkabbbbbbk', 'cddddddkabbbbbbk', 'cddddddkabbbbbbk', 'cddddddkabbbbbbk', 'kkkkkkkkbbbbbbbk']],
  mirror: [{ f: 'snow2', i: 'ice1', l: 'ice2', h: 'ice3', d: 'ice0' }, [
    'ffffffffffffffff', 'fhllllllfhlllllf', 'fliiiiilflillilf', 'fliliiiiflliiiif', 'fliiiiiifliiiiif', 'fliiiiliflliiiif', 'fliiiiiifliiiiif', 'ffffffffffffffff',
    'ffffffffffffffff', 'fhlllllfhllllllf', 'fliiiilfliiiiiif', 'flliiiiflliiiiif', 'fliiiiiifliiiilf', 'fliiliiifliiiiif', 'fliiiiiifliiliif', 'ffffffffffffffff']],
};
const SPIRE_ACCENT = { turn: ['teal2', 'brass'], ward: ['moss2', 'st4'], weather: ['br2', 'marigold'], hollow: ['mgl2', 'ww3'], relay: ['he2', 'wd3'], mirror: ['ice2', 'snow3'] };
const SPIRE_WALL = [
  'kkkkkkkkkkkkkkkk',
  'hhhhhhhhhhhhhhhh',
  'aaaaaaaaaaaaaaaa',
  'abaabaabaabaabaa',
  'aaaaaaaaaaaaaaaa',
  'kkkkkkkkkkkkkkkk',
  'jlmmmmdjlmmmmmdj',
  'jmmmmmdjmmmmmmdj',
  'jdddddddjddddddj',
  'jjjjjjjjjjjjjjjj',
  'mmdjlmmmmmdjlmmm',
  'mmdjmmmmmmdjmmmm',
  'ddddjdddddddjddd',
  'jjjjjjjjjjjjjjjj',
  'xxxxxxxxxxxxxxxx',
  'ssssssssssssssss',
];
for (const [theme, [pal, rows]] of Object.entries(SPIRE_FLOORS)) {
  def(`spire-floor-${theme}`, pal, rows);
  const [a, b] = SPIRE_ACCENT[theme];
  def(`spire-wall-${theme}`, { k: 'base', h: 'st4', a, b, j: 'co1', l: 'st4', m: 'st3', d: 'st2', x: 'base', s: 'co0' }, SPIRE_WALL);
}
// The leader's dais edge: two shallow steps up, lit nosings (one-way like a ledge, both directions here).
def('spire-dais', { k: 'base', l: 'st4', m: 'st3', d: 'st2', b: 'brass' }, [
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'bbbbbbbbbbbbbbbb',
  'llllllllllllllll',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  'mmmmmmmmmmmmmmmm',
  'llllllllllllllll',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  ...blank(16, 4),
], { kind: 'edge' });

export const BUILDINGS_TILES = Object.freeze(tiles);
export default BUILDINGS_TILES;

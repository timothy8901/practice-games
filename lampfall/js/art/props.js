/**
 * Props: multi-tile and stateful art placed on maps or used by scenes (ARCHITECTURE §1). [ART-TILES]
 *
 * - Boats: the rowboat, Maud's ring-line punt (lantern lit / dark), Ansel's beached launch.
 * - Lamps: the porch lamp post (lit / unlit), the wall porch lamp, the brazier (the Keepers' old fire on
 *   Shardcrown; burning / cold).
 * - Signs: finger post, the Commons board, a hanging shop sign, the tide chalkboard, the post box.
 * - Scaffold stages 0-7 and the lighthouse with dark / lit lamp at every stage (`lighthouse`, frame =
 *   stage, variant `'lit'`); the scaffold on its own (`scaffold`, frame = stage) for the Dawn Build.
 *   Lamps, the punt and the porch lamp take variant `'lit'`; the brazier takes `'cold'`.
 * - Roof colours ×8 (`roof-swatch`, variant = colour name in `palette.ROOF_COLOURS`) for the Payment Ceremony.
 * - Chimneys (brick, stone, tin stovepipe), market stalls (three awnings), the windmill (turning
 *   sails), a bench, the Summit Bell.
 *
 * Every prop is `{id, kind: 'prop', w, h, frames, pal, fps, variants?}`; anchor = its bottom-left tile.
 * {@link houseLayout} assembles a house from tiles (walls, windows, door, roof, chimney), the pure half
 * of the prototype's `expandHouse`, so the map and render lanes share one recipe.
 *
 * Pure: no DOM.
 * @module art/props
 */

import { ROOF_COLOURS } from './palette.js';
import { createGroup, TILE } from './tiles/kit.js';
import { blank, blit } from './spriteUtil.js';
import { LIGHTHOUSE_TILES, SCAFFOLD_BASE_ROW, SCAFFOLD_SECTION_ROWS, SCAFFOLD_SECTIONS } from './tiles/lighthouse.js';

const { tiles: props, def } = createGroup('props');
const P = (id, pal, frames, opts) => def(id, pal, frames, { kind: 'prop', ...opts });

/* ---------------------------------------------------------------- boats */
// Rowboat moored beside the pier (32×16; the renderer bobs it 1px): square transom at the stern (left),
// a pointed bow (right), lit gunwale, recessed hull floor in shade, two thwarts, the red strake along
// the south side, and its shadow on the water.
P('boat', { k: 'wd0', d: 'wd1', p: 'wd2', q: 'wd1', w: 'wd3', l: 'wd4', t: 'wd4', r: 'red2', e: 'red1', s: 'deep0' }, [
  '................................',
  '................................',
  '...kkkkkkkkkkkkkkkkkkkkk........',
  '...kllllllllllllllllllllkkk.....',
  '...klddddtkddddddtkdddddlllkk...',
  '...klpppptdpppppptdpppppdddllk..',
  '...klpppptdpppppptdppppppppdlk..',
  '...kwpqqqtdqqqqpqtdqpqqqqpqwwk..',
  '...kwpppptdpppppptdpppppwwwkk...',
  '...kwwwwwwwwwwwwwwwwwwwwkkk.....',
  '...krrrrrrrrrrrrrrrrrrrrrrkk....',
  '...keeeeeeeeeeeeeeeeeeeeekks....',
  '...kkkkkkkkkkkkkkkkkkkkkkss.....',
  '....sssssssssssssssssssssss.....',
  '......s.s.s.s.s.s.s.s.s.s.......',
  '................................',
], { w: 32, h: 16 });
// Maud's punt (48×16): a long flat-bottomed ring-line punt, blue strake, a pole laid along the thwarts
// and a lantern on its post at the stern (lit after dusk, LUT-exempt).
const PUNT = [
  '......k.........................................',
  '.....kak........................................',
  '.....kyk........................................',
  '.....kkk........................................',
  '..kkkkikkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.....',
  '..klllillllllllllllllllllllllllllllllllllllkk...',
  '..kldddiddtkdddddddddtkdddddddddtkddddddddllk...',
  '..klpppipptdppppppppptdpppppppppptdpppppppdlk...',
  '..klpoooooooooooooooooooooooooooooooooopppdlk...',
  '..kwpppppptdppppppppptdpppppppppptdppppppwwk....',
  '..kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkk.....',
  '..kbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkk....',
  '..knnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnks....',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkss.....',
  '...ssssssssssssssssssssssssssssssssssssss.......',
  '.....s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.s.s........',
];
const PUNTP = { k: 'wd0', d: 'wd1', p: 'wd2', w: 'wd3', l: 'wd4', t: 'wd4', o: 'wd1', b: 'blue2', n: 'blue1', s: 'deep0', i: 'iron' };
P('punt', { ...PUNTP, a: 'pane1', y: 'pane0' }, PUNT, { w: 48, h: 16, variants: { lit: { pal: { a: '!amber', y: '!lampcore' } } } });
// Ansel's beached launch (32×24): a small motor launch heeled on the sand, a wheelhouse with two
// windows, white hull with flaking paint over a red boot-top, bow to the east, the propeller shaft
// showing under the stern. Blocking; base and cast shadow.
P('launch-beached', { k: 'base', d: 'wd0', m: 'wd1', w: 'pl2', h: 'pl3', l: 'pl1', g: 'pane0', e: 'pane1', r: 'red1', q: 'red2', i: 'iron', s: 'shadow', y: 'sand0' }, [
  '................................',
  '................................',
  '................................',
  '.........kkkkkkkk...............',
  '.........kmmmmmmmk..............',
  '........kddddddddk..............',
  '........khhhhhhhlk..............',
  '........khgehgehlk..............',
  '........khgghgghlk..............',
  '........khhhhhhhlk..............',
  '...kkkkkkkkkkkkkkkkkkkkkkkk.....',
  '..kmmmmmmmmmmmmmmmmmmmmmmmmkk...',
  '..khhhhhhhhhhhhhhhhhhhhhhhhhhkk.',
  '..khwwwwwwwmwwwwwwwwwwwwwwwwwlk.',
  '..khwwwwwwwwwwwwwwwmwwwwwwwwlk..',
  '..khwwmwwwwwwwwwwwwwwwwwwwwlk...',
  '..kqqqqqqqqqqqqqqqqqqqqqqqqk....',
  '..krrrrrrrrrrrrrrrrrrrrrrrk.....',
  '.ikkkkkkkkkkkkkkkkkkkkkkkk......',
  'iik.yyyyyyyyyyyyyyyyyyyyyyss....',
  '.....sssssssssssssssssssssss....',
  '.......sssssssssssssssssss......',
  '................................',
  '................................',
], { w: 32, h: 24 });

/* ---------------------------------------------------------------- lamps */
// Porch lamp on a post (16×24, rises above its tile); unlit / lit.
const LAMP = [
  '......kkkk......',
  '.....kggggk.....',
  '.....kgaaGk.....',
  '.....kgaaak.....',
  '.....kgaaak.....',
  '.....kkkkkk.....',
  ...Array(14).fill('.......pp.......'),
  '......xppx......',
  '.....xxppxx.....',
  '.....xxxxxx.....',
  '................',
];
const LIT_LAMP = { pal: { g: '!amber', a: '!lampcore', G: '!amber' } };
P('lamp-post', { k: 'iron', g: 'pane1', a: 'pane0', G: 'pane1', p: 'wd1', x: 'wd0' }, LAMP, { w: 16, h: 24, variants: { lit: LIT_LAMP } });
// Wall porch lamp (16×16 overlay beside a door): a bracket lantern; the porchlight itself.
const WALL_LAMP = [
  '................',
  '.......kk.......',
  '......kiik......',
  '.....kkkkkk.....',
  '.....kgaaGk.....',
  '.....kgaaak.....',
  '.....kgaaak.....',
  '.....kkkkkk.....',
  '......kiik......',
  '..kkkkkkk.......',
  '...k............',
  '................',
  '................',
  '................',
  '................',
  '................',
];
P('porch-lamp', { k: 'iron', i: 'iron2', g: 'pane1', a: 'pane0', G: 'pane1' }, WALL_LAMP, { variants: { lit: LIT_LAMP } });
// Brazier (16×24): an iron fire basket on a tripod. Burning (real flame, LUT-exempt, 3 frames) / cold.
const BRAZIER = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '..kijijijijijk..',
  '...kiiiiiiiik...',
  '....kkkkkkkk....',
  '......kiik......',
  '.....ki..ik.....',
  '.....ki..ik.....',
  '....ki....ik....',
  '....ki....ik....',
  '...ki......ik...',
  '...ki......ik...',
  '..ki........ik..',
  '..kk........kk..',
  '..ss........ss..',
  '................',
  '................',
  '................',
];
const FIRE = [
  ['.....y....', '....yoy.y.', '..y.ooyoy.', '.yoyoroyoy', '.ororrroro', 'rrrrrrrrrr'],
  ['......y...', '.y..yoy...', '.yoyooy.y.', '.oooyroyoy', 'oorrrrooro', 'rrrrrrrrrr'],
  ['....y.....', '...yoy..y.', '.y.yoo.yoy', 'yoyorrooro', '.orrrrrror', 'rrrrrrrrrr'],
];
const BRAZP = { k: 'base', i: 'iron', j: 'iron2', s: 'shadow', r: '!fire0', o: '!fire1', y: '!fire2' };
P('brazier', BRAZP, FIRE.map((f) => blit(BRAZIER, f, 3, 2)), { w: 16, h: 24, fps: 8, variants: { cold: [blit(BRAZIER, ['jjjjjjjjjj'], 3, 7)] } });

/* ---------------------------------------------------------------- signs */
// Finger post (16×24): two arms, carved letters suggested by dark ticks; base and shadow.
P('signpost', { k: 'base', d: 'wd0', m: 'wd1', p: 'wd2', l: 'wd3', h: 'wd4', s: 'shadow' }, [
  '................',
  '................',
  '.......kk.......',
  '..kkkkkllkkkkk..',
  '.kllllllllllllk.',
  'klpdpdppdpppppk.',
  '.kppppppppppppk.',
  '..kkkkkllkkkkk..',
  '..kkkkkllkkkkk..',
  '.kllllllllllllk.',
  '.kpppppdpdpdpplk',
  '.kppppppppppppk.',
  '..kkkkkllkkkkk..',
  '.......lm.......',
  '.......lm.......',
  '.......lm.......',
  '.......lm.......',
  '.......lm.......',
  '.......lm.......',
  '.......lm.......',
  '......klmks.....',
  '......kkkkss....',
  '.......ssss.....',
  '................',
], { w: 16, h: 24 });
// The Commons board (32×32): a roofed notice board on two posts, ledger slips and a wax-sealed notice.
P('commons-board', { k: 'base', d: 'wd0', m: 'wd1', p: 'wd2', l: 'wd3', r: 'slate2', q: 'slate1', e: 'slate3', c: 'pl3', u: 'pl1', w: 'br2', t: 'ink', s: 'shadow' }, [
  '................................',
  '................................',
  '..........eeeeeeeeeeee..........',
  '......eeeerrrrrrrrrrrrqqqq......',
  '...eeerrrrrrrrrrrrrrrrrrrrqqq...',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '...kmlllllllllllllllllllllllmk..',
  '...kmdddddddddddddddddddddddmk..',
  '...kmdccccccdddccccccccdddddmk..',
  '...kmdctttccdddcttttttcdcccdmk..',
  '...kmdcccccc.ddcccccccc.cttdmk..',
  '...kmdctttccdddctttcccdcccdmk...'.slice(0, 30) + 'k.',
  '...kmdcccccwddducccccccdctcdmk..',
  '...kmdddddwwwdducccccccdcccdmk..',
  '...kmdcccccwdddddddddddddddmk...'.slice(0, 30) + '..',
  '...kmdctttcddccccccccccdddddmk..',
  '...kmdcccccddcttttttttcddccdmk..',
  '...kmdctttcddcccccccccdddctdmk..',
  '...kmdcccccddcttttccccdddccdmk..',
  '...kmdddddddddddddddddddddddmk..',
  '...kmlllllllllllllllllllllllmk..',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '.....klm..............klm.......',
  '.....klm..............klm.......',
  '.....klm..............klm.......',
  '.....klm..............klm.......',
  '.....klm..............klm.......',
  '.....klm..............klm.......',
  '....kklmks...........kklmks.....',
  '....kkkkkss..........kkkkkss....',
  '.....sssss............sssss.....',
  '................................',
].map((r) => (r.length > 32 ? r.slice(0, 32) : r.padEnd(32, '.'))), { w: 32, h: 32 });
// Hanging shop sign (16×16 overlay, from a wall bracket): Pell's Sundries magpie mark suggested.
P('shop-sign', { k: 'iron', d: 'wd0', p: 'wd2', l: 'wd3', b: 'brass', w: 'pl3', i: 'uiink' }, [
  '................',
  'kkkkkkkkkkkkk...',
  '..k.......k.....',
  '..k.......k.....',
  '.kdddddddddk....',
  '.kdllllllldk....',
  '.kdlppiipldk....',
  '.kdlpiwiipdk....',
  '.kdlpiiiipdk....',
  '.kdlppiibpdk....',
  '.kdlppppppdk....',
  '.kdbbbbbbbdk....',
  '.kdddddddddk....',
  '..kkkkkkkkk.....',
  '................',
  '................',
]);
// Tide chalkboard (16×16): an A-frame slate by each Waystone with the next lows chalked as wave lines.
P('tide-chalkboard', { k: 'base', d: 'wd0', p: 'wd2', g: 'dark1', c: 'pl2', s: 'shadow' }, [
  '................',
  '................',
  '...kkkkkkkkkk...',
  '..kpppppppppppk.'.slice(0, 16),
  '..kpggggggggpk..',
  '..kpgccgcccgpk..',
  '..kpgggggggg pk.'.replace(' ', 'g').slice(0, 16),
  '..kpgcgcgcgcpk..',
  '..kpggcgcgcgpk..',
  '..kpggggggggpk..',
  '..kpgcccggccpk..',
  '..kppppppppppk..',
  '..kdk......kdk..',
  '..kdk......kdks.',
  '..kkk......kkkss',
  '...ss.......sss.',
].map((r) => r.padEnd(16, '.').slice(0, 16)));
// Post box (16×24): a red pillar box with a cap, slot and brass plate.
P('post-box', { k: 'base', r: 'red2', q: 'red1', e: 'red3', d: 'red0', i: 'uiink', b: 'brass', s: 'shadow' }, [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kreeeerk....',
  '...krerrrrrqk...',
  '...kdddddddddk..'.slice(0, 16),
  '...kerrrrrrqk...',
  '...kerkiiikqk...',
  '...kerrrrrrqk...',
  '...kerrbbrrqk...',
  '...kerrbbrrqk...',
  '...kerrrrrrqk...',
  '...kerrrrrrqk...',
  '...kerrrrrrqk...',
  '...kerrrrrrqk...',
  '...kerrrrrrqk...',
  '...kerrrrrrqk...',
  '...kddddddddk...',
  '..kkkkkkkkkkks..',
  '..kkkkkkkkkkkss.',
  '....sssssssss...',
  '................',
  '................',
].map((r) => r.padEnd(16, '.').slice(0, 16)), { w: 16, h: 24 });

/* ---------------------------------------------------------------- the lighthouse and scaffold stages */
const TOWER_DARK = LIGHTHOUSE_TILES['lighthouse-dark'];
const TOWER_LIT = LIGHTHOUSE_TILES['lighthouse-lit'];
const SCAFFOLD = LIGHTHOUSE_TILES['lighthouse-scaffold'];
/** Rows of the scaffold built to `stage` (0..7): stage 0 is a timber stack at the foot. */
function scaffoldRows(stage) {
  const rows = blank(32, 80);
  const src = SCAFFOLD.frames[0];
  const n = Math.max(0, Math.min(SCAFFOLD_SECTIONS, stage));
  const top = SCAFFOLD_BASE_ROW - n * SCAFFOLD_SECTION_ROWS;
  for (let y = top; y < SCAFFOLD_BASE_ROW; y++) rows[y] = src[y];
  if (n === 0) return blit(rows, ['...........lll', '..........lpppl', '.........kdddddk'], 17, 74);
  return rows;
}
// the tower palettes do not share chars with the scaffold, so prefix scaffold chars to keep them apart
const SC_CHARS = { p: '1', d: '2', l: '3', k: '4', r: '5' };
const SC_PAL = { 1: 'wd2', 2: 'wd1', 3: 'wd3', 4: 'wd0', 5: 'iron' };
const remapSc = (rows) => rows.map((r) => r.replace(/[pdlkr]/g, (c) => SC_CHARS[c]));
const towerAt = (tower, stage) => blit(tower.frames[0], remapSc(scaffoldRows(stage)), 0, 0);
const STAGES = Array.from({ length: SCAFFOLD_SECTIONS + 1 }, (_, i) => i);
P('scaffold', { ...SC_PAL }, STAGES.map((s) => remapSc(scaffoldRows(s))), { w: 32, h: 80, note: 'frame = stage 0-7' });
P('lighthouse', { ...TOWER_DARK.pal, ...SC_PAL }, STAGES.map((s) => towerAt(TOWER_DARK, s)), {
  w: 32, h: 80, note: 'frame = scaffold stage 0-7; variant lit = lamp burning',
  variants: { lit: { pal: TOWER_LIT.pal } },
});

/* ---------------------------------------------------------------- roof swatches (×8) */
// Payment Ceremony roof swatches: a shingle card in each roof colour; variant = the colour name in
// palette.ROOF_COLOURS (default slate): getSprite('roof-swatch', 'teal').
const SWATCH = [
  '................',
  '..kkkkkkkkkkkk..',
  '..klllllllllbk..',
  '..klbbdlbbdbbk..',
  '..kbbbdbbbdbbk..',
  '..kssssssssssk..',
  '..kbdlbbdlbbdk..',
  '..kbdbbbdbbbdk..',
  '..kssssssssssk..',
  '..klbbdlbbdlbk..',
  '..kbbbdbbbdbbk..',
  '..kssssssssssk..',
  '..kbdlbbdlbbdk..',
  '..kbdbbbdbbbdk..',
  '..kkkkkkkkkkkk..',
  '................',
];
const swatchPal = (c) => ({ k: 'ink', d: `${c}0`, s: `${c}1`, b: `${c}2`, l: `${c}3` });
P('roof-swatch', swatchPal('slate'), SWATCH, { variants: Object.fromEntries(ROOF_COLOURS.map((c) => [c, { pal: swatchPal(c) }])) });

/* ---------------------------------------------------------------- chimneys */
// Chimney (16×24, bottom aligned to the ridge tile): brick stack with mortar courses, lit left face, a
// stone cap and a clay pot, rising clear of the roofline so the house silhouette breaks.
const CHIMNEY = [
  '................',
  '.......pq.......',
  '......opqo......',
  '.....nnnnnnn....',
  '.....ccccccmn...',
  '.....nnnnnnnn...',
  '......lbbbdk....',
  '......lbbbdk....',
  '......kkkkkk....',
  '......lbbbdk....',
  '......lbbbdk....',
  '......kkkkkk....',
  '......lbbbdk....',
  '......lbbbdk....',
  '......kkkkkk....',
  '......lbbbdk....',
  '......lbbbdk....',
  '.....kkkkkkkk...',
  ...blank(16, 6),
];
P('chimney', { b: 'br2', d: 'br1', k: 'br0', l: 'br3', c: 'st3', m: 'st2', n: 'st1', p: 'red3', q: 'red1', o: 'uiink' }, CHIMNEY, { w: 16, h: 24 });
P('chimney-stone', { b: 'st3', d: 'st2', k: 'co1', l: 'st4', c: 'st3', m: 'st2', n: 'st1', p: 'red3', q: 'red1', o: 'uiink' }, CHIMNEY, { w: 16, h: 24 });
P('chimney-tin', { k: 'iron', i: 'iron2', h: 'st3', c: 'st2' }, [
  '................',
  '......kkkkk.....',
  '.....kiiiiik....',
  '......khick.....',
  '.......kick.....',
  '.......khck.....',
  '.......kick.....',
  '.......khck.....',
  '.......kick.....',
  '.......khck.....',
  '.......kick.....',
  '.......khck.....',
  '......kkkkkk....',
  ...blank(16, 11),
], { w: 16, h: 24 });

/* ---------------------------------------------------------------- market, mill, furniture */
// Market stall (32×32): a striped awning on four poles over a trestle of goods; three awning colours.
const STALL = [
  '................................',
  '................................',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '.kaaawwwwaaaawwwwaaaawwwwaaaawk.',
  '.kaaawwwwaaaawwwwaaaawwwwaaaawk.',
  'kaaawwwwaaaawwwwaaaawwwwaaaawwwk',
  'kqqqvvvvqqqqvvvvqqqqvvvvqqqqvvvk',
  'kakwkakwkakwkakwkakwkakwkakwkakk',
  '.k..k.......................k.k.',
  '.k..k.......................k.k.',
  '.kl.k.......................kl..',
  '.kl.........................kl..',
  '.kl.........................kl..',
  '.kl.ffffffff.ggggggg.yyyyyy.kl..',
  '.klfoofoffoffggrgggrgyyoyyyykl..',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'klllllllllllllllllllllllllllllmk',
  'kppppppppppppppppppppppppppppppk',
  'kddddddddddddddddddddddddddddddk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '.kd.........................kd.s',
  '.kd.........................kd.s',
  '.kd.........................kd.s',
  '.kd.........................kdss',
  '.kks........................kkss',
  '..ssssssssssssssssssssssssssssss',
  '...ssssssssssssssssssssssssssss.',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];
const STALLP = { k: 'base', w: 'pl3', v: 'pl1', l: 'wd3', p: 'wd2', d: 'wd1', m: 'wd0', f: 'pear', o: 'pear0', g: 'grass2', r: 'red2', y: 'yellow', s: 'shadow' };
P('market-stall-red', { ...STALLP, a: 'red2', q: 'red1' }, STALL, { w: 32, h: 32 });
P('market-stall-blue', { ...STALLP, a: 'blue2', q: 'blue1' }, STALL, { w: 32, h: 32 });
P('market-stall-moss', { ...STALLP, a: 'moss2', q: 'moss1' }, STALL, { w: 32, h: 32 });
// Windmill (48×64, Thistlewind): a white smock mill with a cap and four sails turning in four frames.
function windmill(f) {
  const g = blank(48, 64).map((r) => r.split(''));
  const put = (x, y, c) => { if (y >= 0 && y < 64 && x >= 0 && x < 48) g[y][x] = c; };
  // body: tapering tower rows 26..61
  for (let y = 26; y < 62; y++) {
    const half = 7 + Math.floor((y - 26) / 6);
    for (let x = 24 - half; x < 24 + half; x++) {
      const edge = x === 24 - half || x === 24 + half - 1;
      put(x, y, edge ? 'k' : x < 24 - half / 3 ? 'h' : x < 24 + half / 3 ? 'w' : 's');
    }
  }
  for (let x = 14; x < 34; x++) { put(x, 61, 'k'); put(x, 62, 'x'); }
  for (let x = 16; x < 34; x++) put(x + 2, 63, 'y');
  // door and window
  for (let y = 53; y < 61; y++) for (let x = 22; x < 26; x++) put(x, y, y === 53 ? 'k' : 'd');
  for (let y = 38; y < 41; y++) for (let x = 23; x < 25; x++) put(x, y, 'g');
  // cap
  for (let y = 20; y < 27; y++) {
    const half = 3 + (y - 20);
    for (let x = 24 - half; x < 24 + half; x++) put(x, y, y === 26 ? 'k' : x < 24 ? 'r' : 'q');
  }
  // sails: four arms from the hub at (24, 23); two poses (square and diagonal) so every line stays a
  // clean pixel line (rotating pixel art by odd angles breaks it up). The cloth sits on the trailing
  // side of each spar with a lattice line every third pixel.
  const dirs = f % 2 === 0 ? [[1, 0], [0, 1], [-1, 0], [0, -1]] : [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const len = f % 2 === 0 ? 19 : 14;
  for (const [dx, dy] of dirs) {
    const px = -dy, py = dx; // perpendicular (trailing side)
    for (let t = 1; t <= len; t++) {
      put(24 + dx * t, 23 + dy * t, 'm');
      if (dx && dy) put(24 + dx * t - dx, 23 + dy * t, 'm');
      if (t < 4) continue;
      for (let w = 1; w <= 3; w++) {
        const lattice = t % 3 === 0 || w === 3;
        const x = 24 + dx * t + px * w, y = 23 + dy * t + py * w;
        put(x, y, lattice ? 'm' : 'c');
        if (dx && dy) put(x - dx, y, lattice ? 'm' : 'c');
      }
    }
  }
  put(24, 23, 'i'); put(23, 23, 'i'); put(24, 22, 'i'); put(23, 22, 'i');
  return g.map((r) => r.join(''));
}
P('windmill', { k: 'base', w: 'pl2', h: 'pl3', s: 'pl1', d: 'wd1', g: 'pane0', r: 'red2', q: 'red1', m: 'wd0', c: 'pl3', i: 'iron', x: 'base', y: 'shadow' },
  [0, 1].map(windmill), { w: 48, h: 64, fps: 3 });
// Bench (32×16): a slatted harbor bench (Ambrose's bench in the yard).
P('bench', { k: 'base', d: 'wd0', m: 'wd1', p: 'wd2', l: 'wd3', i: 'iron', s: 'shadow' }, [
  '................................',
  '................................',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkk...',
  '...klllllllllllllllllllllllmk...',
  '...kppppppppppppppppppppppppk...',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkk...',
  '...kik...................kik....',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '..klllllllllllllllllllllllllmk..',
  '..kppppppppppppppppppppppppppk..',
  '..kmmmmmmmmmmmmmmmmmmmmmmmmmmk..',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '...kik....................kiks..',
  '...kik....................kikss.',
  '....ss......................ss..',
  '................................',
], { w: 32, h: 16 });
// The Summit Bell (32×32, Shardcrown): a bronze bell under a stone yoke, rope hanging.
P('summit-bell', { k: 'base', b: 'brass', o: 'brass0', h: 'yellow', d: 'st2', m: 'st3', l: 'st4', r: 'sand1', s: 'shadow' }, [
  '................................',
  '................................',
  '....kkkkkkkkkkkkkkkkkkkkkkkk....',
  '....klllllllllllllllllllllmk....',
  '....kmmmmmmmmmmmmmmmmmmmmmdk....',
  '....kkkkkkkkkkkkkkkkkkkkkkkk....',
  '.....kmk.......kk.......kmk.....',
  '.....kmk......kook......kmk.....',
  '.....kmk.....kobbok.....kmk.....',
  '.....kmk....kohbbbok....kmk.....',
  '.....kmk....khbbbbok....kmk.....',
  '.....kmk....khbbbbok....kmk.....',
  '.....kmk...kohbbbbbok...kmk.....',
  '.....kmk...khbbbbbbok...kmk.....',
  '.....kmk..kohbbbbbbbok..kmk.....',
  '.....kmk..khbbbbbbbbok..kmk.....',
  '.....kmk.kohbbbbbbbbbok.kmk.....',
  '.....kmk.koooooooooooook.kmk....'.slice(0, 32),
  '.....kmk..kkkkkkkkkkkkk.kmk.....',
  '.....kmk.......kok......kmk.....',
  '.....kmk........r.......kmk.....',
  '.....kmk........r.......kmk.....',
  '.....kmk........r.......kmk.....',
  '.....kmk........r.......kmk.....',
  '.....kmk........r.......kmk.....',
  '....kkmkk.......r......kkmkk....',
  '....kkkkks.............kkkkks...',
  '.....sssss..............sssss...',
  '................................',
  '................................',
  '................................',
  '................................',
].map((r) => r.padEnd(32, '.').slice(0, 32)), { w: 32, h: 32 });

export const PROP_ART = Object.freeze(props);
export default PROP_ART;

/* ---------------------------------------------------------------- house recipe */

/**
 * One placed piece of a house: a tile or prop id at a tile offset from the house anchor (the door row,
 * left column). Draw in list order; `lit` / `unlit` name the window pair for night swapping.
 * @typedef {{art: string, dx: number, dy: number, lit?: string, layer: 'wall'|'roof'|'prop'}} HousePiece
 */

/**
 * Lays out a house from tiles (the pure half of the prototype's `expandHouse`): two wall rows, windows,
 * door (plain or porch hood), a ridge + eave roof row pair in one of the eight roof colours, optional
 * dormer and chimney.
 * @param {{w?: number, roof?: string, material?: 'timber'|'brick'|'stone'|'shiplap', door?: number,
 *   porch?: boolean, upperWindows?: number[], lowerWindows?: number[], dormer?: number|null, chimney?: boolean|'stone'|'tin'}} [o]
 * @returns {HousePiece[]}
 */
export function houseLayout(o = {}) {
  const w = Math.max(2, o.w || 3);
  const roof = ROOF_COLOURS.includes(o.roof) ? o.roof : 'slate';
  const mat = o.material || 'timber';
  const wall = { timber: 'wall-timber', brick: 'wall-brick', stone: 'wall-stone', shiplap: 'wall-shiplap' }[mat] || 'wall-timber';
  const win = { timber: 'window', brick: 'window-brick', stone: 'window-stone', shiplap: 'window-shiplap' }[mat] || 'window';
  const doorArt = o.porch ? 'door-porch' : { brick: 'door-brick', stone: 'door-stone' }[mat] || 'door';
  const door = o.door === undefined ? 1 : o.door;
  const upper = o.upperWindows || [0, w - 1];
  const lower = o.lowerWindows || [w - 1];
  const out = [];
  for (let i = 0; i < w; i++) {
    const up = upper.includes(i) ? `${win}-unlit` : mat === 'timber' && i === Math.floor(w / 2) && w >= 3 ? 'wall-timber-x' : wall;
    out.push(up.endsWith('-unlit') ? { art: up, lit: up.replace('-unlit', '-lit'), dx: i, dy: -1, layer: 'wall' } : { art: up, dx: i, dy: -1, layer: 'wall' });
    const lo = i === door ? doorArt : lower.includes(i) ? `${win}-unlit` : wall;
    out.push(lo.endsWith('-unlit') ? { art: lo, lit: lo.replace('-unlit', '-lit'), dx: i, dy: 0, layer: 'wall' } : { art: lo, dx: i, dy: 0, layer: 'wall' });
  }
  for (let i = 0; i < w; i++) {
    const end = i === 0 ? '-l' : i === w - 1 ? '-r' : '';
    const ridge = o.dormer === i ? `roof-${roof}-dormer` : `roof-${roof}-ridge${end}`;
    out.push(o.dormer === i ? { art: ridge, lit: `${ridge}-lit`, dx: i, dy: -3, layer: 'roof' } : { art: ridge, dx: i, dy: -3, layer: 'roof' });
    out.push({ art: `roof-${roof}-eave${end}`, dx: i, dy: -2, layer: 'roof' });
  }
  if (o.chimney !== false) {
    const id = o.chimney === 'stone' ? 'chimney-stone' : o.chimney === 'tin' ? 'chimney-tin' : 'chimney';
    out.push({ art: id, dx: w - (w >= 4 ? 2 : 1), dy: -3, layer: 'prop' });
  }
  return out;
}

/** Pixel size of a tile, re-exported for prop placement math. */
export { TILE };

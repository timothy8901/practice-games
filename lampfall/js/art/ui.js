/**
 * Keeper's-desk UI art and the Skyband pieces (GDD-00 §13 / §14, ARCHITECTURE §1). [ART-SHARED]
 *
 * Desk: torn paper edges and a dog-ear, ledger-rule paper (plain and with the red margin), wax seals
 * (button size and the large title size; idle / focused / pressed), the twenty-notch tally stick
 * (frame = notches cut, 0-20, every fifth notch long), the pointing-hand cursor (2-frame bob), a small
 * pointer and focus corners.
 *
 * Skyband: sun (high / low), moon (8 phases), the tide needle and its dial, fair clouds and the backlog's
 * overcast clouds (grey, heavy underside), the comet (comet magenta, `reserved: 'comet'`), a meteor
 * streak (3 frames), a twinkling star (never a plus: that glyph is the Heartmark's) and the far isles.
 *
 * All UI art is `kind: 'ui'` and bypasses the LUT (HUD and cursor are on the exempt list). Palettes are
 * hexes from `art/palette.UI` / `MASTER`, so the linter can check them like any other art.
 * @module art/ui
 */

import { UI, MASTER } from './palette.js';
import { createGroup } from './tiles/kit.js';
import { blank, blit } from './spriteUtil.js';

const { tiles: art, def } = createGroup('ui');
const U = (id, pal, frames, opts = {}) => def(id, pal, frames, { kind: 'ui', ...opts });

const INK = UI.nightInk, DESK = UI.deskInk, PAPER = UI.ledgerPaper, CREAM = UI.cream;

/* ---------------------------------------------------------------- paper */
// Torn edges for paper slips (16 wide, tile horizontally). Top: the paper below a ragged tear with a
// shade line; bottom mirrored with the drop shadow.
U('ui-paper-edge-top', { p: PAPER, s: UI.paperShade, d: UI.paperDeep }, [
  '...p......pp....',
  '..pppp...ppppp.p',
  'pppsppppppppsppp',
  'pppppppppppppppp',
], { w: 16, h: 4 });
U('ui-paper-edge-bottom', { p: PAPER, s: UI.paperShade, d: UI.paperDeep, k: UI.inkSoft }, [
  'pppppppppppppppp',
  'pspppspppppppsps',
  'p.pps..ppppp..pp',
  '...k....k.kk....',
], { w: 16, h: 4 });
// Dog-eared corner (8×8): the folded flap shows the paper's back, a crease line, a shadow under it.
U('ui-paper-corner', { p: PAPER, s: UI.paperShade, d: UI.paperDeep, k: UI.inkSoft }, [
  'pppppppp',
  'pppppppp',
  'pppppppd',
  'ppppppds',
  'pppppdss',
  'ppppdsss',
  'pppdsssk',
  'ppdddkk.',
], { w: 8, h: 8 });
// Ledger paper (16×16, tiles): faint grain, a rule every 8px in ledger-rule tan.
const LEDGER = [
  'pppppppppppppppp',
  'ppppgppppppppppp',
  'pppppppppppgpppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pgpppppppppppppp',
  'pppppppppppppppp',
  'rrrrrrrrrrrrrrrr',
  'pppppppppppppppp',
  'ppppppppgppppppp',
  'pppppppppppppppp',
  'pppppppppppppgpp',
  'pppppppppppppppp',
  'ppgppppppppppppp',
  'pppppppppppppppp',
  'rrrrrrrrrrrrrrrr',
];
const LEDGER_P = { p: PAPER, g: UI.paperShade, r: UI.ledgerRule, m: UI.waxRed };
U('ui-ledger-lines', LEDGER_P, LEDGER);
// The left margin of a ledger page: a doubled red rule (wax red) 3px from the edge.
U('ui-ledger-margin', LEDGER_P, LEDGER.map((r) => r.slice(0, 3) + 'm.m'.replace('.', r[4]) + r.slice(6)));

/* ---------------------------------------------------------------- wax seals */
// Wax seal (16×16 button): an irregular pooled blob of wax red, lit rim top-left, a pressed lamp mark in
// the middle (the game's sigil: a lantern), dark underside. Variants: focus (lighter wax, brass ring),
// pressed (darker, mark sunk).
const SEAL = [
  '.....kkkkk......',
  '...kkhlllhkk....',
  '..khllrrrrlhk...',
  '.khlrrrrrrrrdk..',
  '.klrrrrddrrrrdk.',
  'khlrrrdqqdrrrdk.',
  'klrrrrdqqdrrrrdk',
  'klrrrdqqqqdrrrdk',
  'klrrrdqqqqdrrrdk',
  'klrrrrdddddrrrdk',
  'krrrrrrqqrrrrrdk',
  '.krrrrrrrrrrrddk',
  '.kdrrrrrrrrrddk.',
  '..kddrrrrrdddk..',
  '...kkddddddkk...',
  '.....kkkkkk.....',
];
const SEAL_P = { k: UI.waxDark, d: UI.waxDark, r: UI.waxRed, l: UI.waxLight, h: UI.waxLight, q: UI.waxDark };
U('ui-wax-seal', SEAL_P, SEAL, {
  variants: {
    focus: { pal: { k: UI.brass, r: UI.waxLight, l: UI.waxLight, h: UI.brassLight } },
    pressed: { pal: { r: UI.waxDark, l: UI.waxRed, h: UI.waxRed, q: INK, d: INK } },
  },
});
// Large seal (24×24) for the title's Continue / New / Settings: the same blob, a ring of pressed dots.
const BIG = [];
for (let y = 0; y < 24; y++) {
  let row = '';
  for (let x = 0; x < 24; x++) {
    const dx = x - 11.5, dy = y - 11.5;
    const wob = 10.6 + Math.sin(Math.atan2(dy, dx) * 5) * 0.7;
    const r = Math.hypot(dx, dy);
    if (r > wob) { row += '.'; continue; }
    if (r > wob - 1) { row += 'k'; continue; }
    const lit = dx + dy < -6;
    const ring = Math.abs(r - 7.4) < 0.55 && (Math.round(Math.atan2(dy, dx) * 4) % 2 === 0);
    if (ring) { row += 'q'; continue; }
    if (r < 3.3) { row += Math.abs(dx) < 1.2 && dy < 2.5 ? 'q' : dy > 1.5 ? 'q' : 'r'; continue; }
    row += lit ? (r > wob - 2.4 ? 'h' : 'l') : dx + dy > 8 ? 'd' : 'r';
  }
  BIG.push(row);
}
U('ui-wax-seal-large', SEAL_P, BIG, {
  w: 24, h: 24,
  variants: {
    focus: { pal: { k: UI.brass, r: UI.waxLight, h: UI.brassLight } },
    pressed: { pal: { r: UI.waxDark, l: UI.waxRed, h: UI.waxRed, q: INK, d: INK } },
  },
});

/* ---------------------------------------------------------------- tally stick */
// The twenty-notch tally stick (88×10): a split hazel stick, bark edge on top, lit face, end grain on
// both ends. Frame n has n notches cut (each notch = 10,000 coins); every fifth notch is cut deeper.
const W88 = 88;
const span = (l, mid, r, w = W88) => l + mid.repeat(w - l.length - r.length) + r;
const STICK = [
  span('..', 'b', '..'),
  span('.k', 'l', 'k.'),
  span('kg', 'h', 'gk'),
  span('kg', 'l', 'gk'),
  span('kg', 'l', 'gk'),
  span('kg', 'l', 'gk'),
  span('kg', 'l', 'gk'),
  span('kg', 'd', 'gk'),
  span('.k', 'd', 'k.'),
  span('..', 'k', '..'),
];
const notchX = (i) => 5 + i * 4 + (i >= 10 ? 1 : 0);
function stickFrame(n) {
  let r = STICK;
  for (let i = 0; i < 20; i++) {
    const deep = (i + 1) % 5 === 0;
    const x = notchX(i);
    if (i < n) r = blit(r, deep ? ['kn', 'kn', 'kn', 'kn', 'kn', 'kn'] : ['kn', 'kn', 'kn', 'kn'], x, 1);
    else r = blit(r, deep ? ['.', 'm', '.', 'm'] : ['.', 'm'], x, 1); // pencilled guide ticks
  }
  return r;
}
U('ui-tally-stick', { b: UI.tallyDeep, k: UI.tallyDeep, l: UI.tallyLight, h: UI.brassLight, g: UI.tallyDark, d: UI.tallyDark, n: UI.ledgerRule, m: UI.ledgerRule },
  Array.from({ length: 21 }, (_, n) => stickFrame(n)), { w: 88, h: 10, note: 'frame = notches cut (0-20)' });

/* ---------------------------------------------------------------- cursor & focus */
// Pointing hand (12×12) in cream with an ink outline and a paper-shade underside, finger to the right;
// frame 2 nudges one pixel right (the bob).
const HAND = [
  '............',
  '..kkkk......',
  '.kwwwwkkkkk.',
  'kwwwwwwwwwwk',
  'kwwwwwkkkkk.',
  'kwwwwwwk....',
  'kwwwwwwk....',
  'kswwwwsk....',
  '.kssssk.....',
  '..kkkk......',
  '............',
  '............',
];
U('ui-cursor', { k: INK, w: CREAM, s: UI.paperShade }, [HAND, HAND.map((r) => '.' + r.slice(0, 11))], { w: 12, h: 12, fps: 3 });
// Small pointer (5×7): a solid ink triangle with a cream edge, for lists.
U('ui-cursor-small', { k: INK, w: UI.porchAmber }, [
  'k....',
  'kk...',
  'kwk..',
  'kwwk.',
  'kwk..',
  'kk...',
  'k....',
], { w: 5, h: 7 });
// Focus corner (4×4, mirrored by the drawer for the other three): a brass bracket.
U('ui-focus-corner', { b: UI.brass, d: UI.brassDark }, ['bbbb', 'bddd', 'bd..', 'bd..'], { w: 4, h: 4 });

/* ---------------------------------------------------------------- skyband */
// Sun (11×11): high = cream-gold disc with a lit rim; variant low = marigold near the horizon.
const SUN = [];
for (let y = 0; y < 11; y++) {
  let row = '';
  for (let x = 0; x < 11; x++) {
    const r = Math.hypot(x - 5, y - 5);
    row += r > 5.2 ? '.' : r > 4.3 ? 'o' : x + y < 7 ? 'h' : 'c';
  }
  SUN.push(row);
}
U('sky-sun', { o: UI.sunCore, c: UI.sunCore, h: CREAM }, SUN, {
  w: 11, h: 11,
  variants: { low: { pal: { o: '#E07A3F', c: UI.sunLow, h: '#F3C178' } } },
});
// Moon (11×11), 8 phases (0 = new: a faint rim only; 4 = full). The shadowed part is night ink-blue.
function moon(phase) {
  const rows = [];
  const t = phase / 8; // 0..1 around the cycle
  for (let y = 0; y < 11; y++) {
    let row = '';
    for (let x = 0; x < 11; x++) {
      const dx = x - 5, dy = y - 5;
      const r = Math.hypot(dx, dy);
      if (r > 5.2) { row += '.'; continue; }
      // terminator: an ellipse whose x-radius sweeps with the phase
      const k = Math.cos(t * Math.PI * 2); // 1 new, -1 full
      const lim = Math.sqrt(Math.max(0, 25 - dy * dy));
      const term = k * lim;
      const waxing = t < 0.5;
      const litSide = waxing ? dx > term : dx < -term;
      const lit = phase === 4 ? true : phase === 0 ? false : litSide;
      if (!lit) { row += r > 4.4 ? 'e' : 'd'; continue; }
      row += r > 4.4 ? 'w' : (dx * 7 + dy * 3) % 11 === 0 ? 's' : 'm';
    }
    rows.push(row);
  }
  return rows;
}
U('sky-moon', { m: UI.moon, w: CREAM, s: UI.moonShade, d: UI.deepBlue, e: '#3B4A6B' }, Array.from({ length: 8 }, (_, i) => moon(i)), { w: 11, h: 11, note: 'frame = phase 0-7 (4 = full)' });
// Tide dial (25×13): a half-gauge with LOW at the left, HIGH at the right, brass bezel; the needle is a
// separate sprite the HUD rotates in 9 steps (frames 0..8, low -> high), each a clean pixel line.
const DIAL = [];
for (let y = 0; y < 13; y++) {
  let row = '';
  for (let x = 0; x < 25; x++) {
    const dx = x - 12, dy = y - 12;
    const r = Math.hypot(dx, dy);
    if (r > 12.4 || dy > 0) { row += '.'; continue; }
    if (r > 11.3) { row += 'b'; continue; }
    if (r > 10.4) { row += 'd'; continue; }
    const tick = r > 8.6 && [0, 1, 2, 3, 4].some((i) => Math.abs(Math.atan2(-dy, dx) - (Math.PI * i) / 4) < 0.07);
    row += tick ? 'k' : dx < -4 ? 'l' : dx > 4 ? 'h' : 'p';
  }
  DIAL.push(row);
}
U('sky-tide-dial', { b: UI.brass, d: UI.brassDark, k: INK, p: PAPER, l: '#6FBFCF', h: '#3F9BB8' }, DIAL, { w: 25, h: 13 });
function needle(step) {
  const a = Math.PI - (step / 8) * Math.PI; // left (low) -> right (high)
  let rows = blank(25, 13);
  for (let t = 0; t <= 9; t++) rows = blit(rows, [t < 2 ? 'b' : 'k'], 12 + Math.round(Math.cos(a) * t), 12 - Math.round(Math.sin(a) * t));
  return blit(rows, ['bb'], 12, 11);
}
U('sky-tide-needle', { k: UI.waxRed, b: UI.brassDark }, Array.from({ length: 9 }, (_, i) => needle(i)), { w: 25, h: 13, note: 'frame = tide 0 (low) - 8 (high)' });
// Clouds (from the tile prototype): lit cream top-left, blue-grey underside.
const CLOUD_A = [
  '..........wwww..........',
  '.......wwwwwwwww........',
  '....wwwwwwwwwwwwwww.....',
  '..wwwwwwwwwwwwwwwwwwl...',
  '.wwwwwwwwwwwwwwwwwwwlls.',
  'wlllllllllllllllllllsss.',
  '.sssssssssssssssssssdd..',
  '...ddddddddddddddddd....',
];
const CLOUD_B = [
  '.....www.....',
  '..wwwwwwwww..',
  '.wwwwwwwwwwl.',
  'llllllllllss.',
  '.ssssssssdd..',
];
const FAIR = { w: CREAM, l: '#F4E8C1', s: UI.skyHaze, d: UI.cloudShade };
U('sky-cloud-a', FAIR, CLOUD_A, { w: 24, h: 8 });
U('sky-cloud-b', FAIR, CLOUD_B, { w: 13, h: 5 });
// Overcast clouds (backlog: "Skyband clouds stay cream in rain"): grey, flatter, a heavy dark underside
// and a ragged base that trails rain streaks in the rain variant.
const OVER_A = [
  '........wwwwww..............',
  '....wwwwwwwwwwwww...www.....',
  '..wwwwwwwwwwwwwwwwwwwwwww...',
  '.wwwwwwwwwwwwwwwwwwwwwwwwww.',
  'wwllllllllllllllllllllllllww',
  'lssssssssssssssssssssssssssl',
  'sddddddddddddddddddddddddds.',
  '.dd.ddddd..dddddd.ddddd.dd..',
];
const OVER_P = { w: UI.overcast1, l: UI.overcast0, s: UI.overcast2, d: UI.cloudDark };
U('sky-cloud-overcast', OVER_P, OVER_A, {
  w: 28, h: 8,
  variants: { rain: { frames: [blit(OVER_A, ['.r....r.....r....r.....r...'], 0, 7)], pal: { r: '#73EFF7' } } },
});
U('sky-cloud-overcast-b', OVER_P, [
  '....wwwwww.....',
  '.wwwwwwwwwwww..',
  'wwlllllllllllw.',
  'lsssssssssssssl',
  '.dddd.dddd.ddd.',
], { w: 15, h: 5 });
// The comet (24×8): a bright head with a forked tail in comet magenta, fading to dusk pink.
U('sky-comet', { c: UI.cometCore, m: MASTER.m, t: UI.cometTail, w: CREAM }, [
  '........................',
  '..t.t..t................',
  '....t.tttt.mm...........',
  '.t..ttttmmmmmmmmcw......',
  '...t.tttttmmmmmmccw.....',
  '.......t.ttt.mm.........',
  '.....t...t..............',
  '........................',
], { w: 24, h: 8, reserved: 'comet' });
// Meteor streak (10×5), 3 frames: head and a short cream trail that lengthens then fades.
U('sky-meteor', { w: CREAM, s: UI.skyHaze, h: UI.sunCore }, [
  ['..........', '..........', '.......sw.', '........h.', '..........'],
  ['..........', '....s.....', '.....ssw..', '.......wh.', '..........'],
  ['..........', '.s........', '..s.s.....', '....s.s...', '.......s..'],
], { w: 10, h: 5, fps: 12 });
// A twinkling star (3×3): a dot that flares to a diagonal glint (never a plus).
U('sky-star', { w: CREAM, s: UI.skyHaze }, [['...', '.s.', '...'], ['s..', '.w.', '..s']], { w: 3, h: 3, fps: 2 });
// Distant isle silhouette for the horizon.
U('sky-isle-far', { a: '#4F5A6B', b: '#6E7A86' }, [
  '..............bb................................',
  '..........bbbbaabbb..............bbbb...........',
  '......bbbbaaaaaaaaabbb.......bbbbaaaabbbb.......',
  'bbbbbbaaaaaaaaaaaaaaaabbbbbbbaaaaaaaaaaaabbbbbbb',
], { w: 48, h: 4 });

export const UI_ART = Object.freeze(art);
export default UI_ART;

// js/art/portraits.js  [ART-CHARS]
// 48x48 dialogue busts (GDD-00 §13 Dialogue: "48x48 bust") for every named
// resident, Spire leader, Summit figure and isle character, from the field-
// guide portrait style of proto/chars/portraits.js (kit: js/art/chars/bustkit.js).
//
//   PORTRAITS[id]              { w: 48, h: 48, rows, palette }      (neutral)
//   PORTRAIT_IDS               display order
//   expressionsOf(id)          ['neutral', 'happy', 'worried', 'surprised'] for the main cast, ['neutral'] otherwise
//   portrait(id, expr?)        { w, h, rows, palette, expr }  (falls back to neutral; memoized)
//   portraitSprite(id, expr?, opts?)  decoded Sprite via js/core/pixelart.js
//   PLATES                     { porch, isle }: plate letters '1' fill / '2' rule; set both to null for a bare bust
//   registerPortraitArt()      registers every bust in art/atlas as 'portrait-<id>' (neutral frame; the other
//                              expressions as named variants). Not done at import: busts build lazily.
//
// Main cast (four expressions): Wren, Corin, Linnet, Juniper, Hesper, Wick,
// Ambrose, Idris. Residents sit on a cream plate; isle folk, Spire leaders,
// the Summit and the Champion on a night-blue plate (n / v).
// Changes on adoption: Corin is a tawny owl and Idris a great northern diver
// (GDD-00 §10); Linnet's shadow fur uses the brown ramp (CHAR_RAMPS), not p.
import {
  N, G, ball, poly, seg, px, pxs, rect, tint, finish, ring, mirror,
  eyeX, browX, mouthX, blushX, sweatX, EXPRESSIONS,
} from './chars/bustkit.js';
import { SW, CHAR_RAMPS as CR } from './chars/palettes.js';
import { decodeSprite } from '../core/pixelart.js';
import { registerArt } from './atlas.js';

export const PLATES = Object.freeze({ porch: Object.freeze({ 1: '#efe6cf', 2: '#c9a77c' }), isle: Object.freeze({ 1: SW.n, 2: SW.v }) });
const PORCH = PLATES.porch, ISLE = PLATES.isle;

// ===========================================================================
// MAIN CAST
// ===========================================================================

// --- Wren and Ambrose (beavers share one build) -----------------------------
function beaver(expr, { elder = false } = {}) {
  const FUR = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 56, 21, 16, FUR, { bias: 0.1 });
  const bib = G();
  poly(bib, [[14, 39], [34, 39], [35, 48], [13, 48]], 'C');
  tint(bib, 'C', 'Q', (x) => x <= 16);
  tint(bib, 'C', 'c', (x) => x >= 31);
  seg(bib, 15, 39, 11, 34, 'C', 2); seg(bib, 32, 39, 35, 34, 'c', 2);
  px(bib, 11, 34, 'Q'); px(bib, 12, 34, 'Q');
  rect(bib, 16, 40, 2, 2, 'A'); px(bib, 16, 40, 'B'); rect(bib, 30, 40, 2, 2, 'A'); px(bib, 30, 40, 'B'); px(bib, 31, 41, 'a');
  if (!elder) {
    // pocket abacus clipped to the bib
    rect(bib, 19, 42, 10, 6, 'T'); rect(bib, 20, 43, 8, 4, 'c');
    for (const [r, xs] of [[43, [20, 22, 25]], [44, [21, 23, 26]], [45, [20, 24, 27]]]) for (const x of xs) px(bib, x, r, 'A');
    rect(bib, 19, 42, 10, 1, 't'); px(bib, 20, 43, 'B');
  } else {
    rect(bib, 25, 41, 2, 7, 'T'); px(bib, 25, 41, 'A'); px(bib, 25, 44, 'A');
  }
  const head = G();
  ball(head, 13, 11, 3.2, 3.2, ['F', 'f', 'D']); ball(head, 35, 11, 3.2, 3.2, ['f', 'D', 'D']);
  ball(head, 15, 27, 8, 7, FUR); ball(head, 33, 27, 8, 7, FUR);
  ball(head, 24, 21, 13, 12.5, FUR, { bias: 0.04 });
  ball(head, 24, 34, 9, 4.5, FUR);
  if (elder) {
    tint(head, 'Ff', 'Z', (x, y) => y > 25 && y < 33 && (x < 12 || x > 36) && (x + y) % 2 === 0);
    tint(head, 'F', 'L', (x, y) => y < 14 && (x + 2 * y) % 5 === 0);
  }
  const face = G();
  ball(face, 24, 29.5, 8.5, 6, ['H', 'M', 'm'], { th: [0.7, 0.25] });
  ball(face, 24, 25.6, 3.2, 2.2, ['n', 'N', 'N'], { th: [0.8, 0.2] });
  px(face, 22, 25, 'W');
  seg(face, 24, 28, 24, 29, 'm');
  // mouth around the incisors
  const MOUTH = {
    neutral: [[19, 30], [20, 31], [21, 31], [27, 31], [28, 31], [29, 30]],
    happy: [[17, 28], [18, 29], [19, 30], [20, 31], [21, 31], [27, 31], [28, 31], [29, 30], [30, 29], [31, 28]],
    worried: [[19, 32], [20, 31], [21, 31], [27, 31], [28, 31], [29, 32]],
    surprised: [[20, 31], [21, 31], [27, 31], [28, 31]],
  };
  if (expr === 'surprised') { rect(face, 21, 31, 7, 6, 'K'); rect(face, 22, 36, 5, 1, 'm'); px(face, 24, 35, 'P'); }
  pxs(face, MOUTH[expr], 'm');
  rect(face, 22, 31, 5, expr === 'surprised' ? 3 : 5, 'Y'); rect(face, 24, 31, 1, expr === 'surprised' ? 3 : 5, 'y');
  if (expr !== 'surprised') rect(face, 22, 35, 5, 1, 'y');
  px(face, 22, 31, 'H');
  pxs(face, [[18, 28], [20, 27], [30, 28], [28, 27]], 'm');
  if (!elder) {
    eyeX(face, 17, 18, 3, 4, expr, { lid: 'D' }); eyeX(face, 28, 18, 3, 4, expr, { lid: 'D' });
    browX(face, 17, 15, 3, 'l', expr, 'D'); browX(face, 28, 15, 3, 'r', expr, 'D');
    if (expr !== 'happy') pxs(face, [[17, 22], [18, 22], [29, 22], [30, 22]], 'f');
    blushX(face, 14, 34, 25, expr, 'P');
    if (expr === 'worried') sweatX(face, 37, 15);
  } else {
    for (const cx of [18.5, 30.5]) ball(face, cx, 20, 4.6, 4.6, ['G', 'G', 'g'], { th: [0.6, 0.1] });
    eyeX(face, 17, 18, 4, 4, expr, { lid: 'f' }); eyeX(face, 29, 18, 4, 4, expr, { lid: 'f' });
    for (const cx of [18.5, 30.5]) ring(face, cx, 20, 5.1, 'A', 'B', 'a');
    seg(face, 24, 19, 25, 19, 'A');
    if (expr !== 'happy') pxs(face, [[16, 17], [28, 17]], 'W');
    // bushy white brows riding with the expression
    const by = expr === 'surprised' ? 11 : expr === 'happy' ? 12 : 13;
    if (expr === 'worried') { seg(face, 14, 14, 19, 12, 'Z', 2); seg(face, 29, 12, 34, 14, 'Z', 2); }
    else { rect(face, 14, by, 6, 2, 'Z'); rect(face, 29, by, 6, 2, 'Z'); pxs(face, [[13, by + 1], [35, by + 1]], 'Z'); }
    if (expr === 'happy') blushX(face, 13, 35, 26, expr, 'P');
  }
  const acc = G();
  if (!elder) {
    for (const cx of [18.5, 29.5]) { ball(acc, cx, 9.5, 2.6, 2.6, ['W', 'G', 'G'], { th: [0.85, 0.3] }); ring(acc, cx, 9.5, 3.4, 'A', 'B', 'a'); }
    seg(acc, 22, 9, 26, 9, 'A');
    seg(acc, 8, 6, 12, 14, 'A'); px(acc, 8, 6, 'E'); px(acc, 9, 7, 'B'); px(acc, 12, 14, 'a');
  } else {
    seg(acc, 9, 7, 12, 13, 'A'); px(acc, 9, 7, 'E'); px(acc, 10, 8, 'B');
  }
  return finish([[body, 'K', 'f'], [bib, 'k', 'c'], [head, 'K', 'f'], [face, null], [acc, 'K', 'a']]);
}
const WREN_PAL = {
  ...PORCH, K: '#2e1c12', k: '#1e2a33',
  L: '#b07a52', F: '#8a5a3b', f: '#6a4330', D: '#4a2d22',
  H: '#f6ead2', M: '#e9d3b0', m: '#b89c84', N: '#2e1c12', n: '#4a2d22',
  E: '#2e1c12', W: '#cfe7f2', Y: '#f2a541', y: '#c0742a', P: '#d9907a',
  A: '#d9a441', B: '#f2d27a', a: '#8a6a1e', G: '#9fc7d6', g: '#6e93a8',
  C: '#4f6d7a', c: '#34505c', Q: '#6f8f99', T: '#5a3a2a', t: '#3e2618', Z: '#cdbba4',
};
const AMBROSE_PAL = {
  ...WREN_PAL,
  L: '#a8927c', F: '#7a6a5a', f: '#5a4a44', D: '#3e3430', Z: '#efe6d6', n: '#3e3430',
  H: '#efe6d6', M: '#d9cbb0', m: '#a89a88', Y: '#e0c77a', y: '#8a6a1e',
  C: '#5f7a85', c: '#3e5660', Q: '#7f98a0', G: '#cfe7f2', g: '#9ab8c6',
};

// --- Juniper Pell, magpie (3/4, beak left) -----------------------------------
function juniper(expr) {
  const BLK = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 57, 22, 19, BLK, { bias: 0.08 });
  ball(body, 9, 42, 6.5, 4.6, ['M', 'M', 'm', 'n'], { bias: 0.12 });
  ball(body, 39, 42, 6.5, 4.6, ['M', 'm', 'm', 'n'], { bias: 0.0 });
  tint(body, 'Ff', 'I', (x, y) => (x <= 3 || x >= 44) && y >= 40);
  tint(body, 'f', 'i', (x, y) => (x <= 4 || x >= 43) && y >= 44 && (x + y) % 2 === 0);
  ball(body, 24, 44, 8.5, 10, ['M', 'M', 'm', 'n']);
  const apron = G();
  poly(apron, [[15, 38], [33, 38], [36, 48], [12, 48]], 'C');
  tint(apron, 'C', 'Q', (x, y) => x <= 15 || y === 38);
  tint(apron, 'C', 'c', (x) => x >= 32);
  seg(apron, 16, 38, 20, 31, 'C'); seg(apron, 32, 38, 29, 31, 'c');
  for (const [x, y] of [[16, 41], [21, 41], [27, 41], [31, 41], [18, 45], [24, 45], [30, 45]]) { rect(apron, x, y, 3, 2, 'c'); px(apron, x, y, 'x'); }
  px(apron, 28, 41, 'A'); px(apron, 27, 40, 'B');
  const head = G();
  ball(head, 27, 19, 11.5, 11.5, BLK, { bias: 0.05 });
  ball(head, 25, 29, 8, 4, BLK);
  pxs(head, [[23, 9], [25, 9], [27, 8], [24, 10], [22, 11]], 'i');
  const beak = G();
  const open = expr === 'surprised' || expr === 'happy';
  poly(beak, [[18, 16], [7, 20.5], [18, 23]], 'X');
  if (open) { poly(beak, [[18, 21.5], [9, 23.5], [18, 25]], 'x'); pxs(beak, [[16, 22], [15, 22], [14, 23]], 'R'); }
  else poly(beak, [[18, 20.5], [8, 20.8], [18, 24]], 'x');
  pxs(beak, [[16, 17], [14, 18], [12, 19]], 'L');
  const face = G();
  if (expr === 'happy') {
    ring(face, 21.5, 16.5, 3.2, 'n', 'n', 'L');
    eyeX(face, 19, 14, 5, 4, 'happy', { lid: 'E' });
  } else {
    ring(face, 21.5, 16.5, expr === 'surprised' ? 3.7 : 3.2, 'n', 'n', 'L');
    eyeX(face, 20, 15, 4, 4, expr, { lid: 'F' });
  }
  browX(face, 20, 12, 4, 'r', expr, 'L');
  if (expr === 'happy') pxs(face, [[19, 25], [20, 26], [21, 26]], 'L');
  else if (expr === 'worried') { pxs(face, [[19, 26], [20, 25]], 'L'); sweatX(face, 33, 10); }
  else if (expr === 'neutral') pxs(face, [[19, 24], [20, 25]], 'L');
  return finish([[body, 'K', 'K'], [apron, 'K', 'c'], [head, 'K', 'K'], [beak, 'K', 'K'], [face, null]]);
}
const JUNIPER_PAL = {
  ...PORCH, K: '#141b33',
  L: '#4a4862', F: '#2a2838', f: '#1f1d2a', D: '#171522',
  I: '#2a6f8f', i: '#3fae8c',
  M: '#f1eee6', m: '#b9b4c4', n: '#7f7a96',
  E: '#141b33', W: '#f1eee6', X: '#3a3848', x: '#2a2433', R: '#a8323a',
  C: '#c97b2c', c: '#8a4f1a', Q: '#e39a4f',
  A: '#d9a441', B: '#f6e3a0', G: '#9fc7d6',
};

// --- Hesper Coil, garden snail -----------------------------------------------
function hesper(expr) {
  const BODY = ['L', 'F', 'f', 'D'];
  const sat = G();
  ball(sat, 31, 31, 15, 13, ['S', 'C', 'c', 'q'], { bias: 0.05 });
  tint(sat, 'Ccq', 'S', (x, y) => y < 25 && x < 30);
  for (let x = 17; x <= 45; x++) if (sat[30][x] !== '.') sat[30][x] = 'c';
  rect(sat, 33, 29, 3, 3, 'A'); px(sat, 33, 29, 'B'); px(sat, 35, 31, 'a');
  ring(sat, 37, 37, 3.4, 'c', 'C', 'q'); px(sat, 37, 37, 'c');
  const env = G();
  for (const [x, w] of [[22, 6], [30, 6], [38, 5]]) {
    poly(env, [[x, 20], [x + w / 2, 14 + (x % 3)], [x + w, 20]], 'M');
    px(env, x + Math.floor(w / 2), 15 + (x % 3), 'M');
  }
  tint(env, 'M', 'm', (x, y) => y >= 19);
  const body = G();
  ball(body, 21, 50, 17, 7, BODY, { bias: 0.15 });
  ball(body, 21, 39, 10.5, 12, BODY, { bias: 0.05 });
  ball(body, 21, 27, 8, 7.5, BODY, { bias: 0.05 });
  pxs(body, [[8, 47], [9, 46], [11, 45], [13, 45], [30, 45], [32, 46]], 'H');
  // eyestalks: up and wide when surprised, drooping inward when worried
  const tip = { neutral: [[11, 8], [31, 8]], happy: [[10, 9], [32, 9]], worried: [[13, 11], [29, 11]], surprised: [[10, 5], [32, 5]] }[expr];
  const stalk = G();
  seg(stalk, 18, 23, tip[0][0], tip[0][1] + 1, 'F', 2); seg(stalk, 24, 23, tip[1][0] - 1, tip[1][1] + 1, 'F', 2);
  seg(stalk, 18, 23, tip[0][0], tip[0][1] + 1, 'L'); seg(stalk, 25, 23, tip[1][0], tip[1][1] + 1, 'f');
  const R = expr === 'surprised' ? 3.6 : 3;
  for (const [x, y] of tip) {
    if (expr === 'happy') { ball(stalk, x, y, 3, 3, ['F', 'F', 'f'], { th: [0.92, 0.3] }); pxs(stalk, [[x - 2, y + 1], [x - 1, y], [x, y - 1 + 1], [x + 1, y], [x + 2, y + 1]], 'E'); }
    else { ball(stalk, x, y, R, R, ['W', 'E', 'E'], { th: [0.92, 0.3] }); px(stalk, x - 1, y - 1, 'W'); }
    if (expr === 'worried') pxs(stalk, [[x - 2, y - 2], [x - 1, y - 2], [x, y - 3]], 'f');
  }
  const face = G();
  mouthX(face, 20, 31, expr, { line: 'D', dark: 'K', tongue: 'P', w: 2 });
  blushX(face, 15, 27, 29, expr, 'P');
  if (expr === 'worried') sweatX(face, 12, 22, 'G', 'W');
  const letter = G();
  poly(letter, [[9, 40], [25, 38], [27, 47], [10, 48]], 'X');
  tint(letter, 'X', 'x', (x, y) => y >= 46 || x >= 25);
  seg(letter, 10, 41, 18, 44, 'x'); seg(letter, 18, 44, 25, 39, 'x');
  rect(letter, 17, 43, 3, 3, 'Y'); px(letter, 17, 43, 'R');
  return finish([[sat, 'K', 'c'], [env, 'K', 'm'], [body, 'K', 'f'], [stalk, 'K', 'f'], [face, null], [letter, 'K', 'x']]);
}
const HESPER_PAL = {
  ...PORCH, K: '#2e3a2c',
  L: '#c3d0ba', F: '#a9b8a0', f: '#7a8c74', D: '#566a5c', H: '#e9f7f2',
  S: '#ddcca0', C: '#c9b48a', c: '#8c7a5a', q: '#66573e',
  M: '#f4f1e6', m: '#d6ccb4', A: '#d9a441', B: '#f2d27a', a: '#8a6a1e',
  X: '#e8d3a0', x: '#bfa478', Y: '#a8323a', R: '#d0545a',
  E: '#2e3a2c', W: '#e9f7f2', P: '#d9a3a0', G: '#9fc7d6',
};

// --- Linnet Rask, stoat (brown ramp: no purple shadow) -----------------------
function linnet(expr, { ermine = false } = {}) {
  const body = G();
  ball(body, 24, 57, 21, 17, ['O', 'R', 'q', 'k'], { bias: 0.08 });
  poly(body, [[19, 40], [29, 40], [27, 48], [21, 48]], 'v');
  tint(body, 'v', 'e', (x) => x >= 26);
  seg(body, 24, 41, 24, 47, 'e');
  const collar = G();
  poly(collar, [[13, 36], [20, 38], [21, 46], [15, 42]], 'O');
  poly(collar, [[35, 36], [28, 38], [27, 46], [33, 42]], 'R');
  const hair = G();
  ball(hair, 38, 18, 4, 6, ['L', 'F', 'F', 'f'], { bias: 0.15 });
  ball(hair, 39, 26, 2.2, 3.5, ['F', 'F', 'f']);
  rect(hair, 36, 12, 4, 2, 'Y'); px(hair, 36, 12, 'w');
  const FURH = ['L', 'F', 'f', 'D'];
  const head = G();
  ball(head, 14.5, 11, 4, 4, FURH, { th: [0.8, 0.3, -0.1] }); ball(head, 33.5, 11, 4, 4, FURH, { th: [0.8, 0.3, -0.1] });
  ball(head, 24, 20, 11.5, 11, FURH, { th: [0.84, 0.4, -0.02], bias: 0.06 });
  ball(head, 24, 27, 8.5, 6, FURH, { th: [0.84, 0.4, -0.02], bias: 0.06 });
  const face = G();
  ball(face, 14.6, 11.4, 2, 2, ['c', 'c', 'V']); ball(face, 33.6, 11.4, 2, 2, ['c', 'V', 'V']);
  ball(face, 24, 29.5, 6.5, 4, ['w', 'c', 'V'], { th: [0.7, 0.25] });
  ball(face, 24, 34, 5, 3.5, ['w', 'c', 'V'], { th: [0.75, 0.3] });
  eyeX(face, 17, 18, 3, 4, expr, { E: 'k', W: 'w', lid: 'D' });
  eyeX(face, 28, 18, 3, 4, expr, { E: 'k', W: 'w', lid: 'D' });
  if (expr === 'neutral') { px(face, 17, 18, 'f'); px(face, 30, 18, 'f'); }
  // her brows: sharp and angled in (determined) at rest
  if (expr === 'neutral') { pxs(face, [[16, 16], [17, 16], [18, 16], [19, 17]], 'D'); pxs(face, [[31, 16], [30, 16], [29, 16], [28, 17]], 'D'); }
  else { browX(face, 17, 16, 3, 'l', expr, 'D'); browX(face, 28, 16, 3, 'r', expr, 'D'); }
  if (expr !== 'happy') pxs(face, [[17, 22], [18, 22], [29, 22], [30, 22]], 'L');
  rect(face, 23, 25, 3, 2, 'k'); px(face, 23, 25, 'e');
  if (expr === 'neutral') pxs(face, [[24, 27], [24, 28], [23, 29], [22, 29], [25, 29], [26, 29], [27, 28], [28, 27]], 'V'); // the smirk
  else { seg(face, 24, 27, 24, 28, 'V'); mouthX(face, 24, 29, expr, { line: 'V', dark: 'k', tongue: 'P', w: 3 }); }
  if (expr === 'happy' || expr === 'surprised') blushX(face, 14, 34, 25, expr, 'P');
  if (expr === 'worried') sweatX(face, 37, 14, 'i', 'w');
  const fr = G();
  poly(fr, [[15, 12], [28, 7.5], [31, 12], [25, 11], [20, 15]], 'F');
  pxs(fr, [[19, 12], [21, 11], [23, 10], [25, 9], [27, 9]], 'L');
  pxs(fr, [[26, 11], [29, 11]], 'f');
  void ermine;
  return finish([[hair, 'k', 'f'], [body, 'k', 'q'], [collar, 'k', 'q'], [head, 'k', 'f'], [face, null], [fr, 'k', 'f']]);
}
const LINNET_PAL = {
  ...PORCH, k: SW.k,
  L: SW.h, F: SW.u, f: CR.brownDeep, D: CR.brownDark,
  w: SW.w, c: SW.c, V: SW.v, e: SW.e, v: SW.v,
  O: SW.o, R: SW.r, q: '#6e2a2a', Y: SW.y, P: '#e88a7a', i: SW.i,
};

// --- Corin Vale, tawny owl -----------------------------------------------------
function corin(expr) {
  const TAW = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 58, 22, 18, ['e', 'n', 'd', 'k'], { bias: 0.1 });
  ball(body, 24, 38, 12, 5, ['F', 'f', 'D', 'D'], { dither: 0 });
  const head = G();
  ball(head, 24, 20, 15, 15, TAW, { bias: 0.04 });
  // mottling: pale bars and dark streaks over the crown
  tint(head, 'Ff', 'L', (x, y) => y < 17 && (x * 5 + y * 3) % 9 === 0);
  tint(head, 'FL', 'f', (x, y) => y < 15 && (x * 3 + y * 7) % 11 === 0);
  // the pale "eyebrow" V of a tawny owl
  const disc = G();
  ball(disc, 18, 22, 8, 9.5, ['c', 'M', 'm', 'm'], { th: [0.7, 0.3, 0.02] });
  ball(disc, 30, 22, 8, 9.5, ['M', 'm', 'm', 'f'], { th: [0.75, 0.3, 0.02] });
  ball(disc, 24, 30, 6, 5.5, ['M', 'm', 'm']);
  // dark rim of the facial disc
  for (let y = 12; y < 36; y++) for (let x = 6; x < 42; x++) {
    if (disc[y][x] === '.') continue;
    const edge = [[1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => disc[y + dy] && disc[y + dy][x + dx] === '.');
    if (edge) disc[y][x] = 'D';
  }
  const face = G();
  const EY = { neutral: 19, happy: 20, worried: 20, surprised: 18 };
  const ey = EY[expr];
  if (expr === 'happy') {
    for (const x0 of [15, 27]) pxs(face, [[x0, ey + 2], [x0 + 1, ey + 1], [x0 + 2, ey], [x0 + 3, ey], [x0 + 4, ey + 1], [x0 + 5, ey + 2]], 'k');
  } else {
    const r = expr === 'surprised' ? 4.2 : 3.5;
    ball(face, 18, ey + 2, r, r + 0.4, ['k', 'k', 'k']); ball(face, 30, ey + 2, r, r + 0.4, ['k', 'k', 'k']);
    pxs(face, [[17, ey], [16, ey + 1]], 'w');
    // his failing left eye (viewer's right): a milky film
    ball(face, 30.5, ey + 2.5, 2, 2.2, ['v', 'e', 'e']);
    px(face, 29, ey + 1, 'w');
    if (expr === 'worried') { rect(face, 15, ey - 2, 6, 1, 'f'); rect(face, 27, ey - 2, 6, 1, 'f'); }
  }
  // brows: the pale V above the disc
  const by = expr === 'surprised' ? 12 : expr === 'worried' ? 14 : 13;
  if (expr === 'worried') { seg(face, 14, by + 2, 21, by - 1, 'c'); seg(face, 27, by - 1, 34, by + 2, 'c'); }
  else { seg(face, 14, by, 22, by + 3, 'c'); seg(face, 26, by + 3, 34, by, 'c'); }
  // beak: hooked, pale horn; opens when surprised
  poly(face, [[21.5, 25], [26.5, 25], [24, 32]], 'N');
  tint(face, 'N', 'h', (x, y) => x >= 25 || y >= 31);
  px(face, 23, 26, 'W');
  if (expr === 'surprised') { rect(face, 23, 30, 3, 2, 'k'); pxs(face, [[22, 32], [23, 33], [24, 33], [25, 33], [26, 32]], 'h'); }
  if (expr === 'happy') pxs(face, [[13, 27], [14, 27], [34, 27], [35, 27]], 'P');
  // reading glass on its cord
  const glass = G();
  seg(glass, 16, 38, 29, 43, 'a');
  ball(glass, 32, 44, 4, 4, ['y', 'a', 'u']); ball(glass, 32, 44, 2.6, 2.6, ['w', 'i', 's'], { th: [0.85, 0.3] });
  return finish([[body, 'k', 'd'], [head, 'K', 'f'], [disc, null], [face, null], [glass, 'k', 'u']]);
}
const CORIN_PAL = {
  ...PORCH, k: SW.k, K: '#3a2016',
  L: '#c08050', F: '#8a5030', f: '#663a24', D: '#3e2418',
  M: '#e0c090', m: '#b08a5a', c: '#f0dcb0', N: '#e8d8a0', h: '#b8a070', W: '#f6f1e3',
  y: SW.y, a: SW.a, u: SW.u, w: SW.w, v: SW.v, i: SW.i, s: SW.s, P: '#d9907a',
  e: SW.e, n: SW.n, d: SW.d,
};

// --- Idris Fenwake, great northern diver ---------------------------------------
function idris(expr) {
  const FUR = ['L', 'F', 'f', 'D'];
  const body = G();
  ball(body, 24, 58, 21, 18, ['b', 'n', 'd', 'k'], { bias: 0.1 });
  poly(body, [[20, 37], [28, 37], [26, 45], [24, 47], [22, 45]], 'w');
  tint(body, 'w', 'V', (x, y) => x >= 25 || y >= 45);
  const collar = G();
  poly(collar, [[12, 35], [20, 36], [22, 46], [14, 44]], 'n');
  poly(collar, [[36, 35], [28, 36], [26, 46], [34, 44]], 'd');
  tint(collar, 'n', 'b', (x, y) => x <= 14 || y <= 36);
  rect(collar, 23, 41, 2, 2, 'y'); px(collar, 24, 42, 'a');
  pxs(collar, [[16, 39], [16, 40], [16, 41], [15, 41], [17, 41], [15, 38], [16, 38], [17, 38]], 'V'); // anchor pin
  // 3/4 view, bill to the viewer's left: long neck, head turned
  const neck = G();
  ball(neck, 26, 31, 8, 8, FUR);
  // the diver's necklace: a patch of fine vertical white bars on the side of the neck
  for (let x = 28; x <= 32; x += 2) for (let y = 27; y <= 30; y++) px(neck, x, y, 'w');
  for (let x = 29; x <= 31; x += 2) px(neck, x, 26, 'V');
  const head = G();
  ball(head, 28, 18, 11.5, 10.5, FUR, { bias: 0.04 });
  ball(head, 21, 22, 6, 5, FUR);
  tint(head, 'L', 'G', (x, y) => y < 13 && (x + y) % 3 === 0); // green gloss on the crown
  const face = G();
  const eo = { E: 'k', W: 'w', iris: 'R', lid: 'D' };
  if (expr === 'happy') eyeX(face, 21, 15, 4, 3, 'happy', { lid: 'R' });
  else eyeX(face, 21, expr === 'surprised' ? 15 : 16, 4, 3, expr, eo);
  browX(face, 21, 13, 4, 'r', expr, 'L');
  // dagger bill
  const bill = G();
  const open = expr === 'surprised';
  poly(bill, [[18, 18.5], [1, 22.5], [18, 23.5]], 'X');
  if (open) { poly(bill, [[18, 22.5], [3, 25.5], [18, 25.5]], 'x'); seg(bill, 6, 23, 17, 23, 'k'); }
  else { poly(bill, [[18, 21.3], [2, 22.7], [18, 23.5]], 'x'); }
  pxs(bill, [[15, 19], [12, 20], [9, 21]], 'B');
  if (expr === 'happy') pxs(face, [[27, 21], [28, 21], [29, 21]], 'P');
  if (expr === 'worried') sweatX(face, 36, 10, 'i', 'w');
  return finish([[body, 'k', 'd'], [collar, 'k', 'd'], [neck, 'k', 'f'], [head, 'k', 'f'], [face, null], [bill, 'k', 'x']]);
}
const IDRIS_PAL = {
  ...ISLE, k: SW.k,
  L: '#4e6664', F: '#2c3a38', f: '#1a2224', D: '#0f1416', G: '#3f7a6a',
  R: '#c03030', w: SW.w, V: SW.v, e: SW.e, y: SW.y, a: SW.a, P: '#a85a5a', i: SW.i,
  b: SW.b, n: SW.n, d: SW.d, X: '#6a6e7a', x: '#3a3e48', B: '#9aa0ac',
};

// --- Wick Dorrow, puffling --------------------------------------------------------
function wick(expr) {
  const body = G();
  ball(body, 24, 50, 18, 14, ['L', 'F', 'f', 'D'], { bias: 0.08 });
  ball(body, 24, 46, 9, 10, ['H', 'M', 'm'], { th: [0.7, 0.3] }); // white belly
  // little stub wings
  ball(body, 7, 44, 4, 6, ['L', 'F', 'f', 'D']); ball(body, 41, 44, 4, 6, ['F', 'f', 'D', 'D']);
  const head = G();
  ball(head, 24, 24, 15, 13.5, ['L', 'F', 'f', 'D'], { bias: 0.05 });
  // white face disc
  const face = G();
  ball(face, 24, 26, 11, 9.5, ['H', 'M', 'm'], { th: [0.72, 0.28] });
  // the cap: slipping over his eyes unless surprised (pushed up)
  const capY = { neutral: 16, happy: 15, worried: 18, surprised: 11 }[expr];
  const cap = G();
  ball(cap, 24, capY - 3, 15, 9, ['Q', 'C', 'c', 'q'], { only: (x, y) => y <= capY + 2 });
  rect(cap, 9, capY + 1, 31, 3, 'B'); tint(cap, 'B', 'b', (x, y) => y === capY + 3 || x > 34);
  for (let x = 10; x < 39; x += 3) px(cap, x, capY + 2, 'b');
  ball(cap, 24, capY - 11, 3, 3, ['B', 'B', 'b']); // bobble
  const eyes = G();
  const ey = capY + 5; // one row of white face under the cap's shadow so the eyes read
  if (expr === 'happy') { eyeX(eyes, 16, ey, 4, 4, 'happy', { lid: 'E' }); eyeX(eyes, 28, ey, 4, 4, 'happy', { lid: 'E' }); }
  else {
    eyeX(eyes, 16, ey, 4, expr === 'surprised' ? 5 : 3, expr, { lid: 'E' });
    eyeX(eyes, 28, ey, 4, expr === 'surprised' ? 5 : 3, expr, { lid: 'E' });
    // puffin eye-shadow line
    pxs(eyes, [[20, ey + 3], [21, ey + 4], [32, ey + 3], [33, ey + 4]], 'm');
  }
  if (expr === 'worried') { browX(eyes, 16, ey - 2, 4, 'l', 'worried', 'm'); browX(eyes, 28, ey - 2, 4, 'r', 'worried', 'm'); }
  // stubby orange beak
  const beak = G();
  const by = ey + 6;
  poly(beak, [[19, by], [29, by], [27, by + 5], [21, by + 5]], 'N');
  tint(beak, 'N', 'n', (x, y) => y >= by + 3 || x >= 27);
  rect(beak, 20, by + 1, 8, 1, 'Y');
  if (expr === 'surprised') { rect(beak, 22, by + 3, 4, 3, 'K'); }
  if (expr === 'happy') pxs(beak, [[18, by + 1], [30, by + 1]], 'm');
  blushX(eyes, 13, 35, ey + 5, expr, 'P');
  if (expr === 'worried') sweatX(eyes, 37, ey - 4, 'G', 'W');
  return finish([[body, 'K', 'f'], [head, 'K', 'f'], [face, null], [eyes, null], [beak, 'K', 'n'], [cap, 'k', 'c']]);
}
const WICK_PAL = {
  ...PORCH, K: '#141b33', k: '#3a1018',
  L: '#4a4658', F: '#2a2433', f: '#1e1e28', D: '#16141e',
  H: '#f6f1e3', M: '#e6e0d6', m: '#b8b0a8', E: '#141b33', W: '#f6f1e3',
  N: '#f28c28', n: '#c96a1a', Y: '#f6c070',
  Q: '#c84a52', C: '#a3283a', c: '#7a1e2c', q: '#5a1622', B: '#f4e8c1', b: '#d8c79b', P: '#e88a8a', G: '#9fc7d6',
};

// ===========================================================================
// GENERIC BUILDERS (neutral busts for the wider cast)
// ===========================================================================

/** Outfit layer over a shoulder ball. kind: coat | jumper | vest | apron | jersey | overalls | shawl | smock | robe */
function outfit(kind, { collar = true } = {}) {
  const g = G();
  ball(g, 24, 58, 21, 17, ['Q', 'C', 'c', 'k'], { bias: 0.08 });
  if (kind === 'coat' || kind === 'robe') {
    poly(g, [[13, 35], [21, 37], [22, 47], [15, 44]], 'J'); poly(g, [[35, 35], [27, 37], [26, 47], [33, 44]], 'j');
    if (kind === 'coat') { rect(g, 23, 41, 2, 2, 'Y'); px(g, 24, 42, 'a'); }
  } else if (kind === 'jumper') {
    tint(g, 'QCc', 'J', (x, y) => y % 4 < 2);
  } else if (kind === 'vest') {
    poly(g, [[19, 38], [29, 38], [26, 48], [22, 48]], 'J'); tint(g, 'J', 'j', (x) => x >= 26);
    tint(g, 'QCc', 'S', (x) => x < 9 || x > 39);
  } else if (kind === 'apron') {
    poly(g, [[16, 38], [32, 38], [34, 48], [14, 48]], 'J'); tint(g, 'J', 'j', (x) => x >= 30);
    rect(g, 21, 43, 6, 3, 'j'); px(g, 21, 43, 'Y');
  } else if (kind === 'jersey') {
    if (collar) { ball(g, 24, 37, 10, 3, ['J', 'J', 'j'], { dither: 0 }); }
  } else if (kind === 'overalls') {
    poly(g, [[15, 39], [33, 39], [34, 48], [14, 48]], 'J'); tint(g, 'J', 'j', (x) => x >= 30);
    seg(g, 16, 39, 13, 34, 'J', 2); seg(g, 31, 39, 34, 34, 'j', 2);
    rect(g, 17, 40, 2, 2, 'Y'); rect(g, 29, 40, 2, 2, 'Y');
  } else if (kind === 'shawl') {
    ball(g, 24, 44, 22, 9, ['J', 'J', 'j', 'j'], { only: (x, y) => y < 46 });
    poly(g, [[20, 40], [28, 40], [24, 47]], 'C');
  } else if (kind === 'smock') {
    for (const [x, y, c] of [[16, 42, 'Y'], [17, 42, 'Y'], [30, 44, 'o'], [31, 44, 'o'], [22, 46, 'r'], [35, 40, 'Y']]) px(g, x, y, c);
  }
  return g;
}

/**
 * A mammal bust from a spec (neutral). Head is a lit ball; ears, cheeks,
 * muzzle and markings are switched per species.
 */
function furBust(s) {
  const FUR = ['L', 'F', 'f', 'D'];
  const cx = 24, hy = s.headY ?? 20, hrx = s.headRx ?? 12, hry = s.headRy ?? 11.5;
  const ears = G(), head = G(), face = G();
  const ex = s.earX ?? 10;
  const E = s.ears || 'round';
  if (E === 'round' || E === 'small') {
    const r = E === 'small' ? 2.8 : 4;
    ball(ears, cx - ex, hy - hry + 3, r, r, FUR, { th: [0.8, 0.3, -0.1] }); ball(ears, cx + ex, hy - hry + 3, r, r, FUR, { th: [0.8, 0.3, -0.1] });
    ball(face, cx - ex + 0.5, hy - hry + 3.5, r - 2, r - 2, [s.earIn || 'P', s.earIn || 'P', 'f']); ball(face, cx + ex + 0.5, hy - hry + 3.5, r - 2, r - 2, [s.earIn || 'P', 'f', 'f']);
  } else if (E === 'pointed' || E === 'tufted' || E === 'tall' || E === 'long') {
    const top = E === 'tall' ? hy - hry - 9 : E === 'long' ? 0 : hy - hry - 4;
    const w = E === 'long' ? 3.5 : 5;
    poly(ears, [[cx - ex - w, hy - hry + 6], [cx - ex - 1, top], [cx - ex + w, hy - hry + 3]], 'F');
    poly(ears, [[cx + ex + w, hy - hry + 6], [cx + ex + 1, top], [cx + ex - w, hy - hry + 3]], 'f');
    poly(face, [[cx - ex - w + 2, hy - hry + 5], [cx - ex - 1, top + 3], [cx - ex + w - 2, hy - hry + 3]], s.earIn || 'P');
    poly(face, [[cx + ex + w - 2, hy - hry + 5], [cx + ex + 1, top + 3], [cx + ex - w + 2, hy - hry + 3]], s.earIn || 'P');
    if (E === 'tufted') { seg(ears, cx - ex - 1, top, cx - ex - 2, top - 4, 'R'); seg(ears, cx + ex + 1, top, cx + ex + 2, top - 4, 'R'); }
    if (s.earTip) { pxs(ears, [[cx - ex - 1, top], [cx - ex - 1, top + 1], [cx - ex, top + 1]], s.earTip); pxs(ears, [[cx + ex + 1, top], [cx + ex + 1, top + 1], [cx + ex, top + 1]], s.earTip); }
  } else if (E === 'side') { // goat: ears out sideways
    poly(ears, [[cx - hrx + 2, hy - 2], [cx - hrx - 7, hy + 1], [cx - hrx + 2, hy + 3]], 'F');
    poly(ears, [[cx + hrx - 2, hy - 2], [cx + hrx + 7, hy + 1], [cx + hrx - 2, hy + 3]], 'f');
  }
  if (s.horns) { // curving back over the crown
    seg(ears, cx - 6, hy - hry + 4, cx - 9, hy - hry - 6, 'R', 3); seg(ears, cx - 9, hy - hry - 6, cx - 12, hy - hry - 8, 'R', 2);
    seg(ears, cx + 4, hy - hry + 4, cx + 7, hy - hry - 6, 'R', 3); seg(ears, cx + 7, hy - hry - 6, cx + 10, hy - hry - 8, 'R', 2);
    pxs(ears, [[cx - 7, hy - hry], [cx - 8, hy - hry - 3], [cx + 5, hy - hry], [cx + 6, hy - hry - 3]], 'r');
  }
  ball(head, cx, hy, hrx, hry, FUR, { th: [0.84, 0.4, -0.02], bias: 0.06 });
  if (s.cheeks) { ball(head, cx - 8, hy + 6, 6, 5, FUR); ball(head, cx + 8, hy + 6, 6, 5, FUR); }
  const mz = s.muzzle || {};
  const my = hy + (mz.dy ?? 7), mrx = mz.rx ?? 7, mry = mz.ry ?? 5;
  ball(head, cx, my, mrx + 1, mry + 1, FUR, { th: [0.84, 0.4, -0.02], bias: 0.06 });
  if (mz.pale !== false) ball(face, cx, my + 1, mrx, mry, ['H', 'M', 'm'], { th: [0.7, 0.25] });
  if (s.ruff) { // flared cheek ruff with dark bars (lynx)
    poly(head, [[cx - hrx - 2, hy + 2], [cx - hrx - 5, hy + 10], [cx - 6, hy + 11]], 'M');
    poly(head, [[cx + hrx + 2, hy + 2], [cx + hrx + 5, hy + 10], [cx + 6, hy + 11]], 'm');
    seg(face, cx - hrx, hy + 5, cx - hrx - 2, hy + 8, 'R'); seg(face, cx + hrx, hy + 5, cx + hrx + 2, hy + 8, 'R');
  }
  if (s.mask) { // raccoon bandit mask
    poly(face, [[cx - hrx + 1, hy - 3], [cx - 1, hy - 1], [cx - 1, hy + 3], [cx - hrx + 2, hy + 5]], 'R');
    poly(face, [[cx + hrx - 1, hy - 3], [cx + 1, hy - 1], [cx + 1, hy + 3], [cx + hrx - 2, hy + 5]], 'R');
    rect(face, cx - 1, hy - 7, 2, 7, 'R');
    ball(face, cx - 6, hy - 5, 4, 1.5, ['H', 'M', 'M']); ball(face, cx + 6, hy - 5, 4, 1.5, ['M', 'M', 'm']);
  }
  if (s.blaze) poly(face, [[cx - 1.5, hy - hry + 2], [cx + 1.5, hy - hry + 2], [cx + 2.5, my - 2], [cx - 2.5, my - 2]], 'M');
  if (s.mottle) tint(head, 'Ff', 'R', (x, y) => (x * 7 + y * 5) % 13 === 0 && y < my - 2);
  const ey = s.eyeY ?? hy - 2, edx = s.eyeDx ?? 6, ew = s.eyeW ?? 3, eh = s.eyeH ?? 4;
  if (s.eyeRing) { ball(face, cx - edx + ew / 2 - 1, ey + eh / 2, ew / 2 + 1.6, eh / 2 + 1.2, [s.eyeRing, s.eyeRing, s.eyeRing]); ball(face, cx + edx - ew / 2 + 1, ey + eh / 2, ew / 2 + 1.6, eh / 2 + 1.2, [s.eyeRing, s.eyeRing, s.eyeRing]); }
  eyeX(face, cx - edx - 1, ey, ew, eh, 'neutral', { E: 'E', W: 'W', iris: s.iris });
  eyeX(face, cx + edx - ew + 1, ey, ew, eh, 'neutral', { E: 'E', W: 'W', iris: s.iris });
  if (s.lids) { rect(face, cx - edx - 1, ey, ew, 1, 'f'); rect(face, cx + edx - ew + 1, ey, ew, 1, 'f'); }
  if (s.brows !== false) { browX(face, cx - edx - 1, ey - 2, ew, 'l', 'neutral', s.browCh || 'D'); browX(face, cx + edx - ew + 1, ey - 2, ew, 'r', 'neutral', s.browCh || 'D'); }
  const nw = s.noseW ?? 3, ny = my - (mz.noseUp ?? 3);
  rect(face, cx - Math.floor(nw / 2), ny, nw, s.noseH ?? 2, 'N'); px(face, cx - Math.floor(nw / 2), ny, s.noseHi || 'n');
  if (s.mouth !== false) { seg(face, cx, ny + 2, cx, ny + 3, 'm'); mouthX(face, cx, ny + 3, 'neutral', { line: 'm', w: 2 }); }
  if (s.chinSpot) ball(face, cx, my + mry + 1, 3, 2, ['H', 'M', 'M']);
  if (s.whiskers) pxs(face, [[cx - 5, my], [cx - 3, my - 1], [cx + 5, my], [cx + 3, my - 1], [cx - 4, my + 2], [cx + 4, my + 2]], 'm');
  if (s.beard) ball(face, cx, my + mry + 3, 3.5, 4, ['M', 'M', 'm']);
  if (s.blush) blushX(face, cx - edx - 3, cx + edx + 3, ey + eh + 2, 'neutral', 'P');
  const body = outfit(s.outfit || 'coat');
  const extra = G();
  if (s.extra) s.extra(extra, { cx, hy, hrx, hry, ey, my, face, head });
  return finish([[body, 'k', 'c'], [ears, 'K', 'f'], [head, 'K', 'f'], [face, null], [extra, 'k', s.extraSoft || 'c']]);
}

/** A bird bust from a spec (neutral): head ball, beak type, crest / patches. */
function birdBust(s) {
  const FUR = ['L', 'F', 'f', 'D'];
  const cx = 24, hy = s.headY ?? 20, hrx = s.headRx ?? 12.5, hry = s.headRy ?? 12;
  const back = G(), head = G(), face = G(), beak = G();
  if (s.neck !== false) ball(head, cx, hy + 12, s.neckRx ?? 9, 7, FUR);
  ball(head, cx, hy, hrx, hry, FUR, { bias: 0.04 });
  if (s.crest) s.crest(back, { cx, hy, hrx, hry });
  if (s.patch) s.patch(face, { cx, hy, hrx, hry });
  const ey = s.eyeY ?? hy - 2, edx = s.eyeDx ?? 7, ew = s.eyeW ?? 3, eh = s.eyeH ?? 3;
  if (s.eyeRing) { ball(face, cx - edx + 0.5, ey + eh / 2, ew / 2 + 1.5, eh / 2 + 1.5, [s.eyeRing, s.eyeRing, s.eyeRing]); ball(face, cx + edx - 0.5, ey + eh / 2, ew / 2 + 1.5, eh / 2 + 1.5, [s.eyeRing, s.eyeRing, s.eyeRing]); }
  eyeX(face, cx - edx - 1, ey, ew, eh, 'neutral', { E: s.E || 'E', W: 'W', iris: s.iris });
  eyeX(face, cx + edx - ew + 1, ey, ew, eh, 'neutral', { E: s.E || 'E', W: 'W', iris: s.iris });
  const by = s.beakY ?? hy + 2;
  const T = s.beak || 'short';
  if (T === 'short') { poly(beak, [[cx - 4, by], [cx + 4, by], [cx, by + 7]], 'X'); }
  else if (T === 'dagger') { poly(beak, [[cx - 3.5, by], [cx + 3.5, by], [cx + 1, by + 13], [cx - 1, by + 13]], 'X'); }
  else if (T === 'hook') { poly(beak, [[cx - 3, by], [cx + 3, by], [cx + 1.5, by + 11], [cx, by + 13], [cx - 1.5, by + 11]], 'X'); pxs(beak, [[cx, by + 12], [cx - 1, by + 12]], 'x'); }
  else if (T === 'broad') { poly(beak, [[cx - 5, by], [cx + 5, by], [cx + 4, by + 9], [cx - 4, by + 9]], 'X'); rect(beak, cx - 2, by + 8, 4, 2, 'W'); }
  else if (T === 'tube') { poly(beak, [[cx - 3, by], [cx + 3, by], [cx + 1, by + 8], [cx - 1, by + 8]], 'X'); rect(beak, cx - 1, by, 2, 3, 'x'); }
  tint(beak, 'X', 'x', (x, y) => x > cx || y > by + (T === 'dagger' || T === 'hook' ? 10 : 5));
  pxs(beak, [[cx - 2, by + 1], [cx - 1, by + 2]], 'W');
  const body = outfit(s.outfit || 'coat');
  const extra = G();
  if (s.extra) s.extra(extra, { cx, hy, hrx, hry, ey, by, face, head });
  return finish([[body, 'k', 'c'], [back, 'K', 'f'], [head, 'K', 'f'], [face, null], [beak, 'K', 'x'], [extra, 'k', s.extraSoft || 'c']]);
}

// ===========================================================================
// NEUTRAL BUSTS
// ===========================================================================
const hat = {
  // Harbor Warden cap: navy crown, brass badge, peak over the brow
  warden(g, { cx, hy, hry }) {
    const top = hy - hry - 1;
    ball(g, cx, top + 3, 13, 5, ['C', 'C', 'c'], { only: (x, y) => y <= top + 5 });
    rect(g, cx - 13, top + 6, 26, 2, 'c'); rect(g, cx - 14, top + 8, 20, 1, 'k');
    rect(g, cx - 2, top + 2, 4, 3, 'Y'); px(g, cx - 2, top + 2, 'y');
  },
  straw(g, { cx, hy, hry }) {
    const top = hy - hry - 2;
    ball(g, cx, top + 3, 9, 5, ['Y', 'Y', 'y'], { only: (x, y) => y <= top + 5 });
    rect(g, cx - 9, top + 4, 18, 2, 'R');
    ball(g, cx, top + 7, 19, 2.5, ['Y', 'Y', 'y']);
  },
  flat(g, { cx, hy, hry }) {
    const top = hy - hry;
    ball(g, cx, top + 3, 12, 4.5, ['J', 'J', 'j'], { only: (x, y) => y <= top + 5 });
    poly(g, [[cx - 12, top + 5], [cx + 6, top + 5], [cx + 2, top + 8], [cx - 13, top + 8]], 'j');
  },
  souwester(g, { cx, hy, hry }) {
    const top = hy - hry - 2;
    ball(g, cx, top + 4, 12, 6, ['Y', 'Y', 'y'], { only: (x, y) => y <= top + 7 });
    poly(g, [[cx - 17, top + 8], [cx + 17, top + 8], [cx + 19, top + 12], [cx - 19, top + 12]], 'y');
    seg(g, cx - 10, top + 5, cx + 10, top + 5, 'y');
  },
  turban(g, { cx, hy, hry }) {
    const top = hy - hry - 4;
    ball(g, cx, top + 6, 13, 7, ['Q', 'C', 'c'], { only: (x, y) => y <= top + 9 });
    seg(g, cx - 12, top + 9, cx + 8, top + 2, 'c'); seg(g, cx - 6, top + 9, cx + 12, top + 4, 'c');
  },
  beret(g, { cx, hy, hry }) {
    const top = hy - hry - 3;
    ball(g, cx + 2, top + 4, 12, 5, ['U', 'J', 'j'], { only: (x, y) => y <= top + 6 });
    px(g, cx + 2, top - 2, 'J'); px(g, cx + 2, top - 1, 'J');
  },
  headband(g, { cx, hy }) { for (let x = cx - 13; x <= cx + 13; x++) { px(g, x, hy - 6, 'C'); px(g, x, hy - 5, 'C'); px(g, x, hy - 4, 'c'); } },
  headlamp(g, { cx, hy }) {
    for (let x = cx - 13; x <= cx + 13; x++) { px(g, x, hy - 8, 'S'); px(g, x, hy - 7, 'S'); }
    rect(g, cx - 3, hy - 11, 6, 5, 'Y'); ball(g, cx, hy - 8.5, 1.8, 1.8, ['X', 'X', 'X']);
  },
  goggles(g, { cx, hy }) {
    for (let x = cx - 13; x <= cx + 13; x++) px(g, x, hy - 8, 'S');
    for (const ox of [-5, 5]) { ball(g, cx + ox, hy - 9, 3.6, 3, ['G', 'G', 'g']); ring(g, cx + ox, hy - 9, 3.6, 'Y', 'y', 'a'); }
  },
};

const BUSTS = {};
// Residents ---------------------------------------------------------------------
BUSTS.augusta = () => furBust({
  ears: 'none', headRx: 12.5, headRy: 11.5, muzzle: { rx: 8, ry: 5.5, dy: 7 }, eyeY: 17, eyeW: 4, eyeH: 4, eyeDx: 7, whiskers: true, mottle: true, noseW: 5,
  outfit: 'coat', extra: hat.warden,
});
BUSTS.tully = () => furBust({
  ears: 'small', earX: 11, headRx: 14, headRy: 11, muzzle: { rx: 8, ry: 5, dy: 7 }, eyeW: 3, eyeH: 3, eyeY: 19, noseW: 7, noseH: 3, noseUp: 4,
  outfit: 'jersey', extra: hat.headband,
});
BUSTS.bryony = () => furBust({
  ears: 'small', earX: 9, headRx: 12, headRy: 11, muzzle: { rx: 6, ry: 4, dy: 7 }, eyeY: 18, eyeRing: 'M', blush: true,
  outfit: 'apron', extra: hat.straw,
});
BUSTS.thessaly = () => furBust({
  ears: 'long', earX: 7, headY: 23, headRx: 11, headRy: 10.5, muzzle: { rx: 4.5, ry: 6, dy: 8, noseUp: -3 }, eyeY: 20, noseW: 3, mouth: false, blush: true, earIn: 'P',
  outfit: 'coat',
});
BUSTS.tamsin = () => furBust({
  ears: 'small', headRx: 12, muzzle: { rx: 6, ry: 5.5, dy: 7, pale: true }, eyeY: 18, noseW: 4,
  outfit: 'jersey',
  extra(g, { cx, hy, hry, face }) {
    // the badger stripes: two black bands over the eyes up the crown
    for (const ox of [-7, 7]) poly(face, [[cx + ox - 2, hy - hry + 2], [cx + ox + 2, hy - hry + 2], [cx + ox + 2.5, hy + 5], [cx + ox - 2.5, hy + 5]], 'R');
    // knit cap
    const top = hy - hry - 1;
    ball(g, cx, top + 3, 12, 5, ['C', 'C', 'c'], { only: (x, y) => y <= top + 5 });
    rect(g, cx - 12, top + 5, 24, 2, 'J');
    eyeX(face, cx - 7, hy - 2, 3, 3, 'neutral', {}); eyeX(face, cx + 4, hy - 2, 3, 3, 'neutral', {});
  },
});
BUSTS.pip = () => furBust({
  ears: 'round', earX: 9, headRx: 11, headRy: 10.5, muzzle: { rx: 5.5, ry: 5.5, dy: 7 }, eyeY: 19, whiskers: true,
  outfit: 'jersey', extra: hat.flat,
});
BUSTS.thatch = () => {
  // the crew bust: goldfinches on a thatched ridge, one carrying a straw
  const g = G(), f = G(), ridge = G();
  rect(ridge, 2, 39, 44, 9, 'T'); for (let x = 2; x < 46; x += 3) seg(ridge, x, 39, x - 2, 47, 't');
  const finch = (x, y, s, faceLeft) => {
    ball(g, x, y + 8 * s, 7.5 * s, 7 * s, ['L', 'F', 'f', 'D']);            // buff breast
    ball(g, x, y, 6.5 * s, 6 * s, ['L', 'F', 'f', 'D']);                   // head
    ball(f, x + (faceLeft ? 4 : -4) * s, y + 9 * s, 4 * s, 5 * s, ['S', 'S', 'S']); // black wing
    rect(f, x + (faceLeft ? 2 : -6) * s, y + 8 * s, 4 * s, 2, 'Y');         // gold wing bar
    ball(f, x, y - 3 * s, 6 * s, 3 * s, ['S', 'S', 'S'], { only: (xx, yy) => yy <= y - 2 * s }); // black cap
    ball(f, x + (faceLeft ? -1 : 1), y + 0.5 * s, 4 * s, 3.4 * s, ['R', 'R', 'r']); // red face
    ball(f, x + (faceLeft ? 3 : -3) * s, y + 3 * s, 2.6 * s, 2 * s, ['M', 'M', 'M']); // white cheek
    const ex = x + (faceLeft ? -2 : 2) * s;
    rect(f, ex - 1, y - 1, 2, 2, 'E'); px(f, ex - 1, y - 1, 'W');
    const bx = x + (faceLeft ? -5 : 5) * s;
    poly(f, faceLeft ? [[bx + 2, y], [bx - 3, y + 1.5], [bx + 2, y + 3]] : [[bx - 2, y], [bx + 3, y + 1.5], [bx - 2, y + 3]], 'N');
  };
  finch(34, 19, 0.75, true);
  finch(13, 20, 1, false);
  finch(31, 25, 1, true);
  seg(f, 18, 32, 44, 26, 'Y'); seg(f, 19, 33, 45, 27, 'y'); // the straw for the roofs
  return finish([[ridge, 'k', 't'], [g, 'K', 'f'], [f, null]]);
};
BUSTS.isolde = () => birdBust({
  headRx: 11.5, headRy: 11, beak: 'tube', beakY: 21, eyeY: 17, eyeDx: 6, outfit: 'shawl',
  extra(g, { cx, ey }) {
    // round reading spectacles
    for (const ox of [-6, 6]) ring(g, cx + ox - 0.5, ey + 1.5, 4.2, 'A', 'B', 'a');
    seg(g, cx - 2, ey + 1, cx + 1, ey + 1, 'A');
    // grey at the brow: she is old
    pxs(g, [[cx - 4, ey - 6], [cx - 2, ey - 7], [cx, ey - 7], [cx + 2, ey - 6]], 'M');
  },
  extraSoft: 'a',
});
BUSTS.ludo = () => {
  const FUR = ['L', 'F', 'f', 'D'];
  const wings = G(), head = G(), face = G();
  // folded wings like a cloak, clawed thumbs at the top
  poly(wings, [[2, 48], [6, 30], [16, 36], [24, 34], [32, 36], [42, 30], [46, 48]], 'V');
  tint(wings, 'V', 'v', (x, y) => x > 30 || y > 44);
  for (const x of [10, 18, 30, 38]) seg(wings, x, 36, x + (x < 24 ? -3 : 3), 48, 'v');
  pxs(wings, [[6, 29], [42, 29]], 'S');
  // tall ears
  poly(head, [[11, 20], [9, 3], [19, 12]], 'F'); poly(head, [[37, 20], [39, 3], [29, 12]], 'f');
  poly(face, [[12, 17], [10.5, 7], [16, 12]], 'P'); poly(face, [[36, 17], [37.5, 7], [32, 12]], 'P');
  ball(head, 24, 24, 12, 11, FUR, { bias: 0.05 });
  ball(head, 24, 31, 7, 5.5, FUR);
  ball(face, 24, 31, 5.5, 4.5, ['M', 'M', 'm']);
  eyeX(face, 16, 21, 4, 4, 'neutral', {}); eyeX(face, 28, 21, 4, 4, 'neutral', {});
  rect(face, 22, 29, 5, 2, 'N'); pxs(face, [[22, 29]], 'n');
  mouthX(face, 24, 32, 'neutral', { line: 'm', w: 2 });
  // his lantern, held up by the cord
  const lamp = G();
  seg(lamp, 38, 34, 38, 38, 'k');
  rect(lamp, 35, 38, 7, 8, 'A'); rect(lamp, 36, 39, 5, 6, 'X'); px(lamp, 36, 39, 'W');
  return finish([[wings, 'K', 'v'], [head, 'K', 'f'], [face, null], [lamp, 'k', 'a']]);
};
BUSTS.barnaby = () => {
  const BR = ['L', 'F', 'f', 'D'];
  const claws = G();
  ball(claws, 8, 38, 6, 5, ['Q', 'R', 'r', 's']);
  ball(claws, 5, 30, 3, 6, ['Q', 'R', 'r', 's']);
  ball(claws, 10.5, 30.5, 2.5, 4.5, ['Q', 'R', 'r', 's']);
  poly(claws, [[6.5, 25], [9.5, 25], [8.5, 33], [7.5, 33]], '.');
  ball(claws, 40.5, 41, 4, 3.5, ['Q', 'R', 'r', 's']);
  ball(claws, 43, 37.5, 2, 2.6, ['Q', 'R', 'r', 's']);
  px(claws, 42, 38, '.'); px(claws, 42, 37, '.');
  for (const x of [15, 20, 28, 33]) { seg(claws, x, 43, x + (x < 24 ? -1 : 1), 47, 'r', 2); px(claws, x, 43, 'R'); }
  const helmet = G();
  ball(helmet, 24, 4.5, 3, 2.2, BR); rect(helmet, 23, 5, 3, 3, 'f'); px(helmet, 23, 5, 'L');
  ball(helmet, 24, 22, 17, 16.5, BR, { bias: 0.02 });
  const collar = G();
  ball(collar, 24, 39.5, 16, 4, BR, { th: [0.8, 0.45, 0.15] });
  for (const x of [11, 18, 24, 30, 37]) px(collar, x, 39, 'W');
  const port = G();
  ball(port, 22, 22, 9.5, 9.5, BR, { light: [0.45, 0.55, 0.7] });
  ball(port, 22, 22, 7.5, 7.5, ['H', 'G', 'G', 'g'], { th: [0.9, 0.5, 0.05] });
  tint(port, 'Gg', 'H', (x, y) => (x + y) % 2 === 0 && (x - 22) + (y - 22) > 5 && Math.hypot(x + 0.5 - 22, y + 0.5 - 22) < 7.5);
  for (const [x, y] of [[21, 13], [30, 21], [22, 30], [13, 22]]) px(port, x, y, 'W');
  seg(port, 19, 27, 19, 20, 'g'); seg(port, 25, 27, 25, 20, 'g');
  rect(port, 18, 18, 2, 3, 'E'); rect(port, 24, 18, 2, 3, 'E'); px(port, 18, 18, 'W'); px(port, 24, 18, 'W');
  pxs(port, [[20, 28], [21, 29], [22, 29], [23, 28]], 's');
  pxs(port, [[17, 17], [16, 18]], 'W');
  return finish([[claws, 'K', 'r'], [helmet, 'K', 'f'], [collar, 'K', 'f'], [port, null]]);
};
BUSTS.dimity = () => {
  const wings = G(), body = G(), face = G();
  // spread rosy-maple wings: yellow band between pink base and tip
  for (const s of [-1, 1]) {
    poly(wings, [[24, 30], [24 + s * 22, 14], [24 + s * 23, 34], [24 + s * 12, 46]], 'F');
    poly(wings, [[24, 30], [24 + s * 17, 20], [24 + s * 18, 34], [24 + s * 9, 42]], 'Y');
    poly(wings, [[24, 30], [24 + s * 9, 25], [24 + s * 9, 35]], 'F');
  }
  tint(wings, 'F', 'f', (x, y) => x > 34 || y > 40);
  tint(wings, 'Y', 'y', (x, y) => x > 34 || y > 38);
  ball(body, 24, 38, 6, 10, ['M', 'Y', 'y']);
  ball(body, 24, 22, 9.5, 9, ['M', 'Y', 'y', 'm']);
  // fuzzy collar
  tint(body, 'Yy', 'M', (x, y) => y > 29 && y < 32 && (x + y) % 2 === 0);
  // feathery antennae
  seg(face, 19, 14, 12, 3, 'K'); seg(face, 29, 14, 36, 3, 'K');
  for (let i = 0; i < 4; i++) { px(face, 13 + i * 2, 4 + i * 3, 'f'); px(face, 35 - i * 2, 4 + i * 3, 'f'); }
  eyeX(face, 17, 20, 4, 4, 'neutral', {}); eyeX(face, 27, 20, 4, 4, 'neutral', {});
  mouthX(face, 24, 26, 'neutral', { line: 'K', w: 2 });
  blushX(face, 15, 33, 26, 'neutral', 'P');
  return finish([[wings, 'K', 'f'], [body, 'K', 'y'], [face, null]]);
};
BUSTS.ansel = () => {
  const FUR = ['L', 'F', 'f', 'D'];
  const body = G(), head = G(), face = G(), bill = G();
  ball(body, 24, 56, 20, 15, ['Q', 'C', 'c', 'k'], { bias: 0.1 });
  poly(body, [[18, 40], [24, 44], [30, 40], [30, 48], [18, 48]], 'c');
  for (const y of [43, 46]) { px(body, 21, y, 'Y'); px(body, 31, y, 'Y'); }
  // long neck rising out of the coat collar, white with the dark streak
  ball(head, 26, 38, 6, 12, ['M', 'M', 'm'], { th: [0.6, 0.2] });
  for (let y = 30; y < 46; y += 2) px(face, 26, y, 'R');
  ball(head, 27, 17, 10, 8.5, ['M', 'M', 'm', 'm'], { bias: 0.06 });
  // the dark crest plume trailing back
  poly(face, [[27, 12], [36, 12], [46, 18], [36, 15], [27, 15]], 'R');
  // tired eye; harbormaster's cap
  eyeX(face, 21, 15, 3, 3, 'neutral', { E: 'E' }); rect(face, 21, 15, 3, 1, 'f'); px(face, 20, 16, 'Y'); px(face, 24, 16, 'Y');
  // dagger bill out to the left
  poly(bill, [[20, 17], [1, 22], [20, 21]], 'N');
  poly(bill, [[20, 19.5], [2, 22], [20, 22]], 'n');
  const cap = G();
  ball(cap, 28, 9, 10, 5, ['C', 'C', 'c'], { only: (x, y) => y <= 11 });
  rect(cap, 18, 11, 17, 2, 'c'); rect(cap, 15, 13, 10, 1, 'k'); rect(cap, 27, 6, 3, 2, 'Y');
  return finish([[body, 'K', 'f'], [head, 'K', 'f'], [face, null], [bill, 'K', 'n'], [cap, 'k', 'c']]);
};
BUSTS.odile = () => {
  const body = G(), head = G(), face = G(), bill = G();
  ball(body, 24, 56, 21, 16, ['Q', 'C', 'c', 'k'], { bias: 0.08 });
  for (const [x, y, ch] of [[14, 42, 'Y'], [15, 42, 'Y'], [31, 44, 'o'], [32, 44, 'o'], [22, 46, 'P'], [36, 40, 'Y'], [19, 45, 'o']]) px(body, x, y, ch);
  ball(head, 26, 36, 6.5, 8, ['L', 'F', 'f'], { th: [0.7, 0.3] });
  ball(head, 26, 20, 11, 10, ['M', 'M', 'm', 'm'], { bias: 0.04 }); // bald greenish head
  tint(head, 'Mm', 'F', (x, y) => y > 26);
  eyeX(face, 21, 17, 3, 3, 'neutral', { E: 'E', iris: 'R' });
  // the spoon bill sweeping down-left
  poly(bill, [[21, 21], [10, 31], [12, 33], [23, 25]], 'N');
  ball(bill, 9, 34, 4.5, 3.5, ['N', 'N', 'n']);
  seg(bill, 21, 23, 11, 32, 'n');
  // beret, a paintbrush tucked in
  const hatL = G();
  hat.beret(hatL, { cx: 26, hy: 20, hry: 10 });
  seg(hatL, 36, 6, 44, 0, 'a'); px(hatL, 44, 0, 'R'); px(hatL, 45, 0, 'R');
  return finish([[body, 'k', 'c'], [head, 'K', 'f'], [face, null], [bill, 'K', 'n'], [hatL, 'k', 'c']]);
};

// Isle folk, Spire leaders, Summit, Champion -------------------------------------
BUSTS.maud = () => birdBust({ headRx: 12, beak: 'broad', beakY: 21, eyeY: 17, outfit: 'coat', extra: hat.souwester });
BUSTS.osric = () => {
  const FUR = ['L', 'F', 'f', 'D'];
  const shell = G(), head = G(), face = G();
  // the carapace rising behind the shoulders
  ball(shell, 24, 52, 24, 20, ['H', 'T', 't', 'r'], { bias: 0.1 });
  for (const [x0, y0, x1, y1] of [[8, 36, 14, 48], [40, 36, 34, 48], [14, 34, 34, 34]]) seg(shell, x0, y0, x1, y1, 'r');
  const body = outfit('apron');
  // wrinkled neck stretched up, bald dome head, hooded eyes, horn beak
  ball(head, 24, 33, 8, 9, FUR);
  for (let y = 28; y < 40; y += 3) seg(face, 18, y, 30, y + 1, 'f');
  ball(head, 24, 19, 11, 10, FUR, { bias: 0.05 });
  // hooded old eyes: a dark lid fold over a bright eye with a glint
  for (const x0 of [16, 28]) { ball(face, x0 + 2, 18, 3.4, 2.8, ['L', 'L', 'F']); rect(face, x0, 17, 4, 3, 'E'); px(face, x0 + 1, 18, 'W'); rect(face, x0 - 1, 16, 6, 1, 'D'); }
  // horn beak, pale and hooked
  poly(face, [[18, 23], [30, 23], [28, 28], [24, 31], [20, 28]], 'M'); tint(face, 'M', 'm', (x, y) => y >= 28 || x >= 27);
  seg(face, 19, 26, 29, 26, 'D'); pxs(face, [[21, 23], [22, 24]], 'H');
  pxs(face, [[22, 21], [26, 21]], 'N');
  // stonecutter's chisel tucked at the apron
  const tool = G(); seg(tool, 33, 40, 37, 47, 'S', 2); rect(tool, 32, 39, 3, 2, 'Y');
  return finish([[shell, 'K', 't'], [body, 'k', 'c'], [head, 'K', 'f'], [face, null], [tool, 'k', 'S']]);
};
BUSTS.ines = () => furBust({
  ears: 'none', headRx: 14, headRy: 10, headY: 22, muzzle: { rx: 11, ry: 4.5, dy: 6, pale: false }, eyeY: 17, eyeDx: 9, eyeW: 4, eyeH: 3, eyeRing: 'W', mottle: true,
  noseW: 2, noseH: 1, mouth: false, brows: false, outfit: 'robe',
  extra(g, { cx, hy, face }) {
    // wide newt smile and the orange spotted throat
    seg(face, cx - 9, hy + 4, cx + 9, hy + 4, 'D');
    ball(face, cx, hy + 9, 9, 3, ['M', 'M', 'm']);
    for (const [x, y] of [[cx - 4, hy + 8], [cx + 3, hy + 9], [cx - 1, hy + 10], [cx + 6, hy + 8]]) px(face, x, y, 'R');
    hat.turban(g, { cx, hy, hry: 10 });
  },
});
BUSTS.wendel = () => birdBust({
  headRx: 11, headRy: 11, beak: 'dagger', beakY: 21, eyeY: 17, eyeDx: 6, iris: 'R', E: 'E', outfit: 'overalls',
  crest(g, { cx, hy, hry }) {
    // the double black crest
    poly(g, [[cx - 9, hy - 4], [cx - 12, hy - hry - 7], [cx - 3, hy - hry + 1]], 'S');
    poly(g, [[cx + 9, hy - 4], [cx + 12, hy - hry - 7], [cx + 3, hy - hry + 1]], 'S');
    // chestnut tippets flaring past the jaw, edged black
    poly(g, [[cx - 9, hy + 1], [cx - 19, hy + 9], [cx - 15, hy + 16], [cx - 5, hy + 12]], 'R');
    poly(g, [[cx + 9, hy + 1], [cx + 19, hy + 9], [cx + 15, hy + 16], [cx + 5, hy + 12]], 'R');
    tint(g, 'R', 'S', (x, y) => y > hy + 12 || Math.abs(x - cx) > 16);
  },
  patch(f, { cx, hy }) { ball(f, cx, hy + 1, 9, 8, ['M', 'M', 'm']); rect(f, cx - 8, hy - 10, 16, 3, 'S'); },
});
BUSTS.ada = () => birdBust({
  headRx: 12, beak: 'short', beakY: 22, eyeY: 15, eyeW: 4, eyeH: 4, outfit: 'vest', E: 'F', brows: false,
  patch(f, { cx, hy }) {
    // the grey hood over the nape and cheeks
    tint(f, '.', 'R', (x, y) => y > hy - 7 && y < hy + 12 && Math.abs(x - cx) > 6 && Math.hypot(x - cx, (y - hy) * 1.05) < 12.6);
    tint(f, 'R', 'r', (x, y) => x > cx + 8 && y > hy);
  },
  extra(g, { cx, ey, face }) {
    // the jackdaw's pale silver eye: W iris ring round a small dark pupil
    for (const x0 of [cx - 8, cx + 4]) { rect(face, x0, ey, 4, 4, 'W'); rect(face, x0 + 1, ey + 1, 2, 2, 'E'); px(face, x0, ey, 'w'); px(face, x0 + 3, ey + 3, 'w'); }
    poly(g, [[12, 36], [36, 36], [34, 40], [14, 40]], 'P'); poly(g, [[14, 39], [18, 39], [17, 47], [13, 46]], 'P');
  },
});
BUSTS.ivo = () => birdBust({
  headRx: 12, beak: 'short', beakY: 22, eyeY: 15, eyeW: 4, eyeH: 4, outfit: 'vest', E: 'F', brows: false,
  patch(f, { cx, hy }) {
    // the grey hood over the nape and cheeks
    tint(f, '.', 'R', (x, y) => y > hy - 7 && y < hy + 12 && Math.abs(x - cx) > 6 && Math.hypot(x - cx, (y - hy) * 1.05) < 12.6);
    tint(f, 'R', 'r', (x, y) => x > cx + 8 && y > hy);
  },
  extra(g, { cx, ey, face }) {
    // the jackdaw's pale silver eye: W iris ring round a small dark pupil
    for (const x0 of [cx - 8, cx + 4]) { rect(face, x0, ey, 4, 4, 'W'); rect(face, x0 + 1, ey + 1, 2, 2, 'E'); px(face, x0, ey, 'w'); px(face, x0 + 3, ey + 3, 'w'); }
    poly(g, [[12, 36], [36, 36], [34, 40], [14, 40]], 'P'); poly(g, [[30, 39], [34, 39], [35, 46], [31, 47]], 'P');
  },
});
BUSTS.seraphine = () => furBust({
  ears: 'round', earX: 10, headRx: 12, cheeks: true, muzzle: { rx: 6, ry: 4.5, dy: 7 }, eyeY: 18, noseW: 3,
  outfit: 'coat', extra: hat.headlamp,
});
BUSTS.hollis = () => furBust({
  ears: 'side', horns: true, headRx: 10.5, headRy: 12, muzzle: { rx: 6, ry: 6, dy: 9 }, eyeY: 17, beard: true, lids: true,
  outfit: 'coat',
});
BUSTS.agathe = () => birdBust({
  headRx: 11.5, beak: 'hook', beakY: 20, eyeY: 16, eyeDx: 6, E: 'E', iris: 'G', outfit: 'coat',
  crest(g, { cx, hy, hry }) { poly(g, [[cx + 2, hy - hry + 1], [cx + 8, hy - hry - 6], [cx + 9, hy - hry + 3]], 'F'); },
  patch(f, { cx, hy }) {
    ball(f, cx - 5, hy + 4, 3, 2.4, ['Y', 'Y', 'y']); ball(f, cx + 5, hy + 4, 3, 2.4, ['Y', 'y', 'y']);
    ball(f, cx - 8, hy + 7, 3.5, 3, ['M', 'M', 'm']); ball(f, cx + 8, hy + 7, 3.5, 3, ['M', 'm', 'm']);
  },
  extra(g) { rect(g, 6, 41, 6, 3, 'k'); }, // mourning band on the sleeve
});
BUSTS.teo = () => furBust({
  ears: 'pointed', earX: 9, earIn: 'M', headRx: 12, cheeks: true, mask: true, muzzle: { rx: 6, ry: 4.5, dy: 7 }, eyeY: 17, noseW: 3,
  outfit: 'vest', extra: hat.goggles,
});
BUSTS.dov = () => furBust({
  ears: 'small', earX: 13, headY: 21, headRx: 12.5, headRy: 11, muzzle: { rx: 4.5, ry: 3.5, dy: 7, pale: false }, eyeY: 16, eyeW: 5, eyeH: 5, eyeDx: 8, noseW: 4, browCh: 'L', eyeRing: 'f',
  outfit: 'vest',
  extra(g) { poly(g, [[18, 35], [24, 38], [30, 35], [30, 41], [24, 38], [18, 41]], 'Y'); px(g, 24, 38, 'y'); },
});
BUSTS.bastien = () => furBust({
  ears: 'small', earX: 9, headRx: 9, headRy: 10, headY: 18, muzzle: { rx: 4, ry: 6.5, dy: 9, pale: false, noseUp: 5 }, eyeY: 15, eyeDx: 5, eyeW: 3, eyeH: 3, chinSpot: true, noseW: 4, browCh: 'L', mouth: false,
  outfit: 'coat',
});
BUSTS.cass = () => furBust({
  ears: 'tufted', earX: 9, earTip: 'R', headRx: 12, ruff: true, muzzle: { rx: 6, ry: 4.5, dy: 7 }, eyeY: 18, iris: 'y', noseW: 3,
  outfit: 'coat',
});

// palettes -------------------------------------------------------------------------
const P = {};
P.augusta = { ...PORCH, K: '#262a33', k: '#141b33', L: '#b0b8c0', F: '#8a929c', f: '#646c78', D: '#464c58', R: '#5a606c', H: '#e0e2e4', M: '#c8ccd0', m: '#9aa0a8', N: '#2a2a33', n: '#4a4a55', E: '#141b33', W: '#f6f1e3', Q: '#3b4a6b', C: '#2b3a67', c: '#1e2a4a', Y: '#d9a441', y: '#f2d27a', a: '#8a6a1e', P: '#d9a3a0', S: '#3a3f4f' };
P.tully = { ...PORCH, K: '#2a2018', k: '#141b33', L: '#a8927a', F: '#8a7560', f: '#6a5644', D: '#4a3c2e', H: '#d4c4ac', M: '#b8a48c', m: '#8e7a64', N: '#2e2620', n: '#4e4038', E: '#141b33', W: '#f6f1e3', Q: '#d8584a', C: '#c0453a', c: '#8e2f2a', P: '#d9907a' };
P.bryony = { ...PORCH, K: '#2e241c', k: '#141b33', L: '#ab9a82', F: '#8c7a64', f: '#6a5a48', D: '#4a3e30', H: '#ece0c8', M: '#d4c3a3', m: '#a8977c', N: '#2e241c', n: '#4e4034', E: '#141b33', W: '#f6f1e3', Q: '#f2e8d0', C: '#e8dcc0', c: '#bfb090', Y: '#e6c46e', y: '#b8963e', R: '#c0453a', P: '#d9907a' };
P.thessaly = { ...PORCH, K: '#2e3242', k: '#141b33', L: '#aeb6c6', F: '#8a94a8', f: '#646e84', D: '#464e62', H: '#f4efe6', M: '#e6e0d4', m: '#bcb6aa', N: '#e89aa8', n: '#f6c0c8', P: '#e89aa8', E: '#141b33', W: '#f6f1e3', Q: '#e0a050', C: '#c98a3a', c: '#9a6a2a', Y: '#d9a441', a: '#7a5a36' };
P.tamsin = { ...PORCH, K: '#1e1e28', k: '#2a3a33', L: '#a8a8b4', F: '#8a8a96', f: '#5f5f70', D: '#3e3e4a', H: '#f6f1e3', M: '#f1eee6', m: '#c8c4cc', N: '#1e1e28', n: '#3e3e48', R: '#24222c', E: '#141b33', W: '#f6f1e3', Q: '#6a8e7c', C: '#4e6e5d', c: '#3a5246' };
P.pip = { ...PORCH, K: '#1e1410', k: '#141b33', L: '#9a7252', F: '#74503a', f: '#523828', D: '#3a2618', H: '#f0c878', M: '#d9a85a', m: '#b08040', N: '#1e1410', n: '#4a3428', E: '#141b33', W: '#f6f1e3', Q: '#4e5e80', C: '#3b4a6b', c: '#2b3a67', P: '#c88a7a' };
P.pip.J = '#3a2618';
P.thatch = { ...PORCH, K: '#2a1c18', k: '#3a2a1a', L: '#ead2a8', F: '#d9b88a', f: '#b0906a', D: '#7a5e44', R: '#d0483a', r: '#9a2e2a', S: '#262433', E: '#141b33', W: '#f6f1e3', M: '#f1eee6', N: '#ead8b8', Y: '#f2c14e', y: '#b8963e', T: '#a8885a', t: '#7e6440' };
P.isolde = { ...PORCH, K: '#1e1a20', k: '#141b33', L: '#6e6670', F: '#4e4650', f: '#332d36', D: '#221e26', M: '#ece6da', m: '#bcb6ac', E: '#141b33', W: '#f6f1e3', X: '#2a2630', x: '#1a161e', Q: '#3b4a7a', C: '#2b3a67', c: '#1e2a4a', A: '#d9a441', B: '#f2d27a', a: '#8a6a1e' };
P.isolde.J = '#5e7d8a'; P.isolde.j = '#43606c';
P.ludo = { ...PORCH, K: '#2a1c22', k: '#2a1c22', L: '#8a6a72', F: '#6a4a52', f: '#4a3038', D: '#36222a', M: '#c9a090', m: '#a8807a', N: '#3a1f1c', n: '#5a3a36', P: '#e3a0a8', E: '#141b33', W: '#f6f1e3', V: '#a0727a', v: '#7e5260', S: '#e6d6c0', A: '#d9a441', a: '#8a6a1e', X: '#f9c46b' };
P.barnaby = { ...PORCH, K: '#3a2410', L: '#e3b867', F: '#b8862f', f: '#7a5a1e', D: '#4e3418', W: '#f6f1e3', G: '#9fd3c0', g: '#5f9a8e', H: '#e9f7f2', E: '#141b33', Q: '#f29a7a', R: '#e06a4f', r: '#a8402e', s: '#6e2a2a' };
P.dimity = { ...PORCH, K: '#7a3b4e', F: '#f2a7b5', f: '#d98a9c', Y: '#ffe29a', y: '#f3c178', M: '#fff3d6', m: '#e6c88a', E: '#141b33', W: '#f6f1e3', P: '#e07a9a' };
P.ansel = { ...PORCH, K: '#2a3340', k: '#1e2433', Q: '#3b4a7a', L: '#b8c8d4', F: '#8ea0b0', f: '#607486', D: '#3e4e60', M: '#e8edf0', m: '#c0ccd6', R: '#2e3a4c', E: '#141b33', N: '#d9a441', n: '#b07a2a', Y: '#f2c14e', C: '#2b3a67', c: '#1e2a4a' };
P.odile = { ...PORCH, K: '#5a2a3a', k: '#1e3a40', L: '#f6b8c8', F: '#e98aa6', f: '#c0607e', M: '#e6e2c4', m: '#c2c09a', N: '#8a9a86', n: '#5e6e5c', E: '#7a1e2c', R: '#c03a3a', W: '#f6f1e3', Q: '#4f9aa4', C: '#2f7c86', c: '#1f5a62', Y: '#f2c14e', o: '#4f8fd9', P: '#e98aa6', a: '#8a6a3a' };
P.odile = { ...P.odile, Q: '#f8f2e2', C: '#f4ecd6', c: '#cfc3a4' };
P.odile = { ...P.odile, U: '#4f9aa4', J: '#2f7c86', j: '#1f5a62' };
P.maud = { ...ISLE, K: '#2a241e', k: '#141b33', L: '#b0a898', F: '#8a8070', f: '#625a4e', D: '#443e36', E: '#141b33', W: '#f6f1e3', X: '#e88a3a', x: '#b8602a', Q: '#f2c858', C: '#e6b43a', c: '#b8862a', Y: '#e6b43a', y: '#b8862a', a: '#8a6a1e' };
P.maud.J = '#443e36';
P.osric = { ...ISLE, K: '#2a2a18', k: '#141b33', L: '#aaa874', F: '#8a8a5a', f: '#666a40', D: '#3a3e22', M: '#e8d8a8', m: '#bca878', N: '#2a2a18', E: '#141b33', W: '#f6f1e3', H: '#b08a4e', T: '#8a6a3a', t: '#5e4626', r: '#3a2a16', Q: '#ddd6c4', C: '#c9c2b0', c: '#9e9684', Y: '#d9a441', S: '#7a7a84' };
P.osric.J = '#44482a'; P.osric.j = '#4e3420';
P.ines = { ...ISLE, K: '#1e1e12', k: '#3a4a48', L: '#7e7a56', F: '#5e5a3e', f: '#403e28', D: '#2a2814', R: '#22200f', M: '#e8a030', m: '#b87820', N: '#1e1e12', n: '#2a2814', E: '#141b33', W: '#e8c060', Q: '#fbf6e8', C: '#f4ecd6', c: '#cfc3a4', Y: '#8fc7c0' };
P.wendel = { ...ISLE, K: '#1e1a18', k: '#141b33', L: '#5a524a', F: '#3a3430', f: '#262220', D: '#161210', M: '#f1eee6', m: '#c8c4bc', R: '#a8502a', S: '#1e1a18', E: '#141b33', W: '#f6f1e3', X: '#e09a9a', x: '#b07070', Q: '#c0a070', C: '#a8885a', c: '#7e6440', Y: '#d9a441' };
P.wendel.J = '#7e6440'; P.wendel.j = '#5e4a30';
P.ada = { ...ISLE, K: '#141b33', k: '#141b33', L: '#5a5a6e', F: '#33333f', f: '#24242e', D: '#181820', R: '#9aa0b0', r: '#70768a', E: '#141b33', W: '#dce4ec', w: '#aab4c0', X: '#4a4a58', x: '#2e2e3a', Q: '#f2ece0', C: '#e8e0d0', c: '#bdb4a2', P: '#c0453a', Y: '#d9a441' };
P.ada.J = '#6a5a46'; P.ada.j = '#4e4232';
P.ivo = { ...P.ada, P: '#3b6dc9' };
P.seraphine = { ...ISLE, K: '#4a5068', k: '#141b33', L: '#f6f1e3', F: '#ece6da', f: '#b8bcc8', D: '#8e94a4', H: '#f6f1e3', M: '#f6f1e3', m: '#d6d2ca', N: '#2a2a33', n: '#4a4a55', E: '#141b33', W: '#f6f1e3', P: '#e0a8a8', Q: '#d87a4e', C: '#c0603a', c: '#8e4428', S: '#3a3f4f', Y: '#d9a441', X: '#ffe29a' };
P.seraphine.J = '#8e94a4';
P.hollis = { ...ISLE, K: '#5a5448', k: '#141b33', L: '#f4efe2', F: '#e6e0d2', f: '#b4ae9e', D: '#8e8878', H: '#f6f1e3', M: '#d4ccb8', m: '#aaa290', R: '#2a2830', r: '#4a4850', N: '#3a3438', n: '#5a5458', E: '#141b33', W: '#f6f1e3', Q: '#86745e', C: '#6a5a46', c: '#4e4232', Y: '#c9a77c', a: '#7a5a36' };
P.hollis.J = '#8e8878';
P.agathe = { ...ISLE, K: '#0f1014', k: '#1a1c2c', L: '#5a5040', F: '#2a2a30', f: '#1a1a20', D: '#101014', E: '#141b33', W: '#f4f4f4', G: '#38b764', Y: '#ffcd75', y: '#d9a441', M: '#f4f4f4', m: '#94b0c2', X: '#94b0c2', x: '#566c86', Q: '#4a5470', C: '#333c57', c: '#1a1c2c' };
P.agathe.J = '#101014';
P.teo = { ...ISLE, K: '#1a1c2c', k: '#1a1c2c', L: '#b0b0b8', F: '#8e8e96', f: '#62626e', D: '#44444e', H: '#f6f1e6', M: '#ece6dc', m: '#bdb8b0', R: '#262433', N: '#1a1c2c', n: '#3a3a48', P: '#e8a0a0', E: '#141b33', W: '#f6f1e3', Q: '#ffdc8a', C: '#ffcd75', c: '#d9b38c', S: '#5a3a26', G: '#73eff7', g: '#41a6f6', Y: '#d9a441', y: '#f2d27a', a: '#8a6a1e' };
P.teo.J = '#257179'; P.teo.j = '#29366f';
P.dov = { ...ISLE, K: '#3a2214', k: '#141b33', L: '#d8a65a', F: '#b8843e', f: '#8e5e2a', D: '#5e3a1a', H: '#f4dca8', M: '#e8c88a', m: '#c09a5e', N: '#3a2214', n: '#5a3a24', P: '#d98a7a', E: '#141b33', W: '#f6f1e3', Q: '#fbf6e8', C: '#f4ecd6', c: '#cfc3a4', S: '#f4ecd6', Y: '#d9a441', y: '#8a6a1e' };
P.dov.J = '#7a2e3a'; P.dov.j = '#5a1e2a';
P.bastien = { ...ISLE, K: '#1a1210', k: '#1a1c2c', L: '#7a5240', F: '#4a3024', f: '#2e1e16', D: '#1e140e', H: '#f2ece0', M: '#e8e0d0', m: '#bdb4a2', N: '#1a1210', n: '#3a2a22', E: '#141b33', W: '#f6f1e3', Q: '#4e5466', C: '#3a3f4f', c: '#2a2e3a', Y: '#ffcd75', a: '#7a5a36' };
P.bastien.J = '#94b0c2'; P.bastien.j = '#566c86';
P.cass = { ...ISLE, K: '#3a2c20', k: '#1a1c2c', L: '#d8c09a', F: '#b89a72', f: '#8e7454', D: '#5e4a34', H: '#f6f1e6', M: '#ece4d4', m: '#c4b8a4', R: '#3a2c24', N: '#4a3030', n: '#6a4a4a', P: '#d98a8a', E: '#141b33', W: '#f6f1e3', y: '#ffcd75', Q: '#3f7a64', C: '#2f5a4a', c: '#1f4034', Y: '#ffcd75', a: '#7a5a36' };
P.cass.J = '#d9c08a'; P.cass.j = '#b09a64';

// cloth accents (lapels, collars, aprons, caps) live on J / j so they never share the fur's deep shade
Object.assign(P.augusta, { J: '#3b4a6b', j: '#2b3a67' });
Object.assign(P.tully, { J: '#f4e8c1', j: '#d8c79b' });
Object.assign(P.bryony, { J: '#5e7d4a', j: '#435c34' });
Object.assign(P.thessaly, { J: '#f4e8c1', j: '#d6c8a0' });
Object.assign(P.tamsin, { J: '#c9b48a', j: '#a8927c' });
Object.assign(P.pip, { J: '#8a6a46', j: '#6a4e30' });
Object.assign(P.maud, { J: '#3b4a6b', j: '#2b3a67' });
Object.assign(P.osric, { J: '#6a4a30', j: '#4e3420' });
Object.assign(P.ines, { J: '#8fc7c0', j: '#5f9a94' });
Object.assign(P.ada, { S: '#2a2a36' }); Object.assign(P.ivo, { S: '#2a2a36' });
Object.assign(P.seraphine, { J: '#3b4a6b', j: '#2b3a67', a: '#8a6a1e' });
Object.assign(P.hollis, { J: '#a8323a', j: '#7a2430' });
Object.assign(P.agathe, { J: '#94b0c2', j: '#566c86', a: '#7a4b2e' });
Object.assign(P.bastien, { P: '#a86a5a' });

// ===========================================================================
// REGISTRY
// ===========================================================================
const MAIN = {
  wren: [(e) => beaver(e), WREN_PAL],
  ambrose: [(e) => beaver(e, { elder: true }), AMBROSE_PAL],
  hesper: [hesper, HESPER_PAL],
  juniper: [juniper, JUNIPER_PAL],
  linnet: [linnet, LINNET_PAL],
  corin: [corin, CORIN_PAL],
  idris: [idris, IDRIS_PAL],
  wick: [wick, WICK_PAL],
};
const SINGLE = {
  ludo: [BUSTS.ludo, P.ludo], barnaby: [BUSTS.barnaby, P.barnaby], dimity: [BUSTS.dimity, P.dimity],
  augusta: [BUSTS.augusta, P.augusta], ansel: [BUSTS.ansel, P.ansel], tully: [BUSTS.tully, P.tully],
  odile: [BUSTS.odile, P.odile], bryony: [BUSTS.bryony, P.bryony], thessaly: [BUSTS.thessaly, P.thessaly],
  tamsin: [BUSTS.tamsin, P.tamsin], isolde: [BUSTS.isolde, P.isolde], thatch: [BUSTS.thatch, P.thatch],
  pip: [BUSTS.pip, P.pip],
  maud: [BUSTS.maud, P.maud], osric: [BUSTS.osric, P.osric], ines: [BUSTS.ines, P.ines], wendel: [BUSTS.wendel, P.wendel],
  ada: [BUSTS.ada, P.ada], ivo: [BUSTS.ivo, P.ivo], seraphine: [BUSTS.seraphine, P.seraphine], hollis: [BUSTS.hollis, P.hollis],
  agathe: [BUSTS.agathe, P.agathe], teo: [BUSTS.teo, P.teo], dov: [BUSTS.dov, P.dov],
  bastien: [BUSTS.bastien, P.bastien], cass: [BUSTS.cass, P.cass],
};

export const PORTRAIT_IDS = Object.freeze([
  'wren', 'corin', 'linnet', 'juniper', 'hesper', 'wick', 'ambrose', 'idris',
  'ludo', 'barnaby', 'dimity', 'augusta', 'ansel', 'tully', 'odile', 'bryony', 'thessaly', 'tamsin', 'isolde', 'thatch', 'pip',
  'maud', 'osric', 'ines', 'wendel', 'ada', 'ivo', 'seraphine', 'hollis', 'agathe', 'teo', 'dov', 'bastien', 'cass',
]);

/** Expressions drawn for a portrait id. */
export function expressionsOf(id) {
  if (MAIN[id]) return EXPRESSIONS.slice();
  if (SINGLE[id]) return ['neutral'];
  return [];
}

const cache = new Map();
/** Bust for an id and expression (falls back to neutral). Memoized; returns null for an unknown id. */
export function portrait(id, expr = 'neutral') {
  const e = expressionsOf(id).includes(expr) ? expr : 'neutral';
  const key = id + '|' + e;
  if (cache.has(key)) return cache.get(key);
  let out = null;
  if (MAIN[id]) { const [fn, pal] = MAIN[id]; out = { w: N, h: N, rows: fn(e), palette: pal, expr: e }; }
  else if (SINGLE[id]) { const [fn, pal] = SINGLE[id]; out = { w: N, h: N, rows: fn(), palette: pal, expr: e }; }
  if (out) { Object.freeze(out.rows); out = Object.freeze(out); }
  cache.set(key, out);
  return out;
}

/** Neutral busts by id (lazy getters so importing this module stays cheap). */
export const PORTRAITS = {};
for (const id of PORTRAIT_IDS) Object.defineProperty(PORTRAITS, id, { enumerable: true, get: () => portrait(id) });

/** Decoded portrait sprite (cached by pixelart). opts: decodeSprite options plus {plate: false} for a bare bust. */
export function portraitSprite(id, expr = 'neutral', opts = {}) {
  const p = portrait(id, expr);
  if (!p) return null;
  const { plate = true, ...dec } = opts || {};
  const pal = plate ? p.palette : { ...p.palette, 1: null, 2: null };
  return decodeSprite(p.rows, pal, dec);
}

/** Registers every bust with art/atlas ('portrait-<id>'; variants by expression). Returns the count. */
export function registerPortraitArt() {
  const table = {};
  for (const id of PORTRAIT_IDS) {
    const exprs = expressionsOf(id);
    const n = portrait(id);
    const variants = {}, variantPal = {};
    for (const e of exprs) { const p = portrait(id, e); variants[e] = [p.rows]; variantPal[e] = p.palette; }
    table['portrait-' + id] = { kind: 'portrait', w: N, h: N, frames: [n.rows], pal: n.palette, variants, variantPal };
  }
  return registerArt(table, { source: 'portraits', kind: 'portrait', replace: true });
}

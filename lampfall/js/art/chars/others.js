// js/art/chars/others.js  [ART-CHARS] (from proto/chars/others.js)
// The townsfolk who do not fit the two-legged mammal rig: Juniper (magpie),
// Barnaby (hermit crab in a diving helmet), Hesper (snail), Ansel (heron),
// Wick (puffling), Ludo (fruit bat), Dimity (rosy maple moth), and new on
// adoption: Odile (roseate spoonbill) and the Thatch (finch crew).
// Every body returns the same frameset shape as buildMammal():
//   { w, h, ox, oy, down[4], up[4], left[4], right[4], sit, fish, fishW, fishOx, poses? }
// Frames are 16 wide with the feet on the bottom row. Size-as-character: most
// cells are 16x24 (oy 0); Ansel is 16x32 and Odile 16x28, drawn with oy = 24 - h
// so their feet still land on the tile (see index.js drawOffset).
import { blank, stamp, under, rows, flipH, compose } from './rig.js';
import { FISH_W, FISH_OX } from './mammals.js';
import { drawRod } from './rod.js';

const F = (parts) => parts; // readability
const pad = (part, w = 16, h = 24) => rows(stamp(blank(w, h), part, 0, 0));

/** Stack layers [part, x, y] bottom-first into a 16x24 frame. */
const frame = (...layers) => compose(layers);

/** Stride frames: body drops by `bob` on the A/B frames, legs swap. */
function legged({ body, legs, bodyY = 0, legsY = 0, behind = null, bob = 1, front = null, h = 24 }) {
  const mk = (legKey, dy) => {
    const g = blank(16, h);
    if (behind) stamp(g, behind, 0, dy);
    stamp(g, legs[legKey], 0, legsY);
    stamp(g, body, 0, bodyY + dy);
    if (front) stamp(g, front, 0, dy);
    return rows(g);
  };
  return [mk('idle', 0), mk('a', bob), mk('idle', 0), mk('b', bob)];
}

/**
 * Put a 16x24 frame into the 24-wide fish frame with a rod + line on the left.
 * Returns the four cast phases (hold, wind-up, cast, bite); see rod.js.
 */
function withRod(frame16, { rod = true, handX = 10, handY = 13 } = {}) {
  const h = frame16.length;
  return [0, 1, 2, 3].map((phase) => {
    const g = blank(FISH_W, h);
    stamp(g, frame16, -FISH_OX, 0);
    drawRod(g, handX, handY, phase, { rod, water: h - 3 });
    return rows(g);
  });
}

// ---------------------------------------------------------------------------
// JUNIPER PELL, magpie. Head in 3/4 turn, beak left; black/white split; long
// wedge tail trailing down-left; shopkeeper's apron with too many pockets.
// I/i = iridescent sheen (palette-cycled by the game).
// ---------------------------------------------------------------------------
const MAGPIE = {};
MAGPIE.downBody = [
  '................',
  '................',
  '......KKKKK.....',
  '.....KFFLFFK....',
  '....KFFFFFFFK...',
  '..KKKFWEFFFFK...',
  '.KNNNFEEFFFFK...',
  '..KKKFFFFFFfK...',
  '.....KFFFffK....',
  '....KKMMMMKK....',
  '...KFMMMMMMFK...',
  '...KFMCCCCMFK...',
  '...KFMCCCCMfK...',
  '...KFFCcCcFfK...',
  '...KFFCCCCFfK...',
  '...KFFCcAcffK...',
  '....KFCCCCfK....',
  '.....KccccK.....',
  '......KKKK......',
];
MAGPIE.downTail = [ // stamped at (0,13), behind the legs
  '.....KK.........',
  '....KFfK........',
  '...KIFfK........',
  '..KIFfK.........',
  '.KIFfK..........',
  'KIFfK...........',
  'KIfK............',
  'KKK.............',
];
MAGPIE.downLegs = {
  idle: pad(['......S..S......', '......S..S......', '......S..S......', '......S..S......', '....KSSSKSSSK...', '.....KKK.KKK....'].map((r) => r), 16, 6),
  a: pad(['......S..S......', '......S..S......', '......S.KSSSK...', '......S..KKK....', '....KSSSK.......', '.....KKK........'], 16, 6),
  b: pad(['......S..S......', '......S..S......', '....KSSSK.S.....', '.....KKK..S.....', '.........KSSSK..', '..........KKK...'], 16, 6),
};
MAGPIE.upBody = [
  '................',
  '................',
  '......KKKKK.....',
  '.....KFFLFFK....',
  '....KFFFFFFFK...',
  '....KFFFFFFFK...',
  '....KFFFFFFfK...',
  '....KFFFFFffK...',
  '.....KFFfffK....',
  '....KKFFFFFKK...',
  '...KMFFFFFFFMK..',
  '...KFFFFFFFFfK..',
  '...KFFFFFFFFfK..',
  '...KfFFFFFFffK..',
  '...KfFFFFFfffK..',
  '...KffFFFffIiK..',
  '....KffffIiiK...',
  '.....KKKIiiK....',
  '.........KiK....',
];
MAGPIE.upTail = [ // (0,16) in front of the legs, trailing down-right
  '..........KIiK..',
  '...........KIiK.',
  '...........KIiK.',
  '............KiK.',
  '............KK..',
];
MAGPIE.leftBody = [
  '................',
  '................',
  '.....KKKKK......',
  '....KFFLFFK.....',
  '...KFFFFFFFK....',
  '.KKKFWEFFFFK....',
  'KNNNFEEFFFFK....',
  '.KKKFFFFFFFK....',
  '....KFMMFFFfK...',
  '....KMMMFFFffK..',
  '...KFMCCFFFFffK.',
  '...KFMCCFFFFfffK',
  '...KFCCcFFFIiiiK',
  '...KFCCCFFIiiiK.',
  '...KFfccfIiiK...',
  '....KFfffIiK....',
  '.....KKKKIiK....',
  '.........KIiK...',
  '..........KIiK..',
  '...........KiK..',
  '............KK..',
];
MAGPIE.leftLegs = {
  idle: pad(['.......S........', '.......S........', '.......S........', '.......S........', '....KSSSSK......', '.....KKKK.......'], 16, 6),
  a: pad(['......SSS.......', '.....S..S.......', '....S...S.......', '...KS...S.......', '..KSSK.KSSSK....', '...KK...KKK.....'], 16, 6),
  b: pad(['......SSS.......', '.....S...S......', '....KS...S......', '...KSSSK.S......', '....KKK..KSSK...', '..........KK....'], 16, 6),
};
export function buildMagpie() {
  const down = legged({ body: MAGPIE.downBody, legs: MAGPIE.downLegs, legsY: 18, behind: rows(stamp(blank(), MAGPIE.downTail, 0, 13)) });
  const up = legged({ body: MAGPIE.upBody, legs: MAGPIE.downLegs, legsY: 18, front: rows(stamp(blank(), MAGPIE.upTail, 0, 16)) });
  const left = legged({ body: MAGPIE.leftBody, legs: MAGPIE.leftLegs, legsY: 18 });
  // sit: hunkered on a step, legs tucked, tail across the step
  const sit = frame([MAGPIE.downTail, 0, 15], [MAGPIE.downBody, 0, 3], [['....KSSSKSSSK...', '.....KKK.KKK....'], 0, 22]);
  const fish = withRod(left[0], { handX: 9, handY: 12 });
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// BARNABY THOLE, hermit crab in a brass diving helmet one size too small.
// A sphere. Porthole glass G, rivets W, valve on top, mismatched coral claws
// (left big, right small), four short legs under the rim.
// ---------------------------------------------------------------------------
const CRAB = {};
CRAB.downBody = [
  '................',
  '................',
  '................',
  '......KaaK......',
  '.....KKAAKK.....',
  '....KALLAAAK....',
  '...KALLAAAAAK...',
  '..KALAAAAAAAaK..',
  '.KAAAAKKKKAAAaK.',
  '.KAWAKGGGGKAWaK.',
  'KAAAKGGWGGGKAaaK',
  'KAAAKGGGGGGKAaaK',
  'KAAAKGEGGEGKAaaK',
  'KAAAKGEGGEGKaaaK',
  '.KAWAKGggGKWaaK.',
  '.KAAAAKKKKaaaaK.',
  '..KAAAAAaaaaaK..',
  '.KKKKKaaaaaKKKK.',
  'KRRRRKRRRRKRRRrK',
  'KRRrRKRrrrK.KKK.',
  '.KKKK.KKKK......',
];
CRAB.downLegs = {
  idle: pad(['....KSKSKSKSK...', '....KSKSKSKSK...', '....KKKKKKKKK...'], 16, 3),
  a: pad(['....KSK.KSK.....', '....KSKSKSKSK...', '....KKKKKKKKK...'], 16, 3),
  b: pad(['......KSK.KSK...', '....KSKSKSKSK...', '....KKKKKKKKK...'], 16, 3),
};
CRAB.upBody = [
  '................',
  '................',
  '................',
  '......KaaK......',
  '.....KKAAKK.....',
  '....KALLAAAK....',
  '...KALLAAAAAK...',
  '..KALAAAAAAAaK..',
  '.KAAAAAAAAAAAaK.',
  '.KAWAAAAAAAAWaK.',
  'KAAAAAAAAAAAAaaK',
  'KAAAAAAAAAAAAaaK',
  'KAAAAAAAAAAAaaaK',
  'KAAAAAAAAAAaaaaK',
  '.KAWAAAAAAAWaaK.',
  '.KAAAAAAAaaaaaK.',
  '..KAAAAAaaaaaK..',
  '.KKKKKaaaaaKKKK.',
  'KRRRRKRRRRKRRRrK',
  'KRRrRKRrrrK.KKK.',
  '.KKKK.KKKK......',
];
CRAB.leftBody = [
  '................',
  '................',
  '................',
  '......KaaK......',
  '.....KKAAKK.....',
  '....KALLAAAK....',
  '...KALLAAAAAK...',
  '..KALAAAAAAAaK..',
  '.KKKKKAAAAAAAaK.',
  '.KGGGGKAWAAAAaK.',
  'KGGWGGGKAAAAAaaK',
  'KGGGGGGKAAAAAaaK',
  'KGEGGGGKAAAAaaaK',
  'KGEGGGGKAAAAaaaK',
  '.KGggGKAWAAaaaK.',
  '.KKKKKAAAAaaaaK.',
  '..KAAAAAaaaaaK..',
  '.KKKKKaaaaaKKKK.',
  'KRRRRKRRRRKRRrK.',
  'KRRrRKRrrrKKKK..',
  '.KKKK.KKKK......',
];
export function buildCrab() {
  const down = legged({ body: CRAB.downBody, legs: CRAB.downLegs, legsY: 21 });
  const up = legged({ body: CRAB.upBody, legs: CRAB.downLegs, legsY: 21 });
  const left = legged({ body: CRAB.leftBody, legs: CRAB.downLegs, legsY: 21 });
  const sit = frame([CRAB.downBody, 0, 1], [CRAB.downLegs.idle, 0, 22]);
  const fish = withRod(left[0], { handX: 9, handY: 18 });
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// HESPER COIL, garden snail. Limbless; a canvas mail satchel where the shell
// should be, envelope corners (M) poking out, brass buckle (A), eyestalks in a
// wide V with dark tips, a tiny lantern (X) on the left stalk. Walk: the foot
// skirt ripples (2 px per cycle), stalks sway.
// ---------------------------------------------------------------------------
const SNAIL = {};
// Front: the canvas mail satchel IS her shell, a round dome rising behind
// her; she holds the day's envelope (wax seal) to her chest; eyestalks in
// a wide V. Satchel strap + brass buckle at the right shoulder.
SNAIL.down = [
  '................',
  '..KK........KK..',
  '.KWEK......KWEK.',
  '.KEEK......KEEK.',
  '..KFK......KFK..',
  '...KFK....KFK...',
  '....KFKKKKFK....',
  '....KKFKKFKK....',
  '..KKMKLLFfKCKK..',
  '.KMMKFLFFFfKCCK.',
  '.KMCKLFFFFfKCCK.',
  'KMCCKLfKKffKaCcK',
  'KCCCKLFFFFfKAacK',
  'KCCCKkkkkkkKcccK',
  'KCCCkxWWWWxkcccK',
  'KCCCkWxYYxWkcccK',
  '.KCCkWWxxWWkccK.',
  '.KCCKkkkkkkKccK.',
  '..KKKLFFFFfKKK..',
  '.KKFFLFFFFfFFKK.',
  'KFFFFFFFFFFFfffK',
  'KLWLLLFFFFFffffK',
  'KLLLFFFFFFFffffK',
  '.KKKKKKKKKKKKKK.',
];
// walk: the eyestalks sway left / right while the foot glides
const sway = (f, d) => f.map((r, i) => (i >= 1 && i <= 4 ? (d < 0 ? r.slice(1) + '.' : '.' + r.slice(0, 15)) : r));
SNAIL.downA = sway(SNAIL.down, -1);
SNAIL.downB = sway(SNAIL.down, 1);
SNAIL.up = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.KK........KK...',
  'KEEK......KEEK..',
  '.KFK......KFK...',
  '..KFKKMMKKFK....',
  '...KKKMMKKK.....',
  '..KKCCCCCCCKK...',
  '.KCCCCCCCCCCCK..',
  '.KCCCCCCCCCCcK..',
  '.KCCCCCCCCCCcK..',
  '.KCCCCCCCCCccK..',
  '.KcCCCCCCCcccK..',
  '.KFcccccccccFfK.',
  'KFFFFFFFFFFFffK.',
  'KLFFFFFFFFFfffK.',
  'KLLFFFFFFFffffK.',
  '.KKKKKKKKKKKKK..',
];
SNAIL.left = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.KK.KK..KMMK....',
  'KEEKEEKKKMMKK...',
  'KXXKFKCCCCCCCK..',
  '.KXFKCCCCAACCCK.',
  '..KFKCCCCAACCCcK',
  '..KFKcCCCCCCCccK',
  '..KFFKccccccccK.',
  '.KFFFKKKKKKKKK..',
  'KLFFFFFFFFFFFFK.',
  'KLLFFFFFFFFffffK',
  'KLLFFFFFFFFffffK',
  '.KKKKKKKKKKKKKK.',
];
SNAIL.leftA = SNAIL.left.map((r, i) => (i >= 20 && i <= 22 ? '.' + r.slice(0, 15) : r));
SNAIL.leftB = SNAIL.left.map((r, i) => (i === 21 ? r.slice(1) + '.' : r));
export function buildSnail() {
  const down = [SNAIL.down, SNAIL.downA, SNAIL.down, SNAIL.downB];
  const up = [SNAIL.up, SNAIL.downA.map((r, i) => (i >= 20 ? r : SNAIL.up[i])), SNAIL.up, SNAIL.downB.map((r, i) => (i >= 20 ? r : SNAIL.up[i]))];
  const left = [SNAIL.left, SNAIL.leftA, SNAIL.left, SNAIL.leftB];
  // sit: she is always sitting; fish: rod propped in the satchel strap
  const sit = SNAIL.down;
  const fish = withRod(SNAIL.left, { rod: true, handX: 11, handY: 15 });
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// ANSEL STALK, heron. The tallest: long stilt legs, S-curve neck, long bill
// (N), dark crest plume (R), a worn harbormaster's cap (C). Idle stands on one
// leg; the walk is a slow stride.
// ---------------------------------------------------------------------------
const HERON = {};
HERON.downBody = [
  '......kCCCk.....',
  '.....kCCYCCk....',
  '....kcccccccK...',
  '.KNNNMMWEMFFRK..',
  '..KKKMMMMMFFRK..',
  '.....KMMMFFK....',
  '......KMMFK.....',
  '......KMMK......',
  '......KMMK......',
  '.....KFMMFK.....',
  '....KFFMMFFfK...',
  '...KFFFMMFFFfK..',
  '...KFFFMMFFFfK..',
  '...KfFFMMFFffK..',
  '....KffMMfffK...',
  '.....KKfffKK....',
  '......KKKK......',
];
HERON.downLegs = {
  idle: pad(['.......KSK......', '.......KSK......', '........S.......', '........S.......', '........S.......', '........S.......', '.......KSK......', '.....KSSSSSK....'], 16, 8),
  a: pad(['......KSKSK.....', '......KSK.S.....', '.......S..S.....', '......S...S.....', '......S...S.....', '.....S....S.....', '....KSK..KSK....', '..KSSSSKKSSSSK..'], 16, 8),
  b: pad(['......KSKSK.....', '......S.KSK.....', '......S..S......', '......S...S.....', '......S...S.....', '......S....S....', '.....KSK..KSK...', '...KSSSSKKSSSSK.'], 16, 8),
};
HERON.upBody = [
  '......kCCCk.....',
  '.....kCCCCCk....',
  '....kcccccccK...',
  '....KLFFFFFRRK..',
  '....KLFFFFfRRK..',
  '.....KFFFffRK...',
  '......KFFfKRK...',
  '......KFfK.K....',
  '......KFfK......',
  '.....KLFFfK.....',
  '....KLFFKFffK...',
  '...KLFFFKFFffK..',
  '...KLFFfKFFffK..',
  '...KRFFfKFfRRK..',
  '....KRRfKfRRK...',
  '.....KKRRRKK....',
  '......KKKK......',
];
HERON.leftBody = [
  '.....kCCCk......',
  '....kCYCCCk.....',
  '...kcccccccK....',
  'KNNNMMWEMFFRRK..',
  '.KKKKMMMMFFFRK..',
  '....KMMMFFK.....',
  '....KMMFK.......',
  '....KMMK........',
  '....KMMK........',
  '....KFMMFK......',
  '...KFFMMFFFKK...',
  '..KFFFMMFFFFffK.',
  '..KFFFMMFFFFfffK',
  '..KfFFmMFFffffK.',
  '...KffmmfffffK..',
  '....KKffffKKK...',
  '......KKKK......',
];
HERON.leftLegs = {
  idle: pad(['.......KSK......', '.......KSK......', '........S.......', '........S.......', '........S.......', '........S.......', '.......KSK......', '.....KSSSSSK....'], 16, 8),
  a: pad(['......KSSSK.....', '.....KSK.KSK....', '.....S.....S....', '....S......S....', '....S.......S...', '...S........S...', '..KSK......KSK..', 'KSSSSK....KSSSSK'], 16, 8),
  b: pad(['......KSSSK.....', '......KSKSK.....', '.......S.S......', '.......S.S......', '......S...S.....', '......S...S.....', '.....KSK.KSK....', '...KSSSSKSSSSK..'], 16, 8),
};
/** Lengthen a stilt-leg part by repeating its shank row (row 3) n times. */
function stretch(part, n) { const r = part.slice(); r.splice(3, 0, ...Array(n).fill(part[3])); return r; }
const stretchSet = (set, n) => Object.fromEntries(Object.entries(set).map(([k, v]) => [k, stretch(v, n)]));

// Ansel is the tallest in the cast: the same heron on 16 px stilts (16x32).
const HERON_H = 32;
export function buildHeron() {
  const n = HERON_H - 24;
  const dl = stretchSet(HERON.downLegs, n), ll = stretchSet(HERON.leftLegs, n);
  const down = legged({ body: HERON.downBody, legs: dl, legsY: 16, h: HERON_H });
  const up = legged({ body: HERON.upBody, legs: dl, legsY: 16, h: HERON_H });
  const left = legged({ body: HERON.leftBody, legs: ll, legsY: 16, h: HERON_H });
  // sit: the heron's hunch on the launch gunwale: neck folded so the head
  // rests on the shoulders, knees forward, feet hanging over the edge
  const sitBody = HERON.downBody.slice(0, 5).concat(['......KMMK......'], HERON.downBody.slice(9));
  const sit = rows(stamp(stamp(blank(16, HERON_H), sitBody, 0, HERON_H - 23), [
    '.....KSK.KSK....',
    '.....KSK.KSK....',
    '....KSSK.KSSK...',
    '.....KK...KK....',
  ], 0, HERON_H - 4));
  // fish: he fishes with a hand line held in the bill
  const fish = withRod(left[0], { rod: false, handX: 1, handY: 4 });
  return { w: 16, h: HERON_H, ox: 0, oy: 24 - HERON_H, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// ODILE, roseate spoonbill (16x28, second-tallest). Head in 3/4 turn like the
// heron, bald pale head (M), red eye, the long spatulate bill (N / n) angled
// down-left, a teal painter's beret (D), pink plumage (F / f / L) under a
// paint-flecked cream smock (C / c, Y and o dabs), long pink legs (S).
// ---------------------------------------------------------------------------
const SPOON = {};
SPOON.downBody = [
  '......kDDDk.....',
  '.....kDDDDDk....',
  '....kDDDDDDdk...',
  '.....KMMMMMK....',
  '....KMMWEMMmK...',
  '..KNNNMMMMMmK...',
  '.KNnNKKMMMmK....',
  'KNnNK..KMMK.....',
  'KnnK..KFFFK.....',
  '.KK..KLFFFFK....',
  '....KLCCCCCFK...',
  '...KLCCCYCCCfK..',
  '...KFCCCCCoCfK..',
  '...KFCCCCCCCfK..',
  '...KFCcCCCcCfK..',
  '....KCCCCCCCK...',
  '....KcccccccK...',
  '.....KKFFfKK....',
  '......KKKK......',
];
SPOON.upBody = [
  '......kDDDk.....',
  '.....kDDDDDk....',
  '....kDDDDDDdk...',
  '.....KMMMMMK....',
  '....KMMMMMMmK...',
  '....KFMMMMMmK...',
  '.....KFFFFmK....',
  '......KFFFK.....',
  '......KFFFK.....',
  '.....KLFFFFK....',
  '....KLCCCCCFK...',
  '...KLCCCCCCCfK..',
  '...KFCCcCCCCfK..',
  '...KFCCcCCCcfK..',
  '...KFCCCCCCcfK..',
  '....KCCCCCCcK...',
  '....KcccccccK...',
  '.....KKffKK.....',
  '......KKKK......',
];
SPOON.leftBody = [
  '.....kDDDk......',
  '....kDDDDDk.....',
  '...kDDDDDDdk....',
  '....KMMMMMK.....',
  'KNNNMWEMMMmK....',
  'NnNNKMMMMMK.....',
  'KnnK.KMMMK......',
  '.KK..KMMK.......',
  '.....KFFK.......',
  '....KLFFFK......',
  '...KLCCCFFKK....',
  '..KLCCYCFFFFfK..',
  '..KFCCCCFFFFffK.',
  '..KFCCoCFFFfffK.',
  '..KfCCCCFfffffK.',
  '...KcccCffffK...',
  '....KKKfffKK....',
  '......KKKK......',
];
export function buildSpoonbill() {
  const H = 28, n = H - 24 - 3; // body is 19 rows (two longer than the heron's)
  const dl = stretchSet(HERON.downLegs, n), ll = stretchSet(HERON.leftLegs, n);
  const by = H - dl.idle.length - SPOON.downBody.length + 2;
  const down = legged({ body: SPOON.downBody, legs: dl, legsY: H - dl.idle.length, bodyY: by, h: H });
  const up = legged({ body: SPOON.upBody, legs: dl, legsY: H - dl.idle.length, bodyY: by, h: H });
  const left = legged({ body: SPOON.leftBody, legs: ll, legsY: H - ll.idle.length, bodyY: by + 1, h: H });
  const sitBody = SPOON.downBody.slice(0, 7).concat(SPOON.downBody.slice(9));
  const sit = rows(stamp(stamp(blank(16, H), sitBody, 0, H - 21), [
    '.....KSK.KSK....',
    '....KSSK.KSSK...',
    '.....KK...KK....',
  ], 0, H - 3));
  const fish = withRod(left[0], { handX: 10, handY: 13 });
  return { w: 16, h: H, ox: 0, oy: 24 - H, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// WICK DORROW, puffling. The smallest walker: a round dark chick with a white
// belly, a tiny orange beak and feet, and a knit cap (C, band D) that has
// slipped down over his eyes. Walk: a waddle (lean left / right).
// ---------------------------------------------------------------------------
const PUFF = {};
PUFF.downBody = [
  '.....kDDDk......',
  '....kCCCCCk.....',
  '...kCCCCCCCk....',
  '...kCCCCCCCck...',
  '...kDDDDDDDDk...',
  '..KFKMMMMMMKFK..',
  '..KFFKMNNMKFFK..',
  '..KFFKMMMMKFFK..',
  '..KFFFKMMKFFfK..',
  '..KFFFMMMMFFfK..',
  '..KFFKMMMMKFfK..',
  '..KFFKMMMMKffK..',
  '...KFKMMMMKfK...',
  '....KKmmmmKK....',
];
PUFF.downLegs = {
  idle: pad(['....KBBK.KBBK...', '....KKKK.KKKK...'], 16, 2),
  a: pad(['....KBBK........', '....KKKK.KBBK...'], 16, 2),
  b: pad(['.........KBBK...', '....KBBK.KKKK...'], 16, 2),
};
PUFF.upBody = [
  '.....kDDDk......',
  '....kCCCCCk.....',
  '...kCCCCCCCk....',
  '...kCCCCCCCck...',
  '...kDDDDDDDDk...',
  '..KFFFFFFFFFFK..',
  '..KFFFFFFFFFfK..',
  '..KFFFFFFFFFfK..',
  '..KFFFFFFFFffK..',
  '..KFFFFFFFFffK..',
  '..KFFFFFFFfffK..',
  '..KfFFFFFFfffK..',
  '...KfFFFffffK...',
  '....KKKKKKKK....',
];
PUFF.leftBody = [
  '.....kDDDk......',
  '....kCCCCCk.....',
  '...kCCCCCCCk....',
  '...kCCCCCCCck...',
  '...kDDDDDDDDk...',
  '..KMMMKFFFFFFK..',
  '.KNNMMKFFFFFfK..',
  '..KMMMKFFFFFfK..',
  '..KMMMMKFFFffK..',
  '..KMMMMKFFFffK..',
  '..KMMMMKFFfffK..',
  '..KmMMMKFffffK..',
  '...KmMMKfffK....',
  '....KKKKKKK.....',
];
PUFF.leftLegs = {
  idle: pad(['.....KBBBK......', '.....KKKKK......'], 16, 2),
  a: pad(['...KBBBK.KBBK...', '....KKKK.KKKK...'], 16, 2),
  b: pad(['.....KBBBK......', '.....KKKKK......'], 16, 2),
};
export function buildPuffling() {
  // waddle: the body leans 1px left on A and 1px right on B instead of bobbing
  const lean = (body, legs) => [
    frame([legs.idle, 0, 22], [body, 0, 8]),
    frame([legs.a, 0, 22], [body, -1, 8]),
    frame([legs.idle, 0, 22], [body, 0, 8]),
    frame([legs.b, 0, 22], [body, 1, 8]),
  ];
  const down = lean(PUFF.downBody, PUFF.downLegs);
  const up = lean(PUFF.upBody, PUFF.downLegs);
  const left = lean(PUFF.leftBody, PUFF.leftLegs);
  const sit = frame([PUFF.downBody, 0, 9], [['...KBBBK.KBBBK..', '....KKKK.KKKK...'], 0, 22]);
  const fish = withRod(left[0], { handX: 9, handY: 16 });
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// LUDO, fruit bat. Idle hangs upside down from the top of the cell (feet S on
// row 0, head at the bottom, ears pointing down). The walk cycle is flight:
// wings mid / up / mid / down, lantern (X) carried on a cord.
// ---------------------------------------------------------------------------
const BAT = {};
BAT.hang = [
  '......KSKKSK....',
  '......KSKKSK....',
  '.....KFFFFFFK...',
  '....KFFFFFFFfK..',
  '...KFfFFFFFFffK.',
  '...KFfFFFFFFffK.',
  '...KFfFFFFFFffK.',
  '...KFfFFFFFFffK.',
  '...KFffFFFFfffK.',
  '....KffFFFfffK..',
  '.....KFMMMMFK...',
  '....KFMMMMMMfK..',
  '....KMEMMMMEMK..',
  '....KMEMMMMEMK..',
  '....KMMMNNMMMK..',
  '....KPMMMMMMPK..',
  '....KPPKMMKPPK..',
  '.....KK.KK.KK...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
// flight, facing down (toward the viewer): wings spread, head at the top
BAT.flyMid = [
  '................',
  '................',
  '................',
  '......KK.KK.....',
  '.....KPFKFPK....',
  '.....KFMMMFK....',
  '....KFMEMMEMK...',
  'KK..KMMMNNMMK.KK',
  'KFKKKMMMMMMKKKFK',
  'KFFFFKFFFFKFFFfK',
  'KFfFFFFFFFFFFffK',
  '.KFfFFFFFFFFffK.',
  '.KffFKFFFFKfffK.',
  '..KKKKFFFFKKKK..',
  '......KfffK.....',
  '.......KKK......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
BAT.flyUp = [
  '................',
  '................',
  '................',
  '......KK.KK.....',
  'KK...KPFKFPK..KK',
  'KFK..KFMMMFK.KFK',
  'KFFKKFMEMMEMKKFK',
  'KFFFFKMMNNMMKFFK',
  '.KFfFFKMMMMKFffK',
  '.KffFFKFFFFKFffK',
  '..KffFFFFFFFffK.',
  '...KKffFFFFffK..',
  '.....KKFFFFKK...',
  '......KfffK.....',
  '.......KKK......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
BAT.flyDown = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......KK.KK.....',
  '.....KPFKFPK....',
  '.....KFMMMFK....',
  '....KFMEMMEMK...',
  '....KMMMNNMMK...',
  '...KKMMMMMMKK...',
  '..KFFKFFFFKFfK..',
  '.KFfFFFFFFFFffK.',
  'KFfFFFFFFFFFFffK',
  'KFKKKFFFFFFKKKfK',
  'KK..KKfFFFfK..KK',
  '......KfffK.....',
  '.......KKK......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const back = (f) => f.map((r) => r.replace(/[MEN]/g, (c) => (c === 'E' ? 'F' : c === 'N' ? 'F' : 'F')));
BAT.sideMid = [
  '................',
  '................',
  '................',
  '................',
  '....KK..........',
  '...KPFK.........',
  '..KKFFFK........',
  '.KMEMFFFKKKK....',
  'KMMMMFFFFFFFKK..',
  'KNMMFFFFFFFFffK.',
  '.KMFFFFFFFFfffK.',
  '..KFfFFFFFfffK..',
  '...KKffffffKK...',
  '.....KKKKKK.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
BAT.sideUp = [
  '................',
  '................',
  '................',
  '............KK..',
  '....KK.....KFfK.',
  '...KPFK...KFffK.',
  '..KKFFFK.KFfffK.',
  '.KMEMFFFKFFffK..',
  'KMMMMFFFFFFffK..',
  'KNMMFFFFFFFffK..',
  '.KMFFFFFFFfffK..',
  '..KFfFFFFfffK...',
  '...KKfffffKK....',
  '.....KKKKK......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
BAT.sideDown = [
  '................',
  '................',
  '................',
  '................',
  '....KK..........',
  '...KPFK.........',
  '..KKFFFK........',
  '.KMEMFFFKK......',
  'KMMMMFFFFFKK....',
  'KNMMFFFFFFFfK...',
  '.KMFFFFFFFfffK..',
  '..KFfFFFfffffK..',
  '...KKffffKKffK..',
  '.....KKKK..KfK..',
  '............KK..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const LANTERN = ['.k.', 'kXk', 'kXk', '.k.'];
/** Wing membrane: fur outside the body column becomes the paler V / v ramp. */
const membrane = (f, x0 = 5, x1 = 10) => f.map((r) => [...r].map((ch, x) => (x < x0 || x > x1) ? (ch === 'F' ? 'V' : ch === 'f' ? 'v' : ch) : ch).join(''));
/** Soft ground shadow (z is a translucent ink) for anything airborne. */
export function groundShadow(f, w = 6, cx = 8) {
  const g = f.map((r) => [...r]);
  const x0 = cx - (w >> 1);
  under(g, ['.' + 'z'.repeat(w - 2) + '.', '..' + 'z'.repeat(Math.max(0, w - 4)) + '..'], x0, 22);
  return rows(g);
}
export function buildBat() {
  const lant = (f, x, y) => groundShadow(rows(stamp(f.map((r) => [...r]), LANTERN, x, y)));
  const down = [BAT.flyMid, BAT.flyUp, BAT.flyMid, BAT.flyDown].map((f) => lant(membrane(f), 12, 14));
  const up = [BAT.flyMid, BAT.flyUp, BAT.flyMid, BAT.flyDown].map((f) => lant(membrane(back(f)), 12, 14));
  const left = [BAT.sideMid, BAT.sideUp, BAT.sideMid, BAT.sideDown].map((f) => lant(membrane(f, 3, 9), 2, 13));
  const hang = lant(BAT.hang, 12, 15);
  const fish = withRod(hang, { rod: false, handX: 10, handY: 17 });
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit: hang, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX, poses: { hang } };
}

// ---------------------------------------------------------------------------
// DIMITY, rosy maple moth. Tiny: pink (F) and yellow (Y) wings, fuzzy yellow
// body (M), feathery antennae. Flutters at 15 fps: the walk frames are wing
// beats. She hovers, so the sprite floats above the feet row.
// ---------------------------------------------------------------------------
const MOTH = {};
MOTH.top = [
  '..K.......K.....',
  '...K.....K......',
  '.KKKKMMMKKKK....',
  'KYYYYKMEKYYYYK..',
  'KFFYYYMMMYYFFK..',
  'KFFFYYMMMYFFFK..',
  '.KFFFYMMMYFFFK..',
  '..KKFYMmMYFKK...',
  '....KKKmmKKK....',
];
MOTH.topUp = [
  '..K.......K.....',
  '...K.....K......',
  '..KKKKMMMKKKK...',
  '..KYYYKMEKYYYK..',
  '..KFYYYMMMYYFK..',
  '..KFFYYMMMYYFK..',
  '...KFFYMMMYFK...',
  '....KKYMmMYK....',
  '.....KKmmKK.....',
];
MOTH.topDown = [
  '..K.......K.....',
  '...K.....K......',
  '.KKKKKMMMKKKKK..',
  'KYYYYYKMEKYYYYYK',
  'KFFFYYYMMMYYFFFK',
  '.KFFFYYMMMYYFFK.',
  '..KKKFYMMMYFKK..',
  '.....KYMmMYK....',
  '......KmmKK.....',
];
// Side flight: the near wing is drawn big and patterned (pink base and tip,
// yellow band) and swings through up / level / down, so the profile reads as
// a moth at 1x instead of a flat sliver. Fuzzy cream thorax, feathered antenna.
MOTH.side = [
  '................',
  '..K.......KKK...',
  '...K.....KLLFK..',
  '..KKMK..KLFFFfK.',
  '.KEMMMKKYYYFFfK.',
  'KMMMMMMYYYFFffK.',
  '.KmMMMMKYFFffK..',
  '..KKmmMMKKKKK...',
  '....KKKKK.......',
];
MOTH.sideUp = [
  '.........KK.....',
  '........KLFK....',
  '..K....KLFFK....',
  '...K...KFYYK....',
  '..KKMKKFYYFK....',
  '.KEMMMKYYFfK....',
  'KMMMMMMYYKK.....',
  '.KmMMMMMmK......',
  '..KKmmmmK.......',
  '....KKKK........',
];
MOTH.sideDown = [
  '................',
  '..K.............',
  '...K............',
  '..KKMK..........',
  '.KEMMMKKKK......',
  'KMMMMMMYYFKK....',
  '.KmMMMKYYYFFK...',
  '..KKmmKFYYFfK...',
  '.....KLFFFffK...',
  '......KFFffK....',
  '.......KKKK.....',
];
MOTH.rest = [ // wings folded like a tent
  '....K...K.......',
  '.....K.K........',
  '....KKMMK.......',
  '...KYKEMMK......',
  '..KYYYMMMYK.....',
  '.KFFYYMMMYYK....',
  '.KFFFYYMmYFK....',
  '..KKKKKmKKK.....',
  '................',
];
export function buildMoth() {
  // hovers about a tile off the ground with a soft shadow below
  const at = (p, y = 9) => groundShadow(frame([p, 0, y]), 4, 7);
  const down = [at(MOTH.top), at(MOTH.topUp, 8), at(MOTH.top), at(MOTH.topDown, 10)];
  const up = down.map((f) => f); // top view reads the same from behind
  const left = [at(MOTH.side, 9), at(MOTH.sideUp, 8), at(MOTH.side, 9), at(MOTH.sideDown, 9)];
  const sit = frame([MOTH.rest, 0, 15]);
  const fish = withRod(sit, { rod: false, handX: 6, handY: 19 });
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit, fish: fish[0], fishFrames: fish, fishW: FISH_W, fishOx: FISH_OX };
}

// ---------------------------------------------------------------------------
// THE THATCH, a finch crew (goldfinches): three tiny birds sharing one cell,
// red face (R), buff body (F), black-and-gold wings (S / Y), one carrying a
// straw for the roofs at 05:40. They hop instead of walking: each walk frame
// lifts a different finch. Small on purpose: read as a flock, not three people.
// ---------------------------------------------------------------------------
const FINCH = {
  // facing the viewer (7x7): black cap, red face, pale bill, white cheeks,
  // buff breast, black wings with the gold bar
  down: ['..KKK..', '.KSSSK.', 'KRERERK', 'KMRNRMK', 'KSFFFSK', 'KYFFFYK', '.KKSKK.'],
  // back (7x7)
  up: ['..KKK..', '.KSSSK.', 'KSFFFSK', 'KSFFFSK', 'KYSSSYK', 'KSYSYSK', '.KKTKK.'],
  // facing left (8x6)
  left: ['..KKK...', '.KRRSK..', 'NRERSSK.', '.KMFSYSK', '..KFFSSK', '...KKKTK'],
};
const STRAW = ['Y', 'Y', 'y'];
function finchCrew(facing, lift) {
  const g = blank();
  const p = FINCH[facing];
  const spots = facing === 'left' ? [[0, 16], [8, 17], [4, 11]] : [[0, 16], [9, 16], [4, 11]];
  spots.forEach(([x, y], i) => {
    const dy = lift === i ? -2 : 0;
    stamp(g, p, x, y + dy);
    if (i === 1) stamp(g, facing === 'left' ? ['YYy'] : STRAW, facing === 'left' ? x - 2 : x + 7, y + dy + (facing === 'left' ? 2 : 1));
  });
  // little ground shadows under each bird
  for (const [x, y] of spots) under(g, ['.zzzzz.'], x, Math.min(23, y + 7));
  return rows(g);
}
export function buildFinches() {
  const mk = (f) => [finchCrew(f, -1), finchCrew(f, 0), finchCrew(f, -1), finchCrew(f, 1)];
  const down = mk('down'), up = mk('up'), left = mk('left');
  const sit = finchCrew('down', 2);
  return { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right: left.map(flipH), sit, fish: sit, fishFrames: [sit, sit, sit, sit], fishW: 16, fishOx: 0, poses: { perch: sit } };
}

export function buildOtherBodies() {
  return {
    magpie: buildMagpie(),
    crab: buildCrab(),
    snail: buildSnail(),
    heron: buildHeron(),
    puffling: buildPuffling(),
    bat: buildBat(),
    moth: buildMoth(),
    spoonbill: buildSpoonbill(),
    finches: buildFinches(),
  };
}

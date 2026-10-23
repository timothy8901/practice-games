// js/art/chars/mammals.js  [ART-CHARS] (from proto/chars/mammals.js)
// Changes on adoption (ARCHITECTURE §8.4 style, named): the river-otter head and tail
// become the PINE MARTEN (GDD-00 §3 / §14); makeTorso takes a mask set so stocky
// bodies get a wide torso (MASK_WIDE); the fishing wind-up raises the rod arm
// (polish backlog); buildMammal accepts squat (shorter legs) and size metadata.
// Shared two-legged "paper-doll" rig for the anthro townsfolk + player species.
// 16x24 cell, feet on row 23, body centred between cols 7/8. Light from top-left.
//
// Role letters (hex per character in palettes.js):
//  K outline (fur)   k outline (cloth, ink)
//  F fur   f fur shade   L fur light
//  M mask / muzzle light   m mask shade
//  E eye   W glint   N nose   P pink
//  R accent fur (stripes, patches, eye mask)   r accent shade
//  S dark limbs (paws / socks)   s limb shade
//  B boots   b boot shade
//  C cloth   c cloth shade   D cloth 2   d cloth 2 shade   Y cloth accent (buttons, trim, teeth)
//  T tail alt   t tail alt shade   H hair   A brass   a brass shade / wood   G glass   X glow
//
// Layout: head part 12x11 at (2,0); torso 16x7 at (0,11); legs 16x7 at (0,17)
// (row 17 of the legs is covered by the torso hem). On the two stride frames the
// head + torso + tail drop by one pixel (contact bounce); the legs stay put.
import { blank, stamp, under, rows, flipH } from './rig.js';
import { drawRod } from './rod.js';

const assertW = (name, part, w) => {
  part.forEach((r, i) => { if (r.length !== w) throw new Error(`${name} row ${i} is ${r.length} wide, want ${w}: ${r}`); });
  return part;
};

// ---------------------------------------------------------------------------
// HEADS: 12 wide x 11 tall, stamped at (2,0). Row 10 is the chin.
// 'up' is derived from 'down' unless a species draws its own.
// ---------------------------------------------------------------------------
export const HEADS = {};

HEADS.redpanda = {
  down: [
    '.KK......KK.',
    'KFmK....KmFK',
    'KFFFKKKKFFFK',
    '.KLLFFFFFfK.',
    '.KLFFFFFFfK.',
    '.KFMMFFMMfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KfMMMMMMfK.',
    '.KffMNNMffK.',
    '..KKmMMmKK..',
  ],
  left: [
    '....KK..KK..',
    '...KFmKKmFK.',
    '...KFFFFFFFK',
    '..KLLFFFFFfK',
    '..KLFFFFFFfK',
    '..KFMMFFFFfK',
    '..KFWEFFFFfK',
    '.KKFEEFFFFfK',
    'KMMMFFFFFffK',
    'KNMMMMFFfffK',
    '.KKKKffffKK.',
  ],
};

// Pine marten (replaces the river otter): rounded ears with pale rims, rich
// brown coat, a pointed muzzle and the marten's creamy-apricot throat bib
// (M / m) running down into the collar.
HEADS.marten = {
  down: [
    '.KKK....KKK.',
    'KMPMK..KMPMK',
    'KFFFFKKFFFfK',
    '.KLLFFFFFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KfFFNNFFfK.',
    '.KfMMMMMMfK.',
    '..KMMMMMmK..',
    '...KKMmKK...',
  ],
  left: [
    '......KKK...',
    '.....KMPMK..',
    '...KKKFFFfK.',
    '..KLLFFFFFfK',
    '..KLFFFFFFfK',
    '..KFWEFFFFfK',
    '.KKFEEFFFffK',
    'KFFFFFFFFffK',
    'NFFFMMFFfffK',
    '.KKMMMMMffK.',
    '...KMMMmKK..',
  ],
};

HEADS.vole = {
  down: [
    '............',
    '............',
    '...KKKKKK...',
    '.KKLLFFFFKK.',
    'KFLLFFFFFFfK',
    'KFFWEFFWEffK',
    'KFFEEFFEEffK',
    'KFFMMMMMMffK',
    '.KMMMNNMMmK.',
    '.KmMMMMMmfK.',
    '..KKKmmKKK..',
  ],
  left: [
    '............',
    '............',
    '....KKKKKK..',
    '..KKLLFFFFK.',
    '.KLLFFFFFFfK',
    '.KFWEFFFKFfK',
    'KMMEEFFFFffK',
    'KMMMMFFFFffK',
    'KNMMMMFFfffK',
    '.KmMMmfffKK.',
    '..KKKKKKK...',
  ],
};

HEADS.opossum = {
  down: [
    '.KK......KK.',
    'KRPK....KPRK',
    'KRRRKKKKRRRK',
    '.KMMMFFMMMK.',
    '.KMMMFFMMmK.',
    '.KRRMFFMRRK.',
    '.KRWEMMWERK.',
    '.KMEEMMEEmK.',
    '..KMMMMMMK..',
    '...KMMMMK...',
    '....KPPK....',
  ],
  left: [
    '....KK..KK..',
    '...KRPKKPRK.',
    '...KRRRRRRRK',
    '..KMMMFFFFfK',
    '..KMMMMFFFfK',
    '..KRRMMMFFfK',
    '.KKRWEMMFffK',
    'KMMMEEMMMffK',
    'KMMMMMMMfffK',
    'KPMMMMMfffK.',
    '.KKKKKKKKK..',
  ],
};

HEADS.ferret = {
  down: [
    '............',
    '..KKKKKKKK..',
    '.KLFFFFFFfK.',
    'KFKMMMMMMKfK',
    'KKMMMMMMMmKK',
    '.KRRRRRRRrK.',
    '.KRWERRWErK.',
    '.KmEEMMEEmK.',
    '.KMMMMMMMmK.',
    '.KmMMNNMMmK.',
    '..KKmMMmKK..',
  ],
  left: [
    '............',
    '....KKKKKKK.',
    '...KLFFFFFfK',
    '..KMMMMMFKfK',
    '.KKMMMMMMMfK',
    '.KRRRRMMMMfK',
    'KMRWERMMMffK',
    'KMmEEMMMMffK',
    'KNMMMMMMfffK',
    '.KmMMmmfffK.',
    '..KKKKKKKK..',
  ],
};

HEADS.mongoose = {
  down: [
    '............',
    '...KKKKKK...',
    '..KLFfFfFK..',
    'KFKLFFFFFKfK',
    'KKFFfFfFFfKK',
    '.KFWEFFWEfK.',
    '.KREEFFEERK.',
    '.KFMMMMMMfK.',
    '..KMMMMMMK..',
    '...KMMNNK...',
    '....KKKK....',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '...KLFfFfFK.',
    '..KLFFFFFKfK',
    '..KFfFfFFffK',
    '.KKFWEFFFFfK',
    'KMMREEFFFffK',
    'KMMMMFFFfffK',
    'KNMMMMMffffK',
    '.KKMMmffffK.',
    '...KKKKKKK..',
  ],
};

HEADS.beaver = {
  down: [
    '..AAA.AAA...',
    '..AGA.AGA...',
    '.KAAAFAAAfK.',
    'AKLFFFFFFfKK',
    'AKFWEFFWEfK.',
    'KKFEEFFEEfK.',
    '.KFMMMMMMfK.',
    '.KMMMNNMMmK.',
    '.KMMMYYMMmK.',
    '.KmMMYYMMmK.',
    '..KKmmmmKK..',
  ],
  left: [
    '......AAAAA.',
    '......AGAGA.',
    '....KKAAAAAK',
    '...KLFFFFFfK',
    '..KKFFFFFFfK',
    '..KFWEFFFFfK',
    '.KKFEEFFFffK',
    'KMMMMFFFFffK',
    'KNMMMMFFfffK',
    'KmMYYMfffffK',
    '.KKKKKKKKKK.',
  ],
};

// Ambrose: Wren's head grizzled and settled; no forehead spectacles but
// bottle-bottom lenses (brass rims, magnified pupils) over his eyes and
// bushy pale brows (M). Tiny ears, flat top.
HEADS.beaverElder = {
  down: [
    '............',
    '..KK....KK..',
    '.KfKKKKKKfK.',
    '.KLFFFFFFfK.',
    '.KMMMFFMMMK.',
    '.KAAAFFAAAK.',
    '.KAEAAAAEAK.',
    '.KAAAFFAAAK.',
    '.KFMMNNMMfK.',
    '.KMMMYYMMmK.',
    '..KKmYYmKK..',
  ],
  left: [
    '............',
    '........KK..',
    '....KKKKfFK.',
    '...KLFFFFFfK',
    '..KMMMFFFFfK',
    '..KAAAAFFFfK',
    '.KKAEGAFFffK',
    'KMMAAAAFFffK',
    'KNMMMMFFfffK',
    'KmMYYMfffffK',
    '.KKKKKKKKKK.',
  ],
};
HEADS.beaverElder.up = null; // derived below without keeping the brass

HEADS.badger = {
  down: [
    '............',
    '..KKKKKKKK..',
    '.KMMRMMRMMK.',
    'KRMRRMMRRMRK',
    'KRMRRMMRRMRK',
    '.KMWEMMWEMK.',
    '.KMEEMMEEMK.',
    '.KMRRMMRRMK.',
    '.KMmRMMRmMK.',
    '.KmMMNNMMmK.',
    '..KKmMMmKK..',
  ],
  left: [
    '............',
    '....KKKKKKK.',
    '...KMMRMMMRK',
    '..KMMRRMMKRK',
    '..KMMRRMMMRK',
    '.KKMWEMMMMMK',
    'KMMREEMMMMmK',
    'KMMMRRMMMmmK',
    'KNMMmRMMmmmK',
    '.KmMMMMmmmK.',
    '..KKKKKKKK..',
  ],
};

HEADS.stoat = {
  down: [
    '............',
    '...KKKKKK...',
    '.KKLLFFFFKK.',
    'KFKLFFFFFKfK',
    'KKFFFFFFFfKK',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KFMMMMMMfK.',
    '.KMMMNNMMmK.',
    '.KmMMMMMmmK.',
    '..KKmmmmKK..',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '..KKLLFFFFK.',
    '.KLLFFFFFKfK',
    '.KFFFFFFFFfK',
    '.KFWEFFFFFfK',
    'KMMEEFFFFffK',
    'KMMMMFFFFffK',
    'KNMMMMFFfffK',
    '.KmMMmffffK.',
    '..KKKKKKKK..',
  ],
};

for (const [n, h] of Object.entries(HEADS)) { assertW(n + '.down', h.down, 12); assertW(n + '.left', h.left, 12); }

/**
 * Back of the head from the front view: keep the silhouette and any brass
 * (spectacles) / accent ears, fill the rest with fur and shade it from the
 * top-left. Species whose ears are accent-coloured keep them.
 */
export function backHead(front, { keep = 'KAG', earRows = 2, earLetter = 'F' } = {}) {
  const keepSet = new Set(keep);
  const hasR = front.some((r) => r.includes('R'));
  return front.map((row, y) => {
    const chars = [...row];
    // find interior span for shading
    let first = -1, last = -1;
    chars.forEach((ch, x) => { if (ch !== '.') { if (first < 0) first = x; last = x; } });
    return chars.map((ch, x) => {
      if (ch === '.' || keepSet.has(ch)) return ch;
      if (y < earRows && ch === 'R') return 'R';
      if (y < earRows && ch === 'P') return hasR ? 'R' : 'f'; // dark ear backs
      if (y < earRows) return earLetter;
      const bottom = y >= front.length - 2;
      const right = x >= last - 1;
      const topLeft = y <= 4 && x <= first + 2;
      if (bottom || right) return 'f';
      if (topLeft && y >= 2) return 'L';
      return 'F';
    }).join('');
  });
}
HEADS.beaverElder.up = backHead(HEADS.beaverElder.down, { keep: 'K' });
for (const h of Object.values(HEADS)) if (!h.up) h.up = backHead(h.down);

// ---------------------------------------------------------------------------
// TORSOS: 16 wide x 7 tall, stamped at (0,11). Built from masks so every outfit
// gets idle / arm-forward / arm-back side views and a fishing pose.
//   o outline(k)  x cloth  h hand(S)  f fur (bare arm)  . empty
// ---------------------------------------------------------------------------
const MASK = {
  down: [
    '....oxxxxxxo....',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...ohxxxxxxho...',
    '...ohxxxxxxho...',
    '....oxxxxxxo....',
  ],
  left: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '....oxxoxxxo....',
    '....oxxoxxxo....',
    '....oxxohhxo....',
    '....oxxohhxo....',
    '.....oxxxxo.....',
  ],
  leftFwd: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '...oxxoxxxxo....',
    '...oxxoxxxxo....',
    '...ohhoxxxxo....',
    '...ohhoxxxxo....',
    '.....oxxxxo.....',
  ],
  leftBack: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '....oxxxxoxxo...',
    '....oxxxxoxxo...',
    '....oxxxxohho...',
    '....oxxxxohho...',
    '.....oxxxxo.....',
  ],
  // front/back walk: viewer-left arm swung back (short), viewer-right arm forward (long)
  downA: [
    '....oxxxxxxo....',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...ohxxxxxxxo...',
    '...ohxxxxxxxo...',
    '....oxxxxxxho...',
    '....oxxxxxxho...',
  ],
  downB: [
    '....oxxxxxxo....',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...oxxxxxxxho...',
    '...oxxxxxxxho...',
    '...ohxxxxxxo....',
    '...ohxxxxxxo....',
  ],
  // run, side view: elbows bent, fists pumped high
  runFwd: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '...oxxoxxxxo....',
    '..ohhoxxxxxo....',
    '..ohhoxxxxxo....',
    '....oxxxxxxo....',
    '.....oxxxxo.....',
  ],
  runBack: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '....oxxxxoxxo...',
    '....oxxxxxoxxo..',
    '....oxxxxxohho..',
    '....oxxxxxohho..',
    '.....oxxxxo.....',
  ],
  fish: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '..oxxxxoxxxo....',
    '..ohhxxoxxxo....',
    '...oooxxxxxo....',
    '....oxxxxxxo....',
    '.....oxxxxo.....',
  ],
  // fishing wind-up: the rod arm swings up to the chin (hand at row 0)
  fishWind: [
    '..ohhoxxxxo.....',
    '...oxxoxxxxo....',
    '....ooxxxxxo....',
    '....oxxxxxxo....',
    '....oxxxxxxo....',
    '....oxxxxxxo....',
    '.....oxxxxo.....',
  ],
  // seated: elbows soft, both hands resting together in the lap (polish: sits read stiff)
  sit: [
    '....oxxxxxxo....',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...oxoxxxxoxo...',
    '...oxxoxxoxxo...',
    '....oxxhhxxo....',
    '....oxxxxxxo....',
  ],
};

/**
 * Wide torso masks for stocky bodies (Tully, Bryony, Augusta): the trunk is
 * 2 px wider in the front views; profiles keep the standard depth. Same keys as MASK.
 */
export const MASK_WIDE = {
  down: [
    '...oxxxxxxxxo...',
    '..oxxxxxxxxxxo..',
    '..oxxxxxxxxxxo..',
    '..oxxxxxxxxxxo..',
    '..ohxxxxxxxxho..',
    '..ohxxxxxxxxho..',
    '...oxxxxxxxxo...',
  ],
  downA: [
    '...oxxxxxxxxo...',
    '..oxxxxxxxxxxo..',
    '..oxxxxxxxxxxo..',
    '..ohxxxxxxxxxo..',
    '..ohxxxxxxxxxo..',
    '...oxxxxxxxxho..',
    '...oxxxxxxxxho..',
  ],
  downB: [
    '...oxxxxxxxxo...',
    '..oxxxxxxxxxxo..',
    '..oxxxxxxxxxxo..',
    '..oxxxxxxxxxho..',
    '..oxxxxxxxxxho..',
    '..ohxxxxxxxxo...',
    '..ohxxxxxxxxo...',
  ],
  sit: [
    '...oxxxxxxxxo...',
    '..oxxxxxxxxxxo..',
    '..oxxxxxxxxxxo..',
    '..oxoxxxxxxoxo..',
    '..oxxoxxxxoxxo..',
    '...oxxxhhxxxo...',
    '...oxxxxxxxxo...',
  ],
};
// profile views keep the standard depth (the width reads from the front)
for (const k of Object.keys(MASK)) if (!MASK_WIDE[k]) MASK_WIDE[k] = MASK[k];

/**
 * Build a torso set from a fill function. fill(r, c, info) -> letter for an
 * 'x' pixel; info = { shadeCol (true on the right-most interior column), side }.
 */
const CREASE = { C: 'c', D: 'd', F: 'f' };
export function makeTorso(fill, { hand = 'S', outline = 'k', crease = true, masks = MASK } = {}) {
  const out = {};
  const wide = masks === MASK_WIDE;
  for (const [key, mask] of Object.entries(masks)) {
    const front = key === 'down' || key === 'sit' || key === 'downA' || key === 'downB';
    const side = !front;
    out[key] = mask.map((row, r) => {
      let last = -1;
      for (let c = 0; c < row.length; c++) if (row[c] === 'x') last = c;
      return [...row].map((ch, c) => {
        if (ch === '.') return '.';
        if (ch === 'o') return outline;
        if (ch === 'h') return hand;
        const v = fill(r, c, { shadeCol: c === last, side, key });
        // front view: a 1px fold where each sleeve meets the body (armpit
        // crease) so the arms read as arms, not a box; shade only.
        if (crease && front && r >= 2 && r <= 5 && (c === (wide ? 4 : 5) || c === (wide ? 11 : 10)) && CREASE[v]) return CREASE[v];
        return v;
      }).join('');
    });
  }
  out.up = out.down;
  return out;
}

export const TORSOS = {};
/** Fill functions + default options by torso name, so variants (bird hands, wide masks) reuse them. */
export const TORSO_FILLS = {};
const torso = (name, fill, opts = {}) => { TORSO_FILLS[name] = { fill, opts }; return makeTorso(fill, opts); };
/** A torso by name with option overrides, e.g. torsoVariant('coat', { hand: 'T', masks: MASK_WIDE }). */
export function torsoVariant(name, opts = {}) {
  const t = TORSO_FILLS[name];
  if (!t) throw new Error(`chars: unknown torso ${name}`);
  return makeTorso(t.fill, { ...t.opts, ...opts });
}
// Lighthouse-stripe jumper (player). D navy at collar/hem, C cream between.
TORSOS.jumper = torso('jumper', (r, c, { shadeCol }) => {
  const navy = r === 0 || r === 3 || r === 6; // 2px cream bands, navy collar/hem
  const base = navy ? 'D' : 'C';
  return shadeCol ? base.toLowerCase() : base;
});
// Co-op canvas overalls over fur (Wren / Ambrose): bib + straps, bare fur arms.
TORSOS.overalls = torso('overalls', (r, c, { shadeCol, side }) => {
  if (!side) {
    if (r === 0) return c === 5 || c === 10 ? 'C' : 'F';        // straps on shoulders
    if (r === 1) return c === 5 || c === 10 ? 'C' : (c <= 4 || c >= 11 ? (shadeCol ? 'f' : 'F') : 'F');
    if (r === 2) return c >= 5 && c <= 10 ? (c === 6 || c === 9 ? 'A' : 'C') : (shadeCol ? 'f' : 'F'); // buttons
    if (c <= 4 || c >= 11) return r <= 3 ? (shadeCol ? 'f' : 'F') : (shadeCol ? 'c' : 'C');
    return shadeCol || c === 10 ? 'c' : 'C';
  }
  if (r <= 1) return shadeCol ? 'f' : 'F';
  return shadeCol ? 'c' : 'C';
}, { hand: 'F' });
// Knit fisher's jersey with a rolled collar (Tamsin): C body, D collar band.
TORSOS.jersey = torso('jersey', (r, c, { shadeCol }) => {
  if (r === 0) return 'D';
  if (r === 1 && c >= 6 && c <= 9) return 'd';
  return shadeCol ? 'c' : 'C';
});
// Short open jacket over a tee (Linnet): C jacket, D tee showing at the centre.
TORSOS.jacket = torso('jacket', (r, c, { shadeCol, side }) => {
  if (!side && r >= 1 && c >= 7 && c <= 8) return r >= 5 ? 'd' : 'D';
  if (r === 6) return shadeCol ? 'c' : 'C';
  return shadeCol ? 'c' : 'C';
});
// Long reader's coat with a brass clasp (Idris / Corin / Agathe) : C coat, Y clasp, D lapels.
TORSOS.coat = torso('coat', (r, c, { shadeCol, side }) => {
  if (!side) {
    if (r <= 1 && (c === 6 || c === 9)) return 'D';
    if (r === 2 && c >= 7 && c <= 8) return 'Y';
    if (r >= 3 && c === 8) return 'c';
  }
  return shadeCol ? 'c' : 'C';
});
// Work vest and rolled sleeves (Teo / route trainers): D vest over C shirt, bare fur forearms.
TORSOS.vest = torso('vest', (r, c, { shadeCol, side }) => {
  if (!side) {
    if (c <= 4 || c >= 11) return r >= 3 ? (shadeCol ? 'f' : 'F') : (shadeCol ? 'c' : 'C');
    if (c === 7 || c === 8) return r >= 1 ? 'C' : 'D';
    return shadeCol || c === 10 ? 'd' : 'D';
  }
  if (r >= 3 && r <= 5) return shadeCol ? 'f' : 'F';
  return shadeCol ? 'd' : 'D';
}, { hand: 'F' });

// Work apron over a shirt (co-op errands, Osric, Bryony): C shirt / sleeves,
// D apron bib + skirt with a Y pocket stitch; the apron ties show in profile.
TORSOS.apron = torso('apron', (r, c, { shadeCol, side, key }) => {
  const front = !side;
  const wideish = c >= 5 && c <= 10;
  if (front) {
    if (r === 0) return c === 6 || c === 9 ? 'D' : (shadeCol ? 'c' : 'C');
    if (wideish && r >= 1) { if (r === 4 && (c === 7 || c === 8)) return 'Y'; return shadeCol || c === 10 ? 'd' : 'D'; }
    return shadeCol ? 'c' : 'C';
  }
  if (key === 'left' || key === 'leftFwd' || key === 'leftBack' || key === 'fish' || key === 'fishWind' || key.startsWith('run')) {
    if (r >= 1 && c <= 6 && c >= 4) return 'D';
    if (r === 3 && c >= 9) return 'd'; // tie at the back
  }
  return shadeCol ? 'c' : 'C';
});
// Shawl over a long dress (Isolde): D shawl across the shoulders, C dress.
TORSOS.shawl = torso('shawl', (r, c, { shadeCol, side }) => {
  if (r <= 2) return shadeCol ? 'd' : 'D';
  if (!side && r === 3 && c >= 6 && c <= 9) return 'd';
  return shadeCol ? 'c' : 'C';
});

// ---------------------------------------------------------------------------
// LEGS: 16 wide x 7 tall, stamped at (0,17). Row 17 hides under the hem.
// S socks / fur legs, B boots. Only the silhouette gets an outline.
// ---------------------------------------------------------------------------
export const LEGS = {
  down: {
    idle: [
      '....SSS..SSS....',
      '....SSS..SSS....',
      '....SSs..SSs....',
      '....SSs..SSs....',
      '...KBBB..BBbK...',
      '...KBBb..BbbK...',
      '....KKK..KKK....',
    ],
    // viewer-left leg planted and forward, right leg lifted behind
    a: [
      '....SSS..SSS....',
      '....SSS..SSS....',
      '....SSs..BBb....',
      '....SSs..Bbb....',
      '...KBBB..KKK....',
      '...KBBb.........',
      '....KKK.........',
    ],
    b: [
      '....SSS..SSS....',
      '....SSS..SSS....',
      '....BBB..SSs....',
      '....BBb..SSs....',
      '....KKK..BBbK...',
      '.........BbbK...',
      '.........KKK....',
    ],
    // run passing pose: weight on the viewer-left foot, right heel up
    passA: [
      '....SSS..SSS....',
      '....SSS..SSS....',
      '....SSs..SSs....',
      '....SSs..BBb....',
      '...KBBB..BbbK...',
      '...KBBb..KKK....',
      '....KKK.........',
    ],
    passB: [
      '....SSS..SSS....',
      '....SSS..SSS....',
      '....SSs..SSs....',
      '....BBB..SSs....',
      '...KBBb..BBbK...',
      '....KKK..BbbK...',
      '.........KKK....',
    ],
    // seated on a step: thighs toward the viewer, boots dangling and turned out
    sit: [
      '....SSS..SSS....',
      '...KSSsKKSSsK...',
      '...KSSsKKSSsK...',
      '..KBBbK..KBBbK..',
      '...KKK....KKK...',
    ],
  },
  left: {
    idle: [
      '......SSS.......',
      '......SSS.......',
      '......SSs.......',
      '......SSs.......',
      '....KBBBbK......',
      '....KBBbbK......',
      '.....KKKK.......',
    ],
    // near leg forward (left), far leg back (right)
    a: [
      '......SSS.......',
      '.....SSSSS......',
      '....SSs.sSs.....',
      '...KSSs..KsK....',
      '..KBBBbK..K.....',
      '..KBBbbK........',
      '...KKKK.........',
    ],
    b: [
      '......SSS.......',
      '.....SSSSS......',
      '....sSs.sSS.....',
      '....KsK..SSsK...',
      '.....K..KBBBbK..',
      '........KBBbbK..',
      '.........KKKK...',
    ],
    // run: long stride, near leg reaching forward, far foot kicked up behind
    runA: [
      '......SSS.......',
      '.....SSSSs......',
      '....SSs.sSs.....',
      '...SSs...sSsK...',
      '..KBBBbK..KbbK..',
      '..KBBbbK...KK...',
      '...KKKK.........',
    ],
    // run: far leg reaching forward, near foot pushing off behind
    runB: [
      '......SSS.......',
      '.....sSSSS......',
      '....sSs.SSs.....',
      '...KsK...SSs....',
      '..KbbK..KBBBbK..',
      '...KK...KBBbbK..',
      '.........KKKK...',
    ],
    // run: passing, knee driven up and forward, support foot under the hip
    pass: [
      '......SSS.......',
      '.....SSSS.......',
      '...KSSsSs.......',
      '...KBBKSs.......',
      '...KBbKSs.......',
      '....KKBBBbK.....',
      '.....KBBbbK.....',
    ],
  },
};
// Thin bird legs (owl / trainer with boots stays on LEGS): S shanks, B talons.
export const BIRDLEGS = {
  down: {
    idle: ['.....S....S.....', '.....S....S.....', '.....S....S.....', '.....S....S.....', '....KSK..KSK....', '...KBBBKKBBBK...', '....KKK..KKK....'],
    a: ['.....S....S.....', '.....S....S.....', '.....S...KSK....', '.....S..KBBBK...', '....KSK..KKK....', '...KBBBK........', '....KKK.........'],
    b: ['.....S....S.....', '.....S....S.....', '....KSK...S.....', '...KBBBK..S.....', '....KKK..KSK....', '........KBBBK...', '.........KKK....'],
    sit: ['.....S....S.....', '....KSK..KSK....', '...KBBBKKBBBK...', '....KKK..KKK....', '................'],
  },
  left: {
    idle: ['.......S........', '.......S........', '.......S........', '.......S........', '......KSK.......', '....KBBBBK......', '.....KKKK.......'],
    a: ['.......S........', '......SSS.......', '.....S..S.......', '....S...S.......', '...KSK.KSK......', '..KBBBKKBBK.....', '...KKK..KK......'],
    b: ['.......S........', '......SSS.......', '.....S...S......', '....KSK...S.....', '...KBBBK.KSK....', '....KKK.KBBBK...', '.........KKK....'],
  },
};

// ---------------------------------------------------------------------------
// TAILS: free-size parts with an anchor per facing. `behind` = draw first.
// ---------------------------------------------------------------------------
export const TAILS = {};
TAILS.redpanda = {
  // bushy ringed tail curling UP behind the hip to shoulder height; drawn
  // behind the body so only the ringed edge and the curled tip break the
  // silhouette on the right (the cast's only high curled tail)
  down: { x: 10, y: 7, behind: true, part: [
    '..KKK.',
    '.KSSSK',
    '.KTTtK',
    'KFFFfK',
    'KTTTtK',
    'KFFFfK',
    'KTTTtK',
    'KFFFfK',
    'KTTtK.',
    '.KKK..',
  ] },
  up: { x: 0, y: 8, behind: false, part: [
    '..KKK.',
    '.KSSSK',
    '.KTTTK',
    'KFFFK.',
    'KTTTK.',
    'KFFfK.',
    'KTTtK.',
    'KFFfK.',
    '.KKK..',
  ] },
  left: { x: 10, y: 7, behind: true, part: [
    '..KKK.',
    '.KSSSK',
    '.KTTtK',
    'KFFFfK',
    'KTTTtK',
    'KFFFfK',
    'KTTTtK',
    'KFFFfK',
    'KTTtK.',
    '.KKK..',
  ] },
};
TAILS.marten = {
  // long bushy tail carried low and curving up at the dark tip
  down: { x: 10, y: 13, behind: true, part: [
    '....KK',
    '...KSK',
    '...KSK',
    '..KFsK',
    '.KFFK.',
    'KFFfK.',
    'KFffK.',
    '.KKK..',
  ] },
  up: { x: 0, y: 13, behind: false, part: [
    'KK....',
    'KSK...',
    'KsSK..',
    'KfFFK.',
    '.KFFFK',
    '.KfFFK',
    '..KffK',
    '...KK.',
  ] },
  left: { x: 10, y: 13, behind: true, part: [
    '....KK',
    '...KSK',
    '...KSK',
    '..KFsK',
    '.KFFK.',
    'KFFfK.',
    'KFffK.',
    '.KKK..',
  ] },
};
TAILS.vole = {
  down: { x: 11, y: 20, behind: true, part: ['KK...', 'KSSK.', '.KSsK', '..KKK'] },
  up: { x: 7, y: 19, behind: false, part: ['.KK', 'KSK', 'KSK', 'KsK', '.K.'] },
  left: { x: 10, y: 20, behind: true, part: ['KK...', 'KSSK.', '.KSsK', '..KKK'] },
};
TAILS.opossum = {
  // bare prehensile tail curling up in a hook behind the hip
  down: { x: 11, y: 11, behind: true, part: ['.KKK', 'KPPK', 'KPKK', 'KPK.', 'KPK.', 'KPK.', 'KPPK', '.KPK', '..KK'] },
  up: { x: 1, y: 11, behind: false, part: ['KKK.', 'KPPK', 'KKPK', '.KPK', '.KPK', '.KPK', 'KPPK', 'KPK.', 'KK..'] },
  left: { x: 11, y: 11, behind: true, part: ['.KKK', 'KPPK', 'KPKK', 'KPK.', 'KPK.', 'KPK.', 'KPPK', '.KPK', '..KK'] },
};
TAILS.ferret = {
  // slim tail hanging down behind, dark tip
  down: { x: 11, y: 14, behind: true, part: ['KK..', 'KFK.', 'KFfK', '.KFfK', '.KSsK', '..KK.'] },
  up: { x: 2, y: 14, behind: false, part: ['..KK', '.KFK', 'KfFK', 'KfFK', 'KsSK', '.KK.'] },
  left: { x: 11, y: 14, behind: true, part: ['KK..', 'KFK.', 'KFfK', '.KFfK', '.KSsK', '..KK.'] },
};
TAILS.mongoose = {
  // long tapering tail carried low and out, dark tip
  down: { x: 9, y: 15, behind: true, part: ['KK....', 'KFFK..', '.KFFK.', '..KFFK', '...KSsK', '....KKK'] },
  up: { x: 1, y: 15, behind: false, part: ['....KK', '..KFFK', '.KFFK.', 'KFFK..', 'KSsK..', 'KKK...'] },
  left: { x: 9, y: 15, behind: true, part: ['KK....', 'KFFK..', '.KFFK.', '..KFFK', '...KSsK', '....KKK'] },
};
TAILS.beaver = {
  // flat paddle tail lying on the ground, low-left, crosshatched
  down: { x: 0, y: 19, behind: true, part: [
    '..KKKKKK..',
    '.KTtTtTtTK',
    'KtTtTtTtTtK',
    '.KTtTtTtTK',
    '..KKKKKK..',
  ] },
  up: { x: 6, y: 19, behind: false, part: [
    '..KKKKKK..',
    '.KTtTtTtTK',
    'KtTtTtTtTtK',
    '.KTtTtTtTK',
    '..KKKKKK..',
  ] },
  left: { x: 8, y: 19, behind: true, part: [
    '..KKKKK.',
    '.KTtTtTK',
    'KtTtTtTtK',
    '.KTtTtTK',
    '..KKKKK.',
  ] },
};
TAILS.badger = {
  down: { x: 11, y: 17, behind: true, part: ['KK.', 'KMK', 'KMK', '.KK'] },
  up: { x: 2, y: 17, behind: false, part: ['.KK', 'KMK', 'KmK', 'KK.'] },
  left: { x: 11, y: 17, behind: true, part: ['KK.', 'KMK', 'KMK', '.KK'] },
};
TAILS.stoat = {
  // medium tail held up behind, black tip
  down: { x: 11, y: 12, behind: true, part: ['.KK', 'KSK', 'KSK', 'KFK', 'KFK', 'KFK', 'KFK', '.KK'] },
  up: { x: 2, y: 12, behind: false, part: ['KK.', 'KSK', 'KSK', 'KFK', 'KFK', 'KFK', 'KFK', 'KK.'] },
  left: { x: 11, y: 12, behind: true, part: ['.KK', 'KSK', 'KSK', 'KFK', 'KFK', 'KFK', 'KFK', '.KK'] },
};

// ---------------------------------------------------------------------------
// EXTRAS: per-facing stamps drawn after the head (hats, ponytail, props).
// ---------------------------------------------------------------------------
export const EXTRAS = {};
// Linnet's ponytail: a tied tuft at the back of the head (H hair, Y band).
EXTRAS.ponytail = {
  down: { x: 12, y: 5, part: ['.KK', 'KYK', 'KHK', 'KHK', '.KK'] },
  up: { x: 9, y: 3, part: ['KYK', 'KHK', 'KHK', 'KHK', '.K.'] },
  left: { x: 11, y: 4, part: ['KYK..', 'KHHK.', '.KHHK', '..KHK', '...KK'] },
};
// Ambrose's cane (wood 'a', brass head 'A') held in the viewer's right hand.
EXTRAS.cane = {
  down: { x: 12, y: 15, part: ['AA', 'a.', 'a.', 'a.', 'a.', 'a.', 'a.', 'a.', 'K.'] },
  up: { x: 2, y: 15, part: ['AA', '.a', '.a', '.a', '.a', '.a', '.a', '.a', '.K'] },
  left: { x: 3, y: 15, part: ['AA', 'a.', 'a.', 'a.', 'a.', 'a.', 'a.', 'a.', 'K.'] },
};
// Tamsin's knit cap (C cloth), pulled down over the ears.
EXTRAS.cap = {
  down: { x: 3, y: 0, part: ['...kDDDDk...', '..kCCCCCCk..', '.kCCCCCCCck.', '.kcccccccck.'] },
  up: { x: 3, y: 0, part: ['...kDDDDk...', '..kCCCCCCk..', '.kCCCCCCCck.', '.kcccccccck.'] },
  left: { x: 3, y: 0, part: ['.....kDDDk..', '....kCCCCCk.', '...kCCCCCCck', '...kcccccck.'] },
};
// Reading Glass on a cord (Corin): brass ring with glass, hanging on the chest.
EXTRAS.readingGlass = {
  down: { x: 6, y: 11, part: ['k..k', '.kk.', 'kAAk', 'kAGk', '.kk.'] },
  up: null,
  left: { x: 6, y: 12, part: ['.kk.', 'kAGk', '.kk.'] },
};

// ---------------------------------------------------------------------------
// Rod for the fish pose. The fish frame is 24 wide (ox = -8) so the rod and
// line can reach out past the 16px cell; the figure sits in cols 8..23.
// ---------------------------------------------------------------------------
export const FISH_W = 24, FISH_OX = -8;

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
function place(g, item, dx, dy, behindOnly) {
  if (!item) return;
  (behindOnly ? under : stamp)(g, item.part, item.x + dx, item.y + dy);
}

/**
 * Build the full frame set for a mammal-rig character.
 * def = { head, torso, tail?, legs?, extras?: [EXTRAS.x], headY? }
 * Returns { w, h, down:[4], up:[4], left:[4], right:[4], sit, fish, fishW, fishOx }
 */
export function buildMammal(def) {
  const legs = def.legs || LEGS;
  const { head, torso } = def;
  const tail = def.tail || {};
  const extras = def.extras || [];
  const headY = def.headY ?? 0;
  const legSet = (facing) => legs[facing === 'up' ? 'down' : facing];
  const legPart = (facing, key) => legSet(facing)[key] || legSet(facing)[key.startsWith('run') ? key.slice(3).toLowerCase() : 'idle'] || legSet(facing).idle;

  // draw order: behind-tail, legs, torso, head, front-tail, extras
  function body(g, facing, legKey, bob, torsoKey, dx = 0, headDx = 0) {
    const t = tail[facing];
    const ex = extras.map((e) => e && e[facing]).filter(Boolean);
    const h = head[facing];
    const tor = torso[torsoKey] || torso[facing === 'up' ? 'down' : facing];
    if (t && t.behind) place(g, t, dx, bob, false);
    stamp(g, legPart(facing, legKey), dx, 17);
    stamp(g, tor, dx, 11 + bob);
    if (facing === 'up') { if (t && !t.behind) place(g, t, dx, bob, false); }
    stamp(g, h, 2 + dx + headDx, headY + bob);
    if (facing !== 'up' && t && !t.behind) place(g, t, dx, bob, false);
    for (const e of ex) place(g, e, dx + headDx, bob, false);
    return g;
  }
  const mk = (facing, legKey, bob, torsoKey, headDx = 0) => rows(body(blank(), facing, legKey, bob, torsoKey, 0, headDx));

  function frameSit() {
    const g = blank();
    const t = tail.down;
    const drop = 2;
    if (t && t.behind) place(g, t, 0, drop, false);
    stamp(g, legs.down.sit, 0, 19);
    stamp(g, torso.sit, 0, 11 + drop);
    stamp(g, head.down, 2, headY + drop);
    if (t && !t.behind) place(g, t, 0, drop, false);
    for (const e of extras) if (e && e.down) place(g, e.down, 0, drop, false);
    return rows(g);
  }

  // hand of the fish torso (row 3, cols 3-4) sits at (11, 14) in the 24-wide frame
  // wind-up (phase 1) raises the rod arm to the chin so the arm and rod move together
  function frameFish(phase) {
    const g = blank(FISH_W, 24);
    const wind = phase === 1 && torso.fishWind;
    body(g, 'left', 'idle', 0, wind ? 'fishWind' : 'fish', -FISH_OX);
    drawRod(g, wind ? 11 : 10, wind ? 11 : 13, phase);
    return rows(g);
  }

  // walk: idle, A, idle, B. Arms swing against the legs on every facing.
  const down = [mk('down', 'idle', 0, 'down'), mk('down', 'a', 1, 'downA'), mk('down', 'idle', 0, 'down'), mk('down', 'b', 1, 'downB')];
  const up = [mk('up', 'idle', 0, 'down'), mk('up', 'a', 1, 'downB'), mk('up', 'idle', 0, 'down'), mk('up', 'b', 1, 'downA')];
  const left = [mk('left', 'idle', 0, 'left'), mk('left', 'a', 1, 'leftFwd'), mk('left', 'idle', 0, 'left'), mk('left', 'b', 1, 'leftBack')];
  const right = left.map(flipH);
  // run: stride, pass, stride, pass. Body drops on the strides; the side
  // view leans the head a pixel into the run and pumps bent arms.
  const run = {
    down: [mk('down', 'a', 1, 'downA'), mk('down', 'passA', 0, 'downB'), mk('down', 'b', 1, 'downB'), mk('down', 'passB', 0, 'downA')],
    up: [mk('up', 'a', 1, 'downB'), mk('up', 'passA', 0, 'downA'), mk('up', 'b', 1, 'downA'), mk('up', 'passB', 0, 'downB')],
    left: [mk('left', 'runA', 1, 'runBack', -1), mk('left', 'pass', 0, 'runFwd', -1), mk('left', 'runB', 1, 'runFwd', -1), mk('left', 'pass', 0, 'runBack', -1)],
  };
  run.right = run.left.map(flipH);
  const fishFrames = [0, 1, 2, 3].map(frameFish);
  const out = { w: 16, h: 24, ox: 0, oy: 0, down, up, left, right, run, sit: frameSit(), fish: fishFrames[0], fishFrames, fishW: FISH_W, fishOx: FISH_OX };
  return def.squat ? squatBody(out, def.squat) : out;
}

/**
 * Shorter legs without breaking the 16x24 cell: drop `n` shank rows (frame row
 * 18 down) and push the upper body down by the same amount. The sit frame and
 * the feet rows are untouched, so the figure still stands on row 23.
 */
export function squatBody(b, n = 1) {
  const cut = (f) => { const w = f[0].length; const r = f.slice(); r.splice(18, n); return Array(n).fill('.'.repeat(w)).concat(r); };
  const set = (arr) => arr.map(cut);
  const out = { ...b, down: set(b.down), up: set(b.up), left: set(b.left), right: set(b.right) };
  if (b.run) out.run = Object.fromEntries(Object.entries(b.run).map(([k, v]) => [k, set(v)]));
  if (b.fishFrames) { out.fishFrames = set(b.fishFrames); out.fish = out.fishFrames[0]; }
  return out;
}

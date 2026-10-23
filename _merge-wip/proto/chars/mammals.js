// proto/chars/mammals.js
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
    '.KFMMMMMMfK.',
    '.KfMMNNMMfK.',
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

HEADS.otter = {
  down: [
    '............',
    '..KKKKKKKK..',
    '.KLLFFFFFfK.',
    'KFLFFFFFFfFK',
    'KFFFFFFFFffK',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KMMMMMMMmK.',
    '.KmMMNNMMmK.',
    '.KMmMMMMmMK.',
    '..KKmmmmKK..',
  ],
  left: [
    '............',
    '....KKKKKKK.',
    '...KLLFFFFfK',
    '..KLFFFFFFFK',
    '.KKFFFFFFKfK',
    '.KFWEFFFFFfK',
    'KMMEEFFFFffK',
    'KMMMMFFFFffK',
    'KNMMMMFffffK',
    '.KmMMmffffK.',
    '..KKKKKKKK..',
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
  fish: [
    '.....oxxxxo.....',
    '....oxxxxxxo....',
    '..oxxxxoxxxo....',
    '..ohhxxoxxxo....',
    '...oooxxxxxo....',
    '....oxxxxxxo....',
    '.....oxxxxo.....',
  ],
  sit: [
    '....oxxxxxxo....',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...oxxxxxxxxo...',
    '...ohhxxxxhho...',
    '....oxxxxxxo....',
  ],
};

/**
 * Build a torso set from a fill function. fill(r, c, info) -> letter for an
 * 'x' pixel; info = { shadeCol (true on the right-most interior column), side }.
 */
export function makeTorso(fill, { hand = 'S', outline = 'k' } = {}) {
  const out = {};
  for (const [key, mask] of Object.entries(MASK)) {
    const side = key !== 'down' && key !== 'sit';
    out[key] = mask.map((row, r) => {
      let last = -1;
      for (let c = 0; c < row.length; c++) if (row[c] === 'x') last = c;
      return [...row].map((ch, c) => {
        if (ch === '.') return '.';
        if (ch === 'o') return outline;
        if (ch === 'h') return hand;
        return fill(r, c, { shadeCol: c === last, side, key });
      }).join('');
    });
  }
  out.up = out.down;
  return out;
}

export const TORSOS = {};
// Lighthouse-stripe jumper (player). D navy at collar/hem, C cream between.
TORSOS.jumper = makeTorso((r, c, { shadeCol }) => {
  const navy = r % 2 === 0;
  const base = navy ? 'D' : 'C';
  return shadeCol ? base.toLowerCase() : base;
});
// Co-op canvas overalls over fur (Wren / Ambrose): bib + straps, bare fur arms.
TORSOS.overalls = makeTorso((r, c, { shadeCol, side }) => {
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
TORSOS.jersey = makeTorso((r, c, { shadeCol }) => {
  if (r === 0) return 'D';
  if (r === 1 && c >= 6 && c <= 9) return 'd';
  return shadeCol ? 'c' : 'C';
});
// Short open jacket over a tee (Linnet): C jacket, D tee showing at the centre.
TORSOS.jacket = makeTorso((r, c, { shadeCol, side }) => {
  if (!side && r >= 1 && c >= 7 && c <= 8) return r >= 5 ? 'd' : 'D';
  if (r === 6) return shadeCol ? 'c' : 'C';
  return shadeCol ? 'c' : 'C';
});
// Long reader's coat with a brass clasp (Idris / Corin / Agathe) : C coat, Y clasp, D lapels.
TORSOS.coat = makeTorso((r, c, { shadeCol, side }) => {
  if (!side) {
    if (r <= 1 && (c === 6 || c === 9)) return 'D';
    if (r === 2 && c >= 7 && c <= 8) return 'Y';
    if (r >= 3 && c === 8) return 'c';
  }
  return shadeCol ? 'c' : 'C';
});
// Work vest and rolled sleeves (Teo / route trainers): D vest over C shirt, bare fur forearms.
TORSOS.vest = makeTorso((r, c, { shadeCol, side }) => {
  if (!side) {
    if (c <= 4 || c >= 11) return r >= 3 ? (shadeCol ? 'f' : 'F') : (shadeCol ? 'c' : 'C');
    if (c === 7 || c === 8) return r >= 1 ? 'C' : 'D';
    return shadeCol || c === 10 ? 'd' : 'D';
  }
  if (r >= 3 && r <= 5) return shadeCol ? 'f' : 'F';
  return shadeCol ? 'd' : 'D';
}, { hand: 'F' });

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
    // seated on a step: thighs toward the viewer, boots below
    sit: [
      '....SSS..SSS....',
      '...KSSSKKSSSK...',
      '...KSSsKKSSsK...',
      '...KBBbKKBbbK...',
      '....KKK..KKK....',
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
  // bushy ringed tail curling up beside the (viewer's) right hip to shoulder
  // height; drawn over the arm so it reads chunky inside the 16px cell
  down: { x: 10, y: 9, behind: false, part: [
    '.KKK..',
    'KSSSK.',
    'KTTTK.',
    '.KFFFK',
    '.KTTTK',
    '.KFFfK',
    '.KTTtK',
    '.KFFfK',
    '..KKK.',
  ] },
  up: { x: 0, y: 9, behind: false, part: [
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
  left: { x: 10, y: 9, behind: false, part: [
    '.KKK..',
    'KSSSK.',
    'KTTTK.',
    '.KFFFK',
    '.KTTTK',
    '.KFFfK',
    '.KTTtK',
    '.KFFfK',
    '..KKK.',
  ] },
};
TAILS.otter = {
  // thick tapered tail lying along the ground, out to the right
  down: { x: 9, y: 18, behind: true, part: [
    'KK....',
    'KFFK..',
    '.KFFKK',
    '..KFffK',
    '...KKKK',
  ] },
  up: { x: 1, y: 18, behind: false, part: [
    '....KK',
    '..KFFK',
    'KKFFK.',
    'KffFK.',
    'KKKK..',
  ] },
  left: { x: 9, y: 18, behind: true, part: [
    'KK....',
    'KFFK..',
    '.KFFKK',
    '..KFffK',
    '...KKKK',
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
  up: { x: 6, y: 4, part: ['.KYK', 'KHHK', 'KHHK', '.KHK', '.KK.'] },
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
const ROD = [
  // x, y in the 24-wide frame
  [3, 6], [4, 7], [5, 8], [6, 9], [7, 10], [8, 11], [9, 12], [10, 13],
];
const LINE_X = 2, LINE_Y0 = 7, LINE_Y1 = 20;

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

  function body(g, facing, legKey, bob, torsoKey, dx = 0) {
    const t = tail[facing];
    const ex = extras.map((e) => e && e[facing]).filter(Boolean);
    const h = head[facing];
    const tor = torso[torsoKey];
    // draw order: behind-tail, legs, torso, head, front-tail, extras
    if (t && t.behind) place(g, t, dx, bob, false);
    stamp(g, legs[facing === 'up' ? 'down' : facing][legKey], dx, 17);
    stamp(g, tor, dx, 11 + bob);
    if (facing === 'up') { if (t && !t.behind) place(g, t, dx, bob, false); }
    stamp(g, h, 2 + dx, headY + bob);
    if (facing !== 'up' && t && !t.behind) place(g, t, dx, bob, false);
    for (const e of ex) place(g, e, dx, bob, false);
    return g;
  }

  const frameDown = (legKey, bob) => rows(body(blank(), 'down', legKey, bob, 'down'));
  const frameUp = (legKey, bob) => rows(body(blank(), 'up', legKey, bob, 'up'));
  const frameLeft = (legKey, bob, torsoKey) => rows(body(blank(), 'left', legKey, bob, torsoKey));

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

  function frameFish() {
    const g = blank(FISH_W, 24);
    body(g, 'left', 'idle', 0, 'fish', -FISH_OX);
    for (const [x, y] of ROD) if (g[y][x] === '.') g[y][x] = 'a';
    for (let y = LINE_Y0; y <= LINE_Y1; y++) if (g[y][LINE_X] === '.') g[y][LINE_X] = 'k';
    g[LINE_Y1 + 1][LINE_X] = 'Y'; g[LINE_Y1 + 1][LINE_X + 1] = 'Y';
    return rows(g);
  }

  const down = [frameDown('idle', 0), frameDown('a', 1), frameDown('idle', 0), frameDown('b', 1)];
  const up = [frameUp('idle', 0), frameUp('a', 1), frameUp('idle', 0), frameUp('b', 1)];
  const left = [frameLeft('idle', 0, 'left'), frameLeft('a', 1, 'leftFwd'), frameLeft('idle', 0, 'left'), frameLeft('b', 1, 'leftBack')];
  const right = left.map(flipH);
  return { w: 16, h: 24, down, up, left, right, sit: frameSit(), fish: frameFish(), fishW: FISH_W, fishOx: FISH_OX };
}

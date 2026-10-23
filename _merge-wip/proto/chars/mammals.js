// proto/chars/mammals.js
// Shared two-legged "paper-doll" rig for the anthro townsfolk + player species.
// 16x24 cell, feet on row 23, head centred between cols 7/8. Light from top-left.
// Role letters (palette keys are per character, see palettes.js):
//  K outline   F fur   f fur shade   L fur light   M mask/muzzle light   m mask dark/shade
//  E eye       W glint N nose        P pink        S dark limbs (socks)  B boots
//  C cloth     c cloth shade         D cloth accent d accent shade       T tail alt   t tail alt shade
//  A brass     a brass shade         G glass       X special (amber / glow)   R accent 2   Y accent 3
import { blank, stamp, under, rows, flipH, shift } from './rig.js';

// ---------------------------------------------------------------------------
// HEADS: 12 wide x 11 tall parts, stamped at (2,0). Row 10 is the chin.
// ---------------------------------------------------------------------------
export const HEADS = {};

HEADS.redpanda = {
  down: [
    '.KK......KK.',
    'KMFK....KFMK',
    'KFFFKKKKFFFK',
    '.KLLFFFFFFK.',
    '.KLFFFFFFFK.',
    '.KMFEFFEFMK.',
    '.KMMEMMEMMK.',
    '.KFMMMMMMFK.',
    '.KMMMNNMMMK.',
    '.KfMMMMMMfK.',
    '..KKffffKK..',
  ],
  up: [
    '.KK......KK.',
    'KFFK....KFFK',
    'KFFFKKKKFFFK',
    '.KLLFFFFFFK.',
    '.KLFFFFFFFK.',
    '.KFFFFFFFFK.',
    '.KFFFFFFFfK.',
    '.KFFFFFFffK.',
    '.KfFFFFfffK.',
    '.KffffffffK.',
    '..KKffffKK..',
  ],
  // profile, facing left: snout at left
  left: [
    '........KK..',
    '.......KMFK.',
    '....KKKKFFFK',
    '...KLLFFFFFK',
    '..KLFFFFFFfK',
    '..KMEFFFFFfK',
    '.KMMEFFFFFfK',
    'KMMMMMFFFFfK',
    'KNMMMMFFFffK',
    '.KMMMMffffK.',
    '..KKKfffKK..',
  ],
};

// ---------------------------------------------------------------------------
// TORSOS: 16 wide x 7 tall, stamped at (0,11). Arms included.
// ---------------------------------------------------------------------------
export const TORSOS = {};

// Lighthouse-stripe jumper (player). D = navy band, C = cream band.
TORSOS.jumper = {
  down: [
    '....KDDDDDdK....',
    '...KCCCCCCccK...',
    '...KDDDDDDddK...',
    '...KCCCCCCccK...',
    '...KSDDDDDdSK...',
    '...KFCCCCCcFK...',
    '....KDDDDDdK....',
  ],
  up: [
    '....KDDDDDdK....',
    '...KCCCCCCccK...',
    '...KDDDDDDddK...',
    '...KCCCCCCccK...',
    '...KSDDDDDdSK...',
    '...KFCCCCCcFK...',
    '....KDDDDDdK....',
  ],
  left: [
    '.....KDDDdK.....',
    '....KCCCccK.....',
    '....KDDKDdK.....',
    '....KCCKCcK.....',
    '....KDDSDdK.....',
    '....KCCFCcK.....',
    '.....KDDdK......',
  ],
  // fishing: near arm out to the left holding the rod butt
  fish: [
    '.....KDDDdK.....',
    '....KCCCccK.....',
    '...KKDDKDdK.....',
    '..KSSCCKCcK.....',
    '..KFKDDDDdK.....',
    '...KKCCCCcK.....',
    '.....KDDdK......',
  ],
  // sitting on a step: torso same, hands on knees
  sit: [
    '....KDDDDDdK....',
    '...KCCCCCCccK...',
    '...KDDDDDDddK...',
    '...KCCCCCCccK...',
    '...KSDDDDDdSK...',
    '...KFCCCCCcFK...',
    '....KDDDDDdK....',
  ],
};

// ---------------------------------------------------------------------------
// LEGS: 16 wide x 6 tall, stamped at (0,18). S = dark socks, B = boots.
// ---------------------------------------------------------------------------
export const LEGS = {
  down: {
    idle: [
      '....KSSKKSSK....',
      '....KSSKKSSK....',
      '....KSSKKSsK....',
      '....KBBKKBbK....',
      '...KBBBKKBBbK...',
      '....KKK..KKK....',
    ],
    // viewer-left leg forward (planted), right leg lifted
    a: [
      '....KSSKKSSK....',
      '....KSSKKSSK....',
      '....KSSKKBbK....',
      '....KBBKKBbK....',
      '...KBBBK.KKK....',
      '....KKK.........',
    ],
    b: [
      '....KSSKKSSK....',
      '....KSSKKSSK....',
      '....KBBKKSsK....',
      '....KBBKKBbK....',
      '....KKK.KBBbK...',
      '.........KKK....',
    ],
    // sitting: legs fold forward, boots toward the viewer
    sit: [
      '...KSSSKKSSSK...',
      '...KBBBKKBBbK...',
      '...KKKKKKKKKK...',
    ],
  },
  left: {
    idle: [
      '......KSSSK.....',
      '......KSSsK.....',
      '......KSSsK.....',
      '......KBBbK.....',
      '....KKBBBbK.....',
      '.....KKKKK......',
    ],
    // near leg forward, far leg back
    a: [
      '......KSSSK.....',
      '.....KSSKSsK....',
      '....KSSK.KsK....',
      '....KBBK.KbK....',
      '..KKBBBK.KKK....',
      '...KKKKK........',
    ],
    b: [
      '......KSSSK.....',
      '.....KSsKSSK....',
      '....KSsK.KSK....',
      '....KBbK.KBK....',
      '....KKK.KBBbK...',
      '........KKKK....',
    ],
  },
};

// ---------------------------------------------------------------------------
// TAILS: free-size parts with an anchor (x,y) per facing.
// ---------------------------------------------------------------------------
export const TAILS = {};
TAILS.redpanda = {
  // bushy ringed tail curling up behind the right hip to shoulder height
  down: { x: 10, y: 9, part: [
    '....KK',
    '...KTTK',
    '..KFFFK',
    '..KTTTK',
    '.KFFFK.',
    '.KTTTK.',
    '.KFFfK.',
    '.KSSSK.',
    '..KKK..',
  ], behind: true },
  up: { x: 9, y: 9, part: [
    '...KKK.',
    '..KFFFK',
    '..KTTTK',
    '..KFFFK',
    '..KTTTK',
    '.KFFFK.',
    '.KTTTK.',
    '.KSSfK.',
    '..KKK..',
  ], behind: false },
  left: { x: 9, y: 9, part: [
    '....KK.',
    '...KTTK',
    '..KFFFK',
    '..KTTTK',
    '..KFFFK',
    '.KTTTK.',
    '.KFFfK.',
    '.KSSfK.',
    '.KKKK..',
  ], behind: true },
};

// ---------------------------------------------------------------------------
// Rod for the fish pose (left facing). Drawn last.
// ---------------------------------------------------------------------------
const ROD = { x: 0, y: 3, part: [
  'a...............',
  '.a..............',
  '..a.............',
  '..Ka............',
  '..K.a...........',
  '..K..a..........',
  '..K...a.........',
  '..K....a........',
  '..K.....a.......',
  '..K......a......',
  '..K.......a.....',
  '..K.............',
  '..K.............',
  '..K.............',
  '..K.............',
  'KK..............',
] };

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
function layer(g, tail, dyTail = 0) {
  if (tail) stamp(g, tail.part, tail.x, tail.y + dyTail);
}

/**
 * Build the full frame set for a mammal-rig character.
 * def = { head: HEADS.x, torso: TORSOS.x, tail: TAILS.x|null, legs?: LEGS }
 * Returns { down:[4], up:[4], left:[4], right:[4], sit, fish }
 */
export function buildMammal(def) {
  const legs = def.legs || LEGS;
  const head = def.head, torso = def.torso, tail = def.tail || {};
  const headY = def.headY ?? 0;

  function frameDown(legKey, tailSwing) {
    const g = blank();
    const t = tail.down;
    if (t && t.behind) layer(g, { ...t, x: t.x + tailSwing }, 0);
    stamp(g, legs.down[legKey], 0, 18);
    stamp(g, torso.down, 0, 11);
    stamp(g, head.down, 2, headY);
    if (t && !t.behind) layer(g, { ...t, x: t.x + tailSwing }, 0);
    return rows(g);
  }
  function frameUp(legKey, tailSwing) {
    const g = blank();
    const t = tail.up;
    stamp(g, legs.down[legKey], 0, 18);
    stamp(g, torso.up, 0, 11);
    if (t) layer(g, { ...t, x: t.x + tailSwing }, 0);
    stamp(g, head.up, 2, headY);
    return rows(g);
  }
  function frameLeft(legKey, tailSwing, pose) {
    const g = blank();
    const t = tail.left;
    if (t) layer(g, { ...t, x: t.x + tailSwing }, 0);
    stamp(g, legs.left[legKey], 0, 18);
    stamp(g, pose === 'fish' ? torso.fish : torso.left, 0, 11);
    stamp(g, head.left, 2, headY);
    if (pose === 'fish') stamp(g, ROD.part, ROD.x, ROD.y);
    return rows(g);
  }
  function frameSit() {
    const g = blank();
    const t = tail.down;
    // seated: everything drops 3 rows, legs fold forward
    if (t && t.behind) layer(g, t, 3);
    stamp(g, legs.down.sit, 0, 21);
    stamp(g, torso.sit || torso.down, 0, 14);
    stamp(g, head.down, 2, headY + 3);
    if (t && !t.behind) layer(g, t, 3);
    return rows(g);
  }

  const down = [frameDown('idle', 0), frameDown('a', -1), frameDown('idle', 0), frameDown('b', 1)];
  const up = [frameUp('idle', 0), frameUp('a', 1), frameUp('idle', 0), frameUp('b', -1)];
  const left = [frameLeft('idle', 0), frameLeft('a', 1), frameLeft('idle', 0), frameLeft('b', 0)];
  const right = left.map(flipH);
  return { w: 16, h: 24, down, up, left, right, sit: frameSit(), fish: frameLeft('idle', 0, 'fish') };
}

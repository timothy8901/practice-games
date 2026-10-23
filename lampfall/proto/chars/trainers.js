// proto/chars/trainers.js
// Wildshift people on the shared rig: Corin Vale (barn owl) and the generic
// trainer body (pointed-ear head) that Idris, Agathe, Teo and the route
// trainers share through palette swaps. Same 12x11 head format as mammals.js.
import { HEADS, TORSOS, TAILS, LEGS, BIRDLEGS, EXTRAS, buildMammal, backHead } from './mammals.js';
import './heads2.js';

// Barn owl: heart-shaped white facial disc, tawny crown, big dark eyes, small pale beak.
HEADS.owl = {
  down: [
    '............',
    '...KKKKKK...',
    '..KFFLLFFK..',
    '.KFMMFFMMFK.',
    '.KMMMFFMMMK.',
    '.KMWEMMWEMK.',
    '.KMEEMMEEMK.',
    '.KMMMNMMMMK.',
    '.KmMMMMMMmK.',
    '..KmMMMMmK..',
    '...KKmmKK...',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '...KFFLLFFK.',
    '..KMMFFFFFfK',
    '.KMMMMFFFFfK',
    '.KMWEMMFFFfK',
    '.KMEEMMFFffK',
    '.KNMMMMFfffK',
    '.KmMMMMffffK',
    '..KmMMmfffK.',
    '...KKKKKKK..',
  ],
};
HEADS.owl.up = backHead(HEADS.owl.down, { earRows: 0 });

// Generic trainer: pointed ears with pink inners, fox/cat-like muzzle.
HEADS.trainer = {
  down: [
    '.K........K.',
    'KPK......KPK',
    'KFPK....KPFK',
    'KFFFKKKKFFFK',
    '.KLLFFFFFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KFMMMMMMfK.',
    '.KmMMNNMMmK.',
    '..KKmMMmKK..',
  ],
  left: [
    '....K...K...',
    '...KPK.KPK..',
    '...KFPKKPFK.',
    '...KFFFFFFFK',
    '..KLLFFFFFfK',
    '..KLFFFFFFfK',
    '..KFWEFFFFfK',
    '.KKFEEFFFFfK',
    'KMMMFFFFFffK',
    'KNMMMMFFfffK',
    '.KKKKffffKK.',
  ],
};
HEADS.trainer.up = backHead(HEADS.trainer.down, { earRows: 3 });

// Agathe's mourning band: a dark band on the (viewer's) left sleeve.
EXTRAS.armband = {
  down: { x: 3, y: 13, part: ['kk', 'kk'] },
  up: { x: 11, y: 13, part: ['kk', 'kk'] },
  left: { x: 8, y: 13, part: ['kk'] },
};
// Teo's goggles pushed up on the forehead (brass rims, ice glass).
EXTRAS.goggles = {
  down: { x: 4, y: 3, part: ['AGGAAGGA'] },
  up: { x: 4, y: 3, part: ['kAAAAAAk'] },
  left: { x: 5, y: 3, part: ['AGGAAk'] },
};

// Tails for the leads: wolf (thick, low, dark tip), hare (cotton puff),
// fox (big brush, white tip).
TAILS.wolf = {
  down: { x: 10, y: 15, behind: true, part: ['KK...', 'KFFK.', 'KFFfK', '.KFfK', '.KSfK', '..KK.'] },
  up: { x: 1, y: 15, behind: false, part: ['...KK', '.KFFK', 'KFFfK', 'KFFfK', 'KSSK.', '.KK..'] },
  left: { x: 10, y: 15, behind: true, part: ['KK...', 'KFFK.', 'KFFfK', '.KFfK', '.KSfK', '..KK.'] },
};
TAILS.hare = {
  down: null,
  up: { x: 6, y: 16, behind: false, part: ['.KK.', 'KMMK', 'KmMK', '.KK.'] },
  left: { x: 11, y: 16, behind: true, part: ['KK.', 'KMK', 'KmK', 'KK.'] },
};
TAILS.fox = {
  down: { x: 10, y: 13, behind: true, part: ['.KK...', 'KFFK..', 'KFFFK.', 'KFFFfK', '.KFFfK', '.KMMMK', '..KKK.'] },
  up: { x: 0, y: 13, behind: false, part: ['...KK.', '..KFFK', '.KFFFK', 'KFFFfK', 'KFFfK.', 'KMMMK.', '.KKK..'] },
  left: { x: 10, y: 13, behind: true, part: ['.KK...', 'KFFK..', 'KFFFK.', 'KFFFfK', '.KFFfK', '.KMMMK', '..KKK.'] },
};

export function buildTrainerBodies() {
  return {
    corin: buildMammal({ head: HEADS.owl, torso: TORSOS.coat, legs: BIRDLEGS, extras: [EXTRAS.readingGlass] }),
    trainerCoat: buildMammal({ head: HEADS.trainer, torso: TORSOS.coat, legs: LEGS }),
    trainerVest: buildMammal({ head: HEADS.trainer, torso: TORSOS.vest, legs: LEGS }),
    // the three Wildshift leads get their own heads (heads2.js)
    idris: buildMammal({ head: HEADS.wolf, torso: TORSOS.coat, legs: LEGS, tail: TAILS.wolf }),
    agathe: buildMammal({ head: HEADS.hare, torso: TORSOS.coat, legs: LEGS, tail: TAILS.hare, extras: [EXTRAS.armband] }),
    teo: buildMammal({ head: HEADS.fox, torso: TORSOS.vest, legs: LEGS, tail: TAILS.fox, extras: [EXTRAS.goggles] }),
  };
}

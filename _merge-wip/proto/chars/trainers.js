// proto/chars/trainers.js
// Wildshift people on the shared rig: Corin Vale (barn owl) and the generic
// trainer body (pointed-ear head) that Idris, Agathe, Teo and the route
// trainers share through palette swaps. Same 12x11 head format as mammals.js.
import { HEADS, TORSOS, LEGS, BIRDLEGS, EXTRAS, buildMammal, backHead } from './mammals.js';

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

export function buildTrainerBodies() {
  return {
    corin: buildMammal({ head: HEADS.owl, torso: TORSOS.coat, legs: BIRDLEGS, extras: [EXTRAS.readingGlass] }),
    trainerCoat: buildMammal({ head: HEADS.trainer, torso: TORSOS.coat, legs: LEGS }),
    trainerCoatBand: buildMammal({ head: HEADS.trainer, torso: TORSOS.coat, legs: LEGS, extras: [EXTRAS.armband] }),
    trainerVest: buildMammal({ head: HEADS.trainer, torso: TORSOS.vest, legs: LEGS }),
    trainerVestGoggles: buildMammal({ head: HEADS.trainer, torso: TORSOS.vest, legs: LEGS, extras: [EXTRAS.goggles] }),
  };
}

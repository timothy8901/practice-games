// proto/chars/heads2.js
// Distinct heads for the Wildshift leads who used to share the generic
// trainer head and differ only by palette. Same 12x11 format as mammals.js
// (stamped at (2,0); row 10 is the chin). Backs are drawn in backs.js.
import { HEADS } from './mammals.js';

// Idris Fenwake, Champion: grey wolf. Wide-set tall ears, a heavy level brow
// over narrow eyes, white cheek ruff, long muzzle in profile.
HEADS.wolf = {
  down: [
    '..K......K..',
    '.KfK....KfK.',
    '.KPFK..KFPK.',
    'KFPFFKKFFPfK',
    'KLLFFFFFFFfK',
    'KLKKFFFFKKfK',
    'KFWEFFFFWEfK',
    'KMFFFMMFFFMK',
    'KMMFMNNMFMMK',
    '.KMMMMMMMmK.',
    '..KKMmmmKK..',
  ],
  left: [
    '.....K...K..',
    '....KfK.KfK.',
    '....KPFKFPfK',
    '...KFFFFFFfK',
    '..KLLFFFFFfK',
    '.KLKKFFFFFfK',
    'KKFWEFFFFffK',
    'NMMFFFFFFffK',
    'KMMMMMFFfffK',
    '.KKKMMMMMmK.',
    '....KKKKKK..',
  ],
};

// Provost Agathe Merrow: hare with long ears laid down either side of a
// narrow, unsmiling face, like a magistrate's wig.
HEADS.hare = {
  down: [
    '...KKKKKK...',
    '..KLLFFFfK..',
    '.KLLFFFFFfK.',
    'KFKFFFFFFKfK',
    'KFKWEFFWEKfK',
    'KFKEEFFEEKfK',
    'KFKFMMMMfKfK',
    'KfKMMNNMMKfK',
    'KfKmMMMMmKfK',
    'KffKKmmKKffK',
    '.KK......KK.',
  ],
  left: [
    '....KKKKK...',
    '...KLLFFFK..',
    '..KLFFFFFFK.',
    '.KLFFFFFKKfK',
    '.KFWEFFKFFfK',
    'KMFEEFFKFFfK',
    'NMMFFFFKFffK',
    'KMMMFFFKFffK',
    '.KMMMFfKffK.',
    '..KKKKKKfK..',
    '.......KK...',
  ],
};

// Teo Varga of the Scatter: red fox, all ears and cheek tufts; a showman's
// silhouette that flares wider than anyone else's at the jaw.
HEADS.fox = {
  down: [
    'KK........KK',
    'KPK......KPK',
    'KPPK....KPfK',
    'KFFFKKKKFFfK',
    '.KLLFFFFFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    'KMFEEFFEEfMK',
    'KMMMMFFMMMMK',
    '.KKMMNNMMKK.',
    '...KKMMKK...',
  ],
  left: [
    '...KK...KK..',
    '...KPK.KPfK.',
    '...KPPKKPffK',
    '...KFFFFFFfK',
    '..KLLFFFFFfK',
    '..KLFFFFFFfK',
    '.KKFWEFFFFfK',
    'KMMFEEFFFffK',
    'NMMMMMFFffMK',
    '.KKKMMMMMMK.',
    '....KKKKKK..',
  ],
};

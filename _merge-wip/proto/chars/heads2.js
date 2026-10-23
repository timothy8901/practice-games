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

// Provost Agathe Merrow: hare. Tall upright ears with black tips over a
// small, wide-eyed, unsmiling face (split lip).
HEADS.hare = {
  down: [
    '..KK....KK..',
    '.KSPK..KPSK.',
    '.KFPK..KPfK.',
    '.KFPK..KPfK.',
    '..KFKKKKfK..',
    '.KLLFFFFFfK.',
    'KLFWEFFWEffK',
    'KFFEEFFEEffK',
    'KMMFMNNMFMMK',
    '.KMMMKKMMmK.',
    '..KKmmmmKK..',
  ],
  left: [
    '.....KK.KK..',
    '....KSPKSfK.',
    '....KFPKFfK.',
    '.....KFPKFfK',
    '....KKKFfKK.',
    '...KLLFFFFK.',
    '..KLWEFFFFfK',
    '.KFFEEFFFffK',
    'KMMFFFFFfffK',
    'NMMMMFFffffK',
    '.KKmmKKKKKK.',
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

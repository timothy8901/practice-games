// js/art/chars/heads.js  [ART-CHARS]
// Species heads, tails and props for the GDD-00 §10 cast that the prototype
// did not draw (or drew as the wrong species). Same 12x11 head format as
// mammals.js (stamped at (2,0); row 10 is the chin; light from the top-left).
// 'up' (back of head) views are finished in backs.js.
//
// Mammals: wombat (Tully), rock hyrax (Bryony), bilby (Thessaly), grey seal
// (Augusta), water rat / rakali (Pip), raccoon (Teo), kinkajou (Dov), mink
// (Bastien), lynx (Cass), arctic fox (Seraphine), mountain goat (Hollis),
// tortoise (Osric), crested newt (Ines), plus the generic route trainer.
// Birds on the rig: tawny owl (Corin), great northern diver (Idris),
// cormorant (Agathe), greylag goose (Maud), great crested grebe (Wendel),
// jackdaw (Ada & Ivo), storm petrel (Isolde). Bird wings are the torso's
// hands, drawn in T (wing feather) so the feet keep S.
import { HEADS, TAILS, EXTRAS } from './mammals.js';

// ---------------------------------------------------------------------------
// MAMMALS
// ---------------------------------------------------------------------------

// Tully, wombat: a broad flat block of a head, tiny ears, little eyes, the
// big leathery nose (N) and his sweatband (C) for the morning laps.
HEADS.wombat = {
  down: [
    '..KK....KK..',
    '.KFfK..KFfK.',
    '.KFFKKKKFfK.',
    'KLLFFFFFFFfK',
    'KCCCCCCCCCcK',
    'KFFFFFFFFFfK',
    'KFWEFFFFWEfK',
    'KFEEFFFFEEfK',
    'KFFfNNNNfFfK',
    '.KfMNNNNMfK.',
    '..KKmMMmKK..',
  ],
  left: [
    '.......KK...',
    '......KFfK..',
    '....KKKFfK..',
    '...KLLFFFfK.',
    '..KCCCCCCCcK',
    '.KLFFFFFFFfK',
    '.KFWEFFFFFfK',
    'KKFEEFFFFffK',
    'NNNFFFFFfffK',
    'NNNMMFFffffK',
    '.KKKKKKKKKK.',
  ],
};

// Bryony, rock hyrax: round head, small round ears tight to the skull, a
// pale brow patch over each eye, short blunt snout. (Sun hat is an extra.)
HEADS.hyrax = {
  down: [
    '............',
    '..KK....KK..',
    '.KFmK..KmFK.',
    '.KFFKKKKFfK.',
    'KLLFFFFFFFfK',
    'KLMMFFFFMMfK',
    'KFWEFFFFWEfK',
    'KFEEFFFFEEfK',
    '.KFFFMMFFfK.',
    '.KfFMNNMffK.',
    '..KKKmmKKK..',
  ],
  left: [
    '............',
    '.......KK...',
    '......KmFK..',
    '....KKKFFK..',
    '...KLLFFFFK.',
    '..KMMFFFFFfK',
    '.KFWEFFFFFfK',
    '.KFEEFFFFffK',
    'KMMFFFFFfffK',
    'NMMMFFFffffK',
    '.KKKKKKKKKK.',
  ],
};

// Thessaly, bilby: very long pink-lined ears, blue-grey coat, pale face and a
// long pointed snout ending in a pink nose.
HEADS.bilby = {
  down: [
    '.KK......KK.',
    'KFPK....KPFK',
    'KFPK....KPFK',
    'KFPFK..KFPfK',
    '.KFFKKKKFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KMEEMMEEmK.',
    '..KMMMMMmK..',
    '...KMMMmK...',
    '....KPPK....',
  ],
  left: [
    '......KK.KK.',
    '.....KPFKFfK',
    '.....KPFKFfK',
    '....KPFKFfK.',
    '...KKFFFfK..',
    '..KLFFFFFfK.',
    '.KLWEFFFFfK.',
    'KMMEEFFFFffK',
    'PMMMMFFFfffK',
    '.KKMMmffffK.',
    '...KKKKKKK..',
  ],
};

// Augusta Skerry, grey seal: smooth domed head, no ears, big dark eyes, the
// long "Roman" muzzle with whisker pores, grey with darker mottles (R).
HEADS.seal = {
  down: [
    '............',
    '...KKKKKK...',
    '..KLLFFFFK..',
    '.KLFFFFFRfK.',
    '.KFFFFFFFfK.',
    'KFWEEFFWEEfK',
    'KFEEEFFEEEfK',
    'KFfMMMMMMffK',
    '.KMmMNNMmMK.',
    '.KMMmMMmMmK.',
    '..KKmmmmKK..',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '...KLLFFFFK.',
    '..KLFFFRFFfK',
    '..KFFFFFFRfK',
    '.KFWEEFFFFfK',
    '.KFEEEFFFffK',
    'KMMMFFFFfffK',
    'NmMmMFFRfffK',
    'KMMMmffffffK',
    '.KKKKKKKKKK.',
  ],
};

// Pip, water rat (rakali): dark brown, small round ears, longer muzzle than
// the vole, a golden throat; the white tail tip is his tell (tail below).
HEADS.waterRat = {
  down: [
    '............',
    '..KK....KK..',
    '.KFPK..KPFK.',
    '.KFFKKKKFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '..KFFFFFfK..',
    '..KFMMMMfK..',
    '...KMNNmK...',
    '....KKKK....',
  ],
  left: [
    '............',
    '........KK..',
    '.......KPFK.',
    '....KKKKFFK.',
    '...KLFFFFFfK',
    '..KLWEFFFFfK',
    '.KFFEEFFFffK',
    'KFFFFFFFfffK',
    'NMMMMFFffffK',
    '.KKMMMffffK.',
    '...KKKKKKK..',
  ],
};

// Teo Varga, raccoon: grey with the black bandit mask (R), white brows and
// muzzle, pointed ears with pale rims. (Goggles are an extra.)
HEADS.raccoon = {
  down: [
    '.KK......KK.',
    'KMFK....KFMK',
    'KFFFKKKKFFfK',
    '.KLLFFFFFfK.',
    '.KMMMFFMMMK.',
    '.KRWERRWERK.',
    'KRREERREERRK',
    '.KMMMMMMMmK.',
    '.KMMMNNMMmK.',
    '..KMmMMmMK..',
    '...KKKKKK...',
  ],
  left: [
    '....KK..KK..',
    '...KMFKKFMK.',
    '...KFFFFFFfK',
    '..KLLFFFFFfK',
    '..KMMMMFFFfK',
    '.KRWERRFFFfK',
    'KRREERRRFffK',
    'KMMMMMFFfffK',
    'NMMMMMMFffK.',
    '.KKmMMMffK..',
    '...KKKKKK...',
  ],
};

// Dov Lattimer, kinkajou: round golden head, small round ears set low and
// wide, huge night eyes, short muzzle.
HEADS.kinkajou = {
  down: [
    '............',
    '...KKKKKK...',
    'KKKLLFFFFKKK',
    'KPFLFFFFFFPK',
    'KKFFFFFFFFKK',
    '.KFWEEFWEEK.',
    '.KFEEEFEEEK.',
    '.KFFFMMFFfK.',
    '..KFMNNMfK..',
    '...KMMmmK...',
    '....KKKK....',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '...KLLFFFFKK',
    '..KLFFFFFFPK',
    '..KFFFFFFFKK',
    '.KFWEEFFFFfK',
    '.KFEEEFFFffK',
    'KMMFFFFFfffK',
    'NMMMFFFffffK',
    '.KKmMffffKK.',
    '...KKKKKK...',
  ],
};

// Bastien Kell, mink: sleek dark chocolate, small round ears, a white chin
// spot (M) and nothing else to soften him.
HEADS.mink = {
  down: [
    '............',
    '..KK....KK..',
    '.KFfK..KfFK.',
    '.KFFKKKKFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KFFFNNFFfK.',
    '..KFFFFFfK..',
    '...KFMMfK...',
    '....KMMK....',
  ],
  left: [
    '............',
    '........KK..',
    '.......KfFK.',
    '....KKKKFFK.',
    '...KLFFFFFfK',
    '..KLWEFFFFfK',
    '.KFFEEFFFffK',
    'KFFFFFFFfffK',
    'NFFFFFFffffK',
    '.KKMMfffffK.',
    '...KMKKKKK..',
  ],
};

// Cass Rune, lynx: tall ears with black tufts (R), a flared facial ruff with
// dark bars, short broad muzzle, pale chin.
HEADS.lynx = {
  down: [
    '.R........R.',
    '.RK......KR.',
    'KFPK....KPfK',
    'KFFFKKKKFFfK',
    '.KLLFFFFFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    'KMFEEFFEEfMK',
    'KMRFMNNMFRmK',
    'KMMMMMMMMMmK',
    '.KKKMmmMKKK.',
  ],
  left: [
    '.....R...R..',
    '.....RK..RK.',
    '....KPFKKPfK',
    '...KFFFFFFfK',
    '..KLLFFFFFfK',
    '..KLFFFFFFfK',
    '.KKWEFFFFFfK',
    'KMFEEFFFFRmK',
    'NMMMMFFFRMmK',
    '.KMMMMMMMmK.',
    '..KKKKKKKK..',
  ],
};

// Seraphine Locke, arctic fox: cream-white winter coat (never pure white),
// small rounded ears, a short muzzle and fluffed cheeks, dark eyes and nose.
HEADS.arcticFox = {
  down: [
    '............',
    '.KK......KK.',
    'KFfK....KfFK',
    'KFFFKKKKFFfK',
    '.KLLFFFFFfK.',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    'KFFEEFFEEffK',
    'KfFFFNNFFffK',
    '.KfFFFFFffK.',
    '..KKffffKK..',
  ],
  left: [
    '............',
    '....KK..KK..',
    '...KFfKKfFK.',
    '...KFFFFFFfK',
    '..KLLFFFFFfK',
    '..KLFFFFFFfK',
    '.KKWEFFFFFfK',
    'KFFEEFFFFffK',
    'NFFFFFFFfffK',
    '.KfFFFFfffK.',
    '..KKKKKKKK..',
  ],
};

// Hollis Brandt, mountain goat: shaggy white, short black horns (R) curving back,
// ears out to the sides, a long face and a beard.
HEADS.goat = {
  down: [
    '..R......R..',
    '..RK....KR..',
    '.KRK....KRK.',
    'KFKFKKKKFKfK',
    '.KLFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '..KFFFFFfK..',
    '..KFFNNFfK..',
    '..KMFFFFmK..',
    '...KMMMmK...',
  ],
  left: [
    '.......RR...',
    '......RKRR..',
    '.....KR.KR..',
    '....KKKKFKK.',
    '...KLFFFFFfK',
    '..KLWEFFFFfK',
    '.KFFEEFFFffK',
    'KFFFFFFFfffK',
    'NFFFFFFffffK',
    '.KMMfffffKK.',
    '..KMMKKKK...',
  ],
};

// Osric Penhallow, tortoise: a bald olive dome, small hooded eyes, nostrils,
// a horn-coloured beak (M) and a wrinkled neck.
HEADS.tortoise = {
  down: [
    '............',
    '............',
    '...KKKKKK...',
    '..KLLFFFFK..',
    '.KLFFFFFFfK.',
    '.KfWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KFFFFFFFfK.',
    '.KfFNFFNFfK.',
    '..KMMMMMmK..',
    '...KfFFfK...',
  ],
  left: [
    '............',
    '............',
    '...KKKKKK...',
    '..KLLFFFFK..',
    '.KLFFFFFFfK.',
    '.KWEFFFFFfK.',
    'KFEEFFFFffK.',
    'KNFFFFFfffK.',
    'KMMFFFFffK..',
    '.KMmKfFfFK..',
    '..KK.KfFfK..',
  ],
};

// Ines Calloway, crested newt: a flat, wide head, eyes set high, the dark
// warty skin flecked darker (R), and the orange-yellow throat (M) with black
// spots. (Her spa towel turban is an extra.)
HEADS.newt = {
  down: [
    '............',
    '............',
    '...KKKKKK...',
    '.KKLLFFFFKK.',
    'KLFFFFFFFFfK',
    'KWWEFFFFEWWK',
    'KWEEFFFFEEWK',
    'KFFFRFFRFFfK',
    '.KfffffffffK',
    '.KMMRMMRMMK.',
    '..KKMMMMKK..',
  ],
  left: [
    '............',
    '............',
    '...KKKKKK...',
    '..KLLFFFFKK.',
    '.KLFFFRFFFfK',
    '.KWWEFFFFRfK',
    'KWEEFFFFFffK',
    'KFFFFRFFfffK',
    'KfffffffffK.',
    '.KMRMMMRMK..',
    '..KKKKKKK...',
  ],
};

// Route trainers: pointed ears with pink inners, fox/cat-like muzzle; palette
// swaps make the crowd.
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

// ---------------------------------------------------------------------------
// BIRDS (beak N / n, eye ring and iris letters per species)
// ---------------------------------------------------------------------------

// Corin Vale, tawny owl: round, no ear tufts, rufous crown with pale mottles
// (L), a buff facial disc (M) with a darker rim (m), big black eyes, a pale
// horn beak (N). His failing left eye is clouded on the portrait.
HEADS.tawnyOwl = {
  down: [
    '............',
    '...KKKKKK...',
    '..KFLFFLFK..',
    '.KFLFfFLFfK.',
    '.KmMMmmMMmK.',
    '.KMWEMMWEMK.',
    '.KMEEMMEEMK.',
    '.KmMMNNMMmK.',
    '.KFmMNNMmfK.',
    '..KFfmmfFK..',
    '...KKKKKK...',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '...KFLFFLFK.',
    '..KFLFfFLFfK',
    '.KmMMmFFfFfK',
    '.KMWEMmFLFfK',
    '.KMEEMmFFffK',
    'KNMMMmFfFffK',
    '.KNMmFFfFffK',
    '..KmFfFffK..',
    '...KKKKKK...',
  ],
};

// Idris Fenwake, great northern diver: glossy black-green head (F/L), the
// red eye (R with a W glint), a dagger bill (N) and the white-barred necklace
// (M) at the throat.
HEADS.diver = {
  down: [
    '............',
    '...KKKKKK...',
    '..KLLFFFFK..',
    '.KLFFFFFFfK.',
    '.KFFFFFFFfK.',
    '.KFWRFFWRfK.',
    '.KFFFFFFFfK.',
    '.KfFFNNFFfK.',
    '..KfFNNffK..',
    '...KFNNfK...',
    '....KNNK....',
  ],
  left: [
    '............',
    '....KKKKK...',
    '...KLLFFFK..',
    '..KLFFFFFfK.',
    '..KFFFFFFfK.',
    '.KFWRFFFFfK.',
    'KKFFFFFFFffK',
    'NNNNFFFFfffK',
    '.KKKFFFFfffK',
    '....KMFMffK.',
    '.....KKKKK..',
  ],
};

// Agathe Merrow, cormorant: bronze-black (F/L), a stiff tuft at the back of
// the crown, emerald eye (G), yellow gular skin (Y) at the base of the long
// hooked bill (N), a white cheek patch (M).
HEADS.cormorant = {
  down: [
    '.......KK...',
    '...KKKKFK...',
    '..KLLFFFFK..',
    '.KLFFFFFFfK.',
    '.KFFFFFFFfK.',
    '.KFGEFFGEfK.',
    '.KMMYNNYMmK.',
    '..KMYNNYmK..',
    '...KFNNfK...',
    '....KNNK....',
    '....KnnK....',
  ],
  left: [
    '.........KK.',
    '.....KKKKFK.',
    '....KLLFFFK.',
    '...KLFFFFFfK',
    '..KFFFFFFFfK',
    '..KFGEFFFFfK',
    '.KYYMMFFFffK',
    'NNNNYMFFfffK',
    'nKKKKMFffffK',
    '....KFFfffK.',
    '.....KKKKK..',
  ],
};

// Maud Tallis, greylag goose: grey-brown with pale feather edging, dark eye,
// a broad orange bill (N / n) with a pale nail (W). (Sou'wester is an extra.)
HEADS.goose = {
  down: [
    '............',
    '...KKKKKK...',
    '..KLLFFFFK..',
    '.KLFFFFFFfK.',
    '.KFFFFFFFfK.',
    '.KFWEFFWEfK.',
    '.KFEEFFEEfK.',
    '.KFFNNNNFfK.',
    '..KFNNNNfK..',
    '..KfNnnNfK..',
    '...KKWWKK...',
  ],
  left: [
    '............',
    '....KKKKK...',
    '...KLLFFFK..',
    '..KLFFFFFfK.',
    '..KFFFFFFfK.',
    '.KFWEFFFFfK.',
    'KKFEEFFFFffK',
    'NNNNFFFFfffK',
    'WnnnKFFFfffK',
    '.KKKKFFffK..',
    '....KKKKK...',
  ],
};

// Wendel Teague, great crested grebe: black double crest (S), white face (M),
// red eye, the chestnut ruff (R) edged black flaring past the jaw, a pink
// dagger bill (N).
HEADS.grebe = {
  down: [
    '.SS......SS.',
    '..SK....KS..',
    '..KSKKKKSK..',
    '.KSSFFFFSSK.',
    '.KMMMMMMMMK.',
    '.KMWRMMWRMK.',
    'RKMRRMMRRMKR',
    'RRKMMNNMMKRR',
    'RRRKMNNMKRRR',
    '.RRSKNNKSRR.',
    '..SSKKKKSS..',
  ],
  left: [
    '......SS.SS.',
    '.....SK.SK..',
    '....KSKKSK..',
    '...KSSFFSSK.',
    '..KMMMMFSSfK',
    '..KWRMMMFSfK',
    '.KMRRMMMRRRK',
    'NNNMMMMRRRRR',
    '.KKKMMRRRRRR',
    '...KMSRRRSR.',
    '....KKSSSS..',
  ],
};

// Ada & Ivo Halloran, jackdaws: black with the grey hood (R) at the nape and
// cheeks, the pale silver eye (W iris, E pupil), a short stout bill (N).
HEADS.jackdaw = {
  down: [
    '............',
    '...KKKKKK...',
    '..KLFFFFFK..',
    '.KLFFFFFFfK.',
    '.KRFFFFFFRK.',
    '.KRWEFFEWRK.',
    '.KRWWFFWWRK.',
    '.KRFFNNFFRK.',
    '..KRFNNFRK..',
    '...KRNNRK...',
    '....KKKK....',
  ],
  left: [
    '............',
    '....KKKKKK..',
    '...KLFFFFFK.',
    '..KLFFFFFRfK',
    '..KFFFFFRRfK',
    '.KFWEFFRRRfK',
    'KKFWWFRRRRfK',
    'NNNFFFRRRRfK',
    '.KKKFRRRRRK.',
    '...KRRRRRK..',
    '....KKKKK...',
  ],
};

// Isolde Petrel, storm petrel: small, sooty (F/f), the tube-nosed hooked
// bill (N), the white rump (tail), and the round brass reading spectacles
// (A) she writes the letters in.
HEADS.petrel = {
  down: [
    '............',
    '............',
    '...KKKKKK...',
    '..KLFFFFfK..',
    '.KLAAFFAAfK.',
    '.KAWEAAWEAK.',
    '.KAEEAFEEAK.',
    '.KfAAFNAAfK.',
    '..KfFNNffK..',
    '...KKNNKK...',
    '.....KK.....',
  ],
  left: [
    '............',
    '............',
    '....KKKKK...',
    '...KLFFFfK..',
    '..KAAAFFFfK.',
    '.KAWEAFFFfK.',
    'KKAEEAFFFffK',
    'NNNAAFFFfffK',
    'NKKKFFFfffK.',
    '...KKffffK..',
    '.....KKKK...',
  ],
};

// ---------------------------------------------------------------------------
// TAILS
// ---------------------------------------------------------------------------
const T = (down, up, left) => ({ down, up, left: left || down });
TAILS.none = { down: null, up: null, left: null };
TAILS.bilby = T(
  // black-and-white crest tail held up behind
  { x: 11, y: 12, behind: true, part: ['.KK', 'KMK', 'KSK', 'KSK', 'KFK', 'KFK', 'KFK', '.KK'] },
  { x: 2, y: 12, behind: false, part: ['KK.', 'KMK', 'KSK', 'KSK', 'KFK', 'KFK', 'KFK', 'KK.'] },
);
TAILS.waterRat = T(
  // long tail along the ground with the white tip
  { x: 9, y: 18, behind: true, part: ['KK.....', 'KFK....', '.KFK...', '..KFKKK', '...KMMMK', '....KKK.'] },
  { x: 1, y: 18, behind: false, part: ['.....KK', '....KFK', '...KFK.', 'KKKFK..', 'KMMMK..', '.KKK...'] },
);
TAILS.raccoon = T(
  // ringed brush carried low and out
  { x: 10, y: 13, behind: true, part: ['KK....', 'KFK...', 'KRRK..', '.KFFK.', '.KRRRK', '..KFFK', '..KRRK', '...KK.'] },
  { x: 1, y: 13, behind: false, part: ['....KK', '...KFK', '..KRRK', '.KFFK.', 'KRRRK.', 'KFFK..', 'KRRK..', '.KK...'] },
);
TAILS.kinkajou = T(
  // long prehensile tail curling up into a hook
  { x: 11, y: 10, behind: true, part: ['.KKK.', 'KFFfK', 'KFKKK', 'KFK..', 'KFK..', 'KFK..', 'KFK..', '.KFK.', '..KFK', '...KK'] },
  { x: 0, y: 10, behind: false, part: ['.KKK.', 'KfFFK', 'KKKFK', '..KFK', '..KFK', '..KFK', '..KFK', '.KFK.', 'KFK..', 'KK...'] },
);
TAILS.mink = T(
  { x: 10, y: 15, behind: true, part: ['KK...', 'KFFK.', 'KFFfK', '.KFfK', '.KffK', '..KK.'] },
  { x: 1, y: 15, behind: false, part: ['...KK', '.KFFK', 'KFFfK', 'KFfK.', 'KffK.', '.KK..'] },
);
TAILS.lynx = T(
  // short bob with a black tip
  { x: 11, y: 15, behind: true, part: ['KK.', 'KFK', 'KSK', '.K.'] },
  { x: 7, y: 15, behind: false, part: ['.KK.', 'KFFK', 'KSSK', '.KK.'] },
  { x: 11, y: 15, behind: true, part: ['KKK', 'KFSK', '.KK.'] },
);
TAILS.arcticFox = T(
  // huge cream brush
  { x: 9, y: 12, behind: true, part: ['.KK....', 'KFFK...', 'KFFFK..', 'KLFFfK.', '.KLFFfK', '.KFFFfK', '..KFffK', '...KKK.'] },
  { x: 0, y: 12, behind: false, part: ['....KK.', '...KFFK', '..KFFFK', '.KFFFfK', 'KLFFfK.', 'KFFFfK.', 'KFffK..', '.KKK...'] },
);
TAILS.goat = T(
  { x: 11, y: 14, behind: true, part: ['KK', 'KM', 'K.'] },
  { x: 7, y: 15, behind: false, part: ['.KK.', 'KMMK', '.KK.'] },
  { x: 11, y: 13, behind: true, part: ['.K', 'KM', 'KK'] },
);
TAILS.newt = T(
  // long tail with a crest fin, dark above, orange keel (M) below
  { x: 9, y: 17, behind: true, part: ['KK.....', 'KFK....', 'KFFK...', '.KFFKK.', '.KFFFFK', '..KMMMK', '...KKKK'] },
  { x: 1, y: 17, behind: false, part: ['.....KK', '....KFK', '...KFFK', '.KKFFK.', 'KFFFFK.', 'KMMMK..', 'KKKK...'] },
);
// Osric's shell: a domed carapace with scute seams (R) behind the coat; from
// the back it covers the whole torso.
TAILS.shell = T(
  { x: 1, y: 10, behind: true, part: [
    '...KKKKKKKK...',
    '..KHHTrrTTtK..',
    '.KHTTrTTrTttK.',
    'KHTTrTTTTrtttK',
    'KTrrTTTTTTrrtK',
    'KTTrTTTTTTrttK',
    'KTTrTTTTTTrttK',
    '.KtrrTTTTrrtK.',
    '..KKKKKKKKKK..',
  ] },
  { x: 2, y: 9, behind: false, part: [
    '...KKKKKK...',
    '..KHHrrTTK..',
    '.KHTrTTrTtK.',
    'KHTrTTTTrttK',
    'KTrrTTTTrrtK',
    'KTTrTTTTrttK',
    'KTTrrTTrrttK',
    'KtTTrrrrtttK',
    'KttrrttrrttK',
    '.KtttttttttK',
    '..KKKKKKKK..',
  ] },
  { x: 7, y: 10, behind: true, part: [
    '..KKKKK..',
    '.KHTrTTK.',
    'KHTrTTTtK',
    'KTrrTTrtK',
    'KTTrTrrtK',
    'KTTrrTttK',
    'KtTTrttK.',
    '.KtrrttK.',
    '..KKKKK..',
  ] },
);
// Bird tails: short feathered wedge (T / t), white rump for the petrel (M).
TAILS.birdShort = T(
  { x: 11, y: 16, behind: true, part: ['KK.', 'KTK', 'KtK', '.K.'] },
  { x: 6, y: 17, behind: false, part: ['.KKK.', 'KTTtK', '.KtK.', '..K..'] },
  { x: 11, y: 16, behind: true, part: ['KKK.', 'KTtK', '.KtK', '..KK'] },
);
TAILS.birdLong = T(
  // cormorant's stiff tail propped on the ground
  { x: 11, y: 16, behind: true, part: ['KK..', 'KTK.', 'KTtK', '.KtK', '.KtK', '..KK'] },
  { x: 6, y: 17, behind: false, part: ['.KKK.', 'KTTtK', 'KTTtK', '.KtK.', '.KtK.', '..K..'] },
  { x: 11, y: 16, behind: true, part: ['KK...', 'KTK..', '.KTK.', '..KTtK', '...KtK', '....KK'] },
);
TAILS.goose = T(
  // pointed tail with the white undertail tipped up
  { x: 11, y: 15, behind: true, part: ['KK.', 'KTK', 'KMK', '.KK'] },
  { x: 6, y: 16, behind: false, part: ['.KKK.', 'KTTTK', 'KMMMK', '.KKK.'] },
  { x: 11, y: 14, behind: true, part: ['..KK', '.KMK', 'KTTK', 'KTK.', 'KK..'] },
);
TAILS.petrel = T(
  { x: 11, y: 16, behind: true, part: ['KK.', 'KMK', 'KTK', '.K.'] },
  { x: 6, y: 16, behind: false, part: ['.KKK.', 'KMMMK', 'KTTtK', '.KtK.', '..K..'] },
  { x: 11, y: 15, behind: true, part: ['KK..', 'KMMK', '.KTtK', '..KK.'] },
);

// ---------------------------------------------------------------------------
// EXTRAS (per-facing stamps after the head; cloth letters with k outline)
// ---------------------------------------------------------------------------
// Bryony's wide straw sun hat with a ribbon (Y straw, y shade, R ribbon).
EXTRAS.sunHat = {
  down: { x: 3, y: 0, part: ['...kYYYYk...', '..kRRRRRRk..', 'kYYYYYYYYYyk', '.kkkkkkkkkk.'] },
  up: { x: 3, y: 0, part: ['...kYYYYk...', '..kRRRRRRk..', 'kYYYYYYYYYyk', '.kkkkkkkkkk.'] },
  left: { x: 2, y: 0, part: ['.....kYYYYk..', '....kRRRRRRk.', '.kYYYYYYYYYyk', '..kkkkkkkkkk.'] },
};
// Augusta's Harbor Warden cap: navy (C) with a brass badge (A) and a peak.
EXTRAS.wardenCap = {
  down: { x: 3, y: 0, part: ['..kCCCCCCk..', '.kCCCAACCCk.', '.kccccccccck', '..kkkkkkkk..'] },
  up: { x: 3, y: 0, part: ['..kCCCCCCk..', '.kCCCCCCCCk.', '.kccccccccck', '..kkkkkkkk..'] },
  left: { x: 3, y: 0, part: ['....kCCCCCk.', '...kCCACCCck', 'kkcccccccck.', '.kkkkkkkk...'] },
};
// Pip's flat cap (D) with a short peak.
EXTRAS.flatCap = {
  down: { x: 3, y: 1, part: ['..kDDDDDDk..', '.kDDDDDDDdk.', '..kddddddk..'] },
  up: { x: 3, y: 1, part: ['..kDDDDDDk..', '.kDDDDDDDdk.', '.kddddddddk.'] },
  left: { x: 3, y: 1, part: ['....kDDDDDk.', '..kDDDDDDDdk', 'kkddddddddk.'] },
};
// Teo's goggles pushed up on the forehead (brass rims, ice glass).
EXTRAS.goggles = {
  down: { x: 4, y: 3, part: ['AGGAAGGA'] },
  up: { x: 4, y: 3, part: ['kAAAAAAk'] },
  left: { x: 5, y: 3, part: ['AGGAAk'] },
};
// Dov's auctioneer bow tie at the collar.
EXTRAS.bowtie = {
  down: { x: 6, y: 11, part: ['YkkY', 'YYYY'] },
  up: null,
  left: { x: 6, y: 11, part: ['YY', 'kY'] },
};
// Seraphine's caver's headlamp: brass housing, lamp glass X (LUT-exempt glow).
EXTRAS.headlamp = {
  down: { x: 4, y: 2, part: ['kkkkkkkk', '..kAXk..'] },
  up: { x: 4, y: 2, part: ['kkkkkkkk'] },
  left: { x: 4, y: 2, part: ['.kkkkkkkk', 'kXAk.....'] },
};
// Ines's spa towel turban (C towel, c folds).
EXTRAS.turban = {
  down: { x: 3, y: 0, part: ['...kCCCCk...', '.kCCcCCcCCk.', '.kccccccccck'] },
  up: { x: 3, y: 0, part: ['...kCCCCk...', '.kCcCCCcCCk.', '.kccccccccck'] },
  left: { x: 3, y: 0, part: ['....kCCCCk..', '..kCCcCCcCk.', '..kccccccccK'] },
};
// Maud's sou'wester: oilskin yellow (Y / y), long back brim.
EXTRAS.souwester = {
  down: { x: 3, y: 0, part: ['...kYYYYk...', '..kYYYYYYk..', '.kyyyyyyyyk.', 'kyk......kyk'] },
  up: { x: 3, y: 0, part: ['...kYYYYk...', '..kYYYYYYk..', '.kyyyyyyyyk.', 'kyyyyyyyyyyk'] },
  left: { x: 3, y: 0, part: ['....kYYYYk..', '...kYYYYYYk.', '.kyyyyyyyyyk', '.........kyk'] },
};
// Jackdaw twins' scarves (P): Ada knots hers on the left, Ivo on the right.
EXTRAS.scarfL = {
  down: { x: 4, y: 11, part: ['kPPPPPPPk', '.kPk.....', '.kPk.....'] },
  up: { x: 4, y: 11, part: ['kPPPPPPPk', '.....kPk.', '.....kPk.'] },
  left: { x: 5, y: 11, part: ['kPPPPk', '...kPk', '...kPk'] },
};
EXTRAS.scarfR = {
  down: { x: 3, y: 11, part: ['kPPPPPPPk', '.....kPk.', '.....kPk.'] },
  up: { x: 3, y: 11, part: ['kPPPPPPPk', '.kPk.....', '.kPk.....'] },
  left: { x: 5, y: 11, part: ['kPPPPk', '...kPk', '...kPk'] },
};
// Agathe's mourning band: a dark band on the (viewer's) left sleeve.
EXTRAS.armband = {
  down: { x: 3, y: 15, part: ['kk'] },
  up: { x: 11, y: 15, part: ['kk'] },
  left: { x: 8, y: 14, part: ['kk'] },
};
// Hollis's ration ledger tucked under the arm.
EXTRAS.ledger = {
  down: { x: 11, y: 14, part: ['kkk', 'kYk', 'kYk', 'kkk'] },
  up: { x: 2, y: 14, part: ['kkk', 'kYk', 'kYk', 'kkk'] },
  left: { x: 9, y: 14, part: ['kkk', 'kYk', 'kkk'] },
};
// Isolde's little storm lantern, carried low (X glow is LUT-exempt).
EXTRAS.lantern = {
  down: { x: 12, y: 16, part: ['.k.', 'kAk', 'kXk', 'kAk'] },
  up: null,
  left: { x: 3, y: 16, part: ['.k.', 'kAk', 'kXk', 'kAk'] },
};

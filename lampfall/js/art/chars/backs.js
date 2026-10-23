// js/art/chars/backs.js  [ART-CHARS] (from proto/chars/backs.js; otter -> marten,
// barn owl -> tawny owl, wolf/hare/fox dropped with the species fixes, new cast added)
// Hand-finished back-of-head ('up') views for every rig head. The old
// derivation flat-filled the front silhouette with fur, so walking north
// every character was a plain blob. Here each back is:
//   1. the front silhouette, re-lit as a ball from the top-left and quantised
//      to L / F / f with a checker dither on the F/f band edge, and
//   2. a hand-drawn overlay for what actually identifies the species from
//      behind: ear backs, nape tufts, straps, stripes, mottling.
// Overlay rows are 12 wide: '.' keeps the shaded pixel, '_' clears it, any
// other letter is painted. Imported by chars.js after mammals/trainers so
// every head exists before BODIES are built.
import { HEADS } from './mammals.js';
import './heads.js';

/** Re-light a front head silhouette as the back of a ball lit from top-left. */
export function shadeBack(front, { ears = 2, keep = 'K', fill = { L: 'L', F: 'F', f: 'f' }, dither = true } = {}) {
  const h = front.length, w = front[0].length;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  front.forEach((r, y) => { if (y < ears) return; [...r].forEach((ch, x) => { if (ch !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 0.5, ry = (y1 - y0) / 2 + 0.5;
  return front.map((r, y) => [...r].map((ch, x) => {
    if (ch === '.' || keep.includes(ch)) return ch;
    if (y < ears) return fill.f; // ear backs sit in their own shadow
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const d = nx * 0.62 + ny * 0.78; // + = facing away from the light
    if (y >= y1) return fill.f;      // nape under the skull
    if (d < -0.42) return fill.L;
    if (d < 0.34) return fill.F;
    if (d < 0.5) return dither && ((x + y) & 1) ? fill.f : fill.F; // 1-2px dithered terminator
    return fill.f;
  }).join(''));
}

function overlay(base, top) {
  return base.map((r, y) => {
    const t = top[y] || '';
    return [...r].map((ch, x) => (t[x] && t[x] !== '.' ? (t[x] === '_' ? '.' : t[x]) : ch)).join('');
  });
}

const back = (id, over, opts) => {
  const h = HEADS[id];
  if (!h) throw new Error(`backs: no head ${id}`);
  h.up = overlay(shadeBack(h.down, opts), over);
  h.up.forEach((r, i) => { if (r.length !== 12) throw new Error(`backs: ${id} row ${i} is ${r.length} wide`); });
};

// Red panda: dark ear backs with cream rims, a rust crown tuft, dark nape
// blending into the jumper collar.
back('redpanda', [
  '.KK......KK.',
  'KMSK....KSMK',
  'KSSFKKKKFSSK',
  '.KLLKL......',
  '............',
  '............',
  '............',
  '............',
  '............',
  '.K.SfffffSK.',
  '..KKSSSSKK..',
]);

// Pine marten: pale-rimmed ear backs, a dark dorsal line down the nape.
back('marten', [
  '.KKK....KKK.',
  'KMffK..KffMK',
  'KfFFFKKFFFfK',
  '.KLLLFFFFfK.',
  '.KLLFFFFFfK.',
  '.KLFFFFFFfK.',
  '.KFFFffFFfK.',
  '.KFFFffFFfK.',
  '.KfFFffFffK.',
  '..KffffffK..',
  '...KKffKK...',
], { ears: 2 });

// Water vole: round body-head, ears buried in fur as two dark tufts.
back('vole', [
  '............',
  '............',
  '...KKKKKK...',
  '.KKLLLFFFKK.',
  'KfKLLFFFFKfK',
  'K.LL........',
  '............',
  '............',
  '............',
  '............',
  '..KKKffKKK..',
]);

// Opossum: black ear backs, grizzled grey crown over the white face sides.
back('opossum', [
  '.KK......KK.',
  'KRRK....KRRK',
  'KRRRKKKKRRRK',
  '.KLLLFFFFfK.',
  '.KLLFFFFFfK.',
  '.KLFFFFFFfK.',
  '.KMFFFFFffK.',
  '.KMFFFFfffK.',
  '..KMfFffmK..',
  '...KmMMmK...',
  '....KKKK....',
], { fill: { L: 'L', F: 'F', f: 'f' } });

// Ferret: sable crown, pale ear rims, the mask's dark band wraps round the
// back of the head as a darker collar.
back('ferret', [
  '............',
  '..KKKKKKKK..',
  '.KLLLFFFFfK.',
  'KMKLFFFFFKMK',
  'KKLFFFFFFfKK',
  '............',
  '............',
  '............',
  '.KRRRRRRRrK.',
  '.KRRrRRrRrK.',
  '..KKRRRRKK..',
]);

// Mongoose: grizzled (agouti) coat as a sparse dark ticking pattern.
back('mongoose', [
  '............',
  '...KKKKKK...',
  '..KLLLfFFK..',
  'KfKLLFFFfKfK',
  'KKLFFfFFFfKK',
  '.K.....f....',
  '.K..f.......',
  '.K......f...',
  '..K..f...K..',
  '...K....K...',
  '....KKKK....',
]);

// Wren (beaver): the goggles' leather strap runs round the back of the head
// with a brass buckle; rims show as backs, tiny round ears either side.
back('beaver', [
  '..AAA.AAA...',
  '..aAa.aAa...',
  '.KaaaaaaaaK.',
  'fKLAaLFFFfKf',
  'KKLLFFFFFfKK',
  'KKLFFFFFFfK.',
  '.KFFFFFFFfK.',
  '.KFFFFFFffK.',
  '.KfFFFFFffK.',
  '.KffFFFfffK.',
  '..KKffffKK..',
], { keep: 'KAG' });

// Ambrose: grizzled pate with a pale bald spot, bushy white fringe at the
// nape, the spectacles' brass temple arms hooked over the ears.
back('beaverElder', [
  '............',
  '..KK....KK..',
  '.KfKKKKKKfK.',
  '.KLLMMLFFfK.',
  '.KLMMLFFFfK.',
  '.AFLFFFFFfA.',
  '.KaFFFFFFaK.',
  '.KFFFFFFFfK.',
  '.KMfMfMfMmK.',
  '.KMMmMMmMmK.',
  '..KKmmmmKK..',
]);

// Badger (Tamsin): the white blaze runs over the crown and down the nape
// between two black stripes; grey cheeks either side.
back('badger', [
  '............',
  '..KKKKKKKK..',
  '.KFRRMMRRfK.',
  'KFFRRMMRRffK',
  'KFFRRMMRRffK',
  '.KFRRMMRRfK.',
  '.KFRRMmRRfK.',
  '.KfRRmMRRfK.',
  '.KffRmmRffK.',
  '.KffRmmRffK.',
  '..KKRRRRKK..',
], { fill: { L: 'F', F: 'F', f: 'f' } });

// Stoat (Linnet): cream ear rims, a darker crown stripe; the ponytail extra
// sits on top of this.
back('stoat', [
  '............',
  '...KKKKKK...',
  '.KKLLLFFFKK.',
  'KMKLLFFFFKMK',
  'KKLLFFFFFfKK',
  '............',
  '............',
  '............',
  '............',
  '............',
  '..KKffffKK..',
], { dither: false });

// Route trainer (jackal/dog): tall ear backs, dark ear tips.
back('trainer', [
  '.K........K.',
  'KSK......KSK',
  'KfSK....KSfK',
  'KffFKKKKFffK',
  '.KLLL.......',
  '.KLL........',
  '............',
  '............',
  '............',
  '............',
  '..KKffffKK..',
], { ears: 3 });

// Tully (wombat): the sweatband wraps round, knotted at the back.
back('wombat', [
  '..KK....KK..',
  '.KffK..KffK.',
  '.KffKKKKffK.',
  'KLLL........',
  'KCCCCCcCCCcK',
  'K....cc....K',
  '.....c......',
  '............',
  '............',
  '............',
  '.KKffffffKK.',
], { ears: 3 });

// Bryony (hyrax): plain round back with the pale dorsal-gland spot.
back('hyrax', [
  '............',
  '..KK....KK..',
  '.KffK..KffK.',
  '.KffKKKKffK.',
  '............',
  '............',
  '.....MM.....',
  '.....mm.....',
  '............',
  '............',
  '..KKffffKK..',
], { ears: 4 });

// Thessaly (bilby): the long ears from behind, grey-backed.
back('bilby', [
  '.KK......KK.',
  'KFfK....KfFK',
  'KFfK....KfFK',
  'KFffK..KffFK',
  '.KffKKKKffK.',
  '............',
  '............',
  '............',
  '............',
  '............',
  '....KKKK....',
], { ears: 5 });

// Augusta (seal): smooth mottled dome; the cap extra sits on top.
back('seal', [
  '............',
  '...KKKKKK...',
  '..KLLLFFFK..',
  '.KLLFRFFFfK.',
  '.KLFFFFRFfK.',
  'KFRFFFFFFffK',
  'KFFFFRFFfffK',
  'KFFFFFFFfRfK',
  '.KfFRFFfffK.',
  '.KffffffffK.',
  '..KKffffKK..',
], { ears: 0 });

back('waterRat', [
  '............',
  '..KK....KK..',
  '.KffK..KffK.',
  '.KffKKKKffK.',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '....KKKK....',
], { ears: 4 });

// Teo (raccoon): the mask ties show at the sides of the head, ringed nape.
back('raccoon', [
  '.KK......KK.',
  'KMfK....KfMK',
  'KffFKKKKFffK',
  '............',
  '............',
  '.R........R.',
  'KRR......RRK',
  '............',
  '..KRRRRRRK..',
  '............',
  '...KKKKKK...',
], { ears: 3 });

back('kinkajou', [
  '............',
  '...KKKKKK...',
  'KKK.......KK',
  'KfF.......fK',
  'KK........KK',
  '............',
  '............',
  '............',
  '............',
  '............',
  '....KKKK....',
], { ears: 0 });

back('mink', [
  '............',
  '..KK....KK..',
  '.KffK..KffK.',
  '.KffKKKKffK.',
  '............',
  '............',
  '............',
  '............',
  '............',
  '............',
  '....KKKK....',
], { ears: 4 });

// Cass (lynx): tufted ear backs with the pale ear spot cats carry.
back('lynx', [
  '.R........R.',
  '.RK......KR.',
  'KfMK....KMfK',
  'KffFKKKKFffK',
  '............',
  '............',
  '............',
  'KM........MK',
  'KMR......RMK',
  'KMM......MmK',
  '.KKKffffKKK.',
], { ears: 4 });

back('arcticFox', [
  '............',
  '.KK......KK.',
  'KffK....KffK',
  'KffFKKKKFffK',
  '............',
  '............',
  '............',
  'KF........fK',
  'Kf........fK',
  '............',
  '..KKffffKK..',
], { ears: 4 });

// Hollis (goat): horn backs sweeping over the crown, shaggy nape.
back('goat', [
  '..R......R..',
  '..RK....KR..',
  '.KRK....KRK.',
  'KFKRKKKKRKfK',
  '.KLLRFFRFfK.',
  '............',
  '............',
  '..K.f..f.K..',
  '..KF.ff.fK..',
  '..KfFfFffK..',
  '...KfffFK...',
], { ears: 4 });

back('tortoise', [
  '............',
  '............',
  '...KKKKKK...',
  '..KLLFFFFK..',
  '.KLFFFFFFfK.',
  '.KFFFFFFFfK.',
  '.KFFfFFFFfK.',
  '.KFFFFfFFfK.',
  '.KfFFFFFffK.',
  '..KfffffffK.',
  '...KfFFfK...',
], { ears: 0, dither: false });

back('newt', [
  '............',
  '............',
  '...KKKKKK...',
  '.KKLLFFFFKK.',
  'KLFFFRFFFFfK',
  'KFFFFFFRFFfK',
  'KFRFFFFFFffK',
  'KFFFFRFFfffK',
  '.KfffffffffK',
  '.KffffffffK.',
  '..KKKKKKKK..',
], { ears: 0 });

// Corin (tawny owl): rufous crown with pale mottles and the white "brace"
// marks owls carry on the shoulders.
back('tawnyOwl', [
  '............',
  '...KKKKKK...',
  '..KFLFFLFK..',
  '.KFLLFLFFfK.',
  '.KLFLFFLFfK.',
  '.KFFFLFFFfK.',
  '.KFLFFFLffK.',
  '.KfFFLFFffK.',
  '.KFfFfFfFfK.',
  '..KfffffffK.',
  '...KKKKKK...',
], { ears: 0 });

// Idris (diver): plain glossy crown (the necklace bars read as a face from behind).
back('diver', [
  '............',
  '...KKKKKK...',
  '..KLLFFFFK..',
  '.KLLFFFFFfK.',
  '.KLFFFFFFfK.',
  '.KFFFFFFFfK.',
  '.KFFFFFFffK.',
  '.KFFFFFfffK.',
  '..KFFFFffK..',
  '..KffffffK..',
  '...KKKKKK...',
], { ears: 0 });

back('cormorant', [
  '....KKK.....',
  '...KFFK.....',
  '..KKLFFKKK..',
  '.KLLLFFFFfK.',
  '.KLLFFFFFfK.',
  '.KLFFFFFFfK.',
  '.KFFFFFFFfK.',
  '.KFFFFFFffK.',
  '..KFFFFffK..',
  '..KffffffK..',
  '...KKKKKK...',
], { ears: 0 });

back('goose', [
  '............',
  '...KKKKKK...',
  '..KLLFFFFK..',
  '.KLLFFFFFfK.',
  '.KLFFFFFFfK.',
  '.KFFFFFFFfK.',
  '.KFLFFLFffK.',
  '.KFFFFFFffK.',
  '..KFLFLffK..',
  '..KfffffffK.',
  '...KKKKKK...',
], { ears: 0 });

// Wendel (grebe): the double crest and the ruff seen from behind.
back('grebe', [
  '.SS......SS.',
  '..SK....KS..',
  '..KSKKKKSK..',
  '.KSSSSSSSSK.',
  '.KSSSSSSSSK.',
  '.KSSSSSSSSK.',
  'RKSSSSSSSSKR',
  'RRKSSSSSSKRR',
  'RRRKSSSSKRRR',
  '.RRSKSSKSRR.',
  '..SSKKKKSS..',
], { ears: 0, fill: { L: 'S', F: 'S', f: 'S' } });

// Ada & Ivo (jackdaw): the grey hood is all you see from behind.
back('jackdaw', [
  '............',
  '...KKKKKK...',
  '..KLFFFFFK..',
  '.KLFFFFFFfK.',
  '.KRRRRRRRRK.',
  '.KRRRRRRRRK.',
  '.KRRRRRRRRK.',
  '.KRRRRRRRRK.',
  '..KRRRRRRK..',
  '...KRRRRK...',
  '....KKKK....',
], { ears: 0 });

back('petrel', [
  '............',
  '............',
  '...KKKKKK...',
  '..KLLFFFfK..',
  '.KLLFFFFFfK.',
  '.KLFFFFFFfK.',
  '.KFFFFFFFfK.',
  '.KFFFFFFffK.',
  '..KfFFFffK..',
  '...KKffKK...',
  '.....KK.....',
], { ears: 0 });

// Anything not finished above gets the plain re-lit back.
for (const [id, h] of Object.entries(HEADS)) if (!h.up || h.up === h.down) h.up = shadeBack(h.down);

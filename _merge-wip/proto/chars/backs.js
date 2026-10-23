// proto/chars/backs.js
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
import './trainers.js';
import './heads2.js';

/** Re-light a front head silhouette as the back of a ball lit from top-left. */
export function shadeBack(front, { ears = 2, keep = 'K', fill = { L: 'L', F: 'F', f: 'f' } } = {}) {
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
    if (d < 0.22) return fill.F;
    if (d < 0.5) return ((x + y) & 1) ? fill.f : fill.F;
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

// Otter: sleek and round, tiny ear nubs low on the sides, wet-look highlight.
back('otter', [
  '............',
  '..KKKKKKKK..',
  '.KLLLFFFFfK.',
  'KfLLFFFFFffK',
  'KfLFFFFFFffK',
  '.K..........',
  '............',
  '............',
  '............',
  '............',
  '..KKffffKK..',
]);

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
  '.KMLLFFFFmK.',
  '.KMLFFFFFmK.',
  '.KMFFFFFFmK.',
  '.KMFFFFFfmK.',
  '.KMfFFFFfmK.',
  '..KMfFffmK..',
  '...KmffmK...',
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
  '..KLLfLFFK..',
  'KfKLFLFfFKfK',
  'KKLFfFFfFfKK',
  '.K.F.f.F.f..',
  '.K.f.F.f.F..',
  '.K.F.f.F.f..',
  '..K.f.F.fK..',
  '...K.f.fK...',
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
]);

// Barn owl (Corin): golden-buff crown with grey mottling and white seed
// spots; the pale facial-disc rim shows at the sides.
back('owl', [
  '............',
  '...KKKKKK...',
  '..KLLFLFFK..',
  '.KMLmLFmFfK.',
  '.KMFFMFFmfK.',
  '.KMmFFmFFfK.',
  '.KMFMFFMffK.',
  '.KMFFmFFmfK.',
  '.KmfFFfFffK.',
  '..KmffmffK..',
  '...KKffKK...',
], { fill: { L: 'L', F: 'F', f: 'f' } });

// Generic route trainer (jackal/dog): tall ear backs, dark ear tips.
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

// Idris (wolf): ear backs dark-tipped, a saddle of darker fur down the nape,
// white ruff showing either side of the jaw.
back('wolf', [
  '..K......K..',
  '.KfK....KfK.',
  '.KffK..KffK.',
  'KFffFKKFffKK',
  '............',
  '............',
  '............',
  'KM........MK',
  'KMM.ffff.MMK',
  '.KM.ffff.mK.',
  '..KKffffKK..',
], { ears: 3 });

// Agathe (hare): the laid-back ears frame the head from behind too, their
// dark tips hanging past the jaw.
back('hare', [
  '...KKKKKK...',
  '..KLLLFFfK..',
  '.KLLFFFFFfK.',
  'KFKLFFFFFKfK',
  'KFKFFFFFfKfK',
  'KFKFFFFFfKfK',
  'KFKFFFFffKfK',
  'KfKfFFFffKfK',
  'KfKffFfffKfK',
  'KffKKffKKffK',
  '.KK......KK.',
], { ears: 0 });

// Teo (fox): big ear backs with dark tips, white cheek tufts flaring out.
back('fox', [
  'KK........KK',
  'KSK......KSK',
  'KfSK....KSfK',
  'KffFKKKKFffK',
  '............',
  '............',
  '............',
  'KM........MK',
  'KMM......MMK',
  '.KK......KK.',
  '...KKffKK...',
], { ears: 3 });

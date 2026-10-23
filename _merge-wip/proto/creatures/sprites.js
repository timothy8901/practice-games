// proto/creatures/sprites.js
// Wildshift creature sprites: 32x32 palette-indexed string art, left-front 3/4 view.
// Format per sprite: { rows, palette, heartmark:{x,y}, type, feature, back?, idle2? }
//  - rows: 32 strings of 32 chars, '.' = transparent, any other char = MASTER palette key.
//  - palette: subset of MASTER actually used by this form (k outline + ramps). The
//    Heartmark is NOT baked in: the runtime draws the 3px plus in `m` at `heartmark`
//    with a `w` (cool body) or `y` (warm / light body) centre pixel. On light body
//    areas (w c y i l a) the runtime outlines the plus in `k` (visuals bible 4.2).
//  - back: 32x32 back view (player's own creature in battle), same palette.
//  - idle2: second idle frame (breathe / bob), same palette.
//
// Master palette: Sweetie 16 (GrafxKid) + 5 extras. The five extra hex values are a
// proposal for the art lead (bible 3.3 leaves them "(define)").

export const MASTER = Object.freeze({
  k: '#1a1c2c', // outline (never pure black)
  p: '#5d275d', // purple  - Hollow
  r: '#b13e53', // red     - Rust, coral shade
  o: '#ef7d57', // orange  - Kiln, coral
  y: '#ffcd75', // yellow  - Bolt, warm highlight
  l: '#a7f070', // light green
  g: '#38b764', // green   - Moss
  t: '#257179', // teal
  n: '#29366f', // dark blue
  b: '#3b5dc9', // blue    - Brine
  s: '#41a6f6', // sky     - Rime
  i: '#73eff7', // ice     - Glass
  w: '#f4f4f4', // near-white (never pure white)
  v: '#94b0c2', // light grey - Plain
  e: '#566c86', // grey    - Stone
  d: '#333c57', // dark grey - Star badge
  m: '#ff5bd6', // comet magenta (extra, proposed) - Heartmark / Vagary only
  c: '#f2c9a3', // skin light (extra, proposed)
  h: '#cf8a5e', // skin shade (extra, proposed)
  u: '#7a4b2e', // umber (extra, proposed) - Grit
  a: '#d9b38c', // tan (extra, proposed)
});

/** Build a palette subset from a string of master keys. */
export function pal(keys) {
  const p = {};
  for (const k of keys) p[k] = MASTER[k];
  return p;
}

// ---------------------------------------------------------------------------
// Cheap second idle frames
// ---------------------------------------------------------------------------

/** Squash-breathe: everything above `line` drops one pixel; row `line` is lost. */
export function squash(rows, line) {
  const out = rows.slice();
  for (let y = line; y > 0; y--) out[y] = rows[y - 1];
  out[0] = '.'.repeat(32);
  return out;
}
/** Hover-bob: whole sprite rises one pixel. */
export function hover(rows) {
  return rows.slice(1).concat(['.'.repeat(32)]);
}

const S = {};

// ===========================================================================
// 1. SLOSHKIN  (Brine, starter base)  mud salamander with a coral ruff
// ===========================================================================
S.Sloshkin = {
  type: 'Brine', feature: 'coral ruff collar; sits buried to the belly in tide-flat mud',
  palette: pal('ksbnorwua'),
  heartmark: { x: 12, y: 7 },
  heartmarkBack: { x: 14, y: 6 },
  rows: [
    '................................',
    '................................',
    '................................',
    '..........kkkkk.................',
    '........kkssssbkk...............',
    '.......kssssbbbbbk..............',
    '......kssssbbbbbbbk.............',
    '.....kssssbbbbbbbbbk............',
    '.....ksssbbbbbbbbbbbk...........',
    '....kssbbbbbbbbbbbbbkk..........',
    '....ksbkkkbbbbbbbbbbbkok........',
    '....kbkwkkbbbbbbbbbbnkook.......',
    '....kbkkkkbbbbbbbbbbnnkrok......',
    '....kbbkkkbbbbbbbbbbnnkoork.....',
    '....kbnnnbbbbbbbbbbbnnkorrok....',
    '....knbbbbbbbbbbbbbnnnkoorrk....',
    '.....knnbbbbbbbbbbbnnnkroork....',
    '.....kknnnbbbbbbbbnnnkorrok.....',
    '......kkknnnbbbbnnnnkkrrok......',
    '........kkkkkkkkkkkkbbkrk.......',
    '...........kbbbbbbbbbbbnk.......',
    '.........kksbbbbbbbbbbbbnk......',
    '........ksbbbbbbbbbbbbbbnnk.....',
    '........ksbbbkkbbbbbbbbbnnk..kk.',
    '........kbbkbbkbbbbbbbbbnnnkksbk',
    '........knnkbbbkbbbbbbbbnnnbbbnk',
    '....kkkaaakkkkbbbbbbbbbbnnnbbnnk',
    '...kaaaaauuuuuuuuuuuuuuuuuuukkkk',
    '..kaaaauuuuuuuuuuuuuuuuuuuuuuuuk',
    '..kaauuuuuuuuuuuuuuuuuuuuuuuuuk.',
    '...kkkkkkkkkkkkkkkkkkkkkkkkkkk..',
    '................................',
  ],
  back: [
    '................................',
    '................................',
    '................................',
    '.............kkkkk..............',
    '...........kkssbbbkk............',
    '..........kssbbbbbbbk...........',
    '.........kssbbbbbbbbbk..........',
    '........kssbbbbbbbbbbbk.........',
    '........ksbbbbbbbbbbbbk.........',
    '.......ksbbbbbbbbbbbbbnk........',
    '.......kbbbbbbbbbbbbbbnk........',
    '.......kbbbbbbbbbbbbbbnk........',
    '.......kbbbbbbbbbbbbbnnk........',
    '.......knbbbbbbbbbbbnnnk........',
    '.....kkknnbbbbbbbbbnnnkkk.......',
    '....korokknnbbbbbbnnkkorok......',
    '...koorrokkknnnnnnkkoorrrok.....',
    '...korrrrookkkkkkkkoorrrrok.....',
    '...krrorrrooooooooorrorrrrk.....',
    '....krrrrrroooooorrrrrrrrk......',
    '.....kkrrrrrrrrrrrrrrrrkk.......',
    '......kkkbbbbbbbbbbbkkkk........',
    '.....kbbbbbbbbbbbbbbbbbnk.......',
    '....ksbbbbbbbbbbbbbbbbbbnk......',
    '...ksbbbbbbbbbbbbbbbbbbbnnk.....',
    '..kksbbbbbbbbbbbbbbbbbbbnnnk....',
    '.kbbkbbbbbbbbbbbbbbbbbbbnnnnk...',
    'kbbbkaaauuuuuuuuuuuuuuuuuuuukk..',
    'kbnnkaauuuuuuuuuuuuuuuuuuuuuuuk.',
    '.kkkkauuuuuuuuuuuuuuuuuuuuuuuk..',
    '....kkkkkkkkkkkkkkkkkkkkkkkkkk..',
    '................................',
  ],
};

// ===========================================================================
// PUDDLEPIP  (Brine, Sloshkin hatchling)  a droplet that lives in its own puddle
// ===========================================================================
S.Puddlepip = {
  type: 'Brine', feature: 'droplet head rising from a puddle',
  palette: pal('kbsniw'),
  heartmark: { x: 13, y: 12 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............kk.................',
    '............kiik................',
    '...........kisbbk...............',
    '..........kisbbbbk..............',
    '..........ksbbbbbbk.............',
    '.........ksbbbbbbbbk............',
    '.........kbbbbbbbbbnk...........',
    '........kbbkkbbbbkkbnk..........',
    '........kbkwkbbbkwkbnk..........',
    '........kbkkkbbbbkkbbnk.........',
    '........kbbbbbbbbbbbbnk.........',
    '........knbbbbbbbbbbnnk.........',
    '........knnbbbbbbbbbnnk.........',
    '.........knnbbbbbbbnnk..........',
    '......kkkknnnnnnnnnnkkkkk.......',
    '....kksiibbbbbbbbbbbbbbbbkk.....',
    '...ksibbbbbbbbbbbbbbbbbbbbnk....',
    '..ksbbbbbbbbbbbbbbbbbbbbbbbnk...',
    '..kbbbbbbbbbbbbbbbbbbbbbbbnnk...',
    '..knbbbbbbbbbbbbbbbbbbbbbnnnk...',
    '...knnbbbbbbbbbbbbbbbbbbnnnk....',
    '....kknnnnnnnnnnnnnnnnnnnkk.....',
    '......kkkkkkkkkkkkkkkkkkk.......',
    '................................',
  ],
};

// ===========================================================================
// CHILLNUB  (Rime, Rimeplate hatchling)  small curled ball with one plate
// ===========================================================================
S.Chillnub = {
  type: 'Rime', feature: 'one oversized rime plate on a curled ball',
  palette: pal('kwisbn'),
  heartmark: { x: 11, y: 17 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..................kkkk..........',
    '................kkwwiikk........',
    '...............kwwwiiiiik.......',
    '..............kwwiiiiiiisk......',
    '..........kkkkkwiiiiiiiissk.....',
    '........kkssbbkiiiiiiiisssk.....',
    '.......kssbbbbkiiiiiisssssbk....',
    '......kssbbbbbbkiiisssssssbk....',
    '.....kssbbbbbbbbkkssssssbbbk....',
    '.....ksbbbbbbbbbbbkkkkbbbbbk....',
    '....ksbbkkbbbbbbbbbbbbbbbbbnk...',
    '....kbbkwkkbbbbbbbbbbbbbbbbnk...',
    '....kbbkkkkbbbbbbbbbbbbbbbnnk...',
    '....kbbbkkbbbbbbbbbbbbbbbnnnk...',
    '....knbbbbbbbbbbbbbbbbbbnnnnk...',
    '....knnbbbbkkbbbbbbbbbbbnnnnk...',
    '.....knnbbknnkbbbbbbbbbnnnnk....',
    '.....knnnbbbbbbbbbbbbbnnnnnk....',
    '......knnnbbbbbbbbbbbnnnnnk.....',
    '.......knnnnbbbbbbbnnnnnnk......',
    '........kknnnnnnnnnnnnnkk.......',
    '..........kkkkkkkkkkkkk.........',
    '................................',
    '................................',
  ],
};

S.Scrapling = {
  type: 'Grit', feature: 'red shoulder patch ("its badge") and sailcloth-wrapped fists',
  palette: pal('kahuwvr'),
  heartmark: { x: 14, y: 20 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......kk.....kk................',
    '......kahk...kahk...............',
    '.....kaaahkkkkaahk..............',
    '.....kaaaaaaaaaaahk.............',
    '....kaaaaaaaaaaaaahk............',
    '....kaauuuaaaaaaaaahk...........',
    '....kaakkkaaaaaaaaahk...........',
    '....kaakwkkaaaaaaaahk...........',
    '....kaaakkaaaaaaaaahhk..........',
    '....khaaaaaaaaaaaaahhk..........',
    '....khhauuuuuaaaaahhhk..........',
    '.....khhawuuaaaaahhhhk..........',
    '.....kkhhhhaaaaahhhhkk..........',
    '...kkkkrrhhhhhhhhhhkk...........',
    '..kwwwkrrraaaaaaaahhhk..........',
    '.kwwvwwkrraaaaaaaaahhk..........',
    '.kwvvvwwkaaaaaaaaaahhkvk........',
    '.kwvvvvwkaaaaaaaaaahhkwvk.......',
    '.kvvvvvwkaaaaaaaaaaahkwwvk......',
    '..kvvvvkhaaaaaaaaaaahhkvvk......',
    '...kkkkhhaaaaaaaaaaahhhkkk......',
    '......khhaaaaaaaaaaahhhk........',
    '......khhakkkkkkkhhhhhk.........',
    '.....khhhk.....khhhhhk..........',
    '.....khhhk.....khhhhk...........',
    '.....kkkkk.....kkkkkk...........',
    '................................',
  ],
};

S.Tossup = {
  type: 'Plain', feature: 'lives in a chipped teacup',
  palette: pal('kwvebahu'),
  heartmark: { x: 7, y: 20 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........kk...................',
    '..........kwk...................',
    '..........kak.kkkkkkkkk.........',
    '.........kaak.kwwwwwwwwkk.......',
    '.......kkaaakkwwwwwwwwwwwkk.....',
    '......kahhkkawwwwwwwwwwwwwvk....',
    '.....kahhhkawwwwbbbbbbbbbbbvk...',
    '.....kaakkkkwwwwwwwwwwwwwwwvkkk.',
    '....kaakwkkawwwwwwwwwwwwwwvvkvk.',
    '....kaakkkhawwwwwwwwwwwwwvvvkvk.',
    '....kaaahhhawwwwwwwwwwwwwvvvkek.',
    '....khaaahhawwwwwwwwwwwwvvvvkek.',
    '....khhaahhawwwwwwwwwwwvvvvkke..',
    '.....khhhhkawwwwwwwwwwvvvvvvk...',
    '....kkkhhhkavwwwwwwwwvvvvvvek...',
    '...kaahkkhkavvvvvvvvvvvvvveek...',
    '..kaaaakhhkkvvvvvvvvvvvvveek....',
    '..kaahhkhaahkkvvvvvvvvvvveek....',
    '..kahhhkkaaahkkkkeeeeeeeekk.....',
    '...kkhhk.khhahkkkkkkkkkkk.......',
    '....kkk...khhhk.................',
    '..........kkkk..................',
    '................................',
    '................................',
  ],
};

S.Sedgehare = {
  type: 'Moss', feature: 'ears are two blades of sawgrass (edges glint w before a crit)',
  palette: pal('klgtnwa'),
  heartmark: { x: 9, y: 21 },
  rows: [
    '.........kk.....kk..............',
    '........klgk...klgk.............',
    '........klgk..klggk.............',
    '.......klggk..klgtk.............',
    '.......klggk.klggtk.............',
    '.......klgtk.klggtk.............',
    '......klggtk.klggtk.............',
    '......klggtk.kggttk.............',
    '......klggtk.kggttk.............',
    '......kggttk.kggttk.............',
    '......kggttkkggttk..............',
    '.....kgggttkggtttk..............',
    '.....kggggttgggttk..............',
    '....klgggggggggggtk.............',
    '...klgggggggggggggtk............',
    '...kggkkgggggggggggtk...........',
    '..kggkwkkgggggggggtk............',
    '..kggkkkkgggggggggttk...........',
    '..kgggkkgggggggggggttk..........',
    '..kngggggaaagggggggttk..........',
    '..knnggggaaaaggggggttnk.........',
    '...knngggaaaaaggggtttnk.........',
    '...knnggggaaaaagggtttnk.........',
    '....knnggggaaaaggtttnnk.........',
    '....knnngggaaaaggttnnnk.........',
    '.....knngggggggggtttnkkk........',
    '.....knnkgggggggkttnnktgk.......',
    '....kkgggkkkkkkkggtnnkgtk.......',
    '...kgggggk.....kggtnkkkk........',
    '...kggggggk....kgggtnk..........',
    '....kkkkkk......kkkkkk..........',
    '................................',
  ],
};

export const SPRITES = S;
export default SPRITES;

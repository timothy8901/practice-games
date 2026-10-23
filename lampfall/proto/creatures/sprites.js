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

/** Squash-breathe: rows from `line` down stay put (feet / base); everything above
 *  drops one pixel, so row `line - 1` is lost. */
export function squash(rows, line) {
  const out = rows.slice();
  for (let y = line - 1; y > 0; y--) out[y] = rows[y - 1];
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
  palette: pal('ksbnorwu'),
  heartmark: { x: 10, y: 6 },
  heartmarkBack: { x: 14, y: 6 },
  rows: [
    '................................',
    '................................',
    '................................',
    '......kkkkkk....................',
    '....kksssssnkk..................',
    '...kssssbbbbnnk.................',
    '..kssbbbbbbbbnnk................',
    '..ksbbbbbbbbbbnnk...............',
    '.ksbbkkbbbbbbbbnkkk.............',
    '.ksbkwkkbbbbbbbbkook............',
    '.ksbkkkkbbbbbbbbkorrk...........',
    '.ksbbkkbbbbbbbbbkoorrk..........',
    '.ksbbbbbbbbbbbbbkorrrok.........',
    '.knbbbbbbbbbbbbnkoorrok.........',
    '.knnnbbbbbbbbbnnkroorrk.........',
    '..knnnnbbbbbbnnnkorrrokk.....kkk',
    '...kknnnbbbbnnkkkrrroknk....ksbn',
    '.....kkkorrooksbkkrokbnnk...ksbn',
    '.......kkkkkksbbbkkkbbbnnk..kbbn',
    '......kssssbbbbbbbbbbbbbnnk.kbnn',
    '.....ksssbbbbbbbbbbbbbbbnkkkkbnn',
    '....ksssbbbbbbbbbbbbbbbbbnnnkbnk',
    '....kssbkkbbbbbbbbbbbbbbbnnnnnnk',
    '....ksbkbbkbbbbbbbbbbbbbbbnnnnnk',
    '....ksbkbbbkbbbbbbbbbbbbbbbnnnnk',
    '...kkbkkbbbkkbbbbbbbbbbbbbbnnnk.',
    '..kkuuuuuuuuuuuuuuuuuuuuuuuuukk.',
    '.kuuuuuuuuuuuuuuuuuuuuuuuuuuuuk.',
    '.kuuuuuuuuuuuuuuuuuuuuuuuuuuuuk.',
    '..kkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
    '................................',
    '................................',
  ],
  back: [
    '................................',
    '................................',
    '................................',
    '.............kkkkk..............',
    '...........kksssnnkk............',
    '..........kssbbbbbnnk...........',
    '.........kssbbbbbbbnnk..........',
    '........kssbbbbbbbbbnnk.........',
    '........ksbbbbbbbbbbnnk.........',
    '.......ksbbbbbbbbbbbbnnk........',
    '.......ksbbbbbbbbbbbbnnk........',
    '.......ksbbbbbbbbbbbbnnk........',
    '.......ksbbbbbbbbbbbbnnk........',
    '.......knbbbbbbbbbbbnnnk........',
    '.....kkknnbbbbbbbbbnnnkkk.......',
    '....korokknnbbbbbbnnkkorok......',
    '...koorrokkknnnnnnkkoorrrok.....',
    '...korrrrookkkkkkkkoorrrrok.....',
    '...krrorrrooooooooorrorrrrk.....',
    '....krrrrrroooooorrrrrrrrk......',
    '.....kkrrrrrrrrrrrrrrrrkk.......',
    '......kkkbbbbbbbbbbbkkkk........',
    '.....ksbbbbbbbbbbbbbbbnnk.......',
    '....ksbbbbbbbbbbbbbbbbbnnk......',
    '...ksbbbbbbbbbbbbbbbbbbbnnk.....',
    '..kksbbbbbbbbbbbbbbbbbbbnnnk....',
    '.ksbkbbbbbbbbbbbbbbbbbbbnnnnk...',
    'ksbbkuuuuuuuuuuuuuuuuuuuuuuukk..',
    'kbnnkuuuuuuuuuuuuuuuuuuuuuuuuuk.',
    '.kkkkuuuuuuuuuuuuuuuuuuuuuuuuk..',
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
    '..........kisbbnnk..............',
    '..........ksbbbbnnk.............',
    '.........ksbbbbbbnnk............',
    '.........ksbbbbbbbnnk...........',
    '........ksbkkbbbbkknnk..........',
    '........kskwkbbbkwknnk..........',
    '........kskkkbbbbkkbnnk.........',
    '........ksbbbbbbbbbbnnk.........',
    '........knbbbbbbbbbbnnk.........',
    '........knnbbbbbbbbbnnk.........',
    '.........knnbbbbbbbnnk..........',
    '......kkkknnnnnnnnnnkkkkk.......',
    '....kksiibbbbbbbbbbbbbsnnkk.....',
    '...ksibbbbbbbbbbbbbbbbbbbnnk....',
    '..ksbbbbbbbbbbbbbbbbbbbbbbnnk...',
    '..kbbbbbbbbbbbbbbbbbbbbbbbnnk...',
    '..knnnbbbbbbbbbbbbbbbbbbbnnnk...',
    '...knnnnnnnnnnnnnnnnnnnnnnnk....',
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
  palette: pal('kwisbnv'),
  heartmark: { x: 11, y: 18 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............kkkk..............',
    '............kkwwwvkk............',
    '..........kkwwwiiivvkk..........',
    '........kkwwwiiiiiivvvkk........',
    '......kkwwiiiiiiiiiivvvvkk......',
    '.....kwwiiiiiiikiiiiivvvvvk.....',
    '....kwiiiiiiiikiiiiiiivvvvvk....',
    '....kkkiiiiiikiiiiiiivvvvkkk....',
    '.......kkkkiikiiiiivvvkkkk......',
    '.....kssskkkkkkkkkkkkkbbbk......',
    '....kiissssssssssssbbbbbbnk.....',
    '...kissskksssssssssbbbbbbnnk....',
    '..kisssskwkssssskkkkbbbbbnnk....',
    '..kssssskkksssskbbbbkbbbbnnk....',
    '..kssssssssssskbbkkbbkbbbnnk....',
    '..ksssskksssssksbkbbkbkbbnnk....',
    '..kbsssssssssskbbbkkbkbbnnnk....',
    '...kbbsssssssssksbbbbkbbnnnk....',
    '...kbbbbsssssssskkkkkbbnnnk.....',
    '....knbbbbbsssssssbbbbnnnnk.....',
    '....kknnbbbbbbbbbbbbbnnnkk......',
    '.....kssknnnnnnnnnnnnksk........',
    '.....kkkk.kkkkkkkkkk.kkk........',
    '................................',
    '................................',
  ],
};

S.Scrapling = {
  type: 'Grit', feature: 'red shoulder patch ("its badge"), torn ear, sailcloth-wrapped fists up in a guard',
  palette: pal('kahuwvr'),
  heartmark: { x: 13, y: 21 },
  heartmarkBack: { x: 12, y: 21 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.....kk.........kk..............',
    '....kahk.......kahk.............',
    '....kahhk.....kahhkk............',
    '....kahhhkkkkkkahhhk............',
    '.....kaaaaaaaaaaaaahk...........',
    '....kaaaaaaaaaaaaaaahk..........',
    '...kaaukkaaaaaaakkuahk..........',
    '...kaakkkkaaaaaakkkkhk..........',
    '...kaakwkkaaaaaakwkkhk..........',
    '...kaaakkaaaaaaaakkahk..........',
    '...khaaaaaukaaaaaaaahk..........',
    '...khhaaaukkkuaaaaahhk..........',
    '....khhaaukwkwkaaahhk...........',
    '....kkhhhhkkkkhhhhhkk...........',
    '..kkkkkkrrrhhhhhhhhkkkkk........',
    '.kwwwvwkrrrraaaaaahhkwvwwwk.....',
    'kwwvvvwwkrraaaaaaahhkwwvvvwk....',
    'kwvvvwvwkaaaaaaaaahhkwvwvvvk....',
    'kwvvwvvwkaaaaaaaaahkkvwvvvvk....',
    '.kvvwvvkhaaaaaaaaahhkvvwvvk.....',
    '..kkkkkhhaaaaaaaaahhhkkkkk......',
    '......khhahhhhhaaahhhhk.........',
    '......khhhkkkkkkkhhhhhkkk.......',
    '.....khhhk.....khhhhkkuuk.......',
    '.....khhhk.....khhhhkkkk........',
    '.....kkkkk.....kkkkk............',
    '................................',
  ],
  back: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.....kk.........kk..............',
    '....kahk.......kahk.............',
    '....kahhk.....kahhkk............',
    '....kahhhkkkkkkahhhk............',
    '.....kaaaaaaaaaaaaaak...........',
    '....kaaaaaaaaaaaaaaaak..........',
    '...kaaaaaaaaaaaaaaaaak..........',
    '...kaaaaaaaaaaaaaaaaak..........',
    '...kaaaaaaaaaaaaaaaaak..........',
    '...kaaaaaaaaaaaaaaaaak..........',
    '...khaaaaaaaaaaaaaaahk..........',
    '...khhaaaaaaaaaaaaahhk..........',
    '....khhaaaaaaaaaaahhk...........',
    '....kkhhhhhhhhhhhhhkk...........',
    '..kkkkkkhhhhhhhhhrrrkkkk........',
    '.kwwwvwkaaaaaaaaaarrrrkwvwwwk...',
    'kwwvvvwwkaaaaaaaaahrrrkwwvvvwk..',
    'kwvvvwvwkaaaaaaaaahhkkwvwvvvk...',
    'kwvvwvvwkaaaaaaaaahkkkvwvvvvk...',
    '.kvvwvvkhaaaaaaaaahhkvvwvvk.....',
    '..kkkkkhhaaaaaaaaahhhkkkkk......',
    '......khhaaaaaaaaahhhhk.........',
    '......khhakkkkkkkhhhhhkkk.......',
    '.....khhhk.....khhhhkkuuk.......',
    '.....khhhk.....khhhhkkkk........',
    '.....kkkkk.....kkkkk............',
    '................................',
  ],
};

S.Tossup = {
  type: 'Plain', feature: 'hermit crab living in a chipped blue-banded teacup',
  palette: pal('kwvebahu'),
  heartmark: { x: 14, y: 8 },
  rows: [
    '................................',
    '................................',
    '................................',
    '..........kwk.kwk...............',
    '..........kkk.kkk...............',
    '...........kak.kak..............',
    '...........kaakkaak.............',
    '.........kkkaaaaaakkkk..........',
    '.......kkeekaaaaaakeeekk........',
    '......keeeekaaaaaakeeeeeek......',
    '.....kwwkaakwwwwwwwwkkwwwvk.....',
    '....kkkkaaaakbbbbbbbeebbbbkkkkk.',
    '...kaaahhaaahkbbbbbbkkbbbbkvvvvk',
    '..kaakkkhaaahhkwwwwwwwwwwwkvkkek',
    '..kakk..kkaaahkkwwwwwwwwwwkvk.ek',
    '..kaak...kkhhhkkwwwwwwwwwvkvk.ek',
    '...kkakwwwkkkkwwwwwwwwwwvvkvk.ek',
    '....kkkkwwwwwwwwwwwwwwwvvvkvvvvk',
    '.......kwwwwwwwwwwwwwwvvvekkkkkk',
    '........kwwwwwwwwwwwwwvvveek....',
    '.........kvwwwwwwwwwwvvveeek....',
    '..........kvvwwwwwwwvvveek......',
    '...........kkvwwwwwvveekk.......',
    '.............kkkkkkkkkk.........',
    '............kvvvvvveeeek........',
    '............kkkkkkkkkkkk........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

S.Sedgehare = {
  type: 'Moss', feature: 'ears are two serrated blades of sawgrass (edges glint w before a crit)',
  palette: pal('klgtnwa'),
  heartmark: { x: 9, y: 21 },
  rows: [
    '.........k......k...............',
    '........klk....klk..............',
    '........kltk...kltk.............',
    '.......kkltk...kltk.............',
    '.......klgtk..kkltk.............',
    '......kklgtk..klgtk.............',
    '......klggtk.kklgtk.............',
    '.....kklggtk.klggtk.............',
    '.....klggttk.kklgtk.............',
    '.....klggttk.klggtgk............',
    '....kklggttkkklggtk.............',
    '....klgggttkklgggtk.............',
    '....klgggtttkggggttk............',
    '....kggggggggggggttk............',
    '...klgggggggggggggtk............',
    '...kggkkgggggggggggtk...........',
    '..kggkwkkgggggggggttk...........',
    '..kggkkkkggggggggggtk...........',
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

S.Skeinwing = {
  type: 'Brine/Gust', feature: 'coral collar on a white sea bird; feather fringe on the near wing (flattens once Featherbed is spent)',
  palette: pal('kwvebnor'),
  heartmark: { x: 10, y: 8 },
  heartmarkBack: { x: 21, y: 8 },
  rows: [
    '................................',
    '................................',
    '............................kk..',
    '...........................kwwk.',
    '..........................kwwwk.',
    '.........................kwwwvk.',
    '........kkkkk...........kwwwwvk.',
    '.......kwwwwvk.........kwwwwvvk.',
    '......kwwwwwwvk.......kwwwwwvvk.',
    '.....kwwkkwwwwvk.....kwwwwwvvek.',
    '..kkkkwkwkkwwwvk....kwwwwwvvvek.',
    '.kbbbkwkkkkwwwvk...kwwwwwvvveek.',
    '..kkkkwwwwwwwwvk..kwwwwwvvveeek.',
    '.....kvwwwwwwwvk.kwwwwwvvvveek..',
    '......kvwwwwwwkkkwwwwwvvvveeek..',
    '.......kkkoookoowwwwwvvvveeek...',
    '........koorroroorwwwvvvveekk...',
    '.......korrrorrorokwwvvveeek....',
    '......kkrrrroorrrrkwwwvveeek....',
    '....kkwwkrrrrrrrrkwwwwwwvekk....',
    '...kwwwwwkkrrrrkkwwwwwwwwvvk....',
    '..kwwwwwwwwkkkkwwwwwwwwwwvvk....',
    '.kwwwvwwwwwwwkwwwwwwwwwwwvvvk...',
    'kwwvwwvwwwwwwwkwwwwwwwwwvvvvkkk.',
    'kwvwwvwwvwwwwwwkwwwwwwwvvvvkvvk.',
    'kvwwvwwvwwvwwwwwkwwwwwvvvvekvek.',
    '.kvvwvvwvvwvvwwwwkwwwvvvvekeek..',
    '..kvkvkvkvkvkvvvvwkkwvvvekkkk...',
    '...kk.kk.kk.kk.kkvvvkkkveekk....',
    '.................kkkvvvvkk......',
    '....................kkkk........',
    '................................',
  ],
  back: [
    '................................',
    '................................',
    '..kk............................',
    '.kwwk...........................',
    '.kwwwk..........................',
    '.kvwwwk.........................',
    '.kvwwwvk...........kkkkk........',
    '.kvvwwwvk.........kwwwwvk.......',
    '.kvvwwwwvk.......kwwwwwwvk......',
    '.kevvwwwwvk.....kwwwwwwwwvk.....',
    '.kevvvwwwwvk....kwwwwwwwwvk.....',
    '.keevvvwwwwvk...kwwwwwwwwvk.....',
    '.keeevvvwwwwvk..kwwwwwwwwvk.....',
    '..keevvvvwwwwvk.kwwwwwwwwvk.....',
    '..keeevvvvwwwwvkkkwwwwwwwkk.....',
    '...keeevvvvwwwwwkoooooookk......',
    '...kkeevvvvwwwwkoorrorroook.....',
    '....keeevvvwwwkorrorrroorrok....',
    '....keeevvwwwwkrrrooorrrrrok....',
    '....kkevwwwwwwkkrrrrrrrrrkk.....',
    '....kvvwwwwwwwwwkkrrrrrkkwvk....',
    '....kvvwwwwwwwwwwwkkkkkwwwwvk...',
    '...kvvvwwwwwwwwwwwwwwwwwwwwwvk..',
    '.kkkvvvvwwwwwwwwwwwwwwwwwwwwvvk.',
    'kvvkvvvvwwwwwwwwwwwwwwwwwwwvvvk.',
    'kevkevvvvwwwwwwwwwwwwwwwwwvvvvk.',
    'kevkeevvvvwwwwwwwwwwwwwwwvvvvvk.',
    'kkekkeevvvvvwwwwwwwwwwwwvvvvvk..',
    '.kkkkkeevvvvvvvvvvvvvvvvvvvkk...',
    '......kkeeevvvvvvvvvvvvvvkk.....',
    '........kkkkkkkkkkkkkkkkk.......',
    '................................',
  ],
};

S.Prismoth = {
  type: 'Glass/Gust', feature: 'dark glass wings with three translucent colour bands',
  palette: pal('kdniyowv'),
  heartmark: { x: 13, y: 13 },
  rows: [
    '................................',
    '................................',
    '................................',
    '.......k.........k..............',
    '......kwk.......kwk.............',
    '.....kwk.........kwk............',
    '.....kk.kkkk......kk.kkkk.......',
    '.....kddkkvvk....kkddddddkk.....',
    '....kdddddkkvk..kddddddddddk....',
    '...kddddddddkwvkdddddddddddk....',
    '..kdddiiidddkwvvkddiiiiiiddddk..',
    '..kddiiiidddkwvvkdiiiiiiiiidddk.',
    '.kdddiiiddddkwvvkdddddddddddddk.',
    '.kdddddddddkwvvvkddyyyyyyyyyddk.',
    '.kddyyyyddkwvvvvkdyyyyyyyyyydddk',
    '.kdyyyyyddkwvvvvkddddddddddddddk',
    '.kddddddddkwvvvvkddddooooooodddk',
    '.kddooodddkwvvvvkdddoooooooooddk',
    '..kdoooddddkvvkdddddddddddddddk.',
    '..kdddddddkkvvkkddddddddddddddk.',
    '...kdddddkdkvkdkdddddddddddddk..',
    '....kdddddkdvdkkddddddddddddk...',
    '.....kdddkkdvdkkkdddddddddddk...',
    '......kkkkkdvdk.kkddddddddddk...',
    '...........kvk....kkdddddddk....',
    '...........kvk......kkdddddk....',
    '...........kkk........kkkkk.....',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

S.Vesperay = {
  type: 'Brine/Glass', feature: 'glass eye panel on its back that brightens before it heals',
  palette: pal('knbsiwpd'),
  heartmark: { x: 10, y: 20 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...............kk...............',
    '..............kssk..............',
    '.............kssbbk.............',
    '....kk......kssbbnnk............',
    '...kssk....kssbbbbnnk...........',
    '...ksbbk..kssbbbbbbnnk..........',
    '...ksbbbkkssbbbbbbbbnnk.........',
    '..kssbbbsssbbbbbbbbbbnnk........',
    '..ksbbbbbbbbbbbbbbbbbbnnk.......',
    '..ksbbbbkkbbbbbkiikbbbbnnk......',
    '..ksbbbkwkbbbbkiwwikbbbbnnk.....',
    '..ksbbbkkkbbbbkiiiikbbbbbnnk....',
    '..ksbbbbbbbbbbbkiikbbbbbbnnnk...',
    '..knbbbbbbbbbbbbkkbbbbbbnnnnpk..',
    '..knnbbbbbbbbbbbbbbbbbbnnnnnppk.',
    '...knnnbbbbbbbbbbbbbbbnnnnnpppk.',
    '...kknnnnbbbbbbbbbbbbnnnnnpppkk.',
    '.....kknnnnnbbbbbbbnnnnnppppk...',
    '.......kknnnnnnnnnnnnnpppppk....',
    '.........kkknnnnnnnnppppppk.....',
    '............kkkkkkkkkppppkkkkk..',
    '.....................kkkkkkkppk.',
    '..........................kkkppk',
    '.............................kkk',
    '................................',
    '................................',
  ],
};

S.Wirewhisk = {
  type: 'Bolt', feature: 'copper spring-coil tail with a spark at the tip; hums when another creature is near',
  palette: pal('kyahorw'),
  heartmark: { x: 9, y: 19 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......................kyk......',
    '......................kkykk.....',
    '.....................koooork....',
    '.....................korrorok...',
    '.....................kkooookk...',
    '......................koroork...',
    '......................korrork...',
    '.........kk...........kkooork...',
    '........kyyk...........korrork..',
    '.......kyyyykk.........korrrok..',
    '......kyyyyyykkk.......kkooook..',
    '.....kyyyykyyyyakkk.....korork..',
    '....kyyykwkyyyyyyyakk...korrok..',
    '...kyyyykkkyyyyyyyyyakk.kkorok..',
    '..kyaayyyyyyyyyyyyyyyykkkorok...',
    '.kkaaaaayyyyyyyyyyyyyyykroook...',
    'kwkaaaaaayyyyyyyyyyyyyyykkook...',
    '.kkaaaaaaaaaaaayyyyyyyyaakkk....',
    '..kkaaaaaaaaaaaaaayyyyyaahk.....',
    '...kkaaahhhaaaaaaaaaaaaahhk.....',
    '.....khhk.khhaaaaaaaaahhhhk.....',
    '.....khhk..khhkkkkkkhhhhk.......',
    '....khhk...khhk....khhhk........',
    '....khhk...khhk....khhk.........',
    '....kkkk...kkkk....kkkk.........',
    '................................',
    '................................',
  ],
};

S.Vagary = {
  type: 'Star', feature: 'faceted crystal head with a cracked brow riding a ring of comet tail (the only m body)',
  palette: pal('kmpwi'),
  heartmark: { x: 10, y: 8 },
  heartmarkBack: { x: 21, y: 8 },
  rows: [
    '................................',
    '..........kk....................',
    '........kkiwkk..................',
    '......kkiiwwiikk................',
    '....kkiiiwkwiiiikk..............',
    '...kiiiiwkwwiiiiiik.............',
    '...kiiiwkwwwiiiiiik.............',
    '...kiiwkwwwiiiiiiik.............',
    '...kiwwwkwiiiiiiiik.............',
    '...kiiiiiiiiiiiiiik.............',
    '...kikkiiiiiikkiiikkkk..........',
    '...kiiiiiiiiiiiiiikmmmkkk.......',
    '....kiiiiiiiiiiiikmmmmmmmk......',
    '.....kkiiiiiiiiikwwwwmmmmmk.....',
    '.......kkiiiiikkwwwwwwwwmmmk....',
    '......kmmkkikk.kmmmmmmmwwwmmk...',
    '.....kmmmk.kk.w.kmmkkmmmwwmmmk..',
    '.....kmmk........kk..kkmmwwmmk..',
    '.....kmmk..............kmmwmmk..',
    '.....kmmk..............kmmwmmk..',
    '.....kmmk...............kppwmk..',
    '.....kppk..............kpppppk..',
    '.....kpppk.............kpppppk..',
    '.....kpppkk...........kppppppk..',
    '......kppppkk...kkkkkkppppppk...',
    '.......kpppppkkkpppppppppppk....',
    '........kpppppppppppppppppk.....',
    '.........kpppppppppppppppk......',
    '..........kkkpppppppppkkk.......',
    '.............kkkkkkkkk..........',
    '................................',
    '................................',
  ],
};

S.Brinelance = {
  type: 'Brine/Rime', feature: 'single long lance of rime on a lean, salt-crusted hunter',
  palette: pal('kbnsiwv'),
  heartmark: { x: 12, y: 17 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    'kk..............................',
    'kwkk............................',
    '.kwik...........................',
    '..kwik..........................',
    '...kwik.........kk..............',
    '....kwik.......kwvk..........kk.',
    '.....kwik.....kwwvk.........kvk.',
    '......kwik....kwvvvk.......kvbk.',
    '.......kwikkkkkvvvvvkk....kvbnk.',
    '.......kkiissssbbbbbbbkk.kvbnk..',
    '......ksskkssbbbbbbbbbbbkkvbnk..',
    '.....ksbbkwkbbbvbbbbvbbbbbbnk...',
    '.....ksbbkkkbbbbbbbbbbbbbbnnk...',
    '.....kbbbbbbbbbbbbbbbbbbbbnnnk..',
    '.....kkkkkkbbbbbbbbbbbbnnkknbnk.',
    '......kssssskbbbbbbbnnnkk.knbnk.',
    '.......kkkkkkknnbbnnnkk....knnk.',
    '............kbnbbnkk........kk..',
    '............kbbnnk..............',
    '.............kkkk...............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

S.Creelwight = {
  type: 'Hollow/Rust', feature: 'rusting iron creel with two lights inside; v rope ring until Empty Weave is spent',
  palette: pal('kdprovi'),
  heartmark: { x: 14, y: 10 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............kkkkkkk.............',
    '..........kkdddddddkk...........',
    '.........kddpdkpdkpddk..........',
    '........kddpkdpkdpkdddk.........',
    '.......kdpkdpkdpkdpkdddk........',
    '......kddpkdpkdpkdpkddddk.......',
    '......kdpkdpkdpkdpkdpkddrk......',
    '.....kddpkdpiidpiidpkddrrdk.....',
    '.....kdpkdpkiidkiidkdprkrdk.....',
    '.....kdpkdpkdpkdpkdpkdrrrdk.....',
    '....kddpkdpkdpkdpkdpkddrrrdk....',
    '....kvvvvvvvvvvvvvvvvvvvvvvvk...',
    '....kvvkkkkkkkkkkkkkkkkkkvvvk...',
    '...kdddpkdpkdpkdpkdpkdpkdrrrdk..',
    '...kdokpkdpkdpkdpkdpkdpkdrrrrk..',
    '...kdoopkdpkdpkdpkdpkdpkrrrrdk..',
    '...kdokpkdpkdpkdpkdpkdpkrrordk..',
    '...kdddpkdpkdpkdpkdpkdpkroordk..',
    '...kkdddkkkkkkkkkkkkkkkkrorrdk..',
    '....kdrrrrrrddddddddddrrrorrk...',
    '.....kkrrrrrdddddddddrrrrrkk....',
    '.......kkkkkkkkkkkkkkkkkkk......',
    '........pp..p.pp..p.p.pp........',
    '.........p....p......p..........',
    '................................',
    '................................',
    '................................',
  ],
};

S.Rimeplate = {
  type: 'Rime/Stone', feature: 'eight overlapping plates of rime over a stone body',
  palette: pal('kwisbned'),
  heartmark: { x: 6, y: 16 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '...........kkkkkkkkkk...........',
    '........kkkwiiwiiwiikkkk........',
    '......kkwiiskiiskiiskiiskk......',
    '.....kwiiskwiiskiiskiiskiik.....',
    '....kwiisskwiiskwiiskiiskiisk...',
    '...kwiissskwiisskiisskiisskiik..',
    '...kiisssbkwiisskwiisskiisskiik.',
    '..kwisssbbkiissbkwiisskwiisskisk',
    '..kiisssbbkiisssbkiisssbkiissbsk',
    '..kissssbbkiisssbkiisssbkiisssbk',
    '..kisssbbnkisssbbkiisssbkissssbk',
    '..ksssbbbnkisssbbkissssbkisssbbk',
    '..kssbbbnnksssbbnkisssbbkissbbbk',
    '..kkbbbnnnksssbbnksssbbbkssbbbnk',
    '.kekbbnnnnkssbbnnkssbbbnkssbbnnk',
    'kkekkknnnkksbbnnnkssbbnnkssbbnnk',
    'kwkekkkkkkkkkkkkkkkkkkkkkkkkkkkk',
    'kkkeeekeeeeeeeeeeeeeeeeeeeeeeek.',
    '.kkeedkedkeeeeeeeddkeeeeeeddkk..',
    '..kkkkkkkkkeeekeeekkeeekkeeekk..',
    '.........kkdkkkdkk.kkdk.kkdk....',
    '.........kkk.kkk...kkk..kkk.....',
    '................................',
    '................................',
    '................................',
  ],
};

S.Squallcoil = {
  type: 'Bolt/Brine', feature: 'storm krait with yellow bands that light in sequence before it strikes',
  palette: pal('knbsywo'),
  heartmark: { x: 6, y: 4 },
  rows: [
    '................................',
    '................................',
    '.....kkkkkk.....................',
    '...kksssbbbkk...................',
    '..kssbbbbbbbnk..................',
    '.kssbkkbbbbbnnk.................',
    '.ksbkwkbbbbbbnk.................',
    'kssbkkkbbbbbbnk.................',
    'ksbbbbbbbbbbbnk.................',
    'kkkkkkkkkbbbbnk.................',
    '.kbbbbbbbkbbnnk.................',
    '..kkkkkkkbbbnnk.................',
    '........kyyyonk.................',
    '........kyyyonk.................',
    '........kbbbbnk.................',
    '........kbbbbbnk................',
    '....kkkkkyyyyonkkkkkkk..........',
    '...ksssskyyyyonksssbbbkk........',
    '..kssbbbbkbbbbnkbbbbbbbbk.......',
    '..ksbbbbbbkbbbnnkbbbbbbbnk......',
    '..kbyyybbbbkkkkkbbbbyyybnk......',
    '..knyyyonbbbbbbbbbbbyyyonk......',
    '...knnnnnnbbbbbbbbbbbbnnk.......',
    '..kkkkkkkknnnnnnnnnnnnnkkkkkk...',
    '.kssbbbbbbkkkkkkkkkkkkkbbbbbnkk.',
    'kssbyyyybbbbbbbbyyyybbbbbbbnnnk.',
    'ksbbyyyyobbbbbbbyyyyobbbbbnnnnkw',
    'knbbbbbbbbbbbbbbbbbbbbbbbnnnkkw.',
    '.knnnbbbbbbbbbbbbbbbbbnnnnkkkkw.',
    '..kkknnnnnnnnnnnnnnnnnnkkk......',
    '.....kkkkkkkkkkkkkkkkkk.........',
    '................................',
  ],
};

S.Stillox = {
  type: 'Stone',
  feature: 'carved stone ox: withers hump, chisel-cut horns, fluted column legs with capital and base; the Mooring emblem',
  palette: pal('kwvedn'),
  heartmark: { x: 9, y: 13 },
  rows: [
    '................................',
    '................................',
    '...kk...........................',
    '..kwvk........kk................',
    '..kwvvk......kvek...............',
    '..kvvvvk....kkvekk..............',
    '...kvvvek.kkkvvekvkk............',
    '....kvvek.kvkvekvvvk............',
    '.....kvek.kkvekvvvvekkkkk.......',
    '..kkkkkkkkeeeeeeeeeeeeeeekkkkk..',
    '..kvvvvvveekeeeeeeeeeeeeeeeeek..',
    '.kevvvvvveekeeeeeeeeeeeeeeddddk.',
    '.kvvwkeeeeekeeeeeeeeeeeeeeddddk.',
    '.kvvkkeeeeekeeeeeeeeeeeeeeddddk.',
    '.kvveeeeeeekeeeeeeeeedddddddeek.',
    '.keeeeeeeeekeeeeeeeddddddddddk..',
    '.kekkekekddkeeeeeeeddddddddddk..',
    '..keeeeeeddkeeeeeeedddddddddddk.',
    '..keeeeeekdkeeeeeeeddddddddddk..',
    '..kkkkkkk.kdddddddddddddddddddk.',
    '..........kdddddddddddddddddddk.',
    '..........kkkkkkkkkkkkkkkkkkkkk.',
    '.......kkkkkkkkkkk..kkkkkkkkkkk.',
    '.......kvvvvvkkddk..kvvvvvkkddk.',
    '........kvevk.kddk...kvevk.kddk.',
    '........kvevk.kddk...kvevk.kddk.',
    '........kvevk.kddk...kvevk.kddk.',
    '........kvedk.kddk...kvedk.kddk.',
    '........kdedk.kddk...kdedk.kddk.',
    '.......kdddddkkddk..kdddddkkddk.',
    '.......kkkkkkkkkkk..kkkkkkkkkkk.',
    '................................',
  ],
};

S.Caldermaw = {
  type: 'Kiln/Stone',
  feature: 'a lava-lit maw in a stone skull: heavy brow, hollow socket with an ember eye, lava cracks down the back',
  palette: pal('kvednyor'),
  heartmark: { x: 8, y: 9 },
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '..................kkkkkkk.......',
    '................kkvvveeeekk.....',
    '..............kkvveeeeeeeedk....',
    '.....kkkkkkk.kvveeeyoeeeeeddk...',
    '...kkvvvvvvvkkveeeeeoeeeeedddk..',
    '..kvvvvveeeeekeeeeeeroeeeedddk..',
    '.kvvveeeeeeeekeeeeeeeoeeeeddddk.',
    'kvvvvvvvvveeeekeeeeeeroeeeddddk.',
    'kkkkkkkkkveeeekeeeeeeeoeeeddddk.',
    '.kndyokkkeeeeekeeeeeeeoreeddddk.',
    '.kknnnkkeeeeedkeeeeeeeeoeeddddk.',
    'kvkkkkeeeeeeddkeeeeeeeeoeedddnk.',
    'kveeeeeeeeeddkdeeeeeeeeoredddnk.',
    'kkvkvkkkvkkkkddeeeeeeeeeoedddnk.',
    '.koyyyooorrrkddeeeeeeeeeoedddnk.',
    '..kooyoorrrkkdddeeeeeeeeoddddnk.',
    '...kvoorrrkeddddddeeeeeedddnnk..',
    '...kkvkvkkkedddddddddddddddnnk..',
    '....keeeeeeekkkkkkkkkkkeeddnnk..',
    '.....kdddddk.keeddk...keedddnk..',
    '......kkkkkk.keeddk...keeddddnk.',
    '............kkeddddk..keeddddnk.',
    '............keeddddk.kkeeddddnk.',
    '...........kkkkkkkkk.kkkkkkkkkk.',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

S.Siltback = {
  type: 'Brine/Stone',
  feature: 'Sloshkin grown: a cairn of three silt-stone slabs piled on its back, bigger scalloped coral ruff, short tail raised behind',
  palette: pal('ksbnorve'),
  heartmark: { x: 10, y: 10 },
  rows: [
    '................................',
    '................................',
    '................................',
    '.................kkkkkkkk.......',
    '................kvvvvvvvekk.....',
    '...............kkeeeeeeeennk....',
    '.............kkkkkkkkkkkkkkkk...',
    '......kkkkkk.kvvvvvvvvvvvveek...',
    '....kksssssnkkeeeeeeeeeeeeeenk..',
    '...kssssbbbbnnkkkkkkkkkkkkkkkkk.',
    '..kssbbbbbbbbnnkvvvvvvvvvvvveenk',
    '..ksbbbbbbbbbbnnkeeeeeeeeeeeennk',
    '.ksbbkkbbbbbbbbnkkkkkkkkkkkkkkkk',
    '.ksbkvkkbbbbbbbbkooorkbbbbbnnnk.',
    '.ksbkkkkbbbbbbbkoorrrokbbbbnnnkk',
    '.ksbbkkbbbbbbbbkorroorkbbbbnnkbk',
    '.ksbbbbbbbbbbbbkoorrrrokbbbnnksk',
    '.knbbbbbbbbbbbnkorrooorkbbbnnksk',
    '.knnkkkkkkbbbnnkoorrrrokbbnnnkbk',
    '..knnnnnbbbbnnkoorroorkbbbnnkbnk',
    '...kknnnbbbnnkorrrrrokbbbbnnkbnk',
    '.....kkkoorrookoorrokkbbbbbnnbnk',
    '.......kkkkkkkkkkkkksbbbbbbnnnnk',
    '........ksbbbbbbbbbbbbbbbbbbnnnk',
    '.......ksbbbbbbbbbbbbbbbbbbbnnk.',
    '.......knbbbbbbbbbbbbbbbbbbnnnk.',
    '.......knnbkkkbbbbbbbbkkkbnnkk..',
    '........kknkbbbknnkbbbbknnkk....',
    '..........kbbbbknnkbbbbknnk.....',
    '..........kbbbbk.kkbbbbk.kk.....',
    '..........kkkkkk..kkkkkk........',
    '................................',
  ],
};

S.Bogmonarch = {
  type: 'Brine/Stone',
  feature: 'seated king toad: chunky stone crown, heavy brow, coral mane across the chest, webbed hands planted in front',
  palette: pal('ksbnorev'),
  heartmark: { x: 10, y: 9 },
  rows: [
    '................................',
    '................................',
    '.....kkkkk.kkkkkk.kkkkk.........',
    '.....kvvvk.kvvvvk.kvvvk.........',
    '.....keenkkkeeenkkkeenk.........',
    '.....kveeeeeeooeeeeeenk.........',
    '...kkkeeeeeeerreeeeeenkkkk......',
    '..kssskkkkkkkkkkkkkkkkkbbnkk....',
    '.kssbbbbnnnnnnnnnnnnnnnbbbnnk...',
    '.ksbnkkknbbbbbbbbbbbbbbbbbnnk...',
    '.ksbkkvkkbbbbbbbbbbbbbbbbbnnnk..',
    '.ksbkkkkkbbbbbbbbbbbbbbbbbnnnk..',
    '.ksbbkkkbbbbbbbbbbbbbbbbbbnnnk..',
    '.ksbbbbbbbbbbbbbbbbbbbbbbnnnnk..',
    '.kbkkkkkkkkkkkkkkkbbbbbbbnnnnk..',
    '.kbbbbbbbbbbbbbbbbbbbbbbnnnnnk..',
    '..koorrooorrooorrokbbbbbbnnnnk..',
    '.koooorroooorrooorkbbbbbbbnnnnk.',
    '.krroorrrrorrrrrrkbbsssbbbbnnnk.',
    '..krrkrrrrkrrrkbbsbbbbbbbbnnnnk.',
    '..kssbbbnbbbbbbbsbbbbbbbbbbnnnnk',
    '..ksbbbbnbbbbbbbsbbbbbbbbbbnnnnk',
    '..ksbbbbnbbbbbbsbbbbbbbbbbbnnnnk',
    '..ksbbbbnbbbbbbsbbbbbbbbbbnnnnnk',
    '..ksbbbnnbbbbbbsbbbbbbbbbnnnnnnk',
    '..ksbbbnnbbbbbbnbbbbbbbbnnnnnnk.',
    '.ksbbbbnnnbbbbbknbbbbbbnnnnnnnk.',
    'kssbbbbbnkknnnkkksbbbbbbbbbnnnk.',
    'ksbkbkbnk.kkk..ksbkbkbkbbbnnnk..',
    'kkkkkkkkk.....kkkkkkkkkkkkkkk...',
    '................................',
    '................................',
  ],
};

S.Lumenveil = {
  type: 'Glass', feature: 'a hanging veil of faceted skyglass under a small lamp core',
  palette: pal('kwistyv'),
  heartmark: { x: 14, y: 17 },
  rows: [
    '................................',
    '..............kk................',
    '.............kwwk...............',
    '............kwyywk..............',
    '............kwyywk..............',
    '.............kwwk...............',
    '............kkiikk..............',
    '...........kwiiiisk.............',
    '..........kwiiiiiisk............',
    '..........kwiiiiiissk...........',
    '.........kwiiikiiikssk..........',
    '.........kwiikwkiikwssk.........',
    '.........kwiiikiiiikssk.........',
    '........kwwiiiiiiiiisssk........',
    '........kiwwiiiiiiiissstk.......',
    '........kiiwwiiiiiisissstk......',
    '.......kwiiiwwiiiiisissttk......',
    '.......kiiiiiwwiiiissisttk......',
    '.......kiiiiiiwwiiisssttttk.....',
    '......kwiiiiiiiwwiisssttttk.....',
    '......kiiiiiiiiiiiissstttttk....',
    '......kiiwiiiiiiiisssstttttk....',
    '.....kwiiwwiiiiiiisssstttttk....',
    '.....kiiiiwwiiiiiissssttttttk...',
    '.....kiiikiiwwkiiiisskssktttk...',
    '.....kiikkiiikkiiiskkskkskttk...',
    '.....kiikkiiikkiiskk.kk.kkttk...',
    '.....kikk.kkk.kkkk...........k..',
    '......kk..................kkk...',
    '................................',
    '................................',
    '................................',
  ],
};

S.Mudfist = {
  type: 'Grit',
  feature: 'one oversized knuckled mud fist carried in front of a lumpy mud body; thumb folded across the front',
  palette: pal('kcahuw'),
  heartmark: { x: 16, y: 7 },
  rows: [
    '................................',
    '................................',
    '................................',
    '...............kkkkkk...........',
    '.............kkaaaaahkk.........',
    '...........kkaaaaaaaahhkk.......',
    '..........kaccaaaaaaaahhuk......',
    '.........kacaaaaaaaaaaahhuk.....',
    '.........kcakkaaaaakkaahhuuk....',
    '........kaaakwkaaakwkahhhuuk....',
    '........kaaakkkaaakkkahhhuuuk...',
    '........kahaaaaaaaaaahhhhuuuk...',
    '........kahhaakkkkaahhhhuuuuk...',
    '.......kachhhhhhhhhhhhhhukuuuk..',
    '.......kahhhhhhhhhhhhhhuuuuuuk..',
    '.kkk.kkkhkkkhkkkhhhhhhhuuuuuuuk.',
    'kcaakcaakcaakcaakhhuhhuuuuuuuuk.',
    'kaahkaahkaahkaahhkhhhhuuuuuuuuk.',
    'kahhkahhkahhkahhukhhhuuuuuuuuuk.',
    'kahhkahhkahhkhhhukhhhuuuhuuuuuk.',
    'khhukhhukhhukhhuukhhuuuuuuuuuuk.',
    'khhukhhukhhukhuuukhuuuuuuuuuuuk.',
    'khuukhuukhuukuuuukuuuuuuuuuuuk..',
    'kkkkkkkkkkkkkkuuukuuuuuukuuuuk..',
    'kcaaaaaaaaaaahkuukuuuuukkuuuk...',
    'kaaaaaaaaaaahhkukuuuuuk.kuuk....',
    'khhhhhhhhhhhhukkkuukuuk..kk.....',
    '.kkkkkkkkkkkkkk..kkkkk..........',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

S.Rushling = {
  type: 'Moss/Brine', feature: 'reed-and-cattail hat on a moss ball with webbed feet',
  palette: pal('klgtubw'),
  heartmark: { x: 12, y: 19 },
  rows: [
    '................................',
    '..................k.............',
    '.................kuk............',
    '................kuuuk...........',
    '................kuuuk...........',
    '.........k.......kuk............',
    '........kgk......ktk......k.....',
    '........kgk.k...klk....kkgk.....',
    '.........kgklk..klk...kggk......',
    '.........kggkgk.klk..kggk.......',
    '..........klggkkkgkkklk.........',
    '..........kklgglgggltkk.........',
    '.........kklgggggggggtkk........',
    '........kkggggggggggggttkk......',
    '.......klgggggggggggggggttk.....',
    '......klggkkgggggggggggggttk....',
    '.....klggkwkgggggggggggggttk....',
    '.....klggkkkgggggggggggggtttk...',
    '.....klgggggggggggggggggggttk...',
    '.....kltgggggggggggggggggtttk...',
    '.....ktttggggggggggggggggtttk...',
    '.....ktgttggggggggggggggttttk...',
    '......ktgtttggggggggggtttttk....',
    '......kktggttttgggggttttttkk....',
    '.......kkgggttttttttttttkkk.....',
    '........kkkttttttggtttkkk.......',
    '.....kkkkkkkkkkkkkkkkkkk........',
    '....kbbbbbbk....kbbbbbbk........',
    '...kbbbbbbbk...kbbbbbbbk........',
    '....kkkkkkk.....kkkkkkk.........',
    '................................',
    '................................',
  ],
};


// ---------------------------------------------------------------------------
// Derived frames
// ---------------------------------------------------------------------------
export function mirror(rows) {
  return rows.map((r) => r.split('').reverse().join(''));
}
/** Replace pixels: patches = [[x, y, ch], ...] */
export function patch(rows, patches) {
  const g = rows.map((r) => r.split(''));
  for (const [x, y, ch] of patches) g[y][x] = ch;
  return g.map((r) => r.join(''));
}
/** Like fillRect, but leaves pixels that touch transparency (the silhouette
 *  outline) alone, so a face can be filled in without opening the outline. */
function fillInner(rows, x0, y0, x1, y1, ch) {
  const at = (x, y) => (rows[y] && rows[y][x]) || '.';
  const ps = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (at(x, y) === '.') continue;
    if (at(x - 1, y) === '.' || at(x + 1, y) === '.' || at(x, y - 1) === '.' || at(x, y + 1) === '.') continue;
    ps.push([x, y, ch]);
  }
  return patch(rows, ps);
}
function fillRect(rows, x0, y0, x1, y1, ch) {
  const ps = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ps.push([x, y, ch]);
  return patch(rows, ps);
}

/** Remap palette keys inside rows: remap(rows, { b: 'd' }) */
export function remap(rows, map) {
  return rows.map((r) => r.replace(/./g, (ch) => map[ch] || ch));
}

// ---------------------------------------------------------------------------
// Star-touched Sloshkin (Brine/Star, ~2% Forecast replacement for the Side card).
// Same animal, same ruff, same mud: only the hide has gone comet-dusk. Body ramp
// moves from s/b/n to v/e/d (the Star badge grey) with an i eye glint. No m on the body (bible 3.5).
// ---------------------------------------------------------------------------
S.StarSloshkin = {
  type: 'Brine/Star', species: 'star-touched-sloshkin', displayName: 'Star-touched Sloshkin',
  feature: 'a Sloshkin whose hide has gone comet-dusk grey; coral ruff and mud unchanged',
  palette: pal('kvedoriu'),
  heartmark: { ...S.Sloshkin.heartmark },
  heartmarkBack: { ...S.Sloshkin.heartmarkBack },
  rows: remap(S.Sloshkin.rows, { b: 'e', s: 'v', n: 'd', w: 'i' }),
  back: remap(S.Sloshkin.back, { b: 'e', s: 'v', n: 'd', w: 'i' }),
};

// Back views. Hand-drawn for the six concept creatures above; derived for the
// rest: the front mirrored (so the creature faces up-right, away from the
// player) with its face filled back in with hide, the way the fliers were done.
// `FACE` rects are in FRONT coordinates: [x0, y0, x1, y1, fill].
S.Prismoth.back = patch(mirror(S.Prismoth.rows), []);
S.Prismoth.heartmarkBack = { x: 18, y: 13 };
S.Vesperay.back = fillRect(mirror(S.Vesperay.rows), 22, 15, 25, 17, 'b');
S.Vesperay.heartmarkBack = { x: 21, y: 20 };
S.Vagary.back = (() => {
  let r = mirror(S.Vagary.rows);
  // remove eyes + crack from the mirrored head (the back of the crystal is plain)
  const ps = [];
  for (let y = 2; y <= 15; y++) for (let x = 13; x <= 28; x++) {
    const ch = r[y][x];
    if (ch === 'k' && x > 13 && x < 28 && y > 2 && y < 15 && r[y][x - 1] !== '.' && r[y][x + 1] !== '.' && r[y - 1][x] !== '.' && r[y + 1][x] !== '.') ps.push([x, y, 'i']);
    if (ch === 'w') ps.push([x, y, 'i']);
  }
  r = patch(r, ps);
  // a soft back highlight
  return patch(r, [[23, 4, 'w'], [24, 5, 'w'], [24, 6, 'w'], [25, 6, 'w']]);
})();

const FACE = {
  Puddlepip: [[10, 15, 12, 17, 'b'], [16, 15, 18, 17, 'b']],
  Chillnub: [[4, 18, 10, 20, 's', 1], [6, 22, 7, 22, 's', 1]],
  Mudfist: [[11, 8, 21, 10, 'a', 1], [13, 12, 18, 12, 'a', 1]],
  Rushling: [[9, 15, 11, 17, 'g']],
  Lumenveil: [[13, 10, 15, 12, 'i'], [18, 10, 19, 12, 'i']],
  Siltback: [[3, 12, 7, 15, 'b', 1], [3, 18, 9, 18, 'n', 1]],
  Bogmonarch: [[3, 9, 8, 12, 'b', 1], [3, 14, 17, 14, 'b', 1]],
  Sedgehare: [[5, 15, 8, 18, 'g'], [9, 19, 14, 24, 'g']], // eye, then the belly patch (front only)
  Wirewhisk: [[8, 16, 10, 18, 'y'], [1, 21, 1, 21, 'k']], // eye, nose glint
  Squallcoil: [[4, 5, 6, 7, 'b', 1], [1, 9, 8, 9, 'b', 1]],
  Stillox: [[4, 12, 5, 13, 'e'], [3, 16, 8, 16, 'e'], [2, 17, 2, 17, 'e']],
  Caldermaw: [[1, 12, 7, 15, 'e', 1], [1, 16, 11, 18, 'e', 1], [1, 19, 11, 21, 'd', 1]], // socket and maw face away
  Brinelance: [[9, 16, 11, 18, 'b', 1], [6, 20, 10, 20, 'b', 1]],
  Rimeplate: [],
  Tossup: [],
  Creelwight: [],
};
for (const [name, rects] of Object.entries(FACE)) {
  let r = S[name].rows;
  for (const [x0, y0, x1, y1, ch, inner] of rects) r = (inner ? fillInner : fillRect)(r, x0, y0, x1, y1, ch);
  S[name].back = mirror(r);
  const h = S[name].heartmark;
  S[name].heartmarkBack = { x: 31 - h.x, y: h.y };
}
// Marks that sit on a chest or face have no exact back equivalent (bible 4.3:
// "nearest equivalent"): move those to the nape.
S.Sedgehare.heartmarkBack = { x: 22, y: 14 };
S.Wirewhisk.heartmarkBack = { x: 18, y: 19 };
S.Tossup.heartmarkBack = { x: 17, y: 8 };
S.Scrapling.heartmarkBack = { x: 14, y: 12 };

// Second idle frames: grounded forms squash-breathe, fliers hover.
const SQUASH = { Sloshkin: 26, StarSloshkin: 26, Scrapling: 26, Tossup: 23, Sedgehare: 27, Wirewhisk: 26, Rimeplate: 26,
  Squallcoil: 23, Stillox: 29, Caldermaw: 23, Siltback: 25, Bogmonarch: 27, Mudfist: 27, Rushling: 26,
  Chillnub: 27, Puddlepip: 22 };
const HOVER = ['Skeinwing', 'Prismoth', 'Vesperay', 'Vagary', 'Lumenveil', 'Creelwight', 'Brinelance'];
for (const [name, line] of Object.entries(SQUASH)) {
  S[name].idle2 = squash(S[name].rows, line);
  const h = S[name].heartmark;
  S[name].heartmarkIdle2 = { x: h.x, y: h.y < line ? h.y + 1 : h.y };
}
for (const name of HOVER) {
  S[name].idle2 = hover(S[name].rows);
  const h = S[name].heartmark;
  S[name].heartmarkIdle2 = { x: h.x, y: h.y - 1 };
}
// Skeinwing's Featherbed tell: a variant with the near-wing fringe flattened.
S.Skeinwing.fringeFlat = S.Skeinwing.rows.map((r, y) => (y === 27 ? '..kvvvvvvvvvvvvvvwkkwvvvekkkk...' : y === 28 ? '...kkkkkkkkkkkkkkvvvkkkveekk....' : r));

export const ORDER = ['Sloshkin', 'Skeinwing', 'Scrapling', 'Prismoth', 'Vesperay', 'Vagary', 'Brinelance', 'Creelwight',
  'Sedgehare', 'Wirewhisk', 'Rimeplate', 'Squallcoil', 'Tossup', 'Stillox', 'Caldermaw',
  'Siltback', 'Bogmonarch', 'Lumenveil', 'Mudfist', 'Rushling', 'Puddlepip', 'Chillnub', 'StarSloshkin'];

export const SPRITES = S;
export default SPRITES;

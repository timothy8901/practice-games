/**
 * @file Harbor tileset as palette-indexed string art (pure data, no DOM).
 *
 * Every tile is `{ w, h, frames: string[][], pal: Record<char, colorName> }`.
 * `frames[i]` is an array of `h` strings of `w` chars; `.` is transparent, every
 * other char indexes `pal`, whose values are names in `COLORS`. Names that start
 * with `!` are LUT-exempt (lamps, bioluminescence, skyglass): they keep full
 * colour at night. Light comes from the top-left everywhere; shadows lean
 * blue-violet, highlights lean warm cream; darkest colour is night ink.
 */

export const TILE = 16;

/** Master colours used by the tiles (names → hex). No pure black / white. */
export const COLORS = {
  ink: '#141B33', deep: '#2B3A67', uiink: '#2A2433', cream: '#F6F1E3',
  // grass
  grass0: '#2E5A48', grass1: '#3F7A5A', grass2: '#5E9E6A', grass3: '#7DB874', grass4: '#A8D5A2',
  // sand / wet sand
  sand0: '#A98B64', sand1: '#C9A77C', sand2: '#E8D3A0', sand3: '#F4E8C1',
  wet0: '#6E5A44', wet1: '#8C7352', wet2: '#A98B64',
  // mud
  mud0: '#5A4A3E', mud1: '#7D6A58', mud2: '#A8927C',
  wmud0: '#43392F', wmud1: '#5A4E44', wmud2: '#6E6456', skyref: '#6E8CA8', skyref2: '#B8CFE0',
  gmud0: '#1E2B4A', gmud1: '#2B3A67',
  '!bio0': '#1F8F8A', '!bio1': '#3FF2E0', '!bio2': '#9FE8C8',
  // water
  deep0: '#173B5E', deep1: '#1F4F7A', deep2: '#2A6F8F', deep3: '#3FA7D6',
  sh0: '#2A6F8F', sh1: '#3A8FA8', sh2: '#4FB3C9', sh3: '#7EC4CF', dapple: '#9FD3C0',
  riv0: '#2A6F8F', riv1: '#3A8FA8', riv2: '#4FB3C9', riv3: '#9FD3C0',
  foam: '#EAF2F8',
  // stone / cliff
  st0: '#2A2F44', st1: '#4F5A6B', st2: '#6E7A86', st3: '#8E9AA6', st4: '#B8CFE0',
  cl0: '#2A2433', cl1: '#4A3E44', cl2: '#6E5A58', cl3: '#8C7A6E', cl4: '#A8927C',
  // ground
  pa0: '#8E6B45', pa1: '#B08A5E', pa2: '#C9A77C', pa3: '#D9C19A',
  co0: '#4E4A5A', co1: '#6B6672', co2: '#8E8A86', co3: '#ABA6A0', co4: '#C4BFB6',
  // wood / building
  wd0: '#4E3620', wd1: '#7A5A36', wd2: '#A5794B', wd3: '#C9A16B', wd4: '#E0BE86',
  pl0: '#B8A88A', pl1: '#D6C8A6', pl2: '#EADFC4', pl3: '#F4E8C1',
  br0: '#6E2E24', br1: '#8A4432', br2: '#A8553C', br3: '#C27050',
  pane0: '#3B4A6B', pane1: '#6E8CA8', '!wglow': '#F6D8AE', '!amber': '#F9C46B',
  '!lampcore': '#FFE29A', '!lhamber': '#FFB547', brass: '#D9A441', iron: '#3B3A48',
  // roofs: [dark, shade, base, light]
  slate0: '#2F3A4C', slate1: '#3F4D60', slate2: '#5B6B7E', slate3: '#7A8CA0',
  red0: '#6E2E24', red1: '#8A3426', red2: '#B5452E', red3: '#D1664A',
  moss0: '#2E5A48', moss1: '#3F6B44', moss2: '#5E8C5A', moss3: '#7FA86A',
  blue0: '#1E3350', blue1: '#2B466B', blue2: '#3B5F8C', blue3: '#5B82B0',
  straw0: '#7A5A36', straw1: '#B08A42', straw2: '#D9B46A', straw3: '#EBD08A',
  dark0: '#1C1A28', dark1: '#2A2433', dark2: '#3B3A48', dark3: '#54526A',
  // flora
  pine0: '#1F4A3C', pine1: '#2E5A48', pine2: '#3F7A5A', pine3: '#5E9E6A',
  ald0: '#3F7A5A', ald1: '#5E9E6A', ald2: '#7DB874', ald3: '#A8D5A2', aldbark0: '#5A4A3E', aldbark1: '#8C7A6E', aldbark2: '#B8A88A',
  fr0: '#2E5A48', fr1: '#4F8A52', fr2: '#6BAA75', fr3: '#8FC27C', pear: '#F3C178', pear2: '#FFE29A', pear0: '#B08A42',
  blossom: '#F2A7B5', blossom2: '#E07A9A', marigold: '#F28C28', petal: '#F6F1E3', yellow: '#FFE29A',
  // skyglass (the only magenta in the world) & waystone rune
  '!m0': '#8E2D80', '!m1': '#E04FC0', '!m2': '#F6A6E8', '!rune': '#73EFF7', '!runew': '#F6F1E3',
  shadow: '#2B3A67',
};

export const ROOF_COLOURS = ['slate', 'red', 'moss', 'blue', 'straw', 'dark'];

const tiles = {};
function def(name, pal, frames, w = TILE, h = TILE) {
  if (!Array.isArray(frames[0])) frames = [frames];
  for (const f of frames) {
    if (f.length !== h) throw new Error(`tile ${name}: ${f.length} rows, want ${h}`);
    f.forEach((r, i) => {
      if (r.length !== w) throw new Error(`tile ${name} row ${i}: ${r.length} cols, want ${w}: "${r}"`);
      for (const ch of r) if (ch !== '.' && !(ch in pal)) throw new Error(`tile ${name}: char '${ch}' missing from palette`);
    });
  }
  for (const v of Object.values(pal)) if (!(v in COLORS)) throw new Error(`tile ${name}: unknown colour ${v}`);
  tiles[name] = { name, w, h, frames, pal };
  return tiles[name];
}

/* ------------------------------------------------------------------ grass */
const GP = { g: 'grass2', d: 'grass1', l: 'grass3', k: 'grass0', h: 'grass4' };
def('grass_a', GP, [
  'gggggggggggggggg',
  'gggggggggglggggg',
  'ggdggggggggggggg',
  'ggdggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggdgg',
  'ggggglggggggggg g'.replace(' ', ''),
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggdgggggg',
  'ggggggggdlgggggg',
  'glgggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggglggg',
  'ggggdggggggggggg',
  'gggggggggggggggg',
]);
def('grass_b', GP, [
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggggggggggdggg',
  'gglggggggggggggg',
  'gggggggggggggggg',
  'gggggggdgggggggg',
  'gggggggdgggggggg',
  'gggggggggggggggg',
  'ggggggggggglgggg',
  'gggggggggggggggg',
  'ggdggggggggggggg',
  'gggggggggggggggg',
  'ggggggglgggggdgg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggdggggggggggg',
]);

// Tall grass: tufts with a darker-green outline over visible ground; 3 sway frames.
const TG = { g: 'grass2', o: 'grass0', b: 'grass1', m: 'grass3', h: 'grass4', d: 'grass1' };
def('tallgrass', TG, [[
  'ggggghgggggggggg',
  'ggggbogggggghggg',
  'gghgboggggggbggg',
  'ggobmobggggbogmg',
  'ggobbbobgggobbog',
  'ggobbbbogggobbog',
  'gggooooogggooogg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggghggggg',
  'gghggggggobogggg',
  'ggbogggghobbogmg',
  'gobmogggobbbobog',
  'gobbogggobbbbbog',
  'gobbogggoobbbogg',
  'ggooggggggooogg g'.replace(' ', ''),
], [
  'ggggggggggggggg g'.replace(' ', ''),
  'gggghoggggggghgg',
  'ggghboggggggbogg',
  'ggobmobgggggbomg',
  'ggobbbobgggobbog',
  'ggobbbbogggobbog',
  'gggooooogggooogg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggghggggggghgggg',
  'ggbogggghgobogmg',
  'gobmoggggobbbobg',
  'gobbogggobbbbbog',
  'gobbogggoobbbogg',
  'ggooggggggooogg g'.replace(' ', ''),
], [
  'ggggggggggggggg g'.replace(' ', ''),
  'ggggbhgggggggggg',
  'gggghoggggghgggg',
  'ggobmobgggggbomg',
  'ggobbbobgggobbog',
  'ggobbbbogggobbog',
  'gggooooogggooogg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggghggg',
  'ggggggggggggbogg',
  'ggbhggggggobbogg',
  'gobmogggghbbbobg',
  'gobbogggobbbbbog',
  'gobbogggoobbbogg',
  'ggooggggggooogg g'.replace(' ', ''),
]]);

/* --------------------------------------------------------- sand / mud */
const SP = { s: 'sand2', d: 'sand1', l: 'sand3', k: 'sand0' };
def('sand', SP, [
  'ssssssssssssssss',
  'ssssssssssdsssss',
  'sslsssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssls',
  'sssssdssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'sssssssssslsssss',
  'ssdsssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'ssssssssssssdsss',
  'sssslsssssssssss',
  'ssssssssssssssss',
  'ssssssssssssssss',
]);
const WSP = { s: 'wet1', d: 'wet0', l: 'wet2' };
def('wetsand', WSP, [
  'ssssssssssssssss',
  'sssssssssslsssss',
  'ssdsssssssssssss',
  'ssssssssssssssss',
  'sssssssssssssdss',
  'ssssslsssssssdss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'sdsssssssssslsss',
  'ssssssssssssssss',
  'ssssssssdsssssss',
  'ssssssssssssssss',
  'ssslsssssssssdss',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'sssssdssssssssss',
]);
// Dry mud flat: cracked plates.
const MP = { m: 'mud1', d: 'mud0', l: 'mud2' };
def('mud_dry', MP, [
  'mmmmmmdmmmmmmmmm',
  'mlmmmmdmmmmmmmlm',
  'mmmmmmdmmmdmmmmm',
  'dddmmmmdddmmmmmm',
  'mmmdddmmmmmmmmmm',
  'mmmmmmmmmmmmmdmm',
  'mmlmmmmmmmmmmdmm',
  'mmmmmmmmmlmmdmmm',
  'mmmmmmdddddddmmm',
  'mmmmmdmmmmmmmmmm',
  'mmmmdmmmmmmmmmmm',
  'mmmmdmmlmmmmmmmm',
  'dddddmmmmmmmmddd',
  'mmmmmmmmmmmdddmm',
  'mlmmmmmmmmdmmmmm',
  'mmmmmmmmmmdmmmlm',
]);
// Wet mud: dark, with 2-px sky-reflection streaks.
const WMP = { m: 'wmud1', d: 'wmud0', l: 'wmud2', r: 'skyref', b: 'skyref2' };
def('mud_wet', WMP, [
  'mmmmmmmmmmmmmmmm',
  'mmlmmmmmmmmrrmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmmmmmmmm',
  'mrrmmmmmmmmmmlmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmrbmmmmmm',
  'mmmmmmmmmmmmmmdm',
  'mmmmdmmmmmmmmmmm',
  'mmmmmmmmmmmmrrmm',
  'mmlmmmmmmmmmmmmm',
  'mmmmmmrrmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmlmmm',
  'mrrmmmmmdmmmmmmm',
  'mmmmmmmmmmmmmmmm',
]);
// Glowing night mud: three-frame cycle of bioluminescent specks. LUT-exempt glow chars.
const GMP = { m: 'gmud1', d: 'gmud0', a: '!bio1', b: '!bio2', c: '!bio0' };
def('mud_glow', GMP, [[
  'mmmmmmmmmmmmmmmm',
  'mmammmmmmmmbbmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmmmmmmmm',
  'mcammmmmmmmmmbmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmaammmmmm',
  'mmmmmmmmmmmmmmdm',
  'mmmmdmmmmmmmmmmm',
  'mmmmmmmmmmmmccmm',
  'mmbmmmmmmmmmmmmm',
  'mmmmmmbammmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmammm',
  'mcbmmmmmdmmmmmmm',
  'mmmmmmmmmmmmmmmm',
], [
  'mmmmmmmmmmmmmmmm',
  'mmbmmmmmmmmaammm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmmmmmmmm',
  'mabmmmmmmmmmmcmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmbbmmmmmm',
  'mmmmmmmmmmmmmmdm',
  'mmmmdmmmmmmmmmmm',
  'mmmmmmmmmmmmaamm',
  'mmcmmmmmmmmmmmmm',
  'mmmmmmabmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmbmmm',
  'mbammmmmdmmmmmmm',
  'mmmmmmmmmmmmmmmm',
], [
  'mmmmmmmmmmmmmmmm',
  'mmcmmmmmmmmccmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmmmmmmmm',
  'mbcmmmmmmmmmmamm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmccmmmmmm',
  'mmmmmmmmmmmmmmdm',
  'mmmmdmmmmmmmmmmm',
  'mmmmmmmmmmmmbbmm',
  'mmammmmmmmmmmmmm',
  'mmmmmmcbmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmcmmm',
  'macmmmmmdmmmmmmm',
  'mmmmmmmmmmmmmmmm',
]]);

/* ------------------------------------------------------------- water */
// One 4-frame wavelet set, three palettes (deep / shallow / river).
const WAVES = [[
  'wwwwwwwwwwwwwwww',
  'wwhhhwwwwwwwwwww',
  'wwwkkwwwwwwhhwww',
  'wwwwwwwwwwwwkwww',
  'wwwwwwwwpwwwwwww',
  'wwwwwwwwwwwwwwww',
  'whhwwwwwwwwwwwpw',
  'wwkwwhhhhwwwwwww',
  'wwwwwwkkwwwwwwww',
  'wwwwwwwwwwwwhhww',
  'wwpwwwwwwwwwwkww',
  'wwwwwwwwwwwwwwww',
  'wwwwhhwwwwwwwwww',
  'wwwwwkwwwwhhhwww',
  'wwwwwwwpwwwwkwww',
  'wwwwwwwwwwwwwwww',
], [
  'wwwwwwwwwwwwwwww',
  'wwwhhhwwwwwwwwww',
  'wwwwkkwwwwwwhhww',
  'wwwwwwwwwwwwwkww',
  'wwwwwwwwpwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwhhwwwwwwwwwwpw',
  'wwwkwwhhhwwwwwww',
  'wwwwwwwkkwwwwwww',
  'wwwwwwwwwwwwwhhw',
  'wwpwwwwwwwwwwwkw',
  'wwwwwwwwwwwwwwww',
  'wwwwwhhwwwwwwwww',
  'wwwwwwkwwwwwhhww',
  'wwwwwwwpwwwwwkww',
  'wwwwwwwwwwwwwwww',
], [
  'wwwwwwwwwwwwwwww',
  'wwwwhhwwwwwwwwww',
  'wwwwwkwwwwwwwhww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwpwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwhwwwwwwwwwwpw',
  'wwwwwwwhhwwwwwww',
  'wwwwwwwwkwwwwwww',
  'wwwwwwwwwwwwwwhh',
  'wwpwwwwwwwwwwwwk',
  'wwwwwwwwwwwwwwww',
  'wwwwwwhwwwwwwwww',
  'wwwwwwwwwwwwwhww',
  'wwwwwwwpwwwwwwww',
  'wwwwwwwwwwwwwwww',
], [
  'wwwwwwwwwwwwwwww',
  'whhhhwwwwwwwwwww',
  'wwkkwwwwwwwhhhww',
  'wwwwwwwwwwwwkkww',
  'wwwwwwwwpwwwwwww',
  'wwwwwwwwwwwwwwww',
  'hhhwwwwwwwwwwwpw',
  'wkkwwhhhhhwwwwww',
  'wwwwwwkkkwwwwwww',
  'wwwwwwwwwwwhhhww',
  'wwpwwwwwwwwwkkww',
  'wwwwwwwwwwwwwwww',
  'wwwhhhwwwwwwwwww',
  'wwwwkkwwwwhhhhww',
  'wwwwwwwpwwwwkkww',
  'wwwwwwwwwwwwwwww',
]];
def('water_deep', { w: 'deep1', h: 'deep2', k: 'deep0', p: 'deep1' }, WAVES);
def('water_shallow', { w: 'sh2', h: 'sh3', k: 'sh1', p: 'dapple' }, WAVES);
// River: vertical flow streaks that slide downstream (rows rotate 4 per frame → seamless).
const RIVROWS = [
  'rrrrrrrrrrrrrrrr',
  'rrsrrrrrrrrrrrrr',
  'rrsrrrrrrrrdrrrr',
  'rrsrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrdrrrrrrsrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrsrrrrrrr',
  'rrrrrrrrsrrrrrrr',
  'rrdrrrrrsrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrsrrrrrrdrrrr',
  'rrrrsrrrrrrrrrrr',
  'rrrrsrrrrrrrrrrr',
];
const rot = (rows, n) => rows.map((_, i) => rows[(i - n + rows.length) % rows.length]);
def('river', { r: 'riv1', s: 'riv3', d: 'riv0' }, [0, 4, 8, 12].map((n) => rot(RIVROWS, n)));

// Foam edges where water meets land (3-frame palette cycle via shape change). N edge; others rotated in render.
const FP = { f: 'foam', s: 'sh3' };
def('foam_n', FP, [[
  'ffffffffffffffff',
  'sffsssffffsssffs',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], [
  'ffffffffffffffff',
  'ffsssffssfffssff',
  '.s....s....s....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], [
  'ffffffffffffffff',
  'sssffsssfffsssff',
  '....s.........s.',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]]);

// Tide pool: rock lip around still water with glints.
def('tidepool', { r: 'st2', d: 'st1', l: 'st3', w: 'sh1', g: 'dapple', k: 'st0', s: 'wet1' }, [
  'ssssdrrrrrrdssss',
  'ssdrrlllrrrrrdss',
  'sdrlwwwwwwwwrrds',
  'sdrwwwwwwwgwwrds',
  'drlwwwwwwwwwwrkd',
  'drwwgwwwwwwwwwkd',
  'drwwwwwwwwwwwwkd',
  'drwwwwwwwwwwwgkd',
  'drwwwwwwwwwwwwkd',
  'drlwwgwwwwwwwrkd',
  'sdrwwwwwwwwwrrks',
  'sdrrwwwwwgwwrkds',
  'ssdrrlwwwwrrkdss',
  'sssdrrrrrrrkdsss',
  'ssssdkkkkkkdssss',
  'ssssssssssssssss',
]);

// Stepping stone exposed (on river) / submerged.
const STP = { r: 'riv1', s: 'riv3', k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', f: 'foam' };
def('stepstone', STP, [
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrdmmmmdrrrrr',
  'rrrsdmlhhlmmdrrr',
  'rrsdmlhmmmmmmdrr',
  'rrdmlmmmmmmmmkrr',
  'rrdmmmmmmmmmmkrr',
  'rrdmmmmmmmmmdkrr',
  'rrkdmmmmmmmdkkrr',
  'rrrkkdmmmddkkrrr',
  'rrrfkkkkkkkkfrrr',
  'rrrrffrrrrffrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
]);
def('stepstone_sub', { r: 'riv1', s: 'riv3', m: 'sh1', d: 'riv0', f: 'foam' }, [
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrddddddrrrrr',
  'rrrrdmmmmmmdrrrr',
  'rrrdmmmmmmmmdrrr',
  'rrsdmmmmmmmmdrrr',
  'rrrdmmmmmmmmdsrr',
  'rrrdmmmmmmmmdrrr',
  'rrrrdmmmmmmdrrrr',
  'rrrrrddddddrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
]);
// Causeway: cut stone blocks across the sea; exposed / awash.
const CWP = { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', w: 'sh2', f: 'foam' };
def('causeway', CWP, [
  'wwfwwwwwwwwwfwww',
  'kkkkkkkkkkkkkkkk',
  'lmmmmmmdlmmmmmmd',
  'lmmmmmmdlmmmmmmd',
  'mmmmmmmdmmmmmmmd',
  'ddddddddddddddd d'.replace(' ', ''),
  'mmmdlmmmmmmdlmmm',
  'mmmdlmmmmmmdlmmm',
  'mmmdmmmmhmmdmmmm',
  'dddddddddddddddd',
  'lmmmmmmdlmmmmmmd',
  'lmmmmmmdlmmmmmmd',
  'mmmmhmmdmmmmmmmd',
  'ddddddddddddddd d'.replace(' ', ''),
  'kkkkkkkkkkkkkkkk',
  'wwwwfwwwwwwwwwfw',
]);
def('causeway_sub', { w: 'sh2', d: 'sh1', m: 'sh0', f: 'foam', s: 'sh3' }, [
  'wwwwwwwwwwwwwwww',
  'wfffwwwwwfffwwww',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dddddddddddddddd',
  'mmmdmmmmmmmdmmmm',
  'mmmdmmmmmmmdmmmm',
  'mmmdmmmmmmmdmmmm',
  'dddddddddddddddd',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dddddddddddddddd',
  'wwwwfffwwwwwwfff',
  'wwwwwwwwwwwwwwww',
]);

/* ---------------------------------------------------------- cliffs */
// Cliff face: 16px tall, strata, dark base line, lit top lip.
const CP = { k: 'cl0', d: 'cl1', m: 'cl2', b: 'cl3', l: 'cl4', g: 'grass1' };
def('cliff_face', CP, [
  'gggggggggggggggg',
  'llllllllllllllll',
  'bbbblbbbbbbblbbb',
  'bbbbbbbmbbbbbbbb',
  'mbbbbbbmbbbbbbbm',
  'mmbbbbmmbbbbbbbm',
  'mmmbbbmmmbbbbmmm',
  'dmmmmmmmmbbbmmmm',
  'dmmmdmmmmmmmmmmd',
  'dmmmdmmmdmmmmmmd',
  'ddmmdmmmdmmmdmdd',
  'ddddmmmdddmmdddd',
  'kdddddddddddddkd',
  'kkdddkkddddkkkkd',
  'kkkkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
]);
// Rim overlays for cliff-top edges (drawn over grass): lit west/north edge, shaded east edge.
def('cliff_rim_w', { l: 'cl4', d: 'cl2' }, Array.from({ length: 16 }, () => 'ld..............'));
def('cliff_rim_e', { k: 'cl0', d: 'cl1' }, Array.from({ length: 16 }, () => '..............dk'));
def('cliff_rim_n', { l: 'cl4', d: 'cl2' }, ['llllllllllllllll', 'dddddddddddddddd', ...Array.from({ length: 14 }, () => '................')]);
// Ledge (one-way): grass above, light lip, 2px shadow, chevron notch.
def('ledge', { g: 'grass2', y: 'sand3', l: 'cl4', m: 'cl2', d: 'cl1', k: 'cl0', s: 'grass0' }, [
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
  'yyyyyyyyyyyyyyyy',
  'llllllllllllllll',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmdmmdmmmmmm',
  'dmmmmmmddmmmmmmd',
  'ddmmmmmmmmmmmmdd',
  'kkkkkkkkkkkkkkkk',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'gggggggggggggggg',
]);

/* ----------------------------------------------------- paths & floors */
def('path', { p: 'pa1', d: 'pa0', l: 'pa2', h: 'pa3' }, [
  'pppppppppppppppp',
  'pplppppppppdpppp',
  'pppppppppppppppp',
  'ppppppphpppppppp',
  'pdpppppppppppppp',
  'pppppppppppplppp',
  'pppppppppppppppp',
  'pppplpppdppppppp',
  'pppppppppppppppp',
  'pppppppppppppppp',
  'pdpppppppppppphp',
  'pppppppplppppppp',
  'pppppppppppppppp',
  'pppppppppppdpppp',
  'pplppppppppppppp',
  'pppppppppppppppp',
]);
def('cobbles', { c: 'co2', d: 'co1', g: 'co0', l: 'co3', h: 'co4' }, [
  'lcccdlcccdlcccdg',
  'cccccccccccccccg',
  'cccdcccccdcccccg',
  'dddgddddgdddddgg',
  'ldlcccdlcccdlccc',
  'cgcccccccccccccc',
  'cgccccdccccdcccc',
  'dgdddgddddgddddg',
  'lcccdlcccdlcccdg',
  'cccccccccccchccg',
  'cccdccccccdccccg',
  'dddgddddgdddddgg',
  'ldlcccdlcccdlccc',
  'cgcccccccccccccc',
  'cgccccdccccdcccc',
  'dgdddgddddgddddg',
]);
// Pier planks (running N-S) with gaps showing dark water; posts on the end tile.
const PP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'wd0', w: 'deep0', g: 'wd1' };
def('pier', PP, [
  'lppplppwlppplppw',
  'pppppppwpppppppw',
  'pppdpppwppppdppw',
  'pppppppwpppppppw',
  'ppppppdwpppppppw',
  'pdpppppwpdpppppw',
  'pppppppwpppppppw',
  'ppppdppwppppdppw',
  'pppppppwpppppppw',
  'pppppppwppdppppw',
  'pppdpppwpppppppw',
  'pppppppwpppppppw',
  'ppppppdwpppppppw',
  'pdpppppwpdpppppw',
  'pppppppwpppppppw',
  'kkkkkkkwkkkkkkkw',
]);
def('pier_end', PP, [
  'kkkkkkkkkkkkkkkk',
  'lppplppwlppplppw',
  'pppppppwpppppppw',
  'pppdpppwppppdppw',
  'pppppppwpppppppw',
  'ppppppdwpppppppw',
  'pdpppppwpdpppppw',
  'pppppppwpppppppw',
  'ppppdppwppppdppw',
  'pppppppwpppppppw',
  'pppppppwppdppppw',
  'pppdpppwpppppppw',
  'pppppppwpppppppw',
  'kkkkkkkwkkkkkkkw',
  'lkk...........kk'.replace(/\./g, 'w').slice(0, 16),
  'dkkwwwwwwwwwwwkk',
]);

/* ------------------------------------------------------- buildings */
const WP = { p: 'pl2', s: 'pl1', d: 'pl0', h: 'pl3', t: 'wd1', k: 'wd0' };
def('wall_timber', WP, [
  'tttttttttttttttt',
  'hppppppppppppppd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hpppppppppppppsd',
  'hssssssssssssssd',
  'kkkkkkkkkkkkkkkk',
]);
def('wall_timber_x', WP, [
  'tttttttttttttttt',
  'hppppppppppppppd',
  'htpppppppppppptd',
  'hptppppppppppsts'.slice(0, 15) + 'd',
  'hpptpppppppptpsd',
  'hppptppppppptpsd',
  'hpppptppppptppsd',
  'hppppptppptpppsd',
  'hpppppptttppppsd',
  'hppppptppptpppsd',
  'hpppptppppptppsd',
  'hppptppppppptpsd',
  'hpptpppppppppsts'.slice(0, 15) + 'd',
  'hptppppppppppptd',
  'htsssssssssssstd',
  'kkkkkkkkkkkkkkkk',
]);
const BP = { b: 'br2', d: 'br1', k: 'br0', l: 'br3', m: 'pl1', t: 'wd1', x: 'wd0' };
def('wall_brick', BP, [
  'tttttttttttttttt',
  'lbbbdmlbbbdmlbbd',
  'bbbbdmbbbbdmbbbd',
  'mmmmmmmmmmmmmmmm',
  'bdmlbbbdmlbbbdml',
  'bdmbbbbdmbbbbdmb',
  'mmmmmmmmmmmmmmmm',
  'lbbbdmlbbbdmlbbd',
  'bbbbdmbbbbdmbbbd',
  'mmmmmmmmmmmmmmmm',
  'bdmlbbbdmlbbbdml',
  'bdmbbbbdmbbbbdmb',
  'mmmmmmmmmmmmmmmm',
  'lbbbdmlbbbdmlbbd',
  'bbbbdmbbbbdmbbbd',
  'xxxxxxxxxxxxxxxx',
]);
// Door on timber wall.
def('door', { p: 'pl2', s: 'pl1', h: 'pl3', t: 'wd1', k: 'wd0', w: 'wd2', d: 'wd1', l: 'wd3', b: 'brass', x: 'uiink' }, [
  'tttttttttttttttt',
  'hppppppppppppppk',
  'hpppkkkkkkkkpppk',
  'hppkwwwwwwwwkppk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwbwkppk',
  'hppkwlwwwwlwkppk',
  'hppkwwwwwwwwkppk',
  'hppkwwwwwwwwkppk',
  'hppkdwdwdwdwkppk',
  'hsskkkkkkkkkkssk',
  'kkkkkkkkkkkkkkkk',
]);
// Windows (unlit / lit) on timber wall. Lit pane colours are LUT-exempt.
const WINROWS = [
  'tttttttttttttttt',
  'hppppppppppppppk',
  'hppphhhhhhhhpppk',
  'hpphaaaamaaaahpk',
  'hpphaaaamaaaahpk',
  'hpphabaamaaaahpk',
  'hpphmmmmmmmmmhpk',
  'hpphaaaamaaaahpk',
  'hpphaaaamaaaahpk',
  'hpphaaaamaaaahpk',
  'hppphhhhhhhhhspk',
  'hpppsssssssssspk',
  'hppppppppppppppk',
  'hppppppppppppppk',
  'hsssssssssssssss',
  'kkkkkkkkkkkkkkkk',
];
def('window_unlit', { p: 'pl2', s: 'pl1', h: 'pl3', t: 'wd1', k: 'wd0', a: 'pane0', b: 'pane1', m: 'wd0' }, WINROWS);
def('window_lit', { p: 'pl2', s: 'pl1', h: 'pl3', t: 'wd1', k: 'wd0', a: '!wglow', b: '!amber', m: 'wd0' }, WINROWS);
// Brick variants of the window.
def('window_brick_unlit', { p: 'br2', s: 'br1', h: 'pl1', t: 'wd1', k: 'br0', a: 'pane0', b: 'pane1', m: 'wd0' }, WINROWS);
def('window_brick_lit', { p: 'br2', s: 'br1', h: 'pl1', t: 'wd1', k: 'br0', a: '!wglow', b: '!amber', m: 'wd0' }, WINROWS);

// Roof tiles (shingle courses) – one shape, six palettes.
const ROOF_BODY = [
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
];
const ROOF_RIDGE = [
  '................',
  '................',
  'llllllllllllllll',
  'dddddddddddddddd',
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
];
const ROOF_EAVE = [
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'bbblbbbblbbbblbb',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'lbbbblbbbblbbbbl',
  'bbbbbbbbbbbbbbbb',
  'ssssssssssssssss',
  'bsbsbsbsbsbsbsbs',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  '................',
];
for (const c of ROOF_COLOURS) {
  const pal = { k: 'ink', d: `${c}0`, s: `${c}1`, b: `${c}2`, l: `${c}3` };
  if (c === 'dark') pal.k = 'ink';
  def(`roof_${c}_ridge`, pal, ROOF_RIDGE);
  def(`roof_${c}_body`, pal, ROOF_BODY);
  def(`roof_${c}_eave`, pal, ROOF_EAVE);
}
// Chimney stub (sits on a ridge tile).
def('chimney', { b: 'br2', d: 'br1', k: 'br0', l: 'br3', s: 'st2' }, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......sssss.....',
  '......lbbdk.....',
  '......lbbdk.....',
  '......lbbdk.....',
  '......lbbdk.....',
  '......kkkkk.....',
  '................',
  '................',
]);

// Porch lamp on a post (unlit / lit); 16x24 so it rises above the ground tile.
const LAMP = [
  '......kkkk......',
  '.....kggggk.....',
  '.....kgaaGk.....',
  '.....kgaaak.....',
  '.....kgaaak.....',
  '.....kkkkkk.....',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '.......pp.......',
  '......xppx......',
  '.....xxppxx.....',
  '.....xxxxxx.....',
  '................',
];
def('lamp_unlit', { k: 'iron', g: 'pane1', a: 'pane0', G: 'pane1', p: 'wd1', x: 'wd0' }, LAMP, 16, 24);
def('lamp_lit', { k: 'iron', g: '!amber', a: '!lampcore', G: '!amber', p: 'wd1', x: 'wd0' }, LAMP, 16, 24);

// Fence: horizontal rail segment and a post (end/corner).
const FENP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'wd0', s: 'shadow' };
def('fence_h', FENP, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.lk....lk....lk.',
  '.pk....pk....pk.',
  'llllllllllllllll',
  'pppppppppppppppp',
  '.pk....pk....pk.',
  '.pk....pk....pk.',
  'llllllllllllllll',
  'pppppppppppppppp',
  '.pk....pk....pk.',
  '.dk....dk....dk.',
  '................',
]);
def('fence_v', FENP, [
  '......lkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......dkk.......',
  '................',
]);

/* ------------------------------------------------------------- flora */
// Flowers over grass.
def('flowers_a', { g: 'grass2', d: 'grass1', s: 'grass0', p: 'blossom', q: 'blossom2', y: 'yellow', w: 'petal' }, [
  'gggggggggggggggg',
  'ggpgggggggggyggg',
  'gpwpggggggggggdg',
  'ggpgggggggggqggg',
  'ggdggggggggqwqgg',
  'ggggggyggggggqgg',
  'ggggggggggggdggg',
  'gggggggggggggggg',
  'gggggqgggggggggg',
  'ggggqwqggggpgggg',
  'gggggqggggpwpggg',
  'gggggdggggggpggg',
  'gggggggggggggggg',
  'gyggggggggggyggg',
  'gggggggggggggggg',
  'gggggggggggggggg',
]);
def('flowers_b', { g: 'grass2', d: 'grass1', o: 'marigold', y: 'yellow', w: 'petal' }, [
  'gggggggggggggggg',
  'gggggggggggggggg',
  'ggggoggggggggggg',
  'gggoyogggggggggg',
  'ggggogggggwggggg',
  'ggggdgggggdggggg',
  'gggggggggggggggg',
  'ggggggggggggoggg',
  'ggwggggggggoyogg',
  'ggdgggggggggoggg',
  'ggggggggggggdggg',
  'ggggggogggggggg g'.replace(' ', ''),
  'gggggoyoggggggg g'.replace(' ', ''),
  'ggggggoggggggggg',
  'ggggggdgggggwggg',
  'gggggggggggggggg',
]);
// Bush: blocking, so it has a visible base line and cast shadow bottom-right.
def('bush', { k: 'grass0', d: 'grass1', b: 'grass2', l: 'grass3', h: 'grass4', s: 'shadow', x: 'uiink' }, [
  '................',
  '......kkkk......',
  '....kkllbbkk....',
  '...klhlbbbbdk...',
  '..klhlbbbbbbdk..',
  '..klbbbbbbbddk..',
  '.kllbbbbbbbbddk.',
  '.klbbbbbbbbbddk.',
  '.kbbbbbbbbbdddk.',
  '.kbbbbbbbbddddk.',
  '.kdbbbbbbbddddk.',
  '..kdbbbbbdddddks',
  '..kkdddddddddkks',
  '...kkkkkkkkkkkss',
  '.....xxxxxxxssss',
  '........ssssss..',
]);
// Rocks.
def('rock_a', { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', s: 'shadow' }, [
  '................',
  '................',
  '......kkk.......',
  '....kkhlmkk.....',
  '...khlmmmmdk....',
  '...klmmmmmddk...',
  '..kmmmmmmmdddk..',
  '..kmmmmmmddddk..',
  '..kdmmmmddddkk..',
  '...kdddddddkks..',
  '...kkkkkkkkkss..',
  '......ssssss....',
  '................',
  '................',
  '................',
  '................',
]);
def('rock_b', { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', s: 'shadow' }, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..kk......kkk...',
  '.khlk....khmdk..',
  '.klmdk...kmmdk..',
  '.kmddk...kdddk..',
  '.kkkkks..kkkkks.',
  '...sss.....sss..',
  '................',
  '................',
  '................',
  '................',
  '................',
]);

// Trees are 32x32 (2x2 tiles); anchor = bottom-left tile. Every tree has a trunk, a dark base line
// and a dithered cast shadow bottom-right so it reads as blocking (never as tall grass).
const TREEPAL = {
  k: 'pine0', d: 'pine1', b: 'pine2', l: 'pine3', t: 'wd0', u: 'wd1', s: 'shadow', x: 'uiink',
};
def('tree_pine', TREEPAL, [
  '...............kk...............',
  '..............kllk..............',
  '..............klbdk.............',
  '.............klbbdk.............',
  '.............klbbddk............',
  '............kllbbbddk...........',
  '............klbbbbddk...........',
  '...........kllbbbbdddk..........',
  '..........kklbbbbbdddkk.........',
  '.............klbbbbdk...........',
  '............kllbbbbddk..........',
  '...........kllbbbbbdddk.........',
  '..........kllbbbbbbddddk........',
  '.........kllbbbbbbbbddddk.......',
  '........kklbbbbbbbbbdddddkk.....',
  '...........kllbbbbbdddk.........',
  '..........kllbbbbbbddddk........',
  '.........kllbbbbbbbbddddk.......',
  '........kllbbbbbbbbbbdddddk.....',
  '.......kllbbbbbbbbbbbddddddk....',
  '......kklbbbbbbbbbbbbdddddddkk..',
  '.........kllbbbbbbbbbdddddk.....',
  '........kllbbbbbbbbbbddddddk....',
  '.......kllbbbbbbbbbbbbddddddk...',
  '......kkkkkkkkkkbbbkkkkkkkkkkk..',
  '...............utt..............',
  '...............utt..............',
  '...............utt....ss........',
  '..............uuttt..ssss.......',
  '.............xxxxxxxssssss......',
  '...........ssssssssssssssss.....',
  '..............sssssssssss.......',
], 32, 32);
def('tree_alder', { k: 'ald0', d: 'ald1', b: 'ald2', l: 'ald3', t: 'aldbark0', u: 'aldbark1', v: 'aldbark2', s: 'shadow', x: 'uiink', n: 'pine1' }, [
  '..........nkkkkkk...............',
  '........nkklllbbbkk.............',
  '.......nklllbbbbbbdkk...........',
  '......nkllbbbbbbbbbdddk.........',
  '.....nkllbbbbbbbbbbbdddk........',
  '....nkllbbbbbbbbbbbbbdddk.......',
  '....nklbbbbbbbbbbbbbbbdddk......',
  '...nklbbbbbbbbbbbbbbbbbdddk.....',
  '...nklbbbbbbbbbkkbbbbbbdddnk....',
  '..nklbbbbbbbbbkddkbbbbbbdddnk...',
  '..nkbbbbbbbbbbkdddkbbbbbddddnk..',
  '..nkbbbbbbbbbbbkddkbbbbbdddddn..',
  '..nkbbbbbbbbbbbbkkbbbbbbdddddn..',
  '..nkdbbbbbbbbbbbbbbbbbbdddddddn.',
  '..nkdbbbbbbbbbbbbbbbbbbbddddddn.',
  '...nkdbbbbbbbbbbbbbbbbbdddddddn.',
  '...nkddbbbbbbbbbbbbbbbddddddddn.',
  '....nkddbbbbbbbbbbbbbddddddddn..',
  '....nnkdddbbbbbbbbbbdddddddddn..',
  '.....nnkddddbbbbbbdddddddddnn...',
  '......nnkkdddddddddddddddnnn....',
  '........nnnkkkdddddddkkknn......',
  '..........nnnnvutnnnnnn.........',
  '...............vut..............',
  '...............vut..............',
  '...............vuut.............',
  '...............vuut.....s.......',
  '..............vvuutt..ssss......',
  '.............xxxxxxxxsssssss....',
  '..........sssssssssssssssssss...',
  '............ssssssssssssssss....',
  '...............ssssssssss.......',
], 32, 32);
const FRUITPAL = { k: 'fr0', d: 'fr1', b: 'fr2', l: 'fr3', t: 'wd0', u: 'wd1', v: 'wd2', s: 'shadow', x: 'uiink', f: 'pear', g: 'pear2', e: 'pear0' };
const FRUIT_ROWS = [
  '............kkkkkkk.............',
  '..........kkllbbbbbkk...........',
  '.........kllbbbbbbbbdk..........',
  '.......kkllbbbbbbbbbbddk........',
  '......klllbbbbbbbbbbbbddk.......',
  '.....kllbbbbbbbbbbbbbbbddk......',
  '.....klbbbbgfbbbbbbbbbbbdk......',
  '....klbbbbbffbbbbbbgfbbbddk.....',
  '....klbbbbbeebbbbbbffbbbddk.....',
  '...kllbbbbbbbbbbbbbeebbbbddk....',
  '...klbbbbbbbbbbbbbbbbbbbbddk....',
  '...klbbbbbbbbbbbbbbbbbbbbddk....',
  '...kbbbbbbbbbbgfbbbbbbbbbdddk...',
  '...kbbbbgfbbbbffbbbbbbgfbdddk...',
  '...kbbbbffbbbbeebbbbbbffbdddk...',
  '...kdbbbeebbbbbbbbbbbbeebdddk...',
  '...kdbbbbbbbbbbbbbbbbbbbddddk...',
  '....kdbbbbbbbbbbbbbbbbbdddddk...',
  '....kddbbbbbbbgfbbbbbbdddddk....',
  '.....kddbbbbbbffbbbbbddddddk....',
  '.....kkdddbbbbeebbbbdddddddk....',
  '.......kkdddddbbbddddddddkk.....',
  '.........kkkkddddddddkkkk.......',
  '.............kkvutkkk...........',
  '...............vut..............',
  '...............vut..............',
  '...............vut.....s........',
  '..............vvutt..ssss.......',
  '.............xxxxxxxxssssss.....',
  '...........ssssssssssssssss.....',
  '.............ssssssssssssss.....',
  '................sssssss.........',
];
def('tree_fruit', FRUITPAL, FRUIT_ROWS, 32, 32);
// Bare variant: fruit chars become canopy.
def('tree_fruit_bare', { ...FRUITPAL, f: 'fr2', g: 'fr3', e: 'fr1' }, FRUIT_ROWS, 32, 32);

/* ---------------------------------------------------------- landmarks */
// Waystone: a dock marker; stone pillar, iron ring, glowing rune (exempt). 16x32, anchor bottom tile.
def('waystone', { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', i: 'iron', r: '!rune', w: '!runew', s: 'shadow', x: 'uiink' }, [
  '......kkkk......',
  '.....khhlmk.....',
  '....khllmmdk....',
  '....klllmmdk....',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '....klmrrmdk....',
  '....klrwwrdk....',
  '....klmrrmdk....',
  '....klmmrmdk....',
  '....klmmrmdk....',
  '....klmrrmdk....',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '....iiiiiiiik...',
  '...iklmmmmdkii..',
  '...iklmmmmdkii..',
  '....iiiiiiiik...',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '....klmmmmdk....',
  '...kklmmmmddk...',
  '..kklmmmmmdddk..',
  '..khlmmmmmdddk..',
  '..klmmmmmmdddk..',
  '..kkkkkkkkkkkks.',
  '..xxxxxxxxxxxxss',
  '.....ssssssssss.',
  '................',
], 16, 32);
// Skyglass node: irregular faceted shard (>= 5 sides, never a plus or 4-point star). 2 frames = 1 s pulse.
const SGP = { k: '!m0', m: '!m1', h: '!m2', s: 'shadow', x: 'uiink', r: 'st1', q: 'st2' };
def('skyglass', SGP, [[
  '................',
  '.........k......',
  '........khk.....',
  '.......khmk.....',
  '......khmmk.....',
  '......khmmmk....',
  '.....khmmmmk....',
  '.....kmmmmmkk...',
  '....khmmmmkmmk..',
  '....kmmmmkmmmk..',
  '....kmmmkmmmmk..',
  '....kmmkmmmkkk..',
  '...rkkkkmmkqqrk.',
  '..rqqkkkkkkqqqrk',
  '..rrrrrrrrrrrrrs',
  '...xxxxxxxxxxsss',
], [
  '................',
  '.........k......',
  '........kmk.....',
  '.......kmmk.....',
  '......kmmmk.....',
  '......kmmmmk....',
  '.....kmmmmmk....',
  '.....kmmmmmkk...',
  '....kmmmmmkmmk..',
  '....kmmmmkmmmk..',
  '....kmmmkmmmmk..',
  '....kmmkmmmkkk..',
  '...rkkkkmmkqqrk.',
  '..rqqkkkkkkqqqrk',
  '..rrrrrrrrrrrrrs',
  '...xxxxxxxxxxsss',
]]);

// The lighthouse: 32x80 (2x5 tiles), anchor = bottom-left tile. Whitewashed tower with a red band,
// gallery, lamp room. Lamp lit / dark via palette. Scaffolding is a separate overlay clipped per stage.
const LHP = {
  k: 'uiink', i: 'iron', w: 'pl2', s: 'pl1', d: 'pl0', h: 'pl3', r: 'red2', q: 'red1', e: 'red3',
  g: 'pane0', G: 'pane1', a: 'pane0', A: 'pane1', c: 'pane1', t: 'wd0', u: 'wd1', x: 'uiink', m: 'st2', n: 'st1', o: 'st3', b: 'brass', y: 'shadow',
};
const LH_ROWS = [
  '..............kkkk..............',
  '..............kbbk..............',
  '...............kk...............',
  '............kkkkkkkk............',
  '...........kiiiiiiiik...........',
  '..........kiggggggggik..........',
  '..........kigaaccaagik..........',
  '..........kigaccccagik..........',
  '..........kigaccccagik..........',
  '..........kigaaccaagik..........',
  '..........kiggggggggik..........',
  '.........kiiiiiiiiiiiik.........',
  '........kikikikikikikikk........',
  '........kkkkkkkkkkkkkkkk........',
  '.........kqqqqqqqqqqqqk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........keerrrrrrrrqqk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwGGwwwsdk.........',
  '.........khwwwwggwwwsdk.........',
  '.........khwwwwggwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '.........khwwwwwwwwwsdk.........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwGGwwwwsdk........',
  '........khwwwwwggwwwwsdk........',
  '........khwwwwwggwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '........khwwwwwwwwwwwsdk........',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '.......khwwwwwwwwwwwwwsdk.......',
  '......khwwwwwwwwwwwwwwwsdk......',
  '......khwwwwwwwwwwwwwwwsdk......',
  '......khwwwwwwwwwwwwwwwsdk......',
  '......khwwwwwwwkkkkwwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuutukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '......khwwwwwwkuuuukwwwsdk......',
  '.....komnnnnnnkuuuuknnnnmok.....',
  '.....komnnnnnnnnnnnnnnnnmok.....',
  '....kkkkkkkkkkkkkkkkkkkkkkkk....',
  '....xxxxxxxxxxxxxxxxxxxxxxxxyy..',
  '......yyyyyyyyyyyyyyyyyyyyyyyyy.',
  '.........yyyyyyyyyyyyyyyyyyyy...',
];
def('lighthouse_dark', LHP, LH_ROWS, 32, 80);
def('lighthouse_lit', { ...LHP, g: '!lhamber', G: '!lhamber', a: '!lhamber', A: '!lampcore', c: '!lampcore' }, LH_ROWS, 32, 80);
// Scaffolding: 7 sections of 9 rows hugging the tower's right flank, built bottom-up.
// Section n (0 = lowest) occupies rows [77 - 9*(n+1), 77 - 9*n). drawLighthouse clips to the stage.
const SCP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'wd0', r: 'iron' };
const SC_SECTION = [
  '.........................lkk....',
  '.........................ppk....',
  '.........................ppk....',
  '......................pppppppkk.',
  '......................lllllllkk.',
  '.........................ppk..r.',
  '.........................ppk..r.',
  '.........................ppk..r.',
  '.........................ddk..r.',
];
const SC_ROWS = [];
for (let i = 0; i < 80; i++) SC_ROWS.push('................................');
for (let n = 0; n < 7; n++) {
  const top = 77 - 9 * (n + 1);
  for (let r = 0; r < 9; r++) SC_ROWS[top + r] = SC_SECTION[r];
}
def('lighthouse_scaffold', SCP, SC_ROWS, 32, 80);
export const SCAFFOLD_SECTION_ROWS = 9;
export const SCAFFOLD_BASE_ROW = 77;

// Cottage lamp light pool (drawn with screen compositing at night). 2-step dither.
def('light_pool', { a: '!amber', b: '!amber' }, [
  '..............a.a.a.a...........',
  '..........a.a.aaaaaaa.a.a.......',
  '........a.aaaaaaaaaaaaaaa.a.....',
  '......a.aaaaaaaaaaaaaaaaaaa.a...',
  '....a.aaaaaaaaaaaaaaaaaaaaaaa.a.',
  '...a.aaaaaaaaaaaaaaaaaaaaaaaaa.a',
  '..a.aaaaaaaaaaaaaaaaaaaaaaaaaaa.',
  '.a.aaaaaaaaaaaaaaaaaaaaaaaaaaa.a',
  '..a.aaaaaaaaaaaaaaaaaaaaaaaaaaa.',
  '...a.aaaaaaaaaaaaaaaaaaaaaaaaa.a',
  '....a.aaaaaaaaaaaaaaaaaaaaaaa.a.',
  '......a.aaaaaaaaaaaaaaaaaaa.a...',
  '........a.aaaaaaaaaaaaaaa.a.....',
  '..........a.a.aaaaaaa.a.a.......',
  '..............a.a.a.a...........',
  '................................',
], 32, 16);

// Fog pattern tile (64x16 band, 2-step dither; drawn scrolled at low alpha).
def('fog_band', { v: 'st4', w: 'cream' }, [
  '................................................................',
  '........v.v.v.v.v.v.v.v.........................v.v.v.v.v.......',
  '....v.v.vvvvvvvvvvvvvvv.v.v.................v.v.vvvvvvvvv.v.v...',
  '..v.vvvvvvvvvvvwvvvvvvvvvvv.v.v...........v.vvvvvvvwvvvvvvvvv.v.',
  'v.vvvvvvvvwvvvvvvvvvvvvvvvvvvvv.v.v.....v.vvvvvvvvvvvvvvvvvvvvv.',
  '.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.v.v.vvvvvvvvvvvvvvvvvvwvvvvv',
  'vvvvvvvvvvvvvvvvvvvvvvwvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  '.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.',
  'v.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvwvvvvvvvvvvvvvvvvvvv.v',
  '.v.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.v.',
  '..v.v.vvvvvvvvvvvvvvvvvvvvvvvvv.v.vvvvvvvvvvvvvvvvvvvvvvvvv.v.v.',
  '....v.v.vvvvvvvvvvvvvvvvvvvvv.v.v...v.v.vvvvvvvvvvvvvvvvv.v.v...',
  '......v.v.v.vvvvvvvvvvvvv.v.v.........v.v.v.vvvvvvvvv.v.v.......',
  '..........v.v.v.v.v.v.v.v...............v.v.v.v.v.v.v...........',
  '................................................................',
  '................................................................',
], 64, 16);

// Skyband clouds (two sizes) – lit cream top-left, blue-grey shadow underside.
def('cloud_a', { w: 'cream', l: 'pl3', s: 'st4', d: 'st3' }, [
  '..........wwww..........',
  '.......wwwwwwwww........',
  '....wwwwwwwwwwwwwww.....',
  '..wwwwwwwwwwwwwwwwwwl...',
  '.wwwwwwwwwwwwwwwwwwwlls.',
  'wlllllllllllllllllllsss.',
  '.sssssssssssssssssssdd..',
  '...ddddddddddddddddd....',
], 24, 8);
def('cloud_b', { w: 'cream', l: 'pl3', s: 'st4', d: 'st3' }, [
  '.....www.....',
  '..wwwwwwwww..',
  '.wwwwwwwwwwl.',
  'llllllllllss.',
  '.ssssssssdd..',
], 13, 5);
// Distant isle silhouette for the horizon.
def('isle_far', { a: 'st1', b: 'st2' }, [
  '..............bb................................',
  '..........bbbbaabbb..............bbbb...........',
  '......bbbbaaaaaaaaabbb.......bbbbaaaabbbb.......',
  'bbbbbbaaaaaaaaaaaaaaaabbbbbbbaaaaaaaaaaaabbbbbbb',
], 48, 4);

export const TILES = tiles;

/** @returns {string[]} the frame rows for `name` at animation step `frame`. */
export function frameOf(name, frame = 0) {
  const t = tiles[name];
  if (!t) throw new Error(`unknown tile ${name}`);
  return t.frames[frame % t.frames.length];
}

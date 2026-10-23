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
  sh0: '#2A6F8F', sh1: '#357F9C', sh2: '#3F9BB8', sh3: '#6FBFCF', dapple: '#8CCBC8',
  riv0: '#2A6F8F', riv1: '#3A8FA8', riv2: '#4FB3C9', riv3: '#9FD3C0',
  shm0: '#3E7A8C', shm1: '#4F93A4', shm2: '#79B8C2', shmud: '#7E9C92',
  foam: '#EAF2F8',
  // stone / cliff
  st0: '#2A2F44', st1: '#4F5A6B', st2: '#6E7A86', st3: '#8E9AA6', st4: '#B8CFE0',
  cl0: '#2A2433', cl1: '#4A3E44', cl2: '#6E5A58', cl3: '#8C7A6E', cl4: '#A8927C',
  // ground
  pa0: '#8E6B45', pa1: '#B08A5E', pa2: '#C9A77C', pa3: '#D9C19A',
  co0: '#4E4A5A', co1: '#6B6672', co2: '#8E8A86', co3: '#ABA6A0', co4: '#C4BFB6', cow1: '#7E7068', cow2: '#9C8E80',
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
  dark0: '#2A2433', dark1: '#3B3A48', dark2: '#4E4C62', dark3: '#6A6882',
  // flora
  pinek: '#16302E', pine0: '#1F4A3C', pine1: '#2E5A48', pine2: '#3F7A5A', pine3: '#5E9E6A', pine4: '#7FB08A',
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

/* ---------------------------------------------------------------- helpers */
/** `h` rows of `w` copies of `ch`. */
const blank = (w, h, ch = '.') => Array.from({ length: h }, () => ch.repeat(w));
/** Paint `sprite` rows onto `rows` at (x, y); '.' in the sprite is transparent. Returns new rows. */
function blit(rows, sprite, x, y) {
  const out = rows.slice();
  for (let j = 0; j < sprite.length; j++) {
    const yy = y + j;
    if (yy < 0 || yy >= out.length) continue;
    const line = out[yy].split('');
    for (let i = 0; i < sprite[j].length; i++) {
      const xx = x + i;
      const c = sprite[j][i];
      if (c === '.' || xx < 0 || xx >= line.length) continue;
      line[xx] = c;
    }
    out[yy] = line.join('');
  }
  return out;
}
/**
 * Procedural leaf canopy: overlapping round lobes lit from the top-left, a shadow crescent where a
 * higher lobe overhangs a lower one, light flecks on the lit side, and a selective outline (own-hue
 * dark along the top, the deepest shade along the underside). Returns `h` rows of `w` chars.
 * @param {number} w @param {number} h
 * @param {{cx:number, cy:number, r:number}[]} lobes
 * @param {{out:string, deep:string, l:string, b:string, d:string}} ch palette chars
 */
function canopy(w, h, lobes, ch) {
  const inside = (x, y) => lobes.some((L) => (x - L.cx) ** 2 + (y - L.cy) ** 2 <= L.r * L.r);
  // one light field over the whole crown (its bounding circle), so bands stay coherent
  const minX = Math.min(...lobes.map((L) => L.cx - L.r)), maxX = Math.max(...lobes.map((L) => L.cx + L.r));
  const minY = Math.min(...lobes.map((L) => L.cy - L.r)), maxY = Math.max(...lobes.map((L) => L.cy + L.r));
  const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2, R = Math.max(maxX - minX, maxY - minY) / 2;
  const grid = blank(w, h).map((r) => r.split(''));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const dot = -((x - cx0) / R + (y - cy0) / R) / Math.SQRT2; // 1 = facing the light
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) { grid[y][x] = dot < -0.1 || !inside(x, y + 1) ? ch.deep : ch.out; continue; }
      // shadow crescent: the lower rim of a lobe that overhangs another lobe below it
      let shaded = false;
      for (const M of lobes) {
        if (y <= M.cy) continue;
        const dm = Math.hypot(x - M.cx, y - M.cy) / M.r;
        if (dm > 1 || dm < 0.8) continue;
        if (lobes.some((N) => N !== M && N.cy > M.cy && (x - N.cx) ** 2 + (y - N.cy) ** 2 <= N.r * N.r)) shaded = true;
      }
      const checker = ((x + y) & 1) === 0;
      let c = dot > 0.5 || (dot > 0.4 && checker) ? ch.l : dot > -0.25 || (dot > -0.35 && checker) ? ch.b : ch.d;
      if (shaded) c = c === ch.l ? ch.b : ch.d;
      else if (c === ch.b && dot > 0.1 && (x * 7 + y * 13) % 23 === 0) c = ch.l;
      grid[y][x] = c;
    }
  }
  // close 1px notches between lobes along the underside
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grid[y][x] === '.' && grid[y][x - 1] !== '.' && grid[y][x + 1] !== '.') grid[y][x] = ch.deep;
    }
  }
  return grid.map((r) => r.join(''));
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

// Tall grass (encounter tile): outlined tufts lighter than the turf, turf always visible between
// them, no trunk. Three sway frames lean the tuft heads one pixel.
const TUFT = [
  'h..h..h',
  'mo.mo.m',
  'mo.momo',
  'omo.mmo',
  'ommmmbo',
  '.ommbo.',
  '..ooo..',
];
const lean = (tuft, dx) => tuft.map((r, i) => (i < 3 && dx ? (dx > 0 ? '.' + r.slice(0, -1) : r.slice(1) + '.') : r));
const TG = { ...GP, o: 'grass0', m: 'grass3', b: 'grass1' };
const tgFrame = (dx) => {
  let r = tiles.grass_a.frames[0];
  for (const [x, y] of [[1, 0], [9, 3], [4, 9]]) r = blit(r, lean(TUFT, dx), x, y);
  return r;
};
def('tallgrass', TG, [tgFrame(0), tgFrame(1), tgFrame(-1)]);
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
// Glowing night mud: the same wet mud, with sparse bioluminescent clusters (LUT-exempt) that pulse
// out of phase over three frames (bright → mid → dim).
const GMP = { m: 'wmud1', d: 'wmud0', l: 'wmud2', a: '!bio1', b: '!bio2', c: '!bio0' };
// Irregular 2x2 blobs with a loose halo; never a plus or a four-point star (that glyph is the Heartmark's).
const GLOW_STATES = [
  ['ab.', 'bac', '..c'],
  ['ac.', 'ca.', '...'],
  ['c..', '.c.', '...'],
];
const GLOW_SPOTS = [[2, 2, 0], [10, 5, 1], [5, 11, 2]];
const GLOW_BASE = tiles.mud_wet.frames[0].map((r) => r.replace(/[rb]/g, 'l'));
const glowFrame = (f) => GLOW_SPOTS.reduce((rows, [x, y, ph]) => blit(rows, GLOW_STATES[(f + ph) % 3], x, y), GLOW_BASE);
def('mud_glow', GMP, [glowFrame(0), glowFrame(1), glowFrame(2)]);
/* ------------------------------------------------------------- water */
// A calm base with sparse highlight strokes (and a few darker troughs) that breathe over four
// frames: each stroke erodes a pixel from one end and grows back. Tiles stay seamless and a field
// of them shimmers quietly instead of reading as static.
const WATER_BASE = [
  'wwwwwwwwwwwwwwww',
  'wwhhhhwwwwwwwwww',
  'wwwwwwwwwwwwwhhw',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwkkwwwwwww',
  'wwwwwwwhhhwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'hhwwwwwwwwwwwwww',
  'wwwwwwwwwwhhhhww',
  'wwwwkkwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwhhhwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwhhh',
  'wwwwwwwwwwwwwwww',
];
function erode(row, e, fromLeft) {
  return row.replace(/h+|k+/g, (run) => {
    const keep = Math.max(1, run.length - e);
    const pad = 'w'.repeat(run.length - keep);
    return fromLeft ? pad + run.slice(0, keep) : run.slice(0, keep) + pad;
  });
}
const WAVES = [0, 1, 2, 1].map((e) => WATER_BASE.map((row, y) => erode(row, e, (y & 1) === 0)));
def('water_deep', { w: 'deep1', h: 'deep2', k: 'deep0' }, WAVES);
def('water_shallow', { w: 'sh2', h: 'sh3', k: 'sh1' }, WAVES);
def('water_mud', { w: 'shm1', h: 'shm2', k: 'shm0' }, WAVES);
// River: light flow streaks that slide downstream (rows rotate 4 per frame → seamless loop).
const RIVER_BASE = [
  'rrrrrrrrrrrrrrrr',
  'rrsrrrrrrrrrrrrr',
  'rrsrrrrrrrrrrrrr',
  'rrsrrrrrrrrrdrrr',
  'rrsrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrsrrrrrrrr',
  'rrrrrrrsrrrrrrrr',
  'rrdrrrrsrrrrrrrr',
  'rrrrrrrsrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrsrrrrrrrdrrr',
  'rrrrsrrrrrrrrrrr',
];
const rot = (rows, n) => rows.map((_, i) => rows[(i - n + rows.length) % rows.length]);
def('river', { r: 'riv1', s: 'riv3', d: 'riv2' }, [0, 1, 2, 3].map((k) => rot(RIVER_BASE, k * 4)));
// Foam where water meets land: a broken 3px band (foam, a paler shallow tone, then a few stray
// pixels) in three frames. Authored for the N edge; render.js rotates it for the others.
const FP = { f: 'foam', s: 'sh3' };
const foamFrame = (a, b, c) => [a, b, c, ...blank(16, 13)];
def('foam_n', FP, [
  foamFrame('fff.ffffff.fff.f', '.s.f..s..f..s.f.', '...s........s...'),
  foamFrame('ffffff.fffff.fff', 'f..s.f..s..f..s.', '.....s.......s..'),
  foamFrame('ff.ffff.ffffff.f', '.f..s.f..s..f.s.', 's........s......'),
]);
// River bank: a single broken ripple instead of surf. N edge; rotated like foam.
def('ripple_n', { s: 'riv3' }, [
  ['s.ss...s.ss..s..', ...blank(16, 15)],
  ['.ss..s..ss..s.s.', ...blank(16, 15)],
  ['ss...s.s..ss..ss', ...blank(16, 15)],
]);
// Grass fringe: ragged turf creeping over a path or sand tile along a grass edge. N edge; rotated.
def('fringe_n', { g: 'grass2', d: 'grass1' }, [
  'gg.ggg.g.gg.ggg.',
  '.g..g.....g..g..',
  '....d........d..',
  ...blank(16, 13),
]);
// Shelf: dithered transition from shallows into deep water (drawn on the deep tile, N edge).
def('shelf_n', { s: 'sh1' }, [
  's.s.s.s.s.s.s.s.',
  '.s.s.s.s.s.s.s.s',
  's...s...s...s...',
  '..s...s...s...s.',
  ...Array.from({ length: 12 }, () => '................'),
]);

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
// Side faces for cliff-top edges (drawn over the cliff-top grass): a lit 3px face with a dark base
// line on the west, a shaded one on the east, and a lit lip along the north edge.
def('cliff_rim_w', { k: 'cl0', m: 'cl2', d: 'cl1', l: 'cl4', b: 'cl3' }, [
  'kml.............', 'kmb.............', 'kml.............', 'kdb.............',
  'kml.............', 'kmb.............', 'kml.............', 'kml.............',
  'kdb.............', 'kml.............', 'kmb.............', 'kml.............',
  'kml.............', 'kdb.............', 'kml.............', 'kmb.............',
]);
def('cliff_rim_e', { k: 'cl0', m: 'cl2', d: 'cl1' }, [
  '.............mdk', '.............ddk', '.............mdk', '.............mdk',
  '.............ddk', '.............mdk', '.............mdk', '.............ddk',
  '.............mdk', '.............mdk', '.............ddk', '.............mdk',
  '.............mdk', '.............ddk', '.............mdk', '.............mdk',
]);
def('cliff_rim_n', { l: 'cl4', b: 'cl3' }, ['llllllllllllllll', 'bbbbbbbbbbbbbbbb', ...blank(16, 14)]);
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
// Quay cobbles: rounded setts in three staggered courses (sizes vary, setts wrap across the tile
// edge so no mortar line runs on the grid). Each sett is lit top-left and shaded bottom-right, with
// mortar showing at its rounded corners. Two variants share the geometry but tint the setts
// differently (neutral / warm / dark), so a large quay never repeats visibly.
const SETT_COURSES = [
  { y: 0, h: 4, cuts: [4, 9, 14] },
  { y: 5, h: 4, cuts: [1, 6, 11] },
  { y: 10, h: 5, cuts: [3, 8, 13] },
];
const SETT_TINTS = { n: ['l', 'c', 'd'], w: ['l', 'w', 'u'], k: ['c', 'd', 'g'] };
function cobbleTile(tints) {
  const g = blank(16, 16, 'g').map((r) => r.split(''));
  let si = 0;
  for (const C of SETT_COURSES) {
    for (let k = 0; k < C.cuts.length; k++) {
      const a = C.cuts[k] + 1, b = C.cuts[(k + 1) % C.cuts.length] - 1; // sett spans a..b (may wrap)
      const sw = ((b - a + 16) % 16) + 1;
      const [hi, body, lo] = SETT_TINTS[tints[si % tints.length]];
      for (let i = 0; i < sw; i++) {
        for (let j = 0; j < C.h; j++) {
          const x = (a + i) % 16, y = C.y + j;
          const corner = (i === 0 || i === sw - 1) && (j === 0 || j === C.h - 1);
          let c = body;
          if (corner) c = i === 0 && j === 0 ? body : 'g';
          else if (j === 0 || i === 0) c = hi;
          else if (j === C.h - 1 || i === sw - 1) c = lo;
          if (!corner && i === 1 && j === 1 && tints[si % tints.length] === 'n' && si % 3 === 0) c = 'h';
          g[y][x] = c;
        }
      }
      si++;
    }
  }
  return g.map((r) => r.join(''));
}
const COBP = { g: 'co0', d: 'co1', c: 'co2', l: 'co3', h: 'co4', w: 'cow2', u: 'cow1' };
def('cobbles', COBP, cobbleTile(['n', 'w', 'n', 'n', 'k', 'n', 'w', 'n', 'n']));
def('cobbles_b', COBP, cobbleTile(['k', 'n', 'n', 'w', 'n', 'n', 'n', 'k', 'w']));
// Quay coping: dressed granite blocks along the water edge (wet dark waterline, lit nosing, block
// face with offset joints, a shadow line onto the cobbles). Variant b carries an iron bollard.
const COPE = [
  'kkkkkkkkkkkkkkkk',
  'hhhhhhhlhhhhhhhh',
  'mmmmmmmdlmmmmmmm',
  'mmmmmmmdmmmmmmmm',
  'mmmmmmmdmmmmmmmm',
  'dddddddddddddddd',
  'ssssssssssssssss',
];
def('quay_lip', { k: 'st1', h: 'st4', l: 'st3', m: 'st3', d: 'st2', s: 'co0' }, [...COPE, ...blank(16, 9)]);
def('quay_lip_b', { k: 'st1', h: 'st4', l: 'st3', m: 'st3', d: 'st2', s: 'co0', i: 'iron', j: 'st1', e: 'pane1' },
  blit([...COPE, ...blank(16, 9)], ['.jiij.', 'jieiij', 'jiiiij', '.jjjj.'], 9, 1));
// Pier: one tile wide, cross planks with water showing through the gaps, posts on both sides.
const PP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'wd0', w: 'deep0', h: 'wd4' };
const PLANKS = [
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppdppppppppdk',
  'kwwwwwwwwwwwwwwk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klppppppppdpppdk',
  'kwwwwwwwwwwwwwwk',
];
def('pier', PP, [
  ...PLANKS,
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppppdppppppdk',
  'kwwwwwwwwwwwwwwk',
  'hklllllllllllkhk',
  'kkppppppppppppkk',
  'kkpppdppppppppkk',
  'kwwwwwwwwwwwwwwk',
]);
def('pier_end', PP, [
  'kkkkkkkkkkkkkkkk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppppkkpppppdk',
  'kwwwwwwhkwwwwwwk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klppdpppppppppdk',
  ...PLANKS.slice(3, 7),
  'hklllllllllllkhk',
  'kkppppppppppppkk',
  'kkppppppppdpppkk',
  'kwwwwwwwwwwwwwwk',
]);
// Rowboat moored beside the pier (32x16, bobs 1px), seen from above in 3/4: square transom at the
// stern (left), a pointed bow (right), a lit gunwale rim, the recessed hull floor in shade under the
// near rim, two thwarts, the red-painted strake showing along the south side, and its shadow on
// the water.
function rowboat() {
  const W = 32, H = 16, cy = 6, x0 = 3, xs = 19, xb = 29;
  const half = (x) => (x < x0 || x > xb ? -1 : x <= xs ? 4.5 : 4.5 * Math.sqrt(Math.max(0, 1 - ((x - xs) / (xb - xs + 0.6)) ** 2)));
  const inHull = (x, y) => { const hh = half(x); return hh > 0 && Math.abs(y + 0.5 - cy - 0.5) <= hh; };
  const g = blank(W, H).map((r) => r.split(''));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!inHull(x, y)) continue;
      const out = !inHull(x - 1, y) || !inHull(x + 1, y) || !inHull(x, y - 1) || !inHull(x, y + 1);
      if (out) { g[y][x] = 'k'; continue; }
      const rim = !inHull(x - 2, y) || !inHull(x + 2, y) || !inHull(x, y - 2) || !inHull(x, y + 2) || !inHull(x + 1, y + 1) || !inHull(x - 1, y - 1);
      if (rim) { g[y][x] = y <= cy ? 'l' : 'w'; continue; }
      const nearTop = !inHull(x, y - 3);
      let c = nearTop ? 'd' : 'p';
      if (y === cy + 1 && x % 5 !== 0) c = nearTop ? 'd' : 'q'; // plank seam
      if (x === 9 || x === 17) c = 't';
      if (x === 10 || x === 18) c = nearTop ? 'k' : 'd';
      g[y][x] = c;
    }
  }
  // painted strake under the south rim, then the hull's shadow on the water
  for (let x = 0; x < W; x++) {
    let yb = -1;
    for (let y = H - 1; y >= 0; y--) if (g[y][x] === 'k' && inHull(x, y)) { yb = y; break; }
    if (yb < 0) continue;
    const bow = x > xb - 3;
    if (!bow && yb + 1 < H) g[yb][x] = 'r';
    if (!bow && yb + 1 < H) g[yb + 1][x] = x === x0 ? 'k' : 'e';
    if (yb + 2 < H) g[yb + 2][x] = bow ? 's' : 'k';
    if (yb + 3 < H && x > x0) g[yb + 3][x] = 's';
    if (yb + 4 < H && x > x0 + 1 && x % 2 === 0) g[yb + 4][x] = 's';
  }
  return g.map((r) => r.join(''));
}
def('boat', { k: 'wd0', d: 'wd1', p: 'wd2', q: 'wd1', w: 'wd3', l: 'wd4', t: 'wd4', r: 'red2', e: 'red1', s: 'deep0' }, rowboat(), 32, 16);
// Steps cut into a cliff face (the ramp down from the point): three treads, each a lit nosing,
// two rows of riser and a shadow line, between dark side walls.
def('steps', { g: 'grass1', k: 'cl0', d: 'cl1', b: 'cl3', l: 'cl4' }, [
  'gggggggggggggggg',
  'kllllllllllllllk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
  'kllllllllllllllk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
  'kllllllllllllllk',
  'kbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
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

// Roof tiles: staggered shingle courses (lit nosing top-left, dark joint, shadow line under each
// course), one shape, six palettes.
const COURSE_A = ['lbbdlbbdlbbdlbbd', 'bbbdbbbdbbbdbbbd', 'ssssssssssssssss'];
const COURSE_B = ['bdlbbdlbbdlbbdlb', 'bdbbbdbbbdbbbdbb', 'ssssssssssssssss'];
const ROOF_BODY = [...COURSE_A, ...COURSE_B, ...COURSE_A, ...COURSE_B, ...COURSE_A, COURSE_B[0]];
const ROOF_RIDGE = ['................', '................', 'llllllllllllllll', 'dddddddddddddddd', ...COURSE_A, ...COURSE_B, ...COURSE_A, ...COURSE_B];
const ROOF_EAVE = [...COURSE_A, ...COURSE_B, ...COURSE_A, ...COURSE_B, COURSE_A[0], COURSE_A[1], 'kkkkkkkkkkkkkkkk', '................'];
for (const c of ROOF_COLOURS) {
  const pal = { k: 'ink', d: `${c}0`, s: `${c}1`, b: `${c}2`, l: `${c}3` };
  if (c === 'dark') pal.k = 'ink';
  def(`roof_${c}_ridge`, pal, ROOF_RIDGE);
  def(`roof_${c}_body`, pal, ROOF_BODY);
  def(`roof_${c}_eave`, pal, ROOF_EAVE);
  // verge ends: a dark outline plus a lit barge board on the west end, a shaded one on the east
  for (const part of ['ridge', 'eave']) {
    const rows = part === 'ridge' ? ROOF_RIDGE : ROOF_EAVE;
    def(`roof_${c}_${part}_l`, pal, rows.map((r) => (r[0] === '.' ? r : 'kl' + r.slice(2))));
    def(`roof_${c}_${part}_r`, pal, rows.map((r) => (r[0] === '.' ? r : r.slice(0, 14) + 'dk')));
  }
}
// Chimney (16x24, bottom aligned to the ridge tile): brick stack with mortar courses, lit left
// face, a stone cap slab and a clay pot, rising clear of the roofline so the house silhouette breaks.
def('chimney', { b: 'br2', d: 'br1', k: 'br0', l: 'br3', c: 'st3', m: 'st2', n: 'st1', p: 'red3', q: 'red1', o: 'uiink' }, [
  '................',
  '.......pq.......',
  '......opqo......',
  '.....nnnnnnn....',
  '.....ccccccmn...',
  '.....nnnnnnnn...',
  '......lbbbdk....',
  '......lbbbdk....',
  '......kkkkkk....',
  '......lbbbdk....',
  '......lbbbdk....',
  '......kkkkkk....',
  '......lbbbdk....',
  '......lbbbdk....',
  '......kkkkkk....',
  '......lbbbdk....',
  '......lbbbdk....',
  '.....kkkkkkkk...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], 16, 24);
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
// Bush: blocking, so it has a visible base line and a cast shadow bottom-right. Canopy is lighter
// than the turf so it pops; outline is a dark shade of its own green.
const BUSH_LOBES = [{ cx: 5.5, cy: 8, r: 4.6 }, { cx: 10, cy: 7, r: 4.6 }, { cx: 8, cy: 9.6, r: 4.6 }];
const BUSH_BASE = [
  '..............s.',
  '.............ss.',
  '.....xxxxxxxssss',
  '........ssssss..',
];
def('bush', { k: 'grass0', n: 'pine0', d: 'grass1', b: 'grass3', l: 'grass4', s: 'shadow', x: 'uiink' },
  blit(blit(blank(16, 16), BUSH_BASE, 0, 12), canopy(16, 16, BUSH_LOBES, { out: 'k', deep: 'n', l: 'l', b: 'b', d: 'd' }), 0, 0));
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
// Broadleaf trees: procedural clustered canopies (see `canopy`) over a hand-drawn trunk, base line
// and dithered cast shadow. Four sway frames shift the crown a pixel against the trunk.
const TRUNK_ROWS = [
  '...............vut..............',
  '...............vut..............',
  '...............vut..............',
  '...............vut..............',
  '...............vuut.............',
  '...............vuut.....s.......',
  '..............vvuutt..ssss......',
  '.............xxxxxxxxsssssss....',
  '..........sssssssssssssssssss...',
  '............ssssssssssssssss....',
  '...............ssssssssss.......',
];
const SWAY = [0, 1, 0, -1];
function treeFrames(lobes, chars, decorate = (rows) => rows) {
  const crown = decorate(canopy(32, 24, lobes, chars));
  return SWAY.map((dx) => blit(blit(blank(32, 32), TRUNK_ROWS, 0, 21), crown, dx, 0));
}
const ALDER_LOBES = [
  { cx: 15.5, cy: 8, r: 7.5 }, { cx: 9, cy: 13, r: 7 }, { cx: 22, cy: 13, r: 7 }, { cx: 15.5, cy: 16, r: 6.5 },
];
def('tree_alder', { k: 'ald0', n: 'pine1', d: 'ald1', b: 'ald2', l: 'ald3', t: 'aldbark0', u: 'aldbark1', v: 'aldbark2', s: 'shadow', x: 'uiink' },
  treeFrames(ALDER_LOBES, { out: 'k', deep: 'n', l: 'l', b: 'b', d: 'd' }), 32, 32);
const FRUIT_LOBES = [
  { cx: 15.5, cy: 7.5, r: 7 }, { cx: 9, cy: 12.5, r: 7.5 }, { cx: 22, cy: 12.5, r: 7.5 }, { cx: 15.5, cy: 15, r: 7 },
];
const PEAR = ['gf', 'ff', 'ee'];
const PEAR_SPOTS = [[8, 8], [19, 5], [13, 13], [23, 13], [9, 16], [17, 18]];
const hangFruit = (rows) => PEAR_SPOTS.reduce((r, [x, y]) => blit(r, PEAR, x, y), rows);
const FRUITPAL = { k: 'fr0', n: 'pine0', d: 'fr1', b: 'fr2', l: 'fr3', t: 'wd0', u: 'wd1', v: 'wd2', s: 'shadow', x: 'uiink', f: 'pear', g: 'pear2', e: 'pear0' };
const FRUIT_CH = { out: 'k', deep: 'n', l: 'l', b: 'b', d: 'd' };
def('tree_fruit', FRUITPAL, treeFrames(FRUIT_LOBES, FRUIT_CH, hangFruit), 32, 32);
// Bare variant: fruit chars become canopy.
def('tree_fruit_bare', { ...FRUITPAL, f: 'fr2', g: 'fr3', e: 'fr1' }, treeFrames(FRUIT_LOBES, FRUIT_CH, hangFruit), 32, 32);

/* ---------------------------------------------------------- landmarks */
// Waystone: a dock marker; stone pillar, iron ring, glowing rune (exempt). 16x32, anchor bottom tile.
def('waystone', { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', i: 'iron', r: '!rune', w: '!runew', g: 'grass1', s: 'shadow', x: 'uiink' }, [
  '.....kkkkk......',
  '....khhllmk.....',
  '...khhlllmmk....',
  '...khllmmmmdk...',
  '...kllmmmmmdk...',
  '...klmmrrmmdk...',
  '...klmrwwrmdk...',
  '...klmmrrmmdk...',
  '...klmmmrmmdk...',
  '...klmmmrmmdk...',
  '...klmrrrrmdk...',
  '...klmmmrmmdk...',
  '...klmmmrmmdk...',
  '...klmmmmmmdk...',
  '..iiiiiiiiiiii..',
  '.iklmmmmmmmddki.',
  '..iiiiiiiiiiii..',
  '...klmmmmmmdk...',
  '...klmmmmmmdk...',
  '...klmmmmmmdk...',
  '...klmmgmmmdk...',
  '...klmggmmmdk...',
  '...klmmmmmmdk...',
  '...klmmmmmmddk..',
  '..kklmmmmmmddk..',
  '..klmmmmmmmdddk.',
  '..klmmmmmmmdddk.',
  '..kkkkkkkkkkkkks',
  '..xxxxxxxxxxxxss',
  '....ssssssssss..',
  '................',
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
  '.......................lllllllll',
  '.......................ddddddddd',
  '..........................lk.dlk',
  '..........................lkd.lk',
  '..........................lk..lk',
  '..........................lk..lk',
  '..........................lk..lk',
  '..........................lk..lk',
  '..........................lk..lk',
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
  '................................',
  '..............b.b.b.b...........',
  '...........b.b.b.b.b.b.b........',
  '.........b.b.baaaaaab.b.b.......',
  '.......b.b.baaaaaaaaaab.b.b.....',
  '......b.b.aaaaaaaaaaaaaa.b.b....',
  '.....b.b.aaaaaaaaaaaaaaaa.b.b...',
  '.....b.b.aaaaaaaaaaaaaaaa.b.b...',
  '......b.b.aaaaaaaaaaaaaa.b.b....',
  '.......b.b.baaaaaaaaaab.b.b.....',
  '.........b.b.baaaaaab.b.b.......',
  '...........b.b.b.b.b.b.b........',
  '..............b.b.b.b...........',
  '................................',
  '................................',
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
